# V26.64 · Recursos Humanos: Plan Micro (≤ 10 legajos activos) / Plan Completo (11 o más), fichaje en modo kiosco,
# bloqueo de funciones del plan superior en la acción, transición automática por alta/baja, nómina interna, aprobaciones,
# portal del empleado, reclutamiento, reporte para el contador y que el cliente nace con el módulo apagado.
import re,sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
def login(pg,idx,pin,url):
    pg.goto(url+'#acceso');pg.wait_for_timeout(900);pg.select_option('#lu',index=idx);pg.fill('#lp',pin);pg.click('[data-act=login]');pg.wait_for_timeout(700)
def ow(pg):
    return pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth+1")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    # ---------- demo RAVE: Plan Micro ----------
    U='file:///tmp/rave/index.html'
    pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    login(pg,0,'1234',U)
    ev("go('rrhh')");pg.wait_for_timeout(400)
    chk(ev("hrTier()")=='micro' and 'Plan Micro' in pg.inner_text('#view'),'demo con %d legajos activos: Plan Micro visible'%ev("hrActive()"))
    tabs=ev("HR_TABS.map(t=>t[0])")
    bad=[]
    for t in tabs:
        ev("A.hrTab({dataset:{t:'%s'}})"%t);pg.wait_for_timeout(150)
        if not pg.locator('#view h1').count():bad.append(t)
    chk(not bad and not errs,'todas las pestañas de RR. HH. abren sin errores %s %s'%(bad,errs[:2]))
    n0=ev("document.querySelectorAll('#modal-root .ov').length")
    ev("A.hrJobNew()");pg.wait_for_timeout(200)
    chk(ev("document.querySelectorAll('#modal-root .ov').length")==n0,'Plan Micro: «Nueva vacante» se bloquea en la acción (no sólo en pantalla)')
    chk(not ev("hrHas('payroll')") and not ev("hrHas('portal')"),'Plan Micro: sin nómina avanzada ni portal')
    # transición automática
    lg0=ev("S.hrPlanLog.length")
    ev("A.hrDemoMore()");pg.wait_for_timeout(300)
    chk(ev("hrActive()")>10 and ev("hrTier()")=='full','al pasar de 10 legajos activos el plan cambia solo a Completo (%d)'%ev("hrActive()"))
    chk(ev("S.hrPlanLog.length")==lg0+1 and ev("S.hrPlanLog[S.hrPlanLog.length-1].to")=='full','la transición queda registrada para facturar')
    chk(ev("S.audit.some(a=>a.action==='RRHH_PLAN')"),'y en auditoría (RRHH_PLAN)')
    ev("A.hrDemoLess()");pg.wait_for_timeout(300)
    chk(ev("hrTier()")=='micro' and ev("S.hrPlanLog[S.hrPlanLog.length-1].to")=='micro','al volver a 10 o menos, vuelve a Micro y se registra')
    # kiosco
    e=ev("(()=>{const e=S.employees.find(x=>x.active&&x.pin);return e?{id:e.id,pin:e.pin}:null})()")
    chk(e is not None,'hay un legajo con PIN para el kiosco')
    ev("A.hrKiosk()");pg.wait_for_timeout(300)
    chk(pg.locator('#hr-kiosk').count()==1,'modo kiosco abierto')
    np0=ev("S.punches.length")
    ev("A.hrKEmp({dataset:{id:'%s'}})"%e['id'])
    wrong='0000' if e['pin']!='0000' else '1111'
    for i in range(5):
        ev("A.hrKEmp({dataset:{id:'%s'}})"%e['id'])
        for k in wrong:ev("A.hrKey({dataset:{k:'%s'}})"%k)
    ev("A.hrKEmp({dataset:{id:'%s'}})"%e['id'])
    for k in e['pin']:ev("A.hrKey({dataset:{k:'%s'}})"%k)
    pg.wait_for_timeout(200)
    chk(ev("S.punches.length")==np0 and 'intentos' in pg.inner_text('#hr-kiosk'),'5 PIN incorrectos bloquean el legajo (ni el PIN correcto ficha durante el bloqueo)')
    chk(ev("S.audit.some(a=>a.action==='RRHH_KIOSCO'&&/bloqueo/.test(a.detail))"),'el bloqueo queda en auditoría')
    ev("window.__hrLock={}")
    ev("A.hrKEmp({dataset:{id:'%s'}})"%e['id'])
    for k in e['pin']:ev("A.hrKey({dataset:{k:'%s'}})"%k)
    pg.wait_for_timeout(200)
    chk(ev("S.punches.length")==np0+1 and ev("S.punches[S.punches.length-1].method")=='pin kiosco','con el PIN correcto ficha (método «pin kiosco»)')
    ev("A.hrKEmp({dataset:{id:'%s'}})"%e['id'])
    for k in e['pin']:ev("A.hrKey({dataset:{k:'%s'}})"%k)
    pg.wait_for_timeout(200)
    chk(ev("S.punches.length")==np0+1,'una segunda fichada antes de 60 s se rechaza')
    ev("A.hrKioskExit()");pg.wait_for_timeout(300)
    chk(pg.locator('#hr-kiosk').count()==0,'el administrador sale del kiosco')
    t=ev("hrRepTable()")
    chk(len(t['h'])>=8 and len(t['rows'])>=1,'reporte para el contador con %d columnas y %d personas'%(len(t['h']),len(t['rows'])))
    chk(not ev("(hrCfg().methods.face||hrCfg().methods.finger)"),'reconocimiento facial y huella apagados (pendientes de dispositivo y revisión legal)')
    pg.set_viewport_size({'width':360,'height':780});ev("A.hrTab({dataset:{t:'inicio'}})");pg.wait_for_timeout(300)
    chk(not ow(pg),'RR. HH. a 360 px sin desborde')
    # dashboard: sólo el admin por defecto
    chk(ev("Object.entries(S.roles).filter(([k,v])=>v.includes('dashboard')).map(x=>x[0]).join()")=='admin','el Resumen sólo lo tiene el administrador por defecto')
    pg.close()
    # ---------- supervisor y mostrador ----------
    pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    login(pg,2,'0000',U)
    chk(not ev("can('hr')") and not ev("can('dashboard')") and not ev("can(SCREENS.inicio.perm)"),'el mostrador no ve RR. HH. ni el Resumen')
    pg.close()
    # ---------- raveV3: Plan Completo ----------
    U3='file:///tmp/rave/v3.html'
    pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    login(pg,0,'1234',U3)
    ev("go('rrhh')");pg.wait_for_timeout(400)
    chk(ev("hrTier()")=='full' and 'Plan Completo' in pg.inner_text('#view'),'raveV3 con %d legajos: Plan Completo'%ev("hrActive()"))
    for t in ['nomina','reclutamiento','vacaciones','documentos','solicitudes','tablero']:
        ev("A.hrTab({dataset:{t:'%s'}})"%t);pg.wait_for_timeout(200)
    chk(not errs,'pestañas del Plan Completo sin errores %s'%errs[:2])
    # aprobación en varios niveles
    r=ev("(()=>{const e=S.employees.find(x=>x.active);const r={id:'t-req',empId:e.id,type:'vacaciones',from:dkey(now()),to:dkey(now()),note:'',ts:now(),by:'ADMIN',flow:['supervisor','rrhh','admin'],step:0,state:'pendiente',trail:[]};S.hrReqs.push(r);return r.flow.length})()")
    for i in range(r):
        ev("A.hrReqOk({dataset:{id:'t-req'}})");pg.wait_for_timeout(150)
    chk(ev("S.hrReqs.find(x=>x.id==='t-req').state")=='aprobada','solicitud con 3 niveles: el administrador la aprueba paso a paso hasta «aprobada»')
    np=ev("S.hrPays.length")
    ev("A.hrTab({dataset:{t:'nomina'}})");pg.wait_for_timeout(200)
    ev("A.hrPayClose()");pg.wait_for_timeout(300)
    if pg.locator('#modal-root .ov .mf [data-m=ok]').count():pg.locator('#modal-root .ov .mf [data-m=ok]').last.click();pg.wait_for_timeout(300)
    chk(ev("S.hrPays.length")==np+1,'se cierra una liquidación interna del período (foto inmutable)')
    tot=ev("(()=>{const r=S.hrPays[S.hrPays.length-1];return r.lines.reduce((a,l)=>a+(l.net||0),0)===r.total})()")
    chk(tot,'el total de la liquidación es la suma de los netos')
    nc=ev("S.hrCands.length")
    j=ev("S.hrJobs[0]&&S.hrJobs[0].id")
    chk(j is not None,'hay vacantes de ejemplo en el tablero de reclutamiento')
    c=ev("S.hrCands.find(x=>x.stage==='recibido')")
    if c:
        ev("A.hrCandMove({dataset:{id:'%s',d:'1'}})"%c['id']);pg.wait_for_timeout(200)
        chk(ev("S.hrCands.find(x=>x.id==='%s').stage"%c['id'])!='recibido','un candidato avanza de etapa en el Kanban')
    pg.close()
    # portal del empleado
    pg=b.new_page(viewport={'width':390,'height':844});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    idx=ev("0") or 0
    pg.goto(U3+'#acceso');pg.wait_for_timeout(900)
    opts=pg.locator('#lu option').all_inner_texts()
    ie=[i for i,o in enumerate(opts) if 'Empleado' in o]
    if ie:
        pg.select_option('#lu',index=ie[0]);pg.fill('#lp','2222');pg.click('[data-act=login]');pg.wait_for_timeout(700)
        chk(ev("curScreen")=='portal' and not ev("can('dashboard')"),'el empleado entra a su portal y no ve el Resumen')
        chk(not ow(pg),'portal a 390 px sin desborde')
    else:chk(False,'existe el usuario Empleado (portal)')
    pg.close()
    # ---------- cliente: módulo apagado ----------
    pg=b.new_page();ev=pg.evaluate
    pg.goto('file:///tmp/rave/out_cliente.html');pg.wait_for_timeout(1200)
    chk(not ev("hrOn()"),'Almacén RAVE: Recursos Humanos nace apagado')
    chk(not ev("S.users.some(u=>u.role==='empleado')"),'Almacén RAVE: sin usuarios de ejemplo')
    pg.close()
    b.close()
chk(not errs,'sin errores de página %s'%errs[:3])
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
