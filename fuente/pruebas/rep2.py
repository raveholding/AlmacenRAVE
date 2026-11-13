# V26.69 · Reparto en la versión con nube: el pedido del menú viaja cifrado, el seguimiento no lleva datos personales
# y los datos del cliente del envío van cifrados en la sincronización. Compilar antes el cliente en /tmp/rave/cli.html
import json
from playwright.sync_api import sync_playwright
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page();ev=pg.evaluate;errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    calls=[]
    def h(route):
        r=route.request;calls.append((r.url,r.post_data))
        if r.url.endswith('/rpc/reparto_pedir'): return route.fulfill(status=200,body='{"ok":true}',headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'})
        if r.url.endswith('/rpc/reparto_estado_ver'): return route.fulfill(status=200,body='{"ok":true,"pedidos":[{"ref":"x","estado":"en_camino","eta":"10 min","rep":"Juan"}]}',headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'})
        route.fulfill(status=404,body='{}',headers={'Access-Control-Allow-Origin':'*'})
    pg.route('https://pruebarave.supabase.co/**',h)
    pg.goto('file:///tmp/rave/cli.html#menu');pg.wait_for_timeout(1500)
    chk(ev("BYC.envio&&BYC.envio.pii.includes('cli')&&BYC.envio.pii.includes('pin')&&BYC.envio.pii.includes('tok')&&BYC.envio.strip.includes('fotoData')"),'sincronización: datos del cliente, PIN y referencia del envío cifrados; la foto no viaja')
    chk(ev("BYC.rendrep&&BYC.rendrep.once&&ONCEC.has('rendrep')&&!!BYC.ruta"),'rendiciones se escriben una sola vez')
    chk(ev("S.users.every(u=>u.role!=='repartidor')"),'el cliente real no trae usuarios de prueba')
    chk(not ev("!!(S.cfg.rep&&S.cfg.rep.on)"),'el reparto viene apagado hasta que el dueño lo active')
    r=ev("""(async()=>{const kp=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
      const pub=await crypto.subtle.exportKey('jwk',kp.publicKey),priv=await crypto.subtle.exportKey('jwk',kp.privateKey);cl.pubSnap={contenido:{clubkey:pub,site:{rep:{on:true}}}};
      const o=await RAVE_API.repOrder({nombre:'Carla Secreta',tel:'3875111222',dir:'Calle Privada 742',loc:'Centro',items:[{id:'x',q:1}],pago:'efectivo',zona:'z'});window.__priv=priv;return o;})()""")
    body=[json.loads(d) for u,d in calls if u.endswith('/rpc/reparto_pedir')]
    chk(r['ok'] and len(r['pin'])==4 and len(r['tok'])>=16,'el celular recibe su código de entrega y su referencia')
    chk(body and set(body[0]['p_cifrado'].keys())>={'k','iv','ct'} and 'Carla' not in json.dumps(body) and 'Privada' not in json.dumps(body) and '3875111222' not in json.dumps(body),'al servidor sólo llega el pedido cifrado (sin nombre, teléfono ni domicilio)')
    chk(body and body[0]['p_ref']==r['tok'],'la referencia de seguimiento es la del pedido')
    d=ev("rsaOpen(window.__priv,%s)"%json.dumps(body[0]['p_cifrado']))
    chk(d['nombre']=='Carla Secreta' and d['tok']==r['tok'] and d['pin']==r['pin'],'sólo el sistema del local (con su llave) puede leerlo')
    t=ev("RAVE_API.track(['%s'])"%r['tok'])
    chk(t and t[0]['estado']=='en_camino','el seguimiento consulta sólo el estado')
    chk(not errs,'sin errores JS '+str(errs[:3]))
    b.close()
print('\n%d/%d'%(sum(res),len(res)))
