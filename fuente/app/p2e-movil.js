/* ===== V27.4 · Celular y tablet + pantalla Módulos ordenada (todos los perfiles) =====
   · Barra inferior (Inicio, Caja, Vender, Stock, Más) en pantallas de hasta 900 px; «Más» abre el menú lateral.
   · El menú lateral se cierra al tocar afuera (con la pantalla oscurecida detrás) o con Escape.
   · Cabecera más limpia en el celular (sin las etiquetas de estado ni el selector de tema).
   · Módulos: «Modelo de negocio» resumido (se cambia en Configuración) y funciones con interruptores. Las demos lo reemplazan por el suyo.
   Sólo cambia la presentación: no toca datos, permisos, planes ni licencias. */
const MV_SVG=d=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const MV_CSS=`.vbm-list{display:grid;gap:.6rem;margin-top:.8rem}.vbm-row{display:flex;gap:.9rem;align-items:center;padding:.85rem 1rem;border:1px solid var(--line);border-radius:14px;background:var(--card)}.vbm-row.lock{opacity:.6}
.vbm-sw{flex:0 0 auto;position:relative;width:52px;height:30px;border-radius:99px;border:2px solid var(--mut);background:transparent;cursor:pointer;padding:0}.vbm-sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--mut);transition:left .15s}
.vbm-sw.on{border-color:var(--gold);background:color-mix(in srgb,var(--gold) 18%,transparent)}.vbm-sw.on::after{left:25px;background:var(--gold)}.vbm-sw.ro{opacity:.55;cursor:default}.vbm-sw:disabled{cursor:not-allowed}
.vbm-ic{display:inline-flex;color:var(--gold);flex:0 0 auto}
#vb-tab,#vb-ov{display:none}
@media(max-width:900px){#vb-tab:not([hidden]){display:flex;position:fixed;left:0;right:0;bottom:0;z-index:25;background:var(--card);border-top:1px solid var(--line);padding:.3rem .2rem calc(.3rem + env(safe-area-inset-bottom));backdrop-filter:blur(8px)}
#vb-tab button{flex:1;font:inherit;font-size:.72rem;display:flex;flex-direction:column;align-items:center;gap:.15rem;padding:.35rem 0;border:0;background:none;color:var(--mut);cursor:pointer}#vb-tab button.on{color:var(--gold);font-weight:700}
#view{padding-bottom:5.5rem!important}#vb-ov:not([hidden]){display:block;position:fixed;inset:0;z-index:29;background:rgba(0,0,0,.5)}
.ux-tabs{flex-wrap:nowrap!important;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.ux-tabs::-webkit-scrollbar{display:none}.ux-tabs a{flex:0 0 auto;white-space:nowrap}#top [data-act=themeCycle],#top .tag,#top .demo-b,#top .th-seg,#top .ux-av .sm,#top .app-inst,#top .ux-search kbd{display:none!important}#top{gap:.4rem}#top>b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}}`;
const MV_TAB=[['inicio','Inicio','M3 11l9-7 9 7v9H3zM9 20v-6h6v6'],['caja','Caja','M3 6h18v12H3zM7 12h.01M17 12h.01M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],['vender','Vender','M3 4h2l2.4 11h11.2L21 8H6.3M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],['inventario','Stock','M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8'],['_mas','Más','M5 12h.01M12 12h.01M19 12h.01']];
function mvTabsCentrar(){try{const a=document.querySelector('.ux-tabs a.on');if(!a)return;const c=a.parentElement;c.scrollLeft=Math.max(0,a.offsetLeft-c.offsetLeft-(c.clientWidth-a.offsetWidth)/2);}catch(e){}}
function mvTabPaint(){const t=document.getElementById('vb-tab');if(!t)return;const pan=document.getElementById('panel');t.hidden=!user||!pan||pan.hidden;
 t.querySelectorAll('button').forEach(b=>{const id=b.dataset.id;if(id!=='_mas'){let ok=false;try{ok=typeof uxVis==='function'?uxVis(id):!!SCREENS[id];}catch(e){}b.hidden=!ok;}b.classList.toggle('on',id===curScreen);});}
