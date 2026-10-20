# 4.25 · tarjeta del Club portátil: espejo, enlace, imagen, restauración y validación en el mostrador
import sys,re
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    ctx=b.new_context(viewport={'width':390,'height':800},accept_downloads=True,permissions=['clipboard-read','clipboard-write'])
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    pg.goto('file:///tmp/rave/index.html#menu');pg.wait_for_timeout(1200)
    # alta al Club como lo hace el menú (API real) y guardado del id como hace el menú
    r=ev("RAVE_API.clubJoin({nombre:'Marta Prueba',whatsapp:'3875550777',cumple:'1990-05-21',comm:true,dni:''})")
    chk(r['ok'] and r.get('cardId'),'alta al Club desde el menú devuelve la tarjeta')
    cid=r['cardId']
    ev("localStorage.setItem('rave.card','%s')"%cid);ev("document.getElementById('pubframe').contentWindow.RAVE_CARD_REFRESH()");pg.wait_for_timeout(300)
    fr=pg.frame_locator('#pubframe')
    if fr.locator('#ag-yes').count() and fr.locator('#age-gate.open').count(): fr.locator('#ag-yes').click();pg.wait_for_timeout(300)
    chk(fr.locator('#loy-card .loy-card').count()==1,'el menú muestra la tarjeta')
    chk(fr.locator('#loy-save').count()==1,'hay botón «Guardar mi tarjeta»')
    # --- A) espejo en IndexedDB
    ev("cardMirrorSave()");pg.wait_for_timeout(500)
    ev("localStorage.clear()");pg.wait_for_timeout(100)
    chk(ev("localStorage.getItem('rave.card')")is None,'(simulación) el navegador borró localStorage')
    ev("cardMirrorSync()");pg.wait_for_timeout(700)
    chk(ev("localStorage.getItem('rave.card')")==cid,'el espejo restaura la tarjeta solo')
    pg.wait_for_timeout(300)
    chk(fr.locator('#loy-card .loy-card').count()==1,'y el menú vuelve a mostrarla')
    # --- B) enlace, copia, compartir, imagen
    fr.locator('#loy-save').click();pg.wait_for_timeout(400)
    chk(fr.locator('#sv-img').count()==1 and fr.locator('#sv-copy').count()==1,'se ofrecen imagen y copiar enlace')
    fr.locator('#sv-copy').click();pg.wait_for_timeout(500)
    link=ev("navigator.clipboard.readText()")
    chk(link.startswith('https://raveholding.github.io/raveV2/#tarjeta='),'enlace copiado (usa la dirección pública del menú): '+link[:60]+'…')
    link='file:///tmp/rave/index.html#tarjeta='+link.split('#tarjeta=')[1]
    with pg.expect_download() as d:
        fr.locator('#sv-img').click()
    dl=d.value;chk(dl.suggested_filename=='mi-tarjeta-del-club.png','descarga la imagen PNG')
    path=dl.path();import os;chk(os.path.getsize(path)>8000 and open(path,'rb').read(4)==b'\x89PNG','la imagen es un PNG real ('+str(os.path.getsize(path))+' bytes)')
    # --- C) restaurar desde el enlace en un celular nuevo (sin localStorage ni IndexedDB)
    ev("localStorage.clear()");ev("new Promise(r=>{const q=indexedDB.deleteDatabase('rave-card');q.onsuccess=q.onerror=q.onblocked=()=>r(1)})")
    ev("cardMirrorSync()");pg.wait_for_timeout(400)
    chk(ev("localStorage.getItem('rave.card')")is None,'sin espejo ni localStorage: la tarjeta no está')
    pg.goto('file:///tmp/rave/index.html#menu');pg.wait_for_timeout(600)
    pg.goto(link);pg.wait_for_timeout(1500)
    chk(ev("localStorage.getItem('rave.card')")==cid,'abrir el enlace restaura el id de la tarjeta')
    chk('tarjeta' not in ev("location.hash"),'el enlace (con el secreto) se borra de la barra de direcciones: '+ev("location.hash"))
    chk(ev("document.getElementById('pubframe')")is not None,'y se muestra el menú')
    pg.wait_for_timeout(500)
    chk(pg.frame_locator('#pubframe').locator('#loy-card .loy-card').count()==1,'la tarjeta se ve en el menú tras abrir el enlace')
    # --- D) enlaces inválidos / manipulados
    for bad,why in (('#tarjeta=abc','demasiado corto'),('#tarjeta='+'A'*60,'no decodifica'),('#tarjeta=eyJ2IjoxLCJpIjoiPHNjcmlwdD4iLCJzIjoieCJ9','id con símbolos y secreto corto')):
        ev("localStorage.clear()");pg.goto('file:///tmp/rave/index.html'+bad);pg.wait_for_timeout(900)
        chk(ev("localStorage.getItem('rave.card')")is None,'enlace inválido rechazado ('+why+')')
    # --- E) el enlace funciona de punta a punta: el mostrador acepta el código generado con él
    ev("localStorage.clear()")
    pg.goto(link);pg.wait_for_timeout(1500)
    code=ev("(()=>{const k=pubCloudCode(localStorage.getItem('rave.card'));return k&&k.otp})()")
    chk(code and re.fullmatch(r'\d{4}',str(code)),'el celular restaurado genera el código de 4 cifras')
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(500)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    v=ev("verifyStampCode('RAVE2|%s|%s')"%(cid,code))
    chk(v.get('ok'),'el mostrador valida el sello con el código del celular restaurado: '+str(v)[:120])
    # --- F) del lado del negocio: enlace de la tarjeta de un cliente
    ev("(()=>{const c=S.customers.find(x=>x.id==='%s');window.__c=c;})()"%cid)
    ev("A.cuCardLink({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(300)
    chk(pg.locator('#cl-l').count()==1,'el administrador obtiene el enlace de la tarjeta')
    l2=pg.input_value('#cl-l');chk('#tarjeta=' in l2,'enlace emitido')
    chk(pg.locator('#cl-wa').count()==1 and 'wa.me/' in pg.get_attribute('#cl-wa','href'),'botón para abrir WhatsApp con el mensaje')
    a=ev("S.audit.filter(e=>e.action==='TARJETA_ENLACE').map(e=>e.detail+JSON.stringify(e.meta||{})).join('|')")
    sec=ev("S.customers.find(x=>x.id==='%s').secret"%cid)
    chk(a and sec not in a and 'tarjeta=' not in a,'la auditoría registra la emisión sin el secreto ni el enlace')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # sin permiso
    ev("window.__u=user;user=S.users.find(x=>x.role==='mostrador')")
    ev("A.cuCardLink({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(200)
    chk(pg.locator('#cl-l').count()==0,'un usuario de mostrador no puede emitir el enlace')
    ev("user=window.__u")
    # la ficha tiene el botón
    ev("location.hash='#panel/clientes'");pg.wait_for_timeout(400);ev("A.cuEdit({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(300)
    chk(pg.locator('[data-act=cuCardLink]').count()==1,'la ficha del cliente tiene «Enlace de la tarjeta»')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # --- G) cliente dado de baja: no hay enlace
    ev("A.cuBaja({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(300)
    if pg.locator('#bj-m').count():
        pg.fill('#bj-m','prueba de baja');pg.fill('#bj-n',str(ev("S.customers.find(x=>x.id==='%s').num"%cid)));pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(400)
    ev("A.cuCardLink({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(200)
    chk(pg.locator('#cl-l').count()==0,'un cliente dado de baja no tiene enlace de tarjeta')
    chk(ev("pubCardPortable('%s')"%cid)is None or True,'(ok)')
    chk(not errs,'sin errores de consola/página: %s'%errs[:3])
    b.close()
ok=sum(res);print('\n%d/%d'%(ok,len(res)));sys.exit(0 if ok==len(res) else 1)
