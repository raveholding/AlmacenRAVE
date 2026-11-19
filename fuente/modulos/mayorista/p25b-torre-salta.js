/* =====================================================================
   p25b-torre-salta.js · V27.19 · Datos de ejemplo de la Torre de Control (demo Distribuidora)
   Salta Capital: depósito en el Parque Industrial, 4 zonas, 3 móviles, 4 preventistas y 28 comercios.
   Los nombres de comercios y personas son de ejemplo; las calles y barrios son reales y las
   posiciones son aproximadas. Los teléfonos usan la serie 387 555-xxxx (no son números reales).
   La Torre (p25-torre.js) pide estos datos con torreSemilla(); en un sistema real usa sus envíos.
   ===================================================================== */
function torreSemilla(){
 const dep={nombre:'Depósito Central · Parque Industrial',dir:'Av. Durañona y Ruta 26, Parque Industrial',lat:-24.8195,lng:-65.3855};
 const zonas=[
  {id:'centro',nombre:'Centro y Macrocentro',corto:'Centro',color:'#2563eb',poly:[[-65.4205,-24.7805],[-65.3975,-24.7805],[-65.3965,-24.7880],[-65.3975,-24.7985],[-65.4205,-24.7985],[-65.4215,-24.7890]]},
  {id:'norte',nombre:'Zona Norte',corto:'Norte',color:'#0d9488',poly:[[-65.4205,-24.7225],[-65.3985,-24.7225],[-65.3880,-24.7480],[-65.3880,-24.7790],[-65.4135,-24.7790],[-65.4215,-24.7500]]},
  {id:'sur',nombre:'Zona Sur',corto:'Sur',color:'#c2410c',poly:[[-65.4300,-24.8020],[-65.4080,-24.8020],[-65.4040,-24.8250],[-65.4130,-24.8400],[-65.4460,-24.8470],[-65.4460,-24.8280]]},
  {id:'oeste',nombre:'Zona Oeste',corto:'Oeste',color:'#7c3aed',poly:[[-65.4640,-24.7600],[-65.4400,-24.7600],[-65.4220,-24.7850],[-65.4220,-24.8010],[-65.4400,-24.8050],[-65.4640,-24.7900]]}];
 const moviles=[
  {id:'M01',nombre:'Móvil 01',veh:'Iveco Daily 55C',patente:'AE 312 KD',chofer:'Carlos Mamani',tel:'5493875550101',cap:240,costo:86000,zona:'centro'},
  {id:'M02',nombre:'Móvil 02',veh:'Mercedes-Benz Accelo 815',patente:'AF 908 LS',chofer:'Franco Tolaba',tel:'5493875550102',cap:320,costo:104000,zona:'norte'},
  {id:'M03',nombre:'Móvil 03',veh:'Ford Cargo 915',patente:'AD 455 PR',chofer:'Diego Chauqui',tel:'5493875550103',cap:420,costo:121000,zona:'sur'}];
 const prev=[
  {id:'V1',nombre:'Lucía Fernández',tel:'5493875550201'},{id:'V2',nombre:'Matías Saravia',tel:'5493875550202'},
  {id:'V3',nombre:'Sofía Condori',tel:'5493875550203'},{id:'V4',nombre:'Jorge Villagra',tel:'5493875550204'}];
 // [id, nombre, dirección, lat, lng, zona, preventista, saldo cc, días de deuda vencida, saldo de cajones]
 const C=[
  ['C01','Drugstore 24 hs Belgrano','Av. Belgrano 1150',-24.7838,-65.4045,'centro','V1',0,0,4],
  ['C02','Almacén Don Tito','Caseros 980',-24.7905,-65.4148,'centro','V1',186500,0,12],
  ['C03','Despensa La Catedral','España 620',-24.7899,-65.4085,'centro','V1',0,0,6],
  ['C04','Autoservicio San Martín','Av. San Martín 1320',-24.7960,-65.4152,'centro','V2',412300,38,22],
  ['C05','Minimercado Plaza Güemes','Pueyrredón 450',-24.7930,-65.4060,'centro','V2',58200,0,8],
  ['C06','Kiosco y Despensa Jujuy','Av. Jujuy 340',-24.7930,-65.3998,'centro','V1',0,0,3],
  ['C07','Almacén La Merced','Alberdi 210',-24.7877,-65.4115,'centro','V2',0,0,5],
  ['C08','Despensa Mitre','Mitre 780',-24.7830,-65.4110,'centro','V1',96400,0,10],
  ['C09','Minimercado Tres Cerritos','Los Ceibos 120, Tres Cerritos',-24.7700,-65.3990,'norte','V3',0,0,14],
  ['C10','Autoservicio El Milagro','Av. Reyes Católicos 1450',-24.7715,-65.4045,'norte','V3',264900,0,18],
  ['C11','Kiosco y Despensa Castañares','Av. Bolivia 4100, Castañares',-24.7390,-65.4120,'norte','V3',0,0,6],
  ['C12','Despensa Universitaria','Av. Bolivia 5150, B° Universitario',-24.7290,-65.4085,'norte','V4',0,0,4],
  ['C13','Almacén Ciudad del Milagro','Av. Patrón Costas 280, Ciudad del Milagro',-24.7580,-65.3935,'norte','V4',137800,21,9],
  ['C14','Drugstore Reyes Católicos','Av. Reyes Católicos 2100',-24.7620,-65.4070,'norte','V3',0,0,2],
  ['C15','Despensa Los Lapachos','Los Lapachos 450, Tres Cerritos',-24.7745,-65.3965,'norte','V4',45200,0,7],
  ['C16','Supermercado Barrial Limache','Av. Tavella 3200, Limache',-24.8285,-65.4120,'sur','V2',318000,0,26],
  ['C17','Despensa El Tribuno','Av. Ex Combatientes de Malvinas 4200, B° El Tribuno',-24.8350,-65.4300,'sur','V4',0,0,8],
  ['C18','Almacén Intersindical','Av. Paraguay 2450, B° Intersindical',-24.8140,-65.4170,'sur','V2',72600,0,11],
  ['C19','Autoservicio San Carlos','Av. Tavella 4100, B° San Carlos',-24.8330,-65.4220,'sur','V4',0,0,15],
  ['C20','Kiosco Santa Ana','Av. Ex Combatientes de Malvinas 3600, B° Santa Ana',-24.8410,-65.4380,'sur','V2',0,0,3],
  ['C21','Minimercado Sur','Av. Paraguay 3100',-24.8230,-65.4200,'sur','V4',158400,45,13],
  ['C22','Despensa La Loma','Av. Independencia 1200',-24.8070,-65.4235,'sur','V2',0,0,5],
  ['C23','Almacén Grand Bourg','Av. Arenales 2350, Grand Bourg',-24.7680,-65.4510,'oeste','V1',0,0,6],
  ['C24','Despensa Alto La Viña','Av. Arenales 1850, Alto La Viña',-24.8010,-65.4250,'oeste','V1',83000,0,9],
  ['C25','Autoservicio Campo Caseros','Av. Perón 1550, Campo Caseros',-24.7935,-65.4290,'oeste','V3',0,0,12],
  ['C26','Kiosco Acceso San Lorenzo','Av. San Martín 3200',-24.7760,-65.4520,'oeste','V3',0,0,2],
  ['C27','Minimercado Arenales','Av. Arenales 2900',-24.7860,-65.4380,'oeste','V1',121500,0,10],
  ['C28','Despensa Perón','Av. Perón 850',-24.7930,-65.4350,'oeste','V3',0,0,4]];
 const com=C.map(c=>({id:c[0],nombre:c[1],dir:c[2]+', Salta',lat:c[3],lng:c[4],zona:c[5],prev:c[6],cc:c[7],venc:c[8],env:c[9],tel:'54938755503'+c[0].slice(1)}));
 // Pedido del día por comercio: [comercio, móvil (''=sin asignar), bultos, monto, medio, margen %, ventana desde, hasta, cajones a entregar, a retirar, evento]
 // medio: ef = efectivo, tr = transferencia, qr = QR Mercado Pago, cc = cuenta corriente. evento: cerrado | precio
 const P=[
  ['C03','M01',18,212400,'ef',21,8*60,11*60,4,3],['C01','M01',12,148900,'qr',24,8*60,10*60+30,2,2],['C08','M01',22,256300,'cc',19,8*60+30,12*60,5,4],
  ['C07','M01',9,98700,'tr',22,9*60,12*60,2,1],['C02','M01',26,301800,'cc',18,9*60,12*60+30,6,6],['C05','M01',15,167200,'ef',20,9*60,13*60,3,2,'precio'],
  ['C04','M01',31,389600,'cc',17,9*60+30,13*60,8,6],['C06','M01',8,86400,'ef',25,10*60,13*60,1,1],
  ['C25','M01',19,214800,'tr',20,10*60,14*60,4,3],['C24','',14,152300,'ef',21,10*60,14*60,3,2],['C28','',10,109900,'qr',23,10*60,15*60,2,2],
  ['C27','',21,238700,'cc',19,10*60+30,15*60,5,4],['C23','',16,171200,'ef',22,11*60,16*60,3,3],['C26','',7,76500,'qr',26,11*60,16*60,1,1],
  ['C15','M02',14,158600,'ef',22,8*60,11*60,3,2],['C09','M02',24,276500,'tr',20,8*60,11*60+30,5,5],['C10','M02',33,402100,'cc',18,8*60+30,12*60,7,6],
  ['C14','M02',11,121800,'qr',24,9*60,12*60,2,2],['C13','M02',20,219400,'cc',19,9*60,13*60,4,3],['C11','M02',13,139600,'ef',22,9*60+30,13*60,3,2,'precio'],
  ['C12','M02',9,92800,'qr',25,10*60,14*60,2,1],
  ['C22','M03',12,131700,'ef',21,8*60,11*60,3,2],['C18','M03',23,248900,'cc',19,8*60,11*60+30,5,4],['C21','M03',27,296300,'cc',18,8*60+30,12*60,6,5],
  ['C16','M03',41,498200,'tr',17,9*60,12*60+30,9,8],['C19','M03',25,271400,'ef',20,9*60,13*60,5,5,'cerrado'],['C17','M03',17,184500,'qr',22,9*60+30,13*60,4,3],
  ['C20','M03',8,82900,'ef',25,10*60,14*60,1,1]];
 let n=1040;const sal={M01:7*60+42,M02:7*60+48,M03:7*60+55};
 const ped=P.map((p,i)=>{const c=com.find(x=>x.id===p[0]);const pv=prev.find(x=>x.id===c.prev);n+=1+(i%3);
  const lev=(17*60+10)+((i*23)%170);
  return{id:'P-'+n,com:p[0],movil:p[1],bultos:p[2],monto:p[3],medio:p[4],margen:p[5],win:[p[6],p[7]],envEnt:p[8],envRet:p[9],ev:p[10]||'',
   estado:'pend',comprobante:'0003-000'+(48210+i),remito:'R 0002-000'+(17340+i),
   eventos:[
    {h:-1440+lev,usr:pv.nombre,txt:`Pedido levantado por ${pv.nombre} en el local`,det:`Margen bruto ${p[5]} %`,gps:true},
    {h:-1440+lev+38,usr:'Lorena Ríos · Créditos',txt:'Aprobado por Crédito y facturado',det:`Factura ${'0003-000'+(48210+i)} (ARCA) · Remito R 0002-000${17340+i}`},
    {h:6*60+10+((i*7)%55),usr:'Depósito Parque Industrial',txt:'Picking y carga en depósito',det:`${p[2]} bultos preparados · ${p[2]} cargados`}]
    .concat(p[1]?[{h:sal[p[1]],usr:moviles.find(m=>m.id===p[1]).chofer,txt:'En ruta',det:`${moviles.find(m=>m.id===p[1]).nombre} · salida del depósito`,gps:true}]:[])};});
 // Historial de rechazos de los últimos 30 días (para las causas de rechazo).
 const causas=['Local cerrado','Sin efectivo en caja','Error de preventa','Mercadería dañada','Diferencia de precio'];
 const hist=[];for(let i=0;i<46;i++){const c=com[(i*7+3)%com.length];const m=moviles[{centro:0,oeste:0,norte:1,sur:2}[c.zona]];
  hist.push({dias:1+(i*13)%29,com:c.id,prev:c.prev,movil:m.id,causa:causas[[0,0,1,2,0,3,1,4,2,0,1,3,4,0,2][i%15]]});}
 return{ver:1,fecha:new Date().toISOString().slice(0,10),dep,zonas,moviles:moviles.map(m=>Object.assign(m,{salida:sal[m.id],estado:'deposito',lat:dep.lat,lng:dep.lng,head:0,vel:0,leg:null,dwellHasta:0,km:0})),
  prev,com,ped,hist,ayer:{otif:84,efect:92,costoBulto:612,ocup:71}};
}
