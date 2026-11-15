/* ===== V26.43 · Demo «Comercio de un solo dueño» (compilación `solo`, publicada en raveV2) =====
   Demo genérica para mostrar a clientes: UN SOLO DUEÑO, sin socios, sin rubros por persona, sin reparto y sin nada
   propio de Almacén RAVE (nombre, dirección, WhatsApp, redes, rubros, catálogo, Wi-Fi). Venta minorista de almacén/kiosco.
   Los productos se agrupan en CATEGORÍAS (sólo ordenan inventario, Vender y menú). Todo el dinero es del dueño.
   No lleva el Centro Inteligente ni los asistentes SVB R2AVE (eso es raveV3). Todo rotulado «ejemplo». */
/* V26.46: raveV3 (perfil v3) usa la misma base genérica de un solo dueño, más el Centro Inteligente con los asistentes */
function isSoloBuild(){return!!(typeof window!=='undefined'&&window.RAVE_BUILD&&(window.RAVE_BUILD.profile==='solo'||window.RAVE_BUILD.profile==='v3'));}
/* V26.63 · raveV2 = sistema GENÉRICO sin rubro de negocio; raveV3 = visión EMPRESARIAL (gestión integral, sin rubros de comercio chico ni bebidas) */
function isV3Build(){return !!(typeof window!=='undefined'&&window.RAVE_BUILD&&window.RAVE_BUILD.profile==='v3');}
function soloCats(){return isV3Build()?[
 {id:'e-equ',name:'Equipamiento',color:'#1d4ed8',mNom:'Equipamiento',mTitle:'Equipamiento',layout:'grid',alcohol:false},
 {id:'e-sof',name:'Software y licencias',color:'#7c3aed',mNom:'Software',mTitle:'Software y licencias',layout:'rows',alcohol:false},
 {id:'e-srv',name:'Servicios profesionales',color:'#0f766e',mNom:'Servicios',mTitle:'Servicios profesionales',layout:'rows',alcohol:false},
 {id:'e-ins',name:'Insumos corporativos',color:'#b45309',mNom:'Insumos',mTitle:'Insumos corporativos',layout:'rows',alcohol:false},
 {id:'e-log',name:'Logística y distribución',color:'#334155',mNom:'Logística',mTitle:'Logística y distribución',layout:'rows',alcohol:false},
 {id:'e-mnt',name:'Mantenimiento y soporte',color:'#be123c',mNom:'Soporte',mTitle:'Mantenimiento y soporte',layout:'rows',alcohol:false}]:[
 {id:'g-prod',name:'Productos',color:'#2563eb',mNom:'Productos',mTitle:'Productos',layout:'grid',alcohol:false},
 {id:'g-serv',name:'Servicios',color:'#0f766e',mNom:'Servicios',mTitle:'Servicios',layout:'rows',alcohol:false},
 {id:'g-acc',name:'Accesorios',color:'#7c3aed',mNom:'Accesorios',mTitle:'Accesorios',layout:'grid',alcohol:false},
 {id:'g-ins',name:'Insumos',color:'#b45309',mNom:'Insumos',mTitle:'Insumos',layout:'rows',alcohol:false},
 {id:'g-pack',name:'Paquetes',color:'#be123c',mNom:'Paquetes',mTitle:'Paquetes y combos',layout:'grid',alcohol:false}];}
