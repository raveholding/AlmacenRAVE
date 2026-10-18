# V26.1 · marca oficial VINCULAR BUSINESS en todos los productos
from playwright.sync_api import sync_playwright
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.on('console',lambda m:errs.append(m.text[:200]) if m.type=='error' and 'TUNNEL' not in m.text else None)
    ev=pg.evaluate
    for f in ['index.html','out_cliente.html']:
        pg.goto('file:///tmp/rave/%s#acceso'%f);pg.wait_for_timeout(700)
        h=ev("document.body.innerHTML")
        chk('VINCULAR BUSINESS' in h and '(387) 4484132' in h and 'vincularbusiness@gmail.com' in h and 'Tu idea, en buenas manos.' in h,f+': login con datos oficiales y lema')
        chk('wa.me/5493874484132' in h,f+': enlace de WhatsApp al número oficial')
        chk(pg.locator('.vbcred img').count()==1 and ev("document.querySelector('.vbcred img').naturalWidth")>500,f+': banner cargado en el ingreso')
        chk(ev("[...document.querySelectorAll('.vbb-a')].map(a=>a.href).join('|')")=='https://wa.me/5493874484132?text=Hola%20Vincular%20Business!%20Quiero%20consultar%20por%20el%20Sistema%20RAVE.|mailto:vincularbusiness@gmail.com',f+': botones clicables sobre el banner (WhatsApp y correo)')
        chk(ev("[...document.querySelectorAll('.vbbtns a')].map(a=>a.getAttribute('href').split('?')[0]).join('|')")=='https://wa.me/5493874484132|tel:+5493874484132|mailto:vincularbusiness@gmail.com',f+': botones WhatsApp · Llamar · Correo')
        chk(ev("[...document.querySelectorAll('.vbbtns a')].every(a=>a.getBoundingClientRect().height>=47)"),f+': botones de al menos 48 px')
        chk('Rave Holding' not in h and '5143900' not in h and 'raveholding@' not in h,f+': sin créditos viejos')
    errs.clear()
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(600)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(500)
    side=pg.inner_text('#side')
    chk('VINCULAR BUSINESS' in side and '(387) 4484132' in side and 'vincularbusiness@gmail.com' in side and 'Tu idea, en buenas manos.' in side,'menú lateral con datos oficiales')
    tk=ev("(()=>{const s=S.sales[S.sales.length-1];return ticketText(s);})()")
    chk('VINCULAR BUSINESS' in tk and '(387) 4484132' in tk and 'vincularbusiness@gmail.com' in tk and 'Tu idea, en buenas manos.' in tk,'ticket con datos oficiales')
    chk(all(len(l)<=32 for l in ev("(()=>{const s=S.sales[S.sales.length-1];return ticketText(s,32);})()").split('\n') if 'VINCULAR' in l or 'Cel.' in l or 'vincularbusiness' in l or 'buenas manos' in l),'ticket 58 mm: líneas de la marca caben en 32 columnas')
    # menú público
    pg.goto('file:///tmp/rave/index.html#menu');pg.wait_for_timeout(900)
    fr=[f for f in pg.frames if f!=pg.main_frame]
    ctx=fr[0] if fr else pg
    t=ctx.evaluate("document.body.innerText"); h=ctx.evaluate("document.body.innerHTML")
    chk('VINCULAR BUSINESS' in t and '(387) 4484132' in t and 'vincularbusiness@gmail.com' in t and 'Tu idea, en buenas manos.' in t,'menú público: créditos oficiales')
    chk('wa.me/5493874484132' in h and 'wa.me/5493875143900' not in h,'menú público: WhatsApp del desarrollador = número oficial (botón y flotante)')
    chk(ctx.evaluate("(()=>{const i=document.querySelector('.dc-banner');return !!i&&i.naturalWidth>500})()"),'menú público: banner cargado')
    chk(ctx.evaluate("[...document.querySelectorAll('.dc-ov,.dc-btn')].map(a=>a.getAttribute('href')).join('|')").startswith('https://wa.me/5493874484132?text=')  and 'tel:+5493874484132' in ctx.evaluate("[...document.querySelectorAll('.dc-btn')].map(a=>a.getAttribute('href')).join('|')") and 'mailto:vincularbusiness@gmail.com' in h,'menú público: botones WhatsApp · Llamar · Correo y áreas del banner')
    chk('Rave Holding' not in h,'menú público: sin créditos viejos')
    ctx.evaluate("document.querySelector('.dev-credit').scrollIntoView()")
    # inglés
    try:
        ctx.evaluate("(window.setLang||function(){})('en')")
        ctx.evaluate("document.getElementById('lang-toggle') && document.getElementById('lang-toggle').click()")
    except Exception as e: pass
    pg.wait_for_timeout(300)
    # 320 px sin desborde
    for w in (320,360):
        pg.set_viewport_size({'width':w,'height':700});pg.wait_for_timeout(400)
        ov=ctx.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth+1")
        chk(not ov,'menú público sin desborde a %d px'%w)
    chk(not errs,'sin errores de consola: '+str(errs[:2]))
    b.close()
print(sum(res),'OK /',len(res)-sum(res),'FALLAN de',len(res))
