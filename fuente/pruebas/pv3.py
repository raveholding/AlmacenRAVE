# V27.39 · Vender más visual: «Más vendidos» (auto + fijados), tarjetas con foto y precio, búsqueda y rubros fijos, barra del celular y ticket
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/pos3.html'
S='/tmp/claude-0/-home-claude/dbbe6811-2853-51a1-af8d-e983b77f35ea/scratchpad'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);ctx=b.new_context(viewport={'width':1366,'height':860})
    pg=ctx.new_page();ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.goto(URL+'#acceso');pg.wait_for_timeout(900);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    ev("go('vender')");pg.wait_for_timeout(500)
    chk(pg.locator('#pos-top').count()==1,'«Más vendidos» arriba de la grilla')
    n=ev("posTopIds().ids.length");chk(n>0,'se completan solos con las ventas de 30 días (%d)'%n)
    # fijar dos productos
    ids=ev("S.products.filter(p=>p.active&&!p.archived&&p.id!=='p_envio'&&stockOf(p)>0).slice(-2).map(p=>p.id)")
    pg.click('[data-act=posTopEdit]');pg.wait_for_timeout(300)
    for i in ids:
        nm=ev("pfull(prod('%s'))"%i);pg.fill('#ptp-q',nm[:12]);pg.wait_for_timeout(150);pg.locator('#ptp-l .ptp[value="%s"]'%i).check()
    pg.locator('#modal-root .ov').last.locator('[data-m=ok]').click();pg.wait_for_timeout(400)
    first=ev("[...document.querySelectorAll('#pos-top .pt-b')].slice(0,2).map(b=>b.dataset.id)")
    chk(first==ids,'los fijados aparecen primero con ★')
    pg.locator('#pos-top .pt-b').first.click();pg.wait_for_timeout(300)
    chk(ev("pos.lines.some(l=>l.pid==='%s')"%ids[0]),'tocar un «más vendido» lo suma al ticket')
    chk(ev("document.querySelectorAll('#pgrid .p3-pr').length")>0,'tarjetas con precio grande')
    chk(ev("document.querySelectorAll('#pgrid .p3-img').length")==ev("S.products.filter(p=>p.active&&!p.archived&&p.img).length"),'cada tarjeta con foto muestra su foto')
    pg.fill('#psearch','a');pg.wait_for_timeout(250)
    chk(pg.locator('#pos-top').count()==0,'al buscar se ocultan los más vendidos')
    pg.fill('#psearch','');pg.dispatch_event('#psearch','input');pg.wait_for_timeout(250)
    st=ev("getComputedStyle(document.querySelector('.pos>section:first-child>.card:first-child')).position")
    chk(st=='sticky','búsqueda y rubros fijos al bajar')
    chk(ev("getComputedStyle(document.querySelector('#pcart')).position")=='sticky','en la PC el ticket queda fijo a la derecha')
    pg.screenshot(path=S+'/pv3_pc.png')
    # celular
    pg.set_viewport_size({'width':390,'height':844});pg.wait_for_timeout(400)
    chk(pg.is_visible('#pos-mbar') and 'Ver ticket' in pg.inner_text('#pos-mbar'),'celular: barra inferior con total y «Ver ticket y cobrar»')
    cols=ev("getComputedStyle(document.querySelector('#pgrid')).gridTemplateColumns.split(' ').length")
    chk(cols in (2,3),'celular: grilla de %d columnas'%cols)
    chk(not ev("document.documentElement.scrollWidth>document.documentElement.clientWidth+1"),'390 px sin desborde')
    pg.screenshot(path=S+'/pv3_m.png')
    pg.click('#pos-mbar button');pg.wait_for_timeout(700)
    chk(ev("(()=>{const r=document.querySelector('#pcart').getBoundingClientRect();return r.top<innerHeight&&r.bottom>0})()"),'«Ver ticket» lleva al ticket')
    ev("go('inventario')");pg.wait_for_timeout(300)
    chk(not pg.is_visible('#pos-mbar'),'la barra no aparece fuera de Vender')
    chk(not errs,'sin errores JS %s'%errs[:3])
    b.close()
print(f"{sum(res)} OK / {len(res)-sum(res)} FALLAN de {len(res)}")
