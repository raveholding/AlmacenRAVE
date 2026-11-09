/* ===== V26.60 · CRM omnicanal (Clientes y fidelización → Conversaciones) =====
   · Bandeja única: cada conversación ligada a la ficha del cliente, con panel del ERP (nivel, sellos, monedero, deuda, compras,
     presupuestos y turnos), notas internas (el cliente nunca las ve), respuestas rápidas, etiquetas, asignación y estados.
   · Canales reales sin costo: chat web del menú público (cifrado de punta a punta: el servidor no lee los mensajes) y WhatsApp
     asistido (se abre wa.me con el texto; el envío lo confirma la persona en WhatsApp). Teléfono y «en el local» se registran a mano.
   · Demos de Vincular Business (no el cliente): además Instagram, Messenger, Telegram y correo como canales DE DEMOSTRACIÓN
     (mensajes de ejemplo; para recibirlos de verdad hay que conectar la cuenta de cada comercio), acción rápida de turno y
     avisos de turno. El asistente es POR REGLAS (sin IA paga): prioridad, ánimo, intención, respuestas sugeridas y resumen.
   · Cobro asistido: manda alias/CBU y el total; NO mueve caja: el cobro se registra en Vender/Caja cuando llega.
   · Sin el texto de los mensajes en Auditoría. Las colecciones conv y cmsg necesitan 22-crm.sql en la nube. */
IC.chat='M21 12a8 8 0 0 1-11.7 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z';
const CRM_FULL=!IS_CLIENT;
const CHAN={web:'Chat web',wa:'WhatsApp',ig:'Instagram',fb:'Messenger',tg:'Telegram',mail:'Correo',tel:'Teléfono',local:'En el local'};
const CHAN_IC={web:'💬',wa:'🟢',ig:'📸',fb:'🔵',tg:'✈️',mail:'✉️',tel:'📞',local:'🏪'};
const CHAN_DEMO=['ig','fb','tg','mail']; // sin conexión real: sólo para mostrar en las demos
const CST={abierta:'Abierta',pendiente:'Esperando al cliente',resuelta:'Resuelta'};
const CRM_CANNED=[{t:'Saludo',x:'¡Hola {nombre}! Gracias por escribirnos. ¿En qué te podemos ayudar?'},
 {t:'Horario',x:'Hola {nombre}, estamos abiertos de lunes a sábado. ¡Te esperamos!'},
 {t:'Pedido listo',x:'Hola {nombre}, tu pedido ya está listo para retirar. ¡Gracias!'},
 {t:'Consultando',x:'Dame un minuto {nombre}, lo consulto y te confirmo.'},
 {t:'Gracias',x:'¡Gracias {nombre}! Cualquier cosa nos escribís por acá.'}];
const CRM_DEF={on:CRM_FULL,web:true,chans:CRM_FULL?Object.keys(CHAN):['web','wa','tel','local'],greet:'¡Hola! Escribinos y te respondemos por acá.',
 words:'reclamo,urgente,problema,devolucion,queja,no funciona,mal estado,vencido,roto,estafa,cancelar',waitMin:30,turnos:CRM_FULL,canned:CRM_CANNED,pay:{alias:'',cbu:'',holder:''}};
const crmCfg=()=>{const c=(S.cfg&&S.cfg.crm)||{};const o=Object.assign({},CRM_DEF,c);o.pay=Object.assign({},CRM_DEF.pay,c.pay||{});if(!Array.isArray(o.canned))o.canned=CRM_CANNED;if(!Array.isArray(o.chans))o.chans=CRM_DEF.chans;if(!CRM_FULL){o.chans=o.chans.filter(k=>!CHAN_DEMO.includes(k));o.turnos=false;}return o;};
function crmSet(v){S.cfg.crm=Object.assign({},(S.cfg.crm||{}),v);}
const convs=()=>S.convs||(S.convs=[]);const cmsgs=()=>S.cmsgs||(S.cmsgs=[]);
const convById=id=>convs().find(c=>c.id===id)||null;
const convMsgs=id=>cmsgs().filter(m=>m.conv===id).sort((a,b)=>a.ts-b.ts||String(a.id).localeCompare(String(b.id)));
const crmNorm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const crmTxt=t=>String(t==null?'':t).replace(/\r/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim().slice(0,1500);
const crmHm=ts=>{const d=new Date(ts);return d.toLocaleDateString('es-AR',{day:'numeric',month:'numeric'})+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});};
const crmFirst=c=>{const cu=c&&c.cust?custById(c.cust):null;return String((cu&&cu.name)||(c&&c.name)||'').trim().split(/\s+/)[0]||'';};
const crmWho=c=>{const cu=c.cust?custById(c.cust):null;return cu?custFull(cu):(c.name||'Sin nombre');};
const crmWa=c=>{const cu=c.cust?custById(c.cust):null;if(cu&&waOk(cu))return waDigits(cu);const d=String(c.wa||'').replace(/\D/g,'');return /^549\d{10}$/.test(d)?d:'';};
function crmNew(f){const c={id:f.id||('c'+uid()),chan:f.chan,cust:f.cust||'',name:String(f.name||'').replace(/[<>]/g,'').slice(0,60),wa:String(f.wa||'').slice(0,20),k:f.k||'',
 state:'abierta',asg:f.asg||'',tags:Array.isArray(f.tags)?f.tags:[],ts:f.ts||now(),last:f.ts||now(),lastIn:0,lastOut:0,lastTxt:'',unread:false,appts:[],asked:0};convs().push(c);return c;}
function crmAdd(c,dir,text,extra){const m=Object.assign({id:'m'+uid(),conv:c.id,dir,text:crmTxt(text),ts:now(),user:dir==='in'?'cliente':(user?user.name:'sistema'),chan:c.chan,kind:'msg'},extra||{});
 if(cmsgs().some(x=>x.id===m.id))return null;cmsgs().push(m);if(m.ts>=(c.last||0))c.last=m.ts;
 if(dir==='in'){c.lastIn=m.ts;c.unread=true;if(c.state!=='abierta')c.state='abierta';}
 if(dir==='out'){c.lastOut=m.ts;c.unread=false;}
 if(dir==='in'||dir==='out')c.lastTxt=(dir==='out'?'Vos: ':'')+m.text.slice(0,80);return m;}

/* ---------- asistente por reglas (sin IA): prioridad, ánimo, intención, respuestas sugeridas y resumen ---------- */
const CRM_NEG=['reclamo','queja','mal','malo','pesimo','horrible','nunca','enojado','roto','vencido','demora','problema','no funciona','estafa','devolver','devolucion','cancelar','urgente','harto'];
const CRM_POS=['gracias','genial','excelente','buenisimo','perfecto','joya','barbaro','me encanto','buena atencion','10 puntos','espectacular'];
const CRM_INT=[['precio','Consulta de precio',['precio','cuanto sale','cuanto cuesta','cuanto esta','valor','sale el','cuesta']],['stock','Consulta de stock',['tenes','tienen','hay ','stock','queda','les queda']],
 ['pedido','Pedido o compra',['quiero','pedido','encargar','me guardas','reservar','para llevar','envio','delivery']],['horario','Horario',['horario','abren','cierran','abierto','hasta que hora']],
 ['pago','Pago',['pagar','transferencia','alias','cbu','tarjeta','mercado pago','comprobante','pague']],['turno','Turno o reserva',['turno','cita','agenda','reserva para','hora para']],
 ['reclamo','Reclamo',['reclamo','queja','problema','devolver','devolucion','no funciona','mal estado','vencido','roto']]];
const crmHas=(t,w)=>new RegExp('(^|[^a-z0-9])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^a-z0-9])').test(t);
function crmSent(text){const t=crmNorm(text);let s=0;CRM_NEG.forEach(w=>{if(crmHas(t,w))s--;});CRM_POS.forEach(w=>{if(crmHas(t,w))s++;});if(/!{2,}|\?{3,}/.test(text||''))s--;return s<0?'neg':s>0?'pos':'neu';}
function crmIntent(text){const t=' '+crmNorm(text)+' ';const r=CRM_INT.find(([,,ws])=>ws.some(w=>t.includes(w)));return r?{k:r[0],t:r[1]}:null;}
function crmProdsIn(text){const t=crmNorm(text);if(t.length<3)return[];
 const L=S.products.filter(p=>p.active&&!p.archived).map(p=>{const ws=[...new Set(crmNorm(p.name).split(/[^a-z0-9]+/).filter(w=>w.length>=4))];const hit=ws.filter(w=>crmHas(t,w)).length;return{p,hit,need:Math.min(2,ws.length),r:ws.length?hit/ws.length:0};})
  .filter(x=>x.need>0&&x.hit>=x.need).sort((a,b)=>b.hit-a.hit||b.r-a.r);return L.filter(x=>x.hit===(L[0]||{}).hit).slice(0,3).map(x=>x.p);}
