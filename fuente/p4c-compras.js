/* ===== Proveedores y Compras · motor (V26) =====
   Un solo contrato (el de la API REST: pesos, nombres en snake_case) con dos motores que cumplen las mismas reglas:
   · NUBE: funciones del servidor de 08-proveedores-compras.sql. Cada operación es una sola transacción en la base
     (si algo falla se revierte TODO: stock, costo, deuda y caja). Requiere internet; nunca finge haber guardado.
   · LOCAL (demo o equipo sin nube): mismas validaciones sobre el estado del equipo, con retroceso completo si algo falla.
   En el estado del equipo el dinero va en centavos enteros (como el resto del sistema); en el contrato, en pesos. */
const CMP_MEDIOS={efectivo:'Efectivo',transferencia:'Transferencia',cheque:'Cheque',tarjeta:'Tarjeta'};
const CMP_IVA=['Responsable Inscripto','Monotributista','Exento'];
const cmpCloud=()=>!!(CLOUD.on&&cl.ready&&cl.comercio);
const c2p=c=>Math.round(c)/100;
const p2c=p=>Math.round(Number(p)*100+(Number(p)<0?-1e-9:1e-9));
const cmpKey=()=>'k'+uid()+uid();
const cmpArr=k=>{if(!Array.isArray(S[k]))S[k]=[];return S[k];};
const cmpProv=id=>cmpArr('suppliers').find(x=>x.id===id);
class CmpErr extends Error{}
const cmpFail=m=>{throw new CmpErr(m);};
const cmpNum=x=>{if(typeof x==='number')return isFinite(x)?x:NaN;if(x===null||x===undefined||x==='')return NaN;const n=Number(x);return isFinite(n)?n:NaN;};
const cmpR3=n=>Math.round(n*1000)/1000;
const cmpTxt=v=>{const s=String(v??'').trim();return s?s:null;};

/* ---------- reglas compartidas ---------- */
function cmpItems(items){
 if(!Array.isArray(items)||items.length<1||items.length>200)cmpFail('la lista de productos debe tener entre 1 y 200 renglones');
 const seen=new Set(),out=[];let total=0;
 for(const it of items){
  const pid=String(it&&it.producto_id||'').trim();const q=cmpNum(it&&it.cantidad);
  const pre=cmpNum(it&&(it.precio_costo!==undefined&&it.precio_costo!==null?it.precio_costo:it.precio_costo_pactado));
  if(!pid)cmpFail('falta el producto de un renglón');
  if(seen.has(pid))cmpFail('producto repetido en la lista ('+pid+'): sumá las cantidades en un solo renglón');seen.add(pid);
  if(!(q>0)||q>1e6||Math.abs(q-cmpR3(q))>1e-9)cmpFail('cantidad inválida en '+pid+': mayor a cero, hasta 3 decimales');
  if(!(pre>=0)||pre>1e9||Math.abs(pre*100-Math.round(pre*100))>1e-6)cmpFail('costo inválido en '+pid+': cero o más, hasta 2 decimales');
  const p=S.products.find(x=>x.id===pid);if(!p)cmpFail('el producto '+pid+' no existe en este comercio');
  if(p.archived)cmpFail('el producto '+p.name+' está archivado');
  out.push({producto_id:pid,nombre:p.name,cantidad:q,precio:pre});total+=Math.round(q*p2c(pre)+1e-9);}
 return{items:out,total};}
function cmpKeyOk(k){if(!k||k.length<8||k.length>80)cmpFail('falta idempotency_key (8 a 80 caracteres) para no duplicar la carga');return k;}
function cmpRubroEgreso(id,estricto){
 if(!id){if(estricto)cmpFail('el rubro es obligatorio para todo movimiento de dinero');return;}
 const r=rub(id);if(!r)cmpFail('el rubro elegido no existe en este comercio'+(estricto?' o no admite egresos':''));
 if(r.kind==='cobr')cmpFail('ese rubro sólo admite ingresos');}
