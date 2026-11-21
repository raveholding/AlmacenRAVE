/* ===== V27.26 · Proveedores y compras: Preventistas y rutas + reposición automática =====
   Se engancha a Proveedores y compras (p4c/p4d) sin reescribirlo:
   · Preventistas por proveedor: días de visita, frecuencia (semanal, quincenal o cada 4 semanas), hora de aviso y WhatsApp.
   · Reglas de reposición por producto: stock mínimo (punto de pedido), stock ideal y bulto.
   · El día de visita, a la hora de aviso, se arma solo un borrador de orden de compra con lo que está en el mínimo
     (cantidad = ideal − stock, redondeada a bultos completos), sin duplicar (clave única por preventista y fecha),
     y queda el aviso en la campana y en el menú.
   · Revisión del pedido sugerido: cantidades editables, sumar productos, y «Confirmar y enviar por WhatsApp»
     (la orden pasa a Solicitada y se abre WhatsApp con el pedido armado).
   · Importador de Excel/CSV de reventa en 2 pasos (vista previa → confirmar). No pisa el stock existente.
   Las órdenes usan el mismo circuito de compras (en la nube las guarda el servidor). Preventistas y reglas
   viajan a la nube como colecciones «prevr» y «repo» (SQL 38) cuando vb_version() ≥ 38. */

const PRV_DAYS=[['lun','Lun',1],['mar','Mar',2],['mie','Mié',3],['jue','Jue',4],['vie','Vie',5],['sab','Sáb',6],['dom','Dom',0]];
const PRV_FREQ={semanal:{t:'Semanal',w:1},quincenal:{t:'Quincenal',w:2},mensual:{t:'Cada 4 semanas',w:4}};
const prvReps=()=>S.prevr||(S.prevr=[]);
const prvRules=()=>S.repo||(S.repo=[]);
const prvRep=id=>prvReps().find(r=>r.id===id);
const prvRule=pid=>prvRules().find(r=>r.id===pid);
const prvToday=()=>dkey(now());
const prvHmNow=()=>new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:typeof TZ!=='undefined'?TZ:undefined});
const prvAdd=(k,n)=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return dkey(d.getTime());};
const prvDow=k=>new Date(k+'T12:00:00').getDay();
const prvDayIdx=k=>(prvDow(k)+6)%7; /* lunes = 0 */
const prvTxt=(s,n)=>String(s==null?'':s).replace(/[<>]/g,'').trim().slice(0,n);
const prvWa=s=>{let d=String(s||'').replace(/\D/g,'');if(!d)return'';if(d.startsWith('0'))d=d.slice(1);if(d.length===10)d='549'+d;else if(d.startsWith('54')&&!d.startsWith('549')&&d.length===12)d='549'+d.slice(2);return/^\d{11,15}$/.test(d)?d:'';};
const prvBiz=()=>(typeof cl!=='undefined'&&cl.comercio&&cl.comercio.nombre)||(S.tenant&&S.tenant.name)||'el negocio';
const prvProvName=id=>{const s=typeof cmpProv==='function'?cmpProv(id):null;return s?s.razon:'Proveedor';};
const prvNum=x=>{const n=typeof parseNum==='function'?parseNum(String(x)):Number(String(x).replace(',','.'));return isFinite(n)?n:NaN;};
const prvR3=n=>Math.round(n*1000)/1000;
/* $ 1.234,50 · 1234.5 · 1,234.50 → número */
const prvMoney=v=>{let t=String(v||'').replace(/[$\s]/g,'');if(/,\d{1,2}$/.test(t))t=t.replace(/\./g,'').replace(',','.');else t=t.replace(/,(?=\d{3}(\D|$))/g,'');const n=Number(t);return isFinite(n)?n:NaN;};

/* ---------- 1) Calendario de visitas ---------- */
/* primera visita en o después de k */
function prvFirstFrom(r,k){if(!(r.days||[]).length)return'';for(let i=0;i<14;i++){const x=prvAdd(k,i);if(r.days.includes(PRV_DAYS[prvDayIdx(x)][0]))return x;}return'';}
/* la visita que sigue a «k»: otro día de la misma semana o, si no hay, la semana que corresponde según la frecuencia */
function prvAfter(r,k){const D=(r.days||[]);if(!D.length)return'';const i=prvDayIdx(k);
 for(let j=i+1;j<7;j++)if(D.includes(PRV_DAYS[j][0]))return prvAdd(k,j-i);
 const w=(PRV_FREQ[r.freq]||PRV_FREQ.semanal).w;const mon=prvAdd(k,-i+7*w);return prvFirstFrom(r,mon);}
function prvVisitsIn(k0,k1){const out=[];prvReps().filter(r=>r.activo!==false).forEach(r=>{if(r.last&&r.last>=k0&&r.last<=k1&&r.last!==r.next)out.push({r,k:r.last});let k=r.next;let g=0;while(k&&k<=k1&&g++<60){if(k>=k0)out.push({r,k});k=prvAfter(r,k);}});return out;}

/* ---------- 2) Motor de reposición ---------- */
function prvItemsFor(r){const out=[];
 prvRules().filter(x=>(x.repId?x.repId===r.id:x.provId===r.provId)).forEach(x=>{const p=prod(x.id);if(!p||p.archived||p.active===false)return;
  const st=+stockOf(p)||0,mn=+x.min||0,id=Math.max(+x.ideal||0,mn),pk=Math.max(1,Math.round(+x.pack||1));if(!(mn>0)||st>mn)return;
  let q=id-st;if(q<=0)q=pk;if(pk>1)q=Math.ceil(q/pk)*pk;q=prvR3(q);out.push({pid:p.id,name:pfull(p),stock:st,min:mn,ideal:id,pack:pk,qty:q,cost:+p.cost||0});});
 return out.sort((a,b)=>(a.stock/a.min)-(b.stock/b.min));}
const prvRulesOf=r=>prvRules().filter(x=>(x.repId?x.repId===r.id:x.provId===r.provId)&&prod(x.id));
/* crea o actualiza el borrador automático (idempotente por preventista y fecha) */
async function prvDraft(r,k,items,manual){if(!items.length)return null;const key='prv-'+r.id+'-'+k;
 const prev=(r.ocs||[]).find(o=>o.k===k&&!o.sent);const oc=prev&&cmpArr('pOrders').find(o=>o.id===prev.oc);
 const p={proveedor_id:r.provId,estado:'Borrador',observaciones:(manual?'Pedido armado':'Pedido sugerido automático')+' · preventista '+r.name+' · visita '+dmy(k),
  items:items.map(i=>({producto_id:i.pid,cantidad:i.qty,precio_costo:Math.round(i.cost)/100}))};
 if(oc&&oc.estado==='Borrador')p.id=oc.id;else p.idempotency_key=key+(manual?'-m'+uid().slice(-4):'');
 const res=await CMP.ocSave(p);r.ocs=(r.ocs||[]).filter(o=>o.oc!==res.id).concat([{oc:res.id,k,auto:manual?0:1,ts:now(),sent:0}]).slice(-30);r.upd=now();save();return res;}
