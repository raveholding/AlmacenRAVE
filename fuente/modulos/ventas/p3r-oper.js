/* ===== V26.54 · Operación: presupuestos, devoluciones parciales y mermas =====
   Revisión del pedido (Sistema VB = Vincular Business, web + Supabase; no WinForms):
   · Presupuesto: NO mueve stock ni caja ni suma como venta. Se imprime («NO VÁLIDO COMO FACTURA»), vence, y al
     convertirlo se carga en Vender: recién al cobrar descuenta stock (con las mismas reglas de siempre).
   · Devolución parcial: de una venta con ticket interno (con factura electrónica corresponde la nota de crédito de F5).
     Devuelve el stock de lo devuelto y reintegra en efectivo (egreso de caja con el rubro del artículo), al monedero
     del cliente, o por el mismo medio digital (queda registrado; el reintegro lo hace el banco/tarjeta). No edita la venta:
     es un registro aparte que se descuenta en Ventas netas y en los niveles del Club.
   · Merma: rotura, vencimiento, robo/faltante o consumo interno; resta stock y queda VALORIZADA al costo para el reporte.
   Gastos/caja chica, fondo fijo de apertura, traspasos, alertas por Telegram, auditoría y atajos F1–F12 ya existían. */
const quotes=()=>S.quotes||(S.quotes=[]);
const rets=()=>S.returns||(S.returns=[]);
const mermasL=()=>S.mermas||(S.mermas=[]);
function qtState(q){if(q.state==='convertido'||q.state==='anulado')return q.state;return q.exp&&now()>q.exp?'vencido':'vigente';}
const QT_TXT={vigente:'Vigente',vencido:'Vencido',convertido:'Convertido en venta',anulado:'Anulado'};
const qtTotal=q=>q.lines.reduce((a,l)=>a+Math.round(l.qty*l.price),0);
function qtCartBtn(){if(!pos.lines.length){pos.quote='';return'';}return pos.lines.length&&!pos.quote?`<button class="btn" style="width:100%;margin-top:.4rem;white-space:normal" data-act="qtSave">Guardar como presupuesto (no descuenta stock)</button>`:(pos.quote?`<p class="sm okbox" style="margin-top:.4rem">Cargado desde el presupuesto <b>${esc((quotes().find(q=>q.id===pos.quote)||{}).n||'')}</b>: al cobrar queda convertido. <button class="btn sm" data-act="qtUnlink">Desvincular</button></p>`:'');}
function qtCreate(f){if(!f.lines||!f.lines.length)return{err:'El presupuesto está vacío.'};for(const l of f.lines){if(!(l.qty>0)||!(l.price>0))return{err:'Cantidad y precio deben ser mayores a cero.'};if(!prod(l.pid))return{err:'Producto inexistente.'};}
 const days=Math.max(1,Math.min(90,+f.days||7));const c=S.tenant.caja;S.seqQ=S.seqQ||{};S.seqQ[c]=(S.seqQ[c]||0)+1;const cust=f.cust?custById(f.cust):null;
 const q={id:uid(),n:'P'+c+'-'+S.seqQ[c],ts:now(),exp:now()+days*86400000,days,user:user?user.name:'sistema',cust:cust?cust.id:'',custName:cust?custFull(cust):String(f.name||'').replace(/[<>]/g,'').slice(0,60),
  lines:f.lines.map(l=>({pid:l.pid,name:l.name,rubro:l.rubro,qty:l.qty,price:l.price,unit:l.unit,list:l.list,cost:l.cost})),note:String(f.note||'').replace(/[<>]/g,'').slice(0,200),state:'vigente',sale:''};
 q.total=qtTotal(q);quotes().push(q);audit('PRESUPUESTO',q.n+' · '+money(q.total)+' · vence '+dmy(dkey(q.exp))+(q.custName?' · '+q.custName:''));save();return{q};}
