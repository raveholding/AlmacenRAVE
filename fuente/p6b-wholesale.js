/* ===== Mayorista / minorista · 4.22 · fase F1 =====
   Un solo punto de cálculo de precio (priceResolve) para la pantalla y para commitSale.
   Todo detrás de S.cfg.wholesale.on (apagado en el sistema del cliente: el comportamiento no cambia). */
const WS_IDS=['L1','L2','L3','L4','L5'];
const WS_NAMES={L1:'Minorista (base)',L2:'Mayorista 1 · por bulto',L3:'Mayorista 2',L4:'Mayorista 3 · distribuidor',L5:'Especial / VIP'};
const WS_DAY=86400000;
function wsConf(){const w=(S.cfg&&S.cfg.wholesale)||{};
 const lists=WS_IDS.map(id=>{const x=(w.lists||[]).find(q=>q&&q.id===id)||{};
  return{id,name:String(x.name||WS_NAMES[id]).slice(0,40),on:id==='L1'?true:(x.on===undefined?id==='L2':!!x.on),taxIncl:x.taxIncl!==false,from:x.from||'',to:x.to||''};});
 return{on:!!w.on,allowClub:!!w.allowClub,grace:Math.max(0,Math.min(60,Math.round(+w.grace||0))),example:!!w.example,lists};}
const wsOn=()=>wsConf().on;
const wsDateOk=(f,t)=>{const k=dkey(now());return(!f||k>=f)&&(!t||k<=t);};
function wsListOk(id){const l=wsConf().lists.find(x=>x.id===id);return!!(l&&l.on&&wsDateOk(l.from,l.to));}
function wsListName(id){const l=wsConf().lists.find(x=>x.id===id);return l?l.name:id;}
const wsIsWh=c=>!!(c&&c.channel==='mayorista');
function wsChan(){if(pos.chanSet&&pos.chanSet.cust===pos.cust)return pos.chanSet.v;return wsIsWh(custById(pos.cust))?'mayorista':'minorista';}
function wsListFor(cust,chan){
 if(cust&&cust.list&&wsListOk(cust.list))return cust.list;
 if(chan==='mayorista'){if(wsListOk('L2'))return'L2';return WS_IDS.find(i=>i!=='L1'&&wsListOk(i))||'L1';}
 return'L1';}
function wsAgreement(cid,p){const A_=(S.agreements||[]).filter(a=>a&&a.active!==false&&a.cust===cid&&wsDateOk(a.from,a.to));
 return A_.find(a=>a.pid&&a.pid===p.id)||A_.find(a=>!a.pid&&a.rubro&&a.rubro===p.rubro)||null;}
const wsTiers=(p,lid)=>(p.tiers||[]).filter(t=>t&&t.list===lid&&t.from>0).sort((a,b)=>a.from-b.from);
function wsTierFor(p,lid,qty){const T=wsTiers(p,lid);let hit=null;
 for(let i=0;i<T.length;i++){if(qty>=T[i].from-1e-9)hit=T[i];}
 if(hit&&hit.to&&qty>hit.to+1e-9)return null;   /* hueco entre escalones: rige el precio de la lista */
 return hit;}
function wsClosedQty(p){const c=(p.packs||[]).filter(k=>k&&k.mode==='bulto_cerrado'&&k.qty>0);return c.length?Math.min(...c.map(k=>k.qty)):0;}
function wsQtyErr(lines){const agg={};lines.forEach(l=>agg[l.pid]=(agg[l.pid]||0)+l.qty);
 for(const pid in agg){const p=prod(pid);const m=p?wsClosedQty(p):0;if(m){const r=agg[pid]/m;if(Math.abs(r-Math.round(r))>1e-9)return p.name+' se vende sólo por bulto cerrado: la cantidad tiene que ser múltiplo de '+m+' (hoy '+numAR(agg[pid],3)+').';}}
 return'';}
/* ---- resolución determinista del precio (4.22.1.3) ----
   base L1 → acuerdo del cliente (gana) → lista del cliente (si falta el producto: L1 y se informa) → escalón (nunca sube) → bulto cerrado (nunca sube) → piso */
