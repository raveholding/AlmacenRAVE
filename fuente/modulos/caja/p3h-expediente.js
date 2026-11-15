/* ===== V26.9 · 4.23.6 Expediente digital de la transacción (drill-down) =====
   Una vista de UNA operación con todo lo que se sabe de ella (nunca baja todos los registros): encabezado e ítems, pagos y detalle de cobros,
   impacto, línea de tiempo de auditoría (rol, dispositivo, valor anterior y nuevo), documentos vinculados y verificación de la cadena.
   Acceso: permiso `audit_read` (administrador y supervisor) para todo; el cajero ve el de SUS ventas, sin datos de otros usuarios ni IP.
   Cada apertura queda auditada (EXPEDIENTE_VISTO). Enlace interno: #expediente/<tipo>/<id>.
   Límites declarados: compra y movimiento de stock no tienen todavía vista de detalle propia (se verán cuando exista); la IP sólo la conoce el servidor. */
const EXP_T={venta:'Venta',nc:'Nota de crédito',cobro:'Cobro',traspaso:'Traspaso',cierre:'Cierre de caja',mov:'Movimiento de caja'};
function expRec(tipo,id){id=String(id||'');
 if(tipo==='venta'||tipo==='nc'||tipo==='cobro'){const sid=id.split('#')[0];const s=S.sales.find(x=>x.id===sid||x.n===sid);return s?{k:'venta',s,idx:tipo==='cobro'&&id.includes('#')?+id.split('#')[1]:-1,id:s.id}:null;}
 if(tipo==='traspaso'){const t=(S.transfers||[]).find(x=>x.id===id||x.num===id);return t?{k:'traspaso',t,id:t.id}:null;}
 if(tipo==='cierre'){const c=S.closures.find(x=>x.id===id);return c?{k:'cierre',c,id:c.id}:null;}
 if(tipo==='mov'){const m=S.movs.find(x=>x.id===id);return m?{k:'mov',m,id:m.id}:null;}
 return null;}
/* nivel de acceso: 'full' (audit_read) · 'own' (el cajero ve sus propias ventas) · null */
function expLevel(r){if(!user||!r)return null;if(can('audit_read'))return'full';
 if(r.k==='venta'&&r.s.user===user.name)return'own';return null;}
function expBtn(tipo,id,label){const r=expRec(tipo,id);if(!expLevel(r))return'';
 return `<button type="button" class="btn sm" data-act="expOpen" data-t="${esc(tipo)}" data-id="${esc(String(id))}">${esc(label||'Ver expediente')}</button>`;}
const expSec=(t,b,open)=>`<details class="expsec" ${open===false?'':'open'}><summary><b>${esc(t)}</b></summary><div class="expbody">${b}</div></details>`;
const expNA=txt=>`<p class="sm mut">${esc(txt)}</p>`;

/* ---------- línea de tiempo (rol, dispositivo, valor anterior y nuevo; la IP sólo la agrega el servidor) ---------- */
function expTL(list,lvl){
 if(lvl==='own')list=list.filter(e=>e.user===(user&&user.name));
 if(!list.length)return expNA('Sin eventos de auditoría registrados para esta operación.');
 return `<ul class="sdtl">${list.map(e=>`<li><span class="sm mut">${fmtDT(e.ts)} · ${esc(e.user)}${lvl==='full'&&e.role?' ('+esc(e.role)+')':''}${lvl==='full'&&e.dev?' · equipo '+esc(String(e.dev).slice(0,12)):''}</span> <b>${esc(e.action)}</b> <span class="sm">${esc(e.detail)}</span>${e.old!=null||e.nw!=null?` <span class="sm">· antes: <i>${esc(e.old==null?'—':e.old)}</i> → ahora: <i>${esc(e.nw==null?'—':e.nw)}</i></span>`:''}${e.reason?` <span class="sm">· motivo: ${esc(e.reason)}</span>`:''}</li>`).join('')}</ul>`;}
function expAuditFor(r){
 const all=allAudit();
 if(r.k==='venta')return saleAuditLines(r.s).concat(all.filter(e=>e.eid===r.s.id&&!saleAuditLines(r.s).includes(e))).sort((a,b)=>a.ts-b.ts);
 if(r.k==='traspaso'){const n=String(r.t.num||'');return all.filter(e=>(n&&String(e.detail||'').includes(n))||e.eid===r.t.id);}
 if(r.k==='cierre')return all.filter(e=>e.eid===r.c.id||((String(e.action).startsWith('CIERRE')||String(e.action).startsWith('ARQUEO'))&&Math.abs(e.ts-r.c.ts)<90000));
 if(r.k==='mov')return all.filter(e=>e.eid===r.m.id||((e.action==='INGRESO_CAJA'||e.action==='EGRESO_CAJA')&&Math.abs(e.ts-r.m.ts)<3000&&String(e.detail||'').includes(String(r.m.concept||''))));
 return[];}

