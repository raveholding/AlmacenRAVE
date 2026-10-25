# V26.26 · Inventario: buscar por palabras dentro del nombre (cualquier orden, sin tildes), por precio y por rango; ordenar por precio
from playwright.sync_api import sync_playwright
import sys
errs=[];res=[]
def chk(c,m):
    print(('OK   ' if c else 'FALLA ')+m);res.append(bool(c))
URL=sys.argv[1] if len(sys.argv)>1 else 'file:///tmp/rave/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-proxy-server'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    ev=pg.evaluate
    pg.goto(URL+'#acceso');pg.wait_for_timeout(700)
    pg.select_option('#lu',index=0);pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    ev("""(()=>{const r=S.rubros.find(r=>r.kind==='rubro');
     const mk=(id,name,price)=>({id,name,rubro:r.id,price,cost:0,stock:10,unit:'u',active:true,menu:false,pres:[]});
     S.products.push(mk('i1a','Fernet Branca 750 ml',1250000),mk('i1b','Fernét Branca 1 lt',1690000),mk('i1c','Gaseosa Coca Cola 2,25 lt',350000),mk('i1d','Cerveza Salta Rubia 473',350050));save();})()""")
    ev("location.hash='#panel/inventario'");pg.wait_for_timeout(500)
    MINE={'Fernet Branca 750 ml','Fernét Branca 1 lt','Gaseosa Coca Cola 2,25 lt','Cerveza Salta Rubia 473'}
    vis=lambda:ev("[...document.querySelectorAll('#view table.inv tbody tr:not(.rgroup) td.rb b')].map(b=>b.textContent)")
    def q(t):
        pg.fill('#iq',t);pg.wait_for_timeout(300)
        return [x for x in vis() if x in MINE]
    r=q('branca fernet');chk(set(r)=={'Fernet Branca 750 ml','Fernét Branca 1 lt'},'palabras en cualquier orden y sin tilde: '+str(r))
    r=q('FERNET 750');chk(r==['Fernet Branca 750 ml'],'palabra + número del nombre: '+str(r))
    r=q('3500');chk('Gaseosa Coca Cola 2,25 lt' in r and 'Cerveza Salta Rubia 473' not in r,'número suelto = precio exacto $ 3.500: '+str(r))
    r=q('$3.500,50');chk(r==['Cerveza Salta Rubia 473'],'precio con formato argentino: '+str(r))
    r=q('10000-17000');chk(set(r)=={'Fernet Branca 750 ml','Fernét Branca 1 lt'},'rango de precio 10000-17000: '+str(r))
    r=q('>15000');chk('Fernét Branca 1 lt' in r and 'Fernet Branca 750 ml' not in r,'mayor a 15000: '+str(r))
    r=q('<4000 coca');chk(r==['Gaseosa Coca Cola 2,25 lt'],'menor a 4000 + palabra: '+str(r))
    pg.fill('#iq','');pg.wait_for_timeout(200)
    pg.fill('#ipmin','3000');pg.wait_for_timeout(200);pg.fill('#ipmax','13000');pg.wait_for_timeout(300)
    r=[x for x in vis() if x in MINE]
    chk(set(r)=={'Fernet Branca 750 ml','Gaseosa Coca Cola 2,25 lt','Cerveza Salta Rubia 473'},'precio desde/hasta: '+str(r))
    pg.select_option('#isort','pasc');pg.wait_for_timeout(300)
    pr=ev("[...document.querySelectorAll('#view table.inv tbody tr:not(.rgroup)')].map(t=>S.products.find(p=>p.name===t.querySelector('td.rb b').textContent)).filter(Boolean).map(p=>p.price)")
    chk(len(pr)>=3 and pr==sorted(pr),'orden de menor a mayor precio: '+str(pr[:6]))
    pg.select_option('#isort','pdesc');pg.wait_for_timeout(300)
    pr=ev("[...document.querySelectorAll('#view table.inv tbody tr:not(.rgroup)')].map(t=>S.products.find(p=>p.name===t.querySelector('td.rb b').textContent)).filter(Boolean).map(p=>p.price)")
    chk(pr==sorted(pr,reverse=True),'orden de mayor a menor precio: '+str(pr[:6]))
    chk('resultado' in ev("document.querySelector('#view').innerText"),'muestra cuántos resultados hay')
    pg.fill('#ipmin','');pg.fill('#ipmax','');pg.fill('#iq','zzzz-no-existe');pg.wait_for_timeout(300)
    chk('No hay productos' in ev("document.querySelector('#view').innerText"),'sin resultados: mensaje claro')
    pg.set_viewport_size({'width':360,'height':800});pg.wait_for_timeout(300)
    chk(ev("document.documentElement.scrollWidth<=362"),'360 px sin desborde')
    chk(not errs,'sin errores '+str(errs[:2]))
    b.close()
print(f"\n{sum(res)}/{len(res)}")
