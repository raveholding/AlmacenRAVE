/* =====================================================================
   TIENDANUBE (V26.13) + PASOS PARA CONECTAR LAS INTEGRACIONES
   Con la nube del comercio configurada, todo pasa por la función "tiendanube" del servidor:
   el navegador no ve nunca el token de la tienda ni el secreto de la app.
   Sin nube (demo) la conexión es una SIMULACIÓN rotulada, con datos de ejemplo.
   ===================================================================== */
const TNC={st:null,prods:null,ords:null,at:0,busy:'',err:'',tab:'resumen',filt:'pendientes',loading:false,fnDown:false};
const tnReal=()=>!!(CLOUD.on&&cl.ready);
const tnSimS=()=>{if(!S.tn)S.tn={conn:false,store:'',cfg:{stock_fuente:'sistema',precio_fuente:'off',importar_ordenes:true},prods:[],ords:[],last:0,seq:0};return S.tn;};
const TN_ESTADO_ORD={open:'Abierta',closed:'Cerrada',cancelled:'Cancelada'};
const TN_ESTADO_PAGO={pending:'Pago pendiente',authorized:'Pago autorizado',paid:'Pagada',partially_paid:'Pago parcial',abandoned:'Abandonada',refunded:'Reembolsada',partially_refunded:'Reembolso parcial',voided:'Anulada'};
const TN_ESTADO_ENV={unpacked:'Sin empacar',unshipped:'Sin enviar',partially_packed:'Empaque parcial',shipped:'Enviada',delivered:'Entregada',partially_fulfilled:'Envío parcial'};
const tnFn=(accion,extra)=>hreq('/functions/v1/tiendanube',{method:'POST',fn:true,body:Object.assign({accion,comercio:cl.comercio.id},extra||{})});
const tnWhen=t=>t?new Date(t).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}):'—';
const tnStockTxt=v=>v===null||v===undefined?'ilimitado':numAR(+v,0);

/* ---------- estado (real o simulado) ---------- */
function tnSimState(){const t=tnSimS();const vinc=t.prods.filter(p=>p.vinculo==='vinculado').length;
 return{estado:t.conn?'conectada':'desconectada',store_id:t.conn?t.store:null,config:t.cfg,ultima_sync:t.last||null,ultimo_error:null,app_configurada:true,sim:true,
  productos:{total:t.prods.length,vinculados:vinc,sugeridos:t.prods.filter(p=>p.vinculo==='sugerido').length,sin_vincular:t.prods.filter(p=>p.vinculo==='sin_vincular').length},
  ordenes:{total:t.ords.length,pendientes:t.ords.filter(o=>o.venta_estado==='pendiente'&&o.estado!=='cancelled').length,por_cobrar:t.ords.filter(o=>o.venta_estado==='pendiente'&&o.pago_estado!=='paid').length},eventos_error:0,
  url_webhook:'(simulado)',url_callback:'(simulado)'};}
async function tnRefresh(force){
 if(TNC.loading)return;if(!force&&TNC.st&&Date.now()-TNC.at<20000)return;TNC.loading=true;
 try{
  if(tnReal()){
   if(!can('config')&&user&&user.role!=='supervisor'){TNC.st={estado:'sin_permiso'};TNC.at=Date.now();return;}
   TNC.st=await tnFn('estado');TNC.fnDown=false;TNC.err='';
   if(TNC.st.estado==='conectada'){
    TNC.prods=await sel('tn_productos?comercio_id=eq.'+cl.comercio.id+'&select=variant_id,product_id,sku,barcode,nombre,precio_cents,stock,producto_local,vinculo&order=nombre&limit=1000');
    TNC.ords=await rpc('tn_ordenes_listar',{p_comercio:cl.comercio.id,p_limite:100});
   }else{TNC.prods=[];TNC.ords=[];}
  }else{const t=tnSimS();TNC.st=tnSimState();TNC.prods=t.prods;TNC.ords=t.ords;}
 }catch(e){
  if(tnReal()){TNC.st=null;TNC.fnDown=true;TNC.err=(e&&e.status===404)?'La función «tiendanube» todavía no está instalada en tu Supabase (ver paso 4).':(e&&e.net)?'No se pudo contactar a la función «tiendanube»: sin conexión, o todavía no está instalada en tu Supabase (ver paso 4).':(e&&e.message)||'No se pudo consultar Tiendanube.';}
 }finally{TNC.loading=false;TNC.at=Date.now();if(curScreen==='integ'&&!document.querySelector('#modal-root .ov'))rerender();}}

