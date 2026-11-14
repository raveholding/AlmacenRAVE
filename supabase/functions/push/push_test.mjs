// node --experimental-strip-types push_test.mjs · pruebas de la función «push» (cifrado RFC 8291 de ida y vuelta, VAPID y trabajador simulado)
import { cifrar, vapid, nuevasLlaves, b64u, deb64u } from './webpush.ts';
import { manejar } from './handler.ts';
let ok=0,bad=0;const chk=(c,m)=>{console.log((c?'OK   ':'FALLA ')+m);c?ok++:bad++;};
const te=new TextEncoder(),td=new TextDecoder();
const cat=(...a)=>{const o=new Uint8Array(a.reduce((n,x)=>n+x.length,0));let i=0;for(const x of a){o.set(x,i);i+=x.length;}return o;};
const hkdf=async(s,ikm,info,n)=>new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:s,info},await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']),n*8));
/* el navegador: sus llaves y el descifrado según RFC 8291 (implementación independiente del lado receptor) */
const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);const uaPub=new Uint8Array(await crypto.subtle.exportKey('raw',ua.publicKey));const authS=crypto.getRandomValues(new Uint8Array(16));
async function descifrarCon(body,priv,pubR,au){const salt=body.slice(0,16),idl=body[20],as=body.slice(21,21+idl),ct=body.slice(21+idl);const asK=await crypto.subtle.importKey('raw',as,{name:'ECDH',namedCurve:'P-256'},false,[]);const sh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:asK},priv,256));const ikm=await hkdf(au,sh,cat(te.encode('WebPush: info\0'),pubR,as),32);const cek=await hkdf(salt,ikm,te.encode('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(salt,ikm,te.encode('Content-Encoding: nonce\0'),12);const pt=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']),ct));return td.decode(pt.slice(0,pt.lastIndexOf(2)));}
async function descifrar(body){const salt=body.slice(0,16),rs=new DataView(body.buffer,body.byteOffset+16,4).getUint32(0),idl=body[20],as=body.slice(21,21+idl),ct=body.slice(21+idl);
 const asK=await crypto.subtle.importKey('raw',as,{name:'ECDH',namedCurve:'P-256'},false,[]);const sh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:asK},ua.privateKey,256));
 const ikm=await hkdf(authS,sh,cat(te.encode('WebPush: info\0'),uaPub,as),32);const cek=await hkdf(salt,ikm,te.encode('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(salt,ikm,te.encode('Content-Encoding: nonce\0'),12);
 const pt=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']),ct));return{rs,idl,txt:td.decode(pt.slice(0,pt.lastIndexOf(2)))};}

/* vector oficial del RFC 8291 (apéndice A): el descifrador de las pruebas es correcto */
{const uP=deb64u('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4');const uK=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',d:'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',x:b64u(uP.slice(1,33)),y:b64u(uP.slice(33))},{name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
 const bd=deb64u('DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
 const t=await descifrarCon(bd,uK,uP,deb64u('BTBZMqHH6r4Tts7J_aSIgg'));chk(t==='When I grow up, I want to be a watermelon','vector oficial del RFC 8291 descifrado correctamente');}
const msg='{"t":"Promo","b":"2x1 hoy 🍕","k":"abc"}';
const body=await cifrar(te.encode(msg),b64u(uaPub),b64u(authS));
const d=await descifrar(body);
chk(d.txt===msg,'cifrado aes128gcm: el navegador lo descifra igual (RFC 8291 de ida y vuelta)');
chk(d.rs===4096&&d.idl===65,'encabezado: tamaño de registro 4096 y llave efímera de 65 bytes');
const body2=await cifrar(te.encode(msg),b64u(uaPub),b64u(authS));chk(b64u(body)!==b64u(body2),'cada envío usa sal y llave efímera nuevas');
let thr=false;try{await cifrar(te.encode(msg),'corto',b64u(authS));}catch(e){thr=true;}chk(thr,'llaves de suscripción inválidas se rechazan');
/* VAPID */
const K=await nuevasLlaves();chk(deb64u(K.pub).length===65&&!!K.priv.d,'llaves VAPID P-256 (pública de 65 bytes)');
const hdr=await vapid('https://fcm.googleapis.com/fcm/send/xyz',K.pub,K.priv,'mailto:x@y.com',Date.now());
const m=/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(hdr);chk(!!m&&m[4]===K.pub,'cabecera «vapid t=…, k=…»');
const cl=JSON.parse(td.decode(deb64u(m[2])));chk(cl.aud==='https://fcm.googleapis.com'&&cl.sub==='mailto:x@y.com'&&cl.exp>Date.now()/1000,'JWT: audiencia = origen del servicio, vence en 12 h');
const pk=await crypto.subtle.importKey('raw',deb64u(K.pub),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
chk(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pk,deb64u(m[3]),te.encode(m[1]+'.'+m[2])),'firma ES256 verificable con la llave pública');
/* trabajador con servicios simulados */
const C='11111111-1111-1111-1111-111111111111';const env={SUPABASE_URL:'https://x.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'srv',ALLOWED_ORIGINS:'https://raveholding.github.io'};
const row=(id,ep,pr)=>({id,comercio_id:C,tok:'t'+id,endpoint:ep,p256dh:b64u(uaPub),auth:b64u(authS),titulo:'Hola',cuerpo:'Promo',imagen_url:null,accion_url:'#mitarjeta/ben',prioridad:pr,ttl:3600,campana_id:'camp1'});
let tomas=0;const res=[],posted=[];let stored=null;const users={adm:{id:'a1',rol:'admin'},mos:{id:'m1',rol:'mostrador'}};
const fake=async(url,o={})=>{const h=o.headers||{};const R=(b,s=200)=>new Response(JSON.stringify(b),{status:s});
 if(url.endsWith('/rpc/push_tomar')){tomas++;return R(tomas===1?[row(1,'https://fcm.googleapis.com/fcm/send/aaaaaaaaaa','alta'),row(2,'https://web.push.apple.com/bbbbbbbbbb','normal'),row(3,'https://updates.push.services.mozilla.com/wpush/v2/cccccccccc','normal'),row(4,'https://evil.example.com/xxxxxxxxxxxx','normal')]:[]);}
 if(url.endsWith('/rpc/push_resultado')){res.push(JSON.parse(o.body));return new Response('',{status:204});}
 if(url.includes('/rest/v1/push_vapid')&&(!o.method||o.method==='GET'))return R(stored?[stored]:[]);
 if(url.includes('/rest/v1/push_vapid')&&o.method==='POST'){stored=JSON.parse(o.body);return new Response(null,{status:201});}
 if(url.endsWith('/auth/v1/user')){const w=String(h.authorization||'').split(' ')[1];return users[w]?R(users[w]):R({},401);}
 if(url.includes('/rest/v1/miembros')){const id=/usuario_id=eq\.([^&]+)/.exec(url)[1];const u=Object.values(users).find(x=>x.id===id);return R(u&&url.includes(C)?[{rol:u.rol}]:[]);}
 if(/^https:\/\/(fcm|web\.push|updates\.push)/.test(url)){posted.push({url,h,body:o.body});return new Response('',{status:url.includes('fcm')?201:url.includes('apple')?410:503});}
 if(url.includes('evil'))posted.push({url,h,evil:1});
 return R({},404);};
const call=async(who,b)=>{const r=await manejar(new Request('https://f/push',{method:'POST',headers:who?{authorization:'Bearer '+who,'content-type':'application/json'}:{'content-type':'application/json'},body:JSON.stringify(b)}),env,fake);return{st:r.status,j:await r.json()};};
let r=await call(null,{accion:'llave',comercio:C});chk(r.st===401,'«llave» sin sesión: 401');
r=await call('mos',{accion:'llave',comercio:C});chk(r.st===403,'«llave» con un mostrador: 403');
r=await call('adm',{accion:'llave',comercio:C});chk(r.st===200&&r.j.pub&&stored&&stored.pub===r.j.pub&&stored.priv.d,'el administrador obtiene la llave pública (la privada queda en la base)');
const pub1=r.j.pub;r=await call('adm',{accion:'llave',comercio:C});chk(r.j.pub===pub1,'pedirla de nuevo devuelve la misma (no rota en silencio)');
r=await call(null,{accion:'procesar'});
chk(r.st===200&&r.j.enviados===1&&r.j.errores===3,'procesar: 1 enviado, 3 con error/reintento %s'.replace('%s',JSON.stringify(r.j)));
const est=Object.fromEntries(res.map(x=>[x.p_id,x.p_estado]));
chk(est[1]==='enviado'&&est[2]==='invalido'&&est[3]==='reintentar'&&est[4]==='error','201 → enviado · 410 → suscripción inválida (se borra) · 503 → reintentar · host ajeno → error');
chk(!posted.some(p=>p.evil),'nunca se llama a un host que no es un servicio de push');
const p1=posted.find(p=>p.url.includes('fcm'));chk(p1&&p1.h['content-encoding']==='aes128gcm'&&p1.h.urgency==='high'&&p1.h.ttl==='3600'&&/^vapid t=/.test(p1.h.authorization),'cabeceras: aes128gcm, Urgency alta, TTL y VAPID');
const dd=await descifrar(new Uint8Array(p1.body));const pl=JSON.parse(dd.txt);chk(pl.t==='Hola'&&pl.u==='#mitarjeta/ben'&&pl.k==='t1','el celular recibe título, enlace y su código de seguimiento');
r=await call(null,{accion:'otra'});chk(r.st===401,'otras acciones exigen sesión');
console.log(ok+' OK / '+bad+' FALLAN de '+(ok+bad));process.exit(bad?1:0);
