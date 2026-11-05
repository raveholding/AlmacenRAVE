/* ===== V26.49 · 4.33 · Recargo o descuento por medio de pago (administrable por el dueño) =====
   Cada medio (efectivo, débito, crédito, transferencia, QR, MODO) puede tener un RECARGO o un DESCUENTO,
   en porcentaje o en monto fijo. Lo edita sólo el administrador (equipo y servidor: documento cfg/payadj).
   Cálculo (función pura payAdjCalc, la misma en pantalla y al cobrar):
     base = subtotal − beneficio (cupón/membresía);  cada parte del cobro (simple o mixto) recibe su ajuste;
     porcentaje en puntos básicos (10 % = 1000) con redondeo al centavo mitad hacia arriba;
     un descuento nunca deja una parte en negativo; la parte a cuenta corriente no lleva ajuste;
     si hay cupón/membresía, el DESCUENTO por medio de pago no se suma salvo «acumular» (el recargo sí se aplica).
   Guardado: pays[] = {m, a: importe final, b: base, adj}; sale.sub, sale.adj[] (foto de la regla) e items[].pa
   (ajuste repartido por línea con el método del mayor resto) → lineTotal, rubros, arqueo y ARCA cierran al centavo.
   Aviso legal (no bloquea): Ley 25.065 art. 37 inc. c (diferencias de precio contado / tarjeta) [VERIFICAR con asesor]. */
const PA_METHODS=['efectivo','debito','credito','transferencia','qr','modo'];
const PA_LEGAL=['debito','credito','transferencia','qr','modo'];
function paConf(){const c=(typeof S!=='undefined'&&S&&S.payadj)||null;return c&&typeof c==='object'?c:{on:false,stack:false,rules:{}};}
function paRuleOk(r){return !!(r&&r.v>0&&Number.isInteger(r.v)&&(r.sign===1||r.sign===-1)&&(r.kind==='pct'||r.kind==='fixed')&&(r.kind!=='pct'||r.v<=5000));}
function paOn(){const c=paConf();return !!c.on&&Object.values(c.rules||{}).some(paRuleOk);}
const paRound=(b,v)=>Math.floor((b*v+5000)/10000);           /* b y v enteros ≥ 0: redondeo mitad hacia arriba */
function paAmt(r,b){if(!paRuleOk(r)||!(b>0))return 0;let a=r.kind==='pct'?paRound(b,r.v):r.v;if(r.sign<0)a=Math.min(a,b);return r.sign*a;}
function paLabelOf(m,r){const met=(typeof MET!=='undefined'&&MET[m])||m;const v=r.kind==='pct'?String(r.v/100).replace('.',',')+' %':(typeof money==='function'?money(r.v):'$ '+r.v/100);return(r.sign>0?'Recargo ':'Descuento ')+met+' '+v;}
/* PURA. parts=[{m,b}] (b = base en centavos); rules={medio:{sign,kind,v,ver}}; o={ben,stack,fiado} */
function payAdjCalc(parts,rules,o){o=o||{};const out={pays:[],adj:[],total:0,skip:[]};
 for(const p of parts){let r=(rules||{})[p.m];if(!paRuleOk(r)||(p.m==='fiado'&&!o.fiado))r=null;
  if(r&&r.sign<0&&o.ben&&!o.stack){out.skip.push(p.m);r=null;}
  const amt=paAmt(r,p.b);out.pays.push({m:p.m,b:p.b,adj:amt,a:p.b+amt});out.total+=p.b+amt;
  if(amt)out.adj.push({m:p.m,sign:r.sign,kind:r.kind,v:r.v,ver:r.ver||1,base:p.b,amt,label:paLabelOf(p.m,r)});}
 return out;}
/* reparte un importe (con signo) entre las líneas en proporción a su importe (mayor resto) */
function paAlloc(bases,amt){const T=bases.reduce((a,b)=>a+Math.max(0,b),0);if(!amt||!T)return bases.map(()=>0);
 const sg=Math.sign(amt),A=Math.abs(amt);const raw=bases.map(b=>A*Math.max(0,b)/T);const fl=raw.map(Math.floor);let rest=A-fl.reduce((a,b)=>a+b,0);
 const ord=raw.map((x,i)=>[x-fl[i],i]).sort((a,b)=>b[0]-a[0]||a[1]-b[1]);for(let k=0;k<rest;k++)fl[ord[k%ord.length][1]]++;return fl.map(x=>sg*x);}