let prvBusy=false;
/* «worker»: corre al abrir el sistema y cada minuto mientras está abierto; la clave idempotente evita duplicados entre equipos */
async function prvTick(){if(prvBusy||!user||!can('purchases')||typeof CMP==='undefined')return;prvBusy=true;let n=0;
 try{const k=prvToday(),hm=prvHmNow();
  for(const r of prvReps()){if(r.activo===false||!r.next||!(r.days||[]).length)continue;
   if(r.next<k){let g=0;while(r.next&&r.next<k&&g++<120)r.next=prvAfter(r,r.next);r.upd=now();save();}
   if(r.next!==k||r.last===k||(r.hora||'08:30')>hm)continue;
   const items=prvItemsFor(r);r.last=k;r.lastN=items.length;r.upd=now();
   if(items.length||r.avisaVacio){try{if(items.length){await prvDraft(r,k,items);}n++;audit('PREVENTISTA_AVISO',r.name+' · '+prvProvName(r.provId)+' · '+items.length+' producto(s) para reponer');}catch(e){r.err=String(e&&e.message||e).slice(0,140);}}
   r.next=prvAfter(r,k);save();}
  if(n&&curScreen==='proveedores')cmpRepaint();if(n)toast('📦 Hoy pasa'+(n>1?'n':'')+' '+n+' preventista'+(n>1?'s':'')+': revisá el pedido sugerido en Proveedores y compras');}
 finally{prvBusy=false;}}
setInterval(()=>{try{prvTick();}catch(e){}},60000);
{const _sp=showPanel;showPanel=function(){const r=_sp.apply(this,arguments);setTimeout(()=>{try{prvTick();}catch(e){}},400);return r;};}
/* avisos de hoy (para la campana, el menú y la pestaña) */
function prvAlerts(){const k=prvToday();return prvReps().filter(r=>r.activo!==false&&r.last===k&&(r.lastN||r.avisaVacio)).map(r=>{const o=(r.ocs||[]).find(x=>x.k===k);const oc=o&&cmpArr('pOrders').find(x=>x.id===o.oc);return{r,o,oc,pend:!!(o&&!o.sent&&oc&&oc.estado==='Borrador')};});}
const prvPendDrafts=()=>prvReps().flatMap(r=>(r.ocs||[]).filter(o=>!o.sent).map(o=>({r,o,oc:cmpArr('pOrders').find(x=>x.id===o.oc)}))).filter(x=>x.oc&&x.oc.estado==='Borrador');
{const _b=uxBadges;uxBadges=function(){const b=_b.apply(this,arguments);try{if(can('purchases')){const A=prvAlerts();const P=prvPendDrafts().length;if(A.length||P)b.proveedores={n:Math.max(A.length,P),c:'amber',pulse:P?1:0,t:(A.length?'Hoy pasa'+(A.length>1?'n':'')+' '+A.map(x=>x.r.name).join(', ')+'. ':'')+(P?P+' pedido(s) sugerido(s) para revisar':'')};}}catch(e){}return b;};}
{const _u=A.uxBell;A.uxBell=function(){_u.apply(this,arguments);try{const w=$$('#modal-root .ov').slice(-1)[0];if(!w)return;const li=[...w.querySelectorAll('li')].find(l=>/Hoy pasa|pedido\(s\) sugerido/.test(l.textContent));
 if(li&&!li.querySelector('[data-prv-go]')){li.insertAdjacentHTML('beforeend','<button class="btn sm" data-prv-go="1">Ver</button>');li.querySelector('[data-prv-go]').addEventListener('click',()=>{w.remove();cmpS.tab='prev';go('proveedores');});}}catch(e){}};}

/* ---------- 3) Pestaña «Preventistas y rutas» ---------- */
{const _t=cmpTabs;cmpTabs=function(){const P=prvPendDrafts().length;return _t.apply(this,arguments).replace(/(<button type="button" role="tab"[^>]*data-tab="cuenta"[^>]*>[^<]*<\/button>)/,`$1<button type="button" role="tab" class="cmp-tab ${cmpS.tab==='prev'?'on':''}" aria-selected="${cmpS.tab==='prev'}" data-act="cmpTab" data-tab="prev">Preventistas y rutas${P?` <b>${P}</b>`:''}</button>`);};}
{const _c=cmpCuentaTab;cmpCuentaTab=function(){return cmpS.tab==='prev'?prvTabHTML():_c.apply(this,arguments);};}
function prvTabHTML(){const k=prvToday();const R=prvReps();const act=R.filter(r=>r.activo!==false);const mon=prvAdd(k,-prvDayIdx(k));const W=prvVisitsIn(mon,prvAdd(mon,6));const hoy=W.filter(v=>v.k===k);
 const P=prvPendDrafts();const pTot=P.reduce((a,x)=>a+x.oc.total,0);const next7=prvVisitsIn(prvAdd(k,1),prvAdd(k,7));const nR=prvRules().filter(x=>prod(x.id)).length;
 const low=act.reduce((a,r)=>a+prvItemsFor(r).length,0);
 return`<div class="prv">
 <div class="grid g3 cmp-kpis prv-kpis">
  <div class="cmp-card kpi"><span>Visitas de hoy</span><b>${hoy.length}</b><small class="mut">${hoy.length?hoy.map(v=>esc(v.r.name)+' · '+esc(v.r.hora||'08:30')).join(' · '):'Ningún preventista pasa hoy'}</small></div>
  <div class="cmp-card kpi"><span>Pedidos sugeridos pendientes</span><b class="${P.length?'prv-amb':''}">${P.length}</b><small class="mut">${P.length?'Por '+money(pTot)+' al costo · revisalos y envialos':'Nada para revisar'}</small></div>
  <div class="cmp-card kpi"><span>Próximas visitas (7 días)</span><b>${next7.length}</b><small class="mut">${low} producto(s) ya en el mínimo · ${nR} con regla de reposición</small></div></div>
 <div class="row prv-bar"><button class="btn gold" data-act="prvEdit" data-id="">+ Preventista</button><button class="btn" data-act="prvRulesOpen" data-id="">Reglas de reposición (${nR})</button><button class="btn" data-act="prvImport">📥 Importar Excel de reventa</button>${typeof expBar==='function'?expBar('preventistas'):''}</div>
 <div class="prv-week" role="list" aria-label="Visitas de esta semana">${PRV_DAYS.map((d,i)=>{const kk=prvAdd(mon,i);const X=W.filter(v=>v.k===kk);return`<div class="prv-day ${kk===k?'hoy':''} ${kk<k?'past':''}" role="listitem"><b>${d[1]} ${+kk.slice(8)}</b>${X.map(v=>`<button class="prv-chip" data-act="prvOpen" data-id="${v.r.id}" title="${esc(prvProvName(v.r.provId))}">${esc(v.r.name.split(' ')[0])}</button>`).join('')||'<span class="prv-0">—</span>'}</div>`;}).join('')}</div>
 ${P.length?`<div class="prv-alert" role="status"><b>📦 Pedidos sugeridos para revisar</b>${P.map(x=>`<div class="prv-ar"><span>${esc(x.r.name)} · ${esc(prvProvName(x.r.provId))} · OC-${x.oc.num} · ${x.oc.items.length} producto(s) · ${money(x.oc.total)}</span><button class="btn sm gold" data-act="prvReview" data-id="${x.r.id}" data-oc="${x.oc.id}">Revisar y enviar</button></div>`).join('')}</div>`:''}
 ${R.length?`<div class="prv-list">${R.map(prvCard).join('')}</div>`:`<div class="prv-zero"><b>Todavía no cargaste preventistas</b><p class="sm mut">Sumá a quien te visita de cada proveedor, sus días y la hora de aviso. Después marcá el mínimo de cada producto: el día de visita el sistema arma el pedido solo.</p><div class="row"><button class="btn gold" data-act="prvEdit" data-id="">+ Preventista</button><button class="btn" data-act="prvImport">📥 Importar Excel</button></div></div>`}</div>`+PRV_CSS;}
