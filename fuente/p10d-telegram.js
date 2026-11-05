/* =====================================================================
   R2AVE EN TELEGRAM (@R2aveBot) · V26.52 · prompt 4.35
   Sólo en Almacén RAVE (real, con la nube) y en raveV3 (demo: SIMULACIÓN rotulada, sin conexión).
   Kini y raveV2 no llevan este módulo (build.py).
   · Lo usan sólo ADMINISTRADORES: cada uno vincula su Telegram con un código de un solo uso (10 min).
   · El bot consulta y, si el administrador lo habilita por unas horas, corrige stock en dos pasos y con límites.
   · El navegador nunca ve el token del bot ni el secreto del webhook: están en los secretos de Supabase.
   ===================================================================== */
const TG_BOT='R2aveBot';
const TGC={st:null,at:0,loading:false,err:'',down:false,sql:false,code:null,sim:[]};
const tgReal=()=>!!(IS_CLIENT&&typeof CLOUD!=='undefined'&&CLOUD.on&&cl.ready&&cl.comercio);
const tgFn=(accion)=>hreq('/functions/v1/telegram',{method:'POST',fn:true,body:{accion,comercio:cl.comercio.id}});
const tgH=v=>v?new Date(v).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}):'—';
const TG_HORAS=[[0,'Apagadas'],[1,'1 hora'],[4,'4 horas'],[8,'8 horas'],[24,'24 horas']];

(function(){if(typeof document==='undefined'||document.getElementById('tg-css'))return;const s=document.createElement('style');s.id='tg-css';
 s.textContent='.tgchat{border:1px solid var(--line,#ddd);border-radius:12px;padding:.6rem;max-height:340px;overflow:auto;background:var(--bg2,rgba(127,127,127,.06))}.tgb{max-width:88%;margin:.3rem 0;padding:.45rem .65rem;border-radius:10px;white-space:pre-wrap;line-height:1.35;font-size:.92rem}.tgb.yo{margin-left:auto;background:var(--gold,#c9a227);color:#111}.tgb.bot{background:var(--card,#fff);border:1px solid var(--line,#ddd)}.tgb .tgk{display:inline-block;margin:.3rem .3rem 0 0;padding:.2rem .5rem;border:1px solid var(--line,#ccc);border-radius:8px;font-size:.85rem}.tgcode{font:700 1.6rem/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.2em}';
 document.head.appendChild(s);})();

async function tgRefresh(force){
 if(TGC.loading||!tgReal())return;if(!force&&TGC.st&&Date.now()-TGC.at<20000)return;TGC.loading=true;
 try{TGC.st=await tgFn('estado');TGC.err='';TGC.down=false;TGC.sql=false;}
 catch(e){TGC.st=null;TGC.down=true;TGC.sql=!!(e&&e.body&&e.body.falta_sql);
  TGC.err=TGC.sql?'Falta correr 18-telegram.sql en Supabase (SQL Editor). Ver los pasos de abajo.':(e&&e.status===403)?String(e.message||'Sólo el administrador'):(e&&(e.status===404||e.net||e instanceof NetErr))?'La función «telegram» todavía no está instalada en tu Supabase o no responde (ver los pasos).':String((e&&e.message)||e);}
 finally{TGC.loading=false;TGC.at=Date.now();if(curScreen==='config'&&!document.querySelector('#modal-root .ov'))rerender();}}

function tgPasos(st){st=st||{};const fal=st.faltan||[];return[
 {t:'Base de datos: correr <code>18-telegram.sql</code> en Supabase → SQL Editor',done:!!st.vinculos},
 {t:'Crear la función <code>telegram</code> en Supabase → Edge Functions (con «Verify JWT» <b>apagado</b>)',done:!!TGC.st},
 {t:'Cargar los secretos en Supabase → Edge Functions → Secrets: <code>TELEGRAM_BOT_TOKEN</code> (de @BotFather), <code>TELEGRAM_WEBHOOK_SECRET</code>, <code>TG_COMERCIO</code> = <code>almacen-rave</code>; opcional <code>ANTHROPIC_API_KEY</code>. <b>El token no se manda por chat ni se escribe en el sistema.</b>',done:!!TGC.st&&!fal.length},
 {t:'Conectar el bot (botón «Conectar con Telegram»)',done:!!(st.webhook&&st.webhook.conectado)},
 {t:'Vincular tu Telegram de administrador',done:(st.vinculos||[]).some(v=>v.yo)},
 {t:'Opcional: grupo de alertas (agregá @'+TG_BOT+' al grupo y escribí <code>/alertas_aqui</code>)',done:!!st.alertas_chat}];}

