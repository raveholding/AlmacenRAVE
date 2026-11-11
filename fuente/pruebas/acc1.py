# V26.66 · Restablecer acceso con clave temporal (nube simulada). Compilar antes: SUPABASE_URL=https://pruebarave.supabase.co SUPABASE_KEY=sb_publishable_prueba RAVE_SLUG=x python3 build.py cliente /tmp/rave/cli.html
import json
from playwright.sync_api import sync_playwright
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
TEMP='ABCD-EFGH-JK23'
state={'pw':'ABCDEFGHJK23','llave':None,'patched':None,'newpw':None,'calls':[]}
def handler(route):
    req=route.request;u=req.url;m=req.method;state['calls'].append(m+' '+u.split('.co',1)[1][:80])
    body=req.post_data or ''
    J=lambda o,st=200:route.fulfill(status=st,content_type='application/json',body=json.dumps(o))
    if '/auth/v1/settings' in u:return J({'external':{'google':True}})
    if 'grant_type=password' in u:
        b=json.loads(body)
        if b['password']==state['pw']:return J({'access_token':'t','refresh_token':'r','expires_in':3600,'user':{'id':'u1','email':'ana@x.com'}})
        return J({'error_description':'Invalid login credentials'},400)
    if '/rest/v1/miembros' in u:return J([{'rol':'mostrador','nombre':'Ana','comercio_id':'c1','comercios':{'id':'c1','nombre':'Almacén X','slug':'x'}}])
    if '/rest/v1/llaves?' in u and m=='GET':return J([state['llave']])
    if '/rest/v1/llaves?' in u and m=='PATCH':state['patched']=json.loads(body);return route.fulfill(status=204,body='')
    if '/auth/v1/user' in u and m=='PUT':state['newpw']=json.loads(body)['password'];return J({'id':'u1'})
    if '/rpc/registrar_caja' in u:return J(True)
    if '/rpc/restablecer_acceso_miembro' in u:state['rpc']=json.loads(body);return J({'ok':True})
    return J([])
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);ctx=b.new_context(viewport={'width':1200,'height':900});pg=ctx.new_page();ev=pg.evaluate
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    ctx.route('https://pruebarave.supabase.co/**',handler)
    pg.goto('file:///tmp/rave/cli.html#acceso');pg.wait_for_timeout(1500)
    w=ev(f"wrapDek(new Uint8Array(32).fill(7),normCode('{TEMP}')).then(w=>({{kdf:w.kdf,wrap:w.wrap,temporal:true}}))")
    state['llave']=w
    chk(pg.locator('#login [data-act=googleGo]').count()==1,'con Google activado en Supabase aparece «Ingresar con Google»')
    chk('Restablecer acceso' in ev("loginHtml('ayuda')"),'la ayuda explica la clave temporal del administrador')
    pg.fill('#cl-em','ana@x.com');pg.fill('#cl-pw','abcd efgh jk23');pg.click('#cl-go');pg.wait_for_timeout(1500)
    chk(pg.locator('text=Elegí tu contraseña nueva').count()>=1,'entrando con la clave temporal (en minúsculas y con espacios) pide la contraseña nueva')
    pg.fill('#np-1','MiClaveNueva-2026');pg.fill('#np-2','MiClaveNueva-2026');pg.click('.ov [data-m=ok]');pg.wait_for_timeout(2500)
    chk(state['newpw']=='MiClaveNueva-2026','cambia la contraseña en la cuenta')
    chk(state['patched'] and state['patched']['temporal']==False,'la llave queda re-envuelta con la contraseña nueva y deja de ser temporal')
    ok=ev(f"unwrapDek({json.dumps(state['patched'])},'MiClaveNueva-2026').then(r=>Array.from(r).every(x=>x===7)).catch(()=>false)")
    chk(ok,'la llave nueva abre los mismos datos con la contraseña nueva')
    chk(ev("location.hash").startswith('#panel'),'queda dentro del panel')
    # el administrador restablece: genera la clave y envuelve la llave
    ev("cl.rol='admin';cl.dekRaw=new Uint8Array(32).fill(9);user.role='admin'")
    ev("A.nbReset({dataset:{u:'u2',n:'Beto',e:'beto@x.com'}})");pg.wait_for_timeout(300)
    pg.click('.ov [data-m=ok]');pg.wait_for_timeout(1200)
    code=pg.locator('.ov .dlg p[style*=monospace]').inner_text()
    chk(state.get('rpc') and state['rpc']['p_usuario']=='u2' and len(state['rpc']['p_clave'])==12,'llama a restablecer_acceso_miembro con la clave temporal')
    ok2=ev(f"unwrapDek({json.dumps(state['rpc']['p_llave'])},normCode('{code}')).then(r=>Array.from(r).every(x=>x===9)).catch(()=>false)")
    chk(ok2,'la llave enviada se abre con la clave temporal que se muestra')
    chk(pg.locator('.ov [data-act=secWa]').count()==1,'ofrece mandar el mensaje por WhatsApp')
    pg.screenshot(path='/home/claude/t/reset.png')
    chk(not errs,'sin errores JS '+str(errs[:2]))
print('RESULTADO',sum(res),'/',len(res))
