/* ===== Cálculos: arqueo, reparto, reporte ===== */
function hoursOn(empId,day){const ps=S.punches.filter(p=>p.empId===empId&&dkey(p.ts)===day).sort((a,b)=>a.ts-b.ts);let ms=0,open=null,flag=false;
 for(const p of ps){if(p.kind==='in'){if(open!==null)flag=true;open=p.ts;}else{if(open!==null){ms+=p.ts-open;open=null;}else flag=true;}}
 if(open!==null){if(day===dkey(now())&&now()-open<16*3600e3)ms+=now()-open;else flag=true;}
 return{h:ms/3600e3,flag};}
function allocFees(s){const fee=s.fee||0;const tots=s.items.map(lineTotal);const T=tots.reduce((a,b)=>a+b,0);if(!fee||!T)return s.items.map(()=>0);let acc=0;return tots.map((t,i)=>{if(i===tots.length-1)return fee-acc;const f=Math.round(fee*t/T);acc+=f;return f;});}
const repartRubros=()=>ownerMode()?[]:S.rubros.filter(r=>r.kind==='rubro'&&r.reparte);
function arqInputs(sess){const d=S.arqDraft[sess.id]||{};const emp=S.employees.find(e=>e.id===d.empId)||null;
 const hrs=parseNum(d.hours);const rt=(d.rate!==undefined&&d.rate!=='')?cents(d.rate):(emp?emp.rate:0);
 const gas=cents(d.gastos),dec=(d.declared===undefined||d.declared==='')?NaN:cents(d.declared);
 const taxes={};repartRubros().forEach(r=>{const t=d.taxes&&d.taxes[r.id];taxes[r.id]=(t!==undefined&&t!=='')?(cents(t)||0):(S.cfg.tax[r.id]!==undefined?(S.cfg.tax[r.id]||0):3000000);});
 if(ownerMode())return{emp:null,hours:0,rate:0,merienda:0,gastosManual:0,declared:dec,taxes:{},payFromCash:false,detailAll:!!d.detailAll,mono:d.mono!==false,notes:d.notes||''};
 return{emp,hours:isNaN(hrs)?0:hrs,rate:isNaN(rt)?0:rt,merienda:0,gastosManual:isNaN(gas)?0:gas,declared:dec,taxes,
  payFromCash:d.payFromCash!==undefined?!!d.payFromCash:S.cfg.payFromCash,detailAll:!!d.detailAll,mono:d.mono!==false,notes:d.notes||''};}
function arqueoCalc(sess,inp){
 const sales=S.sales.filter(s=>s.sessId===sess.id&&s.status==='ok');
 const pend=S.sales.filter(s=>s.sessId===sess.id&&s.status==='pendiente');
 const byMethod={};let total=0;
 let aCtaCte=0,vueltoTot=0;
 sales.forEach(s=>{const L=salePays(s);L.forEach(pp=>{const m=byMethod[pp.m]||(byMethod[pp.m]={n:0,gross:0,fee:0});m.n++;m.gross+=pp.a;m.fee+=(L.length>1?(pp.fee||0):(s.fee||0));});total+=s.total;aCtaCte+=saleFiadoAmt(s);vueltoTot+=s.vuelto||0;});
 const cobrado=total-aCtaCte;
 const R={};S.rubros.forEach(r=>R[r.id]={sold:0,profit:0,fees:0,mov:0,items:{},cash:0,dig:0,fia:0,ing:0,egr:0,cing:0,cegr:0,adj:0});
 sales.forEach(s=>{const fees=allocFees(s);s.items.forEach((it,i)=>{const q=R[it.rubro];if(!q)return;const t=lineTotal(it);q.sold+=t;q.profit+=t-lineCost(it);q.fees+=fees[i];const e=q.items[it.name]||(q.items[it.name]={qty:0,total:0});e.qty+=it.qty;e.total+=t;});
  {const tots=s.items.map(lineTotal);const T=tots.reduce((a,b)=>a+b,0);
   if(T>0)salePays(s).forEach(pp=>{const k=pp.m==='efectivo'?'cash':(pp.m==='fiado'?'fia':'dig');let acc=0;s.items.forEach((it,i)=>{const sh=i===tots.length-1?pp.a-acc:Math.round(pp.a*tots[i]/T);acc+=sh;if(R[it.rubro])R[it.rubro][k]+=sh;});});}});
 const movs=S.movs.filter(m=>m.sessId===sess.id);let ing=0,egr=0,gAuto=0;
 movs.forEach(m=>{const r0=rub(m.rubro);
  /* V26.16 (Almacén RAVE, pedido del dueño): un ingreso/egreso al rubro SÓLO entra o sale de la caja física de ese rubro (y del cajón).
     NO cambia lo vendido, la venta del mostrador ni la ganancia. */
  if(rubAdj(m,r0)){if(R[r0.id]){const sg=m.type==='ingreso'?m.amount:-m.amount;R[r0.id].sold+=sg;R[r0.id].adj+=sg;if(m.type==='ingreso')R[r0.id].ing+=m.amount;else R[r0.id].egr+=m.amount;}return;}
  if(m.type==='ingreso')ing+=m.amount;else egr+=m.amount;const r=r0;if(!r)return;if(r.kind==='rubro'&&R[r.id]){if(m.type==='ingreso'){R[r.id].ing+=m.amount;R[r.id].cing+=m.amount;}else{R[r.id].egr+=m.amount;R[r.id].cegr+=m.amount;}}
  if(r.kind==='shared'){if(m.type==='egreso')gAuto+=m.amount;}});
 const sueldo=Math.round(inp.hours*inp.rate),mer=0,gastos=gAuto+inp.gastosManual;
 const rp=repartRubros(),n=rp.length;const sS=split(sueldo,n),sM=split(mer,n),gaS=split(gAuto,n),gmS=split(inp.gastosManual,n),sG=gaS.map((v,i)=>v+gmS[i]);
 /* V26.17 (pedido del dueño): TODO a medias entre los que reparten. Los impuestos del día se suman (los de cada uno) y se dividen en partes iguales;
    la ganancia es la suma de las ganancias de ventas − sueldo − gastos − impuestos, y se divide en partes iguales. */
 const taxIn=rp.map(r=>inp.taxes[r.id]||0),taxTot=taxIn.reduce((a,b)=>a+b,0),tS=split(taxTot,n);
 const preTot=rp.reduce((a,r,i)=>{const q=R[r.id];return a+(q.profit-q.fees)-sS[i]-sM[i]-sG[i];},0);
 const cubTot=Math.max(0,Math.min(preTot,taxTot)),falS=split(taxTot-cubTot,n);
 const reparte=rp.map((r,i)=>{const q=R[r.id];const base=q.profit-q.fees;const pre=base-sS[i]-sM[i]-sG[i];const tax=tS[i],taxOwn=taxIn[i];
  const cubierto=tax-falS[i];const fis=q.cash+q.cing-q.cegr-gaS[i]-(inp.payFromCash?(sS[i]+gmS[i]):0);
  return{id:r.id,name:r.name,owner:r.owner,sold:q.sold,profit:q.profit-q.fees,mov:q.mov,sueldo:sS[i],merienda:0,gastos:sG[i],base,pre,tax,taxOwn,cubierto,falta:falS[i],net:pre-tax,cash:q.cash,dig:q.dig,fia:q.fia,ing:q.ing,egr:q.egr,adj:q.adj,fis};});
 const pool=n>0;const netSum=reparte.reduce((a,r)=>a+r.net,0);const fin=split(netSum,n);reparte.forEach((r,i)=>{r.final=pool?fin[i]:r.net;});
 const otros=S.rubros.filter(r=>r.kind==='rubro'&&!r.reparte).map(r=>{const q=R[r.id];return{id:r.id,name:r.name,owner:r.owner,sold:q.sold,profit:q.profit-q.fees,mov:q.mov,net:q.profit-q.fees+q.mov,cash:q.cash,dig:q.dig,fia:q.fia,ing:q.ing,egr:q.egr,adj:q.adj,fis:q.cash+q.cing-q.cegr};});
 const cashSales=(byMethod.efectivo||{}).gross||0;const tr=(typeof transfersFor==='function')?transfersFor(sess):{tin:0,tout:0,list:[]};
 const paid=inp.payFromCash?(sueldo+inp.gastosManual):0;
 const expectedCash=sess.opening+cashSales+ing-egr-paid+tr.tin-tr.tout;
 const declared=inp.declared;const diff=isNaN(declared)?0:declared-expectedCash;
 const fondo=sess.opening+tr.tin-tr.tout;const fisSum=reparte.concat(otros).reduce((a,r)=>a+r.fis,0);const resto=expectedCash-fondo-fisSum;
 return{owner:ownerMode(),sessId:sess.id,total,cobrado,aCtaCte,vueltoTot,count:sales.length,byMethod,pend:{n:pend.length,total:pend.reduce((a,s)=>a+s.total,0)},rub:R,ing,egr,gAuto,gManual:inp.gastosManual,gastos,sueldo,merienda:mer,
  detMissing:typeof pdMissingCount==='function'?pdMissingCount(sess):0,empName:inp.emp?inp.emp.name:'',hours:inp.hours,rate:inp.rate,reparte,otros,pool,netSum,fondo,resto,cashSales,paid,opening:sess.opening,tin:tr.tin,tout:tr.tout,transfers:tr.list,expectedCash,declared:isNaN(declared)?null:declared,diff,
  movs:movs.map(m=>({ts:m.ts,type:m.type,rubro:m.rubroName||rubName(m.rubro),concept:m.concept,amount:m.amount,user:m.user}))};}
