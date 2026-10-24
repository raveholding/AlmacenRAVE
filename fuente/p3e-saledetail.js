/* ===== V26.8 · 4.24.1 Ventas de la caja con detalle de cada operación (minorista y mayorista) =====
   Una sola vista de detalle (saleDetail) y una sola tabla: completa la de "Caja → Ventas de esta caja".
   Sin tope de operaciones por turno (4.24.2): se filtra y se pagina SOLO para dibujar; los totales, el
   arqueo y el cierre sellado usan SIEMPRE todas las ventas de la sesión. */
const CJF={ch:'',st:'',med:'',q:'',vend:'',h1:'',h2:'',n:200};
const CJ_PAGE=200;
const SALE_ST={ok:'Confirmada',pendiente:'Pendiente de cobro',anulada:'Anulada'};
function saleChan(s){return s.wch==='mayorista'?'Mayorista':'Minorista';}
function saleIsNC(s){return !!(s.arcaNC&&s.status==='anulada');}
function saleStateTxt(s){return saleIsNC(s)?'Nota de crédito':(SALE_ST[s.status]||String(s.status||''));}
function saleStateCls(s){return s.status==='ok'?'ok':s.status==='pendiente'?'warn':'bad';}
function saleDocTxt(s){
 if(s.doc==='factura_pendiente_cae'){const a=s.arca;
  if(a&&a.cae)return 'Factura '+String(a.letra||'')+' '+String(a.pto||0).padStart(4,'0')+'-'+String(a.nro||0).padStart(8,'0')+' · CAE '+a.cae+(a.sim?' (simulado)':'');
  return 'Factura (pendiente de CAE)';}
 if(s.doc==='ticket_interno'||!s.doc)return 'Ticket interno (no válido como factura)';
 return String(s.doc).replace(/_/g,' ');}
function saleRuleTxt(it){const r=it.lr||'L1';
 if(r==='L1')return 'Minorista · precio de lista';
 if(r==='MAN')return 'Precio puesto a mano (queda auditado)';
 if(r==='ACU')return 'Acuerdo especial del cliente';
 if(r.startsWith('P-'))return 'Mayorista · escalón '+(it.ll||r.slice(2));
 return r;}
function saleItemPres(it){ /* cantidad en la presentación de venta, si la hay */
 const r=it.lr||'';if(!r.startsWith('P-')||typeof wsPres!=='function')return '';
 const p=prod(it.pid);if(!p)return '';let k=null;try{k=wsPres(p).find(x=>x.lv===r.slice(2));}catch(e){}
 if(!k||!(k.qty>0))return '';const n=it.qty/k.qty;return numAR(n,3)+' '+(it.ll||wsLvName(k.lv))+' (de '+numAR(k.qty,3)+' u)';}
function saleItemCode(it){const p=prod(it.pid);return p?(p.barcode||p.sku||String(p.id||'').slice(0,8)):String(it.pid||'').slice(0,8);}
function saleDiscTotal(s){return(s.items||[]).reduce((a,i)=>a+(i.disc||0),0);}
function saleSellerTxt(s){return s.user||'';}

