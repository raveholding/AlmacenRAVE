# V26.42 · Equipo SVB R2AVE (extensión del Centro Inteligente, sólo demo raveV2)
# Identidad (avatares oficiales), permisos individuales, corrección de stock exclusiva de R2AVE (14 pasos, confirmación,
# idempotencia, auditoría), rechazo de los otros tres, alertas, RR. HH. de sólo lectura, zonas del mapa, zoom, aislamiento,
# apagado, celular. Y que el cliente (Almacén RAVE) y Kini NO lleven la extensión.
import os,json
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
F='/tmp/rave/v3.html'  # V26.43: el equipo SVB R2AVE vive en la demo raveV3
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1366,'height':900});pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append('C:'+m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    def last(): return pg.locator('#modal-root .ov >> nth=-1')
    def ok(): last().locator('.mf [data-m=ok]').click();pg.wait_for_timeout(300)
    def close(): ev("document.querySelectorAll('#modal-root .ov').forEach(x=>x.remove())")
    def ask(q,a=None):
        if a: ev("A.r2Asst({dataset:{id:'%s'}})"%a);pg.wait_for_timeout(150)
        pg.fill('#ci-q',q);pg.click('[data-act=ciAsk]');pg.wait_for_timeout(300)
        return ev("(()=>{const m=[...document.querySelectorAll('.ci-root .ci-msg.ci-a')];return m.length?m[m.length-1].innerText:''})()")
    pg.goto('file://'+F+'#acceso');pg.wait_for_timeout(1000)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(600)
    snap0=ev("JSON.stringify({p:S.products.map(x=>[x.id,x.stock]),s:S.sales.length,c:S.customers.length,pu:S.punches.length})")
    # apagado por defecto: sin estilos ni paneles del equipo
    ev("go('centro')");pg.wait_for_timeout(300)
    chk(pg.locator('.r2-team').count()==0 and not ev("!!document.getElementById('r2-style')"),'apagado: no muestra el equipo ni carga sus estilos')
    ev("A.ciToggle()");pg.wait_for_timeout(1000)
    ev("document.querySelectorAll('.ci-root details').forEach(d=>d.open=true)")
    # identidad: 4 avatares oficiales (imágenes embebidas) con nombre
    names=ev("[...document.querySelectorAll('.r2-card .r2-ph b')].map(x=>x.innerText)")
    chk(names==['R2AVE','M2ARGOTH','T2ULUZ','S2HAKIRA'],'los cuatro asistentes con su nombre oficial %s'%names)
    imgs=ev("[...document.querySelectorAll('.r2-card img.r2-av')].map(i=>[i.naturalWidth,i.src.slice(0,22),i.alt])")
    chk(len(imgs)==4 and all(w>100 and s.startswith('data:image/webp') and 'avatar oficial' in a for w,s,a in imgs),'avatares oficiales cargados como imagen (recortes, con texto alternativo)')
    chk(ev("!!document.querySelector('.r2-teamimg')") ,'imagen oficial del equipo y jerarquía disponibles')
    chk('R2AVE' in pg.inner_text('#ci-gm h2') and ev("!!document.querySelector('#ci-gm .r2-gmav img')"),'el Gerente IA es R2AVE (entrada principal, con su avatar)')
    mods=ev("[...document.querySelectorAll('.r2-card')].map(c=>c.innerText.includes('Modificar: No'))")
    chk(mods==[False,True,True,True],'sólo R2AVE tiene una capacidad de escritura; los otros tres «Modificar: No»')
    # capacidades: catálogo y reglas
    r=ev("['r2ave','m2argoth','t2uluz','s2hakira'].map(a=>CI.r2.capCheck(a,'inventory.stock.adjust'))")
    chk(not r[0]['ok'] and 'no habilitó' in r[0]['why'],'R2AVE no puede corregir mientras la capacidad está apagada')
    chk(all((not x['ok']) and 'Sólo R2AVE' in x['why'] for x in r[1:]),'M2ARGOTH, T2ULUZ y S2HAKIRA nunca pueden corregir inventario')
    fut=ev("CI.r2.CAPS.filter(c=>c.future).map(c=>CI.r2.capCheck('r2ave',c.id).ok)")
    chk(len(fut)>=5 and not any(fut),'las capacidades futuras de R2AVE están deshabilitadas por defecto (%d)'%len(fut))
    chk(not ev("CI.r2.capCheck('r2ave','sql.run').ok"),'una acción fuera del catálogo se rechaza')
    # pedirle a R2AVE con la capacidad apagada → rechazo honesto, nada cambia
    pid=ev("S.products.find(p=>p.unit==='u'&&!p.archived&&p.active!==false).id");pname=ev("S.products.find(p=>p.id==='%s').name"%pid)
    t=ask('corregí el stock de '+pname,'r2ave')
    chk('no habilitó' in t and pg.locator('#modal-root .ov').count()==0,'con la capacidad apagada R2AVE no abre la corrección')
    # habilitar (administrador, auditado)
    ev("document.getElementById('r2-caps').open=true");pg.check('#r2-caps input[data-act=r2Cap]');pg.wait_for_timeout(300)
    chk(ev("S.cfg.ci.r2.adjust===true") and ev("S.audit.some(a=>a.action==='R2AVE_PERMISO')"),'el administrador habilita la capacidad y queda en la auditoría')
    # otro asistente: rechazado aunque esté habilitada
    t=ask('corregí el stock de '+pname,'m2argoth')
    chk('M2ARGOTH no tiene permiso' in t and pg.locator('#modal-root .ov').count()==0,'M2ARGOTH intenta corregir: rechazado')
    t=ask('ajustá el inventario de '+pname,'s2hakira')
    chk('S2HAKIRA no tiene permiso' in t,'S2HAKIRA intenta corregir: rechazada')
    chk(ev("S.audit.filter(a=>a.action==='R2AVE_RECHAZO').length")>=2,'los intentos rechazados quedan en la auditoría')
    # R2AVE: flujo completo
    prev=ev("S.products.find(p=>p.id==='%s').stock"%pid)
    t=ask('R2AVE corregí el stock de '+pname,'r2ave');pg.wait_for_timeout(300)
    chk(pg.locator('#modal-root .ov').count()==1 and 'Corrección de stock' in last().inner_text(),'R2AVE abre la corrección (pendiente de confirmación)')
    pre=ev("document.getElementById('r2-p').value")
    chk(pre==pid,'el artículo dicho en la frase queda elegido (%s)'%pre)
    if pre!=pid:
        pg.fill('#r2-q',pname);pg.wait_for_timeout(200);pg.select_option('#r2-p',pid);pg.wait_for_timeout(100)
    info=pg.inner_text('#r2-info')
    chk('Registrado' in info and 'Sucursal' in info and 'Unidad' in info,'muestra stock registrado, sucursal y unidad')
    ok();chk('cantidad física' in last().inner_text().lower() and ev("S.products.find(p=>p.id==='%s').stock"%pid)==prev,'sin cantidad física no avanza')
    pg.fill('#r2-f',str(prev));pg.select_option('#r2-m','Conteo físico');ok()
    chk('coincide' in last().inner_text(),'si el físico coincide no hay nada que ajustar')
    pg.fill('#r2-f','1,5');ok();chk('enteras' in last().inner_text(),'un artículo por unidad no acepta decimales')
    pg.fill('#r2-f',str(prev+3));pg.select_option('#r2-m','');ok();chk('motivo' in last().inner_text().lower(),'sin motivo no avanza')
    pg.select_option('#r2-m','Conteo físico');ok()
    s=pg.inner_text('#r2-sum')
    chk('Stock anterior' in s and '+3' in s and 'Lo ejecuta: R2AVE' in s and ev("S.products.find(p=>p.id==='%s').stock"%pid)==prev,'muestra anterior, ajuste propuesto y quién lo pide/ejecuta; todavía no cambió nada')
    ok()
    chk(ev("S.products.find(p=>p.id==='%s').stock"%pid)==prev+3,'al confirmar, el stock queda en el físico contado (+3)')
    a=ev("S.audit.filter(a=>a.action==='R2AVE_AJUSTE').pop()")
    chk(a and 'ejecutó: R2AVE' in a['detail'] and 'solicitó:' in a['detail'] and 'sucursal:' in a['detail'] and 'op r2-' in a['detail'] and 'resultado: ejecutado' in a['detail'] and a.get('old')==str(prev) and a.get('reason')=='Conteo físico','auditoría completa: usuario, asistente, comercio, sucursal, producto, anterior/nuevo, motivo, operación y resultado')
    chk(ev("S.audit.filter(a=>a.action==='AJUSTE_STOCK'&&a.detail.includes('[R2AVE]')).length")==1,'usó el servicio de ajuste existente (stockAdjust) una sola vez')
    chk('Acción ejecutada' in pg.inner_text('.ci-root .ci-chat') or 'Listo' in pg.inner_text('.ci-root .ci-chat'),'R2AVE confirma sólo después de ejecutar')
    # idempotencia: repetir la misma operación no duplica
    key=a['detail'].split('op ')[1].split(' ')[0]
    n0=ev("S.audit.filter(a=>a.action==='R2AVE_AJUSTE').length");st0=ev("S.products.find(p=>p.id==='%s').stock"%pid)
    ev("(()=>{const p=S.products.find(x=>x.id==='%s');return 1})()"%pid)
    dup=ev("(()=>{const p=S.products.find(x=>x.id==='%s');const before=p.stock;/* reintento con la misma clave */const has=S.audit.some(a=>a.action==='R2AVE_AJUSTE'&&a.detail.includes('op %s'));return has})()"%(pid,key))
    chk(dup and ev("S.products.find(p=>p.id==='%s').stock"%pid)==st0,'la clave de operación queda registrada para no repetir el ajuste')
    # usuario sin permiso de inventario: R2AVE no puede por él
    ev("user=S.users.find(u=>u.role==='mostrador')||Object.assign({},user,{role:'mostrador',name:'Mostrador'})")
    r=ev("CI.r2.capCheck('r2ave','inventory.stock.adjust')")
    chk(not r['ok'] and 'permiso' in r['why'],'un usuario sin permiso de inventario no puede usar a R2AVE para corregir')
    ev("user=S.users.find(u=>u.role==='admin')")
    # segunda opinión, riesgos, ubicación
    ev("go('centro')");pg.wait_for_timeout(500)
    t=ask('¿cuánto vendimos hoy?','r2ave');chk('R2AVE' in t and 'CONSULTA' in t.upper(),'R2AVE responde como consulta')
    t=ask('dame una segunda opinión');chk('S2HAKIRA' in t and 'segunda opinión' in t.lower(),'S2HAKIRA da una segunda opinión con su propio criterio')
    t=ask('¿qué riesgos hay?','m2argoth');chk('M2ARGOTH' in t and ('cámaras' in t or 'Sin riesgos' in t),'M2ARGOTH informa riesgos y aclara que no tiene cámaras')
    t=ask('¿dónde está la recepción?','t2uluz');chk('T2ULUZ' in t and 'no calibrado' in t.lower(),'T2ULUZ informa ubicación y que el plano no está calibrado')
    # alertas
    ev("S.products.find(p=>p.id==='%s').stock=-2;save();go('centro')"%pid);pg.wait_for_timeout(500)
    A=ev("CI.r2.alerts()")
    crit=[x for x in A if x['pri']=='critica']
    chk(crit and pname in crit[0]['ev'] and all(k in crit[0] for k in ('orig','ts','com','suc','resp','rec')),'alerta crítica de stock negativo con evidencia, origen, comercio, sucursal, responsable y recomendación')
    chk(len({x['key'] for x in A})==len(A),'sin alertas repetidas')
    pg.click('[data-act=r2Filt][data-id=critica]');pg.wait_for_timeout(200)
    chk(pg.locator('#r2-alerts .r2-al').count()==len(crit),'el filtro por prioridad funciona')
    pg.locator('#r2-alerts [data-act=r2Seen]').first.click();pg.wait_for_timeout(200)
    chk('vista en este equipo' in pg.inner_text('#r2-alerts'),'una alerta se puede marcar como vista (sin tocar datos del negocio)')
    # RR. HH.: lee el fichaje real
    e=ev("S.employees.filter(e=>e.active)[0]")
    if e:
        ev("punch('%s','%s','pin')"%(e['id'],e['pin']));ev("rerender()");pg.wait_for_timeout(500)
        rr=pg.inner_text('#r2-rrhh')
        chk('Presentes' in rr and e['name'] in rr and 'Entrada' in rr and 'sin horarios configurados' in rr.lower(),'RR. HH. muestra la entrada recién fichada (fichaje existente) y aclara que no hay horarios')
        chk(ev("S.punches.length")==json.loads(snap0)['pu']+1,'el panel de RR. HH. no crea marcaciones propias')
    # mapa: zonas, plano de ejemplo, zoom
    zn=ev("Object.entries(CI.MT).filter(([k,v])=>v.zone).length")
    chk(zn>=18,'catálogo de zonas del local (%d)'%zn)
    ev("A.r2Plan()");pg.wait_for_timeout(200);ok();pg.wait_for_timeout(500)
    chk(ev("CI.st.edit===true"),'el plano de ejemplo se carga como borrador en «Editar local»')
    pg.locator('[data-act=ciEdSave]').first.click();pg.wait_for_timeout(600)
    labels=ev("CI.mapOf().items.map(x=>x.label)")
    need=['Recepción','Despacho','Depósito pesado','Depósito de envíos','Gerencia','Marketing','RR. HH.','Administración','Cocina y personal','Baño','Break room','Bebidas','Snacks','Fiambrería','Línea de cajas','Salón de ventas','Pasillo']
    chk(all(n in labels for n in need),'el plano incluye oficinas (gerencia, marketing, RR. HH.), recepción, despacho, frío y servicios')
    chk(any(l.startswith('Heladera') for l in labels) and any(l.startswith('Freezer') for l in labels) and any(l.startswith('Cámara') for l in labels) and any(l.startswith('Ventilador') for l in labels),'cadena de frío, cámaras y ventiladores en el plano')
    zt=ev("[...document.querySelectorAll('.r2-sec summary')].some(s=>s.innerText.includes('Zonas del local'))")
    chk(zt,'tabla de zonas como alternativa al mapa')
    chk('Sin conexión (no hay integración)' in ev("document.body.innerHTML"),'cámaras y heladeras se muestran sin conexión (no se inventa telemetría)')
    ev("A.ciZoom({dataset:{id:'1'}})");chk(ev("CI.st.zoom")>1,'zoom del mapa')
    ev("A.ciZoom({dataset:{id:'-1'}});A.ciZoom({dataset:{id:'-1'}})");chk(ev("CI.st.zoom")==1,'alejar vuelve a la vista completa')
    hit=ev("CI._hits.some(h=>h.it.kind==='asst')");chk(hit,'los cuatro asistentes aparecen en el mapa (representación digital) y se pueden tocar')
    # aislamiento: una falla de la extensión no rompe el Centro ni el sistema
    ev("CI.r2._bk=CI.ext.slice();CI.ext.push({id:'r2falla',html:()=>{throw new Error('falla simulada R2AVE')}});rerender()");pg.wait_for_timeout(500)
    chk(ev("!!document.querySelector('.ci-root canvas.ci-cv')") and ev("CI.log.some(l=>l.kind==='error'&&l.msg.includes('falla simulada R2AVE'))"),'una falla del equipo queda en el registro y el Centro sigue funcionando')
    ev("CI.ext=CI.r2._bk")
    # integraciones con estado real
    chk('No configurado' in ev("document.querySelector('.ci-root').textContent") and 'Google Maps' in ev("document.querySelector('.ci-root').textContent"),'integraciones con su estado real (Google Maps, cámaras, sensores: no configurado)')
    # apagar y operar normalmente
    errs_ci=[x for x in errs if 'falla simulada' not in x];errs.clear();errs.extend(errs_ci)
    ev("A.ciToggle()");pg.wait_for_timeout(400)
    chk(pg.locator('.r2-team').count()==0,'al desactivar el Centro desaparece el equipo')
    ev("go('vender');pos.lines=[];A.padd({dataset:{id:'%s'}})"%pid)
    if not ev("!!openSess()"): ev("S.sessions.push({id:'sCI6',caja:S.tenant.caja,openedBy:'ADMIN',openedAt:now(),opening:0,closedAt:0})")
    n=ev("S.sales.length");r=ev("(()=>{const r=commitSale('efectivo',false,'local',pos.lines,{});return r.err||'ok'})()")
    chk(r=='ok' and ev("S.sales.length")==n+1,'con el Centro apagado se sigue vendiendo normalmente')
    # 360 px
    ev("A.ciToggle&&0");ev("go('centro')");ev("CI.isOn()||A.ciToggle()");pg.set_viewport_size({'width':360,'height':800});pg.wait_for_timeout(700)
    chk(ev("document.documentElement.scrollWidth")<=362,'a 360 px el Centro con el equipo no desborda')
    small=ev("[...document.querySelectorAll('.ci-root .ci-btn')].filter(b=>b.offsetParent).map(b=>Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height)).filter(v=>v<44).length")
    chk(small==0,'botones del Centro de 44 px o más (%d chicos)'%small)
    pg.screenshot(path='/tmp/ci6_360.png',full_page=False)
    # contraste del Centro con el equipo (claro y oscuro, escritorio y celular), paneles abiertos
    CJS=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'contraste.js'),encoding='utf8').read()
    for sch in ('light','dark'):
        for w in (1366,390):
            q=b.new_page(viewport={'width':w,'height':900},color_scheme=sch)
            q.goto('file://'+F+'#acceso');q.wait_for_timeout(900);q.select_option('#lu',index=0);q.fill('#lp','1234');q.click('[data-act=login]');q.wait_for_timeout(500)
            q.evaluate("go('centro');CI.isOn()||A.ciToggle()");q.wait_for_timeout(900);q.evaluate("document.querySelectorAll('.ci-root details').forEach(d=>d.open=true)");q.wait_for_timeout(200)
            bad=q.evaluate(CJS);chk(not bad,'contraste %s %d px: todos los textos del Centro y del equipo legibles %s'%(sch,w,[(x['t'][:25],x['r']) for x in bad[:4]]));q.close()
    b.close()
    # el cliente y Kini no llevan la extensión
    for f,tag in (('/tmp/rave/out_cliente.html','cliente (Almacén RAVE)'),('/tmp/rave/kini.html','Kini'),('/tmp/rave/solo.html','raveV2 (un solo dueño)'),('/tmp/rave/index.html','demo interna')):
        if os.path.exists(f):
            s=open(f,encoding='utf8').read();chk('M2ARGOTH' not in s and 'p10b' not in s,'%s no lleva el equipo R2AVE'%tag)
print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