function tgCfgCard(){if(!isAdm())return'';
 const head=tag=>`<div class="row"><h3 class="sp" style="margin:0">R2AVE en Telegram <span class="sm mut">@${TG_BOT}</span></h3>${tag||''}</div>`;
 if(!IS_CLIENT)return tgSimCard(head);
 if(!tgReal())return `<div class="card" id="tg-card" style="margin-top:1rem">${head('<span class="tag sim">REQUIERE LA NUBE</span>')}<p class="sm mut">El bot lee los datos de la nube del comercio. Con la nube sin configurar no se puede conectar.</p></div>`;
 if(!TGC.loading&&!TGC.down&&(!TGC.st||Date.now()-TGC.at>30000))setTimeout(()=>tgRefresh(true),0);
 const st=TGC.st;
 const pasos=`<ol class="sm" style="list-style:none;padding:0">${tgPasos(st).map((s,i)=>`<li style="margin:.35rem 0"><span class="tag ${s.done?'ok':''}">${s.done?'✔':'○ '+(i+1)}</span> ${s.t}</li>`).join('')}</ol>`;
 if(!st)return `<div class="card" id="tg-card" style="margin-top:1rem">${head(`<span class="tag warn">${TGC.down?'Sin respuesta':'Consultando…'}</span>`)}${TGC.err?`<div class="warnbox sm">${esc(TGC.err)}</div>`:''}${pasos}<div class="row"><button class="btn" data-act="tgReload">Volver a consultar</button></div></div>`;
 const wh=st.webhook||{},on=!!st.activo,fal=st.faltan||[];
 const tag=!fal.length&&wh.conectado?(on?'<span class="tag ok">Encendido</span>':'<span class="tag">Apagado</span>'):'<span class="tag warn">Pendiente de configuración</span>';
 const yo=(st.vinculos||[]).find(v=>v.yo);
 const ajH=st.ajuste_on&&st.ajuste_hasta?new Date(st.ajuste_hasta).getTime():0;
 return `<div class="card" id="tg-card" style="margin-top:1rem">${head(tag)}
 <p class="sm mut">El bot es sólo para administradores. Consulta ventas, stock, cajas, cierres y deudas de clientes (por número: los nombres viajan cifrados) y, si lo habilitás por unas horas, corrige stock en dos pasos. Todo queda en Auditoría.</p>
 ${fal.length?`<div class="warnbox sm">Faltan secretos en Supabase: <b>${fal.map(esc).join(', ')}</b>.</div>`:''}
 ${wh.ultimo_error?`<div class="warnbox sm">Último error de Telegram (${esc(tgH(wh.ultimo_error_fecha))}): ${esc(wh.ultimo_error)}</div>`:''}
 <details ${fal.length||!wh.conectado||!yo?'open':''}><summary class="sm"><b>Pasos de instalación</b></summary>${pasos}</details>
 <div class="row" style="flex-wrap:wrap;gap:.5rem;margin:.5rem 0">
  <button class="btn ${wh.conectado?'':'gold'}" data-act="tgConectar" ${fal.length?'disabled':''}>${wh.conectado?'Reconectar':'Conectar con Telegram'}</button>
  <button class="btn ${yo?'':'gold'}" data-act="tgVincular" ${on?'':'disabled title="Encendé el bot primero"'}>${yo?'Vincular otro Telegram':'Vincular mi Telegram'}</button>
  <button class="btn" data-act="tgReload">Actualizar</button></div>
 <label class="chk"><input type="checkbox" id="tg-on" ${on?'checked':''}> Bot encendido</label>
 <div class="grid g2">
  <div><label for="tg-h">Correcciones de stock por Telegram</label><select id="tg-h">${ajH?`<option value="" selected>Mantener (hasta ${esc(tgH(ajH))})</option>`:''}${TG_HORAS.map(([h,t])=>`<option value="${h}">${h?'Permitir por '+t:(ajH?'Apagarlas ahora':t)}</option>`).join('')}</select>
   <p class="sm ${ajH?'':'mut'}">${ajH?'Permitidas hasta <b>'+esc(tgH(ajH))+'</b>':'Apagadas'} · hoy: ${+st.correcciones_hoy||0} de ${+st.max_dia||0}</p></div>
  <div><label for="tg-mu">Máximo por corrección (unidades)</label><input id="tg-mu" inputmode="decimal" value="${esc(numAR(+st.max_unidades||0,3))}"></div>
  <div><label for="tg-mv">Máximo por corrección (valor a costo, $)</label><input id="tg-mv" inputmode="decimal" value="${esc(pesosStr(+st.max_valor||0))}"></div>
  <div><label for="tg-md">Máximo de correcciones por día</label><input id="tg-md" inputmode="numeric" value="${+st.max_dia||10}"></div></div>
 <label class="chk"><input type="checkbox" id="tg-ia" ${st.ia?'checked':''}> Responder preguntas en lenguaje natural con IA (sólo redacta con los números del sistema; no cambia nada)</label>
 ${st.ia&&!st.ia_lista?'<p class="sm warnbox">Para la IA falta el secreto <code>ANTHROPIC_API_KEY</code> en Supabase. Mientras tanto el bot responde con los comandos.</p>':''}
 <div class="grid g2"><div><label for="tg-im">Consultas con IA por día (todas las personas)</label><input id="tg-im" inputmode="numeric" value="${+st.ia_max_dia||0}"></div><div></div></div>
 <label class="chk"><input type="checkbox" id="tg-al" ${st.alertas?'checked':''}> Mandar alertas al grupo (stock bajo, diferencias de caja al cerrar, deudas vencidas)</label>
 <p class="sm mut">Grupo de alertas: ${st.alertas_chat?'<b>elegido</b> · <button class="btn sm" data-act="tgProbar">Probar alertas</button> <button class="btn sm" data-act="tgQuitarGrupo">Quitar grupo</button>':'todavía no hay: agregá @'+TG_BOT+' al grupo y escribí <code>/alertas_aqui</code>.'}</p>
 <div class="row"><button class="btn gold" data-act="tgSave">Guardar</button></div>
 <h4>Telegram vinculados</h4><div class="tw"><table><thead><tr><th>Telegram</th><th>Usuario del sistema</th><th>Desde</th><th>Último uso</th><th></th></tr></thead><tbody>${(st.vinculos||[]).map(v=>`<tr><td>${esc(v.tg_nombre||'')}${v.yo?' <span class="tag ok">vos</span>':''}</td><td>${esc(v.usuario)}</td><td>${esc(tgH(v.alta))}</td><td>${esc(tgH(v.ultimo_uso))}</td><td class="r"><button class="btn sm danger" data-act="tgDesv" data-id="${esc(v.tg_user_id)}">Desvincular</button></td></tr>`).join('')||'<tr><td colspan="5" class="mut">Nadie vinculado todavía.</td></tr>'}</tbody></table></div>
 <h4>Últimas acciones desde Telegram</h4><div class="tw"><table><thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${(st.acciones||[]).map(a=>`<tr><td>${esc(tgH(+a.ts))}</td><td>${esc(a.user||'')}</td><td>${esc(a.action||'')}</td><td class="sm">${esc(a.detail||'')}</td></tr>`).join('')||'<tr><td colspan="4" class="mut">Sin acciones todavía.</td></tr>'}</tbody></table></div>
 </div>`;}

