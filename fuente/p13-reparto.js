/* ===== V26.69 · REPARTO Y DESPACHO OMNICANAL =====
   Origen del pedido (Mostrador/POS, teléfono, WhatsApp o Menú digital) ➔ Bandeja única de despacho ➔ Picking (cero olvidos)
   ➔ Hoja de ruta (orden óptimo, Google Maps / Waze) ➔ Copiloto del repartidor (celular, funciona sin señal) ➔ Rendición ciega en caja.
   Reglas que no se rompen:
   · La caja cuadra siempre. «Ya pagado» = venta normal del POS. «Cobrar en la puerta» = el pedido viaja SIN venta y la venta se
     registra recién en la rendición, con el medio con que realmente se cobró (efectivo / transferencia o QR). El cambio que se le da
     al repartidor sale de caja como egreso y vuelve como ingreso; faltante o sobrante quedan como movimiento propio, a nombre del repartidor.
   · Los datos del cliente y de la entrega viajan cifrados (__pii) en la nube. El cliente sólo ve el ESTADO de su pedido.
   · Reintentar no duplica: cada envío, hoja de ruta y rendición es un documento con su id (la sincronización es por documento).
   · Conectores «a un clic»: Mapas (gratis: Google Maps/Waze por enlace + OpenStreetMap; Pro: Google Routes), Cobro en la puerta
     (gratis: QR fijo / alias del local; Pro: Mercado Pago QR dinámico) y WhatsApp (gratis: enlace con el mensaje armado; Pro: WhatsApp
     Cloud API). Las claves Pro NUNCA pasan por el navegador: viven como secretos de la función «reparto-pro» en Supabase. */
IC.route='M6 19a2 2 0 1 0 0-.01M18 5a2 2 0 1 0 0-.01M6 17V9a4 4 0 0 1 4-4h2M18 7v8a4 4 0 0 1-4 4h-2';
const REP_EST={nuevo:'Nuevo',preparando:'Preparando',listo:'Listo para salir',en_ruta:'En camino',entregado:'Entregado',ausente:'Cliente ausente',devuelto:'Volvió al local',cancelado:'Cancelado'};
const REP_ORIG={pos:['🧾','Mostrador'],tel:['📞','Teléfono'],wa:['💬','WhatsApp'],menu:['📱','Menú digital']};
const REP_SEG={nuevo:'confirmado',preparando:'preparando',listo:'listo',en_ruta:'en_camino',entregado:'entregado',ausente:'ausente',devuelto:'ausente',cancelado:'cancelado'};
const REP_PICK_DEF='bebida, gaseosa, agua, cerveza, vino, hielo, postre, helado, salsa, aderezo, envase, retornable, cubiertos, servilleta';
function repCfg(){const c=S.cfg.rep||(S.cfg.rep={});const d={on:false,menu:false,origen:{lat:null,lng:null,dir:''},zonas:[],reps:[],cap:8,ausenteMin:5,pin:true,foto:false,pick:REP_PICK_DEF,
 cobro:{alias:'',titular:'',qrImg:''},msgSalida:'¡Hola {nombre}! Tu pedido #{n} de {comercio} ya salió 🛵. Llega en {eta}. {cobro} Tu código de entrega es {pin}.',
 con:{mapas:'free',cobro:'free',wa:'free',nav:'gmaps',test:{}},ausentePaga:false,rubro:''};
 for(const k in d)if(c[k]===undefined)c[k]=JSON.parse(JSON.stringify(d[k]));c.con=Object.assign({mapas:'free',cobro:'free',wa:'free',nav:'gmaps',test:{}},c.con||{});c.origen=Object.assign({lat:null,lng:null,dir:''},c.origen||{});c.cobro=Object.assign({alias:'',titular:'',qrImg:''},c.cobro||{});
 S.envios=S.envios||[];S.rutas=S.rutas||[];S.rendRep=S.rendRep||[];return c;}
const repOn=()=>!!(S.cfg&&S.cfg.rep&&S.cfg.rep.on); /* sin tocar la configuración (no crea nada si nunca se usó) */
const repZona=id=>repCfg().zonas.find(z=>z.id===id)||null;
const repRep=id=>repCfg().reps.find(r=>r.id===id)||null;
const repEnv=id=>(S.envios||[]).find(e=>e.id===id)||null;
const repRuta=id=>(S.rutas||[]).find(r=>r.id===id)||null;
const repTok=()=>{const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,b=>'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789'[b%61]).join('').slice(0,22);};
const repPin=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return String(1000+a[0]%9000);};
const repNum=()=>{const n=(S.envios||[]).reduce((m,e)=>Math.max(m,+e.n||0),0)+1;return n;};
function repHist(e,ev,extra){(e.hist=e.hist||[]).push(Object.assign({ts:now(),e:ev,u:user?user.name:'sistema'},extra||{}));if(e.hist.length>40)e.hist.splice(0,e.hist.length-40);}
/* ---------- geografía ---------- */
const repHav=(a,b)=>{if(!a||!b||a.lat==null||b.lat==null)return null;const R=6371,r=x=>x*Math.PI/180,dl=r(b.lat-a.lat),dg=r(b.lng-a.lng);const h=Math.sin(dl/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(h));};
function repParseLL(t){t=String(t||'');let m=/@(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/.exec(t)||/[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d{3,})(?:,|%2C)\s*(-?\d{1,3}\.\d{3,})/i.exec(t)||/!3d(-?\d{1,2}\.\d{3,})!4d(-?\d{1,3}\.\d{3,})/.exec(t)||/^\s*(-?\d{1,2}\.\d{3,})\s*[,; ]\s*(-?\d{1,3}\.\d{3,})\s*$/.exec(t);
 if(!m)return null;const lat=+m[1],lng=+m[2];return Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat:Math.round(lat*1e6)/1e6,lng:Math.round(lng*1e6)/1e6}:null;}
async function repGeocode(q){/* OpenStreetMap (Nominatim): gratis, sólo cuando el usuario toca «Buscar en el mapa» (máx. 1 por segundo) */
 if(Date.now()-(repGeocode.t||0)<1100)await new Promise(r=>setTimeout(r,1100));repGeocode.t=Date.now();
 const o=repCfg().origen;let url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&accept-language=es&q='+encodeURIComponent(q);
 if(o.lat!=null)url+='&viewbox='+[o.lng-.35,o.lat+.35,o.lng+.35,o.lat-.35].join(',');
 const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('mapa '+r.status);const j=await r.json();if(!j||!j[0])return null;return{lat:Math.round(+j[0].lat*1e6)/1e6,lng:Math.round(+j[0].lon*1e6)/1e6,txt:String(j[0].display_name||'').slice(0,140)};}
function repZonaAuto(ll){const c=repCfg(),o=c.origen;if(!ll||o.lat==null)return null;const d=repHav(o,ll);const Z=c.zonas.filter(z=>z.activo!==false&&+z.radio>0).sort((a,b)=>a.radio-b.radio);return Z.find(z=>d<=+z.radio)||null;}
function repFuera(ll){const c=repCfg(),o=c.origen;if(!ll||o.lat==null)return false;const Z=c.zonas.filter(z=>z.activo!==false&&+z.radio>0);if(!Z.length)return false;const max=Math.max(...Z.map(z=>+z.radio));return repHav(o,ll)>max;}
/* orden de paradas gratis: vecino más cercano + mejora 2-opt (sin coordenadas, por zona y ventana horaria) */
function repOrdenar(ids){const c=repCfg(),o=c.origen;const E=ids.map(repEnv).filter(Boolean);
 const con=E.filter(e=>e.cli&&e.cli.lat!=null),sin=E.filter(e=>!(e.cli&&e.cli.lat!=null));
 if(o.lat==null||con.length<2)return E.sort((a,b)=>(a.zona||'').localeCompare(b.zona||'')||((a.vh||'99')+'').localeCompare((b.vh||'99')+'')||a.ts-b.ts).map(e=>e.id);
 const P=[...con],out=[];let cur=o;while(P.length){let bi=0,bd=1e9;P.forEach((e,i)=>{const d=repHav(cur,e.cli);if(d<bd){bd=d;bi=i;}});const e=P.splice(bi,1)[0];out.push(e);cur=e.cli;}
 const len=r=>{let s=0,p=o;r.forEach(e=>{s+=repHav(p,e.cli);p=e.cli;});return s;};
 let best=out,bl=len(out),imp=true,guard=0;while(imp&&guard++<50){imp=false;for(let i=0;i<best.length-1;i++)for(let k=i+1;k<best.length;k++){const n=best.slice(0,i).concat(best.slice(i,k+1).reverse(),best.slice(k+1));const l=len(n);if(l+1e-9<bl){best=n;bl=l;imp=true;}}}
 /* las ventanas horarias que vencen antes van primero si hay una muy ajustada */
 return best.concat(sin).map(e=>e.id);}
function repKm(ids){const o=repCfg().origen;let s=0,p=o,ok=o.lat!=null;ids.map(repEnv).forEach(e=>{if(e&&e.cli&&e.cli.lat!=null&&p.lat!=null){s+=repHav(p,e.cli);p=e.cli;}else ok=false;});return ok?Math.round(s*10)/10:null;}
const repDirTxt=e=>[e.cli.dir,e.cli.loc].filter(Boolean).join(', ');
const repPt=e=>e.cli&&e.cli.lat!=null?e.cli.lat+','+e.cli.lng:repDirTxt(e);
function repMapsUrl(ids){const c=repCfg(),o=c.origen;const E=ids.map(repEnv).filter(Boolean);if(!E.length)return '';
 const org=o.lat!=null?o.lat+','+o.lng:(o.dir||'');const dst=repPt(E[E.length-1]);const w=E.slice(0,-1).map(repPt);
 return 'https://www.google.com/maps/dir/?api=1'+(org?'&origin='+encodeURIComponent(org):'')+'&destination='+encodeURIComponent(dst)+(w.length?'&waypoints='+encodeURIComponent(w.join('|')):'')+'&travelmode=driving';}
const repNavUrl=(e,app)=>app==='waze'?(e.cli.lat!=null?'https://waze.com/ul?ll='+e.cli.lat+','+e.cli.lng+'&navigate=yes':'https://waze.com/ul?q='+encodeURIComponent(repDirTxt(e))+'&navigate=yes')
 :'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(repPt(e))+'&travelmode=driving';
const repWaNum=t=>{const d=String(t||'').replace(/\D/g,'');if(d.length<8)return '';if(d.startsWith('549'))return d;if(d.startsWith('54'))return '549'+d.slice(2);const l=d.replace(/^0/,'').replace(/^(\d{2,4})15/,'$1');return '549'+l.slice(-10);};
const repWaUrl=(t,msg)=>{const n=repWaNum(t);return n?'https://wa.me/'+n+'?text='+encodeURIComponent(msg||''):'';};
const repTelUrl=t=>{const d=String(t||'').replace(/[^\d+]/g,'');return d.length>=6?'tel:'+d:'';};
/* ---------- dinero de cada envío ---------- */
const repCobrar=e=>e.cobro&&e.cobro.modo!=='pagado'?e.total:0;
const repVuelto=e=>e.cobro&&e.cobro.modo==='efectivo'&&e.cobro.abona>e.total?e.cobro.abona-e.total:0;
function repCobroTxt(e){const c=e.cobro||{};if(c.modo==='pagado')return 'Ya está pagado.';if(c.modo==='efectivo')return 'Abonás '+money(e.total)+' en efectivo'+(c.abona>e.total?' (llevamos vuelto de '+money(c.abona)+')':'')+'.';return 'Abonás '+money(e.total)+' con QR o transferencia al recibir.';}
function repComision(rep,E){if(!rep)return 0;const c=repCfg();return E.reduce((a,e)=>{if(e.estado!=='entregado'&&!(c.ausentePaga&&(e.estado==='ausente'||e.estado==='devuelto')))return a;return a+(+rep.fijo||0)+Math.round((+e.tarifa||0)*(+rep.pct||0)/100);},0);}
/* ---------- seguimiento del cliente (sólo el estado; en la nube por su referencia secreta) ---------- */
async function repSeg(e){if(!e||!e.tok)return;const st=REP_SEG[e.estado]||'confirmado';e.segSt=st;
 if(!(typeof CLOUD!=='undefined'&&CLOUD.on&&cl.ready&&cl.comercio))return;
 try{const r=e.rutaId?repRuta(e.rutaId):null;await rpc('reparto_estado_poner',{p_comercio:cl.comercio.id,p_ref:e.tok,p_estado:st,p_eta:e.eta||null,p_rep:r?String(r.repNom||'').split(' ')[0]:null,p_nota:e.estado==='ausente'?'No te encontramos: escribinos para coordinar.':null});e.segPend=0;}catch(x){e.segPend=1;}}
setInterval(()=>{if(!user||!repOn())return;(S.envios||[]).filter(e=>e.segPend&&now()-e.ts<2*86400000).slice(0,5).forEach(repSeg);},30000);
function repSetEst(e,est,extra){if(!e||e.estado===est)return;const old=e.estado;e.estado=est;repHist(e,est,extra);audit('REPARTO_ESTADO','#'+e.n+' · '+(REP_EST[old]||old)+' → '+(REP_EST[est]||est)+(extra&&extra.nota?' · '+String(extra.nota).slice(0,80):''));repSeg(e);}
/* ---------- producto «Envío a domicilio» (cargo de envío en el ticket; no figura en el menú ni controla stock) ---------- */
function repProd(){let p=S.products.find(x=>x.id==='p_envio');const rb=(repCfg().rubro&&rub(repCfg().rubro))?repCfg().rubro:(S.rubros.find(r=>!r.kind||r.kind==='normal')||S.rubros[0]||{}).id;
 if(!p){p={id:'p_envio',code:'ENVIO',name:'Envío a domicilio',sub:'',rubro:rb,price:0,cost:0,stock:1e6,unit:'u',active:true,menu:false,archived:false,envio:true};S.products.push(p);}
 if(p.stock<1e5)p.stock=1e6;p.menu=false;p.active=true;p.archived=false;if(!p.rubro||!rub(p.rubro))p.rubro=rb;return p;}
