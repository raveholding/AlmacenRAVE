/* =====================================================================
   p25-torre.js · V27.19 · Torre de Control de logística y reparto
   · Mapa propio (sin librerías ni claves): mosaicos CARTO/OpenStreetMap, zoom con rueda, pellizco
     y botones, arrastre, capas de flota y paradas, zonas con efectividad y mapa de calor
     (facturación, rechazos o envases). Sin internet sigue funcionando con fondo neutro.
   · Lazo: se dibuja un área y se reasignan o avisan los pedidos que quedan adentro.
   · Hoja de ruta por móvil con ↑ ↓ para cambiar el orden: la ruta y las horas estimadas se recalculan.
   · Panel de cada parada o móvil: trazabilidad auditada, finanzas y envases (con bloqueo de crédito
     y autorización excepcional) y comunicación a chofer, preventista y cliente por WhatsApp.
   · Jornada simulada 1x / 5x / 10x con eventos reales (local cerrado, diferencia de precio,
     bloqueo de crédito) y tablero sincronizado con los filtros de zona, móvil y preventista.
   · Recorridos: intenta el ruteo público OSRM; si no hay red, traza por calles en damero.
   Datos: torreSemilla() (demo, p25b-torre-salta.js). Todo queda guardado en este navegador.
   ===================================================================== */
const TW={ds:null,run:false,speed:1,timer:null,sel:null,tab:'traz',capas:{flota:true,zonas:true,calor:false},calor:'fact',lasso:false,lsel:[],lpts:null,
 f:{zona:'',movil:'',prev:''},view:null,osrm:{},osrmOff:false,silent:false,ciego:{},dec:{},rk:'prev',saveT:0,uiT:0,el:null,tiles:new Map(),toasts:[]};
const TKEY='vb-torre-v1';
const TCOL={entregado:'#16a34a',camino:'#2563eb',descarga:'#2563eb',pend:'#d97706',sin:'#9ca3af',rechazado:'#dc2626',reprog:'#dc2626',parcial:'#ea580c'};
const TEST={entregado:'Entregado',camino:'En camino · próximo',descarga:'Descargando en puerta',pend:'Pendiente',sin:'Sin asignar',rechazado:'Rechazado',reprog:'Reprogramado',parcial:'Entrega parcial'};
const TMOV={M01:'#1d4ed8',M02:'#0f766e',M03:'#b45309'};
const TMED={ef:'Efectivo',tr:'Transferencia',qr:'QR Mercado Pago',cc:'Cuenta corriente'};
const tP=n=>'$ '+Math.round(n||0).toLocaleString('es-AR');
const tH=m=>{m=Math.round(m);const d=Math.floor(m/1440);m=((m%1440)+1440)%1440;return(d<0?'ayer ':'')+String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
const tHav=(a,b)=>{const R=6371,r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lng-a.lng)*r,x=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x));};
const tW=(lat,lng,z)=>{const n=256*2**z,s=Math.sin(lat*Math.PI/180);return{x:(lng+180)/360*n,y:(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n};};
const tUnW=(x,y,z)=>{const n=256*2**z,lng=x/n*360-180,k=Math.PI-2*Math.PI*y/n;return{lat:180/Math.PI*Math.atan(Math.sinh(k)),lng};};
const tCom=id=>TW.ds.com.find(c=>c.id===id);
const tPed=id=>TW.ds.ped.find(p=>p.id===id);
const tMov=id=>TW.ds.moviles.find(m=>m.id===id);
const tPrev=id=>TW.ds.prev.find(p=>p.id===id);
const tUsr=()=>(typeof user!=='undefined'&&user&&user.name)||'Administración';
const tAbierto=p=>p.estado==='pend'||p.estado==='camino'||p.estado==='descarga';
const tEstado=p=>p.estado==='pend'&&!p.movil?'sin':p.estado;
const tRuta=m=>TW.ds.ped.filter(p=>p.movil===m.id).sort((a,b)=>a.orden-b.orden);
function tInPoly(pt,poly){let ins=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[xi,yi]=poly[i],[xj,yj]=poly[j];if(((yi>pt[1])!==(yj>pt[1]))&&(pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi))ins=!ins;}return ins;}

/* ---------- datos y guardado ---------- */
function tLoad(){
 if(TW.ds)return;let d=null;try{d=JSON.parse(localStorage.getItem(TKEY)||'null');}catch(e){}
 if(d&&d.ver===1&&d.fecha===new Date().toISOString().slice(0,10)){TW.ds=d;return;}
 tNueva();
}
function tNueva(){
 TW.ds=torreSemilla();TW.ds.clock=7*60+30;
 TW.ds.moviles.forEach(m=>{tRuta(m).forEach((p,i)=>p.orden=i+1);});
 TW.ds.ped.forEach(p=>{if(!p.orden)p.orden=0;});
 // la demo arranca con la jornada ya en marcha (09:20), sin avisos: lo anterior queda en la trazabilidad
 TW.silent=true;while(TW.ds.clock<9*60+20)tTick(1);TW.silent=false;tSave(true);
}
function tSave(now){const t=Date.now();if(!now&&t-TW.saveT<4000)return;TW.saveT=t;try{localStorage.setItem(TKEY,JSON.stringify(TW.ds));}catch(e){}}

/* ---------- recorridos: OSRM si hay red, si no calles en damero ---------- */
function tZ(a,b){const mid=(a.lng+b.lng)/2;return[{lat:a.lat,lng:a.lng},{lat:a.lat,lng:mid},{lat:b.lat,lng:mid},{lat:b.lat,lng:b.lng}];}
function tPath(a,b){const k=a.lat.toFixed(4)+','+a.lng.toFixed(4)+'>'+b.lat.toFixed(4)+','+b.lng.toFixed(4);const o=TW.osrm[k];if(o)return o;tOsrm(k,a,b);return tZ(a,b);}
function tOsrm(k,a,b){
 if(TW.silent||TW.osrmOff||TW.osrm[k]===0||typeof fetch!=='function'||(typeof navigator!=='undefined'&&navigator.onLine===false))return;TW.osrm[k]=0;
 const ctl=typeof AbortController!=='undefined'?new AbortController():null;const to=setTimeout(()=>ctl&&ctl.abort(),3500);
 fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,ctl?{signal:ctl.signal}:{})
  .then(r=>r.ok?r.json():Promise.reject()).then(j=>{clearTimeout(to);const c=j&&j.routes&&j.routes[0]&&j.routes[0].geometry&&j.routes[0].geometry.coordinates;
   if(c&&c.length>1){TW.osrm[k]=c.map(x=>({lat:x[1],lng:x[0]}));tDraw();}})
  .catch(()=>{clearTimeout(to);delete TW.osrm[k];TW.osrmOff=true;});
}
function tLen(path){let d=[0];for(let i=1;i<path.length;i++)d.push(d[i-1]+tHav(path[i-1],path[i]));return d;}
function tAt(path,cum,s){for(let i=1;i<path.length;i++)if(cum[i]>=s){const f=(s-cum[i-1])/((cum[i]-cum[i-1])||1),a=path[i-1],b=path[i];
 return{lat:a.lat+(b.lat-a.lat)*f,lng:a.lng+(b.lng-a.lng)*f,head:Math.atan2(b.lng-a.lng,b.lat-a.lat)*180/Math.PI};}const z=path[path.length-1];return{lat:z.lat,lng:z.lng,head:0};}
const tVel=m=>({centro:.36,norte:.47,sur:.45,oeste:.42}[m.zona]||.42); // km por minuto
const tDwell=p=>6+(parseInt(p.id.slice(2),10)*7)%9;

/* ---------- simulación ---------- */
function tPend(m){return tRuta(m).filter(tAbierto);}
function tLeg(m){
 const sig=tPend(m)[0];const from={lat:m.lat,lng:m.lng};
 if(!sig){const path=tPath(from,TW.ds.dep);m.leg={to:'dep',path,cum:tLen(path),s:0};m.estado='vuelta';return;}
 const c=tCom(sig.com);const path=tPath(from,c);m.leg={to:sig.id,path,cum:tLen(path),s:0};m.estado='ruta';
 TW.ds.ped.forEach(p=>{if(p.movil===m.id&&p.estado==='camino'&&p.id!==sig.id)p.estado='pend';});
 if(sig.estado==='pend'){sig.estado='camino';}
}
function tEv(p,txt,det,usr,gps){p.eventos.push({h:TW.ds.clock,usr:usr||'Sistema',txt,det:det||'',gps:!!gps});}
function tTick(dt){
 const D=TW.ds;D.clock+=dt;
 D.moviles.forEach(m=>{
  if(m.estado==='fin')return;
  if(m.estado==='deposito'){if(D.clock>=m.salida&&tRuta(m).length){tLeg(m);m.vel=tVel(m)*60;}else return;}
  if(m.estado==='parada'){if(D.clock<m.dwellHasta)return;const p=tPed(m.leg.to);tResolver(p,m);tLeg(m);m.vel=tVel(m)*60;return;}
  if(!m.leg)tLeg(m);
  const L=m.leg,tot=L.cum[L.cum.length-1];L.s=Math.min(tot,L.s+tVel(m)*dt);m.km+=tVel(m)*dt;
  const q=tAt(L.path,L.cum,L.s);m.lat=q.lat;m.lng=q.lng;if(L.s<tot)m.head=q.head;
  if(L.s>=tot-1e-6){
   if(L.to==='dep'){m.estado='fin';m.vel=0;m.lat=D.dep.lat;m.lng=D.dep.lng;if(!TW.silent)tToast(`${m.nombre} volvió al depósito`,`${m.chofer} terminó la hoja de ruta. Liquidación lista en el tablero.`,{movil:m.id});return;}
   const p=tPed(L.to);m.estado='parada';m.vel=0;p.estado='descarga';p.llegada=D.clock;m.dwellHasta=D.clock+tDwell(p);
   tEv(p,'Llegada al comercio',`${m.nombre} · ${m.chofer}. Posición GPS validada en la puerta.`,m.chofer,true);
  }
 });
 if(!TW.silent){tSave();const t=Date.now();if(t-TW.uiT>350){TW.uiT=t;tDraw();tDash();tDrawerUpd();tReloj();}}
}
function tResolver(p,m){
 const c=tCom(p.com),D=TW.ds;p.salidaParada=D.clock;p.dwell=Math.round(D.clock-p.llegada);
 if(c.venc>0&&!p.aut){
  p.estado='reprog';p.motivo=`Bloqueo crediticio: deuda vencida de ${c.venc} días sin autorización`;p.envEnt=0;p.envRet=0;
  tEv(p,'Descarga bloqueada · reprogramado',p.motivo,m.chofer,true);
  if(!TW.silent)tToast('Bloqueo de crédito en '+c.nombre,`${m.nombre} no descargó: deuda vencida de ${c.venc} días.`,{ped:p.id,prev:c.prev,bad:1});return;}
 if(p.ev==='cerrado'){
  p.estado='rechazado';p.motivo='Local cerrado: sin atención en la puerta';p.envEnt=0;p.envRet=0;
  tEv(p,'Rechazo total',`${p.motivo}. Esperó ${p.dwell} min y dejó aviso.`,m.chofer,true);
  if(!TW.silent)tToast('Rechazo por local cerrado',`${c.nombre} (${c.dir.split(',')[0]}) · ${m.nombre}`,{ped:p.id,prev:c.prev,bad:1});return;}
 let monto=p.monto,bul=p.bultos;
 if(p.ev==='precio'){const rb=Math.max(1,Math.round(p.bultos*.15));bul=p.bultos-rb;monto=Math.round(p.monto*(1-rb/p.bultos));p.estado='parcial';p.rech={bultos:rb,monto:p.monto-monto};
  p.motivo=`Diferencia de precio en 2 artículos: devolvió ${rb} bultos`;
  if(!TW.silent)tToast('Diferencia de precio',`${c.nombre} rechazó ${rb} bultos (${tP(p.monto-monto)}).`,{ped:p.id,prev:c.prev,bad:1});}
 else p.estado='entregado';
 p.rendido={medio:p.medio,monto};p.bultosEnt=bul;c.env=c.env+p.envEnt-p.envRet;
 if(p.medio==='cc')c.cc+=monto;
 tEv(p,p.estado==='parcial'?'Entrega parcial (POD)':'Entrega confirmada (POD)',
  `${bul} bultos · ${tP(monto)} · ${TMED[p.medio]}. En puerta ${p.dwell} min. Remito firmado y foto.${p.motivo?' '+p.motivo+'.':''}`,m.chofer,true);
}

