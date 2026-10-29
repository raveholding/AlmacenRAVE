# V26.32 · Carrito del menú público: total al vaciar, +/− en el pedido, deshacer, cupón, inglés, WhatsApp y contraste (claro/oscuro)
import os,urllib.parse
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
HERE=os.path.dirname(os.path.abspath(__file__))
CJS=open(os.path.join(HERE,'contraste.js'),encoding='utf8').read()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    for F,tag in (('/tmp/rave/index.html','raveV2'),('/tmp/rave/kini.html','Kini')):
        if not os.path.exists(F): continue
        pg=b.new_page(viewport={'width':390,'height':844});pg.clock.install(time=1761750000000)
        pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
        pg.goto('file://'+F+'#menu');pg.wait_for_timeout(1400)
        f=[x for x in pg.frames if x!=pg.main_frame][0]
        try: f.click('#ag-yes',timeout=1500)
        except Exception: pass
        f.evaluate("window.open=function(u){window.__wa=u;return {}}")
        ids=f.evaluate("[...document.querySelectorAll('.sheet [data-id][data-price]')].filter(e=>e.dataset.price!=='').slice(0,2).map(e=>[e.dataset.id,+e.dataset.price])")
        (a,pa),(bb,pb)=ids
        def plus(i): f.evaluate("document.querySelector('.sheet [data-id=\"%s\"] .qty-btn.plus').click()"%i)
        plus(a);plus(a);plus(bb)
        f.evaluate("document.getElementById('cart-bar').click()");pg.wait_for_timeout(300)
        tot=lambda: int(''.join(ch for ch in f.inner_text('#cp-total-val') if ch.isdigit()) or 0)
        chk(tot()==2*pa+pb,'%s: el total del pedido es la suma de las líneas (%d)'%(tag,tot()))
        chk('3 productos' in f.inner_text('#cp-count'),'%s: el encabezado dice cuántos productos hay'%tag)
        # +/− dentro del pedido
        f.click('.cp-item[data-pid="%s"] .cp-inc'%bb);pg.wait_for_timeout(150)
        chk(tot()==2*pa+2*pb and f.inner_text('.sheet [data-id="%s"] .qty-val'%bb).strip()=='2','%s: «+» en el pedido suma y el catálogo se actualiza'%tag)
        f.click('.cp-item[data-pid="%s"] .cp-dec'%bb);f.click('.cp-item[data-pid="%s"] .cp-dec'%bb);pg.wait_for_timeout(150)
        chk(f.locator('.cp-item[data-pid="%s"]'%bb).count()==0 and tot()==2*pa,'%s: «−» hasta cero quita el producto y recalcula'%tag)
        # cupón aplicado y vaciar
        code=f.evaluate("(window.parent.RAVE_API.coupons(null)[0]||{}).code||''")
        if code:
            f.fill('#cp-coupon-in',code);f.click('#cp-coupon-ok');pg.wait_for_timeout(200)
        f.click('#btn-clear');pg.wait_for_timeout(250)
        chk(f.inner_text('#cp-total-val').strip()=='$ 0','%s: al vaciar, el total vuelve a $ 0 (antes quedaba el importe anterior)'%tag)
        chk(f.locator('#cp-disc-row').count()==0,'%s: al vaciar no queda el «total con cupón»'%tag)
        chk(not f.is_visible('.cp-total-row') and not f.is_visible('#btn-send') and f.is_visible('#cart-empty'),'%s: vacío muestra sólo el aviso (sin total ni botón de enviar)'%tag)
        chk(f.evaluate("document.querySelectorAll('.sheet .in-cart').length")==0 and not f.is_visible('#cart-bar'),'%s: el catálogo y la barra inferior también quedan en cero'%tag)
        f.click('#cart-undo');pg.wait_for_timeout(200)
        chk(tot()==2*pa and f.is_visible('#btn-send'),'%s: «Deshacer» recupera el pedido vaciado por error'%tag)
        # mensaje de WhatsApp
        f.click('#btn-send');pg.wait_for_timeout(200)
        u=urllib.parse.unquote(f.evaluate("window.__wa||''"))
        chk(u.startswith('https://wa.me/') and '¡Hola! Quiero hacer este pedido:' in u and 'Hola RAVE' not in u,'%s: el WhatsApp saluda sin nombre fijo de otro negocio'%tag)
        # inglés
        pg.keyboard.press('Escape');pg.wait_for_timeout(150)
        chk(not f.is_visible('#cart-panel'),'%s: Escape cierra el pedido'%tag)
        f.click('#lang-en');pg.wait_for_timeout(200);f.evaluate("document.getElementById('cart-bar').click()");pg.wait_for_timeout(250)
        chk('Your order' in f.inner_text('#cp-title') and 'items' in f.inner_text('#cp-count') and 'each' in f.inner_text('.cp-item .cp-unit'),'%s: el pedido se traduce al inglés'%tag)
        f.click('#btn-clear');pg.wait_for_timeout(200)
        chk('anything yet' in f.inner_text('#cart-empty') and f.is_visible('#cart-undo'),'%s: el aviso de vacío se traduce y conserva «Deshacer»'%tag)
        f.click('#btn-x');pg.wait_for_timeout(150);f.click('#lang-es');pg.wait_for_timeout(150);f.evaluate("document.getElementById('cart-bar').click()");pg.wait_for_timeout(200)
        # táctil
        f.click('#cart-undo');pg.wait_for_timeout(150)
        hs=f.evaluate("[...document.querySelectorAll('#cart-panel .cp-inc,#cart-panel .cp-dec,#btn-x,#btn-send,#btn-clear')].map(e=>Math.min(e.getBoundingClientRect().width,e.getBoundingClientRect().height))")
        chk(min(hs)>=44,'%s: botones del pedido de 44 px o más (%s)'%(tag,min(hs)))
        pg.set_viewport_size({'width':320,'height':640});pg.wait_for_timeout(200)
        chk(f.evaluate("document.getElementById('cart-panel').scrollWidth<=document.getElementById('cart-panel').clientWidth+1"),'%s: a 320 px el pedido no desborda'%tag)
        pg.close()
        # contraste claro y oscuro (menú + pedido abierto)
        for sch in ('light','dark'):
            pg=b.new_page(viewport={'width':390,'height':844},color_scheme=sch);pg.clock.install(time=1761750000000)
            pg.goto('file://'+F+'#menu');pg.wait_for_timeout(1300)
            f=[x for x in pg.frames if x!=pg.main_frame][0]
            try: f.click('#ag-yes',timeout=1500)
            except Exception: pass
            f.evaluate("var q=document.querySelectorAll('.sheet .qty-btn.plus');q[0].click();q[1].click();document.getElementById('cart-bar').click()");pg.wait_for_timeout(300)
            bad=f.evaluate(CJS)
            chk(not bad,'%s %s: todos los textos del menú y del pedido con contraste suficiente %s'%(tag,'claro' if sch=='light' else 'oscuro',[(x['t'][:25],x['r']) for x in bad[:5]]))
            pg.close()
        for sch in ('light','dark'):
            pg=b.new_page(viewport={'width':1280,'height':900},color_scheme=sch)
            pg.goto('file://'+F+'#acceso');pg.wait_for_timeout(1100)
            pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(600)
            bad=[]
            for sc in pg.evaluate("NAV.map(n=>n[0])"):
                pg.evaluate("go('%s')"%sc);pg.wait_for_timeout(260)
                bad+=[(sc,x['t'][:25],x['r']) for x in pg.evaluate(CJS)]
            chk(not bad,'%s panel %s: todas las pantallas con contraste suficiente %s'%(tag,'claro' if sch=='light' else 'oscuro',bad[:5]))
            pg.close()
    b.close()
print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
