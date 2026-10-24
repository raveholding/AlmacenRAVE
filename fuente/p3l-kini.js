/* ===== Demo «Kini Distribuidora» (compilación `kini`) =====
   Sólo existe en la demo publicada en KiniDistribuidoraDemo. Arranca como MAYORISTA DE UN SOLO DUEÑO, con:
   · Caja 1, Caja 2 y Caja principal ABIERTAS con efectivo de ejemplo (perfil «varias cajas + caja principal»).
   · Proveedores de ejemplo con deuda, una orden de compra pendiente y precios mayoristas por presentación.
   Todo rotulado «ejemplo». «Borrar todo y empezar vacío» deja el sistema sin datos para probarlo desde cero. */
function isKiniBuild(){return!!(typeof window!=='undefined'&&window.RAVE_BUILD&&window.RAVE_BUILD.profile==='kini');}
/* ---- Catálogo de ejemplo de una DISTRIBUIDORA (un solo dueño): categorías, no rubros por persona ----
   [id, nombre, presentación, categoría, precio por unidad ($), stock (unidades), presentaciones [[nivel, unidades, $ por unidad]]] */
function kiniCats(){return[
 {id:'k-beb',name:'Bebidas sin alcohol',color:'#2f6f8f',mNom:'Bebidas',mTitle:'Bebidas sin alcohol',layout:'grid',alcohol:false},
 {id:'k-cer',name:'Cervezas',color:'#c9963e',mNom:'Cervezas',mTitle:'Cervezas',layout:'grid',alcohol:true},
 {id:'k-vin',name:'Vinos y aperitivos',color:'#7b2d3b',mNom:'Vinos',mTitle:'Vinos y aperitivos',layout:'rows',alcohol:true},
 {id:'k-alm',name:'Almacén',color:'#5b7d3a',mNom:'Almacén',mTitle:'Almacén',layout:'rows',alcohol:false},
 {id:'k-gol',name:'Golosinas y snacks',color:'#b4562f',mNom:'Golosinas',mTitle:'Golosinas y snacks',layout:'grid',alcohol:false},
 {id:'k-lim',name:'Limpieza',color:'#5a6e8c',mNom:'Limpieza',mTitle:'Limpieza y perfumería',layout:'rows',alcohol:false},
 {id:'k-pack',name:'Packs y combos',color:'#3fa521',mNom:'Packs',mTitle:'Packs y combos',layout:'grid',alcohol:true}];}
function kiniProds(){return[
 ['k-gas-cola','Gaseosa cola','2,25 lt','k-beb',2900,1100,[['f',6,2650],['p',504,2450]]],
 ['k-gas-lima','Gaseosa lima-limón','2,25 lt','k-beb',2700,640,[['f',6,2450],['p',504,2280]]],
 ['k-agua','Agua mineral sin gas','2 lt','k-beb',1200,720,[['f',6,1080],['p',600,980]]],
 ['k-agua-sab','Agua saborizada','1,5 lt','k-beb',1600,300,[['f',6,1450],['p',540,1320]]],
 ['k-jugo','Jugo en polvo naranja','sobre',  'k-beb',450,1800,[['d',18,400],['f',216,360]]],
 ['k-cer-lata','Cerveza rubia','lata 473 ml','k-cer',1500,2900,[['d',6,1400],['f',24,1300],['p',2400,1180]]],
 ['k-cer-litro','Cerveza rubia retornable','botella 1 lt','k-cer',2600,480,[['f',12,2400],['p',840,2200]]],
 ['k-cer-negra','Cerveza negra','lata 473 ml','k-cer',1700,240,[['d',6,1580],['f',24,1480]]],
 ['k-vin-malbec','Vino tinto Malbec','750 ml','k-vin',4800,360,[['f',6,4400],['p',600,4000]]],
 ['k-vin-torr','Vino blanco Torrontés','750 ml','k-vin',4500,180,[['f',6,4100]]],
 ['k-vin-caja','Vino tinto en caja','1 lt','k-vin',1900,960,[['f',12,1720],['p',960,1560]]],
 ['k-fernet','Fernet','750 ml','k-vin',14500,96,[['f',6,13600]]],
 ['k-aperitivo','Aperitivo amargo','750 ml','k-vin',7900,60,[['f',6,7300]]],
 ['k-yerba','Yerba mate','1 kg','k-alm',4200,900,[['f',10,3900],['p',600,3600]]],
 ['k-azucar','Azúcar','1 kg','k-alm',1300,1500,[['f',10,1180],['p',1000,1050]]],
 ['k-fideos','Fideos secos','500 g','k-alm',1100,1400,[['f',20,980],['p',1200,880]]],
 ['k-arroz','Arroz largo fino','1 kg','k-alm',1700,640,[['f',10,1550],['p',800,1400]]],
 ['k-aceite','Aceite de girasol','1,5 lt','k-alm',3600,288,[['f',12,3300],['p',720,3050]]],
 ['k-harina','Harina 000','1 kg','k-alm',950,1200,[['f',10,860],['p',1000,780]]],
 ['k-alfajor','Alfajor triple','unidad','k-gol',900,1440,[['d',24,800],['f',240,740]]],
 ['k-caramelos','Caramelos surtidos','bolsa 800 g','k-gol',3200,96,[['f',12,2950]]],
 ['k-papas','Papas fritas','150 g','k-gol',1900,240,[['d',12,1750],['f',48,1620]]],
 ['k-galletitas','Galletitas dulces','300 g','k-gol',1300,480,[['f',24,1180]]],
 ['k-lavandina','Lavandina','2 lt','k-lim',1100,320,[['f',8,990]]],
 ['k-detergente','Detergente','750 ml','k-lim',1500,240,[['f',12,1350]]],
 ['k-papel','Papel higiénico','pack x4','k-lim',2100,288,[['f',12,1900]]],
 ['k-jabon','Jabón en polvo','800 g','k-lim',2800,150,[['f',10,2550]]]];}
