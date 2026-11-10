/* ===== V26.62 · ATENCIÓN AL CLIENTE (CRM omnicanal + ERP integrado) =====
   Pantalla «Atención al cliente» (antes «Conversaciones»). Cuatro bloques, adaptados a lo que el sistema puede hacer sin costos:
   1. Canales e inbox unificado: chat web del menú público (cifrado de punta a punta), WhatsApp asistido (wa.me), teléfono y local;
      en las demos además Instagram, Messenger, Telegram y correo como canales DE DEMOSTRACIÓN (la API oficial de Meta, el bot
      de Telegram para clientes y el correo necesitan las cuentas y credenciales de cada comercio). Estados Nuevo / En proceso /
      Pendiente / Cerrado, colas por departamento, agente asignado, filtros. Consulta cada 8 s (no hay WebSockets).
   2. Acciones ERP en el chat: presupuesto (texto + PDF para adjuntar), turnos (reservar, confirmar, reprogramar, cancelar),
      cobros (alias/CBU y link de pago FIJO del comercio de Mercado Pago o Stripe; el link dinámico por importe y la confirmación
      automática por webhook necesitan credenciales y servidor: pendiente), ficha 360° con compras, saldo, sellos, monedero y notas.
   3. Copiloto POR REGLAS (sin IA paga): respuestas sugeridas con datos del ERP, resumen al transferir, ánimo (Positivo / Neutro /
      Urgente-enojado) que ordena la cola, bot de primer nivel (preguntas frecuentes en el chat web y canales de demostración),
      calificación de leads y ruteo por departamento o por turnos (round robin).
   4. Analíticas y crecimiento: tiempo de primera respuesta, duración, CSAT, NPS, conversión a venta, por canal y por agente;
      alertas del ERP (stock crítico, deudas, presupuestos por vencer, cobros y turnos pendientes); campañas segmentadas con
      consentimiento (WhatsApp asistido, uno por uno; plantillas HSM de Meta: pendiente); encuesta postventa al cerrar.
   Permisos: agente = permiso «crm» (mostrador); supervisor/administrador ven el panel de supervisión y todas las colas; ajustes = config.
   Nada se envía solo por WhatsApp; nada mueve la caja. Sin el texto de los mensajes en Auditoría. Nube: 22-crm.sql. */
IC.chat='M21 12a8 8 0 0 1-11.7 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z';
const CRM_FULL=!IS_CLIENT;
const CHAN={web:'Chat web',wa:'WhatsApp',ig:'Instagram',fb:'Messenger',tg:'Telegram',mail:'Correo',tel:'Teléfono',local:'En el local'};
const CHAN_IC={web:'💬',wa:'🟢',ig:'📸',fb:'🔵',tg:'✈️',mail:'✉️',tel:'📞',local:'🏪'};
const CHAN_DEMO=['ig','fb','tg','mail']; // sin conexión real: sólo para mostrar en las demos
const CHAN_AUTO=['web'].concat(CHAN_DEMO); // canales donde el bot puede responder solo
const CST={nuevo:'Nuevo',proceso:'En proceso',pendiente:'Pendiente',cerrado:'Cerrado'};
const SENT_T={pos:'Positivo',neu:'Neutro',neg:'Urgente / enojado'};
const CRM_CANNED=[{t:'Saludo',x:'¡Hola {nombre}! Gracias por escribirnos. ¿En qué te podemos ayudar?'},
 {t:'Horario',x:'Hola {nombre}, estamos abiertos de lunes a sábado. ¡Te esperamos!'},
 {t:'Pedido listo',x:'Hola {nombre}, tu pedido ya está listo para retirar. ¡Gracias!'},
 {t:'Consultando',x:'Dame un minuto {nombre}, lo consulto y te confirmo.'},
 {t:'Gracias',x:'¡Gracias {nombre}! Cualquier cosa nos escribís por acá.'}];
const CRM_FAQ=[{k:'horario, abren, cierran, abierto, hasta que hora',a:'¡Hola! Nuestro horario está en el menú. En un ratito te atiende una persona del equipo.'},
 {k:'envio, envios, delivery, domicilio, mandan',a:'¡Hola! Sí, hacemos envíos. Contanos tu dirección y qué necesitás, y te pasamos el costo.'},
 {k:'alias, cbu, transferencia, como pago',a:'¡Hola! Podés pagar por transferencia: en un momento te pasamos los datos y el total.'}];
const CRM_DEF={on:CRM_FULL,web:true,chans:CRM_FULL?Object.keys(CHAN):['web','wa','tel','local'],greet:'¡Hola! Escribinos y te respondemos por acá.',
 words:'reclamo,urgente,problema,devolucion,queja,no funciona,mal estado,vencido,roto,estafa,cancelar',waitMin:30,turnos:CRM_FULL,canned:CRM_CANNED,
 depts:['Ventas','Soporte','Cobranzas'],route:CRM_FULL?'dept':'manual',rr:[],rrIdx:0,bot:{on:CRM_FULL,faq:CRM_FAQ},autoSurvey:CRM_FULL,
 pay:{alias:'',cbu:'',holder:'',link:''},camps:[]};
const crmCfg=()=>{const c=(S.cfg&&S.cfg.crm)||{};const o=Object.assign({},CRM_DEF,c);o.pay=Object.assign({},CRM_DEF.pay,c.pay||{});o.bot=Object.assign({},CRM_DEF.bot,c.bot||{});
 if(!Array.isArray(o.bot.faq))o.bot.faq=CRM_FAQ;if(!Array.isArray(o.canned))o.canned=CRM_CANNED;if(!Array.isArray(o.chans))o.chans=CRM_DEF.chans;if(!Array.isArray(o.depts)||!o.depts.length)o.depts=CRM_DEF.depts;
 if(!Array.isArray(o.rr))o.rr=[];if(!Array.isArray(o.camps))o.camps=[];if(!CRM_FULL)o.chans=o.chans.filter(k=>!CHAN_DEMO.includes(k));return o;};
function crmSet(v){S.cfg.crm=Object.assign({},(S.cfg.crm||{}),v);}
const convs=()=>S.convs||(S.convs=[]);const cmsgs=()=>S.cmsgs||(S.cmsgs=[]);
const convById=id=>convs().find(c=>c.id===id)||null;
const convMsgs=id=>cmsgs().filter(m=>m.conv===id).sort((a,b)=>a.ts-b.ts||String(a.id).localeCompare(String(b.id)));
/* estados de versiones anteriores (abierta/resuelta) se leen como los nuevos */
function crmFix(c){if(c.state==='abierta')c.state=c.lastOut?'proceso':'nuevo';else if(c.state==='resuelta'){c.state='cerrado';c.closedAt=c.closedAt||c.last;}else if(!CST[c.state])c.state='nuevo';if(!Array.isArray(c.tags))c.tags=[];if(!Array.isArray(c.appts))c.appts=[];return c;}
const crmOpen=c=>c.state!=='cerrado';
const crmNorm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const crmTxt=t=>String(t==null?'':t).replace(/\r/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim().slice(0,1500);
const crmHm=ts=>{const d=new Date(ts);return d.toLocaleDateString('es-AR',{day:'numeric',month:'numeric'})+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});};
const crmDur=ms=>{if(!(ms>=0))return '—';const m=Math.round(ms/60000);return m<60?m+' min':m<1440?(m/60).toFixed(1).replace('.',',')+' h':(m/1440).toFixed(1).replace('.',',')+' d';};
const crmFirst=c=>{const cu=c&&c.cust?custById(c.cust):null;return String((cu&&cu.name)||(c&&c.name)||'').trim().split(/\s+/)[0]||'';};
const crmWho=c=>{const cu=c.cust?custById(c.cust):null;return cu?custFull(cu):(c.name||'Sin nombre');};
const crmWa=c=>{const cu=c.cust?custById(c.cust):null;if(cu&&waOk(cu))return waDigits(cu);const d=String(c.wa||'').replace(/\D/g,'');return /^549\d{10}$/.test(d)?d:'';};
const crmSup=()=>!!user&&(can('config')||user.role==='admin'||user.role==='supervisor');
const crmMe=()=>user?user.name:'';
function crmAgents(){const s=new Set();(S.users||[]).forEach(u=>{if(u&&u.name)s.add(u.name);});convs().forEach(c=>{if(c.asg)s.add(c.asg);});crmCfg().rr.forEach(n=>s.add(n));if(user&&user.name)s.add(user.name);return[...s].sort((a,b)=>a.localeCompare(b,'es'));}
function crmNew(f){const c={id:f.id||('c'+uid()),chan:f.chan,cust:f.cust||'',name:String(f.name||'').replace(/[<>]/g,'').slice(0,60),wa:String(f.wa||'').slice(0,20),k:f.k||'',
 state:'nuevo',asg:f.asg||'',dept:f.dept||'',tags:Array.isArray(f.tags)?f.tags:[],ts:f.ts||now(),last:f.ts||now(),lastIn:0,lastOut:0,firstIn:0,firstOut:0,lastTxt:'',unread:false,appts:[],asked:0};convs().push(c);return c;}
function crmAdd(c,dir,text,extra){const m=Object.assign({id:'m'+uid(),conv:c.id,dir,text:crmTxt(text),ts:now(),user:dir==='in'?'cliente':(user?user.name:'sistema'),chan:c.chan,kind:'msg'},extra||{});
 if(cmsgs().some(x=>x.id===m.id))return null;cmsgs().push(m);if(m.ts>=(c.last||0))c.last=m.ts;crmFix(c);
 if(dir==='in'){c.lastIn=Math.max(c.lastIn||0,m.ts);if(!c.firstIn)c.firstIn=m.ts;c.unread=true;if(c.state==='cerrado'||c.state==='pendiente')c.state=c.lastOut?'proceso':'nuevo';}
 if(dir==='out'){c.lastOut=Math.max(c.lastOut||0,m.ts);if(!c.firstOut&&m.kind!=='bot')c.firstOut=m.ts;c.unread=false;}
 if(dir==='in'||dir==='out')c.lastTxt=(dir==='out'?(m.kind==='bot'?'Bot: ':'Vos: '):'')+m.text.slice(0,80);return m;}

/* ---------- copiloto por reglas: ánimo, intención, prioridad, sugerencias, resumen, ruteo y bot ---------- */
const CRM_NEG=['reclamo','queja','mal','malo','pesimo','horrible','nunca','enojado','roto','vencido','demora','problema','no funciona','estafa','devolver','devolucion','cancelar','urgente','harto'];
const CRM_POS=['gracias','genial','excelente','buenisimo','perfecto','joya','barbaro','me encanto','buena atencion','10 puntos','espectacular'];
const CRM_INT=[['precio','Consulta de precio',['precio','cuanto sale','cuanto cuesta','cuanto esta','valor','sale el','cuesta']],['stock','Consulta de stock',['tenes','tienen','hay ','stock','queda','les queda']],
 ['pedido','Pedido o compra',['quiero','pedido','encargar','me guardas','reservar','para llevar','envio','delivery']],['horario','Horario',['horario','abren','cierran','abierto','hasta que hora']],
 ['pago','Pago',['pagar','transferencia','alias','cbu','tarjeta','mercado pago','comprobante','pague']],['turno','Turno o reserva',['turno','cita','agenda','reserva para','hora para','cancha']],
 ['reclamo','Reclamo',['reclamo','queja','problema','devolver','devolucion','no funciona','mal estado','vencido','roto']]];
const CRM_DEPT_OF={precio:'Ventas',stock:'Ventas',pedido:'Ventas',turno:'Ventas',horario:'Ventas',reclamo:'Soporte',pago:'Cobranzas'};
const crmHas=(t,w)=>new RegExp('(^|[^a-z0-9])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^a-z0-9])').test(t);
function crmSent(text){const t=crmNorm(text);let s=0;CRM_NEG.forEach(w=>{if(crmHas(t,w))s--;});CRM_POS.forEach(w=>{if(crmHas(t,w))s++;});if(/!{2,}|\?{3,}/.test(text||''))s--;return s<0?'neg':s>0?'pos':'neu';}
function crmIntent(text){const t=' '+crmNorm(text)+' ';const L=CRM_INT.filter(([,,ws])=>ws.some(w=>t.includes(w)));const r=L.find(x=>x[0]==='reclamo')||L[0];return r?{k:r[0],t:r[1]}:null;}
function crmProdsIn(text){const t=crmNorm(text);if(t.length<3)return[];
 const L=S.products.filter(p=>p.active&&!p.archived).map(p=>{const ws=[...new Set(crmNorm(p.name).split(/[^a-z0-9]+/).filter(w=>w.length>=4))];const hit=ws.filter(w=>crmHas(t,w)).length;return{p,hit,need:Math.min(2,ws.length),r:ws.length?hit/ws.length:0};})
  .filter(x=>x.need>0&&x.hit>=x.need).sort((a,b)=>b.hit-a.hit||b.r-a.r);return L.filter(x=>x.hit===(L[0]||{}).hit).slice(0,3).map(x=>x.p);}
function crmMood(c){const ins=convMsgs(c.id).filter(m=>m.dir==='in').slice(-3).map(m=>crmSent(m.text));return ins.includes('neg')?'neg':ins.includes('pos')?'pos':'neu';}
function crmPrio(c){const C=crmCfg();const why=[];if(!crmOpen(c))return{lv:'baja',why};
 const ins=convMsgs(c.id).filter(m=>m.dir==='in');const last=ins[ins.length-1];
 const words=C.words.split(',').map(w=>crmNorm(w).trim()).filter(Boolean);const hit=last&&words.find(w=>crmNorm(last.text).includes(w));
 if(hit)why.push('dice «'+hit+'»');if(last&&crmSent(last.text)==='neg'&&!hit)why.push('cliente molesto');
 const wait=c.unread&&c.lastIn?Math.floor((now()-c.lastIn)/60000):0;if(wait>=C.waitMin)why.push('espera '+(wait>=120?Math.floor(wait/60)+' h':wait+' min'));
 const debt=c.cust?debtOf(c.cust):0;
 const lv=why.length?'alta':(c.unread||debt>0)?'media':'normal';if(debt>0)why.push('debe '+money(debt));return{lv,why};}
