/* ===== V26.78 · Gestión integral — trabajo en la calle y canales del cliente mayorista =====
   Preventa: cartera por día y zona, pedido en el cliente (sin señal también), repetir pedido, visita sin pedido, cobranza en la calle,
             rendición ciega en caja, tablero del supervisor y comisiones.
   GPS: posición del preventista/repartidor SÓLO en jornada, en horario laboral y con consentimiento firmado en la app; mapa del equipo.
   Bot de pedidos por WhatsApp: se engancha a Atención al cliente (CRM); catálogo, carrito, repetir, saldo y derivación a una persona.
   Portal B2B: enlace privado del cliente con su saldo, comprobantes, acopios y su lista de precios; arma el pedido y lo manda por WhatsApp. */

GI_MODS.push(
 {k:'presale',t:'Preventa (app del preventista)',d:'Recorrido del día por zona, pedido en el cliente aun sin señal, repetir pedido, visita sin pedido, cobranza en la calle con rendición ciega, tablero y comisiones.',plan:'mayorista',dep:['orders'],scr:'preventa'},
 {k:'gps',t:'GPS del equipo en tiempo real',d:'Posición de preventistas y repartidores sólo en jornada, en horario laboral y con consentimiento; mapa, recorrido del día y llegada a cada cliente.',plan:'mayorista',scr:'equipo'},
 {k:'wa_orders',t:'Bot de pedidos por WhatsApp',d:'El cliente consulta productos y precios, arma el carrito, repite su último pedido o ve su saldo por WhatsApp; el pedido entra solo a Pedidos de venta.',plan:'total',dep:['orders'],scr:'botwa'},
 {k:'b2b',t:'Portal del cliente mayorista',d:'Enlace privado por cliente con saldo, comprobantes, acopios y su lista de precios; arma el pedido y lo envía por WhatsApp.',plan:'total',dep:['orders'],scr:'portalb2b'});
Object.assign(PERMS,{presale:'Preventa: cartera, pedidos y cobranza en la calle',gps_view:'Ver el mapa del equipo (GPS)'});

/* ---------- Preventa: cartera ---------- */
const PV_DIAS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const pvOf=c=>c.pv||(c.pv={zona:'',dias:[],seller:'',ord:0,lat:null,lng:null});
const pvSellers=()=>S.users.filter(u=>u.role==='preventista'||(S.roles[u.role]||[]).includes('presale'));
function pvRoute(sellerId,day){day=day===undefined?new Date(now()).getDay():day;return S.customers.filter(c=>c.status!=='baja'&&!c.deleted&&c.pv&&(c.pv.dias||[]).includes(day)&&(!sellerId||c.pv.seller===sellerId)).sort((a,b)=>(a.pv.ord||0)-(b.pv.ord||0)||custFull(a).localeCompare(custFull(b)));}
const pvMe=()=>user&&(user.role==='preventista'||!(user.role==='admin'||user.role==='supervisor'))?user.id:'';
const pvVisits=()=>vbArr('visits');
function pvVisit(cid,res,note,pos){const c=custById(cid);if(!c)return{err:'Cliente inexistente.'};if(!can('presale'))return{err:'Sin permiso.'};
 const v={id:uid(),ts:now(),u:user.id,uName:user.name,cust:cid,custName:custFull(c),res:String(res||'').slice(0,40),note:String(note||'').replace(/[<>]/g,'').slice(0,160)};
 if(pos&&isFinite(pos.lat)&&isFinite(pos.lng)){v.lat=pos.lat;v.lng=pos.lng;const cp=pvOf(c);if(isFinite(cp.lat)&&cp.lat!==null)v.dist=Math.round(gpsDist(pos.lat,pos.lng,cp.lat,cp.lng));}
 pvVisits().push(v);audit('VISITA',v.custName+' · '+v.res+(v.dist!==undefined?' · a '+v.dist+' m del cliente':''));save();return{v};}
const PV_MOT=['Cerrado','Tiene stock','Sin dinero','No estaba el encargado','Compró a otro','Volver otro día'];
/* cobranza en la calle: queda «a rendir» hasta que caja la recibe */
function pvCobro(cid,amount,method,ref){const c=custById(cid);if(!c)return{err:'Cliente inexistente.'};if(!can('presale'))return{err:'Sin permiso.'};const a=Math.round(+amount);if(!(a>0))return{err:'El importe tiene que ser mayor a cero.'};
 const deb=typeof debtOf==='function'?debtOf(cid):0;const pend=vbArr('cobrRuta').filter(x=>x.cust===cid&&x.state==='a_rendir').reduce((t,x)=>t+x.amount,0);if(a>deb-pend)return{err:'Supera la deuda del cliente ('+money(Math.max(0,deb-pend))+').'};
 if(!['efectivo','transferencia','cheque'].includes(method))return{err:'Medio inválido.'};if(method!=='efectivo'&&String(ref||'').trim().length<2)return{err:'Anotá el número de comprobante o de cheque.'};
 const x={id:uid(),n:vbSeq('seqCR','RC-',6),ts:now(),u:user.id,uName:user.name,cust:cid,custName:custFull(c),amount:a,method,ref:String(ref||'').slice(0,60),state:'a_rendir'};vbArr('cobrRuta').push(x);
 audit('COBRANZA_CALLE',x.n+' · '+x.custName+' · '+money(a)+' · '+method+' · a rendir');save();return{x};}
/* rendición ciega: el cajero declara el efectivo recibido; cada cobro se imputa a la cuenta corriente con el motor de siempre */
function pvRendir(sellerId,declared){if(!(can('cash_mov')||can('close_cash')))return{err:'La rendición la recibe caja.'};if(!openSess())return{err:'Abrí la caja para recibir la rendición.'};
 const L=vbArr('cobrRuta').filter(x=>x.state==='a_rendir'&&x.u===sellerId);if(!L.length)return{err:'Ese preventista no tiene cobranzas a rendir.'};const dec=Math.round(+declared);if(!(dec>=0))return{err:'Declará el efectivo recibido (puede ser 0).'};
 const exp=L.filter(x=>x.method==='efectivo').reduce((t,x)=>t+x.amount,0);const errs=[];const rid=uid();
 for(const x of L){const m=x.method==='cheque'?'transferencia':x.method;const e=fiadoPay(x.cust,Math.min(x.amount,Math.max(0,debtOf(x.cust))),m);if(e){errs.push(x.n+': '+e);continue;}x.state='rendido';x.rend=rid;x.rendAt=now();x.rendBy=user.name;}
 const dif=dec-exp;const nm=(S.users.find(u=>u.id===sellerId)||{}).name||'preventista';
 if(dif!==0){const own=typeof ownerMode==='function'&&ownerMode();const rb=dif>0?(own?ownerRubro():'cobr'):(own?ownerRubro():((S.rubros.find(r=>r.kind==='shared')||S.rubros.find(r=>r.kind==='rubro'||!r.kind)||{}).id||''));const e=addMov(dif>0?'ingreso':'egreso',rb,(dif>0?'Sobrante':'Faltante')+' rendición de '+nm,Math.abs(dif));if(e)errs.push('Diferencia: '+e);}
 audit('RENDICION_PREVENTA',nm+' · esperado efectivo '+money(exp)+' · declarado '+money(dec)+' · '+(dif?(dif>0?'sobrante ':'faltante ')+money(Math.abs(dif)):'sin diferencia')+(errs.length?' · '+errs.join(' | '):''));save();return{exp,dec,dif,errs,n:L.length};}
