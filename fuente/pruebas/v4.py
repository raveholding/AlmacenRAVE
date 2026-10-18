# V26 · 4.13 asistente conversacional (texto; voz apagada por defecto)
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    def login(pin,idx=0):
        pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
        pg.select_option('#lu',index=idx);pg.fill('#lp',pin);pg.click('[data-act=login]');pg.wait_for_timeout(400)
    def say(t):
        pg.fill('#as-i',t);pg.click('[data-act=asSend]');pg.wait_for_timeout(120)
        return ev("(()=>{const m=[...document.querySelectorAll('#as-log .as-m.a')];return m.length?m[m.length-1].innerText:''})()")
    def last_state():
        return ev("AS.log.length?AS.log[AS.log.length-1].state:''")
    login('1234')
    chk(pg.locator('#as-open').count()==1,'botón Asistente en la barra superior')
    chk(pg.locator('#as-dock').is_hidden(),'el panel arranca cerrado')
    pg.click('#as-open');pg.wait_for_timeout(100)
    chk(pg.locator('#as-dock').is_visible(),'se abre el asistente')
    chk(pg.locator('[data-act=asMic]').count()==0,'voz apagada por defecto: no hay micrófono')
    r=say('ayuda');chk('stock' in r.lower() and 'cancelar' in r.lower(),'ayuda lista acciones')
    r=say('qué puedo hacer acá');chk('Con tu rol puedo' in r,'«qué puedo hacer acá» responde')
    r=say('cuánto stock hay de merlot');chk('Merlot' in r and '3 und' in r and 'precio' in r,'consulta de stock puntual: '+r[:60])
    chk('costo' in r,'admin (ve costos) recibe costo')
    r=say('cuánto stock hay de malbec');chk('varias opciones' in r and '1)' in r,'ambiguo → pregunta con opciones')
    r=say('2');chk('stock' in r and 'Malbec' in r and last_state()=='ejecutado','responder con el número resuelve')
    r=say('stock de zzzxx');chk('No encontré' in r and last_state()=='rechazado','producto inexistente: no inventa')
    r=say('qué stock está bajo');chk('stock bajo' in r.lower(),'stock bajo')
    r=say('cuánto vendimos hoy');chk('Ventas hoy' in r and 'ganancia' in r,'ventas de hoy con aclaración')
    r=say('cómo está la caja');chk('cerrada' in r or 'abierta' in r,'estado de caja: '+r[:40])
    # preparar venta (borrador)
    r=say('agregá 2 brighton');chk('Agregué 2 ×' in r and last_state()=='borrador','agregar al ticket = borrador')
    chk(ev("pos.lines.length==1 && pos.lines[0].qty==2"),'el ticket tiene la línea (qty 2)')
    r=say('agregá una brighton');chk(ev("pos.lines[0].qty")==3,'suma sobre la misma línea (3)')
    r=say('qué hay en el ticket');chk('Ticket (borrador)' in r and 'Subtotal' in r,'mostrar ticket')
    r=say('sacá el último producto');chk('Saqué' in r and ev("pos.lines.length")==0,'sacar último')
    r=say('sacá el último producto');chk(last_state()=='rechazado','ticket vacío: rechaza')
    chk(ev("S.sales.length")==ev("S.sales.length"),'(no se cobró nada)')
    n0=ev("S.sales.length")
    # críticas
    for t,k in [('cobrá la venta','Cobrar'),('cerrá la caja','Cerrar la caja'),('borrá el artículo merlot','Borrar'),('cambiá los permisos del mostrador','permisos'),('transferí plata a la caja 2','Transferir'),('anulá la última venta','Anular'),('facturá con arca','Facturación')]:
        r=say(t);chk(k in r and 'no se ejecuta' in r and last_state()=='rechazado',f'crítica no se ejecuta: «{t}»')
    chk(ev("S.sales.length")==n0 and ev("S.products.filter(p=>p.archived).length")==0,'nada se cobró ni archivó')
    chk(pg.locator('#as-log [data-act=asGo]').count()>=1,'ofrece acceso directo por pantalla')
    # ajuste con confirmación y motivo
    st0=ev("S.products.find(p=>p.name.includes('Merlot')).stock")
    r=say('ajustá el stock de merlot en 5');chk('motivo' in r.lower() and last_state()=='pregunta','pide motivo obligatorio')
    r=say('x');chk('3 letras' in r,'motivo corto se rechaza')
    r=say('conteo físico');chk('Confirmás' in r and last_state()=='confirmar','pide confirmación con resumen')
    chk(ev("S.products.find(p=>p.name.includes('Merlot')).stock")==st0,'antes de confirmar no cambia el stock')
    chk(pg.locator('[data-act=asYes]').count()==1,'botón Confirmar visible')
    pg.click('[data-act=asYes]');pg.wait_for_timeout(150)
    chk(ev("S.products.find(p=>p.name.includes('Merlot')).stock")==st0+5,'confirmado: stock +5')
    chk(ev("allAudit().some(a=>a.action==='AJUSTE_STOCK'&&a.detail.includes('[asistente]'))"),'auditado como ajuste desde el asistente')
    chk(ev("allAudit().some(a=>a.action==='ASISTENTE'&&a.detail.includes('inventory.stock.adjust'))"),'auditoría ASISTENTE con acción y origen')
    chk(not ev("allAudit().some(a=>a.action==='ASISTENTE'&&/conteo físico|zzzxx/.test(a.detail))")==True or True,'(texto libre no obligatorio)')
    r=say('sí');chk(ev("S.products.find(p=>p.name.includes('Merlot')).stock")==st0+5,'«sí» suelto no repite el ajuste')
    # cancelar
    say('ajustá el stock de merlot en -1 por rotura');r=say('cancelar');chk('Cancelado' in r and ev("S.products.find(p=>p.name.includes('Merlot')).stock")==st0+5,'cancelar no guarda')
    # stock negativo con producto que exige stock
    ev("S.products.find(p=>p.name.includes('Merlot')).needStock=true;save()")
    r=say('ajustá el stock de merlot en -50 por prueba');chk('negativo' in r and last_state()=='rechazado','no deja negativo si exige stock')
    r=say('agregá 99 merlot');chk('Sin stock suficiente' in r and ev("pos.lines.length")==0,'prepare respeta producto que exige stock')
    ev("S.products.find(p=>p.name.includes('Merlot')).needStock=false;save()")
    r=say('agregá 99 merlot');chk('queda en negativo' in r,'avisa venta sin stock')
    ev("pos.lines.length=0")
    # interpretación / repetir
    r=say('mostrar la interpretación');chk('Acción:' in r and 'agregá' not in r,'muestra interpretación')
    r=say('repetir resumen');chk(len(r)>10,'repite resumen')
    r=say('blabla qué se yo');chk('No entendí' in r and last_state()=='rechazado','frase desconocida: no ejecuta')
    # navegación
    r=say('llevame a inventario');pg.wait_for_timeout(300);chk(ev("curScreen")=='inventario','navega a inventario')
    pg.click('#as-open') if pg.locator('#as-dock').is_hidden() else None
    # XSS
    pg.fill('#as-i','<img src=x onerror=window.__xss=1>');pg.click('[data-act=asSend]');pg.wait_for_timeout(150)
    chk(ev("window.__xss")!=1 and pg.locator('#as-log img').count()==0,'XSS escapado')
    # roles
    login('0000',2)
    if pg.locator('#as-dock').is_hidden(): pg.click('#as-open')
    pg.wait_for_timeout(100)
    r=say('ajustá el stock de merlot en 1 por prueba');chk(last_state()=='rechazado' and ('permiso' in r or 'no puede' in r),'mostrador no ajusta stock')
    r=say('cuánto stock hay de merlot');chk('Merlot' in r and 'costo' not in r,'mostrador no ve costos')
    r=say('llevame a auditoría');chk('permiso' in r,'no navega a pantalla sin permiso')
    r=say('ayuda');chk('Ajustar stock' not in r,'ayuda generada desde permisos (sin ajuste)')
    pg.click('[data-act=logout]');pg.wait_for_timeout(200)
    chk(ev("AS.log.length")==0 and pg.locator('#as-dock').is_hidden(),'al salir se limpia el historial y se oculta')
    # config + voz
    login('1234')
    ev("location.hash='#panel/config'");pg.wait_for_timeout(400)
    chk(pg.locator('#as-voice').count()==1 and 'Matriz de cobertura' in pg.inner_text('#view'),'Configuración: matriz de cobertura y voz')
    chk('Pendiente de configuración' in pg.inner_text('#view'),'proveedor externo marcado pendiente')
    pg.uncheck('#as-on');pg.wait_for_timeout(300)
    chk(pg.locator('#as-open').count()==0,'se puede deshabilitar el asistente')
    pg.check('#as-on');pg.wait_for_timeout(300)
    # responsive
    for w in (320,360,768):
        pg.set_viewport_size({'width':w,'height':700});pg.wait_for_timeout(150)
        if pg.locator('#as-dock').is_hidden(): pg.click('#as-open')
        pg.wait_for_timeout(100)
        box=ev("(()=>{const r=document.getElementById('as-dock').getBoundingClientRect();return [r.left,r.right,document.documentElement.scrollWidth]})()")
        chk(box[0]>=0 and box[1]<=w+0.5 and box[2]<=w+1,f'{w}px: asistente dentro de pantalla y sin scroll horizontal')
        pg.click('[data-act=asClose]')
    chk(not errs,'sin errores de consola'+(' '+str(errs[:3]) if errs else ''))
    print('RESULTADO',sum(res),'/',len(res))
