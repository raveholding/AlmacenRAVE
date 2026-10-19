/* ===== Venta (POS) · barra de teclas F arriba, cobro con cliente, cupón y fiado ===== */
const pos={lines:[],method:'efectivo',arca:false,rcp:null,sel:-1,q:'',rub:'',cust:'',coupon:'',stamp:'',recv:'',mix:false,pays:[]};
const prod=id=>S.products.find(p=>p.id===id);
const pfull=p=>p.name+(p.sub?' ('+p.sub+')':'');
const qtyIn=pid=>pos.lines.filter(l=>l.pid===pid).reduce((a,l)=>a+l.qty,0);
const posGross=()=>pos.lines.reduce((a,l)=>a+Math.round(l.qty*l.price),0);
const posBen=()=>(typeof wsNoClub==='function'&&wsNoClub())?{disc:0,kind:'',label:'',code:'',couponId:'',couponErr:'',base:0}:applyBenefit(pos.lines,pos.cust,pos.coupon);
const posTotal=()=>posGross()-posBen().disc;
const POS_METHODS=['efectivo','debito','credito','fiado','transferencia','qr','modo'];
const FKEYS=[
 {n:1,l:'Efectivo',act:'fpay',m:'efectivo'},{n:2,l:'Débito',act:'fpay',m:'debito'},{n:3,l:'Crédito',act:'fpay',m:'credito'},{n:4,l:'Cta. cte. / Fiado',act:'fpay',m:'fiado'},
 {n:5,l:'Nota de crédito',act:'fnc'},{n:6,l:'Reintegro',act:'fre'},{n:7,l:'Borrar op.',act:'pclear'},{n:8,l:'ARCA',act:'parca',dyn:true},
 {n:9,l:'Cantidad',act:'fqty'},{n:10,l:'Precio',act:'fprice'},{n:11,l:'Buscar',act:'fsearch'},{n:12,l:'Cobrar',act:'cobrar',gold:true}];
function fbarHTML(){return FKEYS.map(k=>`<button type="button" class="fk ${k.gold?'gold':''} ${(k.act==='fpay'&&pos.method===k.m)?'on':''}" data-act="${k.act}" ${k.m?`data-m="${k.m}"`:''} aria-label="${esc(k.l)} (F${k.n})"><b>${k.dyn?(pos.arca?'CON ARCA':'SIN ARCA'):esc(k.l)}</b><small>F${k.n}</small></button>`).join('');}

/* ---- pagos de una venta: contrato único (venta simple o mixta) ----
   sale.pays = [{m,a,fee}] en centavos IMPUTADOS a la factura (el vuelto no entra: es plata del cliente que vuelve).
   La parte 'fiado' es deuda en cuenta corriente: no es dinero cobrado ni entra a la caja del turno. */
const PAY_MIX=['efectivo','debito','credito','transferencia','fiado'];
function salePays(s){return(s.pays&&s.pays.length)?s.pays:[{m:s.method,a:s.total,fee:s.fee||0}];}
function saleFiadoAmt(s){return s.pays&&s.pays.length?s.pays.filter(p=>p.m==='fiado').reduce((a,p)=>a+p.a,0):(s.fiado?s.total:0);}
function saleCollected(s){return s.total-saleFiadoAmt(s);}
function salePayState(s){const f=saleFiadoAmt(s);return f<=0?'pagada':(f>=s.total?'pendiente':'parcial');}
const PSTATE_TXT={pagada:'Pagada',parcial:'Pago parcial',pendiente:'Pendiente de cobro'};
function salePayLabel(s){const L=salePays(s);if(L.length<2)return MET[s.method]||s.method;return 'Mixto: '+L.map(p=>(MET[p.m]||p.m)+' '+money(p.a)).join(' + ');}
function payCheck(pays,total,cust,recv){
 /* validación única (la usa la pantalla para avisar y commitSale para decidir) */
 if(!Array.isArray(pays)||!pays.length)return{err:'Elegí al menos un medio de pago.'};
 const seen={};let sum=0;
 for(const p of pays){
  if(!p||!MET[p.m]||p.m==='mixto')return{err:'Medio de pago inválido.'};
  if(seen[p.m])return{err:'El medio '+(MET[p.m]||p.m)+' está repetido: sumá los importes en una sola línea.'};seen[p.m]=1;
  if(!Number.isInteger(p.a)||p.a<=0)return{err:'El importe de '+(MET[p.m]||p.m)+' debe ser mayor a cero.'};sum+=p.a;}
 if(pays.length>1&&pays.some(p=>p.m==='qr'||p.m==='modo'))return{err:'QR y MODO se cobran solos (quedan pendientes de confirmación): no se pueden combinar con otro medio.'};
 if(sum!==total)return{err:'La suma de los pagos ('+money(sum)+') no coincide con el total ('+money(total)+'): '+(sum<total?'faltan ':'sobran ')+money(Math.abs(total-sum))+'.',diff:total-sum};
 const fi=pays.find(p=>p.m==='fiado');
 if(fi&&!cust)return{err:'La cuenta corriente exige identificar al cliente (no puede ser consumidor final).'};
 const ef=pays.find(p=>p.m==='efectivo');let vuelto=0;
 if(recv>0){if(!ef)return{err:'Indicaste efectivo recibido pero no hay una línea de efectivo.'};if(recv<ef.a)return{err:'El efectivo recibido ('+money(recv)+') es menor al importe en efectivo ('+money(ef.a)+').'};vuelto=recv-ef.a;}
 return{ok:1,vuelto,fiadoAmt:fi?fi.a:0,cash:ef?ef.a:0};}

