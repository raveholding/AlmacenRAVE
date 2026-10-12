/* ===== Periféricos (HAL / DeviceManager) y ticket del cliente =====
   Hardware real: NO probado en esta demo. Cada modelo debe probarse físicamente [VERIFICAR por marca y modelo].
   WebUSB / Web Serial / Web Bluetooth existen sólo en Chrome/Edge (no en Safari/iPhone). Impresoras de red (TCP 9100), descubrimiento
   por red y lector NFC PC/SC necesitan un agente local (etapa futura). */
const DEV={usb:{},serial:{},ble:{},sim:{},scale:{last:null,samples:[],reader:null},hb:null};
const devList=()=>S.devices.list;
const devById=id=>devList().find(d=>d.id===id);
const DEV_TYPES={printer_thermal:'Impresora térmica de tickets',printer_windows:'Impresora de Windows',scale:'Balanza digital',scanner:'Lector de código de barras',other:'Otro dispositivo'};
const devHas={usb:typeof navigator!=='undefined'&&!!navigator.usb,serial:typeof navigator!=='undefined'&&!!navigator.serial,ble:typeof navigator!=='undefined'&&!!navigator.bluetooth};
function devAdd(d){const ex=devById(d.id);if(ex){Object.assign(ex,d);return ex;}devList().push(d);return d;}
function devSet(id,st){const d=devById(id);if(!d)return;if(d.status!==st){d.status=st;if(st==='conectado')d.lastSeen=now();}save();devTag();}
function devTag(){const e=$('#devtag');if(!e)return;const L=devList().filter(d=>d.type!=='scanner');const ok=L.filter(d=>d.status==='conectado').length;e.textContent='Periféricos '+ok+'/'+L.length;e.className='tag '+(L.length&&ok===L.length?'ok':L.length?'warn':'');e.title='Impresora, balanza y lectores conectados';}
const scaleReady=()=>devList().some(d=>d.type==='scale'&&d.status==='conectado');
const printerKind=()=>{const d=devList().find(x=>x.type==='printer_thermal'&&x.status==='conectado'&&!x.sim);if(d)return d.conn;if(devList().some(x=>x.type==='printer_windows'))return'windows';return'preview';};
function devChips(){const e=$('#devchips');if(!e)return;const chip=(t,ok)=>`<span class="tag ${ok?'ok':''}" title="${esc(t)}">${esc(t)}</span>`;
 const pr=devList().find(d=>d.type.startsWith('printer'));e.innerHTML=chip(pr?'Impresora: '+(pr.status==='conectado'||pr.type==='printer_windows'?'lista':'desconectada'):'Impresora: vista previa',pr&&(pr.status==='conectado'||pr.type==='printer_windows'))+chip('Lector: modo teclado',true)+(devList().some(d=>d.type==='scale')?chip('Balanza: '+(scaleReady()?'lista':'sin conexión'),scaleReady()):'');}

/* ---------- ESC/POS ---------- */
const PC850={'á':0xA0,'í':0xA1,'ó':0xA2,'ú':0xA3,'ñ':0xA4,'Ñ':0xA5,'ª':0xA6,'º':0xA7,'¿':0xA8,'¡':0xAD,'Á':0xB5,'É':0x90,'Í':0xD6,'Ó':0xE0,'Ú':0xE9,'ü':0x81,'Ü':0x9A,'é':0x82,'ä':0x84,'ö':0x94,'ç':0x87,'à':0x85,'è':0x8A,'ì':0x8D,'ò':0x95,'ù':0x97,'â':0x83,'ê':0x88,'ô':0x93,'û':0x96,'°':0xF8,'·':0xFA,'×':0x78,'—':0x2D,'–':0x2D,'’':0x27,'“':0x22,'”':0x22,'⭐':0x2A,'€':0x45};
function encPC850(s){const o=[];for(const ch of String(s)){const c=ch.codePointAt(0);if(PC850[ch]!==undefined)o.push(PC850[ch]);else if(c<128)o.push(c);else o.push(0x3F);}return o;}
const wrapTxt=(s,w)=>{const out=[];String(s).split('\n').forEach(par=>{let l='';par.split(' ').forEach(wd=>{while(wd.length>w){if(l){out.push(l);l='';}out.push(wd.slice(0,w));wd=wd.slice(w);}if(!l)l=wd;else if((l+' '+wd).length<=w)l+=' '+wd;else{out.push(l);l=wd;}});out.push(l);});return out;};
const lr=(l,r,w)=>{l=String(l);r=String(r);const sp=w-l.length-r.length;return sp>=1?l+' '.repeat(sp)+r:l.slice(0,Math.max(1,w-r.length-1))+' '+r;};
const menuUrl=()=>/^https?:/.test(location.protocol)?location.href.split('#')[0]:PUBLIC_URL();

