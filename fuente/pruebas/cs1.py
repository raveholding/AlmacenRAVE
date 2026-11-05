# V26.49 · 4.34 H5 · pantalla del cliente (BroadcastChannel, modo mínimo, sin datos sensibles, saldos apagados)
# Uso: python3 cs1.py [http://127.0.0.1:8765/index.html]   (con file:// el canal entre ventanas no es confiable)
import sys,subprocess,time,json,os
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else None
srv=None
if not URL:
    srv=subprocess.Popen(['python3','-m','http.server','8765','--bind','127.0.0.1','--directory','/tmp/rave'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(0.8)
    URL='http://127.0.0.1:8765/index.html'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    ctx=b.new_context(viewport={'width':1280,'height':900})
    pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append('pos:'+str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text and 'favicon' not in m.text else None)
    ev=pg.evaluate
    pg.goto(URL+'#acceso');pg.wait_for_timeout(800)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    caja=ev("String(S.tenant.caja)");db=ev("RAVE_BUILD.db")
    # pantalla del cliente
    cs=ctx.new_page();cs.on('pageerror',lambda e:errs.append('cs:'+str(e)[:300]))
    cs.goto(URL+'#pantalla-cliente/'+caja);cs.wait_for_timeout(700)
    chk(cs.locator('#cs').count()==1 and cs.evaluate("document.getElementById('app').hidden"),'la pantalla del cliente arranca en modo mínimo')
    chk(cs.evaluate("typeof S==='undefined'||!S||!S.sales||!S.sales.length") and cs.locator('#lp').count()==0 or not cs.locator('#login').is_visible(),'no abre el estado ni pide usuario')
    chk(db in cs.evaluate("window.__cs.channel") and cs.evaluate("window.__cs.channel").endswith('-'+caja),'canal propio de la build y de la caja: %s'%cs.evaluate("window.__cs.channel"))
    # espía del canal (como si fuera otra ventana del mismo navegador)
    spy=ctx.new_page();spy.goto(URL+'#pantalla-cliente/'+caja);spy.wait_for_timeout(500)
    spy.evaluate("(()=>{window.__msgs=[];new BroadcastChannel(window.__cs.channel).onmessage=e=>window.__msgs.push(e.data);})()")
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(400)
    chk(pg.locator('[data-act=csOpen]').count()==1,'Vender: botón «Pantalla del cliente»')
    ev("""(()=>{const p=S.products.find(x=>x.unit==='u'&&x.active&&x.price>0&&x.cost>0);window.__P=p;pos.lines=[];A.padd({dataset:{id:p.id}});A.padd({dataset:{id:p.id}});})()""")
    pg.wait_for_timeout(500)
    nm=ev("window.__P.name");tot=ev("money(posTotal())")
    T=cs.inner_text('#cs')
    chk(nm[:20] in T and tot in T,'el carrito aparece en vivo: %s · %s'%(nm[:30],tot))
    # con descuento por efectivo se ve el total final
    ev("S.payadj={on:true,stack:false,rules:{efectivo:{sign:-1,kind:'pct',v:1000,ver:1}}};pos.method='efectivo';posCart()");pg.wait_for_timeout(400)
    T=cs.inner_text('#cs');fin=ev("money(posFinal('efectivo'))")
    chk('Descuento Efectivo 10 %' in T and fin in T,'muestra el descuento por medio de pago y el total final %s'%fin)
    # cliente: sólo el nombre de pila
    ev("(()=>{const c=S.customers.find(x=>x.status!=='baja'&&x.name&&x.last);window.__C=c;pos.cust=c.id;posCart();})()");pg.wait_for_timeout(400)
    first=ev("window.__C.name.trim().split(/\\s+/)[0]");last=ev("window.__C.last")
    T=cs.inner_text('#cs')
    chk(('Hola, '+first) in T and last not in T,'cliente: sólo el nombre de pila («Hola, %s»)'%first)
    M=spy.evaluate("window.__msgs")
    raw=json.dumps(M,ensure_ascii=False)
    cost=ev("String(window.__P.cost)");cuit=ev("window.__C.taxid||''");dni=ev("window.__C.dni||''");tel=ev("window.__C.whatsapp||window.__C.phone||''")
    chk(len(M)>0 and '"cost"' not in raw and (not cuit or cuit not in raw) and (not dni or dni not in raw) and (not tel or tel not in raw),'los mensajes no llevan costo, CUIT, DNI ni teléfono (%d mensajes)'%len(M))
    chk(all(m.get('v')==1 and 'bal' not in m for m in M),'mensajes versionados y sin saldos del cliente (apagado)')
    # venta cobrada
    ev("A.cobrar()");pg.wait_for_timeout(300);pg.fill('#rcv',ev("pesosStr(posFinal('efectivo')+100000)"));pg.wait_for_timeout(100)
    pg.click('#modal-root .ov .btn.gold');pg.wait_for_timeout(700)
    T=cs.inner_text('#cs')
    chk('Gracias' in T and 'vuelto' in T.lower() and '1.000' in T,'al cobrar: «¡Gracias por su compra!» y el vuelto')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # carrito vacío → espera
    ev("pos.lines=[];posCart()");pg.wait_for_timeout(400)
    chk('Bienvenido' in cs.inner_text('#cs') or ev("S.tenant.name") in cs.inner_text('#cs'),'carrito vacío → pantalla de espera con el nombre del comercio')
    # mensaje viejo o de otra versión: se ignora
    cs.evaluate("window.__cs.show({v:9,type:'cart',ts:Date.now()+9e9,lines:[{name:'X',qty:1,amt:1}],total:1})");cs.wait_for_timeout(100)
    chk('X × 1' not in cs.inner_text('#cs'),'mensaje de otra versión → ignorado')
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola (caja y pantalla)')
    b.close()
finally:
    if srv:srv.terminate()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
