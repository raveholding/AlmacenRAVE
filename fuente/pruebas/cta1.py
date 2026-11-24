# V27.32 · App del Club: «Mi cuenta» guarda el portal del cliente mayorista y lo abre desde la app
import sys,re
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/out_cliente.html'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);ctx=b.new_context(viewport={'width':390,'height':844})
    pg=ctx.new_page();ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    # el comercio genera el enlace (Clientes → Portal de clientes); acá se arma directo con los datos locales
    pg.goto(URL);pg.wait_for_timeout(1200)
    cid=ev("(()=>{let c=S.customers.find(x=>!x.deleted);if(!c){c={id:'c_t1',name:'Kiosco',last:'Prueba',status:'activo'};S.customers.push(c);}return c.id})()")
    tok=ev("b2bPack('%s')"%cid)
    chk(bool(tok) and tok[0] in 'zj','se genera el enlace del portal')
    # el cliente abre el enlace en su celular
    pg2=ctx.new_page();pg2.on('pageerror',lambda e:errs.append('cli:'+str(e)[:300]))
    pg2.goto(URL+'#b2b='+tok);pg2.wait_for_timeout(1500)
    chk(pg2.locator('#b2b-v').count()==1 and 'Saldo' in pg2.inner_text('#b2b-v'),'el cliente ve su portal')
    chk('Mi cuenta' in pg2.inner_text('#b2b-v') and pg2.locator('#b2b-v a[href="#mitarjeta"]').count()==1,'aviso «guardado en Mi cuenta» y botón a la app')
    sv=pg2.evaluate("JSON.parse(localStorage.getItem('rave.b2b.portal')||'null')")
    chk(sv and sv['tok']==tok,'queda guardado en el celular')
    pg2.click('#b2b-v a[href="#mitarjeta"]');pg2.wait_for_timeout(2000)
    fr=pg2.frame_locator('#pubframe')
    chk(fr.locator('[data-mtab=cta]').count()==1,'la app del Club muestra la pestaña «Mi cuenta»')
    fr.locator('[data-mtab=cta]').click();pg2.wait_for_timeout(300)
    txt=fr.locator('.mt-pane[data-p=cta]').inner_text()
    chk('Portal de cliente' in txt,'«Mi cuenta» muestra el portal guardado: '+txt[:70].replace('\n',' '))
    fr.locator('[data-mta=b2b]').click();pg2.wait_for_timeout(1500)
    chk(pg2.locator('#b2b-v').count()==1 and pg2.evaluate("location.hash.startsWith('#b2b=')"),'desde la app abre el portal y se puede pedir')
    # celular sin portal y rubro no mayorista: sin pestaña
    pg3=b.new_context(viewport={'width':390,'height':844}).new_page()
    pg3.goto(URL+'#mitarjeta');pg3.wait_for_timeout(2000)
    chk(pg3.frame_locator('#pubframe').locator('[data-mtab=cta]').count()==0,'sin portal guardado (rubro almacén) no aparece la pestaña')
    chk(not errs,'sin errores JS %s'%errs[:3])
    b.close()
print(f"{sum(res)} OK / {len(res)-sum(res)} FALLAN de {len(res)}")