/* modelo del ticket: lista de bloques que usan los tres formatos (vista previa, navegador, ESC/POS) */
function ticketModel(sale,W){const T=S.tenant,cfg=S.cfg.ticket;const B=[];const add=(t,x)=>B.push(Object.assign({t},x||{}));
 const arca=sale.doc!=='ticket_interno';
 const cb=(sale._nc&&sale._nc.cae)?sale._nc:(sale.arca&&sale.arca.cae?sale.arca:null),isNC=!!(sale._nc&&sale._nc.cae);
 if(cfg.showLogo)add('logo');
 add('c',{s:cb?(cb.razon||T.legal||T.name):(T.legal||T.name),b:1,big:1});if(T.address)wrapTxt(T.address,W).forEach(l=>add('c',{s:l}));if(T.phone)add('c',{s:'Tel./WhatsApp: '+T.phone});
 if(cb){add('c',{s:'CUIT: '+cb.cuit});add('c',{s:cb.cond==='RI'?'IVA Responsable Inscripto':cb.cond==='MONO'?'Responsable Monotributo':String(cb.cond||'')});}
 else{if(T.cuit)add('c',{s:'CUIT: '+T.cuit});if(T.iva)add('c',{s:T.iva});}
 add('sep');
 if(cb){add('c',{s:(isNC?'NOTA DE CRÉDITO ':'FACTURA ')+cb.letra,b:1,big:1});add('c',{s:'Cód. '+String(cb.tipo).padStart(3,'0')});
  if(cb.sim)add('c',{s:'COMPROBANTE SIMULADO · SIN VALIDEZ FISCAL',b:1});
  add('l',{l:'Pto. Vta. '+String(cb.pto).padStart(4,'0')+' Nro. '+String(cb.nro).padStart(8,'0'),r:''});add('l',{l:'Fecha '+String(cb.fecha||'').split('-').reverse().join('/'),r:'Caja '+sale.caja});add('t',{s:'Interno N.º '+sale.n+' · Atendió: '+sale.user});
  const rc=cb.receptor;if(rc&&+rc.docTipo!==99){add('t',{s:'Cliente: '+(rc.nombre||'(sin nombre)')});add('t',{s:(+rc.docTipo===80?'CUIT ':+rc.docTipo===86?'CUIL ':'DNI ')+rc.docNro});}else add('t',{s:'A CONSUMIDOR FINAL'});}
 else{add('c',{s:arca?'FACTURA — PENDIENTE DE CAE':'TICKET',b:1});add('l',{l:'N.º '+sale.n,r:fmtDT(sale.ts)});add('l',{l:'Atendió: '+sale.user,r:'Caja '+sale.caja});}
 if(sale.custName)add('t',{s:'Cliente: '+sale.custName});
 add('sep');
 sale.items.forEach(it=>{wrapTxt(it.name,W).forEach(l=>add('t',{s:l}));const q=Number.isInteger(it.qty)?String(it.qty):numAR(it.qty,3);add('l',{l:'  '+q+(it.qty!==1||true?' x ':'')+money(it.price),r:money(Math.round(it.qty*it.price))});if(it.disc)add('l',{l:'  Descuento',r:'- '+money(it.disc).replace(/^- /,'')});});
 add('sep');
 const gross=sale.items.reduce((a,i)=>a+Math.round(i.qty*i.price),0);
 if(sale.benefit){add('l',{l:'Subtotal',r:money(gross)});add('l',{l:sale.benefit.label,r:'- '+money(sale.benefit.disc).replace(/^- /,'')});}
 if(cb&&cb.letra==='A'&&cb.neto!=null){add('l',{l:'Neto gravado',r:money(cb.neto)});add('l',{l:'IVA',r:money(cb.iva)});}
 add('l',{l:'TOTAL',r:money(sale.total),b:1,big:1});
 if(cb&&cb.letra==='B'&&cb.iva>0)add('t',{s:'Régimen de Transparencia Fiscal (Ley 27.743) — IVA contenido: '+money(cb.iva)+' [VERIFICAR texto]'});
 add('t',{s:'Medio de pago: '+(MET[sale.method]||sale.method)});
 if(sale.method==='efectivo'&&sale.recv>=sale.total&&sale.recv>0){add('l',{l:'Recibido',r:money(sale.recv)});add('l',{l:'Vuelto',r:money(sale.recv-sale.total)});}
 if(sale.fiado&&sale.cust)add('t',{s:'A cuenta corriente. Saldo adeudado: '+money(debtOf(sale.cust))});
 if(sale.cust){const c=custById(sale.cust);if(c){add('sep');add('c',{s:'Socio N.º '+pad4(c.num)+' · Club RAVE',b:1});const st=stampsOf(c.id);add('c',{s:'Sellos: '+Math.min(st,S.loyalty.goal)+'/'+S.loyalty.goal+(st>=S.loyalty.goal?' — ¡premio para canjear!':'')});}}
 add('sep');
 if(cb){add('c',{s:'CAE: '+cb.cae,b:1});add('c',{s:'Vto. CAE: '+String(cb.vto||'').split('-').reverse().join('/')});if(cb.qr){let ok=true;try{ok=!!QR.encode(cb.qr);}catch(e){ok=false;}if(ok)add('qr',{data:cb.qr});}}
 else if(arca)add('c',{s:'Comprobante pendiente de CAE (ARCA). Se entrega el definitivo al obtenerlo.'});else{add('c',{s:'DOCUMENTO NO VÁLIDO COMO FACTURA',b:1});}
 add('c',{s:'Precios con impuestos incluidos.'});
 if(cfg.msg)wrapTxt(cfg.msg,W).forEach(l=>add('c',{s:l}));
 add('c',{s:'Instagram @'+(T.ig||'').toLowerCase()+' · Facebook '+(T.fb||'')});
 if(!(cb&&cb.qr)){add('qr',{data:menuUrl()});add('c',{s:'Escaneá: menú, Club y sellos'});}else add('c',{s:'Menú y Club: '+menuUrl(),sm:1});
 if(cfg.legal){add('sep');wrapTxt('Defensa del Consumidor: reclamos en el local. Ventas a distancia: botón de arrepentimiento en el menú digital. Prohibida la venta de alcohol y tabaco a menores de 18 años. Beber con moderación.',W).forEach(l=>add('c',{s:l,sm:1}));}
 add('c',{s:'Sistema RAVE · Rave Holding',sm:1});add('c',{s:'WhatsApp +54 9 387 514-3900',sm:1});
 return B;}
