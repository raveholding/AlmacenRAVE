/* ===== V26.43 · Demo «Comercio de un solo dueño» (compilación `solo`, publicada en raveV2) =====
   Demo genérica para mostrar a clientes: UN SOLO DUEÑO, sin socios, sin rubros por persona, sin reparto y sin nada
   propio de Almacén RAVE (nombre, dirección, WhatsApp, redes, rubros, catálogo, Wi-Fi). Venta minorista de almacén/kiosco.
   Los productos se agrupan en CATEGORÍAS (sólo ordenan inventario, Vender y menú). Todo el dinero es del dueño.
   No lleva el Centro Inteligente ni los asistentes SVB R2AVE (eso es raveV3). Todo rotulado «ejemplo». */
function isSoloBuild(){return!!(typeof window!=='undefined'&&window.RAVE_BUILD&&window.RAVE_BUILD.profile==='solo');}
function soloCats(){return[
 {id:'s-alm',name:'Almacén',color:'#5b7d3a',mNom:'Almacén',mTitle:'Almacén',layout:'rows',alcohol:false},
 {id:'s-beb',name:'Bebidas',color:'#2f6f8f',mNom:'Bebidas',mTitle:'Bebidas',layout:'grid',alcohol:false},
 {id:'s-alc',name:'Bebidas con alcohol',color:'#7b2d3b',mNom:'Con alcohol',mTitle:'Bebidas con alcohol (+18)',layout:'grid',alcohol:true},
 {id:'s-lac',name:'Lácteos y frescos',color:'#3d7fa8',mNom:'Lácteos',mTitle:'Lácteos y frescos',layout:'rows',alcohol:false},
 {id:'s-gol',name:'Golosinas y snacks',color:'#b4562f',mNom:'Golosinas',mTitle:'Golosinas y snacks',layout:'grid',alcohol:false},
 {id:'s-lim',name:'Limpieza y perfumería',color:'#5a6e8c',mNom:'Limpieza',mTitle:'Limpieza y perfumería',layout:'rows',alcohol:false}];}
/* [id, nombre, presentación, categoría, precio ($), costo ($), stock, unidad] — nombres genéricos, sin marcas */
function soloProds(){return[
 ['s-yerba','Yerba mate','1 kg','s-alm',4200,3100,40,'u'],['s-azucar','Azúcar','1 kg','s-alm',1300,950,60,'u'],['s-fideos','Fideos secos','500 g','s-alm',1100,780,80,'u'],
 ['s-arroz','Arroz largo fino','1 kg','s-alm',1700,1200,45,'u'],['s-aceite','Aceite de girasol','1,5 lt','s-alm',3600,2700,30,'u'],['s-harina','Harina 000','1 kg','s-alm',950,690,50,'u'],
 ['s-pure','Puré de tomate','520 g','s-alm',900,620,4,'u'],['s-cafe','Café molido','250 g','s-alm',5200,3900,12,'u'],
 ['s-gas','Gaseosa cola','2,25 lt','s-beb',2900,2100,36,'u'],['s-gas-lima','Gaseosa lima-limón','2,25 lt','s-beb',2700,1950,24,'u'],['s-agua','Agua mineral','2 lt','s-beb',1200,800,48,'u'],
 ['s-jugo','Jugo de naranja','1 lt','s-beb',1800,1250,3,'u'],
 ['s-cerveza','Cerveza rubia','lata 473 ml','s-alc',1500,1050,96,'u'],['s-vino','Vino tinto','750 ml','s-alc',4800,3300,18,'u'],['s-fernet','Aperitivo amargo','750 ml','s-alc',9500,7000,8,'u'],
 ['s-leche','Leche entera','1 lt','s-lac',1300,980,30,'u'],['s-yogur','Yogur bebible','1 lt','s-lac',2100,1500,14,'u'],['s-queso','Queso cremoso','por kilo','s-lac',9800,7200,6.5,'kg'],
 ['s-manteca','Manteca','200 g','s-lac',2400,1750,10,'u'],
 ['s-alfajor','Alfajor','unidad','s-gol',900,600,72,'u'],['s-papas','Papas fritas','150 g','s-gol',1900,1300,20,'u'],['s-galle','Galletitas dulces','300 g','s-gol',1300,900,25,'u'],
 ['s-carame','Caramelos surtidos','bolsa 150 g','s-gol',1100,700,2,'u'],
 ['s-lavan','Lavandina','2 lt','s-lim',1100,760,18,'u'],['s-deter','Detergente','750 ml','s-lim',1500,1050,15,'u'],['s-papel','Papel higiénico','pack x4','s-lim',2100,1500,22,'u'],
 ['s-jabon','Jabón de tocador','unidad','s-lim',800,520,30,'u']];}
