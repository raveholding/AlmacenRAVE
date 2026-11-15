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
 try{if(typeof convs==='function'&&typeof crmCfg==='function'&&crmCfg().on){const n=convs().filter(c=>c.state!=='cerrado'&&c.state!=='resuelta'&&c.unread).length;if(n)b.crm={n,c:'red',pulse:1,t:n+' conversación(es) sin responder'};}}catch(e){}
 try{const old=(S.sessions||[]).filter(s=>!s.closedAt&&!s.closed&&s.openedAt&&dkey(s.openedAt)<dkey(t)).length;if(old)b.caja={n:old,c:'amber',t:'Caja abierta de un día anterior'};}catch(e){}
 try{if(typeof quotes==='function'){const n=quotes().filter(q=>qtState(q)==='vigente'&&q.exp-t<2*864e5).length;if(n)b.presup={n,c:'amber',t:n+' presupuesto(s) por vencer'};}}catch(e){}
 return b;}
function uxBadgeHTML(x){return x?`<span class="ux-bd ${x.c}${x.pulse?' pulse':''}" title="${esc(x.t)}" aria-label="${esc(x.t)}">${x.n>99?'99+':x.n}</span>`:'';}
function uxEntryBadge(k){const B=uxLast;const g=UX_GROUPS[k];if(!g)return B[k];
 const L=g.items.map(([i])=>B[i]).filter(Boolean);if(!L.length)return null;const n=L.reduce((a,x)=>a+x.n,0);return{n,c:L.some(x=>x.c==='red')?'red':'amber',pulse:L.some(x=>x.pulse),t:L.map(x=>x.t).join(' · ')};}
/* barra lateral: agrupa, filtra en modo mostrador y agrega avisos y atajos */
/* V26.62 · barra lateral según el diseño aprobado: botón dorado «Vender POS» arriba y secciones plegables */
const UX_SEC_ORDER=['Resumen','Operación comercial','Logística e inventario','Clientes','Equipo','Menú y web','Sistema','Otros'];
const UX_SEC_OF={inicio:'Resumen',centro:'Resumen',pedidos:'Operación comercial',caja:'Operación comercial',cajasx:'Operación comercial',arqueo:'Operación comercial',cierres:'Operación comercial',
 inventario:'Logística e inventario',mermas:'Logística e inventario',presup:'Logística e inventario',proveedores:'Logística e inventario',
 clientes:'Clientes',fidel:'Clientes',fidplus:'Clientes',monedero:'Clientes',cupones:'Clientes',crm:'Clientes',personal:'Equipo',rrhh:'Equipo',portal:'Equipo',tareas:'Equipo',menuadmin:'Menú y web',legal:'Menú y web'};
const UX_TITLE={inventario:'Stock e inventario',pedidos:'PedidosYa',presup:'Presupuestos',proveedores:'Proveedores',mermas:'Mermas y devoluciones'};
const uxSecName=k=>k==='Clientes'?(IS_CLIENT?'Clientes y Club RAVE':'Clientes y fidelidad'):k;
const uxSecOf=(k,secOf)=>{if(UX_SEC_OF[k])return UX_SEC_OF[k];const n=secOf[k]||'Otros';return n==='Operación'?'Operación comercial':n==='Clientes y fidelización'?'Clientes':UX_SEC_ORDER.includes(n)?n:(n||'Otros');};
const uxFold=()=>{try{return JSON.parse(localStorage.getItem('rave.sidefold')||'[]');}catch(e){return[];}};
A.uxSec=el=>{const k=el.dataset.s;let f=uxFold();f=f.includes(k)?f.filter(x=>x!==k):f.concat(k);try{localStorage.setItem('rave.sidefold',JSON.stringify(f));}catch(e){}
 el.setAttribute('aria-expanded',!f.includes(k));const b=el.nextElementSibling;if(b)b.hidden=f.includes(k);};
