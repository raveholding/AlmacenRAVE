/* ===== Mayorista / minorista · 4.22 · fase F1 =====
   Un solo punto de cálculo de precio (priceResolve) para la pantalla y para commitSale.
   Todo detrás de S.cfg.wholesale.on (apagado en el sistema del cliente: el comportamiento no cambia). */
const WS_DAY=86400000;
const WS_LV0=[{id:'d',name:'Display'},{id:'f',name:'Fardo'},{id:'p',name:'Pallet'}];
function wsConf(){const w=(S.cfg&&S.cfg.wholesale)||{};
 const lv=(Array.isArray(w.levels)?w.levels:WS_LV0).filter(x=>x&&x.id&&x.name).slice(0,7).map(x=>({id:String(x.id).replace(/[^a-z0-9_]/gi,'').slice(0,12),name:String(x.name).replace(/[<>]/g,'').slice(0,24)}));
 return{on:!!w.on,only:!!(w.on&&w.only),allowClub:!!w.allowClub,grace:Math.max(0,Math.min(60,Math.round(+w.grace||0))),example:!!w.example,levels:lv};}
const wsOn=()=>wsConf().on;
const wsDateOk=(f,t)=>{const k=dkey(now());return(!f||k>=f)&&(!t||k<=t);};
function wsLvName(id){if(id==='u')return'Unidad';const l=wsConf().levels.find(x=>x.id===id);return l?l.name:String(id);}
/* presentaciones cargadas en el producto, de menor a mayor cantidad (la «Unidad» es el precio de venta) */
const wsPres=p=>((p&&p.pres)||[]).filter(k=>k&&k.qty>0&&k.unit>0).slice().sort((a,b)=>a.qty-b.qty);
const wsOnly=()=>wsConf().only;
const wsIsWh=c=>!!(c&&(c.channel==='mayorista'||wsOnly()));
/* V26.33 · «Sólo mayorista» (distribuidora): toda venta es mayorista —precio por unidad y, al completar una presentación,
   el precio mayorista de esa presentación—, para cualquier cliente o consumidor final. No hay canal minorista ni «Cambiar canal». */
function wsChan(){if(wsOnly())return'mayorista';if(pos.chanSet&&pos.chanSet.cust===pos.cust)return pos.chanSet.v;return wsIsWh(custById(pos.cust))?'mayorista':'minorista';}
function wsAgreement(cid,p){const A_=(S.agreements||[]).filter(a=>a&&a.active!==false&&a.cust===cid&&wsDateOk(a.from,a.to));
 return A_.find(a=>a.pid&&a.pid===p.id)||A_.find(a=>!a.pid&&a.rubro&&a.rubro===p.rubro)||null;}
/* desglose del stock en presentaciones: «2 Pallet + 3 Fardo + 5 u» (sólo productos por unidad con presentaciones cargadas) */
function wsStockStr(p,qty){if(!wsOn()||!p||p.unit!=='u')return'';const P=wsPres(p).reverse();if(!P.length||!(qty>=P[P.length-1].qty))return'';
 let r=Math.floor(qty+1e-9);const out=[];for(const k of P){const n=Math.floor(r/k.qty);if(n>0){out.push(n+' '+wsLvName(k.lv));r-=n*k.qty;}}if(r>0)out.push(r+' u');return out.join(' + ');}
/* ---- resolución determinista del precio ----
   Minorista: precio de venta. Mayorista (cliente con CUIT válido): acuerdo del cliente si existe; si no, el precio por unidad de la
   presentación MÁS GRANDE que alcanza la cantidad total del mismo producto en la operación (nunca sube el precio) → piso. */
function priceResolve(p,qty,ctx){
 ctx=ctx||{};const cust=ctx.cust||null,chan=ctx.chan||'minorista';
 const R={price:p.price,base:p.price,alt:p.price,rule:'L1',list:'L1',why:'precio de venta',missing:'',below:false,warn:''};
 if(!wsOn())return R;
 const fin=()=>{R.below=!!(p.floor>0&&R.price<p.floor);return R;};
 if(chan==='mayorista'&&!wsOnly()&&!(cust&&arcaCuitOk(cust.taxid||''))){R.warn='cuit';R.why='Consumidor final (sin cliente con CUIT): precio por unidad';return fin();}
 const ag=cust?wsAgreement(cust.id,p):null;
 if(ag){R.price=ag.price>0?ag.price:Math.round(p.price*(1-ag.pct/100));R.rule='ACU';R.list='ACU';R.agr=ag.id;R.why='Acuerdo especial'+(ag.pid?'':' ('+RW()+')')+' · '+(ag.price>0?money(ag.price):ag.pct+' % off');return fin();}
 if(chan!=='mayorista')return fin();
 R.why='Unidad (precio de venta)';
 /* cobro POR TRAMOS: cada presentación completa va a su precio por unidad y el resto suelto al precio de venta (nunca se cobra todo al precio de la presentación) */
 const P=wsPres(p).filter(k=>k.unit<p.price).reverse();let rem=qty,nx=null;const tr=[];
 for(const k of P){const n=Math.floor(rem/k.qty+1e-9);if(n>0){tr.push({qty:Math.round(n*k.qty*1000)/1000,price:k.unit,rule:'P-'+k.lv,lst:wsLvName(k.lv)});rem=Math.round((rem-n*k.qty)*1000)/1000;}}
 for(const k of wsPres(p)){if(k.unit<p.price&&qty<k.qty-1e-9){nx=k;break;}}
 if(tr.length){if(rem>1e-9)tr.push({qty:rem,price:p.price,rule:'L1',lst:'Unidad'});
  R.amt=tr.reduce((a,t)=>a+Math.round(t.qty*t.price),0);R.tr=tr;R.price=Math.round(R.amt/qty);
  R.rule=tr.length===1?tr[0].rule:'MIX';R.list=tr.length===1?tr[0].lst:'Mixto';
  R.why=tr.map(t=>numAR(t.qty,3)+' u '+t.lst+' a '+money(t.price)).join(' + ');}
 if(nx)R.missing='Faltan '+numAR(nx.qty-qty,3)+' u para el precio '+wsLvName(nx.lv)+' ('+money(nx.unit)+' por unidad)';
 return fin();}
