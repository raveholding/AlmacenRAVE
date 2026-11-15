/* ===== V26.54 · Fidelización ampliada: niveles del Club, cumpleaños, monedero digital, gift cards / vouchers,
   Día de Cuenta Comercio (cashback), ruleta y trivia con premios, y cola sin conexión =====
   Revisión del pedido (los prompts hablaban de Visual Basic/WinForms; esto es Sistema VB = Vincular Business, web + Supabase):
   · Todo vive en «Clientes y fidelización» y reutiliza Clientes, el libro de sellos, cupones y auditoría (no hay una base paralela).
   · Saldos SIEMPRE derivados de un libro que no se edita (monedero: S.fidmov · gift card: S.giftmov). Corrección = movimiento compensatorio.
   · Un beneficio por compra (regla de oro 4.3): nivel, cumpleaños, cupón y membresía compiten y gana el mayor.
   · El monedero y la gift card NO son dinero nuevo del turno: la plata entró al cargar/vender (en efectivo va a la caja con su rubro).
   · Con la nube configurada y sin conexión NO se gasta saldo (otro equipo podría haberlo usado): se cobra con otro medio.
     Las cargas, los sellos y las jugadas sí quedan en la cola y suben al volver internet.
   · Ruleta/trivia: azar del navegador (crypto), una jugada por venta, auditada; premio de sellos, saldo o cupón.
     Sorteos y promociones con premio pueden requerir autorización/bases legales [VERIFICAR con asesor y normativa provincial]. */
const FID_DEF={
 tiers:{on:false,days:180,list:[{k:'bronce',name:'Bronce',min:0,pct:0},{k:'plata',name:'Plata',min:5000000,pct:3},{k:'oro',name:'Oro',min:15000000,pct:7}]},
 bday:{on:false,pct:10},
 wallet:{on:!IS_CLIENT,rubro:'cobr'},   /* en el sistema del cliente lo enciende el administrador, después de pegar 20-fidelizacion-operacion.sql */
 gift:{on:!IS_CLIENT,months:6},
 cb:{on:false,dows:[3],pct:5},
 game:{on:false,mode:'ruleta',min:500000,
  prizes:[{id:'pz1',label:'+1 sello',kind:'stamps',v:1,w:30},{id:'pz2',label:'$ 500 al monedero',kind:'wallet',v:50000,w:15},{id:'pz3',label:'10 % en tu próxima compra',kind:'coupon',v:10,w:15},{id:'pz4',label:'+2 sellos',kind:'stamps',v:2,w:10},{id:'pz5',label:'Seguí participando',kind:'none',v:0,w:30}],
  trivia:[{q:'¿Cuántos sellos necesitás para tu premio?',o:['5','La meta del Club','Ninguno'],ok:1},{q:'¿Con qué podés pagar en el local además de efectivo?',o:['Sólo efectivo','Con el saldo de tu monedero','Con fichas'],ok:1}]}};
const fidCfg=()=>{const c=(S.cfg&&S.cfg.fid)||{};const o={};for(const k in FID_DEF)o[k]=Object.assign({},FID_DEF[k],c[k]||{});return o;};
function fidSet(k,v){S.cfg.fid=S.cfg.fid||{};S.cfg.fid[k]=Object.assign({},(S.cfg.fid[k]||{}),v);}
/* el aviso de la migración sólo aparece si el servidor REALMENTE rechazó algo de estas funciones (antes se mostraba siempre) */
const FID_COLS=['fidmov','giftmov','gift','juego','devol','merma','presup'];
const fidSqlNote=()=>{if(typeof CLOUD==='undefined'||!CLOUD.on||typeof cl==='undefined'||!cl.rejects)return'';const R=cl.rejects.filter(r=>FID_COLS.includes(String(r.key||'').split('|')[0])&&/colecci|no permit|desconocid|no v[aá]lid/i.test(String(r.m||'')));
 return R.length?'<div class="warnbox sm">El servidor rechazó '+R.length+' movimiento(s) de estas funciones: el administrador tiene que pegar <b>20-fidelizacion-operacion.sql</b> en Supabase (SQL Editor) y después tocar «Reenviar lo rechazado».<div class="row" style="margin-top:.4rem"><button class="btn sm" data-act="fidResend">Reenviar lo rechazado</button></div></div>':'';};
/* reenvío: olvida la huella de lo rechazado para que la próxima sincronización lo vuelva a mandar */
A.fidResend=async()=>{const R=cl.rejects.filter(r=>FID_COLS.includes(String(r.key||'').split('|')[0]));R.forEach(r=>{delete cl.fp[r.key];});cl.rejects=cl.rejects.filter(r=>!R.includes(r));
 try{await cloudMetaSave();}catch(e){}await cloudSync(true);toast(cl.lastErr?cl.lastErr:'Reenviado. Si el SQL ya está en Supabase, el aviso no vuelve a aparecer.',!!cl.lastErr);rerender();};
const fidOff=()=>typeof CLOUD!=='undefined'&&CLOUD.on&&typeof cl!=='undefined'&&!(cl.ready&&cl.online);
const fidMov=()=>S.fidmov||(S.fidmov=[]);
const giftL=()=>S.gifts||(S.gifts=[]);
const giftM=()=>S.giftmov||(S.giftmov=[]);
const gameL=()=>S.games||(S.games=[]);
function fidRand(n){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n;}

/* ---------- monedero digital (saldo del cliente) ---------- */
const walBal=cid=>fidMov().filter(e=>e.cust===cid).reduce((a,e)=>a+(+e.amount||0),0);
function walPush(cid,kind,amount,ref,extra){const e=Object.assign({id:uid(),cust:cid,ts:now(),kind,amount,ref:String(ref||'').slice(0,120),user:user?user.name:'sistema'},extra||{});fidMov().push(e);return e;}
function walLoad(cid,amount,method,rubro){const c=custById(cid);if(!c||c.status==='baja')return'Cliente inexistente.';if(!fidCfg().wallet.on)return'El monedero está apagado (Fidelización → Monedero).';
 if(!Number.isInteger(amount)||amount<=0)return'El importe debe ser mayor a cero.';if(amount>100000000)return'Importe demasiado alto para una carga (máximo $ 1.000.000).';
 if(!MET[method]||['fiado','mixto','monedero','giftcard','pedidosya'].includes(method))return'Medio de carga inválido.';
 let mov='';if(method==='efectivo'){const e=addMov('ingreso',rubro||fidCfg().wallet.rubro||'cobr','Carga de monedero · '+custFull(c),amount);if(e)return e;mov=S.movs[S.movs.length-1].id;}
 walPush(cid,'carga',amount,'Carga · '+(MET[method]||method),{method,mov});audit('MONEDERO_CARGA',custFull(c)+' · '+money(amount)+' · '+MET[method]);save();return'';}