/* ---------- horas estimadas ---------- */
function tEtas(m){
 const r={},D=TW.ds;let t=D.clock,pos={lat:m.lat,lng:m.lng};const v=tVel(m);
 if(m.estado==='deposito')t=Math.max(t,m.salida);
 if(m.estado==='parada')t=Math.max(t,m.dwellHasta);
 tPend(m).forEach((p,i)=>{const c=tCom(p.com);
  if(i===0&&m.estado==='ruta'&&m.leg&&m.leg.to===p.id){t+=(m.leg.cum[m.leg.cum.length-1]-m.leg.s)/v;}
  else if(!(i===0&&p.estado==='descarga')){t+=tHav(pos,c)*1.3/v;}
  r[p.id]=t;if(p.estado!=='descarga')t+=tDwell(p);pos=c;});
 return r;
}
function tPlan(m){ // horario planificado al salir: base para la curva y la puntualidad
 const r={};let t=m.salida,pos=TW.ds.dep;const v=tVel(m);tRuta(m).forEach(p=>{const c=tCom(p.com);t+=tHav(pos,c)*1.3/v;r[p.id]=t;t+=tDwell(p);pos=c;});return r;}

/* ---------- acciones ---------- */
function tReordenar(pid,dir){
 const p=tPed(pid),m=tMov(p.movil);if(!m)return;const pend=tPend(m).filter(x=>x.estado!=='descarga');const i=pend.indexOf(p),j=i+dir;if(i<0||j<0||j>=pend.length)return;
 const a=pend[i],b=pend[j];const o=a.orden;a.orden=b.orden;b.orden=o;
 if(m.estado==='ruta')tLeg(m);tEv(p,'Orden de entrega cambiado',`Ahora es la parada ${tPend(m).indexOf(p)+1} de ${m.nombre}`,tUsr());
 tSave(true);tDraw();tDrawer();tDash();
}
function tAsignar(ids,mid){
 const dest=tMov(mid);let n=0;
 ids.forEach(id=>{const p=tPed(id);if(!p||!tAbierto(p)||p.estado==='descarga'||p.movil===mid)return;const ant=tMov(p.movil);
  p.movil=mid;p.estado='pend';
  // inserción más barata dentro de las paradas pendientes del móvil destino
  const pend=tPend(dest).filter(x=>x.id!==p.id&&x.estado!=='descarga');const c=tCom(p.com);
  const pts=[{lat:dest.lat,lng:dest.lng}].concat(pend.map(x=>tCom(x.com)));let best=pend.length,bc=1e9;
  for(let k=0;k<=pend.length;k++){const a=pts[k],b=pts[k+1];const add=tHav(a,c)+(b?tHav(c,b)-tHav(a,b):0);if(add<bc){bc=add;best=k;}}
  const base=tRuta(dest).filter(x=>x.id!==p.id);const ord=base.filter(x=>!tAbierto(x)||x.estado==='descarga').concat(pend);ord.splice(ord.length-pend.length+best,0,p);
  ord.forEach((x,i)=>x.orden=i+1);
  if(ant&&ant.leg&&ant.leg.to===p.id&&ant.estado==='ruta')tLeg(ant);
  if(dest.estado==='ruta')tLeg(dest);
  if(dest.estado==='fin'){dest.estado='deposito';dest.salida=TW.ds.clock;}
  tEv(p,`Reasignado a ${dest.nombre}`,`${ant?'Antes en '+ant.nombre+'. ':''}Parada ${tPend(dest).indexOf(p)+1} de la nueva hoja de ruta.`,tUsr());n++;});
 tSave(true);return n;
}
function tAutorizar(pid){const p=tPed(pid);if(!p)return;p.aut={por:tUsr(),h:TW.ds.clock};
 tEv(p,'Descarga excepcional autorizada',`Autorizó ${tUsr()} con la deuda vencida a la vista.`,tUsr());
 if(p.estado==='reprog'){p.estado='pend';p.motivo='';const m=tMov(p.movil);if(m){p.orden=Math.max(...tRuta(m).map(x=>x.orden))+1;if(m.estado==='fin'){m.estado='deposito';m.salida=TW.ds.clock;}}}
 tSave(true);tDraw();tDrawer();tDash();toast('Descarga autorizada y registrada en la trazabilidad');}

/* ---------- avisos en pantalla ---------- */
function tToast(t,s,o){
 const box=document.getElementById('tw-toasts');if(!box)return;const id='tt'+Date.now()+Math.random().toString(36).slice(2,6);
 const pv=o&&o.prev?tPrev(o.prev):null;
 const h=`<div class="tw-toast${o&&o.bad?' bad':''}" id="${id}" role="status"><b>${esc(t)}</b><p>${esc(s)}</p><div class="tw-tb">
  ${o&&o.ped?`<button class="btn sm" data-act="twSel" data-t="p" data-id="${o.ped}">Abrir caso</button>`:''}
  ${o&&o.movil?`<button class="btn sm" data-act="twSel" data-t="m" data-id="${o.movil}">Ver móvil</button>`:''}
  ${pv&&o.ped?`<button class="btn sm gold" data-act="twWa" data-k="prev" data-id="${o.ped}">Escribir a ${esc(pv.nombre.split(' ')[0])}</button>`:''}
  <button class="btn sm ghost" data-act="twToastX" data-id="${id}" aria-label="Cerrar aviso">✕</button></div></div>`;
 box.insertAdjacentHTML('afterbegin',h);const all=box.querySelectorAll('.tw-toast');const mx=window.innerWidth<700?1:3;for(let i=mx;i<all.length;i++)all[i].remove();
 setTimeout(()=>{const e=document.getElementById(id);if(e)e.remove();},window.innerWidth<700?9000:14000);
}
A.twToastX=el=>{const e=document.getElementById(el.dataset.id);if(e)e.remove();};

/* ---------- motor del mapa ---------- */
function tView(){if(!TW.view)TW.view=tFit();return TW.view;}
function tFit(){const D=TW.ds;const pts=D?D.com.concat([D.dep]):[];if(!pts.length||!TW.el)return{lat:-24.7859,lng:-65.4117,z:12.5};
 const{W,H}=tSize();const la=pts.map(p=>p.lat),ln=pts.map(p=>p.lng);const n=Math.max(...la),s=Math.min(...la),e=Math.max(...ln),w=Math.min(...ln);let z=16;
 for(;z>10;z-=.1){const a=tW(n,w,z),b=tW(s,e,z);if(b.x-a.x<W-70&&b.y-a.y<H-110)break;}return{lat:(n+s)/2,lng:(e+w)/2,z:Math.round(z*10)/10};}