function priceResolve(p,qty,ctx){
 ctx=ctx||{};const cust=ctx.cust||null,chan=ctx.chan||'minorista';
 const R={price:p.price,base:p.price,alt:p.price,rule:'L1',list:'L1',why:'Minorista · lista L1',missing:'',below:false,warn:''};
 if(!wsOn())return R;
 const fin=()=>{R.below=!!(p.floor>0&&R.price<p.floor);return R;};
 if(chan==='mayorista'&&!(cust&&arcaCuitOk(cust.taxid||''))){R.warn='cuit';R.why='Mayorista sin cliente con CUIT válido: precio minorista';return fin();}
 const ag=cust?wsAgreement(cust.id,p):null;
 if(ag){R.price=ag.price>0?ag.price:Math.round(p.price*(1-ag.pct/100));R.rule='ACU';R.list='ACU';R.agr=ag.id;R.why='Acuerdo especial'+(ag.pid?'':' (rubro)')+' · '+(ag.price>0?money(ag.price):ag.pct+' % off');return fin();}
 let lid=wsListFor(cust,chan);const pre=chan==='mayorista'?'Mayorista':'Lista';
 if(lid!=='L1'){const lp=p.prices&&p.prices[lid];
  if(lp>0){R.price=lp;R.list=lid;R.rule=lid;R.why=pre+' · '+wsListName(lid)+' ('+lid+')';}
  else{R.why='Sin precio en '+wsListName(lid)+' ('+lid+'): se usa L1 minorista';lid='L1';}}
 const t=wsTierFor(p,lid,qty);
 if(t){const tp=t.price>0?t.price:Math.round(R.price*(1-t.pct/100));
  if(tp>0&&tp<R.price){R.price=tp;R.rule=lid+'-E'+t.from;R.why=pre+' · '+lid+' · escalón '+numAR(t.from,3)+(t.to?'–'+numAR(t.to,3):' o más')+' u';R.tier=t;}}
 else{const nx=wsTiers(p,lid).find(x=>x.from>qty+1e-9);
  if(nx){const np=nx.price>0?nx.price:Math.round(R.price*(1-nx.pct/100));if(np<R.price)R.missing='Faltan '+numAR(nx.from-qty,3)+' u para el precio de '+numAR(nx.from,3)+(nx.to?'–'+numAR(nx.to,3):' o más')+' u ('+money(np)+')';}}
 /* bulto cerrado: la presentación más grande que divide la cantidad */
 const pk=(p.packs||[]).filter(k=>k&&k.qty>0&&(k.fixed>0||k.pct>0)&&qty>=k.qty-1e-9&&Math.abs(qty/k.qty-Math.round(qty/k.qty))<1e-9).sort((a,b)=>b.qty-a.qty)[0];
 if(pk){const up=pk.fixed>0?Math.round(pk.fixed/pk.qty):Math.round(R.price*(1-pk.pct/100));
  if(up>0&&up<R.price){R.price=up;R.rule+='+B'+pk.qty;R.why+=' · bulto cerrado ×'+pk.qty;R.pack=pk;}}
 return fin();}
/* recalcula las líneas del ticket en curso (las que no tienen precio puesto a mano) */
function wsRecalc(){if(!wsOn()||typeof pos==='undefined')return;
 const cust=custById(pos.cust),chan=wsChan();const agg={};pos.lines.forEach(l=>agg[l.pid]=(agg[l.pid]||0)+l.qty);
 pos.lines.forEach(l=>{const p=prod(l.pid);if(!p)return;
  if(l.man){l.rule='MAN';l.lst='';l.why='Precio puesto a mano (queda auditado)';l.miss='';return;}
  const r=priceResolve(p,agg[l.pid],{cust,chan});
  if(l.price!==r.price){delete l.flrOk;}
  l.price=r.price;l.list=r.price;l.rule=r.rule;l.lst=r.list;l.base=r.base;l.why=r.why;l.miss=r.missing;});}
/* validaciones y precios finales al cobrar (el mismo cálculo que la pantalla) */
function wsGate(lines,cust,opts){
 const chan=opts.ws.chan==='mayorista'?'mayorista':'minorista';const conf=wsConf();
 if(chan==='mayorista'){
  if(!cust)return{err:'El canal mayorista exige un cliente identificado.'};
  if(!arcaCuitOk(cust.taxid||''))return{err:'El cliente '+custFull(cust)+' no tiene un CUIT válido cargado: el canal mayorista lo exige.'};
  if(!conf.allowClub){if(opts.coupon)return{err:'Los cupones del Club no se aplican a ventas mayoristas.'};if(opts.stampCode)return{err:'Los sellos del Club no se otorgan en ventas mayoristas.'};}}
 const e=wsQtyErr(lines);if(e)return{err:e};
 const agg={};lines.forEach(l=>agg[l.pid]=(agg[l.pid]||0)+l.qty);
 for(const l of lines){const p=prod(l.pid);if(!p)continue;
  if(l.man){l.rule='MAN';l.lst='';}
  else{const r=priceResolve(p,agg[l.pid],{cust,chan});if(l.price!==r.price)delete l.flrOk;l.price=r.price;l.rule=r.rule;l.lst=r.list;l.base=r.base;l.why=r.why;}
  if(p.floor>0&&l.price<p.floor&&!l.flrOk)return{err:'El precio de '+p.name+' ('+money(l.price)+') está por debajo del piso ('+money(p.floor)+'): lo tiene que autorizar un supervisor con motivo.'};}
 return{chan,club:conf.allowClub};}
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
 const c=custById(pos.cust),ch=wsChan();const miss=ch==='mayorista'&&!(c&&arcaCuitOk(c.taxid||''));
 const lid=wsListFor(c,ch);
 return`<div class="card" style="margin:.5rem 0" id="wsbar"><div class="row" style="flex-wrap:wrap"><span class="tag ${ch==='mayorista'?'ok':''}">Canal: ${ch==='mayorista'?'Mayorista':'Minorista'}</span><b class="sp">${c?esc(custFull(c)):'Consumidor final'}</b><button class="btn sm" data-act="wsPick">${c?'Cambiar cliente':'Elegir cliente'}</button>${c?'<button class="btn sm" data-act="wsPickClear">Quitar</button>':''}<button class="btn sm" data-act="wsChan">Cambiar canal</button></div>
 ${miss?'<div class="warnbox sm" role="status">El canal mayorista exige un cliente identificado con CUIT válido. Mientras tanto se cobra a precio minorista.</div>':`<p class="sm mut" style="margin:.3rem 0 0">Lista aplicada: <b>${esc(wsListName(lid))}</b>${c&&ch==='mayorista'?' · crédito: debe '+money(debtOf(c.id))+' de '+money(c.limit||0)+(c.term>0?' · plazo '+c.term+' días':''):''}</p>`}</div>`;}