function buildReport(a,dayKey,who,inp){if(a.owner&&typeof buildReportOwner==='function')return buildReportOwner(a,dayKey,who,inp);
 const L=[];const P=(t,cls)=>L.push({t,cls:cls||''});
 P(dmy(dayKey)+' '+DIAS[dowOfKey(dayKey)]+' cerró '+who,'h');P('');
 P('MOSTRADOR TOTAL : '+money(a.total)+' ('+a.count+' venta'+(a.count===1?'':'s')+')','h');
 Object.keys(a.byMethod).filter(m=>m!=='fiado').forEach(m=>{const x=a.byMethod[m];P((MET[m]||m)+' '+money(x.gross)+(x.n>1?' ('+x.n+')':''));if(x.fee>0)P('  comisión - '+money(x.fee).replace('$ ','$ ')+' · neto '+money(x.gross-x.fee));});
 P('COBRADO REAL (dinero que entró) : '+money(a.cobrado),'h');
 if(a.aCtaCte>0)P('A CUENTA CORRIENTE (deuda de clientes, NO entró a caja) : '+money(a.aCtaCte),'w');
 if(a.vueltoTot>0)P('Vuelto entregado en el turno : '+money(a.vueltoTot)+' (ya descontado del efectivo)');
 if(a.pend.n)P('⚠ Cobros digitales pendientes de confirmar: '+a.pend.n+' · '+money(a.pend.total),'w');
 if(a.detMissing)P('⚠ Cobros digitales sin el detalle del comprobante: '+a.detMissing,'w');
 P('');P('POR RUBRO (cada rubro es una persona) :','h');
 a.reparte.concat(a.otros).forEach(r=>{P('');P((r.owner?r.owner.toUpperCase()+' — ':'')+r.name,'h');
  P('  Vendió : '+money(r.sold));P('  Ganancia de ventas : '+money(r.profit));
  if(r.ing||r.egr)P('  Ingresos/egresos al rubro : '+(r.ing?'+ '+money(r.ing):'')+(r.ing&&r.egr?' · ':'')+(r.egr?'- '+money(r.egr):'')+' (sólo caja física; no cambian la venta ni la ganancia)');
  P('  Efectivo cobrado : '+money(r.cash||0)+(r.dig?' · digital '+money(r.dig):'')+(r.fia?' · a cuenta corriente '+money(r.fia):''));
  P('  CAJA FÍSICA DEL RUBRO : '+money(r.fis||0),'h');});
 if(a.fondo)P('');if(a.fondo)P('Fondo de apertura y traspasos (no son de ningún rubro) : '+money(a.fondo));
 if(a.reparte.length){P('');P('LIQUIDACIÓN :','h');
  if(a.sueldo)P((a.empName?a.empName.toUpperCase():'EMPLEADO')+(a.hours?' '+numAR(a.hours)+' hs × '+money(a.rate):'')+' = '+money(a.sueldo)+' · a medias:');
  a.reparte.forEach(r=>{if(a.sueldo)P('  Sueldo '+(r.owner||r.name)+' : - '+money(r.sueldo));});
  if(a.gastos)a.reparte.forEach(r=>P('  Gastos '+(r.owner||r.name)+' : - '+money(r.gastos)+(r===a.reparte[0]&&a.gAuto&&a.gManual?' (caja '+money(a.gAuto)+' + otros '+money(a.gManual)+', a medias)':'')));
  {const tt=a.reparte.reduce((s,r)=>s+r.tax,0),ff=a.reparte.reduce((s,r)=>s+r.falta,0);P('  Impuestos del día : '+money(tt)+' ('+a.reparte.map(r=>(r.owner||r.name)+' '+money(r.taxOwn||0)).join(' + ')+') · a medias:',ff>0?'w':'');
   a.reparte.forEach(r=>P('  Impuesto '+(r.owner||r.name)+' : - '+money(r.tax)));if(ff>0)P('  ⚠ La ganancia no alcanza para los impuestos: faltan '+money(ff),'w');}
  P('');P('GANANCIA (todo a medias) :','h');
  P('  Ganancia de ventas : '+a.reparte.map(r=>(r.owner||r.name)+' '+money(r.profit)).join(' + ')+' = '+money(a.reparte.reduce((s,r)=>s+r.profit,0)));
  P('  GANANCIA TOTAL (ventas − sueldo − gastos − impuestos) : '+money(a.netSum),a.netSum<0?'w':'h');a.reparte.forEach(r=>P('  A '+(r.owner||r.name).toUpperCase()+' LE CORRESPONDE (la mitad) : '+money(r.final),r.final<0?'w':'h'));
  a.otros.forEach(r=>P(r.name+(r.owner?' ('+r.owner+')':'')+' : '+money(r.net),r.net<0?'w':''));}
 if(a.declared!==null){P('');P('EFECTIVO : esperado '+money(a.expectedCash)+' · declarado '+money(a.declared)+' · '+(a.diff===0?'sin diferencia':(a.diff>0?'sobrante ':'faltante ')+money(Math.abs(a.diff))),a.diff<0?'w':'');}
 const det=a.reparte.concat(a.otros).filter(r=>(inp.detailAll||!S.rubros.find(x=>x.id===r.id).reparte)&&r.sold>0);
 det.forEach(r=>{P('');P(r.name+(r.owner?' ('+r.owner+')':'')+' — total vendido '+money(r.sold),'h');Object.keys(a.rub[r.id].items).forEach(k=>{const it=a.rub[r.id].items[k];P('  · '+k+' x'+numAR(it.qty,3)+' — '+money(it.total));});});
 return L;}
const reportText=(L,mono)=>{const t=L.map(x=>x.t).join('\n');return mono?'```\n'+t+'\n```':t;};
const reportHTML=L=>L.map(x=>x.cls?`<span class="${x.cls}">${esc(x.t)}</span>`:esc(x.t)).join('\n');
function waLink(text,num){return 'https://wa.me/'+(num?String(num).replace(/\D/g,''):'')+'?text='+encodeURIComponent(text);}
function openExternal(url){window.open(url,'_blank','noopener,noreferrer');}
async function copyText(t){try{await navigator.clipboard.writeText(t);toast('Copiado');}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('Copiado');}catch(_){toast('No se pudo copiar',1);}ta.remove();}}

/* ===== Eventos asíncronos (cola) y webhooks simulados ===== */
function emit(type,data){S.events.push({id:uid(),ts:now(),type,status:'nuevo',data:data||{}});if(S.events.length>300)S.events.splice(0,S.events.length-300);save();setTimeout(processQueue,1200);}
function processQueue(){if(S.simOffline)return 0;let n=0;S.events.forEach(e=>{if(e.status==='nuevo'){e.status='procesado';e.processedAt=now();n++;}});if(n)save();return n;}
function restock(s){s.items.forEach(it=>{if(Array.isArray(it.kit)&&it.kit.length){it.kit.forEach(k=>{const c=S.products.find(x=>x.id===k.pid);if(c)c.stock=Math.round((c.stock+it.qty*k.qty)*1000)/1000;});return;}
 const p=S.products.find(x=>x.id===it.pid);if(p)p.stock=Math.round((p.stock+it.qty)*1000)/1000;});}
function webhook(saleId,evId,res){
 if(S.seenEvents[evId]){emit('webhook.duplicado',{ev:evId});return'dup';}
 if(S.simOffline)return'offline';
 const s=S.sales.find(x=>x.id===saleId);S.seenEvents[evId]=1;
 if(!s||s.status!=='pendiente')return'noop';
 if(res==='approved'){const pct=S.cfg.fee[s.method]||0;s.fee=Math.round(s.total*pct/100);s.net=s.total-s.fee;s.status='ok';s.paidAt=now();
  const closed=S.sessions.find(x=>x.id===s.sessId&&x.closedAt);if(closed)s.late=true;
  audit('PAGO_CONFIRMADO',s.n+' '+MET[s.method]+' bruto '+money(s.total)+' comisión '+money(s.fee)+' neto '+money(s.net));emit('payment.approved',{sale:s.n,gross:s.total,fee:s.fee,net:s.net});}
 else{s.status='rechazada';restock(s);audit('PAGO_RECHAZADO',s.n);emit('payment.rejected',{sale:s.n});}
 save();return'ok';}

/* ===== Movimientos de caja con rubro obligatorio (O.10) ===== */
/* ¿es un ingreso/egreso manual al rubro de una persona? (no las compras, cobranzas, gastos generales ni el negocio de un solo dueño) */
/* V26.16: se deja de usar (el ingreso/egreso al rubro NO toca lo vendido): mueve la caja física del rubro y el efectivo del cajón */
function rubAdj(m,r){return false;}
function validRubro(id,type){if(!id)return'Elegí un rubro: es obligatorio para todo ingreso o egreso.';const r=rub(id);if(!r)return'El rubro elegido no existe.';if(r.kind==='msec')return'Una sección del menú no es un rubro de dinero: elegí un rubro.';if(r.kind==='shared'&&type==='ingreso')return'Ese rubro sólo admite egresos.';if(r.kind==='cobr'&&type==='egreso')return'Ese rubro sólo admite ingresos.';return'';}
function addMov(type,rubroId,concept,amount){const e=validRubro(rubroId,type);if(e)return e;if(!openSess())return'No hay caja abierta.';
 if(!concept||concept.trim().length<3)return'Escribí el motivo o concepto (mínimo 3 letras).';if(!(amount>0))return'El importe debe ser mayor a cero.';
 const m={id:uid(),ts:now(),sessId:openSess().id,type,rubro:rubroId,rubroName:rubName(rubroId),concept:concept.trim().slice(0,120),amount,user:user.name};S.movs.push(m);
 audit(type==='ingreso'?'INGRESO_CAJA':'EGRESO_CAJA',rubName(rubroId)+' · '+m.concept+' · '+money(amount));emit('cash.movement',{type,rubro:rubroId,amount});save();return'';}