/* ---------- pasos de conexión (todas las integraciones) ---------- */
const INT_QUIEN={vos:'Lo hacés vos',vb:'Lo hace Vincular Business',prov:'Lo hace el proveedor'};
function tnPasos(){const st=TNC.st||{},real=tnReal();
 const ok=(c)=>!!c;
 return[
  {t:'Tener la nube del sistema funcionando',q:'vb',d:'Es el servidor propio del comercio (Supabase). Sin esto Tiendanube sólo funciona como simulación de prueba.',done:ok(real||st.sim)},
  {t:'Crear la aplicación en el Portal de Socios de Tiendanube',q:'vb',d:'Se crea una app (tipo «privada» para un solo comercio, o pública) y se obtienen el <b>ID de la app</b> y el <b>secreto</b>. En «URL de redirección» va la dirección de conexión que figura abajo. Permisos de lectura de productos y órdenes, y de escritura de productos si querés que el sistema actualice stock/precio [VERIFICAR nombres de permisos en el portal].',done:ok(st.app_configurada&&!st.sim)||!!st.sim},
  {t:'Cargar los secretos en el servidor',q:'vb',d:'<code>TN_APP_ID</code>, <code>TN_CLIENT_SECRET</code>, <code>TN_MASTER_KEY</code> (32 bytes en base64) y <code>APP_URL</code> (la dirección de este sistema). Se cargan por el panel de Supabase, nunca en el HTML, nunca por chat.',done:ok(st.app_configurada&&!st.sim)||!!st.sim},
  {t:'Instalar la función y la migración',q:'vb',d:'Ejecutar <code>13-tiendanube.sql</code> y desplegar la función <code>tiendanube</code> («Verify JWT» apagado: la función valida la sesión adentro). Esta pantalla lo detecta sola.',done:ok(!TNC.fnDown&&(st.app_configurada||st.sim))},
  {t:'Autorizar la tienda',q:'vos',d:'Tocás <b>Conectar tienda</b>, iniciás sesión en Tiendanube con el usuario dueño de la tienda y aceptás los permisos. Volvés acá solo. El código dura 5 minutos.',done:st.estado==='conectada'},
  {t:'Traer los productos y vincularlos',q:'vos',d:'<b>Traer productos</b> sugiere el vínculo por código de barras; vos confirmás cada uno. Un producto del sistema se vincula con <b>una</b> sola variante de la tienda.',done:!!(st.productos&&st.productos.vinculados>0)},
  {t:'Elegir quién manda sobre el stock y el precio',q:'vos',d:'Por defecto manda el sistema para el stock y nadie para el precio. Podés apagarlo todo y usar la integración sólo para ver las órdenes.',done:st.estado==='conectada'&&!!(st.config&&st.config.stock_fuente)},
  {t:'Recibir las órdenes y registrarlas como ventas',q:'vos',d:'Las órdenes llegan solas (avisos de Tiendanube) o con <b>Traer órdenes</b>. Una orden <b>nunca</b> crea una venta sola: la registrás vos cuando está paga, con una caja abierta.',done:!!(st.ordenes&&st.ordenes.total>0)}
 ];}
const INT_PASOS={
 nube:{t:'Nube del sistema (Supabase)',steps:[
  ['Crear el proyecto en Supabase y anotar la URL y la clave <b>publicable</b>','vb'],['Pegar <code>INSTALAR-TODO.sql</code> en el editor SQL y ejecutarlo una vez','vb'],['Desactivar «Confirm email» en Authentication','vb'],['Publicar el sistema con la URL y la clave publicable (nunca la clave <code>secret</code>)','vb'],['Crear el comercio desde el primer equipo y <b>guardar el código de recuperación</b> (se muestra una sola vez)','vos'],['Agregar equipos y personas desde Usuarios y permisos','vos']]},
 arca:{t:'Facturación electrónica (ARCA)',steps:[
  ['Tener la nube configurada y la función <code>arca</code> desplegada','vb'],['Cargar los datos del emisor (CUIT, razón social, condición frente al IVA, punto de venta «Web Services»)','vos'],['Generar la clave y el pedido de certificado (CSR) desde Administración → ARCA','vos'],['Crear el certificado en el sitio de ARCA con tu clave fiscal y pegarlo acá','vos'],['Autorizar el servicio de facturación y probar la conexión en homologación','vos'],['Recién con la prueba aprobada, pasar a producción','vos']]},
 mp:{t:'Mercado Pago',steps:[
  ['Tener una cuenta de vendedor y crear una aplicación en su panel de desarrolladores','prov'],['Cargar el Access Token como secreto del servidor (nunca en el HTML)','vb'],['Registrar la URL del webhook firmada','vb'],['Probar en sandbox: aprobado, rechazado, pendiente y aviso repetido','vb'],['Pasar a producción con una compra real chica','vos']],pend:true},
 modo:{t:'MODO',steps:[
  ['Habilitar MODO con tu banco o procesadora','prov'],['Cargar las credenciales como secreto del servidor','vb'],['Registrar el webhook y probar en sandbox','vb']],pend:true},
 pya:{t:'PedidosYa',steps:[
  ['Pedir el acceso a la API de integración a PedidosYa','prov'],['Cargar las credenciales en el servidor y registrar el webhook','vb'],['Probar con un pedido de prueba antes de abrirlo al público','vos']],pend:true},
 google:{t:'Google (Drive y Gmail)',steps:[
  ['Crear el proyecto en Google Cloud y la pantalla de consentimiento','vb'],['Cargar el ID y secreto de cliente como secretos del servidor','vb'],['Cada comercio autoriza su propia cuenta con permisos mínimos (<code>drive.file</code>, enviar correo)','vos']],pend:true},
 wa:{t:'WhatsApp Business (envío automático)',steps:[
  ['Tener una cuenta de WhatsApp Business verificada en Meta','prov'],['Aprobar las plantillas de mensaje','prov'],['Cargar el token como secreto del servidor y registrar el webhook','vb']],pend:true}
};
function intPasosHtml(){
 const li=(s,i,done)=>`<li style="margin:.35rem 0"><span class="tag ${done?'ok':''}">${done?'✔ hecho':'○ '+(i+1)}</span> ${s.t||s[0]} <span class="tag" style="opacity:.75">${INT_QUIEN[s.q||s[1]]}</span>${s.d?`<div class="sm mut">${s.d}</div>`:''}</li>`;
 const dn={nube:tnReal()};
 return `<div class="card" style="margin-top:1rem"><div class="row"><h3 class="sp">Pasos para conectar cada integración</h3></div><p class="sm mut">Cada conexión tiene pasos que hacés vos, pasos que hace Vincular Business en el servidor y pasos que depende del proveedor. Los secretos <b>nunca</b> se cargan en este archivo.</p>
 ${Object.keys(INT_PASOS).map(k=>{const g=INT_PASOS[k];return `<details style="margin:.4rem 0"><summary style="min-height:44px;cursor:pointer"><b>${g.t}</b>${g.pend&&IS_CLIENT?' <span class="tag warn">pendiente de configuración</span>':''}</summary><ol class="sm" style="list-style:none;padding:0">${g.steps.map((s,i)=>li(s,i,k==='nube'&&i<4&&dn.nube)).join('')}</ol></details>`;}).join('')}</div>`;}

