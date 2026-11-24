# V27.31 · Alta de productos desde internet en el cliente (función «productos» simulada): normalización, rubro de socio sin elegir, foto por la función con licencia, sin precios
import json,base64,struct,zlib
from playwright.sync_api import sync_playwright
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
def png(w,h):
    raw=b''.join(b'\x00'+b'\xc8\x96\x3e'*w for _ in range(h))
    def ch(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b'')
EAN='7790070012050'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page();ev=pg.evaluate;errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]));sent=[]
    def h(route):
        r=route.request
        if '/functions/v1/productos' in r.url:
            body=json.loads(r.post_data or '{}');sent.append(body)
            if body.get('accion')=='buscar':out={'ok':True,'fuente':'off','confianza':0.7,'borrador':{'barcode':body['q'],'nombre':'GASEOSA COLA ORIGINAL','marca':'Marca X','presentacion':'2.25 l','descripcion':'Bebida <b>gasificada</b>','categoria_fuente':'Bebidas > Gaseosas','alcohol':False,'imagenes':[{'url':'https://images.openfoodfacts.org/x.png','fuente':'off','licencia':'CC BY-SA'}],'atribucion':'Datos de Open Food Facts (ODbL)'},'avisos':[]}
            else:out={'ok':True,'mime':'image/png','w':400,'h':400,'b64':base64.b64encode(png(400,400)).decode()}
            return route.fulfill(status=200,body=json.dumps(out),headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'})
        route.fulfill(status=404,body='{}',headers={'Access-Control-Allow-Origin':'*'})
    pg.route('https://pruebarave.supabase.co/**',h);pg.route('https://images.openfoodfacts.org/**',lambda r:r.fulfill(status=200,body=png(400,400),headers={'Content-Type':'image/png'}))
    pg.goto('file:///tmp/rave/cli.html#acceso');pg.wait_for_timeout(1500)
    ev("(()=>{user={id:'u',name:'ADMIN',role:'admin'};cl.ready=true;cl.online=true;cl.rol='admin';cl.comercio={id:'22222222-2222-2222-2222-222222222222'};cl.ses={access:'x.y.z',refresh:'r',exp:Date.now()+3e6};})()")
    ev("location.hash='#panel/inventario'");pg.wait_for_timeout(600);ev("A.pedit({dataset:{}})");pg.wait_for_timeout(300)
    pg.fill('#pw-q',EAN);pg.click('#pw-go');pg.wait_for_timeout(800)
    chk(any(x.get('accion')=='buscar' and x.get('q')==EAN for x in sent),'el cliente consulta la función «productos»')
    chk(ev("$('#pm-n').value")=='Gaseosa cola original 2,25 L' and ev("$('#pm-sub').value")=='2,25 L','normaliza mayúsculas y presentación (2,25 L)')
    chk(ev("$('#pm-d').value")=='Bebida gasificada','limpia HTML de la descripción')
    chk('Open Food Facts' in pg.inner_text('#pw-res') and pg.locator('.pw-img').count()==1,'muestra la fuente y la foto candidata con licencia')
    chk('Sugerencia' in pg.inner_text('#pw-res') or 'Elegí' in pg.inner_text('#pw-res'),'en Almacén RAVE el rubro se sugiere, no se elige solo')
    chk(ev("$('#pm-r').value")=='','el rubro (de un socio) queda sin elegir')
    pg.click('.pw-img');pg.wait_for_timeout(900)
    chk(ev("!!$('.ov')._img||/^data:image/.test($('#pm-imgv').src)"),'la foto elegida se achica y queda lista para guardar')
    chk(any(x.get('accion')=='imagen' for x in sent),'la foto se baja por la función (no desde el navegador)')
    ev("(()=>{const r=$('#pm-r');r.value=r.options[1].value;$('#pm-f').value='3000';})()");pg.click('.ov [data-m=ok]');pg.wait_for_timeout(400)
    pr=ev("S.products.find(x=>x.barcode==='%s')"%EAN)
    chk(pr and pr.get('imgSrc',{}).get('licencia')=='CC BY-SA' and pr.get('img','').startswith('data:image'),'guarda la foto con su licencia (para el crédito)')
    chk(not any(x.get('accion')=='confirmar' for x in sent),'fichas compartidas: apagado por defecto (no se aporta nada)')
    chk(not any('precio' in json.dumps(x).lower() or 'cost' in json.dumps(x).lower() for x in sent),'nunca se mandan precios ni costos a la función')
    print('errores',errs);b.close()
print('%d/%d'%(sum(res),len(res)))
