/* ===== V26.66 · NFC configurable: mostrador, Club, Vender y fichaje =====
   Dos formas de leer, elegidas POR EQUIPO (cada computadora o celular guarda la suya):
   · «Lector USB en modo teclado» (HID): el lector escribe el número de la tarjeta y un Enter, como un lector de códigos.
     Sirve en cualquier computadora con Windows, Mac o Linux y en el programa de escritorio. Es lo recomendado en el mostrador.
   · «Celular o tablet Android con NFC» (Chrome): Web NFC. Lee el número de serie de la tarjeta o el texto grabado (RAVE2N|… / VBHRN|…).
   Qué hace cada lectura lo decide el NEGOCIO (Configuración → Lector NFC, sólo el administrador): sumar sello del Club, identificar al
   cliente del ticket en Vender, fichar en el kiosco de Recursos Humanos y (opcional) fichar desde el mostrador.
   Las tarjetas se VINCULAN a un cliente o a un empleado por su número (UID): no hace falta grabarlas. El número viaja cifrado a la nube
   (campo «nfc» en los datos personales). Un código de barras nunca se toma por una tarjeta: sólo se actúa si el número está vinculado
   o si la pantalla está esperando una tarjeta. */
const NFC_DEV_KEY='rave.nfc.dev';
const NFC_MODES={hid:'Lector USB en modo teclado',android:'Celular o tablet Android con NFC',off:'Sin NFC en este equipo'};
const nfcWebOk=()=>typeof NDEFReader!=='undefined';
function nfcDev(){let d={};try{d=JSON.parse(localStorage.getItem(NFC_DEV_KEY)||'{}')||{};}catch(e){d={};}
 if(!NFC_MODES[d.mode])d.mode=nfcWebOk()&&/Android/i.test(navigator.userAgent||'')?'android':'hid';
 d.gap=(+d.gap>=10&&+d.gap<=200)?+d.gap:45;d.min=(+d.min>=4&&+d.min<=32)?+d.min:6;d.beep=d.beep!==false;return d;}
function nfcDevSave(d){try{localStorage.setItem(NFC_DEV_KEY,JSON.stringify({mode:d.mode,gap:d.gap,min:d.min,beep:d.beep}));}catch(e){}}
function nfcCfg(){const c=S.cfg.nfc=Object.assign({on:true,club:true,pos:true,hr:true,hrCounter:false},S.cfg.nfc||{});return c;}

/* ---------- números de tarjeta: normalizar y equivalencias (hex, hex invertido, decimal de 10 cifras) ---------- */
const nfcNorm=raw=>String(raw||'').trim().toUpperCase().replace(/[\s:\-]/g,'');
function nfcVariants(raw){const s=nfcNorm(raw);const out=new Set();if(!s||s.length>40)return out;out.add(s);
 if(/^[0-9A-F]+$/.test(s)&&s.length%2===0&&s.length>=8&&s.length<=20&&!/^\d{10}$/.test(s)){const b=s.match(/../g);out.add(b.slice().reverse().join(''));
  const f=b.slice(0,4);out.add(String(parseInt(f.join(''),16)).padStart(10,'0'));out.add(String(parseInt(f.slice().reverse().join(''),16)).padStart(10,'0'));}
 if(/^\d{8,10}$/.test(s)){const n=+s;if(n<=0xFFFFFFFF){const h=n.toString(16).toUpperCase().padStart(8,'0');out.add(h);out.add(h.match(/../g).reverse().join(''));out.add(String(n).padStart(10,'0'));}}
 return out;}
/* ¿parece el número de una tarjeta? (hex de 4, 7 o 10 bytes con alguna letra, o decimal de 10 cifras) */
const nfcLooksUid=s=>/^(?=[0-9A-F]*[A-F])([0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$/.test(s)||/^\d{10}$/.test(s);
function nfcIndex(){const m=new Map();
 (S.customers||[]).forEach(c=>{if(!c||c.status==='baja')return;(c.nfc||[]).forEach(u=>nfcVariants(u).forEach(v=>{if(!m.has(v))m.set(v,{k:'cust',id:c.id,u});}));});
 (S.employees||[]).forEach(e=>{if(!e||e.active===false)return;(e.nfc||[]).forEach(u=>nfcVariants(u).forEach(v=>{if(!m.has(v))m.set(v,{k:'emp',id:e.id,u});}));});return m;}
function nfcFind(raw){const idx=nfcIndex();for(const v of nfcVariants(raw)){const h=idx.get(v);if(h)return h;}return null;}
const nfcOwnerName=h=>h?(h.k==='emp'?((typeof hrEmp==='function'&&hrEmp(h.id))||{name:'empleado'}).name:custFull(custById(h.id)||{name:'cliente'})):'';
const nfcShow=u=>{const s=nfcNorm(u);return /^[0-9A-F]+$/.test(s)&&s.length%2===0&&/[A-F]/.test(s)?s.match(/../g).join(':'):s;};

/* ---------- sonido corto de confirmación (opcional por equipo) ---------- */
function nfcBeep(ok){if(!nfcDev().beep)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const a=nfcBeep.ctx||(nfcBeep.ctx=new C());const o=a.createOscillator(),g=a.createGain();
 o.frequency.value=ok?1320:330;g.gain.value=.06;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+(ok?.09:.25));}catch(e){}}

