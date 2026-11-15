/* ===== V26.8 · 4.24.3 / 4.24.4 Clientes del Club: edición, baja y eliminación por el administrador =====
   Un solo registro de clientes (S.customers). La baja anonimiza y conserva lo contable; la eliminación definitiva sólo existe
   para un cliente SIN historial y SIN deuda. El servidor (rave_puede_escribir, migración 11) vuelve a validar todo esto. */
const custAdm=()=>!!user&&(can('config')||can('customers_admin'));
/* V26.20: dar de baja o eliminar socios es SÓLO del rol administrador (no se delega con permisos) */
const custDelAdm=()=>!!user&&user.role==='admin';
const maskTail=(v,n)=>{v=String(v==null?'':v).replace(/\s/g,'');return v?'…'+v.slice(-(n||3)):'(vacío)';};
/* huella de los datos sensibles: viaja en claro (no es reversible) para que el servidor detecte que un no administrador los cambió */
function custPfp(c){return cyrb(canon([normWA(c.wa||''),String(c.email||'').toLowerCase(),String(c.dni||''),String(c.birth||''),String(c.taxid||'')]));}
/* qué impide eliminar a un cliente (mismo criterio que el servidor) */
function custHistory(c){const id=c.id,h=[];
 if(S.sales.some(s=>s.cust===id))h.push('ventas');
 if(S.fiadoPays.some(p=>p.cust===id))h.push('cuenta corriente');
 if(S.coupons.some(cp=>(cp.uses||[]).some(u=>u.cust===id)))h.push('cupones usados');
 if((S.members||[]).some(m=>m.cust===id))h.push('membresías');
 if(S.loyalty.ledger.some(e=>e.cust===id))h.push('sellos o canjes');
 if((S.agreements||[]).some(a=>a.cust===id)||(S.creditOv||[]).some(o=>o.cust===id))h.push('excepciones o acuerdos');
 return h;}
/* alta pendiente del menú con el mismo WhatsApp/tarjeta: no debe reaparecer al importarse */
function clubBlockList(){if(!Array.isArray(S.cfg.clubBlock))S.cfg.clubBlock=[];return S.cfg.clubBlock;}
const clubKeyWA=w=>'w:'+sha256('wa|'+w).slice(0,20);
const clubKeyCard=id=>'c:'+String(id).slice(0,40);
function clubBlockAdd(c){const L=clubBlockList();const w=normWA(c.wa||'');const add=k=>{if(!L.includes(k))L.push(k);};
 if(w)add(clubKeyWA(w));add(clubKeyCard(c.id));(c.cards||[]).forEach(x=>add(clubKeyCard(x)));while(L.length>2000)L.shift();}
function clubBlocked(w,cid){const L=clubBlockList();return (!!w&&L.includes(clubKeyWA(w)))||(!!cid&&L.includes(clubKeyCard(cid)));}
async function clubRejectPending(w,cardIds){
 try{if(typeof CLOUD==='undefined'||!CLOUD.on||!cl.ready||!cl.clubPriv||!cl.clubPriv.jwk||!cl.online)return 0;
  const rows=await sel(`club_altas?select=id,cifrado&comercio_id=eq.${cl.comercio.id}&estado=eq.nueva&order=id&limit=200`);const ids=[];
  for(const r of rows){let p;try{p=await rsaOpen(cl.clubPriv.jwk,r.cifrado);}catch(e){continue;}
   if((w&&normWA(p.wa)===w)||(p.cid&&cardIds.includes(p.cid)))ids.push(r.id);}
  if(ids.length){await rpc('club_altas_marcar',{p_comercio:cl.comercio.id,p_ids:ids,p_estado:'rechazada'});audit('CLUB_ALTA_RECHAZADA',ids.length+' alta(s) pendiente(s) del menú: cliente eliminado o dado de baja por el administrador');}
  return ids.length;}catch(e){return 0;}}
/* efectos en cadena: la tarjeta deja de validar (QR, código de 8 dígitos y NFC) y se lo excluye de campañas */
function custRevoke(c){c.secret=uid()+uid();c.cards=[];c.cardSecrets={};c.consent=Object.assign({},c.consent,{comm:false,analytics:false,ts:now()});}

function custBlockers(c){const h=custHistory(c),d=debtOf(c.id);return{hist:h,debt:d,canDelete:!h.length&&d<=0};}