function wsLineInfo(l,i){if(!wsOn())return'';const p=prod(l.pid);let h='';
 if(l.why)h+=`<div class="sm ${l.rule==='MAN'?'mut':''}" style="margin-top:.3rem"><b>${esc(l.rule==='L1'||!l.rule?'Minorista':l.rule==='MAN'?'A mano':'Mayorista')}</b> · ${esc(l.why)}</div>`;
 if(l.miss)h+=`<div class="sm mut">${esc(l.miss)}</div>`;
 if(p){const m=wsClosedQty(p);if(m){const r=l.qty/m;if(Math.abs(r-Math.round(r))>1e-9)h+=`<div class="tag bad" style="margin-top:.3rem">Sólo bulto cerrado: múltiplos de ${m}</div>`;}
  if(p.floor>0&&l.price<p.floor)h+=`<div class="tag bad" style="margin-top:.3rem">Debajo del piso (${money(p.floor)})${l.flrOk?' · autorizado':''}</div>${!l.flrOk&&can('price_lists')?` <button class="btn sm" data-act="wsFloor" data-i="${i}">Autorizar</button>`:''}`;
  const pk=(p.packs||[]).filter(k=>k&&k.qty>0);if(pk.length)h+=`<div class="row" style="margin-top:.3rem;flex-wrap:wrap">${pk.map(k=>`<button class="btn sm" data-act="wsPack" data-i="${i}" data-k="${esc(k.id)}">+ ${esc(k.name)} (×${numAR(k.qty,3)})</button>`).join('')}</div>`;}
 return h;}
const wsLineTag=l=>(wsOn()&&l.why&&l.rule&&l.rule!=='L1')?`<small class="mut"> · ${esc(l.rule==='MAN'?'a mano':l.rule)}</small>`:'';
function wsClubOff(){return`<p class="sm mut">Venta mayorista: no se aplican cupones, membresía ni sellos del Club (se puede habilitar en Configuración → Mayorista).</p>`;}
A.wsPack=el=>{const i=+el.dataset.i,L=pos.lines[i];if(!L)return;const p=prod(L.pid),k=p&&(p.packs||[]).find(x=>x.id===el.dataset.k);if(!k)return;
 lineEdit(i,'qty',String(Math.round((L.qty+k.qty)*1000)/1000).replace('.',','));};
function wsAddByPack(code){if(!wsOn())return false;
 const p=S.products.find(x=>x.active&&(x.packs||[]).some(k=>k&&k.barcode&&k.barcode===code));if(!p)return false;
 const k=p.packs.find(x=>x.barcode===code);A.padd({dataset:{id:p.id}});
 const i=pos.lines.findIndex(l=>l.pid===p.id);if(i>=0&&k.qty>1)lineEdit(i,'qty',String(Math.round((pos.lines[i].qty+k.qty-1)*1000)/1000).replace('.',','));
 return true;}
A.wsFloor=el=>{if(!can('price_lists'))return toast('Sin permiso',1);const i=+el.dataset.i,L=pos.lines[i];if(!L)return;
 modal('Autorizar precio bajo el piso',`<p class="sm">${esc(L.name)}: ${money(L.price)} (piso ${money((prod(L.pid)||{}).floor||0)}).</p><label for="fl-w">Motivo (obligatorio)</label><input id="fl-w" maxlength="120" autocomplete="off">`,
 {okText:'Autorizar',onOk:w=>{const why=val('fl-w').trim();if(why.length<5)return w._err('Escribí el motivo (mínimo 5 letras).'),false;L.flrOk=1;L.flrWhy=why;audit('PISO_PRECIO',L.name+' · '+money(L.price)+' bajo el piso · '+why);posCart();}});};
A.wsPick=()=>{const w=modal('Elegir cliente',`<label for="wk-q">Buscar por nombre, WhatsApp, DNI o CUIT</label><input id="wk-q" autocomplete="off" placeholder="Escribí para buscar"><div id="wk-res" style="margin-top:.4rem"></div>`,{okText:'Cerrar',onOk:()=>{}});
 w.addEventListener('input',e=>{if(e.target.id!=='wk-q')return;const L=wsCustFind(e.target.value);const r=$('#wk-res',w);
  r.innerHTML=L.map(c=>`<button class="btn sm" style="margin:.2rem .2rem 0 0" data-act="wsPickSet" data-id="${c.id}">${esc(custFull(c))} · ${esc(pad4(c.num))}${wsIsWh(c)?' · mayorista':''}</button>`).join('')||'<span class="sm mut">Sin resultados</span>';});
 setTimeout(()=>{const q=$('#wk-q');if(q)q.focus();},30);};
A.wsPickSet=el=>{pos.cust=el.dataset.id||'';pos.chanSet=null;$$('#modal-root .ov').forEach(o=>o.remove());posCart();};
A.wsPickClear=()=>{pos.cust='';pos.chanSet=null;posCart();};
A.wsChan=()=>{const c=custById(pos.cust),cur=wsChan(),to=cur==='mayorista'?'minorista':'mayorista',inh=wsIsWh(c)?'mayorista':'minorista';
 if(to===inh){pos.chanSet=null;posCart();return;}
 if(!can('price_lists'))return toast('Cambiar el canal de la operación requiere autorización (listas de precio).',1);
 modal('Cambiar canal de la operación',`<p class="sm">De <b>${cur}</b> a <b>${to}</b>. Queda en auditoría.</p><label for="wc-why">Motivo (obligatorio)</label><input id="wc-why" maxlength="80" autocomplete="off">`,
 {okText:'Cambiar',onOk:w=>{const why=val('wc-why').trim();if(why.length<5)return w._err('Escribí el motivo (mínimo 5 letras).'),false;pos.chanSet={cust:pos.cust,v:to};audit('CANAL_OPERACION',cur+' → '+to+' · '+why);posCart();}});};

