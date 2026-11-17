/* ===== V26.78 · Gestión integral — circuito mayorista, perfiles de comercio y nube (SQL 30) =====
   Pedidos de venta → armado (picking) → remito (parcial o total) → factura (venta del sistema) → cobro (cuenta corriente de siempre).
   Acopio = venta con entrega diferida a precio congelado: se cobra (o queda en cuenta corriente) y se retira en partes con remito.
   Perfiles de comercio: activan de una vez los módulos recomendados (nunca apagan nada).
   Todo apagado en Almacén RAVE hasta que el administrador lo activa en Sistema → Módulos.
   Nube: las colecciones nuevas suben recién cuando el servidor confirma el SQL 30 (vb_version() ≥ 30). */

GI_MODS.push(
 {k:'orders',t:'Pedidos de venta, armado y remitos',d:'Pedido → armado con lista de picking → remito parcial o total → factura → cobro. Reserva el stock de lo pedido y deja todo trazado.',plan:'mayorista',scr:'pedidosv'},
 {k:'stockpile',t:'Acopio',d:'El cliente compra a precio congelado y retira en partes con remito. Saldo de acopio por artículo, vencimiento y aviso.',plan:'mayorista',dep:['orders'],scr:'acopios'});
GI_NEXT.length=0; /* V26.78: todo lo de la hoja de ruta está construido */
GI_EXIST.push({t:'Precios por cantidad (tramos por presentación) y acuerdos por cliente',plan:'mayorista',on:()=>typeof wsOn==='function'&&wsOn(),scr:'config'});
Object.assign(PERMS,{orders:'Pedidos de venta: crear, armar, remitir y facturar',stockpile:'Acopios: vender con entrega diferida y registrar retiros'});

/* ---------- Paquetes por tipo de comercio (p17 · V26.78): se suman los módulos de esta versión ----------
   Al elegir el canal de venta en Configuración → Modelo de negocio, o desde «Módulos», se encienden solos (nunca se apaga nada). */
if(typeof GI_PACKS!=='undefined'){const add=(ch,L)=>{if(GI_PACKS[ch])L.forEach(k=>{if(!GI_PACKS[ch].k.includes(k))GI_PACKS[ch].k.push(k);});};
 add('min',['count']);add('both',['orders','stockpile','depots','count','b2b']);add('may',['orders','stockpile','depots','count','presale','gps','wa_orders','b2b']);}
/* con todo construido, «En desarrollo» desaparece del panel */
{const s=SCREENS.modulos;const _r=s.render;s.render=function(){const h=_r.apply(this,arguments);return GI_NEXT.length?h:h.replace(/<h2>En desarrollo<\/h2>[\s\S]*$/,'');};}

/* ---------- roles nuevos (se crean al activar los módulos que los usan) ---------- */
function vbRolesEnsure(){if(!S.roles)return;let ch=0;
 if((giOn('presale')||giOn('gps'))&&!S.roles.preventista){S.roles.preventista=['presale'];ch=1;}
 if((giOn('orders')||giOn('depots')||giOn('count'))&&!S.roles.deposito){S.roles.deposito=['orders','depots','count'];ch=1;}
 const add=(r,p)=>{if(Array.isArray(S.roles[r])&&!S.roles[r].includes(p)){S.roles[r].push(p);ch=1;}};
 if(giOn('orders')){add('supervisor','orders');add('mostrador','orders');}if(giOn('stockpile')){add('supervisor','stockpile');add('mostrador','stockpile');}
 if(giOn('depots'))add('supervisor','depots');if(giOn('count')){add('supervisor','count');}if(giOn('presale'))add('supervisor','presale');if(giOn('gps'))add('supervisor','gps_view');
 if(ch)audit('ROLES_GESTION','Permisos de los módulos activados agregados a sus roles');return ch;}
{const _sm=giSetMod;giSetMod=function(k,on){const e=_sm.apply(this,arguments);if(!e&&on){try{if(vbRolesEnsure())save();}catch(x){}}return e;};}
if(typeof ROLES_LBL!=='undefined')Object.assign(ROLES_LBL,{preventista:'Preventista',deposito:'Depósito'});

/* ---------- Nube: colecciones del SQL 30 ---------- */
const VB30_COLS=[{c:'pedv',key:'sordr',pii:['custName','note','addr']},{c:'remv',key:'remitos',pii:['custName']},{c:'visit',key:'visits',once:1,pii:['lat','lng','note']},{c:'cobrr',key:'cobrRuta',pii:['ref','custName']},
 {c:'gps',key:'gpsPts',once:1,pii:['lat','lng','acc']},{c:'tdep',key:'tdep'},{c:'dstk',key:'dstk'},{c:'tinv',key:'counts'},{c:'acop',key:'acopios',pii:['custName']},{c:'plog',key:'priceLog',once:1},
 {c:'lblq',key:'lblQ',del:1},{c:'hold',key:'holds',del:1,pii:['custName','note']},{c:'vale',key:'vales',pii:['empName','note']}];
let vb30=false,vb30At=0;
function vb30Enable(){if(vb30||typeof COLS==='undefined')return;VB30_COLS.forEach(x=>{if(!COLS.some(y=>y.c===x.c)){COLS.push(x);BYC[x.c]=x;if(x.del)DELC.add(x.c);}});vb30=true;}
if(typeof pushAll==='function'){const _pa=pushAll;pushAll=async function(){if(!vb30&&typeof cl!=='undefined'&&cl.comercio&&Date.now()-vb30At>600000){vb30At=Date.now();
  try{const v=await rpc('vb_version',{});if(+v>=30)vb30Enable();}catch(e){}}return _pa.apply(this,arguments);};}

/* ---------- utilidades ---------- */
const vbArr=k=>S[k]||(S[k]=[]);
const vbSeq=(k,pre,w)=>{S[k]=(S[k]||0)+1;return pre+String(S[k]).padStart(w||5,'0');};
const VB_OPEN=['pendiente','armado','parcial'];
function vbLinePrice(p,qty,cust){if(typeof priceResolve==='function'&&typeof wsOn==='function'&&wsOn()){const r=priceResolve(p,qty,{cust,chan:'mayorista'});return{amt:r.amt!==undefined?r.amt:Math.round(r.price*qty),price:r.price,why:r.why,tr:r.tr,rule:r.rule,lst:r.list};}
 return{amt:Math.round(p.price*qty),price:p.price,why:'precio de venta'};}
/* reservado = lo pedido y no remitido en pedidos abiertos + lo remitido y no facturado */
function vbReserved(pid,exceptOrd){let r=0;for(const o of vbArr('sordr')){if(o.id===exceptOrd)continue;if(VB_OPEN.includes(o.state)||o.state==='entregado')for(const it of o.items){if(it.pid!==pid)continue;r+=(it.qty-(it.del||0))+((it.del||0)-(it.inv||0));}}return Math.max(0,Math.round(r*1000)/1000);}
const vbAvail=(p,ex)=>Math.round(((+p.stock||0)-vbReserved(p.id,ex))*1000)/1000;
function vbCustFind(q){q=String(q||'').trim();if(!q)return[];if(typeof wsCustFind==='function'){const r=wsCustFind(q);if(r.length)return r.slice(0,8);}
 const n=giNorm(q);return S.customers.filter(c=>!c.deleted&&giNorm(custFull(c)+' '+(c.taxid||'')+' '+(c.wa||'')).includes(n)).slice(0,8);}