/* ---------- movimientos que generó la operación (derivados de lo que quedó guardado) ---------- */
function saleMovs(s){
 const o=[];const T=s.ts,U=s.user||'';const rubs=[...new Set((s.items||[]).map(i=>rubName(i.rubro)))].join(', ');
 salePays(s).forEach(p=>{
  if(p.m==='fiado')o.push({g:'Cuenta corriente',t:'Débito al cliente'+(s.custName?' · '+s.custName:''),a:p.a,sg:1,nota:'No entra a caja · '+(PSTATE_TXT[s.pstate]||''),ts:T,u:U});
  else o.push({g:'Caja · '+(MET[p.m]||p.m),t:s.status==='pendiente'?'Cobro pendiente de confirmar':(s.status==='anulada'?'Ingreso por venta (luego anulado)':'Ingreso por venta'),a:p.a,sg:1,nota:'Rubros: '+rubs+(p.fee?' · comisión '+money(p.fee):''),ts:T,u:U});});
 if(s.vuelto>0)o.push({g:'Caja · Efectivo',t:'Vuelto entregado',a:s.vuelto,sg:-1,nota:'Ya descontado del efectivo recibido',ts:T,u:U});
 (s.items||[]).forEach(i=>{const pr=saleItemPres(i);
  o.push({g:'Stock',t:'Salida de '+i.name,a:i.qty,sg:-1,unit:1,nota:'En unidad base'+(pr?' · equivale a '+pr:''),ts:T,u:U});});
 if(s.coupon)o.push({g:'Club / cupones',t:'Cupón usado: '+s.coupon,a:(s.benefit&&s.benefit.disc)||0,sg:-1,nota:(s.benefit&&s.benefit.label)||'',ts:T,u:U});
 else if(s.benefit&&s.benefit.disc)o.push({g:'Club / beneficios',t:'Beneficio aplicado: '+(s.benefit.label||s.benefit.kind),a:s.benefit.disc,sg:-1,nota:'',ts:T,u:U});
 if(s.stamped)o.push({g:'Club / sellos',t:'Sello del Club sumado por esta compra',a:0,sg:0,nota:'Validado en el mostrador',ts:T,u:U});
 if(s.status==='anulada'){
  (s.items||[]).forEach(i=>o.push({g:'Stock',t:'Restitución de '+i.name,a:i.qty,sg:1,unit:1,nota:'Por anulación',ts:T,u:U}));
  o.push({g:'Anulación',t:saleIsNC(s)?'Nota de crédito '+String(s.arcaNC.letra||'')+' '+String(s.arcaNC.pto||0).padStart(4,'0')+'-'+String(s.arcaNC.nro||0).padStart(8,'0')+' · CAE '+(s.arcaNC.cae||''):'Venta anulada',a:s.total,sg:-1,nota:s.voidReason||'',ts:T,u:U});}
 return o;}
function saleAuditLines(s){const n=String(s.n);const re=new RegExp('(^|[^0-9-])'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^0-9])');
 return allAudit().filter(e=>re.test(String(e.detail||'')));}