function crmPrio(c){const C=crmCfg();const why=[];if(c.state==='resuelta')return{lv:'baja',why};
 const ins=convMsgs(c.id).filter(m=>m.dir==='in');const last=ins[ins.length-1];
 const words=C.words.split(',').map(w=>crmNorm(w).trim()).filter(Boolean);const hit=last&&words.find(w=>crmNorm(last.text).includes(w));
 if(hit)why.push('dice «'+hit+'»');if(last&&crmSent(last.text)==='neg'&&!hit)why.push('mensaje molesto');
 const wait=c.unread&&c.lastIn?Math.floor((now()-c.lastIn)/60000):0;if(wait>=C.waitMin)why.push('espera '+(wait>=120?Math.floor(wait/60)+' h':wait+' min'));
 const debt=c.cust?debtOf(c.cust):0;
 const lv=why.length?'alta':(c.unread||debt>0)?'media':'normal';if(debt>0)why.push('debe '+money(debt));return{lv,why};}
const PRIO_T={alta:'Prioridad alta',media:'Prioridad media',normal:'Normal',baja:'Resuelta'};
function crmSuggest(c){const ins=convMsgs(c.id).filter(m=>m.dir==='in');const last=ins[ins.length-1];const nm=crmFirst(c);const out=[];if(!last||c.lastOut>last.ts)return out;
 const it=crmIntent(last.text);const ps=crmProdsIn(last.text);
 if(ps.length&&(!it||it.k==='precio'||it.k==='stock'||it.k==='pedido'))ps.forEach(p=>{const st=typeof stockOf==='function'?stockOf(p):1;out.push(`Hola ${nm}, ${p.name}${p.sub?' '+p.sub:''} está a ${money(p.price)}${st>0?' y lo tenemos disponible':' pero en este momento no nos queda'}. ¿Te lo guardamos?`);});
 if(it&&it.k==='horario')out.push(`Hola ${nm}, ${S.menu&&S.menu.hours?S.menu.hours:'estamos abiertos de lunes a sábado'}. ¡Te esperamos!`);
 if(it&&it.k==='pago'){const P=crmCfg().pay;if(P.alias||P.cbu)out.push(`Hola ${nm}, podés transferir a ${P.alias?'alias '+P.alias:''}${P.alias&&P.cbu?' / ':''}${P.cbu?'CBU/CVU '+P.cbu:''}${P.holder?' a nombre de '+P.holder:''}. Mandanos el comprobante por acá, ¡gracias!`);}
 if(it&&it.k==='reclamo')out.push(`Hola ${nm}, lamentamos mucho lo que pasó. Contanos qué producto fue y te lo resolvemos hoy mismo.`);
 if(it&&it.k==='turno'&&crmCfg().turnos)out.push(`Hola ${nm}, ¿qué día y horario te queda cómodo? Te reservo el turno.`);
 if(it&&it.k==='pedido'&&!ps.length)out.push(`¡Dale ${nm}! Pasame qué necesitás y las cantidades, y te armo el presupuesto.`);
 if(!out.length)out.push(`Hola ${nm}, gracias por escribirnos. Ya lo vemos y te respondemos.`);return out.slice(0,3);}
function crmSummary(c){const M=convMsgs(c.id);const ins=M.filter(m=>m.dir==='in');const L=[];
 const its=[...new Set(ins.map(m=>(crmIntent(m.text)||{}).t).filter(Boolean))];const snt=ins.slice(-3).map(m=>crmSent(m.text));
 const mood=snt.includes('neg')?'molesto':snt.includes('pos')?'conforme':'neutral';
 L.push(`${ins.length} mensaje(s) del cliente y ${M.filter(m=>m.dir==='out').length} respuesta(s) por ${CHAN[c.chan]||c.chan}.`);
 if(its.length)L.push('Temas: '+its.join(', ')+'.');L.push('Ánimo del cliente: '+mood+'.');
 const ps=[...new Set(ins.flatMap(m=>crmProdsIn(m.text)).map(p=>p.name))];if(ps.length)L.push('Productos mencionados: '+ps.slice(0,5).join(', ')+'.');
 if(c.pay&&c.pay.state==='pendiente')L.push('Cobro asistido pendiente por '+money(c.pay.amount)+'.');
 const ap=(c.appts||[]).filter(a=>a.st!=='cancelado'&&a.at>now());if(ap.length)L.push('Turno: '+crmHm(ap[0].at)+' ('+ap[0].what+').');
 const lastIn=ins[ins.length-1];L.push(c.state==='resuelta'?'Conversación resuelta'+(c.csat?' · calificación '+c.csat+'/5':'')+'.':(lastIn&&c.lastOut<lastIn.ts?'Falta responder el último mensaje.':'Esperando respuesta del cliente.'));return L;}

/* ---------- entrada del chat web (cliente) ---------- */
const CONV_RX=/^w[A-Za-z0-9_-]{16,40}$/;
function crmInbound(p,srv){if(!p||!CONV_RX.test(String(p.conv||'')))return false;const text=crmTxt(p.text);
 let c=convById(p.conv);
 if(!c){if(p.t==='csat')return false;const cu=(p.card&&custByCard(p.card))||(normWA(p.wa)&&S.customers.find(x=>x.status!=='baja'&&normWA(x.wa)===normWA(p.wa)))||null;
  c=crmNew({id:p.conv,chan:'web',cust:cu?cu.id:'',name:p.name,wa:normWA(p.wa)?'549'+normWA(p.wa):'',k:typeof p.k==='string'&&p.k.length>=40&&p.k.length<=48?p.k:''});
  audit('CRM_NUEVA','chat web'+(cu?' · socio '+pad4(cu.num):''));}
 else if(!c.k&&typeof p.k==='string'&&p.k.length>=40)c.k=p.k;
 const mid='w'+(srv||String(p.mid||'').replace(/[^A-Za-z0-9]/g,'').slice(0,24));
 if(cmsgs().some(x=>x.id===mid))return null;
 if(p.t==='csat'){const v=Math.round(+p.v);if(!(v>=1&&v<=5))return false;c.csat=v;crmAdd(c,'sys','El cliente calificó la atención: '+v+'/5',{id:mid,kind:'csat'});audit('CRM_CSAT','chat web · '+v+'/5');return true;}
 if(!text)return false;crmAdd(c,'in',text,{id:mid,ts:Math.min(now(),+p.ts||now())});return true;}

/* ---------- salida: responder por el canal de la conversación ---------- */
async function crmAesSeal(kB64,obj){const k=await crypto.subtle.importKey('raw',unb64(kB64),'AES-GCM',false,['encrypt']);const iv=rnd(12);
 const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,te.encode(JSON.stringify(obj))));return{iv:b64(iv),ct:b64(ct)};}
async function crmAesOpen(kB64,box){const k=await crypto.subtle.importKey('raw',unb64(kB64),'AES-GCM',false,['decrypt']);
 return JSON.parse(td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv)},k,unb64(box.ct))));}
const crmCloud=()=>typeof CLOUD!=='undefined'&&CLOUD.on;
async function crmSend(c,text,extra){text=crmTxt(text);if(!text)throw new Error('Escribí el mensaje.');extra=extra||{};
 if(c.chan==='web'&&crmCloud()){if(!c.k)throw new Error('Este chat no tiene su clave: pedile al cliente que vuelva a escribir desde el menú.');
  if(!cl.ready||!cl.online)throw new Error('Sin conexión con la nube: la respuesta NO se envió.');
  const box=await crmAesSeal(c.k,{text,ts:now(),u:user?String(user.name).split(/\s+/)[0]:'',csat:!!extra.csat});
  await rpc('crm_web_responder',{p_comercio:cl.comercio.id,p_conv:c.id,p_cifrado:box});}
 if(c.chan==='wa'){const d=crmWa(c);if(!d)throw new Error('La conversación no tiene un WhatsApp válido (código de área + número).');openExternal('https://wa.me/'+d+'?text='+encodeURIComponent(text));}
 const via={web:'enviado al chat',wa:'abierto en WhatsApp (el envío lo confirmás vos)',tel:'registrado (llamada)',local:'registrado (en el local)'}[c.chan]||'enviado (canal de demostración)';
 const m=crmAdd(c,'out',text,Object.assign({via},extra.kind?{kind:extra.kind}:{},extra.amount?{amount:extra.amount}:{},extra.csat?{csat:1}:{}));
 if(c.state==='abierta')c.state='pendiente';
 audit('CRM_RESPUESTA',(CHAN[c.chan]||c.chan)+' · '+crmWho(c)+(extra.kind&&extra.kind!=='msg'?' · '+extra.kind:''));save();return m;}