function commitSale(method,arca,channel,lines,opts){
 opts=opts||{};
 const sess=openSess();if(!sess)return{err:'No hay caja abierta.'};lines=lines||pos.lines;if(!lines.length)return{err:'La operación está vacía.'};
 const need={};lines.forEach(l=>need[l.pid]=(need[l.pid]||0)+l.qty);
 for(const pid in need){const p=prod(pid);if(!p||!p.active)return{err:'Producto no disponible.'};if(!canOver(p)&&need[pid]>p.stock+1e-9)return{err:'Sin stock suficiente de '+p.name+' (hay '+p.stock+'). Este producto exige stock.'};}
 for(const l of lines){if(!(l.qty>0)||!(l.price>0))return{err:'Cantidad y precio deben ser mayores a cero.'};}
 /* beneficio: se recalcula acá (en la versión con servidor, en el servidor) */
 const cust=opts.custId?custById(opts.custId):null;
 const W=(opts.ws&&wsOn())?wsGate(lines,cust,opts):null;if(W&&W.err)return W;
 const ben=(W&&W.chan==='mayorista'&&!W.club)?{disc:0,kind:'',label:'',code:'',couponId:'',couponErr:'',base:0}:(typeof applyBenefit==='function')?applyBenefit(lines,cust?cust.id:'',opts.coupon||''):{disc:0,kind:''};
 if(opts.coupon&&ben.kind!=='coupon'&&ben.couponErr)return{err:'Cupón: '+ben.couponErr};
 const gross=lines.reduce((a,l)=>a+Math.round(l.qty*l.price),0);const total=gross-ben.disc;const alloc=allocDisc(lines,ben.disc);
 /* pagos: una sola línea (venta simple) o varias (mixta). Todo se valida ANTES de tocar stock, caja o cuenta corriente. */
 const pays=(opts.pays&&opts.pays.length?opts.pays:[{m:method,a:total}]).map(p=>({m:p.m,a:p.a}));
 const pc=payCheck(pays,total,cust,opts.recv||0);if(pc.err)return{err:pc.err};
 method=pays.length>1?'mixto':pays[0].m;
 let cr={ok:1};if(pc.fiadoAmt>0){cr=wsCreditCheck(cust,pc.fiadoAmt);if(cr.err)return cr;}
 let stampRes=null;if(opts.stampCode){if(!cust)return{err:'El código de sello necesita un cliente.'};stampRes=resolveStamp(opts.stampCode,cust.id);if(!stampRes.ok)return{err:'Sello: '+stampRes.msg};}
 const c=S.tenant.caja;S.seq[c]=(S.seq[c]||0)+1;const digital=method==='qr'||method==='modo';
 pays.forEach(p=>{p.fee=(digital||p.m==='fiado')?0:Math.round(p.a*((S.cfg.fee[p.m]||0))/100);});
 const fiadoAmt=pc.fiadoAmt;
 const sale={id:uid(),n:c+'-'+S.seq[c],ts:now(),user:user?user.name:'sistema',caja:c,sessId:sess.id,items:lines.map((l,i)=>({pid:l.pid,name:l.name,rubro:l.rubro,qty:l.qty,price:l.price,cost:l.cost,list:l.list,disc:alloc[i]||0,...(W&&l.rule?{lr:l.rule,ll:l.lst||'',lb:l.base||0}:{})})),total,method,
  doc:arca?'factura_pendiente_cae':'ticket_interno',status:digital?'pendiente':'ok',fee:0,channel:channel||'local',cust:cust?cust.id:'',custName:cust?cust.name+' '+cust.last:'',
  coupon:ben.kind==='coupon'?ben.code:'',benefit:ben.disc?{kind:ben.kind,label:ben.label,disc:ben.disc}:null,recv:opts.recv||0,fiado:fiadoAmt>0,
  pays,fiadoAmt,paid:total-fiadoAmt,balance:fiadoAmt,vuelto:pc.vuelto,pstate:fiadoAmt<=0?'pagada':(fiadoAmt>=total?'pendiente':'parcial')};
 sale.fee=pays.reduce((a,p)=>a+p.fee,0);
 if(W)sale.wch=W.chan;if(cr.ov)sale.cov=cr.ov;if(fiadoAmt>0&&wsOn()&&cust&&cust.term>0){sale.term=cust.term;sale.due=sale.ts+cust.term*WS_DAY;}
 const neg=[];for(const pid in need){const p=prod(pid);p.stock=Math.round((p.stock-need[pid])*1000)/1000;if(p.stock<0)neg.push(p.name+' → '+p.stock);}if(neg.length)audit('VENTA_SIN_STOCK',neg.join(' · '));
 S.sales.push(sale);S.lastSale=sale.id;
 if(cr.ov){(S.creditUse=S.creditUse||[]).push({id:uid(),ov:cr.ov,sale:sale.id,amt:fiadoAmt,ts:now(),user:user?user.name:'sistema'});audit('EXCEPCION_CREDITO_USO',sale.n+' · '+custFull(cust)+' · '+money(fiadoAmt)+' (supera '+cr.probs.join(' ').slice(0,120)+')');}
 if(ben.kind==='coupon'&&ben.couponId){const cp=S.coupons.find(x=>x.id===ben.couponId);if(cp)cp.uses.push({ts:now(),sale:sale.id,cust:cust?cust.id:''});}
 if(opts.receptor&&arca&&typeof arcaRcpStore==='function')arcaRcpStore(sale.id,opts.receptor);
 if(stampRes&&stampRes.ok){commitStamp(cust.id,stampRes,'venta '+sale.n);sale.stamped=true;}
 audit('VENTA',sale.n+' · '+salePayLabel(sale)+' · '+money(total)+(sale.benefit?' · '+ben.label+' -'+money(ben.disc):'')+' · '+(arca?'Con ARCA (pend. CAE)':'Sin ARCA')+(cust?' · cliente '+cust.num:'')+(pc.vuelto?' · vuelto '+money(pc.vuelto):''));
 if(fiadoAmt>0)audit('CTA_CTE_DEBITO',sale.n+' · '+custFull(cust)+' · débito '+money(fiadoAmt)+' · estado '+PSTATE_TXT[sale.pstate]);
 emit('sale.created',{sale:sale.n,total,method});if(digital)emit('payment.pending',{sale:sale.n,method});
 if(typeof pubRefresh==='function')pubRefresh();save();return{sale,stamp:stampRes&&stampRes.ok?stampRes:null};}