function ticketText(sale,W){W=W||(S.cfg.ticket.w===58?32:42);const L=[];ticketModel(sale,W).forEach(b=>{
 if(b.t==='sep')L.push('-'.repeat(W));else if(b.t==='c')L.push(' '.repeat(Math.max(0,Math.floor((W-b.s.length)/2)))+b.s);else if(b.t==='l')L.push(lr(b.l,b.r,W));else if(b.t==='t')L.push(b.s);else if(b.t==='logo')L.push('[ LOGO RAVE ]');else if(b.t==='qr')L.push('[ QR: '+b.data+' ]');});return L.join('\n');}
function ticketHTML(sale){const W=S.cfg.ticket.w===58?32:42;const mm=S.cfg.ticket.w===58?'48mm':'72mm';let h='';
 ticketModel(sale,W).forEach(b=>{if(b.t==='sep')h+='<hr>';else if(b.t==='c')h+=`<div class="c${b.b?' b':''}${b.big?' big':''}${b.sm?' sm':''}">${esc(b.s)}</div>`;else if(b.t==='l')h+=`<div class="l${b.b?' b':''}${b.big?' big':''}"><span>${esc(b.l)}</span><span>${esc(b.r)}</span></div>`;else if(b.t==='t')h+=`<div>${esc(b.s)}</div>`;
  else if(b.t==='logo')h+=`<div class="c"><img src="${LOGO_TICKET}" style="width:100%;max-width:${mm}" alt="RAVE"></div>`;else if(b.t==='qr')h+=`<div class="c qr">${QR.svg(b.data,3,1)}</div>`;});
 return `<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${esc(sale.n)}</title><style>@page{size:${S.cfg.ticket.w===58?'58mm':'80mm'} auto;margin:0}body{margin:0;padding:2mm 3mm;width:${mm};font:12px/1.3 "Courier New",monospace;color:#000;background:#fff}.c{text-align:center}.b{font-weight:700}.big{font-size:15px}.sm{font-size:10px}.l{display:flex;justify-content:space-between;gap:6px}hr{border:0;border-top:1px dashed #000;margin:4px 0}.qr svg{width:90px;height:90px}</style></head><body>${h}</body></html>`;}

let LOGO_R=null;
function logoRaster(){if(LOGO_R)return LOGO_R;LOGO_R=new Promise(res=>{try{const im=new Image();im.onload=()=>{try{const w=Math.floor(Math.min(im.width,S.cfg.ticket.w===58?384:384)/8)*8,h=Math.round(im.height*w/im.width);const cv=document.createElement('canvas');cv.width=w;cv.height=h;const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,w,h);cx.drawImage(im,0,0,w,h);const d=cx.getImageData(0,0,w,h).data;const bytes=new Uint8Array(w/8*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;const lum=(d[i]*299+d[i+1]*587+d[i+2]*114)/1000;if(lum<128)bytes[y*(w/8)+(x>>3)]|=0x80>>(x&7);}res({w,h,bytes});}catch(e){res(null);}};im.onerror=()=>res(null);im.src=LOGO_TICKET;}catch(e){res(null);}});return LOGO_R;}
async function escposTicket(sale){const W=S.cfg.ticket.w===58?32:42;const o=[];const p=a=>a.forEach(x=>o.push(x));
 p([0x1b,0x40,0x1b,0x74,0x02]);                       // init + página de códigos PC850 [VERIFICAR por modelo]
 for(const b of ticketModel(sale,W)){
  if(b.t==='logo'){const r=await logoRaster();if(r){p([0x1b,0x61,1,0x1d,0x76,0x30,0,(r.w/8)&255,(r.w/8)>>8,r.h&255,r.h>>8]);r.bytes.forEach(x=>o.push(x));p([0x0a]);}}
  else if(b.t==='sep'){p(encPC850('-'.repeat(W)));p([0x0a]);}
  else if(b.t==='c'){p([0x1b,0x61,1,0x1b,0x45,b.b?1:0,0x1d,0x21,b.big?0x11:0]);p(encPC850(b.s));p([0x0a,0x1d,0x21,0,0x1b,0x45,0]);}
  else if(b.t==='l'){p([0x1b,0x61,0,0x1b,0x45,b.b?1:0]);p(encPC850(lr(b.l,b.r,W)));p([0x0a,0x1b,0x45,0]);}
  else if(b.t==='t'){p([0x1b,0x61,0]);p(encPC850(b.s));p([0x0a]);}
  else if(b.t==='qr'){const d=encPC850(b.data);const n=d.length+3;p([0x1b,0x61,1,0x1d,0x28,0x6b,4,0,0x31,0x41,0x32,0,0x1d,0x28,0x6b,3,0,0x31,0x43,5,0x1d,0x28,0x6b,3,0,0x31,0x45,0x30,0x1d,0x28,0x6b,n&255,n>>8,0x31,0x50,0x30]);p(d);p([0x1d,0x28,0x6b,3,0,0x31,0x51,0x30,0x0a]);}}
 p([0x0a,0x0a,0x0a,0x1d,0x56,0x42,0x00]);               // avance + corte parcial
 return new Uint8Array(o);}