function vbDoc(title,body){return`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:14mm}body{font:11pt Arial,Helvetica,sans-serif;color:#000}h1{font-size:16pt;margin:0 0 2mm}table{width:100%;border-collapse:collapse;margin-top:4mm}th,td{border-bottom:1px solid #999;padding:1.5mm;text-align:left}td.r,th.r{text-align:right}.mut{color:#444;font-size:9pt}.box{border:1px solid #000;padding:3mm;margin-top:3mm}.sig{margin-top:18mm;display:flex;gap:20mm}.sig div{flex:1;border-top:1px solid #000;padding-top:1mm;font-size:9pt}</style></head><body>${body}</body></html>`;}
function vbPrint(html){if(typeof lbPrintDoc==='function')return lbPrintDoc(html);const w=window.open('','_blank');if(!w)return toast('El navegador bloqueó la ventana de impresión.',1);w.document.write(html);w.document.close();setTimeout(()=>w.print(),200);}
const vbShop=()=>{const b=(S.cfg.lbl&&S.cfg.lbl.brand)||{};return{name:b.name||S.tenant.name,addr:b.addr||S.tenant.address||'',phone:b.phone||S.tenant.phone||'',cuit:S.tenant.cuit||''};};

/* ---------- Pedidos de venta: lógica ---------- */
/* o: {cust, items:[{pid,qty}], cond:'contado'|'cc', note, src, deliv (fecha AAAA-MM-DD), seller, addr} */
function vbOrderCreate(o){if(!giOn('orders'))return{err:'El módulo «Pedidos de venta» está apagado.'};if(!(can('orders')||can('presale')))return{err:'Sin permiso para cargar pedidos.'};
 const c=custById(o.cust);if(!c)return{err:'Elegí el cliente del pedido.'};const agg={};
 for(const it of (o.items||[])){const p=prod(it.pid);const q=Math.round((+it.qty||0)*1000)/1000;if(!p||p.archived||p.active===false)return{err:'Hay un artículo que ya no está disponible.'};if(!(q>0))return{err:'Cada artículo necesita una cantidad mayor a cero.'};agg[p.id]=(agg[p.id]||0)+q;}
 const ids=Object.keys(agg);if(!ids.length)return{err:'El pedido no tiene artículos.'};if(ids.length>300)return{err:'Máximo 300 artículos por pedido.'};
 const cond=o.cond==='cc'?'cc':'contado';const items=ids.map(pid=>{const p=prod(pid);const pr=vbLinePrice(p,agg[pid],c);return{pid,name:pfull(p),qty:agg[pid],price:pr.price,amt:pr.amt,del:0,inv:0,pick:null};});
 const warn=items.filter(it=>vbAvail(prod(it.pid))<it.qty).map(it=>it.name+' (disp. '+vbAvail(prod(it.pid))+')');
 const ord={id:uid(),n:vbSeq('seqPV','PV-'),ts:now(),user:user.name,cust:c.id,custName:custFull(c),items,cond,note:String(o.note||'').replace(/[<>]/g,'').slice(0,240),src:o.src||'mostrador',seller:o.seller||(user&&user.role==='preventista'?user.id:''),
  deliv:/^\d{4}-\d{2}-\d{2}$/.test(o.deliv||'')?o.deliv:'',addr:String(o.addr||c.addr||'').slice(0,160),state:'pendiente',hist:[{ts:now(),u:user.name,s:'pendiente'}],remitos:[],sales:[],total:items.reduce((a,i)=>a+i.amt,0)};
 vbArr('sordr').push(ord);audit('PEDIDO_VENTA',ord.n+' · '+ord.custName+' · '+items.length+' art. · '+money(ord.total)+' · '+ord.src+(warn.length?' · sin stock suficiente: '+warn.join(', '):''));save();return{o:ord,warn};}
const vbOrd=id=>vbArr('sordr').find(x=>x.id===id);
function vbSetState(o,s){o.state=s;o.hist.push({ts:now(),u:user?user.name:'sistema',s});}
/* armado: picked {pid:q}; lo que falta queda marcado (el remito no puede superar lo armado si se armó) */
function vbPick(id,picked){const o=vbOrd(id);if(!o)return{err:'Pedido inexistente.'};if(!can('orders'))return{err:'Sin permiso.'};if(!['pendiente','armado'].includes(o.state))return{err:'Sólo se arma un pedido pendiente.'};
 const falt=[];for(const it of o.items){const q=Math.max(0,Math.min(it.qty,Math.round((+(picked||{})[it.pid]||0)*1000)/1000));it.pick=q;if(q<it.qty)falt.push(it.name+' ('+q+' de '+it.qty+')');}
 vbSetState(o,'armado');o.pickBy=user.name;o.pickAt=now();audit('PEDIDO_ARMADO',o.n+(falt.length?' · faltantes: '+falt.join(', '):' · completo'));save();return{o,falt};}
/* remito: qtys {pid:q} ≤ pendiente (y ≤ lo armado si se armó) */
function vbRemito(id,qtys){const o=vbOrd(id);if(!o)return{err:'Pedido inexistente.'};if(!can('orders'))return{err:'Sin permiso.'};if(!VB_OPEN.includes(o.state))return{err:'El pedido no tiene nada para remitir.'};
 const items=[];for(const it of o.items){const pend=Math.round((it.qty-(it.del||0))*1000)/1000;const lim=it.pick===null||it.pick===undefined?pend:Math.max(0,Math.min(pend,it.pick-(it.del||0)));
  const q=Math.round((+(qtys||{})[it.pid]||0)*1000)/1000;if(q<0||q>lim+1e-9)return{err:'«'+it.name+'»: se pueden remitir hasta '+lim+'.'};if(q>0)items.push({pid:it.pid,name:it.name,qty:q,price:it.price});}
 if(!items.length)return{err:'Indicá qué se entrega.'};
 const r={id:uid(),n:vbSeq('seqRM','R-0001-',8),ts:now(),user:user.name,ord:o.id,ordN:o.n,cust:o.cust,custName:o.custName,items,inv:'',state:'emitido'};
 for(const x of items){const it=o.items.find(i=>i.pid===x.pid);it.del=Math.round(((it.del||0)+x.qty)*1000)/1000;}
 o.remitos.push(r.id);vbSetState(o,o.items.every(i=>i.del>=i.qty-1e-9)?'entregado':'parcial');vbArr('remitos').push(r);
 audit('REMITO',r.n+' · '+o.n+' · '+o.custName+' · '+items.map(i=>i.qty+' '+i.name).join(', '));save();return{r,o};}
