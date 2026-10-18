/* ===== Clientes, Club RAVE, fidelización, cupones, membresías y cuenta corriente ===== */
const pad4=n=>String(n).padStart(4,'0');
const custById=id=>S.customers.find(c=>c.id===id)||null;
const custFull=c=>c?(c.name+' '+c.last).trim():'';
function normWA(s){const d=String(s||'').replace(/\D/g,'');return d.length>=10?d.slice(-10):'';}
const waFull=w10=>'+549'+w10;
function parseBirthISO(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||'').trim());if(!m)return null;const y=+m[1],mo=+m[2],d=+m[3];const dt=new Date(Date.UTC(y,mo-1,d));
 if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return null;if(y<1900||dt.getTime()>now())return null;return{y,mo,d};}
function parseBirth(s){s=String(s||'').trim();let m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);if(m)s=m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');return parseBirthISO(s);}
function ageOf(b){const t=new Date(now());let a=t.getUTCFullYear()-b.y;if(t.getUTCMonth()+1<b.mo||(t.getUTCMonth()+1===b.mo&&t.getUTCDate()<b.d))a--;return a;}
function isBirthWeek(c){const b=parseBirthISO(c&&c.birth);if(!b)return false;const t=new Date(now());const y=t.getUTCFullYear();
 const day=ms=>Math.floor(ms/86400000);const bd=day(Date.UTC(y,b.mo-1,b.d)),td=day(Date.UTC(y,t.getUTCMonth(),t.getUTCDate()));return Math.abs(bd-td)<=3;}
const birthTxt=iso=>{const b=parseBirthISO(iso);return b?b.d+'/'+b.mo+'/'+b.y:'';};
const hasComm=c=>!!(c&&c.consent&&c.consent.comm&&c.status!=='baja');

/* ---------- libro mayor de sellos (no se edita: se corrige con un movimiento compensatorio) ---------- */
const OTP_MS=120000;
const stampsOf=cid=>S.loyalty.ledger.filter(e=>e.cust===cid).reduce((a,e)=>a+e.n,0);
const rewardsOf=cid=>Math.floor(stampsOf(cid)/S.loyalty.goal);
const otpWin=t=>Math.floor(t/OTP_MS);
const otpFor=(c,w)=>pad4(parseInt(sha256(c.secret+'|'+c.id+'|'+w).slice(0,8),16)%10000);
function cardCode(c){const w=otpWin(now());return{socio:pad4(c.num),otp:otpFor(c,w),secs:Math.max(1,Math.ceil(((w+1)*OTP_MS-now())/1000)),win:w};}
function verifyStampCode(code,custId){const d=String(code||'').replace(/\D/g,'');
 if(d.length!==8)return{ok:false,msg:'El código son 8 números: N.º de socio (4) + código (4).'};
 const num=+d.slice(0,4),otp=d.slice(4);const c=S.customers.find(x=>x.num===num&&x.status!=='baja');if(!c)return{ok:false,msg:'Socio inexistente.'};
 if(custId&&c.id!==custId)return{ok:false,msg:'El código pertenece a otro socio.'};
 const w=otpWin(now());let win=null;[w,w-1].forEach(x=>{if(win===null&&otpFor(c,x)===otp)win=x;});
 if(win===null)return{ok:false,msg:'Código vencido o incorrecto. Pedile al cliente que lo actualice en su tarjeta.'};
 if(S.loyalty.usedOtp[c.id+':'+win])return{ok:false,msg:'Ese código ya se usó (es de un solo uso).'};
 const last=S.loyalty.ledger.filter(e=>e.cust===c.id&&e.kind==='stamp').pop();
 if(last&&now()-last.ts<86400000)return{ok:false,msg:'Este socio ya sumó un sello en las últimas 24 h (límite antifraude).'};
 return{ok:true,cust:c,custName:custFull(c),win};}
function commitStamp(cid,res,ref){S.loyalty.ledger.push({id:uid(),cust:cid,ts:now(),kind:'stamp',n:1,ref:ref||'',user:user?user.name:'sistema'});S.loyalty.usedOtp[cid+':'+res.win]=now();
 const st=stampsOf(cid);res.stamps=Math.min(st,S.loyalty.goal);res.reward=st>=S.loyalty.goal;res.custName=res.custName||custFull(custById(cid));
 audit('SELLO',res.custName+' · '+st+'/'+S.loyalty.goal+' · '+(ref||''));save();}
function stampReverse(sale){if(!sale.cust)return;S.loyalty.ledger.push({id:uid(),cust:sale.cust,ts:now(),kind:'adjust',n:-1,ref:'reversión por anulación '+sale.n,user:user?user.name:'sistema'});audit('SELLO_REVERSION',sale.n);}
function redeemReward(cid){const c=custById(cid);if(!c)return'Cliente inexistente.';if(stampsOf(cid)<S.loyalty.goal)return'Todavía no completó los '+S.loyalty.goal+' sellos.';
 S.loyalty.ledger.push({id:uid(),cust:cid,ts:now(),kind:'redeem',n:-S.loyalty.goal,ref:S.loyalty.reward,user:user?user.name:'sistema'});audit('CANJE_PREMIO',custFull(c)+' · '+S.loyalty.reward);save();return'';}

/* ---------- cuenta corriente (fiado) ---------- */
const debtOf=cid=>S.sales.filter(s=>s.cust===cid&&s.fiado&&s.status==='ok').reduce((a,s)=>a+saleFiadoAmt(s),0)-S.fiadoPays.filter(p=>p.cust===cid).reduce((a,p)=>a+p.amount,0);
/* Libro de cuenta corriente del cliente: se DERIVA de las ventas y los cobros (no hay un segundo saldo que pueda desfasarse).
   Débito = parte de la venta que quedó a cuenta corriente · Crédito = cobro de deuda. */
function ccLedger(cid){
 const rows=[];
 S.sales.filter(s=>s.cust===cid&&s.fiado&&s.status==='ok').forEach(s=>rows.push({ts:s.ts,kind:'debito',amount:saleFiadoAmt(s),ref:s.n,total:s.total,state:salePayState(s),concept:'Venta '+s.n+' · total '+money(s.total)+' · '+salePayLabel(s)}));
 S.fiadoPays.filter(p=>p.cust===cid).forEach(p=>rows.push({ts:p.ts,kind:'credito',amount:p.amount,ref:'',concept:'Cobro de deuda · '+(MET[p.method]||p.method)}));
 rows.sort((a,b)=>a.ts-b.ts);let bal=0;rows.forEach(r=>{bal+=r.kind==='debito'?r.amount:-r.amount;r.bal=bal;});return rows;}
