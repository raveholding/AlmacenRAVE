/* ===== Proveedores y Compras · pantalla (V26) =====
   Tablero (deuda y órdenes pendientes), proveedores ordenables, órdenes de compra, carga de remito y cuenta corriente.
   Todo el cálculo y las reglas están en el motor (p4c-compras.js); acá sólo se captura, se muestra y se confirma. */
IC.truck='M3 6h11v9H3zM14 9h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0-.01M17 18.5a1.5 1.5 0 1 0 0-.01';
let cmpS={tab:'prov',q:'',est:'todos',oest:'pend',cc:'',loadedAt:0,loading:false,err:''};
let crS=null;   /* carga de remito en curso */
let ocS=null;   /* orden de compra que se está armando */
const cmpTag=(t,c)=>`<span class="tag ${c||''}">${esc(t)}</span>`;
const cmpSaldoTag=s=>s>0?cmpTag('Debemos '+money(s),'bad'):(s<0?cmpTag('A favor '+money(-s),'warn'):cmpTag('Al día','ok'));
const cmpOcTag=e=>cmpTag(e,{Borrador:'',Solicitada:'warn',Recibida:'ok',Cancelada:'bad'}[e]||'');
const cmpHoy=()=>dkey(now());
const cmpOcName=o=>'OC-'+String(o.num).padStart(4,'0');
const cmpProvName=id=>(cmpProv(id)||{razon:'(proveedor eliminado)'}).razon;
const cmpErrText=e=>esc((e&&e.message)||String(e));

/* ---------- catálogo para los renglones ---------- */
function cmpProdIndex(){const byLabel=new Map(),labelOf=new Map(),seen={};
 for(const p of S.products){if(!p||p.archived)continue;let l=p.name+(p.sub?' · '+p.sub:'');if(seen[l])l+=' ['+(p.barcode||String(p.id).slice(-4))+']';seen[l]=1;byLabel.set(l,p);labelOf.set(p.id,l);}
 return{byLabel,labelOf};}
function cmpDatalist(){let dl=document.getElementById('cmp-dl');if(!dl){dl=document.createElement('datalist');dl.id='cmp-dl';document.body.appendChild(dl);}
 dl.innerHTML=[...cmpProdIndex().byLabel.keys()].map(l=>`<option value="${esc(l)}"></option>`).join('');}
const cmpBlankRow=()=>({pid:'',txt:'',qty:'',cost:''});
function cmpRowsHtml(rows,mode){const ix=cmpProdIndex();
 return rows.map((r,i)=>{const p=r.pid?S.products.find(x=>x.id===r.pid):null;const pre=mode+'-'+i;
  return `<div class="cmp-row" data-i="${i}">
   <div class="fp"><label for="${pre}-p">Producto</label><input id="${pre}-p" class="r-prod" list="cmp-dl" autocomplete="off" placeholder="Buscar producto…" value="${esc(p?(ix.labelOf.get(p.id)||p.name):(r.txt||''))}"><small class="r-note mut"></small></div>
   <div class="fq"><label for="${pre}-q">Cantidad</label><input id="${pre}-q" class="r-qty" inputmode="decimal" autocomplete="off" placeholder="Ej.: 12" value="${esc(r.qty||'')}"></div>
   <div class="fc"><label for="${pre}-c">${mode==='oc'?'Costo pactado ($)':'Costo unitario ($)'}</label><input id="${pre}-c" class="r-cost" inputmode="decimal" autocomplete="off" placeholder="Ej.: 1.250,50" value="${esc(r.cost||'')}"></div>
   <div class="fs"><label>Subtotal</label><output class="r-sub">—</output></div>
   <button type="button" class="btn ghost r-del" data-act="cmpRowDel" data-mode="${mode}" data-i="${i}" aria-label="Quitar el renglón ${i+1}">✕</button></div>`;}).join('');}
const cmpRowsOf=m=>m==='oc'?(ocS&&ocS.rows):(crS&&crS.rows);
function cmpRowCalc(mode,rowEl,r){if(!rowEl)return;const q=parseNum(r.qty),c=parseNum(r.cost);
 const sub=rowEl.querySelector('.r-sub');sub.textContent=(q>0&&c>=0)?money(Math.round(q*Math.round(c*100)+1e-9)):'—';
 const note=rowEl.querySelector('.r-note');if(!note)return;const p=r.pid?S.products.find(x=>x.id===r.pid):null;const t=[];
 if(p){t.push('Stock actual: '+stockTxt(p));
  if(mode==='rc'&&c>=0&&can('view_cost')){const cur=+p.cost||0,nw=Math.round(c*100);
   if(cur>0&&nw>0&&nw!==cur)t.push('Costo '+money(cur)+' → '+money(nw)+' ('+(nw>cur?'+':'')+(Math.round((nw-cur)/cur*1000)/10).toString().replace('.',',')+' %)');
   else if(cur>0&&nw===cur)t.push('Costo sin cambios');
   if(p.price>0&&nw>0)t.push('margen '+(Math.round((p.price-nw)/p.price*1000)/10).toString().replace('.',',')+' %');}
  if(r.ped!==undefined)t.push('Pedido: '+String(r.ped).replace('.',',')+(r.pact!==undefined?' a '+money(r.pact):''));}
 note.textContent=t.join(' · ');}
function cmpTotals(mode){const rows=cmpRowsOf(mode)||[];let tot=0;
 for(const r of rows){const q=parseNum(r.qty),c=parseNum(r.cost);if(q>0&&c>=0)tot+=Math.round(q*Math.round(c*100)+1e-9);}
 const el=document.getElementById(mode==='oc'?'oc-total':'cr-total');if(el)el.textContent=money(tot);
 if(mode==='rc'){const dec=cmpNum(parseNum(crS.decl));const w=document.getElementById('cr-declwarn');
  if(w)w.textContent=(crS.decl&&!isNaN(dec)&&Math.abs(dec*100-tot)>0.9)?'El total declarado no coincide con la suma de los renglones ('+money(tot)+').':'';}
 return tot;}
function cmpBuildItems(rows,key){const out=[],seen=new Set();
 rows.forEach((r,i)=>{if(!r.pid&&!r.qty&&!r.cost&&!r.txt)return;const n='Renglón '+(i+1)+': ';
  if(!r.pid)throw new CmpErr(n+'elegí un producto de la lista');
  const q=parseNum(r.qty);if(!(q>0))throw new CmpErr(n+'cargá la cantidad');
  const c=parseNum(r.cost);if(isNaN(c)||c<0)throw new CmpErr(n+'cargá el costo (0 si viene bonificado)');
  if(seen.has(r.pid))throw new CmpErr(n+'ese producto está repetido: sumá las cantidades en un solo renglón');seen.add(r.pid);
  out.push({producto_id:r.pid,cantidad:q,[key]:c});});
 if(!out.length)throw new CmpErr('Agregá al menos un producto');return out;}
function cmpRowInput(mode,i,t){const rows=cmpRowsOf(mode);const r=rows&&rows[i];if(!r)return;const rowEl=t.closest('.cmp-row');
 if(t.classList.contains('r-prod')){const p=cmpProdIndex().byLabel.get(t.value);
  if(p){if(r.pid!==p.id){r.pid=p.id;if(!String(r.cost||'').trim()&&p.cost>0){r.cost=pesosStr(p.cost);rowEl.querySelector('.r-cost').value=r.cost;}}r.txt=t.value;}
  else{r.pid='';r.txt=t.value;}}
 else if(t.classList.contains('r-qty'))r.qty=t.value;else if(t.classList.contains('r-cost'))r.cost=t.value;
 cmpRowCalc(mode,rowEl,r);cmpTotals(mode);}
