# V26.53 · Número de caja ocupado: el cartel explica por qué, propone un número libre y el administrador puede pasar la caja a este equipo (liberar_caja).
import sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
STUB="""window.__calls=[];cl.comercio={id:'c1',nombre:'Prueba',slug:'p'};cl.dev='dev-nuevo-1234';cl.ses={access:'t',refresh:'r',exp:Date.now()+36e5};
window.fetch=async(u,o)=>{u=String(u);const J=(x,st)=>new Response(JSON.stringify(x),{status:st||200,headers:{'Content-Type':'application/json'}});
 if(/\\/rest\/v1\/cajas/.test(u))return J([{nro:1,nombre:'Dueño',visto:'2026-11-01T10:00:00Z'},{nro:2,nombre:'Mostrador',visto:'2026-11-06T10:00:00Z'}]);
 const m=u.match(/\/rpc\/(\w+)/);if(m){const a=JSON.parse((o&&o.body)||'{}');__calls.push([m[1],a]);if(window.__fail&&m[1]==='liberar_caja')return J({code:'PGRST202',message:'Could not find the function public.liberar_caja'},404);return J(true);}
 return J({},404);};"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':390,'height':844});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.goto(URL);pg.wait_for_timeout(900);ev(STUB)
    # administrador
    ev("cl.rol='admin';window.__r=undefined;askCajaNro(1).then(v=>window.__r=v);0");pg.wait_for_timeout(500)
    t=pg.locator('#modal-root .ov').last.inner_text()
    chk('equipo nuevo' in t and 'La caja 1 ya está reservada por Dueño' in t,'explica por qué y quién tiene la caja 1')
    chk(ev("document.getElementById('ask-v').value")=='3','propone el primer número libre (3)')
    chk(pg.locator('#ask-take').count()==1,'el administrador ve «Usar la caja 1 en este equipo»')
    h=ev("document.getElementById('ask-take').getBoundingClientRect().height");chk(h>=44,'el botón mide %d px (≥ 44)'%h)
    pg.locator('#ask-take').click();pg.wait_for_timeout(500)
    chk(ev("window.__r")=='1' and ev("__calls.some(c=>c[0]==='liberar_caja'&&c[1].p_nro===1&&c[1].p_disp==='dev-nuevo-1234')"),'libera la caja 1 y la devuelve para registrarla en este equipo')
    chk(pg.locator('#modal-root .ov').count()==0,'el cartel se cierra')
    chk(ev("S.audit.some(a=>a.action==='CAJA_LIBERADA'&&/caja 1 pasado a este equipo/.test(a.detail))"),'queda en la auditoría')
    # función no instalada en la nube
    ev("window.__fail=1;window.__r=undefined;askCajaNro(1).then(v=>window.__r=v);0");pg.wait_for_timeout(500)
    pg.locator('#ask-take').click();pg.wait_for_timeout(500)
    chk('16-liberar' not in pg.locator('#modal-root .ov').last.inner_text() and 'Falta instalar' in pg.locator('#modal-root .ov').last.inner_text() and ev("window.__r")==None,'si falta la función en la nube lo dice y deja usar otro número')
    pg.fill('#ask-v','0');pg.locator('#modal-root .ov').last.locator('.mf [data-m=ok]').click();pg.wait_for_timeout(300)
    chk('1 a 99' in pg.locator('#modal-root .ov').last.inner_text() and ev("window.__r")==None,'rechaza un número fuera de 1 a 99')
    pg.fill('#ask-v','5');pg.locator('#modal-root .ov').last.locator('.mf [data-m=ok]').click();pg.wait_for_timeout(300)
    chk(ev("window.__r")=='5','acepta otro número')
    # mostrador: no puede pasar la caja
    ev("window.__fail=0;cl.rol='mostrador';window.__r=undefined;askCajaNro(1).then(v=>window.__r=v);0");pg.wait_for_timeout(500)
    chk(pg.locator('#ask-take').count()==0 and 'administrador' in pg.locator('#modal-root .ov').last.inner_text(),'un mostrador no ve el botón y se le indica que lo haga el administrador')
    pg.locator('#modal-root .ov').last.locator('[data-m=x]').first.click();pg.wait_for_timeout(300)
    chk(ev("window.__r")==None,'cancelar devuelve vacío')
    chk(ev("document.documentElement.scrollWidth<=window.innerWidth+1"),'390 px sin desborde')
    chk(not errs,'sin errores %s'%errs[:2])
    b.close()
print('%d / %d'%(sum(res),len(res)))