A.qtSave=()=>{if(!pos.lines.length)return;if(!can('sell'))return toast('Sin permiso',1);const cust=custById(pos.cust);
 modal('Guardar presupuesto',`<p>Total: <b>${money(posGross())}</b> · ${pos.lines.length} artículo(s). <b>No descuenta stock ni entra a la caja.</b></p>${cust?`<p>Cliente: <b>${esc(custFull(cust))}</b></p>`:`<label for="qt-n">Para (nombre del cliente, opcional)</label><input id="qt-n" maxlength="60">`}
 <label for="qt-d">Validez (días)</label><input id="qt-d" inputmode="numeric" value="7"><label for="qt-o">Observaciones (opcional)</label><input id="qt-o" maxlength="200">`,
 {okText:'Guardar presupuesto',onOk:w=>{const d=parseNum(val('qt-d'));if(!(Number.isInteger(d)&&d>=1&&d<=90))return w._err('La validez va de 1 a 90 días.'),false;
  const r=qtCreate({lines:pos.lines,cust:pos.cust,name:cust?'':val('qt-n'),days:d,note:val('qt-o')});if(r.err)return w._err(r.err),false;
  pos.lines=[];pos.sel=-1;pos.cust='';posCart();posGrid();toast('Presupuesto '+r.q.n+' guardado');setTimeout(()=>qtPrint(r.q),60);}});};
A.qtUnlink=()=>{pos.quote='';posCart();};
function qtCommit(sale,qid){const q=quotes().find(x=>x.id===qid);if(!q||qtState(q)==='convertido'||q.state==='anulado')return;q.state='convertido';q.sale=sale.id;q.saleN=sale.n;q.convAt=now();audit('PRESUPUESTO_CONVERTIDO',q.n+' → venta '+sale.n);}
A.qtLoad=el=>{const q=quotes().find(x=>x.id===el.dataset.id);if(!q)return;const st=qtState(q);if(st==='convertido'||st==='anulado')return toast('Ese presupuesto ya está '+QT_TXT[st].toLowerCase()+'.',1);
 if(pos.lines.length)return toast('Terminá o borrá la operación que está en Vender antes de cargar un presupuesto.',1);
 const go2=fresh=>{const miss=[];pos.lines=q.lines.filter(l=>{const p=prod(l.pid);if(!p||!p.active){miss.push(l.name);return false;}return true;}).map(l=>{const p=prod(l.pid);return Object.assign({},l,{price:fresh?p.price:l.price,list:p.price,cost:p.cost});});
  pos.cust=q.cust||'';pos.quote=q.id;pos.sel=pos.lines.length-1;audit('PRESUPUESTO_A_VENDER',q.n+(fresh?' (precios actuales)':' (precios del presupuesto)'));go('vender');if(miss.length)toast('No están disponibles: '+miss.join(', '),1);};
 const changed=q.lines.some(l=>{const p=prod(l.pid);return p&&p.price!==l.price;});
 if(st==='vencido'||changed)modal('Convertir '+q.n,`<p>${st==='vencido'?'El presupuesto <b>venció</b>.':'Algunos precios <b>cambiaron</b> desde que se hizo.'} ¿Con qué precios lo cargamos en Vender?</p>`,{okText:'Precios actuales',cancelText:st==='vencido'?'Cancelar':'Respetar el presupuesto',onOk:()=>{go2(true);}});
 else go2(false);
 if(st!=='vencido'&&changed){const w=$$('#modal-root .ov').pop();const x=w&&w.querySelector('[data-m=x]');if(x)x.addEventListener('click',()=>go2(false),{once:true});}};
A.qtVoid=el=>{const q=quotes().find(x=>x.id===el.dataset.id);if(!q)return;modal('Anular presupuesto '+q.n,`<label for="qv-m">Motivo</label><input id="qv-m" maxlength="100">`,{onOk:w=>{if(val('qv-m').trim().length<3)return w._err('Escribí el motivo.'),false;q.state='anulado';q.voidReason=val('qv-m').trim();audit('PRESUPUESTO_ANULADO',q.n+' · '+q.voidReason);save();rerender();}});};
function qtPrint(q){const html=`<!doctype html><meta charset="utf-8"><title>Presupuesto ${esc(q.n)}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;font-size:11pt}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ccc;padding:4px;text-align:left}.r{text-align:right}h1{font:700 18pt Georgia;margin:0}</style>
 <h1>${esc(S.tenant.name)}</h1><p><b>PRESUPUESTO ${esc(q.n)}</b> · ${esc(fmtDT(q.ts))} · válido hasta <b>${esc(dmy(dkey(q.exp)))}</b>${q.custName?'<br>Cliente: '+esc(q.custName):''}</p>
 <table><thead><tr><th>Artículo</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead><tbody>${q.lines.map(l=>`<tr><td>${esc(l.name)}</td><td class="r">${numAR(l.qty,3)}</td><td class="r">${money(l.price)}</td><td class="r">${money(Math.round(l.qty*l.price))}</td></tr>`).join('')}</tbody></table>
 <p class="r" style="font-size:14pt"><b>Total ${money(q.total)}</b></p>${q.note?'<p>'+esc(q.note)+'</p>':''}<p><b>DOCUMENTO NO VÁLIDO COMO FACTURA.</b> Precios sujetos a disponibilidad de stock. Atendió: ${esc(q.user)}.</p><p style="font-size:8pt;color:#666">Desarrollado por ${esc(VB.name)} · ${esc(VB.phone)} · ${esc(VB.mail)}</p>`;
 const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);f.contentDocument.open();f.contentDocument.write(html);f.contentDocument.close();setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){}setTimeout(()=>f.remove(),4000);},300);}
