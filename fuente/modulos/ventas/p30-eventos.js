/* ===== V27.32 · Calculador y cotizador de eventos (comida para compartir y bebidas) · prompt claude/PROMPT_V27_32_CALCULADOR_EVENTOS.md =====
   Un solo motor (evCalc, función pura) para el panel y para el menú público. Las reglas viven en S.cfg.ev y viajan con «Publicar» dentro de
   pubSite().ev; los precios salen SIEMPRE del producto vinculado (nunca del código). El PDF es la impresión del navegador (gratis, sin librerías). */
const EV_GRUPOS={com:'Comidas para compartir',sin:'Bebidas sin alcohol',alc:'Bebidas con alcohol',ext:'Hielo y descartables'};
const EV_CATS=['Pizzas, empanadas y sándwiches','Tablas y picadas','Finger food y bocadillos','Platos calientes','Mesa dulce','Gaseosas, aguas y jugos','Cerveza','Vino','Tragos y aperitivos','Hielo','Descartables'];
const EV_TIPOS={picada:'Picada o lunch',comida:'Reunión con comida principal',fiesta:'Fiesta o evento nocturno'};
const EV_DURS={3:'Hasta 3 h',5:'De 3 a 5 h',6:'6 h o más'};
/* ejemplos de consumo (por adulto, en unidades del producto); sin producto vinculado no se usan */
const EV_EJ=[['com',0,'Pizza entera (8 porciones)',0.375,1,1,1,0],['com',0,'Empanadas',4,6,1,0,0],['com',0,'Sándwiches de miga',4,12,1,0,0],
 ['com',1,'Tabla de fiambres y quesos para 4',0.25,1,1,0,1],['com',1,'Papas fritas (bolsa)',0.25,1,0.5,1,1],['com',2,'Finger food (unidad)',5,12,1,0,0],
 ['com',3,'Tarta en porciones',1,8,1,1,0],['com',4,'Mesa dulce (porción)',1.5,12,0.5,1,0],
 ['sin',5,'Gaseosa 2,25 L',0.25,1,1,0,1],['sin',5,'Agua 2 L',0.15,1,0.6,0,1],['alc',6,'Cerveza lata 473 ml',2,6,1,0,1],['alc',7,'Vino 750 ml',0.3,1,0.8,0,1],
 ['alc',8,'Fernet 750 ml',0.1,1,0.6,0,1],['ext',9,'Hielo (bolsa 2 kg)',0.15,1,1,0,1],['ext',10,'Vasos descartables',3,25,1,0,1]];
function evDefItems(){return EV_EJ.map((x,i)=>({k:'e'+(i+1),g:x[0],cat:EV_CATS[x[1]],t:x[2],pid:'',pp:x[3],mult:x[4],w:x[5],veg:!!x[6],tacc:!!x[7],hielo:x[1]===9}));}
function evCfg(){const c=S.cfg.ev||(S.cfg.ev={});const d={on:true,pub:false,margen:10,ninos:0.5,tipos:{picada:{com:0.8,beb:1},comida:{com:1,beb:0.9},fiesta:{com:0.7,beb:1.4}},durs:{3:1,5:1.35,6:1.7}};
 for(const k in d)if(c[k]===undefined)c[k]=JSON.parse(JSON.stringify(d[k]));if(!Array.isArray(c.items))c.items=evDefItems();return c;}
