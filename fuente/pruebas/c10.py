from cl_lib import *
res=[]
def chk(c,m):res.append(bool(ok(c,m)))
with sync_playwright() as p:
    b=launch(p);ctx,A=newpage(b,'A');create_commerce(A)
    ev(A,"location.hash='#panel/config'");A.wait_for_timeout(1000)
    hs=A.evaluate("[...document.querySelectorAll('[data-act=rubEdit],[data-act=rubDel]')].map(b=>Math.round(b.getBoundingClientRect().height))")
    chk(min(hs)>=44,'altura de botones Editar/Eliminar ≥ 44 px (mín %s)'%min(hs))
    # alta
    A.click('[data-act=rubAdd]');A.wait_for_selector('#rb-n');A.fill('#rb-n','Rubro Prueba');A.click('#modal-root [data-m=ok]');A.wait_for_timeout(800)
    chk(ev(A,"S.rubros.some(r=>r.name==='Rubro Prueba'&&r.kind==='rubro')"),'alta de rubro')
    rid=ev(A,"S.rubros.find(r=>r.name==='Rubro Prueba').id")
    # editar
    A.click('[data-act=rubEdit][data-id="%s"]'%rid);A.wait_for_selector('#rb-n');A.fill('#rb-n','Rubro Editado');A.click('#modal-root [data-m=ok]');A.wait_for_timeout(800)
    chk(ev(A,"S.rubros.find(r=>r.id==='%s').name"%rid)=='Rubro Editado','edición de nombre')
    A.evaluate("cloudSync(true)");A.wait_for_timeout(3500)
    chk('Rubro Editado' in sql("select datos::text from registros where coleccion='rubros' and id='%s'"%rid),'el rubro editado llegó al servidor')
    # producto en ese rubro y baja con destino
    ev(A,"S.products.push({id:'pt1',name:'Prod Test',rubro:'%s',price:1000,cost:0,stock:0,unit:'u',active:true,barcode:'',menu:false});save();rerender()"%rid);A.wait_for_timeout(500)
    A.click('[data-act=rubDel][data-id="%s"]'%rid);A.wait_for_selector('#rd-d')
    chk('1' in A.inner_text('#modal-root'),'baja con productos pide rubro de destino')
    dest=A.evaluate("document.querySelector('#rd-d').value");A.click('#modal-root [data-m=ok]');A.wait_for_timeout(800)
    chk(ev(A,"!S.rubros.some(r=>r.id==='%s')"%rid) and ev(A,"S.products.find(p=>p.id==='pt1').rubro")==dest,'rubro eliminado y producto movido al destino')
    A.evaluate("cloudSync(true)");A.wait_for_timeout(3500)
    d=sql("select borrado::text from registros where coleccion='rubros' and id='%s'"%rid)
    chk(d=='true','la baja llegó al servidor (borrado lógico) [%s]'%d[:25])
    # baja de rubro vacío
    A.click('[data-act=rubAdd]');A.wait_for_selector('#rb-n');A.fill('#rb-n','Vacio');A.click('#modal-root [data-m=ok]');A.wait_for_timeout(600)
    vid=ev(A,"S.rubros.find(r=>r.name==='Vacio').id")
    A.click('[data-act=rubDel][data-id="%s"]'%vid);A.wait_for_timeout(400);A.click('#modal-root [data-m=ok]');A.wait_for_timeout(600)
    chk(ev(A,"!S.rubros.some(r=>r.id==='%s')"%vid),'baja de rubro vacío')
    print([e for e in errs if '503' not in e][:3])
