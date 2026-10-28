# V26.30 · Ingresar con Google (OAuth PKCE contra Supabase, simulado): challenge correcto, clave del sistema la 1.ª vez, «recordar en este equipo», rechazo de cuenta ajena y de estado vencido
import json,threading,http.server,socketserver,functools,hashlib,base64,urllib.parse,sys,os
from playwright.sync_api import sync_playwright
ROOT='/tmp/rave/www';PORT=8765;SB='https://rdvwrrroerxikfqvpgnh.supabase.co'
class Q(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**k):super().__init__(*a,directory=ROOT,**k)
    def log_message(self,*a):pass
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.TCPServer(('127.0.0.1',PORT),Q);threading.Thread(target=srv.serve_forever,daemon=True).start()
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
st={'chal':None,'member':True,'calls':[]}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);ctx=b.new_context();pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    def route(r):
        u=r.request.url;st['calls'].append(u.split('?')[0].replace(SB,''))
        if '/auth/v1/authorize' in u:
            q=urllib.parse.parse_qs(urllib.parse.urlparse(u).query);st['chal']=q['code_challenge'][0];st['method']=q['code_challenge_method'][0]
            return r.fulfill(status=302,headers={'location':q['redirect_to'][0]+'&code=CODE123'})
        if '/auth/v1/token' in u and 'pkce' in u:
            body=json.loads(r.request.post_data);v=body['code_verifier']
            ok=body['auth_code']=='CODE123' and base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).decode().rstrip('=')==st['chal']
            st['pkce_ok']=ok
            if not ok:return r.fulfill(status=400,content_type='application/json',body='{"error":"bad"}')
            return r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps({'access_token':'AT','refresh_token':'RT','expires_in':3600,'user':{'id':'11111111-1111-1111-1111-111111111111','email':'juan@gmail.com'}}))
        if '/rest/v1/miembros' in u:
            return r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps([{'rol':'admin','nombre':'Juan','comercio_id':'c1','comercios':{'id':'22222222-2222-2222-2222-222222222222','nombre':'Almacén RAVE','slug':'almacen-rave'}}] if st['member'] else []))
        if '/rest/v1/llaves' in u and r.request.method=='GET':
            return r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps([st['wrap']]))
        if '/rest/v1/rpc/registrar_caja' in u:
            return r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body='true')
        if '/functions/v1/llave' in u:
            if r.request.method=='OPTIONS':return r.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'})
            body=json.loads(r.request.post_data or '{}');st.setdefault('llave',[]).append(body.get('accion'))
            if body.get('accion')=='abrir':
                return r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps({'ok':True,'activa':True,'dek':st['dek']} if st.get('cust') else {'ok':False,'activa':False}))
            if body.get('accion')=='estado':
                return r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps({'ok':True,'activa':bool(st.get('cust')),'desde':'2026-10-28T00:00:00Z','servidor':True}))
            if body.get('accion')=='guardar':
                st['cust']=True;st['guardada']=body.get('dek');return r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body='{"ok":true}')
        if '/auth/v1/recover' in u:
            st['recover']=u;return r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body='{}')
        if '/auth/v1/settings' in u:
            return r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps({'external':{'google':st.get('gon',True),'email':True}}))
        if r.request.method=='OPTIONS':
            return r.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'})
        return r.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body='[]')
    ctx.route(SB+'/**',route)
    pg.goto(f'http://127.0.0.1:{PORT}/#acceso');pg.wait_for_timeout(1200)
    k=ev("(async()=>{const raw=rnd(32);const w=await wrapDek(raw,'clave-de-prueba-123');return {w:{kdf:w.kdf,wrap:w.wrap,temporal:false},raw:b64(raw)}})()")
    st['wrap']=k['w'];st['dek']=k['raw']
    chk(pg.locator('[data-act=googleGo]').count()==1,'botón «Ingresar con Google» en Acceso del equipo (proveedor activado)')
    chk(ev("document.querySelector('[data-act=googleGo]').nextElementSibling.nextElementSibling.getAttribute('for')")=='cl-em','el botón queda antes del campo Correo')
    pg.click('[data-act=googleGo]');pg.wait_for_timeout(2500)
    chk(st.get('method')=='s256' and st['chal'],'PKCE: se envía code_challenge S256')
    chk(st.get('pkce_ok') is True,'PKCE: el code_verifier corresponde al challenge')
    chk('?code=' not in pg.url and 'code=' not in pg.url,'el código se borra de la dirección')
    chk(pg.locator('#gk-p').count()==1,'primera vez en el equipo: pide la clave del sistema')
    pg.fill('#gk-p','mala');pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(2500)
    chk('no es correcta' in ev("document.body.innerText"),'clave equivocada: rechazada')
    pg.click('[data-act=googleGo]');pg.wait_for_timeout(2500)
    pg.fill('#gk-p','clave-de-prueba-123');pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(3500)
    chk(ev("typeof user!=='undefined'&&user&&user.name==='Juan'&&user.role==='admin'"),'entró como Juan (administrador)')
    chk(ev("(async()=>!!(await kvGet('gdev:11111111-1111-1111-1111-111111111111')))()"),'«Recordar en este equipo» guarda la llave envuelta')
    g=ev("(async()=>{const r=await kvGet('gdev:11111111-1111-1111-1111-111111111111');return {ext:r.key.extractable,hasRaw:JSON.stringify(r).includes('raw')}})()")
    chk(g['ext'] is False,'la clave del equipo NO es exportable')
    # segundo ingreso: sin clave
    ev("cl.ready=false;user=null;cl.ses=null");pg.goto(f'http://127.0.0.1:{PORT}/#acceso');pg.wait_for_timeout(1200)
    pg.click('[data-act=googleGo]');pg.wait_for_timeout(3500)
    chk(pg.locator('#gk-p').count()==0 and ev("!!(user&&user.name==='Juan')"),'segunda vez en el mismo equipo: entra sólo con Google')
    # cuenta de Google no asociada
    st['member']=False;ev("cl.ready=false;user=null;cl.ses=null");pg.goto(f'http://127.0.0.1:{PORT}/#acceso');pg.wait_for_timeout(1200)
    pg.click('[data-act=googleGo]');pg.wait_for_timeout(3000)
    chk('no está asociada a este comercio' in ev("document.body.innerText"),'cuenta de Google ajena: no entra y lo explica')
    # código sin haber empezado en este equipo (CSRF / vencido)
    st['member']=True;pg.goto(f'http://127.0.0.1:{PORT}/?gs=otro&code=CODE123#acceso');pg.wait_for_timeout(2000)
    chk('venció o no empezó en este equipo' in ev("document.body.innerText"),'código que no empezó en este equipo: rechazado')
    # error devuelto por Google
    pg.goto(f'http://127.0.0.1:{PORT}/?error=access_denied&error_description=El+usuario+cancel%C3%B3#acceso');pg.wait_for_timeout(1500)
    chk('Google no completó el ingreso' in ev("document.body.innerText"),'Google cancelado: mensaje claro')
    # enlace de correo vencido (otp_expired)
    pg.goto(f'http://127.0.0.1:{PORT}/?r=2#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');pg.wait_for_timeout(1500)
    chk('venció o ya se usó' in ev("document.body.innerText"),'enlace de correo vencido: mensaje claro (no queda en una página rota)')
    # recuperar contraseña: vuelve a ESTA dirección (no a localhost:3000)
    pg.fill('#cl-em','juan@gmail.com');pg.click('[data-act=cloudForgot]');pg.wait_for_timeout(800)
    chk('redirect_to=http%3A%2F%2F127.0.0.1%3A8765%2F' in st.get('recover',''),'«Olvidé mi contraseña» manda el enlace a la dirección del sistema: '+st.get('recover','')[-60:])
    # custodia: el admin la activa y otro equipo entra sólo con Google
    pg.click('[data-act=googleGo]');pg.wait_for_timeout(3000)
    ev("location.hash='#panel/nube';rerender()");pg.wait_for_timeout(1200)
    chk(pg.locator('#cust-card').count()==1,'el administrador ve «Ingreso sólo con Google»')
    pg.click('[data-act=custOn]');pg.wait_for_timeout(300);pg.locator('#modal-root [data-m=ok]').last.click();pg.wait_for_timeout(1200)
    chk(st.get('guardada')==st['dek'],'activar manda la llave del comercio a la custodia')
    ctx3=b.new_context();ctx3.route(SB+'/**',route);p3=ctx3.new_page();p3.on('pageerror',lambda e:errs.append(str(e)[:300]))
    p3.goto(f'http://127.0.0.1:{PORT}/#acceso');p3.wait_for_timeout(1500);p3.click('[data-act=googleGo]');p3.wait_for_timeout(3500)
    chk(p3.locator('#gk-p').count()==0 and p3.evaluate("!!(user&&user.name==='Juan')"),'equipo NUEVO con custodia activa: entra sólo con Google, sin clave del sistema')
    st['gon']=False;ctx2=b.new_context();ctx2.route(SB+'/**',route);p2=ctx2.new_page();p2.goto(f'http://127.0.0.1:{PORT}/#acceso');p2.wait_for_timeout(1500)
    chk(p2.locator('[data-act=googleGo]').count()==0 and p2.locator('#cl-em').count()==1,'proveedor Google sin activar en Supabase: el botón NO aparece (no lleva a un error)')
    chk(not [e for e in errs if 'Failed to fetch' not in e],'sin errores '+str(errs[:2]))
    b.close()
srv.shutdown()
print(f"\n{sum(res)}/{len(res)}")
