/* ===== V27.27 · Notificaciones push: clientes que aceptaron mensajes =====
   Por qué «no figura ningún cliente»: el aviso push es un permiso de cada celular. El cliente que aceptó
   «recibir promociones» en el Club recién aparece como suscripto cuando abre la app del Club en su celular
   y toca «Activar avisos». Además, en los sistemas con licencia los avisos venían apagados y sin llave,
   así que la app del Club no ofrecía el botón.
   Este módulo:
   · en los sistemas propios de VB (Almacén RAVE) enciende los avisos y obtiene la llave una sola vez
     (el menú se vuelve a publicar solo y la app del Club empieza a ofrecer «Activar avisos»);
   · en «Suscriptos» muestra a TODOS los clientes que aceptaron mensajes, con su estado
     (avisos activos o todavía no), invitación por WhatsApp de a uno o a todos, y el envío de una campaña
     por WhatsApp a quienes todavía no tienen los avisos activos. */

const pushOpt=()=>S.customers.filter(c=>c.comm===true&&c.status!=='baja'&&!c.archived);
let pushSubIds=null,pushSubAt=0;
async function pushSubLoad(){if(!pushCloud()||Date.now()-pushSubAt<60000)return;pushSubAt=Date.now();
 try{const r=await rpc('push_subs_clientes',{p_comercio:cl.comercio.id});pushSubIds=new Set((r||[]).map(String));if(curScreen==='push'&&pushTab==='subs'){const b=$('#push-body');if(b)b.innerHTML=pushBody();}}catch(e){pushSubIds=null;}}
const pushClubUrl=()=>location.href.split('#')[0]+'#menu';
const pushBiz=()=>(typeof cl!=='undefined'&&cl.comercio&&cl.comercio.nombre)||(S.tenant&&S.tenant.name)||'el local';
const pushInvTxt=c=>`¡Hola ${String(c.name||'').split(' ')[0]}! 🔔 Activá los avisos de ${pushBiz()} para enterarte primero de las promos y del estado de tus pedidos: entrá a ${pushClubUrl()} y tocá «Activar avisos». Los podés desactivar cuando quieras.`;
const pushWaOf=c=>typeof waOk==='function'&&waOk(c)?waDigits(c):'';

/* 1) puesta en marcha automática en los sistemas propios */
let pushAutoDone=false;
async function pushAuto(){if(pushAutoDone||!pushCloud()||!isAdm())return;pushAutoDone=true;const c=pushCfg();
 const propio=typeof VBL!=='undefined'&&VBL.lic&&VBL.lic.propio;
 try{if(!c.pub){const r=await hreq('/functions/v1/push',{method:'POST',fn:true,body:{accion:'llave',comercio:cl.comercio.id}});if(r&&r.pub){c.pub=r.pub;try{await rpc('push_url',{p_comercio:cl.comercio.id,p_url:CLOUD.url.replace(/\/$/,'')+'/functions/v1/push'});}catch(e){}audit('PUSH_LLAVE','llave pública obtenida automáticamente');}}
  if(propio&&!c.on&&!c.autoOn&&c.pub){c.on=true;c.autoOn=1;audit('PUSH_MODULO','activado (sistema propio)');}
  save();if(typeof pubReload==='function')try{pubReload();}catch(e){}}catch(e){pushAutoDone=false;}}
{const _sp=showPanel;showPanel=function(){const r=_sp.apply(this,arguments);setTimeout(()=>{try{pushAuto();}catch(e){}},1500);return r;};}