function kiniEan(i){const b='7799991'+String(10000+i).slice(-5);let s=0;for(let k=0;k<12;k++)s+=(+b[k])*(k%2?3:1);return b+((10-s%10)%10);}
function kiniCatalog(){const r10=x=>Math.round(x/10)*10;
 const L=kiniProds().map(([id,name,sub,cat,price,stock,pres],i)=>{const low=Math.min(price,...pres.map(x=>x[2]));
  return{id,name,sub,grupo:'',rubro:cat,price:price*100,cost:r10(low*0.86)*100,stock,unit:'u',barcode:kiniEan(i),plu:'',menu:true,active:true,desc:'',featured:i%5===0,demo:true,
   pres:pres.map(([lv,qty,u])=>({lv,qty,unit:u*100,barcode:''}))};});
 L.push({id:'k-mani',name:'Maní pelado a granel',sub:'por kilo (para probar la balanza)',grupo:'',rubro:'k-gol',price:850000,cost:610000,stock:25,unit:'kg',barcode:'',plu:'12',menu:false,active:true,desc:'',demo:true});
 L.push({id:'k-combo-fiesta',name:'Pack fiesta',sub:'6 cervezas + 1 fernet + 2 gaseosas',grupo:'',rubro:'k-pack',price:2650000,cost:0,stock:0,unit:'u',barcode:'',plu:'',menu:true,active:true,desc:'Se descuenta cada artículo del stock',demo:true,
  kit:[{pid:'k-cer-lata',qty:6},{pid:'k-fernet',qty:1},{pid:'k-gas-cola',qty:2}]});
 const g=L.find(p=>p.id==='k-gas-cola');if(g)g.wsEx=1;const c=L.find(p=>p.id==='k-cer-lata');if(c)c.floor=110000;
 return L;}
