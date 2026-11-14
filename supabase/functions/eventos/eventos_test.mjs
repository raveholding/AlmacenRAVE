// node --experimental-strip-types eventos_test.mjs · webhooks firmados y lectura por clave de API, con la base simulada
import { manejar, firma, destinoOk } from './handler.ts';
let ok=0,bad=0;const chk=(c,m)=>{console.log((c?'OK   ':'FALLA ')+m);c?ok++:bad++;};
const env={SUPABASE_URL:'https://p.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'srv'};
const cola=[{id:1,url:'https://hooks.ejemplo.com/ok',secreto:'whsec_abc',evento:'sale.created',evento_id:10,comercio_id:'c1',datos:{id:'v1',total_centavos:1500},creado:'2026-11-14T10:00:00Z'},
 {id:2,url:'https://hooks.ejemplo.com/falla',secreto:'whsec_abc',evento:'contact.created',evento_id:11,comercio_id:'c1',datos:{id:'cl1'},creado:'2026-11-14T10:00:00Z'},
 {id:3,url:'https://192.168.0.10/interno',secreto:'whsec_abc',evento:'sale.created',evento_id:12,comercio_id:'c1',datos:{},creado:'2026-11-14T10:00:00Z'}];
const res=[],posts=[];let tomas=0;
const fake=async(url,o={})=>{const R=(b,s=200)=>new Response(JSON.stringify(b),{status:s});
 if(url.endsWith('/rpc/wh_tomar')){tomas++;return R(tomas===1?cola:[]);}
 if(url.endsWith('/rpc/wh_resultado')){res.push(JSON.parse(o.body));return new Response('',{status:204});}
 if(url.endsWith('/rpc/api_eventos')){const b=JSON.parse(o.body);return R(b.p_clave==='vb_'+'a'.repeat(48)?{ok:true,eventos:[{id:5,evento:'sale.created',datos:{}},{id:6,evento:'contact.created',datos:{}}].filter(e=>e.id>b.p_desde)}:{ok:false});}
 if(url.startsWith('https://hooks.ejemplo.com/')){posts.push({url,h:o.headers,body:o.body,redirect:o.redirect});return new Response('',{status:url.endsWith('/ok')?200:503});}
 if(url.includes('192.168'))posts.push({url,interna:1});
 return R({},404);};
let r=await manejar(new Request('https://f/eventos',{method:'POST',body:JSON.stringify({accion:'procesar'})}),env,fake);let j=await r.json();
chk(j.enviados===1&&j.errores===2,'procesar: 1 entregado, 1 con error del destino, 1 bloqueado');
const p=posts.find(x=>x.url.endsWith('/ok'));const m=/^t=(\d+),v1=([0-9a-f]{64})$/.exec(p.h['x-vb-firma']);
chk(!!m&&m[2]===await firma('whsec_abc',+m[1],p.body),'firma X-VB-Firma verificable con el secreto (HMAC-SHA256 de «t.cuerpo»)');
chk(p.h['x-vb-evento']==='sale.created'&&JSON.parse(p.body).datos.total_centavos===1500&&p.redirect==='manual','cuerpo con el evento; no sigue redirecciones');
chk(!posts.some(x=>x.interna),'nunca llama a una IP privada (anti-SSRF)');
chk(res.find(x=>x.p_id===1).p_ok===true&&res.find(x=>x.p_id===2).p_ok===false&&res.find(x=>x.p_id===2).p_codigo===503,'resultados informados a la base (reintento del 503)');
chk(destinoOk('https://api.miempresa.com.ar/hook')&&!destinoOk('http://x.com')&&!destinoOk('https://localhost/x')&&!destinoOk('https://10.0.0.1/x')&&!destinoOk('https://user:pw@x.com/'),'validación de destinos');
r=await manejar(new Request('https://f/eventos?desde=0'),env,fake);chk(r.status===401,'GET sin clave: 401');
r=await manejar(new Request('https://f/eventos?desde=0',{headers:{'x-api-key':'vb_'+'b'.repeat(48)}}),env,fake);chk(r.status===401,'clave inválida: 401');
r=await manejar(new Request('https://f/eventos?desde=5',{headers:{'x-api-key':'vb_'+'a'.repeat(48)}}),env,fake);j=await r.json();
chk(r.status===200&&j.eventos.length===1&&j.siguiente===6,'con la clave: lee los eventos desde el último visto (paginado)');
r=await manejar(new Request('https://f/eventos',{method:'POST',body:JSON.stringify({accion:'borrar'})}),env,fake);chk(r.status===400,'otra acción: rechazada');
console.log(ok+' OK / '+bad+' FALLAN de '+(ok+bad));process.exit(bad?1:0);
