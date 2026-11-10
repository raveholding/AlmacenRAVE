/* ===== V26.63 · SEGURIDAD INTEGRADA AL ERP (sólo demo raveV3) =====
   Cámaras (grilla 2×2), puertas y relés, timbre/portero, credenciales de acceso derivadas del personal y del Club,
   pases QR temporales firmados, terminal de acceso, botón de pánico silencioso en Vender, PIN de coacción por usuario
   y registro unificado de eventos vinculado a la caja, el turno y la última venta.
   Qué es REAL en esta demo: reglas de acceso, firma y validación de credenciales (HMAC-SHA-256 del navegador), registro de
   eventos y auditoría, pánico y coacción silenciosos, la cámara de ESTE equipo con detección de movimiento por diferencia
   de cuadros y la foto de evidencia (sólo si el permiso de cámara ya estaba dado).
   Qué es SIMULACIÓN (rotulado en pantalla): las cámaras IP, los relés de las puertas, el timbre y la puerta forzada.
   Sin servidor ni gateway: RTSP no se puede abrir desde un navegador; las cámaras IP necesitan un gateway WebRTC y los
   relés (ESP32 / placa de relés) un gateway local. Reconocimiento facial y huellas: NO implementados (datos biométricos,
   revisión legal previa · 6.7). */