/* ---------- importación del chat web desde la nube (cifrado con la llave pública del comercio) ---------- */
async function crmImport(){if(!crmCloud()||!crmCfg().on||!cl.ready||!cl.online||!cl.clubPriv||!cl.clubPriv.jwk||crmImport.busy)return 0;crmImport.busy=true;
 try{const rows=await sel(`crm_entrantes?select=id,conv,cifrado,creado&comercio_id=eq.${cl.comercio.id}&estado=eq.nueva&order=id&limit=100`);if(!rows.length)return 0;
  const ok=[],bad=[];let n=0;
  for(const r of rows){let p;try{p=await rsaOpen(cl.clubPriv.jwk,r.cifrado);}catch(e){if(Date.now()-Date.parse(r.creado||'')>3*864e5)bad.push(r.id);continue;}
   if(!p||p.conv!==r.conv){bad.push(r.id);continue;}const res=crmInbound(p,r.id);if(res===false)bad.push(r.id);else{ok.push(r.id);if(res)n++;}}
  try{if(ok.length)await rpc('crm_entrantes_marcar',{p_comercio:cl.comercio.id,p_ids:ok,p_estado:'importada'});if(bad.length)await rpc('crm_entrantes_marcar',{p_comercio:cl.comercio.id,p_ids:bad,p_estado:'rechazada'});}catch(e){}
  if(n){save();if(typeof curScreen!=='undefined'&&curScreen==='crm')crmPaint();}return n;
 }catch(e){return 0;}finally{crmImport.busy=false;}}

/* ---------- API del menú público (el celular del cliente guarda su chat: identificador y clave nacen ahí) ---------- */
function crmPublic(){const C=crmCfg();return{on:!!(C.on&&C.web&&C.chans.includes('web')),greet:String(C.greet||'').slice(0,160)};}
const crmB64u=u=>b64(u).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function crmPubApi(){const KEY='rave.chat';
 const st=()=>{try{const o=JSON.parse(localStorage.getItem(KEY)||'null');return o&&CONV_RX.test(o.conv||'')?o:null;}catch(e){return null;}};
 const put=o=>{try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}};
 const site=()=>{if(crmCloud()&&!(cl&&cl.ready)){const c=typeof snapC==='function'?snapC():null;return{chat:c&&c.site&&c.site.chat,key:c&&c.clubkey};}return{chat:crmPublic(),key:null};};
 const on=()=>{const s=site();return !!(s.chat&&s.chat.on&&(!crmCloud()||s.key||(cl&&cl.clubPriv&&cl.clubPriv.pub)));};
 const hits=[];
 async function push(o,p){if(crmCloud()){const key=site().key||(cl.clubPriv&&cl.clubPriv.pub);if(!key)throw new Error('chat');
   const box=await rsaSeal(key,p);const r=await rpc('crm_web_enviar',{p_slug:CLOUD.slug,p_conv:o.conv,p_cifrado:box},{auth:false});if(!r||!r.ok)throw new Error((r&&r.error)||'chat');}
  else{if(crmInbound(p,'')===false)throw new Error('chat');save();if(typeof curScreen!=='undefined'&&curScreen==='crm')crmPaint();}}
 return{
  chatOn:on,chatGreet:()=>{const s=site();return s.chat?s.chat.greet:'';},
  chatState:()=>{const o=st();return o?{name:o.name,msgs:(o.msgs||[]).slice(-80),csat:!!o.csatAsk&&!o.csatDone}:null;},
  chatSend:async(text,name,wa)=>{text=crmTxt(text);const t=Date.now();const rec=hits.filter(x=>t-x<60000);if(rec.length>=6)return{ok:false,msg:'Estás mandando muchos mensajes seguidos: esperá un minuto.'};
   if(!text)return{ok:false,msg:'Escribí tu mensaje.'};let o=st();
   if(!o){const nm=String(name||'').trim().replace(/[<>]/g,'').slice(0,60);if(nm.length<2)return{ok:false,msg:'Decinos tu nombre.'};const w=normWA(wa);if(String(wa||'').trim()&&!w)return{ok:false,msg:'El WhatsApp no es válido (o dejalo vacío).'};
    o={conv:'w'+crmB64u(rnd(18)),k:b64(rnd(32)),name:nm,wa:w,msgs:[],last:0,lastTs:0};}
   const mid=crmB64u(rnd(9));const p={conv:o.conv,k:o.k,name:o.name,wa:o.wa?waFull(o.wa):'',card:(()=>{try{return localStorage.getItem('rave.card')||'';}catch(e){return '';}})(),text,ts:t,mid,t:'msg',v:'v1'};
   try{await push(o,p);}catch(e){return{ok:false,msg:'No se pudo enviar (¿hay internet?). Probá de nuevo.'};}
   hits.push(t);o.msgs=(o.msgs||[]).concat({d:'in',x:text,ts:t}).slice(-80);put(o);return{ok:true};},
  chatPoll:async()=>{const o=st();if(!o)return 0;let add=[];
   if(crmCloud()){try{const rows=await rpc('crm_web_leer',{p_slug:CLOUD.slug,p_conv:o.conv,p_desde:o.last||0},{auth:false});
     for(const r of (rows||[])){o.last=Math.max(o.last||0,+r.id||0);try{const m=await crmAesOpen(o.k,r.cifrado);add.push({d:'out',x:crmTxt(m.text),ts:+m.ts||Date.parse(r.creado),u:String(m.u||'').slice(0,20),csat:!!m.csat});}catch(e){}}}catch(e){return -1;}}
   else{add=cmsgs().filter(m=>m.conv===o.conv&&m.dir==='out'&&m.ts>(o.lastTs||0)).sort((a,b)=>a.ts-b.ts).map(m=>({d:'out',x:m.text,ts:m.ts,u:String(m.user||'').split(/\s+/)[0],csat:!!m.csat}));}
   if(add.length){add.forEach(a=>{if(a.ts>(o.lastTs||0))o.lastTs=a.ts;if(a.csat)o.csatAsk=1;});o.msgs=(o.msgs||[]).concat(add).slice(-80);}put(o);return add.length;},
  chatCsat:async v=>{const o=st();v=Math.round(+v);if(!o||!(v>=1&&v<=5))return{ok:false};const p={conv:o.conv,k:o.k,t:'csat',v,mid:crmB64u(rnd(9)),ts:Date.now()};
   try{await push(o,p);}catch(e){return{ok:false,msg:'No se pudo enviar. Probá de nuevo.'};}o.csatDone=v;o.msgs=(o.msgs||[]).concat({d:'sys',x:'Calificaste la atención: '+v+'/5. ¡Gracias!',ts:Date.now()});put(o);return{ok:true};},
  chatReset:()=>{try{localStorage.removeItem(KEY);}catch(e){}}};}

/* ---------- pantalla ---------- */
let crmSel='',crmMode='msg',crmF={st:'activas',ch:'',q:'',mine:false},crmTimer=null;
function crmList(){const q=crmNorm(crmF.q);return convs().filter(c=>(crmF.st==='activas'?c.state!=='resuelta':crmF.st==='todas'?true:c.state===crmF.st)&&(!crmF.ch||c.chan===crmF.ch)&&(!crmF.mine||c.asg===(user&&user.name))
  &&(!q||crmNorm(crmWho(c)+' '+(c.tags||[]).join(' ')+' '+(c.lastTxt||'')).includes(q)))
 .map(c=>({c,p:crmPrio(c)})).sort((a,b)=>({alta:0,media:1,normal:2,baja:3}[a.p.lv]-{alta:0,media:1,normal:2,baja:3}[b.p.lv])||(b.c.last-a.c.last));}
const PRIO_C={alta:'var(--crm-a)',media:'var(--crm-m)',normal:'var(--crm-n)',baja:'inherit'};
function crmListHTML(){const L=crmList();if(!L.length)return'<p class="sm mut" style="padding:.6rem">No hay conversaciones con este filtro.</p>';
 return L.map(({c,p})=>`<button type="button" class="crm-it${c.id===crmSel?' on':''}" data-act="crmOpen" data-id="${esc(c.id)}" aria-pressed="${c.id===crmSel}">
  <span class="row" style="gap:.3rem;flex-wrap:nowrap"><span aria-hidden="true">${CHAN_IC[c.chan]||'💬'}</span><b class="sp" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(crmWho(c))}</b>${c.unread?'<span class="crm-dot" title="Sin leer">●</span>':''}</span>
  <span class="sm mut" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.lastTxt||'—')}</span>
  <span class="sm" style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.2rem"><span style="color:${PRIO_C[p.lv]};font-weight:600">${PRIO_T[p.lv]}</span><span class="mut">· ${esc(CHAN[c.chan]||c.chan)} · ${crmHm(c.last)}</span>${(c.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</span></button>`).join('');}