/* ventas a cuenta corriente que el servidor marcó para revisar (superaron el límite mientras el equipo estaba sin conexión) */
const wsReview=cid=>S.sales.filter(s=>s.credit_review&&(!cid||s.cust===cid));
const wsCrw={sin_limite:'cliente sin límite',supera_limite:'superó el límite'};
/* ---- ficha del cliente: bloque mayorista ---- */
function wsCustCard(c){if(!wsOn()||!c)return'';const ed=can('price_lists')?'':'disabled';const lists=wsConf().lists.filter(l=>l.on);
 const ag=wsAging(c.id);const od=wsOverdue(c.id);
 return`<div class="card" style="margin:.6rem 0"><h3 style="margin-top:0">Mayorista y crédito</h3>
 <div class="grid g2"><div><label for="wc-ch">Canal habitual</label><select id="wc-ch" ${ed}><option value="minorista" ${!wsIsWh(c)?'selected':''}>Minorista</option><option value="mayorista" ${wsIsWh(c)?'selected':''}>Mayorista</option></select></div>
 <div><label for="wc-li">Lista de precios</label><select id="wc-li" ${ed}><option value="">— Según el canal —</option>${lists.map(l=>`<option value="${l.id}" ${c.list===l.id?'selected':''}>${esc(l.id+' · '+l.name)}</option>`).join('')}</select></div></div>
 <div class="grid g2"><div><label for="wc-tx">CUIT (obligatorio para vender como mayorista)</label><input id="wc-tx" inputmode="numeric" maxlength="13" autocomplete="off" placeholder="20-12345678-6" value="${esc(c.taxid||'')}" ${ed}></div>
 <div><label for="wc-tm">Plazo máximo de pago (días)</label><input id="wc-tm" inputmode="numeric" maxlength="3" autocomplete="off" placeholder="Sin plazo" value="${c.term>0?esc(String(c.term)):''}" ${ed}></div></div>
 <div class="grid g2"><div><label for="wc-zn">Zona de cobranza</label><input id="wc-zn" maxlength="30" autocomplete="off" value="${esc(c.zone||'')}" ${ed}></div><div><label for="wc-sl">Vendedor asignado</label><input id="wc-sl" maxlength="30" autocomplete="off" value="${esc(c.seller||'')}" ${ed}></div></div>
 <p class="sm mut">Antigüedad de saldos: ${ag.map(b=>`${b.k} d: <b>${money(b.t)}</b>`).join(' · ')}</p>
 ${od.length?`<div class="warnbox sm">Documentos vencidos: ${od.length} por ${money(od.reduce((a,d)=>a+d.left,0))}. La cuenta corriente queda bloqueada hasta cobrar o autorizar una excepción.</div>`:''}
 ${wsReview(c.id).length?`<div class="warnbox sm">${wsReview(c.id).length} venta(s) a cuenta corriente marcadas para revisión por el servidor (${esc(wsReview(c.id).map(s=>s.n).slice(-5).join(', '))}).</div>`:''}
 ${can('credit_ov')?`<button class="btn sm" type="button" data-act="wsCredOv" data-id="${c.id}" data-need="0">Autorizar excepción de crédito</button>`:''}</div>`;}
function wsCustSave(c,w){if(!wsOn()||!$('#wc-ch',w)||$('#wc-ch',w).disabled)return'';
 const ch=val('wc-ch')==='mayorista'?'mayorista':'minorista',li=val('wc-li'),tx=val('wc-tx').replace(/\D/g,''),tm=val('wc-tm').trim()===''?0:Math.round(parseNum(val('wc-tm'))),zn=val('wc-zn').trim().slice(0,30),sl=val('wc-sl').trim().slice(0,30);
 if(tx&&!arcaCuitOk(tx))return'El CUIT no es válido (11 dígitos con dígito verificador correcto).';
 if(ch==='mayorista'&&!tx)return'Para marcar al cliente como mayorista cargá su CUIT.';
 if(isNaN(tm)||tm<0||tm>365)return'El plazo va de 1 a 365 días (o vacío).';
 if(li&&!wsListOk(li))return'La lista elegida no está activa.';
 const chg=[];const cmp=(k,a,b)=>{if(String(a||'')!==String(b||''))chg.push(k+': '+(a||'—')+' → '+(b||'—'));};
 cmp('canal',c.channel||'minorista',ch);cmp('lista',c.list,li);cmp('CUIT',c.taxid?'cargado':'',tx?'cargado':'');cmp('plazo',c.term>0?c.term:'',tm>0?tm:'');cmp('zona',c.zone,zn);cmp('vendedor',c.seller,sl);
 c.channel=ch;c.list=li;c.taxid=tx;c.term=tm;c.zone=zn;c.seller=sl;
 if(chg.length)audit('CLIENTE_MAYORISTA',custFull(c)+' · '+chg.join(' · '));return'';}