function movModal(type,pref){if(!can('cash_mov'))return toast('Sin permiso',1);if(!openSess()){toast('Abrí la caja primero (Caja → Abrir caja)',1);return;}
 if(ownerMode())return movModalOwner(type,pref);
 const opts=S.rubros.filter(r=>!r.sys&&r.kind!=='msec'&&r.kind!=='archivado'&&(type==='egreso'?r.kind!=='cobr':r.kind!=='shared'));
 const w=modal(type==='ingreso'?'Ingreso de efectivo':'Egreso de efectivo',`<p class="sm mut">${type==='ingreso'?'Entra efectivo a la caja física del rubro que elijas. No cambia las ventas del mostrador ni la ganancia.':'Sale efectivo de la caja física del rubro que elijas (por ejemplo, un pago entre hermanos). No cambia las ventas del mostrador ni la ganancia.'}</p><label for="mv-r">Rubro / persona de quien es la caja (obligatorio)</label><select id="mv-r"><option value="">— Elegí un rubro —</option>${opts.map(r=>`<option value="${r.id}">${esc(r.name)}${r.owner?' ('+esc(r.owner)+')':''}</option>`).join('')}</select>
 <label for="mv-c">Motivo / concepto</label><input id="mv-c" maxlength="120" placeholder="Ej.: pago a proveedor, reintegro, retiro" autocomplete="off" value="${esc(pref||'')}">
 <label for="mv-a">Importe ($)</label>${numIn('mv-a',0,'0')}`,{okText:'Guardar',onOk:w=>{const e=addMov(type,val('mv-r'),val('mv-c'),cents(val('mv-a')));if(e){w._err(e);return false;}toast('Movimiento guardado');rerender();}});}
A.mov=el=>movModal(el.dataset.type);

/* ===== Inventario ===== */
const sugPrice=(costC,type,pct)=>{if(isNaN(pct)||isNaN(costC))return NaN;if(type==='margen'){if(pct<0||pct>=100)return NaN;return Math.round(costC/(1-pct/100));}if(pct<0)return NaN;return Math.round(costC*(1+pct/100));};
let invF={q:'',rub:'',group:true,low:false,arch:false};
let invSel=new Set();
const canDelItems=()=>!!user&&user.role==='admin'; /* V26 4.16: sólo el rol Administrador; no es un permiso delegable */
const RUB_COLORS=['#c9963e','#7b2d3b','#6b6a5a','#2f6f8f','#3d7a4f','#8a6fb0','#b5543a','#2b7a78','#a0527c','#5d6d3f'];
const safeColor=c=>/^#[0-9a-fA-F]{6}$/.test(String(c||''))?c:'#8a6fb0';
const prodStatus=p=>{const v=stockOf(p);return v<0?'neg':(v===0?'zero':(v<=5?'low':'ok'));};
reg('inventario','Inventario','box','edit_products',()=>{
 const R=S.rubros.filter(r=>r.kind==='rubro');const q=invF.q.toLowerCase();
 const base=S.products.filter(p=>(invF.arch?!!p.archived:!p.archived)&&(!q||p.name.toLowerCase().includes(q)||(p.sub||'').toLowerCase().includes(q)||(p.barcode||'').includes(q))&&(!invF.low||p.stock<=5));
 const L=base.filter(p=>!invF.rub||p.rubro===invF.rub);const cv=can('view_cost');
 const cnt=id=>base.filter(p=>p.rubro===id).length;
 const tabs=`<div class="rtabs" role="tablist" aria-label="${RWs(1)}"><button type="button" role="tab" class="rtab ${invF.rub?'':'on'}" data-act="irub" data-id="" aria-selected="${!invF.rub}">Todos <b>${base.length}</b></button>${R.map(r=>`<button type="button" role="tab" class="rtab ${invF.rub===r.id?'on':''}" data-act="irub" data-id="${r.id}" aria-selected="${invF.rub===r.id}" style="--rc:${safeColor(r.color)}"><i class="rdot" style="background:${safeColor(r.color)}"></i>${esc(r.name)} <b>${cnt(r.id)}</b></button>`).join('')}<button type="button" class="rtab add" data-act="rubEdit" data-id="">+ ${RW(1)}</button></div>`;
 const negN=S.products.filter(p=>p.stock<0&&!p.archived).length;const cd=canDelItems();const nArch=S.products.filter(p=>p.archived).length;
 const vis=new Set(L.map(p=>p.id));[...invSel].forEach(id=>{if(!vis.has(id))invSel.delete(id);});
 const row=p=>{const r=rub(p.rubro);const col=safeColor(r&&r.color);const st=prodStatus(p);
  return `<tr class="st-${st}" style="--rc:${col}">${cd?`<td class="ck"><input type="checkbox" class="isel" data-id="${p.id}" ${invSel.has(p.id)?'checked':''} aria-label="Seleccionar ${esc(p.name)}"></td>`:''}<td class="rb" data-sv="${esc(p.name)}"><b>${esc(p.name)}</b>${p.sub?` <span class="mut sm">${esc(p.sub)}</span>`:''}${p.archived?' <span class="tag bad">archivado</span>':(p.active?'':' <span class="tag bad">inactivo</span>')}${p.needStock?' <span class="tag warn" title="No se vende sin stock">exige stock</span>':''}${isKit(p)?` <span class="tag" title="Al venderlo se descuenta cada artículo">combo</span><div class="sm mut">${esc(kitTxt(p))}</div>`:''}${p.demo?' <span class="tag sim" title="Costo y stock de ejemplo">ej.</span>':''}</td><td><span class="rchip" style="--rc:${col}"><i class="rdot" style="background:${col}"></i>${esc(rubName(p.rubro))}</span></td><td class="r">${money(p.price)}${p.unit!=='u'?' <span class="mut sm">/ '+unitLbl(p.unit)+'</span>':''}</td>${wsInvTd(p)}${cv?`<td class="r">${money(p.cost)}</td><td class="r">${p.price&&p.cost>0?numAR((p.price-p.cost)/p.price*100,1)+' %':'—'}</td>`:''}<td class="r">${st==='neg'?`<span class="tag bad" title="Se vendió sin stock">${esc(stockTxt(p))}</span>`:st==='zero'?`<span class="tag bad">0 ${esc(unitLbl(p.unit))}</span>`:st==='low'?`<span class="tag warn">${esc(stockTxt(p))}</span>`:esc(stockTxt(p))}${wsStockSub(p)}</td><td>${p.menu?'<span class="tag ok">publicado</span>':'—'}</td><td class="r">${p.archived?(cd?`<button class="btn sm" data-act="prest" data-id="${p.id}">Restaurar</button>`:''):`<button class="btn sm" data-act="pedit" data-id="${p.id}">Editar</button> <button class="btn sm" data-act="padj" data-id="${p.id}">Stock</button>${cd?` <button class="btn sm danger" data-act="pdel" data-id="${p.id}" aria-label="Eliminar ${esc(p.name)}">Eliminar</button>`:''}`}</td></tr>`;};
 const head=`<thead><tr>${cd?'<th class="ck" data-nosort><input type="checkbox" id="isel-all" aria-label="Seleccionar todos los artículos visibles"></th>':''}<th>Producto</th><th>${RW(1)}</th><th class="r">Precio</th>${wsInvTh()}${cv?'<th class="r">Costo</th><th class="r">Margen</th>':''}<th class="r">Stock</th><th>Menú</th><th></th></tr></thead>`;
 const colspan=(cv?8:6)+(cd?1:0)+wsInvCols();
 let body='';
 if(invF.group&&!invF.rub){R.forEach(r=>{const l=L.filter(p=>p.rubro===r.id);if(!l.length)return;const col=safeColor(r.color);
   body+=`<tr class="rgroup" style="--rc:${col}"><td colspan="${colspan}"><i class="rdot" style="background:${col}"></i><b>${esc(r.name)}</b> <span class="mut sm">${l.length} producto${l.length===1?'':'s'}${r.menuOn===false?' · fuera del menú':''}${r.age?' · +18':''}${r.alcohol?' · alcohol':''}</span> <button class="btn sm" data-act="rubEdit" data-id="${r.id}">Editar ${RW()}</button></td></tr>`+l.map(row).join('');});
  const sin=L.filter(p=>!rub(p.rubro));if(sin.length)body+=`<tr class="rgroup"><td colspan="${colspan}"><b>Sin ${RW()}</b></td></tr>`+sin.map(row).join('');}
 else body=L.map(row).join('');
 const cur=invF.rub?rub(invF.rub):null;
 return `<div class="row"><h1 class="sp">Inventario</h1>${expBar('productos')}<button class="btn gold" data-act="pedit" data-id="">+ Producto</button></div>
 ${negN?`<div class="errbox">${negN} producto${negN===1?'':'s'} con stock negativo (se vendió sin stock). Cargá la compra o ajustá el stock para regularizar.</div>`:''}
 <div class="card">${tabs}<div class="row" style="margin-top:.7rem"><input id="iq" placeholder="Buscar por nombre, presentación o código…" value="${esc(invF.q)}" style="max-width:320px" aria-label="Buscar producto"><label class="chk" style="margin:0"><input type="checkbox" id="ig" ${invF.group?'checked':''}> Agrupar por ${RW()}</label><label class="chk" style="margin:0"><input type="checkbox" id="il" ${invF.low?'checked':''}> Sólo stock bajo / negativo</label>${cd||nArch?`<label class="chk" style="margin:0"><input type="checkbox" id="ia" ${invF.arch?'checked':''}> Ver archivados (${nArch})</label>`:''}${cur?`<button class="btn sm" data-act="rubEdit" data-id="${cur.id}">Editar ${RW()} «${esc(cur.name)}»</button>`:''}</div>
 ${cd&&invSel.size?`<div class="selbar" role="region" aria-label="Acciones sobre la selección"><b>${invSel.size}</b> seleccionado${invSel.size===1?'':'s'} <button class="btn sm danger" data-act="pdelSel">Eliminar…</button> <button class="btn sm" data-act="parchSel">Archivar…</button> <button class="btn sm ghost" data-act="pselClr">Quitar selección</button></div>`:(cd&&!invF.arch?'<p class="sm mut" style="margin:.4rem 0 0">Administrador: tildá artículos para eliminarlos o archivarlos. Los que tienen historial no se borran: se archivan.</p>':'')}
 <div class="tw"><table class="inv">${head}<tbody>${body||`<tr><td colspan="${colspan}" class="mut">No hay productos con este filtro.</td></tr>`}</tbody></table></div></div>
 <p class="sm mut">Venta sin stock: ${negOK()?'<b>permitida</b> (queda en negativo y se marca en rojo)':'<b>bloqueada</b>'} · se cambia en Configuración o por producto ("exigir stock"). El costo y el margen sólo los ven los roles con permiso. Eliminar y archivar es sólo del Administrador; un artículo con ventas o movimientos no se borra: se archiva y el historial queda intacto.</p>`;},()=>{
 $('#iq').addEventListener('input',e=>{invF.q=e.target.value;const p=e.target.selectionStart;rerender();const n=$('#iq');n.focus();n.setSelectionRange(p,p);});
 $('#ig').addEventListener('change',e=>{invF.group=e.target.checked;rerender();});const ia=$('#ia');if(ia)ia.addEventListener('change',e=>{invF.arch=e.target.checked;invSel.clear();rerender();});
 const sa=$('#isel-all');if(sa){const vis=$$('#view .isel');sa.checked=vis.length>0&&vis.every(x=>x.checked);sa.addEventListener('change',e=>{vis.forEach(x=>{if(e.target.checked)invSel.add(x.dataset.id);else invSel.delete(x.dataset.id);});rerender();});$$('#view .isel').forEach(x=>x.addEventListener('change',e=>{if(e.target.checked)invSel.add(x.dataset.id);else invSel.delete(x.dataset.id);rerender();}));}$('#il').addEventListener('change',e=>{invF.low=e.target.checked;rerender();});},'Operación');
