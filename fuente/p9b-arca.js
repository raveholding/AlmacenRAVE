/* =====================================================================
   ARCA · facturación electrónica — lado del navegador (Sistema RAVE)
   El navegador NUNCA habla con ARCA ni guarda claves: pide todo a la Edge Function
   "arca" del servidor (WSAA + WSFE), que guarda la clave privada cifrada y reintenta.
   Con la nube sin configurar (demo) el CAE es un SIMULADOR rotulado "SIN VALIDEZ FISCAL".
   ===================================================================== */
const ARC={st:null,stAt:0,blocked:new Set(),errs:{},inflight:new Set(),tickBusy:false,lastRe:0,wiz:{csr:'',steps:null,msg:''}};
const arcaOn=()=>!!(CLOUD.on&&cl.ready);
const arcaIntegr=()=>{if(!S.integ)S.integ={};if(!S.integ.arca)S.integ.arca={ambiente:'homologacion'};return S.integ.arca;};
const arcaAmb=()=>arcaIntegr().ambiente==='produccion'?'produccion':'homologacion';
const arcaRcpMap=()=>{if(!S.arcaRcp)S.arcaRcp={};return S.arcaRcp;};
const arcaSleep=ms=>new Promise(r=>setTimeout(r,ms));
function arcaCuitOk(s){s=String(s||'').replace(/\D/g,'');if(s.length!==11)return false;const w=[5,4,3,2,7,6,5,4,3,2];let t=0;for(let i=0;i<10;i++)t+=w[i]*(+s[i]);let d=11-(t%11);if(d===11)d=0;if(d===10)return false;return d===+s[10];}
const arcaCuitFmt=s=>{s=String(s||'').replace(/\D/g,'');return s.length===11?s.slice(0,2)+'-'+s.slice(2,10)+'-'+s[10]:s;};
const arcaFecha=f=>String(f||'').split('-').reverse().join('/');
const arcaCall=(accion,extra)=>hreq('/functions/v1/arca',{method:'POST',fn:true,body:Object.assign({accion,comercio:cl.comercio.id,ambiente:arcaAmb()},extra||{})});
async function arcaEstado(force){if(!arcaOn())return null;if(!force&&ARC.st&&Date.now()-ARC.stAt<60000&&ARC.st._amb===arcaAmb())return ARC.st;
 try{const r=await arcaCall('estado');r._amb=arcaAmb();ARC.st=r;ARC.stAt=Date.now();return r;}catch(e){return ARC.st&&ARC.st._amb===arcaAmb()?ARC.st:null;}}

/* ---------- receptor de la factura (en el cobro) ---------- */
const ARC_DOC=[['99','Consumidor final (sin identificar)'],['96','DNI'],['80','CUIT'],['86','CUIL']];
const ARC_COND=[['5','Consumidor final'],['1','IVA Responsable Inscripto'],['6','Responsable Monotributo'],['4','IVA Sujeto Exento'],['13','Monotributista Social']];
function arcaRcpHtml(){if(!pos.arca)return'';const r=pos.rcp||(pos.rcp={t:'99',n:'',c:'5',nm:''});
 const ident=r.t!=='99';
 return `<div class="card" style="margin:.5rem 0"><b class="sm">Receptor de la factura</b> <span class="sm mut">(si no se identifica, sale a Consumidor final)</span>
 <div class="grid g2"><div><label for="rc-t">Documento</label><select id="rc-t">${ARC_DOC.map(([k,t])=>`<option value="${k}" ${r.t===k?'selected':''}>${t}</option>`).join('')}</select></div>
 <div><label for="rc-n">Número</label><input id="rc-n" inputmode="numeric" maxlength="13" autocomplete="off" placeholder="${r.t==='80'||r.t==='86'?'CUIT / CUIL (11 dígitos)':'DNI'}" value="${esc(r.n)}" ${ident?'':'disabled'}></div>
 <div><label for="rc-c">Condición frente al IVA</label><select id="rc-c">${ARC_COND.map(([k,t])=>`<option value="${k}" ${r.c===k?'selected':''}>${t}</option>`).join('')}</select></div>
 <div><label for="rc-nm">Nombre o razón social</label><input id="rc-nm" maxlength="80" autocomplete="off" value="${esc(r.nm)}" ${ident?'':'disabled'}></div></div>
 <p class="sm mut">Factura A sólo si el receptor es Responsable Inscripto. Montos altos a Consumidor final exigen identificar al comprador [VERIFICAR el umbral vigente en ARCA].</p></div>`;}
function arcaRcpSync(w){if(!pos.arca||!w)return;const g=id=>w.querySelector('#'+id);const r=pos.rcp||(pos.rcp={t:'99',n:'',c:'5',nm:''});
 if(g('rc-t')){const t=g('rc-t').value;if(t!==r.t){r.t=t;if(t==='99'){r.n='';r.c='5';r.nm='';}else if(t==='80'&&r.c==='5')r.c='1';else if((t==='96')&&r.c==='1')r.c='5';}}
 if(g('rc-n')&&!g('rc-n').disabled)r.n=g('rc-n').value.replace(/[^\d]/g,'');if(g('rc-c'))r.c=g('rc-c').value;if(g('rc-nm')&&!g('rc-nm').disabled)r.nm=g('rc-nm').value.trim();}
function arcaRcpCheck(){const r=pos.rcp;if(!r||r.t==='99')return'';const n=String(r.n||'').replace(/\D/g,'');
 if(r.t==='96'&&!/^\d{6,9}$/.test(n))return'El DNI del receptor no es válido.';
 if((r.t==='80'||r.t==='86')&&!arcaCuitOk(n))return'El CUIT/CUIL del receptor no es válido.';
 if(r.c==='5'&&(r.t==='80'))return'Un CUIT identificado no suele ser Consumidor final: revisá la condición frente al IVA.';return'';}