/* ---------- tarjeta de Tiendanube ---------- */
function tnCard(){
 if(!tnReal()){const t=tnSimS();TNC.st=tnSimState();TNC.prods=t.prods;TNC.ords=t.ords;TNC.fnDown=false;}
 else if(!TNC.loading&&!TNC.fnDown&&(!TNC.st||Date.now()-TNC.at>30000))setTimeout(()=>tnRefresh(true),0);
 const st=TNC.st,adm=can('config'),sim=!tnReal(),real=tnReal();
 const q=new URLSearchParams(location.search);if(q.get('tn')){const ok=q.get('tn')==='ok';setTimeout(()=>{toast(ok?'Tienda de Tiendanube conectada.':'No se pudo conectar: '+(q.get('motivo')||'error'),!ok);history.replaceState(null,'',location.pathname+location.hash);TNC.at=0;tnRefresh(true);},50);}
 const head=(tag)=>`<div class="row"><h3 class="sp">Tiendanube</h3>${sim?`<span class="tag sim">${IS_CLIENT?'REQUIERE LA NUBE':'SIMULADO'}</span>`:''}${tag}</div>`;
 if(sim&&IS_CLIENT)return `<div class="card" style="margin-top:1rem" id="tn-card">${head('<span class="tag warn">Pendiente de configuración</span>')}<p class="sm mut">Para conectar tu tienda de Tiendanube el sistema necesita la nube del comercio (la integración corre en el servidor, no en este archivo). Seguí los pasos de abajo.</p></div>`;
 if(!st){return `<div class="card" style="margin-top:1rem" id="tn-card">${head('<span class="tag warn">'+(TNC.fnDown?'Sin respuesta de la función':'Consultando…')+'</span>')}${TNC.err?`<div class="warnbox">${esc(TNC.err)}</div>`:'<p class="sm mut">Consultando el estado…</p>'}
  <ol class="sm" style="list-style:none;padding:0">${tnPasos().map((s,i)=>`<li style="margin:.3rem 0"><span class="tag ${s.done?'ok':''}">${s.done?'✔':'○'}</span> ${s.t} <span class="tag" style="opacity:.75">${INT_QUIEN[s.q]}</span></li>`).join('')}</ol><button class="btn" data-act="tnReload">Volver a consultar</button></div>`;}
 if(st.estado==='sin_permiso')return `<div class="card" style="margin-top:1rem" id="tn-card">${head('')}<p class="sm mut">Tu rol no administra la integración con Tiendanube.</p></div>`;
 const con=st.estado==='conectada',cfg=st.config||{},P=st.productos||{},O=st.ordenes||{};
 const tagE=`<span class="tag ${con?'ok':st.estado==='revocada'?'bad':''}">${con?'Conectada · tienda '+esc(String(st.store_id)):st.estado==='revocada'?'La tienda desinstaló la app':'Desconectada'}</span>`;
 const tab=(k,t,n)=>`<button class="btn ${TNC.tab===k?'gold':''}" data-act="tnTab" data-k="${k}" style="min-height:44px">${t}${n?` <span class="tag">${n}</span>`:''}</button>`;
 let body='';
 if(!con){
  body=`${st.estado==='revocada'?'<div class="warnbox">La tienda quitó la aplicación. Podés volver a conectarla.</div>':''}
   ${!st.app_configurada?'<div class="warnbox">El servidor todavía no tiene cargados los datos de la app de Tiendanube (pasos 2 y 3). Mientras tanto no se puede autorizar.</div>':''}
   ${sim?'<div class="warnbox"><b>Conexión simulada.</b> En la demo se crean productos y órdenes de <b>ejemplo</b> para mostrar el flujo; no se contacta a Tiendanube.</div>':''}
   <ol class="sm" style="list-style:none;padding:0">${tnPasos().map((s,i)=>`<li style="margin:.4rem 0"><span class="tag ${s.done?'ok':''}">${s.done?'✔ hecho':'○ '+(i+1)}</span> <b>${s.t}</b> <span class="tag" style="opacity:.75">${INT_QUIEN[s.q]}</span><div class="sm mut">${s.d}</div></li>`).join('')}</ol>
   ${real&&st.url_callback?`<p class="sm">Dirección de conexión (URL de redirección en el portal): <code>${esc(st.url_callback)}</code><br>Dirección de avisos (webhooks, se registra sola): <code>${esc(st.url_webhook)}</code></p>`:''}
   <div class="row"><button class="btn gold" data-act="${sim?'tnSimConnect':'tnConnect'}" ${adm&&(st.app_configurada||sim)?'':'disabled'}>Conectar tienda${sim?' (simulado)':''}</button></div>${adm?'':'<p class="sm mut">Sólo el administrador conecta la tienda.</p>'}`;
 }else{
  const k=(n,l)=>`<div class="card" style="margin:0"><div class="sm mut">${l}</div><b style="font-size:1.3rem">${n}</b></div>`;
  let panel='';
  if(TNC.tab==='resumen'){
   panel=`<div class="grid g2" style="margin:.5rem 0">${k(P.total||0,'Variantes en la tienda')}${k((P.vinculados||0)+' / '+(P.total||0),'Vinculadas con el sistema')}${k(O.pendientes||0,'Órdenes por registrar')}${k(O.por_cobrar||0,'…de ellas, sin pagar todavía')}</div>
    <p class="sm mut">Última sincronización: <b>${tnWhen(st.ultima_sync)}</b>${st.eventos_error?` · <span class="tag bad">${st.eventos_error} aviso(s) con error esta semana</span>`:''}</p>${st.ultimo_error?`<div class="warnbox sm">${esc(st.ultimo_error)}</div>`:''}
    <div class="row" style="flex-wrap:wrap;gap:.4rem"><button class="btn" data-act="tnSyncP" ${TNC.busy?'disabled':''}>Traer productos</button><button class="btn" data-act="tnSyncO" ${TNC.busy||cfg.importar_ordenes!==true?'disabled':''}>Traer órdenes</button><button class="btn" data-act="tnPush" ${TNC.busy||!adm||(cfg.stock_fuente!=='sistema'&&cfg.precio_fuente!=='sistema')?'disabled':''}>Enviar stock y precios${sim?' (simulado)':''}</button>${real&&adm?'<button class="btn" data-act="tnAvisos">Registrar avisos</button>':''}</div>${TNC.busy?`<p class="sm mut">${esc(TNC.busy)}…</p>`:''}`;
  }else if(TNC.tab==='productos'){
   const f=TNC.filt,rows=(TNC.prods||[]).filter(p=>f==='todos'||(f==='pendientes'?(p.vinculo==='sin_vincular'||p.vinculo==='sugerido'):p.vinculo===f));
   const loc=S.products.filter(p=>p.active!==false).slice().sort((a,b)=>a.name.localeCompare(b.name,'es'));
   const opt=sel=>`<option value="">— elegir producto —</option>`+loc.map(p=>`<option value="${esc(p.id)}" ${sel===p.id?'selected':''}>${esc(p.name)}${p.barcode?' · '+esc(p.barcode):''}</option>`).join('');
   panel=`<div class="row" style="flex-wrap:wrap;gap:.3rem;margin:.4rem 0">${[['pendientes','Por revisar'],['vinculado','Vinculadas'],['ignorado','Ignoradas'],['todos','Todas']].map(([a,b])=>`<button class="btn ${f===a?'gold':''}" data-act="tnFilt" data-k="${a}" style="min-height:44px">${b}</button>`).join('')}</div>
    <div class="tw"><table><thead><tr><th>Variante en la tienda</th><th>Código</th><th class="r">Precio</th><th class="r">Stock</th><th>Producto del sistema</th><th></th></tr></thead><tbody>${rows.map(p=>{const lp=p.producto_local?prod(p.producto_local):null;
     return `<tr><td>${esc(p.nombre)}</td><td class="sm">${esc(p.barcode||p.sku||'—')}</td><td class="r">${p.precio_cents==null?'—':money(p.precio_cents)}</td><td class="r">${tnStockTxt(p.stock)}</td>
     <td>${p.vinculo==='vinculado'?`<span class="tag ok">vinculado</span> ${lp?esc(lp.name):'<span class="tag bad">producto borrado</span>'}`:`<select data-tnsel="${p.variant_id}" aria-label="Producto del sistema para ${esc(p.nombre)}" style="min-height:44px;max-width:240px">${opt(p.producto_local||'')}</select>${p.vinculo==='sugerido'?' <span class="tag warn">sugerido por código</span>':''}`}</td>
     <td class="r" style="white-space:nowrap">${p.vinculo==='vinculado'?`<button class="btn sm" data-act="tnUnlink" data-v="${p.variant_id}" style="min-height:44px">Desvincular</button>`:`<button class="btn sm gold" data-act="tnLink" data-v="${p.variant_id}" style="min-height:44px">Vincular</button> <button class="btn sm" data-act="tnIgn" data-v="${p.variant_id}" style="min-height:44px">Ignorar</button>`}</td></tr>`;}).join('')||'<tr><td colspan="6" class="mut">Nada para mostrar. Probá «Traer productos» en Resumen.</td></tr>'}</tbody></table></div>`;
  }else if(TNC.tab==='ordenes'){
   const rows=TNC.ords||[];
   panel=`<div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Estado</th><th class="r">Total</th><th></th></tr></thead><tbody>${rows.map(o=>`<tr><td><b>#${esc(String(o.numero||o.orden_id))}</b>${sim?' <span class="tag sim">ejemplo</span>':''}</td><td class="sm">${tnWhen(o.tn_creada)}</td><td>${esc((o.cliente||{}).nombre||'—')}</td>
    <td class="sm"><span class="tag ${o.estado==='cancelled'?'bad':''}">${esc(TN_ESTADO_ORD[o.estado]||o.estado)}</span> <span class="tag ${o.pago_estado==='paid'?'ok':'warn'}">${esc(TN_ESTADO_PAGO[o.pago_estado]||o.pago_estado)}</span> <span class="tag">${esc(TN_ESTADO_ENV[o.envio_estado]||o.envio_estado)}</span></td>
    <td class="r">${money(o.total_cents)}<div class="sm mut">${(o.items||[]).map(i=>esc(i.nombre)+' ×'+i.qty).join(', ')}</div></td>
    <td class="r" style="white-space:nowrap">${o.venta_estado==='registrada'?'<span class="tag ok">venta registrada</span>':o.venta_estado==='ignorada'?'<span class="tag">ignorada</span>':o.estado==='cancelled'?'':`<button class="btn sm gold" data-act="tnReg" data-id="${o.orden_id}" style="min-height:44px" ${o.pago_estado==='paid'?'':'disabled title="Esperá a que esté paga"'}>Registrar venta</button> <button class="btn sm" data-act="tnOrdIgn" data-id="${o.orden_id}" style="min-height:44px">Ignorar</button>`}</td></tr>`).join('')||'<tr><td colspan="6" class="mut">Sin órdenes. Probá «Traer órdenes» en Resumen.</td></tr>'}</tbody></table></div>
    <p class="sm mut">Registrar la venta descuenta el stock del sistema, entra a la caja abierta como transferencia ya verificada por Tiendanube y queda con el canal «tiendanube». El envío que cobró la tienda no forma parte de la venta.</p>`;
  }else if(TNC.tab==='config'){
   const o=(v,l,c)=>`<option value="${v}" ${c===v?'selected':''}>${l}</option>`;
   panel=`<p class="sm mut">Definí quién manda. Con «el sistema», los cambios van del sistema hacia la tienda y no al revés. Los productos que no vinculaste nunca se tocan.</p>
    <label for="tn-sf">Stock</label><select id="tn-sf" ${adm?'':'disabled'}>${o('sistema','Manda el sistema (se envía a la tienda)',cfg.stock_fuente)}${o('tiendanube','Manda la tienda (sólo lectura acá)',cfg.stock_fuente)}${o('off','No sincronizar',cfg.stock_fuente)}</select>
    <label for="tn-pf">Precio</label><select id="tn-pf" ${adm?'':'disabled'}>${o('off','No sincronizar',cfg.precio_fuente)}${o('sistema','Manda el sistema (se envía a la tienda)',cfg.precio_fuente)}${o('tiendanube','Manda la tienda (sólo lectura acá)',cfg.precio_fuente)}</select>
    <label class="chk" style="margin-top:.5rem"><input type="checkbox" id="tn-io" ${cfg.importar_ordenes===true?'checked':''} ${adm?'':'disabled'}> Traer las órdenes de la tienda (no crea ventas solas)</label>
    <div class="row" style="margin-top:.6rem;flex-wrap:wrap;gap:.4rem"><button class="btn gold" data-act="tnCfg" ${adm?'':'disabled'}>Guardar</button><button class="btn red" data-act="tnDisc" ${adm?'':'disabled'}>Desconectar tienda</button></div>
    <p class="sm mut">Al desconectar se borra el acceso guardado y se dan de baja los avisos. Para quitar la app por completo, hacelo también desde el administrador de Tiendanube.</p>`;
  }else{
   panel=`<ol class="sm" style="list-style:none;padding:0">${tnPasos().map((s,i)=>`<li style="margin:.4rem 0"><span class="tag ${s.done?'ok':''}">${s.done?'✔ hecho':'○ '+(i+1)}</span> <b>${s.t}</b> <span class="tag" style="opacity:.75">${INT_QUIEN[s.q]}</span><div class="sm mut">${s.d}</div></li>`).join('')}</ol>`;
  }
  body=`<div class="row" style="flex-wrap:wrap;gap:.3rem;margin:.4rem 0">${tab('resumen','Resumen')}${tab('productos','Productos',P.sin_vincular+P.sugeridos||0)}${tab('ordenes','Órdenes',O.pendientes||0)}${tab('config','Configuración')}${tab('pasos','Pasos')}</div>${panel}`;
 }
 return `<div class="card" style="margin-top:1rem" id="tn-card">${head(tagE)}
  <p class="sm mut">Conectá tu tienda online: el sistema trae los productos y las órdenes, y puede enviar stock y precios. ${sim?'':'El acceso a la tienda vive sólo en el servidor.'}</p>${body}</div>`;}

