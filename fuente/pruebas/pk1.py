# V26.78 · Paquetes por tipo de comercio en Almacén RAVE (perfil cliente): al elegir el canal de venta se encienden solas
# las funciones recomendadas (nunca se apaga nada), y desde «Módulos» se aplican de un toque.
from playwright.sync_api import sync_playwright
import os
D=os.environ.get('LB_DIR','/tmp/rave')
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
def ok_modal(pg):
    pg.locator('#modal-root .ov >> nth=-1').locator('.mf [data-m=ok]').click();pg.wait_for_timeout(400)
ON="['pos_hold','price_hist','price_bulk','kiosk','hr_vales','labels'].filter(k=>giOn(k))"
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900});ev=pg.evaluate
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    pg.goto('file://%s/out_cliente.html'%D);pg.wait_for_timeout(1300)
    ev("S.users.push({id:'ua',name:'ADMIN',role:'admin',pin:'1234'},{id:'um',name:'Mostrador',role:'mostrador',pin:'0000'});user=S.users[0];save();go('config')");pg.wait_for_timeout(500)
    chk(ev(ON)==[] and ev("chanCur()")=='min','Almacén RAVE arranca minorista y con todo apagado')
    pg.check('#biz-card input[name=chan][value=may]');pg.click('[data-act=chanSave]');pg.wait_for_timeout(300)
    txt=pg.inner_text('#modal-root .ov >> nth=-1')
    chk('También se activan solas' in txt and 'Vales y adelantos' in txt and 'Reparto' in txt,'al pasar a «Sólo mayorista» el aviso lista lo que se activa y lo recomendado')
    ok_modal(pg)
    on=ev(ON)
    chk(ev("chanCur()")=='may' and ev("S.cfg.wholesale.on&&S.cfg.wholesale.only"),'el canal queda «Sólo mayorista» (presentaciones, acuerdos y crédito)')
    chk(sorted(on)==sorted(['pos_hold','price_hist','price_bulk','labels','hr_vales']),'se encienden solas las 5 funciones del paquete mayorista: %s'%on)
    chk(ev("S.audit.some(a=>a.action==='MODULOS_PAQUETE')") and ev("S.audit.filter(a=>a.action==='MODULO_ACTIVADO').length")==ev("GI_PACKS.may.k.filter(k=>giMod(k)).length"),'queda en Auditoría (paquete y cada módulo)')
    # volver a minorista no apaga nada
    pg.check('#biz-card input[name=chan][value=min]');pg.click('[data-act=chanSave]');pg.wait_for_timeout(300);ok_modal(pg)
    on2=ev(ON)
    chk(ev("chanCur()")=='min' and set(on)<=set(on2) and 'kiosk' in on2,'volver a minorista no apaga nada y suma el verificador del paquete minorista: %s'%on2)
    # desde Módulos
    ev("go('modulos')");pg.wait_for_timeout(400)
    chk(pg.locator('[data-act=giPack]').count()==4 and 'En desarrollo' not in pg.inner_text('#view'),'«Módulos» ofrece los 3 tipos de comercio más «Todo el sistema», y ya no hay nada «En desarrollo»')
    pg.click('[data-act=giPack][data-ch=both]');pg.wait_for_timeout(300)
    chk(ev("$('#modal-root .ov')")==None,'si ya está todo activo, no pide confirmar (avisa)')
    ev("['hr_vales','kiosk'].forEach(k=>giSetMod(k,false))")
    pg.click('[data-act=giPack][data-ch=both]');pg.wait_for_timeout(300);ok_modal(pg)
    chk('hr_vales' in ev(ON) and 'kiosk' in ev(ON),'el botón «Minorista y mayorista» vuelve a encender lo que faltaba')
    # plan: lo que no entra en el plan no se enciende
    ev("S.cfg.plan='esencial';giSetMod('hr_vales',false);save()")
    chk('hr_vales' not in ev("giPackApply('may')"),'con plan Esencial, el paquete no enciende funciones de otro plan')
    ev("S.cfg.plan='total';save()")
    # mostrador no puede
    ev("user=S.users[1];giSetMod('hr_vales',false)")
    chk(ev("giPackApply('may')")==[] ,'el rol Mostrador no puede aplicar paquetes')
    b.close()
chk(not errs,'sin errores de página %s'%errs[:3])
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
