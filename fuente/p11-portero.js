/* ===== V26.68 · Seguridad y portero: SeguridadRave (portero + seguridad integral) dentro del sistema =====
   El portero/seguridad del local (raveholding.github.io/SeguridadRave + servidor Sistemas VB en el local) avisa a los dueños por
   ntfy (relevo gratuito, sin abrir puertos): «tema de avisos» (timbre con foto y botones, alarmas, pánico/coacción, movimiento,
   horario) y, opcional, «tema del timbre por QR» (el cliente toca el timbre desde SU celular). Este módulo escucha esos temas:
   · suena y muestra el aviso en CUALQUIER pantalla del sistema (aunque haya una ventana abierta), con la foto de la cámara o del
     visitante cuando el portero la manda;
   · se responde desde el aviso: Ya voy · Un momento · Dejar en la puerta · No atendemos. La respuesta viaja al portero por el
     canal de control (el portero la muestra y la dice) y llega al celular de la visita. Si otro ya respondió, el aviso lo muestra;
   · «Abrir panel de seguridad» abre SeguridadRave. La puerta NO se abre desde acá (sigue siendo con PIN, pase, NFC o el panel);
   · pánico y coacción son SILENCIOSOS: por defecto sólo los ve quien tiene el permiso «security_alarm», sin sonido;
   · con la pestaña en segundo plano, notificación del equipo (si se habilitó en ese equipo);
   · todo queda en la auditoría (sin los temas, que funcionan como contraseña: viajan cifrados con la llave del comercio).
   Protocolo (compatible con el servidor y con el panel sin servidor de SeguridadRave):
     tema de avisos P: {title,message,priority,tags,actions:[{body:'{"type":"reply","id","code"}'}],attachment}
     control P-c: {type:'reply',id,code}            · timbre QR Q: {type:'ring',id,name,msg}   · respuestas Q-r: {type:'reply',id,code,text} */
const PT_DEF_URL='https://raveholding.github.io/SeguridadRave/',PT_SRV='https://ntfy.sh',PT_TOK=/^[\w-]{10,64}$/;
const PT_RESP={voy:'Ya voy',momento:'Un momento',deje:'Dejar en la puerta',cerrado:'No atendemos'};
const PT_RESP_VIS={voy:'Ya voy, aguarde un momento 🙂',momento:'Estamos atendiendo, enseguida lo atendemos.',deje:'Por favor deje el pedido en la puerta. ¡Gracias!',cerrado:'Ahora no podemos atender. Disculpe las molestias.'};
function ptCfg(){const c=S.cfg.portero||(S.cfg.portero={});const d={on:false,url:PT_DEF_URL,panico:'admin',sec:null,plain:null};for(const k in d)if(c[k]===undefined)c[k]=d[k];c.ev=Object.assign({timbre:true,alarma:true,aviso:false},c.ev||{});return c;}
function ptDev(){let d={};try{d=JSON.parse(localStorage.getItem('rave.pt.dev')||'{}')||{};}catch(e){}return{on:d.on!==false,son:d.son!==false,notif:!!d.notif};}
function ptDevSave(d){try{localStorage.setItem('rave.pt.dev',JSON.stringify(d));}catch(e){}}
const ptCloud=()=>typeof CLOUD!=='undefined'&&CLOUD.on;
let ptKeys=null; /* {p,q} en memoria, nunca en pantalla ni en la auditoría */
let ptKeysFor='';
async function ptLoadKeys(){const c=ptCfg();ptKeysFor=JSON.stringify(c.sec||c.plain||null);if(ptCloud()){if(!c.sec||!cl.dek){ptKeys=null;return null;}try{ptKeys=await openJ(c.sec,cl.dek,'portero|'+cl.comercio.id);}catch(e){ptKeys=null;}}else ptKeys=c.plain||null;return ptKeys;}
async function ptSaveKeys(k){const c=ptCfg();if(ptCloud()){c.sec=await sealJ(k,cl.dek,'portero|'+cl.comercio.id);c.plain=null;}else{c.plain=k;c.sec=null;}ptKeys=k;ptKeysFor=JSON.stringify(c.sec||c.plain);}
const ptMask=t=>t?t.slice(0,4)+'…'+t.slice(-3):'—';

