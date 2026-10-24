# V26.18 · menú público editable: secciones del menú, sección de cada producto y foto
import base64
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("go('menuadmin')");pg.wait_for_timeout(400)
    chk(pg.locator('#msec-card').count()==1,'Menú público tiene «Secciones del menú»')
    n0=ev("pubCatalog().secciones.length")
    pg.click('[data-act=msecAdd]');pg.wait_for_timeout(200)
    pg.fill('#ms-n','Ofertas de la semana');pg.select_option('#ms-l','grid')
    pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(300)
    sec=ev("S.rubros.find(r=>r.name==='Ofertas de la semana')")
    chk(sec and sec['kind']=='msec','se crea una sección sólo del menú')
    chk(ev("pubCatalog().secciones.length")==n0+1,'aparece en el catálogo público')
    sid=sec['id']
    # no es rubro de dinero
    chk('menú' in ev("validRubro('%s','egreso')"%sid),'una sección del menú no se puede usar para ingresos/egresos')
    ev("S.sessions.push({id:'sm',caja:S.tenant.caja,openedBy:'ADMIN',openedAt:now(),opening:0,closedAt:0});save();go('caja')");pg.wait_for_timeout(300)
    pg.click('[data-act=mov][data-type=egreso]');pg.wait_for_timeout(200)
    chk(ev("[...document.querySelectorAll('#mv-r option')].every(o=>o.value!=='%s')"%sid),'y no aparece en el selector de rubro de Caja')
    ev("document.querySelectorAll('#modal-root .ov').forEach(x=>x.remove())")
    # orden
    ev("go('menuadmin')");pg.wait_for_timeout(300)
    last=ev("menuSecs(true).length-1");chk(ev("menuSecs(true)[%d].id"%last)==sid,'la nueva sección queda al final')
    pg.click('[data-act=msecMove][data-id="%s"][data-d="-1"]'%sid);pg.wait_for_timeout(300)
    chk(ev("menuSecs(true)[%d].id"%(last-1))==sid,'se puede subir de lugar')
    # producto: elegir sección y cargar foto
    pid=ev("S.products.find(p=>p.menu&&p.active&&!isKit(p)).id")
    ev("go('inventario')");pg.wait_for_timeout(300);ev("A.pedit({dataset:{id:'%s'}})"%pid);pg.wait_for_timeout(300)
    chk(pg.locator('#pm-ms').count()==1 and pg.locator('#pm-imgf').count()==1,'el producto tiene «Sección del menú» y «Foto»')
    pg.select_option('#pm-ms',sid)
    pg.set_input_files('#pm-imgf','/tmp/rave/t/foto.jpg');pg.wait_for_timeout(800)
    pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(800)
    chk('Foto lista' in pg.inner_text('#pm-imgs'),'la foto se achica sola: %s'%pg.inner_text('#pm-imgs'))
    pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(400)
    pr=ev("prod('%s')"%pid)
    chk(pr['msec']==sid,'el producto queda en la sección elegida')
    chk(pr['img'].startswith('data:image/') and len(pr['img'])<100000,'la foto se guarda achicada (%d caracteres)'%len(pr['img']))
    c=ev("pubCatalog().productos.find(x=>x.id==='%s')"%pid)
    chk(c and c['cat']==sid and c['img']==pr['img'],'en el menú público sale en «Ofertas de la semana» con su foto')
    # el menú lo muestra
    ev("location.hash='#menu'");pg.wait_for_timeout(600);ev("document.getElementById('pubframe').srcdoc=buildPubDoc()");pg.wait_for_timeout(1800)
    fr=pg.frame_locator('#pubframe')
    if fr.locator('#age-gate.open').count(): fr.locator('#ag-yes').click();pg.wait_for_timeout(300)
    chk('Ofertas de la semana' in fr.locator('body').inner_text(),'el menú público muestra la sección nueva')
    chk(fr.locator('img[src^="data:image/webp"],img[src^="data:image/jpeg"]').count()>=1,'y la foto del producto')
    # quitar foto
    ev("location.hash='#panel/inventario'");pg.wait_for_timeout(300);ev("A.pedit({dataset:{id:'%s'}})"%pid);pg.wait_for_timeout(300)
    pg.click('#pm-imgx');pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(300)
    chk(ev("pubCatalog().productos.find(x=>x.id==='%s').img"%pid)=='','«Quitar foto» la saca del menú')
    # archivo que no es imagen / imagen falsa
    chk(ev("safeImg('javascript:alert(1)')")=='' and ev("safeImg('data:image/svg+xml;base64,PHN2Zz4=')")=='','sólo se aceptan fotos WebP/JPEG/PNG (no SVG ni enlaces raros)')
    # eliminar sección: el producto vuelve a su rubro
    ev("go('menuadmin')");pg.wait_for_timeout(300);pg.click('[data-act=msecDel][data-id="%s"]'%sid);pg.wait_for_timeout(200)
    pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(300)
    chk(ev("!rub('%s')&&!prod('%s').msec"%(sid,pid)) and ev("pubCatalog().productos.find(x=>x.id==='%s').cat"%pid)==pr['rubro'],'al eliminar la sección el producto vuelve a la de su rubro')
    # ocultar una sección (rubro) desde el menú
    rid=pr['rubro'];pg.uncheck('[data-msecon="%s"]'%rid);pg.wait_for_timeout(300)
    chk(ev("pubCatalog().secciones.every(s=>s.cat!=='%s')"%rid),'se puede ocultar una sección del menú')
    pg.check('[data-msecon="%s"]'%rid);pg.wait_for_timeout(200)
    # permisos: mostrador no edita secciones
    ev("user=S.users.find(u=>u.role==='mostrador');A.msecAdd()");pg.wait_for_timeout(200)
    chk(pg.locator('#ms-n').count()==0,'un mostrador no crea secciones')
    ev("user=S.users.find(u=>u.role==='admin')")
    pg.set_viewport_size({'width':360,'height':800});ev("go('menuadmin')");pg.wait_for_timeout(300)
    chk(ev("document.documentElement.scrollWidth")<=362,'Menú público entra en 360 px')
    print('errores:',errs[:4]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
