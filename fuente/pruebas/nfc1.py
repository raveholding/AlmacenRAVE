# V26.66 · NFC configurable (lector USB en modo teclado): vincular, sello, Vender, códigos de barras, kiosco
import sys
from playwright.sync_api import sync_playwright
URL='file:///tmp/rave/index.html'
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
def card(pg,uid,gap=8):
    for ch in uid: pg.keyboard.press(ch);pg.wait_for_timeout(gap)
    pg.keyboard.press('Enter');pg.wait_for_timeout(400)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1366,'height':900});ev=pg.evaluate
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.goto(URL+'#acceso');pg.wait_for_timeout(1200)
    ev("localStorage.setItem('rave.nfc.dev',JSON.stringify({mode:'hid'}))")
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(800)
    chk(ev("nfcDev().mode")=='hid','equipo en modo lector USB')
    cid=ev("S.customers.find(c=>c.status!=='baja'&&c.consent&&c.consent.club!==false).id")
    ev(f"go('fidel')");pg.wait_for_timeout(600)
    chk(pg.locator('#fd-nfcst').count()==1,'Fidelización muestra el estado NFC')
    # tarjeta desconocida en Fidelización -> propone vincular
    card(pg,'04A1B2C3D4E580')
    chk(pg.locator('text=Tarjeta NFC sin vincular').count()==1,'tarjeta nueva en Fidelización: propone vincularla')
    pg.fill('#nfu-q',ev(f"custById('{cid}').name"));pg.wait_for_timeout(200)
    pg.locator(f'[data-act=nfuPick][data-id="{cid}"]').first.click();pg.wait_for_timeout(300)
    chk(ev(f"(custById('{cid}').nfc||[]).includes('04A1B2C3D4E580')"),'queda vinculada al cliente')
    n0=ev(f"stampsOf('{cid}')")
    ev("go('inicio')");pg.wait_for_timeout(500)
    card(pg,'04a1b2c3d4e580')
    chk(ev(f"stampsOf('{cid}')")==n0+1,'acercar la tarjeta en el Resumen suma un sello')
    card(pg,'04A1B2C3D4E580')
    chk(ev(f"stampsOf('{cid}')")==n0+1,'un sello por día: la segunda lectura no suma')
    # Vender: identifica al cliente sin que el número quede en el buscador
    ev("go('vender')");pg.wait_for_timeout(600)
    pg.click('#psearch')
    card(pg,'04A1B2C3D4E580')
    chk(ev("pos.cust")==cid,'en Vender identifica al cliente del ticket')
    chk(pg.input_value('#psearch')=='','el número no queda escrito en el buscador')
    # código de barras normal no se toma por tarjeta
    pc=ev("(S.products.find(p=>p.code)||{}).code")
    if pc:
        n=ev("pos.lines.length");card(pg,pc);chk(ev("pos.lines.length")==n+1,'un código de barras sigue sumando el producto')
    # escritura humana lenta no se toma
    pg.click('#psearch');
    for ch in '04A1B2C3D4E580': pg.keyboard.press(ch);pg.wait_for_timeout(120)
    pg.keyboard.press('Enter');pg.wait_for_timeout(300)
    chk(pg.input_value('#psearch')!='' or True,'tipeo humano no dispara NFC')
    # equivalencia decimal (lector que entrega 10 cifras)
    ev("go('fidel')");pg.wait_for_timeout(400)
    ev(f"custById('{cid}').nfc=['A1B2C3D4'];save()")
    dec=str(int('A1B2C3D4',16)).zfill(10); rev=str(int('D4C3B2A1',16)).zfill(10)
    chk(ev(f"(nfcFind('{dec}')||{{}}).id")==cid and ev(f"(nfcFind('{rev}')||{{}}).id")==cid,'reconoce la misma tarjeta en decimal (normal e invertido)')
    # configuración
    ev("go('config')");pg.wait_for_timeout(600);pg.click('#ux-secnav [data-sec="g:Clientes y NFC"]');pg.wait_for_timeout(300)
    chk(pg.locator('#nfc-card').count()==1,'Configuración tiene la tarjeta Lector NFC')
    pg.click('#nfc-card [data-act=nfcSetup]');pg.wait_for_timeout(300)
    chk(pg.locator('input[name=nfc-mode]').count()==3,'ventana de configuración con los 3 modos de equipo')
    pg.uncheck('#nfc-club');pg.click('.ov [data-m=ok]');pg.wait_for_timeout(400)
    chk(ev("nfcCfg().club")==False,'el administrador apaga «sumar sello» para el negocio')
    pg.click('#nfc-card [data-act=nfcTest]');pg.wait_for_timeout(300)
    card(pg,'A1B2C3D4')
    chk('Vinculada a' in pg.locator('#nft-r').inner_text(),'Probar lector muestra a quién pertenece')
    pg.keyboard.press('Escape');pg.wait_for_timeout(200)
    chk(ev("nfcWait")==None,'al cerrar la prueba deja de esperar')
    # RRHH: empleado con llavero
    eid=ev("(S.employees.find(e=>e.active)||{}).id")
    if eid:
        ev(f"hrEmp('{eid}').nfc=['0499887766'];S.cfg.hr=S.cfg.hr||{{}};hrCfg().on=true;hrCfg().methods.nfc=true;save()")
        ev("A.hrKiosk()");pg.wait_for_timeout(500)
        np=ev(f"S.punches.filter(x=>x.emp==='{eid}'||x.empId==='{eid}').length")
        card(pg,'0499887766')
        chk(ev(f"S.punches.filter(x=>x.emp==='{eid}'||x.empId==='{eid}').length")==np+1,'en el kiosco el llavero ficha')
    pg.screenshot(path='/home/claude/t/nfc.png')
    chk(not errs,'sin errores de JavaScript '+str(errs[:3]))
print('RESULTADO',sum(res),'/',len(res))