function ccLedgerHTML(cid){const L=ccLedger(cid);if(!L.length)return '<p class="sm mut">Sin movimientos de cuenta corriente.</p>';
 return `<div class="tw"><table><caption class="sr">Movimientos de cuenta corriente</caption><thead><tr><th>Fecha</th><th>Detalle</th><th class="r">Débito</th><th class="r">Crédito</th><th class="r">Saldo</th></tr></thead><tbody>${L.slice(-30).reverse().map(r=>`<tr><td>${fmtDT(r.ts)}</td><td>${esc(r.concept)}${r.kind==='debito'?` <span class="tag ${r.state==='parcial'?'warn':'bad'}">${esc(PSTATE_TXT[r.state])}</span>`:''}</td><td class="r">${r.kind==='debito'?money(r.amount):''}</td><td class="r">${r.kind==='credito'?money(r.amount):''}</td><td class="r"><b>${money(r.bal)}</b></td></tr>`).join('')}</tbody></table></div>`;}
function fiadoPay(cid,amount,method){const c=custById(cid);if(!c)return'Cliente inexistente.';if(!(amount>0))return'El importe debe ser mayor a cero.';if(amount>debtOf(cid))return'Supera la deuda ('+money(debtOf(cid))+').';
 let mov='';if(method==='efectivo'){const e=addMov('ingreso','cobr','Cobro cuenta corriente · '+custFull(c),amount);if(e)return e;mov=S.movs[S.movs.length-1].id;}
 S.fiadoPays.push({id:uid(),cust:cid,ts:now(),amount,method,user:user.name,mov,rubro:'cobr'});audit('COBRO_FIADO',custFull(c)+' · '+money(amount)+' · '+MET[method]);save();return'';}

/* ---------- membresías ---------- */
function memberActive(c){if(!c)return null;const m=S.members.find(x=>x.cust===c.id&&x.status==='activa'&&x.to>now());if(!m)return null;const p=S.plans.find(x=>x.id===m.plan);return p?{name:p.name,pct:p.pct,until:dmy(dkey(m.to)),m}:null;}

/* ---------- beneficios: cupón O membresía (el mayor; nunca se acumulan), el tabaco queda afuera ---------- */
const noPromo=l=>{const r=rub(l.rubro);return !!(r&&r.age);};
function couponCheck(cp,cust,base){const today=dkey(now());
 if(!cp.active)return'El cupón no está activo.';if(cp.from&&today<cp.from)return'El cupón todavía no empezó.';if(cp.to&&today>cp.to)return'El cupón venció.';
 if(cp.maxUses&&cp.uses.length>=cp.maxUses)return'El cupón alcanzó su límite de usos.';
 if((cp.aud!=='todos'||cp.perCust>0)&&!cust)return'Este cupón necesita identificar al cliente.';
 if(cp.aud==='cumple'&&!isBirthWeek(cust))return'Este cupón es sólo para la semana del cumpleaños.';
 if(cp.perCust>0&&cust&&cp.uses.filter(u=>u.cust===cust.id).length>=cp.perCust)return'El cliente ya usó este cupón.';
 if(base<(cp.min||0))return'Compra mínima de '+money(cp.min)+' en productos con promoción.';return'';}
const cpDisc=(cp,base)=>cp.type==='pct'?Math.round(base*cp.value/100):Math.min(cp.value,base);
function applyBenefit(lines,custId,code){const cust=custById(custId);let base=0;lines.forEach(l=>{if(!noPromo(l))base+=Math.round(l.qty*l.price);});
 const out={disc:0,kind:'',label:'',code:'',couponId:'',couponErr:'',base};
 let cand=null;
 code=String(code||'').trim().toUpperCase();
 if(code){const cp=S.coupons.find(x=>x.code===code);if(!cp)out.couponErr='Cupón inexistente.';else{const e=couponCheck(cp,cust,base);if(e)out.couponErr=e;else cand={kind:'coupon',disc:cpDisc(cp,base),label:'Cupón '+cp.code,code:cp.code,couponId:cp.id};}}
 const mb=memberActive(cust);let mc=null;if(mb&&mb.pct>0)mc={kind:'member',disc:Math.round(base*mb.pct/100),label:'Membresía '+mb.name+' ('+mb.pct+' %)'};
 let best=cand;if(mc&&(!best||mc.disc>best.disc)){best=mc;if(cand)out.note='Se aplicó la membresía (mayor beneficio): no se acumula con el cupón.';}
 if(best){out.disc=Math.min(best.disc,base);out.kind=best.kind;out.label=best.label;out.code=best.code||'';out.couponId=best.couponId||'';if(best.kind!=='coupon')out.couponErr=cand?'':out.couponErr;}
 if(base===0&&(code||mb)&&!out.couponErr)out.note='Los productos de tabaco no participan de promociones ni descuentos.';
 return out;}
/* reparte el descuento entre las líneas elegibles (resto al mayor decimal) */
function allocDisc(lines,disc){const idx=[],bases=[];lines.forEach((l,i)=>{if(!noPromo(l)){idx.push(i);bases.push(Math.round(l.qty*l.price));}});const out=lines.map(()=>0);const B=bases.reduce((a,b)=>a+b,0);if(!disc||!B)return out;
 const ex=bases.map(b=>disc*b/B);const fl=ex.map(Math.floor);let rest=disc-fl.reduce((a,b)=>a+b,0);const ord=ex.map((e,i)=>[e-fl[i],i]).sort((a,b)=>b[0]-a[0]);for(let k=0;k<rest;k++)fl[ord[k%ord.length][1]]++;
 idx.forEach((li,k)=>{out[li]=Math.min(fl[k],bases[k]);});return out;}

/* ---------- alta de clientes (menú público y mostrador) ---------- */
const clubHits=[];
function custCreate(f,origin){const nm=String(f.name||'').trim().replace(/[<>]/g,'').slice(0,40),ls=String(f.last||'').trim().replace(/[<>]/g,'').slice(0,40);
 const b=parseBirth(f.birth);const w=normWA(f.wa);
 const c={id:uid(),num:S.customers.reduce((m,x)=>Math.max(m,x.num||0),0)+1,name:nm,last:ls,birth:b?b.y+'-'+String(b.mo).padStart(2,'0')+'-'+String(b.d).padStart(2,'0'):'',wa:waFull(w),origin,
  consent:{club:true,comm:!!f.comm,analytics:!!f.analytics,version:IS_CLIENT?'v1-2026':'v1-2026-demo',ts:now()},ts:now(),status:'activo',limit:0,secret:uid()+uid(),notes:''};
 S.customers.push(c);return c;}
