# V26.40 · Centro Inteligente: correcciones de la revisión independiente (privacidad entre usuarios, permisos del feed,
# tope de tamaño para la nube, voz del Asistente general y configuraciones viejas o mal formadas).
from playwright.sync_api import sync_playwright
import sys
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    ctx=b.new_context(viewport={'width':1280,'height':900})
    ctx.add_init_script("window.__cancels=0;Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak:()=>{},cancel:()=>{window.__cancels++;},getVoices:()=>[]}});")
    pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("(()=>{S.employees.forEach((e,i)=>S.punches.push({id:'r'+i,empId:e.id,ts:now()-3600e3,kind:'in',method:'pin'}));audit('FICHAJE','Empleado 1 · entrada · pin');audit('CIERRE_CAJA','Caja 1 · diferencia -500');S.cfg.ci={on:true,roles:['mostrador']};save();showPanel('centro');})()");pg.wait_for_timeout(500)
    ev("A.ciChip({dataset:{id:'margen'}})");pg.wait_for_timeout(300)
    chk('Margen' in pg.inner_text('.ci-chat') or 'No hay ventas' in pg.inner_text('.ci-chat'),'el administrador consulta márgenes')
    # 1) otro usuario en el mismo equipo no ve la conversación anterior
    ev("(()=>{window.__u=user;user={name:'Mostrador',role:'mostrador'};showPanel('centro');})()");pg.wait_for_timeout(400)
    chk(ev("CI.st.chat.length")==0 and 'Margen' not in pg.inner_text('#view'),'al cambiar de usuario se vacía la conversación (no se ven márgenes ni deudas del anterior)')
    # 2) feed: sin «Personal y fichaje» no se ven nombres de fichajes; sin permiso de caja no se ve la diferencia
    t=pg.inner_text('.ci-feed') if pg.locator('.ci-feed').count() else ''
    staff=ev("can('staff')");cash=ev("can('close_cash')||can('cash_mov')")
    chk(staff or 'Empleado 1 · entrada' not in t,'actividad reciente sin el nombre de quien fichó para un rol sin permiso de personal')
    chk(cash or 'diferencia -500' not in t,'actividad reciente sin el detalle del cierre de caja para un rol sin permiso de caja')
    chk(pg.locator('.ci-team').count()==(1 if staff else 0),'la sección de equipo respeta el permiso de personal')
    ev("user=window.__u;showPanel('centro')");pg.wait_for_timeout(300)
    # 3) tope de tamaño para la nube
    big="data:image/jpeg;base64,"+"A"*59000
    r=ev("""(()=>{const st={};for(let i=0;i<4;i++)st['x'+i]={ph:'%s'};const nc=Object.assign({},S.cfg.ci,{staff:st});return CI.fits(nc)})()"""%big)
    chk(r==True,'personas que ya no existen se podan antes de medir (no ocupan lugar)')
    r=ev("""(()=>{const st={};CI.team().slice(0,4).forEach(p=>st[p.k]={ph:'%s'});const nc=Object.assign({},S.cfg.ci,{staff:st});return CI.fits(nc)})()"""%big)
    chk(r==False,'si las fotos pasan el tope, no se guarda y avisa (la configuración del sistema sigue sincronizando)')
    chk(ev("JSON.stringify(S.cfg).length")<350000,'la configuración guardada queda bajo el tope de la nube')
    # 4) cambiar entre otras pantallas no corta la voz del Asistente general
    ev("CI.speak&&(CI._spoken='x');location.hash='#panel/vender'");pg.wait_for_timeout(300);c1=ev("__cancels")
    ev("location.hash='#panel/inventario'");pg.wait_for_timeout(300);ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    chk(ev("__cancels")==c1,'moverse entre otras pantallas no cancela la voz del Asistente general')
    # 5) configuraciones viejas o mal formadas no rompen nada
    ev("(()=>{window.__u=user;user={name:'Operador X',role:'operador'};S.cfg.ci.roles='mostrador,operador';})()")
    chk(not ev("CI.allowed()"),'«roles» como texto (versión vieja) no habilita a nadie por coincidencia parcial')
    ev("user=window.__u")
    k=ev("CI.team()[0].k")
    ev("(()=>{S.cfg.ci.roles=[];S.cfg.ci.staff={'%s':{alias:{a:1},fn:'__proto__',av:'x',col:'red'}};S.cfg.ci.map={items:[{t:'gond'}]};showPanel('centro');})()"%k);pg.wait_for_timeout(500)
    chk(pg.locator('.ci-root canvas.ci-cv').count()==1 and 'tuvo un error' not in pg.inner_text('#view'),'nombre visible, función y mapa mal formados no rompen la pantalla')
    chk(ev("CI.mapOf().auto")==True,'un mapa sin tamaño vuelve al plano automático')
    chk(ev("CI.team().find(p=>p.k==='%s').fn"%k) in ('vendedor','cajero','repositor','deposito','gerente'),'una función inválida se reemplaza por la automática')
    chk(not errs,'sin errores de JavaScript %s'%errs[:2])
    b.close()
print('%d / %d'%(sum(res),len(res)))