/* 2) «Suscriptos»: todos los que aceptaron mensajes */
function pushOptHTML(){const L=pushOpt();const c=pushCfg();const on=!!(c.on&&c.pub);const sub=pushSubIds;
 const act=sub?L.filter(x=>sub.has(String(x.id))):[];const pend=sub?L.filter(x=>!sub.has(String(x.id))):L;const sinWa=pend.filter(x=>!pushWaOf(x)).length;
 const camps=pushCamps().filter(x=>x.tipo==='ESTANDAR'&&x.titulo);
 return`<div class="card po-card"><h2>Clientes que aceptaron mensajes del negocio <span class="po-n">${L.length}</span></h2>
 <div class="po-st ${on?'ok':'warn'}">${on?'✅ Los avisos push están activos: la app del Club le ofrece «Activar avisos» a cada cliente.':`⚠ Los avisos push están <b>apagados${c.pub?'':' o sin llave'}</b>: la app del Club todavía no le ofrece el botón a tus clientes.${isAdm()?' <button class="btn sm gold" data-act="pushOptFix">Activarlos ahora</button>':''}`}</div>
 <p class="sm mut">Aceptar promociones en el Club no alcanza para recibir notificaciones: el celular tiene que dar el permiso. Cada cliente lo hace una sola vez desde la app del Club tocando «Activar avisos». Mientras tanto, les podés llegar por WhatsApp.</p>
 <div class="po-k"><div><b>${L.length}</b><span>aceptaron mensajes</span></div><div><b>${sub?act.length:'—'}</b><span>con avisos activos</span></div><div><b>${sub?pend.length:'—'}</b><span>todavía no los activaron</span></div><div><b>${sinWa}</b><span>sin WhatsApp cargado</span></div></div>
 ${L.length?`<div class="row po-bar"><button class="btn gold" data-act="pushOptInvAll" ${pend.length-sinWa?'':'disabled'}>💬 Invitar a activar avisos (${pend.length-sinWa})</button>
  ${camps.length?`<select id="po-camp" aria-label="Campaña"><option value="">Mandar una campaña por WhatsApp…</option>${camps.slice(-20).reverse().map(x=>`<option value="${x.id}">${esc(x.titulo)}</option>`).join('')}</select><button class="btn" data-act="pushOptCamp">Armar envío</button>`:''}</div>
 <div class="tw po-tw"><table><thead><tr><th>Cliente</th><th>WhatsApp</th><th>Avisos push</th><th></th></tr></thead><tbody>${L.slice().sort((a,b)=>(sub&&sub.has(String(a.id))?1:0)-(sub&&sub.has(String(b.id))?1:0)||String(a.name).localeCompare(String(b.name))).slice(0,400).map(x=>{const w=pushWaOf(x);const ok=sub&&sub.has(String(x.id));
  return`<tr><td><b>${esc(custFull(x))}</b></td><td>${w?'+'+esc(w):'<span class="mut">sin cargar</span>'}</td><td>${ok?'<span class="po-ok">● Activos</span>':sub?'<span class="po-pe">● Todavía no</span>':'<span class="mut">se ve con la nube</span>'}</td>
  <td>${!ok&&w?`<a class="btn sm" href="${waLink(pushInvTxt(x),w)}" target="_blank" rel="noopener">Invitar</a>`:''}</td></tr>`;}).join('')}</tbody></table></div>${L.length>400?'<p class="sm mut">Se muestran 400.</p>':''}`
 :'<p class="sm">Todavía ningún cliente marcó «Acepto recibir promociones» al sumarse al Club. Se puede marcar también desde la ficha del cliente.</p>'}</div>`;}
{const _b=pushBody;pushBody=function(){const h=_b.apply(this,arguments);if(pushTab!=='subs')return h;setTimeout(pushSubLoad,0);return pushOptHTML()+h+PO_CSS;};}
A.pushOptFix=async()=>{if(!isAdm())return;const c=pushCfg();pushAutoDone=false;
 try{if(!c.pub){await A.pushKey();}if(!c.pub)return;c.on=true;audit('PUSH_MODULO','activado');save();if(typeof pubReload==='function')try{pubReload();}catch(e){}toast('Avisos activados: la app del Club ya ofrece «Activar avisos»');rerender();}catch(e){toast(String(e&&e.message||e),1);}};
/* lista para mandar de a uno (WhatsApp no permite envíos masivos desde un enlace) */
function pushWaList(titulo,L,txt){const w=modal(titulo,`<p class="sm">Tocá cada botón: se abre WhatsApp con el mensaje listo y queda tildado. WhatsApp no permite mandar a todos juntos desde la web.</p>
 <ol class="po-list">${L.map(x=>`<li><span>${esc(custFull(x))}</span><a class="btn sm" href="${waLink(txt(x),pushWaOf(x))}" target="_blank" rel="noopener" data-po="1">Enviar</a></li>`).join('')}</ol>`,{ok:false,cancelText:'Listo'});
 w.addEventListener('click',e=>{const a=e.target.closest('[data-po]');if(a){a.textContent='✓ Enviado';a.classList.add('gold');}});return w;}
A.pushOptInvAll=()=>{const sub=pushSubIds;const L=pushOpt().filter(x=>pushWaOf(x)&&!(sub&&sub.has(String(x.id))));if(!L.length)return toast('No hay clientes para invitar',1);
 audit('PUSH_INVITAR',L.length+' cliente(s) por WhatsApp');pushWaList('Invitar a activar avisos · '+L.length,L,pushInvTxt);};
A.pushOptCamp=()=>{const id=val('po-camp');const x=pushCamps().find(c=>c.id===id);if(!x)return toast('Elegí una campaña',1);const sub=pushSubIds;
 const L=pushOpt().filter(c=>pushWaOf(c)&&!(sub&&sub.has(String(c.id))));if(!L.length)return toast('Todos los que aceptaron ya tienen avisos activos',1);
 const txt=c=>`¡Hola ${String(c.name||'').split(' ')[0]}! ${x.titulo}\n${x.cuerpo||''}\n${pushClubUrl()}`.trim();audit('PUSH_WHATSAPP',x.titulo+' · '+L.length+' cliente(s)');pushWaList('«'+x.titulo+'» por WhatsApp · '+L.length,L,txt);};
const PO_CSS=`<style>.po-card h2{display:flex;align-items:center;gap:.5rem}.po-n{font-size:.85rem;background:var(--gold);color:#1a1307;border-radius:999px;padding:.05rem .55rem}
.po-st{border-radius:12px;padding:.6rem .8rem;margin:.3rem 0 .5rem;font-size:.92rem}.po-st.ok{background:rgba(46,154,85,.12);border:1px solid rgba(46,154,85,.4)}.po-st.warn{background:rgba(201,150,62,.12);border:1px solid var(--gold)}
.po-k{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.4rem;margin:.5rem 0}.po-k>div{border:1px solid var(--line);border-radius:12px;padding:.5rem;text-align:center}.po-k b{display:block;font-size:1.35rem}.po-k span{font-size:.75rem;color:var(--mut)}
.po-bar{flex-wrap:wrap;gap:.4rem;margin:.4rem 0}.po-bar select{min-width:0;flex:1 1 14rem}.po-tw{max-height:55vh;overflow:auto}.po-ok{color:#2e9a55;font-weight:700}.po-pe{color:var(--crm-m,#b7791f);font-weight:700}
.po-list{padding-left:1.2rem;max-height:60vh;overflow:auto}.po-list li{display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.3rem 0;border-bottom:1px solid var(--line)}
@media (max-width:560px){.po-k{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>`;