/* recalcula las líneas del ticket en curso (las que no tienen precio puesto a mano) */
function wsRecalc(){if(!wsOn()||typeof pos==='undefined')return;
 const cust=custById(pos.cust),chan=wsChan();const agg={};pos.lines.forEach(l=>agg[l.pid]=(agg[l.pid]||0)+l.qty);
 pos.lines.forEach(l=>{const p=prod(l.pid);if(!p)return;
  if(l.man){l.rule='MAN';l.lst='';l.why='Precio puesto a mano (queda auditado)';l.miss='';delete l.tr;delete l.amt;return;}
  const dup=pos.lines.filter(x=>x.pid===l.pid).length>1;
  const r=priceResolve(p,dup?l.qty:agg[l.pid],{cust,chan});l.tr=r.tr;l.amt=r.amt;
  if(l.price!==r.price){delete l.flrOk;}
  l.price=r.price;l.list=r.price;l.rule=r.rule;l.lst=r.list;l.base=r.base;l.why=r.why;l.miss=r.missing;});}
/* validaciones y precios finales al cobrar (el mismo cálculo que la pantalla) */
function wsGate(lines,cust,opts){
 const conf=wsConf();let chan=opts.ws.chan==='mayorista'?'mayorista':'minorista';
 /* V26.34 · sin cliente identificado con CUIT NO se bloquea la venta: es consumidor final y se cobra al precio por unidad
    (salvo «Sólo mayorista», donde los precios por presentación rigen para todos) */
 if(chan==='mayorista'&&!conf.only&&!(cust&&arcaCuitOk(cust.taxid||'')))chan='minorista';
 if(chan==='mayorista'){
  if(!conf.allowClub){if(opts.coupon)return{err:'Los cupones del Club no se aplican a ventas mayoristas.'};if(opts.stampCode)return{err:'Los sellos del Club no se otorgan en ventas mayoristas.'};}}
  const agg={};lines.forEach(l=>agg[l.pid]=(agg[l.pid]||0)+l.qty);
 for(const l of lines){const p=prod(l.pid);if(!p)continue;
  if(l.man){l.rule='MAN';l.lst='';delete l.tr;delete l.amt;}
  else{const dup=lines.filter(x=>x.pid===l.pid).length>1;const r=priceResolve(p,dup?l.qty:agg[l.pid],{cust,chan});l.tr=r.tr;l.amt=r.amt;if(l.price!==r.price)delete l.flrOk;l.price=r.price;l.rule=r.rule;l.lst=r.list;l.base=r.base;l.why=r.why;}
  if(p.floor>0&&Math.min(l.price,...((l.tr||[]).map(t=>t.price)))<p.floor&&!l.flrOk)return{err:'El precio de '+p.name+' ('+money(l.price)+') está por debajo del piso ('+money(p.floor)+'): lo tiene que autorizar un supervisor con motivo.'};}
 return{chan,club:conf.allowClub};}
/* importe exacto de una línea (con tramos) y desglose en renglones para guardar la venta: cada renglón cumple cantidad × precio */
const lnAmt=l=>l.amt>0&&l.tr?l.amt:Math.round(l.qty*l.price);
function wsSplit(lines){const out=[];lines.forEach(l=>{if(l.tr&&l.tr.length>1){l.tr.forEach(t=>out.push(Object.assign({},l,{qty:t.qty,price:t.price,rule:t.rule,lst:t.lst,list:t.price,tr:undefined,amt:undefined})));}else out.push(l.tr&&l.tr.length===1?Object.assign({},l,{rule:l.tr[0].rule,lst:l.tr[0].lst,tr:undefined,amt:undefined}):l);});return out;}
const wsNoClub=()=>wsOn()&&wsChan()==='mayorista'&&!wsConf().allowClub;

/* ---- crédito: límite + plazo + mora + excepción autorizada (4.22.2) ---- */
const wsDue=(s,c)=>s.due||((c&&c.term>0)?s.ts+c.term*WS_DAY:0);
function wsOpenDocs(cid){const c=custById(cid);
 const d=S.sales.filter(s=>s.cust===cid&&s.fiado&&s.status==='ok').sort((a,b)=>a.ts-b.ts).map(s=>({s,left:saleFiadoAmt(s),due:wsDue(s,c)}));
 let paid=S.fiadoPays.filter(p=>p.cust===cid).reduce((a,p)=>a+p.amount,0);
 for(const x of d){const t=Math.min(x.left,paid);x.left-=t;paid-=t;}
 return d.filter(x=>x.left>0);}
function wsOverdue(cid,at){at=at||now();const g=wsConf().grace*WS_DAY;return wsOpenDocs(cid).filter(x=>x.due&&x.due+g<at);}
function wsAging(cid){const B=[{k:'0–30',a:0,b:30,t:0},{k:'31–60',a:31,b:60,t:0},{k:'61–90',a:61,b:90,t:0},{k:'+90',a:91,b:1e9,t:0}];
 wsOpenDocs(cid).forEach(x=>{const age=Math.floor((now()-x.s.ts)/WS_DAY);const b=B.find(q=>age>=q.a&&age<=q.b)||B[3];b.t+=x.left;});return B;}
function wsFindOverride(cid,amt){return(S.creditOv||[]).find(o=>o.cust===cid&&o.until>now()&&o.max>=amt&&!(S.creditUse||[]).some(u=>u.ov===o.id))||null;}
function wsCreditCheck(cust,amt){
 const lim=cust.limit||0,deuda=debtOf(cust.id);const probs=[];
 if(!(lim>0))probs.push('El cliente no tiene límite de crédito asignado.');
 else if(deuda+amt>lim)probs.push('Supera el límite de crédito: debe '+money(deuda)+' de '+money(lim)+' y esta venta suma '+money(amt)+'.');
 if(wsOn()){const od=wsOverdue(cust.id);if(od.length){const tot=od.reduce((a,d)=>a+d.left,0);
  probs.push('Tiene '+od.length+' documento'+(od.length>1?'s':'')+' vencido'+(od.length>1?'s':'')+' por '+money(tot)+' (el más viejo venció el '+dkey(od[0].due)+').');}}
 if(!probs.length)return{ok:1};
 if(wsOn()){const ov=wsFindOverride(cust.id,amt);if(ov)return{ok:1,ov:ov.id,probs};}
 return{err:probs.join(' '),credit:1,cust:cust.id,need:amt};}
function wsCommitErr(r){
 if(r.credit&&can('credit_ov')&&wsOn()){toast(r.err+' Podés autorizar una excepción.',1);setTimeout(()=>A.wsCredOv({dataset:{id:r.cust,need:String(r.need)}}),50);return;}
 toast(r.err+(r.credit&&wsOn()?' Un supervisor puede autorizar una excepción con su usuario.':''),1);}
