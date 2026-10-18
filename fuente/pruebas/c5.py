from cl_lib import *
res=[]
def chk(c,m):res.append(bool(ok(c,m)))
with sync_playwright() as p:
    b=launch(p)
    ctx,A=newpage(b,'A');create_commerce(A)
    ev(A,"cloudPublishMenu(true)");A.wait_for_timeout(2500)
    ctxC,C=newpage(b,'C',390)
    C.goto(BASE+'/cliente.html#menu');C.wait_for_timeout(4000)
    fr=[f for f in C.frames if f.name=='pubframe']
    chk(len(fr)==1,'el menú público está en un iframe')
    f=fr[0]
    chk(f.locator('#club-form').count()==1,'el formulario del Club está presente')
    f.click('#ag-yes');C.wait_for_timeout(400);f.evaluate("document.getElementById('club-form').scrollIntoView()")
    f.fill('#club-nombre','Lucía Gómez');f.fill('#club-whatsapp','3875556677');f.fill('#club-cumple','1992-03-14')
    f.check('#club-consent');f.check('#club-comm')
    f.click('#club-form button[type=submit]');C.wait_for_timeout(2500)
    vis=f.evaluate("getComputedStyle(document.getElementById('club-ok')).display")
    err=f.evaluate("document.getElementById('club-error2').innerText+'|'+getComputedStyle(document.getElementById('club-error')).display")
    chk(vis!='none','formulario real: aparece el mensaje de éxito (display=%s, err=%s)'%(vis,err))
    n=sql("select count(*) from club_altas")
    chk(n=='1','el alta llegó al servidor (%s)'%n)
    chk('Lucía' not in sql("select cifrado::text from club_altas"),'cifrada: el servidor no ve el nombre')
    # doble envío no duplica
    f.fill('#club-nombre','Lucía Gómez');f.fill('#club-whatsapp','3875556677');f.fill('#club-cumple','1992-03-14');f.check('#club-consent')
    f.click('#club-form button[type=submit]');C.wait_for_timeout(2500)
    A.evaluate("importAltas()");A.wait_for_timeout(2000)
    nc=ev(A,"S.customers.filter(c=>c.name==='Lucía').length")
    chk(nc==1,'el staff importa un solo cliente aunque se envió dos veces (%s)'%nc)
    bad=[e for e in errs if 'net::ERR' not in e and '403' not in e and '503' not in e]
    chk(not bad,'sin errores JS %s'%bad[:3])
    b.close()
print(sum(res),'/',len(res))
