import sys
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    for w,h in ((320,640),(360,740),(768,1024),(1024,768),(1440,900)):
        pg=b.new_page(viewport={'width':w,'height':h},has_touch=w<800)
        pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
        pg.on('console',lambda m:errs.append(m.text[:150]) if m.type=='error' and 'TUNNEL' not in m.text else None)
        ev=pg.evaluate
        pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(500)
        pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
        ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
        if pg.locator('#ap').count():
            pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
        ev("""(()=>{const r=S.rubros.find(r=>r.kind==='rubro');S.products.push({id:'rz',name:'Resp',rubro:r.id,price:10000,cost:5000,stock:9000,unit:'u',active:true,menu:false,pres:[]});pos.lines=[];A.padd({dataset:{id:'rz'}});commitSale('efectivo',false,'local',pos.lines,{});pos.lines=[];S.customers.push({id:'rc',num:9301,name:'Resp',last:'Cliente',birth:'1990-05-21',wa:'+5493875550301',email:'',notes:'',dni:'',status:'activo',origin:'mostrador',consent:{club:true,comm:false,analytics:false,ts:now()},secret:'x'.repeat(20),cards:[],cardSecrets:{},limit:0,taxid:''})})()""")
        for hsh in ('caja','clientes','config','cajas'):
            ev("location.hash='#panel/%s'"%hsh);pg.wait_for_timeout(500)
            ov=ev("document.documentElement.scrollWidth-document.documentElement.clientWidth")
            chk(ov<=1,'%dpx #%s sin desborde horizontal (%d)'%(w,hsh,ov))
        # modales nuevos
        ev("location.hash='#panel/clientes'");pg.wait_for_timeout(300)
        ev("A.cuEdit({dataset:{id:'rc'}})");pg.wait_for_timeout(300)
        ov=ev("(()=>{const d=document.querySelector('#modal-root .dlg');return d?d.scrollWidth-d.clientWidth:-1})()")
        chk(ov<=1,'%dpx ficha de cliente sin desborde (%d)'%(w,ov))
        sm=ev("[...document.querySelectorAll('#modal-root .dlg button, #modal-root .dlg input:not([type=checkbox]):not([type=radio])')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<40).length") if w<800 else 0
        chk(sm==0,'%dpx controles de la ficha ≥40 px (%d chicos)'%(w,sm))
        ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
        ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
        ev("A.saleDetailOpen&&A.saleDetailOpen({dataset:{id:S.sales[S.sales.length-1].id}})");pg.wait_for_timeout(300)
        ov=ev("(()=>{const d=document.querySelector('#modal-root .dlg');return d?d.scrollWidth-d.clientWidth:-1})()")
        chk(ov<=1,'%dpx detalle de venta sin desborde (%d)'%(w,ov))
        pg.close()
    chk(not errs,'consola limpia %s'%errs[:3])
    b.close()
print(sum(res),'/',len(res))