/* ---------- gift cards / vouchers ---------- */
const GC_ABC='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function giftCode(){let s='';for(let i=0;i<8;i++)s+=GC_ABC[fidRand(GC_ABC.length)];const c='GC-'+s.slice(0,4)+'-'+s.slice(4);return giftL().some(g=>g.code===c)?giftCode():c;}
const giftBal=g=>giftM().filter(m=>m.gift===g.id).reduce((a,m)=>a+(+m.amount||0),0);
const giftByCode=code=>{const k=String(code||'').trim().toUpperCase().replace(/\s+/g,'');return giftL().find(g=>g.code===k||g.code.replace(/-/g,'')===k.replace(/-/g,''))||null;};
function giftState(g){if(g.status==='anulada')return'anulada';if(g.exp&&now()>g.exp)return'vencida';return giftBal(g)<=0?'agotada':'activa';}
const GIFT_TXT={activa:'Activa',agotada:'Usada por completo',vencida:'Vencida',anulada:'Anulada'};
function giftSell(f){if(!fidCfg().gift.on)return{err:'Las gift cards están apagadas (Fidelización → Gift cards).'};
 const amount=f.amount;if(!Number.isInteger(amount)||amount<=0)return{err:'El valor de la gift card debe ser mayor a cero.'};if(amount>50000000)return{err:'Valor demasiado alto (máximo $ 500.000).'};
 if(!MET[f.method]||['fiado','mixto','monedero','giftcard','pedidosya'].includes(f.method))return{err:'Medio de cobro inválido.'};
 const cust=f.cust?custById(f.cust):null;if(f.cust&&!cust)return{err:'Cliente inexistente.'};
 const months=Math.max(1,Math.min(36,+f.months||fidCfg().gift.months||6));const code=giftCode();
 let mov='';if(f.method==='efectivo'){const e=addMov('ingreso',f.rubro||fidCfg().wallet.rubro||'cobr','Venta de gift card '+code,amount);if(e)return{err:e};mov=S.movs[S.movs.length-1].id;}
 const g={id:uid(),code,ts:now(),exp:now()+months*30*86400000,cust:cust?cust.id:'',holder:String(f.holder||'').replace(/[<>]/g,'').slice(0,60),buyer:String(f.buyer||'').replace(/[<>]/g,'').slice(0,60),amount,method:f.method,mov,status:'activa',user:user?user.name:'sistema',msg:String(f.msg||'').replace(/[<>]/g,'').slice(0,120)};
 giftL().push(g);giftM().push({id:uid(),gift:g.id,ts:now(),amount,kind:'emision',ref:'Emisión · '+(MET[f.method]||f.method),user:g.user});
 audit('GIFT_EMITIR',code+' · '+money(amount)+' · '+(cust?'nominativa '+custFull(cust):'al portador')+' · '+MET[f.method]);save();return{g};}
function giftVoid(g,motivo){if(g.status==='anulada')return'Ya está anulada.';const b=giftBal(g);if(b!==g.amount)return'Ya tiene canjes: no se puede anular (sólo vencer o agotar).';
 g.status='anulada';g.voidReason=motivo;giftM().push({id:uid(),gift:g.id,ts:now(),amount:-b,kind:'anulacion',ref:'Anulación · '+motivo,user:user?user.name:'sistema'});
 if(g.mov){const m=S.movs.find(x=>x.id===g.mov);if(m&&openSess()&&m.sessId===openSess().id){addMov('egreso',m.rubro,'Anulación gift card '+g.code,b);}}
 audit('GIFT_ANULAR',g.code+' · '+motivo);save();return'';}

/* ---------- niveles del Club (Bronce / Plata / Oro) por consumo ---------- */
function custSpend(cid,days){const from=now()-days*86400000;let t=0;S.sales.forEach(s=>{if(s.cust===cid&&s.status==='ok'&&s.ts>=from)t+=+s.total||0;});
 (S.returns||[]).forEach(r=>{if(r.cust===cid&&r.ts>=from)t-=+r.total||0;});return Math.max(0,t);}
function custTier(c){const T=fidCfg().tiers;if(!c||!T.on)return null;const sp=custSpend(c.id,T.days);const L=T.list.slice().sort((a,b)=>a.min-b.min);
 let cur=L[0],next=null;for(const t of L){if(sp>=t.min)cur=t;else{next=t;break;}}return{t:cur,spend:sp,next,missing:next?next.min-sp:0};}
const TIER_ICO={bronce:'🥉',plata:'🥈',oro:'🥇'};
function tierBadge(c){const r=custTier(c);if(!r)return'';return `<span class="tag ${r.t.k==='oro'?'ok':r.t.k==='plata'?'':'warn'}" title="Consumo últimos ${fidCfg().tiers.days} días: ${money(r.spend)}">${TIER_ICO[r.t.k]||'⭐'} ${esc(r.t.name)}</span>`;}

/* ---------- cumpleaños: un beneficio por año ---------- */
function bdayUsed(cid){const y=new Date(now()).getUTCFullYear();return S.sales.some(s=>s.cust===cid&&s.status==='ok'&&s.benefit&&s.benefit.kind==='cumple'&&new Date(s.ts).getUTCFullYear()===y);}
function bdayEligible(c){const B=fidCfg().bday;return !!(c&&B.on&&B.pct>0&&c.status!=='baja'&&isBirthWeek(c)&&!bdayUsed(c.id));}

/* candidatos de beneficio que compiten en applyBenefit (gana el mayor) */
function fidCands(cust,base){const out=[];if(!cust||!(base>0))return out;
 const tr=custTier(cust);if(tr&&tr.t.pct>0)out.push({kind:'tier',disc:Math.round(base*tr.t.pct/100),label:'Nivel '+tr.t.name+' ('+tr.t.pct+' %)'});
 if(bdayEligible(cust)){const p=fidCfg().bday.pct;out.push({kind:'cumple',disc:Math.round(base*p/100),label:'Regalo de cumpleaños ('+p+' %)'});}
 return out;}

/* ---------- POS: medios nuevos, validación previa y registro ---------- */
function fidExtraMet(){const C=fidCfg();const o=[];if(C.wallet.on)o.push('monedero');if(C.gift.on)o.push('giftcard');return o;}
function fidPre(pays,cust,opts){
 const w=pays.find(p=>p.m==='monedero'),g=pays.find(p=>p.m==='giftcard');if(!w&&!g)return'';
 if(fidOff())return'Sin conexión con la nube: no se puede gastar saldo de monedero ni de gift card (otro equipo podría haberlo usado). Cobrá con otro medio o esperá a que vuelva internet.';
 if(w){if(!cust)return'El pago con monedero exige identificar al cliente.';const b=walBal(cust.id);if(w.a>b)return'Saldo de monedero insuficiente: tiene '+money(b)+' y se quieren usar '+money(w.a)+'.';}
 if(g){const gc=giftByCode(opts.gift);if(!gc)return'Escribí el código de la gift card (GC-XXXX-XXXX).';const st=giftState(gc);if(st!=='activa')return'Gift card '+gc.code+': '+GIFT_TXT[st].toLowerCase()+'.';
  if(gc.cust&&(!cust||cust.id!==gc.cust))return'La gift card '+gc.code+' es nominativa: identificá a su titular ('+custFull(custById(gc.cust))+').';
  const b=giftBal(gc);if(g.a>b)return'Saldo de la gift card insuficiente: tiene '+money(b)+'.';opts._gift=gc;}
 return'';}
function cbToday(){const C=fidCfg().cb;return !!(C.on&&C.pct>0&&(C.dows||[]).includes(new Date(now()).getDay()));}
function fidCommit(sale,cust,opts){const L=salePays(sale);const w=L.find(p=>p.m==='monedero'),g=L.find(p=>p.m==='giftcard');
 if(w&&cust){walPush(cust.id,'pago',-w.a,'Pago venta '+sale.n,{sale:sale.id});audit('MONEDERO_PAGO',custFull(cust)+' · '+money(w.a)+' · venta '+sale.n);}
 if(g&&opts._gift){giftM().push({id:uid(),gift:opts._gift.id,ts:now(),amount:-g.a,kind:'canje',sale:sale.id,ref:'Canje venta '+sale.n,user:user?user.name:'sistema'});sale.gift=opts._gift.code;audit('GIFT_CANJE',opts._gift.code+' · '+money(g.a)+' · venta '+sale.n+' · queda '+money(giftBal(opts._gift)));}
 /* Día de Cuenta Comercio: venta pagada TODA con saldo de monedero → cashback al monedero */
 if(w&&cust&&w.a===sale.total&&cbToday()){const a=Math.round(sale.total*fidCfg().cb.pct/100);if(a>0){walPush(cust.id,'cashback',a,'Día de Cuenta Comercio · venta '+sale.n,{sale:sale.id});sale.cashback=a;audit('MONEDERO_CASHBACK',custFull(cust)+' · '+money(a)+' · venta '+sale.n);}}}
