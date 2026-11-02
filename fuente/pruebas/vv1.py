# V26.43 · Centro de operaciones vivo SVB R2AVE (sólo raveV3): escena, cuatro integrantes de cuerpo completo que se mueven,
# vuelo del drone, seguimiento de cámara, rótulos Real/Simulación conectados a datos reales, sólo lectura, pausa, aislamiento.
import json
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
F='/tmp/rave/v3.html'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1366,'height':900});pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append('C:'+m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    pg.goto('file://'+F+'#acceso');pg.wait_for_timeout(1000)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(600)
    snap=lambda: ev("JSON.stringify({p:S.products.map(x=>[x.id,x.stock,x.price]),s:S.sales.length,c:S.customers.length,pu:S.punches.length,m:S.movs.length,cl:S.closures.length})")
    s0=snap()
    ev("go('centro')");ev("A.ciToggle()");pg.wait_for_timeout(1200)
    chk(pg.locator('.ci-root .vv canvas.vv-cv').count()==1,'el centro de operaciones vivo es el primer panel del Centro')
    order=ev("[...document.querySelectorAll('.ci-root > *')].map(e=>e.className).slice(0,4).join('|')")
    chk(order.find('vv')<order.find('ci-main') if 'ci-main' in order else True,'aparece antes del mapa del local')
    chk(ev("!!document.querySelector('.ci-root details .r2-team')"),'las fichas con caras quedan plegadas: no son la representación principal')
    ev("document.querySelector('.vv').scrollIntoView()");pg.wait_for_timeout(300)
    pos0=ev("Object.values(CI.vivo.CH).map(c=>[c.k,c.x,c.y,c.z])");pg.wait_for_timeout(4000)
    pos1=ev("Object.values(CI.vivo.CH).map(c=>[c.k,c.x,c.y,c.z])")
    moved=[a[0] for a,b2 in zip(pos0,pos1) if abs(a[1]-b2[1])+abs(a[2]-b2[2])+abs(a[3]-b2[3])>0.05]
    chk(len(moved)>=3,'los integrantes se desplazan solos (%s)'%moved)
    chk(ev("CI.vivo.V.fps")>20,'la escena se anima (%.0f cuadros por segundo)'%ev("CI.vivo.V.fps"))
    # velocidades finitas: sin teletransportes
    mx=0
    for i in range(10):
        a=ev("Object.values(CI.vivo.CH).map(c=>[c.x,c.y])");pg.wait_for_timeout(100);b2=ev("Object.values(CI.vivo.CH).map(c=>[c.x,c.y])")
        mx=max(mx,max(((x1-x0)**2+(y1-y0)**2)**0.5 for (x0,y0),(x1,y1) in zip(a,b2)))
    chk(mx<0.8,'sin teletransportes: el mayor salto en 0,1 s es %.2f m de escena'%mx)
    chk(ev("CI.vivo.CH.t2uluz.z")>1,'T2ULUZ vuela en altura (z = %.1f)'%ev("CI.vivo.CH.t2uluz.z"))
    # dibujo de cuerpo completo: cada personaje pinta píxeles en un lienzo aparte
    for k in ['r2ave','m2argoth','s2hakira','t2uluz']:
        n=ev("""(()=>{const c=document.createElement('canvas');c.width=200;c.height=260;const x=c.getContext('2d');const st=Object.assign({},CI.vivo.CH['%s'],{z:0});CI.vivo.drawChar(x,'%s',100,220,70,st,{fx:1,front:true},1000,240);
          const d=x.getImageData(0,0,200,260).data;let n=0,top=260,bot=0;for(let i=3;i<d.length;i+=4)if(d[i]>20){n++;const y=Math.floor((i>>2)/200);top=Math.min(top,y);bot=Math.max(bot,y);}return [n,top,bot]})()"""%(k,k))
        chk(n[0]>800 and (n[2]-n[1])>40,'%s se dibuja de cuerpo completo (%d píxeles, %d px de alto)'%(k,n[0],n[2]-n[1]))
    hr=ev("""(()=>{const c=document.createElement('canvas');c.width=200;c.height=260;const x=c.getContext('2d');CI.vivo.drawChar(x,'r2ave',100,230,70,Object.assign({},CI.vivo.CH.r2ave),{fx:1,front:true},1000);const d=x.getImageData(0,0,200,260).data;let top=260,bot=0;for(let i=3;i<d.length;i+=4)if(d[i]>20){const y=Math.floor((i>>2)/200);top=Math.min(top,y);bot=Math.max(bot,y);}return bot-top})()""")
    chk(hr>150,'R2AVE de pies a cuernos (%d px con 70 px por metro)'%hr)
    # cámara: seguir y vista general
    ev("A.vvFollow({dataset:{id:'m2argoth'}})");pg.wait_for_timeout(1500)
    chk(ev("CI.vivo.V.follow")=='m2argoth' and ev("CI.vivo.V.zoom")>2,'al elegir un integrante la cámara lo sigue y se acerca')
    d=ev("(()=>{const V=CI.vivo.V,c=CI.vivo.CH.m2argoth;return Math.hypot(V.cfx-c.x,V.cfy-c.y)})()")
    chk(d<1.5,'la cámara queda centrada en M2ARGOTH (%.2f m)'%d)
    ev("A.vvOrbit({dataset:{id:'1'}})");chk(abs(ev("CI.vivo.V.th")+0.45-3.14159/8)<0.01,'la cámara orbita')
    ev("A.vvView()");chk(ev("CI.vivo.V.follow")=='' and ev("CI.vivo.V.zoom")==1,'«Vista general» vuelve a ver todo el centro')
    ev("A.vvZoom({dataset:{id:'1'}})");chk(ev("CI.vivo.V.zoom")>1,'zoom progresivo')
    pg.select_option('[data-vvfocus]','mon');pg.wait_for_timeout(200);chk(ev("CI.vivo.V.focus")=='mon','enfocar una estación')
    ev("A.vvView()")
    # rótulos Real / Simulación conectados a datos del sistema
    ev("S.products[0].stock=-3;save()");pg.wait_for_timeout(1500)
    m2=ev("({a:CI.vivo.CH.m2argoth.act,r:CI.vivo.CH.m2argoth.real})")
    chk(m2['r'] and 'alerta' in m2['a'],'con alertas reales M2ARGOTH va al monitoreo y su actividad se rotula Real (%s)'%m2['a'])
    n0=ev("CI.st.chat.length");pg.fill('#ci-q','¿cuánto vendimos hoy?');pg.click('[data-act=ciAsk]');pg.wait_for_timeout(300);ev("document.querySelector('.vv').scrollIntoView()");pg.wait_for_timeout(1500)
    r2=ev("({a:CI.vivo.CH.r2ave.act,r:CI.vivo.CH.r2ave.real,st:CI.vivo.CH.r2ave.st})")
    chk(r2['r'] and r2['st']=='answer','una consulta real hace que R2AVE vaya a responder, rotulado Real (%s)'%r2['a'])
    sims=ev("Object.values(CI.vivo.CH).filter(c=>!c.real).map(c=>c.act)")
    chk(all(sims) and len(sims)>=1,'las animaciones ambientales se rotulan Simulación %s'%sims[:2])
    ev("document.querySelector('#vv-tab').closest('details').open=true");pg.wait_for_timeout(4500)
    tb=pg.inner_text('#vv-tab')
    chk('R2AVE' in tb and ('Real' in tb) and ('Simulación' in tb),'tabla alternativa: dónde está y qué hace cada uno, real o simulación')
    scr=ev("[...document.querySelectorAll('.ci-root .vv-note')].map(e=>e.innerText).join(' ')")
    chk('no son modelos 3D con esqueleto' in scr,'la escena declara honestamente qué es (2.5D, sin modelos 3D con esqueleto)')
    # sólo lectura: la escena no cambia datos del negocio
    ev("S.products[0].stock=%s;save()"%json.loads(s0)['p'][0][1]);pg.wait_for_timeout(300)
    s1=json.loads(snap());s00=json.loads(s0)
    chk(s1['p']==s00['p'] and s1['s']==s00['s'] and s1['m']==s00['m'] and s1['pu']==s00['pu'] and s1['cl']==s00['cl'],'la escena viva no modifica productos, ventas, movimientos, fichadas ni cierres')
    # mapa del local: el equipo de cuerpo completo (no círculos con caras)
    ev("CI.draw()");chk(ev("CI._hits.filter(h=>h.it.kind==='asst').length")==4,'en el mapa del local los cuatro aparecen de cuerpo completo y se pueden tocar')
    # pausa fuera de pantalla
    ev("window.scrollTo(0,document.body.scrollHeight)");pg.wait_for_timeout(800)
    a=ev("CI.vivo.CH.r2ave.x");pg.wait_for_timeout(1200);b3=ev("CI.vivo.CH.r2ave.x")
    chk(abs(a-b3)<1e-6,'la animación se pausa cuando la escena no se ve')
    # aislamiento: un error en el dibujo no rompe el Centro
    ev("CI.vivo._bk=CI.vivo.drawChar;CI.vivo.drawChar=()=>{throw new Error('falla simulada escena')};0");ev("document.querySelector('.vv').scrollIntoView()");pg.wait_for_timeout(800)
    chk(ev("!!document.querySelector('.ci-root canvas.ci-cv')") and ev("CI.log.some(l=>l.kind==='error'&&l.msg.includes('falla simulada escena'))"),'si falla el dibujo de un personaje queda en el registro y el Centro sigue funcionando')
    ev("CI.vivo.drawChar=CI.vivo._bk;0")
    errs[:]=[x for x in errs if 'falla simulada' not in x]
    # celular
    pg.set_viewport_size({'width':390,'height':844});pg.wait_for_timeout(800)
    chk(ev("document.documentElement.scrollWidth")<=392,'a 390 px la escena no desborda')
    small=ev("[...document.querySelectorAll('.ci-root .vv .ci-btn')].filter(b=>b.offsetParent).map(b=>Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height)).filter(v=>v<44).length")
    chk(small==0,'controles de la escena de 44 px o más')
    pg.screenshot(path='/tmp/vv1_390.png')
    # reducir movimiento: imagen fija, sin bucle
    q=b.new_page(viewport={'width':1280,'height':900},reduced_motion='reduce');q.goto('file://'+F+'#acceso');q.wait_for_timeout(900);q.select_option('#lu',index=0);q.fill('#lp','1234');q.click('[data-act=login]');q.wait_for_timeout(500)
    q.evaluate("go('centro');CI.isOn()||A.ciToggle()");q.wait_for_timeout(900);q.evaluate("document.querySelector('.vv').scrollIntoView()");q.wait_for_timeout(500)
    x0=q.evaluate("CI.vivo.CH.r2ave.x");q.wait_for_timeout(1500);x1=q.evaluate("CI.vivo.CH.r2ave.x")
    chk(abs(x0-x1)<0.05 and q.evaluate("!CI.vivo.V.raf"),'con «reducir movimiento» la escena queda quieta (sin bucle de animación)')
    q.close()
    b.close()
print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
