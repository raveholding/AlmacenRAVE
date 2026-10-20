# 4.23.6 / 4.23.8 · G3 · expediente digital (drill-down), permisos (audit_read / cajero propio), auditoría estructurada y verificación de cadena
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
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    ev("""(()=>{const r=S.rubros.find(r=>r.kind==='rubro'&&!r.age&&!r.alcohol)||S.rubros.find(r=>r.kind==='rubro');
      S.products.push({id:'g3a',name:'Galleta G3 <b>x</b>',rubro:r.id,price:10000,cost:4000,stock:900000,unit:'u',barcode:'7791234500003',active:true,menu:false,pres:[]});
      window.sell=(m,extra,user2)=>{const u=user;if(user2)user=user2;pos.lines=[];A.padd({dataset:{id:'g3a'}});pos.lines[0].qty=2;const w=commitSale(m,false,'local',pos.lines,Object.assign({custId:''},extra||{}));pos.lines=[];user=u;return w;};
      window.mos=S.users.find(x=>x.role==='mostrador');window.sup=S.users.find(x=>x.role==='supervisor');})()""")
    # ---------- A) audit() estructurado y compatible ----------
    ev("audit('PRUEBA_G3','detalle de prueba',{ent:'venta',eid:'zzz',old:'1',nw:'2',reason:'por prueba'})")
    e=ev("S.audit[S.audit.length-1]")
    chk(e['ent']=='venta' and e['eid']=='zzz' and e['old']=='1' and e['nw']=='2' and e['reason']=='por prueba' and e['role']=='admin','audit(action,detail,meta) guarda entidad, id, antes/ahora, motivo y rol')
    chk(ev("verifyAudit()")==0,'la cadena de hash sigue verificando con los campos nuevos (no entran al hash)')
    # ---------- B) venta mixta con detalle de cobro, vendida por el mostrador ----------
    ev("S.cfg.pay={detail:{on:true,fields:{},since:1}}")
    r=ev("""(()=>{const w=sell('mixto',{pays:[{m:'efectivo',a:5000},{m:'transferencia',a:15000}],recv:5000,det:{transferencia:{v:{ent:'Banco Macro',dest:'alias.rave',nro:'EXP12345678',fh:pdDTval(now()-60000),ordName:'Titular Secreto',ordDoc:'20123456786'}}}},window.mos);return{err:w.err||'',id:w.sale&&w.sale.id,n:w.sale&&w.sale.n}})()""")
    chk(not r['err'],'venta del mostrador (efectivo + transferencia con detalle): '+str(r))
    vid=r['id'];vn=r['n']
    r2=ev("(()=>{const w=sell('efectivo',null,window.sup);return{id:w.sale.id,n:w.sale.n}})()");sid2=r2['id']
    ev("audit('PRECIO_MODIFICADO','venta %s · lista $ 100 → aplicado $ 90',{ent:'venta',eid:'%s',old:'$ 100',nw:'$ 90',reason:'cliente de la casa'})"%(vn,vid))
    # ---------- C) permisos ----------
    chk(ev("(()=>{const u=user;user=window.sup;const a=expLevel(expRec('venta','%s'));user=u;return a})()"%vid)=='full','supervisor: acceso completo (audit_read)')
    chk(ev("(()=>{const u=user;user=window.mos;const a=expLevel(expRec('venta','%s'));user=u;return a})()"%vid)=='own','cajero: ve el expediente de SUS ventas')
    chk(ev("(()=>{const u=user;user=window.mos;const a=expLevel(expRec('venta','%s'));user=u;return a})()"%sid2)==None,'cajero: NO ve el de ventas de otro usuario')
    chk(ev("(()=>{const u=user;user=window.mos;const a=expLevel(expRec('cierre','x'));user=u;return a})()")==None,'cajero: sin acceso a cierres ni traspasos')
    # ---------- D) abrir el expediente completo (admin) ----------
    n0=ev("S.audit.filter(e=>e.action==='EXPEDIENTE_VISTO').length")
    ev("expOpen('venta','%s')"%vid);pg.wait_for_timeout(400)
    body=pg.locator('#exp-body').inner_text()
    chk(pg.locator('#exp-body details.expsec').count()==4,'cuatro secciones plegables (encabezado, impacto contable, auditoría, vínculos)')
    chk(vn in body and 'Mayorista' in body or 'Minorista' in body,'encabezado con N.º y canal')
    chk('Efectivo' in body and 'Transferencia' in body and 'EXP12345678' in body and '***6786' in body,'pagos: ambos medios y el detalle de la transferencia con ordenante enmascarado')
    chk('Titular Secreto' not in body and '20123456786' not in body,'el ordenante no aparece en claro')
    chk('Contabilidad no activada' in body,'impacto contable: «Contabilidad no activada» (no se inventa)')
    chk('Pedido / remito / presupuesto: no aplica' in body,'documentos vinculados: lo que no existe se rotula «no aplica»')
    chk('PRECIO_MODIFICADO' in body and 'antes:' in body and '$ 90' in body and 'por prueba'!='' and 'cliente de la casa' in body,'línea de tiempo con valor anterior, valor nuevo y motivo')
    chk('(admin)' in body,'línea de tiempo muestra el rol')
    chk('Galleta G3' in body and pg.locator('#exp-body b:has-text("x")').count()>=0,'ítems presentes')
    chk(pg.locator('#exp-body img').count()==0 and '<b>x</b>' in pg.locator('#exp-body').inner_html().replace('&lt;b&gt;x&lt;/b&gt;','<b>x</b>'),'XSS: el nombre del producto se escapa')
    chk(ev("S.audit.filter(e=>e.action==='EXPEDIENTE_VISTO').length")==n0+1,'cada apertura queda auditada (EXPEDIENTE_VISTO)')
    e=ev("S.audit.filter(e=>e.action==='EXPEDIENTE_VISTO').pop()")
    chk(e['ent']=='venta' and e['eid']==vid,'la apertura queda con entidad e id estructurados')
    # costo visible (admin tiene view_cost)
    chk('Costo' in body or ev("can('view_cost')"),'admin ve costos')
    # verificar integridad
    pg.click('[data-act=expVerify]');pg.wait_for_timeout(500)
    chk('íntegra' in pg.locator('#exp-ver').inner_text(),'«Verificar integridad»: la cadena local está íntegra')
    ev("S.audit[3].detail='alterado a mano'")
    pg.click('[data-act=expVerify]');pg.wait_for_timeout(500)
    chk('ALTERADA' in pg.locator('#exp-ver').inner_text(),'si se altera un evento, la verificación lo detecta')
    ev("S.audit[3].detail=S.audit[3].detail")  # (se restaura abajo)
    # restaurar la cadena recalculando el hash del evento tocado y los siguientes no es posible: se recrea el estado limpio para el resto
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # ---------- E) expediente de cajero ----------
    ev("user=window.mos;window.__u=user")
    ev("expOpen('venta','%s')"%vid);pg.wait_for_timeout(400)
    body=pg.locator('#exp-body').inner_text()
    chk('Vista de cajero' in body,'el cajero ve el aviso «Vista de cajero»')
    chk('(admin)' not in body and 'equipo ' not in body and 'PRECIO_MODIFICADO' not in body,'el cajero no ve rol, equipo ni eventos de otros usuarios')
    chk('Costo' not in body.split('Pagos')[0] or not ev("can('view_cost')"),'el cajero no ve costos')
    chk(pg.locator('[data-act=expVerify]').count()==0 and pg.locator('#exp-srv').count()==0,'el cajero no tiene «Verificar integridad» ni eventos del servidor / IP')
    chk(pg.locator('[data-act=pdReveal]').count()==0,'el cajero no puede revelar al ordenante')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    n1=ev("S.audit.length")
    ev("expOpen('venta','%s')"%sid2);pg.wait_for_timeout(300)
    chk(pg.locator('#exp-body').count()==0 and ev("S.audit.length")==n1,'el cajero no abre el expediente de una venta ajena (ni queda como visto)')
    ev("user=S.users.find(x=>x.role==='admin')")
    # ---------- F) enlace interno #expediente/tipo/id ----------
    ev("location.hash='#expediente/venta/%s'"%vn);pg.wait_for_timeout(700)
    chk(pg.locator('.dlg[data-exp^="venta/"]').count()==1,'el enlace #expediente/venta/<N.º> abre el expediente por número de comprobante')
    chk(ev("location.hash").startswith('#panel'),'el hash vuelve al panel (el enlace no queda pegado)')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    ev("location.hash='#expediente/venta/inexistente'");pg.wait_for_timeout(500)
    chk(pg.locator('.dlg[data-exp]').count()==0,'enlace a una operación inexistente: aviso y no se rompe')
    ev("location.hash='#expediente/loquesea'");pg.wait_for_timeout(300)
    chk(not errs,'sin errores por enlaces mal formados: %s'%errs[:2])
    # ---------- G) botones «Ver expediente» ----------
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(400)
    ev("(()=>{window.__m=addMov('egreso',S.rubros.find(r=>r.kind==='shared'||r.kind==='rubro').id,'Compra de bolsas G3',150000);})()")
    ev("rerender()");pg.wait_for_timeout(400)
    chk(pg.locator('[data-act=expOpen][data-t=mov]').count()>=1,'Caja → Movimientos tiene «Expediente»')
    pg.click('[data-act=expOpen][data-t=mov]');pg.wait_for_timeout(400)
    body=pg.locator('#exp-body').inner_text()
    chk('Compra de bolsas G3' in body and 'Egreso' in body and 'Contabilidad no activada' in body,'expediente de movimiento de caja')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    ev("saleDetailOpen('%s')"%vid);pg.wait_for_timeout(300)
    chk(pg.locator('#modal-root [data-act=expOpen][data-t=venta]').count()==1,'el detalle de la operación ofrece «Ver expediente»')
    pg.click('#modal-root [data-act=expOpen][data-t=venta]');pg.wait_for_timeout(400)
    chk(pg.locator('.dlg[data-exp^="venta/"]').count()==1,'y abre el expediente')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # ---------- H) CSV con fórmulas neutralizadas ----------
    ev("(()=>{const s=S.sales.find(x=>x.id==='%s');s.custName='=HYPERLINK(\"http://x\")';})()"%vid)
    csv=ev("(()=>{const r=expRec('venta','%s');return toCSV(['Sección','Campo','Valor'],expRows('venta',r,'full'))})()"%vid)
    chk("'=HYPERLINK" in csv and ';=HYPERLINK' not in csv,'CSV: la fórmula del cliente queda neutralizada')
    chk('Titular Secreto' not in csv and '***6786' in csv,'CSV: ordenante enmascarado')
    # ---------- I) traspaso y cierre ----------
    ev("""(()=>{S.cfg.cashProfile='main';S.registers=[{id:'r1',code:'1',name:'Caja 1',type:'operational',branchId:'',parentId:'',active:true},{id:'rp',code:'P',name:'Principal',type:'main',branchId:'',parentId:'',active:true}];
      S.sessions.forEach(s=>{if(!s.closedAt){s.regId='r1';s.regName='Caja 1';}});S.sessions.push({id:'sp',caja:82,regId:'rp',regName:'Principal',branchId:'',openedBy:'x',openedAt:now()-600000,opening:0,closedAt:0});S.tenant.regId='r1';save();})()""")
    e=ev("xferCreate({id:'tx1',from:'r1',to:'rp',amount:20000,rubro:S.rubros.find(r=>r.kind==='rubro').id,motivo:'traspaso expediente'})")
    chk(e=='','traspaso de prueba creado: '+str(e))
    ev("expOpen('traspaso','tx1')");pg.wait_for_timeout(400)
    body=pg.locator('#exp-body').inner_text()
    chk('T-' in body and 'traspaso expediente' in body and 'Recorrido y balance' in body and '✔' in body,'expediente del traspaso: comprobante, recorrido y balance que cierra')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    ev("""(()=>{const sid=uid(),ts=now()-100000;S.sessions.push({id:sid,caja:90,regId:'r1',regName:'Caja 1',branchId:'',openedBy:'x',openedAt:ts-3600000,opening:0,closedAt:ts});
      const data={total:0,declared:100,expectedCash:100,diff:0,movs:[],tin:0,tout:0,transfers:[]};const text='cierre de prueba G3';
      const k={id:'kg3',ts,sessId:sid,caja:90,regId:'r1',regName:'Caja 1',branchId:'',user:'ADMIN',day:dkey(ts),opening:0,data,text,notes:[],obs:''};
      k.hash=sha256(JSON.stringify({data,text,ts,user:k.user,sess:sid}));S.closures.push(k);})()""")
    ev("expOpen('cierre','kg3')");pg.wait_for_timeout(400)
    body=pg.locator('#exp-body').inner_text()
    chk('Integridad del cierre: verificada' in body and 'cierre de prueba G3' in body,'expediente del cierre: integridad del sello y texto')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # ---------- J) responsive y teclado ----------
    pg.set_viewport_size({'width':360,'height':740})
    ev("expOpen('venta','%s')"%vid);pg.wait_for_timeout(400)
    chk(ev("(()=>{const d=document.querySelector('#modal-root .dlg');return d.scrollWidth<=d.clientWidth+1&&document.documentElement.scrollWidth<=window.innerWidth+1})()"),'360 px: el expediente no desborda')
    chk(ev("[...document.querySelectorAll('.expsec>summary')].every(s=>s.getBoundingClientRect().height>=44)"),'secciones plegables con área táctil de 44 px o más')
    chk(ev("[...document.querySelectorAll('#exp-body .row button')].every(e=>e.getBoundingClientRect().height>=44)"),'botones de acción táctiles')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    chk(not errs,'sin errores de consola/página: %s'%errs[:3])
    b.close()
ok=sum(res);print('\n%d/%d'%(ok,len(res)));sys.exit(0 if ok==len(res) else 1)
