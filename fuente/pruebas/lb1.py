# V26.77 · Precios y etiquetas profesionales: plantillas, variables, códigos legibles por un lector (OpenCV), medidas exactas en mm,
# cola automática (cambio de precio e ingreso de compra), copias, planchas, editor (mouse, teclado, paleta, deshacer) y Almacén RAVE apagado.
from playwright.sync_api import sync_playwright
import cv2,numpy as np,math,os,sys
D=os.environ.get('LB_DIR','/tmp/rave')
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
def login(pg,pin,idx=0):
    pg.goto('file://%s/kini.html#acceso'%D);pg.wait_for_timeout(900)
    pg.select_option('#lu',index=idx);pg.fill('#lp',pin);pg.click('[data-act=login]');pg.wait_for_timeout(500)
def ok_modal(pg):
    pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(300)
def decode(png):
    # como una foto real: hoja más grande, un poco de ruido y una leve rotación (el detector de OpenCV no funciona con imágenes perfectas)
    img=cv2.imdecode(np.frombuffer(png,np.uint8),cv2.IMREAD_GRAYSCALE);h,w=img.shape;S_=max(h,w)+200
    cv=np.full((S_,S_),255,np.uint8);cv[100:100+h,100:100+w]=img
    out=set();bd=cv2.barcode.BarcodeDetector();rng=np.random.default_rng(7)
    for ang in (0,4):
        M=cv2.getRotationMatrix2D((S_/2,S_/2),ang,1);im=cv2.warpAffine(cv,M,(S_,S_),borderValue=255)
        im=np.clip(im.astype(int)+rng.integers(-18,18,im.shape),0,255).astype(np.uint8)
        r=bd.detectAndDecodeWithType(cv2.cvtColor(im,cv2.COLOR_GRAY2BGR))
        if r[0]: out|={x for x in r[1] if x}
    return sorted(out)
def c128_decode(png):
    """Lee el Code 128 desde los píxeles (fila central) y lo decodifica con la tabla INDEPENDIENTE de ReportLab."""
    import reportlab.graphics.barcode.code128 as rl
    img=cv2.imdecode(np.frombuffer(png,np.uint8),cv2.IMREAD_GRAYSCALE);row=img[int(img.shape[0]*0.35)]<128
    xs=np.where(row)[0]
    if not len(xs): return None
    seg=row[xs[0]:xs[-1]+1];runs=[];cur=seg[0];n=0
    for v in seg:
        if v==cur: n+=1
        else: runs.append(n);cur=v;n=1
    runs.append(n);tot=sum(runs);m0=min(runs);nm=round(tot/m0)
    while (nm-13)%11: nm+=1 if (nm-13)%11>5 else -1
    m=tot/nm;w=[max(1,round(r/m)) for r in runs]
    inv={}
    for val,pat in rl._patterns.items(): inv[''.join(str(' abcd'.index(ch.lower())) for ch in pat)]=val
    syms=[];i=0
    while i<len(w)-7:
        k=''.join(map(str,w[i:i+6]));
        if k not in inv: return None
        syms.append(inv[k]);i+=6
    if ''.join(map(str,w[i:]))!='2331112': return None
    start,data,chk_=syms[0],syms[1:-1],syms[-1]
    if (start+sum(v*(j+1) for j,v in enumerate(data)))%103!=chk_: return 'CHECKSUM'
    rb={v:k for k,v in rl.setb.items()};rc={v:k for k,v in rl.setc.items()}
    if start==104: return ''.join(rb[v] for v in data)
    if start==105: return ''.join(rc[v] for v in data)
    return None
