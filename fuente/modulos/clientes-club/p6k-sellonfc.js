/* ===== V26.67 · Sello con el celular del cliente: chip NFC (y QR) en el mostrador =====
   El negocio pega en el mostrador un chip NFC (sticker NTAG213/215) grabado con el enlace de un «punto de sello»
   (…/#sello=p<token>) y, al lado, el MISMO enlace en QR para los celulares sin NFC.
   El cliente acerca su celular → se abre el menú → toma la tarjeta del Club guardada en ESE celular → arma su código
   de un solo uso (RAVE2|tarjeta|código, el de siempre) → lo manda cifrado con la llave pública del comercio.
   El sistema del mostrador (abierto, con la nube) lo descifra y lo valida igual que si el cajero lo hubiera escaneado
   (vencimiento, un solo uso, un sello cada 24 h). Según la configuración lo aprueba solo o le pregunta al cajero.
   Sin la tarjeta en el celular no hay sello: el chip copiado o el enlace compartido no sirven solos.
   Si el cliente no tiene celular o tarjeta, el sello se da desde el sistema como siempre (DNI, código, QR o tarjeta NFC).
   Servidor: supabase/25-sello-nfc-mostrador.sql. ===== */
const SNF_TOK=/^p[A-Za-z0-9_-]{16,40}$/;
function snfCfg(){const c=S.cfg.selloNfc=Object.assign({mode:'aprobar',puntos:[]},S.cfg.selloNfc||{});if(!Array.isArray(c.puntos))c.puntos=[];return c;}
const snfLink=t=>PUBLIC_URL().split('#')[0]+'#sello='+t;
const snfB64u=u=>b64(u).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const snfIco=(s=18)=>typeof nfcIco==='function'?nfcIco(s):'';