const PRIO_T={alta:'Prioridad alta',media:'Prioridad media',normal:'Normal',baja:'Cerrada'};
function crmPayText(nm,amt,ref){const P=crmCfg().pay;const L=[`Hola ${nm}, ${amt?'el total '+(ref&&ref!=='Importe libre'?'('+ref+') ':'')+'es de '+money(amt)+'.':'te pasamos los datos para pagar.'}`];
 if(P.link)L.push('Pagá con este link: '+P.link);if(P.alias||P.cbu){L.push(P.link?'O por transferencia:':'Podés transferir a:');if(P.alias)L.push('• Alias: '+P.alias);if(P.cbu)L.push('• CBU/CVU: '+P.cbu);if(P.holder)L.push('• Titular: '+P.holder);}
 L.push('Cuando lo hagas, mandanos el comprobante por acá. ¡Gracias!');return L.join('\n');}
function crmSuggest(c){const ins=convMsgs(c.id).filter(m=>m.dir==='in');const last=ins[ins.length-1];const nm=crmFirst(c);const out=[];if(!last||c.lastOut>last.ts)return out;
 const it=crmIntent(last.text);const ps=crmProdsIn(last.text);
 if(ps.length&&(!it||it.k==='precio'||it.k==='stock'||it.k==='pedido'))ps.forEach(p=>{const st=typeof stockOf==='function'?stockOf(p):1;out.push(`Hola ${nm}, ${p.name}${p.sub?' '+p.sub:''} está a ${money(p.price)}${st>0?' y lo tenemos disponible':' pero en este momento no nos queda'}. ¿Te lo guardamos?`);});
 if(it&&it.k==='horario')out.push(`Hola ${nm}, estamos abiertos de lunes a sábado. ¡Te esperamos!`);
 if(it&&it.k==='pago'){const P=crmCfg().pay;if(P.alias||P.cbu||P.link)out.push(crmPayText(nm,0,''));}
 if(it&&it.k==='reclamo')out.push(`Hola ${nm}, lamentamos mucho lo que pasó. Contanos qué producto fue y te lo resolvemos hoy mismo.`);
 if(it&&it.k==='turno'&&crmCfg().turnos)out.push(`Hola ${nm}, ¿qué día y horario te queda cómodo? Te reservo el turno.`);
 if(it&&it.k==='pedido'&&!ps.length)out.push(`¡Dale ${nm}! Pasame qué necesitás y las cantidades, y te armo el presupuesto.`);
 const cu=c.cust?custById(c.cust):null;if(cu&&debtOf(cu.id)>0&&(!it||it.k==='pago'))out.push(waDebtText(cu));
 if(!out.length)out.push(`Hola ${nm}, gracias por escribirnos. Ya lo vemos y te respondemos.`);return [...new Set(out)].slice(0,3);}
function crmSummary(c){const M=convMsgs(c.id);const ins=M.filter(m=>m.dir==='in');const L=[];
 const its=[...new Set(ins.map(m=>(crmIntent(m.text)||{}).t).filter(Boolean))];
 L.push(`${ins.length} mensaje(s) del cliente y ${M.filter(m=>m.dir==='out').length} respuesta(s) por ${CHAN[c.chan]||c.chan}${c.dept?' · cola '+c.dept:''}.`);
 if(its.length)L.push('Temas: '+its.join(', ')+'.');L.push('Ánimo del cliente: '+SENT_T[crmMood(c)]+'.');
 const ps=[...new Set(ins.flatMap(m=>crmProdsIn(m.text)).map(p=>p.name))];if(ps.length)L.push('Productos mencionados: '+ps.slice(0,5).join(', ')+'.');
 if(c.pay&&c.pay.state==='pendiente')L.push('Cobro pendiente por '+money(c.pay.amount)+'.');
 const ap=(c.appts||[]).filter(a=>a.st!=='cancelado'&&a.at>now());if(ap.length)L.push('Turno: '+crmHm(ap[0].at)+' ('+ap[0].what+', '+ap[0].st+').');
 const notes=M.filter(m=>m.dir==='note');if(notes.length)L.push(notes.length+' nota(s) interna(s).');
 const lastIn=ins[ins.length-1];L.push(!crmOpen(c)?'Conversación cerrada'+(c.csat?' · CSAT '+c.csat+'/5':'')+(c.nps!=null?' · NPS '+c.nps+'/10':'')+'.':(lastIn&&c.lastOut<lastIn.ts?'Falta responder el último mensaje.':'Esperando respuesta del cliente.'));return L;}
function crmRoute(c,text){const C=crmCfg();const it=crmIntent(text);
 if(it&&(it.k==='precio'||it.k==='pedido')&&!c.tags.includes('lead'))c.tags=c.tags.concat('lead').slice(0,6);
 if(!c.dept&&(C.route==='dept'||C.route==='rr'))c.dept=(it&&CRM_DEPT_OF[it.k]&&C.depts.includes(CRM_DEPT_OF[it.k]))?CRM_DEPT_OF[it.k]:C.depts[0];
 if(!c.asg&&C.route==='rr'&&C.rr.length){const i=(+C.rrIdx||0)%C.rr.length;c.asg=C.rr[i];crmSet({rrIdx:i+1});}}
function crmBotMatch(text){const C=crmCfg();if(!C.bot.on)return null;const t=' '+crmNorm(text)+' ';return C.bot.faq.find(f=>String(f.k||'').split(',').map(x=>crmNorm(x).trim()).filter(Boolean).some(w=>crmHas(t,w)))||null;}
async function crmBot(c,text){if(!CHAN_AUTO.includes(c.chan))return;const f=crmBotMatch(text);if(!f)return;const key=crmNorm(f.k).slice(0,40);c.botA=Array.isArray(c.botA)?c.botA:[];if(c.botA.includes(key))return;c.botA.push(key);
 try{await crmSend(c,f.a,{kind:'bot',by:'Asistente automático',noState:1});audit('CRM_BOT',(CHAN[c.chan]||c.chan)+' · respuesta frecuente');}catch(e){}}

/* ---------- entrada del chat web (cliente) ---------- */
const CONV_RX=/^w[A-Za-z0-9_-]{16,40}$/;
function crmInbound(p,srv){if(!p||!CONV_RX.test(String(p.conv||'')))return false;const text=crmTxt(p.text);
 let c=convById(p.conv);const isNew=!c;
 if(!c){if(p.t==='csat'||p.t==='nps')return false;const cu=(p.card&&custByCard(p.card))||(normWA(p.wa)&&S.customers.find(x=>x.status!=='baja'&&normWA(x.wa)===normWA(p.wa)))||null;
  c=crmNew({id:p.conv,chan:'web',cust:cu?cu.id:'',name:p.name,wa:normWA(p.wa)?'549'+normWA(p.wa):'',k:typeof p.k==='string'&&p.k.length>=40&&p.k.length<=48?p.k:''});
  audit('CRM_NUEVA','chat web'+(cu?' · socio '+pad4(cu.num):''));}
 else{crmFix(c);if(!c.k&&typeof p.k==='string'&&p.k.length>=40)c.k=p.k;}
 const mid='w'+(srv||String(p.mid||'').replace(/[^A-Za-z0-9]/g,'').slice(0,24));
 if(cmsgs().some(x=>x.id===mid))return null;
 if(p.t==='csat'){const v=Math.round(+p.v);if(!(v>=1&&v<=5))return false;c.csat=v;crmAdd(c,'sys','El cliente calificó la atención (CSAT): '+v+'/5',{id:mid,kind:'csat'});audit('CRM_CSAT','chat web · '+v+'/5');return true;}
 if(p.t==='nps'){const v=Math.round(+p.v);if(!(v>=0&&v<=10))return false;c.nps=v;crmAdd(c,'sys','El cliente respondió la encuesta NPS: '+v+'/10',{id:mid,kind:'nps'});audit('CRM_NPS','chat web · '+v+'/10');return true;}
 if(!text)return false;crmAdd(c,'in',text,{id:mid,ts:Math.min(now(),+p.ts||now())});if(isNew)crmRoute(c,text);crmBot(c,text);return true;}

/* ---------- salida: responder por el canal de la conversación ---------- */
async function crmAesSeal(kB64,obj){const k=await crypto.subtle.importKey('raw',unb64(kB64),'AES-GCM',false,['encrypt']);const iv=rnd(12);
 const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,te.encode(JSON.stringify(obj))));return{iv:b64(iv),ct:b64(ct)};}
async function crmAesOpen(kB64,box){const k=await crypto.subtle.importKey('raw',unb64(kB64),'AES-GCM',false,['decrypt']);
 return JSON.parse(td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv)},k,unb64(box.ct))));}
const crmCloud=()=>typeof CLOUD!=='undefined'&&CLOUD.on;
async function crmSend(c,text,extra){text=crmTxt(text);if(!text)throw new Error('Escribí el mensaje.');extra=extra||{};const by=extra.by||(user?user.name:'sistema');
 if(c.chan==='web'&&crmCloud()){if(!c.k)throw new Error('Este chat no tiene su clave: pedile al cliente que vuelva a escribir desde el menú.');
  if(!cl.ready||!cl.online)throw new Error('Sin conexión con la nube: la respuesta NO se envió.');
  const box=await crmAesSeal(c.k,{text,ts:now(),u:String(by).split(/\s+/)[0],survey:extra.survey||''});
  await rpc('crm_web_responder',{p_comercio:cl.comercio.id,p_conv:c.id,p_cifrado:box});}
 if(c.chan==='wa'){const d=crmWa(c);if(!d)throw new Error('La conversación no tiene un WhatsApp válido (código de área + número).');openExternal('https://wa.me/'+d+'?text='+encodeURIComponent(text));}
 const via={web:'enviado al chat',wa:'abierto en WhatsApp (el envío lo confirmás vos)',tel:'registrado (llamada)',local:'registrado (en el local)'}[c.chan]||'canal de demostración (no se envió a ninguna red)';
 const m=crmAdd(c,'out',text,Object.assign({via,user:by},extra.kind?{kind:extra.kind}:{},extra.amount?{amount:extra.amount}:{},extra.survey?{survey:extra.survey}:{}));
 if(!extra.noState&&c.state!=='cerrado')c.state='pendiente';
 if(extra.kind!=='bot')audit('CRM_RESPUESTA',(CHAN[c.chan]||c.chan)+' · '+crmWho(c)+(extra.kind&&extra.kind!=='msg'?' · '+extra.kind:''));save();return m;}

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
 async function survey(kind,v){const o=st();v=Math.round(+v);const ok=kind==='nps'?(v>=0&&v<=10):(v>=1&&v<=5);if(!o||!ok)return{ok:false};
  const p={conv:o.conv,k:o.k,t:kind,v,mid:crmB64u(rnd(9)),ts:Date.now()};
  try{await push(o,p);}catch(e){return{ok:false,msg:'No se pudo enviar. Probá de nuevo.'};}
  o[kind+'Done']=v;o.msgs=(o.msgs||[]).concat({d:'sys',x:(kind==='nps'?'Tu respuesta: '+v+'/10':'Calificaste la atención: '+v+'/5')+'. ¡Gracias!',ts:Date.now()});put(o);return{ok:true};}
 return{
  chatOn:on,chatGreet:()=>{const s=site();return s.chat?s.chat.greet:'';},
  chatState:()=>{const o=st();return o?{name:o.name,msgs:(o.msgs||[]).slice(-80),csat:!!o.csatAsk&&o.csatDone==null,nps:!!o.npsAsk&&o.npsDone==null}:null;},
  chatSend:async(text,name,wa)=>{text=crmTxt(text);const t=Date.now();const rec=hits.filter(x=>t-x<60000);if(rec.length>=6)return{ok:false,msg:'Estás mandando muchos mensajes seguidos: esperá un minuto.'};
   if(!text)return{ok:false,msg:'Escribí tu mensaje.'};let o=st();
   if(!o){const nm=String(name||'').trim().replace(/[<>]/g,'').slice(0,60);if(nm.length<2)return{ok:false,msg:'Decinos tu nombre.'};const w=normWA(wa);if(String(wa||'').trim()&&!w)return{ok:false,msg:'El WhatsApp no es válido (o dejalo vacío).'};
    o={conv:'w'+crmB64u(rnd(18)),k:b64(rnd(32)),name:nm,wa:w,msgs:[],last:0,lastTs:0};}
   const mid=crmB64u(rnd(9));const p={conv:o.conv,k:o.k,name:o.name,wa:o.wa?waFull(o.wa):'',card:(()=>{try{return localStorage.getItem('rave.card')||'';}catch(e){return '';}})(),text,ts:t,mid,t:'msg',v:'v1'};
   o.msgs=(o.msgs||[]).concat({d:'in',x:text,ts:t}).slice(-80);put(o);
   try{await push(o,p);}catch(e){o.msgs=o.msgs.slice(0,-1);put(o);return{ok:false,msg:'No se pudo enviar (¿hay internet?). Probá de nuevo.'};}
   hits.push(t);return{ok:true};},
  chatPoll:async()=>{const o=st();if(!o)return 0;let add=[];
   if(crmCloud()){try{const rows=await rpc('crm_web_leer',{p_slug:CLOUD.slug,p_conv:o.conv,p_desde:o.last||0},{auth:false});
     for(const r of (rows||[])){o.last=Math.max(o.last||0,+r.id||0);try{const m=await crmAesOpen(o.k,r.cifrado);add.push({d:'out',x:crmTxt(m.text),ts:+m.ts||Date.parse(r.creado),u:String(m.u||'').slice(0,20),survey:m.survey||(m.csat?'csat':'')});}catch(e){}}}catch(e){return -1;}}
   else{add=cmsgs().filter(m=>m.conv===o.conv&&m.dir==='out'&&m.ts>(o.lastTs||0)).sort((a,b)=>a.ts-b.ts).map(m=>({d:'out',x:m.text,ts:m.ts,u:String(m.user||'').split(/\s+/)[0],survey:m.survey||''}));}
   if(add.length){add.forEach(a=>{if(a.ts>(o.lastTs||0))o.lastTs=a.ts;if(a.survey==='csat'){o.csatAsk=1;delete o.csatDone;}if(a.survey==='nps'){o.npsAsk=1;delete o.npsDone;}});o.msgs=(o.msgs||[]).concat(add).slice(-80);}put(o);return add.length;},
  chatCsat:v=>survey('csat',v),chatNps:v=>survey('nps',v),
  chatReset:()=>{try{localStorage.removeItem(KEY);}catch(e){}}};}

