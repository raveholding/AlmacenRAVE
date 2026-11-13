# V26.70 · Centro de canales en Atención al cliente: conectar con un clic (rápido) e integrado (función «canales»)
import json
from playwright.sync_api import sync_playwright
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1300,'height':900});ev=pg.evaluate;errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pops=[];pg.context.on('page',lambda x:pops.append(x.url))
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(1200);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(700)
    ev("crmTab='canales';go('crm')");pg.wait_for_timeout(500)
    chk(pg.locator('.can-card').count()==8,'ocho canales: tienda web, WhatsApp, Instagram, Messenger, Telegram, correo, TikTok y Tiendanube')
    pg.click('[data-act=canTodo]');pg.wait_for_timeout(500)
    st=ev("Object.fromEntries(CANAL_L.map(k=>[k,canEstado(k)]))")
    chk(st['wa']=='link' and st['ig']=='link' and st['fb']=='link' and st['tt']=='link' and st['web']=='api','«Conectar todo con un clic» usa el WhatsApp y las redes del menú %s'%st)
    chk('Conectados' in pg.locator('.ov .mb').inner_text(),'muestra qué conectó y qué falta')
    ev("$$('#modal-root .ov').forEach(o=>o.remove())")
    pub=ev("RAVE_API.site().canales")
    chk(any(x['url']=='https://ig.me/m/rave_licoreria' for x in pub) and any(x['url'].startswith('https://m.me/') for x in pub) and any(x['url'].startswith('https://wa.me/549') for x in pub),'publica los enlaces oficiales (ig.me, m.me, wa.me)')
    chk(all(k in ev("crmCfg().chans") for k in ['ig','fb','tt','wa']),'los canales conectados aparecen en la bandeja')
    # Telegram rápido con el asistente
    ev("rerender()");pg.wait_for_timeout(300);pg.click('.can-card [data-act=canAbrir][data-k=tg]');pg.wait_for_timeout(300)
    chk(pg.locator('.can-mode').count()==2,'el asistente ofrece Rápido o Integrado')
    chk(pg.locator('input[name=cn-m][value=api]').is_disabled(),'sin nube, Integrado queda deshabilitado')
    pg.fill('#cn-v','https://t.me/RaveSalta');pg.click('.ov [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("canEstado('tg')")=='link' and ev("canLink('tg')")=='https://t.me/RaveSalta','Telegram conectado en un paso (acepta el enlace o el @usuario)')
    pg.click('.can-card [data-act=canAbrir][data-k=mail]');pg.wait_for_timeout(300);pg.fill('#cn-v','no-es-mail');pg.click('.ov [data-m=ok]');pg.wait_for_timeout(200)
    chk(ev("canEstado('mail')")=='off','valida el correo');pg.fill('#cn-v','Hola@Rave.com.ar');pg.click('.ov [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("canLink('mail')")=='mailto:hola@rave.com.ar','correo conectado')
    pg.click('.can-card [data-act=canAbrir][data-k=tn]');pg.wait_for_timeout(500)
    chk(ev("canEstado('tn')")=='api','Tiendanube con un clic (en la demo, tienda de ejemplo)')
    ev("crmTab='canales';go('crm')");pg.wait_for_timeout(300)
    chk('8 de 8' in pg.locator('.can-head').inner_text(),'avance: 8 de 8 canales')
    # TikTok no tiene integrado
    pg.click('.can-card [data-act=canAbrir][data-k=tt]');pg.wait_for_timeout(300)
    chk(pg.locator('input[name=cn-m][value=api]').count()==0 and 'no ofrece' in pg.locator('.ov .mb').inner_text(),'TikTok: explica que sólo hay botón directo');ev("$$('#modal-root .ov').forEach(o=>o.remove())")
    # responder por un canal rápido
    ev("(()=>{const c=crmNew({chan:'ig',name:'Lucía'});crmAdd(c,'in','Hola, precio del fernet?');crmSel=c.id;window.__c=c.id;})()")
    ev("window.__op=[];window.open=(u)=>{window.__op.push(u);return null;}");ev("crmSend(convById(window.__c),'Hola Lucía, sale $ 9.500')");pg.wait_for_timeout(400);pops=[x for x in ev("window.__op") if x]
    m=ev("convMsgs(window.__c).filter(m=>m.dir==='out').pop()")
    chk(m and 'Instagram' in m['via'] and any('instagram.com/direct' in u for u in pops),'Instagram rápido: copia la respuesta y abre la bandeja de Instagram')
    # desconectar
    pg.click('.can-card [data-act=canOff][data-k=ig]');pg.wait_for_timeout(200);pg.click('.ov [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("canEstado('ig')")=='off' and not any(x['k']=='ig' for x in ev("RAVE_API.site().canales")),'desconectar lo saca del menú y de la app')
    # app del cliente: contacto con los canales
    pg.set_viewport_size({'width':390,'height':844});pg.goto('file:///tmp/rave/index.html#mitarjeta');pg.wait_for_timeout(1800)
    fr=pg.frame_locator('#pubframe')
    ev("document.getElementById('pubframe').contentWindow.RAVE_OPEN_APP('con')");pg.wait_for_timeout(300)
    t=fr.locator('#mt-full').inner_text()
    chk('Escribir por Telegram' in t and 'Escribir por Facebook Messenger' in t and 'Escribir por Correo' in t,'la app del Club muestra los canales conectados')
    chk(not errs,'sin errores JS '+str(errs[:3]))
    b.close()
# ---------- integrado (versión con nube) ----------
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page();ev=pg.evaluate;errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]));sent=[]
    def h(route):
        r=route.request
        if '/functions/v1/canales' in r.url:
            body=json.loads(r.post_data or '{}');sent.append(body)
            out={'ok':True,'msg':'Bot @RaveClientesBot conectado','link':'https://t.me/RaveClientesBot'} if body.get('accion')=='probar' else {'ok':True}
            return route.fulfill(status=200,body=json.dumps(out),headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'})
        route.fulfill(status=404,body='{}',headers={'Access-Control-Allow-Origin':'*'})
    pg.route('https://pruebarave.supabase.co/**',h)
    pg.goto('file:///tmp/rave/cli.html#acceso');pg.wait_for_timeout(1500)
    chk(ev("BYC.conv.pii.includes('ext')&&BYC.conv.pii.includes('email')"),'nube: el contacto del canal viaja cifrado')
    ev("(()=>{user={id:'u',name:'ADMIN',role:'admin'};cl.ready=true;cl.online=true;cl.rol='admin';cl.comercio={id:'22222222-2222-2222-2222-222222222222'};cl.ses={access:'x.y.z',refresh:'r',exp:Date.now()+3e6};})()")
    ok=ev("crmInbound({conv:'wtg-AAAAAAAAAAAAAAAAAAAAAAAA',chan:'tg',ext:'99887766',name:'Ana',text:'Hola! abren hoy?',mid:'tg99_1'},501)")
    c=ev("convById('wtg-AAAAAAAAAAAAAAAAAAAAAAAA')")
    chk(ok and c and c['chan']=='tg' and c['ext']=='99887766','un mensaje de Telegram entra a la bandeja como conversación de Telegram')
    chk(not ev("crmInbound({conv:'wxx-AAAAAAAAAAAAAAAAAAAAAAAA',chan:'hack',ext:'1',text:'x'},502)&&convById('wxx-AAAAAAAAAAAAAAAAAAAAAAAA').chan!=='web'"),'un canal desconocido no se acepta como tal')
    ev("S.cfg.canales={tg:{modo:'api',bot:'RaveClientesBot'}}")
    r=ev("crmSend(convById('wtg-AAAAAAAAAAAAAAAAAAAAAAAA'),'¡Sí, hasta las 23!').then(m=>m.via).catch(e=>'ERR '+e.message)")
    chk(r=='enviado por Telegram' and any(x.get('accion')=='enviar' and x.get('canal')=='tg' and x.get('para')=='99887766' for x in sent),'Telegram integrado: la respuesta sale por la función, al chat del cliente')
    chk(not any('token' in json.dumps(x).lower() for x in sent),'el navegador nunca manda tokens')
    chk(not errs,'nube sin errores JS '+str(errs[:3]))
    b.close()
print('\n%d/%d'%(sum(res),len(res)))
