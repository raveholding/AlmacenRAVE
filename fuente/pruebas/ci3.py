# V26.40 · Centro Inteligente: personal personalizable (nombre visible, función, persona/robot, color, foto, mostrar,
# ubicación) y local editable (agregar, mover, cambiar, girar, duplicar, eliminar, tamaño, volver al automático).
from playwright.sync_api import sync_playwright
import sys,json,struct,zlib,tempfile,os
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
def png(path,w=200,h=160):
    raw=b''.join(b'\x00'+b''.join(bytes([x*255//w,y*255//h,120]) for x in range(w)) for y in range(h))
    ch=lambda t,d:struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b''))
tmp=tempfile.mkdtemp();FOTO=os.path.join(tmp,'cara.png');png(FOTO);TXT=os.path.join(tmp,'nota.txt');open(TXT,'w').write('hola')
SNAP="""(()=>{const o={};for(const k of Object.keys(S)){if(k==='audit'||k==='arqDraft'||k==='events')continue;o[k]=S[k];}const c=Object.assign({},S.cfg);delete c.ci;o.cfg=c;return JSON.stringify(o);})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1366,'height':900});pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("(()=>{S.employees.forEach((e,i)=>S.punches.push({id:'q'+i,empId:e.id,ts:now()-3600e3,kind:'in',method:'pin'}));S.cfg.ci={on:true,roles:[]};save();showPanel('centro');})()");pg.wait_for_timeout(600)
    before=ev(SNAP)
    # ---------- persona
    k=ev("CI.team().find(p=>p.empId).k")
    pg.click('.ci-root .ci-person[data-id="%s"]'%k);pg.wait_for_timeout(300)
    chk(pg.locator('#ci-al').count()==1 and pg.locator('input[name=ci-av]').count()==2 and pg.locator('#ci-col').count()==1 and pg.locator('#ci-ph').count()==1 and pg.locator('#ci-sh').count()==1,'el administrador edita: nombre visible, función, persona/robot, color, foto y mostrar en el local')
    chk(pg.locator('#modal-root a[href="#panel/personal"]').count()==1,'enlace a la ficha completa en Personal y fichaje')
    pg.set_input_files('#ci-ph',TXT);pg.wait_for_timeout(300)
    chk('JPG, PNG o WebP' in pg.inner_text('#modal-root'),'rechaza archivos que no son imagen')
    pg.set_input_files('#ci-ph',FOTO);pg.wait_for_timeout(600)
    chk(pg.locator('#ci-phv img').count()==1,'la foto se ve en la vista previa')
    pg.fill('#ci-al','Lucía Caja');pg.select_option('#ci-fn','cajero');pg.check('input[name=ci-av][value=robot]');ev("document.getElementById('ci-col').value='#ff6600'")
    pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(400)
    c=ev("S.cfg.ci.staff['%s']"%k)
    chk(c and c.get('alias')=='Lucía Caja' and c.get('fn')=='cajero' and c.get('av')=='robot' and c.get('col')=='#ff6600','se guardan nombre visible, función, robot y color')
    chk(c and c.get('ph','').startswith('data:image/jpeg;base64,') and len(c['ph'])<=40000,'la foto se guarda achicada (%d caracteres)'%len((c or {}).get('ph','')))
    chk(ev("S.audit.some(a=>a.action==='CENTRO_INTELIGENTE'&&a.detail.includes('foto nueva')&&a.detail.includes('avatar robot'))"),'el cambio queda auditado')
    chk('Lucía Caja' in pg.inner_text('.ci-root .ci-team') and pg.locator('.ci-root .ci-person[data-id="%s"] .ci-av img'%k).count()==1,'la tarjeta muestra el nombre visible y la foto')
    chk(ev("CI._hits.some(h=>h.it.kind==='person'&&h.it.p.k==='%s'&&h.it.p.av==='robot')"%k),'en el local aparece como robot')
    # ocultar
    pg.click('.ci-root .ci-person[data-id="%s"]'%k);pg.wait_for_timeout(300);pg.uncheck('#ci-sh');pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(300)
    chk(not ev("CI._hits.some(h=>h.it.kind==='person'&&h.it.p.k==='%s')"%k) and 'oculto en el local' in pg.inner_text('.ci-root .ci-team'),'«Mostrar en el local» apagado: no se dibuja, sigue en la lista')
    pg.click('.ci-root .ci-person[data-id="%s"]'%k);pg.wait_for_timeout(300);pg.check('#ci-sh');pg.click('#ci-phx');pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(300)
    chk(not ev("S.cfg.ci.staff['%s'].ph"%k) and ev("CI._hits.some(h=>h.it.kind==='person'&&h.it.p.k==='%s')"%k),'quitar la foto y volver a mostrarla funciona')
    # foto inválida inyectada no se usa
    ev("S.cfg.ci.staff['%s'].ph='data:text/html;base64,PHNjcmlwdD4=';rerender()"%k);pg.wait_for_timeout(300)
    chk(pg.locator('.ci-root .ci-person[data-id="%s"] .ci-av img'%k).count()==0,'una foto con formato inválido se ignora (no se inyecta)');ev("delete S.cfg.ci.staff['%s'].ph"%k)
    # ---------- local
    pg.click('[data-act=ciEdit]');pg.wait_for_timeout(400)
    chk(ev("CI.st.edit") and pg.locator('.ci-root .ci-ed').count()==1,'«Editar local» abre el editor (plano visto desde arriba)')
    n0=ev("CI.st.draft.map.items.length")
    pg.click('[data-act=ciEdAdd][data-t=mostr]');pg.wait_for_timeout(300)
    chk(ev("CI.st.draft.map.items.length")==n0+1 and ev("CI.st.draft.map.items.at(-1).t")=='mostr','agregar un mostrador')
    pg.fill('#ci-e-label','Mostrador fiambres');pg.wait_for_timeout(100)
    pg.fill('#ci-e-x','1');pg.fill('#ci-e-y','1');pg.wait_for_timeout(200)
    e=ev("CI.st.draft.map.items.at(-1)")
    chk(e['label']=='Mostrador fiambres' and e['x']==1 and e['y']==1,'cambiar nombre y posición con los campos')
    pg.click('[data-act=ciEdMove][data-dx="0.5"]');pg.wait_for_timeout(200)
    chk(ev("CI.st.draft.map.items.at(-1).x")==1.5,'mover con las flechas')
    w0,d0=e['w'],e['d'];pg.click('[data-act=ciEdRot]');pg.wait_for_timeout(200)
    chk(ev("CI.st.draft.map.items.at(-1).w")==d0,'girar 90°')
    # arrastrar con el mouse: el centro del mostrador en pantalla
    cxy=ev("(()=>{const v=CI._view,e=CI.st.draft.map.items.at(-1);const cv=document.querySelector('.ci-root canvas.ci-cv').getBoundingClientRect();return[cv.left+v.ox+(e.x+e.w/2-v.cx)*v.sc,cv.top+v.oy+(e.y+e.d/2-v.cy)*v.sc,v.sc]})()")
    pg.mouse.move(cxy[0],cxy[1]);pg.mouse.down();pg.mouse.move(cxy[0]+cxy[2]*2,cxy[1]+cxy[2]*1,steps=6);pg.mouse.up();pg.wait_for_timeout(400)
    x2=ev("CI.st.draft.map.items.find(x=>x.label==='Mostrador fiambres').x")
    chk(abs(x2-3.5)<0.25,'arrastrar con el mouse mueve el elemento (x %.1f)'%x2)
    pg.click('[data-act=ciEdDup]');pg.wait_for_timeout(200)
    chk(ev("CI.st.draft.map.items.filter(x=>x.label==='Mostrador fiambres').length")==2,'duplicar')
    pg.click('[data-act=ciEdDel]');pg.wait_for_timeout(200)
    chk(ev("CI.st.draft.map.items.filter(x=>x.label==='Mostrador fiambres').length")==1,'eliminar')
    # una góndola: cambiar su rubro
    gid=ev("CI.st.draft.map.items.find(x=>x.t==='gond').id");rb=ev("S.rubros.filter(r=>r.kind==='rubro').at(-1).id")
    pg.click('.ci-elist [data-id="%s"]'%gid);pg.wait_for_timeout(250);pg.select_option('#ci-e-rubro',rb);pg.wait_for_timeout(300)
    chk(ev("CI.st.draft.map.items.find(x=>x.id==='%s').rubro"%gid)==rb,'cambiar el rubro de una góndola')
    # eliminar una caja y el depósito
    cid=ev("CI.st.draft.map.items.find(x=>x.t==='caja').id");pg.click('.ci-elist [data-id="%s"]'%cid);pg.wait_for_timeout(200);pg.click('[data-act=ciEdDel]');pg.wait_for_timeout(200)
    chk(not ev("CI.st.draft.map.items.some(x=>x.id==='%s')"%cid),'eliminar una caja')
    # mover una persona
    pk=ev("CI._hits.find(h=>h.it.kind==='person').it.p.k");ev("CI.ed.movePerson('%s',2,2)"%pk);pg.wait_for_timeout(200)
    chk(ev("CI.st.draft.pos['%s']"%pk)==[2,2],'ubicar a una persona a mano')
    # tamaño del local
    pg.fill('#ci-e-W','14');pg.wait_for_timeout(200)
    chk(ev("CI.st.draft.map.W")==14,'cambiar el ancho del local')
    chk(ev("S.cfg.ci.map")==None,'nada se guarda antes de «Guardar cambios»')
    pg.click('[data-act=ciEdSave]');pg.wait_for_timeout(500)
    m=ev("S.cfg.ci.map")
    chk(m and m['W']==14 and any(x['label']=='Mostrador fiambres' for x in m['items']) and not any(x['id']==cid for x in m['items']),'guardar: el local personalizado queda en la configuración')
    chk(ev("S.cfg.ci.staff['%s'].pos"%pk)==[2,2],'guardar: la ubicación de la persona queda fijada')
    chk(ev("S.audit.some(a=>a.action==='CENTRO_INTELIGENTE'&&a.detail.startsWith('local personalizado'))"),'guardar queda auditado')
    chk(not ev("CI.st.edit") and ev("CI._hits.some(h=>h.it.kind==='mostr')"),'el 3D muestra el local guardado')
    # heladera y freezer (pedido del dueño)
    pg.click('[data-act=ciEdit]');pg.wait_for_timeout(300)
    pg.click('[data-act=ciEdAdd][data-t=heladera]');pg.wait_for_timeout(200);pg.click('[data-act=ciEdAdd][data-t=freezer]');pg.wait_for_timeout(200)
    pg.click('[data-act=ciEdSave]');pg.wait_for_timeout(400)
    chk(ev("CI._hits.some(h=>h.it.kind==='heladera')") and ev("CI._hits.some(h=>h.it.kind==='freezer')"),'agregar heladera y freezer: se ven en el local')
    pg.click('[data-act=ciEdit]');pg.wait_for_timeout(300);fz=ev("CI.st.draft.map.items.find(x=>x.t==='freezer').id")
    pg.click('.ci-elist [data-id="%s"]'%fz);pg.wait_for_timeout(200);pg.click('[data-act=ciEdDel]');pg.wait_for_timeout(200);pg.click('[data-act=ciEdSave]');pg.wait_for_timeout(400)
    chk(not any(x['t']=='freezer' for x in ev("S.cfg.ci.map.items")),'borrar el freezer y guardar')
    # descartar no guarda
    pg.click('[data-act=ciEdit]');pg.wait_for_timeout(300);pg.click('[data-act=ciEdAdd][data-t=heladera]');pg.wait_for_timeout(200);pg.click('[data-act=ciEdCancel]');pg.wait_for_timeout(300)
    chk(len([x for x in ev("S.cfg.ci.map.items") if x['t']=='heladera'])==1,'«Descartar» no guarda nada')
    # elementos con datos inválidos se limpian al leerse
    ev("S.cfg.ci.map.items.push({id:'<b>x',t:'cohete',x:-5,y:999,w:9,d:9},{id:'ok1',t:'columna',x:-3,y:999,w:0.4,d:0.4,label:'<img src=x onerror=alert(1)>'});rerender()");pg.wait_for_timeout(300)
    mm=ev("CI.mapOf()");col=[x for x in mm['items'] if x['id']=='ok1'][0]
    chk(not any(x['t']=='cohete' for x in mm['items']) and col['x']>=0 and col['y']<=mm['D'],'tipos desconocidos se descartan y las posiciones se encierran en el local')
    chk(pg.locator('img[src=x]').count()==0,'un nombre con código no se inyecta en la página')
    # volver al automático
    pg.click('[data-act=ciEdit]');pg.wait_for_timeout(300);pg.click('[data-act=ciEdAuto]');pg.wait_for_timeout(200);pg.click('#modal-root .mf [data-m=ok]');pg.wait_for_timeout(200);pg.click('[data-act=ciEdSave]');pg.wait_for_timeout(400)
    chk(ev("S.cfg.ci.map")==None and ev("CI.mapOf().auto")==True,'«Volver al plano automático» y guardar')
    # sólo lectura del negocio
    chk(ev(SNAP)==before,'nada de esto cambió datos del negocio (ventas, caja, inventario, clientes, personal)')
    # permisos
    ev("(()=>{window.__u=user.role;user.role='supervisor';S.cfg.ci.roles=['supervisor'];rerender();})()");pg.wait_for_timeout(300)
    chk(pg.locator('[data-act=ciEdit]').count()==0,'otro rol no ve «Editar local»')
    chk(ev("(()=>{A.ciEdit();return !CI.st.edit})()"),'y no puede abrirlo aunque llame la acción')
    if ev("can('staff')"):
        pg.click('.ci-root .ci-person[data-id="%s"]'%k);pg.wait_for_timeout(300)
        chk(pg.locator('#ci-al').count()==0,'otro rol ve la actividad pero no los controles de edición');pg.keyboard.press('Escape')
    ev("user.role=window.__u;rerender()")
    # pantallas
    pg.click('[data-act=ciEdit]');pg.wait_for_timeout(300)
    for w in (360,768):
        pg.set_viewport_size({'width':w,'height':820});pg.wait_for_timeout(300)
        chk(ev("document.documentElement.scrollWidth<=%d"%(w+2)),'%d px sin desborde con el editor abierto'%w)
    small=ev("[...document.querySelectorAll('.ci-root .ci-ed button')].filter(b=>b.offsetParent).map(b=>b.getBoundingClientRect()).filter(r=>r.height<44).length")
    chk(small==0,'botones del editor de al menos 44 px (%d más chicos)'%small)
    chk(not errs,'sin errores de JavaScript %s'%errs[:2])
    b.close()
print('%d / %d'%(sum(res),len(res)))