function pvStats(from,to){const out={};const ords=vbArr('sordr').filter(o=>o.src==='preventa'&&o.ts>=from&&o.ts<to);
 for(const u of pvSellers()){const R=[];for(let t=from;t<to;t+=864e5)R.push(...pvRoute(u.id,new Date(t).getDay()).map(c=>c.id+':'+dkey(t)));
  const V=pvVisits().filter(v=>v.u===u.id&&v.ts>=from&&v.ts<to);const vis=new Set(V.map(v=>v.cust+':'+dkey(v.ts)));const O=ords.filter(o=>o.seller===u.id);
  const fact=O.flatMap(o=>o.sales).map(id=>S.sales.find(s=>s.id===id)).filter(s=>s&&s.status==='ok').reduce((t,s)=>t+s.total,0);const pct=+(((S.cfg.presale||{}).com||{})[u.id]||0);
  out[u.id]={name:u.name,plan:R.length,visitas:vis.size,pedidos:O.length,importe:O.reduce((t,o)=>t+o.total,0),efect:vis.size?Math.round(O.length/vis.size*100):0,facturado:fact,pct,comision:Math.round(fact*pct/100),cobros:vbArr('cobrRuta').filter(x=>x.u===u.id&&x.ts>=from&&x.ts<to).reduce((t,x)=>t+x.amount,0)};}
 return out;}

