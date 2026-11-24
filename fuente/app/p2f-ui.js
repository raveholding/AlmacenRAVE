/* ===== V27.31 · Kit de interfaz común de SISTEMA VB (encabezado de pantalla, insignias de estado, menú «Más», panel lateral,
   estados vacíos, tiras de indicadores y secciones). Nace del rediseño de Atención al cliente y lo usa cualquier pantalla:
   · uiHead({t, sub, prim, acts, more, extra})   encabezado: título, una línea corta, UNA acción principal y el resto en «Más»
   · uiBadge(estado, texto?)                     insignia estándar: ok · info · off · warn · err (mismo color y forma en todo el sistema)
   · uiMore(items) / A.uiMore                    menú desplegable «⋯ Más» (accesible con teclado, se cierra con Esc o clic afuera)
   · uiDrawer(titulo, html, opt)                 ventana como panel lateral derecho (misma API que modal(): onOk, okText, wide…)
   · uiEmpty(icono, titulo, texto, botón?)       estado vacío con una acción
   · uiKpis([{v, l, tone?, act?, t?}])           tira de indicadores compacta
   · uiSec(titulo, sub, cuerpo, extra?)          bloque con título
   · uiSteps(pasos, actual)                      pasos numerados de un asistente
   Sin frameworks: HTML + data-act, igual que el resto del sistema. Respeta tema claro/oscuro y contraste ≥ 4,5:1. */
const UI_TONES={ok:'ok',info:'info',off:'off',warn:'warn',err:'err'};
const UI_TXT={ok:'Activo',info:'Enlace directo',off:'Sin conectar',warn:'Requiere atención',err:'Con error'};
function uiBadge(st,t){const k=UI_TONES[st]||'off';return `<span class="ui-bd ui-${k}">${esc(t||UI_TXT[k])}</span>`;}
/* menú «Más»: items = [{t, act, attrs?, ic?, danger?}] (los vacíos se omiten) */
function uiMore(items,label){const L=(items||[]).filter(Boolean);if(!L.length)return '';const id='uim'+Math.random().toString(36).slice(2,8);
 return `<div class="ui-more"><button type="button" class="btn ui-more-b" data-act="uiMore" aria-haspopup="menu" aria-expanded="false" aria-controls="${id}">${esc(label||'Más')} <span aria-hidden="true">▾</span></button>
 <div class="ui-more-m" role="menu" id="${id}" hidden>${L.map(x=>`<button type="button" role="menuitem" class="${x.danger?'neg':''}" data-act="${esc(x.act)}" ${x.attrs||''}>${x.ic?`<span aria-hidden="true">${x.ic}</span>`:''}${esc(x.t)}</button>`).join('')}</div></div>`;}
A.uiMore=el=>{const m=el.nextElementSibling;if(!m)return;const open=m.hidden;uiMoreClose();m.hidden=!open;el.setAttribute('aria-expanded',open);if(open){const f=m.querySelector('button');if(f)f.focus();}};
function uiMoreClose(){$$('.ui-more-m').forEach(m=>{if(!m.hidden){m.hidden=true;const b=m.previousElementSibling;if(b)b.setAttribute('aria-expanded','false');}});}
document.addEventListener('click',e=>{if(!e.target.closest('.ui-more'))uiMoreClose();else if(e.target.closest('.ui-more-m [data-act]'))setTimeout(uiMoreClose,0);});
document.addEventListener('keydown',e=>{const m=e.target.closest&&e.target.closest('.ui-more-m');if(e.key==='Escape'&&m){e.stopPropagation();uiMoreClose();const b=m.previousElementSibling;if(b)b.focus();return;}
 if(m&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();const L=[...m.querySelectorAll('button')];const i=L.indexOf(e.target);L[(i+(e.key==='ArrowDown'?1:-1)+L.length)%L.length].focus();}},true);
/* encabezado: prim = {t, act, attrs?} · acts = botones secundarios visibles (máx. 2 recomendados) · more = items del menú «Más» */
function uiHead(o){const b=x=>x?`<button class="btn ${x.gold?'gold':''}" data-act="${esc(x.act)}" ${x.attrs||''}>${x.ic?`<span aria-hidden="true">${x.ic}</span> `:''}${esc(x.t)}</button>`:'';
 return `<header class="ui-head"><div class="ui-head-t"><h1>${esc(o.t)}</h1>${o.sub?`<p>${o.sub}</p>`:''}</div><div class="ui-head-a">${o.extra||''}${(o.acts||[]).map(b).join('')}${uiMore(o.more)}${o.prim?b(Object.assign({gold:1},o.prim)):''}</div></header>`;}