function repItemsOf(lines){return lines.map(l=>({pid:l.pid,name:l.name,rubro:l.rubro,qty:l.qty,price:l.price,cost:l.cost,unit:l.unit,list:l.list}));}
function repNuevo(o){const c=repCfg();const z=repZona(o.zona);
 const e={id:o.id||uid(),n:repNum(),ts:now(),orig:o.orig||'pos',estado:'nuevo',cli:o.cli,zona:z?z.id:'',zonaNom:z?z.nombre:(o.zonaNom||''),tarifa:o.tarifa||0,items:o.items||[],total:o.total||0,
  cobro:o.cobro||{modo:'pagado'},saleId:o.saleId||'',sold:!!o.saleId,pin:o.pin||repPin(),tok:o.tok||repTok(),vd:o.vd||'',vh:o.vh||'',prio:o.prio||'normal',nota:String(o.nota||'').slice(0,200),
  eta:z&&z.eta?z.eta:'',cupon:o.cupon||'',disc:o.disc||0,benLabel:o.benLabel||'',custId:o.custId||'',user:user?user.name:'sistema',hist:[]};
 repHist(e,'nuevo',{orig:e.orig});S.envios.push(e);
 audit('REPARTO_NUEVO','#'+e.n+' · '+(REP_ORIG[e.orig]||['',''])[1]+' · '+(e.zonaNom||'sin zona')+' · '+money(e.total)+' · '+(e.cobro.modo==='pagado'?'pagado':'cobrar en la puerta'));
 emit('delivery.created',{n:e.n,orig:e.orig});repSeg(e);save();return e;}
/* ---------- POS: «Envío a domicilio» ---------- */
let repDraft=null;
function repCartBtn(){if(!repOn()||!can('reparto'))return '';const has=pos.lines.some(l=>l.pid==='p_envio');
 const pend=repDraft&&repDraft.from==='pos'&&repDraft.sig===repSig(pos.lines);
 return (pend?`<div class="okbox sm" style="margin-top:.4rem">🛵 Al cobrar se crea el envío para <b>${esc(repDraft.o.cli.nombre)}</b>. <button class="btn sm ghost" data-act="repPosNo">Quitar el envío</button></div>`:'')+`<button class="btn" style="width:100%;margin-top:.4rem" data-act="repPos" ${pos.lines.length?'':'disabled'}>🛵 Envío a domicilio${has?' (cargo agregado)':''}</button>`;}
function repFormHtml(d){const c=repCfg();d=d||{};const cli=d.cli||{};const cb=d.cobro||{modo:'pagado'};
 const zs=c.zonas.filter(z=>z.activo!==false);
 return `<div class="rep-form"><div class="grid g2"><div><label for="rf-or">Origen del pedido</label><select id="rf-or">${['pos','tel','wa'].map(k=>`<option value="${k}" ${(d.orig||'pos')===k?'selected':''}>${REP_ORIG[k][0]} ${REP_ORIG[k][1]}</option>`).join('')}</select></div>
 <div><label for="rf-pr">Prioridad</label><select id="rf-pr"><option value="normal">Normal</option><option value="urgente" ${d.prio==='urgente'?'selected':''}>Urgente</option></select></div></div>
 <div class="grid g2"><div><label for="rf-nm">Recibe (nombre)</label><input id="rf-nm" maxlength="60" value="${esc(cli.nombre||'')}" autocomplete="off"></div><div><label for="rf-tl">Teléfono / WhatsApp</label><input id="rf-tl" maxlength="24" inputmode="tel" value="${esc(cli.tel||'')}" autocomplete="off"></div></div>
 <div class="grid g2"><div><label for="rf-dr">Calle y número</label><input id="rf-dr" maxlength="90" value="${esc(cli.dir||'')}" autocomplete="off"></div><div><label for="rf-lc">Barrio / localidad</label><input id="rf-lc" maxlength="60" value="${esc(cli.loc||'')}" autocomplete="off"></div></div>
 <label for="rf-rf">Referencias (piso, timbre, entre calles)</label><input id="rf-rf" maxlength="120" value="${esc(cli.ref||'')}" autocomplete="off">
 <label for="rf-ll">Ubicación (pegá el enlace de Google Maps que manda el cliente, o lat,lng)</label><div class="row"><input id="rf-ll" class="sp" maxlength="400" value="${cli.lat!=null?esc(cli.lat+','+cli.lng):''}" autocomplete="off" placeholder="https://maps.app.goo.gl/… o -24.79,-65.41"><button type="button" class="btn sm" data-act="repGeo">🔎 Buscar en el mapa</button></div><div id="rf-llmsg" class="sm mut" role="status"></div>
 <div class="grid g3"><div><label for="rf-zn">Zona</label><select id="rf-zn"><option value="">${zs.length?'Elegí la zona':'Sin zonas cargadas'}</option>${zs.map(z=>`<option value="${esc(z.id)}" ${d.zona===z.id?'selected':''}>${esc(z.nombre)} · ${money(z.tarifa||0)}</option>`).join('')}</select></div>
 <div><label for="rf-tf">Costo de envío ($)</label>${numIn('rf-tf',d.tarifa||0,'0')}</div><div><label>Ventana horaria</label><div class="row"><input id="rf-vd" type="time" value="${esc(d.vd||'')}" aria-label="Desde"><input id="rf-vh" type="time" value="${esc(d.vh||'')}" aria-label="Hasta"></div></div></div>
 <fieldset class="rep-cb"><legend>Cobro</legend>
  <label class="chk"><input type="radio" name="rf-cb" value="pagado" ${cb.modo==='pagado'?'checked':''}> Ya pagado en el mostrador (se cobra ahora)</label>
  <label class="chk"><input type="radio" name="rf-cb" value="efectivo" ${cb.modo==='efectivo'?'checked':''}> Cobrar efectivo en la puerta</label>
  <div class="row rep-ab" ${cb.modo==='efectivo'?'':'hidden'}><label for="rf-ab" class="sp">Abona con $ (para llevar el vuelto)</label>${numIn('rf-ab',cb.abona||0,'Justo')}</div>
  <label class="chk"><input type="radio" name="rf-cb" value="digital" ${cb.modo==='digital'?'checked':''}> Cobrar con QR / transferencia en la puerta</label></fieldset>
 <label for="rf-nt">Nota para el repartidor</label><input id="rf-nt" maxlength="200" value="${esc(d.nota||'')}">
 <div id="rf-sum" class="okbox sm" aria-live="polite"></div></div>`;}
function repFormRead(w,base){const g=id=>w.querySelector('#'+id);const ll=repParseLL(g('rf-ll').value);const t=cents(g('rf-tf').value||'0');
 const modo=(w.querySelector('input[name=rf-cb]:checked')||{}).value||'pagado';const ab=g('rf-ab')&&g('rf-ab').value.trim()?cents(g('rf-ab').value):0;
 const o={orig:g('rf-or').value,prio:g('rf-pr').value,cli:{nombre:g('rf-nm').value.trim().slice(0,60),tel:g('rf-tl').value.trim().slice(0,24),dir:g('rf-dr').value.trim().slice(0,90),loc:g('rf-lc').value.trim().slice(0,60),ref:g('rf-rf').value.trim().slice(0,120),lat:ll?ll.lat:null,lng:ll?ll.lng:null},
  zona:g('rf-zn').value,tarifa:isNaN(t)?NaN:t,vd:g('rf-vd').value,vh:g('rf-vh').value,cobro:{modo,abona:isNaN(ab)?NaN:ab},nota:g('rf-nt').value.trim()};
 if(base&&base.cli&&base.cli.custId)o.cli.custId=base.cli.custId;
 if(o.cli.nombre.length<2)return{err:'Escribí el nombre de quien recibe.'};if(!/[\d]{6,}/.test(o.cli.tel.replace(/\D/g,'')))return{err:'Cargá un teléfono válido para avisar y para que el repartidor pueda llamar.'};
 if(o.cli.dir.length<4&&!ll)return{err:'Cargá la dirección (calle y número) o la ubicación.'};if(isNaN(o.tarifa)||o.tarifa<0)return{err:'El costo de envío no es válido.'};
 if(g('rf-ll').value.trim()&&!ll)return{err:'No reconozco esa ubicación: pegá el enlace completo de Google Maps o «latitud, longitud».'};
 if(isNaN(o.cobro.abona)||o.cobro.abona<0)return{err:'«Abona con» no es un importe válido.'};
 if(repFuera(ll))return{err:'Esa ubicación queda fuera de las zonas de reparto. Revisala o quitá la ubicación y elegí la zona a mano.',soft:true,o};
 return{o};}
function repFormBind(w,totFn){const g=id=>w.querySelector('#'+id);
 const upd=()=>{const ll=repParseLL(g('rf-ll').value);const m=g('rf-llmsg');if(ll){const z=repZonaAuto(ll);if(z&&g('rf-zn').value!==z.id){g('rf-zn').value=z.id;g('rf-tf').value=pesosStr(z.tarifa||0);}const d=repHav(repCfg().origen,ll);m.textContent='📍 Ubicación cargada'+(d!=null?' · a '+(Math.round(d*10)/10)+' km del local':'')+(repFuera(ll)?' · ⚠️ fuera de las zonas de reparto':'');}else m.textContent='';
  const modo=(w.querySelector('input[name=rf-cb]:checked')||{}).value;const ab=w.querySelector('.rep-ab');if(ab)ab.hidden=modo!=='efectivo';
  const tf=cents(g('rf-tf').value||'0');const tot=totFn(isNaN(tf)?0:tf);const abn=g('rf-ab')&&g('rf-ab').value.trim()?cents(g('rf-ab').value):0;
  g('rf-sum').innerHTML=`Total del pedido con envío: <b>${money(tot)}</b>`+(modo==='efectivo'&&abn>tot?` · el repartidor lleva vuelto de <b>${money(abn-tot)}</b>`:'')+(modo==='efectivo'&&abn&&abn<tot?' · <span class="neg">«Abona con» es menor al total</span>':'')+(modo==='pagado'?' · se cobra ahora en el mostrador':' · se cobra en la puerta y entra a caja en la rendición');};
 w.addEventListener('input',upd);w.addEventListener('change',e=>{if(e.target.id==='rf-zn'){const z=repZona(e.target.value);if(z)g('rf-tf').value=pesosStr(z.tarifa||0);}upd();});upd();}
A.repGeo=async el=>{const w=el.closest('.dlg');const g=id=>w.querySelector('#'+id);const q=[g('rf-dr').value,g('rf-lc').value].filter(x=>x.trim()).join(', ');const m=g('rf-llmsg');
 if(q.length<4)return toast('Escribí la calle y el número primero.',1);m.textContent='Buscando en OpenStreetMap…';
 try{const r=await repGeocode(q+(repCfg().origen.dir&&!/,/.test(q)?'':''));if(!r){m.textContent='No la encontré. Pedile al cliente que comparta su ubicación por WhatsApp y pegá el enlace.';return;}g('rf-ll').value=r.lat+','+r.lng;g('rf-ll').dispatchEvent(new Event('input',{bubbles:true}));m.textContent+=' · '+r.txt;}
 catch(e){m.textContent='No se pudo consultar el mapa (¿hay internet?). Podés pegar el enlace de Google Maps.';}};
A.repPos=()=>{if(!pos.lines.length)return;if(!can('reparto'))return toast('Sin permiso para cargar envíos',1);repProd();
 const cust=pos.cust?custById(pos.cust):null;const prev=repDraft&&repDraft.from==='pos'?repDraft.o:null;
 const d=prev||{orig:'pos',cli:cust?{nombre:custFull(cust),tel:cust.wa||'',dir:'',loc:'',ref:'',custId:cust.id}:{},cobro:{modo:'pagado'}};
 const base=()=>pos.lines.filter(l=>l.pid!=='p_envio');const sub=()=>{const keep=pos.lines;pos.lines=base();const t=posTotal();pos.lines=keep;return t;};
 const w=modal('Envío a domicilio',repFormHtml(d),{wide:true,okText:'Enviar a la cola de despacho',onOk:()=>{const r=repFormRead(w,d);if(r.err&&!r.soft){toast(r.err,1);return false;}
   if(r.soft&&!w.dataset.fuera){w.dataset.fuera=1;toast(r.err+' Tocá de nuevo para enviarlo igual.',1);return false;}
   const o=r.o;const z=repZona(o.zona);if(!z&&repCfg().zonas.some(x=>x.activo!==false)&&!o.zona){toast('Elegí la zona de entrega.',1);return false;}
   o.zonaNom=z?z.nombre:'';
   /* cargo de envío como una línea del ticket */
   pos.lines=base();if(o.tarifa>0){const p=repProd();pos.lines.push({pid:p.id,name:p.name+(z?' · '+z.nombre:''),rubro:p.rubro,qty:1,price:o.tarifa,cost:0,unit:'u',list:o.tarifa});}
   const total=posTotal();if(o.cobro.modo==='efectivo'&&o.cobro.abona&&o.cobro.abona<total){toast('«Abona con» ('+money(o.cobro.abona)+') es menor al total ('+money(total)+').',1);return false;}
   if(o.cobro.modo==='pagado'){repDraft={from:'pos',o,sig:repSig(pos.lines),ts:now()};posCart();setTimeout(()=>A.cobrar(),60);return;}
   /* cobrar en la puerta: el pedido viaja sin venta (la venta se registra al rendir) y el mostrador queda libre */
   const B=posBen();const e=repNuevo(Object.assign({},o,{items:repItemsOf(pos.lines),total,custId:pos.cust||'',cupon:pos.coupon||'',disc:B.disc||0,benLabel:B.label||''}));
   pos.lines=[];pos.sel=-1;pos.cust='';pos.coupon='';pos.stamp='';pos.recv='';pos.mix=false;pos.pays=[];repDraft=null;posCart();if(typeof posGrid==='function')posGrid();
   toast('Envío #'+e.n+' en la cola de despacho · cobrar '+money(total)+' en la puerta');}});
 repFormBind(w,tf=>sub()+tf);};
A.repPosNo=()=>{repDraft=null;pos.lines=pos.lines.filter(l=>l.pid!=='p_envio');posCart();toast('Envío quitado del ticket');};
/* después de cobrar en el POS («ya pagado»): se crea el envío atado a la venta */
const repSig=L=>L.map(l=>l.pid+':'+l.qty+':'+l.price).join('|');
function repAfterSale(sale){if(!repDraft||repDraft.from!=='pos')return;const d=repDraft;repDraft=null;
 if(d.sig!==repSig(sale.items)||now()-d.ts>30*60000)return; /* se cambió el ticket o pasó mucho tiempo: no se crea un envío por error */
 const o=d.o;
 const e=repNuevo(Object.assign({},o,{items:sale.items.map(i=>({pid:i.pid,name:i.name,qty:i.qty,price:i.price,rubro:i.rubro})),total:sale.total,saleId:sale.id,custId:sale.cust||''}));
 sale.envio=e.id;setTimeout(()=>toast('Envío #'+e.n+' en la cola de despacho (pagado)'),400);}