function crmThreadHTML(){const c=convById(crmSel);if(!c)return'<p class="mut" style="padding:1rem">Elegí una conversación de la lista.</p>';
 const p=crmPrio(c);const demo=CHAN_DEMO.includes(c.chan);
 const msgs=convMsgs(c.id).map(m=>m.dir==='sys'?`<div class="crm-m sys">${esc(m.text)} · ${crmHm(m.ts)}</div>`
  :`<div class="crm-m ${m.dir}"><div>${esc(m.text)}</div><div class="sm mut" style="margin-top:.2rem">${m.dir==='note'?'Nota interna · ':m.dir==='out'?esc(m.user)+' · ':''}${crmHm(m.ts)}${m.via?' · '+esc(m.via):''}${m.kind&&m.kind!=='msg'?' · '+esc(m.kind):''}${m.dir==='in'?' · ánimo '+({neg:'molesto',pos:'conforme',neu:'neutral'}[crmSent(m.text)]):''}</div></div>`).join('');
 return `<div class="row" style="gap:.4rem;align-items:center"><b class="sp">${CHAN_IC[c.chan]||''} ${esc(crmWho(c))}</b>
  <select id="crm-st" aria-label="Estado de la conversación">${Object.entries(CST).map(([k,t])=>`<option value="${k}" ${c.state===k?'selected':''}>${t}</option>`).join('')}</select>
  <button class="btn sm" data-act="crmAsg">${c.asg?(c.asg===(user&&user.name)?'Soltar':'Tomar (es de '+esc(c.asg)+')'):'Tomar'}</button><button class="btn sm" data-act="crmTags">Etiquetas</button></div>
  <p class="sm" style="margin:.3rem 0"><span style="color:${PRIO_C[p.lv]};font-weight:600">${PRIO_T[p.lv]}</span>${p.why.length?' · '+esc(p.why.join(' · ')):''} · ${esc(CHAN[c.chan]||c.chan)}${c.asg?' · asignada a '+esc(c.asg):''}</p>
  ${demo?'<p class="sm warnbox" style="margin:.3rem 0">Canal de demostración: los mensajes son de ejemplo. Para recibir y responder de verdad hay que conectar la cuenta del comercio (Meta / Telegram / correo).</p>':''}
  ${c.chan==='wa'?'<p class="sm mut" style="margin:.3rem 0">WhatsApp asistido: al responder se abre WhatsApp con el texto; los mensajes que te mande el cliente por WhatsApp se registran con «Registrar lo que escribió».</p>':''}
  <div class="crm-th" id="crm-msgs" aria-live="polite">${msgs||'<p class="sm mut">Sin mensajes.</p>'}</div>`;}
function crmCtxHTML(){const c=convById(crmSel);if(!c)return'';const cu=c.cust?custById(c.cust):null;const C=crmCfg();
 const sug=crmSuggest(c);const sum=crmSummary(c);
 let h=`<h3 style="margin-top:0">Asistente (por reglas)</h3><details open><summary class="sm"><b>Resumen</b></summary><ul class="sm" style="padding-left:1.1rem;margin:.3rem 0">${sum.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></details>
  ${sug.length?`<p class="sm" style="margin:.4rem 0 .2rem"><b>Respuestas sugeridas</b> (tocá para usarla)</p>${sug.map((s,i)=>`<button type="button" class="btn sm crm-sug" data-act="crmUse" data-i="${i}">${esc(s)}</button>`).join('')}`:''}<hr>`;
 if(!cu){h+=`<h3>Cliente</h3><p class="sm">${esc(c.name||'Sin nombre')}${c.wa?' · '+esc(c.wa):''}</p><p class="sm mut">Sin ficha vinculada.</p>
  <label for="crm-lq">Vincular con un cliente</label><input id="crm-lq" placeholder="Nombre, WhatsApp, DNI o N.º" autocomplete="off"><div id="crm-lr"></div>`;}
 else{const st=stampsOf(cu.id),g=S.loyalty.goal;const tr=typeof custTier==='function'?custTier(cu):null;const dt=debtOf(cu.id);const wb=typeof walBal==='function'&&fidCfg().wallet.on?walBal(cu.id):null;
  const sales=S.sales.filter(s=>s.cust===cu.id&&s.status==='ok').sort((a,b)=>b.ts-a.ts);const tot=sales.reduce((a,s)=>a+(s.total||0),0);
  const qs=(typeof quotes==='function'?quotes():[]).filter(q=>q.cust===cu.id&&qtState(q)==='vigente');
  h+=`<h3>${esc(custFull(cu))}</h3><p class="sm">Socio N.º ${pad4(cu.num)}${tr?' · '+(TIER_ICO[tr.t.k]||'')+' '+esc(tr.t.name):''}</p>
  <div class="grid g2 sm" style="gap:.3rem"><div class="card" style="padding:.4rem"><b>${Math.min(st,g)}/${g}</b><br>sellos</div><div class="card" style="padding:.4rem"><b style="color:${dt>0?'var(--crm-a)':'inherit'}">${money(dt)}</b><br>deuda</div>
  ${wb!==null?`<div class="card" style="padding:.4rem"><b>${money(wb)}</b><br>monedero</div>`:''}<div class="card" style="padding:.4rem"><b>${money(tot)}</b><br>${sales.length} compra(s)</div></div>
  ${sales.length?`<p class="sm" style="margin:.4rem 0 .1rem"><b>Últimas compras</b></p><ul class="sm" style="padding-left:1.1rem;margin:0">${sales.slice(0,5).map(s=>`<li>${dmy(dkey(s.ts))} · ${esc(s.n||'')} · ${money(s.total||0)}</li>`).join('')}</ul>`:''}
  ${qs.length?`<p class="sm" style="margin:.4rem 0 .1rem"><b>Presupuestos vigentes</b></p><ul class="sm" style="padding-left:1.1rem;margin:0">${qs.map(q=>`<li>${esc(q.n)} · ${money(q.total)} · vence ${dmy(dkey(q.exp))}</li>`).join('')}</ul>`:''}
  <div class="row" style="margin-top:.4rem"><button class="btn sm" data-act="cuEdit" data-id="${cu.id}">Ver ficha</button><button class="btn sm" data-act="crmUnlink">Desvincular</button></div>`;}
 const ap=(c.appts||[]).filter(a=>a.st!=='cancelado').sort((a,b)=>a.at-b.at);
 if(C.turnos&&ap.length)h+=`<p class="sm" style="margin:.5rem 0 .1rem"><b>Turnos</b></p><ul class="sm" style="padding-left:1.1rem;margin:0">${ap.map(a=>`<li>${crmHm(a.at)} · ${esc(a.what)}${a.at<now()?' (pasado)':''} <button class="btn sm" data-act="crmApptX" data-id="${esc(a.id)}">Cancelar</button></li>`).join('')}</ul>`;
 if(c.pay&&c.pay.state==='pendiente')h+=`<p class="sm warnbox" style="margin-top:.5rem">Cobro asistido pendiente: ${money(c.pay.amount)} (${esc(c.pay.ref||'')}). <button class="btn sm" data-act="crmPayOk">Llegó el pago</button></p>`;
 h+=`<hr><h3>Acciones rápidas</h3><div class="row" style="gap:.3rem"><button class="btn sm" data-act="crmPay">Cobro asistido</button>${cu?'<button class="btn sm" data-act="crmQuote">Enviar presupuesto</button><button class="btn sm" data-act="crmNewQuote">Nuevo presupuesto</button>':''}${C.turnos?'<button class="btn sm" data-act="crmAppt">Turno</button>':''}${c.state==='resuelta'&&!c.csat?'<button class="btn sm" data-act="crmCsatAsk">Pedir calificación</button>':''}</div>
  ${c.state==='resuelta'&&c.chan!=='web'?`<p class="sm" style="margin:.4rem 0 .1rem">Calificación que dio el cliente:</p><div class="row" style="gap:.2rem">${[1,2,3,4,5].map(v=>`<button class="btn sm ${c.csat===v?'on':''}" data-act="crmCsatSet" data-v="${v}" aria-label="${v} de 5">${v}★</button>`).join('')}</div>`:''}`;
 return h;}
function crmComposerHTML(){const C=crmCfg();const c=convById(crmSel);if(!c)return'';
 return `<div class="row" role="group" aria-label="Tipo" style="gap:.3rem;margin-top:.4rem"><button type="button" class="btn sm ${crmMode==='msg'?'on':''}" data-act="crmMode" data-m="msg" aria-pressed="${crmMode==='msg'}">Responder al cliente</button><button type="button" class="btn sm ${crmMode==='note'?'on':''}" data-act="crmMode" data-m="note" aria-pressed="${crmMode==='note'}">Nota interna</button>
  ${['wa','tel','local'].includes(c.chan)||CHAN_DEMO.includes(c.chan)?'<button type="button" class="btn sm" data-act="crmLogIn">Registrar lo que escribió</button>':''}<span class="sp"></span>
  <select id="crm-cn" aria-label="Respuesta rápida"><option value="">Respuestas rápidas…</option>${C.canned.map((x,i)=>`<option value="${i}">${esc(x.t)}</option>`).join('')}</select></div>
  <label for="crm-tx" class="sr-only" style="position:absolute;left:-9999px">Mensaje</label><textarea id="crm-tx" rows="3" maxlength="1500" placeholder="${crmMode==='note'?'Nota sólo para el equipo (el cliente no la ve)':'Escribí la respuesta…'}" style="width:100%;margin-top:.3rem"></textarea>
  <div class="row" style="justify-content:flex-end;margin-top:.3rem"><button class="btn gold" data-act="crmSendBtn">${crmMode==='note'?'Guardar nota':c.chan==='wa'?'Abrir WhatsApp y registrar':'Enviar'}</button></div>`;}
