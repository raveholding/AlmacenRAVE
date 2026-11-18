/* =====================================================================
   p24-licencia.js · V27.18 · Licencia, avisos de vencimiento, consola VB y copias de seguridad
   · Cliente (rol admin): aviso 10, 3 y 1 día antes del vencimiento de la prueba o del plan,
     con «Pagar o renovar» por WhatsApp y «Ya pagué». Sólo AVISA: nunca bloquea el sistema.
   · Sistemas propios de Vincular Business (Almacén RAVE): sin vencimientos ni avisos.
   · Equipo VB (vb_es_staff): pantalla «Consola VB» para dar de alta, extender, suspender
     (con respaldo previo, sin borrar nada) y reactivar; avisos por WhatsApp listos para enviar.
   · Copias de seguridad: el servidor hace una por día (03:15) y guarda 7 diarias + 4 semanales.
     El admin del comercio y el equipo VB las ven, las descargan y pueden pedir una al momento.
   Requiere supabase/35-licencias-respaldos.sql (vb_version ≥ 35).
   ===================================================================== */
const VB_WA='5493874484132';
const VBL={lic:null,staff:false,list:null,t:0,ver:0,filtro:'todos',resp:{}};
const VBL_PLAN={esencial:'Esencial',profesional:'Profesional',mayorista:'Mayorista',total:'Total',medida:'A medida'};
const vblOn=()=>!!(CLOUD.on&&cl.ses&&cl.comercio&&cl.comercio.id);
const vblF=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(d||''));return m?`${m[3]}/${m[2]}/${m[1]}`:'';};
const vblFH=d=>{try{const x=new Date(d);return isNaN(x)?'':x.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'})+' '+x.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});}catch(e){return'';}};
const vblMB=b=>b>=1048576?(b/1048576).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round(b/1024))+' KB';
const vblCom=()=>(cl.comercio&&cl.comercio.nombre)||(S.tenant&&S.tenant.name)||'tu comercio';

async function vblCargar(force){
 if(!vblOn())return;if(!force&&Date.now()-VBL.t<20*60000)return;VBL.t=Date.now();
 const antes=JSON.stringify([VBL.lic,VBL.staff,VBL.ver]);
 try{VBL.ver=+(await rpc('vb_version'))||0;}catch(e){return;}
 if(VBL.ver<35)return;
 try{VBL.lic=await rpc('mi_licencia',{p_comercio:cl.comercio.id});}catch(e){}
 try{VBL.staff=(await rpc('vb_es_staff'))===true;}catch(e){VBL.staff=false;}
 if(JSON.stringify([VBL.lic,VBL.staff,VBL.ver])!==antes)rerender();
}

/* ---------- etapa de aviso (cliente y consola usan la misma regla) ---------- */
function vblEtapa(L){
 if(!L||L.err||L.propio)return null;
 if(L.estado==='suspendida')return{k:'susp',nivel:'r'};
 if(L.estado==='vencida')return{k:'vencida',nivel:'r'};
 if(L.estado==='gracia')return{k:'gracia',nivel:'r'};
 const d=L.dias;if(d==null||d>10)return null;
 return{k:d<=1?'d1':d<=3?'d3':'d10',nivel:d<=3?'r':'a'};
}
function vblTexto(L){
 const e=vblEtapa(L);if(!e)return null;const qp=L.estado==='prueba'?'tu prueba gratis':'tu plan';const f=vblF(L.vence),d=L.dias;
 if(e.k==='susp')return{t:'El servicio está suspendido',s:'Tus datos están guardados y respaldados. Regularizá el pago y lo reactivamos en el momento.'};
 if(e.k==='vencida')return{t:`${L.estado_cargado==='prueba'?'Tu prueba gratis terminó':'Tu plan venció'} el ${f}`,s:'El sistema sigue funcionando y tus datos están respaldados. Elegí tu plan para regularizar.'};
 if(e.k==='gracia')return{t:`${L.estado_cargado==='prueba'?'Tu prueba gratis terminó':'Tu plan venció'} el ${f}`,s:`Tenés unos días de gracia para pagar sin cortes. Avisanos y lo dejamos al día.`};
 if(e.k==='d1')return{t:d<=0?`Último aviso: ${qp} termina hoy`:`Último aviso: ${qp} termina mañana (${f})`,s:'Pagá o renová ahora para seguir vendiendo sin cortes. Tus datos y tu configuración quedan como están.'};
 if(e.k==='d3')return{t:`Quedan ${d} días de ${qp}`,s:`Termina el ${f}. Elegí tu plan y seguís igual, con todo lo que ya cargaste.`};
 return{t:`${qp[0].toUpperCase()+qp.slice(1)} termina en ${d} días`,s:`Vence el ${f}. Elegí tu plan para seguir vendiendo más con el Sistema VB, sin cortes.`};
}
function vblBanner(){
 const L=VBL.lic;if(!vblOn()||cl.rol!=='admin')return'';const e=vblEtapa(L),x=vblTexto(L);if(!e||!x)return'';
 const k='vbl-x-'+e.k+'-'+new Date().toISOString().slice(0,10);try{if(localStorage.getItem(k))return'';}catch(_){}
 const pagado=L.pago_informado?`<p class="sm" style="margin:.35rem 0 0">Recibimos tu aviso de pago del ${vblFH(L.pago_informado)}. Lo confirmamos en breve.</p>`:'';
 return`<div class="card vbl-ban vbl-${e.nivel}" role="status"><div style="flex:1;min-width:0"><b>${esc(x.t)}</b><p class="sm" style="margin:.2rem 0 0">${esc(x.s)}</p>${pagado}</div>
 <div class="row" style="gap:.4rem;flex-wrap:wrap"><button class="btn gold sm" data-act="vblPagar">Pagar o renovar</button><button class="btn ghost sm" data-act="vblCerrar" data-k="${k}" aria-label="Ocultar el aviso hasta mañana">Ocultar hoy</button></div></div>`;
}
A.vblCerrar=el=>{try{localStorage.setItem(el.dataset.k,'1');}catch(_){}el.closest('.vbl-ban').remove();};
A.vblPagar=()=>{
 const L=VBL.lic||{};const plan=VBL_PLAN[L.plan]||'Esencial';
 const msg=`Hola Vincular Business! Quiero ${L.estado==='prueba'||L.estado_cargado==='prueba'?'elegir un plan':'renovar el plan '+plan} para ${vblCom()}${L.vence?' (vence el '+vblF(L.vence)+')':''}. ¿Me pasan los datos de pago?`;
 modal('Pagar o renovar',`<p>Plan actual: <b>${esc(plan)}</b>${L.vence?` · vence el <b>${vblF(L.vence)}</b>`:''}.</p>
  <ol class="sm" style="padding-left:1.1rem;margin:.6rem 0">
  <li>Escribinos por WhatsApp y te pasamos el link de pago o los datos para transferir.</li>
  <li>Cuando pagues, tocá <b>Ya pagué</b> y mandanos el comprobante por el mismo chat.</li></ol>
  <div class="row" style="gap:.5rem;flex-wrap:wrap"><a class="btn gold" href="${waLink(msg,VB_WA)}" target="_blank" rel="noopener">Pagar por WhatsApp</a>
  <button class="btn" data-act="vblPague">Ya pagué: enviar comprobante</button></div>
  <p class="sm mut" style="margin-top:.7rem">Mientras tanto el sistema sigue funcionando normalmente y tus datos se respaldan todos los días.</p>`,{ok:false,cancelText:'Cerrar'});
};
A.vblPague=async()=>{
 const L=VBL.lic||{};const w=window.open(waLink(`Hola Vincular Business! Ya pagué el plan de ${vblCom()}. Les envío el comprobante.`,VB_WA),'_blank');
 try{await rpc('mi_licencia_pague',{p_comercio:cl.comercio.id});VBL.lic=Object.assign({},L,{pago_informado:new Date().toISOString()});toast('Listo: avisamos a Vincular Business. Adjuntá el comprobante en el chat.');}
 catch(e){toast('No se pudo registrar el aviso, pero podés mandar el comprobante por WhatsApp.',true);}
 if(!w)location.href=waLink(`Hola Vincular Business! Ya pagué el plan de ${vblCom()}. Les envío el comprobante.`,VB_WA);
 document.querySelectorAll('.ov').forEach(o=>o.remove());rerender();
};

/* El aviso se dibuja arriba de cualquier pantalla (sin tocar las pantallas existentes). */
(function(){const _sp=showPanel;showPanel=function(id){_sp.apply(this,arguments);
 try{const h=vblBanner(),v=$('#view');if(h&&v&&!v.querySelector('.vbl-ban'))v.insertAdjacentHTML('afterbegin',h);}catch(e){}
 vblCargar(false);};})();

/* ---------- Consola Vincular Business (solo equipo VB) ---------- */
function vblMsgCliente(c){
 const L=c.licencia||{};const e=vblEtapa(L);const n=(L.contacto_nombre||'').split(' ')[0];const hola=n?`Hola ${n}!`:'Hola!';
 const qp=(L.estado_cargado||L.estado)==='prueba'?'tu prueba gratis':'tu plan';const f=vblF(L.vence),com=c.nombre;
 if(!e)return{k:null,t:`${hola} Te escribimos de Vincular Business. ¿Cómo vienen las ventas con el sistema en ${com}? Cualquier cosa que necesites, estamos acá.`};
 if(e.k==='d10')return{k:'d10',t:`${hola} Te escribimos de Vincular Business. ${qp[0].toUpperCase()+qp.slice(1)} del Sistema VB en ${com} termina en ${L.dias} días, el ${f}. Para seguir vendiendo sin cortes, respondé este mensaje y te ayudamos a elegir el plan que más te conviene.`};
 if(e.k==='d3')return{k:'d3',t:`${hola} Quedan ${L.dias} días de ${qp} en ${com} (termina el ${f}). Respondé este mensaje y te pasamos el link de pago. Todo lo que cargaste queda igual.`};
 if(e.k==='d1')return{k:'d1',t:`${hola} Último aviso: ${L.dias<=0?'hoy':'mañana '+f} termina ${qp} en ${com}. Respondé y te mandamos el link de pago para seguir sin cortes. Ante cualquier duda, estamos acá.`};
 return{k:'vencida',t:`${hola} ${qp==='tu prueba gratis'?'Tu prueba gratis':'Tu plan'} de ${com} venció el ${f}. Tus datos están guardados y respaldados. Respondé este mensaje para regularizar y seguimos.`};
}
function vblChip(c){
 if(c.propio)return'<span class="chip ok">Sistema propio · sin vencimiento</span>';
 const L=c.licencia;if(!L)return'<span class="chip">Sin licencia</span>';
 const map={prueba:['Prueba','a'],activa:['Activa','ok'],gracia:['En gracia','r'],vencida:['Vencida','r'],suspendida:['Suspendida','r']};const m=map[L.estado]||[L.estado,''];
 return`<span class="chip vbl-c-${m[1]}">${m[0]}</span>`;
}
function vblPasa(c){const f=VBL.filtro,L=c.licencia;if(f==='todos')return true;if(!L||c.propio)return false;
 if(f==='vencer')return(L.estado==='prueba'||L.estado==='activa')&&L.dias!=null&&L.dias<=10;
 if(f==='vencidos')return L.estado==='vencida'||L.estado==='gracia';if(f==='pago')return!!L.pago_informado;if(f==='susp')return L.estado==='suspendida';return true;}
function vblConsola(){
 if(!VBL.list)return`<div class="card"><p>Cargando comercios…</p></div>`;
 if(VBL.list.err)return`<div class="card"><p>${esc(VBL.list.err)}</p></div>`;
 const L=VBL.list,cnt=k=>L.filter(c=>{const o=VBL.filtro;VBL.filtro=k;const r=vblPasa(c);VBL.filtro=o;return r;}).length;
 const chips=[['todos','Todos'],['vencer','Por vencer'],['vencidos','Vencidos'],['pago','Avisaron pago'],['susp','Suspendidos']]
  .map(([k,t])=>`<button class="btn sm ${VBL.filtro===k?'gold':'ghost'}" data-act="vblFiltro" data-f="${k}">${t} <b>${cnt(k)}</b></button>`).join('');
 const cards=L.filter(vblPasa).map(c=>{const Li=c.licencia||{};const r=c.respaldo;
  const vence=c.propio?'':Li.vence?`Vence el <b>${vblF(Li.vence)}</b> (${Li.dias<0?'hace '+(-Li.dias)+' días':Li.dias===0?'hoy':'en '+Li.dias+' días'})`:'Sin fecha de vencimiento';
  const av=Object.keys(Li.avisos||{});const m=vblMsgCliente(c);
  const btns=c.propio?'':`${Li.contacto_whatsapp?`<button class="btn sm gold" data-act="vblAvisar" data-id="${c.id}">Avisar por WhatsApp</button>`:''}
   <button class="btn sm" data-act="vblAlta" data-id="${c.id}">Dar de alta</button>
   <button class="btn sm" data-act="vblExt" data-id="${c.id}">Extender</button>
   ${Li.estado==='suspendida'?`<button class="btn sm" data-act="vblAcc" data-a="reactivar" data-id="${c.id}">Reactivar</button>`:`<button class="btn sm ghost" data-act="vblBaja" data-id="${c.id}">Dar de baja</button>`}
   <button class="btn sm ghost" data-act="vblContacto" data-id="${c.id}">Contacto</button>`;
  return`<div class="card vbl-com"><div class="row" style="justify-content:space-between;gap:.5rem;flex-wrap:wrap"><b>${esc(c.nombre)}</b>${vblChip(c)}</div>
  <p class="sm" style="margin:.35rem 0">${c.propio?'Sistema de Vincular Business. No vence ni recibe avisos.':`Plan ${esc(VBL_PLAN[Li.plan]||'—')} · ${vence}`}</p>
  <p class="sm mut" style="margin:.2rem 0">${[c.propio?'':(Li.contacto_nombre||Li.contacto_whatsapp)?`Contacto: ${esc(Li.contacto_nombre||'')}${Li.contacto_whatsapp?' · +'+esc(Li.contacto_whatsapp):''}`:'Sin contacto cargado',c.ultimo_uso?'Último uso '+vblFH(c.ultimo_uso):''].filter(Boolean).join(' · ')}</p>
  ${Li.pago_informado?`<p class="sm vbl-pago">Avisó que pagó el ${vblFH(Li.pago_informado)}: revisá el comprobante y dalo de alta.</p>`:''}
  ${!c.propio&&m.k?`<p class="sm mut" style="margin:.2rem 0">Aviso sugerido: <b>${{d10:'10 días',d3:'3 días',d1:'último aviso',vencida:'vencido'}[m.k]}</b>${av.includes(m.k)?' · ya enviado':''}</p>`:''}
  <p class="sm mut" style="margin:.2rem 0">Copia de seguridad: ${r?`${vblFH(r.creado)} · ${(r.filas||0).toLocaleString('es-AR')} registros · ${c.respaldos} ${c.respaldos===1?'guardada':'guardadas'}`:'todavía ninguna (se hace esta noche)'}</p>
  <div class="row" style="gap:.4rem;flex-wrap:wrap;margin-top:.5rem">${btns}<button class="btn sm ghost" data-act="vblResp" data-id="${c.id}" data-n="${esc(c.nombre)}">Copias de seguridad</button></div></div>`;}).join('')
  ||'<div class="card"><p class="mut">No hay comercios en este filtro.</p></div>';
 return`<div class="card"><p class="sm mut" style="margin:0 0 .5rem">Alta y baja de los sistemas de clientes. La baja nunca borra datos: primero se hace una copia de seguridad y el cliente sólo ve un aviso.</p>
 <div class="row" style="gap:.35rem;flex-wrap:wrap">${chips}<button class="btn sm ghost" data-act="vblRecargar">Actualizar</button></div></div>${cards}`;
}
async function vblLista(){try{VBL.list=await rpc('vb_comercios_listar');}catch(e){VBL.list={err:'No se pudo cargar la lista: '+(e.message||'sin conexión')};}if(curScreen==='vbconsola')rerender();}
const vblC=id=>(Array.isArray(VBL.list)?VBL.list:[]).find(c=>c.id===id);
A.vblFiltro=el=>{VBL.filtro=el.dataset.f;rerender();};
A.vblRecargar=()=>{VBL.list=null;rerender();vblLista();};
async function vblAccion(id,accion,extra){
 const r=await rpc('vb_licencia_accion',Object.assign({p_comercio:id,p_accion:accion},extra||{}));
 if(r&&r.err)throw new Error(r.err);await vblLista();return r;
}
A.vblAlta=el=>{const c=vblC(el.dataset.id);if(!c)return;const L=c.licencia||{};
 modal('Dar de alta · '+c.nombre,`<label for="vbl-pl">Plan</label><select id="vbl-pl">${Object.entries(VBL_PLAN).map(([k,t])=>`<option value="${k}" ${k===(L.plan||'esencial')?'selected':''}>${t}</option>`).join('')}</select>
  <label for="vbl-d">Período pagado</label><select id="vbl-d"><option value="30">1 mes</option><option value="90">3 meses</option><option value="180">6 meses</option><option value="365">1 año</option></select>
  <label for="vbl-n">Nota (opcional)</label><input id="vbl-n" maxlength="200" placeholder="Ej.: pagó por transferencia el 18/11">
  <p class="sm mut">Si todavía no venció, el período se suma al vencimiento actual.</p>`,{okText:'Dar de alta',onOk:async w=>{
  try{await vblAccion(c.id,'activar',{p_dias:+w.querySelector('#vbl-d').value,p_plan:w.querySelector('#vbl-pl').value,p_nota:w.querySelector('#vbl-n').value.trim()||null});toast('Alta registrada para '+c.nombre);}
  catch(e){w._err(e.message||'No se pudo');return false;}}});};
A.vblExt=el=>{const c=vblC(el.dataset.id);if(!c)return;
 modal('Extender · '+c.nombre,`<label for="vbl-d">Días a sumar</label><select id="vbl-d"><option value="7">7 días</option><option value="15">15 días</option><option value="30">30 días</option></select>
  <p class="sm mut">No cambia el estado (una prueba sigue siendo prueba).</p>`,{okText:'Extender',onOk:async w=>{
  try{await vblAccion(c.id,'extender',{p_dias:+w.querySelector('#vbl-d').value});toast('Vencimiento extendido');}catch(e){w._err(e.message||'No se pudo');return false;}}});};
A.vblBaja=el=>{const c=vblC(el.dataset.id);if(!c)return;
 modal('Dar de baja · '+c.nombre,`<p>Antes de la baja se hace una <b>copia de seguridad completa</b>. No se borra ningún dato.</p>
  <p class="sm">El cliente ve un aviso de servicio suspendido y puede seguir consultando su sistema. Para volver, usá <b>Reactivar</b> o <b>Dar de alta</b>.</p>
  <label for="vbl-n">Motivo</label><input id="vbl-n" maxlength="200" placeholder="Ej.: falta de pago desde el 10/11">`,{okText:'Dar de baja',onOk:async w=>{
  try{await vblAccion(c.id,'suspender',{p_nota:w.querySelector('#vbl-n').value.trim()||null});toast('Baja registrada. Copia de seguridad guardada.');}catch(e){w._err(e.message||'No se pudo');return false;}}});};
A.vblAcc=async el=>{const c=vblC(el.dataset.id);if(!c)return;try{await vblAccion(c.id,el.dataset.a);toast('Listo: '+c.nombre+' reactivado');}catch(e){toast(e.message||'No se pudo',true);}};
A.vblContacto=el=>{const c=vblC(el.dataset.id);if(!c)return;const L=c.licencia||{};
 modal('Contacto · '+c.nombre,`<label for="vbl-cn">Nombre</label><input id="vbl-cn" maxlength="80" value="${esc(L.contacto_nombre||'')}">
  <label for="vbl-cw">WhatsApp</label><input id="vbl-cw" inputmode="tel" placeholder="549 387 1234567" value="${esc(L.contacto_whatsapp||'')}">
  <p class="sm mut">Formato internacional: 549 + característica sin 0 + número sin 15.</p>`,{okText:'Guardar',onOk:async w=>{
  const n=w.querySelector('#vbl-cn').value,t=w.querySelector('#vbl-cw').value.replace(/\D/g,'');
  if(t&&!/^549\d{10}$/.test(t)){w._err('Revisá el WhatsApp: debe empezar con 549 y tener 13 números.');return false;}
  try{const r=await rpc('vb_licencia_contacto',{p_comercio:c.id,p_nombre:n,p_whatsapp:t});if(r&&r.err)throw new Error(r.err);await vblLista();toast('Contacto guardado');}catch(e){w._err(e.message||'No se pudo');return false;}}});};
A.vblAvisar=async el=>{const c=vblC(el.dataset.id);if(!c)return;const L=c.licencia||{};const m=vblMsgCliente(c);
 const w=window.open(waLink(m.t,L.contacto_whatsapp),'_blank');if(!w)location.href=waLink(m.t,L.contacto_whatsapp);
 if(m.k){try{await rpc('vb_licencia_avisado',{p_comercio:c.id,p_aviso:m.k});await vblLista();}catch(e){}}};

/* ---------- Copias de seguridad (equipo VB y admin del comercio) ---------- */
async function vblRespLista(id){try{VBL.resp[id]=await rpc('vb_respaldos_listar',{p_comercio:id});}catch(e){VBL.resp[id]={err:e.message||'sin conexión'};}}
function vblRespHTML(id){const R=VBL.resp[id];if(!R)return'<p class="mut">Cargando…</p>';if(R.err)return`<p>${esc(R.err)}</p>`;
 if(!R.length)return'<p class="mut">Todavía no hay copias. La primera se hace esta noche a las 03:15, o tocá «Hacer una copia ahora».</p>';
 const T={diario:'Diaria',semanal:'Semanal',manual:'A pedido',previo:'Antes de una baja'};
 return`<div class="vbl-rl">${R.map(r=>`<div class="row vbl-r"><div style="flex:1;min-width:0"><b>${vblFH(r.creado)}</b> <span class="chip">${T[r.tipo]||r.tipo}</span><br><span class="sm mut">${(r.filas||0).toLocaleString('es-AR')} registros · ${vblMB(r.bytes)}</span></div>
  <button class="btn sm" data-act="vblBajar" data-r="${r.id}" data-c="${id}">Descargar</button></div>`).join('')}</div>`;}
A.vblResp=async el=>{const id=el.dataset.id||(cl.comercio&&cl.comercio.id),n=el.dataset.n||vblCom();
 const w=modal('Copias de seguridad · '+n,`<p class="sm mut">Se hace una copia automática todos los días a las 03:15 y se guardan 7 diarias y 4 semanales. Los datos de clientes viajan cifrados igual que en el sistema.</p>
  <div id="vbl-rbox">${vblRespHTML(id)}</div><div class="row" style="margin-top:.6rem"><button class="btn" data-act="vblRespAhora" data-c="${id}">Hacer una copia ahora</button></div>`,{ok:false,cancelText:'Cerrar',wide:true});
 await vblRespLista(id);const b=document.getElementById('vbl-rbox');if(b)b.innerHTML=vblRespHTML(id);};
A.vblRespAhora=async el=>{const id=el.dataset.c;el.disabled=true;el.textContent='Haciendo la copia…';
 try{const r=await rpc('vb_respaldo_ahora',{p_comercio:id});if(r&&r.err)throw new Error(r.err);toast('Copia de seguridad lista ('+(r.filas||0).toLocaleString('es-AR')+' registros)');await vblRespLista(id);
  const b=document.getElementById('vbl-rbox');if(b)b.innerHTML=vblRespHTML(id);if(VBL.staff&&Array.isArray(VBL.list))vblLista();}
 catch(e){toast(e.message||'No se pudo hacer la copia',true);}el.disabled=false;el.textContent='Hacer una copia ahora';};
A.vblBajar=async el=>{el.disabled=true;const t0=el.textContent;el.textContent='Descargando…';
 try{const txt=await rpc('vb_respaldo_bajar',{p_id:+el.dataset.r});if(!txt)throw new Error('Sin acceso a esa copia');
  const nom=(vblC(el.dataset.c)||{}).nombre||vblCom();download('copia-'+nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')+'-'+new Date().toISOString().slice(0,10)+'.json',typeof txt==='string'?txt:JSON.stringify(txt),'application/json');}
 catch(e){toast(e.message||'No se pudo descargar',true);}el.disabled=false;el.textContent=t0;};

/* ---------- pantallas ---------- */
reg('vbconsola','Consola Vincular Business','shield','',vblConsola,()=>{if(!VBL.list)vblLista();},'Sistema');
SCREENS.vbconsola.show=()=>VBL.staff&&vblOn();
NAV.push(['vbconsola','Sistema']);
reg('copias','Copias de seguridad','lock','',()=>`<div class="card"><p>Tu sistema se copia solo todos los días a las 03:15. Se guardan las últimas 7 copias diarias y 4 semanales en la nube de Vincular Business.</p>
 <p class="sm mut">Podés descargar cualquier copia o hacer una en este momento (por ejemplo, antes de un cambio grande).</p>
 <button class="btn gold" data-act="vblResp">Ver y descargar copias</button></div>`,null,'Sistema');
SCREENS.copias.show=()=>vblOn()&&cl.rol==='admin'&&VBL.ver>=35;
NAV.push(['copias','Sistema']);

/* estilos propios (no tocan los del sistema) */
(function(){if(typeof document==='undefined'||document.getElementById('vbl-css'))return;const st=document.createElement('style');st.id='vbl-css';
st.textContent=`.vbl-ban{display:flex;gap:.8rem;align-items:center;flex-wrap:wrap;border-left:4px solid #ff7a1a;margin-bottom:.8rem}
@media(max-width:640px){.vbl-ban>div{flex-basis:100%}}
.vbl-ban.vbl-r{border-left-color:#e5484d;background:color-mix(in srgb,#e5484d 9%,transparent)}.vbl-ban.vbl-a{background:color-mix(in srgb,#ff7a1a 9%,transparent)}
.vbl-com .chip,.vbl-r .chip{display:inline-block;padding:.12rem .55rem;border-radius:99px;font-size:.78rem;font-weight:700;background:color-mix(in srgb,currentColor 10%,transparent)}
.vbl-com .chip.ok,.vbl-com .vbl-c-ok{color:#2f9e5b}.vbl-com .vbl-c-a{color:#d96a0b}.vbl-com .vbl-c-r{color:#e5484d}
.vbl-pago{color:#2f9e5b;font-weight:700;margin:.3rem 0}.vbl-rl{display:grid;gap:.4rem;max-height:52vh;overflow:auto}
.vbl-r{gap:.6rem;align-items:center;padding:.5rem .2rem;border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent)}`;
document.head.appendChild(st);})();
