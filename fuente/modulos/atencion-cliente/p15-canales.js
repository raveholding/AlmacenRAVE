/* ===== V26.70 · CENTRO DE CANALES («Conectar con un clic») en Atención al cliente =====
   Cada canal tiene dos niveles, y se elige con un toque:
   · RÁPIDO (1 clic, gratis, sin cuentas técnicas): el sistema arma el botón/enlace oficial del canal (wa.me, ig.me, m.me, t.me,
     mailto, perfil de TikTok) con los datos que YA tiene (WhatsApp del comercio, redes del menú) y lo publica en el menú y en la app
     del Club. El cliente escribe en la app del canal; desde la bandeja se responde abriendo esa app con el texto listo.
   · INTEGRADO (los mensajes entran a la Bandeja y se responden desde acá): pasa por la función «canales» de Supabase. Los tokens
     viven SOLO como secretos del servidor; acá hay un asistente paso a paso con los enlaces exactos, botones para copiar y
     «Probar». Telegram queda conectado con un clic después de crear el bot. Meta (WhatsApp Business, Instagram, Messenger) usa
     una sola app de Meta para los tres. TikTok no tiene mensajería abierta para comercios: queda en rápido.
   · Tienda web = el chat cifrado del menú (ya integrado). Tiendanube = la conexión de pedidos y stock de Integraciones.
   Nada de esto guarda contraseñas ni tokens en el sistema ni en la auditoría. */
const CANAL_L=['web','wa','ig','fb','tg','mail','tt','tn'];
const CANAL_I={web:{t:'Tienda web y chat',ic:'🛍️',col:'#7a5a22',d:'Chat cifrado dentro del menú y la app del Club.',api:true},
 wa:{t:'WhatsApp Business',ic:'🟢',col:'#128c4a',d:'Botón de WhatsApp; integrado: los mensajes entran a la bandeja.',api:true,meta:true},
 ig:{t:'Instagram',ic:'📸',col:'#c13584',d:'Mensajes directos (DM) de tu cuenta profesional.',api:true,meta:true},
 fb:{t:'Facebook Messenger',ic:'🔵',col:'#1877f2',d:'Mensajes a tu página de Facebook.',api:true,meta:true},
 tg:{t:'Telegram',ic:'✈️',col:'#229ed9',d:'Bot propio del comercio para clientes.',api:true},
 mail:{t:'Correo electrónico',ic:'✉️',col:'#5b5b5b',d:'Consultas por mail en la misma bandeja.',api:true},
 tt:{t:'TikTok',ic:'🎵',col:'#111',d:'Botón a tu perfil para que te escriban.',api:false},
 tn:{t:'Tiendanube',ic:'🛒',col:'#2b4b9b',d:'Pedidos y stock de tu tienda online.',api:true}};