/* ---------- detalle de la operación ---------- */
function saleDetailHTML(s,o){o=o||{};
 const sess=S.sessions.find(x=>x.id===s.sessId)||{};const cu=s.cust?custById(s.cust):null;const cost=can('view_cost');
 const hd=[['N.º',s.n],['Fecha y hora',fmtDT(s.ts)],['Caja',String(s.caja)+(sess.regName?' · '+sess.regName:'')],['Turno',sess.openedAt?'abierto '+fmtDT(sess.openedAt)+(sess.openedBy?' por '+sess.openedBy:''):'—'],
  ['Canal',saleChan(s)],['Vendedor / cajero',saleSellerTxt(s)||'—'],['Cliente',s.custName?s.custName+(cu&&cu.taxid?' · CUIT/DNI '+cu.taxid:cu&&cu.dni?' · DNI '+cu.dni:''):'Consumidor final'],['Documento',saleDocTxt(s)],['Estado',saleStateTxt(s)]];
 let h=`<div class="grid g3 sdgrid">${hd.map(x=>`<div><span class="sm mut">${esc(x[0])}</span><br><b>${esc(x[1])}</b></div>`).join('')}</div>`;
 h+=`<h3 style="margin-top:.8rem">Ítems</h3><div class="tw"><table class="cjtbl"><thead><tr><th>Código</th><th>Descripción</th><th class="r">Cantidad</th><th>Presentación</th><th class="r">Lista</th><th class="r">Aplicado</th><th>Regla de precio</th><th class="r">Desc.</th><th class="r">Subtotal</th>${cost?'<th class="r">Costo</th><th class="r">Margen</th>':''}</tr></thead><tbody>`+
  (s.items||[]).map(i=>{const sub=lineTotal(i);return `<tr><td data-l="Código">${esc(saleItemCode(i))}</td><td data-l="Descripción">${esc(i.name)}</td><td class="r" data-l="Cantidad">${numAR(i.qty,3)}</td><td data-l="Presentación">${esc(saleItemPres(i)||'Unidad')}</td><td class="r" data-l="Lista">${money(i.list||i.price)}</td><td class="r" data-l="Aplicado">${money(i.price)}</td><td data-l="Regla"><b>${esc(i.lr||'L1')}</b> <span class="sm mut">${esc(saleRuleTxt(i))}</span></td><td class="r" data-l="Desc.">${i.disc?'- '+money(i.disc):'—'}</td><td class="r" data-l="Subtotal">${money(sub)}</td>${cost?`<td class="r" data-l="Costo">${money(lineCost(i))}</td><td class="r" data-l="Margen">${money(sub-lineCost(i))}</td>`:''}</tr>`;}).join('')+
  `</tbody><tfoot><tr><td colspan="${cost?9:7}" class="r"><b>Descuentos</b></td><td class="r" colspan="${cost?2:1}">${saleDiscTotal(s)?'- '+money(saleDiscTotal(s)):'—'}</td></tr><tr><td colspan="${cost?9:7}" class="r"><b>TOTAL</b></td><td class="r" colspan="${cost?2:1}"><b>${money(s.total)}</b></td></tr></tfoot></table></div>`;
 h+=`<h3 style="margin-top:.8rem">Pagos</h3><div class="tw"><table class="cjtbl"><thead><tr><th>Medio</th><th class="r">Importe</th><th class="r">Comisión</th></tr></thead><tbody>${salePays(s).map(p=>`<tr><td data-l="Medio">${esc(MET[p.m]||p.m)}${p.accN?`<div class="sm mut">a la cuenta ${esc(p.accN)}</div>`:''}</td><td class="r" data-l="Importe">${money(p.a)}</td><td class="r" data-l="Comisión">${p.fee?money(p.fee):'—'}</td></tr>`).join('')}</tbody></table></div>`+
  `<p class="sm">${s.vuelto>0?'Vuelto entregado: <b>'+money(s.vuelto)+'</b>. ':''}${saleFiadoAmt(s)>0?'Parte a cuenta corriente: <b>'+money(saleFiadoAmt(s))+'</b> ('+esc(PSTATE_TXT[s.pstate]||'')+').':''}</p>`;
 h+=`<h3 style="margin-top:.8rem">Movimientos que generó la operación</h3><div class="tw"><table class="cjtbl"><thead><tr><th>Dónde</th><th>Movimiento</th><th class="r">Importe / cantidad</th><th>Detalle</th><th>Usuario</th><th>Fecha</th></tr></thead><tbody>`+
  saleMovs(s).map(m=>`<tr><td data-l="Dónde">${esc(m.g)}</td><td data-l="Movimiento">${esc(m.t)}</td><td class="r" data-l="Importe">${m.unit?(m.sg<0?'− ':'+ ')+numAR(m.a,3)+' u':(m.sg===0?'—':(m.sg<0?'− ':'+ ')+money(m.a))}</td><td data-l="Detalle" class="sm">${esc(m.nota)}</td><td data-l="Usuario">${esc(m.u)}</td><td data-l="Fecha">${fmtDT(m.ts)}</td></tr>`).join('')+`</tbody></table></div>`;
 if(typeof saleDetailExtra==='function')h+=saleDetailExtra(s);
 if(o.noTl)return h;
 const au=saleAuditLines(s);
 h+=`<h3 style="margin-top:.8rem">Línea de tiempo de auditoría</h3>${au.length?`<ul class="sdtl">${au.map(e=>`<li><span class="sm mut">${fmtDT(e.ts)} · ${esc(e.user)}</span> <b>${esc(e.action)}</b> <span class="sm">${esc(e.detail)}</span></li>`).join('')}</ul>`:'<p class="sm mut">Sin eventos de auditoría para esta operación.</p>'}`;
 return h;}