function posGrid(){const g=$('#pgrid');if(!g)return;const q=pos.q.trim().toLowerCase();
 const list=S.products.filter(p=>p.active&&(!pos.rub||p.rubro===pos.rub)&&(!q||pfull(p).toLowerCase().includes(q)||(p.barcode&&p.barcode.includes(q))));
 g.innerHTML=list.map(p=>`<button class="pbtn" data-act="padd" data-id="${p.id}" ${(p.stock<=0&&!canOver(p))?'disabled':''}><b>${esc(p.name)}</b>${p.sub?`<span>${esc(p.sub)}</span>`:''}<span><i class="rdot" style="background:${rub(p.rubro)?safeColor(rub(p.rubro).color):'#999'}"></i>${esc(rubName(p.rubro))}</span><span>${money(p.price)}${p.unit!=='u'?' / '+unitLbl(p.unit):''} · <span class="${p.stock<0?'negs':''}">stock ${stockTxt(p)}</span></span></button>`).join('')||'<p class="mut">Sin resultados.</p>';}
function posCart(){const c=$('#pcart');if(!c)return;const sess=openSess();if(typeof wsRecalc==='function')wsRecalc();
 const fb=$('#fbar');if(fb)fb.innerHTML=fbarHTML();
 c.innerHTML=(sess?'':`<div class="warnbox">No hay caja abierta. <a href="#panel/caja">Abrí la caja</a> para vender.</div>`)+
 (pos.lines.length?pos.lines.map((l,i)=>`<div class="cline" style="${i===pos.sel?'background:#fbf5e8;border-radius:10px;padding:.5rem':''}"><div class="row"><b class="sp">${esc(l.name)}</b><span class="tag">${esc(rubName(l.rubro))}</span><button class="btn sm red" data-act="prm" data-i="${i}" aria-label="Quitar">✕</button></div>
  <div class="f"><div><label>Cant.${l.unit!=='u'?' ('+unitLbl(l.unit)+')':''}</label><input inputmode="decimal" data-line="${i}" data-fld="qty" value="${esc(String(l.qty).replace('.',','))}"></div><div><label>Precio $</label><input inputmode="decimal" data-line="${i}" data-fld="price" value="${esc(pesosStr(l.price))}"></div><div><label>Importe $</label><input inputmode="decimal" data-line="${i}" data-fld="amt" value="${esc(pesosStr(lineTotal(l)))}"></div></div>${(()=>{const q=prod(l.pid);return q&&qtyIn(l.pid)>q.stock+1e-9?`<div class="tag bad" style="margin-top:.3rem">Sin stock: quedará en negativo (${stockTxt({stock:q.stock-qtyIn(l.pid),unit:q.unit})})</div>`:'';})()}${typeof wsLineInfo==='function'?wsLineInfo(l,i):''}${l.price!==l.list?`<div class="sm warn tag warn" style="margin-top:.3rem">Precio de lista ${money(l.list)} · modificado</div>`:''}${(l.unit!=='u'&&scaleReady())?`<button class="btn sm" data-act="pesar" data-i="${i}">⚖ Pesar</button>`:''}</div>`).join(''):'<p class="mut">Tocá un producto o pasá el lector de código de barras.</p>')+
 `${typeof wsCartBar==='function'?wsCartBar():''}<div class="row" style="margin:.7rem 0"><span class="sp mut">Total</span><span class="total">${money(posTotal())}</span></div>
 <p class="sm ${pos.arca?'':'mut'}">${pos.arca?'Documento: Factura electrónica (el CAE se pide a ARCA al cobrar)':'Documento: Ticket interno — DOCUMENTO NO VÁLIDO COMO FACTURA'}</p>
 <p class="sm mut">Medio elegido: <b>${esc(MET[pos.method]||pos.method)}</b></p>
 <button class="btn gold" style="width:100%;min-height:56px;font-size:1.1rem" data-act="cobrar" ${pos.lines.length?'':'disabled'}>Cobrar (F12)</button>
 <div class="row" style="margin-top:.6rem"><button class="btn sm sp" data-act="mov" data-type="ingreso">Ingreso de efectivo</button><button class="btn sm sp" data-act="mov" data-type="egreso">Egreso de efectivo</button></div>`;}
A.padd=el=>{const p=prod(el.dataset.id);if(!p)return;const cur=qtyIn(p.id);const step=1;if(!canOver(p)&&cur+step>p.stock){toast('Sin stock suficiente de '+p.name+' (este producto exige stock)',1);return;}if(cur+step>p.stock)toast('Sin stock: se vende igual y queda en negativo ('+p.name+')');
 const L=pos.lines.find(l=>l.pid===p.id);if(L){L.qty+=step;pos.sel=pos.lines.indexOf(L);}else{pos.lines.push({pid:p.id,name:pfull(p),rubro:p.rubro,qty:1,price:p.price,cost:p.cost,unit:p.unit,list:p.price});pos.sel=pos.lines.length-1;}posCart();};
