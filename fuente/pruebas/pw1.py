# V27.31 · Alta de productos desde internet en la demo (catálogo de ejemplo): reglas de códigos, borrador, guardado, duplicados, cancelar y alta desde Vender
import sys,json
from playwright.sync_api import sync_playwright
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1300,'height':900});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]));ev=pg.evaluate
    pg.goto('file:///tmp/rave/solo.html#acceso');pg.wait_for_timeout(1500);pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(800)
    code=ev("PW_SEED[0].barcode")
    ev("go('inventario')");pg.wait_for_timeout(500);ev("A.pedit({dataset:{}})");pg.wait_for_timeout(300)
    chk(pg.locator('#pw-q').count()==1 and pg.locator('#pm-mk').count()==1,'«Nuevo producto» trae «Buscar en la web» y el campo Marca')
    pg.fill('#pw-q','2000123000017');pg.click('#pw-go');pg.wait_for_timeout(300);chk('balanza' in pg.inner_text('#pw-res'),'código de balanza: avisa y no busca')
    pg.fill('#pw-q','7790070012051');pg.click('#pw-go');pg.wait_for_timeout(300);chk('verificador' in pg.inner_text('#pw-res'),'EAN inválido: dígito verificador')
    pg.fill('#pw-q',code);pg.click('#pw-go');pg.wait_for_timeout(800)
    t=pg.inner_text('#pw-res');chk('Borrador' in t and 'catálogo de ejemplo' in t,'resultado como borrador, con la fuente')
    chk(ev("$('#pm-n').value").startswith('Gaseosa cola') and ev("$('#pm-sub').value")=='2,25 L' and ev("$('#pm-b').value")==code and ev("$('#pm-mk').value")=='Marca de ejemplo','completa nombre, presentación, código y marca')
    chk(pg.locator('.pw-fill').count()>=3,'los campos de internet quedan marcados para revisar')
    chk(not ev("$('#pm-m').checked"),'«Publicar en el menú» queda apagado')
    chk(ev("$('#pm-f').value") in ('','0','0,00') ,'el precio NO se completa')
    # guardar
    ev("(()=>{const r=$('#pm-r');if(!r.value)r.value=r.options[1].value;$('#pm-f').value='2500';})()");pg.click('.ov [data-m=ok]');pg.wait_for_timeout(400)
    pr=ev("S.products.find(x=>x.barcode==='%s')"%code)
    chk(pr and pr['marca']=='Marca de ejemplo' and pr['price']==250000,'se guarda con marca y precio propio')
    chk(ev("S.audit.some(a=>a.action==='ALTA_PRODUCTO_WEB')") ,'auditoría ALTA_PRODUCTO_WEB')
    ev("A.pedit({dataset:{}})");pg.wait_for_timeout(200);pg.fill('#pw-q',code);pg.click('#pw-go');pg.wait_for_timeout(500)
    chk('ya está cargado' in pg.inner_text('#pw-res') and pg.locator('#pw-open').count()==1,'código duplicado: ofrece abrir el existente')
    pg.fill('#pw-q','yerba');pg.click('#pw-go');pg.wait_for_timeout(700);chk(ev("$('#pm-n').value").lower().startswith('yerba'),'búsqueda por nombre')
    pg.fill('#pw-q','fideos');pg.click('#pw-go');pg.wait_for_timeout(100)
    if pg.locator('#pw-x').count():pg.click('#pw-x');pg.wait_for_timeout(500);chk('cancelada' in pg.inner_text('#pw-res'),'«Cancelar» corta la búsqueda')
    pg.click('.ov [data-m=x]');pg.wait_for_timeout(200)
    # desde Vender
    code2=ev("PW_SEED[5].barcode");ev("go('vender')");pg.wait_for_timeout(500)
    ev("addByCode('%s')"%code2);pg.wait_for_timeout(300);chk('Código sin cargar' in pg.inner_text('#modal-root'),'Vender: un código válido sin cargar ofrece darlo de alta')
    pg.click('.ov [data-m=ok]');pg.wait_for_timeout(900);chk(ev("$('#pm-b')&&$('#pm-b').value")==code2 and 'Borrador' in pg.inner_text('#pw-res'),'abre el alta con la búsqueda hecha')
    print('errores',errs)
    b.close()
print('%d/%d'%(sum(res),len(res)))