/* ---------- baja (anonimizar) ---------- */
A.cuBaja=el=>{const c=custById(el.dataset.id);if(!c)return;
 if(!custDelAdm())return toast('La baja de un cliente la hace sólo el administrador.',1);
 const n=pad4(c.num),d=debtOf(c.id);
 modal('Baja del cliente · socio N.º '+n,`<p>Se borran nombre, apellido, WhatsApp, correo, nacimiento y DNI, se revoca la tarjeta (QR, código y NFC dejan de validar) y se lo excluye de campañas. <b>Las ventas, la cuenta corriente y los comprobantes se conservan</b> con su identificador interno.</p>
 ${d>0?`<div class="warnbox"><b>Tiene deuda de ${money(d)}.</b> Elegí qué hacer:<label class="chk"><input type="radio" name="bj-d" value="cobrar"> Cobrar primero (abre el cobro y vuelve a esta baja)</label><label class="chk"><input type="radio" name="bj-d" value="condonar"> Condonar con un movimiento compensatorio y motivo</label><label class="chk"><input type="radio" name="bj-d" value="mantener"> Mantener la deuda asociada al registro anonimizado (queda en «Deudas de clientes dados de baja»)</label></div>`:''}
 <label for="bj-m">Motivo (obligatorio, sin datos personales)</label><input id="bj-m" maxlength="100" autocomplete="off">
 <label for="bj-n">Para confirmar escribí el N.º de socio: <b>${n}</b></label><input id="bj-n" inputmode="numeric" maxlength="6" autocomplete="off">`,
 {okText:'Dar de baja',onOk:w=>{const mot=val('bj-m').trim();if(mot.length<5)return w._err('Escribí el motivo (mínimo 5 letras).'),false;
  if(val('bj-n').trim().replace(/^0+/,'')!==String(c.num))return w._err('El N.º de socio no coincide: la baja necesita esa confirmación.'),false;
  let dec='';if(d>0){const r=w.querySelector('input[name=bj-d]:checked');if(!r)return w._err('Elegí qué hacer con la deuda de '+money(d)+'.'),false;dec=r.value;
   if(dec==='cobrar'){setTimeout(()=>{A.cuPay({dataset:{id:c.id}});},60);return;}
   if(dec==='condonar'){S.fiadoPays.push({id:uid(),cust:c.id,ts:now(),amount:d,method:'condonado',user:user.name,mov:'',rubro:'cobr',reason:mot});audit('DEUDA_CONDONADA','socio '+n+' · '+money(d)+' · movimiento compensatorio · '+mot);c.debtDec={mode:'mantener',reason:'condonada: '+mot,by:user.name,ts:now()};}
   else c.debtDec={mode:'mantener',reason:mot,by:user.name,ts:now()};}
  const w0=normWA(c.wa||''),cards=[c.id].concat(c.cards||[]);
  clubBlockAdd(c);custRevoke(c);c.status='baja';c.name='Socio';c.last='N.º '+n;c.wa='';c.email='';c.birth='';c.dni='';c.taxid='';c.notes='';
  audit('BAJA_CLIENTE','socio '+n+' · motivo: '+mot+(d>0?' · deuda '+money(d)+' → '+dec:''));
  save();pubRefresh();clubRejectPending(w0,cards);$$('#modal-root .ov').forEach(o=>o!==w&&o.remove());rerender();toast('Cliente dado de baja');}});};

/* ---------- eliminación definitiva (V26.25: el administrador puede borrar socios aunque tengan historial) ----------
   Sin historial: se borra el registro. Con historial (sin nube): también se borra; las ventas y comprobantes quedan con el
   nombre que figuraba en el ticket; se borran tarjeta, sellos pendientes, membresías y acuerdos. La deuda se cobra o se condona antes.
   Con nube: el servidor (migración 11) todavía sólo admite borrar sin historial; con historial se ofrece la baja. */
const custDelHistOk=()=>!(typeof CLOUD!=='undefined'&&CLOUD.on);
/* V26.25b · con nube y con historial: el servidor (migración 11) no deja borrar el registro, pero sí actualizarlo.
   Se borran todos los datos personales, se revoca la tarjeta y queda marcado «elim»: desaparece de Clientes, Fidelización,
   búsquedas y campañas en todos los equipos. Ventas y comprobantes se conservan (no se pueden borrar). */
function custPurge(c,mot){const n=pad4(c.num),w0=normWA(c.wa||''),cards=[c.id].concat(c.cards||[]);clubBlockAdd(c);custRevoke(c);
 c.status='baja';c.elim=1;c.elimTs=now();c.name='Socio';c.last='N.º '+n+' (eliminado)';c.wa='';c.email='';c.birth='';c.dni='';c.taxid='';c.notes='';c.limit=0;
 if(!c.debtDec)c.debtDec={mode:'mantener',reason:'eliminado: '+mot,by:user.name,ts:now()};
 (S.delCust=S.delCust||{})[c.id]=n;audit('CLIENTE_ELIMINADO','socio '+n+' · con historial (datos personales borrados; ventas y comprobantes conservados) · motivo: '+mot);save();pubRefresh();clubRejectPending(w0,cards);}
function custDelete(c,mot){const n=pad4(c.num),w0=normWA(c.wa||''),cards=[c.id].concat(c.cards||[]);clubBlockAdd(c);
 S.members=(S.members||[]).filter(m=>m.cust!==c.id);S.agreements=(S.agreements||[]).filter(a=>a.cust!==c.id);
 S.customers=S.customers.filter(x=>x.id!==c.id);(S.delCust=S.delCust||{})[c.id]=pad4(c.num);
 audit('CLIENTE_ELIMINADO','socio '+n+' · motivo: '+mot);save();pubRefresh();clubRejectPending(w0,cards);}
