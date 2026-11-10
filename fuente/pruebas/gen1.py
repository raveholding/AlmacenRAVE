# V26.63 · raveV2 genérico y raveV3 empresarial: recorre todas las pantallas y el menú, y busca palabras de rubros chicos o bebidas.
import re,sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
BAD=r'\b(bebida|bebidas|vino|vinos|cerveza|cervezas|fernet|almac[eé]n|kiosco|licorer[ií]a|golosina|golosinas|cigarr\w*|tabaco|alcohol\w*|whisky|gaseosa|gaseosas|soda|aperitivo|\+18)\b'
V=sys.argv[1:] or ['solo','v3']
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    for v in V:
        URL='file:///tmp/rave/%s.html'%v
        pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate
        pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
        pg.goto(URL);pg.wait_for_timeout(2500)
        vis=' '.join(f.inner_text('body') for f in pg.frames)
        nm='Corporación Demo' if v=='v3' else 'Mi Negocio'
        chk(nm in vis,'%s: el menú público muestra «%s»'%(v,nm))
        h=re.findall(BAD,vis,re.I);chk(not h,'%s: menú sin rubros chicos/bebidas %s'%(v,sorted(set(x.lower() for x in h))[:8]))
        pg.goto(URL+'#acceso');pg.wait_for_timeout(800)
        pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(800)
        ids=ev("Object.keys(SCREENS).filter(k=>SCREENS[k].show?SCREENS[k].show():true)")
        hits={}
        for i in ids:
            ev("go('%s')"%i);pg.wait_for_timeout(250)
            t=pg.inner_text('#view');f=re.findall(BAD,t,re.I)
            if f:hits[i]=sorted(set(x.lower() for x in f))
        chk(not hits,'%s: %d pantallas sin rubros chicos/bebidas %s'%(v,len(ids),hits))
        ev("go('caja')");pg.wait_for_timeout(300)
        chk(pg.locator('.ux-hero').count()==1 and pg.locator('.ux-steps li').count()==4,'%s: Caja con tablero del turno y 4 pasos'%v)
        chk(pg.locator('.ux-desc').count()==1,'%s: Caja con la línea de ayuda'%v)
        pg.close()
    b.close()
chk(not errs,'sin errores de página %s'%errs[:3])
print('RESULTADO',sum(res),'/',len(res))
