# 4.26 · menú público: «Menú local» o «Tienda con envíos» (opcional por comercio)
import sys,re,json,urllib.parse
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':390,'height':800})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    def gate():
        fr=pg.frame_locator('#pubframe')
        if fr.locator('#age-gate.open').count(): fr.locator('#ag-yes').click();pg.wait_for_timeout(300)
        return fr
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    # productos del menú: uno común y uno de rubro con alcohol
    ev("""(()=>{const base=S.rubros.find(r=>r.id==='promo');const na=Object.assign({},JSON.parse(JSON.stringify(base)),{id:'varios',name:'Varios',mNom:'Varios',mTitle:'Varios',alcohol:false});S.rubros.push(na);window.NA=na.id;
      S.products.push({id:'ska',name:'Vaso Pampa',rubro:na.id,price:1200000,cost:500000,stock:100,unit:'u',active:true,menu:true,pres:[]});
      S.products.push({id:'skb',name:'Vaso Chico <b>x</b>',rubro:na.id,price:300000,cost:100000,stock:100,unit:'u',active:true,menu:true,pres:[]});
      const al=S.rubros.find(r=>r.alcohol&&r.layout&&r.menuOn!==false);S.products.push({id:'skc',name:'Vino Test',rubro:al.id,price:900000,cost:400000,stock:100,unit:'u',active:true,menu:true,pres:[]});save();})()""")
    # ---- 1) por defecto: menú local, sin sección de envío
    ev("location.hash='#menu'");pg.wait_for_timeout(800);ev("document.getElementById('pubframe').srcdoc=buildPubDoc()");pg.wait_for_timeout(1500);fr=gate()
    chk(ev("RAVE_API.site().ship")is None,'por defecto el menú es LOCAL: no se publica ninguna configuración de envío')
    def add(pid,n=1):
        for _ in range(n): fr.locator('.card[data-id="%s"] button'%pid).last.click();pg.wait_for_timeout(120)
    add('ska');fr.locator('#cart-bar').click();pg.wait_for_timeout(400)
    chk(fr.locator('#ship-box').is_hidden(),'menú local: el carrito no muestra datos de entrega')
    sent=[]
    pg.evaluate("document.getElementById('pubframe').contentWindow.open=u=>{window.__wa=u;return null}")
    fr.locator('#btn-send').click();pg.wait_for_timeout(300)
    u0=urllib.parse.unquote(ev("window.__wa||''"));chk('Quiero hacer este pedido' in u0 and 'ENTREGA' not in u0,'menú local: el pedido por WhatsApp no cambia')
    fr.locator('#btn-close').click()
    # ---- 2) administración
    ev("A.mpPublish()");pg.wait_for_timeout(400)
    ev("location.hash='#panel/menuadmin'");pg.wait_for_timeout(500)
    chk(pg.locator('#st-card').count()==1,'Menú público tiene la tarjeta «Tipo de menú público»')
    pg.check('input[name=st-m][value=tienda]');pg.wait_for_timeout(200)
    chk(pg.locator('#st-box').is_visible(),'al elegir «Tienda con envíos» aparecen las opciones')
    # validación: sin ninguna entrega
    pg.uncheck('#st-pk');pg.click('[data-act=shSave]');pg.wait_for_timeout(300)
    chk('al menos una forma de entrega' in ev("document.querySelector('#toast').innerText"),'validación: exige una forma de entrega')
    pg.check('#st-pk');pg.fill('#st-pp','Av. Test 123, Salta');pg.fill('#st-ph','Lun a Sáb 9 a 20')
    pg.click('[data-act=shAddRow]');pg.click('[data-act=shAddRow]');pg.wait_for_timeout(200)
    rows=pg.locator('#st-rows .sh-row')
    rows.nth(0).locator('.sh-p').select_option('Buenos Aires');rows.nth(0).locator('.sh-f').fill('3500');rows.nth(0).locator('.sh-g').fill('50000');rows.nth(0).locator('.sh-e').fill('3 a 5 días');rows.nth(0).locator('.sh-c').fill('<img src=x onerror=window.__xss=1>')
    rows.nth(1).locator('.sh-p').select_option('Buenos Aires')
    pg.click('[data-act=shSave]');pg.wait_for_timeout(300)
    chk('repetida' in ev("document.querySelector('#toast').innerText"),'validación: provincia repetida')
    rows.nth(1).locator('.sh-p').select_option('Córdoba');rows.nth(1).locator('.sh-f').fill('-5')
    pg.click('[data-act=shSave]');pg.wait_for_timeout(300)
    chk('monto válido' in ev("document.querySelector('#toast').innerText"),'validación: costo negativo')
    rows.nth(1).locator('.sh-f').fill('4200,50')
    pg.check('#st-ron');pg.check('#st-rq');pg.fill('#st-re','7 a 10 días');pg.fill('#st-mn','10000');pg.fill('#st-nt','Cambios dentro de 10 días <script>window.__xss=2</script>')
    pg.check('#st-lc');pg.fill('#st-lf','1500');pg.fill('#st-lg','30000');pg.fill('#st-lz','Salta capital')
    pg.click('[data-act=shSave]');pg.wait_for_timeout(500)
    sh=ev("S.menu.ship")
    chk(sh['mode']=='tienda' and len(sh['zones'])==2 and sh['zones'][0]['fee']==350000 and sh['zones'][1]['fee']==420050 and sh['min']==1000000 and sh['alcohol']=='no','el borrador guarda importes en centavos y alcohol = sólo retiro')
    chk(ev("RAVE_API.site().ship")is None,'borrador: el público todavía NO ve la tienda (hay que publicar)')
    chk(ev("S.audit.some(e=>e.action==='MENU_TIPO')"),'auditoría MENU_TIPO')
    # permisos
    ev("window.__u=user;window.__b=JSON.stringify(S.menu.ship);user=S.users.find(x=>x.role==='mostrador')");pg.fill('#st-mn','99999');ev("A.shSave()");pg.wait_for_timeout(200)
    chk(ev("JSON.stringify(S.menu.ship)==window.__b")and 'permiso' in ev("document.querySelector('#toast').innerText"),'un usuario de mostrador no puede guardar el tipo de menú')
    ev("user=window.__u");pg.fill('#st-mn','10000')
    ev("A.mpPublish()");pg.wait_for_timeout(600)
    pub=ev("RAVE_API.site().ship")
    chk(pub and pub['mode']=='tienda' and pub['zones'][0]['fee']==3500 and pub['zones'][0]['free']==50000 and pub['rest']['quote']==True and pub['min']==10000 and pub['alcohol']==False,'publicado: importes en pesos y reglas')
    allj=json.dumps(pub)
    chk('cost' not in allj.lower() and 'stock' not in allj.lower() and 'secret' not in allj.lower(),'lo publicado no tiene datos internos')
    # ---- 3) público
    ev("location.hash='#menu'");pg.wait_for_timeout(800);ev("document.getElementById('pubframe').srcdoc=buildPubDoc()");pg.wait_for_timeout(1500);fr=gate()
    pg.evaluate("document.getElementById('pubframe').contentWindow.open=u=>{window.__wa=u;return null}")
    add('ska');fr.locator('#cart-bar').click();pg.wait_for_timeout(500)
    chk(fr.locator('#ship-box').is_visible(),'tienda: el carrito muestra la sección «Entrega»')
    chk(fr.locator('input[name=sh-m]').count()==3,'tres formas: retiro, local y otra provincia')
    chk(ev("window.__xss")is None,'XSS en transportista/condiciones: no se ejecuta')
    # retiro
    fr.locator('input[name=sh-m][value=pickup]').check();pg.wait_for_timeout(200)
    fr.locator('#btn-send').click();pg.wait_for_timeout(300)
    u=urllib.parse.unquote(ev("window.__wa||''"));chk('ENTREGA: Retiro en el local' in u,'retiro: el mensaje lo indica sin pedir domicilio')
    ev("window.__wa=''")
    # nacional: validaciones
    fr.locator('input[name=sh-m][value=nacional]').check();pg.wait_for_timeout(250)
    fr.locator('#btn-send').click();pg.wait_for_timeout(300)
    chk(ev("window.__wa||''")=='' and 'compra mínima' not in fr.locator('#sh-err').inner_text().lower() or True,'(info)')
    err=fr.locator('#sh-err').inner_text();chk(('provincia' in err.lower()) and ev("window.__wa||''")=='','sin provincia: no envía y avisa: '+err)
    fr.locator('#sh-prov').select_option('Buenos Aires');pg.wait_for_timeout(200)
    fr.locator('#btn-send').click();pg.wait_for_timeout(200)
    chk('nombre' in fr.locator('#sh-err').inner_text().lower() and ev("window.__wa||''")=='','sin datos de entrega: no envía')
    fr.locator('#sh-name').fill('Juan Pérez');fr.locator('#sh-tel').fill('11 5555-1234');fr.locator('#sh-street').fill('Av. Siempre Viva 742');fr.locator('#sh-city').fill('Lanús');fr.locator('#sh-cp').fill('12')
    fr.locator('#btn-send').click();pg.wait_for_timeout(200)
    chk('postal' in fr.locator('#sh-err').inner_text().lower(),'código postal inválido')
    fr.locator('#sh-cp').fill('1824')
    sm=fr.locator('#sh-sum').inner_text();chk('3.500' in sm and '15.500' in sm,'costo por provincia y total con envío: '+sm.replace('\n',' | '))
    fr.locator('#btn-send').click();pg.wait_for_timeout(300)
    u=urllib.parse.unquote(ev("window.__wa||''"))
    chk('ENTREGA: Envío a otra provincia' in u and 'Av. Siempre Viva 742' in u and 'Buenos Aires' in u and 'CP 1824' in u and 'Envío: $ 3.500' in u and 'Total con envío estimado: $ 15.500' in u,'el WhatsApp lleva dirección, provincia, envío y total')
    chk(ev("S.orderReqs.length")>=1 and 'Siempre Viva' not in json.dumps(ev("S.orderReqs")),'la solicitud registrada NO guarda el domicilio')
    ev("window.__wa=''")
    # envío gratis desde 50.000
    fr.locator('#btn-close').click();add('ska',4);fr.locator('#cart-bar').click();pg.wait_for_timeout(400)
    sm=fr.locator('#sh-sum').inner_text();chk('gratis' in sm.lower(),'envío gratis al superar el monto: '+sm.replace('\n',' | '))
    # resto del país a cotizar
    fr.locator('#sh-prov').select_option('__rest');pg.wait_for_timeout(200)
    sm=fr.locator('#sh-sum').inner_text();chk('cotizar' in sm.lower(),'otra provincia: a cotizar')
    fr.locator('#btn-send').click();pg.wait_for_timeout(300)
    u=urllib.parse.unquote(ev("window.__wa||''"));chk('Envío: a cotizar' in u,'el mensaje dice «a cotizar»')
    ev("window.__wa=''")
    # local
    fr.locator('input[name=sh-m][value=local]').check();pg.wait_for_timeout(250)
    chk(fr.locator('#sh-prov').count()==0,'envío local no pide provincia')
    # alcohol
    fr.locator('#btn-close').click();add('skc');fr.locator('#cart-bar').click();pg.wait_for_timeout(400)
    fr.locator('#btn-send').click();pg.wait_for_timeout(250)
    chk('alcohólicas' in fr.locator('#sh-err').inner_text() and ev("window.__wa||''")=='','alcohol: no se envía a domicilio (sólo retiro)')
    fr.locator('input[name=sh-m][value=pickup]').check();pg.wait_for_timeout(200)
    fr.locator('#btn-send').click();pg.wait_for_timeout(250)
    chk('Retiro en el local' in urllib.parse.unquote(ev("window.__wa||''")),'alcohol con retiro: permitido')
    ev("window.__wa=''")
    # mínimo
    fr.locator('#btn-clear').click();pg.wait_for_timeout(300)
    fr.locator('#btn-close').click();add('skb');fr.locator('#cart-bar').click();pg.wait_for_timeout(400)
    fr.locator('input[name=sh-m][value=local]').check();pg.wait_for_timeout(200)
    fr.locator('#btn-send').click();pg.wait_for_timeout(250)
    chk('mínima' in fr.locator('#sh-err').inner_text(),'compra mínima para envíos: '+fr.locator('#sh-err').inner_text())
    # responsive 320
    pg.set_viewport_size({'width':320,'height':640});pg.wait_for_timeout(300)
    ov=pg.frames[1].evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
    ov2=pg.frames[1].evaluate("(()=>{const e=document.getElementById('ship-box');return e.scrollWidth-e.clientWidth})()")
    chk(ov<=1 and ov2<=1,'a 320 px la sección de envío no desborda (%d,%d)'%(ov,ov2))
    chk(fr.locator('#ship-box input[type=radio]').first.evaluate("e=>e.closest('label').getBoundingClientRect().height")>=44,'opciones táctiles de 44 px o más')
    pg.set_viewport_size({'width':390,'height':800})
    # ---- 4) volver a menú local
    ev("S.menu.ship.mode='local';A.mpPublish()");pg.wait_for_timeout(500)
    chk(ev("RAVE_API.site().ship")is None,'volver a «Menú local» (publicado) apaga todo')
    ev("location.hash='#menu'");pg.wait_for_timeout(500);ev("document.getElementById('pubframe').srcdoc=buildPubDoc()");pg.wait_for_timeout(1500);fr=gate()
    add('ska');fr.locator('#cart-bar').click();pg.wait_for_timeout(400)
    chk(fr.locator('#ship-box').is_hidden(),'menú local de nuevo: sin sección de envío')
    chk(not errs,'sin errores de consola/página: %s'%errs[:3])
    b.close()
ok=sum(res);print('\n%d/%d'%(ok,len(res)));sys.exit(0 if ok==len(res) else 1)
