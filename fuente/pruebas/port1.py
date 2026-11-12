# V26.68 · Seguridad y portero (SeguridadRave por ntfy): timbre con foto, respuesta, QR, alarmas, pánico, permisos
# Compilar antes: build.py demo /tmp/rave/index.html
import json,time
from playwright.sync_api import sync_playwright
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
P='svb-own-prueba123';Q='svbqr-prueba4567'
Qe=[];posts=[];gets=[]
def h(route):
    r=route.request
    if r.method=='POST':
        posts.append((r.url,r.post_data));return route.fulfill(status=200,body='{}',headers={'Access-Control-Allow-Origin':'*'})
    if '/sse' in r.url:
        gets.append(r.url);body='retry: 400\n\n'+''.join('data: '+json.dumps(m)+'\n\n' for m in Qe);Qe.clear()
        return route.fulfill(status=200,body=body,headers={'Content-Type':'text/event-stream','Access-Control-Allow-Origin':'*'})
    if '/file/' in r.url:
        return route.fulfill(status=200,body=b'\x89PNG\r\n\x1a\n',headers={'Content-Type':'image/png','Access-Control-Allow-Origin':'*'})
    route.fulfill(status=404,body='')
def m(topic,**k):
    d=dict(id='m'+str(time.time_ns())[-9:],time=int(time.time()),event='message',topic=topic);d.update(k);return d
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1300,'height':900});ev=pg.evaluate;errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.route('https://ntfy.sh/**',h)
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(1200)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(700)
    chk(ev("can('security')&&can('security_alarm')"),'el administrador tiene los permisos de seguridad')
    chk(ev("S.roles.mostrador.includes('security')&&!S.roles.mostrador.includes('security_alarm')"),'mostrador atiende el timbre pero no ve pánico/coacción')
    chk(ev("NAV.some(n=>n[0]==='seguridad')"),'«Seguridad y portero» está en el menú')
    ev("go('seguridad')");pg.wait_for_timeout(400)
    chk(pg.locator('#pt-card').is_visible(),'la pantalla muestra la configuración al administrador')
    pg.fill('#pt-p','corto');pg.check('#pt-on');pg.click('[data-act=ptCfgSave]');pg.wait_for_timeout(300)
    chk(not ev("ptCfg().on"),'rechaza un tema inválido')
    pg.fill('#pt-p',P);pg.fill('#pt-q','https://raveholding.github.io/SeguridadRave/timbre.html#t='+Q);pg.check('#pt-on');pg.click('[data-act=ptCfgSave]');pg.wait_for_timeout(600)
    chk(ev("ptCfg().on&&ptKeys.p")==P and ev("ptKeys.q")==Q,'guarda los temas (acepta el enlace del cartel del timbre)')
    a=[x for x in ev("S.audit.filter(e=>e.action==='PORTERO_CONFIG').map(e=>e.detail)")]
    chk(a and P not in a[-1] and Q not in a[-1],'la auditoría no guarda los temas')
    chk(P not in pg.locator('#pt-card').inner_html(),'el tema no se muestra completo en pantalla')
    pg.wait_for_timeout(4800)
    chk(any(P in g and P+'-c' in g and Q+'-r' in g for g in gets),'escucha los 4 canales (avisos, control, timbre QR y respuestas)')
    chk('Conectado' in pg.locator('[data-ptstate]').first.inner_text(),'estado: conectado al portero')
    # timbre en la puerta, con foto
    ev("go('inventario')");pg.wait_for_timeout(300)
    Qe.append(m(P,message='You received a file: foto.jpg',attachment={'url':'https://ntfy.sh/file/abc.jpg','type':'image/jpeg','name':'foto.jpg'}))
    Qe.append(m(P,title='🔔 Tocan el timbre',message='Hay alguien en la puerta',priority=5,actions=[{'action':'http','label':'Ya voy','body':json.dumps({'type':'reply','id':'r1','code':'voy'})}]))
    pg.wait_for_timeout(2500)
    al=pg.locator('#pt-stack .pt-al')
    chk(al.count()==1 and 'Tocan el timbre' in al.first.inner_text(),'el timbre aparece en cualquier pantalla')
    chk(pg.locator('#pt-stack img.pt-ph').count()==1,'muestra la foto de la cámara')
    chk(pg.locator('#pt-stack [data-act=ptReply]').count()==4 and 'Abrir panel de seguridad' in al.first.inner_text(),'4 respuestas + abrir el panel (sin abrir la puerta)')
    chk(pg.locator('#pt-stack').get_by_text('Abrir la puerta').count()==0,'no hay botón para abrir la puerta')
    # modal abierto: el aviso queda encima
    ev("modal('Prueba','<p>x</p>')");pg.wait_for_timeout(300)
    z=ev("+getComputedStyle($('#pt-stack')).zIndex>+getComputedStyle($('.ov')).zIndex");chk(z,'el aviso queda encima de las ventanas');pg.keyboard.press('Escape')
    pg.click('#pt-stack [data-act=ptReply][data-c=voy]');pg.wait_for_timeout(600)
    rep=[json.loads(d) for u,d in posts if u.endswith(P+'-c')]
    chk(rep and rep[-1]=={'type':'reply','id':'r1','code':'voy'},'responde al portero por el canal de control')
    chk('Ya voy' in pg.locator('#pt-stack').inner_text(),'el aviso muestra la respuesta enviada')
    chk(ev("S.audit.some(e=>e.action==='PORTERO_TIMBRE')&&S.audit.some(e=>e.action==='PORTERO_RESPUESTA')"),'timbre y respuesta quedan en la auditoría')
    # timbre por QR respondido desde otro equipo
    Qe.append(m(Q,message=json.dumps({'type':'ring','id':'q1','name':'Juan','msg':'Delivery'})));pg.wait_for_timeout(2000)
    chk('Juan' in pg.locator('#pt-stack').inner_text(),'timbre por QR con el nombre de la visita')
    Qe.append(m(P+'-c',message=json.dumps({'type':'reply','id':'q1','code':'momento'})));pg.wait_for_timeout(2000)
    t=pg.locator('#pt-stack .pt-al').first.inner_text()
    chk('Un momento' in t and 'otra persona' in t,'si otro respondió, el aviso lo muestra y deja de sonar')
    # timbre QR respondido acá: respaldo a la visita
    posts.clear();Qe.append(m(Q,message=json.dumps({'type':'ring','id':'q2','name':'Ana'})));pg.wait_for_timeout(2000)
    pg.click('#pt-stack .pt-al:has-text("Ana") [data-act=ptReply][data-c=deje]');pg.wait_for_timeout(5800)
    vr=[json.loads(d) for u,d in posts if u.endswith(Q+'-r')]
    chk(vr and vr[-1]['code']=='deje' and vr[-1]['id']=='q2' and vr[-1]['text'],'a la visita del QR le llega la respuesta aunque el portero esté apagado')
    # alarma y aviso informativo
    Qe.append(m(P,title='🚨 Intrusión',message='Puerta abierta con la alarma armada',priority=5));Qe.append(m(P,title='ℹ️ Fuera de horario',message='Movimiento',priority=3));pg.wait_for_timeout(2000)
    tx=pg.locator('#pt-stack').inner_text()
    chk('Intrusión' in tx and 'Fuera de horario' not in tx,'muestra alarmas; avisos informativos apagados por defecto')
    # pánico: sólo con permiso y silencioso
    Qe.append(m(P,title='🚨 COACCIÓN',message='PIN de coacción en la puerta',priority=5));pg.wait_for_timeout(2000)
    chk(pg.locator('#pt-stack .pt-al.silent').count()==1,'pánico/coacción: alerta silenciosa para quien tiene el permiso')
    # mostrador
    ev("A.logout()");pg.wait_for_timeout(500);chk(pg.locator('#pt-stack').count()==0 and ev('ptKeys')==None,'al salir se ocultan los avisos y se olvidan los temas');pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(800)
    pg.select_option('#lu',index=2);pg.fill('#lp','0000');pg.click('[data-act=login]');pg.wait_for_timeout(5000)
    Qe.append(m(P,title='🚨 PÁNICO',message='Botón de pánico',priority=5));Qe.append(m(P,title='🔔 Tocan el timbre',message='Puerta',actions=[{'body':json.dumps({'type':'reply','id':'r9','code':'voy'})}]));pg.wait_for_timeout(2500)
    tx=pg.locator('#pt-stack').inner_text() if pg.locator('#pt-stack').count() else ''
    chk('Puerta' in tx and 'PÁNICO' not in tx and 'Botón de pánico' not in tx,'mostrador recibe el timbre y NO el pánico')
    ev("go('seguridad')");pg.wait_for_timeout(400)
    chk(pg.locator('#pt-card').count()==0 and 'COACCI' not in pg.locator('#view').inner_text(),'mostrador no ve la configuración ni el historial de pánico')
    # equipo apagado
    pg.uncheck('#ptd-on');pg.click('[data-act=ptDevSave]');pg.wait_for_timeout(4500)
    n=len(gets);pg.wait_for_timeout(2000);chk(len(gets)==n,'«no recibir en este equipo» corta la conexión')
    chk(not errs,'sin errores JS '+str(errs[:2]))
    b.close()