function uiKpis(L){return `<div class="ui-kpis">${(L||[]).map(x=>{const tag=x.act?'button':'div';return `<${tag} class="ui-kpi${x.tone?' ui-'+x.tone:''}" ${x.act?`type="button" data-act="${esc(x.act)}" ${x.attrs||''}`:''} ${x.t?`title="${esc(x.t)}"`:''}><b>${x.v}</b><span>${esc(x.l)}</span></${tag}>`;}).join('')}</div>`;}
function uiEmpty(ic,t,x,btn){return `<div class="ui-empty"><span class="ui-empty-i" aria-hidden="true">${ic||'✨'}</span><h3>${esc(t)}</h3>${x?`<p>${x}</p>`:''}${btn?`<button class="btn gold" data-act="${esc(btn.act)}" ${btn.attrs||''}>${esc(btn.t)}</button>`:''}</div>`;}
function uiSec(t,sub,body,extra){return `<section class="ui-sec"><div class="ui-sec-h"><div><h2>${esc(t)}</h2>${sub?`<p>${sub}</p>`:''}</div>${extra||''}</div>${body}</section>`;}
function uiSteps(L,cur){return `<ol class="ui-steps">${L.map((t,i)=>`<li class="${i<cur?'done':i===cur?'on':''}" ${i===cur?'aria-current="step"':''}><span>${i<cur?'✓':i+1}</span>${esc(t)}</li>`).join('')}</ol>`;}
/* panel lateral: la misma ventana del sistema, presentada a la derecha (en celulares ocupa toda la pantalla) */
function uiDrawer(title,body,opt){const w=modal(title,body,Object.assign({wide:true},opt||{}));w.classList.add('ui-drawer');return w;}
(function(){if(typeof document==='undefined'||document.getElementById('ui-css'))return;const st=document.createElement('style');st.id='ui-css';
 st.textContent=`
.ui-head{display:flex;gap:.8rem 1rem;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;margin:0 0 .9rem}
.ui-head-t{flex:1 1 280px;min-width:0}.ui-head-t h1{margin:0}.ui-head-t p{margin:.2rem 0 0;color:var(--mut);font-size:.92rem;line-height:1.4}
.ui-head-a{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
.ui-bd{display:inline-flex;align-items:center;gap:.3rem;font-size:.74rem;font-weight:700;line-height:1;padding:.32rem .6rem;border-radius:999px;white-space:nowrap;border:1px solid transparent}
.ui-bd:before{content:"";width:.5rem;height:.5rem;border-radius:50%;background:currentColor}
.ui-ok{background:var(--okbg);color:var(--ok)}.ui-info{background:rgba(37,99,235,.1);color:#1d4ed8}.ui-off{background:var(--bg);color:var(--mut);border-color:var(--line)}
.ui-warn{background:var(--warnbg);color:#8a5a00}.ui-err{background:rgba(185,28,28,.1);color:#a8261b}
[data-theme=dark] .ui-info{color:#93b4ff;background:rgba(96,165,250,.14)}[data-theme=dark] .ui-warn{color:#f2c96b}[data-theme=dark] .ui-err{color:#ff9b91;background:rgba(255,155,145,.12)}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]) .ui-info{color:#93b4ff;background:rgba(96,165,250,.14)}:root:not([data-theme=light]) .ui-warn{color:#f2c96b}:root:not([data-theme=light]) .ui-err{color:#ff9b91;background:rgba(255,155,145,.12)}}
.ui-more{position:relative}.ui-more-m{position:absolute;right:0;top:calc(100% + .3rem);z-index:30;min-width:230px;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.16);padding:.3rem;display:flex;flex-direction:column}
.ui-more-m button{display:flex;gap:.55rem;align-items:center;text-align:left;background:none;border:0;border-radius:8px;padding:.6rem .7rem;min-height:44px;font:inherit;color:inherit;cursor:pointer}
.ui-more-m button:hover,.ui-more-m button:focus-visible{background:var(--bg);outline:none}.ui-more-m button.neg{color:#a8261b}
.ui-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem;margin:0 0 .9rem}
.ui-kpi{display:flex;flex-direction:column;gap:.15rem;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:.7rem .85rem;font:inherit;color:inherit;min-height:64px}
button.ui-kpi{cursor:pointer}button.ui-kpi:hover{border-color:var(--gold)}.ui-kpi b{font-size:1.35rem;line-height:1.1}.ui-kpi span{font-size:.8rem;color:var(--mut)}
.ui-kpi.ui-warn,.ui-kpi.ui-err,.ui-kpi.ui-ok{background:var(--card)}.ui-kpi.ui-err b{color:#a8261b}.ui-kpi.ui-warn b{color:#8a5a00}.ui-kpi.ui-ok b{color:var(--ok)}
.ui-empty{text-align:center;padding:2.2rem 1rem;border:1px dashed var(--line);border-radius:16px;background:var(--card)}.ui-empty-i{font-size:2rem;display:block;margin-bottom:.3rem}
.ui-empty h3{margin:.2rem 0}.ui-empty p{margin:.2rem auto .8rem;color:var(--mut);max-width:46ch}
.ui-sec{margin:0 0 1.1rem}.ui-sec-h{display:flex;gap:.6rem;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin:0 0 .55rem}.ui-sec-h h2{margin:0;font-size:1.05rem}.ui-sec-h p{margin:.15rem 0 0;color:var(--mut);font-size:.85rem}
.ui-steps{list-style:none;display:flex;gap:.4rem;margin:0 0 1rem;padding:0;flex-wrap:wrap}.ui-steps li{display:flex;align-items:center;gap:.4rem;font-size:.85rem;color:var(--mut);padding:.3rem .6rem .3rem .3rem;border-radius:999px;background:var(--bg)}
.ui-steps li span{width:1.6rem;height:1.6rem;display:grid;place-items:center;border-radius:50%;border:1px solid var(--line);font-weight:700;font-size:.8rem;background:var(--card)}
.ui-steps li.on{color:var(--ink);font-weight:600}.ui-steps li.on span{background:var(--gold);border-color:var(--gold);color:#111}.ui-steps li.done span{background:var(--okbg);color:var(--ok);border-color:transparent}
.ov.ui-drawer{display:flex;justify-content:flex-end;align-items:stretch;padding:0}.ov.ui-drawer .dlg{margin:0;width:min(600px,100%);max-width:100%;height:100%;max-height:none;border-radius:16px 0 0 16px;display:flex;flex-direction:column;overflow:hidden}
.ov.ui-drawer .dlg>.mb{flex:1;overflow:auto}.ov.ui-drawer .dlg>h3{padding-bottom:.6rem;border-bottom:1px solid var(--line)}
@media(max-width:640px){.ov.ui-drawer .dlg{border-radius:0}.ui-head-a{width:100%}.ui-head-a>.btn.gold{flex:1}}`;
 document.head.appendChild(st);})();