function canCfg(){const c=S.cfg.canales||(S.cfg.canales={});CANAL_L.forEach(k=>{if(!c[k]||typeof c[k]!=='object')c[k]={modo:'off'};});return c;}
const canRead=k=>((S.cfg.canales||{})[k])||{modo:'off'}; /* lectura sin modificar */
const canNube=()=>typeof CLOUD!=='undefined'&&CLOUD.on&&cl.ready&&cl.comercio;
const canFn=(accion,extra)=>hreq('/functions/v1/canales',{method:'POST',fn:true,body:Object.assign({accion,comercio:cl.comercio.id},extra||{})});
const canHandle=s=>String(s||'').trim().replace(/^https?:\/\/(www\.)?(instagram\.com|facebook\.com|fb\.com|tiktok\.com|t\.me|m\.me|ig\.me\/m)\//i,'').replace(/^@/,'').replace(/[/?#].*$/,'').replace(/[^\w.\-]/g,'').slice(0,60);
const canWa=s=>{const d=String(s||'').replace(/\D/g,'');if(d.length<8)return '';if(d.startsWith('549'))return d;if(d.startsWith('54'))return '549'+d.slice(2);return '549'+d.replace(/^0/,'').replace(/^(\d{2,4})15/,'$1').slice(-10);};
/* enlace oficial de cada canal en modo rápido */
function canLink(k,c){c=c||canRead(k);switch(k){case 'wa':return c.num?'https://wa.me/'+c.num:'';case 'ig':return c.user?'https://ig.me/m/'+c.user:'';case 'fb':return c.user?'https://m.me/'+c.user:'';
 case 'tg':return (c.bot||c.user)?'https://t.me/'+String(c.bot||c.user).replace(/^@/,''):'';case 'mail':return c.addr?'mailto:'+c.addr:'';case 'tt':return c.user?'https://www.tiktok.com/@'+c.user:'';default:return '';}}
/* bandeja oficial de cada app (para responder en modo rápido) */
const CAN_INBOX={wa:'https://web.whatsapp.com/',ig:'https://www.instagram.com/direct/inbox/',fb:'https://business.facebook.com/latest/inbox/all',tg:'https://web.telegram.org/',tt:'https://www.tiktok.com/messages'};
function canEstado(k){const c=canRead(k);
 if(k==='web'){const C=typeof crmCfg==='function'?crmCfg():{};return C.on&&C.web&&(C.chans||[]).includes('web')?'api':'off';}
 if(k==='tn'){const t=(typeof TNC!=='undefined'&&TNC.st)?TNC.st:null;if(t&&t.estado==='conectada')return 'api';if(typeof tnReal==='function'&&!tnReal()&&S.tn&&S.tn.conn)return 'api';return 'off';}
 return c.modo==='api'?'api':c.modo==='link'&&canLink(k,c)?'link':'off';}
function canOnList(){return CANAL_L.filter(k=>canEstado(k)!=='off');}
/* lo que se publica en el menú y en la app del Club (sólo enlaces públicos) */
function canalesPublic(){const out=[];['wa','ig','fb','tg','mail','tt'].forEach(k=>{if(canEstado(k)==='off')return;const u=canLink(k);if(u)out.push({k,t:CANAL_I[k].t,ic:CANAL_I[k].ic,url:u});});return out;}
/* el canal pasa a la lista de canales de Atención al cliente */
function canChansSync(){if(typeof crmSet!=='function')return;const C=crmCfg();const set=new Set(C.chans||[]);['wa','ig','fb','tg','mail','tt'].forEach(k=>{if(canEstado(k)!=='off')set.add(k);});crmSet({chans:[...set]});}
/* ---------- detección automática con los datos que ya tiene el sistema ---------- */
function canDetect(){const soc=((S.menu&&S.menu.social)||[]).filter(x=>x&&x.url&&x.on!==false&&!x.example);const by=k=>soc.find(x=>x.k===k);const d={};
 const w=canWa(S.tenant.wa);if(w)d.wa={num:w};
 const ig=by('instagram');if(ig)d.ig={user:canHandle(ig.handle||ig.url)};
 const fb=by('facebook');if(fb)d.fb={user:canHandle(fb.handle||fb.url)};
 const tt=by('tiktok');if(tt)d.tt={user:canHandle(tt.handle||tt.url)};
 const tg=by('telegram');if(tg)d.tg={user:canHandle(tg.handle||tg.url)};
 const em=(S.integ&&S.integ.google&&S.integ.google.account)||(S.tenant&&S.tenant.email)||'';if(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))d.mail={addr:em};
 Object.keys(d).forEach(k=>{Object.keys(d[k]).forEach(f=>{if(!d[k][f])delete d[k];});});return d;}
A.canTodo=()=>{if(!can('config'))return toast('Sólo el administrador',1);const d=canDetect();const c=canCfg();const hechos=[],faltan=[];
 Object.entries(d).forEach(([k,v])=>{if(!d[k])return;if(c[k].modo==='off'){Object.assign(c[k],v,{modo:'link'});hechos.push(CANAL_I[k].t);}});
 if(canEstado('web')==='off'&&typeof crmSet==='function'){crmSet({on:true,web:true,chans:[...new Set((crmCfg().chans||[]).concat(['web']))]});hechos.push(CANAL_I.web.t);}
 ['wa','ig','fb','tg','mail','tt'].forEach(k=>{if(canEstado(k)==='off')faltan.push(CANAL_I[k].t);});
 canChansSync();audit('CANALES_CONECTAR',hechos.length?'rápido: '+hechos.join(', '):'nada nuevo para conectar');save();if(typeof pubRefresh==='function')pubRefresh();rerender();
 modal('Conectar con un clic',`${hechos.length?`<div class="okbox">✓ Conectados: <b>${esc(hechos.join(', '))}</b></div>`:'<p>No encontré canales nuevos para conectar con los datos cargados.</p>'}
 ${faltan.length?`<p class="sm">Para <b>${esc(faltan.join(', '))}</b> falta un dato (usuario o dirección): tocá «Conectar» en cada uno.</p>`:''}<p class="sm mut">Los botones ya aparecen en el menú y en la app del Club (publicá el menú si trabajás con la nube). Para recibir los mensajes acá mismo, pasá cada canal a <b>Integrado</b>.</p>`,{okText:'Listo',noCancel:true});};