(()=>{
'use strict';
const E=v=>esc(v);
const SAFE=(fn,fb)=>{try{return fn();}catch(e){try{console.warn('Seguridad:',e);}catch(_){}return fb;}};
const SV=1,MAXEV=600,MIN=60000,HOUR=3600000;
const LV={crit:'Crítico',alta:'Alto',info:'Info'};
const TYPES={COACCION_PIN:'Coacción (PIN de coacción)',PANICO:'Botón de pánico',PUERTA_FORZADA:'Puerta forzada',TIMBRE:'Timbre / portero',
 MOVIMIENTO:'Movimiento sostenido',ACCESO_OK:'Acceso permitido',ACCESO_DENEGADO:'Acceso denegado',PUERTA_ABIERTA:'Apertura manual',PASE_EMITIDO:'Pase emitido',PASE_REVOCADO:'Pase revocado',CONFIG:'Cambio de configuración'};
/* permisos nuevos (el núcleo los muestra en Usuarios y permisos) */
if(typeof PERMS==='object'){PERMS.sec_view=PERMS.sec_view||'Seguridad: ver cámaras, puertas y eventos';PERMS.sec_doors=PERMS.sec_doors||'Seguridad: abrir puertas y emitir pases';PERMS.sec_admin=PERMS.sec_admin||'Seguridad: configuración, coacción y reglas';}
const canS=p=>typeof can==='function'&&can(p);
const SEC={duressSess:'',streams:{},raf:0,motion:{},tab:'panel',flt:{t:'',lvl:''},openT:{}};
window.SEC=SEC;

/* ---------- estado (con valores por defecto: un estado viejo carga sin errores) ---------- */
function secS(){if(!S.sec||typeof S.sec!=='object'){S.sec={v:SV,ex:1,
  cams:[{id:'c1',name:'Entrada (ejemplo)',zone:'Frente',kind:'sim',url:''},{id:'c2',name:'Caja (ejemplo)',zone:'Mostrador',kind:'sim',url:''},{id:'c3',name:'Depósito (ejemplo)',zone:'Depósito',kind:'sim',url:''},{id:'c4',name:'Vereda (ejemplo)',zone:'Exterior',kind:'sim',url:''}],
  doors:[{id:'d1',name:'Puerta principal (ejemplo)',cam:'c1',bell:true,relay:'sim'},{id:'d2',name:'Depósito (ejemplo)',cam:'c3',bell:false,relay:'sim'},{id:'d3',name:'Puerta del personal (ejemplo)',cam:'c4',bell:true,relay:'sim'}],
  rules:{emp:{doors:['d1','d2','d3'],h:[6,23]},socio:{doors:['d1'],h:[9,22]},visita:{doors:['d1','d2'],h:[8,20]}},
  passes:[],revoked:[],events:[],duress:{},photo:false,key:''};
  if(typeof S.roles==='object'&&S.roles.supervisor){['sec_view','sec_doors'].forEach(p=>{if(!S.roles.supervisor.includes(p))S.roles.supervisor.push(p);});}}
 const s=S.sec;['cams','doors','passes','revoked','events'].forEach(k=>{if(!Array.isArray(s[k]))s[k]=[];});if(!s.rules)s.rules={};if(!s.duress)s.duress={};
 ['emp','socio','visita'].forEach(k=>{if(!s.rules[k])s.rules[k]={doors:[],h:[0,24]};});
 if(!s.key){const b=new Uint8Array(32);crypto.getRandomValues(b);s.key=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');}
 return s;}

/* ---------- contexto operativo: caja, turno y última venta del turno ---------- */
function ctx(){return SAFE(()=>{const ss=typeof openSess==='function'?openSess():null;const sales=(S.sales||[]).filter(x=>ss&&x.sessId===ss.id);const last=sales.length?sales[sales.length-1]:null;
 return{sess:ss?ss.id:'',caja:S.tenant&&S.tenant.caja,user:user?user.name:'sistema',uid:user?user.id:'',sale:last?last.id:'',saleN:last?(last.n||''):'',lines:(typeof pos!=='undefined'&&pos.lines)?pos.lines.length:0};},{});}

/* ---------- registro unificado de eventos (y auditoría encadenada del ERP) ---------- */
function secEvent(type,o){const s=secS();o=o||{};const e=Object.assign({id:uid(),ts:now(),type,lvl:o.lvl||'info',door:o.door||'',cam:o.cam||'',who:String(o.who||'').slice(0,80),detail:String(o.detail||'').slice(0,300),real:o.real!==false,silent:!!o.silent,ack:0,ackBy:'',photo:''},ctx());
 s.events.push(e);if(s.events.length>MAXEV)s.events.splice(0,s.events.length-MAXEV);
 const act=type==='COACCION_PIN'||type==='PANICO'?'CRITICAL_DURESS_EVENT':'SEG_'+type;
 audit(act,(TYPES[type]||type)+(e.who?' · '+e.who:'')+(e.detail?' · '+e.detail:'')+(e.real?'':' (simulación)')+(e.caja!=null?' · caja '+e.caja:'')+(e.saleN?' · última venta '+e.saleN:''),{ent:'seguridad',eid:e.id});
 save();if(!e.silent)setTimeout(secFloat,0);return e;}
const hiddenFor=e=>e.silent&&SEC.duressSess&&user&&user.id===SEC.duressSess;   /* la sesión bajo coacción no ve sus propios eventos silenciosos */
const visible=()=>secS().events.filter(e=>!hiddenFor(e));

/* ---------- credenciales firmadas (HMAC-SHA-256 con una llave de este comercio) ---------- */
const b64u=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const hexB=h=>new Uint8Array(h.match(/../g).map(x=>parseInt(x,16)));
async function sign(payload){const k=await crypto.subtle.importKey('raw',hexB(secS().key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64u(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(payload))).slice(0,22);}
async function credMake(kind,ref,exp){const n=Array.from(crypto.getRandomValues(new Uint8Array(4)),x=>x.toString(16).padStart(2,'0')).join('');const p=['VBA1',kind,ref,exp,n].join('.');return p+'.'+(await sign(p));}
function personOf(kind,ref){const s=secS();
 if(kind==='emp'){const e=(S.employees||[]).find(x=>x.id===ref);return e?{name:e.name,ok:!!e.active,why:e.active?'':'empleado inactivo'}:null;}
 if(kind==='socio'){const c=(S.customers||[]).find(x=>x.id===ref);if(!c)return null;const m=(S.members||[]).find(x=>x.cust===c.id&&x.status==='activa'&&x.to>now());const nm=typeof custFull==='function'?custFull(c):(c.name||'Socio');
  return{name:nm,ok:c.status!=='baja'&&!!m,why:c.status==='baja'?'cliente dado de baja':(!m?'sin membresía activa':'')};}
 if(kind==='visita'){const p=s.passes.find(x=>x.id===ref);return p?{name:p.name+(p.reason?' · '+p.reason:''),ok:true,pass:p}:null;}
 return null;}
async function credCheck(code,doorId){const s=secS();const door=s.doors.find(d=>d.id===doorId);code=String(code||'').trim();const deny=(why,who)=>({ok:false,why,who:who||''});
 if(!door)return deny('puerta inexistente');
 const pr=code.split('.');
 if(pr.length!==6||pr[0]!=='VBA1'){if(/\d{13,19}/.test(code.replace(/[\s-]/g,'')))return deny('formato inválido (no se aceptan números de tarjeta)');return deny('credencial con formato desconocido');}
 if(!/^(emp|socio|visita)$/.test(pr[1])||!/^[A-Za-z0-9_-]{1,40}$/.test(pr[2])||!/^\d{10,14}$/.test(pr[3]))return deny('credencial con formato desconocido');
 const [,kind,ref,exp]=pr;if((await sign(pr.slice(0,5).join('.')))!==pr[5])return deny('firma inválida (credencial alterada o de otro comercio)');
 const pe=personOf(kind,ref);if(!pe)return deny('persona inexistente');
 if(s.revoked.includes(code)||(pe.pass&&pe.pass.revoked))return deny('credencial revocada',pe.name);
 if(+exp<now())return deny('credencial vencida',pe.name);
 if(!pe.ok)return deny(pe.why,pe.name);
 const rule=s.rules[kind]||{doors:[],h:[0,24]};if(!rule.doors.includes(doorId))return deny('no tiene permiso para '+door.name,pe.name);
 const hr=new Date(now()).getHours();if(hr<rule.h[0]||hr>=rule.h[1])return deny('fuera del horario permitido ('+rule.h[0]+' a '+rule.h[1]+' h)',pe.name);
 if(pe.pass){const p=pe.pass;if(p.doors&&p.doors.length&&!p.doors.includes(doorId))return deny('el pase no incluye '+door.name,pe.name);if(p.from&&p.from>now())return deny('el pase todavía no está vigente',pe.name);if(p.max&&(p.used||0)>=p.max)return deny('el pase ya se usó',pe.name);}
 return{ok:true,who:pe.name,kind,pass:pe.pass||null};}
async function accessAttempt(code,doorId,how){const r=await credCheck(code,doorId);const d=secS().doors.find(x=>x.id===doorId);
 if(r.ok){if(r.pass){r.pass.used=(r.pass.used||0)+1;}doorPulse(doorId);secEvent('ACCESO_OK',{door:doorId,who:r.who,detail:(d?d.name:'')+' · '+(how||'código'),real:true});}
 else secEvent('ACCESO_DENEGADO',{lvl:'alta',door:doorId,who:r.who,detail:(d?d.name:'')+' · '+r.why,real:true});
 return r;}

/* ---------- puertas (relé simulado; con gateway sería un pulso al ESP32 / placa de relés) ---------- */
const doorState=id=>SEC.openT[id]&&SEC.openT[id]>now()?'abierta':'cerrada';
function doorPulse(id){SEC.openT[id]=now()+5000;setTimeout(()=>{if(curScreen==='seguridad')secPaintDoors();},5100);if(curScreen==='seguridad')secPaintDoors();}

/* ---------- pánico silencioso y PIN de coacción ---------- */
async function evidencePhoto(ev){if(!secS().photo||!navigator.mediaDevices)return;
 try{const st=await navigator.permissions.query({name:'camera'});if(st.state!=='granted'){ev.detail+=' · sin foto (la cámara no tenía permiso dado)';save();return;}}catch(_){return;}
 try{const ms=await navigator.mediaDevices.getUserMedia({video:{width:320,height:240},audio:false});const v=document.createElement('video');v.muted=true;v.playsInline=true;v.srcObject=ms;await v.play();await new Promise(r=>setTimeout(r,700));
  const c=document.createElement('canvas');c.width=320;c.height=240;c.getContext('2d').drawImage(v,0,0,320,240);ev.photo=c.toDataURL('image/jpeg',0.6);ms.getTracks().forEach(t=>t.stop());save();}catch(e){ev.detail+=' · sin foto ('+(e&&e.name||'error')+')';save();}}
function panic(how){const ev=secEvent('PANICO',{lvl:'crit',silent:true,detail:'disparado desde '+(how||'Vender'),real:true});evidencePhoto(ev);}
const duressHash=(uid0,pin)=>sha256('VB-COACCION|'+(S.tenant&&S.tenant.name||'')+'|'+uid0+'|'+pin);
function duressMatch(u,pin){const h=secS().duress[u.id];return !!h&&/^\d{4,8}$/.test(pin)&&duressHash(u.id,pin)===h;}
if(typeof A==='object'&&typeof A.login==='function'){const orig=A.login;
 A.login=(...a)=>{const u=(S.users||[]).find(x=>x.id===val('lu'));const p=val('lp');
  if(u&&p!==u.pin&&SAFE(()=>duressMatch(u,p),false)){/* entra como siempre: nada en pantalla delata la coacción */
   user=u;SEC.duressSess=u.id;audit('LOGIN','ingreso desde menú/acceso');const ev=secEvent('COACCION_PIN',{lvl:'crit',silent:true,who:u.name,detail:'ingreso con PIN de coacción',real:true});evidencePhoto(ev);location.hash='#panel/inicio';return;}
  SEC.duressSess='';return orig(...a);};}
if(typeof A==='object'&&typeof A.logout==='function'){const o=A.logout;A.logout=(...a)=>{SEC.duressSess='';camsStop();return o(...a);};}
document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.altKey&&(e.key==='p'||e.key==='P')&&user&&!$('#panel').hidden){e.preventDefault();panic('atajo Ctrl+Alt+P');}});

/* ---------- avisos flotantes (nunca los de coacción ni pánico) ---------- */
function secFloat(){SAFE(()=>{let box=document.getElementById('sec-float');const show=user&&!$('#panel').hidden&&canS('sec_view');
 const all=show?secS().events.filter(e=>!e.silent&&!e.ack&&(e.lvl==='crit'||e.type==='TIMBRE')):[];const L=all.slice(-1);const more=all.length-L.length;
 if(!L.length){if(box)box.remove();return;}
 if(!box){box=document.createElement('div');box.id='sec-float';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.appendChild(box);}
 box.innerHTML=L.map(e=>`<div class="secf ${e.lvl}"><b>${E(TYPES[e.type]||e.type)}${e.real?'':' · simulación'}</b><span>${E(fmtDT(e.ts))} · ${E((secS().doors.find(d=>d.id===e.door)||{}).name||e.cam||'')} ${E(e.detail)}</span>
  <div class="row">${e.type==='TIMBRE'&&canS('sec_doors')?`<button class="btn sm gold" data-act="secOpenBell" data-id="${E(e.id)}">Abrir</button>`:''}<button class="btn sm" data-act="secGo">Ver</button><button class="btn sm ghost" data-act="secAck" data-id="${E(e.id)}">Recibido</button></div>${more?`<span class="sm">y ${more} aviso(s) más en Seguridad</span>`:''}</div>`).join('');});}

/* ---------- cámaras: simulación dibujada, cámara de este equipo y detección de movimiento ---------- */
function camsStop(){Object.values(SEC.streams).forEach(ms=>SAFE(()=>ms.getTracks().forEach(t=>t.stop())));SEC.streams={};SEC.motion={};cancelAnimationFrame(SEC.raf);SEC.raf=0;}
function drawSim(cv,cam,t){const x=cv.getContext('2d'),w=cv.width,h=cv.height;const seed=cam.id.charCodeAt(1)||1;
 x.fillStyle='#14161b';x.fillRect(0,0,w,h);x.strokeStyle='rgba(120,140,160,.25)';x.lineWidth=1;
 for(let i=0;i<8;i++){x.beginPath();x.moveTo(w/2+(i-3.5)*w*0.02,h*0.35);x.lineTo(w/2+(i-3.5)*w*0.2,h);x.stroke();}
 for(let i=1;i<6;i++){const y=h*0.35+Math.pow(i/6,1.6)*h*0.65;x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke();}
 const px=w*(0.5+0.35*Math.sin(t/(2600+seed*90)+seed)),py=h*0.72;x.fillStyle='rgba(200,210,220,.55)';x.beginPath();x.ellipse(px,py-h*0.13,w*0.025,h*0.05,0,0,7);x.fill();x.fillRect(px-w*0.03,py-h*0.08,w*0.06,h*0.16);
 const img=x.getImageData(0,0,w,h),d=img.data;for(let i=0;i<d.length;i+=16){const n=(Math.random()*18)|0;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}x.putImageData(img,0,0);
 x.fillStyle='rgba(0,0,0,.6)';x.fillRect(0,0,w,20);x.fillStyle='#fff';x.font='bold 11px sans-serif';x.fillText(cam.name,6,14);
 x.textAlign='right';x.fillText(new Date(now()).toLocaleTimeString('es-AR'),w-6,14);x.textAlign='left';
 x.fillStyle='rgba(180,20,20,.85)';x.fillRect(6,h-22,92,16);x.fillStyle='#fff';x.font='bold 10px sans-serif';x.fillText('SIMULACIÓN',12,h-10);}
function motionTick(cam,v){const m=SEC.motion[cam.id]||(SEC.motion[cam.id]={prev:null,since:0,last:0,fired:0,lvl:0});const t=now();if(t-m.last<450)return;m.last=t;
 const c=m.c||(m.c=document.createElement('canvas'));c.width=64;c.height=48;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(v,0,0,64,48);const d=x.getImageData(0,0,64,48).data;
 const g=new Uint8Array(64*48);for(let i=0;i<g.length;i++)g[i]=(d[i*4]*3+d[i*4+1]*6+d[i*4+2])/10;
 if(m.prev){let ch=0;for(let i=0;i<g.length;i++)if(Math.abs(g[i]-m.prev[i])>28)ch++;m.lvl=ch/g.length;
  if(m.lvl>0.02){if(!m.since)m.since=t;if(t-m.since>=8000&&t-m.fired>2*MIN){m.fired=t;secEvent('MOVIMIENTO',{lvl:'alta',cam:cam.name,detail:'movimiento sostenido 8 s en la cámara de este equipo',real:true});}}else m.since=0;}
 m.prev=g;}
function camLoop(){SEC.raf=0;if(curScreen!=='seguridad'||SEC.tab!=='panel'){return;}const t=now();
 secS().cams.forEach(cam=>{const el=document.querySelector('.sec-cam[data-id="'+cam.id+'"]');if(!el)return;
  if(cam.kind==='local'){const v=el.querySelector('video');if(v&&v.readyState>=2){motionTick(cam,v);const b=el.querySelector('.sec-mv');if(b)b.textContent='Movimiento: '+Math.round((SEC.motion[cam.id]||{}).lvl*100||0)+' %';}}
  else{const cv=el.querySelector('canvas');if(cv)drawSim(cv,cam,t);}});
 SEC.raf=requestAnimationFrame(camLoop);}
async function camLocal(id){const cam=secS().cams.find(c=>c.id===id);if(!cam)return;
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return toast('Este navegador no permite usar la cámara.',1);
 try{const ms=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480},audio:false});Object.entries(SEC.streams).forEach(([k,s])=>{s.getTracks().forEach(t=>t.stop());delete SEC.streams[k];secS().cams.forEach(c=>{if(c.kind==='local')c.kind='sim';});});
  SEC.streams[id]=ms;cam.kind='local';audit('SEG_CONFIG','cámara «'+cam.name+'» usa la cámara de este equipo');save();rerender();}
 catch(e){toast('No se pudo abrir la cámara: '+(e&&e.name==='NotAllowedError'?'permiso denegado':(e&&e.name)||'error'),1);}}

