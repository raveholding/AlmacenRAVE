/* ===== V26.9 · 4.23.1–4.23.3 y 4.23.7 Traspasos de fondos controlados =====
   Se EXTIENDE el registro de traspasos de siempre (S.transfers, colección ctransf): no hay un segundo libro.
   · Permiso propio `transfer_funds` (bandera cfg.xfer.strict) · autorizante (permiso_propio / pin_admin / clave_admin)
   · Cajas cerradas: fondo en tránsito o saldo inicial sugerido; el cierre sellado NO se toca (los movimientos posteriores van aparte)
   · Estados por eventos sólo-agregar (S.transferEvents, colección ctev): completado · en_transito · recibido · recibido_con_diferencia · devuelto · revertido
   · Comprobante interno «Boleta de Movimiento de Fondos» con número T-<caja>-<n>, cadena de hash e impresión 80/58 mm y A4
   · El servidor (migración 11) vuelve a validar permiso, autorizante, estado de las cajas, importe y rubro. Ocultar un botón no es un control. */
const XF_DEF={strict:false,closedMode:'transito',approvalOver:0,transitAlertH:0,selfAuth:false};
const xfCfg=()=>Object.assign({},XF_DEF,(S.cfg&&S.cfg.xfer)||{});
const xfStrict=()=>!!xfCfg().strict;
/* quién puede emitir y recibir: con la bandera, sólo `transfer_funds`; sin ella, como hasta ahora (arqueo y cierre) o `transfer_funds` */
const xfCan=()=>!!user&&(can('config')||(xfStrict()?can('transfer_funds'):(can('close_cash')||can('transfer_funds'))));
const xfCloud=()=>{try{return typeof CLOUD!=='undefined'&&!!CLOUD.on&&!!cl&&!!cl.ready;}catch(e){return false;}};
const xfMe=()=>{try{if(xfCloud()&&cl.uid)return cl.uid;}catch(e){}return user?user.id:'';};
const XF_ST={completado:'Completado',en_transito:'En tránsito',recibido:'Recibido',recibido_con_diferencia:'Recibido con diferencia',devuelto:'Devuelto',revertido:'Revertido'};
const XF_TAG={completado:'ok',en_transito:'warn',recibido:'ok',recibido_con_diferencia:'bad',devuelto:'warn',revertido:'bad'};
const XF_METH={permiso_propio:'permiso propio',pin_admin:'PIN de administrador',clave_admin:'clave de administrador'};
const XF_CRED=()=>'Desarrollado por '+VB.name+' · '+VB.phone+' · '+VB.mail;
const xfTr=id=>(S.transfers||[]).find(t=>t.id===id);
const xfEvs=t=>(S.transferEvents||[]).filter(e=>e.tid===t.id);
/* ---------- estado de cada caja ---------- */
function xfLastClose(regId){let b=null;for(const c of S.closures){if((c.regId||'')===regId&&(!b||c.ts>b.ts))b=c;}return b;}
function xfRegState(regId){const s=openOf(regId);if(s)return{st:'abierta',sess:s.id,ref:''};const c=xfLastClose(regId);return{st:'cerrada',sess:'',ref:c?c.id:''};}
/* ---------- estado de un traspaso (a partir de sus eventos) ---------- */
function xfIoIncluded(t){ /* modo saldo_inicial: el fondo se integra solo al abrir el próximo turno de la caja destino */
 return t.v===2&&t.toState==='cerrada'&&t.cm==='saldo_inicial'&&!xfEvs(t).some(e=>['recibido','recibido_con_diferencia','devuelto'].includes(e.kind))
  &&S.sessions.some(s=>s.regId===t.to&&s.openedAt>t.ts);}
function xfPending(t){return t.v===2&&t.toState==='cerrada'&&!xfEvs(t).some(e=>['recibido','recibido_con_diferencia','devuelto'].includes(e.kind))&&!xfIoIncluded(t);}
function xferState(t){
 if((S.transfers||[]).some(x=>x.rev===t.id))return'revertido';
 const ev=xfEvs(t);
 if(ev.some(e=>e.kind==='devuelto'))return'devuelto';
 if(ev.some(e=>e.kind==='recibido_con_diferencia'))return'recibido_con_diferencia';
 if(ev.some(e=>e.kind==='recibido')||xfIoIncluded(t))return'recibido';
 return xfPending(t)?'en_transito':'completado';}
const xfRecvEv=t=>xfEvs(t).find(e=>e.kind==='recibido'||e.kind==='recibido_con_diferencia');
const xfRetEv=t=>xfEvs(t).find(e=>e.kind==='devuelto');
/* ---------- efectivo esperado de una sesión (lo usa el arqueo) ---------- */
function transfersFor(sess){const o={tin:0,tout:0,list:[]};if(!sess||!S.transfers)return o;
 S.transfers.forEach(t=>{
  if(t.fromSess===sess.id){o.tout+=t.amount;o.list.push({ts:t.ts,dir:'out',other:regName(t.to),amount:t.amount,motivo:t.motivo,rubro:t.rubroName||'',num:t.num||''});}
  if(t.toSess===sess.id){o.tin+=t.amount;o.list.push({ts:t.ts,dir:'in',other:regName(t.from),amount:t.amount,motivo:t.motivo,rubro:t.rubroName||'',num:t.num||''});}});
 (S.transferEvents||[]).forEach(e=>{if(e.sess!==sess.id||e.io)return;const t=xfTr(e.tid);if(!t)return;
  if(e.kind==='recibido'||e.kind==='recibido_con_diferencia'){o.tin+=e.amt;o.list.push({ts:e.ts,dir:'in',other:regName(t.from),amount:e.amt,motivo:(e.kind==='recibido'?'Recepción ':'Recepción con diferencia ')+(t.num||''),rubro:t.rubroName||'',num:t.num||''});}
  else if(e.kind==='devuelto'){o.tin+=e.amt;o.list.push({ts:e.ts,dir:'in',other:regName(t.to),amount:e.amt,motivo:'Devolución '+(t.num||''),rubro:t.rubroName||'',num:t.num||''});}});
 return o;}
/* ---------- saldo inicial sugerido para el próximo turno de una caja ---------- */
function xfSuggested(regId){const c=xfLastClose(regId);const o={amount:0,declared:null,withdrawn:0,returned:0,incl:0,inclList:[],hasClose:!!c,lastClose:c?c.ts:0};if(!c)return o;
 const decl=c.data&&typeof c.data.declared==='number'?c.data.declared:0;o.declared=decl;
 (S.transfers||[]).forEach(t=>{if(t.v!==2||t.ts<=c.ts)return;
  if(t.from===regId&&t.fromState==='cerrada')o.withdrawn+=t.amount;
  if(t.to===regId&&t.toState==='cerrada'&&t.cm==='saldo_inicial'&&xferState(t)==='en_transito'){o.incl+=t.amount;o.inclList.push(t);}});
 (S.transferEvents||[]).forEach(e=>{if(e.kind!=='devuelto'||e.sess||e.ts<=c.ts)return;const t=xfTr(e.tid);if(t&&t.from===regId)o.returned+=e.amt;});
 o.amount=Math.max(0,decl-o.withdrawn+o.returned+o.incl);return o;}
