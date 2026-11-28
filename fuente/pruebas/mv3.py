# V27.33 · Menú público compacto (brief UX/UI): encabezado, banner, eventos arriba, categorías, «+ Agregar», barra del pedido con envío gratis,
# pedido guardado al recargar, Club plegado, pie compacto, legales en ventana, mensaje de WhatsApp ordenado, 390 px sin desborde
import sys,urllib.parse
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/ev_demo.html'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);ctx=b.new_context(viewport={'width':1280,'height':900})
    pg=ctx.new_page();ev=pg.evaluate
    pg.goto(URL+'#acceso');pg.wait_for_timeout(900);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    if ev("typeof evCfg==='function'"):
        n=ev("(()=>{const c=evCfg();const n=evAutoLink(c);c.pub=true;c.items.forEach(x=>delete x.auto);save();return n})()")
        chk(n>=1,'vinculación automática de «Armá tu evento» con productos publicados (%s)'%n)
    pg.wait_for_timeout(2500)
    m=ctx.new_page();m.set_viewport_size({'width':390,'height':844});m.on('pageerror',lambda e:errs.append(str(e)[:200]))
    m.goto(URL);m.wait_for_timeout(2000)
    fr=[f for f in m.frames if f!=m.main_frame][0]
    if fr.locator('#age-gate.open').count(): fr.locator('#ag-yes').click();m.wait_for_timeout(400)
    H=fr.evaluate("document.documentElement.scrollHeight")
    chk(H<13500,'la página es más corta (%d px; antes ~15.500; incluye Club y mapa)'%H)
    chk(fr.evaluate("document.querySelector('header').offsetHeight")<150,'encabezado compacto (%d px)'%fr.evaluate("document.querySelector('header').offsetHeight"))
    chk(not fr.is_visible('.pitch') and not fr.is_visible('.sale-fab') and not fr.is_visible('.info-block'),'sin textos largos ni botón flotante del desarrollador arriba')
    chk(fr.evaluate("!!document.querySelector('footer .lang-toggle')"),'el idioma pasa al pie')
    if fr.locator('#ev-block').count():
        chk(fr.evaluate("document.querySelector('.promo-banner').nextElementSibling.id")=='ev-block','«Armá tu evento» queda debajo del banner de envío gratis')
    chips=fr.evaluate("[...document.querySelectorAll('.cat-chip')].map(c=>c.textContent.trim())")
    chk(len(chips)>2 and any('🔥' in c for c in chips[:2]),'categorías con íconos y Promos primero: %s'%chips[:4])
    card=fr.locator('.section:not(.alc-off) :is(.card,.row,.featured)').first
    chk('Agregar' in fr.evaluate("getComputedStyle(document.querySelector('.section:not(.alc-off) :is(.card,.row,.featured) .qty-btn.plus'),'::before').content"),'botón «+ Agregar» en cada producto')
    chk(fr.evaluate("document.querySelector('.section:not(.alc-off) :is(.card,.row,.featured) .qty-btn.plus').getAttribute('aria-label')||''").startswith('Agregar'),'botón accesible con el nombre del producto')
    card.locator('.qty-btn.plus').click();m.wait_for_timeout(300)
    chk(fr.is_visible('#cart-bar') and 'Ver pedido' in fr.inner_text('#cart-bar'),'barra del pedido con total y «Ver pedido»')
    fr.locator('.section:not(.alc-off) :is(.card,.row,.featured) .qty-btn.plus').nth(1).click();m.wait_for_timeout(300)
    alc=fr.evaluate("!document.querySelector('.section.alc-off')")
    if alc: chk(fr.locator('#cart-bar .v3-free').count()==1,'la barra muestra el progreso del envío gratis: %s'%(fr.inner_text('#cart-bar .v3-free') if fr.locator('#cart-bar .v3-free').count() else '—'))
    n0=fr.evaluate("Object.values(RAVE_CART.items()).reduce((s,x)=>s+x.qty,0)")
    m.reload();m.wait_for_timeout(2000);fr=[f for f in m.frames if f!=m.main_frame][0]
    if fr.locator('#age-gate.open').count(): fr.locator('#ag-yes').click();m.wait_for_timeout(300)
    n1=fr.evaluate("Object.values(RAVE_CART.items()).reduce((s,x)=>s+x.qty,0)")
    chk(n1==n0 and n0>0 and fr.is_visible('#cart-bar'),'el pedido sigue después de recargar (%s)'%n1)
    # WhatsApp
    fr.evaluate("window.__wa='';window.open=(u)=>{window.__wa=u;return null}")
    fr.evaluate("document.getElementById('cart-bar').click()");m.wait_for_timeout(300)
    fr.evaluate("document.getElementById('btn-send').click()");m.wait_for_timeout(300)
    u=urllib.parse.unquote(fr.evaluate("window.__wa||''"))
    chk('• ' in u and ' x ' in u and 'Total estimado' in u,'mensaje ordenado: «• cantidad x producto - subtotal» y total')
    chk('Dirección' in u and ('Forma de pago' in u or 'PAGO' in u.upper()),'el mensaje deja lugar para dirección y forma de pago')
    fr.evaluate("document.getElementById('btn-x')&&document.getElementById('btn-x').click()");m.wait_for_timeout(200)
    # Club
    if fr.locator('#club-mini').count():
        chk(not fr.is_visible('#club-form'),'el Club arranca plegado')
        fr.locator('#club-mini [data-club=join]').click();m.wait_for_timeout(400)
        chk(fr.is_visible('#club-form'),'«Sumarme gratis» despliega el formulario')
    # legales
    fr.locator('footer [data-v3=legal]').click();m.wait_for_timeout(300)
    chk(fr.is_visible('#v3-legal') and fr.is_visible('#legal-block'),'«Términos y privacidad» abre la ventana legal')
    fr.locator('#v3-legal .v3-x').click();m.wait_for_timeout(200)
    fr.locator('footer [data-v3=arrep]').click();m.wait_for_timeout(300)
    chk(fr.is_visible('#arrep-btn'),'«Botón de arrepentimiento» lleva al botón')
    fr.keyboard.press('Escape') if hasattr(fr,'keyboard') else m.keyboard.press('Escape');m.wait_for_timeout(200)
    chk(fr.locator('footer .v3-dev').count()==1 and fr.locator('.dev-credit').count()==1,'créditos de Vincular Business en una línea (se despliegan)')
    chk(fr.locator('#team-access-btn').count()==1 and fr.locator('#cp-coupon-in').count()==1,'se conservan acceso del equipo y cupón')
    chk(not fr.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth+1"),'390 px sin desborde')
    chk(not errs,'sin errores JS %s'%errs[:3])
    b.close()
print(f"{sum(res)} OK / {len(res)-sum(res)} FALLAN de {len(res)}")