/* ---------- GPS ---------- */
function gpsDist(a,b,c,d){const R=6371000,r=x=>x*Math.PI/180;const dl=r(c-a),dn=r(d-b);const h=Math.sin(dl/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
const gpsCfg=()=>Object.assign({from:'07:00',to:'21:00',days:30,every:120},S.cfg.gps||{});
const gpsCons=()=>S.gpsCons||(S.gpsCons={});
const GPS_TXT='Acepto que, mientras tenga la jornada iniciada en esta aplicación y dentro del horario laboral, el comercio registre la ubicación de este equipo para organizar el recorrido y verificar las visitas. Fuera de la jornada o del horario no se registra nada. Puedo terminar la jornada en cualquier momento. Los datos se guardan cifrados y se borran solos.';
let gpsWatch=null,gpsLast=null,gpsOnJ=false;
function gpsInHours(t){const c=gpsCfg();const d=new Date(t||now());const hm=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');return hm>=c.from&&hm<=c.to;}
/* registra un punto (lo usa el reloj del GPS y las pruebas) */
function gpsPoint(lat,lng,acc,t){if(!giOn('gps')||!user||!gpsOnJ)return null;const c=gpsCfg();t=t||now();if(!gpsInHours(t))return null;if(!(gpsCons()[user.id]&&gpsCons()[user.id].ok))return null;
 if(gpsLast&&t-gpsLast.ts<c.every*1000&&gpsDist(gpsLast.lat,gpsLast.lng,lat,lng)<100)return null;
 const p={id:uid(),u:user.id,uName:user.name,ts:t,lat:Math.round(lat*1e6)/1e6,lng:Math.round(lng*1e6)/1e6,acc:Math.round(acc||0)};vbArr('gpsPts').push(p);gpsLast=p;
 const lim=t-c.days*864e5;if(vbArr('gpsPts').length>5000||vbArr('gpsPts')[0].ts<lim)S.gpsPts=vbArr('gpsPts').filter(x=>x.ts>=lim).slice(-5000);save();return p;}
function gpsStart(){if(!giOn('gps'))return'El GPS está apagado.';if(!(gpsCons()[user.id]&&gpsCons()[user.id].ok))return'Falta el consentimiento.';gpsOnJ=true;audit('JORNADA_INICIO',user.name);
 if(navigator.geolocation&&!gpsWatch){try{gpsWatch=navigator.geolocation.watchPosition(p=>gpsPoint(p.coords.latitude,p.coords.longitude,p.coords.accuracy),()=>{},{enableHighAccuracy:true,maximumAge:60000,timeout:30000});}catch(e){}}save();return'';}
function gpsStop(){gpsOnJ=false;if(gpsWatch!==null&&navigator.geolocation){try{navigator.geolocation.clearWatch(gpsWatch);}catch(e){}}gpsWatch=null;gpsLast=null;audit('JORNADA_FIN',user?user.name:'');save();}
A.gpsJor=()=>{if(gpsOnJ){gpsStop();toast('Jornada terminada: el GPS se apagó');return rerender();}
 if(!(gpsCons()[user.id]&&gpsCons()[user.id].ok)){modal('Consentimiento de ubicación',`<p>${esc(GPS_TXT)}</p><p class="sm mut">Horario: ${esc(gpsCfg().from)} a ${esc(gpsCfg().to)} · se guarda ${gpsCfg().days} días. [VERIFICAR con el asesor legal: Ley 25.326 y convenio colectivo.]</p><label class="row" style="gap:.4rem"><input type="checkbox" id="gc-ok"> Leí y acepto</label>`,
  {okText:'Aceptar e iniciar',onOk:w=>{if(!$('#gc-ok').checked)return w._err('Marcá que leíste y aceptás.'),false;gpsCons()[user.id]={ok:true,ts:now(),txt:GPS_TXT};audit('GPS_CONSENTIMIENTO',user.name);const e=gpsStart();if(e)return w._err(e),false;rerender();}});return;}
 const e=gpsStart();if(e)return toast(e,1);toast('Jornada iniciada');rerender();};
A.gpsRevoke=()=>{confirmBox('Retirar consentimiento','Se apaga el GPS de este usuario y no se vuelve a registrar su ubicación hasta que lo acepte de nuevo.',()=>{gpsStop();delete gpsCons()[user.id];audit('GPS_CONSENTIMIENTO_RETIRADO',user.name);save();rerender();},'Retirar');};
/* mapa: mosaico de OpenStreetMap con marcadores (sin librerías) */
function gpsMapHTML(pts,W,H,lines){if(!pts.length)return'<div class="okbox">Todavía no hay posiciones registradas.</div>';W=W||640;H=H||380;
 const lat=pts.map(p=>p.lat),lng=pts.map(p=>p.lng);const T=(la,ln,z)=>{const n=2**z;return{x:(ln+180)/360*n*256,y:(1-Math.log(Math.tan(la*Math.PI/180)+1/Math.cos(la*Math.PI/180))/Math.PI)/2*n*256};};
 let z=17;for(;z>3;z--){const a=T(Math.max(...lat),Math.min(...lng),z),b=T(Math.min(...lat),Math.max(...lng),z);if(b.x-a.x<W-60&&b.y-a.y<H-60)break;}
 const cA=T((Math.max(...lat)+Math.min(...lat))/2,(Math.max(...lng)+Math.min(...lng))/2,z);const ox=cA.x-W/2,oy=cA.y-H/2;let tiles='';
 for(let tx=Math.floor(ox/256);tx<=Math.floor((ox+W)/256);tx++)for(let ty=Math.floor(oy/256);ty<=Math.floor((oy+H)/256);ty++){if(ty<0||ty>=2**z)continue;const nx=((tx%2**z)+2**z)%2**z;tiles+=`<img src="https://tile.openstreetmap.org/${z}/${nx}/${ty}.png" alt="" style="position:absolute;left:${tx*256-ox}px;top:${ty*256-oy}px;width:256px;height:256px" loading="lazy" referrerpolicy="no-referrer">`;}
 const P=pts.map(p=>{const q=T(p.lat,p.lng,z);return Object.assign({},p,{x:q.x-ox,y:q.y-oy});});
 const pl=(lines||[]).map(L=>{const Q=L.map(p=>{const q=T(p.lat,p.lng,z);return(q.x-ox).toFixed(1)+','+(q.y-oy).toFixed(1);}).join(' ');return`<polyline points="${Q}" fill="none" stroke="#1a73e8" stroke-width="3" stroke-opacity=".75"/>`;}).join('');
 return`<div class="gps-map" style="position:relative;width:100%;max-width:${W}px;height:${H}px;overflow:hidden;border-radius:10px;background:#dde">${tiles}<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0">${pl}</svg>
 ${P.map(p=>`<div title="${esc(p.label||p.uName||'')}" style="position:absolute;left:${p.x-7}px;top:${p.y-7}px;width:14px;height:14px;border-radius:50%;background:${p.color||'#d93025'};border:2px solid #fff;box-shadow:0 0 3px #000"></div><div class="sm" style="position:absolute;left:${p.x+9}px;top:${p.y-9}px;background:#fffd;padding:0 .3rem;border-radius:4px;color:#000">${esc(p.label||'')}</div>`).join('')}
 <div class="sm" style="position:absolute;right:4px;bottom:2px;background:#fffc;padding:0 .3rem;color:#000">© OpenStreetMap</div></div>`;}
let gpsUser='',gpsDay='';
reg('equipo','Equipo en el mapa','globe','gps_view',()=>{const D=gpsDay||dkey(now());const all=vbArr('gpsPts');const users=[...new Set(all.map(p=>p.u))];
 const last=users.map(u=>{const L=all.filter(p=>p.u===u);return L[L.length-1];}).filter(Boolean);const mins=t=>Math.round((now()-t)/60000);
 const sel=gpsUser&&users.includes(gpsUser)?gpsUser:'';const day=sel?all.filter(p=>p.u===sel&&dkey(p.ts)===D):[];
 const V=sel?pvVisits().filter(v=>v.u===sel&&dkey(v.ts)===D):[];
 return`<div class="row"><h1 class="sp">Equipo en el mapa</h1></div><p class="sm mut">Sólo posiciones de quienes iniciaron su jornada, dentro del horario (${esc(gpsCfg().from)}–${esc(gpsCfg().to)}). Se borran a los ${gpsCfg().days} días.${typeof vb30!=='undefined'&&!vb30?' <b>Entre equipos se ve cuando la nube tenga el SQL 30;</b> hasta entonces, este mapa muestra lo registrado en este equipo.':''}</p>
 ${gpsMapHTML(sel?day.map((p,i)=>Object.assign({},p,{label:i===day.length-1?p.uName+' · '+new Date(p.ts).toTimeString().slice(0,5):'',color:i===day.length-1?'#d93025':'#1a73e8'})).concat(V.filter(v=>isFinite(v.lat)).map(v=>({lat:v.lat,lng:v.lng,label:'✓ '+v.custName,color:'#188038'}))):last.map(p=>Object.assign({},p,{label:p.uName+' · hace '+mins(p.ts)+' min'})),640,380,sel&&day.length>1?[day]:[])}
 <div class="tw" style="margin-top:.8rem"><table data-nosort><thead><tr><th>Persona</th><th>Última posición</th><th>Precisión</th><th></th></tr></thead><tbody>${last.map(p=>`<tr><td>${esc(p.uName)}</td><td>${fmtDT(p.ts)} (hace ${mins(p.ts)} min)</td><td>${p.acc?'± '+p.acc+' m':'—'}</td><td class="r"><button class="btn sm ${sel===p.u?'gold':''}" data-act="gpsSel" data-id="${p.u}">Recorrido</button></td></tr>`).join('')}</tbody></table></div>
 ${sel?`<label for="gp-d">Día</label><input id="gp-d" type="date" value="${D}"><p class="sm">${day.length} posición(es) · ${V.length} visita(s)${V.filter(v=>v.dist!==undefined).length?' · llegadas: '+V.filter(v=>v.dist!==undefined).map(v=>esc(v.custName)+' a '+v.dist+' m').join(', '):''}</p>`:''}
 ${giAdm()?`<details><summary>Configuración del GPS</summary><div class="f"><div><label for="gc-f">Desde</label><input id="gc-f" type="time" value="${gpsCfg().from}"></div><div><label for="gc-t">Hasta</label><input id="gc-t" type="time" value="${gpsCfg().to}"></div><div><label for="gc-d">Guardar (días)</label><input id="gc-d" type="number" min="1" max="90" value="${gpsCfg().days}"></div><div><label for="gc-e">Cada (segundos)</label><input id="gc-e" type="number" min="30" max="900" value="${gpsCfg().every}"></div></div><button class="btn sm" data-act="gpsCfgSave">Guardar</button></details>`:''}`;},
 ()=>{const d=$('#gp-d');if(d)d.addEventListener('change',()=>{gpsDay=d.value;rerender();});},'Equipo');
SCREENS.equipo.show=()=>giOn('gps');NAV.push(['equipo','Equipo']);
A.gpsSel=el=>{gpsUser=gpsUser===el.dataset.id?'':el.dataset.id;rerender();};
A.gpsCfgSave=()=>{const f=val('gc-f'),t=val('gc-t');if(!/^\d\d:\d\d$/.test(f)||!/^\d\d:\d\d$/.test(t)||f>=t)return toast('Revisá el horario.',1);S.cfg.gps={from:f,to:t,days:Math.max(1,Math.min(90,+val('gc-d')||30)),every:Math.max(30,Math.min(900,+val('gc-e')||120))};audit('GPS_CONFIG',f+'–'+t);save();toast('Guardado');rerender();};

/* ---------- Pantalla del preventista (pensada para el celular) ---------- */
let pvTab='ruta',pvSeller='',pvDay=-1;
A.pvTab=el=>{pvTab=el.dataset.t;rerender();};
function pvPos(cb){if(!navigator.geolocation||!giOn('gps')||!gpsOnJ)return cb(null);let done=false;const t=setTimeout(()=>{if(!done){done=true;cb(null);}},4000);
 try{navigator.geolocation.getCurrentPosition(p=>{if(done)return;done=true;clearTimeout(t);cb({lat:p.coords.latitude,lng:p.coords.longitude});},()=>{if(!done){done=true;clearTimeout(t);cb(null);}},{maximumAge:120000,timeout:3500});}catch(e){done=true;clearTimeout(t);cb(null);}}
function pvCard(c){const deb=typeof debtOf==='function'?debtOf(c.id):0;const od=typeof wsOverdue==='function'&&wsOn()?wsOverdue(c.id):[];const last=vbArr('sordr').filter(o=>o.cust===c.id).slice(-1)[0];
 const vis=pvVisits().filter(v=>v.cust===c.id&&dkey(v.ts)===dkey(now()));const addr=c.addr||'';
 return`<div class="card" style="margin:.5rem 0"><div class="row"><b class="sp">${esc(custFull(c))}</b>${vis.length?`<span class="tag ok">✓ ${esc(vis[vis.length-1].res)}</span>`:''}</div>
 <p class="sm" style="margin:.2rem 0">${esc(addr)}${c.pv&&c.pv.zona?' · '+esc(c.pv.zona):''}</p><p class="sm" style="margin:.2rem 0">Saldo: <b>${money(deb)}</b>${od.length?` · <span class="tag bad">${od.length} vencido(s)</span>`:''}${last?' · último pedido '+esc(last.n)+' ('+dmy(dkey(last.ts))+')':''}</p>
 <div class="row" style="gap:.35rem;flex-wrap:wrap"><button class="btn sm gold" data-act="pvOrd" data-id="${c.id}">Pedido</button>${last?`<button class="btn sm" data-act="pvRep" data-id="${c.id}">Repetir último</button>`:''}<button class="btn sm" data-act="pvNo" data-id="${c.id}">Sin pedido</button>${deb>0?`<button class="btn sm" data-act="pvCob" data-id="${c.id}">Cobrar</button>`:''}${addr?`<a class="btn sm" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}" target="_blank" rel="noopener">Cómo llegar</a>`:''}</div></div>`;}
A.pvOrd=el=>{vbDraftNew(el.dataset.id,'preventa');vbDraft.seller=user.id;vbOTab='nuevo';go('pedidosv');};
A.pvRep=el=>{const last=vbArr('sordr').filter(o=>o.cust===el.dataset.id).slice(-1)[0];if(!last)return;vbDraftNew(el.dataset.id,'preventa');vbDraft.seller=user.id;vbDraft.items=last.items.filter(i=>prod(i.pid)).map(i=>({pid:i.pid,qty:i.qty}));vbOTab='nuevo';go('pedidosv');toast('Se copió el pedido '+last.n+': revisá cantidades y guardá');};
A.pvNo=el=>{modal('Visita sin pedido',`<label for="pn-m">Motivo</label><select id="pn-m">${PV_MOT.map(m=>`<option>${esc(m)}</option>`).join('')}</select><label for="pn-n">Nota</label><input id="pn-n" maxlength="160">`,{okText:'Registrar',onOk:w=>{const m=val('pn-m'),n=val('pn-n');pvPos(pos=>{const r=pvVisit(el.dataset.id,m,n,pos);if(r.err)return toast(r.err,1);toast('Visita registrada');rerender();});}});};
A.pvCob=el=>{const c=custById(el.dataset.id);modal('Cobrar a '+esc(custFull(c)),`<p class="sm">Debe ${money(debtOf(c.id))}</p><label for="pc-a">Importe ($)</label>${numIn('pc-a',0)}<label for="pc-m">Medio</label><select id="pc-m"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="cheque">Cheque</option></select><label for="pc-r">Comprobante / N.º de cheque</label><input id="pc-r" maxlength="60">`,
 {okText:'Registrar cobro',onOk:w=>{const r=pvCobro(c.id,cents(val('pc-a')),val('pc-m'),val('pc-r'));if(r.err)return w._err(r.err),false;pvPos(pos=>pvVisit(c.id,'Cobro '+money(r.x.amount),'',pos));toast('Cobro '+r.x.n+' a rendir');rerender();}});};
function pvCarteraHTML(){const sel=pvSellers();const L=S.customers.filter(c=>c.status!=='baja'&&!c.deleted).sort((a,b)=>custFull(a).localeCompare(custFull(b))).slice(0,400);
 return`<p class="sm mut">Asigná a cada cliente su preventista, zona y días de visita. El orden define el recorrido.</p>${sel.length?'':'<div class="warnbox">No hay preventistas: creá un usuario con el rol «preventista» en Usuarios y permisos.</div>'}
 <div class="tw"><table data-nosort><thead><tr><th>Cliente</th><th>Preventista</th><th>Zona</th><th>Días</th><th>Orden</th></tr></thead><tbody>${L.map(c=>{const p=pvOf(c);return`<tr><td>${esc(custFull(c))}</td>
 <td><select class="pv-f" data-id="${c.id}" data-k="seller" aria-label="Preventista"><option value="">—</option>${sel.map(u=>`<option value="${u.id}" ${p.seller===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></td>
 <td><input class="pv-f" data-id="${c.id}" data-k="zona" value="${esc(p.zona||'')}" maxlength="30" style="width:7rem" aria-label="Zona"></td>
 <td style="white-space:nowrap">${[1,2,3,4,5,6].map(d=>`<label class="sm" style="margin-right:.25rem"><input type="checkbox" class="pv-d" data-id="${c.id}" data-d="${d}" ${(p.dias||[]).includes(d)?'checked':''}>${PV_DIAS[d]}</label>`).join('')}</td>
 <td><input class="pv-f" data-id="${c.id}" data-k="ord" type="number" min="0" value="${p.ord||0}" style="width:4.5rem" aria-label="Orden"></td></tr>`;}).join('')}</tbody></table></div>
 <h3>Comisiones</h3>${sel.map(u=>`<label for="pvc-${u.id}">${esc(u.name)} · % sobre lo facturado de sus pedidos</label><input id="pvc-${u.id}" class="pv-c" data-id="${u.id}" type="number" min="0" max="30" step="0.1" value="${((S.cfg.presale||{}).com||{})[u.id]||0}">`).join('')||'<p class="sm mut">—</p>'}`;}
function pvRendHTML(){const by={};vbArr('cobrRuta').filter(x=>x.state==='a_rendir').forEach(x=>{(by[x.u]=by[x.u]||{n:x.uName,L:[]}).L.push(x);});const E=Object.entries(by);
 return E.length?E.map(([u,o])=>`<div class="card"><div class="row"><b class="sp">${esc(o.n)}</b><span>${o.L.length} cobro(s)</span></div><p class="sm mut">${o.L.filter(x=>x.method!=='efectivo').map(x=>esc(x.n)+' '+esc(x.method)+' '+money(x.amount)+' ('+esc(x.ref)+')').join(' · ')||'Sólo efectivo'}</p>
 <label for="pr-${u}">Efectivo que entrega (contalo sin mirar el esperado)</label>${numIn('pr-'+u,0)}<button class="btn gold" data-act="pvRend" data-id="${u}">Recibir rendición</button></div>`).join(''):'<div class="okbox">No hay cobranzas pendientes de rendir.</div>';}
A.pvRend=el=>{const u=el.dataset.id;const r=pvRendir(u,cents(val('pr-'+u)));if(r.err)return toast(r.err,1);
 modal('Rendición recibida',`<p>${r.n} cobro(s) imputados a cuenta corriente.</p><p>Efectivo esperado: <b>${money(r.exp)}</b> · declarado: <b>${money(r.dec)}</b> · ${r.dif?(r.dif>0?'Sobrante ':'Faltante ')+'<b>'+money(Math.abs(r.dif))+'</b> (quedó en caja como movimiento)':'sin diferencia'}</p>${r.errs.length?'<div class="warnbox">'+r.errs.map(esc).join('<br>')+'</div>':''}`,{ok:false,cancelText:'Cerrar'});rerender();};
function pvTablero(){const t0=new Date(now());t0.setHours(0,0,0,0);const from=t0.getTime()-6*864e5,to=t0.getTime()+864e5;const st=pvStats(from,to);const L=Object.values(st);
 return L.length?`<p class="sm mut">Últimos 7 días.</p><div class="tw"><table data-nosort><thead><tr><th>Preventista</th><th class="r">Visitas plan.</th><th class="r">Visitados</th><th class="r">Pedidos</th><th class="r">Efectividad</th><th class="r">Pedido</th><th class="r">Facturado</th><th class="r">Comisión</th><th class="r">Cobrado</th></tr></thead><tbody>${L.map(x=>`<tr><td>${esc(x.name)}</td><td class="r">${x.plan}</td><td class="r">${x.visitas}</td><td class="r">${x.pedidos}</td><td class="r">${x.efect} %</td><td class="r">${money(x.importe)}</td><td class="r">${money(x.facturado)}</td><td class="r">${money(x.comision)} <span class="sm mut">(${x.pct} %)</span></td><td class="r">${money(x.cobros)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="okbox">Todavía no hay preventistas.</div>';}
reg('preventa','Preventa','route','presale',()=>{const sup=user.role==='admin'||user.role==='supervisor';const me=pvMe();const tabs=[['ruta','Mi recorrido']].concat(sup?[['cartera','Cartera'],['tablero','Tablero']]:[]).concat(can('cash_mov')||can('close_cash')?[['rendir','Rendiciones']]:[]);
 if(!tabs.some(t=>t[0]===pvTab))pvTab='ruta';const day=pvDay>=0?pvDay:new Date(now()).getDay();const sid=me||pvSeller;const R=pvRoute(sid,day);
 const jor=giOn('gps')?`<div class="card" style="margin-bottom:.6rem"><div class="row"><span class="sp">${gpsOnJ?'🟢 Jornada iniciada: el GPS registra tu recorrido':'⚪ Jornada sin iniciar: el GPS no registra nada'}</span><button class="btn sm ${gpsOnJ?'':'gold'}" data-act="gpsJor">${gpsOnJ?'Terminar jornada':'Iniciar jornada'}</button></div>${gpsCons()[user.id]?'<button class="btn sm ghost" data-act="gpsRevoke" style="margin-top:.3rem">Retirar consentimiento</button>':''}</div>`:'';
 return`<div class="row"><h1 class="sp">Preventa</h1><button class="btn sm" data-act="nav" data-id="pedidosv">Pedidos</button></div>${jor}
 <div class="ux-tabs" role="tablist">${tabs.map(([k,t])=>`<a role="tab" tabindex="0" data-act="pvTab" data-t="${k}" aria-selected="${k===pvTab}" class="${k===pvTab?'on':''}">${t}</a>`).join('')}</div>
 ${pvTab==='cartera'?pvCarteraHTML():pvTab==='tablero'?pvTablero():pvTab==='rendir'?pvRendHTML():`<div class="f">${!me?`<div><label for="pv-s">Preventista</label><select id="pv-s"><option value="">Todos</option>${pvSellers().map(u=>`<option value="${u.id}" ${pvSeller===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></div>`:''}<div><label for="pv-d">Día</label><select id="pv-d">${[1,2,3,4,5,6,0].map(d=>`<option value="${d}" ${d===day?'selected':''}>${PV_DIAS[d]}</option>`).join('')}</select></div></div>
 <p class="sm mut">${R.length} cliente(s) para visitar · ${R.filter(c=>pvVisits().some(v=>v.cust===c.id&&dkey(v.ts)===dkey(now()))).length} visitados hoy</p>${R.map(pvCard).join('')||'<div class="okbox">No hay clientes asignados para este día. El supervisor los asigna en «Cartera».</div>'}`}`;},
 ()=>{const s=$('#pv-s');if(s)s.addEventListener('change',()=>{pvSeller=s.value;rerender();});const d=$('#pv-d');if(d)d.addEventListener('change',()=>{pvDay=+d.value;rerender();});
  $$('.pv-f').forEach(i=>i.addEventListener('change',()=>{const c=custById(i.dataset.id);if(!c)return;const p=pvOf(c);p[i.dataset.k]=i.dataset.k==='ord'?(+i.value||0):i.value.replace(/[<>]/g,'').slice(0,30);save();}));
  $$('.pv-d').forEach(i=>i.addEventListener('change',()=>{const c=custById(i.dataset.id);if(!c)return;const p=pvOf(c);const d=+i.dataset.d;p.dias=(p.dias||[]).filter(x=>x!==d);if(i.checked)p.dias.push(d);save();}));
  $$('.pv-c').forEach(i=>i.addEventListener('change',()=>{const P=S.cfg.presale||(S.cfg.presale={});(P.com||(P.com={}))[i.dataset.id]=Math.max(0,Math.min(30,+i.value||0));audit('COMISION_PREVENTA',i.dataset.id+' · '+i.value+' %');save();}));},'Operación');
SCREENS.preventa.show=()=>giOn('presale');NAV.push(['preventa','Operación']);
/* V27.14 · el preventista entra directo a su recorrido del día */
{const _pvHome=homeScreen;homeScreen=function(){if(user&&user.role==='preventista'&&giOn('presale')&&SCREENS.preventa)return 'preventa';return _pvHome();};}

/* ---------- Bot de pedidos por WhatsApp ---------- */
const waS=()=>S.waSess||(S.waSess={});
const WA_MENU='Elegí una opción escribiendo el número:\n1️⃣ Buscar producto\n2️⃣ Ver mi carrito\n3️⃣ Repetir mi último pedido\n4️⃣ Mi saldo\n5️⃣ Hablar con una persona\n0️⃣ Confirmar el pedido\nTambién podés escribir directamente, por ejemplo: «6 coca 2,25».';
function waCust(phone){const d=String(phone||'').replace(/\D/g,'').slice(-10);if(d.length<8)return null;return S.customers.find(c=>c.status!=='baja'&&String(c.wa||'').replace(/\D/g,'').slice(-10)===d)||null;}
function waCartTxt(s,c){if(!s.cart.length)return'Tu carrito está vacío.';let t=0;const L=s.cart.map(x=>{const p=prod(x.pid);if(!p)return'';const pr=vbLinePrice(p,x.qty,c);t+=pr.amt;return'• '+x.qty+' × '+pfull(p)+' = '+money(pr.amt);}).filter(Boolean);return'🛒 Tu pedido:\n'+L.join('\n')+'\nTotal estimado: '+money(t)+'\n\nEscribí 0 para confirmar o «borrar» para empezar de nuevo.';}
/* responde un mensaje entrante; devuelve el texto de respuesta ('' = no responde, lo atiende una persona) */
function waBot(phone,text,name){if(!giOn('wa_orders'))return'';const k=String(phone||'').replace(/\D/g,'')||'anon';const S0=waS();let s=S0[k];const t=String(text||'').trim();const n=giNorm(t);
 if(!s||now()-s.ts>6*3600e3){s=S0[k]={ts:now(),st:'menu',cart:[],last:''};}s.ts=now();if(s.human)return'';
 const c=waCust(phone);const hola=c?'¡Hola '+(c.name||'').split(' ')[0]+'! ':'¡Hola! ';
 /* pedido pegado desde el portal: «2 x [código] nombre» */
 const lines=[...t.matchAll(/^\s*(\d+(?:[.,]\d+)?)\s*x\s*\[([^\]]+)\]/gim)];
 if(lines.length){let ok=0;for(const m of lines){const p=giFind(m[2])[0];if(p){s.cart.push({pid:p.id,qty:parseFloat(m[1].replace(',','.'))});ok++;}}s.st='menu';return'Recibí '+ok+' artículo(s) de tu lista.\n'+waCartTxt(s,c);}
 /* primero las respuestas a una pregunta del bot (elegir de la lista o decir la cantidad): un «1» acá es la opción, no el menú */
 if(s.st==='elegir'&&/^\d+$/.test(n)&&s.opts&&s.opts[+n-1]){s.pick=s.opts[+n-1];const p=prod(s.pick);if(s.qtyPend>0){const q=s.qtyPend;s.qtyPend=0;s.cart.push({pid:s.pick,qty:q});s.st='menu';return'Agregado: '+q+' × '+pfull(p)+'.\n'+waCartTxt(s,c);}
  s.st='cant';return'¿Cuántas unidades de '+pfull(p)+' ('+money(vbLinePrice(p,1,c).price)+' c/u)?';}
 if(s.st==='cant'&&/^\d+([.,]\d+)?$/.test(n)){const q=parseFloat(n.replace(',','.'));if(!(q>0))return'Escribí una cantidad mayor a cero.';s.cart.push({pid:s.pick,qty:q});s.st='menu';return'Agregado.\n'+waCartTxt(s,c)+'\n\n¿Algo más? Escribí otro producto o 0 para confirmar.';}
 if(/^(hola|buenas|buen dia|menu|inicio|opciones)\b/.test(n)||n==='')return hola+'Soy el asistente de pedidos de '+S.tenant.name+'.\n'+WA_MENU;
 if(n==='5'||/persona|humano|vendedor|asesor/.test(n)){s.human=1;return'Listo, te paso con una persona del equipo. En breve te responden.';}
 if(n==='4'||/saldo|debo|deuda|cuenta/.test(n)){if(!c)return'No encuentro tu número entre nuestros clientes. Escribí 5 y te atiende una persona.';const d=debtOf(c.id);return d>0?'Tu saldo en cuenta corriente es '+money(d)+'.':'No tenés saldo pendiente. ¡Gracias!';}
 if(n==='3'||/repetir|lo mismo|ultimo pedido/.test(n)){if(!c)return'Para repetir un pedido necesito que seas cliente registrado. Escribí 5.';const last=vbArr('sordr').filter(o=>o.cust===c.id).slice(-1)[0];if(!last)return'No encuentro pedidos anteriores.';
  s.cart=last.items.filter(i=>prod(i.pid)).map(i=>({pid:i.pid,qty:i.qty}));return'Copié tu pedido '+last.n+'.\n'+waCartTxt(s,c);}
 if(n==='2'||/carrito|mi pedido/.test(n))return waCartTxt(s,c);
 if(/^(borrar|vaciar|cancelar)/.test(n)){s.cart=[];s.st='menu';return'Vacié el carrito.\n'+WA_MENU;}
 if(n==='0'||/^(confirmo|confirmar|listo|enviar)/.test(n)){if(!s.cart.length)return'Tu carrito está vacío.\n'+WA_MENU;if(!c){s.human=1;return'Tu pedido quedó anotado y una persona te contacta para completar tus datos.\n'+waCartTxt(s,c);}
  const r=vbOrderCreate({cust:c.id,items:s.cart,cond:'cc',src:'whatsapp',note:'Pedido por WhatsApp'});if(r.err)return'No pude registrar el pedido: '+r.err+'\nEscribí 5 y te ayuda una persona.';s.cart=[];s.st='menu';
  return'✅ Pedido '+r.o.n+' recibido por '+money(r.o.total)+'. Te avisamos cuando salga. ¡Gracias!';}
 if(n==='1'){s.st='buscar';return'Escribí el nombre o el código del producto.';}
 /* «6 coca 2,25» o un nombre */
 const m=t.match(/^\s*(\d+(?:[.,]\d+)?)\s+(.{2,})$/);const q=m?parseFloat(m[1].replace(',','.')):0;const L=giFind(m?m[2]:t,5);
 if(!L.length)return'No encontré «'+(m?m[2]:t).slice(0,40)+'». Probá con otra palabra o escribí 5 para hablar con una persona.';
 if(L.length===1&&q>0){s.cart.push({pid:L[0].id,qty:q});s.st='menu';return'Agregado: '+q+' × '+pfull(L[0])+'.\n'+waCartTxt(s,c);}
 s.opts=L.map(p=>p.id);s.st='elegir';s.qtyPend=q>0?q:0;return'Encontré:\n'+L.map((p,i)=>(i+1)+') '+pfull(p)+' · '+money(vbLinePrice(p,1,c).price)).join('\n')+'\nEscribí el número.';}
/* se engancha a Atención al cliente: si el módulo está activo y nadie del equipo tomó la conversación, responde el bot de pedidos */
if(typeof crmBot==='function'){const _cb=crmBot;crmBot=async function(c,text){if(giOn('wa_orders')&&c&&['wa','web'].concat(typeof CHAN_DEMO!=='undefined'?CHAN_DEMO:[]).includes(c.chan)&&!c.asg){
  const r=waBot(c.wa||c.ext||c.id,text,c.name);if(r){try{await crmSend(c,r,{kind:'bot',by:'Asistente de pedidos',noState:1});}catch(e){}return;}}return _cb.apply(this,arguments);};}
let waSim=[];
A.waSimSend=()=>{const t=val('ws-t').trim();if(!t)return;const ph=val('ws-p')||'5493870000000';waSim.push({d:'in',t});const r=waBot(ph,t)||'(lo atiende una persona del equipo)';waSim.push({d:'out',t:r});rerender();setTimeout(()=>{const i=$('#ws-t');if(i)i.focus();},40);};
A.waSimReset=()=>{waSim=[];const ph=String(val('ws-p')||'5493870000000').replace(/\D/g,'');delete waS()[ph];rerender();};
reg('botwa','Bot de pedidos','chat','crm',()=>`<div class="row"><h1 class="sp">Bot de pedidos por WhatsApp</h1>${SCREENS.crm?'<button class="btn sm" data-act="nav" data-id="crm">Atención al cliente</button>':''}</div>
 <p class="sm mut">Responde solo en las conversaciones de WhatsApp y del chat web que nadie del equipo tomó. Identifica al cliente por su número, usa su lista de precios y el pedido entra a «Pedidos de venta». Con «5» deriva a una persona. Para que responda las 24 horas con el sistema cerrado hace falta la conexión de WhatsApp Business (Atención al cliente → Canales) y la función del servidor [pendiente de Vincular Business].</p>
 <div class="card"><h3 style="margin-top:0">Probar el bot</h3><label for="ws-p">Teléfono del cliente (para identificarlo)</label><input id="ws-p" value="${esc((S.customers.find(c=>c.wa)||{}).wa||'5493870000000')}">
 <div style="max-height:22rem;overflow:auto;background:var(--bg2,#0001);padding:.5rem;border-radius:8px;margin:.5rem 0">${waSim.map(m=>`<div style="text-align:${m.d==='in'?'right':'left'};margin:.25rem 0"><span style="display:inline-block;white-space:pre-line;padding:.35rem .6rem;border-radius:10px;background:${m.d==='in'?'#dcf8c6':'#fff'};color:#000;max-width:85%">${esc(m.t)}</span></div>`).join('')||'<p class="sm mut">Escribí «hola».</p>'}</div>
 <div class="row" style="gap:.4rem"><input id="ws-t" class="sp" placeholder="Mensaje del cliente" autocomplete="off"><button class="btn gold" data-act="waSimSend">Enviar</button><button class="btn sm" data-act="waSimReset">Reiniciar</button></div></div>`,
 ()=>{const t=$('#ws-t');if(t)t.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();A.waSimSend();}});},'Clientes');
SCREENS.botwa.show=()=>giOn('wa_orders');NAV.push(['botwa','Clientes']);

/* ---------- Portal del cliente mayorista (enlace privado, sin servidor) ---------- */
const vbB64u=s=>btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const vbUb64u=s=>atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4));
async function b2bPack(cid){const c=custById(cid);if(!c)throw new Error('Cliente inexistente.');const now_=now();
 const docs=S.sales.filter(s=>s.cust===cid&&s.status==='ok').slice(-12).reverse().map(s=>[s.n,s.ts,s.total,typeof saleFiadoAmt==='function'?saleFiadoAmt(s):0,s.due||0]);
 const pays=S.fiadoPays.filter(p=>p.cust===cid).slice(-8).reverse().map(p=>[p.ts,p.amount]);
 const ac=vbArr('acopios').filter(a=>a.cust===cid&&a.state==='vigente').map(a=>[a.n,a.items.filter(i=>i.qty>i.ret).map(i=>[i.name,Math.round((i.qty-i.ret)*1000)/1000])]);
 const P=S.products.filter(p=>p.active!==false&&!p.archived&&p.id!=='p_envio'&&p.price>0&&!(typeof isKit==='function'&&isKit(p))).slice(0,400).map(p=>{const r=vbLinePrice(p,1,c);const pres=(typeof wsPres==='function'&&wsOn())?wsPres(p).map(k=>[wsLvName(k.lv),k.qty,k.unit]):[];return[p.barcode||p.plu||p.id,pfull(p),r.price,rubName(p.rubro)||'',pres];});
 const last=vbArr('sordr').filter(o=>o.cust===cid).slice(-1)[0];
 const d={v:1,t:now_,shop:{n:S.tenant.name,wa:String(S.tenant.wa||'').replace(/\D/g,'')},c:{n:custFull(c)},deb:debtOf(cid),od:typeof wsOverdue==='function'&&wsOn()?wsOverdue(cid).length:0,docs,pays,ac,P,last:last?last.items.map(i=>{const p=prod(i.pid);return p?[p.barcode||p.plu||p.id,i.qty]:null;}).filter(Boolean):[]};
 const raw=new TextEncoder().encode(JSON.stringify(d));let bin;
 if(typeof CompressionStream!=='undefined'){const cs=new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));bin=new Uint8Array(await new Response(cs).arrayBuffer());}else bin=raw;
 let s='';for(let i=0;i<bin.length;i+=8192)s+=String.fromCharCode.apply(null,bin.subarray(i,i+8192));return(typeof CompressionStream!=='undefined'?'z':'j')+vbB64u(s);}
