# V26.41 · Editar el local en celular (densidad x3, dedo real) y PC: tocar el cartel toma el mueble, margen alrededor de góndolas finitas, plano más alto al editar, la página no se mueve.
import sys
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
from playwright.sync_api import sync_playwright
res=[]
def chk(c,m):print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
for dpr,W in [(3,390),(1,1280)]:
  touch=W<600
  with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    ctx=b.new_context(viewport={'width':W,'height':844 if touch else 900},device_scale_factor=dpr,has_touch=touch,is_mobile=touch)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:200]));ev=pg.evaluate
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("S.cfg.ci={on:true,roles:[]};save();showPanel('centro')");pg.wait_for_timeout(600)
    pg.click('[data-act=ciEdit] >> nth=0');pg.wait_for_timeout(400)
    cv=pg.locator('.ci-root canvas.ci-cv');cv.scroll_into_view_if_needed();pg.wait_for_timeout(300)
    h=ev("document.querySelector('.ci-root canvas.ci-cv').getBoundingClientRect().height");print(W,'alto del plano',h)
    if touch: chk(h>=450,'%d px: el plano es más alto al editar (%d px)'%(W,h))
    def drag(x,y,dx,dy):
        if touch:
            cdp=ctx.new_cdp_session(pg)
            def t(tp,xx,yy):cdp.send('Input.dispatchTouchEvent',{'type':tp,'touchPoints':[] if tp=='touchEnd' else [{'x':xx,'y':yy}]})
            t('touchStart',x,y)
            for i in range(1,7):t('touchMove',x+dx*i/6,y+dy*i/6);pg.wait_for_timeout(16)
            t('touchEnd',0,0)
        else:
            pg.mouse.move(x,y);pg.mouse.down();pg.mouse.move(x+dx,y+dy,steps=6);pg.mouse.up()
        pg.wait_for_timeout(400)
    # tocar el CARTEL de un elemento (no el mueble) y arrastrarlo
    tg=ev("(()=>{const r=document.querySelector('.ci-root canvas.ci-cv').getBoundingClientRect();const t=CI._tags.find(t=>t.it&&t.it.e&&t.it.kind==='gond');return{id:t.it.e.id,x:r.left+t.x+t.W/2,y:r.top+t.y+t.H/2,x0:t.it.e.x,y0:t.it.e.y}})()")
    sc=ev("CI._view.sc")
    drag(tg['x'],tg['y'],sc*1.5,sc*1.0)
    e=ev("CI.st.draft.map.items.find(x=>x.id==='%s')"%tg['id'])
    chk(ev("CI.st.esel")==tg['id'],'%d px: tocar el cartel selecciona ese mueble'%W)
    chk(abs(e['x']-tg['x0']-1.5)<0.3 and abs(e['y']-tg['y0']-1.0)<0.3,'%d px: arrastrar desde el cartel lo mueve (%.1f,%.1f → %.1f,%.1f)'%(W,tg['x0'],tg['y0'],e['x'],e['y']))
    sy=ev("scrollY")
    # góndola finita: tocar justo al lado (dentro del margen)
    g=ev("(()=>{const v=CI._view,M=CI.st.draft.map;const e=M.items.find(x=>x.t==='gond'&&x.id!=='%s');const r=document.querySelector('.ci-root canvas.ci-cv').getBoundingClientRect();return{id:e.id,x:r.left+v.ox+(e.x+e.w/2-v.cx)*v.sc,y:r.top+v.oy+(e.y+e.d+0.1-v.cy)*v.sc}})()"%tg['id'])
    drag(g['x'],g['y'],0,0)
    chk(ev("CI.st.esel")==g['id'],'%d px: tocar al lado de una góndola finita también la toma'%W)
    chk(abs(ev("scrollY")-sy)<5,'%d px: la página no se mueve al tocar y arrastrar'%W)
    # agregar heladera y freezer, arrastrar, borrar
    pg.click('[data-act=ciEdAdd][data-t=heladera]');pg.wait_for_timeout(300)
    hid=ev("CI.st.esel");chk(ev("CI.st.draft.map.items.find(x=>x.id==='%s').t"%hid)=='heladera','%d px: agregar heladera'%W)
    pg.click('[data-act=ciEdAdd][data-t=freezer]');pg.wait_for_timeout(300)
    fid=ev("CI.st.esel");pg.click('[data-act=ciEdDel]');pg.wait_for_timeout(300)
    chk(not ev("CI.st.draft.map.items.some(x=>x.id==='%s')"%fid),'%d px: borrar el freezer'%W)
    pg.screenshot(path='/tmp/ed2_%d.png'%W)
    pg.locator('.ci-sbar [data-act=ciEdSave]').click();pg.wait_for_timeout(400)
    chk(ev("!CI.st.edit") and any(x['id']==hid for x in ev("S.cfg.ci.map.items")),'%d px: Guardar deja la heladera en el local'%W)
    chk(not errs,'%d px: sin errores %s'%(W,errs[:1]))
    b.close()
print('%d / %d'%(sum(res),len(res)))