/* ---------- envío a cada tipo de conexión ---------- */
async function devSend(d,bytes){
 if(d.conn==='usb'){const h=DEV.usb[d.id];if(!h)throw new Error('USB desconectado');const ch=1024;for(let i=0;i<bytes.length;i+=ch)await h.dev.transferOut(h.ep,bytes.slice(i,i+ch));return;}
 if(d.conn==='serial'){const h=DEV.serial[d.id];if(!h)throw new Error('Puerto serie desconectado');const w=h.port.writable.getWriter();try{await w.write(bytes);}finally{w.releaseLock();}return;}
 if(d.conn==='ble'){const h=DEV.ble[d.id];if(!h)throw new Error('Bluetooth desconectado');for(let i=0;i<bytes.length;i+=100){await h.ch.writeValueWithoutResponse(bytes.slice(i,i+100));await new Promise(r=>setTimeout(r,20));}return;}
 throw new Error('Conexión no soportada');}
/* cola de impresión: reintenta sin duplicar (una orden por venta y copia) */
const PRQ=[];let prBusy=false;
function printSale(saleId,opts){opts=opts||{};const s=opts.sale||S.sales.find(x=>x.id===saleId);if(!s)return false;const key='pr_'+s.id+(opts.copy?'_'+opts.copy:'');
 let j=PRQ.find(x=>x.key===key);if(j&&j.status!=='fallido'&&!opts.reprint)return false;if(!j){j={key,sale:s,status:'pendiente',tries:0,ts:now()};PRQ.push(j);}else{j.status='pendiente';j.tries=0;}
 if(PRQ.length>40)PRQ.shift();setTimeout(printPump,0);return true;}
async function printPump(){if(prBusy)return;prBusy=true;try{for(const j of PRQ){if(j.status!=='pendiente')continue;
  try{const kind=printerKind();
   if(kind==='usb'||kind==='serial'||kind==='ble'){const d=devList().find(x=>x.type==='printer_thermal'&&x.status==='conectado'&&!x.sim);const bytes=await escposTicket(j.sale);await devSend(d,bytes);j.status='ok';j.via=d.name;if(S.sales.includes(j.sale)){j.sale.printedAt=now();}audit('IMPRESION',j.sale.n+' · '+d.name);}
   else{browserPrint(j.sale);j.status='ok';j.via=kind==='windows'?'Impresora de Windows':'Vista previa / navegador';if(S.sales.includes(j.sale))j.sale.printedAt=now();audit('IMPRESION',j.sale.n+' · '+j.via);}
  }catch(e){j.tries++;j.err=String(e&&e.message||e);if(j.tries>=3){j.status='fallido';toast('No se pudo imprimir '+j.sale.n+': '+j.err,1);audit('IMPRESION_FALLIDA',j.sale.n+' · '+j.err);}else{await new Promise(r=>setTimeout(r,800*j.tries));}}}
 }finally{prBusy=false;}if(PRQ.some(x=>x.status==='pendiente'))setTimeout(printPump,300);}
function browserPrint(sale){const html=ticketHTML(sale);if(typeof window.print!=='function'||window.__noPrint){window.__lastTicket=html;return;}
 const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);f.contentDocument.open();f.contentDocument.write(html);f.contentDocument.close();
 setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){}setTimeout(()=>f.remove(),4000);},250);}

/* ---------- conexión: USB, serie, Bluetooth, Windows, simulado ---------- */
function usbClass(dev){let cls=[];(dev.configurations||[]).forEach(c=>c.interfaces.forEach(i=>i.alternates.forEach(a=>cls.push(a.interfaceClass))));return cls;}
async function usbOpen(dev){await dev.open();if(dev.configuration===null)await dev.selectConfiguration(1);let ep=null,ifn=null;
 for(const i of dev.configuration.interfaces){const a=i.alternates[0];if(a.interfaceClass===7||!ifn){const out=a.endpoints.find(e=>e.direction==='out');if(out){ep=out.endpointNumber;ifn=i.interfaceNumber;if(a.interfaceClass===7)break;}}}
 if(ifn===null)throw new Error('El dispositivo no tiene salida de datos');await dev.claimInterface(ifn);return{dev,ep,ifn};}