function arcaRcpGet(){const r=pos.rcp;if(!r||r.t==='99')return{docTipo:99,docNro:'0',condIva:5,nombre:'Consumidor final'};return{docTipo:+r.t,docNro:String(r.n).replace(/\D/g,''),condIva:+r.c,nombre:r.nm||''};}
function arcaRcpStore(id,r){arcaRcpMap()[id]=r;}
/* al cambiar el documento hay que redibujar para habilitar/deshabilitar los campos */
document.addEventListener('change',e=>{if(e.target&&e.target.id==='rc-t'){const w=cobroW();if(w)cobroRender();}});

/* ---------- aplicar el resultado en la venta ---------- */
function arcaApply(sale,key,r){const o=Object.assign({},r);['ok','ya','observaciones','mensaje','codigos','reintento_en_seg'].forEach(k=>delete o[k]);
 let inSync=false;const fk='ventas|'+sale.id;
 try{if(CLOUD.on&&cl.ready&&cl.fp){inSync=cl.fp[fk]!==undefined&&cl.fp[fk]===cyrb(canon(stripOf(BYC.ventas,sale)));}}catch(e){}
 sale[key]=o;
 try{if(inSync)cl.fp[fk]=cyrb(canon(stripOf(BYC.ventas,sale)));}catch(e){}
 save();}

/* ---------- simulador (SÓLO demo, sin nube) ---------- */
function arcaSim(sale,nc){const total=sale.total;const iva=Math.round(total-total/1.21),neto=total-iva;
 const f=dkey(now());const v=dkey(now()+10*86400000);
 S.arcaSimSeq=(S.arcaSimSeq||0)+1;
 const o={id:'sim-'+sale.id+(nc?'-nc':''),estado:'aprobado',tipo:nc?8:6,letra:'B',pto:1,nro:S.arcaSimSeq,cae:'7'+String(Math.floor(Math.random()*1e13)).padStart(13,'0'),vto:v,fecha:f,total,neto,iva,
  cuit:arcaCuitFmt(S.tenant.cuit)||'20-00000000-0',razon:S.tenant.legal||S.tenant.name,cond:'RI',receptor:{docTipo:99,docNro:'0',condIva:5,nombre:''},error:null,ambiente:'simulacion',sim:true,qr:null};
 sale[nc?'arcaNC':'arca']=o;audit(nc?'ARCA_NC_SIM':'ARCA_CAE_SIM',sale.n+' · simulado');save();return o;}

/* ---------- pedir el CAE ---------- */
async function arcaSyncFirst(){for(let i=0;i<48&&cl.busy;i++)await arcaSleep(250);await cloudSync();for(let i=0;i<48&&cl.busy;i++)await arcaSleep(250);}
async function arcaEmit(sale){
 if(ARC.inflight.has(sale.id))return{ok:false,pending:true,msg:'Ya se está pidiendo.'};ARC.inflight.add(sale.id);
 try{
  await arcaSyncFirst();
  const rcp=arcaRcpMap()[sale.id]||undefined;
  const r=await arcaCall('emitir',{venta_id:sale.id,receptor:rcp});
  if(r.estado==='aprobado'&&r.cae){arcaApply(sale,'arca',r);delete arcaRcpMap()[sale.id];ARC.blocked.delete(sale.id);delete ARC.errs[sale.id];
   if(ARC.st&&ARC.st.config)ARC.st.config.activo=true;audit('ARCA_CAE',sale.n+' · '+r.letra+' '+String(r.pto).padStart(4,'0')+'-'+String(r.nro).padStart(8,'0'));return{ok:true};}
  if(r.estado==='rechazado'||r.ok===false){const m=r.error||'ARCA rechazó el comprobante.';ARC.errs[sale.id]=m;ARC.blocked.add(sale.id);return{ok:false,blocked:true,msg:m};}
  return{ok:false,pending:true,msg:r.mensaje||'Pendiente en ARCA.'};
 }catch(e){
  if(e.net)return{ok:false,pending:true,msg:'Sin conexión: se pide solo cuando vuelva.'};
  if(e.status===401)return{ok:false,pending:true,msg:'Sesión vencida: volvé a ingresar.'};
  const m=String(e.message||'error');
  if(e.status===422){if(/todavía no llegó/i.test(m))return{ok:false,pending:true,msg:'La venta todavía se está subiendo; se reintenta.'};ARC.errs[sale.id]=m;ARC.blocked.add(sale.id);return{ok:false,blocked:true,msg:m};}
  ARC.errs[sale.id]=m;return{ok:false,pending:true,msg:m};
 }finally{ARC.inflight.delete(sale.id);}}

function arcaReceiptModal(sale,stamp,extra,blocked){
 const a=sale.arca;const ok=a&&a.cae;
 const body=ok?`<div class="okbox"><b>Factura ${esc(a.letra)} ${String(a.pto).padStart(4,'0')}-${String(a.nro).padStart(8,'0')}</b> · CAE ${esc(a.cae)} · vto. ${esc(arcaFecha(a.vto))}${a.sim?'<br><span class="tag sim">SIMULADO · SIN VALIDEZ FISCAL</span>':''}</div>`
  :`<div class="warnbox"><b>Factura pendiente de CAE.</b> ${esc(extra||'')}<br><span class="sm">${blocked?'La venta ya está registrada, pero <b>no se reintenta sola</b>: revisá el dato que ARCA objetó. Desde Periféricos y ticket → Facturación electrónica podés pedir el CAE de nuevo o anular la venta.':'La venta ya está registrada. El sistema reintenta solo mientras haya un equipo abierto; también podés hacerlo desde Periféricos y ticket → Facturación electrónica.'}</span></div>`;
 modal('Venta '+sale.n+' registrada',`<div class="okbox">Total ${money(sale.total)} · ${esc(MET[sale.method])}${sale.recv&&sale.method==='efectivo'&&sale.recv>=sale.total?' · vuelto '+money(sale.recv-sale.total):''}${sale.fiado?' · queda en cuenta corriente':''}</div>${body}${stamp?`<div class="okbox">⭐ Sello sumado a ${esc(stamp.custName)}: ${stamp.stamps}/${S.loyalty.goal}${stamp.reward?' · ¡premio disponible!':''}</div>`:''}<p class="sm mut">¿Querés imprimir el ticket? ${ok?'Lleva CAE y QR de ARCA.':'Hasta tener CAE no hay factura válida.'}</p>`,
  {okText:'Imprimir ticket',cancelText:'Nueva venta',onOk:()=>{printSale(sale.id,{reprint:true});}});}