/* ---------- analíticas (sin datos personales) ---------- */
function crmStats(days){const t0=now()-(days||30)*864e5;const L=convs().map(crmFix).filter(c=>c.ts>=t0);
 const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
 const frt=L.filter(c=>c.firstIn&&c.firstOut&&c.firstOut>=c.firstIn).map(c=>c.firstOut-c.firstIn);
 const aht=L.filter(c=>c.state==='cerrado'&&c.closedAt&&c.firstIn).map(c=>c.closedAt-c.firstIn);
 const cs=L.filter(c=>c.csat>=1);const np=L.filter(c=>c.nps!=null&&c.nps>=0);
 const csat=cs.length?Math.round(cs.filter(c=>c.csat>=4).length/cs.length*100):null;
 const nps=np.length?Math.round((np.filter(c=>c.nps>=9).length-np.filter(c=>c.nps<=6).length)/np.length*100):null;
 const withC=L.filter(c=>c.cust);let convN=0,convAmt=0;
 withC.forEach(c=>{const ss=S.sales.filter(s=>s.cust===c.cust&&s.status==='ok'&&s.ts>=c.ts&&s.ts<=c.ts+3*864e5);if(ss.length){convN++;convAmt+=ss.reduce((a,s)=>a+(s.total||0),0);}});
 const byCh={},byAg={},byDay={};L.forEach(c=>{byCh[c.chan]=(byCh[c.chan]||0)+1;const a=c.asg||'Sin asignar';const o=byAg[a]||(byAg[a]={n:0,open:0,frt:[],cs:[]});o.n++;if(crmOpen(c))o.open++;if(c.firstIn&&c.firstOut&&c.firstOut>=c.firstIn)o.frt.push(c.firstOut-c.firstIn);if(c.csat)o.cs.push(c.csat);
  const d=dkey(c.ts);byDay[d]=(byDay[d]||0)+1;});
 return{n:L.length,open:L.filter(crmOpen).length,frt:avg(frt),aht:avg(aht),csat,csatN:cs.length,nps,npsN:np.length,conv:withC.length?Math.round(convN/withC.length*100):null,convN,convAmt,withC:withC.length,byCh,byAg,byDay,leads:L.filter(c=>c.tags.includes('lead')).length};}
function crmAlerts(){const out=[];const t=now();
 try{S.products.filter(p=>p.active&&!p.archived&&stockOf(p)<=5).sort((a,b)=>stockOf(a)-stockOf(b)).slice(0,5).forEach(p=>out.push({lv:stockOf(p)<=0?'crit':'warn',t:(stockOf(p)<=0?'Sin stock: ':'Stock bajo: ')+p.name+' ('+stockOf(p)+')',go:'inventario'}));}catch(e){}
 try{const D=typeof wsOpenDocs==='function';S.customers.filter(c=>c.status!=='baja'&&debtOf(c.id)>0).map(c=>{let over=false;if(D){over=wsOpenDocs(c.id).some(d=>d.due&&d.due<t);}return{c,over};}).sort((a,b)=>(b.over-a.over)||(debtOf(b.c.id)-debtOf(a.c.id))).slice(0,5)
  .forEach(x=>out.push({lv:x.over?'crit':'warn',t:(x.over?'Pago vencido: ':'Deuda: ')+custFull(x.c)+' · '+money(debtOf(x.c.id)),act:'deuda',id:x.c.id}));}catch(e){}
 try{(typeof quotes==='function'?quotes():[]).filter(q=>qtState(q)==='vigente'&&q.exp-t<2*864e5).slice(0,4).forEach(q=>out.push({lv:'warn',t:'Presupuesto '+q.n+' vence '+dmy(dkey(q.exp))+(q.custName?' · '+q.custName:''),go:'presup'}));}catch(e){}
 convs().forEach(c=>{if(c.pay&&c.pay.state==='pendiente'&&t-c.pay.ts>48*3600e3)out.push({lv:'warn',t:'Cobro sin confirmar hace '+crmDur(t-c.pay.ts)+': '+crmWho(c)+' · '+money(c.pay.amount),conv:c.id});
  (c.appts||[]).filter(a=>a.st==='reservado'&&a.at>t&&a.at-t<24*3600e3).forEach(a=>out.push({lv:'warn',t:'Turno sin confirmar: '+crmWho(c)+' · '+crmHm(a.at),conv:c.id}));});
 return out;}

/* ---------- pantalla ---------- */
let crmSel='',crmMode='msg',crmTab='inbox',crmF={st:'activas',ch:'',q:'',ag:'',dept:''},crmTimer=null;
function crmVisible(c){if(crmSup())return true;const me=crmMe();return !c.asg||c.asg===me;}
function crmList(){const q=crmNorm(crmF.q);const me=crmMe();return convs().map(crmFix).filter(c=>crmVisible(c)&&(crmF.st==='activas'?crmOpen(c):crmF.st==='todas'?true:c.state===crmF.st)&&(!crmF.ch||c.chan===crmF.ch)
  &&(!crmF.ag||(crmF.ag==='__me'?c.asg===me:crmF.ag==='__none'?!c.asg:c.asg===crmF.ag))&&(!crmF.dept||c.dept===crmF.dept)
  &&(!q||crmNorm(crmWho(c)+' '+(c.tags||[]).join(' ')+' '+(c.lastTxt||'')+' '+(c.dept||'')).includes(q)))
 .map(c=>({c,p:crmPrio(c)})).sort((a,b)=>({alta:0,media:1,normal:2,baja:3}[a.p.lv]-{alta:0,media:1,normal:2,baja:3}[b.p.lv])||(b.c.last-a.c.last));}
const PRIO_C={alta:'var(--crm-a)',media:'var(--crm-m)',normal:'var(--crm-n)',baja:'inherit'};
const ST_CLS={nuevo:'crm-st-n',proceso:'crm-st-p',pendiente:'crm-st-w',cerrado:'crm-st-c'};
function crmListHTML(){const L=crmList();if(!L.length)return'<p class="sm mut" style="padding:.6rem">No hay conversaciones con este filtro.</p>';
 return L.map(({c,p})=>`<button type="button" class="crm-it${c.id===crmSel?' on':''}" data-act="crmOpen" data-id="${esc(c.id)}" aria-pressed="${c.id===crmSel}">
  <span class="row" style="gap:.3rem;flex-wrap:nowrap"><span aria-hidden="true">${CHAN_IC[c.chan]||'💬'}</span><b class="sp" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(crmWho(c))}</b><span class="crm-st ${ST_CLS[c.state]}">${CST[c.state]}</span>${c.unread?'<span class="crm-dot" title="Sin leer" aria-label="Sin leer">●</span>':''}</span>
  <span class="sm mut" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.lastTxt||'—')}</span>
  <span class="sm" style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.2rem"><span style="color:${PRIO_C[p.lv]};font-weight:600">${PRIO_T[p.lv]}</span><span class="mut">· ${esc(CHAN[c.chan]||c.chan)}${c.dept?' · '+esc(c.dept):''}${c.asg?' · '+esc(c.asg):''} · ${crmHm(c.last)}</span>${(c.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</span></button>`).join('');}
function crmQueuesHTML(){const C=crmCfg();const open=convs().map(crmFix).filter(c=>crmOpen(c)&&crmVisible(c));
 const q=C.depts.map(d=>[d,open.filter(c=>c.dept===d&&!c.asg).length]);const none=open.filter(c=>!c.dept&&!c.asg).length;const mine=open.filter(c=>c.asg===crmMe()).length;
 return `<div class="crm-q"><b class="sm">Colas de espera</b>${q.map(([d,n])=>`<button type="button" class="btn sm ${crmF.dept===d&&crmF.ag==='__none'?'on':''}" data-act="crmQueue" data-d="${esc(d)}">${esc(d)} <b>${n}</b></button>`).join('')}${none?`<button type="button" class="btn sm" data-act="crmQueue" data-d="">Sin cola <b>${none}</b></button>`:''}<button type="button" class="btn sm ${crmF.ag==='__me'?'on':''}" data-act="crmMine">Mis chats <b>${mine}</b></button></div>`;}
function crmThreadHTML(){const c=convById(crmSel);if(!c)return'<p class="mut" style="padding:1rem">Elegí una conversación de la lista.</p>';crmFix(c);
 const p=crmPrio(c);const demo=CHAN_DEMO.includes(c.chan);const mood=crmMood(c);
 const msgs=convMsgs(c.id).map(m=>m.dir==='sys'?`<div class="crm-m sys">${esc(m.text)} · ${crmHm(m.ts)}</div>`
  :`<div class="crm-m ${m.dir}${m.kind==='bot'?' bot':''}"><div>${esc(m.text)}</div><div class="sm mut" style="margin-top:.2rem">${m.dir==='note'?'🔒 Nota interna · '+esc(m.user)+' · ':m.dir==='out'?(m.kind==='bot'?'🤖 ':'')+esc(m.user)+' · ':''}${crmHm(m.ts)}${m.via?' · '+esc(m.via):''}${m.kind&&!['msg','bot','nota'].includes(m.kind)?' · '+esc(m.kind):''}${m.dir==='in'?' · '+SENT_T[crmSent(m.text)]:''}</div></div>`).join('');
 return `<div class="row" style="gap:.4rem;align-items:center"><b class="sp" style="font-size:1.05rem">${CHAN_IC[c.chan]||''} ${esc(crmWho(c))}</b><span class="crm-st ${ST_CLS[c.state]}">${CST[c.state]}</span>
  <select id="crm-st" aria-label="Estado de la conversación">${Object.entries(CST).map(([k,t])=>`<option value="${k}" ${c.state===k?'selected':''}>${t}</option>`).join('')}</select></div>
  <div class="crm-bar" role="toolbar" aria-label="Acciones de la conversación"><button class="btn sm" data-act="crmTransfer">↪ Transferir</button><button class="btn sm" data-act="crmMode" data-m="note">🔒 Notas internas</button><button class="btn sm" data-act="crmTags">🏷 Etiquetar</button><button class="btn sm" data-act="crmAsg">${c.asg===crmMe()?'Soltar':c.asg?'Tomar (de '+esc(c.asg)+')':'Tomar'}</button>${crmOpen(c)?'<button class="btn sm crm-close" data-act="crmClose">✕ Cerrar</button>':'<button class="btn sm" data-act="crmReopen">Reabrir</button>'}</div>
  <p class="sm" style="margin:.3rem 0"><span style="color:${PRIO_C[p.lv]};font-weight:600">${PRIO_T[p.lv]}</span>${p.why.length?' · '+esc(p.why.join(' · ')):''} · Ánimo: <b>${SENT_T[mood]}</b> · ${esc(CHAN[c.chan]||c.chan)}${c.dept?' · cola '+esc(c.dept):''}${c.asg?' · agente '+esc(c.asg):' · sin asignar'}</p>
  ${demo?'<p class="sm warnbox" style="margin:.3rem 0">Canal de demostración: los mensajes son de ejemplo. Para recibir y responder de verdad hay que conectar la cuenta del comercio (API oficial de Meta, bot de Telegram o correo).</p>':''}
  ${c.chan==='wa'?'<p class="sm mut" style="margin:.3rem 0">WhatsApp asistido: al responder se abre WhatsApp con el texto; lo que te mande el cliente se registra con «Registrar lo que escribió». La API oficial de WhatsApp Business (envío automático y plantillas) necesita la cuenta del comercio.</p>':''}
  <div class="crm-th" id="crm-msgs" aria-live="polite">${msgs||'<p class="sm mut">Sin mensajes.</p>'}</div>`;}
function crmCalHTML(c){const C=crmCfg();if(!C.turnos)return'';const all=convs().flatMap(x=>(x.appts||[]).filter(a=>a.st!=='cancelado').map(a=>Object.assign({conv:x.id},a)));
 const d0=new Date(now());d0.setHours(0,0,0,0);const days=[...Array(7)].map((_,i)=>new Date(d0.getTime()+i*864e5));
 const mine=(c.appts||[]).filter(a=>a.st!=='cancelado').sort((a,b)=>a.at-b.at);
 return `<div class="crm-box"><h4>📅 Gestión de turnos</h4><div class="crm-cal" role="table" aria-label="Turnos de los próximos 7 días">${days.map(d=>{const n=all.filter(a=>dkey(a.at)===dkey(d.getTime())).length;return `<div role="cell" class="crm-cd${n?' has':''}" title="${n} turno(s)"><span class="sm mut">${['Do','Lu','Ma','Mi','Ju','Vi','Sá'][d.getDay()]}</span><b>${d.getDate()}</b>${n?`<span class="sm">${n}</span>`:''}</div>`;}).join('')}</div>
  ${mine.length?mine.map(a=>`<div class="crm-ap"><b>${crmHm(a.at)}</b> · ${esc(a.what)} <span class="crm-st ${a.st==='confirmado'?'crm-st-p':'crm-st-w'}">${a.st==='confirmado'?'Confirmado':'Reservado'}</span>${a.at<now()?' <span class="sm mut">(pasado)</span>':''}<div class="row" style="gap:.25rem;margin-top:.2rem">${a.st!=='confirmado'?`<button class="btn sm gold" data-act="crmApptOk" data-id="${esc(a.id)}">Confirmar</button>`:''}<button class="btn sm" data-act="crmAppt" data-id="${esc(a.id)}">Reprogramar</button><button class="btn sm" data-act="crmApptX" data-id="${esc(a.id)}">Cancelar</button></div></div>`).join(''):'<p class="sm mut">Sin turnos para este cliente.</p>'}
  <button class="btn sm" data-act="crmAppt" style="margin-top:.3rem">+ Reservar turno</button></div>`;}