function cmpRowsPaint(mode){const box=document.querySelector('[data-rows="'+mode+'"]');if(!box)return;const rows=cmpRowsOf(mode);
 box.innerHTML=cmpRowsHtml(rows,mode);box.querySelectorAll('.cmp-row').forEach((el,i)=>cmpRowCalc(mode,el,rows[i]));cmpTotals(mode);}
document.addEventListener('input',e=>{const t=e.target;if(!t.closest)return;const row=t.closest('.cmp-row');
 if(row){const box=row.closest('[data-rows]');if(box)cmpRowInput(box.dataset.rows,+row.dataset.i,t);return;}
 if(t.dataset&&t.dataset.cr&&crS){crS[t.dataset.cr]=t.value;if(t.dataset.cr==='q')cmpProvOptions();if(t.dataset.cr==='decl')cmpTotals('rc');}});
document.addEventListener('change',e=>{const t=e.target;if(!t.closest)return;const row=t.closest('.cmp-row');
 if(row){const box=row.closest('[data-rows]');if(box)cmpRowInput(box.dataset.rows,+row.dataset.i,t);return;}
 if(t.dataset&&t.dataset.cr&&crS){const k=t.dataset.cr;crS[k]=t.value;
  if(k==='prov'){crS.oc='';crS.rows=[cmpBlankRow()];crS.res=null;crS.err='';cmpRemitoPaint();}
  else if(k==='oc'){cmpPickOc(t.value);}
  else if(k==='cond'||k==='medio')cmpRemitoPaint();}});
A.cmpRowAdd=el=>{const rows=cmpRowsOf(el.dataset.mode);if(!rows)return;rows.push(cmpBlankRow());cmpRowsPaint(el.dataset.mode);const n=document.querySelectorAll('[data-rows="'+el.dataset.mode+'"] .r-prod');n.length&&n[n.length-1].focus();};
A.cmpRowDel=el=>{const rows=cmpRowsOf(el.dataset.mode);if(!rows)return;rows.splice(+el.dataset.i,1);if(!rows.length)rows.push(cmpBlankRow());cmpRowsPaint(el.dataset.mode);};

/* ---------- carga y repintado ---------- */
function cmpEnsure(force){if(CMP.mode()==='local'){cmpS.loadedAt=now();return;}
 if(cmpS.loading||(!force&&cmpS.loadedAt&&now()-cmpS.loadedAt<20000))return;cmpS.loading=true;cmpS.err='';
 CMP.load().then(()=>{cmpS.loadedAt=now();},e=>{cmpS.err=(e&&e.message)||'error';}).finally(()=>{cmpS.loading=false;
  if(curScreen==='proveedores'&&cmpS.tab!=='remito'&&!document.querySelector('#modal-root .ov'))cmpRepaint();});}
function cmpRepaint(){if(curScreen!=='proveedores'||$('#panel').hidden)return;$('#view').innerHTML=cmpRender();cmpAfter(true);}
async function cmpAfterOp(){cmpS.loadedAt=now();cmpRepaint();}

/* ---------- pantalla ---------- */
function cmpKpis(){const deuda=cmpDeuda(),fav=cmpAFavor(),pend=cmpPend();const nDeb=cmpArr('suppliers').filter(s=>s.saldo>0).length;
 const pendTot=pend.reduce((a,o)=>a+o.total,0);const act=cmpArr('suppliers').filter(s=>s.activo!==false).length;
 return `<div class="grid g3 cmp-kpis" role="group" aria-label="Indicadores de compras">
  <div class="cmp-card kpi"><span>Total deuda a proveedores</span><b class="${deuda>0?'neg':''}" id="k-deuda">${money(deuda)}</b><small class="mut">${nDeb} proveedor${nDeb===1?'':'es'} con saldo${fav>0?' · a favor '+money(fav):''}</small></div>
  <div class="cmp-card kpi"><span>Órdenes pendientes de recepción</span><b id="k-pend">${pend.length}</b><small class="mut">${pend.length?'Por '+money(pendTot)+' · esperando mercadería':'No hay órdenes esperando mercadería'}</small></div>
  <div class="cmp-card kpi"><span>Proveedores activos</span><b>${act}</b><small class="mut">${cmpArr('receipts').length} ingreso${cmpArr('receipts').length===1?'':'s'} de mercadería cargado${cmpArr('receipts').length===1?'':'s'}</small></div></div>`;}
function cmpTabs(){const T=[['prov','Proveedores'],['oc','Órdenes de compra'],['remito','Carga de remito'],['cuenta','Cuenta corriente']];
 return `<div class="cmp-tabs" role="tablist" aria-label="Secciones de compras">${T.map(([k,t])=>`<button type="button" role="tab" class="cmp-tab ${cmpS.tab===k?'on':''}" aria-selected="${cmpS.tab===k}" data-act="cmpTab" data-tab="${k}">${t}${k==='oc'&&cmpPend().length?` <b>${cmpPend().length}</b>`:''}</button>`).join('')}</div>`;}
function cmpRender(){
 const cloud=CMP.mode()==='nube';
 const banner=cloud?(cmpS.err?`<div class="errbox" role="alert">No pude actualizar desde la nube: ${esc(cmpS.err)}. Se muestran los últimos datos conocidos${S.cmpAt?' ('+fmtDT(S.cmpAt)+')':''}; para guardar cambios hace falta conexión.</div>`:(cmpS.loading&&!cmpS.loadedAt?'<div class="warnbox" role="status">Cargando proveedores desde la nube…</div>':'')):'';
 let body='';if(cmpS.tab==='prov')body=cmpProvTab();else if(cmpS.tab==='oc')body=cmpOcTab();else if(cmpS.tab==='remito')body=cmpRemitoTab();else body=cmpCuentaTab();
 return `<div class="cmp"><div class="row"><h1 class="sp">Proveedores y compras</h1>${cloud?cmpTag('☁ En la nube','ok'):cmpTag('Este equipo (sin nube)','')}
  <button class="btn gold" data-act="cmpSupEdit" data-id="">+ Proveedor</button><button class="btn" data-act="cmpOcNew">+ Orden de compra</button><button class="btn dark" data-act="cmpTab" data-tab="remito">Cargar remito</button></div>
  ${banner}${cmpKpis()}${cmpTabs()}<div class="cmp-panel" role="tabpanel">${body}</div>
  <p class="sm mut">Al cargar un remito se suma el stock, se actualiza el costo del producto (el margen se recalcula solo) y, según elijas, queda como deuda con el proveedor o sale de la caja o banco. Si algo falla, no se guarda nada. ${cloud?'En la nube el cálculo lo hace el servidor.':'Sin nube, el cálculo se hace en este equipo.'}</p></div>`;}

/* --- proveedores --- */
function cmpProvList(){const q=cmpS.q.trim().toLowerCase();
 return cmpArr('suppliers').filter(s=>{
  if(cmpS.est==='archivados'?s.activo!==false:s.activo===false)return false;
  if(cmpS.est==='deuda'&&!(s.saldo>0))return false;if(cmpS.est==='aldia'&&s.saldo!==0)return false;
  return !q||s.razon.toLowerCase().includes(q)||s.cuit.includes(q.replace(/\D/g,'')||'§')||(s.email||'').toLowerCase().includes(q);});}
