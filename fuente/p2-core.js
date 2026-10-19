'use strict';
/* ===== Sistema RAVE · Demo de evaluación · Vincular Business ===== */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const now=()=>window.__now?window.__now():Date.now();
const A={}; // acciones (data-act)

/* ---------- SHA-256 síncrono ---------- */
const sha256=(()=>{const K=[],H0=[];let n=2,c=0;
while(c<64){let p=true;for(let i=2;i*i<=n;i++)if(n%i===0){p=false;break;}
 if(p){if(c<8)H0.push(Math.floor((Math.sqrt(n)%1)*4294967296));K.push(Math.floor((Math.cbrt(n)%1)*4294967296));c++;}n++;}
return s=>{const by=new TextEncoder().encode(s),l=by.length,tot=((l+9+63)>>6)<<6,m=new Uint8Array(tot);m.set(by);m[l]=0x80;
 const dv=new DataView(m.buffer);dv.setUint32(tot-8,Math.floor(l*8/4294967296));dv.setUint32(tot-4,(l*8)>>>0);
 let h=H0.slice();const w=new Uint32Array(64);
 for(let o=0;o<tot;o+=64){for(let i=0;i<16;i++)w[i]=dv.getUint32(o+i*4);
  for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];const s0=((x>>>7)|(x<<25))^((x>>>18)|(x<<14))^(x>>>3);const s1=((y>>>17)|(y<<15))^((y>>>19)|(y<<13))^(y>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
  let [a,b,cc,d,e,f,g,hh]=h;
  for(let i=0;i<64;i++){const S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));const ch=(e&f)^(~e&g);const t1=(hh+S1+ch+K[i]+w[i])>>>0;
   const S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));const mj=(a&b)^(a&cc)^(b&cc);const t2=(S0+mj)>>>0;
   hh=g;g=f;f=e;e=(d+t1)>>>0;d=cc;cc=b;b=a;a=(t1+t2)>>>0;}
  h=[h[0]+a,h[1]+b,h[2]+cc,h[3]+d,h[4]+e,h[5]+f,h[6]+g,h[7]+hh].map(x=>x>>>0);}
 return h.map(x=>x.toString(16).padStart(8,'0')).join('');};})();

/* ---------- Dinero (centavos enteros) y números ---------- */
const money=c=>{const neg=c<0;c=Math.abs(Math.round(c));const p=Math.floor(c/100),r=c%100;let s=String(p).replace(/\B(?=(\d{3})+(?!\d))/g,'.');if(r)s+=','+String(r).padStart(2,'0');return (neg?'- ':'')+'$ '+s;};
const numAR=(n,d=2)=>{const s=(+n).toFixed(d).replace(/\.?0+$/,'');const [i,f]=s.split('.');return i.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(f?','+f:'');};
function parseNum(v){if(typeof v==='number')return v;let s=String(v??'').trim().replace(/[$\s]/g,'');if(!s)return NaN;
 if(s.includes(',')){s=s.replace(/\./g,'').replace(',','.');}
 else if((s.match(/\./g)||[]).length>1){s=s.replace(/\./g,'');}
 else if(/^\d{1,3}\.\d{3}$/.test(s)&&!/^0\./.test(s)){s=s.replace('.','');}
 if(!/^-?\d*\.?\d+$/.test(s))return NaN;return parseFloat(s);}
const cents=v=>{const n=parseNum(v);return isNaN(n)?NaN:Math.round(n*100);};
const pesosStr=c=>c?String(c/100).replace('.',','):'';
const split=(total,n)=>{if(n<=0)return[];const b=Math.trunc(total/n);const r=total-b*n;return Array.from({length:n},(_,i)=>b+(i===0?r:0));};
const numIn=(id,c,ph='0',extra='')=>`<input id="${id}" inputmode="decimal" autocomplete="off" placeholder="${ph}" value="${c?esc(pesosStr(c)):''}" ${extra}>`;
const val=id=>{const e=document.getElementById(id);return e?e.value:'';};

