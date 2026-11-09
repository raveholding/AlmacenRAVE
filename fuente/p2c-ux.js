/* ===== V26.61 · Experiencia de uso: pestañas, modo mostrador, buscador universal (Ctrl + K), avisos en la barra y atajos =====
   Pedido del dueño (prompt «rediseño UX»), adaptado a este sistema (HTML único + JavaScript; no se cambia de framework):
   · Pestañas horizontales: «Gestión de caja» (Caja actual · Cajas y sucursales · Arqueo / cierre · Historial cerrado) y
     «Club» (Clientes · Sellos · Niveles y cumpleaños · Monedero · Cupones y membresías). En la barra lateral es UNA entrada.
     Las rutas de siempre (#panel/caja, #panel/arqueo…) siguen funcionando.
   · Modo mostrador: los roles mostrador y operador ven sólo lo del mostrador (Vender, Pedidos, Gestión de caja y, si tienen
     el permiso, Club, Conversaciones y Tareas). Es una simplificación de la pantalla: los permisos los sigue validando el sistema.
   · Ctrl + K (o el botón «Buscar»): clientes, artículos (nombre, código de barras, PLU) y pantallas, tolerante a errores de tipeo.
   · Avisos en la barra: pedidos PedidosYa recibidos (rojo, titila), stock bajo o negativo (amarillo), conversaciones sin
     responder (rojo), cobros a conciliar / caja de días anteriores (amarillo). Se actualizan solos cada 5 s.
   · F1 lleva a Vender desde cualquier pantalla (dentro de Vender, F1 sigue siendo Efectivo). La tecla está impresa en la barra. */
const UX_GROUPS={
 caja:{t:()=>'Gestión de caja',icon:'cash',items:[['caja','Caja actual'],['cajasx','Cajas y sucursales'],['arqueo','Arqueo / cierre'],['cierres','Historial cerrado']]},
 club:{t:()=>IS_CLIENT?'Club RAVE':'Club de clientes',icon:'users',items:[['clientes','Clientes'],['fidel','Sellos'],['fidplus','Niveles y cumpleaños'],['monedero','Monedero'],['cupones','Cupones y membresías']]}};
const uxGroupOf=id=>Object.keys(UX_GROUPS).find(g=>UX_GROUPS[g].items.some(x=>x[0]===id))||'';
const uxVis=id=>{const s=SCREENS[id];return !!s&&(!s.perm||can(s.perm))&&(!s.show||s.show());};
const uxGroupItems=g=>UX_GROUPS[g].items.filter(([k])=>uxVis(k));
const UX_COMPACT_OK=['vender','pedidos','caja','cajasx','arqueo','cierres','clientes','fidel','fidplus','monedero','cupones','crm','tareas'];
function uxCompact(){if(!user)return false;const r=String(user.role||'');if(r==='admin'||r==='supervisor')return false;return !(S.cfg&&S.cfg.ux&&S.cfg.ux.fullNav);}
let uxLast={};
function uxBadges(){const b={};const t=now();
 try{const n=(S.pya||[]).filter(o=>o.status==='recibido').length;if(n)b.pedidos={n,c:'red',pulse:1,t:n+' pedido(s) PedidosYa sin aceptar'};}catch(e){}
 try{if(can('edit_products')||can('sell')){const L=S.products.filter(p=>p.active&&!p.archived&&!p.noStock&&stockOf(p)<=5);const neg=L.filter(p=>stockOf(p)<0).length;if(L.length)b.inventario={n:L.length,c:neg?'red':'amber',t:L.length+' artículo(s) con stock bajo'+(neg?' ('+neg+' en negativo)':'')};}}catch(e){}
 try{if(typeof convs==='function'&&typeof crmCfg==='function'&&crmCfg().on){const n=convs().filter(c=>c.state!=='resuelta'&&c.unread).length;if(n)b.crm={n,c:'red',pulse:1,t:n+' conversación(es) sin responder'};}}catch(e){}
 try{const old=(S.sessions||[]).filter(s=>!s.closedAt&&!s.closed&&s.openedAt&&dkey(s.openedAt)<dkey(t)).length;if(old)b.caja={n:old,c:'amber',t:'Caja abierta de un día anterior'};}catch(e){}
 try{if(typeof quotes==='function'){const n=quotes().filter(q=>qtState(q)==='vigente'&&q.exp-t<2*864e5).length;if(n)b.presup={n,c:'amber',t:n+' presupuesto(s) por vencer'};}}catch(e){}
 return b;}
function uxBadgeHTML(x){return x?`<span class="ux-bd ${x.c}${x.pulse?' pulse':''}" title="${esc(x.t)}" aria-label="${esc(x.t)}">${x.n>99?'99+':x.n}</span>`:'';}
function uxEntryBadge(k){const B=uxLast;const g=UX_GROUPS[k];if(!g)return B[k];
 const L=g.items.map(([i])=>B[i]).filter(Boolean);if(!L.length)return null;const n=L.reduce((a,x)=>a+x.n,0);return{n,c:L.some(x=>x.c==='red')?'red':'amber',pulse:L.some(x=>x.pulse),t:L.map(x=>x.t).join(' · ')};}