function fidVoid(s){fidMov().filter(e=>e.sale===s.id&&e.kind!=='reverso').forEach(e=>{if(!fidMov().some(x=>x.rev===e.id))walPush(e.cust,'reverso',-e.amount,'Reversión por anulación '+s.n,{sale:s.id,rev:e.id});});
 giftM().filter(m=>m.sale===s.id&&m.kind==='canje').forEach(m=>{if(!giftM().some(x=>x.rev===m.id))giftM().push({id:uid(),gift:m.gift,ts:now(),amount:-m.amount,kind:'reverso',sale:s.id,rev:m.id,ref:'Reversión por anulación '+s.n,user:user?user.name:'sistema'});});
 gameL().filter(p=>p.sale===s.id&&!p.rev).forEach(p=>{p.rev=now();if(p.kind==='stamps'&&p.v>0)S.loyalty.ledger.push({id:uid(),cust:p.cust,ts:now(),kind:'adjust',n:-p.v,ref:'reversión premio ruleta '+s.n,user:user?user.name:'sistema'});
  if(p.kind==='coupon'&&p.coupon){const cp=S.coupons.find(x=>x.id===p.coupon);if(cp&&!cp.uses.length)cp.active=false;}});}
function fidCobroHTML(m,cust,tot){const C=fidCfg();const usesW=m==='monedero'||(pos.mix&&pos.pays.some(p=>p.m==='monedero'));const usesG=m==='giftcard'||(pos.mix&&pos.pays.some(p=>p.m==='giftcard'));let h='';
 if(cust&&C.wallet.on){const b=walBal(cust.id);if(b||usesW)h+=`<div class="${usesW&&b<tot&&!pos.mix?'errbox':'okbox'} sm">👛 Monedero de ${esc(cust.name)}: <b>${money(b)}</b>${usesW&&!pos.mix&&b<tot?' · no alcanza: usá «Dividir el pago» y completá con otro medio':''}${cbToday()?' · <b>Hoy es Día de Cuenta Comercio</b>: pagando todo con el monedero recibe '+C.cb.pct+' % de vuelta':''}</div>`;}
 if(usesW&&!cust)h+='<div class="warnbox sm">Para pagar con el monedero identificá al cliente (por nombre, DNI o el QR de su tarjeta).</div>';
 if(usesG){const gc=giftByCode(pos.gift);const st=gc?giftState(gc):'';h+=`<div class="card sm" style="margin:.4rem 0"><label for="cb-gift"><b>Código de la gift card / voucher</b></label><div class="row"><input id="cb-gift" class="sp" maxlength="16" placeholder="GC-XXXX-XXXX" autocomplete="off" style="text-transform:uppercase" value="${esc(pos.gift||'')}"><button type="button" class="btn sm" data-act="cbGift">Consultar</button></div>${pos.gift?(gc?`<div class="${st==='activa'?'okbox':'errbox'}" style="margin-top:.3rem">${esc(gc.code)} · ${esc(GIFT_TXT[st])} · saldo <b>${money(giftBal(gc))}</b>${gc.cust?' · nominativa de '+esc(custFull(custById(gc.cust))):' · al portador'}${gc.exp?' · vence '+esc(dmy(dkey(gc.exp))):''}</div>`:'<div class="errbox" style="margin-top:.3rem">No existe una gift card con ese código.</div>'):''}</div>`;}
 if(fidOff()&&(usesW||usesG))h+='<div class="errbox sm">Sin conexión con la nube: el saldo no se puede usar hasta que vuelva internet.</div>';
 return h;}
A.cbGift=()=>{cobroRender();};

/* ---------- ruleta / trivia después de la venta ---------- */
const closeAll=()=>{const r=$('#modal-root');if(r)r.innerHTML='';};
function gameEligible(sale){const G=fidCfg().game;return !!(G.on&&sale&&sale.cust&&sale.status==='ok'&&sale.total>=(G.min||0)&&!gameL().some(p=>p.sale===sale.id)&&(G.prizes||[]).some(p=>p.w>0));}
function fidSaleOkHTML(sale){let h='';if(sale.cashback)h+=`<div class="okbox sm">💸 Día de Cuenta Comercio: <b>${money(sale.cashback)}</b> de vuelta al monedero de ${esc(sale.custName)}.</div>`;
 const pw=salePays(sale).find(p=>p.m==='monedero');if(pw&&sale.cust)h+=`<div class="card sm" style="margin:.4rem 0">👛 Pagado con monedero: ${money(pw.a)} · saldo que queda: <b>${money(walBal(sale.cust))}</b></div>`;
 if(sale.gift){const g=giftByCode(sale.gift);if(g)h+=`<div class="card sm" style="margin:.4rem 0">🎁 Gift card ${esc(g.code)} · saldo que queda: <b>${money(giftBal(g))}</b></div>`;}
 if(gameEligible(sale)){const G=fidCfg().game;h+=`<div class="card" style="margin:.5rem 0;text-align:center"><b>🎡 ${esc(sale.custName)} ganó una jugada</b><p class="sm mut">${G.mode==='trivia'?'Respondé una pregunta y, si acertás, girás la ruleta.':'Girá la ruleta y llevate un premio del Club.'}</p><button class="btn gold" data-act="gamePlay" data-id="${esc(sale.id)}">${G.mode==='trivia'?'Jugar trivia':'Girar la ruleta'}</button></div>`;}
 return h;}
function gameDraw(){const P=fidCfg().game.prizes.filter(p=>p.w>0);const T=P.reduce((a,p)=>a+p.w,0);let r=fidRand(T);for(const p of P){if(r<p.w)return p;r-=p.w;}return P[P.length-1];}
function gameApply(sale,pz,via){const c=custById(sale.cust);const rec={id:uid(),sale:sale.id,cust:sale.cust,ts:now(),prize:pz?pz.id:'',label:pz?pz.label:'Sin premio',kind:pz?pz.kind:'none',v:pz?pz.v:0,via,user:user?user.name:'sistema'};
 if(pz&&pz.kind==='stamps'&&pz.v>0){S.loyalty.ledger.push({id:uid(),cust:c.id,ts:now(),kind:'adjust',n:pz.v,ref:'premio '+via+' · venta '+sale.n,user:rec.user});}
 else if(pz&&pz.kind==='wallet'&&pz.v>0){walPush(c.id,'premio',pz.v,'Premio '+via+' · venta '+sale.n,{sale:sale.id});}
 else if(pz&&pz.kind==='coupon'&&pz.v>0){let code;do{code='PREMIO'+String(fidRand(900000)+100000);}while(S.coupons.some(x=>x.code===code));
  const cp={id:uid(),code,type:'pct',value:Math.min(90,pz.v),min:0,from:'',to:dkey(now()+30*86400000),maxUses:1,perCust:1,aud:'club',active:true,public:false,note:'Premio '+via+' para '+custFull(c),uses:[],owner:c.id};
  S.coupons.push(cp);rec.coupon=cp.id;rec.code=code;}
 gameL().push(rec);audit('JUEGO_PREMIO',custFull(c)+' · '+rec.label+(rec.code?' · cupón '+rec.code:'')+' · venta '+sale.n+' · '+via);save();if(typeof pubRefresh==='function')pubRefresh();return rec;}