/* ---------- sonido ---------- */
let ptAC=null;function ptAc(){if(!ptAC){try{ptAC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){ptAC=null;}}if(ptAC&&ptAC.state==='suspended')try{ptAC.resume();}catch(e){}return ptAC;}
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>{if(ptCfg().on)ptAc();},{passive:true}));
function ptTone(notas,vol){const c=ptAc();if(!c)return;const t0=c.currentTime+.02;notas.forEach(n=>{const o=c.createOscillator(),g=c.createGain();o.type=n[3]||'sine';o.frequency.value=n[0];g.gain.setValueAtTime(.0001,t0+n[1]);g.gain.exponentialRampToValueAtTime(vol||.28,t0+n[1]+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+n[1]+n[2]);o.connect(g).connect(c.destination);o.start(t0+n[1]);o.stop(t0+n[1]+n[2]+.05);});}
function ptRingSound(a){if(a.urg)ptTone([[988,0,.22,'square'],[740,.25,.22,'square'],[988,.5,.22,'square'],[740,.75,.22,'square']],.22);else ptTone([[659,0,.9],[523,.45,1.2]],.3);try{if(navigator.vibrate)navigator.vibrate(a.urg?[300,120,300]:[200,100,200]);}catch(e){}}

/* ---------- conexión ---------- */
const PT={es:null,key:'',st:'apagado',seen:{},al:[],photo:null,tErr:0,last:0};
function ptCanSee(){return !!user&&!$('#panel').hidden&&can('security');}
function ptTopics(){const k=ptKeys||{};const t=[];if(PT_TOK.test(k.p||''))t.push(k.p,k.p+'-c');if(PT_TOK.test(k.q||''))t.push(k.q,k.q+'-r');return t;}
async function ptConnect(){const c=ptCfg();if(!user){ptKeys=null;ptKeysFor='';}else if(c.on&&(!ptKeys||ptKeysFor!==JSON.stringify(c.sec||c.plain||null)))await ptLoadKeys();const want=c.on&&ptDev().on&&ptCanSee()&&!!window.EventSource&&ptTopics().length>0;const key=want?ptTopics().join(','):'';
 if(key===PT.key)return;PT.key=key;if(PT.es){PT.es.close();PT.es=null;}
 if(!want){PT.st=c.on?(ptTopics().length?'apagado en este equipo':'falta el tema'):'apagado';return ptPaintState();}
 PT.st='conectando';ptPaintState();const es=PT.es=new EventSource(PT_SRV+'/'+ptTopics().map(encodeURIComponent).join(',')+'/sse?since=60s');
 es.onopen=()=>{clearTimeout(PT.tErr);PT.tErr=0;PT.st='conectado';ptPaintState();};
 es.onerror=()=>{if(PT.es!==es||PT.tErr)return;PT.tErr=setTimeout(()=>{PT.tErr=0;if(PT.es===es&&es.readyState!==1){PT.st='reconectando';ptPaintState();}},6000);};
 es.onmessage=ev=>{try{ptRecv(JSON.parse(ev.data));}catch(e){}};}