function uxSideHTML(nav,id,secOf){uxLast=uxBadges();const comp=uxCompact();const seen=new Set();const ents=[];
 for(const [k,s] of nav){if(comp&&!UX_COMPACT_OK.includes(k))continue;const g=uxGroupOf(k);let key=k,title=UX_TITLE[k]||s.t,icon=s.icon,target=k,on=k===id;
  if(g){if(seen.has(g))continue;seen.add(g);const items=uxGroupItems(g).filter(([i])=>!comp||UX_COMPACT_OK.includes(i));if(!items.length)continue;key=g;title=UX_GROUPS[g].t();icon=UX_GROUPS[g].icon;
   target=items.some(([i])=>i===id)?id:items[0][0];on=items.some(([i])=>i===id);}
  ents.push({k,key,title,icon,target,on,sec:comp?'Mostrador':uxSecOf(k,secOf),i:ents.length});}
 const pos=ents.find(e=>e.k==='vender');let h='';
 if(pos)h+=`<a data-act="nav" data-id="vender" data-ux="vender" class="ux-pos-btn${pos.on?' on':''}" tabindex="0" role="link" aria-keyshortcuts="F1">${ico('cart')}<span class="sp">Vender POS</span><kbd class="ux-kbd" aria-hidden="true">F1</kbd><span class="ux-bdw">${uxBadgeHTML(uxEntryBadge('vender'))}</span></a>`;
 const rest=ents.filter(e=>e.k!=='vender').sort((a,b)=>{const x=UX_SEC_ORDER.indexOf(a.sec),y=UX_SEC_ORDER.indexOf(b.sec);return ((x<0?98:x)-(y<0?98:y))||(a.i-b.i);});
 const fold=uxFold();let cur=null;
 const close=()=>{if(cur!==null)h+='</div>';};
 for(const e of rest){if(e.sec!==cur){close();cur=e.sec;const open=!fold.includes(cur)||rest.some(x=>x.sec===cur&&x.on);const nm=uxSecName(cur);const sid='uxs-'+cur.replace(/[^a-z]/gi,'');
   if(cur==='Resumen'||cur==='Mostrador'){h+='<div class="ux-sec-b ux-sec-top">';}else
   h+=`<button type="button" class="ux-sec" data-act="uxSec" data-s="${esc(cur)}" aria-expanded="${open}" aria-controls="${sid}"><span class="sp">${esc(nm)}</span><span class="ux-chev" aria-hidden="true">▾</span></button><div class="ux-sec-b" id="${sid}" ${open?'':'hidden'}>`;}
  h+=`<a data-act="nav" data-id="${e.target}" data-ux="${e.key}" class="${e.on?'on':''}" tabindex="0" role="link">${ico(e.icon)}<span class="sp">${esc(e.title)}</span><span class="ux-bdw">${uxBadgeHTML(uxEntryBadge(e.key))}</span></a>`;}
 close();
 if(comp)h+=`<div class="sm" style="padding:.5rem .7rem;color:#a99f8f">Modo mostrador: se ven sólo las tareas del mostrador. Buscá cualquier otra cosa con <b>Ctrl + K</b>.</div>`;
 return h;}
setInterval(()=>{try{if(!user||!$('#side')||$('#panel').hidden)return;const B=uxBadges();if(JSON.stringify(B)===JSON.stringify(uxLast))return;uxLast=B;
 $$('#side a[data-ux]').forEach(a=>{const w=a.querySelector('.ux-bdw');if(w)w.innerHTML=uxBadgeHTML(uxEntryBadge(a.dataset.ux));});}catch(e){}},5000);
/* pestañas arriba de cada pantalla agrupada */
function uxTabs(id){const g=uxGroupOf(id);if(!g)return'';const items=uxGroupItems(g).filter(([i])=>!uxCompact()||UX_COMPACT_OK.includes(i));if(items.length<2)return'';
 return `<div class="ux-tabs" role="tablist" aria-label="${esc(UX_GROUPS[g].t())}">${items.map(([k,t])=>`<a role="tab" data-act="nav" data-id="${k}" tabindex="0" aria-selected="${k===id}" class="${k===id?'on':''}">${esc(t)}${uxBadgeHTML(uxLast[k])}</a>`).join('')}</div>`;}
function uxAfter(id){const t=uxTabs(id);if(t){$('#view').insertAdjacentHTML('afterbegin',t);}if(id==='inicio'&&!uxCompact()){try{const v=$('#view');const h=v.querySelector('h1');const x=uxTodayHTML();if(h&&h.closest('.row')&&h.closest('.row').parentNode===v)h.closest('.row').insertAdjacentHTML('afterend',x);else v.insertAdjacentHTML('afterbegin',x);}catch(e){}}}
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
const uxSearchBtn=()=>{const B=uxBadges();const n=Object.values(B).reduce((a,x)=>a+x.n,0);const red=Object.values(B).some(x=>x.c==='red');
 return `<button class="ux-search" data-act="uxSearch" aria-keyshortcuts="Control+K" title="Buscador universal (Ctrl + K)" aria-label="Búsqueda global (Ctrl + K)">🔍 <span class="ux-sph">Búsqueda global…</span><kbd class="ux-kbd">Ctrl K</kbd></button><button class="btn sm ux-bell" data-act="uxBell" aria-label="Avisos${n?' ('+n+')':''}" title="Avisos">🔔${n?`<span class="ux-bd ${red?'red':'amber'}">${n>99?'99+':n}</span>`:''}</button>`;};