async function b2bUnpack(tok){const k=tok[0];const bin=Uint8Array.from(vbUb64u(tok.slice(1)),ch=>ch.charCodeAt(0));let raw=bin;
 if(k==='z'){const ds=new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));raw=new Uint8Array(await new Response(ds).arrayBuffer());}return JSON.parse(new TextDecoder().decode(raw));}
function b2bBase(){return((window.RAVE_BUILD&&RAVE_BUILD.publicUrl)||location.href.split('#')[0]).split('#')[0];}
A.b2bLink=async el=>{const c=custById(el.dataset.id);if(!c)return;try{const tok=await b2bPack(c.id);const url=b2bBase()+'#b2b='+tok;audit('PORTAL_ENLACE',custFull(c)+' · '+Math.round(url.length/1024)+' KB');
 const wa=String(c.wa||'').replace(/\D/g,'');const msg='Hola '+(c.name||'')+', te paso tu portal de cliente de '+S.tenant.name+' con tu saldo, tus comprobantes y tu lista de precios para hacer pedidos: '+url;
 modal('Portal de '+esc(custFull(c)),`<p class="sm">Enlace privado con los datos de hoy (${fmtDT(now())}). Cuando cambien precios o saldo, generá uno nuevo.</p><textarea id="b2-u" rows="4" readonly>${esc(url)}</textarea>
  <div class="row" style="gap:.4rem;margin-top:.5rem"><button class="btn sm" data-act="b2bCopy">Copiar</button>${wa?`<a class="btn sm gold" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}">Enviar por WhatsApp</a>`:''}<a class="btn sm" target="_blank" rel="noopener" href="${esc(url)}">Ver como el cliente</a></div>`,{ok:false,cancelText:'Cerrar'});}catch(e){toast('No se pudo armar el enlace: '+e.message,1);}};
A.b2bCopy=()=>{const t=$('#b2-u');if(!t)return;t.select();try{navigator.clipboard.writeText(t.value);}catch(e){document.execCommand&&document.execCommand('copy');}toast('Copiado');};
reg('portalb2b','Portal de clientes','users','customers',()=>{const q=giNorm(val('b2-q')||'');const L=S.customers.filter(c=>c.status!=='baja'&&!c.deleted).filter(c=>!q||giNorm(custFull(c)+' '+(c.taxid||'')).includes(q)).slice(0,200);
 return`<div class="row"><h1 class="sp">Portal del cliente mayorista</h1></div><p class="sm mut">Cada cliente recibe un enlace privado con su saldo, comprobantes, acopios y su lista de precios. Arma el pedido en el celular y lo manda por WhatsApp; si el bot está activo, lo carga solo en «Pedidos de venta». El enlace es una foto de los datos al momento de generarlo: no da acceso al sistema.</p>
 <input id="b2-q" placeholder="Buscar cliente" value="${esc(val('b2-q')||'')}" autocomplete="off"><div class="tw" style="margin-top:.5rem"><table data-nosort><thead><tr><th>Cliente</th><th class="r">Saldo</th><th></th></tr></thead><tbody>${L.map(c=>`<tr><td>${esc(custFull(c))}</td><td class="r">${money(debtOf(c.id))}</td><td class="r"><button class="btn sm gold" data-act="b2bLink" data-id="${c.id}">Generar enlace</button></td></tr>`).join('')}</tbody></table></div>`;},
 ()=>{const q=$('#b2-q');if(q)q.addEventListener('change',()=>rerender());},'Clientes');
SCREENS.portalb2b.show=()=>giOn('b2b');NAV.push(['portalb2b','Clientes']);
/* vista del cliente: #b2b=… (no requiere sesión ni datos del equipo) */
let b2bData=null,b2bCart={},b2bTab='cat';
function b2bView(){const d=b2bData;if(!d)return;let k=$('#b2b-v');if(!k){k=document.createElement('div');k.id='b2b-v';document.body.appendChild(k);}['#pub','#login','#panel'].forEach(s=>{const e=$(s);if(e)e.hidden=true;});
 k.setAttribute('style','position:fixed;inset:0;z-index:60;overflow:auto;background:var(--bg,#fff);color:var(--ink,#111);padding:1rem;font-size:16px');const q=giNorm((($('#b2-s')||{}).value)||'');
 const items=Object.entries(b2bCart).filter(([,v])=>v>0);const tot=items.reduce((t,[code,v])=>{const p=d.P.find(x=>x[0]===code);return t+(p?Math.round(p[2]*v):0);},0);
 k.innerHTML=`<div style="max-width:46rem;margin:0 auto"><h1 style="margin:.2rem 0">${esc(d.shop.n)}</h1><p class="sm">Portal de <b>${esc(d.c.n)}</b> · datos al ${fmtDT(d.t)}</p>
 <div class="card"><div class="row"><span class="sp">Saldo en cuenta corriente</span><b style="font-size:1.4rem">${money(d.deb)}</b></div>${d.od?`<p class="sm"><span class="tag bad">${d.od} comprobante(s) vencido(s)</span></p>`:''}</div>
 <div class="ux-tabs" role="tablist">${[['cat','Pedir'],['docs','Comprobantes'],['ac','Acopios']].map(([x,t])=>`<a role="tab" tabindex="0" data-act="b2bT" data-t="${x}" aria-selected="${x===b2bTab}" class="${x===b2bTab?'on':''}">${t}</a>`).join('')}</div>
 ${b2bTab==='docs'?`<div class="tw"><table data-nosort><thead><tr><th>Comprobante</th><th>Fecha</th><th class="r">Total</th><th class="r">Debe</th><th>Vence</th></tr></thead><tbody>${d.docs.map(x=>`<tr><td>${esc(x[0])}</td><td>${dmy(dkey(x[1]))}</td><td class="r">${money(x[2])}</td><td class="r">${money(x[3])}</td><td>${x[4]?dmy(dkey(x[4])):'—'}</td></tr>`).join('')}</tbody></table></div><h3>Pagos</h3><ul>${d.pays.map(p=>`<li>${dmy(dkey(p[0]))} · ${money(p[1])}</li>`).join('')||'<li>—</li>'}</ul>`
 :b2bTab==='ac'?(d.ac.length?d.ac.map(a=>`<div class="card"><b>${esc(a[0])}</b><ul>${a[1].map(i=>`<li>${i[1]} × ${esc(i[0])}</li>`).join('')}</ul></div>`).join(''):'<p>No tenés mercadería en acopio.</p>')
 :`<div class="row" style="gap:.4rem;margin:.5rem 0"><input id="b2-s" class="sp" placeholder="Buscar producto" value="${esc((($('#b2-s')||{}).value)||'')}">${d.last.length?'<button class="btn sm" data-act="b2bRep">Repetir último pedido</button>':''}</div>
  ${items.length?`<div class="card"><b>Tu pedido · ${money(tot)}</b><ul>${items.map(([code,v])=>{const p=d.P.find(x=>x[0]===code);return p?`<li>${v} × ${esc(p[1])}</li>`:'';}).join('')}</ul>${d.shop.wa?`<button class="btn gold" data-act="b2bSend">Enviar pedido por WhatsApp</button>`:'<p class="sm">Pasale esta lista al comercio.</p>'} <button class="btn sm" data-act="b2bClr">Vaciar</button></div>`:''}
  <div class="tw"><table data-nosort><thead><tr><th>Producto</th><th class="r">Precio</th><th class="r">Cantidad</th></tr></thead><tbody>${d.P.filter(p=>!q||giNorm(p[1]+' '+p[3]).includes(q)).slice(0,150).map(p=>`<tr><td>${esc(p[1])}${p[4].length?`<div class="sm">${p[4].map(x=>esc(x[0])+' x'+x[1]+': '+money(x[2])+' c/u').join(' · ')}</div>`:''}</td><td class="r">${money(p[2])}</td><td class="r"><input class="b2-q" data-c="${esc(p[0])}" type="number" min="0" step="1" value="${b2bCart[p[0]]||''}" style="width:4.5rem" aria-label="Cantidad de ${esc(p[1])}"></td></tr>`).join('')}</tbody></table></div><p class="sm">Precios de referencia al ${dmy(dkey(d.t))}; el comercio los confirma al facturar.</p>`}</div>`;
 const s=$('#b2-s');if(s)s.addEventListener('change',()=>setTimeout(b2bView,0));$$('.b2-q').forEach(i=>i.addEventListener('change',()=>{b2bCart[i.dataset.c]=Math.max(0,+i.value||0);setTimeout(b2bView,0);}));}
A.b2bT=el=>{b2bTab=el.dataset.t;b2bView();};
A.b2bRep=()=>{b2bCart={};b2bData.last.forEach(([c,q])=>b2bCart[c]=q);b2bView();};
A.b2bClr=()=>{b2bCart={};b2bView();};
function b2bMsg(){const d=b2bData;return'Pedido de '+d.c.n+':\n'+Object.entries(b2bCart).filter(([,v])=>v>0).map(([code,v])=>{const p=d.P.find(x=>x[0]===code);return p?v+' x ['+code+'] '+p[1]:'';}).filter(Boolean).join('\n');}
A.b2bSend=()=>{const u='https://wa.me/'+b2bData.shop.wa+'?text='+encodeURIComponent(b2bMsg());window.open(u,'_blank','noopener');};
{const _rt=route;route=function(){const h=location.hash||'';if(h.startsWith('#b2b=')){const tok=h.slice(5);b2bUnpack(tok).then(d=>{if(!d||d.v!==1)throw new Error('formato');b2bData=d;b2bView();}).catch(()=>{document.body.insertAdjacentHTML('beforeend','<div class="card" style="margin:2rem">El enlace del portal no es válido o está incompleto. Pedile uno nuevo al comercio.</div>');});return;}
 const v=$('#b2b-v');if(v)v.remove();return _rt.apply(this,arguments);};}

/* paquete «Todo el sistema» (después de que todos los archivos sumaron sus módulos) */
if(typeof GI_PACKS!=='undefined'&&!GI_PACKS.todo)GI_PACKS.todo={t:'Todo el sistema',k:GI_MODS.map(m=>m.k),x:['Reparto, despacho y rendición','Finanzas','Contabilidad de gestión','Atención al cliente']};
