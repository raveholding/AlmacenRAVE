// node --experimental-strip-types mpago_test.mjs · webhook de Mercado Pago Point con firma y la API simulada
import { manejar, firmaOk } from './handler.ts';
let ok=0,bad=0;const chk=(c,m)=>{console.log((c?'OK   ':'FALLA ')+m);c?ok++:bad++;};
const te=new TextEncoder();const hx=async(k,m)=>{const key=await crypto.subtle.importKey('raw',te.encode(k),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(m))),x=>x.toString(16).padStart(2,'0')).join('');};
const env={SUPABASE_URL:'https://p.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'srv',MP_ACCESS_TOKEN:'APP_USR-x',MP_WEBHOOK_SECRET:'s3cr3t',MP_COMERCIO:'almacen-rave'};
let guardado=null,leido=0;
const fake=async(url,o={})=>{const R=(b,s=200)=>new Response(JSON.stringify(b),{status:s});
 if(url.includes('/v1/payments/987654')){leido++;return R({id:987654,status:'approved',transaction_amount:1500.5,transaction_details:{net_received_amount:1455.49},payment_type_id:'debit_card',point_of_interaction:{type:'POINT',device:{serial_number:'PAX-123'}},external_reference:'V-0042',date_approved:'2026-11-14T10:00:00Z',payer:{email:'x@y.com'},card:{last_four_digits:'1234'}});}
 if(url.includes('/rest/v1/comercios'))return R([{id:'c1'}]);
 if(url.includes('/rest/v1/mp_pagos')){guardado=JSON.parse(o.body);return new Response(null,{status:201});}
 return R({},404);};
const ts=String(Math.floor(Date.now()/1000));const rq='req-1';const v1=await hx('s3cr3t',`id:987654;request-id:${rq};ts:${ts};`);
const call=(sig,id='987654',e=env)=>manejar(new Request(`https://f/mpago?c=webhook&data.id=${id}&type=payment`,{method:'POST',headers:{'x-signature':sig,'x-request-id':rq},body:JSON.stringify({type:'payment',data:{id}})}),e,fake);
let r=await call(`ts=${ts},v1=${v1}`);
chk(r.status===200&&guardado&&guardado.monto===150050&&guardado.neto===145549&&guardado.terminal==='PAX-123'&&guardado.referencia==='V-0042'&&guardado.estado==='approved','pago de Point guardado en centavos con terminal y referencia');
chk(!JSON.stringify(guardado).includes('1234')&&!JSON.stringify(guardado).includes('x@y.com'),'no guarda datos de la tarjeta ni del pagador');
guardado=null;r=await call(`ts=${ts},v1=${'0'.repeat(64)}`);chk(r.status===401&&!guardado,'firma falsa: rechazada');
r=await call(`ts=${Math.floor(Date.now()/1000)-3600},v1=${await hx('s3cr3t',`id:987654;request-id:${rq};ts:${Math.floor(Date.now()/1000)-3600};`)}`);chk(r.status===401,'firma vieja (más de 10 min): rechazada');
r=await call(`ts=${ts},v1=${v1}`,'987654',{...env,MP_ACCESS_TOKEN:''});chk(r.status===503,'sin configurar: no hace nada');
r=await manejar(new Request('https://f/mpago',{method:'POST',body:JSON.stringify({accion:'estado'})}),{...env,MP_WEBHOOK_SECRET:''},fake);chk((await r.json()).configurado===false,'estado: apagada');
chk(await firmaOk('s3cr3t',`ts=${ts},v1=${v1}`,rq,'987654'),'plantilla oficial de firma «id;request-id;ts»');
console.log(ok+' OK / '+bad+' FALLAN de '+(ok+bad));process.exit(bad?1:0);