function cmpProvTab(){const L=cmpProvList();
 const rows=L.map(s=>`<tr class="${s.activo===false?'arch':''}"><td data-sv="${esc(s.razon)}"><b>${esc(s.razon)}</b>${s.activo===false?' '+cmpTag('archivado','bad'):''}<br><span class="mut sm">CUIT ${esc(arcaCuitFmt(s.cuit))}</span></td>
  <td class="hm">${esc(s.iva)}</td><td class="sm hm">${s.tel?esc(s.tel)+'<br>':''}${s.email?esc(s.email):'<span class="mut">—</span>'}</td>
  <td class="r" data-sv="${s.saldo}">${cmpSaldoTag(s.saldo)}</td>
  <td class="acts"><button class="btn sm" data-act="cmpCuenta" data-id="${s.id}">Cuenta</button> <button class="btn sm" data-act="cmpPay" data-id="${s.id}" ${s.saldo>0?'':'disabled'}>Pagar</button> <button class="btn sm ghost" data-act="cmpSupEdit" data-id="${s.id}">Editar</button></td></tr>`).join('');
 return `<div class="row"><input id="cp-q" class="cmp-in" placeholder="Buscar por nombre, CUIT o correo…" value="${esc(cmpS.q)}" style="max-width:320px" aria-label="Buscar proveedor">
  <select id="cp-est" class="cmp-in" style="max-width:200px" aria-label="Filtrar por estado de cuenta">${[['todos','Activos'],['deuda','Con deuda'],['aldia','Al día'],['archivados','Archivados']].map(([k,t])=>`<option value="${k}" ${cmpS.est===k?'selected':''}>${t}</option>`).join('')}</select>
  <span class="sp"></span>${expBar('proveedores')}</div>
  <div class="tw"><table class="cmp-table"><thead><tr><th>Proveedor</th><th class="hm">Condición IVA</th><th class="hm">Contacto</th><th class="r">Saldo</th><th data-nosort></th></tr></thead>
  <tbody>${rows||`<tr><td colspan="5" class="mut">${cmpArr('suppliers').length?'Ningún proveedor coincide con el filtro.':'Todavía no cargaste proveedores. Tocá “+ Proveedor”.'}</td></tr>`}</tbody></table></div>
  <p class="sm mut">Tocá el título de una columna para ordenar (▲ ascendente · ▼ descendente), por ejemplo por nombre o por saldo.</p>`;}

/* --- órdenes de compra --- */
function cmpOcTab(){const f=cmpS.oest;
 const L=cmpArr('pOrders').filter(o=>f==='todas'||(f==='pend'?o.estado==='Solicitada':o.estado===f)).slice().sort((a,b)=>b.num-a.num);
 const rows=L.map(o=>`<tr><td data-sv="${o.num}"><b>${cmpOcName(o)}</b></td><td>${esc(cmpProvName(o.provId))}</td><td class="hm" data-sv="${o.fecha}">${esc(fmtDT(o.fecha).slice(0,8))}</td><td>${cmpOcTag(o.estado)}</td><td class="r hm">${o.items.length}</td><td class="r" data-sv="${o.total}">${money(o.total)}</td>
  <td class="acts"><button class="btn sm ghost" data-act="cmpOcView" data-id="${o.id}">Ver</button>
  ${o.estado==='Borrador'?`<button class="btn sm" data-act="cmpOcEdit" data-id="${o.id}">Editar</button> <button class="btn sm gold" data-act="cmpOcEst" data-id="${o.id}" data-e="Solicitada">Solicitar</button> `:''}
  ${o.estado==='Solicitada'?`<button class="btn sm gold" data-act="cmpOcRecibir" data-id="${o.id}">Recibir</button> `:''}
  ${o.estado==='Borrador'||o.estado==='Solicitada'?`<button class="btn sm danger" data-act="cmpOcEst" data-id="${o.id}" data-e="Cancelada">Cancelar</button>`:''}</td></tr>`).join('');
 return `<div class="row"><select id="co-est" class="cmp-in" style="max-width:240px" aria-label="Filtrar órdenes">${[['pend','Pendientes de recepción'],['todas','Todas'],['Borrador','Borradores'],['Recibida','Recibidas'],['Cancelada','Canceladas']].map(([k,t])=>`<option value="${k}" ${f===k?'selected':''}>${t}</option>`).join('')}</select><span class="sp"></span>${expBar('ordenes_compra')}<button class="btn gold" data-act="cmpOcNew">+ Orden de compra</button></div>
  <div class="tw"><table class="cmp-table"><thead><tr><th>Orden</th><th>Proveedor</th><th class="hm">Emitida</th><th>Estado</th><th class="r hm">Renglones</th><th class="r">Total</th><th data-nosort></th></tr></thead>
  <tbody>${rows||'<tr><td colspan="7" class="mut">No hay órdenes con este filtro.</td></tr>'}</tbody></table></div>`;}

/* --- cuenta corriente --- */
function cmpCuentaTab(){const L=cmpArr('suppliers').filter(s=>s.activo!==false||s.saldo!==0).slice().sort((a,b)=>a.razon.localeCompare(b.razon,'es'));
 if(!cmpS.cc||!cmpProv(cmpS.cc))cmpS.cc=(L[0]||{}).id||'';const s=cmpProv(cmpS.cc);
 const opts=L.map(x=>`<option value="${x.id}" ${x.id===cmpS.cc?'selected':''}>${esc(x.razon)}</option>`).join('');
 if(!s)return '<p class="mut">Cargá un proveedor para ver su cuenta corriente.</p>';
 const led=cmpArr('supLedger').filter(x=>x.provId===s.id).slice().sort((a,b)=>(b.seq||0)-(a.seq||0));
 const lrows=led.map(c=>`<tr><td data-sv="${c.ts}">${esc(fmtDT(c.ts))}</td><td>${esc(c.tipo)}</td><td>${esc(c.ref||'—')}${c.motivo?'<br><span class="mut sm">'+esc(c.motivo)+'</span>':''}</td><td class="r ${c.tipo==='Pago'||c.tipo==='Nota de Crédito'?'':'neg'}" data-sv="${c.monto*(c.tipo==='Pago'||c.tipo==='Nota de Crédito'?-1:1)}">${c.tipo==='Pago'||c.tipo==='Nota de Crédito'?'− ':'+ '}${money(c.monto)}</td><td class="r" data-sv="${c.saldo}">${money(c.saldo)}</td></tr>`).join('');
 const rcp=cmpArr('receipts').filter(r=>r.provId===s.id).slice().sort((a,b)=>b.ts-a.ts);
 const rrows=rcp.map(r=>`<tr><td data-sv="${r.ts}">${esc(dmy(r.fecha))}</td><td>${esc(r.tipo)} ${esc(r.nro)}</td><td class="r">${r.items.length}</td><td>${r.cond==='contado'?'Contado'+(r.medio?' · '+esc(CMP_MEDIOS[r.medio]||r.medio):''):'Cuenta corriente'}</td><td class="r" data-sv="${r.total}">${money(r.total)}</td><td><button class="btn sm ghost" data-act="cmpRcView" data-id="${r.id}">Ver detalle</button></td></tr>`).join('');
 return `<div class="row"><label for="cc-prov" class="sr">Proveedor</label><select id="cc-prov" class="cmp-in" style="max-width:340px">${opts}</select><span class="sp"></span>${expBar('cuenta_proveedores')}</div>
  <div class="cmp-card cmp-acct"><div><span class="mut sm">${esc(s.iva)} · CUIT ${esc(arcaCuitFmt(s.cuit))}</span><h3 style="margin:.1rem 0">${esc(s.razon)}</h3>${cmpSaldoTag(s.saldo)}</div>
  <div class="row"><button class="btn gold" data-act="cmpPay" data-id="${s.id}" ${s.saldo>0?'':'disabled'}>Registrar pago</button><button class="btn" data-act="cmpNc" data-id="${s.id}">Nota de crédito</button><button class="btn dark" data-act="cmpRemitoFor" data-id="${s.id}">Cargar remito</button></div></div>
  <h3>Movimientos</h3><div class="tw"><table class="cmp-table"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Referencia</th><th class="r">Importe</th><th class="r">Saldo</th></tr></thead><tbody>${lrows||'<tr><td colspan="5" class="mut">Sin movimientos todavía.</td></tr>'}</tbody></table></div>
  <h3>Ingresos de mercadería</h3><div class="tw"><table class="cmp-table"><thead><tr><th>Fecha</th><th>Comprobante</th><th class="r">Productos</th><th>Pago</th><th class="r">Total</th><th data-nosort></th></tr></thead><tbody>${rrows||'<tr><td colspan="6" class="mut">Sin ingresos cargados.</td></tr>'}</tbody></table></div>
  ${expBar('ingresos_mercaderia')}`;}