/* ---------- autorizante ---------- */
function xfReasons(fromId,toId,amount,rev){const r=[];const fr=regOf(fromId),to=regOf(toId);if(!fr||!to)return r;
 if(!openOf(fromId)||!openOf(toId))r.push('una de las cajas está cerrada');
 if(brOn()&&(fr.branchId||'')!==(to.branchId||''))r.push('es entre sucursales distintas');
 const ov=xfCfg().approvalOver;if(ov>0&&amount>ov)r.push('el importe supera '+money(ov));
 if(rev)r.push('es una reversa');return r;}
let xfAdm=null;const xfFail={n:0,until:0};
async function xfAdmins(){
 if(xfCloud()){try{const rows=await sel('miembros?select=usuario_id,rol,nombre,email&comercio_id=eq.'+cl.comercio.id);return rows.filter(r=>r.rol==='admin').map(r=>({id:r.usuario_id,name:r.nombre||r.email,email:r.email}));}catch(e){return[];}}
 return S.users.filter(u=>u.role==='admin').map(u=>({id:u.id,name:u.name}));}
function xfCandidates(adms){const me=xfMe();const self=adms.length===1&&adms[0].id===me||xfCfg().selfAuth;return adms.filter(a=>a.id!==me||self);}
async function xfAuthResolve(adms,selId,secret){
 if(now()<xfFail.until)return{err:'Demasiados intentos. Esperá '+Math.ceil((xfFail.until-now())/1000)+' s.'};
 const a=adms.find(x=>x.id===selId);if(!a)return{err:'Elegí el administrador que autoriza.'};
 if(!secret)return{err:'Falta la '+(xfCloud()?'clave':'PIN')+' del administrador.'};
 let ok=false;
 if(xfCloud()){if(!cl.online)return{err:'Sin conexión: la autorización de un administrador necesita internet para verificar su clave.'};
  try{const j=await authCall('token?grant_type=password',{email:a.email,password:secret});ok=!!(j&&j.user&&j.user.id===a.id);}catch(e){ok=false;}}
 else ok=S.users.some(u=>u.id===a.id&&u.role==='admin'&&u.pin===secret);
 if(!ok){xfFail.n++;if(xfFail.n>=5){xfFail.until=now()+120000;xfFail.n=0;audit('TRASPASO_AUTORIZANTE_BLOQUEO','5 intentos fallidos: bloqueo de 2 minutos');}return{err:'Clave o PIN incorrecto.'};}
 xfFail.n=0;const auth={id:a.id,name:a.name,method:xfCloud()?'clave_admin':'pin_admin'};if(a.id===xfMe())auth.self=true;return{auth};}
function xfAuthHTML(){return`<div class="warnbox" id="xf-ab" hidden><b>Necesita autorización de un administrador</b><br><span class="sm" id="xf-ar"></span>
 <label for="xf-au">Administrador que autoriza</label><select id="xf-au"></select>
 <label for="xf-ap">${xfCloud()?'Clave del administrador':'PIN del administrador'}</label><input id="xf-ap" type="password" autocomplete="off" ${xfCloud()?'':'inputmode="numeric"'}></div>`;}
/* ---------- crear un traspaso (lógica pura: la usan el modal y las pruebas) ---------- */
function xferCreate(o){
 if(!mainOn())return'El módulo de caja principal no está habilitado.';
 if(!xfCan())return'Sin permiso para traspasar fondos.';
 if((S.transfers||[]).some(t=>t.id===o.id))return'';  /* idempotente: el mismo id no se repite */
 if(!o.from||!o.to||o.from===o.to)return'Elegí dos cajas distintas.';
 const fr=regOf(o.from),to=regOf(o.to);if(!fr||!to||fr.active===false||to.active===false)return'Caja inexistente o inactiva.';
 if(!Number.isInteger(o.amount)||!(o.amount>0))return'El importe debe ser mayor a cero.';
 if(o.amount>100000000000)return'El importe es demasiado grande.';
 const fs=xfRegState(o.from),ts=xfRegState(o.to);
 if((fs.st==='cerrada'||ts.st==='cerrada')&&!xfStrict())return'Las dos cajas tienen que estar abiertas para traspasar. Para mover fondos con una caja cerrada hace falta el permiso de traspasos (Usuarios y permisos).';
 if(brOn()&&(fr.branchId||'')!==(to.branchId||'')&&fr.type!=='main'&&to.type!=='main')return'Entre sucursales distintas sólo se traspasa desde o hacia una caja principal.';
 const e=validRubro(o.rubro,'ingreso')||validRubro(o.rubro,'egreso');if(e)return e;
 if(!o.motivo||o.motivo.trim().length<3)return'Escribí el motivo (mínimo 3 letras).';
 let avail;if(fs.st==='abierta'){const ss=openOf(o.from);avail=arqueoCalc(ss,arqInputs(ss)).expectedCash;}else avail=xfSuggested(o.from).amount;
 if(o.amount>avail&&!o.force)return fs.st==='abierta'?'La caja de origen no tiene efectivo suficiente (esperado '+money(avail)+').':'La caja de origen está cerrada y su fondo retenido es '+money(avail)+': no alcanza.';
 const why=xfReasons(o.from,o.to,o.amount,o.rev);let auth=o.auth||null;
 if(why.length){
  if(!auth||!auth.id||!['pin_admin','clave_admin'].includes(auth.method))return'Esta operación necesita la autorización de un administrador ('+why.join('; ')+').';
  if(auth.id===xfMe()&&!auth.self)return'El autorizante tiene que ser un administrador distinto de quien emite.';
 }else if(!auth||!auth.id)auth={id:xfMe(),name:user.name,method:'permiso_propio'};
 const code=(fr.code||fr.id.slice(0,6));let n=0;(S.transfers||[]).forEach(x=>{if(x.from===o.from)n=Math.max(n,x.n||0);});n++;
 const prev=(S.transfers||[]).length?(S.transfers[S.transfers.length-1].h||''):'';
 const t={id:o.id,v:2,ts:now(),from:o.from,to:o.to,fromName:fr.name,toName:to.name,fromBr:(brOf(fr.branchId)||{}).name||'',toBr:(brOf(to.branchId)||{}).name||'',
  fromSess:fs.sess,toSess:ts.sess,fromRef:fs.ref,toRef:ts.ref,fromState:fs.st,toState:ts.st,amount:o.amount,cur:'ARS',rubro:o.rubro,rubroName:rubName(o.rubro),
  motivo:o.motivo.trim().slice(0,200),user:user.name,userId:xfMe(),auth,n,num:'T-'+code+'-'+n};
 if(ts.st==='cerrada')t.cm=xfCfg().closedMode==='saldo_inicial'?'saldo_inicial':'transito';
 if(o.rev)t.rev=o.rev;
 t.ph=prev;t.h=sha256([prev,t.id,t.ts,t.from,t.to,t.amount,t.rubro,t.motivo,t.userId,auth.id,auth.method,t.fromState,t.toState,t.num].join('|'));
 S.transfers=S.transfers||[];S.transfers.push(t);
 audit(o.rev?'TRASPASO_REVERSA':'TRASPASO_CAJAS',t.num+' · '+t.fromName+' ('+t.fromState+') → '+t.toName+' ('+t.toState+') · '+money(t.amount)+' · '+t.rubroName+' · '+t.motivo+' · autoriza '+auth.name+' ('+(XF_METH[auth.method]||auth.method)+')');
 emit('cash.transfer',{from:o.from,to:o.to,amount:o.amount});save();return'';}
