# V26.76 · Gestión integral Etapa B en Kini: Panel de Módulos, ticket en espera, historial/etiquetas/actualización masiva de precios,
# lista del proveedor, verificador de góndola y vales del personal. Números conocidos calculados por separado.
from playwright.sync_api import sync_playwright
import subprocess,re
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
def login(pg,pin,idx=0):
    pg.goto('file:///tmp/rave/kini.html#acceso');pg.wait_for_timeout(900)
    opts=pg.evaluate("[...document.querySelectorAll('#lu option')].map(o=>o.textContent)")
    if isinstance(idx,str): idx=[i for i,o in enumerate(opts) if idx in o][0]
    pg.select_option('#lu',index=idx);pg.fill('#lp',pin);pg.click('[data-act=login]');pg.wait_for_timeout(500)
def ok_modal(pg):
    pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(300)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    ctx=b.new_context(viewport={'width':1280,'height':900});pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    pg.on('dialog',lambda d:d.dismiss())
    ev=pg.evaluate
    pg.add_init_script("try{localStorage.setItem('rave.ux.config','all')}catch(e){};window.open=function(){return{document:{write(){},close(){}},print(){},close(){}}}")
    login(pg,'1234')
    # --- datos de ejemplo y panel ---
    chk(ev("['pos_hold','price_hist','price_bulk','kiosk','hr_vales'].every(k=>giOn(k))") and ev("giPlan()")=='total','demo: los 5 módulos nuevos activos y plan VB Total')
    chk(ev("giHolds().length")==3,'demo: 3 tickets en espera de ejemplo')
    chk(ev("giLog().length")==32 and ev("giLblPending().length")==4,'demo: historial de 60 días (8 artículos × 4 cambios) y 4 etiquetas pendientes')
    chk(ev("giVales().length")==3,'demo: 3 vales de ejemplo')
    ev("go('modulos')");pg.wait_for_timeout(300)
    chk(pg.locator('[data-mod]').count()==ev("GI_MODS.length")==15 and 'En desarrollo' not in pg.inner_text('#view'),'Módulos: las 15 funciones activables y nada pendiente «en desarrollo»')
    # dependencia: apagar historial apaga también la actualización masiva
    pg.click('[data-act=giMod][data-k=price_hist]');pg.wait_for_timeout(200);ok_modal(pg)
    chk(not ev("giOn('price_hist')") and not ev("giOn('price_bulk')"),'apagar «Historial» apaga también «Actualización masiva» (depende de él)')
    chk(ev("S.audit.slice(-1)[0].action")=='MODULO_DESACTIVADO','el cambio de módulo queda en Auditoría')
    pg.click('[data-act=giMod][data-k=price_bulk]');pg.wait_for_timeout(200);ok_modal(pg)
    chk(ev("giOn('price_hist')") and ev("giOn('price_bulk')"),'activar «Actualización masiva» activa su dependencia')
    ev("S.cfg.plan='esencial';save()")
    chk(not ev("giOn('hr_vales')") and ev("giSetMod('hr_vales',true)")!='','plan Esencial: «Vales» queda con candado y no se puede activar')
    ev("go('vales')");pg.wait_for_timeout(200)
    chk(ev("curScreen")!='vales','con el módulo fuera del plan, la pantalla «Vales» no abre')
    ev("S.cfg.plan='total';save()")
    # --- ticket en espera: no toca stock, ventas ni caja ---
    st0=ev("JSON.stringify(S.products.map(p=>p.stock))");s0=ev("S.sales.length");m0=ev("S.movs.length")
    ev("go('vender');pos.lines=[];pos.cust='';pos.chanSet=null;A.padd({dataset:{id:'k-gas-cola'}});A.padd({dataset:{id:'k-gas-cola'}});A.padd({dataset:{id:'k-yerba'}});posCart()")
    pg.wait_for_timeout(200)
    chk(pg.locator('#gi-hold [data-act=giHold]').count()==1,'Vender muestra «Poner en espera»')
    tot=ev("posTotal()")
    pg.keyboard.press('Alt+e');pg.wait_for_timeout(300)
    h=ev("giHolds().slice(-1)[0]")
    chk(ev("pos.lines.length")==0 and h['total']==tot and len(h['lines'])==2,'Alt + E deja el ticket en espera con su total (%s) y libera Vender'%tot)
    chk(ev("JSON.stringify(S.products.map(p=>p.stock))")==st0 and ev("S.sales.length")==s0 and ev("S.movs.length")==m0,'en espera no descuenta stock, no crea venta ni mueve caja')
    # mientras espera, sube el precio de la yerba: al retomar se actualiza (precio de lista sin tocar)
    ev("(()=>{const p=prod('k-yerba');p.price=p.price+10000;save()})()")
    ev("A.padd({dataset:{id:'k-gas-cola'}})")
    r=ev("giHoldTake(giHolds().slice(-1)[0].id)")
    chk(r['upd']==1 and r['swapped'] is not None,'al retomar: actualiza 1 precio que cambió y deja en espera lo que había en Vender')
    chk(ev("pos.lines.find(l=>l.pid==='k-yerba').price")==ev("prod('k-yerba').price"),'la yerba retomada lleva el precio nuevo')
    rs=ev("(()=>{const r=commitSale('efectivo',false,'local',pos.lines,{custId:''});return r.err||r.sale.total})()")
    chk(isinstance(rs,int) and ev("S.sales.length")==s0+1,'el ticket retomado se cobra normalmente (venta %s)'%rs)
    ev("go('arqueo')");pg.wait_for_timeout(300)
    chk(pg.locator('#gi-holdw').count()==1,'Caja/Arqueo avisa que hay tickets en espera antes de cerrar')
    # --- historial de precios ---
    n0=ev("giLog().length")
    ev("go('inventario')");pg.wait_for_timeout(300);ev("(()=>{const p=prod('k-gas-cola');p.price=p.price+5000;save()})()")
    e=ev("giLog().slice(-1)[0]")
    chk(ev("giLog().length")==n0+1 and e['pid']=='k-gas-cola' and e['f']=='price' and e['to']-e['from']==5000 and e['origin']=='Inventario','cambio en Inventario: +$ 50 registrado con origen «Inventario» %s'%e)
    chk(any(x['id']=='k-gas-cola' for x in ev("giLblPending()")),'el artículo pasa a «etiquetas pendientes»')
    ev("go('precios');A.giPTab({dataset:{t:'lbl'}})");pg.wait_for_timeout(200)
    pg.click('[data-act=giLblPrint][data-w=pend]');pg.wait_for_timeout(200);ok_modal(pg)
    chk(ev("giLblPending().length")==0,'al confirmar la impresión, «pendientes» queda vacía')
    chk(ev("giEanOk('7790895000997')") and not ev("giEanOk('7790895000990')"),'dígito verificador EAN-13 bien calculado')
    # --- actualización masiva con números conocidos ---
    rub=ev("prod('k-gas-cola').rubro")
    base=ev("giScope({rubro:'%s'}).map(p=>[p.id,p.price])"%rub)
    plan=ev("giBulkPlan({rubro:'%s',field:'price',mode:'pct',v:10,round:10,pres:false})"%rub)
    import math
    exp={pid:max(1000,math.floor(pr*1.1/1000+0.5)*1000) for pid,pr in base}
    got={x['pid']:[c for c in x['ch'] if c['f']=='price'][0]['to'] for x in plan['rows']}
    chk(all(got.get(k,v0)==exp[k] for k,v0 in base) and len(got)>0,'+10 %% redondeado a $ 10 da lo calculado aparte (%d artículos) %s'%(len(got),[(k,got.get(k),exp[k]) for k,_ in base if got.get(k,exp[k])!=exp[k]]))
    ev("giPlanCur=giBulkPlan({rubro:'%s',field:'price',mode:'pct',v:10,round:10,pres:false});giPlanDesc='prueba'"%rub)
    bb=ev("giBulkApply(giPlanCur,'prueba').b")
    diff=[(k,ev("prod('%s').price"%k),v) for k,v in got.items() if ev("prod('%s').price"%k)!=v]
    chk(not diff,'aplicada: los precios quedan como en la vista previa %s'%diff[:3])
    chk(ev("giLog().filter(e=>e.origin==='Actualización masiva %s').length"%bb['n'])==len(bb['changes']),'cada valor cambiado queda en el historial con el número de la actualización')
    ev("(()=>{const p=prod('%s');p.price=p.price+1000;save()})()"%list(got)[0])
    u=ev("giBulkUndo('%s')"%bb['id'])
    chk(u['skip']==1 and u['ok']==len(bb['changes'])-1,'deshacer restaura todo menos el que se cambió después (%s)'%u)
    chk(all(ev("prod('%s').price"%k)==v for k,v in base if k in got and k!=list(got)[0]),'los precios vuelven a los valores anteriores')
    chk(ev("giBulkUndo('%s').err"%bb['id']) is not None,'no se puede deshacer dos veces')
    chk(ev("giBulkPlan({field:'price',mode:'pct',v:0}).err") is not None and ev("giBulkPlan({field:'price',mode:'pct',v:900}).err") is not None,'rechaza 0 % y porcentajes fuera de rango')
    # --- lista del proveedor ---
    bc=ev("prod('k-gas-cola').barcode");c0=ev("prod('k-gas-cola').cost");p0=ev("prod('k-gas-cola').price")
    lp=ev("giListPlan({txt:'código;artículo;costo\\n%s;Gaseosa;1.850,00\\n0000000000000;No existe;10',colCode:0,colVal:2,target:'cost',keepMargin:true,round:0,header:true})"%bc)
    chg={c['f']:c['to'] for c in lp['rows'][0]['ch']} if lp['rows'] else {}
    chk(chg.get('cost')==185000 and lp['miss']==['0000000000000'],'lista pegada: «1.850,00» = costo $ 1.850 y avisa el código que no existe')
    chk(c0>0 and chg.get('price')==round(185000*p0/c0),'mantiene el margen: precio = costo nuevo × precio/costo anterior')
    # --- verificador de góndola ---
    ev("A.giKioskOpen()");pg.wait_for_timeout(200);ok_modal(pg);pg.wait_for_timeout(400)
    chk(pg.locator('#gi-kiosk').count()==1 and ev("user")==None,'el verificador cierra la sesión del empleado y queda a pantalla completa')
    pg.fill('#gi-kq',bc);pg.keyboard.press('Enter');pg.wait_for_timeout(300)
    kt=pg.inner_text('#gi-kr')
    chk('$' in kt and 'osto' not in kt,'con el código muestra el precio y nunca el costo')
    pg.reload();pg.wait_for_timeout(1000)
    chk(pg.locator('#gi-kiosk').count()==1,'al recargar sigue en modo verificador (no vuelve al ingreso)')
    ev("location.hash='#acceso'");pg.wait_for_timeout(500)
    chk(pg.locator('#gi-kiosk').count()==1 or ev("location.hash")=='#verificador','no se sale cambiando la dirección')
    pg.click('[data-act=giKioskExit]');pg.wait_for_timeout(300)
    pin_in=pg.locator('#modal-root input[type=password]')
    if pin_in.count():
        pin_in.first.fill('0000');ok_modal(pg);pg.wait_for_timeout(300)
        chk(pg.locator('#gi-kiosk').count()==1,'el PIN de mostrador no saca del verificador')
        pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=x]').click();pg.wait_for_timeout(200)
        pg.click('[data-act=giKioskExit]');pg.wait_for_timeout(300);pg.locator('#modal-root input[type=password]').first.fill('1234');ok_modal(pg);pg.wait_for_timeout(500)
    chk(pg.locator('#gi-kiosk').count()==0,'con el PIN del administrador sale del verificador')
    login(pg,'1234')
    # --- vales ---
    emp=ev("(S.employees||[]).find(e=>e.active)")
    pin=emp.get('pin') or ''
    m1=ev("S.movs.length")
    bad=ev("giValeCreate({emp:'%s',tipo:'adelanto',amount:3000000,pin:'%s',paper:%s}).err"%(emp['id'],'999999' if pin else '','false'))
    chk(bad is not None,'sin la confirmación del empleado (PIN o firma) no se entrega el vale')
    v=ev("giValeCreate({emp:'%s',tipo:'adelanto',amount:3000000,pin:'%s',paper:%s,rubro:S.rubros.find(r=>r.kind==='rubro').id})"%(emp['id'],pin,'false' if pin else 'true'))
    mv=ev("S.movs.slice(-1)[0]")
    chk(v.get('v') and ev("S.movs.length")==m1+1 and mv['type']=='egreso' and mv['amount']==3000000,'adelanto de $ 30.000: egreso de $ 30.000 en la caja abierta')
    pv=ev("giValeCreate({emp:'%s',tipo:'prestamo',amount:1000000,cuotas:3,pin:'%s',paper:%s,rubro:S.rubros.find(r=>r.kind==='rubro').id}).v"%(emp['id'],pin,'false' if pin else 'true'))
    chk(pv['cuotaAmt']==333334,'préstamo de $ 10.000 en 3 cuotas: cuota $ 3.333,34')
    ev("giValeDesc('%s')"%pv['id']);ev("giValeDesc('%s')"%pv['id'])
    chk(ev("giValeSaldo(giVales().find(x=>x.id==='%s'))"%pv['id'])==1000000-2*333334,'tras 2 cuotas el saldo es $ 3.333,32')
    chk(ev("giValeDesc('%s',999999).err"%pv['id']) is not None,'no deja descontar más que el saldo')
    ev("giValeDesc('%s')"%pv['id'])
    chk(ev("giVales().find(x=>x.id==='%s').state"%pv['id'])=='saldado','la última cuota salda el préstamo')
    vid=v['v']['id'];m2=ev("S.movs.length")
    chk(ev("giValeVoid('%s','').err"%vid) is not None,'anular exige motivo')
    ev("giValeVoid('%s','error de carga')"%vid)
    mv=ev("S.movs.slice(-1)[0]")
    chk(ev("S.movs.length")==m2+1 and mv['type']=='ingreso' and mv['amount']==3000000 and ev("giVales().find(x=>x.id==='%s').state"%vid)=='anulado','anular el adelanto: el efectivo vuelve como ingreso (no se borra el egreso)')
    # --- permisos: mostrador no ve Módulos ---
    ev("user=null;save()");login(pg,'0000','Mostrador')
    ev("go('modulos')");pg.wait_for_timeout(200)
    chk(ev("curScreen")!='modulos' and ev("giSetMod('kiosk',false)")!='','el rol Mostrador no abre «Módulos» ni puede apagar módulos')
    ctx.close()
    # --- 360 px ---
    ctx=b.new_context(viewport={'width':360,'height':800});pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    pg.add_init_script("try{localStorage.setItem('rave.ux.config','all')}catch(e){}")
    login(pg,'1234');bad=[]
    for sc in ['modulos','precios','vales','vender']:
        ev(f"go('{sc}')");pg.wait_for_timeout(300)
        if sc=='precios':
            for t in ['hist','lbl','bulk','kiosk']:
                ev(f"A.giPTab({{dataset:{{t:'{t}'}}}})");pg.wait_for_timeout(200)
                if ev("document.documentElement.scrollWidth")>362: bad.append(sc+':'+t)
        elif ev("document.documentElement.scrollWidth")>362: bad.append(sc)
    chk(not bad,'360 px sin desbordes: %s'%bad)
    ctx.close()
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
# Almacén RAVE (V26.77): lleva el módulo, apagado (lo prueba lb1.py); acá sólo se verifica que el compilado lo incluye
src=open('/tmp/rave/out_cliente.html',encoding='utf8').read() if __import__('os').path.exists('/tmp/rave/out_cliente.html') else ''
chk('giHoldPut' in src and 'lbBuild' in src,'el perfil cliente (Almacén RAVE) incluye la gestión integral y las etiquetas')
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