A.uxBell=()=>{const B=uxBadges();const GO={pedidos:'pedidos',inventario:'inventario',crm:'crm',caja:'caja',presup:'presup'};const L=Object.entries(B);
 const extra=typeof crmAlerts==='function'&&typeof crmCfg==='function'&&crmCfg().on&&can('crm')?crmAlerts().slice(0,6):[];
 const w=modal('Avisos',(L.length?`<ul class="crm-al" style="list-style:none;padding:0">${L.map(([k,x])=>`<li style="display:flex;gap:.5rem;align-items:center;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--line)"><span>${uxBadgeHTML(x)} ${esc(x.t)}</span>${GO[k]&&uxVis(GO[k])?`<button class="btn sm" data-ux-go="${GO[k]}">Ver</button>`:''}</li>`).join('')}</ul>`:'<p class="mut">No hay avisos nuevos.</p>')
  +(extra.length?`<h4 style="margin:.8rem 0 .3rem">Alertas del ERP</h4><ul style="padding-left:1.1rem;margin:0">${extra.map(a=>`<li class="sm">${a.lv==='crit'?'⛔':'⚠️'} ${esc(a.t)}</li>`).join('')}</ul>`:''),{okText:'Cerrar'});
 w.addEventListener('click',e=>{const b=e.target.closest('[data-ux-go]');if(!b)return;w.remove();go(b.dataset.uxGo);});};

/* ---------- V26.62 · Resumen «Hoy» según el diseño aprobado: 4 indicadores, últimas ventas, tendencia semanal y proveedores ---------- */
function uxToday(){const t0=new Date(now());t0.setHours(0,0,0,0);const d0=t0.getTime(),dy=d0-864e5;const ok=s=>s.status==='ok';
 const sum=(a,b)=>S.sales.filter(s=>ok(s)&&s.ts>=a&&s.ts<b).reduce((x,s)=>x+(s.total||0),0);
 const hoy=sum(d0,d0+864e5),ayer=sum(dy,d0),pct=ayer>0?Math.round((hoy-ayer)/ayer*1000)/10:null;
 const pya=(S.pya||[]).filter(o=>o.status!=='entregado').length;const qv=(typeof quotes==='function'?quotes():[]).filter(q=>qtState(q)==='vigente').length;
 const pend=S.sales.filter(s=>ok(s)&&s.fiado&&s.pstate&&s.pstate!=='pagada').length;
 const low=S.products.filter(p=>p.active&&!p.archived&&stockOf(p)<=5).length;
 const days=[...Array(7)].map((_,i)=>d0-(6-i)*864e5);const wk=days.map(d=>sum(d,d+864e5)),prev=days.map(d=>sum(d-7*864e5,d-6*864e5));
 const last=S.sales.filter(ok).slice().sort((a,b)=>b.ts-a.ts).slice(0,7);
 const sup=(S.suppliers||[]).filter(x=>(+x.saldo||0)>0).sort((a,b)=>b.saldo-a.saldo).slice(0,5);
 return{hoy,ayer,pct,pya,orders:qv+pend+pya,low,days,wk,prev,last,sup,cv:can('view_cost')||can('purchases')};}
