/* ===== V27.39 · Vender más visual y ágil (requerimiento «Rediseño visual de POS», costo $0) =====
   Capa sobre Vender (p3b-pos): no cambia cómo se cobra, se descuenta stock ni se audita.
   · «⚡ Más vendidos» arriba: los fijados por el dueño primero y después los de más rotación de los últimos 30 días (hasta 12).
   · Buscador y rubros fijos arriba al bajar; rubros deslizables; tarjetas con foto, nombre en 2 líneas y precio grande.
   · Respuesta al tocar (se marca la tarjeta) y ticket fijo a la derecha en la PC.
   · En el celular: grilla de 2 o 3 columnas y barra inferior con cantidad, total y «Ver ticket / Cobrar».
   La carga de fotos ya es gratis: «Pegar foto», «Buscar foto en Google» y Open Food Facts (V27.31b), achicadas a WebP en el equipo. */
const POS3_CSS=`
.pos3 .pos>section,.pos3 .pos>section>.card{min-width:0}
.pos3 .pos>section:first-child>.card:first-child{position:sticky;top:var(--pos3-top,0px);z-index:6;box-shadow:0 10px 24px rgba(0,0,0,.12)}
.pos3 .pos>section:first-child>.card:first-child .row:has([data-act="prub"]){flex-wrap:nowrap!important;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px}
.pos3 .pos>section:first-child>.card:first-child .row:has([data-act="prub"])::-webkit-scrollbar{display:none}
.pos3 [data-act="prub"]{flex:none;min-height:40px;border-radius:999px!important;white-space:nowrap}
#pos-top{margin:.2rem 0 .8rem}
#pos-top .pt-h{display:flex;align-items:center;gap:.5rem;margin:0 0 .45rem}
#pos-top .pt-h b{font-size:.95rem}
#pos-top .pt-l{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:.5rem}
#pos-top .pt-b{position:relative;display:flex;flex-direction:column;gap:.25rem;min-height:44px;padding:.45rem;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;text-align:left;transition:transform .08s,border-color .15s}
#pos-top .pt-b:hover,#pos-top .pt-b:focus-visible{border-color:var(--gold)}
#pos-top .pt-b img,#pos-top .pt-b .pt-ni{width:100%;height:64px;object-fit:contain;border-radius:10px;background:rgba(127,127,127,.08)}
#pos-top .pt-b .pt-ni{display:grid;place-items:center;font-size:1.4rem}
#pos-top .pt-b b{font-size:.82rem;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#pos-top .pt-b .pt-p{font-weight:800;font-size:.95rem}
#pos-top .pt-b .pt-pin{position:absolute;top:4px;right:6px;font-size:.75rem;color:var(--gold)}
#pos-top .pt-b[disabled]{opacity:.5;cursor:not-allowed}
@media(max-width:700px){#pos-top .pt-l{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}#pos-top .pt-l::-webkit-scrollbar{display:none}#pos-top .pt-b{flex:0 0 112px;scroll-snap-align:start}}
.pos3 .pgrid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.pos3 .pbtn{transition:transform .08s,border-color .15s,box-shadow .15s}
.pos3 .pbtn:active{transform:scale(.97)}
.pos3 .pbtn .p3-img{display:block;width:100%;height:84px;object-fit:contain;border-radius:10px;margin-bottom:.25rem;background:rgba(127,127,127,.08)}
.pos3 .pbtn b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.92rem;line-height:1.2}
.pos3 .pbtn .p3-pr{display:block;font-weight:800;font-size:1.05rem;color:var(--ink)}
.pos3 .pbtn.p3-hit,#pos-top .pt-b.p3-hit{border-color:var(--gold);box-shadow:0 0 0 3px rgba(201,150,62,.35)}
@media(min-width:1001px){.pos3 #pcart{position:sticky;top:calc(var(--pos3-top,0px) + 8px);max-height:calc(100vh - var(--pos3-top,0px) - 24px);overflow:auto}}
@media(max-width:1000px){.pos3 .pgrid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}}
@media(max-width:520px){.pos3 .pgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.pos3 .pbtn .p3-img{height:72px}}
#pos-mbar{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:60;display:none;align-items:center;gap:.6rem;padding:.55rem .6rem .55rem 1rem;border-radius:16px;background:#16130f;color:#f3eee4;box-shadow:0 14px 34px rgba(0,0,0,.35);border:1px solid rgba(232,201,141,.35)}
#pos-mbar .mb-t{flex:1;min-width:0;font-size:.85rem}
#pos-mbar .mb-t b{display:block;font-size:1.15rem}
#pos-mbar button{min-height:46px;padding:0 1rem;border-radius:12px;border:0;font-weight:800;font-size:.95rem;cursor:pointer;background:linear-gradient(135deg,#b8862f,#e8c98d);color:#161310}
@media(max-width:1000px){body.pos3-on.pos3-lines #pos-mbar{display:flex}body.pos3-on.pos3-lines #view{padding-bottom:84px}}
`;
function posTopIds(){const pin=(S.cfg.posTop||[]).filter(id=>{const p=prod(id);return p&&p.active&&!p.archived;});
 const since=now()-30*864e5,cnt={};(S.sales||[]).forEach(s=>{if(!s||s.ts<since||(s.status&&s.status!=='ok'))return;(s.items||[]).forEach(i=>{if(i&&i.pid)cnt[i.pid]=(cnt[i.pid]||0)+(+i.qty||0);});});
 const auto=Object.keys(cnt).filter(id=>!pin.includes(id)&&(p=>p&&p.active&&!p.archived&&p.id!=='p_envio')(prod(id))).sort((a,b)=>cnt[b]-cnt[a]);
 return {ids:pin.concat(auto).slice(0,12),pin};}
