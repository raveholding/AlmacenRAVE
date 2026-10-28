// node --experimental-strip-types llave_test.mjs  · pruebas de la función «llave» con la nube simulada
import { manejar } from './handler.ts';
const C='22222222-2222-2222-2222-222222222222';
const KEY=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
const env={SUPABASE_URL:'https://x.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'srv',LLAVE_MASTER_KEY:KEY};
const db={custodia:null,eventos:[]};
const users={adm:{id:'a1',identities:[{provider:'email'}],rol:'admin'},gmem:{id:'m1',identities:[{provider:'email'},{provider:'google'}],rol:'mostrador'},pmem:{id:'m2',identities:[{provider:'email'}],rol:'mostrador'},ajeno:{id:'z9',identities:[{provider:'google'}],rol:null}};
const tok=(who,amr)=>'h.'+Buffer.from(JSON.stringify({sub:users[who].id,amr:[{method:amr}]})).toString('base64url')+'.s|'+who;
const fake=async(url,o={})=>{const h=o.headers||{};const R=(b,s=200)=>new Response(b==null?null:JSON.stringify(b),{status:s});
 if(url.endsWith('/auth/v1/user')){const who=String(h.authorization||'').split('|')[1];return users[who]?R(users[who]):R({},401);}
 if(url.includes('/rest/v1/miembros')){const id=/usuario_id=eq\.([^&]+)/.exec(url)[1];const u=Object.values(users).find(x=>x.id===id);return R(u&&u.rol&&url.includes('comercio_id=eq.'+C)?[{rol:u.rol}]:[]);}
 if(url.includes('/rest/v1/llaves_custodia')){if(o.method==='POST'){db.custodia=JSON.parse(o.body);return R(null,201);}if(o.method==='DELETE'){db.custodia=null;return R(null,204);}return R(db.custodia?[db.custodia]:[]);}
 if(url.includes('/rest/v1/custodia_eventos')){db.eventos.push(JSON.parse(o.body));return R(null,201);}
 return R({},404);};
const call=async(who,amr,body)=>{const r=await manejar(new Request('https://f/llave',{method:'POST',headers:{authorization:'Bearer '+tok(who,amr),'content-type':'application/json'},body:JSON.stringify(body)}),env,fake);return{st:r.status,j:await r.json()};};
let ok=0,fail=0;const chk=(c,m)=>{console.log((c?'OK   ':'FALLA ')+m);c?ok++:fail++;};
const dek=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
let r=await call('gmem','oauth',{accion:'guardar',comercio:C,dek});chk(r.st===403,'un no administrador no puede activar la custodia');
r=await call('adm','password',{accion:'guardar',comercio:C,dek:'AAAA'});chk(r.st===422,'llave de tamaño inválido rechazada');
r=await call('adm','password',{accion:'guardar',comercio:C,dek});chk(r.st===200&&db.custodia,'el administrador activa la custodia');
chk(!JSON.stringify(db.custodia).includes(dek),'la base guarda la llave CIFRADA (no la llave)');
r=await call('gmem','oauth',{accion:'abrir',comercio:C});chk(r.st===200&&r.j.dek===dek,'miembro que entró con Google recibe la llave correcta');
r=await call('gmem','password',{accion:'abrir',comercio:C});chk(r.st===403,'el mismo miembro entrando con contraseña NO la recibe por esta vía');
r=await call('pmem','oauth',{accion:'abrir',comercio:C});chk(r.st===403,'sin identidad de Google vinculada: no');
r=await call('ajeno','oauth',{accion:'abrir',comercio:C});chk(r.st===403,'cuenta de Google ajena al comercio: no');
r=await call('gmem','oauth',{accion:'abrir',comercio:'33333333-3333-3333-3333-333333333333'});chk(r.st===403,'otro comercio: no');
const env2={...env,LLAVE_MASTER_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')};
const r2=await manejar(new Request('https://f',{method:'POST',headers:{authorization:'Bearer '+tok('gmem','oauth')},body:JSON.stringify({accion:'abrir',comercio:C})}),env2,fake);chk(r2.status===500,'con otra llave maestra el sobre no se abre (una copia de la base sola no alcanza)');
r=await call('adm','password',{accion:'estado',comercio:C});chk(r.j.activa===true,'estado: activa');
chk(db.eventos.some(e=>e.accion==='CUSTODIA_ENTREGA')&&db.eventos.some(e=>e.accion==='CUSTODIA_ACTIVADA'),'queda registro de activación y de cada entrega');
r=await call('adm','password',{accion:'borrar',comercio:C});r=await call('gmem','oauth',{accion:'abrir',comercio:C});chk(r.j.activa===false,'desactivada: ya no entrega la llave');
const r3=await manejar(new Request('https://f',{method:'POST',body:'{}'}),env,fake);chk(r3.status===401,'sin sesión: 401');
let lim=0;for(let i=0;i<25;i++){const x=await call('gmem','oauth',{accion:'abrir',comercio:C});if(x.st===429)lim++;}chk(lim>0,'límite de intentos');
console.log(`\n${ok}/${ok+fail}`);process.exit(fail?1:0);