function crmAvisos(){const C=crmCfg();const out=[];const t=now();const recent=(cid,k)=>convs().some(c=>c.cust===cid&&convMsgs(c.id).some(m=>m.kind===k&&t-m.ts<7*864e5));
 S.customers.filter(c=>c.status!=='baja'&&waOk(c)&&debtOf(c.id)>0&&!recent(c.id,'aviso-deuda')).slice(0,8).forEach(c=>out.push({k:'deuda',id:c.id,t:`${custFull(c)} debe ${money(debtOf(c.id))}`,b:'Recordar saldo'}));
 (typeof quotes==='function'?quotes():[]).filter(q=>q.cust&&qtState(q)==='vigente'&&q.exp-t<2*864e5&&!recent(q.cust,'aviso-presupuesto')).slice(0,8).forEach(q=>{const c=custById(q.cust);if(c&&waOk(c))out.push({k:'presup',id:q.id,t:`Presupuesto ${q.n} de ${custFull(c)} vence ${dmy(dkey(q.exp))}`,b:'Hacer seguimiento'});});
 if(C.turnos)convs().forEach(c=>(c.appts||[]).filter(a=>a.st!=='cancelado'&&!a.rem&&a.at>t&&a.at-t<36*3600e3).forEach(a=>out.push({k:'turno',id:c.id+'|'+a.id,t:`Turno de ${crmWho(c)}: ${crmHm(a.at)} (${a.what})`,b:'Recordar turno'})));
 convs().filter(c=>c.state==='resuelta'&&!c.csat&&!c.asked&&t-c.last<3*864e5).slice(0,8).forEach(c=>out.push({k:'csat',id:c.id,t:`Encuesta de satisfacción a ${crmWho(c)}`,b:'Pedir calificación'}));
 return out;}
function crmSqlNote(){if(!crmCloud()||!cl.rejects)return'';const bad=Object.entries(cl.rejects).some(([k,v])=>/^(conv|cmsg)\|/.test(k)&&/colecci/i.test(String(v&&v.motivo||v)));
 return bad?'<div class="warnbox">La nube todavía no acepta las conversaciones: falta correr <b>22-crm.sql</b> en Supabase. Mientras tanto quedan sólo en este equipo.</div>':'';}
function crmPaint(){const l=$('#crm-list'),t=$('#crm-thread'),x=$('#crm-ctx'),k=$('#crm-kpi');if(!l)return;
 l.innerHTML=crmListHTML();t.innerHTML=crmThreadHTML();x.innerHTML=crmCtxHTML();if(k)k.innerHTML=crmKpiHTML();
 const m=$('#crm-msgs');if(m)m.scrollTop=m.scrollHeight;crmBindCtx();}
function crmKpiHTML(){const A0=convs().filter(c=>c.state!=='resuelta');const un=A0.filter(c=>c.unread).length;const hi=A0.filter(c=>crmPrio(c).lv==='alta').length;
 const cs=convs().filter(c=>c.csat);const avg=cs.length?(cs.reduce((a,c)=>a+c.csat,0)/cs.length).toFixed(1).replace('.',','):'—';
 return `<div class="card kpi"><b>${A0.length}</b><span>Activas</span></div><div class="card kpi"><b>${un}</b><span>Sin responder</span></div><div class="card kpi"><b style="color:${hi?'var(--crm-a)':'inherit'}">${hi}</b><span>Prioridad alta</span></div><div class="card kpi"><b>${avg}</b><span>Satisfacción (${cs.length})</span></div>`;}
function crmBindCtx(){const q=$('#crm-lq');if(q)q.addEventListener('input',()=>{const s=crmNorm(q.value).trim();const r=$('#crm-lr');if(s.length<2){r.innerHTML='';return;}
  const L=S.customers.filter(c=>c.status!=='baja'&&crmNorm(custFull(c)+' '+(c.wa||'')+' '+(c.dni||'')+' '+pad4(c.num)).includes(s)).slice(0,6);
  r.innerHTML=L.map(c=>`<button class="btn sm" style="display:block;width:100%;text-align:left;margin-top:.2rem;white-space:normal" data-act="crmLink" data-id="${c.id}">${esc(custFull(c))} · N.º ${pad4(c.num)}</button>`).join('')||'<p class="sm mut">Sin resultados.</p>';});
 const s=$('#crm-st');if(s)s.addEventListener('change',()=>{const c=convById(crmSel);if(!c)return;const v=s.value;if(!CST[v])return;c.state=v;if(v==='resuelta')c.unread=false;crmAdd(c,'sys','Estado: '+CST[v]+' ('+(user?user.name:'')+')',{kind:'estado'});audit('CRM_ESTADO',crmWho(c)+' · '+CST[v]);save();crmPaint();});}
reg('crm','Conversaciones','chat','crm',()=>{const C=crmCfg();
 const chans=C.chans.map(k=>`<option value="${k}" ${crmF.ch===k?'selected':''}>${CHAN[k]}${CHAN_DEMO.includes(k)?' (demo)':''}</option>`).join('');const av=crmAvisos();
 return `<style>:root{--crm-a:#a8261b;--crm-m:#7a4f00;--crm-n:#1d6234}[data-theme=dark]{--crm-a:#ff9b91;--crm-m:#f2c96b;--crm-n:#8fe0a2}@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--crm-a:#ff9b91;--crm-m:#f2c96b;--crm-n:#8fe0a2}}.crm-wrap{display:grid;grid-template-columns:minmax(220px,1fr) minmax(0,2fr) minmax(230px,1fr);gap:.8rem;align-items:start}
 @media(max-width:1050px){.crm-wrap{grid-template-columns:minmax(0,1fr)}}.crm-wrap>*{min-width:0}.crm-wrap .row{flex-wrap:wrap}.crm-wrap select,.crm-wrap input{max-width:100%;min-width:0}.crm-list{max-height:68vh;overflow:auto;display:flex;flex-direction:column;gap:.3rem}
 .crm-it{display:block;width:100%;text-align:left;padding:.55rem .6rem;border:1px solid rgba(127,127,127,.3);border-radius:10px;background:transparent;color:inherit;cursor:pointer;min-height:48px;font:inherit}
 .crm-it.on{border-color:#c9963e;box-shadow:0 0 0 2px rgba(201,150,62,.35)}.crm-dot{color:var(--crm-a)}
 .crm-th{max-height:52vh;overflow:auto;display:flex;flex-direction:column;gap:.45rem;padding:.4rem;border:1px solid rgba(127,127,127,.2);border-radius:10px;min-height:160px}
 .crm-m{max-width:85%;padding:.5rem .7rem;border-radius:12px;white-space:pre-wrap;word-break:break-word}.crm-m.in{align-self:flex-start;background:rgba(127,127,127,.14)}
 .crm-m.out{align-self:flex-end;background:rgba(46,160,67,.18)}.crm-m.note{align-self:flex-end;background:rgba(201,150,62,.16);border:1px dashed rgba(201,150,62,.7)}
 .crm-m.sys{align-self:center;font-size:.85em;opacity:.8;background:none;padding:.2rem}.crm-sug{display:block;width:100%;text-align:left;white-space:normal;margin-top:.25rem}</style>
 <div class="row"><h1 class="sp">Conversaciones</h1>${CRM_FULL?'<button class="btn" data-act="crmSim">Simular mensaje entrante</button>':''}<button class="btn gold" data-act="crmNewBtn">+ Nueva conversación</button>${can('config')?'<button class="btn" data-act="crmCfgOpen">Ajustes</button>':''}</div>
 ${C.on?'':'<div class="warnbox">El CRM está <b>apagado</b>: el chat del menú público no se muestra. Activalo en <b>Ajustes</b>.</div>'}${crmSqlNote()}
 <p class="sm mut">Canales: ${C.chans.map(k=>CHAN_IC[k]+' '+CHAN[k]+(CHAN_DEMO.includes(k)?' (demostración)':'')).join(' · ')}. El chat web va cifrado de punta a punta; WhatsApp se abre con el texto listo y el envío lo confirmás vos.</p>
 <div class="grid g4" id="crm-kpi" style="margin:.8rem 0">${crmKpiHTML()}</div>
 <div class="crm-wrap"><div class="card"><div class="row" style="gap:.3rem"><input id="crm-q" class="sp" placeholder="Buscar" value="${esc(crmF.q)}" aria-label="Buscar conversación" autocomplete="off"></div>
  <div class="row" style="gap:.3rem;margin:.4rem 0"><select id="crm-fs" aria-label="Estado">${[['activas','Activas'],['abierta','Abiertas'],['pendiente','Esperando al cliente'],['resuelta','Resueltas'],['todas','Todas']].map(([k,t])=>`<option value="${k}" ${crmF.st===k?'selected':''}>${t}</option>`).join('')}</select>
  <select id="crm-fc" aria-label="Canal"><option value="">Todos los canales</option>${chans}</select><label class="chk" style="margin:0"><input type="checkbox" id="crm-fm" ${crmF.mine?'checked':''}> <span>Mías</span></label></div>
  <div class="crm-list" id="crm-list">${crmListHTML()}</div></div>
 <div class="card"><div id="crm-thread">${crmThreadHTML()}</div><div id="crm-comp">${crmComposerHTML()}</div></div>
 <div class="card" id="crm-ctx">${crmCtxHTML()}</div></div>
 <details class="card" style="margin-top:.8rem" ${av.length?'open':''}><summary><b>Avisos sugeridos (${av.length})</b> — mensajes listos para enviar con un toque</summary>
  ${av.length?`<table><thead><tr><th>Aviso</th><th></th></tr></thead><tbody>${av.map(a=>`<tr><td>${esc(a.t)}</td><td><button class="btn sm" data-act="crmAviso" data-k="${a.k}" data-id="${esc(a.id)}">${a.b}</button></td></tr>`).join('')}</tbody></table>`:'<p class="sm mut">No hay avisos pendientes.</p>'}
  <p class="sm mut">Son avisos de la cuenta, de pedidos, turnos o la encuesta de atención (no promociones). Nada se envía solo: se abre el mensaje y lo confirmás vos.</p></details>`;},
 ()=>{const v=$('#view');const rf=()=>{const l=$('#crm-list');if(l)l.innerHTML=crmListHTML();};
  $('#crm-q').addEventListener('input',e=>{crmF.q=e.target.value;rf();});$('#crm-fs').addEventListener('change',e=>{crmF.st=e.target.value;rf();});
  $('#crm-fc').addEventListener('change',e=>{crmF.ch=e.target.value;rf();});$('#crm-fm').addEventListener('change',e=>{crmF.mine=e.target.checked;rf();});
  v.addEventListener('change',e=>{if(e.target.id==='crm-cn'&&e.target.value!==''){const x=crmCfg().canned[+e.target.value];const c=convById(crmSel);if(x){const ta=$('#crm-tx');ta.value=String(x.x).replace(/\{nombre\}/g,crmFirst(c));ta.focus();}e.target.value='';}});
  crmBindCtx();const m=$('#crm-msgs');if(m)m.scrollTop=m.scrollHeight;
  clearInterval(crmTimer);crmTimer=setInterval(async()=>{if(curScreen!=='crm'||$('#panel').hidden){clearInterval(crmTimer);return;}const n=await crmImport();if(!n){const l=$('#crm-kpi');if(l)l.innerHTML=crmKpiHTML();}},8000);crmImport();});