/* ---------- acciones ---------- */
const tnRun=async(txt,fn)=>{if(TNC.busy)return;TNC.busy=txt;rerender();try{const r=await fn();return r;}catch(e){toast((e&&e.message)||'No se pudo completar.',1);}finally{TNC.busy='';TNC.at=0;await tnRefresh(true);}};
A.tnReload=()=>{TNC.at=0;TNC.err='';TNC.fnDown=false;tnRefresh(true);};
A.tnTab=el=>{TNC.tab=el.dataset.k;rerender();};
A.tnFilt=el=>{TNC.filt=el.dataset.k;rerender();};
A.tnConnect=()=>{if(!can('config'))return toast('Sólo el administrador.',1);
 tnRun('Preparando la conexión',async()=>{const r=await tnFn('iniciar');if(!r||!/^https:\/\//.test(r.url||''))throw new Error('El servidor no devolvió una dirección válida.');
  audit('TIENDANUBE_CONEXION_INICIADA','');save();
  modal('Conectar con Tiendanube',`<p>Se abre Tiendanube en otra pestaña. Iniciá sesión con el usuario dueño de la tienda y aceptá los permisos. Al terminar volvés a este sistema solo.</p><p class="sm mut">El enlace vale 10 minutos y se usa una sola vez.</p>`,{okText:'Abrir Tiendanube',onOk:()=>{openExternal(r.url);}});});};
A.tnDisc=()=>{if(!can('config'))return;confirmBox('Desconectar la tienda','Se borra el acceso guardado y se dan de baja los avisos. Los productos y órdenes ya traídos se conservan. ¿Seguimos?',()=>{
 if(tnReal())tnRun('Desconectando',async()=>{await tnFn('desconectar');audit('TIENDANUBE_DESCONECTADA','');save();toast('Tienda desconectada.');});
 else{tnSimS().conn=false;audit('TIENDANUBE_DESCONECTADA_SIM','');save();TNC.at=0;tnRefresh(true);}},'Desconectar');};
A.tnAvisos=()=>tnRun('Registrando avisos',async()=>{const r=await tnFn('registrar_avisos');toast(r.registrados?r.registrados+' aviso(s) registrados.':'Los avisos ya estaban registrados.');});
A.tnCfg=()=>{if(!can('config'))return;const c={stock_fuente:val('tn-sf'),precio_fuente:val('tn-pf'),importar_ordenes:!!document.getElementById('tn-io').checked};
 tnRun('Guardando',async()=>{if(tnReal()){const r=await rpc('tn_config_guardar',{p_comercio:cl.comercio.id,p:c});if(!r.ok)throw new Error(r.error||'No se pudo guardar.');}else Object.assign(tnSimS().cfg,c);audit('TIENDANUBE_CONFIG',JSON.stringify(c));save();toast('Configuración guardada.');});};
A.tnSyncP=()=>tnRun('Trayendo productos',async()=>{
 if(tnReal()){const r=await tnFn('sincronizar_productos');toast(r.variantes+' variantes traídas · '+r.sugeridos+' con vínculo sugerido');}
 else{const t=tnSimS();if(!t.prods.length)tnSimSeed();t.last=now();toast('Simulado: productos de ejemplo traídos.');}
 audit('TIENDANUBE_PRODUCTOS','');save();});
A.tnSyncO=()=>tnRun('Trayendo órdenes',async()=>{
 if(tnReal()){const r=await tnFn('importar_ordenes');toast(r.total+' órdenes leídas · '+r.ok+' nuevas o cambiadas');}
 else{const t=tnSimS();if(!t.prods.length)tnSimSeed();tnSimOrder(true);t.last=now();toast('Simulado: llegó una orden de ejemplo.');}
 audit('TIENDANUBE_ORDENES','');save();});
A.tnPush=()=>{if(!can('config'))return;tnRun('Enviando',async()=>{
 if(tnReal()){const r=await tnFn('empujar');toast('Stock: '+r.stock+' · Precio: '+r.precio+' · sin cambios: '+r.sin_cambios+(r.errores?' · con error: '+r.errores:''),r.errores?1:0);}
 else{const t=tnSimS();let n=0;t.prods.filter(p=>p.vinculo==='vinculado').forEach(p=>{const l=prod(p.producto_local);if(!l)return;const s=Math.max(0,Math.floor(l.stock));if(t.cfg.stock_fuente==='sistema'&&p.stock!==s){p.stock=s;n++;}if(t.cfg.precio_fuente==='sistema'&&p.precio_cents!==l.price){p.precio_cents=l.price;n++;}});toast('Simulado: '+n+' cambio(s) enviados a la tienda de ejemplo.');}
 audit('TIENDANUBE_ENVIO','');save();});};
function tnSelVal(v){const e=document.querySelector(`[data-tnsel="${v}"]`);return e?e.value:'';}
A.tnLink=el=>{const v=+el.dataset.v,pid=tnSelVal(v);if(!pid)return toast('Elegí el producto del sistema.',1);
 tnRun('Vinculando',async()=>{if(tnReal()){const r=await rpc('tn_vincular',{p_comercio:cl.comercio.id,p_variant:v,p_producto:pid});if(!r.ok)throw new Error(r.error);}
  else{const t=tnSimS();if(t.prods.some(p=>p.producto_local===pid&&p.vinculo==='vinculado'&&p.variant_id!==v))throw new Error('Ese producto ya está vinculado con otra variante.');const p=t.prods.find(x=>x.variant_id===v);p.producto_local=pid;p.vinculo='vinculado';}
  audit('TIENDANUBE_VINCULO',v+' → '+pid);save();toast('Vinculado.');});};
const tnVinc=(v,vinc,msg)=>tnRun('Guardando',async()=>{if(tnReal()){const r=await rpc('tn_vincular',{p_comercio:cl.comercio.id,p_variant:v,p_producto:null,p_vinculo:vinc});if(!r.ok)throw new Error(r.error);}
 else{const p=tnSimS().prods.find(x=>x.variant_id===v);p.vinculo=vinc;p.producto_local=null;}audit('TIENDANUBE_VINCULO',v+' '+vinc);save();toast(msg);});
A.tnUnlink=el=>tnVinc(+el.dataset.v,'sin_vincular','Desvinculado.');
A.tnIgn=el=>tnVinc(+el.dataset.v,'ignorado','Ignorada: no se sincroniza.');
A.tnOrdIgn=el=>{const id=+el.dataset.id;confirmBox('Ignorar la orden','No se va a registrar como venta. Sigue visible en la tienda. ¿Ignorarla?',()=>tnRun('Guardando',async()=>{
 if(tnReal()){const r=await rpc('tn_orden_registrar',{p_comercio:cl.comercio.id,p_orden:id,p_venta:null,p_ignorar:true});if(!r.ok)throw new Error(r.error);}else{tnSimS().ords.find(o=>o.orden_id===id).venta_estado='ignorada';}
 audit('TIENDANUBE_ORDEN_IGNORADA','#'+id);save();}),'Ignorar');};
A.tnReg=el=>{const id=+el.dataset.id,o=(TNC.ords||[]).find(x=>x.orden_id===id);if(!o)return;
 if(o.pago_estado!=='paid')return toast('La orden todavía no está paga en Tiendanube.',1);
 if(o.estado==='cancelled')return toast('La orden está cancelada.',1);
 if(!openSess())return toast('Abrí una caja para registrar la venta.',1);
 const falta=(o.items||[]).filter(i=>!i.producto_local||!prod(i.producto_local));
 if(falta.length)return toast('Vinculá primero: '+falta.map(i=>i.nombre).join(', ')+' (pestaña Productos).',1);
 const body=`<table class="sm"><tbody>${o.items.map(i=>`<tr><td>${esc(prod(i.producto_local).name)} × ${i.qty}</td><td class="r">${money(i.qty*i.precio_cents)}</td></tr>`).join('')}</tbody></table>
  ${o.descuento_cents?`<p class="sm">Descuento de la tienda: − ${money(o.descuento_cents)}</p>`:''}<p><b>Total de la venta: ${money(o.items.reduce((a,i)=>a+i.qty*i.precio_cents,0)-(o.descuento_cents||0))}</b></p>
  ${o.envio_cents?`<p class="sm mut">La tienda cobró ${money(o.envio_cents)} de envío: no entra en esta venta.</p>`:''}<p class="sm mut">Entra a la caja abierta como transferencia ya cobrada por Tiendanube. Se descuenta el stock de cada producto.</p>`;
 modal('Registrar la orden #'+(o.numero||o.orden_id)+' como venta',body,{okText:'Registrar venta',onOk:async w=>{
  const saleId=uid();
  try{if(tnReal()){const r=await rpc('tn_orden_registrar',{p_comercio:cl.comercio.id,p_orden:id,p_venta:saleId});if(!r.ok){w._err(r.error||'No se pudo reservar la orden.');return false;}if(r.repetido){toast('Esa orden ya fue registrada como venta.',1);TNC.at=0;tnRefresh(true);return;}}}
  catch(e){w._err((e&&e.message)||'Sin conexión: no se registró nada.');return false;}
  const lines=o.items.map(i=>{const p=prod(i.producto_local);return{pid:p.id,name:p.name,rubro:p.rubro,qty:i.qty,price:i.precio_cents,cost:p.cost,unit:p.unit,list:p.price};});
  const r=commitSale('transferencia',false,'tiendanube',lines,{saleId,extraDisc:o.descuento_cents||0,tnOrder:id,pdSkip:true});
  if(r.err){if(tnReal()){try{await rpc('tn_orden_liberar',{p_comercio:cl.comercio.id,p_orden:id,p_venta:saleId});}catch(e){}}w._err(r.err);return false;}
  if(!tnReal()){const so=tnSimS().ords.find(x=>x.orden_id===id);so.venta_estado='registrada';so.venta_local=r.sale.id;}
  audit('TIENDANUBE_VENTA','#'+(o.numero||id)+' → '+r.sale.n);save();toast('Venta '+r.sale.n+' registrada.');TNC.at=0;tnRefresh(true);setTimeout(rerender,60);}});};

/* ---------- simulación de la demo (datos de EJEMPLO) ---------- */
A.tnSimConnect=()=>{const t=tnSimS();t.conn=true;t.store='EJEMPLO-001';tnSimSeed();t.last=now();audit('TIENDANUBE_CONECTADA_SIM','');save();TNC.at=0;toast('Tienda de ejemplo conectada (simulado).');tnRefresh(true);};
function tnSimSeed(){const t=tnSimS();if(t.prods.length)return;const ps=S.products.filter(p=>p.active!==false).slice(0,6);
 ps.forEach((p,i)=>t.prods.push({variant_id:9000+i,product_id:900+i,sku:'',barcode:p.barcode||'',nombre:p.name+' (ejemplo)',precio_cents:p.price,stock:Math.max(0,Math.floor(p.stock)),producto_local:i<4?p.id:null,vinculo:i<3?'sugerido':i===3?'sugerido':'sin_vincular'}));
 t.prods.push({variant_id:9099,product_id:999,sku:'EJ-1',barcode:'',nombre:'Producto sólo de la tienda (ejemplo)',precio_cents:99000,stock:null,producto_local:null,vinculo:'sin_vincular'});
 tnSimOrder(false);tnSimOrder(true);}
function tnSimOrder(paid){const t=tnSimS();const pr=t.prods.filter(p=>p.vinculo==='vinculado'||p.vinculo==='sugerido').filter(p=>p.producto_local);if(!pr.length)return;
 t.seq=(t.seq||0)+1;const a=pr[(t.seq)%pr.length],b=pr[(t.seq+1)%pr.length];const items=[{variant_id:a.variant_id,nombre:a.nombre,qty:1,precio_cents:a.precio_cents,producto_local:a.producto_local}];if(b!==a)items.push({variant_id:b.variant_id,nombre:b.nombre,qty:2,precio_cents:b.precio_cents,producto_local:b.producto_local});
 const sub=items.reduce((s,i)=>s+i.qty*i.precio_cents,0);const idn=7000+t.seq;
 t.ords.unshift({orden_id:idn,numero:100+t.seq,estado:'open',pago_estado:paid?'paid':'pending',envio_estado:'unpacked',total_cents:sub,subtotal_cents:sub,descuento_cents:0,envio_cents:0,moneda:'ARS',medio_pago:'ejemplo',cliente:{nombre:['Ana (ejemplo)','Luis (ejemplo)','Marta (ejemplo)'][t.seq%3]},items,tn_creada:new Date().toISOString(),tn_actualizada:new Date().toISOString(),venta_estado:'pendiente',venta_local:null});}
/* aceptar la sugerencia del selector sin tocar nada más: el valor ya viene preseleccionado en el <select> */
