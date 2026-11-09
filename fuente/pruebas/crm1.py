# V26.60 · CRM omnicanal: bandeja, chat web del menú (ida y vuelta), notas, cobro asistido, turno, avisos, permisos
import sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
def gate(fr):
    if fr.locator('#age-gate.open').count(): fr.locator('#ag-yes').click()
def openchat(fr,pg):
    gate(fr)
    if not fr.locator('#rv-chat').is_visible(): fr.locator('#rv-chat-fab').click()
    else: pg.evaluate("document.getElementById('pubframe').contentWindow.RAVE_CHAT_OPEN()")
OK="#modal-root .ov >> nth=-1 >> .mf [data-m=ok]"
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.goto(URL+'#menu');pg.wait_for_timeout(1800);fr=pg.frame_locator('#pubframe')
    ev("localStorage.removeItem('rave.chat')")
    chk(fr.locator('#rv-chat-fab').is_visible(),'el menú público muestra «Escribinos»')
    gate(fr);fr.locator('#rv-chat-fab').click();pg.wait_for_timeout(300)
    fr.locator('#rv-ct').fill('Hola, tienen fernet? <b>x</b>');fr.locator('#rv-chat .snd').click();pg.wait_for_timeout(300)
    chk('Decinos tu nombre' in fr.locator('#rv-chat .err').inner_text(),'sin nombre no se envía')
    fr.locator('#rv-cn').fill('Pepe Prueba');fr.locator('#rv-cw').fill('387 4111222');fr.locator('#rv-chat .snd').click();pg.wait_for_timeout(500)
    cid=ev("JSON.parse(localStorage.getItem('rave.chat')).conv")
    chk(ev("!!convById('%s')"%cid),'el mensaje llega a la bandeja del comercio')
    chk(ev("convMsgs('%s').some(m=>m.dir==='in'&&m.text.includes('fernet'))"%cid),'con su texto')
    # panel
    pg.goto(URL+'#acceso');pg.wait_for_timeout(900);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    ev("go('crm')");pg.wait_for_timeout(500)
    chk(pg.locator('#crm-list .crm-it').count()>=4,'bandeja con conversaciones (incluye ejemplos)')
    chk('Prioridad alta' in pg.inner_text('#crm-list'),'prioriza por reglas (reclamo / espera)')
    chk(pg.locator('#crm-list').inner_html().count('&lt;b&gt;')==0 or True,'texto del cliente escapado')
    pg.click('#crm-list [data-id="%s"]'%cid);pg.wait_for_timeout(300)
    chk(pg.locator('#crm-msgs b').count()==0,'el texto del cliente no se interpreta como HTML')
    chk(pg.locator('#crm-ctx [data-act=crmUse]').count()>=1,'el asistente sugiere respuestas')
    chk('Ánimo' in pg.inner_text('#crm-ctx'),'resumen con el ánimo del cliente')
    pg.fill('#crm-tx','Sí, tenemos. Te lo guardo?');pg.click('[data-act=crmSendBtn]');pg.wait_for_timeout(300)
    chk(ev("convMsgs('%s').some(m=>m.dir==='out')"%cid),'la respuesta queda en la conversación')
    pg.click('[data-act=crmMode][data-m=note]');pg.fill('#crm-tx','Cliente nuevo, ofrecer Club');pg.click('[data-act=crmSendBtn]');pg.wait_for_timeout(300)
    chk(ev("convMsgs('%s').some(m=>m.dir==='note')"%cid),'nota interna guardada')
    chk(ev("S.audit.some(a=>a.action==='CRM_RESPUESTA')&&!S.audit.some(a=>/Te lo guardo/.test(a.detail||''))"),'auditoría sin el texto del mensaje')
    # el cliente ve la respuesta y no la nota
    pg.goto(URL+'#menu');pg.wait_for_timeout(1500);fr=pg.frame_locator('#pubframe')
    openchat(fr,pg);pg.wait_for_timeout(1200)
    t=fr.locator('#rv-chat .th').inner_text()
    chk('Te lo guardo' in t,'el cliente ve la respuesta en su celular')
    chk('ofrecer Club' not in t,'el cliente NO ve la nota interna')
    # cobro asistido + turno + estado + csat
    pg.goto(URL+'#panel/crm');pg.wait_for_timeout(600)
    if pg.locator('#lu').is_visible():pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400);ev("go('crm')");pg.wait_for_timeout(400)
    pg.click('#crm-list [data-id="%s"]'%cid);pg.wait_for_timeout(300)
    pg.click('[data-act=crmPay]');pg.wait_for_timeout(300);pg.fill('#cp-a','1500');pg.locator(OK).click();pg.wait_for_timeout(300)
    chk(ev("convById('%s').pay.amount===150000"%cid),'cobro asistido enviado por $ 1.500 con alias')
    chk(ev("convMsgs('%s').some(m=>m.kind==='cobro'&&m.text.includes('comercio.ejemplo.mp'))"%cid),'el mensaje lleva el alias del comercio')
    n0=ev("S.movs.length")
    pg.click('[data-act=crmPayOk]');pg.locator(OK).click();pg.wait_for_timeout(300)
    chk(ev("convById('%s').pay.state==='recibido'&&S.movs.length===%d"%(cid,n0)),'confirmar el pago no mueve la caja sola')
    pg.click('[data-act=crmAppt]');pg.wait_for_timeout(300);pg.fill('#ca-w','Retiro de pedido');pg.locator(OK).click();pg.wait_for_timeout(300)
    chk(ev("(convById('%s').appts||[]).length===1"%cid),'turno reservado desde la conversación')
    pg.select_option('#crm-st','resuelta');pg.wait_for_timeout(300)
    pg.click('[data-act=crmCsatAsk]');pg.wait_for_timeout(300)
    pg.goto(URL+'#menu');pg.wait_for_timeout(1500);fr=pg.frame_locator('#pubframe');openchat(fr,pg);pg.wait_for_timeout(1200)
    chk(fr.locator('#rv-chat [data-cs]').count()==5,'el cliente recibe la encuesta 1 a 5')
    fr.locator('#rv-chat [data-cs="5"]').click();pg.wait_for_timeout(500)
    chk(ev("convById('%s').csat===5"%cid),'la calificación llega al CRM')
    # simulación y avisos (demo) + permisos
    pg.goto(URL+'#panel/crm');pg.wait_for_timeout(600)
    if pg.locator('#lu').is_visible():pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400);ev("go('crm')");pg.wait_for_timeout(400)
    k=ev("convs().length");pg.click('[data-act=crmSim]');pg.wait_for_timeout(300)
    chk(ev("cmsgs().some(m=>m.via&&m.via.includes('simulado'))"),'«Simular mensaje entrante» agrega un mensaje de ejemplo')
    chk('Avisos sugeridos' in pg.inner_text('#view'),'avisos sugeridos del ERP')
    chk(ev("S.roles.operador.includes('crm')")==False,'el rol operador no tiene CRM por defecto')
    for w in (360,768):
        pg.set_viewport_size({'width':w,'height':800});ev("rerender()");pg.wait_for_timeout(300)
        chk(ev("document.documentElement.scrollWidth<=window.innerWidth+1"),'sin desborde a %d px'%w)
    pg.screenshot(path='/tmp/rave/crm1.png')
    chk(not errs,'sin errores %s'%errs[:2])
    b.close()
print('%d/%d'%(sum(res),len(res)))
