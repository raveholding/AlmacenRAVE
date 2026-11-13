// node --experimental-strip-types canales_test.mjs · pruebas de la función «canales» con los servicios simulados
import { manejar, deTelegram, deMeta, deCorreo, convDe } from './handler.ts';
const C='22222222-2222-2222-2222-222222222222';
const kp=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
const pub=await crypto.subtle.exportKey('jwk',kp.publicKey);
const env={SUPABASE_URL:'https://x.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'srv',CANALES_COMERCIO:'almacen-rave',FUNCTION_URL:'https://x.supabase.co/functions/v1/canales',
 TG_CLIENTES_TOKEN:'123:abc',TG_CLIENTES_SECRET:'tgsecret',META_VERIFY_TOKEN:'verif',META_APP_SECRET:'appsec',META_PAGE_TOKEN:'pg',WA_TOKEN:'wt',WA_PHONE_ID:'555',MAIL_IN_SECRET:'mk',RESEND_API_KEY:'rs',MAIL_FROM:'RAVE <hola@rave.ar>'};
const users={adm:{id:'a1',rol:'admin'},mos:{id:'m1',rol:'mostrador'},rep:{id:'r1',rol:'repartidor'}};const ins=[],out=[];
const fake=async(url,o={})=>{const h=o.headers||{};const R=(b,s=200)=>new Response(JSON.stringify(b),{status:s});
 if(url.endsWith('/auth/v1/user')){const w=String(h.authorization||'').split(' ')[1];return users[w]?R(users[w]):R({},401);}
 if(url.includes('/rest/v1/miembros')){const id=/usuario_id=eq\.([^&]+)/.exec(url)[1];const u=Object.values(users).find(x=>x.id===id);return R(u&&url.includes(C)?[{rol:u.rol}]:[]);}
 if(url.includes('/rest/v1/comercios'))return R(url.includes('almacen-rave')?[{id:C}]:[]);
 if(url.includes('/rest/v1/menus'))return R([{clubkey:pub}]);
 if(url.includes('/rest/v1/crm_entrantes')){ins.push(JSON.parse(o.body));return new Response(null,{status:201});}
 if(url.includes('api.telegram.org')){const m=url.split('/').pop();out.push(['tg',m,o.body&&JSON.parse(o.body)]);if(m==='getMe')return R({ok:true,result:{username:'RaveClientesBot'}});if(m==='getWebhookInfo')return R({ok:true,result:{url:env.FUNCTION_URL+'?c=tg'}});return R({ok:true,result:{}});}
 if(url.includes('graph.facebook.com')){out.push(['meta',url,o.body&&JSON.parse(o.body)]);if(url.includes('fields=display'))return R({display_phone_number:'+54 387'});if(url.includes('instagram_business_account'))return R({name:'RAVE',instagram_business_account:{username:'rave.salta'}});return R({});}
 if(url.includes('api.resend.com')){out.push(['mail',JSON.parse(o.body)]);return R({id:'e1'});}
 return R({},404);};
