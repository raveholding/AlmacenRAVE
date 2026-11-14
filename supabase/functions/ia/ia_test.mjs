// node --experimental-strip-types ia_test.mjs · IA opcional con proveedores simulados
import { manejar } from './handler.ts';
let ok=0,bad=0;const chk=(c,m)=>{console.log((c?'OK   ':'FALLA ')+m);c?ok++:bad++;};
const C='55555555-5555-5555-5555-555555555555';const base={SUPABASE_URL:'https://p.supabase.co',SUPABASE_ANON_KEY:'a',SUPABASE_SERVICE_ROLE_KEY:'s'};
let last=null;const users={adm:{id:'u1',rol:'admin'},ext:{id:'u9',rol:null}};
const fake=async(url,o={})=>{const R=(b,s=200)=>new Response(JSON.stringify(b),{status:s});
 if(url.endsWith('/auth/v1/user')){const w=String(o.headers.authorization).split(' ')[1];return users[w]?R(users[w]):R({},401);}
 if(url.includes('/rest/v1/miembros')){const id=/usuario_id=eq\.([^&]+)/.exec(url)[1];const u=Object.values(users).find(x=>x.id===id);return R(u&&u.rol?[{rol:u.rol}]:[]);}
 if(url.includes('api.openai.com')){last={url,body:JSON.parse(o.body),h:o.headers};return R({choices:[{message:{content:'• Pide Malbec\n• Falta confirmar stock'}}]});}
 if(url.includes('generativelanguage')){last={url,body:JSON.parse(o.body),h:o.headers};return R({candidates:[{content:{parts:[{text:'Hola! Sí, tenemos.'}]}}]});}
 return R({},404);};
const call=async(env,who,b)=>{const r=await manejar(new Request('https://f/ia',{method:'POST',headers:{authorization:'Bearer '+who,'content-type':'application/json'},body:JSON.stringify(b)}),env,fake);return{st:r.status,j:await r.json()};};
let r=await call(base,'adm',{accion:'estado',comercio:C});chk(r.j.ia===false,'sin clave: la IA figura apagada');
r=await call(base,'adm',{accion:'resumir',comercio:C,texto:'hola'});chk(r.st===412&&/reglas gratis/.test(r.j.error),'sin clave: explica que sigue con reglas gratis');
const eo={...base,OPENAI_API_KEY:'sk-x'};
r=await call(eo,'ext',{accion:'resumir',comercio:C,texto:'hola'});chk(r.st===403,'alguien ajeno al comercio no la usa');
r=await call(eo,'adm',{accion:'resumir',comercio:C,texto:'Cliente: quiero Malbec'});chk(r.j.ok&&/Malbec/.test(r.j.texto)&&last.body.model==='gpt-4o-mini'&&last.body.messages[0].role==='system','OpenAI: resume el hilo');
r=await call(eo,'adm',{accion:'responder',comercio:C,texto:'Cliente: ¿abren el domingo?',contexto:['Horario: lunes a sábado de 9 a 21.']});
chk(r.j.ok&&/Horario: lunes a sábado/.test(last.body.messages[1].content)&&/ÚNICAMENTE/.test(last.body.messages[0].content),'responder usa SÓLO el contexto enviado (base de conocimiento y datos del sistema)');
const eg={...base,GEMINI_API_KEY:'g-x'};
r=await call(eg,'adm',{accion:'tono',comercio:C,texto:'NO HAY STOCK'});chk(r.j.ok&&last.h['x-goog-api-key']==='g-x'&&!last.url.includes('key='),'Gemini: la clave va en la cabecera, nunca en la dirección');
const el={...eo,IA_LIMITE_HORA:'2'};await call(el,'adm',{accion:'tono',comercio:'66666666-6666-6666-6666-666666666666',texto:'a'});
let lim=0;for(let i=0;i<4;i++){r=await call(el,'adm',{accion:'tono',comercio:C,texto:'x'});if(r.st===429)lim++;}chk(lim>=1,'límite de consultas por hora');
console.log(ok+' OK / '+bad+' FALLAN de '+(ok+bad));process.exit(bad?1:0);