const evNum=(v,a,b,def)=>{v=+v;return isFinite(v)&&v>=a&&v<=b?v:def;};
/* ---------- motor (puro, probado): R = reglas, P = {pid:{nom,precio,agot,unidad}}, I = pedido ---------- */
function evCalc(R,P,I){const out={lines:[],total:0,avisos:[]};if(!R||!Array.isArray(R.items))return out;
 const ad=Math.max(0,Math.floor(+I.ad||0)),ni=Math.max(0,Math.floor(+I.ni||0)),tot=ad+ni;if(tot<1){out.avisos.push('Indicá cuántos invitados son.');return out;}
 const veg=Math.min(tot,Math.max(0,Math.floor(+I.veg||0))),tacc=Math.min(tot-veg,Math.max(0,Math.floor(+I.tacc||0)));
 const fN=evNum(R.ninos,0,1,0.5),T=(R.tipos||{})[I.tipo]||{com:1,beb:1},fD=+((R.durs||{})[I.dur])||1,m=evNum(I.margen!==undefined&&I.margen!==''?I.margen:R.margen,0,50,0);
 const sel=new Set(I.sel||[]);const L=R.items.filter(x=>sel.has(x.k)&&x.pid&&P[x.pid]&&+P[x.pid].precio>0&&+x.pp>0);
 const q={};const add=(x,v)=>{q[x.k]=(q[x.k]||0)+v;};const sw=a=>a.reduce((s,x)=>s+(+x.w>0?+x.w:1),0);const w=x=>+x.w>0?+x.w:1;
 /* comida: reparto por peso, variedad +10 % por ítem extra (tope 30 %), vegetarianos y sin TACC sólo entre los aptos */
 const F=L.filter(x=>x.g==='com');if(F.length){const eq=ad+ni*fN,varf=1+Math.min(0.3,0.1*(F.length-1));
  const gr=[['veg',veg,F.filter(x=>x.veg),'vegetarianos'],['tacc',tacc,F.filter(x=>x.tacc),'sin TACC']];let gen=eq;
  gr.forEach(([,n,C,nom])=>{if(!n)return;const e=eq*n/tot;if(!C.length){out.avisos.push('No elegiste opciones aptas para '+nom+': se calcularon con el resto de la comida.');return;}gen-=e;const s=sw(C);C.forEach(x=>add(x,e*T.com*varf*x.pp*w(x)/s));});
  const s=sw(F);F.forEach(x=>add(x,gen*T.com*varf*x.pp*w(x)/s));}
 [['sin',tot],['alc',ad]].forEach(([g,n])=>{const B=L.filter(x=>x.g===g);if(!B.length||!n)return;const s=sw(B);B.forEach(x=>add(x,n*T.beb*fD*x.pp*w(x)/s));});
 L.filter(x=>x.g==='ext').forEach(x=>add(x,tot*x.pp*(x.hielo?fD:1)));
 if(ni&&!ad&&L.some(x=>x.g==='alc'))out.avisos.push('Sólo hay niños: no se calcula alcohol.');
 L.forEach(x=>{if(!q[x.k])return;let v=q[x.k]*(1+m/100);const mu=+x.mult>0?+x.mult:1;v=Math.ceil(v/mu-1e-9)*mu;if(v<=0)v=mu;v=Math.round(v*1000)/1000;
  const p=P[x.pid];const sub=Math.round(v*p.precio*100)/100;out.lines.push({k:x.k,pid:x.pid,g:x.g,cat:x.cat,nom:p.nom,qty:v,unidad:p.unidad||'',precio:+p.precio,sub,agot:!!p.agot});
  if(!p.agot)out.total=Math.round((out.total+sub)*100)/100;});
 out.personas={ad,ni,veg,tacc,tot};return out;}
/* ---------- lo que se publica (sin costos ni datos internos) ---------- */
function evPublic(){const c=evCfg();if(!c.on||!c.pub)return null;
 return{margen:c.margen,ninos:c.ninos,tipos:c.tipos,durs:c.durs,items:c.items.filter(x=>{const p=x.pid&&prod(x.pid);return p&&p.menu&&p.active&&!p.archived&&x.on!==false;}).map(x=>({k:x.k,g:x.g,cat:x.cat,pid:x.pid,pp:+x.pp,mult:+x.mult,w:+x.w,veg:!!x.veg,tacc:!!x.tacc,hielo:!!x.hielo}))};}
/* para el menú público (documento aparte): calcula con las reglas y el catálogo PUBLICADOS */
window.RAVE_EV={rules:()=>{try{return RAVE_API.site().ev||null;}catch(e){return null;}},
 calc:I=>{const R=window.RAVE_EV.rules();if(!R)return{lines:[],total:0,avisos:['El calculador no está publicado.']};const P={};
  try{(RAVE_API.catalog().productos||[]).forEach(p=>{P[p.id]={nom:p.nom+(p.sub?' '+p.sub:''),precio:+p.precio||0,agot:!!p.agotado,unidad:p.unidad||''};});}catch(e){}return evCalc(R,P,I);}};