async function devUsb(){if(!devHas.usb)return toast('Este navegador no tiene WebUSB (usá Chrome o Edge en Windows/Android).',1);
 let dev;try{dev=await navigator.usb.requestDevice({filters:[]});}catch(e){return toast('No se eligió ningún dispositivo.',1);}
 const cls=usbClass(dev);const type=cls.includes(7)?'printer_thermal':'other';const id='usb:'+dev.vendorId.toString(16)+':'+dev.productId.toString(16);
 try{const h=await usbOpen(dev);DEV.usb[id]=h;}catch(e){toast('No se pudo abrir: '+(e.message||e)+'. Si Windows ya maneja esta impresora con su driver, usá "Impresora de Windows (1 clic)".',1);return;}
 const d=devAdd({id,type,name:((dev.manufacturerName||'')+' '+(dev.productName||'USB')).trim(),conn:'usb',vid:dev.vendorId,pid:dev.productId,status:'conectado',lastSeen:now(),sector:'caja',tested:false});
 audit('DISPOSITIVO_ALTA',d.name+' ('+d.conn+')');save();devTag();toast('Reconocido: '+d.name);if(type==='printer_thermal')devTest(d.id);rerender();}
function devSerialModal(){if(!devHas.serial)return toast('Este navegador no tiene Web Serial (usá Chrome o Edge).',1);
 modal('Conectar por puerto serie / USB-Serie',`<label for="sr-t">¿Qué dispositivo es?</label><select id="sr-t"><option value="scale">Balanza digital</option><option value="printer_thermal">Impresora térmica</option><option value="scanner">Lector de código de barras (serie)</option></select><label for="sr-b">Velocidad (baudios)</label><select id="sr-b">${[9600,19200,38400,57600,115200].map(b=>`<option ${b===9600?'selected':''}>${b}</option>`).join('')}</select><p class="sm mut">El navegador te va a pedir elegir el puerto: es una exigencia de seguridad y se hace una sola vez. Protocolo de la balanza: genérico (línea de texto con el peso); cada marca puede variar [VERIFICAR].</p>`,
 {okText:'Elegir puerto',onOk:async w=>{const type=val('sr-t'),baud=+val('sr-b');let port;try{port=await navigator.serial.requestPort();}catch(e){toast('No se eligió ningún puerto.',1);return;}
  try{await port.open({baudRate:baud});}catch(e){toast('No se pudo abrir el puerto: '+(e.message||e),1);return;}
  const info=port.getInfo?port.getInfo():{};const id='serial:'+(info.usbVendorId||0).toString(16)+':'+(info.usbProductId||0).toString(16)+':'+Object.keys(DEV.serial).length;DEV.serial[id]={port,baud};
  devAdd({id,type,name:(type==='scale'?'Balanza':type==='scanner'?'Lector':'Impresora')+' (serie '+baud+')',conn:'serial',vid:info.usbVendorId||0,pid:info.usbProductId||0,baud,status:'conectado',lastSeen:now(),sector:'caja'});
  audit('DISPOSITIVO_ALTA',type+' serie');save();devTag();if(type==='scale')scaleListen(id);toast('Puerto conectado');rerender();}});}
async function devBle(){if(!devHas.ble)return toast('Este navegador no tiene Web Bluetooth (en iPhone/iPad no existe).',1);
 let dev;try{dev=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:['000018f0-0000-1000-8000-00805f9b34fb','e7810a71-73ae-499d-8c15-faa9aef0c3f2']});}catch(e){return toast('No se eligió ningún dispositivo.',1);}
 try{const srv=await dev.gatt.connect();let ch=null;for(const s of await srv.getPrimaryServices()){for(const c of await s.getCharacteristics()){if(c.properties.writeWithoutResponse||c.properties.write){ch=c;break;}}if(ch)break;}
  if(!ch)throw new Error('sin característica de escritura');const id='ble:'+dev.id;DEV.ble[id]={dev,ch};devAdd({id,type:'printer_thermal',name:dev.name||'Impresora Bluetooth',conn:'ble',status:'conectado',lastSeen:now(),sector:'caja'});audit('DISPOSITIVO_ALTA',(dev.name||'BLE')+' bluetooth');save();devTag();devTest(id);rerender();}
 catch(e){toast('No se pudo conectar: '+(e.message||e)+' [VERIFICAR compatibilidad del modelo]',1);}}