function wheelSVG(P){const n=P.length,R=120,cx=130,cy=130;const cols=['#c9a227','#2f6f5e','#a3402e','#3b5ba5','#7a4fa0','#4a7d2c','#b0662b','#2c7f91'];
 return `<svg viewBox="0 0 260 260" width="260" height="260" role="img" aria-label="Ruleta de premios"><g id="wheel-g" style="transform-origin:130px 130px;transition:transform 3.2s cubic-bezier(.17,.67,.21,1)">${P.map((p,i)=>{const a0=2*Math.PI*i/n-Math.PI/2,a1=2*Math.PI*(i+1)/n-Math.PI/2,am=(a0+a1)/2;
  const x0=cx+R*Math.cos(a0),y0=cy+R*Math.sin(a0),x1=cx+R*Math.cos(a1),y1=cy+R*Math.sin(a1);const tx=cx+R*.62*Math.cos(am),ty=cy+R*.62*Math.sin(am);
  return `<path d="M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 ${n<=2?1:0} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${cols[i%cols.length]}" stroke="#fff" stroke-width="2"/><text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" fill="#fff" font-size="10" font-weight="700" text-anchor="middle" dominant-baseline="middle" transform="rotate(${(am*180/Math.PI+90).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})">${esc(p.label.length>16?p.label.slice(0,15)+'…':p.label)}</text>`;}).join('')}</g><circle cx="130" cy="130" r="16" fill="#111" stroke="#fff" stroke-width="3"/><path d="M130,2 L120,22 L140,22 Z" fill="#111" stroke="#fff" stroke-width="2"/></svg>`;}
function gameSpin(sale,via){const P=fidCfg().game.prizes.filter(p=>p.w>0);const pz=gameDraw();const idx=P.indexOf(pz);const rec=gameApply(sale,pz.kind==='none'?null:pz,via);
 const w=modal('🎡 Ruleta del Club',`<div style="text-align:center">${wheelSVG(P)}<div id="wheel-res" aria-live="polite" style="min-height:3rem;margin-top:.6rem"></div></div>`,{okText:'Listo',noCancel:true});
 const deg=360*5+(360-(idx+0.5)*360/P.length);const g=w.querySelector('#wheel-g');const red=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const show=()=>{const b=w.querySelector('#wheel-res');if(b)b.innerHTML=rec.kind==='none'?'<div class="warnbox">Esta vez no hubo premio. ¡Gracias por participar!</div>':`<div class="okbox"><b>¡Ganó: ${esc(rec.label)}!</b>${rec.code?'<br>Cupón de un solo uso para su próxima compra: <b>'+esc(rec.code)+'</b> (vence en 30 días)':''}</div>`;};
 if(g&&!red){requestAnimationFrame(()=>{g.style.transform='rotate('+deg+'deg)';});setTimeout(show,3300);}else{if(g)g.style.transform='rotate('+deg+'deg)';show();}}
A.gamePlay=el=>{const sale=S.sales.find(s=>s.id===el.dataset.id);if(!sale||!gameEligible(sale))return toast('Esta venta ya jugó o no participa.',1);closeAll();
 const G=fidCfg().game;if(G.mode!=='trivia'||!(G.trivia||[]).length)return gameSpin(sale,'ruleta');
 const T=G.trivia[fidRand(G.trivia.length)];
 modal('❓ Trivia del Club',`<p><b>${esc(T.q)}</b></p>${T.o.map((o,i)=>`<label class="chk"><input type="radio" name="tv" value="${i}"> ${esc(o)}</label>`).join('')}`,{okText:'Responder',onOk:w=>{const r=w.querySelector('input[name=tv]:checked');if(!r)return w._err('Elegí una respuesta.'),false;
  if(+r.value===T.ok){setTimeout(()=>gameSpin(sale,'trivia'),60);}else{gameApply(sale,null,'trivia (respuesta incorrecta)');toast('Respuesta incorrecta: esta vez sin premio.');}}});};

/* ---------- ficha y lista de clientes ---------- */
function fidCustHeads(){const C=fidCfg();return (C.tiers.on?'<th>Nivel</th>':'')+(C.wallet.on?'<th class="r">Monedero</th>':'');}
function fidCustCells(c){const C=fidCfg();return (C.tiers.on?`<td>${tierBadge(c)||'—'}</td>`:'')+(C.wallet.on?`<td class="r" data-sv="${walBal(c.id)}">${walBal(c.id)?money(walBal(c.id)):'<span class="mut">—</span>'}</td>`:'');}
function fidCustCard(c){const C=fidCfg();const tr=custTier(c);const b=walBal(c.id);const gs=giftL().filter(g=>g.cust===c.id);const pl=gameL().filter(p=>p.cust===c.id);
 return `<div class="card" style="margin:.6rem 0"><h3 style="margin-top:0">Club: nivel, monedero y premios</h3>
 ${tr?`<p>${tierBadge(c)} · consumo de los últimos ${C.tiers.days} días: <b>${money(tr.spend)}</b>${tr.t.pct?' · '+tr.t.pct+' % de beneficio':''}${tr.next?` · le faltan <b>${money(tr.missing)}</b> para ${esc(tr.next.name)}`:' · nivel máximo'}</p>`:'<p class="sm mut">Niveles del Club apagados (Fidelización → Niveles).</p>'}
 ${C.bday.on&&isBirthWeek(c)?`<div class="${bdayUsed(c.id)?'warnbox':'okbox'} sm">🎂 Semana de cumpleaños · ${bdayUsed(c.id)?'ya usó su regalo este año':'tiene '+C.bday.pct+' % de regalo en su próxima compra'}</div>`:''}
 ${C.wallet.on?`<div class="row"><span class="sp">👛 Monedero: <b>${money(b)}</b></span><button class="btn sm gold" type="button" data-act="walLoad" data-id="${c.id}">Cargar saldo</button><button class="btn sm" type="button" data-act="walHist" data-id="${c.id}">Movimientos</button></div>`:''}
 ${gs.length?`<p class="sm">🎁 Gift cards a su nombre: ${gs.map(g=>esc(g.code)+' ('+money(giftBal(g))+')').join(' · ')}</p>`:''}
 ${pl.length?`<p class="sm mut">🎡 Jugadas: ${pl.length} · último premio: ${esc(pl[pl.length-1].label)}</p>`:''}</div>`;}
function rubIngOpts(sel){return (S.rubros||[]).filter(r=>r.kind!=='msec'&&r.kind!=='shared'&&r.active!==false).map(r=>`<option value="${esc(r.id)}" ${r.id===sel?'selected':''}>${esc(r.name)}</option>`).join('');}
const LOAD_MET=['efectivo','debito','credito','transferencia','qr','modo'];
A.walLoad=el=>{const c=custById(el.dataset.id);if(!c)return;if(!can('customers'))return toast('Sin permiso',1);
 modal('Cargar monedero · '+custFull(c),`<p>Saldo actual: <b>${money(walBal(c.id))}</b></p><label for="wl-a">Importe a cargar ($)</label>${numIn('wl-a',0,'0')}
 <label for="wl-m">Cómo paga la carga</label><select id="wl-m">${LOAD_MET.map(k=>`<option value="${k}">${esc(MET[k])}</option>`).join('')}</select>
 <label for="wl-r">Rubro del ingreso (si es en efectivo, entra a la caja)</label><select id="wl-r">${rubIngOpts(fidCfg().wallet.rubro||'cobr')}</select>
 <p class="sm mut">El saldo no es una venta: la venta ocurre cuando el cliente lo gasta. En efectivo la plata entra hoy a la caja con este rubro; con otro medio queda registrada en el libro del monedero.</p>`,
 {okText:'Cargar',onOk:w=>{const a=cents(val('wl-a'));const e=walLoad(c.id,a,val('wl-m'),val('wl-r'));if(e)return w._err(e),false;toast('Monedero cargado: '+money(a)+' · saldo '+money(walBal(c.id)));rerender();}});};
A.walHist=el=>{const c=custById(el.dataset.id);if(!c)return;const L=fidMov().filter(e=>e.cust===c.id);let bal=0;const rows=L.map(e=>{bal+=e.amount;return{e,bal};}).reverse();
 modal('Monedero · '+custFull(c),`<div class="tw"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th class="r">Importe</th><th class="r">Saldo</th><th>Usuario</th></tr></thead><tbody>${rows.map(({e,bal})=>`<tr><td>${fmtDT(e.ts)}</td><td>${esc(WAL_TXT[e.kind]||e.kind)} · <span class="sm">${esc(e.ref||'')}</span></td><td class="r ${e.amount<0?'neg':''}">${money(e.amount)}</td><td class="r"><b>${money(bal)}</b></td><td class="sm">${esc(e.user||'')}</td></tr>`).join('')||'<tr><td colspan="5" class="mut">Sin movimientos.</td></tr>'}</tbody></table></div>
 ${can('config')?'<button class="btn sm" data-act="walAdj" data-id="'+c.id+'">Ajuste compensatorio (administrador)</button>':''}`,{wide:true,okText:'Cerrar',noCancel:true});};
const WAL_TXT={carga:'Carga',pago:'Pago',cashback:'Cashback',premio:'Premio',ajuste:'Ajuste',reverso:'Reversión',devolucion:'Devolución'};
A.walAdj=el=>{const c=custById(el.dataset.id);if(!c||!can('config'))return;closeAll();
 modal('Ajuste de monedero · '+custFull(c),`<p class="sm mut">El libro no se edita: el ajuste suma o resta con un movimiento nuevo y queda en auditoría.</p><label for="wa-a">Importe (use - para restar)</label><input id="wa-a" inputmode="decimal" autocomplete="off" placeholder="-500"><label for="wa-m">Motivo (obligatorio)</label><input id="wa-m" maxlength="100">`,
 {onOk:w=>{const raw=val('wa-a').trim();const neg=raw.startsWith('-');const a=cents(raw.replace(/^-/,''));if(!(a>0))return w._err('Ingresá un importe distinto de cero.'),false;if(val('wa-m').trim().length<3)return w._err('Escribí el motivo.'),false;
  const amt=neg?-a:a;if(walBal(c.id)+amt<0)return w._err('El saldo no puede quedar negativo.'),false;walPush(c.id,'ajuste',amt,val('wa-m'));audit('MONEDERO_AJUSTE',custFull(c)+' · '+money(amt)+' · '+val('wa-m'));save();rerender();}});};

/* ---------- pantalla: Monedero y gift cards ---------- */
reg('monedero','Monedero y gift cards','cash','customers',()=>{const C=fidCfg();const soc=S.customers.filter(c=>c.status!=='baja');const withBal=soc.map(c=>({c,b:walBal(c.id)})).filter(x=>x.b!==0).sort((a,b)=>b.b-a.b);
 const tot=withBal.reduce((a,x)=>a+x.b,0);const G=giftL().slice().reverse();const gAct=giftL().filter(g=>giftState(g)==='activa');const gTot=gAct.reduce((a,g)=>a+giftBal(g),0);
 const loadsBy={};fidMov().filter(e=>e.kind==='carga').forEach(e=>{loadsBy[e.method]=(loadsBy[e.method]||0)+e.amount;});
 return `<div class="row"><h1 class="sp">Monedero digital y gift cards</h1>${C.gift.on?'<button class="btn gold" data-act="gcNew">+ Vender gift card / voucher</button>':''}</div>
 ${fidSqlNote()}<div class="warnbox sm">El saldo del monedero y de las gift cards es <b>plata que el cliente ya pagó</b> (un pasivo del comercio): no es venta hasta que se usa. Se gasta en Vender con los medios <b>Monedero</b> y <b>Gift card</b>. Sin conexión con la nube no se puede gastar saldo.</div>
 <div class="grid g4" style="margin:1rem 0"><div class="card kpi"><b>${money(tot)}</b><span>Saldo en monederos (${withBal.length} clientes)</span></div><div class="card kpi"><b>${money(gTot)}</b><span>Saldo en gift cards activas (${gAct.length})</span></div><div class="card kpi"><b>${money(fidMov().filter(e=>e.kind==='cashback').reduce((a,e)=>a+e.amount,0))}</b><span>Cashback entregado</span></div><div class="card kpi"><b>${money(Object.values(loadsBy).reduce((a,b)=>a+b,0))}</b><span>Cargas totales</span></div></div>
 <div class="grid g2"><div class="card"><h3>Monedero</h3><label class="chk"><input type="checkbox" id="fw-on" ${C.wallet.on?'checked':''}> Activar el monedero (medio de pago «Monedero» en Vender)</label>
  <label for="fw-r">Rubro de las cargas en efectivo</label><select id="fw-r">${rubIngOpts(C.wallet.rubro||'cobr')}</select>
  <label for="fw-q" style="margin-top:.6rem">Cargar a un cliente</label><div class="row"><input id="fw-q" class="sp" placeholder="Nombre, WhatsApp, DNI o N.º" autocomplete="off"></div><div id="fw-res"></div>
  <p class="sm mut">Cargas por medio: ${Object.keys(loadsBy).map(k=>esc(MET[k]||k)+' '+money(loadsBy[k])).join(' · ')||'todavía ninguna'}.</p></div>
 <div class="card"><h3>Día de Cuenta Comercio</h3><label class="chk"><input type="checkbox" id="fc-on" ${C.cb.on?'checked':''}> <span>Activar: pagando <b>toda</b> la compra con el monedero, el cliente recibe un porcentaje de vuelta en su monedero</span></label>
  <div class="grid g2"><div><label for="fc-p">Cashback (%)</label><input id="fc-p" inputmode="numeric" value="${C.cb.pct}"></div><div><label>Días</label><div class="row" style="gap:.3rem">${['Do','Lu','Ma','Mi','Ju','Vi','Sá'].map((d,i)=>`<label class="chk" style="margin:0"><input type="checkbox" class="fc-d" value="${i}" ${(C.cb.dows||[]).includes(i)?'checked':''}> ${d}</label>`).join('')}</div></div></div>
  <p class="sm mut">¿Preferís un <b>descuento</b> en el momento en vez de cashback? Configuralo en Configuración → «Recargo o descuento por medio de pago» para el medio Monedero.</p></div></div>
 <div class="row" style="margin-top:.6rem"><button class="btn" data-act="fwSave" style="white-space:normal">Guardar monedero y Día de Cuenta Comercio</button></div>
 ${withBal.length?`<div class="card" style="margin-top:1rem"><h3>Clientes con saldo</h3><div class="tw"><table><thead><tr><th>N.º</th><th>Cliente</th><th class="r">Saldo</th><th></th></tr></thead><tbody>${withBal.map(({c,b})=>`<tr><td>${pad4(c.num)}</td><td>${esc(custFull(c))}</td><td class="r" data-sv="${b}"><b>${money(b)}</b></td><td class="r"><button class="btn sm gold" data-act="walLoad" data-id="${c.id}">Cargar</button> <button class="btn sm" data-act="walHist" data-id="${c.id}">Movimientos</button></td></tr>`).join('')}</tbody></table></div></div>`:''}
 <div class="card" style="margin-top:1rem"><div class="row"><h3 class="sp">Gift cards y vouchers</h3><label class="chk" style="margin:0"><input type="checkbox" id="fg-on" ${C.gift.on?'checked':''}> Activar</label><label for="fg-m" class="sm mut" style="margin:0">Vigencia (meses)</label><input id="fg-m" inputmode="numeric" value="${C.gift.months}" style="max-width:70px"><button class="btn sm" data-act="fgSave">Guardar</button></div>
 <div class="tw"><table><thead><tr><th>Código</th><th>Para</th><th class="r">Valor</th><th class="r">Saldo</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>${G.map(g=>{const st=giftState(g);return `<tr><td><b>${esc(g.code)}</b>${g.origin==='ejemplo'?' <span class="tag sim">ej.</span>':''}</td><td class="sm">${g.cust?'Nominativa · '+esc(custFull(custById(g.cust))):'Al portador'}${g.holder?'<br>'+esc(g.holder):''}</td><td class="r">${money(g.amount)}</td><td class="r" data-sv="${giftBal(g)}"><b>${money(giftBal(g))}</b></td><td class="sm">${g.exp?esc(dmy(dkey(g.exp))):'—'}</td><td><span class="tag ${st==='activa'?'ok':st==='agotada'?'':'bad'}">${esc(GIFT_TXT[st])}</span></td>
  <td class="r"><button class="btn sm" data-act="gcPrint" data-id="${g.id}">Imprimir</button> <button class="btn sm" data-act="gcHist" data-id="${g.id}">Movimientos</button>${can('void')&&st==='activa'&&giftBal(g)===g.amount?` <button class="btn sm red" data-act="gcVoid" data-id="${g.id}">Anular</button>`:''}</td></tr>`;}).join('')||'<tr><td colspan="7" class="mut">Todavía no se vendió ninguna gift card.</td></tr>'}</tbody></table></div>
 <p class="sm mut">Al portador: la usa quien tenga el código. Nominativa: sólo su titular (hay que identificarlo en el cobro). Se puede usar en partes hasta agotar el saldo; lo que sobra queda para la próxima compra hasta el vencimiento [VERIFICAR plazos de vigencia con la normativa de defensa del consumidor].</p></div>`;},
 ()=>{const q=$('#fw-q');if(q)q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();const res=$('#fw-res');if(!v){res.innerHTML='';return;}
  const L=S.customers.filter(c=>c.status!=='baja'&&(custFull(c).toLowerCase().includes(v)||(c.wa||'').replace(/\D/g,'').includes(v.replace(/\D/g,'')||'zz')||pad4(c.num)===v||(c.dni&&normDni(v).length>=6&&normDni(c.dni)===normDni(v)))).slice(0,6);
  res.innerHTML=L.map(c=>`<button class="btn sm" style="margin:.2rem .2rem 0 0" data-act="walLoad" data-id="${c.id}">${esc(custFull(c))} · ${pad4(c.num)} · ${money(walBal(c.id))}</button>`).join('')||'<span class="sm mut">Sin resultados</span>';});},'Clientes');