function saleDetailOpen(id,opts){opts=opts||{};const s=S.sales.find(x=>x.id===id);if(!s)return toast('La operación ya no está disponible.',1);
 const w=modal('Detalle de la operación '+s.n,`<div id="sd-body">${saleDetailHTML(s)}</div><div class="row noprint" style="margin-top:.6rem"><button class="btn" data-act="saleDetPrint">Imprimir (A4)</button>${typeof expBtn==='function'?expBtn('venta',s.id):''}${opts.ro?'<span class="tag">Sólo lectura</span>':''}</div>`,{wide:true,okText:'Cerrar',noCancel:true});
 w.querySelector('.dlg').classList.add('saledet');return w;}
A.saleDet=el=>saleDetailOpen(el.dataset.id,{ro:!!el.dataset.ro});
A.saleDetPrint=()=>{document.body.classList.add('pm');try{window.print();}finally{setTimeout(()=>document.body.classList.remove('pm'),500);}};
/* Enter sobre la fila la abre (teclado completo) */
document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const tr=e.target&&e.target.closest&&e.target.closest('tr[data-act="saleDet"]');if(tr&&e.target===tr){e.preventDefault();A.saleDet(tr);}});

/* ---------- tabla de ventas de la sesión (filtros, totales, paginado visible) ---------- */
function cjSales(sess){return S.sales.filter(x=>x.sessId===sess.id);}
function cjFiltered(list){
 const q=CJF.q.trim().toLowerCase();const qc=q?cents(q):NaN;
 return list.filter(x=>{
  if(CJF.ch&&saleChan(x)!==CJF.ch)return false;
  if(CJF.st){const k=saleIsNC(x)?'nc':x.status;if(k!==CJF.st)return false;}
  if(CJF.med&&!salePays(x).some(p=>p.m===CJF.med))return false;
  if(CJF.vend&&(x.user||'')!==CJF.vend)return false;
  if(CJF.h1||CJF.h2){const h=hm(x.ts);if(CJF.h1&&h<CJF.h1)return false;if(CJF.h2&&h>CJF.h2)return false;}
  if(q){const hit=String(x.n).toLowerCase().includes(q)||(x.custName||'').toLowerCase().includes(q)||(!isNaN(qc)&&qc>0&&x.total===qc);if(!hit)return false;}
  return true;});}
function cjTotals(sess,list){
 const T={ch:{Minorista:{n:0,t:0},Mayorista:{n:0,t:0}},med:{},ok:{n:0,t:0},pend:{n:0,t:0},anu:{n:0,t:0},nc:{n:0,t:0}};
 list.forEach(x=>{
  if(x.status==='ok'){T.ok.n++;T.ok.t+=x.total;const c=T.ch[saleChan(x)];c.n++;c.t+=x.total;salePays(x).forEach(p=>{const m=T.med[p.m]||(T.med[p.m]={n:0,t:0});m.n++;m.t+=p.a;});}
  else if(x.status==='pendiente'){T.pend.n++;T.pend.t+=x.total;}
  else if(saleIsNC(x)){T.nc.n++;T.nc.t+=x.total;}
  else{T.anu.n++;T.anu.t+=x.total;}});
 return T;}
