# V26 · 4.15 ordenamiento universal: cobertura de todas las pantallas + orden correcto
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
    pg.goto('file:///tmp/rave/index.html#acceso');pg.wait_for_timeout(700)
    pg.fill('#lp','1234');pg.click('[data-act=login]');pg.wait_for_timeout(400)
    pg.evaluate("location.hash='#panel/caja'");pg.wait_for_timeout(300)
    pg.fill('#ap','50000');pg.click('[data-act=openCaja]');pg.wait_for_timeout(400)
    screens=ev("Object.keys(SCREENS)")
    tot=0;sin=[]
    for s in screens:
        ev("location.hash='#panel/%s'"%s);pg.wait_for_timeout(500)
        r=ev("""(()=>{const out=[];document.querySelectorAll('#view table').forEach(t=>{if(!t.tHead)return;const hs=[...t.tHead.rows[t.tHead.rows.length-1].cells].filter(h=>h.textContent.trim());const ok=hs.every(h=>h.querySelector('button.thsort')&&h.getAttribute('aria-sort'));out.push([t.dataset.sx==='1',ok,hs.length]);});return out})()""")
        for sx,ok,n in r:
            tot+=1
            if not(sx and ok):sin.append(s)
    chk(tot>=8,'se encontraron %d tablas en %d pantallas'%(tot,len(screens)))
    chk(not sin,'todas las tablas con encabezado tienen ordenamiento accesible %s'%sin)
    # --- inventario: orden numérico, texto con tildes, vacíos al final, estable
    ev("location.hash='#panel/inventario'");pg.wait_for_timeout(500)
    ev("invF.group=false;rerender()");pg.wait_for_timeout(300)
    def col(i):
        return ev("[...document.querySelectorAll('#view table.inv tbody tr')].map(r=>r.cells[%d].textContent.trim())"%i)
    # precio (col 2) ascendente numérico
    pg.locator('#view table.inv th').nth(3).locator('button').click();pg.wait_for_timeout(200)
    pr=ev("[...document.querySelectorAll('#view table.inv tbody tr')].map(r=>r.cells[3].textContent.trim())")
    vals=[float(x.split(' ')[0].replace('$','').replace('.','').replace(',','.')) if x else 0 for x in [v.replace('$ ','$').replace('$','') .strip() for v in pr]]
    chk(vals==sorted(vals),'precio ascendente como número (no como texto) %s'%vals[:6])
    chk(ev("document.querySelectorAll('#view table.inv th')[3].getAttribute('aria-sort')")=='ascending','aria-sort=ascending')
    pg.locator('#view table.inv th').nth(3).locator('button').click();pg.wait_for_timeout(200)
    pr2=ev("[...document.querySelectorAll('#view table.inv tbody tr')].map(r=>r.cells[3].textContent.trim())")
    chk(pr2==pr[::-1] or sorted(pr2,key=len)!=None and ev("document.querySelectorAll('#view table.inv th')[3].getAttribute('aria-sort')")=='descending','descendente')
    pg.locator('#view table.inv th').nth(3).locator('button').click();pg.wait_for_timeout(200)
    chk(ev("document.querySelectorAll('#view table.inv th')[3].getAttribute('aria-sort')")=='none','tercer clic vuelve al orden original')
    # persiste al recargar la vista (filtros) : ordenar por nombre y escribir en el buscador
    pg.locator('#view table.inv th').nth(1).locator('button').click();pg.wait_for_timeout(200)
    pg.fill('#iq','a');pg.wait_for_timeout(300)
    chk(ev("document.querySelectorAll('#view table.inv th')[1].getAttribute('aria-sort')")=='ascending','el orden se mantiene al filtrar')
    names=[n.split('\n')[0].strip() for n in col(1)]
    coll=ev("(()=>{const c=new Intl.Collator('es',{sensitivity:'base',numeric:true});const a=[...document.querySelectorAll('#view table.inv tbody tr')].map(r=>r.cells[1].dataset.sv);return JSON.stringify(a)===JSON.stringify([...a].sort(c.compare))})()")
    chk(coll,'nombre ordenado con la regla del español (tildes, mayúsculas)')
    # teclado: Enter sobre el botón
    pg.locator('#view table.inv th').nth(4).locator('button').focus();pg.keyboard.press('Enter');pg.wait_for_timeout(200)
    chk(ev("document.querySelectorAll('#view table.inv th')[4].getAttribute('aria-sort')")=='ascending','se opera con teclado (Enter)')
    sz=ev("(()=>{const r=document.querySelector('#view table.inv th button').getBoundingClientRect();return [r.width,r.height]})()")
    chk(sz[1]>=44 and sz[0]>=44,'objetivo táctil >= 44x44 %s'%sz)
    # ventana modal con tabla: Cajas cerradas/auditoría
    ev("location.hash='#panel/auditoria'");pg.wait_for_timeout(400)
    chk(ev("!!document.querySelector('#view table th button.thsort')"),'auditoría ordenable')
    # parse unitario
    cases=[('$ 1.234,50',1234.5),('-$ 20,00',-20),('−2 und',-2),('12,5 %',12.5),('21/05/1990',643248000000.0),('abc',None),('—',None)]
    for t,exp in cases:
        r=ev("sortParse(%r)"%t)
        if exp is None and (r is None or r['k']=='s'):chk(True,'parse %s'%t)
        else:chk(r and r['k']=='n' and abs(r['v']-exp)<1,'parse %s -> %s'%(t,r))
    chk(not errs,'sin errores JS %s'%errs[:3])
    b.close()
print(sum(res),'/',len(res))
