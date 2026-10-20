/* ===== V26.9 · 4.23.4 / 4.23.5 Detalle de los cobros digitales (transferencia, débito, crédito, QR/MODO) =====
   Bloque «Datos del comprobante» en el cobro, con validación en vivo. Se guarda versionado y sólo-agregar (S.payDetails → colección cdet).
   El servidor (migración 11) vuelve a validar todo. Estado SIEMPRE «declarado»: ningún dato cargado a mano acredita el cobro.
   Un número de tarjeta completo NUNCA se guarda ni se registra: sólo los últimos 4 dígitos. El titular ordenante viaja cifrado. */
const PD_MEDIOS=['transferencia','debito','credito','qr','modo'];
const PD_COBRO=['transferencia','debito','credito'];            /* se piden en el cobro */
const PD_QR=['qr','modo'];                                      /* se piden al confirmar (el ID de transacción no existe antes) */
const PD_RX={nro:/^[A-Za-z0-9]{6,40}$/,auth:/^[A-Za-z0-9]{4,12}$/,txid:/^[A-Za-z0-9]{4,60}$/,cupon:/^[A-Za-z0-9]{1,20}$/,last4:/^\d{4}$/};
/* campos por medio. nr = no relajable (el servidor siempre lo exige). def = obligatoriedad por defecto. */
const PD_F={
 transferencia:[
  {k:'ent',l:'Banco o entidad de origen',t:'text',min:2,max:60,def:'obligatorio'},
  {k:'dest',l:'Cuenta de destino (alias o CBU parcial)',t:'dest',min:2,max:60,def:'obligatorio'},
  {k:'nro',l:'N.º de comprobante / operación',t:'id',rx:'nro',nr:1,hint:'6 a 40 letras o números (sacamos espacios y guiones)'},
  {k:'fh',l:'Fecha y hora de la transferencia',t:'dt',def:'obligatorio'},
  {k:'ordName',l:'Titular ordenante',t:'text',min:3,max:80,def:'recomendado',pii:1},
  {k:'ordDoc',l:'CUIT / CUIL / DNI del ordenante',t:'doc',def:'recomendado',pii:1},
  {k:'imp',l:'Importe que dice el comprobante ($)',t:'money',def:'recomendado'}],
 debito:[
  {k:'brand',l:'Marca de la tarjeta',t:'brand',def:'obligatorio'},
  {k:'last4',l:'Últimos 4 dígitos',t:'num4',rx:'last4',nr:1,hint:'sólo 4 números: nunca el número completo'},
  {k:'auth',l:'Código de autorización',t:'id',rx:'auth',nr:1,hint:'4 a 12 letras o números'},
  {k:'cupon',l:'N.º de cupón / lote / terminal',t:'id',rx:'cupon',def:'obligatorio',hint:'1 a 20 letras o números'},
  {k:'fh',l:'Fecha y hora del cupón',t:'dt',def:'recomendado'}],
 credito:[
  {k:'brand',l:'Marca de la tarjeta',t:'brand',def:'obligatorio'},
  {k:'last4',l:'Últimos 4 dígitos',t:'num4',rx:'last4',nr:1,hint:'sólo 4 números: nunca el número completo'},
  {k:'auth',l:'Código de autorización',t:'id',rx:'auth',nr:1,hint:'4 a 12 letras o números'},
  {k:'cuotas',l:'Cuotas',t:'cuotas',nr:1,hint:'1 si es en un pago'},
  {k:'cupon',l:'N.º de cupón / lote / terminal',t:'id',rx:'cupon',def:'obligatorio',hint:'1 a 20 letras o números'},
  {k:'fh',l:'Fecha y hora del cupón',t:'dt',def:'recomendado'}],
 qr:[
  {k:'prov',l:'Proveedor del cobro',t:'prov',def:'obligatorio'},
  {k:'txid',l:'ID de transacción del proveedor',t:'id',rx:'txid',nr:1,hint:'4 a 60 letras o números'},
  {k:'fh',l:'Fecha y hora del cobro',t:'dt',def:'recomendado'}],
 modo:[
  {k:'prov',l:'Proveedor del cobro',t:'prov',def:'obligatorio'},
  {k:'txid',l:'ID de transacción del proveedor',t:'id',rx:'txid',nr:1,hint:'4 a 60 letras o números'},
  {k:'fh',l:'Fecha y hora del cobro',t:'dt',def:'recomendado'}]};
const PD_BRANDS=['Visa','Mastercard','Maestro','American Express','Naranja X','Cabal','Otra'];
const PD_PROVS=['Mercado Pago','MODO','Otro'];

/* ---------- configuración (sólo lectura; el servidor ignora cambios de quien no es administrador) ---------- */
function pdCfg(){const p=(S.cfg&&S.cfg.pay)||{};const d=p.detail||{};
 return{on:!!d.on,since:+d.since||0,fields:d.fields&&typeof d.fields==='object'?d.fields:{},maxAgeH:Math.max(0,Math.floor(+p.maxAgeH||0)),
  accounts:Array.isArray(p.accounts)?p.accounts.filter(x=>typeof x==='string'&&x.trim()).slice(0,30):[],
  brands:Array.isArray(p.brands)&&p.brands.length?p.brands:PD_BRANDS,provs:Array.isArray(p.provs)&&p.provs.length?p.provs:PD_PROVS};}
const pdOn=()=>pdCfg().on;
function pdReq(medio,f){if(f.nr)return'obligatorio';const c=pdCfg().fields[medio];const v=c&&c[f.k];return v==='obligatorio'||v==='recomendado'||v==='oculto'?v:(f.def||'obligatorio');}
const pdFields=medio=>(PD_F[medio]||[]).filter(f=>pdReq(medio,f)!=='oculto');

