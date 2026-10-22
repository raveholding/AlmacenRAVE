# Demo Kini Distribuidora: arranca mayorista (un solo dueño), 2 cajas + principal abiertas, proveedores de ejemplo; vaciar y empezar de cero
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    for W in (1280,360):
        ctx=b.new_context(viewport={'width':W,'height':900});pg=ctx.new_page()
        pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
        pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
        ev=pg.evaluate
        pg.goto('file:///tmp/rave/kini.html#acceso');pg.wait_for_timeout(900)
        pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
        if W==1280:
            chk(ev("S.cfg.biz")=='owner' and ev("ownerMode()"),'arranca como mayorista de un solo dueño')
            chk(ev("S.tenant.name")=='Kini Distribuidora' and 'Sistema Kini' in pg.inner_text('#side'),'marca Kini en el panel')
            chk(ev("S.cfg.cashProfile")=='main' and ev("S.registers.length")==3,'2 cajas + 1 principal definidas')
            chk(ev("S.sessions.filter(s=>!s.closedAt).length")==3,'las 3 cajas están abiertas con dinero')
            chk(ev("S.suppliers.length")==3 and ev("S.suppliers.filter(s=>s.saldo>0).length")==3,'3 proveedores de ejemplo con deuda')
            chk(ev("S.pOrders.filter(o=>o.estado==='Solicitada').length")==1,'una orden de compra pendiente de recibir')
            chk(ev("S.cfg.wholesale&&S.cfg.wholesale.on"),'venta mayorista por presentación activa')
            for sc in ['inicio','vender','caja','arqueo','inventario','compras','cajasx','config','roles','clientes']:
                ev(f"go('{sc}')");pg.wait_for_timeout(250)
            # pagar a un proveedor desde la caja principal
            prov=ev("S.suppliers[0].id");ev("go('proveedores')");pg.wait_for_timeout(300)
            ev("A.cmpPay({dataset:{id:'%s'}})"%prov);pg.wait_for_timeout(300)
            opts=ev("[...document.querySelectorAll('#pg-t option')].map(o=>o.textContent)")
            chk(len(opts)==3,'al pagar el dueño elige entre las 3 cajas abiertas: %s'%opts)
            pg.fill('#pg-m','50000');pg.select_option('#pg-t','k-sp')
            pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(500)
            m=ev("S.movs.filter(x=>x.type==='egreso'&&x.amount===5000000)")
            chk(len(m)==1 and m[0]['sessId']=='k-sp','el pago de $ 50.000 salió de la caja principal')
            e=ev("xferCreate({id:'kt1',from:'r1',to:'rp',amount:2000000,rubro:'',motivo:'retiro a principal'})")
            chk(e=='','traspaso de Caja 1 a la principal sin pedir rubro (%s)'%e)
            pg.evaluate("go('config')");pg.wait_for_timeout(300)
            chk(pg.locator('[data-act=emptyDemo]').count()==1 and pg.locator('[data-act=resetDemo]').count()==1,'Configuración ofrece «Borrar todo y empezar vacío» y «Volver a los datos de ejemplo»')
            pg.click('[data-act=emptyDemo]');pg.wait_for_timeout(200);pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(400)
            chk(ev("S.products.length")==0 and ev("S.suppliers.length")==0 and ev("S.sessions.length")==0 and ev("S.sales.length")==0,'vacío: sin productos, proveedores, cajas abiertas ni ventas')
            chk(ev("S.cfg.biz")=='owner' and ev("S.registers.length")==3 and ev("S.users.some(u=>u.role==='admin')"),'vacío: sigue siendo mayorista, con las cajas definidas y el administrador')
            pg.reload();pg.wait_for_timeout(900)
            chk(ev("S.products.length")==0 and ev("S.suppliers.length")==0,'al recargar sigue vacía (no vuelven los ejemplos solos)')
            pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
            ev("go('config')");pg.wait_for_timeout(300);pg.click('[data-act=resetDemo]');pg.wait_for_timeout(200)
            pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(1200)
            chk(ev("S.suppliers.length")==3 and ev("S.sessions.filter(s=>!s.closedAt).length")==3,'«Volver a los datos de ejemplo» recupera proveedores y cajas abiertas')
        else:
            bad=[]
            for sc in ['inicio','vender','caja','arqueo','inventario','compras','cajasx','config']:
                ev(f"go('{sc}')");pg.wait_for_timeout(300)
                if ev("document.documentElement.scrollWidth")>W+2: bad.append(sc)
            chk(not bad,'360 px sin desbordes: %s'%bad)
        ctx.close()
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
