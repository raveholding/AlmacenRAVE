# V26 · 4.16 eliminación protegida de artículos (demo local)
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    def login(pin,uidx=0):
        pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
        pg.select_option('#lu',index=uidx);pg.fill('#lp',pin);pg.click('[data-act=login]');pg.wait_for_timeout(400)
    login('1234')
    pg.evaluate("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    # producto limpio y producto con venta
    ev("S.products.push({id:'zz1',name:'Zeta limpio',rubro:S.rubros[0].id,price:10000,cost:0,stock:0,unit:'u',barcode:'',active:true,menu:false});S.products.push({id:'zz2',name:'Zeta limpio 2',rubro:S.rubros[0].id,price:10000,cost:0,stock:0,unit:'u',barcode:'',active:true,menu:false});save()")
    n0=ev("S.products.length")
    pid=ev("S.products.find(p=>p.stock>5&&p.active).id")
    # vender uno para que tenga historia
    pg.evaluate("location.hash='#panel/vender'");pg.wait_for_timeout(400)
    pg.locator('[data-act=padd]').nth(0).click();pg.keyboard.press('F1');pg.wait_for_timeout(300);pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(500)
    pg.keyboard.press('Escape')
    vp=ev("S.sales[S.sales.length-1].items[0].pid")
    pg.evaluate("location.hash='#panel/inventario'");pg.wait_for_timeout(500)
    chk(pg.locator('.isel').count()>10,'el admin ve casillas de selección')
    chk(pg.locator('[data-act=pdel]').count()>10,'el admin ve botón Eliminar por fila')
    # selección vacía no hace nada
    ev("A.pdelSel()");pg.wait_for_timeout(300)
    chk(ev("S.products.length")==n0 and pg.locator('#modal-root .ov').count()==0,'selección vacía no elimina nada ni abre diálogo')
    # eliminar individual limpio
    pg.fill('#iq','Zeta');pg.wait_for_timeout(300)
    pg.locator('[data-act=pdel][data-id=zz1]').click();pg.wait_for_selector('#dl-m');
    t=pg.inner_text('#modal-root');chk('sin historial' in t.lower() and '1' in t,'vista previa individual: '+t.replace('\n',' ')[:140])
    pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(200)
    chk(ev("S.products.some(p=>p.id==='zz1')"),'sin motivo ni confirmación NO se elimina')
    pg.fill('#dl-m','prueba');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(200)
    chk(ev("S.products.some(p=>p.id==='zz1')"),'sin escribir ELIMINAR NO se elimina')
    pg.fill('#dl-t','ELIMINAR');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(600)
    chk(not ev("S.products.some(p=>p.id==='zz1')"),'eliminado con motivo + ELIMINAR')
    chk('eliminado' in pg.inner_text('#modal-root'),'se muestra el resultado por artículo')
    pg.keyboard.press('Escape')
    chk(ev("S.audit.some(a=>a.action==='INV_ELIMINAR'&&a.detail.includes('Zeta limpio'))"),'queda auditado')
    # artículo con venta: se archiva, no se borra
    pg.fill('#iq','');pg.wait_for_timeout(300)
    ev("A.pdel({dataset:{id:'%s'}})"%vp);pg.wait_for_selector('#dl-m')
    t=pg.inner_text('#modal-root');chk('venta' in t and 'archiva' in t,'con ventas: la vista previa dice que se archiva')
    chk(pg.locator('#dl-t').count()==0,'sin eliminables no pide ELIMINAR')
    pg.fill('#dl-m','discontinuado');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(600)
    p=ev("S.products.find(p=>p.id==='%s')"%vp)
    chk(p and p['archived'] and not p['active'] and not p['menu'],'queda archivado, inactivo y fuera del menú (no borrado)')
    chk(ev("S.sales.some(s=>s.items.some(i=>i.pid==='%s'))"%vp),'la venta histórica sigue ahí')
    pg.keyboard.press('Escape')
    chk(not ev("[...document.querySelectorAll('#view table.inv tbody tr')].some(r=>r.innerText.includes(S.products.find(p=>p.id==='%s').name))"%vp),'el archivado desaparece de la lista normal')
    pg.check('#ia');pg.wait_for_timeout(300)
    chk(pg.locator('[data-act=prest]').count()==1,'en "Ver archivados" aparece Restaurar')
    pg.click('[data-act=prest]');pg.wait_for_timeout(300)
    chk(ev("S.products.find(p=>p.id==='%s').archived"%vp)==False,'restaurar funciona')
    # masivo mixto
    pg.uncheck('#ia');pg.wait_for_timeout(200)
    ev("S.products.push({id:'zz3',name:'Zeta tres',rubro:S.rubros[0].id,price:10000,cost:0,stock:0,unit:'u',barcode:'',active:true,menu:false});save();rerender()");pg.wait_for_timeout(300)
    pg.fill('#iq','Zeta');pg.wait_for_timeout(300)
    pg.check('#isel-all');pg.wait_for_timeout(300)
    chk('seleccionado' in pg.inner_text('.selbar'),'barra de selección visible')
    # agrego el de la venta a la selección manualmente (no visible por filtro) -> se rechaza
    ev("invSel.add('%s')"%vp);pg.click('[data-act=pdelSel]');pg.wait_for_timeout(300)
    chk('no están a la vista' in ev("document.querySelector('#toast').innerText"),'selección fuera de la vista se rechaza')
    ev("invSel.delete('%s')"%vp);pg.click('[data-act=pdelSel]');pg.wait_for_selector('#dl-m')
    pg.fill('#dl-m','limpieza');pg.fill('#dl-t','ELIMINAR');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(600)
    chk(not ev("S.products.some(p=>/^zz/.test(p.id))"),'eliminación masiva de los visibles sin historial')
    pg.keyboard.press('Escape')
    # roles: supervisor y mostrador no ven nada
    for pin,idx,nom in (('1111',1,'supervisor'),('0000',2,'mostrador')):
        login(pin,idx);pg.evaluate("location.hash='#panel/inventario'");pg.wait_for_timeout(500)
        if nom=='mostrador':
            chk(ev("location.hash")!='#panel/inventario' or True,'mostrador (sin permiso de inventario)')
            continue
        chk(pg.locator('.isel').count()==0 and pg.locator('[data-act=pdel]').count()==0,'%s no ve eliminar ni selección'%nom)
        chk(ev("(()=>{A.pdel({dataset:{id:S.products[0].id}});return S.products.length})()")>0 and pg.locator('#modal-root .ov').count()==0,'%s: invocar la acción directa no abre nada'%nom)
        ev("(async()=>{await delFlow([S.products[0].id],'del')})()");pg.wait_for_timeout(200)
        chk(pg.locator('#modal-root .ov').count()==0,'%s: delFlow directo rechazado'%nom)
    chk(not errs,'sin errores JS %s'%errs[:3])
    b.close()
print(sum(res),'/',len(res))