function posTopHTML(){const T=posTopIds();if(!T.ids.length&&!can('config'))return'';
 return `<div class="pt-h"><b>⚡ Más vendidos</b><span class="sm mut sp">${T.pin.length?'fijados y ':''}últimos 30 días</span>${can('config')?'<button class="btn sm" data-act="posTopEdit">★ Fijar</button>':''}</div>`
 +(T.ids.length?`<div class="pt-l">${T.ids.map(id=>{const p=prod(id);const off=stockOf(p)<=0&&!canOver(p);
  return `<button type="button" class="pt-b" data-act="padd" data-id="${p.id}" ${off?'disabled':''} aria-label="Agregar ${esc(pfull(p))}, ${money(p.price)}">${T.pin.includes(id)?'<span class="pt-pin" aria-hidden="true">★</span>':''}${p.img?`<img src="${esc(p.img)}" alt="" loading="lazy" decoding="async">`:'<span class="pt-ni" aria-hidden="true">🛒</span>'}<b>${esc(pfull(p))}</b><span class="pt-p">${money(p.price)}</span></button>`;}).join('')}</div>`
 :'<p class="sm mut" style="margin:0">Todavía no hay ventas en los últimos 30 días: fijá tus productos más pedidos con «★ Fijar».</p>');}
function posV3After(){document.body.classList.add('pos3-on');const v=$('#view');if(v)v.classList.add('pos3');
 const tp=$('#top');document.documentElement.style.setProperty('--pos3-top',(tp&&getComputedStyle(tp).position.match(/fixed|sticky/)?tp.offsetHeight:0)+'px');
 const g=$('#pgrid');if(!g)return;let box=$('#pos-top');const show=!pos.q.trim()&&!pos.rub;
 if(show){if(!box){box=document.createElement('div');box.id='pos-top';g.parentNode.insertBefore(box,g);}box.innerHTML=posTopHTML();}else if(box)box.remove();
 const imgs=new Map();$$('#pgrid .pbtn[data-id]').forEach(b=>{if(b.dataset.p3)return;b.dataset.p3='1';const p=prod(b.dataset.id);if(!p)return;
  if(p.img){const im=document.createElement('img');im.className='p3-img';im.alt='';im.loading='lazy';im.decoding='async';im.src=p.img;b.insertBefore(im,b.firstChild);}
  const pr=document.createElement('span');pr.className='p3-pr';pr.textContent=money(p.price)+(p.unit!=='u'?' / '+unitLbl(p.unit):'');const nm=b.querySelector('b');if(nm)nm.insertAdjacentElement('afterend',pr);});}
