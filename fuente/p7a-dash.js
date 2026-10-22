/* ===== Resumen · Dashboard Analytics (primera pantalla, antes de Vender) ===== */
const dbF={per:'7',met:'',doc:'',rub:''};
function dbRange(){const t=dkey(now());if(dbF.per==='hoy')return[t,t];if(dbF.per==='ayer'){const y=addDays(t,-1);return[y,y];}if(dbF.per==='7')return[addDays(t,-6),t];if(dbF.per==='30')return[addDays(t,-29),t];return['0000-00-00','9999-99-99'];}
const dbPerTxt={hoy:'Hoy',ayer:'Ayer','7':'Últimos 7 días','30':'Últimos 30 días',todo:'Todo el historial'};
function dbData(){const[a,b]=dbRange();
 const sales=S.sales.filter(s=>s.status==='ok'&&dkey(s.ts)>=a&&dkey(s.ts)<=b&&(!dbF.met||s.method===dbF.met||salePays(s).some(pp=>pp.m===dbF.met))&&(!dbF.doc||(dbF.doc==='arca'?s.doc!=='ticket_interno':s.doc==='ticket_interno')));
 const rows=[];sales.forEach(s=>s.items.forEach(it=>{if(dbF.rub&&it.rubro!==dbF.rub)return;rows.push({s,it});}));
 return{a,b,sales,rows};}
