# V26.43 · Demo raveV2 «Mi Comercio» (un solo dueño): sin socios, sin rubros por persona, sin Centro Inteligente ni
# asistentes SVB R2AVE, sin nada de Almacén RAVE; se vende, se cobra, se hace el arqueo y se cierra la caja de un solo dueño.
import re
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
F='/tmp/rave/solo.html'
RAVE=re.compile(r'\bRAVE\b|Urquiza|4574892|Licorer[ií]a|rave-demo-2026|RAVE-Clientes|Combos y promos|Tabaco y accesorios|Bebidas y hielo')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1366,'height':900});pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append('C:'+m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    pg.goto('file://'+F+'#acceso');pg.wait_for_timeout(1000)
    chk(not RAVE.search(pg.inner_text('body')),'el ingreso no muestra nada de Almacén RAVE')
    chk('Vincular Business' in pg.inner_text('body') or 'VINCULAR' in pg.inner_text('body').upper(),'los créditos de Vincular Business se mantienen')
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(600)
    chk(ev("ownerMode()") and ev("S.cfg.bizLocked===1"),'un solo dueño (tipo de negocio fijo)')
    chk(ev("S.tenant.name")=='Mi Negocio','marca genérica «Mi Negocio»')
    chk(ev("S.rubros.filter(r=>r.kind==='rubro').every(r=>!r.owner&&!r.reparte)"),'categorías sin responsable ni reparto (no hay socios)')
    chk(ev("!SCREENS.centro") and ev("typeof CI==='undefined'"),'no lleva el Centro Inteligente ni los asistentes SVB R2AVE')
    chk(ev("!(S.cfg.wholesale&&S.cfg.wholesale.on)"),'venta minorista (sin canal mayorista)')
    hits={}
    for sc in ev("NAV.map(n=>n[0])"):
        ev("go('%s')"%sc);pg.wait_for_timeout(200);t=pg.inner_text('#view')
        m=RAVE.search(t)
        if m: hits[sc]=t[max(0,m.start()-30):m.end()+20]
    chk(not hits,'ninguna pantalla muestra datos de Almacén RAVE %s'%hits)
    ev("go('arqueo')");pg.wait_for_timeout(300);v=pg.inner_text('#view')
    chk('Sueldo' not in v and 'reparte' not in v.lower() and 'Ganancia propia' not in v,'el arqueo no tiene sueldo a medias, reparto ni ganancia por socio')
    # vender y cerrar caja
    if not ev("!!openSess()"): ev("A.cajaOpen?0:0")
    ev("go('caja')");pg.wait_for_timeout(300)
    if not ev("!!openSess()"):
        ev("S.sessions.push({id:'sv1',caja:S.tenant.caja,openedBy:'ADMIN',openedAt:now(),opening:500000,closedAt:0});save()")
    ev("go('vender');pos.lines=[];A.padd({dataset:{id:'s-yerba'}});A.padd({dataset:{id:'s-gas'}})")
    st0=ev("S.products.find(p=>p.id==='s-yerba').stock")
    r=ev("(()=>{const r=commitSale('efectivo',false,'local',pos.lines,{});return r.err||{t:r.sale.total}})()")
    chk(isinstance(r,dict) and r['t']==420000+290000,'se vende: yerba + gaseosa = $ 7.100 (%s)'%r)
    chk(ev("S.products.find(p=>p.id==='s-yerba').stock")==st0-1,'descuenta stock')
    m=ev("(()=>{const rb=S.rubros.find(r=>r.id==='sys-gen');return !!rb})()")
    chk(m,'el dinero va a la caja del negocio (concepto interno, sin rubros por persona)')
    ev("go('arqueo')");pg.wait_for_timeout(300)
    chk('7.100' in pg.inner_text('#view'),'el arqueo muestra la venta')
    # menú público
    pg.goto('file://'+F+'#menu');pg.wait_for_timeout(1500)
    f=[x for x in pg.frames if x!=pg.main_frame][0]
    try: f.click('#ag-yes',timeout=1500)
    except Exception: pass
    t=f.inner_text('body')
    chk(not RAVE.search(t) and 'MI NEGOCIO' in t.upper(),'el menú público es de «Mi Negocio», sin nada de Almacén RAVE')
    chk(f.locator('[data-id="s-yerba"]').count()>=1,'el menú muestra el catálogo genérico')
    pg.set_viewport_size({'width':360,'height':780});pg.wait_for_timeout(300)
    chk(ev("document.documentElement.scrollWidth")<=362,'menú a 360 px sin desborde')
    b.close()
    s=open(F,encoding='utf8').read()
    chk('M2ARGOTH' not in s and 'ciToggle' not in s and 'vvFollow' not in s,'el archivo publicado no contiene el Centro ni los asistentes')
print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
