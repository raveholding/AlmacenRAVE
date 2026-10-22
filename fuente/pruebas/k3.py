# V26.11 · cierre de caja por rubro (cada rubro es una persona)
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
    ev("""(()=>{S.rubros=S.rubros.filter(r=>r.kind==='shared');
      S.rubros.unshift({id:'rn',name:'Almacén de Nico',owner:'Nico',reparte:true,alcohol:false,kind:'rubro',color:'#c9963e'},{id:'rj',name:'Bebidas de Juan',owner:'Juan',reparte:true,alcohol:false,kind:'rubro',color:'#7b2d3b'});
      S.cfg.tax={};S.cfg.profitMode=undefined;
      S.products=[{id:'pn',name:'Prod Nico',rubro:'rn',price:10000000,cost:6000000,stock:50,unit:'u',active:true,pres:[]},{id:'pj',name:'Prod Juan',rubro:'rj',price:10000000,cost:5000000,stock:50,unit:'u',active:true,pres:[]}];
      S.employees=[{id:'e1',name:'Guille',rate:100000,active:true}];S.sales=[];S.movs=[];S.arqDraft={};save();})()""")
    L=lambda pid:"[{pid:'%s',name:'x',rubro:'%s',qty:1,price:10000000,cost:%d,list:10000000}]"%(pid,'rn' if pid=='pn' else 'rj',6000000 if pid=='pn' else 5000000)
    r1=ev("commitSale('efectivo',false,'local',%s).err||'ok'"%L('pn'));r2=ev("commitSale('efectivo',false,'local',%s).err||'ok'"%L('pj'))
    chk(r1=='ok' and r2=='ok','dos ventas en efectivo, una de cada rubro (100.000 c/u)')
    # ingreso/egreso por rubro: Juan le paga 1.000 a Nico (egreso de Juan) + Nico ingreso 500
    chk(ev("addMov('egreso','rj','Pago a Nico',100000)")=='','egreso con rubro de Juan')
    chk(ev("addMov('ingreso','rn','Ingreso extra',50000)")=='','ingreso con rubro de Nico')
    ev("S.arqDraft[openSess().id]={taxes:{},empId:'e1',hours:'8',gastos:'',payFromCash:true}")
    a=ev("(()=>{const s=openSess();const a=arqueoCalc(s,arqInputs(s));return {rep:a.reparte.map(r=>({o:r.owner,sold:r.sold,prof:r.profit,mov:r.mov,cash:r.cash,ing:r.ing,egr:r.egr,fis:r.fis,sue:r.sueldo,tax:r.tax,net:r.net,fin:r.final})),pool:a.pool,sum:a.netSum,exp:a.expectedCash,fondo:a.fondo,resto:a.resto,mer:a.merienda,cash:a.cashSales,op:a.opening}})()")
    n,j=a['rep']
    chk(n['sold']==10000000 and j['sold']==10000000,'V26.16: el ingreso/egreso NO cambia lo vendido: 100.000 cada uno (%s / %s)'%(n['sold'],j['sold']))
    chk(n['prof']==4000000 and j['prof']==5000000 and n['mov']==0 and j['mov']==0,'la ganancia de ventas NO cambia: Nico 40.000 · Juan 50.000')
    chk(n['cash']==10000000 and n['ing']==50000 and n['egr']==0,'Nico: efectivo 100.000 + ingreso 500')
    chk(j['egr']==100000 and j['cash']==10000000,'Juan: egreso 1.000 va a SU rubro')
    chk(n['sue']==400000 and j['sue']==400000,'sueldo 8 hs × 1.000 = 8.000 a medias (4.000 cada uno)')
    chk(n['tax']==3000000 and j['tax']==3000000,'impuesto por defecto 30.000 para cada uno')
    chk(a['mer']==0,'sin merienda')
    # físico: efectivo + ing − egr − mitad sueldo (pagado de caja)
    chk(n['fis']==10000000+50000-400000,'caja física de Nico = 100.000 + 500 de ingreso − 4.000 de sueldo')
    chk(j['fis']==10000000-100000-400000,'caja física de Juan = 100.000 − 1.000 de egreso − 4.000 de sueldo')
    chk(a['exp']==a['op']+a['cash']+50000-100000-800000,'el efectivo esperado del cajón suma el ingreso y resta el egreso (plata física)')
    ev("S.cfg.movAffectProfit=true;save()")
    a2=ev("(()=>{const s=openSess();const a=arqueoCalc(s,arqInputs(s));return a.reparte.map(r=>[r.profit,r.base,r.net,r.sold])})()")
    chk(a2[0][1]==a2[0][0] and a2[1][1]==a2[1][0],'la ganancia NO cambia aunque la configuración vieja dijera «afectan la ganancia» (%s)'%a2)
    chk(a['resto']==0,'la suma de las cajas por rubro + fondo cierra con el efectivo esperado (sin diferencia sin explicar)')
    # ganancia: modo por defecto = se divide a partes iguales
    ntot=n['net']+j['net'];chk(a['pool'] is True and a['sum']==ntot,'ganancia total a dividir = suma de las dos')
    chk(abs(n['fin']-j['fin'])<=1 and n['fin']+j['fin']==ntot,'cada uno recibe la mitad (%s / %s)'%(n['fin'],j['fin']))
    # cada uno la suya
    ev("S.cfg.profitMode='each'")
    b2=ev("(()=>{const s=openSess();return arqueoCalc(s,arqInputs(s)).reparte.map(r=>[r.net,r.final])})()")
    chk(all(x[0]==x[1] for x in b2),'modo «cada uno la suya»: final = propia')
    ev("S.cfg.profitMode=undefined")
    # impuesto editable
    ev("S.arqDraft[openSess().id].taxes={rn:'20000',rj:'10000'}")
    t=ev("(()=>{const s=openSess();return arqueoCalc(s,arqInputs(s)).reparte.map(r=>r.tax)})()")
    chk(t==[2000000,1000000],'impuesto editable por persona')
    ev("S.arqDraft[openSess().id].taxes={}")
    # pantallas
    ev("location.hash='#panel/arqueo'");pg.wait_for_timeout(500)
    txt=pg.inner_text('#arq-tabs')
    chk('Nico' in txt and 'Juan' in txt and 'Caja física del rubro' in txt,'Arqueo muestra la tabla por rubro')
    chk('Liquidación' in txt and 'Le corresponde a cada uno' in txt,'Arqueo muestra la liquidación')
    chk(pg.locator('#aq-m').count()==0,'el campo Merienda ya no existe')
    prev=pg.inner_text('#arq-prev')
    chk('MERIENDA' not in prev.upper() and 'CAJA FÍSICA DEL RUBRO' in prev,'el texto de WhatsApp no tiene merienda y detalla la caja de cada rubro')
    pg.fill('#aq-t-rn','20000');pg.wait_for_timeout(200)
    chk('20.000' in pg.inner_text('#arq-tabs'),'cambiar el impuesto actualiza la tabla en vivo')
    ov=ev("document.documentElement.scrollWidth<=innerWidth+1");chk(ov,'sin desborde horizontal a 390 px')
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(400)
    chk('Caja de cada rubro' in pg.inner_text('#view'),'Caja muestra la caja de cada rubro')
    # cierre y consulta
    ev("S.arqDraft[openSess().id].declared='%s'"%'0')
    chk(ev("(()=>{const s=openSess();const a=arqueoCalc(s,arqInputs(s));const inp=arqInputs(s);return reportText(buildReport(a,'2026-10-21','X',inp),false).includes('Fondo de apertura')})()"),'el informe incluye el fondo de apertura aparte')
    chk(not errs,'sin errores de consola: %s'%errs[:2])
    print('RESUMEN',sum(res),'/',len(res))
    b.close()
