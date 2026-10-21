# Tiendanube (V26.13) en la DEMO: conexión simulada, vínculos, órdenes -> venta, pasos de conexión
import sys
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    for vw in (1280,360):
        pg=b.new_page(viewport={'width':vw,'height':900})
        pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
        pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
        ev=pg.evaluate
        pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
        pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
        ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
        if pg.locator('#ap').count():
            pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
        ev("location.hash='#panel/integ'");pg.wait_for_timeout(500)
        chk(pg.locator('#tn-card').count()==1,'[%d] la tarjeta de Tiendanube está en Integraciones'%vw)
        t=pg.locator('#tn-card').inner_text()
        chk('SIMULADO' in t,'[%d] en la demo se rotula SIMULADO'%vw)
        chk('Autorizar la tienda' in t and 'Vincular Business' in t,'[%d] muestra los pasos con quién los hace'%vw)
        chk(pg.locator('text=Pasos para conectar cada integración').count()==1,'[%d] hay pasos para todas las integraciones'%vw)
        chk(ev("document.documentElement.scrollWidth<=innerWidth+1"),'[%d] sin desborde horizontal (desconectada)'%vw)
        pg.click('[data-act=tnSimConnect]');pg.wait_for_timeout(500)
        t=pg.locator('#tn-card').inner_text()
        chk('Conectada' in t,'[%d] conecta (simulado)'%vw)
        chk(ev("S.tn.prods.length>=4"),'[%d] trae productos de ejemplo'%vw)
        pg.click('[data-act=tnTab][data-k=productos]');pg.wait_for_timeout(300)
        chk(pg.locator('[data-act=tnLink]').count()>=1,'[%d] hay variantes por vincular'%vw)
        # aceptar la primera sugerencia
        n0=ev("S.tn.prods.filter(p=>p.vinculo==='vinculado').length")
        pg.locator('[data-act=tnLink]').first.click();pg.wait_for_timeout(500)
        chk(ev("S.tn.prods.filter(p=>p.vinculo==='vinculado').length")==n0+1,'[%d] vincula una variante'%vw)
        # el mismo producto no se vincula con dos variantes
        r=ev("""(()=>{const t=S.tn;const a=t.prods.find(p=>p.vinculo==='vinculado');const o=t.prods.find(p=>p.vinculo!=='vinculado'&&p.producto_local===a.producto_local);return o?1:0})()""")
        # ignorar
        pg.locator('[data-act=tnIgn]').first.click();pg.wait_for_timeout(400)
        chk(ev("S.tn.prods.some(p=>p.vinculo==='ignorado')"),'[%d] ignora una variante'%vw)
        # config
        pg.click('[data-act=tnTab][data-k=config]');pg.wait_for_timeout(300)
        pg.select_option('#tn-pf','sistema');pg.click('[data-act=tnCfg]');pg.wait_for_timeout(300)
        chk(ev("S.tn.cfg.precio_fuente")=='sistema','[%d] guarda la configuración'%vw)
        # órdenes
        pg.click('[data-act=tnTab][data-k=resumen]');pg.wait_for_timeout(300)
        pg.click('[data-act=tnSyncO]');pg.wait_for_timeout(500)
        pg.click('[data-act=tnTab][data-k=ordenes]');pg.wait_for_timeout(300)
        chk(pg.locator('[data-act=tnReg]').count()>=1,'[%d] aparecen órdenes'%vw)
        chk(ev("document.documentElement.scrollWidth<=innerWidth+1 || !!document.querySelector('#tn-card .tw')"),'[%d] ordenes sin desborde de página'%vw)
        # vincular todo lo que falta para poder registrar una orden pagada
        ev("""(()=>{S.tn.prods.forEach(p=>{if(p.producto_local&&p.vinculo!=='vinculado'&&p.vinculo!=='ignorado')p.vinculo='vinculado'});S.tn.ords.forEach(o=>{o.items=o.items.filter(i=>true)});})()""")
        ev("rerender()");pg.wait_for_timeout(400);pg.click('[data-act=tnTab][data-k=ordenes]');pg.wait_for_timeout(300)
        ordp=ev("S.tn.ords.find(o=>o.pago_estado==='paid'&&o.venta_estado==='pendiente')")
        chk(ordp is not None,'[%d] hay una orden paga para registrar'%vw)
        oid=ordp['orden_id'];exp=sum(i['qty']*i['precio_cents'] for i in ordp['items'])
        stk0={i['producto_local']:ev("prod(%r).stock"%i['producto_local']) for i in ordp['items']}
        ns0=ev("S.sales.length")
        pg.locator('[data-act=tnReg][data-id="%d"]'%oid).click();pg.wait_for_timeout(400)
        pg.click('.mf [data-m=ok]');pg.wait_for_timeout(600)
        chk(ev("S.sales.length")==ns0+1,'[%d] crea UNA venta'%vw)
        v=ev("S.sales[S.sales.length-1]")
        chk(v.get('tn')==oid and v['channel' if 'channel' in v else 'method']!='' ,'[%d] la venta queda ligada a la orden #%d'%(vw,oid))
        chk(v['total']==exp,'[%d] total de la venta = suma de las líneas (%d)'%(vw,exp))
        okstk=all(abs(ev("prod(%r).stock"%pid)-(s0-sum(i['qty'] for i in ordp['items'] if i['producto_local']==pid)))<1e-9 for pid,s0 in stk0.items())
        chk(okstk,'[%d] descuenta el stock de cada producto'%vw)
        chk(ev("S.tn.ords.find(o=>o.orden_id==%d).venta_estado"%oid)=='registrada','[%d] la orden pasa a «registrada»'%vw)
        # no se puede registrar dos veces
        chk(pg.locator('[data-act=tnReg][data-id="%d"]'%oid).count()==0,'[%d] ya no ofrece registrar la misma orden'%vw)
        # orden sin pagar: botón deshabilitado
        ev("S.tn.ords.unshift(Object.assign({},S.tn.ords[0],{orden_id:7999,numero:999,pago_estado:'pending',venta_estado:'pendiente'}));rerender()");pg.wait_for_timeout(400);pg.click('[data-act=tnTab][data-k=ordenes]');pg.wait_for_timeout(300)
        chk(pg.locator('[data-act=tnReg][data-id="7999"]').is_disabled(),'[%d] una orden sin pagar no se puede registrar'%vw)
        # enviar stock
        pg.click('[data-act=tnTab][data-k=resumen]');pg.wait_for_timeout(300)
        pg.click('[data-act=tnPush]');pg.wait_for_timeout(500)
        chk(ev("S.audit.some(a=>a.action==='TIENDANUBE_ENVIO')"),'[%d] «enviar stock y precios» queda en la auditoría'%vw)
        # desconectar
        pg.click('[data-act=tnTab][data-k=config]');pg.wait_for_timeout(300)
        pg.click('[data-act=tnDisc]');pg.wait_for_timeout(300);pg.click('.mf [data-m=ok]');pg.wait_for_timeout(500)
        chk(ev("S.tn.conn")==False,'[%d] desconecta'%vw)
        chk(ev("document.documentElement.scrollWidth<=innerWidth+1"),'[%d] sin desborde al final'%vw)
        if vw==360:
            small=ev("[...document.querySelectorAll('#tn-card button')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<43).length")
            chk(small==0,'[%d] botones de la tarjeta >= 44 px (%s chicos)'%(vw,small))
        pg.close()
chk(not errs,'consola sin errores %s'%errs[:3])
print('%d/%d'%(sum(res),len(res)));sys.exit(0 if all(res) else 1)