/* ---------- eventos: recibir, devolver, anotar ---------- */
function xfEvent(t,kind,amt,nota,sess){
 const ev={id:uid(),tid:t.id,kind,amt:amt,nota:(nota||'').trim().slice(0,300),sess:sess||'',ts:now(),user:user.name,userId:xfMe()};
 S.transferEvents=S.transferEvents||[];S.transferEvents.push(ev);return ev;}
function xferReceive(o){
 if(!xfCan())return'Sin permiso para recibir fondos.';
 const t=xfTr(o.tid);if(!t)return'El traspaso no existe.';if(xferState(t)!=='en_transito')return'Este traspaso no está en tránsito.';
 const s=openOf(t.to);if(!s)return'Abrí la caja destino ('+regName(t.to)+') para recibir el fondo.';
 if(!Number.isInteger(o.amt)||o.amt<0)return'Escribí el importe recibido.';
 if(o.amt>t.amount)return'No se puede recibir más de lo enviado ('+money(t.amount)+').';
 let kind='recibido';if(o.amt<t.amount){kind='recibido_con_diferencia';if(!o.nota||o.nota.trim().length<5)return'Explicá la diferencia (mínimo 5 letras): faltan '+money(t.amount-o.amt)+'.';}
 xfEvent(t,kind,o.amt,o.nota,s.id);
 audit(kind==='recibido'?'TRASPASO_RECIBIDO':'TRASPASO_DIFERENCIA',t.num+' · enviado '+money(t.amount)+' · recibido '+money(o.amt)+(kind==='recibido'?'':' · diferencia '+money(t.amount-o.amt)+' · '+o.nota.trim()));
 save();return'';}
function xferReturn(o){
 if(!xfCan())return'Sin permiso.';const t=xfTr(o.tid);if(!t)return'El traspaso no existe.';if(xferState(t)!=='en_transito')return'Este traspaso no está en tránsito.';
 if(!o.nota||o.nota.trim().length<3)return'Escribí el motivo de la devolución.';
 const so=openOf(t.from);xfEvent(t,'devuelto',t.amount,o.nota,so?so.id:'');
 audit('TRASPASO_DEVUELTO',t.num+' · '+money(t.amount)+' vuelve a '+regName(t.from)+' · '+o.nota.trim());save();return'';}
function xferNote(o){if(!xfCan())return'Sin permiso.';const t=xfTr(o.tid);if(!t)return'El traspaso no existe.';if(!o.nota||o.nota.trim().length<3)return'Escribí la nota (mínimo 3 letras).';
 xfEvent(t,'anotado',0,o.nota);audit('TRASPASO_NOTA',t.num+' · '+o.nota.trim());save();return'';}
/* ---------- invariante: enviado = recibido + en tránsito + diferencias + devuelto ---------- */
function xfBalance(t){const ev=xfEvs(t);const rc=ev.find(e=>e.kind==='recibido'||e.kind==='recibido_con_diferencia'),rt=ev.find(e=>e.kind==='devuelto');
 const o={sent:t.amount,received:0,transit:0,diff:0,returned:0};
 if(rt)o.returned=rt.amt;else if(rc){o.received=rc.amt;o.diff=t.amount-rc.amt;}else if(xfIoIncluded(t))o.received=t.amount;else if(xfPending(t))o.transit=t.amount;else o.received=t.amount;
 o.ok=o.sent===o.received+o.transit+o.diff+o.returned;return o;}