A.wsCredOv=el=>{if(!can('credit_ov'))return toast('Sin permiso para autorizar excepciones de crédito.',1);
 const c=custById(el.dataset.id);if(!c)return;const need=+el.dataset.need||0;
 modal('Excepción de crédito · '+custFull(c),`<p class="sm">Debe <b>${money(debtOf(c.id))}</b> de un límite de <b>${money(c.limit||0)}</b>. La excepción se usa <u>una sola vez</u> y vence sola.</p>
 <label for="co-a">Monto máximo autorizado ($)</label>${numIn('co-a',need,'0')}
 <label for="co-h">Vigencia (horas)</label><input id="co-h" inputmode="numeric" placeholder="24" autocomplete="off">
 <label for="co-w">Motivo (obligatorio)</label><input id="co-w" maxlength="120" autocomplete="off">`,
 {okText:'Autorizar',onOk:w=>{const a=cents(val('co-a'));if(!(a>0))return w._err('Indicá el monto máximo.'),false;
  const hv=val('co-h').trim()===''?24:parseNum(val('co-h'));if(!(hv>0&&hv<=720))return w._err('La vigencia va de 1 a 720 horas.'),false;
  const why=val('co-w').trim();if(why.length<5)return w._err('Escribí el motivo (mínimo 5 letras).'),false;
  const o={id:uid(),cust:c.id,max:a,until:now()+Math.round(hv*3600000),by:user?user.name:'sistema',reason:why.slice(0,120),ts:now()};
  (S.creditOv=S.creditOv||[]).push(o);audit('EXCEPCION_CREDITO',custFull(c)+' · hasta '+money(a)+' · '+hv+' h · '+why);save();toast('Excepción autorizada: volvé a cobrar.');rerender();}});};

/* ---- ticket: barra de canal/cliente, información por línea, presentaciones ---- */
function wsCustFind(q){q=String(q||'').trim().toLowerCase();if(!q)return[];const qd=q.replace(/\D/g,'');
 return S.customers.filter(c=>c.status!=='baja'&&((c.name+' '+c.last).toLowerCase().includes(q)||(qd&&c.wa.replace(/\D/g,'').includes(qd))||pad4(c.num)===q||(c.dni&&normDni(q).length>=6&&normDni(c.dni)===normDni(q))||(qd.length>=8&&(c.taxid||'').replace(/\D/g,'')===qd))).slice(0,8);}
function wsCartBar(){if(!wsOn())return'';
 const c=custById(pos.cust),ch=wsChan();
 if(wsOnly())return`<div class="card" style="margin:.5rem 0" id="wsbar"><div class="row" style="flex-wrap:wrap"><span class="tag ok">Venta mayorista</span><b class="sp">${c?esc(custFull(c)):'Cliente sin identificar'}</b><button class="btn sm" data-act="wsPick">${c?'Cambiar cliente':'Elegir cliente'}</button>${c?'<button class="btn sm" data-act="wsPickClear">Quitar</button>':''}</div>
 <p class="sm mut" style="margin:.3rem 0 0">Precio por unidad; al completar una presentación (Display, Fardo, Pallet…) se cobra su precio mayorista.${c?' · crédito: debe '+money(debtOf(c.id))+' de '+money(c.limit||0)+(c.term>0?' · plazo '+c.term+' días':''):' Para cuenta corriente elegí el cliente.'}</p></div>`;
 const miss=ch==='mayorista'&&!(c&&arcaCuitOk(c.taxid||''));
 return`<div class="card" style="margin:.5rem 0" id="wsbar"><div class="row" style="flex-wrap:wrap"><span class="tag ${ch==='mayorista'?'ok':''}">Canal: ${ch==='mayorista'?'Mayorista':'Minorista'}</span><b class="sp">${c?esc(custFull(c)):'Consumidor final'}</b><button class="btn sm" data-act="wsPick">${c?'Cambiar cliente':'Elegir cliente'}</button>${c?'<button class="btn sm" data-act="wsPickClear">Quitar</button>':''}<button class="btn sm" data-act="wsChan">Cambiar canal</button></div>
 ${miss?'<div class="warnbox sm" role="status">Sin cliente con CUIT es una venta a <b>consumidor final</b>: se cobra al precio por unidad. Para los precios mayoristas elegí un cliente con CUIT.</div>':`<p class="sm mut" style="margin:.3rem 0 0">${ch==='mayorista'?'Precio por volumen: cada producto toma el precio de la presentación (Display, Fardo, Pallet…) que alcance su cantidad.':'Precio de venta al público.'}${c&&ch==='mayorista'?' · crédito: debe '+money(debtOf(c.id))+' de '+money(c.limit||0)+(c.term>0?' · plazo '+c.term+' días':''):''}</p>`}</div>`;}
function wsLineInfo(l,i){if(!wsOn())return'';const p=prod(l.pid);let h='';
 if(l.why)h+=`<div class="sm ${l.rule==='MAN'?'mut':''}" style="margin-top:.3rem"><b>${esc(l.rule==='L1'||!l.rule?(wsOnly()?'Por unidad':'Minorista'):l.rule==='MAN'?'A mano':l.rule==='ACU'?'Acuerdo':'Mayorista')}</b> · ${esc(l.why)}</div>`;
 if(l.miss)h+=`<div class="sm mut">${esc(l.miss)}</div>`;
 if(p){
  if(p.floor>0&&l.price<p.floor)h+=`<div class="tag bad" style="margin-top:.3rem">Debajo del piso (${money(p.floor)})${l.flrOk?' · autorizado':''}</div>${!l.flrOk&&can('price_lists')?` <button class="btn sm" data-act="wsFloor" data-i="${i}">Autorizar</button>`:''}`;
  const pk=wsPres(p);if(pk.length&&wsChan()==='mayorista')h+=`<div class="row" style="margin-top:.3rem;flex-wrap:wrap">${pk.map(k=>`<button class="btn sm" data-act="wsPack" data-i="${i}" data-k="${esc(k.lv)}">+ ${esc(wsLvName(k.lv))} (${numAR(k.qty,3)} u)</button>`).join('')}</div>`;}
 return h;}
const wsLineTag=l=>(wsOn()&&l.why&&l.rule&&l.rule!=='L1')?`<small class="mut"> · ${esc(l.rule==='MAN'?'a mano':(l.list||l.rule))}</small>`:'';
function wsClubOff(){return`<p class="sm mut">Venta mayorista: no se aplican cupones, membresía ni sellos del Club (se puede habilitar en Configuración → Mayorista).</p>`;}
/* suma una presentación entera (Display, Fardo, Pallet…) a una línea del ticket */
A.wsPack=el=>{const i=+el.dataset.i,L=pos.lines[i];if(!L)return;const p=prod(L.pid),k=p&&wsPres(p).find(x=>x.lv===el.dataset.k);if(!k)return;
 lineEdit(i,'qty',String(Math.round((L.qty+k.qty)*1000)/1000).replace('.',','));};