A.prm=el=>{pos.lines.splice(+el.dataset.i,1);pos.sel=pos.lines.length-1;posCart();};
A.prub=el=>{pos.rub=el.dataset.id;$$('[data-act="prub"]').forEach(b=>b.classList.toggle('on',b.dataset.id===pos.rub));posGrid();};
A.parca=()=>{pos.arca=!pos.arca;audit('ARCA_OPERACION',pos.arca?'Con ARCA':'Sin ARCA');posCart();if(cobroW())cobroRender();};
A.pclear=()=>{if(!pos.lines.length)return;confirmBox('Borrar la operación','Se descartan todas las líneas del ticket en curso.',()=>{confirmBox('Segunda confirmación','¿Seguro? Esta acción queda en auditoría.',()=>{audit('BORRAR_OPERACION',pos.lines.length+' líneas · '+money(posTotal()));pos.lines=[];pos.sel=-1;pos.cust='';pos.chanSet=null;pos.coupon='';posCart();},'Sí, borrar');},'Continuar');};
function lineEdit(i,fld,v){const L=pos.lines[i];if(!L)return;const bad=m=>{toast(m,1);posCart();};
 if(fld==='qty'){const q=parseNum(v);if(!(q>0))return bad('La cantidad debe ser mayor a cero.');if(L.unit==='u'&&!Number.isInteger(q))return bad('Este producto se vende por unidad entera.');
  const p=prod(L.pid);const other=qtyIn(L.pid)-L.qty;if(!canOver(p)&&other+q>p.stock+1e-9)return bad('Sin stock suficiente (hay '+p.stock+').');L.qty=Math.round(q*1000)/1000;}
 else if(fld==='price'){const c=cents(v);if(!(c>0))return bad('El precio debe ser mayor a cero.');const old=L.price;L.price=c;L.man=1;if(old!==c)audit('PRECIO_LINEA',L.name+' lista '+money(L.list)+' → aplicado '+money(c));}
 else if(fld==='amt'){const c=cents(v);if(!(c>0))return bad('El importe debe ser mayor a cero.');const old=L.price;
  if(L.unit==='u'){L.price=Math.max(1,Math.round(c/L.qty));L.man=1;}else L.qty=Math.round(c/L.price*1000)/1000;
  const p=prod(L.pid);if(!canOver(p)&&qtyIn(L.pid)>p.stock+1e-9){L.qty=Math.max(0.001,p.stock);return bad('Sin stock suficiente.');}
  if(old!==L.price)audit('PRECIO_LINEA',L.name+' lista '+money(L.list)+' → aplicado '+money(L.price)+' (por importe)');}
 pos.sel=i;posCart();}
document.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.line!==undefined)lineEdit(+t.dataset.line,t.dataset.fld,t.value);});
document.addEventListener('input',e=>{if(e.target.id==='psearch'){pos.q=e.target.value;posGrid();}});

/* ---- teclas F como botones (arriba) ---- */
A.fpay=el=>{pos.method=el.dataset.m;if(pos.lines.length)A.cobrar();else{posCart();toast('Medio elegido: '+MET[pos.method]+'. Agregá productos y cobrá con F12.');}};
A.fqty=()=>{const i=pos.sel>=0?pos.sel:pos.lines.length-1;const f=$(`[data-line="${i}"][data-fld="qty"]`);if(f){f.focus();f.select();}else toast('Elegí una línea del ticket.',1);};
A.fprice=()=>{const i=pos.sel>=0?pos.sel:pos.lines.length-1;const f=$(`[data-line="${i}"][data-fld="price"]`);if(f){f.focus();f.select();}else toast('Elegí una línea del ticket.',1);};
A.fsearch=()=>{const f=$('#psearch');if(f){f.focus();f.select();}};
A.fre=()=>movModal('egreso','Reintegro');
A.fnc=()=>{if(!can('void'))return toast('Sólo administración puede emitir notas de crédito o anular.',1);
 const L=S.sales.filter(s=>s.status==='ok'||s.status==='pendiente').slice(-15).reverse();
 modal('Nota de crédito / anulación',`<p class="sm mut">Con CAE se emite nota de crédito; sin CAE se anula la venta (devuelve el stock). Elegí la venta:</p>${L.map(s=>`<div class="row" style="border-bottom:1px solid var(--line);padding:.35rem 0"><span class="sp">${esc(s.n)} · ${fmtDT(s.ts)} · ${money(s.total)} · ${esc(MET[s.method]||s.method)}</span><button class="btn sm red" data-act="ncgo" data-id="${s.id}">${s.arca&&s.arca.cae&&!s.arcaNC?'Emitir NC':'Anular'}</button></div>`).join('')||'<p class="mut">No hay ventas para anular.</p>'}`,{ok:false,cancelText:'Cerrar'});};
A.ncgo=el=>{$$('#modal-root .ov').forEach(o=>o.remove());A.voidsale(el);};

/* ---- cobro ---- */
function cobroW(){const d=$('#modal-root .dlg[aria-label="Confirmar cobro"]');return d?d.closest('.ov'):null;}
function cobroSync(){const w=cobroW();if(!w)return;const g=id=>w.querySelector('#'+id);if(g('cb-cup'))pos.coupon=g('cb-cup').value.trim().toUpperCase();if(g('cb-code'))pos.stamp=g('cb-code').value.trim();if(g('rcv'))pos.recv=g('rcv').value;if(typeof arcaRcpSync==='function')arcaRcpSync(w);}
function cobroRender(){const w=cobroW();if(!w)return;cobroSync();w.querySelector('.mb').innerHTML=cobroView();}
function mixParsed(){ /* pagos tal como están cargados en pantalla (centavos); NaN = número inválido */
 return pos.pays.map(p=>({m:p.m,a:p.a===''?0:cents(p.a),r:p.r===''?0:cents(p.r)}));}