/* ---------- lector USB en modo teclado: escucha global (antes que el buscador y el lector de códigos) ---------- */
let nfcWait=null; // función que recibe la próxima tarjeta (vincular, probar, esperar en Fidelización o en el cobro)
const nfcK={buf:'',last:0,fast:0,el:null,val:null};
function nfcKReset(){nfcK.buf='';nfcK.fast=0;nfcK.el=null;nfcK.val=null;}
function nfcActive(){return !!nfcWait||(!!user&&!$('#panel').hidden)||!!document.getElementById('hr-kiosk');}
document.addEventListener('keydown',e=>{const d=nfcDev();if(d.mode!=='hid'||!nfcActive())return nfcKReset();
 if(e.ctrlKey||e.altKey||e.metaKey)return nfcKReset();const n=performance.now();
 if(e.key==='Enter'){const b=nfcK.buf,fast=nfcK.fast,el=nfcK.el,v=nfcK.val,lastGap=n-nfcK.last;nfcKReset();
  if(b.length>=d.min&&fast>=b.length-2&&lastGap<=Math.max(d.gap*3,150)&&nfcHandle(b,'hid')){e.preventDefault();e.stopImmediatePropagation();
   if(el&&v!==null&&el.isConnected){el.value=v;try{el.dispatchEvent(new Event('input',{bubbles:true}));}catch(er){}}}
  return;}
 if(e.key.length===1&&/[0-9A-Za-z]/.test(e.key)){if(!nfcK.buf||n-nfcK.last>d.gap){nfcK.buf='';nfcK.fast=0;const t=e.target;nfcK.el=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA')?t:null;nfcK.val=nfcK.el?nfcK.el.value:null;}else nfcK.fast++;
  nfcK.buf+=e.key;nfcK.last=n;}
 else if(e.key!=='Shift'&&e.key!=='CapsLock')nfcKReset();},true);

/* ---------- qué pasa al leer una tarjeta ---------- */
function nfcHandle(raw,src){const s=nfcNorm(raw);if(!s)return false;
 if(nfcWait){const f=nfcWait;return f(s,src)!==false;}
 const c=nfcCfg();if(!c.on)return false;
 /* texto grabado en la etiqueta (Android): tarjeta del Club o llavero de fichaje */
 if(/^RAVE2N\|/.test(String(raw))){const cu=custByCard(String(raw).split('|')[1]);return cu?nfcCust(cu,src):(nfcMsg('Esa tarjeta del Club no existe o fue dada de baja.',1),true);}
 if(/^VBHRN\|/.test(String(raw))){if(document.getElementById('hr-kiosk')&&typeof hrKCred==='function'){hrKCred(String(raw));return true;}toast('Llavero de fichaje: abrí la pantalla de fichaje de Recursos Humanos para fichar.',1);return true;}
 const hit=nfcFind(s);
 if(!hit){if(src==='android'||(nfcLooksUid(s)&&(curScreen==='fidel'||document.getElementById('hr-kiosk')))){nfcUnknown(s);return true;}return false;}
 if(hit.k==='emp')return nfcEmp(hrEmp(hit.id));
 return nfcCust(custById(hit.id),src);}
function nfcMsg(t,err){nfcBeep(!err);if(document.getElementById('hr-kiosk')&&typeof hrKMsg==='function')return hrKMsg(t,err);toast(t,err);}
function nfcCust(cu,src){const c=nfcCfg();if(!cu||cu.status==='baja'){nfcMsg('Esa tarjeta pertenece a un cliente dado de baja.',1);return true;}
 if(document.getElementById('hr-kiosk')){nfcMsg('Esa es una tarjeta de cliente, no un llavero de fichaje.',1);return true;}
 const ov=$('#modal-root .ov');const code='RAVE2N|'+cu.id;
 if(document.getElementById('cb-code')&&c.pos){cbSetStamp(code);nfcMsg('Cliente: '+custFull(cu)+' (por NFC)');return true;}
 if(ov)return false; /* con otra ventana abierta (por ejemplo, la ficha de un cliente) no se hace nada */
 if(curScreen==='vender'&&c.pos){pos.cust=cu.id;pos.stamp=code;pos.chanSet=null;if(typeof posCart==='function')posCart();nfcMsg('Cliente del ticket: '+custFull(cu)+(c.club?' · el sello se suma al cobrar':''));return true;}
 if(curScreen==='fidel'){const i=$('#fd-c');if(i){i.value=code;A.fdOk();nfcBeep(true);return true;}}
 if(!c.club){nfcMsg('Tarjeta de '+custFull(cu)+'. Sumar sellos con NFC está apagado (Configuración → Lector NFC).',1);return true;}
 nfcStamp(cu);return true;}
async function nfcStamp(cu){if(typeof stampPrep==='function')await stampPrep();const r=resolveStamp('RAVE2N|'+cu.id,'');
 if(!r.ok)return nfcMsg(custFull(cu)+': '+r.msg,1);commitStamp(cu.id,r,'mostrador');if(typeof pubRefresh==='function')pubRefresh();
 nfcMsg('⭐ Sello para '+r.custName+' (NFC): '+r.stamps+'/'+S.loyalty.goal+(r.reward?' · ¡premio disponible!':''));if(curScreen==='fidel'||curScreen==='inicio')setTimeout(rerender,300);}
function nfcEmp(e){const c=nfcCfg();if(!e){nfcMsg('Llavero de un empleado que ya no está activo.',1);return true;}
 if(!c.hr){nfcMsg('El fichaje con NFC está apagado (Configuración → Lector NFC).',1);return true;}
 const kiosk=!!document.getElementById('hr-kiosk');
 if(!kiosk&&(!c.hrCounter||$('#modal-root .ov'))){if($('#modal-root .ov'))return false;nfcMsg('Llavero de '+e.name+': para fichar abrí la pantalla de fichaje (Recursos Humanos).',1);return true;}
 if(typeof hrCfg==='function'&&!hrCfg().methods.nfc){nfcMsg('En Recursos Humanos el fichaje con NFC está apagado.',1);return true;}
 const p=hrPunch(e,'nfc');if(p.err){nfcMsg(p.err,1);return true;}
 nfcMsg(e.name+': '+(p.kind==='in'?'entrada':'salida')+' registrada '+hm(p.p.ts));if(!kiosk&&curScreen==='personal')rerender();return true;}

/* ---------- Android (Web NFC): lectura puntual y lectura continua ---------- */
function nfcFromEvent(ev){for(const rec of (ev.message&&ev.message.records)||[]){if(rec.recordType==='text'||rec.recordType==='mime'||rec.recordType==='unknown'){let t='';try{t=new TextDecoder(rec.encoding||'utf-8').decode(rec.data);}catch(e){}if(/^(RAVE2N|VBHRN)\|/.test(t))return t;}}
 return ev.serialNumber?nfcNorm(ev.serialNumber):'';}
let nfcLive=null;
A.nfcLiveToggle=async()=>{if(nfcLive){nfcLive.abort();nfcLive=null;toast('Lectura continua detenida');return nfcPaintAll();}
 if(!nfcWebOk())return toast('Este navegador no tiene NFC (hace falta Chrome en un celular Android con NFC).',1);
 try{const ac=new AbortController();const r=new NDEFReader();await r.scan({signal:ac.signal});nfcLive=ac;
  r.onreading=ev=>{const t=nfcFromEvent(ev);if(t)nfcHandle(t,'android');};r.onreadingerror=()=>toast('No se pudo leer la tarjeta: acercala de nuevo.',1);
  toast('Lectura NFC continua activa: acercá tarjetas o llaveros cuando quieras.');nfcPaintAll();}
 catch(e){toast('No se pudo activar el NFC: '+(e&&e.name==='NotAllowedError'?'permiso denegado.':'¿está encendido el NFC del celular?'),1);}};

/* ---------- esperar una tarjeta (para Fidelización, cobro, vincular y probar) ---------- */
/* cb(raw) recibe 'RAVE2N|id' de un cliente vinculado; opts.any=true entrega el número tal cual (vincular, probar) */
function nfcRead(cb,opts={}){const d=nfcDev();
 if(d.mode==='off')return modal('NFC apagado en este equipo','<p>Este equipo está configurado <b>sin NFC</b>. Si tenés un lector USB o un celular Android con NFC, elegilo en <b>Configuración → Lector NFC</b>.</p>',{okText:'Configurar NFC',onOk:()=>{setTimeout(A.nfcSetup,30);}});
 const title=opts.title||'Acercá la tarjeta NFC';let w=null,ac=null;
 const done=raw=>{if(w&&!w.isConnected)return true;nfcWait=null;if(ac)ac.abort();
  if(opts.any){if(w)w.remove();cb(raw);return true;}
  const s=String(raw);if(/^RAVE2N\|/.test(s)){if(w)w.remove();cb(s);return true;}
  const h=nfcFind(s);if(h&&h.k==='cust'){if(w)w.remove();nfcBeep(true);cb('RAVE2N|'+h.id);return true;}
  const m=w&&$('#nfr-m',w);nfcBeep(false);
  if(m)m.innerHTML=h?'Ese llavero es de <b>'+esc(nfcOwnerName(h))+'</b> (personal), no de un cliente.':'Tarjeta <code>'+esc(nfcShow(s))+'</code> <b>sin vincular</b>. '+(can('customers')?'<button class="btn sm" type="button" data-act="nfcUnknownLink" data-u="'+esc(s)+'">Vincularla a un cliente</button>':'Pedile al administrador que la vincule.');
  if(w)nfcWait=done;return true;};
 w=modal(title,`<div class="nfc-wait" aria-live="polite"><div class="nfc-ring" aria-hidden="true">${nfcIco(44)}</div><p>${d.mode==='hid'?'Acercá la tarjeta o el llavero al <b>lector NFC del mostrador</b>.':'Acercá la tarjeta a la <b>parte trasera del celular</b>.'}</p><p class="sm mut" id="nfr-m"></p></div>`,{okText:'Cancelar',noCancel:true,onOk:()=>{nfcWait=null;if(ac)ac.abort();}});
 const obs=new MutationObserver(()=>{if(!w.isConnected){nfcWait=null;if(ac)ac.abort();obs.disconnect();}});obs.observe($('#modal-root'),{childList:true});
 if(d.mode==='hid'){nfcWait=done;return w;}
 if(!nfcWebOk()){$('#nfr-m',w).textContent='Este navegador no tiene NFC. En una computadora usá un lector USB (Configuración → Lector NFC).';return w;}
 ac=new AbortController();const r=new NDEFReader();
 r.scan({signal:ac.signal}).then(()=>{r.onreading=ev=>{const t=nfcFromEvent(ev);if(t)done(t);};}).catch(e=>{const m=$('#nfr-m',w);if(m)m.textContent='No pudimos activar el NFC: '+(e&&e.name==='NotAllowedError'?'permiso denegado.':'¿está encendido el NFC del celular?');});
 return w;}
const nfcIco=(s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 8.3a5.5 5.5 0 0 1 0 7.4"/><path d="M9.4 5.8a9.5 9.5 0 0 1 0 12.4"/><path d="M12.8 3.3a13.4 13.4 0 0 1 0 17.4"/><circle cx="3.6" cy="12" r="1.1" fill="currentColor"/></svg>`;

/* ---------- vincular / desvincular ---------- */
function nfcOwner(k,id){return k==='emp'?hrEmp(id):custById(id);}
function nfcAttach(k,id,raw){const o=nfcOwner(k,id);if(!o)return;const s=nfcNorm(raw);
 if(!/^[0-9A-Z]{4,40}$/.test(s))return toast('Ese número de tarjeta no es válido.',1);
 const fin=()=>{const prev=nfcFind(s);if(prev){const po=nfcOwner(prev.k,prev.id);if(po)po.nfc=(po.nfc||[]).filter(u=>![...nfcVariants(u)].some(v=>nfcVariants(s).has(v)));}
  o.nfc=(o.nfc||[]).filter(u=>nfcNorm(u)!==s);o.nfc.push(s);if(o.nfc.length>5)o.nfc=o.nfc.slice(-5);
  audit('NFC_VINCULAR',(k==='emp'?'empleado ':'cliente ')+(k==='emp'?o.name:custFull(o))+' · tarjeta …'+s.slice(-4));save();nfcBeep(true);toast('Tarjeta vinculada a '+(k==='emp'?o.name:custFull(o)));
  if(typeof rerender==='function'&&!$('#modal-root .ov'))rerender();nfcPaintAll();};
 const prev=nfcFind(s);
 if(prev&&prev.k===k&&prev.id===id)return toast('Esa tarjeta ya estaba vinculada a esta persona.');
 if(prev)return confirmBox('Tarjeta ya vinculada','Esta tarjeta hoy es de <b>'+esc(nfcOwnerName(prev))+'</b>. ¿La pasamos a <b>'+esc(k==='emp'?o.name:custFull(o))+'</b>?',fin,'Pasar tarjeta');
 fin();}
A.nfcLink=el=>{const k=el.dataset.k==='emp'?'emp':'cust',id=el.dataset.id;const o=nfcOwner(k,id);if(!o)return;
 if(k==='cust'&&!can('customers'))return toast('Sin permiso',1);if(k==='emp'&&!can('staff'))return toast('Sin permiso',1);
 const nm=k==='emp'?o.name:custFull(o);
 const w=nfcRead(raw=>nfcAttach(k,id,raw),{any:true,title:'Vincular tarjeta NFC · '+nm});
 if(w&&w.querySelector){const b=w.querySelector('.nfc-wait');if(b)b.insertAdjacentHTML('beforeend',`<details class="sm" style="margin-top:.6rem"><summary>¿No tenés lector a mano? Escribí el número impreso en la tarjeta</summary><div class="row" style="margin-top:.4rem"><input id="nfl-man" autocomplete="off" placeholder="Ej.: 04:A2:3B:1C:55:80 o 0012345678" aria-label="Número de la tarjeta"><button class="btn sm" type="button" data-act="nfcManual" data-k="${k}" data-id="${esc(id)}">Vincular</button></div></details>`);}};
A.nfcManual=el=>{const v=val('nfl-man');if(!nfcNorm(v))return toast('Escribí el número de la tarjeta.',1);nfcWait=null;const ov=el.closest('.ov');if(ov)ov.remove();nfcAttach(el.dataset.k,el.dataset.id,v);};
A.nfcUnlink=el=>{const k=el.dataset.k==='emp'?'emp':'cust',o=nfcOwner(k,el.dataset.id);if(!o)return;const u=el.dataset.u;
 if(k==='cust'&&!can('customers'))return toast('Sin permiso',1);if(k==='emp'&&!can('staff'))return toast('Sin permiso',1);
 confirmBox('Desvincular tarjeta','La tarjeta <code>'+esc(nfcShow(u))+'</code> deja de identificar a <b>'+esc(k==='emp'?o.name:custFull(o))+'</b>.',()=>{o.nfc=(o.nfc||[]).filter(x=>x!==u);audit('NFC_DESVINCULAR',(k==='emp'?o.name:custFull(o))+' · …'+String(u).slice(-4));save();toast('Tarjeta desvinculada');nfcPaintAll();if(!$('#modal-root .ov'))rerender();},'Desvincular');};
/* tarjeta desconocida: proponer a quién vincularla */
function nfcUnknown(s){nfcBeep(false);
 if(document.getElementById('hr-kiosk'))return hrKMsg('Llavero sin registrar. Pedile al administrador que lo vincule en tu ficha (Recursos Humanos).',1);
 if(!can('customers'))return toast('Tarjeta NFC sin vincular. Pedile al administrador que la vincule a un cliente.',1);
 A.nfcUnknownLink({dataset:{u:s}});}
A.nfcUnknownLink=el=>{const s=nfcNorm(el.dataset.u);if(!s)return;const ov=el.closest&&el.closest('.ov');if(ov){nfcWait=null;ov.remove();}
 const w=modal('Tarjeta NFC sin vincular',`<p>Se leyó la tarjeta <code>${esc(nfcShow(s))}</code>. ¿De qué cliente es?</p><label for="nfu-q">Buscar cliente (nombre, DNI, WhatsApp o N.º de socio)</label><input id="nfu-q" autocomplete="off"><div id="nfu-r" class="nfu-r" role="listbox" aria-label="Clientes"></div>${can('staff')&&(S.employees||[]).length?`<details class="sm"><summary>Es el llavero de alguien del personal</summary><div class="nfu-r">${S.employees.filter(e=>e.active!==false).map(e=>`<button type="button" class="btn sm" data-act="nfuPick" data-k="emp" data-id="${esc(e.id)}" data-u="${esc(s)}">${esc(e.name)}</button>`).join('')}</div></details>`:''}`,{okText:'Cerrar',noCancel:true});
 const q=$('#nfu-q',w),r=$('#nfu-r',w);const paint=()=>{const t=uxNormTxt(q.value);const L=(S.customers||[]).filter(c=>c.status!=='baja').filter(c=>!t||uxNormTxt([custFull(c),c.dni,c.wa,pad4(c.num||0)].join(' ')).includes(t)).slice(0,8);
  r.innerHTML=L.map(c=>`<button type="button" class="btn sm" data-act="nfuPick" data-k="cust" data-id="${esc(c.id)}" data-u="${esc(s)}">${esc(custFull(c))}${c.num?' · socio '+pad4(c.num):''}</button>`).join('')||'<p class="sm mut">Sin resultados.</p>';};
 q.addEventListener('input',paint);paint();setTimeout(()=>q.focus(),40);};
A.nfuPick=el=>{const ov=el.closest('.ov');if(ov)ov.remove();nfcAttach(el.dataset.k,el.dataset.id,el.dataset.u);};
const uxNormTxt=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

/* bloque para la ficha del cliente y del empleado */
function nfcFieldHTML(k,o){if(!o||!o.id)return'';const L=o.nfc||[];const ok=k==='emp'?can('staff'):can('customers');
 return `<div class="nfc-field" data-nfcf="${k}|${esc(o.id)}"><label>${nfcIco(16)} Tarjeta o llavero NFC</label>${L.length?L.map(u=>`<span class="tag ok nfc-tag"><code>…${esc(nfcShow(u).slice(-8))}</code>${ok?`<button type="button" class="nfc-x" data-act="nfcUnlink" data-k="${k}" data-id="${esc(o.id)}" data-u="${esc(u)}" aria-label="Desvincular tarjeta terminada en ${esc(String(u).slice(-4))}">×</button>`:''}</span>`).join(' '):'<span class="sm mut">Sin tarjeta vinculada.</span>'}
 ${ok?`<div class="row" style="margin-top:.35rem"><button class="btn sm" type="button" data-act="nfcLink" data-k="${k}" data-id="${esc(o.id)}">${L.length?'Vincular otra':'Vincular tarjeta'}</button>${k==='cust'&&nfcWebOk()&&typeof cardIdOk==='function'&&cardIdOk(o.id)?`<button class="btn sm ghost" type="button" data-act="cuNfc" data-id="${esc(o.id)}">Grabar etiqueta (Android)</button>`:''}</div>`:''}</div>`;}

/* ---------- configuración (ventana) ---------- */
function nfcStatusHTML(){const d=nfcDev(),c=nfcCfg();const nc=(S.customers||[]).filter(x=>x.status!=='baja'&&(x.nfc||[]).length).length,ne=(S.employees||[]).filter(x=>x.active!==false&&(x.nfc||[]).length).length;
 const st=d.mode==='off'?'<span class="tag">Apagado en este equipo</span>':(!c.on?'<span class="tag warn">Apagado para el negocio</span>':d.mode==='android'&&!nfcWebOk()?'<span class="tag warn">Este navegador no tiene NFC</span>':'<span class="tag ok">Listo</span>');
 return `<p class="nfc-st">${st} <b>${esc(NFC_MODES[d.mode])}</b>${d.mode==='android'&&nfcLive?' · <span class="tag ok">lectura continua</span>':''}</p>
 <p class="sm mut">Al acercar una tarjeta: ${[c.club?'suma el sello del Club':'',c.pos?'en Vender identifica al cliente del ticket':'',c.hr?'en la pantalla de fichaje ficha al personal':'',c.hrCounter?'en el mostrador también ficha':''].filter(Boolean).join(' · ')||'no hace nada (todo apagado)'}.</p>
 <p class="sm">${nc} cliente(s) y ${ne} persona(s) del personal con tarjeta vinculada.</p>`;}
function nfcCfgCard(){if(!user)return'';return `<div class="card" id="nfc-card" style="margin-top:1rem"><h3>${nfcIco(18)} Lector NFC del mostrador</h3>
 <p class="sm mut">Tarjetas y llaveros NFC para sumar sellos, identificar al cliente en el cobro y fichar al personal. Se elige el lector de <b>cada equipo</b> y qué hace el NFC en el negocio.</p>
 <div id="nfc-stbox">${nfcStatusHTML()}</div>
 <div class="row" style="flex-wrap:wrap"><button class="btn gold" data-act="nfcSetup">Configurar NFC</button><button class="btn" data-act="nfcTest">Probar lector</button><button class="btn" data-act="nfcList">Tarjetas vinculadas</button>${nfcDev().mode==='android'&&nfcWebOk()?`<button class="btn" data-act="nfcLiveToggle">${nfcLive?'Detener lectura continua':'Lectura continua'}</button>`:''}</div></div>`;}
function nfcPaintAll(){document.querySelectorAll('[data-nfcf]').forEach(el=>{const [k,id]=el.dataset.nfcf.split('|');const o=nfcOwner(k,id);if(o)el.outerHTML=nfcFieldHTML(k,o);});document.querySelectorAll('#nfc-stbox').forEach(b=>{b.innerHTML=nfcStatusHTML();});const fb=$('#fd-nfcst');if(fb)fb.innerHTML=nfcMiniHTML();}
function nfcMiniHTML(){const d=nfcDev();return `${nfcIco(14)} NFC: <b>${esc(d.mode==='off'?'apagado en este equipo':d.mode==='hid'?'lector USB':'Android')}</b>${d.mode==='hid'&&nfcCfg().on&&nfcCfg().club?' · acercá la tarjeta en cualquier momento':''} · <a href="#" data-act="nfcSetup">Configurar</a>`;}
A.nfcSetup=()=>{const d=nfcDev(),c=nfcCfg();const adm=isAdm()||can('config');const dis=adm?'':'disabled';
 const mo=k=>`<label class="chk nfc-mode ${d.mode===k?'on':''}"><input type="radio" name="nfc-mode" value="${k}" ${d.mode===k?'checked':''}> <span><b>${esc(NFC_MODES[k])}</b><br><span class="sm mut">${{hid:'Para la computadora del mostrador. El lector escribe el número de la tarjeta y un Enter (como un lector de códigos). Funciona en Windows, Mac, Linux y en el programa de escritorio. Si el lector trae software, dejalo en modo «teclado / HID» con Enter al final.',android:'Para un celular o tablet con NFC y Chrome. Lee tarjetas vírgenes por su número o las grabadas desde el sistema. '+(nfcWebOk()?'<b>Este navegador sí tiene NFC.</b>':'<b>Este navegador no tiene NFC.</b>'),off:'Este equipo no lee tarjetas (sigue sirviendo el QR y el DNI).'}[k]}</span></span></label>`;
 modal('Configurar NFC',`<h4 style="margin-top:0">1 · Este equipo</h4><p class="sm mut">Se guarda sólo en este navegador: cada computadora o celular elige su lector.</p><div class="grid g2 nfc-modes">${mo('hid')}${mo('android')}${mo('off')}</div>
 <h4>2 · Qué hace el NFC en el negocio ${adm?'':'<span class="tag">sólo el administrador</span>'}</h4>
 <label class="chk"><input type="checkbox" id="nfc-on" ${c.on?'checked':''} ${dis}> <b>Usar tarjetas y llaveros NFC</b></label>
 <div class="nfc-uses"><label class="chk"><input type="checkbox" id="nfc-club" ${c.club?'checked':''} ${dis}> Sumar el sello del Club al acercar la tarjeta (en cualquier pantalla del mostrador; un sello cada 24 h)</label>
 <label class="chk"><input type="checkbox" id="nfc-pos" ${c.pos?'checked':''} ${dis}> En Vender y en el cobro: identificar al cliente del ticket (el sello se suma al cobrar)</label>
 <label class="chk"><input type="checkbox" id="nfc-hr" ${c.hr?'checked':''} ${dis}> Fichaje del personal con llavero en la pantalla de fichaje (Recursos Humanos)</label>
 <label class="chk"><input type="checkbox" id="nfc-hrc" ${c.hrCounter?'checked':''} ${dis}> También fichar acercando el llavero en el mostrador, sin abrir la pantalla de fichaje</label></div>
 <details class="sm"><summary>3 · Ajustes del lector USB (avanzado)</summary><div class="grid g2"><div><label for="nfc-gap">Tiempo máximo entre caracteres (ms)</label><input id="nfc-gap" inputmode="numeric" value="${d.gap}"></div><div><label for="nfc-min">Largo mínimo del número</label><input id="nfc-min" inputmode="numeric" value="${d.min}"></div></div>
 <label class="chk"><input type="checkbox" id="nfc-beep" ${d.beep?'checked':''}> Sonido corto al leer</label><p class="sm mut">Si el lector es lento y no reconoce las tarjetas, subí el tiempo (por ejemplo, 80). Probalo con «Probar lector».</p></details>
 <p class="sm mut">Lectores tipo ACR122U sin modo teclado necesitan un programa intermediario (todavía no incluido). Los lectores USB de 13,56 MHz «plug and play» que escriben el número funcionan sin instalar nada.</p>`,
 {wide:true,okText:'Guardar',onOk:w=>{const m=(w.querySelector('input[name=nfc-mode]:checked')||{}).value||d.mode;const gap=parseInt(val('nfc-gap'),10),min=parseInt(val('nfc-min'),10);
  if(!(gap>=10&&gap<=200))return w._err('El tiempo entre caracteres va de 10 a 200 ms.'),false;if(!(min>=4&&min<=32))return w._err('El largo mínimo va de 4 a 32.'),false;
  const nd={mode:m,gap,min,beep:$('#nfc-beep',w).checked};const chg=JSON.stringify(nd)!==JSON.stringify({mode:d.mode,gap:d.gap,min:d.min,beep:d.beep});nfcDevSave(nd);if(chg)audit('NFC_EQUIPO',NFC_MODES[m]+' · '+gap+' ms · mín. '+min);
  if(adm){const nc={on:$('#nfc-on',w).checked,club:$('#nfc-club',w).checked,pos:$('#nfc-pos',w).checked,hr:$('#nfc-hr',w).checked,hrCounter:$('#nfc-hrc',w).checked};
   if(JSON.stringify(nc)!==JSON.stringify({on:c.on,club:c.club,pos:c.pos,hr:c.hr,hrCounter:c.hrCounter})){S.cfg.nfc=Object.assign({},S.cfg.nfc||{},nc);audit('NFC_NEGOCIO',JSON.stringify(nc));save();}}
  if(m!=='android'&&nfcLive){nfcLive.abort();nfcLive=null;}toast('NFC guardado');setTimeout(()=>{rerender();nfcPaintAll();},30);}});
 const mw=$$('#modal-root .ov');const w=mw[mw.length-1];w.querySelectorAll('input[name=nfc-mode]').forEach(r=>r.addEventListener('change',()=>w.querySelectorAll('.nfc-mode').forEach(l=>l.classList.toggle('on',l.querySelector('input').checked))));};
A.nfcTest=()=>{const d=nfcDev();if(d.mode==='off')return nfcRead(()=>{});const t0={n:0};
 const w=modal('Probar lector NFC',`<div class="nfc-wait"><div class="nfc-ring" aria-hidden="true">${nfcIco(44)}</div><p>${d.mode==='hid'?'Acercá una tarjeta al <b>lector USB</b>.':'Acercá una tarjeta a la <b>parte trasera del celular</b>.'} Podés probar varias.</p><div id="nft-r" class="sm" aria-live="polite"></div></div>`,{okText:'Terminar',noCancel:true,onOk:()=>{nfcWait=null;if(ac)ac.abort();}});
 let ac=null;const show=(s,src)=>{if(!w.isConnected){nfcWait=null;return true;}t0.n++;const h=nfcFind(s);const vs=[...nfcVariants(s)];
  $('#nft-r',w).insertAdjacentHTML('afterbegin',`<div class="nfc-res ${h?'ok':''}"><b>Lectura ${t0.n}</b> · <code>${esc(nfcShow(s))}</code> · ${/^RAVE2N\||^VBHRN\|/.test(s)?'etiqueta grabada por el sistema':(/^\d{10}$/.test(s)?'número decimal (10 cifras)':'número hexadecimal ('+(s.length/2)+' bytes)')}<br>${h?'✔ Vinculada a <b>'+esc(nfcOwnerName(h))+'</b>':'Sin vincular'} · por ${src==='hid'?'lector USB':'Android'}${vs.length>1?'<br><span class="mut">Equivalencias reconocidas: '+esc(vs.slice(1,4).join(' · '))+'</span>':''}</div>`);nfcBeep(true);return true;};
 const obs=new MutationObserver(()=>{if(!w.isConnected){nfcWait=null;if(ac)ac.abort();obs.disconnect();}});obs.observe($('#modal-root'),{childList:true});
 if(d.mode==='hid'){nfcWait=show;return;}
 if(!nfcWebOk()){$('#nft-r',w).textContent='Este navegador no tiene NFC.';return;}
 ac=new AbortController();const r=new NDEFReader();r.scan({signal:ac.signal}).then(()=>{r.onreading=ev=>{const t=nfcFromEvent(ev);if(t)show(t,'android');};}).catch(()=>{$('#nft-r',w).textContent='No se pudo activar el NFC del celular.';});};
A.nfcList=()=>{const C=(S.customers||[]).filter(x=>x.status!=='baja'&&(x.nfc||[]).length),E=(S.employees||[]).filter(x=>x.active!==false&&(x.nfc||[]).length);
 const row=(k,o,n)=>(o.nfc||[]).map(u=>`<tr><td>${esc(n)}</td><td>${k==='emp'?'Personal':'Cliente'}</td><td><code>${esc(nfcShow(u))}</code></td><td class="r"><button class="btn sm" data-act="nfcUnlink" data-k="${k}" data-id="${esc(o.id)}" data-u="${esc(u)}">Desvincular</button></td></tr>`).join('');
 modal('Tarjetas NFC vinculadas',(C.length||E.length)?`<div class="tw"><table data-nosort><thead><tr><th>Persona</th><th>Tipo</th><th>Tarjeta</th><th></th></tr></thead><tbody>${C.map(c=>row('cust',c,custFull(c))).join('')}${E.map(e=>row('emp',e,e.name)).join('')}</tbody></table></div>`:'<p>Todavía no hay tarjetas vinculadas. Vinculalas desde la ficha del cliente (Clientes) o del empleado (Recursos Humanos), o acercá una tarjeta nueva en <b>Fidelización</b>.</p>',{wide:true,okText:'Cerrar',noCancel:true});};
