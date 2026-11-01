# V26.36 · Vender: buscar por palabras o números del precio, cambiar el precio de un artículo y crear artículos sin salir de Vender
from playwright.sync_api import sync_playwright
import sys
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    ev=pg.evaluate
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','10000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    ev("""(()=>{const r=S.rubros.find(r=>r.kind==='rubro');
     const mk=(id,name,price,pres)=>({id,name,rubro:r.id,price,cost:200000,stock:10,unit:'u',active:true,menu:false,pres:pres||[]});
     S.products.push(mk('q1a','Fernet Branca 750 ml',1250000),mk('q1b','Fernét Branca 1 lt',1690000),mk('q1c','Gaseosa Coca Cola 2,25 lt',350000),
      mk('q1d','Cerveza Salta Rubia 473',350050),mk('q1e','Agua Mineral Pack',100000,[{lv:'f',qty:6,unit:90000}]),mk('q1f','Turron Pq Especial',99900));pos.lines=[];pos.q='';save();})()""")
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(500)
    MINE={'Fernet Branca 750 ml','Fernét Branca 1 lt','Gaseosa Coca Cola 2,25 lt','Cerveza Salta Rubia 473','Agua Mineral Pack'}
    def q(t):
        pg.fill('#psearch',t);pg.wait_for_timeout(250)
        return [x for x in ev("[...document.querySelectorAll('#pgrid .pbtn b')].map(b=>b.textContent)") if x in MINE]
    r=q('branca fernet');chk(set(r)=={'Fernet Branca 750 ml','Fernét Branca 1 lt'},'Vender: palabras en cualquier orden y sin tilde '+str(r))
    r=q('coca 2,25');chk(r==['Gaseosa Coca Cola 2,25 lt'],'Vender: palabra + número del nombre '+str(r))
    r=q('3500');chk('Gaseosa Coca Cola 2,25 lt' in r and 'Cerveza Salta Rubia 473' not in r,'Vender: precio exacto 3500 '+str(r))
    r=q('35');chk({'Gaseosa Coca Cola 2,25 lt','Cerveza Salta Rubia 473'}<=set(r) and 'Fernet Branca 750 ml' not in r,'Vender: el precio mientras se escribe («35» → $ 3.500 y $ 3.500,50) '+str(r))
    r=q('12500');chk(r==['Fernet Branca 750 ml'],'Vender: 12500 → Fernet $ 12.500 '+str(r))
    r=q('5400');chk(r==['Agua Mineral Pack'],'Vender: también por el precio de la presentación mayorista (6 × $ 900 = $ 5.400) '+str(r))
    r=q('<4000 coca');chk(r==['Gaseosa Coca Cola 2,25 lt'],'Vender: rango + palabra '+str(r))
    r=q('fernet');pg.press('#psearch','Enter');pg.wait_for_timeout(200)
    chk(ev("pos.lines.length")==0,'Enter con dos resultados no agrega nada')
    q('especial turron pq');pg.press('#psearch','Enter');pg.wait_for_timeout(300)
    chk(ev("pos.lines.length")==1 and ev("pos.lines[0].pid")=='q1f','Enter con un solo resultado lo suma al ticket')
    ev("A.padd({dataset:{id:'q1a'}})");pg.wait_for_timeout(150)
    # cambiar precio desde Vender
    q('fernet 750')
    chk(pg.locator('#pgrid [data-act=posEditPrice][data-id=q1a]').count()==1,'cada artículo tiene «✎ $» para cambiar el precio')
    pg.click('#pgrid [data-act=posEditPrice][data-id=q1a]');pg.wait_for_timeout(250)
    pg.fill('#qp-p','13000');pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("prod('q1a').price")==1300000,'el precio del inventario pasa a $ 13.000')
    chk(ev("pos.lines.find(l=>l.pid==='q1a').price")==1300000,'la línea del ticket con el precio anterior se actualiza')
    chk(ev("S.audit.some(a=>a.action==='PRECIO_PRODUCTO'&&a.detail.includes('desde Vender'))"),'queda en Auditoría')
    # precio que deja una presentación más cara por unidad
    q('agua');pg.click('#pgrid [data-act=posEditPrice][data-id=q1e]');pg.wait_for_timeout(250)
    pg.fill('#qp-p','800');pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(250)
    chk('más car' in pg.inner_text('#modal-root') and ev("prod('q1e').price")==100000,'no deja una presentación más cara por unidad que la unidad suelta')
    pg.keyboard.press('Escape');pg.wait_for_timeout(150)
    if ev("posPresEd(prod('q1e'))"):
        pg.click('#pgrid [data-act=posEditPrice][data-id=q1e]');pg.wait_for_timeout(250)
        chk(pg.locator('#qp-k0').count()==1,'mayorista: el mismo cuadro muestra el precio por unidad de cada presentación')
        pg.fill('#qp-p','1100');pg.fill('#qp-k0','950');pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(300)
        chk(ev("prod('q1e').price")==110000 and ev("prod('q1e').pres[0].unit")==95000,'mayorista: cambia unidad ($ 1.100) y Fardo ($ 950 c/u) juntos')
        chk(ev("S.audit.some(a=>a.action==='PRESENTACIONES_PRODUCTO'&&a.detail.includes('desde Vender'))"),'mayorista: el cambio de presentaciones queda en Auditoría')
        pg.click('#pgrid [data-act=posEditPrice][data-id=q1e]');pg.wait_for_timeout(250);pg.fill('#qp-k0','1200');pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(250)
        chk('más car' in pg.inner_text('#modal-root') and ev("prod('q1e').pres[0].unit")==95000,'mayorista: el Fardo no puede quedar más caro por unidad que la unidad')
        pg.keyboard.press('Escape');pg.wait_for_timeout(150)
    else:
        print('INFO sin módulo mayorista en esta demo: no se prueban presentaciones')
    # precio cero
    pg.click('#pgrid [data-act=posEditPrice][data-id=q1e]');pg.wait_for_timeout(250);pg.fill('#qp-p','0');pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(250)
    chk('mayor a cero' in pg.inner_text('#modal-root'),'precio cero rechazado');pg.keyboard.press('Escape');pg.wait_for_timeout(150)
    # crear artículo desde Vender cuando no hay resultados
    q('Vino Tinto Prueba Pq')
    chk(pg.locator('#pgrid [data-act=posNewItem]').count()==1,'sin resultados: ofrece «Crear artículo»')
    pg.click('#pgrid [data-act=posNewItem]');pg.wait_for_timeout(300)
    chk(ev("$('#pm-n').value")=='Vino Tinto Prueba Pq','el alta abre con el nombre ya escrito')
    ev("$('#pm-r').value=S.rubros.find(r=>r.kind==='rubro').id");pg.fill('#pm-f','4500');pg.fill('#pm-st','5')
    pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(400)
    np=ev("(()=>{const p=S.products.find(x=>x.name==='Vino Tinto Prueba Pq');return p?{price:p.price,stock:p.stock}:null})()")
    chk(np and np['price']==450000 and np['stock']==5,'el artículo nuevo queda en el inventario '+str(np))
    chk(ev("pos.lines.some(l=>l.name==='Vino Tinto Prueba Pq')"),'y se suma solo al ticket')
    chk(ev("$('#psearch').value")=='','la búsqueda se limpia para seguir vendiendo')
    # código de barras escrito → alta con el código cargado
    q('7790001112223');pg.click('#pgrid [data-act=posNewItem]');pg.wait_for_timeout(300)
    chk(ev("$('#pm-b').value")=='7790001112223' and ev("$('#pm-n').value")=='','un código de barras va al campo «Código de barras»')
    pg.keyboard.press('Escape');pg.wait_for_timeout(150)
    chk(pg.locator('[data-act=posNewItem]').count()>=1 and ev("!!document.querySelector('.card [data-act=posNewItem]')"),'botón «+ Artículo» junto al buscador')
    # cancelar el alta no deja el «sumar al ticket» pendiente para otra alta del inventario
    pg.click('#view .card [data-act=posNewItem]');pg.wait_for_timeout(250);pg.keyboard.press('Escape');pg.wait_for_timeout(150)
    ev("location.hash='#panel/inventario'");pg.wait_for_timeout(400)
    n0=ev("pos.lines.length");ev("A.pedit({dataset:{id:''}})");pg.wait_for_timeout(200)
    ev("$('#pm-n').value='Alta Inventario Pq';$('#pm-r').value=S.rubros.find(r=>r.kind==='rubro').id;$('#pm-f').value='1000'");pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("pos.lines.length")==n0,'un alta desde Inventario no se suma al ticket')
    # precio puesto a mano en la línea → guardar como precio del producto
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(400)
    i=ev("pos.lines.findIndex(l=>l.pid==='q1a')")
    pg.fill('[data-line="%d"][data-fld=price]'%i,'14000');pg.keyboard.press('Tab');pg.wait_for_timeout(300)
    if ev("typeof wsOn==='function'&&wsOn()&&wsChan()==='mayorista'"):
        chk(pg.locator('[data-act=posSavePrice]').count()==0,'canal mayorista: el precio puesto a mano en la línea no se pasa al inventario (se usa «✎ $»)')
    else:
        chk(pg.locator('[data-act=posSavePrice]').count()==1,'con el precio cambiado a mano aparece «Guardar … como precio»')
        pg.click('[data-act=posSavePrice]');pg.wait_for_timeout(200);pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(300)
        chk(ev("prod('q1a').price")==1400000 and pg.locator('[data-act=posSavePrice]').count()==0,'el precio de la línea pasa al inventario ($ 14.000)')
    # cobrar sigue funcionando
    r=ev("(()=>{const r=commitSale('efectivo',false,'local',pos.lines);return r.err||'ok'})()")
    chk(r=='ok','la venta se cobra normalmente')
    # sin permiso: mostrador no ve los botones
    ev("(()=>{window.__u=user.role;user.role='mostrador';rerender();})()");pg.wait_for_timeout(300)
    edit_ok=ev("can('edit_products')")
    chk(edit_ok or (pg.locator('[data-act=posEditPrice]').count()==0 and pg.locator('[data-act=posNewItem]').count()==0),'sin permiso de editar productos no aparecen «✎ $» ni «+ Artículo»')
    chk(edit_ok or ev("(()=>{A.posEditPrice({dataset:{id:'q1a'}});return document.querySelector('#qp-p')===null})()"),'y la acción se rechaza aunque se llame directo')
    ev("user.role=window.__u;rerender()");pg.wait_for_timeout(200);q('')
    for wd in (360,768):
        pg.set_viewport_size({'width':wd,'height':800});pg.wait_for_timeout(300)
        chk(ev("document.documentElement.scrollWidth<=%d"%(wd+2)),'%d px sin desborde'%wd)
    sz=ev("(()=>{const b=document.querySelector('#pgrid .pedq');if(!b)return null;const r=b.getBoundingClientRect();return [r.width,r.height]})()")
    chk(sz and sz[0]>=44 and sz[1]>=44,'«✎ $» mide al menos 44 × 44 px '+str(sz))
    ev("document.documentElement.dataset.theme='dark'");pg.wait_for_timeout(150)
    chk(ev("(()=>{const b=document.querySelector('#pgrid .pedq');const s=getComputedStyle(b);return s.color!==s.backgroundColor})()"),'tema oscuro: el botón se lee')
    chk(not errs,'sin errores de JavaScript %s'%errs[:2])
    b.close()
print('%d / %d'%(sum(res),len(res)))