/* ---------- canal digital: pedidos con envío desde el menú ---------- */
/* lo que se publica del reparto en el menú (sin datos internos) */
function repPublic(){if(!(S.cfg.rep&&S.cfg.rep.on&&S.cfg.rep.menu))return null;const c=repCfg();
 return{on:true,zonas:c.zonas.filter(z=>z.activo!==false).map(z=>({id:z.id,nombre:String(z.nombre).slice(0,40),tarifa:(+z.tarifa||0)/100,minimo:(+z.minimo||0)/100,eta:String(z.eta||'').slice(0,30)})),pin:!!c.pin,alias:c.cobro.alias?String(c.cobro.alias).slice(0,40):''};}
/* valida y arma el envío a partir del pedido del cliente: los precios los pone el sistema (nunca el celular) */
function repDesdeMenu(p,ref){const c=repCfg();if(!c.on||!c.menu)return{err:'reparto apagado'};
 if(!p||typeof p!=='object'||!Array.isArray(p.items)||!p.items.length||p.items.length>80)return{err:'pedido vacío'};
 const nombre=String(p.nombre||'').trim().slice(0,60),tel=String(p.tel||'').trim().slice(0,24),dir=String(p.dir||'').trim().slice(0,90);
 if(nombre.length<2||String(tel).replace(/\D/g,'').length<6||(dir.length<4&&!(p.lat!=null)))return{err:'faltan datos de entrega'};
 const items=[];for(const it of p.items){const pr=S.products.find(x=>x.id===String(it.id)&&x.active&&!x.archived);const q=+it.q;if(!pr||!(q>0)||q>999)continue;items.push({pid:pr.id,name:pfull(pr),rubro:pr.rubro,qty:Math.round(q*1000)/1000,price:pr.price,cost:pr.cost,unit:pr.unit,list:pr.price});}
 if(!items.length)return{err:'los productos ya no están disponibles'};
 const z=repZona(String(p.zona||''));const ll=(typeof p.lat==='number'&&typeof p.lng==='number'&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180)?{lat:Math.round(p.lat*1e6)/1e6,lng:Math.round(p.lng*1e6)/1e6}:null;
 const zz=z||repZonaAuto(ll);const tarifa=zz?(+zz.tarifa||0):0;
 if(tarifa>0){const pe=repProd();items.push({pid:pe.id,name:pe.name+' · '+zz.nombre,rubro:pe.rubro,qty:1,price:tarifa,cost:0,unit:'u',list:tarifa});}
 const total=items.reduce((a,l)=>a+Math.round(l.qty*l.price),0);const modo=p.pago==='efectivo'?'efectivo':'digital';
 const ab=modo==='efectivo'&&+p.abona>0?Math.round(+p.abona*100):0;
 return{o:{orig:'menu',cli:{nombre,tel,dir,loc:String(p.loc||'').slice(0,60),ref:String(p.ref||'').slice(0,120),lat:ll?ll.lat:null,lng:ll?ll.lng:null},zona:zz?zz.id:'',zonaNom:zz?zz.nombre:'',tarifa,items,total,
  cobro:{modo,abona:ab},pin:/^\d{4}$/.test(String(p.pin||''))?String(p.pin):repPin(),tok:/^[A-Za-z0-9_-]{16,40}$/.test(String(ref||p.tok||''))?String(ref||p.tok):repTok(),nota:String(p.nota||'').slice(0,200),cupon:String(p.cupon||'').slice(0,24),vh:/^\d\d:\d\d$/.test(p.vh||'')?p.vh:''}};}
function repAvisoNuevo(e){toast('🛵 Pedido nuevo del menú: #'+e.n+' · '+e.cli.nombre+' · '+money(e.total));try{if(typeof ptTone==='function'&&ptDev().son)ptTone([[880,0,.18],[1175,.2,.3]],.2);}catch(x){}
 if(curScreen==='reparto')setTimeout(rerender,50);}
/* demo / sin nube: el menú llama directo (mismo equipo) */
function repLocalOrder(p){const tok=repTok();const r=repDesdeMenu(Object.assign({},p,{tok}),tok);if(r.err)return{ok:false,msg:'No pudimos tomar el pedido: '+r.err+'.'};
 const e=repNuevo(r.o);repAvisoNuevo(e);return{ok:true,tok:e.tok,pin:e.pin,n:e.n};}
function repLocalTrack(refs){return(refs||[]).slice(0,10).map(ref=>{const e=(S.envios||[]).find(x=>x.tok===ref);if(!e)return null;const r=e.rutaId?repRuta(e.rutaId):null;
 return{ref,estado:REP_SEG[e.estado]||'recibido',eta:e.eta||'',rep:r?String(r.repNom||'').split(' ')[0]:'',ts:Math.round((e.hist&&e.hist.length?e.hist[e.hist.length-1].ts:e.ts)/1000)};}).filter(Boolean);}
/* nube: el celular del cliente cifra con la llave pública del comercio (el servidor no puede leer el pedido) */
async function repCloudOrder(p){const k=typeof snapC==='function'&&snapC()&&snapC().clubkey;if(!k)return{ok:false,msg:'El envío a domicilio no está disponible en este momento. Pedí por WhatsApp.'};
 const tok=repTok(),pin=repPin();try{const enc=await rsaSeal(k,Object.assign({},p,{tok,pin,v:1,ts:Date.now()}));const r=await rpc('reparto_pedir',{p_slug:CLOUD.slug,p_ref:tok,p_cifrado:enc},{auth:false});
  if(!r||!r.ok)return{ok:false,msg:(r&&r.error)?String(r.error):'No pudimos enviar el pedido.'};return{ok:true,tok,pin};}catch(e){return{ok:false,msg:'No pudimos enviar el pedido (¿hay internet?). Probá de nuevo o pedí por WhatsApp.'};}}
async function repCloudTrack(refs){try{const r=await rpc('reparto_estado_ver',{p_slug:CLOUD.slug,p_refs:(refs||[]).slice(0,10)},{auth:false});return r&&r.ok?r.pedidos||[]:[];}catch(e){return null;}}
let repImpBusy=false;
async function repImport(){if(repImpBusy||!repOn()||!S.cfg.rep.menu||typeof CLOUD==='undefined'||!CLOUD.on||!cl.ready||!cl.online||!cl.clubPriv||!cl.clubPriv.jwk||!can('reparto'))return 0;
 if(!['admin','supervisor','mostrador'].includes(cl.rol))return 0;repImpBusy=true;let n=0;
 try{const rows=await sel(`reparto_web?select=id,ref,cifrado,creado&comercio_id=eq.${cl.comercio.id}&estado=eq.nuevo&order=id&limit=30`);const ok=[],bad=[];
  for(const r of rows){if((S.envios||[]).some(e=>e.tok===r.ref)){ok.push(r.id);continue;} /* ya importado (reintento) */
   let p;try{p=await rsaOpen(cl.clubPriv.jwk,r.cifrado);}catch(e){if(Date.now()-Date.parse(r.creado||'')>86400000)bad.push(r.id);continue;}
   const x=repDesdeMenu(p,r.ref);if(x.err){bad.push(r.id);audit('REPARTO_MENU_RECHAZADO','pedido del menú '+r.id+': '+x.err);continue;}
   const e=repNuevo(x.o);repAvisoNuevo(e);n++;ok.push(r.id);}
  if(ok.length)await rpc('reparto_web_marcar',{p_comercio:cl.comercio.id,p_ids:ok,p_estado:'importado'}).catch(()=>{});
  if(bad.length)await rpc('reparto_web_marcar',{p_comercio:cl.comercio.id,p_ids:bad,p_estado:'rechazado'}).catch(()=>{});
 }catch(e){}finally{repImpBusy=false;}return n;}
setInterval(()=>{if(user&&!$('#panel').hidden&&!document.hidden)repImport();},8000);
/* ---------- BANDEJA ÚNICA DE DESPACHO ---------- */
let repTab='bandeja',repFil={zona:'',orig:''},repSel=new Set();
const repHoy=e=>now()-e.ts<36*3600000;
function repBadgeCobro(e){return e.cobro&&e.cobro.modo!=='pagado'?`<span class="rep-cb-b cobrar">COBRAR ${money(e.total)}${e.cobro.modo==='digital'?' · QR':''}</span>`:'<span class="rep-cb-b pagado">PAGADO</span>';}
function repCardHtml(e){const o=REP_ORIG[e.orig]||['📦','Otro'];const late=e.vh&&(()=>{const d=new Date(now());const[h,m]=e.vh.split(':');d.setHours(+h,+m,0,0);return d.getTime()<now()&&!['entregado','cancelado'].includes(e.estado);})();
 const sel=e.estado==='listo'&&!e.rutaId;
 return `<article class="rep-card ${e.prio==='urgente'?'urg':''} ${late?'late':''}" data-id="${esc(e.id)}">
 <div class="row"><span class="rep-or" title="${esc(o[1])}" aria-label="${esc(o[1])}">${o[0]}</span><b>#${e.n}</b>${sel?`<label class="chk rep-pick"><input type="checkbox" class="rep-selt" data-id="${esc(e.id)}" ${repSel.has(e.id)?'checked':''}> ruta</label>`:''}<span class="sp"></span><small>${hm(e.ts)}</small></div>
 <div class="rep-nm">${esc(e.cli.nombre)}</div><div class="sm mut">${esc(repDirTxt(e)||(e.cli.lat!=null?'Ubicación compartida':'Sin dirección'))}${e.cli.lat!=null?' · 📍':''}</div>
 <div class="row sm">${e.zonaNom?`<span class="tag">${esc(e.zonaNom)}</span>`:''}${e.vh?`<span class="tag ${late?'bad':''}">⏰ ${esc((e.vd?e.vd+'–':'hasta ')+e.vh)}</span>`:''}${e.prio==='urgente'?'<span class="tag bad">Urgente</span>':''}${e.rutaId?`<span class="tag ok">Ruta ${esc((repRuta(e.rutaId)||{}).n||'')}</span>`:''}</div>
 <div class="row">${repBadgeCobro(e)}<span class="sp"></span><span class="sm">${e.items.filter(i=>i.pid!=='p_envio').length} art.</span></div>
 <div class="row rep-acts">${e.estado==='nuevo'?`<button class="btn sm" data-act="repEst" data-id="${esc(e.id)}" data-e="preparando">Preparar</button>`:''}${['nuevo','preparando'].includes(e.estado)?`<button class="btn sm gold" data-act="repPicking" data-id="${esc(e.id)}">✓ Listo (picking)</button>`:''}${e.estado==='devuelto'?`<button class="btn sm" data-act="repEst" data-id="${esc(e.id)}" data-e="listo">Reprogramar</button>`:''}
 <button class="btn sm ghost" data-act="repVer" data-id="${esc(e.id)}">Ver</button></div></article>`;}
function repCol(tit,L,extra){return `<section class="rep-col" aria-label="${esc(tit)}"><h3>${esc(tit)} <span class="tag">${L.length}</span></h3>${extra||''}${L.map(repCardHtml).join('')||'<p class="sm mut">—</p>'}</section>`;}
function repBandeja(){const c=repCfg();let E=(S.envios||[]).filter(e=>!['cancelado'].includes(e.estado)&&(repHoy(e)||!['entregado'].includes(e.estado)));
 if(repFil.zona)E=E.filter(e=>e.zona===repFil.zona);if(repFil.orig)E=E.filter(e=>e.orig===repFil.orig);
 const ord=(a,b)=>(b.prio==='urgente')-(a.prio==='urgente')||((a.vh||'99')+'').localeCompare((b.vh||'99')+'')||a.ts-b.ts;
 const by=st=>E.filter(e=>st.includes(e.estado)).sort(ord);const listos=by(['listo']).filter(e=>!e.rutaId),asign=by(['listo']).filter(e=>e.rutaId);
 return `<div class="row rep-fil"><select id="rep-fz" aria-label="Filtrar por zona"><option value="">Todas las zonas</option>${c.zonas.map(z=>`<option value="${esc(z.id)}" ${repFil.zona===z.id?'selected':''}>${esc(z.nombre)}</option>`).join('')}</select>
 <select id="rep-fo" aria-label="Filtrar por origen"><option value="">Todos los orígenes</option>${Object.keys(REP_ORIG).map(k=>`<option value="${k}" ${repFil.orig===k?'selected':''}>${REP_ORIG[k][0]} ${REP_ORIG[k][1]}</option>`).join('')}</select><span class="sp"></span>
 <button class="btn sm" data-act="repSugerir">✨ Sugerir rutas</button><button class="btn sm gold" data-act="repArmar" ${repSel.size?'':'disabled'}>Armar hoja de ruta (${repSel.size})</button></div>
 <div class="rep-board">${repCol('Nuevos',by(['nuevo']))}${repCol('Preparando',by(['preparando']))}${repCol('Listos para salir',listos.concat(asign),listos.length?`<button class="btn sm ghost" data-act="repSelAll">Elegir todos</button>`:'')}${repCol('En camino',by(['en_ruta']))}${repCol('Ausentes / volvieron',by(['ausente','devuelto']))}${repCol('Entregados hoy',by(['entregado']).filter(repHoy).slice(-30))}</div>`;}
const repSelT=el=>{if(el.checked)repSel.add(el.dataset.id);else repSel.delete(el.dataset.id);const b=$('[data-act=repArmar]');if(b){b.disabled=!repSel.size;b.textContent='Armar hoja de ruta ('+repSel.size+')';}};
A.repSelAll=()=>{(S.envios||[]).filter(e=>e.estado==='listo'&&!e.rutaId&&(!repFil.zona||e.zona===repFil.zona)).forEach(e=>repSel.add(e.id));rerender();};
A.repEst=el=>{const e=repEnv(el.dataset.id);if(!e)return;const to=el.dataset.e;if(to==='listo'&&e.estado==='devuelto'){e.rutaId='';delete e.ent;}repSetEst(e,to);save();rerender();};
/* picking: control de cero olvidos antes de que salga */
function repAlertWords(){return String(repCfg().pick||'').split(',').map(x=>x.trim().toLowerCase()).filter(x=>x.length>2);}
A.repPicking=el=>{const e=repEnv(el.dataset.id);if(!e)return;const W=repAlertWords();const it=e.items.filter(i=>i.pid!=='p_envio');
 const al=i=>W.find(w=>String(i.name).toLowerCase().includes(w));
 const w=modal('Picking del pedido #'+e.n,`<p class="sm mut">Marcá cada artículo a medida que lo ponés en la bolsa. Lo resaltado se olvida seguido.</p>
 <div class="rep-pk">${it.map((i,k)=>`<label class="chk ${al(i)?'rep-al':''}"><input type="checkbox" class="rep-pk-c" data-k="${k}"> <b>${esc(String(i.qty).replace('.',','))}${i.unit&&i.unit!=='u'?' '+esc(i.unit):' ×'}</b> ${esc(i.name)}${al(i)?' <span class="tag warn">¡'+esc(al(i))+'!</span>':''}</label>`).join('')}
 <label class="chk"><input type="checkbox" class="rep-pk-c" data-k="tk"> Ticket / comprobante adentro de la bolsa</label>${e.cobro.modo==='efectivo'&&repVuelto(e)?`<label class="chk rep-al"><input type="checkbox" class="rep-pk-c" data-k="vu"> Vuelto preparado: <b>${money(repVuelto(e))}</b></label>`:''}</div>`,{okText:'Todo controlado: listo para salir',onOk:()=>{const C=[...w.querySelectorAll('.rep-pk-c')];if(C.some(x=>!x.checked)){toast('Faltan '+C.filter(x=>!x.checked).length+' ítems por controlar.',1);return false;}
   e.pick={ts:now(),by:user?user.name:'',n:C.length};repSetEst(e,'listo',{nota:'picking OK ('+C.length+')'});save();rerender();}});};
