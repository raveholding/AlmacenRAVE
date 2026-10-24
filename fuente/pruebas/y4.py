# V26.25b · con NUBE (CLOUD.on simulado): el administrador elimina socios con historial (datos borrados, oculto en todas las listas) · Fidelización muestra los socios; el administrador elimina socios (con o sin historial); envío de tarjeta con estado de Wallet
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    ev=pg.evaluate
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("""(()=>{const r=S.rubros.find(r=>r.kind==='rubro'&&!r.age&&!r.alcohol)||S.rubros.find(r=>r.kind==='rubro');
      const mk=(id,num,name)=>({id,num,name,last:'Y4',birth:'1990-05-21',wa:'+54938755'+num,email:'',notes:'',dni:'3'+num+'111',status:'activo',origin:'mostrador',consent:{club:true,comm:true,analytics:false,ts:now()},secret:'s'.repeat(20),cards:[],cardSecrets:{},limit:50000000,taxid:''});
      S.customers.push(mk('y4a',8801,'SinNada'),mk('y4b',8802,'ConSellos'),mk('y4c',8803,'ConDeuda'));
      S.loyalty.ledger.push({id:uid(),cust:'y4b',ts:now(),kind:'stamp',n:1,ref:'x',user:'ADMIN'});
      S.products.push({id:'y4p',name:'Alfajor Y4',rubro:r.id,price:10000,cost:5000,stock:900000,unit:'u',active:true,menu:false,pres:[]});save();})()""")
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    r=ev("(()=>{pos.lines=[];A.padd({dataset:{id:'y4p'}});pos.lines[0].qty=1;const w=commitSale('fiado',false,'local',pos.lines,{custId:'y4c'});pos.lines=[];return {err:w&&w.err,d:debtOf('y4c'),id:(S.sales.slice(-1)[0]||{}).id}})()")
    chk(r['d']>0,'venta a cuenta corriente para ConDeuda');ev("window.y4sid="+repr(r['id']))
    ev("CLOUD.on=true");chk(ev("custDelHistOk()")==False,'nube simulada activa')
    ev("location.hash='#panel/fidel'");pg.wait_for_timeout(500)
    chk(pg.locator('#fd-soc-t').count()==1,'Fidelización muestra la tabla de socios')
    t=pg.locator('#fd-soc-t').inner_text()
    chk('SinNada' in t and 'ConSellos' in t and 'ConDeuda' in t,'los socios aparecen en Fidelización')
    pg.fill('#fd-q','8802');pg.wait_for_timeout(300)
    t=ev("[...document.querySelectorAll('#fd-soc-t tbody tr')].filter(r=>!r.hidden).map(r=>r.innerText).join(' ')")
    chk('ConSellos' in t and 'SinNada' not in t,'el buscador de socios filtra por N.º')
    pg.fill('#fd-q','');pg.wait_for_timeout(300)
    chk(pg.locator('#fd-soc-t [data-act=cuDel]').count()>=3 and pg.locator('#fd-soc-t [data-act=cuCardLink]').count()>=3,'administrador: Eliminar y Enviar tarjeta en cada socio')
    # enviar tarjeta: estado de Wallet visible
    pg.locator('#fd-soc-t [data-act=cuCardLink][data-id=y4a]').click();pg.wait_for_timeout(300)
    t=pg.locator('#modal-root .dlg').last.inner_text()
    chk('Apple Wallet' in t and 'Google Wallet' in t,'al enviar la tarjeta se informa el estado de Wallet y las alternativas')
    chk('pantalla de inicio' in pg.locator('#cl-wa').get_attribute('href').replace('%20',' ').replace('+',' ') or 'pantalla' in pg.locator('#cl-wa').get_attribute('href'),'el mensaje de WhatsApp explica cómo guardarla')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # eliminar socio con sellos (historial)
    pg.locator('#fd-soc-t [data-act=cuDel][data-id=y4b]').click();pg.wait_for_timeout(300)
    pg.fill('#dl-m','pedido del titular');pg.fill('#dl-n','8802');pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(400)
    c=ev("(()=>{const c=S.customers.find(x=>x.id==='y4b');return c&&{st:c.status,e:c.elim,wa:c.wa,dni:c.dni,n:c.name}})()")
    chk(c and c['e']==1 and c['wa']=='' and c['dni']=='' and c['st']=='baja','socio con historial: se borran sus datos y queda eliminado')
    chk('ConSellos' not in pg.locator('#fd-soc-t').inner_text(),'ya no aparece en Fidelización')
    ev("location.hash='#panel/clientes'");pg.wait_for_timeout(400)
    chk('8802' not in ev('document.body.innerText') or 'eliminado' not in ev('document.body.innerText'),'ya no aparece en Clientes')
    chk(ev("S.loyalty.ledger.some(e=>e.cust==='y4b')"),'los sellos (libro) se conservan')
    # eliminar socio sin historial: se borra el registro
    ev("location.hash='#panel/fidel'");pg.wait_for_timeout(400)
    pg.locator('#fd-soc-t [data-act=cuDel][data-id=y4a]').click();pg.wait_for_timeout(300)
    pg.fill('#dl-m','pedido del titular');pg.fill('#dl-n','8801');pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(400)
    chk(ev("!S.customers.some(x=>x.id==='y4a')"),'socio sin historial: se borra el registro (también con nube)')
    # con deuda: pide decidir; condonar y eliminar
    pg.locator('#fd-soc-t [data-act=cuDel][data-id=y4c]').click();pg.wait_for_timeout(300)
    pg.fill('#dl-m','acuerdo con el titular');pg.fill('#dl-n','8803');pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(300)
    chk(ev("S.customers.find(x=>x.id==='y4c').elim")!=1,'con deuda y sin decidir: no elimina')
    pg.locator('input[name=dl-d][value=condonar]').check();pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(400)
    c=ev("(()=>{const c=S.customers.find(x=>x.id==='y4c');return {e:c.elim,d:debtOf('y4c'),dd:c.debtDec&&c.debtDec.mode}})()")
    chk(c['e']==1 and c['d']<=0,'condonar y eliminar: deuda en cero y socio eliminado')
    chk(ev("S.sales.some(s=>s.id===window.y4sid)"),'la venta se conserva')
    chk(ev("S.audit.some(a=>a.action==='CLIENTE_ELIMINADO')"),'queda en auditoría')
    # no administrador
    ev("user=S.users.find(x=>x.role==='mostrador');if(!S.roles.mostrador.includes('customers'))S.roles.mostrador.push('customers');location.hash='#panel/fidel';rerender()");pg.wait_for_timeout(400)
    chk(pg.locator('#fd-soc-t [data-act=cuDel]').count()==0,'no administrador: sin botón Eliminar')
    pg.set_viewport_size({'width':360,'height':800});pg.wait_for_timeout(300)
    chk(ev("document.documentElement.scrollWidth<=362"),'360 px sin desborde')
    chk(not errs,'sin errores de consola '+str(errs[:2]))
    b.close()
print(f"\n{sum(res)}/{len(res)}")