function clubJoin(f){const en=()=>window.RAVE_LANG&&window.RAVE_LANG()==='en';const bad=(es,e)=>({ok:false,msg:en()?e:es});
 const full=String(f.nombre||'').trim().replace(/\s+/g,' ');const parts=full.split(' ');
 if(parts.length<2||full.length<3||full.length>80)return bad('Ingresá tu nombre y apellido.','Enter your first and last name.');
 const last=parts.pop(),name=parts.join(' ');
 const b=parseBirth(f.cumple);if(!b)return bad('Elegí una fecha de cumpleaños válida.','Choose a valid birthday.');
 const w=normWA(f.whatsapp);if(!w||/^(\d)\1+$/.test(w))return bad('Ingresá un WhatsApp válido.','Enter a valid WhatsApp number.');
 if(ageOf(b)<18)return bad('El Club RAVE es sólo para mayores de 18 años.','RAVE Club is for adults (18+) only.');
 const t=now();const recent=clubHits.filter(x=>t-x<60000);if(recent.length>=3)return bad('Demasiados intentos, probá en un minuto.','Too many attempts, try again in a minute.');
 clubHits.length=0;recent.forEach(x=>clubHits.push(x));clubHits.push(t);
 const dup=S.customers.find(c=>normWA(c.wa)===w);
 if(dup){audit('CLUB_ALTA_DUP','intento con número ya registrado');save();return{ok:true,msg:en()?'Done! If your details are valid you are now in the Club. If you already had a card, recover it with your WhatsApp and birthday.':'¡Listo! Si los datos son válidos, ya estás en el Club. Si ya tenías tarjeta, recuperala con tu WhatsApp y tu cumpleaños.'};}
 const c=custCreate({name,last,birth:f.cumple,wa:f.whatsapp,comm:f.comm},'menú público');audit('CLUB_ALTA','menú público · socio '+pad4(c.num));save();pubRefresh();
 return{ok:true,cardId:c.id,msg:en()?'Welcome to the Club! Your card is ready below.':'¡Bienvenido/a al Club RAVE! Tu tarjeta ya está lista más abajo.'};}

/* ---------- API que ve el menú público (nunca devuelve secretos ni datos de terceros) ---------- */
function pubCard(id){const c=custById(id);if(!c||c.status==='baja')return null;const st=stampsOf(c.id);const g=S.loyalty.goal;const mb=memberActive(c);
 return{name:c.name,num:pad4(c.num),stamps:Math.min(st,g),goal:g,rewards:Math.floor(st/g),rewardText:S.loyalty.reward,member:mb?{name:mb.name,until:mb.until,pct:mb.pct}:null};}
function pubCardCode(id){const c=custById(id);if(!c||c.status==='baja')return null;const k=cardCode(c);return{socio:k.socio,otp:k.otp,secs:k.secs,qr:QR.svg('RAVE|'+k.socio+'|'+k.otp,4,2)};}
function pubCardLogin(wa,bd){const w=normWA(wa);const b=parseBirth(bd);if(!w||!b)return null;
 const c=S.customers.find(x=>normWA(x.wa)===w&&x.status!=='baja'&&x.birth===b.y+'-'+String(b.mo).padStart(2,'0')+'-'+String(b.d).padStart(2,'0'));return c?c.id:null;}
function cpDesc(cp){return cp.type==='pct'?cp.value+' % de descuento':money(cp.value)+' de descuento';}
function cpCond(cp){const a=[];if(cp.min)a.push('Compra mínima '+money(cp.min));if(cp.to)a.push('Hasta '+dmy(cp.to));if(cp.perCust)a.push(cp.perCust+' uso por cliente');if(cp.aud==='club')a.push('Sólo socios del Club');if(cp.aud==='cumple')a.push('Semana del cumpleaños');a.push('Excluye tabaco');return a.join(' · ');}
function pubCoupons(id){const c=id?custById(id):null;const today=dkey(now());
 return S.coupons.filter(cp=>cp.active&&cp.public!==false&&(!cp.from||today>=cp.from)&&(!cp.to||today<=cp.to)&&(!cp.maxUses||cp.uses.length<cp.maxUses)&&(cp.aud==='todos'||(cp.aud==='club'&&c)||(cp.aud==='cumple'&&c&&isBirthWeek(c))))
  .map(cp=>({code:cp.code,desc:(cp.note||cpDesc(cp)),cond:cpCond(cp)}));}
function pubCouponInfo(code,total){code=String(code||'').trim().toUpperCase();const cp=S.coupons.find(x=>x.code===code);
 if(!cp||!cp.active)return{ok:false,msg:'Ese cupón no existe o no está activo.',msgEn:'That coupon does not exist or is not active.'};
 const today=dkey(now());if((cp.from&&today<cp.from)||(cp.to&&today>cp.to))return{ok:false,msg:'El cupón no está vigente.',msgEn:'The coupon is not valid today.'};
 if(cp.maxUses&&cp.uses.length>=cp.maxUses)return{ok:false,msg:'El cupón alcanzó su límite de usos.',msgEn:'The coupon reached its usage limit.'};
 if(total<(cp.min||0))return{ok:false,msg:'Compra mínima '+money(cp.min)+'.',msgEn:'Minimum purchase '+money(cp.min)+'.'};
 const d=cpDesc(cp);const dd=cpDisc(cp,total);return{ok:true,code:cp.code,desc:d+(cp.aud!=='todos'?' (se valida en el mostrador con tu tarjeta)':' (se valida en el mostrador)'),descEn:(cp.type==='pct'?cp.value+' % off':money(cp.value)+' off')+' (validated at the counter)',total:Math.max(0,total-dd)};}
function pubPlans(){return S.plans.filter(p=>p.active).map(p=>({name:p.name,price:p.price/100,period:p.period,desc:p.desc}));}

/* ================= PANTALLA: CLIENTES ================= */
let cuF={q:''};
function custRow(c){const st=stampsOf(c.id),mb=memberActive(c),dt=debtOf(c.id);
 return `<tr><td>${pad4(c.num)}</td><td><b>${esc(custFull(c))}</b>${c.status==='baja'?' <span class="tag bad">baja</span>':''}${c.origin==='ejemplo'?' <span class="tag sim">ej.</span>':''}</td><td>${esc(c.wa)}</td><td>${esc(birthTxt(c.birth))}</td><td class="sm">${esc(c.origin)}<br>${c.consent.comm?'<span class="tag ok">promos sí</span>':'<span class="tag">promos no</span>'}</td><td>${Math.min(st,S.loyalty.goal)}/${S.loyalty.goal}${st>=S.loyalty.goal?' 🎁':''}</td><td class="sm">${mb?'⭐ '+esc(mb.name)+'<br>hasta '+esc(mb.until):'—'}</td><td class="r">${c.limit?`${money(dt)}<br><span class="sm mut">de ${money(c.limit)}</span>`:'<span class="mut sm">sin crédito</span>'}</td><td class="r"><button class="btn sm" data-act="cuEdit" data-id="${c.id}">Ficha</button></td></tr>`;}