/* ---------- pantalla ---------- */
const doorName=id=>(secS().doors.find(d=>d.id===id)||{}).name||'—';
const chip=(t,k)=>`<span class="tag ${k||''}">${E(t)}</span>`;
function camsHTML(){const s=secS();return `<div class="sec-grid">${s.cams.slice(0,4).map(c=>`<figure class="sec-cam" data-id="${E(c.id)}">${c.kind==='local'&&SEC.streams[c.id]?`<video autoplay muted playsinline aria-label="Video en vivo de ${E(c.name)}"></video><figcaption><b>${E(c.name)}</b> · cámara de este equipo <span class="tag ok">● En vivo (real)</span> <span class="sec-mv">Movimiento: 0 %</span></figcaption>`
 :`<canvas width="320" height="200" role="img" aria-label="${E(c.name)}: imagen de simulación, no hay cámara conectada"></canvas><figcaption><b>${E(c.name)}</b> · ${E(c.zone)} ${chip('○ Simulación')} ${c.url?chip('Gateway pendiente','warn'):''}
  <button class="btn sm" data-act="secCamLocal" data-id="${E(c.id)}">Usar la cámara de este equipo</button></figcaption>`}</figure>`).join('')}</div>`;}
function doorsHTML(){const s=secS();return `<div id="sec-doors" class="sec-doors">${s.doors.map(d=>{const st=doorState(d.id);return `<div class="card sec-door"><div><b>${E(d.name)}</b><div class="sm mut">Relé: ${d.relay==='sim'?'simulación (sin placa conectada)':'gateway pendiente'} · cámara: ${E((s.cams.find(c=>c.id===d.cam)||{}).name||'—')}${d.bell?' · con timbre':''}</div></div>
 <div class="row">${chip(st==='abierta'?'Abierta':'Cerrada',st==='abierta'?'warn':'ok')}${canS('sec_doors')?`<button class="btn sm gold" data-act="secOpen" data-id="${E(d.id)}">Abrir</button>`:''}
 <button class="btn sm ghost" data-act="secSim" data-k="PUERTA_FORZADA" data-id="${E(d.id)}" title="Simulación">Simular puerta forzada</button>${d.bell?`<button class="btn sm ghost" data-act="secSim" data-k="TIMBRE" data-id="${E(d.id)}">Simular timbre</button>`:''}</div></div>`;}).join('')}</div>`;}