function soloEan(i){const b='7790000'+String(20000+i).slice(-5);let s=0;for(let k=0;k<12;k++)s+=(+b[k])*(k%2?3:1);return b+((10-s%10)%10);}
function soloCatalog(){const L=soloProds().map(([id,name,sub,cat,price,cost,stock,unit],i)=>({id,name,sub,grupo:'',rubro:cat,price:price*100,cost:cost*100,stock,unit,
  barcode:unit==='u'?soloEan(i):'',plu:unit==='kg'?'21':'',menu:true,active:true,desc:'',featured:i%6===0,demo:true}));
 L.push({id:'s-combo-mate',name:'Combo mate',sub:'yerba + azúcar + galletitas',grupo:'',rubro:'s-alm',price:600000,cost:0,stock:0,unit:'u',barcode:'',plu:'',menu:true,active:true,desc:'Se descuenta cada artículo del stock',demo:true,
  kit:[{pid:'s-yerba',qty:1},{pid:'s-azucar',qty:1},{pid:'s-galle',qty:1}]});
 return L;}
function soloBase(d){
 d.tenant=Object.assign({},d.tenant,{name:'Mi Comercio',legal:'Mi Comercio (demo de ejemplo)',slogan:'Almacén y kiosco · demo',address:'(dirección de ejemplo)',phone:'',wa:'',ig:'',fb:'',caja:1});
 d.cfg.biz='owner';d.cfg.bizLocked=1;d.cfg.soloV=1;d.cfg.cashProfile='simple';d.cfg.xfer=Object.assign({},d.cfg.xfer||{},{strict:false,selfAuth:true,ownerV:1});
 d.cfg.tax={};d.cfg.ticket=Object.assign({},d.cfg.ticket,{msg:'¡Gracias por su compra!'});
 d.menu=Object.assign({},d.menu,{title:'MI COMERCIO',sub:{es:'Almacén y kiosco · demo',en:'Grocery & convenience store · demo'},
  pitch:{es:'Elegí tus productos, armá el pedido y **mandalo por WhatsApp**: te confirmamos stock y entrega (ejemplo).',en:'Pick your products, build your order and **send it via WhatsApp**: we confirm stock and delivery (example).'},
  promo:{on:true,es:'**10 % de descuento** en tu primera compra con el cupón **BIENVENIDA10** (ejemplo).',en:'**10 % off** your first purchase with coupon **BIENVENIDA10** (example).'},
  footer:{es:'Mi Comercio · demo de evaluación',en:'Mi Comercio · evaluation demo'},
  mapQuery:'',mapUrl:'',reviewUrl:'',wifi:{on:false,ssid:'',pass:'',example:false},social:[]});
 /* un solo dueño: categorías de productos + conceptos internos ocultos (no son rubros de personas) */
 const keep=d.rubros.filter(r=>r.kind==='cobr'||r.kind==='shared');
 d.rubros=soloCats().map(c=>Object.assign({owner:'',reparte:false,kind:'rubro',mHint:''},c)).concat(keep);
 if(!d.rubros.some(r=>r.id==='sys-gen'))d.rubros.push({id:'sys-gen',name:'Caja del negocio',kind:'sysgen',color:'#6b7280',sys:true,reparte:false,owner:'',active:true});
 d.rubros.forEach(r=>{r.owner='';r.reparte=false;});
 d.products=soloCatalog();
 if(d.cfg.wholesale){d.cfg.wholesale.on=false;d.cfg.wholesale.example=false;d.cfg.wholesale.seeded=1;}
 d.cfg.comboSeeded=1;d.agreements=[];
 d.loyalty=Object.assign({},d.loyalty,{reward:'Un producto de regalo a elección (hasta $ 3.000) — ejemplo',ledger:[],usedOtp:{}});
 d.coupons=[{id:'cp1',code:'BIENVENIDA10',type:'pct',value:10,min:0,from:'',to:'',maxUses:0,perCust:1,aud:'todos',active:true,note:'10 % en la primera compra (ejemplo)',uses:[]}];
 d.employees=[{id:'e1',name:'Empleado de mostrador (ejemplo)',puestoId:'pu_most',rate:250000,pin:'1234',active:true}];
 d.puestos=[{id:'pu_soc',name:'Dueño',parent:'',holders:''},{id:'pu_most',name:'Mostrador',parent:'pu_soc',holders:''}];
 d.tasks=[{id:'t1',title:'Abrir caja y controlar el cambio',puestoId:'pu_most',freq:'daily',active:true},{id:'t2',title:'Reponer heladeras y góndolas',puestoId:'pu_most',freq:'daily',active:true},
  {id:'t3',title:'Revisar vencimientos de lácteos',puestoId:'pu_most',freq:'weekly',dow:1,active:true},{id:'t4',title:'Pedido a proveedores',puestoId:'pu_soc',freq:'weekly',dow:5,active:true}];
 d.registers=[];d.branches=[];d.sessions=[];
 return d;}
/* después de los ejemplos generales: sin clientes mayoristas ni datos de canal (la demo es minorista) */
function soloExtras(){if(!isSoloBuild())return;S.customers=S.customers.filter(c=>c.channel!=='mayorista'&&!/^ws/.test(c.id));S.customers.forEach(c=>{c.channel='minorista';});
 S.sales=S.sales.filter(s=>s.wch!=='mayorista');}