/* clientes de ejemplo: comercios que compran por mayor (con CUIT, plazo y límite) y un consumidor del mostrador */
function kiniCustomers(){const t0=now()-30*86400000;
 const mk=(id,num,name,last,o)=>Object.assign({id,num,name,last,birth:'',wa:'+54938700'+String(10000+num*111).slice(-5),dni:'',cards:[],cardSecrets:{},origin:'ejemplo',
  consent:{club:false,comm:false,analytics:false,version:'v1-2026-demo',ts:t0},ts:t0,status:'activo',limit:0,secret:'kini-ej-'+id+'-0000000000',notes:'',channel:'minorista',taxid:'',term:0,zone:'',seller:'',example:true},o);
 return[mk('kc1',1,'Kiosco El Paso','',{channel:'mayorista',taxid:'20287654325',limit:80000000,term:15,zone:'Zona norte',seller:'Vendedor 1 (ejemplo)',notes:'Compra por fardo dos veces por semana'}),
  mk('kc2',2,'Almacén Doña Rosa','',{channel:'mayorista',taxid:'27345678900',limit:120000000,term:30,zone:'Zona sur',seller:'Vendedor 2 (ejemplo)'}),
  mk('kc3',3,'Supermercado Los Andes S.R.L.','',{channel:'mayorista',taxid:'30711000018',limit:300000000,term:30,zone:'Centro',seller:'Vendedor 1 (ejemplo)',notes:'Precio especial acordado en gaseosa cola'}),
  mk('kc4',4,'Bar La Esquina','',{channel:'mayorista',taxid:'30711000026',limit:50000000,term:7,zone:'Centro',seller:'Vendedor 2 (ejemplo)'}),
  mk('kc5',5,'Laura','Ejemplo',{birth:'1990-05-21',consent:{club:true,comm:false,analytics:false,version:'v1-2026-demo',ts:t0},notes:'Cliente del mostrador (minorista)'})];}
function kiniPeople(d){
 d.employees=[{id:'e1',name:'Empleado de depósito (ejemplo)',puestoId:'pu_dep',rate:250000,pin:'1234',active:true},{id:'e2',name:'Vendedor de mostrador (ejemplo)',puestoId:'pu_most',rate:250000,pin:'4321',active:true}];
 d.puestos=[{id:'pu_soc',name:'Dueño',parent:'',holders:''},{id:'pu_most',name:'Mostrador y ventas',parent:'pu_soc',holders:''},{id:'pu_dep',name:'Depósito y entregas',parent:'pu_soc',holders:''}];
 d.tasks=[{id:'t1',title:'Preparar pedidos mayoristas del día',puestoId:'pu_dep',freq:'daily',active:true},
  {id:'t2',title:'Controlar entregas y remitos firmados',puestoId:'pu_dep',freq:'daily',active:true},
  {id:'t3',title:'Revisar stock mínimo y vencimientos',puestoId:'pu_most',freq:'weekly',dow:1,active:true},
  {id:'t4',title:'Pedido a proveedores',puestoId:'pu_soc',freq:'weekly',dow:5,active:true},
  {id:'t5',title:'Cobranza a clientes con cuenta corriente',puestoId:'pu_most',freq:'weekly',dow:3,active:true}];}