# ---------- nube: los temas viajan cifrados con la llave del comercio ----------
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page();ev=pg.evaluate;errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.goto('file:///tmp/rave/cli.html#acceso');pg.wait_for_timeout(1500)
    r=ev("""(async()=>{cl.dek=await dekKey(rnd(32));cl.comercio=Object.assign(cl.comercio||{},{id:'c1'});await ptSaveKeys({p:'%s',q:'%s'});
      const box=JSON.stringify(S.cfg.portero);ptKeys=null;await ptLoadKeys();const ok=ptKeys&&ptKeys.p==='%s';
      cl.comercio.id='otro';ptKeys=null;await ptLoadKeys();return [box.includes('%s'),box.includes('%s'),!!S.cfg.portero.sec,S.cfg.portero.plain,ok,ptKeys];})()"""%(P,Q,P,P,Q))
    chk(r[2] and not r[0] and not r[1] and r[3] is None,'en la nube los temas se guardan sólo cifrados')
    chk(r[4],'con la llave del comercio se recuperan')
    chk(r[5] is None,'con otro comercio (otra llave/AAD) no se pueden abrir')
    chk('https://ntfy.sh' in pg.evaluate("document.querySelector('meta[http-equiv=Content-Security-Policy]').content"),'la política de seguridad sólo agrega el relevo ntfy.sh')
    chk(not errs,'nube sin errores JS '+str(errs[:2]))
    b.close()
print('\n%d/%d'%(sum(res),len(res)))