/* ---------- Fechas (zona del comercio) ---------- */
const TZ='America/Argentina/Salta';
const fDay=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'});
const fPar=new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
const fDT=new Intl.DateTimeFormat('es-AR',{timeZone:TZ,day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const fHM=new Intl.DateTimeFormat('es-AR',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false});
const dkey=ts=>fDay.format(ts);
const lparts=ts=>{const p={};fPar.formatToParts(ts).forEach(x=>p[x.type]=x.value);return{dow:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday),h:(+p.hour)%24,m:+p.minute};};
const DIAS=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const dmy=k=>{const [y,m,d]=k.split('-');return (+d)+'/'+(+m)+'/'+y.slice(2);};
const fmtDT=ts=>fDT.format(ts).replace(',','');
const hm=ts=>fHM.format(ts);
const dowOfKey=k=>new Date(k+'T12:00:00Z').getUTCDay();
const addDays=(k,n)=>{const d=new Date(k+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};

/* ---------- Estado + persistencia (IndexedDB; demo sin cifrado) ---------- */
const PERMS={sell:'Vender',cash_mov:'Ingresos/egresos de caja',close_cash:'Arqueo y cierre de caja',view_cost:'Ver costos y ganancias',edit_products:'Editar inventario',void:'Anular ventas',impex:'Importar / exportar',staff:'Personal y fichaje (admin)',tasks:'Tareas del personal',integrations:'Integraciones',audit:'Ver auditoría',roles:'Usuarios y permisos',menu_admin:'Administrar menú público',config:'Configuración',customers:'Clientes, fidelización y cupones',devices:'Periféricos y ticket',purchases:'Proveedores y compras',price_lists:'Listas de precio, escalones y acuerdos',credit_ov:'Autorizar excepciones de crédito'};
const SEED_RUBROS=[
 {id:'promo',name:'Combos y promos',owner:'',reparte:false,alcohol:true,kind:'rubro',color:'#c9963e',mNom:'Promos',mTitle:'Menú de Promos de Bebidas',mHint:'',layout:'grid'},
 {id:'vino',name:'Vinos',owner:'',reparte:false,alcohol:true,kind:'rubro',color:'#7b2d3b',mNom:'Vinos',mTitle:'Vinos',mHint:'Por bodega y variedad',layout:'bodegas'},
 {id:'tabaco',name:'Tabaco y accesorios',owner:'',reparte:false,alcohol:false,kind:'rubro',color:'#6b6a5a',mNom:'Tabaco',mTitle:'Cigarrillos y Tabaco',mHint:'',layout:'rows',age:true},
 {id:'cobr',name:'Cobranza de cuenta corriente',owner:'',reparte:false,alcohol:false,kind:'cobr',color:'#2f6f8f'},
 {id:'gen',name:'Gastos generales',owner:'',reparte:false,alcohol:false,kind:'shared',color:'#777'}];
/* costos y stock de la demo: INVENTADOS (el cliente no los publicó). Costo ≈ 72 % del precio; se reemplazan al cargar el inventario real. */
function seedProducts(){return SEED_PRODS.map((p,i)=>({id:p.id,name:p.nom,sub:p.sub,grupo:p.grupo,rubro:p.cat,price:p.precio*100,cost:Math.round(p.precio*72)*1,stock:(i%7===0?3:10+((i*7)%26)),unit:'u',barcode:p.bc,plu:'',menu:true,active:true,desc:p.desc||'',featured:!!p.destacado,demo:true}))
 .concat([{id:'granel-1',name:'Maní con cáscara a granel',sub:'ejemplo para probar la balanza',grupo:'',rubro:'promo',price:850000,cost:610000,stock:12.5,unit:'kg',barcode:'',plu:'12',menu:false,active:true,desc:'',demo:true}]);}
const BUILD_VER=(typeof window!=='undefined'&&window.RAVE_BUILD&&window.RAVE_BUILD.ver)||'sin dato';
const IS_CLIENT=!!(typeof window!=='undefined'&&window.RAVE_BUILD&&window.RAVE_BUILD.variant==='cliente');
const DEF=()=>{const d=DEF0();return IS_CLIENT?clientClean(d):wsDemoSeed(d);};
/* DEMO: canal mayorista encendido con datos rotulados «ejemplo» (el sistema del cliente nace apagado y sin esto) */
function wsDemoSeed(d){d.cfg=d.cfg||{};if(!d.cfg.wholesale)d.cfg.wholesale={on:true,example:true,allowClub:false,grace:0,levels:[{id:'d',name:'Display'},{id:'f',name:'Fardo'},{id:'p',name:'Pallet'}]};
 wsDemoPres(d.products);d.cfg.wholesale.seeded=1;return wsDemoCust(d);}
/* presentaciones de ejemplo: Display ×6, Fardo ×24 y Pallet ×480 con precio por unidad decreciente (sólo productos por unidad, sin tabaco) */
function wsDemoPres(prods){const el=(prods||[]).filter(p=>p.unit==='u'&&p.rubro!=='tabaco'&&!p.archived&&p.price>0);const ok=el.filter(p=>p.rubro==='vino').concat(el.filter(p=>p.rubro!=='vino'&&p.rubro!=='promo'),el.filter(p=>p.rubro==='promo'));const r100=x=>Math.round(x/100)*100;
 ok.slice(0,4).forEach((p,i)=>{if(p.pres)return;
  p.pres=[{lv:'d',qty:6,unit:r100(p.price*0.92),barcode:''},{lv:'f',qty:24,unit:r100(p.price*0.85),barcode:''},{lv:'p',qty:480,unit:r100(p.price*0.78),barcode:''}];
  if(i===2)p.floor=r100(p.price*0.7);if(i===3)p.wsEx=1;});}
/* modelo anterior (listas L1–L5, escalones, bultos) → presentaciones */
function wsMigrate(st){if(!st.cfg||!st.cfg.wholesale)return;const w=st.cfg.wholesale;
 if(w.lists!==undefined)delete w.lists;if(!Array.isArray(w.levels))w.levels=[{id:'d',name:'Display'},{id:'f',name:'Fardo'},{id:'p',name:'Pallet'}];
 (st.products||[]).forEach(p=>{if(p.prices!==undefined)delete p.prices;if(p.tiers!==undefined)delete p.tiers;if(p.packs!==undefined)delete p.packs;});
 (st.customers||[]).forEach(c=>{if(c.list!==undefined)delete c.list;});
 if(w.example&&!IS_CLIENT&&!w.seeded){wsDemoPres(st.products);w.seeded=1;}}
/* cliente y acuerdo de ejemplo (la demo recrea sus clientes al sembrar, por eso va aparte) */
function wsDemoCust(d){const r100=x=>Math.round(x/100)*100;
 d.customers=d.customers||[];if(!d.customers.some(x=>x.example)){const t=now();d.customers.push({id:'cw-ejemplo-demo',num:d.customers.reduce((m,x)=>Math.max(m,x.num||0),0)+1,name:'Distribuidora',last:'Ejemplo (demo)',birth:'1980-01-01',wa:'+5493875550100',dni:'',cards:[],cardSecrets:{},origin:'ejemplo',consent:{club:true,comm:false,analytics:false,version:'v1-2026-demo',ts:t},ts:t,status:'activo',limit:50000000,secret:'demo-secret-ejemplo-0000',notes:'Cliente de ejemplo del canal mayorista',channel:'mayorista',taxid:'20123456786',term:15,zone:'Salta capital',seller:'',example:true});}
 d.agreements=d.agreements||[];const e=d.products.find(p=>p.wsEx===1);if(e&&!d.agreements.some(x=>x.example)){d.agreements.push({id:'ag-ejemplo-demo',cust:'cw-ejemplo-demo',pid:e.id,price:r100(e.price*0.8),pct:0,from:'',to:'',active:true,by:'ejemplo',ts:now(),example:true});}
 return d;}
/* La copia del CLIENTE nace limpia: sin costos ni stock inventados, sin usuarios/PIN de prueba, sin cupones, planes, Wi-Fi ni redes "de ejemplo". */
function clientClean(d){d.products=d.products.filter(p=>!/granel-1/.test(p.id)).map(p=>{const q=Object.assign({},p);q.cost=0;q.stock=0;delete q.demo;return q;});
 d.cfg.tax={};d.employees=[];d.users=[];d.tasks=d.tasks.slice();d.coupons=[];d.plans=[];d.customers=[];
 d.loyalty.reward='A definir por el comercio';d.menu.wifi={on:false,ssid:'',pass:'',example:false};d.menu.social=(d.menu.social||[]).filter(x=>!x.example);
 d.cfg.ticket.msg='¡Gracias por tu compra!';return d;}
const DEF0=()=>({v:3,
 tenant:{name:'RAVE',legal:'Almacén y Licorería RAVE',slogan:'Almacén y Licorería · Salta',wa:'5493874574892',address:'Urquiza 1052, Salta, Argentina',phone:'(387) 4 57 48 92',cuit:'',iva:'',caja:1,ig:'RAVE_LICORERIA',fb:'LICORERIA_RAVE'},
 rubros:SEED_RUBROS.map(r=>({...r})),branches:[],registers:[],transfers:[],
 cfg:{cashProfile:'simple',negStock:true,tax:{promo:3000000,vino:3000000},fee:{qr:0,modo:0,debito:0,credito:0,pedidosya:0},movAffectProfit:true,payFromCash:true,scaleMode:'peso',ticket:{w:80,msg:'¡Gracias por tu compra! Seguinos en Instagram @rave_licoreria',showLogo:true,legal:true}},
 products:seedProducts(),
 sales:[],sessions:[],movs:[],closures:[],seq:{},
 suppliers:[],pOrders:[],receipts:[],supLedger:[],
 employees:[{id:'e1',name:'Empleado 1',puestoId:'pu_most',rate:250000,pin:'1234',active:true},{id:'e2',name:'Empleado 2',puestoId:'pu_most',rate:250000,pin:'4321',active:true}],
 punches:[],
 puestos:[{id:'pu_soc',name:'Socios / dueños',parent:'',holders:''},{id:'pu_most',name:'Mostrador',parent:'pu_soc',holders:''},{id:'pu_dep',name:'Depósito y reposición',parent:'pu_soc',holders:''}],
 tasks:[
  {id:'t1',title:'Limpiar vitrinas y heladeras',puestoId:'pu_most',freq:'daily',active:true},
  {id:'t2',title:'Reponer bebidas frías',puestoId:'pu_most',freq:'daily',active:true},
  {id:'t3',title:'Control de fechas de vencimiento',puestoId:'pu_most',freq:'weekly',dow:1,active:true},
  {id:'t4',title:'Pedido a proveedores (vinos y promos)',puestoId:'pu_dep',freq:'weekly',dow:5,active:true},
  {id:'t5',title:'Limpieza profunda de freezer',puestoId:'pu_dep',freq:'monthly',dom:1,active:true}],
 taskLogs:[],
 users:[{id:'u1',name:'ADMIN',role:'admin',pin:'1234'},{id:'u2',name:'Supervisor',role:'supervisor',pin:'1111'},{id:'u3',name:'Mostrador',role:'mostrador',pin:'0000'}],
 roles:{admin:Object.keys(PERMS),supervisor:['sell','cash_mov','close_cash','view_cost','edit_products','void','impex','tasks','audit','customers','devices','purchases','price_lists','credit_ov'],mostrador:['sell','cash_mov','tasks','customers'],operador:['sell']},
 audit:[],arqDraft:{},batches:[],
 pya:[],events:[],seenEvents:{},simOffline:false,
 arcaRcp:{},
 integ:{arca:{ambiente:'homologacion'},mp:{on:false,mode:'sandbox'},modo:{on:false},pya:{on:false},google:{on:false,account:'',scopes:[],folder:'RAVE Respaldos',gmail:false},wa:{business:false}},
 drive:[],
 customers:[],fiadoPays:[],orderReqs:[],arrep:[],
 loyalty:{goal:10,reward:'Un producto de regalo a elección (hasta $ 5.000) — ejemplo',ledger:[],usedOtp:{}},
 coupons:[
  {id:'cp1',code:'BIENVENIDA10',type:'pct',value:10,min:0,from:'',to:'',maxUses:0,perCust:1,aud:'club',active:true,note:'10 % en tu primera compra (ejemplo)',uses:[]},
  {id:'cp2',code:'CUMPLE15',type:'pct',value:15,min:0,from:'',to:'',maxUses:0,perCust:1,aud:'cumple',active:true,note:'15 % la semana de tu cumpleaños (ejemplo)',uses:[]},
  {id:'cp3',code:'MIL',type:'fixed',value:100000,min:1000000,from:'',to:'',maxUses:0,perCust:0,aud:'todos',active:false,note:'$ 1.000 de descuento en compras desde $ 10.000 (ejemplo, apagado)',uses:[]}],
 plans:[{id:'pl1',name:'Socio Plata',price:300000,period:'mes',pct:5,desc:'5 % de descuento en el mostrador (ejemplo)',active:true}],
 members:[],
 devices:{list:[],scale:{proto:'generico',baud:9600},printer:{kind:'ninguna',w:80},last:null},
 legal:{confirmedBy:'',confirmedAt:0},
 menu:{title:'RAVE DIGITAL',alcFrom:7,alcTo:24,hours:{open:'',close:''},
  sub:{es:'Almacén y Licorería · Salta',en:'Grocery & Liquor store · Salta'},
  promo:{on:true,es:'Comprando **2 combos** o **3 vinos**, el envío es **gratis** dentro del macrocentro y alrededores.',en:'Buy **2 combos** or **3 wines** and delivery is **free** in the downtown area and surroundings.'},
  mapQuery:'Licoreria RAVE, Urquiza 1052, Salta, Argentina',mapUrl:'https://www.google.com/maps/search/?api=1&query=Licoreria+RAVE+Urquiza+1052+Salta+Argentina',reviewUrl:'https://www.google.com/maps/search/?api=1&query=Licoreria+RAVE+Urquiza+1052+Salta+Argentina',
  wifi:{on:true,ssid:'RAVE-Clientes',pass:'rave-demo-2026',example:true},
  social:[{k:'instagram',label:'Instagram',handle:'@rave_licoreria',url:'https://www.instagram.com/rave_licoreria'},{k:'facebook',label:'Facebook',handle:'Licoreria_Rave',url:'https://www.facebook.com/Licoreria_Rave'},{k:'tiktok',label:'TikTok',handle:'@almacen.y.licorer',url:'https://www.tiktok.com/@almacen.y.licorer'},{k:'x',label:'X',handle:'@ejemplo',url:'https://x.com/ejemplo',on:false,example:true},{k:'youtube',label:'YouTube',handle:'@ejemplo',url:'https://www.youtube.com/@ejemplo',on:false,example:true}],
  clubOn:true,pitch:{es:'Comprá tus bebidas —y mucho más— **sin bajarte del auto**. Escaneá este QR y armá tu pedido: **te confirmamos el stock por WhatsApp**, coordinás el pago y te lo alcanzamos en el transcurso de la tarde.',en:'Buy your drinks —and much more— **without leaving your car**. Scan this QR and build your order: **we confirm stock by WhatsApp**, you arrange payment and we bring it to you during the afternoon.'},
  footer:{es:'Almacén y Licorería · Urquiza 1052 · Salta, Argentina',en:'Grocery & Liquor store · Urquiza 1052 · Salta, Argentina'},
  hideTeamBtn:false,version:0,published:null},
 agreements:[],creditOv:[],creditUse:[],
 lastSale:null});
let S=DEF(), user=null;

let CLOUD_HOOK=null;
const PUBLIC_URL=()=>(window.RAVE_BUILD&&window.RAVE_BUILD.publicUrl)||('https://raveholding.github.io/'+((window.RAVE_BUILD&&window.RAVE_BUILD.variant==='cliente')?'AlmacenRAVE/':'raveV2/'));
const DBNAME=(typeof window!=='undefined'&&window.RAVE_BUILD&&window.RAVE_BUILD.db)||'rave-cliente-v3';
function idb(){return new Promise((res,rej)=>{if(typeof indexedDB==='undefined')return rej();const r=indexedDB.open(DBNAME,1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function loadState(){try{const db=await idb();return await new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get('state');q.onsuccess=()=>res(q.result);q.onerror=()=>res(null);});}catch(e){return null;}}
let saveT;function save(){if(CLOUD_HOOK){CLOUD_HOOK.persist();return;}clearTimeout(saveT);saveT=setTimeout(async()=>{try{const db=await idb();db.transaction('kv','readwrite').objectStore('kv').put(JSON.parse(JSON.stringify(S)),'state');}catch(e){}},300);}
/* "Proveedores y compras" es un permiso nuevo: si ningún rol lo tiene todavía (datos anteriores), lo reciben administrador y supervisor; si ya existe, se respeta lo que el dueño decidió */
function rolesMigrate(r){if(!r)return r;for(const perm of['purchases','price_lists','credit_ov']){const any=Object.values(r).some(a=>Array.isArray(a)&&a.includes(perm));if(!any){if(Array.isArray(r.supervisor))r.supervisor.push(perm);if(Array.isArray(r.admin))r.admin.push(perm);}}return r;}
function mergeDefaults(st){const d=DEF();for(const k of Object.keys(d)){if(st[k]===undefined)st[k]=d[k];}rolesMigrate(st.roles);if(!IS_CLIENT&&st.cfg&&st.cfg.wholesale===undefined)wsDemoSeed(st);wsMigrate(st);return st;}

/* ---------- Permisos, auditoría ---------- */
const can=p=>!!user&&(user.role==='admin'||(S.roles[user.role]||[]).includes(p));
function audit(action,detail){const prev=S.audit.length?S.audit[S.audit.length-1].hash:'GENESIS';const e={id:uid(),ts:now(),user:user?user.name:'sistema',action,detail:String(detail||'').slice(0,400),prev};e.hash=sha256(prev+'|'+e.ts+'|'+e.user+'|'+action+'|'+e.detail);S.audit.push(e);save();}
const allAudit=()=>S.auditX&&S.auditX.length?S.audit.concat(S.auditX).sort((a,b)=>a.ts-b.ts):S.audit;
function verifyAudit(){let prev='GENESIS';for(let i=0;i<S.audit.length;i++){const e=S.audit[i];if(e.prev!==prev||e.hash!==sha256(prev+'|'+e.ts+'|'+e.user+'|'+e.action+'|'+e.detail))return i+1;prev=e.hash;}return 0;}

/* ---------- UI helpers ---------- */
function toast(msg,err){const t=document.createElement('div');t.textContent=msg;if(err)t.className='e';$('#toast').appendChild(t);setTimeout(()=>t.remove(),3200);}
function modal(title,body,opt={}){const root=$('#modal-root');const w=document.createElement('div');w.className='ov';
 w.innerHTML=`<div class="dlg ${opt.wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3><div class="mb">${body}</div><div class="merr" role="alert"></div><div class="mf">${opt.noCancel?'':`<button class="btn ghost" data-m="x">${esc(opt.cancelText||'Cancelar')}</button>`}${opt.ok===false?'':`<button class="btn gold" data-m="ok">${esc(opt.okText||'Aceptar')}</button>`}</div></div>`;
 root.appendChild(w);const close=()=>w.remove();
 w.addEventListener('click',async e=>{const b=e.target.closest('[data-m]');if(!b)return;if(b.dataset.m==='x'){close();return;}
  const r=opt.onOk?await opt.onOk(w):true;if(r!==false)close();});
 w._err=m=>{w.querySelector('.merr').textContent=m||'';};
 setTimeout(()=>{const f=w.querySelector('input,select,textarea,button');f&&f.focus();},30);
 return w;}
function confirmBox(title,msg,onYes,okText='Confirmar'){return modal(title,`<p>${msg}</p>`,{okText,onOk:()=>{onYes();}});}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const o=$$('#modal-root .ov');if(o.length)o[o.length-1].remove();}});
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el||el.disabled)return;const f=A[el.dataset.act];if(f){e.preventDefault();f(el,e);}});
/* campos numéricos: todo seleccionado al entrar (también con mouse) */
let _md=false;
document.addEventListener('focusin',e=>{const t=e.target;if(t&&t.matches&&t.matches('input[inputmode="decimal"],input[inputmode="numeric"]'))setTimeout(()=>{try{t.select();}catch(_){}},0);});
document.addEventListener('mousedown',e=>{_md=!!(e.target.matches&&e.target.matches('input[inputmode="decimal"],input[inputmode="numeric"]')&&document.activeElement!==e.target);});
document.addEventListener('mouseup',e=>{if(_md){e.preventDefault();_md=false;try{e.target.select();}catch(_){}}});

