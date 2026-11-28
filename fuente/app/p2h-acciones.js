/* ===== V27.41 · Botones grandes para trabajar rápido (sólo Almacén RAVE) =====
   · «¿Qué querés hacer?» arriba del Resumen: botones grandes con ícono (Vender destacado, Productos, Abrir o cerrar caja,
     Nuevo producto, Clientes, Atención). Sólo aparecen los que la persona puede usar.
   · Barra inferior del celular más clara: íconos de color, textos más grandes y la pestaña activa resaltada
     (Inicio · Vender · Productos · Caja · Clientes · Más). En Vender, la barra del ticket queda arriba de esta barra.
   · Cabecera del celular sin «Ver menú público» (sigue en «Más» y en Menú público), para que no se corte.
   Sólo presentación: no cambia permisos, datos ni cómo se cobra. */
const QA_CSS=`
#qa-box{margin:0 0 1rem}
#qa-box h2{font-size:1.05rem;margin:0 0 .6rem}
#qa-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.7rem}
#qa-grid button{display:flex;align-items:center;gap:.7rem;min-height:72px;padding:.8rem 1rem;border-radius:18px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:700 1.08rem/1.2 inherit;text-align:left;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.06);transition:transform .08s,border-color .15s}
#qa-grid button:hover,#qa-grid button:focus-visible{border-color:var(--gold)}
#qa-grid button:active{transform:scale(.97)}
#qa-grid button .qi{font-size:1.9rem;line-height:1;flex:none}
#qa-grid button small{display:block;font-weight:500;font-size:.78rem;color:var(--mut);margin-top:.15rem}
#qa-grid button.pri{background:linear-gradient(135deg,#b8862f,#e0b86a);color:#1a140c;border-color:transparent;box-shadow:0 10px 24px rgba(184,134,47,.35)}
#qa-grid button.pri small{color:#3a2c14}
#qa-grid button.warn{border-color:#d9a441}
@media(max-width:360px){#vb-tab button{font-size:.68rem!important;margin:0 .05rem!important}#vb-tab button .ti{font-size:1.25rem}}
@media(max-width:600px){#qa-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#qa-grid button{min-width:0;padding:.7rem .6rem;gap:.5rem;font-size:1rem}#qa-grid button>span:last-child{min-width:0;overflow-wrap:anywhere}#qa-grid button.pri{grid-column:1/-1;min-height:80px;font-size:1.25rem}}
@media(max-width:900px){
 #vb-tab:not([hidden]){padding:.35rem .25rem calc(.35rem + env(safe-area-inset-bottom))!important;background:#16130f!important;border-top:1px solid #3a3126!important;box-shadow:0 -8px 24px rgba(0,0,0,.25)}
 #vb-tab button{font-size:.8rem!important;color:#d8cfbf!important;gap:.2rem!important;padding:.4rem 0!important;margin:0 .15rem;border-radius:14px!important;min-height:58px}
 #vb-tab button .ti{font-size:1.45rem;line-height:1}
 #vb-tab button{min-width:0;flex:1 1 0!important}
 #vb-tab button span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 #vb-tab button.on{background:rgba(232,201,141,.16)!important;color:#f3dca8!important;font-weight:600!important}
 #vb-tab button span:last-child{letter-spacing:-.2px}
 #view{padding-bottom:6.5rem!important}
 #top a[href="#menu"]{display:none!important}
 #top{overflow-x:auto;scrollbar-width:none}#top::-webkit-scrollbar{display:none}
 body.pos3-on.pos3-lines #pos-mbar{bottom:calc(78px + env(safe-area-inset-bottom,0px))!important}
 body.pos3-on.pos3-lines #view{padding-bottom:11rem!important}
}`;
const QA_TAB=[['inicio','🏠','Inicio'],['vender','🛒','Vender'],['inventario','📦','Productos'],['caja','💵','Caja'],['clientes','👥','Clientes'],['_mas','☰','Más']];
function qaVis(id){try{return typeof uxVis==='function'?uxVis(id):!!(SCREENS[id]&&can(SCREENS[id].perm));}catch(e){return false;}}
function qaItems(){const s=typeof openSess==='function'?openSess():null;const L=[];
 if(qaVis('vender'))L.push(['vender','🛒','Vender','Cobrar con el lector o un toque','pri']);
 if(qaVis('inventario'))L.push(['inventario','📦','Productos','Precios y stock']);
 if(qaVis('caja'))L.push(s?['caja','💵','Caja abierta','Ingresos, egresos y ventas']:['caja','💵','Abrir caja','Con el efectivo inicial','warn']);
 if(s&&qaVis('arqueo'))L.push(['arqueo','🔒','Cerrar caja','Arqueo del turno']);
 if(qaVis('inventario')&&can('edit_products'))L.push(['_nuevo','➕','Nuevo producto','Con foto y código']);
 if(qaVis('clientes'))L.push(['clientes','👥','Clientes','Cuenta corriente y Club']);
 if(qaVis('crm'))L.push(['crm','💬','Atención','WhatsApp e Instagram']);
 if(qaVis('proveedores'))L.push(['proveedores','🚚','Proveedores','Compras y preventistas']);
 return L;}
