# API REST de Proveedores y Compras (Edge Function "api") contra la base real del rig
import json,ssl,subprocess,urllib.request,urllib.error,uuid
import os
for k in ('HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy','ALL_PROXY'):os.environ.pop(k,None)
BASE='https://localhost:3443'
CTX=ssl.create_default_context();CTX.check_hostname=False;CTX.verify_mode=ssl.CERT_NONE
res=[]
def ok(c,m):
    res.append(bool(c));print(('OK   ' if c else 'FALLA ')+m);return c
def sql(q):return subprocess.run(['curl','-sk','--noproxy','*',BASE+'/__rig/sql','--data-binary',q],capture_output=True,text=True).stdout.strip()
def http(method,path,body=None,tok=None,tenant=None,extra=None):
    h={'apikey':'x','Content-Type':'application/json'}
    if tok:h['Authorization']='Bearer '+tok
    if tenant:h['X-Tenant-Id']=tenant
    if extra:h.update(extra)
    rq=urllib.request.Request(BASE+path,data=(json.dumps(body).encode() if body is not None else None),method=method,headers=h)
    try:
        r=urllib.request.urlopen(rq,context=CTX);return r.status,(json.loads(r.read() or b'null')),dict(r.headers)
    except urllib.error.HTTPError as e:
        t=e.read().decode();
        try:j=json.loads(t)
        except Exception:j=t
        return e.code,j,dict(e.headers)
def signup(email):
    s,j,_=http('POST','/auth/v1/signup',{'email':email,'password':'Clave-Muy-Segura-1'});return j['access_token']