function vbRemitoVoid(rid,why){const r=vbArr('remitos').find(x=>x.id===rid);if(!r)return{err:'Remito inexistente.'};if(!can('orders'))return{err:'Sin permiso.'};if(r.state==='anulado')return{err:'Ya está anulado.'};if(r.inv)return{err:'Ya está facturado: se corrige con nota de crédito o devolución.'};
 if(!why||String(why).trim().length<3)return{err:'Escribí el motivo.'};const o=vbOrd(r.ord);r.state='anulado';r.voidWhy=String(why).trim().slice(0,120);r.voidAt=now();
 if(o){for(const x of r.items){const it=o.items.find(i=>i.pid===x.pid);if(it)it.del=Math.max(0,Math.round(((it.del||0)-x.qty)*1000)/1000);}vbSetState(o,o.items.some(i=>(i.del||0)>0)?'parcial':(o.pickAt?'armado':'pendiente'));}
 audit('REMITO_ANULADO',r.n+' · '+r.voidWhy);save();return{r};}
/* factura: une remitos sin facturar del mismo cliente y registra la venta con el motor de siempre (stock, caja, cuenta corriente, ARCA) */
function vbInvoice(rids,o){o=o||{};if(!can('orders')||!can('sell'))return{err:'Sin permiso para facturar.'};const R=rids.map(id=>vbArr('remitos').find(x=>x.id===id)).filter(Boolean);
 if(!R.length)return{err:'Elegí los remitos a facturar.'};if(R.some(r=>r.inv||r.state==='anulado'))return{err:'Hay remitos ya facturados o anulados.'};if(new Set(R.map(r=>r.cust)).size>1)return{err:'Los remitos tienen que ser del mismo cliente.'};
 const c=custById(R[0].cust);if(!c)return{err:'El cliente ya no existe.'};const agg={};R.forEach(r=>r.items.forEach(x=>{agg[x.pid]=(agg[x.pid]||0)+x.qty;}));
 const lines=Object.keys(agg).map(pid=>{const p=prod(pid);if(!p)return null;const q=Math.round(agg[pid]*1000)/1000;const pr=vbLinePrice(p,q,c);
  const fx=o.fixed&&o.fixed[pid]!=null?Math.round(+o.fixed[pid]):null; /* V27.15: precio ya cobrado en la puerta (entrega con rechazo parcial) */
  if(fx!=null)return{pid,name:pfull(p),rubro:p.rubro,qty:q,price:fx,cost:p.cost,unit:p.unit,list:fx,man:true,flrOk:true,why:'Precio del pedido entregado (rechazo parcial en puerta)'};
  const l={pid,name:pfull(p),rubro:p.rubro,qty:q,price:pr.price,cost:p.cost,unit:p.unit,list:pr.price};if(pr.tr){l.tr=pr.tr;l.amt=pr.amt;l.rule=pr.rule;l.lst=pr.lst;}return l;});
 if(lines.some(l=>!l))return{err:'Un artículo del remito ya no existe.'};
 const method=o.method||'fiado';const opts={custId:c.id,ws:typeof wsOn==='function'&&wsOn()?{chan:'mayorista'}:undefined};if(o.pays)opts.pays=o.pays;
 const r=commitSale(method,!!o.arca,'local',lines,opts);if(r.err)return{err:r.err};
 const sale=r.sale;sale.rems=R.map(x=>x.n);const ords=new Set();
 R.forEach(rm=>{rm.inv=sale.id;rm.invN=sale.n;const od=vbOrd(rm.ord);if(od){ords.add(od);rm.items.forEach(x=>{const it=od.items.find(i=>i.pid===x.pid);if(it)it.inv=Math.round(((it.inv||0)+x.qty)*1000)/1000;});}});
 ords.forEach(od=>{od.sales.push(sale.id);sale.ord=od.n;if(od.items.every(i=>(i.inv||0)>=i.qty-1e-9))vbSetState(od,'facturado');});
 audit('FACTURA_REMITOS',sale.n+' · '+R.map(x=>x.n).join(', ')+' · '+custFull(c)+' · '+money(sale.total)+' · '+(MET[sale.method]||sale.method));save();return{sale};}
/* ---------- V27.14 · del pedido al camión: remito + envío en la bandeja de Reparto («Listo para salir») ----------
   Contado → el repartidor cobra en la puerta · Cuenta corriente → no cobra · al rendir se factura el remito con el medio real. */
const vbRepOk=()=>typeof repNuevo==='function'&&typeof repOn==='function'&&repOn();
const vbEnvOf=o=>o&&o.envio&&typeof repEnv==='function'?repEnv(o.envio):null;
function vbEnvVivo(o){const e=vbEnvOf(o);return e&&!['entregado','cancelado'].includes(e.estado)?e:null;}
function vbToReparto(id){const o=vbOrd(id);if(!o)return{err:'Pedido inexistente.'};if(!vbRepOk())return{err:'Activá Reparto y despacho para mandar pedidos al camión.'};if(!can('orders'))return{err:'Sin permiso.'};
 if(vbEnvVivo(o))return{err:o.n+' ya está en reparto (envío #'+vbEnvOf(o).n+').'};if(!VB_OPEN.includes(o.state))return{err:'El pedido no tiene nada pendiente de entregar.'};
 const q={};o.items.forEach(it=>{const pend=Math.round((it.qty-(it.del||0))*1000)/1000;const lim=it.pick===null||it.pick===undefined?pend:Math.max(0,Math.min(pend,it.pick-(it.del||0)));if(lim>0)q[it.pid]=lim;});
 if(!Object.keys(q).length)return{err:'Lo armado ya se entregó: registrá el armado de lo que falta.'};
 const rr=vbRemito(o.id,q);if(rr.err)return rr;const rm=rr.r,c=custById(o.cust)||{};
 const items=rm.items.map(x=>{const it=o.items.find(i=>i.pid===x.pid)||{};const p=prod(x.pid)||{};const amt=it.qty?Math.round((it.amt||it.price*it.qty)*x.qty/it.qty):Math.round(x.price*x.qty);
  return{pid:x.pid,name:x.name,rubro:p.rubro,qty:x.qty,price:x.qty?Math.round(amt/x.qty):x.price,amt,cost:p.cost||0,unit:p.unit||'u'};});
 const total=items.reduce((a,i)=>a+i.amt,0);const pv=c.pv||{};const zs=repCfg().zonas||[];const z=zs.find(x=>x.activo!==false&&pv.zona&&String(x.nombre).toLowerCase()===String(pv.zona).toLowerCase())||zs.find(x=>x.activo!==false);
 const e=repNuevo({orig:'ped',cli:{nombre:o.custName,tel:c.wa||'',dir:o.addr||c.addr||'',loc:'',ref:'',lat:pv.lat!=null?pv.lat:null,lng:pv.lng!=null?pv.lng:null,custId:c.id||''},custId:c.id||'',zona:z?z.id:'',tarifa:0,items,total,
  cobro:o.cond==='cc'?{modo:'cc'}:{modo:'efectivo',abona:0},tok:o.tok||undefined,nota:o.n+' · remito '+rm.n+(o.note?' · '+o.note:'')});if(!o.tok)o.tok=e.tok;
 e.ord=o.id;e.rem=rm.id;e.ordN=o.n;repSetEst(e,'listo',{nota:'pedido '+o.n+' armado'});o.envio=e.id;o.hist.push({ts:now(),u:user?user.name:'sistema',s:'en reparto'});
 audit('PEDIDO_A_REPARTO',o.n+' · remito '+rm.n+' · envío #'+e.n+' · '+(o.cond==='cc'?'cuenta corriente':'cobrar '+money(total)));save();return{o,e,rm};}
