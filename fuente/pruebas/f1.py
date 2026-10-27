# V26.29 · Cargar factura (PDF con texto / QR fiscal) → revisión → carga de remito; tema claro/oscuro; gráficos del Resumen
import base64,json,os
from playwright.sync_api import sync_playwright
from reportlab.pdfgen import canvas
PDF='/tmp/rave/t/fac_test.pdf'
c=canvas.Canvas(PDF);y=800
for t in ['FACTURA A  Cod. 01','Razon Social: DISTRIBUIDORA NORTE SRL Domicilio Comercial: Salta','CUIT: 30-71234567-8' ,'Punto de Venta: 00003 Comp. Nro: 00001234','Fecha de Emision: 20/10/2026','Importe Neto Gravado: $ 10.000,00','IVA 21%: $ 2.100,00','Importe Total: $ 12.100,00']:
    c.drawString(60,y,t);y-=22
c.save()
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    # CUIT válido para la prueba
    cuit=ev("(()=>{for(let i=0;i<100000;i++){const c='3071234'+String(i).padStart(4,'0').slice(0,3)+'';for(let d=0;d<10;d++){const x='307123456'+String(i%10)+d;if(arcaCuitOk(x))return x;}}})()")
    q={'ver':1,'fecha':'2026-10-21','cuit':int(cuit),'ptoVta':5,'tipoCmp':6,'nroCmp':777,'importe':4500.5,'moneda':'PES','ctz':1,'codAut':70417054367476}
    url='https://www.afip.gob.ar/fe/qr/?p='+base64.b64encode(json.dumps(q).encode()).decode()
    r=ev(f"facParseQr({json.dumps(url)})")
    chk(r and r['cuit']==cuit and r['tipo']=='Factura' and r['letra']=='B' and r['nro']=='777' and r['total']==450050,'QR fiscal: CUIT, tipo B, número y total: '+str(r))
    # PDF con texto: reemplazamos el CUIT del pdf por uno válido
    c=canvas.Canvas(PDF);y=800
    for t in ['FACTURA A  Cod. 01','Razon Social: DISTRIBUIDORA NORTE SRL Domicilio Comercial: Salta','CUIT: %s-%s-%s'%(cuit[:2],cuit[2:10],cuit[10]),'Punto de Venta: 00003 Comp. Nro: 00001234','Fecha de Emision: 20/10/2026','Importe Neto Gravado: $ 10.000,00','IVA 21%: $ 2.100,00','Importe Total: $ 12.100,00']:
        c.drawString(60,y,t);y-=22
    c.save()
    ev("location.hash='#panel/proveedores'");pg.wait_for_timeout(500)
    chk(pg.locator('[data-act=facLoad]').count()==1,'botón «Cargar factura (foto o PDF)» en Proveedores y compras')
    pg.click('[data-act=facLoad]');pg.wait_for_timeout(300)
    pg.set_input_files('#fac-f',PDF);pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(1500)
    v=lambda i:pg.locator('#'+i).input_value()
    chk(v('fv-cuit').replace('-','')==cuit,'PDF: CUIT leído '+v('fv-cuit'))
    chk(v('fv-pto')=='3' and v('fv-nro')=='1234','PDF: punto de venta y número')
    chk(v('fv-f')=='2026-10-20','PDF: fecha')
    chk(v('fv-t').replace('.','') in ('12100','12100,00') and v('fv-n').replace('.','').startswith('10000'),'PDF: neto y total '+v('fv-n')+' / '+v('fv-t'))
    chk('DISTRIBUIDORA NORTE' in v('fv-rs'),'PDF: razón social '+v('fv-rs'))
    chk('No está cargado' in pg.locator('#fv-prov').inner_text(),'avisa que el proveedor no existe')
    pg.fill('#fv-t','99999');pg.wait_for_timeout(200)
    chk('no da el total' in pg.locator('#fv-w').inner_text(),'control: neto + IVA no coincide con el total')
    pg.fill('#fv-t','12.100,00');pg.wait_for_timeout(200)
    pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(1200)
    st=ev("({prov:cmpArr('suppliers').find(s=>String(s.cuit)==='%s'),tipo:crS&&crS.tipo,nro:crS&&crS.nro,decl:crS&&crS.decl,fecha:crS&&crS.fecha,tab:cmpS.tab})"%cuit)
    chk(st['prov'] is not None,'se creó el proveedor con el CUIT')
    chk(st['tab']=='remito' and st['tipo']=='Factura' and st['nro']=='0003-00001234' and st['fecha']=='2026-10-20','la carga de remito queda prellenada: '+str({k:st[k] for k in ['tipo','nro','fecha','decl']}))
    chk(ev("S.audit.some(a=>a.action==='FACTURA_REVISADA')"),'auditado')
    # duplicado
    ev("S.receipts=S.receipts||[];S.receipts.push({id:'rx',provId:cmpArr('suppliers').find(s=>String(s.cuit)==='%s').id,tipo:'Factura',nro:'0003-00001234'})"%cuit)
    pg.click('[data-act=facLoad]');pg.wait_for_timeout(300);pg.set_input_files('#fac-f',PDF);pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(1500)
    chk('DUPLICADO' in pg.locator('#fv-w').inner_text(),'detecta factura duplicada')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # tema
    ev("location.hash='#panel/inicio';rerender()");pg.wait_for_timeout(400)
    t0=ev("document.documentElement.dataset.theme")
    pg.click('[data-act=themeCycle]');pg.wait_for_timeout(200);pg.click('[data-act=themeCycle]') if ev("themePref()")!='dark' else None;pg.wait_for_timeout(200)
    chk(ev("themePref()")=='dark' and ev("document.documentElement.dataset.theme")=='dark','botón de tema: pasa a Oscuro')
    bg=ev("getComputedStyle(document.body).backgroundColor");chk(bg in ('rgb(23, 21, 19)',),'fondo oscuro aplicado: '+bg)
    pg.click('[data-act=themeCycle]');pg.wait_for_timeout(200);chk(ev("themePref()")=='auto','vuelve a Automático')
    # gráficos
    ev("dbF.per='30';rerender()");pg.wait_for_timeout(400)
    chk(pg.locator('svg[aria-label*="Ventas de hoy contra la meta"]').count()==1,'tacómetro de la meta del día')
    chk(pg.locator('svg[aria-label^="Ventas por día"]').count()==1,'gráfico de líneas de tendencia')
    pg.locator('[data-act=dbBarsDir][data-id=v]').click();pg.wait_for_timeout(300)
    chk(pg.locator('svg[aria-label^="Participación por"]').count()==1,'barras verticales al elegir «Verticales»')
    pg.locator('[data-act=dbBarsDir][data-id=h]').click();pg.wait_for_timeout(300)
    chk(pg.locator('div[role=img][aria-label^="Participación por"]').count()==1,'barras horizontales al elegir «Horizontales»')
    chk(pg.locator('details summary:has-text("Ver como tabla")').count()>=3,'cada gráfico tiene su tabla equivalente')
    ev("S.cfg.dailyGoal=0");pg.click('[data-act=dbGoal]');pg.wait_for_timeout(200);pg.fill('#dg-v','100000');pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(300)
    chk(ev("S.cfg.dailyGoal")==10000000 and 'meta fijada' in ev("document.body.innerText"),'meta diaria editable')
    pg.set_viewport_size({'width':360,'height':800});pg.wait_for_timeout(300);chk(ev("document.documentElement.scrollWidth<=362"),'360 px sin desborde')
    chk(not errs,'sin errores '+str(errs[:2]))
    b.close()
print(f"\n{sum(res)}/{len(res)}")