function mixSummaryHTML(tot){
 const L=mixParsed();const sum=L.reduce((a,p)=>a+(isNaN(p.a)?0:p.a),0);const diff=tot-sum;
 const ef=L.find(p=>p.m==='efectivo');const rc=ef&&!isNaN(ef.r)?ef.r:0;const efA=ef&&!isNaN(ef.a)?ef.a:0;
 const fi=L.find(p=>p.m==='fiado'&&!isNaN(p.a)&&p.a>0);
 let h=`<div class="row sm"><span class="sp">Total a cobrar</span><b>${money(tot)}</b></div><div class="row sm"><span class="sp">Imputado en los medios</span><b>${money(sum)}</b></div>`;
 h+=diff===0?'<div class="okbox sm" role="status"><b>✔ Cubierto exacto.</b></div>':diff>0?`<div class="errbox sm" role="status"><b>Faltan ${money(diff)}</b> para completar el total.</div>`:`<div class="errbox sm" role="status"><b>Sobran ${money(-diff)}</b>: los medios suman más que el total.</div>`;
 if(fi)h+=`<div class="warnbox sm">A cuenta corriente: <b>${money(fi.a)}</b> · <u>no ingresa a la caja</u>, queda como deuda del cliente.</div>`;
 if(ef&&rc>0){if(rc>=efA&&efA>0){const v=rc-efA;h+=v>0?`<div class="vuelto" role="alert" aria-live="assertive"><span>VUELTO A ENTREGAR</span><b>${money(v)}</b><small>Recibido ${money(rc)} − efectivo imputado ${money(efA)}</small></div>`:'<div class="okbox sm">Efectivo justo: sin vuelto.</div>';}
  else if(efA>0)h+=`<div class="errbox sm"><b>Efectivo recibido insuficiente:</b> faltan ${money(efA-rc)} para el importe en efectivo.</div>`;}
 return h;}
function cobroView(){
 if(typeof wsRecalc==='function')wsRecalc();
 const cust=custById(pos.cust);const ben=posBen();const gross=posGross();const tot=gross-ben.disc;const m=pos.mix?'mixto':pos.method;
 const needCust=m==='fiado'||(pos.mix&&pos.pays.some(p=>p.m==='fiado'));
 const chips=POS_METHODS.map((k,i)=>`<button type="button" class="btn sm ${m===k?'on':''}" data-act="cbmet" data-m="${k}">${esc(MET[k]||k)}${i<4?` (F${i+1})`:''}</button>`).join('')+`<button type="button" class="btn sm ${pos.mix?'on':''}" data-act="cbmix" aria-pressed="${pos.mix?'true':'false'}">Dividir el pago (mixto)</button>`;
 const custBox=cust?`<div class="okbox row"><span class="sp"><b>${esc(cust.name+' '+cust.last)}</b> · socio ${esc(pad4(cust.num))}${memberActive(cust)?' · ⭐ '+esc(memberActive(cust).name):''}${needCust?` · debe ${money(debtOf(cust.id))} de ${money(cust.limit||0)}`:''}</span><button class="btn sm" data-act="cbcust" data-id="">Quitar</button></div>`
  :`<label for="cb-q">Cliente ${needCust?'(obligatorio para cuenta corriente)':'(opcional: sellos, cupones, membresía)'}</label><input id="cb-q" placeholder="Buscar por nombre, WhatsApp o DNI" autocomplete="off"><div id="cb-res"></div>`;
 const benTxt=(ben.disc?`<div class="okbox">${esc(ben.label)}: − ${money(ben.disc)}${ben.note?'<br><span class="sm">'+esc(ben.note)+'</span>':''}</div>`:'')+(pos.coupon&&ben.couponErr?`<div class="errbox">Cupón: ${esc(ben.couponErr)}</div>`:'')+(!ben.disc&&ben.note?`<div class="warnbox sm">${esc(ben.note)}</div>`:'');
 const mixHtml=pos.mix?`<div class="card" id="mixbox" style="margin:.5rem 0"><h3 style="margin-top:0">Pagos del cliente</h3><p class="sm mut">Repartí el total entre los medios. La suma debe dar exactamente el total. El efectivo que entrega el cliente va en “Recibe en mano”; si es más que el importe, se calcula el vuelto.</p>
  ${pos.pays.map((p,i)=>`<div class="mixrow" data-row="${i}"><div><label for="mx-m${i}">Medio</label><select id="mx-m${i}" data-pi="${i}" data-pf="m">${PAY_MIX.map(k=>`<option value="${k}" ${p.m===k?'selected':''}>${esc(MET[k])}</option>`).join('')}</select></div>
   <div><label for="mx-a${i}">Importe a imputar ($)</label><input id="mx-a${i}" inputmode="decimal" autocomplete="off" placeholder="0" data-pi="${i}" data-pf="a" value="${esc(p.a)}"></div>
   ${p.m==='efectivo'?`<div><label for="mx-r${i}">Recibe en mano ($)</label><input id="mx-r${i}" inputmode="decimal" autocomplete="off" placeholder="Justo: dejalo vacío" data-pi="${i}" data-pf="r" value="${esc(p.r)}"></div>`:'<div></div>'}
   <div class="mixbtns"><button type="button" class="btn sm" data-act="cbrest" data-i="${i}">Resto</button>${pos.pays.length>1?`<button type="button" class="btn sm red" data-act="cbmrm" data-i="${i}" aria-label="Quitar este medio">✕</button>`:''}</div></div>`).join('')}
  ${pos.pays.length<PAY_MIX.length?'<button type="button" class="btn sm" data-act="cbmadd">+ Agregar medio</button>':''}
  <div id="mx-sum" style="margin-top:.6rem">${mixSummaryHTML(tot)}</div></div>`:'';
 return `<div class="card" style="margin-bottom:.6rem">${pos.lines.map(l=>`<div class="row sm"><span class="sp">${esc(l.name)} × ${numAR(l.qty,3)}${typeof wsLineTag==='function'?wsLineTag(l):''}</span><b>${money(Math.round(l.qty*l.price))}</b></div>`).join('')}${ben.disc?`<div class="row sm"><span class="sp">Subtotal</span><span>${money(gross)}</span></div><div class="row sm" style="color:var(--ok)"><span class="sp">${esc(ben.label)}</span><b>− ${money(ben.disc)}</b></div>`:''}<hr><div class="row"><span class="sp">TOTAL</span><span class="total">${money(tot)}</span></div></div>
 <div class="row" style="margin-bottom:.5rem">${chips}</div>
 <p class="sm"><b>Documento:</b> ${pos.arca?'Factura electrónica (CAE al cobrar)':'Ticket interno — DOCUMENTO NO VÁLIDO COMO FACTURA'} <button class="btn sm" data-act="parca">${pos.arca?'CON ARCA':'SIN ARCA'} (F8)</button></p>
 ${custBox}
 ${mixHtml}
 ${typeof arcaRcpHtml==='function'?arcaRcpHtml():''}
 ${typeof wsNoClub==='function'&&wsNoClub()?wsClubOff():''}
 <div class="grid g2" style="${typeof wsNoClub==='function'&&wsNoClub()?'display:none':''}"><div><label for="cb-cup">Cupón</label><div class="row"><input id="cb-cup" class="sp" maxlength="24" placeholder="CÓDIGO" autocomplete="off" value="${esc(pos.coupon)}"><button class="btn sm" data-act="cbcup">Aplicar</button></div></div>
 <div><label for="cb-code">Sello del Club: DNI, código o QR del cliente</label><input id="cb-code" inputmode="text" placeholder="DNI, 0007 4821 o lector de QR" autocomplete="off" value="${esc(pos.stamp)}"><div class="row" style="margin-top:.3rem"><button class="btn sm" type="button" data-act="cbQr">📷 QR</button><button class="btn sm" type="button" data-act="cbNfc">📡 NFC</button></div></div></div>
 ${benTxt}
 ${m==='fiado'&&!cust?'<div class="warnbox">Elegí el cliente para dejar la venta en cuenta corriente.</div>':''}
 ${m==='efectivo'?`<label for="rcv">Recibido ($) — opcional</label>${numIn('rcv',0,'0')}<div id="vuelto" class="sm mut" aria-live="assertive"></div>`:''}
 ${pos.mix&&needCust&&!cust?'<div class="warnbox">Hay una línea de cuenta corriente: identificá al cliente (no puede ser consumidor final).</div>':''}
 ${(m==='qr'||m==='modo')?'<div class="warnbox">Cobro digital: queda <b>pendiente</b> hasta que llegue la confirmación del webhook. El stock se reserva y el cobro no cuenta en caja hasta confirmarse.</div>':''}`;}