A.vbORep=el=>{const r=vbToReparto(el.dataset.id);if(r.err)return toast(r.err,1);toast(r.o.n+' → Reparto: envío #'+r.e.n+' listo para salir');rerender();};
A.vbORepAll=()=>{const L=vbArr('sordr').filter(o=>VB_OPEN.includes(o.state)&&!vbEnvVivo(o));if(!L.length)return toast('No hay pedidos abiertos para mandar.',1);
 confirmBox('Mandar '+L.length+' pedido(s) a Reparto',`Se emite el remito de lo pendiente (o de lo armado) y cada pedido queda «Listo para salir» en la bandeja de Reparto, con su cobro: contado se cobra en la puerta, cuenta corriente no.`,()=>{let ok=0;const bad=[];L.forEach(o=>{const r=vbToReparto(o.id);if(r.err)bad.push(o.n+': '+r.err);else ok++;});
  toast(ok+' pedido(s) en Reparto'+(bad.length?' · '+bad.length+' con problema':''),!!bad.length);if(bad.length)modal('No se pudieron mandar',`<ul class="sm">${bad.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`,{okText:'Entendido',noCancel:true});rerender();},'Mandar');};
function vbOrderCancel(id,why){const o=vbOrd(id);if(!o)return{err:'Pedido inexistente.'};if(!can('orders'))return{err:'Sin permiso.'};if(['facturado','anulado'].includes(o.state))return{err:'Ese pedido ya está cerrado.'};
 if(vbArr('remitos').some(r=>r.ord===o.id&&r.state!=='anulado'&&!r.inv))return{err:'Tiene remitos sin facturar: facturalos o anulalos primero.'};if(!why||String(why).trim().length<3)return{err:'Escribí el motivo.'};
 const closed=o.items.some(i=>(i.inv||0)>0);vbSetState(o,closed?'facturado':'anulado');o.cancelWhy=String(why).trim().slice(0,120);
 audit(closed?'PEDIDO_CERRADO':'PEDIDO_ANULADO',o.n+' · '+o.cancelWhy+(closed?' · se cierra con lo ya facturado':''));save();return{o};}
function vbOrderDoc(o){const s=vbShop();return vbDoc('Pedido '+o.n,`<h1>Pedido ${esc(o.n)}</h1><div class="mut">${esc(s.name)} · ${esc(s.addr)} · ${esc(s.phone)}</div>
 <div class="box"><b>Cliente:</b> ${esc(o.custName)}<br><b>Fecha:</b> ${fmtDT(o.ts)}${o.deliv?' · <b>Entrega:</b> '+dmy(o.deliv):''} · <b>Condición:</b> ${o.cond==='cc'?'Cuenta corriente':'Contado'}${o.addr?'<br><b>Entregar en:</b> '+esc(o.addr):''}${o.note?'<br><b>Nota:</b> '+esc(o.note):''}</div>
 <table><thead><tr><th>Artículo</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead><tbody>${o.items.map(i=>`<tr><td>${esc(i.name)}</td><td class="r">${i.qty}</td><td class="r">${money(i.price)}</td><td class="r">${money(i.amt)}</td></tr>`).join('')}</tbody>
 <tfoot><tr><th colspan="3" class="r">Total estimado</th><th class="r">${money(o.total)}</th></tr></tfoot></table><p class="mut">Los precios se confirman al facturar. Documento interno, no válido como factura.</p>`);}
function vbPickDoc(o){const P=o.items.map(i=>({i,p:prod(i.pid)})).sort((a,b)=>String((a.p&&(a.p.loc||rubName(a.p.rubro)))||'').localeCompare(String((b.p&&(b.p.loc||rubName(b.p.rubro)))||''))||a.i.name.localeCompare(b.i.name));
 return vbDoc('Armado '+o.n,`<h1>Lista de armado · ${esc(o.n)}</h1><div class="mut">${esc(o.custName)} · ${fmtDT(o.ts)}</div><table><thead><tr><th>✓</th><th>Ubicación / rubro</th><th>Artículo</th><th>Código</th><th class="r">Pedido</th><th class="r">Armado</th></tr></thead><tbody>
 ${P.map(({i,p})=>`<tr><td>☐</td><td>${esc((p&&(p.loc||rubName(p.rubro)))||'')}</td><td>${esc(i.name)}</td><td>${esc((p&&p.barcode)||'')}</td><td class="r">${i.qty-(i.del||0)}</td><td class="r">______</td></tr>`).join('')}</tbody></table><div class="sig"><div>Armó</div><div>Controló</div></div>`);}
function vbRemitoDoc(r){const s=vbShop();const c=custById(r.cust)||{};return vbDoc('Remito '+r.n,`<h1>Remito ${esc(r.n)}</h1><div class="mut">${esc(s.name)}${s.cuit?' · CUIT '+esc(s.cuit):''} · ${esc(s.addr)} · ${esc(s.phone)}</div>
 <div class="box"><b>Cliente:</b> ${esc(r.custName)}${c.taxid?' · CUIT '+esc(c.taxid):''}<br><b>Fecha:</b> ${fmtDT(r.ts)} · <b>Pedido:</b> ${esc(r.ordN||'')}</div>
 <table><thead><tr><th>Artículo</th><th class="r">Cantidad</th></tr></thead><tbody>${r.items.map(i=>`<tr><td>${esc(i.name)}</td><td class="r">${i.qty}</td></tr>`).join('')}</tbody></table>
 <div class="sig"><div>Entregó</div><div>Recibí conforme (firma, aclaración y DNI)</div></div><p class="mut">Remito interno de entrega. No reemplaza el remito electrónico ni el COT cuando la mercadería viaja y la normativa lo exige [VERIFICAR con el contador].</p>`);}

/* ---------- Acopio (venta con entrega diferida a precio congelado) ---------- */
/* o: {cust, items:[{pid,qty}], method, pays, venc (AAAA-MM-DD)} → crea la venta (stock, caja y cuenta corriente de siempre) y el acopio a retirar */
function vbAcopioCreate(o){if(!giOn('stockpile'))return{err:'El módulo «Acopio» está apagado.'};if(!can('stockpile')||!can('sell'))return{err:'Sin permiso.'};const c=custById(o.cust);if(!c)return{err:'Elegí el cliente.'};
 const agg={};for(const it of (o.items||[])){const p=prod(it.pid);const q=Math.round((+it.qty||0)*1000)/1000;if(!p)return{err:'Artículo inexistente.'};if(!(q>0))return{err:'Cantidades mayores a cero.'};agg[p.id]=(agg[p.id]||0)+q;}
 const ids=Object.keys(agg);if(!ids.length)return{err:'El acopio no tiene artículos.'};
 const lines=ids.map(pid=>{const p=prod(pid);const pr=vbLinePrice(p,agg[pid],c);const l={pid,name:pfull(p),rubro:p.rubro,qty:agg[pid],price:pr.price,cost:p.cost,unit:p.unit,list:pr.price};if(pr.tr){l.tr=pr.tr;l.amt=pr.amt;l.rule=pr.rule;l.lst=pr.lst;}return l;});
 const opts={custId:c.id,ws:typeof wsOn==='function'&&wsOn()?{chan:'mayorista'}:undefined};if(o.pays)opts.pays=o.pays;
 const r=commitSale(o.method||'fiado',!!o.arca,'local',lines,opts);if(r.err)return{err:r.err};const sale=r.sale;
 const ac={id:uid(),n:vbSeq('seqAC','AC-'),ts:now(),user:user.name,cust:c.id,custName:custFull(c),sale:sale.id,saleN:sale.n,items:lines.map(l=>({pid:l.pid,name:l.name,qty:l.qty,price:l.amt!==undefined?Math.round(l.amt/l.qty):l.price,ret:0})),total:sale.total,
  venc:/^\d{4}-\d{2}-\d{2}$/.test(o.venc||'')?o.venc:'',state:'vigente',retiros:[]};
 sale.acopio=ac.n;vbArr('acopios').push(ac);audit('ACOPIO',ac.n+' · '+ac.custName+' · '+money(ac.total)+' · venta '+sale.n+' · precio congelado');save();return{ac,sale};}