function cmpTurnoAbierto(id){
 if(!id)cmpFail('pago en efectivo: indicá la caja abierta de donde sale la plata');
 const t=S.sessions.find(s=>s.id===id);if(!t)cmpFail('la caja indicada no existe en este equipo');
 if(t.closedAt)cmpFail('la caja indicada ya está cerrada');return t;}
function cmpMovCaja(turno,rubro,concepto,centavos,ref){
 const m={id:uid(),ts:now(),sessId:turno,type:'egreso',rubro,rubroName:rubName(rubro),concept:String(concepto).slice(0,120),amount:centavos,user:user?user.name:'sistema',ref:String(ref||'').slice(0,80)};
 S.movs.push(m);return m.id;}
function cmpLedger(provId,tipo,montoC,saldoC,extra){
 const e=Object.assign({id:uid(),seq:(S.supLedger.reduce((a,x)=>Math.max(a,x.seq||0),0))+1,provId,tipo,monto:montoC,saldo:saldoC,ts:now()},extra||{});
 S.supLedger.push(e);return e;}

/* ---------- motor LOCAL ---------- */
function cmpSnap(){return JSON.stringify({su:S.suppliers,po:S.pOrders,re:S.receipts,le:S.supLedger,pr:S.products,mv:S.movs,sq:S.seq});}
function cmpRestore(j){const o=JSON.parse(j);S.suppliers=o.su;S.pOrders=o.po;S.receipts=o.re;S.supLedger=o.le;S.products=o.pr;S.movs=o.mv;S.seq=o.sq;}
function cmpAtomic(fn){const snap=cmpSnap();try{return fn();}catch(e){cmpRestore(snap);throw e;}}
function cmpAcceso(){if(!user||!can('purchases'))cmpFail('no tenés permiso para operar con proveedores y compras');}