/* ---------- contenido por tipo ---------- */
function expVentaBlocks(r,lvl){const s=r.s;
 const sess=S.sessions.find(x=>x.id===s.sessId)||{};
 const cierre=S.closures.find(c=>c.sessId===s.sessId);
 const trs=(S.transfers||[]).filter(t=>t.fromSess===s.sessId||t.toSess===s.sessId);
 const links=[];
 if(s.arcaNC||s._nc)links.push('Nota de crédito vinculada: '+(s._nc&&s._nc.cae?'CAE '+s._nc.cae:'sin CAE (anulación interna)'));
 if(s.status==='anulada'&&!s.arcaNC)links.push('Operación anulada');
 if(s.doc==='factura_pendiente_cae')links.push(s.arca&&s.arca.cae?'Factura '+s.arca.letra+' · CAE '+s.arca.cae:'Factura pendiente de CAE');
 const lh=links.map(x=>`<li>${esc(x)}</li>`).join('')+
  (cierre?`<li>Cierre de caja que la incluye: ${fmtDT(cierre.ts)} ${expBtn('cierre',cierre.id,'Ver expediente del cierre')}</li>`:`<li>Turno todavía abierto: sin cierre</li>`)+
  trs.map(t=>`<li>Traspaso del mismo turno: ${esc(t.num||'')} ${money(t.amount)} ${expBtn('traspaso',t.id,'Ver expediente')}</li>`).join('')+
  `<li class="mut">Pedido / remito / presupuesto: no aplica (módulo no activado)</li>`;
 return [
  expSec('1 · Encabezado, ítems, pagos y movimientos',saleDetailHTML(s,{noTl:true})),
  expSec('2 · Impacto contable',expNA('Contabilidad no activada (módulo F7). El impacto de gestión que sí existe —caja, stock, cuenta corriente'+(ownerMode()?'':' y rubro')+'— está en «Movimientos que generó la operación».')),
  expSec('3 · Auditoría de la operación',expTL(expAuditFor(r),lvl)+(lvl==='full'?'<div id="exp-srv" class="sm mut"></div>':'')),
  expSec('4 · Documentos vinculados',`<ul class="sm">${lh}</ul>`),
 ];}
function expTrasBlocks(r,lvl){const t=r.t;const st=xferState(t),ev=xfEvs(t),b=xfBalance(t);
 const rf=[t.fromRef,t.toRef].filter(Boolean);const cl2=S.closures.filter(c=>rf.includes(c.id));
 return [
  expSec('1 · Comprobante',`<div class="card">${xfVoucherHTML(t,false)}</div><p class="sm">Estado: <b>${esc(XF_ST[st]||st)}</b></p>`),
  expSec('2 · Recorrido y balance',`<ul class="sm"><li>${fmtDT(t.ts)} · emitido por ${esc(t.user)}${t.auth?', autoriza '+esc(t.auth.name||''):''}</li>${ev.map(e=>`<li>${fmtDT(e.ts)} · ${esc(String(e.kind).replace(/_/g,' '))}${e.kind!=='anotado'?' · '+money(e.amt):''} · ${esc(e.user)}${e.nota?' · '+esc(e.nota):''}</li>`).join('')}</ul>
   <p class="sm mut">Enviado ${money(b.sent)} = recibido ${money(b.received)} + en tránsito ${money(b.transit)} + diferencia ${money(b.diff)} + devuelto ${money(b.returned)} ${b.ok?'✔':'<b class="neg">✘ no cierra</b>'}</p>`),
  expSec('3 · Impacto contable',expNA('Contabilidad no activada. Es un movimiento interno: sale del efectivo de una caja y entra en el de la otra; no suma como venta, ingreso ni egreso.')),
  expSec('4 · Auditoría',expTL(expAuditFor(r),lvl)+(lvl==='full'?'<div id="exp-srv" class="sm mut"></div>':'')),
  expSec('5 · Documentos vinculados',`<ul class="sm">${t.rev?`<li>Reversa del traspaso ${esc(((S.transfers||[]).find(x=>x.id===t.rev)||{}).num||'')}</li>`:''}${(S.transfers||[]).filter(x=>x.rev===t.id).map(x=>`<li>Revertido por ${esc(x.num||'')} ${expBtn('traspaso',x.id,'Ver expediente')}</li>`).join('')}${cl2.map(c=>`<li>Cierre de caja vinculado: ${fmtDT(c.ts)} ${expBtn('cierre',c.id,'Ver expediente')}</li>`).join('')||'<li class="mut">Sin cierre vinculado (las cajas estaban abiertas)</li>'}</ul>`),
 ];}
