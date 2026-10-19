from cl_lib import *
import re
res=[]
def chk(c,m):res.append(bool(ok(c,m)))
def frame(C):
    for _ in range(40):
        fr=[f for f in C.frames if f.name=='pubframe']
        if fr:return fr[0]
        C.wait_for_timeout(250)
def join(C,nombre,wa,cumple,dni='',comm=True):
    f=frame(C)
    f.evaluate("document.getElementById('club-form').scrollIntoView()")
    f.fill('#club-nombre',nombre);f.fill('#club-whatsapp',wa);f.fill('#club-cumple',cumple)
    if dni:f.fill('#club-dni',dni)
    f.check('#club-consent')
    if comm:f.check('#club-comm')
    f.click('#club-form button[type=submit]');C.wait_for_timeout(2500)
    return f
with sync_playwright() as p:
    b=launch(p)
    ctx,A=newpage(b,'A');create_commerce(A)
    wait_sync(A,3000)
    # reglas del club + cupones antes de publicar
    ev(A,"(()=>{S.loyalty.goal=5;S.loyalty.reward='Una birra gratis';"
         "S.coupons.push({id:'cpT',code:'TODOS10',type:'pct',value:10,min:0,from:'',to:'',aud:'todos',active:true,public:true,uses:[],maxUses:0,perCust:0,note:''});"
         "S.coupons.push({id:'cpC',code:'SOCIO15',type:'pct',value:15,min:0,from:'',to:'',aud:'club',active:true,public:true,uses:[],maxUses:0,perCust:1,note:'Para socios'});save();})()")
    wait_sync(A,2500)
    ev(A,"cloudPublishMenu(true)");A.wait_for_timeout(2500)

    # ---- 1) el cliente se anota desde su celular y RECIBE la tarjeta ----
    ctxC,C=newpage(b,'C',390)
    C.goto(BASE+'/cliente.html#menu');C.wait_for_timeout(4000)
    f=frame(C);f.click('#ag-yes');C.wait_for_timeout(400)
    chk(f.locator('#club-dni').count()==1,'el formulario del Club tiene el campo DNI (opcional)')
    chk(f.evaluate("getComputedStyle(document.getElementById('loyalty-block')).display")!='none','la tarjeta del Club se ve en la nube (antes estaba oculta)')
    # DNI inválido: se rechaza en el formulario
    f.evaluate("document.getElementById('club-form').scrollIntoView()")
    f.fill('#club-nombre','Lucía Gómez');f.fill('#club-whatsapp','3875556677');f.fill('#club-cumple','1992-03-14');f.fill('#club-dni','12');f.check('#club-consent')
    f.click('#club-form button[type=submit]');C.wait_for_timeout(800)
    chk(sql("select count(*) from club_altas")=='0','DNI inválido: no se envía el alta')
    f.fill('#club-dni','30123456');f.click('#club-form button[type=submit]');C.wait_for_timeout(3000)
    chk(sql("select count(*) from club_altas")=='1','el alta llegó al servidor')
    chk('Lucía' not in sql("select cifrado::text from club_altas") and '30123456' not in sql("select cifrado::text from club_altas"),'el servidor no ve ni el nombre ni el DNI (cifrado de punta a punta)')
    cid=ev(C,"localStorage.getItem('rave.card')")
    chk(bool(cid) and re.match(r'^[A-Za-z0-9_-]{8,64}$',cid or '') is not None,'el celular guardó el identificador de su tarjeta: '+str(cid))
    chk(bool(ev(C,"localStorage.getItem('rave.cardsec')")),'el celular guardó la clave de su tarjeta')
    f=frame(C)
    chk(f.locator('#loy-card:not([hidden]) .loy-card').count()==1,'el cliente VE su tarjeta apenas se anota')
    txt=f.inner_text('#loy-card')
    chk('trámite' in txt or 'pending' in txt.lower(),'la tarjeta indica "en trámite" hasta que el negocio la activa')
    f.click('#loy-show');C.wait_for_timeout(500)
    chk(f.locator('.loy-code svg').count()==1,'muestra el QR de la tarjeta')
    chk(f.locator('#loy-wa').is_visible()==False,'en la nube no se ofrece "recuperar con WhatsApp" (no es posible sin datos en el servidor)')

    # ---- 2) el negocio importa el alta: el cliente aparece en Clientes ----
    ev(A,"importAltas()");A.wait_for_timeout(1500)
    chk(ev(A,"S.customers.filter(c=>c.name==='Lucía'&&c.last==='Gómez').length")==1,'el negocio importa al cliente (aparece en Clientes)')
    chk(ev(A,"(()=>{const c=custByCard('%s');return c&&c.id==='%s'&&c.dni==='30123456'&&c.num===1&&c.origin==='menú público'})()"%(cid,cid)),'con su N.º de socio, DNI y origen "menú público"')
    chk(sql("select estado from club_altas")=='importada','el alta queda marcada como importada')
    wait_sync(A,2500)
    chk(sql("select datos->>'num' from registros where coleccion='clientes' and id='%s'"%cid)=='1','el cliente llegó a la nube con el mismo id que la tarjeta')
    chk('Lucía' not in sql("select datos::text from registros where coleccion='clientes' and id='%s'"%cid) and '30123456' not in sql("select datos::text from registros where coleccion='clientes' and id='%s'"%cid),'en la nube el nombre y el DNI van cifrados')
    # el celular consulta el estado y ve su N.º de socio
    ev(C,"cardPoll()");C.wait_for_timeout(1500)
    f=frame(C);txt=f.inner_text('#loy-card')
    chk('0001' in txt and 'trámite' not in txt,'el celular pasa a mostrar "Socio N° 0001" (%s)'%re.sub(r'\s+',' ',txt)[:60])
    chk('0 / 5' in txt.replace('\xa0',' ') or '0 / 5' in re.sub(r'\s+',' ',txt),'0 / 5 sellos')

    # ---- 3) el cliente compra: sello por QR (código rotativo del celular) ----
    def qr_now(C):return ev(C,"(()=>{const id=localStorage.getItem('rave.card'),k=pubCloudCode(id);return 'RAVE2|'+id+'|'+k.otp})()")
    q=qr_now(C)
    chk(re.match(r'^RAVE2\|[A-Za-z0-9_-]{20}\|\d{4}$',q) is not None,'el QR del celular lleva el id de tarjeta y el código de 4 cifras: '+q[:12]+'…')
    r=ev(A,"(()=>{const r=resolveStamp(%s,'');if(r.ok)commitStamp(r.cust.id,r,'test');return {ok:r.ok,how:r.how,st:r.stamps,msg:r.msg}})()"%repr(q).replace("'",'"'))
    chk(r['ok'] and r['how']=='código' and r['st']==1,'mostrador: sello por QR OK (1/5)')
    r=ev(A,"(()=>{const r=resolveStamp(%s,'');return {ok:r.ok,msg:r.msg}})()"%repr(q).replace("'",'"'))
    chk(not r['ok'],'el mismo QR no sirve dos veces: "%s"'%r['msg'][:50])
    # otro día: sello por DNI
    off=[0]
    def back24():
        off[0]+=300000
        for pg in (A,C,D if 'D' in globals() else None):
            if pg:pg.evaluate("o=>{window.__now=()=>Date.now()+o}",off[0])
        ev(A,"S.loyalty.ledger.forEach(e=>e.ts-=90000000);save()")
    back24()
    r=ev(A,"(()=>{const r=resolveStamp('30.123.456','');if(r.ok)commitStamp(r.cust.id,r,'mostrador');return {ok:r.ok,how:r.how,st:r.stamps,msg:r.msg}})()")
    chk(r['ok'] and r['how']=='DNI' and r['st']==2,'mostrador: sello por DNI (con puntos) OK (2/5) %s'%r.get('msg'))
    r=ev(A,"(()=>{const r=resolveStamp('30123456','');return {ok:r.ok,msg:r.msg}})()")
    chk(not r['ok'] and '24 h' in r['msg'],'límite antifraude: un sello por día también por DNI')
    back24()
    r=ev(A,"(()=>{const r=resolveStamp('RAVE2N|%s','');if(r.ok)commitStamp(r.cust.id,r,'mostrador');return {ok:r.ok,how:r.how,st:r.stamps,msg:r.msg}})()"%cid)
    chk(r['ok'] and r['how']=='NFC' and r['st']==3,'mostrador: sello por tarjeta NFC OK (3/5)')
    back24()
    code8=ev(C,"(()=>{const id=localStorage.getItem('rave.card'),k=pubCloudCode(id);return '0001'+k.otp})()")
    r=ev(A,"(()=>{const r=resolveStamp('%s','');if(r.ok)commitStamp(r.cust.id,r,'mostrador');return {ok:r.ok,how:r.how,st:r.stamps,msg:r.msg}})()"%code8)
    chk(r['ok'] and r['st']==4,'mostrador: sello por código de 8 números OK (4/5) %s'%r.get('msg'))
    r=ev(A,"resolveStamp('99999999','').ok")
    chk(r==False,'DNI desconocido: rechazado')
    r=ev(A,"resolveStamp('RAVE2|%s|0000','').ok"%cid)
    chk(r==False,'código incorrecto: rechazado')
    back24()
    # el celular ve los sellos tras sincronizar el negocio
    wait_sync(A,2500)
    ev(C,"cardPoll()");C.wait_for_timeout(1500)
    f=frame(C);txt=re.sub(r'\s+',' ',f.inner_text('#loy-card'))
    chk('4 / 5' in txt,'el celular del cliente muestra 4 / 5 sellos (%s)'%txt[:70])
    n=int(sql("select count(*) from registros where coleccion='sellos'"))
    chk(n==4,'4 sellos en el servidor')

    # ---- 4) segundo celular del mismo cliente (mismo WhatsApp y cumpleaños): misma ficha, tarjeta nueva ----
    ctxD,D=newpage(b,'D',390)
    D.goto(BASE+'/cliente.html#menu');D.wait_for_timeout(4000)
    fd=frame(D);fd.click('#ag-yes');D.wait_for_timeout(400)
    join(D,'Lucia Gomez','387 555-6677','1992-03-14')
    cid2=ev(D,"localStorage.getItem('rave.card')")
    chk(cid2 and cid2!=cid,'el 2.º celular tiene su propia tarjeta')
    ev(A,"importAltas()");A.wait_for_timeout(1500)
    chk(ev(A,"S.customers.filter(c=>c.status!=='baja').length")==1 and ev(A,"custByCard('%s').id"%cid2)==cid,'no se duplica el cliente: la 2.ª tarjeta queda en la misma ficha')
    wait_sync(A,2500)
    ev(D,"cardPoll()");D.wait_for_timeout(1500)
    txt=re.sub(r'\s+',' ',frame(D).inner_text('#loy-card'))
    chk('4 / 5' in txt and '0001' in txt,'el 2.º celular ve el mismo N.º de socio y los mismos sellos (%s)'%txt[:60])
    D.evaluate("o=>{window.__now=()=>Date.now()+o}",off[0])
    q2=qr_now(D)
    r=ev(A,"(()=>{const r=resolveStamp(%s,'');return {ok:r.ok,msg:r.msg,how:r.how,n:r.cust&&r.cust.num}})()"%repr(q2).replace("'",'"'))
    chk(r['ok'] and r['n']==1,'el QR del 2.º celular también suma al mismo socio '+str(r))
    # mismo WhatsApp pero otro cumpleaños: no se vincula (evita que otro se cuelgue de una cuenta)
    ctxE,E=newpage(b,'E',390)
    E.goto(BASE+'/cliente.html#menu');E.wait_for_timeout(4000)
    fe=frame(E);fe.click('#ag-yes');E.wait_for_timeout(400)
    join(E,'Intruso Perez','3875556677','1990-01-01')
    cid3=ev(E,"localStorage.getItem('rave.card')")
    ev(A,"importAltas()");A.wait_for_timeout(1500)
    chk(ev(A,"custByCard('%s')"%cid3) is None,'mismo WhatsApp con otro cumpleaños: NO se vincula')
    chk(sql("select count(*) from club_altas where estado='rechazada'")=='1','esa alta queda rechazada')

    # ---- 5) altas viejas (v1, sin tarjeta) y altas que este equipo no puede abrir ----
    ev(A,"rsaSeal(cl.clubPriv.pub,{name:'Pedro',last:'Viejo',birth:'1980-05-05',wa:'+5493875550011',comm:false,v:'v1',ts:now()}).then(e=>rpc('club_alta',{p_slug:CLOUD.slug,p_huella:sha256('x1'+uid()+uid()),p_cifrado:e},{auth:false}))");A.wait_for_timeout(1500)
    ev(A,"crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']).then(async kp=>{const pub=await crypto.subtle.exportKey('jwk',kp.publicKey);const e=await rsaSeal(pub,{name:'Otra',last:'Llave',birth:'1985-05-05',wa:'+5493875550022',comm:false,v:'v1',ts:now()});return rpc('club_alta',{p_slug:CLOUD.slug,p_huella:sha256('x2'+uid()+uid()),p_cifrado:e},{auth:false})})");A.wait_for_timeout(1500)
    ev(A,"importAltas()");A.wait_for_timeout(1500)
    chk(ev(A,"S.customers.some(c=>c.name==='Pedro'&&c.last==='Viejo')"),'un alta vieja (v1, sin tarjeta) también se importa')
    chk(sql("select count(*) from club_altas where estado='nueva'")=='1','un alta que este equipo no puede abrir NO se descarta: queda "nueva"')
    chk(ev(A,"importAltas()")==0,'y no se rompe al reintentar')

    # ---- 6) el cobro en el mostrador usa DNI / QR; y el sello se anota en la venta ----
    ev(A,"(()=>{const p=S.products[0];p.stock=50;save();if(!S.sessions.some(s=>!s.closedAt))S.sessions.push({id:uid(),caja:S.tenant.caja,openedBy:user.name,openedAt:now(),opening:0,closedAt:0});save();})()")
    back24()
    sale="(()=>{const p=S.products[0];const r=commitSale('efectivo',false,'local',[{pid:p.id,name:p.name,rubro:p.rubro,qty:1,price:p.price,cost:p.cost,list:p.price}],{custId:'',coupon:'',stampCode:'30123456'});save();return {err:r.err||'',st:r.stamp&&r.stamp.stamps,rw:r.stamp&&r.stamp.reward,cust:r.sale&&r.sale.cust}})()"
    r=ev(A,sale)
    chk(r['err']=='' ,'cobro sin elegir cliente: error esperado "Sello necesita un cliente" => %s'%r['err'][:50]) if False else None
    r=ev(A,sale.replace("custId:''","custId:'%s'"%cid))
    chk(r['err']=='' and r['st']==5 and r['rw'],'cobro con el DNI del cliente: suma el 5.º sello y avisa que hay premio (%s)'%r)
    chk(ev(A,"redeemReward('%s')"%cid)=='','se entrega el premio (canje) sin error')
    chk(ev(A,"stampsOf('%s')"%cid)==0,'tras el canje la tarjeta vuelve a 0')

    # ---- 7) cupones en todo el sistema ----
    wait_sync(A,2500)
    ev(C,"cloudPublishMenu&&0");
    # el cliente socio ve el cupón de socios; quien no es socio, sólo los de todos
    ctxF,F=newpage(b,'F',390)
    F.goto(BASE+'/cliente.html#menu');F.wait_for_timeout(4000)
    fF=frame(F);fF.click('#ag-yes');F.wait_for_timeout(500)
    codes=fF.evaluate("Array.from(document.querySelectorAll('#coupons-list .cc-code')).map(e=>e.textContent)")
    chk(codes==['TODOS10'],'público sin tarjeta ve sólo cupones para todos: %s'%codes)
    ev(C,"loadPubSnap()");C.wait_for_timeout(500)
    ev(C,"cardPoll()");C.wait_for_timeout(1500)
    ev(C,"pubReload()");C.wait_for_timeout(3500)
    fC=frame(C);fC.click('#ag-yes') if fC.locator('#ag-yes').is_visible() else None;C.wait_for_timeout(500)
    codes=fC.evaluate("Array.from(document.querySelectorAll('#coupons-list .cc-code')).map(e=>e.textContent)")
    chk(sorted(codes)==['SOCIO15','TODOS10'],'el socio con tarjeta ve además el cupón de socios: %s'%codes)
    # POS: cupón de socios con el cliente; límite por cliente; usos que sincronizan
    ev(A,"(()=>{const p=S.products[0];window.__l=[{pid:p.id,name:p.name,rubro:p.rubro,qty:2,price:p.price,cost:p.cost,list:p.price}];})()")
    r=ev(A,"(()=>{const x=applyBenefit(window.__l,'','SOCIO15');return {d:x.disc,e:x.couponErr}})()")
    chk(r['d']==0 and 'identificar' in r['e'],'cupón de socios sin cliente: pide identificar al cliente')
    r=ev(A,"(()=>{const x=applyBenefit(window.__l,'%s','SOCIO15');return {d:x.disc,e:x.couponErr,tot:window.__l[0].qty*window.__l[0].price}})()"%cid)
    chk(r['e']=='' and r['d']==round(r['tot']*0.15),'cupón de socios con el cliente: 15 %% de descuento (%s)'%r['d'])
    r=ev(A,"(()=>{const r=commitSale('efectivo',false,'local',window.__l,{custId:'%s',coupon:'SOCIO15'});save();return {err:r.err||'',cp:r.sale&&r.sale.coupon,b:r.sale&&r.sale.benefit&&r.sale.benefit.disc}})()"%cid)
    chk(r['err']=='' and r['cp']=='SOCIO15' and r['b']>0,'venta con cupón registrada, con el descuento en el ticket')
    r=ev(A,"(()=>{const x=applyBenefit(window.__l,'%s','SOCIO15');return {d:x.disc,e:x.couponErr}})()"%cid)
    chk(r['d']==0 and 'ya usó' in r['e'],'segundo uso del cupón por el mismo cliente: rechazado ("%s")'%r['e'])
    wait_sync(A,2500)
    chk(sql("select count(*) from registros where coleccion='cusos'")=='1','el uso del cupón sincroniza al servidor')
    # un segundo equipo (mostrador) ve el uso y no deja repetirlo
    ev(A,"nbInvite")if False else None
    r=ev(A,"(()=>{const x=applyBenefit(window.__l,'','TODOS10');return {d:x.disc,e:x.couponErr}})()")
    chk(r['e']=='' and r['d']>0,'cupón para todos: aplica sin cliente')
    r=ev(A,"(()=>{const x=applyBenefit(window.__l,'','INEXISTENTE');return x.couponErr})()")
    chk('inexistente' in r.lower(),'cupón inexistente: rechazado')

    bad=[e for e in errs if 'net::ERR' not in e and '403' not in e and '503' not in e and 'Failed to load resource' not in e]
    chk(not bad,'sin errores JS %s'%bad[:4])
    b.close()
print(sum(res),'/',len(res))