/* ---- ayudas de pantalla (Vender / cobro) ---- */
function paCalcFor(parts){const c=paConf();if(!paOn())return{pays:parts.map(p=>({m:p.m,b:p.b,adj:0,a:p.b})),adj:[],total:parts.reduce((a,p)=>a+p.b,0),skip:[]};
 return payAdjCalc(parts,c.rules,{ben:typeof posBen==='function'&&posBen().disc>0,stack:!!c.stack,fiado:!!c.fiado});}
function posFinal(m){const b=posTotal();return paCalcFor([{m:m||pos.method,b}]).total;}
function paFinalOf(m,b){return paCalcFor([{m,b}]).pays[0].a;}
function paChipTag(m){const r=paConf().on?paConf().rules[m]:null;if(!paRuleOk(r))return'';return ' '+(r.sign>0?'+':'−')+(r.kind==='pct'?String(r.v/100).replace('.',',')+'%':money(r.v));}
function paRowsHTML(R){return R.adj.map(a=>`<div class="row sm" style="color:${a.amt<0?'var(--ok)':'var(--bad,#b42318)'}"><span class="sp">${esc(a.label)}</span><b>${a.amt<0?'− ':'+ '}${money(Math.abs(a.amt))}</b></div>`).join('')+(R.skip.length?`<div class="warnbox sm">El descuento por ${esc(R.skip.map(m=>MET[m]||m).join(', '))} no se suma al cupón o membresía.</div>`:'');}

/* ---- Configuración → Recargos y descuentos por medio de pago (sólo administrador) ---- */
function paCfgCard(){if(!isAdm())return'';const c=paConf();const R=c.rules||{};
 const row=m=>{const r=R[m]||{};const t=paRuleOk(r)?(r.sign>0?'rec':'desc'):'no';
  return `<tr><td><b>${esc(MET[m]||m)}</b></td><td><select id="pa-t-${m}" aria-label="Ajuste para ${esc(MET[m]||m)}"><option value="no" ${t==='no'?'selected':''}>Sin ajuste</option><option value="rec" ${t==='rec'?'selected':''}>Recargo</option><option value="desc" ${t==='desc'?'selected':''}>Descuento</option></select></td>
  <td><input id="pa-v-${m}" inputmode="decimal" autocomplete="off" style="width:7em" placeholder="0" value="${paRuleOk(r)?esc(r.kind==='pct'?String(r.v/100).replace('.',','):pesosStr(r.v)):''}" aria-label="Valor para ${esc(MET[m]||m)}"></td>
  <td><select id="pa-k-${m}" aria-label="Porcentaje o monto para ${esc(MET[m]||m)}"><option value="pct" ${r.kind!=='fixed'?'selected':''}>%</option><option value="fixed" ${r.kind==='fixed'?'selected':''}>$ fijo</option></select></td></tr>`;};
 return `<div class="card" id="pa-cfg" style="margin-top:1rem"><h3 style="margin-top:0">Recargos y descuentos por medio de pago</h3>
 <p class="sm mut">Se aplican al cobrar, sobre el total después del cupón o la membresía. En un cobro mixto, cada medio lleva su propio ajuste. La parte a cuenta corriente no lleva ajuste. Sólo el administrador los cambia y cada cambio queda en Auditoría.</p>
 <label class="chk"><input type="checkbox" id="pa-on" ${c.on?'checked':''}> Aplicar recargos y descuentos por medio de pago</label>
 <div class="tw"><table><thead><tr><th>Medio</th><th>Ajuste</th><th>Valor</th><th>Tipo</th></tr></thead><tbody>${PA_METHODS.map(row).join('')}</tbody></table></div>
 <label class="chk"><input type="checkbox" id="pa-st" ${c.stack?'checked':''}> Sumar el descuento por medio de pago al cupón o membresía (si no, se aplica sólo el beneficio)</label>
 <div class="warnbox sm"><b>Aviso legal:</b> la Ley 25.065 (art. 37 inc. c) prohíbe cobrar distinto precio por pagar con tarjeta que en efectivo en un solo pago, y la Justicia de Salta la sigue aplicando (2026). Antes de cargar recargos a débito, crédito, QR o transferencia, consultá con tu asesor. [VERIFICAR]</div>
 ${c.legalAck?`<p class="sm mut">Aviso leído por ${esc(c.legalAck.user)} el ${fmtDT(c.legalAck.ts)}.</p>`:''}
 <div class="row"><button class="btn gold" data-act="paSave">Guardar</button></div></div>`;}