/* --- carga de remito --- */
function cmpNewRemito(provId){crS={prov:provId||'',q:'',oc:'',tipo:'Factura',nro:'',fecha:cmpHoy(),cond:'credito',medio:'efectivo',rubro:'',decl:'',obs:'',rows:[cmpBlankRow()],key:cmpKey(),busy:false,res:null,err:''};}
function cmpProvOptions(){const sel=document.getElementById('cr-prov');if(!sel||!crS)return;const q=(crS.q||'').trim().toLowerCase();const qd=q.replace(/\D/g,'');
 const L=cmpArr('suppliers').filter(s=>s.activo!==false&&(!q||s.razon.toLowerCase().includes(q)||(qd&&s.cuit.includes(qd)))).sort((a,b)=>a.razon.localeCompare(b.razon,'es'));
 sel.innerHTML=L.map(s=>`<option value="${s.id}" ${s.id===crS.prov?'selected':''}>${esc(s.razon)} · ${esc(arcaCuitFmt(s.cuit))}${s.saldo>0?' · debemos '+esc(money(s.saldo)):''}</option>`).join('');
 sel.size=Math.max(2,Math.min(5,L.length));const n=document.getElementById('cr-provn');if(n)n.textContent=L.length?L.length+' coincidencia'+(L.length===1?'':'s'):'Ningún proveedor coincide';}
function cmpPickOc(id){if(!crS)return;crS.oc=id;crS.res=null;crS.err='';
 if(id){const o=cmpArr('pOrders').find(x=>x.id===id);if(o){crS.rows=o.items.map(i=>({pid:i.pid,txt:'',qty:String(i.qty).replace('.',','),cost:pesosStr(i.cost),ped:i.qty,pact:i.cost}));toast('Cargué los productos de '+cmpOcName(o)+': ajustá lo realmente recibido y el costo facturado');}}
 else crS.rows=[cmpBlankRow()];cmpRemitoPaint();}