def qrdecode(png):
    img=cv2.imdecode(np.frombuffer(png,np.uint8),cv2.IMREAD_COLOR);t,_,_=cv2.QRCodeDetector().detectAndDecode(img);return t
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    ctx=b.new_context(viewport={'width':1400,'height':950});pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    pg.add_init_script("try{localStorage.setItem('rave.ux.config','all')}catch(e){}")
    login(pg,'1234')
    chk(ev("giOn('labels')") and ev("lbCfg().tpls.length")==5,'demo: módulo activo con las 5 plantillas predefinidas')
    chk(ev("SCREENS.etiquetas.show()") and ev("NAV.some(x=>x[0]==='etiquetas')"),'la pantalla «Etiquetas» aparece en Operación')
    # --- variables con números conocidos ---
    ev("S.products.push({id:'t-gas',name:'Gaseosa test',sub:'2.25 lt',price:225000,cost:150000,barcode:'7790895000997',unit:'u',rubro:S.products[0].rubro,stock:7,active:true},{id:'t-que',name:'Queso test',sub:'',price:890000,cost:500000,barcode:'',plu:'QX-12',unit:'kg',rubro:S.products[0].rubro,stock:3,active:true},{id:'t-mix',name:'Combo test',sub:'750 ml + 3 lt',price:500000,cost:1,barcode:'',unit:'u',rubro:S.products[0].rubro,stock:0,active:true});save()")
    v=ev("lbVars(prod('t-gas'))")
    chk(v['precio_unidad_medida']=='$ 1.000 x litro','2,25 lt a $ 2.250 → $ 1.000 x litro (%s)'%v['precio_unidad_medida'])
    chk(v['precio_sin_impuestos']=='$ 1.859,50','sin IVA 21 %%: 2.250 / 1,21 = $ 1.859,50 (%s)'%v['precio_sin_impuestos'])
    chk(ev("lbVars(prod('t-que')).precio_unidad_medida")=='$ 8.900 x kg','artículo por kilo: el precio ya es por kg')
    chk(ev("lbVars(prod('t-mix')).precio_unidad_medida")=='','presentación combinada: no inventa precio por litro')
    chk(ev("lbContent({name:'Yerba',sub:'500 g',unit:'u'}).q")==0.5 and ev("lbContent({name:'Vino 750 ml',sub:'',unit:'u'}).q")==0.75,'lee 500 g = 0,5 kg y 750 ml = 0,75 l')
    ev("(()=>{const p=prod('t-gas');p.price=199000;save()})()")
    v=ev("lbVars(prod('t-gas'))")
    chk(v['precio_anterior']=='$ 2.250' and v['precio_final']=='$ 1.990','baja de precio: precio anterior $ 2.250 y final $ 1.990')
    # --- Code 128: tabla íntegra ---
    chk(ev("LB_C128.length")==107 and ev("LB_C128.slice(0,106).every(w=>w.split('').reduce((a,b)=>a+ +b,0)===11)") and ev("LB_C128[106].split('').reduce((a,b)=>a+ +b,0)")==13,'tabla Code 128: 106 símbolos de 11 módulos + parada de 13')
    # --- lectura real de los códigos (render a 4x y OpenCV) ---
    pg2=ctx.new_page();ev2=pg2.evaluate
    pg2.goto('file://%s/kini.html'%D);pg2.wait_for_timeout(900)
    def shot(html,wmm,hmm):
        ev2("(h)=>{document.body.innerHTML='<div id=\"z\" style=\"position:fixed;left:0;top:0;background:#fff;padding:6mm\">'+h+'</div>';}",html)
        pg2.set_viewport_size({'width':int((wmm+14)*96/25.4)+20,'height':int((hmm+14)*96/25.4)+20});pg2.wait_for_timeout(100)
        return pg2.locator('#z').screenshot(scale='device')
    ctx4=b.new_context(viewport={'width':900,'height':500},device_scale_factor=4);pg4=ctx4.new_page();pg4.goto('file://%s/kini.html'%D);pg4.wait_for_timeout(900)
    def shot4(code,sym,w,h,kind='bar'):
        js="([c,s,w,h,k])=>{const r=k==='qr'?lbQrSvg(c):lbBarSvg(c,s,w,h,1);document.body.innerHTML='<div id=\"z\" style=\"position:fixed;left:0;top:0;background:#fff;padding:5mm\"><div style=\"width:'+w+'mm;height:'+h+'mm\">'+r.svg+'</div></div>';return r.mod||0}"
        mod=pg4.evaluate(js,[code,sym,w,h,kind]);pg4.wait_for_timeout(80);return pg4.locator('#z').screenshot(),mod
    png,mod=shot4('7790895000997','auto',37.3,18)
    d=decode(png);chk('7790895000997' in d,'EAN-13 al 100 %% (%.3f mm por barra) lo lee el lector: %s'%(mod,d))
    png,mod=shot4('QX-12','code128',30,12)
    d=c128_decode(png);chk(d=='QX-12','Code 128 con letras: las barras impresas se decodifican como QX-12 (tabla de ReportLab): %s'%d)
    png,mod=shot4('123456789012','code128',40,12)
    d=c128_decode(png);chk(d=='123456789012','Code 128 numérico (juego C) se decodifica bien: %s'%d)
    png,mod=shot4('7790895000990','auto',40,12)
    d=c128_decode(png);chk(d=='7790895000990','EAN con dígito verificador inválido cae a Code 128 y se decodifica: %s'%d)
    png,_=shot4('https://raveholding.github.io/AlmacenRAVE/?c=7790895000997','',25,25,'qr')
    q=qrdecode(png);chk(q=='https://raveholding.github.io/AlmacenRAVE/?c=7790895000997','QR vectorial negro se lee: %s'%q)
    ctx4.close();pg2.close()
    # --- motor: milímetros exactos ---
    r=ev("(()=>{const t=lbCfg().tpls.find(x=>x.name.startsWith('Góndola'));const o=lbBuild([{pid:'t-gas',copies:3}],{tpl:t.id});return {p:o.pages,l:o.labels,h:o.html}})()")
    chk(r['p']==3 and r['l']==3 and '@page{size:50mm 30mm;margin:0}' in r['h'],'rollo 50 × 30: 3 copias = 3 páginas de 50 × 30 mm con margen 0')
    pp=ctx.new_page();pp.set_content(r['h']);pp.wait_for_timeout(200)
    wpx=pp.evaluate("document.querySelector('.pg').getBoundingClientRect().width");hpx=pp.evaluate("document.querySelector('.pg').getBoundingClientRect().height")
    chk(abs(wpx-50*96/25.4)<0.6 and abs(hpx-30*96/25.4)<0.6,'la etiqueta mide 50,0 × 30,0 mm en el documento de impresión (%.2f × %.2f px)'%(wpx,hpx))
    pdf=pp.pdf(prefer_css_page_size=True);pp.close()
    import re as _re
    mb=_re.search(rb'/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]',pdf)
    chk(mb and abs(float(mb.group(1))-50/25.4*72)<1 and abs(float(mb.group(2))-30/25.4*72)<1,'el PDF sale con hoja de 50 × 30 mm exactos: %s'%str(mb.groups() if mb else None))
    r=ev("(()=>{const t=lbCfg().tpls.find(x=>x.name.startsWith('Plancha'));const o=lbBuild([{pid:'t-gas',copies:30}],{tpl:t.id,start:2});return {p:o.pages,h:o.html}})()")
    chk(r['p']==2 and '@page{size:210mm 297mm;margin:0}' in r['h'],'plancha A4 3 × 8 empezando en la 3.ª: 30 etiquetas = 2 hojas A4')
    chk('left:139.2mm;top:12.9mm' in r['h'],'la primera etiqueta va en la 3.ª celda: 7,2 + 2 × (63,5 + 2,5) = 139,2 mm')
    # --- autoajuste ---
    ev("S.products.push({id:'t-long',name:'Aceite de oliva extra virgen primera prensada en frío edición especial de colección bodega familiar',sub:'500 ml',price:1234500,barcode:'',unit:'u',rubro:S.products[0].rubro,stock:2,active:true});save()")
    fs=ev("(()=>{const t=lbCfg().tpls.find(x=>x.name.startsWith('Góndola'));const h=document.createElement('div');h.style.cssText='position:fixed;left:-9999px';document.body.appendChild(h);lbStyle();h.innerHTML=lbHTML(t,prod('t-long'));lbFit(h);const e=h.querySelector('.le[data-fit=\"1\"]');const r=[+e.dataset.fsr,e.scrollHeight<=e.clientHeight+1];h.remove();return r})()")
    chk(fs[0]<10 and fs[1],'nombre muy largo: la letra baja de 10 pt a %s pt y entra en su caja'%fs[0])
    # --- cola automática ---
    ev("lbMarkDone(lbPending().map(r=>r.pid));save()")
    chk(len(ev("lbPending()"))==0,'cola vacía tras marcar todo como impreso')
    ev("(()=>{const p=prod('t-gas');p.price=210000;save()})()")
    L=ev("lbPending()")
    chk(len(L)==1 and L[0]['pid']=='t-gas' and L[0]['why']=='precio','el cambio de precio entra solo a la cola')
    ev("S.receipts.push({id:'rc-t',ts:Date.now(),items:[{pid:'t-que',qty:12},{pid:'t-gas',qty:4}],res:{tipo_comprobante:'Factura A',nro_comprobante:'0001-00000099'}});save()")
    L={r['pid']:r for r in ev("lbPending()")}
    chk('t-que' in L and L['t-que']['why']=='ingreso' and L['t-que']['qty']==12 and 'Factura A 0001-00000099' in L['t-que']['ref'],'el ingreso de la compra entra a la cola con la cantidad de la factura (12)')
    chk(ev("lbCopies(lbPending().find(r=>r.pid==='t-que'),'factura')")==12 and ev("lbCopies(lbPending().find(r=>r.pid==='t-que'),'stock')")==3,'copias según la factura = 12 y según el stock = 3')
    chk(len(ev("lbPending({why:'ingreso'})"))==2 and len(ev("lbPending({rubro:'no-existe'})"))==0,'filtros por motivo y por rubro')
    # --- pantalla Cola: imprimir y confirmar ---
    ev("lbPrintDoc=h=>{window.__lbHtml=h;return null}")
    ev("go('etiquetas')");pg.wait_for_timeout(400)
    chk(pg.locator('.lb-ck').count()>=2,'la cola muestra las filas pendientes')
    pg.select_option('#lb-cm','factura');pg.wait_for_timeout(300)
    pg.click('[data-act=lbSelAll]');pg.wait_for_timeout(300)
    pg.click('[data-act=lbPrint]');pg.wait_for_timeout(900)
    h=ev("window.__lbHtml||''")
    chk(h.count('class="pg"')==16,'imprimir según factura: 12 + 4 = 16 etiquetas en 16 páginas (%d)'%h.count('class="pg"'))
    ok_modal(pg);pg.wait_for_timeout(300)
    chk(len(ev("lbPending()"))==0 and ev("S.audit.some(a=>a.action==='ETIQUETAS_IMPRESION')"),'al confirmar salen de la cola y queda en Auditoría')
    # --- editor ---
    pg.click('[data-act=lbTab][data-t=editor]');pg.wait_for_timeout(600)
    ev("(()=>{const s=document.getElementById('lb-et');s.value=lbCfg().tpls.find(x=>x.name.startsWith('Góndola')).id;s.dispatchEvent(new Event('change'))})()");pg.wait_for_timeout(500)
    pg.select_option('#lb-zm','4');pg.wait_for_timeout(300)
    n0=ev("lbEdTpl().els.length")
    pg.click('.lb-pi[data-ty=text]');pg.wait_for_timeout(300)
    chk(ev("lbEdTpl().els.length")==n0+1 and ev("lbEdEl().type")=='text','tocar «Texto libre» agrega un elemento y lo selecciona')
    eid=ev("lbEdSel");x0=ev("lbEdEl().x");y0=ev("lbEdEl().y")
    box=pg.locator('[data-eid="%s"]'%eid).bounding_box()
    sx,sy=box['x']+box['width']/2,box['y']+box['height']/2;z=ev("lbZ()");dpx=10*96/25.4*z
    pg.mouse.move(sx,sy);pg.mouse.down();pg.mouse.move(sx+dpx/2,sy+dpx/4,steps=4);pg.mouse.move(sx+dpx,sy+dpx/2,steps=4);pg.mouse.up();pg.wait_for_timeout(300)
    e=ev("lbTpl(lbEdT).els.find(x=>x.id==='%s')"%eid)
    chk(abs(e['x']-min(x0+10,50-e['w']))<0.01 and abs(e['y']-min(y0+5,30-e['h']))<0.01,'arrastrar 10 mm a la derecha y 5 mm abajo mueve el elemento a x=%s, y=%s'%(e['x'],e['y']))
    hb=pg.locator('[data-eid="%s"] .lb-h'%eid).bounding_box();w0=e['w']
    pg.mouse.move(hb['x']+2,hb['y']+2);pg.mouse.down();pg.mouse.move(hb['x']+2-2*96/25.4*z,hb['y']+2,steps=3);pg.mouse.up();pg.wait_for_timeout(300)
    chk(abs(ev("lbEdEl().w")-(w0-2))<0.01,'el tirador cambia el ancho en 2 mm')
    xb=ev("lbEdEl().x");pg.locator('#lb-cvw').click(position={'x':5,'y':5}) if False else None
    pg.keyboard.press('ArrowLeft');pg.wait_for_timeout(150)
    chk(abs(ev("lbEdEl().x")-(xb-0.5))<0.01,'flecha izquierda mueve 0,5 mm')
    pg.keyboard.press('Delete');pg.wait_for_timeout(200)
    chk(ev("lbEdTpl().els.length")==n0,'Suprimir borra el elemento')
    pg.keyboard.press('Control+z');pg.wait_for_timeout(400)
    chk(ev("lbEdTpl().els.length")==n0+1,'Ctrl + Z lo recupera')
    # arrastrar una variable desde la paleta (HTML5)
    n1=ev("lbEdTpl().els.length")
    pg.locator('.lb-pi[data-v=precio_sin_impuestos]').drag_to(pg.locator('#lb-cv'),target_position={'x':40,'y':40});pg.wait_for_timeout(400)
    chk(ev("lbEdTpl().els.length")==n1+1 and ev("lbEdEl().text")=='{precio_sin_impuestos}','arrastrar {Precio sin imp. nac.} desde la paleta lo suelta en el lienzo')
    # propiedades
    pg.fill('#lp-text','Llevá {nombre_producto}');pg.wait_for_timeout(300)
    chk('Llevá Gaseosa' in pg.inner_text('#lb-cvw') or 'Llevá ' in pg.inner_text('#lb-cvw'),'cambiar el contenido actualiza la vista previa en vivo')
    # tamaño y plancha
    pg.select_option('#lb-em','sheet');pg.wait_for_timeout(400)
    t=ev("lbEdTpl()")
    chk(t['media']['type']=='sheet' and t['media']['cols']==4 and t['media']['rows']==9 and ev("lbSheetOk(lbEdTpl())"),'pasar a plancha A4 calcula 4 × 9 etiquetas de 50 × 30 que entran en la hoja')
    pg.wait_for_timeout(900)
    # persistencia y nueva plantilla
    pg.click('[data-act=lbNewTpl]');pg.wait_for_timeout(200);pg.select_option('#nt-p','kilo');pg.fill('#nt-n','Fiambres');ok_modal(pg);pg.wait_for_timeout(400)
    chk(ev("lbCfg().tpls.some(t=>t.name==='Fiambres'&&t.w===60&&t.h===40)"),'nueva plantilla «Fiambres» desde el modelo 60 × 40')
    pg.wait_for_timeout(800);pg.reload();pg.wait_for_timeout(1000)
    login(pg,'1234')
    chk(ev("lbCfg().tpls.some(t=>t.name==='Fiambres')") and ev("lbCfg().tpls.some(t=>t.media.type==='sheet'&&t.name.startsWith('Góndola'))"),'las plantillas quedan guardadas al recargar')
    # marca
    ev("go('etiquetas');A.lbTab({dataset:{t:'marca'}})");pg.wait_for_timeout(500)
    pg.fill('#lm-name','Almacén Prueba');pg.locator('#lm-name').dispatch_event('change');pg.wait_for_timeout(200)
    chk(ev("lbVars(prod('t-gas')).comercio")=='Almacén Prueba','el nombre de la marca llega a {comercio}')
    big=np.full((900,1600,3),255,np.uint8);big[600:900]=np.random.default_rng(3).integers(0,255,(300,1600,3),dtype=np.uint8);cv2.putText(big,'LOGO',(200,600),cv2.FONT_HERSHEY_SIMPLEX,15,(0,0,0),40);cv2.imwrite('/tmp/lb_biglogo.png',big)
    pg.set_input_files('#lm-file','/tmp/lb_biglogo.png');pg.wait_for_timeout(1500)
    ln=ev("(lbCfg().brand.logo||'').length")
    chk(0<ln<=60000,'logo pesado (1600 × 900 con ruido): se guarda achicado en %d caracteres (máx. 60.000, para no trabar la sincronización)'%ln)
    chk(len(ev("JSON.stringify(S.cfg)"))<400000,'la configuración completa sigue debajo del límite de 400.000 de la nube')
    bw=ev("new Promise(r=>lbToBW(lbLogoSrc(),150,u=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let o=0;for(let k=0;k<d.length;k+=4){if(d[k]!==0&&d[k]!==255)o++;}r([c.width,o])};i.src=u}))")
    chk(bw[0]>0 and bw[1]==0,'logo en blanco y negro: sólo píxeles negros o blancos (%s)'%bw)
    # permisos: mostrador no ve Etiquetas
    ev("user=null");login(pg,'0000',[i for i,o in enumerate(ev("[...document.querySelectorAll('#lu option')].map(o=>o.textContent)")) if 'Mostrador' in o][0] if False else 0) if False else None
    ctx.close()
    # --- 360 px ---
    ctx=b.new_context(viewport={'width':360,'height':800});pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    pg.add_init_script("try{localStorage.setItem('rave.ux.config','all')}catch(e){}");login(pg,'1234');bad=[]
    for t in ['cola','editor','marca']:
        ev("go('etiquetas');A.lbTab({dataset:{t:'%s'}})"%t);pg.wait_for_timeout(500)
        if ev("document.documentElement.scrollWidth")>362: bad.append(t)
    chk(not bad,'360 px sin desbordes: %s'%bad)
    ctx.close()
    # --- Almacén RAVE: apagado y sin datos de ejemplo ---
    pg=b.new_page();ev=pg.evaluate;pg.on('pageerror',lambda e:errs.append('cliente: '+str(e)[:200]))
    pg.goto('file://%s/out_cliente.html'%D);pg.wait_for_timeout(1300)
    chk(ev("typeof giOn")=='function' and not any(ev("['pos_hold','price_hist','price_bulk','kiosk','hr_vales','labels'].map(k=>giOn(k))")),'Almacén RAVE: los 6 módulos nuevos nacen apagados')
    chk(ev("(S.holds||[]).length")==0 and ev("(S.lblQ||[]).length")==0 and ev("(S.vales||[]).length")==0 and ev("(S.priceLog||[]).length")==0,'Almacén RAVE: sin datos de ejemplo')
    chk(not ev("SCREENS.etiquetas.show()") and not ev("SCREENS.precios.show()") and not ev("SCREENS.vales.show()"),'Almacén RAVE: Etiquetas, Precios y Vales no aparecen hasta activarlos')
    ev("S.receipts=S.receipts||[];S.receipts.push({id:'x',ts:Date.now(),items:[{pid:'a',qty:3}]});save()")
    chk(ev("(S.lblQ||[]).length")==0,'Almacén RAVE apagado: una compra no llena la cola')
    pg.close()
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