function tSize(){const el=TW.el;return el?{W:el.clientWidth||600,H:el.clientHeight||420}:{W:600,H:420};}
function tScr(lat,lng){const v=tView(),{W,H}=tSize(),c=tW(v.lat,v.lng,v.z),p=tW(lat,lng,v.z);return{x:p.x-c.x+W/2,y:p.y-c.y+H/2};}
function tFromScr(x,y){const v=tView(),{W,H}=tSize(),c=tW(v.lat,v.lng,v.z);return tUnW(c.x+x-W/2,c.y+y-H/2,v.z);}
function tTiles(){
 const el=TW.el;if(!el)return;const lay=el.querySelector('.tw-tiles');if(!lay)return;const v=tView(),{W,H}=tSize();
 const zi=Math.max(3,Math.min(19,Math.floor(v.z))),s=2**(v.z-zi),ts=256*s,c=tW(v.lat,v.lng,v.z),n=2**zi,used=new Set();
 const dark=document.documentElement.classList.contains('dark')||document.body.classList.contains('dark');
 for(let tx=Math.floor((c.x-W/2)/ts);tx<=Math.floor((c.x+W/2)/ts);tx++)for(let ty=Math.floor((c.y-H/2)/ts);ty<=Math.floor((c.y+H/2)/ts);ty++){
  if(ty<0||ty>=n)continue;const nx=((tx%n)+n)%n,k=zi+'/'+nx+'/'+ty;used.add(k);let im=TW.tiles.get(k);
  if(!im){im=document.createElement('img');im.alt='';im.decoding='async';im.draggable=false;im.onerror=()=>{im.style.visibility='hidden';};
   im.src=`https://${'abcd'[(nx+ty)%4]}.basemaps.cartocdn.com/${dark?'dark_all':'light_all'}/${zi}/${nx}/${ty}.png`;TW.tiles.set(k,im);}
  if(im.parentNode!==lay)lay.appendChild(im);
  im.style.cssText=`position:absolute;left:${(tx*ts-c.x+W/2).toFixed(1)}px;top:${(ty*ts-c.y+H/2).toFixed(1)}px;width:${ts+.5}px;height:${ts+.5}px;${im.style.visibility==='hidden'?'visibility:hidden;':''}`;}
 TW.tiles.forEach((im,k)=>{if(!used.has(k)){im.remove();if(TW.tiles.size>220)TW.tiles.delete(k);}});
}
function tMatch(p){const c=tCom(p.com),f=TW.f;return(!f.zona||c.zona===f.zona)&&(!f.movil||p.movil===f.movil)&&(!f.prev||c.prev===f.prev);}
function tEfZona(z){const ps=TW.ds.ped.filter(p=>tCom(p.com).zona===z&&!tAbierto(p));if(!ps.length)return null;return Math.round(ps.filter(p=>p.estado==='entregado'||p.estado==='parcial').length/ps.length*100);}
function tDraw(){
 const el=TW.el;if(!el||!el.isConnected)return;tTiles();const svg=el.querySelector('.tw-svg');if(!svg)return;const{W,H}=tSize();const D=TW.ds,v=tView();
 svg.setAttribute('viewBox',`0 0 ${W} ${H}`);let g='',zl='';const S=(lat,lng)=>tScr(lat,lng);
 if(TW.capas.zonas)D.zonas.forEach(z=>{const pts=z.poly.map(q=>{const s=S(q[1],q[0]);return s.x.toFixed(1)+','+s.y.toFixed(1);}).join(' ');
  const sp=z.poly.map(q=>S(q[1],q[0])),top=Math.min(...sp.map(q=>q.y)),cs={x:sp.reduce((a,q)=>a+q.x,0)/sp.length,y:top+13},ef=tEfZona(z.id),dim=TW.f.zona&&TW.f.zona!==z.id;
  g+=`<polygon points="${pts}" fill="${z.color}" fill-opacity="${dim?.04:.11}" stroke="${z.color}" stroke-opacity="${dim?.25:.7}" stroke-width="1.5" stroke-dasharray="5 4" data-k="z" data-id="${z.id}"/>`;
  const lbl=`${z.corto||z.nombre}${ef==null?'':' · '+ef+' %'}`,w=lbl.length*6.6+16;
  zl+=`<g transform="translate(${(cs.x-w/2).toFixed(1)},${(cs.y-11).toFixed(1)})" opacity="${dim?.4:1}" pointer-events="none"><rect width="${w}" height="22" rx="11" fill="#fff" stroke="${z.color}"/><text x="${w/2}" y="15" text-anchor="middle" font-size="11" font-weight="700" fill="${z.color}">${esc(lbl)}</text></g>`;});
 if(TW.capas.flota){
  D.moviles.forEach(m=>{if(TW.f.movil&&TW.f.movil!==m.id)return;const col=TMOV[m.id]||'#334155';let pts=[];
   if(m.leg&&(m.estado==='ruta'||m.estado==='vuelta')){const L=m.leg;const tot=L.cum[L.cum.length-1];pts.push({lat:m.lat,lng:m.lng});L.path.forEach((q,i)=>{if(L.cum[i]>L.s)pts.push(q);});if(L.s>=tot)pts=[];}
   let last=m.leg&&m.estado==='ruta'?tCom(tPed(m.leg.to).com):{lat:m.lat,lng:m.lng};
   const rest=tPend(m).filter(p=>!(m.leg&&m.leg.to===p.id&&m.estado==='ruta')&&p.estado!=='descarga');
   if(m.estado==='deposito'||m.estado==='parada'){pts=[{lat:m.lat,lng:m.lng}];last={lat:m.lat,lng:m.lng};}
   rest.forEach(p=>{const c=tCom(p.com);pts=pts.concat(tPath(last,c).slice(1));last=c;});
   if(m.estado!=='fin'&&(rest.length||m.estado!=='vuelta')){if(m.estado!=='vuelta')pts=pts.concat(tPath(last,D.dep).slice(1));}
   if(pts.length>1)g+=`<polyline points="${pts.map(q=>{const s=S(q.lat,q.lng);return s.x.toFixed(1)+','+s.y.toFixed(1);}).join(' ')}" fill="none" stroke="${col}" stroke-width="3.5" stroke-opacity=".55" stroke-linejoin="round" stroke-dasharray="${m.estado==='vuelta'?'2 6':'9 6'}"/>`;});
  const ds=S(D.dep.lat,D.dep.lng);g+=`<g transform="translate(${ds.x.toFixed(1)},${ds.y.toFixed(1)})" data-k="dep" style="cursor:pointer"><rect x="-13" y="-13" width="26" height="26" rx="6" fill="#111827"/><text y="5" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">D</text><title>${esc(D.dep.nombre)}</title></g>`;
  const etas={};D.moviles.forEach(m=>Object.assign(etas,tEtas(m)));
  D.ped.slice().sort((a,b)=>(a.estado==='camino')-(b.estado==='camino')).forEach(p=>{const c=tCom(p.com),s=S(c.lat,c.lng),est=tEstado(p),col=TCOL[est],dim=!tMatch(p);const sel=TW.lsel.includes(p.id)||(TW.sel&&TW.sel.t==='p'&&TW.sel.id===p.id);
   let h=`<g transform="translate(${s.x.toFixed(1)},${s.y.toFixed(1)})" data-k="p" data-id="${p.id}" opacity="${dim?.22:1}" style="cursor:pointer">`;
   if(est==='camino'||est==='descarga')h+=`<circle r="16" fill="${col}" opacity=".25" class="tw-pulse"/>`;
   if(c.venc>0&&tAbierto(p)&&!p.aut)h+=`<circle r="13" fill="none" stroke="${c.venc>=30?'#dc2626':'#eab308'}" stroke-width="3"/>`;
   if(sel)h+=`<circle r="15" fill="none" stroke="#111827" stroke-width="2.5" stroke-dasharray="3 2"/>`;
   h+=`<path d="M0 10 C-7 2 -9 -2 -9 -5 A9 9 0 1 1 9 -5 C9 -2 7 2 0 10Z" transform="translate(0,-6)" fill="${col}" stroke="#fff" stroke-width="1.6" ${est==='sin'?'stroke-dasharray="2 2"':''}/>`;
   const ic=est==='entregado'?'✓':est==='rechazado'||est==='reprog'?'✕':est==='parcial'?'½':(p.orden||'•');
   h+=`<text y="-7" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">${ic}</text>`;
   if(c.venc>0&&tAbierto(p)&&!p.aut)h+=`<g transform="translate(9,-17)"><circle r="6.5" fill="${c.venc>=30?'#dc2626':'#eab308'}"/><text y="3.5" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">!</text></g>`;
   if((est==='camino')&&etas[p.id]&&v.z>=12)h+=`<g transform="translate(12,-26)"><rect width="66" height="18" rx="9" fill="${col}"/><text x="33" y="12.5" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">ETA ${tH(etas[p.id])}</text></g>`;
   h+=`<title>${esc(c.nombre)} · ${TEST[est]}</title></g>`;g+=h;});
  D.moviles.forEach(m=>{if(TW.f.movil&&TW.f.movil!==m.id)return;const s=S(m.lat,m.lng),col=TMOV[m.id];const carga=tCarga(m);
   g+=`<g transform="translate(${s.x.toFixed(1)},${s.y.toFixed(1)})" data-k="m" data-id="${m.id}" style="cursor:pointer">
   <circle r="17" fill="${col}" opacity=".16"/><g transform="rotate(${(m.head||0).toFixed(0)})"><path d="M0 -15 L7 -5 L-7 -5Z" fill="${col}"/></g>
   <circle r="11" fill="${col}" stroke="#fff" stroke-width="2"/><text y="4" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">${m.id.slice(1)}</text>
   <g transform="translate(9,8)"><rect width="34" height="16" rx="8" fill="#111827"/><text x="17" y="11.5" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff">${carga} %</text></g>
   <title>${esc(m.nombre)} · ${esc(m.chofer)}</title></g>`;});
 }
 if(TW.lpts&&TW.lpts.length>1)g+=`<polygon points="${TW.lpts.map(q=>q.x.toFixed(1)+','+q.y.toFixed(1)).join(' ')}" fill="#111827" fill-opacity=".08" stroke="#111827" stroke-width="2" stroke-dasharray="6 4"/>`;
 svg.innerHTML=g+zl;tCalor();

}
function tCarga(m){const r=tRuta(m);const tot=r.reduce((a,p)=>a+p.bultos,0);const ab=r.filter(p=>tAbierto(p)).reduce((a,p)=>a+p.bultos,0)+r.filter(p=>p.estado==='rechazado'||p.estado==='reprog').reduce((a,p)=>a+p.bultos,0)+r.filter(p=>p.rech).reduce((a,p)=>a+p.rech.bultos,0);
 const enCamion=m.estado==='deposito'?tot:ab;return Math.min(100,Math.round(enCamion/m.cap*100));}
function tCalor(){
 const el=TW.el;if(!el)return;const cv=el.querySelector('.tw-heat');if(!cv)return;const{W,H}=tSize();const dpr=Math.min(2,window.devicePixelRatio||1);
 if(!TW.capas.calor){cv.style.display='none';return;}cv.style.display='block';cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
 const x=cv.getContext('2d');if(!x)return;x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);const D=TW.ds,v=tView();
 const w=c=>{if(TW.calor==='fact')return D.ped.filter(p=>p.com===c.id).reduce((a,p)=>a+p.monto,0)+c.cc*.3;
  if(TW.calor==='rech')return D.hist.filter(h=>h.com===c.id).length+D.ped.filter(p=>p.com===c.id&&(p.estado==='rechazado'||p.estado==='reprog'||p.estado==='parcial')).length*2;return c.env;};
 const cs=D.com.filter(c=>(!TW.f.zona||c.zona===TW.f.zona)&&(!TW.f.prev||c.prev===TW.f.prev));const mx=Math.max(1,...cs.map(w));const r=Math.max(22,Math.min(90,34*2**(v.z-12.6)));
 cs.forEach(c=>{const k=w(c)/mx;if(k<=0)return;const s=tScr(c.lat,c.lng);const gr=x.createRadialGradient(s.x,s.y,0,s.x,s.y,r);gr.addColorStop(0,`rgba(0,0,0,${(.25+.75*k).toFixed(2)})`);gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.beginPath();x.arc(s.x,s.y,r,0,7);x.fill();});
 let im;try{im=x.getImageData(0,0,cv.width,cv.height);}catch(e){return;}const d=im.data;
 const ramp=TW.calor==='rech'?[[254,240,138],[249,115,22],[185,28,28]]:TW.calor==='env'?[[167,243,208],[16,185,129],[6,78,59]]:[[191,219,254],[59,130,246],[30,27,140]];
 for(let i=0;i<d.length;i+=4){const a=d[i+3]/255;if(!a)continue;const t=Math.min(1,a*1.25),seg=t<.5?0:1,f=seg?(t-.5)*2:t*2,c0=ramp[seg],c1=ramp[seg+1];
  d[i]=c0[0]+(c1[0]-c0[0])*f;d[i+1]=c0[1]+(c1[1]-c0[1])*f;d[i+2]=c0[2]+(c1[2]-c0[2])*f;d[i+3]=Math.min(205,a*255*1.1);}
 x.putImageData(im,0,0);
}
function tBind(){
 const el=TW.el;if(!el||el.__tw)return;el.__tw=1;const pts=new Map();let st=null,pinch=null;
 el.addEventListener('pointerdown',e=>{if(e.target.closest('.tw-ctl,.tw-lbar,.tw-toasts,.tw-leg,.tw-chips'))return;el.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const r=el.getBoundingClientRect();
  if(pts.size===2){const[a,b]=[...pts.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:tView().z};st=null;return;}
  st={x:e.clientX,y:e.clientY,moved:false,t:e.target,c:Object.assign({},tView())};
  if(TW.lasso){TW.lpts=[{x:e.clientX-r.left,y:e.clientY-r.top}];}});
 el.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});const r=el.getBoundingClientRect();
  if(pinch&&pts.size===2){const[a,b]=[...pts.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);tView().z=Math.max(11,Math.min(17.5,pinch.z+Math.log2(d/pinch.d)));tReq();return;}
  if(!st)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;if(Math.abs(dx)+Math.abs(dy)>5)st.moved=true;
  if(TW.lasso&&TW.lpts){TW.lpts.push({x:e.clientX-r.left,y:e.clientY-r.top});tReq();return;}
  if(st.moved){const v=tView(),c=tW(st.c.lat,st.c.lng,v.z),q=tUnW(c.x-dx,c.y-dy,v.z);v.lat=q.lat;v.lng=q.lng;tReq();}});
 const fin=e=>{if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!st)return;const s=st;st=null;
  if(TW.lasso&&TW.lpts){tLazoFin();return;}
  if(!s.moved){const k=s.t.closest&&s.t.closest('[data-k]');if(k){const t=k.dataset.k;if(t==='p'||t==='m')tSelect(t,k.dataset.id);else if(t==='z'){TW.f.zona=TW.f.zona===k.dataset.id?'':k.dataset.id;tSyncF();}}}};
 el.addEventListener('pointerup',fin);el.addEventListener('pointercancel',fin);
 el.addEventListener('wheel',e=>{e.preventDefault();const r=el.getBoundingClientRect(),v=tView(),mx=e.clientX-r.left,my=e.clientY-r.top;const before=tFromScr(mx,my);
  v.z=Math.max(11,Math.min(17.5,v.z-e.deltaY*.0022));const after=tFromScr(mx,my);v.lat+=before.lat-after.lat;v.lng+=before.lng-after.lng;tReq();},{passive:false});
 if(typeof ResizeObserver!=='undefined'){const ro=new ResizeObserver(()=>tReq());ro.observe(el);}
}
let tRaf=0;function tReq(){if(tRaf)return;tRaf=requestAnimationFrame(()=>{tRaf=0;tDraw();});}
function tLazoFin(){
 const r=TW.lpts||[];TW.lpts=null;if(r.length<4){tDraw();return;}const poly=r.map(q=>{const g=tFromScr(q.x,q.y);return[g.lng,g.lat];});
 TW.lsel=TW.ds.ped.filter(p=>tAbierto(p)&&p.estado!=='descarga'&&tMatch(p)&&tInPoly([tCom(p.com).lng,tCom(p.com).lat],poly)).map(p=>p.id);
 TW.lasso=false;tDraw();tLbar();tCtl();
 if(!TW.lsel.length)toast('No quedaron pedidos pendientes adentro del área. Probá con un área más grande.');
}
function tLbar(){
 const b=document.getElementById('tw-lbar');if(!b)return;const n=TW.lsel.length;if(!n){b.hidden=true;b.innerHTML='';return;}b.hidden=false;
 const ms=TW.ds.moviles;
 b.innerHTML=`<b>${n} pedido${n>1?'s':''} seleccionado${n>1?'s':''}</b><span class="sm mut">${tP(TW.lsel.reduce((a,id)=>a+tPed(id).monto,0))} · ${TW.lsel.reduce((a,id)=>a+tPed(id).bultos,0)} bultos</span>
  <label class="sr" for="tw-lm">Móvil</label><select id="tw-lm">${ms.map(m=>`<option value="${m.id}">${m.nombre} · ${esc(m.chofer.split(' ')[0])} (${tCarga(m)} %)</option>`).join('')}</select>
  <button class="btn sm gold" data-act="twReasig">Reasignar ${n}</button><button class="btn sm" data-act="twDemora">Avisar demora por WhatsApp</button><button class="btn sm ghost" data-act="twLx" aria-label="Quitar selección">✕</button>`;
}

