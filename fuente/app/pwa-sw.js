/* Sistema VB · service worker de la app instalable (V26.69) · versión __VER__
   Sólo maneja archivos del MISMO sitio (el sistema es un único HTML). Nunca toca la nube ni otros servicios:
   esas consultas van directo a la red (y el sistema ya trabaja sin conexión con sus datos locales).
   Página: primero la red (para tener siempre la última versión) y, sin señal, la copia guardada. */
const C='svb-app-__VER__';
const PRE=['./','./app.webmanifest','./club.webmanifest','./app-192.png','./app-512.png','./app-512m.png','./app-180.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(PRE)).catch(()=>{}).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('svb-app-')&&n!==C).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;let u;try{u=new URL(r.url);}catch(x){return;}if(u.origin!==location.origin)return;
 if(r.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('/index.html')){
  const net=fetch(r).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(C).then(c=>c.put('./',cp));}return res;});
  const off=()=>new Response('<!doctype html><meta charset=utf-8><title>Sin conexión</title><p style="font-family:sans-serif;padding:2rem">Sin conexión y sin copia guardada todavía. Abrí la app una vez con internet.</p>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
  e.respondWith(new Promise(ok=>{let done=false;const fin=x=>{if(!done){done=true;ok(x);}};
   net.then(fin).catch(()=>caches.match('./').then(m=>fin(m||off())));
   setTimeout(()=>caches.match('./').then(m=>{if(m)fin(m);}),7000);}));return;}
 e.respondWith(caches.match(r).then(m=>{const net=fetch(r).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp));}return res;}).catch(()=>m);return m||net;}));});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting();});
/* V26.73 · Notificaciones push de la app del Club: el texto llega cifrado para este celular; al mostrarla y al tocarla se avisa
   al comercio con el código al azar de ese envío (sin datos del cliente), y el toque abre la sección de la app indicada. */
const SB='__SBURL__',SBK='__SBKEY__';
const pushEv=(k,t)=>(!SB||!SBK||!/^[0-9a-f]{32}$/.test(k||''))?Promise.resolve():fetch(SB+'/rest/v1/rpc/push_evento',{method:'POST',headers:{apikey:SBK,authorization:'Bearer '+SBK,'content-type':'application/json'},body:JSON.stringify({p_tok:k,p_tipo:t})}).catch(()=>{});
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{};}catch(x){d={t:'Novedades',b:e.data?e.data.text():''};}
 const opt={body:String(d.b||'').slice(0,240),icon:'./app-192.png',badge:'./app-192.png',data:{u:String(d.u||'#mitarjeta'),k:String(d.k||'')},tag:d.c?String(d.c).slice(0,40):undefined};
 if(d.i&&/^https:\/\//.test(d.i))opt.image=String(d.i);
 e.waitUntil(Promise.all([self.registration.showNotification(String(d.t||'Novedades').slice(0,65),opt),pushEv(d.k,'entregado')]));});
self.addEventListener('notificationclick',e=>{e.notification.close();const d=e.notification.data||{};const base=self.registration.scope;
 const u=/^#[A-Za-z0-9/_=-]{1,60}$/.test(d.u||'')?base+d.u:(/^https:\/\//.test(d.u||'')?d.u:base+'#mitarjeta');
 e.waitUntil(Promise.all([pushEv(d.k,'abierto'),clients.matchAll({type:'window',includeUncontrolled:true}).then(L=>{for(const c of L){if(c.url.startsWith(base)&&'focus' in c){try{c.navigate(u);}catch(x){}return c.focus();}}return clients.openWindow(u);})]));});