function prvCard(r){const k=prvToday();const items=prvItemsFor(r);const nR=prvRulesOf(r).length;const off=r.activo===false;
 return`<article class="cmp-card prv-card ${off?'off':''}"><div class="prv-ch"><div><h3>${esc(r.name)}</h3><p class="sm mut">${esc(prvProvName(r.provId))}${r.wa?' · +'+esc(r.wa):''}</p></div>${off?'<span class="cmp-tag">Pausado</span>':r.next===k?'<span class="cmp-tag ok">Pasa hoy</span>':''}</div>
 <div class="prv-days" aria-label="Días de visita">${PRV_DAYS.map(d=>`<span class="${(r.days||[]).includes(d[0])?'on':''}">${d[1]}</span>`).join('')}</div>
 <p class="sm">${esc((PRV_FREQ[r.freq]||PRV_FREQ.semanal).t)} · aviso ${esc(r.hora||'08:30')} · próxima visita <b>${r.next?dmy(r.next)+(r.next===k?' (hoy)':''):'—'}</b></p>
 <p class="sm ${items.length?'prv-amb':'mut'}">${items.length?`⚠ ${items.length} de ${nR} producto(s) en el mínimo`:`${nR} producto(s) con regla · todo con stock`}</p>${r.err?`<p class="sm prv-red">No se pudo armar el último pedido: ${esc(r.err)}</p>`:''}
 <div class="row prv-act"><button class="btn sm gold" data-act="prvReview" data-id="${r.id}">Armar pedido ahora</button><button class="btn sm" data-act="prvRulesOpen" data-id="${r.id}">Productos y mínimos</button><button class="btn sm" data-act="prvEdit" data-id="${r.id}">Editar</button>${r.wa?`<a class="btn sm" href="${waLink('Hola '+r.name.split(' ')[0]+'! ',r.wa)}" target="_blank" rel="noopener">💬</a>`:''}</div></article>`;}
A.prvOpen=el=>{const r=prvRep(el.dataset.id);if(r)A.prvReview({dataset:{id:r.id}});};

/* ---------- 4) Alta y edición del preventista ---------- */
A.prvEdit=el=>{if(!can('purchases'))return toast('Sin permiso',1);const r=el.dataset.id?prvRep(el.dataset.id):null;const P=cmpArr('suppliers').filter(s=>s.activo!==false||(r&&s.id===r.provId));
 if(!P.length)return toast('Primero cargá el proveedor (botón «+ Proveedor»).',1);
 const w=modal(r?'Editar preventista':'Nuevo preventista',`<label for="prv-n">Nombre del preventista</label><input id="prv-n" maxlength="60" value="${esc(r?r.name:'')}" placeholder="Ej.: Juan (Quilmes)">
 <label for="prv-p">Proveedor</label><select id="prv-p">${P.map(s=>`<option value="${s.id}" ${r&&r.provId===s.id?'selected':''}>${esc(s.razon)}</option>`).join('')}</select>
 <label for="prv-w">WhatsApp</label><input id="prv-w" inputmode="tel" maxlength="20" value="${esc(r?r.wa:'')}" placeholder="387 555-1234">
 <fieldset class="prv-fs"><legend>Días de visita</legend><div class="prv-dsel">${PRV_DAYS.map(d=>`<label><input type="checkbox" name="prv-d" value="${d[0]}" ${r&&(r.days||[]).includes(d[0])?'checked':''}><span>${d[1]}</span></label>`).join('')}</div></fieldset>
 <div class="f"><div><label for="prv-f">Frecuencia</label><select id="prv-f">${Object.entries(PRV_FREQ).map(([k,v])=>`<option value="${k}" ${(r?r.freq:'semanal')===k?'selected':''}>${v.t}</option>`).join('')}</select></div>
 <div><label for="prv-h">Hora de aviso</label><input id="prv-h" type="time" value="${esc(r?r.hora:'08:30')}"></div><div><label for="prv-x">Próxima visita</label><input id="prv-x" type="date" value="${esc(r&&r.next||'')}"></div></div>
 <label class="chk"><input type="checkbox" id="prv-v" ${r&&r.avisaVacio?'checked':''}> Avisarme el día de visita aunque no falte nada</label>
 ${r?`<label class="chk"><input type="checkbox" id="prv-a" ${r.activo===false?'':'checked'}> Activo</label>`:''}<p class="sm mut">Si dejás vacía la próxima visita, se calcula sola con los días marcados.</p>`,
 {okText:r?'Guardar':'Agregar',onOk:w=>{const name=prvTxt(val('prv-n'),60);if(name.length<2)return w._err('Escribí el nombre.'),false;const days=$$('input[name="prv-d"]:checked',w).map(x=>x.value);if(!days.length)return w._err('Marcá al menos un día de visita.'),false;
  const wa=val('prv-w')?prvWa(val('prv-w')):'';if(val('prv-w')&&!wa)return w._err('El WhatsApp no es válido: poné el código de área y el número (ej.: 387 555-1234).'),false;
  const hora=/^\d\d:\d\d$/.test(val('prv-h'))?val('prv-h'):'08:30';const freq=PRV_FREQ[val('prv-f')]?val('prv-f'):'semanal';
  const x=r||{id:uid(),ts:now(),ocs:[]};Object.assign(x,{name,provId:val('prv-p'),wa,days,freq,hora,avisaVacio:$('#prv-v',w).checked,upd:now()});if(r)x.activo=$('#prv-a',w).checked;else x.activo=true;
  const nx=val('prv-x');x.next=/^\d{4}-\d{2}-\d{2}$/.test(nx)&&nx>=prvToday()?nx:prvFirstFrom(x,prvToday());if(x.last&&x.last===x.next)x.last='';
  if(!r)prvReps().push(x);audit(r?'PREVENTISTA_EDITAR':'PREVENTISTA_ALTA',name+' · '+prvProvName(x.provId)+' · '+days.join('/')+' · '+freq+' '+hora);save();cmpS.tab='prev';cmpRepaint();toast(r?'Guardado':'Preventista agregado · próxima visita '+dmy(x.next));}});};