/* ---------- panel: Ventas → Eventos ---------- */
let EVI={ad:20,ni:0,veg:0,tacc:0,dur:'5',tipo:'picada',margen:'',sel:null},EVQ={},EVR=null,EVTAB='calc';
function evPanelProds(){const P={};S.products.forEach(p=>{if(p.active&&!p.archived)P[p.id]={nom:pfull(p),precio:p.price,agot:false,unidad:p.unit!=='u'?p.unit:''};});return P;}
function evRun(){const c=evCfg();if(!EVI.sel)EVI.sel=c.items.filter(x=>x.pid&&x.on!==false).map(x=>x.k);EVR=evCalc(c,evPanelProds(),EVI);
 EVR.lines.forEach(l=>{if(EVQ[l.k]!==undefined){l.qty=EVQ[l.k];l.man=true;}l.sub=Math.round(l.qty*l.precio);});EVR.total=EVR.lines.reduce((s,l)=>s+l.sub,0);return EVR;}
function evResumen(r){const p=r.personas||{};return (p.ad||0)+' adultos'+(p.ni?' y '+p.ni+' niños':'')+(p.veg?' · '+p.veg+' vegetarianos':'')+(p.tacc?' · '+p.tacc+' sin TACC':'')+' · '+(EV_TIPOS[EVI.tipo]||'')+' · '+(EV_DURS[EVI.dur]||'');}
function evFormHTML(c){const opt=(o,v)=>Object.entries(o).map(([k,t])=>`<option value="${k}" ${String(v)===String(k)?'selected':''}>${esc(t)}</option>`).join('');
 const it=c.items.filter(x=>x.pid&&x.on!==false);const by={};it.forEach(x=>{(by[x.g]=by[x.g]||[]).push(x);});
 return `<div class="card"><div class="grid g4"><div><label for="ev-ad">Adultos</label><input id="ev-ad" inputmode="numeric" value="${esc(EVI.ad)}"></div><div><label for="ev-ni">Niños</label><input id="ev-ni" inputmode="numeric" value="${esc(EVI.ni)}"></div>
  <div><label for="ev-vg">Vegetarianos</label><input id="ev-vg" inputmode="numeric" value="${esc(EVI.veg)}"></div><div><label for="ev-tc">Sin TACC</label><input id="ev-tc" inputmode="numeric" value="${esc(EVI.tacc)}"></div></div>
  <div class="grid g3"><div><label for="ev-tp">Tipo de evento</label><select id="ev-tp">${opt(EV_TIPOS,EVI.tipo)}</select></div><div><label for="ev-du">Duración</label><select id="ev-du">${opt(EV_DURS,EVI.dur)}</select></div>
  <div><label for="ev-mg">Margen de seguridad</label><select id="ev-mg">${opt({'':'Según reglas ('+c.margen+' %)',0:'0 %',10:'10 %',15:'15 %',20:'20 %'},EVI.margen)}</select></div></div>
  ${it.length?Object.entries(by).map(([g,L])=>`<fieldset class="ev-fs"><legend>${esc(EV_GRUPOS[g])}</legend>${L.map(x=>`<label class="chk"><input type="checkbox" class="ev-s" value="${x.k}" ${EVI.sel.includes(x.k)?'checked':''}> ${esc(x.cat)}: ${esc(prod(x.pid)?pfull(prod(x.pid)):x.t)}</label>`).join('')}</fieldset>`).join('')
   :uiEmpty?uiEmpty('Todavía no vinculaste productos','En «Reglas» elegí qué producto corresponde a cada ítem (pizzas, empanadas, gaseosas, cerveza, hielo…).'):'<p>Vinculá productos en «Reglas».</p>'}</div>`;}