/* ================= interfaz ================= */
function xfRubOpts(){return S.rubros.filter(r=>r.kind==='rubro').map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');}
async function xfModalSync(w){const f=val('xf-f'),t=val('xf-t'),a=cents(val('xf-a'));const rv=w.dataset.rev||'';
 const why=xfReasons(f,t,isNaN(a)?0:a,rv);const ab=w.querySelector('#xf-ab');if(!ab)return;ab.hidden=!why.length;
 const r=w.querySelector('#xf-ar');if(r)r.textContent='Motivo: '+why.join('; ')+'.';
 const dst=w.querySelector('#xf-ds');if(dst){const fs=xfRegState(f),ts=xfRegState(t);const cl2=[];
  cl2.push('Origen: '+(fs.st==='abierta'?'caja abierta':'caja CERRADA (se descuenta del fondo retenido: sugerido '+money(xfSuggested(f).amount)+')'));
  cl2.push('Destino: '+(ts.st==='abierta'?'caja abierta (suma en el acto)':'caja CERRADA → queda '+(xfCfg().closedMode==='saldo_inicial'?'incluido en el saldo inicial sugerido de su próximo turno':'«en tránsito» hasta que se reciba al abrir su próximo turno')));
  dst.textContent=cl2.join(' · ');}}
async function xfOpenModal(o){ /* o: {rev?:transfer, title} */
 if(!mainOn()||!xfCan())return toast('Sin permiso o módulo de caja principal apagado',1);
 const regs=(S.registers||[]).filter(r=>r.active!==false);if(regs.length<2)return toast('Hacen falta dos cajas definidas para traspasar.',1);
 const adms=await xfAdmins();xfAdm=adms;const cand=xfCandidates(adms);
 const id=uid(),rv=o&&o.rev?o.rev:null;const myReg=S.tenant.regId;
 const fromId=rv?rv.to:(openOf(myReg)?myReg:(regs.find(r=>openOf(r.id))||regs[0]).id),toId=rv?rv.from:(regs.find(r=>r.type==='main'&&r.id!==fromId)||regs.find(r=>r.id!==fromId)).id;
 const opt=r=>`<option value="${r.id}">${esc(r.name)}${r.type==='main'?' (principal)':''}${brOn()&&r.branchId?' · '+esc((brOf(r.branchId)||{}).name||''):''} · ${openOf(r.id)?'abierta':'cerrada'}</option>`;
 const w=modal(rv?'Revertir traspaso '+(rv.num||''):'Traspasar fondos entre cajas',`${rv?`<p>Se devuelve <b>${money(rv.amount)}</b> de <b>${esc(rv.toName||regName(rv.to))}</b> a <b>${esc(rv.fromName||regName(rv.from))}</b> con un comprobante nuevo vinculado al original.</p>`:''}
 <label for="xf-f">Desde</label><select id="xf-f" ${rv?'disabled':''}>${regs.map(opt).join('')}</select>
 <label for="xf-t">Hacia</label><select id="xf-t" ${rv?'disabled':''}>${regs.map(opt).join('')}</select>
 <label for="xf-a">Importe ($)</label>${numIn('xf-a',rv?rv.amount:0,'0')}
 <label for="xf-r">Rubro (obligatorio)</label><select id="xf-r"><option value="">— Elegí un rubro —</option>${xfRubOpts()}</select>
 <label for="xf-m">Motivo / concepto</label><input id="xf-m" maxlength="200" placeholder="Ej.: retiro de excedente a caja principal" autocomplete="off" value="${rv?esc('Reversa: '+rv.motivo):''}">
 <p class="sm mut" id="xf-ds"></p>
 ${xfAuthHTML()}
 <p class="sm mut">Es un movimiento interno: sale del efectivo de una caja y entra en el de la otra. No suma como venta, ingreso ni egreso.</p>`,
 {okText:rv?'Revertir':'Traspasar',onOk:async w2=>{
  const f=val('xf-f'),t=val('xf-t'),amt=cents(val('xf-a'));const why=xfReasons(f,t,isNaN(amt)?0:amt,rv?rv.id:'');let auth=null;
  if(why.length){const res=await xfAuthResolve(adms,val('xf-au'),val('xf-ap'));if(res.err){w2._err(res.err);return false;}auth=res.auth;}
  const e=xferCreate({id,from:f,to:t,amount:amt,rubro:val('xf-r'),motivo:val('xf-m'),auth,rev:rv?rv.id:undefined,force:!!rv});
  if(e){w2._err(e);return false;}
  toast('Traspaso registrado');rerender();const tt=xfTr(id);if(tt)setTimeout(()=>A.xferView({dataset:{id:tt.id}}),60);}});
 w.dataset.rev=rv?rv.id:'';
 const set=(id2,v)=>{const el=w.querySelector('#'+id2);if(el&&v)el.value=v;};set('xf-f',fromId);set('xf-t',toId);if(rv)set('xf-r',rv.rubro);
 const au=w.querySelector('#xf-au');if(au)au.innerHTML=cand.length?cand.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}${a.id===xfMe()?' (yo)':''}</option>`).join(''):'<option value="">No hay otro administrador que pueda autorizar</option>';
 ['input','change'].forEach(ev=>w.addEventListener(ev,()=>xfModalSync(w)));xfModalSync(w);}
A.xfer=()=>xfOpenModal({});
A.xferRev=el=>{if(!can('config'))return toast('Sólo el administrador corrige traspasos',1);const t=xfTr(el.dataset.id);if(!t)return;
 if((S.transfers||[]).some(x=>x.rev===t.id))return toast('Ya fue revertido',1);
 if(xferState(t)==='en_transito')return toast('Sigue en tránsito: usá «Devolver» en lugar de revertirlo.',1);
 xfOpenModal({rev:t});};
A.xferRecv=el=>{const t=xfTr(el.dataset.id);if(!t)return;if(!xfCan())return toast('Sin permiso para recibir fondos',1);
 if(!openOf(t.to))return toast('Abrí la caja «'+regName(t.to)+'» para recibir el fondo.',1);
 modal('Recibir fondos · '+(t.num||''),`<p>Enviado por <b>${esc(t.fromName||regName(t.from))}</b>: <b>${money(t.amount)}</b>. Contá el efectivo y escribí lo que recibís realmente.</p>
 <label for="xr-a">Importe recibido ($)</label>${numIn('xr-a',t.amount,'0')}
 <label for="xr-n">Nota (obligatoria si hay diferencia)</label><input id="xr-n" maxlength="300" autocomplete="off">
 <p class="sm mut">Si recibís menos, la diferencia queda registrada y auditada: nunca se absorbe en silencio.</p>`,
 {okText:'Confirmar recepción',onOk:w=>{const e=xferReceive({tid:t.id,amt:cents(val('xr-a')),nota:val('xr-n')});if(e){w._err(e);return false;}toast('Recepción registrada');rerender();}});};
A.xferRet=el=>{const t=xfTr(el.dataset.id);if(!t)return;if(!xfCan())return toast('Sin permiso',1);
 modal('Devolver fondos · '+(t.num||''),`<p>Los <b>${money(t.amount)}</b> vuelven a <b>${esc(t.fromName||regName(t.from))}</b> (${openOf(t.from)?'suma al efectivo de su turno abierto':'caja cerrada: se suma a su saldo inicial sugerido'}).</p>
 <label for="xd-n">Motivo (obligatorio)</label><input id="xd-n" maxlength="300" autocomplete="off">`,
 {okText:'Devolver',onOk:w=>{const e=xferReturn({tid:t.id,nota:val('xd-n')});if(e){w._err(e);return false;}toast('Devolución registrada');rerender();}});};
A.xferNote=el=>{const t=xfTr(el.dataset.id);if(!t)return;
 modal('Agregar nota · '+(t.num||''),`<label for="xn-n">Nota (se agrega, nunca se edita)</label><input id="xn-n" maxlength="300" autocomplete="off">`,
 {okText:'Guardar nota',onOk:w=>{const e=xferNote({tid:t.id,nota:val('xn-n')});if(e){w._err(e);return false;}rerender();}});};
/* ---------- fondos en tránsito hacia la caja abierta de este equipo ---------- */
function xfPendingFor(regId){return(S.transfers||[]).filter(t=>t.to===regId&&xferState(t)==='en_transito');}
function xferPendingCard(sess){if(!mainOn()||!sess||!sess.regId)return'';const L=xfPendingFor(sess.regId);if(!L.length)return'';
 return`<div class="card warnbox" style="margin-top:1rem" id="xf-pend"><h3>Fondos en tránsito hacia esta caja</h3><p class="sm">Se suman al efectivo esperado cuando los recibís (contalos y confirmá el importe).</p>
 <div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Desde</th><th class="r">Importe</th><th>Concepto</th><th></th></tr></thead><tbody>${L.map(t=>`<tr><td>${esc(t.num||'')}</td><td>${fmtDT(t.ts)}</td><td>${esc(t.fromName||regName(t.from))}</td><td class="r">${money(t.amount)}</td><td>${esc(t.motivo)}</td><td class="r">${xfCan()?`<button class="btn sm gold" data-act="xferRecv" data-id="${t.id}">Recibir</button> <button class="btn sm" data-act="xferRet" data-id="${t.id}">Devolver</button>`:'<span class="sm mut">Necesita permiso de traspasos</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;}
/* ---------- apertura: saldo inicial sugerido ---------- */
function xfOpenHint(){ /* HTML bajo el selector de caja en «Abrir caja» */
 if(!mainOn())return'';return`<div id="xf-oh" class="sm mut" aria-live="polite"></div><div id="xf-od" hidden><label for="xf-om">Motivo de la diferencia con el saldo inicial sugerido (obligatorio)</label><input id="xf-om" maxlength="120" autocomplete="off"></div>`;}
function xfOpenSync(){if(!mainOn())return;const h=$('#xf-oh');if(!h)return;const rid=(val('ap-reg')||S.tenant.regId||'');const sg=rid?xfSuggested(rid):null;
 if(!sg||!sg.hasClose){h.innerHTML=rid?'Primera apertura de esta caja: no hay un cierre anterior para sugerir el saldo inicial.':'';const d=$('#xf-od');if(d)d.hidden=true;return;}
 const pend=xfPendingFor(rid);
 h.innerHTML=`<b>Saldo inicial sugerido: ${money(sg.amount)}</b> = declarado en el último cierre ${money(sg.declared)} − retiros posteriores ${money(sg.withdrawn)} + devoluciones ${money(sg.returned)} + traspasos incluidos ${money(sg.incl)}${sg.inclList.length?' (incluye '+sg.inclList.map(t=>esc(t.num||'')).join(', ')+')':''}.${pend.length?` <span class="tag warn">${pend.length} fondo(s) en tránsito para recibir después de abrir</span>`:''} <button class="btn sm" data-act="xfUseSug" data-v="${sg.amount}">Usar el sugerido</button>`;
 xfOpenDiff();}
function xfOpenDiff(){if(!mainOn())return;const rid=(val('ap-reg')||S.tenant.regId||'');const sg=rid?xfSuggested(rid):null;const d=$('#xf-od');if(!d)return;
 const v=cents(val('ap'));d.hidden=!(sg&&sg.hasClose&&!isNaN(v)&&v!==sg.amount);}
A.xfUseSug=el=>{const i=$('#ap');if(i){i.value=pesosStr(+el.dataset.v);xfOpenDiff();}};
document.addEventListener('change',e=>{if(e.target&&e.target.id==='ap-reg')xfOpenSync();});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='ap')xfOpenDiff();});
/* lo llama A.openCaja (p3-ops): valida la diferencia de apertura y deja constancia; devuelve {err} o {extra} */
function xfOpenCheck(v,extra){
 if(!mainOn()||!extra||!extra.regId)return{};const sg=xfSuggested(extra.regId);if(!sg.hasClose)return{};
 if(v===sg.amount)return{extra:{openSug:sg.amount}};
 const mot=($('#xf-om')?$('#xf-om').value:'').trim();if(mot.length<3)return{err:'La apertura difiere del saldo inicial sugerido ('+money(sg.amount)+'): escribí el motivo.'};
 return{extra:{openSug:sg.amount,openDiff:v-sg.amount,openMotivo:mot.slice(0,120)},audit:'APERTURA_DIFERENCIA',detail:'apertura '+money(v)+' vs sugerido '+money(sg.amount)+' · dif '+money(v-sg.amount)+' · '+mot};}
/* al abrir: los traspasos «saldo_inicial» quedan integrados (evento io) si quien abre puede registrarlos */
function xfAfterOpen(sess){if(!mainOn()||!sess||!sess.regId)return;
 (S.transfers||[]).forEach(t=>{if(t.to===sess.regId&&t.v===2&&t.toState==='cerrada'&&t.cm==='saldo_inicial'&&t.ts<sess.openedAt&&!xfEvs(t).some(e=>['recibido','recibido_con_diferencia','devuelto'].includes(e.kind))&&xfCan()){
   const ev=xfEvent(t,'recibido',t.amount,'Integrado al saldo inicial del turno',sess.id);ev.io=1;audit('TRASPASO_INTEGRADO',t.num+' · '+money(t.amount)+' incluido en el saldo inicial');}});}
/* ---------- comprobante ---------- */
const xfHash=t=>(t.sh||t.h||'').slice(0,12);
function xfVoucherRows(t){const st=xferState(t),au=t.auth||{};const rc=xfRecvEv(t),rt=xfRetEv(t);
 const rows=[['N.º de movimiento',(t.num||'(se asigna al sincronizar)')+' · ID '+String(t.id).slice(0,8)],
  ['Fecha y hora (equipo)',fmtDT(t.ts)+(t.tss?'':'')],['Fecha y hora (servidor)',t.tss?fmtDT(t.tss)+(Math.abs(t.tss-t.ts)>600000?' · HORA DE EQUIPO DESFASADA':''):'Pendiente de sincronizar'],
  ['Emisor',t.user||'—'],['Autoriza',(au.name||'—')+' · '+(XF_METH[au.method]||au.method||'')+(au.self?' (administrador único)':'')],
  ['Caja de origen',(t.fromName||regName(t.from))+(t.fromBr?' · '+t.fromBr:'')+' · '+(t.fromState||'abierta')],
  ['Caja de destino',(t.toName||regName(t.to))+(t.toBr?' · '+t.toBr:'')+' · '+(t.toState||'abierta')],
  ['Monto',money(t.amount)+' '+(t.cur||'ARS')],['Concepto',t.motivo||''],['Rubro financiero',t.rubroName||'—'],['Estado',XF_ST[st]+(rc&&st==='recibido_con_diferencia'?' · recibido '+money(rc.amt)+' · diferencia '+money(t.amount-rc.amt):'')+(rt?' · devuelto':'')]];
 if(t.rev){const o=xfTr(t.rev);rows.push(['Reversa de',o?(o.num||o.id.slice(0,8)):'(traspaso original)']);}
 rows.push(['Verificación',xfHash(t)||'—']);return rows;}
function xfVoucherHTML(t,copy){const rows=xfVoucherRows(t);
 return`<div class="xfv"><div class="c b">BOLETA DE MOVIMIENTO DE FONDOS${copy?' — COPIA':''}</div><div class="c sm">${esc(S.tenant.name||'')}</div>
 <div class="c b" style="margin:4px 0">DOCUMENTO INTERNO — NO VÁLIDO COMO FACTURA</div>
 ${rows.map(r=>`<div class="l"><span>${esc(r[0])}</span><span>${esc(r[1])}</span></div>`).join('')}
 <div class="c qr">${typeof QR!=='undefined'?QR.svg('RAVE-T|'+(t.num||t.id)+'|'+xfHash(t),3,1):''}</div>
 <div class="sig"><span>Entrega: ____________</span><span>Recibe: ____________</span></div>
 <div class="c sm">${esc(XF_CRED())}</div></div>`;}
function xfPrintDoc(t,size,copy){const w=size==='a4'?'190mm':(size==='58'?'48mm':'72mm');
 return`<!doctype html><html><head><meta charset="utf-8"><title>Boleta ${esc(t.num||t.id)}</title><style>@page{size:${size==='a4'?'A4':(size==='58'?'58mm':'80mm')} auto;margin:${size==='a4'?'12mm':'0'}}body{margin:0;padding:${size==='a4'?'0':'2mm 3mm'};width:${w};font:${size==='a4'?'13px/1.5 Arial,sans-serif':'12px/1.3 "Courier New",monospace'};color:#000;background:#fff}.c{text-align:center}.b{font-weight:700}.sm{font-size:${size==='a4'?'11px':'10px'}}.l{display:flex;justify-content:space-between;gap:8px;border-bottom:${size==='a4'?'1px solid #ccc':'1px dashed #999'};padding:2px 0}.l span:last-child{text-align:right}.qr svg{width:90px;height:90px}.sig{display:flex;justify-content:space-between;margin:${size==='a4'?'38px':'22px'} 0 8px;gap:8px}</style></head><body>${xfVoucherHTML(t,copy)}</body></html>`;}
function xfPrint(html){if(typeof window.print!=='function'||window.__noPrint){window.__lastXfer=html;return;}
 const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);f.contentDocument.open();f.contentDocument.write(html);f.contentDocument.close();
 setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){}setTimeout(()=>f.remove(),4000);},250);}