/* [id, nombre, presentación, categoría, precio ($), costo ($), stock, unidad] — nombres genéricos, sin marcas */
function soloProds(){return isV3Build()?[
 ['e-srv1','Servidor de rack 1U','8 núcleos · 64 GB','e-equ',2950000,2210000,6,'u'],['e-nb','Notebook corporativa','14" · 16 GB','e-equ',1450000,1090000,18,'u'],
 ['e-imp','Impresora multifunción láser','red · dúplex','e-equ',690000,505000,4,'u'],['e-mon','Monitor 27"','QHD','e-equ',420000,310000,22,'u'],['e-sw','Switch administrable','24 puertos','e-equ',380000,270000,3,'u'],
 ['e-erp','Licencia de gestión integral','anual · por usuario','e-sof',480000,240000,500,'u'],['e-nube','Almacenamiento en la nube','1 TB · mensual','e-sof',95000,52000,999,'u'],
 ['e-sec','Seguridad de equipos','anual · por equipo','e-sof',68000,38000,999,'u'],['e-ofi','Paquete de oficina','anual · por usuario','e-sof',112000,70000,999,'u'],
 ['e-con','Consultoría','por hora','e-srv',85000,40000,999,'u'],['e-imp2','Implementación de sistema','proyecto','e-srv',3200000,1750000,999,'u'],['e-cap','Capacitación en la empresa','jornada','e-srv',540000,260000,999,'u'],
 ['e-aud','Auditoría de procesos','proyecto','e-srv',1850000,980000,999,'u'],
 ['e-res','Resma A4','caja x10','e-ins',58000,41000,40,'u'],['e-ton','Tóner láser','alto rendimiento','e-ins',96000,68000,5,'u'],['e-cab','Cable de red Cat6','caja 305 m','e-ins',210000,152000,9,'u'],
 ['e-fle','Flete regional','por envío','e-log',145000,98000,999,'u'],['e-dep','Almacenamiento en depósito','pallet · mes','e-log',38000,24000,999,'u'],['e-dist','Distribución urbana','por ruta','e-log',92000,61000,999,'u'],
 ['e-mpr','Mantenimiento preventivo','visita técnica','e-mnt',120000,62000,999,'u'],['e-sop','Soporte técnico mensual','hasta 20 equipos','e-mnt',350000,180000,999,'u'],['e-mes','Mesa de ayuda 24 × 7','mensual','e-mnt',620000,330000,999,'u']]:[
 ['g-p1','Producto estándar','unidad','g-prod',8500,5900,40,'u'],['g-p2','Producto premium','unidad','g-prod',15900,10900,22,'u'],['g-p3','Producto económico','unidad','g-prod',4900,3300,60,'u'],
 ['g-p4','Producto a granel','por kilo','g-prod',12000,8200,18.5,'kg'],['g-p5','Producto de temporada','unidad','g-prod',11500,7800,4,'u'],['g-p6','Producto destacado','unidad','g-prod',19900,13500,12,'u'],
 ['g-s1','Servicio por hora','hora','g-serv',18000,7000,999,'u'],['g-s2','Instalación','servicio','g-serv',35000,14000,999,'u'],['g-s3','Mantenimiento','visita','g-serv',27000,11000,999,'u'],['g-s4','Asesoramiento','sesión','g-serv',22000,8000,999,'u'],
 ['g-a1','Accesorio básico','unidad','g-acc',3900,2400,35,'u'],['g-a2','Accesorio premium','unidad','g-acc',9800,6200,14,'u'],['g-a3','Repuesto','unidad','g-acc',6500,4100,3,'u'],['g-a4','Estuche','unidad','g-acc',5200,3200,20,'u'],
 ['g-i1','Insumo general','pack x10','g-ins',7400,5100,25,'u'],['g-i2','Insumo líquido','por litro','g-ins',4600,3000,30,'l'],['g-i3','Material de embalaje','rollo','g-ins',3100,2000,2,'u'],
 ['g-k1','Tarjeta de regalo','$ 20.000','g-pack',20000,20000,999,'u']];}
