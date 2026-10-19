from cl_lib import *
res=[]
def chk(c,m):res.append(bool(ok(c,m)))
with sync_playwright() as p:
    b=launch(p)
    ctx,A=newpage(b,'A');create_commerce(A)
    chk(ev(A,"wsOn()")==False,'cliente: el canal mayorista nace APAGADO')
    chk(ev(A,"can('price_lists')&&can('credit_ov')"),'el administrador tiene los permisos nuevos')
    # datos: producto con escalón, cliente mayorista con CUIT, caja abierta
    ev(A,"""(()=>{const r=S.rubros.find(r=>r.kind==='rubro');
     S.products.push({id:'cw1',name:'Prod mayorista',rubro:r.id,price:10000,cost:5000,stock:100,unit:'u',barcode:'',active:true,menu:false,pres:[{lv:'d',qty:10,unit:9000,barcode:''}]});
     S.customers.push({id:'ccw1xxxxxxxxxxx1',num:1,name:'Distri',last:'Norte',birth:'1980-01-01',wa:'+5493875550999',dni:'',cards:[],cardSecrets:{},origin:'mostrador',consent:{club:true,comm:false,analytics:false,version:'v1',ts:now()},ts:now(),status:'activo',limit:100000,secret:'s'.repeat(24),notes:'',channel:'mayorista',taxid:'20123456786',term:15,zone:'Z1',seller:''});
     S.cfg.wholesale={on:true,example:false,allowClub:false,grace:0};
     S.sessions.push({id:uid(),caja:S.tenant.caja,openedBy:user.name,openedAt:now(),opening:0,closedAt:0});save();})()""")
    ev(A,"S.agreements.push({id:'agw1',cust:'ccw1xxxxxxxxxxx1',pid:'cw1',price:9500,pct:0,from:'',to:'',active:false,by:'t',ts:now()});save()")
    wait_sync(A,3000)
    chk(sql("select count(*) from public.registros where coleccion='acuer'")=='1','el acuerdo viaja a la nube')
    raw=sql("select datos::text from public.registros where coleccion='clientes' and id='ccw1xxxxxxxxxxx1'")
    chk('20123456786' not in raw and '__pii' in raw,'el CUIT del cliente viaja CIFRADO (no está en texto plano en el servidor)')
    chk('"pres"' in sql("select datos::text from public.registros where coleccion='prod' and id='cw1'"),'las presentaciones del producto viajan en el artículo')
    # excepción de crédito autorizada por el admin
    ev(A,"A.wsCredOv({dataset:{id:'ccw1xxxxxxxxxxx1',need:'300000'}})");A.wait_for_selector('#co-w')
    A.fill('#co-w','Excepción de prueba en la nube');A.click('#modal-root [data-m=ok]');A.wait_for_timeout(500)
    wait_sync(A,3000)
    chk(sql("select count(*) from public.registros where coleccion='cexc'")=='1','la excepción de crédito viaja a la nube')
    # mostrador B
    ev(A,"location.hash='#panel/nube'");A.wait_for_selector('#nb-em')
    A.fill('#nb-em','mos@almacen.test');A.fill('#nb-nm','Mostrador 2');A.select_option('#nb-rl','mostrador')
    A.click('[data-act=nbInvite]');A.wait_for_selector('#sec-ok');inv=A.inner_text('#modal-root p[style*=monospace]');A.check('#sec-ok');A.click('#modal-root [data-m=ok]')
    ctxB,B=newpage(b,'B')
    B.goto(BASE+'/cliente.html#acceso');B.wait_for_selector('#login [data-mode]')
    B.click('[data-mode="unirme"]');B.fill('#cl-em','mos@almacen.test');B.fill('#cl-pw','Mostrador-Clave-22');B.fill('#cl-co',inv)
    B.click('#cl-go');B.wait_for_selector('#ask-v',timeout=15000);B.fill('#ask-v','2');B.click('#modal-root [data-m=ok]');B.wait_for_selector('#panel:not([hidden])',timeout=20000);B.wait_for_timeout(3500)
    ev(B,"S.sessions.push({id:uid(),caja:S.tenant.caja,openedBy:user.name,openedAt:now(),opening:0,closedAt:0});save();")
    chk(ev(B,"wsOn()")==True,'B recibe la bandera del canal mayorista')
    chk(ev(B,"custById('ccw1xxxxxxxxxxx1')&&custById('ccw1xxxxxxxxxxx1').taxid")=='20123456786','B descifra el CUIT del cliente')
    chk(ev(B,"(S.agreements||[]).length")==1 and ev(B,"(S.creditOv||[]).length")==1,'B recibe el acuerdo y la excepción')
    chk(ev(B,"priceResolve(prod('cw1'),10,{cust:custById('ccw1xxxxxxxxxxx1'),chan:'mayorista'}).price")==9000,'B calcula el mismo precio (Display ×10 = $90 por unidad)')
    chk(ev(B,"can('price_lists')")==False and ev(B,"can('credit_ov')")==False,'el mostrador no tiene permisos de listas ni de excepciones')
    # B vende al contado en mayorista por pantalla
    ev(B,"location.hash='#panel/vender'");B.wait_for_timeout(600)
    ev(B,"pos.lines=[];pos.cust='ccw1xxxxxxxxxxx1';pos.chanSet=null;pos.mix=false;pos.pays=[];pos.method='efectivo';pos.recv='';A.padd({dataset:{id:'cw1'}});lineEdit(0,'qty','10')")
    B.wait_for_timeout(300)
    chk(ev(B,"posTotal()")==90000,'B: 10 u mayorista = $900')
    B.keyboard.press('F12');B.wait_for_timeout(400);B.click('#modal-root [data-m=ok]');B.wait_for_timeout(700)
    ev(B,"document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    wait_sync(B,3500)
    row=sql("select datos::text from public.registros where coleccion='ventas' order by actualizado desc limit 1")
    chk('"wch": "mayorista"' in row and '"lr": "P-d"' in row,'la venta mayorista llega a la nube con canal y regla')
    # B a cuenta corriente: $900 > límite $1.000? no: 900 <= 1000 → entra; la segunda supera el límite y B no puede autorizar
    ev(B,"pos.lines=[];pos.cust='ccw1xxxxxxxxxxx1';A.padd({dataset:{id:'cw1'}});lineEdit(0,'qty','10')")
    r=ev(B,"(()=>{const r=commitSale('fiado',false,'local',pos.lines,{custId:'ccw1xxxxxxxxxxx1',ws:{chan:'mayorista'}});return{err:r.err||'',cov:r.sale&&r.sale.cov}})()")
    chk(not r['err'],'B: primera venta a cuenta corriente dentro del límite '+r['err'][:50])
    ev(B,"pos.lines=[];pos.cust='ccw1xxxxxxxxxxx1';A.padd({dataset:{id:'cw1'}});lineEdit(0,'qty','20')")   # $1.800 → supera el límite de $1.000
    r=ev(B,"(()=>{const r=commitSale('fiado',false,'local',pos.lines,{custId:'ccw1xxxxxxxxxxx1',ws:{chan:'mayorista'}});return{err:r.err||'',cov:r.sale&&r.sale.cov}})()")
    chk('Supera el límite' in r['err'] or r['cov'],'B: la venta que supera el límite usa la excepción del admin (o se bloquea) → %s'%(r['err'][:50] or 'excepción usada'))
    wait_sync(B,3500);wait_sync(A,3500)
    chk(sql("select count(*) from public.registros where coleccion='cexcu'")=='1' if r['cov'] else True,'el uso de la excepción llega a la nube')
    chk(ev(A,"(S.creditUse||[]).length")==(1 if r['cov'] else 0),'A ve el consumo de la excepción hecho por B')
    chk(sql("select count(*) from public.registros where coleccion='ventas' and datos ? 'credit_review'")=='0','ninguna venta quedó marcada para revisión (todas dentro del límite o con excepción)')
    chk(not errs,'sin errores de consola: '+str(errs[:3]))
    print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
    b.close()