reg('clientes','Clientes','users','customers',()=>{const q=cuF.q.toLowerCase();const L=S.customers.filter(c=>!q||custFull(c).toLowerCase().includes(q)||c.wa.includes(q.replace(/\D/g,'')||'zzz')||pad4(c.num)===q);
 const sub=S.customers.filter(hasComm).length;const deuda=S.customers.reduce((a,c)=>a+Math.max(0,debtOf(c.id)),0);
 return `<div class="row"><h1 class="sp">Clientes del Club RAVE</h1>${expBar('clientes')}<button class="btn" data-act="cuCamp">Campaña WhatsApp</button><button class="btn gold" data-act="cuEdit" data-id="">+ Cliente</button></div>
 <div class="grid g4"><div class="card kpi"><b>${S.customers.filter(c=>c.status!=='baja').length}</b><span>Socios activos</span></div><div class="card kpi"><b>${sub}</b><span>Aceptaron promociones (se les puede escribir)</span></div><div class="card kpi"><b>${S.members.filter(m=>m.status==='activa'&&m.to>now()).length}</b><span>Membresías vigentes</span></div><div class="card kpi"><b>${money(deuda)}</b><span>Deuda total en cuenta corriente</span></div></div>
 <div class="card" style="margin-top:1rem"><input id="cuq" placeholder="Buscar por nombre, WhatsApp o N.º de socio…" value="${esc(cuF.q)}" style="max-width:360px"><div class="tw"><table><thead><tr><th>N.º</th><th>Cliente</th><th>WhatsApp</th><th>Cumple</th><th>Origen · consentimiento</th><th>Sellos</th><th>Membresía</th><th class="r">Cta. cte.</th><th></th></tr></thead><tbody>${L.map(custRow).join('')||'<tr><td colspan="9" class="mut">Sin clientes.</td></tr>'}</tbody></table></div>
 <p class="sm mut">Datos personales (Ley 25.326 [VERIFICAR]): sin consentimiento de promociones el cliente queda excluido de campañas. La baja anonimiza los datos y conserva el historial contable.</p></div>`;},
 ()=>{const i=$('#cuq');if(i)i.addEventListener('input',e=>{cuF.q=e.target.value;const p=e.target.selectionStart;rerender();const n=$('#cuq');n.focus();n.setSelectionRange(p,p);});});
A.cuEdit=el=>{const c=el.dataset.id?custById(el.dataset.id):null;const isAdm=can('config');
 const w=modal(c?'Ficha de '+custFull(c):'Nuevo cliente',`<div class="grid g2"><div><label for="cu-n">Nombre</label><input id="cu-n" maxlength="40" value="${esc(c?c.name:'')}"></div><div><label for="cu-l">Apellido</label><input id="cu-l" maxlength="40" value="${esc(c?c.last:'')}"></div></div>
 <div class="grid g2"><div><label for="cu-w">WhatsApp (con código de área)</label><input id="cu-w" inputmode="tel" placeholder="387 1234567" value="${esc(c?c.wa.replace(/^\+549/,''):'')}"></div><div><label for="cu-b">Fecha de nacimiento</label><input id="cu-b" type="date" value="${esc(c?c.birth:'')}"></div></div>
 <label class="chk"><input type="checkbox" id="cu-c1" ${c?(c.consent.club?'checked':''):'checked'}> Participa del Club RAVE (tratamiento de datos)</label><label class="chk"><input type="checkbox" id="cu-c2" ${c&&c.consent.comm?'checked':''}> Aceptó recibir promociones por WhatsApp</label>
 ${c?`<div class="card" style="margin:.6rem 0"><div class="row"><b class="sp">Cuenta corriente</b><span>Debe ${money(debtOf(c.id))}</span></div>${ccLedgerHTML(c.id)}<label for="cu-lim">Límite de crédito ($) — sólo administración</label>${numIn('cu-lim',c.limit||0,'0',can('config')||can('void')?'':'disabled')}<div class="row" style="margin-top:.5rem"><button class="btn sm" data-act="cuPay" data-id="${c.id}">Registrar cobro de deuda</button><button class="btn sm" data-act="cuMember" data-id="${c.id}">Membresía</button><button class="btn sm" data-act="cuRedeem" data-id="${c.id}">Canjear premio (${Math.min(stampsOf(c.id),S.loyalty.goal)}/${S.loyalty.goal})</button></div></div>
 <label for="cu-nt">Notas internas</label><input id="cu-nt" maxlength="120" value="${esc(c.notes||'')}"><div class="row" style="margin-top:.6rem">${c.status!=='baja'?`<button class="btn sm red" data-act="cuBaja" data-id="${c.id}">Dar de baja (derecho de supresión)</button>`:''}</div>`:''}`,
 {wide:true,okText:'Guardar',onOk:w=>{const nm=val('cu-n').trim(),ls=val('cu-l').trim();if(nm.length<2||ls.length<2)return w._err('Nombre y apellido son obligatorios.'),false;
  const wa=normWA(val('cu-w'));if(!wa)return w._err('WhatsApp inválido.'),false;const b=parseBirthISO(val('cu-b'));if(!b)return w._err('Fecha de nacimiento inválida (año de 4 cifras).'),false;if(ageOf(b)<18)return w._err('El Club es sólo para mayores de 18 años.'),false;
  if(!$('#cu-c1',w).checked)return w._err('Hace falta el consentimiento de participación en el Club.'),false;
  const dup=S.customers.find(x=>normWA(x.wa)===wa&&(!c||x.id!==c.id));if(dup)return w._err('Ya existe un cliente con ese WhatsApp.'),false;
  if(c){c.name=nm;c.last=ls;c.wa=waFull(wa);c.birth=val('cu-b');if(c.consent.comm!==$('#cu-c2',w).checked){c.consent.comm=$('#cu-c2',w).checked;c.consent.ts=now();audit('CONSENTIMIENTO',custFull(c)+' promos '+(c.consent.comm?'sí':'no'));}
   if($('#cu-lim',w)&&!$('#cu-lim',w).disabled){const lim=cents(val('cu-lim')===''?'0':val('cu-lim'));if(isNaN(lim)||lim<0)return w._err('Límite inválido.'),false;if(lim!==(c.limit||0))audit('LIMITE_CREDITO',custFull(c)+' '+money(c.limit||0)+' → '+money(lim));c.limit=lim;}
   c.notes=($('#cu-nt',w)?val('cu-nt'):c.notes||'').trim();audit('EDITAR_CLIENTE',custFull(c));}
  else{const n=custCreate({name:nm,last:ls,birth:val('cu-b'),wa:val('cu-w'),comm:$('#cu-c2',w).checked},'mostrador');audit('ALTA_CLIENTE','mostrador · socio '+pad4(n.num));}
  save();pubRefresh();rerender();toast('Cliente guardado');}});};
A.cuBaja=el=>{const c=custById(el.dataset.id);if(!c)return;confirmBox('Baja del cliente','Se anonimizan nombre, WhatsApp y cumpleaños. Las ventas y la cuenta corriente históricas se conservan. '+(debtOf(c.id)>0?'<b>Ojo: tiene deuda de '+money(debtOf(c.id))+'.</b>':''),()=>{
 const n=pad4(c.num);c.status='baja';c.name='Socio';c.last='N.º '+n;c.wa='';c.birth='';c.consent={club:false,comm:false,analytics:false,version:c.consent.version,ts:now()};c.secret=uid();audit('BAJA_CLIENTE','socio '+n);save();pubRefresh();$$('#modal-root .ov').forEach(o=>o.remove());rerender();toast('Cliente dado de baja');},'Dar de baja');};