/* ---------- 5) Reglas de reposición (productos, mínimo, ideal y bulto) ---------- */
A.prvRulesOpen=el=>{if(!can('purchases'))return toast('Sin permiso',1);const r=el.dataset.id?prvRep(el.dataset.id):null;const provId=r?r.provId:'';
 const L=prvRules().filter(x=>prod(x.id)&&(!r||(x.repId?x.repId===r.id:x.provId===provId)));const reps=prvReps();
 const row=x=>{const p=prod(x.id);const st=+stockOf(p)||0;const lowx=+x.min>0&&st<=+x.min;return`<tr data-pr="${x.id}" class="${lowx?'prv-low':''}"><td><b>${esc(pfull(p))}</b>${r?'':`<div class="sm mut">${esc(prvProvName(x.provId))}${x.repId&&prvRep(x.repId)?' · '+esc(prvRep(x.repId).name):''}</div>`}</td><td class="r">${String(prvR3(st)).replace('.',',')}</td>
  <td><input class="prv-in" data-f="min" inputmode="decimal" value="${x.min||''}" aria-label="Stock mínimo"></td><td><input class="prv-in" data-f="ideal" inputmode="decimal" value="${x.ideal||''}" aria-label="Stock ideal"></td><td><input class="prv-in" data-f="pack" inputmode="numeric" value="${x.pack||1}" aria-label="Unidades por bulto"></td>
  <td>${lowx?'<span class="prv-red">● Pedir</span>':'<span class="prv-ok">● OK</span>'}</td><td><button class="btn sm" data-prvdel="${x.id}" aria-label="Quitar">✕</button></td></tr>`;};
 const w=modal(r?'Productos y mínimos · '+r.name:'Reglas de reposición',`<p class="sm mut">Mínimo = punto de pedido. Ideal = hasta dónde reponer. Bulto = unidades por caja (se redondea a cajas completas). Se guarda al salir de cada casilla.</p>
  <div class="prv-addp"><input id="prv-q" list="prv-dl" placeholder="Agregar producto: nombre o código" autocomplete="off" aria-label="Agregar producto"><datalist id="prv-dl">${S.products.filter(p=>!p.archived).slice(0,3000).map(p=>`<option value="${esc(pfull(p))}">`).join('')}</datalist>
  ${r?'':`<select id="prv-ap" aria-label="Proveedor">${cmpArr('suppliers').filter(s=>s.activo!==false).map(s=>`<option value="${s.id}">${esc(s.razon)}</option>`).join('')}</select>`}<button class="btn sm gold" type="button" id="prv-addb">Agregar</button></div>
  <div class="tw"><table class="prv-tbl"><thead><tr><th>Producto</th><th class="r">Stock</th><th>Mínimo</th><th>Ideal</th><th>Bulto</th><th>Estado</th><th></th></tr></thead><tbody id="prv-rb">${L.map(row).join('')||'<tr><td colspan="7" class="mut">Sin productos. Agregalos arriba o importá tu Excel.</td></tr>'}</tbody></table></div>`,{wide:true,ok:false,cancelText:'Listo'});
 const tb=$('#prv-rb',w);
 tb.addEventListener('change',e=>{const f=e.target.dataset.f;const tr=e.target.closest('tr[data-pr]');if(!f||!tr)return;const x=prvRule(tr.dataset.pr);if(!x)return;let v=prvNum(e.target.value);
  if(f==='pack'){v=Math.round(v);if(!(v>=1&&v<=1000))return toast('Bulto: de 1 a 1000 unidades.',1);}else if(!(v>=0&&v<1e6))return toast('Cantidad inválida.',1);
  x[f]=prvR3(v);if(f==='min'&&(+x.ideal||0)<x.min){x.ideal=x.min;const i=tr.querySelector('[data-f="ideal"]');if(i)i.value=x.ideal;}x.upd=now();save();
  const p=prod(x.id);const st=+stockOf(p)||0;tr.classList.toggle('prv-low',+x.min>0&&st<=+x.min);tr.cells[5].innerHTML=+x.min>0&&st<=+x.min?'<span class="prv-red">● Pedir</span>':'<span class="prv-ok">● OK</span>';});
 tb.addEventListener('click',e=>{const b=e.target.closest('[data-prvdel]');if(!b)return;S.repo=prvRules().filter(x=>x.id!==b.dataset.prvdel);if(typeof pushDel==='function')try{pushDel('repo',b.dataset.prvdel);}catch(_){}save();b.closest('tr').remove();});
 $('#prv-addb',w).addEventListener('click',()=>{const q=val('prv-q');const p=S.products.find(x=>!x.archived&&(pfull(x)===q||x.name===q||(x.barcode&&x.barcode===q)));if(!p)return toast('No encontré ese producto.',1);
  if(prvRule(p.id))return toast('Ese producto ya tiene regla.',1);const x={id:p.id,provId:r?r.provId:val('prv-ap'),repId:r?r.id:'',min:0,ideal:0,pack:1,upd:now()};prvRules().push(x);save();
  const em=tb.querySelector('td[colspan]');if(em)em.parentElement.remove();tb.insertAdjacentHTML('afterbegin',row(x));$('#prv-q',w).value='';const i=tb.querySelector('[data-f="min"]');if(i)i.focus();});
 const obs=new MutationObserver(()=>{if(!document.body.contains(w)){obs.disconnect();if(curScreen==='proveedores')cmpRepaint();}});obs.observe($('#modal-root'),{childList:true});};

/* ---------- 6) Revisión del pedido sugerido y envío por WhatsApp ---------- */
A.prvReview=el=>{if(!can('purchases'))return toast('Sin permiso',1);const r=prvRep(el.dataset.id);if(!r)return;const k=prvToday();
 const oc=el.dataset.oc?cmpArr('pOrders').find(o=>o.id===el.dataset.oc):null;
 let L=oc?oc.items.map(i=>{const p=prod(i.pid)||{};const x=prvRule(i.pid)||{};return{pid:i.pid,name:p.name?pfull(p):i.name,stock:+stockOf(p)||0,min:+x.min||0,ideal:+x.ideal||0,pack:Math.max(1,+x.pack||1),qty:i.qty,cost:i.cost};}):prvItemsFor(r);
 const extra=prvRulesOf(r).filter(x=>!L.some(i=>i.pid===x.id)).map(x=>prod(x.id)).filter(Boolean);
 const tr=i=>`<tr data-pid="${i.pid}"><td><b>${esc(i.name)}</b>${i.pack>1?`<div class="sm mut">Bulto x ${i.pack}</div>`:''}</td><td class="r ${i.min&&i.stock<=i.min?'prv-red':''}">${String(prvR3(i.stock)).replace('.',',')}</td><td class="r">${i.min||'—'}</td>
  <td><input class="prv-q" inputmode="decimal" value="${i.qty}" aria-label="Cantidad de ${esc(i.name)}" data-pack="${i.pack}"><div class="sm mut prv-bx">${i.pack>1?(i.qty/i.pack)+' bulto(s)':''}</div></td><td class="r">${money(i.cost)}</td><td class="r prv-sub">${money(Math.round(i.qty*i.cost))}</td><td><button class="btn sm" data-prvx="1" aria-label="Quitar">✕</button></td></tr>`;
 const w=modal('Pedido sugerido · '+r.name,`<p class="sm">${esc(prvProvName(r.provId))}${r.wa?' · WhatsApp +'+esc(r.wa):' · <b>sin WhatsApp cargado</b>'}${oc?' · OC-'+oc.num:''} · visita ${dmy(((r.ocs||[]).find(x=>oc&&x.oc===oc.id)||{}).k||(r.last===k?k:r.next||k))}</p>
  ${L.length?'':'<p class="warnbox">Ningún producto de este proveedor está en el mínimo. Podés armar el pedido igual sumando productos.</p>'}
  <div class="tw"><table class="prv-tbl"><thead><tr><th>Producto</th><th class="r">Stock</th><th class="r">Mínimo</th><th>Cantidad</th><th class="r">Costo</th><th class="r">Subtotal</th><th></th></tr></thead><tbody id="prv-ob">${L.map(tr).join('')}</tbody>
  <tfoot><tr><td colspan="5" class="r"><b>Total estimado al costo</b></td><td class="r"><b id="prv-tot"></b></td><td></td></tr></tfoot></table></div>
  <div class="prv-addp"><select id="prv-ex" aria-label="Sumar producto"><option value="">＋ Sumar producto de ${esc(prvProvName(r.provId))}…</option>${extra.map(p=>`<option value="${p.id}">${esc(pfull(p))} · stock ${prvR3(+stockOf(p)||0)}</option>`).join('')}</select><input id="prv-oq" list="prv-odl" placeholder="…u otro producto: nombre o código" autocomplete="off" aria-label="Buscar otro producto"><datalist id="prv-odl">${S.products.filter(p=>!p.archived).slice(0,3000).map(p=>`<option value="${esc(pfull(p))}">`).join('')}</datalist><button class="btn sm" type="button" id="prv-ob2">Sumar</button></div>
  <label for="prv-nt">Nota para el preventista (opcional)</label><input id="prv-nt" maxlength="160" placeholder="Ej.: entregar el jueves a la mañana">`,
  {wide:true,okText:r.wa?'Confirmar y enviar por WhatsApp':'Confirmar pedido',cancelText:'Cerrar',onOk:async w=>{const I=prvReadItems(w);if(!I.length)return w._err('El pedido está vacío.'),false;
   const win=r.wa?window.open('','_blank'):null;
   try{const res=await prvSave(r,I,oc,true);const o=cmpArr('pOrders').find(x=>x.id===res.id);
    if(o&&o.estado==='Borrador'&&o.total>0){try{await CMP.ocEstado(o.id,'Solicitada');}catch(e){}}
    const ent=(r.ocs||[]).find(x=>x.oc===res.id);if(ent){ent.sent=now();}r.upd=now();save();
    const msg=prvMsg(r,I,val('prv-nt'));audit('PEDIDO_PREVENTISTA',r.name+' · OC-'+res.numero+' · '+I.length+' producto(s)'+(r.wa?' · enviado por WhatsApp':''));
    if(win){win.location.href=waLink(msg,r.wa);}else{try{navigator.clipboard.writeText(msg);}catch(e){}toast('Pedido confirmado. Copié el mensaje para que lo pegues.');}
    cmpS.tab='prev';cmpRepaint();}catch(e){if(win)win.close();w._err(String(e&&e.message||e));return false;}}});
 /* botón extra: guardar sin enviar */
 const mf=$('.mf',w);mf.insertAdjacentHTML('afterbegin','<button class="btn" type="button" id="prv-sv">Guardar borrador</button>');
 $('#prv-sv',w).addEventListener('click',async()=>{const I=prvReadItems(w);if(!I.length)return w._err('El pedido está vacío.');try{const res=await prvSave(r,I,oc,false);toast('Borrador OC-'+res.numero+' guardado');w.remove();cmpS.tab='prev';cmpRepaint();}catch(e){w._err(String(e&&e.message||e));}});
 const tb=$('#prv-ob',w);const tot=()=>{let t=0;$$('tr[data-pid]',tb).forEach(t2=>{const q=prvNum(t2.querySelector('.prv-q').value)||0;const c=L.find(i=>i.pid===t2.dataset.pid);const s=Math.round(q*(c?c.cost:0));t+=s;t2.querySelector('.prv-sub').textContent=money(s);const pk=+t2.querySelector('.prv-q').dataset.pack;t2.querySelector('.prv-bx').textContent=pk>1?(Math.round(q/pk*100)/100)+' bulto(s)':'';});$('#prv-tot',w).textContent=money(t);};
 tb.addEventListener('input',tot);tb.addEventListener('click',e=>{if(e.target.closest('[data-prvx]')){e.target.closest('tr').remove();tot();}});tot();
 const addP=id=>{if(!id)return;if(tb.querySelector(`tr[data-pid="${id}"]`))return toast('Ya está en el pedido.',1);const p=prod(id);if(!p)return;const x=prvRule(id)||{};
  const it={pid:id,name:pfull(p),stock:+stockOf(p)||0,min:+x.min||0,ideal:+x.ideal||0,pack:Math.max(1,+x.pack||1),qty:Math.max(1,+x.pack||1),cost:+p.cost||0};L=L.filter(i=>i.pid!==id).concat([it]);tb.insertAdjacentHTML('beforeend',tr(it));tot();};
 $('#prv-ex',w).addEventListener('change',e=>{const id=e.target.value;e.target.value='';addP(id);});
 $('#prv-ob2',w).addEventListener('click',()=>{const q=val('prv-oq');if(!q)return;const p=S.products.find(x=>!x.archived&&(pfull(x)===q||x.barcode===q))||S.products.find(x=>!x.archived&&norm(pfull(x)).includes(norm(q)));if(!p)return toast('No encontré ese producto.',1);$('#prv-oq',w).value='';addP(p.id);});};
