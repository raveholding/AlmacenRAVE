/* ===== V26.23 · Cuentas de cobro: a qué cuenta entró cada transferencia, QR, MODO o posnet =====
   · Configuración → «Cuentas de cobro»: cada cuenta tiene nombre (alias/CBU parcial), dueño (el rubro de un socio o «del negocio»)
     y los medios que recibe (transferencia, QR, MODO, débito, crédito). Sólo el administrador las carga.
   · Al cobrar con uno de esos medios (pago total o parte de un pago mixto) se elige la cuenta; si hay una sola, se elige sola.
     La venta guarda en el pago {acc, accN, accR}: cuenta, nombre y dueño en ese momento.
   · Arqueo/cierre: cuánto entró a cada cuenta y la COMPENSACIÓN entre socios: si a la cuenta de Juan entró plata de productos
     de Nico, «Juan le pasa $X a Nico». No cambia ventas, ganancia, caja física ni efectivo esperado (es plata digital). */
const ACC_MEDS=['transferencia','qr','modo','debito','credito'];
const accList=()=>Array.isArray(S.cfg&&S.cfg.payAcc)?S.cfg.payAcc.filter(a=>a&&a.id&&a.active!==false):[];
const accFor=m=>accList().filter(a=>(a.meds||[]).includes(m));
const accById=id=>(Array.isArray(S.cfg&&S.cfg.payAcc)?S.cfg.payAcc:[]).find(a=>a.id===id);
const accOwnerName=a=>{if(!a||!a.rubro)return'Negocio';const r=rub(a.rubro);return r?(r.owner?r.owner+' ('+r.name+')':r.name):'(rubro eliminado)';};
/* ---------- Configuración ---------- */
function accCfgCard(){if(!user||user.role!=='admin')return'';const L=Array.isArray(S.cfg.payAcc)?S.cfg.payAcc:[];
 return`<div class="card" style="margin-top:1rem" id="acc-card"><div class="row" style="flex-wrap:wrap"><h3 class="sp">Cuentas de cobro</h3><button class="btn sm gold" data-act="accEdit" data-id="">+ Cuenta</button></div>
 <p class="sm mut">Las cuentas a las que entran transferencias, QR, MODO o el posnet. Al cobrar se elige a cuál entró, y el cierre muestra cuánto recibió cada una y ${ownerMode()?'el total por cuenta':'<b>quién le tiene que pasar plata a quién</b> si la cuenta de un socio cobró productos de otro'}.</p>
 ${L.length?L.map(a=>`<div class="row" style="flex-wrap:wrap;gap:.4rem;border-top:1px solid var(--line);padding:.45rem 0;${a.active===false?'opacity:.6':''}"><span class="sp"><b>${esc(a.name)}</b>${a.active===false?' <span class="tag bad">inactiva</span>':''}<div class="sm mut">De: ${esc(accOwnerName(a))} · ${(a.meds||[]).map(m=>esc(MET[m]||m)).join(', ')||'sin medios'}</div></span><button class="btn sm" data-act="accEdit" data-id="${a.id}">Editar</button></div>`).join(''):'<p class="mut sm">Todavía no hay cuentas: los cobros digitales no piden cuenta.</p>'}</div>`;}
A.accEdit=el=>{if(!user||user.role!=='admin')return toast('Sólo el administrador',1);S.cfg.payAcc=Array.isArray(S.cfg.payAcc)?S.cfg.payAcc:[];
 const a=el&&el.dataset.id?accById(el.dataset.id):null;const rubs=S.rubros.filter(r=>r.kind==='rubro');
 modal(a?'Editar cuenta de cobro':'Nueva cuenta de cobro',`<label for="ac-n">Nombre de la cuenta (alias o CBU parcial)</label><input id="ac-n" maxlength="60" autocomplete="off" value="${esc(a?a.name:'')}" placeholder="Ej.: juan.rave.mp">
 <label for="ac-r">¿De quién es la plata que entra a esta cuenta?</label><select id="ac-r">${ownerMode()?'':rubs.map(r=>`<option value="${r.id}" ${a&&a.rubro===r.id?'selected':''}>${esc(r.owner?r.owner+' — '+r.name:r.name)}</option>`).join('')}<option value="" ${a&&!a.rubro||ownerMode()?'selected':''}>Del negocio (no es de un socio)</option></select>
 <label>Medios que entran a esta cuenta</label><div class="row" style="flex-wrap:wrap;gap:.6rem">${ACC_MEDS.map(m=>`<label class="chk" style="margin:0"><input type="checkbox" data-acm="${m}" ${(a?(a.meds||[]):['transferencia']).includes(m)?'checked':''}> ${esc(MET[m]||m)}</label>`).join('')}</div>
 ${a?`<label class="chk"><input type="checkbox" id="ac-on" ${a.active!==false?'checked':''}> Cuenta activa (desactivala si ya no se usa; los cierres anteriores no cambian)</label>`:''}`,
 {okText:'Guardar cuenta',onOk:w=>{const n=val('ac-n').trim();if(n.length<2)return w._err('Escribí el nombre de la cuenta.'),false;if(typeof pdPan==='function'&&pdPan(n))return w._err('Eso parece un número de tarjeta: no se guarda.'),false;
  if(S.cfg.payAcc.some(x=>norm(x.name)===norm(n)&&(!a||x.id!==a.id)))return w._err('Ya hay una cuenta con ese nombre.'),false;
  const meds=[...w.querySelectorAll('[data-acm]')].filter(x=>x.checked).map(x=>x.dataset.acm);if(!meds.length)return w._err('Elegí al menos un medio.'),false;
  const d={name:n,rubro:ownerMode()?'':val('ac-r'),meds,active:a?$('#ac-on',w).checked:true};
  if(a){Object.assign(a,d);audit('CUENTA_COBRO_EDITAR',n+' · de '+accOwnerName(a)+' · '+meds.join(','));}else{const x=Object.assign({id:uid()},d);S.cfg.payAcc.push(x);audit('CUENTA_COBRO_ALTA',n+' · de '+accOwnerName(x)+' · '+meds.join(','));}
  save();rerender();toast('Cuenta guardada');}});};