function soloEan(i){const b='7790000'+String(20000+i).slice(-5);let s=0;for(let k=0;k<12;k++)s+=(+b[k])*(k%2?3:1);return b+((10-s%10)%10);}
function soloCatalog(){const L=soloProds().map(([id,name,sub,cat,price,cost,stock,unit],i)=>({id,name,sub,grupo:'',rubro:cat,price:price*100,cost:cost*100,stock,unit,
  barcode:unit==='u'?soloEan(i):'',plu:unit==='kg'?'21':'',menu:true,active:true,desc:'',featured:i%6===0,demo:true}));
 if(isV3Build())L.push({id:'e-kit',name:'Kit puesto de trabajo',sub:'notebook + monitor + licencia',grupo:'',rubro:'e-equ',price:226000000,cost:0,stock:0,unit:'u',barcode:'',plu:'',menu:true,active:true,desc:'Se descuenta cada artículo del stock',demo:true,
  kit:[{pid:'e-nb',qty:1},{pid:'e-mon',qty:1},{pid:'e-erp',qty:1}]});
 else L.push({id:'g-combo',name:'Paquete inicial',sub:'producto + accesorio + instalación',grupo:'',rubro:'g-pack',price:4200000,cost:0,stock:0,unit:'u',barcode:'',plu:'',menu:true,active:true,desc:'Se descuenta cada artículo del stock',demo:true,
  kit:[{pid:'g-p1',qty:1},{pid:'g-a1',qty:1},{pid:'g-s2',qty:1}]});
 return L;}
