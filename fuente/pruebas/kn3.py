# V26.33 · Kini «Sólo mayorista»: sin canal minorista ni «Cambiar canal»; precio por unidad y, al completar una presentación,
# su precio mayorista, para cualquier cliente (también sin identificar); raveV2 sigue igual (con canal minorista/mayorista)
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900});pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    ev=pg.evaluate
    def login(F):
        pg.goto('file://'+F+'#acceso');pg.wait_for_timeout(1100)
        pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(600)
    def last_ok(): pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(350)
    login('/tmp/rave/kini.html')
    chk(ev("wsOnly()") and ev("wsChan()")=='mayorista','Kini arranca en «Sólo mayorista»')
    ev("go('vender');pos.lines=[];pos.cust='';posCart()");pg.wait_for_timeout(350)
    v=pg.inner_text('#view')
    chk(pg.locator('[data-act=wsChan]').count()==0 and 'Cambiar canal' not in v and 'Minorista' not in v,'Vender no ofrece «Cambiar canal» ni menciona el canal minorista')
    chk('Venta mayorista' in pg.inner_text('#wsbar') and 'CUIT' not in pg.inner_text('#wsbar'),'la barra dice «Venta mayorista» y no exige CUIT para vender')
    chk(pg.locator('.pchips [data-act=wsAddPres][data-id="k-cer-lata"]').count()==3,'cada producto muestra sus precios mayoristas (Display, Fardo, Pallet) sin elegir cliente')
    ev("A.wsChan()");chk(ev("wsChan()")=='mayorista','aunque se fuerce, el canal no cambia a minorista')
    # precio por unidad y luego el mayorista, sin cliente
    ev("pos.lines=[];pos.cust='';A.padd({dataset:{id:'k-cer-lata'}});lineEdit(0,'qty','5')");pg.wait_for_timeout(150)
    chk(ev("posTotal()")==5*150000,'5 latas sueltas: precio por unidad (5 × $ 1.500)')
    ev("lineEdit(0,'qty','6')");pg.wait_for_timeout(150)
    chk(ev("posTotal()")==6*140000,'6 latas = 1 Display: precio mayorista del Display (6 × $ 1.400)')
    ev("lineEdit(0,'qty','26')");pg.wait_for_timeout(150)
    chk(ev("posTotal()")==24*130000+2*150000,'26 latas: 1 Fardo a $ 1.300 + 2 sueltas a $ 1.500 = $ 34.200')
    r=ev("(()=>{const r=commitSale('efectivo',false,'local',pos.lines,{custId:'',ws:{chan:wsChan()}});return r.err||{t:r.sale.total,w:r.sale.wch}})()")
    chk(isinstance(r,dict) and r['t']==3420000 and r['w']=='mayorista','se cobra sin cliente identificado y queda como venta mayorista (%s)'%r)
    # cuenta corriente sigue pidiendo cliente
    ev("pos.lines=[];pos.cust='';A.padd({dataset:{id:'k-yerba'}})")
    e=ev("commitSale('fiado',false,'local',pos.lines,{custId:'',ws:{chan:wsChan()}}).err||''")
    chk(bool(e),'cuenta corriente sin cliente: no se permite (%s)'%e[:60])
    # cliente nuevo sin CUIT ni canal
    ev("go('clientes');A.cuEdit({dataset:{id:''}})");pg.wait_for_timeout(300)
    chk(not pg.locator('#wc-ch').is_visible() and '(opcional)' in pg.inner_text('#modal-root'),'el alta de cliente no pregunta el canal y el CUIT es opcional')
    pg.fill('#cu-n','Kiosco Sin CUIT');pg.fill('#cu-w','387 4999000');last_ok()
    c=ev("S.customers.find(c=>c.name==='Kiosco Sin CUIT')")
    chk(c and c['channel']=='mayorista','se guarda como cliente mayorista sin CUIT')
    ev("document.querySelectorAll('#modal-root .ov').forEach(x=>x.remove())")
    ev("go('clientes')");pg.wait_for_timeout(250)
    chk('minorista' not in pg.inner_text('#view').lower(),'la lista de clientes no muestra «minorista»')
    # arqueo sin separación minorista/mayorista
    ev("go('arqueo')");pg.wait_for_timeout(350)
    chk('Minorista' not in pg.inner_text('#view'),'el arqueo no separa minorista/mayorista (todo es mayorista)')
    # configuración: se puede apagar
    ev("go('config')");pg.wait_for_timeout(300)
    chk(pg.locator('#ws-only').count()==1 and pg.locator('#ws-only').is_checked(),'Configuración → Mayorista muestra «Sólo mayorista (distribuidora)» activado')
    # migración: quien ya abrió la demo antes queda en sólo mayorista
    ev("S.cfg.wholesale.only=false;delete S.cfg.kiniOnlyV;S.customers[4].channel='minorista';save()")
    pg.reload();pg.wait_for_timeout(1000)
    chk(ev("S.cfg.wholesale.only===true") and ev("S.customers.every(c=>c.channel==='mayorista')"),'la demo ya abierta antes pasa sola a «Sólo mayorista»')
    # raveV2 no cambia
    login('/tmp/rave/index.html')
    ev("go('vender');pos.lines=[];pos.cust='';posCart()");pg.wait_for_timeout(300)
    chk(not ev("wsOnly()") and pg.locator('[data-act=wsChan]').count()==1,'raveV2 (almacén) conserva el canal minorista/mayorista y «Cambiar canal»')
    b.close()
print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
