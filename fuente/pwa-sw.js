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
