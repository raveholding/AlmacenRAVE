# V26.20 · revisión del menú público (editar y eliminar secciones) y socios: baja/eliminación sólo del administrador
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate;M='#modal-root .ov >> nth=-1'
    ok=lambda:pg.locator(M).locator('.mf [data-m=ok]').click()
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("go('menuadmin')");pg.wait_for_timeout(400)
    # crear y EDITAR una sección sólo del menú
    pg.click('[data-act=msecAdd]');pg.wait_for_timeout(200);pg.fill('#ms-n','Ofertas');ok();pg.wait_for_timeout(300)
    sid=ev("S.rubros.find(r=>r.name==='Ofertas').id")
    pg.click('#msec-card [data-act=msecEdit][data-id="%s"]'%sid);pg.wait_for_timeout(200)
    chk(pg.locator('#ms-n').input_value()=='Ofertas','al editar una sección sólo del menú se abre con sus datos')
    pg.fill('#ms-n','Ofertas del mes');pg.select_option('#ms-l','rows');ok();pg.wait_for_timeout(300)
    r=ev("rub('%s')"%sid);chk(r['mNom']=='Ofertas del mes' and r['layout']=='rows','se guarda la edición (nombre y diseño)')
    chk(any(s['nom']=='Ofertas del mes' for s in ev("pubCatalog().secciones")),'y el menú público la muestra con el nombre nuevo')
    # EDITAR una sección que sale de un rubro
    rid='vino';pg.click('#msec-card [data-act=rubEdit][data-id="%s"]'%rid);pg.wait_for_timeout(200)
    chk('Nombre del rubro' in pg.inner_text(M),'el formulario del rubro dice «Nombre del rubro»')
    pg.fill('#rb-m','Vinos y espumantes');ok();pg.wait_for_timeout(300)
    chk(any(s['nom']=='Vinos y espumantes' and s['cat']==rid for s in ev("pubCatalog().secciones")),'editar el nombre en el menú de un rubro se ve en el menú')
    # ELIMINAR: sección que sale de un rubro → sólo del menú
    chk(pg.locator('#msec-card [data-act=msecRubDel][data-id="%s"]'%rid).count()==1,'las secciones de un rubro también tienen «Eliminar»')
    pg.click('#msec-card [data-act=msecRubDel][data-id="%s"]'%rid);pg.wait_for_timeout(200);ok();pg.wait_for_timeout(300)
    chk(ev("rub('%s').kind"%rid)=='rubro' and ev("pubCatalog().secciones.every(s=>s.cat!=='%s')"%rid),'«sacarla sólo del menú»: el rubro sigue y desaparece del menú')
    # ELIMINAR el rubro (sin productos) desde el menú
    ev("S.rubros.splice(1,0,{id:'rx',name:'Rubro de prueba',owner:'',reparte:false,kind:'rubro',color:'#2f6f8f',mNom:'Prueba',mTitle:'Prueba',layout:'grid'});save();rerender()");pg.wait_for_timeout(300)
    pg.click('#msec-card [data-act=msecRubDel][data-id="rx"]');pg.wait_for_timeout(200);pg.check('input[name=mrd][value=rubro]');ok();pg.wait_for_timeout(300)
    ok();pg.wait_for_timeout(300)
    chk(ev("!rub('rx')"),'«eliminar el rubro» lo borra (no tenía productos ni historial)')
    # ELIMINAR sección sólo del menú
    pg.click('#msec-card [data-act=msecDel][data-id="%s"]'%sid);pg.wait_for_timeout(200);ok();pg.wait_for_timeout(300)
    chk(ev("!rub('%s')"%sid),'la sección sólo del menú se elimina')
    # SOCIOS: baja/eliminar sólo el administrador
    cid=ev("S.customers.find(c=>c.status!=='baja').id")
    ev("S.roles.supervisor=S.roles.supervisor.concat(['customers_admin','config']);user=S.users.find(u=>u.role==='supervisor');go('clientes')");pg.wait_for_timeout(300)
    ev("A.cuEdit({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(300)
    chk(pg.locator('%s [data-act=cuBaja]'%M).count()==0 and pg.locator('%s [data-act=cuDel]'%M).count()==0,'un supervisor (aunque tenga permisos de clientes) no ve «Dar de baja» ni «Eliminar»')
    ev("document.querySelectorAll('#modal-root .ov').forEach(x=>x.remove());A.cuDel({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(200)
    chk(pg.locator('#modal-root .ov').count()==0,'tampoco puede eliminar por código')
    ev("user=S.users.find(u=>u.role==='admin');A.cuEdit({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(300)
    chk(pg.locator('#modal-root [data-act=cuDel]').count()==1 and pg.locator('#modal-root [data-act=cuBaja]').count()==1,'el administrador sí ve «Eliminar» y «Dar de baja»')
    print('errores:',errs[:4]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
