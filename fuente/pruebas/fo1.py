# V26.50 · Vender: después de sumar un artículo el cursor vuelve a «Buscar artículo» (con el texto seleccionado)
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
def login(pg):
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    pg.evaluate("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    ev=pg.evaluate;foc=lambda:ev("document.activeElement&&document.activeElement.id")
    login(pg)
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(500)
    chk(foc()=='psearch','al entrar a Vender el cursor está en «Buscar artículo»')
    # buscar y tocar una ficha
    q=ev("(()=>{const p=S.products.find(x=>x.active&&x.price>0&&x.unit==='u'&&!x.pres?.length);return p.name.split(' ')[0]})()")
    pg.fill('#psearch',q);pg.wait_for_timeout(300)
    t=pg.locator('#pgrid [data-act=padd], [data-act=padd]').first;t.click();pg.wait_for_timeout(200)
    chk(ev("pos.lines.length")==1,'se sumó el artículo tocando la ficha')
    chk(foc()=='psearch','después de tocar la ficha el cursor vuelve al buscador')
    chk(ev("(()=>{const s=document.getElementById('psearch');return s.selectionStart===0&&s.selectionEnd===s.value.length&&s.value.length>0})()"),'con la búsqueda anterior seleccionada (escribir la reemplaza)')
    pg.keyboard.type('zzz');pg.wait_for_timeout(200)
    chk(ev("document.getElementById('psearch').value")=='zzz','escribir de inmediato reemplaza la búsqueda (sin tocar el mouse)')
    # tocar otra ficha sin buscar, dos veces seguidas
    pg.fill('#psearch','');pg.wait_for_timeout(200)
    pg.locator('[data-act=padd]').nth(1).click();pg.wait_for_timeout(150);pg.locator('[data-act=padd]').nth(1).click();pg.wait_for_timeout(150)
    chk(foc()=='psearch' and ev("pos.lines.length")==2,'varias fichas seguidas: siempre vuelve al buscador')
    # buscar + Enter con un solo resultado
    nm=ev("(()=>{const L=S.products.filter(x=>x.active&&x.price>0&&x.unit==='u');const p=L.find(a=>posFind(a.name).length===1);return p?p.name:''})()")
    if nm:
        pg.fill('#psearch',nm);pg.keyboard.press('Enter');pg.wait_for_timeout(250)
        chk(foc()=='psearch' and ev("document.getElementById('psearch').value")=='','búsqueda + Enter: suma, limpia y sigue en el buscador')
    # lector de código de barras con el cursor en el buscador
    bc=ev("(()=>{const p=S.products.find(x=>x.active&&x.barcode&&x.unit==='u');return p?p.barcode:''})()")
    if bc:
        n0=ev("pos.lines.reduce((a,l)=>a+l.qty,0)")
        pg.keyboard.type(bc,delay=5);pg.keyboard.press('Enter');pg.wait_for_timeout(300)
        chk(ev("pos.lines.reduce((a,l)=>a+l.qty,0)")==n0+1 and foc()=='psearch' and ev("document.getElementById('psearch').value")=='','lector: suma y el buscador queda vacío y listo')
    # etiqueta de balanza
    ok=ev("(()=>{const s='200001201250';let t=0;for(let i=0;i<12;i++)t+=(+s[i])*(i%2?3:1);if(!S.products.some(p=>String(+p.plu)==='12'))return false;document.activeElement.blur();addByCode(s+((10-t%10)%10));return true})()")
    pg.wait_for_timeout(200)
    if ok: chk(foc()=='psearch','etiqueta de balanza: vuelve al buscador')
    # editar la cantidad de una línea: NO le roba el cursor
    pg.locator('[data-fld=qty]').first.click();pg.keyboard.press('Control+A');pg.keyboard.type('3');pg.keyboard.press('Tab');pg.wait_for_timeout(200)
    chk(foc()!='psearch','editar la cantidad no manda el cursor al buscador')
    # quitar una línea
    pg.locator('[data-act=prm]').first.click();pg.wait_for_timeout(200)
    chk(foc()=='psearch','al quitar una línea vuelve al buscador')
    # cobro: cancelar y cobrar
    ev("A.cobrar()");pg.wait_for_timeout(300)
    chk(foc()!='psearch','con la ventana de cobro abierta no se roba el cursor')
    pg.keyboard.press('Escape');pg.wait_for_timeout(300)
    if pg.locator('#modal-root .ov').count():ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())");pg.wait_for_timeout(200)
    chk(foc()=='psearch','al cerrar el cobro vuelve al buscador')
    ev("pos.method='efectivo';A.cobrar()");pg.wait_for_timeout(300)
    pg.click('#modal-root .ov .btn.gold');pg.wait_for_timeout(600)
    while pg.locator('#modal-root .ov').count():
        pg.keyboard.press('Escape');pg.wait_for_timeout(250)
        if pg.locator('#modal-root .ov').count():ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())");pg.wait_for_timeout(200)
    chk(ev("pos.lines.length")==0 and foc()=='psearch','venta cobrada y ticket cerrado: listo en el buscador para el próximo cliente')
    # mayorista: botón de presentación (si la build lo tiene)
    if ev("typeof wsOn==='function'&&wsOn()&&S.products.some(p=>(p.pres||[]).length)"):
        ev("(()=>{const p=S.products.find(x=>(x.pres||[]).length);document.activeElement.blur();wsAddPres(p,wsPres(p)[0]);})()");pg.wait_for_timeout(250)
        chk(foc()=='psearch','presentación mayorista (Display/Fardo): vuelve al buscador')
    b2=p.chromium.launch(args=['--no-proxy-server'])
    # celular: no abre el teclado solo
    ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);m=ctx.new_page();m.on('pageerror',lambda e:errs.append(str(e)[:300]))
    login(m);m.evaluate("location.hash='#panel/vender'");m.wait_for_timeout(500)
    m.evaluate("A.padd({dataset:{id:S.products.find(x=>x.active&&x.price>0).id}})");m.wait_for_timeout(200)
    chk(m.evaluate("document.activeElement&&document.activeElement.id")!='psearch','en el celular no pone el cursor solo (no abre el teclado tapando el ticket)')
    b2.close()
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
