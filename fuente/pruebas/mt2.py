# V26.58 · con la nube: la tarjeta digital muestra los sellos y el saldo del servidor apenas se abre (y se actualiza sola)
from playwright.sync_api import sync_playwright
import json
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':390,'height':844});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    st={'s':3}
    def h(route):
        if 'club_estado' in route.request.url: return route.fulfill(status=200,content_type='application/json',body=json.dumps({"ok":True,"socio":True,"num":"3","sellos":st['s'],"saldo":0}))
        return route.abort()
    pg.route('**/rdvwrrroerxikfqvpgnh.supabase.co/**',h)
    pg.goto('file:///tmp/rave/out_cliente.html#menu');pg.wait_for_timeout(800)
    link=pg.evaluate("cardLinkFor('mvepxk1dnatt8m','s3cr3ts3cr3ts3cr3ts3cr3t','Juan','1990-05-21')")
    pg.goto('file:///tmp/rave/out_cliente.html#'+link.split('#',1)[1]);pg.wait_for_timeout(2500)
    fr=pg.frame_locator('#pubframe');t=fr.locator('#mt-full').inner_text()
    chk('3 / ' in t and '0003' in t,'al abrir el enlace muestra los 3 sellos y el N.º de socio del servidor')
    fr.locator('#mt-code').click();pg.wait_for_timeout(300)
    st['s']=4;pg.evaluate("cardPoll()");pg.wait_for_timeout(800)
    t=fr.locator('#mt-full').inner_text()
    chk('4 / ' in t,'un sello nuevo aparece sin recargar')
    chk(fr.locator('#mt-codebox svg').count()==1,'al actualizarse no se cierra el código que se estaba mostrando')
    chk(not errs,'sin errores %s'%errs)
    b.close()
print('%d/%d'%(sum(res),len(res)))
