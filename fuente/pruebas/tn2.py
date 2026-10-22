# Tiendanube en MODO REAL del cliente, con la API de la nube SIMULADA por el navegador (page.route):
# comprueba qué pide la pantalla, que registre una orden una sola vez y que no haga bucles si la función no está instalada.
import sys,json
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
BASE='https://nube.test'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1100,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text and 'Failed to load resource' not in m.text else None)
    ev=pg.evaluate
    h=open('/tmp/rave/index.html',encoding='utf8').read().replace("connect-src 'none'","connect-src "+BASE);open('/tmp/rave/tn2.html','w',encoding='utf8').write(h)
    pg.goto('file:///tmp/rave/tn2.html#acceso');pg.wait_for_timeout(600)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count():
        pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    calls=[];mode={'fn':'noinstalada','regs':0}
    pid=ev("S.products.find(p=>p.active!==false).id");pn=ev("prod(%r).name"%pid);st0=ev("prod(%r).stock"%pid)
    orden={'orden_id':555,'numero':55,'estado':'open','pago_estado':'paid','envio_estado':'unpacked','total_cents':2500000,'subtotal_cents':2500000,'descuento_cents':0,'envio_cents':0,'cliente':{'nombre':'Cliente Real'},'items':[{'variant_id':1,'nombre':'Var','qty':2,'precio_cents':1250000,'producto_local':pid}],'venta_estado':'pendiente','venta_local':None,'tn_creada':'2026-10-21T10:00:00Z'}
    def handler(route):
        req=route.request;u=req.url;calls.append((req.method,u.replace(BASE,'')))
        def J(o,s=200):route.fulfill(status=s,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(o))
        if req.method=='OPTIONS':return route.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'})
        if '/functions/v1/tiendanube' in u:
            if mode['fn']=='noinstalada':return J({'code':'NOT_FOUND','message':'Requested function was not found'},404)
            body=json.loads(req.post_data or '{}')
            if body.get('accion')=='estado':return J({'estado':'conectada','store_id':123,'config':{'stock_fuente':'sistema','precio_fuente':'off','importar_ordenes':True},'app_configurada':True,'productos':{'total':1,'vinculados':1,'sugeridos':0,'sin_vincular':0},'ordenes':{'total':1,'pendientes':1,'por_cobrar':0},'url_webhook':BASE+'/functions/v1/tiendanube?wh=1','url_callback':BASE+'/functions/v1/tiendanube?cb=1','ultima_sync':None,'eventos_error':0})
            return J({})
        if '/rest/v1/tn_productos' in u:return J([{'variant_id':1,'product_id':9,'sku':'','barcode':'','nombre':'Var','precio_cents':1250000,'stock':5,'producto_local':pid,'vinculo':'vinculado'}])
        if '/rpc/tn_ordenes_listar' in u:return J([orden])
        if '/rpc/tn_orden_registrar' in u:
            mode['regs']+=1
            if mode['regs']==1:orden['venta_estado']='registrada';return J({'ok':True})
            return J({'ok':True,'repetido':True})
        if '/rpc/tn_orden_liberar' in u:return J({'ok':True})
        return J([])
    pg.route(BASE+'/**',handler)
    ev("CLOUD.on=true;CLOUD.url=%r;CLOUD.key='sb_publishable_x';cl.ready=true;cl.comercio={id:'c1'};cl.ses={access_token:'t',expires_at:9999999999};window.accessToken=async()=>'t'"%BASE)
    on0=ev("cl.online")
    ev("location.hash='#panel/integ'");pg.wait_for_timeout(900)
    t=pg.locator('#tn-card').inner_text()
    chk('todavía no está instalada' in t,'si la función no está instalada lo dice claro')
    n=len([c for c in calls if 'functions/v1/tiendanube' in c[1]]);pg.wait_for_timeout(1500)
    n2=len([c for c in calls if 'functions/v1/tiendanube' in c[1]])
    chk(n2==n and n<=2,'sin bucle de pedidos (%d, %d)'%(n,n2))
    chk(pg.locator('text=Pasos para conectar cada integración').count()==1,'los pasos se muestran igual')
    chk(ev("cl.online")==on0,'una función ausente NO marca la nube como caída')
    mode['fn']='ok'
    pg.click('[data-act=tnReload]');pg.wait_for_timeout(900)
    t=pg.locator('#tn-card').inner_text()
    chk('Conectada' in t and '123' in t,'con la función instalada muestra la tienda conectada')
    chk(not any(c[0]=='POST' and '/rpc/' in c[1] and 'token' in c[1].lower() for c in calls),'no pide ningún token al servidor')
    pg.click('[data-act=tnTab][data-k=ordenes]');pg.wait_for_timeout(300)
    chk(pg.locator('[data-act=tnReg][data-id="555"]').count()==1,'lista la orden pagada')
    ns=ev("S.sales.length")
    pg.click('[data-act=tnReg][data-id="555"]');pg.wait_for_timeout(300)
    pg.click('.mf [data-m=ok]');pg.wait_for_timeout(900)
    chk(ev("S.sales.length")==ns+1,'registra UNA venta')
    v=ev("S.sales[S.sales.length-1]")
    chk(v['total']==2500000 and v.get('tn')==555,'total exacto y ligada a la orden 555')
    chk(abs(ev("prod(%r).stock"%pid)-(st0-2))<1e-9,'descuenta el stock')
    chk(mode['regs']==1,'reservó la orden una vez en el servidor')
    # segundo intento (repetido): no crea otra venta
    orden['venta_estado']='pendiente';mode['regs']=1
    ev("A.tnReload()");pg.wait_for_timeout(700);pg.click('[data-act=tnTab][data-k=ordenes]');pg.wait_for_timeout(300)
    ns=ev("S.sales.length")
    pg.click('[data-act=tnReg][data-id="555"]');pg.wait_for_timeout(300);pg.click('.mf [data-m=ok]');pg.wait_for_timeout(800)
    chk(ev("S.sales.length")==ns,'si el servidor dice «repetido» no se crea otra venta')
    chk(ev("document.documentElement.scrollWidth<=innerWidth+1"),'sin desborde')
chk(not errs,'consola sin errores %s'%errs[:3])
print('%d/%d'%(sum(res),len(res)));sys.exit(0 if all(res) else 1)
