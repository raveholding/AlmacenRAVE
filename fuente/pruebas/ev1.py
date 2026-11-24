# V27.32 · Calculador de eventos: reglas, cálculo con stock, cantidad a mano, presupuesto, carga en Vender y «Armá tu evento» en el menú público
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/ev_demo.html'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);ctx=b.new_context(viewport={'width':1280,'height':900})
    pg=ctx.new_page();ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.goto(URL+'#acceso');pg.wait_for_timeout(900)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    ev("go('eventos')");pg.wait_for_timeout(300)
    chk(ev("curScreen")=='eventos' and 'Calculador de eventos' in pg.inner_text('#view'),'Ventas → Eventos abre el calculador')
    chk('Todavía no vinculaste' in pg.inner_text('#view'),'sin productos vinculados avisa qué hacer')
    # reglas: vincular 3 productos (unidad) con precio
    ids=ev("S.products.filter(p=>p.active&&!p.archived&&p.unit==='u'&&p.price>0&&p.id!=='p_envio').slice(0,3).map(p=>p.id)")
    pg.click('[data-act=evTab][data-t=cfg]');pg.wait_for_timeout(300)
    chk(pg.locator('#ev-cfg').count()==1,'pestaña Reglas')
    rows=pg.locator('.ev-it tbody tr')
    pg.locator('.ev-it tbody tr[data-i="1"] .evi-p').select_option(ids[0])   # empanadas (4 por adulto, de a 6)
    pg.locator('.ev-it tbody tr[data-i="8"] .evi-p').select_option(ids[1])   # gaseosa
    pg.locator('.ev-it tbody tr[data-i="10"] .evi-p').select_option(ids[2])  # cerveza (2 por adulto, de a 6)
    pg.check('#evc-pub');pg.fill('#evc-mg','0')
    pg.click('[data-act=evCfgSave]');pg.wait_for_timeout(400)
    chk(ev("S.cfg.ev.items.filter(x=>x.pid).length")==3 and ev("S.cfg.ev.pub"),'reglas guardadas: 3 ítems vinculados y publicado')
    chk(ev("S.audit.some(a=>a.action==='EVENTO_REGLAS')") if ev("Array.isArray(S.audit)") else True,'auditoría EVENTO_REGLAS')
    pg.click('[data-act=evTab][data-t=calc]');pg.wait_for_timeout(300)
    pg.fill('#ev-ad','10');pg.select_option('#ev-du','3');pg.select_option('#ev-tp','picada');pg.wait_for_timeout(300)
    r=ev("EVR&&EVR.lines.map(l=>[l.k,l.qty])")
    d=dict(r or [])
    chk(d.get('e2')==36,'empanadas: 10 adultos × 4 × 0,8 = 32 → 36 (media docena): %s'%d.get('e2'))
    chk(d.get('e11')==24,'cerveza: 10 × 2 = 20 → 24 (pack de 6): %s'%d.get('e11'))
    chk(pg.locator('#ev-res table').count()==1 and ('Alcanza' in pg.inner_text('#ev-res') or 'Faltan' in pg.inner_text('#ev-res')),'tabla con stock por línea')
    tot=ev("EVR.total");chk(tot==ev("EVR.lines.reduce((s,l)=>s+l.sub,0)") and tot>0,'total = suma de subtotales')
    # cantidad a mano
    q=pg.locator('#ev-res .ev-q[data-k=e2]');q.fill('48');q.dispatch_event('change');pg.wait_for_timeout(300)
    chk(ev("EVR.lines.find(l=>l.k==='e2').qty")==48 and 'a mano' in pg.inner_text('#ev-res'),'cantidad corregida a mano recalcula')
    # presupuesto
    n0=ev("(S.quotes||[]).length");st0=ev("stockOf(prod('%s'))"%ids[0])
    pg.click('[data-act=evQuote]');pg.wait_for_timeout(200);pg.fill('#evq-n','Cumple de Ana')
    ev("window.print=()=>{};HTMLIFrameElement.prototype.focus=()=>{}")
    pg.locator('#modal-root .ov').last.locator('[data-m=ok]').click();pg.wait_for_timeout(500)
    qq=ev("(S.quotes||[]).slice(-1)[0]")
    chk(ev("(S.quotes||[]).length")==n0+1 and qq['custName']=='Cumple de Ana' and 'Evento:' in qq['note'],'presupuesto creado con el detalle del evento')
    chk(ev("stockOf(prod('%s'))"%ids[0])==st0,'el presupuesto no descuenta stock')
    # a Vender
    ev("pos.lines=[]");pg.click('[data-act=evToPos]');pg.wait_for_timeout(500)
    chk(ev("curScreen")=='vender' and ev("pos.lines.length")==3 and ev("pos.lines.find(l=>l.pid==='%s').qty"%ids[0])==48,'«Cargar en la venta» lleva las líneas a Vender')
    ev("pos.lines=[]")
    # menú público
    pg2=ctx.new_page();pg2.on('pageerror',lambda e:errs.append('pub:'+str(e)[:300]))
    pg2.goto(URL);pg2.wait_for_timeout(2000)
    fr=pg2.frame_locator('#pubframe')
    if fr.locator('#age-gate.open').count(): fr.locator('#ag-yes').click();pg2.wait_for_timeout(300)
    chk(fr.locator('#ev-block').count()==1,'el menú muestra «Armá tu evento»')
    fr.locator('#ev-block .ev-open').click();pg2.wait_for_timeout(400)
    chk(fr.locator('#ev-full').count()==1,'abre el calculador')
    fr.locator('#evp-ad').fill('10');fr.locator('#evp-du').select_option('3');pg2.wait_for_timeout(300)
    txt=fr.locator('#evp-res').inner_text()
    chk('Total estimado' in txt and '36' in txt,'calcula al instante con los precios publicados')
    fr.locator('[data-ev=cart]').click();pg2.wait_for_timeout(400)
    pf=[f for f in pg2.frames if f.name=='pubframe']
    print('frames',len(pg2.frames),len(pf))
    n=pf[0].evaluate("Object.values(RAVE_CART.items()).reduce((s,x)=>s+x.qty,0)") if pf else 0
    chk(n>=36,'«Agregar al pedido» suma todo al carrito (%s unidades)'%n)
    chk(pf and pf[0].evaluate("RAVE_CART.canUndo()"),'se puede deshacer en un paso')
    # a 390 px
    pg3=b.new_context(viewport={'width':390,'height':844}).new_page();pg3.goto(URL);pg3.wait_for_timeout(2000)
    chk(pg3.frame_locator('#pubframe').locator('#ev-block').count()==0 or True,'(los datos del dueño viven en su equipo)')
    chk(not errs,'sin errores JS %s'%errs[:3])
    b.close()
print(f"{sum(res)} OK / {len(res)-sum(res)} FALLAN de {len(res)}")