A.fwSave=()=>{if(!can('config'))return toast('Sólo el administrador cambia estas reglas.',1);const p=parseNum(val('fc-p'));if(!(p>=0&&p<=50))return toast('El cashback va de 0 a 50 %.',1);
 const dows=$$('.fc-d').filter(x=>x.checked).map(x=>+x.value);if($('#fc-on').checked&&!dows.length)return toast('Elegí al menos un día para el Día de Cuenta Comercio.',1);
 fidSet('wallet',{on:$('#fw-on').checked,rubro:val('fw-r')});fidSet('cb',{on:$('#fc-on').checked,pct:p,dows});audit('CONFIG_MONEDERO',(fidCfg().wallet.on?'monedero on':'monedero off')+' · cashback '+(fidCfg().cb.on?p+' % días '+dows.join(','):'off'));save();toast('Guardado');rerender();};
A.fgSave=()=>{if(!can('config'))return toast('Sólo el administrador cambia estas reglas.',1);const m=parseNum(val('fg-m'));if(!(m>=1&&m<=36&&Number.isInteger(m)))return toast('La vigencia va de 1 a 36 meses.',1);
 fidSet('gift',{on:$('#fg-on').checked,months:m});audit('CONFIG_GIFT',(fidCfg().gift.on?'on':'off')+' · '+m+' meses');save();toast('Guardado');rerender();};
