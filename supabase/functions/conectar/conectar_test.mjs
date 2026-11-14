// node --experimental-strip-types conectar_test.mjs · pruebas de la función «conectar» (OAuth Gmail / Outlook / Meta) con servicios simulados
import { manejar, sinHtml, sinCita, mime } from './handler.ts';
import { descifrar } from './cripto.ts';
import { manejar as canales } from '../canales/handler.ts';
let ok=0,bad=0;const chk=(c,m)=>{console.log((c?'OK   ':'FALLA ')+m);c?ok++:bad++;};
const C='33333333-3333-3333-3333-333333333333',OTRO='44444444-4444-4444-4444-444444444444';
const kp=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
const clubkey=await crypto.subtle.exportKey('jwk',kp.publicKey);
const abrir=async box=>{const td=new TextDecoder();const u=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));const raw=await crypto.subtle.decrypt({name:'RSA-OAEP'},kp.privateKey,u(box.k));const ak=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);return JSON.parse(td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:u(box.iv)},ak,u(box.ct))));};
const KEY='k'.repeat(40);
const baseEnv={SUPABASE_URL:'https://p.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'srv',ALLOWED_ORIGINS:'https://raveholding.github.io',CANALES_COMERCIO:'almacen-rave'};
const env={...baseEnv,OAUTH_KEY:KEY,GOOGLE_CLIENT_ID:'gid',GOOGLE_CLIENT_SECRET:'gsec',MS_CLIENT_ID:'mid',MS_CLIENT_SECRET:'msec',META_APP_ID:'111',META_APP_SECRET:'msecret',META_CONFIG_ID:'cfg9'};
/* base de datos y proveedores simulados */
const db={oauth_estados:[],oauth_cuentas:[],crm_entrantes:[]};let calls=[];const users={adm:{id:'a1',rol:'admin'},mos:{id:'m1',rol:'mostrador'}};
const chal={};let gRefresh='ok';const sha=async s=>btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const idt=em=>'x.'+btoa(JSON.stringify({email:em})).replace(/=+$/,'')+'.y';
const b64uTxt=s=>btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const filt=(rows,q)=>{for(const [k,v] of q.entries()){if(['select','order','limit','on_conflict'].includes(k))continue;const [op,...rest]=v.split('.');const val=rest.join('.');rows=rows.filter(r=>op==='eq'?String(r[k])===val:op==='in'?val.replace(/[()]/g,'').split(',').includes(String(r[k])):true);}return rows;};
const fake=async(url,o={})=>{const u=new URL(url);const h=o.headers||{};const m=(o.method||'GET').toUpperCase();const R=(b,s=200)=>new Response(typeof b==='string'?b:JSON.stringify(b),{status:s});calls.push({url,m,body:o.body,h});
 if(u.host==='p.supabase.co'){
  if(u.pathname==='/auth/v1/user'){const w=String(h.authorization||'').split(' ')[1];return users[w]?R(users[w]):R({},401);}
  const t=u.pathname.replace('/rest/v1/','');
  if(t==='miembros'){const id=u.searchParams.get('usuario_id').slice(3);const us=Object.values(users).find(x=>x.id===id);return R(us&&u.searchParams.get('comercio_id')==='eq.'+C?[{rol:us.rol}]:[]);}
  if(t==='comercios')return R([{id:C}]);
  if(t==='menus')return R([{clubkey}]);
  if(db[t]){if(m==='GET')return R(filt(db[t],u.searchParams));
   if(m==='POST'){const row=JSON.parse(o.body);if(t==='oauth_cuentas'){const i=db[t].findIndex(x=>x.comercio_id===row.comercio_id&&x.proveedor===row.proveedor&&x.cuenta===row.cuenta);if(i>=0)db[t][i]={...db[t][i],...row};else db[t].push({id:crypto.randomUUID(),creado:new Date().toISOString(),...row});}else db[t].push(row);return new Response(null,{status:201});}
   if(m==='PATCH'){filt(db[t],u.searchParams).forEach(r=>Object.assign(r,JSON.parse(o.body)));return new Response(null,{status:204});}
   if(m==='DELETE'){const del=filt(db[t],u.searchParams);db[t]=db[t].filter(r=>!del.includes(r));return R(del);}}
  return R([],404);}
 if(url.startsWith('https://oauth2.googleapis.com/token')){const p=new URLSearchParams(o.body);
  if(p.get('grant_type')==='authorization_code'){if(p.get('code')!=='CODIGO-G'||await sha(p.get('code_verifier'))!==chal.google)return R({error:'invalid_grant'},400);return R({access_token:'GAT-1',refresh_token:'GRT-1',expires_in:3600,id_token:idt('ventas@almacen.com')});}
  if(gRefresh==='revocado')return R({error:'invalid_grant'},400);return R({access_token:'GAT-2',expires_in:3600});}
 if(url.startsWith('https://oauth2.googleapis.com/revoke'))return R({});
 if(u.host==='gmail.googleapis.com'){if(!/Bearer GAT-/.test(h.authorization))return R({},401);
  if(u.pathname.endsWith('/messages')&&m==='GET')return R({messages:[{id:'m1'},{id:'m2'}]});
  if(u.pathname.endsWith('/messages/m1'))return R({internalDate:String(Date.now()),payload:{headers:[{name:'From',value:'"Ana Pérez" <ana@cliente.com>'},{name:'Subject',value:'Consulta de precios'}],mimeType:'multipart/alternative',parts:[{mimeType:'text/plain',body:{data:b64uTxt('Hola, ¿tienen vino Malbec?\n\nEl lun., 1 nov. 2026, Almacén escribió:\n> respuesta vieja')}}]}});
  if(u.pathname.endsWith('/messages/m2'))return R({payload:{headers:[{name:'From',value:'ventas@almacen.com'}]}});
  if(u.pathname.endsWith('/messages/send'))return R({id:'s1'});}
 if(u.host==='login.microsoftonline.com'){const p=new URLSearchParams(o.body);if(p.get('grant_type')==='authorization_code'&&await sha(p.get('code_verifier'))===chal.microsoft)return R({access_token:'MAT-1',refresh_token:'MRT-1',expires_in:3600});return R({error:'invalid_grant'},400);}
 if(u.host==='graph.microsoft.com'){if(u.pathname==='/v1.0/me')return R({mail:'Info@Almacen.com'});if(u.pathname.includes('/messages'))return R({value:[{id:'o1',subject:'Pedido',from:{emailAddress:{address:'juan@cliente.com',name:'Juan'}},body:{contentType:'html',content:'<p>Quiero <b>2 cajas</b></p><script>x()</script>'},receivedDateTime:new Date().toISOString()}]});}
 if(u.host==='graph.facebook.com'){if(u.pathname.endsWith('/oauth/access_token'))return u.searchParams.get('code')==='CODIGO-M'?R({access_token:'META-AT'}):R({},400);
  if(u.pathname.endsWith('/debug_token'))return R({data:{granular_scopes:[{scope:'whatsapp_business_management',target_ids:['90001']},{scope:'pages_messaging',target_ids:['70001']}]}});
  if(u.pathname.endsWith('/90001/phone_numbers'))return R({data:[{id:'55501',display_phone_number:'+54 387 448-4132',verified_name:'Almacén RAVE'}]});
  if(u.pathname.endsWith('/me/accounts'))return R({data:[{id:'70001',name:'Almacén RAVE',access_token:'PAGE-AT',instagram_business_account:{username:'almacenrave'}}]});
  if(u.pathname.endsWith('/subscribed_apps'))return R({success:true});
  if(u.pathname.endsWith('/me/messages'))return R({message_id:'x'});
  if(u.pathname.endsWith('/messages'))return R({messages:[{id:'w1'}]});}
 return R({},404);};
const post=async(e,who,b)=>{const r=await manejar(new Request('https://p.supabase.co/functions/v1/conectar',{method:'POST',headers:who?{authorization:'Bearer '+who,'content-type':'application/json'}:{'content-type':'application/json'},body:JSON.stringify(b)}),e,fake);return{st:r.status,j:await r.json()};};
const cb=async(qs)=>{const r=await manejar(new Request('https://p.supabase.co/functions/v1/conectar?c=cb&'+qs),env,fake);return{st:r.status,t:await r.text(),h:r.headers};};
/* sin secretos: todo apagado */
let r=await post(baseEnv,'adm',{accion:'estado',comercio:C});
chk(r.st===200&&!r.j.disponibles.google&&!r.j.disponibles.microsoft&&!r.j.disponibles.meta,'sin secretos: los tres proveedores aparecen apagados');
r=await post(baseEnv,'adm',{accion:'inicio',comercio:C,proveedor:'google'});chk(r.st===412&&/guía/.test(r.j.error),'sin secretos: «Conectar con Google» explica qué falta');
r=await post({...env,OAUTH_KEY:'corta'},'adm',{accion:'estado',comercio:C});chk(!r.j.disponibles.google,'una OAUTH_KEY corta no habilita nada');
r=await post(env,'mos',{accion:'inicio',comercio:C,proveedor:'google'});chk(r.st===403,'sólo el administrador conecta cuentas');
r=await post(env,null,{accion:'inicio',comercio:C,proveedor:'google'});chk(r.st===401,'sin sesión: 401');
/* Google */
r=await post(env,'adm',{accion:'inicio',comercio:C,proveedor:'google'});const gu=new URL(r.j.url);chal.google=gu.searchParams.get('code_challenge');
chk(gu.host==='accounts.google.com'&&gu.searchParams.get('client_id')==='gid'&&gu.searchParams.get('access_type')==='offline'&&gu.searchParams.get('code_challenge_method')==='S256'&&/gmail\.modify/.test(gu.searchParams.get('scope')),'Google: ventana con PKCE, acceso sin conexión y permiso de Gmail');
chk(gu.searchParams.get('redirect_uri')==='https://p.supabase.co/functions/v1/conectar?c=cb','vuelve a la función');
const stG=gu.searchParams.get('state');
let p=await cb('code=CODIGO-G&state='+encodeURIComponent(stG.slice(0,-3)+'AAA'));chk(p.st===400&&/no es válida/.test(p.t),'«state» adulterado se rechaza');
p=await cb('code=CODIGO-G&state='+encodeURIComponent(stG));chk(p.st===200&&/ventas@almacen\.com conectado/.test(p.t),'Google conectado: la ventana lo confirma');
chk(/postMessage/.test(p.t)&&/raveholding\.github\.io/.test(p.t)&&/default-src 'none'/.test(p.h.get('content-security-policy')||''),'la ventana avisa sólo al origen permitido y tiene CSP estricta');
const cg=db.oauth_cuentas.find(x=>x.proveedor==='google');
chk(cg&&!JSON.stringify(cg).includes('GAT-1')&&!JSON.stringify(cg).includes('GRT-1')&&/^v1\./.test(cg.token_cif),'los tokens se guardan cifrados (no aparecen en la base)');
const tk=await descifrar(KEY,cg.token_cif);chk(tk.at==='GAT-1'&&tk.rt==='GRT-1','y se descifran sólo con OAUTH_KEY');
p=await cb('code=CODIGO-G&state='+encodeURIComponent(stG));chk(p.st===400&&/ya se usó/.test(p.t),'el mismo «state» no sirve dos veces');
p=await cb('error=access_denied&state=x');chk(p.st===400&&/Cancelaste/.test(p.t),'si el usuario cancela, se explica');
/* procesar: trae correos y no duplica */
r=await post(env,null,{accion:'procesar'});
chk(r.j.ok&&r.j.correos===1,'procesar: entra 1 correo (el propio se ignora) %s'.replace('%s',JSON.stringify(r.j)));
const ent=db.crm_entrantes[0];const box=await abrir(ent.cifrado);
chk(box.chan==='mail'&&box.ext==='ana@cliente.com'&&/Asunto: Consulta de precios/.test(box.text)&&/Malbec/.test(box.text)&&!/respuesta vieja/.test(box.text),'el correo entra cifrado a la bandeja, sin la parte citada');
r=await post(env,null,{accion:'procesar'});chk(r.j.correos===0&&db.crm_entrantes.length===1,'volver a procesar no duplica');
db.oauth_cuentas.find(x=>x.proveedor==='google').expira=new Date(Date.now()-1000).toISOString();
r=await post(env,null,{accion:'procesar'});const tk2=await descifrar(KEY,db.oauth_cuentas.find(x=>x.proveedor==='google').token_cif);
chk(r.j.renovadas===1&&tk2.at==='GAT-2'&&tk2.rt==='GRT-1','token por vencer: se renueva solo (y conserva el permanente)');
gRefresh='revocado';db.oauth_cuentas.find(x=>x.proveedor==='google').expira=new Date(0).toISOString();
r=await post(env,null,{accion:'procesar'});const cg2=db.oauth_cuentas.find(x=>x.proveedor==='google');
chk(r.j.revocadas===1&&cg2.estado==='revocada'&&/volvé a conectar/.test(cg2.error),'permiso retirado en Google: queda «revocada» con aviso para reconectar');
gRefresh='ok';cg2.estado='activa';cg2.expira=new Date(Date.now()+3600e3).toISOString();
/* Microsoft */
r=await post(env,'adm',{accion:'inicio',comercio:C,proveedor:'microsoft'});const mu=new URL(r.j.url);chal.microsoft=mu.searchParams.get('code_challenge');
chk(mu.host==='login.microsoftonline.com'&&/offline_access/.test(mu.searchParams.get('scope'))&&/Mail\.Send/.test(mu.searchParams.get('scope')),'Microsoft: permisos de leer y enviar con renovación');
p=await cb('code=CODIGO-MS-12345&state='+encodeURIComponent(mu.searchParams.get('state')));chk(p.st===200&&/info@almacen\.com/.test(p.t),'Outlook conectado (la dirección queda en minúsculas)');
r=await post(env,null,{accion:'procesar'});const bx=await abrir(db.crm_entrantes[db.crm_entrantes.length-1].cifrado);
chk(bx.ext==='juan@cliente.com'&&/Quiero 2 cajas/.test(bx.text)&&!/x\(\)/.test(bx.text),'correo HTML de Outlook: entra como texto limpio (sin scripts)');
/* Meta Embedded Signup */
r=await post(env,'adm',{accion:'inicio',comercio:C,proveedor:'meta'});const fu=new URL(r.j.url);
chk(fu.host==='www.facebook.com'&&fu.searchParams.get('config_id')==='cfg9'&&fu.searchParams.get('client_id')==='111','Meta: ventana de Embedded Signup con la configuración del comercio');
p=await cb('code=CODIGO-M&state='+encodeURIComponent(fu.searchParams.get('state')));const cm=db.oauth_cuentas.find(x=>x.proveedor==='meta');
chk(p.st===200&&cm&&cm.datos.canales.join()==='wa,fb,ig'&&cm.datos.wa[0].phone_id==='55501'&&cm.datos.paginas[0].ig==='almacenrave','Meta conectado: WhatsApp, Messenger e Instagram en una sola ventana');
chk(calls.some(c=>c.url.endsWith('/90001/subscribed_apps')&&c.m==='POST')&&calls.some(c=>c.url.includes('/70001/subscribed_apps')),'suscribe la app a los avisos del número y de la página');
chk(!JSON.stringify(cm).includes('PAGE-AT')&&!JSON.stringify(cm).includes('META-AT'),'tokens de Meta cifrados');
r=await post(env,'adm',{accion:'estado',comercio:C});chk(r.j.cuentas.length===3&&!JSON.stringify(r.j).includes('token'),'estado: 3 cuentas, sin tokens');
/* canales responde por las cuentas conectadas */
const cenv={...baseEnv,OAUTH_KEY:KEY};calls=[];
const cpost=async b=>{const r=await canales(new Request('https://p.supabase.co/functions/v1/canales',{method:'POST',headers:{authorization:'Bearer adm','content-type':'application/json'},body:JSON.stringify(b)}),cenv,fake);return{st:r.status,j:await r.json()};};
r=await cpost({accion:'enviar',comercio:C,canal:'mail',para:'ana@cliente.com',asunto:'Re: Consulta',texto:'Sí, tenemos Malbec 🍷'});
const sent=calls.find(c=>c.url.endsWith('/messages/send'));const raw=sent&&new TextDecoder().decode(Uint8Array.from(atob(JSON.parse(sent.body).raw.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));
chk(r.j.ok&&raw&&/To: ana@cliente\.com/.test(raw)&&/From: ventas@almacen\.com/.test(raw),'«canales» responde el correo por Gmail conectado (sin Resend)');
r=await cpost({accion:'enviar',comercio:C,canal:'wa',para:'5493874484132',texto:'Hola!'});const w=calls.find(c=>c.url.includes('/55501/messages'));
chk(r.j.ok&&w&&/Bearer META-AT/.test(w.h.authorization),'«canales» responde WhatsApp con el número conectado por Meta');
r=await cpost({accion:'enviar',comercio:C,canal:'ig',para:'123456',texto:'Hola!'});const ig=calls.find(c=>c.url.endsWith('/me/messages'));
chk(r.j.ok&&ig&&/Bearer PAGE-AT/.test(ig.h.authorization),'… e Instagram / Messenger con el token de la página');
/* desconectar */
const gid=db.oauth_cuentas.find(x=>x.proveedor==='google').id;calls=[];
r=await post(env,'adm',{accion:'desconectar',comercio:C,id:gid});chk(r.j.ok&&!db.oauth_cuentas.some(x=>x.id===gid)&&calls.some(c=>c.url.startsWith('https://oauth2.googleapis.com/revoke')),'desconectar: revoca en Google y borra la cuenta');
/* utilidades */
chk(sinHtml('<p>Hola&nbsp;<b>Ana</b></p><style>x{}</style><br>chau')==='Hola Ana\nchau','HTML a texto');
chk(sinCita('Gracias!\n\nOn Mon, Nov 1, 2026 Juan wrote:\n> viejo')==='Gracias!','corta la cita en inglés');
chk(/Subject: =\?UTF-8\?B\?/.test(mime('a@b.com','c@d.com','Reclamación ñ','x')),'asunto con acentos codificado');
console.log(ok+' OK / '+bad+' FALLAN de '+(ok+bad));process.exit(bad?1:0);