A.cuPay=el=>{const c=custById(el.dataset.id);if(!c)return;if(!openSess()&&true)toast('Sin caja abierta sólo se registra el cobro no efectivo.');
 modal('Cobro de cuenta corriente · '+custFull(c),`<p>Deuda: <b>${money(debtOf(c.id))}</b></p><label for="fp-a">Importe ($)</label>${numIn('fp-a',0,'0')}<label for="fp-m">Medio</label><select id="fp-m"><option value="efectivo">Efectivo (entra a la caja)</option><option value="transferencia">Transferencia</option><option value="debito">Débito</option><option value="qr">QR</option></select><p class="sm mut">Se clasifica en el rubro "Cobranza de cuenta corriente" (rubro obligatorio en todo movimiento).</p>`,
 {onOk:w=>{const e=fiadoPay(c.id,cents(val('fp-a')),val('fp-m'));if(e)return w._err(e),false;toast('Cobro registrado');$$('#modal-root .ov').forEach(o=>o!==w&&o.remove());rerender();}});};
A.cuMember=el=>{const c=custById(el.dataset.id);if(!c)return;const mb=memberActive(c);
 modal('Membresía · '+custFull(c),`${mb?`<div class="okbox">Vigente: <b>${esc(mb.name)}</b> hasta ${esc(mb.until)} (${mb.pct} % de descuento)</div>`:'<p class="mut">Sin membresía vigente.</p>'}
 <label for="mb-p">Plan</label><select id="mb-p">${S.plans.filter(p=>p.active).map(p=>`<option value="${p.id}">${esc(p.name)} · ${money(p.price)} / ${esc(p.period)}</option>`).join('')}</select>
 <label for="mb-m">Medio de pago</label><select id="mb-m"><option value="efectivo">Efectivo (entra a la caja)</option><option value="transferencia">Transferencia</option><option value="debito">Débito</option><option value="credito">Crédito</option><option value="qr">QR</option></select>
 <label class="chk"><input type="checkbox" id="mb-t"> El cliente aceptó los términos de la membresía (precio, renovación y cancelación)</label><p class="sm mut">El importe se registra como ingreso en el rubro "Cobranza de cuenta corriente / otros cobros". Vigencia: 30 días (mensual) desde hoy. Sin renovación automática.</p>`,
 {okText:'Activar',onOk:w=>{const p=S.plans.find(x=>x.id===val('mb-p'));if(!p)return w._err('Elegí un plan.'),false;if(!$('#mb-t',w).checked)return w._err('Hace falta que el cliente acepte los términos.'),false;
  if(val('mb-m')==='efectivo'){const e=addMov('ingreso','cobr','Membresía '+p.name+' · '+custFull(c),p.price);if(e)return w._err(e),false;}
  S.members.push({id:uid(),cust:c.id,plan:p.id,from:now(),to:now()+30*86400000,status:'activa',method:val('mb-m'),price:p.price,terms:IS_CLIENT?'v1-2026':'v1-2026-demo'});audit('MEMBRESIA',custFull(c)+' · '+p.name+' · '+money(p.price)+' · '+MET[val('mb-m')]);save();pubRefresh();$$('#modal-root .ov').forEach(o=>o!==w&&o.remove());rerender();toast('Membresía activada');}});};
A.cuRedeem=el=>{const e=redeemReward(el.dataset.id);if(e)return toast(e,1);toast('Premio canjeado: '+S.loyalty.reward);pubRefresh();$$('#modal-root .ov').forEach(o=>o.remove());rerender();};
A.cuCamp=()=>{const L=S.customers.filter(hasComm);
 modal('Campaña por WhatsApp (envío manual)',`<p class="sm mut">Se abre WhatsApp con el mensaje armado y una persona lo envía (no es envío automático). Sólo figuran clientes que aceptaron promociones.</p><label for="cm-t">Mensaje</label><textarea id="cm-t" rows="3">Hola {nombre}! Esta semana en RAVE: usá el cupón BIENVENIDA10 en tu pedido. Para dejar de recibir mensajes respondé BAJA.</textarea>
 <div class="tw"><table><tbody>${L.map(c=>`<tr><td>${esc(custFull(c))}</td><td>${esc(c.wa)}</td><td class="r"><button class="btn sm" data-act="cuWa" data-id="${c.id}">Abrir WhatsApp</button></td></tr>`).join('')||'<tr><td class="mut">Nadie aceptó promociones todavía.</td></tr>'}</tbody></table></div>`,{ok:false,cancelText:'Cerrar',wide:true});};
A.cuWa=el=>{const c=custById(el.dataset.id);if(!c||!hasComm(c))return toast('Sin consentimiento de promociones.',1);const t=val('cm-t').replace('{nombre}',c.name);audit('CAMPANIA_WA','abrir chat con socio '+pad4(c.num));openExternal(waLink(t,c.wa.replace(/\D/g,'')));};
EXPORTS.clientes={t:'Clientes del Club (datos personales)',perm:'impex',h:()=>['socio','nombre','apellido','nacimiento','whatsapp','origen','consent_club','consent_promos','sellos','limite_credito','deuda','alta'],rows:()=>S.customers.map(c=>[pad4(c.num),c.name,c.last,c.birth,c.wa,c.origin,c.consent.club?'si':'no',c.consent.comm?'si':'no',Math.min(stampsOf(c.id),S.loyalty.goal),(c.limit||0)/100,debtOf(c.id)/100,fmtDT(c.ts)])};

/* ================= PANTALLA: FIDELIZACIÓN (sellos) ================= */
/* ---------- tarjeta modelo (frente y dorso, tamaño tarjeta 85,6 × 54 mm) ---------- */
function cardModelHTML(filled,sample){const g=Math.max(1,Math.min(20,S.loyalty.goal|0||10));const f=Math.max(0,Math.min(g,filled|0));const T=S.tenant;
 const cols=g<=10?5:Math.ceil(g/2);
 const dots=Array.from({length:g},(_,i)=>`<i style="width:20px;height:20px;border-radius:50%;box-sizing:border-box;display:inline-block;border:1.5px ${i<f?'solid #c9963e;background:#c9963e':'dashed #8f7a4a;background:transparent'}"></i>`).join('');
 const url=/^https?:/.test(location.protocol)?location.href.split('#')[0]:PUBLIC_URL();
 const front=`<div class="cm-card" style="width:342px;height:216px;border-radius:14px;background:linear-gradient(135deg,#2b2927,#171513);color:#fff;padding:14px 16px;box-sizing:border-box;font-family:Poppins,Arial,sans-serif;position:relative;overflow:hidden;border:1px solid #c9963e">
  <div style="display:flex;align-items:center;gap:10px"><img src="${LOGO_MENU}" alt="" style="height:38px;width:68px;object-fit:cover;border-radius:6px"><div><div style="font:700 14px Georgia,serif;letter-spacing:.06em">CLUB ${esc(String(T.name).toUpperCase())}</div><div style="font-size:9px;color:#c9963e;letter-spacing:.12em">TARJETA DE SELLOS</div></div></div>
  <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:7px 6px;justify-items:center;margin:14px 6px 8px">${dots}</div>
  <div style="font-size:10px;text-align:center;color:#e9dfc7">${esc(S.loyalty.goal)} sellos = ${esc(S.loyalty.reward.replace(/\s*—\s*ejemplo$/i,''))}</div>
  <div style="position:absolute;left:16px;right:16px;bottom:9px;display:flex;justify-content:space-between;font-size:9px;color:#b9ad92"><span>Socio N.º ${sample?'0000':'________'}</span><span>${esc(T.address||'')}</span></div>${sample?'<div style="position:absolute;top:8px;right:10px;font-size:8px;color:#c9963e;border:1px solid #c9963e;border-radius:4px;padding:1px 5px">MODELO DE EJEMPLO</div>':''}</div>`;
 const back=`<div class="cm-card" style="width:342px;height:216px;border-radius:14px;background:#faf6ec;color:#242220;padding:14px 16px;box-sizing:border-box;font-family:Poppins,Arial,sans-serif;border:1px solid #c9963e;display:flex;gap:14px;align-items:center">
  <div style="width:112px;height:112px;flex:none">${QR.svg(url,4,2)}</div>
  <div style="font-size:10px;line-height:1.45"><b style="font:700 13px Georgia,serif">Sumá un sello en cada compra</b><br>Escaneá el QR, sumate al Club y mostrá tu código en el mostrador.<br><span style="color:#6b6256">1 sello por día · el código cambia cada 2 minutos.</span><br><br>📍 ${esc(T.address||'')}<br>💬 WhatsApp ${esc(T.phone||'')}<br>📷 @${esc(T.ig?String(T.ig).toLowerCase():'')}<br><span style="color:#8a7f6c;font-size:8px">Beneficios sujetos a bases y condiciones del Club. Desarrollado por VINCULAR BUSINESS · (387) 4484132.</span></div></div>`;
 return{front,back};}