A.cuDel=el=>{const c=custById(el.dataset.id);if(!c)return;
 if(!custDelAdm())return toast('La eliminación de un cliente la hace sólo el administrador.',1);
 const B=custBlockers(c),n=pad4(c.num),hist=B.hist.length>0;
 modal('Eliminar definitivamente · socio N.º '+n,`<p>Se borra <b>${esc(custFull(c))}</b> de la lista de clientes y socios. No se puede deshacer (sólo desde un respaldo).</p>
 ${hist?`<div class="warnbox sm"><b>Tiene historial:</b> ${esc(B.hist.join(', '))}. Las ventas y los comprobantes <b>se conservan</b> (figuran con el nombre del ticket); se borran su tarjeta, sus sellos, membresías y acuerdos.</div>`:'<p class="sm mut">No tiene ventas, cuenta corriente, cupones, membresías ni sellos.</p>'}
 ${B.debt>0?`<div class="warnbox"><b>Tiene deuda de ${money(B.debt)}.</b><label class="chk"><input type="radio" name="dl-d" value="cobrar"> Cobrar primero (abre el cobro)</label><label class="chk"><input type="radio" name="dl-d" value="condonar"> Condonar la deuda (movimiento compensatorio con el motivo) y eliminar</label></div>`:''}
 <label for="dl-m">Motivo (obligatorio, sin datos personales)</label><input id="dl-m" maxlength="100" autocomplete="off">
 <label for="dl-n">Para confirmar escribí el N.º de socio: <b>${n}</b></label><input id="dl-n" inputmode="numeric" maxlength="6" autocomplete="off">`,
 {okText:'Eliminar',onOk:w=>{const mot=val('dl-m').trim();if(mot.length<5)return w._err('Escribí el motivo (mínimo 5 letras).'),false;
  if(val('dl-n').trim().replace(/^0+/,'')!==String(c.num))return w._err('El N.º de socio no coincide.'),false;
  const d=debtOf(c.id);if(d>0){const r=w.querySelector('input[name=dl-d]:checked');if(!r)return w._err('Elegí qué hacer con la deuda de '+money(d)+'.'),false;
   if(r.value==='cobrar'){setTimeout(()=>{A.cuPay({dataset:{id:c.id}});},60);return;}
   S.fiadoPays.push({id:uid(),cust:c.id,ts:now(),amount:d,method:'condonado',user:user.name,mov:'',rubro:'cobr',reason:mot});audit('DEUDA_CONDONADA','socio '+n+' · '+money(d)+' · movimiento compensatorio · '+mot);c.debtDec={mode:'mantener',reason:'condonada: '+mot,by:user.name,ts:now()};}
  if(custBlockers(c).hist.length&&!custDelHistOk())custPurge(c,mot);else custDelete(c,mot);$$('#modal-root .ov').forEach(o=>o!==w&&o.remove());rerender();toast('Socio eliminado');}});};

/* ---------- fusión: el WhatsApp ya es de otro socio ---------- */
function custMergePreview(src,dst){const st=stampsOf(src.id);return `<div class="grid g2"><div class="card"><b>Se da de baja</b><br>Socio N.º ${pad4(src.num)} · ${esc(custFull(src))}<br><span class="sm">${st} sello(s) · ${(src.cards||[]).length+1} tarjeta(s) · deuda ${money(debtOf(src.id))}</span></div>
 <div class="card"><b>Queda activo</b><br>Socio N.º ${pad4(dst.num)} · ${esc(custFull(dst))}<br><span class="sm">${stampsOf(dst.id)} sello(s) → ${stampsOf(dst.id)+st} · recibe las tarjetas del otro</span></div></div>`;}
function custMergeInto(src,dst,motivo){
 const st=stampsOf(src.id);
 if(st!==0){S.loyalty.ledger.push({id:uid(),cust:dst.id,ts:now(),kind:'adjust',n:st,ref:'fusión desde socio N.º '+pad4(src.num),user:user.name});S.loyalty.ledger.push({id:uid(),cust:src.id,ts:now(),kind:'adjust',n:-st,ref:'fusión hacia socio N.º '+pad4(dst.num),user:user.name});}
 dst.cards=Array.isArray(dst.cards)?dst.cards:[];dst.cardSecrets=dst.cardSecrets||{};
 [src.id].concat(src.cards||[]).forEach(id=>{if(cardIdOk(id)&&id!==dst.id&&!dst.cards.includes(id)){dst.cards.push(id);dst.cardSecrets[id]=(src.cardSecrets&&src.cardSecrets[id])||src.secret;}});
 const n=pad4(src.num);clubBlockAdd(Object.assign({},src,{wa:'',cards:[]}));custRevoke(src);
 src.status='baja';src.name='Socio';src.last='N.º '+n;src.wa='';src.email='';src.birth='';src.dni='';src.taxid='';src.notes='';src.mergedInto=dst.id;
 audit('CLIENTES_FUSIONADOS','socio '+n+' → socio '+pad4(dst.num)+' · '+st+' sello(s) · '+motivo);}