function crmCtxHTML(){const c=convById(crmSel);if(!c)return'';crmFix(c);const cu=c.cust?custById(c.cust):null;const C=crmCfg();
 const sug=crmSuggest(c);const sum=crmSummary(c);let h='';
 if(!cu){h+=`<div class="crm-box"><h4>👤 Cliente</h4><p class="sm">${esc(c.name||'Sin nombre')}${c.wa?' · '+esc(c.wa):''}</p><p class="sm mut">Sin ficha vinculada.</p>
  <label for="crm-lq">Vincular con un cliente</label><input id="crm-lq" placeholder="Nombre, WhatsApp, DNI o N.º" autocomplete="off"><div id="crm-lr"></div></div>`;}
 else{const st=stampsOf(cu.id),g=S.loyalty.goal;const tr=typeof custTier==='function'?custTier(cu):null;const dt=debtOf(cu.id);const wb=typeof walBal==='function'&&fidCfg().wallet.on?walBal(cu.id):null;
  const sales=S.sales.filter(s=>s.cust===cu.id&&s.status==='ok').sort((a,b)=>b.ts-a.ts);const tot=sales.reduce((a,s)=>a+(s.total||0),0);
  const qs=(typeof quotes==='function'?quotes():[]).filter(q=>q.cust===cu.id).sort((a,b)=>b.ts-a.ts).slice(0,4);
  h+=`<div class="crm-box crm-prof"><h4>👤 Ficha 360° · ${esc(custFull(cu))}</h4><p class="sm">Socio N.º ${pad4(cu.num)}${tr?' · '+(TIER_ICO[tr.t.k]||'')+' '+esc(tr.t.name):''}${(c.tags||[]).length?' · '+c.tags.map(t=>'<span class="tag">'+esc(t)+'</span>').join(' '):''}</p>
  <div class="crm-k4"><div><b>${Math.min(st,g)}/${g}</b><span>sellos</span></div><div><b style="color:${dt>0?'var(--crm-a)':'inherit'}">${money(dt)}</b><span>saldo deudor</span></div>${wb!==null?`<div><b>${money(wb)}</b><span>monedero</span></div>`:''}<div><b>${money(tot)}</b><span>${sales.length} compra(s)</span></div></div>
  <p class="sm" style="margin:.45rem 0 .1rem"><b>Historial de compras y presupuestos</b></p>${sales.length||qs.length?`<ul class="sm crm-ul">${sales.slice(0,4).map(s=>`<li>${dmy(dkey(s.ts))} · venta ${esc(s.n||'')} · ${money(s.total||0)} <span class="crm-st crm-st-p">Entregado</span></li>`).join('')}${qs.map(q=>`<li>${esc(q.n)} · ${money(q.total)} <span class="crm-st ${qtState(q)==='convertido'?'crm-st-p':qtState(q)==='vigente'?'crm-st-w':'crm-st-c'}">${esc(qtState(q))}</span></li>`).join('')}</ul>`:'<p class="sm mut">Todavía sin compras.</p>'}
  <div class="row" style="margin-top:.3rem;gap:.3rem"><button class="btn sm" data-act="cuEdit" data-id="${cu.id}">Ver ficha</button><button class="btn sm" data-act="crmUnlink">Desvincular</button></div></div>`;}
 h+=`<div class="crm-box"><h4>🤖 Copiloto (por reglas)</h4><details open><summary class="sm"><b>Resumen</b></summary><ul class="sm crm-ul">${sum.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></details>
  ${sug.length?`<p class="sm" style="margin:.4rem 0 .2rem"><b>Respuestas sugeridas</b> (tocá para usarla)</p>${sug.map((s,i)=>`<button type="button" class="btn sm crm-sug" data-act="crmUse" data-i="${i}">${esc(s)}</button>`).join('')}`:''}</div>`;
 h+=crmCalHTML(c);
 const P=C.pay;h+=`<div class="crm-box"><h4>💳 Gestión de cobros</h4>${c.pay&&c.pay.state==='pendiente'?`<p class="sm warnbox" style="margin:.2rem 0">Pendiente: ${money(c.pay.amount)} (${esc(c.pay.ref||'')}) desde ${crmHm(c.pay.ts)}. <button class="btn sm" data-act="crmPayOk">Llegó el pago</button></p>`:c.pay&&c.pay.state==='recibido'?`<p class="sm okbox" style="margin:.2rem 0">Pago confirmado a mano: ${money(c.pay.amount)} · falta registrarlo en Vender/Caja si no lo hiciste.</p>`:''}
  <button class="btn sm gold" data-act="crmPay" style="width:100%;white-space:normal">${P.link?'Enviar link de pago y datos de transferencia':'Enviar datos de pago (alias / CBU)'}</button>
  <p class="sm mut" style="margin:.3rem 0 0">${P.link?'Link fijo del comercio: '+esc(P.link.replace(/^https?:\/\//,'')):'Sin link de pago cargado (Ajustes).'} El link por importe con confirmación automática necesita la cuenta de Mercado Pago o Stripe conectada a un servidor: ${CRM_FULL?'en esta demo no se genera ningún link real.':'pendiente.'}</p></div>`;
 h+=`<div class="crm-box"><h4>📈 Reportes y fidelización</h4><div class="row" style="gap:.3rem">${cu?'<button class="btn sm" data-act="crmQuote">Enviar presupuesto</button><button class="btn sm" data-act="crmNewQuote">Nuevo presupuesto</button>':''}<button class="btn sm" data-act="crmSurvey" data-k="csat">Encuesta CSAT</button><button class="btn sm" data-act="crmSurvey" data-k="nps">Encuesta NPS</button></div>
  ${c.chan!=='web'?`<p class="sm" style="margin:.4rem 0 .1rem">Registrar la respuesta del cliente:</p><div class="row" style="gap:.2rem">${[1,2,3,4,5].map(v=>`<button class="btn sm ${c.csat===v?'on':''}" data-act="crmCsatSet" data-v="${v}" aria-label="CSAT ${v} de 5">${v}★</button>`).join('')}</div>`:''}
  ${cu?`<p class="sm mut" style="margin:.4rem 0 0">Puntos de fidelidad: ${stampsOf(cu.id)} sellos${typeof walBal==='function'&&fidCfg().wallet.on?' · monedero '+money(walBal(cu.id)):''}.</p>`:''}</div>`;
 return h;}
function crmComposerHTML(){const C=crmCfg();const c=convById(crmSel);if(!c)return'';
 return `<div class="row" role="group" aria-label="Tipo" style="gap:.3rem;margin-top:.4rem"><button type="button" class="btn sm ${crmMode==='msg'?'on':''}" data-act="crmMode" data-m="msg" aria-pressed="${crmMode==='msg'}">Responder al cliente</button><button type="button" class="btn sm ${crmMode==='note'?'on':''}" data-act="crmMode" data-m="note" aria-pressed="${crmMode==='note'}">🔒 Nota interna</button>
  ${['wa','tel','local'].includes(c.chan)||CHAN_DEMO.includes(c.chan)?'<button type="button" class="btn sm" data-act="crmLogIn">Registrar lo que escribió</button>':''}<span class="sp"></span>
  <select id="crm-cn" aria-label="Respuesta rápida"><option value="">Respuestas rápidas…</option>${C.canned.map((x,i)=>`<option value="${i}">${esc(x.t)}</option>`).join('')}</select></div>
  <label for="crm-tx" style="position:absolute;left:-9999px">Mensaje</label><textarea id="crm-tx" rows="3" maxlength="1500" placeholder="${crmMode==='note'?'Nota sólo para el equipo (el cliente no la ve)':'Escribí tu respuesta…'}" style="width:100%;margin-top:.3rem"></textarea>
  <div class="row" style="justify-content:flex-end;margin-top:.3rem"><button class="btn gold" data-act="crmSendBtn">${crmMode==='note'?'Guardar nota':c.chan==='wa'?'Abrir WhatsApp y registrar':'Enviar'}</button></div>`;}
function crmKpiHTML(){const A0=convs().map(crmFix).filter(c=>crmOpen(c)&&crmVisible(c));const un=A0.filter(c=>c.unread).length;const hi=A0.filter(c=>crmPrio(c).lv==='alta').length;const s=crmStats(30);
 return `<div class="card kpi"><b>${A0.length}</b><span>Activas</span></div><div class="card kpi"><b>${un}</b><span>Sin responder</span></div><div class="card kpi"><b style="color:${hi?'var(--crm-a)':'inherit'}">${hi}</b><span>Prioridad alta</span></div><div class="card kpi"><b>${s.csat==null?'—':s.csat+' %'}</b><span>CSAT 30 días (${s.csatN})</span></div>`;}
function crmMiniStatsHTML(){const s=crmStats(30);return `<div class="card"><h3 style="margin-top:0">📊 CRM Analytics <span class="sm mut">· últimos 30 días</span></h3><div class="crm-k4">
 <div><b>${crmDur(s.frt)}</b><span>1.ª respuesta (FRT)</span></div><div><b>${crmDur(s.aht)}</b><span>duración media (AHT)</span></div><div><b>${s.csat==null?'—':s.csat+' %'}</b><span>CSAT</span></div><div><b>${s.conv==null?'—':s.conv+' %'}</b><span>conversión a venta</span></div></div>
 <p class="sm mut" style="margin:.4rem 0 0">${s.n} conversaciones · ${s.leads} lead(s) · ventas dentro de los 3 días: ${money(s.convAmt)}. <a href="#" data-act="crmTab" data-t="stats">Ver analíticas</a></p></div>`;}
function crmAlertsHTML(lim){const A=crmAlerts();const L=lim?A.slice(0,lim):A;return `<div class="card"><h3 style="margin-top:0">🔔 Alertas del ERP <span class="sm mut">(${A.length})</span></h3>${L.length?`<ul class="crm-al">${L.map(a=>`<li class="${a.lv}"><span>${a.lv==='crit'?'⛔':'⚠️'} ${esc(a.t)}</span>${a.go?`<button class="btn sm" data-act="nav" data-id="${a.go}">Ver</button>`:a.act==='deuda'?`<button class="btn sm" data-act="crmAviso" data-k="deuda" data-id="${esc(a.id)}">Recordar</button>`:a.conv?`<button class="btn sm" data-act="crmOpen" data-id="${esc(a.conv)}">Abrir</button>`:''}</li>`).join('')}</ul>`:'<p class="sm mut">Sin alertas.</p>'}${lim&&A.length>lim?`<p class="sm"><a href="#" data-act="crmTab" data-t="alerts">Ver las ${A.length}</a></p>`:''}</div>`;}
function crmAvisos(){const C=crmCfg();const out=[];const t=now();const recent=(cid,k)=>convs().some(c=>c.cust===cid&&convMsgs(c.id).some(m=>m.kind===k&&t-m.ts<7*864e5));
 S.customers.filter(c=>c.status!=='baja'&&waOk(c)&&debtOf(c.id)>0&&!recent(c.id,'aviso-deuda')).slice(0,8).forEach(c=>out.push({k:'deuda',id:c.id,t:`${custFull(c)} debe ${money(debtOf(c.id))}`,b:'Recordar saldo'}));
 (typeof quotes==='function'?quotes():[]).filter(q=>q.cust&&qtState(q)==='vigente'&&q.exp-t<2*864e5&&!recent(q.cust,'aviso-presupuesto')).slice(0,8).forEach(q=>{const c=custById(q.cust);if(c&&waOk(c))out.push({k:'presup',id:q.id,t:`Presupuesto ${q.n} de ${custFull(c)} vence ${dmy(dkey(q.exp))}`,b:'Hacer seguimiento'});});
 if(C.turnos)convs().forEach(c=>(c.appts||[]).filter(a=>a.st!=='cancelado'&&!a.rem&&a.at>t&&a.at-t<36*3600e3).forEach(a=>out.push({k:'turno',id:c.id+'|'+a.id,t:`Turno de ${crmWho(c)}: ${crmHm(a.at)} (${a.what})`,b:'Recordar turno'})));
 convs().filter(c=>c.state==='cerrado'&&!c.csat&&!c.asked&&t-c.last<3*864e5).slice(0,8).forEach(c=>out.push({k:'csat',id:c.id,t:`Encuesta postventa a ${crmWho(c)}`,b:'Pedir calificación'}));
 return out;}
function crmSqlNote(){if(!crmCloud()||!cl.rejects)return'';const bad=Object.entries(cl.rejects).some(([k,v])=>/^(conv|cmsg)\|/.test(k)&&/colecci/i.test(String(v&&v.motivo||v)));
 return bad?'<div class="warnbox">La nube todavía no acepta las conversaciones: falta correr <b>22-crm.sql</b> en Supabase. Mientras tanto quedan sólo en este equipo.</div>':'';}