A.repVer=el=>{const e=repEnv(el.dataset.id);if(!e)return;const r=e.rutaId?repRuta(e.rutaId):null;const wa=repWaUrl(e.cli.tel,'Hola '+e.cli.nombre.split(' ')[0]+', te escribimos de '+S.tenant.name+' por tu pedido #'+e.n+'.');
 const w=modal('Envío #'+e.n+' · '+(REP_EST[e.estado]||e.estado),`<div class="grid g2"><div><p><b>${esc(e.cli.nombre)}</b> · ${esc(e.cli.tel)}<br>${esc(repDirTxt(e))}${e.cli.ref?'<br><span class="sm">'+esc(e.cli.ref)+'</span>':''}</p>
 <p class="sm">${(REP_ORIG[e.orig]||['',''])[0]} ${esc((REP_ORIG[e.orig]||['','Otro'])[1])} · ${fmtDT(e.ts)} · ${esc(e.zonaNom||'sin zona')}${e.vh?' · ⏰ '+esc((e.vd?e.vd+'–':'hasta ')+e.vh):''}</p>
 ${repBadgeCobro(e)}${repVuelto(e)?`<p class="sm">Abona con ${money(e.cobro.abona)} → vuelto ${money(repVuelto(e))}</p>`:''}<p class="sm">Código de entrega (PIN): <b>${esc(e.pin)}</b> · ${e.saleId?'Venta registrada':'La venta se registra al rendir'}</p>
 ${e.nota?`<p class="sm">📝 ${esc(e.nota)}</p>`:''}${r?`<p class="sm">Ruta ${esc(r.n)} · ${esc(r.repNom)}</p>`:''}</div>
 <div><table class="sm"><tbody>${e.items.map(i=>`<tr><td>${esc(String(i.qty).replace('.',','))}</td><td>${esc(i.name)}</td><td class="r">${money(Math.round(i.qty*i.price))}</td></tr>`).join('')}<tr><td></td><td><b>Total</b></td><td class="r"><b>${money(e.total)}</b></td></tr></tbody></table>
 <details><summary class="sm">Historial</summary><ul class="sm">${(e.hist||[]).map(h=>`<li>${fmtDT(h.ts)} · ${esc(REP_EST[h.e]||h.e)} · ${esc(h.u||'')}${h.nota?' · '+esc(h.nota):''}</li>`).join('')}</ul></details></div></div>
 <div class="row">${wa?`<a class="btn sm" target="_blank" rel="noopener" href="${esc(wa)}">💬 WhatsApp</a>`:''}${repTelUrl(e.cli.tel)?`<a class="btn sm" href="${esc(repTelUrl(e.cli.tel))}">📞 Llamar</a>`:''}<a class="btn sm" target="_blank" rel="noopener" href="${esc(repNavUrl(e,'gmaps'))}">🗺️ Mapa</a>
 ${!['entregado','cancelado','en_ruta'].includes(e.estado)&&!e.rutaId?`<button class="btn sm" data-act="repEdit" data-id="${esc(e.id)}">Editar</button><button class="btn sm red" data-act="repCancel" data-id="${esc(e.id)}">Cancelar envío</button>`:''}</div>`,{wide:true,okText:'Cerrar',noCancel:true});};
A.repEdit=el=>{const e=repEnv(el.dataset.id);if(!e)return;$$('#modal-root .ov').forEach(o=>o.remove());
 const w=modal('Editar envío #'+e.n,repFormHtml(e),{wide:true,okText:'Guardar',onOk:()=>{const r=repFormRead(w,e);if(r.err&&!r.soft){toast(r.err,1);return false;}const o=r.o;
   if(!e.saleId&&o.cobro.modo==='pagado'){toast('Este pedido no se cobró en el mostrador: elegí cobrar en la puerta (o cancelalo y cobralo en el POS).',1);return false;}
   if(e.saleId&&o.cobro.modo!=='pagado'){toast('Este pedido ya está cobrado: queda como pagado.',1);o.cobro={modo:'pagado'};}
   const z=repZona(o.zona);const dif=o.tarifa-(e.tarifa||0);
   if(dif&&e.saleId){toast('El costo de envío de una venta ya cobrada no se cambia acá (hacé una nota de crédito o un cobro aparte).',1);return false;}
   if(dif){const ln=e.items.find(i=>i.pid==='p_envio');if(ln){ln.price=o.tarifa;ln.list=o.tarifa;if(!o.tarifa)e.items=e.items.filter(i=>i!==ln);}else if(o.tarifa>0){const p=repProd();e.items.push({pid:p.id,name:p.name+(z?' · '+z.nombre:''),rubro:p.rubro,qty:1,price:o.tarifa,cost:0,unit:'u',list:o.tarifa});}e.total+=dif;}
   Object.assign(e,{orig:o.orig,prio:o.prio,cli:Object.assign({},e.cli,o.cli),zona:o.zona,zonaNom:z?z.nombre:'',tarifa:o.tarifa,vd:o.vd,vh:o.vh,cobro:o.cobro,nota:o.nota,eta:z&&z.eta?z.eta:e.eta});
   repHist(e,'editado');audit('REPARTO_EDITADO','#'+e.n);save();rerender();}});repFormBind(w,tf=>e.total-(e.tarifa||0)+tf);};
A.repCancel=el=>{const e=repEnv(el.dataset.id);if(!e)return;confirmBox('Cancelar el envío #'+e.n,e.saleId?'La venta ya está cobrada: si corresponde devolver el dinero, hacé la nota de crédito desde Ventas.':'El pedido no tenía venta registrada: no se toca la caja.',()=>{repSetEst(e,'cancelado');repSel.delete(e.id);save();rerender();},'Cancelar el envío');};
document.addEventListener('change',ev=>{const t=ev.target;if(t.classList&&t.classList.contains('rep-selt'))repSelT(t);if(t.id==='rep-fz'){repFil.zona=t.value;rerender();}if(t.id==='rep-fo'){repFil.orig=t.value;rerender();}});
/* ---------- HOJAS DE RUTA ---------- */
const repRepsAct=()=>repCfg().reps.filter(r=>r.activo!==false);
const repOcupado=rid=>(S.rutas||[]).some(r=>r.rep===rid&&['armada','en_curso'].includes(r.estado));
const repRutaNum=()=>'R-'+((S.rutas||[]).reduce((m,r)=>Math.max(m,+String(r.n||'').replace(/\D/g,'')||0),0)+1);
function repRutaTxt(ids){const k=repKm(ids);return ids.map((id,i)=>{const e=repEnv(id);return e?`<li><b>${i+1}.</b> #${e.n} · ${esc(e.cli.nombre)} · ${esc(repDirTxt(e))} ${repBadgeCobro(e)}</li>`:'';}).join('')+(k!=null?`<li class="sm mut">Recorrido aproximado: ${k} km (en línea recta entre paradas)</li>`:'');}
async function repOptimo(ids){const c=repCfg();if(c.con.mapas==='google'&&typeof CLOUD!=='undefined'&&CLOUD.on&&cl.ready){
  try{const E=ids.map(repEnv);if(E.every(e=>e&&e.cli.lat!=null)&&c.origen.lat!=null){const r=await repPro('rutas',{origen:c.origen,paradas:E.map(e=>({id:e.id,lat:e.cli.lat,lng:e.cli.lng}))});if(r&&Array.isArray(r.orden)&&r.orden.length===ids.length)return{ids:r.orden,via:'Google Routes'};}}catch(e){}}
 return{ids:repOrdenar(ids),via:'cálculo propio (gratis)'};}
function repArmarModal(ids,repId){const reps=repRepsAct();if(!reps.length)return toast('Cargá al menos un repartidor en Reparto → Configuración.',1);
 const vu=ids.map(repEnv).reduce((a,e)=>a+(e?repVuelto(e):0),0);let orden=repOrdenar(ids),via='cálculo propio (gratis)';
 const body=()=>`<label for="ra-rep">Repartidor</label><select id="ra-rep">${reps.map(r=>`<option value="${esc(r.id)}" ${(repId||'')===r.id?'selected':''}>${esc(r.nombre)}${r.veh?' · '+esc(r.veh):''}${repOcupado(r.id)?' (con una ruta en curso)':''}</option>`).join('')}</select>
 <div class="grid g2"><div><label for="ra-cb">Cambio inicial que lleva ($)</label>${numIn('ra-cb',vu,'0')}<p class="sm mut">Vueltos que tiene que dar en esta ruta: ${money(vu)}. Sale de la caja al despachar y vuelve al rendir.</p></div><div><p class="sm"><b>Orden de paradas:</b> <span id="ra-via">${esc(via)}</span></p><button type="button" class="btn sm" data-act="repOpt">↻ Reordenar óptimo</button></div></div>
 <ol class="rep-ol" id="ra-ol">${repRutaTxt(orden)}</ol><p class="sm"><a target="_blank" rel="noopener" id="ra-map" href="${esc(repMapsUrl(orden))}">Ver el recorrido en Google Maps ↗</a></p>`;
 const w=modal('Hoja de ruta · '+ids.length+' pedidos',body(),{wide:true,okText:'Crear hoja de ruta',onOk:()=>{const rid=w.querySelector('#ra-rep').value,rp=repRep(rid);const cb=cents(w.querySelector('#ra-cb').value||'0');
   if(!rp)return toast('Elegí el repartidor.',1),false;if(isNaN(cb)||cb<0)return toast('El cambio inicial no es válido.',1),false;
   const cap=+rp.cap||repCfg().cap||8;if(orden.length>cap&&!w.dataset.cap){w.dataset.cap=1;toast('Son '+orden.length+' pedidos y la capacidad de '+rp.nombre+' es '+cap+'. Tocá de nuevo para crearla igual.',1);return false;}
   if(orden.some(id=>{const e=repEnv(id);return !e||e.estado!=='listo'||e.rutaId;}))return toast('Algún pedido cambió de estado: volvé a elegirlos.',1),false;
   const r={id:uid(),n:repRutaNum(),ts:now(),rep:rp.id,repNom:rp.nombre,envios:orden.slice(),estado:'armada',cambio:cb,km:repKm(orden),via,url:repMapsUrl(orden),user:user?user.name:''};
   S.rutas.push(r);orden.forEach(id=>{const e=repEnv(id);e.rutaId=r.id;repHist(e,'en ruta '+r.n);repSel.delete(id);});
   audit('REPARTO_RUTA',r.n+' · '+rp.nombre+' · '+orden.length+' pedidos · cambio '+money(cb));save();repTab='rutas';rerender();toast('Hoja de ruta '+r.n+' creada. Despachala cuando salga el repartidor.');}});
 w._orden=()=>orden;w._set=(o,v)=>{orden=o;via=v;w.querySelector('#ra-ol').innerHTML=repRutaTxt(orden);w.querySelector('#ra-via').textContent=via;w.querySelector('#ra-map').href=repMapsUrl(orden);};}
A.repOpt=async el=>{const w=el.closest('.ov');if(!w||!w._orden)return;el.disabled=true;const r=await repOptimo(w._orden());w._set(r.ids,r.via);el.disabled=false;};
A.repArmar=()=>{const ids=[...repSel].filter(id=>{const e=repEnv(id);return e&&e.estado==='listo'&&!e.rutaId;});if(!ids.length)return toast('Elegí pedidos «Listos para salir».',1);repArmarModal(ids);};
A.repSugerir=()=>{const c=repCfg();const L=(S.envios||[]).filter(e=>e.estado==='listo'&&!e.rutaId);if(!L.length)return toast('No hay pedidos listos para salir.',1);
 const libres=repRepsAct().filter(r=>!repOcupado(r.id));if(!libres.length)return toast('No hay repartidores libres (todos tienen una ruta armada o en curso).',1);
 const byZ={};L.forEach(e=>{(byZ[e.zona||'_']=byZ[e.zona||'_']||[]).push(e.id);});const grupos=[];
 Object.values(byZ).forEach(ids=>{const o=repOrdenar(ids);for(let i=0;i<o.length;i+=c.cap)grupos.push(o.slice(i,i+c.cap));});
 grupos.sort((a,b)=>b.length-a.length);const prop=grupos.slice(0,libres.length).map((g,i)=>({ids:g,rep:libres[i]}));
 modal('Rutas sugeridas',`<p class="sm mut">Agrupadas por zona y cercanía, hasta ${c.cap} pedidos por repartidor. Revisá y creá cada una.</p>${prop.map((p,i)=>`<div class="card sm"><div class="row"><b class="sp">${esc(p.rep.nombre)} · ${p.ids.length} pedidos · ${esc(repEnv(p.ids[0]).zonaNom||'sin zona')}</b><button class="btn sm gold" data-act="repSugUsar" data-i="${i}">Usar</button></div><ol class="rep-ol">${repRutaTxt(p.ids)}</ol></div>`).join('')}${grupos.length>prop.length?`<p class="sm warn">Quedan ${grupos.length-prop.length} grupo(s) sin repartidor libre.</p>`:''}`,{wide:true,okText:'Cerrar',noCancel:true});
 A.repSugUsar=el=>{const p=prop[+el.dataset.i];$$('#modal-root .ov').forEach(o=>o.remove());repArmarModal(p.ids,p.rep.id);};};