A.xferView=el=>{const t=xfTr(el.dataset.id);if(!t)return;const st=xferState(t),ev=xfEvs(t),b=xfBalance(t);
 modal('Boleta de movimiento '+(t.num||''),`<div class="card">${xfVoucherHTML(t,false)}</div>
 <h3 style="margin-top:.8rem">Recorrido</h3><ul class="sm"><li>${fmtDT(t.ts)} · emitido por ${esc(t.user)}, autoriza ${esc((t.auth||{}).name||'—')}</li>${ev.map(e=>`<li>${fmtDT(e.ts)} · ${esc(e.kind.replace(/_/g,' '))}${e.kind!=='anotado'?' · '+money(e.amt):''} · ${esc(e.user)}${e.nota?' · '+esc(e.nota):''}</li>`).join('')}${(S.transfers||[]).filter(x=>x.rev===t.id).map(x=>`<li>${fmtDT(x.ts)} · revertido por ${esc(x.num||'')}</li>`).join('')}</ul>
 <p class="sm mut">Enviado ${money(b.sent)} = recibido ${money(b.received)} + en tránsito ${money(b.transit)} + diferencia ${money(b.diff)} + devuelto ${money(b.returned)} ${b.ok?'✔':'<b class="neg">✘ no cierra</b>'}</p>
 <div class="row noprint">${typeof expBtn==='function'?expBtn('traspaso',t.id):''}<button class="btn" data-act="xferPrint" data-id="${t.id}" data-size="80">Imprimir 80 mm</button><button class="btn" data-act="xferPrint" data-id="${t.id}" data-size="58">Imprimir 58 mm</button><button class="btn" data-act="xferPrint" data-id="${t.id}" data-size="a4">Imprimir A4</button></div>`,
 {ok:false,cancelText:'Cerrar',wide:true});};