function crmInboxHTML(){const C=crmCfg();const chans=C.chans.map(k=>`<option value="${k}" ${crmF.ch===k?'selected':''}>${CHAN[k]}${CHAN_DEMO.includes(k)?' (demo)':''}</option>`).join('');const ags=crmAgents();
 return `<div class="crm-wrap"><div class="card"><h3 style="margin:0 0 .4rem">Conversaciones</h3><div class="row" style="gap:.3rem"><input id="crm-q" class="sp" placeholder="Buscar" value="${esc(crmF.q)}" aria-label="Buscar conversación" autocomplete="off"></div>
  <div class="row" style="gap:.3rem;margin:.4rem 0"><select id="crm-fc" aria-label="Canales"><option value="">Canales: todos</option>${chans}</select>
  <select id="crm-fs" aria-label="Estado">${[['activas','Estado: activas'],['nuevo','Nuevo'],['proceso','En proceso'],['pendiente','Pendiente'],['cerrado','Cerrado'],['todas','Todas']].map(([k,t])=>`<option value="${k}" ${crmF.st===k?'selected':''}>${t}</option>`).join('')}</select>
  <select id="crm-fa" aria-label="Agente"><option value="">Agente: todos</option><option value="__me" ${crmF.ag==='__me'?'selected':''}>Mis chats</option><option value="__none" ${crmF.ag==='__none'?'selected':''}>Sin asignar</option>${crmSup()?ags.map(a=>`<option value="${esc(a)}" ${crmF.ag===a?'selected':''}>${esc(a)}</option>`).join(''):''}</select>
  <select id="crm-fd" aria-label="Cola"><option value="">Cola: todas</option>${C.depts.map(d=>`<option value="${esc(d)}" ${crmF.dept===d?'selected':''}>${esc(d)}</option>`).join('')}</select></div>
  <div class="crm-list" id="crm-list">${crmListHTML()}</div><div id="crm-queues">${crmQueuesHTML()}</div></div>
 <div class="card"><div id="crm-thread">${crmThreadHTML()}</div><div id="crm-comp">${crmComposerHTML()}</div></div>
 <div id="crm-ctx" class="crm-ctx">${crmCtxHTML()}</div></div>
 <div class="grid g2" style="margin-top:.8rem" id="crm-bottom">${crmMiniStatsHTML()}${crmAlertsHTML(5)}</div>`;}
function crmBarsHTML(obj,lab){const E=Object.entries(obj).sort((a,b)=>b[1]-a[1]);const mx=Math.max(1,...E.map(x=>x[1]));
 return E.length?`<table class="crm-bars"><tbody>${E.map(([k,v])=>`<tr><th scope="row">${esc(lab?lab(k):k)}</th><td><span class="crm-bar-f" style="width:${Math.round(v/mx*100)}%"></span></td><td style="text-align:right">${v}</td></tr>`).join('')}</tbody></table>`:'<p class="sm mut">Sin datos suficientes.</p>';}
function crmStatsHTML(){const d=+crmF.days||30;const s=crmStats(d);
 return `<div class="row" style="gap:.4rem;align-items:center"><label for="crm-days" class="sm">Período</label><select id="crm-days">${[7,30,90].map(x=>`<option value="${x}" ${x===d?'selected':''}>Últimos ${x} días</option>`).join('')}</select></div>
 <div class="grid g4" style="margin:.8rem 0"><div class="card kpi"><b>${crmDur(s.frt)}</b><span>Tiempo medio de primera respuesta (FRT)</span></div><div class="card kpi"><b>${crmDur(s.aht)}</b><span>Duración media hasta cerrar (AHT)</span></div>
 <div class="card kpi"><b>${s.csat==null?'—':s.csat+' %'}</b><span>CSAT (4 y 5 de 5) · ${s.csatN} resp.</span></div><div class="card kpi"><b>${s.nps==null?'—':s.nps}</b><span>NPS (promotores − detractores) · ${s.npsN} resp.</span></div>
 <div class="card kpi"><b>${s.conv==null?'—':s.conv+' %'}</b><span>Conversión a venta (3 días) · ${s.convN}/${s.withC}</span></div><div class="card kpi"><b>${money(s.convAmt)}</b><span>Ventas atribuidas al chat</span></div><div class="card kpi"><b>${s.n}</b><span>Conversaciones (${s.open} abiertas)</span></div><div class="card kpi"><b>${s.leads}</b><span>Leads calificados</span></div></div>
 <div class="grid g2"><div class="card"><h3 style="margin-top:0">Por canal</h3>${crmBarsHTML(s.byCh,k=>CHAN[k]||k)}</div><div class="card"><h3 style="margin-top:0">Por día</h3>${crmBarsHTML(Object.fromEntries(Object.entries(s.byDay).sort()),k=>dmy(k))}</div></div>
 ${crmSup()?`<div class="card" style="margin-top:.8rem"><h3 style="margin-top:0">Panel de supervisión · por agente</h3><table><thead><tr><th>Agente</th><th>Conversaciones</th><th>Abiertas</th><th>FRT</th><th>CSAT medio</th></tr></thead><tbody>${Object.entries(s.byAg).map(([a,o])=>`<tr><td>${esc(a)}</td><td>${o.n}</td><td>${o.open}</td><td>${crmDur(o.frt.length?o.frt.reduce((x,y)=>x+y,0)/o.frt.length:NaN)}</td><td>${o.cs.length?(o.cs.reduce((x,y)=>x+y,0)/o.cs.length).toFixed(1).replace('.',','):'—'}</td></tr>`).join('')||'<tr><td colspan="5">Sin datos.</td></tr>'}</tbody></table></div>`:''}
 <p class="sm mut">Fórmulas: FRT = primera respuesta humana − primer mensaje del cliente; AHT = cierre − primer mensaje; CSAT = respuestas 4 o 5 ÷ respuestas; NPS = % de 9–10 − % de 0–6; conversión = conversaciones con cliente identificado que tuvieron una venta en los 3 días siguientes. No incluye datos personales.</p>`;}
const CRM_SEG={comm:'Clientes que aceptan promociones',club:'Socios del Club que aceptan promociones',cumple:'Cumpleaños de este mes (que aceptan promociones)',deuda:'Clientes con saldo pendiente (aviso de cuenta)',inact:'Sin comprar hace 60 días (que aceptan promociones)'};
function crmSegList(seg){const t=now();const base=S.customers.filter(c=>c.status!=='baja'&&waOk(c));const mo=new Date(t).getMonth()+1;
 const lastBuy=id=>{let m=0;for(const s of S.sales)if(s.cust===id&&s.status==='ok'&&s.ts>m)m=s.ts;return m;};
 if(seg==='deuda')return base.filter(c=>debtOf(c.id)>0);
 const comm=base.filter(c=>hasComm(c));
 if(seg==='club')return comm.filter(c=>c.num);if(seg==='cumple')return comm.filter(c=>c.birth&&+String(c.birth).slice(5,7)===mo);if(seg==='inact')return comm.filter(c=>t-lastBuy(c.id)>60*864e5);return comm;}
function crmCampHTML(){const C=crmCfg();const camps=C.camps.slice().reverse();
 return `<div class="grid g2"><div class="card"><h3 style="margin-top:0">Nueva campaña</h3>
  <label for="cm-seg">Segmento</label><select id="cm-seg">${Object.entries(CRM_SEG).map(([k,t])=>`<option value="${k}">${t} (${crmSegList(k).length})</option>`).join('')}</select>
  <label for="cm-tx">Mensaje ({nombre} se reemplaza)</label><textarea id="cm-tx" rows="5" maxlength="1000" style="width:100%">Hola {nombre}, te escribimos de ${esc((S.tenant&&S.tenant.name)||'el comercio')}. </textarea>
  <p class="sm mut">Sólo se incluyen clientes con WhatsApp válido; las promociones van sólo a quien aceptó recibirlas (el aviso de saldo es un aviso de su cuenta). Hasta 300 destinatarios.</p>
  <p class="sm warnbox">Envío: <b>WhatsApp asistido</b>, uno por uno (se abre WhatsApp con el mensaje listo y lo confirmás vos). El envío masivo automático con <b>plantillas HSM aprobadas por Meta</b> necesita la API oficial de WhatsApp Business del comercio: ${CRM_FULL?'en esta demo no se envía nada a Meta.':'pendiente.'}</p>
  <button class="btn gold" data-act="crmCampNew">Crear campaña</button></div>
  <div class="card"><h3 style="margin-top:0">Campañas</h3>${camps.length?camps.map(k=>`<div class="crm-box"><b>${esc(CRM_SEG[k.seg]||k.seg)}</b> <span class="sm mut">· ${crmHm(k.ts)} · ${esc(k.by||'')}</span><p class="sm" style="white-space:pre-wrap;margin:.3rem 0">${esc(k.txt.slice(0,160))}</p>
   <p class="sm">Enviados ${k.done.length} de ${k.ids.length}</p>${k.done.length<k.ids.length?`<button class="btn sm gold" data-act="crmCampNext" data-id="${esc(k.id)}">Abrir WhatsApp del siguiente (${k.done.length+1}/${k.ids.length})</button>`:'<span class="crm-st crm-st-p">Terminada</span>'}</div>`).join(''):'<p class="sm mut">Todavía no hay campañas.</p>'}</div></div>`;}
function crmBody(){return crmTab==='stats'?crmStatsHTML():crmTab==='camp'?crmCampHTML():crmTab==='alerts'?crmAlertsHTML(0)+`<div class="card" style="margin-top:.8rem"><h3 style="margin-top:0">Avisos sugeridos</h3>${crmAvisosHTML()}</div>`:crmInboxHTML();}
function crmAvisosHTML(){const av=crmAvisos();return av.length?`<table><thead><tr><th>Aviso</th><th></th></tr></thead><tbody>${av.map(a=>`<tr><td>${esc(a.t)}</td><td><button class="btn sm" data-act="crmAviso" data-k="${a.k}" data-id="${esc(a.id)}">${a.b}</button></td></tr>`).join('')}</tbody></table><p class="sm mut">Avisos de la cuenta, de pedidos, turnos o la encuesta postventa (no promociones). Se abre el mensaje y lo confirmás vos.</p>`:'<p class="sm mut">No hay avisos pendientes.</p>';}
function crmPaint(){if(crmTab!=='inbox'){const b=$('#crm-body');if(b){b.innerHTML=crmBody();crmBindCtx();}return;}
 const l=$('#crm-list'),t=$('#crm-thread'),x=$('#crm-ctx'),k=$('#crm-kpi');if(!l)return;
 l.innerHTML=crmListHTML();t.innerHTML=crmThreadHTML();x.innerHTML=crmCtxHTML();if(k)k.innerHTML=crmKpiHTML();const q=$('#crm-queues');if(q)q.innerHTML=crmQueuesHTML();const bt=$('#crm-bottom');if(bt)bt.innerHTML=crmMiniStatsHTML()+crmAlertsHTML(5);
 const m=$('#crm-msgs');if(m)m.scrollTop=m.scrollHeight;crmBindCtx();}
function crmBindCtx(){const q=$('#crm-lq');if(q)q.addEventListener('input',()=>{const s=crmNorm(q.value).trim();const r=$('#crm-lr');if(s.length<2){r.innerHTML='';return;}
  const L=S.customers.filter(c=>c.status!=='baja'&&crmNorm(custFull(c)+' '+(c.wa||'')+' '+(c.dni||'')+' '+pad4(c.num)).includes(s)).slice(0,6);
  r.innerHTML=L.map(c=>`<button class="btn sm" style="display:block;width:100%;text-align:left;margin-top:.2rem;white-space:normal" data-act="crmLink" data-id="${c.id}">${esc(custFull(c))} · N.º ${pad4(c.num)}</button>`).join('')||'<p class="sm mut">Sin resultados.</p>';});
 const s=$('#crm-st');if(s)s.addEventListener('change',()=>{const c=convById(crmSel);if(!c)return;const v=s.value;if(!CST[v])return;if(v==='cerrado'){crmCloseConv(c);return;}c.state=v;crmAdd(c,'sys','Estado: '+CST[v]+' ('+crmMe()+')',{kind:'estado'});audit('CRM_ESTADO',crmWho(c)+' · '+CST[v]);save();crmPaint();});
 const dd=$('#crm-days');if(dd)dd.addEventListener('change',()=>{crmF.days=+dd.value;crmPaint();});}
