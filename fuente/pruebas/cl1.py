# V26.59 · olvido de clave: se le pide al administrador del comercio, no al soporte del desarrollador
from playwright.sync_api import sync_playwright
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);errs=[]
    pg=b.new_page();pg.on('pageerror',lambda e:errs.append(str(e)[:200]));pg.route('**/*.supabase.co/**',lambda r:r.abort())
    pg.goto('file:///tmp/rave/out_cliente.html#acceso');pg.wait_for_timeout(1200)
    chk(pg.locator('[data-act=cloudMode][data-mode=ayuda]').inner_text().strip()=='Olvidé mi clave','el acceso tiene «Olvidé mi clave»')
    pg.click('[data-act=cloudMode][data-mode=ayuda]');pg.wait_for_timeout(300)
    t=pg.inner_text('#login')
    chk('administrador de tu comercio' in t and 'Usuarios y permisos' in t,'indica pedírsela al administrador del comercio')
    chk(pg.locator('#cl-sc').count()==0 and pg.locator('#cl-go').count()==0,'ya no envía el pedido al soporte del desarrollador')
    pg2=b.new_page();pg2.goto('file:///tmp/rave/index.html#acceso');pg2.wait_for_timeout(1000)
    chk('administrador del comercio' in pg2.inner_text('#login') and 'desarrollador' in pg2.inner_text('#login'),'en las demos: ¿Olvidaste tu PIN? → administrador del comercio, no el desarrollador')
    chk(not errs,'sin errores %s'%errs)
    b.close()
print('%d/%d'%(sum(res),len(res)))