function kiniBase(d){
 d.tenant=Object.assign({},d.tenant,{name:'Kini Distribuidora',legal:'Kini Distribuidora (demo de ejemplo)',slogan:'Distribuidora mayorista · demo',address:'(dirección de ejemplo)',phone:'',wa:'',ig:'',fb:'',caja:1,regId:'r1'});
 d.cfg.biz='owner';d.cfg.bizLocked=1;d.cfg.kiniV=2;d.cfg.cashProfile='main';d.cfg.xfer=Object.assign({},d.cfg.xfer||{},{strict:false,selfAuth:true,ownerV:1});
 d.menu=Object.assign({},d.menu,{title:'KINI DISTRIBUIDORA',sub:{es:'Distribuidora mayorista · demo',en:'Wholesale distributor · demo'},
  pitch:{es:'Hacé tu pedido mayorista desde el celular: elegí los productos y la presentación (**unidad, display, fardo o pallet**) y te **confirmamos stock y entrega por WhatsApp**.',en:'Place your wholesale order from your phone: pick the products and the pack (**unit, display, case or pallet**) and we **confirm stock and delivery by WhatsApp**.'},
  promo:{on:true,es:'Precios **mayoristas por volumen**: cuanto más comprás, mejor precio por unidad (ejemplo).',en:'**Volume wholesale prices**: the more you buy, the better the unit price (example).'},
  footer:{es:'Kini Distribuidora · demo de evaluación',en:'Kini Distribuidora · evaluation demo'},
  mapQuery:'',mapUrl:'',reviewUrl:'',wifi:{on:false,ssid:'',pass:'',example:false},social:[],clubOn:false});
 d.cfg.tax={};d.cfg.ticket=Object.assign({},d.cfg.ticket,{msg:'¡Gracias por su compra!'});
 /* un solo dueño: sólo categorías de productos + los conceptos internos ocultos (no son rubros de personas) */
 const keep=d.rubros.filter(r=>r.kind==='cobr'||r.kind==='shared');
 d.rubros=kiniCats().map(c=>Object.assign({owner:'',reparte:false,kind:'rubro',mHint:''},c)).concat(keep);
 if(!d.rubros.some(r=>r.id==='sys-gen'))d.rubros.push({id:'sys-gen',name:'Caja del negocio',kind:'sysgen',color:'#6b7280',sys:true,reparte:false,owner:'',active:true});
 d.rubros.forEach(r=>{r.owner='';r.reparte=false;});
 d.products=kiniCatalog();
 if(d.cfg.wholesale){d.cfg.wholesale.on=true;d.cfg.wholesale.example=true;d.cfg.wholesale.seeded=1;d.cfg.wholesale.allowClub=false;}
 d.cfg.comboSeeded=1;
 d.customers=kiniCustomers();
 d.agreements=[{id:'ag-kini-ej',cust:'kc3',pid:'k-gas-cola',price:240000,pct:0,from:'',to:'',active:true,by:'ejemplo',ts:now(),example:true}];
 d.loyalty=Object.assign({},d.loyalty,{reward:'Un producto de regalo a elección (hasta $ 5.000) — ejemplo',ledger:[],usedOtp:{}});
 d.coupons=[{id:'cp1',code:'BIENVENIDA10',type:'pct',value:10,min:0,from:'',to:'',maxUses:0,perCust:1,aud:'todos',active:true,note:'10 % en la primera compra del mostrador (ejemplo; no aplica a precios mayoristas)',uses:[]}];
 d.plans=[];d.members=[];
 kiniPeople(d);
 d.registers=[{id:'r1',code:'1',name:'Caja 1',type:'operational',branchId:'',parentId:'rp',active:true},
  {id:'r2',code:'2',name:'Caja 2',type:'operational',branchId:'',parentId:'rp',active:true},
  {id:'rp',code:'P',name:'Caja principal',type:'main',branchId:'',parentId:'',active:true}];
 const t=Math.max(Date.now()-2*3600000,new Date().setHours(0,5,0,0));
 d.sessions=[{id:'k-s1',caja:1,regId:'r1',regName:'Caja 1',branchId:'',openedBy:'ADMIN',openedAt:t,opening:15000000,closedAt:0},
  {id:'k-s2',caja:2,regId:'r2',regName:'Caja 2',branchId:'',openedBy:'Mostrador (ejemplo)',openedAt:t,opening:10000000,closedAt:0},
  {id:'k-sp',caja:3,regId:'rp',regName:'Caja principal',branchId:'',openedBy:'ADMIN',openedAt:t,opening:80000000,closedAt:0}];
 return d;}
/* historial de ejemplo de la distribuidora (reemplaza al del almacén): ventas minoristas y mayoristas por presentación,
   algunas a cuenta corriente de los comercios. Marcadas «demo»: no tocan stock ni caja. */