function expCierreBlocks(r,lvl){const c=r.c;const ok=verifyClosure(c);const ss=S.sessions.find(x=>x.id===c.sessId)||{};
 const nsale=S.sales.filter(s=>s.sessId===c.sessId).length;
 return [
  expSec('1 · Encabezado',`<div class="grid g3 sdgrid"><div><span class="sm mut">Cierre</span><br><b>${fmtDT(c.ts)}</b></div><div><span class="sm mut">Caja</span><br><b>${esc(String(c.caja))}${c.regName?' · '+esc(c.regName):''}</b></div><div><span class="sm mut">Cerró</span><br><b>${esc(c.user)}</b></div><div><span class="sm mut">Apertura</span><br><b>${money(c.opening||0)}${ss.openedBy?' · '+esc(ss.openedBy):''}</b></div><div><span class="sm mut">Operaciones del turno</span><br><b>${nsale}</b></div><div><span class="sm mut">Sello</span><br><b>${esc(String(c.hash).slice(0,16))}…</b></div></div>
   <div class="${ok?'okbox':'errbox'} sm" role="status">Integridad del cierre: ${ok?'verificada (el sello coincide)':'ALTERADO: el sello no coincide'}</div><div class="rep">${esc(c.text)}</div>`),
  expSec(ownerMode()?'2 · Movimientos':'2 · Movimientos (con rubro)',`<div class="tw"><table class="cjtbl"><tbody>${(c.data.movs||[]).map(m=>`<tr><td data-l="Hora">${hm(m.ts)}</td><td data-l="Tipo">${esc(m.type)}</td>${ownerMode()?'':`<td data-l="Rubro">${esc(m.rubro)}</td>`}<td data-l="Concepto">${esc(m.concept)}</td><td class="r" data-l="Importe">${money(m.amount)}</td></tr>`).join('')||'<tr><td class="mut">Sin movimientos.</td></tr>'}</tbody></table></div>${typeof xferAfterHTML==='function'?xferAfterHTML(c):''}`),
  expSec('3 · Impacto contable',expNA('Contabilidad no activada. El cierre es una foto de gestión sellada; las notas de revisión se agregan aparte.')),
  expSec('4 · Auditoría',expTL(expAuditFor(r),lvl)+`<h4>Notas de revisión (sólo se agregan)</h4>${(c.notes||[]).map(n=>`<p class="sm">${fmtDT(n.ts)} · ${esc(n.user)}: ${esc(n.text)}</p>`).join('')||expNA('Sin notas.')}${lvl==='full'?'<div id="exp-srv" class="sm mut"></div>':''}`),
  expSec('5 · Documentos vinculados',`<p class="sm"><button type="button" class="btn sm" data-act="clsales" data-id="${esc(c.id)}">Ver ventas del turno</button> <button type="button" class="btn sm" data-act="clview" data-id="${esc(c.id)}">Ver ficha del cierre</button></p>`),
 ];}