const LOCAL={
 async load(){cmpArr('suppliers');cmpArr('pOrders');cmpArr('receipts');cmpArr('supLedger');},
 async supSave(p){cmpAcceso();return cmpAtomic(()=>{
  const rs=String(p.razon_social||'').trim(),cuit=String(p.cuit||'').replace(/\D/g,''),iva=String(p.condicion_iva||''),email=cmpTxt(p.email);
  if(rs.length<2||rs.length>120)cmpFail('la razón social es obligatoria (2 a 120 caracteres)');
  if(!arcaCuitOk(cuit))cmpFail('el CUIT no es válido (11 dígitos con dígito verificador correcto)');
  if(!CMP_IVA.includes(iva))cmpFail('condición de IVA inválida (Responsable Inscripto, Monotributista o Exento)');
  if(email&&(email.length>120||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)))cmpFail('el correo no es válido');
  const tel=cmpTxt(p.telefono),dir=cmpTxt(p.direccion);
  if(tel&&tel.length>40)cmpFail('el teléfono es demasiado largo');if(dir&&dir.length>200)cmpFail('la dirección es demasiado larga');
  const L=cmpArr('suppliers');let s=p.id?L.find(x=>x.id===p.id):null;
  if(p.id&&!s)cmpFail('el proveedor no existe en este comercio');
  if(L.some(x=>x.cuit===cuit&&(!s||x.id!==s.id)))cmpFail('ya existe un proveedor con ese CUIT en este comercio');
  const nuevo=!s;if(nuevo){s={id:uid(),saldo:0,ts:now()};L.push(s);}
  Object.assign(s,{razon:rs,cuit,iva,email:email||'',tel:tel||'',dir:dir||'',activo:p.activo===false?false:true});
  audit(nuevo?'PROVEEDOR_ALTA':'PROVEEDOR_EDITAR',rs+' · CUIT '+cuit);save();
  return{id:s.id,razon_social:rs,cuit,saldo_cuenta_corriente:c2p(s.saldo)};});},
 async ocSave(p){cmpAcceso();return cmpAtomic(()=>{
  const prov=cmpProv(p.proveedor_id);if(!prov)cmpFail('el proveedor no existe en este comercio');if(!prov.activo)cmpFail('el proveedor está archivado');
  const estado=p.estado||'Borrador';if(!['Borrador','Solicitada'].includes(estado))cmpFail('una orden nueva nace como Borrador o Solicitada');
  let oc=null;
  if(p.id){oc=S.pOrders.find(x=>x.id===p.id);if(!oc)cmpFail('la orden no existe en este comercio');
   if(oc.estado!=='Borrador')cmpFail('sólo se edita una orden en Borrador (esta está '+oc.estado+')');
   if(oc.provId!==prov.id)cmpFail('no se cambia el proveedor de una orden: creá una nueva');}
  else if(p.idempotency_key){const ex=S.pOrders.find(x=>x.key===p.idempotency_key);if(ex)return{id:ex.id,numero:ex.num,estado:ex.estado,total:c2p(ex.total),repetido:true};}
  const calc=cmpItems(p.items);
  if(calc.total<=0&&estado==='Solicitada')cmpFail('una orden solicitada necesita costos pactados (total mayor a cero)');
  const items=calc.items.map(i=>({pid:i.producto_id,name:i.nombre,qty:i.cantidad,cost:p2c(i.precio)}));
  const obs=(cmpTxt(p.observaciones)||'').slice(0,500);
  if(!oc){S.seq.oc_compra=(S.seq.oc_compra||0)+1;oc={id:uid(),num:S.seq.oc_compra,provId:prov.id,estado,total:calc.total,fecha:now(),obs,items,key:p.idempotency_key||null,ts:now()};S.pOrders.push(oc);}
  else{Object.assign(oc,{estado,total:calc.total,obs,items});}
  audit('OC_'+(oc.estado==='Solicitada'?'SOLICITADA':'GUARDADA'),'OC-'+oc.num+' · '+prov.razon+' · '+money(oc.total));save();
  return{id:oc.id,numero:oc.num,estado:oc.estado,total:c2p(oc.total),repetido:false};});},
 async ocEstado(id,estado){cmpAcceso();return cmpAtomic(()=>{
  if(!['Solicitada','Cancelada'].includes(estado))cmpFail('estado inválido: sólo se pasa a Solicitada o Cancelada (Recibida se logra recibiendo la mercadería)');
  const oc=S.pOrders.find(x=>x.id===id);if(!oc)cmpFail('la orden no existe en este comercio');
  if(oc.estado===estado)return{id:oc.id,estado};
  if(!((oc.estado==='Borrador'&&['Solicitada','Cancelada'].includes(estado))||(oc.estado==='Solicitada'&&estado==='Cancelada')))cmpFail('no se puede pasar una orden de '+oc.estado+' a '+estado);
  if(estado==='Solicitada'&&oc.total<=0)cmpFail('una orden solicitada necesita costos pactados (total mayor a cero)');
  oc.estado=estado;audit('OC_'+estado.toUpperCase(),'OC-'+oc.num);save();return{id:oc.id,estado};});},
 async recibir(p){cmpAcceso();return cmpAtomic(()=>{
  const key=cmpKeyOk(cmpTxt(p.idempotency_key));
  const prov=cmpProv(p.proveedor_id);if(!prov)cmpFail('el proveedor no existe en este comercio');
  const ya=S.receipts.find(r=>r.key===key);if(ya)return Object.assign({},ya.res,{repetido:true});
  if(!prov.activo)cmpFail('el proveedor está archivado');
  const tipo=cmpTxt(p.tipo_comprobante),nro=cmpTxt(p.nro_comprobante);
  if(!tipo||!['Factura','Remito'].includes(tipo))cmpFail('tipo de comprobante inválido (Factura o Remito)');
  if(!nro||nro.length>40||!/^[A-Za-z0-9./ -]+$/.test(nro))cmpFail('el número de comprobante es obligatorio (letras, números, guión, barra y punto)');
  if(S.receipts.some(r=>r.provId===prov.id&&r.tipo===tipo&&r.nro.toLowerCase()===nro.toLowerCase()))cmpFail('ese '+tipo.toLowerCase()+' ya fue cargado para este proveedor (duplicado)');
  const cond=cmpTxt(p.condicion_pago)||'credito';if(!['credito','contado'].includes(cond))cmpFail('condición de pago inválida (credito o contado)');
  let medio=cmpTxt(p.medio_pago),rubro=cmpTxt(p.rubro_id),turno=cmpTxt(p.turno_id);
  if(cond==='contado'){
   if(!medio||!CMP_MEDIOS[medio])cmpFail('al contado hay que indicar el medio de pago (efectivo, transferencia, cheque o tarjeta)');
   cmpRubroEgreso(rubro,true);
   if(medio==='efectivo')cmpTurnoAbierto(turno);
  }else{medio=null;turno=null;cmpRubroEgreso(rubro,false);}
  const hoy=dkey(now());let fecha=cmpTxt(p.fecha_recepcion);fecha=fecha&&/^\d{4}-\d{2}-\d{2}$/.test(fecha)?fecha:hoy;
  if(fecha>addDays(hoy,1)||fecha<addDays(hoy,-400))cmpFail('la fecha de recepción no es razonable');
  let oc=null;
  if(p.orden_compra_id){oc=S.pOrders.find(x=>x.id===p.orden_compra_id);if(!oc)cmpFail('la orden de compra no existe en este comercio');
   if(oc.provId!==prov.id)cmpFail('la orden pertenece a otro proveedor');
   if(oc.estado!=='Solicitada')cmpFail('la orden está '+oc.estado+': sólo se recibe una orden Solicitada');}
  const calc=cmpItems(p.items);
  if(oc)for(const it of calc.items)if(!oc.items.some(x=>x.pid===it.producto_id))cmpFail('el producto '+it.nombre+' no está en la orden de compra');
  if(calc.total<=0)cmpFail('el total del comprobante debe ser mayor a cero');
  const decl=cmpNum(p.total_declarado);
  if(!isNaN(decl)&&Math.abs(decl*100-calc.total)>0.9)cmpFail('el total declarado ('+decl+') no coincide con la suma de los renglones ('+c2p(calc.total)+')');
  /* ---- se aplica todo ---- */
  const ing={id:uid(),provId:prov.id,ocId:oc?oc.id:null,tipo,nro,fecha,cond,medio,rubro,turno,total:calc.total,obs:(cmpTxt(p.observaciones)||'').slice(0,500),ts:now(),key,items:[],movId:null};
  const sal=[];
  for(const it of calc.items.slice().sort((a,b)=>a.producto_id<b.producto_id?-1:1)){
   const pr=S.products.find(x=>x.id===it.producto_id);const stAnt=+pr.stock||0,stNew=cmpR3(stAnt+it.cantidad);const coAnt=+pr.cost||0;
   const coNew=it.precio>0?p2c(it.precio):coAnt;pr.stock=stNew;pr.cost=coNew;pr.costAt=now();
   const row={pid:it.producto_id,name:it.nombre,qty:it.cantidad,cost:p2c(it.precio),stockAnt:stAnt,stockNew:stNew,costAnt:coAnt,costNew:coNew};ing.items.push(row);
   sal.push({producto_id:it.producto_id,nombre:it.nombre,cantidad:it.cantidad,precio_costo:it.precio,stock_anterior:stAnt,stock_nuevo:stNew,costo_anterior:c2p(coAnt),costo_nuevo:c2p(coNew),
    margen_pct:pr.price>0&&coNew>0?Math.round((pr.price-coNew)/pr.price*1000)/10:null});}
  let saldo=prov.saldo+calc.total;
  cmpLedger(prov.id,tipo,calc.total,saldo,{ref:nro,rubro,ingresoId:ing.id});
  if(cond==='contado'){
   if(medio==='efectivo')ing.movId=cmpMovCaja(turno,rubro,'Pago contado a '+prov.razon+' · '+tipo+' '+nro,calc.total,'ingreso:'+ing.id);
   saldo-=calc.total;cmpLedger(prov.id,'Pago',calc.total,saldo,{ref:tipo+' '+nro,medio,rubro,ingresoId:ing.id,movId:ing.movId});}
  prov.saldo=saldo;
  const dif=[];
  if(oc){oc.estado='Recibida';oc.recibidaAt=now();
   for(const d of oc.items){const r=ing.items.find(x=>x.pid===d.pid);
    if(!r||r.qty!==d.qty||r.cost!==d.cost)dif.push({producto_id:d.pid,nombre:d.name,cantidad_pedida:d.qty,cantidad_recibida:r?r.qty:0,costo_pactado:c2p(d.cost),costo_facturado:r?c2p(r.cost):null});}}
  const res={ok:true,repetido:false,ingreso_id:ing.id,orden_compra_id:oc?oc.id:null,orden_estado:oc?'Recibida':null,proveedor_id:prov.id,tipo_comprobante:tipo,nro_comprobante:nro,
   total:c2p(calc.total),condicion_pago:cond,medio_pago:medio,saldo_proveedor:c2p(saldo),movimiento_caja_id:ing.movId,items:sal,diferencias:dif};
  ing.res=res;S.receipts.push(ing);
  audit('COMPRA_RECEPCION',prov.razon+' · '+tipo+' '+nro+' · total '+money(calc.total)+' · '+cond+(oc?' · OC-'+oc.num:''));
  if(ing.movId)emit('cash.movement',{type:'egreso',rubro,amount:calc.total});
  save();return res;});},
 async pagar(p){cmpAcceso();return cmpAtomic(()=>{
  const key=cmpKeyOk(cmpTxt(p.idempotency_key));
  const prov=cmpProv(p.proveedor_id);if(!prov)cmpFail('el proveedor no existe en este comercio');
  const ya=S.supLedger.find(x=>x.key===key);if(ya)return{ok:true,repetido:true,movimiento_id:ya.id,monto:c2p(ya.monto),saldo_proveedor:c2p(prov.saldo)};
  const monto=cmpNum(p.monto);const mc=p2c(monto);
  if(!(monto>0)||monto>1e11||Math.abs(monto*100-mc)>1e-6)cmpFail('el monto debe ser mayor a cero, con hasta 2 decimales');
  if(mc>prov.saldo)cmpFail('el pago ('+monto+') supera la deuda con el proveedor ('+c2p(prov.saldo)+')');
  const medio=cmpTxt(p.medio_pago),rubro=cmpTxt(p.rubro_id),turno=cmpTxt(p.turno_id),ref=(cmpTxt(p.referencia)||'').slice(0,80);
  if(!medio||!CMP_MEDIOS[medio])cmpFail('indicá el medio de pago (efectivo, transferencia, cheque o tarjeta)');
  cmpRubroEgreso(rubro,true);
  let mov=null;if(medio==='efectivo'){cmpTurnoAbierto(turno);mov=cmpMovCaja(turno,rubro,'Pago a proveedor '+prov.razon+(ref?' · '+ref:''),mc,'pago');}
  prov.saldo-=mc;const e=cmpLedger(prov.id,'Pago',mc,prov.saldo,{ref,medio,rubro,movId:mov,key});
  audit('PROVEEDOR_PAGO',prov.razon+' · '+money(mc)+' · '+medio);if(mov)emit('cash.movement',{type:'egreso',rubro,amount:mc});save();
  return{ok:true,repetido:false,movimiento_id:e.id,monto,saldo_proveedor:c2p(prov.saldo),movimiento_caja_id:mov};});},
 async nc(p){cmpAcceso();return cmpAtomic(()=>{
  const key=cmpKeyOk(cmpTxt(p.idempotency_key));
  const prov=cmpProv(p.proveedor_id);if(!prov)cmpFail('el proveedor no existe en este comercio');
  const ya=S.supLedger.find(x=>x.key===key);if(ya)return{ok:true,repetido:true,movimiento_id:ya.id,monto:c2p(ya.monto),saldo_proveedor:c2p(prov.saldo)};
  const monto=cmpNum(p.monto);const mc=p2c(monto);
  if(!(monto>0)||monto>1e11||Math.abs(monto*100-mc)>1e-6)cmpFail('el monto debe ser mayor a cero, con hasta 2 decimales');
  const ref=(cmpTxt(p.referencia)||'').slice(0,80),motivo=(cmpTxt(p.motivo)||'').slice(0,200);
  if(!ref)cmpFail('indicá el número de la nota de crédito');if(motivo.length<3)cmpFail('indicá el motivo de la nota de crédito');
  prov.saldo-=mc;const e=cmpLedger(prov.id,'Nota de Crédito',mc,prov.saldo,{ref,motivo,key});
  audit('PROVEEDOR_NC',prov.razon+' · '+money(mc)+' · '+ref);save();
  return{ok:true,repetido:false,movimiento_id:e.id,monto,saldo_proveedor:c2p(prov.saldo)};});}
};

