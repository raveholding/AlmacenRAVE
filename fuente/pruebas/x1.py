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
    # ---- perfil mayorista sin rubros: el traspaso no pide rubro ----
    ev("S.sessions.find(x=>x.id==='s1').opening=500000;save()")
    e=ev("xferCreate({id:'n1',from:'r1',to:'rp',amount:10000,rubro:'',motivo:'retiro a principal'})")
    chk('rubro' in e.lower(),'por defecto (Almacén RAVE) el traspaso SIGUE pidiendo rubro: %s'%e)
    n0=ev("S.rubros.length")
    ev("S.cfg.xfer.noRubro=true;save()")
    e=ev("xferCreate({id:'n2',from:'r1',to:'rp',amount:10000,rubro:'',motivo:'retiro a principal'})")
    t=ev("S.transfers.find(x=>x.id==='n2')")
    chk(e=='' and t and t['rubroName']=='Traspaso interno' and t['amount']==10000,'sin rubros: el traspaso se crea con «Traspaso interno» (%s)'%e)
    chk(ev("S.rubros.length")==n0+1 and ev("rub('sys-traspaso').sys===true"),'se crea una sola vez el concepto interno oculto')
    ev("xferCreate({id:'n3',from:'r1',to:'rp',amount:5000,rubro:'',motivo:'otro retiro'})")
    chk(ev("S.rubros.filter(r=>r.id==='sys-traspaso').length")==1,'no se duplica el concepto interno')
    chk(ev("S.rubros.filter(r=>!r.sys&&r.kind!=='cobr').every(r=>r.id!=='sys-traspaso')") and 'Traspaso interno' not in ev("(()=>{movModal('egreso');const t=document.querySelector('#modal-root').innerText;return t})()"),'el concepto interno no aparece al cargar un egreso')
    chk(ev("S.rubros.filter(r=>r.kind==='rubro').every(r=>r.id!=='sys-traspaso')"),'no aparece entre los rubros del negocio (inventario, cierre)')
    ev("xfOpenModal({})");pg.wait_for_timeout(400)
    chk(pg.locator('#xf-r').count()==0,'el formulario de traspaso no muestra el campo Rubro en el perfil sin rubros')
    chk(not errs,'sin errores de consola: '+str(errs[:3]))
    print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
    b.close()