function vbAcopioRetiro(id,qtys){const ac=vbArr('acopios').find(x=>x.id===id);if(!ac)return{err:'Acopio inexistente.'};if(!can('stockpile'))return{err:'Sin permiso.'};if(ac.state!=='vigente')return{err:'Ese acopio no está vigente.'};
 const items=[];for(const it of ac.items){const pend=Math.round((it.qty-it.ret)*1000)/1000;const q=Math.round((+(qtys||{})[it.pid]||0)*1000)/1000;if(q<0||q>pend+1e-9)return{err:'«'+it.name+'»: quedan '+pend+' para retirar.'};if(q>0)items.push({pid:it.pid,name:it.name,qty:q});}
 if(!items.length)return{err:'Indicá qué retira.'};const r={id:uid(),n:vbSeq('seqRM','R-0001-',8),ts:now(),user:user.name,ord:'',ordN:ac.n,acop:ac.id,cust:ac.cust,custName:ac.custName,items,inv:ac.sale,invN:ac.saleN,state:'emitido'};
 items.forEach(x=>{const it=ac.items.find(i=>i.pid===x.pid);it.ret=Math.round((it.ret+x.qty)*1000)/1000;});ac.retiros.push({id:r.id,n:r.n,ts:r.ts,items});if(ac.items.every(i=>i.ret>=i.qty-1e-9))ac.state='retirado';
 vbArr('remitos').push(r);audit('ACOPIO_RETIRO',ac.n+' · '+r.n+' · '+items.map(i=>i.qty+' '+i.name).join(', ')+(ac.state==='retirado'?' · completo':''));save();return{r,ac};}
const vbAcopioPend=ac=>ac.items.reduce((a,i)=>a+Math.round((i.qty-i.ret)*i.price),0);
/* pasivo: lo cobrado (o facturado) que todavía no se entregó */
const vbAcopioPasivo=()=>vbArr('acopios').filter(a=>a.state==='vigente').reduce((t,a)=>t+vbAcopioPend(a),0);

/* ---------- Pantallas: Pedidos de venta ---------- */
let vbOTab='lista',vbOF='abiertos',vbDraft=null,vbOSel='';
const VB_ST={pendiente:['Pendiente',''],armado:['Armado','ok'],parcial:['Entregado en parte','warn'],entregado:['Entregado, falta facturar','warn'],facturado:['Facturado','ok'],anulado:['Anulado','bad']};
const vbTag=s=>`<span class="tag ${VB_ST[s]?VB_ST[s][1]:''}">${esc(VB_ST[s]?VB_ST[s][0]:s)}</span>`;
A.vbOTab=el=>{vbOTab=el.dataset.t;rerender();};
function vbDraftNew(cust,src){vbDraft={cust:cust||'',items:[],cond:'cc',note:'',src:src||'mostrador',deliv:''};}
function vbDraftHTML(){const d=vbDraft;const c=custById(d.cust);const tot=d.items.reduce((a,x)=>{const p=prod(x.pid);return a+(p?vbLinePrice(p,x.qty,c).amt:0);},0);
 return`<div class="card"><h3 style="margin-top:0">Nuevo pedido</h3>
 ${c?`<div class="row"><b class="sp">${esc(custFull(c))}</b>${typeof debtOf==='function'&&debtOf(c.id)>0?`<span class="tag warn">Debe ${money(debtOf(c.id))}</span>`:''}<button class="btn sm" data-act="vbDCust" data-id="">Cambiar</button></div>`
  :`<label for="vb-dc">Cliente</label><input id="vb-dc" placeholder="Nombre, CUIT o teléfono" autocomplete="off"><div id="vb-dcr"></div>`}
 <label for="vb-dp">Agregar artículo</label><input id="vb-dp" placeholder="Código de barras o nombre (Enter)" autocomplete="off"><div id="vb-dpr"></div>
 ${d.items.length?`<div class="tw"><table data-nosort><thead><tr><th>Artículo</th><th class="r">Disponible</th><th class="r">Cantidad</th><th class="r">Importe</th><th></th></tr></thead><tbody>
 ${d.items.map((x,i)=>{const p=prod(x.pid);if(!p)return'';const pr=vbLinePrice(p,x.qty,c);const av=vbAvail(p);return`<tr><td>${esc(pfull(p))}<div class="sm mut">${esc(pr.why||'')}</div></td><td class="r ${av<x.qty?'bad':''}">${av}</td>
  <td class="r"><input class="vb-dq" data-i="${i}" type="number" min="0" step="any" value="${x.qty}" style="width:5.5rem" aria-label="Cantidad de ${esc(p.name)}"></td><td class="r">${money(pr.amt)}</td><td><button class="btn sm red" data-act="vbDRm" data-i="${i}" aria-label="Quitar">✕</button></td></tr>`;}).join('')}</tbody>
 <tfoot><tr><th colspan="3" class="r">Total estimado</th><th class="r">${money(tot)}</th><th></th></tr></tfoot></table></div>`:'<p class="sm mut">Todavía no hay artículos.</p>'}
 <div class="f"><div><label for="vb-dk">Condición</label><select id="vb-dk"><option value="cc" ${d.cond==='cc'?'selected':''}>Cuenta corriente</option><option value="contado" ${d.cond==='contado'?'selected':''}>Contado</option></select></div>
 <div><label for="vb-dd">Fecha de entrega</label><input id="vb-dd" type="date" value="${d.deliv}"></div><div><label for="vb-dn">Nota</label><input id="vb-dn" maxlength="240" value="${esc(d.note)}"></div></div>
 <div class="row" style="gap:.5rem"><button class="btn gold" data-act="vbDSave" ${c&&d.items.length?'':'disabled'}>Guardar pedido</button><button class="btn ghost" data-act="vbDCancel">Descartar</button></div></div>`;}