function cjSalesHTML(sess,ro,tie){
 const all=cjSales(sess);const T=cjTotals(sess,all);const F=cjFiltered(all);const shown=F.slice().reverse();const lim=Math.min(CJF.n,shown.length);
 const users=[...new Set(all.map(x=>x.user).filter(Boolean))];
 const meds=[...new Set(all.flatMap(x=>salePays(x).map(p=>p.m)))];
 const opt=(v,t,cur)=>`<option value="${esc(v)}" ${cur===v?'selected':''}>${esc(t)}</option>`;
 const tieOk=tie===undefined||tie===null?null:(tie===T.ok.t&&Object.keys(T.med).reduce((a,k)=>a+T.med[k].t,0)===tie);
 let h=`<div class="row"><h3 class="sp">Ventas de esta caja</h3><span class="sm mut">${all.length} operación${all.length===1?'':'es'} en el turno · sin límite</span></div>
 <div class="grid g4 cjtot" aria-label="Totales de la sesión"><div class="card kpi"><b>${money(T.ok.t)}</b><span>Ventas confirmadas (${T.ok.n})${tieOk===null?'':tieOk?' · <span class="tag ok">cierra con el arqueo</span>':' · <span class="tag bad">NO coincide con el arqueo</span>'}</span></div>
 <div class="card kpi"><b>${money(T.ch.Minorista.t)}</b><span>Minorista (${T.ch.Minorista.n})</span></div><div class="card kpi"><b>${money(T.ch.Mayorista.t)}</b><span>Mayorista (${T.ch.Mayorista.n})</span></div>
 <div class="card kpi"><b>${money(T.pend.t)}</b><span>Pendientes de cobro (${T.pend.n}) · no suman</span></div></div>
 <p class="sm">Por medio de pago: ${Object.keys(T.med).map(k=>esc(MET[k]||k)+' <b>'+money(T.med[k].t)+'</b> ('+T.med[k].n+')').join(' · ')||'—'}.</p>
 <p class="sm">Aparte, <b>no suman como venta</b>: anuladas ${T.anu.n} (${money(T.anu.t)}) · notas de crédito ${T.nc.n} (${money(T.nc.t)}).</p>
 <div class="cjflt noprint"><div><label for="cjf-ch">Canal</label><select id="cjf-ch" data-cjf="ch">${opt('','Todos',CJF.ch)}${opt('Minorista','Minorista',CJF.ch)}${opt('Mayorista','Mayorista',CJF.ch)}</select></div>
 <div><label for="cjf-st">Estado</label><select id="cjf-st" data-cjf="st">${opt('','Todos',CJF.st)}${opt('ok','Confirmada',CJF.st)}${opt('pendiente','Pendiente de cobro',CJF.st)}${opt('anulada','Anulada',CJF.st)}${opt('nc','Nota de crédito',CJF.st)}</select></div>
 <div><label for="cjf-med">Medio de pago</label><select id="cjf-med" data-cjf="med">${opt('','Todos',CJF.med)}${meds.map(m=>opt(m,MET[m]||m,CJF.med)).join('')}</select></div>
 <div><label for="cjf-vend">Vendedor / cajero</label><select id="cjf-vend" data-cjf="vend">${opt('','Todos',CJF.vend)}${users.map(u=>opt(u,u,CJF.vend)).join('')}</select></div>
 <div><label for="cjf-h1">Desde (hora)</label><input id="cjf-h1" type="time" data-cjf="h1" value="${esc(CJF.h1)}"></div><div><label for="cjf-h2">Hasta (hora)</label><input id="cjf-h2" type="time" data-cjf="h2" value="${esc(CJF.h2)}"></div>
 <div><label for="cjf-q">Buscar N.º, importe o cliente</label><input id="cjf-q" data-cjf="q" maxlength="40" autocomplete="off" placeholder="Ej.: 2-15 o 1020" value="${esc(CJF.q)}"></div>
 <div><button class="btn" data-act="cjfReset">Restablecer filtros</button></div></div>
 <p class="sm mut" aria-live="polite">Mostrando ${lim} de ${shown.length} operaciones${shown.length!==all.length?' (filtradas, de '+all.length+')':''}.</p>
 <div class="tw"><table class="cjtbl"><thead><tr><th>N.º</th><th>Hora</th><th>Canal</th><th>Cliente</th><th>Vendedor</th><th class="r">Ítems</th><th class="r">Desc.</th><th>Medio</th><th>Documento</th><th>Estado</th><th class="r">Total</th><th></th></tr></thead><tbody>`;
 const rows=[];for(let i=0;i<lim;i++){const x=shown[i];
  rows.push(`<tr tabindex="0" data-act="saleDet" data-id="${esc(x.id)}" ${ro?'data-ro="1"':''} aria-label="Ver detalle de la operación ${esc(x.n)}"><td data-l="N.º">${esc(x.n)}</td><td data-l="Hora">${hm(x.ts)}</td><td data-l="Canal">${saleChan(x)}</td><td data-l="Cliente">${esc(x.custName||'—')}</td><td data-l="Vendedor">${esc(saleSellerTxt(x)||'—')}</td><td class="r" data-l="Ítems">${(x.items||[]).length}</td><td class="r" data-l="Desc.">${saleDiscTotal(x)?'- '+money(saleDiscTotal(x)):'—'}</td><td data-l="Medio">${esc(salePayLabel(x))}${x.channel&&x.channel!=='local'?' · '+esc(x.channel):''}</td><td class="sm" data-l="Documento">${esc(saleDocTxt(x).split(' · ')[0])}</td><td data-l="Estado"><span class="tag ${saleStateCls(x)}">${esc(saleStateTxt(x))}</span></td><td class="r" data-l="Total">${money(x.total)}</td><td class="r acts"><button class="btn sm" data-act="saleDet" data-id="${esc(x.id)}" ${ro?'data-ro="1"':''}>Ver detalle</button>${!ro&&x.status==='pendiente'?`<button class="btn sm" data-act="paysale" data-id="${esc(x.id)}">Cobro</button>`:''}${!ro&&x.status==='ok'&&can('void')?`<button class="btn sm red" data-act="voidsale" data-id="${esc(x.id)}">Anular</button>`:''}</td></tr>`);}
 h+=(rows.join('')||'<tr><td colspan="12" class="mut">Sin ventas con estos filtros.</td></tr>')+`</tbody></table></div>`;
 if(lim<shown.length)h+=`<div class="row noprint" style="margin-top:.5rem"><button class="btn" data-act="cjfMore">Mostrar ${Math.min(CJ_PAGE,shown.length-lim)} más</button><button class="btn" data-act="cjfAll">Mostrar las ${shown.length}</button></div>`;
 return h;}
