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
  mk('kc5',5,'Laura','Ejemplo',{channel:'mayorista',birth:'1990-05-21',consent:{club:true,comm:false,analytics:false,version:'v1-2026-demo',ts:t0},notes:'Compra en el mostrador (sin CUIT)'})];}
/* V27.6 · Demo «Mostrador» (DEMO_CATALOGO=almacen): almacén, kiosco y autoservicio de barrio, sin venta mayorista.
   Precios de ejemplo por unidad (en pesos), costo ~70 %, algunos artículos por kilo con PLU para probar la balanza
   y algunos con poco stock para que aparezcan las alertas. Todo rotulado «ejemplo». */
function almCats(){return[
 {id:'a-alm',name:'Almacén',color:'#5b7d3a',mNom:'Almacén',mTitle:'Almacén',layout:'rows',alcohol:false},
 {id:'k-beb',name:'Bebidas',color:'#2f6f8f',mNom:'Bebidas',mTitle:'Bebidas',layout:'grid',alcohol:false},
 {id:'a-lac',name:'Lácteos y fiambrería',color:'#c9963e',mNom:'Lácteos',mTitle:'Lácteos, fiambres y panadería',layout:'rows',alcohol:false},
 {id:'a-kio',name:'Kiosco y golosinas',color:'#b4562f',mNom:'Kiosco',mTitle:'Kiosco y golosinas',layout:'grid',alcohol:false},
 {id:'a-lim',name:'Limpieza',color:'#5a6e8c',mNom:'Limpieza',mTitle:'Limpieza',layout:'rows',alcohol:false},
 {id:'a-per',name:'Perfumería',color:'#8a5aa8',mNom:'Perfumería',mTitle:'Perfumería e higiene',layout:'rows',alcohol:false},
 {id:'a-alc',name:'Cervezas y vinos',color:'#7b2d3b',mNom:'Cervezas y vinos',mTitle:'Cervezas y vinos (+18)',layout:'grid',alcohol:true}];}
/* [id, nombre, presentación, categoría, precio $, stock, unidad (u|kg), PLU] */
function almProds(){return[
 ['a-yerba','Yerba mate con palo','1 kg','a-alm',5200,48,'u'],['a-azucar','Azúcar común','1 kg','a-alm',1500,60,'u'],['a-fideos','Fideos tirabuzón','500 g','a-alm',1300,72,'u'],
 ['a-arroz','Arroz largo fino','1 kg','a-alm',1900,40,'u'],['a-aceite','Aceite de girasol','1,5 lt','a-alm',4300,24,'u'],['a-harina','Harina 0000','1 kg','a-alm',1100,36,'u'],
 ['a-pure','Puré de tomate','520 g','a-alm',1200,30,'u'],['a-cafe','Café molido','250 g','a-alm',6500,4,'u'],['a-mate','Mate cocido','caja x25','a-alm',1800,20,'u'],
 ['a-galle-agua','Galletitas de agua','pack x3','a-alm',1700,26,'u'],['a-mayo','Mayonesa','doypack 250 g','a-alm',1900,18,'u'],['a-sal','Sal fina','500 g','a-alm',900,22,'u'],
 ['k-gas-cola','Gaseosa cola','2,25 lt','k-beb',3600,36,'u'],['k-gas-lima','Gaseosa lima-limón','2,25 lt','k-beb',3300,24,'u'],['k-agua','Agua mineral sin gas','2 lt','k-beb',1400,30,'u'],
 ['k-agua-sab','Agua saborizada','1,5 lt','k-beb',1900,24,'u'],['a-jugo','Jugo en polvo naranja','sobre','k-beb',500,60,'u'],['a-soda','Soda en botella','2 lt','k-beb',1300,3,'u'],
 ['a-leche','Leche entera','sachet 1 lt','a-lac',1600,40,'u'],['a-yogur','Yogur bebible frutilla','1 lt','a-lac',2600,12,'u'],['a-manteca','Manteca','200 g','a-lac',3200,10,'u'],
 ['a-huevos','Huevos blancos','docena','a-lac',3900,15,'u'],['a-queso','Queso cremoso','por kilo','a-lac',12500,6,'kg','21'],['a-jamon','Jamón cocido','por kilo','a-lac',18000,4,'kg','22'],
 ['a-salame','Salame milán','por kilo','a-lac',22000,2,'kg','23'],['a-pan','Pan francés','por kilo','a-lac',3500,12,'kg','24'],
 ['a-alfajor','Alfajor triple de chocolate','unidad','a-kio',1100,96,'u'],['a-choco','Chocolate con leche','100 g','a-kio',3200,24,'u'],['a-chicle','Chicles de menta','paquete','a-kio',700,60,'u'],
 ['a-papas','Papas fritas clásicas','150 g','a-kio',2300,20,'u'],['a-turron','Turrón de maní','unidad','a-kio',600,80,'u'],['a-barrita','Barrita de cereal','unidad','a-kio',800,40,'u'],
 ['a-lavandina','Lavandina','2 lt','a-lim',1300,18,'u'],['a-deter','Detergente','750 ml','a-lim',1800,16,'u'],['a-papel','Papel higiénico','pack x4','a-lim',2600,20,'u'],
 ['a-jabonpol','Jabón en polvo','800 g','a-lim',3400,10,'u'],['a-esponja','Esponja de cocina','unidad','a-lim',700,25,'u'],['a-bolsas','Bolsas de residuo','rollo x10','a-lim',1200,14,'u'],
 ['a-shampoo','Shampoo','400 ml','a-per',4500,8,'u'],['a-jabon','Jabón de tocador','90 g','a-per',1200,24,'u'],['a-pasta','Pasta dental','90 g','a-per',2200,12,'u'],['a-desodo','Desodorante en aerosol','150 ml','a-per',2900,10,'u'],
 ['k-cer-lata','Cerveza rubia','lata 473 ml','a-alc',1800,48,'u'],['a-cer-litro','Cerveza rubia retornable','1 lt','a-alc',3000,12,'u'],['a-vino','Vino tinto Malbec','750 ml','a-alc',5600,9,'u'],['a-vino-caja','Vino tinto en caja','1 lt','a-alc',2300,18,'u']];}