function repRubroCaja(){const c=repCfg();const r=c.rubro&&rub(c.rubro);if(r&&!['msec','shared','cobr'].includes(r.kind))return r.id;const x=S.rubros.find(q=>!q.kind||q.kind==='normal'||q.kind==='rubro')||S.rubros.find(q=>!['msec','shared','cobr'].includes(q.kind));return x?x.id:'';}
async function repNotificar(r){const c=repCfg();const E=r.envios.map(repEnv).filter(Boolean);
 if(c.con.wa==='cloud'&&typeof CLOUD!=='undefined'&&CLOUD.on&&cl.ready){try{const res=await repPro('wa_salida',{mensajes:E.filter(e=>repWaNum(e.cli.tel)).map(e=>({tel:repWaNum(e.cli.tel),texto:repMsgSalida(e)}))});if(res&&res.ok){audit('REPARTO_AVISOS','WhatsApp automático · '+(res.enviados||0)+' avisos · '+r.n);return null;}}catch(e){}}
 return E.map(e=>({e,url:repWaUrl(e.cli.tel,repMsgSalida(e))})).filter(x=>x.url);}
function repMsgSalida(e){const c=repCfg();return String(c.msgSalida||'').replace(/\{nombre\}/g,String(e.cli.nombre||'').split(' ')[0]).replace(/\{n\}/g,e.n).replace(/\{comercio\}/g,S.tenant.name).replace(/\{eta\}/g,e.eta||'un rato').replace(/\{cobro\}/g,repCobroTxt(e)).replace(/\{pin\}/g,c.pin?e.pin:'').replace(/\s+Tu código de entrega es \.?$/,'').slice(0,600);}
A.repDespachar=el=>{const r=repRuta(el.dataset.id);if(!r||r.estado!=='armada')return;if(!can('reparto'))return toast('Sin permiso',1);
 if(r.cambio>0&&!openSess())return toast('Abrí la caja: el cambio inicial ('+money(r.cambio)+') sale de la caja.',1);
 confirmBox('Despachar '+r.n,`Sale <b>${esc(r.repNom)}</b> con ${r.envios.length} pedidos${r.cambio?` y <b>${money(r.cambio)}</b> de cambio (egreso de caja)`:''}. Los clientes pasan a ver «en camino».`,async()=>{
  if(r.cambio>0){const er=addMov('egreso',repRubroCaja(),'Cambio para reparto '+r.n+' · '+r.repNom,r.cambio);if(er)return toast(er,1);r.movCambio=(S.movs[S.movs.length-1]||{}).id;}
  r.estado='en_curso';r.salida=now();r.envios.map(repEnv).forEach(e=>{if(e&&e.estado==='listo')repSetEst(e,'en_ruta',{nota:r.n});});audit('REPARTO_SALIDA',r.n+' · '+r.repNom+' · '+r.envios.length+' pedidos');save();rerender();
  const L=await repNotificar(r);if(L&&L.length)modal('Avisar a los clientes',`<p class="sm">Tocá cada uno para mandar el aviso por WhatsApp (se abre con el mensaje armado).</p>${L.map(x=>`<a class="btn sm" style="margin:.2rem" target="_blank" rel="noopener" href="${esc(x.url)}">💬 #${x.e.n} · ${esc(x.e.cli.nombre)}</a>`).join('')}`,{okText:'Listo',noCancel:true});},'Despachar');};
A.repDesarmar=el=>{const r=repRuta(el.dataset.id);if(!r||r.estado!=='armada')return;confirmBox('Deshacer '+r.n,'Los pedidos vuelven a «Listos para salir».',()=>{r.envios.map(repEnv).forEach(e=>{if(e){e.rutaId='';repHist(e,'ruta deshecha');}});r.estado='anulada';audit('REPARTO_RUTA_ANULADA',r.n);save();rerender();},'Deshacer');};
function repRutasHtml(){const R=(S.rutas||[]).filter(r=>r.estado!=='anulada').slice().reverse();const act=R.filter(r=>['armada','en_curso','cerrada'].includes(r.estado)),hist=R.filter(r=>r.estado==='rendida').slice(0,30);
 const est={armada:['Armada (falta despachar)','warn'],en_curso:['En la calle','ok'],cerrada:['Volvió · falta rendir','warn'],rendida:['Rendida','']};
 const fila=r=>{const E=r.envios.map(repEnv).filter(Boolean);const ok=E.filter(e=>e.estado==='entregado').length;const aus=E.filter(e=>['ausente','devuelto'].includes(e.estado)).length;
  return `<div class="card rep-ruta"><div class="row"><b>${esc(r.n)}</b><span class="tag ${est[r.estado][1]}">${est[r.estado][0]}</span><span class="sp"></span><span class="sm">${esc(r.repNom)} · ${fmtDT(r.ts)}</span></div>
  <div class="sm">${E.length} pedidos · ${ok} entregados${aus?' · '+aus+' ausentes':''} · cambio ${money(r.cambio||0)}${r.km!=null?' · '+r.km+' km':''}</div><ol class="rep-ol">${repRutaTxt(r.envios)}</ol>
  <div class="row"><a class="btn sm" target="_blank" rel="noopener" href="${esc(repMapsUrl(r.envios))}">🗺️ Google Maps</a>${r.estado==='armada'?`<button class="btn sm gold" data-act="repDespachar" data-id="${esc(r.id)}">🛵 Despachar</button><button class="btn sm ghost" data-act="repDesarmar" data-id="${esc(r.id)}">Deshacer</button>`:''}${['en_curso','cerrada'].includes(r.estado)&&can('reparto_rend')?`<button class="btn sm gold" data-act="repRendir" data-id="${esc(r.id)}">💵 Rendir en caja</button>`:''}</div></div>`;};
 return (act.length?act.map(fila).join(''):'<p class="mut">No hay rutas activas. Elegí pedidos «Listos para salir» en la bandeja y armá una hoja de ruta.</p>')+(hist.length?`<h3 style="margin-top:1rem">Rendidas</h3>`+hist.map(fila).join(''):'');}
/* ---------- RENDICIÓN CIEGA EN CAJA ---------- */
function repCuentas(r){const E=r.envios.map(repEnv).filter(Boolean);let ef=0,dg=0;const pend=[];
 E.forEach(e=>{if(e.estado==='entregado'&&e.cobro.modo!=='pagado'){const cb=(e.ent&&e.ent.cobrado)||{modo:e.cobro.modo,monto:e.total};if(cb.modo==='efectivo')ef+=cb.monto||0;else dg+=cb.monto||0;}if(e.estado==='en_ruta')pend.push(e);});
 return{E,ef,dg,pend,esperado:(r.cambio||0)+ef,com:repComision(repRep(r.rep),E),viajes:E.filter(e=>e.estado==='entregado').length,aus:E.filter(e=>['ausente','devuelto'].includes(e.estado)).length};}
A.repRendir=el=>{const r=repRuta(el.dataset.id);if(!r||!['en_curso','cerrada'].includes(r.estado))return;if(!can('reparto_rend'))return toast('Sin permiso para recibir rendiciones',1);
 if(!openSess())return toast('Abrí la caja: la rendición entra a la caja abierta.',1);const K=repCuentas(r);
 const w=modal('Rendición '+r.n+' · '+r.repNom,`<p class="sm mut"><b>Rendición ciega:</b> contá el efectivo que entrega el repartidor y escribí el total <b>antes</b> de ver el cálculo del sistema.</p>
 <ul class="sm">${K.E.map(e=>`<li>#${e.n} · ${esc(e.cli.nombre)} · <b>${esc(REP_EST[e.estado]||e.estado)}</b>${e.estado==='entregado'&&e.cobro.modo!=='pagado'?' · cobró '+esc(((e.ent&&e.ent.cobrado&&e.ent.cobrado.modo)==='efectivo')?'efectivo':'QR/transferencia'):''}</li>`).join('')}</ul>
 ${K.pend.length?`<div class="warnbox sm">${K.pend.length} pedido(s) siguen «en camino»: si rendís ahora vuelven al local como no entregados.</div>`:''}
 <label for="rr-cnt">Efectivo contado ($)</label>${numIn('rr-cnt',0,'0')}`,{okText:'Comparar',onOk:()=>{const cnt=cents(val('rr-cnt')||'0');if(isNaN(cnt)||cnt<0){toast('Escribí el efectivo contado.',1);return false;}setTimeout(()=>repRendir2(r,cnt),30);}});
 setTimeout(()=>{const i=w.querySelector('#rr-cnt');if(i)i.focus();},60);};
function repRendir2(r,cnt){const K=repCuentas(r);const dif=cnt-K.esperado;const dec=r.decl!=null?r.decl:null;
 const w=modal('Rendición '+r.n+' · resultado',`<table class="sm rep-rd"><tbody>
 <tr><td>Cambio inicial que llevó</td><td class="r">${money(r.cambio||0)}</td></tr><tr><td>Efectivo cobrado en la puerta</td><td class="r">${money(K.ef)}</td></tr>
 <tr><td><b>Efectivo esperado</b></td><td class="r"><b>${money(K.esperado)}</b></td></tr>${dec!=null?`<tr><td>Declarado por el repartidor (sin ver lo esperado)</td><td class="r">${money(dec)}</td></tr>`:''}
 <tr><td><b>Contado en caja</b></td><td class="r"><b>${money(cnt)}</b></td></tr><tr><td><b>Diferencia</b></td><td class="r ${dif<0?'neg':''}"><b>${dif===0?'Sin diferencia ✓':(dif<0?'Faltan ':'Sobran ')+money(Math.abs(dif))}</b></td></tr>
 <tr><td>Cobros digitales (QR / transferencia)</td><td class="r">${money(K.dg)}</td></tr><tr><td>Viajes entregados · ausentes</td><td class="r">${K.viajes} · ${K.aus+K.pend.length}</td></tr>
 <tr><td><b>Comisión del repartidor</b></td><td class="r"><b>${money(K.com)}</b></td></tr></tbody></table>
 ${K.com>0?`<label class="chk"><input type="checkbox" id="rr-pay" checked> Pagar la comisión ahora en efectivo (egreso de caja)</label>`:''}
 <p class="sm mut">Al confirmar: se registran las ventas cobradas en la puerta con su medio real, vuelve el cambio a la caja${dif?', la diferencia queda como movimiento a nombre del repartidor':''} y los no entregados vuelven a la bandeja.</p>`,{wide:true,okText:'Confirmar rendición',onOk:()=>{const pay=!!(w.querySelector('#rr-pay')||{}).checked;const er=repRendirAplicar(r,cnt,pay);if(er){toast(er,1);return false;}}});}
function repRendirAplicar(r,cnt,pay){if(!openSess())return 'Abrí la caja.';const K=repCuentas(r);const rb=repRubroCaja();if(!rb)return 'Falta un rubro para registrar los movimientos (Configuración → Rubros).';const errs=[];
 /* 1) ventas de lo cobrado en la puerta (una sola vez por envío: si algo falla, rendir de nuevo continúa donde quedó) */
 K.E.forEach(e=>{if(e.estado!=='entregado'||e.sold||e.saleId)return;const cb=(e.ent&&e.ent.cobrado)||{modo:e.cobro.modo,monto:e.total};const m=cb.modo==='efectivo'?'efectivo':'transferencia';
  const res=commitSale(m,false,'reparto',e.items.map(i=>Object.assign({},i)),{custId:'',coupon:'',recv:0,noAdj:true,pdSkip:true,extraDisc:e.disc||0,extraKind:'reparto',extraLabel:e.benLabel||'Beneficio aplicado al tomar el pedido'});
  if(res.err){errs.push('#'+e.n+': '+res.err);return;}
  const cu=e.custId&&custById(e.custId);if(cu){res.sale.cust=cu.id;res.sale.custName=cu.name+' '+cu.last;}
  if(res.sale.total!==e.total)audit('REPARTO_DIF_PRECIO','#'+e.n+' · pedido '+money(e.total)+' · venta '+money(res.sale.total));e.saleId=res.sale.id;e.sold=true;res.sale.envio=e.id;res.sale.ref=cb.ref||'';repHist(e,'venta '+res.sale.n);});
 if(errs.length){save();return 'No se pudo registrar: '+errs.join(' · ')+'. Corregilo (por ejemplo, el producto) y volvé a rendir.';}
 /* 2) caja: vuelve el cambio, diferencia y comisión */
 if(r.cambio>0&&!r.movVuelta){const e=addMov('ingreso',rb,'Devolución de cambio reparto '+r.n+' · '+r.repNom,r.cambio);if(e)return e;r.movVuelta=(S.movs[S.movs.length-1]||{}).id;}
 const dif=cnt-K.esperado;
 if(dif<0)addMov('egreso',rb,'Faltante rendición '+r.n+' (a cargo de '+r.repNom+')',-dif);else if(dif>0)addMov('ingreso',rb,'Sobrante rendición '+r.n+' · '+r.repNom,dif);
 if(pay&&K.com>0){const e=addMov('egreso',rb,'Comisión reparto '+r.n+' · '+r.repNom,K.com);if(!e)r.comPag=now();}
 /* 3) lo no entregado vuelve a la bandeja */
 K.E.forEach(e=>{if(e.estado==='en_ruta'||e.estado==='ausente'){repSetEst(e,'devuelto',{nota:'rendición '+r.n});}});
 const rr={id:uid(),ts:now(),ruta:r.id,n:r.n,rep:r.rep,repNom:r.repNom,cambio:r.cambio||0,efectivo:K.ef,digital:K.dg,esperado:K.esperado,contado:cnt,declarado:r.decl!=null?r.decl:null,dif,comision:K.com,comPagada:!!r.comPag,viajes:K.viajes,ausentes:K.aus+K.pend.length,by:user?user.name:''};
 S.rendRep.push(rr);r.estado='rendida';r.rend=rr.id;r.fin=r.fin||now();
 audit('REPARTO_RENDICION',r.n+' · '+r.repNom+' · esperado '+money(K.esperado)+' · contado '+money(cnt)+(dif?' · diferencia '+money(dif):' · sin diferencia')+' · comisión '+money(K.com)+(r.comPag?' (pagada)':' (a liquidar)'));
 save();rerender();toast('Rendición '+r.n+' registrada'+(dif?' · diferencia '+money(dif):''));return '';}
A.repComPagar=el=>{const r=repRuta(el.dataset.id);const rr=r&&(S.rendRep||[]).find(x=>x.id===r.rend);if(!r||!rr||r.comPag)return;if(!openSess())return toast('Abrí la caja.',1);
 confirmBox('Pagar comisión '+r.n,'Egreso de caja de '+money(rr.comision)+' para '+esc(r.repNom)+'.',()=>{const e=addMov('egreso',repRubroCaja(),'Comisión reparto '+r.n+' · '+r.repNom,rr.comision);if(e)return toast(e,1);r.comPag=now();save();rerender();},'Pagar');};
function repRendHtml(){const L=(S.rendRep||[]).slice().reverse().slice(0,60);if(!L.length)return '<p class="mut">Todavía no hay rendiciones.</p>';
 const pend=L.filter(x=>{const r=repRuta(x.ruta);return x.comision>0&&r&&!r.comPag;});
 return (pend.length?`<div class="warnbox sm">Comisiones a liquidar: <b>${money(pend.reduce((a,x)=>a+x.comision,0))}</b></div>`:'')+`<div class="tw"><table><thead><tr><th>Fecha</th><th>Ruta</th><th>Repartidor</th><th class="r">Esperado</th><th class="r">Contado</th><th class="r">Diferencia</th><th class="r">Digital</th><th class="r">Viajes</th><th class="r">Comisión</th><th></th></tr></thead><tbody>${L.map(x=>{const r=repRuta(x.ruta);return `<tr><td class="nowrap">${fmtDT(x.ts)}</td><td>${esc(x.n)}</td><td>${esc(x.repNom)}</td><td class="r">${money(x.esperado)}</td><td class="r">${money(x.contado)}</td><td class="r ${x.dif<0?'neg':''}">${x.dif?money(x.dif):'✓'}</td><td class="r">${money(x.digital)}</td><td class="r">${x.viajes}${x.ausentes?' (+'+x.ausentes+' aus.)':''}</td><td class="r">${money(x.comision)}</td><td>${x.comision>0?(r&&r.comPag?'<span class="tag ok">Pagada</span>':`<button class="btn sm" data-act="repComPagar" data-id="${esc(x.ruta)}">Pagar</button>`):''}</td></tr>`;}).join('')}</tbody></table></div>`;}
/* ---------- conectores Pro (función «reparto-pro» en Supabase; las claves nunca pasan por el navegador) ---------- */
const repCloudOk=()=>typeof CLOUD!=='undefined'&&CLOUD.on&&cl.ready&&cl.comercio;
function repPro(accion,data){if(!repCloudOk())return Promise.reject(new Error('Disponible con la nube'));return hreq('/functions/v1/reparto-pro',{method:'POST',fn:true,body:Object.assign({accion,comercio:cl.comercio.id},data||{})});}
const REP_CON={mapas:{t:'Mapas y rutas',free:'Gratis: Google Maps / Waze por enlace + OpenStreetMap',pro:'google',proT:'Google Routes API (orden óptimo con tránsito)',sec:'GOOGLE_ROUTES_KEY'},
 cobro:{t:'Cobro en la puerta',free:'Gratis: QR fijo / alias del local (el repartidor confirma el cobro)',pro:'mp',proT:'Mercado Pago: QR del monto exacto con confirmación automática',sec:'MP_ACCESS_TOKEN'},
 wa:{t:'Aviso por WhatsApp',free:'Gratis: enlace con el mensaje armado (se envía con un toque)',pro:'cloud',proT:'WhatsApp Cloud API: aviso automático al salir',sec:'WA_TOKEN y WA_PHONE_ID'}};
function repConHtml(){const c=repCfg();const nube=repCloudOk();
 return `<div class="card" id="rep-con" style="margin-top:1rem"><h3>Conectores a un clic</h3><p class="sm mut">Lo gratis funciona ya. Para lo Pro, cargá la clave del servicio como <b>secreto</b> de la función <code>reparto-pro</code> en Supabase (nunca acá) y tocá «Probar y activar».</p>
 ${Object.entries(REP_CON).map(([k,x])=>{const pro=c.con[k]===x.pro;const t=c.con.test[k];return `<div class="rep-con-it"><div class="row"><b class="sp">${esc(x.t)}</b><span class="tag ${pro?'ok':''}">${pro?'Pro activo':'Gratis activo'}</span></div>
  <label class="chk"><input type="radio" name="rc-${k}" value="free" ${pro?'':'checked'}> ${esc(x.free)}</label>
  <label class="chk"><input type="radio" name="rc-${k}" value="${x.pro}" ${pro?'checked':''} ${nube?'':'disabled'}> ${esc(x.proT)} <span class="sm mut">· secreto: ${esc(x.sec)}</span></label>
  <div class="row"><button class="btn sm" data-act="repConTest" data-k="${k}" ${nube?'':'disabled'}>Probar y activar</button><span class="sm ${t&&t.ok?'':'mut'}">${t?(t.ok?'✓ ':'✗ ')+esc(t.msg||'')+' · '+fmtDT(t.ts):(nube?'':'Disponible con la nube')}</span></div></div>`;}).join('')}</div>`;}
A.repConTest=async el=>{const k=el.dataset.k,x=REP_CON[k];const c=repCfg();el.disabled=true;let ok=false,msg='';
 try{const r=await repPro('test',{conector:k});ok=!!(r&&r.ok);msg=(r&&r.msg)||(ok?'Funciona':'No respondió bien');}catch(e){msg=String(e&&e.message||e).slice(0,120);}
 c.con.test[k]={ok,msg:msg.slice(0,120),ts:now()};if(ok)c.con[k]=x.pro;audit('REPARTO_CONECTOR',x.t+': '+(ok?'activado (Pro)':'falló la prueba · '+msg.slice(0,80)));save();el.disabled=false;rerender();toast(ok?x.t+': Pro activado':x.t+': '+msg,!ok);};
/* ---------- COPILOTO DEL REPARTIDOR (celular · una parada a la vez · funciona sin señal) ---------- */
let repVer='';/* el administrador puede ver el copiloto «como» un repartidor */
function repMine(){const c=repCfg();if(repVer&&(can('reparto')||can('config')))return repRep(repVer);if(!user)return null;
 return c.reps.find(r=>r.activo!==false&&r.login&&(r.login===user.id||String(r.login).toLowerCase()===String(user.name||'').toLowerCase()))||null;}
function repMiRuta(rp){if(!rp)return null;const R=(S.rutas||[]).filter(r=>r.rep===rp.id&&['en_curso','armada','cerrada'].includes(r.estado));return R.find(r=>r.estado==='en_curso')||R.find(r=>r.estado==='armada')||R.find(r=>r.estado==='cerrada')||null;}
function repActual(r){return r.envios.map(repEnv).find(e=>e&&e.estado==='en_ruta')||null;}
function repBilletera(rp){const hoy=dkey(now());const R=(S.rutas||[]).filter(r=>r.rep===rp.id&&dkey(r.ts)===hoy&&r.estado!=='anulada');const E=R.flatMap(r=>r.envios.map(repEnv).filter(Boolean));
 const act=R.find(r=>['en_curso','cerrada'].includes(r.estado));const bol=act?repCuentas(act).esperado:0;
 return{viajes:E.filter(e=>e.estado==='entregado').length,com:R.reduce((a,r)=>a+repComision(rp,r.envios.map(repEnv).filter(Boolean)),0),bol};}
function repGPS(){return new Promise(res=>{if(!navigator.geolocation)return res(null);let done=false;const t=setTimeout(()=>{if(!done){done=true;res(null);}},6000);
 try{navigator.geolocation.getCurrentPosition(p=>{if(done)return;done=true;clearTimeout(t);res({lat:Math.round(p.coords.latitude*1e6)/1e6,lng:Math.round(p.coords.longitude*1e6)/1e6,acc:Math.round(p.coords.accuracy||0)});},()=>{if(!done){done=true;clearTimeout(t);res(null);}},{enableHighAccuracy:true,timeout:5500,maximumAge:30000});}catch(e){done=true;clearTimeout(t);res(null);}});}
function repMoneyBanner(e){if(e.cobro.modo==='pagado')return `<div class="cop-money ok" role="status"><b>PAGADO</b><span>No cobrar nada</span></div>`;
 const v=repVuelto(e);return `<div class="cop-money cobrar" role="alert"><b>COBRAR ${money(e.total)}</b><span>${e.cobro.modo==='efectivo'?'En efectivo'+(v?` · abona con ${money(e.cobro.abona)} → <b>VUELTO ${money(v)}</b>`:''):'Con QR o transferencia'}</span></div>`;}
function repCopHtml(){const c=repCfg();const rp=repMine();const off=!navigator.onLine;
 const sel=(can('reparto')||can('config'))?`<div class="row sm"><label for="cop-ver">Ver como</label><select id="cop-ver"><option value="">—</option>${c.reps.map(r=>`<option value="${esc(r.id)}" ${repVer===r.id?'selected':''}>${esc(r.nombre)}</option>`).join('')}</select></div>`:'';
 const head=`<div class="cop-top"><b>🛵 ${esc(rp?rp.nombre:'Copiloto de reparto')}</b><span class="sp"></span><span class="tag ${off?'bad':'ok'}" id="cop-net">${off?'Sin señal · se guarda en el celular':'En línea'}</span></div>`;
 if(!rp)return `<div class="cop">${head}${sel}<div class="card"><p>Tu usuario todavía no está vinculado a un repartidor.</p><p class="sm mut">El administrador lo vincula en <b>Reparto → Configuración → Repartidores</b> (campo «Usuario»).</p></div></div>`;
 const B=repBilletera(rp);const bill=`<div class="cop-wallet"><div><small>Viajes hoy</small><b>${B.viajes}</b></div><div><small>Comisión del turno</small><b>${money(B.com)}</b></div><div><small>Efectivo del local en tu bolsillo</small><b>${money(B.bol)}</b></div></div>`;
 const r=repMiRuta(rp);if(!r)return `<div class="cop">${head}${sel}${bill}<div class="card cop-empty"><p><b>No tenés pedidos asignados.</b></p><p class="sm mut">Cuando el local arme tu hoja de ruta aparece acá sola.</p></div></div>`;
 if(r.estado==='armada')return `<div class="cop">${head}${sel}${bill}<div class="card"><h3>Hoja de ruta ${esc(r.n)} · ${r.envios.length} pedidos</h3><p>Esperando que el local despache${r.cambio?` y te entregue <b>${money(r.cambio)}</b> de cambio`:''}.</p><ol class="rep-ol">${repRutaTxt(r.envios)}</ol></div></div>`;
 if(r.estado==='cerrada')return `<div class="cop">${head}${sel}${bill}<div class="card"><h3>Recorrido terminado ✓</h3><p>Volvé al local para rendir en caja${r.decl!=null?` (declaraste ${money(r.decl)} en efectivo)`:''}.</p></div></div>`;
 const E=r.envios.map(repEnv).filter(Boolean);const e=repActual(r);const k=e?E.indexOf(e)+1:E.length;
 const prog=`<div class="cop-prog" aria-label="Avance">${E.map(x=>`<i class="${x.estado==='entregado'?'ok':['ausente','devuelto'].includes(x.estado)?'bad':x===e?'cur':''}"></i>`).join('')}</div>`;
 if(!e)return `<div class="cop">${head}${sel}${bill}${prog}<div class="card"><h3>¡Terminaste las paradas de ${esc(r.n)}!</h3><p class="sm">Contá el efectivo del local que tenés (cambio + cobros) y declaralo. No vas a ver cuánto se espera: así se controla en caja.</p><label for="cop-decl">Efectivo que llevás ($)</label>${numIn('cop-decl',0,'0')}<button class="btn gold cop-big" data-act="repTerminar" data-id="${esc(r.id)}">Terminar recorrido</button></div></div>`;
 const aus=e.aus&&e.aus.ini?Math.max(0,c.ausenteMin*60000-(now()-e.aus.ini)):null;
 const nav=c.con.nav==='waze'?'waze':'gmaps';
 return `<div class="cop">${head}${sel}${bill}${prog}
 <div class="cop-stop"><div class="row"><span class="tag">Parada ${k} de ${E.length}</span><span class="tag">#${e.n}</span>${e.vh?`<span class="tag">⏰ ${esc((e.vd?e.vd+'–':'hasta ')+e.vh)}</span>`:''}</div>
 <h2>${esc(e.cli.nombre)}</h2><p class="cop-dir">${esc(repDirTxt(e)||'Ver ubicación')}${e.cli.ref?`<br><small>${esc(e.cli.ref)}</small>`:''}</p>${e.nota?`<p class="sm">📝 ${esc(e.nota)}</p>`:''}
 ${repMoneyBanner(e)}
 <div class="cop-btns"><a class="cop-b nav" target="_blank" rel="noopener" href="${esc(repNavUrl(e,nav))}">🧭<span>Navegar</span></a><button class="cop-b con" data-act="repContactar" data-id="${esc(e.id)}">📞<span>Contactar</span></button><button class="cop-b ok" data-act="repEntregar" data-id="${esc(e.id)}">✅<span>Entregado</span></button></div>
 <div class="row"><a class="btn sm" target="_blank" rel="noopener" href="${esc(repNavUrl(e,nav==='waze'?'gmaps':'waze'))}">Abrir en ${nav==='waze'?'Google Maps':'Waze'}</a><span class="sp"></span><button class="btn sm red" data-act="repIncid" data-id="${esc(e.id)}">⚠️ Incidencia</button></div>
 ${aus!=null?`<div class="cop-aus" id="cop-aus" data-fin="${e.aus.ini+c.ausenteMin*60000}"><b>Cliente ausente:</b> esperá <span id="cop-aus-t">${Math.ceil(aus/1000)}</span> s más, llamá y escribile. ${aus<=0?`<button class="btn sm red" data-act="repAusente" data-id="${esc(e.id)}">Registrar ausente</button>`:''}</div>`:''}
 <details class="cop-items"><summary>${e.items.filter(i=>i.pid!=='p_envio').length} artículos</summary><ul>${e.items.filter(i=>i.pid!=='p_envio').map(i=>`<li>${esc(String(i.qty).replace('.',','))} × ${esc(i.name)}</li>`).join('')}</ul></details></div>
 ${E.filter(x=>x.estado==='en_ruta'&&x!==e).length?`<details class="cop-next"><summary>Siguientes paradas</summary>${E.filter(x=>x.estado==='en_ruta'&&x!==e).map(x=>`<div class="row sm"><span class="sp">#${x.n} · ${esc(x.cli.nombre)} · ${esc(repDirTxt(x))}</span><button class="btn sm ghost" data-act="repSaltar" data-id="${esc(x.id)}">Ir primero</button></div>`).join('')}</details>`:''}</div>`;}
reg('copiloto','Mi hoja de ruta','route','reparto_drive',()=>repCopHtml(),()=>{repCopTick();});
function repCopTick(){clearInterval(repCopTick.t);repCopTick.t=setInterval(()=>{if(curScreen!=='copiloto'){clearInterval(repCopTick.t);return;}const n=$('#cop-net');if(n){const off=!navigator.onLine;n.className='tag '+(off?'bad':'ok');n.textContent=off?'Sin señal · se guarda en el celular':'En línea';}
 const a=$('#cop-aus');if(a){const s=Math.ceil((+a.dataset.fin-now())/1000);const t=$('#cop-aus-t');if(s<=0&&!a.querySelector('[data-act=repAusente]'))rerender();else if(t)t.textContent=Math.max(0,s);}},1000);}
window.addEventListener('online',()=>{if(curScreen==='copiloto')rerender();});window.addEventListener('offline',()=>{if(curScreen==='copiloto')rerender();});
document.addEventListener('change',ev=>{if(ev.target.id==='cop-ver'){repVer=ev.target.value;rerender();}});
A.repSaltar=el=>{const e=repEnv(el.dataset.id);const r=e&&repRuta(e.rutaId);if(!r)return;r.envios=[e.id].concat(r.envios.filter(x=>x!==e.id));repHist(e,'adelantada por el repartidor');save();rerender();};
A.repContactar=el=>{const e=repEnv(el.dataset.id);if(!e)return;const nm=String(e.cli.nombre||'').split(' ')[0];
 const L=[['📞 Llamar',repTelUrl(e.cli.tel)],['💬 «Estoy llegando»',repWaUrl(e.cli.tel,'¡Hola '+nm+'! Soy el repartidor de '+S.tenant.name+'. Estoy llegando con tu pedido #'+e.n+'.')],['💬 «Estoy en la puerta»',repWaUrl(e.cli.tel,'¡Hola '+nm+'! Estoy en la puerta con tu pedido #'+e.n+' de '+S.tenant.name+'.')],['💬 «No encuentro la dirección»',repWaUrl(e.cli.tel,'Hola '+nm+', no encuentro la dirección '+repDirTxt(e)+'. ¿Me compartís tu ubicación por WhatsApp?')]].filter(x=>x[1]);
 modal('Contactar a '+e.cli.nombre,`<div class="cop-list">${L.map(x=>`<a class="btn cop-big" ${x[1].startsWith('tel:')?'':'target="_blank" rel="noopener"'} href="${esc(x[1])}">${esc(x[0])}</a>`).join('')||'<p>No hay teléfono cargado.</p>'}</div>`,{okText:'Cerrar',noCancel:true});};
A.repEntregar=el=>{const e=repEnv(el.dataset.id);if(!e||e.estado!=='en_ruta')return;const c=repCfg();let fails=0,foto='';
 const cob=e.cobro.modo!=='pagado';const qrImg=c.cobro.qrImg&&/^data:image\/(png|jpe?g|webp);base64,/.test(c.cobro.qrImg)?c.cobro.qrImg:'';
 const w=modal('Entrega #'+e.n,`${repMoneyBanner(e)}
 ${c.pin?`<label for="ce-pin">Código de entrega (PIN) que te dice el cliente</label><input id="ce-pin" inputmode="numeric" maxlength="4" autocomplete="off" class="cop-pin">
 <label class="chk"><input type="checkbox" id="ce-nopin"> El cliente no tiene el código (se pide foto de respaldo)</label>`:''}
 <div id="ce-foto" ${c.pin&&!c.foto?'hidden':''}><label for="ce-f">Foto de respaldo ${c.foto?'(obligatoria)':''}</label><input id="ce-f" type="file" accept="image/*" capture="environment"></div>
 ${cob?`<fieldset class="rep-cb"><legend>¿Cómo pagó?</legend><label class="chk"><input type="radio" name="ce-m" value="efectivo" ${e.cobro.modo==='efectivo'?'checked':''}> Efectivo</label><label class="chk"><input type="radio" name="ce-m" value="digital" ${e.cobro.modo==='digital'?'checked':''}> QR / transferencia</label></fieldset>
 <div id="ce-ef" ${e.cobro.modo==='efectivo'?'':'hidden'}><label for="ce-rec">Recibí ($)</label>${numIn('ce-rec',e.cobro.abona||e.total,'0')}<div id="ce-vu" class="vuelto" aria-live="assertive"></div></div>
 <div id="ce-dg" ${e.cobro.modo==='digital'?'':'hidden'}>${c.con.cobro==='mp'?`<button type="button" class="btn" data-act="repMpQr" data-id="${esc(e.id)}">Generar QR de Mercado Pago por ${money(e.total)}</button><div id="ce-mp" class="cop-qr"></div>`:''}${qrImg?`<div class="cop-qr"><img src="${qrImg}" alt="QR del local para pagar"></div>`:''}${c.cobro.alias?`<p>Alias: <b>${esc(c.cobro.alias)}</b>${c.cobro.titular?' · '+esc(c.cobro.titular):''}</p>`:''}<label for="ce-ref">Comprobante (últimos números o nombre de quien pagó)</label><input id="ce-ref" maxlength="40" autocomplete="off"></div>`:''}`,
  {okText:'Confirmar entrega',onOk:async()=>{const g=id=>w.querySelector('#'+id);
   let pinOk=!c.pin;if(c.pin){const p=(g('ce-pin').value||'').trim();const no=g('ce-nopin').checked;if(p&&p===e.pin)pinOk=true;else if(p&&!no){fails++;e.pinFail=(e.pinFail||0)+1;if(fails>=3){g('ce-nopin').checked=true;g('ce-foto').hidden=false;}toast('El código no coincide'+(fails>=3?': seguí con foto de respaldo.':'.'),1);return false;}else if(!no){toast('Pedile el código de 4 números al cliente.',1);return false;}}
   const f=g('ce-f')&&g('ce-f').files&&g('ce-f').files[0];if((!pinOk||c.foto)&&!f&&!foto){toast('Sacá la foto de respaldo de la entrega.',1);g('ce-foto').hidden=false;return false;}
   if(f&&!foto)foto=await repFotoChica(f).catch(()=>'');
   let cobrado=null;if(cob){const m=(w.querySelector('input[name=ce-m]:checked')||{}).value||e.cobro.modo;
    if(m==='efectivo'){const rc=cents(g('ce-rec').value||'0');if(isNaN(rc)||rc<e.total){toast('Lo recibido tiene que ser al menos '+money(e.total)+'.',1);return false;}cobrado={modo:'efectivo',monto:e.total,recibido:rc,vuelto:rc-e.total};}
    else{const ref=(g('ce-ref').value||'').trim();if(ref.length<2&&!w.dataset.mpok){toast('Anotá el comprobante del QR o la transferencia.',1);return false;}cobrado={modo:'digital',monto:e.total,ref:(w.dataset.mpok||ref).slice(0,40),mp:!!w.dataset.mpok};}}
   e.ent={ts:now(),by:user?user.name:'',lat:null,lng:null,pin:pinOk,foto:!!foto,cobrado};if(foto)e.fotoData=foto;repGPS().then(g=>{if(g&&e.ent){e.ent.lat=g.lat;e.ent.lng=g.lng;e.ent.acc=g.acc;save();}}); /* la ubicación se suma cuando llega: no frena la entrega */
   repSetEst(e,'entregado',{nota:cobrado?(cobrado.modo==='efectivo'?'cobró efectivo '+money(cobrado.monto):'cobró QR/transferencia'):'pagado'});save();setTimeout(rerender,30);toast('✅ #'+e.n+' entregado');}});
 const upd=()=>{const g=id=>w.querySelector('#'+id);const m=(w.querySelector('input[name=ce-m]:checked')||{}).value;if(g('ce-ef'))g('ce-ef').hidden=m!=='efectivo';if(g('ce-dg'))g('ce-dg').hidden=m!=='digital';
  if(g('ce-vu')){const rc=cents(g('ce-rec').value||'0');g('ce-vu').innerHTML=!isNaN(rc)&&rc>e.total?`<span>VUELTO A ENTREGAR</span><b>${money(rc-e.total)}</b>`:'';}
  if(g('ce-nopin')&&g('ce-foto'))g('ce-foto').hidden=!(g('ce-nopin').checked||c.foto);};
 w.addEventListener('input',upd);w.addEventListener('change',upd);upd();w._e=e;};
function repFotoChica(file){return new Promise((res,rej)=>{if(file.size>15e6)return rej();const u=URL.createObjectURL(file);const im=new Image();im.onload=()=>{const k=Math.min(1,640/Math.max(im.width,im.height));const cv=document.createElement('canvas');cv.width=Math.round(im.width*k);cv.height=Math.round(im.height*k);cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);URL.revokeObjectURL(u);res(cv.toDataURL('image/jpeg',.6));};im.onerror=()=>{URL.revokeObjectURL(u);rej();};im.src=u;});}
A.repMpQr=async el=>{const e=repEnv(el.dataset.id);const w=el.closest('.ov');if(!e||!w)return;el.disabled=true;const box=w.querySelector('#ce-mp');box.textContent='Generando…';
 try{const r=await repPro('mp_qr',{ref:e.id,monto:e.total,desc:S.tenant.name+' · pedido #'+e.n});if(!r||!r.url)throw new Error((r&&r.msg)||'sin respuesta');
  box.innerHTML=QR.svg(r.url,5,2)+'<p class="sm">El cliente lo escanea con la app de Mercado Pago o la cámara. Se confirma solo.</p>';
  let n=0;const t=setInterval(async()=>{if(!document.body.contains(box)||n++>90){clearInterval(t);return;}try{const s=await repPro('mp_estado',{ref:e.id});if(s&&s.estado==='approved'){clearInterval(t);w.dataset.mpok='MP '+(s.id||'');box.innerHTML='<div class="okbox">✓ Pago aprobado en Mercado Pago</div>';}}catch(x){}},4000);}
 catch(x){box.textContent='No se pudo generar el QR: '+String(x.message||x).slice(0,100)+'. Usá el QR fijo o el alias.';el.disabled=false;}};
A.repIncid=el=>{const e=repEnv(el.dataset.id);if(!e)return;
 modal('Incidencia #'+e.n,`<div class="cop-list"><button class="btn cop-big" data-act="repAusIni" data-id="${esc(e.id)}">🚪 Cliente ausente (esperar ${repCfg().ausenteMin} min)</button>
 ${['Dirección incorrecta o inexistente','Rechazó el pedido','Pedido dañado','Zona insegura / no se puede llegar'].map(t=>`<button class="btn cop-big" data-act="repIncOk" data-id="${esc(e.id)}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}
 <label for="ci-nt">Otra / detalle</label><input id="ci-nt" maxlength="120"><button class="btn" data-act="repIncOk" data-id="${esc(e.id)}" data-t="Otra">Registrar</button></div>`,{okText:'Cerrar',noCancel:true});};
A.repAusIni=async el=>{const e=repEnv(el.dataset.id);if(!e)return;$$('#modal-root .ov').forEach(o=>o.remove());if(!e.aus||!e.aus.ini){const a=e.aus={ini:now(),lat:null,lng:null};repHist(e,'esperando cliente',{nota:'llegada registrada'});save();repGPS().then(g=>{if(g){a.lat=g.lat;a.lng=g.lng;a.acc=g.acc;save();}});}rerender();};
A.repAusente=async el=>{const e=repEnv(el.dataset.id);if(!e||!e.aus)return;if(now()-e.aus.ini<repCfg().ausenteMin*60000)return toast('Todavía no pasaron los '+repCfg().ausenteMin+' minutos de espera.',1);
 (e.inc=e.inc||[]).push({ts:now(),t:'ausente',lat:e.aus.lat,lng:e.aus.lng,espera:Math.round((now()-e.aus.ini)/60000)});repSetEst(e,'ausente',{nota:'esperó '+Math.round((now()-e.aus.ini)/60000)+' min'});save();rerender();toast('Registrado como ausente: el pedido vuelve al local.');};
A.repIncOk=async el=>{const e=repEnv(el.dataset.id);if(!e)return;const t=el.dataset.t==='Otra'?(val('ci-nt').trim()||'Otra'):el.dataset.t;$$('#modal-root .ov').forEach(o=>o.remove());
 const inc={ts:now(),t:t.slice(0,120),lat:null,lng:null};(e.inc=e.inc||[]).push(inc);repGPS().then(g=>{if(g){inc.lat=g.lat;inc.lng=g.lng;save();}});repSetEst(e,'ausente',{nota:t.slice(0,120)});save();rerender();toast('Incidencia registrada: el pedido vuelve al local.');};
A.repTerminar=el=>{const r=repRuta(el.dataset.id);if(!r||r.estado!=='en_curso')return;const d=cents(val('cop-decl')||'');if(isNaN(d)||d<0)return toast('Escribí cuánto efectivo del local llevás (0 si nada).',1);
 if(r.envios.map(repEnv).some(e=>e&&e.estado==='en_ruta'))return toast('Todavía hay paradas sin resolver.',1);
 r.decl=d;r.declTs=now();r.fin=now();r.estado='cerrada';audit('REPARTO_FIN',r.n+' · '+r.repNom+' · declaró '+money(d));save();rerender();toast('Recorrido terminado. Volvé al local para rendir.');};
/* ---------- CONFIGURACIÓN ---------- */
function repZonaRow(z){return `<tr class="rz-row" data-id="${esc(z.id)}"><td><input class="rz-n" maxlength="40" value="${esc(z.nombre||'')}" aria-label="Nombre de la zona"></td><td>${numIn('',z.tarifa||0,'0','class="rz-t" aria-label="Costo de envío"')}</td><td>${numIn('',z.minimo||0,'0','class="rz-m" aria-label="Compra mínima"')}</td><td><input class="rz-e" maxlength="30" value="${esc(z.eta||'')}" placeholder="30-45 min" aria-label="Demora"></td><td><input class="rz-r" inputmode="decimal" value="${z.radio?esc(String(z.radio).replace('.',',')):''}" placeholder="km" aria-label="Radio en km"></td><td><input type="checkbox" class="rz-a" ${z.activo!==false?'checked':''} aria-label="Activa"></td><td><button type="button" class="btn sm red" data-act="repDelRow" aria-label="Quitar">✕</button></td></tr>`;}
function repRepRow(r){const users=(S.users||[]).filter(u=>u.role==='repartidor'||u.name===r.login);
 return `<tr class="rr-row" data-id="${esc(r.id)}"><td><input class="rr-n" maxlength="40" value="${esc(r.nombre||'')}" aria-label="Nombre"></td><td><input class="rr-t" maxlength="24" inputmode="tel" value="${esc(r.tel||'')}" aria-label="Teléfono"></td><td><input class="rr-v" maxlength="24" value="${esc(r.veh||'')}" placeholder="Moto / bici / auto" aria-label="Vehículo"></td><td><input class="rr-c" inputmode="numeric" value="${esc(String(r.cap||''))}" placeholder="${repCfg().cap}" aria-label="Capacidad"></td><td>${numIn('',r.fijo||0,'0','class="rr-f" aria-label="Comisión fija por entrega"')}</td><td><input class="rr-p" inputmode="decimal" value="${r.pct?esc(String(r.pct).replace('.',',')):''}" placeholder="%" aria-label="Porcentaje del envío"></td>
 <td><input class="rr-l" maxlength="60" list="rr-users" value="${esc(r.login||'')}" placeholder="usuario con el que entra" aria-label="Usuario"></td><td><input type="checkbox" class="rr-a" ${r.activo!==false?'checked':''} aria-label="Activo"></td><td><button type="button" class="btn sm red" data-act="repDelRow" aria-label="Quitar">✕</button></td></tr>`;}
function repCfgHtml(){const c=repCfg();const o=c.origen;const rubs=S.rubros.filter(r=>!['msec','shared','cobr'].includes(r.kind));
 const users=[...new Set((S.users||[]).filter(u=>u.role==='repartidor').map(u=>u.name))];
 return `<div class="card"><h3>Reparto</h3><label class="chk"><input type="checkbox" id="rc-on" ${c.on?'checked':''}> <b>Activar reparto a domicilio</b> (botón «Envío a domicilio» en Vender, bandeja de despacho y copiloto)</label>
 <label class="chk"><input type="checkbox" id="rc-menu" ${c.menu?'checked':''}> Recibir pedidos con envío desde el <b>menú digital</b> (canal digital: entran solos a la bandeja; se publica con «Publicar» del menú)</label>
 <h4>Local (punto de salida)</h4><div class="grid g2"><div><label for="rc-od">Dirección</label><input id="rc-od" maxlength="120" value="${esc(o.dir||'')}"></div><div><label for="rc-ol">Ubicación del local (enlace de Google Maps o lat,lng)</label><div class="row"><input id="rc-ol" class="sp" value="${o.lat!=null?esc(o.lat+','+o.lng):''}"><button type="button" class="btn sm" data-act="repAqui">📍 Estoy en el local</button></div></div></div>
 <h4>Zonas y tarifas</h4><p class="sm mut">Con la ubicación del local y un radio, la zona y el costo se eligen solos al pegar la ubicación del cliente. Sin radio, se elige a mano.</p>
 <div class="tw"><table data-nosort><thead><tr><th>Zona</th><th>Costo $</th><th>Mínimo $</th><th>Demora</th><th>Radio km</th><th>Activa</th><th></th></tr></thead><tbody id="rz-b">${c.zonas.map(repZonaRow).join('')}</tbody></table></div><button type="button" class="btn sm" data-act="repAddZona">+ Zona</button>
 <h4>Repartidores</h4><p class="sm mut">«Usuario» es el nombre (o el correo, en la nube) con el que el repartidor entra al sistema: así ve su hoja de ruta. Rol sugerido: <b>repartidor</b>.</p><datalist id="rr-users">${users.map(u=>`<option value="${esc(u)}">`).join('')}</datalist>
 <div class="tw"><table data-nosort><thead><tr><th>Nombre</th><th>Teléfono</th><th>Vehículo</th><th>Capacidad</th><th>Comisión fija $</th><th>% del envío</th><th>Usuario</th><th>Activo</th><th></th></tr></thead><tbody id="rr-b">${c.reps.map(repRepRow).join('')}</tbody></table></div><button type="button" class="btn sm" data-act="repAddRep">+ Repartidor</button>
 <h4>Operación</h4><div class="grid g3"><div><label for="rc-cap">Pedidos por ruta (capacidad por defecto)</label><input id="rc-cap" inputmode="numeric" value="${c.cap}"></div><div><label for="rc-aus">Espera por cliente ausente (min)</label><input id="rc-aus" inputmode="numeric" value="${c.ausenteMin}"></div>
 <div><label for="rc-nav">Navegación del repartidor</label><select id="rc-nav"><option value="gmaps">Google Maps</option><option value="waze" ${c.con.nav==='waze'?'selected':''}>Waze</option></select></div></div>
 <label class="chk"><input type="checkbox" id="rc-pin" ${c.pin?'checked':''}> Pedir el código de entrega (PIN de 4 números) al entregar</label><label class="chk"><input type="checkbox" id="rc-foto" ${c.foto?'checked':''}> Foto de respaldo obligatoria en cada entrega</label><label class="chk"><input type="checkbox" id="rc-apaga" ${c.ausentePaga?'checked':''}> Pagar comisión también por clientes ausentes</label>
 <div class="grid g2"><div><label for="rc-rub">Rubro de caja para cambio, comisiones y diferencias</label><select id="rc-rub"><option value="">Automático</option>${rubs.map(r=>`<option value="${esc(r.id)}" ${c.rubro===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></div><div><label for="rc-pk">Picking: palabras que se resaltan para no olvidar</label><input id="rc-pk" maxlength="300" value="${esc(c.pick)}"></div></div>
 <label for="rc-msg">Mensaje de salida (WhatsApp)</label><textarea id="rc-msg" rows="2" maxlength="600">${esc(c.msgSalida)}</textarea><p class="sm mut">Variables: {nombre} {n} {comercio} {eta} {cobro} {pin}</p>
 <h4>Cobro en la puerta (gratis)</h4><div class="grid g2"><div><label for="rc-al">Alias / CVU para transferir</label><input id="rc-al" maxlength="40" value="${esc(c.cobro.alias)}"></div><div><label for="rc-ti">Titular</label><input id="rc-ti" maxlength="60" value="${esc(c.cobro.titular)}"></div></div>
 <label for="rc-qr">QR fijo del local (imagen de tu QR de Mercado Pago, MODO o el banco)</label><div class="row"><input id="rc-qr" type="file" accept="image/png,image/jpeg,image/webp">${c.cobro.qrImg?'<img src="'+c.cobro.qrImg+'" alt="QR cargado" style="width:64px;height:64px;object-fit:contain;background:#fff;border-radius:6px"><button type="button" class="btn sm ghost" data-act="repQrDel">Quitar</button>':''}</div>
 <div class="row" style="margin-top:.8rem"><button class="btn gold" data-act="repCfgSave">Guardar configuración de reparto</button></div></div>${repConHtml()}`;}
A.repAddZona=()=>{const b=$('#rz-b');if(b)b.insertAdjacentHTML('beforeend',repZonaRow({id:uid(),nombre:'',tarifa:0,activo:true}));};
A.repAddRep=()=>{const b=$('#rr-b');if(b)b.insertAdjacentHTML('beforeend',repRepRow({id:uid(),nombre:'',activo:true}));};
A.repDelRow=el=>{const r=el.closest('tr');if(r)r.remove();};
A.repAqui=async()=>{const g=await repGPS();if(!g)return toast('No se pudo leer la ubicación de este equipo (permití la ubicación o pegá el enlace).',1);$('#rc-ol').value=g.lat+','+g.lng;toast('Ubicación tomada (±'+g.acc+' m)');};
A.repQrDel=()=>{repCfg().cobro.qrImg='';save();rerender();};
A.repCfgSave=async()=>{if(!can('config'))return toast('Sólo el administrador',1);const c=repCfg();const num=(v,d)=>{const n=parseNum(v);return isNaN(n)?d:n;};
 const ol=$('#rc-ol').value.trim();const ll=ol?repParseLL(ol):null;if(ol&&!ll)return toast('No reconozco la ubicación del local.',1);
 const zonas=[];for(const tr of $$('#rz-b .rz-row')){const n=tr.querySelector('.rz-n').value.trim();if(!n)continue;const t=cents(tr.querySelector('.rz-t').value||'0'),m=cents(tr.querySelector('.rz-m').value||'0');const rd=tr.querySelector('.rz-r').value.trim();const r=rd?parseNum(rd):0;
  if(isNaN(t)||t<0||isNaN(m)||m<0||isNaN(r)||r<0||r>200)return toast('Revisá los importes o el radio de la zona «'+n+'».',1);zonas.push({id:tr.dataset.id,nombre:n.slice(0,40),tarifa:t,minimo:m,eta:tr.querySelector('.rz-e').value.trim().slice(0,30),radio:r||0,activo:tr.querySelector('.rz-a').checked});}
 const reps=[];for(const tr of $$('#rr-b .rr-row')){const n=tr.querySelector('.rr-n').value.trim();if(!n)continue;const f=cents(tr.querySelector('.rr-f').value||'0');const p=num(tr.querySelector('.rr-p').value||'0',NaN);const cp=parseInt(tr.querySelector('.rr-c').value||'0',10)||0;
  if(isNaN(f)||f<0||isNaN(p)||p<0||p>100)return toast('Revisá la comisión de «'+n+'».',1);reps.push({id:tr.dataset.id,nombre:n.slice(0,40),tel:tr.querySelector('.rr-t').value.trim().slice(0,24),veh:tr.querySelector('.rr-v').value.trim().slice(0,24),cap:Math.min(30,Math.max(0,cp)),fijo:f,pct:p,login:tr.querySelector('.rr-l').value.trim().slice(0,60),activo:tr.querySelector('.rr-a').checked});}
 const qf=$('#rc-qr').files&&$('#rc-qr').files[0];if(qf){if(qf.size>400000)return toast('La imagen del QR es muy pesada (máx. 400 KB).',1);c.cobro.qrImg=await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result||''));fr.onerror=()=>res('');fr.readAsDataURL(qf);});}
 const was=c.on;Object.assign(c,{on:$('#rc-on').checked,menu:$('#rc-menu').checked,origen:{dir:$('#rc-od').value.trim().slice(0,120),lat:ll?ll.lat:null,lng:ll?ll.lng:null},zonas,reps,
  cap:Math.min(30,Math.max(1,parseInt($('#rc-cap').value,10)||8)),ausenteMin:Math.min(30,Math.max(1,parseInt($('#rc-aus').value,10)||5)),pin:$('#rc-pin').checked,foto:$('#rc-foto').checked,ausentePaga:$('#rc-apaga').checked,rubro:$('#rc-rub').value,pick:$('#rc-pk').value.slice(0,300),msgSalida:$('#rc-msg').value.slice(0,600)});
 c.cobro.alias=$('#rc-al').value.trim().slice(0,40);c.cobro.titular=$('#rc-ti').value.trim().slice(0,60);c.con.nav=$('#rc-nav').value==='waze'?'waze':'gmaps';
 Object.keys(REP_CON).forEach(k=>{const v=(document.querySelector('input[name=rc-'+k+']:checked')||{}).value;if(v==='free')c.con[k]='free';else if(v&&c.con[k]!==v&&!(c.con.test[k]&&c.con.test[k].ok))toast(REP_CON[k].t+': tocá «Probar y activar» para usar el modo Pro.',1);});
 if(c.on)repProd();audit('REPARTO_CONFIG',(c.on?'activo':'apagado')+' · menú '+(c.menu?'sí':'no')+' · '+zonas.length+' zonas · '+reps.length+' repartidores');save();rerender();
 toast('Reparto guardado'+(c.menu?'. Para que el menú ofrezca el envío, tocá «Publicar» en Menú público.':''));if(!was&&c.on&&curScreen!=='reparto')setTimeout(()=>go('reparto'),300);};
/* ---------- PANTALLA PRINCIPAL ---------- */
reg('reparto','Reparto y despacho','moto','reparto',()=>{const c=repCfg();const adm=can('config');
 if(!c.on&&repTab!=='config')repTab=adm?'config':'bandeja';
 const n=st=>(S.envios||[]).filter(e=>st.includes(e.estado)).length;const cer=(S.rutas||[]).filter(r=>r.estado==='cerrada').length;
 const tabs=[['bandeja','Bandeja ('+n(['nuevo','preparando','listo'])+')'],['rutas','Hojas de ruta'+(cer?' · '+cer+' a rendir':'')],['rend','Rendiciones']].concat(adm?[['config','Configuración']]:[]);
 return `<div class="row"><h1 class="sp">Reparto y despacho</h1>${c.on?'<a class="btn sm" href="#panel/vender">+ Nuevo envío (desde Vender)</a><a class="btn sm" href="#panel/copiloto">Copiloto</a>':''}</div>
 ${c.on?'':`<div class="warnbox">El reparto está apagado. ${adm?'Activalo en Configuración.':'Pedile al administrador que lo active.'}</div>`}
 <div class="rep-tabs" role="tablist">${tabs.map(([k,t])=>`<button role="tab" aria-selected="${repTab===k}" class="btn sm ${repTab===k?'gold':''}" data-act="repTabGo" data-k="${k}">${esc(t)}</button>`).join('')}</div>
 <div style="margin-top:.8rem">${repTab==='rutas'?repRutasHtml():repTab==='rend'?repRendHtml():repTab==='config'&&adm?repCfgHtml():repBandeja()}</div>`;},()=>{});
A.repTabGo=el=>{repTab=el.dataset.k;rerender();};
/* el repartidor entra directo a su hoja de ruta */
const _repHome=homeScreen;homeScreen=function(){if(user&&can('reparto_drive')&&!can('sell')&&SCREENS.copiloto)return 'copiloto';return _repHome();};
/* demo: zonas, local y repartidores de ejemplo (sólo en las demos, una vez) */
function repDemoSeed(st){if(!st.cfg||st.cfg.rep)return;st.cfg.rep={on:true,menu:true,origen:{dir:'Urquiza 1052, Salta',lat:-24.7889,lng:-65.4117},
 zonas:[{id:'zc',nombre:'Centro',tarifa:150000,minimo:0,eta:'20-30 min',radio:2,activo:true},{id:'zn',nombre:'Barrios cercanos',tarifa:250000,minimo:500000,eta:'30-45 min',radio:5,activo:true},{id:'zl',nombre:'Zona extendida',tarifa:400000,minimo:1000000,eta:'45-60 min',radio:10,activo:true}],
 reps:[{id:'rp1',nombre:'Repartidor',tel:'3874000001',veh:'Moto',cap:8,fijo:80000,pct:0,login:'Repartidor',activo:true},{id:'rp2',nombre:'Lucas',tel:'3874000002',veh:'Bici',cap:5,fijo:60000,pct:10,login:'',activo:true}],
 cap:8,ausenteMin:5,pin:true,foto:false,cobro:{alias:'rave.almacen.mp',titular:'Almacén RAVE (demo)',qrImg:''},con:{mapas:'free',cobro:'free',wa:'free',nav:'gmaps',test:{}},ausentePaga:false,rubro:''};
 st.envios=st.envios||[];st.rutas=st.rutas||[];st.rendRep=st.rendRep||[];}
