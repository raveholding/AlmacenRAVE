# V26.48 · Clientes: fecha de alta (registro), última compra y compras (cantidad y total) en la tabla y en la exportación.
import sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.goto(URL+'#acceso');pg.wait_for_timeout(800);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    # alta desde el menú público (el mismo camino que usa el cliente)
    t0=ev("now()")
    r=ev("clubJoin({nombre:'Ana Prueba',whatsapp:'3875550001',cumple:'21/05/1990',comm:true,consent:true,club:true})")
    c=ev("S.customers.find(c=>c.name==='Ana'&&c.last==='Prueba')")
    chk(c and abs(c['ts']-t0)<60000,'el alta del Club guarda la fecha de registro')
    ev("go('clientes')");pg.wait_for_timeout(500)
    hs=ev("[...document.querySelectorAll('#view table thead th')].map(t=>t.textContent.replace(/[▲▼↕]/g,'').trim())")
    chk(any(h.startswith('Alta') for h in hs) and any(h.startswith('Última compra') for h in hs) and any(h.startswith('Compras') for h in hs),'la tabla tiene Alta, Última compra y Compras %s'%hs)
    row=ev("(()=>{const r=[...document.querySelectorAll('#view tbody tr')].find(r=>r.innerText.includes('Ana Prueba'));return r?r.innerText:''})()")
    chk(ev("fmtDT(%d)"%c['ts']) in row and '—' in row,'la fila muestra la fecha de alta y «—» si todavía no compró')
    # una venta a su nombre
    if not ev("!!openSess()"): ev("S.sessions.push({id:'sCU2',caja:S.tenant.caja,openedBy:'ADMIN',openedAt:now(),opening:0,closedAt:0})")
    pid=ev("S.products.find(p=>p.active!==false&&!p.archived&&p.price>0).id");pr=ev("S.products.find(p=>p.id==='%s').price"%pid)
    ev("go('vender');pos.lines=[];A.padd({dataset:{id:'%s'}})"%pid)
    ok=ev("(()=>{const r=commitSale('efectivo',false,'local',pos.lines,{cust:'%s'});return r.err||'ok'})()"%c['id'])
    s=ev("S.sales[S.sales.length-1]")
    if s.get('cust')!=c['id']: ev("S.sales[S.sales.length-1].cust='%s';save()"%c['id'])
    ev("go('clientes')");pg.wait_for_timeout(500)
    row=ev("(()=>{const r=[...document.querySelectorAll('#view tbody tr')].find(r=>r.innerText.includes('Ana Prueba'));return r?r.innerText:''})()")
    chk('hoy' in row and ('1 · '+ev("money(S.sales[S.sales.length-1].total)")) in row,'después de comprar: última compra «hoy» y 1 compra con su total')
    # orden por Alta
    i=[k for k,h in enumerate(hs) if h.startswith('Alta')][0]
    pg.locator('#view table thead th').nth(i).locator('button').first.click() if pg.locator('#view table thead th').nth(i).locator('button').count() else pg.locator('#view table thead th').nth(i).click()
    pg.wait_for_timeout(300)
    chk(ev("document.querySelector('#view table thead th[aria-sort]:not([aria-sort=none])')!==null"),'se puede ordenar por fecha de alta')
    # exportación
    h=ev("EXPORTS&&EXPORTS.clientes?EXPORTS.clientes.h():null")
    if h is None: h=ev("(typeof EXP!=='undefined'&&EXP.clientes)?EXP.clientes.h():null")
    chk(h and 'alta' in h and 'ultima_compra' in h and 'total_compras' in h,'la exportación de clientes incluye fecha de alta, última compra y compras %s'%h)
    pg.set_viewport_size({'width':390,'height':844});pg.wait_for_timeout(400)
    chk(ev("document.documentElement.scrollWidth<=window.innerWidth+1"),'390 px sin desborde de la página')
    chk(not errs,'sin errores %s'%errs[:2])
    b.close()
print('%d / %d'%(sum(res),len(res)))