function almCatalog(){
 const L=almProds().map(([id,name,sub,cat,price,stock,unit,plu],i)=>({id,name,sub,grupo:'',rubro:cat,price:price*100,cost:Math.round(price*0.7/10)*10*100,stock,unit:unit||'u',
  barcode:unit==='kg'?'':kiniEan(200+i),plu:plu||'',menu:true,active:true,desc:'',featured:['a-yerba','k-gas-cola','a-alfajor','a-leche','a-queso','k-cer-lata'].includes(id),demo:true,pres:[]}));
 L.push({id:'a-combo-mate',name:'Combo mate',sub:'yerba + azúcar + galletitas de agua',grupo:'',rubro:'a-alm',price:780000,cost:0,stock:0,unit:'u',barcode:'',plu:'',menu:true,active:true,desc:'Se descuenta cada artículo del stock',demo:true,
  kit:[{pid:'a-yerba',qty:1},{pid:'a-azucar',qty:1},{pid:'a-galle-agua',qty:1}]});
 return L;}
function almCustomers(){const t0=now()-40*86400000;
 const mk=(id,num,name,last,o)=>Object.assign({id,num,name,last,birth:'',wa:'+54938700'+String(20000+num*137).slice(-5),dni:'',cards:[],cardSecrets:{},origin:'ejemplo',
  consent:{club:true,comm:true,analytics:false,version:'v1-2026-demo',ts:t0},ts:t0,status:'activo',limit:0,secret:'alm-ej-'+id+'-0000000000',notes:'',channel:'minorista',taxid:'',term:0,zone:'',seller:'',example:true},o);
 return[mk('ac1',1,'María','Gómez',{birth:'1984-03-12',limit:5000000,term:30,notes:'Libreta: paga a fin de mes'}),
  mk('ac2',2,'Carlos','Ruiz',{birth:'1979-11-02',limit:3000000,term:15,notes:'Libreta: paga cada quincena'}),
  mk('ac3',3,'Ana','López',{birth:'1996-07-25',notes:'Del Club: junta puntos'}),
  mk('ac4',4,'Jorge','Fernández',{birth:'1968-01-30',notes:'Compra el pan todos los días'}),
  mk('ac5',5,'Lucía','Martínez',{birth:'2000-09-14',consent:{club:false,comm:false,analytics:false,version:'v1-2026-demo',ts:t0}})];}
function almBase(d){
 const keep=d.rubros.filter(r=>r.kind!=='rubro');
 d.rubros=almCats().map(c=>Object.assign({owner:'',reparte:false,kind:'rubro',mHint:''},c)).concat(keep);
 d.products=almCatalog();d.customers=almCustomers();d.agreements=[];
 if(d.cfg.wholesale){d.cfg.wholesale.on=false;d.cfg.wholesale.only=false;d.cfg.wholesale.example=false;}
 d.tenant=Object.assign({},d.tenant,{address:'Av. San Martín 1250, Salta (ejemplo)',phone:'(0387) 400-1250',wa:'5493874484132'});
 d.menu=Object.assign({},d.menu,{pitch:{es:'Hacé tu pedido por WhatsApp y **retiralo en el local** o **te lo llevamos** (ejemplo).',en:'Order by WhatsApp and **pick it up** or **get it delivered** (example).'},
  promo:{on:true,es:'**Jueves de lácteos**: 10 % en lácteos y fiambres (ejemplo).',en:'**Dairy Thursday**: 10 % off (example).'},clubOn:true});
 d.coupons=[{id:'cp1',code:'BIENVENIDA10',type:'pct',value:10,min:0,from:'',to:'',maxUses:0,perCust:1,aud:'todos',active:true,note:'10 % en la primera compra (ejemplo)',uses:[]}];
 d.loyalty=Object.assign({},d.loyalty,{reward:'Un alfajor de regalo cada 10 compras (ejemplo)',ledger:[],usedOtp:{}});
 d.employees=[{id:'e1',name:'Sofía (cajera, ejemplo)',puestoId:'pu_caj',rate:250000,pin:'1234',active:true},{id:'e2',name:'Tomás (repositor, ejemplo)',puestoId:'pu_rep',rate:230000,pin:'4321',active:true}];
 d.puestos=[{id:'pu_soc',name:'Dueño',parent:'',holders:''},{id:'pu_caj',name:'Caja y atención',parent:'pu_soc',holders:''},{id:'pu_rep',name:'Reposición',parent:'pu_soc',holders:''}];
 d.tasks=[{id:'t1',title:'Abrir la caja con el cambio del día',puestoId:'pu_caj',freq:'daily',active:true},
  {id:'t2',title:'Reponer góndolas y heladera',puestoId:'pu_rep',freq:'daily',active:true},
  {id:'t3',title:'Controlar vencimientos de lácteos y fiambres',puestoId:'pu_rep',freq:'weekly',dow:1,active:true},
  {id:'t4',title:'Hacer el pedido a proveedores',puestoId:'pu_soc',freq:'weekly',dow:4,active:true},
  {id:'t5',title:'Cobrar las libretas (cuenta corriente)',puestoId:'pu_caj',freq:'weekly',dow:6,active:true}];}
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
 if(d.cfg.wholesale){d.cfg.wholesale.on=true;d.cfg.wholesale.example=true;d.cfg.wholesale.seeded=1;d.cfg.wholesale.allowClub=false;d.cfg.wholesale.only=true;}d.cfg.kiniOnlyV=1;
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
 /* V27 · demos nuevas de Vincular Business (VB-Demo-*): mismo perfil con otra marca, otro canal y módulos prendidos.
    window.RAVE_DEMO lo inyecta build.py sólo en esas compilaciones; sin él, la demo Kini queda igual. */
 const D=(typeof window!=='undefined'&&window.RAVE_DEMO)||null;
 if(D){d.tenant=Object.assign({},d.tenant,{name:D.nombre,legal:D.nombre,slogan:D.slogan,cuit:D.canal==='min'?'27-31245678-3':'30-71654321-4',iva:D.canal==='min'?'Responsable Monotributo (ejemplo)':'IVA Responsable Inscripto (ejemplo)',address:'Av. San Martín 1250, Salta (ejemplo)',phone:'(0387) 400-1250'});
  d.menu=Object.assign({},d.menu,{title:D.nombre.toUpperCase(),sub:{es:D.slogan,en:D.slogan},footer:{es:D.nombre+' · demo de Vincular Business',en:D.nombre+' · Vincular Business demo'}});
  if(d.cfg.wholesale&&D.canal==='both')d.cfg.wholesale.only=false;
  if(d.cfg.wholesale&&D.canal==='may'&&D.cli)d.cfg.wholesale.cli=true; /* V27.9 · demo Mayorista: sólo comercios con CUIT */
  d.cfg.plan=D.plan||'total';d.cfg.mods=Object.assign({},d.cfg.mods||{});(D.mods||[]).forEach(k=>{d.cfg.mods[k]=true;});if(D.catalogo==='almacen')almBase(d);}
 const t=Math.max(Date.now()-2*3600000,new Date().setHours(0,5,0,0));
 d.sessions=[{id:'k-s1',caja:1,regId:'r1',regName:'Caja 1',branchId:'',openedBy:'ADMIN',openedAt:t,opening:15000000,closedAt:0},
  {id:'k-s2',caja:2,regId:'r2',regName:'Caja 2',branchId:'',openedBy:'Mostrador (ejemplo)',openedAt:t,opening:10000000,closedAt:0},
  {id:'k-sp',caja:3,regId:'rp',regName:'Caja principal',branchId:'',openedBy:'ADMIN',openedAt:t,opening:80000000,closedAt:0}];
 return d;}
