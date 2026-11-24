/* ===== V27.31 · Launch pad: todo el sistema a un toque (arriba de «Resumen» en la barra lateral) =====
   · Buscador que filtra mientras escribís (tolerante a tildes), accesos rápidos a lo más usado del día,
     favoritos fijados por cada usuario (estrella) y «Recientes» (las últimas pantallas que abriste).
   · Muestra SÓLO lo que el usuario puede usar: mismas reglas que la barra lateral (permisos, módulos encendidos y modo mostrador).
   · Usa el kit común (uiHead, uiBadge, uiEmpty) y los avisos de la barra (uxBadges): pedidos sin aceptar, stock bajo, etc.
   · Favoritos y recientes se guardan en este equipo, por usuario (no viajan a la nube ni a la auditoría). */
IC.grid='M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z';
IC.star='M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';
NAV.unshift(['launch','Resumen']);UX_SEC_OF.launch='Resumen';UX_TITLE.launch='Launch pad';if(!UX_COMPACT_OK.includes('launch'))UX_COMPACT_OK.push('launch');
UX_DESC.launch='Todo el sistema a un toque.';
/* íconos: los mismos SVG de la barra lateral, para que todo el sistema hable el mismo idioma visual */
const lpKey=t=>'rave.lp.'+t+'.'+(user?String(user.id||user.name):'');
const lpGet=t=>{try{const v=JSON.parse(localStorage.getItem(lpKey(t))||'[]');return Array.isArray(v)?v:[];}catch(e){return[];}};
const lpSet=(t,v)=>{try{localStorage.setItem(lpKey(t),JSON.stringify(v));}catch(e){}};
let lpQ='';
/* lista de entradas visibles: igual que la barra lateral (los grupos de Caja y Club son una sola entrada) */
function lpEntries(){const order=NAV.map(x=>x[0]);const secOf=Object.fromEntries(NAV);const comp=uxCompact();const seen=new Set();const out=[];
 Object.keys(SCREENS).filter(k=>k!=='launch'&&uxVis(k)).sort((a,b)=>{const i=order.indexOf(a),j=order.indexOf(b);return (i<0?99:i)-(j<0?99:j);}).forEach(k=>{
  if(comp&&!UX_COMPACT_OK.includes(k))return;const g=uxGroupOf(k);
  if(g){if(seen.has(g))return;seen.add(g);const it=uxGroupItems(g);if(!it.length)return;out.push({id:it[0][0],key:g,t:UX_GROUPS[g].t(),d:it.map(x=>x[1]).join(' · '),ic:ico(UX_GROUPS[g].icon),sec:uxSecOf(k,secOf)});return;}
  const s=SCREENS[k];out.push({id:k,key:k,t:UX_TITLE[k]||s.t,d:UX_DESC[k]||'',ic:ico(s.icon),sec:k==='vender'?'Operación comercial':uxSecOf(k,secOf)});});
 return out;}
function lpTile(e,fav){const b=typeof uxEntryBadge==='function'?uxEntryBadge(e.key):null;
 return `<div class="lp-tile" data-lp="${esc(e.key)}"><button type="button" class="lp-go" data-act="nav" data-id="${esc(e.id)}"><span class="lp-ic" aria-hidden="true">${e.ic}</span><span class="lp-tx"><b>${esc(e.t)}</b>${e.d?`<small>${esc(e.d)}</small>`:''}</span>${b?`<span class="lp-bd">${uxBadgeHTML(b)}</span>`:''}</button>
 <button type="button" class="lp-star${fav?' on':''}" data-act="lpFav" data-k="${esc(e.key)}" aria-pressed="${fav}" aria-label="${fav?'Quitar de favoritos':'Fijar en favoritos'}: ${esc(e.t)}" title="${fav?'Quitar de favoritos':'Fijar en favoritos'}">${fav?'★':'☆'}</button></div>`;}