function vueltoHTML(r,tot){if(isNaN(r)||!r)return '';if(r>tot)return `<div class="vuelto" role="alert"><span>VUELTO A ENTREGAR</span><b>${money(r-tot)}</b><small>Recibido ${money(r)} − total ${money(tot)}</small></div>`;if(r===tot)return '<div class="okbox sm">Efectivo justo: sin vuelto.</div>';return `<div class="errbox sm"><b>Falta ${money(tot-r)}</b> para completar el efectivo.</div>`;}
A.cobrar=()=>{if(!pos.lines.length)return;if(!can('sell'))return toast('Sin permiso',1);if(!openSess()){toast('Abrí la caja para vender.',1);return;}
 if(cobroW())return;
 if(typeof stampPrep==='function')stampPrep();
 const w=modal('Confirmar cobro',cobroView(),{wide:true,okText:'Cobrar (F12)',onOk:()=>{cobroSync();
  const rc=pos.recv?cents(pos.recv):0;
  if(pos.stamp&&!pos.cust){const vr=resolveStamp(pos.stamp,'');if(vr.ok)pos.cust=vr.cust.id;}
  if(pos.arca&&typeof arcaRcpCheck==='function'){const er=arcaRcpCheck();if(er){toast(er,1);return false;}}
  let pays=null,recv=isNaN(rc)?0:rc;
  if(pos.mix){const L=mixParsed();if(L.some(p=>isNaN(p.a)||isNaN(p.r))){toast('Revisá los importes: hay un número inválido.',1);return false;}
   pays=L.filter(p=>p.a>0).map(p=>({m:p.m,a:p.a}));const ef=L.find(p=>p.m==='efectivo');recv=ef?ef.r:0;}
  const r=commitSale(pos.mix?'mixto':pos.method,pos.arca,'local',pos.lines,{custId:pos.cust,coupon:pos.coupon,stampCode:pos.stamp,recv,pays,ws:wsOn()?{chan:wsChan()}:null,receptor:pos.arca&&typeof arcaRcpGet==='function'?arcaRcpGet():null});
  if(r.err){wsCommitErr(r);return false;}
  const sale=r.sale;pos.lines=[];pos.sel=-1;pos.cust='';pos.chanSet=null;pos.rcp=null;pos.coupon='';pos.stamp='';pos.recv='';pos.mix=false;pos.pays=[];posCart();posGrid();
  toast('Venta '+sale.n+' registrada'+(r.stamp?' · sello sumado':''));
  setTimeout(()=>{if(sale.status==='pendiente')payModal(sale);else if(sale.doc!=='ticket_interno'&&typeof arcaPostSale==='function')arcaPostSale(sale,r.stamp);else receiptModal(sale,r.stamp);},50);}});
 w.addEventListener('input',e=>{const t=e.target;
  if(t.id==='rcv'){const v=$('#vuelto',w);if(v)v.innerHTML=vueltoHTML(cents(t.value),posTotal());}
  if(t.dataset&&t.dataset.pi!==undefined&&t.dataset.pf!=='m'){pos.pays[+t.dataset.pi][t.dataset.pf]=t.value;const sm=$('#mx-sum',w);if(sm)sm.innerHTML=mixSummaryHTML(posTotal());}
  if(t.id==='cb-q'){const q=t.value.trim().toLowerCase();const res=$('#cb-res',w);if(!q){res.innerHTML='';return;}
   const L=S.customers.filter(c=>c.status!=='baja'&&((c.name+' '+c.last).toLowerCase().includes(q)||c.wa.replace(/\D/g,'').includes(q.replace(/\D/g,'')||'zz')||pad4(c.num)===q||(c.dni&&normDni(q).length>=6&&normDni(c.dni)===normDni(q)))).slice(0,6);
   res.innerHTML=L.map(c=>`<button class="btn sm" style="margin:.2rem .2rem 0 0" data-act="cbcust" data-id="${c.id}">${esc(c.name+' '+c.last)} · ${esc(pad4(c.num))}</button>`).join('')||'<span class="sm mut">Sin resultados</span>';}});
 w.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.pi!==undefined&&t.dataset.pf==='m'){const row=pos.pays[+t.dataset.pi];row.m=t.value;if(row.m!=='efectivo')row.r='';cobroRender();}});};
