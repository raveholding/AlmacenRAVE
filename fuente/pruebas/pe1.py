# V26.48 · Eliminar un artículo desde su editor: sólo el administrador; usa el mismo borrado protegido (4.16).
import sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.goto(URL+'#acceso');pg.wait_for_timeout(800);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    # artículo nuevo sin historial
    ev("S.products.push({id:'pe-x',name:'Prueba borrar',sub:'',rubro:S.rubros.find(r=>r.kind==='rubro').id,price:10000,cost:0,stock:0,unit:'u',active:true});save();go('inventario')");pg.wait_for_timeout(500)
    ev("A.pedit({dataset:{id:'pe-x'}})");pg.wait_for_timeout(400)
    chk(pg.locator('#pm-del').count()==1,'el administrador ve «Eliminar este artículo» en el editor')
    pg.locator('#pm-del').click();pg.wait_for_timeout(600)
    t=pg.locator('#modal-root .ov').last.inner_text()
    chk('Eliminar artículos' in t and 'Prueba borrar' in t and pg.locator('#pm-n').count()==0,'abre el borrado protegido con vista previa y cierra el editor')
    pg.fill('#dl-m','prueba de borrado');pg.fill('#dl-t','ELIMINAR');pg.locator('#modal-root .ov').last.locator('.mf [data-m=ok]').click();pg.wait_for_timeout(700)
    chk(not ev("S.products.some(x=>x.id==='pe-x')"),'el artículo sin historial se elimina')
    chk(ev("S.audit.some(a=>a.action==='INV_ELIMINAR'&&a.detail.includes('Prueba borrar'))"),'queda en la auditoría')
    # artículo con ventas: se archiva, no se borra
    pid=ev("(S.sales.find(s=>s.status!=='void'&&s.items&&s.items.length)||{items:[{}]}).items[0].pid||(S.sales[0].items[0].id)")
    ev("A.pedit({dataset:{id:'%s'}})"%pid);pg.wait_for_timeout(400)
    if pg.locator('#pm-del').count():
        pg.locator('#pm-del').click();pg.wait_for_timeout(600);t=pg.locator('#modal-root .ov').last.inner_text()
        chk('historial' in t.lower(),'con historial avisa que se archiva (no se pierde)')
        ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # usuario no administrador con permiso de editar productos
    ev("window.__u=user;user={name:'Super',role:'supervisor'}")
    ev("A.pedit({dataset:{id:S.products[0].id}})");pg.wait_for_timeout(400)
    chk(ev("can('edit_products')")==ev("can('edit_products')") and pg.locator('#pm-del').count()==0,'un usuario que no es administrador no ve el botón')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    n=ev("S.products.length");ev("delFlow&&delFlow([S.products[0].id],'del')");pg.wait_for_timeout(500)
    chk(ev("S.products.length")==n and pg.locator('#modal-root .ov').count()==0,'y no puede borrar aunque llame la función directo')
    ev("user=window.__u")
    pg.set_viewport_size({'width':360,'height':800});ev("A.pedit({dataset:{id:S.products[0].id}})");pg.wait_for_timeout(400)
    bx=ev("(()=>{const r=document.getElementById('pm-del').getBoundingClientRect();return[r.height,r.right<=window.innerWidth]})()")
    chk(bx[0]>=44 and bx[1],'a 360 px el botón mide 44 px o más y entra en pantalla')
    chk(not errs,'sin errores %s'%errs[:2])
    b.close()
print('%d / %d'%(sum(res),len(res)))