A.paSave=()=>{if(!isAdm())return toast('Sólo el administrador cambia los recargos y descuentos.',1);
 const c=JSON.parse(JSON.stringify(paConf()));c.rules=c.rules||{};const prev=JSON.stringify({on:c.on,stack:c.stack,rules:c.rules});const nr={};let legal=false;
 for(const m of PA_METHODS){const t=val('pa-t-'+m);if(t==='no')continue;const k=val('pa-k-'+m);const raw=String(val('pa-v-'+m)||'').trim();
  if(!raw)return toast('Falta el valor de '+(MET[m]||m)+'.',1);
  let v;if(k==='pct'){const n=parseNum(raw);if(!(n>0)||n>50)return toast('El porcentaje de '+(MET[m]||m)+' tiene que ser mayor a 0 y hasta 50 %.',1);v=Math.round(n*100);}
  else{v=cents(raw);if(!(v>0))return toast('El monto de '+(MET[m]||m)+' tiene que ser mayor a cero.',1);}
  const old=c.rules[m];const r={sign:t==='rec'?1:-1,kind:k==='pct'?'pct':'fixed',v};r.ver=old&&old.sign===r.sign&&old.kind===r.kind&&old.v===r.v?(old.ver||1):((old&&old.ver)||0)+1;nr[m]=r;
  if(r.sign>0&&PA_LEGAL.includes(m))legal=true;}
 const save2=()=>{c.rules=nr;c.on=$('#pa-on').checked;c.stack=$('#pa-st').checked;S.payadj=c;
  audit('CONFIG_RECARGOS',prev+' → '+JSON.stringify({on:c.on,stack:c.stack,rules:c.rules}));save();toast('Recargos y descuentos guardados');rerender();};
 if(legal&&!c.legalAck){confirmBox('Aviso legal','Cargaste un recargo para débito, crédito, QR o transferencia. La Ley 25.065 (art. 37 inc. c) prohíbe la diferencia de precio entre contado y tarjeta en un solo pago. ¿Confirmás que lo consultaste y querés guardarlo igual?',()=>{c.legalAck={user:user.name,ts:now()};audit('RECARGO_AVISO_LEGAL','aceptado por '+user.name);save2();},'Sí, guardar');return;}
 save2();};

if(typeof module!=='undefined'&&module.exports)module.exports={payAdjCalc,paAlloc,paAmt,paRuleOk};
/* demos: reglas de ejemplo cargadas (apagadas: se encienden con un clic en Configuración) */
function paDemoSeed(d){if(!d.payadj||!Object.keys(d.payadj.rules||{}).length)d.payadj={on:false,stack:false,example:true,rules:{efectivo:{sign:-1,kind:'pct',v:1000,ver:1},transferencia:{sign:-1,kind:'pct',v:500,ver:1}}};}
function paCartHTML(){if(!paOn()||!pos.lines.length||pos.mix)return'';const R=paCalcFor([{m:pos.method,b:posTotal()}]);if(!R.adj.length)return R.skip.length?paRowsHTML(R):'';
 return paRowsHTML(R)+`<div class="row" style="margin:.2rem 0 .6rem"><span class="sp mut">Total con ${esc(MET[pos.method]||pos.method)}</span><span class="total">${money(R.total)}</span></div>`;}
function paCobroTotHTML(tot,gross,ben){const m=pos.mix?'mixto':pos.method;
 if(!paOn()||m==='mixto')return `<hr><div class="row"><span class="sp">TOTAL${paOn()&&m==='mixto'?' (antes de los ajustes de cada medio)':''}</span><span class="total">${money(tot)}</span></div>`;
 const R=paCalcFor([{m,b:tot}]);if(!R.adj.length)return `${R.skip.length?paRowsHTML(R):''}<hr><div class="row"><span class="sp">TOTAL</span><span class="total">${money(tot)}</span></div>`;
 return `${ben&&ben.disc?'':`<div class="row sm"><span class="sp">Subtotal</span><span>${money(tot)}</span></div>`}${paRowsHTML(R)}<hr><div class="row"><span class="sp">TOTAL</span><span class="total">${money(R.total)}</span></div>`;}