SCREENS.crm.show=()=>crmCfg().on||can('config');

/* ---------- acciones ---------- */
const crmCur=()=>convById(crmSel);
A.crmOpen=el=>{crmSel=el.dataset.id;const c=crmCur();if(c&&c.unread&&c.lastOut<c.lastIn){/* sigue sin responder; sólo deja de estar «sin leer» al responder */}crmPaint();const cp=$('#crm-comp');if(cp)cp.innerHTML=crmComposerHTML();
 if(window.innerWidth<1050){const t=$('#crm-thread');if(t)t.scrollIntoView({block:'start'});}};
A.crmMode=el=>{crmMode=el.dataset.m==='note'?'note':'msg';const keep=$('#crm-tx')?$('#crm-tx').value:'';$('#crm-comp').innerHTML=crmComposerHTML();$('#crm-tx').value=keep;$('#crm-tx').focus();};
A.crmUse=el=>{const c=crmCur();if(!c)return;const s=crmSuggest(c)[+el.dataset.i];if(!s)return;if(crmMode!=='msg'){crmMode='msg';$('#crm-comp').innerHTML=crmComposerHTML();}const ta=$('#crm-tx');ta.value=s;ta.focus();};
A.crmSendBtn=async el=>{const c=crmCur();if(!c)return;const ta=$('#crm-tx');const t=crmTxt(ta.value);if(!t)return toast('Escribí el mensaje.',1);
 if(crmMode==='note'){crmAdd(c,'note',t,{kind:'nota'});audit('CRM_NOTA',crmWho(c));save();ta.value='';crmPaint();return;}
 el.disabled=true;try{await crmSend(c,t);ta.value='';crmPaint();}catch(e){toast(e.message||'No se pudo enviar.',1);}finally{el.disabled=false;}};
A.crmLogIn=()=>{const c=crmCur();if(!c)return;modal('Registrar lo que escribió el cliente',`<p class="sm">Copiá acá el mensaje que te mandó por ${esc(CHAN[c.chan]||c.chan)} para tenerlo en la conversación.</p><textarea id="crm-li" rows="4" maxlength="1500" style="width:100%"></textarea>`,
 {okText:'Registrar',onOk:w=>{const t=crmTxt(val('crm-li'));if(!t)return w._err('Escribí el mensaje.'),false;crmAdd(c,'in',t,{via:'registrado a mano por '+(user?user.name:'')});audit('CRM_REGISTRO',(CHAN[c.chan]||c.chan)+' · '+crmWho(c));save();crmPaint();}});};
A.crmAsg=()=>{const c=crmCur();if(!c||!user)return;c.asg=c.asg===user.name?'':user.name;crmAdd(c,'sys',c.asg?'Tomada por '+c.asg:'Liberada por '+user.name,{kind:'asigna'});audit('CRM_ASIGNA',crmWho(c)+' · '+(c.asg||'sin asignar'));save();crmPaint();};
A.crmTags=()=>{const c=crmCur();if(!c)return;modal('Etiquetas',`<label for="crm-tg">Separadas por coma (ej.: mayorista, reclamo, vip)</label><input id="crm-tg" maxlength="120" value="${esc((c.tags||[]).join(', '))}">`,
 {okText:'Guardar',onOk:()=>{c.tags=[...new Set(val('crm-tg').split(',').map(x=>x.trim().replace(/[<>]/g,'').slice(0,20)).filter(Boolean))].slice(0,6);audit('CRM_ETIQUETAS',crmWho(c)+' · '+c.tags.join(', '));save();crmPaint();}});};
A.crmLink=el=>{const c=crmCur();const cu=custById(el.dataset.id);if(!c||!cu)return;c.cust=cu.id;crmAdd(c,'sys','Vinculada con la ficha de '+custFull(cu),{kind:'vincula'});audit('CRM_VINCULA',(CHAN[c.chan]||c.chan)+' · socio '+pad4(cu.num));save();crmPaint();};
A.crmUnlink=()=>{const c=crmCur();if(!c)return;confirmBox('Desvincular','La conversación deja de estar ligada a esta ficha (no se borra nada).',()=>{c.cust='';audit('CRM_VINCULA',crmWho(c)+' · desvinculada');save();crmPaint();});};
A.crmNewBtn=()=>{const C=crmCfg();const ch=C.chans.filter(k=>k!=='web');
 const w=modal('Nueva conversación',`<label for="cn-q">Cliente</label><input id="cn-q" placeholder="Nombre, WhatsApp, DNI o N.º" autocomplete="off"><div id="cn-r"></div><input type="hidden" id="cn-id">
  <p class="sm mut">O sin ficha:</p><div class="grid g2"><div><label for="cn-n">Nombre</label><input id="cn-n" maxlength="60"></div><div><label for="cn-w">WhatsApp (opcional)</label><input id="cn-w" inputmode="tel" maxlength="20" placeholder="387 4123456"></div></div>
  <label for="cn-c">Canal</label><select id="cn-c">${ch.map(k=>`<option value="${k}">${CHAN[k]}${CHAN_DEMO.includes(k)?' (demostración)':''}</option>`).join('')}</select>`,
  {okText:'Crear',onOk:w=>{const cu=custById(val('cn-id'));const nm=val('cn-n').trim();const wa=normWA(val('cn-w'));const chan=val('cn-c');if(!CHAN[chan])return w._err('Elegí el canal.'),false;
   if(!cu&&nm.length<2)return w._err('Elegí un cliente o escribí un nombre.'),false;if(val('cn-w').trim()&&!wa)return w._err('El WhatsApp no es válido.'),false;
   const c=crmNew({chan,cust:cu?cu.id:'',name:cu?'':nm,wa:wa?'549'+wa:''});crmAdd(c,'sys','Conversación iniciada por '+(user?user.name:''),{kind:'nueva'});audit('CRM_NUEVA',(CHAN[chan])+' · '+crmWho(c));save();crmSel=c.id;crmMode='msg';rerender();}});
 const q=$('#cn-q',w);q.addEventListener('input',()=>{const s=crmNorm(q.value).trim();const r=$('#cn-r',w);if(s.length<2){r.innerHTML='';return;}
  r.innerHTML=S.customers.filter(c=>c.status!=='baja'&&crmNorm(custFull(c)+' '+(c.wa||'')+' '+(c.dni||'')+' '+pad4(c.num)).includes(s)).slice(0,6).map(c=>`<button type="button" class="btn sm" style="display:block;width:100%;text-align:left;margin-top:.2rem;white-space:normal" data-pick="${c.id}">${esc(custFull(c))} · N.º ${pad4(c.num)}</button>`).join('')||'<p class="sm mut">Sin resultados.</p>';});
 w.addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(!b)return;const c=custById(b.dataset.pick);$('#cn-id',w).value=c.id;q.value=custFull(c);$('#cn-r',w).innerHTML='<p class="sm okbox">Elegido: '+esc(custFull(c))+'</p>';});};
