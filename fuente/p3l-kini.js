/* ===== Demo «Kini Distribuidora» (compilación `kini`) =====
   Sólo existe en la demo publicada en KiniDistribuidoraDemo. Arranca como MAYORISTA DE UN SOLO DUEÑO, con:
   · Caja 1, Caja 2 y Caja principal ABIERTAS con efectivo de ejemplo (perfil «varias cajas + caja principal»).
   · Proveedores de ejemplo con deuda, una orden de compra pendiente y precios mayoristas por presentación.
   Todo rotulado «ejemplo». «Borrar todo y empezar vacío» deja el sistema sin datos para probarlo desde cero. */
function isKiniBuild(){return!!(typeof window!=='undefined'&&window.RAVE_BUILD&&window.RAVE_BUILD.profile==='kini');}
function kiniBase(d){
 d.tenant=Object.assign({},d.tenant,{name:'Kini Distribuidora',legal:'Kini Distribuidora (demo de ejemplo)',slogan:'Distribuidora mayorista · demo',address:'(dirección de ejemplo)',phone:'',wa:'',ig:'',fb:'',caja:1,regId:'r1'});
 d.cfg.biz='owner';d.cfg.cashProfile='main';d.cfg.xfer=Object.assign({},d.cfg.xfer||{},{strict:false,selfAuth:true,ownerV:1});
 d.menu=Object.assign({},d.menu,{title:'KINI DISTRIBUIDORA',sub:{es:'Distribuidora mayorista · demo',en:'Wholesale distributor · demo'},
  pitch:{es:'Hacé tu pedido mayorista desde el celular: elegí los productos y la presentación (**unidad, display, fardo o pallet**) y te **confirmamos stock y entrega por WhatsApp**.',en:'Place your wholesale order from your phone: pick the products and the pack (**unit, display, case or pallet**) and we **confirm stock and delivery by WhatsApp**.'},
  promo:{on:true,es:'Precios **mayoristas por volumen**: cuanto más comprás, mejor precio por unidad (ejemplo).',en:'**Volume wholesale prices**: the more you buy, the better the unit price (example).'},
  footer:{es:'Kini Distribuidora · demo de evaluación',en:'Kini Distribuidora · evaluation demo'},
  mapQuery:'',mapUrl:'',reviewUrl:'',wifi:{on:false,ssid:'',pass:'',example:false},social:[],clubOn:false});
 d.cfg.tax={};d.cfg.ticket=Object.assign({},d.cfg.ticket,{msg:'¡Gracias por su compra!'});
 if(!d.rubros.some(r=>r.id==='sys-gen'))d.rubros.push({id:'sys-gen',name:'Caja del negocio',kind:'sysgen',color:'#6b7280',sys:true,reparte:false,owner:'',active:true});
 d.rubros.forEach(r=>{r.owner='';r.reparte=false;});
 d.registers=[{id:'r1',code:'1',name:'Caja 1',type:'operational',branchId:'',parentId:'rp',active:true},
  {id:'r2',code:'2',name:'Caja 2',type:'operational',branchId:'',parentId:'rp',active:true},
  {id:'rp',code:'P',name:'Caja principal',type:'main',branchId:'',parentId:'',active:true}];
 const t=Math.max(Date.now()-2*3600000,new Date().setHours(0,5,0,0));
 d.sessions=[{id:'k-s1',caja:1,regId:'r1',regName:'Caja 1',branchId:'',openedBy:'ADMIN',openedAt:t,opening:15000000,closedAt:0},
  {id:'k-s2',caja:2,regId:'r2',regName:'Caja 2',branchId:'',openedBy:'Mostrador (ejemplo)',openedAt:t,opening:10000000,closedAt:0},
  {id:'k-sp',caja:3,regId:'rp',regName:'Caja principal',branchId:'',openedBy:'ADMIN',openedAt:t,opening:80000000,closedAt:0}];
 return d;}
/* proveedores, deudas y una orden pendiente: se cargan con el mismo motor que usa la pantalla (validaciones reales) */
async function kiniSeedAsync(){if(!isKiniBuild()||!S.cfg||S.cfg.kiniSeeded)return;S.cfg.kiniSeeded=1;
 const prev=user;user=user||{id:'u1',name:'ADMIN',role:'admin'};
 const prods=S.products.filter(p=>p.unit==='u'&&!isKit(p)&&!p.archived&&p.price>0);const pick=(i)=>prods[i%prods.length];
 const cost=p=>Math.max(100,Math.round((p.cost||p.price*0.7)/100));
 try{
  const P=[['Bebidas del Norte S.A. (ejemplo)','30712345671','Responsable Inscripto','ventas@ejemplo.com','(0387) 400-0001','Parque industrial, lote 4 (ejemplo)'],
   ['Vinos Andinos S.R.L. (ejemplo)','30698765433','Responsable Inscripto','pedidos@ejemplo.com','(0261) 400-0002','Mendoza (ejemplo)'],
   ['Hielo y Afines (ejemplo)','20301234563','Monotributista','','(0387) 400-0003','Salta (ejemplo)']];
  const ids=[];
  for(const [rs,cuit,iva,mail,tel,dir] of P){if(!arcaCuitOk(cuit))continue;const r=await LOCAL.supSave({razon_social:rs,cuit,condicion_iva:iva,email:mail||undefined,telefono:tel,direccion:dir});ids.push(r.id);}
  if(ids[0])await LOCAL.recibir({idempotency_key:'kini-ej-rem-1',proveedor_id:ids[0],tipo_comprobante:'Factura',nro_comprobante:'0001-00001234',condicion_pago:'credito',observaciones:'Compra de ejemplo a cuenta corriente',
   items:[0,1,2].map(i=>({producto_id:pick(i).id,cantidad:24,precio_costo:cost(pick(i))}))});
  if(ids[1])await LOCAL.recibir({idempotency_key:'kini-ej-rem-2',proveedor_id:ids[1],tipo_comprobante:'Remito',nro_comprobante:'R-0008821',condicion_pago:'credito',observaciones:'Remito de ejemplo',
   items:[3,4].map(i=>({producto_id:pick(i).id,cantidad:12,precio_costo:cost(pick(i))}))});
  if(ids[2])await LOCAL.recibir({idempotency_key:'kini-ej-rem-3',proveedor_id:ids[2],tipo_comprobante:'Remito',nro_comprobante:'R-0000150',condicion_pago:'credito',
   items:[{producto_id:(prod('ej-hielo')||pick(5)).id,cantidad:50,precio_costo:900}]});
  if(ids[0])await LOCAL.ocSave({idempotency_key:'kini-ej-oc-1',proveedor_id:ids[0],estado:'Solicitada',observaciones:'Orden de ejemplo pendiente de recibir',
   items:[5,6].map(i=>({producto_id:pick(i).id,cantidad:48,precio_costo_pactado:cost(pick(i))}))});
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