/* agrega al ticket una presentación del producto (desde la grilla de Vender o con el código de barras de la presentación) */
function wsAddPres(p,k){if(!p||!k)return false;const had=pos.lines.some(l=>l.pid===p.id);
 if(!had){A.padd({dataset:{id:p.id}});}
 const i=pos.lines.findIndex(l=>l.pid===p.id);if(i<0)return true;
 const add=had?k.qty:k.qty-1;if(add>0)lineEdit(i,'qty',String(Math.round((pos.lines[i].qty+add)*1000)/1000).replace('.',','));return true;}
A.wsAddPres=el=>{const p=prod(el.dataset.id);if(!p)return;wsAddPres(p,wsPres(p).find(x=>x.lv===el.dataset.lv));};
function wsAddByPack(code){if(!wsOn()||!code)return false;
 for(const p of S.products){if(!p.active)continue;const k=wsPres(p).find(x=>x.barcode&&x.barcode===code);if(k)return wsAddPres(p,k);}return false;}
/* Vender: en el canal mayorista cada producto muestra sus precios por presentación y botones para sumar Display/Fardo/Pallet */
function wsTile(p,base){if(!wsOn()||wsChan()!=='mayorista')return base;const P=wsPres(p);if(!P.length)return base;
 return`<div class="pw">${base}<div class="pchips" aria-label="Sumar por presentación: ${esc(p.name)}">${P.map(k=>`<button type="button" class="btn sm" data-act="wsAddPres" data-id="${p.id}" data-lv="${esc(k.lv)}" ${(p.stock<k.qty&&!canOver(p))?'disabled':''} aria-label="Agregar ${esc(wsLvName(k.lv))} de ${numAR(k.qty,3)} unidades de ${esc(p.name)}"><b>+ ${esc(wsLvName(k.lv))}</b> ×${numAR(k.qty,3)}<span>${money(k.unit)} c/u · ${money(Math.round(k.unit*k.qty))}</span></button>`).join('')}</div></div>`;}
function wsGridSync(){const key=wsOn()?wsChan():'-';if(pos._wsg!==key){pos._wsg=key;if(typeof posGrid==='function')posGrid();}}
A.wsFloor=el=>{if(!can('price_lists'))return toast('Sin permiso',1);const i=+el.dataset.i,L=pos.lines[i];if(!L)return;
 modal('Autorizar precio bajo el piso',`<p class="sm">${esc(L.name)}: ${money(L.price)} (piso ${money((prod(L.pid)||{}).floor||0)}).</p><label for="fl-w">Motivo (obligatorio)</label><input id="fl-w" maxlength="120" autocomplete="off">`,
 {okText:'Autorizar',onOk:w=>{const why=val('fl-w').trim();if(why.length<5)return w._err('Escribí el motivo (mínimo 5 letras).'),false;L.flrOk=1;L.flrWhy=why;audit('PISO_PRECIO',L.name+' · '+money(L.price)+' bajo el piso · '+why);posCart();}});};
A.wsPick=()=>{const w=modal('Elegir cliente',`<label for="wk-q">Buscar por nombre, WhatsApp, DNI o CUIT</label><input id="wk-q" autocomplete="off" placeholder="Escribí para buscar"><div id="wk-res" style="margin-top:.4rem"></div>`,{okText:'Cerrar',onOk:()=>{}});
 w.addEventListener('input',e=>{if(e.target.id!=='wk-q')return;const L=wsCustFind(e.target.value);const r=$('#wk-res',w);
  r.innerHTML=L.map(c=>`<button class="btn sm" style="margin:.2rem .2rem 0 0" data-act="wsPickSet" data-id="${c.id}">${esc(custFull(c))} · ${esc(pad4(c.num))}${wsIsWh(c)?' · mayorista':''}</button>`).join('')||'<span class="sm mut">Sin resultados</span>';});
 setTimeout(()=>{const q=$('#wk-q');if(q)q.focus();},30);};
A.wsPickSet=el=>{pos.cust=el.dataset.id||'';pos.chanSet=null;$$('#modal-root .ov').forEach(o=>o.remove());posCart();};
A.wsPickClear=()=>{pos.cust='';pos.chanSet=null;posCart();};
A.wsChan=()=>{if(wsOnly())return toast('Esta distribuidora vende sólo por mayor: no hay canal minorista.',1);const c=custById(pos.cust),cur=wsChan(),to=cur==='mayorista'?'minorista':'mayorista',inh=wsIsWh(c)?'mayorista':'minorista';
 if(to===inh){pos.chanSet=null;posCart();return;}
 if(!can('price_lists'))return toast('Cambiar el canal de la operación requiere autorización (listas de precio).',1);
 modal('Cambiar canal de la operación',`<p class="sm">De <b>${cur}</b> a <b>${to}</b>. Queda en auditoría.</p><label for="wc-why">Motivo (obligatorio)</label><input id="wc-why" maxlength="80" autocomplete="off">`,
 {okText:'Cambiar',onOk:w=>{const why=val('wc-why').trim();if(why.length<5)return w._err('Escribí el motivo (mínimo 5 letras).'),false;pos.chanSet={cust:pos.cust,v:to};audit('CANAL_OPERACION',cur+' → '+to+' · '+why);posCart();}});};