/* ---------- cobro: elegir la cuenta ---------- */
function accMedsInUse(){const m=pos.mix?pos.pays.map(p=>p.m):[pos.method];return[...new Set(m)].filter(x=>ACC_MEDS.includes(x)&&accFor(x).length);}
function accPickHTML(){const M=accMedsInUse();if(!M.length)return'';pos.acc=pos.acc||{};
 return`<div class="card" id="acc-pick" style="margin:.5rem 0"><h3 style="margin-top:0">¿A qué cuenta entró?</h3>${M.map(m=>{const L=accFor(m);if(L.length===1&&!pos.acc[m])pos.acc[m]=L[0].id;
  return`<label for="acc-${m}">${esc(MET[m]||m)}</label><select id="acc-${m}" data-accm="${m}"><option value="">— Elegí la cuenta —</option>${L.map(a=>`<option value="${a.id}" ${pos.acc[m]===a.id?'selected':''}>${esc(a.name)} · ${esc(accOwnerName(a))}</option>`).join('')}</select>`;}).join('')}
 <p class="sm mut">Sirve para el cierre: cuánto entró a cada cuenta${ownerMode()?'':' y quién le pasa plata a quién'}.</p></div>`;}
document.addEventListener('change',e=>{const m=e.target&&e.target.dataset&&e.target.dataset.accm;if(!m)return;pos.acc=pos.acc||{};pos.acc[m]=e.target.value;});
/* valida y devuelve {m: accId} para commitSale */
function accGate(){const M=accMedsInUse();const out={};for(const m of M){const id=(pos.acc||{})[m];if(!id||!accById(id))return{err:'Elegí a qué cuenta entró el cobro por '+(MET[m]||m)+'.'};out[m]=id;}return{acc:out};}
/* agrega la cuenta a cada pago (foto del nombre y el dueño en ese momento) */
function accStamp(pays,map){if(!map)return;pays.forEach(p=>{const id=map[p.m];const a=id?accById(id):null;if(a){p.acc=a.id;p.accN=a.name;p.accR=a.rubro||'';}});}
/* ---------- arqueo: por cuenta y compensación entre socios ---------- */
function accArq(sess){const sales=S.sales.filter(s=>s.sessId===sess.id&&s.status==='ok');const byAcc={},rec={},corr={};let tot=0,sin=0;
 sales.forEach(s=>{const items=s.items||[];const tots=items.map(lineTotal);const T=tots.reduce((a,b)=>a+b,0);
  salePays(s).forEach(pp=>{if(!ACC_MEDS.includes(pp.m))return;if(!pp.acc){sin+=pp.a;return;}tot+=pp.a;
   const k=pp.acc;const b=byAcc[k]||(byAcc[k]={id:k,name:pp.accN||(accById(k)||{}).name||'(cuenta)',owner:pp.accR||'',n:0,total:0});b.n++;b.total+=pp.a;
   if(pp.accR)rec[pp.accR]=(rec[pp.accR]||0)+pp.a;
   if(T>0){let acc=0;items.forEach((it,i)=>{const sh=i===items.length-1?pp.a-acc:Math.round(pp.a*tots[i]/T);acc+=sh;const r=rub(it.rubro);const key=(r&&r.kind==='rubro')?it.rubro:'';corr[key]=(corr[key]||0)+sh;});}});});
 const fp=(S.fiadoPays||[]).filter(f=>f.acc&&f.ts>=sess.openedAt&&(!sess.closedAt||f.ts<=sess.closedAt)).map(f=>({name:f.accN||'',amount:f.amount,cust:f.cust}));
 const owners=new Set([...Object.keys(rec),...Object.keys(corr).filter(k=>k)]);const comp=[...owners].map(id=>{const r=rub(id);return{id,name:r?(r.owner||r.name):'(rubro)',rubro:r?r.name:'',rec:rec[id]||0,corr:corr[id]||0,saldo:(rec[id]||0)-(corr[id]||0)};});
 const negocio=corr['']||0;   /* productos sin rubro de socio: no se compensan */
 /* pases: los que recibieron de más le pasan a los que recibieron de menos */
 const deb=comp.filter(c=>c.saldo>0).map(c=>({...c,left:c.saldo})),cre=comp.filter(c=>c.saldo<0).map(c=>({...c,left:-c.saldo}));const moves=[];
 for(const d of deb)for(const c of cre){if(d.left<=0)break;if(c.left<=0)continue;const x=Math.min(d.left,c.left);if(x>0){moves.push({from:d.name,to:c.name,amount:x});d.left-=x;c.left-=x;}}
 return{byAcc:Object.values(byAcc),total:tot,sinCuenta:sin,comp,moves,negocio,fiado:fp};}