function qaHTML(){const L=qaItems();if(!L.length)return'';
 return `<h2>¿Qué querés hacer?</h2><div id="qa-grid">${L.map(([id,ic,t,d,c])=>`<button type="button" data-qa="${id}" class="${c||''}"><span class="qi" aria-hidden="true">${ic}</span><span>${esc(t)}<small>${esc(d||'')}</small></span></button>`).join('')}</div>`;}
function qaPaint(){if(curScreen!=='inicio'&&curScreen!=='launch')return;const v=$('#view');if(!v||$('#qa-box',v))return;
 const b=document.createElement('section');b.id='qa-box';b.setAttribute('aria-label','Accesos rápidos');b.innerHTML=qaHTML();if(!b.innerHTML)return;
 const h=v.querySelector('.ui-head,h1,.row');const at=h&&h.parentNode===v?h.nextSibling:v.firstChild;v.insertBefore(b,at);
 b.addEventListener('click',e=>{const x=e.target.closest('[data-qa]');if(!x)return;const id=x.dataset.qa;
  if(id==='_nuevo'){go('inventario');setTimeout(()=>{try{A.pedit({dataset:{}});}catch(er){}},120);return;}go(id);});}
function qaTabs(){const t=document.getElementById('vb-tab');if(!t||t.dataset.qa)return;t.dataset.qa='1';
 t.innerHTML=QA_TAB.map(([id,ic,tx])=>`<button type="button" data-id="${id}"><span class="ti" aria-hidden="true">${ic}</span><span>${tx}</span></button>`).join('');}
{if(!document.getElementById('qa-css')){const st=document.createElement('style');st.id='qa-css';st.textContent=QA_CSS;document.head.appendChild(st);}
 if(typeof mvTabPaint==='function'){const _mp=mvTabPaint;mvTabPaint=function(){try{qaTabs();}catch(e){}return _mp.apply(this,arguments);};}
 const _sp=showPanel;showPanel=function(){const r=_sp.apply(this,arguments);try{qaTabs();qaPaint();}catch(e){}return r;};}
/* ===== V27.42 · Barra lateral ordenada, sin duplicados y con íconos de color (sólo Almacén RAVE) =====
   · 9 secciones claras: Resumen · Ventas y caja · Pedidos y reparto · Productos y stock · Clientes · Finanzas · Equipo · Menú y web · Sistema.
   · Pantallas hermanas en UNA sola entrada con pestañas (como «Gestión de caja»): Precios y etiquetas · Stock e inventario
     (inventario, toma y depósitos) · Reparto y despacho (despacho, hoja de ruta, cargas, torre, mapa, devoluciones) ·
     Ventas mayoristas (pedidos de venta, preventa, acopios).
   · Íconos de color como la barra inferior. No cambia permisos: cada persona sigue viendo sólo lo suyo. */
const QS_SEC=['Resumen','Ventas y caja','Pedidos y reparto','Productos y stock','Clientes','Finanzas','Equipo','Menú y web','Sistema','Otros'];
const QS_OF={inicio:'Resumen',launch:'Resumen',centro:'Resumen',
 caja:'Ventas y caja',cajasx:'Ventas y caja',arqueo:'Ventas y caja',cierres:'Ventas y caja',presup:'Ventas y caja',eventos:'Ventas y caja',pedidosv:'Ventas y caja',preventa:'Ventas y caja',acopios:'Ventas y caja',
 pedidos:'Pedidos y reparto',reparto:'Pedidos y reparto',copiloto:'Pedidos y reparto',carga:'Pedidos y reparto',torre:'Pedidos y reparto',equipo:'Pedidos y reparto',devoluciones:'Pedidos y reparto',
 inventario:'Productos y stock',inventariof:'Productos y stock',depositos:'Productos y stock',precios:'Productos y stock',etiquetas:'Productos y stock',mermas:'Productos y stock',cambios:'Productos y stock',proveedores:'Productos y stock',
 clientes:'Clientes',fidel:'Clientes',fidplus:'Clientes',monedero:'Clientes',cupones:'Clientes',crm:'Clientes',botwa:'Clientes',push:'Clientes',
 portalb2b:'Clientes',finanzas:'Finanzas',contable:'Finanzas',
 personal:'Equipo',rrhh:'Equipo',tareas:'Equipo',portal:'Equipo',vales:'Equipo',seguridad:'Equipo',
 menuadmin:'Menú y web',legal:'Menú y web',
 config:'Sistema',modulos:'Sistema',roles:'Sistema',auditoria:'Sistema',integ:'Sistema',impex:'Sistema',dispositivos:'Sistema',nube:'Sistema',copias:'Sistema',vbconsola:'Sistema'};