/* ---- producto: listas, piso, escalones y presentaciones ---- */
function wsRowBtn(p){return(wsOn()&&can('price_lists'))?` <button class="btn sm" data-act="wsProd" data-id="${p.id}">Mayorista</button>`:'';}
const wsNumStr=n=>(n===undefined||n===null||n===''||isNaN(n)||!n)?'':String(n).replace('.',',');
A.wsProd=el=>{if(!can('price_lists'))return toast('Sin permiso para editar listas de precio.',1);const p=prod(el.dataset.id);if(!p)return;
 const conf=wsConf();const T=(p.tiers||[]).slice().sort((a,b)=>(a.list||'').localeCompare(b.list||'')||a.from-b.from);const K=p.packs||[];
 const opts=sel=>`<option value="">—</option>`+WS_IDS.map(id=>`<option value="${id}" ${sel===id?'selected':''}>${id}</option>`).join('');
 const trow=i=>{const t=T[i]||{};return`<div class="grid" style="grid-template-columns:5rem 1fr 1fr 6rem 1fr;gap:.4rem;margin-bottom:.3rem"><select id="wp-tl${i}" aria-label="Escalón ${i+1}: lista">${opts(t.list)}</select><input id="wp-tf${i}" inputmode="decimal" placeholder="Desde" aria-label="Escalón ${i+1}: desde" value="${esc(wsNumStr(t.from))}"><input id="wp-tt${i}" inputmode="decimal" placeholder="Hasta (vacío = sin tope)" aria-label="Escalón ${i+1}: hasta" value="${esc(wsNumStr(t.to))}"><select id="wp-tk${i}" aria-label="Escalón ${i+1}: tipo"><option value="price" ${!t.pct?'selected':''}>$ por u</option><option value="pct" ${t.pct?'selected':''}>% off</option></select><input id="wp-tv${i}" inputmode="decimal" placeholder="Valor" aria-label="Escalón ${i+1}: valor" value="${esc(t.pct?wsNumStr(t.pct):pesosStr(t.price||0))}"></div>`;};
 const krow=i=>{const k=K[i]||{};const bk=k.fixed>0?'fixed':(k.pct>0?'pct':'none');return`<div class="grid" style="grid-template-columns:1fr 5rem 1fr 7rem 6rem 5rem;gap:.4rem;margin-bottom:.3rem"><input id="wp-kn${i}" maxlength="24" placeholder="Nombre (Caja ×6)" aria-label="Presentación ${i+1}: nombre" value="${esc(k.name||'')}"><input id="wp-kq${i}" inputmode="decimal" placeholder="Unid." aria-label="Presentación ${i+1}: unidades base" value="${esc(wsNumStr(k.qty))}"><input id="wp-kb${i}" inputmode="numeric" placeholder="Código de barras" aria-label="Presentación ${i+1}: código" value="${esc(k.barcode||'')}"><select id="wp-km${i}" aria-label="Presentación ${i+1}: modalidad"><option value="ambas" ${k.mode!=='bulto_cerrado'?'selected':''}>Suelta y bulto</option><option value="bulto_cerrado" ${k.mode==='bulto_cerrado'?'selected':''}>Sólo bulto</option></select><select id="wp-kk${i}" aria-label="Presentación ${i+1}: bonificación"><option value="none" ${bk==='none'?'selected':''}>Sin bonif.</option><option value="fixed" ${bk==='fixed'?'selected':''}>$ x bulto</option><option value="pct" ${bk==='pct'?'selected':''}>% off</option></select><input id="wp-kv${i}" inputmode="decimal" placeholder="Valor" aria-label="Presentación ${i+1}: valor" value="${esc(bk==='fixed'?pesosStr(k.fixed):bk==='pct'?wsNumStr(k.pct):'')}"></div>`;};
 modal('Mayorista · '+pfull(p),`<p class="sm mut">Precio minorista (L1): <b>${money(p.price)}</b>. Lo que dejes vacío cae al precio minorista. Las cantidades van en unidad base (${esc(unitLbl(p.unit))}).</p>
 <h4 style="margin:.5rem 0 .2rem">Precio por lista</h4><div class="grid g2">${conf.lists.filter(l=>l.id!=='L1').map(l=>`<div><label for="wp-p${l.id}">${esc(l.id+' · '+l.name)}${l.on?'':' (apagada)'}</label>${numIn('wp-p'+l.id,(p.prices||{})[l.id]||0,'Sin precio')}</div>`).join('')}</div>
 <label for="wp-fl">Piso de precio (opcional): por debajo exige supervisor y motivo</label>${numIn('wp-fl',p.floor||0,'Sin piso')}
 <h4 style="margin:.6rem 0 .2rem">Escalones por cantidad (no se pueden solapar)</h4><p class="sm mut">Lista · desde · hasta · tipo · valor. Un escalón nunca sube el precio.</p>${[0,1,2,3,4,5].map(trow).join('')}
 <h4 style="margin:.6rem 0 .2rem">Presentaciones (bultos)</h4><p class="sm mut">Nombre · unidades base · código propio · modalidad · bonificación por bulto cerrado.</p>${[0,1,2].map(krow).join('')}`,
 {wide:true,okText:'Guardar',onOk:w=>{const R=wsReadProd(p);if(R.err)return w._err(R.err),false;
  const old={pr:JSON.stringify(p.prices||{}),fl:p.floor||0,t:(p.tiers||[]).length,k:(p.packs||[]).length};
  p.prices=R.prices;p.floor=R.floor;p.tiers=R.tiers;p.packs=R.packs;
  audit('LISTAS_PRODUCTO',pfull(p)+' · listas '+old.pr+' → '+JSON.stringify(p.prices)+' · piso '+money(old.fl)+' → '+money(p.floor)+' · escalones '+old.t+' → '+p.tiers.length+' · presentaciones '+old.k+' → '+p.packs.length);
  save();rerender();toast('Listas guardadas');}});};