function kiniExtras(){if(!isKiniBuild())return;
 S.customers=kiniCustomers();S.loyalty.ledger=[];S.members=[];S.plans=[];
 S.coupons.forEach(c=>{c.uses=[];});
 S.sales=S.sales.filter(s=>!(s.demo&&/^hs/.test(s.id)));
 let seed=11;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
 const pool=S.products.filter(p=>p.active&&p.unit==='u'&&!isKit(p));const lvName=id=>((S.cfg.wholesale&&S.cfg.wholesale.levels)||[]).find(l=>l.id===id)||{name:id};
 const hs=S.sessions.find(s=>s.id==='hist-demo');if(!hs)S.sessions.push({id:'hist-demo',caja:S.tenant.caja,openedBy:'ADMIN',openedAt:Date.now()-12*86400000,opening:0,closedAt:Date.now()-86400000,demo:true});
 const mays=S.customers.filter(c=>c.channel==='mayorista');const metM=['transferencia','transferencia','efectivo','fiado'],metm=['efectivo','efectivo','debito','credito','qr','transferencia'];
 const cj=S.tenant.caja;const dbt={};
 for(let d=10;d>=1;d--){const n=4+Math.floor(rnd()*5);for(let k=0;k<n;k++){const ws=rnd()<0.45;const items=[];const nl=1+Math.floor(rnd()*(ws?3:2));
  for(let j=0;j<nl;j++){const p=pool[Math.floor(rnd()*pool.length)];if(items.some(i=>i.pid===p.id))continue;
   if(ws&&p.pres&&p.pres.length){const sm=p.pres.filter(x=>x.qty<=48);const pr=(sm.length?sm:p.pres)[Math.floor(rnd()*(sm.length||1))];const m=1+Math.floor(rnd()*4);
    items.push({pid:p.id,name:p.name+(p.sub?' ('+p.sub+')':''),rubro:p.rubro,qty:pr.qty*m,price:pr.unit,cost:p.cost,list:p.price,disc:0,lr:'P-'+pr.lv,ll:lvName(pr.lv).name,lb:p.price});}
   else items.push({pid:p.id,name:p.name+(p.sub?' ('+p.sub+')':''),rubro:p.rubro,qty:1+Math.floor(rnd()*3),price:p.price,cost:p.cost,list:p.price,disc:0,...(ws?{lr:'L1',ll:'',lb:p.price}:{})});}
  if(!items.length)continue;
  const total=items.reduce((a,i)=>a+Math.round(i.qty*i.price),0);S.seq[cj]=(S.seq[cj]||0)+1;const ts=Date.now()-d*86400000-Math.floor(rnd()*8*3600000)-3*3600000;
  const cu=ws?mays[Math.floor(rnd()*mays.length)]:null;let m=ws?metM[Math.floor(rnd()*metM.length)]:metm[Math.floor(rnd()*metm.length)];
  if(m==='fiado'&&(!cu||d<2||(cu.term>0&&d>=cu.term)||((dbt[cu.id]||0)+total)>cu.limit*0.35))m='transferencia';const fi=m==='fiado'?total:0;if(fi)dbt[cu.id]=(dbt[cu.id]||0)+fi;
  const s={id:'hs'+d+'_'+k,n:cj+'-'+S.seq[cj],ts,user:ws?'ADMIN':'Mostrador',caja:cj,sessId:'hist-demo',items,total,method:m,doc:'ticket_interno',status:'ok',fee:0,channel:'local',
   cust:cu?cu.id:'',custName:cu?custFull(cu):'',coupon:'',benefit:null,recv:0,fiado:fi>0,pays:[{m,a:total,fee:0}],fiadoAmt:fi,paid:total-fi,balance:fi,vuelto:0,pstate:fi?'pendiente':'pagada',demo:true};
  if(ws)s.wch='mayorista';if(fi&&cu&&cu.term>0){s.term=cu.term;s.due=ts+cu.term*86400000;}
  S.sales.push(s);}}}