/* ---------- asistentes ---------- */
const canCopyBtn=(v,l)=>`<button type="button" class="btn sm" data-act="canCopy" data-v="${esc(v)}">📋 ${esc(l||'Copiar')}</button>`;
A.canCopy=el=>{const v=el.dataset.v;try{navigator.clipboard.writeText(v).then(()=>toast('Copiado'),()=>toast(v));}catch(e){toast(v);}};
A.canGen=el=>{const a=new Uint8Array(24);crypto.getRandomValues(a);const v=Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');const o=el.closest('.can-gen');o.querySelector('code').textContent=v;o.querySelector('[data-act=canCopy]').dataset.v=v;o.querySelector('[data-act=canCopy]').hidden=false;};
const canGenHtml=nm=>`<div class="can-gen row"><b>${esc(nm)}</b> = <code class="sp">—</code><button type="button" class="btn sm" data-act="canGen">🎲 Generar valor</button><button type="button" class="btn sm" data-act="canCopy" data-v="" hidden>📋 Copiar</button></div>`;
function canRef(){try{return new URL(CLOUD.url).hostname.split('.')[0];}catch(e){return '';}}
function canFnUrl(){return typeof CLOUD!=='undefined'&&CLOUD.url?CLOUD.url.replace(/\/$/,'')+'/functions/v1/canales':'';}
function canSecretsLink(){const r=canRef();return r?'https://supabase.com/dashboard/project/'+r+'/functions/secrets':'https://supabase.com/dashboard/projects';}
const canStep=(n,html)=>`<li class="can-st"><span class="can-n">${n}</span><div>${html}</div></li>`;
function canComunes(){const u=canFnUrl(),slug=typeof CLOUD!=='undefined'?CLOUD.slug:'';return `<div class="can-sec"><p class="sm">Una sola vez para todos los canales integrados: en Supabase → <a href="${esc(canSecretsLink())}" target="_blank" rel="noopener">Edge Functions → Secrets ↗</a> creá:</p>
 <div class="row"><b>CANALES_COMERCIO</b> = <code class="sp">${esc(slug||'código del comercio')}</code>${slug?canCopyBtn(slug):''}</div><div class="row"><b>FUNCTION_URL</b> = <code class="sp">${esc(u||'https://<proyecto>.supabase.co/functions/v1/canales')}</code>${u?canCopyBtn(u):''}</div>
 <p class="sm mut">Y desplegá la función <code>canales</code> (Edge Functions → Deploy, «Verify JWT» apagado) con los archivos de <code>supabase/functions/canales</code>.</p></div>`;}
function canPasosApi(k){const u=canFnUrl();
 if(k==='tg')return `<ol class="can-ol">${canStep(1,`Abrí <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather ↗</a> en Telegram, escribí <code>/newbot</code>, elegí el nombre (p. ej. «${esc(S.tenant.name)} Clientes») y copiá el <b>token</b> que te da.`)}
  ${canStep(2,`En Supabase → <a href="${esc(canSecretsLink())}" target="_blank" rel="noopener">Secrets ↗</a> pegá el token como <b>TG_CLIENTES_TOKEN</b> y creá:${canGenHtml('TG_CLIENTES_SECRET')}${canComunes()}`)}
  ${canStep(3,`Tocá <b>Conectar Telegram</b>: el sistema registra el bot (un clic). <button type="button" class="btn sm gold" data-act="canTgOn">✈️ Conectar Telegram</button>`)}
  ${canStep(4,`Tocá <b>Probar</b> y mandale «hola» a tu bot: aparece en la Bandeja.`)}</ol>`;
 if(['wa','ig','fb'].includes(k))return `<p class="sm mut">WhatsApp Business, Instagram y Messenger usan <b>la misma app de Meta</b>: si ya conectaste uno, saltá al paso 4.</p><ol class="can-ol">
  ${canStep(1,`Entrá a <a href="https://developers.facebook.com/apps/create/" target="_blank" rel="noopener">Meta for Developers → Crear app ↗</a> (tipo <b>Empresa</b>) con la cuenta comercial del local y agregá el producto ${k==='wa'?'<b>WhatsApp</b>':k==='ig'?'<b>Instagram</b> (mensajes)':'<b>Messenger</b>'}.`)}
  ${canStep(2,`En <b>Webhooks</b> pegá la URL y el token de verificación:<div class="row"><b>URL</b> <code class="sp">${esc(u?u+'?c=meta':'(con la nube)')}</code>${u?canCopyBtn(u+'?c=meta'):''}</div>${canGenHtml('META_VERIFY_TOKEN')}<p class="sm mut">Suscribí el campo <b>messages</b>${k==='wa'?'':' (y <b>messaging_postbacks</b>)'}.</p>`)}
  ${canStep(3,`En Supabase → <a href="${esc(canSecretsLink())}" target="_blank" rel="noopener">Secrets ↗</a> cargá <b>META_VERIFY_TOKEN</b> (el mismo valor), <b>META_APP_SECRET</b> (Configuración de la app → Básica → Clave secreta) y ${k==='wa'?'<b>WA_TOKEN</b> + <b>WA_PHONE_ID</b> (WhatsApp → Configuración de la API)':'<b>META_PAGE_TOKEN</b> (token de la página vinculada'+(k==='ig'?' a tu Instagram profesional':'')+')'}.${canComunes()}`)}
  ${canStep(4,`Tocá <b>Probar</b>. Si da ✓, los mensajes nuevos entran solos a la Bandeja y se responden desde acá (Meta permite responder dentro de las 24 h del último mensaje del cliente).`)}</ol>`;
 if(k==='mail')return `<ol class="can-ol">${canStep(1,`<b>Para recibir:</b> reenviá tu correo de consultas a la función. Creá ${canGenHtml('MAIL_IN_SECRET')} y configurá el reenvío entrante (Postmark Inbound, Mailgun Routes o Cloudflare Email Routing) hacia:<div class="row"><code class="sp">${esc(u?u+'?c=mail&k=<MAIL_IN_SECRET>':'(con la nube)')}</code></div>`)}
  ${canStep(2,`<b>Para responder:</b> creá una cuenta en <a href="https://resend.com/" target="_blank" rel="noopener">Resend ↗</a> (gratis hasta 3.000 correos/mes), verificá tu dominio y cargá <b>RESEND_API_KEY</b> y <b>MAIL_FROM</b> (p. ej. «${esc(S.tenant.name)} &lt;hola@tudominio.com&gt;») en <a href="${esc(canSecretsLink())}" target="_blank" rel="noopener">Secrets ↗</a>.${canComunes()}`)}
  ${canStep(3,`Tocá <b>Probar</b> y mandate un correo de prueba.`)}</ol>`;
 return '';}
function canFormRapido(k){const c=canRead(k);const D=canDetect()[k]||{};const v=(f)=>esc(c[f]||D[f]||'');
 const f={wa:`<label for="cn-v">Número de WhatsApp Business (con código de área)</label><input id="cn-v" inputmode="tel" value="${v('num')}" placeholder="387 4574892">`,
  ig:`<label for="cn-v">Usuario de Instagram</label><input id="cn-v" value="${v('user')}" placeholder="@tu_cuenta o el enlace del perfil">`,
  fb:`<label for="cn-v">Página de Facebook</label><input id="cn-v" value="${v('user')}" placeholder="nombre de la página o su enlace">`,
  tg:`<label for="cn-v">Usuario o bot de Telegram</label><input id="cn-v" value="${esc(c.bot||c.user||D.user||'')}" placeholder="@tu_usuario">`,
  mail:`<label for="cn-v">Correo para consultas</label><input id="cn-v" type="email" value="${v('addr')}" placeholder="hola@tucomercio.com">`,
  tt:`<label for="cn-v">Usuario de TikTok</label><input id="cn-v" value="${v('user')}" placeholder="@tu_cuenta">`}[k];
 return f+(D&&Object.keys(D).length?'<p class="sm ok">✓ Lo completé con los datos que ya están en el sistema.</p>':'');}
A.canAbrir=el=>{const k=el.dataset.k;if(!CANAL_I[k])return;if(!can('config'))return toast('Sólo el administrador conecta canales',1);
 if(k==='web'){crmSet({on:true,web:true,chans:[...new Set((crmCfg().chans||[]).concat(['web']))]});audit('CANALES_CONECTAR','tienda web y chat');save();if(typeof pubRefresh==='function')pubRefresh();rerender();return toast('Chat de la tienda web activado ✓');}
 if(k==='tn'){if(typeof tnReal==='function'&&tnReal()&&typeof A.tnConnect==='function')return A.tnConnect();if(typeof A.tnSimConnect==='function'&&!(typeof tnReal==='function'&&tnReal())){A.tnSimConnect();setTimeout(rerender,100);return;}return go('integ');}
 const I=CANAL_I[k],c=canRead(k);const nube=canNube();let modo=c.modo==='api'?'api':'link';
 const body=()=>`<div class="can-modes" role="radiogroup" aria-label="Forma de conexión"><label class="can-mode ${modo==='link'?'on':''}"><input type="radio" name="cn-m" value="link" ${modo==='link'?'checked':''}><b>⚡ Rápido</b><span>1 clic · gratis. Publica el botón oficial en el menú y la app. Respondés desde la app de ${esc(I.t.split(' ')[0])}.</span></label>
 ${I.api?`<label class="can-mode ${modo==='api'?'on':''}"><input type="radio" name="cn-m" value="api" ${modo==='api'?'checked':''} ${nube?'':'disabled'}><b>🔗 Integrado</b><span>Los mensajes entran a la Bandeja y se responden desde acá.${nube?'':' Requiere la nube.'}</span></label>`:`<div class="can-mode off"><b>🔗 Integrado</b><span>${esc(I.t)} no ofrece mensajería abierta para comercios: queda el botón directo.</span></div>`}</div>
 <div id="cn-body">${modo==='api'?canPasosApi(k):canFormRapido(k)}</div>`;
 const w=modal('Conectar '+I.t,body(),{wide:true,okText:modo==='api'?'Probar y activar':'Conectar',onOk:async()=>{
   const cc=canCfg()[k];
   if(modo==='link'){const raw=val('cn-v').trim();let v='';if(k==='wa')v=canWa(raw);else if(k==='mail')v=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)?raw.toLowerCase():'';else v=canHandle(raw);
    if(!v){toast(k==='wa'?'Escribí el número con código de área.':k==='mail'?'Escribí un correo válido.':'Escribí el usuario.',1);return false;}
    if(k==='wa')cc.num=v;else if(k==='mail')cc.addr=v;else if(k==='tg'){cc.user=v;}else cc.user=v;cc.modo=cc.modo==='api'?'api':'link';
    canChansSync();audit('CANALES_CONECTAR',I.t+' · rápido');save();if(typeof pubRefresh==='function')pubRefresh();rerender();toast(I.t+' conectado ✓ · '+canLink(k));return;}
   const r=await canProbar(k);if(!r.ok){toast(I.t+': '+(r.msg||'todavía no responde'),1);return false;}
   cc.modo='api';if(r.link&&k==='tg')cc.bot=r.link.replace('https://t.me/','');cc.ok={ts:now(),msg:String(r.msg||'').slice(0,80)};
   canChansSync();audit('CANALES_CONECTAR',I.t+' · integrado');save();if(typeof pubRefresh==='function')pubRefresh();rerender();toast(I.t+' integrado ✓');}});
 w.addEventListener('change',e=>{if(e.target.name==='cn-m'){modo=e.target.value;w.querySelector('.mb').innerHTML=body();const ok=w.querySelector('[data-m=ok]');if(ok)ok.textContent=modo==='api'?'Probar y activar':'Conectar';}});};