A.cmPrint=el=>{const n=el.dataset.mode==='blank'?0:(+($('#cm-n')||{}).value||0);const c=cardModelHTML(n,el.dataset.mode!=='blank');
 const html=`<!doctype html><meta charset="utf-8"><title>Tarjeta modelo</title><style>@page{size:A4;margin:12mm}body{margin:0;font-family:Arial,sans-serif;background:#fff}h2{font-size:12px;margin:0 0 6px}.cm-card{transform:scale(1);margin-bottom:10px}.cut{margin-bottom:14px}</style><div class="cut"><h2>Frente (85,6 × 54 mm, cortar)</h2>${c.front}</div><div class="cut"><h2>Dorso</h2>${c.back}</div>`;
 const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);f.contentDocument.open();f.contentDocument.write(html);f.contentDocument.close();
 audit('TARJETA_MODELO_IMPRIMIR',el.dataset.mode);setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){}setTimeout(()=>f.remove(),4000);},300);};
function cmRefresh(){const n=+($('#cm-n')||{}).value||0;const c=cardModelHTML(n,true);const a=$('#cm-front'),b=$('#cm-back');if(a)a.innerHTML=c.front;if(b)b.innerHTML=c.back;}
reg('fidel','Fidelización','check','customers',()=>{const L=S.loyalty;const led=L.ledger.slice().reverse().slice(0,40);const goal=L.goal;
 const soc=S.customers.filter(c=>c.status!=='baja');const pend=soc.filter(c=>stampsOf(c.id)>=goal);const canj=L.ledger.filter(e=>e.kind==='redeem').length;
 return `<div class="row"><h1 class="sp">Fidelización · tarjeta de sellos</h1></div>
 <div class="grid g2"><div class="card"><h3>Validar sello del cliente</h3><p class="sm mut">El cliente muestra su tarjeta del menú: un código de 8 números (socio + código) o un QR que cambia cada 2 minutos. Pasá el lector o escribilo. Un sello por socio cada 24 h; cada código sirve una sola vez.</p>
  <div class="row"><input id="fd-c" class="sp" inputmode="text" placeholder="Ej.: 0007 4821 o lector de QR" autocomplete="off" aria-label="Código de sello"><button class="btn gold" data-act="fdOk">Sumar sello</button></div><div id="fd-r"></div></div>
 <div class="card"><h3>Reglas del club</h3><div class="grid g2"><div><label for="fd-g">Sellos para el premio</label><input id="fd-g" inputmode="numeric" value="${goal}"></div><div><label for="fd-w">Premio</label><input id="fd-w" maxlength="100" value="${esc(L.reward)}"></div></div><button class="btn" data-act="fdSave" style="margin-top:.6rem">Guardar reglas</button><p class="sm mut">Los sellos son un libro mayor: no se editan, se corrigen con un movimiento compensatorio. El alta al club no regala sellos.</p></div></div>
 <div class="card" style="margin:1rem 0"><div class="row"><h3 class="sp">Tarjeta modelo del negocio</h3><label for="cm-n" class="sm mut" style="margin:0">Sellos de ejemplo</label><select id="cm-n" style="max-width:90px" aria-label="Sellos de ejemplo">${Array.from({length:S.loyalty.goal+1},(_,i)=>`<option value="${i}" ${i===Math.min(6,S.loyalty.goal)?'selected':''}>${i}</option>`).join('')}</select><button class="btn sm" data-act="cmPrint" data-mode="sample">Imprimir con ejemplo</button><button class="btn sm gold" data-act="cmPrint" data-mode="blank">Imprimir en blanco</button></div>
 <div class="row" style="align-items:flex-start;gap:1rem;margin-top:.6rem"><div id="cm-front" aria-label="Frente de la tarjeta" style="max-width:100%;overflow-x:auto"></div><div id="cm-back" aria-label="Dorso de la tarjeta" style="max-width:100%;overflow-x:auto"></div></div><p class="sm mut">Modelo de ejemplo con los datos del negocio: los sellos se cargan en el mostrador con el código del cliente; el premio y la cantidad salen de las reglas de arriba. El QR del dorso lleva al menú, donde cada socio ve su tarjeta digital.</p></div>
 <div class="grid g4" style="margin:1rem 0"><div class="card kpi"><b>${soc.length}</b><span>Socios</span></div><div class="card kpi"><b>${L.ledger.filter(e=>e.kind==='stamp').length}</b><span>Sellos entregados</span></div><div class="card kpi"><b>${pend.length}</b><span>Con premio para canjear</span></div><div class="card kpi"><b>${canj}</b><span>Premios canjeados</span></div></div>
 ${pend.length?`<div class="card"><h3>Premios para entregar</h3>${pend.map(c=>`<div class="row" style="padding:.3rem 0"><span class="sp">${esc(custFull(c))} · socio ${pad4(c.num)}</span><button class="btn sm gold" data-act="cuRedeem" data-id="${c.id}">Entregar premio</button></div>`).join('')}</div>`:''}
 <div class="card" style="margin-top:1rem"><h3>Últimos movimientos</h3><div class="tw"><table><thead><tr><th>Fecha</th><th>Socio</th><th>Movimiento</th><th class="r">Sellos</th><th>Detalle</th><th>Usuario</th></tr></thead><tbody>${led.map(e=>{const c=custById(e.cust);return `<tr><td>${fmtDT(e.ts)}</td><td>${esc(custFull(c))}</td><td>${e.kind==='stamp'?'Sello':e.kind==='redeem'?'Canje':'Ajuste'}</td><td class="r">${e.n>0?'+':''}${e.n}</td><td class="sm">${esc(e.ref)}</td><td>${esc(e.user)}</td></tr>`;}).join('')||'<tr><td colspan="6" class="mut">Sin movimientos todavía.</td></tr>'}</tbody></table></div></div>`;},
 ()=>{const i=$('#fd-c');if(i)i.addEventListener('keydown',e=>{if(e.key==='Enter')A.fdOk();});const n=$('#cm-n');if(n)n.addEventListener('change',cmRefresh);cmRefresh();},'Clientes');