function expMovBlocks(r,lvl){const m=r.m;const ss=S.sessions.find(x=>x.id===m.sessId)||{};const cierre=S.closures.find(c=>c.sessId===m.sessId);
 return [
  expSec('1 · Movimiento',`<div class="grid g3 sdgrid"><div><span class="sm mut">Fecha y hora</span><br><b>${fmtDT(m.ts)}</b></div><div><span class="sm mut">Tipo</span><br><b>${m.type==='ingreso'?'Ingreso':'Egreso'} de efectivo</b></div><div><span class="sm mut">Importe</span><br><b>${m.type==='ingreso'?'':'- '}${money(m.amount)}</b></div>${ownerMode()?'':`<div><span class="sm mut">Rubro</span><br><b>${esc(m.rubroName||rubName(m.rubro))}</b></div>`}<div><span class="sm mut">Concepto</span><br><b>${esc(m.concept)}</b></div><div><span class="sm mut">Usuario</span><br><b>${esc(m.user)}</b></div><div><span class="sm mut">Caja / turno</span><br><b>${esc(String(ss.caja||''))}${ss.regName?' · '+esc(ss.regName):''}${ss.openedAt?' · abierto '+fmtDT(ss.openedAt):''}</b></div></div>`),
  expSec('2 · Impacto contable',expNA((typeof rubAdj==='function'&&rubAdj(m)?'Contabilidad no activada. Impacto de gestión: '+(m.type==='ingreso'?'suma a':'resta de')+' lo vendido por el rubro «'+(m.rubroName||rubName(m.rubro))+'»; no mueve el efectivo del cajón ni cambia el arqueo.':'Contabilidad no activada. Impacto de gestión: '+(m.type==='ingreso'?'suma':'resta')+' efectivo en la caja del turno'+(ownerMode()?' (dinero del negocio).':', imputado al rubro «'+(m.rubroName||rubName(m.rubro))+'».')))),
  expSec('3 · Auditoría',expTL(expAuditFor(r),lvl)+(lvl==='full'?'<div id="exp-srv" class="sm mut"></div>':'')),
  expSec('4 · Documentos vinculados',`<ul class="sm">${cierre?`<li>Cierre de caja que lo incluye: ${fmtDT(cierre.ts)} ${expBtn('cierre',cierre.id,'Ver expediente')}</li>`:'<li>Turno todavía abierto: sin cierre</li>'}</ul>`),
 ];}
function expHTML(tipo,r,lvl){
 const bl=r.k==='venta'?expVentaBlocks(r,lvl):r.k==='traspaso'?expTrasBlocks(r,lvl):r.k==='cierre'?expCierreBlocks(r,lvl):expMovBlocks(r,lvl);
 return `${lvl==='own'?'<p class="sm mut">Vista de cajero: sólo tus propias operaciones, sin datos de otros usuarios ni de equipos.</p>':''}${bl.join('')}
 <div class="row noprint" style="margin-top:.8rem"><button type="button" class="btn" data-act="expPrint">Imprimir (A4)</button><button type="button" class="btn" data-act="expCsv" data-t="${esc(tipo)}" data-id="${esc(r.id)}">CSV</button>
 <button type="button" class="btn" data-act="expLink" data-t="${esc(tipo)}" data-id="${esc(r.id)}">Copiar enlace interno</button>${lvl==='full'?`<button type="button" class="btn" data-act="expVerify">Verificar integridad</button>`:''}</div><div id="exp-ver" aria-live="polite"></div>`;}
function expLabel(r){return r.k==='venta'?r.s.n:r.k==='traspaso'?(r.t.num||r.t.id):r.k==='cierre'?fmtDT(r.c.ts):(r.m.concept||'').slice(0,40);}

/* ---------- abrir ---------- */
function expOpen(tipo,id){
 const r=expRec(tipo,id);if(!r){toast('La operación ya no está disponible.',1);return null;}
 const lvl=expLevel(r);if(!lvl){toast('No tenés permiso para ver este expediente.',1);return null;}
 audit('EXPEDIENTE_VISTO',(EXP_T[tipo]||tipo)+' '+expLabel(r)+' · acceso '+(lvl==='full'?'completo':'propio'),{ent:r.k,eid:r.id});
 const w=modal('Expediente · '+(EXP_T[tipo]||tipo)+' '+expLabel(r),`<div id="exp-body">${expHTML(tipo,r,lvl)}</div>`,{ok:false,cancelText:'Cerrar',wide:true});
 w.querySelector('.dlg').classList.add('saledet');w.querySelector('.dlg').dataset.exp=tipo+'/'+r.id;
 if(lvl==='full')expServer(w,r);
 return w;}
A.expOpen=el=>expOpen(el.dataset.t,el.dataset.id);
A.expPrint=()=>{document.body.classList.add('pm');try{window.print();}finally{setTimeout(()=>document.body.classList.remove('pm'),500);}};
A.expLink=el=>copyText(location.href.split('#')[0]+'#expediente/'+el.dataset.t+'/'+encodeURIComponent(el.dataset.id));