A.cbmix=()=>{cobroSync();pos.mix=!pos.mix;if(pos.mix){const first=(PAY_MIX.includes(pos.method)&&pos.method!=='fiado')?pos.method:'efectivo';pos.pays=[{m:first,a:'',r:''},{m:'fiado',a:'',r:''}];}else{pos.pays=[];}cobroRender();};
A.cbmadd=()=>{const used=pos.pays.map(p=>p.m);const m=PAY_MIX.find(k=>!used.includes(k));if(m){pos.pays.push({m,a:'',r:''});cobroRender();}};
A.cbmrm=el=>{pos.pays.splice(+el.dataset.i,1);cobroRender();};
A.cbrest=el=>{const L=mixParsed();const i=+el.dataset.i;const others=L.reduce((a,p,j)=>a+(j===i||isNaN(p.a)?0:p.a),0);const rest=posTotal()-others;if(rest<=0)return toast('No queda resto: los otros medios ya cubren el total.',1);pos.pays[i].a=pesosStr(rest);cobroRender();};
A.cbmet=el=>{pos.method=el.dataset.m;pos.mix=false;pos.pays=[];cobroRender();posCart();};
A.cbcust=el=>{pos.cust=el.dataset.id||'';pos.chanSet=null;cobroRender();posCart();};
A.cbcup=()=>{cobroRender();};
const cbSetStamp=t=>{const i=document.getElementById('cb-code');if(i)i.value=t;pos.stamp=t;cobroRender();};
A.cbQr=()=>qrScan(cbSetStamp);
A.cbNfc=()=>nfcScan(cbSetStamp);
function saleOkHTML(sale){
 const L=salePays(sale);const f=saleFiadoAmt(sale);
 let h=`<div class="okbox"><b>Total ${money(sale.total)}</b> · ${esc(salePayLabel(sale))}${f>0?' · '+esc(PSTATE_TXT[salePayState(sale)]):''}</div>`;
 if(L.length>1||f>0)h+=`<div class="card sm" style="margin:.4rem 0">${L.map(p=>`<div class="row"><span class="sp">${esc(MET[p.m]||p.m)}${p.m==='fiado'?' <span class="tag warn">deuda, no entra a caja</span>':''}</span><b>${money(p.a)}</b></div>`).join('')}<hr><div class="row"><span class="sp">Cobrado ahora (dinero real)</span><b>${money(sale.total-f)}</b></div>${f>0?`<div class="row"><span class="sp">Saldo a cuenta corriente</span><b class="neg">${money(f)}</b></div>`:''}</div>`;
 if(sale.vuelto>0)h+=`<div class="vuelto" role="alert"><span>VUELTO A ENTREGAR</span><b>${money(sale.vuelto)}</b><small>Recibido ${money(sale.recv)}</small></div>`;
 else if(!sale.pays&&sale.recv&&sale.method==='efectivo'&&sale.recv>=sale.total)h+=`<div class="vuelto" role="alert"><span>VUELTO A ENTREGAR</span><b>${money(sale.recv-sale.total)}</b></div>`;
 if(f>0&&sale.cust)h+=`<div class="warnbox sm">Cuenta corriente de <b>${esc(sale.custName)}</b>: débito de ${money(f)} generado. Saldo total adeudado: <b>${money(debtOf(sale.cust))}</b>.</div>`;
 return h;}
function receiptModal(sale,stamp){
 modal('Venta '+sale.n+' registrada',`${saleOkHTML(sale)}${stamp?`<div class="okbox">⭐ Sello sumado a ${esc(stamp.custName)}: ${stamp.stamps}/${S.loyalty.goal}${stamp.reward?' · ¡premio disponible!':''}</div>`:''}<p class="sm mut">¿Querés imprimir el ticket? Si hay impresora térmica conectada se imprime directo; si no, se abre la impresión del navegador.</p>`,
  {okText:'Imprimir ticket',cancelText:'Nueva venta',onOk:()=>{printSale(sale.id);}});}
