# 4.23.1–4.23.3 / 4.23.7 · G1 · traspasos de fondos controlados: permiso, autorizante, cajas cerradas, tránsito,
#                              recepción con diferencia, devolución, saldo inicial sugerido, comprobante, registro, avisos
import json,sys
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ADM="S.users.find(u=>u.role==='admin')"
    # ---------- preparación: perfil «caja principal», 4 cajas, dos cerradas con su cierre sellado ----------
    ev("""(()=>{S.cfg.cashProfile='main';S.registers=[
      {id:'r1',code:'1',name:'Caja 1',type:'operational',branchId:'',parentId:'',active:true},
      {id:'r2',code:'2',name:'Caja 2',type:'operational',branchId:'',parentId:'',active:true},
      {id:'r3',code:'3',name:'Caja 3',type:'operational',branchId:'',parentId:'',active:true},
      {id:'rp',code:'P',name:'Principal',type:'main',branchId:'',parentId:'',active:true}];
      window.mkClosed=(regId,declared)=>{const sid=uid(),ts=now()-7200000;const reg=regOf(regId);
        S.sessions.push({id:sid,caja:77,regId,regName:reg.name,branchId:'',openedBy:'x',openedAt:ts-3600000,opening:0,closedAt:ts});
        const data={total:0,declared,expectedCash:declared,diff:0,movs:[],tin:0,tout:0,transfers:[]};const text='cierre de prueba';
        const k={id:uid(),ts,sessId:sid,caja:77,regId,regName:reg.name,branchId:'',user:'ADMIN',day:dkey(ts),opening:0,data,text,notes:[],obs:''};
        k.hash=sha256(JSON.stringify({data,text,ts,user:k.user,sess:sid}));S.closures.push(k);return k.id;};
      S.sessions.push({id:'s1',caja:81,regId:'r1',regName:'Caja 1',branchId:'',openedBy:'x',openedAt:now()-600000,opening:200000,closedAt:0});
      S.sessions.push({id:'sp',caja:82,regId:'rp',regName:'Principal',branchId:'',openedBy:'x',openedAt:now()-600000,opening:0,closedAt:0});
      window.k2=mkClosed('r2',50000);window.k3=mkClosed('r3',30000);S.cfg.xfer={strict:true,closedMode:'transito',approvalOver:0,transitAlertH:0,selfAuth:false};save();})()""")
    # ---- pago a proveedor repartido entre cajas (motor local) ----
    ev("S.suppliers=S.suppliers||[];S.suppliers.push({id:'pvx',razon:'Proveedor X',cuit:'30500010912',iva:'RI',email:'',tel:'',dir:'',saldo:100000,activo:true,ts:now()});S.supLedger=S.supLedger||[];save()")
    ev("S.sessions.find(x=>x.id==='s1').opening=500000;S.sessions.find(x=>x.id==='sp').opening=300000;save()")
    pay=lambda extra,k:ev("(async()=>{try{const r=await LOCAL.pagar(Object.assign({idempotency_key:'%s',proveedor_id:'pvx',monto:300,medio_pago:'efectivo',rubro_id:S.rubros.find(r=>r.kind==='shared'||r.kind==='rubro').id},%s));return JSON.stringify(r)}catch(e){return 'ERR '+e.message}})()"%(k,extra))
    m0=ev("S.movs.length")
    r=pay("{asignaciones:[{turno_id:'s1',monto:200},{turno_id:'sp',monto:100}]}",'rep-pago-0001')
    chk(not r.startswith('ERR') and ev("S.movs.length")==m0+2,'pago 300 repartido 200 + 100: 2 egresos '+r[:80])
    chk(ev("S.suppliers.find(x=>x.id==='pvx').saldo")==100000-30000,'la deuda baja exactamente 300')
    chk(ev("S.movs.filter(m=>m.sessId==='s1').slice(-1)[0].amount")==20000 and ev("S.movs.filter(m=>m.sessId==='sp').slice(-1)[0].amount")==10000,'cada caja registra su parte (20.000 y 10.000 centavos)')
    chk(ev("S.supLedger.filter(l=>l.key==='rep-pago-0001').length")==1,'un solo Pago en el libro')
    r=pay("{asignaciones:[{turno_id:'s1',monto:200},{turno_id:'sp',monto:100}]}",'rep-pago-0001')
    chk('"repetido":true' in r and ev("S.movs.length")==m0+2,'reintento con la misma clave no duplica')
    r=pay("{asignaciones:[{turno_id:'s1',monto:100},{turno_id:'sp',monto:100}]}",'rep-pago-0002')
    chk(r.startswith('ERR') and 'no suma' in r and ev("S.movs.length")==m0+2,'reparto que no suma: rechazado, sin egresos parciales: '+r[:80])
    r=pay("{asignaciones:[{turno_id:'s1',monto:150},{turno_id:'k2x',monto:150}]}",'rep-pago-0003')
    chk(r.startswith('ERR') and ev("S.movs.length")==m0+2 and ev("S.suppliers.find(x=>x.id==='pvx').saldo")==70000,'caja inexistente: todo se revierte (sin egreso parcial ni cambio de deuda): '+r[:80])
    # interfaz
    ev("location.hash='#panel/compras'");pg.wait_for_timeout(500)
    ev("A.cmpPay({dataset:{id:'pvx'}})");pg.wait_for_timeout(300)
    chk(pg.locator('#pg-rep').count()==1,'con más de una caja abierta aparece «Repartir entre varias cajas»')
    pg.check('#pg-rep');pg.fill('#pg-m','400');pg.fill('#pgc-s1','250');pg.fill('#pgc-sp','100');pg.wait_for_timeout(150)
    chk('Faltan' in pg.inner_text('#pg-sum'),'la pantalla avisa cuánto falta repartir: '+pg.inner_text('#pg-sum'))
    pg.fill('#pgc-sp','150');pg.wait_for_timeout(150)
    chk('cubre' in pg.inner_text('#pg-sum'),'cuando suma exacto lo confirma')
    chk(not errs,'sin errores de consola: '+str(errs[:3]))
    print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
    b.close()