const tgErr=e=>toast(String((e&&e.message)||e||'No se pudo completar'),1);
A.tgReload=()=>{TGC.down=false;tgRefresh(true);};
A.tgConectar=async()=>{if(!isAdm())return;try{toast('Conectando con Telegram…');await tgFn('conectar');audit('TELEGRAM_CONECTAR','webhook de @'+TG_BOT);toast('Bot conectado');}catch(e){tgErr(e);}tgRefresh(true);};
A.tgProbar=async()=>{if(!isAdm())return;try{const r=await tgFn('probar_alertas');toast('Alertas enviadas al grupo: '+(+r.enviadas||0));}catch(e){tgErr(e);}};
A.tgSave=async()=>{if(!isAdm()||!TGC.st)return;const st=TGC.st;const p={activo:$('#tg-on').checked,ia:$('#tg-ia').checked,alertas:$('#tg-al').checked};
 const hv=String(val('tg-h'));if(hv!==''&&(+hv>0||st.ajuste_on))p.horas=+hv;
 const mu=parseNum(val('tg-mu'));if(!(mu>0)||mu>10000)return toast('Máximo de unidades: mayor a 0.',1);p.max_unidades=Math.round(mu*1000)/1000;
 const mv=cents(val('tg-mv'));if(!(mv>0))return toast('Máximo de valor: mayor a cero.',1);p.max_valor=mv;
 const md=parseInt(val('tg-md'),10);if(!(md>=1&&md<=100))return toast('Correcciones por día: de 1 a 100.',1);p.max_dia=md;
 const im=parseInt(val('tg-im'),10);if(!(im>=0&&im<=500))return toast('Consultas con IA por día: de 0 a 500.',1);p.ia_max_dia=im;
 try{TGC.st=Object.assign({},TGC.st,await rpc('tg_admin_guardar',{p_comercio:cl.comercio.id,p}));toast('R2AVE en Telegram guardado');}catch(e){tgErr(e);}rerender();};