A.irub=el=>{invF.rub=el.dataset.id||'';rerender();};
A.rubEdit=el=>{if(!can('edit_products'))return toast('Sin permiso',1);const r=el&&el.dataset.id?rub(el.dataset.id):null;if(el&&el.dataset.id&&(!r||r.kind!=='rubro'))return;
 const col=safeColor(r?r.color:RUB_COLORS[S.rubros.filter(x=>x.kind==='rubro').length%RUB_COLORS.length]);
 const w=modal((r?'Editar ':'Nuevo'+(ownerMode()?'a ':' '))+RW(),`<label for="rb-n">Nombre ${ownerMode()?'de la categoría':'del rubro'}</label><input id="rb-n" maxlength="40" value="${esc(r?r.name:'')}" autocomplete="off">
 <label>Color (para distinguirlo en inventario, Vender y reportes)</label><div class="row" id="rb-cols">${RUB_COLORS.map(c=>`<button type="button" class="swatch ${c.toLowerCase()===col.toLowerCase()?'on':''}" data-col="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div><input type="hidden" id="rb-c" value="${col}">
 <div class="grid g2">${ownerMode()?'<input type="hidden" id="rb-o" value="">':`<div><label for="rb-o">Responsable (opcional)</label><input id="rb-o" maxlength="40" value="${esc(r?r.owner:'')}"></div>`}<div><label for="rb-l">Diseño en el menú</label><select id="rb-l">${[['grid','Grilla (promos)'],['rows','Filas (lista)'],['bodegas','Por bodega / grupo']].map(([v,t])=>`<option value="${v}" ${(r?r.layout:'grid')===v?'selected':''}>${t}</option>`).join('')}</select></div></div>
 <label for="rb-m">Nombre en el menú digital</label><input id="rb-m" maxlength="30" value="${esc(r?(r.mNom||r.name):'')}">
 <label class="chk"><input type="checkbox" id="rb-sh" ${!r||r.menuOn!==false?'checked':''}> Mostrar esta ${RW()} en el menú digital</label>
 <label class="chk"><input type="checkbox" id="rb-a" ${r&&r.alcohol?'checked':''}> Vende alcohol (se oculta fuera del horario permitido)</label>
 <label class="chk"><input type="checkbox" id="rb-g" ${r&&r.age?'checked':''}> Sólo mayores de 18 (tabaco): sin promociones ni descuentos</label>`,
 {okText:'Guardar rubro',onOk:w=>{const n=val('rb-n').trim();if(!n)return w._err('Falta el nombre.'),false;if(S.rubros.some(x=>norm(x.name)===norm(n)&&(!r||x.id!==r.id)))return w._err('Ya existe '+(ownerMode()?'una categoría':'un rubro')+' con ese nombre.'),false;
  const c=safeColor(val('rb-c'));const d={name:n,owner:val('rb-o').trim(),color:c,layout:val('rb-l'),mNom:val('rb-m').trim()||n,mTitle:r&&r.mTitle?r.mTitle:n,menuOn:$('#rb-sh',w).checked,alcohol:$('#rb-a',w).checked,age:$('#rb-g',w).checked};
  if(r){Object.assign(r,d);audit('RUBRO_EDITAR',n);}else{S.rubros.splice(S.rubros.findIndex(x=>x.kind==='shared'),0,Object.assign({id:uid(),reparte:false,kind:'rubro',mHint:''},d));audit('RUBRO_ALTA',n);}
  save();rerender();pubRefresh();toast(RW(1)+' guardad'+(ownerMode()?'a':'o'));}});
 w.addEventListener('click',e=>{const b=e.target.closest('.swatch');if(!b)return;$('#rb-c',w).value=b.dataset.col;$$('.swatch',w).forEach(x=>x.classList.toggle('on',x===b));});};
A.pedit=el=>{const p=S.products.find(x=>x.id===el.dataset.id)||null;const cv=can('view_cost');
 const w=modal(p?'Editar producto':'Nuevo producto',`<label for="pm-n">Nombre</label><input id="pm-n" value="${esc(p?p.name:'')}" maxlength="80">
 <div class="grid g2"><div><label for="pm-r">${ownerMode()?'Categoría':'Rubro (a quién pertenece)'}</label><select id="pm-r"><option value="">— Elegí —</option>${S.rubros.filter(r=>r.kind==='rubro').map(r=>`<option value="${r.id}" ${p&&p.rubro===r.id?'selected':''}>${esc(r.name)}${r.owner&&!ownerMode()?' ('+esc(r.owner)+')':''}</option>`).join('')}</select></div>
 <div><label for="pm-u">Unidad</label><select id="pm-u">${['u','kg','l'].map(u=>`<option value="${u}" ${p&&p.unit===u?'selected':''}>${unitLbl(u)}</option>`).join('')}</select></div></div>
 ${cv?`<div class="grid g3"><div><label for="pm-c">Costo ($)</label>${numIn('pm-c',p?p.cost:0)}</div><div><label for="pm-t">Cálculo</label><select id="pm-t"><option value="recargo">Recargo sobre costo</option><option value="margen">Margen bruto sobre precio</option></select></div><div><label for="pm-p">Porcentaje (%)</label><input id="pm-p" inputmode="decimal" placeholder="30" autocomplete="off"></div></div><p id="pm-s" class="sm mut">Ingresá costo y porcentaje para ver el precio sugerido.</p>`:''}
 <label for="pm-f">Precio final de venta ($)</label>${numIn('pm-f',p?p.price:0)}<p id="pm-x" class="sm mut"></p>
 <div class="grid g2"><div><label for="pm-st">Stock (<span id="pm-ul">und</span>)</label><input id="pm-st" inputmode="decimal" placeholder="0" value="${p?esc(String(p.stock).replace('.',',')):''}" autocomplete="off"></div><div><label for="pm-b">Código de barras</label><input id="pm-b" value="${esc(p?p.barcode:'')}"></div></div>
 ${wsProdBlock(p)}
 ${comboBlock(p)}
 <div class="grid g3"><div><label for="pm-sub">Presentación (ej. 750 ml)</label><input id="pm-sub" maxlength="40" value="${esc(p&&p.sub?p.sub:'')}"></div><div><label for="pm-gr">Grupo / bodega (menú)</label><input id="pm-gr" maxlength="40" value="${esc(p&&p.grupo?p.grupo:'')}"></div><div><label for="pm-plu">PLU de balanza (si es por peso)</label><input id="pm-plu" inputmode="numeric" maxlength="5" value="${esc(p&&p.plu?p.plu:'')}"></div></div>
 <label for="pm-d">Descripción (menú)</label><input id="pm-d" value="${esc(p?p.desc:'')}" maxlength="120"><label for="pm-e">Nombre en inglés (opcional)</label><input id="pm-e" value="${esc(p&&p.en?p.en:'')}" maxlength="80">
 ${menuProdBlock(p)}
 <label class="chk"><input type="checkbox" id="pm-m" ${p&&p.menu?'checked':''}> Publicar en menú digital</label><label class="chk"><input type="checkbox" id="pm-a" ${!p||p.active?'checked':''}> Activo</label><label class="chk"><input type="checkbox" id="pm-ns" ${p&&p.needStock?'checked':''}> Exigir stock (no permitir vender sin stock este producto)</label>`,
 {okText:'Guardar',onOk:w=>{const name=val('pm-n').trim(),rubro=val('pm-r'),pr=cents(val('pm-f')),st=parseNum(val('pm-st')===''?'0':val('pm-st'));let cost=p?p.cost:0;if(cv){const c=cents(val('pm-c')===''?'0':val('pm-c'));if(isNaN(c)||c<0)return w._err('Costo inválido.'),false;cost=c;}
  if(!name)return w._err('Falta el nombre.'),false;if(!rubro||!rub(rubro))return w._err('Elegí '+(ownerMode()?'la categoría':'el rubro')+' del producto.'),false;if(!(pr>0))return w._err('El precio de venta debe ser mayor a cero.'),false;if(isNaN(st)||(st<0&&!(p&&st===p.stock)&&!negOK()))return w._err('Stock inválido (no puede ser negativo).'),false;
  const bc=val('pm-b').trim();if(bc&&S.products.some(x=>x.barcode===bc&&(!p||x.id!==p.id)))return w._err('Ya existe otro producto con ese código de barras.'),false;
  const plu=val('pm-plu').trim();if(plu&&!/^\d{1,5}$/.test(plu))return w._err('El PLU son hasta 5 números.'),false;if(plu&&S.products.some(x=>x.plu&&String(+x.plu)===String(+plu)&&(!p||x.id!==p.id)))return w._err('Ese PLU ya lo usa otro producto.'),false;
  const W=wsProdRead(p,pr,bc,cost);if(W&&W.err)return w._err(W.err),false;
  const K=comboRead(w,p);if(K.err)return w._err(K.err),false;
  const MP=menuProdRead(w);if(MP.err)return w._err(MP.err),false;
  const d={name,sub:val('pm-sub').trim(),grupo:val('pm-gr').trim(),plu,rubro,unit:val('pm-u'),price:pr,cost,stock:st,barcode:bc,desc:val('pm-d').trim(),en:val('pm-e').trim(),menu:$('#pm-m',w).checked,active:$('#pm-a',w).checked,needStock:$('#pm-ns',w).checked};
  if(W){if(JSON.stringify(W.pres)!==JSON.stringify((p&&p.pres)||[])||W.floor!==((p&&p.floor)||0))audit('PRESENTACIONES_PRODUCTO',name+' · '+(W.pres.map(k=>wsLvName(k.lv)+' ×'+k.qty+' '+money(k.unit)+'/u').join(' · ')||'sin presentaciones')+(W.floor?' · piso '+money(W.floor):''));d.pres=W.pres;d.floor=W.floor;if(W.warns.length)setTimeout(()=>toast('Ojo: '+W.warns.join('; ')+'.',1),400);}
  if(K.kit){d.kit=K.kit;d.unit='u';d.stock=p?p.stock:0;if(cv&&!(cost>0))d.cost=kitCost({kit:K.kit});}else if(p&&isKit(p)){d.kit=[];}
  if(K.kit&&JSON.stringify(K.kit)!==JSON.stringify((p&&p.kit)||[]))audit('COMBO_COMPOSICION',name+' = '+kitTxt({kit:K.kit}));else if(!K.kit&&p&&isKit(p))audit('COMBO_QUITADO',name);
  if(p&&p.stock!==d.stock)d.hist=true;
  d.msec=MP.msec;if(MP.img!==undefined){d.img=MP.img;d.imgOff=MP.imgOff;audit('FOTO_PRODUCTO',name+' · '+(MP.img?'foto nueva':'foto quitada'));}
  if(p){if(p.price!==pr||p.cost!==cost)audit('PRECIO_PRODUCTO',p.name+': precio '+money(p.price)+' → '+money(pr)+(p.cost!==cost?' · costo '+money(p.cost)+' → '+money(cost):''));Object.assign(p,d);audit('EDITAR_PRODUCTO',name);}
  else{S.products.push(Object.assign({id:uid()},d));audit('ALTA_PRODUCTO',name+' · '+rubName(rubro));}save();rerender();toast('Producto guardado');}});
 const upd=()=>{const ul=$('#pm-ul',w);if(ul)ul.textContent=unitLbl(val('pm-u'));if(!cv)return;const c=cents(val('pm-c')),pc=parseNum(val('pm-p')),sg=sugPrice(c,val('pm-t'),pc);const s=$('#pm-s',w);
  if(val('pm-p')==='')s.textContent='Ingresá costo y porcentaje para ver el precio sugerido.';else if(isNaN(sg))s.textContent=val('pm-t')==='margen'?'El margen debe estar entre 0 y menos de 100 %.':'Porcentaje o costo inválido.';else s.innerHTML='Precio sugerido: <b>'+money(sg)+'</b> <button class="btn sm" type="button" id="pm-use">Usar sugerido</button>';
  const f=cents(val('pm-f'));const x=$('#pm-x',w);if(!isNaN(f)&&!isNaN(c)&&c>0){x.textContent='Con ese precio: recargo '+numAR((f-c)/c*100,1)+' % · margen bruto '+numAR((f-c)/f*100,1)+' %';}else x.textContent='';};
 wsProdBind(w,cv);comboBind(w,p);menuProdBind(w,p);w.addEventListener('input',upd);w.addEventListener('change',upd);w.addEventListener('click',e=>{if(e.target.id==='pm-use'){const sg=sugPrice(cents(val('pm-c')),val('pm-t'),parseNum(val('pm-p')));if(!isNaN(sg)){$('#pm-f',w).value=pesosStr(sg);upd();}}});upd();};
/* ===== V26 · 4.16 Eliminación protegida de artículos (sólo Administrador) =====
   · Borrado físico SOLO si no hay ventas, movimientos ni otras referencias; con historial se ARCHIVA (borrado lógico).
   · El servidor vuelve a validar todo (06-v26.sql): ocultar el botón no es seguridad.
   · Vista previa obligatoria antes de cualquier eliminación o archivado masivo; resultado por artículo; selección vacía no hace nada. */
const INV_HOOK={online:null,preview:null};
function prodRefsLocal(p){const r=[];const n=S.sales.reduce((a,s)=>a+((s.items||[]).some(i=>i.pid===p.id)?1:0),0);if(n)r.push(n+' venta'+(n===1?'':'s'));
 const has=(a)=>{try{return JSON.stringify(a||[]).includes('"'+p.id+'"');}catch(e){return false;}};
 if(has(S.orderReqs))r.push('pedidos del menú');if(has(S.pya))r.push('pedidos PedidosYa');if(has(S.coupons)||has(S.plans))r.push('cupones o planes');
 if(has(S.pOrders)||has(S.receipts))r.push('órdenes de compra o ingresos de mercadería');
 if(p.hist)r.push('ajustes o movimientos de stock');return r;}
async function delPreview(ids){
 const items=ids.map(id=>{const p=prod(id);if(!p)return{id,name:'(no existe)',estado:'bloqueado',motivo:'ya no existe'};const refs=prodRefsLocal(p);
  return{id,name:p.name,estado:refs.length?'archivable':'eliminable',motivo:refs.length?'Tiene '+refs.join(', ')+': se archiva, no se borra.':'Sin historial: se puede eliminar.',stock:p.stock};});
 if(typeof CLOUD_HOOK!=='undefined'&&CLOUD_HOOK&&INV_HOOK.online){
  if(!INV_HOOK.online()){items.forEach(it=>{if(it.estado==='eliminable'){it.estado='bloqueado';it.motivo='Sin conexión: la eliminación física se valida en el servidor. Podés archivarlo.';it.soloArchivar=true;}});}
  else if(INV_HOOK.preview){try{const sv=await INV_HOOK.preview(ids);const m=new Map(sv.map(x=>[x.id,x]));
    items.forEach(it=>{const x=m.get(it.id);if(!x)return;if(x.estado==='archivable'&&it.estado==='eliminable'){it.estado='archivable';it.motivo='El servidor encontró historial: '+x.motivo+' Se archiva.';}
     if(x.estado==='inexistente'&&it.estado!=='bloqueado'){it.estado='eliminable';}});}
   catch(e){items.forEach(it=>{if(it.estado==='eliminable'){it.estado='bloqueado';it.motivo='No se pudo validar con el servidor. Podés archivarlo.';it.soloArchivar=true;}});}}}
 return items;}
function archiveItem(p,motivo,lote){p.archived=true;p.active=false;p.menu=false;p.archivedAt=now();audit('INV_ARCHIVAR','['+lote+'] '+p.name+' · '+motivo);}
async function delFlow(ids,mode){
 if(!canDelItems())return toast('Sólo el Administrador puede eliminar o archivar artículos',1);
 ids=[...new Set(ids)].filter(Boolean);if(!ids.length)return toast('No hay artículos seleccionados: no se hace nada.',1);
 const vis=new Set($$('#view .isel').map(x=>x.dataset.id).concat(ids.length===1?ids:[]));
 if(ids.length>1&&ids.some(id=>!vis.has(id)))return toast('La selección incluye artículos que no están a la vista. Volvé a elegirlos.',1);
 const items=await delPreview(ids);const el=items.filter(x=>x.estado==='eliminable'),ar=items.filter(x=>x.estado==='archivable'||x.soloArchivar),bl=items.filter(x=>x.estado==='bloqueado'&&!x.soloArchivar);
 const doDel=mode==='del'&&el.length>0;
 const list=items.slice(0,60).map(x=>`<tr><td>${esc(x.name)}</td><td><span class="tag ${x.estado==='eliminable'?'warn':(x.estado==='bloqueado'&&!x.soloArchivar?'bad':'')}">${x.estado==='eliminable'?(mode==='del'?'se elimina':'sin historial'):(x.estado==='archivable'?'se archiva':(x.soloArchivar?'sólo archivar':'bloqueado'))}</span></td><td class="sm">${esc(x.motivo)}${x.stock?` · stock ${esc(String(x.stock))}`:''}</td></tr>`).join('');
 const w=modal(mode==='del'?'Eliminar artículos':'Archivar artículos',`<p><b>${items.length}</b> seleccionado${items.length===1?'':'s'}: <b>${el.length}</b> sin historial${mode==='del'?' (se eliminan)':''} · <b>${ar.length}</b> con historial o sin validación (se archivan) · <b>${bl.length}</b> bloqueado${bl.length===1?'':'s'}.</p>
 <div class="tw" style="max-height:34vh"><table data-nosort><thead><tr><th>Artículo</th><th>Qué pasa</th><th>Motivo</th></tr></thead><tbody>${list}</tbody></table></div>${items.length>60?`<p class="sm mut">…y ${items.length-60} más.</p>`:''}
 <label for="dl-m">Motivo (obligatorio)</label><input id="dl-m" maxlength="120" autocomplete="off" placeholder="Ej.: artículo discontinuado / carga duplicada">
 ${mode==='del'&&ar.length?`<label class="chk"><input type="checkbox" id="dl-a" checked> Archivar también los ${ar.length} que tienen historial (no se borran)</label>`:''}
 ${doDel?`<label for="dl-t">Para eliminar definitivamente escribí <b>ELIMINAR</b></label><input id="dl-t" autocomplete="off" placeholder="ELIMINAR">`:''}
 ${items.length>200?'<p class="errtxt">Son más de 200 artículos: revisá bien antes de confirmar.</p>':''}
 <p class="sm mut">Las ventas, cierres y comprobantes anteriores no se tocan. Todo queda en la auditoría.</p>`,
 {wide:true,okText:mode==='del'?'Confirmar':'Archivar',onOk:async w=>{const motivo=val('dl-m').trim();if(motivo.length<3)return w._err('El motivo es obligatorio (mínimo 3 letras).'),false;
  if(doDel&&val('dl-t').trim()!=='ELIMINAR')return w._err('Escribí ELIMINAR para confirmar el borrado definitivo.'),false;
  const doArch=mode==='arch'||($('#dl-a',w)&&$('#dl-a',w).checked);const lote='L'+uid().slice(0,6);const res=[];
  for(const it of items){const p=prod(it.id);if(!p){res.push([it.name,'no existe']);continue;}
   if(it.estado==='eliminable'&&mode==='del'){const i=S.products.indexOf(p);S.products.splice(i,1);invSel.delete(it.id);audit('INV_ELIMINAR','['+lote+'] '+it.name+' · '+motivo);res.push([it.name,'eliminado']);}
   else if(it.estado==='bloqueado'&&!it.soloArchivar){res.push([it.name,'bloqueado: '+it.motivo]);}
   else if(doArch&&(it.estado==='archivable'||it.estado==='eliminable'||it.soloArchivar)){archiveItem(p,motivo,lote);invSel.delete(it.id);res.push([it.name,'archivado']);}
   else res.push([it.name,'sin cambios']);}
  save();pubRefresh&&pubRefresh();rerender();
  setTimeout(()=>modal('Resultado',`<p>Lote <b>${lote}</b></p><div class="tw" style="max-height:40vh"><table data-nosort><thead><tr><th>Artículo</th><th>Resultado</th></tr></thead><tbody>${res.slice(0,100).map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table></div>`,{noCancel:true,okText:'Cerrar'}),50);}});
 return w;}
A.pdel=el=>delFlow([el.dataset.id],'del');
A.pdelSel=()=>delFlow([...invSel],'del');
A.parchSel=()=>delFlow([...invSel],'arch');
A.pselClr=()=>{invSel.clear();rerender();};
A.prest=el=>{if(!canDelItems())return toast('Sólo el Administrador',1);const p=prod(el.dataset.id);if(!p)return;
 const dup=p.barcode&&S.products.some(x=>x!==p&&!x.archived&&x.barcode===p.barcode);if(dup)return toast('No se puede restaurar: otro artículo usa el mismo código de barras.',1);
 const dp=p.plu&&S.products.some(x=>x!==p&&!x.archived&&x.plu&&String(+x.plu)===String(+p.plu));if(dp)return toast('No se puede restaurar: otro artículo usa el mismo PLU.',1);
 p.archived=false;p.active=true;delete p.archivedAt;audit('INV_RESTAURAR',p.name);save();rerender();toast('Artículo restaurado');};
A.padj=el=>{const p=prod(el.dataset.id);if(isKit(p))return toast('Un combo no tiene stock propio: se ajusta el stock de cada artículo ('+kitTxt(p)+').',1);const PR=wsOn()?wsPres(p):[];
 const w=modal('Ajustar stock · '+p.name,`<p>Stock actual: <b class="${p.stock<0?'negs':''}">${esc(stockTxt(p))}</b>${wsStockSub(p)}</p>${PR.length?`<label for="aj-u">Contar en</label><select id="aj-u"><option value="1">Unidad</option>${PR.map(k=>`<option value="${k.qty}">${esc(wsLvName(k.lv))} (${numAR(k.qty,3)} u)</option>`).join('')}</select>`:''}<label for="aj-d">Cantidad a sumar o restar (use - para restar)</label><input id="aj-d" inputmode="decimal" placeholder="0" autocomplete="off"><p class="sm mut" id="aj-eq"></p><label for="aj-m">Motivo</label><input id="aj-m" maxlength="100">`,
 {onOk:w=>{const mul=PR.length?(+val('aj-u')||1):1;const d0=parseNum(val('aj-d'));const d=Math.round(d0*mul*1000)/1000;if(isNaN(d)||d===0)return w._err('Ingresá una cantidad distinta de cero.'),false;if(val('aj-m').trim().length<3)return w._err('El motivo es obligatorio.'),false;if(p.stock+d<0&&!canOver(p))return w._err('El stock no puede quedar negativo (este producto exige stock o la venta sin stock está bloqueada).'),false;
  stockAdjust(p,d,val('aj-m')+(mul>1?' ('+d0+' × '+numAR(mul,3)+' u)':''));rerender();}});
 const eq=()=>{const e=$('#aj-eq',w);if(!e||!PR.length)return;const mul=+val('aj-u')||1,d=parseNum(val('aj-d'));e.textContent=(!isNaN(d)&&d!==0&&mul>1)?'= '+(d>0?'+':'')+numAR(d*mul,3)+' unidades':'';};
 w.addEventListener('input',eq);w.addEventListener('change',eq);};
/* núcleo único del ajuste de stock (lo usan la pantalla y el asistente) */
function stockAdjust(p,d,motivo,origen){p.stock=Math.round((p.stock+d)*1000)/1000;p.hist=true;audit('AJUSTE_STOCK',p.name+' '+(d>0?'+':'')+d+' · '+motivo+(origen?' ['+origen+']':''));save();}

/* ===== Caja ===== */
reg('caja','Caja','cash','cash_mov',()=>{const s=openSess();
 if(!s)return `<h1>Caja</h1><div class="card" style="max-width:480px"><p>No hay caja abierta.</p>${cashOpenPick()}<label for="ap">Efectivo inicial (apertura) $</label>${numIn('ap',0,'0')}${xfOpenHint()}<button class="btn gold" style="margin-top:.8rem" data-act="openCaja">Abrir caja ${S.tenant.caja}</button></div>${S.sessions.length||IS_CLIENT?'':'<p class="mut sm">Tip: en Configuración podés cargar la jornada de ejemplo del 6/10 para ver el arqueo completo.</p>'}`;
 const inp=arqInputs(s),a=arqueoCalc(s,inp),ms=S.movs.filter(m=>m.sessId===s.id);
 const old=dkey(s.openedAt)!==dkey(now());
 return `<div class="row"><h1 class="sp">Caja ${S.tenant.caja}${cashHdr(s)}</h1>${expBar('movimientos')}<button class="btn gold" data-act="nav" data-id="arqueo">Arqueo y cierre →</button></div>
 ${old?`<div class="errbox">Esta caja se abrió el ${dmy(dkey(s.openedAt))} y sigue abierta: hay días con ventas sin cierre.</div>`:''}
 <div class="grid g4"><div class="card kpi"><b>${money(s.opening)}</b><span>Apertura (${esc(s.openedBy)} · ${fmtDT(s.openedAt)})</span></div><div class="card kpi"><b>${money(a.total)}</b><span>Ventas confirmadas (${a.count})</span></div><div class="card kpi"><b>${money(a.cobrado)}</b><span>Cobrado real hoy</span></div>${a.aCtaCte?`<div class="card kpi"><b class="neg">${money(a.aCtaCte)}</b><span>A cuenta corriente (no entró a caja)</span></div>`:''}<div class="card kpi"><b>${money(a.expectedCash)}</b><span>Efectivo esperado hoy</span></div>${a.pend.n?`<div class="card kpi"><b class="neg">${a.pend.n}</b><span>Cobros digitales pendientes · ${money(a.pend.total)}</span></div>`:''}</div>
 ${ownerMode()?'':(typeof rubCashCard==='function'?rubCashCard(s):'')}
 <div class="row" style="margin:1rem 0"><button class="btn" data-act="mov" data-type="ingreso">+ Ingreso de efectivo</button><button class="btn" data-act="mov" data-type="egreso">− Egreso de efectivo</button></div>
 <div class="card"><h3>Movimientos</h3><div class="tw"><table><thead><tr><th>Hora</th><th>Tipo</th>${ownerMode()?'':'<th>Rubro</th>'}<th>Concepto</th><th class="r">Importe</th><th>Usuario</th><th></th></tr></thead><tbody>${ms.map(m=>`<tr><td>${hm(m.ts)}</td><td>${m.type==='ingreso'?'<span class="tag ok">Ingreso</span>':'<span class="tag bad">Egreso</span>'}</td>${ownerMode()?'':`<td>${esc(m.rubroName)}</td>`}<td>${esc(m.concept)}</td><td class="r">${m.type==='ingreso'?'':'- '}${money(m.amount)}</td><td>${esc(m.user)}</td><td>${typeof expBtn==='function'?expBtn('mov',m.id,'Expediente'):''}</td></tr>`).join('')||`<tr><td colspan="${ownerMode()?6:7}" class="mut">Sin movimientos.</td></tr>`}</tbody></table></div></div>
 ${xferPendingCard(s)}
 ${cajaSalesCard(s)}
 ${typeof pdConcilCard==='function'?pdConcilCard():''}`;},()=>{if(typeof xfOpenSync==='function')xfOpenSync();},'Operación');
A.openCaja=()=>{if(openSess())return;const v=cents(val('ap'));if(isNaN(v)||v<0)return toast('Ingresá el efectivo inicial (si es cero, escribí 0).',1);
 const ck=cashOpenCheck();if(ck.err)return toast(ck.err,1);const xo=xfOpenCheck(v,ck.extra);if(xo.err)return toast(xo.err,1);
 const ns=Object.assign({id:uid(),caja:S.tenant.caja,openedBy:user.name,openedAt:now(),opening:v,closedAt:0},ck.extra,xo.extra||{});S.sessions.push(ns);audit('APERTURA_CAJA',money(v)+(ck.extra.regName?' · '+ck.extra.regName:''));if(xo.audit)audit(xo.audit,xo.detail);xfAfterOpen(ns);save();rerender();};
function voidCore(s,reason){if(s.status==='ok'||s.status==='pendiente'){restock(s);}if(s.coupon){S.coupons.forEach(c=>{c.uses=c.uses.filter(u=>u.sale!==s.id);});}if(s.stamped&&typeof stampReverse==='function')stampReverse(s);s.status='anulada';s.voidReason=reason;audit('ANULAR_VENTA',s.n+' · '+reason);emit('sale.voided',{sale:s.n});save();rerender();}
A.voidsale=el=>{const s=S.sales.find(x=>x.id===el.dataset.id);if(!s)return;modal('Anular venta '+s.n,`<p>Se restituye el stock y la venta deja de sumar. Queda en auditoría.</p><label for="vm">Motivo (obligatorio)</label><input id="vm" maxlength="100">`,{onOk:w=>{if(val('vm').trim().length<3)return w._err('Escribí el motivo.'),false;voidCore(s,val('vm'));}});};

/* ===== Arqueo ===== */
function arqDraft(sess){return S.arqDraft[sess.id]||(S.arqDraft[sess.id]={taxes:{}});}
reg('arqueo','Arqueo / cierre','list','close_cash',()=>{const s=openSess();if(!s)return `<h1>Arqueo</h1><div class="card"><p>No hay caja abierta. Abrila en <a href="#panel/caja">Caja</a>.</p></div>`;
 if(ownerMode())return arqOwnerHTML(s);
 const d=arqDraft(s);const emps=S.employees.filter(e=>e.active);const rp=repartRubros();
 return `<div class="row"><h1 class="sp">Arqueo y detalle de reparto</h1><span class="tag warn">Vista previa · todavía no cierra la caja</span></div>
 <div class="grid g2" style="align-items:start"><div class="card"><h3>1 · Sueldo del empleado</h3>
 <label for="aq-emp">Empleado</label><select id="aq-emp" data-aq="empId"><option value="">— Sin empleado —</option>${emps.map(e=>`<option value="${e.id}" ${d.empId===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select>
 <div class="grid g2"><div><label for="aq-h">Horas trabajadas</label><input id="aq-h" data-aq="hours" inputmode="decimal" placeholder="0" value="${esc(d.hours||'')}" autocomplete="off"><div class="sm mut" id="aq-fich"></div></div><div><label for="aq-r">Valor hora ($)</label><input id="aq-r" data-aq="rate" inputmode="decimal" placeholder="valor del empleado" value="${esc(d.rate||'')}" autocomplete="off"></div></div>
 <label for="aq-g">Otros gastos del día ($)</label><input id="aq-g" data-aq="gastos" inputmode="decimal" placeholder="0" value="${esc(d.gastos||'')}" autocomplete="off">
 <p class="sm mut">El sueldo (la merienda ya está incluida en las horas) y los gastos se reparten a medias entre: <b>${rp.map(r=>esc(r.owner)).join(' y ')||'(nadie: marcá rubros que reparten en Configuración)'}</b>. Los egresos de caja con rubro "Gastos generales" se suman solos a los gastos.</p>
 <h3 style="margin-top:1rem">2 · Impuestos del día (editable)</h3><div class="grid g2">${rp.map(r=>`<div><label for="aq-t-${r.id}">${esc(r.owner)} (${esc(r.name)}) $</label><input id="aq-t-${r.id}" data-aq="tax" data-rid="${r.id}" inputmode="decimal" placeholder="${esc(pesosStr(S.cfg.tax[r.id]||0)||'0')}" value="${esc((d.taxes&&d.taxes[r.id])||'')}" autocomplete="off"></div>`).join('')}</div>
 <p class="sm mut">Todo a medias: se suman las ganancias de ventas, se restan el sueldo, los gastos y los impuestos del día (editables, por defecto $30.000 cada uno; el total se divide a medias) y la ganancia que queda se divide en partes iguales. Si no alcanza, se marca en rojo.</p>
 <h3 style="margin-top:1rem">3 · Efectivo</h3><label for="aq-d">Efectivo contado en caja ($)</label><input id="aq-d" data-aq="declared" inputmode="decimal" placeholder="Escribí el número" value="${esc(d.declared||'')}" autocomplete="off">
 <label class="chk"><input type="checkbox" data-aq="payFromCash" id="aq-pc" ${(d.payFromCash!==undefined?d.payFromCash:S.cfg.payFromCash)?'checked':''}> El sueldo y los gastos manuales se pagaron de la caja</label>
 <label class="chk"><input type="checkbox" data-aq="detailAll" ${d.detailAll?'checked':''}> Incluir detalle de productos de todos los rubros</label>
 <label class="chk"><input type="checkbox" data-aq="mono" ${d.mono!==false?'checked':''}> Formato monoespaciado de WhatsApp (\`\`\`)</label>
 <label for="aq-n">Observaciones del cierre</label><input id="aq-n" data-aq="notes" maxlength="200" value="${esc(d.notes||'')}"></div>
 <div><div class="card" id="arq-tabs"></div><div class="card"><div class="row"><h3 class="sp">Texto para WhatsApp</h3></div><div class="rep" id="arq-prev" aria-live="polite"></div><div id="arq-warn"></div>
 <div class="row" style="margin-top:.8rem"><button class="btn" data-act="arqCopy">Copiar</button><button class="btn" data-act="arqWa">WhatsApp</button><button class="btn" data-act="arqWeb">WhatsApp Web</button><button class="btn" data-act="arqMail">Correo</button></div>
 <button class="btn gold" style="width:100%;margin-top:.8rem;min-height:52px" data-act="arqClose">Confirmar cierre de caja</button></div></div></div>`;},
 ()=>{arqPreview();arqFich();},'Operación');
function arqFich(){const s=openSess();if(!s)return;const d=arqDraft(s);const el=$('#aq-fich');if(!el)return;if(!d.empId){el.textContent='';return;}const h=hoursOn(d.empId,dkey(s.openedAt)===dkey(now())?dkey(now()):dkey(s.openedAt));
 el.innerHTML=h.h>0||h.flag?`Fichaje: <b>${numAR(h.h,2)} hs</b>${h.flag?' ⚠ falta fichar entrada o salida':''} <button class="btn sm" data-act="arqUseFich">Usar</button>`:'Sin fichadas hoy.';}
A.arqUseFich=()=>{const s=openSess();const d=arqDraft(s);const h=hoursOn(d.empId,dkey(now()));d.hours=h.h?numAR(h.h,2):'';audit('ARQUEO_HORAS_FICHAJE',empName(d.empId)+' '+d.hours+' hs');save();rerender();};
function arqCtx(){const s=openSess();if(!s)return null;const inp=arqInputs(s);const a=arqueoCalc(s,inp);const L=buildReport(a,dkey(now()),user.name,inp);return{s,inp,a,L};}
function arqPreview(){const c=arqCtx();if(!c)return;const p=$('#arq-prev');if(p)p.innerHTML=reportHTML(c.L);const tb=$('#arq-tabs');if(tb)tb.innerHTML=arqTablesHTML(c.a);const w=$('#arq-warn');if(w){let h='';if(c.a.pend.n)h+=`<div class="warnbox">Hay ${c.a.pend.n} cobro(s) digital(es) pendiente(s) que NO están en el total.</div>`;if(c.a.detMissing)h+=`<div class="warnbox">${c.a.detMissing} cobro(s) digital(es) sin el detalle del comprobante: completalos en «Cobros a conciliar» (Caja).</div>`;
 const f=c.a.reparte.filter(r=>r.falta>0);if(f.length)h+=`<div class="errbox">Impuesto no cubierto: ${f.map(r=>esc(r.owner)+' faltan '+money(r.falta)).join(' · ')}</div>`;w.innerHTML=h;}}
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset||!t.dataset.aq||curScreen!=='arqueo')return;const s=openSess();if(!s)return;const d=arqDraft(s);const k=t.dataset.aq;
 if(k==='tax'){d.taxes[t.dataset.rid]=t.value;}else if(t.type==='checkbox'){d[k]=t.checked;}else if(k==='empId'){return;}else d[k]=t.value;save();arqPreview();});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='aq-emp'&&curScreen==='arqueo'){const s=openSess();const d=arqDraft(s);d.empId=t.value;d.rate='';const h=hoursOn(d.empId,dkey(now()));d.hours=h.h>0?numAR(h.h,2):'';save();rerender();}});
