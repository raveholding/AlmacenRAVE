/* ===== V26.14 · Negocio de UN SOLO DUEÑO (mayorista) =====
   Lo que cambia respecto de Almacén RAVE (rubros por persona):
   · No hay rubros por persona: los productos se agrupan en CATEGORÍAS (sólo ordenan inventario, Vender y menú).
   · Ningún movimiento de dinero pide rubro: todo es del dueño. Por debajo se usa el concepto interno oculto «Caja del negocio»
     (el servidor exige un rubro en cada movimiento; así se cumple sin mostrarlo).
   · Arqueo de un solo dueño: ventas por canal (minorista / mayorista) y por medio, efectivo esperado vs. contado.
     No hay sueldo, merienda, impuestos por persona, reparto ni «caja de cada rubro».
   · Las cajas (operativas + principal) y los traspasos siguen igual; el dueño los mueve con cajas abiertas o cerradas. */
/* ---------- Configuración: tipo de negocio ---------- */
function bizCard(){const cur=ownerMode()?'owner':'rubros';const adm=!!user&&user.role==='admin';
 return`<div class="card" style="margin-bottom:1rem" id="biz-card"><h3>Tipo de negocio</h3>
 <p class="sm mut">Define cómo se ordena el dinero. No borra ni mueve datos: ventas, cierres sellados y movimientos anteriores quedan como estaban.</p>
 <div class="grid g2">${Object.entries(BIZ_TYPES).map(([k,t])=>`<label class="chk biz-opt ${cur===k?'on':''}" style="align-items:flex-start"><input type="radio" name="biz" value="${k}" ${cur===k?'checked':''} ${adm?'':'disabled'}> <span><b>${esc(t)}</b><br><span class="sm mut">${k==='owner'
  ?'El dinero es todo del dueño: no hay rubros por persona ni reparto entre socios. Los productos se agrupan en categorías. Cajas operativas + caja principal con traspasos.'
  :'Como Almacén RAVE: cada rubro es una persona (responsable), con su caja, sueldo del empleado a medias, impuesto que se separa y reparto de ganancia.'}</span></span></label>`).join('')}</div>
 ${adm?'<div class="row"><button class="btn gold" data-act="bizSave">Aplicar tipo de negocio</button></div>':'<p class="sm mut">Sólo el administrador lo cambia.</p>'}</div>`;}
A.bizSave=()=>{if(!user||user.role!=='admin')return toast('Sólo el administrador',1);const el=document.querySelector('input[name="biz"]:checked');const nv=el?el.value:'';
 if(!BIZ_TYPES[nv])return;const ov=ownerMode()?'owner':'rubros';if(nv===ov)return toast('Ya es ese tipo de negocio');
 if(openSess())return toast('Cerrá la caja abierta antes de cambiar el tipo de negocio (el arqueo cambia de forma).',1);
 confirmBox('Cambiar tipo de negocio',`De «${BIZ_TYPES[ov]}» a «${BIZ_TYPES[nv]}». No se borra nada: los cierres anteriores conservan su forma.${nv==='owner'?' Los rubros pasan a mostrarse como categorías de productos; los ingresos, egresos y pagos dejan de pedir rubro.':' Vuelven a pedirse los rubros en cada ingreso o egreso.'}`,
  ()=>{S.cfg.biz=nv;if(nv==='owner')ownerRubro();audit('TIPO_NEGOCIO',BIZ_TYPES[ov]+' → '+BIZ_TYPES[nv],{ent:'cfg',eid:'biz',old:ov,nw:nv});save();rerender();toast('Tipo de negocio aplicado');},'Cambiar');};
/* ---------- Configuración: categorías (sin responsable, sin reparto, sin impuesto) ---------- */
function catCardOwner(){const L=S.rubros.filter(r=>r.kind==='rubro');
 return`<div class="card"><h3>Categorías de productos</h3><p class="sm mut">Sólo ordenan el inventario, Vender y el menú. No tienen dueño ni caja propia: el dinero es todo del negocio.</p>
 ${L.map(r=>`<div class="rubrow"><div class="rubhead"><b class="sp"><i class="rdot" style="background:${safeColor(r.color)}"></i>${esc(r.name)} <span class="sm mut">${S.products.filter(p=>p.rubro===r.id&&!p.archived).length} productos</span></b><button class="btn sm" data-act="rubEdit" data-id="${r.id}" aria-label="Editar categoría ${esc(r.name)}">Editar</button><button class="btn sm red" data-act="rubDel" data-id="${r.id}" aria-label="Eliminar categoría ${esc(r.name)}">Eliminar</button></div></div>`).join('')||'<p class="mut">Todavía no hay categorías.</p>'}
 <button class="btn sm" data-act="rubAdd">+ Categoría</button></div>`;}