function secPaintDoors(){const el=document.getElementById('sec-doors');if(el)el.outerHTML=doorsHTML();}
function evRows(L){return L.slice().reverse().map(e=>`<tr class="${e.lvl==='crit'?'neg':''}"><td>${E(fmtDT(e.ts))}</td><td>${E(LV[e.lvl]||e.lvl)}</td><td>${E(TYPES[e.type]||e.type)}${e.real?'':' <span class="tag">simulación</span>'}${e.silent?' <span class="tag warn">silencioso</span>':''}</td>
 <td>${E(e.door?doorName(e.door):(e.cam||''))}</td><td>${E(e.who)}</td><td>${E(e.detail)}${e.photo?` <button class="btn sm" data-act="secPhoto" data-id="${E(e.id)}">Ver foto</button>`:''}</td><td>${e.caja!=null&&e.caja!==''?'Caja '+E(e.caja):''}${e.saleN?' · venta '+E(e.saleN):''}</td><td>${E(e.user||'')}</td>
 <td>${e.ack?'✔ '+E(e.ackBy):(canS('sec_view')?`<button class="btn sm ghost" data-act="secAck" data-id="${E(e.id)}">Recibido</button>`:'')}</td></tr>`).join('');}
function evTable(L,id){return L.length?`<div class="tw"><table id="${id}"><thead><tr><th>Fecha</th><th>Nivel</th><th>Evento</th><th>Lugar</th><th>Persona</th><th>Detalle</th><th>Caja / venta</th><th>Usuario</th><th>Estado</th></tr></thead><tbody>${evRows(L)}</tbody></table></div>`:'<p class="mut">Sin eventos.</p>';}
function tabPanel(){const L=visible();const open=L.filter(e=>!e.ack&&(e.lvl==='crit'||e.lvl==='alta'));
 return `<div class="grid g4"><div class="card kpi"><b class="${open.length?'neg':''}">${open.length}</b><span>Alertas sin atender</span></div><div class="card kpi"><b>${L.filter(e=>e.type==='ACCESO_OK'&&dkey(e.ts)===dkey(now())).length}</b><span>Accesos hoy</span></div><div class="card kpi"><b>${L.filter(e=>e.type==='ACCESO_DENEGADO'&&dkey(e.ts)===dkey(now())).length}</b><span>Denegados hoy</span></div><div class="card kpi"><b>${secS().passes.filter(p=>!p.revoked&&p.to>now()).length}</b><span>Pases vigentes</span></div></div>
 <div class="card"><h3>Cámaras</h3><p class="sm mut">Las cámaras IP necesitan un <b>gateway de video</b> (RTSP → WebRTC): un navegador no puede abrir RTSP. Mientras tanto se ve una <b>simulación</b> rotulada. «Usar la cámara de este equipo» muestra video real y detecta movimiento sostenido (8 s).</p>${camsHTML()}</div>
 <div class="card"><h3>Puertas</h3>${doorsHTML()}</div>
 <div class="card"><h3>Últimos eventos</h3>${evTable(L.slice(-12),'sec-last')}</div>`;}
