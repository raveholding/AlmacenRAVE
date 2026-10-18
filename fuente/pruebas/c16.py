# V26.1 nube: venta mixta (efectivo + cuenta corriente) viaja al servidor, el servidor deriva y protege los importes
from cl_lib import *
res=[]
def chk(c,m):res.append(bool(ok(c,m)))
def sy(pg,ms=3500):pg.evaluate("cloudSync(true)");pg.wait_for_timeout(ms)
with sync_playwright() as p:
    b=launch(p);ctxA,A=newpage(b,'A');create_commerce(A)
    rub=ev(A,"S.rubros.find(r=>r.kind==='rubro').id")
    ev(A,"""(()=>{S.products.push({id:'q1',name:'Art 60k',rubro:'%s',price:6000000,cost:3000000,stock:10,unit:'u',active:true,barcode:'',menu:false});
      S.customers.push({id:'cq1',num:1,name:'Ana',last:'Prueba',wa:'3875550001',limit:9000000,consent:{club:true}});
      S.sessions.push({id:uid(),caja:S.tenant.caja,openedBy:user.name,openedAt:now(),opening:0,closedAt:0});save();rerender();})()"""%rub)
    sy(A)
    r=ev(A,"""(()=>{pos.lines=[{pid:'q1',name:'Art 60k',rubro:'%s',qty:1,price:6000000,cost:3000000,unit:'u',list:6000000}];
      const r=commitSale('mixto',false,'local',pos.lines,{custId:'cq1',recv:5000000,pays:[{m:'efectivo',a:4000000},{m:'fiado',a:2000000}]});return r.err||r.sale.id;})()"""%rub)
    chk(len(str(r))>5 and 'no coincide' not in str(r),'venta mixta 40k + 20k registrada en el equipo')
    sy(A,4500)
    chk(sql("select datos->>'pstate' from registros where coleccion='ventas' and id='%s'"%r)=='parcial','servidor: estado Pago parcial')
    chk(sql("select (datos->>'fiadoAmt')::numeric from registros where coleccion='ventas' and id='%s'"%r)=='2000000','servidor: saldo a cuenta corriente 20.000')
    chk(sql("select jsonb_array_length(datos->'pays') from registros where coleccion='ventas' and id='%s'"%r)=='2','servidor: 2 renglones de pago')
    # adulterar en el equipo y reenviar: el servidor conserva
    ev(A,"(()=>{const s=S.sales.find(x=>x.id==='%s');s.total=100;s.pays=[{m:'efectivo',a:100}];s.fiadoAmt=0;s.pstate='pagada';s.status='ok';save();})()"%r)
    sy(A,4000)
    chk(sql("select (datos->>'total')::numeric from registros where coleccion='ventas' and id='%s'"%r)=='6000000','servidor: total no se pisa desde el equipo')
    chk(sql("select datos->>'pstate' from registros where coleccion='ventas' and id='%s'"%r)=='parcial','servidor: estado y deuda no se falsean')
    b.close()
print(sum(res),'OK /',len(res)-sum(res),'FALLAN de',len(res))
