# V26.74 · CRM omnicanal: base de conocimiento 24/7 y derivación, horario laboral, ruteo por reglas y por carga, /atajos,
# @menciones, mejorar tono, resumir hilo, línea de tiempo y vinculación, analíticas de resolución y proyección,
# pestaña de automatización e integraciones, conexión automática (OAuth) en el Centro de canales, cliente apagado.
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL='file:///tmp/rave/index.html'
OK="#modal-root .ov >> nth=-1 >> .mf [data-m=ok]"
def login(pg,role,pin):
    pg.goto(URL+'#acceso');pg.wait_for_timeout(900);i=pg.evaluate("S.users.findIndex(u=>u.role==='%s')"%role);pg.select_option('#lu',index=i);pg.fill('#lp',pin);pg.click('[data-act=login]');pg.wait_for_timeout(600)
def nueva(ev,txt,name='Cliente Test'):
    ev("RAVE_API.chatReset()");ev("RAVE_API.chatSend(%r,%r,'')"%(txt,name));return ev("JSON.parse(localStorage.getItem('rave.chat')).conv")
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    login(pg,'admin','1234');ev("go('crm')");pg.wait_for_timeout(400)
    chk(ev("omniOn()") and ev("omniKb().length")>=2,'demo: base de conocimiento de ejemplo')
    q='¿aceptan transferencia o QR para pagar?'
    r=ev("omniKbFind(%r,1)[0]||null"%q)
    chk(r and 'pago' in r['t'].lower() and r['score']>=0.45,'la búsqueda local encuentra el texto correcto %s'%(r and r['score']))
    chk(not ev("omniKbFind('cuánto sale un auto usado',1).filter(x=>x.score>=0.45).length"),'una pregunta ajena no encuentra nada (no inventa)')
    faq=ev("!!crmBotMatch(%r)"%q)
    cid=nueva(ev,q);pg.wait_for_timeout(500)
    bot=ev("convMsgs('%s').filter(m=>m.kind==='bot').map(m=>m.text)"%cid)
    chk(faq or any('transferencia' in t.lower() for t in bot),'el asistente responde 24/7 con la base de conocimiento %s'%bot[:1])
    cid2=nueva(ev,'quiero hablar con una persona por favor');pg.wait_for_timeout(500)
    c2=ev("convById('%s')"%cid2)
    chk('derivado' in c2['tags'] and any('persona' in m['text'] for m in ev("convMsgs('%s')"%cid2) if m['kind']=='bot'),'pide una persona: deriva, avisa y no responde solo')
    chk(not any(m['kind']=='bot' and 'Aceptamos' in m['text'] for m in ev("convMsgs('%s')"%cid2)),'al derivar no usa la base de conocimiento')
    ev("S.cfg.crm.horario={on:true,dias:[],desde:'09:00',hasta:'21:00',msg:'Estamos cerrados, te respondemos mañana.'}")
    cid3=nueva(ev,'hola, ¿tienen hielo?');pg.wait_for_timeout(400);ev("RAVE_API.chatSend('¿y carbón?','Cliente Test','')");pg.wait_for_timeout(400)
    fh=[m for m in ev("convMsgs('%s')"%cid3) if m['kind']=='bot' and 'cerrados' in m['text']]
    chk(len(fh)==1,'fuera de horario: responde una sola vez por día')
    ev("S.cfg.crm.horario.on=false")
    # ruteo
    ev("crmSet({rules:[{id:'r1',chan:'web',kw:'factura',dept:'Cobranzas',asg:'Supervisor'}]})")
    cid4=nueva(ev,'necesito la factura de mi compra');pg.wait_for_timeout(400)
    c4=ev("convById('%s')"%cid4)
    chk(c4['dept']=='Cobranzas' and c4['asg']=='Supervisor','regla por canal y palabra clave → cola y agente')
    ev("crmSet({rules:[],route:'carga',rr:['ADMIN','Supervisor']})")
    n_adm=ev("omniOpenOf('ADMIN')");n_sup=ev("omniOpenOf('Supervisor')")
    cid5=nueva(ev,'consulta general sobre el local');pg.wait_for_timeout(400)
    esperado='ADMIN' if n_adm<=n_sup else 'Supervisor'
    chk(ev("convById('%s').asg"%cid5)==esperado,'por carga: va al agente con menos conversaciones abiertas (%s)'%esperado)
    ev("crmSet({route:'dept',rr:[]})")
    # atajos
    ev("crmSel='%s';crmTab='inbox';crmMode='msg';rerender()"%cid5);pg.wait_for_timeout(300)
    pg.click('#crm-tx');pg.keyboard.type('/sal');pg.wait_for_timeout(150)
    chk(pg.locator('#om-sc [data-act=omniSc]').count()>=1,'«/» muestra los atajos de respuestas rápidas')
    pg.keyboard.press('Tab');pg.wait_for_timeout(100)
    tx=pg.input_value('#crm-tx');chk(tx.startswith('¡Hola') and 'Cliente' in tx and '/sal' not in tx,'Tab completa el atajo con el nombre del cliente')
    # tono
    pg.fill('#crm-tx','NO TENEMOS STOCK xq se agoto');pg.click('[data-act=omniTone]');pg.wait_for_timeout(100)
    tx=pg.input_value('#crm-tx');chk(tx.startswith('¡Hola') and 'porque' in tx and 'NO TENEMOS' not in tx,'«Mejorar tono» corrige mayúsculas y abreviaturas y saluda')
    # menciones
    ev("crmMode='note';rerender()");pg.wait_for_timeout(200);pg.fill('#crm-tx','@Supervisor revisá este pedido grande');pg.click('[data-act=crmSendBtn]');pg.wait_for_timeout(200)
    nt=[m for m in ev("convMsgs('%s')"%cid5) if m['dir']=='note']
    chk(nt and nt[-1].get('ment')==['Supervisor'],'@mención guardada en la nota')
    pg.click('[data-act=omniSum]');pg.wait_for_timeout(200)
    chk(any('Resumen del hilo' in m['text'] for m in ev("convMsgs('%s')"%cid5) if m['dir']=='note'),'«Resumir hilo» deja el resumen como nota interna')
    # línea de tiempo y vinculación
    ev("(()=>{const c=S.customers.find(c=>c.status!=='baja');c.email='prueba.tl@ejemplo.com';const s=S.sales.find(x=>x.status==='ok');S.sales.push(Object.assign(JSON.parse(JSON.stringify(s)),{id:'tl-'+uid(),n:'TL-1',cust:c.id,ts:now()-3600e3}))})()");cu=ev("S.customers.find(c=>c.email==='prueba.tl@ejemplo.com')")
    ev("convById('%s').email=%r;convById('%s').cust='';crmSel='%s';crmMode='msg';rerender()"%(cid5,cu['email'],cid5,cid5));pg.wait_for_timeout(250)
    chk(pg.locator('#crm-ctx [data-act=crmLink][data-id="%s"]'%cu['id']).count()>=1 and '¿Es' in pg.inner_text('#crm-ctx'),'mismo correo que un cliente: sugiere vincular')
    ev("A.crmLink({dataset:{id:'%s'}})"%cu['id']);pg.wait_for_timeout(250)
    t=pg.inner_text('#crm-ctx');chk('Línea de tiempo' in t and 'Compra' in t,'ficha única: línea de tiempo con mensajes y compras')
    ev("save()");pg.wait_for_timeout(900)
    # supervisor ve su mención (misma pestaña: vuelve a entrar con su usuario)
    login(pg,'supervisor','1111');ev("go('crm')");pg.wait_for_timeout(300)
    chk(ev("omniMyMentions().length")>=1,'el mencionado tiene el aviso')
    chk(ev("!!uxBadges().menciones"),'… también en la campana')
    ev("crmSel=convs()[0].id;crmTab='inbox';rerender()");pg.wait_for_timeout(250)
    chk('Te mencionaron' in pg.inner_text('#crm-ctx'),'y lo ve en la conversación')
    pg.click('[data-act=omniMentOk]');pg.wait_for_timeout(150);chk(ev("omniMyMentions().length")==0,'«Marcar como vistas»')
    pg.close()
    # analíticas y automatización
    pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    login(pg,'admin','1234');ev("go('crm');crmTab='stats';rerender()");pg.wait_for_timeout(400)
    t=pg.inner_text('#crm-body');chk('Tiempo promedio de resolución' in t and 'Resueltas sólo por el asistente' in t and 'Demanda esperada' in t,'analíticas: ART, asistente vs personas y proyección de 7 días')
    pg.click('[data-act=crmTab][data-t=auto]');pg.wait_for_timeout(300)
    t=pg.inner_text('#crm-body');chk('Base de conocimiento' in t and 'Ruteo automático' in t and 'Inteligencia artificial' in t and 'API y webhooks' in t,'pestaña de automatización e integraciones')
    chk(pg.locator('#om-ia').is_disabled(),'sin clave de IA el interruptor está deshabilitado (todo con reglas gratis)')
    pg.fill('#om-kbq','¿hacen envíos a domicilio?');pg.click('[data-act=omniKbTry]');pg.wait_for_timeout(100)
    chk('Envíos' in pg.inner_text('#om-kbr'),'«Probar» muestra qué respondería')
    pg.select_option('#om-route','carga');pg.fill('#om-rr','');pg.click('[data-act=omniAutoSave]');pg.wait_for_timeout(100)
    chk(ev("crmCfg().route")!='carga','por carga sin agentes: no se guarda')
    pg.select_option('#om-rc','wa');pg.fill('#om-rk','mayorista');pg.select_option('#om-rd','Ventas');pg.click('[data-act=omniRuleAdd]');pg.wait_for_timeout(150)
    chk(ev("(crmCfg().rules||[]).some(r=>r.kw==='mayorista'&&r.dept==='Ventas')"),'agregar una regla de ruteo')
    n=ev("omniKb().length");pg.click('[data-act=omniKbNew]');pg.wait_for_timeout(200);pg.fill('#kb-t','Cambios y devoluciones');pg.fill('#kb-x','Aceptamos cambios dentro de los 7 días con el ticket de compra.');pg.locator(OK).click();pg.wait_for_timeout(200)
    chk(ev("omniKb().length")==n+1 and ev("omniKbFind('puedo hacer un cambio con el ticket',1)[0].t")=='Cambios y devoluciones','nuevo texto: el asistente ya lo usa')
    chk('nube del comercio' in pg.inner_text('#crm-body'),'API y webhooks avisan que necesitan la nube')
    ev("crmTab='canales';rerender()");pg.wait_for_timeout(300)
    t=pg.inner_text('#crm-body');chk('Conexión automática' in t and 'Gmail' in t and 'Outlook' in t and 'Meta' in t,'Centro de canales: conexión automática de Gmail, Outlook y Meta')
    chk(pg.locator('[data-act=omniOAGo]').count()==3 and all(pg.locator('[data-act=omniOAGo]').nth(i).is_disabled() for i in range(3)),'sin la función configurada los botones están apagados (no se rompe nada)')
    pg.set_viewport_size({'width':390,'height':800});ev("crmTab='auto';rerender()");pg.wait_for_timeout(300)
    chk(not ev("document.documentElement.scrollWidth>document.documentElement.clientWidth+1"),'automatización a 390 px sin desborde')
    pg.close()
    pg=b.new_page();ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append('cliente: '+str(e)[:200]))
    pg.goto('file:///tmp/rave/out_cliente.html');pg.wait_for_timeout(1200)
    chk(not ev("omniOn()") and ev("omniKb().length")==0 and ev("omniOAHTML()")=='','Almacén RAVE: apagado, sin textos de ejemplo')
    pg.close();b.close()
chk(not errs,'sin errores de página %s'%errs[:3])
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
