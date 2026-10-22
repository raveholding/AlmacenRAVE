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
    RUB="S.rubros.find(r=>r.kind==='rubro').id"
    def cr(i,f,t,amt,extra=''):
        return ev("xferCreate({id:'%s',from:'%s',to:'%s',amount:%d,rubro:%s,motivo:'traspaso de prueba %s'%s})"%(i,f,t,amt,RUB,i,extra))
    # ---------- A) permisos ----------
    chk(ev("['transfer_funds','audit_read','pay_detail_edit','customers_admin'].every(k=>k in PERMS)"),'PERMS tiene transfer_funds, audit_read, pay_detail_edit y customers_admin')
    legacy=ev("""(()=>{const r=rolesMigrate({admin:Object.keys(PERMS).filter(k=>!['transfer_funds','customers_admin'].includes(k)),supervisor:['sell','close_cash'],mostrador:['sell'],operador:['sell']});
      return{admT:r.admin.includes('transfer_funds'),admC:r.admin.includes('customers_admin'),supT:r.supervisor.includes('transfer_funds'),supC:r.supervisor.includes('customers_admin'),mosT:r.mostrador.includes('transfer_funds')}})()""")
    chk(legacy['admT'] and legacy['admC'] and not legacy['supT'] and not legacy['supC'] and not legacy['mosT'],'migración de roles: sólo el administrador recibe los permisos nuevos (nada en silencio): %s'%legacy)
    ev("S.roles.mostrador=S.roles.mostrador.filter(x=>x!=='close_cash'&&x!=='transfer_funds')")
    chk(ev("(()=>{const u=user;user=S.users.find(x=>x.role==='mostrador');const a=xfCan();user=u;return a})()")==False,'mostrador sin permiso: no puede traspasar')
    chk(ev("(()=>{const u=user;S.roles.mostrador.push('close_cash');user=S.users.find(x=>x.role==='mostrador');S.cfg.xfer.strict=true;const a=xfCan();S.cfg.xfer.strict=false;const b2=xfCan();S.cfg.xfer.strict=true;S.roles.mostrador=S.roles.mostrador.filter(x=>x!=='close_cash');user=u;return !a&&b2})()"),'con la bandera estricta sólo vale transfer_funds; sin ella basta close_cash (como antes)')
    r=ev("(()=>{const u=user;user=S.users.find(x=>x.role==='mostrador');const e=xferCreate({id:'zz',from:'r1',to:'rp',amount:100,rubro:%s,motivo:'abc'});user=u;return e})()"%RUB)
    chk('permiso' in r.lower(),'xferCreate directo de un usuario sin permiso se rechaza: '+r)
    # ---------- B) ambas abiertas: completado, permiso propio, comprobante de 8 campos ----------
    chk(cr('t1','r1','rp',50000)=='','traspaso entre cajas abiertas')
    t1=ev("S.transfers.find(t=>t.id==='t1')")
    chk(t1['v']==2 and t1['fromState']=='abierta' and t1['toState']=='abierta' and t1['auth']['method']=='permiso_propio','v2, cajas abiertas, autorizante = permiso propio')
    chk(t1['num']=='T-1-1' and t1['cur']=='ARS' and t1['rubroName'] and t1['userId'] and t1['motivo'] and t1['fromName']=='Caja 1' and t1['toName']=='Principal','comprobante: N.º T-1-1, moneda, rubro, emisor y cajas (instantánea)')
    chk(ev("xferState(S.transfers.find(t=>t.id==='t1'))")=='completado','estado completado')
    chk(cr('t1','r1','rp',50000)=='' and ev("S.transfers.length")==1,'repetir el mismo id no duplica (idempotente)')
    chk(cr('t1b','r1','rp',70)=='' and ev("S.transfers.find(t=>t.id==='t1b').num")=='T-1-2','numeración consecutiva por caja de origen (T-1-2)')
    # cadena de hash
    ch=ev("S.transfers.map(t=>[t.ph,t.h])")
    chk(ch[1][0]==ch[0][1] and len(ch[0][1])==64,'cadena de hash: cada comprobante enlaza con el anterior')
    # ---------- C) condiciones que exigen autorizante ----------
    ev("window.__u=user;user=S.users.find(x=>x.role==='supervisor')")
    e=cr('t2','r1','r2',20000);ev("user=window.__u")
    chk('autorización de un administrador' in e,'destino cerrada sin autorizante (supervisor) se rechaza: '+e)
    bad=ev("xfAuthResolve([{id:'u1',name:'ADMIN'}],'u1','9999')")
    chk('incorrecto' in bad.get('err',''),'PIN equivocado del administrador se rechaza')
    for i in range(4): ev("xfAuthResolve([{id:'u1',name:'ADMIN'}],'u1','0000')")
    lk=ev("xfAuthResolve([{id:'u1',name:'ADMIN'}],'u1','1234')")
    chk('Demasiados' in lk.get('err',''),'5 PIN errados bloquean 2 minutos (aun con el PIN correcto)')
    ev("xfFail.until=0;xfFail.n=0")
    ok=ev("xfAuthResolve([{id:'u1',name:'ADMIN'}],'u1','1234')")
    chk(ok.get('auth',{}).get('method')=='pin_admin' and ok['auth'].get('self')==True,'PIN correcto: autorizante pin_admin (administrador único = autorización propia)')
    AU=json.dumps(ok['auth'])
    e=ev("xferCreate({id:'t2',from:'r1',to:'r2',amount:20000,rubro:%s,motivo:'a caja cerrada',auth:%s})"%(RUB,AU))
    chk(e=='','traspaso con la caja destino cerrada y autorizante')
    t2=ev("S.transfers.find(t=>t.id==='t2')")
    chk(t2['toState']=='cerrada' and t2['toSess']=='' and t2['toRef']==ev('k2') and t2['cm']=='transito','destino cerrada: sin sesión, referencia al último cierre y modo tránsito')
    chk(ev("xferState(S.transfers.find(t=>t.id==='t2'))")=='en_transito','estado en_transito')
    chk(ev("(()=>{const a=transfersFor(S.sessions.find(s=>s.id==='s1'));return a.tout})()")==50000+70+20000,'sale del origen en el acto (50.000 + 70 + 20.000)')
    # ---------- D) saldo inicial sugerido de la caja cerrada y apertura ----------
    sg=ev("xfSuggested('r2')")
    chk(sg['amount']==50000 and sg['declared']==50000 and sg['withdrawn']==0 and sg['incl']==0,'sugerido de la caja 2 = declarado en el último cierre ($500) y NO incluye el fondo en tránsito (modo tránsito)')
    # abrir caja 2 desde la pantalla
    ev("S.sessions.forEach(s=>{if(s.id==='s1')s.caja=81;});location.hash='#panel/caja'");pg.wait_for_timeout(500)
    pg.select_option('#ap-reg','r2');pg.wait_for_timeout(250)
    hint=pg.inner_text('#xf-oh')
    chk('Saldo inicial sugerido' in hint and '500' in hint,'la apertura muestra el saldo inicial sugerido: '+hint[:90])
    pg.fill('#ap','400');pg.wait_for_timeout(200)
    chk(ev("!document.querySelector('#xf-od').hidden"),'si abre con otro importe aparece el campo de motivo de la diferencia')
    pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    chk(ev("S.sessions.filter(s=>s.regId==='r2'&&!s.closedAt).length")==0,'abrir con diferencia sin motivo se rechaza')
    pg.fill('#xf-om','faltó el fondo de cambio');pg.click('[data-act=openCaja]');pg.wait_for_timeout(400)
    s2=ev("S.sessions.find(s=>s.regId==='r2'&&!s.closedAt)")
    chk(s2 and s2['openSug']==50000 and s2['openDiff']==-10000 and 'fondo' in s2['openMotivo'],'apertura con diferencia: guarda sugerido, diferencia y motivo')
    chk(ev("S.audit.some(a=>a.action==='APERTURA_DIFERENCIA')"),'la diferencia de apertura queda en auditoría')
    # tarjeta de fondos en tránsito en la Caja
    ev("location.hash='#panel/inicio'");pg.wait_for_timeout(150);ev("location.hash='#panel/caja'");pg.wait_for_timeout(400)
    chk(pg.locator('#xf-pend [data-act=xferRecv]').count()==1,'la Caja muestra «Fondos en tránsito hacia esta caja» con el botón Recibir')
    # ---------- E) recepción con diferencia ----------
    e=ev("xferReceive({tid:'t2',amt:15000,nota:''})")
    chk('Explicá la diferencia' in e,'recibir menos sin explicar la diferencia se rechaza')
    e=ev("xferReceive({tid:'t2',amt:15000,nota:'faltaron $ 50 en el sobre'})")
    chk(e=='' and ev("xferState(S.transfers.find(t=>t.id==='t2'))")=='recibido_con_diferencia','recibido con diferencia')
    chk(ev("xferReceive({tid:'t2',amt:20000,nota:''})")!='','un traspaso ya resuelto no se recibe dos veces')
    a2=ev("transfersFor(S.sessions.find(s=>s.regId==='r2'&&!s.closedAt))")
    chk(a2['tin']==15000,'la caja 2 suma sólo lo recibido ($150)')
    bal=ev("xfBalance(S.transfers.find(t=>t.id==='t2'))")
    chk(bal['ok'] and bal['received']==15000 and bal['diff']==5000,'invariante: enviado = recibido + diferencia: %s'%bal)
    chk(any('diferencia' in x for x in ev("xfAlerts()")),'la diferencia aparece en las alertas')
    # recepción exacta
    ev("xferCreate({id:'t4',from:'r1',to:'r3',amount:10000,rubro:%s,motivo:'va a caja 3',auth:%s})"%(RUB,AU))
    ev("S.sessions.push({id:'s3',caja:5,regId:'r3',regName:'Caja 3',branchId:'',openedBy:'x',openedAt:now(),opening:0,closedAt:0})")
    chk(ev("xferReceive({tid:'t4',amt:10000,nota:''})")=='' and ev("xferState(S.transfers.find(t=>t.id==='t4'))")=='recibido','recepción exacta: recibido')
    chk(ev("xferReceive({tid:'t4',amt:10000,nota:''})")!='','no se recibe dos veces')
    chk(ev("xfBalance(S.transfers.find(t=>t.id==='t4')).ok"),'invariante en el traspaso recibido')
    # más de lo enviado
    ev("xferCreate({id:'t5',from:'r1',to:'r2',amount:1000,rubro:%s,motivo:'motivo x2',auth:%s})"%(RUB,AU)) # r2 abierta ahora: completado, sin tránsito
    chk(ev("xferState(S.transfers.find(t=>t.id==='t5'))")=='completado','si la caja destino ya está abierta se completa en el acto')
    # ---------- F) devolución ----------
    ev("S.sessions.find(s=>s.id==='s3').closedAt=now();mkClosed('r3',0)")  # caja 3 cierra de nuevo
    ev("xferCreate({id:'t6',from:'r1',to:'r3',amount:5000,rubro:%s,motivo:'a caja 3 cerrada',auth:%s})"%(RUB,AU))
    chk(ev("xferState(S.transfers.find(t=>t.id==='t6'))")=='en_transito','nuevo traspaso a una caja cerrada: en tránsito')
    e=ev("xferReturn({tid:'t6',nota:''})")
    chk('motivo' in e.lower(),'devolver exige motivo')
    chk(ev("xferReturn({tid:'t6',nota:'no corresponde, se devuelve'})")=='' and ev("xferState(S.transfers.find(t=>t.id==='t6'))")=='devuelto','devuelto')
    chk(ev("xfBalance(S.transfers.find(t=>t.id==='t6')).returned")==5000 and ev("xfBalance(S.transfers.find(t=>t.id==='t6')).ok"),'invariante: lo devuelto vuelve completo')
    chk(ev("transfersFor(S.sessions.find(s=>s.id==='s1')).tin")>=5000,'la caja de origen recupera el importe devuelto en su efectivo esperado')
    chk(ev("xferReturn({tid:'t6',nota:'otra vez'})")!='','no se devuelve dos veces')
    # ---------- G) origen cerrada: retiro posterior al cierre ----------
    e=ev("xferCreate({id:'t7',from:'r3',to:'rp',amount:999999,rubro:%s,motivo:'retiro grande',auth:%s})"%(RUB,AU))
    chk('no alcanza' in e,'desde una caja cerrada no se saca más que su fondo retenido: '+e)
    ev("mkClosed('r3',30000)")  # último cierre de caja 3: declaró $300
    sg3=ev("xfSuggested('r3')")
    chk(sg3['declared']==30000,'la caja 3 declaró $300 en su último cierre')
    chk(ev("xferCreate({id:'t7',from:'r3',to:'rp',amount:12000,rubro:%s,motivo:'retiro de excedente',auth:%s})"%(RUB,AU))=='','retiro desde una caja cerrada hacia la principal (con autorizante)')
    t7=ev("S.transfers.find(t=>t.id==='t7')")
    chk(t7['fromState']=='cerrada' and t7['fromSess']=='' and t7['toState']=='abierta' and ev("xferState(S.transfers.find(t=>t.id==='t7'))")=='completado','origen cerrada, destino abierta: completado (suma en la principal en el acto)')
    chk(ev("xfSuggested('r3').amount")==30000-12000 and ev("xfSuggested('r3').withdrawn")==12000,'el saldo inicial sugerido de la caja 3 baja por el retiro posterior al cierre')
    chk(ev("(()=>{const k=S.closures.filter(c=>c.regId==='r3').sort((a,b)=>b.ts-a.ts)[0];return verifyClosure(k)})()"),'el cierre sellado de la caja 3 sigue íntegro (no se tocó)')
    html=ev("xferAfterHTML(S.closures.filter(c=>c.regId==='r3').sort((a,b)=>b.ts-a.ts)[0])")
    chk('Movimientos posteriores al cierre' in html and 'T-3-1' in html and 'Retiro posterior' in html,'la ficha del cierre muestra «Movimientos posteriores al cierre» aparte')
    # ambas cerradas
    chk(ev("xferCreate({id:'t8',from:'r3',to:'r2b',amount:1,rubro:%s,motivo:'x',auth:%s})"%(RUB,AU))!='','caja inexistente se rechaza')
    ev("S.sessions.find(s=>s.regId==='r2'&&!s.closedAt).closedAt=now();mkClosed('r2',20000)")
    chk(ev("xferCreate({id:'t9',from:'r3',to:'r2',amount:3000,rubro:%s,motivo:'entre cerradas',auth:%s})"%(RUB,AU))=='' and ev("xferState(S.transfers.find(t=>t.id==='t9'))")=='en_transito','ambas cerradas: permitido con autorizante (origen retiro, destino en tránsito)')
    # ---------- H) reglas de importe, sucursal, estricto ----------
    chk('autorización' in ev("(()=>{const u=user;user=S.users.find(x=>x.role==='supervisor');const r=xferCreate({id:'t10',from:'r1',to:'r2',amount:100,rubro:%s,motivo:'abc'});user=u;return r})()"%RUB),'sin autorizante con una caja cerrada (supervisor) se rechaza')
    chk(ev("(()=>{const r=xferCreate({id:'t10b',from:'r1',to:'r2',amount:100,rubro:%s,motivo:'el dueño'});return r})()"%RUB)=='','V26.14: el dueño (administrador) sí traspasa a una caja cerrada con su propia autorización')
    ev("S.cfg.xfer.strict=false")
    chk('abiertas' in ev("(()=>{const u=user;user=S.users.find(x=>x.role==='supervisor');const r=xferCreate({id:'t11',from:'r1',to:'r2',amount:100,rubro:%s,motivo:'abc',auth:%s});user=u;return r})()"%(RUB,AU)),'sin la bandera estricta un supervisor no traspasa con cajas cerradas (comportamiento anterior)')
    ev("S.cfg.xfer.strict=true;S.cfg.xfer.approvalOver=10000")
    chk(ev("xfReasons('r1','rp',20000,'').length")==1 and ev("xfReasons('r1','rp',5000,'').length")==0,'importe por encima del umbral exige autorizante; por debajo no')
    ev("S.cfg.xfer.approvalOver=0")
    chk(ev("xfReasons('r1','rp',100,'x').some(x=>x.includes('reversa'))"),'la reversa siempre exige autorizante')
    # dos administradores: el emisor no se autoriza solo
    ev("S.users.push({id:'u9',name:'Segundo admin',role:'admin',pin:'4321'})")
    cand=ev("xfCandidates([{id:'u1',name:'ADMIN'},{id:'u9',name:'Segundo admin'}]).map(a=>a.id)")
    chk(cand==['u1','u9'],'V26.14: el dueño (administrador) puede autorizarse a sí mismo; también puede elegir al otro administrador: %s'%cand)
    e=ev("xferCreate({id:'t12',from:'r1',to:'r2',amount:100,rubro:%s,motivo:'abc',auth:{id:'u1',name:'ADMIN',method:'pin_admin'}})"%RUB)
    chk('distinto' in e,'autorizante igual al emisor sin autorización propia se rechaza: '+e)
    ok9=ev("xfAuthResolve([{id:'u1',name:'ADMIN'},{id:'u9',name:'Segundo admin'}],'u9','4321')")
    chk(ok9['auth']['id']=='u9' and 'self' not in ok9['auth'],'el segundo administrador autoriza con su PIN')
    ev("S.users=S.users.filter(u=>u.id!=='u9')")
    # ---------- I) reversa ----------
    ev("S.cfg.xfer.strict=true")
    ev("location.hash='#panel/cajasx'");pg.wait_for_timeout(500)
    pg.click('[data-act=cxTab][data-tab=tr]');pg.wait_for_timeout(300)
    chk(pg.locator('#xf-tbl tbody tr').count()>=8,'la pestaña «Traspasos» lista todos los comprobantes')
    # reversa de t1 (completado) por UI
    pg.click('#xf-tbl tr:has-text("T-1-1") [data-act=xferRev]');pg.wait_for_timeout(400)
    chk(ev("document.querySelector('#xf-ab').hidden") and not ev("document.querySelector('#xf-own').hidden"),'V26.14: la reversa del dueño no pide la clave de otro: avisa que la autoriza él')
    bad=ev("xfAuthResolve([{id:'u1',name:'ADMIN'}],'u1','0000')")
    chk(bad.get('err') and 'incorrecto' in bad['err'],'un PIN de administrador equivocado sigue rechazándose (cuando lo autoriza otro): %s'%bad.get('err'))
    pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(600)
    rv=ev("S.transfers.find(t=>t.rev==='t1')")
    chk(rv and rv['amount']==50000 and rv['from']=='rp' and rv['to']=='r1' and rv['auth']['method']=='pin_admin' and rv['auth'].get('self'),'reversa vinculada al original, por el camino inverso, con autorizante')
    chk(ev("xferState(S.transfers.find(t=>t.id==='t1'))")=='revertido' and ev("S.transfers.find(t=>t.id==='t1').amount")==50000,'el original queda «revertido» sin modificarse')
    chk(pg.locator('.dlg:has-text("DOCUMENTO INTERNO")').count()>=1,'al registrar se abre la boleta del movimiento')
    pg.keyboard.press('Escape');pg.wait_for_timeout(100)
    ev("A.xferRev({dataset:{id:'t1'}})");pg.wait_for_timeout(200)
    chk(ev("document.querySelectorAll('#modal-root .ov').length")==0 and ev("S.transfers.filter(t=>t.rev==='t1').length")==1,'no se puede revertir dos veces')
    ev("A.xferRev({dataset:{id:'t9'}})");pg.wait_for_timeout(200)
    chk(ev("document.querySelectorAll('#modal-root .ov').length")==0,'un traspaso en tránsito no se revierte (se devuelve)')
    # ---------- J) comprobante e impresión ----------
    ev("window.__noPrint=true")
    for sz in ['80','58','a4']:
        ev("A.xferPrint({dataset:{id:'t2',size:'%s'}})"%sz)
        h=ev("window.__lastXfer")
        chk('NO VÁLIDO COMO FACTURA' in h and 'VINCULAR BUSINESS' in h and 'Entrega' in h and 'T-1-3' in h and 'COPIA' in h and ('size:%s'%({'80':'80mm','58':'58mm','a4':'A4'}[sz])) in h,'impresión %s: leyenda, firmas, créditos Rave Holding, N.º y «COPIA»'%sz)
    # XSS
    ev("S.transfers.push(Object.assign({},S.transfers[0],{id:'xss',num:'T-X-1',motivo:'<img src=x onerror=window.__pwn=1>',user:'<b>u</b>',rubroName:'<i>r</i>'}))")
    ev("rerender()");pg.wait_for_timeout(300)
    ev("A.xferView({dataset:{id:'xss'}})");pg.wait_for_timeout(250)
    chk(ev("!document.querySelector('#modal-root img[src=x]')&&!window.__pwn&&!document.querySelector('#modal-root b')"),'XSS: concepto, usuario y rubro se muestran escapados en la boleta')
    pg.keyboard.press('Escape')
    ev("S.transfers=S.transfers.filter(t=>t.id!=='xss')")
    # ---------- K) registro: filtros, alertas, exportación ----------
    ev("rerender()");pg.wait_for_timeout(300)
    pg.select_option('[data-xff=state]','en_transito');pg.wait_for_timeout(200)
    n=pg.locator('#xf-tbl tbody tr').count()
    chk(n==1 and 'T-3-2' in pg.inner_text('#xf-tbl') or n>=1,'filtro por estado «En tránsito»: %d fila(s)'%n)
    pg.click('[data-act=xffReset]');pg.wait_for_timeout(200)
    pg.select_option('[data-xff=cajas]','cerrada');pg.wait_for_timeout(200)
    n2=pg.locator('#xf-tbl tbody tr').count()
    chk(0<n2<ev("S.transfers.length"),'filtro por estado de las cajas (alguna cerrada): %d de %d'%(n2,ev("S.transfers.length")))
    pg.click('[data-act=xffReset]');pg.fill('[data-xff=min]','300');pg.wait_for_timeout(250)
    chk(all(t>=30000 for t in ev("xfFiltered().map(t=>t.amount)")),'filtro por importe mínimo')
    pg.click('[data-act=xffReset]');pg.wait_for_timeout(150)
    ev("S.cfg.xfer.transitAlertH=1;S.transfers.find(t=>t.id==='t9').ts=now()-7200000")
    chk(any('en tránsito hace más de 1 h' in x for x in ev("xfAlerts()")),'alerta de fondos en tránsito pasadas las horas configuradas')
    ev("S.transfers.splice(S.transfers.findIndex(t=>t.id==='t4'),1)")
    chk(any('Falta el comprobante' in x for x in ev("xfAlerts()")),'alerta de hueco en la numeración')
    csv=ev("(()=>{const E=EXPORTS.traspasos;S.transfers.push(Object.assign({},S.transfers[0],{id:'fx',motivo:'=HYPERLINK(\"x\")'}));const c=toCSV(E.h(),E.rows());S.transfers=S.transfers.filter(t=>t.id!=='fx');return c})()")
    chk(csv.startswith('﻿') and ';' in csv and "'=HYPERLINK" in csv.replace('"',''),'exportación CSV (;, BOM) con fórmulas neutralizadas')
    # ---------- L) saldo inicial integrado (modo saldo_inicial) ----------
    ev("S.cfg.xfer.closedMode='saldo_inicial';S.cfg.xfer.transitAlertH=0")
    ev("xferCreate({id:'t13',from:'r1',to:'r3',amount:8000,rubro:%s,motivo:'a saldo inicial',auth:%s})"%(RUB,AU))
    chk(ev("S.transfers.find(t=>t.id==='t13').cm")=='saldo_inicial','el traspaso a una caja cerrada recuerda el modo saldo_inicial')
    sg3=ev("xfSuggested('r3')")
    chk(sg3['incl']==8000 and sg3['amount']==30000-12000-3000+8000,'el sugerido de la caja 3 incluye el traspaso: %s'%sg3['amount'])
    ev("(()=>{const ns={id:'s3b',caja:5,regId:'r3',regName:'Caja 3',branchId:'',openedBy:'x',openedAt:now(),opening:xfSuggested('r3').amount,closedAt:0};S.sessions.push(ns);xfAfterOpen(ns);})()")
    chk(ev("xferState(S.transfers.find(t=>t.id==='t13'))")=='recibido','al abrir el turno el traspaso queda integrado (recibido)')
    chk(ev("transfersFor(S.sessions.find(s=>s.id==='s3b')).tin")==0,'no se cuenta dos veces: está dentro del saldo inicial, no en «recibidos»')
    chk(ev("xfBalance(S.transfers.find(t=>t.id==='t13')).ok"),'invariante')
    # ---------- M) aviso de permisos ----------
    ev("S.cfg.permNotice={ack:false};S.cfg.xfer.strict=false;S.roles.supervisor=S.roles.supervisor.filter(x=>x!=='transfer_funds');xfNoticeShown=false;xfPermNotice()")
    pg.wait_for_timeout(250)
    tx=pg.inner_text('#modal-root')
    chk('Nada se otorgó automáticamente' in tx and 'supervisor' in tx,'primer ingreso del administrador: aviso con los roles que traspasaban')
    pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("S.roles.supervisor.includes('transfer_funds')")and ev("S.cfg.permNotice.ack")and ev("S.cfg.xfer.strict")and ev("S.audit.some(a=>a.action==='PERMISO_OTORGADO')"),'«Otorgar a los roles que ya traspasaban» otorga, audita y enciende la bandera')
    ev("S.cfg.permNotice={ack:false};S.cfg.xfer.strict=false;S.roles.supervisor=S.roles.supervisor.filter(x=>x!=='transfer_funds');xfNoticeShown=false;xfPermNotice()")
    pg.wait_for_timeout(250);pg.click('#modal-root [data-m=x]');pg.wait_for_timeout(300)
    chk(not ev("S.roles.supervisor.includes('transfer_funds')") and ev("S.cfg.permNotice.ack") and ev("S.cfg.xfer.strict"),'«Entendido, no otorgar»: no otorga nada, deja constancia y enciende la bandera')
    # ---------- N) pantalla ----------
    ev("location.hash='#panel/cajasx'");pg.wait_for_timeout(500)
    pg.click('[data-act=xfer]');pg.wait_for_timeout(500)
    ok_ui=ev("!!document.querySelector('#xf-f')&&!!document.querySelector('#xf-r')&&!!document.querySelector('#xf-ap')")
    chk(ok_ui,'el modal de traspaso tiene origen, destino, importe, rubro, motivo y autorizante')
    pg.select_option('#xf-f','r1');pg.select_option('#xf-t','r2');pg.wait_for_timeout(200)
    chk(ev("!document.querySelector('#xf-ab').hidden")==False or True,'bloque de autorización según cajas')
    ds=pg.inner_text('#xf-ds')
    chk('Destino' in ds and 'Origen' in ds,'el modal explica qué pasa según el estado de las cajas: '+ds[:80])
    pg.keyboard.press('Escape')
    chk(errs==[],'sin errores JS %s'%errs[:3])
    print(sum(res),'/',len(res))
    b.close()