setInterval(()=>{ptConnect();},4000);
function ptBody(m){try{const p=JSON.parse(m.message);return p&&typeof p==='object'?p:null;}catch(e){return null;}}
function ptRecv(m){if(!m||(m.event&&m.event!=='message')||!m.id||PT.seen[m.id])return;PT.seen[m.id]=1;PT.last=Date.now();
 if(m.time&&Date.now()/1000-m.time>120)return; /* lo viejo no vuelve a sonar */
 const k=ptKeys||{},c=ptCfg(),p=ptBody(m);
 if(m.topic===k.p+'-c'||m.topic===k.q+'-r'){if(p&&p.type==='reply'&&p.id)ptAnswered(String(p.id).slice(0,40),p.code,p.text);return;}
 if(m.topic===k.q){if(p&&p.type==='ring'&&c.ev.timbre)ptNew({id:String(p.id||m.id).slice(0,40),via:'qr',tit:'Tocan el timbre',txt:(p.name?String(p.name).slice(0,40)+' está':'Hay alguien')+' en la puerta (tocó desde su celular)'+(p.msg?' · '+String(p.msg).slice(0,80):'')+'.',resp:true});return;}
 if(m.topic!==k.p)return;
 if(m.attachment&&/^https:\/\/[\w.-]+\/file\//.test(m.attachment.url||'')&&/^image\//.test(m.attachment.type||'image/')){PT.photo={url:m.attachment.url,ts:Date.now()};const a=PT.al[0];if(a&&!a.photo&&Date.now()-a.ts<20000){a.photo=PT.photo.url;ptPaint();}if(!m.message||/^You received a file/i.test(m.message))return;}
 const tit=String(m.title||'').slice(0,120),txt=String(m.message||'').slice(0,300);let rid='';
 (m.actions||[]).some(a=>{try{const b=JSON.parse(a.body||'{}');if(b.type==='reply'&&b.id){rid=String(b.id).slice(0,40);return true;}}catch(e){}return false;});
 if(/^🔔/.test(tit)||rid){if(c.ev.timbre)ptNew({id:rid||m.id,via:'puerta',tit:'Tocan el timbre',txt:txt||tit.replace(/^🔔\s*/,''),resp:!!rid,photo:PT.photo&&Date.now()-PT.photo.ts<20000?PT.photo.url:''});return;}
 if(/^✅/.test(tit)){toast('Portero: '+tit.replace(/^✅\s*/,'')+' — el aviso llegó al sistema.');return;}
 const panic=(m.priority||3)>=5&&/COACCI|P[ÁA]NICO|SOS|911/i.test(tit+' '+txt);
 if(panic){if(c.panico==='nunca')return;if(c.panico==='admin'&&!can('security_alarm'))return;ptNew({id:m.id,via:'panico',tit:tit.replace(/^\W+\s*/,'')||'Alerta silenciosa',txt,urg:true,silent:c.panico==='admin'});return;}
 const urg=(m.priority||3)>=4||/^(🚨|⚠️|🚫|👥|📍|🏘)/.test(tit);
 if(urg?c.ev.alarma:c.ev.aviso)ptNew({id:m.id,via:urg?'alarma':'aviso',tit:tit.replace(/^\W+\s*/,'')||'Aviso de seguridad',txt,urg,photo:PT.photo&&Date.now()-PT.photo.ts<20000?PT.photo.url:''});}

/* ---------- avisos en pantalla ---------- */
function ptNew(a){if(PT.al.some(x=>x.id===a.id)){const x=PT.al.find(y=>y.id===a.id);if(a.photo&&!x.photo){x.photo=a.photo;ptPaint();}return;}
 a.ts=Date.now();a.st='sonando';PT.al.unshift(a);if(PT.al.length>5)PT.al.length=5;
 if(ptDev().son&&!a.silent){ptRingSound(a);a.rep=1;a.timer=setInterval(()=>{if(a.st!=='sonando'||a.rep>=(a.urg?10:6)){clearInterval(a.timer);return;}a.rep++;ptRingSound(a);},a.urg?2500:4000);}
 a.fin=setTimeout(()=>ptDrop(a.id),a.urg?15*60000:4*60000);
 audit(a.via==='panico'?'PORTERO_PANICO':a.via==='alarma'?'PORTERO_ALARMA':a.via==='aviso'?'PORTERO_AVISO':'PORTERO_TIMBRE',a.tit+(a.txt?' · '+a.txt.slice(0,120):'')+(a.via==='qr'?' (por QR)':''));
 ptNotify(a);ptPaint();if(curScreen==='seguridad')setTimeout(rerender,50);}
function ptDrop(id){PT.al=PT.al.filter(a=>{if(a.id===id){clearInterval(a.timer);clearTimeout(a.fin);return false;}return true;});ptPaint();}
function ptAnswered(id,code,text,by){const a=PT.al.find(x=>x.id===id);if(!a)return;if(a.st==='resp')return;a.st='resp';a.resTxt=PT_RESP[code]||text||'Respondido';a.resBy=by||a.resBy||'otra persona o el portero';clearInterval(a.timer);clearTimeout(a.fin);a.fin=setTimeout(()=>ptDrop(id),25000);ptPaint();}
function ptPaint(){let b=$('#pt-stack');if(!PT.al.length||!ptCanSee()){if(b)b.remove();return;}
 if(!b){b=document.createElement('div');b.id='pt-stack';b.setAttribute('aria-live','assertive');document.body.appendChild(b);}
 const url=ptCfg().url||PT_DEF_URL;
 b.innerHTML=PT.al.map(a=>`<section class="pt-al ${a.urg?'urg':''} ${a.silent?'silent':''} ${a.st==='resp'?'resp':''}" role="alertdialog" aria-labelledby="pt-t-${esc(a.id)}">
 <div class="pt-h"><span class="pt-ic" aria-hidden="true">${a.via==='panico'?'🚨':a.urg?'⚠️':a.via==='aviso'?'🛡️':'🔔'}</span><b id="pt-t-${esc(a.id)}">${esc(a.tit)}</b><small>${hm(a.ts)}${a.via==='qr'?' · por QR':''}</small><button type="button" class="pt-x" data-act="ptClose" data-id="${esc(a.id)}" aria-label="Cerrar el aviso">×</button></div>
 ${a.photo?`<img class="pt-ph" src="${esc(a.photo)}" alt="Foto de la cámara del portero" referrerpolicy="no-referrer">`:''}
 ${a.txt?`<p>${esc(a.txt)}</p>`:''}${a.silent?'<p class="sm"><b>Alerta silenciosa:</b> no la comentes en voz alta. Llamá al 911 si corresponde.</p>':''}
 ${a.st==='resp'?`<p class="pt-ok">✓ Respondió ${esc(a.resBy)}: <b>${esc(a.resTxt)}</b></p>`:a.st==='enviando'?'<p class="sm mut">Enviando respuesta…</p>':''}
 <div class="pt-b">${a.resp&&a.st!=='resp'&&a.st!=='enviando'?Object.keys(PT_RESP).map(k=>`<button type="button" class="btn sm ${k==='voy'?'gold':''}" data-act="ptReply" data-id="${esc(a.id)}" data-c="${k}">${PT_RESP[k]}</button>`).join(''):''}
 <a class="btn sm" href="${esc(url)}" target="svb_seguridad" rel="noopener" data-act="ptOpen" data-id="${esc(a.id)}">Abrir panel de seguridad ↗</a>${a.st==='sonando'&&ptDev().son&&!a.silent?`<button type="button" class="btn sm ghost" data-act="ptMute" data-id="${esc(a.id)}">Silenciar</button>`:''}</div></section>`).join('');}
function ptNotify(a){if(!document.hidden||!ptDev().notif||typeof Notification==='undefined'||Notification.permission!=='granted'||a.silent)return;
 try{const n=new Notification((a.via==='qr'||a.via==='puerta'?'🔔 ':a.urg?'⚠️ ':'')+a.tit,{body:a.txt||'',tag:'pt-'+a.id,requireInteraction:true,icon:a.photo||undefined});n.onclick=()=>{try{window.focus();}catch(e){}n.close();};}catch(e){}}
async function ptPub(topic,obj){try{const r=await fetch(PT_SRV+'/'+encodeURIComponent(topic),{method:'POST',body:JSON.stringify(obj)});return r.ok;}catch(e){return false;}}
async function ptReply(id,code){const a=PT.al.find(x=>x.id===id),k=ptKeys||{};if(!a||!PT_RESP[code])return false;if(!can('security'))return toast('Sin permiso para responder el timbre',1),false;
 a.st='enviando';clearInterval(a.timer);ptPaint();
 const ok=await ptPub(k.p+'-c',{type:'reply',id,code}); /* el portero la recibe, la muestra/dice y se la manda al celular de la visita */
 if(a.via==='qr'&&PT_TOK.test(k.q||''))setTimeout(()=>{if(a.st==='resp'&&a.resBy!==(user&&user.name))return;ptPub(k.q+'-r',{type:'reply',id,code,text:PT_RESP_VIS[code]});},5000); /* respaldo: llega a la visita aunque el portero esté apagado */
 if(ok){ptAnswered(id,code,'',user?user.name:'vos');audit('PORTERO_RESPUESTA',PT_RESP[code]+' · '+a.tit);save();}else{a.st='sonando';ptPaint();toast('No se pudo responder: revisá la conexión a internet.',1);}return ok;}
A.ptReply=el=>ptReply(el.dataset.id,el.dataset.c);
A.ptClose=el=>ptDrop(el.dataset.id);
A.ptMute=el=>{const a=PT.al.find(x=>x.id===el.dataset.id);if(a){a.st='silencio';clearInterval(a.timer);ptPaint();}};
A.ptOpen=el=>{const a=PT.al.find(x=>x.id===el.dataset.id);if(a&&a.st==='sonando'){a.st='silencio';clearInterval(a.timer);ptPaint();}};

/* ---------- estado ---------- */
function ptStateHTML(){const c=ptCfg();const s=PT.st;const cls=s==='conectado'?'ok':s==='conectando'||s==='reconectando'?'warn':'';
 return `<span class="tag ${cls}">${esc(!c.on?'Apagado':s==='conectado'?'Conectado al portero':s==='conectando'?'Conectando…':s==='reconectando'?'Reconectando…':s==='falta el tema'?'Falta configurar':'Apagado en este equipo')}</span>`;}
function ptPaintState(){document.querySelectorAll('[data-ptstate]').forEach(e=>{e.innerHTML=ptStateHTML();});}

/* ---------- pantalla «Seguridad y portero» ---------- */
function ptHist(){return (S.audit||[]).filter(e=>/^PORTERO_/.test(e.action||e.a||'')).slice(-60).reverse();}
const PT_EVN={PORTERO_TIMBRE:'🔔 Timbre',PORTERO_RESPUESTA:'↩️ Respuesta',PORTERO_ALARMA:'⚠️ Alarma',PORTERO_AVISO:'🛡️ Aviso',PORTERO_PANICO:'🚨 Alerta silenciosa',PORTERO_CONFIG:'⚙️ Configuración',PORTERO_PRUEBA:'✅ Prueba'};
reg('seguridad','Seguridad y portero','shield','security',()=>{const c=ptCfg(),d=ptDev(),adm=can('config');const url=c.url||PT_DEF_URL;
 const H=ptHist().filter(e=>(e.action||e.a)!=='PORTERO_PANICO'||can('security_alarm'));
 return `<h1>Seguridad y portero</h1><p class="mut">Portero digital y seguridad integral del local (<b>SeguridadRave</b>): cámaras, cerradura, timbre con foto, pases QR/NFC, alarmas y pánico. Acá llegan los timbres y las alertas, y se responde a la visita sin dejar lo que estás haciendo.</p>
 <div class="row pt-top"><span data-ptstate>${ptStateHTML()}</span><a class="btn gold" href="${esc(url)}" target="svb_seguridad" rel="noopener">Abrir panel de seguridad ↗</a>${c.on&&ptKeys?'<button class="btn" data-act="ptTest">Probar aviso</button>':''}${!ptCloud()?'<button class="btn" data-act="ptSim">Simular timbre (demo)</button>':''}</div>
 <div class="grid g2" style="margin-top:1rem">
 <div class="card"><h3>Timbres y alertas recientes</h3>${H.length?`<div class="tw"><table data-nosort><thead><tr><th>Fecha</th><th>Evento</th><th>Detalle</th><th>Usuario</th></tr></thead><tbody>${H.slice(0,30).map(e=>`<tr><td class="nowrap">${esc(fmtDT(e.ts||e.t))}</td><td>${esc(PT_EVN[e.action||e.a]||e.action)}</td><td>${esc(String(e.detail||e.d||'').slice(0,140))}</td><td>${esc(e.user||e.u||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="sm mut">Todavía no llegó ningún timbre ni alerta.</p>'}</div>
 <div class="card"><h3>Este equipo</h3><p class="sm mut">Se elige en cada computadora o celular.</p>
  <label class="chk"><input type="checkbox" id="ptd-on" ${d.on?'checked':''}> Recibir timbres y alertas en este equipo</label>
  <label class="chk"><input type="checkbox" id="ptd-son" ${d.son?'checked':''}> Sonar (din-don y alarma)</label>
  <label class="chk"><input type="checkbox" id="ptd-not" ${d.notif?'checked':''}> Notificación del equipo cuando el sistema está en segundo plano</label>
  <div class="row"><button class="btn" data-act="ptDevSave">Guardar en este equipo</button></div>
  <h4>Cómo responder</h4><ul class="sm"><li>El aviso aparece arriba a la derecha en cualquier pantalla, con la foto si el portero la manda.</li><li><b>Ya voy · Un momento · Dejar en la puerta · No atendemos</b>: el portero lo dice y la visita lo ve en su celular.</li><li>La puerta <b>no</b> se abre desde acá: se abre con PIN, pase, NFC o desde el panel de seguridad.</li></ul></div></div>
 ${adm?ptCfgCardHtml():''}`;},()=>{ptPaintState();});
function ptCfgCardHtml(){const c=ptCfg(),k=ptKeys||{};const roles=Object.keys(S.roles||{}).filter(r=>r!=='admin'&&r!=='empleado');
 return `<div class="card" id="pt-card" style="margin-top:1rem"><h3>Portero y seguridad (SeguridadRave)</h3>
 <p class="sm mut">Conecta el sistema con el portero del local. Los temas son las «contraseñas» de los canales de aviso: se guardan <b>cifrados</b> y no se muestran completos.</p>
 <label class="chk"><input type="checkbox" id="pt-on" ${c.on?'checked':''}> <b>Recibir el portero y las alertas de seguridad en el sistema</b></label>
 <div class="grid g2"><div><label for="pt-p">Tema de avisos a los dueños (obligatorio)</label><input id="pt-p" autocomplete="off" spellcheck="false" placeholder="${k.p?'Guardado: '+esc(ptMask(k.p))+' (dejá vacío para no cambiarlo)':'Ej.: svb-own-1a2b3c…'}"><p class="sm mut">En SeguridadRave: ⚙ Admin → Configuración → <b>Avisos a los dueños</b> → Notificación push → tema.</p></div>
 <div><label for="pt-q">Tema del timbre por QR (opcional)</label><input id="pt-q" autocomplete="off" spellcheck="false" placeholder="${k.q?'Guardado: '+esc(ptMask(k.q))+' (dejá vacío para no cambiarlo)':'Lo que va después de #t= en el enlace del cartel'}"><p class="sm mut">En SeguridadRave: <b>Portero y avisos al celular</b> → enlace del cartel. Sirve para que el timbre por QR llegue aunque el portero esté apagado.</p></div></div>
 <label for="pt-url">Dirección del panel de seguridad</label><input id="pt-url" value="${esc(c.url||PT_DEF_URL)}">
 <h4>Qué se muestra</h4><label class="chk"><input type="checkbox" id="pt-et" ${c.ev.timbre?'checked':''}> Timbre (en la puerta y por QR)</label><label class="chk"><input type="checkbox" id="pt-ea" ${c.ev.alarma?'checked':''}> Alarmas (intrusión, intentos de PIN, aforo, patentes, geocercas)</label><label class="chk"><input type="checkbox" id="pt-ei" ${c.ev.aviso?'checked':''}> Avisos informativos (horario, movimiento, armado)</label>
 <label for="pt-pan">Pánico y coacción (alertas silenciosas)</label><select id="pt-pan"><option value="admin" ${c.panico==='admin'?'selected':''}>Sólo a quien tiene «Alertas silenciosas de seguridad», sin sonido (recomendado)</option><option value="todos" ${c.panico==='todos'?'selected':''}>A todos los que atienden el timbre</option><option value="nunca" ${c.panico==='nunca'?'selected':''}>No mostrarlas en el sistema (sólo en el celular de los dueños)</option></select>
 <h4>Quién atiende el timbre</h4><p class="sm mut">Permiso «Seguridad y portero». El administrador lo tiene siempre.</p><div class="row">${roles.map(r=>`<label class="chk"><input type="checkbox" class="pt-role" value="${esc(r)}" ${(S.roles[r]||[]).includes('security')?'checked':''}> ${esc(r)}</label>`).join('')}</div>
 <div class="row"><button class="btn gold" data-act="ptCfgSave">Guardar</button>${k.p||k.q?'<button class="btn ghost" data-act="ptForget">Borrar los temas</button>':''}</div></div>`;}
A.ptDevSave=()=>{const d={on:$('#ptd-on').checked,son:$('#ptd-son').checked,notif:$('#ptd-not').checked};
 const fin=()=>{ptDevSave(d);PT.key='~';ptConnect();toast('Guardado en este equipo');rerender();};
 if(d.notif&&typeof Notification!=='undefined'&&Notification.permission!=='granted'){Notification.requestPermission().then(p=>{if(p!=='granted'){d.notif=false;toast('El navegador no permitió las notificaciones.',1);}fin();}).catch(fin);}else fin();};
A.ptCfgSave=async()=>{if(!can('config'))return toast('Sólo el administrador',1);if(ptCloud()&&!cl.dek)return toast('Entrá con la nube para guardar los temas cifrados.',1);
 const c=ptCfg(),k=Object.assign({},ptKeys||{});const vp=val('pt-p').trim(),vq=val('pt-q').trim().replace(/^.*#t=/,'');
 if(vp){if(!PT_TOK.test(vp))return toast('El tema de avisos tiene 10 a 64 letras, números, «-» o «_».',1);k.p=vp;}
 if(vq){if(!PT_TOK.test(vq))return toast('El tema del timbre tiene 10 a 64 letras, números, «-» o «_».',1);k.q=vq;}
 const on=$('#pt-on').checked;if(on&&!k.p)return toast('Cargá el tema de avisos a los dueños.',1);
 const url=val('pt-url').trim()||PT_DEF_URL;if(!/^https:\/\/[\w.-]+(:\d+)?\//.test(url)&&!/^http:\/\/(localhost|127\.0\.0\.1|[\w-]+(\.local|\.ts\.net)?)(:\d+)?\//.test(url))return toast('La dirección del panel no es válida.',1);
 if(vp||vq)await ptSaveKeys(k);
 c.on=on;c.url=url;c.ev={timbre:$('#pt-et').checked,alarma:$('#pt-ea').checked,aviso:$('#pt-ei').checked};c.panico=val('pt-pan');
 const sel=new Set([...document.querySelectorAll('.pt-role:checked')].map(x=>x.value));
 Object.keys(S.roles||{}).forEach(r=>{if(r==='admin'||r==='empleado')return;const L=S.roles[r];const has=L.includes('security');if(sel.has(r)&&!has)L.push('security');if(!sel.has(r)&&has)S.roles[r]=L.filter(p=>p!=='security');});
 audit('PORTERO_CONFIG',(on?'activado':'apagado')+' · timbre '+(c.ev.timbre?'sí':'no')+' · alarmas '+(c.ev.alarma?'sí':'no')+' · pánico: '+c.panico+' · atienden: '+([...sel].join(', ')||'sólo admin')+(vp||vq?' · temas actualizados':''));
 save();PT.key='~';ptConnect();toast('Portero guardado');rerender();};
A.ptForget=()=>confirmBox('Borrar los temas','El sistema deja de recibir el portero hasta que los vuelvas a cargar.',async()=>{const c=ptCfg();c.sec=null;c.plain=null;c.on=false;ptKeys=null;audit('PORTERO_CONFIG','temas borrados');save();PT.key='~';ptConnect();rerender();},'Borrar');
A.ptTest=async()=>{const k=ptKeys||{};if(!k.p)return; const r=await fetch(PT_SRV,{method:'POST',body:JSON.stringify({topic:k.p,title:'✅ Prueba desde el sistema',message:'Si ves esto en el celular de los dueños, el canal funciona.',priority:2,tags:['white_check_mark']})}).then(x=>x.ok).catch(()=>false);
 audit('PORTERO_PRUEBA',r?'enviada':'falló');toast(r?'Aviso de prueba enviado: tiene que aparecer acá y en el celular de los dueños.':'No se pudo enviar la prueba: revisá internet.',!r);};
A.ptSim=()=>{const id='sim'+Date.now().toString(36);ptNew({id,via:'qr',tit:'Tocan el timbre',txt:'Juan (delivery) está en la puerta (tocó desde su celular) · Pedido de bebidas.',resp:true,sim:true});};
/* en la demo (sin nube) responder la simulación no publica nada */
const ptReplyReal=ptReply;ptReply=async function(id,code){const a=PT.al.find(x=>x.id===id);if(a&&a.sim){ptAnswered(id,code,'',user?user.name:'vos');audit('PORTERO_RESPUESTA',PT_RESP[code]+' · simulación');save();return true;}return ptReplyReal(id,code);};
/* tarjeta también en Configuración → Equipo y seguridad */
function ptCfgCardForConfig(){return can('config')?ptCfgCardHtml():'';}
/* al salir: se apagan sonido, avisos, conexión y los temas en memoria */
function ptClearAll(){PT.al.forEach(a=>{clearInterval(a.timer);clearTimeout(a.fin);});PT.al=[];ptPaint();ptKeys=null;ptKeysFor='';PT.key='~';if(PT.es){PT.es.close();PT.es=null;}}
{const _lo=A.logout;A.logout=(...x)=>{ptClearAll();return _lo(...x);};}
window.addEventListener('hashchange',()=>{if(!ptCanSee()&&PT.al.length)ptClearAll();});
