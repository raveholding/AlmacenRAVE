# V26.49 · 4.34 H3 · Fiado y Cuenta corriente: selección obligatoria, vencimientos, saldos por tipo derivados, cobros
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
    ev("""window.T0=Date.UTC(2026,10,4,15,0,0);window.__now=()=>window.T0;
      window.mk=(c)=>{const p=S.products.find(x=>x.unit==='u'&&x.active&&x.price>0);return[{pid:p.id,name:p.name,rubro:p.rubro,qty:1,price:c,cost:0,unit:'u',list:c,man:1}]};
      window.C=S.customers.find(x=>x.status!=='suspendido'&&x.status!=='baja');C.limit=100000000;C.term=30;
      window.C2=S.customers.find(x=>x!==C&&x.status!=='suspendido'&&x.status!=='baja');C2.limit=100000000;delete C2.term;
      S.sales=S.sales.filter(s=>s.cust!==C.id&&s.cust!==C2.id);S.fiadoPays=S.fiadoPays.filter(p=>p.cust!==C.id&&p.cust!==C2.id);""")
    chk(ev("creditSplit()===true&&creditConf().fiadoDays===7"),'separación encendida, fiado a 7 días')
    r=ev("(()=>{const r=commitSale('fiado',false,'local',mk(200000),{custId:C.id,ck:'fiado'});return r.err||[r.sale.ck,dkey(r.sale.due)]})()")
    chk(r==['fiado','2026-11-11'],'fiado del 4/11 vence el 11/11: %s'%r)
    ev("window.T0+=60000")
    r=ev("(()=>{const r=commitSale('fiado',false,'local',mk(500000),{custId:C.id,ck:'cc'});return r.err||[r.sale.ck,dkey(r.sale.due),r.sale.term]})()")
    chk(r==['cc','2026-12-04',30],'cuenta corriente con plazo 30 vence el 4/12: %s'%r)
    r=ev("(()=>{const r=commitSale('fiado',false,'local',mk(100000),{custId:C2.id,ck:'cc'});return r.err||[r.sale.ck,r.sale.due||0]})()")
    chk(r==['cc',0],'cuenta corriente de un cliente sin plazo → sin vencimiento fijo')
    r=ev("(()=>{const r=commitSale('fiado',false,'local',mk(100000),{custId:C2.id});return r.err||r.sale.ck})()")
    chk(r=='cc','llamada sin tipo (otros módulos) → cuenta corriente, como siempre')
    chk(ev("JSON.stringify(ccByKind(C.id))")=='{"fiado":200000,"cc":500000}' and ev("debtOf(C.id)")==700000,'saldos por tipo: Fiado $2.000 · Cta. cte. $5.000 (total $7.000)')
    chk(ev("saleCk({})")=='cc','venta vieja sin tipo cuenta como cuenta corriente')
    # cobro FIFO: $3.000 cancela el fiado y deja $1.000 a cuenta de la CC
    ev("window.T0+=60000");e=ev("fiadoPay(C.id,300000,'transferencia','')")
    chk(e=='' and ev("JSON.stringify(ccByKind(C.id))")=='{"fiado":0,"cc":400000}','cobro de $3.000 → Fiado $0 · Cta. cte. $4.000')
    # cobro marcado para un tipo
    ev("window.T0+=60000;commitSale('fiado',false,'local',mk(200000),{custId:C.id,ck:'fiado'})")
    ev("window.T0+=60000");e=ev("fiadoPay(C.id,100000,'transferencia','','fiado')")
    chk(e=='' and ev("JSON.stringify(ccByKind(C.id))")=='{"fiado":100000,"cc":400000}','cobro de $1.000 marcado «Fiado» → baja el fiado aunque la CC sea más vieja')
    chk(ev("S.fiadoPays[S.fiadoPays.length-1].ck")=='fiado','el cobro guarda a qué tipo se aplicó primero')
    chk(ev("debtOf(C.id)")==500000 and ev("ccByKind(C.id).fiado+ccByKind(C.id).cc")==500000,'total = suma de los dos tipos')
    # el reparto por rubro de los cobros sigue cerrando
    chk(ev("Object.values(ccPayAlloc(C.id)).reduce((a,o)=>a+Object.values(o).reduce((x,y)=>x+y,0),0)")==400000,'reparto por rubro de los cobros = $4.000 cobrados')
    # mora / antigüedad usan la misma aplicación
    chk(ev("wsOpenDocs(C.id).reduce((a,d)=>a+d.left,0)")==500000,'documentos abiertos = deuda')
    # ---- pantalla de cobro ----
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(400)
    ev("pos.lines=mk(150000);pos.method='fiado';pos.cust=C.id;posCart();A.cobrar()");pg.wait_for_timeout(300)
    chk(pg.locator('#ckpick').count()==1 and pg.locator('#ckpick .ckbtn.selected').count()==0,'cobro a crédito: aparece «¿Cómo queda la deuda?» sin nada marcado')
    T=pg.inner_text('#ckpick')
    chk('Mandar a Fiado' in T and 'Mandar a Cuenta Corriente' in T and '11/11' in T,'botones con vencimiento: %s'%T.replace('\n',' | ')[:160])
    hb=ev("document.querySelector('#ckpick .ckbtn').getBoundingClientRect().height")
    chk(hb>=60,'botón de al menos 60 px de alto (%d)'%hb)
    n0=ev("S.sales.length")
    pg.click('#modal-root .ov .btn.gold');pg.wait_for_timeout(300)
    chk(ev("S.sales.length")==n0 and pg.locator('#modal-root .ov').count()==1,'sin elegir tipo NO cobra')
    pg.click('[data-act=cbck][data-k=fiado]');pg.wait_for_timeout(200)
    chk(ev("pos.ck")=='fiado' and pg.locator('[data-act=cbck][data-k=fiado]').get_attribute('aria-pressed')=='true' and pg.locator('[data-act=cbck][data-k=cc]').get_attribute('aria-pressed')=='false','elegir Fiado lo marca (y desmarca la otra)')
    pg.click('[data-act=cbck][data-k=cc]');pg.wait_for_timeout(150);pg.click('[data-act=cbck][data-k=fiado]');pg.wait_for_timeout(150)
    chk(pg.locator('#ckpick .ckbtn.selected').count()==1,'excluyente: una sola marcada')
    pg.click('#modal-root .ov .btn.gold');pg.wait_for_timeout(500)
    s=ev("S.sales[S.sales.length-1]")
    chk(ev("S.sales.length")==n0+1 and s['ck']=='fiado','cobrado como Fiado')
    chk(ev("pos.ck")=='','la próxima venta empieza sin tipo elegido')
    t=ev("ticketText(S.sales[S.sales.length-1])")
    chk('fiado, vence' in t,'el ticket dice «fiado, vence …»')
    # pago mixto con parte a crédito también lo exige
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    ev("pos.lines=mk(150000);pos.method='efectivo';pos.cust=C.id;pos.mix=true;pos.pays=[{m:'efectivo',a:'1000',r:''},{m:'fiado',a:'500',r:''}];A.cobrar()");pg.wait_for_timeout(300)
    chk(pg.locator('#ckpick').count()==1,'mixto con parte a crédito → también pide el tipo')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove());pos.mix=false;pos.pays=[]")
    # efectivo: no aparece
    ev("pos.lines=mk(150000);pos.method='efectivo';A.cobrar()");pg.wait_for_timeout(300)
    chk(pg.locator('#ckpick').count()==0,'cobro en efectivo: no aparece el selector')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # ficha y cobro de deuda
    chk('Fiado' in ev("ccLedgerHTML(C.id)") and 'vence' in ev("ccLedgerHTML(C.id)"),'libro del cliente rotula Fiado / vencimiento')
    ev("A.cuPay({dataset:{id:C.id}})");pg.wait_for_timeout(300)
    chk(pg.locator('#fp-ck').count()==1 and 'Fiado' in pg.inner_text('#modal-root'),'cobro de deuda: muestra saldos por tipo y «Aplicar el cobro»')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # configuración y apagado
    ev("location.hash='#panel/config'");pg.wait_for_timeout(400)
    chk(pg.locator('#ck-cfg').count()==1,'Configuración → Fiado y cuenta corriente')
    pg.fill('#ck-d','10');pg.uncheck('#ck-on');pg.click('[data-act=ckSave]');pg.wait_for_timeout(200)
    chk(ev("S.cfg.credit.split===false&&S.cfg.credit.fiadoDays===10"),'guardado: apagado, 10 días')
    r=ev("(()=>{const r=commitSale('fiado',false,'local',mk(100000),{custId:C.id,ck:'fiado'});return r.err||[r.sale.ck||'',r.sale.due?dkey(r.sale.due):'']})()")
    exp=['','2026-12-04'] if ev("wsOn()") else ['','']
    chk(r==exp,'apagado: como antes (sin tipo; el plazo mayorista sigue si el mayorista está encendido): %s'%r)
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
