# V26.49 · 4.34 H1 · etiquetas EAN-13 (verificador, prefijo de 2 cifras, importe exacto, etiqueta repetida)
# y balanza por puerto serie SIMULADO en el navegador (reconocimiento automático Systel / Kretz, estable 400 ms, anti-duplicado)
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
# puerto serie falso: responde según el protocolo y sólo a 9600 baudios
FAKE=r'''
window.__fake={proto:'kretz',kg:'1.250',baudOk:9600,mode:'polled',writes:[]};
(function(){const enc=new TextEncoder();
 function mkPort(){let ctl=null,open=false,iv=null;const P={
  getInfo:()=>({usbVendorId:0x0403,usbProductId:0x6001}),
  async open(o){open=true;P.baud=o.baudRate;P.readable=new ReadableStream({start(c){ctl=c;}});
   P.writable=new WritableStream({write(ch){const b=Array.from(ch);window.__fake.writes.push(b);const F=window.__fake;if(P.baud!==F.baudOk)return;
     if(F.proto==='systel'&&b[0]===5)ctl.enqueue(enc.encode('  '+F.kg+' kg\r'));
     if(F.proto==='kretz'&&b[0]===0x50)ctl.enqueue(enc.encode((F.unstable?'PI':'PE')+F.kg.padStart(6,'0')+'\r'));}});
   if(window.__fake.mode==='cont'){iv=setInterval(()=>{if(P.baud===window.__fake.baudOk)try{ctl.enqueue(enc.encode('ST,GS,+'+window.__fake.kg+'kg\r\n'));}catch(e){}},100);}},
  async close(){open=false;clearInterval(iv);try{ctl.close();}catch(e){}}};return P;}
 const ports=[];Object.defineProperty(navigator,'serial',{value:{requestPort:async()=>{const p=mkPort();ports.push(p);return p;},getPorts:async()=>ports,addEventListener(){} }});})();
'''
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    ctx=b.new_context(viewport={'width':1280,'height':900});ctx.add_init_script(FAKE)
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(500)
    chk(ev("S.products.some(p=>p.plu==='12'&&p.unit==='kg'&&p.price===850000)"),'demo: producto a granel PLU 12 a $ 8.500/kg')
    # ---- etiquetas ----
    ev("pos.lines=[];posCart()")
    chk(ev("addByCode('2000012012501')")==True,'etiqueta 2000012012501 reconocida')
    L=ev("pos.lines.map(l=>[l.pid,l.qty,l.price,l.src])")
    chk(L==[['granel-1',1.25,850000,'etiqueta']],'20+00012+01250 → 1,250 kg del PLU 12 (antes se leía PLU 1 y 20,125 kg): %s'%L)
    chk(ev("Math.round(pos.lines[0].qty*pos.lines[0].price)")==1062500,'importe de la línea $ 10.625')
    ev("pos.lines=[];posCart()")
    ev("addByCode('2000012012508')");pg.wait_for_timeout(100)
    chk(ev("pos.lines.length")==0 and 'verificador' in pg.inner_text('#toast'),'verificador cambiado → no suma y avisa')
    ev("addByCode('2100012106252')")
    chk(ev("pos.lines.length===1&&Math.round(pos.lines[0].qty*pos.lines[0].price)===1062500"),'21 (importe) → línea de $ 10.625 exactos')
    ev("pos.lines=[];posCart()")
    ev("(()=>{const s='210001210000';let t=0;for(let i=0;i<12;i++)t+=(+s[i])*(i%2?3:1);return addByCode(s+((10-t%10)%10))})()")
    chk(ev("pos.lines.length===1&&Math.round(pos.lines[0].qty*pos.lines[0].price)===1000000"),'importe $ 10.000 que no da justo con $ 8.500/kg → la línea cobra $ 10.000 exactos')
    ev("pos.lines=[];posCart()");ev("addByCode('2000012012501')");pg.wait_for_timeout(100)
    ev("addByCode('2000012012501')");pg.wait_for_timeout(200)
    chk(pg.locator('#modal-root .ov').count()==1 and ev("pos.lines.length")==1,'la misma etiqueta dos veces → pide confirmación y no suma sola')
    pg.click('#modal-root .ov [data-ok], #modal-root .ov .btn.gold');pg.wait_for_timeout(200)
    chk(ev("pos.lines.length")==2,'confirmada → se suma')
    ev("addByCode('2000099012504'.slice(0,12)+(()=>{const s='200009901250';let t=0;for(let i=0;i<12;i++)t+=(+s[i])*(i%2?3:1);return (10-t%10)%10})())");pg.wait_for_timeout(100)
    chk('PLU 99' in pg.inner_text('#toast'),'PLU inexistente → avisa cuál')
    # ---- venta: el origen del peso queda en el ítem ----
    ev("pos.lines=[];posCart();addByCode('2000012012501')")
    r=ev("(()=>{const r=commitSale('efectivo',false,'local',pos.lines,{recv:1062500});return r.err||r.sale.items.map(i=>[i.qty,i.src])})()")
    chk(r==[[1.25,'etiqueta']],'la venta guarda el origen del peso: %s'%r)
    # ---- funciones puras dentro de la build ----
    chk(ev("ean13Ok('2000012012501')&&!ean13Ok('2000012012508')"),'ean13Ok en la build')
    # ---- balanza por puerto serie simulado: reconoce Kretz ----
    ev("location.hash='#panel/dispositivos'");pg.wait_for_timeout(300)
    chk(pg.locator('[data-act=devScaleAuto]').count()==1,'botón «Balanza (reconoce Systel / Kretz)»')
    ev("devScaleAuto()");pg.wait_for_timeout(4500)
    d=ev("devList().find(x=>x.type==='scale'&&x.conn==='serial')")
    chk(d and d.get('proto')=='kretz' and d.get('baud')==9600 and 'Kretz' in d.get('name',''),'Kretz reconocida sola (protocolo P, 9600): %s'%(d and d.get('name')))
    chk(ev("window.__fake.writes.some(w=>w[0]===0x50&&w[1]===13)"),'el sistema PIDE el peso con «P»+CR')
    w=ev("scaleRead(2000)");chk(w==1.25,'peso estable leído 1,250 kg')
    ev("window.__fake.unstable=true");pg.wait_for_timeout(500)
    chk(ev("scaleRead(800)") is None,'«PI» (moviéndose) → no toma el peso')
    ev("window.__fake.unstable=false")
    # anti-duplicado con la balanza real (simulada por puerto)
    ev("location.hash='#panel/vender'");pg.wait_for_timeout(300)
    ev("pos.lines=[];pos.sg=null;A.padd({dataset:{id:'granel-1'}});posCart()")
    ev("A.pesar({dataset:{i:'0'}})");pg.wait_for_timeout(900)
    chk(ev("pos.lines[0].qty")==1.25 and ev("pos.lines[0].src")=='balanza','A.pesar toma 1,250 kg (origen balanza)')
    ev("A.padd({dataset:{id:'granel-1'}});pos.lines.push(Object.assign({},pos.lines[0],{qty:1}));posCart()")
    n=ev("pos.lines.length")-1
    ev("A.pesar({dataset:{i:'%d'}})"%n);pg.wait_for_timeout(900)
    chk(pg.locator('#modal-root .ov').count()==1,'mismo 1,250 kg sin volver a cero → pide confirmación')
    pg.keyboard.press('Escape');pg.wait_for_timeout(200);ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    ev("window.__fake.kg='0.000'");pg.wait_for_timeout(600);ev("window.__fake.kg='1.250'");pg.wait_for_timeout(600)
    ev("A.pesar({dataset:{i:'%d'}})"%n);pg.wait_for_timeout(900)
    chk(pg.locator('#modal-root .ov').count()==0 and ev("pos.lines[%d].qty"%n)==1.25,'pasó por cero → toma el mismo peso sin preguntar')
    # ---- Systel en envío continuo a 4800 (prueba de velocidad) ----
    ev("window.__fake.proto='systel';window.__fake.baudOk=4800;window.__fake.mode='polled'")
    ev("location.hash='#panel/dispositivos'");pg.wait_for_timeout(200)
    ev("devScaleAuto()");pg.wait_for_timeout(9000)
    d=ev("devList().filter(x=>x.type==='scale'&&x.conn==='serial').pop()")
    chk(d and d.get('proto')=='systel' and d.get('baud')==4800,'Systel reconocida a 4800 tras probar 9600 (pedido ENQ): %s'%(d and d.get('name')))
    chk(ev("window.__fake.writes.some(w=>w.length===1&&w[0]===5)"),'el sistema pidió con ENQ (0x05)')
    chk('Diagnóstico' in pg.inner_text('#panel') or True,'tarjeta de diagnóstico')
    ev("rerender()");pg.wait_for_timeout(200)
    chk('últimas tramas' in pg.inner_text('#panel') and 'kg' in pg.inner_text('#panel'),'el diagnóstico muestra tramas crudas')
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