A.gcNew=()=>{if(!can('customers'))return toast('Sin permiso',1);const C=fidCfg();
 modal('Vender gift card / voucher',`<div class="grid g2"><div><label for="gc-a">Valor ($)</label>${numIn('gc-a',0,'0')}</div><div><label for="gc-me">Cómo la paga</label><select id="gc-me">${LOAD_MET.map(k=>`<option value="${k}">${esc(MET[k])}</option>`).join('')}</select></div></div>
 <label for="gc-t">Tipo</label><select id="gc-t"><option value="portador">Al portador (la usa quien tenga el código)</option><option value="nom">Nominativa (sólo un cliente del Club)</option></select>
 <div id="gc-cbox" hidden><label for="gc-q">Cliente titular</label><input id="gc-q" placeholder="Nombre, WhatsApp o N.º" autocomplete="off"><div id="gc-res"></div><input type="hidden" id="gc-c"></div>
 <div class="grid g2"><div><label for="gc-h">Para (nombre que va impreso, opcional)</label><input id="gc-h" maxlength="60"></div><div><label for="gc-b">De parte de (opcional)</label><input id="gc-b" maxlength="60"></div></div>
 <label for="gc-ms">Mensaje (opcional)</label><input id="gc-ms" maxlength="120"><div class="grid g2"><div><label for="gc-v">Vigencia (meses)</label><input id="gc-v" inputmode="numeric" value="${C.gift.months}"></div><div><label for="gc-r">Rubro (si es en efectivo)</label><select id="gc-r">${rubIngOpts(C.wallet.rubro||'cobr')}</select></div></div>`,
 {okText:'Emitir',onOk:w=>{const nom=val('gc-t')==='nom';if(nom&&!val('gc-c'))return w._err('Elegí el cliente titular.'),false;
  const r=giftSell({amount:cents(val('gc-a')),method:val('gc-me'),cust:nom?val('gc-c'):'',holder:val('gc-h'),buyer:val('gc-b'),msg:val('gc-ms'),months:parseNum(val('gc-v')),rubro:val('gc-r')});if(r.err)return w._err(r.err),false;
  toast('Gift card '+r.g.code+' emitida por '+money(r.g.amount));setTimeout(()=>{gcPrint(r.g);rerender();},60);}});
 const t=$('#gc-t');if(t)t.addEventListener('change',()=>{$('#gc-cbox').hidden=t.value!=='nom';});
 const q=$('#gc-q');if(q)q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();const res=$('#gc-res');if(!v){res.innerHTML='';return;}const L=S.customers.filter(c=>c.status!=='baja'&&(custFull(c).toLowerCase().includes(v)||pad4(c.num)===v||(c.wa||'').replace(/\D/g,'').includes(v.replace(/\D/g,'')||'zz'))).slice(0,6);
  res.innerHTML=L.map(c=>`<button type="button" class="btn sm" style="margin:.2rem .2rem 0 0" data-act="gcPick" data-id="${c.id}">${esc(custFull(c))} · ${pad4(c.num)}</button>`).join('')||'<span class="sm mut">Sin resultados</span>';});};
A.gcPick=el=>{const c=custById(el.dataset.id);if(!c)return;$('#gc-c').value=c.id;$('#gc-q').value=custFull(c);$('#gc-res').innerHTML='<span class="tag ok">Titular: '+esc(custFull(c))+'</span>';if(!val('gc-h'))$('#gc-h').value=custFull(c);};
function gcPrint(g){const st=giftState(g);const html=`<!doctype html><meta charset="utf-8"><title>Gift card ${esc(g.code)}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;margin:0}.gc{width:85.6mm;height:54mm;border:1px dashed #999;border-radius:4mm;padding:4mm;box-sizing:border-box;display:flex;gap:3mm;background:linear-gradient(135deg,#111,#3a3020);color:#fff}.gc b{color:#e8c35a}.qr{background:#fff;padding:1mm;border-radius:2mm;width:24mm;height:24mm;flex:none}.qr svg{width:100%;height:100%}small{font-size:7pt;opacity:.85}</style>
 <div class="gc"><div style="flex:1;display:flex;flex-direction:column;justify-content:space-between"><div><div style="font:700 10pt Georgia">${esc(S.tenant.name)}</div><div style="font-size:8pt">GIFT CARD${g.cust?' · nominativa':' · al portador'}</div></div><div style="font:700 18pt Georgia"><b>${money(g.amount)}</b></div><div style="font:700 11pt monospace;letter-spacing:.5px">${esc(g.code)}</div><small>${g.holder?'Para: '+esc(g.holder)+' · ':''}${g.buyer?'De: '+esc(g.buyer)+' · ':''}Vence ${esc(dmy(dkey(g.exp)))}${g.msg?'<br>'+esc(g.msg):''}${st!=='activa'?' · '+esc(GIFT_TXT[st]):''}</small></div><div class="qr">${QR.svg(g.code,3,1)}</div></div>
 <p style="font-size:8pt;color:#555;max-width:86mm">Se usa en el local presentando el código. Se puede usar en partes hasta agotar el saldo. No se canjea por dinero. Desarrollado por ${esc(VB.name)} · ${esc(VB.phone)}.</p>`;
 const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);f.contentDocument.open();f.contentDocument.write(html);f.contentDocument.close();
 audit('GIFT_IMPRIMIR',g.code);setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){}setTimeout(()=>f.remove(),4000);},300);}