function wsReadProd(p){const conf=wsConf();const prices={};
 for(const l of conf.lists.filter(x=>x.id!=='L1')){const v=val('wp-p'+l.id).trim();if(v==='')continue;const c=cents(v);if(isNaN(c)||c<=0)return{err:'El precio de '+l.id+' no es válido.'};prices[l.id]=c;}
 const fv=val('wp-fl').trim();const floor=fv===''?0:cents(fv);if(isNaN(floor)||floor<0)return{err:'El piso de precio no es válido.'};
 const tiers=[];
 for(let i=0;i<6;i++){const li=val('wp-tl'+i),f=val('wp-tf'+i).trim(),t=val('wp-tt'+i).trim(),k=val('wp-tk'+i),v=val('wp-tv'+i).trim();
  if(!li&&!f&&!t&&!v)continue;if(!li)return{err:'Escalón '+(i+1)+': elegí la lista.'};
  const from=parseNum(f);if(!(from>0))return{err:'Escalón '+(i+1)+': el «desde» debe ser mayor a cero.'};
  const to=t===''?0:parseNum(t);if(t!==''&&!(to>=from))return{err:'Escalón '+(i+1)+': el «hasta» no puede ser menor que el «desde».'};
  const x={list:li,from:Math.round(from*1000)/1000,to:Math.round(to*1000)/1000};
  if(k==='pct'){const n=parseNum(v);if(!(n>0&&n<100))return{err:'Escalón '+(i+1)+': el porcentaje va de 0 a 100 (sin incluirlos).'};x.pct=n;x.price=0;}
  else{const c=cents(v);if(isNaN(c)||c<=0)return{err:'Escalón '+(i+1)+': el precio no es válido.'};x.price=c;x.pct=0;
   const lp=li==='L1'?p.price:(prices[li]||p.price);if(c>=lp)return{err:'Escalón '+(i+1)+': el precio ('+money(c)+') no baja el de la lista '+li+' ('+money(lp)+').'};}
  tiers.push(x);}
 for(const li of WS_IDS){const L=tiers.filter(t=>t.list===li).sort((a,b)=>a.from-b.from);
  for(let i=0;i<L.length;i++){if(i<L.length-1){if(!L[i].to)return{err:'Lista '+li+': sólo el último escalón puede quedar sin «hasta».'};if(L[i].to>=L[i+1].from)return{err:'Lista '+li+': los escalones se solapan ('+numAR(L[i].from,3)+'–'+numAR(L[i].to,3)+' y desde '+numAR(L[i+1].from,3)+').'};}}}
 const packs=[];const bcs=new Set(S.products.filter(x=>x.id!==p.id).flatMap(x=>[x.barcode].concat((x.packs||[]).map(k=>k&&k.barcode))).filter(Boolean));if(p.barcode)bcs.add(p.barcode);
 for(let i=0;i<3;i++){const n=val('wp-kn'+i).trim(),q=val('wp-kq'+i).trim(),b=val('wp-kb'+i).trim(),m=val('wp-km'+i),k=val('wp-kk'+i),v=val('wp-kv'+i).trim();
  if(!n&&!q&&!b&&!v)continue;if(!n)return{err:'Presentación '+(i+1)+': falta el nombre.'};
  const qty=parseNum(q);if(!(qty>0))return{err:'Presentación '+(i+1)+': las unidades base deben ser mayores a cero.'};if(p.unit==='u'&&!Number.isInteger(qty))return{err:'Presentación '+(i+1)+': este producto se cuenta en unidades enteras.'};
  if(b){if(bcs.has(b))return{err:'Presentación '+(i+1)+': el código de barras ya lo usa otro artículo o presentación.'};bcs.add(b);}
  const x={id:(p.packs&&p.packs[i]&&p.packs[i].id)||uid(),name:n.replace(/[<>]/g,''),qty,barcode:b,mode:m==='bulto_cerrado'?'bulto_cerrado':'ambas',fixed:0,pct:0};
  if(k==='fixed'){const c=cents(v);if(isNaN(c)||c<=0)return{err:'Presentación '+(i+1)+': el precio por bulto no es válido.'};x.fixed=c;}
  else if(k==='pct'){const n2=parseNum(v);if(!(n2>0&&n2<100))return{err:'Presentación '+(i+1)+': el porcentaje va de 0 a 100 (sin incluirlos).'};x.pct=n2;}
  packs.push(x);}
 if(new Set(packs.map(k=>k.qty)).size!==packs.length)return{err:'Hay dos presentaciones con las mismas unidades.'};
 return{prices,floor,tiers,packs};}

