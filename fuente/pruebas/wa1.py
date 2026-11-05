# V26.51 · WhatsApp al cliente desde su ficha: saldo (Fiado / Cuenta corriente, detalle y vencimientos) o aviso libre
import sys,urllib.parse
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server']);pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]));ev=pg.evaluate
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    if pg.locator('#ap').count(): pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(300)
    ev("""window.__opened=[];window.open=(u)=>{window.__opened.push(u);return null};
      window.T0=Date.UTC(2026,10,5,15);window.__now=()=>window.T0;
      window.mk=(c)=>{const p=S.products.find(x=>x.unit==='u'&&x.active&&x.price>0);return[{pid:p.id,name:p.name,rubro:p.rubro,qty:1,price:c,cost:0,unit:'u',list:c,man:1}]};
      window.C=S.customers.find(x=>x.status!=='baja'&&x.status!=='suspendido');C.wa='+5493871234567';C.limit=1e9;C.term=30;
      S.sales=S.sales.filter(s=>s.cust!==C.id);S.fiadoPays=S.fiadoPays.filter(p=>p.cust!==C.id);
      window.D=S.customers.find(x=>x!==C&&x.status!=='baja');D.wa='';
      commitSale('fiado',false,'local',mk(200000),{custId:C.id,ck:'fiado'});window.T0+=60000;commitSale('fiado',false,'local',mk(500000),{custId:C.id,ck:'cc'});""")
    first=ev("C.name.trim().split(/\\s+/)[0]")
    ev("A.cuEdit({dataset:{id:C.id}})");pg.wait_for_timeout(400)
    btn=pg.locator('[data-act=cuWa]')
    chk(btn.count()==1 and btn.is_enabled() and 'avisar saldo' in btn.inner_text(),'la ficha tiene «WhatsApp (avisar saldo)»')
    btn.click();pg.wait_for_timeout(400)
    t=ev("document.getElementById('wa-t').value")
    chk(('Hola '+first) in t and 'saldo pendiente es de $ 7.000' in t,'mensaje de saldo con nombre y total $ 7.000')
    chk('Fiado $ 2.000' in t and 'Cuenta corriente $ 5.000' in t,'separa Fiado y Cuenta corriente')
    chk("vence el 12/11/26" in t and 'vence el 5/12/26' in t and t.count('•')==2,'detalle de cada compra con su vencimiento')
    chk(ev("document.activeElement.id")=='wa-t','el cursor queda en el mensaje para editarlo')
    ev("window.T0=Date.UTC(2026,10,20,15)");pg.click('[data-wk=aviso]');pg.click('[data-wk=saldo]');pg.wait_for_timeout(150)
    chk('VENCIDO el 12/11/26' in ev("document.getElementById('wa-t').value"),'si ya venció lo dice: «VENCIDO el 12/11/26»')
    pg.fill('#wa-t',ev("document.getElementById('wa-t').value")+' Saludos.')
    pg.click('#modal-root .ov:last-child [data-m=ok]');pg.wait_for_timeout(300)
    u=ev("window.__opened[window.__opened.length-1]")
    chk(u and u.startswith('https://wa.me/5493871234567?text='),'abre WhatsApp al número del cliente: %s'%(u or '')[:45])
    chk(u and urllib.parse.unquote(u.split('text=')[1]).endswith('Saludos.'),'con el mensaje editado')
    chk(ev("allAudit().some(a=>a.action==='WHATSAPP_CLIENTE'&&/saldo/.test(a.detail))"),'queda en Auditoría')
    # aviso libre
    pg.click('[data-act=cuWa]');pg.wait_for_timeout(400);pg.click('[data-wk=aviso]');pg.wait_for_timeout(150)
    t=ev("document.getElementById('wa-t').value")
    chk(t.startswith('Hola '+first) and 'saldo' not in t,'«Aviso»: saludo para escribir lo que quieras')
    pg.fill('#wa-t','');pg.click('#modal-root .ov:last-child [data-m=ok]');pg.wait_for_timeout(200)
    chk(pg.locator('#modal-root .ov').count()==2,'mensaje vacío: no abre nada')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # sin WhatsApp cargado
    ev("A.cuEdit({dataset:{id:D.id}})");pg.wait_for_timeout(400)
    chk(pg.locator('[data-act=cuWa]').count()==1 and not pg.locator('[data-act=cuWa]').is_enabled(),'cliente sin WhatsApp: el botón aparece deshabilitado')
    ev("document.querySelectorAll('#modal-root .ov').forEach(o=>o.remove())")
    # sin deuda: saldo al día
    ev("S.sales=S.sales.filter(s=>s.cust!==C.id);A.cuWa({dataset:{id:C.id}})");pg.wait_for_timeout(300)
    chk(ev("document.querySelector('[data-wk=aviso]').getAttribute('aria-pressed')")=='true','sin deuda arranca en «Aviso»')
    pg.click('[data-wk=saldo]');pg.wait_for_timeout(150)
    chk('al día' in ev("document.getElementById('wa-t').value"),'y el de saldo dice «tu cuenta está al día»')
    print('errores:',errs[:5]);chk(not errs,'sin errores de consola')
    b.close()
print('%d OK / %d FALLAN de %d'%(sum(res),len(res)-sum(res),len(res)))
