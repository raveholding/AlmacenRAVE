# V26.28 · Cierre unificado: dos cajas abiertas → un arqueo con todo junto, impuestos y sueldo una vez, cierra las dos
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("""(()=>{S.cfg.cashProfile='multi';S.sessions.forEach(s=>{if(!s.closedAt)s.closedAt=Date.now()-86400000;});
     S.registers=[{id:'rn',code:'N',name:'Nico',type:'operational',active:true,created:1,branchId:'',parentId:''},{id:'rj',code:'J',name:'Juan',type:'operational',active:true,created:1,branchId:'',parentId:''}];
     S.tenant.regId='rj';const t=Date.now()-3600000;
     S.sessions.push({id:'sn',caja:1,regId:'rn',regName:'Nico',branchId:'',opening:100000,openedBy:'x',openedAt:t,closedAt:0},{id:'sj',caja:2,regId:'rj',regName:'Juan',branchId:'',opening:60000,openedBy:'x',openedAt:t,closedAt:0});
     const R=S.rubros.filter(r=>r.kind==='rubro').slice(0,2);S.rubros.forEach(r=>{if(r.kind==='rubro')r.reparte=R.includes(r);});window.R=R.map(r=>r.id);
     const mk=(id,sess,caja,total,rid)=>({id,n:caja+'-'+id,ts:Date.now()-1000,total,sessId:sess,caja,status:'ok',pays:[{m:'efectivo',a:total}],items:[{name:'x'+id,qty:1,price:total,rubro:rid,cost:Math.round(total/2)}],cust:'',fee:0});
     S.sales.push(mk('u1','sn',1,1000000,R[0].id),mk('u2','sj',2,2000000,R[1].id),mk('u3','sj',2,500000,R[0].id));
     S.movs.push({id:'um1',sessId:'sj',ts:Date.now()-500,type:'egreso',rubro:R[0].id,concept:'proveedor',amount:200000,user:'x'});
     save();return R.length})()""")
    ev("location.hash='#panel/arqueo';rerender()");pg.wait_for_timeout(600)
    t=ev("document.querySelector('#view').innerText")
    chk('Hay 2 cajas abiertas' in t and 'Arqueo unificado' in t,'con dos cajas abiertas el arqueo arranca unificado')
    a=ev("arqCtx().a")
    chk(a['total']==3500000,'ventas unificadas = 10.000 + 20.000 + 5.000 = $ 35.000: '+str(a['total']))
    chk(a['expectedCash']==100000+60000+3500000-200000,'efectivo esperado unificado (aperturas + ventas − egreso): '+str(a['expectedCash']))
    taxes=[r.get('tax') for r in a['reparte']]
    chk(all(x==3000000 for x in taxes),'impuestos $ 30.000 por socio contados UNA sola vez: '+str(taxes))
    pg.fill('#aq-dc-sn','11000');pg.fill('#aq-dc-sj','24000');pg.wait_for_timeout(300)
    a=ev("arqCtx().a");chk(a['declared']==3500000,'contado total = suma de las dos cajas: '+str(a['declared']))
    pg.click('[data-act=arqClose]');pg.wait_for_timeout(400)
    mt=pg.locator('#modal-root .dlg').last.inner_text()
    chk('Nico' in mt and 'Juan' in mt and 'Se cierran 2 cajas' in mt,'la confirmación muestra cada caja con su esperado, contado y diferencia')
    pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(500)
    r=ev("({open:S.sessions.filter(s=>!s.closedAt).length,cl:S.closures.filter(c=>c.union).map(c=>({s:c.sessId,tot:c.data.total,exp:c.data.expectedCash,dec:c.data.declared,diff:c.data.diff,uni:c.data.uni.total,txt:c.text.slice(0,20)})),ver:S.closures.filter(c=>c.union).every(verifyClosure)})")
    chk(r['open']==0,'se cerraron las dos cajas')
    cl={c['s']:c for c in r['cl']}
    chk(len(cl)==2 and cl['sn']['tot']==1000000 and cl['sj']['tot']==2500000,'cada caja tiene su cierre con sus ventas: '+str(r['cl']))
    chk(cl['sn']['exp']==1100000 and cl['sn']['diff']==0,'Nico: esperado $ 11.000, sin diferencia')
    chk(cl['sj']['exp']==60000+2500000-200000 and cl['sj']['diff']==2400000-2360000,'Juan: esperado $ 23.600, contado $ 24.000 → sobrante $ 400')
    chk(all(c['uni']==3500000 and c['txt'].startswith('CIERRE UNIFICADO') for c in r['cl']),'los dos llevan la liquidación unificada')
    chk(r['ver'],'sellos verificados')
    chk(not errs,'sin errores '+str(errs[:2]))
    b.close()
print(f"\n{sum(res)}/{len(res)}")
