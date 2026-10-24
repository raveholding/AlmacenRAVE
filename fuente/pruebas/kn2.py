# Demo Kini (V26.24): mayorista de UN SOLO DUEÑO de punta a punta, como lo prueba un cliente mayorista.
# Catálogo de distribuidora (sin rubros de personas), tipo de negocio bloqueado, ventas minoristas y mayoristas por presentación,
# cuenta corriente y cobranza, combo, egresos sin rubro, traspasos, compras y pago a proveedor, cierre de caja del dueño,
# alta de cliente mayorista sin datos del Club, permisos, vaciar/restaurar y 360 px. Además: ninguna pantalla ni ventana dice «rubro».
import re
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
BAD=re.compile(r'\brubros?\b|reparto|reparte|sociedad de|merienda|\bRAVE\b|licorer',re.I)
SCREENS=['inicio','vender','pedidos','caja','cajasx','arqueo','cierres','inventario','proveedores','clientes','fidel','cupones','personal','tareas','menuadmin','legal','nube','dispositivos','impex','integ','roles','auditoria','config']
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    ctx=b.new_context(viewport={'width':1280,'height':900});pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    def last_ok():
        pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(350)
    def close_modals(): ev("document.querySelectorAll('#modal-root .ov').forEach(x=>x.remove())")
    def bad_in(txt): return sorted(set(m.group(0).lower() for m in BAD.finditer(txt)))
    pg.goto('file:///tmp/rave/kini.html#acceso');pg.wait_for_timeout(1000)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(600)
    # ---------- 1. un solo dueño, sin rubros de personas ----------
    chk(ev("S.cfg.biz")=='owner' and ev("!!S.cfg.bizLocked"),'arranca como mayorista de un solo dueño, con el tipo de negocio bloqueado')
    cats=ev("S.rubros.filter(r=>r.kind==='rubro').map(r=>r.name)")
    chk(cats==['Bebidas sin alcohol','Cervezas','Vinos y aperitivos','Almacén','Golosinas y snacks','Limpieza','Packs y combos'],'categorías de una distribuidora: %s'%cats)
    chk(ev("S.rubros.every(r=>!r.owner&&!r.reparte)"),'ninguna categoría tiene responsable ni reparto')
    chk(ev("S.products.every(p=>S.rubros.some(r=>r.id===p.rubro&&r.kind==='rubro'))") and ev("!S.products.some(p=>/fernet branca|gin |tabaco|cigarr/i.test(p.name))"),'el catálogo es de la distribuidora (sin productos ni rubros del almacén)')
    chk(ev("S.products.filter(p=>p.pres&&p.pres.length).length")>=25,'casi todos los artículos tienen precios por presentación (display / fardo / pallet)')
    chk(ev("JSON.stringify(S.cfg.tax)")=='{}' and ev("S.puestos[0].name")=='Dueño','sin impuestos por persona; el organigrama tiene un solo dueño')
    # ninguna pantalla habla de rubros
    found={}
    for sc in SCREENS:
        ev(f"go('{sc}')");pg.wait_for_timeout(260)
        t=pg.inner_text('#view');bi=bad_in(t)
        if bi: found[sc]=bi
    ev("taskTab='org';go('tareas')");pg.wait_for_timeout(250);bi=bad_in(pg.inner_text('#view'))
    if bi: found['organigrama']=bi
    chk(not found,'ninguna pantalla menciona rubros, reparto, socios de una sociedad ni el almacén: %s'%found)
    # Configuración: el tipo de negocio no se cambia
    ev("go('config')");pg.wait_for_timeout(300)
    chk(pg.locator('input[name=biz]').count()==0 and pg.locator('[data-act=bizSave]').count()==0,'Configuración no ofrece pasar a «almacén con rubros»')
    ev("A.bizSave()");chk(ev("S.cfg.biz")=='owner','aunque se fuerce, el tipo de negocio sigue siendo de un solo dueño')
    ev("go('inicio')");pg.wait_for_timeout(250)
    chk(pg.locator('#view [data-act=nav][data-id=config]').count()==0 and 'un solo dueño' in pg.inner_text('#view'),'el Resumen dice qué es la demo y no ofrece cambiar el tipo de negocio')
    # ventanas que antes pedían rubro
    modals={'ingreso':"A.mov({dataset:{type:'ingreso'}})",'egreso':"A.mov({dataset:{type:'egreso'}})",'producto':"A.pedit({dataset:{id:'k-gas-cola'}})",'nuevo producto':"A.pedit({dataset:{id:''}})",
            'cliente nuevo':"A.cuEdit({dataset:{id:''}})",'ficha mayorista':"A.cuEdit({dataset:{id:'kc1'}})",'cobro cta. cte.':"A.cuPay({dataset:{id:'kc1'}})",'traspaso':"go('cajasx');A.xfer&&A.xfer({dataset:{}})"}
    mfound={}
    for k,js in modals.items():
        close_modals();ev("go('caja')");pg.wait_for_timeout(200)
        try:
            ev(js);pg.wait_for_timeout(300)
            t=pg.inner_text('#modal-root') if pg.locator('#modal-root .ov').count() else ''
            bi=bad_in(t)
            if bi: mfound[k]=bi
        except Exception as e: mfound[k]='error '+str(e)[:80]
    close_modals()
    chk(not mfound,'las ventanas de ingreso, egreso, producto, cliente, cobro y traspaso no piden ni nombran rubros: %s'%mfound)
    # ---------- 2. vender minorista ----------
    st=lambda pid: ev("prod('%s').stock"%pid)
    g0=st('k-gas-cola')
    r=ev("(()=>{pos.lines=[];pos.cust='';pos.chanSet=null;A.padd({dataset:{id:'k-gas-cola'}});A.padd({dataset:{id:'k-gas-cola'}});const r=commitSale('efectivo',false,'local',pos.lines,{custId:''});return r.err||r.sale.total})()")
    chk(r==580000 and st('k-gas-cola')==g0-2,'venta minorista: 2 gaseosas a $ 2.900 = $ 5.800 y el stock baja 2 (%s)'%r)
    # ---------- 3. vender mayorista por presentación a cuenta corriente ----------
    c0=st('k-cer-lata');d0=ev("debtOf('kc1')")
    ev("go('vender');pos.lines=[];pos.cust='kc1';pos.chanSet=null;posCart();A.wsAddPres({dataset:{id:'k-cer-lata',lv:'f'}})");pg.wait_for_timeout(150)
    ev("A.padd({dataset:{id:'k-cer-lata'}});A.padd({dataset:{id:'k-cer-lata'}});posCart()");pg.wait_for_timeout(150)
    lines=ev("pos.lines.map(l=>({q:l.qty,p:l.price,r:l.rule||''}))")
    tot=ev("posTotal()")
    chk(tot==24*130000+2*150000,'1 fardo de cerveza (24 × $ 1.300) + 2 sueltas ($ 1.500) = $ 34.200 por tramos: %s'%lines)
    r=ev("(()=>{const r=commitSale('fiado',false,'local',pos.lines,{custId:'kc1',ws:{chan:'mayorista'}});return r.err?{err:r.err}:{t:r.sale.total,w:r.sale.wch,due:!!r.sale.due,rules:r.sale.items.map(i=>i.lr+':'+i.qty)}})()")
    chk(isinstance(r,dict) and r.get('t')==3420000 and r.get('w')=='mayorista' and r.get('due'),'la venta mayorista va a la cuenta corriente del kiosco con vencimiento por su plazo (%s)'%r)
    chk(st('k-cer-lata')==c0-26 and ev("debtOf('kc1')")==d0+3420000,'stock −26 latas y la deuda del cliente sube $ 34.200')
    # cliente mayorista sin CUIT no compra como mayorista: precio de lista
    # ---------- 4. combo ----------
    f0,gc0,cl0=st('k-fernet'),st('k-gas-cola'),st('k-cer-lata')
    r=ev("(()=>{pos.lines=[];pos.cust='';pos.chanSet=null;A.padd({dataset:{id:'k-combo-fiesta'}});const r=commitSale('transferencia',false,'local',pos.lines,{custId:''});return r.err||r.sale.total})()")
    chk(r==2650000 and st('k-fernet')==f0-1 and st('k-gas-cola')==gc0-2 and st('k-cer-lata')==cl0-6,'el Pack fiesta descuenta 6 cervezas, 1 fernet y 2 gaseosas (%s)'%r)
    # ---------- 5. cobranza ----------
    e=ev("fiadoPay('kc1',2000000,'efectivo')")
    chk(e=='' or e is None,'cobro de $ 20.000 en efectivo a cuenta del kiosco (%s)'%e)
    chk(ev("debtOf('kc1')")==d0+1420000,'la deuda baja a lo que falta')
    # ---------- 6. egreso sin rubro y traspaso ----------
    ev("go('caja')");pg.wait_for_timeout(250);pg.click('[data-act=mov][data-type=egreso]');pg.wait_for_timeout(200)
    chk(pg.locator('#mv-r').count()==0,'el egreso no pide rubro')
    pg.fill('#mv-c','Flete de entrega');pg.fill('#mv-a','8000');last_ok()
    mv=ev("S.movs[S.movs.length-1]")
    chk(mv['concept']=='Flete de entrega' and mv['amount']==800000 and mv['rubro']=='sys-gen','el egreso queda como dinero del negocio')
    e=ev("xferCreate({id:'kn2t1',from:'r1',to:'rp',amount:5000000,rubro:'',motivo:'retiro a la caja principal'})")
    chk(e=='','traspaso de $ 50.000 de Caja 1 a la principal sin rubro (%s)'%e)
    ev("go('cajasx')");pg.wait_for_timeout(300)
    chk(not bad_in(pg.inner_text('#view')),'el registro de traspasos no tiene columna ni filtro de rubro')
    ev("A.xferView({dataset:{id:'kn2t1'}})");pg.wait_for_timeout(250)
    chk('Rubro' not in pg.inner_text('#modal-root') and 'Caja principal' in pg.inner_text('#modal-root'),'la boleta del traspaso no muestra rubro');close_modals()
    # ---------- 7. compras ----------
    oc=ev("S.pOrders.find(o=>o.estado==='Solicitada')")
    l0=st('k-cer-negra')
    r=ev("(async()=>{const o=S.pOrders.find(o=>o.estado==='Solicitada');try{const r=await CMP.recibir({idempotency_key:'kn2-rec-1',proveedor_id:o.provId||o.proveedor_id,orden_compra_id:o.id,tipo_comprobante:'Remito',nro_comprobante:'R-99001',condicion_pago:'credito',items:(o.items||[]).map(i=>({producto_id:i.pid||i.producto_id,cantidad:i.qty||i.cantidad,precio_costo:(i.cost||i.costo||100000)/100}))});return r.ok?'ok':'x'}catch(e){return 'ERR '+e.message}})()")
    chk(r=='ok' and st('k-cer-negra')>l0,'se recibe la orden de compra pendiente y suma stock (%s)'%r)
    prov=ev("S.suppliers[0].id");s0=ev("S.suppliers[0].saldo")
    ev("go('proveedores')");pg.wait_for_timeout(300);ev("A.cmpPay({dataset:{id:'%s'}})"%prov);pg.wait_for_timeout(300)
    chk(pg.locator('#pg-r').count()==0 and not bad_in(pg.inner_text('#modal-root')),'el pago al proveedor no pide rubro')
    pg.fill('#pg-m','30000');pg.select_option('#pg-t','k-sp');last_ok();pg.wait_for_timeout(300)
    chk(ev("S.suppliers[0].saldo")==s0-3000000,'el dueño paga $ 30.000 al proveedor desde la caja principal')
    # ---------- 8. cliente mayorista nuevo, sin Club ----------
    ev("go('clientes')");pg.wait_for_timeout(250);ev("A.cuEdit({dataset:{id:''}})");pg.wait_for_timeout(300)
    chk(pg.locator('#wc-tx').count()==1 and not pg.locator('#cu-c1').is_checked(),'el alta de cliente pide CUIT y plazo y el Club viene destildado')
    pg.fill('#cu-n','Despensa San Martín');pg.fill('#cu-w','387 4111222');pg.fill('#wc-tx','30709998885');pg.fill('#wc-tm','15');pg.fill('#cu-lim','400000')
    last_ok()
    c=ev("S.customers.find(c=>c.name==='Despensa San Martín')")
    chk(c and c['channel']=='mayorista' and c['taxid']=='30709998885' and c['term']==15 and c['limit']==40000000 and c['consent']['club']==False,'se crea como cliente mayorista con CUIT, plazo y límite, sin fecha de nacimiento ni Club')
    close_modals()
    r=ev("(()=>{const c=S.customers.find(c=>c.name==='Despensa San Martín');pos.lines=[];pos.cust=c.id;pos.chanSet=null;A.wsAddPres({dataset:{id:'k-yerba',lv:'f'}});const r=commitSale('fiado',false,'local',pos.lines,{custId:c.id,ws:{chan:'mayorista'}});return r.err||r.sale.total})()")
    chk(r==3900000,'y ya puede comprar 1 fardo de yerba (10 × $ 3.900) a cuenta corriente (%s)'%r)
    # ---------- 9. cierre de caja del dueño ----------
    ev("go('arqueo')");pg.wait_for_timeout(400)
    v=pg.inner_text('#view')
    chk('Minorista' in v and 'Mayorista' in v and pg.locator('#aq-emp').count()==0 and not bad_in(v),'arqueo del dueño: ventas por canal, sin sueldo, impuestos ni reparto %s'%bad_in(v))
    exp=ev("(()=>{const s=openSess();return arqueoCalc(s,arqInputs(s)).expectedCash})()")
    pg.fill('#aq-d',str(exp/100).replace('.',','));pg.wait_for_timeout(250)
    txt=pg.inner_text('#arq-prev')
    chk('VENTAS TOTAL' in txt and 'sin diferencia' in txt and not bad_in(txt),'el texto de cierre es del dueño y cierra sin diferencia %s'%str(([x for x in txt.split('\n') if 'CONTADO' in x or 'ESPERADO' in x],bad_in(txt))))
    pg.click('[data-act=arqClose]');pg.wait_for_timeout(200);last_ok()
    k=ev("S.closures[S.closures.length-1]")
    chk(k['data']['owner']==True and ev("verifyClosure(S.closures[S.closures.length-1])"),'la Caja 1 queda cerrada y sellada como cierre del dueño')
    chk(ev("S.sessions.filter(s=>!s.closedAt).length")==2,'Caja 2 y la principal siguen abiertas')
    # ---------- 10. permisos sólo del administrador ----------
    ev("user=S.users.find(u=>u.role==='supervisor');go('roles')");pg.wait_for_timeout(300)
    chk(pg.locator('#view input[type=checkbox]:not([disabled])').count()==0,'el supervisor ve los permisos pero no puede cambiarlos')
    ev("user=S.users.find(u=>u.role==='admin');go('inicio')");pg.wait_for_timeout(250)
    # ---------- 11. menú público ----------
    ev("go('menuadmin')");pg.wait_for_timeout(300)
    secs=ev("menuSecs(false).map(r=>r.mNom)")
    chk('Bebidas' in secs and 'Cervezas' in secs and 'Almacén' in secs,'el menú público muestra las categorías de la distribuidora: %s'%secs)
    # ---------- 12. 360 px ----------
    pg.set_viewport_size({'width':360,'height':800});bad=[]
    for sc in ['inicio','vender','caja','cajasx','arqueo','inventario','proveedores','clientes','config']:
        ev(f"go('{sc}')");pg.wait_for_timeout(250)
        if ev("document.documentElement.scrollWidth")>362: bad.append(sc)
    chk(not bad,'360 px sin desbordes: %s'%bad)
    pg.set_viewport_size({'width':1280,'height':900})
    # ---------- 13. vaciar y volver ----------
    ev("go('config')");pg.wait_for_timeout(300);pg.click('[data-act=emptyDemo]');pg.wait_for_timeout(200);last_ok()
    chk(ev("S.products.length")==0 and ev("S.cfg.biz")=='owner' and ev("S.rubros.filter(r=>r.kind==='rubro').map(r=>r.name)")==['General'],'vacía: sin datos, sigue siendo de un solo dueño, con una sola categoría «General»')
    ev("go('config')");pg.wait_for_timeout(300);pg.click('[data-act=resetDemo]');pg.wait_for_timeout(200);last_ok();pg.wait_for_timeout(900)
    chk(ev("S.products.length")>=29 and ev("S.suppliers.length")==3 and ev("S.customers.length")==5,'«Volver a los datos de ejemplo» recupera el catálogo, proveedores y clientes de la distribuidora')
    chk(ev("S.sales.filter(s=>s.demo&&s.wch==='mayorista').length")>0 and ev("S.sales.filter(s=>s.demo).every(s=>s.items.every(i=>prod(i.pid)))"),'el historial de ejemplo usa sólo artículos de la distribuidora e incluye ventas mayoristas')
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
