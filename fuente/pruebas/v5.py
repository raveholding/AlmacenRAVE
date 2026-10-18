# V26 · 4.18 / 4.19 paneles honestos: checkout online y Wallet/avisos
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/integ'");pg.wait_for_timeout(400)
    chk(pg.locator('#onl-card').count()==1 and pg.locator('#wal-card').count()==1,'paneles Ventas online y Wallet presentes')
    chk(ev("onlCfg().mode")=='whatsapp','modo por defecto = whatsapp')
    chk(pg.locator('input[name=onl-m][value=whatsapp]').is_checked(),'WhatsApp seleccionado')
    t=pg.inner_text('#onl-card')
    chk('Pendiente de configuración' in t and 'Proveedor de pagos' in t and 'webhook firmado' in t,'requisitos externos pendientes visibles')
    # intentar activar checkout con todo cargado menos lo externo
    pg.check('#onl-pk');pg.fill('#onl-pp','Av. Siempre Viva 123');pg.fill('#onl-ph','Lu a Sá 9 a 20');pg.fill('#onl-ms','Gracias por tu compra');pg.check('#onl-po')
    pg.check('input[name=onl-m][value=online_checkout]');pg.click('[data-act=onlSave]');pg.wait_for_timeout(300)
    chk(ev("onlCfg().mode")=='whatsapp','no deja activar checkout sin proveedor/servidor')
    chk(ev("allAudit().some(a=>a.action==='VENTA_ONLINE_MODO_RECHAZADO')"),'rechazo auditado')
    chk(ev("onlCfg().pickup.on===true && onlCfg().pickup.place.startsWith('Av.')"),'parámetros no secretos sí se guardan')
    chk(ev("onlineMissing().filter(x=>!x.ext).length")==0 and ev("onlineMissing().filter(x=>x.ext).length")==3,'quedan sólo 3 requisitos externos')
    # el menú público no cambió
    pg.goto('file:///tmp/rave/index.html#menu');pg.wait_for_timeout(500)
    chk('WhatsApp' in pg.inner_text('#pub') or ev("document.body.innerHTML.includes('wa.me')"),'el menú público sigue con WhatsApp')
    chk(ev("document.getElementById('pub').innerText.toLowerCase().includes('pagar online')")==False,'el menú no anuncia checkout')
    # Wallet
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(500)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/integ'");pg.wait_for_timeout(400)
    chk(pg.locator('#wal-card input[type=checkbox]').is_disabled(),'interruptor Wallet bloqueado')
    chk('Apple Wallet' in pg.inner_text('#wal-card') and 'Google Wallet' in pg.inner_text('#wal-card') and 'wa.me NO es envío automático' in pg.inner_text('#wal-card'),'Wallet: requisitos y aclaración wa.me')
    # permisos: supervisor no ve Integraciones
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(500)
    pg.select_option('#lu',index=1);pg.fill('#lp','1111');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/integ'");pg.wait_for_timeout(300)
    chk(ev("curScreen")!='integ','supervisor sin permiso no entra a Integraciones')
    # 320px
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(500)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    pg.set_viewport_size({'width':320,'height':700});ev("location.hash='#panel/integ'");pg.wait_for_timeout(400)
    chk(ev("document.documentElement.scrollWidth")<=321,'320px: sin scroll horizontal en Integraciones')
    chk(not errs,'sin errores de consola'+(' '+str(errs[:3]) if errs else ''))
    print('RESULTADO',sum(res),'/',len(res))