reg('crm','Atención al cliente','chat','crm',()=>{const C=crmCfg();
 const tabs=[['inbox','Bandeja'],['stats','Analíticas'],['camp','Campañas'],['alerts','Alertas ERP ('+crmAlerts().length+')']];
 return `<style>:root{--crm-a:#a8261b;--crm-m:#7a4f00;--crm-n:#1d6234}[data-theme=dark]{--crm-a:#ff9b91;--crm-m:#f2c96b;--crm-n:#8fe0a2}@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--crm-a:#ff9b91;--crm-m:#f2c96b;--crm-n:#8fe0a2}}
 .crm-wrap{display:grid;grid-template-columns:minmax(230px,1fr) minmax(0,2fr) minmax(250px,1.1fr);gap:.8rem;align-items:start}
 @media(max-width:1100px){.crm-wrap{grid-template-columns:minmax(0,1fr)}}.crm-wrap>*{min-width:0}.crm-wrap .row{flex-wrap:wrap}.crm-wrap select,.crm-wrap input{max-width:100%;min-width:0}
 .crm-list{max-height:56vh;overflow:auto;display:flex;flex-direction:column;gap:.3rem}
 .crm-it{flex-shrink:0;display:block;width:100%;text-align:left;padding:.55rem .6rem;border:1px solid var(--line);border-radius:10px;background:transparent;color:inherit;cursor:pointer;min-height:48px;font:inherit}
 .crm-it.on{border-color:var(--gold);box-shadow:0 0 0 2px rgba(201,150,62,.35)}.crm-dot{color:var(--crm-a)}
 .crm-st{font-size:.72rem;font-weight:700;padding:.1rem .45rem;border-radius:999px;white-space:nowrap;border:1px solid currentColor}.crm-st-n{color:var(--crm-a)}.crm-st-p{color:var(--crm-n)}.crm-st-w{color:var(--crm-m)}.crm-st-c{color:var(--mut)}
 .crm-bar{display:flex;flex-wrap:wrap;gap:.3rem;margin:.4rem 0;padding:.35rem 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.crm-close{color:var(--crm-a)}
 .crm-th{max-height:48vh;overflow:auto;display:flex;flex-direction:column;gap:.45rem;padding:.4rem;border:1px solid var(--line);border-radius:10px;min-height:180px}
 .crm-m{max-width:85%;padding:.5rem .7rem;border-radius:12px;white-space:pre-wrap;word-break:break-word}.crm-m.in{align-self:flex-start;background:rgba(127,127,127,.14)}
 .crm-m.out{align-self:flex-end;background:rgba(46,160,67,.18)}.crm-m.out.bot{background:rgba(64,120,200,.16)}.crm-m.note{align-self:flex-end;background:rgba(201,150,62,.16);border:1px dashed rgba(201,150,62,.7)}
 .crm-m.sys{align-self:center;font-size:.85em;opacity:.8;background:none;padding:.2rem}.crm-sug{display:block;width:100%;text-align:left;white-space:normal;margin-top:.25rem}
 .crm-ctx{display:flex;flex-direction:column;gap:.6rem}.crm-box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:.7rem}.crm-box h4{margin:0 0 .35rem;font-size:.95rem}
 .crm-k4{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:.35rem}.crm-k4>div{border:1px solid var(--line);border-radius:10px;padding:.35rem .45rem}.crm-k4 b{display:block;font-size:1.05rem}.crm-k4 span{font-size:.75rem;color:var(--mut)}
 .crm-ul{padding-left:1.1rem;margin:.2rem 0}.crm-q{display:flex;flex-wrap:wrap;gap:.3rem;align-items:center;margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--line)}
 .crm-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:.2rem;margin-bottom:.4rem}.crm-cd{display:flex;flex-direction:column;align-items:center;border:1px solid var(--line);border-radius:8px;padding:.2rem 0;min-height:44px}.crm-cd.has{border-color:var(--gold);background:rgba(201,150,62,.12)}
 .crm-ap{border-top:1px dashed var(--line);padding:.35rem 0;font-size:.9rem}.crm-al{list-style:none;padding:0;margin:0}.crm-al li{display:flex;gap:.4rem;align-items:center;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid var(--line)}.crm-al li.crit span{color:var(--crm-a);font-weight:600}
 .crm-bars{width:100%}.crm-bars th{text-align:left;font-weight:500;width:35%}.crm-bar-f{display:block;height:12px;border-radius:6px;background:var(--gold);min-width:3px}</style>
 <div class="row"><h1 class="sp">Atención al cliente</h1>${crmSup()?'<button class="btn" data-act="crmTab" data-t="stats">Panel de supervisión</button>':''}${CRM_FULL?'<button class="btn" data-act="crmSim">Simular mensaje entrante</button>':''}<button class="btn gold" data-act="crmNewBtn">+ Nueva conversación</button>${can('config')?'<button class="btn" data-act="crmCfgOpen">Ajustes</button>':''}</div>
 ${C.on?'':'<div class="warnbox">Atención al cliente está <b>apagada</b>: el chat del menú público no se muestra. Activala en <b>Ajustes</b>.</div>'}${crmSqlNote()}
 <p class="sm mut">Canales: ${C.chans.map(k=>CHAN_IC[k]+' '+CHAN[k]+(CHAN_DEMO.includes(k)?' (demostración)':'')).join(' · ')}. Chat web cifrado de punta a punta; WhatsApp se abre con el texto listo y el envío lo confirmás vos.</p>
 <div class="grid g4" id="crm-kpi" style="margin:.8rem 0">${crmKpiHTML()}</div>
 <div class="ux-tabs" role="tablist" aria-label="Atención al cliente">${tabs.map(([k,t])=>`<a role="tab" tabindex="0" data-act="crmTab" data-t="${k}" aria-selected="${crmTab===k}" class="${crmTab===k?'on':''}">${esc(t)}</a>`).join('')}</div>
 <div id="crm-body">${crmBody()}</div>`;},
 ()=>{const v=$('#view');const rf=()=>{const l=$('#crm-list');if(l)l.innerHTML=crmListHTML();};
  v.addEventListener('input',e=>{if(e.target.id==='crm-q'){crmF.q=e.target.value;rf();}});
  v.addEventListener('change',e=>{const id=e.target.id;if(id==='crm-fs'){crmF.st=e.target.value;rf();}else if(id==='crm-fc'){crmF.ch=e.target.value;rf();}else if(id==='crm-fa'){crmF.ag=e.target.value;rf();}else if(id==='crm-fd'){crmF.dept=e.target.value;rf();}
   else if(id==='crm-cn'&&e.target.value!==''){const x=crmCfg().canned[+e.target.value];const c=convById(crmSel);if(x){const ta=$('#crm-tx');ta.value=String(x.x).replace(/\{nombre\}/g,crmFirst(c));ta.focus();}e.target.value='';}});
  crmBindCtx();const m=$('#crm-msgs');if(m)m.scrollTop=m.scrollHeight;
  clearInterval(crmTimer);crmTimer=setInterval(async()=>{if(curScreen!=='crm'||$('#panel').hidden){clearInterval(crmTimer);return;}const n=await crmImport();if(!n){const l=$('#crm-kpi');if(l)l.innerHTML=crmKpiHTML();}},8000);crmImport();});
SCREENS.crm.show=()=>crmCfg().on||can('config');

/* ---------- acciones ---------- */
const crmCur=()=>convById(crmSel);
A.crmTab=el=>{crmTab=el.dataset.t||'inbox';if(curScreen!=='crm'){go('crm');return;}rerender();};
A.crmOpen=el=>{crmSel=el.dataset.id;if(crmTab!=='inbox'){crmTab='inbox';rerender();return;}crmPaint();const cp=$('#crm-comp');if(cp)cp.innerHTML=crmComposerHTML();
 if(window.innerWidth<1100){const t=$('#crm-thread');if(t)t.scrollIntoView({block:'start'});}};
A.crmQueue=el=>{crmF.dept=el.dataset.d||'';crmF.ag='__none';crmF.st='activas';rerender();};
A.crmMine=()=>{crmF.ag=crmF.ag==='__me'?'':'__me';crmF.dept='';rerender();};
A.crmMode=el=>{crmMode=el.dataset.m==='note'?'note':'msg';const ta=$('#crm-tx');const keep=ta?ta.value:'';const cp=$('#crm-comp');if(!cp)return;cp.innerHTML=crmComposerHTML();const n=$('#crm-tx');if(n){n.value=keep;n.focus();}};
A.crmUse=el=>{const c=crmCur();if(!c)return;const s=crmSuggest(c)[+el.dataset.i];if(!s)return;if(crmMode!=='msg'){crmMode='msg';$('#crm-comp').innerHTML=crmComposerHTML();}const ta=$('#crm-tx');ta.value=s;ta.focus();};
A.crmSendBtn=async el=>{const c=crmCur();if(!c)return;const ta=$('#crm-tx');const t=crmTxt(ta.value);if(!t)return toast('Escribí el mensaje.',1);
 if(crmMode==='note'){crmAdd(c,'note',t,{kind:'nota'});audit('CRM_NOTA',crmWho(c));save();ta.value='';crmPaint();return;}
 el.disabled=true;try{if(!c.asg&&!crmSup())c.asg=crmMe();if(c.state==='nuevo')c.state='proceso';await crmSend(c,t);ta.value='';crmPaint();}catch(e){toast(e.message||'No se pudo enviar.',1);}finally{el.disabled=false;}};
A.crmLogIn=()=>{const c=crmCur();if(!c)return;modal('Registrar lo que escribió el cliente',`<p class="sm">Copiá acá el mensaje que te mandó por ${esc(CHAN[c.chan]||c.chan)} para tenerlo en la conversación.</p><textarea id="crm-li" rows="4" maxlength="1500" style="width:100%"></textarea>`,
 {okText:'Registrar',onOk:w=>{const t=crmTxt(val('crm-li'));if(!t)return w._err('Escribí el mensaje.'),false;crmAdd(c,'in',t,{via:'registrado a mano por '+crmMe()});audit('CRM_REGISTRO',(CHAN[c.chan]||c.chan)+' · '+crmWho(c));save();crmPaint();}});};
A.crmAsg=()=>{const c=crmCur();if(!c||!user)return;if(c.asg&&c.asg!==crmMe()&&!crmSup())return toast('La conversación es de '+c.asg+'. Pedile a un supervisor que la transfiera.',1);
 c.asg=c.asg===crmMe()?'':crmMe();if(c.asg&&c.state==='nuevo')c.state='proceso';crmAdd(c,'sys',c.asg?'Tomada por '+c.asg:'Liberada por '+crmMe(),{kind:'asigna'});audit('CRM_ASIGNA',crmWho(c)+' · '+(c.asg||'sin asignar'));save();crmPaint();};
A.crmTransfer=()=>{const c=crmCur();if(!c)return;const C=crmCfg();const ags=crmAgents();
 const w=modal('Transferir conversación',`<label for="ct-d">Departamento / cola</label><select id="ct-d">${C.depts.map(d=>`<option ${c.dept===d?'selected':''}>${esc(d)}</option>`).join('')}</select>
  <label for="ct-a">Agente</label><select id="ct-a"><option value="">Sin asignar (queda en la cola)</option>${ags.map(a=>`<option ${c.asg===a?'selected':''}>${esc(a)}</option>`).join('')}</select>
  <label for="ct-m">Motivo (opcional)</label><input id="ct-m" maxlength="120"><p class="sm mut">Se agrega una nota interna con el <b>resumen automático</b> para quien la recibe.</p>`,
  {okText:'Transferir',onOk:()=>{const d=val('ct-d'),a=val('ct-a'),mo=val('ct-m').trim().replace(/[<>]/g,'').slice(0,120);if(!C.depts.includes(d))return false;if(a&&!ags.includes(a))return false;
   const from=(c.dept||'sin cola')+(c.asg?' / '+c.asg:'');c.dept=d;c.asg=a;if(c.state==='cerrado')c.state='proceso';
   crmAdd(c,'note','Transferida de '+from+' a '+d+(a?' / '+a:'')+(mo?' · motivo: '+mo:'')+'\nResumen automático:\n• '+crmSummary(c).join('\n• '),{kind:'transferencia'});
   audit('CRM_TRANSFERENCIA',crmWho(c)+' · '+from+' → '+d+(a?' / '+a:''));save();crmPaint();toast('Conversación transferida a '+d+(a?' / '+a:''));}});};
A.crmTags=()=>{const c=crmCur();if(!c)return;modal('Etiquetar',`<label for="crm-tg">Separadas por coma (ej.: mayorista, reclamo, vip, lead)</label><input id="crm-tg" maxlength="120" value="${esc((c.tags||[]).join(', '))}">`,
 {okText:'Guardar',onOk:()=>{c.tags=[...new Set(val('crm-tg').split(',').map(x=>x.trim().replace(/[<>]/g,'').slice(0,20)).filter(Boolean))].slice(0,6);audit('CRM_ETIQUETAS',crmWho(c)+' · '+c.tags.join(', '));save();crmPaint();}});};
async function crmCloseConv(c){c.state='cerrado';c.closedAt=now();c.unread=false;crmAdd(c,'sys','Conversación cerrada por '+crmMe(),{kind:'estado'});audit('CRM_ESTADO',crmWho(c)+' · Cerrado');
 if(crmCfg().autoSurvey&&CHAN_AUTO.includes(c.chan)&&!c.asked){try{await crmSurveyFor(c,'csat');}catch(e){}}save();crmPaint();}
A.crmClose=()=>{const c=crmCur();if(c)crmCloseConv(c);};
A.crmReopen=()=>{const c=crmCur();if(!c)return;c.state='proceso';crmAdd(c,'sys','Reabierta por '+crmMe(),{kind:'estado'});audit('CRM_ESTADO',crmWho(c)+' · reabierta');save();crmPaint();};
A.crmLink=el=>{const c=crmCur();const cu=custById(el.dataset.id);if(!c||!cu)return;c.cust=cu.id;crmAdd(c,'sys','Vinculada con la ficha de '+custFull(cu),{kind:'vincula'});audit('CRM_VINCULA',(CHAN[c.chan]||c.chan)+' · socio '+pad4(cu.num));save();crmPaint();};
A.crmUnlink=()=>{const c=crmCur();if(!c)return;confirmBox('Desvincular','La conversación deja de estar ligada a esta ficha (no se borra nada).',()=>{c.cust='';audit('CRM_VINCULA',crmWho(c)+' · desvinculada');save();crmPaint();});};
A.crmNewBtn=()=>{const C=crmCfg();const ch=C.chans.filter(k=>k!=='web');
 const w=modal('Nueva conversación',`<label for="cn-q">Cliente</label><input id="cn-q" placeholder="Nombre, WhatsApp, DNI o N.º" autocomplete="off"><div id="cn-r"></div><input type="hidden" id="cn-id">
  <p class="sm mut">O sin ficha:</p><div class="grid g2"><div><label for="cn-n">Nombre</label><input id="cn-n" maxlength="60"></div><div><label for="cn-w">WhatsApp (opcional)</label><input id="cn-w" inputmode="tel" maxlength="20" placeholder="387 4123456"></div></div>
  <div class="grid g2"><div><label for="cn-c">Canal</label><select id="cn-c">${ch.map(k=>`<option value="${k}">${CHAN[k]}${CHAN_DEMO.includes(k)?' (demostración)':''}</option>`).join('')}</select></div><div><label for="cn-d">Cola</label><select id="cn-d">${C.depts.map(d=>`<option>${esc(d)}</option>`).join('')}</select></div></div>`,
  {okText:'Crear',onOk:w=>{const cu=custById(val('cn-id'));const nm=val('cn-n').trim();const wa=normWA(val('cn-w'));const chan=val('cn-c');if(!CHAN[chan])return w._err('Elegí el canal.'),false;
   if(!cu&&nm.length<2)return w._err('Elegí un cliente o escribí un nombre.'),false;if(val('cn-w').trim()&&!wa)return w._err('El WhatsApp no es válido.'),false;
   const c=crmNew({chan,cust:cu?cu.id:'',name:cu?'':nm,wa:wa?'549'+wa:'',dept:val('cn-d'),asg:crmMe()});c.state='proceso';crmAdd(c,'sys','Conversación iniciada por '+crmMe(),{kind:'nueva'});audit('CRM_NUEVA',(CHAN[chan])+' · '+crmWho(c));save();crmSel=c.id;crmMode='msg';crmTab='inbox';rerender();}});
 const q=$('#cn-q',w);q.addEventListener('input',()=>{const s=crmNorm(q.value).trim();const r=$('#cn-r',w);if(s.length<2){r.innerHTML='';return;}
  r.innerHTML=S.customers.filter(c=>c.status!=='baja'&&crmNorm(custFull(c)+' '+(c.wa||'')+' '+(c.dni||'')+' '+pad4(c.num)).includes(s)).slice(0,6).map(c=>`<button type="button" class="btn sm" style="display:block;width:100%;text-align:left;margin-top:.2rem;white-space:normal" data-pick="${c.id}">${esc(custFull(c))} · N.º ${pad4(c.num)}</button>`).join('')||'<p class="sm mut">Sin resultados.</p>';});
 w.addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(!b)return;const c=custById(b.dataset.pick);$('#cn-id',w).value=c.id;q.value=custFull(c);$('#cn-r',w).innerHTML='<p class="sm okbox">Elegido: '+esc(custFull(c))+'</p>';});};
