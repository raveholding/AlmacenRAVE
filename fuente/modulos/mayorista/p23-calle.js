/* ===== V27.15 · Preventa y logística en la calle (Sprint 1 a 5 de la especificación corregida) =====
   Pensado para el celular, con una mano y sin señal. Usa los motores de siempre (precios, pedidos, reparto, caja, cuenta corriente):
   no duplica cálculos. Todo depende de los módulos «presale» / «orders» / reparto ya activos. */

/* ---------- utilidades comunes ---------- */
const pvxCfg=()=>Object.assign({radio:100,fotoCambio:true},((S.cfg&&S.cfg.presale)||{}).calle||{});
function pvxCss(){if(document.getElementById('pvx-css'))return;const s=document.createElement('style');s.id='pvx-css';s.textContent=`
.pvx-bar{position:fixed;left:0;right:0;z-index:24;background:var(--card);border-top:1px solid var(--line);padding:.55rem .8rem;display:flex;gap:.6rem;align-items:center;box-shadow:0 -6px 18px #0002}
.pvx-bar .tot{flex:1;line-height:1.1}.pvx-bar .tot small{display:block;color:var(--mut);font-size:.75rem}.pvx-bar .tot b{font-size:1.35rem}
.pvx-bar .btn{min-height:52px;font-size:1rem;padding:0 1.1rem}
.pvx-sp{height:96px}
.pvx-head{display:flex;gap:.6rem;align-items:center;margin-bottom:.5rem}.pvx-head h2{margin:0;font-size:1.15rem;flex:1;line-height:1.2}
.pvx-dot{width:14px;height:14px;border-radius:50%;flex:0 0 14px;display:inline-block;box-shadow:0 0 0 2px var(--card)}
.pvx-dot.v{background:#1e8e3e}.pvx-dot.a{background:#f2a900}.pvx-dot.r{background:#d93025}
.pvx-search{position:sticky;top:0;z-index:4;background:var(--bg);padding:.4rem 0}
.pvx-search input{font-size:1.05rem;min-height:50px}
.pvx-p{display:flex;flex-wrap:wrap;gap:.45rem .6rem;align-items:center;padding:.6rem .1rem;border-bottom:1px solid var(--line)}
.pvx-p .nm{flex:1 1 55%;min-width:0}.pvx-p .nm b{display:block;font-size:.98rem;line-height:1.2}.pvx-p .nm small{color:var(--mut)}
.pvx-p .q{display:flex;gap:.3rem;align-items:center;flex-wrap:nowrap;justify-content:flex-end;margin-left:auto}
.pvx-p .q .btn{min-width:46px;min-height:46px;font-size:1.05rem;padding:0 .55rem}
.pvx-p .q .n{min-width:2.2rem;text-align:center;font-weight:700;font-size:1.05rem}
.pvx-big{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin:.6rem 0}
.pvx-big .btn{min-height:78px;font-size:1.02rem;flex-direction:column;display:flex;align-items:center;justify-content:center;gap:.2rem;white-space:normal;text-align:center}
.pvx-big .btn i{font-style:normal;font-size:1.5rem}
.pvx-chips{display:flex;flex-wrap:wrap;gap:.4rem}.pvx-chips .btn{min-height:48px}
.pvx-sug{border:1px dashed var(--gold);border-radius:12px;padding:.6rem .7rem;margin:.6rem 0}
.pvx-ok{text-align:center;padding:1.2rem .5rem}.pvx-ok b.big{display:block;font-size:1.6rem;margin:.3rem 0}
.pvx-cam{position:fixed;inset:0;z-index:60;background:#000;display:flex;flex-direction:column}
.pvx-cam video{flex:1;width:100%;object-fit:cover;background:#000}
.pvx-cam .wm{position:absolute;left:.6rem;bottom:6.4rem;color:#fff;font:600 13px/1.35 system-ui;text-shadow:0 0 4px #000;white-space:pre}
.pvx-cam .bar{display:flex;gap:1rem;justify-content:space-around;align-items:center;padding:1rem;background:#000}
.pvx-cam .shot{width:74px;height:74px;border-radius:50%;border:5px solid #fff;background:#fff3}
.pvx-cam .bar .btn{min-height:48px}
.pvx-sig{width:100%;height:170px;background:#fff;border:1px solid var(--line);border-radius:10px;touch-action:none;display:block}
.pvx-thumb{width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid var(--line)}
.pvx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.6rem}
.pvx-cap{height:12px;border-radius:6px;background:var(--line);overflow:hidden}.pvx-cap i{display:block;height:100%}
@media (min-width:900px){.pvx-bar{left:auto;right:1.2rem;bottom:1.2rem!important;border-radius:14px;border:1px solid var(--line);min-width:420px}}`;document.head.appendChild(s);}
function pvxBarPos(){const b=document.querySelector('.pvx-bar');if(!b)return;const tb=document.getElementById('vb-tab');const h=tb&&!tb.hidden&&getComputedStyle(tb).display!=='none'?tb.offsetHeight:0;b.style.bottom=h+'px';}
window.addEventListener('resize',()=>pvxBarPos());
/* batería (sólo Chrome/Android la informa; en iPhone queda vacía) */
let pvxBat=null;try{if(navigator.getBattery)navigator.getBattery().then(b=>{const f=()=>{pvxBat=Math.round(b.level*100);};f();b.addEventListener('levelchange',f);}).catch(()=>{});}catch(e){}
/* posición precisa para un evento (no frena: si no llega en 6 s sigue sin GPS) */
function pvxGPS(){return new Promise(res=>{if(!navigator.geolocation)return res(null);let done=false;const t=setTimeout(()=>{if(!done){done=true;res(null);}},6000);
 try{navigator.geolocation.getCurrentPosition(p=>{if(done)return;done=true;clearTimeout(t);res({lat:Math.round(p.coords.latitude*1e6)/1e6,lng:Math.round(p.coords.longitude*1e6)/1e6,acc:Math.round(p.coords.accuracy||0)});},
  ()=>{if(!done){done=true;clearTimeout(t);res(null);}},{enableHighAccuracy:true,maximumAge:30000,timeout:5500});}catch(e){done=true;clearTimeout(t);res(null);}});}
/* auditoría de campo: cada evento con usuario, hora, GPS, precisión y batería (sólo alta) */
const PVX_EV=['checkin','pedido','precio','cambio','no_compra','rechazo','entrega','cobro','cierre_ruta'];
function pvxEvent(ev,ref,pos,datos){if(!PVX_EV.includes(ev))return null;const x={id:uid(),ev,ref:String(ref||''),ts:now(),u:user?user.id:'',uName:user?user.name:'sistema',
  lat:pos&&isFinite(pos.lat)?pos.lat:null,lng:pos&&isFinite(pos.lng)?pos.lng:null,acc:pos&&pos.acc!=null?pos.acc:null,bat:pvxBat,fuera:!!(datos&&datos.fuera),datos:datos||{}};
 const L=vbArr('campoLog');L.push(x);if(L.length>8000)S.campoLog=L.slice(-8000);audit('CAMPO_'+ev.toUpperCase(),x.ref+(x.lat!=null?' · GPS ± '+(x.acc||'?')+' m':' · sin GPS')+(x.fuera?' · fuera de la geocerca':'')+(x.bat!=null?' · batería '+x.bat+'%':''));return x;}
/* almacenamiento local resistente (sobrevive a cerrar la app o quedarse sin batería) */
const pvxKey=k=>'vbx:'+(typeof cl!=='undefined'&&cl&&cl.comercio?cl.comercio.id:'loc')+':'+(user?user.id:'-')+':'+k;
function pvxGet(k){try{return JSON.parse(localStorage.getItem(pvxKey(k))||'null');}catch(e){return null;}}
function pvxSet(k,v){try{if(v==null)localStorage.removeItem(pvxKey(k));else localStorage.setItem(pvxKey(k),JSON.stringify(v));}catch(e){}}

/* ---------- semáforo financiero ---------- */
function pvxSem(c){const deb=typeof debtOf==='function'?debtOf(c.id):0;const lim=+c.limit||0;const od=typeof wsOverdue==='function'&&typeof wsOn==='function'&&wsOn()?wsOverdue(c.id):[];
 const disp=Math.max(0,lim-deb);let k='v',txt='Al día';
 if(od.length){k='r';txt=od.length+' vencido(s) · '+money(od.reduce((a,d)=>a+d.left,0));}
 else if(lim>0&&deb>=lim){k='r';txt='Sin crédito disponible';}
 else if(!(lim>0)&&deb>0){k='a';txt='Debe '+money(deb)+' · sin límite asignado';}
 else if(lim>0&&deb>=lim*0.8){k='a';txt='Cerca del límite';}
 return{k,txt,deb,lim,disp,od};}
const pvxDot=c=>{const s=pvxSem(c);return`<span class="pvx-dot ${s.k}" title="${esc(s.txt)}" aria-label="${esc(s.txt)}"></span>`;};
/* ¿la cuenta corriente necesita autorización? (contado nunca se frena) */
function pvxNeedAuth(c,total){const s=pvxSem(c);if(S.creditOv&&typeof wsFindOverride==='function'&&wsFindOverride(c.id,total))return'';
 if(s.od.length)return'Tiene documentos vencidos.';if(!(s.lim>0))return'No tiene límite de crédito asignado.';if(s.deb+total>s.lim)return'Supera el límite: debe '+money(s.deb)+' de '+money(s.lim)+' y este pedido suma '+money(total)+'.';return'';}
/* PIN de un supervisor o administrador (en el mismo equipo) */
function pvxPinOk(pin){pin=String(pin||'').trim();if(!/^\d{4}$/.test(pin))return null;return(S.users||[]).find(u=>(u.role==='admin'||u.role==='supervisor')&&u.active!==false&&String(u.pin)===pin)||null;}

/* ---------- visita (check-in con geocerca) ---------- */
function pvxVisita(){return pvxGet('visita');}
async function pvxCheckin(cid){const c=custById(cid);if(!c)return null;const cur=pvxVisita();if(cur&&cur.cust===cid)return cur;
 const pos=await pvxGPS();const cp=c.pv||{};let dist=null,fuera=false;
 if(pos&&isFinite(cp.lat)&&cp.lat!==null&&isFinite(cp.lng)){dist=Math.round(gpsDist(pos.lat,pos.lng,cp.lat,cp.lng));fuera=dist>pvxCfg().radio+Math.min(pos.acc||0,150);}
 const v={cust:cid,ts:now(),lat:pos?pos.lat:null,lng:pos?pos.lng:null,acc:pos?pos.acc:null,bat:pvxBat,dist,fuera,sinGps:!pos,hecho:''};
 pvxEvent('checkin',custFull(c),pos,{dist,fuera,radio:pvxCfg().radio});pvxSet('visita',v);save();return v;}
function pvxCerrarVisita(res,note){const v=pvxVisita();if(!v)return;const c=custById(v.cust);
 const r=pvVisit(v.cust,res,note,v.lat!=null?{lat:v.lat,lng:v.lng}:null);if(r&&r.v){Object.assign(r.v,{acc:v.acc,bat:v.bat,fuera:v.fuera,sinGps:v.sinGps,dur:Math.round((now()-v.ts)/1000)});if(v.dist!=null)r.v.dist=v.dist;}
 pvxSet('visita',null);save();return r;}

const pvxHecho=v=>!!(v&&(v.hecho||pvVisits().some(x=>x.cust===v.cust&&x.ts>=v.ts)));
/* ---------- pantalla del cliente (lo que ve el preventista al llegar) ---------- */
let pvxCli='';
A.pvxAbrir=async el=>{const cid=el.dataset.id;const cur=pvxVisita();
 if(cur&&cur.cust!==cid&&!pvxHecho(cur)){const c0=custById(cur.cust);toast('Primero cerrá la visita a '+(c0?custFull(c0):'otro cliente')+'.',1);pvxCli=cur.cust;go('pvcli');return;}
 if(cur&&cur.cust!==cid&&pvxHecho(cur))pvxSet('visita',null);
 pvxCli=cid;go('pvcli');const v=await pvxCheckin(cid);if(curScreen==='pvcli')rerender();
 if(v&&v.fuera)toast('Estás a '+v.dist+' m del cliente: la visita queda marcada para auditoría.',1);};
function pvxCliHTML(){pvxCss();const c=custById(pvxCli)||custById((pvxVisita()||{}).cust);if(!c)return'<p>Elegí un cliente de tu recorrido.</p><button class="btn" data-act="nav" data-id="preventa">← Mi recorrido</button>';
 pvxCli=c.id;const v=pvxVisita();const s=pvxSem(c);const last=vbArr('sordr').filter(o=>o.cust===c.id).slice(-1)[0];const pend=vbArr('cambios').filter(x=>x.cust===c.id&&x.estado==='pendiente').length;
 const gps=!v?'<span class="tag">Tomando ubicación…</span>':v.sinGps?'<span class="tag warn">Sin GPS: la visita queda sin ubicación</span>':v.fuera?`<span class="tag bad">Fuera de la geocerca · a ${v.dist} m</span>`:(v.dist!=null?`<span class="tag ok">En el local · ${v.dist} m</span>`:'<span class="tag">Cliente sin ubicación cargada</span>');
 return`<div class="pvx-head"><button class="btn sm" data-act="pvxVolver" aria-label="Volver al recorrido">←</button>${pvxDot(c)}<h2>${esc(custFull(c))}</h2></div>
 <p class="sm" style="margin:.1rem 0">${esc(c.addr||'')}${c.pv&&c.pv.zona?' · '+esc(c.pv.zona):''}</p><p style="margin:.3rem 0">${gps}</p>
 <div class="card" style="margin:.5rem 0"><div class="row"><span class="pvx-dot ${s.k}"></span><b class="sp">${esc(s.txt)}</b></div>
 <p class="sm" style="margin:.3rem 0 0">Saldo ${money(s.deb)}${s.lim>0?' · límite '+money(s.lim)+' · disponible <b>'+money(s.disp)+'</b>':''}${last?' · último pedido '+esc(last.n)+' ('+dmy(dkey(last.ts))+')':''}${pend?' · <span class="tag warn">'+pend+' cambio(s) en revisión</span>':''}</p>
 ${s.k==='r'?'<p class="sm mut" style="margin:.3rem 0 0">Podés venderle de contado. Para cuenta corriente vas a necesitar el PIN de un supervisor.</p>':''}</div>
 ${pvxHecho(v)?`<div class="okbox">✓ ${esc(v.hecho||'Visita registrada')}</div>`:''}
 <div class="pvx-big"><button class="btn gold" data-act="pvxPed" data-id="${c.id}"><i>🛒</i>Tomar pedido</button>${last?`<button class="btn" data-act="pvxRep" data-id="${c.id}"><i>↻</i>Repetir último</button>`:`<button class="btn" disabled><i>↻</i>Sin pedidos previos</button>`}
 <button class="btn" data-act="pvxCambio" data-id="${c.id}"><i>📷</i>Cambio o avería</button><button class="btn" data-act="pvCob" data-id="${c.id}" ${s.deb>0?'':'disabled'}><i>💵</i>Cobrar deuda</button></div>
 <div class="row" style="gap:.5rem;flex-wrap:wrap">${c.wa?`<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${esc(String(c.wa).replace(/\D/g,''))}">💬 WhatsApp</a>`:''}${c.pv&&isFinite(c.pv.lat)&&c.pv.lat!==null?`<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${c.pv.lat},${c.pv.lng}">🧭 Cómo llegar</a>`:''}
 ${can('customers')&&v&&v.lat!=null&&!(c.pv&&isFinite(c.pv.lat)&&c.pv.lat!==null)?'<button class="btn" data-act="pvxUbic">📍 Guardar ubicación del local</button>':''}</div>
 <div class="pvx-sp"></div><div class="pvx-bar"><div class="tot"><small>Visita</small><b>${pvxHecho(v)?'Lista':'Abierta'}</b></div>${pvxHecho(v)?'<button class="btn gold" data-act="pvxSig">Siguiente cliente →</button>':'<button class="btn" data-act="pvxNoCompra">Cerrar sin pedido</button>'}</div>`;}
