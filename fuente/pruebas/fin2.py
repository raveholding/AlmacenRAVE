# V26.74 · Finanzas para comercios: «Hoy», movimiento rápido (banco/billetera → saldo, flujo, ganancia y asiento; efectivo → caja),
# recordatorios de fiados por WhatsApp y de proveedores, campana, facturación rápida, paquete .zip para el contador,
# Mercado Pago Point preparado, rol contador, cliente apagado.
import io,zipfile,csv
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL='file:///tmp/rave/index.html'
OK="#modal-root .ov >> nth=-1 >> .mf [data-m=ok]"
def login(pg,role,pin):
    pg.goto(URL+'#acceso');pg.wait_for_timeout(900);i=pg.evaluate("S.users.findIndex(u=>u.role==='%s')"%role);pg.select_option('#lu',index=i);pg.fill('#lp',pin);pg.click('[data-act=login]');pg.wait_for_timeout(600)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);ctx=b.new_context(viewport={'width':1366,'height':900},accept_downloads=True);pg=ctx.new_page();ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    login(pg,'admin','1234');ev("go('finanzas')");pg.wait_for_timeout(400)
    t=pg.inner_text('#view')
    chk('Entró hoy' in t and 'Salió hoy' in t and 'Efectivo proyectado en 7 días' in t and 'IVA estimado del mes' in t and 'Ganancia neta del mes' in t,'«Hoy»: entradas, salidas, efectivo proyectado, IVA y ganancia')
    chk(pg.locator('#fin-body svg.fin-chart rect').count()==28,'gráfico de los últimos 14 días (entradas y salidas)')
    chk(pg.locator('.f2-q').count()==1,'botón flotante «+ Movimiento»')
    chk(ev("finMovs().length")==3,'movimientos de banco de ejemplo')
    # movimiento rápido: banco
    bk0=ev("finBank().t");pr0=ev("finProfit(now()-30*864e5,now()).gastos");n0=ev("finMovs().length")
    pg.click('.f2-q');pg.wait_for_timeout(200);pg.click('[data-f2t=egreso]');pg.select_option('#f2-me','banco');pg.select_option('#f2-ca','gastos')
    pg.fill('#f2-mo','0');pg.fill('#f2-co','Internet');pg.locator(OK).click();pg.wait_for_timeout(150)
    chk(ev("finMovs().length")==n0,'importe 0: se rechaza')
    pg.fill('#f2-mo','15.000,50');pg.fill('#f2-co','ab');pg.locator(OK).click();pg.wait_for_timeout(150)
    chk(ev("finMovs().length")==n0,'concepto muy corto: se rechaza')
    pg.fill('#f2-co','Internet de noviembre');pg.locator(OK).click();pg.wait_for_timeout(250)
    m=ev("finMovs()[finMovs().length-1]")
    chk(m['monto']==1500050 and m['medio']=='banco' and m['tipo']=='egreso' and m['cat']=='gastos','movimiento guardado en centavos (1500050)')
    chk(ev("finBank().t")==bk0-1500050,'resta del saldo de bancos')
    chk(ev("finProfit(now()-30*864e5,now()).gastos")==pr0+1500050,'cuenta como gasto en la ganancia')
    ev("acPost()");a=ev("S.journal.find(x=>x.id==='AS-fm-%s')"%m['id'])
    chk(a and sum(l['d'] for l in a['l'])==sum(l['h'] for l in a['l'])==1500050 and any(l['c']=='5.2.02' and l['d'] for l in a['l']) and any(l['c']=='1.1.02' and l['h'] for l in a['l']),'asiento automático: Gastos generales a Bancos')
    chk(ev("acVerify().bad")==0,'huellas verificadas')
    chk(ev("S.audit.some(x=>x.action==='FINANZAS_MOVIMIENTO')"),'auditado')
    # efectivo → caja
    ev("finTab='hoy';go('finanzas')");pg.wait_for_timeout(300);pg.click('.f2-q');pg.wait_for_timeout(200);pg.select_option('#f2-me','efectivo');pg.wait_for_timeout(50)
    chk(pg.locator('#f2-mo').is_disabled(),'efectivo: el importe se carga en la caja (con su rubro)')
    pg.locator(OK).click();pg.wait_for_timeout(400)
    chk(ev("document.querySelectorAll('#modal-root .ov').length")>=1 or 'caja' in ev("(document.getElementById('toast')||{}).textContent||''").lower(),'abre el movimiento de caja de siempre (o pide abrir la caja)')
    ev("document.querySelectorAll('#modal-root .ov').forEach(x=>x.remove())")
    # recordatorios
    cu=ev("S.customers.find(c=>c.status!=='baja')")
    ev("(()=>{const c=S.customers.find(x=>x.id==='%s');c.wa='3874484132';const s=JSON.parse(JSON.stringify(S.sales.find(x=>x.status==='ok')));Object.assign(s,{id:'fz-'+uid(),n:'FZ-1',cust:c.id,ts:now()-40*864e5,due:now()-5*864e5,fiado:true,method:'fiado',pays:[{m:'fiado',a:s.total,fee:0}]});S.sales.push(s)})()"%cu['id'])
    ev("A.finTabGo({dataset:{t:'record'}})");pg.wait_for_timeout(300)
    t=pg.inner_text('#fin-body');chk('Fiados vencidos' in t and 'vencida' in t,'recordatorios: fiado vencido en la lista')
    ev("window.__wa=[];window.open=(u)=>{window.__wa.push(u);return null};0")
    pg.locator('[data-act=f2Remind][data-id="%s"]'%cu['id']).click();pg.wait_for_timeout(250)
    u=ev("window.__wa[0]||''")
    chk(u.startswith('https://wa.me/5493874484132?text=') and 'cuenta%20corriente' in u and 'vencido' in u,'abre WhatsApp con el mensaje listo (lo envía una persona)')
    chk(ev("finRems().length")>=1 and 'recordado hoy' in pg.inner_text('#fin-body'),'queda registrado y no se ofrece dos veces el mismo día')
    chk(ev("!!uxBadges().finanzas"),'aviso en la campana (fiados vencidos)')
    # facturación rápida (demo: simulada)
    n=ev("(()=>{const m0=new Date(now());m0.setDate(1);m0.setHours(0,0,0,0);return S.sales.filter(s=>finOk(s)&&s.ts>=m0.getTime()&&!(s.arca&&s.arca.estado==='aprobado')&&!s.fiado).length})()")
    if n:
        ev("A.finTabGo({dataset:{t:'hoy'}})");pg.wait_for_timeout(200);pg.click('[data-act=f2Fact]');pg.wait_for_timeout(200);pg.locator(OK).click();pg.wait_for_timeout(800)
        chk(ev("S.sales.filter(s=>s.arca&&s.arca.estado==='aprobado'&&s.arca.sim).length")>=n,'«Facturar todas»: comprobantes simulados y rotulados en la demo (%d)'%n)
        ev("acPost()");chk(ev("S.journal.some(a=>a.l.some(l=>l.c==='2.1.02'&&l.h>0))"),'la factura genera su asiento con IVA débito')
    else: chk(True,'(sin ventas del mes para facturar)')
    # paquete para el contador
    ev("A.finTabGo({dataset:{t:'contador'}})");pg.wait_for_timeout(200)
    with pg.expect_download() as dl: pg.click('[data-act=f2Zip]')
    path=dl.value.path();z=zipfile.ZipFile(path);names=z.namelist()
    chk(dl.value.suggested_filename.startswith('para-el-contador-') and z.testzip() is None,'descarga un .zip válido (CRC verificado)')
    chk(any(n.startswith('libro-iva-ventas') for n in names) and any(n.startswith('libro-iva-compras') for n in names) and any(n.startswith('libro-diario') for n in names) and 'LEEME.txt' in names and any(n.startswith('sumas-y-saldos') for n in names),'incluye Libro IVA Ventas y Compras, Diario, Sumas y saldos y LEEME %s'%names)
    ventas=[r for r in csv.reader(io.StringIO(z.read([n for n in names if n.startswith('libro-iva-ventas')][0]).decode('utf-8-sig')),delimiter=';')]
    chk(ventas[0][:4]==['Fecha','Comprobante','Punto de venta','Número'] and (len(ventas)==1 or ',' in ventas[1][9]),'Libro IVA Ventas con encabezados e importes con coma')
    if len(ventas)>1: chk(any('SIMULADO' in r[-1] for r in ventas[1:]),'los comprobantes simulados se rotulan como tales')
    di=[r for r in csv.reader(io.StringIO(z.read([n for n in names if n.startswith('libro-diario')][0]).decode('utf-8-sig')),delimiter=';')]
    chk(len(di)>1 and len(di[1][7])==64,'Libro Diario con la huella SHA-256 de cada asiento')
    chk('no reemplaza' in z.read('LEEME.txt').decode(),'LEEME aclara que no reemplaza los libros legales')
    chk(ev("S.audit.some(x=>x.action==='FINANZAS_CONTADOR')"),'descarga auditada')
    # Mercado Pago Point
    ev("A.finTabGo({dataset:{t:'pagos'}})");pg.wait_for_timeout(200)
    chk('Mercado Pago Point' in pg.inner_text('#fin-body') and 'Pendiente de configuración' in pg.inner_text('#fin-body'),'Mercado Pago Point: preparado y apagado')
    pg.set_viewport_size({'width':390,'height':800});ev("A.finTabGo({dataset:{t:'hoy'}})");pg.wait_for_timeout(300)
    chk(not ev("document.documentElement.scrollWidth>document.documentElement.clientWidth+1"),'«Hoy» a 390 px sin desborde')
    ev("A.finTabGo({dataset:{t:'record'}})");pg.wait_for_timeout(200)
    chk(not ev("document.documentElement.scrollWidth>document.documentElement.clientWidth+1"),'«Recordatorios» a 390 px sin desborde')
    pg.set_viewport_size({'width':1366,'height':900})
    ev("save()");pg.wait_for_timeout(700)
    # contador
    login(pg,'contador','4444')
    chk(ev("finRO()") and ev("can('finance')"),'contador: sólo lectura')
    ev("finTab='contador';go('finanzas')");pg.wait_for_timeout(300)
    chk(pg.locator('[data-act=f2Zip]').count()==1 and pg.locator('.f2-q').count()==0,'el contador descarga el paquete y no carga movimientos')
    ev("A.f2Mov()");pg.wait_for_timeout(150);chk(ev("document.querySelectorAll('#modal-root .ov').length")==0,'… ni siquiera llamando la acción')
    pg2=ctx.new_page();ev2=pg2.evaluate;pg2.on('pageerror',lambda e:errs.append('cliente: '+str(e)[:200]))
    pg2.goto('file:///tmp/rave/out_cliente.html');pg2.wait_for_timeout(1200)
    chk(not ev2("finOn()") and ev2("finMovs().length")==0 and ev2("omniKb().length")==0,'Almacén RAVE: apagado y sin movimientos de ejemplo')
    b.close()
chk(not errs,'sin errores de página %s'%errs[:3])
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
