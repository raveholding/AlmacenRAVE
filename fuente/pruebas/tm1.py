# V26.50 · Modo claro y oscuro: ningún texto con contraste insuficiente (WCAG AA) en todas las pantallas y en los estados
# del cobro (vuelto, recargo/descuento, Fiado/CC, mixto), cobro de deuda, alta de artículo, corte X, ficha del cliente y periféricos.
# Uso: python3 tm1.py [archivo.html]   (por defecto /tmp/rave/index.html; correrlo también con kini, solo y v3)
import sys,collections
from playwright.sync_api import sync_playwright
F=(sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html').replace('file://','')
JS=open(__file__.rsplit('/',1)[0]+'/contraste.js' if '/' in __file__ else 'contraste.js',encoding='utf8').read()
res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
def report(out,titulo):
    for th in ['dark','light']:
        L=[(k[1],x) for k,v in out.items() if k[0]==th for x in v]
        chk(not L,'%s · modo %s: sin textos ilegibles%s'%(titulo,'oscuro' if th=='dark' else 'claro',(' → '+'; '.join('%s «%s» %s'%(s,x['t'][:30],x['r']) for s,x in L[:4])) if L else ''))
out=collections.defaultdict(list)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1333,'height':900});ev=pg.evaluate
    pg.goto('file://'+F+'#acceso');pg.wait_for_timeout(800)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count(): pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    ids=ev("Object.keys(SCREENS).filter(k=>!SCREENS[k].perm||can(SCREENS[k].perm))")
    for th in ['dark','light']:
        ev(f"localStorage.setItem('rave.theme','{th}');themeApply()")
        for sid in ids:
            ev(f"location.hash='#panel/{sid}'");pg.wait_for_timeout(350)
            if sid=='vender':
                ev("(()=>{const L=S.products.filter(p=>p.active&&p.price>0).slice(0,3);L.forEach(p=>A.padd({dataset:{id:p.id}}));pos.sel=0;posCart();})()");pg.wait_for_timeout(250)
            r=ev(JS)
            for x in (r or []): out[(th,sid)].append(x)
            if sid=='vender':
                ev("A.cobrar()");pg.wait_for_timeout(400)
                for x in (ev(JS) or []): out[(th,'vender:cobro')].append(x)
                ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    b.close()
report(out,'pantallas')
out=collections.defaultdict(list)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1333,'height':900});ev=pg.evaluate
    pg.goto('file://'+F+'#acceso');pg.wait_for_timeout(800)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count(): pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    clr="document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())"
    def run(name):
        for x in (ev(JS) or []): out[(th,name)].append(x)
    for th in ['dark','light']:
        ev(f"localStorage.setItem('rave.theme','{th}');themeApply()")
        ev("location.hash='#panel/vender'");pg.wait_for_timeout(400)
        ev("(()=>{pos.lines=[];const L=S.products.filter(p=>p.active&&p.price>0).slice(0,2);L.forEach(p=>A.padd({dataset:{id:p.id}}));pos.method='efectivo';pos.mix=false;posCart();})()")
        ev("A.cobrar()");pg.wait_for_timeout(300);pg.fill('#rcv','999999');pg.wait_for_timeout(200);run('cobro con vuelto')
        pg.fill('#rcv','1');pg.wait_for_timeout(150);run('cobro efectivo insuficiente');ev(clr)
        ev("S.payadj={on:true,stack:false,saved:true,rules:{efectivo:{sign:-1,kind:'pct',v:1000,ver:1},credito:{sign:1,kind:'pct',v:1000,ver:1}}};posCart()");pg.wait_for_timeout(200);run('carrito con descuento');
        ev("A.cobrar()");pg.wait_for_timeout(300);run('cobro con descuento');ev("pos.method='credito';cobroRender()");pg.wait_for_timeout(200);run('cobro con recargo');ev(clr)
        ev("(()=>{const c=S.customers.find(x=>x.status!=='baja');c.limit=1e9;pos.cust=c.id;pos.method='fiado';pos.mix=false;A.cobrar()})()");pg.wait_for_timeout(300);run('cobro fiado/cc');
        pg.click('[data-act=cbck][data-k=fiado]');pg.wait_for_timeout(200);run('fiado elegido');ev(clr)
        ev("pos.method='efectivo';pos.mix=true;pos.pays=[{m:'efectivo',a:'1000',r:'5000'},{m:'fiado',a:'99999',r:''}];A.cobrar()");pg.wait_for_timeout(300);run('cobro mixto');ev(clr+";pos.mix=false;pos.pays=[];S.payadj.on=false")
        ev("A.cuPay({dataset:{id:pos.cust}})");pg.wait_for_timeout(300);run('cobro de deuda');ev(clr)
        b0=pg.locator('[data-act=pqNew],[data-act=pqAdd]').count()
        ev("location.hash='#panel/inventario'");pg.wait_for_timeout(400)
        btn=pg.locator('#view button:has-text(\"Nuevo\"), #view button:has-text(\"Agregar\"), #view button:has-text(\"+ Artículo\")').first
        if btn.count(): btn.click();pg.wait_for_timeout(400);run('alta de artículo');ev(clr)
        ev("location.hash='#panel/arqueo'");pg.wait_for_timeout(400);run('arqueo')
        if pg.locator('[data-act=corteX]').count(): pg.click('[data-act=corteX]');pg.wait_for_timeout(300);run('corte X');ev(clr)
        ev("location.hash='#panel/clientes'");pg.wait_for_timeout(400)
        cb=pg.locator('#view [data-act=cuEdit], #view [data-act=cuView], #view [data-act=custOpen]').first
        if cb.count(): cb.click();pg.wait_for_timeout(400);run('ficha del cliente');ev(clr)
        ev("location.hash='#panel/dispositivos'");pg.wait_for_timeout(400);run('periféricos')
        ev("location.hash='#panel/config'");pg.wait_for_timeout(400);ev("document.getElementById('pa-on')&&document.getElementById('pa-cfg').scrollIntoView()");run('configuración')
    b.close()
report(out,'ventanas y estados')
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