/* historial de ejemplo de la distribuidora (reemplaza al del almacén): ventas minoristas y mayoristas por presentación,
   algunas a cuenta corriente de los comercios. Marcadas «demo»: no tocan stock ni caja. */
function kiniExtras(){if(!isKiniBuild())return;
 S.customers=(window.RAVE_DEMO&&window.RAVE_DEMO.catalogo==='almacen')?almCustomers():kiniCustomers();if(S.cfg.wholesale&&S.cfg.wholesale.cli)S.customers=S.customers.filter(c=>c.taxid);S.loyalty.ledger=[];S.members=[];S.plans=[];
 S.coupons.forEach(c=>{c.uses=[];});
 S.sales=S.sales.filter(s=>!(s.demo&&/^hs/.test(s.id)));
 let seed=11;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
 const pool=S.products.filter(p=>p.active&&p.unit==='u'&&!isKit(p));const lvName=id=>((S.cfg.wholesale&&S.cfg.wholesale.levels)||[]).find(l=>l.id===id)||{name:id};
 const hs=S.sessions.find(s=>s.id==='hist-demo');if(!hs)S.sessions.push({id:'hist-demo',caja:S.tenant.caja,openedBy:'ADMIN',openedAt:Date.now()-12*86400000,opening:0,closedAt:Date.now()-86400000,demo:true});
 const mays=S.customers.filter(c=>c.channel==='mayorista');const metM=['transferencia','transferencia','efectivo','fiado'],metm=['efectivo','efectivo','debito','credito','qr','transferencia'];
 const cj=S.tenant.caja;const dbt={};
 for(let d=10;d>=0;d--){const n=d?4+Math.floor(rnd()*5):3;for(let k=0;k<n;k++){const wOn=!!(S.cfg.wholesale&&S.cfg.wholesale.on);const ws=wOn&&S.cfg.wholesale.only?true:wOn&&rnd()<0.45;const items=[];const nl=1+Math.floor(rnd()*(ws?3:2));
  for(let j=0;j<nl;j++){const p=pool[Math.floor(rnd()*pool.length)];if(items.some(i=>i.pid===p.id))continue;
   if(ws&&p.pres&&p.pres.length){const sm=p.pres.filter(x=>x.qty<=48);const pr=(sm.length?sm:p.pres)[Math.floor(rnd()*(sm.length||1))];const m=1+Math.floor(rnd()*4);
    items.push({pid:p.id,name:p.name+(p.sub?' ('+p.sub+')':''),rubro:p.rubro,qty:pr.qty*m,price:pr.unit,cost:p.cost,list:p.price,disc:0,lr:'P-'+pr.lv,ll:lvName(pr.lv).name,lb:p.price});}
   else items.push({pid:p.id,name:p.name+(p.sub?' ('+p.sub+')':''),rubro:p.rubro,qty:1+Math.floor(rnd()*3),price:p.price,cost:p.cost,list:p.price,disc:0,...(ws?{lr:'L1',ll:'',lb:p.price}:{})});}
  if(!items.length)continue;
  const total=items.reduce((a,i)=>a+Math.round(i.qty*i.price),0);S.seq[cj]=(S.seq[cj]||0)+1;const ts=Date.now()-d*86400000-Math.floor(rnd()*8*3600000)-3*3600000;
  const lib=S.customers.filter(c=>c.limit>0&&c.channel!=='mayorista');const cu=ws&&(S.cfg.wholesale&&S.cfg.wholesale.cli||!(S.cfg.wholesale&&S.cfg.wholesale.only&&rnd()<0.3))?mays[Math.floor(rnd()*mays.length)]:(!ws&&lib.length&&rnd()<0.18?lib[Math.floor(rnd()*lib.length)]:null);let m=cu?metM[Math.floor(rnd()*metM.length)]:metm[Math.floor(rnd()*metm.length)];
  if(m==='fiado'&&(!cu||d<2||(cu.term>0&&d>=cu.term)||((dbt[cu.id]||0)+total)>cu.limit*0.35))m='transferencia';const fi=m==='fiado'?total:0;if(fi)dbt[cu.id]=(dbt[cu.id]||0)+fi;
  const s={id:'hs'+d+'_'+k,n:cj+'-'+S.seq[cj],ts,user:ws?'ADMIN':'Mostrador',caja:cj,sessId:'hist-demo',items,total,method:m,doc:'ticket_interno',status:'ok',fee:0,channel:'local',
   cust:cu?cu.id:'',custName:cu?custFull(cu):'',coupon:'',benefit:null,recv:0,fiado:fi>0,pays:[{m,a:total,fee:0}],fiadoAmt:fi,paid:total-fi,balance:fi,vuelto:0,pstate:fi?'pendiente':'pagada',demo:true};
  if(ws)s.wch='mayorista';if(fi&&cu&&cu.term>0){s.term=cu.term;s.due=ts+cu.term*86400000;}
  S.sales.push(s);}}}
