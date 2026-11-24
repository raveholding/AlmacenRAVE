# V27.31b · alta con Google y foto pegada (gratis): botones, pegar imagen, recorte, guardar con foto y publicado en el menú
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/out_cliente.html'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);ctx=b.new_context(viewport={'width':1280,'height':900})
    pg=ctx.new_page();ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(800)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    ev("go('inventario')");pg.wait_for_timeout(300)
    ev("A.pedit({dataset:{}})");pg.wait_for_timeout(400)
    chk(pg.locator('#pw-gg').count()==1,'barra: botón «Buscar en Google»')
    chk(pg.locator('#pw-gimg').count()==1 and pg.locator('#pw-paste').count()==1,'foto: «Buscar foto en Google» y «Pegar foto»')
    pg.fill('#pm-n','Fernet de prueba 750 ml')
    ev("window._op=[];window.open=(u)=>{window._op.push(u);return null}")
    pg.click('#pw-gimg');u=ev("window._op.filter(Boolean).join(' ')")
    chk('google.com/search?tbm=isch&q=Fernet%20de%20prueba%20750%20ml' in u,'abre Google Imágenes con el nombre: '+u[:80])
    pg.click('#pw-gg');u2=ev("window._op.filter(Boolean).pop()||''")
    chk(u2.startswith('https://www.google.com/search?q=') ,'abre Google con el nombre (datos)')
    # pegar una imagen (evento paste con un PNG generado)
    ev("""(async()=>{const c=document.createElement('canvas');c.width=600;c.height=600;const x=c.getContext('2d');x.fillStyle='#c33';x.fillRect(0,0,600,600);
      const bl=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([bl],'f.png',{type:'image/png'}));
      const w=document.querySelector('#pm-n').closest('.ov');const e=new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true});w.querySelector('#pm-n').dispatchEvent(e);})()""")
    pg.wait_for_timeout(800)
    ok=pg.locator('#modal-root .ov').count()>=2
    chk(ok,'al pegar abre el recorte')
    if ok:
        pg.locator('#modal-root .ov').last.locator('[data-m=ok]').click();pg.wait_for_timeout(500)
    st=pg.inner_text('#pm-imgs')
    chk('Foto lista' in st,'foto lista: '+st[:90])
    chk(ev("document.querySelector('#pm-m').checked"),'queda marcado «Publicar en menú digital»')
    # completar y guardar
    ev("""(()=>{const r=document.querySelector('#pm-r');if(r&&!r.value){const o=[...r.options].find(o=>o.value);if(o)r.value=o.value;r.dispatchEvent(new Event('change',{bubbles:true}));}})()""")
    pg.fill('#pm-p','5000') if pg.locator('#pm-p').count() else None
    if pg.locator('#pm-f').count(): pg.fill('#pm-f','5000')
    pg.locator('#modal-root .ov').first.locator('[data-m=ok]').click();pg.wait_for_timeout(600)
    pr=ev("(()=>{const p=S.products.find(x=>x.name==='Fernet de prueba 750 ml');return p?{img:!!p.img&&p.img.startsWith('data:image/'),menu:!!p.menu}:null})()")
    chk(pr and pr['img'],'el producto se guarda con la foto (%s)'%(pr,))
    chk(pr and pr['menu'],'y publicado en el menú')
    if not pr: print(pg.inner_text('#modal-root')[:400])
    # editar: la foto pegada no tilda el menú solo
    chk(not errs,'sin errores JS %s'%errs[:2])
    b.close()
print(f"{sum(res)} OK / {len(res)-sum(res)} FALLAN de {len(res)}")
