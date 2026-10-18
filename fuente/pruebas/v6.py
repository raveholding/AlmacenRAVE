# V26 · responsive de todas las pantallas del panel (320/360/768) tras ordenamiento, cajas y asistente
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    ev=pg.evaluate
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("(()=>{S.cfg.cashProfile='main';if(!S.registers.length){S.registers.push({id:uid(),name:'Caja principal',code:'P',kind:'main',active:true});}save();})()")
    ids=ev("Object.entries(SCREENS).filter(([k,s])=>(!s.perm||can(s.perm))&&(!s.show||s.show())).map(x=>x[0])")
    print('pantallas',len(ids))
    for w in (320,360,768):
        pg.set_viewport_size({'width':w,'height':760});bad=[]
        for i in ids:
            ev(f"location.hash='#panel/{i}'");pg.wait_for_timeout(120)
            sw=ev("document.documentElement.scrollWidth")
            if sw>w+1:bad.append((i,sw))
        chk(not bad,f'{w}px: ninguna pantalla desborda'+(' '+str(bad) if bad else ''))
    # asistente abierto en pantalla de ventas a 320
    pg.set_viewport_size({'width':320,'height':700});ev("location.hash='#panel/vender'");pg.wait_for_timeout(300)
    pg.click('#as-open');pg.wait_for_timeout(150)
    chk(ev("document.documentElement.scrollWidth")<=321,'320px: asistente abierto sobre Vender sin scroll horizontal')
    # objetivos táctiles de los encabezados ordenables
    ev("location.hash='#panel/inventario'");pg.wait_for_timeout(300)
    h=ev("Math.min(...[...document.querySelectorAll('.thsort')].map(e=>e.getBoundingClientRect().height))")
    chk(h>=43,f'encabezados ordenables ≥44 px de alto ({h})')
    chk(not errs,'sin errores JS'+(' '+str(errs[:3]) if errs else ''))
    print('RESULTADO',sum(res),'/',len(res))