/* ---------- detector de número de tarjeta (idéntico al del servidor: rave_parece_pan) ---------- */
function pdLuhn(d){d=String(d).replace(/\D/g,'');if(d.length<13||d.length>19)return false;let s=0,alt=false;for(let i=d.length-1;i>=0;i--){let n=+d[i];if(alt){n*=2;if(n>9)n-=9;}s+=n;alt=!alt;}return s%10===0;}
function pdPan(txt){if(txt==null)return false;const re=/((?:\d[ -]?){13,19})/g;let m;const s=String(txt);
 while((m=re.exec(s))){const d=m[1].replace(/\D/g,'');if(d.length>=13&&d.length<=19&&'23456'.includes(d[0])&&pdLuhn(d))return true;}return false;}

/* ---------- registros guardados ---------- */
const pdAllRecs=()=>(S.payDetails=S.payDetails||[]);
const pdVers=(saleId,idx)=>pdAllRecs().filter(r=>r.sale===saleId&&r.idx===idx).sort((a,b)=>a.ver-b.ver);
const pdLatest=(saleId,idx)=>{const v=pdVers(saleId,idx);return v.length?v[v.length-1]:null;};
const pdKeyOf=r=>r.medio==='transferencia'?'transferencia|'+String(r.ent||'').trim().toLowerCase()+'|'+String(r.nro||'').toLowerCase():(r.medio==='qr'||r.medio==='modo')?'qr|'+String(r.prov||'').trim().toLowerCase()+'|'+String(r.txid||'').toLowerCase():'';
function pdDupFind(key,exSale,exIdx){if(!key)return null;
 for(const r of pdAllRecs()){if(r.sale===exSale&&r.idx===exIdx)continue;if(pdKeyOf(r)===key)return r;}return null;}