function payModal(s){modal('Cobro '+MET[s.method]+' · '+s.n,`<div class="card" style="text-align:center"><div style="font:700 3rem Georgia">▦</div><p>QR <span class="tag sim">SIMULADO</span> por ${money(s.total)}</p><p class="sm mut">En producción: el servidor crea la orden y el proveedor confirma por webhook firmado. Volver del checkout o mostrar una captura <b>nunca</b> acredita el cobro.</p></div>`,
 {okText:'Simular pago aprobado',cancelText:'Dejar pendiente',onOk:()=>{const r=webhook(s.id,s.method+'_'+s.id+'_approved','approved');toast(r==='ok'?'Pago confirmado por webhook (simulado)':r==='offline'?'API caída (simulada): el cobro sigue pendiente':'Evento '+r,r==='ok'?0:1);rerender();}});}
A.paysale=el=>{const s=S.sales.find(x=>x.id===el.dataset.id);if(s)payModal(s);};

reg('vender','Vender','cart','sell',()=>`<div class="fbar" id="fbar" role="toolbar" aria-label="Teclas de función"></div><div class="pos"><section><div class="card"><div class="row" style="flex-wrap:wrap"><input id="psearch" class="sp" style="min-width:12rem;flex:1 1 12rem" placeholder="Buscar producto o código de barras (F11)" autocomplete="off" aria-label="Buscar producto"><span id="devchips" class="row"></span></div>
 <div class="row" style="margin-top:.6rem"><button class="btn sm on" data-act="prub" data-id="">Todos</button>${S.rubros.filter(r=>r.kind==='rubro').map(r=>`<button class="btn sm" data-act="prub" data-id="${r.id}"><i class="rdot" style="background:${safeColor(r.color)}"></i>${esc(r.name)}</button>`).join('')}</div><div id="pgrid" class="pgrid"></div></div></section>
 <section class="card" id="pcart" aria-label="Ticket"></section></div>`,()=>{pos.rub='';posGrid();posCart();const s=$('#psearch');s.value=pos.q;if(typeof devChips==='function')devChips();
 s.addEventListener('keydown',e=>{if(e.key==='Enter'){const q=s.value.trim();if(!q)return;if(addByCode(q)){s.value='';pos.q='';posGrid();return;}
  const L=S.products.filter(x=>x.active&&pfull(x).toLowerCase().includes(q.toLowerCase()));if(L.length===1){A.padd({dataset:{id:L[0].id}});s.value='';pos.q='';posGrid();}}});},'Operación');

/* ---- lector de código de barras (teclado) y etiqueta EAN-13 de balanza ---- */
function addByCode(code){code=String(code).trim();
 if(typeof wsAddByPack==='function'&&wsAddByPack(code))return true;
 let p=S.products.find(x=>x.active&&x.barcode&&x.barcode===code);if(p){A.padd({dataset:{id:p.id}});return true;}
 if(/^2\d{12}$/.test(code)){const plu=String(+code.slice(1,6));const val=+code.slice(6,11);p=S.products.find(x=>x.active&&x.plu&&String(+x.plu)===plu);
  if(p){if(p.unit==='u'){toast('Etiqueta de balanza para un producto por unidad: revisá el PLU.',1);return true;}
   const mode=(S.cfg.scaleMode||'peso');let qty,priceC;
   if(mode==='peso'){qty=val/1000;if(!(qty>0&&qty<=50)){toast('Peso fuera de rango en la etiqueta.',1);return true;}}
   else{priceC=val*100;qty=Math.round(priceC/p.price*1000)/1000;if(!(qty>0&&qty<=50)){toast('Importe fuera de rango en la etiqueta.',1);return true;}}
   if(!canOver(p)&&qty>p.stock){toast('Sin stock suficiente de '+p.name,1);return true;}
   pos.lines.push({pid:p.id,name:pfull(p),rubro:p.rubro,qty,price:p.price,cost:p.cost,unit:p.unit,list:p.price,man:mode==='peso'?undefined:1});pos.sel=pos.lines.length-1;posCart();return true;}}
 return false;}
let scanBuf='',scanLast=0,scanFast=0;
document.addEventListener('keydown',e=>{if(curScreen!=='vender'||$('#panel').hidden||$('#modal-root .ov'))return;
 const t=e.target;const inField=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT');
 const n=Date.now();
 if(e.key==='Enter'){if(scanBuf.length>=4&&scanFast>=scanBuf.length-2){const code=scanBuf;scanBuf='';scanFast=0;if(addByCode(code)){e.preventDefault();if(inField&&t.id==='psearch'){t.value='';pos.q='';posGrid();}toast('Lector: código '+code);}}scanBuf='';scanFast=0;return;}
 if(e.key.length===1&&/[0-9A-Za-z]/.test(e.key)){if(n-scanLast>80){scanBuf='';scanFast=0;}else scanFast++;scanBuf+=e.key;scanLast=n;}});

/* ---- teclas F (sólo dentro de Vender y del cobro; el navegador no las pisa) ---- */
document.addEventListener('keydown',e=>{if(curScreen!=='vender'||$('#panel').hidden)return;const ov=$('#modal-root .ov');const m=/^F(\d{1,2})$/.exec(e.key);if(!m)return;const n=+m[1];if(n<1||n>12)return;
 if(ov){if(!cobroW())return;e.preventDefault();
  if(n===12){ov.querySelector('[data-m=ok]').click();return;}
  const mm={1:'efectivo',2:'debito',3:'credito',4:'fiado'}[n];if(mm){pos.method=mm;pos.mix=false;pos.pays=[];cobroRender();posCart();}else if(n===8)A.parca();
  return;}
 e.preventDefault();
 const k=FKEYS[n-1];const el={dataset:{m:k.m||''}};
 if(A[k.act])A[k.act](el);});