A.fdOk=()=>{const code=val('fd-c');const r=verifyStampCode(code,'');const box=$('#fd-r');if(!r.ok){box.innerHTML=`<div class="errbox">${esc(r.msg)}</div>`;return;}
 commitStamp(r.cust.id,r,'mostrador');pubRefresh();box.innerHTML=`<div class="okbox">⭐ Sello sumado a <b>${esc(r.custName)}</b>: ${r.stamps}/${S.loyalty.goal}${r.reward?' · <b>¡premio disponible!</b>':''}</div>`;$('#fd-c').value='';setTimeout(()=>{if(curScreen==='fidel')rerender();},1600);};
A.fdSave=()=>{const g=parseNum(val('fd-g'));if(!(g>=2&&g<=30&&Number.isInteger(g)))return toast('Los sellos para el premio van de 2 a 30.',1);if(val('fd-w').trim().length<3)return toast('Escribí el premio.',1);
 S.loyalty.goal=g;S.loyalty.reward=val('fd-w').trim();audit('CONFIG_FIDELIZACION',g+' sellos · '+S.loyalty.reward);save();pubRefresh();toast('Reglas guardadas');rerender();};

/* ================= PANTALLA: CUPONES Y MEMBRESÍAS ================= */
reg('cupones','Cupones y membresías','file','customers',()=>{
 return `<div class="row"><h1 class="sp">Cupones y membresías</h1><button class="btn gold" data-act="cpEdit" data-id="">+ Cupón</button><button class="btn" data-act="plEdit" data-id="">+ Membresía</button></div>
 <div class="warnbox sm">Regla del sistema: en cada compra se aplica <b>un solo beneficio</b> (el mayor entre cupón y membresía; no se acumulan) y el <b>tabaco queda excluido</b> de descuentos y promociones [VERIFICAR Ley 26.687]. Todo se recalcula al cobrar.</div>
 <div class="card"><h3>Cupones</h3><div class="tw"><table><thead><tr><th>Código</th><th>Beneficio</th><th>Para</th><th>Vigencia</th><th>Usos</th><th>Estado</th><th></th></tr></thead><tbody>${S.coupons.map(c=>`<tr><td><b>${esc(c.code)}</b></td><td>${esc(cpDesc(c))}${c.min?'<br><span class="sm mut">mínimo '+money(c.min)+'</span>':''}</td><td>${{todos:'Todos',club:'Socios del Club',cumple:'Cumpleañeros'}[c.aud]}${c.public===false?' · <span class="tag">privado</span>':''}</td><td class="sm">${c.from?dmy(c.from):'—'} a ${c.to?dmy(c.to):'—'}</td><td>${c.uses.length}${c.maxUses?' / '+c.maxUses:''}</td><td>${c.active?'<span class="tag ok">activo</span>':'<span class="tag">pausado</span>'}</td><td class="r"><button class="btn sm" data-act="cpEdit" data-id="${c.id}">Editar</button></td></tr>`).join('')||'<tr><td colspan="7" class="mut">Sin cupones.</td></tr>'}</tbody></table></div></div>
 <div class="card" style="margin-top:1rem"><h3>Membresías (planes)</h3><div class="tw"><table><thead><tr><th>Plan</th><th class="r">Precio</th><th>Beneficio</th><th>Socios vigentes</th><th></th></tr></thead><tbody>${S.plans.map(p=>`<tr><td><b>${esc(p.name)}</b> ${p.active?'':'<span class="tag">pausado</span>'}</td><td class="r">${money(p.price)} / ${esc(p.period)}</td><td>${p.pct} % de descuento · ${esc(p.desc)}</td><td>${S.members.filter(m=>m.plan===p.id&&m.status==='activa'&&m.to>now()).length}</td><td class="r"><button class="btn sm" data-act="plEdit" data-id="${p.id}">Editar</button></td></tr>`).join('')}</tbody></table></div><p class="sm mut">Se activan desde la ficha del cliente (Clientes → Ficha → Membresía). Sin renovación automática${IS_CLIENT?'':' en esta demo'}; el cobro recurrente con Mercado Pago es una integración aparte [VERIFICAR].</p></div>`;},null,'Clientes');
A.cpEdit=el=>{const c=el.dataset.id?S.coupons.find(x=>x.id===el.dataset.id):null;
 modal(c?'Editar cupón':'Nuevo cupón',`<div class="grid g2"><div><label for="cp-c">Código</label><input id="cp-c" maxlength="24" value="${esc(c?c.code:'')}" placeholder="BIENVENIDA10" style="text-transform:uppercase"></div><div><label for="cp-t">Tipo</label><select id="cp-t"><option value="pct" ${c&&c.type==='pct'?'selected':''}>Porcentaje (%)</option><option value="fixed" ${c&&c.type==='fixed'?'selected':''}>Monto fijo ($)</option></select></div></div>
 <div class="grid g2"><div><label for="cp-v">Valor (10 = 10 % o $ 10)</label><input id="cp-v" inputmode="decimal" placeholder="10" value="${c?esc(c.type==='pct'?String(c.value):pesosStr(c.value)):''}" autocomplete="off"></div><div><label for="cp-m">Compra mínima ($)</label>${numIn('cp-m',c?c.min:0,'0')}</div></div>
 <div class="grid g2"><div><label for="cp-f">Desde</label><input id="cp-f" type="date" value="${esc(c?c.from:'')}"></div><div><label for="cp-to">Hasta</label><input id="cp-to" type="date" value="${esc(c?c.to:'')}"></div></div>
 <div class="grid g3"><div><label for="cp-mu">Usos totales (vacío = sin límite)</label><input id="cp-mu" inputmode="numeric" value="${c&&c.maxUses?c.maxUses:''}"></div><div><label for="cp-pc">Usos por cliente (vacío = sin límite)</label><input id="cp-pc" inputmode="numeric" value="${c&&c.perCust?c.perCust:''}"></div><div><label for="cp-a">Para</label><select id="cp-a">${[['todos','Todos'],['club','Socios del Club'],['cumple','Cumpleañeros (±3 días)']].map(([k,v])=>`<option value="${k}" ${c&&c.aud===k?'selected':''}>${v}</option>`).join('')}</select></div></div>
 <label for="cp-n">Texto para mostrar al cliente</label><input id="cp-n" maxlength="90" value="${esc(c?c.note:'')}"><label class="chk"><input type="checkbox" id="cp-pu" ${!c||c.public!==false?'checked':''}> Mostrar en el menú público (si no, es un código privado)</label><label class="chk"><input type="checkbox" id="cp-ac" ${!c||c.active?'checked':''}> Activo</label>`,
 {okText:'Guardar',onOk:w=>{const code=val('cp-c').trim().toUpperCase();if(!/^[A-Z0-9]{3,24}$/.test(code))return w._err('El código: 3 a 24 letras o números, sin espacios.'),false;
  if(S.coupons.some(x=>x.code===code&&(!c||x.id!==c.id)))return w._err('Ya existe un cupón con ese código.'),false;const type=val('cp-t');const vv=parseNum(val('cp-v'));
  if(isNaN(vv)||vv<=0)return w._err('Ingresá el valor del beneficio.'),false;if(type==='pct'&&vv>90)return w._err('El porcentaje máximo es 90 (100 % requiere una excepción autorizada).'),false;
  const min=cents(val('cp-m')===''?'0':val('cp-m'));if(isNaN(min)||min<0)return w._err('Compra mínima inválida.'),false;if(val('cp-f')&&val('cp-to')&&val('cp-to')<val('cp-f'))return w._err('"Hasta" no puede ser anterior a "Desde".'),false;
  const d={code,type,value:type==='pct'?vv:Math.round(vv*100),min,from:val('cp-f'),to:val('cp-to'),maxUses:Math.max(0,Math.floor(parseNum(val('cp-mu')||'0'))||0),perCust:Math.max(0,Math.floor(parseNum(val('cp-pc')||'0'))||0),aud:val('cp-a'),note:val('cp-n').trim(),public:$('#cp-pu',w).checked,active:$('#cp-ac',w).checked};
  if(c){Object.assign(c,d);audit('EDITAR_CUPON',code);}else{S.coupons.push(Object.assign({id:uid(),uses:[]},d));audit('ALTA_CUPON',code);}save();pubRefresh();rerender();toast('Cupón guardado');}});};