A.qtPrint=el=>{const q=quotes().find(x=>x.id===el.dataset.id);if(q)qtPrint(q);};
let QTF='';
reg('presup','Presupuestos','file','sell',()=>{const L=quotes().slice().reverse().filter(q=>!QTF||qtState(q)===QTF);const cnt=k=>quotes().filter(q=>qtState(q)===k).length;
 return `<div class="row"><h1 class="sp">Presupuestos</h1><a class="btn gold" href="#panel/vender">Armar uno en Vender</a></div>
 <div class="warnbox sm">Un presupuesto <b>no descuenta stock, no entra a la caja y no suma como venta</b>. Se arma en Vender con «Guardar como presupuesto». Al convertirlo vuelve a Vender y recién al cobrar es una venta.</div>
 <div class="grid g4" style="margin:1rem 0">${['vigente','vencido','convertido','anulado'].map(k=>`<button class="card kpi ${QTF===k?'on':''}" data-act="qtF" data-k="${k}" style="cursor:pointer;text-align:left"><b>${cnt(k)}</b><span>${QT_TXT[k]}</span></button>`).join('')}</div>
 ${QTF?`<p><button class="btn sm" data-act="qtF" data-k="">Ver todos</button></p>`:''}
 <div class="card"><div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th class="r">Total</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>${L.map(q=>{const st=qtState(q);return `<tr><td><b>${esc(q.n)}</b>${q.origin==='ejemplo'?' <span class="tag sim">ej.</span>':''}</td><td class="sm">${esc(fmtDT(q.ts))}</td><td>${esc(q.custName||'—')}</td><td class="r" data-sv="${q.total}">${money(q.total)}</td><td class="sm">${esc(dmy(dkey(q.exp)))}</td><td><span class="tag ${st==='vigente'?'ok':st==='convertido'?'':'bad'}">${esc(QT_TXT[st])}</span>${q.saleN?' <span class="sm">venta '+esc(q.saleN)+'</span>':''}</td>
 <td class="r"><button class="btn sm" data-act="qtPrint" data-id="${q.id}">Imprimir</button>${st==='vigente'||st==='vencido'?` <button class="btn sm gold" data-act="qtLoad" data-id="${q.id}">Convertir en venta</button> <button class="btn sm red" data-act="qtVoid" data-id="${q.id}">Anular</button>`:''}</td></tr>`;}).join('')||'<tr><td colspan="7" class="mut">No hay presupuestos.</td></tr>'}</tbody></table></div></div>`;},null,'Operación');
A.qtF=el=>{QTF=el.dataset.k||'';rerender();};

/* ---------- devoluciones parciales ---------- */
const retQty=(sid,i)=>rets().filter(r=>r.sale===sid).reduce((a,r)=>a+r.lines.filter(l=>l.i===i).reduce((x,l)=>x+l.qty,0),0);
const saleRetTotal=s=>rets().filter(r=>r.sale===s.id).reduce((a,r)=>a+r.total,0);
function devAllowed(s){if(!s||s.status!=='ok')return'Sólo se devuelve de una venta cobrada (no anulada ni pendiente).';if(s.doc&&s.doc!=='ticket_interno')return'Esta venta tiene factura electrónica: corresponde una nota de crédito (F5).';
 if(!s.items.some((it,i)=>it.qty-retQty(s.id,i)>1e-9))return'Ya se devolvió todo lo de esta venta.';return'';}