/* ---------- motor NUBE (funciones del servidor) ---------- */
function cmpErrMsg(e){if(e&&e.net)return'Sin conexión: esta operación necesita internet para no duplicar ni perder datos. No se guardó nada.';
 if(e&&e.status===403&&/rol|permiso|acceso/i.test(String(e.message)))return'Tu rol no tiene acceso a Proveedores y Compras (sólo administrador y supervisor).';
 return String((e&&e.message)||'error').replace(/^.*?ERROR:\s*/,'');}
async function cmpSync(){for(let i=0;i<60&&cl.busy;i++)await new Promise(r=>setTimeout(r,200));await cloudSync(true);}
async function cmpCall(fn,args){try{return await rpc(fn,Object.assign({p_comercio:cl.comercio.id},args));}catch(e){throw new CmpErr(cmpErrMsg(e));}}
const cmpTs=v=>{const t=Date.parse(v);return isNaN(t)?0:t;};
const CLOUDM={
 async load(){const j=await cmpCall('compras_snapshot',{});
  S.suppliers=(j.proveedores||[]).map(x=>({id:x.id,razon:x.razon_social,cuit:x.cuit,iva:x.condicion_iva,email:x.email||'',tel:x.telefono||'',dir:x.direccion||'',saldo:p2c(x.saldo_cuenta_corriente),activo:x.activo!==false,ts:cmpTs(x.created_at)}));
  S.pOrders=(j.ordenes||[]).map(o=>({id:o.id,num:o.numero,provId:o.proveedor_id,estado:o.estado,total:p2c(o.total),fecha:cmpTs(o.fecha_emision),obs:o.observaciones||'',recibidaAt:cmpTs(o.recibida_at),
   items:(o.items||[]).map(d=>({pid:d.producto_id,name:d.producto_nombre||d.producto_id,qty:+d.cantidad,cost:p2c(d.precio_costo_pactado)}))}));
  S.receipts=(j.ingresos||[]).map(i=>({id:i.id,provId:i.proveedor_id,ocId:i.orden_compra_id||null,tipo:i.tipo_comprobante,nro:i.nro_comprobante_o_remito,fecha:i.fecha_recepcion,cond:i.condicion_pago,medio:i.medio_pago||null,rubro:i.rubro_id||null,turno:i.turno_id||null,
   total:p2c(i.total),obs:i.observaciones||'',ts:cmpTs(i.created_at),movId:i.movimiento_caja_id||null,
   items:(i.items||[]).map(d=>({pid:d.producto_id,name:d.producto_nombre||d.producto_id,qty:+d.cantidad,cost:p2c(d.precio_costo),stockAnt:d.stock_anterior,stockNew:d.stock_nuevo,costAnt:p2c(d.costo_anterior||0),costNew:p2c(d.costo_nuevo||0)}))}));
  S.supLedger=(j.cuenta||[]).map(c=>({id:c.id,seq:+c.seq,provId:c.proveedor_id,tipo:c.tipo_movimiento,monto:p2c(c.monto),saldo:p2c(c.saldo_acumulado),ts:cmpTs(c.fecha),ref:c.referencia||'',medio:c.medio_pago||null,rubro:c.rubro_id||null,motivo:c.motivo||'',ingresoId:c.ingreso_id||null,movId:c.movimiento_caja_id||null}));
  S.cmpAt=now();},
 async supSave(p){return cmpCall('proveedor_guardar',{p});},
 async ocSave(p){await cmpSync();return cmpCall('orden_compra_guardar',{p});},
 async ocEstado(id,estado){return cmpCall('orden_compra_estado',{p_orden:id,p_estado:estado});},
 async recibir(p){await cmpSync();const r=await cmpCall('procesar_recepcion',{p});try{await cloudSync(true);}catch(e){}return r;},
 async pagar(p){await cmpSync();const r=await cmpCall('proveedor_pago_registrar',{p});try{await cloudSync(true);}catch(e){}return r;},
 async nc(p){return cmpCall('proveedor_nota_credito',{p});}
};