/* barra lateral: agrupa, filtra en modo mostrador y agrega avisos y atajos */
function uxSideHTML(nav,id,secOf){uxLast=uxBadges();const comp=uxCompact();let sec='';const seen=new Set();let h='';
 for(const [k,s] of nav){if(comp&&!UX_COMPACT_OK.includes(k))continue;const g=uxGroupOf(k);let key=k,title=s.t,icon=s.icon,target=k,on=k===id;
  if(g){if(seen.has(g))continue;seen.add(g);const items=uxGroupItems(g).filter(([i])=>!comp||UX_COMPACT_OK.includes(i));if(!items.length)continue;key=g;title=UX_GROUPS[g].t();icon=UX_GROUPS[g].icon;
   target=items.some(([i])=>i===id)?id:items[0][0];on=items.some(([i])=>i===id);}
  const sc=comp?'Mostrador':(secOf[k]||'Otros');if(sc!==sec){sec=sc;h+=`<div class="sec">${esc(sc)}</div>`;}
  const kb=k==='vender'?'<kbd class="ux-kbd" aria-hidden="true">F1</kbd>':'';
  h+=`<a data-act="nav" data-id="${target}" data-ux="${key}" class="${on?'on':''}${k==='vender'?' ux-pos':''}" tabindex="0" role="link"${k==='vender'?' aria-keyshortcuts="F1"':''}>${ico(icon)}<span class="sp">${esc(title)}</span>${kb}<span class="ux-bdw">${uxBadgeHTML(uxEntryBadge(key))}</span></a>`;}
 if(comp)h+=`<div class="sm" style="padding:.5rem .7rem;color:#a99f8f">Modo mostrador: se ven sólo las tareas del mostrador. Buscá cualquier otra cosa con <b>Ctrl + K</b>.</div>`;
 return h;}
setInterval(()=>{try{if(!user||!$('#side')||$('#panel').hidden)return;const B=uxBadges();if(JSON.stringify(B)===JSON.stringify(uxLast))return;uxLast=B;
 $$('#side a[data-ux]').forEach(a=>{const w=a.querySelector('.ux-bdw');if(w)w.innerHTML=uxBadgeHTML(uxEntryBadge(a.dataset.ux));});}catch(e){}},5000);
/* pestañas arriba de cada pantalla agrupada */
function uxTabs(id){const g=uxGroupOf(id);if(!g)return'';const items=uxGroupItems(g).filter(([i])=>!uxCompact()||UX_COMPACT_OK.includes(i));if(items.length<2)return'';
 return `<div class="ux-tabs" role="tablist" aria-label="${esc(UX_GROUPS[g].t())}">${items.map(([k,t])=>`<a role="tab" data-act="nav" data-id="${k}" tabindex="0" aria-selected="${k===id}" class="${k===id?'on':''}">${esc(t)}${uxBadgeHTML(uxLast[k])}</a>`).join('')}</div>`;}
function uxAfter(id){const t=uxTabs(id);if(t){$('#view').insertAdjacentHTML('afterbegin',t);}}
document.addEventListener('keydown',e=>{const a=e.target.closest&&e.target.closest('.ux-tabs a');if(!a)return;
 if(e.key==='Enter'||e.key===' '){e.preventDefault();A.nav(a);return;}
 if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const L=[...a.parentNode.querySelectorAll('a')];const i=L.indexOf(a);const n=L[(i+(e.key==='ArrowRight'?1:-1)+L.length)%L.length];n.focus();}});
/* atajo F1 → Vender (fuera de Vender) */
document.addEventListener('keydown',e=>{if(e.key!=='F1'||!user||$('#panel').hidden||curScreen==='vender'||$('#modal-root .ov')||!uxVis('vender'))return;e.preventDefault();go('vender');});

/* ---------- buscador universal (Ctrl + K) ---------- */
const uxN=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function uxLev1(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,d=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++d>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}}return d+(a.length-i)+(b.length-j)<=1;}
function uxScore(q,text){const t=uxN(text);if(!q)return 0;const i=t.indexOf(q);if(i>=0)return 100-Math.min(i,40)+(i===0?20:0);
 const qs=q.split(/\s+/).filter(Boolean);const ws=t.split(/[^a-z0-9]+/).filter(Boolean);
 if(qs.length&&qs.every(x=>ws.some(w=>w.startsWith(x)||(x.length>=4&&(uxLev1(x,w)||uxLev1(x,w.slice(0,x.length)))))))return 60;
 let p=0,gaps=0;for(const ch of q.replace(/\s+/g,'')){const k=t.indexOf(ch,p);if(k<0)return 0;gaps+=k-p;p=k+1;}return gaps<=q.length*2?Math.max(1,40-gaps):0;}
