import subprocess,json,time
from playwright.sync_api import sync_playwright
BASE='https://localhost:3443'
errs=[]
def sql(q):
    return subprocess.run(['curl','-sk','--noproxy','*',BASE+'/__rig/sql','--data-binary',q],capture_output=True,text=True).stdout.strip()
def rig(p):
    subprocess.run(['curl','-sk','--noproxy','*',BASE+p],capture_output=True)
def newpage(b,name,w=1100):
    ctx=b.new_context(ignore_https_errors=True,viewport={'width':w,'height':800})
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(name+' PAGEERR '+str(e)[:300]))
    pg.on('console',lambda m:errs.append(name+' CONSOLE '+m.type+' '+m.text[:300]) if m.type in('error',) else None)
    return ctx,pg
def launch(p):
    return p.chromium.launch(args=['--no-proxy-server'])
def create_commerce(pg,email='dueno@almacen.test',pw='Clave-Muy-Segura-1',code='INVITA-RAVE-2026',nombre='Almacén RAVE'):
    sql("select public.rave_invitar_comercio('%s','%s','%s')"%(email,nombre,code))
    pg.goto(BASE+'/cliente.html#acceso');pg.wait_for_selector('#login [data-mode]')
    pg.click('[data-mode="crear"]')
    pg.fill('#cl-nm',nombre);pg.fill('#cl-em',email);pg.fill('#cl-pw',pw);pg.fill('#cl-co',code)
    pg.click('#cl-go');pg.wait_for_selector('#sec-ok',timeout=15000)
    rec=pg.inner_text('#modal-root p[style*=monospace]')
    pg.check('#sec-ok');pg.click('#modal-root [data-m=ok]');pg.wait_for_selector('#panel:not([hidden])',timeout=15000)
    return rec
def ev(pg,js):return pg.evaluate(js)
def wait_sync(pg,ms=5000):
    pg.evaluate("cloudSync(true)");pg.wait_for_timeout(ms)
def ok(c,m):
    print(('OK   ' if c else 'FALLA ')+m)
    return c