function evResHTML(r){if(!r.lines.length)return r.avisos.length?`<div class="card">${r.avisos.map(a=>`<p class="warn sm">${esc(a)}</p>`).join('')}</div>`:'';
 return `<div class="card"><h3 style="margin-top:0">Cotización · ${esc(evResumen(r))}</h3>${r.avisos.map(a=>`<p class="warn sm">${esc(a)}</p>`).join('')}
 <div class="tw"><table data-nosort><thead><tr><th>Producto</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Subtotal</th><th>Stock</th></tr></thead><tbody>${r.lines.map(l=>{const p=prod(l.pid);const st=p?stockOf(p):0;const ok=st>=l.qty;
  return `<tr><td>${esc(l.nom)}<div class="sm mut">${esc(l.cat)}</div></td><td class="r"><input class="ev-q" data-k="${l.k}" inputmode="decimal" value="${esc(numAR(l.qty,3))}" aria-label="Cantidad de ${esc(l.nom)}" style="width:6rem;text-align:right">${l.man?'<div class="sm mut">a mano</div>':''}</td><td class="r">${money(l.precio)}${l.unidad?' / '+esc(l.unidad):''}</td><td class="r">${money(l.sub)}</td><td>${ok?uiBadge('ok','Alcanza'):uiBadge('warn','Faltan '+numAR(Math.max(0,l.qty-st),3))}</td></tr>`;}).join('')}</tbody>
 <tfoot><tr><th colspan="3" class="r">Total estimado</th><th class="r">${money(r.total)}</th><th></th></tr></tfoot></table></div>
 <div class="row" style="gap:.5rem;margin-top:.6rem;flex-wrap:wrap"><button class="btn gold" data-act="evToPos">Cargar en la venta</button><button class="btn" data-act="evQuote">Guardar como presupuesto</button><button class="btn" data-act="evPrint">Imprimir o guardar PDF</button>${Object.keys(EVQ).length?'<button class="btn sm" data-act="evReset">Volver a las cantidades sugeridas</button>':''}</div>
 <p class="sm mut">Cantidades sugeridas, redondeadas a unidades de venta. Podés corregirlas a mano. El presupuesto no descuenta stock.</p></div>`;}
function evCfgHTML(c){const P=S.products.filter(p=>p.active&&!p.archived).slice().sort((a,b)=>pfull(a).localeCompare(pfull(b)));
 const po=pid=>`<option value="">— Sin vincular —</option>`+P.map(p=>`<option value="${p.id}" ${p.id===pid?'selected':''}>${esc(pfull(p))} · ${money(p.price)}</option>`).join('');
 const tp=Object.entries(EV_TIPOS).map(([k,t])=>`<tr><td>${esc(t)}</td><td><input class="ev-tc" data-k="${k}" data-f="com" inputmode="decimal" value="${esc(numAR(c.tipos[k].com,2))}" style="width:5rem"></td><td><input class="ev-tc" data-k="${k}" data-f="beb" inputmode="decimal" value="${esc(numAR(c.tipos[k].beb,2))}" style="width:5rem"></td></tr>`).join('');
 return `<div class="card" id="ev-cfg"><h3 style="margin-top:0">Reglas del calculador</h3>
 <div class="row" style="gap:1rem;flex-wrap:wrap"><label class="chk"><input type="checkbox" id="evc-on" ${c.on?'checked':''}> Calculador encendido</label><label class="chk"><input type="checkbox" id="evc-pub" ${c.pub?'checked':''}> Mostrar «Armá tu evento» en el menú público</label></div>
 <div class="grid g3"><div><label for="evc-mg">Margen de seguridad por defecto (%)</label><input id="evc-mg" inputmode="numeric" value="${esc(c.margen)}"></div><div><label for="evc-ni">Los niños comen (0 a 1 de un adulto)</label><input id="evc-ni" inputmode="decimal" value="${esc(numAR(c.ninos,2))}"></div>
 <div><label>Duración: factor de bebida y hielo</label><div class="row" style="gap:.3rem">${Object.entries(EV_DURS).map(([k,t])=>`<input class="ev-du" data-k="${k}" inputmode="decimal" value="${esc(numAR(c.durs[k],2))}" style="width:4.2rem" aria-label="${esc(t)}" title="${esc(t)}">`).join('')}</div><p class="sm mut">${Object.values(EV_DURS).join(' · ')}</p></div></div>
 <div class="tw"><table data-nosort><thead><tr><th>Tipo de evento</th><th>Factor comida</th><th>Factor bebida</th></tr></thead><tbody>${tp}</tbody></table></div>
 <h4>Ítems (cada uno es un producto real: el precio sale del inventario)</h4>
 <div class="tw"><table data-nosort class="ev-it"><thead><tr><th>Grupo y categoría</th><th>Producto vinculado</th><th>Por adulto</th><th>Se vende de a</th><th>Peso</th><th>Veg.</th><th>Sin TACC</th><th></th></tr></thead><tbody>${c.items.map((x,i)=>`<tr data-i="${i}">
  <td><select class="evi-g" aria-label="Grupo">${Object.entries(EV_GRUPOS).map(([k,t])=>`<option value="${k}" ${x.g===k?'selected':''}>${esc(t)}</option>`).join('')}</select><select class="evi-c" aria-label="Categoría">${EV_CATS.map(t=>`<option ${x.cat===t?'selected':''}>${esc(t)}</option>`).join('')}</select><div class="sm mut">${esc(x.t||'')}</div></td>
  <td><select class="evi-p" aria-label="Producto">${po(x.pid)}</select>${x.pid&&prod(x.pid)&&!prod(x.pid).menu?'<div class="sm warn">No está publicado en el menú: el cliente no lo ve.</div>':''}</td><td><input class="evi-pp" inputmode="decimal" value="${esc(numAR(x.pp,3))}" style="width:5rem" aria-label="Consumo por adulto"></td>
  <td><input class="evi-m" inputmode="decimal" value="${esc(numAR(x.mult,3))}" style="width:4.5rem" aria-label="Se vende de a"></td><td><input class="evi-w" inputmode="decimal" value="${esc(numAR(x.w,2))}" style="width:4rem" aria-label="Peso en la combinación"></td>
  <td><input type="checkbox" class="evi-v" ${x.veg?'checked':''} aria-label="Apto vegetariano"></td><td><input type="checkbox" class="evi-t" ${x.tacc?'checked':''} aria-label="Sin TACC"></td><td><button class="btn sm" data-act="evItDel" data-i="${i}" aria-label="Quitar">✕</button></td></tr>`).join('')}</tbody></table></div>
 <p class="sm mut">«Por adulto» va en la unidad del producto: 0,25 botellas de 2,25 L, 4 empanadas, 0,375 pizzas. «Se vende de a» redondea hacia arriba (6 = media docena). El peso reparte la demanda cuando se combinan varios ítems del mismo grupo. Hielo: se ajusta por duración.</p>
 <div class="row" style="gap:.5rem"><button class="btn" data-act="evItAdd">+ Agregar ítem</button><button class="btn gold" data-act="evCfgSave">Guardar reglas</button></div></div>`;}