function accArqHTML(x){if(!x||(!x.byAcc.length&&!x.sinCuenta))return'';
 return`<h3 style="margin-top:1rem">Cobros digitales por cuenta</h3><div class="tw"><table><thead><tr><th>Cuenta</th><th>De</th><th class="r">Cobros</th><th class="r">Importe</th></tr></thead><tbody>
 ${x.byAcc.map(b=>`<tr><td>${esc(b.name)}</td><td>${esc(b.owner?((rub(b.owner)||{}).owner||(rub(b.owner)||{}).name||''):'Negocio')}</td><td class="r">${b.n}</td><td class="r">${money(b.total)}</td></tr>`).join('')}
 ${x.sinCuenta?`<tr><td colspan="3"><span class="tag warn">Sin cuenta elegida</span></td><td class="r">${money(x.sinCuenta)}</td></tr>`:''}</tbody></table></div>
 ${ownerMode()||!x.comp.length?'':`<h3 style="margin-top:1rem">Compensación entre socios (plata digital)</h3><div class="tw"><table><thead><tr><th>Socio</th><th class="r">Entró a su cuenta</th><th class="r">Le corresponde por sus ventas</th><th class="r">Diferencia</th></tr></thead><tbody>
 ${x.comp.map(c=>`<tr><td><b>${esc(c.name)}</b><div class="sm mut">${esc(c.rubro)}</div></td><td class="r">${money(c.rec)}</td><td class="r">${money(c.corr)}</td><td class="r ${c.saldo>0?'neg':''}">${c.saldo>0?'tiene '+money(c.saldo)+' de otro':c.saldo<0?'le faltan '+money(-c.saldo):'—'}</td></tr>`).join('')}</tbody></table></div>
 ${x.moves.length?x.moves.map(m=>`<div class="warnbox"><b>${esc(m.from)} le pasa ${money(m.amount)} a ${esc(m.to)}</b></div>`).join(''):'<div class="okbox">Cada socio recibió en su cuenta lo que le corresponde: no hay que pasarse plata.</div>'}
 <p class="sm mut">Es plata que entró por transferencia, QR, MODO o posnet a la cuenta de cada uno. No cambia lo vendido, la ganancia, la caja física ni el efectivo del cajón.${x.negocio?' Productos sin rubro de socio cobrados en cuentas de socios: '+money(x.negocio)+'.':''}</p>`}
 ${x.fiado.length?`<p class="sm mut">Cobros de cuenta corriente a cuentas: ${x.fiado.map(f=>esc(f.name)+' '+money(f.amount)).join(' · ')} (informativo).</p>`:''}`;}
function accReportLines(x,P){if(!x||(!x.byAcc.length&&!x.sinCuenta))return;P('');P('COBROS DIGITALES POR CUENTA :','h');
 x.byAcc.forEach(b=>P('  '+b.name+' ('+(b.owner?((rub(b.owner)||{}).owner||(rub(b.owner)||{}).name||''):'negocio')+') : '+money(b.total)+(b.n>1?' ('+b.n+')':'')));
 if(x.sinCuenta)P('  ⚠ Sin cuenta elegida : '+money(x.sinCuenta),'w');
 if(!ownerMode()&&x.comp.length){if(x.moves.length)x.moves.forEach(m=>P('  → '+m.from.toUpperCase()+' LE PASA '+money(m.amount)+' A '+m.to.toUpperCase(),'h'));else P('  Cada socio recibió lo suyo: no hay que pasarse plata.');}}