A.crmPay=()=>{const c=crmCur();if(!c)return;const P=crmCfg().pay;if(!P.alias&&!P.cbu)return toast('Cargá el alias o CBU del comercio en Conversaciones → Ajustes.',1);
 const cu=c.cust?custById(c.cust):null;const qs=cu&&typeof quotes==='function'?quotes().filter(q=>q.cust===cu.id&&qtState(q)==='vigente'):[];const dt=cu?debtOf(cu.id):0;
 const opts=[['libre','Importe libre',0]].concat(dt>0?[['deuda','Saldo de la cuenta',dt]]:[]).concat(qs.map(q=>['q:'+q.id,'Presupuesto '+q.n,q.total]));
 const w=modal('Cobro asistido',`<label for="cp-o">Concepto</label><select id="cp-o">${opts.map(o=>`<option value="${o[0]}" data-a="${o[2]}">${esc(o[1])}${o[2]?' · '+money(o[2]):''}</option>`).join('')}</select>
  <label for="cp-a">Importe ($)</label><input id="cp-a" inputmode="decimal" placeholder="Importe" value="${opts[1]?(opts[1][2]/100).toFixed(2).replace('.',','):''}">
  <p class="sm">Se le envía: alias <b>${esc(P.alias||'—')}</b>${P.cbu?' · CBU/CVU <b>'+esc(P.cbu)+'</b>':''}${P.holder?' · titular '+esc(P.holder):''}.</p>
  <p class="sm warnbox">No mueve la caja: cuando llegue la transferencia, registrá la venta o el cobro en Vender / Caja con el medio Transferencia.</p>`,
  {okText:'Enviar datos de pago',onOk:async w=>{const amt=cents(val('cp-a'));if(!(amt>0))return w._err('El importe debe ser mayor a cero.'),false;const o=$('#cp-o',w);const ref=o.options[o.selectedIndex].text.split(' · ')[0];
   const t=`Hola ${crmFirst(c)}, el total ${ref==='Importe libre'?'':'('+ref+') '}es de ${money(amt)}.\nPodés transferir a:\n${P.alias?'• Alias: '+P.alias+'\n':''}${P.cbu?'• CBU/CVU: '+P.cbu+'\n':''}${P.holder?'• Titular: '+P.holder+'\n':''}Cuando lo hagas, mandanos el comprobante por acá. ¡Gracias!`;
   try{await crmSend(c,t,{kind:'cobro',amount:amt});c.pay={amount:amt,ts:now(),state:'pendiente',ref};audit('CRM_COBRO',crmWho(c)+' · '+money(amt)+' · '+ref);save();crmPaint();}catch(e){w._err(e.message);return false;}}});
 $('#cp-o',w).addEventListener('change',e=>{const a=+e.target.options[e.target.selectedIndex].dataset.a;if(a)$('#cp-a',w).value=(a/100).toFixed(2).replace('.',',');});};
A.crmPayOk=()=>{const c=crmCur();if(!c||!c.pay)return;confirmBox('Llegó el pago','Confirmá que viste la transferencia de '+money(c.pay.amount)+'. <b>Esto no registra el cobro</b>: después hacelo en Vender o Caja.',()=>{c.pay.state='recibido';c.pay.okBy=user?user.name:'';c.pay.okAt=now();
 crmAdd(c,'sys','Pago confirmado a mano por '+(user?user.name:'')+': '+money(c.pay.amount)+' — falta registrarlo en Vender/Caja',{kind:'cobro-ok'});audit('CRM_COBRO_RECIBIDO',crmWho(c)+' · '+money(c.pay.amount));save();crmPaint();toast('Anotado. Registrá el cobro en Vender o Caja.');},'Sí, llegó');};
function crmQuoteText(c,q){return `Hola ${crmFirst(c)}, te paso el presupuesto ${q.n}:\n${q.lines.map(l=>`• ${l.qty} × ${l.name} = ${money(Math.round(l.qty*l.price))}`).join('\n')}\nTotal: ${money(q.total)}. Válido hasta el ${dmy(dkey(q.exp))}.\n¿Te lo preparamos?`;}
A.crmQuote=()=>{const c=crmCur();const cu=c&&c.cust?custById(c.cust):null;if(!cu)return;const qs=quotes().filter(q=>q.cust===cu.id&&qtState(q)==='vigente');
 if(!qs.length)return toast('Este cliente no tiene presupuestos vigentes. Creá uno con «Nuevo presupuesto».',1);
 modal('Enviar presupuesto',`<label for="cq-q">Presupuesto</label><select id="cq-q">${qs.map(q=>`<option value="${q.id}">${esc(q.n)} · ${money(q.total)}</option>`).join('')}</select>`,
  {okText:'Enviar',onOk:async w=>{const q=quotes().find(x=>x.id===val('cq-q'));if(!q)return false;try{await crmSend(c,crmQuoteText(c,q),{kind:'presupuesto'});audit('CRM_PRESUPUESTO',q.n+' · '+crmWho(c));crmPaint();}catch(e){w._err(e.message);return false;}}});};
A.crmNewQuote=()=>{const c=crmCur();if(!c||!c.cust)return;pos.lines=[];pos.sel=-1;pos.cust=c.cust;pos.quote='';toast('Cargá los productos y tocá «Guardar como presupuesto». Después lo enviás desde Conversaciones.');go('vender');};
A.crmAppt=()=>{const c=crmCur();if(!c||!crmCfg().turnos)return;const d=new Date(now()+86400000);const ds=d.toISOString().slice(0,10);
 modal('Reservar turno',`<div class="grid g2"><div><label for="ca-d">Día</label><input id="ca-d" type="date" value="${ds}"></div><div><label for="ca-h">Hora</label><input id="ca-h" type="time" value="10:00" step="900"></div></div>
  <label for="ca-w">Motivo / servicio</label><input id="ca-w" maxlength="60" placeholder="Ej.: retiro de pedido, degustación, entrega"><label class="chk"><input type="checkbox" id="ca-s" checked> <span>Avisarle al cliente ahora</span></label>`,
  {okText:'Reservar',onOk:async w=>{const dd=val('ca-d'),hh=val('ca-h'),wt=val('ca-w').trim().replace(/[<>]/g,'').slice(0,60);if(!/^\d{4}-\d{2}-\d{2}$/.test(dd)||!/^\d{2}:\d{2}$/.test(hh))return w._err('Elegí día y hora.'),false;
   const at=new Date(dd+'T'+hh+':00').getTime();if(!(at>now()))return w._err('El turno tiene que ser a futuro.'),false;if(!wt)return w._err('Escribí el motivo.'),false;
   if(convs().some(x=>(x.appts||[]).some(a=>a.st!=='cancelado'&&Math.abs(a.at-at)<15*60000)))return w._err('Ya hay un turno en ese horario (±15 min).'),false;
   const a={id:uid(),at,what:wt,st:'reservado',by:user?user.name:''};c.appts=(c.appts||[]).concat(a);crmAdd(c,'sys','Turno reservado: '+crmHm(at)+' · '+wt,{kind:'turno'});audit('CRM_TURNO',crmWho(c)+' · '+crmHm(at));save();
   if($('#ca-s',w).checked){try{await crmSend(c,`Hola ${crmFirst(c)}, te confirmamos tu turno para el ${crmHm(at)} (${wt}). ¡Te esperamos!`,{kind:'turno'});}catch(e){toast(e.message,1);}}crmPaint();}});};
A.crmApptX=el=>{const c=crmCur();const a=c&&(c.appts||[]).find(x=>x.id===el.dataset.id);if(!a)return;confirmBox('Cancelar turno','Se cancela el turno del '+crmHm(a.at)+'.',()=>{a.st='cancelado';crmAdd(c,'sys','Turno cancelado: '+crmHm(a.at),{kind:'turno'});audit('CRM_TURNO',crmWho(c)+' · cancelado '+crmHm(a.at));save();crmPaint();},'Cancelar turno');};
async function crmCsatAskFor(c){const t=`Hola ${crmFirst(c)}, ¿cómo te atendimos? Respondé con un número del 1 (mal) al 5 (excelente). ¡Nos ayuda mucho!`;await crmSend(c,t,{kind:'encuesta',csat:true});c.asked=now();c.state='resuelta';save();}
A.crmCsatAsk=async()=>{const c=crmCur();if(!c)return;try{await crmCsatAskFor(c);crmPaint();}catch(e){toast(e.message,1);}};
A.crmCsatSet=el=>{const c=crmCur();const v=+el.dataset.v;if(!c||!(v>=1&&v<=5))return;c.csat=v;crmAdd(c,'sys','Calificación registrada: '+v+'/5 ('+(user?user.name:'')+')',{kind:'csat'});audit('CRM_CSAT',crmWho(c)+' · '+v+'/5');save();crmPaint();};
function crmConvFor(cu){return convs().filter(c=>c.cust===cu.id&&c.chan==='wa').sort((a,b)=>b.last-a.last)[0]||crmNew({chan:'wa',cust:cu.id});}
A.crmAviso=async el=>{const k=el.dataset.k,id=el.dataset.id;try{
 if(k==='deuda'){const cu=custById(id);if(!cu)return;const c=crmConvFor(cu);await crmSend(c,waDebtText(cu),{kind:'aviso-deuda'});crmSel=c.id;}
 else if(k==='presup'){const q=quotes().find(x=>x.id===id);const cu=q&&custById(q.cust);if(!cu)return;const c=crmConvFor(cu);await crmSend(c,crmQuoteText(c,q)+'\n(Te recordamos que vence pronto.)',{kind:'aviso-presupuesto'});crmSel=c.id;}
 else if(k==='turno'){const [cid,aid]=id.split('|');const c=convById(cid);const a=c&&(c.appts||[]).find(x=>x.id===aid);if(!a)return;await crmSend(c,`Hola ${crmFirst(c)}, te recordamos tu turno del ${crmHm(a.at)} (${a.what}). ¡Te esperamos!`,{kind:'aviso-turno'});a.rem=now();save();crmSel=c.id;}
 else if(k==='csat'){const c=convById(id);if(!c)return;await crmCsatAskFor(c);crmSel=c.id;}
 audit('CRM_AVISO',k);save();rerender();}catch(e){toast(e.message||'No se pudo.',1);}};