function devBtn(s){return can('void')&&!devAllowed(s)?`<button class="btn" data-act="devOpen" data-id="${esc(s.id)}">Devolución parcial</button>`:'';}
function devCommit(s,lines,refund,motivo){const e=devAllowed(s);if(e)return{err:e};if(!lines.length)return{err:'Elegí qué se devuelve.'};if(String(motivo||'').trim().length<3)return{err:'Escribí el motivo de la devolución.'};
 const out=[];let total=0;
 for(const l of lines){const it=s.items[l.i];if(!it)return{err:'Línea inexistente.'};const left=Math.round((it.qty-retQty(s.id,l.i))*1000)/1000;if(!(l.qty>0)||l.qty>left+1e-9)return{err:'De «'+it.name+'» se pueden devolver hasta '+numAR(left,3)+'.'};
  if(it.unit==='u'&&!Number.isInteger(l.qty))return{err:'«'+it.name+'» se devuelve por unidad entera.'};
  const amt=Math.round(lineTotal(it)*l.qty/it.qty);out.push({i:l.i,pid:it.pid,name:it.name,rubro:it.rubro,qty:l.qty,amount:amt});total+=amt;}
 if(!(total>0))return{err:'El importe a devolver es cero.'};
 const cust=s.cust?custById(s.cust):null;if(refund==='monedero'&&(!cust||!fidCfg().wallet.on))return{err:'Para reintegrar al monedero la venta tiene que tener un cliente y el monedero estar activo.'};
 if(refund==='efectivo'){if(!openSess())return{err:'Abrí la caja para devolver efectivo.'};const byR={};out.forEach(o=>{byR[o.rubro]=(byR[o.rubro]||0)+o.amount;});
  for(const rid in byR){const ve=validRubro(rid,'egreso');if(ve)return{err:'Rubro de «'+rubName(rid)+'»: '+ve};}
  for(const rid in byR){addMov('egreso',rid,'Devolución venta '+s.n+' · '+String(motivo).trim().slice(0,60),byR[rid]);}}
 out.forEach(o=>{const it=s.items[o.i];if(Array.isArray(it.kit)&&it.kit.length)it.kit.forEach(k=>{const c=prod(k.pid);if(c)c.stock=Math.round((c.stock+o.qty*k.qty)*1000)/1000;});else{const p=prod(o.pid);if(p)p.stock=Math.round((p.stock+o.qty)*1000)/1000;}});
 const r={id:uid(),sale:s.id,saleN:s.n,cust:s.cust||'',ts:now(),lines:out,total,refund,motivo:String(motivo).trim().slice(0,120),user:user?user.name:'sistema',sessId:openSess()?openSess().id:''};rets().push(r);
 if(refund==='monedero')walPush(cust.id,'devolucion',total,'Devolución venta '+s.n,{sale:s.id,ret:r.id});
 audit('DEVOLUCION_PARCIAL',s.n+' · '+out.map(o=>o.name+' ×'+numAR(o.qty,3)).join(', ')+' · '+money(total)+' · reintegro '+({efectivo:'efectivo',monedero:'monedero',otro:'mismo medio (fuera del sistema)'}[refund]||refund)+' · '+r.motivo);save();return{r};}
