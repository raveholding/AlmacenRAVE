# 4.22 · F1 · mayorista/minorista: priceResolve, escalones, bultos, acuerdos, crédito con plazo y excepción (demo, bandera encendida)
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
    # ---- 0) demo: bandera encendida con ejemplos rotulados ----
    chk(ev("wsOn()")==True,'demo: el canal mayorista nace ENCENDIDO')
    chk(ev("S.cfg.wholesale.example===true && S.customers.some(c=>c.example&&c.channel==='mayorista'&&arcaCuitOk(c.taxid))"),'demo: cliente mayorista de ejemplo con CUIT válido, rotulado ejemplo')
    chk(ev("S.products.filter(p=>p.tiers&&p.tiers.length).length>=1 && S.products.some(p=>(p.packs||[]).some(k=>k.mode==='bulto_cerrado'))"),'demo: productos de ejemplo con escalones y bulto cerrado')
    # ---- datos de prueba propios (precios redondos) ----
    ev("""(()=>{const r=S.rubros.find(r=>r.kind==='rubro'&&!r.age&&!r.alcohol)||S.rubros.find(r=>r.kind==='rubro');
      S.products.push({id:'wt1',name:'Prod escalones',rubro:r.id,price:10000,cost:5000,stock:500,unit:'u',barcode:'',active:true,menu:false,
        prices:{L2:10000},tiers:[{list:'L2',from:10,to:49,price:9000,pct:0},{list:'L2',from:50,to:99,price:8000,pct:0},{list:'L2',from:100,to:0,price:7000,pct:0}]});
      S.products.push({id:'wt2',name:'Prod bulto',rubro:r.id,price:10000,cost:5000,stock:30,unit:'u',barcode:'',active:true,menu:false,
        prices:{L2:10000},packs:[{id:'pk2',name:'Caja x6',qty:6,barcode:'7790001112223',mode:'ambas',fixed:54000,pct:0}]});
      S.products.push({id:'wt3',name:'Prod sólo bulto',rubro:r.id,price:10000,cost:5000,stock:60,unit:'u',barcode:'',active:true,menu:false,
        packs:[{id:'pk3',name:'Caja x6',qty:6,barcode:'',mode:'bulto_cerrado',fixed:0,pct:10}]});
      S.products.push({id:'wt4',name:'Prod piso',rubro:r.id,price:10000,cost:5000,stock:60,unit:'u',barcode:'',active:true,menu:false,prices:{L2:9000},floor:8500});
      S.products.push({id:'wt5',name:'Prod pct',rubro:r.id,price:10000,cost:5000,stock:60,unit:'u',barcode:'',active:true,menu:false,prices:{L2:10000},tiers:[{list:'L2',from:5,to:0,price:0,pct:15}]});
      S.products.push({id:'wt6',name:'Prod sube',rubro:r.id,price:10000,cost:5000,stock:60,unit:'u',barcode:'',active:true,menu:false,prices:{L2:9000},tiers:[{list:'L2',from:10,to:0,price:9500,pct:0}]});
      S.customers.push({id:'cwh1',num:910,name:'Mayo',last:'Uno',birth:'1980-01-01',wa:'+5493875550911',consent:{club:true},status:'activo',limit:2000000,secret:'x'.repeat(20),channel:'mayorista',list:'L2',taxid:'20123456786',term:10,zone:'',seller:''});
      S.customers.push({id:'cwh2',num:911,name:'Sin',last:'Cuit',wa:'+5493875550912',consent:{club:true},status:'activo',limit:2000000,secret:'y'.repeat(20),channel:'mayorista',list:'L2',taxid:'',term:0});
      S.customers.push({id:'cmin',num:912,name:'Min',last:'Orista',wa:'+5493875550913',consent:{club:true},status:'activo',limit:2000000,secret:'z'.repeat(20),channel:'minorista',list:'',taxid:'',term:0});})()""")
    PR=lambda pid,q,c,ch='mayorista':ev("priceResolve(prod('%s'),%s,{cust:custById('%s'),chan:'%s'})"%(pid,q,c,ch))
    # ---- 1) escalones del adjunto: 1-9 → 100 · 10-49 → 90 · 50-99 → 80 · 100+ → 70 ----
    got=[PR('wt1',q,'cwh1')['price'] for q in (1,9,10,49,50,99,100,1000)]
    chk(got==[10000,10000,9000,9000,8000,8000,7000,7000],'escalones 1–9 $100 · 10–49 $90 · 50–99 $80 · 100+ $70: %s'%got)
    r=PR('wt1',9,'cwh1')
    chk('Faltan 1 u' in r['missing'] and '10' in r['missing'],'avisa qué falta para el escalón: '+r['missing'])
    r=PR('wt1',10,'cwh1')
    chk(r['rule']=='L2-E10' and 'escalón 10–49' in r['why'],'motivo legible y código de regla: %s · %s'%(r['rule'],r['why']))
    chk(PR('wt1',100,'cwh1','minorista')['price']==7000,'cliente con lista L2 asignada sigue usándola aunque la operación sea minorista')
    chk(PR('wt1',100,'cmin','minorista')['price']==10000,'minorista sin lista: precio L1 y NO recibe los escalones mayoristas')
    # ---- 2) un escalón nunca sube el precio ----
    chk(PR('wt6',10,'cwh1')['price']==9000,'escalón con precio mayor al de la lista NO lo sube (queda 90)')
    # ---- 3) porcentaje ----
    chk(PR('wt5',5,'cwh1')['price']==8500,'escalón por % (15 % sobre 100) = 85')
    # ---- 4) bulto cerrado ----
    chk(PR('wt2',6,'cwh1')['price']==9000 and 'bulto cerrado' in PR('wt2',6,'cwh1')['why'],'bulto de 6 a $540 → $90 por unidad')
    chk(PR('wt2',12,'cwh1')['price']==9000,'2 bultos mantienen la bonificación')
    chk(PR('wt2',7,'cwh1')['price']==10000,'7 unidades (no múltiplo del bulto) NO reciben la bonificación')
    chk(PR('wt3',6,'cwh1')['price']==9000,'bonificación por % del bulto (10 %) = 90')
    chk(ev("wsQtyErr([{pid:'wt3',qty:7}])")!='' and ev("wsQtyErr([{pid:'wt3',qty:12}])")=='','sólo bulto cerrado: 7 se rechaza, 12 pasa')
    # ---- 5) mayorista exige CUIT ----
    r=PR('wt1',100,'cwh2')
    chk(r['price']==10000 and r['warn']=='cuit','mayorista con cliente sin CUIT cae a precio minorista y avisa')
    # ---- 6) acuerdo especial: gana y no se mezcla con escalones; vencido no rige ----
    ev("S.agreements.push({id:'agT',cust:'cwh1',pid:'wt1',price:9500,pct:0,from:'',to:'',active:true,by:'t',ts:Date.now()})")
    r=PR('wt1',100,'cwh1')
    chk(r['price']==9500 and r['rule']=='ACU','acuerdo vigente gana sobre el escalón (100 u → $95, no $70)')
    ev("S.agreements.find(a=>a.id==='agT').to='2020-01-01'")
    chk(PR('wt1',100,'cwh1')['price']==7000,'acuerdo vencido no rige: vuelve el escalón')
    ev("S.agreements.find(a=>a.id==='agT').to='';S.agreements.find(a=>a.id==='agT').active=false")
    chk(PR('wt1',100,'cwh1')['price']==7000,'acuerdo desactivado no rige')
    # ---- 7) piso de precio ----
    ev("pos.lines=[];pos.cust='cwh1';pos.chanSet=null;A.padd({dataset:{id:'wt4'}});")
    ev("lineEdit(0,'price','80');")  # $80 manual < piso $85
    r=ev("commitSale('efectivo',false,'local',pos.lines,{custId:'cwh1',ws:{chan:'mayorista'}})")
    chk(r.get('err') and 'piso' in r['err'],'precio bajo el piso se rechaza: '+str(r.get('err'))[:90])
    ev("pos.lines[0].flrOk=1")
    r=ev("(()=>{const r=commitSale('efectivo',false,'local',pos.lines,{custId:'cwh1',ws:{chan:'mayorista'}});return{err:r.err||'',tot:r.sale&&r.sale.total,rule:r.sale&&r.sale.items[0].lr}})()")
    chk(not r['err'] and r['tot']==8000 and r['rule']=='MAN','con autorización del supervisor (motivo) se vende: $80, regla MAN')
    ev("pos.lines=[]")
    # ---- 8) mayorista sin cliente / sin CUIT; club ----
    ev("pos.lines=[];pos.cust='';A.padd({dataset:{id:'wt1'}})")
    r=ev("commitSale('efectivo',false,'local',pos.lines,{custId:'',ws:{chan:'mayorista'}})")
    chk(r.get('err') and 'cliente identificado' in r['err'],'canal mayorista sin cliente: '+str(r.get('err'))[:60])
    r=ev("commitSale('efectivo',false,'local',pos.lines,{custId:'cwh2',ws:{chan:'mayorista'}})")
    chk(r.get('err') and 'CUIT' in r['err'],'cliente mayorista sin CUIT: '+str(r.get('err'))[:60])
    r=ev("commitSale('efectivo',false,'local',pos.lines,{custId:'cwh1',coupon:'BIENVENIDA10',ws:{chan:'mayorista'}})")
    chk(r.get('err') and 'cupones' in r['err'].lower(),'cupón del Club en venta mayorista: rechazado')
    ev("pos.lines=[]")
    # ---- 9) venta real por la pantalla: 2 bultos descuentan 12 u de stock ----
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(400)
    ev("pos.lines=[];pos.cust='cwh1';pos.chanSet=null;pos.mix=false;pos.pays=[];pos.method='efectivo';pos.recv='';A.padd({dataset:{id:'wt2'}});lineEdit(0,'qty','12')")
    pg.wait_for_timeout(200)
    chk(ev("pos.lines[0].price")==9000 and ev("posTotal()")==108000,'pantalla: 12 u de Prod bulto = 2 bultos = $1.080')
    chk('Mayorista' in pg.inner_text('#wsbar') and 'Mayo Uno' in pg.inner_text('#wsbar'),'la barra muestra canal Mayorista y el cliente')
    st0=ev("prod('wt2').stock")
    pg.keyboard.press('F12');pg.wait_for_timeout(300)
    pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(500)
    s=ev("S.sales.slice(-1)[0]")
    chk(s['total']==108000 and s['wch']=='mayorista' and s['items'][0]['lr'].endswith('+B6'),'venta guardada: total, canal y regla aplicada en la línea: '+s['items'][0]['lr'])
    chk(round(st0-ev("prod('wt2').stock"),3)==12,'2 bultos de 6 descontaron 12 unidades base')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # ---- 10) lector: código de barras de la presentación suma el bulto ----
    ev("pos.lines=[];pos.cust='cwh1';posCart();")
    chk(ev("addByCode('7790001112223')") and ev("pos.lines[0].qty")==6,'el código propio del bulto agrega 6 unidades')
    ev("pos.lines=[];pos.cust=''")
    # ---- 11) crédito: límite, plazo, mora y excepción de un solo uso ----
    ev("S.sales=S.sales.filter(s=>s.cust!=='cwh1');S.fiadoPays=S.fiadoPays.filter(p=>p.cust!=='cwh1')")
    ev("pos.lines=[];pos.cust='cwh1';A.padd({dataset:{id:'wt1'}});lineEdit(0,'qty','10')")   # 10 u a $90 = $900
    FI="commitSale('fiado',false,'local',pos.lines,{custId:'cwh1',ws:{chan:'mayorista'}})"
    r=ev("(()=>{const r="+FI+";return{err:r.err||'',due:r.sale&&r.sale.due,term:r.sale&&r.sale.term,ts:r.sale&&r.sale.ts}})()")
    chk(not r['err'] and r['term']==10 and abs(r['due']-r['ts']-10*86400000)<5,'venta a cuenta corriente guarda el vencimiento (plazo 10 días)')
    t0=ev("Date.now()")
    ev("window.__now=()=>%d"%(t0+9*86400000))
    ev("pos.lines=[];pos.cust='cwh1';A.padd({dataset:{id:'wt1'}});lineEdit(0,'qty','10')")
    r=ev("("+FI+").err||''")
    chk(r=='','día 9 (dentro del plazo): sigue pudiendo comprar a cuenta corriente '+r[:60])
    ev("window.__now=()=>%d"%(t0+12*86400000))
    ev("pos.lines=[];pos.cust='cwh1';A.padd({dataset:{id:'wt1'}});lineEdit(0,'qty','10')")
    r=ev("(()=>{const r="+FI+";return{err:r.err||'',credit:!!r.credit}})()")
    chk('vencido' in r['err'] and r['credit'],'día 12 (documentos vencidos): se bloquea la cuenta corriente: '+r['err'][:90])
    r=ev("commitSale('efectivo',false,'local',pos.lines,{custId:'cwh1',ws:{chan:'mayorista'}}).err||''")
    chk(r=='','con documentos vencidos puede seguir comprando al contado '+r[:60])
    ev("pos.lines=[];pos.cust='cwh1';A.padd({dataset:{id:'wt1'}});lineEdit(0,'qty','10')")
    ev("user={name:'Mostrador',role:'mostrador'}")
    chk(ev("can('credit_ov')")==False,'el mostrador no tiene permiso de excepción de crédito')
    n0=ev("S.creditOv.length");ev("A.wsCredOv({dataset:{id:'cwh1',need:'90000'}})");pg.wait_for_timeout(200)
    chk(ev("S.creditOv.length")==n0 and pg.locator('#modal-root .dlg').count()==0,'sin permiso no se abre ni se crea la excepción')
    ev("user={name:'ADMIN',role:'admin'}")
    ev("A.wsCredOv({dataset:{id:'cwh1',need:'90000'}})");pg.wait_for_timeout(250)
    pg.fill('#co-w','Cliente histórico, paga el viernes');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("S.creditOv.length")==n0+1 and ev("S.creditOv.slice(-1)[0].reason").startswith('Cliente histórico'),'excepción creada con motivo, monto y vigencia')
    chk(ev("S.audit.some(e=>e.action==='EXCEPCION_CREDITO')"),'la excepción queda en auditoría')
    r=ev("(()=>{const r="+FI+";return{err:r.err||'',cov:r.sale&&r.sale.cov}})()")
    chk(not r['err'] and r['cov'],'con la excepción vigente se autoriza la venta a cuenta corriente '+r['err'][:60])
    chk(ev("S.creditUse.length")>=1 and ev("S.audit.some(e=>e.action==='EXCEPCION_CREDITO_USO')"),'la excepción se consume (queda el uso y la auditoría)')
    ev("pos.lines=[];pos.cust='cwh1';A.padd({dataset:{id:'wt1'}});lineEdit(0,'qty','10')")
    r=ev("("+FI+").err||''")
    chk('vencido' in r,'la excepción es de un solo uso: la segunda venta vuelve a bloquearse')
    deuda=ev("debtOf('cwh1')")
    ev("fiadoPay('cwh1',%d,'transferencia')"%deuda)
    r=ev("("+FI+").err||''")
    chk(r=='' ,'al saldar la deuda vencida se destraba la cuenta corriente: '+r[:80])
    # ---- 12) límite de crédito sigue igual (mensaje de siempre) ----
    ev("window.__now=undefined;S.sales=S.sales.filter(s=>s.cust!=='cwh1');S.fiadoPays=[];S.creditOv=[];S.creditUse=[]")
    ev("S.customers.find(c=>c.id==='cwh1').limit=500000")
    ev("pos.lines=[];pos.cust='cwh1';A.padd({dataset:{id:'wt1'}});lineEdit(0,'qty','100')")   # 100 u a $70 = $7.000 > límite $5.000
    r=ev("("+FI+").err||''")
    chk('Supera el límite de crédito' in r,'el límite de crédito se respeta: '+r[:80])
    # ---- 13) bandera apagada: comportamiento de siempre ----
    ev("S.cfg.wholesale.on=false;pos.lines=[];pos.cust='cwh1';A.padd({dataset:{id:'wt1'}});lineEdit(0,'qty','100')")
    chk(ev("pos.lines[0].price")==10000,'apagado: precio L1 (sin lista ni escalón)')
    r=ev("commitSale('efectivo',false,'local',pos.lines,{custId:'cwh1'}).sale.items[0]")
    chk(r['price']==10000 and not r.get('lr'),'apagado: la venta no lleva datos de lista ni regla')
    ev("S.customers.find(c=>c.id==='cwh1').limit=0")
    r=ev("commitSale('fiado',false,'local',pos.lines,{custId:'cwh1'}).err||''")
    chk(r=='El cliente no tiene límite de crédito asignado.','apagado: mensaje de crédito idéntico al de siempre')
    ev("S.cfg.wholesale.on=true;pos.lines=[];pos.cust=''")
    # ---- 14) editor de producto: validaciones ----
    ev("location.hash='#panel/inventario'");pg.wait_for_timeout(400)
    ev("A.wsProd({dataset:{id:'wt1'}})");pg.wait_for_timeout(250)
    pg.select_option('#wp-tl3','L2');pg.fill('#wp-tf3','40');pg.fill('#wp-tt3','60');pg.fill('#wp-tv3','85')
    pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(250)
    chk('solapan' in pg.inner_text('#modal-root'),'escalones solapados se rechazan al guardar')
    pg.fill('#wp-tf3','');pg.fill('#wp-tt3','');pg.fill('#wp-tv3','');pg.select_option('#wp-tl3','')
    pg.fill('#wp-fl','85');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("prod('wt1').floor")==8500 and ev("S.audit.some(e=>e.action==='LISTAS_PRODUCTO')"),'guardar listas/piso funciona y queda auditado')
    ev("user={name:'Mostrador',role:'mostrador'}");ev("A.wsProd({dataset:{id:'wt1'}})");pg.wait_for_timeout(200)
    chk(pg.locator('#wp-fl').count()==0,'el mostrador no puede editar listas de precio')
    ev("user={name:'ADMIN',role:'admin'}")
    # ---- 15) ficha del cliente ----
    ev("location.hash='#panel/clientes'");pg.wait_for_timeout(400)
    ev("A.cuEdit({dataset:{id:'cwh1'}})");pg.wait_for_timeout(300)
    chk(pg.locator('#wc-tx').count()==1 and pg.locator('#wc-ch').count()==1,'la ficha muestra el bloque Mayorista y crédito')
    pg.fill('#wc-tx','20123456780');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(250)
    chk(ev("custById('cwh1').taxid")=='20123456786','CUIT con dígito verificador inválido se rechaza')
    pg.fill('#wc-tx','20123456786');pg.fill('#wc-tm','30');pg.fill('#wc-zn','Zona Norte')
    pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("custById('cwh1').term")==30 and ev("custById('cwh1').zone")=='Zona Norte' and ev("S.audit.some(e=>e.action==='CLIENTE_MAYORISTA')"),'plazo/zona guardados y auditados')
    # ---- 16) configuración ----
    ev("location.hash='#panel/config'");pg.wait_for_timeout(500)
    chk(pg.locator('#ws-card').count()==1 and pg.locator('#ws-on').is_checked(),'Configuración muestra la tarjeta Mayorista y minorista (activa)')
    chk(not errs,'sin errores de consola: '+str(errs[:3]))
    print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
    b.close()
