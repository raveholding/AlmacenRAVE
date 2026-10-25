# V26.27 · Consolidado del día: un turno abierto ayer y cerrado hoy no suma las ventas de ayer a hoy
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    r=ev("""(()=>{S.cfg.cashProfile='multi';
     S.sessions.forEach(s=>{if(!s.closedAt)s.closedAt=Date.now()-3*86400000;});
     const reg={id:'cxr1',code:'CX1',name:'CajaCX',type:'operational',active:true,created:1,branchId:'',parentId:''};S.registers=(S.registers||[]).concat([reg]);
     const D=86400000,t0=new Date();t0.setHours(12,0,0,0);const today=t0.getTime(),yest=today-D;
     const r=S.rubros.find(r=>r.kind==='rubro');
     const s1={id:'cxs1',caja:7,regId:'cxr1',regName:'CajaCX',branchId:'',opening:100000,openedBy:'x',openedAt:yest-3*3600000,closedAt:today-11*3600000};
     const s2={id:'cxs2',caja:7,regId:'cxr1',regName:'CajaCX',branchId:'',opening:50000,openedBy:'x',openedAt:today-11*3600000+60000,closedAt:0};
     S.sessions.push(s1,s2);
     const mk=(id,sess,ts,total)=>({id,n:'7-'+id,ts,total,sessId:sess,caja:7,status:'ok',pays:[{m:'efectivo',a:total}],items:[{name:'x',qty:1,price:total,rubro:r.id,cost:0}],cust:'',fee:0});
     S.sales.push(mk('a1','cxs1',yest,900000),mk('a2','cxs1',today-11.5*3600000,10000),mk('a3','cxs2',today,30000));
     save();return {today:dkey(today),yest:dkey(yest)};})()""")
    ev("location.hash='#panel/cajasx';rerender()");pg.wait_for_timeout(600)
    rows=ev("cashRows(dkey(now()),'').filter(x=>x.r.id==='cxr1').map(x=>({sales:x.sales,exp:x.exp,open:x.open}))")
    chk(rows and rows[0]['sales']==40000,'hoy: sólo las ventas de hoy (100 + 300 = $ 400), no las de ayer: '+str(rows))
    chk(rows and rows[0]['exp']==50000+30000,'efectivo esperado: turno abierto completo (apertura + ventas en efectivo): '+str(rows))
    y=ev(f"cashRows('{r['yest']}','').filter(x=>x.r.id==='cxr1').map(x=>x.sales)")
    chk(y==[900000],'ayer: sólo las ventas de ayer ($ 9.000): '+str(y))
    t=ev("document.querySelector('#cx-res').innerText")
    chk('400' in t and '9.400' not in t,'la tabla muestra $ 400 para hoy')
    chk(not errs,'sin errores '+str(errs[:2]))
    b.close()
print(f"\n{sum(res)}/{len(res)}")