/* ---------- API del módulo (la usa la pantalla) ---------- */
const CMP={
 mode:()=>cmpCloud()?'nube':'local',
 eng:()=>cmpCloud()?CLOUDM:LOCAL,
 async load(){return CMP.eng().load();},
 async supSave(p){const r=await CMP.eng().supSave(p);await CMP.load();return r;},
 async ocSave(p){const r=await CMP.eng().ocSave(p);await CMP.load();return r;},
 async ocEstado(id,e){const r=await CMP.eng().ocEstado(id,e);await CMP.load();return r;},
 async recibir(p){const r=await CMP.eng().recibir(p);await CMP.load();return r;},
 async pagar(p){const r=await CMP.eng().pagar(p);await CMP.load();return r;},
 async nc(p){const r=await CMP.eng().nc(p);await CMP.load();return r;}
};
/* totales para el tablero */
const cmpDeuda=()=>cmpArr('suppliers').filter(s=>s.activo!==false||s.saldo>0).reduce((a,s)=>a+Math.max(0,s.saldo),0);
const cmpAFavor=()=>cmpArr('suppliers').reduce((a,s)=>a+Math.max(0,-s.saldo),0);
const cmpPend=()=>cmpArr('pOrders').filter(o=>o.estado==='Solicitada');

/* ---------- exportaciones (CSV con fórmulas neutralizadas) ---------- */
EXPORTS.proveedores={t:'Proveedores y saldos',perm:'purchases',h:()=>['razon_social','cuit','condicion_iva','email','telefono','direccion','saldo_cuenta_corriente','estado'],
 rows:()=>cmpArr('suppliers').map(s=>[s.razon,s.cuit,s.iva,s.email,s.tel,s.dir,s.saldo/100,s.activo===false?'archivado':'activo'])};
