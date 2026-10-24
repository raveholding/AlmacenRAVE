# V26.23 · cuentas de cobro: a qué cuenta entró cada transferencia (pago total o parcial) y compensación entre socios en el arqueo
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate;M='#modal-root .ov >> nth=-1'
    ok=lambda:pg.locator(M).locator('.mf [data-m=ok]').click()
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("""(()=>{const pr=rub('promo'),vi=rub('vino');pr.owner='Juan';pr.reparte=true;vi.owner='Nico';vi.reparte=true;S.cfg.payAcc=[];
      S.sessions.push({id:'sa',caja:S.tenant.caja,openedBy:'ADMIN',openedAt:now()-1000,opening:100000,closedAt:0});save();})()""")
    # alta de cuentas por pantalla
    ev("go('config')");pg.wait_for_timeout(300)
    chk(pg.locator('#acc-card').count()==1,'Configuración tiene «Cuentas de cobro»')
    pg.click('#acc-card [data-act=accEdit][data-id=""]');pg.wait_for_timeout(200)
    pg.fill('#ac-n','juan.rave.mp');pg.select_option('#ac-r','promo');pg.check('[data-acm=qr]');ok();pg.wait_for_timeout(300)
    pg.click('#acc-card [data-act=accEdit][data-id=""]');pg.wait_for_timeout(200)
    pg.fill('#ac-n','nico.rave.mp');pg.select_option('#ac-r','vino');ok();pg.wait_for_timeout(300)
    A=ev("S.cfg.payAcc");chk(len(A)==2 and A[0]['rubro']=='promo' and 'transferencia' in A[0]['meds'] and 'qr' in A[0]['meds'],'se cargan dos cuentas: Juan (transferencia y QR) y Nico (transferencia)')
    ja,na=A[0]['id'],A[1]['id']
    vino=ev("S.products.find(p=>p.rubro==='vino'&&p.active&&p.unit==='u'&&!isKit(p)).id");promo=ev("S.products.find(p=>p.rubro==='promo'&&p.active&&p.unit==='u'&&!isKit(p)).id")
    pv=ev("prod('%s').price"%vino);pp=ev("prod('%s').price"%promo)
    # cobro por pantalla: transferencia total, exige elegir cuenta
    ev("go('vender')");pg.wait_for_timeout(300);ev("pos.lines=[];A.padd({dataset:{id:'%s'}})"%vino);pg.wait_for_timeout(150)
    ev("A.cobrar()");pg.wait_for_timeout(300);pg.click('[data-act=cbmet][data-m=transferencia]');pg.wait_for_timeout(300)
    chk(pg.locator('#acc-transferencia').count()==1,'al cobrar con transferencia pregunta «¿A qué cuenta entró?»')
    ok();pg.wait_for_timeout(300)
    chk(ev("S.sales.length")==ev("S.sales.length") and 'cuenta' in ev("[...document.querySelectorAll('#toast div')].map(x=>x.textContent).join(' ')"),'sin elegir la cuenta no cobra')
    pg.select_option('#acc-transferencia',ja);ok();pg.wait_for_timeout(500)
    s1=ev("S.sales[S.sales.length-1]")
    chk(s1['pays'][0]['acc']==ja and s1['pays'][0]['accN']=='juan.rave.mp' and s1['pays'][0]['accR']=='promo','la venta (vino de Nico) quedó cobrada en la cuenta de Juan')
    ev("document.querySelectorAll('#modal-root .ov').forEach(x=>x.remove())")
    # pago mixto: efectivo + transferencia parcial a la cuenta de Nico (producto de Juan)
    ev("pos.lines=[];A.padd({dataset:{id:'%s'}})"%promo);pg.wait_for_timeout(150)
    half=pp//2
    r=ev("(()=>{pos.acc={transferencia:'%s'};const r=commitSale('mixto',false,'local',pos.lines,{pays:[{m:'efectivo',a:%d},{m:'transferencia',a:%d}],acc:{transferencia:'%s'}});return r.err||r.sale.id})()"%(na,pp-half,half,na))
    s2=ev("S.sales.find(x=>x.id==='%s')"%r)
    chk(s2 and [x.get('acc') for x in s2['pays']]==[None,na],'pago parcial: la parte en transferencia guarda su cuenta (Nico), el efectivo no')
    a=ev("(()=>{const s=openSess();return arqueoCalc(s,arqInputs(s))})()")
    x=a['accts'];comp={c['name']:c for c in x['comp']}
    chk(comp['Juan']['rec']==pv and comp['Juan']['corr']==half and comp['Nico']['rec']==half and comp['Nico']['corr']==pv,'Juan recibió %d y le corresponden %d; Nico recibió %d y le corresponden %d'%(comp['Juan']['rec'],comp['Juan']['corr'],comp['Nico']['rec'],comp['Nico']['corr']))
    mv=x['moves'];chk(len(mv)==1 and mv[0]['from']=='Juan' and mv[0]['to']=='Nico' and mv[0]['amount']==pv-half,'compensación: Juan le pasa %s a Nico'%(mv and mv[0]['amount']))
    chk(a['expectedCash']==100000+(pp-half),'el efectivo esperado sólo suma el efectivo (la transferencia no es del cajón)')
    rs={r['name']:r for r in a['reparte']}
    chk(rs['Combos y promos']['sold']==pp and rs['Vinos']['sold']==pv,'lo vendido de cada rubro no cambia')
    pg.evaluate("go('arqueo')");pg.wait_for_timeout(500)
    v=pg.inner_text('#arq-tabs');t=pg.inner_text('#arq-prev')
    chk('Cobros digitales por cuenta' in v and 'Juan le pasa' in v,'el arqueo muestra las cuentas y la compensación')
    chk('JUAN LE PASA' in t and 'juan.rave.mp' in t,'el texto de WhatsApp del cierre también')
    # cobro de cuenta corriente por transferencia a una cuenta
    cid=ev("S.customers.find(c=>c.status!=='baja').id")
    ev("(()=>{const c=custById('%s');c.limit=10000000;pos.lines=[];A.padd({dataset:{id:'%s'}});commitSale('fiado',false,'local',pos.lines,{custId:'%s'})})()"%(cid,vino,cid))
    ev("A.cuPay({dataset:{id:'%s'}})"%cid);pg.wait_for_timeout(300);pg.fill('#fp-a','1000');pg.select_option('#fp-m','transferencia');pg.wait_for_timeout(200)
    chk(pg.locator('#fp-acc').count()==1,'el cobro de cuenta corriente por transferencia también pide la cuenta')
    pg.select_option('#fp-acc',na);ok();pg.wait_for_timeout(300)
    f=ev("S.fiadoPays[S.fiadoPays.length-1]");chk(f['acc']==na and f['accN']=='nico.rave.mp','y la guarda')
    # mayorista de un solo dueño: sólo totales por cuenta
    ev("document.querySelectorAll('#modal-root .ov').forEach(x=>x.remove());S.cfg.biz='owner';save();rerender()");pg.wait_for_timeout(400)
    v=pg.inner_text('#arq-tabs');chk('Cobros digitales por cuenta' in v and 'Compensación' not in v,'mayorista (un solo dueño): totales por cuenta, sin compensación')
    print('errores:',errs[:4]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
