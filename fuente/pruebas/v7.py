# V26.1 · cobro mixto, vuelto, cuenta corriente parcial, cierre de caja
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
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    # producto de $ 60.000 y cliente con límite
    ev("S.products.push({id:'mx1',name:'Producto 60k',rubro:S.rubros.find(r=>r.kind==='rubro').id,price:6000000,cost:3000000,stock:50,unit:'u',barcode:'',active:true,menu:false});")
    ev("S.customers.push({id:'cmx',num:901,name:'Ana',last:'Prueba',wa:'3875550001',limit:5000000,consent:{club:true}});")
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(400)
    def addp():
        ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
        ev("pos.lines=[];pos.cust='';pos.mix=false;pos.pays=[];pos.method='efectivo';pos.recv=''")
        ev("A.padd({dataset:{id:'mx1'}})")
    # --- 1) venta mixta 40k efectivo + 20k cta cte ---
    addp();pg.keyboard.press('F12');pg.wait_for_timeout(300)
    pg.click('[data-act=cbmix]');pg.wait_for_timeout(200)
    chk(pg.locator('#mixbox').count()==1,'modo mixto muestra los pagos del cliente')
    pg.fill('#mx-a0','40000');pg.wait_for_timeout(100)
    t=pg.inner_text('#mx-sum')
    chk('Faltan' in t and '20.000' in t,'avisa cuánto falta: '+t.replace('\n',' ')[:80])
    pg.click('[data-act=cbrest][data-i="1"]');pg.wait_for_timeout(150)
    t=pg.inner_text('#mx-sum')
    chk('Cubierto exacto' in t and 'no ingresa a la caja' in t,'botón Resto completa 20.000 y avisa que cta cte no entra a caja')
    # sin cliente -> rechaza
    pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("S.sales.filter(s=>s.method==='mixto').length")==0,'sin cliente identificado NO deja cobrar a cuenta corriente')
    chk(pg.locator('#modal-root .dlg[aria-label="Confirmar cobro"]').count()==1,'el cobro sigue abierto para corregir')
    # elegir cliente
    pg.fill('#cb-q','Ana');pg.wait_for_timeout(150);pg.click('[data-act=cbcust]');pg.wait_for_timeout(200)
    # límite 50.000 < 20.000? ok (20.000 <= 50.000). efectivo recibido 50.000 -> vuelto 10.000
    pg.fill('#mx-r0','50000');pg.wait_for_timeout(150)
    box=pg.locator('#mx-sum .vuelto')
    chk(box.count()==1 and '10.000' in box.inner_text() and 'VUELTO A ENTREGAR' in box.inner_text(),'alerta visual de VUELTO $ 10.000 (recibe 50.000, imputa 40.000)')
    chk(pg.locator('#mx-sum .vuelto').get_attribute('role')=='alert','la alerta es role=alert (lectores de pantalla)')
    pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(500)
    s=ev("S.sales.filter(s=>s.method==='mixto').slice(-1)[0]")
    chk(s and s['total']==6000000 and s['paid']==4000000 and s['balance']==2000000,'venta guardada: total 60.000, cobrado 40.000, saldo 20.000')
    chk(s['pstate']=='parcial' and s['fiado'] is True if False else (s['pstate']=='parcial' and s['fiado']==True),'estado Pago parcial con saldo deudor vinculado')
    chk(s['vuelto']==1000000 and s['recv']==5000000,'vuelto 10.000 y recibido 50.000 guardados')
    chk([ (x['m'],x['a']) for x in s['pays']]==[('efectivo',4000000),('fiado',2000000)],'pagos: efectivo 40.000 + cta cte 20.000 (sin vuelto)')
    chk(ev("debtOf('cmx')")==2000000,'deuda del cliente = 20.000 (débito automático)')
    chk(ev("allAudit().some(a=>a.action==='CTA_CTE_DEBITO')"),'movimiento de débito auditado')
    chk(pg.locator('#modal-root .vuelto').count()>=1,'el comprobante también muestra el vuelto a entregar')
    pg.click('#modal-root [data-m=cancel]') if pg.locator('#modal-root [data-m=cancel]').count() else None
    # --- 2) el arqueo cuenta SÓLO el efectivo real ---
    a=ev("arqueoCalc(openSess(),arqInputs(openSess()))")
    base=ev("openSess().opening")
    chk(a['aCtaCte']>=2000000 and a['cobrado']==a['total']-a['aCtaCte'],'arqueo: cobrado real = total − cuenta corriente')
    chk(ev("(arqueoCalc(openSess(),arqInputs(openSess())).byMethod.efectivo||{}).gross")>=4000000,'arqueo: efectivo incluye 40.000 netos de vuelto')
    efBefore=ev("arqueoCalc(openSess(),arqInputs(openSess())).cashSales")
    # --- 3) vender 100% a cta cte y luego otra mixta supera límite ---
    addp();ev("pos.cust='cmx'");pg.keyboard.press('F12');pg.wait_for_timeout(300)
    pg.click('[data-act=cbmix]');pg.wait_for_timeout(200)
    pg.select_option('#mx-m0','fiado');pg.wait_for_timeout(150)
    pg.select_option('#mx-m1','efectivo');pg.wait_for_timeout(150)
    pg.fill('#mx-a0','40000');pg.click('[data-act=cbrest][data-i="1"]');pg.wait_for_timeout(100)
    pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("S.sales.filter(s=>s.method==='mixto').length")==1,'cta cte 40.000 + deuda 20.000 supera el límite de 50.000: rechazada')
    pg.keyboard.press('Escape');pg.wait_for_timeout(200)
    # --- 4) suma inválida bloqueada por el motor (aunque se saltee la UI) ---
    r=ev("(()=>{pos.lines=[];A.padd({dataset:{id:'mx1'}});return commitSale('mixto',false,'local',pos.lines,{custId:'cmx',pays:[{m:'efectivo',a:1000000},{m:'debito',a:1000000}]});})()")
    chk('no coincide' in (r.get('err') or ''),'commitSale rechaza suma ≠ total: '+(r.get('err') or '')[:70])
    r=ev("commitSale('mixto',false,'local',pos.lines,{custId:'',pays:[{m:'efectivo',a:3000000},{m:'fiado',a:3000000}]})")
    chk('identificar al cliente' in (r.get('err') or ''),'cta cte sin cliente (consumidor final) rechazada')
    r=ev("commitSale('mixto',false,'local',pos.lines,{custId:'cmx',pays:[{m:'efectivo',a:3000000},{m:'efectivo',a:3000000}]})")
    chk('repetido' in (r.get('err') or ''),'medio repetido rechazado')
    r=ev("commitSale('mixto',false,'local',pos.lines,{custId:'cmx',recv:100,pays:[{m:'efectivo',a:3000000},{m:'debito',a:3000000}]})")
    chk('menor al importe' in (r.get('err') or ''),'efectivo recibido menor al imputado rechazado')
    r=ev("commitSale('mixto',false,'local',pos.lines,{custId:'cmx',pays:[{m:'qr',a:3000000},{m:'efectivo',a:3000000}]})")
    chk('no se pueden combinar' in (r.get('err') or ''),'QR no se combina')
    nS=ev("S.sales.length");stock=ev("prod('mx1').stock")
    # una venta rechazada no toca stock ni ventas ni deuda
    chk(ev("S.sales.length")==nS and ev("debtOf('cmx')")==2000000,'ventas rechazadas no dejan datos huérfanos (deuda intacta)')
    # --- 5) mixta efectivo + débito, sin deuda ---
    stk0=ev("prod('mx1').stock")
    r=ev("commitSale('mixto',false,'local',pos.lines,{custId:'',pays:[{m:'efectivo',a:2500000},{m:'debito',a:3500000}]})")
    chk(r.get('sale') and r['sale']['pstate']=='pagada' and r['sale']['balance']==0,'efectivo + débito = pagada, saldo 0')
    chk(ev("prod('mx1').stock")==stk0-1,'descuenta stock una sola vez')
    # --- 6) cierre: texto con cobrado real y cta cte ---
    L=ev("(()=>{const s=openSess();const a=arqueoCalc(s,arqInputs(s));return reportText(buildReport(a,dkey(now()),'Admin',arqInputs(s)),false);})()")
    chk('COBRADO REAL' in L and 'A CUENTA CORRIENTE' in L and 'NO entró a caja' in L,'reporte de cierre separa cobrado real y deuda de clientes')
    # --- 7) libro de cuenta corriente en la ficha del cliente ---
    ev("location.hash='#panel/clientes'");pg.wait_for_timeout(400)
    ev("A.cuEdit({dataset:{id:'cmx'}})") if ev("typeof A.cuEdit")=='function' else None
    h=ev("ccLedgerHTML('cmx')")
    chk('Pago parcial' in h and '20.000' in h and 'Saldo' in h,'ficha del cliente: débito de 20.000 + estado Pago parcial + saldo')
    # cobro de deuda reduce saldo
    e=ev("fiadoPay('cmx',500000,'transferencia')")
    chk(e=='' and ev("debtOf('cmx')")==1500000,'cobro de deuda $ 5.000 → saldo 15.000')
    L2=ev("ccLedger('cmx')")
    chk(L2[-1]['bal']==1500000 and L2[-1]['kind']=='credito','libro: crédito y saldo corrido correctos')
    # --- 8) ticket ---
    tk=ev("(()=>{const s=S.sales.find(x=>x.method==='mixto'&&x.fiado);return ticketText?ticketText(s):'';})()")
    chk('PAGO PARCIAL' in tk and 'Vuelto' in tk,'ticket imprime pago parcial y vuelto')
    # --- 9) anular venta mixta devuelve la deuda ---
    sid=ev("S.sales.find(x=>x.method==='mixto'&&x.fiado).id")
    ev("voidCore(S.sales.find(x=>x.id==='%s'),'prueba')"%sid)
    chk(ev("debtOf('cmx')")==-500000 or ev("debtOf('cmx')")<=0,'anular la venta mixta saca el débito de la cuenta corriente')
    # --- 10) responsive 360 ---
    ev("S.customers.find(c=>c.id==='cmx').limit=9000000")
    addp();pg.set_viewport_size({'width':360,'height':740});ev("location.hash='#panel/vender'");pg.wait_for_timeout(300)
    ev("A.cobrar()");pg.wait_for_timeout(300);pg.click('[data-act=cbmix]');pg.wait_for_timeout(200)
    ov=ev("document.documentElement.scrollWidth>document.documentElement.clientWidth+1")
    dw=ev("(()=>{const d=document.querySelector('#modal-root .dlg');return d?d.scrollWidth>d.clientWidth+1:false})()")
    chk(not ov and not dw,'cobro mixto sin desborde a 360 px')
    chk(not errs,'sin errores de consola: '+str(errs[:2]))
    b.close()
print(sum(res),'OK /',len(res)-sum(res),'FALLAN de',len(res))