/* ---- acuerdos especiales ---- */
A.wsAgr=()=>{if(!can('price_lists'))return toast('Sin permiso para crear acuerdos.',1);
 const cs=S.customers.filter(c=>c.status!=='baja');if(!cs.length)return toast('Primero cargá un cliente.',1);
 modal('Acuerdo especial',`<label for="wa-c">Cliente</label><select id="wa-c">${cs.map(c=>`<option value="${c.id}">${esc(custFull(c))} · ${esc(pad4(c.num))}</option>`).join('')}</select>
 <label for="wa-p">Producto o rubro</label><select id="wa-p"><optgroup label="Rubro completo">${S.rubros.filter(r=>r.kind==='rubro').map(r=>`<option value="r:${r.id}">Todo el rubro: ${esc(r.name)}</option>`).join('')}</optgroup><optgroup label="Producto">${S.products.filter(p=>p.active).map(p=>`<option value="p:${p.id}">${esc(pfull(p))}</option>`).join('')}</optgroup></select>
 <div class="grid g2"><div><label for="wa-k">Tipo</label><select id="wa-k"><option value="price">Precio fijo por unidad ($)</option><option value="pct">Porcentaje de descuento sobre el precio minorista</option></select></div><div><label for="wa-v">Valor</label><input id="wa-v" inputmode="decimal" placeholder="Valor" autocomplete="off"></div></div>
 <div class="grid g2"><div><label for="wa-f">Vigente desde</label><input id="wa-f" type="date"></div><div><label for="wa-t">Hasta (opcional)</label><input id="wa-t" type="date"></div></div>
 <p class="sm mut">El acuerdo reemplaza a la lista y a los escalones mientras esté vigente. Un acuerdo por precio fijo sobre un rubro completo no se admite (usá porcentaje).</p>`,
 {okText:'Crear acuerdo',onOk:w=>{const cid=val('wa-c'),pv=val('wa-p'),k=val('wa-k'),f=val('wa-f'),t=val('wa-t');
  const a={id:uid(),cust:cid,active:true,from:f,to:t,by:user?user.name:'sistema',ts:now()};
  if(pv.startsWith('p:'))a.pid=pv.slice(2);else a.rubro=pv.slice(2);
  if(k==='price'){if(a.rubro)return w._err('Para un rubro completo usá porcentaje.'),false;const c=cents(val('wa-v'));if(isNaN(c)||c<=0)return w._err('El precio no es válido.'),false;a.price=c;a.pct=0;}
  else{const n=parseNum(val('wa-v'));if(!(n>0&&n<100))return w._err('El porcentaje va de 0 a 100 (sin incluirlos).'),false;a.pct=n;a.price=0;}
  if(f&&t&&t<f)return w._err('La fecha final no puede ser anterior a la inicial.'),false;
  const clash=(S.agreements||[]).find(x=>x.active!==false&&x.cust===cid&&(x.pid||'')===(a.pid||'')&&(x.rubro||'')===(a.rubro||'')&&(x.from||'0000')<=(t||'9999')&&(f||'0000')<=(x.to||'9999'));
  if(clash)return w._err('Ya hay un acuerdo vigente para ese cliente y ese producto/rubro en esas fechas.'),false;
  (S.agreements=S.agreements||[]).push(a);audit('ACUERDO_ESPECIAL',custFull(custById(cid))+' · '+(a.pid?pfull(prod(a.pid)||{name:a.pid}):'rubro '+rubName(a.rubro))+' · '+(a.price?money(a.price):a.pct+' % off')+' · '+(f||'ya')+' a '+(t||'sin fin'));
  save();rerender();toast('Acuerdo creado');}});};
A.wsAgrOff=el=>{const a=(S.agreements||[]).find(x=>x.id===el.dataset.id);if(!a||!can('price_lists'))return;
 confirmBox('Desactivar acuerdo','El cliente vuelve a su lista. Las ventas ya hechas no cambian.',()=>{a.active=false;audit('ACUERDO_ESPECIAL_BAJA',custFull(custById(a.cust))+' · '+(a.pid||a.rubro));save();rerender();},'Desactivar');};