/* proveedores, deudas y una orden pendiente: se cargan con el mismo motor que usa la pantalla (validaciones reales) */
async function kiniSeedAsync(){if(!isKiniBuild()||!S.cfg||S.cfg.kiniSeeded)return;S.cfg.kiniSeeded=1;
 const prev=user;user=user||{id:'u1',name:'ADMIN',role:'admin'};
 const prods=S.products.filter(p=>p.unit==='u'&&!isKit(p)&&!p.archived&&p.price>0);const pick=(i)=>prods[i%prods.length];
 const cost=p=>Math.max(100,Math.round((p.cost||p.price*0.7)/100));
 try{
  const P=[['Bebidas del Norte S.A. (ejemplo)','30712345671','Responsable Inscripto','ventas@ejemplo.com','(0387) 400-0001','Parque industrial, lote 4 (ejemplo)'],
   ['Vinos Andinos S.R.L. (ejemplo)','30698765433','Responsable Inscripto','pedidos@ejemplo.com','(0261) 400-0002','Mendoza (ejemplo)'],
   ['Aguas del Valle (ejemplo)','20301234563','Monotributista','','(0387) 400-0003','Salta (ejemplo)']];
  const ids=[];
  for(const [rs,cuit,iva,mail,tel,dir] of P){if(!arcaCuitOk(cuit))continue;const r=await LOCAL.supSave({razon_social:rs,cuit,condicion_iva:iva,email:mail||undefined,telefono:tel,direccion:dir});ids.push(r.id);}
  if(ids[0])await LOCAL.recibir({idempotency_key:'kini-ej-rem-1',proveedor_id:ids[0],tipo_comprobante:'Factura',nro_comprobante:'0001-00001234',condicion_pago:'credito',observaciones:'Compra de ejemplo a cuenta corriente',
   items:['k-gas-cola','k-gas-lima','k-agua-sab'].map(id=>prod(id)||pick(0)).map(p=>({producto_id:p.id,cantidad:120,precio_costo:cost(p)}))});
  if(ids[1])await LOCAL.recibir({idempotency_key:'kini-ej-rem-2',proveedor_id:ids[1],tipo_comprobante:'Remito',nro_comprobante:'R-0008821',condicion_pago:'credito',observaciones:'Remito de ejemplo',
   items:['k-vin-malbec','k-vin-torr'].map(id=>prod(id)||pick(1)).map(p=>({producto_id:p.id,cantidad:60,precio_costo:cost(p)}))});
  if(ids[2])await LOCAL.recibir({idempotency_key:'kini-ej-rem-3',proveedor_id:ids[2],tipo_comprobante:'Remito',nro_comprobante:'R-0000150',condicion_pago:'credito',
   items:[{producto_id:(prod('k-agua')||pick(5)).id,cantidad:120,precio_costo:850}]});
  if(ids[0])await LOCAL.ocSave({idempotency_key:'kini-ej-oc-1',proveedor_id:ids[0],estado:'Solicitada',observaciones:'Orden de ejemplo pendiente de recibir',
   items:['k-cer-lata','k-cer-negra'].map(id=>prod(id)||pick(2)).map(p=>({producto_id:p.id,cantidad:240,precio_costo_pactado:cost(p)}))});
 }catch(e){console.warn('kiniSeed',e&&e.message);}
 user=prev;audit('DEMO_EJEMPLOS','Kini: proveedores, deudas y orden de ejemplo');save();}
/* «Borrar todo y empezar vacío»: sin productos, clientes, proveedores, ventas ni cajas abiertas. Quedan los usuarios, las cajas definidas y la configuración */
function emptyState(){const d=DEF();
 d.products=[];d.customers=[];d.sales=[];d.sessions=[];d.movs=[];d.closures=[];d.seq={};d.suppliers=[];d.pOrders=[];d.receipts=[];d.supLedger=[];
 d.transfers=[];d.transferEvents=[];d.payDetails=[];d.coupons=[];d.plans=[];d.agreements=[];d.creditOv=[];d.creditUse=[];d.punches=[];d.tasks=[];
 d.rubros=d.rubros.filter(r=>r.kind!=='rubro'||r.id==='x');
 if(isKiniBuild()||d.cfg.biz==='owner')d.rubros.push({id:uid(),name:'General',owner:'',reparte:false,alcohol:false,kind:'rubro',color:'#2f6f8f',mNom:'General',mTitle:'General',mHint:'',layout:'rows'});
 else d.rubros.unshift({id:uid(),name:'General',owner:'',reparte:false,alcohol:false,kind:'rubro',color:'#2f6f8f',mNom:'General',mTitle:'General',mHint:'',layout:'rows'});
 if(d.cfg.wholesale){d.cfg.wholesale.example=false;}d.cfg.comboSeeded=1;d.cfg.kiniSeeded=1;d.cfg.emptyStart=1;return d;}
A.emptyDemo=()=>confirmBox('Borrar todo y empezar vacío','Se borran productos, clientes, proveedores, ventas, cajas y movimientos de esta demo en este navegador. Quedan los usuarios (ADMIN 1234) y las cajas definidas, cerradas. Para volver a los ejemplos usá «Volver a los datos de ejemplo».',
 ()=>{S=emptyState();audit('DEMO_VACIA','se empezó de cero sin ejemplos');save();pos.lines=[];if(typeof pubReload==='function')pubReload();rerender();toast('Demo vacía: cargá tus productos y abrí una caja');},'Borrar todo');