/* proveedores, deudas y una orden pendiente: se cargan con el mismo motor que usa la pantalla (validaciones reales) */
/* V27.10 · Distribuidora de ejemplo: cartera de comercios con zona y días de visita, preventista, pedidos de venta en distintos estados
   (pendiente, armado, entregado en parte, entregado), visitas y cobranza en la calle de HOY, reparto con zonas, repartidores, envíos y una
   hoja de ruta, y un acopio. Usa las mismas funciones que el sistema, así todo queda enlazado (stock reservado, remitos, cuenta corriente). */
function demoDistriSeed(){if(!window.RAVE_DEMO||!giOn('orders')||S.cfg.distriSeeded)return;S.cfg.distriSeeded=1;
 const t0=now(),H=3600000,DAY=86400000,adm=S.users.find(u=>u.role==='admin')||user;const prevU=user;user=adm;
 try{
  if(!S.roles.preventista)S.roles.preventista=['presale','orders','sell','customers'];
  if(!S.users.some(u=>u.role==='preventista'))S.users.push({id:'u-prev',name:'Lucas (preventista)',role:'preventista',pin:'5555',active:true});
  const Z=['Centro','Zona Norte','Zona Sur'],LL=[[-24.7883,-65.4106],[-24.7701,-65.4093],[-24.8052,-65.4201]],DIAS=[[1,4],[2,5],[3,6]];
  const N=[['Despensa San Cayetano','27301112225','Av. Belgrano 1450',0,1500000,15],['Kiosco La Terminal','20334445551','Av. Hipólito Yrigoyen 200',0,800000,7],['Autoservicio El Tunal','30715556665','Av. Bolivia 4100',1,4000000,30],
   ['Almacén Los Pinos','27389990006','Pasaje Los Pinos 120',1,1000000,15],['Minimercado Tres Cerritos','30716667770','Los Ceibos 55',1,2500000,30],['Despensa Don Julio','20298887771','Av. Tavella 3300',2,1200000,15],
   ['Kiosco Universitario','27412223336','Av. Bolivia 5150',2,600000,7],['Bar El Patio','30717778886','Caseros 980',0,900000,15]];
  N.forEach(([n,cuit,dir,z,lim,term],i)=>{if(!arcaCuitOk(cuit)||S.customers.some(c=>c.taxid===cuit))return;
   S.customers.push({id:'dc'+i,num:100+i,name:n,last:'',birth:'',wa:'+5493874'+String(600000+i*137),dni:'',cards:[],cardSecrets:{},origin:'ejemplo',consent:{club:false,comm:true,analytics:false,version:'v1-2026-demo',ts:t0-40*DAY},ts:t0-40*DAY,
    status:'activo',limit:lim*100,secret:'dc-ej-'+i+'-0000000000',notes:'',channel:'mayorista',taxid:cuit,term,zone:Z[z],seller:'u-prev',addr:dir+', Salta',example:true,
    pv:{zona:Z[z],dias:DIAS[i%3],seller:'u-prev',ord:i,lat:LL[z][0]+((i*37)%9-4)*0.002,lng:LL[z][1]+((i*53)%9-4)*0.002}});});
  S.customers.filter(c=>c.channel==='mayorista'&&!c.pv).forEach((c,i)=>{c.pv={zona:'Centro',dias:DIAS[i%3],seller:'u-prev',ord:20+i,lat:LL[0][0]+i*0.003,lng:LL[0][1]-i*0.003};c.zone=c.zone||'Centro';});
  const P=S.products.filter(p=>!p.archived&&p.active!==false&&p.price>0&&!isKit(p)),pid=k=>P[(k*7)%P.length].id;
  const ord=(cid,items,cond,src,note,hAtras)=>{const r=vbOrderCreate({cust:cid,items,cond,src,note,deliv:new Date(t0+DAY).toISOString().slice(0,10)});if(!r||r.err)return null;r.o.ts=t0-hAtras*H;if(r.o.hist[0])r.o.hist[0].ts=r.o.ts;return r.o;};
  const o1=ord('dc0',[{pid:pid(1),qty:12},{pid:pid(2),qty:6}],'cc','preventa','Entregar a la mañana',2);
  const o2=ord('dc2',[{pid:pid(3),qty:24},{pid:pid(4),qty:12},{pid:pid(5),qty:6}],'cc','preventa','',20);
  const o3=ord('dc4',[{pid:pid(6),qty:18},{pid:pid(7),qty:6}],'contado','whatsapp','Pidió por WhatsApp',28);
  const o4=ord('dc5',[{pid:pid(8),qty:12}],'cc','mostrador','',50);ord('dc1',[{pid:pid(9),qty:6},{pid:pid(10),qty:6}],'contado','preventa','',1);
  if(o2){const k={};o2.items.forEach(it=>k[it.pid]=it.qty);vbPick(o2.id,k);}
  if(o3){const k={};o3.items.forEach(it=>k[it.pid]=it.qty);vbRemito(o3.id,k);}
  if(o4){const k={};o4.items.forEach(it=>k[it.pid]=Math.floor(it.qty/2));vbRemito(o4.id,k);}
  user=S.users.find(u=>u.id==='u-prev')||adm;
  const ruta=pvRoute('',new Date(t0).getDay());ruta.slice(0,3).forEach((c,i)=>pvVisit(c.id,['Compró','Tiene stock','Cerrado'][i],['Pedido cargado','Vuelve en la próxima visita',''][i]));
  S.customers.filter(c=>debtOf(c.id)>200000).slice(0,2).forEach((c,i)=>pvCobro(c.id,Math.min(debtOf(c.id),[5000000,3000000][i]),i?'transferencia':'efectivo',i?'TRF 4512':''));
  user=adm;
  if(typeof repCfg==='function'){const rc=repCfg();rc.on=true;rc.origen={lat:-24.7859,lng:-65.4117,dir:'Depósito · Av. Ex Combatientes de Malvinas 3900, Salta (ejemplo)'};
   rc.zonas=[{id:'rz1',nombre:'Centro',tarifa:0,minimo:0,eta:'2 a 4 h',radio:3,activo:true},{id:'rz2',nombre:'Zona Norte',tarifa:0,minimo:0,eta:'en el día',radio:6,activo:true},{id:'rz3',nombre:'Zona Sur',tarifa:0,minimo:0,eta:'en el día',radio:6,activo:true}];
   rc.reps=[{id:'rr1',nombre:'Martín (camioneta)',tel:'3874001001',veh:'Camioneta',cap:12,kg:900,m3:4,fijo:0,pct:0,login:(S.users.find(u=>u.role==='repartidor')||{}).id||'',activo:true},{id:'rr2',nombre:'Diego (moto)',tel:'3874001002',veh:'Moto con baúl',cap:6,kg:60,m3:0.15,fijo:0,pct:0,login:'',activo:true}];
   const env=[];['dc0','dc2','dc3','dc5','dc6','dc4'].forEach((cid,i)=>{const c=custById(cid);if(!c||!c.pv)return;const zi=Math.max(0,Z.indexOf(c.pv.zona));
    const items=[0,1,2].slice(0,1+i%3).map(k=>{const p=prod(pid(i*3+k));const q=6*(1+(i+k)%3);return{pid:p.id,name:pfull(p),rubro:p.rubro,qty:q,price:p.price,cost:p.cost||0,unit:p.unit||'u'};});
    const e=repNuevo({orig:i%2?'pos':'menu',cli:{nombre:c.name,tel:c.wa,dir:c.addr,loc:'Salta',ref:'',lat:c.pv.lat,lng:c.pv.lng,custId:c.id},zona:['rz1','rz2','rz3'][zi],tarifa:0,items,total:items.reduce((a,x)=>a+x.price*x.qty,0),cobro:{modo:i%2?'pagado':'efectivo',abona:0},nota:''});
    e.ts=t0-(6-i)*H;env.push(e);});
   if(env.length>=6){repSetEst(env[0],'preparando');['listo'].forEach(s=>{repSetEst(env[1],s);repSetEst(env[2],s);repSetEst(env[3],s);});repSetEst(env[5],'entregado');
    const ids=[env[1].id,env[2].id];const r={id:uid(),n:repRutaNum(),ts:t0,rep:'rr1',repNom:'Martín (camioneta)',envios:ids,estado:'armada',cambio:0,km:repKm(ids),via:'cálculo propio (gratis)',url:repMapsUrl(ids),user:adm.name};
    S.rutas.push(r);ids.forEach(id=>{const e=repEnv(id);e.rutaId=r.id;repHist(e,'en ruta '+r.n);});
    /* V27.14 · el circuito completo: dos pedidos del preventista van al camión (uno contado, uno en cuenta corriente) y la ruta de Martín sale a la calle */
    if(typeof vbToReparto==='function'){const P2=vbArr('sordr').filter(o=>VB_OPEN.includes(o.state)).slice(0,2);const add=[];P2.forEach((o,k)=>{if(k===0)o.cond='contado';const x=vbToReparto(o.id);if(!x.err)add.push(x.e.id);});
     if(add.length){add.forEach(id=>{const e=repEnv(id);e.rutaId=r.id;repHist(e,'en ruta '+r.n);});r.envios=add.concat(r.envios);r.km=repKm(r.envios);r.url=repMapsUrl(r.envios);}}
    r.estado='en_curso';r.salida=t0;r.envios.map(repEnv).forEach(e=>{if(e&&e.estado==='listo')repSetEst(e,'en_ruta',{nota:r.n});});}}
  if(giOn('stockpile'))vbAcopioCreate({cust:'dc2',items:[{pid:pid(11),qty:60}],note:'Mercadería pagada que retira en partes (ejemplo)'});
  audit('DEMO_EJEMPLOS','Distribuidora: cartera, pedidos, preventa, reparto y acopio de ejemplo');
 }catch(e){console.warn('demoDistriSeed',e&&e.message);}
 user=prevU;save();}
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
 user=prev;audit('DEMO_EJEMPLOS','Kini: proveedores, deudas y orden de ejemplo');save();try{demoDistriSeed();}catch(e){console.warn('distri',e&&e.message);}}
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
/* V27.3 · Demos por rubro (sólo con RAVE_DEMO; sin él no cambia nada).
   · «Modelo de negocio» único (como Configuración → Módulos de Raspberry): 1 ¿Qué vendés? · 2 ¿Cómo compra tu cliente? · 3 Esto es lo que va a pasar.
     Lo abren Configuración y Módulos (el mismo botón «Cambiar»): ajusta canal de venta, plan, funciones y menú de una vez.
   · Módulos: una lista de interruptores, ordenada (fijos arriba, después las funciones del plan).
   · Celular y tablet: barra inferior (Inicio, Caja, Vender, Stock, Más), el menú lateral se cierra al tocar afuera o con Escape. */
{const D=(typeof window!=='undefined'&&window.RAVE_DEMO)||null;
 if(D){if(typeof facCfgCard==='function'){const _fc=facCfgCard;facCfgCard=function(){return typeof giPlan==='function'&&giPlan()!=='total'?'':_fc.apply(this,arguments);};}
  /* V27.7 · Plan Esencial (plan bajo): sin servicios que se venden aparte o van en planes superiores.
     NFC (lector, tarjetas, sello con el celular): se vende aparte como combo, en la reunión. Portero y seguridad: siempre opcional.
     Asistente de texto y voz / IA y bots: planes superiores. Se ocultan de la vista; los datos y funciones no se tocan. */
  {const BAJO=()=>typeof giPlan==='function'&&giPlan()==='esencial';
   /* en vez de esconder: se muestran como adicionales bloqueados, con el beneficio y un botón que arma el pedido por WhatsApp (ticket más alto) */
   const ADD=[['nfc','📡','Combo NFC','Tarjetas y llaveros NFC para el Club, sello con el celular del cliente y lector en el mostrador: el cliente apoya la tarjeta y suma puntos al instante.','Se suma aparte: lector, tarjetas o llaveros con tu marca, instalación y capacitación.'],
    ['ia','🎙️','Asistente de voz e IA','Le pedís al sistema por voz o por escrito («vendeme 2 gaseosas», «¿cuánto vendí hoy?») y lee las facturas de tus proveedores con IA.','Viene con el plan Total.'],
    ['portero','🛡️','Portero y seguridad','Control de quién entra y sale, alarmas y avisos al celular del dueño.','Adicional opcional para cualquier plan.']];
   window.vbAddonsHTML=function(cl){const nom=(window.RAVE_DEMO&&RAVE_DEMO.nombre)||'Sistema VB';const wa=t=>'https://wa.me/5493874484132?text='+encodeURIComponent('Hola Vincular Business, probé la demo «'+nom+'» y quiero información sobre: '+t);
    return`<div class="card vb-add ${cl||''}" style="margin-top:1rem"><h3 style="margin-top:0">✨ Adicionales para tu negocio</h3><p class="sm mut">Tu plan es <b>${esc(GI_PLANS[giPlan()].t)}</b>. Estos servicios se suman cuando los necesites; los coordinamos en la reunión.</p>
    <div class="vb-add-l">${ADD.map(([k,ic,t,d,c])=>`<div class="vb-add-i"><span class="vb-add-ic" aria-hidden="true">${ic}</span><span class="sp"><b>${esc(t)}</b> <span class="tag">🔒 adicional</span><br><span class="sm">${esc(d)}</span><br><span class="sm mut">${esc(c)}</span></span><a class="btn sm" target="_blank" rel="noopener" href="${wa(t)}">Pedir información</a></div>`).join('')}</div></div>`;};
   if(typeof nfcCfgCard==='function'){const o=nfcCfgCard;nfcCfgCard=function(){return BAJO()?window.vbAddonsHTML():o.apply(this,arguments);};}
   if(typeof nfcFieldHTML==='function'){const o=nfcFieldHTML;nfcFieldHTML=function(){return BAJO()?'':o.apply(this,arguments);};}
   if(typeof nfcStatusHTML==='function'){const o=nfcStatusHTML;nfcStatusHTML=function(){return BAJO()?'':o.apply(this,arguments);};}
   if(typeof nfcMiniHTML==='function'){const o=nfcMiniHTML;nfcMiniHTML=function(){return BAJO()?'':o.apply(this,arguments);};}
   if(typeof selloNfcCardHtml==='function'){const o=selloNfcCardHtml;selloNfcCardHtml=function(){return BAJO()?'':o.apply(this,arguments);};}
   if(typeof ptCfgCardHtml==='function'){const o=ptCfgCardHtml;ptCfgCardHtml=function(){return BAJO()?'':o.apply(this,arguments);};}
   if(typeof assistCfgCard==='function'){const o=assistCfgCard;assistCfgCard=function(){return BAJO()?'':o.apply(this,arguments);};}
   const st=document.createElement('style');st.textContent='html.vb-bajo #as-open,html.vb-bajo #as-dock,html.vb-bajo [data-act=fdNfc],html.vb-bajo [data-act=cbNfc],html.vb-bajo [data-act=hrNfcWrite],html.vb-bajo [data-act=cuNfc],html.vb-bajo [data-act=nfcLink],html.vb-bajo [data-act=nfcManual],html.vb-bajo [data-act=nfcSetup],html.vb-bajo [data-act=nfcTest],html.vb-bajo [data-act=nfcList],html.vb-bajo [data-act=nfcLiveToggle]{display:none!important}.vb-add-l{display:grid;gap:.6rem;margin-top:.6rem}.vb-add-i{display:flex;gap:.8rem;align-items:center;padding:.85rem 1rem;border:1px dashed var(--line);border-radius:14px;background:color-mix(in srgb,var(--gold) 6%,var(--card))}.vb-add-ic{font-size:1.5rem;flex:0 0 auto}.vb-add-i .btn{flex:0 0 auto}@media(max-width:600px){.vb-add-i{flex-wrap:wrap}.vb-add-i .btn{width:100%;text-align:center}}';
   (document.head||document.documentElement).appendChild(st);
   const marca=()=>{try{document.documentElement.classList.toggle('vb-bajo',BAJO());}catch(e){}};marca();setInterval(marca,1500);}
  const COM=['inicio','vender','caja','arqueo','cierres','presup','mermas','inventario','precios','etiquetas','inventariof','proveedores','clientes','fidel','cupones','config','roles','modulos','dispositivos','auditoria'];
  const DIS=['inicio','vender','caja','arqueo','cierres','pedidosv','preventa','pvcli','pvped','pvlisto','cambios','devoluciones','carga','reparto','copiloto','depositos','acopios','inventario','inventariof','precios','etiquetas','proveedores','clientes','portalb2b','personal','vales','equipo','config','roles','modulos','dispositivos','auditoria'];
  const IC={min:'M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6',both:'M3 21V9l9-6 9 6v12M8 21v-7h8v7M3 12h18',may:'M2 6h11v10H2zM13 9h4l4 4v3h-8zM6 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',todo:'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5'};
  const T={min:{t:'Mostrador',d:'Vendés al consumidor final, en el mostrador o con autoservicio.',ej:'Kiosco · almacén · autoservicio · ropa · ferretería',plan:'esencial',p:COM.filter(x=>x!=='inventariof')},
   both:{t:'Minorista y mayorista',d:'Vendés al público y también por mayor, con precios por presentación.',ej:'Mayorista · autoservicio mayorista · bebidas',plan:'mayorista',p:COM},
   may:{t:'Despacho y reparto',d:'Tomás pedidos, se arman en el depósito y se reparten.',ej:'Distribuidora · materiales · mayorista con reparto',plan:'mayorista',p:DIS},
   todo:{t:'Libre',d:'Todos los módulos visibles, sin molde.',ej:'Para quien prefiere decidir módulo por módulo',plan:'total',p:null}};
  const RUB=[['Kiosco / almacén','min'],['Autoservicio','min'],['Bebidas','both'],['Ropa y calzado','min'],['Ferretería','min'],['Materiales de construcción','may'],['Distribuidora','may'],['Mayorista','both'],['Otro','todo']];
  const tipo=()=>S&&S.cfg&&S.cfg.demoTodo?'todo':(typeof chanCur==='function'?chanCur():'both');
  const lista=()=>{const x=T[tipo()];return x&&x.p?new Set(x.p):null;};
  const planDe=k=>{const x=T[k]||T.both;S.cfg.plan=x.plan;if(typeof GI_MODS!=='undefined'&&typeof giInPlan==='function'){const c=giCfg();GI_MODS.forEach(m=>{c[m.k]=giInPlan(m.plan)?1:0;});}};
  const aplicar=(k,rub)=>{if(!T[k])return;S.cfg.demoTodo=k==='todo';if(rub!==undefined)S.cfg.demoRubro=rub;const ch=k==='todo'?'both':k;
   const W=Object.assign({},S.cfg.wholesale||{});W.on=ch!=='min';W.only=ch==='may';S.cfg.wholesale=W;planDe(k);
   audit('DEMO_MODELO',T[k].t+(S.cfg.demoRubro?' · '+S.cfg.demoRubro:'')+' · plan '+S.cfg.plan);save();rerender();toast('Modelo de negocio: '+T[k].t+'. Menú y módulos actualizados.');};
  const pasa=k=>{const on=(x,t)=>`<li><span class="vbm-dot ${x?'on':''}"></span>${esc(t)}: <b>${x?'encendido':'apagado'}</b></li>`;
   return `<ul class="vbm-pasa">${on(1,'Vender, caja, stock y clientes')}${on(k!=='min','Precios mayoristas por presentación')}${on(k==='may'||k==='todo','Pedidos, preventa y reparto')}${on(k==='may'||k==='todo','Depósitos, acopio y equipo en el mapa')}${on(k!=='may','Club de clientes, cupones y etiquetas')}${on(k==='todo','Atención al cliente, finanzas y contabilidad')}</ul>
    <p class="sm mut">Plan: <b>${esc(GI_PLANS[T[k].plan].t)}</b>. Lo demás queda como está. Un módulo apagado sale del menú, pero <b>lo que ya existe se sigue viendo</b>: no se borra ningún dato.</p>`;};
  const svg=d=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const abrirModelo=()=>{if(D.fijo)return toast('Esta demo ya viene armada para '+T[tipo()].t.toLowerCase()+'. Para ver otro rubro, abrí su demo en vincularbusiness.com.ar');if(!user||user.role!=='admin')return toast('Sólo el administrador cambia el modelo de negocio',1);let sel=tipo(),rub=S.cfg.demoRubro||'';
   const body=`<p class="sm mut">Con esto ordenamos el menú y encendemos lo que vas a usar. No cambia ningún cálculo ni borra datos, y lo podés cambiar cuando quieras desde Configuración o Módulos.</p>
    <h4 class="vbm-h">1 · ¿Qué vendés?</h4><div class="vbm-chips">${RUB.map(([r,k])=>`<button type="button" class="vbm-chip ${r===rub?'on':''}" data-r="${esc(r)}" data-k="${k}">${esc(r)}</button>`).join('')}</div>
    <h4 class="vbm-h">2 · ¿Cómo compra tu cliente?</h4><div class="vbm-opts">${Object.entries(T).map(([k,x])=>`<button type="button" class="vbm-opt ${k===sel?'on':''}" data-k="${k}" aria-pressed="${k===sel}"><span class="vbm-ic">${svg(IC[k])}</span><span><b>${esc(x.t)}</b><br>${esc(x.d)}<br><small>${esc(x.ej)}</small></span></button>`).join('')}</div>
    <div class="vbm-box"><h4 class="vbm-h" style="margin-top:0">3 · Esto es lo que va a pasar</h4><div id="vbm-pasa">${pasa(sel)}</div></div>`;
   const w=modal('Modelo de negocio',body,{wide:true,okText:'✓ Aplicar',onOk:()=>{if(sel===tipo()&&rub===(S.cfg.demoRubro||''))return true;aplicar(sel,rub);return true;}});
   const pick=k=>{sel=k;w.querySelectorAll('.vbm-opt').forEach(b=>{const on=b.dataset.k===k;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);});w.querySelector('#vbm-pasa').innerHTML=pasa(k);};
   w.addEventListener('click',e=>{const c=e.target.closest('.vbm-chip');if(c){rub=c.dataset.r;w.querySelectorAll('.vbm-chip').forEach(b=>b.classList.toggle('on',b===c));pick(c.dataset.k);return;}
    const o=e.target.closest('.vbm-opt');if(o)pick(o.dataset.k);});};
  const modeloCard=()=>{const k=tipo(),x=T[k];return`<div class="card vbm-card"><div class="row" style="align-items:center;gap:.7rem"><span class="vbm-ic">${svg(IC[k])}</span><h3 class="sp" style="margin:0">Modelo de negocio</h3>${user&&user.role==='admin'&&!D.fijo?'<button class="btn" data-act="vbModelo">✎ Cambiar</button>':''}</div>
   <p style="margin:.7rem 0 .2rem"><b>${esc(x.t)}</b>${S.cfg.demoRubro?` <span class="tag">${esc(S.cfg.demoRubro)}</span>`:''}</p><p class="sm mut" style="margin:0">${esc(x.d)} Plan ${esc(GI_PLANS[x.plan].t)}.</p></div>`;};
  const FIJOS=['Vender y caja','Stock e inventario','Clientes','Usuarios y permisos','Configuración','Auditoría'];
  const modulosHTML=()=>{const fijo=t=>`<div class="vbm-row off-ro"><span class="vbm-sw on ro" aria-hidden="true"></span><span class="sp"><b>${esc(t)}</b><br><span class="sm mut">Fijo: no se puede apagar.</span></span></div>`;
   const fila=m=>{const lock=!giInPlan(m.plan),on=giOn(m.k);const sc=m.scr&&SCREENS[m.scr];
    return`<div class="vbm-row ${lock?'lock':''}"><button class="vbm-sw ${on?'on':''}" ${lock?'disabled':''} data-act="giMod" data-k="${m.k}" data-on="${on?0:1}" role="switch" aria-checked="${on}" aria-label="${esc(m.t)}"></button><span class="sp"><b>${esc(m.t)}</b><br><span class="sm mut">${lock?'Viene con el modelo «Despacho y reparto» o «Libre».':esc(m.d)}</span></span>${on&&sc?`<button class="btn sm" data-act="nav" data-id="${m.scr}">Abrir</button>`:''}</div>`;};
   const L=GI_MODS.filter(m=>!(tipo()==='min'&&m.k==='count')).sort((a,b)=>(giInPlan(a.plan)?0:1)-(giInPlan(b.plan)?0:1));
   return`<div class="row"><h1 class="sp">Módulos</h1></div>${modeloCard()}
    <div class="card"><h3 style="margin-top:0">Módulos del sistema</h3><p class="sm mut">Cada interruptor vale para todo el negocio. Apagar un módulo lo saca del menú; lo que ya existe se sigue viendo y no se borra nada. Cada cambio queda en Auditoría.</p>
    <div class="vbm-list">${FIJOS.map(fijo).join('')}${L.map(fila).join('')}</div></div>${typeof giPlan==='function'&&giPlan()==='esencial'&&window.vbAddonsHTML?window.vbAddonsHTML():''}`;};
  const CSS=`.vbm-h{margin:1.1rem 0 .5rem;font-size:1rem;color:var(--mut)}.vbm-chips{display:flex;flex-wrap:wrap;gap:.5rem}
.vbm-chip{font:inherit;padding:.6rem 1rem;border-radius:12px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}.vbm-chip.on{border-color:var(--gold);background:color-mix(in srgb,var(--gold) 14%,transparent);font-weight:700}
.vbm-opts{display:grid;gap:.6rem}.vbm-opt{font:inherit;text-align:left;display:flex;gap:.8rem;align-items:flex-start;padding:.9rem 1rem;border-radius:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;line-height:1.4}
.vbm-opt small{color:var(--mut)}.vbm-opt.on{border-color:var(--gold);background:color-mix(in srgb,var(--gold) 12%,transparent)}.vbm-ic{display:inline-flex;color:var(--gold);flex:0 0 auto;margin-top:.1rem}
.vbm-box{margin-top:1rem;padding:.9rem 1rem;border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--mut) 6%,transparent)}.vbm-pasa{list-style:none;padding:0;margin:0 0 .6rem;display:grid;gap:.35rem}
.vbm-dot{display:inline-block;width:.6rem;height:.6rem;border-radius:50%;background:var(--mut);margin-right:.5rem;vertical-align:middle}.vbm-dot.on{background:#16a34a}
.vbm-list{display:grid;gap:.6rem;margin-top:.8rem}.vbm-row{display:flex;gap:.9rem;align-items:center;padding:.85rem 1rem;border:1px solid var(--line);border-radius:14px;background:var(--card)}.vbm-row.lock{opacity:.6}
.vbm-sw{flex:0 0 auto;position:relative;width:52px;height:30px;border-radius:99px;border:2px solid var(--mut);background:transparent;cursor:pointer;padding:0}.vbm-sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--mut);transition:left .15s}
.vbm-sw.on{border-color:var(--gold);background:color-mix(in srgb,var(--gold) 18%,transparent)}.vbm-sw.on::after{left:25px;background:var(--gold)}.vbm-sw.ro{opacity:.55;cursor:default}.vbm-sw:disabled{cursor:not-allowed}
`;
  let hecho=false;const _rt=route;
  route=function(){if(!hecho&&typeof SCREENS==='object'){hecho=true;
    Object.entries(SCREENS).forEach(([k,s])=>{const sh=s.show;s.show=()=>{const L=lista();return(!L||L.has(k))&&(!sh||sh());};});
    if(typeof UX_SEC_OF==='object'){['depositos','inventariof','acopios','reparto','copiloto','equipo','etiquetas','precios'].forEach(k=>{UX_SEC_OF[k]='Logística e inventario';});
     ['pedidosv','preventa','portalb2b'].forEach(k=>{UX_SEC_OF[k]='Operación comercial';});['personal','vales'].forEach(k=>{UX_SEC_OF[k]='Equipo';});}
    if(typeof giPackApply==='function'){giPackApply=function(ch){if(S&&S.cfg)S.cfg.demoTodo=false;planDe(ch);return[];};}
    if(typeof bizCard==='function'){bizCard=function(){return modeloCard();};}
    A.vbModelo=()=>abrirModelo();A.bmGo=()=>abrirModelo();
    if(SCREENS.modulos)SCREENS.modulos.render=()=>modulosHTML();
    const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    try{if(S&&S.cfg&&!S.cfg.demoTipoV3){S.cfg.demoTipoV3=1;planDe(tipo());save();}}catch(e){}}
   return _rt.apply(this,arguments);};
}}
