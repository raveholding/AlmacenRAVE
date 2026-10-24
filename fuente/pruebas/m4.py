# V26.21 · menú: productos por sección (mostrar, destacado, orden), vista previa, aviso de sección vacía y recorte de la foto
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate;M='#modal-root .ov >> nth=-1'
    ok=lambda:pg.locator(M).locator('.mf [data-m=ok]').click()
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("go('menuadmin')");pg.wait_for_timeout(400)
    sec='vino'
    pg.click('#msec-card [data-act=msecProds][data-id="%s"]'%sec);pg.wait_for_timeout(300)
    n=pg.locator('#msec-card .msec-p').count();chk(n>3,'«Productos» despliega los productos de la sección (%d)'%n)
    first=ev("secProds('%s').map(p=>p.id)"%sec)
    pg.locator('#msec-card [data-act=msecPMove][data-d="1"]').first.click();pg.wait_for_timeout(300)
    now=ev("secProds('%s').map(p=>p.id)"%sec)
    chk(now[0]==first[1] and now[1]==first[0],'↓ cambia el orden del producto')
    cat=[x['id'] for x in ev("pubCatalog().productos.filter(x=>x.cat==='%s')"%sec)]
    chk(cat[:2]==now[:2],'el menú público respeta ese orden')
    pid=now[0]
    pg.locator('#msec-card [data-act=msecFeat][data-id="%s"]'%pid).click();pg.wait_for_timeout(300)
    chk(ev("prod('%s').featured"%pid)==True and ev("pubCatalog().productos.find(x=>x.id==='%s').destacado"%pid)==True,'★ lo marca como destacado en el menú')
    pg.locator('#msec-card [data-mpon="%s"]'%pid).uncheck();pg.wait_for_timeout(300)
    chk(ev("pubCatalog().productos.every(x=>x.id!=='%s')"%pid),'destildar «en el menú» lo saca del menú público')
    pg.locator('#msec-card [data-mpon="%s"]'%pid).check();pg.wait_for_timeout(300)
    # aviso de sección vacía
    pg.click('[data-act=msecAdd]');pg.wait_for_timeout(200);pg.fill('#ms-n','Novedades');ok();pg.wait_for_timeout(300)
    chk(pg.locator('#msec-empty').count()==1 and 'Novedades' in pg.inner_text('#msec-empty'),'avisa que «Novedades» no tiene productos')
    # vista previa con el borrador
    ev("A.mpPublish()");pg.wait_for_timeout(300);ev("rerender()");pg.wait_for_timeout(300)
    pg.fill('#mp-ti','TITULO BORRADOR');ev("A.mpSave()");pg.wait_for_timeout(300)
    pg.click('#msec-card [data-act=mpPreview]');pg.wait_for_timeout(2200)
    fr=pg.frame_locator('#mp-prev')
    if fr.locator('#age-gate.open').count(): fr.locator('#ag-yes').click();pg.wait_for_timeout(300)
    chk('TITULO BORRADOR' in fr.locator('body').inner_text(),'«Ver cómo queda» muestra el borrador antes de publicar')
    ok();pg.wait_for_timeout(300)
    chk(ev("pubSite().title")!='TITULO BORRADOR','al cerrar, el público sigue viendo lo publicado')
    # recorte de la foto
    ev("go('inventario')");pg.wait_for_timeout(300);ev("A.pedit({dataset:{id:'%s'}})"%pid);pg.wait_for_timeout(300)
    pg.set_input_files('#pm-imgf','/tmp/rave/t/foto_h.jpg');pg.wait_for_timeout(800)
    chk(pg.locator('#crop-cv').count()==1,'al cargar una foto se abre «Recortar la foto»')
    pg.locator('[data-crar="1"]').click();ev("(()=>{const z=document.getElementById('crop-z');z.value='2';z.dispatchEvent(new Event('input'))})()");pg.wait_for_timeout(200)
    bx=pg.locator('#crop-cv').bounding_box();pg.mouse.move(bx['x']+bx['width']/2,bx['y']+bx['height']/2);pg.mouse.down();pg.mouse.move(bx['x']+bx['width']/2+60,bx['y']+bx['height']/2,steps=5);pg.mouse.up()
    ok();pg.wait_for_timeout(800)
    chk('Foto lista' in pg.inner_text('#pm-imgs'),'la foto recortada queda lista')
    dims=ev("(async()=>{const d=document.querySelector('#modal-root .ov:last-child')._img;const i=new Image();await new Promise(r=>{i.onload=r;i.src=d});return [i.naturalWidth,i.naturalHeight]})()")
    chk(dims[0]==dims[1] and dims[0]<=480,'quedó cuadrada y achicada (%s)'%dims)
    # cancelar el recorte no cambia la foto
    pg.set_input_files('#pm-imgf','/tmp/rave/t/foto_h.jpg');pg.wait_for_timeout(800)
    pg.locator(M).locator('.mf [data-m=x]').click();pg.wait_for_timeout(300)
    chk('No se cambió' in pg.inner_text('#pm-imgs'),'cancelar el recorte deja la foto como estaba')
    ok();pg.wait_for_timeout(300)
    chk(ev("prod('%s').img.startsWith('data:image/')"%pid),'se guarda la foto recortada en el producto')
    pg.set_viewport_size({'width':360,'height':800});ev("go('menuadmin')");pg.wait_for_timeout(300);pg.click('#msec-card [data-act=msecProds][data-id="%s"]'%sec);pg.wait_for_timeout(300)
    chk(ev("document.documentElement.scrollWidth")<=362,'la lista de productos entra en 360 px')
    print('errores:',errs[:4]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
