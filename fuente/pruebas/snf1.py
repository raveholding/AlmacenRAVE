# V26.67 · Sello con el celular del cliente: chip NFC / QR del mostrador (demo y nube simulada)
# Compilar antes: build.py demo /tmp/rave/index.html  y  SUPABASE_URL=https://pruebarave.supabase.co SUPABASE_KEY=sb_publishable_prueba RAVE_SLUG=x build.py cliente /tmp/rave/cli.html
import json
from playwright.sync_api import sync_playwright
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    # ---------- DEMO ----------
    pg=b.new_page(viewport={'width':1300,'height':900});ev=pg.evaluate;errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(1200)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(700)
    ev("go('config')");pg.wait_for_timeout(500);pg.click('#ux-secnav [data-sec="g:Clientes y NFC"]');pg.wait_for_timeout(300)
    chk(pg.locator('#snf-card').is_visible(),'Configuración → Clientes y NFC tiene «Sello con el celular del cliente»')
    pg.click('#snf-card [data-act=snfAdd]');pg.wait_for_timeout(200);pg.click('.ov [data-m=ok]');pg.wait_for_timeout(500)
    tok=ev("snfCfg().puntos[0]&&snfCfg().puntos[0].token")
    chk(bool(tok) and pg.locator('#snf-card code.snf-link').count()==1,'crea el punto y muestra el enlace para el chip')
    chk('#sello='+tok in pg.locator('#snf-card code.snf-link').inner_text(),'el enlace es …#sello=<punto>')
    pg.click('#snf-card [data-act=snfPoster]');pg.wait_for_timeout(300)
    chk(pg.locator('.ov .snf-poster svg').count()==1,'el cartel trae el QR del mismo enlace');pg.keyboard.press('Escape')
    cid=ev("S.customers.find(c=>c.status!=='baja'&&c.secret&&!(c.consent&&c.consent.club===false)).id")
    ev(f"S.loyalty.ledger=S.loyalty.ledger.filter(e=>!(e.cust==='{cid}'&&now()-e.ts<864e5));save()")
    n0=ev(f"stampsOf('{cid}')")
    # celular sin tarjeta
    ev("LS.del('rave.card');LS.del('rave.cardsec')");ev("A.logout&&A.logout()");pg.wait_for_timeout(300)
    pg.goto(f'file:///tmp/rave/index.html#sello={tok}');pg.wait_for_timeout(1200)
    chk(pg.locator('text=Todavía no tenés tu tarjeta del Club').count()==1,'sin tarjeta en el celular: invita a sumarse o pedirlo al cajero')
    pg.keyboard.press('Escape')
    ev(f"LS.set('rave.card','{cid}')")
    pg.goto('file:///tmp/rave/index.html#menu');pg.goto(f'file:///tmp/rave/index.html#sello={tok}');pg.wait_for_timeout(1200)
    chk(pg.locator('text=¡Sello sumado!').count()==1 and ev(f"stampsOf('{cid}')")==n0+1,'con la tarjeta en el celular, acercarlo al chip suma el sello (demo)')
    chk(ev("location.hash")=='#menu','la dirección queda en el menú (no se repite al recargar)')
    pg.keyboard.press('Escape');pg.goto(f'file:///tmp/rave/index.html#sello={tok}');pg.wait_for_timeout(1000)
    chk(ev(f"stampsOf('{cid}')")==n0+1 and pg.locator('text=24 h').count()>=1,'un segundo toque el mismo día no suma (límite 24 h)')
    chk(not errs,'demo sin errores JS '+str(errs[:2]))
    # ---------- NUBE simulada: celular del cliente ----------
    st={'pedido':None,'resuelto':[],'estado':'nuevo','detalle':''}
    c=b.new_context(viewport={'width':390,'height':844});ph=c.new_page();evp=ph.evaluate;errs2=[];ph.on('pageerror',lambda e:errs2.append(str(e)[:300]))
    keys={}
    def h(route):
        u=route.request.url;J=lambda o,s=200:route.fulfill(status=s,content_type='application/json',body=json.dumps(o))
        if '/rpc/menu_publico' in u and 'pub' in keys:return J({'version':1,'contenido':{'site':{},'catalog':[],'loyalty':{'goal':8,'reward':'x'},'clubkey':keys['pub']}})
        if '/rpc/club_pedir_sello' in u:st['pedido']=json.loads(route.request.post_data);return J({'ok':True})
        if '/rpc/club_sello_estado' in u:return J({'ok':True,'estado':st['estado'],'detalle':st['detalle']})
        if '/rpc/club_estado' in u:return J({'ok':True,'socio':True,'num':'7','sellos':3,'saldo':0})
        return J([])
    c.route('https://pruebarave.supabase.co/**',h)
    ph.goto('file:///tmp/rave/cli.html#menu');ph.wait_for_timeout(1200)
    kp=evp("crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']).then(async k=>({pub:await crypto.subtle.exportKey('jwk',k.publicKey),priv:await crypto.subtle.exportKey('jwk',k.privateKey)}))")
    keys['pub']=kp['pub']
    evp("LS.set('rave.card','CARDidCLIENTE01');LS.set('rave.cardsec','SECRETOdeTARJETA0123456789')")
    TOK='pPUNTOdeSELLO1234567'
    ph.goto('file:///tmp/rave/cli.html#sello='+TOK);ph.wait_for_timeout(3500)
    chk(st['pedido'] and st['pedido']['p_punto']==TOK and 'ct' in st['pedido']['p_cifrado'],'nube: el celular manda el pedido cifrado al punto')
    chk(ph.locator('text=Esperando que el negocio lo confirme').count()==1,'nube: el cliente ve «esperando confirmación»')
    # ---------- NUBE simulada: mostrador ----------
    m=c.new_page();evm=m.evaluate;errs3=[];m.on('pageerror',lambda e:errs3.append(str(e)[:300]))
    def hm(route):
        u=route.request.url;J=lambda o,s=200:route.fulfill(status=s,content_type='application/json',body=json.dumps(o))
        if '/rest/v1/sello_pedidos' in u:return J([] if st['estado']!='nuevo' else [{'id':11,'cifrado':st['pedido']['p_cifrado'],'creado':'2099-01-01T00:00:00Z','estado':'nuevo'}])
        if '/rpc/sello_resolver' in u:
            b2=json.loads(route.request.post_data);st['resuelto'].append(b2)
            if b2['p_estado']!='espera':st['estado']=b2['p_estado'];st['detalle']=b2['p_detalle']
            return J({'ok':True})
        return J([])
    m.route('https://pruebarave.supabase.co/**',hm)
    m.goto('file:///tmp/rave/cli.html#acceso');m.wait_for_timeout(1000)
    evm("Date.parse=(o=>s=>s==='2099-01-01T00:00:00Z'?Date.now():o(s))(Date.parse)")
    evm("cl.ready=true;cl.online=true;cl.rol='mostrador';cl.comercio={id:'c1',nombre:'X',slug:'x'};cl.ses={access:'t',refresh:'r',exp:Date.now()+3e6};cl.clubPriv={jwk:%s};user={id:'u1',name:'Caja',role:'mostrador'};S.customers.push({id:'CARDidCLIENTE01',name:'Juana',last:'Pérez',secret:'SECRETOdeTARJETA0123456789',num:7,status:'activo',consent:{club:true}});snfCfg().mode='aprobar';snfCfg().puntos=[{token:'%s',nombre:'Mostrador',activo:true}];location.hash='#panel/inicio'"%(json.dumps(kp['priv']),TOK))
    m.wait_for_timeout(800);evm("selloImport()");m.wait_for_timeout(1500)
    chk(m.locator('#snf-q .snf-it').count()==1 and 'Juana' in m.locator('#snf-q').inner_text(),'mostrador: aparece «Juana Pérez pide su sello · Aprobar / Rechazar»')
    chk(any(x['p_estado']=='espera' for x in st['resuelto']),'mostrador: marca el pedido «en espera» para el celular')
    s0=evm("stampsOf('CARDidCLIENTE01')")
    m.click('#snf-q [data-act=snfOk]');m.wait_for_timeout(800)
    chk(evm("stampsOf('CARDidCLIENTE01')")==s0+1,'mostrador: Aprobar suma el sello al cliente')
    chk(st['estado']=='aprobado' and 'Tenés' in st['detalle'],'mostrador: avisa al celular «aprobado» con cuántos sellos tiene')
    ph.wait_for_timeout(3500)
    chk(ph.locator('text=¡Sello sumado!').count()==1,'celular: muestra «¡Sello sumado!»')
    # código reutilizado (pedido repetido) se rechaza
    st['estado']='nuevo';st['resuelto']=[];evm("selloImport()");m.wait_for_timeout(1500)
    chk(any(x['p_estado']=='rechazado' for x in st['resuelto']),'el mismo pedido repetido se rechaza (un solo uso / 24 h)')
    chk(not errs2 and not errs3,'nube sin errores JS '+str((errs2+errs3)[:2]))
print('RESULTADO',sum(res),'/',len(res))