/* ventas a cuenta corriente que el servidor marcó para revisar (superaron el límite mientras el equipo estaba sin conexión) */
const wsReview=cid=>S.sales.filter(s=>s.credit_review&&(!cid||s.cust===cid));
const wsCrw={sin_limite:'cliente sin límite',supera_limite:'superó el límite'};
/* ---- ficha del cliente: bloque mayorista ---- */
function wsCustCard(c){if(!wsOn()||!c)return'';const ed=custAdm()?'':'disabled';
 const ag=wsAging(c.id);const od=wsOverdue(c.id);
 return`<div class="card" style="margin:.6rem 0"><h3 style="margin-top:0">Mayorista y crédito</h3>
 <div class="grid g2" ${wsOnly()?'hidden':''}><div><label for="wc-ch">Canal habitual</label><select id="wc-ch" ${ed}><option value="minorista" ${!wsIsWh(c)?'selected':''}>Minorista</option><option value="mayorista" ${wsIsWh(c)?'selected':''}>Mayorista</option></select></div>
 </div>
 <div class="grid g2"><div><label for="wc-tx">CUIT ${wsOnly()?'(opcional)':'(obligatorio para vender como mayorista)'}</label><input id="wc-tx" inputmode="numeric" maxlength="13" autocomplete="off" placeholder="20-12345678-6" value="${esc(c.taxid||'')}" ${ed}></div>
 <div><label for="wc-tm">Plazo máximo de pago (días)</label><input id="wc-tm" inputmode="numeric" maxlength="3" autocomplete="off" placeholder="Sin plazo" value="${c.term>0?esc(String(c.term)):''}" ${ed}></div></div>
 <div class="grid g2"><div><label for="wc-zn">Zona de cobranza</label><input id="wc-zn" maxlength="30" autocomplete="off" value="${esc(c.zone||'')}" ${ed}></div><div><label for="wc-sl">Vendedor asignado</label><input id="wc-sl" maxlength="30" autocomplete="off" value="${esc(c.seller||'')}" ${ed}></div></div>
 <p class="sm mut">Antigüedad de saldos: ${ag.map(b=>`${b.k} d: <b>${money(b.t)}</b>`).join(' · ')}</p>
 ${od.length?`<div class="warnbox sm">Documentos vencidos: ${od.length} por ${money(od.reduce((a,d)=>a+d.left,0))}. La cuenta corriente queda bloqueada hasta cobrar o autorizar una excepción.</div>`:''}
 ${wsReview(c.id).length?`<div class="warnbox sm">${wsReview(c.id).length} venta(s) a cuenta corriente marcadas para revisión por el servidor (${esc(wsReview(c.id).map(s=>s.n).slice(-5).join(', '))}).</div>`:''}
 ${can('credit_ov')?`<button class="btn sm" type="button" data-act="wsCredOv" data-id="${c.id}" data-need="0">Autorizar excepción de crédito</button>`:''}</div>`;}
function wsCustSave(c,w){if(!wsOn()||!$('#wc-ch',w)||$('#wc-ch',w).disabled)return'';
 const ch=(wsOnly()||val('wc-ch')==='mayorista')?'mayorista':'minorista',tx=val('wc-tx').replace(/\D/g,''),tm=val('wc-tm').trim()===''?0:Math.round(parseNum(val('wc-tm'))),zn=val('wc-zn').trim().slice(0,30),sl=val('wc-sl').trim().slice(0,30);
 if(tx&&!arcaCuitOk(tx))return'El CUIT no es válido (11 dígitos con dígito verificador correcto).';
 if(ch==='mayorista'&&!tx&&!wsOnly())return'Para marcar al cliente como mayorista cargá su CUIT.';
 if(isNaN(tm)||tm<0||tm>365)return'El plazo va de 1 a 365 días (o vacío).';
 const chg=[];const cmp=(k,a,b)=>{if(String(a||'')!==String(b||''))chg.push(k+': '+(a||'—')+' → '+(b||'—'));};
 cmp('canal',c.channel||'minorista',ch);cmp('CUIT',c.taxid?'cargado':'',tx?'cargado':'');cmp('plazo',c.term>0?c.term:'',tm>0?tm:'');cmp('zona',c.zone,zn);cmp('vendedor',c.seller,sl);
 c.channel=ch;c.taxid=tx;c.term=tm;c.zone=zn;c.seller=sl;
 if(chg.length)audit('CLIENTE_MAYORISTA',custFull(c)+' · '+chg.join(' · '));return'';}

/* ---- producto: precios por presentación (dentro del alta/edición del producto) y piso ---- */
const wsNumStr=n=>(n===undefined||n===null||n===''||isNaN(n)||!n)?'':String(n).replace('.',',');
function wsProdBlock(p){if(!wsOn()||!can('price_lists'))return'';const conf=wsConf();const P=(p&&p.pres)||[];
 const row=lv=>{const k=P.find(x=>x.lv===lv.id)||{};const n=esc(lv.name);
  return`<div class="wplv"><div class="row" style="gap:.5rem"><b>${n}</b><span class="sm mut sp" id="wp-m-${lv.id}"></span></div>
  <div class="wpg"><div><label for="wp-q-${lv.id}">Unidades que trae</label><input id="wp-q-${lv.id}" inputmode="decimal" autocomplete="off" placeholder="Ej. 6" value="${esc(wsNumStr(k.qty))}"></div>
  <div><label for="wp-t-${lv.id}">Precio de la presentación $</label>${numIn('wp-t-'+lv.id,(k.qty>0&&k.unit>0)?Math.round(k.qty*k.unit):0,'Precio')}</div>
  <div><label for="wp-u-${lv.id}">Precio por unidad $</label>${numIn('wp-u-'+lv.id,k.unit||0,'Por unidad')}</div>
  <div><label for="wp-b-${lv.id}">Código de barras</label><input id="wp-b-${lv.id}" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="Opcional" value="${esc(k.barcode||'')}"></div></div></div>`;};
 return`<div class="card" id="wp-box" style="margin:.6rem 0"><h4 style="margin:0 0 .2rem">Precios mayoristas por presentación</h4>
 <p class="sm mut">La <b>Unidad</b> es el precio final de venta de arriba. En cada presentación cargá cuántas unidades trae y su precio (el de la presentación o el de cada unidad: el otro se completa solo). En Vender, al cliente mayorista se le cobra el precio por unidad de la presentación más grande que alcance la cantidad que lleva. Lo que dejés vacío no se usa.</p>
 <div class="wplv"><div class="row" style="gap:.5rem"><b>Unidad</b><span class="sm mut" id="wp-m-u">1 unidad · precio de venta</span></div></div>
 ${conf.levels.map(row).join('')}
 ${conf.levels.length?'':'<p class="sm mut">Todavía no hay presentaciones definidas: se crean en Configuración → Mayorista y minorista.</p>'}
 <label for="wp-fl">Piso de precio por unidad (opcional): por debajo exige supervisor y motivo</label>${numIn('wp-fl',(p&&p.floor)||0,'Sin piso')}</div>`;}