/* ---------- Caja: ingreso / egreso sin rubro ---------- */
function movModalOwner(type,pref){
 modal(type==='ingreso'?'Ingreso de efectivo':'Egreso de efectivo',`<p class="sm mut">${type==='ingreso'?'Suma efectivo a esta caja.':'Resta efectivo de esta caja (gastos, retiros, pagos).'} Para pasar dinero a otra caja o a la caja principal usá <b>Traspasar fondos</b>.</p>
 <label for="mv-c">Motivo / concepto</label><input id="mv-c" maxlength="120" placeholder="${type==='ingreso'?'Ej.: aporte de cambio':'Ej.: flete, limpieza, retiro del dueño'}" autocomplete="off" value="${esc(pref||'')}">
 <label for="mv-a">Importe ($)</label>${numIn('mv-a',0,'0')}`,{okText:'Guardar',onOk:w=>{const e=addMov(type,ownerRubro(),val('mv-c'),cents(val('mv-a')));if(e){w._err(e);return false;}toast('Movimiento guardado');rerender();}});}
/* ---------- Arqueo de un solo dueño ---------- */
function ownChan(a){const o={minorista:{n:0,t:0},mayorista:{n:0,t:0}};
 (S.sales||[]).filter(s=>s.sessId===a.sessId&&s.status==='ok').forEach(s=>{const k=s.wch==='mayorista'?'mayorista':'minorista';o[k].n++;o[k].t+=s.total;});return o;}
function ownCats(a){return S.rubros.filter(r=>r.kind==='rubro'||r.kind==='archivado').map(r=>({name:r.name,sold:(a.rub[r.id]||{}).sold||0,profit:(a.rub[r.id]||{}).profit||0})).filter(x=>x.sold>0).sort((x,y)=>y.sold-x.sold);}
function ownerTablesHTML(a){const ch=ownChan(a),cv=can('view_cost');const cats=ownCats(a);
 return`<h3>Ventas del turno</h3><div class="tw"><table><thead><tr><th>Canal</th><th class="r">Ventas</th><th class="r">Importe</th></tr></thead><tbody>
 <tr><td>Minorista</td><td class="r">${ch.minorista.n}</td><td class="r">${money(ch.minorista.t)}</td></tr>
 <tr><td>Mayorista</td><td class="r">${ch.mayorista.n}</td><td class="r">${money(ch.mayorista.t)}</td></tr>
 <tr><td><b>Total</b></td><td class="r"><b>${a.count}</b></td><td class="r"><b>${money(a.total)}</b></td></tr></tbody></table></div>
 <h3 style="margin-top:1rem">Por medio de pago</h3><div class="tw"><table><thead><tr><th>Medio</th><th class="r">Cobros</th><th class="r">Importe</th><th class="r">Comisión</th></tr></thead><tbody>
 ${Object.keys(a.byMethod).map(m=>{const x=a.byMethod[m];return`<tr><td>${esc(MET[m]||m)}${m==='fiado'?' <span class="sm mut">(no entró a caja)</span>':''}</td><td class="r">${x.n}</td><td class="r">${money(x.gross)}</td><td class="r">${x.fee?'- '+money(x.fee):'—'}</td></tr>`;}).join('')||'<tr><td colspan="4" class="mut">Sin ventas.</td></tr>'}
 <tr><td><b>Cobrado real</b></td><td></td><td class="r"><b>${money(a.cobrado)}</b></td><td></td></tr></tbody></table></div>
 <h3 style="margin-top:1rem">Efectivo de esta caja</h3><div class="tw"><table><tbody>
 <tr><td>Apertura</td><td class="r">${money(a.opening)}</td></tr><tr><td>+ Ventas en efectivo</td><td class="r">${money(a.cashSales)}</td></tr>
 <tr><td>+ Ingresos</td><td class="r">${money(a.ing)}</td></tr><tr><td>− Egresos</td><td class="r">- ${money(a.egr)}</td></tr>
 ${a.tin||a.tout?`<tr><td>+ Traspasos recibidos</td><td class="r">${money(a.tin)}</td></tr><tr><td>− Traspasos enviados</td><td class="r">- ${money(a.tout)}</td></tr>`:''}
 <tr><td><b>= Efectivo esperado</b></td><td class="r"><b>${money(a.expectedCash)}</b></td></tr>
 ${a.declared!==null&&a.declared!==undefined?`<tr><td>Contado</td><td class="r">${money(a.declared)}</td></tr><tr><td><b>Diferencia</b></td><td class="r ${a.diff<0?'neg':''}"><b>${a.diff===0?'sin diferencia':(a.diff>0?'sobrante ':'faltante ')+money(Math.abs(a.diff))}</b></td></tr>`:''}
 </tbody></table></div>
 ${cats.length?`<h3 style="margin-top:1rem">Por categoría (informativo)</h3><div class="tw"><table><thead><tr><th>Categoría</th><th class="r">Vendió</th>${cv?'<th class="r">Ganancia bruta</th>':''}</tr></thead><tbody>${cats.map(c=>`<tr><td>${esc(c.name)}</td><td class="r">${money(c.sold)}</td>${cv?`<td class="r">${money(c.profit)}</td>`:''}</tr>`).join('')}</tbody></table></div>`:''}`;}