A.xferPrint=el=>{const t=xfTr(el.dataset.id);if(!t)return;xfPrint(xfPrintDoc(t,el.dataset.size,true));audit('TRASPASO_REIMPRESION',(t.num||t.id)+' · copia '+el.dataset.size);};
/* ---------- «Movimientos posteriores al cierre» (ficha del cierre; fuera de la foto sellada) ---------- */
function xfAfterList(c){const r=c.regId||'';if(!r)return[];const out=[];
 (S.transfers||[]).forEach(t=>{if(t.ts<=c.ts)return;if(t.v===2&&t.from===r&&t.fromState==='cerrada')out.push({ts:t.ts,dir:'Retiro posterior al cierre',amount:-t.amount,t});
  if(t.v===2&&t.to===r&&t.toState==='cerrada')out.push({ts:t.ts,dir:'Fondo hacia esta caja cerrada ('+XF_ST[xferState(t)]+')',amount:t.amount,t});});
 (S.transferEvents||[]).forEach(e=>{if(e.kind==='devuelto'&&!e.sess&&e.ts>c.ts){const t=xfTr(e.tid);if(t&&t.from===r)out.push({ts:e.ts,dir:'Devolución recibida',amount:e.amt,t});}});
 return out.sort((a,b)=>a.ts-b.ts);}