A.tgQuitarGrupo=()=>confirmBox('Quitar grupo de alertas','El bot deja de mandar alertas a ese grupo. ¿Seguimos?',async()=>{try{TGC.st=Object.assign({},TGC.st,await rpc('tg_admin_guardar',{p_comercio:cl.comercio.id,p:{quitar_grupo:true,alertas:false}}));}catch(e){tgErr(e);}rerender();},'Quitar');
A.tgDesv=el=>{const id=el.dataset.id;confirmBox('Desvincular Telegram','Ese Telegram deja de poder usar el bot hasta que se vuelva a vincular. ¿Seguimos?',async()=>{try{TGC.st=Object.assign({},TGC.st,await rpc('tg_admin_desvincular',{p_comercio:cl.comercio.id,p_tg_user:String(id)}));toast('Desvinculado');}catch(e){tgErr(e);}rerender();},'Desvincular');};
A.tgVincular=async()=>{if(!isAdm())return;let r;try{r=await rpc('tg_codigo_crear',{p_comercio:cl.comercio.id});}catch(e){return tgErr(e);}
 const c=String(r.codigo||'');const link='https://t.me/'+TG_BOT+'?start='+encodeURIComponent(c);
 modal('Vincular mi Telegram',`<p>Abrí <b>@${TG_BOT}</b> desde tu Telegram y tocá <b>Iniciar</b>, o mandale:</p><p class="tgcode">/vincular ${esc(c)}</p>
  <p class="sm mut">El código sirve una sola vez y vence a las ${esc(tgH(r.vence))} (10 minutos). No lo compartas: quien lo use queda con tu acceso al bot.</p>
  <div class="row"><button class="btn gold" data-act="tgAbrir" data-u="${esc(link)}">Abrir @${TG_BOT}</button></div>`,{okText:'Listo',onOk:()=>{tgRefresh(true);}});};
A.tgAbrir=el=>{const u=String(el.dataset.u||'');if(/^https:\/\/t\.me\/R2aveBot\?start=[A-Z0-9]{8}$/.test(u))openExternal(u);};