function prvReadItems(w){return $$('#prv-ob tr[data-pid]',w).map(t=>({pid:t.dataset.pid,qty:prvR3(prvNum(t.querySelector('.prv-q').value)),name:t.querySelector('b').textContent,pack:+t.querySelector('.prv-q').dataset.pack||1,cost:+(prod(t.dataset.pid)||{}).cost||0})).filter(i=>i.qty>0);}
async function prvSave(r,I,oc,manual){const k=prvToday();const ent=oc&&(r.ocs||[]).find(x=>x.oc===oc.id);
 if(oc&&oc.estado==='Borrador'){const res=await CMP.ocSave({id:oc.id,proveedor_id:r.provId,estado:'Borrador',observaciones:oc.obs||('Pedido · preventista '+r.name),items:I.map(i=>({producto_id:i.pid,cantidad:i.qty,precio_costo:Math.round(i.cost)/100}))});if(!ent){r.ocs=(r.ocs||[]).concat([{oc:res.id,k,auto:0,ts:now(),sent:0}]);save();}return res;}
 return prvDraft(r,ent?ent.k:k,I.map(i=>Object.assign({},i)),manual);}
function prvMsg(r,I,nota){const L=I.map(i=>{const bx=i.pack>1&&Math.abs(i.qty/i.pack-Math.round(i.qty/i.pack))<1e-9?Math.round(i.qty/i.pack):0;
 return'- '+(bx?bx+(bx>1?' cajas':' caja')+' x'+i.pack+' ('+String(i.qty).replace('.',',')+' u)':String(i.qty).replace('.',',')+' u')+' · '+i.name;});
 return'Hola '+r.name.split(' ')[0]+', te paso el pedido para '+prvBiz()+':\n'+L.join('\n')+(nota?'\n\n'+prvTxt(nota,160):'')+'\n\n¡Gracias!';}

/* ---------- 7) Importador de Excel / CSV de reventa (vista previa → confirmar) ---------- */
const PRV_COLS={producto:['producto','articulo','artículo','descripcion','descripción','nombre','detalle'],codigo:['codigo','código','codigo de barras','código de barras','ean','sku','barcode'],
 proveedor:['proveedor','distribuidor','empresa','marca proveedor'],cuit:['cuit','cuit proveedor'],preventista:['preventista','vendedor','viajante','corredor'],whatsapp:['whatsapp','telefono','teléfono','celular','tel'],
 dias:['dia de visita','día de visita','dias de visita','días de visita','dias','días','visita','dia','día'],frecuencia:['frecuencia'],hora:['hora','hora de aviso','aviso'],
 costo:['costo','precio costo','precio de costo','compra','precio compra'],precio:['precio reventa','precio de reventa','reventa','precio venta','precio de venta','precio','pvp'],
 stock:['stock actual','stock','existencia','existencias'],min:['stock minimo','stock mínimo','minimo','mínimo','punto de pedido'],ideal:['stock ideal','ideal','objetivo','maximo','máximo'],pack:['bulto','caja','pack','unidades por bulto','u x bulto','x bulto'],rubro:['rubro','categoria','categoría','familia']};
const prvNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function prvMap(head){const m={};const H=head.map(prvNorm);for(const [k,syn] of Object.entries(PRV_COLS)){let i=H.findIndex(h=>syn.some(s=>h===prvNorm(s)));if(i<0)i=H.findIndex(h=>syn.some(s=>h.includes(prvNorm(s))&&!Object.values(m).includes(H.indexOf(h))));if(i>=0&&!Object.values(m).includes(i))m[k]=i;}return m;}
function prvParseDays(s){const t=prvNorm(s);const out=[];const M={lun:['lun','lu','lunes','mon','monday'],mar:['mar','ma','martes','tue','tuesday'],mie:['mie','mi','miercoles','wed','wednesday'],jue:['jue','ju','jueves','thu','thursday'],vie:['vie','vi','viernes','fri','friday'],sab:['sab','sa','sabado','sat','saturday'],dom:['dom','do','domingo','sun','sunday']};
 t.split(/[^a-z]+/).filter(Boolean).forEach(w=>{for(const [k,v] of Object.entries(M))if(v.includes(w)&&!out.includes(k))out.push(k);});return PRV_DAYS.map(d=>d[0]).filter(k=>out.includes(k));}