function wsProdBind(w,cv){if(!$('#wp-box',w))return;const conf=wsConf();
 const refresh=()=>{const pr=cents(val('pm-f')),cost=cv?cents(val('pm-c')===''?'0':val('pm-c')):0;const ok=!isNaN(pr)&&pr>0;
  const mu=$('#wp-m-u',w);if(mu)mu.textContent='1 unidad · '+(ok?money(pr):'cargá el precio de venta')+((ok&&cv&&cost>0)?' · margen '+numAR((pr-cost)/pr*100,1)+' %':'');
  conf.levels.forEach(lv=>{const q=parseNum(val('wp-q-'+lv.id)),u=cents(val('wp-u-'+lv.id)),m=$('#wp-m-'+lv.id,w);if(!m)return;
   if(!(q>0)||isNaN(u)||!(u>0)){m.textContent='';return;}
   let t=(ok?numAR((pr-u)/pr*100,1)+' % menos que la unidad':'');if(cv&&cost>0)t+=(t?' · ':'')+'margen '+numAR((u-cost)/u*100,1)+' %'+(u<cost?' (¡bajo el costo!)':'');m.textContent=t;});};
 w.addEventListener('input',e=>{const id=e.target.id||'';const m=id.match(/^wp-([qtu])-(.+)$/);
  if(m){const lv=m[2],qe=$('#wp-q-'+lv,w),te=$('#wp-t-'+lv,w),ue=$('#wp-u-'+lv,w);const q=parseNum(qe.value);
   if(q>0){const u=cents(ue.value),t=cents(te.value);const uOk=ue.value.trim()!==''&&!isNaN(u)&&u>0,tOk=te.value.trim()!==''&&!isNaN(t)&&t>0;
    if(m[1]==='u'){te.value=uOk?pesosStr(Math.round(u*q)):'';}
    else if(m[1]==='t'){ue.value=tOk?pesosStr(Math.round(t/q)):'';}
    else if(uOk)te.value=pesosStr(Math.round(u*q));else if(tOk)ue.value=pesosStr(Math.round(t/q));}}
  refresh();});
 refresh();}
/* lee y valida las presentaciones del formulario del producto (null si el bloque no está en pantalla) */
function wsProdRead(p,pr,bc,cost){if(!wsOn()||!can('price_lists')||!$('#wp-box'))return null;const conf=wsConf();const isU=val('pm-u')==='u';
 const bcs=new Set(S.products.filter(x=>!p||x.id!==p.id).flatMap(x=>[x.barcode].concat(wsPres(x).map(k=>k.barcode))).filter(Boolean));if(bc)bcs.add(bc);
 const pres=[],warns=[];
 for(const lv of conf.levels){const q=val('wp-q-'+lv.id).trim(),t=val('wp-t-'+lv.id).trim(),u=val('wp-u-'+lv.id).trim(),b=val('wp-b-'+lv.id).trim();
  if(!q&&!t&&!u&&!b)continue;const n=lv.name;
  const qty=parseNum(q);if(!(qty>0))return{err:n+': indicá cuántas unidades trae.'};
  if(isU&&!Number.isInteger(qty))return{err:n+': este producto se cuenta en unidades enteras.'};
  const unit=u!==''?cents(u):(t!==''?Math.round(cents(t)/qty):NaN);
  if(isNaN(unit)||!(unit>0))return{err:n+': cargá el precio (de la presentación o por unidad).'};
  if(unit>pr)return{err:n+': el precio por unidad ('+money(unit)+') no puede ser mayor que el precio de la unidad ('+money(pr)+').'};
  if(b){if(bcs.has(b))return{err:n+': el código de barras ya lo usa otro artículo o presentación.'};bcs.add(b);}
  if(cost>0&&unit<cost)warns.push(n+' queda bajo el costo');
  pres.push({lv:lv.id,qty:Math.round(qty*1000)/1000,unit,barcode:b});}
 pres.sort((a,b)=>a.qty-b.qty);
 for(let i=1;i<pres.length;i++){if(pres[i].qty===pres[i-1].qty)return{err:wsLvName(pres[i].lv)+' y '+wsLvName(pres[i-1].lv)+' traen la misma cantidad de unidades.'};
  if(pres[i].unit>pres[i-1].unit)return{err:wsLvName(pres[i].lv)+' ('+numAR(pres[i].qty,3)+' u) cuesta más por unidad que '+wsLvName(pres[i-1].lv)+' ('+numAR(pres[i-1].qty,3)+' u): el precio tiene que bajar a medida que sube la cantidad.'};}
 const fv=val('wp-fl').trim();const floor=fv===''?0:cents(fv);if(isNaN(floor)||floor<0)return{err:'El piso de precio no es válido.'};
 return{pres,floor,warns};}
/* ---- inventario: columna de precios mayoristas y stock por presentación ---- */
const wsInvTh=()=>wsOn()?'<th>Precios por presentación</th>':'';
const wsInvCols=()=>wsOn()?1:0;
function wsInvTd(p){if(!wsOn())return'';const P=wsPres(p);
 return`<td class="sm">${P.length?`<div>Unidad <b>${money(p.price)}</b></div>`+P.map(k=>`<div>${esc(wsLvName(k.lv))} ×${numAR(k.qty,3)}: <b>${money(Math.round(k.unit*k.qty))}</b> <span class="mut">(${money(k.unit)} c/u)</span></div>`).join(''):'<span class="mut">Sin presentaciones</span>'}</td>`;}
const wsStockSub=p=>{const s=wsStockStr(p,p.stock);return s?`<div class="sm mut">${esc(s)}</div>`:'';};