/* ---------- selección y panel ---------- */
function tSelect(t,id){TW.sel={t,id};if(t==='m'&&TW.tab==='fin')TW.tab='ruta';if(t==='p'&&TW.tab==='ruta')TW.tab='traz';tDrawer();tDraw();}
function tDrawer(){
 const box=document.getElementById('tw-drawer');if(!box)return;const s=TW.sel;if(!s){box.hidden=true;box.innerHTML='';document.body.classList.remove('tw-sheet');return;}
 box.hidden=false;document.body.classList.add('tw-sheet');box.innerHTML=s.t==='m'?tDrawerMov(tMov(s.id)):tDrawerPed(tPed(s.id));
}
function tDrawerUpd(){if(TW.sel&&!document.querySelector('#tw-drawer :focus'))tDrawer();}
function tTabs(list){return`<div class="ux-tabs tw-tabs" role="tablist">${list.map(([k,t])=>`<a role="tab" tabindex="0" data-act="twTab" data-t="${k}" aria-selected="${TW.tab===k}" class="${TW.tab===k?'on':''}">${t}</a>`).join('')}</div>`;}
function tDrawerPed(p){
 if(!p)return'';const c=tCom(p.com),m=tMov(p.movil),pv=tPrev(c.prev),est=tEstado(p),D=TW.ds;const eta=m?tEtas(m)[p.id]:null;
 const tabs=[['traz','Trazabilidad'],['fin','Finanzas y envases'],['com','Comunicación']];if(!tabs.some(x=>x[0]===TW.tab))TW.tab='traz';
 let body='';
 if(TW.tab==='traz'){body=`<ol class="tw-tl">${p.eventos.map(e=>`<li><span class="tw-dot"></span><div><b>${esc(e.txt)}</b> <span class="sm mut">${tH(e.h)}</span><br><span class="sm">${esc(e.det||'')}</span><br><span class="sm mut">${esc(e.usr)}${e.gps?' · GPS validado':''}</span></div></li>`).join('')}
  ${tAbierto(p)?`<li class="tw-fut"><span class="tw-dot"></span><div><b>${p.estado==='descarga'?'Descargando en la puerta':'Entrega / POD'}</b> <span class="sm mut">${eta?'estimada '+tH(eta):'sin móvil asignado'}</span></div></li>`:''}</ol>
  ${p.estado==='entregado'||p.estado==='parcial'?`<div class="tw-pod"><div class="tw-firma" aria-hidden="true"><svg viewBox="0 0 160 50"><path d="M8 34 C24 8 34 46 52 24 S78 12 90 30 S118 40 140 14" fill="none" stroke="#1e3a8a" stroke-width="2.4"/></svg></div><p class="sm"><b>Remito ${esc(p.remito)}</b> firmado por el encargado · llegada ${tH(p.llegada)} · ${p.dwell} min en la puerta</p></div>`:''}
  ${p.motivo?`<div class="${p.estado==='parcial'?'warnbox':'errbox'}"><b>Motivo:</b> ${esc(p.motivo)}</div>`:''}`;}
 if(TW.tab==='fin'){const rend=p.rendido;const blq=c.venc>0&&!p.aut&&(tAbierto(p)||p.estado==='reprog');
  body=`${blq?`<div class="errbox"><b>Bloqueo preventivo de crédito.</b> ${esc(c.nombre)} tiene ${tP(c.cc)} en cuenta corriente y ${c.venc} días de deuda vencida. El chofer no descarga sin autorización.<div class="row" style="margin-top:.5rem"><button class="btn sm red" data-act="twAut" data-id="${p.id}">Autorizar descarga excepcional</button></div></div>`:''}
  ${p.aut?`<div class="okbox">Descarga autorizada por <b>${esc(p.aut.por)}</b> a las ${tH(p.aut.h)}.</div>`:''}
  <div class="tw-kv"><span>Bultos</span><b>${p.bultosEnt!=null?p.bultosEnt+' de '+p.bultos:p.bultos}</b><span>Monto del pedido</span><b>${tP(p.monto)}</b>
  <span>Medio pactado</span><b>${TMED[p.medio]}</b><span>Rendido en puerta</span><b>${rend?tP(rend.monto)+' · '+TMED[rend.medio]:p.estado==='rechazado'||p.estado==='reprog'?'Nada (no se entregó)':'Pendiente'}</b>
  <span>Margen bruto</span><b>${p.margen} %</b><span>Cuenta corriente</span><b>${tP(c.cc)}${c.venc?` · <span class="red">${c.venc} días vencida</span>`:''}</b></div>
  <h4 style="margin:1rem 0 .3rem">Envases y cajones retornables</h4>
  <div class="tw-env"><div><span>Saldo anterior</span><b>${(p.estado==='entregado'||p.estado==='parcial')?c.env-p.envEnt+p.envRet:c.env}</b></div><div><span>Entrega hoy</span><b>+${p.envEnt}</b></div><div><span>Retira hoy</span><b>−${p.envRet}</b></div><div><span>Saldo final</span><b>${(p.estado==='entregado'||p.estado==='parcial')?c.env:c.env+p.envEnt-p.envRet}</b></div></div>`;}
 if(TW.tab==='com'){const lbl=m?`<b>${esc(m.chofer)}</b> · ${m.nombre}`:'Sin móvil';const ant=m?tPend(m).indexOf(p):-1;const mins=eta?Math.max(1,Math.round(eta-D.clock)):null;
  const msgs=[
   m&&['chofer',`Al chofer · ${m.chofer}`,`Hola ${m.chofer.split(' ')[0]}, priorizá la entrega #${p.id} de ${c.nombre} (${c.dir.split(',')[0]}) antes de las ${tH(Math.min(p.win[1],D.clock+60))}.`],
   ['prev',`Al preventista · ${pv.nombre}`,tMsgPrev(p)],
   ['cli',`Al cliente · ${c.nombre}`,`Hola ${c.nombre}, tu pedido de la distribuidora está ${ant>0?'a '+ant+' parada'+(ant>1?'s':''):'llegando'} (llegada estimada: ${mins?mins+' min':'en breve'}). Total a abonar: ${tP(p.monto)}${p.medio==='cc'?' (va a tu cuenta corriente)':''}.`]].filter(Boolean);
  body=`<p class="sm mut">Mensajes armados con los datos de este pedido. Se abren en WhatsApp listos para enviar. ${lbl}</p>
  ${msgs.map(([k,t,txt])=>`<div class="tw-msg"><b>${esc(t)}</b><p class="sm">${esc(txt)}</p><button class="btn sm gold" data-act="twWa" data-k="${k}" data-id="${p.id}">Enviar por WhatsApp</button></div>`).join('')}
  ${(p.com_log||[]).length?`<p class="sm mut">Enviados: ${p.com_log.map(x=>esc(x)).join(' · ')}</p>`:''}`;}
 return`<div class="tw-dh"><div style="min-width:0"><span class="tag" style="background:${TCOL[est]}22;color:${TCOL[est]}">${TEST[est]}</span><h3>${esc(c.nombre)}</h3><p class="sm mut">${esc(c.dir)} · ${p.id} · ${esc(pv.nombre)}${m?' · '+m.nombre:''}</p>
  <p class="sm">Ventana ${tH(p.win[0])}–${tH(p.win[1])}${eta&&tAbierto(p)?` · ETA <b>${tH(eta)}</b>`:''}${p.llegada?` · llegó ${tH(p.llegada)}`:''}</p></div>
  <button class="btn sm ghost" data-act="twCerrar" aria-label="Cerrar panel">✕</button></div>${tTabs(tabs)}<div class="tw-db">${body}</div>
  ${tAbierto(p)&&p.estado!=='descarga'?`<div class="tw-df"><label class="sr" for="tw-pm">Pasar a otro móvil</label><select id="tw-pm">${TW.ds.moviles.map(x=>`<option value="${x.id}" ${x.id===p.movil?'selected':''}>${x.nombre} · ${esc(x.chofer)}</option>`).join('')}</select><button class="btn sm" data-act="twPasar" data-id="${p.id}">${p.movil?'Reasignar':'Asignar'}</button></div>`:''}`;
}
function tMsgPrev(p){const c=tCom(p.com),m=tMov(p.movil),pv=tPrev(c.prev);
 return`Hola ${pv.nombre.split(' ')[0]}, el ${m?m.nombre:'reparto'} reporta inconveniente en ${c.nombre} (${p.motivo||'consulta por el pedido '+p.id}). Por favor contactalo antes de que el camión deje la zona.`;}