/* ---------- configuración (administrador) ---------- */
function selloNfcCardHtml(){if(!user)return'';const c=snfCfg();const adm=isAdm()||can('config');const P=c.puntos;
 return `<div class="card" id="snf-card" style="margin-top:1rem"><h3>${snfIco(18)} Sello con el celular del cliente (chip NFC en el mostrador)</h3>
 <p class="sm mut">El cliente acerca su celular al chip del mostrador (o escanea el QR de al lado si su celular no tiene NFC) y pide su sello. El sistema lo valida con su tarjeta del Club: el chip solo, copiado o compartido, no da sellos. Si no tiene celular o tarjeta, el sello se da desde el sistema como siempre (DNI, código, QR o tarjeta NFC).</p>
 ${typeof CLOUD!=='undefined'&&CLOUD.on?'':'<p class="sm"><span class="tag warn">Demo</span> Acá funciona simulado en este equipo. En el sistema real el pedido viaja por la nube y lo valida el mostrador.</p>'}
 <h4>¿Quién confirma el sello?</h4>
 <div class="bm-grid" id="snf-mode">${[['aprobar','Con aprobación del cajero (recomendado)','Aparece un aviso «Juan pide su sello · Aprobar / Rechazar». Así sólo suma quien compró.'],['auto','Automático','Se suma solo si la tarjeta es válida (un sello cada 24 h). Más rápido, pero no controla que haya comprado.']].map(([k,t,d])=>`<label class="bm-opt ${c.mode===k?'on':''}"><input type="radio" name="snf-mode" value="${k}" ${c.mode===k?'checked':''} ${adm?'':'disabled'} data-act="snfMode"><span><b>${t}</b><br><span class="sm mut">${d}</span></span></label>`).join('')}</div>
 <h4>Puntos de sello</h4>
 ${P.length?`<div class="tw"><table data-nosort><thead><tr><th>Punto</th><th>Enlace para el chip y el QR</th><th>Estado</th><th></th></tr></thead><tbody>${P.map(p=>`<tr><td><b>${esc(p.nombre)}</b></td><td><code class="snf-link">${esc(snfLink(p.token))}</code></td><td>${p.activo?'<span class="tag ok">Activo</span>':'<span class="tag">Desactivado</span>'}</td><td class="r nb-acts"><button class="btn sm" data-act="snfCopy" data-t="${esc(p.token)}">Copiar enlace</button><button class="btn sm gold" data-act="snfPoster" data-t="${esc(p.token)}">Cartel con QR</button>${adm?`<button class="btn sm ${p.activo?'red':''}" data-act="snfToggle" data-t="${esc(p.token)}">${p.activo?'Desactivar':'Activar'}</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="sm mut">Todavía no hay puntos de sello.</p>'}
 ${adm?'<div class="row"><button class="btn gold" data-act="snfAdd">Crear punto de sello</button></div>':''}
 <details class="gs-how"><summary><b>Cómo grabar el chip</b> (una sola vez, con cualquier celular con NFC)</summary><ol class="sm">
 <li>Comprá stickers o llaveros NFC <b>NTAG213 o NTAG215</b> (los más comunes; sirven también los de 13,56 MHz «para celular»).</li>
 <li>Instalá la app gratuita <b>NFC Tools</b> (Android o iPhone).</li>
 <li>En el sistema tocá <b>Copiar enlace</b> del punto y mandátelo al celular (WhatsApp a vos mismo, por ejemplo).</li>
 <li>En NFC Tools: <b>Escribir → Agregar un registro → URL / URI</b> → pegá el enlace → <b>Escribir</b> → apoyá el chip en la parte trasera del celular.</li>
 <li>Opcional: <b>Otros → Bloquear la etiqueta</b>, para que nadie la regrabe. Ojo: es definitivo.</li>
 <li>Probalo: acercá un celular con la tarjeta del Club guardada. Tiene que abrirse el menú pidiendo el sello.</li>
 <li>Pegá el chip en el mostrador junto al <b>Cartel con QR</b> impreso (para los celulares sin NFC).</li></ol>
 <p class="sm mut">iPhone: lee chips NFC desde el iPhone XS en adelante sin abrir ninguna app (en el 7, 8 y X, desde el Centro de control). Android: con el NFC encendido. Para que funcione, el sistema del mostrador tiene que estar abierto y con la nube conectada.</p></details></div>`;}
document.addEventListener('change',e=>{const t=e.target;if(t&&t.name==='snf-mode'&&t.closest('#snf-card'))A.snfMode(t);});
A.snfMode=el=>{if(!(isAdm()||can('config')))return;const v=el.value||((el.querySelector&&el.querySelector('input:checked'))||{}).value;if(!['aprobar','auto'].includes(v))return;const c=snfCfg();if(c.mode===v)return;
 c.mode=v;audit('SELLO_CHIP_MODO',v==='auto'?'automático':'con aprobación del cajero');save();rerender();toast(v==='auto'?'Los sellos por chip se aprueban solos':'Los sellos por chip los aprueba el cajero');};
async function snfServerSave(p){if(typeof CLOUD==='undefined'||!CLOUD.on)return;
 await rpc('sello_punto_guardar',{p_comercio:cl.comercio.id,p_token:p.token,p_nombre:p.nombre,p_activo:p.activo});}
const snfErr=e=>{const m=typeof errTxt==='function'?errTxt(e):String(e&&e.message||e);return /sello_punto_guardar|PGRST202|Could not find|sello_puntos/i.test(m)?'Falta instalar en la nube el sello por chip (25-sello-nfc-mostrador.sql en el SQL Editor de Supabase).':m;};
A.snfAdd=()=>{if(!(isAdm()||can('config')))return toast('Sólo el administrador',1);const n=snfCfg().puntos.length;
 modal('Crear punto de sello',`<label for="snf-n">Nombre del punto</label><input id="snf-n" maxlength="60" value="${n?'Mostrador '+(n+1):'Mostrador'}"><p class="sm mut">Uno por cada lugar donde pegues un chip (por ejemplo «Mostrador», «Caja 2», «Delivery»).</p>`,
 {okText:'Crear',onOk:async w=>{const nombre=val('snf-n').trim().slice(0,60)||'Mostrador';const p={token:'p'+snfB64u(rnd(18)),nombre,activo:true};
  try{await snfServerSave(p);}catch(e){w._err(snfErr(e));return false;}
  snfCfg().puntos.push(p);audit('SELLO_CHIP_PUNTO','crea «'+nombre+'»');save();rerender();toast('Punto de sello creado: copiá el enlace para grabar el chip');}});};
A.snfToggle=async el=>{if(!(isAdm()||can('config')))return;const p=snfCfg().puntos.find(x=>x.token===el.dataset.t);if(!p)return;const nv=Object.assign({},p,{activo:!p.activo});
 try{await snfServerSave(nv);}catch(e){return toast(snfErr(e),1);}p.activo=nv.activo;audit('SELLO_CHIP_PUNTO',(p.activo?'activa':'desactiva')+' «'+p.nombre+'»');save();rerender();toast(p.activo?'Punto activado':'Punto desactivado: el chip y el QR dejan de dar sellos');};
A.snfCopy=el=>{const l=snfLink(el.dataset.t);try{navigator.clipboard.writeText(l);toast('Enlace copiado: pegalo en NFC Tools para grabar el chip');}catch(e){toast(l);}};
A.snfPoster=el=>{const p=snfCfg().puntos.find(x=>x.token===el.dataset.t);if(!p)return;const l=snfLink(p.token);const qr=QR.svg(l,6,2);const nm=esc((S.tenant&&(S.tenant.legal||S.tenant.name))||'Club');
 const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sumá tu sello</title><style>@page{size:A5;margin:12mm}body{font-family:system-ui,Arial,sans-serif;text-align:center;color:#111}h1{font-size:30px;margin:6px 0}h2{font-size:18px;font-weight:600;margin:4px 0 14px}.qr svg{width:62mm;height:62mm}.st{display:flex;gap:10px;justify-content:center;margin:12px 0;font-size:15px}.b{border:2px solid #111;border-radius:12px;padding:8px 12px}.mut{color:#555;font-size:12px;margin-top:12px}</style></head><body>
 <h2>${nm}</h2><h1>⭐ Sumá tu sello</h1><div class="st"><div class="b">📱 Acercá tu celular<br><b>al chip</b></div><div class="b">o escaneá<br><b>el QR</b></div></div><div class="qr">${qr}</div>
 <p>Necesitás tu tarjeta del Club guardada en el celular.<br>¿No la tenés? Sumate desde el menú o pedile tu sello al cajero con tu DNI.</p><p class="mut">${esc(p.nombre)}</p></body></html>`;
 modal('Cartel · '+p.nombre,`<div class="snf-poster">${qr}</div><p class="sm">Imprimilo (A5) y pegalo junto al chip. El QR abre el mismo enlace que el chip, para celulares sin NFC.</p><p class="sm"><code class="snf-link">${esc(l)}</code></p>`,{okText:'Imprimir',onOk:()=>{xfPrint(html);}});};

/* ---------- mostrador: recibir, validar y resolver los pedidos ---------- */
const snfPend=new Map(); // id del pedido → {cust,v,p,ts,punto}
function snfPunto(t){const p=snfCfg().puntos.find(x=>x.token===t);return p?p.nombre:'chip';}
async function snfResolve(id,estado,detalle){try{await rpc('sello_resolver',{p_comercio:cl.comercio.id,p_id:id,p_estado:estado,p_detalle:String(detalle||'').slice(0,160)});}catch(e){}}
/* valida el código del celular igual que si el cajero lo escaneara (devuelve el resultado de verifyStampCode) */
function snfCheck(p){if(!p||typeof p.code!=='string')return{ok:false,msg:'Pedido inválido.'};
 const v=verifyStampCode(p.code,'');if(!v.ok)return v;if(v.cust&&v.cust.consent&&v.cust.consent.club===false)return{ok:false,msg:'Ese cliente no está adherido al Club.'};return v;}
function snfApprove(cid,v,punto){commitStamp(cid,v,'chip NFC · '+punto);save();const n=stampsOf(cid),g=S.loyalty.goal;const ok=n%g===0&&n>0;
 if(typeof pubRefresh==='function')pubRefresh();
 return 'Tenés '+(n%g||(ok?g:0))+' de '+g+' sellos'+(ok?' · ¡premio disponible!':'');}
let snfBusy=false;
async function selloImport(){if(snfBusy||typeof CLOUD==='undefined'||!CLOUD.on||!cl.ready||!cl.online||!cl.clubPriv||!cl.clubPriv.jwk)return;
 if(!snfCfg().puntos.some(p=>p.activo))return;snfBusy=true;
 try{const rows=await sel(`sello_pedidos?select=id,cifrado,creado,estado&comercio_id=eq.${cl.comercio.id}&estado=in.(nuevo,espera)&order=id&limit=40`);
  for(const r of rows){const age=Date.now()-Date.parse(r.creado||'');
   if(age>6*60000){snfPend.delete(r.id);await snfResolve(r.id,'vencido','Nadie lo confirmó a tiempo: pedile el sello al cajero.');continue;}
   if(snfPend.has(r.id))continue;
   if(r.estado==='espera'&&snfCfg().mode!=='aprobar')continue;
   let p;try{p=await rsaOpen(cl.clubPriv.jwk,r.cifrado);}catch(e){await snfResolve(r.id,'rechazado','No se pudo leer el pedido.');continue;}
   const v=snfCheck(p);if(!v.ok){await snfResolve(r.id,'rechazado',v.msg);continue;}
   const punto=snfPunto(p.p);
   if(snfCfg().mode==='auto'){const d=snfApprove(v.cust.id,v,punto);await snfResolve(r.id,'aprobado',d);toast('⭐ Sello por chip: '+v.custName+' · '+d);if(typeof nfcBeep==='function')nfcBeep(true);continue;}
   snfPend.set(r.id,{cust:v.cust.id,name:v.custName,v,punto,ts:Date.now()});await snfResolve(r.id,'espera','');if(typeof nfcBeep==='function')nfcBeep(true);}
  snfPaint();}catch(e){}finally{snfBusy=false;}}
function snfPaint(){let box=$('#snf-q');for(const[id,x]of snfPend)if(Date.now()-x.ts>6*60000)snfPend.delete(id);
 if(!snfPend.size||!user||$('#panel').hidden){if(box)box.remove();return;}
 if(!box){box=document.createElement('div');box.id='snf-q';box.setAttribute('role','region');box.setAttribute('aria-label','Pedidos de sello');document.body.appendChild(box);}
 box.innerHTML=[...snfPend].map(([id,x])=>`<div class="snf-it" role="alert"><div>${snfIco(18)} <b>${esc(x.name)}</b> pide su sello<br><span class="sm mut">${esc(x.punto)} · ${hm(x.ts)} · ${stampsOf(x.cust)%S.loyalty.goal}/${S.loyalty.goal}</span></div><div class="row"><button class="btn sm gold" data-act="snfOk" data-id="${id}">Aprobar</button><button class="btn sm" data-act="snfNo" data-id="${id}">Rechazar</button></div></div>`).join('');}
A.snfOk=async el=>{const id=+el.dataset.id,x=snfPend.get(id);if(!x)return;snfPend.delete(id);snfPaint();
 const c=custById(x.cust);if(!c||c.status==='baja'){await snfResolve(id,'rechazado','Tarjeta dada de baja.');return toast('Ese cliente fue dado de baja',1);}
 const lim=stampLimit(c);if(!lim.ok){await snfResolve(id,'rechazado',lim.msg);return toast(lim.msg,1);}
 if(x.v.key&&S.loyalty.usedOtp[x.v.key]){await snfResolve(id,'rechazado','Ese código ya se usó.');return toast('Ese código ya se usó',1);}
 const d=snfApprove(x.cust,x.v,x.punto);audit('SELLO_CHIP',x.name+' · aprobado');await snfResolve(id,'aprobado',d);toast('⭐ Sello para '+x.name+' · '+d);if(curScreen==='fidel'||curScreen==='inicio')rerender();};
A.snfNo=async el=>{const id=+el.dataset.id,x=snfPend.get(id);if(!x)return;snfPend.delete(id);snfPaint();audit('SELLO_CHIP',x.name+' · rechazado');await snfResolve(id,'rechazado','El negocio no confirmó el sello. Consultá en el mostrador.');toast('Pedido de sello rechazado');};
setInterval(()=>{if(typeof CLOUD!=='undefined'&&CLOUD.on&&cl.ready&&user&&!$('#panel').hidden&&!document.hidden)selloImport();else snfPaint();},6000);

/* ---------- celular del cliente: #sello=p<token> ---------- */
function selloRoute(h){const m=/^#sello=(p[A-Za-z0-9_-]{16,40})$/.exec(h);try{history.replaceState(null,'',location.href.split('#')[0]+'#menu');}catch(e){location.hash='#menu';}
 $('#panel').hidden=true;$('#login').hidden=true;showMenu();
 if(!m)return toast('El enlace del punto de sello no es válido.',1);setTimeout(()=>selloPedir(m[1]),350);}
function snfBox(t,html,opts={}){const ov=$('#snf-ov');if(ov){const o=ov.closest('.ov');(o||ov).remove();}const w=modal(t,`<div class="snf-pub" id="snf-ov" aria-live="polite">${html}</div>`,Object.assign({okText:'Cerrar',noCancel:true},opts));return w;}
async function selloPedir(tok){const cloud=typeof CLOUD!=='undefined'&&CLOUD.on;
 const id=typeof LS!=='undefined'?LS.get('rave.card'):'',sec=typeof LS!=='undefined'?LS.get('rave.cardsec'):'';
 const local=!cloud?(custByCard(id)||null):null;
 if(!id||(cloud&&!sec)||(!cloud&&!local))return snfBox('Sumá tu sello',`<div class="nfc-ring">${snfIco(40)}</div><p><b>Todavía no tenés tu tarjeta del Club en este celular.</b></p><p class="sm">Sumate gratis desde el menú (te lleva un minuto) y volvé a acercar el celular. Si ya tenés tarjeta en otro celular, abrí ese o pedile tu sello al cajero con tu DNI.</p>`,{okText:'Sumarme al Club',onOk:()=>{location.hash='#mitarjeta';}});
 const last=(()=>{try{return JSON.parse(LS.get('rave.sello')||'null');}catch(e){return null;}})();
 if(last&&last.t===tok&&Date.now()-last.ts<6*60000&&last.ref)return selloEsperar(last.ref,true);
 if(!cloud){/* demo: el mostrador y el menú comparten este equipo */const c=local,w=otpWin(now());const v=verifyStampCode(cardIdOk(id)?'RAVE2|'+id+'|'+otpFor(c,w,id):pad4(c.num)+otpFor(c,w),'');
  if(!v.ok)return snfBox('Sumá tu sello',`<p>❌ ${esc(v.msg)}</p>`);const d=snfApprove(c.id,v,snfPunto(tok));
  return snfBox('¡Sello sumado!',`<div class="snf-ok">⭐</div><p><b>${esc(d)}</b></p><p class="sm mut">Demo: en el sistema real el pedido llega al mostrador${snfCfg().mode==='aprobar'?' y el cajero lo aprueba':' y se aprueba solo'}.</p>`);}
 snfBox('Sumá tu sello',`<div class="nfc-ring">${snfIco(40)}</div><p>Enviando tu pedido…</p>`);
 try{if(!snapC()||!snapC().clubkey)await loadPubSnap();const key=snapC()&&snapC().clubkey;if(!key)throw new Error('Este negocio todavía no activó el Club en la nube.');
  const otp=otpFor({id,secret:sec},otpWin(now()),id);const ref=snfB64u(rnd(18));
  const box=await rsaSeal(key,{code:'RAVE2|'+id+'|'+otp,ref,p:tok,ts:Date.now()});
  const r=await rpc('club_pedir_sello',{p_slug:CLOUD.slug,p_punto:tok,p_ref:ref,p_cifrado:box},{auth:false});
  if(!r||!r.ok)throw new Error((r&&r.error)||'No se pudo enviar el pedido');
  LS.set('rave.sello',JSON.stringify({t:tok,ref,ts:Date.now()}));selloEsperar(ref);}
 catch(e){snfBox('Sumá tu sello',`<p>❌ ${esc(e.message||'No se pudo enviar el pedido. ¿Hay internet?')}</p><p class="sm">Podés pedirle el sello al cajero con tu DNI o mostrando tu tarjeta.</p>`);}}
async function selloEsperar(ref,again){const t0=Date.now();snfBox('Sumá tu sello',`<div class="nfc-ring">${snfIco(40)}</div><p><b>${again?'Ya pediste tu sello.':'¡Pedido enviado!'}</b> Esperando que el negocio lo confirme…</p><p class="sm mut">Podés guardar el celular: si el cajero lo aprueba, el sello aparece en tu tarjeta.</p>`);
 const tick=async()=>{const ov=$('#snf-ov');if(!ov)return;let r=null;try{r=await rpc('club_sello_estado',{p_slug:CLOUD.slug,p_ref:ref},{auth:false});}catch(e){}
  const st=r&&r.estado;
  if(st==='aprobado'){LS.del('rave.sello');try{if(typeof cardPoll==='function')cardPoll();}catch(e){}return snfBox('¡Sello sumado!',`<div class="snf-ok">⭐</div><p><b>${esc(r.detalle||'Tu sello quedó en la tarjeta.')}</b></p><p class="sm mut">¡Gracias por tu compra!</p>`,{okText:'Ver mi tarjeta',onOk:()=>{location.hash='#mitarjeta';}});}
  if(st==='rechazado'||st==='vencido'){LS.del('rave.sello');return snfBox('Sumá tu sello',`<p>❌ ${esc(r.detalle||(st==='vencido'?'Nadie lo confirmó a tiempo.':'No se pudo sumar el sello.'))}</p><p class="sm">Pedile el sello al cajero con tu DNI o mostrando tu tarjeta.</p>`);}
  if(Date.now()-t0>6*60000)return snfBox('Sumá tu sello','<p>⏳ El negocio no respondió todavía. Pedile el sello al cajero.</p>');
  setTimeout(tick,3000);};
 setTimeout(tick,2000);}