function posV3Bar(){let b=$('#pos-mbar');if(curScreen!=='vender'){document.body.classList.remove('pos3-on','pos3-lines');return;}
 if(!b){b=document.createElement('div');b.id='pos-mbar';b.setAttribute('role','region');b.setAttribute('aria-label','Total del ticket');document.body.appendChild(b);
  b.addEventListener('click',e=>{if(!e.target.closest('button'))return;const c=$('#pcart');if(c)c.scrollIntoView({behavior:'smooth',block:'start'});});}
 const n=pos.lines.reduce((s,l)=>s+(l.unit==='u'?+l.qty||0:1),0);document.body.classList.toggle('pos3-lines',pos.lines.length>0);
 b.innerHTML=`<div class="mb-t">${numAR(n,0)} artículo${n===1?'':'s'}<b>${money(posTotal())}</b></div><button type="button">Ver ticket y cobrar ›</button>`;}
{const _pg=posGrid;posGrid=function(){const r=_pg.apply(this,arguments);try{posV3After();}catch(e){}return r;};
 const _pc=posCart;posCart=function(){const r=_pc.apply(this,arguments);try{posV3Bar();}catch(e){}return r;};
 const _pa=A.padd;A.padd=function(el){const r=_pa.apply(this,arguments);try{const id=el&&el.dataset&&el.dataset.id;$$('[data-act="padd"][data-id="'+id+'"]').forEach(x=>{x.classList.remove('p3-hit');void x.offsetWidth;x.classList.add('p3-hit');setTimeout(()=>x.classList.remove('p3-hit'),450);});}catch(e){}return r;};
 if(!document.getElementById('pos3-css')){const st=document.createElement('style');st.id='pos3-css';st.textContent=POS3_CSS;document.head.appendChild(st);}
 if(typeof showPanel==='function'){const _sp=showPanel;showPanel=function(){const r=_sp.apply(this,arguments);try{if(curScreen!=='vender')document.body.classList.remove('pos3-on','pos3-lines');}catch(e){}return r;};}}
/* fijar «Más vendidos» (permiso de configuración) */
A.posTopEdit=()=>{if(!can('config'))return toast('Sin permiso',1);let sel=(S.cfg.posTop||[]).slice();
 const list=q=>S.products.filter(p=>p.active&&!p.archived&&p.id!=='p_envio').filter(p=>!q||norm(pfull(p)+' '+(p.barcode||'')).includes(norm(q))).slice(0,40);
 const rows=q=>list(q).map(p=>`<label class="chk"><input type="checkbox" class="ptp" value="${p.id}" ${sel.includes(p.id)?'checked':''}> ${esc(pfull(p))} · ${money(p.price)}</label>`).join('')||'<p class="mut">Sin resultados.</p>';
 const w=modal('Fijar en «Más vendidos»',`<p class="sm mut">Los fijados aparecen primero (hasta 12). El resto se completa solo con lo más vendido de los últimos 30 días.</p><label for="ptp-q">Buscar producto</label><input id="ptp-q" autocomplete="off"><div id="ptp-l" style="max-height:50vh;overflow:auto;margin-top:.5rem">${rows('')}</div><p class="sm" id="ptp-n">${sel.length} fijado(s)</p>`,
  {okText:'Guardar',onOk:()=>{S.cfg.posTop=sel.slice(0,12);audit('POS_MAS_VENDIDOS',S.cfg.posTop.length+' fijados');save();posGrid();toast('Listo');}});
 const L=w.querySelector('#ptp-l'),Q=w.querySelector('#ptp-q'),N=w.querySelector('#ptp-n');
 Q.addEventListener('input',()=>{L.innerHTML=rows(Q.value.trim());});
 L.addEventListener('change',e=>{const c=e.target.closest('.ptp');if(!c)return;if(c.checked){if(sel.length>=12){c.checked=false;return toast('Máximo 12 fijados',1);}sel.push(c.value);}else sel=sel.filter(x=>x!==c.value);N.textContent=sel.length+' fijado(s)';});};