reg('eventos','Eventos','file','sell',()=>{const c=evCfg();if(!c.on&&!can('config'))return uiEmpty?uiEmpty('Calculador apagado','Pedile al administrador que lo encienda.'):'<p>Calculador apagado.</p>';
 if(!EVI.sel)EVI.sel=c.items.filter(x=>x.pid&&x.on!==false).map(x=>x.k);
 const tabs=[['calc','Calcular'],can('config')?['cfg','Reglas']:null].filter(Boolean);
 return `${uiHead?uiHead({t:'Calculador de eventos',sub:'Comida para compartir y bebidas: cantidades sugeridas con los precios y el stock reales, listo para presupuesto o venta.'}):'<h1>Calculador de eventos</h1>'}
 <nav class="ux-tabs" role="tablist">${tabs.map(([k,t])=>`<a role="tab" tabindex="0" data-act="evTab" data-t="${k}" aria-selected="${EVTAB===k}" class="${EVTAB===k?'on':''}">${t}</a>`).join('')}</nav>
 ${EVTAB==='cfg'&&can('config')?evCfgHTML(c):evFormHTML(c)+`<div id="ev-res">${evResHTML(evRun())}</div>`}
 <style>.ev-fs{border:1px solid var(--line);border-radius:12px;margin:.6rem 0 0;padding:.4rem .8rem}.ev-fs legend{font-weight:700;padding:0 .3rem}.ev-it select{max-width:15rem}.ev-it td{vertical-align:top}</style>`;},
 ()=>{const rd=()=>{const n=id=>Math.max(0,Math.min(2000,Math.floor(parseNum(val(id))||0)));if(!$('#ev-ad'))return;
   EVI={ad:n('ev-ad'),ni:n('ev-ni'),veg:n('ev-vg'),tacc:n('ev-tc'),dur:val('ev-du'),tipo:val('ev-tp'),margen:val('ev-mg'),sel:$$('.ev-s:checked').map(x=>x.value)};const b=$('#ev-res');if(b)b.innerHTML=evResHTML(evRun());};
  $$('#ev-ad,#ev-ni,#ev-vg,#ev-tc').forEach(i=>i.addEventListener('input',rd));$$('#ev-du,#ev-tp,#ev-mg').forEach(i=>i.addEventListener('change',rd));
  $$('.ev-s').forEach(i=>i.addEventListener('change',rd));const box=$('#ev-res');if(box)box.addEventListener('change',e=>{
   if(e.target.classList.contains('ev-q')){const v=parseNum(e.target.value);if(v>=0&&v<1e5){EVQ[e.target.dataset.k]=Math.round(v*1000)/1000;}else toast('Cantidad inválida',1);setTimeout(()=>{const b=$('#ev-res');if(b)b.innerHTML=evResHTML(evRun());},0);}});},'Operación');
{const i=NAV.findIndex(x=>x[0]==='presup');NAV.splice(i>=0?i+1:NAV.length,0,['eventos','Operación']);if(typeof UX_SEC_OF!=='undefined'&&UX_SEC_OF.presup)UX_SEC_OF.eventos=UX_SEC_OF.presup;
 if(typeof UX_DESC!=='undefined')UX_DESC.eventos='Cotizá comida y bebida para un evento con precios y stock reales.';}