/* ---------- eventos del servidor (con IP, sólo administrador) ---------- */
async function expServer(w,r){
 const box=w.querySelector('#exp-srv');if(!box)return;
 if(typeof CLOUD==='undefined'||!CLOUD.on||!cl.ready||!cl.online){box.textContent='Eventos del servidor: se muestran con la nube conectada.';return;}
 const key=r.k==='venta'?r.s.n:r.k==='traspaso'?r.t.num:r.k==='cierre'?r.c.id:r.m.id;if(!key)return;
 try{const q='auditoria_eventos?select=seq,ts_servidor,usuario,rol,action,detail,device_id,ip&tenant_id=eq.'+cl.comercio.id+'&detail=ilike.*'+encodeURIComponent(String(key).replace(/[*%,()]/g,''))+'*&order=seq&limit=100';
  const rows=await sel(q);const adm=can('config');
  box.innerHTML=`<h4>Eventos registrados por el servidor (${rows.length})</h4>${rows.length?`<div class="tw"><table class="cjtbl"><thead><tr><th>N.º</th><th>Hora del servidor</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Equipo</th>${adm?'<th>IP</th>':''}</tr></thead><tbody>${rows.map(x=>`<tr><td data-l="N.º">${x.seq}</td><td data-l="Hora">${esc(fmtDT(Date.parse(x.ts_servidor)))}</td><td data-l="Usuario">${esc(x.usuario||'')}</td><td data-l="Rol">${esc(x.rol||'')}</td><td data-l="Acción">${esc(x.action)}</td><td data-l="Equipo">${esc(x.device_id||'')}</td>${adm?`<td data-l="IP">${esc(x.ip||'—')}</td>`:''}</tr>`).join('')}</tbody></table></div>`:'<p class="sm mut">El servidor todavía no tiene eventos de esta operación.</p>'}<p class="sm mut">La IP la agrega sólo el servidor y la ve únicamente el administrador. Plazo de conservación: [VERIFICAR con asesor legal].</p>`;
 }catch(e){box.textContent='Eventos del servidor: no se pudieron consultar ahora.';}}

/* ---------- verificar integridad ---------- */
A.expVerify=async()=>{const box=document.getElementById('exp-ver');if(!box)return;
 box.innerHTML='<p class="sm mut">Verificando…</p>';
 const bad=verifyAudit();let h=bad?`<div class="errbox" role="alert"><b>La cadena de auditoría de este equipo está ALTERADA</b> a partir del evento N.º ${bad}.</div>`:`<div class="okbox" role="status">Cadena de auditoría de este equipo: íntegra (${S.audit.length} eventos encadenados).</div>`;
 if(typeof CLOUD!=='undefined'&&CLOUD.on&&cl.ready&&cl.online&&can('audit_read')){
  try{const j=await rpc('rave_verificar_cadena',{p_comercio:cl.comercio.id,p_tabla:'auditoria_eventos'});
   h+=j&&j.ok?`<div class="okbox" role="status">Cadena del servidor: íntegra (${j.total} eventos).</div>`:`<div class="errbox" role="alert"><b>Cadena del servidor ROTA</b> en el evento ${esc(String(j&&j.roto))}: ${esc((j&&j.motivo)||'')}</div>`;}
  catch(e){h+='<p class="sm mut">No se pudo consultar la cadena del servidor ahora.</p>';}}
 else h+='<p class="sm mut">La cadena del servidor se verifica con la nube conectada.</p>';
 box.innerHTML=h;audit('AUDITORIA_VERIFICADA',bad?'cadena local alterada en el evento '+bad:'cadena local íntegra · '+S.audit.length+' eventos');};

