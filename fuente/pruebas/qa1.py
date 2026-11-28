# V27.41 · Botones grandes en Inicio y barra inferior clara del celular
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/qa.html'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':390,'height':844});ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.goto(URL+'#acceso');pg.wait_for_timeout(900);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(600)
    ev("go('inicio')");pg.wait_for_timeout(400)
    chk(pg.locator('#qa-grid button').count()>=5,'Inicio: «¿Qué querés hacer?» con botones grandes')
    chk(pg.locator('#qa-grid button.pri[data-qa=vender]').count()==1,'Vender destacado')
    h=ev("document.querySelector('#qa-grid button').offsetHeight");chk(h>=72,'botones de al menos 72 px de alto (%d)'%h)
    chk([x for x in ev("[...document.querySelectorAll('#vb-tab button span:last-child')].map(s=>s.textContent)")]==['Inicio','Vender','Productos','Caja','Clientes','Más'],'barra inferior: Inicio · Vender · Productos · Caja · Clientes · Más')
    pg.click('#qa-grid [data-qa=inventario]');pg.wait_for_timeout(400);chk(ev("curScreen")=='inventario','«Productos» abre Inventario')
    chk(ev("document.querySelector('#vb-tab [data-id=inventario]').classList.contains('on')"),'la pestaña activa se resalta')
    pg.click('#vb-tab [data-id=inicio]');pg.wait_for_timeout(400)
    pg.click('#qa-grid [data-qa=_nuevo]');pg.wait_for_timeout(600);chk(pg.locator('#pm-n').count()==1,'«Nuevo producto» abre el alta')
    pg.keyboard.press('Escape');pg.wait_for_timeout(200)
    pg.click('#vb-tab [data-id=vender]');pg.wait_for_timeout(500);chk(ev("curScreen")=='vender','la barra lleva a Vender')
    if ev("typeof posV3Bar==='function'"):
        ev("A.padd({dataset:{id:S.products.find(p=>p.active&&stockOf(p)>2).id}})");pg.wait_for_timeout(300)
        r1=ev("document.querySelector('#pos-mbar').getBoundingClientRect().bottom");r2=ev("document.querySelector('#vb-tab').getBoundingClientRect().top")
        chk(r1<=r2+1,'la barra del ticket queda arriba de la barra inferior')
    chk(not ev("[...document.querySelectorAll('#top a[href=\"#menu\"]')].some(a=>a.offsetWidth)"),'cabecera del celular sin «Ver menú público»')
    pg.set_viewport_size({'width':1366,'height':800});pg.wait_for_timeout(300);ev("go('inicio')");pg.wait_for_timeout(400)
    chk(pg.locator('#qa-grid button').count()>=5 and not pg.is_visible('#vb-tab'),'en la PC: botones arriba del Resumen y sin barra inferior')
    chk(not errs,'sin errores JS %s'%errs[:3])
    b.close()
print(f"{sum(res)} OK / {len(res)-sum(res)} FALLAN de {len(res)}")