/* ---- acuerdos especiales ---- */
A.wsAgr=()=>{if(!can('price_lists'))return toast('Sin permiso para crear acuerdos.',1);
 const cs=S.customers.filter(c=>c.status!=='baja');if(!cs.length)return toast('Primero cargá un cliente.',1);
 modal('Acuerdo especial',`<label for="wa-c">Cliente</label><select id="wa-c">${cs.map(c=>`<option value="${c.id}">${esc(custFull(c))} · ${esc(pad4(c.num))}</option>`).join('')}</select>
 <label for="wa-p">Producto o ${RW()}</label><select id="wa-p"><optgroup label="${ownerMode()?'Categoría completa':'Rubro completo'}">${S.rubros.filter(r=>r.kind==='rubro').map(r=>`<option value="r:${r.id}">${ownerMode()?'Toda la categoría':'Todo el rubro'}: ${esc(r.name)}</option>`).join('')}</optgroup><optgroup label="Producto">${S.products.filter(p=>p.active).map(p=>`<option value="p:${p.id}">${esc(pfull(p))}</option>`).join('')}</optgroup></select>
 <div class="grid g2"><div><label for="wa-k">Tipo</label><select id="wa-k"><option value="price">Precio fijo por unidad ($)</option><option value="pct">Porcentaje de descuento sobre el precio minorista</option></select></div><div><label for="wa-v">Valor</label><input id="wa-v" inputmode="decimal" placeholder="Valor" autocomplete="off"></div></div>
 <div class="grid g2"><div><label for="wa-f">Vigente desde</label><input id="wa-f" type="date"></div><div><label for="wa-t">Hasta (opcional)</label><input id="wa-t" type="date"></div></div>
 <p class="sm mut">El acuerdo reemplaza a la lista y a los escalones mientras esté vigente. Un acuerdo por precio fijo sobre ${ownerMode()?'una categoría completa':'un rubro completo'} no se admite (usá porcentaje).</p>`,
 {okText:'Crear acuerdo',onOk:w=>{const cid=val('wa-c'),pv=val('wa-p'),k=val('wa-k'),f=val('wa-f'),t=val('wa-t');
  const a={id:uid(),cust:cid,active:true,from:f,to:t,by:user?user.name:'sistema',ts:now()};
  if(pv.startsWith('p:'))a.pid=pv.slice(2);else a.rubro=pv.slice(2);
  if(k==='price'){if(a.rubro)return w._err('Para un rubro completo usá porcentaje.'),false;const c=cents(val('wa-v'));if(isNaN(c)||c<=0)return w._err('El precio no es válido.'),false;a.price=c;a.pct=0;}
  else{const n=parseNum(val('wa-v'));if(!(n>0&&n<100))return w._err('El porcentaje va de 0 a 100 (sin incluirlos).'),false;a.pct=n;a.price=0;}
  if(f&&t&&t<f)return w._err('La fecha final no puede ser anterior a la inicial.'),false;
  const clash=(S.agreements||[]).find(x=>x.active!==false&&x.cust===cid&&(x.pid||'')===(a.pid||'')&&(x.rubro||'')===(a.rubro||'')&&(x.from||'0000')<=(t||'9999')&&(f||'0000')<=(x.to||'9999'));
  if(clash)return w._err('Ya hay un acuerdo vigente para ese cliente y ese producto/'+RW()+' en esas fechas.'),false;
  (S.agreements=S.agreements||[]).push(a);audit('ACUERDO_ESPECIAL',custFull(custById(cid))+' · '+(a.pid?pfull(prod(a.pid)||{name:a.pid}):'rubro '+rubName(a.rubro))+' · '+(a.price?money(a.price):a.pct+' % off')+' · '+(f||'ya')+' a '+(t||'sin fin'));
  save();rerender();toast('Acuerdo creado');}});};
A.wsAgrOff=el=>{const a=(S.agreements||[]).find(x=>x.id===el.dataset.id);if(!a||!can('price_lists'))return;
 confirmBox('Desactivar acuerdo','El cliente vuelve a su lista. Las ventas ya hechas no cambian.',()=>{a.active=false;audit('ACUERDO_ESPECIAL_BAJA',custFull(custById(a.cust))+' · '+(a.pid||a.rubro));save();rerender();},'Desactivar');};