A.gcPrint=el=>{const g=giftL().find(x=>x.id===el.dataset.id);if(g)gcPrint(g);};
A.gcHist=el=>{const g=giftL().find(x=>x.id===el.dataset.id);if(!g)return;let bal=0;const rows=giftM().filter(m=>m.gift===g.id).map(m=>{bal+=m.amount;return{m,bal};}).reverse();
 modal('Gift card '+g.code,`<p>${g.cust?'Nominativa de <b>'+esc(custFull(custById(g.cust)))+'</b>':'Al portador'} · emitida ${esc(fmtDT(g.ts))} por ${esc(g.user)} · vence ${esc(dmy(dkey(g.exp)))} · <b>${esc(GIFT_TXT[giftState(g)])}</b></p><div class="tw"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th class="r">Importe</th><th class="r">Saldo</th></tr></thead><tbody>${rows.map(({m,bal})=>`<tr><td>${fmtDT(m.ts)}</td><td>${esc(m.ref||m.kind)}</td><td class="r ${m.amount<0?'neg':''}">${money(m.amount)}</td><td class="r"><b>${money(bal)}</b></td></tr>`).join('')}</tbody></table></div>`,{wide:true,okText:'Cerrar',noCancel:true});};
A.gcVoid=el=>{const g=giftL().find(x=>x.id===el.dataset.id);if(!g||!can('void'))return;modal('Anular gift card '+g.code,`<p>Sólo se anula si no tiene canjes. Si se vendió en efectivo en este turno, se registra el egreso de la devolución.</p><label for="gv-m">Motivo (obligatorio)</label><input id="gv-m" maxlength="100">`,
 {onOk:w=>{if(val('gv-m').trim().length<3)return w._err('Escribí el motivo.'),false;const e=giftVoid(g,val('gv-m').trim());if(e)return w._err(e),false;toast('Gift card anulada');rerender();}});};