function download(name,content,type){const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
const cell=v=>{if(typeof v==='number')return String(v).replace('.',',');let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[;"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
function toCSV(h,rows){return '﻿'+[h,...rows].map(r=>r.map(cell).join(';')).join('\r\n');}
function toXLS(h,rows){const f=v=>{let s=typeof v==='number'?String(v):String(v??'');if(typeof v!=='number'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return esc(s);};
 return '﻿<html><head><meta charset="utf-8"></head><body><table border="1"><tr>'+h.map(x=>`<th>${esc(x)}</th>`).join('')+'</tr>'+rows.map(r=>'<tr>'+r.map(v=>`<td>${f(v)}</td>`).join('')+'</tr>').join('')+'</table></body></html>';}
/* ===== Datos oficiales del desarrollador (se mantienen en TODOS los productos) ===== */
const VB={name:'VINCULAR BUSINESS',phone:'(387) 4484132',wa:'5493874484132',mail:'vincularbusiness@gmail.com',lema:'Tu idea, en buenas manos.'};
const vbWa=txt=>'https://wa.me/'+VB.wa+(txt?'?text='+encodeURIComponent(txt):'');
const vbBanner=(st)=>`<div class="vbb" style="position:relative;max-width:${st||'520px'};margin:0 auto"><img src="${VB_BANNER}" alt="Vincular Business · Digitalización, software de gestión y fidelización para comercios y servicios de Argentina · Único celular ${VB.phone} · ${VB.mail}" loading="lazy" width="1200" height="669" style="display:block;width:100%;height:auto;border-radius:12px"><a class="vbb-a" href="${vbWa('Hola Vincular Business! Quiero consultar por el Sistema RAVE.')}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp ${VB.phone}" style="position:absolute;left:5.2%;top:85%;width:24.9%;height:8.5%;border-radius:999px"></a><a class="vbb-a" href="mailto:${VB.mail}" aria-label="Correo ${VB.mail}" style="position:absolute;left:31.8%;top:85%;width:44%;height:8.5%;border-radius:999px"></a></div>`;
const vbButtons=()=>`<div class="vbbtns" style="display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;margin-top:.6rem"><a class="btn sm" style="background:#25D366;color:#fff;min-height:48px;display:inline-flex;align-items:center;text-decoration:none" href="${vbWa('Hola Vincular Business! Quiero consultar por el Sistema RAVE.')}" target="_blank" rel="noopener noreferrer">💬 WhatsApp ${VB.phone}</a><a class="btn sm" style="min-height:48px;display:inline-flex;align-items:center;text-decoration:none" href="tel:+${VB.wa}">📞 Llamar</a><a class="btn sm" style="min-height:48px;display:inline-flex;align-items:center;text-decoration:none" href="mailto:${VB.mail}">✉️ Correo</a></div>`;
const vbFooter=(withBanner)=>`<div class="vbcred" style="margin-top:1rem">${withBanner?vbBanner()+vbButtons():''}<p class="sm mut" style="margin:.5rem 0 0;text-align:center">Desarrollado por <b>${VB.name}</b> · Único celular ${VB.phone} · ${VB.mail}<br><i>“${VB.lema}”</i></p></div>`;
const MET={efectivo:'Efectivo',fiado:'Cta. cte. / Fiado',mixto:'Pago mixto',debito:'Débito',credito:'Crédito',transferencia:'Transferencia',qr:'QR / Mercado Pago',modo:'MODO',pedidosya:'PedidosYa'};
const rubName=id=>(S.rubros.find(r=>r.id===id)||{name:'(sin rubro)'}).name;
const rub=id=>S.rubros.find(r=>r.id===id);
const UNITS={u:'und',kg:'kg',l:'lt'};const unitLbl=u=>UNITS[u]||u;
const negOK=()=>S.cfg.negStock!==false;
const canOver=p=>negOK()&&!(p&&p.needStock);
const stockTxt=p=>(p.stock<0?'−'+Math.abs(p.stock):String(p.stock).replace('.',','))+' '+unitLbl(p.unit);
const empName=id=>(S.employees.find(e=>e.id===id)||{name:'—'}).name;
const openSess=()=>S.sessions.find(s=>!s.closedAt&&(s.caja===undefined||s.caja===S.tenant.caja)); /* la sesión abierta de ESTE equipo (otros equipos tienen la suya) */
const saleOk=s=>s.status==='ok';
const lineTotal=it=>Math.round(it.qty*it.price)-(it.disc||0);
const lineCost=it=>Math.round(it.qty*it.cost);
const initial=n=>(String(n||'?').trim()[0]||'?').toUpperCase();

/* exportaciones disponibles en cualquier área */
const EXPORTS={
 productos:{t:'Inventario',perm:'impex',h:()=>['id','nombre','rubro','precio','costo','stock','unidad','codigo_barras','menu','activo'],rows:()=>S.products.map(p=>[p.id,p.name,rubName(p.rubro),p.price/100,can('view_cost')?p.cost/100:'',p.stock,unitLbl(p.unit),p.barcode,p.menu?'si':'no',p.active?'si':'no'])},
 ventas:{t:'Ventas (una fila por ítem)',perm:'impex',h:()=>['nro','fecha','usuario','canal','medio','estado','documento','rubro','producto','cantidad','precio','importe','comision_total_venta','pagos','a_cuenta_corriente','estado_pago'],rows:()=>S.sales.flatMap(s=>s.items.map(it=>[s.n,fmtDT(s.ts),s.user,s.channel||'local',salePayLabel(s),s.status,(s.arca&&s.arca.cae?'factura '+s.arca.letra+' '+String(s.arca.pto).padStart(4,'0')+'-'+String(s.arca.nro).padStart(8,'0')+' CAE '+s.arca.cae:s.doc),rubName(it.rubro),it.name,it.qty,it.price/100,lineTotal(it)/100,(s.fee||0)/100,salePays(s).map(pp=>(MET[pp.m]||pp.m)+' '+(pp.a/100)).join(' + '),saleFiadoAmt(s)/100,PSTATE_TXT[salePayState(s)]]))},
 movimientos:{t:'Ingresos y egresos de caja',perm:'impex',h:()=>['fecha','tipo','rubro','concepto','importe','usuario','caja_sesion'],rows:()=>S.movs.map(m=>[fmtDT(m.ts),m.type,m.rubroName||rubName(m.rubro),m.concept,m.amount/100,m.user,m.sessId])},
 cierres:{t:'Cajas cerradas',perm:'impex',h:()=>['fecha','caja','cerro','ventas','efectivo_esperado','declarado','diferencia','sello'],rows:()=>S.closures.map(c=>[fmtDT(c.ts),c.caja,c.user,c.data.total/100,c.data.expectedCash/100,c.data.declared/100,c.data.diff/100,c.hash])},
 fichadas:{t:'Fichadas del personal',perm:'impex',h:()=>['fecha','empleado','tipo','metodo','dispositivo'],rows:()=>S.punches.map(p=>[fmtDT(p.ts),empName(p.empId),p.kind==='in'?'Entrada':'Salida',p.method,p.device])},
 empleados:{t:'Empleados',perm:'impex',h:()=>['id','nombre','puesto','valor_hora','activo'],rows:()=>S.employees.map(e=>[e.id,e.name,(S.puestos.find(p=>p.id===e.puestoId)||{}).name||'',e.rate/100,e.active?'si':'no'])},
 tareas:{t:'Tareas del personal',perm:'impex',h:()=>['id','tarea','puesto','frecuencia','dia','activa'],rows:()=>S.tasks.map(t=>[t.id,t.title,(S.puestos.find(p=>p.id===t.puestoId)||{}).name||'',t.freq,t.freq==='weekly'?DIAS[t.dow]:t.freq==='monthly'?t.dom:'',t.active?'si':'no'])},
 pedidosya:{t:'Pedidos PedidosYa',perm:'impex',h:()=>['ref','fecha','cliente','estado','total'],rows:()=>S.pya.map(o=>[o.ref,fmtDT(o.ts),o.customer,o.status,o.total/100])},
 auditoria:{t:'Auditoría',perm:'audit',h:()=>['fecha','usuario','accion','detalle','hash'],rows:()=>allAudit().map(a=>[fmtDT(a.ts),a.user,a.action,a.detail,a.hash])},
 clientes:{t:'Clientes del Club (datos personales)',perm:'impex',h:()=>['nombre','apellido','nacimiento','whatsapp','origen','consent_club','consent_comercial','fecha'],rows:()=>S.customers.map(c=>[c.name,c.last,c.birth,c.wa,c.origin,c.consent.club?'si':'no',c.consent.comm?'si':'no',fmtDT(c.ts)])}
};
const expBar=ent=>`<span class="row noprint"><button class="btn sm" data-act="exp" data-ent="${ent}" data-fmt="csv">Exportar CSV</button><button class="btn sm" data-act="exp" data-ent="${ent}" data-fmt="xls">Exportar Excel</button></span>`;
A.exp=el=>{const E=EXPORTS[el.dataset.ent];if(!E)return;if(!can(E.perm)){toast('No tenés permiso para exportar esto',1);return;}
 const go=()=>{const rows=E.rows(),h=E.h();if(el.dataset.fmt==='xls')download('rave-'+el.dataset.ent+'.xls',toXLS(h,rows),'application/vnd.ms-excel;charset=utf-8');else download('rave-'+el.dataset.ent+'.csv',toCSV(h,rows),'text/csv;charset=utf-8');audit('EXPORTAR',el.dataset.ent+' ('+rows.length+' filas, '+el.dataset.fmt+')');toast('Exportado: '+rows.length+' filas');};
 if(el.dataset.ent==='clientes')confirmBox('Datos personales','Vas a exportar datos personales de clientes (Ley 25.326 [VERIFICAR]). ¿Confirmás?',go);else go();};

/* ---------- Íconos ---------- */
const IC={home:'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',cart:'M3 4h2l2.4 11h10.2L20 7H6M9 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01',box:'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',cash:'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',lock:'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',moto:'M5 17a2 2 0 1 0 0-.01M19 17a2 2 0 1 0 0-.01M7 17h8l3-6h-4l-2-4H7',users:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3 20c0-3.5 3-5 6-5s6 1.5 6 5M17 11a2.5 2.5 0 1 0 0-5M21 19c0-2.5-1.5-3.8-3.5-4.2',check:'M4 12l5 5L20 6',file:'M6 3h8l4 4v14H6zM14 3v4h4',plug:'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',globe:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',gear:'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M19 12l2-1-1-3-2 .5-1.5-1.5L17 5l-3-1-1 2h-2L10 4 7 5l.5 2.5L6 9l-2-.5-1 3 2 1v2l-2 1 1 3 2-.5 1.5 1.5L7 21l3 1 1-2h2l1 2 3-1-.5-2.5L18 17l2 .5 1-3-2-1z',list:'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'};
const ico=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[n]||IC.file}"/></svg>`;

/* ---------- Router / pantallas ---------- */
const SCREENS={};
let curScreen='inicio';
function reg(id,t,icon,perm,render,after,sec){SCREENS[id]={t,icon,perm,render,after,sec};}
function go(id){location.hash='#panel/'+id;}
function route(){const h=location.hash||'#menu';
 $('#pub').hidden=true;$('#login').hidden=true;$('#panel').hidden=true;
 if(h.startsWith('#panel')){if(!user){location.hash='#acceso';return;}showPanel(h.split('/')[1]||'inicio');}
 else if(h==='#acceso'){showLogin();}
 else{showMenu();}}
window.addEventListener('hashchange',route);

const NAV=[['inicio','Resumen'],['vender','Operación'],['pedidos','Operación'],['caja','Operación'],['cajasx','Operación'],['arqueo','Operación'],['cierres','Operación'],['inventario','Operación'],['proveedores','Operación'],
 ['clientes','Clientes y fidelización'],['fidel','Clientes y fidelización'],['cupones','Clientes y fidelización'],
 ['personal','Equipo'],['tareas','Equipo'],['menuadmin','Menú y web'],['legal','Menú y web'],
 ['nube','Sistema'],['dispositivos','Sistema'],['impex','Sistema'],['integ','Sistema'],['roles','Sistema'],['auditoria','Sistema'],['config','Sistema']];
function showPanel(id){if(!SCREENS[id]||(SCREENS[id].perm&&!can(SCREENS[id].perm))||(SCREENS[id].show&&!SCREENS[id].show()))id='inicio';curScreen=id;$('#panel').hidden=false;
 const order=NAV.map(x=>x[0]);const secOf=Object.fromEntries(NAV);
 const nav=Object.entries(SCREENS).filter(([k,s])=>(!s.perm||can(s.perm))&&(!s.show||s.show())).sort((a,b)=>{const i=order.indexOf(a[0]),j=order.indexOf(b[0]);return (i<0?99:i)-(j<0?99:j);});let sec='';
 $('#side').innerHTML=`<div class="brand"><img src="${LOGO_MENU}" alt="RAVE" style="width:48px;height:27px;object-fit:cover;border-radius:6px"><span>Sistema RAVE</span></div>`+nav.map(([k,s])=>{const sc=secOf[k]||'Otros';const h=(sc!==sec)?(sec=sc,`<div class="sec">${esc(sc)}</div>`):'';return h+`<a data-act="nav" data-id="${k}" class="${k===id?'on':''}" tabindex="0" role="link">${ico(s.icon)}<span>${esc(s.t)}</span></a>`;}).join('')+`<div class="sec">Desarrollado por</div><div class="sm" style="padding:0 .7rem;color:#a99f8f"><b style="color:#eee">${VB.name}</b><br><i>“${VB.lema}”</i><br><a style="color:#c9963e" href="${vbWa()}" target="_blank" rel="noopener noreferrer">Único celular ${VB.phone}</a><br><a style="color:#c9963e" href="mailto:${VB.mail}">${VB.mail}</a></div>`;
 const s=openSess();
 $('#top').innerHTML=`<button class="btn sm" id="burger" data-act="burger" aria-label="Abrir menú">☰</button><b style="font-family:Georgia,serif">${esc(S.tenant.name)}</b>${(window.RAVE_BUILD&&window.RAVE_BUILD.variant==='cliente')?'':'<span class="demo-b">DEMO DE EVALUACIÓN</span>'}<span id="cloudtag" class="tag"></span><span class="tag ${s?'ok':'warn'}">${s?'Caja '+S.tenant.caja+' abierta':'Caja cerrada'}</span><span class="tag ${S.simOffline?'bad':'ok'}">${S.simOffline?'APIs externas caídas (simulado)':'Operativo'}</span><span id="devtag" class="tag"></span><span class="sp"></span><span class="sm mut">${esc(user.name)} · ${esc(user.role)}</span>${typeof asBtn==='function'?asBtn():''}<a class="btn sm" href="#menu">Ver menú público</a><button class="btn sm" data-act="logout">Salir</button>`;
 const sc=SCREENS[id];$('#view').innerHTML=sc.render();sc.after&&sc.after();$('#side').classList.remove('open');window.scrollTo(0,0);try{document.documentElement.style.setProperty('--topH',($('#top').offsetHeight||56)+'px');}catch(e){}if(typeof devTag==='function')devTag();if(typeof cloudBadge==='function')cloudBadge();if(typeof asPaint==='function')asPaint();}
A.nav=el=>go(el.dataset.id);A.burger=()=>$('#side').classList.toggle('open');
A.logout=()=>{audit('LOGOUT','');if(typeof asReset==='function')asReset();user=null;location.hash='#menu';};
const rerender=()=>{if(!$('#panel').hidden)showPanel(curScreen);};
document.addEventListener('keydown',e=>{const a=e.target.closest&&e.target.closest('#side a');if(a&&(e.key==='Enter'||e.key===' ')){e.preventDefault();A.nav(a);}});

/* ---------- Login ---------- */
let loginFails=0,lockUntil=0;
function showLogin(){if(CLOUD_HOOK||(window.RAVE_BUILD&&window.RAVE_BUILD.variant==='cliente')){cloudLogin();return;}const L=$('#login');L.hidden=false;
 L.innerHTML=`<div class="lbox"><div style="text-align:center"><img src="${LOGO_MENU}" alt="RAVE" style="width:150px;border-radius:12px"><h1>Acceso del equipo</h1><p class="mut sm">Demo de evaluación. Usuarios de prueba: ADMIN · 1234 / Supervisor · 1111 / Mostrador · 0000</p></div>
 <label for="lu">Usuario</label><select id="lu">${S.users.map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select>
 <label for="lp">PIN</label><input id="lp" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN">
 <div class="merr" id="lerr" role="alert"></div>
 <div class="row" style="margin-top:.8rem"><button class="btn gold sp" data-act="login">Ingresar</button><a class="btn" href="#menu">Volver al menú</a></div>
 ${vbFooter(true)}</div>`;
 $('#lp').addEventListener('keydown',e=>{if(e.key==='Enter')A.login();});}
A.login=()=>{const err=$('#lerr');if(now()<lockUntil){err.textContent='Demasiados intentos. Esperá '+Math.ceil((lockUntil-now())/1000)+' s.';return;}
 const u=S.users.find(x=>x.id===val('lu'));if(u&&u.pin===val('lp')){loginFails=0;user=u;audit('LOGIN','ingreso desde menú/acceso');location.hash='#panel/inicio';}
 else{loginFails++;audit('LOGIN_FALLIDO','intento '+loginFails);err.textContent='Usuario o PIN incorrecto.';if(loginFails>=5){lockUntil=now()+120000;loginFails=0;err.textContent='5 intentos fallidos: bloqueado 2 minutos.';}}};