function buildReportOwner(a,dayKey,who,inp){const L=[];const P=(t,cls)=>L.push({t,cls:cls||''});const ch=ownChan(a);
 P(dmy(dayKey)+' '+DIAS[dowOfKey(dayKey)]+' cerró '+who,'h');P('');
 P('VENTAS TOTAL : '+money(a.total)+' ('+a.count+' venta'+(a.count===1?'':'s')+')','h');
 P('  Minorista : '+money(ch.minorista.t)+' ('+ch.minorista.n+')');P('  Mayorista : '+money(ch.mayorista.t)+' ('+ch.mayorista.n+')');P('');
 Object.keys(a.byMethod).filter(m=>m!=='fiado').forEach(m=>{const x=a.byMethod[m];P((MET[m]||m)+' '+money(x.gross)+(x.n>1?' ('+x.n+')':''));if(x.fee>0)P('  comisión - '+money(x.fee)+' · neto '+money(x.gross-x.fee));});
 P('COBRADO REAL (dinero que entró) : '+money(a.cobrado),'h');
 if(a.aCtaCte>0)P('A CUENTA CORRIENTE (deuda de clientes, NO entró a caja) : '+money(a.aCtaCte),'w');
 if(a.vueltoTot>0)P('Vuelto entregado en el turno : '+money(a.vueltoTot)+' (ya descontado del efectivo)');
 if(a.pend.n)P('⚠ Cobros digitales pendientes de confirmar: '+a.pend.n+' · '+money(a.pend.total),'w');
 if(a.detMissing)P('⚠ Cobros digitales sin el detalle del comprobante: '+a.detMissing,'w');
 P('');P('EFECTIVO DE LA CAJA :','h');P('  Apertura : '+money(a.opening));P('  Ventas en efectivo : '+money(a.cashSales));
 if(a.ing)P('  Ingresos : '+money(a.ing));if(a.egr)P('  Egresos : - '+money(a.egr));
 if(a.tin)P('  Traspasos recibidos : '+money(a.tin));if(a.tout)P('  Traspasos enviados : - '+money(a.tout));
 P('  ESPERADO : '+money(a.expectedCash),'h');
 if(a.declared!==null)P('  CONTADO : '+money(a.declared)+' · '+(a.diff===0?'sin diferencia':(a.diff>0?'sobrante ':'faltante ')+money(Math.abs(a.diff))),a.diff<0?'w':'h');
 if(a.movs.length){P('');P('MOVIMIENTOS :','h');a.movs.forEach(m=>P('  '+(m.type==='ingreso'?'+ ':'- ')+money(m.amount)+' · '+m.concept));}
 if(inp.detailAll){ownCats(a).forEach(c=>{P('');P(c.name+' — vendido '+money(c.sold),'h');});}
 return L;}
function arqOwnerHTML(s){const d=arqDraft(s);
 return`<div class="row"><h1 class="sp">Arqueo y cierre</h1><span class="tag warn">Vista previa · todavía no cierra la caja</span></div>
 <div class="grid g2" style="align-items:start"><div class="card"><h3>Efectivo contado</h3>
 <p class="sm mut">Negocio de un solo dueño: no hay sueldo, impuestos ni reparto por persona. Los gastos y retiros se cargan como <b>egresos</b> en Caja; el dinero que pasa a la caja principal, con <b>Traspasar fondos</b>.</p>
 <label for="aq-d">Efectivo contado en caja ($)</label><input id="aq-d" data-aq="declared" inputmode="decimal" placeholder="Escribí el número" value="${esc(d.declared||'')}" autocomplete="off">
 <label class="chk"><input type="checkbox" data-aq="detailAll" ${d.detailAll?'checked':''}> Incluir ventas por categoría en el texto</label>
 <label class="chk"><input type="checkbox" data-aq="mono" ${d.mono!==false?'checked':''}> Formato monoespaciado de WhatsApp (\`\`\`)</label>
 <label for="aq-n">Observaciones del cierre</label><input id="aq-n" data-aq="notes" maxlength="200" value="${esc(d.notes||'')}"></div>
 <div><div class="card" id="arq-tabs"></div><div class="card"><div class="row"><h3 class="sp">Texto para WhatsApp</h3></div><div class="rep" id="arq-prev" aria-live="polite"></div><div id="arq-warn"></div>
 <div class="row" style="margin-top:.8rem"><button class="btn" data-act="arqCopy">Copiar</button><button class="btn" data-act="arqWa">WhatsApp</button><button class="btn" data-act="arqWeb">WhatsApp Web</button><button class="btn" data-act="arqMail">Correo</button></div>
 <button class="btn gold" style="width:100%;margin-top:.8rem;min-height:52px" data-act="arqClose">Confirmar cierre de caja</button></div></div></div>`;}
/* ---------- aviso en la demo: qué tipo de negocio se está viendo ---------- */
function bizDemoBanner(){if(IS_CLIENT||!user||user.role!=='admin')return'';
 return`<div class="card" style="margin-bottom:1rem"><div class="row"><span class="sp">Demo: estás viendo un <b>${ownerMode()?'mayorista de un solo dueño':'almacén con rubros por responsable'}</b>.</span><button class="btn sm" data-act="nav" data-id="config">Cambiar tipo de negocio</button></div></div>`;}