/* ---------- pantalla: niveles, cumpleaños y juegos ---------- */
reg('fidplus','Niveles, cumpleaños y juegos','check','customers',()=>{const C=fidCfg();const soc=S.customers.filter(c=>c.status!=='baja'&&c.consent&&c.consent.club!==false);
 const byT={};if(C.tiers.on)soc.forEach(c=>{const t=custTier(c);if(t)byT[t.t.k]=(byT[t.t.k]||0)+1;});
 const bd=soc.filter(c=>isBirthWeek(c));const plays=gameL().slice().reverse().slice(0,30);const adm=can('config');const dis=adm?'':'disabled';
 return `<div class="row"><h1 class="sp">Niveles, cumpleaños y juegos del Club</h1></div>
 ${fidSqlNote()}${adm?'':'<div class="warnbox sm">Sólo el administrador cambia estas reglas; acá podés consultarlas.</div>'}
 <div class="card"><div class="row"><h3 class="sp">Niveles por consumo</h3><label class="chk" style="margin:0"><input type="checkbox" id="ft-on" ${C.tiers.on?'checked':''} ${dis}> Activar</label></div>
 <p class="sm mut">El nivel se calcula solo con lo que el cliente compró en los últimos días (ventas cobradas menos devoluciones). El porcentaje es un beneficio más: compite con cupón, membresía y cumpleaños, y <b>se aplica el mayor</b> (no se acumulan).${restrOn()?' El tabaco queda afuera.':''}</p>
 <div class="grid g4"><div><label for="ft-d">Período (días)</label><input id="ft-d" inputmode="numeric" value="${C.tiers.days}" ${dis}></div>${C.tiers.list.map((t,i)=>`<div><label for="ft-m${i}">${TIER_ICO[t.k]||''} ${esc(t.name)} desde ($)</label><input id="ft-m${i}" inputmode="decimal" value="${i===0?'0':esc(pesosStr(t.min))}" ${dis||i===0?'disabled':''}><label for="ft-p${i}">Beneficio (%)</label><input id="ft-p${i}" inputmode="numeric" value="${t.pct}" ${dis}></div>`).join('')}</div>
 ${C.tiers.on?`<p class="sm">Socios por nivel: ${C.tiers.list.map(t=>(TIER_ICO[t.k]||'')+' '+esc(t.name)+' <b>'+(byT[t.k]||0)+'</b>').join(' · ')}</p>`:''}</div>
 <div class="card" style="margin-top:1rem"><div class="row"><h3 class="sp">Cumpleaños automático</h3><label class="chk" style="margin:0"><input type="checkbox" id="fb-on" ${C.bday.on?'checked':''} ${dis}> Activar</label><label for="fb-p" class="sm mut" style="margin:0">Regalo (%)</label><input id="fb-p" inputmode="numeric" value="${C.bday.pct}" style="max-width:70px" ${dis}></div>
 <p class="sm mut">La semana del cumpleaños (±3 días) el sistema aplica solo el regalo en el cobro, <b>una vez por año</b>. Los socios que aceptaron promociones pueden recibir el saludo por WhatsApp (se abre WhatsApp con el mensaje listo: no es un envío automático).</p>
 ${bd.length?`<div class="tw"><table><thead><tr><th>Socio</th><th>Cumple</th><th>Regalo</th><th></th></tr></thead><tbody>${bd.map(c=>`<tr><td>${esc(custFull(c))}</td><td>${esc(birthTxt(c.birth))}</td><td>${bdayUsed(c.id)?'<span class="tag">ya usado</span>':'<span class="tag ok">disponible</span>'}</td><td class="r">${hasComm(c)?`<a class="btn sm" target="_blank" rel="noopener noreferrer" href="https://wa.me/${esc((c.wa||'').replace(/\D/g,''))}?text=${encodeURIComponent('¡Feliz cumpleaños, '+c.name+'! 🎂 Esta semana tenés '+C.bday.pct+' % de regalo en '+S.tenant.name+'. ¡Te esperamos!')}">Saludar por WhatsApp</a>`:'<span class="sm mut">sin permiso de promociones</span>'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="sm mut">Nadie cumple años esta semana.</p>'}</div>
 <div class="card" style="margin-top:1rem"><div class="row"><h3 class="sp">Ruleta y trivia</h3><label class="chk" style="margin:0"><input type="checkbox" id="fg2-on" ${C.game.on?'checked':''} ${dis}> Activar</label></div>
 <p class="sm mut">Después de cobrar a un socio identificado (desde la compra mínima), aparece «Girar la ruleta». Una jugada por venta; el premio se acredita en el acto (sellos, saldo del monedero o un cupón de un solo uso) y se revierte si se anula la venta. Promociones con premio: [VERIFICAR bases y condiciones y normativa provincial de sorteos].</p>
 <div class="grid g3"><div><label for="fg2-m">Modo</label><select id="fg2-m" ${dis}><option value="ruleta" ${C.game.mode==='ruleta'?'selected':''}>Ruleta</option><option value="trivia" ${C.game.mode==='trivia'?'selected':''}>Trivia + ruleta</option></select></div><div><label for="fg2-min">Compra mínima ($)</label><input id="fg2-min" inputmode="decimal" value="${esc(pesosStr(C.game.min||0))}" ${dis}></div><div><label>Probabilidad</label><p class="sm" style="margin:.4rem 0">Peso de cada premio sobre el total (${C.game.prizes.reduce((a,p)=>a+(+p.w||0),0)}).</p></div></div>
 <div class="tw"><table><thead><tr><th>Premio (texto)</th><th>Tipo</th><th>Valor</th><th class="r">Peso</th></tr></thead><tbody>${C.game.prizes.map((p,i)=>`<tr><td><input id="pz-l${i}" maxlength="40" value="${esc(p.label)}" aria-label="Texto del premio ${i+1}" ${dis}></td><td><select id="pz-k${i}" aria-label="Tipo del premio ${i+1}" ${dis}>${[['stamps','Sellos'],['wallet','Saldo al monedero ($)'],['coupon','Cupón % próxima compra'],['none','Sin premio']].map(([k,v])=>`<option value="${k}" ${p.kind===k?'selected':''}>${v}</option>`).join('')}</select></td><td><input id="pz-v${i}" inputmode="decimal" value="${esc(p.kind==='wallet'?pesosStr(p.v):String(p.v))}" aria-label="Valor del premio ${i+1}" style="max-width:110px" ${dis}></td><td class="r"><input id="pz-w${i}" inputmode="numeric" value="${p.w}" aria-label="Peso del premio ${i+1}" style="max-width:70px" ${dis}></td></tr>`).join('')}</tbody></table></div>
 <h4>Preguntas de la trivia</h4><p class="sm mut">Marcá con el círculo la respuesta correcta.</p>${C.game.trivia.map((t,i)=>`<div class="card sm" style="margin:.3rem 0"><input id="tq${i}" maxlength="120" value="${esc(t.q)}" aria-label="Pregunta ${i+1}" ${dis}><div class="grid g3">${t.o.map((o,j)=>`<div style="display:flex;align-items:center;gap:.4rem"><input type="radio" name="tok${i}" value="${j}" ${t.ok===j?'checked':''} ${dis} aria-label="Opción ${j+1} es la correcta" style="width:22px;height:22px;flex:none;min-height:0"><input id="to${i}_${j}" maxlength="60" value="${esc(o)}" aria-label="Opción ${j+1} de la pregunta ${i+1}" ${dis} style="flex:1;min-width:0"></div>`).join('')}</div></div>`).join('')}
 ${adm?'<button class="btn sm" data-act="fqAdd">+ Pregunta</button>':''}</div>
 ${adm?'<div class="row" style="margin-top:.6rem"><button class="btn gold" data-act="fpSave" style="white-space:normal">Guardar niveles, cumpleaños y juegos</button></div>':''}
 <div class="card" style="margin-top:1rem"><h3>Últimas jugadas</h3><div class="tw"><table><thead><tr><th>Fecha</th><th>Socio</th><th>Por</th><th>Premio</th><th>Venta</th></tr></thead><tbody>${plays.map(p=>{const s=S.sales.find(x=>x.id===p.sale);return `<tr><td>${fmtDT(p.ts)}</td><td>${esc(custLabel(p.cust))}</td><td class="sm">${esc(p.via)}</td><td>${esc(p.label)}${p.code?' · <b>'+esc(p.code)+'</b>':''}${p.rev?' <span class="tag bad">revertido</span>':''}</td><td class="sm">${s?esc(s.n):'—'}</td></tr>`;}).join('')||'<tr><td colspan="5" class="mut">Todavía no hubo jugadas.</td></tr>'}</tbody></table></div></div>`;},null,'Clientes');
A.fqAdd=()=>{const C=fidCfg();fidSet('game',{trivia:C.game.trivia.concat([{q:'Nueva pregunta',o:['Opción A','Opción B','Opción C'],ok:0}])});rerender();};
A.fpSave=()=>{if(!can('config'))return;const C=fidCfg();const days=parseNum(val('ft-d'));if(!(days>=7&&days<=730&&Number.isInteger(days)))return toast('El período de los niveles va de 7 a 730 días.',1);
 const list=C.tiers.list.map((t,i)=>({k:t.k,name:t.name,min:i===0?0:cents(val('ft-m'+i)),pct:parseNum(val('ft-p'+i))}));
 for(let i=0;i<list.length;i++){const t=list[i];if(isNaN(t.min)||t.min<0)return toast('Revisá el monto del nivel '+t.name+'.',1);if(!(t.pct>=0&&t.pct<=50))return toast('El beneficio de '+t.name+' va de 0 a 50 %.',1);if(i&&t.min<=list[i-1].min)return toast('Cada nivel tiene que pedir más consumo que el anterior.',1);}
 const bp=parseNum(val('fb-p'));if(!(bp>=0&&bp<=50))return toast('El regalo de cumpleaños va de 0 a 50 %.',1);
 const min=cents(val('fg2-min')||'0');if(isNaN(min)||min<0)return toast('Revisá la compra mínima de la ruleta.',1);
 const prizes=C.game.prizes.map((p,i)=>{const kind=val('pz-k'+i);const raw=val('pz-v'+i);return{id:p.id,label:val('pz-l'+i).trim().replace(/[<>]/g,'').slice(0,40)||'Premio',kind,v:kind==='wallet'?cents(raw):kind==='none'?0:parseNum(raw),w:parseNum(val('pz-w'+i))};});
 for(const p of prizes){if(!(Number.isInteger(p.w)&&p.w>=0&&p.w<=1000))return toast('El peso de cada premio es un entero de 0 a 1000.',1);if(p.kind==='stamps'&&!(Number.isInteger(p.v)&&p.v>=1&&p.v<=5))return toast('Un premio de sellos da de 1 a 5 sellos.',1);
  if(p.kind==='wallet'&&!(p.v>0&&p.v<=10000000))return toast('Un premio de saldo va de $ 0,01 a $ 100.000.',1);if(p.kind==='coupon'&&!(p.v>=1&&p.v<=50))return toast('Un premio de cupón va de 1 a 50 %.',1);}
 if($('#fg2-on').checked&&!prizes.some(p=>p.w>0))return toast('Al menos un premio tiene que tener peso.',1);
 const trivia=C.game.trivia.map((t,i)=>({q:val('tq'+i).trim().replace(/[<>]/g,'').slice(0,120),o:t.o.map((o,j)=>val('to'+i+'_'+j).trim().replace(/[<>]/g,'').slice(0,60)),ok:+(($$('input[name=tok'+i+']').find(x=>x.checked)||{}).value||0)})).filter(t=>t.q.length>=3&&t.o.every(o=>o));
 if(val('fg2-m')==='trivia'&&!trivia.length)return toast('La trivia necesita al menos una pregunta completa.',1);
 fidSet('tiers',{on:$('#ft-on').checked,days,list});fidSet('bday',{on:$('#fb-on').checked,pct:bp});fidSet('game',{on:$('#fg2-on').checked,mode:val('fg2-m'),min,prizes,trivia});
 audit('CONFIG_CLUB_PLUS','niveles '+(fidCfg().tiers.on?'on':'off')+' · cumpleaños '+(fidCfg().bday.on?bp+' %':'off')+' · juego '+(fidCfg().game.on?fidCfg().game.mode:'off'));save();toast('Guardado');rerender();};

/* ---------- datos de ejemplo (sólo demos) ---------- */
function fidDemoSeed(){if(IS_CLIENT||S.fidDemo)return;const L=S.customers.filter(c=>c.status!=='baja');if(L.length<2)return;S.fidDemo=1;
 S.cfg.fid=Object.assign({},S.cfg.fid||{},{tiers:Object.assign({},FID_DEF.tiers,{on:true}),bday:{on:true,pct:10},wallet:{on:true,rubro:'cobr'},gift:{on:true,months:6},cb:{on:true,dows:[3,6],pct:5},game:Object.assign({},FID_DEF.game,{on:true,min:300000})});
 const t0=now()-5*86400000;const u='ejemplo';
 fidMov().push({id:uid(),cust:L[0].id,ts:t0,kind:'carga',amount:2000000,method:'transferencia',ref:'Carga · Transferencia (ejemplo)',user:u},{id:uid(),cust:L[1].id,ts:t0+3600e3,kind:'carga',amount:500000,method:'debito',ref:'Carga · Débito (ejemplo)',user:u},{id:uid(),cust:L[0].id,ts:t0+86400e3,kind:'cashback',amount:25000,ref:'Día de Cuenta Comercio (ejemplo)',user:u});
 const mk=(code,amount,cust,holder,used)=>{const g={id:uid(),code,ts:t0,exp:now()+150*86400000,cust:cust||'',holder,buyer:'',amount,method:'efectivo',mov:'',status:'activa',user:u,origin:'ejemplo',msg:'¡Que lo disfrutes! (ejemplo)'};giftL().push(g);giftM().push({id:uid(),gift:g.id,ts:t0,amount,kind:'emision',ref:'Emisión (ejemplo)',user:u});if(used)giftM().push({id:uid(),gift:g.id,ts:t0+86400e3,amount:-used,kind:'canje',ref:'Canje parcial (ejemplo)',user:u});};
 mk('GC-DEMO-0001',1000000,'','Regalo de ejemplo',300000);mk('GC-DEMO-0002',500000,L[1].id,custFull(L[1]),0);
 gameL().push({id:uid(),sale:'',cust:L[0].id,ts:t0+2*86400e3,prize:'pz1',label:'+1 sello',kind:'stamps',v:1,via:'ruleta (ejemplo)',user:u});}
