# V26.52 · R2AVE en Telegram (@R2aveBot): tarjeta de Configuración
#  · raveV3 (demo): simulación rotulada con los datos de la demo, sin cambiar nada
#  · Almacén RAVE (cliente): sin nube → «requiere la nube»; con la nube (simulada acá) → pasos, conectar, vincular,
#    guardar límites, desvincular. Sólo el administrador.
#  · Kini y raveV2: no llevan el módulo.
import re
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
def login(pg,i=0,pin='1234'):
    pg.select_option('#lu',index=i);pg.fill('#lp',pin);pg.click('[data-act=login]');pg.wait_for_timeout(500)
for f,nombre in (('/tmp/rave/kini.html','Kini'),('/tmp/rave/solo.html','raveV2')):
    t=open(f,encoding='utf-8').read()
    chk('R2aveBot' not in t and 'tgCfgCard' not in t,'%s no lleva R2AVE en Telegram'%nombre)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    # ---------------- raveV3: simulación
    pg=b.new_page(viewport={'width':1280,'height':900});pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    pg.goto('file:///tmp/rave/v3.html#acceso');pg.wait_for_timeout(900);login(pg)
    snap=ev("JSON.stringify(S.products.map(x=>[x.id,x.stock]))");na=ev("allAudit().length")
    ev("go('config')");pg.wait_for_timeout(400)
    card=pg.locator('#tg-card')
    chk(card.count()==1 and 'SIMULADO' in card.inner_text(),'raveV3: la tarjeta está y dice SIMULADO')
    chk('Demostración' in card.inner_text() and 'Almacén RAVE' in card.inner_text(),'aclara que el bot real es de Almacén RAVE')
    chk(ev("(()=>{const h=document.querySelector('#app').innerHTML;return h.indexOf('id=\"tg-card\"')<h.indexOf('<h3>Respaldo</h3>')||h.indexOf('<h3>Respaldo</h3>')<0})()"),'va antes de «Respaldo»')
    pg.click('[data-act=tgSim][data-c="/resumen"]');pg.wait_for_timeout(200)
    t=pg.locator('.tgchat').inner_text()
    chk('/resumen' in t and 'Resumen de hoy' in t and '$' in t,'«/resumen» responde con ventas de la demo')
    pg.click('[data-act=tgSim][data-c="/bajo_stock"]');pg.wait_for_timeout(200)
    chk('Stock bajo' in pg.locator('.tgchat').inner_text() or 'Ningún artículo' in pg.locator('.tgchat').inner_text(),'«/bajo_stock» responde')
    pg.click('[data-act=tgSim][data-c="/corregir_stock"]');pg.wait_for_timeout(200)
    t=pg.locator('.tgchat').inner_text()
    chk('Revisá antes de confirmar' in t and 'Confirmar' in t,'«/corregir_stock» muestra el resumen con Confirmar')
    chk(ev("JSON.stringify(S.products.map(x=>[x.id,x.stock]))")==snap and ev("allAudit().length")==na,'la simulación no cambia stock ni escribe Auditoría')
    # un rol que no es administrador no la ve
    chk(ev("(()=>{const u=user;user=Object.assign({},u,{role:'mostrador'});const h=tgCfgCard();user=u;return h===''})()"),'sin la tarjeta para quien no es administrador')
    pg.close()
    # ---------------- Almacén RAVE (cliente)
    pg=b.new_page(viewport={'width':1280,'height':900});pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    # el archivo del cliente sin nube no deja ingresar: se entra como administrador directamente al panel
    pg.goto('file:///tmp/rave/out_cliente.html#acceso');pg.wait_for_timeout(900)
    ev("user={id:'u1',name:'Nico',role:'admin'};showPanel('config')");pg.wait_for_timeout(400)
    chk('REQUIERE LA NUBE' in pg.locator('#tg-card').inner_text(),'cliente sin nube: «requiere la nube»')
    # nube simulada: la función y las RPC responden como el servidor
    ev("""window.__calls=[];window.__opened=[];window.open=u=>{window.__opened.push(u);return null};
      window.__st={activo:false,ajuste_on:false,ajuste_hasta:null,max_unidades:24,max_valor:5000000,max_dia:10,ia:true,ia_max_dia:30,alertas:false,alertas_chat:false,webhook_ok:null,
        vinculos:[],acciones:[],correcciones_hoy:0,faltan:['TELEGRAM_BOT_TOKEN'],ia_lista:false,bot:null,webhook:null};
      CLOUD.on=true;cl.ready=true;cl.comercio={id:'c-rave',nombre:'Almacén RAVE',slug:'almacen-rave'};
      window.hreq=async(path,o)=>{const b=o&&o.body||{};window.__calls.push([path,b]);
        if(path==='/functions/v1/telegram'){if(b.accion==='estado')return JSON.parse(JSON.stringify(__st));if(b.accion==='conectar'){__st.webhook={conectado:true};return{ok:true}}if(b.accion==='probar_alertas')return{ok:true,enviadas:2}}
        if(path==='/rest/v1/rpc/tg_admin_guardar'){const p=b.p;Object.assign(__st,p);if(p.horas){__st.ajuste_on=true;__st.ajuste_hasta=new Date(Date.now()+p.horas*3600e3).toISOString()}return JSON.parse(JSON.stringify(__st))}
        if(path==='/rest/v1/rpc/tg_codigo_crear')return{codigo:'ABCD2345',vence:new Date(Date.now()+6e5).toISOString()};
        if(path==='/rest/v1/rpc/tg_admin_desvincular'){__st.vinculos=[];return JSON.parse(JSON.stringify(__st))}
        throw new Error('no esperado '+path)};
      TGC.st=null;TGC.at=0;showPanel('config');""")
    pg.wait_for_timeout(600)
    t=pg.locator('#tg-card').inner_text()
    chk('Faltan secretos' in t and 'TELEGRAM_BOT_TOKEN' in t,'muestra qué secreto falta (sin pedir el token)')
    chk(pg.locator('[data-act=tgConectar]').is_disabled(),'sin secretos no deja conectar')
    chk('no se manda por chat' in t,'avisa que el token no se manda por chat ni se escribe en el sistema')
    chk(pg.locator('input[type=password], input[id*=token]').count()==0,'no hay ningún campo para escribir el token')
    ev("__st.faltan=[];__st.bot='R2aveBot';TGC.at=0;tgRefresh(true)");pg.wait_for_timeout(400)
    pg.click('[data-act=tgConectar]');pg.wait_for_timeout(500)
    chk(any(c[0]=='/functions/v1/telegram' and c[1].get('accion')=='conectar' and c[1].get('comercio')=='c-rave' for c in ev("__calls")),'«Conectar con Telegram» llama a la función del comercio')
    chk(ev("allAudit().some(a=>a.action==='TELEGRAM_CONECTAR')"),'queda en Auditoría')
    chk(pg.locator('[data-act=tgVincular]').is_disabled(),'con el bot apagado no se vincula')
    # guardar: encender, 4 horas, límites
    pg.check('#tg-on');pg.select_option('#tg-h','4');pg.fill('#tg-mu','24');pg.fill('#tg-mv','50000');pg.fill('#tg-md','10')
    pg.click('[data-act=tgSave]');pg.wait_for_timeout(400)
    g=[c for c in ev("__calls") if c[0]=='/rest/v1/rpc/tg_admin_guardar'][-1][1]
    chk(g['p_comercio']=='c-rave' and g['p']=={'activo':True,'ia':True,'alertas':False,'horas':4,'max_unidades':24,'max_valor':5000000,'max_dia':10,'ia_max_dia':30},'guarda encendido, 4 h, 24 u, $ 50.000 (en centavos), 10 por día: %s'%g['p'])
    t=pg.locator('#tg-card').inner_text()
    chk('Permitidas hasta' in t and 'Encendido' in t,'muestra hasta cuándo se permiten correcciones')
    chk(ev("document.querySelector('#tg-h').value")=='','al volver a guardar, mantiene la ventana (no la apaga sola)')
    pg.click('[data-act=tgSave]');pg.wait_for_timeout(300)
    g=[c for c in ev("__calls") if c[0]=='/rest/v1/rpc/tg_admin_guardar'][-1][1]
    chk('horas' not in g['p'],'guardar sin tocar la ventana no la cambia')
    pg.fill('#tg-mu','0');pg.click('[data-act=tgSave]');pg.wait_for_timeout(200)
    chk(len([c for c in ev("__calls") if c[0]=='/rest/v1/rpc/tg_admin_guardar'])==2,'máximo de 0 unidades → no guarda')
    # vincular
    ev("showPanel('config')");pg.wait_for_timeout(300)
    pg.click('[data-act=tgVincular]');pg.wait_for_timeout(400)
    m=pg.locator('#modal-root .ov >> nth=-1').inner_text()
    chk('/vincular ABCD2345' in m and 'una sola vez' in m,'muestra el código de un solo uso')
    pg.click('[data-act=tgAbrir]');pg.wait_for_timeout(200)
    chk(ev("__opened[__opened.length-1]")=='https://t.me/R2aveBot?start=ABCD2345','abre @R2aveBot con el código')
    pg.locator('#modal-root .ov >> nth=-1').locator('[data-m=ok]').click();pg.wait_for_timeout(300)
    # desvincular
    ev("__st.vinculos=[{tg_user_id:'9001',tg_nombre:'Nico',usuario:'Nico',yo:true,alta:new Date().toISOString(),ultimo_uso:null}];__st.acciones=[{ts:Date.now(),user:'Nico',action:'AJUSTE_STOCK',detail:'Coca-Cola <b>2,25 L</b> +6 (12 → 18) · conteo físico [R2AVE Telegram]'}];TGC.at=0;tgRefresh(true)");pg.wait_for_timeout(400)
    t=pg.locator('#tg-card').inner_text()
    chk('Nico' in t and 'vos' in t and '(12 → 18)' in t,'lista vinculados y últimas acciones')
    chk(pg.locator('#tg-card b:has-text("2,25 L")').count()==0,'el detalle se muestra escapado')
    pg.click('[data-act=tgDesv]');pg.wait_for_timeout(200);pg.locator('#modal-root .ov >> nth=-1').locator('[data-m=ok]').click();pg.wait_for_timeout(400)
    chk(any(c[0]=='/rest/v1/rpc/tg_admin_desvincular' and c[1]=={'p_comercio':'c-rave','p_tg_user':'9001'} for c in ev("__calls")),'desvincular manda el Telegram elegido')
    # función sin instalar
    ev("window.hreq=async()=>{throw new NetErr()};TGC.st=null;TGC.down=false;TGC.at=0;tgRefresh(true)");pg.wait_for_timeout(400)
    chk('todavía no está instalada' in pg.locator('#tg-card').inner_text(),'si la función no responde, lo dice y muestra los pasos')
    ev("window.hreq=async()=>{const e=new ApiErr('Falta',500,{falta_sql:true});throw e};TGC.st=null;TGC.down=false;TGC.at=0;tgRefresh(true)");pg.wait_for_timeout(400)
    chk('18-telegram.sql' in pg.locator('#tg-card .warnbox').inner_text(),'si falta la base, pide correr 18-telegram.sql')
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