function cajaSalesCard(sess){const a=arqueoCalc(sess,arqInputs(sess));return `<div class="card" style="margin-top:1rem" id="cj-sales" data-sess="${esc(sess.id)}">${cjSalesHTML(sess,false,a.total)}</div>`;}
function cierreSalesOpen(c){const sess=S.sessions.find(x=>x.id===c.sessId);if(!sess)return toast('La sesión de este cierre ya no está en este equipo.',1);
 Object.assign(CJF,{ch:'',st:'',med:'',q:'',vend:'',h1:'',h2:'',n:CJ_PAGE});
 const w=modal('Ventas del turno · caja '+c.caja+' · '+fmtDT(c.ts),`<div id="cj-sales" data-sess="${esc(sess.id)}" data-ro="1" data-tie="${c.data.total}">${cjSalesHTML(sess,true,c.data.total)}</div>`,{wide:true,okText:'Cerrar',noCancel:true});
 return w;}
function cjRefresh(){const el=document.getElementById('cj-sales');if(!el)return;const sess=S.sessions.find(x=>x.id===el.dataset.sess);if(!sess)return;
 const ae=document.activeElement;const fid=ae&&ae.id&&ae.id.startsWith('cjf-')?ae.id:'';const ss=fid&&ae.selectionStart!==undefined?[ae.selectionStart,ae.selectionEnd]:null;
 const ro=!!el.dataset.ro;const tie=el.dataset.tie!==undefined?+el.dataset.tie:(ro?null:arqueoCalc(sess,arqInputs(sess)).total);
 el.innerHTML=cjSalesHTML(sess,ro,tie);
 if(fid){const n=document.getElementById(fid);if(n){n.focus();try{if(ss&&n.setSelectionRange)n.setSelectionRange(ss[0],ss[1]);}catch(e){}}}}
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset||t.dataset.cjf===undefined||t.tagName==='SELECT')return;CJF[t.dataset.cjf]=t.value;CJF.n=CJ_PAGE;cjRefresh();});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||t.dataset.cjf===undefined)return;CJF[t.dataset.cjf]=t.value;CJF.n=CJ_PAGE;cjRefresh();});
A.cjfReset=()=>{Object.assign(CJF,{ch:'',st:'',med:'',q:'',vend:'',h1:'',h2:'',n:CJ_PAGE});cjRefresh();};
A.cjfMore=()=>{CJF.n+=CJ_PAGE;cjRefresh();};
A.cjfAll=()=>{CJF.n=1e9;cjRefresh();};
