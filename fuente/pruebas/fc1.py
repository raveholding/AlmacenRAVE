# V26.55 · datos para facturar en la ficha del cliente, precarga del receptor en el cobro con ARCA, logo → Resumen
import sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
OK="#modal-root .ov >> nth=-1 >> .mf [data-m=ok]"
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.goto(URL+'#acceso');pg.wait_for_timeout(900);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    # logo → Resumen
    ev("go('clientes')");pg.wait_for_timeout(200);pg.click('#side .brand');pg.wait_for_timeout(400)
    chk(ev("curScreen")=='inicio','tocar el logo / «Sistema …» lleva al Resumen')
    # ficha con datos fiscales
    cid=ev("S.customers.find(c=>c.status!=='baja').id")
    ev("go('clientes');A.cuEdit({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(300)
    chk(pg.locator('#fc-cond').count()==1 and pg.locator('#fc-tx').count()==1,'la ficha tiene «Datos para facturar (ARCA)» con condición frente al IVA y CUIT')
    pg.fill('#fc-tx','30-71100001-8');pg.select_option('#fc-cond','1');pg.fill('#fc-rz','EL MUNDO DEL PLOMERO SRL');pg.fill('#fc-dom','Av. Siempre Viva 123')
    pg.locator(OK).click();pg.wait_for_timeout(300)
    c=ev("(()=>{const c=custById('%s');return {t:c.taxid,i:c.ivaCond,r:c.razon,d:c.domFis}})()"%cid)
    chk(c=={'t':'30711000018','i':'1','r':'EL MUNDO DEL PLOMERO SRL','d':'Av. Siempre Viva 123'},'se guardan CUIT, condición, razón social y domicilio (%s)'%c)
    chk(ev("S.audit.some(a=>a.action==='CLIENTE_FISCAL')"),'el cambio queda en auditoría')
    ev("A.cuEdit({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(300);pg.fill('#fc-tx','30711000019');pg.locator(OK).click();pg.wait_for_timeout(200)
    chk('no es válido' in pg.inner_text('#modal-root'),'CUIT con dígito verificador inválido rechazado')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # cobro con ARCA: precarga
    ev("if(!openSess()){S.sessions.push({id:'fc-s',caja:S.tenant.caja,openedBy:'ADMIN',openedAt:Date.now(),opening:0});}go('vender')");pg.wait_for_timeout(300)
    ev("const p=S.products.find(p=>p.active&&p.price>0);pos.lines=[{pid:p.id,name:p.name,rubro:p.rubro,qty:1,price:p.price,cost:0,unit:p.unit,list:p.price}];pos.arca=true;pos.cust='%s';posCart();A.cobrar()"%cid);pg.wait_for_timeout(400)
    chk(pg.locator('#rc-t').input_value()=='80' and pg.locator('#rc-n').input_value()=='30711000018' and pg.locator('#rc-c').input_value()=='1' and pg.locator('#rc-nm').input_value()=='EL MUNDO DEL PLOMERO SRL','al elegir el cliente se cargan CUIT, Responsable Inscripto y razón social de la ficha')
    chk('cargado de la ficha' in pg.inner_text('#modal-root'),'el cobro avisa que los datos vienen de la ficha')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # cliente sólo con DNI
    c2=ev("(()=>{const c=S.customers.filter(c=>c.status!=='baja')[1];c.taxid='';c.ivaCond='';c.razon='';c.dni='30123456';return c.id})()")
    ev("pos.cust='%s';pos.rcp=null;A.cobrar()"%c2);pg.wait_for_timeout(400)
    chk(pg.locator('#rc-t').input_value()=='96' and pg.locator('#rc-n').input_value()=='30123456' and pg.locator('#rc-c').input_value()=='5','cliente con DNI: DNI y Consumidor final')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # cliente sin datos: se completan en el cobro y quedan en la ficha
    c3=ev("(()=>{const c=S.customers.filter(c=>c.status!=='baja')[2];c.taxid='';c.ivaCond='';c.razon='';c.dni='';return c.id})()")
    ev("pos.cust='%s';pos.rcp=null;A.cobrar()"%c3);pg.wait_for_timeout(400)
    chk('no tiene CUIT ni DNI' in pg.inner_text('#modal-root'),'si la ficha no tiene datos, lo avisa')
    ev("pos.rcp.t='80';pos.rcp.n='20334455662';pos.rcp.c='6';pos.rcp.nm='Juan Monotributo'")
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    ev("arcaRcpToCust(custById('%s'))"%c3)
    c=ev("(()=>{const c=custById('%s');return [c.taxid,c.ivaCond,c.razon]})()"%c3)
    chk(c==['20334455662','6','Juan Monotributo'],'lo cargado en el cobro se completa en la ficha (%s)'%c)
    ev("pos.rcp={from:'%s',t:'80',n:'20111111112',c:'1',nm:'Otro'};arcaRcpToCust(custById('%s'))"%(c3,c3))
    chk(ev("custById('%s').taxid"%c3)=='20334455662','no pisa un CUIT ya cargado en la ficha')
    # quitar el cliente vuelve a consumidor final
    ev("pos.cust='';arcaRcpAuto()")
    chk(ev("pos.rcp.t")=='99','al quitar el cliente vuelve a Consumidor final')
    pg.set_viewport_size({'width':360,'height':800});ev("A.cuEdit({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(300)
    chk(ev("document.documentElement.scrollWidth<=window.innerWidth+1"),'la ficha no desborda a 360 px')
    chk(not errs,'sin errores %s'%errs[:2])
    b.close()
print('%d/%d'%(sum(res),len(res)))