def rpc(name,args,tok):return http('POST','/rest/v1/rpc/'+name,args,tok)
tok=signup('dueno@api.test');tok2=signup('intruso@api.test')
sql("select public.rave_invitar_comercio('dueno@api.test','Comercio API','INVITA-API-1')")
s,j,_=rpc('crear_comercio',{'p_nombre':'Comercio API','p_rubro':'comercio','p_codigo':'INVITA-API-1'},tok);C=j['id']
sync=lambda ch:rpc('sincronizar',{'p_comercio':C,'p_dispositivo':'api1','p_cambios':ch},tok)
sync([{'c':'prod','id':'ap1','d':{'name':'Fernet','price':2000000,'cost':1000000,'unit':'u'}},{'c':'rubros','id':'rg','d':{'name':'Mercadería','kind':'shared'}},{'c':'turnos','id':'tx','d':{'openAt':1,'closedAt':0}}])
sync([{'c':'smov','id':'s0','d':{'pid':'ap1','d':5}}])
T=lambda p,**k:http(p[0],p[1],tok=k.get('tok',tok),tenant=k.get('tenant',C),body=k.get('body'),extra=k.get('extra'))
s,j,_=http('GET','/functions/v1/api/proveedores',tenant=C);ok(s==401 and j['error']['codigo']=='no_autenticado','sin sesión: 401')
s,j,_=http('GET','/functions/v1/api/proveedores',tok=tok);ok(s==400 and j['error']['codigo']=='tenant_invalido','sin X-Tenant-Id: 400')
s,j,_=http('GET','/functions/v1/api/proveedores',tok=tok,tenant='no-uuid');ok(s==400,'X-Tenant-Id inválido: 400')
s,j,h=http('OPTIONS','/functions/v1/api/proveedores');ok(s==204 and 'x-tenant-id' in h.get('Access-Control-Allow-Headers','').lower(),'CORS preflight 204 con las cabeceras de la API')
s,j,_=T(('GET','/functions/v1/api/nada'));ok(s==404,'ruta inexistente: 404')
s,j,_=T(('PUT','/functions/v1/api/proveedores'));ok(s==405,'método no permitido: 405')
s,j,_=T(('GET','/functions/v1/api/proveedores'),tok=tok2);ok(s==403,'un usuario de OTRO comercio: 403')
s,j,_=T(('POST','/functions/v1/api/proveedores'),body={'razon_social':'Dist Norte','cuit':'30-71234567-1','condicion_iva':'Responsable Inscripto','email':'a@norte.com'});ok(s==201 and j['ok'] and j['data']['cuit']=='30712345671','POST /api/proveedores crea (201) y normaliza el CUIT')
P=j['data']['id']
s,j,_=T(('POST','/functions/v1/api/proveedores'),body={'razon_social':'Mala','cuit':'30712345672','condicion_iva':'Exento'});ok(s==422 and 'CUIT' in j['error']['mensaje'],'CUIT inválido: 422 con mensaje claro')
s,j,_=T(('POST','/functions/v1/api/proveedores'),body={'razon_social':'Sur SRL','cuit':'30698765433','condicion_iva':'Monotributista'});ok(s==201,'segundo proveedor')
s,j,_=T(('GET','/functions/v1/api/proveedores?q=norte&orden=saldo&dir=desc'));ok(s==200 and j['data']['total']==1 and j['data']['items'][0]['estado_cuenta']=='Al día','GET /api/proveedores filtra por nombre y trae estado de cuenta')
s,j,_=T(('GET','/functions/v1/api/proveedores?orden=saldo;drop'));ok(s==422,'orden fuera de la lista blanca: 422')
s,j,_=T(('POST','/functions/v1/api/compras/orden'),body={'proveedor_id':P,'estado':'Solicitada','total':1,'items':[{'producto_id':'ap1','cantidad':10,'precio_costo_pactado':100.5}]})
ok(s==201 and j['data']['total']==1005 and j['data']['estado']=='Solicitada','POST /api/compras/orden: 201 y total calculado por el servidor (1005, no el 1 enviado)')
OC=j['data']['id']
s,j,_=T(('GET','/functions/v1/api/compras/ordenes?estado=Solicitada'));ok(s==200 and len(j['data'])==1,'GET órdenes pendientes de recepción')
rec={'proveedor_id':P,'orden_compra_id':OC,'tipo_comprobante':'Factura','nro_comprobante':'0001-00000077','condicion_pago':'credito','total_declarado':1005,'items':[{'producto_id':'ap1','cantidad':10,'precio_costo':100.5}]}
s,j,_=T(('POST','/functions/v1/api/compras/recepcion'),body=rec);ok(s==400 or s==422,'recepción sin idempotency_key: rechazada')
key=str(uuid.uuid4())
s,j,_=T(('POST','/functions/v1/api/compras/recepcion'),body=rec,extra={'Idempotency-Key':key})
ok(s==201 and j['data']['orden_estado']=='Recibida' and j['data']['saldo_proveedor']==1005 and j['data']['items'][0]['stock_nuevo']==15,'POST /api/compras/recepcion: 201, orden Recibida, deuda 1005, stock 5→15')
ok(j['data']['items'][0]['costo_anterior']==10000 and j['data']['items'][0]['costo_nuevo']==100.5,'respuesta con costo anterior y nuevo (pesos)')
s,j2,_=T(('POST','/functions/v1/api/compras/recepcion'),body=rec,extra={'Idempotency-Key':key});ok(s==200 and j2['data']['repetido'] is True and j2['data']['ingreso_id']==j['data']['ingreso_id'],'reenviar con la misma Idempotency-Key: 200, mismo resultado')
ok(sql("select (datos->>'stock')||'/'||(datos->>'cost') from registros where coleccion='prod' and id='ap1'")=='15.000/10050','base: stock 15 y costo 10.050 centavos (una sola vez)')
s,j,_=T(('GET','/functions/v1/api/proveedores/%s/cuenta'%P));ok(s==200 and len(j['data']['movimientos'])==1 and j['data']['proveedor']['saldo_cuenta_corriente']==1005,'GET /api/proveedores/{id}/cuenta')
s,j,_=T(('POST','/functions/v1/api/compras/pago'),body={'proveedor_id':P,'monto':500,'medio_pago':'efectivo','rubro_id':'rg','turno_id':'tx','idempotency_key':'pago-api-0001'});ok(s==201 and j['data']['saldo_proveedor']==505 and j['data']['movimiento_caja_id'],'POST /api/compras/pago en efectivo: egreso de caja y saldo 505')
s,j,_=T(('POST','/functions/v1/api/compras/pago'),body={'proveedor_id':P,'monto':5000,'medio_pago':'transferencia','rubro_id':'rg','idempotency_key':'pago-api-0002'});ok(s==422 and 'supera' in j['error']['mensaje'],'pago mayor a la deuda: 422')
s,j,_=T(('POST','/functions/v1/api/compras/nota-credito'),body={'proveedor_id':P,'monto':5,'referencia':'NC-1','motivo':'Rotura','idempotency_key':'nc-api-0001'});ok(s==201 and j['data']['saldo_proveedor']==500,'POST /api/compras/nota-credito')
s,j,_=T(('POST','/functions/v1/api/compras/orden/%s/estado'%OC),body={'estado':'Cancelada'});ok(s==422,'cancelar una orden ya Recibida: 422')
s,j,_=T(('GET','/functions/v1/api/proveedores?estado=con_deuda'));ok(j['data']['total']==1 and j['data']['kpis']['deuda_total_proveedores']==500,'KPIs de la API: deuda total 500')
s,j,_=T(('POST','/functions/v1/api/compras/recepcion'),tok=tok2,body=rec,extra={'Idempotency-Key':str(uuid.uuid4())});ok(s==403,'recepción desde otro comercio: 403')
s,j,_=T(('POST','/functions/v1/api/compras/recepcion'),body='{"x":',extra={'Idempotency-Key':'abcdefgh'});ok(s in(400,422),'JSON roto: error controlado')
print(sum(res),'OK /',len(res)-sum(res),'FALLAN de',len(res))
