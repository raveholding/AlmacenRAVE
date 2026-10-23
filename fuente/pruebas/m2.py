from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':390,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.clock.install(time=__import__('datetime').datetime(2026,10,23,18,0))
    pg.goto('file:///tmp/rave/index.html');pg.wait_for_timeout(2500)
    fr=pg.frame_locator('#pubframe')
    if fr.locator('#age-gate.open').count(): fr.locator('#ag-yes').click();pg.wait_for_timeout(300)
    s=fr.locator('#loy-sample')
    chk(s.count()==1 and 'Así se ve tu tarjeta' in s.inner_text(),'el menú muestra la tarjeta de EJEMPLO del Club')
    g=pg.evaluate("S.loyalty.goal");rw=pg.evaluate("S.loyalty.reward")
    chk(fr.locator('#loy-sample .loy-stamps i').count()==g,'con la meta real de sellos (%d)'%g)
    chk(rw in s.inner_text() or 'definir' in rw.lower(),'y el premio configurado (%s)'%rw)
    s.scroll_into_view_if_needed();pg.wait_for_timeout(300);s.screenshot(path='/tmp/sample.png')
    # con tarjeta propia, el ejemplo no se ve
    cid=pg.evaluate("(()=>{const c=S.customers.find(x=>x.card&&x.status!=='baja');return c?c.card.id:''})()")
    if cid:
        pg.evaluate("document.getElementById('pubframe').contentWindow.localStorage.setItem('rave.card','%s')"%cid)
        pg.evaluate("document.getElementById('pubframe').srcdoc=buildPubDoc()");pg.wait_for_timeout(2000)
        if fr.locator('#age-gate.open').count(): fr.locator('#ag-yes').click();pg.wait_for_timeout(300)
        chk(fr.locator('#loy-nocard').is_hidden(),'con tarjeta propia se ve su tarjeta real (el ejemplo se oculta)')
    print('errores',errs[:3]);chk(not errs,'sin errores')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