reg('pvcli','Cliente','route','presale',()=>pvxCliHTML(),()=>pvxBarPos(),'Operación');
A.pvxVolver=()=>{const v=pvxVisita();if(v&&!pvxHecho(v)){toast('Cerrá la visita: tomá el pedido o elegí el motivo de no compra.',1);return A.pvxNoCompra();}go('preventa');};
A.pvxSig=()=>{pvxSet('visita',null);go('preventa');};
A.pvxUbic=()=>{const v=pvxVisita();const c=custById(pvxCli);if(!v||!c||v.lat==null)return;const p=pvOf(c);p.lat=v.lat;p.lng=v.lng;v.dist=0;v.fuera=false;pvxSet('visita',v);audit('CLIENTE_UBICACION',custFull(c)+' · desde la visita (± '+(v.acc||'?')+' m)');save();toast('Ubicación guardada');rerender();};
A.pvxNoCompra=()=>{const c=custById(pvxCli);if(!c)return;modal('¿Por qué no compró?',`<p class="sm mut">Elegí el motivo: alimenta la cobertura real del recorrido.</p><div class="pvx-chips" id="pnc">${PV_MOT.map(m=>`<button type="button" class="btn" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div><label for="pnc-n">Nota (opcional)</label><input id="pnc-n" maxlength="160">`,
 {okText:'Registrar',onOk:w=>{const b=w.querySelector('#pnc .gold');if(!b)return w._err('Tocá un motivo.'),false;const m=b.dataset.m;const v=pvxVisita()||{};
  pvxEvent('no_compra',custFull(c)+' · '+m,v.lat!=null?v:null,{fuera:v.fuera});const r=pvxCerrarVisita(m,val('pnc-n'));if(r&&r.err)return w._err(r.err),false;toast('Visita registrada: '+m);go('preventa');}});
 setTimeout(()=>{const box=document.getElementById('pnc');if(box)box.addEventListener('click',ev=>{const b=ev.target.closest('button[data-m]');if(!b)return;box.querySelectorAll('button').forEach(x=>x.classList.toggle('gold',x===b));});},40);};

/* ---------- pedido en pantalla de pulgar ---------- */
let pvxQ='',pvxTab='cat';
function pvxDraft(){return pvxGet('pedido');}
function pvxDraftSave(d){if(d)d.upd=now();pvxSet('pedido',d);}
function pvxDraftNew(cid,items){const d={cust:cid,items:items||[],cond:'cc',note:'',deliv:'',ts:now()};const c=custById(cid);if(c&&pvxSem(c).k==='r')d.cond='contado';pvxDraftSave(d);return d;}
A.pvxPed=el=>{const d=pvxDraft();if(!d||d.cust!==el.dataset.id)pvxDraftNew(el.dataset.id);pvxQ='';pvxTab='cat';go('pvped');};
A.pvxRep=el=>{const last=vbArr('sordr').filter(o=>o.cust===el.dataset.id).slice(-1)[0];if(!last)return;pvxDraftNew(el.dataset.id,last.items.filter(i=>prod(i.pid)).map(i=>({pid:i.pid,qty:i.qty})));pvxTab='ped';go('pvped');toast('Cargado el último pedido: revisalo y confirmá.');};
/* índice de búsqueda (se arma una vez por catálogo: < 100 ms con 20.000 artículos) */
let pvxIdx=null,pvxIdxN=-1;
const pvxNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function pvxIndex(){const n=S.products.length;if(pvxIdx&&pvxIdxN===n)return pvxIdx;pvxIdx=S.products.filter(p=>p.active!==false&&!p.archived&&p.id!=='p_envio'&&!(typeof isKit==='function'&&isKit(p))).map(p=>({p,k:pvxNorm([p.name,p.sub,p.code,p.barcode,(p.pres||[]).map(x=>x.barcode).join(' '),typeof rubName==='function'?rubName(p.rubro):''].join(' '))}));pvxIdxN=n;return pvxIdx;}
function pvxBuscar(q,max){const I=pvxIndex();q=pvxNorm(q).trim();if(!q)return[];const code=q.replace(/\s/g,'');
 const ex=I.find(x=>x.p.barcode===code||x.p.code&&pvxNorm(x.p.code)===code||(x.p.pres||[]).some(k=>k.barcode===code));if(ex)return[ex.p];
 const T=q.split(/\s+/);const out=[];for(const x of I){if(T.every(t=>x.k.includes(t))){out.push(x.p);if(out.length>=(max||60))break;}}return out;}
/* frecuentes del cliente (90 días) para abrir el catálogo con lo que suele llevar */
function pvxFrecuentes(cid,max){const lim=now()-90*864e5;const cnt={};
 vbArr('sordr').filter(o=>o.cust===cid&&o.ts>=lim&&o.state!=='anulado').forEach(o=>o.items.forEach(i=>{cnt[i.pid]=(cnt[i.pid]||0)+1;}));
 (S.sales||[]).filter(s=>s.cust===cid&&s.ts>=lim&&s.status!=='anulada').forEach(s=>(s.lines||s.items||[]).forEach(l=>{cnt[l.pid]=(cnt[l.pid]||0)+1;}));
 return Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([pid])=>prod(pid)).filter(p=>p&&p.active!==false&&!p.archived&&p.id!=='p_envio').slice(0,max||12);}
function pvxTot(d){const c=custById(d.cust);let t=0;d.items.forEach(x=>{const p=prod(x.pid);if(p)t+=vbLinePrice(p,x.qty,c).amt;});return t;}
function pvxQtyOf(d,pid){const x=d.items.find(i=>i.pid===pid);return x?x.qty:0;}
function pvxProdRow(p,d,c){const q=pvxQtyOf(d,p.id);const P=typeof wsPres==='function'?wsPres(p):[];const av=typeof vbAvail==='function'?vbAvail(p):p.stock;
 const pr=q>0?vbLinePrice(p,q,c):null;
 return`<div class="pvx-p"><div class="nm"><b>${esc(pfull(p))}</b><small>${money(p.price)} c/u${P.length?' · '+P.map(k=>esc(typeof wsLvName==='function'?wsLvName(k.lv):k.lv)+' ×'+numAR(k.qty,3)+' a '+money(k.unit)).join(' · '):''} · disp. ${numAR(av,3)}</small>${pr?`<small style="display:block;color:var(--ink)">${numAR(q,3)} → <b>${money(pr.amt)}</b>${pr.why&&pr.rule&&pr.rule!=='L1'?' · '+esc(pr.why):''}</small>`:''}</div>
 <div class="q">${q>0?`<button class="btn" data-act="pvxQ" data-id="${p.id}" data-d="-1" aria-label="Quitar uno">−</button><span class="n">${numAR(q,3)}</span>`:''}<button class="btn ${q>0?'':'gold'}" data-act="pvxQ" data-id="${p.id}" data-d="1" aria-label="Sumar uno de ${esc(p.name)}">+1</button>${P.map(k=>`<button class="btn" data-act="pvxQ" data-id="${p.id}" data-d="${k.qty}" aria-label="Sumar ${esc(typeof wsLvName==='function'?wsLvName(k.lv):k.lv)}">+${esc((typeof wsLvName==='function'?wsLvName(k.lv):k.lv).slice(0,7))}</button>`).join('')}</div></div>`;}
function pvxPedHTML(){pvxCss();const d=pvxDraft();const c=d&&custById(d.cust);if(!d||!c)return'<p>No hay pedido abierto.</p><button class="btn" data-act="nav" data-id="preventa">← Mi recorrido</button>';
 const tot=pvxTot(d);const n=d.items.length;
 const lista=pvxTab==='ped'?pvxRevHTML(d,c,tot):(()=>{const L=pvxQ?pvxBuscar(pvxQ,60):pvxFrecuentes(c.id,15);const cat=!pvxQ&&L.length<15?pvxIndex().slice(0,40-L.length).map(x=>x.p).filter(p=>!L.includes(p)):[];
  return`<div class="pvx-search"><input id="pvx-q" type="search" inputmode="search" placeholder="Buscar artículo, código o escanear" value="${esc(pvxQ)}" autocomplete="off" aria-label="Buscar artículo"></div><div id="pvx-res">${pvxResHTML(L,cat,d,c)}</div>`;})();
 return`<div class="pvx-head"><button class="btn sm" data-act="pvxPedVolver" aria-label="Volver al cliente">←</button>${pvxDot(c)}<h2>${esc(custFull(c))}</h2></div>
 <div class="ux-tabs" role="tablist"><a role="tab" tabindex="0" data-act="pvxTabG" data-t="cat" aria-selected="${pvxTab==='cat'}" class="${pvxTab==='cat'?'on':''}">Catálogo</a><a role="tab" tabindex="0" data-act="pvxTabG" data-t="ped" aria-selected="${pvxTab==='ped'}" class="${pvxTab==='ped'?'on':''}">Pedido (${n})</a></div>
 ${lista}<div class="pvx-sp"></div>
 <div class="pvx-bar"><div class="tot"><small>${n} art. · ${d.cond==='cc'?'cta. cte.':'contado'} · ✓ guardado</small><b>${money(tot)}</b></div>${pvxTab==='ped'?`<button class="btn gold" data-act="pvxConfirmar" ${n?'':'disabled'}>Confirmar</button>`:`<button class="btn gold" data-act="pvxTabG" data-t="ped" ${n?'':'disabled'}>Revisar →</button>`}</div>`;}
function pvxResHTML(L,cat,d,c){if(!L.length&&!cat.length)return`<p class="mut" style="padding:.8rem 0">${pvxQ?'No encontré «'+esc(pvxQ)+'».':'Escribí para buscar.'}</p>`;
 return(L.length&&!pvxQ?'<p class="sm mut" style="margin:.4rem 0 0">Lo que suele llevar</p>':'')+L.map(p=>pvxProdRow(p,d,c)).join('')+(cat.length?'<p class="sm mut" style="margin:.6rem 0 0">Catálogo</p>'+cat.map(p=>pvxProdRow(p,d,c)).join(''):'');}
function pvxRevHTML(d,c,tot){const sug=typeof pvxSugeridos==='function'?pvxSugeridos(c.id,d):[];const auth=d.cond==='cc'?pvxNeedAuth(c,tot):'';
 return`${d.items.length?d.items.map(x=>{const p=prod(x.pid);return p?pvxProdRow(p,d,c):'';}).join(''):'<p class="mut">Todavía no hay artículos.</p>'}
 ${sug.length?`<div class="pvx-sug"><b>¿No te olvidás de algo?</b>${sug.map(s=>`<div class="row" style="margin-top:.4rem"><span class="sp sm">${esc(s.txt)}</span><button class="btn sm gold" data-act="pvxQ" data-id="${s.p.id}" data-d="${s.qty}">+${numAR(s.qty,3)}</button></div>`).join('')}</div>`:''}
 <div class="card" style="margin:.6rem 0"><b class="sm">Condición</b><div class="pvx-chips" style="margin:.4rem 0"><button class="btn ${d.cond==='cc'?'gold':''}" data-act="pvxCond" data-v="cc">Cuenta corriente</button><button class="btn ${d.cond==='contado'?'gold':''}" data-act="pvxCond" data-v="contado">Contado (cobra el repartidor)</button></div>
 ${auth?`<div class="warnbox sm">${esc(auth)} Para confirmar en cuenta corriente hace falta el PIN de un supervisor; de contado sale sin autorización.</div>`:''}
 <div class="grid g2"><div><label for="pvx-dd">Entrega</label><input id="pvx-dd" type="date" value="${esc(d.deliv)}"></div><div><label for="pvx-dn">Nota</label><input id="pvx-dn" maxlength="200" value="${esc(d.note)}" placeholder="Ej.: entregar a la mañana"></div></div></div>`;}
reg('pvped','Pedido','cart','presale',()=>pvxPedHTML(),()=>{pvxBarPos();const q=$('#pvx-q');if(q){let t=null;q.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(()=>{pvxQ=q.value;const d=pvxDraft();const c=d&&custById(d.cust);if(!c)return;const L=pvxQ?pvxBuscar(pvxQ,60):pvxFrecuentes(c.id,15);$('#pvx-res').innerHTML=pvxResHTML(L,[],d,c);},90);});
  q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const L=pvxBuscar(q.value,2);if(L.length===1){A.pvxQ({dataset:{id:L[0].id,d:'1'}});q.value='';pvxQ='';}}});}
 [['pvx-dd','deliv'],['pvx-dn','note']].forEach(([id,k])=>{const e=$('#'+id);if(e)e.addEventListener('change',()=>{const d=pvxDraft();if(!d)return;d[k]=e.value.replace(/[<>]/g,'').slice(0,200);pvxDraftSave(d);});});},'Operación');
A.pvxTabG=el=>{pvxTab=el.dataset.t;rerender();window.scrollTo(0,0);};
A.pvxPedVolver=()=>{pvxCli=(pvxDraft()||{}).cust||pvxCli;go('pvcli');};
A.pvxCond=el=>{const d=pvxDraft();if(!d)return;d.cond=el.dataset.v==='contado'?'contado':'cc';pvxDraftSave(d);rerender();};
A.pvxQ=el=>{const d=pvxDraft();if(!d)return;const pid=el.dataset.id,dl=+el.dataset.d||0;const p=prod(pid);if(!p)return;let x=d.items.find(i=>i.pid===pid);
 if(!x){if(dl<=0)return;x={pid,qty:0};d.items.push(x);}x.qty=Math.max(0,Math.round((x.qty+dl)*1000)/1000);if(!(x.qty>0))d.items=d.items.filter(i=>i!==x);pvxDraftSave(d);
 if(pvxTab==='cat'&&$('#pvx-res')){const c=custById(d.cust);const row=el.closest('.pvx-p');if(row){const tmp=document.createElement('div');tmp.innerHTML=pvxProdRow(p,d,c);row.replaceWith(tmp.firstElementChild);}
  const bar=document.querySelector('.pvx-bar .tot');if(bar)bar.innerHTML=`<small>${d.items.length} art. · ${d.cond==='cc'?'cta. cte.':'contado'} · ✓ guardado</small><b>${money(pvxTot(d))}</b>`;const rb=document.querySelector('.pvx-bar .btn');if(rb)rb.disabled=!d.items.length;if(navigator.vibrate)try{navigator.vibrate(12);}catch(e){}return;}
 rerender();};
A.pvxConfirmar=()=>{const d=pvxDraft();const c=d&&custById(d.cust);if(!c||!d.items.length)return;const tot=pvxTot(d);
 const fin=async(auth)=>{const pos=await pvxGPS();const v=pvxVisita()||{};
  const r=vbOrderCreate({cust:c.id,items:d.items,cond:d.cond,note:d.note,src:'preventa',deliv:d.deliv,seller:user.id,addr:c.addr});if(r.err)return toast(r.err,1);
  if(auth){r.o.auth={by:auth.name,ts:now(),motivo:'crédito'};audit('AUTORIZACION_CREDITO',r.o.n+' · '+custFull(c)+' · autorizó '+auth.name);}
  r.o.gps=pos?{lat:pos.lat,lng:pos.lng,acc:pos.acc}:null;r.o.fuera=!!v.fuera;
  pvxEvent('pedido',r.o.n+' · '+custFull(c)+' · '+money(r.o.total),pos||(v.lat!=null?v:null),{fuera:v.fuera,total:r.o.total});
  if(v.cust===c.id){v.hecho='Pedido '+r.o.n+' por '+money(r.o.total);pvxSet('visita',v);pvxCerrarVisitaKeep('Pedido '+r.o.n);}else pvVisit(c.id,'Pedido '+r.o.n,'',pos);
  pvxDraftSave(null);pvxSet('pedido',null);PVX_LAST=r.o.id;save();go('pvlisto');};
 if(d.cond==='cc'){const why=pvxNeedAuth(c,tot);if(why){modal('Autorización de crédito',`<p>${esc(why)}</p><label for="pa-p">PIN de un supervisor o administrador</label><input id="pa-p" inputmode="numeric" maxlength="4" autocomplete="off" class="cop-pin">
  <p class="sm mut">Queda en auditoría con el nombre de quien autorizó. Si no hay supervisor, pasalo a contado.</p>`,{okText:'Autorizar y confirmar',onOk:w=>{const u=pvxPinOk(val('pa-p'));if(!u)return w._err('PIN incorrecto.'),false;fin(u);}});return;}}
 fin(null);};
/* registra la visita pero deja la pantalla del cliente abierta (para mandar WhatsApp o cargar un cambio) */
function pvxCerrarVisitaKeep(res){const v=pvxVisita();if(!v||v.reg)return;const r=pvVisit(v.cust,res,'',v.lat!=null?{lat:v.lat,lng:v.lng}:null);if(r&&r.v){Object.assign(r.v,{acc:v.acc,bat:v.bat,fuera:v.fuera,sinGps:v.sinGps,dur:Math.round((now()-v.ts)/1000)});if(v.dist!=null)r.v.dist=v.dist;}v.reg=1;pvxSet('visita',v);}
let PVX_LAST='';
reg('pvlisto','Pedido guardado','check','presale',()=>{pvxCss();const o=vbOrd(PVX_LAST);if(!o)return'<button class="btn" data-act="nav" data-id="preventa">← Mi recorrido</button>';const c=custById(o.cust)||{};
 return`<div class="pvx-ok"><div style="font-size:3rem">✅</div><b class="big">Pedido ${esc(o.n)}</b><p>${esc(o.custName)} · ${money(o.total)} · ${o.cond==='cc'?'cuenta corriente':'contado'}</p>
 <p class="sm mut">${navigator.onLine?'Guardado. Se sincroniza solo.':'Guardado en el celular: sube solo cuando vuelva la señal.'}</p></div>
 <div class="pvx-big"><button class="btn" data-act="pvxWA" data-id="${o.id}"><i>💬</i>Mandar por WhatsApp</button><button class="btn" data-act="pvxPDF" data-id="${o.id}"><i>📄</i>Ver / imprimir PDF</button></div>
 <div class="pvx-sp"></div><div class="pvx-bar"><div class="tot"><small>Visita lista</small><b>${esc(o.custName)}</b></div><button class="btn gold" data-act="pvxSig">Siguiente cliente →</button></div>`;},()=>pvxBarPos(),'Operación');
/* pantallas de paso: sólo existen mientras se está en ellas (no ensucian el menú) */
['pvcli','pvped','pvlisto'].forEach(k=>{SCREENS[k].show=()=>giOn('presale')&&location.hash==='#panel/'+k;});

/* ---------- recorrido: semáforo, estado y orden por cercanía ---------- */
async function pvxOrdenCerca(L){const pos=await pvxGPS();if(!pos)return null;const rest=L.filter(c=>c.pv&&isFinite(c.pv.lat)&&c.pv.lat!==null);const sin=L.filter(c=>!rest.includes(c));
 const out=[];let cur=pos;while(rest.length){let bi=0,bd=1e12;rest.forEach((c,i)=>{const dd=gpsDist(cur.lat,cur.lng,c.pv.lat,c.pv.lng);if(dd<bd){bd=dd;bi=i;}});const n=rest.splice(bi,1)[0];out.push(n.id);cur={lat:n.pv.lat,lng:n.pv.lng};}
 return out.concat(sin.map(c=>c.id));}
A.pvxCerca=async()=>{const sid=pvMe()||pvSeller;const day=pvDay>=0?pvDay:new Date(now()).getDay();const o=await pvxOrdenCerca(pvRoute(sid,day));if(!o)return toast('No pude tomar tu ubicación.',1);pvxSet('orden',{day:dkey(now()),ids:o});toast('Ordenado por cercanía desde donde estás');rerender();};
function pvxCard(c){const vis=pvVisits().filter(v=>v.cust===c.id&&dkey(v.ts)===dkey(now()));const lv=vis[vis.length-1];const cur=pvxVisita();const abierta=cur&&cur.cust===c.id&&!pvxHecho(cur);const s=pvxSem(c);
 const st=abierta?'<span class="tag warn">Visita abierta</span>':lv?`<span class="tag ${/^Pedido/.test(lv.res)?'ok':''}">${/^Pedido/.test(lv.res)?'🛒 ':'✓ '}${esc(lv.res)}</span>`:'<span class="tag">Pendiente</span>';
 return`<button type="button" class="card pvx-c" data-act="pvxAbrir" data-id="${c.id}" style="display:block;width:100%;text-align:left;margin:.45rem 0;cursor:pointer"><div class="row" style="gap:.5rem"><span class="pvx-dot ${s.k}"></span><b class="sp">${esc(custFull(c))}</b>${st}</div>
 <div class="sm mut" style="margin-top:.25rem">${esc(c.addr||'')}${c.pv&&c.pv.zona?' · '+esc(c.pv.zona):''}${c.pv&&c.pv.hor?' · ⏰ '+esc(c.pv.hor):''}</div><div class="sm" style="margin-top:.2rem">${esc(s.txt)}${s.deb>0?' · saldo '+money(s.deb):''}</div></button>`;}
function pvxRutaHTML(R){pvxCss();const o=pvxGet('orden');let L=R;if(o&&o.day===dkey(now())){const pos=id=>{const i=o.ids.indexOf(id);return i<0?1e6:i;};L=R.slice().sort((a,b)=>pos(a.id)-pos(b.id));}
 const cur=pvxVisita();const cc=cur&&custById(cur.cust);const pts=L.filter(c=>c.pv&&isFinite(c.pv.lat)&&c.pv.lat!==null).map((c,i)=>({lat:c.pv.lat,lng:c.pv.lng,label:(i+1)+' '+custFull(c).split(' ')[0],color:pvVisits().some(v=>v.cust===c.id&&dkey(v.ts)===dkey(now()))?'#188038':'#d93025'}));
 const hechos=L.filter(c=>pvVisits().some(v=>v.cust===c.id&&dkey(v.ts)===dkey(now()))).length;const peds=vbArr('sordr').filter(x=>x.src==='preventa'&&dkey(x.ts)===dkey(now())&&(!pvMe()||x.seller===pvMe()));
 return`${typeof pvxAvisosHTML==='function'?pvxAvisosHTML():''}${cc&&!pvxHecho(cur)?`<div class="warnbox"><b>Visita abierta:</b> ${esc(custFull(cc))}. <button class="btn sm gold" data-act="pvxAbrir" data-id="${cc.id}">Continuar</button></div>`:''}
 ${pvxDraft()&&custById(pvxDraft().cust)&&!(cur&&pvxHecho(cur))?`<div class="okbox sm">Tenés un pedido sin confirmar de ${esc(custFull(custById(pvxDraft().cust)))} (${pvxDraft().items.length} art.). <button class="btn sm" data-act="pvxSeguir">Seguir</button></div>`:''}
 <div class="card row" style="margin:.4rem 0;gap:1rem"><div class="sp"><small class="mut">Visitados</small><b style="display:block;font-size:1.25rem">${hechos} de ${L.length}</b></div><div class="sp"><small class="mut">Pedidos hoy</small><b style="display:block;font-size:1.25rem">${peds.length} · ${money(peds.reduce((a,x)=>a+x.total,0))}</b></div></div>
 ${pts.length?`<details open><summary class="sm">Mapa del recorrido</summary>${gpsMapHTML(pts,Math.max(260,Math.min(640,(window.innerWidth||400)-28)),230,[pts])}</details>`:''}
 <div class="row" style="margin:.4rem 0"><span class="sm mut sp">Tocá un cliente para empezar la visita</span><button class="btn sm" data-act="pvxCerca">📍 Ordenar por cercanía</button></div>
 ${L.map(pvxCard).join('')||'<div class="okbox">No hay clientes asignados para este día.</div>'}`;}
A.pvxSeguir=()=>{const d=pvxDraft();if(!d)return;pvxCli=d.cust;pvxTab='ped';go('pvped');};

/* ===================== Sprint 2 · evidencias (foto en vivo con marca de agua) y cambios / averías ===================== */
if(typeof MET!=='undefined'&&!MET.nc)MET.nc='Nota de crédito';
/* las fotos viven en IndexedDB del equipo (no inflan la sincronización); en la nube suben a Storage privado cuando esté el SQL 42 */
const PVX_DB='vb-evid';
function pvxIdb(){return new Promise((res,rej)=>{try{const r=indexedDB.open(PVX_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});}
async function pvxFotoPut(id,data){try{const db=await pvxIdb();await new Promise((res,rej)=>{const t=db.transaction('f','readwrite');t.objectStore('f').put(data,id);t.oncomplete=res;t.onerror=()=>rej(t.error);});}catch(e){PVX_MEM[id]=data;}}
async function pvxFotoGet(id){if(PVX_MEM[id])return PVX_MEM[id];try{const db=await pvxIdb();return await new Promise(res=>{const t=db.transaction('f','readonly');const q=t.objectStore('f').get(id);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);});}catch(e){return null;}}
const PVX_MEM={};
async function pvxSha(dataUrl){try{const b=atob(dataUrl.split(',')[1]);const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);const h=await crypto.subtle.digest('SHA-256',u);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}catch(e){return typeof sha256==='function'?sha256(dataUrl):'';}}
/* dibuja la marca de agua y comprime: máx. 1280 px y < 350 KB */
function pvxMarca(src,w,h,lines){const k=Math.min(1,1280/Math.max(w,h));const cv=document.createElement('canvas');cv.width=Math.round(w*k);cv.height=Math.round(h*k);const g=cv.getContext('2d');g.drawImage(src,0,0,cv.width,cv.height);
 const fs=Math.max(14,Math.round(cv.width/42));g.font='600 '+fs+'px system-ui,sans-serif';const lh=Math.round(fs*1.35);const bh=lh*lines.length+fs*.8;g.fillStyle='rgba(0,0,0,.55)';g.fillRect(0,cv.height-bh,cv.width,bh);
 g.fillStyle='#fff';lines.forEach((t,i)=>g.fillText(t,fs*.6,cv.height-bh+fs*.4+lh*(i+1)-fs*.3));
 const enc=(type,q)=>cv.toDataURL(type,q);let out=enc('image/webp',.82);if(!/^data:image\/webp/.test(out))out=enc('image/jpeg',.8);
 for(let q=.72;out.length*.75>350*1024&&q>.3;q-=.1)out=enc(/^data:image\/webp/.test(out)?'image/webp':'image/jpeg',q);return{data:out,w:cv.width,h:cv.height,bytes:Math.round(out.length*.75)};}
/* abre la cámara trasera dentro de la app (sin galería). Si el equipo no la permite, se acepta un archivo pero queda «sin verificar» */
function pvxCamara(meta){pvxCss();return new Promise(async res=>{const gp=pvxGPS();let stream=null,pos=null;gp.then(p=>{pos=p;const w=document.querySelector('.pvx-cam .wm');if(w)w.textContent=wm().join('\n');});
 const wm=()=>[new Date().toLocaleString('es-AR'),meta.cliente||'',pos?('GPS '+pos.lat.toFixed(5)+', '+pos.lng.toFixed(5)+' ± '+pos.acc+' m'):'GPS: buscando…',(user?user.name:'')+' · '+(meta.ref||'')];
 const ov=document.createElement('div');ov.className='pvx-cam';ov.setAttribute('role','dialog');ov.setAttribute('aria-label','Cámara');
 ov.innerHTML=`<video playsinline autoplay muted></video><div class="wm">${esc(wm().join('\n'))}</div><div class="bar"><button class="btn" data-k="no">Cancelar</button><button class="shot" data-k="ok" aria-label="Sacar foto"></button><span style="width:90px" data-k="alt"></span></div>`;document.body.appendChild(ov);
 const end=r=>{try{stream&&stream.getTracks().forEach(t=>t.stop());}catch(e){}ov.remove();res(r);};
 const fin=async(src,w,h,vivo)=>{const p=pos||await Promise.race([gp,new Promise(r=>setTimeout(()=>r(null),1500))]);pos=p;const m=pvxMarca(src,w,h,wm().concat(vivo?[]:['SIN VERIFICAR · subida desde archivo']));
  const sha=await pvxSha(m.data);end({data:m.data,sha,vivo,bytes:m.bytes,w:m.w,h:m.h,ts:now(),lat:p?p.lat:null,lng:p?p.lng:null,acc:p?p.acc:null});};
 const file=()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.capture='environment';i.onchange=()=>{const f=i.files&&i.files[0];if(!f)return;const u=URL.createObjectURL(f);const im=new Image();im.onload=()=>{fin(im,im.naturalWidth,im.naturalHeight,false);URL.revokeObjectURL(u);};im.src=u;};i.click();};
 ov.querySelector('[data-k=no]').onclick=()=>end(null);
 try{if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw 0;stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});const v=ov.querySelector('video');v.srcObject=stream;
  ov.querySelector('[data-k=ok]').onclick=()=>{if(!v.videoWidth)return;fin(v,v.videoWidth,v.videoHeight,true);};}
 catch(e){ov.querySelector('video').replaceWith(Object.assign(document.createElement('p'),{textContent:'Este equipo no deja abrir la cámara dentro de la app. Podés subir una foto: queda marcada «sin verificar».',style:'color:#fff;padding:2rem 1rem;flex:1'}));
  const b=ov.querySelector('[data-k=ok]');b.onclick=file;b.setAttribute('aria-label','Elegir foto');}});}
/* guarda la foto y su ficha (la ficha viaja a la nube; la imagen queda en el equipo hasta subirla) */
async function pvxEvidencia(tipo,ref,f){const id=uid();await pvxFotoPut(id,f.data);
 const ext=/^data:image\/webp/.test(f.data)?'webp':/^data:image\/png/.test(f.data)?'png':'jpg';const nube=typeof CLOUD!=='undefined'&&CLOUD.on&&typeof cl!=='undefined'&&cl.comercio;
 const x={id,tipo,ref:String(ref||''),sha:f.sha,vivo:!!f.vivo,bytes:f.bytes,w:f.w,h:f.h,ts:f.ts,lat:f.lat,lng:f.lng,acc:f.acc,u:user?user.id:'',uName:user?user.name:'',
  path:nube?cl.comercio.id+'/'+new Date(f.ts||now()).toISOString().slice(0,7)+'/'+id+'.'+ext:''};vbArr('evid').push(x);save();if(nube)setTimeout(pvxSubirPend,400);return x;}
async function pvxFotoHTML(ev,cls){const d=ev?(await pvxFotoGet(ev.id))||(await pvxFotoNube(ev)):null;return d?`<img src="${d}" alt="Evidencia ${esc(ev.ref)}" class="${cls||'pvx-thumb'}">`:'<div class="pvx-thumb" style="display:grid;place-items:center;font-size:.7rem;text-align:center">foto en el equipo que la sacó</div>';}
const pvxEvid=id=>vbArr('evid').find(x=>x.id===id);
const pvxEvidTag=ev=>ev?(ev.vivo?'<span class="tag ok">Foto en vivo ✓</span>':'<span class="tag warn">Foto sin verificar</span>'):'';

/* ---------- cambios y averías ---------- */
const PVX_MOTC=['Vencido','Envase roto','Falla de fábrica','Error de picking','Mal estado por transporte'];
let pvxCF=null;
A.pvxCambio=el=>{const c=custById(el.dataset.id);if(!c)return;pvxCF={cust:c.id,pid:'',qty:1,lote:'',vence:'',motivo:'',ord:'',foto:null};pvxCambioModal();};
function pvxCambioBody(){const f=pvxCF;const p=f.pid&&prod(f.pid);const O=vbArr('sordr').filter(o=>o.cust===f.cust&&o.state!=='anulado').slice(-6).reverse();
 return`${p?`<div class="okbox row"><b class="sp">${esc(pfull(p))}</b><button type="button" class="btn sm" data-k="cambiar">Cambiar</button></div>`:`<label for="cf-q">Artículo</label><input id="cf-q" placeholder="Nombre o código" autocomplete="off"><div id="cf-r"></div>`}
 <div class="grid g2"><div><label for="cf-n">Cantidad</label><input id="cf-n" inputmode="decimal" value="${esc(String(f.qty).replace('.',','))}"></div><div><label for="cf-o">Pedido vinculado</label><select id="cf-o"><option value="">Operación independiente</option>${O.map(o=>`<option value="${o.id}" ${f.ord===o.id?'selected':''}>${esc(o.n)} · ${dmy(dkey(o.ts))}</option>`).join('')}</select></div>
 <div><label for="cf-l">Lote</label><input id="cf-l" maxlength="30" value="${esc(f.lote)}"></div><div><label for="cf-v">Vencimiento</label><input id="cf-v" type="date" value="${esc(f.vence)}"></div></div>
 <label>Motivo</label><div class="pvx-chips" id="cf-m">${PVX_MOTC.map(m=>`<button type="button" class="btn ${f.motivo===m?'gold':''}" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div>
 <label>Foto ${pvxCfg().fotoCambio?'(obligatoria, se saca en el momento)':''}</label><div class="row" id="cf-f">${f.foto?`<img src="${f.foto.data}" class="pvx-thumb" alt="Foto del cambio"> ${f.foto.vivo?'<span class="tag ok">En vivo ✓</span>':'<span class="tag warn">Sin verificar</span>'}`:''}<button type="button" class="btn ${f.foto?'':'gold'}" data-k="foto">📷 ${f.foto?'Sacar otra':'Sacar foto'}</button></div>`;}
function pvxCambioModal(){const c=custById(pvxCF.cust);const w=modal('Cambio o avería · '+custFull(c),'<div id="cf-root">'+pvxCambioBody()+'</div>',{okText:'Enviar a revisión',onOk:w=>{pvxCambioSync(w);const f=pvxCF;const p=prod(f.pid);
  if(!p)return w._err('Elegí el artículo.'),false;if(!(f.qty>0))return w._err('La cantidad tiene que ser mayor a cero.'),false;if(!f.motivo)return w._err('Elegí el motivo.'),false;if(pvxCfg().fotoCambio&&!f.foto)return w._err('Sacá la foto del producto.'),false;
  pvxCambioGuardar().then(x=>{if(x){toast('Cambio '+x.n+' enviado a revisión');rerender();}});}});
 const paint=()=>{w.querySelector('#cf-root').innerHTML=pvxCambioBody();bind();};
 const bind=()=>{const q=w.querySelector('#cf-q');if(q){q.focus();q.addEventListener('input',()=>{const L=q.value.trim().length>=2?pvxBuscar(q.value,6):[];w.querySelector('#cf-r').innerHTML=L.map(p=>`<button type="button" class="btn sm" style="margin:.15rem" data-pid="${p.id}">${esc(pfull(p))}</button>`).join('');});}
  const r=w.querySelector('#cf-r');if(r)r.addEventListener('click',ev=>{const b=ev.target.closest('[data-pid]');if(!b)return;pvxCambioSync(w);pvxCF.pid=b.dataset.pid;paint();});
  w.querySelector('#cf-m').addEventListener('click',ev=>{const b=ev.target.closest('[data-m]');if(!b)return;pvxCF.motivo=b.dataset.m;w.querySelectorAll('#cf-m .btn').forEach(x=>x.classList.toggle('gold',x===b));});
  const ch=w.querySelector('[data-k=cambiar]');if(ch)ch.onclick=()=>{pvxCambioSync(w);pvxCF.pid='';paint();};
  w.querySelector('[data-k=foto]').onclick=async()=>{pvxCambioSync(w);const p=prod(pvxCF.pid);const f=await pvxCamara({cliente:custFull(c),ref:'Cambio'+(p?' · '+p.name:'')});if(f){pvxCF.foto=f;paint();}};};
 bind();}
function pvxCambioSync(w){const g=id=>w.querySelector('#'+id);const f=pvxCF;if(g('cf-n'))f.qty=Math.round((typeof parseNum==='function'?parseNum(g('cf-n').value):+String(g('cf-n').value).replace(',','.'))*1000)/1000||0;if(g('cf-l'))f.lote=g('cf-l').value.replace(/[<>]/g,'').slice(0,30);if(g('cf-v'))f.vence=g('cf-v').value;if(g('cf-o'))f.ord=g('cf-o').value;}
async function pvxCambioGuardar(){const f=pvxCF;const c=custById(f.cust),p=prod(f.pid);const v=pvxVisita()||{};const n=vbSeq('seqCA','CA-',5);
 const ev=f.foto?await pvxEvidencia('foto_cambio',n,f.foto):null;const o=f.ord?vbOrd(f.ord):null;
 const x={id:uid(),n,ts:now(),u:user.id,uName:user.name,cust:c.id,custName:custFull(c),ord:o?o.id:'',ordN:o?o.n:'',items:[{pid:p.id,name:pfull(p),qty:f.qty,lote:f.lote,vence:f.vence,motivo:f.motivo,price:p.price}],
  valor:Math.round(f.qty*p.price),estado:'pendiente',evid:ev?[ev.id]:[],lat:ev?ev.lat:v.lat,lng:ev?ev.lng:v.lng,fuera:!!v.fuera,hist:[{ts:now(),u:user.name,s:'pendiente'}]};
 vbArr('cambios').push(x);pvxEvent('cambio',n+' · '+x.custName+' · '+f.qty+' '+p.name+' · '+f.motivo,ev||v,{fuera:v.fuera,evid:ev?ev.id:''});save();pvxCF=null;return x;}

/* ---------- bandeja de cambios (torre de control) ---------- */
let pvxCFil='pendiente';
const PVX_CST={pendiente:['En revisión','warn'],repuesto:['Aprobado · reposición','ok'],nc:['Aprobado · nota de crédito','ok'],rechazado:['Rechazado','bad']};
reg('cambios','Cambios y averías','check','orders',()=>{pvxCss();const L=vbArr('cambios').filter(x=>pvxCFil==='todos'||x.estado===pvxCFil).slice().reverse().slice(0,120);const cnt=k=>vbArr('cambios').filter(x=>x.estado===k).length;
 setTimeout(()=>{L.forEach(async x=>{const ev=pvxEvid(x.evid[0]);const el=document.getElementById('cft-'+x.id);if(el&&ev)el.innerHTML=await pvxFotoHTML(ev,'pvx-thumb');});},0);
 return`<div class="row"><h1 class="sp">Cambios y averías</h1></div><p class="sm mut">Lo que cargan los preventistas en la calle, con foto en vivo, GPS y motivo. Se resuelve con un toque.</p>
 <div class="row" style="gap:.4rem;flex-wrap:wrap;margin:.5rem 0">${[['pendiente','En revisión ('+cnt('pendiente')+')'],['repuesto','Reposición'],['nc','Nota de crédito'],['rechazado','Rechazados'],['todos','Todos']].map(([k,t])=>`<button class="btn sm ${pvxCFil===k?'gold':''}" data-act="pvxCFil" data-f="${k}">${t}</button>`).join('')}</div>
 ${L.length?`<div class="pvx-grid">${L.map(x=>{const it=x.items[0];return`<button type="button" class="card" data-act="pvxCOpen" data-id="${x.id}" style="text-align:left;cursor:pointer;padding:.6rem"><div id="cft-${x.id}"><div class="pvx-thumb"></div></div>
  <b style="display:block;margin-top:.4rem">${esc(x.n)} · ${esc(x.custName)}</b><span class="sm">${numAR(it.qty,3)} × ${esc(it.name)}</span><div class="sm mut">${esc(it.motivo)} · ${money(x.valor)}</div><span class="tag ${PVX_CST[x.estado][1]}">${PVX_CST[x.estado][0]}</span>${x.fuera?' <span class="tag bad">Fuera de geocerca</span>':''}</button>`;}).join('')}</div>`:'<div class="okbox">No hay cambios en esta bandeja.</div>'}`;},null,'Operación');
SCREENS.cambios.show=()=>giOn('presale')||giOn('orders');NAV.push(['cambios','Operación']);
A.pvxCFil=el=>{pvxCFil=el.dataset.f;rerender();};
A.pvxCOpen=async el=>{const x=vbArr('cambios').find(y=>y.id===el.dataset.id);if(!x)return;const ev=pvxEvid(x.evid[0]);const it=x.items[0];const big=ev?await pvxFotoHTML(ev,''):'';const c=custById(x.cust);
 const w=modal('Cambio '+x.n,`<div style="margin-bottom:.6rem">${big.replace('<img ','<img style="width:100%;max-height:60vh;object-fit:contain;border-radius:10px;background:#000" ')||'<div class="warnbox">Sin foto.</div>'}</div>
 <p>${pvxEvidTag(ev)} <span class="tag ${PVX_CST[x.estado][1]}">${PVX_CST[x.estado][0]}</span>${x.fuera?' <span class="tag bad">Cargado fuera de la geocerca</span>':''}</p>
 <table class="sm"><tbody><tr><td>Cliente</td><td><b>${esc(x.custName)}</b>${c?' · saldo '+money(debtOf(c.id)):''}</td></tr><tr><td>Artículo</td><td>${numAR(it.qty,3)} × ${esc(it.name)} · ${money(x.valor)}</td></tr><tr><td>Motivo</td><td>${esc(it.motivo)}</td></tr>
 ${it.lote||it.vence?`<tr><td>Lote / vence</td><td>${esc(it.lote||'—')} · ${it.vence?dmy(it.vence):'—'}</td></tr>`:''}<tr><td>Pedido</td><td>${esc(x.ordN||'independiente')}</td></tr><tr><td>Cargó</td><td>${esc(x.uName)} · ${fmtDT(x.ts)}</td></tr>
 ${x.lat!=null?`<tr><td>Ubicación</td><td><a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${x.lat},${x.lng}">${x.lat}, ${x.lng}</a>${ev&&ev.acc?' ± '+ev.acc+' m':''}</td></tr>`:''}${ev?`<tr><td>Huella</td><td class="mono" style="font-size:.7rem;word-break:break-all">${esc(ev.sha)}</td></tr>`:''}
 ${x.resol?`<tr><td>Resolución</td><td>${esc(x.resol)}</td></tr>`:''}</tbody></table>
 ${x.estado==='pendiente'&&can('orders')?`<div class="pvx-big" style="grid-template-columns:1fr"><button class="btn gold" data-act="pvxCRes" data-id="${x.id}" data-r="repo"><i>🔁</i>Aprobar con reposición (va sin cargo en la próxima ruta)</button>
  <button class="btn" data-act="pvxCRes" data-id="${x.id}" data-r="nc"><i>🧾</i>Aprobar con nota de crédito (${money(x.valor)} a su cuenta corriente)</button><button class="btn red" data-act="pvxCRes" data-id="${x.id}" data-r="no"><i>✕</i>Rechazar con motivo</button></div>`:''}`,{wide:true,okText:'Cerrar',noCancel:true});};
function pvxAviso(uid_,txt){vbArr('avisos').push({id:uid(),u:uid_,ts:now(),txt:String(txt).slice(0,200),visto:false});}
function pvxCResolver(id,r,motivo){const x=vbArr('cambios').find(y=>y.id===id);if(!x||x.estado!=='pendiente')return{err:'Ese cambio ya se resolvió.'};if(!can('orders'))return{err:'Sin permiso.'};const c=custById(x.cust);const it=x.items[0];const p=prod(it.pid);
 if(r==='no'){if(String(motivo||'').trim().length<3)return{err:'Escribí el motivo del rechazo.'};x.estado='rechazado';x.resol='Rechazado: '+String(motivo).trim().slice(0,120);}
 else if(r==='nc'){const deb=c?debtOf(c.id):0;if(deb<x.valor)return{err:'El cliente debe '+money(deb)+' y el cambio vale '+money(x.valor)+': la nota de crédito no tiene contra qué aplicarse. Aprobalo con reposición.'};const e=fiadoPay(c.id,x.valor,'nc');if(e)return{err:e};x.estado='nc';x.nc=x.valor;x.resol='Nota de crédito '+money(x.valor)+' aplicada a la cuenta corriente';}
 else{if(!p)return{err:'El artículo ya no existe.'};if(typeof stockAdjust==='function')stockAdjust(p,-it.qty,'Reposición sin cargo · cambio '+x.n,'cambios');let env=null;
  if(typeof repNuevo==='function'&&typeof repOn==='function'&&repOn()){const pv=(c&&c.pv)||{};const zs=repCfg().zonas||[];const z=zs.find(q=>q.activo!==false&&pv.zona&&String(q.nombre).toLowerCase()===String(pv.zona).toLowerCase())||zs.find(q=>q.activo!==false);
   env=repNuevo({orig:'ped',cli:{nombre:x.custName,tel:(c&&c.wa)||'',dir:(c&&c.addr)||'',loc:'',ref:'',lat:pv.lat!=null?pv.lat:null,lng:pv.lng!=null?pv.lng:null,custId:x.cust},custId:x.cust,zona:z?z.id:'',tarifa:0,items:[{pid:p.id,name:pfull(p),rubro:p.rubro,qty:it.qty,price:0,cost:p.cost||0,unit:p.unit||'u'}],total:0,cobro:{modo:'pagado'},nota:'Reposición sin cargo · cambio '+x.n});
   env.sold=true;env.repo=x.id;repSetEst(env,'listo',{nota:'reposición '+x.n});}
  x.estado='repuesto';x.env=env?env.id:'';x.resol='Reposición sin cargo'+(env?' · envío #'+env.n+' listo para salir':' · entregar en la próxima visita');}
 x.resBy=user.name;x.resAt=now();x.hist.push({ts:now(),u:user.name,s:x.estado});pvxAviso(x.u,'Cambio '+x.n+' de '+x.custName+': '+x.resol);audit('CAMBIO_'+x.estado.toUpperCase(),x.n+' · '+x.custName+' · '+x.resol);save();return{x};}
A.pvxCRes=el=>{const id=el.dataset.id,r=el.dataset.r;const go2=m=>{const res=pvxCResolver(id,r,m);if(res.err)return toast(res.err,1);$$('#modal-root .ov').forEach(o=>o.remove());toast(res.x.n+' · '+res.x.resol);rerender();};
 if(r==='no')return modal('Rechazar cambio',`<label for="cr-m">Motivo (le llega al preventista)</label><input id="cr-m" maxlength="120">`,{okText:'Rechazar',onOk:w=>{if(val('cr-m').trim().length<3)return w._err('Escribí el motivo.'),false;go2(val('cr-m'));}});
 confirmBox(r==='nc'?'Aprobar con nota de crédito':'Aprobar con reposición',r==='nc'?'Se acredita el valor del artículo en la cuenta corriente del cliente.':'Sale del stock sin cargo y queda listo para la próxima hoja de ruta.',()=>go2(''),'Aprobar');};
/* avisos para el preventista (resolución de sus cambios) */
function pvxAvisosHTML(){const L=vbArr('avisos').filter(a=>user&&a.u===user.id&&!a.visto);return L.length?`<div class="card" style="border-left:4px solid var(--gold)"><b>Novedades</b>${L.map(a=>`<div class="sm" style="margin-top:.3rem">${esc(a.txt)}</div>`).join('')}<button class="btn sm" style="margin-top:.4rem" data-act="pvxAvVisto">Entendido</button></div>`:'';}
A.pvxAvVisto=()=>{vbArr('avisos').forEach(a=>{if(user&&a.u===user.id)a.visto=true;});save();rerender();};

/* ===================== Sprint 3 · entrega blindada: firma, quién recibe, rechazo parcial en puerta y cobro con comprobante ===================== */
const PVX_MOTR=['Mercadería dañada','Vencida o por vencer','No la pidió','Error de armado','Precio no acordado','Sin lugar / sin dinero'];
const PVX_MED=[['efectivo','💵 Efectivo'],['transferencia','🏦 Transferencia'],['cheque','🧾 Cheque'],['billetera','📱 Billetera / QR']];
function pvxFirma(cv){const g=cv.getContext('2d');const r=()=>{const b=cv.getBoundingClientRect();const k=window.devicePixelRatio||1;if(cv.width!==Math.round(b.width*k)){cv.width=Math.round(b.width*k);cv.height=Math.round(b.height*k);g.scale(k,k);g.lineWidth=2.4;g.lineCap='round';g.lineJoin='round';g.strokeStyle='#111';}};r();
 let on=false,n=0;const P=e=>{const b=cv.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top};};
 cv.addEventListener('pointerdown',e=>{r();on=true;cv.setPointerCapture(e.pointerId);const p=P(e);g.beginPath();g.moveTo(p.x,p.y);});
 cv.addEventListener('pointermove',e=>{if(!on)return;const p=P(e);g.lineTo(p.x,p.y);g.stroke();n++;});
 ['pointerup','pointercancel','pointerleave'].forEach(t=>cv.addEventListener(t,()=>{on=false;}));
 return{vacia:()=>n<8,limpiar:()=>{g.clearRect(0,0,cv.width,cv.height);n=0;},png:()=>{const o=document.createElement('canvas');o.width=Math.min(600,cv.width);o.height=Math.round(cv.height*o.width/cv.width);const og=o.getContext('2d');og.fillStyle='#fff';og.fillRect(0,0,o.width,o.height);og.drawImage(cv,0,0,o.width,o.height);return o.toDataURL('image/png');}};}
A.repEntregar=el=>{const e=repEnv(el.dataset.id);if(!e||e.estado!=='en_ruta')return;pvxCss();const c=repCfg();const b2b=!!e.ord;const cob=!repNoCob(e);const puedeRech=!e.sold&&e.items.some(i=>i.pid!=='p_envio');
 const IT=e.items.filter(i=>i.pid!=='p_envio');const st={rech:false,fotoR:null,fotoC:null,medio:e.cobro.modo==='digital'?'transferencia':'efectivo'};
 const rq=k=>st.rech?Math.min(IT[k].qty,Math.max(0,+String((w.querySelector('#rj-'+k)||{}).value||'0').replace(',','.')||0)):0;
 const neto=()=>IT.some((i,k)=>rq(k)>0)?IT.reduce((a,i,k)=>a+Math.round((i.qty-rq(k))*i.price),0)+e.items.filter(i=>i.pid==='p_envio').reduce((a,i)=>a+Math.round(i.qty*i.price),0):e.total;
 const rjAmt=()=>Math.max(0,e.total-neto());const aCobrar=()=>cob?neto():0;
 const w=modal('Entrega #'+e.n+' · '+e.cli.nombre,`<div id="en-ban">${repMoneyBanner(e)}</div>
 ${c.pin?`<label for="ce-pin">Código de entrega (PIN) que te dice el cliente</label><input id="ce-pin" inputmode="numeric" maxlength="4" autocomplete="off" class="cop-pin"><label class="chk"><input type="checkbox" id="ce-nopin"> El cliente no tiene el código</label>`:''}
 <div class="grid g2"><div><label for="ce-nm">Recibe (nombre)${b2b?' *':''}</label><input id="ce-nm" maxlength="60" autocomplete="off"></div><div><label for="ce-dni">DNI${b2b?' *':''}</label><input id="ce-dni" inputmode="numeric" maxlength="9" autocomplete="off"></div></div>
 <label>Firma de quien recibe${b2b?' *':''}</label><canvas class="pvx-sig" id="ce-sig" aria-label="Recuadro para firmar"></canvas><div class="row"><span class="sm mut sp">Firmá con el dedo</span><button type="button" class="btn sm" data-k="limpiar">Borrar firma</button></div>
 <div class="row" id="ce-fe" style="margin:.4rem 0"><button type="button" class="btn" data-k="fotoE">📷 Foto del remito firmado o de la mercadería${c.foto?' (obligatoria)':' (opcional)'}</button></div>
 ${puedeRech?`<details id="ce-rd"><summary><b>⚠ Hay mercadería rechazada</b></summary><p class="sm mut">Marcá lo que el cliente no acepta. El cobro se recalcula al instante y la mercadería vuelve al depósito como «devolución en tránsito».</p>
  ${IT.map((i,k)=>`<div class="row" style="margin:.3rem 0"><span class="sp sm">${esc(i.name)} <span class="mut">(${numAR(i.qty,3)} × ${money(i.price)})</span></span><input id="rj-${k}" inputmode="decimal" placeholder="0" style="width:5rem" aria-label="Rechaza de ${esc(i.name)}"></div>`).join('')}
  <label for="rj-m">Motivo</label><select id="rj-m">${PVX_MOTR.map(m=>`<option>${esc(m)}</option>`).join('')}</select>
  <div class="row" id="rj-f" style="margin-top:.4rem"><button type="button" class="btn" data-k="fotoR">📷 Foto de lo rechazado (obligatoria)</button></div></details>`:e.sold?'<p class="sm mut">Pedido ya cobrado en el local: si devuelve algo, usá «Incidencia» y se resuelve con nota de crédito en el local.</p>':''}
 ${cob?`<fieldset class="rep-cb"><legend>¿Cómo paga? <b id="ce-tot">${money(e.total)}</b></legend><div class="pvx-chips" id="ce-med">${PVX_MED.map(([k,t])=>`<button type="button" class="btn ${st.medio===k?'gold':''}" data-m="${k}">${t}</button>`).join('')}</div>
  <div id="ce-ef"><label for="ce-rec">Recibí ($)</label>${numIn('ce-rec',e.cobro.abona||e.total,'0')}<div id="ce-vu" class="vuelto" aria-live="assertive"></div></div>
  <div id="ce-dg" hidden><label for="ce-ref">N.º de comprobante / cheque / operación</label><input id="ce-ref" maxlength="40" autocomplete="off">
   <div id="ce-ch" hidden class="grid g2"><div><label for="ce-chb">Banco</label><input id="ce-chb" maxlength="30"></div><div><label for="ce-chf">Fecha de cobro</label><input id="ce-chf" type="date"></div></div>
   <div class="row" id="ce-fc" style="margin-top:.4rem"><button type="button" class="btn" data-k="fotoC">📷 Foto del comprobante (obligatoria)</button></div></div></fieldset>`:''}`,
 {okText:'Confirmar entrega',onOk:async()=>{const g=id=>w.querySelector('#'+id);
   let pinOk=!c.pin;if(c.pin){const p=(g('ce-pin').value||'').trim();if(p&&p===e.pin)pinOk=true;else if(p){e.pinFail=(e.pinFail||0)+1;toast('El código no coincide.',1);return false;}else if(!g('ce-nopin').checked){toast('Pedile el código de 4 números al cliente.',1);return false;}}
   const nm=g('ce-nm').value.trim().replace(/[<>]/g,'').slice(0,60),dni=g('ce-dni').value.replace(/\D/g,'');
   if((b2b||!pinOk)&&nm.length<3){toast('Escribí el nombre de quien recibe.',1);g('ce-nm').focus();return false;}
   if((b2b||!pinOk)&&!/^\d{7,8}$/.test(dni)){toast('Escribí el DNI de quien recibe (7 u 8 números).',1);g('ce-dni').focus();return false;}
   if((b2b||!pinOk)&&sig.vacia()){toast('Falta la firma de quien recibe.',1);return false;}
   if(c.foto&&!st.fotoE){toast('Sacá la foto de la entrega.',1);return false;}
   const rq=st.rech?IT.map((i,k)=>Math.min(i.qty,Math.max(0,+String(g('rj-'+k).value||'0').replace(',','.')||0))):IT.map(()=>0);const hayR=rq.some(q=>q>0);
   if(hayR&&!st.fotoR){toast('Sacá la foto de la mercadería rechazada.',1);return false;}
   const todo=hayR&&IT.every((i,k)=>rq[k]>=i.qty-1e-9);const monto=aCobrar();
   let cobrado=null;if(cob&&monto>0&&!todo){if(st.medio==='efectivo'){const rc=cents(g('ce-rec').value||'0');if(isNaN(rc)||rc<monto){toast('Lo recibido tiene que ser al menos '+money(monto)+'.',1);return false;}cobrado={modo:'efectivo',monto,recibido:rc,vuelto:rc-monto};}
    else{const ref=g('ce-ref').value.trim();if(ref.length<2){toast('Anotá el número del comprobante.',1);return false;}if(st.medio!=='billetera'&&!st.fotoC){toast('Sacá la foto del comprobante.',1);return false;}
     if(st.medio==='cheque'&&!g('ce-chf').value){toast('Poné la fecha de cobro del cheque.',1);return false;}
     cobrado={modo:st.medio==='efectivo'?'efectivo':st.medio,monto,ref:ref.slice(0,40),banco:st.medio==='cheque'?g('ce-chb').value.slice(0,30):'',fechaCobro:st.medio==='cheque'?g('ce-chf').value:''};}}
   const pos=await pvxGPS();const firma=!sig.vacia()?await pvxEvidencia('firma','#'+e.n,{data:sig.png(),sha:await pvxSha(sig.png()),vivo:true,bytes:0,w:0,h:0,ts:now(),lat:pos?pos.lat:null,lng:pos?pos.lng:null,acc:pos?pos.acc:null}):null;
   const evR=hayR?await pvxEvidencia('foto_rechazo','#'+e.n,st.fotoR):null;const evC=st.fotoC&&cobrado&&cobrado.modo!=='efectivo'?await pvxEvidencia(st.medio==='cheque'?'cheque':'transferencia','#'+e.n,st.fotoC):null;if(evC)cobrado.evid=evC.id;
   let rech=null;if(hayR){rech={items:IT.map((i,k)=>({pid:i.pid,name:i.name,qty:rq[k],price:i.price})).filter(x=>x.qty>0),motivo:g('rj-m').value,evid:evR.id,monto:Math.min(e.total,rjAmt()),todo};
    pvxDevolucion(e,rech);}
   const evE=st.fotoE?await pvxEvidencia('remito','#'+e.n,st.fotoE):null;if(st.fotoE)e.fotoData=st.fotoE.data;
   e.ent={ts:now(),by:user?user.name:'',lat:pos?pos.lat:null,lng:pos?pos.lng:null,acc:pos?pos.acc:null,pin:pinOk,recibe:nm?{nombre:nm,dni}:null,firma:firma?firma.id:'',foto:!!evE,fotoEv:evE?evE.id:'',cobrado,rech};
   if(hayR){pvxEvent('rechazo','#'+e.n+' · '+e.cli.nombre+' · '+rech.items.map(x=>x.qty+' '+x.name).join(', ')+' · '+rech.motivo,pos,{monto:rech.monto});}
   if(cobrado)pvxEvent('cobro','#'+e.n+' · '+money(cobrado.monto)+' · '+cobrado.modo,pos,{});pvxEvent('entrega','#'+e.n+' · '+e.cli.nombre+(nm?' · recibió '+nm:''),pos,{});
   repSetEst(e,todo?'devuelto':'entregado',{nota:todo?'rechazó todo · '+rech.motivo:(hayR?'entrega parcial · ':'')+(cobrado?(cobrado.modo==='efectivo'?'cobró efectivo '+money(cobrado.monto):'cobró '+cobrado.modo+' '+money(cobrado.monto)):repNoCob(e)?(e.cobro.modo==='cc'?'cuenta corriente':'pagado'):'')});
   save();setTimeout(rerender,30);toast(todo?'Rechazo total registrado':'✅ #'+e.n+' entregado'+(hayR?' con rechazo parcial':''));}});
 const sig=pvxFirma(w.querySelector('#ce-sig'));w.querySelector('[data-k=limpiar]').onclick=()=>sig.limpiar();
 const upd=()=>{const g=id=>w.querySelector('#'+id);const m=aCobrar();if(g('ce-tot'))g('ce-tot').textContent=money(m);
  if(g('en-ban')&&cob){const b=g('en-ban').querySelector('.cop-money b');if(b)b.textContent=m>0?'COBRAR '+money(m):'NADA PARA COBRAR';}
  if(g('ce-ef'))g('ce-ef').hidden=st.medio!=='efectivo';if(g('ce-dg'))g('ce-dg').hidden=st.medio==='efectivo';if(g('ce-ch'))g('ce-ch').hidden=st.medio!=='cheque';if(g('ce-fc'))g('ce-fc').hidden=st.medio==='billetera';
  if(g('ce-rec')&&!st.recT&&st.medio==='efectivo')g('ce-rec').value=pesosStr(m);
  if(g('ce-vu')){const rc=cents(g('ce-rec').value||'0');g('ce-vu').innerHTML=!isNaN(rc)&&rc>m?`<span>VUELTO A ENTREGAR</span><b>${money(rc-m)}</b>`:'';}};
 const rd=w.querySelector('#ce-rd');if(rd)rd.addEventListener('toggle',()=>{st.rech=rd.open;upd();});
 const med=w.querySelector('#ce-med');if(med)med.addEventListener('click',ev=>{const b=ev.target.closest('[data-m]');if(!b)return;st.medio=b.dataset.m;med.querySelectorAll('.btn').forEach(x=>x.classList.toggle('gold',x===b));const r=w.querySelector('#ce-rec');if(r&&st.medio==='efectivo')r.value=pesosStr(aCobrar());upd();});
 const fr=w.querySelector('[data-k=fotoR]');if(fr)fr.onclick=async()=>{const f=await pvxCamara({cliente:e.cli.nombre,ref:'Rechazo #'+e.n});if(f){st.fotoR=f;w.querySelector('#rj-f').innerHTML=`<img src="${f.data}" class="pvx-thumb" alt="Foto del rechazo"> ${f.vivo?'<span class="tag ok">En vivo ✓</span>':'<span class="tag warn">Sin verificar</span>'}`;}};
 const fe=w.querySelector('[data-k=fotoE]');if(fe)fe.onclick=async()=>{const f=await pvxCamara({cliente:e.cli.nombre,ref:'Entrega #'+e.n});if(f){st.fotoE=f;w.querySelector('#ce-fe').innerHTML=`<img src="${f.data}" class="pvx-thumb" alt="Foto de la entrega"> ${f.vivo?'<span class="tag ok">En vivo ✓</span>':'<span class="tag warn">Sin verificar</span>'}`;}};
 const fc=w.querySelector('[data-k=fotoC]');if(fc)fc.onclick=async()=>{const f=await pvxCamara({cliente:e.cli.nombre,ref:'Comprobante #'+e.n});if(f){st.fotoC=f;w.querySelector('#ce-fc').innerHTML=`<img src="${f.data}" class="pvx-thumb" alt="Foto del comprobante"> <span class="tag ok">Comprobante ✓</span>`;}};
 w.addEventListener('input',ev=>{if(ev.target&&ev.target.id==='ce-rec')st.recT=1;upd();});w.addEventListener('change',upd);upd();w._e=e;w._st=st;w._sig=sig;};
/* al rendir: el remito del pedido pasa a reflejar sólo lo que el cliente aceptó (lo rechazado vuelve a «pendiente» del pedido) */
function pvxRemitoFix(e){if(!e||!e.rem||!e.remFix||e.saleId)return'';const old=vbArr('remitos').find(r=>r.id===e.rem);const o=old&&vbOrd(old.ord);if(!old||old.inv||!o){e.remFix=false;return'';}
 const rech=(e.ent&&e.ent.rech)||{items:[]};const rv=vbRemitoVoid(old.id,'Rechazo en puerta · envío #'+e.n+(rech.motivo?' · '+rech.motivo:''));if(rv.err)return rv.err;
 if(rech.todo||e.estado==='devuelto'){e.rem='';e.remFix=false;return'';}
 const q={};old.items.forEach(x=>{const r=rech.items.find(y=>y.pid===x.pid);const k=Math.round((x.qty-(r?r.qty:0))*1000)/1000;if(k>0)q[x.pid]=k;});
 o.items.forEach(it=>{if(it.pick!=null&&q[it.pid]!=null)it.pick=Math.max(it.pick,(it.del||0)+q[it.pid]);});const nr=vbRemito(o.id,q);if(nr.err)return nr.err;e.rem=nr.r.id;e.remFix=false;audit('REMITO_CORREGIDO',nr.r.n+' reemplaza a '+old.n+' · envío #'+e.n);return'';}
/* el rechazo: ajusta el envío (y su remito si viene de un pedido) y deja la mercadería «en tránsito» hasta que el depósito la reciba */
function pvxDevolucion(e,rech){const acc=e.items.map(i=>{const r=rech.items.find(x=>x.pid===i.pid);return Object.assign({},i,{qty:Math.round((i.qty-(r?r.qty:0))*1000)/1000});}).filter(i=>i.qty>0||i.pid==='p_envio');
 if(!e.itemsOrig)e.itemsOrig=e.items;e.items=acc;e.totalOrig=e.totalOrig||e.total;e.total=Math.max(0,e.total-rech.monto);
 e.remFix=!!e.rem; /* el remito se corrige al rendir: lo hace caja, que tiene permiso sobre los pedidos */
 const d={id:uid(),n:vbSeq('seqDV','DV-',5),ts:now(),env:e.id,envN:e.n,cust:e.custId||'',custName:e.cli.nombre,ruta:e.rutaId||'',rep:(repRuta(e.rutaId)||{}).repNom||'',items:rech.items,motivo:rech.motivo,monto:rech.monto,evid:rech.evid,estado:'en_transito'};
 vbArr('devTransito').push(d);audit('DEVOLUCION_EN_TRANSITO',d.n+' · envío #'+e.n+' · '+d.items.map(x=>x.qty+' '+x.name).join(', ')+' · '+d.motivo);}
reg('devoluciones','Devoluciones en tránsito','truck','reparto',()=>{pvxCss();const L=vbArr('devTransito').slice().reverse().slice(0,150);const P=L.filter(x=>x.estado==='en_transito');
 return`<div class="row"><h1 class="sp">Devoluciones en tránsito</h1></div><p class="sm mut">Lo que el cliente rechazó en la puerta. Cuando vuelve el camión, el depósito la cuenta y la recibe: recién ahí se cierra.</p>
 ${P.length?`<div class="warnbox">${P.length} devolución(es) por recibir · ${money(P.reduce((a,x)=>a+x.monto,0))}</div>`:'<div class="okbox">No hay mercadería en tránsito.</div>'}
 <div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Artículos</th><th>Motivo</th><th class="r">Importe</th><th>Estado</th><th></th></tr></thead><tbody>${L.map(x=>`<tr><td>${esc(x.n)}</td><td>${fmtDT(x.ts)}</td><td>${esc(x.custName)}<div class="sm mut">envío #${esc(x.envN)} · ${esc(x.rep)}</div></td><td>${x.items.map(i=>numAR(i.qty,3)+' '+esc(i.name)).join('<br>')}</td><td>${esc(x.motivo)}</td><td class="r">${money(x.monto)}</td>
 <td>${x.estado==='en_transito'?'<span class="tag warn">En tránsito</span>':'<span class="tag ok">Recibida</span><div class="sm mut">'+esc(x.recBy||'')+'</div>'}</td><td class="r">${x.estado==='en_transito'&&can('reparto')?`<button class="btn sm gold" data-act="pvxDvRec" data-id="${x.id}">Recibir</button>`:''}</td></tr>`).join('')||'<tr><td colspan="8" class="mut">Sin devoluciones.</td></tr>'}</tbody></table></div>`;},null,'Operación');
SCREENS.devoluciones.show=()=>typeof repOn==='function'&&repOn();NAV.push(['devoluciones','Operación']);
A.pvxDvRec=el=>{const d=vbArr('devTransito').find(x=>x.id===el.dataset.id);if(!d)return;const e=repEnv(d.env);
 modal('Recibir '+d.n,`<p class="sm">Contá lo que vuelve y confirmá. ${e&&e.sold?'Era un pedido cobrado: la mercadería vuelve al stock.':'Era un pedido sin facturar: la mercadería nunca salió del stock, sólo se confirma que volvió.'}</p>${d.items.map((i,k)=>`<label for="dv-${k}">${esc(i.name)} (salió ${numAR(i.qty,3)})</label><input id="dv-${k}" inputmode="decimal" value="${String(i.qty).replace('.',',')}">`).join('')}`,
 {okText:'Recibido en depósito',onOk:w=>{const dif=[];d.items.forEach((i,k)=>{const q=+String(w.querySelector('#dv-'+k).value||'0').replace(',','.')||0;i.rec=q;if(Math.abs(q-i.qty)>1e-9)dif.push(i.name+': volvió '+q+' de '+i.qty);
   if(e&&e.sold&&q>0){const p=prod(i.pid);if(p&&typeof stockAdjust==='function')stockAdjust(p,q,'Devolución en puerta '+d.n,'reparto');}});
  d.estado='recibida';d.recBy=user.name;d.recAt=now();d.dif=dif;audit('DEVOLUCION_RECIBIDA',d.n+(dif.length?' · DIFERENCIA: '+dif.join(' · '):' · completa'));save();toast(d.n+' recibida'+(dif.length?' con diferencias':''),!!dif.length);rerender();}});};

/* ===================== Sprint 4 · torre de control: carga por zona y mapa, capacidad (kg y m³), picking consolidado con escaneo y planilla de liquidación ===================== */
let pvxTT='armar',pvxSel=new Set(),pvxPick=null;
/* peso: el cargado, o estimado del nombre («1 kg», «500 g», «2,25 lt», «473 ml») para no dejar la carga en cero */
function pvxKgEst(p){const t=String((p&&(p.name+' '+(p.sub||'')))||'').toLowerCase().replace(',','.');const m=/(\d+(?:\.\d+)?)\s*(kg|kilo|g|gr|grs|l|lt|lts|litro|ml|cc)\b/.exec(t);if(!m)return 0;const n=+m[1];const u=m[2];
 return u==='kg'||u==='kilo'||u==='l'||u==='lt'||u==='lts'||u==='litro'?n:Math.round(n/1000*1000)/1000;}
const pvxKg=p=>+(p&&p.kg)||pvxKgEst(p),pvxM3=p=>+(p&&p.m3)||0;
function pvxCarga(ids){let kg=0,m3=0,sin=0;ids.map(repEnv).filter(Boolean).forEach(e=>e.items.forEach(i=>{if(i.pid==='p_envio')return;const p=prod(i.pid);if(!(+p.kg)&&!pvxM3(p))sin++;kg+=pvxKg(p)*i.qty;m3+=pvxM3(p)*i.qty;}));return{kg:Math.round(kg*10)/10,m3:Math.round(m3*1000)/1000,sin};}
function pvxCapBar(v,max,u){if(!(max>0))return`<span class="sm mut">${numAR(v,3)} ${u} (cargá la capacidad del vehículo)</span>`;const p=Math.round(v/max*100);const col=p>100?'#d93025':p>85?'#f2a900':'#1e8e3e';
 return`<div class="sm">${numAR(v,3)} de ${numAR(max,3)} ${u} · <b style="color:${col}">${p}%</b>${p>100?' · SUPERA la capacidad':''}</div><div class="pvx-cap"><i style="width:${Math.min(100,p)}%;background:${col}"></i></div>`;}
function pvxListos(){return(S.envios||[]).filter(e=>e.estado==='listo'&&!e.rutaId);}
function pvxArmarHTML(){const L=pvxListos();const c=repCfg();[...pvxSel].forEach(id=>{if(!L.some(e=>e.id===id))pvxSel.delete(id);});
 const zonas=[...new Set(L.map(e=>e.zona||''))];const zn=z=>(c.zonas.find(x=>x.id===z)||{}).nombre||'Sin zona';const COL=['#1a73e8','#e8710a','#188038','#a142f4','#d93025','#007b83'];const zc=z=>COL[Math.max(0,zonas.indexOf(z))%COL.length];
 const pts=L.filter(e=>e.cli.lat!=null&&e.cli.lng!=null).map(e=>({lat:e.cli.lat,lng:e.cli.lng,label:(pvxSel.has(e.id)?'✓ ':'')+'#'+e.n,color:pvxSel.has(e.id)?'#111':zc(e.zona)}));
 const sel=[...pvxSel];const K=pvxCarga(sel);const reps=repRepsAct();const rp=reps.find(r=>r.id===pvxGet('repSel'))||reps.find(r=>!repOcupado(r.id))||reps[0];
 return`<p class="sm mut">Pedidos «Listos para salir». Elegí por zona o uno por uno, mirá la capacidad del vehículo y armá la hoja de ruta (el orden de paradas se calcula solo).</p>
 ${pts.length?gpsMapHTML(pts,Math.max(260,Math.min(900,(window.innerWidth||900)-60)),300):''}
 <div class="row" style="flex-wrap:wrap;gap:.4rem;margin:.6rem 0">${zonas.map(z=>`<button class="btn sm" data-act="pvxZona" data-z="${esc(z)}"><span class="pvx-dot" style="background:${zc(z)}"></span> ${esc(zn(z))} (${L.filter(e=>(e.zona||'')===z).length})</button>`).join('')}${L.length?'<button class="btn sm" data-act="pvxZona" data-z="*">Todos</button><button class="btn sm ghost" data-act="pvxZona" data-z="-">Ninguno</button>':''}</div>
 ${L.length?`<div class="tw"><table data-nosort><thead><tr><th></th><th>Envío</th><th>Cliente</th><th>Zona</th><th>Cobro</th><th class="r">Kg</th><th class="r">m³</th></tr></thead><tbody>${L.map(e=>{const k=pvxCarga([e.id]);return`<tr><td><input type="checkbox" class="pvx-ck" data-id="${e.id}" ${pvxSel.has(e.id)?'checked':''} aria-label="Elegir envío ${esc(e.n)}" style="width:22px;min-height:22px"></td><td>#${esc(e.n)}${e.ordN?'<div class="sm mut">'+esc(e.ordN)+'</div>':''}</td><td>${esc(e.cli.nombre)}<div class="sm mut">${esc(repDirTxt(e)||'')}</div></td><td>${esc(zn(e.zona))}</td><td>${repBadgeCobro(e)}</td><td class="r">${k.kg||'—'}</td><td class="r">${k.m3||'—'}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="okbox">No hay pedidos listos para salir. Mandalos desde Pedidos de venta («🚚 Mandar a reparto») o desde la bandeja de Reparto.</div>'}
 ${sel.length?`<div class="card" style="margin-top:.6rem"><div class="row"><b class="sp">${sel.length} envío(s) elegidos</b><label for="pvx-rep" class="sm">Vehículo</label><select id="pvx-rep" style="max-width:220px">${reps.map(r=>`<option value="${esc(r.id)}" ${rp&&rp.id===r.id?'selected':''}>${esc(r.nombre)}${r.veh?' · '+esc(r.veh):''}</option>`).join('')}</select></div>
  ${pvxCapBar(K.kg,rp&&+rp.kg,'kg')}${pvxCapBar(K.m3,rp&&+rp.m3,'m³')}${K.sin?`<p class="sm mut">${K.sin} renglón(es) con peso estimado por el nombre del artículo y sin volumen: cargalos en «Vehículos y pesos» para que el control sea exacto.</p>`:''}
  <div class="row" style="gap:.5rem;margin-top:.5rem"><button class="btn" data-act="pvxPickSel">📋 Picking consolidado</button><span class="sp"></span><button class="btn gold" data-act="pvxCrearRuta">Armar hoja de ruta</button></div></div>`:''}`;}
A.pvxZona=el=>{const z=el.dataset.z;const L=pvxListos();if(z==='-')pvxSel.clear();else L.filter(e=>z==='*'||(e.zona||'')===z).forEach(e=>pvxSel.add(e.id));rerender();};
A.pvxCrearRuta=()=>{const ids=[...pvxSel];if(!ids.length)return;const r=$('#pvx-rep');const rp=r&&repRep(r.value);const K=pvxCarga(ids);
 if(rp&&((+rp.kg>0&&K.kg>+rp.kg)||(+rp.m3>0&&K.m3>+rp.m3)))return confirmBox('Supera la capacidad',`La carga (${numAR(K.kg,3)} kg · ${numAR(K.m3,3)} m³) supera lo que lleva ${esc(rp.nombre)}. ¿Armarla igual?`,()=>repArmarModal(ids,rp.id),'Armar igual');repArmarModal(ids,rp?rp.id:'');};
/* picking consolidado: todos los artículos de los envíos elegidos (o de una hoja de ruta), ordenados por ubicación del depósito */
function pvxPickNew(ids,titulo){const ag={};ids.map(repEnv).filter(Boolean).forEach(e=>e.items.forEach(i=>{if(i.pid==='p_envio')return;const a=ag[i.pid]||(ag[i.pid]={pid:i.pid,name:i.name,qty:0,env:[]});a.qty=Math.round((a.qty+i.qty)*1000)/1000;a.env.push('#'+e.n);}));
 const L=Object.values(ag).map(a=>{const p=prod(a.pid)||{};return Object.assign(a,{loc:p.loc||'',rub:typeof rubName==='function'?rubName(p.rubro):'',code:p.barcode||p.code||'',ok:0});}).sort((a,b)=>(a.loc||'~').localeCompare(b.loc||'~')||a.rub.localeCompare(b.rub)||a.name.localeCompare(b.name));
 pvxPick={ts:now(),titulo,ids,L};pvxTT='picking';}
A.pvxPickSel=()=>{pvxPickNew([...pvxSel],'Carga de '+pvxSel.size+' envío(s)');rerender();};
function pvxPickHTML(){if(!pvxPick)return`<p class="sm mut">Elegí envíos en «Armar carga» y tocá «Picking consolidado», o abrí el picking de una hoja de ruta:</p>${(S.rutas||[]).filter(r=>['armada','en_curso'].includes(r.estado)).map(r=>`<button class="btn sm" style="margin:.2rem" data-act="pvxPickRuta" data-id="${esc(r.id)}">${esc(r.n)} · ${esc(r.repNom)} (${r.envios.length})</button>`).join('')||'<div class="okbox">No hay hojas de ruta armadas.</div>'}`;
 const P=pvxPick;const tot=P.L.length,ok=P.L.filter(a=>a.ok>=a.qty-1e-9).length;
 return`<div class="row"><b class="sp">${esc(P.titulo)} · ${ok} de ${tot} artículos cargados</b><button class="btn sm" data-act="pvxPickPrint">🖨️ Imprimir</button><button class="btn sm ghost" data-act="pvxPickFin">Cerrar</button></div>
 <div class="pvx-cap" style="margin:.4rem 0"><i style="width:${tot?Math.round(ok/tot*100):0}%;background:#1e8e3e"></i></div>
 <div class="pvx-search"><input id="pvx-scan" placeholder="Escaneá el código de barras (o escribilo y Enter)" autocomplete="off" inputmode="text" aria-label="Escanear artículo"></div>
 <div class="tw"><table data-nosort><thead><tr><th>Ubicación</th><th>Artículo</th><th>Código</th><th class="r">Cargar</th><th class="r">Cargado</th><th></th></tr></thead><tbody>${P.L.map((a,k)=>`<tr style="${a.ok>=a.qty-1e-9?'opacity:.55':''}"><td>${esc(a.loc||a.rub||'—')}</td><td><b>${esc(a.name)}</b><div class="sm mut">${esc(a.env.join(' '))}</div></td><td class="sm">${esc(a.code)}</td><td class="r"><b>${numAR(a.qty,3)}</b></td><td class="r ${a.ok>a.qty+1e-9?'neg':''}">${numAR(a.ok,3)}</td>
  <td class="r"><button class="btn sm" data-act="pvxPickOk" data-k="${k}" aria-label="Marcar ${esc(a.name)} completo">${a.ok>=a.qty-1e-9?'✓':'Todo'}</button></td></tr>`).join('')}</tbody></table></div>
 ${ok===tot&&tot?'<div class="okbox">✓ Carga completa y controlada.</div>':''}`;}
A.pvxPickRuta=el=>{const r=repRuta(el.dataset.id);if(r)pvxPickNew(r.envios,'Hoja de ruta '+r.n+' · '+r.repNom);rerender();};
A.pvxPickOk=el=>{const a=pvxPick&&pvxPick.L[+el.dataset.k];if(!a)return;a.ok=a.ok>=a.qty-1e-9?0:a.qty;rerender();};
A.pvxPickFin=()=>{if(pvxPick){const ok=pvxPick.L.filter(a=>a.ok>=a.qty-1e-9).length;audit('PICKING',pvxPick.titulo+' · '+ok+' de '+pvxPick.L.length+' artículos controlados');}pvxPick=null;save();rerender();};
A.pvxPickPrint=()=>{const P=pvxPick;if(!P)return;vbPrint(vbDoc('Picking',`<h1>Lista de carga consolidada</h1><div class="mut">${esc(P.titulo)} · ${fmtDT(P.ts)}</div><table><thead><tr><th>✓</th><th>Ubicación</th><th>Artículo</th><th>Código</th><th class="r">Cantidad</th><th>Envíos</th></tr></thead><tbody>${P.L.map(a=>`<tr><td>☐</td><td>${esc(a.loc||a.rub||'')}</td><td>${esc(a.name)}</td><td>${esc(a.code)}</td><td class="r">${numAR(a.qty,3)}</td><td>${esc(a.env.join(' '))}</td></tr>`).join('')}</tbody></table><div class="sig"><div>Armó</div><div>Controló</div><div>Chofer</div></div>`));};
function pvxScan(code){if(!pvxPick)return;code=String(code||'').trim();if(!code)return;let a=pvxPick.L.find(x=>x.code&&x.code===code);let mult=1;
 if(!a){for(const x of pvxPick.L){const p=prod(x.pid);const k=p&&(p.pres||[]).find(q=>q.barcode===code);if(k){a=x;mult=k.qty;break;}}}
 if(!a){toast('Ese código no está en esta carga.',1);if(navigator.vibrate)try{navigator.vibrate([80,60,80]);}catch(e){}return;}
 a.ok=Math.round((a.ok+mult)*1000)/1000;if(a.ok>a.qty+1e-9)toast('¡Ojo! '+a.name+': cargaste '+a.ok+' y van '+a.qty+'.',1);else toast(a.name+': '+a.ok+' de '+a.qty);rerender();setTimeout(()=>{const i=$('#pvx-scan');if(i)i.focus();},60);}
/* liquidación imprimible de cada hoja de ruta rendida */
function pvxLiqHTML(){const L=(S.rendRep||[]).slice().reverse().slice(0,40);return L.length?`<div class="tw"><table><thead><tr><th>Fecha</th><th>Ruta</th><th>Repartidor</th><th class="r">A rendir</th><th class="r">Contado</th><th class="r">Diferencia</th><th></th></tr></thead><tbody>${L.map(x=>`<tr><td>${fmtDT(x.ts)}</td><td>${esc(x.n)}</td><td>${esc(x.repNom)}</td><td class="r">${money(x.esperado)}</td><td class="r">${money(x.contado)}</td><td class="r ${x.dif<0?'neg':''}">${x.dif?money(x.dif):'✓'}</td><td class="r"><button class="btn sm" data-act="pvxLiq" data-id="${esc(x.ruta)}">🖨️ Planilla</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="mut">Todavía no hay rutas rendidas.</p>';}
A.pvxLiq=el=>{const r=repRuta(el.dataset.id);const x=r&&(S.rendRep||[]).find(y=>y.id===r.rend);if(!r||!x)return;const E=(x.envSnap||r.envios.map(repEnv)).filter(Boolean);const sum=f=>E.reduce((a,e)=>a+f(e),0);
 const cb=e=>(e.ent&&e.ent.cobrado)||null;const por=m=>sum(e=>e.estado==='entregado'&&cb(e)&&cb(e).modo===m?cb(e).monto:0);
 const fact=sum(e=>e.estado==='entregado'?(e.totalOrig||e.total):0),rech=sum(e=>e.ent&&e.ent.rech?e.ent.rech.monto:0),cc=sum(e=>e.estado==='entregado'&&e.cobro.modo==='cc'?e.total:0),pag=sum(e=>e.estado==='entregado'&&e.cobro.modo==='pagado'?e.total:0);
 const valores=por('efectivo')+por('transferencia')+por('cheque')+por('billetera')+por('digital');
 vbPrint(vbDoc('Liquidación '+x.n,`<h1>Liquidación de hoja de ruta ${esc(x.n)}</h1><div class="mut">${esc(vbShop().name)} · ${esc(x.repNom)} · salida ${r.salida?fmtDT(r.salida):'—'} · rendición ${fmtDT(x.ts)} · recibió ${esc(x.by||'')}</div>
 <table><thead><tr><th>Envío</th><th>Cliente</th><th>Estado</th><th>Recibió</th><th class="r">Pedido</th><th class="r">Rechazo</th><th>Cobro</th><th class="r">Cobrado</th></tr></thead><tbody>${E.map(e=>{const c=cb(e);return`<tr><td>#${esc(e.n)}</td><td>${esc(e.cli.nombre)}</td><td>${esc(REP_EST[e.estado]||e.estado)}</td><td>${e.ent&&e.ent.recibe?esc(e.ent.recibe.nombre)+' · DNI '+esc(e.ent.recibe.dni):'—'}</td><td class="r">${money(e.totalOrig||e.total)}</td><td class="r">${e.ent&&e.ent.rech?money(e.ent.rech.monto):'—'}</td><td>${e.cobro.modo==='cc'?'Cuenta corriente':e.cobro.modo==='pagado'?'Ya pagado':c?esc(c.modo)+(c.ref?' '+esc(c.ref):''):'—'}</td><td class="r">${c?money(c.monto):'—'}</td></tr>`;}).join('')}</tbody></table>
 <table style="margin-top:10px"><tbody><tr><td>Total entregado (pedidos)</td><td class="r">${money(fact)}</td></tr><tr><td>− Rechazos en puerta</td><td class="r">${money(rech)}</td></tr><tr><td>− Cuenta corriente</td><td class="r">${money(cc)}</td></tr><tr><td>− Ya pagado</td><td class="r">${money(pag)}</td></tr>
 <tr><th>= Valores a rendir</th><th class="r">${money(fact-rech-cc-pag)}</th></tr><tr><td>Efectivo · transferencias · cheques · billeteras</td><td class="r">${money(por('efectivo'))} · ${money(por('transferencia')+por('digital'))} · ${money(por('cheque'))} · ${money(por('billetera'))} = ${money(valores)}</td></tr>
 <tr><td>Cambio inicial</td><td class="r">${money(x.cambio)}</td></tr><tr><td>Efectivo esperado · contado en caja</td><td class="r">${money(x.esperado)} · ${money(x.contado)}</td></tr><tr><th>Diferencia</th><th class="r">${x.dif?money(x.dif):'Sin diferencia'}</th></tr></tbody></table>
 <div class="sig"><div>Repartidor</div><div>Tesorería / caja</div></div>`));};
/* vehículos (capacidad) y pesos de los artículos que salen en reparto */
function pvxVehHTML(){const R=repRepsAct();const P=[...new Set((S.envios||[]).filter(e=>['nuevo','preparando','listo','en_ruta'].includes(e.estado)).flatMap(e=>e.items.map(i=>i.pid)))].map(prod).filter(p=>p&&p.id!=='p_envio');
 const falt=P.filter(p=>!pvxKg(p)&&!pvxM3(p));const L=falt.concat(P.filter(p=>!falt.includes(p))).slice(0,120);
 return`<h3>Vehículos</h3><div class="tw"><table data-nosort><thead><tr><th>Repartidor / vehículo</th><th class="r">Carga máx. (kg)</th><th class="r">Volumen máx. (m³)</th></tr></thead><tbody>${R.map(r=>`<tr><td>${esc(r.nombre)}${r.veh?' · '+esc(r.veh):''}</td><td class="r"><input class="pvx-vf" data-id="${esc(r.id)}" data-k="kg" inputmode="decimal" value="${esc(String(r.kg||'').replace('.',','))}" style="width:6rem" aria-label="Kg de ${esc(r.nombre)}"></td><td class="r"><input class="pvx-vf" data-id="${esc(r.id)}" data-k="m3" inputmode="decimal" value="${esc(String(r.m3||'').replace('.',','))}" style="width:6rem" aria-label="m³ de ${esc(r.nombre)}"></td></tr>`).join('')}</tbody></table></div>
 <h3>Peso y volumen por unidad</h3><p class="sm mut">${falt.length?falt.length+' artículo(s) que salen en reparto no tienen peso ni volumen.':'Todos los artículos en reparto tienen peso o volumen.'} También se usa la ubicación del depósito para ordenar el picking.</p>
 <div class="tw"><table data-nosort><thead><tr><th>Artículo</th><th class="r">Kg por unidad</th><th class="r">m³ por unidad</th><th>Ubicación</th></tr></thead><tbody>${L.map(p=>`<tr><td>${esc(pfull(p))}</td><td class="r"><input class="pvx-pf" data-id="${p.id}" data-k="kg" inputmode="decimal" value="${esc(String(p.kg||'').replace('.',','))}" style="width:6rem"></td><td class="r"><input class="pvx-pf" data-id="${p.id}" data-k="m3" inputmode="decimal" value="${esc(String(p.m3||'').replace('.',','))}" style="width:6rem"></td><td><input class="pvx-pf" data-id="${p.id}" data-k="loc" maxlength="20" value="${esc(p.loc||'')}" placeholder="Ej.: A-03" style="width:7rem"></td></tr>`).join('')||'<tr><td colspan="4" class="mut">No hay envíos activos.</td></tr>'}</tbody></table></div>`;}
reg('carga','Armado de cargas','truck','reparto',()=>{pvxCss();const tabs=[['armar','Armar carga ('+pvxListos().length+')'],['picking','Picking'+(pvxPick?' ●':'')],['liq','Liquidaciones'],['veh','Vehículos y pesos']];
 return`<div class="row"><h1 class="sp">Armado de cargas</h1><a class="btn sm" href="#panel/reparto">Reparto</a><a class="btn sm" href="#panel/devoluciones">Devoluciones</a></div>
 <div class="ux-tabs" role="tablist">${tabs.map(([k,t])=>`<a role="tab" tabindex="0" data-act="pvxTT" data-t="${k}" aria-selected="${pvxTT===k}" class="${pvxTT===k?'on':''}">${t}</a>`).join('')}</div><div style="margin-top:.6rem">${pvxTT==='picking'?pvxPickHTML():pvxTT==='liq'?pvxLiqHTML():pvxTT==='veh'?pvxVehHTML():pvxArmarHTML()}</div>`;},
 ()=>{$$('.pvx-ck').forEach(i=>i.addEventListener('change',()=>{if(i.checked)pvxSel.add(i.dataset.id);else pvxSel.delete(i.dataset.id);rerender();}));const r=$('#pvx-rep');if(r)r.addEventListener('change',()=>{pvxSet('repSel',r.value);rerender();});
  const sc=$('#pvx-scan');if(sc){sc.focus();sc.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const v=sc.value;sc.value='';pvxScan(v);}});}
  const num=v=>{const n=+String(v||'').replace(',','.');return isFinite(n)&&n>=0?Math.round(n*1000)/1000:0;};
  $$('.pvx-vf').forEach(i=>i.addEventListener('change',()=>{const r=repRep(i.dataset.id);if(!r)return;r[i.dataset.k]=num(i.value);audit('VEHICULO_CAPACIDAD',r.nombre+' · '+i.dataset.k+' '+r[i.dataset.k]);save();}));
  $$('.pvx-pf').forEach(i=>i.addEventListener('change',()=>{const p=prod(i.dataset.id);if(!p)return;if(i.dataset.k==='loc')p.loc=i.value.replace(/[<>]/g,'').slice(0,20);else p[i.dataset.k]=num(i.value);save();}));},'Operación');
SCREENS.carga.show=()=>typeof repOn==='function'&&repOn();NAV.push(['carga','Operación']);
A.pvxTT=el=>{pvxTT=el.dataset.t;rerender();};

/* ===================== Sprint 5 · WhatsApp, PDF con QR de seguimiento y venta sugerida ===================== */
const pvxTok=()=>typeof repTok==='function'?repTok():Array.from(crypto.getRandomValues(new Uint8Array(18)),b=>'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789_-'[b%62]).join('');
function pvxSegUrl(o){if(!o.tok){const e=typeof vbEnvOf==='function'?vbEnvOf(o):null;o.tok=e&&e.tok?e.tok:pvxTok();save();}return location.origin+location.pathname+'#seg/'+o.tok+'/'+encodeURIComponent(o.n);}
function pvxWaTxt(o){const s=typeof vbShop==='function'?vbShop():{name:S.tenant.name};const c=custById(o.cust)||{};
 return`Hola ${String(c.name||o.custName||'').split(' ')[0]}! Te confirmamos el pedido *${o.n}* de *${s.name}*:\n\n${o.items.map(i=>`• ${numAR(i.qty,3)} × ${i.name} — ${money(i.amt||Math.round(i.qty*i.price))}`).join('\n')}\n\n*Total: ${money(o.total)}* (${o.cond==='cc'?'cuenta corriente':'contado, se abona al recibir'})${o.deliv?'\nEntrega: '+dmy(o.deliv):''}\n\nSeguí tu pedido acá: ${pvxSegUrl(o)}\n\nLos precios se confirman al facturar.`;}
A.pvxWA=el=>{const o=vbOrd(el.dataset.id);if(!o)return;const c=custById(o.cust)||{};const num=String(c.wa||'').replace(/\D/g,'');const t=pvxWaTxt(o);
 const url=num?'https://wa.me/'+(num.length<=10?'549'+num:num)+'?text='+encodeURIComponent(t):'https://wa.me/?text='+encodeURIComponent(t);audit('PEDIDO_WHATSAPP',o.n+' · '+o.custName+(num?'':' · sin número cargado'));window.open(url,'_blank','noopener');};
A.pvxPDF=el=>{const o=vbOrd(el.dataset.id);if(!o)return;const url=pvxSegUrl(o);let h=vbOrderDoc(o);const qr=typeof QR!=='undefined'&&QR.svg?QR.svg(url,3,1):'';
 h=h.replace('<p class="mut">Los precios se confirman',`<div style="display:flex;gap:14px;align-items:center;margin:12px 0;border:1px solid #ccc;border-radius:8px;padding:8px"><div style="width:110px;height:110px">${qr}</div><div><b>Seguimiento del pedido</b><br><span style="font-size:9pt;word-break:break-all">${esc(url)}</span><br><span class="mut">Escaneá el código para ver en qué estado está.</span></div></div><p class="mut">Los precios se confirman`);vbPrint(h);};
/* venta sugerida: lo que el cliente compra con frecuencia y hoy no está en el pedido (historial de 90 días, sin IA paga) */
function pvxSugeridos(cid,d){const lim=now()-90*864e5;const H={};const add=(pid,ts,q)=>{(H[pid]=H[pid]||[]).push({ts,q});};
 vbArr('sordr').filter(o=>o.cust===cid&&o.ts>=lim&&o.state!=='anulado').forEach(o=>o.items.forEach(i=>add(i.pid,o.ts,i.qty)));
 (S.sales||[]).filter(s=>s.cust===cid&&s.ts>=lim&&s.status!=='anulada'&&!s.ord).forEach(s=>(s.lines||s.items||[]).forEach(l=>add(l.pid,s.ts,l.qty)));
 const out=[];for(const [pid,L] of Object.entries(H)){if(d&&d.items.some(i=>i.pid===pid))continue;const p=prod(pid);if(!p||p.active===false||p.archived||pid==='p_envio')continue;
  const days=[...new Set(L.map(x=>dkey(x.ts)))].sort();if(days.length<2)continue;const t=days.map(k=>new Date(k+'T12:00').getTime());const gaps=t.slice(1).map((x,i)=>(x-t[i])/864e5);
  const cada=Math.max(1,Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length));const hace=Math.round((now()-t[t.length-1])/864e5);if(hace<cada*0.8)continue;
  const qs=L.map(x=>x.q).sort((a,b)=>a-b);const qty=qs[Math.floor(qs.length/2)];out.push({p,qty,cada,hace,score:hace/cada,txt:`Suele llevar ${pfull(p)} cada ${cada} día${cada>1?'s':''} (último hace ${hace}) y hoy no está.`});}
 return out.sort((a,b)=>b.score-a.score).slice(0,3);}


/* ===================== V27.16 · nube (sólo con el SQL 34 aplicado): colecciones nuevas y fotos en Storage privado ===================== */
/* las fichas viajan con la sincronización de siempre; las imágenes suben al bucket privado «evidencias» y se ven con enlaces firmados de 10 minutos */
const PVX34_COLS=[{c:'cambio',key:'cambios',pii:['custName']},{c:'evid',key:'evid',once:1,pii:['lat','lng','uName']},{c:'clog',key:'campoLog',once:1,pii:['lat','lng','uName']},{c:'devt',key:'devTransito',pii:['custName']},{c:'aviso',key:'avisos'}];
let vb34=false,vb34At=0;
const pvxNube=()=>typeof CLOUD!=='undefined'&&CLOUD.on&&typeof cl!=='undefined'&&cl.ready&&cl.comercio&&vb34;
function vb34Enable(){if(vb34||typeof COLS==='undefined')return;PVX34_COLS.forEach(x=>{if(!COLS.some(y=>y.c===x.c)){COLS.push(x);BYC[x.c]=x;if(x.del)DELC.add(x.c);}});vb34=true;setTimeout(pvxSubirPend,2000);}
if(typeof pushAll==='function'){const _pa34=pushAll;pushAll=async function(){if(!vb34&&typeof cl!=='undefined'&&cl.comercio&&Date.now()-vb34At>600000){vb34At=Date.now();
  try{const v=await rpc('vb_version',{});if(+v>=34)vb34Enable();}catch(e){}}return _pa34.apply(this,arguments);};}
const pvxSubidas=()=>pvxGet('subidas')||{};
let pvxSubiendo=false;
async function pvxSubirPend(){if(!pvxNube()||pvxSubiendo||!navigator.onLine)return;pvxSubiendo=true;try{const up=pvxSubidas();
 for(const ev of vbArr('evid').filter(x=>x.path&&!up[x.id]).slice(-30)){const d=await pvxFotoGet(ev.id);if(!d)continue; /* la foto está en otro equipo */
  const t=await accessToken();if(!t)break;const mime=(/^data:([^;]+);/.exec(d)||[])[1]||'image/jpeg';const bin=atob(d.split(',')[1]);const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  let r;try{r=await fetch(CLOUD.url+'/storage/v1/object/evidencias/'+ev.path,{method:'POST',headers:{apikey:CLOUD.key,Authorization:'Bearer '+t,'Content-Type':mime,'x-upsert':'false','cache-control':'31536000'},body:new Blob([u8],{type:mime})});}catch(e){break;}
  if(r.ok||r.status===409||(r.status===400&&/exist/i.test(await r.text().catch(()=>''))))up[ev.id]=now();else if(r.status===401||r.status===403){audit('EVIDENCIA_SUBIDA_RECHAZADA',ev.id+' · '+r.status);up[ev.id]=-1;}}
 pvxSet('subidas',up);}finally{pvxSubiendo=false;}}
setInterval(()=>{if(user)pvxSubirPend();},90000);window.addEventListener('online',()=>setTimeout(pvxSubirPend,1500));
const PVX_URLS={};
async function pvxFotoNube(ev){if(!ev||!ev.path||!pvxNube())return null;const c=PVX_URLS[ev.id];if(c&&c.exp>Date.now())return c.url;
 try{const t=await accessToken();if(!t)return null;const r=await fetch(CLOUD.url+'/storage/v1/object/sign/evidencias/'+ev.path,{method:'POST',headers:{apikey:CLOUD.key,Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:600})});
  if(!r.ok)return null;const j=await r.json();const u=j&&(j.signedURL||j.signedUrl);if(!u)return null;const url=CLOUD.url+'/storage/v1'+(u.startsWith('/')?u:'/'+u);PVX_URLS[ev.id]={url,exp:Date.now()+540000};return url;}catch(e){return null;}}