function devWin(){devAdd({id:'win-default',type:'printer_windows',name:'Impresora predeterminada de Windows',conn:'windows',status:'conectado',lastSeen:now(),sector:'caja'});audit('DISPOSITIVO_ALTA','Impresora de Windows');save();devTag();devTest('win-default');rerender();}
function devSimScale(){devAdd({id:'sim-scale',type:'scale',name:'Balanza SIMULADA (demo)',conn:'simulada',status:'conectado',sim:true,lastSeen:now(),sector:'caja'});save();devTag();toast('Balanza simulada conectada: sólo para evaluar el flujo');rerender();}
function devQuitar(id){const d=devById(id);if(!d)return;if(d.conn==='usb'&&DEV.usb[id]){try{DEV.usb[id].dev.close();}catch(e){}delete DEV.usb[id];}if(d.conn==='serial'&&DEV.serial[id]){try{DEV.serial[id].port.close();}catch(e){}delete DEV.serial[id];}
 S.devices.list=devList().filter(x=>x.id!==id);audit('DISPOSITIVO_BAJA',d.name);save();devTag();}
async function devTest(id){const d=devById(id);if(!d)return;const sale={id:'test',n:'PRUEBA',ts:now(),user:user?user.name:'sistema',caja:S.tenant.caja,items:[{name:'Producto de prueba',qty:1,price:123450,disc:0}],total:123450,method:'efectivo',recv:150000,doc:'ticket_interno',cust:'',fiado:false,benefit:null};
 if(d.type.startsWith('printer')){try{if(d.type==='printer_windows'){browserPrint(sale);}else await devSend(d,await escposTicket(sale));d.tested=true;audit('DISPOSITIVO_PRUEBA',d.name);save();toast('Hoja de prueba enviada a '+d.name);}catch(e){toast('Falló la prueba: '+(e.message||e),1);}}
 else if(d.type==='scale'){const w=await scaleRead(3000);toast(w?'Peso leído: '+numAR(w,3)+' kg':'No se obtuvo un peso estable.',!w);}
 rerender();}
/* reconexión automática (al abrir, al enchufar y cada 30 s) + aviso si se desconecta */
async function devReconnect(){try{
 if(devHas.usb){const gr=await navigator.usb.getDevices();for(const dev of gr){const id='usb:'+dev.vendorId.toString(16)+':'+dev.productId.toString(16);const d=devById(id);if(!d)continue;if(!dev.opened){try{DEV.usb[id]=await usbOpen(dev);devSet(id,'conectado');}catch(e){devSet(id,'desconectado');}}else devSet(id,'conectado');}}
 if(devHas.serial){const ps=await navigator.serial.getPorts();for(const port of ps){const info=port.getInfo?port.getInfo():{};const d=devList().find(x=>x.conn==='serial'&&x.vid===(info.usbVendorId||0)&&x.pid===(info.usbProductId||0)&&!DEV.serial[x.id]);if(d){try{await port.open({baudRate:d.baud||9600});DEV.serial[d.id]={port,baud:d.baud};devSet(d.id,'conectado');if(d.type==='scale')scaleListen(d.id);}catch(e){}}}}
 }catch(e){}}
function devHeartbeat(){devList().forEach(d=>{if(d.sim||d.conn==='windows'||d.conn==='teclado')return;let ok=false;if(d.conn==='usb')ok=!!(DEV.usb[d.id]&&DEV.usb[d.id].dev.opened);else if(d.conn==='serial')ok=!!DEV.serial[d.id];else if(d.conn==='ble')ok=!!(DEV.ble[d.id]&&DEV.ble[d.id].dev.gatt&&DEV.ble[d.id].dev.gatt.connected);
 if(d.status==='conectado'&&!ok){d.status='desconectado';toast('Se desconectó: '+d.name,1);audit('DISPOSITIVO_DESCONECTADO',d.name);}else if(d.status!=='conectado'&&ok)d.status='conectado';});devTag();devChips();}
function devBoot(){devTag();devReconnect();clearInterval(DEV.hb);DEV.hb=setInterval(()=>{devReconnect();devHeartbeat();},30000);
 if(devHas.usb){navigator.usb.addEventListener('connect',devReconnect);navigator.usb.addEventListener('disconnect',()=>setTimeout(devHeartbeat,200));}}
/* botón único */
async function devAuto(){if(devHas.usb)return devUsb();if(devHas.serial)return devSerialModal();if(devHas.ble)return devBle();toast('Este navegador no permite conectar dispositivos (WebUSB/Serie/Bluetooth). Usá Chrome o Edge, o la impresora de Windows.',1);}

/* ---------- balanza ---------- */
function parseScale(line){const s=String(line||'').trim();if(!s)return null;const m=/([-+]?\d{1,3}(?:[.,]\d{1,4})?)\s*(kg|g|KG|G)?/.exec(s);if(!m)return null;let v=parseFloat(m[1].replace(',','.'));if(!isFinite(v))return null;const u=(m[2]||'kg').toLowerCase();if(u==='g')v=v/1000;
 if(!(v>0&&v<=50))return null;return{kg:Math.round(v*1000)/1000,stable:!/^\s*(US|D|\?)/i.test(s)};}