function tDrawerMov(m){
 if(!m)return'';const D=TW.ds,r=tRuta(m),et=tEtas(m),pl=tPlan(m);const tabs=[['ruta','Hoja de ruta'],['traz','Estado'],['com','Comunicación']];if(!tabs.some(x=>x[0]===TW.tab))TW.tab='ruta';
 const estL={deposito:'En el depósito',ruta:'En ruta',parada:'Descargando',vuelta:'Volviendo al depósito',fin:'Jornada terminada'}[m.estado];let body='';
 if(TW.tab==='ruta'){const pend=tPend(m).filter(p=>p.estado!=='descarga');
  body=`<ol class="tw-hr">${r.map(p=>{const c=tCom(p.com),est=tEstado(p),i=pend.indexOf(p);const atr=et[p.id]&&pl[p.id]?Math.round(et[p.id]-pl[p.id]):null;
   return`<li style="--c:${TCOL[est]}"><div style="flex:1;min-width:0"><b>${esc(c.nombre)}</b><br><span class="sm mut">${TEST[est]}${tAbierto(p)&&et[p.id]?' · ETA '+tH(et[p.id])+(atr!=null&&Math.abs(atr)>=5?` (${atr>0?'+':''}${atr} min)`:''):p.llegada?' · '+tH(p.llegada):''} · ${p.bultos} bultos</span></div>
   ${i>=0?`<button class="btn sm ghost" data-act="twOrd" data-id="${p.id}" data-d="-1" ${i===0?'disabled':''} aria-label="Subir ${esc(c.nombre)}">↑</button><button class="btn sm ghost" data-act="twOrd" data-id="${p.id}" data-d="1" ${i===pend.length-1?'disabled':''} aria-label="Bajar ${esc(c.nombre)}">↓</button>`:''}
   <button class="btn sm ghost" data-act="twSel" data-t="p" data-id="${p.id}" aria-label="Ver ${esc(c.nombre)}">›</button></li>`;}).join('')}</ol>
   <p class="sm mut">Subí o bajá una parada y la ruta y las horas estimadas se recalculan al instante.</p>`;}
 if(TW.tab==='traz'){const ent=r.filter(p=>p.estado==='entregado'||p.estado==='parcial'),rec=r.filter(p=>p.estado==='rechazado'||p.estado==='reprog');
  body=`<div class="tw-kv"><span>Estado</span><b>${estL}</b><span>Velocidad</span><b>${m.estado==='ruta'||m.estado==='vuelta'?Math.round(tVel(m)*60)+' km/h':'0 km/h'}</b><span>Carga</span><b>${tCarga(m)} % de ${m.cap} bultos</b>
  <span>Recorrido</span><b>${m.km.toFixed(1).replace('.',',')} km</b><span>Salida</span><b>${tH(m.salida)}</b><span>Paradas</span><b>${ent.length} entregadas · ${rec.length} con problema · ${tPend(m).length} pendientes</b>
  <span>Cobrado en efectivo</span><b>${tP(ent.filter(p=>p.medio==='ef').reduce((a,p)=>a+p.rendido.monto,0))}</b></div>`;}
 if(TW.tab==='com'){const nx=tPend(m)[0];const hoja=tPend(m).map((p,i)=>`${i+1}. ${tCom(p.com).nombre} (${tCom(p.com).dir.split(',')[0]})${et[p.id]?' ~'+tH(et[p.id]):''}`).join('\n');
  body=`<div class="tw-msg"><b>Hoja de ruta actualizada</b><p class="sm" style="white-space:pre-line">${esc(hoja||'Sin paradas pendientes.')}</p><button class="btn sm gold" data-act="twWa" data-k="hoja" data-id="${m.id}">Enviar a ${esc(m.chofer.split(' ')[0])}</button></div>
  ${nx?`<div class="tw-msg"><b>Priorizar la próxima</b><p class="sm">Hola ${esc(m.chofer.split(' ')[0])}, priorizá la entrega #${nx.id} de ${esc(tCom(nx.com).nombre)} (${esc(tCom(nx.com).dir.split(',')[0])}) antes de las ${tH(Math.min(nx.win[1],D.clock+60))}.</p><button class="btn sm" data-act="twWa" data-k="chofer" data-id="${nx.id}">Enviar por WhatsApp</button></div>`:''}`;}
 return`<div class="tw-dh"><div style="min-width:0"><span class="tag" style="background:${TMOV[m.id]}22;color:${TMOV[m.id]}">${estL}</span><h3>${m.nombre} · ${esc(m.chofer)}</h3><p class="sm mut">${esc(m.veh)} · ${esc(m.patente)} · ${esc(D.zonas.find(z=>z.id===m.zona).nombre)}</p></div>
 <button class="btn sm ghost" data-act="twCerrar" aria-label="Cerrar panel">✕</button></div>${tTabs(tabs)}<div class="tw-db">${body}</div>`;
}

/* ---------- tablero ---------- */
function tFiltrados(){return TW.ds.ped.filter(tMatch);}
function tKpis(){
 const P=tFiltrados(),D=TW.ds;const cer=P.filter(p=>!tAbierto(p));const ok=cer.filter(p=>p.estado==='entregado'||p.estado==='parcial');
 const otif=cer.length?Math.round(cer.filter(p=>p.estado==='entregado'&&p.llegada<=p.win[1]).length/cer.length*100):null;
 const ef=cer.length?Math.round(ok.length/cer.length*100):null;
 const sum=f=>P.filter(f).reduce((a,p)=>a+(p.rendido?p.rendido.monto:0),0);
 const seg={ef:sum(p=>p.rendido&&p.medio==='ef'),dig:sum(p=>p.rendido&&(p.medio==='qr'||p.medio==='tr')),cc:sum(p=>p.rendido&&p.medio==='cc'),pend:P.filter(tAbierto).reduce((a,p)=>a+p.monto,0)};
 const ms=D.moviles.filter(m=>!TW.f.movil||m.id===TW.f.movil);const bt=ms.reduce((a,m)=>a+tRuta(m).reduce((s,p)=>s+p.bultos,0),0),cap=ms.reduce((a,m)=>a+m.cap,0);
 const ent=ms.reduce((a,m)=>a+tRuta(m).filter(p=>p.bultosEnt!=null).reduce((s,p)=>s+p.bultosEnt,0),0);const costo=ms.reduce((a,m)=>a+m.costo,0);
 return{otif,ef,rech:ef==null?null:100-ef,seg,ocup:cap?Math.round(bt/cap*100):0,cxb:bt?Math.round(costo/bt):0,cxbReal:ent?Math.round(costo*Math.min(1,(D.clock-7*60)/(9*60))/ent):null,cer:cer.length,tot:P.length};
}
function tDelta(v,b,inv){if(v==null)return'';const d=v-b;const good=inv?d<=0:d>=0;return`<span class="tw-d ${good?'up':'dn'}">${d>=0?'▲':'▼'} ${Math.abs(d)}${inv?'':' pp'} vs. ayer</span>`;}
function tDonut(items){const tot=items.reduce((a,x)=>a+x.v,0)||1;let a=-Math.PI/2,h='';items.forEach(x=>{if(!x.v)return;const b=a+x.v/tot*Math.PI*2,lg=b-a>Math.PI?1:0;
  h+=`<path d="M${60+52*Math.cos(a)} ${60+52*Math.sin(a)} A52 52 0 ${lg} 1 ${60+52*Math.cos(b)} ${60+52*Math.sin(b)} L${60+30*Math.cos(b)} ${60+30*Math.sin(b)} A30 30 0 ${lg} 0 ${60+30*Math.cos(a)} ${60+30*Math.sin(a)}Z" fill="${x.c}"><title>${esc(x.k)}: ${x.v}</title></path>`;a=b;});
 return`<div class="tw-donut"><svg viewBox="0 0 120 120" role="img" aria-label="Causas de rechazo">${h}<text x="60" y="58" text-anchor="middle" font-size="18" font-weight="800" fill="currentColor">${items.reduce((a,x)=>a+x.v,0)}</text><text x="60" y="74" text-anchor="middle" font-size="9" fill="currentColor" opacity=".7">rechazos</text></svg>
 <ul>${items.map(x=>`<li><i style="background:${x.c}"></i><span>${esc(x.k)}</span><b>${x.v}</b><span class="mut">${Math.round(x.v/tot*100)} %</span></li>`).join('')}</ul></div>`;}
function tAviso(){const a=document.getElementById('tw-aviso');if(!a)return;const sin=TW.ds.ped.filter(p=>!p.movil&&tAbierto(p));
 a.innerHTML=sin.length?`<div class="warnbox row" style="gap:.5rem;align-items:center;flex-wrap:wrap"><span style="flex:1 1 220px"><b>${sin.length} pedido${sin.length>1?'s':''} sin móvil</b> (${esc([...new Set(sin.map(p=>TW.ds.zonas.find(z=>z.id===tCom(p.com).zona).nombre))].join(', '))}). Encerralos con el lazo y asignalos a un camión.</span><button class="btn sm" data-act="twLazo">◌ Usar el lazo</button></div>`:'';}
function tDash(){
 tAviso();const box=document.getElementById('tw-dash');if(!box||!TW.ds)return;const K=tKpis(),D=TW.ds,P=tFiltrados();const seg=K.seg,st=seg.ef+seg.dig+seg.cc+seg.pend||1;
 const segs=[['Efectivo en mano del chofer',seg.ef,'#16a34a'],['QR y transferencias acreditadas',seg.dig,'#2563eb'],['Cuenta corriente',seg.cc,'#7c3aed'],['Pendiente de cobro',seg.pend,'#d1d5db']];
 const kp=`<div class="tw-kpis">
  <div class="card tw-k"><span>OTIF · a tiempo y completo</span><b>${K.otif==null?'—':K.otif+' %'}</b>${tDelta(K.otif,D.ayer.otif)}<small>${K.cer} de ${K.tot} paradas cerradas</small></div>
  <div class="card tw-k"><span>Efectividad de entrega</span><b>${K.ef==null?'—':K.ef+' %'}</b>${tDelta(K.ef,D.ayer.efect)}<small>${K.rech==null?'':K.rech+' % rechazado o reprogramado'}</small></div>
  <div class="card tw-k"><span>Ocupación de flota</span><b>${K.ocup} %</b>${tDelta(K.ocup,D.ayer.ocup)}<small>Costo logístico ${tP(K.cxb)} por bulto${K.cxbReal?` · real hasta ahora ${tP(K.cxbReal)}`:''}</small></div>
  <div class="card tw-k tw-kw"><span>Rendición de valores en calle</span><b>${tP(seg.ef+seg.dig+seg.cc)}</b><small>de ${tP(st)} del día</small>
   <div class="tw-seg" role="img" aria-label="Rendición por medio de pago">${segs.map(([k,v,c])=>v?`<i style="flex:${v};background:${c}" title="${esc(k)}: ${tP(v)}"></i>`:'').join('')}</div>
   <ul class="tw-segl">${segs.map(([k,v,c])=>`<li><i style="background:${c}"></i>${esc(k)} <b>${tP(v)}</b></li>`).join('')}</ul></div></div>`;
 // causas de rechazo: últimos 30 días + hoy
 const hist=D.hist.filter(h=>{const c=tCom(h.com);return(!TW.f.zona||c.zona===TW.f.zona)&&(!TW.f.movil||h.movil===TW.f.movil)&&(!TW.f.prev||h.prev===TW.f.prev);});
 const hoy=P.filter(p=>p.estado==='rechazado'||p.estado==='reprog'||p.estado==='parcial').map(p=>({causa:p.estado==='reprog'?'Bloqueo crediticio':p.ev==='cerrado'?'Local cerrado':'Diferencia de precio',prev:tCom(p.com).prev,movil:p.movil}));
 const todos=hist.concat(hoy);const CC={'Local cerrado':'#dc2626','Sin efectivo en caja':'#f59e0b','Error de preventa':'#7c3aed','Mercadería dañada':'#0891b2','Diferencia de precio':'#ea580c','Bloqueo crediticio':'#be123c'};
 const items=Object.keys(CC).map(k=>({k,v:todos.filter(x=>x.causa===k).length,c:CC[k]})).filter(x=>x.v);
 const quien=TW.rk==='prev'?D.prev.map(v=>({n:v.nombre,v:todos.filter(x=>x.prev===v.id).length})):D.moviles.map(m=>({n:m.chofer+' ('+m.nombre+')',v:todos.filter(x=>x.movil===m.id).length}));const mq=Math.max(1,...quien.map(x=>x.v));
 const ch1=`<div class="card"><div class="row tw-ch"><h4>Causas de rechazo y devolución</h4><span class="sm mut">últimos 30 días + hoy</span></div>${items.length?tDonut(items):'<p class="mut">Sin rechazos con estos filtros.</p>'}
  <div class="row" style="gap:.3rem;margin:.6rem 0 .3rem"><button class="btn sm ${TW.rk==='prev'?'on':''}" data-act="twRk" data-k="prev">Por preventista</button><button class="btn sm ${TW.rk==='chofer'?'on':''}" data-act="twRk" data-k="chofer">Por chofer</button></div>
  ${quien.map(x=>`<div class="tw-hb"><span>${esc(x.n)}</span><div class="bar"><i style="width:${x.v/mq*100}%;background:#ea580c"></i></div><b>${x.v}</b></div>`).join('')}</div>`;
 // rendimiento por camión
 const ms=D.moviles.filter(m=>!TW.f.movil||m.id===TW.f.movil);
 const rows=ms.map(m=>{const r=tRuta(m).filter(tMatch);const e=r.filter(p=>p.bultosEnt!=null).reduce((a,p)=>a+p.bultosEnt,0),pe=r.filter(tAbierto).reduce((a,p)=>a+p.bultos,0),re=r.filter(p=>p.estado==='rechazado'||p.estado==='reprog').reduce((a,p)=>a+p.bultos,0)+r.filter(p=>p.rech).reduce((a,p)=>a+p.rech.bultos,0);
  const dw=r.filter(p=>p.dwell!=null);return{m,e,pe,re,tot:e+pe+re,dw:dw.length?Math.round(dw.reduce((a,p)=>a+p.dwell,0)/dw.length):null};});const mx=Math.max(1,...rows.map(x=>x.tot));
 const ch2=`<div class="card"><div class="row tw-ch"><h4>Rendimiento por camión</h4><span class="sm mut">bultos</span></div>${rows.map(x=>`<div class="tw-sb"><div class="row" style="justify-content:space-between"><b>${x.m.nombre} · ${esc(x.m.chofer)}</b><span class="sm mut">${x.dw==null?'':'permanencia '+x.dw+' min/parada'}</span></div>
  <div class="tw-stk" style="width:${x.tot/mx*100}%"><i style="flex:${x.e};background:#16a34a" title="Entregados ${x.e}"></i><i style="flex:${x.pe};background:#cbd5e1" title="Pendientes ${x.pe}"></i><i style="flex:${x.re};background:#dc2626" title="Rechazados ${x.re}"></i></div>
  <span class="sm">${x.e} entregados · ${x.pe} pendientes · ${x.re} rechazados</span></div>`).join('')}
  <ul class="tw-segl"><li><i style="background:#16a34a"></i>Entregados</li><li><i style="background:#cbd5e1"></i>Pendientes</li><li><i style="background:#dc2626"></i>Rechazados</li></ul></div>`;
 // curva horaria acumulada: planificado vs real
 const plan={};ms.forEach(m=>Object.assign(plan,tPlan(m)));const fins=Object.values(plan);const t1=Math.max(D.clock,...fins,...P.filter(p=>p.salidaParada!=null).map(p=>p.salidaParada))+20;const paso=t1-7*60>300?60:30;const hs=[];for(let t=Math.floor((7*60+30)/paso)*paso;t<=Math.ceil(t1/paso)*paso;t+=paso)hs.push(t);const PP=P.filter(p=>p.movil&&(!TW.f.movil||p.movil===TW.f.movil));
 const sp=hs.map(t=>PP.filter(p=>plan[p.id]!=null&&plan[p.id]<=t).length),sr=hs.map(t=>t>D.clock+30?null:PP.filter(p=>p.salidaParada!=null&&p.salidaParada<=t).length);
 const W=380,H=220,mxy=Math.max(1,PP.length),X=i=>40+i*(W-60)/(hs.length-1),Y=v=>H-26-v/mxy*(H-46);
 const line=(arr,c,dash,area)=>{const pts=arr.map((v,i)=>v==null?null:[X(i),Y(v)]).filter(Boolean);if(!pts.length)return'';const d='M'+pts.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' L');
  return(area?`<path d="${d} L${pts[pts.length-1][0]} ${Y(0)} L${pts[0][0]} ${Y(0)}Z" fill="${c}" opacity=".12"/>`:'')+`<path d="${d}" fill="none" stroke="${c}" stroke-width="2.5" ${dash?'stroke-dasharray="6 5"':''}/>`+pts.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="3" fill="${c}"/>`).join('');};
 const ult=sr.filter(v=>v!=null).length-1;const dif=ult>=0?sr[ult]-sp[ult]:0;
 const ch3=`<div class="card"><div class="row tw-ch"><h4>Entregas por hora: real vs. planificado</h4><span class="tw-d ${dif>=0?'up':'dn'}">${dif>=0?'Adelantados':'Demorados'} ${Math.abs(dif)} parada${Math.abs(dif)===1?'':'s'}</span></div>
  <svg viewBox="0 0 ${W} ${H}" class="tw-line" role="img" aria-label="Curva de entregas">${[0,.5,1].map(f=>`<line x1="40" x2="${W-20}" y1="${Y(mxy*f)}" y2="${Y(mxy*f)}" stroke="currentColor" opacity=".1"/><text x="32" y="${Y(mxy*f)+4}" text-anchor="end" font-size="12" fill="currentColor" opacity=".6">${Math.round(mxy*f)}</text>`).join('')}
  ${hs.map((t,i)=>i%Math.ceil(hs.length/6)?'':`<text x="${X(i)}" y="${H-8}" text-anchor="middle" font-size="12" fill="currentColor" opacity=".6">${tH(t)}</text>`).join('')}${line(sp,'#94a3b8',true,false)}${line(sr,'#2563eb',false,true)}
  <line x1="${Math.min(W-20,Math.max(40,40+(D.clock-hs[0])/(hs[hs.length-1]-hs[0])*(W-60)))}" x2="${Math.min(W-20,Math.max(40,40+(D.clock-hs[0])/(hs[hs.length-1]-hs[0])*(W-60)))}" y1="14" y2="${H-26}" stroke="#ef4444" stroke-dasharray="3 3"/></svg>
  <ul class="tw-segl"><li><i style="background:#2563eb"></i>Real</li><li><i style="background:#94a3b8"></i>Planificado</li><li><i style="background:#ef4444"></i>Ahora ${tH(D.clock)}</li></ul></div>`;
 // manifiesto de liquidación ciega
 const man=ms.map(m=>{const r=tRuta(m);const sal=r.reduce((a,p)=>a+p.bultos,0),dev=r.filter(p=>p.estado==='rechazado'||p.estado==='reprog').reduce((a,p)=>a+p.bultos,0)+r.filter(p=>p.rech).reduce((a,p)=>a+p.rech.bultos,0);
  const rec=r.filter(p=>p.rendido).reduce((a,p)=>a+p.envRet,0);const by=k=>r.filter(p=>p.rendido&&p.medio===k).reduce((a,p)=>a+p.rendido.monto,0);return{m,sal,dev,rec,ef:by('ef'),dig:by('qr')+by('tr'),cc:by('cc')};});
 const ch4=`<div class="card tw-man"><div class="row tw-ch"><h4>Manifiesto de liquidación ciega</h4><label class="chk sm"><input type="checkbox" data-twc="twCiego" ${TW.ciegoOn?'checked':''}> Modo ciego (el chofer declara sin ver lo esperado)</label></div>
  <div class="tw-tw"><table><thead><tr><th>Móvil</th><th>Bultos salidos</th><th>Devueltos</th><th>Cajones recuperados</th><th>Efectivo a rendir</th><th>QR y transf.</th><th>Cta. cte.</th>${TW.ciegoOn?'<th>Declarado</th><th>Diferencia</th>':''}</tr></thead>
  <tbody>${man.map(x=>{const dec=TW.dec[x.m.id];const df=dec==null||dec===''?null:Number(dec)-x.ef;return`<tr><td><b>${x.m.nombre}</b><br><span class="sm mut">${esc(x.m.chofer)} · ${x.m.estado==='fin'?'en depósito':'en calle'}</span></td><td>${x.sal}</td><td>${x.dev}</td><td>${x.rec}</td>
   <td>${TW.ciegoOn&&x.m.estado!=='fin'?'<span class="mut">oculto</span>':tP(x.ef)}</td><td>${tP(x.dig)}</td><td>${tP(x.cc)}</td>
   ${TW.ciegoOn?`<td><input type="number" inputmode="numeric" min="0" step="100" class="tw-dec" data-twc="twDec" data-id="${x.m.id}" value="${dec==null?'':esc(dec)}" aria-label="Efectivo declarado por ${esc(x.m.chofer)}" placeholder="$"></td><td>${df==null?'—':`<b class="${df===0?'':'red'}">${df===0?'Cuadra':(df>0?'+':'')+tP(df).replace('$ -','-$ ')}</b>`}</td>`:''}</tr>`;}).join('')}</tbody></table></div>
  <p class="sm mut">Al volver al Parque Industrial, cada chofer declara el efectivo sin ver lo esperado. La diferencia aparece recién cuando se carga lo declarado.</p></div>`;
 const foc=document.activeElement&&document.activeElement.classList.contains('tw-dec')?document.activeElement.dataset.id:null;
 box.innerHTML=kp+`<div class="tw-grid">${ch1}${ch2}${ch3}</div>`+ch4;
 if(foc){const i=box.querySelector(`.tw-dec[data-id="${foc}"]`);if(i){i.focus();const v=i.value;i.value='';i.value=v;}}
}

/* ---------- controles ---------- */
function tReloj(){const r=document.getElementById('tw-clock');if(r)r.textContent=tH(TW.ds.clock);const b=document.getElementById('tw-play');if(b){b.innerHTML=TW.run?'❚❚ Pausar jornada':'▶ Simular jornada en vivo';b.classList.toggle('gold',!TW.run);}}
function tCtl(){const c=document.getElementById('tw-capas');if(!c)return;
 c.querySelectorAll('[data-act=twCapa]').forEach(b=>{const on=TW.capas[b.dataset.k];b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);});
 const lz=document.getElementById('tw-lazo');if(lz){lz.classList.toggle('on',TW.lasso);lz.setAttribute('aria-pressed',TW.lasso);}
 const hs=document.getElementById('tw-heat');if(hs){hs.hidden=!TW.capas.calor;hs.value=TW.calor;}
 const map=TW.el;if(map)map.classList.toggle('tw-lasso',TW.lasso);
 const lg=document.getElementById('tw-hleg');if(lg){lg.hidden=!TW.capas.calor;lg.innerHTML=TW.capas.calor?`Mapa de calor: <b>${{fact:'facturación del día',rech:'frecuencia de rechazos',env:'saldo de envases'}[TW.calor]}</b>`:'';}
}
function tSyncF(){['zona','movil','prev'].forEach(k=>{const s=document.getElementById('tw-f-'+k);if(s)s.value=TW.f[k];});tDraw();tDash();}
function tPlay(on){
 TW.run=on;clearInterval(TW.timer);TW.timer=null;
 if(on){TW.timer=setInterval(()=>{if(curScreen!=='torre'||!document.getElementById('tw-map')){tPlay(false);return;}
  if(TW.ds.clock>=18*60){tPlay(false);toast('Jornada terminada. Revisá la liquidación en el tablero.');return;}tTick(TW.speed*0.2);},200);}
 tReloj();
}
A.twPlay=()=>tPlay(!TW.run);
A.twVel=el=>{TW.speed=+el.dataset.v;document.querySelectorAll('[data-act=twVel]').forEach(b=>b.classList.toggle('on',+b.dataset.v===TW.speed));};
A.twReset=()=>{const go=()=>{tPlay(false);try{localStorage.removeItem(TKEY);}catch(e){}TW.ds=null;TW.sel=null;TW.lsel=[];TW.dec={};TW.f={zona:'',movil:'',prev:''};tNueva();rerender();toast('Torre de Control reiniciada: jornada de ejemplo a las 09:20');};
 if(typeof confirmBox==='function')confirmBox('Reiniciar la Torre de Control','Vuelven los 28 pedidos de ejemplo de Salta con la jornada en marcha a las 09:20. Se pierden las reasignaciones y autorizaciones que hiciste.',go,'Reiniciar');else go();};
A.twCapa=el=>{const k=el.dataset.k;TW.capas[k]=!TW.capas[k];tCtl();tDraw();};
A.twHeat=el=>{TW.calor=el.value;tCtl();tDraw();};
A.twLazo=()=>{TW.lasso=!TW.lasso;TW.lpts=null;if(TW.lasso){TW.lsel=[];tLbar();toast('Dibujá con el dedo o el mouse un área alrededor de los pedidos');}tCtl();tDraw();};
A.twLx=()=>{TW.lsel=[];tLbar();tDraw();};
A.twReasig=()=>{const mid=(document.getElementById('tw-lm')||{}).value;const n=tAsignar(TW.lsel.slice(),mid);TW.lsel=[];tLbar();tDraw();tDash();tDrawer();
 toast(n?`${n} pedido${n>1?'s':''} pasado${n>1?'s':''} a ${tMov(mid).nombre}. Ruta y horas recalculadas.`:'Esos pedidos ya estaban en ese móvil o no se pueden mover.');};
A.twDemora=()=>{const ps=TW.lsel.map(tPed);const etas={};TW.ds.moviles.forEach(m=>Object.assign(etas,tEtas(m)));
 modal('Avisar demora por WhatsApp',`<p class="sm mut">Un mensaje por comercio, con la hora estimada actualizada. Tocá cada uno para abrirlo en WhatsApp.</p>${ps.map(p=>{const c=tCom(p.com);const t=etas[p.id]?tH(etas[p.id]+15):'más tarde';
  const txt=`Hola ${c.nombre}, te avisamos de la distribuidora que tu pedido viene con demora. Llegamos aprox. a las ${t}. Disculpá las molestias.`;
  return`<div class="tw-msg"><b>${esc(c.nombre)}</b><p class="sm">${esc(txt)}</p><a class="btn sm gold" href="${waLink(txt,c.tel)}" target="_blank" rel="noopener" data-twlog data-id="${p.id}">Enviar</a></div>`;}).join('')}`,{ok:false,cancelText:'Cerrar',wide:true});};
function tDemLog(el){const p=tPed(el.dataset.id);if(p){tEv(p,'Aviso de demora enviado','Por WhatsApp al comercio',tUsr());tSave(true);}el.textContent='Enviado ✓';}
if(typeof document!=='undefined'&&!window.__twEv){window.__twEv=1;
 document.addEventListener('change',e=>{const el=e.target.closest&&e.target.closest('[data-twc]');if(!el)return;const f=A[el.dataset.twc];if(f)f(el,e);});
 document.addEventListener('click',e=>{const el=e.target.closest&&e.target.closest('[data-twlog]');if(el)tDemLog(el);});}
A.twSel=el=>{tSelect(el.dataset.t,el.dataset.id);const d=document.getElementById('tw-drawer');if(d&&window.innerWidth<900)d.scrollTop=0;};
A.twCerrar=()=>{TW.sel=null;tDrawer();tDraw();};
A.twTab=el=>{TW.tab=el.dataset.t;tDrawer();};
A.twOrd=el=>tReordenar(el.dataset.id,+el.dataset.d);
A.twAut=el=>tAutorizar(el.dataset.id);
A.twPasar=el=>{const mid=(document.getElementById('tw-pm')||{}).value;const n=tAsignar([el.dataset.id],mid);tDraw();tDash();tDrawer();toast(n?'Pedido pasado a '+tMov(mid).nombre:'El pedido ya está en ese móvil');};
A.twWa=el=>{const k=el.dataset.k,id=el.dataset.id;let tel='',txt='',p=null;
 if(k==='hoja'){const m=tMov(id),et=tEtas(m);tel=m.tel;txt=`Hola ${m.chofer.split(' ')[0]}, hoja de ruta actualizada (${tH(TW.ds.clock)}):\n`+tPend(m).map((q,i)=>`${i+1}. ${tCom(q.com).nombre} - ${tCom(q.com).dir.split(',')[0]}${et[q.id]?' (~'+tH(et[q.id])+')':''}`).join('\n');}
 else{p=tPed(id);const c=tCom(p.com),m=tMov(p.movil),pv=tPrev(c.prev);const D=TW.ds;
  if(k==='chofer'){tel=m.tel;txt=`Hola ${m.chofer.split(' ')[0]}, priorizá la entrega #${p.id} de ${c.nombre} (${c.dir.split(',')[0]}) antes de las ${tH(Math.min(p.win[1],D.clock+60))}.`;}
  if(k==='prev'){tel=pv.tel;txt=tMsgPrev(p);}
  if(k==='cli'){tel=c.tel;const et=m?tEtas(m)[p.id]:null,ant=m?tPend(m).indexOf(p):-1;txt=`Hola ${c.nombre}, tu pedido de la distribuidora está ${ant>0?'a '+ant+' parada'+(ant>1?'s':''):'llegando'} (llegada estimada: ${et?Math.max(1,Math.round(et-D.clock))+' min':'en breve'}). Total a abonar: ${tP(p.monto)}${p.medio==='cc'?' (va a tu cuenta corriente)':''}.`;}}
 const w=window.open(waLink(txt,tel),'_blank');if(!w)location.href=waLink(txt,tel);
 const quien={hoja:'chofer (hoja de ruta)',chofer:'chofer',prev:'preventista',cli:'cliente'}[k];toast('Mensaje al '+quien+' listo en WhatsApp');
 if(p){(p.com_log=p.com_log||[]).push(quien+' '+tH(TW.ds.clock));tEv(p,'Mensaje por WhatsApp al '+quien,txt.slice(0,120),tUsr());tSave(true);if(TW.sel)tDrawer();}};