function uxSpark(days,a,b){const W=520,H=170,P=28;const mx=Math.max(1,...a,...b);const X=i=>P+i*(W-P*2)/(days.length-1),Y=v=>H-P-(v/mx)*(H-P*2);
 const path=arr=>arr.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
 const area=path(a)+` L ${X(a.length-1).toFixed(1)} ${H-P} L ${X(0).toFixed(1)} ${H-P} Z`;const wd=['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas de los últimos 7 días comparadas con la semana anterior" style="width:100%;height:auto">
 <defs><linearGradient id="uxg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--gold)" stop-opacity=".45"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></linearGradient></defs>
 ${[0,.5,1].map(f=>`<line x1="${P}" x2="${W-P}" y1="${(H-P-f*(H-P*2)).toFixed(1)}" y2="${(H-P-f*(H-P*2)).toFixed(1)}" stroke="var(--line)"/><text x="2" y="${(H-P-f*(H-P*2)+4).toFixed(1)}" font-size="10" fill="var(--mut)">${f?money(mx*f).replace(/,\d+$/,''):'$ 0'}</text>`).join('')}
 <path d="${area}" fill="url(#uxg)"/><path d="${path(b)}" fill="none" stroke="var(--mut)" stroke-width="2" stroke-dasharray="4 4"/><path d="${path(a)}" fill="none" stroke="var(--gold)" stroke-width="3"/>
 ${days.map((d,i)=>`<text x="${X(i).toFixed(1)}" y="${H-8}" font-size="11" text-anchor="middle" fill="var(--mut)">${wd[new Date(d).getDay()]}</text>`).join('')}</svg>`;}
function uxTodayHTML(){const T=uxToday();const st=s=>s.fiado&&s.pstate&&s.pstate!=='pagada'?'<span class="crm-st crm-st-w">Pendiente</span>':'<span class="crm-st crm-st-p">Completado</span>';
 return `<section class="ux-today" aria-label="Hoy"><div class="grid g4">
 <div class="card kpi ux-k"><span>Ventas hoy</span><b>${money(T.hoy)}</b><small>${T.pct==null?'sin ventas ayer para comparar':(T.pct>=0?'▲ +':'▼ ')+String(T.pct).replace('.',',')+' % vs. ayer'}</small></div>
 <div class="card kpi ux-k"><span>Órdenes abiertas</span><b>${T.orders}</b><small>presupuestos vigentes, ventas a cobrar y pedidos</small></div>
 <div class="card kpi ux-k"><span>Pedidos delivery (PedidosYa)</span><b>${T.pya}</b><small>en curso</small></div>
 <div class="card kpi ux-k"><span>Stock alerta</span><b style="color:${T.low?'var(--red)':'inherit'}">${T.low}</b><small>productos con 5 o menos</small></div></div>
 <div class="ux-today-g"><div class="card"><h3 style="margin-top:0">Últimas ventas (POS)</h3>${T.last.length?`<ul class="ux-last">${T.last.map(s=>`<li><span><b>Venta ${esc(s.n||'')}</b><br><span class="sm mut">${money(s.total||0)} · ${crmHm?crmHm(s.ts):dmy(dkey(s.ts))}</span></span>${st(s)}</li>`).join('')}</ul>`:'<p class="sm mut">Todavía no hay ventas.</p>'}</div>
 <div><div class="card"><h3 style="margin-top:0">Tendencia de ventas (semana)</h3>${uxSpark(T.days,T.wk,T.prev)}<p class="sm mut" style="margin:0">Línea de color: últimos 7 días · línea punteada: semana anterior.</p>
  <table class="sr-only" style="position:absolute;left:-9999px"><caption>Ventas por día</caption><tbody>${T.days.map((d,i)=>`<tr><th>${dmy(dkey(d))}</th><td>${money(T.wk[i])}</td><td>${money(T.prev[i])}</td></tr>`).join('')}</tbody></table></div>
 ${T.cv?`<div class="card" style="margin-top:.8rem"><h3 style="margin-top:0">Proveedores pendientes</h3>${T.sup.length?`<table><thead><tr><th>Proveedor</th><th>Saldo</th><th>Estado</th></tr></thead><tbody>${T.sup.map(x=>`<tr><td>${esc(x.razon||x.name||'')}</td><td>${money(x.saldo)}</td><td><span class="crm-st crm-st-w">Pendiente</span></td></tr>`).join('')}</tbody></table>`:'<p class="sm mut">No hay deudas con proveedores.</p>'}</div>`:''}</div></div></section>`;}

/* ---------- V26.63 · diseño dinámico e intuitivo en todos los módulos ----------
   · Cada pantalla abre con una línea que dice para qué sirve y qué conviene hacer primero (ayuda en contexto).
   · Gestión de caja con «tablero de turno»: estado de la caja, pasos del día (abrir → vender → movimientos → arqueo y cierre),
     indicadores en vivo y acciones grandes. Arqueo e Historial muestran el mismo recorrido.
   · Estilo general: tarjetas con relieve al pasar, tablas con encabezado fijo y filas alternadas, transición suave entre
     pantallas (respeta «reducir movimiento»), estados vacíos más claros. Todo con variables de la marca. */
const UX_DESC={inicio:'Cómo viene el negocio hoy: ventas, órdenes, stock y alertas. Tocá cualquier indicador para ir al detalle.',
 vender:'Cargá productos con el lector, la búsqueda o un toque, y cobrá con F12. Cada tecla de función está impresa en su botón.',
 pedidos:'Pedidos que entran por PedidosYa: aceptalos, preparalos y marcá la entrega.',
 caja:'Tablero del turno: abrí la caja, vendé, registrá ingresos y egresos, y terminá con el arqueo.',
 cajasx:'Cajas operativas, caja principal y sucursales. Traspasos de dinero con comprobante.',
 arqueo:'Contá el efectivo y los comprobantes, compará con lo esperado y cerrá el turno con el sello de integridad.',
 cierres:'Historial de cierres sellados: verificá la integridad, imprimí la planilla o exportá.',
 inventario:'Stock, precios y costos por categoría. Los avisos marcan lo que hay que reponer.',
 presup:'Cotizaciones que no mueven stock ni caja hasta que el cliente las acepta.',
 mermas:'Roturas, vencimientos y devoluciones valorizadas, con motivo y responsable.',
 proveedores:'Órdenes de compra, ingreso de mercadería y cuenta corriente con cada proveedor.',
 clientes:'Fichas de clientes con compras, saldo, datos para facturar y consentimientos.',
 fidel:'Sellos y premios del Club: sumá sellos por QR, código, DNI o NFC.',
 fidplus:'Niveles, cumpleaños, juegos y reglas de beneficios del Club.',
 monedero:'Saldo a favor, cashback y gift cards de cada cliente.',
 cupones:'Cupones y membresías con vigencia, tope y audiencia.',
 crm:'Todos los canales en una bandeja: respondé, cobrá, cotizá y agendá sin salir del chat.',
 personal:'Equipo, fichadas y horas trabajadas.',rrhh:'Legajos, fichaje omnicanal, turnos y licencias, reportes para el contador y —en el Plan Completo— nómina, aprobaciones, vacaciones, documentos y reclutamiento.',portal:'Tus fichadas, turnos, solicitudes, liquidaciones y avisos.',tareas:'Organigrama y tareas por puesto, diarias o semanales.',
 menuadmin:'Lo que ve tu cliente en el menú o la tienda: catálogo, textos, envíos y publicación.',
 legal:'Textos legales y lista de verificación de cumplimiento.',dispositivos:'Impresoras, balanzas, lectores y diseño del ticket.',
 impex:'Importá o exportá artículos, clientes, ventas y cierres en CSV o Excel.',integ:'Conexiones con otros servicios y su estado.',
 roles:'Personas con acceso y qué puede hacer cada rol.',auditoria:'Registro de todo lo que se hizo, por quién y cuándo, con verificación de integridad.',
 config:'Datos del negocio, módulos que se activan y preferencias.',nube:'Sincronización entre equipos, copias y estado de la conexión.',
 centro:'Visión integral: mapa del negocio, asistentes y alertas inteligentes.'};
function uxDescHTML(id){const d=UX_DESC[id];return d?`<p class="ux-desc">${esc(d)}</p>`:'';}
const UX_STEPS=[['caja','1','Abrir caja'],['vender','2','Vender y cobrar'],['caja','3','Ingresos y egresos'],['arqueo','4','Arqueo y cierre']];
function uxCashHero(id){if(!['caja','arqueo','cierres'].includes(id))return'';const s=typeof openSess==='function'?openSess():null;
 const sold=s&&S.sales.some(x=>x.sessId===s.id),moved=s&&S.movs.some(m=>m.sessId===s.id);
 const step=!s?0:id==='arqueo'?3:!sold?1:!moved?2:3;
 const steps=`<ol class="ux-steps" aria-label="Pasos del turno">${UX_STEPS.map(([to,n,t],i)=>{const dn=i<step&&(i===0||(i===1&&sold)||(i===2&&moved));return `<li class="${dn?'done':i===step?'cur':''}"${i===step?' aria-current="step"':''}><a data-act="uxHeroGo" data-id="${!s&&i>0?'caja':to}" tabindex="0" role="link"><span class="ux-sn">${dn?'✓':n}</span><span>${t}</span></a></li>`;}).join('')}</ol>`;
 if(!s){const last=S.sessions.filter(x=>x.closedAt).sort((a,b)=>b.closedAt-a.closedAt)[0];
  return `<section class="ux-hero closed" aria-label="Estado de la caja"><div class="ux-hero-h"><span class="ux-dot off" aria-hidden="true"></span><div><b>Caja cerrada</b><br><span class="sm">${last?'Último cierre: '+fmtDT(last.closedAt)+' · '+esc(last.closedBy||last.openedBy||''):'Todavía no hay cierres.'}</span></div>${id!=='caja'?'<div class="ux-hero-a"><button class="btn gold" data-act="uxHeroGo" data-id="caja">Abrir caja →</button></div>':''}</div>${steps}
   <p class="sm" style="margin:.4rem 0 0">Para empezar el día, cargá el efectivo inicial y tocá <b>Abrir caja</b>.</p></section>`;}
 const ss=S.sales.filter(x=>x.sessId===s.id&&x.status==='ok'),tot=ss.reduce((a,x)=>a+x.total,0),lastS=ss.reduce((a,x)=>Math.max(a,x.ts),0);
 const ms=S.movs.filter(m=>m.sessId===s.id);const inA=ms.filter(m=>m.type==='ingreso').reduce((x,m)=>x+m.amount,0),outA=ms.filter(m=>m.type==='egreso').reduce((x,m)=>x+m.amount,0);
 const ago=t=>{const d=Math.max(0,now()-t),h=Math.floor(d/3600e3),mi=Math.floor(d%3600e3/60000);return (h?h+' h ':'')+mi+' min';};const old=dkey(s.openedAt)!==dkey(now());
 return `<section class="ux-hero${old?' warn':''}" aria-label="Estado de la caja"><div class="ux-hero-h"><span class="ux-dot on" aria-hidden="true"></span><div><b>Caja ${esc(String(s.caja||S.tenant.caja))} abierta</b><br><span class="sm">desde ${fmtDT(s.openedAt)} · ${esc(s.openedBy||'')} · turno de ${ago(s.openedAt)}${old?' · <b>es de un día anterior: cerrala</b>':''}</span></div>
  <div class="ux-hero-a"><button class="btn${id==='caja'?' gold':''}" data-act="uxHeroGo" data-id="vender">Vender <kbd class="ux-kbd">F1</kbd></button>${id!=='caja'?'<button class="btn" data-act="uxHeroGo" data-id="caja">Ver caja</button>':''}</div></div>
  ${steps}<div class="ux-hero-k"><div><span>Ticket promedio</span><b>${ss.length?money(Math.round(tot/ss.length)):'—'}</b><small>${ss.length} venta(s)</small></div><div><span>Última venta</span><b>${lastS?'hace '+ago(lastS):'—'}</b></div>
  <div><span>Ingresos de caja</span><b>${money(inA)}</b></div><div><span>Egresos de caja</span><b>${money(outA)}</b><small>${ms.length} movimiento(s)</small></div></div></section>`;}
A.uxHeroGo=el=>go(el.dataset.id);
document.addEventListener('keydown',e=>{const a=e.target.closest&&e.target.closest('.ux-steps a');if(a&&(e.key==='Enter'||e.key===' ')){e.preventDefault();A.uxHeroGo(a);}});
const uxAfterBase=uxAfter;
uxAfter=function(id){uxAfterBase(id);try{const v=$('#view');v.classList.remove('cfg2');const row=[...v.children].find(x=>x.querySelector&&(x.matches('h1')||x.querySelector(':scope > h1')));
 const ins=(html)=>{if(!html)return;if(row)row.insertAdjacentHTML('afterend',html);else v.insertAdjacentHTML('afterbegin',html);};
 ins(uxCashHero(id));ins(uxDescHTML(id));v.classList.remove('ux-in');void v.offsetWidth;v.classList.add('ux-in');}catch(e){}};

/* ---------- V26.65 · navegador de secciones en pantallas largas (Configuración, Menú público, Integraciones, Periféricos…) ----------
   Arriba de la pantalla: buscador «¿Qué querés configurar?» que filtra las tarjetas por su texto (sin tildes) y una fila de
   accesos fija con cada sección («Todas» primero). Nada se esconde al entrar: por defecto se ven todas, así que nada deja de
   funcionar. La sección elegida y la búsqueda se recuerdan mientras se use la pantalla (también después de guardar). */
const uxNavState={};
const uxNorm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const uxRoot=v=>v.querySelector(':scope>#cfg-main')||v;
function uxSecCards(v){const out=[];[...uxRoot(v).children].forEach(c=>{if(c.id==='ux-secnav')return;if(c.classList.contains('card')&&c.querySelector('h2,h3'))out.push(c);else if(c.classList.contains('grid'))[...c.children].forEach(k=>{if(k.classList&&k.classList.contains('card')&&k.querySelector('h2,h3'))out.push(k);});});return out;}
/* V26.66 · Configuración por grupos, una sección a la vez: menú lateral fijo (Negocio, Equipo y seguridad, Ventas y cobros, Clientes y NFC,
   Herramientas, Respaldo y datos) con ícono, descripción y cantidad; al entrar se abre el último grupo usado (o «Negocio»); el buscador
   busca en TODOS los grupos y, al borrarlo, vuelve al grupo en el que estabas. En el celular el menú pasa a una fila deslizable. */
const UX_CG={config:[['Negocio',/modelo de negocio|tipo de negocio|^comercio|rubros|categor[ií]as|cajas y sucursales/i,'Modelo de negocio, datos del comercio, rubros y cajas','M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6'],
 ['Ventas y cobros',/cobro|recargo|fiado|cuenta corriente|mayorista|medio de pago|precio/i,'Medios de pago, recargos, fiado y mayorista','M3 7h18v10H3zM3 11h18M7 15h3'],
 ['Clientes y NFC',/nfc|club|fideliz|cliente/i,'Lector NFC, tarjetas y Club','M6 8.3a5.5 5.5 0 0 1 0 7.4M9.4 5.8a9.5 9.5 0 0 1 0 12.4M12.8 3.3a13.4 13.4 0 0 1 0 17.4'],
 ['Equipo y seguridad',/ingreso|apariencia|tema del panel|seguridad|recuperaci/i,'Ingreso con Google y apariencia','M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
 ['Herramientas',/\bia\b|asistente|telegram|r2ave|centro|lectura de facturas/i,'Asistente, IA y bots','M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z'],
 ['Respaldo y datos',/respaldo|datos de la demo|restaurar/i,'Copias de seguridad y datos','M4 7c0-2 16-2 16 0v10c0 2-16 2-16 0zM4 7c0 2 16 2 16 0M4 12c0 2 16 2 16 0']]};
const uxCgIco=d=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d||'M4 6h16M4 12h16M4 18h10'}"/></svg>`;
const uxCgD=g=>(typeof ownerMode==='function'&&ownerMode())?String(g[2]).replace('rubros','categorías'):g[2];
function uxCg(id,c){const G=UX_CG[id];if(!G)return '';const t=(c.querySelector('h2,h3').textContent||'').trim();const g=G.find(x=>x[1].test(t));return g?g[0]:'Otros';}
function uxCgSave(id,sec){if(UX_CG[id]&&(sec.startsWith('g:')||sec==='all'))try{localStorage.setItem('rave.ux.'+id,sec);}catch(e){}}
function uxCgLoad(id){if(!UX_CG[id])return 'all';let s='';try{s=localStorage.getItem('rave.ux.'+id)||'';}catch(e){}return (s.startsWith('g:')||s==='all')?s:'g:'+UX_CG[id][0][0];}
function uxSecApply(id){const v=$('#view');if(!v)return;const st=uxNavState[id]||{sec:'all',q:''};const cards=uxSecCards(v);const q=uxNorm(st.q).trim();let shown=0;
 if(st.sec.startsWith('g:')&&!cards.some(c=>uxCg(id,c)===st.sec.slice(2)))st.sec=UX_CG[id]?'g:'+UX_CG[id][0][0]:'all';
 cards.forEach((c,i)=>{const cg=uxCg(id,c);if(cg)c.dataset.cg=cg;const okS=q||st.sec==='all'||st.sec===String(i)||(st.sec.startsWith('g:')&&cg===st.sec.slice(2));const okQ=!q||q.split(/\s+/).every(w=>uxNorm(c.textContent).includes(w)||[...c.querySelectorAll('input,select,textarea')].some(x=>uxNorm(x.placeholder||x.value||'').includes(w)));const vis=okS&&okQ;c.classList.toggle('ux-hid',!vis);if(vis)shown++;});
 [...uxRoot(v).children].forEach(c=>{if(c.classList&&c.classList.contains('grid')&&c.querySelector(':scope>.card')){const any=[...c.children].some(k=>!k.classList.contains('ux-hid'));c.classList.toggle('ux-hid',!any);}});
 const nav=$('#ux-secnav');if(!nav)return;nav.querySelectorAll('[data-sec]').forEach(b=>{const on=!q&&b.dataset.sec===st.sec;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
 const hd=$('#ux-cg-head');if(hd){const g=UX_CG[id]&&st.sec.startsWith('g:')?UX_CG[id].find(x=>x[0]===st.sec.slice(2)):null;
  hd.innerHTML=q?`<h2>Resultados de «${esc(st.q)}»</h2><p class="sm mut">${shown?'En todos los grupos · '+shown+' sección(es)':'No hay opciones con esa palabra. Probá con otra.'}</p>`:g?`<h2>${uxCgIco(g[3])} ${esc(g[0])}</h2><p class="sm mut">${esc(uxCgD(g))}</p>`:st.sec==='all'?'<h2>Toda la configuración</h2>':'';}
 const r=$('#ux-sec-res');if(r)r.textContent=(q||st.sec!=='all')?(shown?shown+' de '+cards.length+' secciones':'No hay opciones con «'+st.q+'». Probá con otra palabra.'):cards.length+' secciones';}
function uxSecBuild(){const v=$('#view');if(!v||!curScreen)return;const id=curScreen;const G=UX_CG[id];
 if(!G){v.classList.remove('cfg2');}
 const cards=uxSecCards(v);const old=$('#ux-secnav');
 if(cards.length<5||id==='crm'||id==='centro'){if(old)old.remove();v.classList.remove('cfg2');return;}
 const sig=id+'|'+cards.map(c=>(c.querySelector('h2,h3').textContent||'').trim()).join('|');if(old&&old.dataset.sig===sig){uxSecApply(id);return;}if(old)old.remove();
 const st=uxNavState[id]||(uxNavState[id]={sec:uxCgLoad(id),q:''});
 const chips=G?[...G,['Otros',null,'Otras opciones','']].map(g=>{const L=cards.filter(c=>uxCg(id,c)===g[0]);return L.length?`<button type="button" class="ux-chip cg" data-sec="g:${esc(g[0])}" title="${esc(L.map(c=>(c.querySelector('h2,h3').textContent||'').trim()).join(' · '))}">${uxCgIco(g[3])}<span class="cg-t"><b>${esc(g[0])}</b><small>${esc(uxCgD(g))}</small></span><span class="cg-n">${L.length}</span></button>`:'';}).join(''):cards.map((c,i)=>{const t=(c.querySelector('h2,h3').textContent||'').replace(/\s+/g,' ').trim();return `<button type="button" class="ux-chip" data-sec="${i}" title="${esc(t)}">${esc(t.length>34?t.slice(0,32)+'…':t)}</button>`;}).join('');
 const nav=document.createElement('div');nav.id='ux-secnav';nav.dataset.sig=sig;nav.setAttribute('role','search');
 nav.innerHTML=`<div class="ux-secq"><label for="ux-sec-q" class="sr-only">Buscar en esta pantalla</label><input id="ux-sec-q" type="search" autocomplete="off" placeholder="${G?'Buscar una opción…':'¿Qué querés configurar? Ej.: ticket, alias, cuotas, horario…'}" value="${esc(st.q)}"><span id="ux-sec-res" class="sm mut" aria-live="polite"></span></div><div class="ux-chips" role="group" aria-label="Secciones de esta pantalla">${G?'':'<button type="button" class="ux-chip" data-sec="all">Todas</button>'}${chips}${G?'<button type="button" class="ux-chip cg cg-all" data-sec="all">'+uxCgIco('M4 6h16M4 12h16M4 18h16')+'<span class="cg-t"><b>Ver todo</b></span></button>':''}</div>`;
 if(G){/* dos columnas: menú de grupos | contenido (las tarjetas se mueven, no se vuelven a dibujar: conservan sus eventos) */
  v.classList.add('cfg2');let main=v.querySelector(':scope>#cfg-main');if(!main){main=document.createElement('div');main.id='cfg-main';[...v.children].forEach(c=>main.appendChild(c));v.appendChild(main);}
  v.insertBefore(nav,main);if(!main.querySelector(':scope>#ux-cg-head')){const hd=document.createElement('div');hd.id='ux-cg-head';hd.setAttribute('aria-live','polite');const first=[...main.children].find(c=>c.classList&&(c.classList.contains('card')||c.classList.contains('grid')||c.classList.contains('warnbox')));main.insertBefore(hd,first||null);}}
 else{const first=[...v.children].find(c=>c.classList&&(c.classList.contains('card')||c.classList.contains('grid')||c.classList.contains('warnbox')));v.insertBefore(nav,first||null);}
 nav.addEventListener('click',e=>{const b=e.target.closest('[data-sec]');if(!b)return;st.sec=b.dataset.sec;uxCgSave(id,st.sec);if(st.q){st.q='';const qi=nav.querySelector('#ux-sec-q');if(qi)qi.value='';}uxSecApply(id);if(st.sec!=='all'&&!st.sec.startsWith('g:')){const c=uxSecCards(v)[+st.sec];if(c){c.classList.add('ux-flash');setTimeout(()=>c.classList.remove('ux-flash'),900);}}window.scrollTo({top:Math.max(0,v.getBoundingClientRect().top+window.scrollY-70),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
 nav.addEventListener('keydown',e=>{const b=e.target.closest('.ux-chip');if(!b||!['ArrowDown','ArrowUp'].includes(e.key))return;const L=[...nav.querySelectorAll('.ux-chip')];const k=L.indexOf(b)+(e.key==='ArrowDown'?1:-1);if(L[k]){e.preventDefault();L[k].focus();}});
 const q=nav.querySelector('#ux-sec-q');q.addEventListener('input',()=>{st.q=q.value;if(st.q&&!G)st.sec='all';uxSecApply(id);});q.addEventListener('keydown',e=>{if(e.key==='Escape'){q.value='';st.q='';uxSecApply(id);}});
 uxSecApply(id);}
(()=>{let t=0;const mo=new MutationObserver(m=>{if(m.every(r=>r.target.closest&&r.target.closest('#ux-secnav')))return;clearTimeout(t);t=setTimeout(uxSecBuild,60);});const hook=()=>{const v=document.getElementById('view');if(v)mo.observe(v,{childList:true});else setTimeout(hook,300);};hook();})();