function vbDraftAfter(){const dc=$('#vb-dc');if(dc)dc.addEventListener('input',()=>{const L=vbCustFind(dc.value);$('#vb-dcr').innerHTML=L.map(c=>`<button class="btn sm" data-act="vbDCust" data-id="${c.id}" style="margin:.15rem">${esc(custFull(c))}${c.taxid?' · '+esc(c.taxid):''}</button>`).join('');});
 const dp=$('#vb-dp');if(dp){dp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const p=giFind(dp.value)[0];if(!p)return toast('No encontré ese artículo.',1);A.vbDAdd({dataset:{id:p.id}});}});
  dp.addEventListener('input',()=>{const v=dp.value.trim();if(v.length<3||/^\d+$/.test(v)){$('#vb-dpr').innerHTML='';return;}$('#vb-dpr').innerHTML=giFind(v,6).map(p=>`<button class="btn sm" data-act="vbDAdd" data-id="${p.id}" style="margin:.15rem">${esc(pfull(p))} · ${money(p.price)}</button>`).join('');});}
 $$('.vb-dq').forEach(i=>i.addEventListener('change',()=>{const v=Math.round((+i.value||0)*1000)/1000;const x=vbDraft.items[+i.dataset.i];if(x){if(v>0)x.qty=v;else vbDraft.items.splice(+i.dataset.i,1);}rerender();}));
 [['vb-dk','cond'],['vb-dd','deliv'],['vb-dn','note']].forEach(([id,k])=>{const e=$('#'+id);if(e)e.addEventListener('change',()=>{vbDraft[k]=e.value;});});}