async function arcaPostSale(sale,stamp){
 if(!CLOUD.on){arcaSim(sale);arcaReceiptModal(sale,stamp);return;}
 if(!arcaOn()){arcaReceiptModal(sale,stamp,'La nube no está conectada en este equipo.');return;}
 const w=modal('Facturación electrónica',`<div class="card" style="text-align:center"><div style="font:700 2.4rem Georgia">⏳</div><p>Pidiendo el CAE a ARCA…</p><p class="sm mut">Puede tardar unos segundos. Si ARCA no responde, la venta queda registrada y se reintenta sola.</p></div>`,{ok:false,cancelText:'Seguir sin esperar'});
 let closed=false;w.addEventListener('click',e=>{if(e.target.closest('[data-m=x]'))closed=true;});
 const r=await arcaEmit(sale);
 if(!closed&&w.isConnected)w.remove();
 if(closed){if(r.ok)toast('CAE obtenido: factura '+sale.arca.letra+' '+String(sale.arca.pto).padStart(4,'0')+'-'+String(sale.arca.nro).padStart(8,'0'));return;}
 arcaReceiptModal(sale,stamp,r.ok?'':r.msg,!!r.blocked);}

/* ---------- reintentos automáticos (se llama desde cada sincronización) ---------- */
function arcaPendientes(){return S.sales.filter(s=>s.doc==='factura_pendiente_cae'&&s.status==='ok'&&!(s.arca&&s.arca.cae));}
async function arcaTick(){if(!arcaOn()||ARC.tickBusy)return;if(!arcaPendientes().length)return;const st=await arcaEstado();if(!st||!st.config||!st.config.activo)return;
 ARC.tickBusy=true;
 try{
  const mine=arcaPendientes().filter(s=>s.caja===S.tenant.caja&&!ARC.blocked.has(s.id)&&!(s.arca&&s.arca.estado==='rechazado')&&!ARC.inflight.has(s.id)).slice(0,3);
  for(const s of mine){const r=await arcaEmit(s);if(!r.ok&&r.pending&&/conexi/i.test(r.msg))break;}
  if(Date.now()-ARC.lastRe>60000){ARC.lastRe=Date.now();try{const r=await arcaCall('reintentar');if(r&&r.procesados)await cloudSync();}catch(e){}}
 }finally{ARC.tickBusy=false;}}

/* ---------- nota de crédito ---------- */
const _arcVoid=A.voidsale;
function arcaNCFlow(s){
 const w=modal('Nota de crédito · '+s.n,`<p>Esta venta tiene <b>CAE</b> (factura ${esc(s.arca.letra)} ${String(s.arca.pto).padStart(4,'0')}-${String(s.arca.nro).padStart(8,'0')}). Una factura con CAE no se borra: se emite una <b>nota de crédito</b> en ARCA y recién después se anula la venta (vuelve el stock). La nota de crédito <b>no se puede deshacer</b>.</p>${s.arca.sim?'<p class="sm"><span class="tag sim">SIMULADO</span> sin validez fiscal.</p>':''}<label for="nc-m">Motivo (obligatorio)</label><input id="nc-m" maxlength="100" autocomplete="off">`,
  {okText:'Emitir nota de crédito',onOk:async ww=>{const mot=val('nc-m').trim();if(mot.length<3){ww._err('Escribí el motivo.');return false;}
   if(s.arca.sim){arcaSim(s,true);voidCore(s,'NC simulada · '+mot);toast('Nota de crédito simulada emitida');return;}
   if(!arcaOn()){ww._err('Sin conexión con la nube: la nota de crédito se emite con internet.');return false;}
   ww._err('Emitiendo la nota de crédito…');
   try{await arcaSyncFirst();const r=await arcaCall('nota_credito',{venta_id:s.id});
    if(r.estado==='aprobado'&&r.cae){arcaApply(s,'arcaNC',r);voidCore(s,'NC '+r.letra+' '+String(r.pto).padStart(4,'0')+'-'+String(r.nro).padStart(8,'0')+' · '+mot);audit('ARCA_NC',s.n+' · '+r.nro);toast('Nota de crédito emitida · CAE '+r.cae);
     return;}
    ww._err(r.error||r.mensaje||'ARCA no aprobó la nota de crédito todavía. Reintentá en unos minutos.');return false;
   }catch(e){ww._err(e.net?'Sin conexión: reintentá cuando vuelva internet.':String(e.message||'error'));return false;}}});
 return w;}
A.voidsale=el=>{const s=S.sales.find(x=>x.id===el.dataset.id);if(!s)return;
 if(s.arca&&s.arca.cae&&!s.arcaNC&&s.status!=='anulada'){if(!can('void'))return toast('Sólo administración puede emitir notas de crédito.',1);return arcaNCFlow(s);}
 _arcVoid(el);};
