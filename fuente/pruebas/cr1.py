# V26.45 · Centro Inteligente con el equipo SVB R2AVE en la versión del CLIENTE (Almacén RAVE), compilada sin nube para
# probar en el navegador: arranca sin errores, el Centro sigue apagado hasta que el administrador lo activa, están los diez,
# el centro vivo se mueve, no hay textos de demo ni «Simulación», los especialistas no escriben y nada cambia los datos.
import re,sys,json
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
F=sys.argv[1] if len(sys.argv)>1 else '/tmp/rave/cli_local.html'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1366,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]));pg.on('console',lambda m:errs.append('C:'+m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    pg.goto('file://'+F+'#acceso');pg.wait_for_timeout(1200)
    chk(ev("IS_CLIENT===true"),'es la versión del cliente')
    # sin nube el cliente no deja entrar: para la prueba local se abre una sesión de administrador en el navegador
    ev("user=(S.users||[]).find(u=>u.role==='admin')||{id:'prueba',name:'Prueba',role:'admin',pin:''};location.hash='#panel/inicio'");pg.wait_for_timeout(700)
    chk(ev("typeof user!=='undefined'&&!!user"),'ingresa (sin nube, para la prueba local)')
    snap="JSON.stringify({p:S.products.map(x=>[x.id,x.stock,x.price]),s:S.sales.length,m:S.movs.length,pu:S.punches.length,cl:S.closures.length,a:(S.audit||[]).filter(a=>/R2AVE_AJUSTE/.test(a.action)).length})"
    s0=ev(snap)
    ev("go('centro')");pg.wait_for_timeout(500)
    chk(ev("!CI.isOn()") and pg.locator('.vv').count()==0,'el Centro está apagado hasta que el administrador lo activa')
    ev("A.ciToggle()");pg.wait_for_timeout(1500)
    chk(pg.locator('.ci-root .vv canvas.vv-cv').count()==1,'activado: aparece el centro de operaciones vivo')
    chk(len(ev("Object.keys(CI.vivo.CH)"))==10 and pg.locator('.vv [data-act=vvFollow]').count()==10,'están los diez integrantes')
    ev("document.querySelectorAll('.ci-root details').forEach(d=>d.open=true)");pg.wait_for_timeout(300)
    nm=ev("[...document.querySelectorAll('.r2-card .r2-ph b')].map(x=>x.innerText)")
    chk(len(nm)==10,'las diez fichas del equipo %s'%nm)
    ev("document.querySelector('.vv').scrollIntoView()");pg.wait_for_timeout(300)
    a0=ev("Object.values(CI.vivo.CH).map(c=>[c.x,c.y])");pg.wait_for_timeout(3500);a1=ev("Object.values(CI.vivo.CH).map(c=>[c.x,c.y])")
    chk(sum(1 for x,y in zip(a0,a1) if abs(x[0]-y[0])+abs(x[1]-y[1])>0.05)>=3,'los integrantes se mueven solos')
    pg.wait_for_timeout(4500)
    t=pg.inner_text('#view')
    bad=re.findall(r'.{0,30}(?:\bdemo\b|simulad|Simulaci[oó]n).{0,20}',t,re.I)
    chk(not bad,'el Centro del cliente no muestra textos de demo ni «Simulación» %s'%bad[:3])
    chk('Ambiente' in t,'las animaciones ambientales se rotulan «Ambiente»')
    r=ev("['vertice','nebula','quantum','orion','atenea','nexus','m2argoth','t2uluz','s2hakira'].every(a=>!CI.r2.capCheck(a,'inventory.stock.adjust').ok)")
    chk(r,'ningún integrante salvo R2AVE puede corregir stock')
    chk(not ev("CI.r2.capCheck('r2ave','inventory.stock.adjust').ok"),'la corrección de R2AVE está apagada por defecto')
    for k in ['vertice','quantum','nexus']:
        ev("CI.st.asst='%s'"%k);pg.fill('#ci-q','¿cómo venimos?');pg.click('[data-act=ciAsk]');pg.wait_for_timeout(300)
    t2=str(ev("CI.st.chat.slice(-6)"))
    chk('VÉRTICE' in t2 and 'QUANTUM' in t2 and 'NEXUS' in t2,'los especialistas responden en el chat')
    ev("CI.st.asst='r2ave'")
    chk(ev(snap)==s0,'el Centro no modificó productos, ventas, movimientos, fichadas, cierres ni hizo ajustes')
    pg.set_viewport_size({'width':390,'height':844});pg.wait_for_timeout(600)
    chk(ev("document.documentElement.scrollWidth")<=392,'a 390 px no desborda')
    b.close()
s=open(F,encoding='utf8').read()
print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
