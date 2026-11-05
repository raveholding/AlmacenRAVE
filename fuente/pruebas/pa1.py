# V26.49 · 4.33 · recargo / descuento por medio de pago (administrable por el dueño)
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
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    chk(ev("S.payadj&&S.payadj.on===false&&S.payadj.rules.efectivo&&S.payadj.rules.efectivo.v===1000"),'demo: reglas de ejemplo cargadas y APAGADAS')
    chk(ev("paOn()")==False,'apagado: no hay ajuste')
    # ---- configuración por pantalla (administrador) ----
    ev("location.hash='#panel/config'");pg.wait_for_timeout(500)
    chk(pg.locator('#pa-cfg').count()==1,'Configuración muestra «Recargos y descuentos por medio de pago»')
    pg.check('#pa-on')
    pg.select_option('#pa-t-efectivo','desc');pg.fill('#pa-v-efectivo','10');pg.select_option('#pa-k-efectivo','pct')
    pg.select_option('#pa-t-credito','rec');pg.fill('#pa-v-credito','10');pg.select_option('#pa-k-credito','pct')
    pg.select_option('#pa-t-transferencia','desc');pg.fill('#pa-v-transferencia','500');pg.select_option('#pa-k-transferencia','fixed')
    pg.select_option('#pa-t-debito','no')
    pg.click('[data-act=paSave]');pg.wait_for_timeout(300)
    chk(pg.locator('#modal-root .ov').count()==1 and 'Ley 25.065' in pg.inner_text('#modal-root'),'recargo a crédito → aviso legal (no bloquea)')
    pg.click('#modal-root .ov .btn.gold');pg.wait_for_timeout(300)
    R=ev("S.payadj")
    chk(R['on'] and R['rules']['efectivo']=={'sign':-1,'kind':'pct','v':1000,'ver':R['rules']['efectivo']['ver']} and R['rules']['credito']['sign']==1 and R['rules']['transferencia']=={'sign':-1,'kind':'fixed','v':50000,'ver':R['rules']['transferencia']['ver']} and 'debito' not in R['rules'],'reglas guardadas: efectivo −10 %%, crédito +10 %%, transferencia −$500: %s'%R['rules'])
    chk(R.get('legalAck') and ev("allAudit().some(a=>a.action==='CONFIG_RECARGOS')&&allAudit().some(a=>a.action==='RECARGO_AVISO_LEGAL')"),'cambio y aviso legal en Auditoría')
    pg.fill('#pa-v-efectivo','60');pg.click('[data-act=paSave]');pg.wait_for_timeout(200)
    chk(ev("S.payadj.rules.efectivo.v")==1000,'porcentaje 60 por ciento rechazado')
    # ---- ventas ----
    ev("window.mk=(q)=>{const p=S.products.find(x=>x.unit==='u'&&x.active&&x.price>0&&!x.age);return[{pid:p.id,name:p.name,rubro:p.rubro,qty:q||1,price:1000000,cost:p.cost,unit:'u',list:1000000,man:1}]}")
    r=ev("(()=>{const r=commitSale('efectivo',false,'local',mk(),{recv:1000000});if(r.err)return r.err;const s=r.sale;return{t:s.total,p:s.pays,v:s.vuelto,pa:s.items.map(i=>i.pa),lt:s.items.reduce((a,i)=>a+lineTotal(i),0),sub:s.sub,adj:s.adj.map(a=>[a.m,a.amt,a.label])}})()")
    chk(isinstance(r,dict) and r['t']==900000 and r['p'][0]['a']==900000 and r['p'][0]['b']==1000000 and r['p'][0]['adj']==-100000,'$10.000 en efectivo −10 %% → total $9.000 (pago guarda base y ajuste): %s'%r)
    chk(isinstance(r,dict) and r['v']==100000,'vuelto sobre el importe final: recibe $10.000 → vuelto $1.000')
    chk(isinstance(r,dict) and r['pa']==[-100000] and r['lt']==900000 and r['sub']==1000000,'ajuste repartido en la línea: Σ lineTotal = total')
    chk(isinstance(r,dict) and r['adj'][0][0]=='efectivo' and 'Descuento Efectivo 10 %' in r['adj'][0][2],'foto de la regla en la venta')
    r=ev("(()=>{const r=commitSale('credito',false,'local',mk(),{});return r.err||r.sale.total})()")
    chk(r==1100000,'crédito +10 % → $11.000')
    r=ev("(()=>{const r=commitSale('transferencia',false,'local',mk(),{pdSkip:1});return r.err||r.sale.total})()")
    chk(r==950000,'transferencia −$500 → $9.500 (%s)'%r)
    r=ev("(()=>{const r=commitSale('debito',false,'local',mk(),{});return r.err||[r.sale.total,!!r.sale.adj]})()")
    chk(r==[1000000,False],'débito sin regla → $10.000, sin ajuste')
    r=ev("(()=>{const r=commitSale('mixto',false,'local',mk(),{pays:[{m:'efectivo',a:600000},{m:'credito',a:400000}],recv:600000});if(r.err)return r.err;return[r.sale.total,r.sale.pays.map(p=>[p.m,p.a])]})()")
    chk(r==[980000,[['efectivo',540000],['credito',440000]]],'mixto $6.000 efectivo (−$600) + $4.000 crédito (+$400) → $9.800: %s'%r)
    r=ev("(()=>{const r=commitSale('mixto',false,'local',mk(),{pays:[{m:'efectivo',a:500000},{m:'credito',a:400000}]});return r.err||'sin error'})()")
    chk('no coincide' in r,'mixto con bases que no suman el total → rechazado: %s'%r)
    # cuenta corriente sin ajuste
    r=ev("(()=>{const c=S.customers.find(x=>x.status!=='suspendido'&&x.status!=='baja');if(!c)return 'sin cliente';c.limit=Math.max(c.limit||0,50000000);const r=commitSale('fiado',false,'local',mk(),{custId:c.id});return r.err||r.sale.total})()")
    chk(r==1000000,'cuenta corriente: sin ajuste ($10.000): %s'%r)
    # tienda online: no se aplica el ajuste del mostrador
    r=ev("(()=>{const r=commitSale('efectivo',false,'tiendanube',mk(),{});return r.err||r.sale.total})()")
    chk(r==1000000,'venta online (canal no local) sin ajuste')
    # arqueo: el efectivo esperado sube lo que realmente entró
    a0=ev("arqueoCalc(openSess(),arqInputs(openSess())).expectedCash")
    ev("commitSale('efectivo',false,'local',mk(),{})")
    a1=ev("arqueoCalc(openSess(),arqInputs(openSess())).expectedCash")
    chk(a1-a0==900000,'arqueo: efectivo esperado +$9.000 (no $10.000)')
    # ticket
    t=ev("ticketText(S.sales[S.sales.length-1])")
    chk('Descuento Efectivo 10 %' in t and 'Subtotal' in t,'el ticket muestra subtotal y descuento por medio de pago')
    # ---- pantalla de cobro ----
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(400)
    ev("pos.lines=mk();pos.method='efectivo';posCart()");pg.wait_for_timeout(100)
    chk('Total con Efectivo' in pg.inner_text('#panel'),'el carrito muestra el total con el ajuste del medio elegido')
    ev("A.cobrar()");pg.wait_for_timeout(300)
    T=pg.inner_text('#modal-root')
    chk('Descuento Efectivo 10 %' in T and '9.000' in T,'cobro: fila de descuento y TOTAL $9.000')
    chk(pg.locator('[data-act=cbmet][data-m=credito]').inner_text().find('+10%')>=0,'el botón de crédito muestra +10%')
    pg.fill('#rcv','10000');pg.wait_for_timeout(200)
    chk('1.000' in pg.inner_text('#vuelto'),'vuelto en pantalla sobre $9.000')
    pg.click('#modal-root .ov .btn.gold');pg.wait_for_timeout(500)
    chk(ev("S.sales[S.sales.length-1].total")==900000,'cobro desde la pantalla registra $9.000')
    # cupón + descuento (no se acumula)
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    r=ev("(()=>{const cp=S.coupons.find(c=>c.active!==false);return cp?cp.code:''})()")
    if r:
        x=ev("(()=>{const c=S.customers.find(x=>x.status!=='suspendido'&&x.status!=='baja');const r=commitSale('efectivo',false,'local',mk(),{coupon:'%s',custId:c.id});return r.err||[r.sale.benefit&&r.sale.benefit.disc,r.sale.total,!!r.sale.adj]})()"%r)
        chk(isinstance(x,list) and x[2]==False,'cupón + efectivo con «acumular» apagado → sólo el cupón: %s'%x)
    # permisos
    chk(ev("(()=>{const u=user;user=Object.assign({},u,{role:'supervisor'});const h=paCfgCard();user=u;return h})()")=='','el supervisor no ve ni edita los recargos')
    chk(ev("(()=>{const u=user;user=Object.assign({},u,{role:'supervisor'});const before=JSON.stringify(S.payadj);A.paSave();user=u;return JSON.stringify(S.payadj)===before})()"),'el supervisor no puede guardar aunque llame la acción')
    # nube: viaja como documento propio
    chk(ev("CFGIDS.includes('payadj')&&cfgWire('payadj').rules.efectivo.v===1000"),'nube: documento cfg/payadj')
    # apagado = igual que antes
    ev("S.payadj.on=false")
    chk(ev("commitSale('efectivo',false,'local',mk(),{}).sale.total")==1000000,'apagado → $10.000 como siempre')
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
