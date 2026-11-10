# V26.64 · El Resumen (dashboard) es sólo del administrador/dueño; otro rol lo ve si el administrador le da el permiso «dashboard».
import sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':850});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    def login(i,pin):
        pg.goto(URL+'#acceso');pg.wait_for_timeout(900)
        if ev("!!user"):ev("A.logout()");pg.wait_for_timeout(500);pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
        pg.select_option('#lu',index=i);pg.fill('#lp',pin);pg.click('[data-act=login]');pg.wait_for_timeout(700)
    login(0,'1234')
    chk(ev("user.role")=='admin' and ev("curScreen")=='inicio','el administrador entra al Resumen')
    chk(ev("can('dashboard')"),'el administrador tiene el permiso «dashboard»')
    chk(ev("!(S.roles.supervisor||[]).includes('dashboard')&&!(S.roles.mostrador||[]).includes('dashboard')"),'por defecto ningún otro rol lo tiene')
    ev("go('roles')");pg.wait_for_timeout(400)
    chk('Ver el Resumen (dashboard del negocio)' in pg.inner_text('#view'),'el administrador lo puede otorgar en Usuarios y permisos')
    login(1,'1111')
    chk(ev("user.role")=='supervisor','entra el supervisor')
    chk(ev("curScreen")!='inicio','el supervisor no aterriza en el Resumen (%s)'%ev("curScreen"))
    ev("go('inicio')");pg.wait_for_timeout(400)
    chk(ev("curScreen")!='inicio' and 'Ventas netas' not in pg.inner_text('#view'),'ni llamándolo directo ve el Resumen')
    chk(pg.locator('#side [data-id=inicio]').count()==0,'no está en la barra lateral')
    ev("uxOpen&&uxOpen()");pg.wait_for_timeout(200);ev("(()=>{const i=document.querySelector('.ux-pal input');if(i){i.value='resumen';i.dispatchEvent(new Event('input'))}})()");pg.wait_for_timeout(300)
    chk(not any('Resumen' in t for t in ev("[...document.querySelectorAll('.ux-pal [data-k], .ux-pal li, .ux-pal button')].map(x=>x.innerText)")),'el buscador Ctrl+K no lo ofrece')
    pg.keyboard.press('Escape')
    login(0,'1234');ev("S.roles.supervisor.push('dashboard');audit('PERMISO_OTORGADO','dashboard → rol supervisor');save()")
    login(1,'1111');ev("go('inicio')");pg.wait_for_timeout(400)
    chk(ev("curScreen")=='inicio','con el permiso otorgado, el supervisor ve el Resumen')
    login(2,'0000')
    chk(ev("curScreen")=='vender','el mostrador entra a Vender')
    ev("go('inicio')");pg.wait_for_timeout(300)
    chk(ev("curScreen")=='vender','el mostrador no ve el Resumen')
    chk(not errs,'sin errores %s'%errs[:2])
    b.close()
print('%d/%d'%(sum(res),len(res)))