function arcaNCPrint(s){if(!s.arcaNC)return;printSale(s.id,{sale:Object.assign({},s,{_nc:s.arcaNC}),copy:'nc',reprint:true});}
A.arcNcPrint=el=>{const s=S.sales.find(x=>x.id===el.dataset.id);if(s)arcaNCPrint(s);};
A.arcTkPrint=el=>{const s=S.sales.find(x=>x.id===el.dataset.id);if(s)printSale(s.id,{reprint:true});};

/* ---------- tarjeta en Periféricos y ticket ---------- */
function arcaCardHtml(){return `<div class="card" style="margin-top:1rem" id="arca-card"><h3>Facturación electrónica (ARCA)</h3><div id="arca-box"><p class="mut sm">Cargando…</p></div></div>`;}
function arcaCardInit(){const box=document.getElementById('arca-box');if(!box)return;
 if(!CLOUD.on){const n=S.sales.filter(s=>s.arca&&s.arca.sim).length;box.innerHTML=`<span class="tag sim">DEMO · SIMULADOR</span><p class="sm">En esta demo, <b>Con ARCA (F8)</b> genera un comprobante <b>simulado</b> (letra B, CAE inventado) para mostrar el recorrido completo: factura, ticket con CAE y nota de crédito. Lleva el rótulo <b>COMPROBANTE SIMULADO · SIN VALIDEZ FISCAL</b> y no se envía a ningún lado.</p><p class="sm">En el sistema del cliente el CAE lo pide el servidor a ARCA (WSAA + WSFE) con el certificado del propio comercio. Simulados en esta sesión: <b>${n}</b>.</p>`;return;}
 if(!arcaOn()){box.innerHTML='<p class="warnbox sm">Ingresá con tu usuario de la nube para configurar ARCA.</p>';return;}
 arcaRender();}