/* ---- Configuración → Mayorista y minorista ---- */
function wsCfgCard(){if(!(can('config')||can('price_lists')))return'';const c=wsConf();const adm=can('config')?'':'disabled';
 const ag=(S.agreements||[]).slice().reverse();const ov=(S.creditOv||[]).slice(-5).reverse();
 return`<div class="card" style="margin-top:1rem" id="ws-card"><h3>Mayorista y minorista ${c.example?'<span class="tag sim">datos de ejemplo</span>':''}</h3>
 <p class="sm mut">Precios por presentación (Unidad, Display, Fardo, Pallet…) según el volumen, acuerdos por cliente y crédito con plazo. Apagado, el sistema vende exactamente como siempre.</p>
 <label class="chk"><input type="checkbox" id="ws-on" ${c.on?'checked':''} ${adm}> Activar canal mayorista</label>
 ${c.on?`<label class="chk"><input type="checkbox" id="ws-only" ${c.only?'checked':''} ${adm}> <span><b>Sólo mayorista (distribuidora)</b> — toda venta usa precio por unidad y, al completar una presentación, su precio mayorista; no hay canal minorista ni «Cambiar canal», y no hace falta CUIT para vender (sí para cuenta corriente, un cliente identificado)</span></label>`:''}
 ${typeof CLOUD_HOOK!=='undefined'&&CLOUD_HOOK&&!c.on?'<div class="warnbox sm">Con la nube activa, antes de activarlo hay que haber corrido el archivo <b>10-mayorista-precios.sql</b> en Supabase (acuerdos, excepciones de crédito y revisión de crédito del servidor). Si no, el servidor rechaza esos registros y la barra de sincronización lo muestra.</div>':''}
 ${c.on?`<h4 style="margin:.8rem 0 .2rem">Presentaciones de venta</h4>
 <p class="sm mut">Son los «tipos de precio» que se cargan en cada producto según el volumen: <b>Unidad</b> (siempre; es el precio de venta) y las que definas acá. Podés renombrarlas y agregar las que necesites (Media caja, Bolsón…). En cada producto se carga cuántas unidades trae cada una y su precio.</p>
 <div id="ws-lv">${c.levels.map(l=>`<div class="row" style="margin-bottom:.3rem"><input id="ws-ln-${esc(l.id)}" maxlength="24" value="${esc(l.name)}" aria-label="Nombre de la presentación" style="max-width:240px" ${adm}>${adm===''?`<button class="btn sm red" type="button" data-act="wsLvDel" data-id="${esc(l.id)}" aria-label="Quitar ${esc(l.name)}">Quitar</button>`:''}<span class="sm mut">${(S.products||[]).filter(p=>(p.pres||[]).some(k=>k.lv===l.id)).length} producto(s) la usan</span></div>`).join('')||'<p class="sm mut">Sin presentaciones: sólo se vende por Unidad.</p>'}</div>
 ${adm===''&&c.levels.length<7?'<button class="btn sm" type="button" data-act="wsLvAdd">+ Agregar presentación</button>':''}
 <div class="grid g2"><div><label for="ws-gr">Tolerancia de mora (días después del vencimiento)</label><input id="ws-gr" inputmode="numeric" maxlength="2" placeholder="0" value="${c.grace?c.grace:''}" ${adm}></div><div><label class="chk" style="margin-top:1.6rem"><input type="checkbox" id="ws-club" ${c.allowClub?'checked':''} ${adm}> Permitir cupones, membresía y sellos del Club en ventas mayoristas</label></div></div>`:''}
 ${adm===''?`<div class="row"><button class="btn gold" data-act="wsSave">Guardar</button></div>`:''}
 ${c.on?`<h4 style="margin:.8rem 0 .2rem">Acuerdos especiales</h4>${ag.length?`<div class="tw"><table><caption class="sr">Acuerdos especiales</caption><thead><tr><th>Cliente</th><th>Producto / ${RW()}</th><th>Condición</th><th>Vigencia</th><th></th></tr></thead><tbody>${ag.map(a=>`<tr><td>${esc(custFull(custById(a.cust)))}</td><td>${esc(a.pid?pfull(prod(a.pid)||{name:a.pid}):RW(1)+' '+rubName(a.rubro))}</td><td>${a.price?money(a.price):esc(a.pct+' % off')}</td><td>${esc((a.from||'ya')+' → '+(a.to||'sin fin'))} ${a.active===false?'<span class="tag">inactivo</span>':wsDateOk(a.from,a.to)?'<span class="tag ok">vigente</span>':'<span class="tag warn">fuera de fecha</span>'}</td><td>${a.active!==false&&can('price_lists')?`<button class="btn sm" data-act="wsAgrOff" data-id="${a.id}">Desactivar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="sm mut">Todavía no hay acuerdos.</p>'}
 ${can('price_lists')?'<button class="btn sm" data-act="wsAgr">+ Nuevo acuerdo</button>':''}
 ${wsReview().length?`<div class="warnbox sm" role="status"><b>${wsReview().length} venta(s) a revisar:</b> el servidor las marcó porque superaron el límite de crédito mientras el equipo estaba sin conexión. ${esc(wsReview().slice(-5).map(s=>s.n+' ('+(wsCrw[(s.crw||'').split('+')[0]]||'revisar')+')').join(' · '))}</div>`:''}
 <h4 style="margin:.8rem 0 .2rem">Excepciones de crédito recientes</h4>${ov.length?`<ul class="sm">${ov.map(o=>`<li>${esc(custFull(custById(o.cust)))} · hasta ${money(o.max)} · ${esc(o.by)} · «${esc(o.reason)}» · ${(S.creditUse||[]).some(u=>u.ov===o.id)?'usada':o.until>now()?'vigente':'vencida'}</li>`).join('')}</ul>`:'<p class="sm mut">Ninguna.</p>'}`:''}</div>`;}
/* nombres de presentaciones tal como están en pantalla (o las guardadas si la tarjeta no está abierta) */
function wsLvRead(){const cur=wsConf().levels;const out=[];const names=new Set(['unidad']);
 for(const l of cur){const e=$('#ws-ln-'+l.id);const n=(e?e.value:l.name).trim().replace(/[<>]/g,'').slice(0,24);if(!n)return{err:'Falta el nombre de una presentación.'};
  if(names.has(n.toLowerCase()))return{err:'Hay dos presentaciones con el nombre «'+n+'» (o se llama «Unidad», que ya existe).'};names.add(n.toLowerCase());out.push({id:l.id,name:n});}
 return{levels:out};}
function wsLvSave(levels,msg){const cur=wsConf();const W=Object.assign({},S.cfg.wholesale||{},{levels});delete W.lists;S.cfg.wholesale=W;audit('MAYORISTA_PRESENTACIONES',msg+' · '+levels.map(l=>l.name).join(', '));save();rerender();}
A.wsLvAdd=()=>{if(!can('config'))return toast('Sólo el administrador',1);const L=wsLvRead();if(L.err)return toast(L.err,1);
 modal('Agregar presentación',`<label for="lv-n">Nombre (ej. Media caja, Bolsón)</label><input id="lv-n" maxlength="24" autocomplete="off">`,
 {okText:'Agregar',onOk:w=>{const n=val('lv-n').trim().replace(/[<>]/g,'');if(!n)return w._err('Escribí el nombre.'),false;
  if(L.levels.some(l=>l.name.toLowerCase()===n.toLowerCase())||n.toLowerCase()==='unidad')return w._err('Ya existe una presentación con ese nombre.'),false;
  const id='x'+Date.now().toString(36).slice(-6);wsLvSave(L.levels.concat([{id,name:n}]),'agregada «'+n+'»');toast('Presentación agregada');}});};
A.wsLvDel=el=>{if(!can('config'))return toast('Sólo el administrador',1);const L=wsLvRead();if(L.err)return toast(L.err,1);const l=L.levels.find(x=>x.id===el.dataset.id);if(!l)return;
 const n=S.products.filter(p=>(p.pres||[]).some(k=>k.lv===l.id)).length;
 if(n)return toast('«'+l.name+'» está cargada en '+n+' producto(s): primero sacala de esos productos.',1);
 confirmBox('Quitar presentación','Se quita «'+l.name+'» de la lista. Ningún producto la usa.',()=>{wsLvSave(L.levels.filter(x=>x.id!==l.id),'quitada «'+l.name+'»');},'Quitar');};
A.wsSave=()=>{if(!can('config'))return toast('Sólo el administrador',1);const cur=wsConf();const on=$('#ws-on')?$('#ws-on').checked:cur.on;
 const W=Object.assign({},S.cfg.wholesale||{},{on,allowClub:cur.allowClub,grace:cur.grace,example:cur.example,levels:cur.levels.map(l=>({...l}))});delete W.lists;
 if(on&&cur.on){W.only=!!($('#ws-only')&&$('#ws-only').checked);W.allowClub=!!($('#ws-club')&&$('#ws-club').checked);const g=val('ws-gr').trim()===''?0:Math.round(parseNum(val('ws-gr')));if(isNaN(g)||g<0||g>60)return toast('La tolerancia de mora va de 0 a 60 días.',1);W.grace=g;
  const L=wsLvRead();if(L.err)return toast(L.err,1);W.levels=L.levels;}
 const apply=()=>{const before=JSON.stringify(S.cfg.wholesale||{});S.cfg.wholesale=W;audit(on!==cur.on?(on?'MAYORISTA_ACTIVAR':'MAYORISTA_APAGAR'):'MAYORISTA_CONFIG','antes '+before.slice(0,160)+' · ahora '+JSON.stringify(W).slice(0,160));save();rerender();toast('Guardado');};
 if(on!==cur.on)confirmBox(on?'Activar canal mayorista':'Apagar canal mayorista',on?'Aparecen los precios por presentación (Unidad, Display, Fardo, Pallet…), los acuerdos por cliente y el crédito con plazo. Las ventas anteriores no cambian.':'Se vende como minorista otra vez. Las presentaciones, acuerdos y precios quedan guardados y las ventas anteriores no cambian.',apply,on?'Activar':'Apagar');else apply();};