/* ---- Configuración → Mayorista y minorista ---- */
function wsCfgCard(){if(!(can('config')||can('price_lists')))return'';const c=wsConf();const adm=can('config')?'':'disabled';
 const ag=(S.agreements||[]).slice().reverse();const ov=(S.creditOv||[]).slice(-5).reverse();
 return`<div class="card" style="margin-top:1rem" id="ws-card"><h3>Mayorista y minorista ${c.example?'<span class="tag sim">datos de ejemplo</span>':''}</h3>
 <p class="sm mut">Listas de precio, escalones por cantidad, bultos, acuerdos por cliente y crédito con plazo. Apagado, el sistema vende exactamente como siempre.</p>
 <label class="chk"><input type="checkbox" id="ws-on" ${c.on?'checked':''} ${adm}> Activar canal mayorista</label>
 ${typeof CLOUD_HOOK!=='undefined'&&CLOUD_HOOK&&!c.on?'<div class="warnbox sm">Con la nube activa, antes de activarlo hay que haber corrido el archivo <b>10-mayorista-precios.sql</b> en Supabase (acuerdos, excepciones de crédito y revisión de crédito del servidor). Si no, el servidor rechaza esos registros y la barra de sincronización lo muestra.</div>':''}
 ${c.on?`<div class="tw"><table><caption class="sr">Listas de precio</caption><thead><tr><th>Lista</th><th>Nombre</th><th>Activa</th><th>Impuestos</th><th>Desde</th><th>Hasta</th></tr></thead><tbody>${c.lists.map(l=>`<tr><td><b>${l.id}</b></td><td><input id="ws-n-${l.id}" maxlength="40" value="${esc(l.name)}" aria-label="Nombre de la lista ${l.id}" ${adm}></td><td>${l.id==='L1'?'siempre':`<input type="checkbox" id="ws-a-${l.id}" ${l.on?'checked':''} aria-label="Lista ${l.id} activa" ${adm}>`}</td><td><select id="ws-i-${l.id}" aria-label="Impuestos de ${l.id}" ${adm}><option value="1" ${l.taxIncl?'selected':''}>Incluidos</option><option value="0" ${!l.taxIncl?'selected':''}>No incluidos</option></select></td><td><input type="date" id="ws-f-${l.id}" value="${esc(l.from)}" aria-label="Lista ${l.id} desde" ${adm}></td><td><input type="date" id="ws-t-${l.id}" value="${esc(l.to)}" aria-label="Lista ${l.id} hasta" ${adm}></td></tr>`).join('')}</tbody></table></div>
 <div class="grid g2"><div><label for="ws-gr">Tolerancia de mora (días después del vencimiento)</label><input id="ws-gr" inputmode="numeric" maxlength="2" placeholder="0" value="${c.grace?c.grace:''}" ${adm}></div><div><label class="chk" style="margin-top:1.6rem"><input type="checkbox" id="ws-club" ${c.allowClub?'checked':''} ${adm}> Permitir cupones, membresía y sellos del Club en ventas mayoristas</label></div></div>`:''}
 ${adm===''?`<div class="row"><button class="btn gold" data-act="wsSave">Guardar</button></div>`:''}
 ${c.on?`<h4 style="margin:.8rem 0 .2rem">Acuerdos especiales</h4>${ag.length?`<div class="tw"><table><caption class="sr">Acuerdos especiales</caption><thead><tr><th>Cliente</th><th>Producto / rubro</th><th>Condición</th><th>Vigencia</th><th></th></tr></thead><tbody>${ag.map(a=>`<tr><td>${esc(custFull(custById(a.cust)))}</td><td>${esc(a.pid?pfull(prod(a.pid)||{name:a.pid}):'Rubro '+rubName(a.rubro))}</td><td>${a.price?money(a.price):esc(a.pct+' % off')}</td><td>${esc((a.from||'ya')+' → '+(a.to||'sin fin'))} ${a.active===false?'<span class="tag">inactivo</span>':wsDateOk(a.from,a.to)?'<span class="tag ok">vigente</span>':'<span class="tag warn">fuera de fecha</span>'}</td><td>${a.active!==false&&can('price_lists')?`<button class="btn sm" data-act="wsAgrOff" data-id="${a.id}">Desactivar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="sm mut">Todavía no hay acuerdos.</p>'}
 ${can('price_lists')?'<button class="btn sm" data-act="wsAgr">+ Nuevo acuerdo</button>':''}
 ${wsReview().length?`<div class="warnbox sm" role="status"><b>${wsReview().length} venta(s) a revisar:</b> el servidor las marcó porque superaron el límite de crédito mientras el equipo estaba sin conexión. ${esc(wsReview().slice(-5).map(s=>s.n+' ('+(wsCrw[(s.crw||'').split('+')[0]]||'revisar')+')').join(' · '))}</div>`:''}
 <h4 style="margin:.8rem 0 .2rem">Excepciones de crédito recientes</h4>${ov.length?`<ul class="sm">${ov.map(o=>`<li>${esc(custFull(custById(o.cust)))} · hasta ${money(o.max)} · ${esc(o.by)} · «${esc(o.reason)}» · ${(S.creditUse||[]).some(u=>u.ov===o.id)?'usada':o.until>now()?'vigente':'vencida'}</li>`).join('')}</ul>`:'<p class="sm mut">Ninguna.</p>'}`:''}</div>`;}
A.wsSave=()=>{if(!can('config'))return toast('Sólo el administrador',1);const cur=wsConf();const on=$('#ws-on')?$('#ws-on').checked:cur.on;
 const W={on,allowClub:cur.allowClub,grace:cur.grace,example:cur.example,lists:cur.lists.map(l=>({...l}))};
 if(on&&cur.on){W.allowClub=!!($('#ws-club')&&$('#ws-club').checked);const g=val('ws-gr').trim()===''?0:Math.round(parseNum(val('ws-gr')));if(isNaN(g)||g<0||g>60)return toast('La tolerancia de mora va de 0 a 60 días.',1);W.grace=g;
  for(const l of W.lists){const n=val('ws-n-'+l.id).trim();if(!n)return toast('Falta el nombre de la lista '+l.id+'.',1);l.name=n.replace(/[<>]/g,'').slice(0,40);if(l.id!=='L1')l.on=!!$('#ws-a-'+l.id).checked;l.taxIncl=val('ws-i-'+l.id)!=='0';l.from=val('ws-f-'+l.id);l.to=val('ws-t-'+l.id);if(l.from&&l.to&&l.to<l.from)return toast('Lista '+l.id+': la fecha final es anterior a la inicial.',1);}}
 const apply=()=>{const before=JSON.stringify(S.cfg.wholesale||{});S.cfg.wholesale=W;audit(on!==cur.on?(on?'MAYORISTA_ACTIVAR':'MAYORISTA_APAGAR'):'MAYORISTA_CONFIG','antes '+before.slice(0,160)+' · ahora '+JSON.stringify(W).slice(0,160));save();rerender();toast('Guardado');};
 if(on!==cur.on)confirmBox(on?'Activar canal mayorista':'Apagar canal mayorista',on?'Aparecen las listas, los escalones, los bultos y el crédito con plazo. Las ventas anteriores no cambian.':'Se vende como minorista otra vez. Las listas, acuerdos y bultos quedan guardados y las ventas anteriores no cambian.',apply,on?'Activar':'Apagar');else apply();};
