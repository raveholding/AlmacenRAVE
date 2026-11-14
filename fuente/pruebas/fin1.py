# V26.72 · Finanzas (tablero, flujo de fondos, cobrar/pagar, rentabilidad, conciliación, cobros digitales, copiloto)
# y Contabilidad (asientos automáticos de partida doble con huella SHA-256, idempotencia, contraasientos, cierre de
# período encadenado, Libro Diario/Mayor/Sumas y saldos, IVA, plan de cuentas), rol «contador» de sólo lectura,
# y que el cliente nace con los dos módulos apagados.
import sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
def login_role(pg,role,pin,url):
    pg.goto(url+'#acceso');pg.wait_for_timeout(900)
    idx=pg.evaluate("S.users.findIndex(u=>u.role==='%s')"%role)
    pg.select_option('#lu',index=idx);pg.fill('#lp',pin);pg.click('[data-act=login]');pg.wait_for_timeout(700)
def ow(pg):return pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth+1")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    U='file:///tmp/rave/index.html'
    pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    login_role(pg,'admin','1234',U)
    chk(ev("finOn()&&acOn()"),'demo: Finanzas y Contabilidad encendidos con datos de ejemplo')
    ev("go('finanzas')");pg.wait_for_timeout(400)
    chk(ev("finTab")=='hoy' and 'Entró hoy' in pg.inner_text('#view'),'Finanzas abre en «Hoy» (flujo del día)')
    ev("A.finTabGo({dataset:{t:'tablero'}})");pg.wait_for_timeout(300)
    t=pg.inner_text('#view')
    chk('Efectivo en cajas abiertas' in t and 'A cobrar' in t and 'Margen neto estimado' in t,'tablero con efectivo, a cobrar, a pagar y margen')
    chk(pg.locator('svg.fin-chart').count()==1,'gráfico de liquidez dibujado')
    bad=[]
    for k in ev("FIN_TABS.map(t=>t[0])"):
        ev("A.finTabGo({dataset:{t:'%s'}})"%k);pg.wait_for_timeout(120)
        if not pg.locator('#fin-body').count() or not pg.inner_text('#fin-body').strip():bad.append(k)
    chk(not bad and not errs,'todas las pestañas de Finanzas abren sin errores %s %s'%(bad,errs[:2]))
    F=ev("(()=>{const F=finFlow(8);return {n:F.W.length,start:F.start,last:F.W[7].bal,sum:F.W.reduce((a,w)=>a+w.inn-w.out,0),int:F.W.every(w=>Number.isInteger(w.inn)&&Number.isInteger(w.out))}})()")
    chk(F['n']==8 and F['start']+F['sum']==F['last'],'flujo: saldo final = inicial + ingresos − egresos (%s)'%F)
    chk(F['int'],'flujo en centavos enteros')
    chk(ev("finFlow(8).W.some(w=>w.det.some(d=>d.txt==='Alquiler del local'))"),'los compromisos entran al flujo en su fecha')
    # bache: subir el mínimo deseado obliga una alerta roja
    ev("finCfg().umbral=finFlow(8).W.reduce((a,w)=>Math.max(a,w.bal),0)+100");
    chk(any(a['c']=='red' for a in ev("finAlerts()")),'alerta de bache cuando el saldo proyectado cae bajo el mínimo')
    ev("finCfg().umbral=20000000")
    a=ev("finAsk('cuánta plata voy a tener en 15 días')")
    chk('Saldo proyectado a 15' in a and '$' in a,'copiloto responde liquidez a 15 días')
    chk('Todavía no entiendo' in ev("finAsk('receta de empanadas')"),'copiloto admite cuando no entiende (no inventa)')
    chk(ev("ACTIONS.has('finance.cashflow.read')&&ACTIONS.get('finance.cashflow.read').risk==='read'"),'acción del Asistente registrada como sólo lectura')
    # compromiso por formulario
    ev("A.finTabGo({dataset:{t:'pagar'}})");pg.wait_for_timeout(100)
    n0=ev("S.finCmp.length");ev("A.finCmpNew()");pg.wait_for_timeout(200)
    pg.fill('#fc-n','Seguro');pg.fill('#fc-a','0');pg.click('#modal-root .ov [data-m=ok]');pg.wait_for_timeout(150)
    chk(ev("S.finCmp.length")==n0,'compromiso con importe 0 se rechaza')
    pg.fill('#fc-a','12.500,50');pg.click('#modal-root .ov [data-m=ok]');pg.wait_for_timeout(200)
    chk(ev("S.finCmp.length")==n0+1 and ev("S.finCmp[S.finCmp.length-1].amount")==1250050,'compromiso «12.500,50» se guarda en centavos (1250050)')
    chk(ev("S.audit.some(a=>a.action==='FINANZAS_COMPROMISO')"),'alta de compromiso auditada')
    # conciliación
    r=ev("finParseCsv('fecha;desc;importe\\n05/11/2026;ACRED DEBITO;1.234,56\\n2026-11-06;PAGO PROV;-500.00\\nbasura')")
    chk(len(r)==2 and r[0]['imp']==123456 and r[0]['fecha']=='2026-11-05' and r[1]['imp']==-50000,'lector de extracto: formato argentino y fechas dd/mm/aaaa %s'%r)
    ev("A.finRecDemo()");pg.wait_for_timeout(200)
    m=ev("({n:S.finRec.length,auto:S.finRec.filter(r=>r.st==='auto').length})")
    chk(m['n']>=2 and m['auto']>=1,'extracto de ejemplo: cruces sugeridos con acreditaciones %s'%m)
    rid=ev("(S.finRec.find(r=>r.st==='auto')||{}).id")
    if rid:
        ev("A.finRecOk({dataset:{id:'%s'}})"%rid);chk(ev("S.finRec.find(r=>r.id==='%s').st"%rid)=='ok','confirmar un cruce')
    # ---------- Contabilidad ----------
    ev("go('contable')");pg.wait_for_timeout(500)
    J=ev("(()=>{const J=S.journal;return {n:J.length,bal:J.every(a=>a.l.reduce((x,l)=>x+l.d,0)===a.l.reduce((x,l)=>x+l.h,0)),uniq:new Set(J.map(a=>a.id)).size===J.length,ints:J.every(a=>a.l.every(l=>Number.isInteger(l.d)&&Number.isInteger(l.h)))}})()")
    chk(J['n']>0 and J['bal'] and J['uniq'] and J['ints'],'asientos automáticos: todos balancean, sin duplicados y en centavos %s'%J)
    chk(ev("acPost()")==0,'idempotente: volver a contabilizar no duplica')
    chk(ev("acVerify().bad")==0,'todas las huellas SHA-256 verifican')
    chk(ev("S.journal.some(a=>a.id.startsWith('AS-v-')&&a.l.some(l=>l.c==='5.1.01'))"),'la venta registra también su costo (CMV)')
    sid=ev("(S.sales.find(s=>s.status==='ok'&&S.journal.some(a=>a.id==='AS-v-'+s.id))||{}).id")
    ev("(()=>{const s=S.sales.find(x=>x.id==='%s');s.status='anulada';s.voidTs=now();})()"%sid);ev("acPost()")
    rv=ev("(()=>{const a=S.journal.find(x=>x.id==='AS-v-%s'),b=S.journal.find(x=>x.id==='AS-vx-%s');return !!b&&a.l.every((l,i)=>b.l[i].c===l.c&&b.l[i].d===l.h&&b.l[i].h===l.d)})()"%(sid,sid))
    chk(rv,'anulación: contraasiento espejo, el original no se toca')
    ev("S.journal[0].l[0].d+=100")
    ev("window.__acPer=S.journal[0].f.slice(0,7);A.acTabGo({dataset:{t:'diario'}})");pg.wait_for_timeout(300)
    chk(ev("acVerify().bad")==1 and 'ALTERADO' in pg.inner_text('#view'),'alterar un importe se detecta (huella ALTERADO en el Libro Diario)')
    ev("S.journal[0].l[0].d-=100")
    chk(ev("acVerify().bad")==0,'restaurado vuelve a verificar')
    # sumas y saldos
    ss=ev("(()=>{const B=acBalances();let d=0,h=0;Object.values(B).forEach(b=>{d+=b.d;h+=b.h});return d===h})()")
    chk(ss,'Sumas y saldos: Debe = Haber')
    for k in ev("AC_TABS.map(t=>t[0])"):
        ev("A.acTabGo({dataset:{t:'%s'}})"%k);pg.wait_for_timeout(120)
    chk(not errs,'todas las pestañas de Contabilidad abren sin errores %s'%errs[:2])
    # cierre de período encadenado
    # una operación del mes pasado para tener un período terminado que cerrar
    ev("S.sales.push({id:'zz-prev',n:'P-1',ts:(()=>{const d=new Date(now());d.setDate(1);return d.getTime()-5*864e5})(),user:'ADMIN',items:[],total:2500,method:'efectivo',pays:[{m:'efectivo',a:2500,fee:0}],status:'ok'});acPost()")
    ev("A.acTabGo({dataset:{t:'periodos'}})");pg.wait_for_timeout(150)
    btn=pg.locator('[data-act=acClose]').first
    if btn.count():
        per=btn.get_attribute('data-p');btn.click();pg.wait_for_timeout(200);pg.click('#modal-root .ov [data-m=ok]');pg.wait_for_timeout(250)
        chk(ev("S.acClose.length")==1 and ev("acVerify().badC")==0,'cierre de %s: cadena de huellas verificada'%per)
        nb=ev("S.journal.length")
        ev("S.sales.push({id:'zz-old',n:'Z-1',ts:Date.parse('%s-10T12:00:00'),user:'ADMIN',items:[],total:1000,method:'efectivo',pays:[{m:'efectivo',a:1000,fee:0}],status:'ok'})"%per);ev("acPost()")
        a=ev("S.journal.find(x=>x.id==='AS-v-zz-old')")
        chk(a and a['f'][:7]>per and 'período cerrado' in a['ley'],'un evento con fecha de un mes cerrado se registra en el período abierto, aclarado')
        ev("S.acClose[0].hs='x'")
        chk(ev("acVerify().badC")==1,'alterar un cierre rompe la cadena y se detecta')
    else:chk(False,'hay un mes anterior para cerrar')
    # IVA de compras
    rc=ev("(S.receipts||[]).find(r=>S.journal.some(a=>a.id==='AS-r-'+r.id))")
    if rc:
        ev("A.acIvaC({dataset:{id:'%s'}})"%rc['id']);pg.wait_for_timeout(150);pg.fill('#ac-iv','100');pg.click('#modal-root .ov [data-m=ok]');pg.wait_for_timeout(150)
        chk(ev("S.journal.some(a=>a.id==='AS-ri-%s'&&a.l.some(l=>l.c==='1.1.05'&&l.d===10000))"%rc['id']),'IVA de una compra cargado después genera su asiento de crédito fiscal')
    ev("go('finanzas');A.finTabGo({dataset:{t:'tablero'}})");pg.wait_for_timeout(200)
    pg.set_viewport_size({'width':390,'height':800});pg.wait_for_timeout(250)
    chk(not ow(pg),'Finanzas a 390 px sin desborde')
    ev("go('contable');A.acTabGo({dataset:{t:'diario'}})");pg.wait_for_timeout(250)
    chk(not ow(pg),'Libro Diario a 390 px sin desborde')
    pg.close()
    # ---------- roles ----------
    pg=b.new_page();ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    login_role(pg,'contador','4444',U)
    chk(ev("user&&user.role==='contador'"),'usuario Contador · 4444 en la demo')
    chk(ev("can('accounting')&&can('finance')&&!can('finance_edit')&&!can('accounting_admin')&&!can('sell')"),'contador: ve contabilidad y finanzas, no edita ni vende')
    ev("go('contable')");pg.wait_for_timeout(300)
    chk('Portal del contador' in pg.inner_text('#view'),'contador entra al portal del contador')
    ev("A.acTabGo({dataset:{t:'plan'}})");pg.wait_for_timeout(100)
    chk(pg.locator('[data-act=acCtaNew]').count()==0,'contador no puede cambiar el plan de cuentas')
    n=ev("S.acClose.length");ev("A.acClose({dataset:{p:'2000-01'}})");pg.wait_for_timeout(150)
    chk(ev("document.querySelectorAll('#modal-root .ov').length")==0 and ev("S.acClose.length")==n,'contador no puede cerrar períodos (bloqueado en la acción)')
    n=ev("S.finCmp.length");ev("A.finCmpNew()");pg.wait_for_timeout(150)
    chk(ev("document.querySelectorAll('#modal-root .ov').length")==0,'contador no puede cargar compromisos')
    pg.close()
    pg=b.new_page();ev=pg.evaluate
    login_role(pg,'mostrador','0000',U)
    chk(not ev("can('finance')") and not ev("can('accounting')"),'mostrador no ve Finanzas ni Contabilidad')
    pg.close()
    # ---------- otros perfiles ----------
    for name,url in [('raveV2','file:///tmp/rave/solo.html'),('Kini','file:///tmp/rave/kini.html'),('raveV3','file:///tmp/rave/v3.html')]:
        pg=b.new_page();ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append(name+': '+str(e)[:200]))
        login_role(pg,'admin','1234',url)
        ev("finTab='tablero';go('finanzas')");pg.wait_for_timeout(300);ok1='Liquidez' in pg.inner_text('#view')
        ev("go('contable')");pg.wait_for_timeout(400)
        chk(ok1 and ev("S.journal.length>0&&acVerify().bad===0"),'%s: Finanzas y Contabilidad funcionando'%name)
        pg.close()
    # ---------- cliente: apagado ----------
    pg=b.new_page();ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append('cliente: '+str(e)[:200]))
    pg.goto('file:///tmp/rave/out_cliente.html');pg.wait_for_timeout(1200)
    chk(not ev("finOn()") and not ev("acOn()"),'Almacén RAVE: Finanzas y Contabilidad nacen apagados')
    chk(not ev("S.users.some(u=>u.role==='contador')") and not ev("S.finCmp.length"),'Almacén RAVE: sin contador ni compromisos de ejemplo')
    chk(ev("!SCREENS.finanzas.show.toString().includes('true')"),'pantallas condicionadas')
    pg.close()
    b.close()
chk(not errs,'sin errores de página %s'%errs[:3])
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