A.crmPay=()=>{const c=crmCur();if(!c)return;const P=crmCfg().pay;if(!P.alias&&!P.cbu&&!P.link)return toast('Cargá el link de pago, el alias o el CBU del comercio en Atención al cliente → Ajustes.',1);
 const cu=c.cust?custById(c.cust):null;const qs=cu&&typeof quotes==='function'?quotes().filter(q=>q.cust===cu.id&&qtState(q)==='vigente'):[];const dt=cu?debtOf(cu.id):0;
 const opts=[['libre','Importe libre',0]].concat(dt>0?[['deuda','Saldo de la cuenta',dt]]:[]).concat(qs.map(q=>['q:'+q.id,'Presupuesto '+q.n,q.total]));
 const w=modal('Gestión de cobros',`<label for="cp-o">Concepto</label><select id="cp-o">${opts.map(o=>`<option value="${o[0]}" data-a="${o[2]}">${esc(o[1])}${o[2]?' · '+money(o[2]):''}</option>`).join('')}</select>
  <label for="cp-a">Importe ($)</label><input id="cp-a" inputmode="decimal" placeholder="Importe" value="${opts[1]?(opts[1][2]/100).toFixed(2).replace('.',','):''}">
  <p class="sm">Se envía: ${P.link?'link de pago <b>'+esc(P.link)+'</b>':''}${P.link&&(P.alias||P.cbu)?' y ':''}${P.alias?'alias <b>'+esc(P.alias)+'</b>':''}${P.cbu?' · CBU/CVU <b>'+esc(P.cbu)+'</b>':''}${P.holder?' · titular '+esc(P.holder):''}.</p>
  <p class="sm warnbox">No mueve la caja ni factura: cuando llegue el pago, tocá «Llegó el pago» y registrá la venta o el cobro en Vender / Caja. La confirmación automática por webhook necesita la cuenta de Mercado Pago o Stripe conectada a un servidor.</p>`,
  {okText:'Enviar datos de pago',onOk:async w=>{const amt=cents(val('cp-a'));if(!(amt>0))return w._err('El importe debe ser mayor a cero.'),false;const o=$('#cp-o',w);const ref=o.options[o.selectedIndex].text.split(' · ')[0];
   try{await crmSend(c,crmPayText(crmFirst(c),amt,ref),{kind:'cobro',amount:amt});c.pay={amount:amt,ts:now(),state:'pendiente',ref};if(!c.dept)c.dept='Cobranzas';audit('CRM_COBRO',crmWho(c)+' · '+money(amt)+' · '+ref);save();crmPaint();}catch(e){w._err(e.message);return false;}}});
 $('#cp-o',w).addEventListener('change',e=>{const a=+e.target.options[e.target.selectedIndex].dataset.a;if(a)$('#cp-a',w).value=(a/100).toFixed(2).replace('.',',');});};
A.crmPayOk=()=>{const c=crmCur();if(!c||!c.pay)return;confirmBox('Llegó el pago','Confirmá que viste el pago de '+money(c.pay.amount)+'. <b>Esto no registra el cobro</b>: después hacelo en Vender o Caja.',()=>{c.pay.state='recibido';c.pay.okBy=crmMe();c.pay.okAt=now();
 crmAdd(c,'sys','Pago confirmado a mano por '+crmMe()+': '+money(c.pay.amount)+' — falta registrarlo en Vender/Caja',{kind:'cobro-ok'});audit('CRM_COBRO_RECIBIDO',crmWho(c)+' · '+money(c.pay.amount));save();crmPaint();toast('Anotado. Registrá el cobro en Vender o Caja.');},'Sí, llegó');};
function crmQuoteText(c,q){return `Hola ${crmFirst(c)}, te paso el presupuesto ${q.n}:\n${q.lines.map(l=>`• ${l.qty} × ${l.name} = ${money(Math.round(l.qty*l.price))}`).join('\n')}\nTotal: ${money(q.total)}. Válido hasta el ${dmy(dkey(q.exp))}.\n¿Te lo preparamos?`;}
A.crmQuote=()=>{const c=crmCur();const cu=c&&c.cust?custById(c.cust):null;if(!cu)return;const qs=quotes().filter(q=>q.cust===cu.id&&qtState(q)==='vigente');
 if(!qs.length)return toast('Este cliente no tiene presupuestos vigentes. Creá uno con «Nuevo presupuesto».',1);
 modal('Enviar presupuesto',`<label for="cq-q">Presupuesto</label><select id="cq-q">${qs.map(q=>`<option value="${q.id}">${esc(q.n)} · ${money(q.total)}</option>`).join('')}</select>
  <label class="chk"><input type="checkbox" id="cq-pdf" checked> <span>Abrir también el PDF para guardarlo y adjuntarlo</span></label><p class="sm mut">WhatsApp asistido no adjunta archivos solo: se envía el detalle en el mensaje y el PDF lo adjuntás vos.</p>`,
  {okText:'Enviar',onOk:async w=>{const q=quotes().find(x=>x.id===val('cq-q'));if(!q)return false;const pdf=$('#cq-pdf',w).checked;try{await crmSend(c,crmQuoteText(c,q),{kind:'presupuesto'});if(!c.dept)c.dept='Ventas';audit('CRM_PRESUPUESTO',q.n+' · '+crmWho(c));crmPaint();if(pdf&&typeof qtPrint==='function')setTimeout(()=>qtPrint(q),80);}catch(e){w._err(e.message);return false;}}});};
A.crmNewQuote=()=>{const c=crmCur();if(!c||!c.cust)return;pos.lines=[];pos.sel=-1;pos.cust=c.cust;pos.quote='';toast('Cargá los productos y tocá «Guardar como presupuesto». Después lo enviás desde Atención al cliente.');go('vender');};
A.crmAppt=el=>{const c=crmCur();if(!c||!crmCfg().turnos)return;const old=el&&el.dataset&&el.dataset.id?(c.appts||[]).find(a=>a.id===el.dataset.id):null;const d=new Date(old?old.at:now()+86400000);
 const ds=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);const hs=old?String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'):'10:00';
 modal(old?'Reprogramar turno':'Reservar turno',`<div class="grid g2"><div><label for="ca-d">Día</label><input id="ca-d" type="date" value="${ds}"></div><div><label for="ca-h">Hora</label><input id="ca-h" type="time" value="${hs}" step="900"></div></div>
  <label for="ca-w">Motivo / servicio</label><input id="ca-w" maxlength="60" value="${old?esc(old.what):''}" placeholder="Ej.: retiro de pedido, cancha, masaje, consulta"><label class="chk"><input type="checkbox" id="ca-s" checked> <span>Avisarle al cliente ahora</span></label>`,
  {okText:old?'Reprogramar':'Reservar',onOk:async w=>{const dd=val('ca-d'),hh=val('ca-h'),wt=val('ca-w').trim().replace(/[<>]/g,'').slice(0,60);if(!/^\d{4}-\d{2}-\d{2}$/.test(dd)||!/^\d{2}:\d{2}$/.test(hh))return w._err('Elegí día y hora.'),false;
   const at=new Date(dd+'T'+hh+':00').getTime();if(!(at>now()))return w._err('El turno tiene que ser a futuro.'),false;if(!wt)return w._err('Escribí el motivo.'),false;
   if(convs().some(x=>(x.appts||[]).some(a=>a!==old&&a.st!=='cancelado'&&Math.abs(a.at-at)<15*60000)))return w._err('Ya hay un turno en ese horario (±15 min).'),false;
   let a;if(old){const prev=old.at;old.at=at;old.what=wt;old.st='reservado';old.rem=0;a=old;crmAdd(c,'sys','Turno reprogramado: '+crmHm(prev)+' → '+crmHm(at),{kind:'turno'});}
   else{a={id:uid(),at,what:wt,st:'reservado',by:crmMe()};c.appts=(c.appts||[]).concat(a);crmAdd(c,'sys','Turno reservado: '+crmHm(at)+' · '+wt,{kind:'turno'});}
   audit('CRM_TURNO',crmWho(c)+' · '+(old?'reprogramado ':'')+crmHm(at));save();
   if($('#ca-s',w).checked){try{await crmSend(c,`Hola ${crmFirst(c)}, ${old?'reprogramamos':'te reservamos'} tu turno para el ${crmHm(at)} (${wt}). ¿Nos confirmás?`,{kind:'turno'});}catch(e){toast(e.message,1);}}crmPaint();}});};
A.crmApptOk=el=>{const c=crmCur();const a=c&&(c.appts||[]).find(x=>x.id===el.dataset.id);if(!a)return;a.st='confirmado';crmAdd(c,'sys','Turno confirmado: '+crmHm(a.at),{kind:'turno'});audit('CRM_TURNO',crmWho(c)+' · confirmado '+crmHm(a.at));save();crmPaint();};
A.crmApptX=el=>{const c=crmCur();const a=c&&(c.appts||[]).find(x=>x.id===el.dataset.id);if(!a)return;confirmBox('Cancelar turno','Se cancela el turno del '+crmHm(a.at)+'.',()=>{a.st='cancelado';crmAdd(c,'sys','Turno cancelado: '+crmHm(a.at),{kind:'turno'});audit('CRM_TURNO',crmWho(c)+' · cancelado '+crmHm(a.at));save();crmPaint();},'Cancelar turno');};
async function crmSurveyFor(c,k){const t=k==='nps'?`Hola ${crmFirst(c)}, del 0 al 10, ¿qué tan probable es que nos recomiendes a un amigo?`:`Hola ${crmFirst(c)}, ¿cómo te atendimos? Respondé con un número del 1 (mal) al 5 (excelente). ¡Nos ayuda mucho!`;
 await crmSend(c,t,{kind:'encuesta',survey:k,noState:1});c.asked=now();save();}
A.crmSurvey=async el=>{const c=crmCur();if(!c)return;try{await crmSurveyFor(c,el.dataset.k==='nps'?'nps':'csat');crmPaint();}catch(e){toast(e.message,1);}};
A.crmCsatAsk=A.crmSurvey;
A.crmCsatSet=el=>{const c=crmCur();const v=+el.dataset.v;if(!c||!(v>=1&&v<=5))return;c.csat=v;crmAdd(c,'sys','Calificación registrada: '+v+'/5 ('+crmMe()+')',{kind:'csat'});audit('CRM_CSAT',crmWho(c)+' · '+v+'/5');save();crmPaint();};
function crmConvFor(cu){return convs().filter(c=>c.cust===cu.id&&c.chan==='wa').sort((a,b)=>b.last-a.last)[0]||crmNew({chan:'wa',cust:cu.id,asg:crmMe()});}
A.crmAviso=async el=>{const k=el.dataset.k,id=el.dataset.id;try{
 if(k==='deuda'){const cu=custById(id);if(!cu)return;if(!waOk(cu))return toast('Ese cliente no tiene WhatsApp válido.',1);const c=crmConvFor(cu);c.dept=c.dept||'Cobranzas';await crmSend(c,waDebtText(cu),{kind:'aviso-deuda'});crmSel=c.id;}
 else if(k==='presup'){const q=quotes().find(x=>x.id===id);const cu=q&&custById(q.cust);if(!cu)return;const c=crmConvFor(cu);await crmSend(c,crmQuoteText(c,q)+'\n(Te recordamos que vence pronto.)',{kind:'aviso-presupuesto'});crmSel=c.id;}
 else if(k==='turno'){const [cid,aid]=id.split('|');const c=convById(cid);const a=c&&(c.appts||[]).find(x=>x.id===aid);if(!a)return;await crmSend(c,`Hola ${crmFirst(c)}, te recordamos tu turno del ${crmHm(a.at)} (${a.what}). ¡Te esperamos!`,{kind:'aviso-turno'});a.rem=now();save();crmSel=c.id;}
 else if(k==='csat'){const c=convById(id);if(!c)return;await crmSurveyFor(c,'csat');crmSel=c.id;}
 audit('CRM_AVISO',k);save();rerender();}catch(e){toast(e.message||'No se pudo.',1);}};