A.devOpen=el=>{const s=S.sales.find(x=>x.id===el.dataset.id);const e=devAllowed(s);if(e)return toast(e,1);if(!can('void'))return toast('Sin permiso',1);closeAll();
 const w=modal('Devolución parcial · venta '+s.n,`<p class="sm mut">Elegí cuánto se devuelve de cada artículo. Vuelve al stock y se reintegra el importe proporcional (con su descuento). La venta original no se modifica.</p>
 <div class="tw"><table><thead><tr><th>Artículo</th><th class="r">Vendido</th><th class="r">Ya devuelto</th><th class="r">Devolver</th></tr></thead><tbody>${s.items.map((it,i)=>{const done=retQty(s.id,i);const left=it.qty-done;return `<tr><td>${esc(it.name)}</td><td class="r">${numAR(it.qty,3)}</td><td class="r">${done?numAR(done,3):'—'}</td><td class="r">${left>1e-9?`<input id="dv-q${i}" inputmode="decimal" placeholder="0" style="max-width:90px" aria-label="Cantidad a devolver de ${esc(it.name)}">`:'<span class="mut">—</span>'}</td></tr>`;}).join('')}</tbody></table></div>
 <div id="dv-tot" class="okbox" style="margin:.4rem 0">Total a reintegrar: <b>$ 0</b></div>
 <label for="dv-r">Cómo se reintegra</label><select id="dv-r"><option value="efectivo">Efectivo (sale de la caja abierta)</option>${s.cust&&fidCfg().wallet.on?'<option value="monedero">Al monedero del cliente</option>':''}<option value="otro">Por el mismo medio digital (transferencia/tarjeta, lo hace el banco)</option></select>
 <label for="dv-m">Motivo (obligatorio)</label><input id="dv-m" maxlength="120">`,
 {wide:true,okText:'Registrar devolución',onOk:w=>{const L=[];for(let i=0;i<s.items.length;i++){const x=w.querySelector('#dv-q'+i);if(!x||!x.value.trim())continue;const q=parseNum(x.value);if(isNaN(q)||q<=0)return w._err('Revisá la cantidad de «'+s.items[i].name+'».'),false;L.push({i,qty:Math.round(q*1000)/1000});}
  const r=devCommit(s,L,val('dv-r'),val('dv-m'));if(r.err)return w._err(r.err),false;toast('Devolución registrada: '+money(r.r.total));rerender();}});
 w.addEventListener('input',()=>{let t=0;s.items.forEach((it,i)=>{const x=w.querySelector('#dv-q'+i);const q=x?parseNum(x.value):NaN;if(q>0)t+=Math.round(lineTotal(it)*Math.min(q,it.qty)/it.qty);});const b=w.querySelector('#dv-tot');if(b)b.innerHTML='Total a reintegrar: <b>'+money(t)+'</b>';});};

/* ---------- mermas valorizadas ---------- */
const MERMA_T={ajuste:'Ajuste / recuento',merma:'Merma',rotura:'Rotura',vencimiento:'Vencimiento',robo:'Robo / faltante',consumo:'Consumo interno'};
function mermaRecord(p,d,tipo,motivo){if(tipo==='ajuste'||!MERMA_T[tipo])return;const cost=isKit(p)?kitCost(p):(+p.cost||0);
 mermasL().push({id:uid(),ts:now(),pid:p.id,name:pfull(p),rubro:p.rubro,qty:d,cost,value:Math.round(Math.abs(d)*cost),tipo,motivo:String(motivo||'').slice(0,100),user:user?user.name:'sistema'});}
