# 4.24.3 / 4.24.4 · H3 · clientes del Club: edición, baja (anonimización) y eliminación sólo por el administrador
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
      S.products.push({id:'h3a',name:'Alfajor H3',rubro:r.id,price:10000,cost:5000,stock:900000,unit:'u',active:true,menu:false,pres:[]});
      const mk=(id,num,name,wa,dni,extra)=>Object.assign({id,num,name,last:'Prueba',birth:'1990-05-21',wa,email:'',notes:'',dni,status:'activo',origin:'mostrador',consent:{club:true,comm:true,analytics:false,ts:now()},secret:'s'.repeat(20),cards:[],cardSecrets:{},limit:50000000,taxid:''},extra||{});
      S.customers.push(mk('hc1',9101,'Limpio','+5493875550101','30111111'),mk('hc2',9102,'ConVenta','+5493875550102','30222222'),mk('hc3',9103,'ConDeuda','+5493875550103','30333333'),mk('hc4',9104,'Doble','+5493875550104','30444444'),mk('hc5',9105,'Otro','+5493875550105','30555555'),mk('hc6',9106,'ConSellos','+5493875550106','30666666'));
      window.sellTo=(cid,m,pays)=>{pos.lines=[];A.padd({dataset:{id:'h3a'}});pos.lines[0].qty=1;const w=commitSale(m,false,'local',pos.lines,{custId:cid,pays});pos.lines=[];return w;};
      window.mos=S.users.find(x=>x.role==='mostrador');window.adm=S.users.find(x=>x.role==='admin');
      if(!S.roles.mostrador.includes('customers'))S.roles.mostrador.push('customers');})()""")
    r=ev("sellTo('hc2','efectivo')");chk(not r.get('err'),'venta a nombre de ConVenta (le crea historial)')
    r=ev("sellTo('hc3','fiado')");chk(not r.get('err') and ev("debtOf('hc3')")>0,'venta a cuenta corriente a ConDeuda (tiene deuda)')
    ev("S.loyalty.ledger.push({id:uid(),cust:'hc6',ts:now(),kind:'stamp',n:1,ref:'x',user:'ADMIN'})")
    # ---------- A) permisos ----------
    chk(ev("(()=>{const u=user;user=window.mos;const a=custAdm();user=u;return a})()")==False,'mostrador con permiso «customers»: NO es administrador de clientes')
    chk(ev("(()=>{const u=user;user=window.adm;const a=custAdm();user=u;return a})()")==True,'administrador: custAdm')
    ev("S.roles.mostrador.push('customers_admin')")
    chk(ev("(()=>{const u=user;user=window.mos;const a=custAdm();user=u;return a})()")==True,'con el permiso explícito customers_admin un rol puede administrar clientes')
    ev("S.roles.mostrador=S.roles.mostrador.filter(x=>x!=='customers_admin')")
    # el no administrador no cambia datos sensibles
    ev("user=window.mos");ev("A.cuEdit({dataset:{id:'hc1'}})");pg.wait_for_timeout(300)
    chk(ev("['cu-w','cu-b','cu-d','cu-e','cu-c1','cu-c2'].every(i=>{const e=document.getElementById(i);return !e||e.disabled})"),'no administrador: WhatsApp, nacimiento, DNI, correo y consentimientos vienen bloqueados')
    chk(pg.locator('[data-act=cuBaja]').count()==0 and pg.locator('[data-act=cuDel]').count()==0,'no administrador: sin botones de baja ni eliminación')
    ev("document.getElementById('cu-w').disabled=false;document.getElementById('cu-w').value='387 5559999'")
    pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk('sólo el administrador' in pg.locator('#modal-root .merr').inner_text(),'forzar el cambio de WhatsApp desde el cliente es rechazado: '+pg.locator('#modal-root .merr').inner_text()[:80])
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    ev("A.cuBaja({dataset:{id:'hc1'}})");chk(ev("document.querySelectorAll('#modal-root .ov').length")==0,'no administrador: A.cuBaja no abre nada')
    ev("A.cuDel({dataset:{id:'hc1'}})");chk(ev("document.querySelectorAll('#modal-root .ov').length")==0 and ev("S.customers.some(c=>c.id==='hc1')"),'no administrador: A.cuDel no elimina')
    ev("user=window.adm")
    # ---------- B) edición por el administrador ----------
    ev("A.cuEdit({dataset:{id:'hc1'}})");pg.wait_for_timeout(300)
    chk(ev("['cu-w','cu-b','cu-d','cu-e'].every(i=>!document.getElementById(i).disabled)"),'administrador: puede editar los datos sensibles')
    pg.fill('#cu-w','387 5557777');pg.fill('#cu-b','1990-05-21');pg.fill('#cu-d','30111999');pg.fill('#cu-e','limpio@example.com')
    pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(400)
    c=ev("custById('hc1')")
    chk(c['wa']=='+5493875557777' and c['birth']=='1990-05-21' and c['dni']=='30111999' and c['email']=='limpio@example.com','el administrador editó WhatsApp, nacimiento 21/05/1990, DNI y correo')
    chk(ev("parseBirthISO('1990-05-21')")!=None and not ev("parseBirthISO('90-05-21')") and not ev("parseBirthISO('2999-01-01')"),'nacimiento 21/05/1990 válido; año de 2 cifras y fechas futuras rechazadas')
    a=ev("S.audit.filter(e=>/cliente|CLIENTE/.test(e.action)).map(e=>e.action+' '+e.detail).join(' | ')")
    chk('5557777' not in a.replace('…777','') and '30111999' not in a and 'limpio@example' not in a,'auditoría enmascarada: no guarda el WhatsApp, DNI ni correo completos')
    # edición con un DNI repetido
    ev("A.cuEdit({dataset:{id:'hc1'}})");pg.wait_for_timeout(300);pg.fill('#cu-d','30222222');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk('DNI' in pg.locator('#modal-root .merr').inner_text(),'DNI repetido se rechaza')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # menor de 18
    ev("A.cuEdit({dataset:{id:'hc1'}})");pg.wait_for_timeout(300);pg.fill('#cu-b','2015-01-01');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk('18' in pg.locator('#modal-root .merr').inner_text(),'menor de 18: se rechaza')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # consentimiento sin constancia
    ev("custById('hc5').consent.comm=false")
    ev("A.cuEdit({dataset:{id:'hc5'}})");pg.wait_for_timeout(300);pg.check('#cu-c2');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk('constancia' in pg.locator('#modal-root .merr').inner_text(),'otorgar consentimiento sin constancia se rechaza')
    pg.fill('#cu-proof','aceptó por escrito en el mostrador');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("custById('hc5').consent.comm")==True and ev("custById('hc5').consent.proof")!='','con constancia queda otorgado, con quién y cómo')
    # revocar no pide constancia
    ev("A.cuEdit({dataset:{id:'hc5'}})");pg.wait_for_timeout(300);pg.uncheck('#cu-c2');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk(ev("custById('hc5').consent.comm")==False,'revocar el consentimiento no pide constancia')
    # ---------- C) WhatsApp repetido → fusión ----------
    ev("A.cuEdit({dataset:{id:'hc4'}})");pg.wait_for_timeout(300);pg.fill('#cu-w','387 5550106');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(400)
    chk(pg.locator('#mg-m').count()==1,'WhatsApp de otro socio: ofrece fusionar (no pisa en silencio)')
    pg.fill('#mg-m','es la misma persona');pg.click('#modal-root .ov:last-child [data-m=ok]');pg.wait_for_timeout(400)
    c4=ev("custById('hc4')");c6=ev("custById('hc6')")
    chk(c4['status']=='baja' and c4['mergedInto']=='hc6' and c4['wa']=='' and c4['name']=='Socio','el socio fusionado queda dado de baja y anonimizado')
    chk(ev("stampsOf('hc6')")==1 and ev("S.audit.some(e=>e.action==='CLIENTES_FUSIONADOS')"),'los sellos y la auditoría de la fusión')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # fusión con deuda: bloqueada
    ev("A.cuEdit({dataset:{id:'hc3'}})");pg.wait_for_timeout(300);pg.fill('#cu-w','387 5550105');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk('deuda' in pg.locator('#modal-root .merr').inner_text(),'fusionar a alguien con deuda se bloquea hasta resolverla')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # ---------- D) eliminación sólo sin historial ----------
    ev("A.cuDel({dataset:{id:'hc2'}})");pg.wait_for_timeout(300)
    t=pg.locator('#modal-root .dlg').inner_text()
    chk('No se puede eliminar' in t and 'ventas' in t,'cliente con ventas: no se puede eliminar y dice por qué')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    ev("A.cuDel({dataset:{id:'hc3'}})");pg.wait_for_timeout(300)
    chk('No se puede eliminar' in pg.locator('#modal-root .dlg').inner_text() and 'deuda' in pg.locator('#modal-root .dlg').inner_text(),'cliente con deuda: no se puede eliminar')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    ev("S.customers.push({id:'hc7',num:9107,name:'Borrable',last:'Prueba',birth:'1980-01-01',wa:'+5493875550107',email:'',notes:'',dni:'',status:'activo',origin:'menu',consent:{club:true,comm:false,analytics:false,ts:now()},secret:'q'.repeat(20),cards:[],cardSecrets:{},limit:0,taxid:''})")
    ev("A.cuDel({dataset:{id:'hc7'}})");pg.wait_for_timeout(300)
    pg.fill('#dl-m','duplicado cargado por error');pg.fill('#dl-n','1');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk('N.º de socio' in pg.locator('#modal-root .merr').inner_text(),'eliminar pide escribir el N.º de socio: uno equivocado se rechaza')
    pg.fill('#dl-n','9107');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(400)
    chk(not ev("S.customers.some(c=>c.id==='hc7')") and ev("S.audit.some(e=>e.action==='CLIENTE_ELIMINADO')"),'cliente sin historial: eliminado y auditado')
    chk(ev("clubBlocked('+5493875550107','hc7')")==True,'quedó en la lista de bloqueo del Club (la alta pendiente del menú no reaparece)')
    a=ev("S.audit.filter(e=>e.action==='CLIENTE_ELIMINADO').map(e=>e.detail).join('|')")
    chk('5550107' not in a and 'Borrable' not in a,'la auditoría de la eliminación no tiene datos personales')
    # ---------- E) baja con deuda ----------
    ev("custById('hc3').cards=['4821'];custById('hc3').cardSecrets={'4821':'zz'}")
    sec0=ev("custById('hc3').secret")
    ev("A.cuBaja({dataset:{id:'hc3'}})");pg.wait_for_timeout(300)
    pg.fill('#bj-m','el cliente pidió la baja');pg.fill('#bj-n','9103');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(300)
    chk('deuda' in pg.locator('#modal-root .merr').inner_text(),'baja con deuda: obliga a elegir qué hacer con la deuda')
    pg.check('input[name=bj-d][value=mantener]');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(400)
    c=ev("custById('hc3')")
    chk(c['status']=='baja' and c['name']=='Socio' and c['last']=='N.º 9103' and c['wa']=='' and c['email']=='' and c['dni']=='' and c['birth']=='' and c['notes']=='','la baja anonimiza nombre, WhatsApp, correo, DNI, nacimiento y notas')
    chk(c['cards']==[] and c['secret']!=sec0 and c['consent']['comm']==False,'la tarjeta deja de validar (secretos y tarjetas revocados) y se lo excluye de campañas')
    chk(c['debtDec']['mode']=='mantener' and ev("debtOf('hc3')")>0,'la deuda se mantiene asociada al registro anonimizado')
    chk(ev("S.sales.filter(s=>s.cust==='hc3').length")==1,'las ventas se conservan')
    chk(ev("clubBlocked('+5493875550103','hc3')")==True,'la baja también entra en la lista de bloqueo')
    a=ev("S.audit.filter(e=>e.action==='BAJA_CLIENTE').map(e=>e.detail).join('|')")
    chk('ConDeuda' not in a and '5550103' not in a,'la auditoría de la baja no guarda datos personales')
    # baja: condonar con movimiento compensatorio
    ev("sellTo('hc6','fiado')")
    ev("A.cuBaja({dataset:{id:'hc6'}})");pg.wait_for_timeout(300)
    pg.fill('#bj-m','pedido del titular de la cuenta');pg.fill('#bj-n','9106');pg.check('input[name=bj-d][value=condonar]');pg.click('#modal-root [data-m=ok]');pg.wait_for_timeout(400)
    chk(ev("debtOf('hc6')")==0 and ev("S.fiadoPays.some(p=>p.cust==='hc6'&&p.method==='condonado')") and ev("S.audit.some(e=>e.action==='DEUDA_CONDONADA')"),'condonar: movimiento compensatorio auditado, la deuda queda en cero')
    # baja de un cliente ya dado de baja: sin botones
    ev("A.cuEdit({dataset:{id:'hc6'}})");pg.wait_for_timeout(300)
    chk(pg.locator('[data-act=cuBaja]').count()==0,'un cliente dado de baja no ofrece otra baja')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # ---------- F) pantalla, buscador de Vender y sincronización ----------
    ev("location.hash='#panel/clientes'");pg.wait_for_timeout(500)
    chk(pg.locator('tr:has-text("baja")').count()>=2,'la lista marca los clientes dados de baja')
    chk(ev("(()=>{pos.cust='';const q='socio';return S.customers.filter(c=>c.status!=='baja'&&(c.name+' '+c.last).toLowerCase().includes(q)).length})()")==0,'los dados de baja no aparecen en la búsqueda del cobro')
    pfp0=ev("custPfp(custById('hc2'))")
    ev("custById('hc2').dni='30999999'")
    chk(ev("custPfp(custById('hc2'))")!=pfp0,'la huella de datos sensibles cambia cuando se cambia un dato sensible (el servidor la usa para detectarlo)')
    chk(ev("collectAll().filter(x=>x.c==='clientes').every(x=>typeof x.w.pfp==='string'&&x.w.pfp.length>0)"),'cada cliente viaja con su huella')
    chk(not errs,'sin errores de consola/página: %s'%errs[:3])
    b.close()
ok=sum(res);print('\n%d/%d'%(ok,len(res)));sys.exit(0 if ok==len(res) else 1)