const CRM_SIM=[['ig','Hola! Tienen fernet? cuánto sale?'],['fb','Buenas, hacen envíos a domicilio?'],['tg','Quiero reservar un turno para retirar un pedido grande el sábado'],['mail','Hola, compré ayer y la botella vino rota, quiero hacer un reclamo urgente'],['web','Hola! hasta qué hora abren hoy?'],['wa','Gracias por todo, excelente atención!!']];
A.crmSim=()=>{if(!CRM_FULL)return;const C=crmCfg();const L=CRM_SIM.filter(x=>C.chans.includes(x[0]));const [ch,tx]=L[Math.floor(Math.random()*L.length)];const cus=S.customers.filter(c=>c.status!=='baja');const cu=cus[Math.floor(Math.random()*cus.length)];
 let c=convs().find(x=>x.chan===ch&&x.cust===(cu?cu.id:'')&&x.state!=='resuelta');if(!c)c=crmNew({chan:ch,cust:cu?cu.id:'',name:cu?'':'Cliente de ejemplo',tags:['ejemplo']});
 crmAdd(c,'in',tx,{via:'mensaje simulado (ejemplo)'});save();crmSel=c.id;rerender();toast('Llegó un mensaje de ejemplo por '+CHAN[ch]);};
A.crmCfgOpen=()=>{if(!can('config'))return toast('Sin permiso',1);const C=crmCfg();
 const w=modal('Ajustes del CRM',`<label class="chk"><input type="checkbox" id="cc-on" ${C.on?'checked':''}> <span>Activar Conversaciones</span></label>
  <label class="chk"><input type="checkbox" id="cc-web" ${C.web?'checked':''}> <span>Mostrar el chat «Escribinos» en el menú público</span></label>
  <label for="cc-g">Saludo del chat del menú</label><input id="cc-g" maxlength="160" value="${esc(C.greet)}">
  <p class="sm" style="margin:.5rem 0 .2rem"><b>Canales</b></p><div class="row" style="gap:.4rem">${Object.keys(CHAN).filter(k=>CRM_FULL||!CHAN_DEMO.includes(k)).map(k=>`<label class="chk" style="margin:0"><input type="checkbox" class="cc-ch" value="${k}" ${C.chans.includes(k)?'checked':''}> <span>${CHAN[k]}${CHAN_DEMO.includes(k)?' (demostración)':''}</span></label>`).join('')}</div>
  ${CRM_FULL?`<label class="chk"><input type="checkbox" id="cc-tu" ${C.turnos?'checked':''}> <span>Turnos y recordatorios de turno</span></label>`:''}
  <p class="sm" style="margin:.5rem 0 .2rem"><b>Cobro asistido</b> (datos que se envían al cliente)</p><div class="grid g2"><div><label for="cc-al">Alias</label><input id="cc-al" maxlength="40" value="${esc(C.pay.alias)}"></div><div><label for="cc-cb">CBU / CVU</label><input id="cc-cb" inputmode="numeric" maxlength="22" value="${esc(C.pay.cbu)}"></div></div>
  <label for="cc-ho">Titular</label><input id="cc-ho" maxlength="60" value="${esc(C.pay.holder)}">
  <p class="sm" style="margin:.5rem 0 .2rem"><b>Prioridad por reglas</b></p><label for="cc-w">Palabras que suben la prioridad (separadas por coma)</label><input id="cc-w" maxlength="400" value="${esc(C.words)}">
  <label for="cc-m">Minutos sin responder para prioridad alta</label><input id="cc-m" inputmode="numeric" value="${C.waitMin}">
  <label for="cc-r">Respuestas rápidas (una por línea: título | texto · {nombre} se reemplaza)</label><textarea id="cc-r" rows="6" style="width:100%">${esc(C.canned.map(x=>x.t+' | '+x.x).join('\n'))}</textarea>`,
  {okText:'Guardar',onOk:w=>{const m=parseNum(val('cc-m'));if(!(Number.isInteger(m)&&m>=5&&m<=1440))return w._err('Los minutos van de 5 a 1440.'),false;
   const cbu=val('cc-cb').replace(/\D/g,'');if(cbu&&cbu.length!==22)return w._err('El CBU/CVU tiene 22 números.'),false;
   const canned=val('cc-r').split('\n').map(l=>{const i=l.indexOf('|');return i>0?{t:l.slice(0,i).trim().slice(0,30),x:l.slice(i+1).trim().slice(0,500)}:null;}).filter(x=>x&&x.t&&x.x).slice(0,30);
   const chans=[...w.querySelectorAll('.cc-ch:checked')].map(x=>x.value).filter(k=>CHAN[k]);if(!chans.length)return w._err('Dejá al menos un canal.'),false;
   crmSet({on:$('#cc-on',w).checked,web:$('#cc-web',w).checked,greet:val('cc-g').trim().replace(/[<>]/g,'').slice(0,160),chans,turnos:CRM_FULL?$('#cc-tu',w).checked:false,
    pay:{alias:val('cc-al').trim().replace(/[^A-Za-z0-9.\-]/g,'').slice(0,40),cbu,holder:val('cc-ho').trim().replace(/[<>]/g,'').slice(0,60)},words:val('cc-w').replace(/[<>]/g,'').slice(0,400),waitMin:m,canned:canned.length?canned:CRM_CANNED});
   audit('CRM_AJUSTES',(crmCfg().on?'activado':'apagado')+' · canales '+chans.join(','));save();if(typeof pubRefresh==='function')pubRefresh();rerender();}});};

/* ---------- datos de ejemplo (sólo demos) ---------- */
function crmDemoSeed(){if(IS_CLIENT||S.crmDemo)return;const L=S.customers.filter(c=>c.status!=='baja');if(L.length<3)return;S.crmDemo=1;
 crmSet({pay:{alias:'comercio.ejemplo.mp',cbu:'',holder:'Comercio de ejemplo'}});const t=now();const at=(ago)=>t-ago*60000;
 const mk=(f,msgs,extra)=>{const c=crmNew(Object.assign({tags:['ejemplo']},f));msgs.forEach(([d,x,ago,o])=>{const m=crmAdd(c,d,x,Object.assign({ts:at(ago)},o||{}));if(m){m.ts=at(ago);if(d==='in')c.lastIn=m.ts;if(d==='out')c.lastOut=m.ts;}});c.last=at(Math.min(...msgs.map(x=>x[2])));Object.assign(c,extra||{});return c;};
 const p=S.products.find(x=>x.active&&x.price>0);
 mk({chan:'web',cust:L[0].id},[['in','Hola! '+(p?'¿Tienen '+p.name+'?':'¿Tienen stock?')+' ¿Cuánto sale?',95],['out','¡Hola! Sí, lo tenemos. ¿Te lo guardamos?',90,{user:'ejemplo',via:'enviado al chat'}],['in','Sí porfa, paso a la tarde',12]],{state:'abierta',unread:true});
 mk({chan:'wa',cust:L[1].id},[['in','Buenas, compré ayer y una botella vino rota. Quiero hacer un reclamo urgente',48]],{unread:true});
 mk({chan:'ig',name:'Lucía (Instagram, ejemplo)'},[['in','Hola! Hacen envíos a domicilio? 😊',30]],{unread:true});
 if(CRM_FULL){const c=mk({chan:'tg',cust:L[2].id},[['in','Quiero reservar un turno para retirar un pedido grande',300],['out','¡Dale! Te reservé para mañana a las 10.',290,{user:'ejemplo'}]],{state:'pendiente'});c.appts=[{id:uid(),at:t+20*3600e3,what:'Retiro de pedido (ejemplo)',st:'reservado',by:'ejemplo'}];}
 mk({chan:'local',cust:L[0].id},[['in','Gracias por la atención, excelente!',2000],['out','¡Gracias a vos!',1990,{user:'ejemplo'}]],{state:'resuelta',csat:5});}
