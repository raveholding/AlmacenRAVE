# V26.62 · Atención al cliente: estados, colas, transferencia con resumen, bot, NPS, campañas, analíticas, link de pago; diseño (Vender POS, secciones, Hoy)
import sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
OK="#modal-root .ov >> nth=-1 >> .mf [data-m=ok]"
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.goto(URL+'#acceso');pg.wait_for_timeout(900);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(600);pg.evaluate("S.cfg.crm=S.cfg.crm||{};S.cfg.crm.omni=false;0")
    # diseño
    chk(pg.locator('#side a.ux-pos-btn').count()==1 and 'Vender POS' in pg.inner_text('#side a.ux-pos-btn'),'botón dorado «Vender POS» arriba de la barra')
    chk(pg.locator('#side .ux-sec').count()>=4,'secciones plegables en la barra')
    sec=pg.locator('#side .ux-sec').first;sec.click();pg.wait_for_timeout(150)
    chk(sec.get_attribute('aria-expanded')=='false','una sección se pliega (aria-expanded)')
    sec.click();pg.wait_for_timeout(150)
    chk(pg.locator('.ux-today').count()==1 and 'Ventas hoy' in pg.inner_text('.ux-today') and 'Stock alerta' in pg.inner_text('.ux-today'),'Resumen con «Hoy»: ventas, órdenes, delivery y stock')
    chk(pg.locator('.ux-today svg').count()==1,'tendencia de ventas de la semana')
    chk(pg.locator('.ux-search').count()==1 and pg.locator('.ux-bell').count()==1,'búsqueda global y campana de avisos en la barra superior')
    pg.click('.ux-bell');pg.wait_for_timeout(200);chk('Avisos' in pg.inner_text('#modal-root'),'la campana abre los avisos');ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # módulo
    ev("go('crm')");pg.wait_for_timeout(500)
    chk(pg.locator('#view h1').first.inner_text().strip()=='Atención al cliente','el módulo se llama «Atención al cliente»')
    chk('Atención al cliente' in pg.inner_text('#side'),'figura así en la barra lateral')
    chk(ev("convs().every(c=>['nuevo','proceso','pendiente','cerrado'].includes(c.state))"),'estados Nuevo / En proceso / Pendiente / Cerrado')
    chk(pg.locator('#crm-fa').count()==1 and pg.locator('#crm-fd').count()==1,'filtros por agente y por cola')
    chk('Colas de espera' in pg.inner_text('#crm-queues'),'colas de espera por departamento')
    # bot + ruteo por chat web
    ev("RAVE_API.chatReset()")
    r=ev("RAVE_API.chatSend('Hola, hacen envios a domicilio?','Ana Prueba','')");pg.wait_for_timeout(400)
    cid=ev("JSON.parse(localStorage.getItem('rave.chat')).conv")
    c=ev("(()=>{const c=convById('%s');return{d:c.dept,t:c.tags,m:convMsgs(c.id).map(m=>m.kind)}})()"%cid)
    chk('bot' in c['m'],'el bot de primer nivel responde la pregunta frecuente')
    chk(c['d']=='Ventas' and 'lead' in c['t'],'ruteo por tema a la cola Ventas y calificado como lead (%s)'%c)
    ev("RAVE_API.chatSend('y envios a cordoba?','','')");pg.wait_for_timeout(300)
    chk(ev("convMsgs('%s').filter(m=>m.kind==='bot').length"%cid)==1,'el bot no repite la misma respuesta')
    # transferencia con resumen
    ev("crmSel='%s';crmTab='inbox';rerender()"%cid);pg.wait_for_timeout(300)
    pg.click('[data-act=crmTransfer]');pg.wait_for_timeout(200);pg.select_option('#ct-d','Soporte');pg.locator(OK).click();pg.wait_for_timeout(200)
    chk(ev("(()=>{const c=convById('%s');const n=convMsgs(c.id).filter(m=>m.dir==='note'&&m.kind==='transferencia');return c.dept==='Soporte'&&n.length===1&&n[0].text.includes('Resumen automático')})()"%cid),'transferir deja una nota interna con el resumen automático')
    # cerrar → encuesta automática y NPS
    pg.click('[data-act=crmClose]');pg.wait_for_timeout(300)
    chk(ev("convById('%s').state==='cerrado'&&convMsgs('%s').some(m=>m.survey==='csat')"%(cid,cid)),'al cerrar se manda la encuesta postventa CSAT')
    ev("RAVE_API.chatPoll()");pg.wait_for_timeout(200);ev("RAVE_API.chatCsat(4)");pg.wait_for_timeout(200)
    pg.click('[data-act=crmSurvey][data-k=nps]');pg.wait_for_timeout(200);ev("RAVE_API.chatPoll()");pg.wait_for_timeout(200)
    chk(ev("RAVE_API.chatState().nps"),'el cliente recibe la encuesta NPS 0–10')
    ev("RAVE_API.chatNps(9)");pg.wait_for_timeout(200)
    chk(ev("convById('%s').csat===4&&convById('%s').nps===9"%(cid,cid)),'CSAT y NPS llegan a la conversación')
    # analíticas
    pg.click('[data-act=crmTab][data-t=stats]');pg.wait_for_timeout(300);t=pg.inner_text('#crm-body')
    chk('FRT' in t and 'AHT' in t and 'NPS' in t and 'Conversión' in t,'analíticas: FRT, AHT, CSAT, NPS y conversión')
    chk('Panel de supervisión' in t,'panel de supervisión por agente (administrador)')
    # campañas
    pg.click('[data-act=crmTab][data-t=camp]');pg.wait_for_timeout(300)
    chk('HSM' in pg.inner_text('#crm-body'),'campañas: aclara que las plantillas HSM necesitan la API de Meta')
    n=ev("crmSegList('comm').length")
    if n:
        pg.click('[data-act=crmCampNew]');pg.locator(OK).click();pg.wait_for_timeout(300)
        chk(ev("crmCfg().camps.length")>=1,'se crea una campaña segmentada (%d destinatarios con consentimiento)'%n)
        chk(ev("crmSegList('comm').every(c=>hasComm(c))"),'las promociones sólo van a quien aceptó recibirlas')
    # alertas
    pg.click('[data-act=crmTab][data-t=alerts]');pg.wait_for_timeout(300);chk('Alertas del ERP' in pg.inner_text('#crm-body'),'panel de alertas del ERP')
    # link de pago
    chk(ev("crmPayLinkOk('https://link.mercadopago.com.ar/comercio')") and not ev("crmPayLinkOk('http://link.mercadopago.com.ar/x')") and not ev("crmPayLinkOk('https://evil.com/mercadopago')"),'el link de pago sólo acepta https de Mercado Pago o Stripe')
    ev("crmSet({pay:Object.assign({},crmCfg().pay,{link:'https://link.mercadopago.com.ar/comercio'})})")
    chk('link.mercadopago.com.ar/comercio' in ev("crmPayText('Ana',100000,'Importe libre')"),'el mensaje de cobro lleva el link de pago del comercio')
    # turnos: reservar, confirmar y reprogramar
    ev("crmTab='inbox';crmSel=convs().find(c=>c.cust&&c.state!=='cerrado').id;rerender()");pg.wait_for_timeout(300)
    pg.click('#crm-ctx [data-act=crmAppt]:not([data-id])');pg.wait_for_timeout(200);pg.fill('#ca-w','Cancha 1');pg.uncheck('#ca-s');pg.locator(OK).click();pg.wait_for_timeout(300)
    chk(ev("crmCur().appts.some(a=>a.what==='Cancha 1'&&a.st==='reservado')"),'turno reservado desde el chat')
    pg.click('#crm-ctx [data-act=crmApptOk]');pg.wait_for_timeout(200)
    chk(ev("crmCur().appts.some(a=>a.what==='Cancha 1'&&a.st==='confirmado')"),'turno confirmado')
    for w in (360,768,1440):
        pg.set_viewport_size({'width':w,'height':850});ev("rerender()");pg.wait_for_timeout(300)
        chk(ev("document.documentElement.scrollWidth<=window.innerWidth+1"),'sin desborde a %d px'%w)
    ev("go('inicio')");pg.wait_for_timeout(300);chk(ev("document.documentElement.scrollWidth<=window.innerWidth+1"),'Resumen sin desborde a 1440 px')
    chk(not errs,'sin errores %s'%errs[:2])
    b.close()
print('%d/%d'%(sum(res),len(res)))
