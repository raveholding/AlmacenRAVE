# V26.54 · Fidelización ampliada + operación: monedero, gift cards, niveles, cumpleaños, cashback, ruleta/trivia,
# presupuestos, devoluciones parciales y mermas. Demo con datos de ejemplo.
import sys
from playwright.sync_api import sync_playwright
res=[];errs=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/demo.html'
CLOSE="document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())"
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.goto(URL+'#acceso');pg.wait_for_timeout(900);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    # datos de ejemplo
    chk(ev("S.fidDemo===1&&fidCfg().tiers.on&&fidCfg().game.on&&fidCfg().cb.on"),'la demo trae niveles, ruleta y Día de Cuenta Comercio encendidos')
    chk(ev("giftL().length>=2&&fidMov().length>=3&&quotes().length>=2&&mermasL().length>=2"),'la demo trae gift cards, monederos, presupuestos y mermas de ejemplo')
    chk(ev("giftBal(giftByCode('GC-DEMO-0001'))")==700000,'gift card de ejemplo con canje parcial: queda $ 7.000 de $ 10.000')
    for sc in ['monedero','fidplus','presup','mermas','fidel','clientes']:
        ev("go('%s')"%sc);pg.wait_for_timeout(250)
        chk(ev("curScreen")==sc and len(pg.inner_text('#view'))>200,'pantalla «%s» abre con contenido'%sc)
    side=pg.inner_text('#side')
    chk('Monedero y gift cards' in side and 'Niveles, cumpleaños y juegos' in side and 'Presupuestos' in side and 'Mermas y devoluciones' in side,'aparecen en el menú (Clientes y fidelización / Operación)')
    # caja abierta para operar
    ev("if(!openSess()){S.sessions.push({id:'fx-s',caja:S.tenant.caja,openedBy:'ADMIN',openedAt:Date.now(),opening:0});save();}")
    cid=ev("S.customers.find(c=>c.status!=='baja').id")
    ev("S.cfg.fid.cb.dows=[];S.cfg.fid.game.on=false;S.cfg.fid.tiers.on=false;S.cfg.fid.bday.on=false;save()")
    b0=ev("walBal('%s')"%cid)
    m0=ev("S.movs.length")
    e=ev("walLoad('%s',1500000,'efectivo','cobr')"%cid)
    chk(e=='' and ev("walBal('%s')"%cid)==b0+1500000 and ev("S.movs.length")==m0+1 and ev("S.movs[S.movs.length-1].type==='ingreso'&&S.movs[S.movs.length-1].amount===1500000"),'carga de monedero en efectivo: suma saldo y entra a la caja con rubro')
    chk(ev("walLoad('%s',0,'efectivo','cobr')"%cid)!='' and ev("walLoad('%s',1000,'fiado','cobr')"%cid)!='','carga en cero o «a fiado» rechazada')
    # venta con monedero
    pid=ev("(S.products.find(p=>p.active&&!isKit(p)&&p.unit==='u'&&p.price>0&&p.price<1000000&&!noPromo({rubro:p.rubro}))||S.products.find(p=>p.active&&!isKit(p)&&p.unit==='u'&&p.price>0)).id")
    pr=ev("prod('%s').price"%pid)
    L="[{pid:'%s',name:'x',rubro:prod('%s').rubro,qty:1,price:%d,cost:0,unit:'u',list:%d}]"%(pid,pid,pr,pr)
    r=ev("(()=>{const r=commitSale('monedero',false,'local',%s,{custId:'%s',noAdj:true});return r.err||r.sale.id})()"%(L,cid))
    chk(len(r)>5 and ev("walBal('%s')"%cid)==b0+1500000-pr,'venta pagada con monedero descuenta el saldo (%s)'%r[:60])
    sid=r
    chk(ev("arqueoCalc(openSess(),arqInputs(openSess())).aPrep")>=pr,'el arqueo separa lo pagado con saldo prepago (no es dinero nuevo del turno)')
    r2=ev("(()=>{const r=commitSale('monedero',false,'local',%s,{noAdj:true});return r.err||'ok'})()"%L)
    chk('identificar' in r2,'monedero sin cliente rechazado')
    big=ev("(()=>{const r=commitSale('monedero',false,'local',[{pid:'%s',name:'x',rubro:prod('%s').rubro,qty:500,price:%d,cost:0,unit:'u',list:%d}],{custId:'%s',noAdj:true});return r.err||'ok'})()"%(pid,pid,pr,pr,cid))
    chk('insuficiente' in big,'saldo insuficiente rechazado sin tocar stock (%s)'%big[:50])
    # anulación revierte el pago con monedero
    bb=ev("walBal('%s')"%cid);ev("voidCore(S.sales.find(s=>s.id==='%s'),'prueba')"%sid)
    chk(ev("walBal('%s')"%cid)==bb+pr,'anular la venta devuelve el saldo al monedero')
    # Día de Cuenta Comercio
    ev("S.cfg.fid.cb={on:true,dows:[new Date(now()).getDay()],pct:10};save()")
    r=ev("(()=>{const r=commitSale('monedero',false,'local',%s,{custId:'%s',noAdj:true});return r.err||r.sale.cashback})()"%(L,cid))
    chk(r==round(pr*0.10),'Día de Cuenta Comercio: pagando todo con monedero recibe 10 %% de cashback (%s)'%r)
    ev("S.cfg.fid.cb.on=false;save()")
    # gift card
    g=ev("(()=>{const r=giftSell({amount:2000000,method:'efectivo',holder:'Regalo prueba',months:6});return r.err||r.g.code})()")
    chk(g.startswith('GC-') and len(g)==12,'se emite una gift card con código GC-XXXX-XXXX (%s)'%g)
    r=ev("(()=>{const r=commitSale('giftcard',false,'local',%s,{gift:'%s',noAdj:true});return r.err||r.sale.gift})()"%(L,g.lower()))
    chk(r==g and ev("giftBal(giftByCode('%s'))"%g)==2000000-pr,'canje parcial al portador (el código no distingue mayúsculas): queda saldo')
    r=ev("(()=>{const r=commitSale('giftcard',false,'local',%s,{gift:'GC-NOPE-0000',noAdj:true});return r.err||'ok'})()"%L)
    chk('código' in r or 'Escribí' in r,'gift card inexistente rechazada')
    gn=ev("(()=>{const r=giftSell({amount:500000,method:'debito',cust:'%s'});return r.g.code})()"%cid)
    other=ev("S.customers.filter(c=>c.status!=='baja')[1].id")
    r=ev("(()=>{const r=commitSale('giftcard',false,'local',%s,{gift:'%s',custId:'%s',noAdj:true});return r.err||'ok'})()"%(L,gn,other))
    chk('nominativa' in r,'gift card nominativa: otro cliente no la puede usar')
    # mixto monedero + efectivo
    ev("walLoad('%s',100000,'transferencia')"%cid)
    w=ev("walBal('%s')"%cid);tot=pr
    if w<tot: ev("walLoad('%s',%d,'transferencia')"%(cid,tot)); w=ev("walBal('%s')"%cid)
    part=min(w,tot-100) if tot>100 else 0
    if part>0:
        r=ev("(()=>{const r=commitSale('mixto',false,'local',%s,{custId:'%s',pays:[{m:'monedero',a:%d},{m:'efectivo',a:%d}],noAdj:true});return r.err||'ok'})()"%(L,cid,part,tot-part))
        chk(r=='ok' and ev("walBal('%s')"%cid)==w-part,'pago mixto monedero + efectivo')
    # niveles
    ev("S.cfg.fid.tiers={on:true,days:180,list:[{k:'bronce',name:'Bronce',min:0,pct:0},{k:'plata',name:'Plata',min:1,pct:3},{k:'oro',name:'Oro',min:900000000,pct:7}]};save()")
    t=ev("custTier(custById('%s')).t.k"%cid)
    chk(t=='plata','el nivel se calcula solo por consumo (Plata)')
    bn=ev("applyBenefit(%s,'%s','')"%(L,cid))
    chk(bn['kind']=='tier' and bn['disc']==round(pr*0.03),'el nivel da su porcentaje en el cobro (%s)'%bn.get('label'))
    # cumpleaños: compite y gana el mayor, una vez por año
    ev("custById('%s').birth=(()=>{const d=new Date(now());return '1990-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');})();S.cfg.fid.bday={on:true,pct:15};save()"%cid)
    bn=ev("applyBenefit(%s,'%s','')"%(L,cid))
    chk(bn['kind']=='cumple' and 'no se acumula' in (bn.get('note') or ''),'cumpleaños 15 %% le gana al nivel 3 %% (no se acumulan)')
    ev("(()=>{commitSale('efectivo',false,'local',%s,{custId:'%s',recv:%d*2,noAdj:true});})()"%(L,cid,pr))
    bn=ev("applyBenefit(%s,'%s','')"%(L,cid))
    chk(bn['kind']=='tier','el regalo de cumpleaños se usa una sola vez por año')
    # ruleta
    ev("S.cfg.fid.game=Object.assign({},FID_DEF.game,{on:true,min:0,mode:'ruleta',prizes:[{id:'a',label:'+1 sello',kind:'stamps',v:1,w:1}]});save()")
    sale=ev("(()=>{const r=commitSale('efectivo',false,'local',%s,{custId:'%s',recv:%d*2,noAdj:true});return r.sale.id})()"%(L,cid,pr))
    ev("receiptModal(S.sales.find(s=>s.id==='%s'),null)"%sale);pg.wait_for_timeout(300)
    chk(pg.locator('[data-act=gamePlay]').count()==1,'después del cobro aparece «Girar la ruleta»')
    st0=ev("stampsOf('%s')"%cid);pg.locator('[data-act=gamePlay]').click();pg.wait_for_timeout(3700)
    chk(ev("stampsOf('%s')"%cid)==st0+1 and '+1 sello' in pg.inner_text('#modal-root'),'la ruleta acredita el premio (+1 sello) y lo muestra')
    chk(not ev("gameEligible(S.sales.find(s=>s.id==='%s'))"%sale),'una sola jugada por venta')
    ev(CLOSE);ev("voidCore(S.sales.find(s=>s.id==='%s'),'prueba ruleta')"%sale)
    chk(ev("stampsOf('%s')"%cid)==st0,'anular la venta revierte el premio de la ruleta')
    # trivia con cupón
    ev("S.cfg.fid.game.mode='trivia';S.cfg.fid.game.trivia=[{q:'¿2+2?',o:['3','4','5'],ok:1}];S.cfg.fid.game.prizes=[{id:'c',label:'10 % próxima',kind:'coupon',v:10,w:1}];save()")
    sale=ev("(()=>{const r=commitSale('efectivo',false,'local',%s,{custId:'%s',recv:%d*2,noAdj:true});return r.sale.id})()"%(L,cid,pr))
    ev("A.gamePlay({dataset:{id:'%s'}})"%sale);pg.wait_for_timeout(300)
    pg.locator('#modal-root input[name=tv][value="1"]').check();pg.locator('#modal-root .ov').last.locator('.mf [data-m=ok]').click();pg.wait_for_timeout(3800)
    cp=ev("(gameL().find(x=>x.sale==='%s')||{}).code||''"%sale)
    chk(cp.startswith('PREMIO') and ev("(()=>{const c=S.coupons.find(x=>x.code==='%s');return !!c&&c.maxUses===1&&c.public===false})()"%cp),'trivia acertada → cupón privado de un solo uso (%s)'%cp)
    ev(CLOSE)
    # sin conexión con la nube: no se gasta saldo
    ev("CLOUD.on=true")
    r=ev("(()=>{try{cl.ready=true;cl.online=false;}catch(e){} const r=commitSale('monedero',false,'local',%s,{custId:'%s',noAdj:true});return r.err||'ok'})()"%(L,cid))
    ev("CLOUD.on=false;try{cl.ready=false}catch(e){}")
    chk('Sin conexión' in r,'con la nube y sin conexión no se gasta saldo de monedero')
    # presupuesto
    ev("go('vender')");pg.wait_for_timeout(300)
    stk=ev("prod('%s').stock"%pid)
    ev("pos.lines=%s;pos.cust='';posCart()"%L);pg.wait_for_timeout(200)
    chk(pg.locator('[data-act=qtSave]').count()==1,'Vender ofrece «Guardar como presupuesto»')
    pg.locator('[data-act=qtSave]').click();pg.wait_for_timeout(300);pg.fill('#qt-n','Cliente prueba');pg.locator('#modal-root .ov').last.locator('.mf [data-m=ok]').click();pg.wait_for_timeout(500)
    ev(CLOSE)
    q=ev("quotes()[quotes().length-1]")
    chk(q['custName']=='Cliente prueba' and ev("prod('%s').stock"%pid)==stk and ev("pos.lines.length")==0,'el presupuesto se guarda y NO descuenta stock')
    ev("A.qtLoad({dataset:{id:'%s'}})"%q['id']);pg.wait_for_timeout(400)
    chk(ev("curScreen")=='vender' and ev("pos.lines.length")==1 and ev("pos.quote")==q['id'],'convertir lo carga en Vender')
    r=ev("(()=>{const r=commitSale('efectivo',false,'local',pos.lines,{recv:%d*2,quote:pos.quote,noAdj:true});return r.err||r.sale.n})()"%pr)
    chk(ev("qtState(quotes().find(x=>x.id==='%s'))"%q['id'])=='convertido' and ev("prod('%s').stock"%pid)==stk-1,'al cobrar queda convertido y recién ahí descuenta stock')
    ev("pos.lines=[];pos.quote=''")
    # devolución parcial
    sale=ev("(()=>{const r=commitSale('efectivo',false,'local',[{pid:'%s',name:'x',rubro:prod('%s').rubro,qty:3,price:%d,cost:0,unit:'u',list:%d}],{recv:%d*3,noAdj:true});return r.sale.id})()"%(pid,pid,pr,pr,pr))
    stk=ev("prod('%s').stock"%pid);mv=ev("S.movs.length")
    ev("saleDetailOpen('%s')"%sale);pg.wait_for_timeout(300)
    chk(pg.locator('[data-act=devOpen]').count()==1,'el detalle de la venta ofrece «Devolución parcial»')
    pg.locator('[data-act=devOpen]').click();pg.wait_for_timeout(300)
    pg.fill('#dv-q0','1');pg.fill('#dv-m','no le gustó');pg.wait_for_timeout(100)
    pg.locator('#modal-root .ov').last.locator('.mf [data-m=ok]').click();pg.wait_for_timeout(400)
    chk(ev("prod('%s').stock"%pid)==stk+1 and ev("S.movs.length")==mv+1 and ev("S.movs[S.movs.length-1].type==='egreso'"),'devuelve 1 de 3: vuelve al stock y sale el efectivo de la caja')
    r=ev("devCommit(S.sales.find(s=>s.id==='%s'),[{i:0,qty:3}],'efectivo','de más').err||''"%sale)
    chk('hasta 2' in r,'no se puede devolver más de lo que queda (%s)'%r[:50])
    ev(CLOSE)
    # merma
    ev("go('inventario')");pg.wait_for_timeout(300)
    stk=ev("prod('%s').stock"%pid);n=ev("mermasL().length")
    ev("A.padj({dataset:{id:'%s'}})"%pid);pg.wait_for_timeout(300)
    pg.fill('#aj-d','2');pg.select_option('#aj-t','rotura');pg.fill('#aj-m','cayó del estante');pg.locator('#modal-root .ov').last.locator('.mf [data-m=ok]').click();pg.wait_for_timeout(300)
    chk(ev("prod('%s').stock"%pid)==stk-2 and ev("mermasL().length")==n+1 and ev("mermasL()[mermasL().length-1].tipo")=='rotura','una rotura resta stock (aunque se escriba positivo) y queda valorizada')
    ev("go('mermas')");pg.wait_for_timeout(300)
    chk('cayó del estante' in pg.inner_text('#view') and 'no le gustó' in pg.inner_text('#view'),'el reporte muestra mermas y devoluciones')
    # monedero desde la pantalla
    ev("go('monedero')");pg.wait_for_timeout(300)
    pg.fill('#fw-q',ev("custById('%s').name"%cid));pg.wait_for_timeout(200)
    pg.locator('#fw-res [data-act=walLoad]').first.click();pg.wait_for_timeout(300)
    pg.fill('#wl-a','1000');pg.select_option('#wl-m','transferencia');w0=ev("walBal('%s')"%cid)
    pg.locator('#modal-root .ov').last.locator('.mf [data-m=ok]').click();pg.wait_for_timeout(300)
    chk(ev("walBal('%s')"%cid)==w0+100000,'cargar saldo desde la pantalla Monedero')
    # responsive
    pg.set_viewport_size({'width':360,'height':800})
    for sc in ['monedero','fidplus','presup','mermas']:
        ev("go('%s')"%sc);pg.wait_for_timeout(250)
        ov=ev("document.documentElement.scrollWidth<=window.innerWidth+1")
        chk(ov,'a 360 px «%s» no se desborda'%sc)
    chk(not errs,'sin errores %s'%errs[:2])
    b.close()
print('%d/%d'%(sum(res),len(res)))
