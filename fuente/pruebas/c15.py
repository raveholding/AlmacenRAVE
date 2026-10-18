# V26 en la nube con equipos reales: borrado protegido, archivo con historial, rol sin permiso, cajas y traspasos
from cl_lib import *
res=[]
def chk(c,m):res.append(bool(ok(c,m)))
def sy(pg,ms=3500):pg.evaluate("cloudSync(true)");pg.wait_for_timeout(ms)
with sync_playwright() as p:
    b=launch(p);ctxA,A=newpage(b,'A');create_commerce(A)
    rub=ev(A,"S.rubros.find(r=>r.kind==='rubro').id")
    ev(A,"""(()=>{const r='%s';['p1','p2','p3'].forEach((id,i)=>S.products.push({id,name:'Art '+id,rubro:r,price:1000*(i+1),cost:500,stock:5,unit:'u',active:true,barcode:'',menu:false}));save();rerender();})()"""%rub)
    sy(A)
    chk(int(sql("select count(*) from registros where coleccion='prod' and id in ('p1','p2','p3')") or 0)==3,'3 artículos llegaron al servidor')
    # B: mostrador
    ev(A,"location.hash='#panel/roles'");A.wait_for_selector('#nb-em',timeout=10000)
    A.fill('#nb-em','mos@almacen.test');A.fill('#nb-nm','Mostrador 2');A.select_option('#nb-rl','mostrador');A.click('[data-act=nbInvite]');A.wait_for_selector('#sec-ok')
    inv=A.inner_text('#modal-root p[style*=monospace]');A.check('#sec-ok');A.locator('#modal-root [data-m=ok]').last.click();A.wait_for_timeout(1200)
    ctxB,B=newpage(b,'B');B.goto(BASE+'/cliente.html#acceso');B.wait_for_selector('#login [data-mode]')
    B.click('[data-mode="unirme"]');B.fill('#cl-em','mos@almacen.test');B.fill('#cl-pw','Mostrador-Clave-22');B.fill('#cl-co',inv)
    B.click('#cl-go');B.wait_for_selector('#ask-v',timeout=15000);B.fill('#ask-v','2');B.click('#modal-root [data-m=ok]');B.wait_for_selector('#panel:not([hidden])',timeout=20000)
    sy(B,4500)
    chk(ev(B,"S.products.some(p=>p.id==='p1')"),'B recibe los artículos')
    chk(ev(B,"canDelItems()")==False,'B (mostrador): sin permiso de borrar/archivar en pantalla')
    # A elimina p1 (sin historial) con el flujo real
    ev(A,"location.hash='#panel/inventario'");A.wait_for_timeout(600)
    A.evaluate("delFlow(['p1'],'del')");A.wait_for_selector('#dl-m');A.fill('#dl-m','carga duplicada');A.fill('#dl-t','ELIMINAR');A.locator('#modal-root [data-m=ok]').last.click();A.wait_for_timeout(800)
    A.locator('#modal-root [data-m=ok]').last.click();A.wait_for_timeout(300)
    chk(ev(A,"!S.products.some(p=>p.id==='p1')"),'A: p1 eliminado localmente')
    sy(A)
    chk(sql("select borrado::text from registros where coleccion='prod' and id='p1'")=='true','p1: baja lógica en el servidor')
    # p2 con historial: venta real contra el servidor
    ev(A,"(()=>{S.sessions.push({id:uid(),caja:S.tenant.caja,openedBy:user.name,openedAt:now(),opening:0,closedAt:0});save();})()")
    ev(A,"location.hash='#panel/vender'");A.wait_for_timeout(500)
    n0=ev(A,"S.sales.length")
    A.evaluate("pos.lines=[{pid:'p2',name:'Art p2',rubro:'%s',qty:1,price:2000,cost:500,unit:'u',list:2000}];pos.method='efectivo';pos.arca=false;A.cobrar()"%rub);A.wait_for_timeout(700)
    print('DBG',A.evaluate("document.querySelector('#modal-root').innerText.slice(0,100).replace(/\\n/g,' ')"))
    try:
        A.fill('#cb-rec','2000') if A.locator('#cb-rec').count() else None
        A.locator('#modal-root [data-m=ok]').last.click();A.wait_for_timeout(900)
    except Exception as e:print('sin modal',str(e)[:80])
    chk(ev(A,"S.sales.length")>n0,'venta de p2 registrada (historial)')
    sy(A,4500)
    ev(A,"location.hash='#panel/inventario'");A.wait_for_timeout(600)
    A.evaluate("delFlow(['p2'],'del')");A.wait_for_selector('#dl-m');
    txt=A.inner_text('#modal-root')
    chk('se archiva' in txt or 'Archivar' in txt,'p2 con ventas: el flujo propone archivar, no borrar')
    A.fill('#dl-m','discontinuado');A.locator('#modal-root [data-m=ok]').last.click();A.wait_for_timeout(800)
    A.locator('#modal-root [data-m=ok]').last.click();A.wait_for_timeout(300)
    chk(ev(A,"S.products.find(p=>p.id==='p2').archived===true"),'p2 archivado localmente (no eliminado)')
    sy(A)
    chk(sql("select (datos->>'archived') from registros where coleccion='prod' and id='p2'")=='true','p2: archivado en el servidor con historial intacto')
    chk(int(sql("select count(*) from registros where coleccion='ventas'") or 0)>=1,'las ventas anteriores siguen en el servidor')
    # B intenta archivar p3 por la fuerza (cliente manipulado): el servidor lo rechaza
    ev(B,"(()=>{const p=S.products.find(x=>x.id==='p3');p.archived=true;p.active=false;p.name='HACK';save();})()")
    sy(B,4500)
    d=sql("select datos->>'name' from registros where coleccion='prod' and id='p3'")
    chk(d=='Art p3','servidor rechaza edición de artículo por mostrador (sigue «%s»)'%d)
    chk(sql("select coalesce(datos->>'archived','') from registros where coleccion='prod' and id='p3'") in ('','false'),'p3 no quedó archivado por mostrador')
    # cajas: A activa perfil principal y define cajas
    ev(A,"""(()=>{S.cfg.cashProfile='main';const a={id:'rg_p',name:'Caja principal',code:'P',kind:'main',active:true},c={id:'rg_2',name:'Caja 2',code:'2',kind:'op',parentId:'rg_p',active:true};S.registers=[a,c];save();})()""")
    sy(A,4000)
    chk(int(sql("select count(*) from registros where coleccion='cajas' and borrado=false") or 0)==2,'2 cajas definidas llegaron al servidor')
    sy(B,4500)
    chk(ev(B,"(S.registers||[]).length")==2,'B recibe las cajas definidas por el administrador')
    # traspaso (colección una-vez): se sube y B lo ve; reescribirlo no lo altera
    ev(A,"(()=>{S.sessions.push({id:uid(),caja:7,regId:'rg_p',openedBy:user.name,openedAt:now(),opening:100000,closedAt:0},{id:uid(),caja:8,regId:'rg_2',openedBy:user.name,openedAt:now(),opening:100000,closedAt:0});save();})()")
    e=ev(A,"xferCreate({id:'tr1',from:'rg_2',to:'rg_p',amount:5000,rubro:'%s',motivo:'prueba de traspaso'})"%rub)
    chk(e=='' and ev(A,"S.transfers.length")==1,'traspaso creado con la misma lógica de la pantalla (%s)'%e)
    sy(A,4000)
    chk(int(sql("select count(*) from registros where coleccion='ctransf' and id='tr1'") or 0)==1,'traspaso subido al servidor')
    ev(A,"S.transfers.find(t=>t.id==='tr1').amount=999999;save()");sy(A,4000)
    chk(sql("select (datos->>'amount') from registros where coleccion='ctransf' and id='tr1'")=='5000','traspaso inmutable: reescribirlo no cambia el importe')
    errs2=[e for e in errs if 'status of' not in e and 'Failed to load resource' not in e]
    chk(not errs2,'sin errores JS inesperados %s'%errs2[:3])
print(res.count(True),'/',len(res))