function lpQuick(){const q=[];const v=k=>uxVis(k);
 if(v('vender'))q.push({t:'Vender',ic:'🛒',act:'nav',attrs:'data-id="vender"',k:'F1'});
 if(v('caja'))q.push({t:typeof openSess==='function'&&openSess()?'Caja abierta':'Abrir caja',ic:'💵',act:'nav',attrs:'data-id="caja"'});
 if(v('inventario')&&can('edit_products'))q.push({t:'Nuevo producto',ic:'📦',act:'lpNewProd'});
 if(v('crm'))q.push({t:'Nueva conversación',ic:'💬',act:'lpNewConv'});
 if(v('clientes'))q.push({t:'Clientes',ic:'👥',act:'nav',attrs:'data-id="clientes"'});
 q.push({t:'Buscar en todo',ic:'🔎',act:'lpSearchAll',k:'Ctrl K'});
 return `<div class="lp-quick">${q.map(x=>`<button type="button" class="lp-q" data-act="${x.act}" ${x.attrs||''}><span aria-hidden="true">${x.ic}</span>${esc(x.t)}${x.k?`<kbd>${x.k}</kbd>`:''}</button>`).join('')}</div>`;}
function lpBody(){const E=lpEntries();const fav=lpGet('fav');const rec=lpGet('rec');const q=uxN(lpQ).trim();
 const isFav=e=>fav.includes(e.key);
 if(q){const L=E.map(e=>({e,s:uxScore(q,e.t+' '+e.d+' '+e.sec)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.e);
  return L.length?uiSec('Resultados',L.length+' '+(L.length===1?'pantalla':'pantallas'),`<div class="lp-grid">${L.map(e=>lpTile(e,isFav(e))).join('')}</div>`)
   :uiEmpty('🔎','No encontré «'+lpQ+'»','Probá con otra palabra, o buscá clientes y artículos con <b>Ctrl + K</b>.',{t:'Buscar en todo',act:'lpSearchAll'});}
 let h='';
 const F=fav.map(k=>E.find(e=>e.key===k)).filter(Boolean);
 h+=uiSec('Favoritos',F.length?'Tocá ☆ en cualquier acceso para fijarlo acá.':'',F.length?`<div class="lp-grid">${F.map(e=>lpTile(e,true)).join('')}</div>`:'<p class="sm mut lp-hint">Tocá la estrella ☆ de cualquier acceso para tenerlo siempre a mano acá.</p>');
 const R=rec.map(k=>E.find(e=>e.key===k||e.id===k)).filter((e,i,a)=>e&&a.indexOf(e)===i&&!fav.includes(e.key)).slice(0,6);
 if(R.length)h+=uiSec('Recientes','',`<div class="lp-grid lp-rec">${R.map(e=>lpTile(e,false)).join('')}</div>`);
 const secs=[];E.forEach(e=>{let s=secs.find(x=>x.n===e.sec);if(!s){s={n:e.sec,L:[]};secs.push(s);}s.L.push(e);});
 secs.sort((a,b)=>{const x=UX_SEC_ORDER.indexOf(a.n),y=UX_SEC_ORDER.indexOf(b.n);return (x<0?98:x)-(y<0?98:y);});
 secs.forEach(s=>{h+=uiSec(s.n==='Resumen'?'Visión general':uxSecName(s.n),'',`<div class="lp-grid">${s.L.map(e=>lpTile(e,isFav(e))).join('')}</div>`);});
 return h;}
reg('launch','Launch pad','grid',null,()=>{const nm=user?String(user.name||'').split(/\s+/)[0]:'';const h=new Date().getHours();const sal=h<12?'Buen día':h<20?'Buenas tardes':'Buenas noches';
 return `${uiHead({t:'Launch pad',sub:esc(sal+(nm?', '+nm:''))+'. Todo el sistema a un toque: buscá, fijá tus favoritos y retomá donde dejaste.'})}
 <div class="lp-search"><span aria-hidden="true">🔎</span><label for="lp-q" class="sr">Buscar una función</label><input id="lp-q" type="search" placeholder="¿Qué querés hacer? (ej.: arqueo, etiquetas, proveedores)" value="${esc(lpQ)}" autocomplete="off"></div>
 ${lpQuick()}<div id="lp-body">${lpBody()}</div>
 <style>.lp-search{display:flex;align-items:center;gap:.5rem;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:.2rem .8rem;margin:0 0 .8rem}.lp-search input{flex:1;border:0;background:transparent;font-size:1rem;min-height:46px;outline:none;color:inherit}.lp-search:focus-within{border-color:var(--gold);box-shadow:0 0 0 3px rgba(201,150,62,.2)}
 .sr{position:absolute;left:-9999px}.lp-quick{display:flex;gap:.5rem;flex-wrap:wrap;margin:0 0 1.2rem}.lp-q{display:inline-flex;align-items:center;gap:.45rem;min-height:44px;padding:.45rem .85rem;border-radius:999px;border:1px solid var(--line);background:var(--card);font:inherit;font-weight:600;color:inherit;cursor:pointer}.lp-q:hover{border-color:var(--gold)}.lp-q kbd{font-size:.7rem;color:var(--mut);border:1px solid var(--line);border-radius:6px;padding:0 .3rem}
 .lp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:.6rem}.lp-tile{position:relative;display:flex;align-items:stretch;background:var(--card);border:1px solid var(--line);border-radius:14px;transition:border-color .15s,transform .15s}.lp-tile:hover{border-color:var(--gold);transform:translateY(-1px)}
 .lp-go{flex:1;min-width:0;display:flex;gap:.7rem;align-items:flex-start;text-align:left;background:none;border:0;padding:.8rem .5rem .8rem .8rem;font:inherit;color:inherit;cursor:pointer;border-radius:14px}.lp-go:focus-visible{outline:3px solid var(--gold);outline-offset:-3px}
 .lp-ic{width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:12px;background:var(--bg);color:var(--gold)}.lp-ic svg{width:22px;height:22px}.lp-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:.15rem}.lp-tx b{font-size:.98rem}.lp-tx small{color:var(--mut);font-size:.8rem;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 .lp-bd{flex:none}.lp-star{flex:none;width:44px;background:none;border:0;border-left:1px solid var(--line);font-size:1.15rem;color:var(--mut);cursor:pointer;border-radius:0 14px 14px 0}.lp-star.on{color:var(--gold)}.lp-star:hover{color:var(--gold)}.lp-hint{margin:.1rem 0 0}
 @media(max-width:640px){.lp-grid{grid-template-columns:1fr}.lp-quick{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.lp-q{flex:none}}</style>`;},
 ()=>{const i=$('#lp-q');if(!i)return;i.addEventListener('input',()=>{lpQ=i.value;const b=$('#lp-body');if(b)b.innerHTML=lpBody();});
  i.addEventListener('keydown',e=>{if(e.key==='Enter'){const f=$('#lp-body .lp-go');if(f){e.preventDefault();f.click();}}else if(e.key==='Escape'&&i.value){i.value='';lpQ='';$('#lp-body').innerHTML=lpBody();}});});
A.lpFav=el=>{const k=el.dataset.k;let f=lpGet('fav');f=f.includes(k)?f.filter(x=>x!==k):f.concat(k).slice(-24);lpSet('fav',f);const b=$('#lp-body');if(b)b.innerHTML=lpBody();
 const n=$(`#lp-body .lp-star[data-k="${CSS.escape(k)}"]`);if(n)n.focus();};
A.lpSearchAll=()=>{if(typeof A.uxSearch==='function')A.uxSearch();else{const e=new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true});document.dispatchEvent(e);}};
A.lpNewProd=()=>{go('inventario');setTimeout(()=>{if(typeof A.pedit==='function')A.pedit({dataset:{}});},120);};
A.lpNewConv=()=>{go('crm');setTimeout(()=>{if(typeof A.crmNewBtn==='function')A.crmNewBtn();},150);};
/* V27.31: el Launch pad es para quien maneja el sistema (ve el Resumen o tiene varias pantallas), nunca es la pantalla de inicio
   y no reemplaza el portal del empleado */
SCREENS.launch.show=()=>{try{if(!user)return false;if(SCREENS.dashboard&&can('dashboard'))return true;return Object.keys(SCREENS).filter(k=>k!=='launch'&&k!=='portal'&&uxVis(k)).length>=4;}catch(e){return false;}};
{const _hs=homeScreen;homeScreen=function(){const r=_hs.apply(this,arguments);if(r!=='launch')return r;const f=NAV.map(x=>x[0]).find(k=>k!=='launch'&&scrOk(k))||Object.keys(SCREENS).find(k=>k!=='launch'&&scrOk(k));return f||'inicio';};}
/* recientes: cada pantalla que se abre (salvo el propio Launch pad) */
{const _sp=showPanel;showPanel=function(id){const r=_sp.apply(this,arguments);try{if(user&&curScreen&&curScreen!=='launch'){const L=lpGet('rec').filter(x=>x!==curScreen);L.unshift(curScreen);lpSet('rec',L.slice(0,10));}}catch(e){}return r;};}