let prvImp=null;
A.prvImport=()=>{if(!can('purchases'))return toast('Sin permiso',1);prvImp=null;
 const w=modal('Importar Excel de reventa',`<p class="sm">Subí tu planilla <b>.xlsx</b> o <b>.csv</b>. Reconozco solas columnas como: Producto, Código, Proveedor, CUIT, Preventista, WhatsApp, Día de visita, Frecuencia, Hora, Costo, Precio reventa, Stock actual, Stock mínimo, Stock ideal y Bulto.</p>
  <input type="file" id="prv-f" accept=".xlsx,.csv,.txt,text/csv"><div id="prv-pre"></div>`,{wide:true,okText:'Confirmar importación',onOk:async w=>{if(!prvImp||!prvImp.ev)return w._err('Primero elegí el archivo.'),false;return prvImpApply(w);}});
 $('#prv-f',w).addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;if(f.size>15e6)return w._err('El archivo supera 15 MB.');w._err('');
  try{let rows;if(/\.xlsx$/i.test(f.name))rows=await xlsxRows(await f.arrayBuffer());else{const buf=await f.arrayBuffer();let t=new TextDecoder('utf-8').decode(buf);if(t.includes('\uFFFD'))t=new TextDecoder('windows-1252').decode(buf);rows=parseCSV(t);}
   rows=rows.map(r=>r.map(c=>String(c==null?'':c)));const h=detectHeader(rows);const head=rows[h]||[];prvImp={file:f.name,head,rows:rows.slice(h+1).filter(r=>r.some(c=>c.trim())).slice(0,5000),map:prvMap(head)};prvImpPreview(w);}
  catch(err){w._err(String(err&&err.message||err));}});};
function prvImpEval(){const I=prvImp;const g=(r,k)=>I.map[k]!==undefined?String(r[I.map[k]]||'').trim():'';const out=[];const provs=cmpArr('suppliers');const newProv={};const newRep={};const seen=new Set();let er=0;
 const optUpd=I.upd!==false;const defRub=I.rub||((S.rubros||[]).find(x=>x.kind==='rubro')||{}).id||'';
 I.rows.forEach((row,ix)=>{const x={n:ix+1,err:[],warn:[]};const name=g(row,'producto');const bc=g(row,'codigo');x.name=name;
  if(!name&&!bc){x.err.push('falta el producto');}
  const p=S.products.find(q=>!q.archived&&((bc&&q.barcode===bc)||(name&&norm(q.name)===norm(name))||(name&&norm(pfull(q))===norm(name))));x.p=p||null;
  const key=bc||norm(name);if(key&&seen.has(key))x.err.push('repetido en el archivo');seen.add(key);
  const pn=g(row,'proveedor'),cuit=g(row,'cuit').replace(/\D/g,'');let s=pn?provs.find(q=>(cuit&&q.cuit===cuit)||prvNorm(q.razon)===prvNorm(pn)):null;
  if(!pn)x.err.push('falta el proveedor');else if(!s){if(cuit&&typeof arcaCuitOk==='function'&&arcaCuitOk(cuit)){newProv[prvNorm(pn)]=newProv[prvNorm(pn)]||{razon:pn,cuit};x.provNew=prvNorm(pn);}else x.err.push('proveedor nuevo sin CUIT válido: cargalo primero o sumá la columna CUIT');}
  x.prov=s;x.provName=pn;
  const price=g(row,'precio')===''?null:prvMoney(g(row,'precio'));const cst=g(row,'costo')===''?null:prvMoney(g(row,'costo'));
  if(cst!==null&&!(cst>=0))x.err.push('costo inválido');if(price!==null&&!(price>=0))x.err.push('precio inválido');x.cost=cst;x.price=price;
  const st=g(row,'stock')===''?null:prvNum(g(row,'stock'));const mn=g(row,'min')===''?null:prvNum(g(row,'min'));const id=g(row,'ideal')===''?null:prvNum(g(row,'ideal'));const pk=g(row,'pack')===''?1:Math.round(prvNum(g(row,'pack')));
  if(mn!==null&&!(mn>=0))x.err.push('stock mínimo inválido');if(id!==null&&!(id>=0))x.err.push('stock ideal inválido');if(!(pk>=1&&pk<=1000))x.err.push('bulto inválido');if(st!==null&&!(st>=0))x.err.push('stock inválido');
  x.stock=st;x.min=mn;x.ideal=id===null?mn:Math.max(id,mn||0);x.pack=pk>=1?pk:1;
  if(!p){x.st='nuevo';if(!(price>0))x.err.push('producto nuevo sin precio de reventa');if(!defRub)x.err.push('no hay rubros cargados para el producto nuevo');}
  else{x.st='existe';if(st!==null&&Math.abs(st-(+stockOf(p)||0))>1e-9)x.warn.push('el stock del archivo ('+st+') no coincide con el del sistema ('+prvR3(+stockOf(p)||0)+'): se mantiene el del sistema');}
  const rn=g(row,'preventista');if(rn&&!x.err.length){const R=prvReps().find(q=>prvNorm(q.name)===prvNorm(rn)&&(!s||q.provId===s.id));x.rep=R||null;x.repName=rn;if(!R){const kk=prvNorm(rn)+'|'+(s?s.id:x.provNew);const d=prvParseDays(g(row,'dias'));
    if(!newRep[kk])newRep[kk]={name:rn,provKey:s?s.id:'',provNew:s?'':x.provNew,wa:prvWa(g(row,'whatsapp')),days:d,freq:/quinc|14|bi/i.test(g(row,'frecuencia'))?'quincenal':/mens|4 sem|month/i.test(g(row,'frecuencia'))?'mensual':'semanal',hora:/^\d{1,2}:\d{2}/.test(g(row,'hora'))?g(row,'hora').padStart(5,'0').slice(0,5):'08:30'};
    else if(!newRep[kk].days.length&&d.length)newRep[kk].days=d;if(!newRep[kk].wa&&prvWa(g(row,'whatsapp')))newRep[kk].wa=prvWa(g(row,'whatsapp'));x.repNew=kk;}}
  if(x.err.length)er++;out.push(x);});
 Object.values(newRep).forEach(r=>{if(!r.days.length)r.warn='sin días de visita: completalos después';});
 return{out,newProv,newRep,er,defRub,optUpd};}