const abrir=async box=>{const td=new TextDecoder();const u=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));const raw=await crypto.subtle.decrypt({name:'RSA-OAEP'},kp.privateKey,u(box.k));const ak=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);return JSON.parse(td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:u(box.iv)},ak,u(box.ct))));};
const call=async(who,body)=>{const r=await manejar(new Request('https://f/canales',{method:'POST',headers:{authorization:'Bearer '+who,'content-type':'application/json'},body:JSON.stringify(Object.assign({comercio:C},body))}),env,fake);return{st:r.status,j:await r.json()};};
const hook=(q,body,headers={})=>manejar(new Request('https://f/canales?'+q,{method:'POST',headers,body:typeof body==='string'?body:JSON.stringify(body)}),env,fake);
const hmac=async(k,s)=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(k),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');};
let ok=0,fail=0;const chk=(c,m)=>{console.log((c?'OK   ':'FALLA ')+m);c?ok++:fail++;};
// lectura de proveedores
chk(deTelegram({message:{message_id:5,date:1,chat:{id:99,type:'private'},from:{first_name:'Ana'},text:'Hola'}})[0].ext==='99','Telegram: lee el mensaje privado');
chk(deTelegram({message:{message_id:5,chat:{id:-5,type:'group'},text:'x'}}).length===0,'Telegram: ignora grupos');
const wa={object:'whatsapp_business_account',entry:[{changes:[{value:{contacts:[{wa_id:'5493874',profile:{name:'Beto'}}],messages:[{from:'5493874',id:'wamid.X1',timestamp:'1700000000',text:{body:'¿Tienen hielo?'}}]}}]}]};
chk(deMeta(wa)[0].chan==='wa'&&deMeta(wa)[0].name==='Beto','WhatsApp Business: lee mensaje y nombre');
const ig={object:'instagram',entry:[{messaging:[{sender:{id:'177'},timestamp:1,message:{mid:'m_1',text:'precio?'}},{sender:{id:'1'},message:{mid:'m2',text:'eco',is_echo:true}}]}]};
chk(deMeta(ig).length===1&&deMeta(ig)[0].chan==='ig','Instagram: lee el mensaje y descarta los ecos propios');
chk(deMeta({object:'page',entry:[{messaging:[{sender:{id:'88'},message:{mid:'z',text:'hola'}}]}]})[0].chan==='fb','Messenger: lee el mensaje');
chk(deCorreo({From:'Carla <carla@x.com>',Subject:'Pedido',TextBody:'Quiero 2 vinos'})[0].email==='carla@x.com','Correo: lee remitente, asunto y texto (Postmark)');
chk(deCorreo({from:'no-es-mail',text:'x'}).length===0,'Correo: descarta remitentes inválidos');
chk((await convDe('tg','99'))===(await convDe('tg','99'))&&/^w[A-Za-z0-9_-]{16,40}$/.test(await convDe('tg','99')),'conversación estable por contacto y válida para la base');
// avisos
let r=await hook('c=tg',{message:{message_id:1,date:1,chat:{id:99,type:'private'},from:{first_name:'Ana'},text:'Hola, ¿abren hoy?'}},{'x-telegram-bot-api-secret-token':'otro'});chk(r.status===401&&!ins.length,'Telegram: aviso sin el secreto se rechaza');
r=await hook('c=tg',{message:{message_id:1,date:1,chat:{id:99,type:'private'},from:{first_name:'Ana'},text:'Hola, ¿abren hoy?'}},{'x-telegram-bot-api-secret-token':'tgsecret'});
chk(r.status===200&&ins.length===1,'Telegram: el mensaje entra a crm_entrantes');
chk(!JSON.stringify(ins[0]).includes('abren')&&!JSON.stringify(ins[0]).includes('Ana'),'… CIFRADO: el servidor no guarda el texto ni el nombre');
let p=await abrir(ins[0].cifrado);chk(p.chan==='tg'&&p.ext==='99'&&p.text.includes('abren')&&p.conv===ins[0].conv,'… y el sistema del local lo abre con su llave');
const body=JSON.stringify(wa);r=await hook('c=meta',body,{'x-hub-signature-256':'sha256=deadbeef'});chk(r.status===401&&ins.length===1,'Meta: aviso con firma falsa se rechaza');
r=await hook('c=meta',body,{'x-hub-signature-256':'sha256='+await hmac('appsec',body)});chk(r.status===200&&ins.length===2,'Meta: aviso firmado entra');
let g=await manejar(new Request('https://f/canales?c=meta&hub.mode=subscribe&hub.verify_token=verif&hub.challenge=42'),env,fake);chk((await g.text())==='42','Meta: verificación del webhook');
g=await manejar(new Request('https://f/canales?c=meta&hub.mode=subscribe&hub.verify_token=mal&hub.challenge=42'),env,fake);chk(g.status===403,'Meta: verificación con token equivocado se rechaza');
r=await hook('c=mail&k=mal',{From:'c@x.com',TextBody:'hola'});chk(r.status===401,'correo: sin la clave se rechaza');
r=await hook('c=mail&k=mk',{From:'Carla <carla@x.com>',Subject:'Consulta',TextBody:'¿Hacen envíos?'});chk(r.status===200&&ins.length===3,'correo: el reenvío entra');
// acciones
let a=await call('nadie',{accion:'estado'});chk(a.st===401,'sin sesión no hay acciones');
a=await call('mos',{accion:'estado'});chk(a.st===403,'el estado y la conexión son sólo del administrador');
a=await call('adm',{accion:'estado'});chk(a.j.ok&&a.j.tg&&a.j.meta&&a.j.wa&&a.j.mailIn&&a.j.mailOut&&a.j.llave&&!JSON.stringify(a.j).includes('tgsecret'),'estado: qué está configurado, sin mostrar secretos');
a=await call('adm',{accion:'tg_conectar'});const sw=out.find(x=>x[1]==='setWebhook');chk(a.j.ok&&a.j.bot==='@RaveClientesBot'&&sw&&sw[2].url.endsWith('?c=tg')&&sw[2].secret_token==='tgsecret','Telegram: un clic registra el webhook con su secreto');
for(const k of ['tg','wa','ig','fb','mail']){a=await call('adm',{accion:'probar',canal:k});chk(a.j.ok,'probar '+k+': '+a.j.msg);}
a=await call('rep',{accion:'enviar',canal:'tg',para:'99',texto:'hola'});chk(a.st===403,'un repartidor no responde en Atención al cliente');
a=await call('mos',{accion:'enviar',canal:'tg',para:'99',texto:'¡Sí, hasta las 23!'});chk(a.j.ok&&out.some(x=>x[1]==='sendMessage'&&x[2].chat_id==='99'),'responder por Telegram');
a=await call('mos',{accion:'enviar',canal:'wa',para:'5493874',texto:'Sí, tenemos'});chk(a.j.ok,'responder por WhatsApp Business');
a=await call('mos',{accion:'enviar',canal:'ig',para:'177',texto:'Sale $ 1.500'});chk(a.j.ok&&out.some(x=>x[0]==='meta'&&x[2]&&x[2].messaging_type==='RESPONSE'),'responder por Instagram / Messenger');
a=await call('mos',{accion:'enviar',canal:'mail',para:'carla@x.com',texto:'Sí, hacemos envíos',asunto:'Re: Consulta'});chk(a.j.ok&&out.some(x=>x[0]==='mail'&&x[1].to[0]==='carla@x.com'),'responder por correo');
a=await call('mos',{accion:'enviar',canal:'tg',para:'abc',texto:'x'});chk(a.st===400,'destinatario inválido se rechaza');
console.log(`\n${ok}/${ok+fail}`);process.exit(fail?1:0);