function tabAccesos(){const s=secS();const emps=(S.employees||[]);const socios=(S.customers||[]).filter(c=>c.status!=='baja'&&(S.members||[]).some(m=>m.cust===c.id&&m.status==='activa'&&m.to>now()));
 return `<div class="card"><h3>Terminal de acceso</h3><p class="sm mut">Escaneá el QR con el lector (escribe solo) o pegá el código. La validación es real: firma, vigencia, persona activa, puerta y horario.</p>
 <div class="row" style="flex-wrap:wrap"><label>Puerta <select id="sec-door">${s.doors.map(d=>`<option value="${E(d.id)}">${E(d.name)}</option>`).join('')}</select></label>
 <input id="sec-code" placeholder="Código de la credencial (VBA1…)" style="flex:1;min-width:220px" autocomplete="off"><button class="btn gold" data-act="secCheck">Validar</button></div><div id="sec-res" role="status" aria-live="polite"></div></div>
 <div class="card"><h3>Credenciales heredadas</h3><p class="sm mut">No se cargan a mano: el <b>personal activo</b> y los <b>socios del Club con membresía activa</b> tienen acceso según las reglas. Si alguien se da de baja o vence su membresía, su QR deja de abrir.</p>
 <div class="tw"><table id="sec-creds"><thead><tr><th>Persona</th><th>Tipo</th><th>Estado</th><th>Puertas</th><th>Horario</th><th></th></tr></thead><tbody>
 ${emps.map(e=>`<tr><td>${E(e.name)}</td><td>Personal</td><td>${e.active?chip('Activo','ok'):chip('Inactivo','warn')}</td><td>${E(s.rules.emp.doors.map(doorName).join(', '))}</td><td>${s.rules.emp.h[0]}–${s.rules.emp.h[1]} h</td><td>${canS('sec_doors')&&e.active?`<button class="btn sm" data-act="secQR" data-k="emp" data-id="${E(e.id)}">QR de acceso</button>`:''}</td></tr>`).join('')}
 ${socios.map(c=>`<tr><td>${E(typeof custFull==='function'?custFull(c):c.name)}</td><td>Socio del Club</td><td>${chip('Membresía activa','ok')}</td><td>${E(s.rules.socio.doors.map(doorName).join(', '))}</td><td>${s.rules.socio.h[0]}–${s.rules.socio.h[1]} h</td><td>${canS('sec_doors')?`<button class="btn sm" data-act="secQR" data-k="socio" data-id="${E(c.id)}">QR de acceso</button>`:''}</td></tr>`).join('')}
 </tbody></table></div>${socios.length?'':'<p class="sm mut">No hay socios con membresía activa: se agregan desde Cupones y membresías.</p>'}</div>
 <div class="card"><h3>Pases temporales (visitas y proveedores)</h3>${canS('sec_doors')?'<button class="btn gold" data-act="secPass">+ Emitir pase</button>':''}
 ${s.passes.length?`<div class="tw"><table id="sec-passes"><thead><tr><th>Para</th><th>Motivo</th><th>Puertas</th><th>Vigencia</th><th>Usos</th><th>Estado</th><th></th></tr></thead><tbody>${s.passes.slice().reverse().map(p=>`<tr><td>${E(p.name)}</td><td>${E(p.reason)}</td><td>${E((p.doors||[]).map(doorName).join(', '))}</td><td>${E(fmtDT(p.from))} → ${E(fmtDT(p.to))}</td><td>${p.used||0}/${p.max||'∞'}</td>
  <td>${p.revoked?chip('Revocado','warn'):p.to<now()?chip('Vencido'):chip('Vigente','ok')}</td><td>${!p.revoked&&canS('sec_doors')?`<button class="btn sm" data-act="secPassQR" data-id="${E(p.id)}">QR</button> <button class="btn sm ghost" data-act="secRevoke" data-id="${E(p.id)}">Revocar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="mut">Sin pases emitidos.</p>'}</div>`;}
function tabEventos(){const f=SEC.flt;let L=visible();if(f.t)L=L.filter(e=>e.type===f.t);if(f.lvl)L=L.filter(e=>e.lvl===f.lvl);
 return `<div class="card"><div class="row" style="flex-wrap:wrap"><label>Tipo <select data-secf="t"><option value="">Todos</option>${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${f.t===k?'selected':''}>${E(v)}</option>`).join('')}</select></label>
 <label>Nivel <select data-secf="lvl"><option value="">Todos</option>${Object.entries(LV).map(([k,v])=>`<option value="${k}" ${f.lvl===k?'selected':''}>${E(v)}</option>`).join('')}</select></label><button class="btn sm" data-act="secCsv">Exportar CSV</button></div>
 <p class="sm mut">Cada evento también queda en la <b>auditoría encadenada</b> del sistema, con la caja, el turno, el usuario y la última venta del turno. Coacción y pánico se registran como <code>CRITICAL_DURESS_EVENT</code>.</p>${evTable(L,'sec-ev')}</div>`;}
function tabConfig(){const s=secS();const adm=canS('sec_admin');
 return `<div class="card"><h3>PIN de coacción</h3><p class="sm mut">Si alguien obliga a un usuario a entrar, ese usuario escribe su <b>PIN de coacción</b> en lugar del normal: el sistema entra como siempre, sin ningún aviso en pantalla, y registra un evento crítico silencioso. Cada usuario tiene el suyo (4 a 8 números, distinto de su PIN). <b>No uses 9999 ni números obvios:</b> un PIN conocido por todos no protege.</p>
 <div class="tw"><table data-nosort><thead><tr><th>Usuario</th><th>PIN de coacción</th><th></th></tr></thead><tbody>${(S.users||[]).map(u=>`<tr><td>${E(u.name)}</td><td>${s.duress[u.id]?chip('Configurado','ok'):chip('Sin configurar')}</td><td>${adm||(user&&user.id===u.id)?`<button class="btn sm" data-act="secDuress" data-id="${E(u.id)}">${s.duress[u.id]?'Cambiar':'Configurar'}</button>`:''}</td></tr>`).join('')}</tbody></table></div>
 <p class="sm mut">Botón de pánico: en <b>Vender</b>, el botón «Asistencia» se mantiene presionado 2 segundos (o <b>Ctrl+Alt+P</b> en cualquier pantalla). No muestra nada en esta caja.</p></div>
 <div class="card"><h3>Foto de evidencia</h3><label class="row"><input type="checkbox" data-secset="photo" ${s.photo?'checked':''} ${adm?'':'disabled'}> Tomar una foto con la cámara de este equipo al disparar pánico o coacción</label>
 <p class="sm mut">Sólo si el permiso de cámara <b>ya estaba dado</b> (no se pide en ese momento). El navegador muestra un indicador mientras la cámara está encendida: <b>no es invisible</b>. La foto queda en este equipo. Datos personales: revisar con asesor legal [VERIFICAR].</p></div>
 <div class="card"><h3>Reglas de acceso</h3>${['emp','socio','visita'].map(k=>{const r=s.rules[k];return `<fieldset class="sec-rule"><legend>${{emp:'Personal activo',socio:'Socios con membresía activa',visita:'Pases temporales'}[k]}</legend>
 ${s.doors.map(d=>`<label><input type="checkbox" data-secrule="${k}" data-door="${E(d.id)}" ${r.doors.includes(d.id)?'checked':''} ${adm?'':'disabled'}> ${E(d.name)}</label>`).join(' ')}
 <label>Desde <input type="number" min="0" max="23" data-sech="${k}" data-i="0" value="${r.h[0]}" ${adm?'':'disabled'} style="width:70px"> h</label><label>hasta <input type="number" min="1" max="24" data-sech="${k}" data-i="1" value="${r.h[1]}" ${adm?'':'disabled'} style="width:70px"> h</label></fieldset>`;}).join('')}</div>
 <div class="card"><h3>Cámaras IP y relés (conexión real pendiente)</h3><p class="sm">Para ver cámaras IP y abrir puertas de verdad hace falta un <b>gateway local</b> en la red del comercio:</p>
 <ul class="sm"><li><b>Video:</b> convierte RTSP de las cámaras a WebRTC con cifrado y usuario por comercio. El navegador nunca recibe la clave de la cámara.</li><li><b>Puertas y timbre:</b> placa ESP32 o de relés conectada al gateway por MQTT o puerto serie; cada apertura queda firmada y auditada.</li><li><b>Datos:</b> los eventos suben a la nube por el servidor con permisos por rol; esta demo no tiene nube.</li></ul>
 <p class="sm mut">Reconocimiento facial y huellas: <b>no implementados</b>. Son datos biométricos sensibles y necesitan revisión legal previa [VERIFICAR Ley 25.326].</p>
 ${adm?`<div class="tw"><table data-nosort><thead><tr><th>Cámara</th><th>Zona</th><th>Dirección del gateway (WebRTC)</th></tr></thead><tbody>${s.cams.map(c=>`<tr><td><input data-seccam="${E(c.id)}" data-f="name" value="${E(c.name)}" maxlength="40"></td><td><input data-seccam="${E(c.id)}" data-f="zone" value="${E(c.zone)}" maxlength="30"></td><td><input data-seccam="${E(c.id)}" data-f="url" value="${E(c.url)}" placeholder="https://gateway.local/whep/…" maxlength="200"></td></tr>`).join('')}</tbody></table></div>`:''}</div>`;}
function view(){secS();const tabs=[['panel','Panel'],['accesos','Accesos'],['eventos','Eventos'],['config','Configuración']].filter(t=>t[0]!=='config'||canS('sec_admin')||canS('sec_view'));
 const t=SEC.tab;return `<div class="card sec-head"><h2>Seguridad</h2><p class="sm">Cámaras, puertas, accesos, timbre, pánico y coacción <b>dentro del sistema de gestión</b>: cada evento queda unido a la caja, el turno y la venta. ${chip('Demo · las cámaras IP y los relés están simulados','warn')}</p>
 <div class="row" role="tablist" style="flex-wrap:wrap">${tabs.map(([k,v])=>`<button class="btn ${t===k?'gold':''}" role="tab" aria-selected="${t===k}" data-act="secTab" data-id="${k}">${v}</button>`).join('')}</div></div>
 ${t==='accesos'?tabAccesos():t==='eventos'?tabEventos():t==='config'?tabConfig():tabPanel()}`;}
function after(){SAFE(()=>{cancelAnimationFrame(SEC.raf);SEC.raf=0;
 secS().cams.forEach(c=>{if(c.kind==='local'){const ms=SEC.streams[c.id];const v=document.querySelector('.sec-cam[data-id="'+c.id+'"] video');if(ms&&v){v.srcObject=ms;v.play().catch(()=>{});}else if(!ms)c.kind='sim';}});
 if(SEC.tab==='panel')SEC.raf=requestAnimationFrame(camLoop);
 document.querySelectorAll('[data-secf]').forEach(el=>el.addEventListener('change',()=>{SEC.flt[el.dataset.secf]=el.value;rerender();}));
 const code=document.getElementById('sec-code');if(code)code.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();A.secCheck();}});
 const adm=canS('sec_admin');if(!adm)return;const s=secS();
 document.querySelectorAll('[data-secset="photo"]').forEach(el=>el.addEventListener('change',()=>{s.photo=el.checked;secEvent('CONFIG',{detail:'foto de evidencia '+(el.checked?'activada':'desactivada')});}));
 document.querySelectorAll('[data-secrule]').forEach(el=>el.addEventListener('change',()=>{const r=s.rules[el.dataset.secrule];const d=el.dataset.door;r.doors=r.doors.filter(x=>x!==d);if(el.checked)r.doors.push(d);secEvent('CONFIG',{detail:'regla '+el.dataset.secrule+': '+(el.checked?'permite ':'quita ')+doorName(d)});}));
 document.querySelectorAll('[data-sech]').forEach(el=>el.addEventListener('change',()=>{const r=s.rules[el.dataset.sech];const i=+el.dataset.i;const v=Math.max(0,Math.min(24,Math.round(+el.value||0)));const h=r.h.slice();h[i]=v;if(h[0]>=h[1]){toast('El horario «desde» tiene que ser menor que «hasta».',1);el.value=r.h[i];return;}r.h=h;secEvent('CONFIG',{detail:'horario '+el.dataset.sech+' '+h[0]+'–'+h[1]+' h'});}));
 document.querySelectorAll('[data-seccam]').forEach(el=>el.addEventListener('change',()=>{const c=s.cams.find(x=>x.id===el.dataset.seccam);if(!c)return;let v=String(el.value||'').trim();
  if(el.dataset.f==='url'&&v&&!/^https:\/\/[A-Za-z0-9.-]+(:\d+)?\/[^\s"'<>]*$/.test(v)){toast('La dirección del gateway tiene que empezar con https:// (nunca rtsp:// ni con usuario y clave).',1);el.value=c.url;return;}
  if(el.dataset.f!=='url'&&!v){el.value=c[el.dataset.f];return;}c[el.dataset.f]=v.slice(0,200);secEvent('CONFIG',{detail:'cámara '+c.id+' · '+el.dataset.f});}));});}

/* ---------- acciones ---------- */
const act=(n,fn)=>{A[n]=(el,e)=>SAFE(()=>fn(el,e));};
act('secTab',el=>{SEC.tab=el.dataset.id;if(SEC.tab!=='panel')camsStop();rerender();});
act('secGo',()=>{SEC.tab='panel';go('seguridad');});
act('secAck',el=>{const e=secS().events.find(x=>x.id===el.dataset.id);if(!e||e.ack)return;e.ack=now();e.ackBy=user?user.name:'';audit('SEG_RECIBIDO',(TYPES[e.type]||e.type)+' · '+fmtDT(e.ts),{ent:'seguridad',eid:e.id});save();secFloat();if(curScreen==='seguridad')rerender();});
act('secCamLocal',el=>camLocal(el.dataset.id));
act('secOpen',el=>{if(!canS('sec_doors'))return toast('Tu usuario no puede abrir puertas.',1);const d=secS().doors.find(x=>x.id===el.dataset.id);if(!d)return;
 modal('Abrir '+d.name,`<p>Se abre por 5 segundos y queda registrado con tu usuario. <b>Relé simulado</b>: no hay placa conectada.</p><label>Motivo<input id="sec-mot" maxlength="120" placeholder="Ej.: entrega de mercadería"></label>`,{okText:'Abrir',onOk:w=>{const m=String(val('sec-mot')||'').trim();if(m.length<3){w._err('Escribí el motivo (3 letras o más).');return false;}
  doorPulse(d.id);secEvent('PUERTA_ABIERTA',{door:d.id,who:user?user.name:'',detail:d.name+' · '+m,real:false});}});});
act('secOpenBell',el=>{const e=secS().events.find(x=>x.id===el.dataset.id);if(!e||!canS('sec_doors'))return;doorPulse(e.door);e.ack=now();e.ackBy=user?user.name:'';secEvent('PUERTA_ABIERTA',{door:e.door,who:user?user.name:'',detail:doorName(e.door)+' · abierta desde el aviso del timbre',real:false});secFloat();});
act('secSim',el=>{const k=el.dataset.k,d=el.dataset.id;if(k==='PUERTA_FORZADA')secEvent(k,{lvl:'crit',door:d,detail:doorName(d)+' abierta sin credencial',real:false});
 else if(k==='TIMBRE')secEvent(k,{lvl:'info',door:d,detail:'tocaron el timbre en '+doorName(d),real:false});if(curScreen==='seguridad')rerender();});
act('secCheck',async()=>{const code=val('sec-code'),door=val('sec-door');const box=document.getElementById('sec-res');if(!String(code||'').trim()){if(box)box.innerHTML='<p class="mut">Escaneá o pegá un código.</p>';return;}
 const r=await accessAttempt(code,door,'terminal');if(box)box.innerHTML=r.ok?`<div class="sec-ok" role="alert">✔ ACCESO PERMITIDO · ${E(r.who)}</div>`:`<div class="sec-no" role="alert">✖ ACCESO DENEGADO${r.who?' · '+E(r.who):''}<br><span class="sm">${E(r.why)}</span></div>`;
 const i=document.getElementById('sec-code');if(i){i.value='';i.focus();}secPaintDoors();});
async function showQR(title,code,note){modal(title,`<div style="text-align:center">${QR.svg(code,4,2)}</div><p class="sm mut" style="word-break:break-all">${E(code)}</p><p class="sm">${note}</p>`,{ok:false,cancelText:'Cerrar'});}
act('secQR',async el=>{if(!canS('sec_doors'))return;const k=el.dataset.k,id=el.dataset.id;const pe=personOf(k,id);if(!pe||!pe.ok)return toast('Esa persona no tiene acceso activo.',1);
 const code=await credMake(k,id,now()+30*86400000);audit('SEG_CREDENCIAL','QR de acceso para '+pe.name+' (30 días)',{ent:'seguridad',eid:id});
 showQR('Credencial de '+pe.name,code,'Vale 30 días, pero <b>deja de abrir en el acto</b> si la persona pasa a inactiva o vence su membresía. Se puede grabar también en una etiqueta NFC.');});
act('secPass',()=>{if(!canS('sec_doors'))return;const s=secS();const t0=new Date(now());const pad=n=>String(n).padStart(2,'0');const loc=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
 modal('Emitir pase temporal',`<label>Nombre de la visita o proveedor<input id="sp-n" maxlength="60"></label><label>Motivo<input id="sp-r" maxlength="80" placeholder="Ej.: entrega de bebidas"></label>
 <div class="row"><label>Desde<input type="datetime-local" id="sp-f" value="${loc(t0)}"></label><label>Hasta<input type="datetime-local" id="sp-t" value="${loc(new Date(now()+2*HOUR))}"></label></div>
 <label>Usos permitidos<input type="number" id="sp-m" min="1" max="20" placeholder="1"></label><fieldset><legend>Puertas</legend>${s.doors.filter(d=>s.rules.visita.doors.includes(d.id)).map(d=>`<label><input type="checkbox" class="sp-d" value="${E(d.id)}" checked> ${E(d.name)}</label>`).join(' ')||'<p class="sm mut">Las reglas no permiten ninguna puerta a visitas.</p>'}</fieldset>`,
 {okText:'Emitir',onOk:async w=>{const n=String(val('sp-n')||'').trim(),r=String(val('sp-r')||'').trim();const f=new Date(val('sp-f')).getTime(),t=new Date(val('sp-t')).getTime();const m=Math.round(+val('sp-m')||1);
  const doors=[...w.querySelectorAll('.sp-d:checked')].map(x=>x.value);
  if(n.length<2)return w._err('Escribí el nombre.'),false;if(r.length<3)return w._err('Escribí el motivo.'),false;if(!(f<t))return w._err('«Hasta» tiene que ser después de «Desde».'),false;
  if(t-f>7*86400000)return w._err('Un pase temporal dura como máximo 7 días.'),false;if(t<now())return w._err('El pase ya estaría vencido.'),false;if(!doors.length)return w._err('Elegí al menos una puerta.'),false;if(m<1||m>20)return w._err('Usos: de 1 a 20.'),false;
  const p={id:uid(),name:n,reason:r,from:f,to:t,max:m,used:0,doors,by:user?user.name:'',ts:now()};s.passes.push(p);p.code=await credMake('visita',p.id,t);
  secEvent('PASE_EMITIDO',{who:n,detail:r+' · '+doors.map(doorName).join(', ')+' · hasta '+fmtDT(t)+' · '+m+' uso(s)'});setTimeout(()=>{rerender();showQR('Pase de '+n,p.code,'Mandalo por WhatsApp o mostralo en pantalla. Vence el '+E(fmtDT(t))+'.');},50);}});});
act('secPassQR',el=>{const p=secS().passes.find(x=>x.id===el.dataset.id);if(p&&p.code)showQR('Pase de '+p.name,p.code,'Vence el '+E(fmtDT(p.to))+'.');});
act('secRevoke',el=>{const p=secS().passes.find(x=>x.id===el.dataset.id);if(!p||!canS('sec_doors'))return;p.revoked=now();if(p.code)secS().revoked.push(p.code);secEvent('PASE_REVOCADO',{who:p.name,detail:p.reason});rerender();});
act('secPhoto',el=>{const e=secS().events.find(x=>x.id===el.dataset.id);if(e&&e.photo)modal('Foto de evidencia',`<img src="${e.photo}" alt="Foto tomada por la cámara de este equipo el ${E(fmtDT(e.ts))}" style="max-width:100%">`,{ok:false,cancelText:'Cerrar'});});
act('secDuress',el=>{const u=(S.users||[]).find(x=>x.id===el.dataset.id);if(!u||!(canS('sec_admin')||(user&&user.id===u.id)))return;
 modal('PIN de coacción de '+u.name,`<p class="sm">4 a 8 números, distinto del PIN normal. No uses 9999, 0000, 1234 ni repeticiones.</p><label>PIN de coacción<input type="password" inputmode="numeric" id="sd-p" maxlength="8" autocomplete="new-password"></label><label>Repetilo<input type="password" inputmode="numeric" id="sd-p2" maxlength="8" autocomplete="new-password"></label>`,
 {okText:'Guardar',onOk:w=>{const p=String(val('sd-p')||''),p2=String(val('sd-p2')||'');if(!/^\d{4,8}$/.test(p))return w._err('Tienen que ser 4 a 8 números.'),false;if(p!==p2)return w._err('No coinciden.'),false;
  if(p===u.pin)return w._err('Tiene que ser distinto del PIN normal.'),false;if(/^(\d)\1+$/.test(p)||['1234','4321','12345','123456','0123'].includes(p))return w._err('Es demasiado fácil de adivinar.'),false;
  if((S.users||[]).some(x=>x.pin===p))return w._err('No puede coincidir con el PIN de otro usuario.'),false;
  secS().duress[u.id]=duressHash(u.id,p);secEvent('CONFIG',{detail:'PIN de coacción configurado para '+u.name});setTimeout(rerender,0);}});});
act('secCsv',()=>{const L=visible();const q=v=>{let s=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const csv='﻿'+['fecha;nivel;evento;lugar;persona;detalle;caja;venta;usuario;real;recibido'].concat(L.map(e=>[fmtDT(e.ts),LV[e.lvl],TYPES[e.type]||e.type,e.door?doorName(e.door):e.cam,e.who,e.detail,e.caja,e.saleN,e.user,e.real?'sí':'simulación',e.ack?e.ackBy:''].map(q).join(';'))).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='eventos-seguridad.csv';a.click();audit('EXPORTAR','eventos de seguridad ('+L.length+')');});

/* ---------- botón de pánico en Vender (mantener 2 s) y avisos en todas las pantallas ---------- */
function decorate(){SAFE(()=>{secFloat();if(curScreen!=='seguridad'){cancelAnimationFrame(SEC.raf);SEC.raf=0;if(Object.keys(SEC.streams).length&&!$('#panel').hidden)camsStop();}
 if(curScreen!=='vender'||document.getElementById('sec-pan'))return;const fb=document.getElementById('fbar');if(!fb)return;
 const b=document.createElement('button');b.type='button';b.id='sec-pan';b.className='fk sec-pan';b.innerHTML='<b>Asistencia</b><small>mantener</small>';b.setAttribute('aria-label','Asistencia: mantener presionado 2 segundos');
 let t=0;const start=e=>{e.preventDefault();clearTimeout(t);t=setTimeout(()=>panic('botón Asistencia de Vender'),2000);};const stop=()=>clearTimeout(t);
 b.addEventListener('pointerdown',start);['pointerup','pointerleave','pointercancel'].forEach(k=>b.addEventListener(k,stop));b.addEventListener('contextmenu',e=>e.preventDefault());
 b.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat)start(e);});b.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' ')stop();});
 fb.appendChild(b);});}
const mo=new MutationObserver(()=>decorate());
SAFE(()=>{const v=document.getElementById('view');if(v)mo.observe(v,{childList:true});});
setInterval(()=>SAFE(()=>{if(user)secFloat();}),4000);

/* ---------- para el Centro Inteligente: M2ARGOTH (guardián) ve las alertas de seguridad ---------- */
window.secAlertsForCI=()=>SAFE(()=>{if(!canS('sec_view'))return[];const L=visible().filter(e=>!e.ack&&(e.lvl==='crit'||e.lvl==='alta')&&e.ts>now()-24*HOUR);if(!L.length)return[];
 return[{key:'sec:'+L.length+':'+L[L.length-1].id,pri:'critica',by:'m2argoth',orig:'Seguridad',ts:L[L.length-1].ts,tit:L.length+' alerta(s) de seguridad sin atender',ev:L.slice(-4).map(e=>E(TYPES[e.type]||e.type)+(e.real?'':' (simulación)')+' · '+E(fmtDT(e.ts))).join('; '),rec:'Revisar las cámaras y confirmar «Recibido» en Seguridad.',resp:'Supervisor',go:'seguridad'}];},[]);
window.secSummary=()=>SAFE(()=>{const L=visible();const t=now()-24*HOUR;return{open:L.filter(e=>!e.ack&&(e.lvl==='crit'||e.lvl==='alta')).length,ok:L.filter(e=>e.type==='ACCESO_OK'&&e.ts>t).length,no:L.filter(e=>e.type==='ACCESO_DENEGADO'&&e.ts>t).length};},{open:0,ok:0,no:0});


/* estilos del módulo (CSP permite estilos en línea) */
SAFE(()=>{if(document.getElementById('sec-css'))return;const st=document.createElement('style');st.id='sec-css';st.textContent=`
.sec-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sec-cam{margin:0;background:#0d0f13;border-radius:12px;overflow:hidden;border:1px solid #2a2e36}
.sec-cam canvas,.sec-cam video{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#000}.sec-cam figcaption{padding:8px;color:#e8ecf2;font-size:.82rem;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.sec-cam figcaption .btn{min-height:44px;color:#1d1a16;background:#fff}.sec-doors{display:grid;gap:8px}.sec-door{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center;margin:0}.sec-door .row{flex-wrap:wrap}
.sec-door .btn,.sec-head .btn{min-height:44px}.sec-ok{margin-top:10px;padding:14px;border-radius:12px;background:#1e7a46;color:#fff;font-weight:800;font-size:1.1rem}.sec-no{margin-top:10px;padding:14px;border-radius:12px;background:#a32020;color:#fff;font-weight:800;font-size:1.1rem}
.sec-rule{border:1px solid rgba(128,128,128,.35);border-radius:10px;padding:8px 10px;margin:8px 0;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
#sec-float{position:fixed;right:12px;bottom:12px;z-index:60;display:grid;gap:8px;max-width:min(360px,calc(100vw - 24px))}
.secf{background:#16181d;color:#fff;border-left:5px solid #e0a020;border-radius:10px;padding:10px 12px;box-shadow:0 6px 20px rgba(0,0,0,.35);display:grid;gap:4px;font-size:.85rem}.secf.crit{border-left-color:#ff3b3b}.secf .row{flex-wrap:wrap;gap:6px}.secf .btn{min-height:44px}
.fk.sec-pan{background:#3a3d44;color:#e8ecf2;border-color:#4a4e57}.fk.sec-pan small{color:#c9ced8}
.secf .btn{background:#2b2f37;color:#fff;border-color:#596070}.secf .btn.gold{background:#c9963e;color:#1d1a16;border-color:#c9963e}
@media(min-width:1101px){.fbar:has(#sec-pan){grid-template-columns:repeat(13,minmax(0,1fr))}}
@media(min-width:701px) and (max-width:1100px){.fbar:has(#sec-pan){grid-template-columns:repeat(7,minmax(0,1fr))}}
@media(max-width:640px){.sec-grid{grid-template-columns:1fr}}
`;document.head.appendChild(st);});

/* ---------- registro de la pantalla ---------- */
SAFE(()=>{IC.shield=IC.shield||'M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z';
 reg('seguridad','Seguridad','shield','sec_view',()=>SAFE(view,'<div class="card"><h2>Seguridad</h2><p>El módulo de seguridad tuvo un error. El resto del sistema sigue funcionando.</p></div>'),()=>after(),'Equipo');
 if(Array.isArray(NAV)&&!NAV.some(x=>x[0]==='seguridad')){const i=NAV.findIndex(x=>x[0]==='tareas');NAV.splice(i+1,0,['seguridad','Equipo']);}});
window.SECAPI={secS,credMake,credCheck,accessAttempt,panic,duressHash,secEvent,visible};
})();