/* Módulos (fuera de las demos): plan, modelo de negocio resumido y funciones con interruptores */
function mvModulos(){const pl=giPlan();const ch=typeof chanCur==='function'?chanCur():'min';
 const bz=typeof BIZ_TYPES!=='undefined'&&typeof ownerMode==='function'?BIZ_TYPES[ownerMode()?'owner':'rubros']:'';
 const fijo=t=>`<div class="vbm-row"><span class="vbm-sw on ro" aria-hidden="true"></span><span class="sp"><b>${esc(t)}</b><br><span class="sm mut">Fijo: no se puede apagar.</span></span></div>`;
 const fila=m=>{const lock=!giInPlan(m.plan),on=giOn(m.k);
  return`<div class="vbm-row ${lock?'lock':''}" data-mod="${m.k}"><button class="vbm-sw ${on?'on':''}" ${lock?'disabled':''} data-act="giMod" data-k="${m.k}" data-on="${on?0:1}" role="switch" aria-checked="${on}" aria-label="${esc(m.t)}"></button><span class="sp"><b>${esc(m.t)}</b><br><span class="sm mut">${lock?'Incluido desde '+esc(GI_PLANS[m.plan].t)+'.':esc(m.d)}${m.dep?' Necesita: '+m.dep.map(d=>esc(giMod(d).t)).join(', ')+'.':''}</span></span>${on&&m.scr&&SCREENS[m.scr]?`<button class="btn sm" data-act="nav" data-id="${m.scr}">Abrir</button>`:''}</div>`;};
 const L=GI_MODS.slice().sort((a,b)=>(giInPlan(a.plan)?0:1)-(giInPlan(b.plan)?0:1));
 return`<div class="row"><h1 class="sp">Módulos</h1></div>
 <div class="grid g2"><div class="card"><div class="row" style="align-items:center;gap:.7rem"><span class="vbm-ic">${MV_SVG('M3 21V9l9-6 9 6v12M8 21v-7h8v7')}</span><h3 class="sp" style="margin:0">Modelo de negocio</h3>${user&&user.role==='admin'?'<button class="btn" data-act="mvModelo">✎ Cambiar</button>':''}</div>
  <p style="margin:.7rem 0 .2rem"><b>${esc(bz)}</b> · <b>${esc(typeof CHANNELS!=='undefined'&&CHANNELS[ch]?CHANNELS[ch][0]:'')}</b></p><p class="sm mut" style="margin:0">Se cambia en Configuración → Modelo de negocio. No borra ni mueve datos.</p></div>
  <div class="card"><h3 style="margin-top:0">Plan: ${esc(GI_PLANS[pl].t)}</h3><p class="sm mut">${esc(GI_PLANS[pl].d)}</p>${IS_CLIENT?'<p class="sm mut">El plan lo fija Vincular Business según el contrato.</p>':`<label for="gi-plan">Vista previa de planes</label><select id="gi-plan" data-chg="giPlan">${GI_PORD.map(p=>`<option value="${p}" ${p===pl?'selected':''}>${esc(GI_PLANS[p].t)}</option>`).join('')}</select>`}</div></div>
 <div class="card"><h3 style="margin-top:0">Módulos del sistema</h3><p class="sm mut">Cada interruptor vale para todo el negocio. Activar no borra nada y desactivar tampoco: los datos quedan guardados. Cada cambio queda en Auditoría.</p>
 <div class="vbm-list">${['Vender y caja','Stock e inventario','Clientes','Usuarios y permisos','Configuración','Auditoría'].map(fijo).join('')}${L.map(fila).join('')}</div></div>`;}
A.mvModelo=()=>{go('config');setTimeout(()=>{const c=document.getElementById('biz-card');if(c)c.scrollIntoView({behavior:'smooth',block:'start'});},250);};
{let mvHecho=false;const _rt=route;
 route=function(){if(!mvHecho&&typeof SCREENS==='object'){mvHecho=true;
   const st=document.createElement('style');st.textContent=MV_CSS;document.head.appendChild(st);
   const tb=document.createElement('nav');tb.id='vb-tab';tb.setAttribute('aria-label','Accesos rápidos');tb.hidden=true;
   tb.innerHTML=MV_TAB.map(([id,t,d])=>`<button type="button" data-id="${id}">${MV_SVG(d)}<span>${t}</span></button>`).join('');document.body.appendChild(tb);
   tb.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const sd=document.getElementById('side');if(b.dataset.id==='_mas'){if(sd)sd.classList.toggle('open');return;}if(sd)sd.classList.remove('open');go(b.dataset.id);});
   const ov=document.createElement('div');ov.id='vb-ov';ov.hidden=true;document.body.appendChild(ov);let obs=null,obsEl=null;
   const ovSync=()=>{const sd=document.getElementById('side');ov.hidden=!(sd&&sd.classList.contains('open'));if(sd&&sd!==obsEl){obsEl=sd;if(obs)obs.disconnect();obs=new MutationObserver(ovSync);obs.observe(sd,{attributes:true,attributeFilter:['class']});}};
   ovSync();setInterval(()=>{ovSync();mvTabPaint();},700);
   if(!(window.RAVE_DEMO)&&SCREENS.modulos&&typeof GI_MODS!=='undefined')SCREENS.modulos.render=()=>mvModulos();}
  const r=_rt.apply(this,arguments);setTimeout(mvTabPaint,0);return r;};}
{const _sp=showPanel;showPanel=function(){const r=_sp.apply(this,arguments);setTimeout(()=>{mvTabPaint();mvTabsCentrar();setTimeout(mvTabsCentrar,350);},0);return r;};}
document.addEventListener('click',e=>{const sd=document.getElementById('side');if(!sd||!sd.classList.contains('open'))return;
 if(e.target.closest('#side')||e.target.closest('#burger')||e.target.closest('#vb-tab'))return;sd.classList.remove('open');e.preventDefault();e.stopPropagation();},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const sd=document.getElementById('side');if(sd)sd.classList.remove('open');}});