const sumT=a=>a.reduce((x,s)=>x+s.total,0);
function dbBars(items,fmt,color){const mx=Math.max(1,...items.map(i=>i[1]));return `<div class="tw"><table><tbody>${items.map(([l,v,x])=>`<tr><td style="white-space:nowrap">${esc(l)}</td><td style="width:50%"><div class="bar" aria-hidden="true"><i style="width:${Math.round(v/mx*100)}%;${color?'background:'+color:''}"></i></div></td><td class="r">${fmt(v)}</td>${x!==undefined?`<td class="r mut">${x}</td>`:''}</tr>`).join('')}</tbody></table></div>`;}
reg('inicio','Resumen','home',null,()=>{const D=dbData();const cv=can('view_cost');const today=dkey(now());
 const tot=sumT(D.sales),n=D.sales.length;const disc=D.sales.reduce((a,s)=>a+s.items.reduce((x,i)=>x+(i.disc||0),0),0);
 const prof=D.rows.reduce((a,r)=>a+lineTotal(r.it)-lineCost(r.it),0)-D.sales.reduce((a,s)=>a+(s.fee||0),0);
 const days=[];for(let k=D.a<addDays(today,-29)?addDays(today,-29):D.a;k<=D.b&&days.length<31;k=addDays(k,1))days.push(k);const d7=days.slice(-14);
 const byDay=d7.map(k=>[dmy(k)+' '+DIAS[dowOfKey(k)].slice(0,3),sumT(S.sales.filter(s=>s.status==='ok'&&dkey(s.ts)===k))]);
 const byMet={};D.sales.forEach(s=>salePays(s).forEach(pp=>{byMet[pp.m]=(byMet[pp.m]||0)+pp.a;}));
 const byRub={};D.rows.forEach(r=>byRub[r.it.rubro]=(byRub[r.it.rubro]||0)+lineTotal(r.it));const totR=Object.values(byRub).reduce((a,b)=>a+b,0);
 const byProd={};D.rows.forEach(r=>{const e=byProd[r.it.name]||(byProd[r.it.name]={q:0,t:0});e.q+=r.it.qty;e.t+=lineTotal(r.it);});
 const top=Object.entries(byProd).sort((a,b)=>b[1].t-a[1].t).slice(0,8);
 const low=S.products.filter(p=>p.active&&!isKit(p)&&p.stock<=5).sort((a,b)=>a.stock-b.stock).slice(0,8);
 const sess=openSess();const oldOpen=sess&&dkey(sess.openedAt)!==today;const pend=S.sales.filter(s=>s.status==='pendiente');
 const soc=S.customers.filter(c=>c.status!=='baja');const newSoc=soc.filter(c=>dkey(c.ts)>=D.a&&dkey(c.ts)<=D.b).length;
 const stamps=S.loyalty.ledger.filter(e=>e.kind==='stamp'&&dkey(e.ts)>=D.a&&dkey(e.ts)<=D.b).length;const redeem=S.loyalty.ledger.filter(e=>e.kind==='redeem'&&dkey(e.ts)>=D.a&&dkey(e.ts)<=D.b).length;
 const cpUse=S.coupons.reduce((a,c)=>a+c.uses.filter(u=>dkey(u.ts)>=D.a&&dkey(u.ts)<=D.b).length,0);
 const deuda=S.customers.reduce((a,c)=>a+Math.max(0,debtOf(c.id)),0);const bday=soc.filter(c=>isBirthWeek(c)&&hasComm(c)).length;
 const reqs=S.orderReqs.filter(o=>dkey(o.ts)>=D.a&&dkey(o.ts)<=D.b).length;
 const sel=(id,opts,cur)=>`<select id="${id}" aria-label="${id}" style="max-width:190px">${opts.map(([v,t])=>`<option value="${v}" ${cur===v?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
 return `<div class="row"><h1 class="sp">Resumen del negocio</h1><span class="sm mut">Actualizado ${fmtDT(now())} · zona America/Argentina/Salta</span></div>
 ${typeof bizDemoBanner==='function'?bizDemoBanner():''}
 <div class="card noprint" style="margin-bottom:1rem"><div class="row"><b>Filtros</b>${sel('dbp',Object.entries(dbPerTxt),dbF.per)}${sel('dbm',[['','Todos los medios'],...Object.entries(MET)],dbF.met)}${sel('dbd',[['','Con y sin ARCA'],['arca','Sólo con ARCA'],['int','Sólo internos']],dbF.doc)}${sel('dbr',[['','Todos los '+RWs()],...S.rubros.filter(r=>r.kind==='rubro').map(r=>[r.id,r.name])],dbF.rub)}<button class="btn sm" data-act="dbReset">Restablecer</button>
  <span class="sp"></span><button class="btn sm gold" data-act="nav" data-id="vender">Ir a Vender →</button></div><p class="sm mut" style="margin:.4rem 0 0">Período: <b>${dbPerTxt[dbF.per]}</b>${D.a!=='0000-00-00'?' ('+dmy(D.a)+' a '+dmy(D.b)+')':''} · sólo ventas confirmadas (sin anuladas ni cobros pendientes) · ${dbF.doc?(dbF.doc==='arca'?'sólo comprobantes con ARCA':'sólo tickets internos'):'comprobantes con y sin ARCA, sin mezclar en los totales de ARCA'}</p></div>
 ${oldOpen?`<div class="errbox">La caja se abrió el ${dmy(dkey(sess.openedAt))} y sigue abierta: hay días con ventas sin cierre. <a href="#panel/arqueo">Ir al arqueo</a></div>`:''}
 <div class="grid g4"><div class="card kpi"><b>${money(tot)}</b><span>Ventas netas (${n} operaciones)</span></div><div class="card kpi"><b>${money(n?Math.round(tot/n):0)}</b><span>Ticket promedio = ventas ÷ operaciones</span></div>${cv?`<div class="card kpi"><b>${money(prof)}</b><span>Margen bruto estimado (ventas − costo − comisiones; sin impuestos ni sueldos). ${IS_CLIENT?'Con los costos que cargaste':'Costos de la demo: de ejemplo'}</span></div>`:''}<div class="card kpi"><b>${money(disc)}</b><span>Descuentos otorgados (cupones y membresías)</span></div></div>
 <div class="grid g4" style="margin-top:1rem"><div class="card kpi"><b>${newSoc}</b><span>Socios nuevos del Club · total ${soc.length}</span></div><div class="card kpi"><b>${stamps}</b><span>Sellos entregados · ${redeem} premios canjeados</span></div><div class="card kpi"><b>${cpUse}</b><span>Cupones usados</span></div><div class="card kpi"><b>${money(deuda)}</b><span>Deuda en cuenta corriente (total actual)</span></div></div>
 <div class="grid g2" style="margin-top:1rem"><div class="card"><h3>Evolución diaria</h3>${days.length?dbBars(byDay,money):'<p class="mut">Sin datos suficientes.</p>'}<p class="sm mut">Ventas netas por día (hasta 14 días). La tabla es el gráfico: mismos números.</p></div>
 <div class="card"><h3>Participación por ${RW()}</h3>${totR?dbBars(S.rubros.filter(r=>byRub[r.id]).map(r=>[r.name,byRub[r.id],numAR(byRub[r.id]/totR*100,1)+' %']),money,'#7b2d3b'):'<p class="mut">Sin datos suficientes: no hay ventas en este filtro.</p>'}<p class="sm mut">Participación = ventas del rubro ÷ ventas totales del filtro × 100.</p></div></div>
 <div class="grid g2" style="margin-top:1rem"><div class="card"><h3>Productos más vendidos</h3>${top.length?`<div class="tw"><table><thead><tr><th>Producto</th><th class="r">Unid.</th><th class="r">Ventas</th></tr></thead><tbody>${top.map(([nm,v])=>`<tr><td>${esc(nm)}</td><td class="r">${numAR(v.q,3)}</td><td class="r">${money(v.t)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="mut">Sin datos suficientes.</p>'}</div>
 <div class="card"><h3>Por medio de pago</h3>${Object.keys(byMet).length?dbBars(Object.entries(byMet).map(([k,v])=>[MET[k]||k,v,numAR(v/tot*100,1)+' %']),money):'<p class="mut">Sin datos suficientes.</p>'}</div></div>
 <div class="grid g3" style="margin-top:1rem"><div class="card"><h3>Alertas</h3>${low.length?low.map(p=>`<div class="sm ${p.stock<0?'negs':''}">${p.stock<0?'Stock NEGATIVO':'Stock bajo'}: ${esc(p.name)}${p.sub?' ('+esc(p.sub)+')':''} · ${esc(stockTxt(p))}</div>`).join(''):'<p class="mut sm">Sin alertas de stock.</p>'}${pend.length?`<div class="sm neg">${pend.length} cobro(s) digital(es) pendiente(s).</div>`:''}${bday?`<div class="sm">🎂 ${bday} socio(s) de cumpleaños esta semana (con consentimiento de promociones).</div>`:''}</div>
 <div class="card"><h3>Menú digital</h3><p class="sm">Pedidos por WhatsApp solicitados desde el menú en el período: <b>${reqs}</b></p><p class="sm mut">Son solicitudes, no ventas: la venta se registra al cobrar en el mostrador.</p><a class="btn sm" href="#menu" target="_blank">Ver menú público</a></div>
 <div class="card"><h3>Acciones</h3><div class="row"><button class="btn" data-act="nav" data-id="vender">Vender</button><button class="btn" data-act="nav" data-id="caja">Caja ${sess?'(abierta)':'(abrir)'}</button><button class="btn" data-act="nav" data-id="fidel">Sellos</button></div></div></div>
 <p class="sm mut" style="margin-top:1rem">${IS_CLIENT?'Los costos y el stock son los que cargaste; las integraciones externas están pendientes de configuración.':'Demo: costos, stock y ventas de ejemplo; las integraciones externas están simuladas y rotuladas.'}</p>`;},
 ()=>{[['dbp','per'],['dbm','met'],['dbd','doc'],['dbr','rub']].forEach(([id,k])=>{const e=$('#'+id);if(e)e.addEventListener('change',()=>{dbF[k]=e.value;rerender();});});},'Resumen');
A.dbReset=()=>{dbF.per='7';dbF.met='';dbF.doc='';dbF.rub='';rerender();};