A.crmCampNew=()=>{const seg=val('cm-seg');const txt=crmTxt(val('cm-tx'));if(!CRM_SEG[seg])return;if(txt.length<10)return toast('Escribí el mensaje de la campaña.',1);
 const ids=crmSegList(seg).slice(0,300).map(c=>c.id);if(!ids.length)return toast('Ese segmento no tiene destinatarios.',1);
 confirmBox('Crear campaña','Se va a preparar el envío a <b>'+ids.length+'</b> cliente(s) del segmento «'+esc(CRM_SEG[seg])+'». Cada mensaje se abre en WhatsApp y lo confirmás vos.',()=>{
  const C=crmCfg();const k={id:uid(),ts:now(),seg,txt,ids,done:[],by:crmMe()};crmSet({camps:C.camps.concat(k).slice(-10)});audit('CRM_CAMPANA',CRM_SEG[seg]+' · '+ids.length+' destinatarios');save();rerender();},'Crear');};
A.crmCampNext=el=>{const C=crmCfg();const k=C.camps.find(x=>x.id===el.dataset.id);if(!k)return;const next=k.ids.find(id=>!k.done.includes(id));const cu=custById(next);
 k.done.push(next);crmSet({camps:C.camps});if(cu&&waOk(cu)&&cu.status!=='baja'&&(k.seg==='deuda'||hasComm(cu))){const c=crmConvFor(cu);const t=k.txt.replace(/\{nombre\}/g,String(cu.name||'').split(/\s+/)[0]);
  crmSend(c,t,{kind:'campaña',noState:1}).catch(e=>toast(e.message,1));}else toast('Se salteó un cliente que ya no está disponible o no acepta promociones.');save();rerender();};
const CRM_SIM=[['ig','Hola! Tienen stock de lo que publicaron? cuánto sale?'],['fb','Buenas, hacen envíos a domicilio?'],['tg','Quiero reservar un turno para retirar un pedido grande el sábado'],['mail','Hola, compré ayer y el producto llegó dañado, quiero hacer un reclamo urgente'],['web','Hola! hasta qué hora abren hoy?'],['wa','Gracias por todo, excelente atención!!']];
A.crmSim=async()=>{if(!CRM_FULL)return;const C=crmCfg();const L=CRM_SIM.filter(x=>C.chans.includes(x[0]));const [ch,tx]=L[Math.floor(Math.random()*L.length)];const cus=S.customers.filter(c=>c.status!=='baja');const cu=cus[Math.floor(Math.random()*cus.length)];
 let c=convs().map(crmFix).find(x=>x.chan===ch&&x.cust===(cu?cu.id:'')&&crmOpen(x));const isNew=!c;if(!c)c=crmNew({chan:ch,cust:cu?cu.id:'',name:cu?'':'Cliente de ejemplo',tags:['ejemplo']});
 crmAdd(c,'in',tx,{via:'mensaje simulado (ejemplo)'});if(isNew)crmRoute(c,tx);save();crmSel=c.id;crmTab='inbox';await crmBot(c,tx);rerender();toast('Llegó un mensaje de ejemplo por '+CHAN[ch]);};
const PAY_HOSTS=['mpago.la','link.mercadopago.com.ar','mercadopago.com.ar','www.mercadopago.com.ar','buy.stripe.com','checkout.stripe.com','pay.stripe.com'];
function crmPayLinkOk(u){try{const x=new URL(u);return x.protocol==='https:'&&PAY_HOSTS.includes(x.hostname);}catch(e){return false;}}
A.crmCfgOpen=()=>{if(!can('config'))return toast('Sin permiso',1);const C=crmCfg();
 modal('Ajustes de Atención al cliente',`<label class="chk"><input type="checkbox" id="cc-on" ${C.on?'checked':''}> <span>Activar Atención al cliente</span></label>
  <label class="chk"><input type="checkbox" id="cc-web" ${C.web?'checked':''}> <span>Mostrar el chat «Escribinos» en el menú público</span></label>
  <label for="cc-g">Saludo del chat del menú</label><input id="cc-g" maxlength="160" value="${esc(C.greet)}">
  <p class="sm" style="margin:.5rem 0 .2rem"><b>Canales</b></p><div class="row" style="gap:.4rem">${Object.keys(CHAN).filter(k=>CRM_FULL||!CHAN_DEMO.includes(k)).map(k=>`<label class="chk" style="margin:0"><input type="checkbox" class="cc-ch" value="${k}" ${C.chans.includes(k)?'checked':''}> <span>${CHAN[k]}${CHAN_DEMO.includes(k)?' (demostración)':''}</span></label>`).join('')}</div>
  <label for="cc-dp">Departamentos / colas (separados por coma)</label><input id="cc-dp" maxlength="120" value="${esc(C.depts.join(', '))}">
  <label for="cc-rt">Ruteo de conversaciones nuevas</label><select id="cc-rt"><option value="manual" ${C.route==='manual'?'selected':''}>Manual (las toma quien esté libre)</option><option value="dept" ${C.route==='dept'?'selected':''}>Por departamento según el tema</option><option value="rr" ${C.route==='rr'?'selected':''}>Por departamento y por turnos entre agentes (round robin)</option></select>
  <label for="cc-rr">Agentes que reciben por turnos (separados por coma)</label><input id="cc-rr" maxlength="200" value="${esc(C.rr.join(', '))}" placeholder="${esc(crmAgents().join(', '))}">
  <label class="chk"><input type="checkbox" id="cc-bot" ${C.bot.on?'checked':''}> <span>Bot de primer nivel: responde solo las preguntas frecuentes en el chat web</span></label>
  <label for="cc-faq">Preguntas frecuentes (una por línea: palabras clave separadas por coma | respuesta)</label><textarea id="cc-faq" rows="4" style="width:100%">${esc(C.bot.faq.map(f=>f.k+' | '+f.a).join('\n'))}</textarea>
  <label class="chk"><input type="checkbox" id="cc-tu" ${C.turnos?'checked':''}> <span>Turnos y agenda (canchas, spa, profesionales, retiros)</span></label>
  <label class="chk"><input type="checkbox" id="cc-as" ${C.autoSurvey?'checked':''}> <span>Encuesta postventa (CSAT) automática al cerrar un chat web</span></label>
  <p class="sm" style="margin:.5rem 0 .2rem"><b>Cobros</b> (datos que se envían al cliente)</p><label for="cc-lk">Link de pago fijo del comercio (Mercado Pago o Stripe, opcional)</label><input id="cc-lk" maxlength="200" value="${esc(C.pay.link)}" placeholder="https://link.mercadopago.com.ar/tucomercio">
  <div class="grid g2"><div><label for="cc-al">Alias</label><input id="cc-al" maxlength="40" value="${esc(C.pay.alias)}"></div><div><label for="cc-cb">CBU / CVU</label><input id="cc-cb" inputmode="numeric" maxlength="22" value="${esc(C.pay.cbu)}"></div></div>
  <label for="cc-ho">Titular</label><input id="cc-ho" maxlength="60" value="${esc(C.pay.holder)}">
  <p class="sm" style="margin:.5rem 0 .2rem"><b>Prioridad por reglas</b></p><label for="cc-w">Palabras que suben la prioridad (separadas por coma)</label><input id="cc-w" maxlength="400" value="${esc(C.words)}">
  <label for="cc-m">Minutos sin responder para prioridad alta</label><input id="cc-m" inputmode="numeric" value="${C.waitMin}">
  <label for="cc-r">Respuestas rápidas (una por línea: título | texto · {nombre} se reemplaza)</label><textarea id="cc-r" rows="5" style="width:100%">${esc(C.canned.map(x=>x.t+' | '+x.x).join('\n'))}</textarea>`,
  {okText:'Guardar',onOk:w=>{const m=parseNum(val('cc-m'));if(!(Number.isInteger(m)&&m>=5&&m<=1440))return w._err('Los minutos van de 5 a 1440.'),false;
   const cbu=val('cc-cb').replace(/\D/g,'');if(cbu&&cbu.length!==22)return w._err('El CBU/CVU tiene 22 números.'),false;
   const lk=val('cc-lk').trim();if(lk&&!crmPayLinkOk(lk))return w._err('El link de pago tiene que ser https de Mercado Pago o Stripe.'),false;
   const pairs=s=>val(s).split('\n').map(l=>{const i=l.indexOf('|');return i>0?[l.slice(0,i).trim(),l.slice(i+1).trim()]:null;}).filter(x=>x&&x[0]&&x[1]);
   const canned=pairs('cc-r').map(([t,x])=>({t:t.slice(0,30),x:x.slice(0,500)})).slice(0,30);const faq=pairs('cc-faq').map(([k,a])=>({k:k.replace(/[<>]/g,'').slice(0,200),a:a.slice(0,500)})).slice(0,20);
   const chans=[...w.querySelectorAll('.cc-ch:checked')].map(x=>x.value).filter(k=>CHAN[k]);if(!chans.length)return w._err('Dejá al menos un canal.'),false;
   const depts=[...new Set(val('cc-dp').split(',').map(x=>x.trim().replace(/[<>]/g,'').slice(0,24)).filter(Boolean))].slice(0,8);if(!depts.length)return w._err('Dejá al menos un departamento.'),false;
   const route=['manual','dept','rr'].includes(val('cc-rt'))?val('cc-rt'):'manual';const rr=[...new Set(val('cc-rr').split(',').map(x=>x.trim().replace(/[<>]/g,'').slice(0,40)).filter(Boolean))].slice(0,20);
   if(route==='rr'&&!rr.length)return w._err('Para el round robin escribí los agentes que reciben por turnos.'),false;
   crmSet({on:$('#cc-on',w).checked,web:$('#cc-web',w).checked,greet:val('cc-g').trim().replace(/[<>]/g,'').slice(0,160),chans,depts,route,rr,turnos:$('#cc-tu',w).checked,autoSurvey:$('#cc-as',w).checked,
    bot:{on:$('#cc-bot',w).checked,faq:faq.length?faq:CRM_FAQ},pay:{link:lk,alias:val('cc-al').trim().replace(/[^A-Za-z0-9.\-]/g,'').slice(0,40),cbu,holder:val('cc-ho').trim().replace(/[<>]/g,'').slice(0,60)},words:val('cc-w').replace(/[<>]/g,'').slice(0,400),waitMin:m,canned:canned.length?canned:CRM_CANNED});
   audit('CRM_AJUSTES',(crmCfg().on?'activado':'apagado')+' · canales '+chans.join(',')+' · ruteo '+route);save();if(typeof pubRefresh==='function')pubRefresh();rerender();}});};

/* ---------- datos de ejemplo (sólo demos) ---------- */
function crmDemoSeed(){if(IS_CLIENT)return;convs().forEach(crmFix);if(S.crmDemo>=2)return;const L=S.customers.filter(c=>c.status!=='baja');if(L.length<3)return;
 if(!S.crmDemo){crmSet({pay:{alias:'comercio.ejemplo.mp',cbu:'',holder:'Comercio de ejemplo',link:''}});
  const t=now();const at=ago=>t-ago*60000;
  const mk=(f,msgs,extra)=>{const c=crmNew(Object.assign({tags:['ejemplo']},f));msgs.forEach(([d,x,ago,o])=>crmAdd(c,d,x,Object.assign({ts:at(ago)},o||{})));c.last=at(Math.min(...msgs.map(x=>x[2])));c.ts=at(Math.max(...msgs.map(x=>x[2])));Object.assign(c,extra||{});return c;};
  const p=S.products.find(x=>x.active&&x.price>0);const ag=(S.users||[]).map(u=>u.name);const a0=ag[0]||'ADMIN',a2=ag[2]||ag[0]||'Mostrador';
  mk({chan:'web',cust:L[0].id,dept:'Ventas',asg:a2,tags:['ejemplo','lead']},[['in','Hola! '+(p?'¿Tienen '+p.name+'?':'¿Tienen stock?')+' ¿Cuánto sale?',95],['out','¡Hola! Sí, lo tenemos. ¿Te lo guardamos?',90,{user:a2,via:'enviado al chat'}],['in','Sí porfa, paso a la tarde',12]],{state:'proceso'});
  mk({chan:'wa',cust:L[1].id,dept:'Soporte'},[['in','Buenas, compré ayer y el producto llegó dañado. Quiero hacer un reclamo urgente',48]],{state:'nuevo'});
  mk({chan:'ig',name:'Lucía (Instagram, ejemplo)',dept:'Ventas'},[['in','Hola! Hacen envíos a domicilio? 😊',30],['out','¡Hola! Sí, hacemos envíos. Contanos tu dirección y qué necesitás, y te pasamos el costo.',30,{user:'Asistente automático',kind:'bot',via:'canal de demostración (no se envió a ninguna red)'}]],{state:'nuevo'});
  const c=mk({chan:'tg',cust:L[2].id,dept:'Ventas',asg:a0},[['in','Quiero reservar un turno para retirar un pedido grande',300],['out','¡Dale! Te reservé para mañana a las 10.',290,{user:a0}]],{state:'pendiente'});c.appts=[{id:uid(),at:t+20*3600e3,what:'Retiro de pedido (ejemplo)',st:'reservado',by:a0}];
  mk({chan:'local',cust:L[0].id,dept:'Ventas',asg:a0},[['in','Gracias por la atención, excelente!',2000],['out','¡Gracias a vos!',1990,{user:a0}]],{state:'cerrado',csat:5,nps:10,closedAt:at(1980)});}
 const t=now();const ag=(S.users||[]).map(u=>u.name);const a1=ag[1]||ag[0]||'Supervisor';
 if(L[3]||L[1]){const cu=L[3]||L[1];const c=crmNew({chan:'mail',cust:cu.id,dept:'Cobranzas',asg:a1,tags:['ejemplo']});crmAdd(c,'in','Hola, ¿me pasan los datos para pagar lo que debo?',{ts:t-4*3600e3});crmAdd(c,'out','¡Hola! Te pasamos los datos de pago por acá.',{ts:t-3.5*3600e3,user:a1,via:'canal de demostración (no se envió a ninguna red)'});
  c.state='cerrado';c.closedAt=t-3*3600e3;c.csat=4;c.nps=8;c.ts=t-4*3600e3;}
 crmSet({depts:['Ventas','Soporte','Cobranzas'],route:'dept'});S.crmDemo=2;}