SCREENS.eventos.show=()=>evCfg().on||can('config');
A.evTab=el=>{EVTAB=el.dataset.t;rerender();};
A.evReset=()=>{EVQ={};const b=$('#ev-res');if(b)b.innerHTML=evResHTML(evRun());};
function evLinesOk(){const r=EVR||evRun();const L=r.lines.filter(l=>l.qty>0&&prod(l.pid));if(!L.length){toast('No hay nada para cargar.',1);return null;}return L;}
A.evToPos=()=>{if(!can('sell'))return toast('Sin permiso',1);const L=evLinesOk();if(!L)return;if(pos.lines.length)return toast('Terminá o borrá la operación que está en Vender antes de cargar el evento.',1);
 pos.lines=L.map(l=>{const p=prod(l.pid);return{pid:p.id,name:pfull(p),rubro:p.rubro,qty:l.qty,price:p.price,cost:p.cost,unit:p.unit,list:p.price};});pos.sel=pos.lines.length-1;
 audit('EVENTO_COTIZADO','a Vender · '+evResumen(EVR)+' · '+money(EVR.total));go('vender');};
A.evQuote=()=>{if(!can('sell'))return toast('Sin permiso',1);const L=evLinesOk();if(!L)return;
 modal('Guardar presupuesto del evento',`<p>Total: <b>${money(EVR.total)}</b> · ${L.length} artículo(s). <b>No descuenta stock ni entra a la caja.</b></p><label for="evq-n">Para (nombre del cliente, opcional)</label><input id="evq-n" maxlength="60"><label for="evq-d">Validez (días)</label><input id="evq-d" inputmode="numeric" value="7">`,
 {okText:'Guardar presupuesto',onOk:w=>{const d=parseNum(val('evq-d'));if(!(Number.isInteger(d)&&d>=1&&d<=90))return w._err('La validez va de 1 a 90 días.'),false;
  const r=qtCreate({lines:L.map(l=>{const p=prod(l.pid);return{pid:p.id,name:pfull(p),rubro:p.rubro,qty:l.qty,price:p.price,unit:p.unit,list:p.price,cost:p.cost};}),name:val('evq-n'),days:d,note:'Evento: '+evResumen(EVR)});
  if(r.err)return w._err(r.err),false;audit('EVENTO_COTIZADO','presupuesto '+r.q.n+' · '+evResumen(EVR));toast('Presupuesto '+r.q.n+' guardado');setTimeout(()=>qtPrint(r.q),60);}});};
function evPrintHTML(r,cur,shop){const m=v=>cur==='c'?money(v):'$ '+Number(v).toLocaleString('es-AR',{maximumFractionDigits:2});
 return `<!doctype html><meta charset="utf-8"><title>Evento · ${esc(shop)}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;font-size:11pt}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ccc;padding:4px;text-align:left}.r{text-align:right}h1{font:700 18pt Georgia;margin:0}</style>
 <h1>${esc(shop)}</h1><p><b>COTIZACIÓN DE EVENTO</b> · ${esc(new Date().toLocaleString('es-AR'))}<br>${esc(r.res||'')}</p>
 <table><thead><tr><th>Producto</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Subtotal</th></tr></thead><tbody>${r.lines.map(l=>`<tr><td>${esc(l.nom)}${l.agot?' (sin stock)':''}</td><td class="r">${esc(String(l.qty).replace('.',','))}${l.unidad?' '+esc(l.unidad):''}</td><td class="r">${m(l.precio)}</td><td class="r">${l.agot?'—':m(l.sub)}</td></tr>`).join('')}</tbody></table>
 <p class="r" style="font-size:14pt"><b>Total estimado ${m(r.total)}</b></p><p>Cantidades y precios estimados, sujetos a disponibilidad. <b>DOCUMENTO NO VÁLIDO COMO FACTURA.</b></p>`;}