A.arqCopy=()=>{const c=arqCtx();if(c){copyText(reportText(c.L,c.inp.mono));audit('ARQUEO_COPIAR','');}};
A.arqWa=()=>{const c=arqCtx();if(c){audit('ARQUEO_WHATSAPP','wa.me');openExternal(waLink(reportText(c.L,c.inp.mono),S.tenant.waReport));}};
A.arqWeb=()=>{const c=arqCtx();if(c){audit('ARQUEO_WHATSAPP_WEB','');openExternal('https://web.whatsapp.com/send?text='+encodeURIComponent(reportText(c.L,c.inp.mono)));}};
A.arqMail=()=>{const c=arqCtx();if(c){audit('ARQUEO_CORREO','mailto');location.href='mailto:?subject='+encodeURIComponent('Cierre de caja '+dmy(dkey(now())))+'&body='+encodeURIComponent(reportText(c.L,false));}};
A.arqClose=()=>{const c=arqCtx();if(!c)return;if(c.a.declared===null)return toast('Escribí el efectivo contado en caja antes de cerrar.',1);
 const warn=(c.a.detMissing?`<div class="warnbox">${c.a.detMissing} cobro(s) digital(es) sin el detalle del comprobante (queda anotado en el cierre).</div>`:'')+(c.a.pend.n?`<div class="warnbox">${c.a.pend.n} cobro(s) digital(es) pendiente(s) (${money(c.a.pend.total)}) quedan fuera del cierre; si se confirman después se informan como cobro posterior.</div>`:'')+(c.a.reparte.some(r=>r.falta>0)?'<div class="errbox">Hay impuestos que no se llegan a cubrir con la ganancia del día.</div>':'');
 modal('Cerrar caja',`${warn}<p>Esperado ${money(c.a.expectedCash)} · contado ${money(c.a.declared)} · ${c.a.diff===0?'sin diferencia':(c.a.diff>0?'sobrante ':'faltante ')+money(Math.abs(c.a.diff))}</p><p>El cierre queda <b>congelado</b> con sello SHA-256. Sólo se podrán agregar notas.</p>`,{okText:'Cerrar y sellar',onOk:()=>{
  const day=dkey(now());const data=JSON.parse(JSON.stringify(c.a));const text=reportText(c.L,false);const ts=now();
  const cl={id:uid(),ts,sessId:c.s.id,caja:c.s.caja,regId:c.s.regId||'',regName:c.s.regName||'',branchId:c.s.branchId||'',user:user.name,day,opening:c.s.opening,data,text,notes:[],obs:c.inp.notes};cl.hash=sha256(JSON.stringify({data,text,ts,user:cl.user,sess:c.s.id}));
  S.closures.push(cl);c.s.closedAt=ts;audit('CIERRE_CAJA','caja '+c.s.caja+' · total '+money(data.total)+' · dif '+money(data.diff)+' · sello '+cl.hash.slice(0,12));emit('cash.closed',{caja:c.s.caja,total:data.total});save();toast('Caja cerrada y sellada');location.hash='#panel/cierres';}});};

