# V26.48 · Las fichas de los 4 asistentes (R2AVE, M2ARGOTH, T2ULUZ, S2HAKIRA) se ven siempre, justo debajo del centro de operaciones vivo.
import sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/v3.html'
SHOT=sys.argv[2] if len(sys.argv)>2 else ''
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    for W in (1600,390):
        pg=b.new_page(viewport={'width':W,'height':900});ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
        pg.goto(URL+'#acceso');pg.wait_for_timeout(900);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
        ev("go('centro');CI.isOn()||A.ciToggle()");pg.wait_for_timeout(1500)
        core=pg.locator('#r2-core')
        chk(core.count()==1 and core.is_visible(),'%d px: fichas a la vista (no plegadas)'%W)
        nm=ev("[...document.querySelectorAll('#r2-core .r2-ph b')].map(x=>x.innerText)")
        chk(nm==['R2AVE','M2ARGOTH','T2ULUZ','S2HAKIRA'],'%d px: son los cuatro asistentes %s'%(W,nm))
        pos=ev("(()=>{const v=document.querySelector('.ci-root .vv'),c=document.getElementById('r2-core');if(!v||!c)return null;const a=v.getBoundingClientRect(),r=c.getBoundingClientRect();return[a.bottom,r.top,!!(v.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_FOLLOWING)]})()")
        chk(pos and pos[2] and 0<=pos[1]-pos[0]<=40,'%d px: justo debajo del centro de operaciones vivo %s'%(W,pos))
        chk(ev("[...document.querySelectorAll('.r2-ph b')].filter(x=>/NEXUS|VÉRTICE/.test(x.innerText)).every(x=>!x.closest('#r2-core'))"),'%d px: los especialistas van aparte (plegados)'%W)
        pg.locator('#r2-core [data-act=r2Asst][data-id=m2argoth]').click();pg.wait_for_timeout(400)
        chk('Te está respondiendo' in pg.locator('#r2-core').inner_text() and ev("CI.r2&&document.querySelector('#r2-core [data-id=m2argoth]').getAttribute('aria-pressed')")=='true','%d px: «Preguntarle a M2ARGOTH» lo elige para responder'%W)
        chk(ev("document.documentElement.scrollWidth<=window.innerWidth+1"),'%d px: sin desborde'%W)
        if SHOT and W==1600:
            ev("document.querySelector('.ci-root .vv').scrollIntoView({block:'start'})");pg.wait_for_timeout(500);pg.screenshot(path=SHOT)
        pg.close()
    chk(not errs,'sin errores %s'%errs[:2])
    b.close()
print('%d / %d'%(sum(res),len(res)))
