# Proveedores y compras · celular 360/320 px y tableta: sin desbordes, botones táctiles >= 44 px, capturas
from playwright.sync_api import sync_playwright
import sys
res=[];errs=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
def cuit(pref,n):
    d=[int(x) for x in (str(pref)+str(n).zfill(8))];w=[5,4,3,2,7,6,5,4,3,2]
    t=sum(a*b for a,b in zip(d,w));r=11-(t%11);r=0 if r==11 else r
    return ''.join(map(str,d))+str(r)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    for W,H in ((360,740),(320,640),(768,900),(1440,900)):
        pg=b.new_page(viewport={'width':W,'height':H})
        pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
        ev=pg.evaluate
        pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
        pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
        ev("""(()=>{const a=S.products[0],b=S.products[1];a.cost=10000;a.stock=10;b.cost=5000;b.stock=3;
          S.suppliers.push({id:'s1',razon:'Distribuidora del Norte Sociedad Anónima Muy Larga',cuit:'%s',iva:'Responsable Inscripto',email:'compras.muy.largo.de.verdad@distribuidoranorte.com.ar',tel:'3874111222',dir:'',saldo:12345600,activo:true,ts:1});
          S.suppliers.push({id:'s2',razon:'Bebidas SRL',cuit:'%s',iva:'Exento',email:'',tel:'',dir:'',saldo:0,activo:true,ts:2});
          S.pOrders.push({id:'o1',num:1,provId:'s1',estado:'Solicitada',total:2400000,fecha:Date.now(),obs:'',items:[{pid:a.id,name:a.name,qty:20,cost:120000}]});save();})()"""%(cuit(30,71234567),cuit(30,50001001)))
        def noover(tag):
            r=ev("({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})")
            chk(r['sw']<=r['cw']+1,'%dpx %s: sin scroll horizontal de página (%d/%d)'%(W,tag,r['sw'],r['cw']))
        for tab in ('prov','oc','remito','cuenta'):
            ev("cmpS.tab='%s';location.hash='#panel/proveedores'"%tab);pg.wait_for_timeout(350)
            ev("cmpS.tab='%s';cmpRepaint()"%tab);pg.wait_for_timeout(250)
            if tab=='remito':
                pg.fill('#cr-qin','bebidas');pg.select_option('#cr-prov','s2') if False else None
                ev("crS.prov='s1';cmpRemitoPaint()");pg.wait_for_timeout(200)
                ev("cmpPickOc('o1')");pg.wait_for_timeout(250)
                ev("crS.cond='contado';cmpRemitoPaint()");pg.wait_for_timeout(200)
            noover(tab)
            if W<=360:pg.screenshot(path='/tmp/rave/t/cmp_%s_%d.png'%(tab,W),full_page=True)
            small=ev("""[...document.querySelectorAll('#view .cmp button, #view .cmp select, #view .cmp input:not([type=radio]):not([type=checkbox])')].filter(e=>e.offsetParent&&(e.getBoundingClientRect().height<43.5||e.getBoundingClientRect().width<43.5)).map(e=>(e.dataset.act||e.id||e.className)+':'+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height))""")
            chk(not small,'%dpx %s: todos los controles táctiles >= 44 px %s'%(W,tab,small[:4]))
        # modales
        ev("cmpS.tab='prov';cmpRepaint()");pg.wait_for_timeout(200)
        pg.click('.cmp [data-act=cmpOcNew]');pg.wait_for_timeout(300)
        r=ev("(()=>{const d=document.querySelector('#modal-root .dlg');const b=d.getBoundingClientRect();return {l:b.left,r:b.right,sw:d.scrollWidth,cw:d.clientWidth}})()")
        chk(r['l']>=-1 and r['r']<=W+1 and r['sw']<=r['cw']+1,'%dpx modal de orden de compra entra en pantalla'%W)
        if W<=360:pg.screenshot(path='/tmp/rave/t/cmp_oc_modal_%d.png'%W)
        pg.click('[data-m=x]');pg.wait_for_timeout(150)
        pg.click('.cmp [data-act=cmpPay][data-id=s1]');pg.wait_for_timeout(300)
        r=ev("(()=>{const d=document.querySelector('#modal-root .dlg');const b=d.getBoundingClientRect();return {l:b.left,r:b.right,sw:d.scrollWidth,cw:d.clientWidth}})()")
        chk(r['l']>=-1 and r['r']<=W+1 and r['sw']<=r['cw']+1,'%dpx modal de pago entra en pantalla'%W)
        pg.click('[data-m=x]');pg.close()
    b.close()
chk(not errs,'sin errores de página %s'%errs[:2])
print('\nRESULTADO: %d/%d OK'%(sum(res),len(res)))
sys.exit(0 if all(res) else 1)