async function scaleListen(id){const h=DEV.serial[id];if(!h||h.listening)return;h.listening=true;try{const dec=new TextDecoderStream();h.port.readable.pipeTo(dec.writable).catch(()=>{});const rd=dec.readable.getReader();let buf='';
 for(;;){const{value,done}=await rd.read();if(done)break;buf+=value;const ls=buf.split(/[\r\n]+/);buf=ls.pop();ls.forEach(l=>{const p=parseScale(l);if(p){DEV.scale.last=p;DEV.scale.samples.push(p.kg);if(DEV.scale.samples.length>4)DEV.scale.samples.shift();}});}}catch(e){}h.listening=false;}
function scaleRead(timeout){return new Promise(res=>{const t0=Date.now();const iv=setInterval(()=>{const s=DEV.scale.samples;if(s.length>=3&&s.slice(-3).every(x=>x===s[s.length-1])&&DEV.scale.last&&DEV.scale.last.stable){clearInterval(iv);res(s[s.length-1]);}else if(Date.now()-t0>(timeout||3000)){clearInterval(iv);res(null);}},150);});}
A.pesar=async el=>{const i=+el.dataset.i;const L=pos.lines[i];if(!L)return;const d=devList().find(x=>x.type==='scale'&&x.status==='conectado');if(!d)return toast('No hay balanza conectada.',1);
 if(d.sim){modal('Balanza simulada',`<p class="sm mut">Simula el peso estable que informaría la balanza (sólo para evaluar el flujo).</p><label for="bs-w">Peso (kg)</label><input id="bs-w" inputmode="decimal" placeholder="0,000" autocomplete="off">`,{okText:'Usar este peso',onOk:w=>{const p=parseScale(val('bs-w')+' kg');if(!p)return w._err('Peso fuera de rango (0 a 50 kg).'),false;lineEdit(i,'qty',String(p.kg));}});return;}
 const w=await scaleRead(3000);if(!w)return toast('No se obtuvo un peso estable. Reintentá con la balanza quieta.',1);lineEdit(i,'qty',String(w));};