let MMF={d:30};
reg('mermas','Mermas y devoluciones','box','edit_products',()=>{const from=now()-MMF.d*86400000;const M=mermasL().filter(m=>m.ts>=from).slice().reverse();const R=rets().filter(r=>r.ts>=from).slice().reverse();const vc=can('view_cost');
 const byT={};M.forEach(m=>{const o=byT[m.tipo]||(byT[m.tipo]={n:0,v:0});o.n++;o.v+=m.value;});const totV=M.reduce((a,m)=>a+m.value,0);
 return `<div class="row"><h1 class="sp">Mermas y devoluciones</h1><label for="mm-d" class="sm mut" style="margin:0">Período</label><select id="mm-d" style="max-width:150px">${[[7,'7 días'],[30,'30 días'],[90,'90 días'],[365,'1 año']].map(([k,v])=>`<option value="${k}" ${MMF.d===k?'selected':''}>${v}</option>`).join('')}</select></div>
 <p class="sm mut">Las mermas se cargan en Inventario → «Ajustar stock» eligiendo el tipo (rotura, vencimiento, robo/faltante, consumo interno). Quedan valorizadas al costo del momento. Las devoluciones parciales se hacen desde el detalle de la venta.</p>
 <div class="grid g4" style="margin:1rem 0">${vc?`<div class="card kpi"><b>${money(totV)}</b><span>Pérdida por mermas (al costo)</span></div>`:''}${Object.keys(MERMA_T).filter(k=>k!=='ajuste').map(k=>`<div class="card kpi"><b>${(byT[k]||{n:0}).n}</b><span>${esc(MERMA_T[k])}${vc&&byT[k]?' · '+money(byT[k].v):''}</span></div>`).join('')}<div class="card kpi"><b>${money(R.reduce((a,r)=>a+r.total,0))}</b><span>Devuelto a clientes (${R.length})</span></div></div>
 <div class="card"><h3>Mermas</h3><div class="tw"><table><thead><tr><th>Fecha</th><th>Artículo</th><th>Tipo</th><th class="r">Cantidad</th>${vc?'<th class="r">Costo unit.</th><th class="r">Pérdida</th>':''}<th>Motivo</th><th>Usuario</th></tr></thead><tbody>${M.map(m=>`<tr><td class="sm">${esc(fmtDT(m.ts))}</td><td>${esc(m.name)}${m.origin==='ejemplo'?' <span class="tag sim">ej.</span>':''}</td><td>${esc(MERMA_T[m.tipo]||m.tipo)}</td><td class="r">${numAR(m.qty,3)}</td>${vc?`<td class="r">${money(m.cost)}</td><td class="r" data-sv="${m.value}"><b>${money(m.value)}</b></td>`:''}<td class="sm">${esc(m.motivo)}</td><td class="sm">${esc(m.user)}</td></tr>`).join('')||`<tr><td colspan="${vc?8:6}" class="mut">Sin mermas en el período.</td></tr>`}</tbody></table></div></div>
 <div class="card" style="margin-top:1rem"><h3>Devoluciones parciales</h3><div class="tw"><table><thead><tr><th>Fecha</th><th>Venta</th><th>Qué se devolvió</th><th class="r">Importe</th><th>Reintegro</th><th>Motivo</th><th>Usuario</th></tr></thead><tbody>${R.map(r=>`<tr><td class="sm">${esc(fmtDT(r.ts))}</td><td>${esc(r.saleN)}</td><td class="sm">${r.lines.map(l=>esc(l.name)+' ×'+numAR(l.qty,3)).join('<br>')}</td><td class="r" data-sv="${r.total}">${money(r.total)}</td><td>${esc({efectivo:'Efectivo',monedero:'Monedero',otro:'Mismo medio'}[r.refund]||r.refund)}</td><td class="sm">${esc(r.motivo)}</td><td class="sm">${esc(r.user)}</td></tr>`).join('')||'<tr><td colspan="7" class="mut">Sin devoluciones en el período.</td></tr>'}</tbody></table></div></div>`;},
 ()=>{const d=$('#mm-d');if(d)d.addEventListener('change',()=>{MMF.d=+d.value;rerender();});},'Operación');

function operDemoSeed(){if(IS_CLIENT||S.operDemo)return;const P=S.products.filter(p=>p.active&&!isKit(p)&&p.unit==='u'&&p.price>0).slice(0,4);if(P.length<2)return;S.operDemo=1;const t0=now()-3*86400000;
 const ln=(p,q)=>({pid:p.id,name:pfull(p),rubro:p.rubro,qty:q,price:p.price,unit:p.unit,list:p.price,cost:p.cost});
 const q1={id:uid(),n:'P'+S.tenant.caja+'-1',ts:t0,exp:t0+10*86400000,days:10,user:'ejemplo',cust:'',custName:'Evento de ejemplo',lines:[ln(P[0],6),ln(P[1],12)],note:'Presupuesto de ejemplo para un evento',state:'vigente',sale:'',origin:'ejemplo'};q1.total=qtTotal(q1);
 const q2={id:uid(),n:'P'+S.tenant.caja+'-2',ts:t0-20*86400000,exp:t0-13*86400000,days:7,user:'ejemplo',cust:'',custName:'Cliente de ejemplo',lines:[ln(P[1],3)],note:'',state:'vigente',sale:'',origin:'ejemplo'};q2.total=qtTotal(q2);
 quotes().push(q2,q1);S.seqQ=S.seqQ||{};S.seqQ[S.tenant.caja]=2;
 mermasL().push({id:uid(),ts:t0,pid:P[0].id,name:pfull(P[0]),rubro:P[0].rubro,qty:-1,cost:+P[0].cost||0,value:+P[0].cost||0,tipo:'rotura',motivo:'Botella rota al reponer (ejemplo)',user:'ejemplo',origin:'ejemplo'},
  {id:uid(),ts:t0+86400e3,pid:P[1].id,name:pfull(P[1]),rubro:P[1].rubro,qty:-2,cost:+P[1].cost||0,value:2*(+P[1].cost||0),tipo:'vencimiento',motivo:'Vencido (ejemplo)',user:'ejemplo',origin:'ejemplo'});}
