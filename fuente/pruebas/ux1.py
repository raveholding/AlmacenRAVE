# V26.61 · pestañas, modo mostrador, Ctrl+K, avisos en la barra, F1 → Vender, tema rápido, táctil
import sys,time
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
def login(pg,idx,pin='1234'):
    pg.goto(URL+'#acceso');pg.wait_for_timeout(900);pg.select_option('#lu',index=idx);pg.fill('#lp',pin);pg.click('[data-act=login]');pg.wait_for_timeout(500)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    login(pg,0)
    side=ev("[...document.querySelectorAll('#side a[data-ux]')].map(a=>a.dataset.ux)")
    chk('caja' in side and 'arqueo' not in side and 'cierres' not in side,'«Gestión de caja» es una sola entrada en la barra')
    chk('club' in side and 'monedero' not in side and 'cupones' not in side,'«Club» es una sola entrada en la barra')
    ev("go('arqueo')");pg.wait_for_timeout(400)
    tabs=ev("[...document.querySelectorAll('.ux-tabs [role=tab]')].map(a=>a.innerText.trim())")
    chk(len(tabs)>=3 and 'Arqueo / cierre' in tabs and 'Historial cerrado' in tabs,'pestañas de caja: %s'%tabs)
    chk(ev("document.querySelector('.ux-tabs [aria-selected=true]').innerText.trim()")=='Arqueo / cierre','la pestaña activa está marcada')
    chk(ev("document.querySelector('#side a.on').dataset.ux")=='caja','la barra marca «Gestión de caja»')
    pg.click(".ux-tabs [data-id=cierres]");pg.wait_for_timeout(400)
    chk(ev("curScreen")=='cierres','una pestaña cambia de pantalla con un toque')
    ev("go('monedero')");pg.wait_for_timeout(400)
    tabs=ev("[...document.querySelectorAll('.ux-tabs [role=tab]')].map(a=>a.innerText.trim())")
    chk('Clientes' in tabs and 'Monedero' in tabs and 'Cupones y membresías' in tabs and 'Sellos' in tabs,'pestañas del Club: %s'%tabs)
    chk(ev("Math.min(...[...document.querySelectorAll('.ux-tabs a,#side a')].map(a=>a.getBoundingClientRect().height))")>=44,'pestañas y barra con 44 px o más')
    # avisos
    ev("S.pya.push({id:'uxp',ref:'PY-1',ts:now(),customer:'x',items:[],total:1000,status:'recibido'});save()");pg.wait_for_timeout(5600)
    chk(ev("!!document.querySelector('#side a[data-ux=pedidos] .ux-bd.red.pulse')"),'pedido PedidosYa nuevo: aviso rojo que titila (sin recargar)')
    low=ev("S.products.filter(p=>p.active&&!p.archived&&stockOf(p)<=5).length")
    chk(ev("!!document.querySelector('#side a[data-ux=inventario] .ux-bd')")==(low>0),'stock bajo (%d): aviso en Inventario'%low)
    # F1
    ev("go('clientes')");pg.wait_for_timeout(300);pg.keyboard.press('F1');pg.wait_for_timeout(400)
    chk(ev("curScreen")=='vender','F1 lleva a Vender desde otra pantalla')
    chk('F1' in ev("document.querySelector('#side a[data-ux=vender]').innerText"),'la tecla F1 está impresa en «Vender»')
    # Ctrl+K
    pg.keyboard.press('Control+k');pg.wait_for_timeout(200)
    chk(pg.locator('.ux-pal').count()==1,'Ctrl + K abre el buscador universal')
    code=ev("S.products.find(p=>p.barcode&&p.active).barcode");pname=ev("S.products.find(p=>p.barcode===%r).name"%code)
    pg.keyboard.type(code);pg.wait_for_timeout(200)
    chk(pname in pg.locator('#ux-res .ux-it b').first.inner_text(),'por código de barras encuentra el artículo')
    pg.fill('#ux-q','');pg.keyboard.type('arqeo');pg.wait_for_timeout(200)
    chk('Arqueo' in pg.inner_text('#ux-res'),'tolera errores de tipeo («arqeo» → Arqueo)')
    pg.keyboard.press('Enter');pg.wait_for_timeout(400)
    chk(ev("curScreen")=='arqueo' and pg.locator('.ux-pal').count()==0,'Enter abre la pantalla elegida (2 acciones)')
    cname=ev("S.customers.find(c=>c.status!=='baja').name")
    pg.keyboard.press('Control+k');pg.keyboard.type(cname[:-1]);pg.wait_for_timeout(200)
    chk(cname in pg.inner_text('#ux-res'),'encuentra clientes')
    pg.keyboard.press('Escape');pg.wait_for_timeout(200)
    chk(pg.locator('.ux-pal').count()==0,'Esc cierra el buscador')
    pg.keyboard.press('Control+k');pg.keyboard.type('<img src=x onerror=alert(1)>');pg.wait_for_timeout(200)
    chk(ev("!document.querySelector('#ux-res img')"),'el buscador no interpreta HTML');pg.keyboard.press('Escape')
    # tema
    t=ev("(()=>{const a=performance.now();A.themeCycle();document.body.offsetHeight;return performance.now()-a})()")
    chk(t<100,'cambio de tema en %.0f ms (< 100 ms)'%t)
    g1=ev("getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()");A=ev("A.themeCycle()");g2=ev("getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()")
    chk(g1==g2 and g1!='','el color de marca (%s) no cambia con el tema'%g1)
    chk(ev("localStorage.getItem('rave.theme')") in ('auto','light','dark'),'el tema queda guardado en el navegador')
    # modo mostrador
    ev("A.logout()");login(pg,2,'0000')
    chk(ev("user.role")=='mostrador' and ev("curScreen")=='vender','el mostrador entra directo a Vender')
    side=ev("[...document.querySelectorAll('#side a[data-ux]')].map(a=>a.dataset.ux)")
    chk('inventario' not in side and 'config' not in side and 'auditoria' not in side and 'vender' in side and 'caja' in side,'modo mostrador: barra reducida %s'%side)
    chk(len(side)<=7,'modo mostrador: %d entradas'%len(side))
    pg.keyboard.press('Control+k');pg.keyboard.type('config');pg.wait_for_timeout(200)
    chk('Configuración' not in pg.inner_text('#ux-res'),'el buscador no ofrece pantallas sin permiso');pg.keyboard.press('Escape')
    for w in (360,768):
        pg.set_viewport_size({'width':w,'height':800});ev("rerender()");pg.wait_for_timeout(300)
        chk(ev("document.documentElement.scrollWidth<=window.innerWidth+1"),'sin desborde a %d px'%w)
    chk(not errs,'sin errores %s'%errs[:2])
    b.close()
print('%d/%d'%(sum(res),len(res)))
