# V26.35 · el cobro en efectivo de una cuenta corriente vuelve a la caja física del rubro de lo que se fió (no queda «sin rubro»)
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':390,'height':800})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    ev=pg.evaluate
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    ev("""(()=>{S.rubros=S.rubros.filter(r=>r.kind==='shared'||r.kind==='cobr');
      if(!S.rubros.some(r=>r.id==='cobr'))S.rubros.push({id:'cobr',name:'Cobranzas',kind:'cobr'});
      S.rubros.unshift({id:'rn',name:'Almacén de Nico',owner:'Nico',reparte:true,alcohol:false,kind:'rubro',color:'#c9963e'},{id:'rj',name:'Bebidas de Juan',owner:'Juan',reparte:true,alcohol:false,kind:'rubro',color:'#7b2d3b'});
      S.cfg.tax={};S.products=[{id:'pn',name:'Prod Nico',rubro:'rn',price:300000,cost:100000,stock:50,unit:'u',active:true,pres:[]},{id:'pj',name:'Prod Juan',rubro:'rj',price:700000,cost:300000,stock:50,unit:'u',active:true,pres:[]}];
      S.customers=[{id:'cfx1',first:'Ana',last:'Prueba',name:'Ana Prueba',limit:100000000,status:'activo',consent:{}}];
      S.employees=[];S.sales=[];S.movs=[];S.fiadoPays=[];S.arqDraft={};save();})()""")
    L=lambda pid,price,rub:"[{pid:'%s',name:'x',rubro:'%s',qty:1,price:%d,cost:0,list:%d}]"%(pid,rub,price,price)
    r=ev("(()=>{const r=commitSale('fiado',false,'local',%s,{custId:'cfx1'});return r.err||'ok'})()"%L('pj',700000,'rj'))
    chk(r=='ok','venta fiada de bebidas de Juan por 7.000 (%s)'%r)
    chk(ev("debtOf('cfx1')")==700000,'el cliente debe 7.000')
    chk(ev("fiadoPay('cfx1',700000,'efectivo')")=='','cobro de la deuda: 7.000 en efectivo')
    a=ev("(()=>{const s=openSess();const a=arqueoCalc(s,arqInputs(s));return {rep:a.reparte.map(r=>({o:r.owner,fis:r.fis,ccob:r.ccob,ing:r.ing,fia:r.fia})),resto:a.resto,exp:a.expectedCash,fondo:a.fondo}})()")
    n,j=a['rep']
    chk(j['ccob']==700000 and n['ccob']==0,'los 7.000 cobrados van al rubro de Juan (bebidas), no a Nico (%s / %s)'%(j['ccob'],n['ccob']))
    chk(j['fis']==700000,'la caja física de Juan suma los 7.000 cobrados (%s)'%j['fis'])
    chk(a['resto']==0,'ya no queda «diferencia sin rubro» (%s)'%a['resto'])
    chk(a['exp']==a['fondo']+700000,'el efectivo esperado del cajón sigue siendo el mismo (fondo + 7.000)')
    # deuda de dos rubros y pagos parciales: FIFO, en proporción a lo fiado de cada venta
    ev("S.sales=[];S.movs=S.movs.filter(m=>false);S.fiadoPays=[];save()")
    ev("commitSale('fiado',false,'local',%s,{custId:'cfx1'})"%L('pn',300000,'rn'))
    ev("(()=>{const s=S.sales[S.sales.length-1];s.ts-=60000;})()")
    ev("commitSale('fiado',false,'local',%s,{custId:'cfx1'})"%L('pj',700000,'rj'))
    chk(ev("fiadoPay('cfx1',500000,'efectivo')")=='','cobro parcial de 5.000 sobre una deuda de 10.000 (3.000 de Nico, más vieja, + 7.000 de Juan)')
    a=ev("(()=>{const s=openSess();const a=arqueoCalc(s,arqInputs(s));return {rep:a.reparte.map(r=>r.ccob),resto:a.resto}})()")
    chk(a['rep']==[300000,200000] and a['resto']==0,'primero se cancela lo más viejo: 3.000 a Nico y 2.000 a Juan (%s), sin diferencia sin rubro'%a['rep'])
    chk(ev("fiadoPay('cfx1',500000,'efectivo')")=='','segundo cobro: 5.000')
    a=ev("(()=>{const s=openSess();const a=arqueoCalc(s,arqInputs(s));return {rep:a.reparte.map(r=>r.ccob),resto:a.resto}})()")
    chk(a['rep']==[300000,700000] and a['resto']==0,'al terminar de pagar, cada rubro recuperó exactamente lo que fió (%s)'%a['rep'])
    # un cobro por transferencia no toca el cajón ni la caja física
    ev("commitSale('fiado',false,'local',%s,{custId:'cfx1'})"%L('pj',700000,'rj'))
    chk(ev("fiadoPay('cfx1',700000,'transferencia')")=='','cobro por transferencia')
    a=ev("(()=>{const s=openSess();const a=arqueoCalc(s,arqInputs(s));return {rep:a.reparte.map(r=>r.ccob),resto:a.resto}})()")
    chk(a['rep']==[300000,700000] and a['resto']==0,'la transferencia no suma a la caja física (sólo entra el efectivo)')
    ev("location.hash='#panel/arqueo'");pg.wait_for_timeout(500)
    t=pg.inner_text('body')
    chk('cobró deuda de cta. cte.' in t,'el arqueo muestra cuánto cobró cada rubro de cuenta corriente')
    chk('sin rubro' not in t,'el arqueo ya no muestra «diferencia sin rubro»')
    chk(not errs,'sin errores de JavaScript %s'%errs[:2])
    b.close()
print('%d / %d'%(sum(res),len(res)))
