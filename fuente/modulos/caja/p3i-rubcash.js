/* ===== V26.11 · Caja y cierre por rubro (cada rubro es una persona) =====
   Tablas claras de: vendió · ganancia · movimientos · efectivo físico del rubro, y la liquidación
   (sueldo a medias → impuesto editable → ganancia). Sólo muestra: el cálculo vive en arqueoCalc(). */
function rcRows(a){return (a.reparte||[]).concat(a.otros||[]);}
function rcTableHTML(a){const R=rcRows(a);if(!R.length)return'<p class="mut">No hay rubros cargados.</p>';
 const mv=r=>(r.ing||r.egr)?`${r.ing?'<span class="ok">+ '+money(r.ing)+'</span>':''}${r.ing&&r.egr?'<br>':''}${r.egr?'<span class="neg">- '+money(r.egr)+'</span>':''}`:'—';
 const tr=r=>`<tr><td><b>${esc(r.owner||r.name)}</b><div class="sm mut">${esc(r.name)}</div></td><td class="r"><b class="${(r.fis||0)<0?'neg':''}">${money(r.fis||0)}</b><div class="sm mut">cobró en efectivo ${money(r.cash||0)}${r.dig?'<br>digital '+money(r.dig):''}${r.fia?'<br>cta. cte. '+money(r.fia):''}${r.ccob?'<br>cobró deuda de cta. cte. '+money(r.ccob):''}</div></td><td class="r">${money(r.sold)}</td><td class="r">${money(r.profit)}</td><td class="r">${mv(r)}</td></tr>`;
 const tot=R.reduce((o,r)=>{o.sold+=r.sold;o.profit+=r.profit;o.fis+=r.fis||0;return o;},{sold:0,profit:0,fis:0});
 return `<div class="tw"><table><thead><tr><th>Rubro / persona</th><th class="r">Caja física del rubro</th><th class="r">Vendió</th><th class="r">Ganancia de ventas</th><th class="r">Ingresos / egresos (caja física)</th></tr></thead><tbody>${R.map(tr).join('')}<tr><td><b>Total rubros</b></td><td class="r"><b>${money(tot.fis)}</b></td><td class="r">${money(tot.sold)}</td><td class="r">${money(tot.profit)}</td><td></td></tr></tbody></table></div>
 <p class="sm mut">«Caja física del rubro» = efectivo que cobró + cobros de cuenta corriente de lo que fió + ingresos − egresos al rubro${a.paid?' − su parte del sueldo y gastos pagados de la caja':''}. Sumado al fondo de apertura y traspasos (${money(a.fondo||0)}) da el efectivo esperado en el cajón: <b>${money(a.expectedCash)}</b>${a.resto?` <span class="neg">(diferencia sin rubro: ${money(a.resto)})</span>`:''}.</p>`;}
function rcLiqHTML(a){if(!(a.reparte||[]).length)return'<p class="mut">Marcá en Configuración qué rubros reparten (los socios) para ver la liquidación.</p>';
 const rp=a.reparte;const row=(l,f,cls)=>`<tr class="${cls||''}"><td>${l}</td>${rp.map(r=>`<td class="r">${f(r)}</td>`).join('')}</tr>`;
 return `<div class="tw"><table><thead><tr><th>Paso</th>${rp.map(r=>`<th class="r">${esc(r.owner||r.name)}</th>`).join('')}</tr></thead><tbody>
 ${row('1 · Ganancia de sus ventas',r=>money(r.base))}
 ${row('2 · Sueldo'+(a.empName?' de '+esc(a.empName):'')+' (a medias'+(a.hours?' · '+numAR(a.hours)+' hs × '+money(a.rate):'')+')',r=>'- '+money(r.sueldo))}
 ${row('3 · Gastos (a medias)',r=>'- '+money(r.gastos))}
 ${row('4 · Impuestos del día (total '+money(rp.reduce((s,r)=>s+r.tax,0))+', a medias)',r=>'- '+money(r.tax)+(r.falta>0?'<div class="sm neg">no alcanza: faltan '+money(r.falta)+'</div>':''))}
 <tr><td><b>5 · Ganancia total a dividir</b> (ventas − sueldo − gastos − impuestos)</td><td class="r" colspan="${rp.length}"><b class="${a.netSum<0?'neg':''}">${money(a.netSum)}</b></td></tr>
 ${row('<b>6 · Le corresponde a cada uno (la mitad)</b>',r=>`<b class="${r.final<0?'neg':''}">${money(r.final)}</b>`,'tot')}
 </tbody></table></div>`;}
function arqTablesHTML(a){const ac=typeof accArqHTML==='function'?accArqHTML(a&&a.accts):'';if(a&&a.owner&&typeof ownerTablesHTML==='function')return ownerTablesHTML(a)+ac;return ac+ `<h3>Por rubro</h3>${rcTableHTML(a)}<h3 style="margin-top:1rem">Liquidación</h3>${rcLiqHTML(a)}`;}
/* tarjeta viva en Caja: cuánto tiene físicamente cada rubro ahora */
function rubCashCard(s){if(!s)return'';let a;try{a=arqueoCalc(s,arqInputs(s));}catch(e){return'';}
 return `<div class="card"><h3>Caja de cada rubro (ahora)</h3>${rcTableHTML(a)}<p class="sm mut">Un <b>ingreso</b> entra a la <b>caja física</b> del rubro que elijas y un <b>egreso</b> sale de ella (y del cajón). <b>No cambian lo vendido, la venta del mostrador ni la ganancia.</b> Ejemplo: si Juan le paga $1.000 a Nico con plata de la caja, se hace un egreso de $1.000 del rubro de Juan y un ingreso de $1.000 al rubro de Nico.</p></div>`;}
A.profitMode=el=>{if(!can('config'))return toast('Sólo el administrador',1);const v=el.value==='each'?'each':'pool';if((S.cfg.profitMode||'pool')===v)return;S.cfg.profitMode=v;audit('CONFIG_GANANCIA',v==='pool'?'se divide a partes iguales':'cada uno la suya');save();rerender();};
document.addEventListener('change',e=>{const t=e.target;if(t&&t.id==='aq-pm')A.profitMode(t);});