async function canProbar(k){if(!canNube())return{ok:false,msg:'disponible con la nube'};try{const r=await canFn('probar',{canal:k});return r||{ok:false};}catch(e){return{ok:false,msg:String(e&&e.message||e).slice(0,120)};}}
A.canTgOn=async el=>{el.disabled=true;try{const r=await canFn('tg_conectar');const c=canCfg().tg;c.bot=String(r.bot||'').replace('@','');toast('Telegram conectado: '+r.bot);audit('CANALES_CONECTAR','Telegram · webhook del bot '+r.bot);save();}catch(e){toast('No se pudo: '+String(e&&e.message||e).slice(0,140),1);}el.disabled=false;};
A.canOff=el=>{const k=el.dataset.k;if(!can('config'))return;const I=CANAL_I[k];confirmBox('Desconectar '+I.t,'Deja de mostrarse en el menú y en la app del Club. Las conversaciones anteriores quedan guardadas.',()=>{
 if(k==='web')crmSet({web:false});else if(k==='tn'){$$('#modal-root .ov').forEach(o=>o.remove());if(typeof A.tnDisc==='function')return A.tnDisc();return go('integ');}else{canCfg()[k].modo='off';}
 audit('CANALES_DESCONECTAR',I.t);save();if(typeof pubRefresh==='function')pubRefresh();rerender();},'Desconectar');};