EXPORTS.ordenes_compra={t:'Órdenes de compra',perm:'purchases',h:()=>['numero','proveedor','estado','fecha','total','renglones'],
 rows:()=>cmpArr('pOrders').map(o=>[o.num,(cmpProv(o.provId)||{}).razon||'',o.estado,fmtDT(o.fecha),o.total/100,o.items.length])};
EXPORTS.ingresos_mercaderia={t:'Ingresos de mercadería (una fila por producto)',perm:'purchases',h:()=>['fecha','proveedor','comprobante','numero','condicion','medio','producto','cantidad','costo_unitario','subtotal','costo_anterior'],
 rows:()=>cmpArr('receipts').flatMap(r=>r.items.map(i=>[r.fecha,(cmpProv(r.provId)||{}).razon||'',r.tipo,r.nro,r.cond,r.medio||'',i.name,i.qty,i.cost/100,Math.round(i.qty*i.cost)/100,can('view_cost')?i.costAnt/100:'']))};
EXPORTS.cuenta_proveedores={t:'Cuenta corriente de proveedores',perm:'purchases',h:()=>['fecha','proveedor','movimiento','referencia','monto','saldo','medio','motivo'],
 rows:()=>cmpArr('supLedger').slice().sort((a,b)=>(a.seq||0)-(b.seq||0)).map(c=>[fmtDT(c.ts),(cmpProv(c.provId)||{}).razon||'',c.tipo,c.ref||'',c.monto/100,c.saldo/100,c.medio||'',c.motivo||''])};