/* ---------- CSV (una fila por dato; fórmulas neutralizadas; costos sólo con view_cost) ---------- */
function expRows(tipo,r,lvl){const R=[];const add=(s,c,v)=>R.push([s,c,v==null?'':String(v)]);
 if(r.k==='venta'){const s=r.s;add('Encabezado','N.º',s.n);add('Encabezado','Fecha y hora',fmtDT(s.ts));add('Encabezado','Canal',saleChan(s));add('Encabezado','Vendedor / cajero',saleSellerTxt(s));add('Encabezado','Cliente',s.custName||'Consumidor final');add('Encabezado','Documento',saleDocTxt(s));add('Encabezado','Estado',saleStateTxt(s));add('Encabezado','Total',money(s.total));
  (s.items||[]).forEach((i,n)=>{add('Ítem '+(n+1),'Descripción',i.name);add('Ítem '+(n+1),'Cantidad',numAR(i.qty,3));add('Ítem '+(n+1),'Precio de lista',money(i.list||i.price));add('Ítem '+(n+1),'Precio aplicado',money(i.price));add('Ítem '+(n+1),'Regla de precio',saleRuleTxt(i));add('Ítem '+(n+1),'Descuento',money(i.disc||0));if(can('view_cost'))add('Ítem '+(n+1),'Costo unitario',money(i.cost||0));});
  salePays(s).forEach((p,n)=>{add('Pago '+(n+1),'Medio',MET[p.m]||p.m);add('Pago '+(n+1),'Importe',money(p.a));
   if(typeof pdVers==='function')pdVers(s.id,n).forEach(d=>{add('Pago '+(n+1)+' · detalle v'+d.ver,'Estado',d.st);['ent','dest','nro','brand','last4','auth','cuotas','cupon','prov','txid'].forEach(k=>{if(d[k]!=null&&d[k]!=='')add('Pago '+(n+1)+' · detalle v'+d.ver,k,d[k]);});if(d.ordMask)add('Pago '+(n+1)+' · detalle v'+d.ver,'ordenante',d.ordMask);});});
  saleMovs(s).forEach(m=>add('Movimiento',m.g+' · '+m.t,m.unit?numAR(m.a,3)+' u':money(m.a)));}
 else if(r.k==='traspaso'){const t=r.t;add('Traspaso','N.º',t.num);add('Traspaso','Fecha y hora',fmtDT(t.ts));add('Traspaso','Desde',t.fromName||t.from);add('Traspaso','Hacia',t.toName||t.to);add('Traspaso','Importe',money(t.amount));if(!ownerMode())add('Traspaso','Rubro',t.rubroName);add('Traspaso','Motivo',t.motivo);add('Traspaso','Emitió',t.user);add('Traspaso','Estado',XF_ST[xferState(t)]||xferState(t));xfEvs(t).forEach(e=>add('Evento',e.kind,fmtDT(e.ts)+' · '+e.user+(e.kind!=='anotado'?' · '+money(e.amt):'')));}
 else if(r.k==='cierre'){const c=r.c;add('Cierre','Fecha y hora',fmtDT(c.ts));add('Cierre','Caja',c.caja);add('Cierre','Cerró',c.user);add('Cierre','Apertura',money(c.opening||0));add('Cierre','Sello',c.hash);(c.data.movs||[]).forEach(m=>add('Movimiento',m.type+(ownerMode()?'':' · '+m.rubro)+' · '+m.concept,money(m.amount)));}
 else{const m=r.m;add('Movimiento','Fecha y hora',fmtDT(m.ts));add('Movimiento','Tipo',m.type);if(!ownerMode())add('Movimiento','Rubro',m.rubroName);add('Movimiento','Concepto',m.concept);add('Movimiento','Importe',money(m.amount));add('Movimiento','Usuario',m.user);}
 expAuditFor(r).filter(e=>lvl==='full'||e.user===(user&&user.name)).forEach(e=>add('Auditoría',fmtDT(e.ts)+' · '+e.user+(lvl==='full'&&e.role?' ('+e.role+')':'')+' · '+e.action,e.detail+(e.old!=null?' | antes: '+e.old+' → ahora: '+e.nw:'')));
 return R;}
A.expCsv=el=>{const r=expRec(el.dataset.t,el.dataset.id);const lvl=expLevel(r);if(!lvl)return toast('Sin permiso',1);
 audit('EXPEDIENTE_EXPORTADO',(EXP_T[el.dataset.t]||el.dataset.t)+' '+expLabel(r),{ent:r.k,eid:r.id});
 download('expediente-'+el.dataset.t+'-'+String(expLabel(r)).replace(/[^\w.-]+/g,'_')+'.csv',toCSV(['Sección','Campo','Valor'],expRows(el.dataset.t,r,lvl)),'text/csv;charset=utf-8');};

/* ---------- enlace interno #expediente/<tipo>/<id> ---------- */
let expPendingHash='';
function expRoute(h){
 const m=/^#expediente\/([a-z]+)\/(.+)$/.exec(h);if(!m){location.hash='#panel/inicio';return;}
 if(!user){expPendingHash=h;location.hash='#acceso';return;}
 const back=curScreen&&SCREENS[curScreen]?'#panel/'+curScreen:'#panel/inicio';
 history.replaceState(null,'',back);showPanel(curScreen&&SCREENS[curScreen]?curScreen:'inicio');
 setTimeout(()=>expOpen(m[1],decodeURIComponent(m[2])),60);}
function expPending(){if(expPendingHash&&user){const h=expPendingHash;expPendingHash='';setTimeout(()=>expRoute(h),200);}}
