// node --experimental-strip-types reparto_test.mjs · pruebas de la función «reparto-pro» con los servicios simulados
import { manejar } from './handler.ts';
const C='22222222-2222-2222-2222-222222222222';
const env={SUPABASE_URL:'https://x.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'srv',GOOGLE_ROUTES_KEY:'gk',MP_ACCESS_TOKEN:'mp',MP_WEBHOOK_SECRET:'whsec',WA_TOKEN:'wt',WA_PHONE_ID:'123',WA_TEMPLATE:'pedido_salio'};
const users={adm:{id:'a1',rol:'admin'},rep:{id:'r1',rol:'repartidor'},aj:{id:'z1',rol:null}};const sent=[];
const fake=async(url,o={})=>{const h=o.headers||{};const R=(b,s=200)=>new Response(JSON.stringify(b),{status:s});
 if(url.endsWith('/auth/v1/user')){const w=String(h.authorization||'').split(' ')[1];return users[w]?R(users[w]):R({},401);}
 if(url.includes('/rest/v1/miembros')){const id=/usuario_id=eq\.([^&]+)/.exec(url)[1];const u=Object.values(users).find(x=>x.id===id);return R(u&&u.rol&&url.includes(C)?[{rol:u.rol}]:[]);}
 if(url.includes('routes.googleapis.com')){const b=JSON.parse(o.body);if(h['X-Goog-Api-Key']!=='gk')return R({},403);return R({routes:[{optimizedIntermediateWaypointIndex:b.intermediates.map((_,i)=>i).reverse()}]});}
 if(url.includes('/users/me'))return h.authorization==='Bearer mp'?R({id:9,nickname:'RAVE'}):R({},401);
 if(url.includes('/checkout/preferences')){sent.push(JSON.parse(o.body));return R({id:'pref1',init_point:'https://mpago.la/abc'});}
 if(url.includes('/v1/payments/search'))return R({results:url.includes('PAGADO')?[{id:77,status:'approved'}]:[{id:5,status:'pending'}]});
 if(url.includes('graph.facebook.com')){if(o.method==='POST'){sent.push(JSON.parse(o.body));return R({messages:[{id:'w'}]});}return R({display_phone_number:'+54 387'});}
 return R({},404);};
const call=async(who,body)=>{const r=await manejar(new Request('https://f/reparto-pro',{method:'POST',headers:{authorization:'Bearer '+who,'content-type':'application/json'},body:JSON.stringify(Object.assign({comercio:C},body))}),env,fake);return{st:r.status,j:await r.json()};};
let ok=0,fail=0;const chk=(c,m)=>{console.log((c?'OK   ':'FALLA ')+m);c?ok++:fail++;};
let r=await call('nadie',{accion:'test',conector:'mapas'});chk(r.st===401,'sin sesión válida no hace nada');
r=await call('aj',{accion:'rutas'});chk(r.st===403,'alguien de otro comercio no puede usarla');
r=await call('rep',{accion:'test',conector:'cobro'});chk(r.st===403,'sólo el administrador prueba y activa conectores');
for(const k of ['mapas','cobro','wa']){r=await call('adm',{accion:'test',conector:k});chk(r.st===200&&r.j.ok,'prueba del conector '+k+': '+r.j.msg);}
r=await call('rep',{accion:'rutas',origen:{lat:-24.78,lng:-65.41},paradas:[{id:'e1',lat:-24.77,lng:-65.40},{id:'e2',lat:-24.79,lng:-65.42},{id:'e3',lat:-24.80,lng:-65.43}]});
chk(r.st===200&&r.j.orden.join()==='e3,e2,e1','Google Routes devuelve el orden óptimo de paradas');
r=await call('rep',{accion:'rutas',origen:{lat:999,lng:0},paradas:[]});chk(r.st===400,'datos de ruta inválidos se rechazan');
r=await call('rep',{accion:'mp_qr',ref:'env1',monto:315000,desc:'Pedido #4'});chk(r.st===200&&r.j.url==='https://mpago.la/abc'&&sent[0].items[0].unit_price===3150&&sent[0].external_reference===C+':env1','Mercado Pago: cobro del monto exacto, atado al pedido y al comercio');
r=await call('rep',{accion:'mp_qr',ref:'env1',monto:-5});chk(r.st===400,'monto inválido se rechaza');
r=await call('rep',{accion:'mp_estado',ref:'PAGADO1'});chk(r.j.estado==='approved'&&r.j.id==='77','detecta el pago aprobado');
r=await call('rep',{accion:'mp_estado',ref:'env2'});chk(r.j.estado!=='approved','un pago pendiente no se da por cobrado');
r=await call('rep',{accion:'wa_salida',mensajes:[{tel:'5493874000001',texto:'Tu pedido salió'},{tel:'12',texto:'x'}]});chk(r.j.ok&&r.j.enviados===1&&sent[sent.length-1].template.name==='pedido_salio','WhatsApp Cloud: aviso con plantilla aprobada (descarta teléfonos inválidos)');
// aviso de Mercado Pago
const crypto2=globalThis.crypto;const sig=async(id,rid,ts)=>{const k=await crypto2.subtle.importKey('raw',new TextEncoder().encode('whsec'),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto2.subtle.sign('HMAC',k,new TextEncoder().encode(`id:${id};request-id:${rid};ts:${ts};`))),b=>b.toString(16).padStart(2,'0')).join('');};
let w=await manejar(new Request('https://f/reparto-pro?aviso=mp&data.id=123',{method:'POST',headers:{'x-signature':'ts=1,v1='+await sig('123','rq','1'),'x-request-id':'rq'},body:'{}'}),env,fake);chk(w.status===200,'aviso de Mercado Pago con firma válida: aceptado');
w=await manejar(new Request('https://f/reparto-pro?aviso=mp&data.id=123',{method:'POST',headers:{'x-signature':'ts=1,v1=deadbeef','x-request-id':'rq'},body:'{}'}),env,fake);chk(w.status===401,'aviso con firma falsa: rechazado');
console.log(`\n${ok}/${ok+fail}`);process.exit(fail?1:0);