function uxIndex(){const out=[];const comp=uxCompact();
 Object.entries(SCREENS).forEach(([k,s])=>{if(!uxVis(k))return;const g=uxGroupOf(k);const tab=g?(UX_GROUPS[g].items.find(x=>x[0]===k)||[])[1]:'';
  out.push({k:'p',id:k,t:g?UX_GROUPS[g].t()+' › '+tab:s.t,s:'Pantalla',x:s.t+' '+(tab||'')+' '+(g?UX_GROUPS[g].t():''),ic:'🧭',hidden:comp&&!UX_COMPACT_OK.includes(k)});});
 if(can('customers'))S.customers.filter(c=>c.status!=='baja').forEach(c=>out.push({k:'c',id:c.id,t:custFull(c),s:'Cliente · N.º '+pad4(c.num),x:custFull(c)+' '+pad4(c.num)+' '+(c.dni||'')+' '+String(c.wa||'').replace(/\D/g,'').slice(-10),ic:'👤'}));
 if(can('sell')||can('edit_products'))S.products.filter(p=>!p.archived).forEach(p=>out.push({k:'a',id:p.id,t:p.name+(p.sub?' '+p.sub:''),s:'Artículo · '+money(p.price)+(p.barcode?' · '+p.barcode:'')+(p.active?'':' · inactivo'),x:p.name+' '+(p.sub||'')+' '+(p.barcode||'')+' '+(p.plu||'')+' '+((p.pres||[]).map(x=>x.barcode||'').join(' ')),ic:'📦',code:p.barcode||''}));
 return out;}
function uxSearch(q){q=uxN(q).trim();const I=uxIndex();if(!q)return I.filter(x=>x.k==='p').slice(0,8);
 const digits=/^\d{4,}$/.test(q);
 return I.map(x=>{let sc=uxScore(q,x.x);if(digits&&x.k==='a'){if(x.code===q||(' '+uxN(x.x)+' ').includes(' '+q+' '))sc+=300;else if(uxN(x.x).includes(q))sc+=100;}if(x.k==='p')sc+=5;return{x,sc};}).filter(r=>r.sc>=30).sort((a,b)=>b.sc-a.sc).slice(0,12).map(r=>r.x);}
let uxPal=null;
function uxOpen(){if(!user||$('#panel').hidden)return;if(uxPal){uxPal.querySelector('input').focus();return;}
 const w=document.createElement('div');w.className='ux-pal-ov';w.innerHTML=`<div class="ux-pal" role="dialog" aria-modal="true" aria-label="Buscador universal">
  <input id="ux-q" role="combobox" aria-expanded="true" aria-controls="ux-res" aria-autocomplete="list" placeholder="Buscar cliente, artículo, código de barras o pantalla…" autocomplete="off" spellcheck="false">
  <div id="ux-res" role="listbox" aria-label="Resultados"></div><p class="sm mut" style="margin:.4rem .2rem 0">↑ ↓ para elegir · Enter para abrir · Esc para cerrar</p></div>`;
 document.body.appendChild(w);uxPal=w;let sel=0,res=[];const inp=w.querySelector('input'),box=w.querySelector('#ux-res');
 const paint=()=>{res=uxSearch(inp.value);if(sel>=res.length)sel=0;box.innerHTML=res.length?res.map((r,i)=>`<div role="option" id="ux-o${i}" aria-selected="${i===sel}" class="ux-it${i===sel?' on':''}" data-i="${i}"><span aria-hidden="true">${r.ic}</span><span class="sp"><b>${esc(r.t)}</b><br><span class="sm mut">${esc(r.s)}${r.hidden?' · fuera del modo mostrador':''}</span></span></div>`).join(''):'<p class="sm mut" style="padding:.6rem">Sin resultados.</p>';
  inp.setAttribute('aria-activedescendant',res.length?'ux-o'+sel:'');const o=box.querySelector('.on');if(o)o.scrollIntoView({block:'nearest'});};
 const pick=i=>{const r=res[i];if(!r)return;uxClose();uxGo(r);};
 inp.addEventListener('input',()=>{sel=0;paint();});
 inp.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(res.length-1,sel+1);paint();}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);paint();}
  else if(e.key==='Enter'){e.preventDefault();pick(sel);}else if(e.key==='Escape'){e.preventDefault();uxClose();}});
 box.addEventListener('click',e=>{const o=e.target.closest('[data-i]');if(o)pick(+o.dataset.i);});
 w.addEventListener('mousedown',e=>{if(e.target===w)uxClose();});paint();inp.focus();}
function uxClose(){if(uxPal){uxPal.remove();uxPal=null;}}
function uxGo(r){if(r.k==='p'){go(r.id);return;}
 if(r.k==='c'){go('clientes');setTimeout(()=>{try{A.cuEdit({dataset:{id:r.id}});}catch(e){}},150);return;}
 if(r.k==='a'){if(uxVis('vender')){go('vender');setTimeout(()=>{try{A.padd({dataset:{id:r.id}});}catch(e){}},150);}else{go('inventario');}}}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==='k'||e.key==='K')){if(!user||$('#panel').hidden)return;e.preventDefault();uxPal?uxClose():uxOpen();}});
A.uxSearch=()=>uxOpen();
const uxSearchBtn=()=>`<button class="btn sm" data-act="uxSearch" aria-keyshortcuts="Control+K" title="Buscador universal (Ctrl + K)" aria-label="Buscar (Ctrl + K)">🔍<kbd class="ux-kbd">Ctrl K</kbd></button>`;