A.canProbarBtn=async el=>{const k=el.dataset.k;el.disabled=true;const r=await canProbar(k);el.disabled=false;const c=canCfg()[k];c.ok={ts:now(),ok:!!r.ok,msg:String(r.msg||r.error||'').slice(0,80)};save();rerender();toast(CANAL_I[k].t+': '+(r.msg||(r.ok?'funciona':'no responde')),!r.ok);};
/* ---------- pantalla ---------- */
function canalesHTML(){const adm=can('config');const on=canOnList();const n=on.length,tot=CANAL_L.length;
 const card=k=>{const I=CANAL_I[k],st=canEstado(k),c=canRead(k);const u=k==='web'?((window.RAVE_BUILD&&RAVE_BUILD.publicUrl)||''):canLink(k);
  const tag=st==='api'?'<span class="tag ok">● Integrado</span>':st==='link'?'<span class="tag warn">● Botón activo</span>':'<span class="tag">○ Sin conectar</span>';
  return `<article class="can-card ${st}" style="--cc:${I.col}"><div class="row"><span class="can-ic" aria-hidden="true">${I.ic}</span><b class="sp">${esc(I.t)}</b>${tag}</div><p class="sm mut">${esc(I.d)}</p>
  ${u&&st!=='off'?`<p class="sm can-u">${esc(u.replace(/^mailto:/,''))}</p>`:''}${c.ok&&c.ok.msg?`<p class="sm ${c.ok.ok===false?'neg':''}">${c.ok.ok===false?'✗':'✓'} ${esc(c.ok.msg)}</p>`:''}
  ${adm?`<div class="row">${st==='off'?`<button class="btn gold sm" data-act="canAbrir" data-k="${k}">Conectar</button>`:`<button class="btn sm" data-act="canAbrir" data-k="${k}">${st==='link'&&I.api&&k!=='tn'?'Pasar a integrado':'Ver / cambiar'}</button>${st==='api'&&!['web','tn'].includes(k)?`<button class="btn sm" data-act="canProbarBtn" data-k="${k}">Probar</button>`:''}<button class="btn sm ghost" data-act="canOff" data-k="${k}">Desconectar</button>`}</div>`:''}</article>`;};
 return `<div class="card can-head"><div class="row"><div class="sp"><h3 style="margin:0">Canales conectados: ${n} de ${tot}</h3><div class="can-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${n}"><i style="width:${Math.round(n/tot*100)}%"></i></div></div>
 ${adm?'<button class="btn gold" data-act="canTodo">⚡ Conectar todo con un clic</button>':''}</div><p class="sm mut">«Conectar todo» usa el WhatsApp del comercio y las redes cargadas en el menú: publica los botones oficiales al instante. Para recibir y responder desde la Bandeja, pasá cada canal a <b>Integrado</b> (asistente paso a paso; las claves quedan sólo en el servidor).</p></div>
 <div class="can-grid">${CANAL_L.map(card).join('')}</div>`;}