A.twRk=el=>{TW.rk=el.dataset.k;tDash();};
A.twCiego=el=>{TW.ciegoOn=el.checked;tDash();};
A.twDec=el=>{TW.dec[el.dataset.id]=el.value;tDash();};
A.twZoom=el=>{const v=tView();v.z=Math.max(11,Math.min(17.5,v.z+(+el.dataset.d)));tDraw();};
A.twCentrar=()=>{TW.view=null;tDraw();};
A.twFiltro=el=>{TW.f[el.dataset.k]=el.value;tDraw();tDash();const sm=document.querySelector('.tw-fdet summary');const n=[TW.f.zona,TW.f.movil,TW.f.prev].filter(Boolean).length;if(sm)sm.textContent='Filtros'+(n?' · '+n+' activo(s)':': zona, móvil y preventista');};

/* ---------- pantalla ---------- */
function torreHTML(){
 tLoad();tCss();const D=TW.ds;
 const sel=(k,lbl,opts)=>`<label class="sr" for="tw-f-${k}">${lbl}</label><select id="tw-f-${k}" data-twc="twFiltro" data-k="${k}"><option value="">${lbl}: todas</option>${opts.map(([v,t])=>`<option value="${v}" ${TW.f[k]===v?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
 return`<div class="row tw-head"><h1 class="sp">Torre de Control</h1><span class="tag sim">Demo · Salta Capital</span><span class="tw-clk" aria-live="off">🕒 <b id="tw-clock">${tH(D.clock)}</b></span>
  <a class="btn sm" href="#panel/carga">Armado de cargas</a></div>
 <div class="card tw-bar">
  <div class="row tw-sim"><button id="tw-play" class="btn ${TW.run?'':'gold'}" data-act="twPlay">${TW.run?'❚❚ Pausar jornada':'▶ Simular jornada en vivo'}</button>
   <div class="tw-vel" role="group" aria-label="Velocidad">${[1,5,10].map(v=>`<button class="btn sm ${TW.speed===v?'on':''}" data-act="twVel" data-v="${v}" aria-pressed="${TW.speed===v}">${v}x</button>`).join('')}</div>
   <button class="btn sm ghost" data-act="twReset">↺ Resetear demo</button></div>
  <details class="tw-fdet" ${window.innerWidth>=900||TW.f.zona||TW.f.movil||TW.f.prev?'open':''}><summary>Filtros${[TW.f.zona,TW.f.movil,TW.f.prev].filter(Boolean).length?' · '+[TW.f.zona,TW.f.movil,TW.f.prev].filter(Boolean).length+' activo(s)':': zona, móvil y preventista'}</summary>
  <div class="row tw-fil">${sel('zona','Zona',D.zonas.map(z=>[z.id,z.nombre]))}${sel('movil','Móvil',D.moviles.map(m=>[m.id,m.nombre+' · '+m.chofer]))}${sel('prev','Preventista',D.prev.map(p=>[p.id,p.nombre]))}</div></details></div>
 <div id="tw-aviso"></div>
 <div class="tw-wrap"><div id="tw-map" class="tw-map" aria-label="Mapa de repartos de Salta. Usá la lista de la hoja de ruta para navegar con teclado." role="application">
  <div class="tw-tiles" aria-hidden="true"></div><canvas class="tw-heat" aria-hidden="true"></canvas><svg class="tw-svg" xmlns="http://www.w3.org/2000/svg"></svg>
  <div class="tw-chips" id="tw-capas"><button class="btn sm" data-act="twCapa" data-k="flota">🚚 Flota y paradas</button><button class="btn sm" data-act="twCapa" data-k="zonas">⬡ Zonas</button><button class="btn sm" data-act="twCapa" data-k="calor">🔥 Calor</button>
   <label class="sr" for="tw-heat">Tipo de mapa de calor</label><select id="tw-heat" data-twc="twHeat" hidden><option value="fact">Facturación $</option><option value="rech">Rechazos</option><option value="env">Envases</option></select>
   <button class="btn sm" id="tw-lazo" data-act="twLazo">◌ Lazo</button></div>
  <div class="tw-ctl"><button class="btn sm" data-act="twZoom" data-d="1" aria-label="Acercar">+</button><button class="btn sm" data-act="twZoom" data-d="-1" aria-label="Alejar">−</button><button class="btn sm" data-act="twCentrar" aria-label="Centrar en Salta">◎</button></div>
  <div class="tw-toasts" id="tw-toasts" aria-live="polite"></div>
  <div class="tw-leg" aria-hidden="true">${['entregado','camino','pend','sin','parcial','rechazado'].map(k=>`<span><i style="background:${TCOL[k]}"></i>${TEST[k].split(' · ')[0]}</span>`).join('')}<span><i style="background:#fff;box-shadow:inset 0 0 0 3px #eab308"></i>Deuda vencida</span><span id="tw-hleg" hidden></span></div>
  <div class="tw-lbar" id="tw-lbar" hidden></div><div class="tw-attr">© OpenStreetMap · © CARTO</div></div>
  <aside id="tw-drawer" class="tw-drawer" hidden aria-label="Detalle"></aside></div>
 <div class="row tw-movs">${D.moviles.map(m=>`<button class="btn sm" data-act="twSel" data-t="m" data-id="${m.id}"><i class="tw-mi" style="background:${TMOV[m.id]}"></i>${m.nombre} · ${esc(m.chofer)}</button>`).join('')}</div>
 <div id="tw-dash"></div>`;
}
function torreAfter(){TW.el=document.getElementById('tw-map');TW.tiles=new Map();tBind();tCtl();tDraw();tDash();tDrawer();tLbar();tReloj();
}
function tCss(){if(document.getElementById('tw-css'))return;const s=document.createElement('style');s.id='tw-css';s.textContent=`
.tw-head{gap:.6rem;align-items:center;flex-wrap:wrap}.tw-clk{font-variant-numeric:tabular-nums;padding:.3rem .7rem;border-radius:99px;background:var(--card);border:1px solid var(--line)}
.tw-bar{display:grid;gap:.5rem;margin-bottom:.7rem}.tw-bar .row{gap:.4rem;flex-wrap:wrap;align-items:center}.tw-vel{display:inline-flex;gap:.25rem}
.tw-fil{margin-top:.5rem}.tw-fil select{flex:1 1 160px;min-width:0}.tw-fdet summary{cursor:pointer;font-weight:600;font-size:.88rem;min-height:36px;display:flex;align-items:center}
.tw-chips{position:absolute;left:.6rem;right:3.6rem;top:.6rem;display:flex;gap:.35rem;overflow-x:auto;scrollbar-width:none;z-index:2;padding-bottom:2px}.tw-chips::-webkit-scrollbar{display:none}
.tw-chips .btn,.tw-chips select{flex:none;min-height:38px;background:#fff;color:#111;border-color:#d4d4d8;box-shadow:0 2px 8px rgba(0,0,0,.12);white-space:nowrap}.tw-chips select{border-radius:12px;padding:0 .5rem;width:auto}
.tw-chips .btn.on{background:#111827;color:#fff;border-color:#111827}
.tw-wrap{position:relative;display:flex;gap:.7rem;align-items:stretch}
.tw-map{position:relative;flex:1;min-width:0;height:min(66vh,620px);min-height:360px;border-radius:var(--r);overflow:hidden;border:1px solid var(--line);touch-action:none;user-select:none;cursor:grab;
 background:#eef0ee repeating-linear-gradient(0deg,transparent 0 39px,rgba(0,0,0,.04) 39px 40px),repeating-linear-gradient(90deg,transparent 0 39px,rgba(0,0,0,.04) 39px 40px)}
.tw-map:active{cursor:grabbing}.tw-map.tw-lasso{cursor:crosshair;outline:3px dashed var(--ink);outline-offset:-3px}
.tw-tiles,.tw-svg,.tw-heat{position:absolute;inset:0;width:100%;height:100%}.tw-tiles img{max-width:none;user-select:none;pointer-events:none}.tw-heat{pointer-events:none;mix-blend-mode:multiply}
.tw-svg text{font-family:inherit}.tw-pulse{animation:twp 1.4s ease-out infinite;transform-box:fill-box;transform-origin:center}@keyframes twp{0%{transform:scale(.6);opacity:.5}100%{transform:scale(1.6);opacity:0}}
.tw-ctl{position:absolute;right:.6rem;top:.6rem;display:grid;gap:.3rem}.tw-ctl .btn{min-width:40px;min-height:40px;padding:0;font-size:1.1rem;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.tw-attr{position:absolute;right:.4rem;bottom:.3rem;font-size:.66rem;background:rgba(255,255,255,.8);padding:.05rem .35rem;border-radius:4px;color:#444}
.tw-leg{position:absolute;left:.6rem;bottom:.6rem;display:flex;flex-wrap:wrap;gap:.35rem .7rem;max-width:calc(100% - 7rem);background:rgba(255,255,255,.92);border-radius:12px;padding:.4rem .6rem;font-size:.72rem;color:#222;box-shadow:0 2px 10px rgba(0,0,0,.1)}
.tw-leg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:.3rem;vertical-align:-1px}
.tw-toasts{position:absolute;left:.6rem;top:3.4rem;display:grid;gap:.4rem;width:min(330px,calc(100% - 4.5rem));z-index:3}
.tw-toast{background:#111827;color:#fff;border-radius:14px;padding:.6rem .75rem;box-shadow:0 8px 24px rgba(0,0,0,.25);animation:twin .25s ease-out}.tw-toast.bad{border-left:5px solid #ef4444}
.tw-toast p{margin:.15rem 0 .45rem;font-size:.82rem;opacity:.9}.tw-tb{display:flex;gap:.3rem;flex-wrap:wrap}.tw-tb .btn{min-height:36px;color:#111;background:#fff}.tw-tb .btn.gold{background:var(--gold);color:#1b1100}.tw-tb .btn.ghost{background:transparent;color:#fff;border-color:#4b5563}
@keyframes twin{from{transform:translateY(-6px);opacity:0}}
.tw-lbar{position:absolute;left:50%;bottom:3.4rem;transform:translateX(-50%);display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;justify-content:center;background:#fff;color:#111;border-radius:16px;padding:.55rem .7rem;box-shadow:0 10px 30px rgba(0,0,0,.25);width:min(640px,calc(100% - 1.2rem));z-index:4}
.tw-lbar select{flex:1 1 180px;min-width:0}
.tw-drawer{width:380px;flex:none;max-height:min(66vh,620px);min-height:360px;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:.9rem;box-shadow:0 6px 24px rgba(0,0,0,.08)}
.tw-dh{display:flex;gap:.5rem;align-items:flex-start;justify-content:space-between}.tw-dh h3{margin:.3rem 0 .1rem;font-size:1.1rem}.tw-dh p{margin:.1rem 0}
.tw-tabs{margin:.6rem 0}.tw-db{min-height:120px}
.tw-tl{list-style:none;margin:0;padding:0 0 0 .2rem;border-left:2px solid var(--line)}.tw-tl li{display:flex;gap:.6rem;padding:.35rem 0 .55rem .7rem;position:relative}
.tw-dot{position:absolute;left:-.42rem;top:.6rem;width:.7rem;height:.7rem;border-radius:50%;background:var(--ok);border:2px solid var(--card)}.tw-fut .tw-dot{background:#cbd5e1}.tw-fut{opacity:.75}
.tw-pod{display:flex;gap:.6rem;align-items:center;border:1px dashed var(--line);border-radius:12px;padding:.5rem;margin:.4rem 0}.tw-firma{width:110px;flex:none;background:#fff;border-radius:8px;border:1px solid #e5e7eb}
.tw-kv{display:grid;grid-template-columns:auto 1fr;gap:.35rem .8rem;font-size:.9rem}.tw-kv span{color:var(--mut)}.tw-kv b{text-align:right}
.tw-env{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem}.tw-env div{background:var(--bg);border-radius:12px;padding:.5rem;text-align:center}.tw-env span{display:block;font-size:.72rem;color:var(--mut)}.tw-env b{font-size:1.2rem}
.tw-msg{border:1px solid var(--line);border-radius:12px;padding:.6rem;margin:.5rem 0}.tw-msg p{margin:.3rem 0 .5rem}
.tw-df{display:flex;gap:.4rem;margin-top:.8rem;border-top:1px solid var(--line);padding-top:.7rem}.tw-df select{flex:1;min-width:0}
.tw-hr{list-style:none;margin:0;padding:0}.tw-hr li{display:flex;gap:.3rem;align-items:center;padding:.45rem .2rem .45rem .6rem;border-left:4px solid var(--c);border-bottom:1px solid var(--line)}.tw-hr .btn{min-width:38px;min-height:38px;padding:0}
.tw-movs{gap:.4rem;margin:.6rem 0;flex-wrap:wrap}.tw-mi{display:inline-block;width:10px;height:10px;border-radius:50%}
.tw-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin:.6rem 0}.tw-k{display:flex;flex-direction:column;gap:.15rem}.tw-k span{font-size:.78rem;color:var(--mut)}.tw-k>b{font-size:1.55rem}.tw-k small{color:var(--mut);font-size:.75rem}
.tw-d{font-size:.75rem;font-weight:700}.tw-d.up{color:var(--ok)}.tw-d.dn{color:var(--red)}
.tw-seg{display:flex;height:12px;border-radius:99px;overflow:hidden;background:#eee;margin:.4rem 0}.tw-seg i{display:block;transition:flex .4s}
.tw-segl{list-style:none;padding:0;margin:.3rem 0 0;display:flex;flex-wrap:wrap;gap:.2rem .8rem;font-size:.74rem}.tw-segl i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:.3rem}
.tw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-bottom:.6rem}.tw-ch{justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:.4rem}.tw-ch h4{margin:0}
.tw-donut{display:flex;gap:.8rem;align-items:center;flex-wrap:wrap}.tw-donut svg{width:130px;flex:none}.tw-donut ul{list-style:none;padding:0;margin:0;font-size:.8rem;flex:1 1 170px;min-width:0}.tw-donut li{display:grid;grid-template-columns:10px 1fr auto 2.6rem;gap:.4rem;align-items:center;padding:.12rem 0}.tw-donut li .mut{text-align:right}.tw-donut li i{width:9px;height:9px;border-radius:3px}
.tw-hb{display:grid;grid-template-columns:minmax(90px,1fr) 2fr auto;gap:.5rem;align-items:center;font-size:.8rem;margin:.2rem 0}
.tw-sb{margin:.55rem 0}.tw-stk{display:flex;height:16px;border-radius:6px;overflow:hidden;margin:.3rem 0;min-width:30px}.tw-stk i{display:block}
.tw-line{width:100%;height:auto;color:var(--ink)}.tw-grid>*,.tw-kpis>*{min-width:0}.tw-tw{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}.tw-tw table{min-width:640px}.tw-man{min-width:0;overflow:hidden}.tw-man input{max-width:130px;min-height:40px}
.sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:1100px){.tw-kpis{grid-template-columns:repeat(2,1fr)}.tw-grid{grid-template-columns:1fr 1fr}.tw-grid>:last-child{grid-column:1/-1}}
@media(max-width:900px){.tw-drawer{position:fixed;left:0;right:0;bottom:0;width:auto;max-height:72vh;min-height:0;border-radius:20px 20px 0 0;z-index:60;box-shadow:0 -12px 40px rgba(0,0,0,.25)}
 .tw-map{height:62vh}.tw-grid{grid-template-columns:1fr}.tw-leg{font-size:.66rem;max-width:calc(100% - 4rem)}.tw-env{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.tw-kpis{grid-template-columns:1fr 1fr}.tw-kw,.tw-kpis>:nth-child(3){grid-column:1/-1}.tw-k>b{font-size:1.25rem}.tw-sim #tw-play{flex:1 1 auto}.tw-sim .ghost{padding:.4rem .6rem}.tw-leg{font-size:.6rem;gap:.15rem .45rem;padding:.25rem .45rem;max-width:calc(100% - 1.2rem);bottom:1.1rem}.tw-head h1{font-size:1.4rem}.tw-toast p{font-size:.78rem;margin:.1rem 0 .35rem}.tw-toast{padding:.5rem .6rem}.tw-bar{padding:.7rem}}`;
 document.head.appendChild(s);}

reg('torre','Torre de Control','truck','reparto',torreHTML,torreAfter,'Operación');
SCREENS.torre.show=()=>typeof torreSemilla==='function'&&typeof repOn==='function'&&repOn();
NAV.push(['torre','Operación']);
