# V26.66 · selector de tema Claro / Oscuro / Sistema (equipo en claro y en oscuro)
from playwright.sync_api import sync_playwright
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    for scheme in ['light','dark']:
        ctx=b.new_context(viewport={'width':1366,'height':860},color_scheme=scheme);pg=ctx.new_page();ev=pg.evaluate
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
        pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(1200)
        chk(pg.locator('#login .th-seg').count()==1,f'[{scheme}] selector de tema en el ingreso')
        pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(800)
        for t,exp in [('light','light'),('dark','dark'),('auto',scheme),('dark','dark'),('light','light')]:
            pg.locator(f'#top [data-act=themeSet][data-t={t}]').click();pg.wait_for_timeout(250)
            chk(ev("document.documentElement.dataset.theme")==exp and pg.locator(f'#top [data-t={t}]').get_attribute('aria-pressed')=='true',f'[{scheme}] tocar {t} → {exp}')
        ev("go('config')");pg.wait_for_timeout(600);pg.click('#ux-secnav [data-sec="g:Equipo y seguridad"]');pg.wait_for_timeout(300)
        chk(pg.locator('#theme-card .th-seg').count()==1,f'[{scheme}] Configuración tiene Apariencia')
        pg.locator('#theme-card [data-t=dark]').click();pg.wait_for_timeout(250)
        chk(pg.locator('#top [data-t=dark]').get_attribute('aria-pressed')=='true','los dos selectores quedan sincronizados')
        pg.screenshot(path=f'/home/claude/t/cfg_{scheme}.png')
        chk(not errs,'sin errores '+str(errs[:2]))
        ctx.close()
print('RESULTADO',sum(res),'/',len(res))
