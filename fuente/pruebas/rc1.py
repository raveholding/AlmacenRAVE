# V26.50 · Cobro: «Importe recibido» obligatorio en efectivo, debajo del total y arriba de los medios; F12 deja el cursor ahí
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    ev=pg.evaluate;foc=lambda:ev("document.activeElement&&document.activeElement.id")
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(500)
    ev("window.mk=()=>{const p=S.products.find(x=>x.unit==='u'&&x.active&&x.price>0);pos.lines=[{pid:p.id,name:p.name,rubro:p.rubro,qty:1,price:1250000,cost:0,unit:'u',list:1250000,man:1}];pos.method='efectivo';pos.mix=false;pos.recv='';pos.coupon='';posCart();}")
    ev("mk()");pg.keyboard.press('F12');pg.wait_for_timeout(400)
    chk(pg.locator('#modal-root .ov').count()==1,'F12 abre el cobro')
    chk(foc()=='rcv','F12 deja el cursor directamente en «Importe recibido»')
    o=ev("""(()=>{const w=cobroW();const tot=w.querySelector('.total'),r=w.querySelector('#rcvbox'),c=w.querySelector('[data-act=cbmet]');
      const pos=(a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?1:0;return [pos(tot,r),pos(r,c)]})()""")
    chk(o==[1,1],'orden: total → importe recibido → botones de medio de pago')
    T=pg.inner_text('#rcvbox')
    chk('obligatorio' in T.lower() and 'opcional' not in T.lower(),'dice «obligatorio» (ya no «opcional»)')
    # sin importe: no cobra
    n0=ev("S.sales.length");pg.keyboard.press('F12');pg.wait_for_timeout(400)
    chk(ev("S.sales.length")==n0 and pg.locator('#modal-root .ov').count()==1 and 'importe recibido' in pg.inner_text('#toast').lower(),'sin importe recibido NO cobra y avisa')
    chk(foc()=='rcv','y vuelve a dejar el cursor en el importe')
    # importe menor: no cobra
    pg.keyboard.type('10000');pg.keyboard.press('Enter');pg.wait_for_timeout(400)
    chk(ev("S.sales.length")==n0 and 'menor al total' in pg.inner_text('#toast'),'importe menor al total ($10.000 < $12.500) → no cobra')
    # el importe se mantiene al redibujar (cupón inválido, por ejemplo)
    pg.fill('#rcv','20000')
    if pg.locator('#cb-cup').is_visible(): pg.fill('#cb-cup','NOEXISTE');pg.click('[data-act=cbcup]')
    else: ev("cobroRender()")
    pg.wait_for_timeout(300)
    chk(ev("document.getElementById('rcv')&&document.getElementById('rcv').value")=='20000','el importe escrito no se borra al aplicar un cupón (antes se perdía)')
    chk('7.500' in pg.inner_text('#vuelto'),'vuelto en vivo: $ 7.500')
    ev("(()=>{const c=document.getElementById('cb-cup');if(c)c.value='';pos.coupon='';cobroRender();})()");pg.wait_for_timeout(200)
    chk(ev("document.getElementById('rcv').value")=='20000','sigue el importe después de quitar el cupón')
    pg.click('#rcv');pg.keyboard.press('Enter');pg.wait_for_timeout(600)
    s=ev("S.sales[S.sales.length-1]")
    chk(ev("S.sales.length")==n0+1 and s['recv']==2000000 and s['vuelto']==750000,'Enter en el importe cobra: recibido $20.000, vuelto $7.500')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # Justo
    ev("mk()");pg.keyboard.press('F12');pg.wait_for_timeout(400);pg.click('[data-act=rcvJusto]');pg.wait_for_timeout(150)
    chk(ev("document.getElementById('rcv').value")=='12500' and 'sin vuelto' in pg.inner_text('#vuelto').lower(),'«Justo» completa el total exacto')
    pg.keyboard.press('F12');pg.wait_for_timeout(600)
    chk(ev("S.sales[S.sales.length-1].vuelto")==0 and ev("S.sales[S.sales.length-1].recv")==1250000,'cobrado justo, sin vuelto')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # otro medio: no pide efectivo y no arrastra lo escrito
    ev("mk()");pg.keyboard.press('F12');pg.wait_for_timeout(400);pg.keyboard.type('50000')
    pg.keyboard.press('F2');pg.wait_for_timeout(300)
    chk(pg.locator('#rcv').count()==0 and 'no se ingresa efectivo' in pg.inner_text('#rcvbox'),'débito (F2): en el mismo lugar dice «no se ingresa efectivo»')
    pg.keyboard.press('F12');pg.wait_for_timeout(600)
    s=ev("S.sales[S.sales.length-1]")
    chk(s['method']=='debito' and not s.get('recv'),'débito cobra sin importe recibido y no arrastra los $50.000 escritos')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    ev("mk();pos.method='debito';posCart()");pg.keyboard.press('F12');pg.wait_for_timeout(400);pg.keyboard.press('F1');pg.wait_for_timeout(300)
    chk(foc()=='rcv','al volver a efectivo (F1) el cursor va al importe recibido')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # con descuento por efectivo, «Justo» usa el total final
    ev("S.payadj={on:true,stack:false,rules:{efectivo:{sign:-1,kind:'pct',v:1000,ver:1}}};mk()");pg.keyboard.press('F12');pg.wait_for_timeout(400)
    pg.click('[data-act=rcvJusto]');pg.wait_for_timeout(150)
    chk(ev("document.getElementById('rcv').value")=='11250','con descuento por efectivo −10 %, «Justo» = $11.250')
    pg.keyboard.press('F12');pg.wait_for_timeout(600)
    chk(ev("S.sales[S.sales.length-1].total")==1125000 and ev("S.sales[S.sales.length-1].vuelto")==0,'cobrado $11.250 sin vuelto')
    ev("S.payadj.on=false")
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