function xferAfterHTML(c){const L=xfAfterList(c);
 return`<h3 style="margin-top:.8rem">Movimientos posteriores al cierre</h3><p class="sm mut">Fuera de la foto sellada: el cierre y su sello no cambian.</p>${L.length?`<div class="tw"><table><tbody>${L.map(x=>`<tr><td>${fmtDT(x.ts)}</td><td>${esc(x.t.num||'')}</td><td>${esc(x.dir)}</td><td class="r ${x.amount<0?'neg':''}">${money(x.amount)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="sm mut">Sin movimientos posteriores.</p>'}`;}
/* ---------- pestaña «Traspasos» (registro con filtros) ---------- */
const xfF={from:'',to:'',br:'',emisor:'',auth:'',state:'',cajas:'',min:'',max:'',rubro:'',d0:'',d1:'',q:''};
function xfFiltered(){const f=xfF;const mn=f.min===''?null:cents(f.min),mx=f.max===''?null:cents(f.max);
 return(S.transfers||[]).filter(t=>{const st=xferState(t);
  if(f.from&&t.from!==f.from)return false;if(f.to&&t.to!==f.to)return false;
  if(f.br&&(((regOf(t.from)||{}).branchId||'')!==f.br&&((regOf(t.to)||{}).branchId||'')!==f.br))return false;
  if(f.emisor&&t.user!==f.emisor)return false;if(f.auth&&((t.auth||{}).name||'')!==f.auth)return false;
  if(f.state&&st!==f.state)return false;
  if(f.cajas==='cerrada'&&t.fromState!=='cerrada'&&t.toState!=='cerrada')return false;if(f.cajas==='abiertas'&&(t.fromState==='cerrada'||t.toState==='cerrada'))return false;
  if(mn!==null&&!isNaN(mn)&&t.amount<mn)return false;if(mx!==null&&!isNaN(mx)&&t.amount>mx)return false;
  if(f.rubro&&t.rubro!==f.rubro)return false;
  if(f.d0&&dkey(t.ts)<f.d0)return false;if(f.d1&&dkey(t.ts)>f.d1)return false;
  if(f.q){const q=f.q.toLowerCase();if(!(String(t.num||'')+' '+(t.motivo||'')+' '+(t.user||'')).toLowerCase().includes(q))return false;}
  return true;}).slice().reverse();}
function xfAlerts(){const A2=[];const T=S.transfers||[];const cfg=xfCfg();
 if(cfg.transitAlertH>0)T.forEach(t=>{if(xferState(t)==='en_transito'&&now()-t.ts>cfg.transitAlertH*3600000)A2.push(`${t.num||t.id.slice(0,8)} sigue en tránsito hace más de ${cfg.transitAlertH} h (${money(t.amount)})`);});
 T.forEach(t=>{if(xferState(t)==='recibido_con_diferencia'){const rc=xfRecvEv(t);A2.push(`${t.num||t.id.slice(0,8)} se recibió con diferencia de ${money(t.amount-(rc?rc.amt:0))}`);}
  if(t.tss&&Math.abs(t.tss-t.ts)>600000)A2.push(`${t.num||t.id.slice(0,8)}: hora del equipo desfasada respecto del servidor`);
  const b=xfBalance(t);if(!b.ok)A2.push(`${t.num||t.id.slice(0,8)}: el balance enviado/recibido no cierra`);});
 const by={};T.forEach(t=>{if(t.v===2&&t.n){(by[t.from]=by[t.from]||[]).push(t.n);}});
 Object.entries(by).forEach(([r,ns])=>{const mx=Math.max(...ns);for(let i=1;i<=mx;i++)if(!ns.includes(i))A2.push(`Falta el comprobante T-${(regOf(r)||{}).code||'?'}-${i} (hueco en la numeración de ${regName(r)})`);});
 return A2;}
function xfRegistryHTML(){const L=xfFiltered();const all=S.transfers||[];
 const sum=a=>a.reduce((x,t)=>x+t.amount,0);const real=L.filter(t=>!t.rev&&xferState(t)!=='revertido');
 const tran=L.filter(t=>xferState(t)==='en_transito'),dif=L.filter(t=>xferState(t)==='recibido_con_diferencia');
 const alerts=xfAlerts();
 const users=[...new Set(all.map(t=>t.user).filter(Boolean))],auths=[...new Set(all.map(t=>(t.auth||{}).name).filter(Boolean))];
 const sel=(k,opts)=>`<select data-xff="${k}" aria-label="${k}"><option value="">Todos</option>${opts.map(o=>`<option value="${esc(o[0])}" ${xfF[k]===o[0]?'selected':''}>${esc(o[1])}</option>`).join('')}</select>`;
 const regsO=(S.registers||[]).map(r=>[r.id,r.name]);
 return`<div class="card"><h3>Filtros</h3><div class="grid g4 xff">
 <div><label>Desde</label><input type="date" data-xff="d0" value="${esc(xfF.d0)}"></div><div><label>Hasta</label><input type="date" data-xff="d1" value="${esc(xfF.d1)}"></div>
 <div><label>Caja origen</label>${sel('from',regsO)}</div><div><label>Caja destino</label>${sel('to',regsO)}</div>
 ${brOn()?`<div><label>Sucursal</label>${sel('br',(S.branches||[]).map(b=>[b.id,b.name]))}</div>`:''}
 <div><label>Emisor</label>${sel('emisor',users.map(u=>[u,u]))}</div><div><label>Autorizante</label>${sel('auth',auths.map(u=>[u,u]))}</div>
 <div><label>Estado</label>${sel('state',Object.entries(XF_ST))}</div><div><label>Estado de las cajas</label>${sel('cajas',[['cerrada','Alguna cerrada'],['abiertas','Ambas abiertas']])}</div>
 <div><label>Importe mín. ($)</label><input data-xff="min" inputmode="decimal" placeholder="0" value="${esc(xfF.min)}"></div><div><label>Importe máx. ($)</label><input data-xff="max" inputmode="decimal" placeholder="0" value="${esc(xfF.max)}"></div>
 <div><label>Rubro</label>${sel('rubro',S.rubros.filter(r=>r.kind==='rubro').map(r=>[r.id,r.name]))}</div><div><label>Buscar</label><input data-xff="q" placeholder="N.º, concepto o usuario" value="${esc(xfF.q)}" autocomplete="off"></div></div>
 <div class="row"><button class="btn sm" data-act="xffReset">Restablecer</button>${expBar('traspasos')}</div></div>
 ${alerts.length?`<div class="card warnbox" style="margin-top:1rem" role="status"><b>Alertas de traspasos</b><ul class="sm">${alerts.slice(0,12).map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div>`:''}
 <div class="grid g4" style="margin-top:1rem"><div class="card kpi"><b>${real.length}</b><span>Traspasos (sin reversas)</span></div><div class="card kpi"><b>${money(sum(real))}</b><span>Importe movido</span></div><div class="card kpi"><b>${tran.length?money(sum(tran)):'—'}</b><span>En tránsito (${tran.length})</span></div><div class="card kpi"><b class="${dif.length?'neg':''}">${dif.length}</b><span>Con diferencia</span></div></div>
 <div class="card" style="margin-top:1rem"><div class="tw"><table id="xf-tbl"><thead><tr><th>N.º</th><th>Fecha</th><th>Origen</th><th>Destino</th><th class="r">Importe</th><th>Rubro</th><th>Emisor</th><th>Autoriza</th><th>Cajas</th><th>Estado</th><th></th></tr></thead><tbody>${L.map(t=>{const st=xferState(t);const au=t.auth||{};
  return`<tr><td>${esc(t.num||'(sin n.º)')}${t.rev?' <span class="tag warn">reversa</span>':''}</td><td data-sv="${t.ts}">${fmtDT(t.ts)}</td><td>${esc(t.fromName||regName(t.from))}</td><td>${esc(t.toName||regName(t.to))}</td><td class="r">${money(t.amount)}</td><td>${esc(t.rubroName||'')}</td><td>${esc(t.user||'')}</td><td>${esc(au.name||'—')}<br><span class="sm mut">${esc(XF_METH[au.method]||'')}</span></td><td class="sm">${t.v===2?esc(t.fromState)+' → '+esc(t.toState):'abiertas'}</td><td><span class="tag ${XF_TAG[st]}">${esc(XF_ST[st])}</span></td>
  <td class="r"><button class="btn sm" data-act="xferView" data-id="${t.id}">Boleta</button> ${st==='en_transito'&&xfCan()?`<button class="btn sm gold" data-act="xferRecv" data-id="${t.id}">Recibir</button> <button class="btn sm" data-act="xferRet" data-id="${t.id}">Devolver</button>`:''} ${xfCan()?`<button class="btn sm" data-act="xferNote" data-id="${t.id}">Nota</button>`:''} ${can('config')&&!t.rev&&st!=='revertido'&&st!=='en_transito'&&st!=='devuelto'?`<button class="btn sm" data-act="xferRev" data-id="${t.id}">Revertir</button>`:''}</td></tr>`;}).join('')||'<tr><td colspan="11" class="mut">Sin traspasos con esos filtros.</td></tr>'}</tbody></table></div>
 <p class="sm mut">Un traspaso es un movimiento interno: no es venta, ingreso ni egreso. Enviado = recibido + en tránsito + diferencias + devuelto. Actualizado ${fmtDT(now())}.</p></div>`;}
function xfRefresh(){const b=$('#xf-reg');if(b)b.innerHTML=xfRegistryHTML();}
document.addEventListener('input',e=>{const k=e.target&&e.target.dataset&&e.target.dataset.xff;if(!k)return;xfF[k]=e.target.value;
 const pos=e.target.selectionStart;xfRefresh();const again=document.querySelector('[data-xff="'+k+'"]');if(again&&e.target.tagName==='INPUT'&&e.target.type!=='date'){again.focus();try{again.setSelectionRange(pos,pos);}catch(_){}}});
document.addEventListener('change',e=>{const k=e.target&&e.target.dataset&&e.target.dataset.xff;if(!k||e.target.tagName!=='SELECT'&&e.target.type!=='date')return;xfF[k]=e.target.value;xfRefresh();});
A.xffReset=()=>{Object.keys(xfF).forEach(k=>xfF[k]='');xfRefresh();};
EXPORTS.traspasos={t:'Traspasos de fondos entre cajas',perm:'close_cash',h:()=>['numero','fecha','origen','estado_caja_origen','destino','estado_caja_destino','importe','moneda','rubro','concepto','emisor','autorizante','metodo_autorizacion','estado','recibido','diferencia'],
 rows:()=>(S.transfers||[]).map(t=>{const rc=xfRecvEv(t);return[t.num||'',fmtDT(t.ts),t.fromName||regName(t.from),t.fromState||'abierta',t.toName||regName(t.to),t.toState||'abierta',t.amount/100,t.cur||'ARS',t.rubroName||'',t.motivo,t.user,(t.auth||{}).name||'',(t.auth||{}).method||'',XF_ST[xferState(t)],rc?rc.amt/100:'',rc?(t.amount-rc.amt)/100:''];})};
/* ---------- aviso de permisos (primer ingreso del administrador tras actualizar) ---------- */
let xfNoticeShown=false;
function xfPermNotice(){if(xfNoticeShown||!user||!can('config'))return;const pn=S.cfg&&S.cfg.permNotice;if(!pn||pn.ack)return;xfNoticeShown=true;
 const roles=Object.entries(S.roles).filter(([r,a])=>r!=='admin'&&Array.isArray(a)&&a.includes('close_cash')&&!a.includes('transfer_funds')).map(([r])=>r);
 modal('Nuevos permisos de seguridad',`<p>Esta versión agrega permisos que antes no existían: <b>${esc(PERMS.transfer_funds)}</b> y <b>${esc(PERMS.customers_admin)}</b>. <b>Nada se otorgó automáticamente.</b></p>
 <p>Hasta ahora, quien tenía «Arqueo y cierre de caja» podía traspasar fondos. ${roles.length?`Los roles que lo tenían son: <b>${roles.map(esc).join(', ')}</b>.`:'Ningún otro rol lo tenía.'}</p>
 <p class="sm mut">Si no hacés nada, a partir de ahora sólo el administrador traspasa fondos y administra clientes (los datos sensibles, la baja y la eliminación). Podés cambiarlo cuando quieras en <b>Usuarios y permisos</b>.</p>`,
 {okText:roles.length?'Otorgar a los roles que ya traspasaban':'Entendido',cancelText:'Entendido, no otorgar',onOk:()=>{
  if(roles.length){roles.forEach(r=>{S.roles[r].push('transfer_funds');audit('PERMISO_OTORGADO','transfer_funds → rol '+r+' · aviso de actualización');});}
  S.cfg.permNotice={ack:true,by:user.name,ts:now(),granted:roles.length?roles:[]};S.cfg.xfer=Object.assign({},XF_DEF,S.cfg.xfer||{},{strict:true});audit('PERMISOS_AVISO',roles.length?'otorgado a: '+roles.join(', '):'sin otorgar');save();rerender();}});
 /* «Entendido, no otorgar»: también deja constancia y enciende la bandera */
 const o=$$('#modal-root .ov');const w=o[o.length-1];const x=w&&w.querySelector('[data-m="x"]');
 if(x)x.addEventListener('click',()=>{S.cfg.permNotice={ack:true,by:user.name,ts:now(),granted:[]};S.cfg.xfer=Object.assign({},XF_DEF,S.cfg.xfer||{},{strict:true});audit('PERMISOS_AVISO','sin otorgar');save();rerender();},true);}
/* ---------- configuración (tarjeta en Cajas y sucursales, sólo administrador) ---------- */
function xfCfgCard(){const c=xfCfg();if(!can('config'))return'';
 return`<div class="card" style="margin-top:1rem"><h3>Traspasos de fondos · reglas</h3>
 <label class="chk"><input type="checkbox" id="xc-s" ${c.strict?'checked':''}> Exigir el permiso «${esc(PERMS.transfer_funds)}» (si está apagado, basta con «Arqueo y cierre de caja» y sólo se traspasa entre cajas abiertas)</label>
 <label for="xc-m">Si la caja destino está cerrada</label><select id="xc-m"><option value="transito" ${c.closedMode==='transito'?'selected':''}>Dejar el fondo «en tránsito» hasta que se reciba (recomendado)</option><option value="saldo_inicial" ${c.closedMode==='saldo_inicial'?'selected':''}>Incluirlo en el saldo inicial sugerido del próximo turno</option></select>
 <label for="xc-o">Pedir autorización de un administrador si el importe supera ($, vacío = nunca)</label>${numIn('xc-o',c.approvalOver,'Sin límite')}
 <label for="xc-h">Alerta de fondos en tránsito después de (horas, vacío = sin alerta)</label><input id="xc-h" inputmode="numeric" placeholder="Sin alerta" value="${c.transitAlertH?c.transitAlertH:''}" autocomplete="off">
 <label class="chk"><input type="checkbox" id="xc-a" ${c.selfAuth?'checked':''}> Con más de un administrador, permitir que uno se autorice a sí mismo</label>
 <div class="row"><button class="btn gold" data-act="xfCfgSave">Guardar reglas</button></div></div>`;}
A.xfCfgSave=()=>{if(!can('config'))return toast('Sólo el administrador',1);const o=cents(val('xc-o')),h=parseInt(val('xc-h'),10);
 const n={strict:$('#xc-s').checked,closedMode:val('xc-m')==='saldo_inicial'?'saldo_inicial':'transito',approvalOver:isNaN(o)||o<0?0:o,transitAlertH:isNaN(h)||h<0?0:h,selfAuth:$('#xc-a').checked};
 const old=xfCfg();S.cfg.xfer=n;audit('TRASPASO_REGLAS','estricto '+old.strict+'→'+n.strict+' · cerradas '+old.closedMode+'→'+n.closedMode+' · supera '+money(old.approvalOver)+'→'+money(n.approvalOver)+' · alerta '+old.transitAlertH+'→'+n.transitAlertH+' h · autoautorización '+old.selfAuth+'→'+n.selfAuth);save();rerender();toast('Reglas guardadas');};