function soloBase(d){
 const V3=isV3Build();const NM=V3?'Corporación Demo':'Mi Negocio';
 d.tenant=Object.assign({},d.tenant,{name:NM,legal:NM+(V3?' S.A. (empresa de ejemplo)':' (demo de ejemplo)'),slogan:V3?'Gestión integral para empresas · demo':'Sistema de gestión · demo',address:'(dirección de ejemplo)',phone:'',wa:'',ig:'',fb:'',caja:1});
 d.cfg.biz='owner';d.cfg.restricted=false;d.cfg.bizLocked=1;d.cfg.soloV=1;d.cfg.cashProfile=V3?'branches':'simple';d.cfg.xfer=Object.assign({},d.cfg.xfer||{},{strict:false,selfAuth:true,ownerV:1});
 d.cfg.tax={};d.cfg.ticket=Object.assign({},d.cfg.ticket,{msg:'¡Gracias por su compra!'});
 d.menu=Object.assign({},d.menu,{title:NM.toUpperCase(),sub:V3?{es:'Soluciones empresariales · demo',en:'Business solutions · demo'}:{es:'Catálogo · demo',en:'Catalog · demo'},
  pitch:V3?{es:'Consultá el catálogo corporativo y **pedí tu cotización por WhatsApp**: un ejecutivo de cuentas te responde (ejemplo).',en:'Browse the corporate catalog and **request a quote via WhatsApp**: an account executive will reply (example).'}
   :{es:'Elegí productos o servicios, armá el pedido y **mandalo por WhatsApp**: te confirmamos disponibilidad (ejemplo).',en:'Pick products or services, build your order and **send it via WhatsApp**: we confirm availability (example).'},
  promo:{on:true,es:V3?'**Plan corporativo:** 10 % en la primera orden con el cupón **BIENVENIDA10** (ejemplo).':'**10 % de descuento** en tu primera compra con el cupón **BIENVENIDA10** (ejemplo).',en:V3?'**Corporate plan:** 10 % off your first order with coupon **BIENVENIDA10** (example).':'**10 % off** your first purchase with coupon **BIENVENIDA10** (example).'},
  footer:{es:NM+' · demo de evaluación',en:NM+' · evaluation demo'},
  mapQuery:'',mapUrl:'',reviewUrl:'',wifi:{on:false,ssid:'',pass:'',example:false},social:[]});
 /* un solo dueño: categorías de productos + conceptos internos ocultos (no son rubros de personas) */
 const keep=d.rubros.filter(r=>r.kind==='cobr'||r.kind==='shared');
 d.rubros=soloCats().map(c=>Object.assign({owner:'',reparte:false,kind:'rubro',mHint:''},c)).concat(keep);
 if(!d.rubros.some(r=>r.id==='sys-gen'))d.rubros.push({id:'sys-gen',name:'Caja del negocio',kind:'sysgen',color:'#6b7280',sys:true,reparte:false,owner:'',active:true});
 d.rubros.forEach(r=>{r.owner='';r.reparte=false;});
 d.products=soloCatalog();
 if(d.cfg.wholesale){d.cfg.wholesale.on=false;d.cfg.wholesale.example=false;d.cfg.wholesale.seeded=1;}
 d.cfg.comboSeeded=1;d.agreements=[];
 d.loyalty=Object.assign({},d.loyalty,{reward:V3?'Bonificación del 10 % en el próximo servicio — ejemplo':'Un producto de regalo a elección — ejemplo',ledger:[],usedOtp:{}});
 d.coupons=[{id:'cp1',code:'BIENVENIDA10',type:'pct',value:10,min:0,from:'',to:'',maxUses:0,perCust:1,aud:'todos',active:true,note:'10 % en la primera compra (ejemplo)',uses:[]}];
 if(V3){d.employees=[{id:'e1',name:'Ejecutivo de cuentas (ejemplo)',puestoId:'pu_ven',rate:900000,pin:'1234',active:true},{id:'e2',name:'Analista administrativo (ejemplo)',puestoId:'pu_adm',rate:800000,pin:'1234',active:true},{id:'e3',name:'Técnico de soporte (ejemplo)',puestoId:'pu_sop',rate:750000,pin:'1234',active:true}];
  d.puestos=[{id:'pu_soc',name:'Dirección general',parent:'',holders:''},{id:'pu_adm',name:'Administración y finanzas',parent:'pu_soc',holders:''},{id:'pu_ven',name:'Ventas corporativas',parent:'pu_soc',holders:''},{id:'pu_sop',name:'Operaciones y soporte',parent:'pu_soc',holders:''}];
  d.tasks=[{id:'t1',title:'Conciliar cobranzas y cajas de las sucursales',puestoId:'pu_adm',freq:'daily',active:true},{id:'t2',title:'Seguimiento de cotizaciones abiertas',puestoId:'pu_ven',freq:'daily',active:true},
   {id:'t3',title:'Revisar indicadores de atención al cliente',puestoId:'pu_soc',freq:'weekly',dow:1,active:true},{id:'t4',title:'Planificar compras y reposición',puestoId:'pu_adm',freq:'weekly',dow:5,active:true},{id:'t5',title:'Control de stock crítico de equipamiento',puestoId:'pu_sop',freq:'weekly',dow:3,active:true}];
  d.branches=[{id:'b1',code:'1',name:'Casa central',active:true},{id:'b2',code:'2',name:'Sucursal Norte',active:true}];
  d.registers=[{id:'r1',code:'1',name:'Caja Casa central',type:'operational',branchId:'b1',parentId:'rp',active:true},{id:'r2',code:'2',name:'Caja Sucursal Norte',type:'operational',branchId:'b2',parentId:'rp',active:true},
   {id:'rp',code:'P',name:'Tesorería (caja principal)',type:'main',branchId:'b1',parentId:'',active:true}];d.sessions=[];}
 else{d.employees=[{id:'e1',name:'Colaborador (ejemplo)',puestoId:'pu_most',rate:250000,pin:'1234',active:true}];
  d.puestos=[{id:'pu_soc',name:'Dueño',parent:'',holders:''},{id:'pu_most',name:'Atención',parent:'pu_soc',holders:''}];
  d.tasks=[{id:'t1',title:'Abrir caja y controlar el cambio',puestoId:'pu_most',freq:'daily',active:true},{id:'t2',title:'Ordenar y reponer productos',puestoId:'pu_most',freq:'daily',active:true},
   {id:'t3',title:'Revisar stock bajo',puestoId:'pu_most',freq:'weekly',dow:1,active:true},{id:'t4',title:'Pedido a proveedores',puestoId:'pu_soc',freq:'weekly',dow:5,active:true}];
  d.registers=[];d.branches=[];d.sessions=[];}
 return d;}
/* después de los ejemplos generales: sin clientes mayoristas ni datos de canal (la demo es minorista) */
function soloExtras(){if(!isSoloBuild())return;S.customers=S.customers.filter(c=>c.channel!=='mayorista'&&!/^ws/.test(c.id));S.customers.forEach(c=>{c.channel='minorista';});
 S.sales=S.sales.filter(s=>s.wch!=='mayorista');}