A.vbDCust=el=>{vbDraft.cust=el.dataset.id||'';rerender();};
A.vbDAdd=el=>{const x=vbDraft.items.find(i=>i.pid===el.dataset.id);if(x)x.qty+=1;else vbDraft.items.push({pid:el.dataset.id,qty:1});rerender();setTimeout(()=>{const i=$('#vb-dp');if(i)i.focus();},50);};
A.vbDRm=el=>{vbDraft.items.splice(+el.dataset.i,1);rerender();};
A.vbDCancel=()=>{vbDraft=null;vbOTab='lista';rerender();};
A.vbDSave=()=>{const src=vbDraft&&vbDraft.src;const r=vbOrderCreate(vbDraft);if(r.err)return toast(r.err,1);vbDraft=null;vbOTab='lista';vbOSel=r.o.id;if(src==='preventa'&&SCREENS.preventa&&user&&user.role==='preventista'){go('preventa');}else rerender();toast('Pedido '+r.o.n+' guardado'+(r.warn.length?' · ojo: falta stock de '+r.warn.length+' artículo(s)':''));};
A.vbONew=()=>{vbDraftNew();vbOTab='nuevo';rerender();};
function vbOrdersList(){const F={abiertos:o=>VB_OPEN.concat('entregado').includes(o.state),todos:()=>true,facturado:o=>o.state==='facturado',anulado:o=>o.state==='anulado'};const L=vbArr('sordr').filter(F[vbOF]||F.abiertos).slice().reverse().slice(0,300);
 return`<div class="row" style="gap:.4rem;flex-wrap:wrap;margin:.5rem 0">${[['abiertos','Abiertos'],['facturado','Facturados'],['anulado','Anulados'],['todos','Todos']].map(([k,t])=>`<button class="btn sm ${vbOF===k?'gold':''}" data-act="vbOF" data-f="${k}">${t}</button>`).join('')}<span class="sp"></span>${vbRepOk()&&vbArr('sordr').some(o=>VB_OPEN.includes(o.state)&&!vbEnvVivo(o))?'<button class="btn" data-act="vbORepAll">🚚 Mandar abiertos a reparto</button>':''}<button class="btn gold" data-act="vbONew">+ Nuevo pedido</button></div>
 ${L.length?`<div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Origen</th><th class="r">Total</th><th>Estado</th><th></th></tr></thead><tbody>${L.map(o=>`<tr><td><b>${esc(o.n)}</b></td><td>${fmtDT(o.ts)}</td><td>${esc(o.custName)}</td><td>${esc({mostrador:'Mostrador',preventa:'Preventa',whatsapp:'WhatsApp',portal:'Portal'}[o.src]||o.src)}</td><td class="r">${money(o.total)}</td><td>${vbTag(o.state)}${vbEnvVivo(o)?' <span class="tag ok">🚚 en reparto</span>':''}</td><td class="r"><button class="btn sm" data-act="vbOOpen" data-id="${o.id}">Abrir</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="okbox">No hay pedidos en esta vista.</div>'}`;}
A.vbOF=el=>{vbOF=el.dataset.f;rerender();};
A.vbOOpen=el=>{vbOSel=el.dataset.id;vbOTab='detalle';rerender();};
function vbOrderDetail(){const o=vbOrd(vbOSel);if(!o)return'<p>Elegí un pedido.</p>';const R=vbArr('remitos').filter(r=>r.ord===o.id);const open=VB_OPEN.includes(o.state);const uninv=R.filter(r=>!r.inv&&r.state!=='anulado');
 return`<div class="row" style="gap:.5rem;flex-wrap:wrap"><button class="btn sm" data-act="vbOTab" data-t="lista">← Pedidos</button><h2 class="sp" style="margin:0">${esc(o.n)} · ${esc(o.custName)}</h2>${vbTag(o.state)}</div>
 <p class="sm mut">${fmtDT(o.ts)} · ${esc(o.user)} · ${o.cond==='cc'?'Cuenta corriente':'Contado'}${o.deliv?' · entrega '+dmy(o.deliv):''}${o.note?' · '+esc(o.note):''}</p>
 <div class="tw"><table data-nosort><thead><tr><th>Artículo</th><th class="r">Pedido</th><th class="r">Armado</th><th class="r">Entregado</th><th class="r">Facturado</th><th class="r">Disponible</th>${open?'<th class="r">Entregar ahora</th>':''}</tr></thead><tbody>
 ${o.items.map(it=>{const p=prod(it.pid);const pend=Math.round((it.qty-(it.del||0))*1000)/1000;const lim=it.pick===null||it.pick===undefined?pend:Math.max(0,Math.min(pend,it.pick-(it.del||0)));
  return`<tr><td>${esc(it.name)}</td><td class="r">${it.qty}</td><td class="r">${it.pick===null||it.pick===undefined?'—':it.pick}</td><td class="r">${it.del||0}</td><td class="r">${it.inv||0}</td><td class="r">${p?vbAvail(p,o.id):'—'}</td>${open?`<td class="r"><input class="vb-rq" data-pid="${it.pid}" type="number" min="0" max="${lim}" step="any" value="${lim}" style="width:5.5rem" aria-label="Entregar ${esc(it.name)}"></td>`:''}</tr>`;}).join('')}</tbody></table></div>
 <div class="row" style="gap:.5rem;flex-wrap:wrap;margin:.6rem 0">
 <button class="btn sm" data-act="vbODoc" data-id="${o.id}">Imprimir pedido</button>
 ${['pendiente','armado'].includes(o.state)?`<button class="btn sm" data-act="vbOPickDoc" data-id="${o.id}">Lista de armado</button><button class="btn sm" data-act="vbOPick" data-id="${o.id}">Registrar armado</button>`:''}
 ${open&&vbRepOk()&&!vbEnvVivo(o)?`<button class="btn gold" data-act="vbORep" data-id="${o.id}">🚚 Mandar a reparto</button>`:''}${vbEnvVivo(o)?`<span class="tag ok">En reparto · envío #${esc(vbEnvOf(o).n)} · ${esc((typeof REP_EST!=='undefined'&&REP_EST[vbEnvOf(o).estado])||vbEnvOf(o).estado)}</span>`:''}
 ${open?`<button class="btn ${vbRepOk()?'sm':'gold'}" data-act="vbORem" data-id="${o.id}">${vbRepOk()?'Remito (lo retira el cliente)':'Emitir remito'}</button>`:''}
 ${uninv.length?`<button class="btn gold" data-act="vbOInv" data-id="${o.id}">Facturar ${uninv.length} remito(s)</button>`:''}
 ${!['facturado','anulado'].includes(o.state)?`<button class="btn sm red" data-act="vbOCancel" data-id="${o.id}">${o.items.some(i=>(i.inv||0)>0)?'Cerrar pedido':'Anular pedido'}</button>`:''}</div>
 ${R.length?`<h3>Remitos</h3><div class="tw"><table data-nosort><thead><tr><th>N.º</th><th>Fecha</th><th>Artículos</th><th>Factura</th><th></th></tr></thead><tbody>${R.map(r=>`<tr><td>${esc(r.n)}${r.state==='anulado'?' <span class="tag bad">Anulado</span>':''}</td><td>${fmtDT(r.ts)}</td><td>${r.items.map(i=>i.qty+' '+esc(i.name)).join(', ')}</td><td>${r.inv?esc(r.invN||''):'—'}</td>
  <td class="r"><button class="btn sm" data-act="vbRDoc" data-id="${r.id}">Imprimir</button>${!r.inv&&r.state!=='anulado'?` <button class="btn sm red" data-act="vbRVoid" data-id="${r.id}">Anular</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:''}
 <h3>Historial</h3><ul class="sm">${o.hist.map(h=>`<li>${fmtDT(h.ts)} · ${esc(h.u)} · ${esc(VB_ST[h.s]?VB_ST[h.s][0]:h.s)}</li>`).join('')}</ul>`;}
A.vbODoc=el=>{const o=vbOrd(el.dataset.id);if(o)vbPrint(vbOrderDoc(o));};
A.vbOPickDoc=el=>{const o=vbOrd(el.dataset.id);if(o)vbPrint(vbPickDoc(o));};
A.vbRDoc=el=>{const r=vbArr('remitos').find(x=>x.id===el.dataset.id);if(r)vbPrint(vbRemitoDoc(r));};
A.vbOPick=el=>{const o=vbOrd(el.dataset.id);if(!o)return;modal('Armado de '+o.n,`<p class="sm mut">Anotá lo que se armó de verdad. Lo que falte queda pendiente y no se puede remitir hasta armarlo.</p>${o.items.map(it=>`<label for="pk-${it.pid}">${esc(it.name)} (pedido ${it.qty})</label><input id="pk-${it.pid}" class="vb-pk" data-pid="${it.pid}" type="number" min="0" step="any" value="${it.qty}">`).join('')}`,
 {okText:'Guardar armado',onOk:w=>{const m={};$$('.vb-pk',w).forEach(i=>m[i.dataset.pid]=+i.value);const r=vbPick(o.id,m);if(r.err)return w._err(r.err),false;toast(r.falt.length?'Armado con faltantes':'Armado completo');rerender();}});};
A.vbORem=el=>{const o=vbOrd(el.dataset.id);if(!o)return;const m={};$$('.vb-rq').forEach(i=>m[i.dataset.pid]=+i.value);const r=vbRemito(o.id,m);if(r.err)return toast(r.err,1);
 confirmBox('Remito '+esc(r.r.n),`Se registró la entrega de ${r.r.items.length} artículo(s). ¿Lo imprimimos para que firme el cliente?`,()=>vbPrint(vbRemitoDoc(r.r)),'Imprimir');rerender();};
A.vbRVoid=el=>{modal('Anular remito',`<label for="rv-w">Motivo</label><input id="rv-w" maxlength="120">`,{okText:'Anular',onOk:w=>{const r=vbRemitoVoid(el.dataset.id,val('rv-w'));if(r.err)return w._err(r.err),false;toast('Remito anulado');rerender();}});};
A.vbOCancel=el=>{modal('Cerrar o anular pedido',`<label for="oc-w">Motivo</label><input id="oc-w" maxlength="120">`,{okText:'Confirmar',onOk:w=>{const r=vbOrderCancel(el.dataset.id,val('oc-w'));if(r.err)return w._err(r.err),false;toast('Pedido '+r.o.n+' · '+VB_ST[r.o.state][0]);rerender();}});};
function vbPayForm(c,cond){const M=['fiado','efectivo','transferencia','debito','credito','qr'];return`<label for="iv-m">Cómo se cobra</label><select id="iv-m">${M.map(m=>`<option value="${m}" ${(cond==='cc'?'fiado':'efectivo')===m?'selected':''}>${esc(MET[m]||m)}</option>`).join('')}</select>
 ${typeof arcaOn==='function'&&arcaOn()?'<label class="row" style="gap:.4rem"><input type="checkbox" id="iv-a"> Factura electrónica (ARCA)</label>':''}<p class="sm mut">Necesita la caja abierta. La cuenta corriente respeta el límite de crédito del cliente.</p>`;}
A.vbOInv=el=>{const o=vbOrd(el.dataset.id);if(!o)return;const R=vbArr('remitos').filter(r=>r.ord===o.id&&!r.inv&&r.state!=='anulado');const c=custById(o.cust);
 modal('Facturar '+o.n,`<p>${R.map(r=>esc(r.n)).join(', ')} · ${esc(o.custName)}</p>${vbPayForm(c,o.cond)}`,{okText:'Facturar',onOk:w=>{const r=vbInvoice(R.map(x=>x.id),{method:val('iv-m'),arca:!!($('#iv-a')&&$('#iv-a').checked)});if(r.err)return w._err(r.err),false;toast('Venta '+r.sale.n+' · '+money(r.sale.total));rerender();}});};
function vbRemitosList(){const L=vbArr('remitos').slice().reverse().slice(0,300);return L.length?`<div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Pedido / acopio</th><th>Factura</th><th></th></tr></thead><tbody>${L.map(r=>`<tr><td>${esc(r.n)}${r.state==='anulado'?' <span class="tag bad">Anulado</span>':''}</td><td>${fmtDT(r.ts)}</td><td>${esc(r.custName)}</td><td>${esc(r.ordN||'')}</td><td>${r.inv?esc(r.invN||'Facturado'):'<span class="tag warn">Sin facturar</span>'}</td><td class="r"><button class="btn sm" data-act="vbRDoc" data-id="${r.id}">Imprimir</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="okbox">Todavía no hay remitos.</div>';}
reg('pedidosv','Pedidos de venta','truck','orders',()=>{const tabs=[['lista','Pedidos'],['remitos','Remitos']];if(vbOTab==='nuevo'&&!vbDraft)vbDraftNew();
 return`<div class="row"><h1 class="sp">Pedidos de venta</h1></div><p class="sm mut">Pedido → armado → remito → factura → cobro. Lo pedido queda reservado: «disponible» ya descuenta lo comprometido con otros pedidos.</p>
 ${vbOTab==='nuevo'?vbDraftHTML():vbOTab==='detalle'?vbOrderDetail():`<div class="ux-tabs" role="tablist">${tabs.map(([k,t])=>`<a role="tab" tabindex="0" data-act="vbOTab" data-t="${k}" aria-selected="${k===vbOTab}" class="${k===vbOTab?'on':''}">${t}</a>`).join('')}</div>${vbOTab==='remitos'?vbRemitosList():vbOrdersList()}`}`;},
 ()=>{if(vbOTab==='nuevo')vbDraftAfter();},'Operación');
SCREENS.pedidosv.show=()=>giOn('orders');NAV.push(['pedidosv','Operación']);

/* ---------- Pantalla: Acopios ---------- */
let vbAcDraft=null;
A.vbAcNew=()=>{vbAcDraft={cust:'',items:[],venc:''};rerender();};
A.vbAcCust=el=>{vbAcDraft.cust=el.dataset.id||'';rerender();};
A.vbAcAdd=el=>{const x=vbAcDraft.items.find(i=>i.pid===el.dataset.id);if(x)x.qty+=1;else vbAcDraft.items.push({pid:el.dataset.id,qty:1});rerender();};
A.vbAcRm=el=>{vbAcDraft.items.splice(+el.dataset.i,1);rerender();};
A.vbAcCancel=()=>{vbAcDraft=null;rerender();};
A.vbAcSave=()=>{const c=custById(vbAcDraft.cust);modal('Cobrar el acopio',vbPayForm(c,'cc')+`<label for="ac-v">Vence (opcional)</label><input id="ac-v" type="date" value="${vbAcDraft.venc||''}">`,{okText:'Registrar acopio',onOk:w=>{
 const r=vbAcopioCreate({cust:vbAcDraft.cust,items:vbAcDraft.items,method:val('iv-m'),arca:!!($('#iv-a')&&$('#iv-a').checked),venc:val('ac-v')});if(r.err)return w._err(r.err),false;vbAcDraft=null;toast('Acopio '+r.ac.n+' · venta '+r.sale.n);rerender();}});};
A.vbAcRet=el=>{const ac=vbArr('acopios').find(x=>x.id===el.dataset.id);if(!ac)return;modal('Retiro de '+ac.n,ac.items.map(it=>`<label for="ar-${it.pid}">${esc(it.name)} · quedan ${Math.round((it.qty-it.ret)*1000)/1000}</label><input id="ar-${it.pid}" class="vb-ar" data-pid="${it.pid}" type="number" min="0" step="any" value="0">`).join(''),
 {okText:'Registrar retiro',onOk:w=>{const m={};$$('.vb-ar',w).forEach(i=>m[i.dataset.pid]=+i.value);const r=vbAcopioRetiro(ac.id,m);if(r.err)return w._err(r.err),false;rerender();confirmBox('Remito '+esc(r.r.n),'¿Imprimimos el remito del retiro?',()=>vbPrint(vbRemitoDoc(r.r)),'Imprimir');}});};
reg('acopios','Acopios','box','stockpile',()=>{const L=vbArr('acopios').slice().reverse();const hoy=dkey(now());const d=vbAcDraft;
 if(d){const c=custById(d.cust);return`<h1>Nuevo acopio</h1><div class="card"><p class="sm mut">El cliente compra hoy a precio congelado y retira en partes. La venta se registra ahora (stock, caja o cuenta corriente); cada retiro genera su remito.</p>
  ${c?`<div class="row"><b class="sp">${esc(custFull(c))}</b><button class="btn sm" data-act="vbAcCust" data-id="">Cambiar</button></div>`:`<label for="ac-c">Cliente</label><input id="ac-c" autocomplete="off" placeholder="Nombre, CUIT o teléfono"><div id="ac-cr"></div>`}
  <label for="ac-p">Agregar artículo</label><input id="ac-p" autocomplete="off" placeholder="Código o nombre (Enter)">
  ${d.items.length?`<div class="tw"><table data-nosort><thead><tr><th>Artículo</th><th class="r">Cantidad</th><th class="r">Importe</th><th></th></tr></thead><tbody>${d.items.map((x,i)=>{const p=prod(x.pid);const pr=vbLinePrice(p,x.qty,c);return`<tr><td>${esc(pfull(p))}</td><td class="r"><input class="vb-aq" data-i="${i}" type="number" min="0" step="any" value="${x.qty}" style="width:5.5rem" aria-label="Cantidad"></td><td class="r">${money(pr.amt)}</td><td><button class="btn sm red" data-act="vbAcRm" data-i="${i}" aria-label="Quitar">✕</button></td></tr>`;}).join('')}</tbody></table></div>`:''}
  <div class="row" style="gap:.5rem;margin-top:.6rem"><button class="btn gold" data-act="vbAcSave" ${c&&d.items.length?'':'disabled'}>Cobrar y registrar</button><button class="btn ghost" data-act="vbAcCancel">Descartar</button></div></div>`;}
 return`<div class="row"><h1 class="sp">Acopios</h1><button class="btn gold" data-act="vbAcNew">+ Nuevo acopio</button></div>
 <div class="card"><div class="sm mut">Mercadería vendida pendiente de entregar (pasivo con clientes)</div><div class="total">${money(vbAcopioPasivo())}</div></div>
 ${L.length?`<div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Pendiente</th><th class="r">A entregar</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>${L.map(a=>{const venc=a.venc&&a.state==='vigente'&&a.venc<hoy;return`<tr><td>${esc(a.n)}</td><td>${fmtDT(a.ts)}</td><td>${esc(a.custName)}</td><td class="sm">${a.items.filter(i=>i.qty>i.ret).map(i=>Math.round((i.qty-i.ret)*1000)/1000+' '+esc(i.name)).join(', ')||'—'}</td><td class="r">${money(vbAcopioPend(a))}</td><td>${a.venc?dmy(a.venc):'—'}${venc?' <span class="tag bad">Vencido</span>':''}</td><td><span class="tag ${a.state==='vigente'?'warn':'ok'}">${a.state==='vigente'?'Vigente':'Retirado'}</span></td><td class="r">${a.state==='vigente'?`<button class="btn sm gold" data-act="vbAcRet" data-id="${a.id}">Retiro</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="okbox">No hay acopios.</div>'}`;},
 ()=>{if(!vbAcDraft)return;const ci=$('#ac-c');if(ci)ci.addEventListener('input',()=>{$('#ac-cr').innerHTML=vbCustFind(ci.value).map(c=>`<button class="btn sm" data-act="vbAcCust" data-id="${c.id}" style="margin:.15rem">${esc(custFull(c))}</button>`).join('');});
  const pi=$('#ac-p');if(pi)pi.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const p=giFind(pi.value)[0];if(!p)return toast('No encontré ese artículo.',1);A.vbAcAdd({dataset:{id:p.id}});}});
  $$('.vb-aq').forEach(i=>i.addEventListener('change',()=>{const v=+i.value||0;const x=vbAcDraft.items[+i.dataset.i];if(x){if(v>0)x.qty=v;else vbAcDraft.items.splice(+i.dataset.i,1);}rerender();}));},'Operación');
SCREENS.acopios.show=()=>giOn('stockpile');NAV.push(['acopios','Operación']);