function cmpRemitoTab(){if(!crS)cmpNewRemito('');return `<div id="cr-box">${cmpRemitoInner()}</div>`;}
function cmpRemitoInner(){const c=crS;
 if(c.res)return cmpRemitoResult(c.res);
 const prov=cmpProv(c.prov);const ocs=prov?cmpArr('pOrders').filter(o=>o.provId===prov.id&&o.estado==='Solicitada').sort((a,b)=>b.num-a.num):[];
 const sess=openSess();const rubs=S.rubros.filter(r=>r.kind!=='cobr'&&!r.sys);
 const contado=c.cond==='contado';
 return `<div class="cmp-form" id="cr-form" role="group" aria-label="Carga de remito">
  <fieldset class="cmp-card"><legend>1 · Proveedor y orden de compra</legend>
   <label for="cr-qin">Buscar proveedor (nombre o CUIT)</label><input id="cr-qin" class="cmp-in" data-cr="q" autocomplete="off" placeholder="Escribí para filtrar la lista" value="${esc(c.q)}">
   <label for="cr-prov">Proveedor <span class="mut" id="cr-provn"></span></label><select id="cr-prov" class="cmp-in" data-cr="prov" size="4" aria-describedby="cr-provn"></select>
   <label for="cr-oc">Orden de compra pendiente</label><select id="cr-oc" class="cmp-in" data-cr="oc" ${prov?'':'disabled'}><option value="">${prov?(ocs.length?'Sin orden (compra directa)':'Sin órdenes pendientes: compra directa'):'Elegí primero un proveedor'}</option>${ocs.map(o=>`<option value="${o.id}" ${o.id===c.oc?'selected':''}>${cmpOcName(o)} · ${esc(fmtDT(o.fecha).slice(0,8))} · ${esc(money(o.total))}</option>`).join('')}</select></fieldset>
  <fieldset class="cmp-card"><legend>2 · Comprobante</legend><div class="grid g3">
   <div><label for="cr-tipo">Tipo</label><select id="cr-tipo" class="cmp-in" data-cr="tipo"><option ${c.tipo==='Factura'?'selected':''}>Factura</option><option ${c.tipo==='Remito'?'selected':''}>Remito</option></select></div>
   <div><label for="cr-nro">Número (ej.: 0001-00004521)</label><input id="cr-nro" class="cmp-in" data-cr="nro" maxlength="40" autocomplete="off" value="${esc(c.nro)}"></div>
   <div><label for="cr-fecha">Fecha de recepción</label><input id="cr-fecha" type="date" class="cmp-in" data-cr="fecha" max="${esc(addDays(cmpHoy(),1))}" value="${esc(c.fecha)}"></div></div></fieldset>
  <fieldset class="cmp-card"><legend>3 · Productos recibidos y costo actualizado</legend>
   <div data-rows="rc">${cmpRowsHtml(c.rows,'rc')}</div>
   <div class="row" style="margin-top:.6rem"><button type="button" class="btn" data-act="cmpRowAdd" data-mode="rc">+ Agregar producto</button><span class="sp"></span><span class="cmp-total">Total: <b id="cr-total">$ 0</b></span></div>
   <div class="grid g2"><div><label for="cr-decl">Total del comprobante (opcional, para controlar)</label><input id="cr-decl" class="cmp-in" inputmode="decimal" data-cr="decl" autocomplete="off" placeholder="Ej.: 125.400,50" value="${esc(c.decl)}"><small id="cr-declwarn" class="errtxt" role="status"></small></div>
   <div><label for="cr-obs">Observaciones</label><input id="cr-obs" class="cmp-in" data-cr="obs" maxlength="500" autocomplete="off" value="${esc(c.obs)}"></div></div></fieldset>
  <fieldset class="cmp-card"><legend>4 · Cómo se paga</legend>
   <div class="row"><label class="chk"><input type="radio" name="cr-cond" data-cr="cond" value="credito" ${contado?'':'checked'}> A cuenta corriente (queda como deuda con el proveedor)</label>
   <label class="chk"><input type="radio" name="cr-cond" data-cr="cond" value="contado" ${contado?'checked':''}> Al contado (sale de caja o banco)</label></div>
   ${contado?`<div class="grid g3"><div><label for="cr-medio">Medio de pago</label><select id="cr-medio" class="cmp-in" data-cr="medio">${Object.entries(CMP_MEDIOS).map(([k,t])=>`<option value="${k}" ${c.medio===k?'selected':''}>${t}</option>`).join('')}</select></div>
    ${ownerMode()?'<div><label>Pago</label><div class="cmp-note">Lo paga el negocio (sin rubro)</div></div>':`<div><label for="cr-rubro">Rubro del egreso (obligatorio)</label><select id="cr-rubro" class="cmp-in" data-cr="rubro"><option value="">— Elegí un rubro —</option>${rubs.map(r=>`<option value="${esc(r.id)}" ${c.rubro===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></div>`}
    <div>${c.medio==='efectivo'&&cmpCanPick()&&cmpOpenTurnos().length?`<label for="cr-turno">Caja de donde sale el efectivo</label>${cmpCajaPick('cr-turno','data-cr="turno"',c.turno)}`:`<label>Caja</label><div class="cmp-note">${c.medio==='efectivo'?(sess?'Sale del efectivo de la caja '+esc(S.tenant.caja)+' (abierta)':'<b class="errtxt">No hay caja abierta: abrila en Caja o elegí otro medio</b>'):'No mueve el efectivo de la caja'}</div>`}</div></div>`:'<p class="sm mut">Se registra la factura o el remito en la cuenta corriente del proveedor. El pago se registra después desde “Cuenta”.</p>'}</fieldset>
  <div class="errbox" id="cr-err" role="alert" ${c.err?'':'hidden'}>${esc(c.err)}</div>
  <div class="row"><button type="button" class="btn gold cmp-big" data-act="cmpRemitoGo" ${c.busy?'disabled':''}>Revisar y confirmar ingreso</button><button type="button" class="btn ghost" data-act="cmpRemitoReset">Limpiar formulario</button></div></div>`;}
function cmpRemitoPaint(){const box=document.getElementById('cr-box');if(!box||!crS)return;box.innerHTML=cmpRemitoInner();cmpRemitoAfter();}
function cmpRemitoAfter(){if(!crS||crS.res)return;cmpDatalist();cmpProvOptions();
 const rows=crS.rows;document.querySelectorAll('[data-rows="rc"] .cmp-row').forEach((el,i)=>cmpRowCalc('rc',el,rows[i]));cmpTotals('rc');}
function cmpRemitoResult(r){
 const rows=r.items.map(i=>`<tr><td>${esc(i.nombre)}</td><td class="r">${esc(String(i.cantidad).replace('.',','))}</td><td class="r">${esc(String(i.stock_anterior).replace('.',','))} → <b>${esc(String(i.stock_nuevo).replace('.',','))}</b></td>${can('view_cost')?`<td class="r">${esc(money(p2c(i.costo_anterior)))} → <b>${esc(money(p2c(i.costo_nuevo)))}</b></td><td class="r">${i.margen_pct===null||i.margen_pct===undefined?'—':esc(String(i.margen_pct).replace('.',','))+' %'}</td>`:''}</tr>`).join('');
 const dif=(r.diferencias||[]).map(d=>`<li>${esc(d.nombre)}: pedido ${esc(String(d.cantidad_pedida).replace('.',','))}, recibido ${esc(String(d.cantidad_recibida).replace('.',','))}; costo pactado ${esc(money(p2c(d.costo_pactado)))} vs. facturado ${d.costo_facturado===null?'—':esc(money(p2c(d.costo_facturado)))}</li>`).join('');
 return `<div class="cmp-card cmp-res" role="status"><h3>${r.repetido?'Este comprobante ya estaba registrado (no se duplicó nada)':'Ingreso de mercadería registrado'}</h3>
  <p>${esc(r.tipo_comprobante)} <b>${esc(r.nro_comprobante)}</b> · ${esc(cmpProvName(r.proveedor_id))} · total <b>${esc(money(p2c(r.total)))}</b> · ${r.condicion_pago==='contado'?'pagado al contado ('+esc(CMP_MEDIOS[r.medio_pago]||r.medio_pago)+')':'cargado a la cuenta corriente'}${r.orden_estado?' · la orden quedó <b>Recibida</b>':''}.</p>
  <p>Saldo actual con el proveedor: <b>${esc(money(p2c(r.saldo_proveedor)))}</b>${r.movimiento_caja_id?' · egreso registrado en la caja':''}.</p>
  <div class="tw"><table class="cmp-table"><thead><tr><th>Producto</th><th class="r">Cant.</th><th class="r">Stock</th>${can('view_cost')?'<th class="r">Costo</th><th class="r">Margen</th>':''}</tr></thead><tbody>${rows}</tbody></table></div>
  ${dif?`<div class="warnbox"><b>Diferencias contra la orden de compra</b><ul>${dif}</ul></div>`:''}
  <div class="row"><button class="btn gold cmp-big" data-act="cmpRemitoReset">Cargar otro remito</button><button class="btn" data-act="cmpTab" data-tab="cuenta">Ver cuenta corriente</button></div></div>`;}

/* ---------- acciones: navegación ---------- */
function cmpAfter(){cmpDatalist();
 const q=$('#cp-q');if(q){q.addEventListener('input',e=>{cmpS.q=e.target.value;const p=e.target.selectionStart;cmpRepaint();const n=$('#cp-q');if(n){n.focus();try{n.setSelectionRange(p,p);}catch(_){}}});}
 const fe=$('#cp-est');if(fe)fe.addEventListener('change',e=>{cmpS.est=e.target.value;cmpRepaint();});
 const oe=$('#co-est');if(oe)oe.addEventListener('change',e=>{cmpS.oest=e.target.value;cmpRepaint();});
 const cc=$('#cc-prov');if(cc)cc.addEventListener('change',e=>{cmpS.cc=e.target.value;cmpRepaint();});
 if(cmpS.tab==='remito')cmpRemitoAfter();
 if(arguments[0]!==true)cmpEnsure(true);}
A.cmpTab=el=>{cmpS.tab=el.dataset.tab;if(cmpS.tab==='remito'&&crS&&crS.res)cmpNewRemito('');if(location.hash!=='#panel/proveedores')go('proveedores');else cmpRepaint();};
A.cmpCuenta=el=>{cmpS.cc=el.dataset.id;cmpS.tab='cuenta';cmpRepaint();};
A.cmpRemitoFor=el=>{cmpNewRemito(el.dataset.id);cmpS.tab='remito';cmpRepaint();};
A.cmpRemitoReset=()=>{cmpNewRemito(crS?crS.prov:'');cmpRepaint();};
A.cmpOcRecibir=el=>{const o=cmpArr('pOrders').find(x=>x.id===el.dataset.id);if(!o)return;cmpNewRemito(o.provId);cmpS.tab='remito';cmpRepaint();cmpPickOc(o.id);};
reg('proveedores','Proveedores y compras','truck','purchases',cmpRender,cmpAfter,'Operación');

/* ---------- proveedores: alta, edición y archivo ---------- */
A.cmpSupEdit=el=>{if(!can('purchases'))return toast('Sin permiso',1);const s=el.dataset.id?cmpProv(el.dataset.id):null;
 const w=modal(s?'Editar proveedor':'Nuevo proveedor',`<div class="cmp">
  <label for="sp-rs">Razón social</label><input id="sp-rs" class="cmp-in" maxlength="120" autocomplete="off" value="${esc(s?s.razon:'')}">
  <div class="grid g2"><div><label for="sp-cuit">CUIT (11 dígitos)</label><input id="sp-cuit" class="cmp-in" inputmode="numeric" maxlength="13" autocomplete="off" placeholder="30-12345678-1" value="${esc(s?arcaCuitFmt(s.cuit):'')}"></div>
  <div><label for="sp-iva">Condición frente al IVA</label><select id="sp-iva" class="cmp-in">${CMP_IVA.map(x=>`<option ${s&&s.iva===x?'selected':''}>${x}</option>`).join('')}</select></div></div>
  <div class="grid g2"><div><label for="sp-em">Correo</label><input id="sp-em" class="cmp-in" type="email" maxlength="120" autocomplete="off" value="${esc(s?s.email:'')}"></div>
  <div><label for="sp-tel">Teléfono / WhatsApp</label><input id="sp-tel" class="cmp-in" inputmode="tel" maxlength="40" autocomplete="off" value="${esc(s?s.tel:'')}"></div></div>
  <label for="sp-dir">Dirección</label><input id="sp-dir" class="cmp-in" maxlength="200" autocomplete="off" value="${esc(s?s.dir:'')}">
  ${s?`<label class="chk"><input type="checkbox" id="sp-act" ${s.activo!==false?'checked':''}> Proveedor activo (si lo desmarcás se archiva: no se le cargan compras nuevas, el historial queda)</label><p class="sm mut">Saldo actual: ${cmpSaldoTag(s.saldo)} — el saldo sólo cambia con remitos, pagos y notas de crédito.</p>`:''}</div>`,
  {okText:'Guardar proveedor',onOk:async w=>{
   const cuit=val('sp-cuit').replace(/\D/g,'');if(!arcaCuitOk(cuit)){w._err('El CUIT no es válido: revisá los 11 dígitos (el último es un dígito verificador).');return false;}
   try{const r=await CMP.supSave({id:s?s.id:undefined,razon_social:val('sp-rs'),cuit,condicion_iva:val('sp-iva'),email:val('sp-em'),telefono:val('sp-tel'),direccion:val('sp-dir'),activo:s?$('#sp-act').checked:true});
    toast(s?'Proveedor actualizado':'Proveedor creado');cmpAfterOp();}catch(e){w._err(e.message);return false;}}});};

/* ---------- órdenes de compra ---------- */
function cmpOcOpen(o){if(!can('purchases'))return toast('Sin permiso',1);
 const provs=cmpArr('suppliers').filter(s=>s.activo!==false);
 if(!provs.length){toast('Primero cargá un proveedor',1);return;}
 ocS=o?{id:o.id,prov:o.provId,obs:o.obs||'',rows:o.items.map(i=>({pid:i.pid,txt:'',qty:String(i.qty).replace('.',','),cost:pesosStr(i.cost)})),key:null}
    :{id:'',prov:(cmpS.cc&&cmpProv(cmpS.cc)&&cmpProv(cmpS.cc).activo!==false)?cmpS.cc:provs[0].id,obs:'',rows:[cmpBlankRow()],key:cmpKey()};
 cmpDatalist();
 const w=modal(o?'Editar '+cmpOcName(o):'Nueva orden de compra',`<div class="cmp">
  <label for="oc-prov">Proveedor</label><select id="oc-prov" class="cmp-in" ${o?'disabled':''}>${provs.map(s=>`<option value="${s.id}" ${s.id===ocS.prov?'selected':''}>${esc(s.razon)}</option>`).join('')}</select>
  <div data-rows="oc">${cmpRowsHtml(ocS.rows,'oc')}</div>
  <div class="row" style="margin-top:.6rem"><button type="button" class="btn" data-act="cmpRowAdd" data-mode="oc">+ Agregar producto</button><span class="sp"></span><span class="cmp-total">Total: <b id="oc-total">$ 0</b></span></div>
  <label for="oc-obs">Observaciones</label><input id="oc-obs" class="cmp-in" maxlength="500" autocomplete="off" value="${esc(ocS.obs)}">
  <p class="sm mut">“Solicitar” deja la orden esperando mercadería (se recibe desde Carga de remito). “Guardar borrador” te deja editarla después.</p>
  <div class="row"><button type="button" class="btn" data-act="cmpOcDraft">Guardar borrador</button></div></div>`,
  {wide:true,okText:'Guardar y solicitar',onOk:w=>cmpOcSave(w,'Solicitada')});
 w.querySelectorAll('.cmp-row').forEach((el,i)=>cmpRowCalc('oc',el,ocS.rows[i]));cmpTotals('oc');return w;}
async function cmpOcSave(w,estado){if(!ocS)return false;
 try{const items=cmpBuildItems(ocS.rows,'precio_costo_pactado');
  if(estado==='Solicitada'&&items.some(i=>!(i.precio_costo_pactado>0)))throw new CmpErr('Para solicitar la orden cargá el costo pactado de todos los productos (o guardala como borrador).');
  await CMP.ocSave({id:ocS.id||undefined,proveedor_id:val('oc-prov')||ocS.prov,estado,observaciones:val('oc-obs'),items,idempotency_key:ocS.id?undefined:ocS.key});
  toast(estado==='Solicitada'?'Orden solicitada':'Borrador guardado');ocS=null;cmpAfterOp();return true;}
 catch(e){w._err(e.message);return false;}}
A.cmpOcNew=()=>{cmpS.tab=cmpS.tab==='prov'||cmpS.tab==='oc'||cmpS.tab==='cuenta'?cmpS.tab:'oc';cmpOcOpen(null);};
A.cmpOcEdit=el=>{const o=cmpArr('pOrders').find(x=>x.id===el.dataset.id);if(o&&o.estado==='Borrador')cmpOcOpen(o);};
A.cmpOcDraft=async el=>{const w=el.closest('.ov');if(!w)return;if(await cmpOcSave(w,'Borrador'))w.remove();};
A.cmpOcEst=el=>{const o=cmpArr('pOrders').find(x=>x.id===el.dataset.id);if(!o)return;const e=el.dataset.e;
 const go2=async()=>{try{await CMP.ocEstado(o.id,e);toast(e==='Solicitada'?'Orden solicitada':'Orden cancelada');cmpAfterOp();}catch(err){toast(err.message,1);}};
 if(e==='Cancelada')confirmBox('Cancelar orden de compra','¿Cancelás la '+esc(cmpOcName(o))+' de '+esc(cmpProvName(o.provId))+'? No se puede reactivar.',go2,'Cancelar orden');else go2();};
A.cmpOcView=el=>{const o=cmpArr('pOrders').find(x=>x.id===el.dataset.id);if(!o)return;
 modal(cmpOcName(o)+' · '+cmpProvName(o.provId),`<div class="cmp"><p>${cmpOcTag(o.estado)} Emitida ${esc(fmtDT(o.fecha))}${o.recibidaAt?' · recibida '+esc(fmtDT(o.recibidaAt)):''}</p>
  <div class="tw"><table class="cmp-table"><thead><tr><th>Producto</th><th class="r">Cantidad</th><th class="r">Costo pactado</th><th class="r">Subtotal</th></tr></thead><tbody>${o.items.map(i=>`<tr><td>${esc(i.name)}</td><td class="r">${esc(String(i.qty).replace('.',','))}</td><td class="r">${money(i.cost)}</td><td class="r">${money(Math.round(i.qty*i.cost))}</td></tr>`).join('')}</tbody></table></div>
  <p><b>Total ${money(o.total)}</b></p>${o.obs?'<p class="mut">'+esc(o.obs)+'</p>':''}</div>`,{wide:true,ok:false,cancelText:'Cerrar'});};
A.cmpRcView=el=>{const r=cmpArr('receipts').find(x=>x.id===el.dataset.id);if(!r)return;const cv=can('view_cost');
 modal(r.tipo+' '+r.nro+' · '+cmpProvName(r.provId),`<div class="cmp"><p>Recibido el ${esc(dmy(r.fecha))} · ${r.cond==='contado'?'Contado'+(r.medio?' ('+esc(CMP_MEDIOS[r.medio]||r.medio)+')':''):'Cuenta corriente'}${r.obs?' · '+esc(r.obs):''}</p>
  <div class="tw"><table class="cmp-table"><thead><tr><th>Producto</th><th class="r">Cantidad</th><th class="r">Costo</th>${cv?'<th class="r">Costo anterior</th>':''}<th class="r">Stock</th></tr></thead><tbody>${r.items.map(i=>`<tr><td>${esc(i.name)}</td><td class="r">${esc(String(i.qty).replace('.',','))}</td><td class="r">${money(i.cost)}</td>${cv?`<td class="r">${money(i.costAnt)}</td>`:''}<td class="r">${i.stockAnt===null||i.stockAnt===undefined?'—':esc(String(i.stockAnt).replace('.',','))+' → '+esc(String(i.stockNew).replace('.',','))}</td></tr>`).join('')}</tbody></table></div>
  <p><b>Total ${money(r.total)}</b></p></div>`,{wide:true,ok:false,cancelText:'Cerrar'});};

/* ---------- confirmar ingreso de mercadería ---------- */
A.cmpRemitoGo=()=>{if(!crS||crS.busy)return;if(!can('purchases'))return toast('Sin permiso',1);const c=crS;const err=m=>{c.err=m;const e=document.getElementById('cr-err');if(e){e.textContent=m;e.hidden=false;e.scrollIntoView({block:'nearest'});}};
 let payload,tot;
 try{const prov=cmpProv(c.prov);if(!prov)throw new CmpErr('Elegí el proveedor de la lista.');
  const nro=String(c.nro||'').trim();if(!nro)throw new CmpErr('Cargá el número del comprobante.');
  const items=cmpBuildItems(c.rows,'precio_costo');tot=cmpTotals('rc');
  payload={idempotency_key:c.key,proveedor_id:prov.id,orden_compra_id:c.oc||undefined,tipo_comprobante:c.tipo,nro_comprobante:nro,fecha_recepcion:c.fecha||undefined,condicion_pago:c.cond,observaciones:c.obs||undefined,items};
  const dec=parseNum(c.decl);if(String(c.decl||'').trim()){if(isNaN(dec))throw new CmpErr('El total del comprobante no es un número válido.');if(Math.abs(dec*100-tot)>0.9)throw new CmpErr('El total del comprobante ('+money(Math.round(dec*100))+') no coincide con la suma de los renglones ('+money(tot)+'). Revisá cantidades y costos.');payload.total_declarado=dec;}
  if(c.cond==='contado'){if(ownerMode())c.rubro=ownerRubro();if(!c.rubro)throw new CmpErr('Elegí el rubro del egreso: es obligatorio en todo movimiento de dinero.');
   payload.medio_pago=c.medio;payload.rubro_id=c.rubro;
   if(c.medio==='efectivo'){let s=openSess();if(cmpCanPick()){const tid=c.turno||val('cr-turno');const t=cmpOpenTurnos().find(x=>x.id===tid);if(t)s=t;}if(!s)throw new CmpErr('Para pagar en efectivo tiene que haber una caja abierta (Caja → Abrir caja), o elegí otro medio de pago.');payload.turno_id=s.id;c.turnoName=cmpTurnoName(s);}}
  c.err='';const e0=document.getElementById('cr-err');if(e0)e0.hidden=true;
 }catch(e){err(e.message);return;}
 const unidades=payload.items.reduce((a,i)=>a+i.cantidad,0);const prov=cmpProv(c.prov);
 const impacto=[`Entran <b>${esc(String(Math.round(unidades*1000)/1000).replace('.',','))}</b> unidades en <b>${payload.items.length}</b> producto${payload.items.length===1?'':'s'} (se suman al stock).`,
  `El costo de cada producto pasa a ser el que cargaste (cuando es mayor a cero) y el margen se recalcula.`,
  c.cond==='contado'?`Se paga <b>${esc(money(tot))}</b> al contado por <b>${esc(CMP_MEDIOS[c.medio])}</b>${c.medio==='efectivo'?' y sale del efectivo de <b>'+esc(c.turnoName||'la caja abierta')+'</b>':''}. La deuda con el proveedor no cambia.`:`Se suman <b>${esc(money(tot))}</b> a lo que le debés a ${esc(prov.razon)} (hoy: ${esc(money(prov.saldo))}).`,
  c.oc?`La orden de compra pasa a <b>Recibida</b>.`:'No está vinculado a una orden de compra.'];
 modal('Confirmar ingreso de mercadería',`<div class="cmp"><p><b>${esc(c.tipo)} ${esc(payload.nro_comprobante)}</b> · ${esc(prov.razon)} · total <b>${esc(money(tot))}</b></p><ul>${impacto.map(x=>`<li>${x}</li>`).join('')}</ul><p class="sm mut">Se guarda todo junto o no se guarda nada.</p></div>`,
  {okText:'Confirmar ingreso',onOk:async w=>{if(c.busy)return false;c.busy=true;
   try{const r=await CMP.recibir(payload);c.res=r;c.key=cmpKey();c.busy=false;toast(r.repetido?'Ese comprobante ya estaba registrado':'Mercadería ingresada');cmpS.loadedAt=now();cmpRepaint();return true;}
   catch(e){c.busy=false;w._err(e.message);return false;}}});};

/* V26.14: el dueño / administrador elige de qué caja sale el efectivo (cualquier caja ABIERTA, de cualquier equipo).
   Una caja cerrada no se toca (su cierre está sellado): se avisa que primero se traspase el dinero a una abierta o se abra. */
const cmpCanPick=()=>!!user&&user.role==='admin';
const cmpOpenTurnos=()=>(S.sessions||[]).filter(x=>!x.closedAt);
const cmpTurnoName=ss=>(ss.regName||('Caja '+ss.caja))+(ss.caja===S.tenant.caja&&!ss.regName?' (este equipo)':'');
function cmpTurnoExp(ss){try{return arqueoCalc(ss,arqInputs(ss)).expectedCash;}catch(e){return 0;}}
function cmpCajaPick(id,attrs,cur){const L=cmpOpenTurnos();const own=openSess();const sel=cur||(own?own.id:(L[0]||{}).id||'');
 const closed=(typeof cashOn==='function'&&cashOn())?(S.registers||[]).filter(r=>r.active!==false&&!L.some(t=>t.regId===r.id)):[];
 return`<select id="${id}" class="cmp-in" ${attrs||''} aria-label="Caja de donde sale el efectivo">${L.map(t=>`<option value="${esc(t.id)}" ${t.id===sel?'selected':''}>${esc(cmpTurnoName(t))} · efectivo esperado ${money(cmpTurnoExp(t))}</option>`).join('')}${closed.map(r=>`<option disabled>${esc(r.name)} · cerrada (traspasá el dinero a una caja abierta o abrila)</option>`).join('')}</select>`;}
/* ---------- pagos y notas de crédito ---------- */
/* En la nube, repartir un pago entre cajas exige la migración 12 en el servidor: se detecta (la tabla existe) y, si falta, la opción no se ofrece. */
const CMP12={ok:null};
async function cmp12Probe(){try{await sel('pagos_proveedor_asignaciones?select=id&limit=1');CMP12.ok=true;}catch(e){CMP12.ok=(e&&(e.net||(e.status&&e.status!==404&&e.status!==400)))?null:false;}}
A.cmpPay=async el=>{if(!can('purchases'))return toast('Sin permiso',1);const s=cmpProv(el.dataset.id);if(!s)return;if(!(s.saldo>0)){toast('Este proveedor no tiene deuda',1);return;}
 if(typeof cmpCloud==='function'&&cmpCloud()&&CMP12.ok===null)await cmp12Probe();
 const key=cmpKey();const noR=ownerMode()||(typeof xfCfg==='function'&&xfCfg().noRubro);const rubs=S.rubros.filter(r=>r.kind!=='cobr'&&!r.sys);const sess=openSess();
 const abiertas=(S.sessions||[]).filter(x=>!x.closedAt);const multi=abiertas.length>1&&(!(typeof cmpCloud==='function'&&cmpCloud())||CMP12.ok===true);
 const exp=ss=>{try{return arqueoCalc(ss,arqInputs(ss)).expectedCash;}catch(e){return 0;}};
 const cajaN=ss=>esc(ss.regName||('Caja '+ss.caja));
 modal('Pago a '+s.razon,`<div class="cmp"><p>Deuda actual: <b class="neg">${money(s.saldo)}</b></p>
  <label for="pg-m">Importe ($)</label>${numIn('pg-m',0,'Ej.: 15.000','class="cmp-in"')}
  <label for="pg-med">Medio de pago</label><select id="pg-med" class="cmp-in">${Object.entries(CMP_MEDIOS).map(([k,t])=>`<option value="${k}">${t}</option>`).join('')}</select>
  ${noR?'':`<label for="pg-r">Rubro del egreso (obligatorio)</label><select id="pg-r" class="cmp-in"><option value="">— Elegí un rubro —</option>${rubs.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select>`}
  <label for="pg-ref">Referencia (recibo, cheque, transferencia)</label><input id="pg-ref" class="cmp-in" maxlength="80" autocomplete="off">
  ${multi?`<div id="pg-box"><label class="chk"><input type="checkbox" id="pg-rep"> Repartir el efectivo entre varias cajas</label>
   <div id="pg-reps" hidden>${abiertas.map(ss=>`<div class="row"><span class="sp">${cajaN(ss)} <small class="mut">efectivo esperado ${money(exp(ss))}</small></span>${numIn('pgc-'+ss.id,0,'0','class="cmp-in" style="max-width:130px"')}</div>`).join('')}<p class="sm" id="pg-sum" role="status"></p></div></div>`:''}
  ${cmpCanPick()&&abiertas.length?`<div id="pg-one"><label for="pg-t">Si pagás en efectivo, sale de la caja</label>${cmpCajaPick('pg-t','')}</div>`:`<p class="sm mut">${sess?'Si pagás en efectivo, sale de la caja '+esc(S.tenant.caja)+' (abierta).':'No hay caja abierta: el pago en efectivo no se puede registrar hasta abrirla.'}</p>`}</div>`,
  {okText:'Registrar pago',onOk:async w=>{const m=parseNum(val('pg-m'));if(!(m>0)){w._err('Cargá un importe mayor a cero.');return false;}
   if(Math.round(m*100)>s.saldo){w._err('El pago no puede superar la deuda ('+money(s.saldo)+').');return false;}
   const rid=ownerMode()?ownerRubro():(noR?sysRubro('sys-pago-proveedor','Pago a proveedores'):val('pg-r'));
   const p={idempotency_key:key,proveedor_id:s.id,monto:m,medio_pago:val('pg-med'),rubro_id:rid,referencia:val('pg-ref')};
   if(!p.rubro_id){w._err('Elegí el rubro del egreso: es obligatorio.');return false;}
   const rep=multi&&$('#pg-rep',w)&&$('#pg-rep',w).checked;
   if(p.medio_pago==='efectivo'&&rep){const A_=[];let suma=0;for(const ss of abiertas){const raw=val('pgc-'+ss.id).trim();if(raw==='')continue;const c=cents(raw);if(isNaN(c)||c<0){w._err('Importe inválido en '+(ss.regName||'una caja')+'.');return false;}if(c===0)continue;
     if(c>exp(ss)){w._err((ss.regName||'La caja')+' no tiene tanto efectivo (esperado '+money(exp(ss))+').');return false;}A_.push({turno_id:ss.id,monto:c/100});suma+=c;}
    if(!A_.length){w._err('Cargá cuánto sale de cada caja.');return false;}
    if(suma!==Math.round(m*100)){w._err('El reparto suma '+money(suma)+' y el pago es '+money(Math.round(m*100))+'.');return false;}p.asignaciones=A_;}
   else if(p.medio_pago==='efectivo'){let ss=sess;if(cmpCanPick()&&$('#pg-t',w)){const t=abiertas.find(x=>x.id===val('pg-t'));if(t)ss=t;}if(!ss){w._err('No hay caja abierta. Abrila en Caja o elegí otro medio.');return false;}p.turno_id=ss.id;}
   try{const r=await CMP.pagar(p);toast(r.repetido?'Ese pago ya estaba registrado':'Pago registrado');cmpAfterOp();}catch(e){w._err(e.message);return false;}}});
 const root=$('#modal-root');const sync=()=>{const on=$('#pg-rep')&&$('#pg-rep').checked&&val('pg-med')==='efectivo';const bx=$('#pg-reps');if(bx)bx.hidden=!on;const one=$('#pg-one');if(one)one.hidden=on||val('pg-med')!=='efectivo';
  if(on){let sm=0;abiertas.forEach(ss=>{const c=cents(val('pgc-'+ss.id)||'0');if(!isNaN(c))sm+=c;});const tot=Math.round((parseNum(val('pg-m'))||0)*100);const d=tot-sm;const o=$('#pg-sum');if(o)o.textContent=d===0&&tot>0?'✔ El reparto cubre el pago.':(d>0?'Faltan '+money(d)+' por repartir.':'Sobran '+money(-d)+'.');}};
 if(root)root.addEventListener('input',sync);if(root)root.addEventListener('change',sync);};
A.cmpNc=el=>{if(!can('purchases'))return toast('Sin permiso',1);const s=cmpProv(el.dataset.id);if(!s)return;const key=cmpKey();
 modal('Nota de crédito de '+s.razon,`<div class="cmp"><p>Saldo actual: ${cmpSaldoTag(s.saldo)}</p>
  <label for="nc-m">Importe ($)</label>${numIn('nc-m',0,'Ej.: 4.500','class="cmp-in"')}
  <label for="nc-ref">Número de la nota de crédito</label><input id="nc-ref" class="cmp-in" maxlength="80" autocomplete="off">
  <label for="nc-mot">Motivo</label><input id="nc-mot" class="cmp-in" maxlength="200" autocomplete="off" placeholder="Ej.: devolución de mercadería, bonificación">
  <p class="sm mut">Reduce lo que le debés. No mueve caja ni stock: si devolvés mercadería, ajustá el stock en Inventario.</p></div>`,
  {okText:'Registrar nota de crédito',onOk:async w=>{const m=parseNum(val('nc-m'));if(!(m>0)){w._err('Cargá un importe mayor a cero.');return false;}
   try{const r=await CMP.nc({idempotency_key:key,proveedor_id:s.id,monto:m,referencia:val('nc-ref'),motivo:val('nc-mot')});toast(r.repetido?'Esa nota ya estaba registrada':'Nota de crédito registrada');cmpAfterOp();}catch(e){w._err(e.message);return false;}}});};