function pdParseDT(v){v=String(v||'').trim();if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v))return NaN;return Date.parse(typeof TZ!=='undefined'&&TZ==='America/Argentina/Salta'?v+':00-03:00':v);}
function pdDTval(ms){if(!ms)return'';const f=new Intl.DateTimeFormat('sv-SE',{timeZone:typeof TZ!=='undefined'?TZ:'America/Argentina/Salta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(ms);return f.replace(' ','T');}
const pdMaskDoc=d=>{d=String(d||'').replace(/\D/g,'');return d.length>=4?'***'+d.slice(-4):'';};

/* ---------- validación (pura): ent = {v:{campo:texto}, exc, dup} · amt en centavos ---------- */
function pdCheck(medio,ent,amt,ex){
 ent=ent||{};const v=ent.v||{};const cfg=pdCfg();const errs={},missing=[],fields={};
 const exc=ent.exc&&String(ent.exc.reason||'').trim().length>=5&&ent.exc.by?ent.exc:null;
 const relaxMiss=[];
 const raw=k=>String(v[k]==null?'':v[k]).trim();
 for(const f of pdFields(medio)){
  let x=raw(f.k);const req=pdReq(medio,f);
  if(f.t==='id')x=x.replace(/[\s.\-]/g,'');
  if(x===''){
   if(f.k==='cuotas'&&medio==='debito')continue;
   if(req==='obligatorio'){if(f.nr)missing.push(f.l);else relaxMiss.push(f.l);}
   continue;}
  if(pdPan(x)){errs[f.k]='Parece un número de tarjeta completo: no se guarda. Cargá sólo los últimos 4 dígitos.';continue;}
  if(f.t==='text'||f.t==='dest'||f.t==='brand'||f.t==='prov'){if(x.length<(f.min||2)||x.length>(f.max||60)){errs[f.k]='Entre '+(f.min||2)+' y '+(f.max||60)+' caracteres.';continue;}fields[f.k]=x;}
  else if(f.t==='id'||f.t==='num4'){if(!PD_RX[f.rx].test(x)){errs[f.k]=f.t==='num4'?'Son exactamente 4 números.':'Formato inválido: '+(f.hint||'letras y números');continue;}fields[f.k]=x;}
  else if(f.t==='cuotas'){const n=+x;if(!/^\d{1,2}$/.test(x)||n<1||n>60){errs[f.k]='Entero de 1 a 60.';continue;}fields[f.k]=n;}
  else if(f.t==='dt'){const ms=pdParseDT(x);if(isNaN(ms)){errs[f.k]='Fecha y hora inválidas.';continue;}
   if(ms>now()+300000){errs[f.k]='La fecha está en el futuro.';continue;}
   if(cfg.maxAgeH>0&&ms<now()-cfg.maxAgeH*3600000){errs[f.k]='El comprobante es más viejo que lo permitido ('+cfg.maxAgeH+' h).';continue;}fields[f.k]=ms;}
  else if(f.t==='doc'){const d=x.replace(/\D/g,'');if(!(/^\d{7,8}$/.test(d)||(d.length===11&&arcaCuitOk(d)))){errs[f.k]='DNI de 7 u 8 dígitos o CUIT/CUIL válido (11).';continue;}fields[f.k]=d;}
  else if(f.t==='money'){const c=cents(x);if(isNaN(c)||c<=0){errs[f.k]='Importe inválido.';continue;}fields[f.k]=c;}
 }
 if(medio==='debito')fields.cuotas=1;
 if(medio==='debito'||medio==='credito')fields.kind=medio;
 let pend=false;
 if(relaxMiss.length){if(exc)pend=true;else relaxMiss.forEach(l=>missing.push(l));}
 const out={errs,missing,fields,pend,exc:pend?exc:null,warn:[],key:'',dupOf:null,dupOk:true,medio};
 /* repetidos */
 const tmp=Object.assign({medio},fields);out.key=pdKeyOf(tmp);
 if(out.key&&!errs.nro&&!errs.txid&&!errs.ent&&!errs.prov){const d=pdDupFind(out.key,ex&&ex.sale,ex&&ex.idx);
  if(d){out.dupOf=d;const da=ent.dup;out.dupOk=!!(da&&da.key===out.key&&String(da.reason||'').trim().length>=5&&da.by);}}
 if(fields.imp&&amt&&fields.imp!==amt){out.impDiff=true;out.warn.push('El comprobante dice '+money(fields.imp)+' pero el cobro es de '+money(amt)+': queda marcado «importe distinto».');}
 out.ok=!Object.keys(errs).length&&!missing.length&&out.dupOk;
 return out;}

/* documento a guardar (versión ver de la venta/pago idx) */
function pdMakeDoc(sale,idx,ver,chk,ent,amt){
 const d={id:sale.id+'#'+idx+'#'+ver,sale:sale.id,idx,ver,medio:chk.medio,st:'declarado',ts:now(),user:user?user.name:'sistema',amt:amt||0};
 Object.keys(chk.fields).forEach(k=>{d[k]=chk.fields[k];});
 if(chk.fields.ordDoc)d.ordMask=pdMaskDoc(chk.fields.ordDoc);else if(chk.fields.ordName)d.ordMask=chk.fields.ordName[0]+'***';
 if(chk.pend){d.pend=true;d.exc={reason:String(chk.exc.reason).trim().slice(0,120),by:chk.exc.by,name:chk.exc.name||''};}
 if(chk.dupOf&&chk.dupOk&&ent.dup)d.dupAuth={reason:String(ent.dup.reason).trim().slice(0,120),by:ent.dup.by,name:ent.dup.name||''};
 if(chk.impDiff)d.impDiff=true;
 return d;}
function pdAuditNro(d){const x=d.nro||d.txid||d.auth||'';return x?'…'+String(x).slice(-4):'';}
function pdSave(sale,idx,ver,chk,ent,amt){
 const d=pdMakeDoc(sale,idx,ver,chk,ent,amt);pdAllRecs().push(d);
 audit(ver>1?'COBRO_DETALLE_VERSION':'COBRO_DETALLE',sale.n+' · '+(MET[d.medio]||d.medio)+' · v'+ver+' · '+pdAuditNro(d)+(d.last4?' · ****'+d.last4:'')+(d.pend?' · SIN COMPROBANTE completo (excepción: '+(d.exc.name||d.exc.by)+')':'')+(d.dupAuth?' · REPETIDO autorizado por '+(d.dupAuth.name||d.dupAuth.by):'')+(d.impDiff?' · importe distinto':''),{ent:'venta',eid:sale.id});
 if(d.pend)audit('COBRO_SIN_COMPROBANTE',sale.n+' · '+(MET[d.medio]||d.medio)+' · autoriza '+(d.exc.name||d.exc.by)+' · motivo: '+d.exc.reason);
 if(d.dupAuth)audit('COBRO_NRO_REPETIDO',sale.n+' · '+(MET[d.medio]||d.medio)+' · '+pdAuditNro(d)+' · autoriza '+(d.dupAuth.name||d.dupAuth.by)+' · motivo: '+d.dupAuth.reason);
 return d;}

/* ---------- ganchos de commitSale ---------- */
function pdPre(pays,opts){ /* antes de tocar stock/caja: ¿están los detalles que el comercio exige? */
 if(!pdOn()||(opts&&opts.pdSkip))return'';const det=(opts&&opts.det)||{};
 for(const p of pays){if(!PD_COBRO.includes(p.m))continue;const c=pdCheck(p.m,det[p.m],p.a,null);
  if(!c.ok)return'Falta el detalle del comprobante ('+(MET[p.m]||p.m)+'): '+(c.missing.concat(Object.values(c.errs)).join(' · ')||'ese N.º de operación ya se usó y falta la autorización de un supervisor');}
 return'';}
function pdCommitAll(sale,det){
 if(!pdOn()||!det)return;
 sale.pays.forEach((p,i)=>{if(!PD_COBRO.includes(p.m)||!det[p.m])return;const c=pdCheck(p.m,det[p.m],p.a,{sale:sale.id,idx:i});if(c.ok)pdSave(sale,i,1,c,det[p.m],p.a);});}
/* QR / MODO: se carga al confirmar (o corregir) desde el modal de cobro pendiente */
function pdCommitOne(sale,idx,ent){
 const p=salePays(sale)[idx];if(!p)return'Pago inexistente.';
 const c=pdCheck(p.m,ent,p.a,{sale:sale.id,idx});if(!c.ok)return c.missing.concat(Object.values(c.errs)).join(' · ')||'Falta autorizar el N.º repetido.';
 const last=pdLatest(sale.id,idx);const nd=pdMakeDoc(sale,idx,(last?last.ver:0)+1,c,ent,p.a);
 if(last){const same=['ent','dest','nro','fh','brand','last4','auth','cuotas','cupon','prov','txid','imp','pend'].every(k=>String(last[k]==null?'':last[k])===String(nd[k]==null?'':nd[k]))&&String(last.ordName||'')===String(nd.ordName||'');if(same)return'';}
 pdSave(sale,idx,(last?last.ver:0)+1,c,ent,p.a);return'';}

/* ---------- faltantes (cierre de caja, lista «Cobros a conciliar») ---------- */
function pdSaleMissing(s){ /* [{idx,medio,why}] sólo si el comercio lo exige y la venta es posterior a la activación */
 const cfg=pdCfg();if(!cfg.on||s.status!=='ok'||(cfg.since&&s.ts<cfg.since))return[];const out=[];
 salePays(s).forEach((p,i)=>{if(!PD_MEDIOS.includes(p.m))return;const r=pdLatest(s.id,i);if(!r)out.push({idx:i,medio:p.m,why:'sin detalle'});else if(r.pend)out.push({idx:i,medio:p.m,why:'comprobante incompleto (excepción)'});});
 return out;}
function pdMissingCount(sess){return S.sales.filter(s=>s.sessId===sess.id).reduce((a,s)=>a+pdSaleMissing(s).length,0);}
function pdMissingAll(){const o=[];S.sales.forEach(s=>pdSaleMissing(s).forEach(m=>o.push(Object.assign({s},m))));return o.sort((a,b)=>b.s.ts-a.s.ts);}

/* ---------- aprobación de un supervisor / administrador (excepción o N.º repetido) ---------- */
const pdFail={n:0,until:0};
async function pdApprovers(){
 if(typeof xfCloud==='function'&&xfCloud()){try{const rows=await sel('miembros?select=usuario_id,rol,nombre,email&comercio_id=eq.'+cl.comercio.id);return rows.filter(r=>r.rol==='admin'||r.rol==='supervisor').map(r=>({id:r.usuario_id,name:r.nombre||r.email,email:r.email}));}catch(e){return[];}}
 return S.users.filter(u=>u.role==='admin'||u.role==='supervisor').map(u=>({id:u.id,name:u.name}));}
async function pdAuthResolve(list,selId,secret){
 if(now()<pdFail.until)return{err:'Demasiados intentos. Esperá '+Math.ceil((pdFail.until-now())/1000)+' s.'};
 const a=list.find(x=>x.id===selId);if(!a)return{err:'Elegí quién autoriza.'};
 const cloud=typeof xfCloud==='function'&&xfCloud();
 if(!secret)return{err:'Falta la '+(cloud?'clave':'PIN')+'.'};
 let ok=false;
 if(cloud){if(!cl.online)return{err:'Sin conexión: la autorización necesita internet para verificar la clave.'};
  try{const j=await authCall('token?grant_type=password',{email:a.email,password:secret});ok=!!(j&&j.user&&j.user.id===a.id);}catch(e){ok=false;}}
 else ok=S.users.some(u=>u.id===a.id&&(u.role==='admin'||u.role==='supervisor')&&u.pin===secret);
 if(!ok){pdFail.n++;if(pdFail.n>=5){pdFail.until=now()+120000;pdFail.n=0;audit('COBRO_AUTORIZANTE_BLOQUEO','5 intentos fallidos: bloqueo de 2 minutos');}return{err:'Clave o PIN incorrecto.'};}
 pdFail.n=0;return{ok:1,id:a.id,name:a.name,method:cloud?'clave':'pin',self:a.id===(user&&user.id)};}
async function pdApproveModal(o){
 const list=await pdApprovers();const cloud=typeof xfCloud==='function'&&xfCloud();
 if(!list.length){toast('No hay un supervisor o administrador que pueda autorizar.',1);return;}
 modal(o.title,`<p>${esc(o.why)}</p><label for="pa-u">Quién autoriza (supervisor o administrador)</label><select id="pa-u">${list.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}${user&&a.id===user.id?' (yo)':''}</option>`).join('')}</select>
 <label for="pa-s">${cloud?'Clave de esa persona':'PIN de esa persona'}</label><input id="pa-s" type="password" autocomplete="off" ${cloud?'':'inputmode="numeric"'}>
 <label for="pa-r">Motivo (obligatorio, mínimo 5 letras)</label><input id="pa-r" maxlength="120" autocomplete="off">`,
 {okText:'Autorizar',onOk:async w=>{const r=val('pa-r').trim();if(r.length<5){w._err('Escribí el motivo (mínimo 5 letras).');return false;}
  const res=await pdAuthResolve(list,val('pa-u'),val('pa-s'));if(res.err){w._err(res.err);return false;}
  o.onDone({reason:r,by:res.id,name:res.name,method:res.method,self:res.self});}});}

/* ---------- pantalla: bloque «Datos del comprobante» ---------- */
let pdTmp={};                                   /* entradas de los modales «Confirmar cobro del QR» y «Completar detalle» */
const pdEnts=host=>host&&host.dataset.k==='cobro'?(pos.pdet=pos.pdet||{}):pdTmp;
function pdCobroMedios(){if(!pdOn())return[];
 if(pos.mix)return mixParsed().filter(p=>PD_COBRO.includes(p.m)).map(p=>({medio:p.m,amt:isNaN(p.a)?0:p.a,opt:!(p.a>0)}));
 return PD_COBRO.includes(pos.method)?[{medio:pos.method,amt:posTotal()}]:[];}
function pdHostMedios(host){const k=host.dataset.k;
 if(k==='cobro')return pdCobroMedios();
 const s=S.sales.find(x=>x.id===host.dataset.sale);if(!s)return[];const i=+host.dataset.idx;const p=salePays(s)[i];return p?[{medio:p.m,amt:p.a,idx:i,sale:s}]:[];}
function pdFieldHTML(medio,f,ent,ph){
 const id='pd-'+medio+'-'+f.k;const v=ent.v&&ent.v[f.k]!=null?ent.v[f.k]:'';const req=pdReq(medio,f);
 const lab=`<label for="${id}">${esc(f.l)}${req==='obligatorio'?' <span class="tag">obligatorio</span>':' <span class="sm mut">(recomendado)</span>'}</label>`;
 const at=`data-pd="${f.k}" data-pdm="${medio}" aria-describedby="${id}-e"`;
 let inp;const cfg=pdCfg();
 if(f.t==='brand'||f.t==='prov'){const L=f.t==='brand'?cfg.brands:cfg.provs;inp=`<select id="${id}" ${at}><option value="">— Elegí —</option>${L.map(x=>`<option ${x===v?'selected':''}>${esc(x)}</option>`).join('')}</select>`;}
 else if(f.t==='dt')inp=`<input id="${id}" type="datetime-local" ${at} value="${esc(v)}">`;
 else if(f.t==='money')inp=`<input id="${id}" inputmode="decimal" autocomplete="off" placeholder="0" ${at} value="${esc(v)}">`;
 else if(f.t==='num4'||f.t==='cuotas')inp=`<input id="${id}" inputmode="numeric" autocomplete="off" maxlength="${f.t==='num4'?30:2}" placeholder="${f.t==='num4'?'0000':'1'}" ${at} value="${esc(v)}">`;
 else if(f.t==='dest'&&cfg.accounts.length)inp=`<input id="${id}" list="${id}-l" maxlength="60" autocomplete="off" ${at} value="${esc(v)}"><datalist id="${id}-l">${cfg.accounts.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`;
 else inp=`<input id="${id}" maxlength="${f.t==='id'?70:(f.max||60)}" autocomplete="off" ${f.pii?'data-pii="1"':''} ${at} value="${esc(v)}">`;
 return `<div>${lab}${inp}${f.hint?`<div class="sm mut">${esc(f.hint)}</div>`:''}<div class="sm" style="color:var(--bad,#b3261e)" id="${id}-e" role="alert"></div></div>`;}
function pdBlockHTML(medio,ent,amt){
 const cfgNote=medio==='debito'||medio==='credito'?'Datos del cupón de la terminal. Nunca cargues el número de tarjeta completo.':medio==='transferencia'?'Datos del comprobante que muestra el cliente.':'Datos del cobro según la app del proveedor.';
 return `<div class="card pdblk" data-pdm="${medio}" style="margin:.6rem 0"><h3 style="margin-top:0">Datos del comprobante · ${esc(MET[medio])}</h3><p class="sm mut">${esc(cfgNote)} Queda como <b>declarado</b>: lo cargado a mano no acredita el cobro.</p>
 <div class="grid g2">${pdFields(medio).map(f=>pdFieldHTML(medio,f,ent)).join('')}</div><div class="pdst" id="pd-st-${medio}" aria-live="polite"></div></div>`;}
function pdHostHTML(o){o=o||{};const k=o.sale?(o.fix?'fix':'pay'):'cobro';
 if(k!=='cobro')pdTmp={};
 return `<div id="pd-host" data-k="${k}" data-sale="${esc(o.sale||'')}" data-idx="${o.idx||0}"></div>`;}
function pdRender(host){ /* dibuja los bloques una vez; después sólo se actualizan estados */
 if(!host)return;const E=pdEnts(host);const L=pdHostMedios(host);
 L.forEach(m=>{E[m.medio]=E[m.medio]||{v:{}};});
 host.innerHTML=L.map(m=>pdBlockHTML(m.medio,E[m.medio],m.amt)).join('');
 pdStatus(host);}
function pdSyncHost(host){if(!host)return;const E=pdEnts(host);
 host.querySelectorAll('[data-pd]').forEach(el=>{const m=el.dataset.pdm;E[m]=E[m]||{v:{}};E[m].v=E[m].v||{};E[m].v[el.dataset.pd]=el.value;});}
/* estado en vivo: errores por campo, resumen, botones de excepción / repetido y bloqueo del botón de cobro */
function pdStatus(host){
 if(!host)return true;const E=pdEnts(host);let all=true;
 for(const m of pdHostMedios(host)){
  const ent=E[m.medio]||(E[m.medio]={v:{}});const ex=m.sale?{sale:m.sale.id,idx:m.idx}:null;const c=pdCheck(m.medio,ent,m.amt,ex);
  if(!c.ok&&!m.opt)all=false;
  pdFields(m.medio).forEach(f=>{const e=host.querySelector('#pd-'+m.medio+'-'+f.k+'-e');if(e)e.textContent=c.errs[f.k]||'';});
  const st=host.querySelector('#pd-st-'+m.medio);if(!st)continue;let h='';
  if(c.missing.length)h+=`<div class="errbox sm"><b>Falta:</b> ${c.missing.map(esc).join(' · ')}</div>`;
  c.warn.forEach(w=>{h+=`<div class="warnbox sm">${esc(w)}</div>`;});
  if(c.dupOf){const sl=S.sales.find(x=>x.id===c.dupOf.sale);
   h+=c.dupOk?`<div class="warnbox sm">N.º repetido <b>autorizado</b> por ${esc(ent.dup.name||'')}: ${esc(ent.dup.reason)}</div>`
    :`<div class="errbox sm"><b>Ese N.º de operación ya se usó</b> en la venta ${esc(sl?sl.n:'?')}${sl?' ('+fmtDT(sl.ts)+')':''}. Sólo un supervisor o administrador puede autorizar que se repita, con motivo. <button type="button" class="btn sm" data-act="pdDup" data-pm="${m.medio}">Autorizar repetido (supervisor)</button></div>`;}
  const relaxLeft=pdFields(m.medio).some(f=>!f.nr&&pdReq(m.medio,f)==='obligatorio'&&(ent.v[f.k]==null||String(ent.v[f.k]).trim()===''));
  if(c.pend)h+=`<div class="warnbox sm"><b>Cobro con comprobante incompleto</b> autorizado por ${esc(ent.exc.name||'')}: ${esc(ent.exc.reason)} <button type="button" class="btn sm" data-act="pdExcRm" data-pm="${m.medio}">Quitar</button><br>Queda en «Cobros a conciliar» hasta completarlo.</div>`;
  else if(relaxLeft&&!ent.exc)h+=`<div class="sm" style="margin-top:.3rem"><button type="button" class="btn sm" data-act="pdExc" data-pm="${m.medio}">Cobrar sin todos los datos (supervisor)</button> <span class="mut">El N.º de operación / autorización / ID de transacción siempre es obligatorio.</span></div>`;
  if(c.ok&&!c.warn.length&&!c.pend&&!c.dupOf)h+='<div class="okbox sm" role="status">✔ Datos completos.</div>';
  if(st.dataset.h!==h){st.innerHTML=h;st.dataset.h=h;}}   /* no se reescribe si no cambió: así un clic en un botón no se pierde cuando el campo suelta el foco */
 const dlg=host.closest('.dlg');const ok=dlg&&dlg.querySelector('[data-m=ok]');
 if(ok){ok.disabled=!all;ok.title=all?'':'Completá los datos del comprobante para continuar';}
 return all;}
function pdRecheck(w){const h=w&&w.querySelector('#pd-host');if(h){pdSyncHost(h);pdStatus(h);}}
function pdRefresh(){const h=document.getElementById('pd-host');if(!h)return;pdSyncHost(h);pdRender(h);}
function pdHost(){return document.getElementById('pd-host');}
/* enlaza la escritura en vivo a un modal (lo llama A.cobrar, payModal y la pantalla de completar) */
function pdBind(w){if(!w.querySelector('#pd-host'))return;pdRender(w.querySelector('#pd-host'));
 const on=e=>{if(e.target.dataset&&e.target.dataset.pd){const h=w.querySelector('#pd-host');pdSyncHost(h);pdStatus(h);}};
 w.addEventListener('input',on);w.addEventListener('change',on);}
/* cobroRender reemplaza todo el modal: se vuelve a dibujar el bloque y se recalcula el botón */
function pdAfterRender(w){const h=w&&w.querySelector('#pd-host');if(h)pdRender(h);}
function pdCobroSync(w){const h=w&&w.querySelector('#pd-host');if(h)pdSyncHost(h);}
/* compuerta del cobro: devuelve {err} o {det} */
function pdGateCobro(){
 if(!pdOn())return{det:null};const E=pos.pdet||{};const L=pdCobroMedios();
 for(const m of L){if(m.opt)continue;const c=pdCheck(m.medio,E[m.medio],m.amt,null);
  if(!c.ok)return{err:'Completá los datos del comprobante ('+(MET[m.medio]||m.medio)+'): '+(c.missing.concat(Object.values(c.errs)).join(' · ')||'autorizá el N.º repetido')};}
 return{det:E};}
const pdReset=()=>{pos.pdet={};};

A.pdExc=el=>{const m=el.dataset.pm;
 pdApproveModal({title:'Cobrar sin todos los datos',why:'Un supervisor o administrador autoriza que este cobro se registre con el comprobante incompleto. Queda en «Cobros a conciliar» hasta que se complete.',
  onDone:a=>{const h=pdHost();if(!h)return;const E=pdEnts(h);E[m]=E[m]||{v:{}};E[m].exc=a;pdSyncHost(h);pdStatus(h);toast('Excepción autorizada por '+a.name);}});};
A.pdExcRm=el=>{const h=pdHost();if(!h)return;const E=pdEnts(h);if(E[el.dataset.pm])delete E[el.dataset.pm].exc;pdSyncHost(h);pdStatus(h);};
A.pdDup=el=>{const m=el.dataset.pm;const h=pdHost();if(!h)return;pdSyncHost(h);const E=pdEnts(h);const L=pdHostMedios(h).find(x=>x.medio===m);if(!L)return;
 const c=pdCheck(m,E[m],L.amt,L.sale?{sale:L.sale.id,idx:L.idx}:null);if(!c.dupOf)return;const key=c.key;
 pdApproveModal({title:'Autorizar N.º de operación repetido',why:'Ese N.º ya está cargado en otro cobro. Sólo se repite con la autorización de un supervisor o administrador y un motivo.',
  onDone:a=>{const hh=pdHost();if(!hh)return;const EE=pdEnts(hh);EE[m]=EE[m]||{v:{}};EE[m].dup=Object.assign({key},a);pdSyncHost(hh);pdStatus(hh);toast('Repetido autorizado por '+a.name);}});};

/* ---------- QR / MODO: el detalle se pide al confirmar el pago ---------- */
function pdPayBlock(s){if(!pdOn()||!PD_QR.includes(s.method))return'';
 const idx=salePays(s).findIndex(p=>p.m===s.method);if(idx<0)return'';
 return `<p class="sm">Para confirmar el pago cargá el ID de transacción de ${esc(MET[s.method])}. «Dejar pendiente» no lo pide.</p>${pdHostHTML({sale:s.id,idx})}`;}
function pdPayCommit(s){ /* devuelve un mensaje de error o '' */
 if(!pdOn()||!PD_QR.includes(s.method))return'';const h=pdHost();if(!h)return'';pdSyncHost(h);const idx=+h.dataset.idx;
 return pdCommitOne(s,idx,pdEnts(h)[s.method]);}

/* ---------- completar / corregir un detalle (versión nueva) ---------- */
function pdCanFix(s){return !!user&&(can('pay_detail_edit')||s.user===user.name);}
A.pdFix=el=>{const s=S.sales.find(x=>x.id===el.dataset.sale);if(!s)return;const idx=+el.dataset.idx;const p=salePays(s)[idx];if(!p)return;
 if(!pdCanFix(s))return toast('Sólo un supervisor, el administrador o quien cobró completan el detalle.',1);
 const last=pdLatest(s.id,idx);
 const w=modal('Detalle del cobro · '+s.n+' · '+(MET[p.m]||p.m)+' · '+money(p.a),pdHostHTML({sale:s.id,idx,fix:1}),{okText:last?'Guardar versión '+(last.ver+1):'Guardar detalle',wide:true,onOk:()=>{
  const h=pdHost();pdSyncHost(h);const e=pdCommitOne(s,idx,pdEnts(h)[p.m]);if(e){toast(e,1);return false;}toast('Detalle guardado');rerender();}});
 if(last){const E=pdTmp;E[p.m]={v:{}};pdFields(p.m).forEach(f=>{let x=last[f.k];if(x==null)return;if(f.t==='dt')x=pdDTval(x);else if(f.t==='money')x=pesosStr(x);E[p.m].v[f.k]=String(x);});}
 pdBind(w);};
A.pdReveal=el=>{if(!can('pay_detail_edit'))return toast('Ver el titular ordenante necesita un permiso especial.',1);
 const r=pdAllRecs().find(x=>x.id===el.dataset.id);if(!r)return;const s=S.sales.find(x=>x.id===r.sale);
 audit('ORDENANTE_REVELADO',(s?s.n:'?')+' · '+(MET[r.medio]||r.medio)+' · v'+r.ver);
 modal('Titular ordenante',`<p><b>${esc(r.ordName||'(no cargado)')}</b><br>${esc(r.ordDoc||'')}</p><p class="sm mut">Esta consulta quedó registrada en la auditoría.</p>`,{ok:false,cancelText:'Cerrar'});};

/* ---------- vista en el detalle de la operación ---------- */
function pdRecRow(r,own){
 const ref=r.nro||r.txid||'';const tag=[r.pend?'<span class="tag warn">comprobante incompleto</span>':'',r.dupAuth?'<span class="tag warn">repetido autorizado</span>':'',r.impDiff?'<span class="tag warn">importe distinto</span>':''].join(' ');
 return `<tr><td data-l="Medio">${esc(MET[r.medio]||r.medio)}</td><td data-l="Versión">v${r.ver}</td><td data-l="Entidad / marca">${esc(r.ent||r.brand||r.prov||'—')}${r.dest?'<br><span class="sm">→ '+esc(r.dest)+'</span>':''}</td>
 <td data-l="N.º / autorización">${esc(ref||'—')}${r.auth?'<br><span class="sm">aut. '+esc(r.auth)+'</span>':''}${r.cupon?'<br><span class="sm">cupón '+esc(r.cupon)+'</span>':''}</td>
 <td data-l="Tarjeta">${r.last4?'****'+esc(r.last4)+(r.cuotas>1?' · '+r.cuotas+' cuotas':' · 1 pago'):'—'}</td>
 <td data-l="Comprobante">${r.fh?fmtDT(r.fh):'—'}${r.imp?'<br><span class="sm">'+money(r.imp)+'</span>':''}</td>
 <td data-l="Ordenante">${r.ordMask?esc(r.ordMask)+(can('pay_detail_edit')?' <button class="btn sm" data-act="pdReveal" data-id="'+esc(r.id)+'">Ver</button>':''):'—'}</td>
 <td data-l="Estado"><span class="tag">declarado</span> ${tag}</td><td data-l="Cargó" class="sm">${esc(r.user||'')}<br>${fmtDT(r.ts)}</td></tr>`;}
function saleDetailExtra(s){
 const pays=salePays(s);const dig=pays.map((p,i)=>({p,i})).filter(x=>PD_MEDIOS.includes(x.p.m));if(!dig.length)return'';
 let rows='',any=false;
 dig.forEach(x=>{const vs=pdVers(s.id,x.i);if(!vs.length){rows+=`<tr><td data-l="Medio">${esc(MET[x.p.m])}</td><td colspan="8" data-l="Detalle"><span class="tag warn">sin detalle del comprobante</span> ${pdOn()&&pdCanFix(s)&&s.status==='ok'?`<button class="btn sm" data-act="pdFix" data-sale="${esc(s.id)}" data-idx="${x.i}">Cargar detalle</button>`:''}</td></tr>`;return;}
  any=true;vs.slice().reverse().forEach((r,j)=>{rows+=pdRecRow(r);});
  const last=vs[vs.length-1];if(pdOn()&&pdCanFix(s)&&(last.pend))rows+=`<tr><td colspan="9"><button class="btn sm" data-act="pdFix" data-sale="${esc(s.id)}" data-idx="${x.i}">Completar el comprobante (nueva versión)</button></td></tr>`;
  else if(pdOn()&&pdCanFix(s)&&can('pay_detail_edit'))rows+=`<tr><td colspan="9"><button class="btn sm" data-act="pdFix" data-sale="${esc(s.id)}" data-idx="${x.i}">Corregir (nueva versión)</button></td></tr>`;});
 return `<h3 style="margin-top:.8rem">Datos de los cobros digitales</h3><div class="tw"><table class="cjtbl"><thead><tr><th>Medio</th><th>Versión</th><th>Entidad / marca</th><th>N.º / autorización</th><th>Tarjeta</th><th>Comprobante</th><th>Ordenante</th><th>Estado</th><th>Cargó</th></tr></thead><tbody>${rows}</tbody></table></div><p class="sm mut">Lo cargado a mano queda «declarado»: sólo una integración verificada con el proveedor acredita un cobro. Las correcciones agregan una versión; las anteriores se conservan.</p>`;}

/* ---------- ticket: medio, últimos 4, autorización / N.º de operación (nunca el ordenante) ---------- */
function pdTicketLines(sale){const out=[];if(!PD_MEDIOS.some(m=>salePays(sale).some(p=>p.m===m)))return out;
 salePays(sale).forEach((p,i)=>{if(!PD_MEDIOS.includes(p.m))return;const r=pdLatest(sale.id,i);if(!r)return;
  if(r.last4)out.push({t:'t',s:(MET[p.m])+' '+(r.brand||'')+' ****'+r.last4+(p.m==='credito'?' · '+(r.cuotas>1?r.cuotas+' cuotas':'1 pago'):'')});
  if(r.auth)out.push({t:'t',s:'Autorización: '+r.auth});
  if(r.nro)out.push({t:'t',s:'N.º de operación: '+r.nro});
  if(r.txid)out.push({t:'t',s:(r.prov||MET[p.m])+' · ID: '+r.txid});});
 return out;}

/* ---------- Caja: «Cobros a conciliar» ---------- */
function pdConcilCard(){
 if(!pdOn())return'';const L=pdMissingAll();
 return `<div class="card" style="margin-top:1rem" id="pd-concil"><h3 style="margin-top:0">Cobros a conciliar <span class="tag ${L.length?'warn':''}">${L.length}</span></h3>
 <p class="sm mut">Cobros digitales sin el detalle del comprobante o con comprobante incompleto (excepción de un supervisor). Completarlos agrega una versión nueva; no se pisa nada.</p>
 ${L.length?`<div class="tw"><table class="cjtbl"><thead><tr><th>Venta</th><th>Fecha</th><th>Medio</th><th class="r">Importe</th><th>Motivo</th><th></th></tr></thead><tbody>${L.slice(0,60).map(x=>`<tr><td data-l="Venta">${esc(x.s.n)}</td><td data-l="Fecha">${fmtDT(x.s.ts)}</td><td data-l="Medio">${esc(MET[x.medio])}</td><td class="r" data-l="Importe">${money(salePays(x.s)[x.idx].a)}</td><td data-l="Motivo">${esc(x.why)}</td><td>${pdCanFix(x.s)?`<button class="btn sm" data-act="pdFix" data-sale="${esc(x.s.id)}" data-idx="${x.idx}">Completar</button>`:''}<button class="btn sm" data-act="saleDet" data-id="${esc(x.s.id)}">Ver</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="okbox sm">No hay cobros pendientes de conciliar.</p>'}</div>`;}

/* ---------- Configuración ---------- */
const PD_REQ_TXT={obligatorio:'Obligatorio',recomendado:'Recomendado',oculto:'Oculto'};
function payCfgCard(){
 if(!can('config'))return'';const c=pdCfg();
 return `<div class="card" id="pd-cfg" style="margin-top:1rem"><h3 style="margin-top:0">Detalle de los cobros digitales</h3>
 <p class="sm mut">Pide los datos del comprobante en transferencias, tarjetas y QR/MODO. Está <b>apagado</b> hasta que lo actives. Lo cargado queda «declarado»: no acredita el cobro. Nunca se guarda el número de tarjeta completo.</p>
 <label class="chk"><input type="checkbox" id="pdc-on" ${c.on?'checked':''}> Exigir el detalle del comprobante al cobrar</label>
 <div class="tw"><table class="cjtbl"><thead><tr><th>Medio</th><th>Campo</th><th>Exigencia</th></tr></thead><tbody>${PD_MEDIOS.map(m=>PD_F[m].map(f=>`<tr><td data-l="Medio">${esc(MET[m])}</td><td data-l="Campo">${esc(f.l)}</td><td data-l="Exigencia">${f.nr?'<span class="tag">Obligatorio siempre</span>':`<select id="pdc-${m}-${f.k}" aria-label="${esc(MET[m]+' · '+f.l)}">${['obligatorio','recomendado','oculto'].map(o=>`<option value="${o}" ${pdReq(m,f)===o?'selected':''}>${PD_REQ_TXT[o]}</option>`).join('')}</select>`}</td></tr>`).join('')).join('')}</tbody></table></div>
 <div class="grid g2"><div><label for="pdc-age">Antigüedad máxima del comprobante (horas, vacío = sin límite)</label><input id="pdc-age" inputmode="numeric" autocomplete="off" placeholder="Sin límite" value="${c.maxAgeH||''}"></div>
 <div><label for="pdc-acc">Cuentas de destino (una por línea)</label><textarea id="pdc-acc" rows="3" maxlength="900">${esc(c.accounts.join('\n'))}</textarea></div></div>
 <div class="row" style="margin-top:.6rem"><button class="btn gold" data-act="payCfgSave">Guardar</button></div></div>`;}
A.payCfgSave=()=>{if(!can('config'))return toast('Sólo el administrador cambia esta configuración.',1);
 const old=pdCfg();const on=!!document.getElementById('pdc-on').checked;const fields={};
 PD_MEDIOS.forEach(m=>PD_F[m].forEach(f=>{if(f.nr)return;const el=document.getElementById('pdc-'+m+'-'+f.k);if(el&&el.value!==(f.def||'obligatorio')){fields[m]=fields[m]||{};fields[m][f.k]=el.value;}}));
 const age=val('pdc-age').trim();if(age&&!/^\d{1,4}$/.test(age))return toast('La antigüedad máxima son horas (número entero).',1);
 const accounts=val('pdc-acc').split('\n').map(x=>x.trim().slice(0,60)).filter(Boolean).slice(0,30);
 if(accounts.some(pdPan))return toast('Una cuenta parece un número de tarjeta: no se guarda.',1);
 S.cfg.pay=Object.assign({},S.cfg.pay,{detail:{on,fields,since:on?(old.since||now()):old.since},maxAgeH:age?+age:0,accounts});
 audit('COBRO_DETALLE_CONFIG',(on?'ACTIVADO':'APAGADO')+' · antigüedad máx. '+(age||'sin límite')+' h · '+Object.keys(fields).length+' medio(s) con exigencias propias');
 save();rerender();toast('Configuración guardada');};