function prvImpPreview(w){const ev=prvImpEval();prvImp.ev=ev;const O=ev.out;const ok=O.filter(x=>!x.err.length);const np=Object.keys(ev.newProv).length,nr=Object.keys(ev.newRep).length;
 const miss=['producto','proveedor'].filter(k=>prvImp.map[k]===undefined);const fields=Object.keys(PRV_COLS);
 $('#prv-pre',w).innerHTML=`<p class="sm">Archivo <b>${esc(prvImp.file)}</b> · ${O.length} fila(s).</p>
  <details ${miss.length?'open':''}><summary>Columnas reconocidas (${Object.keys(prvImp.map).length})</summary><div class="prv-map">${fields.map(k=>`<label>${esc(k)}<select data-mk="${k}"><option value="">—</option>${prvImp.head.map((h,i)=>`<option value="${i}" ${prvImp.map[k]===i?'selected':''}>${esc(h||'Columna '+(i+1))}</option>`).join('')}</select></label>`).join('')}</div></details>
  ${miss.length?`<p class="errbox">Faltan columnas obligatorias: ${miss.join(', ')}.</p>`:''}
  <div class="grid g4 prv-sum"><div><b>${O.filter(x=>x.st==='nuevo'&&!x.err.length).length}</b><span>productos nuevos</span></div><div><b>${O.filter(x=>x.st==='existe'&&!x.err.length).length}</b><span>productos existentes</span></div><div><b>${np}</b><span>proveedores nuevos</span></div><div><b>${nr}</b><span>preventistas nuevos</span></div></div>
  <div class="f"><div><label for="prv-ru">Rubro para productos nuevos</label><select id="prv-ru">${(S.rubros||[]).filter(x=>x.kind==='rubro').map(x=>`<option value="${x.id}" ${ev.defRub===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
  <div><label class="chk"><input type="checkbox" id="prv-up" ${prvImp.upd!==false?'checked':''}> Actualizar costo y precio de los productos que ya existen</label></div></div>
  <p class="sm mut">El stock de los productos que ya existen <b>no se toca</b> (para no corromper el inventario). Los nuevos entran con el stock del archivo.</p>
  ${ev.er?`<p class="errbox">${ev.er} fila(s) con errores no se importan.</p>`:''}
  <div class="tw prv-prev"><table><thead><tr><th>Fila</th><th>Producto</th><th>Proveedor</th><th>Preventista</th><th class="r">Mín / Ideal / Bulto</th><th>Estado</th></tr></thead><tbody>${O.slice(0,300).map(x=>`<tr class="${x.err.length?'prv-er':''}"><td>${x.n}</td><td>${esc(x.name||'')}</td><td>${esc(x.provName||'')}${x.provNew?' <span class="cmp-tag">nuevo</span>':''}</td><td>${esc(x.repName||'')}${x.repNew?' <span class="cmp-tag">nuevo</span>':''}</td><td class="r">${x.min??'—'} / ${x.ideal??'—'} / ${x.pack}</td>
   <td>${x.err.length?'<span class="prv-red">✖ '+esc(x.err.join('; '))+'</span>':(x.st==='nuevo'?'Nuevo':'Existe')+(x.warn.length?'<br><span class="sm prv-amb">⚠ '+esc(x.warn.join('; '))+'</span>':'')}</td></tr>`).join('')}</tbody></table></div>${O.length>300?'<p class="sm mut">Se muestran las primeras 300 filas.</p>':''}`;
 $$('[data-mk]',w).forEach(s=>s.addEventListener('change',()=>{if(s.value==='')delete prvImp.map[s.dataset.mk];else prvImp.map[s.dataset.mk]=+s.value;prvImpPreview(w);}));
 const ru=$('#prv-ru',w);if(ru)ru.addEventListener('change',()=>{prvImp.rub=ru.value;});const up=$('#prv-up',w);if(up)up.addEventListener('change',()=>{prvImp.upd=up.checked;});}
async function prvImpApply(w){const ev=prvImpEval();const G=ev.out.filter(x=>!x.err.length);if(!G.length)return w._err('No hay filas válidas para importar.'),false;
 /* 1) proveedores nuevos (en la nube los guarda el servidor; si alguno falla, no se toca nada más) */
 const provId={};try{for(const [k,p] of Object.entries(ev.newProv)){const r=await CMP.supSave({razon_social:p.razon,cuit:p.cuit,condicion_iva:'Responsable Inscripto'});provId[k]=r.id;}}
 catch(e){return w._err('No se pudo crear un proveedor: '+String(e&&e.message||e)+'. No se importó nada más.'),false;}
 /* 2) productos, preventistas y reglas en un solo paso: si algo falla, se vuelve atrás */
 const snap=JSON.stringify({p:S.products,r:S.prevr||[],q:S.repo||[]});let nP=0,uP=0,nR=0,nQ=0;const created=[];
 try{const repId={};
  for(const [k,r] of Object.entries(ev.newRep)){const pid=r.provKey||provId[r.provNew];if(!pid)continue;const x={id:uid(),ts:now(),upd:now(),ocs:[],name:r.name,provId:pid,wa:r.wa,days:r.days,freq:r.freq,hora:r.hora,avisaVacio:false,activo:true};x.next=x.days.length?prvFirstFrom(x,prvToday()):'';prvReps().push(x);repId[k]=x.id;nR++;}
  const rub=prvImp.rub||ev.defRub;const upd=prvImp.upd!==false&&can('edit_products');
  for(const x of G){let p=x.p;const prov=x.prov?x.prov.id:provId[x.provNew];
   if(!p){p={id:uid(),active:true,desc:'',name:x.name,rubro:rub,price:Math.round(x.price*100),cost:x.cost!==null?Math.round(x.cost*100):0,stock:x.stock||0,unit:'u',barcode:'',menu:false};S.products.push(p);created.push(p.id);nP++;}
   else if(upd){if(x.cost!==null&&can('view_cost'))p.cost=Math.round(x.cost*100);if(x.price!==null&&x.price>0)p.price=Math.round(x.price*100);uP++;}
   if(x.min!==null||x.ideal!==null||x.repNew||x.rep){const rl=prvRule(p.id)||{id:p.id};Object.assign(rl,{provId:prov,repId:x.rep?x.rep.id:(x.repNew&&repId[x.repNew])||rl.repId||'',min:x.min!==null?x.min:(rl.min||0),ideal:x.ideal!==null?x.ideal:(rl.ideal||0),pack:x.pack||1,upd:now()});if(!prvRule(p.id))prvRules().push(rl);nQ++;}}
  if(typeof S.batches!=='undefined'&&Array.isArray(S.batches))S.batches.push({id:uid(),ts:now(),ent:'reventa',file:prvImp.file,created,updated:[],user:user.name});
  audit('IMPORTAR_REVENTA',prvImp.file+' · '+nP+' productos nuevos · '+uP+' actualizados · '+nR+' preventistas · '+nQ+' reglas');save();}
 catch(e){const o=JSON.parse(snap);S.products=o.p;S.prevr=o.r;S.repo=o.q;return w._err('No se importó nada: '+String(e&&e.message||e)),false;}
 toast('Importado: '+nP+' producto(s) nuevo(s), '+uP+' actualizado(s), '+nR+' preventista(s) y '+nQ+' regla(s).');cmpS.tab='prev';cmpRepaint();setTimeout(()=>{try{prvTick();}catch(e){}},300);}

/* ---------- 8) Exportación ---------- */
if(typeof EXPORTS!=='undefined')EXPORTS.preventistas={t:'Preventistas y reglas de reposición',perm:'purchases',h:()=>['producto','codigo','proveedor','preventista','whatsapp','dias_de_visita','frecuencia','hora','costo','precio_reventa','stock_actual','stock_minimo','stock_ideal','bulto'],
 rows:()=>prvRules().filter(x=>prod(x.id)).map(x=>{const p=prod(x.id);const r=x.repId?prvRep(x.repId):prvReps().find(q=>q.provId===x.provId);return[pfull(p),p.barcode||'',prvProvName(x.provId),r?r.name:'',r&&r.wa?'+'+r.wa:'',r?(r.days||[]).map(d=>(PRV_DAYS.find(z=>z[0]===d)||[0,d])[1]).join(' y '):'',r?(PRV_FREQ[r.freq]||{}).t:'',r?r.hora:'',can('view_cost')?(p.cost||0)/100:'',(p.price||0)/100,prvR3(+stockOf(p)||0),x.min||0,x.ideal||0,x.pack||1];})};

/* ---------- 9) Nube: colecciones «prevr» y «repo» (SQL 38) ---------- */
let vb38=false,vb38At=0;
function vb38Enable(){if(vb38||typeof COLS==='undefined')return;[{c:'prevr',key:'prevr',pii:['name','wa']},{c:'repo',key:'repo'}].forEach(x=>{if(!COLS.some(y=>y.c===x.c)){COLS.push(x);BYC[x.c]=x;}});vb38=true;}
if(typeof pushAll==='function'){const _pa=pushAll;pushAll=async function(){if(!vb38&&typeof cl!=='undefined'&&cl.comercio&&Date.now()-vb38At>600000){vb38At=Date.now();try{const v=await rpc('vb_version',{});if(+v>=38)vb38Enable();}catch(e){}}return _pa.apply(this,arguments);};}

/* ---------- 10) Datos de ejemplo (sólo demos) ---------- */
const prvCuit=b=>{const d=String(b).slice(0,10).split('').map(Number);const w=[5,4,3,2,7,6,5,4,3,2];let t=d.reduce((a,x,i)=>a+x*w[i],0);let v=11-t%11;if(v===11)v=0;if(v===10)return prvCuit(String(+b+1));return String(b).slice(0,10)+v;};
function prvDemoSeed(){if(IS_CLIENT||S.prvDemo>=1)return;const X0=window.PRV_SEED||{};
 if(!cmpArr('suppliers').filter(s=>s.activo!==false).length&&X0.sup)X0.sup.forEach((r,i)=>cmpArr('suppliers').push({id:uid(),razon:r,cuit:prvCuit(3071000000+i*1111),iva:'Responsable Inscripto',email:'',tel:'',dir:'',saldo:0,activo:true,ts:now()}));
 const sup=cmpArr('suppliers').filter(s=>s.activo!==false);const P=S.products.filter(p=>!p.archived&&p.active!==false&&!(typeof isKit==='function'&&isKit(p))&&(+stockOf(p)||0)>0).sort((a,b)=>(+stockOf(a)||0)-(+stockOf(b)||0));if(!sup.length||P.length<6)return;S.prvDemo=1;
 const X=window.PRV_SEED||{n:['Martín (preventa)','Carla (preventa)','Diego (preventa)']};const k=prvToday();const di=prvDayIdx(k);const day=i=>PRV_DAYS[(di+i)%7][0];
 const mk=(i,days,hora)=>{const s=sup[i%sup.length];const r={id:uid(),ts:now(),upd:now(),ocs:[],name:X.n[i],provId:s.id,wa:'54938755500'+(10+i),days,freq:i===2?'quincenal':'semanal',hora,avisaVacio:false,activo:true};r.next=prvFirstFrom(r,k);prvReps().push(r);return r;};
 const r0=mk(0,[day(0),day(3)],'08:30'),r1=mk(1,[day(2)],'09:00'),r2=sup.length>2?mk(2,[day(4)],'10:00'):null;
 P.slice(0,18).forEach((p,i)=>{const r=[r0,r1,r2||r0][i%3];const st=+stockOf(p)||0;const low=i%3===0||i%5===0;const mn=low?Math.ceil(st)+Math.max(2,Math.round(st*.2)):Math.max(1,Math.floor(st/3));
  prvRules().push({id:p.id,provId:r.provId,repId:r.id,min:mn,ideal:Math.ceil(mn*1.8),pack:[1,6,12][i%3],upd:now()});});
 save();}
{const _r=cmpRender;cmpRender=function(){try{prvDemoSeed();}catch(e){}return _r.apply(this,arguments);};if(SCREENS.proveedores){const s=SCREENS.proveedores;const r0=s.render;s.render=function(){try{prvDemoSeed();}catch(e){}return r0.apply(this,arguments);};}}

/* ---------- 11) Diseño (variables del sistema, claro/oscuro, 320–1440 px) ---------- */
const PRV_CSS=`<style>
.prv-bar{flex-wrap:wrap;gap:.4rem;margin:.6rem 0}.prv-amb{color:var(--crm-m,#b7791f);font-weight:700}.prv-red{color:var(--crm-a,#c0392b);font-weight:700}.prv-ok{color:#2e9a55;font-weight:700}
.prv-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:.4rem;margin:.4rem 0 .8rem}.prv-day{border:1px solid var(--line);border-radius:12px;padding:.45rem;background:var(--card);min-height:74px;display:flex;flex-direction:column;gap:.25rem;min-width:0}
.prv-day b{font-size:.8rem}.prv-day.hoy{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}.prv-day.past{opacity:.55}.prv-0{color:var(--mut);font-size:.8rem}
.prv-chip{all:unset;cursor:pointer;font-size:.78rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(201,150,62,.16);border:1px solid rgba(201,150,62,.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.prv-chip:focus-visible{outline:2px solid var(--gold)}
.prv-alert{border:1px solid var(--gold);background:rgba(201,150,62,.1);border-radius:14px;padding:.7rem .8rem;margin:.2rem 0 .8rem;display:flex;flex-direction:column;gap:.4rem}.prv-ar{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between}
.prv-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:.7rem}.prv-card{display:flex;flex-direction:column;gap:.35rem}.prv-card.off{opacity:.6}.prv-card h3{margin:0;font-size:1.05rem}.prv-card p{margin:0}
.prv-ch{display:flex;justify-content:space-between;gap:.5rem;align-items:flex-start}.prv-days{display:flex;gap:.25rem;flex-wrap:wrap}.prv-days span{font-size:.72rem;font-weight:700;padding:.15rem .45rem;border-radius:8px;border:1px solid var(--line);color:var(--mut)}
.prv-days span.on{background:var(--gold);border-color:var(--gold);color:#1a1307}.prv-act{flex-wrap:wrap;gap:.3rem;margin-top:.3rem}
.prv-zero{border:1px dashed var(--line);border-radius:14px;padding:1.4rem;text-align:center}.prv-zero .row{justify-content:center}
.prv-fs{border:0;padding:0;margin:.5rem 0}.prv-fs legend{font-weight:600;font-size:.9rem;margin-bottom:.3rem}.prv-dsel{display:flex;flex-wrap:wrap;gap:.3rem}.prv-dsel input{position:absolute;opacity:0}
.prv-dsel span{display:inline-block;min-width:44px;text-align:center;padding:.45rem .5rem;border:1px solid var(--line);border-radius:10px;cursor:pointer;font-weight:600}.prv-dsel input:checked+span{background:var(--gold);border-color:var(--gold);color:#1a1307}.prv-dsel input:focus-visible+span{outline:3px solid var(--gold)}
.prv-tbl td,.prv-tbl th{vertical-align:middle}.prv-in,.prv-q{width:6rem;min-width:0;padding:.3rem .4rem;text-align:right}.prv-low{background:rgba(200,60,50,.06)}.prv-addp{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0}.prv-addp input{flex:1 1 14rem;min-width:0}.prv-addp select{flex:1 1 14rem;min-width:0}
.prv-map{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:.4rem;margin:.4rem 0}.prv-map label{font-size:.8rem;display:flex;flex-direction:column;gap:.15rem}
.prv-sum{margin:.6rem 0}.prv-sum>div{border:1px solid var(--line);border-radius:12px;padding:.5rem;text-align:center}.prv-sum b{display:block;font-size:1.3rem}.prv-sum span{font-size:.75rem;color:var(--mut)}
.prv-prev{max-height:45vh;overflow:auto}.prv-er{background:rgba(200,60,50,.07)}
@media (max-width:900px){.prv-week{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:560px){.prv-week{display:flex;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:.3rem}.prv-day{flex:0 0 92px;min-height:58px;scroll-snap-align:start}.prv-list{grid-template-columns:1fr}.prv-in,.prv-q{width:4.5rem}}
</style>`;
