# V26.51 · Con una ventana abierta, Tab / Mayús+Tab no salen de esa ventana (ni siquiera de una ventana encima de otra)
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    inside="(()=>{const o=document.querySelectorAll('#modal-root .ov');return !!o.length&&o[o.length-1].contains(document.activeElement)})()"
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count(): pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(500)
    # ventana «Cambiar precio» (la de la captura del dueño)
    pg.locator('[data-act=posEditPrice]').first.click();pg.wait_for_timeout(400)
    chk(pg.locator('#modal-root .ov').count()==1 and foc if (foc:=ev("document.activeElement.id"))=='qp-p' else pg.locator('#modal-root .ov').count()==1,'se abre «Cambiar precio»')
    ok=True;seq=[]
    for i in range(14):
        pg.keyboard.press('Tab');pg.wait_for_timeout(40);seq.append(ev("document.activeElement.id||document.activeElement.textContent.trim().slice(0,14)"))
        ok=ok and ev(inside)
    chk(ok,'14 veces Tab: el cursor nunca sale de la ventana (%s)'%' → '.join(seq[:7]))
    chk(seq.count('qp-p')>=2,'al pasar el último botón vuelve al primer campo (precio)')
    ok=True
    for i in range(14):
        pg.keyboard.press('Shift+Tab');pg.wait_for_timeout(40);ok=ok and ev(inside)
    chk(ok,'14 veces Mayús+Tab: tampoco sale')
    ev("document.getElementById('psearch').focus()");pg.wait_for_timeout(100)
    chk(ev(inside),'si algo intenta llevar el cursor a la pantalla de atrás, vuelve a la ventana')
    pg.keyboard.press('Escape');pg.wait_for_timeout(200)
    # sin ventana: el Tab funciona normal
    ev("document.getElementById('psearch').focus()");pg.keyboard.press('Tab');pg.wait_for_timeout(100)
    chk(ev("document.activeElement.id")!='psearch' and ev("document.querySelectorAll('#modal-root .ov').length")==0,'sin ventana abierta el Tab avanza normal por la pantalla')
    # cobro (ventana larga, con campos y botones)
    ev("(()=>{const p=S.products.find(x=>x.active&&x.price>0);A.padd({dataset:{id:p.id}});pos.method='efectivo';A.cobrar()})()");pg.wait_for_timeout(400)
    ok=True
    for i in range(40):
        pg.keyboard.press('Tab');pg.wait_for_timeout(25);ok=ok and ev(inside)
    chk(ok,'cobro: 40 veces Tab sin salir de la ventana')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # ventana encima de otra: ficha del cliente → WhatsApp
    ev("(()=>{const c=S.customers.find(x=>x.wa&&x.status!=='baja');A.cuEdit({dataset:{id:c.id}})})()");pg.wait_for_timeout(400)
    if pg.locator('[data-act=cuWa]').count():
        pg.click('[data-act=cuWa]');pg.wait_for_timeout(400)
        chk(ev("document.querySelectorAll('#modal-root .ov').length")==2,'WhatsApp se abre encima de la ficha')
        ok=True
        for i in range(12):
            pg.keyboard.press('Tab');pg.wait_for_timeout(30);ok=ok and ev(inside)
        chk(ok,'Tab se queda en la ventana de arriba (WhatsApp), no vuelve a la ficha')
        pg.keyboard.press('Escape');pg.wait_for_timeout(200)
        ok=True
        for i in range(10):
            pg.keyboard.press('Tab');pg.wait_for_timeout(30);ok=ok and ev(inside)
        chk(ok and ev("document.querySelectorAll('#modal-root .ov').length")==1,'al cerrarla, Tab sigue dentro de la ficha')
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