function evPrintDoc(html,doc){doc=doc||document;const f=doc.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';doc.body.appendChild(f);f.contentDocument.open();f.contentDocument.write(html);f.contentDocument.close();
 setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){}setTimeout(()=>f.remove(),4000);},300);}
window.RAVE_EV.print=(r,doc)=>{try{const s=RAVE_API.site();evPrintDoc(evPrintHTML(r,'p',s.title||S.tenant.name),doc);}catch(e){}};
A.evPrint=()=>{const r=EVR||evRun();if(!r.lines.length)return;audit('EVENTO_COTIZADO','impreso · '+evResumen(r));evPrintDoc(evPrintHTML(Object.assign({res:evResumen(r)},r),'c',S.tenant.name));};
A.evItAdd=()=>{const c=evCfg();A.evCfgRead(true);c.items.push({k:'e'+uid().slice(0,8),g:'com',cat:EV_CATS[0],t:'',pid:'',pp:1,mult:1,w:1,veg:false,tacc:false,hielo:false});rerender();};
A.evItDel=el=>{const c=evCfg();A.evCfgRead(true);c.items.splice(+el.dataset.i,1);rerender();};
A.evCfgRead=(quiet)=>{const c=evCfg();if(!$('#ev-cfg'))return true;const n=(v,a,b)=>{const x=parseNum(v);return x>=a&&x<=b?x:NaN;};let err='';
 const mg=n(val('evc-mg'),0,50),ni=n(val('evc-ni'),0,1);if(isNaN(mg))err='El margen va de 0 a 50 %.';if(isNaN(ni))err='El factor de niños va de 0 a 1.';
 const tipos={};$$('.ev-tc').forEach(i=>{const v=n(i.value,0,5);if(isNaN(v))err='Los factores de tipo de evento van de 0 a 5.';(tipos[i.dataset.k]=tipos[i.dataset.k]||{})[i.dataset.f]=v;});
 const durs={};$$('.ev-du').forEach(i=>{const v=n(i.value,0.1,5);if(isNaN(v))err='Los factores de duración van de 0,1 a 5.';durs[i.dataset.k]=v;});
 const items=$$('.ev-it tbody tr').map(tr=>{const i=+tr.dataset.i,x=c.items[i]||{};const pp=n(tr.querySelector('.evi-pp').value,0,1000),mu=n(tr.querySelector('.evi-m').value,0.001,1000),w=n(tr.querySelector('.evi-w').value,0.01,100);
  if(isNaN(pp)||isNaN(mu)||isNaN(w))err='Revisá los números de los ítems (por adulto, se vende de a y peso).';const cat=tr.querySelector('.evi-c').value;
  return Object.assign({},x,{g:tr.querySelector('.evi-g').value,cat,pid:tr.querySelector('.evi-p').value,pp,mult:mu,w,veg:tr.querySelector('.evi-v').checked,tacc:tr.querySelector('.evi-t').checked,hielo:cat==='Hielo'});});
 if(err){if(!quiet)toast(err,1);return false;}c.on=$('#evc-on').checked;c.pub=$('#evc-pub').checked;c.margen=mg;c.ninos=ni;c.tipos=tipos;c.durs=durs;c.items=items;return true;};
A.evCfgSave=()=>{if(!can('config'))return toast('Sin permiso',1);if(!A.evCfgRead())return;const c=evCfg();EVI.sel=null;EVQ={};
 audit('EVENTO_REGLAS',(c.on?'encendido':'apagado')+' · menú '+(c.pub?'sí':'no')+' · '+c.items.filter(x=>x.pid).length+' ítems vinculados');save();if(typeof pubRefresh==='function')pubRefresh();
 toast(c.pub?'Guardado. Publicá el menú para que lo vean los clientes.':'Reglas guardadas.');rerender();};
