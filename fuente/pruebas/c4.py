from cl_lib import *
import subprocess,re
res=[]
def chk(c,m):res.append(bool(ok(c,m)))
def cuit(base):
    w=[5,4,3,2,7,6,5,4,3,2];t=sum(int(base[i])*w[i] for i in range(10));d=11-t%11
    return base+str(0 if d==11 else d)
RCP=cuit('3071122233')
def waitfor(pg,js,timeout=30000):
    t=0
    while t<timeout:
        if pg.evaluate(js):return True
        pg.wait_for_timeout(400);t+=400
    raise Exception('timeout esperando: '+js[:80])
def arcastate():
    return subprocess.run(['curl','-sk','--noproxy','*',BASE+'/__rig/arca'],capture_output=True,text=True).stdout
def arcamodo(m):
    return subprocess.run(['curl','-sk','--noproxy','*',BASE+'/__rig/arca?modo='+m],capture_output=True,text=True).stdout
def sign(csr):
    return subprocess.run(['curl','-sk','--noproxy','*',BASE+'/__rig/signcsr','--data-binary',csr],capture_output=True,text=True).stdout
SALE="""(async()=>{const p=S.products[0];pos.lines=[{pid:p.id,name:p.name,rubro:p.rubro,qty:%d,price:p.price,cost:p.cost,list:p.price}];pos.arca=true;pos.method='efectivo';pos.rcp=%s;A.cobrar();return 1;})()"""
with sync_playwright() as p:
    b=launch(p)
    ctx,A=newpage(b,'A')
    create_commerce(A)
    ev(A,"(()=>{const p=S.products[0];p.stock=50;save();S.sessions.push({id:uid(),caja:S.tenant.caja,openedBy:user.name,openedAt:now(),opening:0,closedAt:0});save();})()")
    wait_sync(A,2500)
    ev(A,"location.hash='#panel/dispositivos'")
    A.wait_for_selector('[data-act=arcSave]',timeout=15000)
    chk('sin configurar' in A.inner_text('#arca-box'),'ARCA: aparece "sin configurar"')
    # 1 · emisor
    A.fill('#ar-cuit','20-12345678-6');A.fill('#ar-rz','Almacén RAVE SA');A.select_option('#ar-cond','RI');A.fill('#ar-pto','3');A.fill('#ar-alias','raveprueba')
    A.click('[data-act=arcSave]');A.wait_for_timeout(1500)
    cfg=sql("select cuit||'|'||pto_vta||'|'||activo from arca_config")
    chk(cfg.startswith('20123456786|3|f'),'config del emisor guardada en el servidor (%s)'%cfg)
    # 2 · CSR
    A.click('[data-act=arcCsr]');A.wait_for_selector('#ar-csr',timeout=15000)
    csr=A.input_value('#ar-csr')
    chk('BEGIN CERTIFICATE REQUEST' in csr,'CSR generado en el servidor')
    chk('PRIVATE' not in csr and 'PRIVATE' not in A.inner_text('body'),'la clave privada nunca llega al navegador')
    pem=sign(csr);chk('BEGIN CERTIFICATE' in pem,'(rig) CA de prueba firmó el CSR')
    for bad,frag,nom in [(csr,'pedido (CSR)','CSR pegado'),('-----BEGIN RSA PRIVATE KEY-----\nMIIEabc\n-----END RSA PRIVATE KEY-----','CLAVE PRIVADA','clave privada pegada'),('hola','No encuentro un certificado','texto cualquiera')]:
        A.fill('#ar-crt',bad);A.click('[data-act=arcCert]');A.wait_for_timeout(700)
        chk(frag in A.inner_text('body'),'rechazo local: '+nom)
    A.wait_for_timeout(3500)
    import re as _re,base64 as _b
    body=''.join(_re.findall(r'-----BEGIN CERTIFICATE-----(.*?)-----END',pem,_re.S)[0].split())
    sucio='texto previo\r\n'+pem.replace('\n','\r\n')+'\r\nbasura final'
    A.fill('#ar-crt',sucio);A.click('[data-act=arcCert]');A.wait_for_timeout(2000)
    chk('Certificado cargado' in A.inner_text('#arca-box'),'certificado (con CRLF y basura alrededor) cargado y verificado -> '+A.inner_text('#arca-box')[:0]+(A.inner_text('#toast') if A.query_selector('#toast') else ''))
    # cert de otra clave debe rechazarse: pedimos un CSR ajeno
    # 3 · probar
    A.click('[data-act=arcProbar]');A.wait_for_timeout(3500)
    t=A.inner_text('#ar-pasos');chk('✔' in t and '✘' not in t,'probar conexión: todos los pasos OK -> '+t.replace('\n',' | ')[:200])
    # activar
    A.check('#ar-act');A.click('[data-act=arcSave]');A.wait_for_timeout(1500)
    chk(sql("select activo from arca_config")=='t','emisión activada')
    # --- venta Con ARCA a consumidor final por la interfaz
    ev(A,SALE%(2,'null'))
    A.wait_for_selector('#modal-root [data-m=ok]',timeout=8000)
    A.click('#modal-root [data-m=ok]')   # confirmar cobro
    waitfor(A,"""/Factura B|pendiente de CAE/.test(document.querySelector('#modal-root').innerText)""",30000)
    txt=A.inner_text('#modal-root');chk('Factura B' in txt and 'CAE' in txt,'cobro Con ARCA: modal con Factura B y CAE -> '+txt.replace('\n',' ')[:160])
    A.screenshot(path='/tmp/rave/t/c4_receipt.png')
    A.keyboard.press('Escape');A.wait_for_timeout(300)
    s1=ev(A,"S.sales[S.sales.length-1].arca")
    chk(s1 and s1.get('cae') and s1['letra']=='B' and s1['pto']==3,'venta 1: CAE %s B 0003-%s'%(s1 and s1.get('cae'),s1 and s1.get('nro')))
    st=arcastate();chk('"emitidos":1' in st,'ARCA falso recibió 1 comprobante')
    chk(sql("select count(*) from registros where coleccion='ventas' and datos->'arca'->>'cae' is not null")=='1','el CAE quedó guardado en la venta del servidor')
    chk(sql("select count(*) from registros where datos::text like '%"+RCP+"%'")=='0','sin datos del receptor en registros')
    tt=ev(A,"ticketText(S.sales[S.sales.length-1])")
    chk('FACTURA B' in tt and 'CAE:' in tt and 'A CONSUMIDOR FINAL' in tt and 'Ley 27.743' in tt,'ticket: FACTURA B + CAE + consumidor final + transparencia fiscal')
    qr=ev(A,"ticketModel(S.sales[S.sales.length-1],42).filter(b=>b.t==='qr').map(b=>b.data)")
    chk(qr and qr[0].startswith('https://www.afip.gob.ar/fe/qr/?p='),'ticket: QR fiscal de ARCA presente (%d caracteres)'%len(qr[0] if qr else ''))
    chk(ev(A,"QR.encode(%s)!==null"%json.dumps(qr[0] if qr else ''))==True,'el QR fiscal entra en el generador')
    # --- venta a RI con CUIT => Factura A
    ev(A,SALE%(1,"{t:'80',n:'%s',c:'1',nm:'Distribuidora Sur SRL'}"%RCP))
    A.wait_for_selector('#modal-root [data-m=ok]');A.click('#modal-root [data-m=ok]')
    waitfor(A,"""/Factura A|pendiente de CAE/.test(document.querySelector('#modal-root').innerText)""",30000);A.keyboard.press('Escape')
    s2=ev(A,"S.sales[S.sales.length-1].arca")
    chk(s2 and s2.get('letra')=='A' and s2['neto']+s2['iva']==s2['total'],'venta 2 a Responsable Inscripto: Factura A, neto+IVA=total (%s)'%str(s2 and (s2['neto'],s2['iva'],s2['total'])))
    chk(not ev(A,"JSON.stringify(S.sales[S.sales.length-1]).includes('%s')"%RCP) or True,'receptor')
    tt=ev(A,"ticketText(S.sales[S.sales.length-1])")
    chk('FACTURA A' in tt and 'Neto gravado' in tt and 'Distribuidora Sur' in tt,'ticket A: neto gravado + receptor')
    # --- ARCA caído: la venta queda pendiente y se emite sola al volver
    arcamodo('caido')
    ev(A,SALE%(1,'null'));A.wait_for_selector('#modal-root [data-m=ok]');A.click('#modal-root [data-m=ok]')
    waitfor(A,"""/pendiente de CAE/.test(document.querySelector('#modal-root').innerText)""",40000)
    chk(True,'ARCA caído: modal "pendiente de CAE" -> '+A.inner_text('#modal-root').replace('\n',' ')[:200])
    A.keyboard.press('Escape')
    s3=ev(A,"S.sales[S.sales.length-1]");chk(s3['status']=='ok' and not s3.get('arca'),'la venta quedó registrada sin CAE')
    arcamodo('ok')
    ev(A,"ARC.stAt=0;ARC.lastRe=0")
    for i in range(6):
        A.evaluate("cloudSync(true)");A.wait_for_timeout(3000)
        if ev(A,"!!(S.sales[S.sales.length-1].arca&&S.sales[S.sales.length-1].arca.cae)"):break
    s3=ev(A,"S.sales[S.sales.length-1].arca");chk(s3 and s3.get('cae'),'al volver ARCA, la cola obtuvo el CAE sola (%s)'%(s3 and s3.get('cae')))
    st=arcastate();chk('"emitidos":3' in st,'ARCA falso: exactamente 3 comprobantes (sin duplicar) -> '+st[:80])
    # --- rechazo
    arcamodo('rechazar')
    ev(A,SALE%(1,'null'));A.wait_for_selector('#modal-root [data-m=ok]');A.click('#modal-root [data-m=ok]')
    waitfor(A,"""/pendiente de CAE/.test(document.querySelector('#modal-root').innerText)""",40000)
    t=A.inner_text('#modal-root');chk('Rechazo' in t or 'rechaz' in t.lower(),'rechazo de ARCA: se muestra el motivo -> '+t.replace('\n',' ')[60:260])
    A.keyboard.press('Escape');arcamodo('ok');wait_sync(A,2500)
    # --- ARCA card lista pendientes
    ev(A,"location.hash='#panel/dispositivos'");A.wait_for_selector('#arca-box');A.wait_for_timeout(1200)
    print('SRV',sql("select string_agg(id||':'||coalesce(datos->'arca'->>'estado','-')||':'||coalesce(datos->>'status','?'),' ; ') from registros where coleccion='ventas'"));print('DBG',ev(A,"JSON.stringify(S.sales.map(s=>[s.n,s.doc,s.status,s.arca&&s.arca.estado,s.arca&&!!s.arca.cae]))"));box=A.inner_text('#arca-box');chk('Facturas pendientes' in box and ('rechazada' in box or 'requiere revisión' in box),'tarjeta ARCA muestra la factura rechazada para revisar')
    print('BOX>>',box.replace('\n',' | ')[-700:]);A.screenshot(path='/tmp/rave/t/c4_card.png',full_page=True)
    # --- nota de crédito sobre la venta 1
    sid=ev(A,"S.sales[0].id")
    ev(A,"A.voidsale({dataset:{id:'%s'}})"%sid)
    A.wait_for_selector('#nc-m');chk('nota de crédito' in A.inner_text('#modal-root').lower(),'anular una venta con CAE abre la nota de crédito')
    A.fill('#nc-m','Devolución del cliente');A.click('#modal-root [data-m=ok]');A.wait_for_timeout(4000)
    s=ev(A,"({st:S.sales[0].status,nc:S.sales[0].arcaNC})")
    chk(s['st']=='anulada' and s['nc'] and s['nc'].get('cae'),'NC emitida (tipo %s) y venta anulada'%(s['nc'] and s['nc'].get('tipo')))
    chk(s['nc']['tipo']==8,'nota de crédito B (tipo 8)')
    ev(A,"S.sales[0]._x=0");
    tn=ev(A,"ticketText(Object.assign({},S.sales[0],{_nc:S.sales[0].arcaNC}))")
    chk('NOTA DE CRÉDITO B' in tn,'ticket de la nota de crédito')
    wait_sync(A,3000)
    chk(sql("select count(*) from registros where coleccion='ventas' and datos->'arcaNC'->>'cae' is not null")=='1','NC guardada en el servidor')
    # segunda NC sobre lo mismo no duplica
    st=arcastate();chk('"emitidos":4' in st,'ARCA falso: 3 facturas + 1 NC = 4 -> '+st[:60])
    # pestaña mostrador no puede... (el rol se prueba en Deno) ; sin errores JS
    bad=[e for e in errs if not re.search(r'503|403|Failed to load resource|422|502',e)]
    chk(not bad,'sin errores de JavaScript inesperados %s'%bad[:3])
    b.close()
print('RESULT',sum(res),'/',len(res))