/* ===== Cajas cerradas ===== */
const verifyClosure=c=>c.hash===sha256(JSON.stringify({data:c.data,text:c.text,ts:c.ts,user:c.user,sess:c.sessId}));
reg('cierres','Cajas cerradas','lock','close_cash',()=>`<div class="row"><h1 class="sp">Cajas cerradas</h1>${expBar('cierres')}</div><div class="card"><div class="tw"><table><thead><tr><th>Fecha</th><th>Caja</th><th>Cerró</th><th class="r">Ventas</th><th class="r">Diferencia</th><th>Sello</th><th></th></tr></thead><tbody>${S.closures.slice().reverse().map(c=>`<tr><td>${fmtDT(c.ts)}</td><td>${c.caja}${c.regName?' · '+esc(c.regName):''}</td><td>${esc(c.user)}</td><td class="r">${money(c.data.total)}</td><td class="r ${c.data.diff<0?'neg':''}">${money(c.data.diff)}</td><td class="sm mut">${c.hash.slice(0,10)}…</td><td class="r"><button class="btn sm" data-act="clview" data-id="${c.id}">Ver detalle</button></td></tr>`).join('')||'<tr><td colspan="7" class="mut">Todavía no hay cierres.</td></tr>'}</tbody></table></div></div>`,null,'Operación');
A.clview=el=>{const c=S.closures.find(x=>x.id===el.dataset.id);if(!c)return;const ok=verifyClosure(c);
 const w=modal('Cierre de caja '+fmtDT(c.ts),`<div class="${ok?'okbox':'errbox'}">Integridad: ${ok?'verificada (el sello coincide)':'ALTERADO: el sello no coincide'} · SHA-256 ${c.hash.slice(0,16)}…</div>${c.data&&c.data.owner&&typeof ownerTablesHTML==='function'?ownerTablesHTML(c.data):(c.data&&c.data.reparte&&c.data.reparte[0]&&c.data.reparte[0].fis!==undefined&&typeof arqTablesHTML==='function'?arqTablesHTML(c.data):'')}<div class="rep">${esc(c.text)}</div>
 <h3 style="margin-top:.8rem">Movimientos${c.data&&c.data.owner?'':' (con rubro)'}</h3><div class="tw"><table><tbody>${c.data.movs.map(m=>`<tr><td>${hm(m.ts)}</td><td>${esc(m.type)}</td>${c.data.owner?'':`<td>${esc(m.rubro)}</td>`}<td>${esc(m.concept)}</td><td class="r">${money(m.amount)}</td></tr>`).join('')||'<tr><td class="mut">Sin movimientos</td></tr>'}</tbody></table></div>
 ${typeof xferAfterHTML==='function'?xferAfterHTML(c):''}
 <h3 style="margin-top:.8rem">Notas de revisión (sólo se agregan)</h3>${c.notes.map(n=>`<p class="sm">${fmtDT(n.ts)} · ${esc(n.user)}: ${esc(n.text)}</p>`).join('')||'<p class="sm mut">Sin notas.</p>'}<label for="cn">Agregar nota</label><input id="cn" maxlength="200">
 <div class="row" style="margin-top:.6rem">${typeof expBtn==='function'?expBtn('cierre',c.id):''}<button class="btn" data-act="clcopy" data-id="${c.id}">Copiar texto</button><button class="btn" data-act="clwa" data-id="${c.id}">WhatsApp</button><button class="btn" data-act="clsales" data-id="${c.id}">Ver ventas del turno</button><button class="btn" onclick="window.print()">Imprimir</button></div>`,{okText:'Guardar nota',onOk:()=>{const t=val('cn').trim();if(t){c.notes.push({ts:now(),user:user.name,text:t});audit('NOTA_CIERRE',t);save();}}});};
A.clsales=el=>{const c=S.closures.find(x=>x.id===el.dataset.id);if(c)cierreSalesOpen(c);};
A.clcopy=el=>{const c=S.closures.find(x=>x.id===el.dataset.id);c&&copyText('```\n'+c.text+'\n```');};
A.clwa=el=>{const c=S.closures.find(x=>x.id===el.dataset.id);c&&openExternal(waLink('```\n'+c.text+'\n```',S.tenant.waReport));};

/* ===== Inicio / dashboard ===== */