/* ---------------- demo raveV3: simulación rotulada con los datos de esta demo ---------------- */
function tgSimAns(cmd){const ok=s=>s&&s.status==='ok';const hoy=dkey(now());
 const V=S.sales.filter(s=>ok(s)&&dkey(s.ts)===hoy);const tot=V.reduce((a,s)=>a+s.total,0);
 const low=S.products.filter(p=>!p.archived&&p.active!==false&&!(typeof isKit==='function'&&isKit(p))&&stockOf(p)<=5);
 if(cmd==='/resumen')return{t:'Resumen de hoy\nVentas: '+money(tot)+' en '+V.length+' tickets\nStock bajo: '+low.length+' artículos'};
 if(cmd==='/ventas hoy'){const m={};V.forEach(s=>(s.pays&&s.pays.length?s.pays:[{m:s.method,a:s.total}]).forEach(p=>{m[p.m]=(m[p.m]||0)+p.a;}));
  return{t:'Ventas · hoy\nTotal: '+money(tot)+' · '+V.length+' tickets'+Object.entries(m).map(([k,a])=>'\n• '+(MET[k]||k)+': '+money(a)).join('')};}
 if(cmd==='/bajo_stock')return{t:low.length?'Stock bajo: 5 o menos ('+low.length+')\n'+low.slice(0,10).map(p=>'• '+p.name+(p.sub?' '+p.sub:'')+': '+stockTxt(p)).join('\n'):'Ningún artículo tiene stock bajo.'};
 if(cmd==='/fiado'){let t=0,n=0;(S.customers||[]).forEach(c=>{if(typeof ccByKind!=='function')return;const k=ccByKind(c.id);const d=k.fiado+k.cc;if(d>0){t+=d;n++;}});return{t:n?'Deudas de clientes: '+money(t)+' ('+n+' clientes)\nLos nombres viajan cifrados: el bot habla de clientes por número.':'Ningún cliente debe.'};}
 if(cmd==='/corregir_stock'){const p=S.products.find(x=>!x.archived&&x.unit==='u'&&!(typeof isKit==='function'&&isKit(x)))||S.products[0];if(!p)return{t:'No hay artículos.'};const f=Math.max(0,Math.round(stockOf(p))+2);
  return{y:'/corregir_stock '+p.name+' = '+f+' ; conteo físico',t:'Revisá antes de confirmar\nArtículo: '+p.name+(p.sub?' '+p.sub:'')+'\nStock registrado: '+stockTxt(p)+' → físico '+f+'\nVence en 5 minutos. Sólo vos podés confirmarla.',k:['✅ Confirmar','Cancelar']};}
 return{t:'Consultas: /resumen · /ventas · /top · /medios · /margen · /stock · /bajo_stock · /sin_rotacion · /caja · /cierres · /fiado · /alertas · /corregir_stock'};}
function tgSimCard(head){
 const chat=TGC.sim.slice(-12).map(m=>`<div class="tgb ${m.yo?'yo':'bot'}">${esc(m.t)}${m.k?'<div>'+m.k.map(k=>`<span class="tgk">${esc(k)}</span>`).join('')+'</div>':''}</div>`).join('')||'<p class="sm mut" style="margin:.4rem">Tocá un comando para ver qué responde el bot con los datos de esta demo.</p>';
 return `<div class="card" id="tg-card" style="margin-top:1rem">${head('<span class="tag sim">SIMULADO</span>')}
 <div class="warnbox sm"><b>Demostración.</b> El bot real funciona en Almacén RAVE, sólo para administradores. Acá no hay conexión con Telegram: las respuestas se calculan con los datos de ejemplo de esta demo y no se cambia nada.</div>
 <div class="tgchat" aria-live="polite">${chat}</div>
 <div class="row" style="flex-wrap:wrap;gap:.4rem;margin-top:.5rem">${['/resumen','/ventas hoy','/bajo_stock','/fiado','/corregir_stock','/ayuda'].map(c=>`<button class="btn sm" data-act="tgSim" data-c="${c}">${c}</button>`).join('')}</div>
 <p class="sm mut">En el sistema real: cada administrador vincula su Telegram con un código de un solo uso; las correcciones de stock se habilitan por 1, 4, 8 o 24 horas, con límites (24 unidades, $ 50.000 a costo, 10 por día) y confirmación en dos pasos; las alertas van a un grupo.</p></div>`;}
A.tgSim=el=>{const c=String(el.dataset.c||'');const r=tgSimAns(c);TGC.sim.push({yo:true,t:r.y||c});TGC.sim.push({t:r.t,k:r.k});rerender();};
/* la tarjeta va en Configuración, antes de «Respaldo» (sin tocar p4-mods: Kini y raveV2 quedan idénticos) */
if(typeof SCREENS!=='undefined'&&SCREENS.config&&!SCREENS.config._tg){const r0=SCREENS.config.render;
 SCREENS.config.render=function(){const h=r0.apply(this,arguments);const c=tgCfgCard();if(!c)return h;const i=h.indexOf('<div class="card" style="margin-top:1rem"><h3>Respaldo</h3>');return i>=0?h.slice(0,i)+c+h.slice(i):h+c;};SCREENS.config._tg=1;}
if(typeof module!=='undefined'&&module.exports)module.exports={tgPasos,tgSimAns};
