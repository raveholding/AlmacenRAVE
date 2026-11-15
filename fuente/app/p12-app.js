/* ===== V26.69 · App instalable (PWA): sistema y Club del cliente =====
   · «Instalar app» en el acceso, en la barra del panel y en Configuración: en Android / Chrome / Edge abre el instalador del
     navegador; en iPhone / iPad muestra los 3 pasos (Compartir → Agregar a inicio); dentro de Instagram / WhatsApp / Facebook
     explica que hay que abrirlo en el navegador. Ya instalada, el botón no aparece.
   · Dos apps del mismo sitio: «Sistema» (equipo: dueño, cajeros, repartidor) y «Club» (cliente, abre en #mitarjeta). Al abrir
     la tarjeta del Club se cambia el manifiesto para que lo que se instale sea la app del cliente.
   · Service worker (sw.js, junto al index.html): sólo guarda el propio sistema para abrir sin señal; nunca la nube. */
const APP={ev:null,std:false,reg:null};
APP.std=(()=>{try{return matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: minimal-ui)').matches||navigator.standalone===true;}catch(e){return false;}})();
const appIOS=()=>/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const appInApp=()=>/Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\/|TikTok|; wv\)/i.test(navigator.userAgent);
const appWeb=()=>/^https:$/.test(location.protocol)||/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();APP.ev=e;appPaint();});
window.addEventListener('appinstalled',()=>{APP.ev=null;APP.std=true;try{audit('APP_INSTALADA',appKind()==='club'?'app del Club':'app del sistema');save();}catch(e){}appPaint();toast('App instalada: la encontrás en el inicio del equipo.');});
if(appWeb()&&'serviceWorker' in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').then(r=>{APP.reg=r;}).catch(()=>{});});
const appKind=()=>/^#(mitarjeta|tarjeta|sello=)/.test(location.hash||'')||(location.search||'').includes('app=club')?'club':'sistema';
function appManifest(){const m=$('#pwa-man');if(!m)return;const h=appKind()==='club'?'club.webmanifest':'app.webmanifest';if(m.getAttribute('href')!==h)m.setAttribute('href',h);}
window.addEventListener('hashchange',appManifest);appManifest();
if(appWeb()&&appIOS()&&!document.querySelector('link[rel=apple-touch-icon]')){const l=document.createElement('link');l.rel='apple-touch-icon';l.href='app-180.png';document.head.appendChild(l);} /* ícono del iPhone (sólo publicado) */
const appCan=()=>!APP.std&&(!!APP.ev||appIOS()||appInApp()||appWeb());
function appBtn(cls){return appCan()?`<button type="button" class="btn sm ${cls||''} app-inst" data-act="appInstall" title="Instalar la app en este equipo">📲 <span>Instalar app</span></button>`:'';}
function appPaint(){document.querySelectorAll('.app-inst').forEach(b=>{b.hidden=!appCan();});const c=$('#app-card');if(c)c.outerHTML=appCardHtml();}
async function appInstall(kind){kind=kind||appKind();
 if(APP.ev){const e=APP.ev;APP.ev=null;try{await e.prompt();const r=await e.userChoice;if(r&&r.outcome==='accepted')return true;}catch(x){}appPaint();return false;}
 const name=kind==='club'?'la app del Club':'la app del sistema';
 if(appInApp())return modal('Instalar '+name,`<p>Estás dentro de otra aplicación (Instagram, WhatsApp, Facebook…), que no deja instalar apps.</p><ol><li>Tocá los <b>tres puntos</b> o el botón de compartir arriba.</li><li>Elegí <b>«Abrir en el navegador»</b> (Chrome o Safari).</li><li>Ahí tocá de nuevo <b>Instalar app</b>.</li></ol>`,{okText:'Entendido',noCancel:true});
 if(appIOS())return modal('Instalar '+name+' en iPhone / iPad',`<ol class="app-steps"><li>Abrí esta página en <b>Safari</b>.</li><li>Tocá <b>Compartir</b> <span aria-hidden="true">⬆️</span> (abajo en el iPhone, arriba en el iPad).</li><li>Elegí <b>«Agregar a inicio»</b> y tocá <b>Agregar</b>.</li></ol><p class="sm mut">Queda con su ícono, se abre a pantalla completa y funciona aunque no haya señal.</p>`,{okText:'Listo',noCancel:true});
 if(!appWeb())return modal('Instalar '+name,'<p>La app se instala desde la dirección publicada del sistema (https). Abrí el enlace del sistema en Chrome, Edge o Safari y tocá <b>Instalar app</b>.</p>',{okText:'Entendido',noCancel:true});
 return modal('Instalar '+name,`<p>Tu navegador todavía no ofreció la instalación. Probá así:</p><ul><li><b>Chrome / Edge en computadora:</b> el ícono <b>⊕ Instalar</b> a la derecha de la barra de direcciones, o menú ⋮ → <b>Instalar…</b></li><li><b>Chrome en Android:</b> menú ⋮ → <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.</li><li><b>Samsung Internet:</b> menú → <b>Agregar página a</b> → <b>Pantalla de inicio</b>.</li></ul>`,{okText:'Entendido',noCancel:true});}
A.appInstall=()=>appInstall();
window.RAVE_APP={can:()=>appCan(),installed:()=>APP.std,install:()=>appInstall('club')}; /* lo usa la app del Club (documento del menú) */
function appCardHtml(){const url=(window.RAVE_BUILD&&RAVE_BUILD.publicUrl)||'';
 return `<div class="card" id="app-card" style="margin-top:1rem"><h3>Apps para instalar (equipo y clientes)</h3><p class="sm mut">Se instalan desde el navegador, sin tiendas ni costos. Abren a pantalla completa, con ícono propio, y siguen funcionando sin señal.</p>
 <div class="grid g2"><div><h4>📊 App del sistema</h4><p class="sm">Para el equipo: dueño, cajeros, supervisores y <b>repartidores</b> (al entrar con el rol Repartidor abre directo su hoja de ruta).</p>${APP.std?'<span class="tag ok">Ya instalada en este equipo</span>':appCan()?appBtn('gold'):'<span class="tag">Se instala desde el enlace publicado</span>'}</div>
 <div><h4>⭐ App del Club (clientes)</h4><p class="sm">Tarjeta de sellos, nivel, crédito, cupones, membresías, seguimiento de pedidos y botones para hablar con el local. El cliente la instala desde su tarjeta.</p>${url?`<div class="row"><button class="btn sm" data-act="appClubCopy">Copiar enlace de la app del Club</button><button class="btn sm" data-act="appClubQr">QR para el mostrador</button></div>`:''}</div></div></div>`;}
A.appClubCopy=()=>{const u=((window.RAVE_BUILD&&RAVE_BUILD.publicUrl)||'')+'#mitarjeta';try{navigator.clipboard.writeText(u);toast('Enlace copiado: '+u);}catch(e){toast(u);}};
A.appClubQr=()=>{const u=((window.RAVE_BUILD&&RAVE_BUILD.publicUrl)||'')+'#mitarjeta';modal('App del Club',`<div style="text-align:center"><div class="app-qr">${QR.svg(u,6,2)}</div><p><b>Escaneá y sumá tu tarjeta del Club al inicio del celular</b></p><p class="sm mut">${esc(u)}</p></div>`,{okText:'Cerrar',noCancel:true});};