const QS_EMO={vender:'🛒',inicio:'📊',launch:'🚀',centro:'✨',caja:'💵',presup:'📝',eventos:'🎉',mayor:'🧾',pedidos:'🛵',reparto:'🚚',copiloto:'🗺️',stock:'📦',inventario:'📦',precios:'🏷️',mermas:'♻️',cambios:'🔁',
 proveedores:'🤝',club:'⭐',clientes:'👥',crm:'💬',botwa:'🤖',push:'🔔',finanzas:'💰',contable:'📒',personal:'🕒',rrhh:'🧑‍💼',tareas:'✅',portal:'🙋',vales:'🎟️',seguridad:'🛡️',
 menuadmin:'🌐',legal:'⚖️',config:'⚙️',modulos:'🧩',roles:'🔐',auditoria:'🕵️',integ:'🔌',impex:'📤',dispositivos:'🖨️',nube:'☁️',copias:'💾',vbconsola:'🛠️',portalb2b:'🏪',cajasx:'🏬',arqueo:'🔒',cierres:'🗂️',fidel:'⭐',cupones:'🎟️',monedero:'👛',fidplus:'🎂',pedidosv:'🧾',preventa:'📋',acopios:'📦',carga:'🚛',torre:'🗼',equipo:'📍',devoluciones:'↩️',inventariof:'📋',depositos:'🏬',etiquetas:'🏷️'};
{try{
 Object.assign(UX_GROUPS,{
  inventario:{t:()=>'Stock e inventario',icon:'box',items:[['inventario','Inventario'],['inventariof','Toma de inventario'],['depositos','Depósitos']]},
  precios:{t:()=>'Precios y etiquetas',icon:'list',items:[['precios','Precios'],['etiquetas','Etiquetas']]},
  reparto:{t:()=>'Reparto y despacho',icon:'route',items:[['reparto','Despacho'],['copiloto','Mi hoja de ruta'],['carga','Armado de cargas'],['torre','Torre de control'],['equipo','Equipo en el mapa'],['devoluciones','Devoluciones en tránsito']]},
  mayor:{t:()=>'Ventas mayoristas',icon:'truck',items:[['pedidosv','Pedidos de venta'],['preventa','Preventa'],['acopios','Acopios']]}});
 Object.keys(UX_SEC_OF).forEach(k=>delete UX_SEC_OF[k]);Object.assign(UX_SEC_OF,QS_OF);
 UX_SEC_ORDER.splice(0,UX_SEC_ORDER.length,...QS_SEC);
 Object.assign(UX_TITLE,{pedidos:'PedidosYa',seguridad:'Seguridad y portero',menuadmin:'Menú público',crm:'Atención al cliente',botwa:'Bot de pedidos',push:'Notificaciones push'});
}catch(e){}}
function qaSide(){const sd=document.getElementById('side');if(!sd)return;
 sd.querySelectorAll('a[data-ux]').forEach(a=>{if(a.dataset.qe)return;const e=QS_EMO[a.dataset.ux]||QS_EMO[a.dataset.id];if(!e)return;a.dataset.qe='1';
  const ic=a.querySelector('svg');const s=document.createElement('span');s.className='qs-e';s.setAttribute('aria-hidden','true');s.textContent=e;if(ic)ic.replaceWith(s);else a.insertBefore(s,a.firstChild);});}
{const st=document.createElement('style');st.textContent=`#side a[data-ux] .qs-e{display:inline-grid;place-items:center;flex:none;width:1.7rem;font-size:1.15rem;line-height:1}
#side a.ux-pos-btn .qs-e{font-size:1.25rem}
#side .ux-sec{letter-spacing:.3px}`;document.head.appendChild(st);
 const _sp2=showPanel;showPanel=function(){const r=_sp2.apply(this,arguments);try{qaSide();}catch(e){}return r;};}

/* V27.43 · los mismos íconos de color en el Launch pad (tarjetas, favoritos y recientes) */
function qaLaunch(){const v=document.getElementById('view');if(!v)return;
 v.querySelectorAll('.lp-tile[data-lp]').forEach(t=>{const ic=t.querySelector('.lp-ic');if(!ic||ic.dataset.qe)return;const b=t.querySelector('.lp-go');const e=QS_EMO[t.dataset.lp]||(b&&QS_EMO[b.dataset.id]);if(!e)return;ic.dataset.qe='1';ic.textContent=e;ic.classList.add('qs-lp');});}
{const st=document.createElement('style');st.textContent='.lp-ic.qs-lp{font-size:1.6rem;line-height:1}#view:has(#qa-box) .lp-quick{display:none!important}';document.head.appendChild(st);
 const _sp3=showPanel;showPanel=function(){const r=_sp3.apply(this,arguments);try{qaLaunch();}catch(e){}return r;};
 let qaRaf=0;const mo=new MutationObserver(()=>{if(curScreen!=='launch'||qaRaf)return;qaRaf=requestAnimationFrame(()=>{qaRaf=0;try{qaLaunch();}catch(e){}});});
 const hook=()=>{const v=document.getElementById('view');if(v)mo.observe(v,{childList:true,subtree:true});else setTimeout(hook,300);};hook();}
