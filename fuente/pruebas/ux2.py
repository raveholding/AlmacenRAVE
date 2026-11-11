# V26.65 · pantallas largas: buscador y accesos por sección; RR. HH. visible para el administrador del cliente aunque esté apagado.
import sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    for v in ['index','solo','v3','kini']:
        pg=b.new_page(viewport={'width':1280,'height':860});ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
        pg.goto('file:///tmp/rave/%s.html#acceso'%v);pg.wait_for_timeout(900);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(700)
        ev("go('config')");pg.wait_for_timeout(500)
        n=ev("document.querySelectorAll('#ux-secnav [data-sec]').length")
        chk(n>=6,'%s · Configuración con accesos por sección (%d)'%(v,n))
        tot=ev("uxSecCards(document.querySelector('#view')).length")
        chk(ev("(()=>{const L=uxSecCards(document.querySelector('#view')).filter(c=>!c.classList.contains('ux-hid'));return L.length>0&&L.every(c=>c.dataset.cg===L[0].dataset.cg)})()"),'%s · al entrar se ve un solo grupo (V26.66: una sección a la vez)'%v)
        pg.locator('#ux-secnav [data-sec="g:Negocio"]').click();pg.wait_for_timeout(200)  # V26.66: en Configuración los accesos son por grupo
        vis=ev("uxSecCards(document.querySelector('#view')).filter(c=>!c.classList.contains('ux-hid')).map(c=>c.dataset.cg)")
        chk(0<len(vis)<tot and all(x=='Negocio' for x in vis),'%s · un toque en un grupo muestra sólo ese grupo (%d)'%(v,len(vis)))
        pg.fill('#ux-sec-q','fiado');pg.wait_for_timeout(200)
        k=ev("uxSecCards(document.querySelector('#view')).filter(c=>!c.classList.contains('ux-hid')).length")
        chk(0<k<tot,'%s · el buscador filtra («fiado» → %d de %d)'%(v,k,tot))
        pg.fill('#ux-sec-q','zzzz');pg.wait_for_timeout(200)
        chk('No hay opciones' in pg.inner_text('#ux-sec-res'),'%s · búsqueda sin resultados lo dice'%v)
        pg.press('#ux-sec-q','Escape');pg.wait_for_timeout(200)
        chk(ev("uxSecCards(document.querySelector('#view')).filter(c=>!c.classList.contains('ux-hid')).every(c=>c.dataset.cg==='Negocio')"),'%s · Escape vuelve al grupo en el que estabas'%v)
        ev("go('menuadmin')");pg.wait_for_timeout(400)
        chk(ev("!!document.querySelector('#ux-secnav')")==(ev("uxSecCards(document.querySelector('#view')).length")>=5),'%s · Menú público usa el mismo navegador cuando es larga'%v)
        pg.set_viewport_size({'width':360,'height':780});ev("go('config')");pg.wait_for_timeout(400)
        chk(not ev("document.documentElement.scrollWidth>document.documentElement.clientWidth+1"),'%s · 360 px sin desborde'%v)
        pg.close()
    pg=b.new_page(viewport={'width':1280,'height':860});ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.goto('file:///tmp/rave/out_cliente.html');pg.wait_for_timeout(1200)
    chk(not ev("hrOn()"),'cliente: RR. HH. apagado de fábrica')
    ev("user={name:'ADMIN',role:'admin'}")
    chk(ev("uxVis('rrhh')"),'cliente: el administrador ve «Recursos Humanos» en el menú aunque esté apagado')
    chk(not ev("(user={name:'X',role:'mostrador'},uxVis('rrhh'))"),'cliente: el mostrador no lo ve')
    b.close()
chk(not errs,'sin errores de página %s'%errs[:3])
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