async function arcaRender(force){const box=document.getElementById('arca-box');if(!box)return;
 const st=await arcaEstado(force);const admin=cl.rol==='admin';const amb=arcaAmb();
 const pend=arcaPendientes();
 let h=`<div class="row" style="flex-wrap:wrap"><span class="sm">Ambiente:</span><button class="btn sm ${amb==='homologacion'?'on':''}" data-act="arcAmb" data-id="homologacion">Homologación (pruebas)</button><button class="btn sm ${amb==='produccion'?'on':''}" data-act="arcAmb" data-id="produccion">Producción</button>
  ${st&&st.config?`<span class="tag ${st.config.activo?'ok':'warn'}">${st.config.activo?'ACTIVA':'sin activar'}</span>`:'<span class="tag warn">sin configurar</span>'}</div>
  <p class="sm mut">Homologación y producción son entornos separados (certificados y puntos de venta distintos). <b>No se factura en serio hasta probar en homologación con el certificado real del cliente.</b></p>`;
 if(!st){h+='<div class="warnbox sm">No se pudo consultar el estado (sin conexión o la función <b>arca</b> no está desplegada en Supabase). Reintentá.</div><button class="btn sm" data-act="arcRefresh">Reintentar</button>';box.innerHTML=h;return;}
 if(st.servidor&&st.servidor.llave_maestra===false)h+='<div class="errbox sm"><b>Falta la clave maestra del servidor</b> (secreto <code>ARCA_MASTER_KEY</code>). Rave Holding la carga en Supabase; sin ella no se puede guardar ningún certificado.</div>';
 const c=st.config||{},cr=st.credenciales||{};
 if(admin){
  h+=`<h4 style="margin:.8rem 0 .2rem">1 · Datos del emisor</h4><div class="grid g2">
   <div><label for="ar-cuit">CUIT (11 dígitos)</label><input id="ar-cuit" inputmode="numeric" maxlength="13" placeholder="20-12345678-6" value="${esc(arcaCuitFmt(c.cuit||''))}"></div>
   <div><label for="ar-rz">Razón social</label><input id="ar-rz" maxlength="100" value="${esc(c.razon_social||'')}"></div>
   <div><label for="ar-cond">Condición frente al IVA</label><select id="ar-cond"><option value="MONO" ${c.cond_iva==='MONO'?'selected':''}>Monotributo (factura C)</option><option value="RI" ${c.cond_iva==='RI'||!c.cond_iva?'selected':''}>Responsable Inscripto (A / B)</option></select><span class="sm mut">IVA Exento todavía no está soportado.</span></div>
   <div><label for="ar-pto">Punto de venta (web services)</label><input id="ar-pto" inputmode="numeric" maxlength="5" placeholder="Ej.: 3" value="${c.pto_vta?esc(c.pto_vta):''}"></div>
   <div><label for="ar-alias">Alias del certificado (sin espacios)</label><input id="ar-alias" maxlength="40" placeholder="ej.: rave-almacen" value="${esc(c.alias||'')}"></div>
   <div><label for="ar-al">Alícuota de IVA general</label><select id="ar-al">${[21,10.5,27,0].map(a=>`<option value="${a}" ${+(c.alicuota??21)===a?'selected':''}>${String(a).replace('.',',')} %</option>`).join('')}</select></div></div>
   <label class="chk"><input type="checkbox" id="ar-act" ${c.activo?'checked':''}> Activar la emisión automática (requiere certificado cargado)</label>
   <div class="row"><button class="btn gold" data-act="arcSave">Guardar datos del emisor</button></div>
   <p class="sm mut">Con comprobantes ya aprobados no se puede cambiar el CUIT ni el punto de venta.</p>
   <h4 style="margin:.8rem 0 .2rem">2 · Certificado digital: paso a paso</h4>
   ${arcaGuiaHtml(st,amb)}
   <h4 style="margin:.8rem 0 .2rem">3 · Probar la conexión</h4><p class="sm mut">Cuando termines los pasos 1 a 5, tocá el botón: el sistema verifica los servidores de ARCA, el certificado, la autorización al servicio y el punto de venta, y te dice cuál falta.</p>
   <div class="row"><button class="btn" data-act="arcProbar">Probar conexión con ARCA (${amb==='produccion'?'PRODUCCIÓN':'homologación'})</button></div>
   <div id="ar-pasos">${arcaPasosHtml()}</div>`;
 }else h+='<p class="sm mut">La configuración del certificado la hace un administrador.</p>';
 h+=`<h4 style="margin:.8rem 0 .2rem">Facturas pendientes de CAE</h4>`;
 h+=pend.length?`<div class="tw"><table><thead><tr><th>Venta</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>${pend.slice(-12).map(s=>{const e=ARC.errs[s.id]||(s.arca&&s.arca.error)||'';const rej=s.arca&&s.arca.estado==='rechazado';return `<tr><td>${esc(s.n)}</td><td>${money(s.total)}</td><td class="sm">${rej?'<span class="tag bad">rechazada</span>':ARC.blocked.has(s.id)?'<span class="tag bad">requiere revisión</span>':'<span class="tag warn">en cola</span>'} ${esc(e)}</td><td class="r"><button class="btn sm" data-act="arcRe" data-id="${s.id}">Pedir CAE</button>${rej||ARC.blocked.has(s.id)?` <button class="btn sm red" data-act="voidsale" data-id="${s.id}">Anular</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`:'<p class="sm mut">No hay facturas pendientes.</p>';
 const emi=S.sales.filter(s=>s.arca&&s.arca.cae).slice(-6).reverse();
 if(emi.length)h+=`<h4 style="margin:.8rem 0 .2rem">Últimos comprobantes con CAE</h4><div class="tw"><table><tbody>${emi.map(s=>`<tr><td>${esc(s.n)}</td><td>${esc(s.arca.letra)} ${String(s.arca.pto).padStart(4,'0')}-${String(s.arca.nro).padStart(8,'0')}</td><td class="sm">CAE ${esc(s.arca.cae)}${s.arcaNC?' · NC '+String(s.arcaNC.nro).padStart(8,'0'):''}${s.arca.sim?' · simulado':''}</td><td class="r"><button class="btn sm" data-act="arcTkPrint" data-id="${s.id}">Ticket</button>${s.arcaNC?` <button class="btn sm" data-act="arcNcPrint" data-id="${s.id}">Ticket NC</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
 h+='<p class="sm mut" style="margin-top:.6rem">El pedido del CAE lo hace el servidor (WSAA + WSFE), nunca el navegador. Si ARCA no responde, la venta queda registrada y se reintenta con espera creciente; los reintentos corren mientras algún equipo tenga el sistema abierto. Nombres de servicios, menús y URLs de ARCA: [VERIFICAR en arca.gob.ar].</p>';
 box.innerHTML=h;
 const f=document.getElementById('ar-crtf');if(f)f.addEventListener('change',()=>{const fl=f.files&&f.files[0];if(!fl)return;if(fl.size>20000){toast('Archivo demasiado grande para ser un certificado.',1);f.value='';return;}const rd=new FileReader();rd.onload=()=>{const t=arcaCertTexto(rd.result);const ta=document.getElementById('ar-crt');if(ta)ta.value=t.pem||'';const m=document.getElementById('ar-crtmsg');if(m){m.textContent=t.error||'Archivo leído: '+fl.name+'. Ahora tocá “Cargar certificado”.';m.className='sm '+(t.error?'errtxt':'mut');}if(t.error)toast(t.error,1);};rd.readAsArrayBuffer(fl);});}
/* ---- Guía de certificado ARCA (instructivo integrado) ---- */
function arcaB64(u8){let b='';for(let i=0;i<u8.length;i++)b+=String.fromCharCode(u8[i]);return btoa(b);}
/* Normaliza lo que el cliente pega o sube: PEM de texto, PEM con basura alrededor o DER binario. Nunca acepta claves ni CSR. */
function arcaCertTexto(input){let txt='';
 if(input instanceof ArrayBuffer){const u=new Uint8Array(input);
  if(u.length>2&&u[0]===0x30&&u[1]>=0x80){const l=arcaB64(u).replace(/(.{64})/g,'$1\n').trim();return {pem:'-----BEGIN CERTIFICATE-----\n'+l+'\n-----END CERTIFICATE-----\n'};}
  txt=new TextDecoder('utf-8').decode(u);}else txt=String(input||'');
 txt=txt.replace(/^﻿/,'').replace(/\r\n?/g,'\n');
 if(/PRIVATE KEY-----/.test(txt))return {error:'Eso es una CLAVE PRIVADA, no el certificado. Nunca la pegues acá: la clave del sistema se genera y queda guardada en el servidor. Pegá el archivo .crt que te bajó ARCA.'};
 if(/BEGIN (NEW )?CERTIFICATE REQUEST/.test(txt)&&!/BEGIN CERTIFICATE-----/.test(txt))return {error:'Pegaste el pedido (CSR). Lo que va acá es el certificado que ARCA te devuelve (.crt, empieza con -----BEGIN CERTIFICATE-----).'};
 const m=txt.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
 if(!m){const compact=txt.replace(/\s+/g,'');if(/^MII[A-Za-z0-9+/=]{200,}$/.test(compact))return {pem:'-----BEGIN CERTIFICATE-----\n'+compact.replace(/(.{64})/g,'$1\n').trim()+'\n-----END CERTIFICATE-----\n'};
  return {error:'No encuentro un certificado en el texto. Tiene que empezar con -----BEGIN CERTIFICATE----- y terminar con -----END CERTIFICATE-----.'};}
 const body=m[0].replace(/-----(BEGIN|END) CERTIFICATE-----/g,'').replace(/\s+/g,'');
 if(!/^[A-Za-z0-9+/=]+$/.test(body)||body.length<200)return {error:'El certificado está cortado o tiene caracteres raros. Copialo de nuevo completo.'};
 return {pem:'-----BEGIN CERTIFICATE-----\n'+body.replace(/(.{64})/g,'$1\n').trim()+'\n-----END CERTIFICATE-----\n'};}
const ARC_URL={login:'https://auth.afip.gob.ar/contribuyente_/login.xhtml',ayuda:'https://www.afip.gob.ar/ws/'};
function arcaCopyBtn(v,l){return `<button class="btn sm" data-act="arcCopy" data-id="${esc(v)}" aria-label="Copiar ${esc(l)}">Copiar</button>`;}
function arcaGuiaHtml(st,amb){const c=(st&&st.config)||{},cr=(st&&st.credenciales)||{};const prod=amb==='produccion';
 const cuit=arcaCuitFmt(c.cuit||'').replace(/\D/g,'');const alias=c.alias||'';
 const okEmi=!!(cuit&&alias&&c.pto_vta);const okCsr=!!cr.tiene_clave;const okCrt=!!cr.tiene_cert;
 const probe=ARC.wiz.steps;const okSrv=!!(probe&&probe.length&&probe.every(x=>x.ok));
 const mk=(n,ok,t,cuerpo,abierto)=>`<details class="arcstep" ${abierto?'open':''} style="border:1px solid var(--line,#ddd);border-radius:12px;padding:.5rem .8rem;margin:.4rem 0"><summary style="min-height:44px;display:flex;align-items:center;gap:.5rem;cursor:pointer"><span aria-hidden="true">${ok?'✔':'○'}</span><b>Paso ${n} · ${t}</b><span class="tag ${ok?'ok':'warn'}">${ok?'hecho':'pendiente'}</span></summary><div class="sm">${cuerpo}</div></details>`;
 const first=!okEmi?1:!okCsr?2:!okCrt?3:!okSrv?4:5;
 let h=`<p class="sm"><b>Estado:</b> ${okCsr?'✔ Clave generada':'✘ Sin clave'} · ${okCrt?'✔ Certificado cargado'+(cr.cert_vence?' · vence '+esc(String(cr.cert_vence).slice(0,10)):''):'✘ Sin certificado'}</p><p class="sm">Ambiente elegido: <b>${prod?'PRODUCCIÓN (facturas reales)':'HOMOLOGACIÓN (pruebas)'}</b>. Se hace una vez por ambiente. Necesitás la <b>Clave Fiscal</b> del titular (nivel 3 o superior) [VERIFICAR]. <a href="${ARC_URL.login}" target="_blank" rel="noopener noreferrer">Abrir el ingreso de ARCA</a></p>`;
 h+=mk(1,okEmi,'Completá los datos del emisor',`<p>Arriba: CUIT, razón social, condición frente al IVA, <b>punto de venta</b> y <b>alias</b>. Tocá <b>Guardar datos del emisor</b>.</p><p>Si todavía no tenés el punto de venta, hacelo en el paso 5 y volvé acá a cargar el número.</p>`,first===1);
 h+=mk(2,okCsr,'Generá el pedido de certificado (CSR)',`<p>El sistema crea en el servidor una clave privada que <b>nunca sale de ahí</b> y un pedido (CSR) que sí vas a pasarle a ARCA.</p><div class="row"><button class="btn gold" data-act="arcCsr" ${okEmi?'':'disabled'}>${okCsr?'Volver a generar clave y CSR':'Generar clave y CSR'}</button></div>${okEmi?'':'<p class="warnbox sm">Primero guardá los datos del emisor (paso 1).</p>'}${(ARC.wiz.csr||cr.csr)?`<label for="ar-csr">CSR (es lo que vas a pegar en ARCA)</label><textarea id="ar-csr" rows="5" readonly style="font:11px monospace">${esc(ARC.wiz.csr||cr.csr||'')}</textarea><div class="row" style="flex-wrap:wrap"><button class="btn sm" data-act="arcCsrCopy">Copiar CSR</button><button class="btn sm" data-act="arcCsrDl">Descargar .csr</button></div>`:''}<p class="mut">Si generás una clave nueva, el certificado anterior deja de servir y hay que pedir otro.</p>`,first===2||(!okCrt&&!!(ARC.wiz.csr||cr.csr)));
 const pasoArca=prod?`<ol><li>Entrá a ARCA con tu Clave Fiscal. Si no ves el servicio <b>“Administración de Certificados Digitales”</b>, adherilo desde <b>Administrador de Relaciones de Clave Fiscal → Adherir servicio → ARCA → Servicios Interactivos</b>. [VERIFICAR]</li><li>Abrí <b>Administración de Certificados Digitales</b> y elegí el CUIT del titular.</li><li>Tocá <b>Agregar alias</b>. En <b>Alias</b> escribí: <code>${esc(alias||'(el alias del paso 1)')}</code> ${alias?arcaCopyBtn(alias,'alias'):''}</li><li>En el cuadro del pedido pegá <b>todo el CSR</b> del paso 2 (desde <code>-----BEGIN CERTIFICATE REQUEST-----</code> hasta <code>-----END CERTIFICATE REQUEST-----</code>) y confirmá con <b>Agregar alias</b>.</li><li>Aparece el alias en la lista: tocá <b>Ver / Descargar</b> y bajá el archivo <b>.crt</b>. Si el navegador lo muestra como texto, copialo completo.</li></ol>`:`<ol><li>Entrá a ARCA con tu Clave Fiscal. Para pruebas se usa el servicio <b>“WSASS – Autogestión Certificados Homologación”</b>. Si no lo ves, adherilo desde <b>Administrador de Relaciones de Clave Fiscal → Adherir servicio → ARCA → WebServices</b>. [VERIFICAR]</li><li>Abrí WSASS y elegí <b>Nuevo certificado</b>.</li><li>En <b>Nombre simbólico del DN</b> (alias) escribí: <code>${esc(alias||'(el alias del paso 1)')}</code> ${alias?arcaCopyBtn(alias,'alias'):''}</li><li>En <b>CUIT del contribuyente</b> poné <code>${esc(cuit||'(tu CUIT)')}</code> ${cuit?arcaCopyBtn(cuit,'CUIT'):''} y pegá <b>todo el CSR</b> del paso 2 en el cuadro del pedido.</li><li>Tocá <b>Crear DN y obtener certificado</b>. Se muestra el certificado: copialo completo o bajá el archivo <b>.crt</b>.</li></ol>`;
 h+=mk(3,okCrt,'Pedí el certificado en ARCA ('+(prod?'producción':'homologación')+')',pasoArca+`<p class="mut">El certificado de homologación y el de producción son distintos: no sirve uno para el otro.</p>`,first===3);
 h+=mk(4,okCrt,'Cargá el certificado (.crt) acá',`<label for="ar-crt">Pegá el contenido del .crt (empieza con <code>-----BEGIN CERTIFICATE-----</code>) o elegí el archivo</label><textarea id="ar-crt" rows="5" style="font:11px monospace" placeholder="-----BEGIN CERTIFICATE-----"></textarea><div class="row" style="flex-wrap:wrap"><input type="file" id="ar-crtf" accept=".crt,.pem,.cer,.txt,.der" aria-label="Archivo del certificado"><button class="btn gold" data-act="arcCert" ${okCsr?'':'disabled'}>Cargar certificado</button></div><p id="ar-crtmsg" class="sm mut" role="status">${okCsr?'Acepto .crt, .pem y .cer (texto o binario).':'Primero generá la clave y el CSR (paso 2).'}</p>${okCrt?`<p class="okbox sm">✔ Certificado cargado${cr.cert_vence?' · vence el '+esc(String(cr.cert_vence).slice(0,10)):''}. Anotá la fecha: hay que renovarlo antes de que venza.</p>`:''}<p class="mut"><b>Errores típicos:</b> “no corresponde a la clave” = el .crt se pidió con otro CSR (generá un CSR nuevo y repetí el paso 3). “vencido” = pedí uno nuevo. Nunca pegues una clave privada (.key).</p>`,first===3||first===4&&!okCrt);
 const pasoAut=prod?`<ol><li>Entrá a <b>Administrador de Relaciones de Clave Fiscal</b> → <b>Nueva relación</b>.</li><li>En <b>Servicio</b> tocá <b>Buscar</b> → <b>ARCA → WebServices → Facturación Electrónica</b> (WSFE).</li><li>En <b>Representante</b> / computador fiscal elegí el alias <code>${esc(alias||'')}</code>.</li><li>Confirmá. Debe quedar listada la relación para el servicio <code>wsfe</code>.</li></ol>`:`<ol><li>En WSASS elegí <b>Crear autorización a servicio</b>.</li><li>Seleccioná el DN (alias) <code>${esc(alias||'')}</code>, CUIT representado <code>${esc(cuit||'')}</code> ${cuit?arcaCopyBtn(cuit,'CUIT'):''} y servicio <code>wsfe</code> (Facturación Electrónica).</li><li>Confirmá con <b>Crear autorización de acceso</b>.</li></ol>`;
 h+=mk(5,okSrv,'Autorizá el servicio de facturación y creá el punto de venta',pasoAut+`<p><b>Punto de venta:</b> en el servicio <b>“Administración de puntos de venta y domicilios”</b> elegí <b>A/B/M de puntos de venta → Agregar</b>. Numeralo (usá un número que no tengas), poné nombre de fantasía y en <b>Sistema</b> elegí <b>“RECE para aplicativo y web services”</b> (si sos Monotributista puede figurar “Factura electrónica – Monotributo – Web Services”). Ese número es el del paso 1. [VERIFICAR nombres: ARCA los cambia]</p>`,first===4||first===5);
 h+=`<details style="margin:.4rem 0"><summary style="min-height:44px;display:flex;align-items:center"><b>¿Algo falló? Soluciones a los errores más comunes</b></summary><ul class="sm"><li><b>“Computador no autorizado a acceder al servicio”</b>: falta la relación del paso 5 (servicio <code>wsfe</code> asociado a ese alias) o está en el otro ambiente.</li><li><b>“Certificado no emitido por AC de confianza” / “CMS inválido”</b>: el certificado es de otro ambiente (homologación vs producción). Cambiá el ambiente arriba o pedí el certificado correcto.</li><li><b>“El CEE ya posee un TA válido”</b>: pedí esperar unos minutos y volver a probar; es transitorio.</li><li><b>Punto de venta no habilitado / “no corresponde”</b>: el sistema del punto de venta no es de web services o el número no coincide con el del paso 1.</li><li><b>No encuentro el servicio en ARCA</b>: hay que adherirlo en el Administrador de Relaciones; a veces tarda unos minutos en aparecer.</li><li><b>No tengo Clave Fiscal nivel 3</b>: se sube en una dependencia de ARCA o con la app “Mi ARCA”. [VERIFICAR]</li></ul></details>`;
 return h;}
A.pwToggle=el=>{const i=document.getElementById(el.dataset.for);if(i)i.type=i.type==='password'?'text':'password';};
A.arcCopy=el=>{const v=el.dataset.id||'';try{navigator.clipboard.writeText(v);}catch(e){}toast('Copiado: '+v.slice(0,40));};
function arcaPasosHtml(){const p=ARC.wiz.steps;if(!p)return ARC.wiz.msg?`<p class="sm">${esc(ARC.wiz.msg)}</p>`:'';return `<ul class="sm" style="list-style:none;padding:0">${p.map(x=>`<li>${x.ok?'✔':'✘'} <b>${esc(x.paso)}</b>${x.detalle?' — '+esc(x.detalle):''}</li>`).join('')}</ul>`;}
async function arcaGuard(btn,fn){if(!btn||btn.disabled)return;const t=btn.textContent;btn.disabled=true;btn.textContent='Procesando…';try{await fn();}catch(e){toast(e.net?'Sin conexión':String(e.message||'error').slice(0,200),1);}finally{btn.disabled=false;btn.textContent=t;}}
A.arcRefresh=()=>arcaRender(true);
A.arcAmb=el=>{const a=el.dataset.id;if(a===arcaAmb())return;
 const go=()=>{arcaIntegr().ambiente=a;audit('ARCA_AMBIENTE',a);ARC.st=null;ARC.wiz={csr:'',steps:null,msg:''};save();arcaRender(true);};
 if(a==='produccion')confirmBox('Pasar a PRODUCCIÓN','En producción los comprobantes son <b>reales</b> y quedan registrados ante ARCA. Usalo sólo si ya probaste todo en homologación y tenés el certificado y el punto de venta de producción. ¿Continuar?',go,'Pasar a producción');else go();};
A.arcSave=el=>arcaGuard(el,async()=>{if(cl.rol!=='admin')throw new Error('Sólo un administrador.');
 const cuit=val('ar-cuit').replace(/\D/g,'');if(!arcaCuitOk(cuit))throw new Error('El CUIT no es válido (revisá el dígito verificador).');
 const rz=val('ar-rz').trim();if(rz.length<3)throw new Error('Falta la razón social.');
 const alias=val('ar-alias').trim();if(!/^[A-Za-z0-9_.-]{3,40}$/.test(alias))throw new Error('El alias no puede tener espacios ni símbolos raros.');
 const pto=parseInt(val('ar-pto'),10);if(!(pto>=1&&pto<=99999))throw new Error('Falta el punto de venta.');
 const r=await rpc('arca_guardar_config',{p_comercio:cl.comercio.id,p_ambiente:arcaAmb(),p_cuit:cuit,p_razon:rz,p_cond:val('ar-cond'),p_pto:pto,p_alias:alias,p_alicuota:+val('ar-al'),p_activo:$('#ar-act').checked});
 if(r&&r.ok===false)throw new Error(r.error||'No se pudo guardar.');
 S.tenant.cuit=cuit;S.tenant.legal=S.tenant.legal||rz;S.tenant.iva=val('ar-cond')==='RI'?'IVA Responsable Inscripto':'Responsable Monotributo';
 audit('ARCA_CONFIG',arcaAmb()+' · pto '+pto+(($('#ar-act').checked)?' · activa':''));save();toast('Datos del emisor guardados');await arcaRender(true);});
A.arcCsr=el=>arcaGuard(el,async()=>{const st=await arcaEstado(true);const tiene=st&&st.credenciales&&st.credenciales.tiene_cert;
 const go=async()=>{const r=await arcaCall('generar_csr',{forzar:!!tiene});ARC.wiz.csr=r.csr||'';audit('ARCA_CSR',arcaAmb());toast('Clave y CSR generados');await arcaRender(true);};
 if(tiene){confirmBox('Ya hay un certificado','Generar una clave nueva <b>invalida el certificado actual</b>: tendrías que pedir otro en ARCA. ¿Seguro?',()=>{go().catch(e=>toast(String(e.message||e),1));},'Generar de todos modos');return;}
 await go();});
A.arcCsrCopy=()=>{const t=document.getElementById('ar-csr');if(!t)return;t.select();try{navigator.clipboard.writeText(t.value);toast('CSR copiado');}catch(e){document.execCommand('copy');toast('CSR copiado');}};
A.arcCsrDl=()=>{const t=document.getElementById('ar-csr');if(!t)return;const b=new Blob([t.value],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='rave-arca.csr';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);};
A.arcCert=el=>arcaGuard(el,async()=>{const t=arcaCertTexto(val('ar-crt'));if(t.error)throw new Error(t.error);
 const r=await arcaCall('cargar_cert',{cert:t.pem});audit('ARCA_CERT',arcaAmb()+' · vence '+String(r.vence||'').slice(0,10));ARC.wiz.csr='';{const ta=document.getElementById('ar-crt');if(ta)ta.value='';}toast('Certificado cargado · vence '+String(r.vence||'').slice(0,10));await arcaRender(true);});
A.arcProbar=el=>arcaGuard(el,async()=>{ARC.wiz.steps=null;ARC.wiz.msg='Probando…';const r=await arcaCall('probar');ARC.wiz.steps=r.pasos||[];ARC.wiz.msg='';audit('ARCA_PROBAR',arcaAmb()+' · '+(r.ok?'ok':'falló'));
 const b=document.getElementById('ar-pasos');if(b)b.innerHTML=arcaPasosHtml();toast(r.ok?'Conexión con ARCA correcta':'La prueba falló: mirá el detalle',!r.ok);});
A.arcRe=el=>arcaGuard(el,async()=>{const s=S.sales.find(x=>x.id===el.dataset.id);if(!s)return;ARC.blocked.delete(s.id);
 if(s.arca&&s.arca.estado==='rechazado'){/* ARCA rechazó: sólo vale reintentar si se corrigió algo del lado de ARCA */}
 const r=await arcaEmit(s);toast(r.ok?'CAE obtenido':(r.msg||'Pendiente'),!r.ok);await arcaRender(true);});
