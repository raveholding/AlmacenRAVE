# V26.46 · raveV3: demo genérica de un solo dueño («Mi Comercio») con el Centro Inteligente y los asistentes SVB R2AVE, mapa básico automático; sin datos ni personalización de Almacén RAVE (sin editor del local, sin plano de ejemplo SVB, sin personal con fotos).
import re,sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/v3.html'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.goto(URL);pg.wait_for_timeout(1500)
    chk(ev("RAVE_BUILD.profile")=='v3' and ev("RAVE_BUILD.db")=='rave-v3-demo-v2','perfil v3 con base local nueva')
    pg.wait_for_timeout(1500);vis=' '.join(f.inner_text('body') for f in pg.frames if f.url!='about:blank' or True)
    chk('Corporación Demo' in vis and not re.search(r'Urquiza|4574892|457 4892|Licorer[ií]a RAVE|Almac[eé]n y Licorer',vis),'el menú que se ve no tiene nombre, dirección ni WhatsApp de Almacén RAVE')
    pg.goto(URL+'#acceso');pg.wait_for_timeout(800)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    chk(ev("S.cfg.biz")=='owner','un solo dueño (sin socios ni rubros por persona)')
    chk(all(r['id'].startswith('e-') for r in ev("S.rubros.filter(r=>r.kind==='rubro')")),'categorías genéricas de ejemplo (no los rubros de Almacén RAVE)')
    chk(ev("S.products.every(x=>x.id.startsWith('e-')||x.demo)"),'catálogo genérico de ejemplo')
    chk(ev("typeof CI!=='undefined'&&!!SCREENS.centro"),'tiene el Centro Inteligente')
    ev("go('centro')");pg.wait_for_timeout(500);ev("A.ciToggle()");pg.wait_for_timeout(1500)
    ev("document.querySelectorAll('.ci-root details').forEach(d=>d.open=true)");pg.wait_for_timeout(300)
    nm=ev("[...document.querySelectorAll('.r2-card .r2-ph b')].map(x=>x.innerText)")
    chk(all(n in nm for n in ['R2AVE','M2ARGOTH','T2ULUZ','S2HAKIRA']),'están los asistentes %s'%nm[:4])
    chk(pg.locator('.ci-root .vv canvas').count()>=1,'centro de operaciones vivo')
    chk(pg.locator('[data-act=ciEdit]').count()==0,'sin «Editar local»')
    chk(pg.locator('[data-act=r2Plan]').count()==0,'sin «Cargar el plano de ejemplo SVB»')
    ev("A.ciEdit&&A.ciEdit()");pg.wait_for_timeout(300)
    chk(not ev("CI.st.edit"),'el editor no se abre ni llamándolo directo')
    chk(ev("CI.mapOf().auto")==True,'mapa básico automático')
    ev("S.cfg.ci.map={W:20,D:20,items:[{id:'x',t:'gond',x:1,y:1,w:2,d:1}]};S.cfg.ci.staff={};save();CI.draw()");pg.wait_for_timeout(300)
    chk(ev("CI.mapOf().auto")==True,'aunque haya un plano guardado, se usa el básico')
    k=ev("CI.team().length?CI.team()[0].k:null")
    if k:
        ev("CI.personModal('%s')"%k);pg.wait_for_timeout(400)
        chk(pg.locator('#ci-ph').count()==0 and pg.locator('#ci-al').count()==0,'la ficha de la persona no tiene foto, nombre visible ni avatar para editar')
        ev("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    ev("A.ciChip&&A.ciChip({dataset:{id:'hoy'}})");pg.wait_for_timeout(400)
    t=pg.inner_text('#view')
    chk(not re.search(r'Almac[eé]n (y Licorer[ií]a )?RAVE|Urquiza|Licorer[ií]a',t),'el Centro no muestra textos de Almacén RAVE')
    pg.set_viewport_size({'width':390,'height':844});pg.wait_for_timeout(500)
    chk(ev("document.documentElement.scrollWidth<=window.innerWidth+1"),'390 px sin desborde')
    chk(not errs,'sin errores %s'%errs[:2])
    b.close()
print('%d / %d'%(sum(res),len(res)))