/* ================= PANTALLA: PERIFÉRICOS Y TICKET ================= */
reg('dispositivos','Periféricos y ticket','plug','devices',()=>{const cfg=S.cfg.ticket;const samp={id:'demo',n:S.tenant.caja+'-15',ts:now(),user:user.name,caja:S.tenant.caja,items:[{name:'Gin Beefeater + Cunnington Tónica (2.25 lt)',qty:1,price:3300000,disc:0},{name:'Pachamama',qty:2,price:700000,disc:70000}],total:4630000,method:'efectivo',recv:5000000,doc:'ticket_interno',cust:'',fiado:false,benefit:{label:'Cupón BIENVENIDA10',disc:70000}};
 const dv=devList();
 return `<div class="row"><h1 class="sp">Periféricos y ticket</h1><button class="btn gold" data-act="devAuto">Conectar y reconocer (automático)</button></div>
 <div class="warnbox sm"><b>Hardware sin probar:</b> esta versión trae los conectores (USB, serie, Bluetooth, impresora de Windows) pero <b>no se probó con equipos reales</b>. Cada impresora, balanza y lector se prueba físicamente antes de comprometerse [VERIFICAR por marca y modelo]. El navegador siempre pide elegir el dispositivo una vez (es una exigencia de seguridad); después se reconecta solo al abrir, al enchufar y cada 30 s. Impresoras de red (TCP 9100), descubrimiento y NFC PC/SC requieren un agente local (etapa futura).</div>
 <div class="grid g2"><div class="card"><h3>Conectar</h3><div class="row"><button class="btn" data-act="devWin">Impresora de Windows (1 clic)</button><button class="btn" data-act="devUsb">Impresora térmica USB</button><button class="btn" data-act="devSerial">Balanza / lector (serie)</button><button class="btn" data-act="devBle">Impresora Bluetooth</button><button class="btn" data-act="devSimScale">Balanza simulada (demo)</button></div>
  <p class="sm mut" style="margin-top:.6rem">Disponible en este navegador: USB ${devHas.usb?'✔':'✘'} · Serie ${devHas.serial?'✔':'✘'} · Bluetooth ${devHas.ble?'✔':'✘'}. iPhone/iPad (Safari): ninguna de las tres; usar impresora por red o Bluetooth LE con agente [VERIFICAR]. Android: USB OTG y Bluetooth con Chrome.</p>
  <p class="sm"><b>Lector de código de barras:</b> funciona sin configurar (modo teclado): el sistema distingue una lectura rápida de una persona tecleando. Etiquetas EAN-13 de balanza (prefijo 2 + PLU + peso o precio) soportadas [VERIFICAR el formato de cada balanza].</p></div>
 <div class="card"><h3>Dispositivos registrados</h3><div class="tw"><table><thead><tr><th>Dispositivo</th><th>Tipo</th><th>Estado</th><th></th></tr></thead><tbody>
  <tr><td>Lector de código de barras (teclado)</td><td>Lector</td><td><span class="tag ok">listo</span></td><td></td></tr>
  ${dv.map(d=>`<tr><td>${esc(d.name)}${d.sim?' <span class="tag sim">simulado</span>':''}<div class="sm mut">${esc(d.conn)} · sector ${esc(d.sector||'caja')}${d.tested?' · probado':''}</div></td><td>${esc(DEV_TYPES[d.type]||d.type)}</td><td><span class="tag ${d.status==='conectado'?'ok':'bad'}">${esc(d.status)}</span></td><td class="r"><button class="btn sm" data-act="devTestB" data-id="${d.id}">Probar</button> <button class="btn sm red" data-act="devDel" data-id="${d.id}">Quitar</button></td></tr>`).join('')}</tbody></table></div></div></div>
 <div class="grid g2" style="margin-top:1rem"><div class="card"><h3>Ticket del cliente</h3><label for="tk-m">Mensaje al pie</label><input id="tk-m" maxlength="120" value="${esc(cfg.msg)}">
  <div class="grid g2"><div><label for="tk-w">Ancho de papel</label><select id="tk-w"><option value="80" ${cfg.w===80?'selected':''}>80 mm</option><option value="58" ${cfg.w===58?'selected':''}>58 mm</option></select></div><div><label for="tk-cu">CUIT (si ya está definido)</label><input id="tk-cu" maxlength="13" placeholder="sin cargar" value="${esc(S.tenant.cuit)}"></div></div>
  <label for="tk-iv">Condición frente al IVA (texto del ticket)</label><input id="tk-iv" maxlength="60" placeholder="Ej.: Responsable Monotributo [completar]" value="${esc(S.tenant.iva)}"><label for="tk-ph">Teléfono / WhatsApp que se imprime</label><input id="tk-ph" maxlength="30" value="${esc(S.tenant.phone)}">
  <label class="chk"><input type="checkbox" id="tk-lo" ${cfg.showLogo?'checked':''}> Imprimir el logo de RAVE</label><label class="chk"><input type="checkbox" id="tk-lg" ${cfg.legal?'checked':''}> Imprimir leyendas legales (consumidor, +18)</label>
  <div class="row" style="margin-top:.6rem"><button class="btn gold" data-act="tkSave">Guardar</button><button class="btn" data-act="tkTest">Imprimir ticket de prueba</button></div><p class="sm mut">El ticket sin CAE dice "DOCUMENTO NO VÁLIDO COMO FACTURA". CUIT y condición fiscal los completa el dueño; no se inventan.</p></div>
 <div class="card"><h3>Vista previa (${cfg.w} mm)</h3><div style="background:#fff;border:1px dashed #cfc7b9;border-radius:10px;padding:10px;text-align:center"><img src="${LOGO_TICKET}" alt="Logo RAVE" style="width:190px;${cfg.showLogo?'':'display:none'}"></div><pre class="rep" id="tk-pre" style="margin-top:.5rem;font-size:11.5px">${esc(ticketText(samp))}</pre></div></div>
 ${typeof arcaCardHtml==='function'?arcaCardHtml():''}
 <div class="card" style="margin-top:1rem"><h3>Cola de impresión</h3>${PRQ.length?`<div class="tw"><table><tbody>${PRQ.slice().reverse().slice(0,8).map(j=>`<tr><td>${esc(j.sale.n)}</td><td><span class="tag ${j.status==='ok'?'ok':j.status==='fallido'?'bad':'warn'}">${j.status}</span></td><td class="sm">${esc(j.via||j.err||'')}</td><td class="r"><button class="btn sm" data-act="prRe" data-k="${esc(j.key)}">Reimprimir</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="mut sm">Sin impresiones en esta sesión.</p>'}<p class="sm mut">La cola reintenta hasta 3 veces y no duplica el ticket de una misma venta (la reimpresión es manual).</p></div>`;},
 ()=>{devChips();if(typeof arcaCardInit==='function')arcaCardInit();},'Sistema');
A.devAuto=devAuto;A.devWin=devWin;A.devUsb=devUsb;A.devSerial=devSerialModal;A.devBle=devBle;A.devSimScale=devSimScale;A.devTestB=el=>devTest(el.dataset.id);A.devDel=el=>{devQuitar(el.dataset.id);rerender();};
A.tkSave=()=>{const c=S.cfg.ticket;c.msg=val('tk-m').trim();c.w=+val('tk-w');c.showLogo=$('#tk-lo').checked;c.legal=$('#tk-lg').checked;S.tenant.cuit=val('tk-cu').trim();S.tenant.iva=val('tk-iv').trim();S.tenant.phone=val('tk-ph').trim();audit('CONFIG_TICKET','guardado');save();toast('Ticket guardado');rerender();};
A.tkTest=()=>{const sale={id:'test',n:'PRUEBA',ts:now(),user:user.name,caja:S.tenant.caja,items:[{name:'Producto de prueba',qty:1,price:123450,disc:0}],total:123450,method:'efectivo',recv:150000,doc:'ticket_interno',cust:'',fiado:false,benefit:null};printSale('test',{sale,reprint:true});};
A.prRe=el=>{const j=PRQ.find(x=>x.key===el.dataset.k);if(j){printSale(j.sale.id,{sale:j.sale,reprint:true});setTimeout(rerender,600);}};
A.printLast=()=>{const s=S.sales.find(x=>x.id===S.lastSale);if(s)printSale(s.id,{reprint:true});};