A.plEdit=el=>{const p=el.dataset.id?S.plans.find(x=>x.id===el.dataset.id):null;
 modal(p?'Editar membresía':'Nueva membresía',`<label for="pl-n">Nombre</label><input id="pl-n" maxlength="40" value="${esc(p?p.name:'')}"><div class="grid g2"><div><label for="pl-p">Precio ($)</label>${numIn('pl-p',p?p.price:0,'0')}</div><div><label for="pl-d">Descuento (%)</label><input id="pl-d" inputmode="decimal" placeholder="5" value="${p?p.pct:''}" autocomplete="off"></div></div><label for="pl-x">Descripción</label><input id="pl-x" maxlength="100" value="${esc(p?p.desc:'')}"><label class="chk"><input type="checkbox" id="pl-a" ${!p||p.active?'checked':''}> Activo (visible en el menú)</label>`,
 {onOk:w=>{const n=val('pl-n').trim(),pr=cents(val('pl-p')),pc=parseNum(val('pl-d'));if(n.length<3)return w._err('Falta el nombre.'),false;if(isNaN(pr)||pr<0)return w._err('Precio inválido.'),false;if(isNaN(pc)||pc<0||pc>50)return w._err('El descuento va de 0 a 50 %.'),false;
  const d={name:n,price:pr,pct:pc,desc:val('pl-x').trim(),period:'mes',active:$('#pl-a',w).checked};if(p)Object.assign(p,d);else S.plans.push(Object.assign({id:uid()},d));audit('PLAN_MEMBRESIA',n);save();pubRefresh();rerender();}});};

/* ---------- ejemplos de la demo (datos ficticios, rotulados) ---------- */
function demoExtras(){const t0=Date.now()-20*86400000;const mk=(i,name,last,birth,w,comm)=>({id:'demo'+i,num:i,name,last,birth,wa:'+5493870000'+String(100+i),origin:'ejemplo',consent:{club:true,comm,analytics:false,version:'v1-2026-demo',ts:t0},ts:t0,status:'activo',limit:0,secret:'s'+i+'x',notes:''});
 S.customers=[mk(1,'María','Ejemplo','1990-05-21',1,true),mk(2,'Juan','Demostración','1985-11-02',2,true),mk(3,'Carla','De Prueba','1998-03-15',3,false)];
 S.customers[2].limit=5000000;
 const L=[];const add=(c,n)=>{for(let k=0;k<n;k++)L.push({id:uid(),cust:'demo'+c,ts:t0+k*86400000*1.5,kind:'stamp',n:1,ref:'ejemplo',user:'sistema'});};add(1,7);add(2,10);add(3,2);S.loyalty.ledger=L;
 S.members=[{id:'mdemo',cust:'demo2',plan:'pl1',from:Date.now()-5*86400000,to:Date.now()+25*86400000,status:'activa',method:'efectivo',price:300000,terms:'ejemplo'}];
 /* ventas históricas de ejemplo (para ver el resumen con datos; marcadas "demo", no tocan stock ni caja) */
 let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
 const pool=S.products.filter(p=>p.active&&p.unit==='u');S.sessions.push({id:'hist-demo',caja:S.tenant.caja,openedBy:'ADMIN',openedAt:Date.now()-12*86400000,opening:0,closedAt:Date.now()-86400000,demo:true});
 const metods=['efectivo','efectivo','efectivo','debito','credito','transferencia','qr'];
 for(let d=10;d>=1;d--){const nSales=5+Math.floor(rnd()*6);for(let k=0;k<nSales;k++){const nl=1+Math.floor(rnd()*3);const items=[];for(let j=0;j<nl;j++){const p=pool[Math.floor(rnd()*pool.length)];if(items.some(i=>i.pid===p.id))continue;items.push({pid:p.id,name:p.name+(p.sub?' ('+p.sub+')':''),rubro:p.rubro,qty:1+Math.floor(rnd()*2),price:p.price,cost:p.cost,list:p.price,disc:0});}
  const total=items.reduce((a,i)=>a+Math.round(i.qty*i.price),0);S.seq[S.tenant.caja]=(S.seq[S.tenant.caja]||0)+1;const ts=Date.now()-d*86400000-Math.floor(rnd()*8*3600000)+3600000*(-3);
  let cpn='',cpc='';if(k%6===2){const it0=items.find(i=>{const r=S.rubros.find(x=>x.id===i.rubro);return r&&!r.age;});if(it0){it0.disc=Math.round(it0.qty*it0.price*0.10);cpn='BIENVENIDA10';cpc='cp1';}}
  const total2=total-items.reduce((a,i)=>a+(i.disc||0),0);
  S.sales.push({id:'hs'+d+'_'+k,n:S.tenant.caja+'-'+S.seq[S.tenant.caja],ts,user:'Mostrador',caja:S.tenant.caja,sessId:'hist-demo',items,total:total2,method:metods[Math.floor(rnd()*metods.length)],doc:'ticket_interno',status:'ok',fee:0,channel:'local',cust:'',custName:'',coupon:cpn,benefit:cpc?{kind:'coupon',couponId:cpc}:null,recv:0,fiado:false,demo:true});if(cpc){const cp=S.coupons.find(x=>x.id===cpc);if(cp)cp.uses.push({ts,sale:'hs'+d+'_'+k,cust:'',demo:true});}}}}
function pubRefresh(){try{const f=document.getElementById('pubframe');if(f&&f.contentWindow&&f.contentWindow.RAVE_PUB_REFRESH)f.contentWindow.RAVE_PUB_REFRESH();}catch(e){}}
