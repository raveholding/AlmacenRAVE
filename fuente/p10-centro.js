/* ===================================================================================================
   V26.39 · CENTRO INTELIGENTE — tablero oscuro con los colores de RAVE (carbón y dorado), local 3D con el equipo
   trabajando, Gerente IA (texto y voz) y actividad de cada persona. Módulo aislado, apagado por defecto.
   · Sólo LECTURA: nunca escribe ventas, caja, stock, clientes ni movimientos. Sus únicas escrituras son su propia
     configuración (S.cfg.ci: encendido, roles que lo ven, voz y la función asignada a cada persona), por el
     administrador, auditadas.
   · Aislado: objeto CI, clases «ci-», estilos inyectados recién al abrir y siempre bajo .ci-root (variables propias
     --ci-*; no toca las del sistema). Sin librerías (la CSP no las permite): el 3D es un dibujo isométrico propio.
   · Si falla, se apaga solo (CI.safe) y deja el error en su Registro; el resto del sistema sigue funcionando.
   · La animación corre sólo con la pantalla abierta y visible, a ~15 cuadros por segundo, y se detiene con
     «reducir movimiento» del sistema operativo.
   =================================================================================================== */
(function(){
'use strict';
const CI={ver:'2.0',log:[],st:{mode:'3d',rot:0,sel:null,chat:[],listen:false,mute:false},_hits:[]};
window.CI=CI;
const LOGK='rave.ci.log';
try{const o=JSON.parse(localStorage.getItem(LOGK)||'[]');if(Array.isArray(o))CI.log=o.slice(-200);}catch(e){}
function logEv(kind,msg){try{CI.log.push({ts:Date.now(),kind:String(kind),msg:String(msg).slice(0,240),u:(typeof user!=='undefined'&&user)?user.name:''});if(CI.log.length>200)CI.log.splice(0,CI.log.length-200);try{localStorage.setItem(LOGK,JSON.stringify(CI.log));}catch(e){}}catch(e){}}
function safe(fn,fb,where){try{return fn();}catch(e){logEv('error',(where?where+': ':'')+(e&&e.message||e));try{console.warn('[Centro Inteligente]',e);}catch(_){}return fb;}}
CI.safe=safe;
const cfg=()=>(typeof S!=='undefined'&&S&&S.cfg&&S.cfg.ci)||{};
const isAdm=()=>typeof user!=='undefined'&&!!user&&user.role==='admin';
const isOn=()=>!!cfg().on;
const allowed=()=>{if(typeof user==='undefined'||!user)return false;if(isAdm())return true;return isOn()&&(cfg().roles||[]).includes(user.role);};
const seeTeam=()=>isAdm()||(typeof can==='function'&&can('staff'));
CI.isOn=isOn;CI.allowed=allowed;
const E=v=>typeof esc==='function'?esc(v):String(v);
const $m=c=>typeof money==='function'?money(c):String(c);
const col=c=>/^#[0-9a-fA-F]{6}$/.test(String(c||''))?c:'#8a6fb0';
const nf=v=>String(v).replace('.',',');
const hm=ts=>{try{return new Date(ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});}catch(e){return'';}};
const pct=(a,b)=>b?Math.round((a-b)/b*100):null;

/* ---------- estilos encapsulados: sólo dentro de .ci-root, con variables propias (no cambia las del sistema) ---------- */
function css(){if(document.getElementById('ci-style'))return;const s=document.createElement('style');s.id='ci-style';s.textContent=`
.ci-root{--ci-bg:#171512;--ci-pan:#221f1b;--ci-pan2:#2b2722;--ci-ln:rgba(201,150,62,.30);--ci-tx:#f4efe6;--ci-mut:#bcb2a3;--ci-acc:var(--gold,#c9963e);--ci-ok:#3ccf7e;--ci-bad:#ff6b5b;--ci-warn:#f2b632;--ci-r:16px;
 background:radial-gradient(1200px 500px at 30% -10%,rgba(201,150,62,.16),transparent 60%),var(--ci-bg);color:var(--ci-tx);border-radius:20px;padding:14px;margin:-4px 0 8px}
.ci-root h1,.ci-root h2,.ci-root h3{color:var(--ci-tx);margin:0}
.ci-root .ci-mut{color:var(--ci-mut)}
.ci-root .ci-pan{background:linear-gradient(180deg,var(--ci-pan2),var(--ci-pan));border:1px solid var(--ci-ln);border-radius:var(--ci-r);box-shadow:0 0 0 1px rgba(0,0,0,.25),0 8px 24px rgba(0,0,0,.25)}
.ci-root .ci-btn{min-height:44px;min-width:44px;padding:.45rem .8rem;border-radius:12px;border:1px solid var(--ci-ln);background:var(--ci-pan2);color:var(--ci-tx);font:600 .9rem inherit;cursor:pointer}
.ci-root .ci-btn:hover,.ci-root .ci-btn:focus-visible{border-color:var(--ci-acc);outline:none;box-shadow:0 0 0 2px rgba(201,150,62,.35)}
.ci-root .ci-btn.on{background:var(--ci-acc);color:#1b1813;border-color:var(--ci-acc)}
.ci-root .ci-btn.ci-rec{background:var(--ci-bad);color:#fff;border-color:var(--ci-bad)}
.ci-root .ci-top{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;margin-bottom:12px}
.ci-root .ci-brand{display:flex;align-items:center;gap:.6rem;flex:1 1 260px}
.ci-root .ci-brand svg{width:44px;height:44px;color:var(--ci-acc);filter:drop-shadow(0 0 8px rgba(201,150,62,.55))}
.ci-root .ci-brand b{display:block;font:800 1.35rem Georgia,serif;letter-spacing:.5px}
.ci-root .ci-live{display:inline-flex;align-items:center;gap:.35rem;font-size:.82rem;color:var(--ci-mut)}
.ci-root .ci-dotl{width:.6rem;height:.6rem;border-radius:50%;background:var(--ci-ok);box-shadow:0 0 8px var(--ci-ok)}
.ci-root .ci-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
@media (max-width:900px){.ci-root .ci-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
.ci-root .ci-kpi{display:flex;gap:.7rem;align-items:center;padding:.7rem .8rem;min-width:0}
.ci-root .ci-kic{flex:0 0 44px;height:44px;border-radius:12px;display:grid;place-items:center;color:#1b1813}
.ci-root .ci-kic svg{width:26px;height:26px}
.ci-root .ci-kpi span{display:block;font-size:.8rem;color:var(--ci-mut)}
.ci-root .ci-kpi b{display:block;font-size:1.3rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ci-root .ci-up{color:var(--ci-ok)}.ci-root .ci-dn{color:var(--ci-bad)}.ci-root .ci-wn{color:var(--ci-warn)}
.ci-root .ci-main{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:12px;align-items:stretch}
@media (max-width:1100px){.ci-root .ci-main{grid-template-columns:minmax(0,1fr)}}
.ci-root .ci-stage{position:relative;overflow:hidden;min-width:0;display:flex;flex-direction:column}
.ci-root .ci-stage:fullscreen{border-radius:0;background:var(--ci-bg)}
.ci-root .ci-sbar{position:absolute;left:10px;right:10px;top:10px;display:flex;gap:.4rem;align-items:center;z-index:1;pointer-events:none;flex-wrap:wrap}
.ci-root .ci-sbar>*{pointer-events:auto}
.ci-root .ci-stitle{background:rgba(23,21,18,.82);border:1px solid var(--ci-ln);border-radius:12px;padding:.45rem .7rem;font-weight:700;font-size:.9rem;margin-right:auto}
.ci-root canvas.ci-cv{display:block;width:100%;flex:1 1 auto;min-height:480px;height:480px;touch-action:manipulation;cursor:pointer}
.ci-root .ci-stage:fullscreen canvas.ci-cv{height:calc(100vh - 44px)}
@media (max-width:600px){.ci-root canvas.ci-cv{min-height:360px;height:360px}.ci-root .ci-sbar{position:static;padding:10px 10px 0}.ci-root .ci-stitle{flex:1 1 100%}}
@media (max-width:520px){.ci-root .ci-kic{flex-basis:34px;height:34px}.ci-root .ci-kic svg{width:20px;height:20px}.ci-root .ci-kpi{gap:.5rem;padding:.6rem}.ci-root .ci-kpi b{font-size:1.05rem}}
.ci-root .ci-legend{display:flex;gap:.8rem;flex-wrap:wrap;font-size:.78rem;color:var(--ci-mut);padding:.5rem .8rem;border-top:1px solid var(--ci-ln)}
.ci-root .ci-dot{display:inline-block;width:.7rem;height:.7rem;border-radius:50%;vertical-align:middle;margin-right:.3rem}
.ci-root .ci-gm{padding:.8rem;display:flex;flex-direction:column;gap:.55rem;min-width:0}
.ci-root .ci-gmh{display:flex;align-items:center;gap:.6rem}
.ci-root .ci-gmh h2{font-size:1.15rem;flex:1}
.ci-root .ci-bot{width:120px;height:132px;color:var(--ci-acc);filter:drop-shadow(0 0 14px rgba(201,150,62,.5));align-self:center;flex:0 0 auto}
.ci-root .ci-bot .ci-eye{transform-origin:center;transform-box:fill-box;animation:ci-blink 5s infinite}
.ci-root .ci-bot.ci-talk .ci-mouth{animation:ci-talk .35s infinite alternate;transform-origin:center;transform-box:fill-box}
@keyframes ci-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes ci-talk{from{transform:scaleY(.4)}to{transform:scaleY(1.1)}}
@media (prefers-reduced-motion:reduce){.ci-root .ci-bot .ci-eye,.ci-root .ci-bot.ci-talk .ci-mouth{animation:none}}
.ci-root .ci-bubble{background:#f4efe6;color:#1b1813;border-radius:14px;padding:.6rem .75rem;font-weight:600;font-size:.92rem}
.ci-root .ci-qb{display:flex;align-items:center;gap:.6rem;width:100%;text-align:left;min-height:48px}
.ci-root .ci-qb svg{width:22px;height:22px;color:var(--ci-acc);flex:0 0 22px}
.ci-root .ci-chips{display:flex;gap:.35rem;flex-wrap:wrap}
.ci-root .ci-chips .ci-btn{font-size:.8rem;padding:.35rem .6rem}
.ci-root .ci-chat{border:1px solid var(--ci-ln);border-radius:12px;background:rgba(0,0,0,.18);padding:.5rem;max-height:300px;overflow:auto;font-size:.88rem}
.ci-root .ci-msg{margin:.3rem 0;padding:.45rem .65rem;border-radius:12px}
.ci-root .ci-msg.ci-q{background:var(--ci-acc);color:#1b1813;margin-left:auto;width:fit-content;max-width:90%;font-weight:600}
.ci-root .ci-msg.ci-a{background:var(--ci-pan2);border:1px solid var(--ci-ln)}
.ci-root .ci-msg ul{margin:.3rem 0 .1rem 1.1rem;padding:0}
.ci-root .ci-ask{display:flex;gap:.4rem;flex-wrap:wrap}
.ci-root .ci-ask input{flex:1 1 140px;min-width:0;min-height:44px;background:var(--ci-bg);color:var(--ci-tx);border:1px solid var(--ci-ln);border-radius:12px;padding:0 .7rem}
.ci-root .ci-row2{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:12px}
@media (max-width:1100px){.ci-root .ci-row2{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.ci-root .ci-row2{grid-template-columns:minmax(0,1fr)}}
.ci-root .ci-card{padding:.75rem .85rem;min-width:0}
.ci-root .ci-card h3{font-size:1rem;margin-bottom:.4rem;display:flex;align-items:center;gap:.4rem}
.ci-root .ci-card svg.ci-ch{width:100%;height:auto;display:block}
.ci-root .ci-hb{display:grid;grid-template-columns:minmax(0,7rem) minmax(0,1fr) 3rem;gap:.4rem;align-items:center;font-size:.82rem;margin:.28rem 0}
.ci-root .ci-hb i{display:block;height:.6rem;border-radius:6px}.ci-root .ci-hb i.ci-dot{display:inline-block;height:.7rem;border-radius:50%}
.ci-root .ci-hb span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ci-root .ci-feed{list-style:none;margin:0;padding:0;font-size:.82rem}
.ci-root .ci-feed li{display:grid;grid-template-columns:1.4rem minmax(0,1fr) auto;gap:.4rem;align-items:center;padding:.3rem 0;border-bottom:1px solid rgba(201,150,62,.14)}
.ci-root .ci-feed li span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ci-root .ci-fi{width:1.2rem;height:1.2rem;border-radius:50%;display:grid;place-items:center;font-size:.7rem;font-weight:800;color:#1b1813}
.ci-root .ci-team{margin-top:12px;padding:.8rem}
.ci-root .ci-tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-top:.6rem}
.ci-root .ci-person{display:flex;flex-direction:column;gap:.35rem;padding:.7rem;border-radius:14px;background:var(--ci-pan2);border:1px solid var(--ci-ln);text-align:left;color:var(--ci-tx);cursor:pointer;min-height:44px;font:inherit}
.ci-root .ci-person:hover,.ci-root .ci-person:focus-visible{border-color:var(--ci-acc);outline:none}
.ci-root .ci-ph{display:flex;align-items:center;gap:.55rem}
.ci-root .ci-av{flex:0 0 40px;height:40px;border-radius:50%;display:grid;place-items:center;font-weight:800;box-shadow:0 0 0 2px rgba(0,0,0,.3),0 0 12px currentColor}
.ci-root .ci-ph b{display:block;line-height:1.2}
.ci-root .ci-fn{display:inline-block;font-size:.72rem;font-weight:700;padding:.1rem .45rem;border-radius:999px;color:#1b1813}
.ci-root .ci-ps{font-size:.8rem;color:var(--ci-mut)}
.ci-root .ci-pn{font-size:.85rem}
.ci-root table.ci-tb{width:100%;border-collapse:collapse;font-size:.84rem}
.ci-root table.ci-tb th,.ci-root table.ci-tb td{padding:.35rem .4rem;border-bottom:1px solid rgba(201,150,62,.18);text-align:left;color:var(--ci-tx)}
.ci-root table.ci-tb th{color:var(--ci-mut);font-weight:600}
.ci-root .ci-off{padding:1.1rem}
.ci-root .ci-off label,.ci-root .ci-vc label{color:var(--ci-tx)}
.ci-root .ci-vc{border:1px solid var(--ci-ln);border-radius:12px;padding:0 .6rem;background:rgba(0,0,0,.15)}
.ci-root .ci-vc p{font-size:.78rem;color:var(--ci-mut);margin:.1rem 0 .4rem}
.ci-root .ci-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ci-root .ci-neg{color:var(--ci-bad)}.ci-root .ci-low{color:var(--ci-warn)}
.ci-root .ci-ed{margin-top:12px;padding:.8rem}
.ci-root .ci-edg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-top:.6rem}
@media (max-width:800px){.ci-root .ci-edg{grid-template-columns:minmax(0,1fr)}}
.ci-root .ci-ed label{display:block;color:var(--ci-mut);font-size:.8rem;margin:.35rem 0 .15rem}
.ci-root .ci-ed input:not([type=color]),.ci-root .ci-ed select{min-height:44px;width:100%;background:var(--ci-bg);color:var(--ci-tx);border:1px solid var(--ci-ln);border-radius:10px;padding:0 .55rem;font:inherit}
.ci-root .ci-ed input[type=color]{min-height:44px;width:100%;background:var(--ci-bg);border:1px solid var(--ci-ln);border-radius:10px}
.ci-root .ci-ed2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem}
.ci-root .ci-adds{display:flex;gap:.35rem;flex-wrap:wrap}
.ci-root .ci-adds .ci-btn{font-size:.8rem}
.ci-root .ci-elist{max-height:260px;overflow:auto;border:1px solid var(--ci-ln);border-radius:12px;margin-top:.4rem}
.ci-root .ci-elist button{display:flex;width:100%;justify-content:space-between;gap:.5rem;border:0;border-bottom:1px solid rgba(201,150,62,.15);background:transparent;color:var(--ci-tx);min-height:44px;padding:0 .7rem;text-align:left;font:inherit;cursor:pointer}
.ci-root .ci-elist button.on{background:rgba(201,150,62,.18)}
.ci-root .ci-pad{display:grid;grid-template-columns:repeat(3,48px);gap:4px;justify-content:start;margin-top:.4rem}
.ci-root .ci-edf{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.8rem;padding-top:.7rem;border-top:1px solid var(--ci-ln)}
.ci-root details>summary{cursor:pointer;min-height:44px;display:flex;align-items:center;color:var(--ci-mut)}
.ci-root .ci-wave{display:inline-flex;gap:3px;align-items:center;height:20px;margin-left:.4rem}
.ci-root .ci-wave i{display:block;width:3px;height:6px;background:var(--ci-acc);border-radius:2px;animation:ci-wv .8s infinite alternate}
.ci-root .ci-wave i:nth-child(2){animation-delay:.15s}.ci-root .ci-wave i:nth-child(3){animation-delay:.3s}.ci-root .ci-wave i:nth-child(4){animation-delay:.45s}
@keyframes ci-wv{to{height:18px}}
@media (prefers-reduced-motion:reduce){.ci-root .ci-wave i{animation:none;height:12px}}
`;document.head.appendChild(s);}

/* ---------- íconos propios del módulo ---------- */
const ICN={sales:'M4 20V10M10 20V4M16 20v-7M22 20H2',ticket:'M3 17l6-6 4 4 8-8M15 7h6v6',box:'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',alert:'M12 3l10 18H2zM12 10v5M12 18h.01',cart:'M3 4h2l2.4 11h10.2L20 7H6M9 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01',
 search:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',pie:'M12 3v9h9M12 3a9 9 0 1 0 9 9',team:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9',mic:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3'};
const ic=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICN[n]}"/></svg>`;

/* ---------- datos: SÓLO LECTURA ---------- */
const ok=s=>s&&s.status==='ok';
const pays=s=>(typeof salePays==='function'?salePays(s):[{m:s.method,a:s.total}]);
function D(){const now0=typeof now==='function'?now():Date.now();const tk=dkey(now0);const yk=dkey(now0-86400000);
 const rubs=(S.rubros||[]).filter(r=>r.kind==='rubro');const prods=(S.products||[]).filter(p=>!p.archived&&p.active!==false);
 const sold={},sold7={},rubToday={},days={},pm={};let tot=0,n=0,totY=0,nY=0;const d7=now0-7*86400000;
 for(let i=6;i>=0;i--)days[dkey(now0-i*86400000)]=0;
 (S.sales||[]).forEach(s=>{if(!ok(s))return;const k=dkey(s.ts);if(k in days)days[k]+=s.total;
  if(k===tk){tot+=s.total;n++;(s.items||[]).forEach(it=>{sold[it.pid]=(sold[it.pid]||0)+(+it.qty||0);rubToday[it.rubro]=(rubToday[it.rubro]||0)+lineTotal(it);});}
  else if(k===yk){totY+=s.total;nY++;}
  if(s.ts>=d7){(s.items||[]).forEach(it=>{sold7[it.pid]=(sold7[it.pid]||0)+(+it.qty||0);});pays(s).forEach(p=>{pm[p.m]=(pm[p.m]||0)+(+p.a||0);});}});
 const R=rubs.map(r=>{const L=prods.filter(p=>p.rubro===r.id);const neg=L.filter(p=>p.stock<0),low=L.filter(p=>p.stock>=0&&p.stock<=5);
  return{id:r.id,name:r.name,owner:r.owner||'',color:col(r.color),items:L.length,units:L.reduce((a,p)=>a+Math.max(0,+p.stock||0),0),neg:neg.length,low:low.length,today:rubToday[r.id]||0,prods:L};});
 const open=(S.sessions||[]).filter(s=>!s.closedAt);
 return{tk,tot,n,totY,nY,R,prods,sold,sold7,open,days,pm,units:R.reduce((a,r)=>a+r.units,0),negAll:prods.filter(p=>p.stock<0),lowAll:prods.filter(p=>p.stock>=0&&p.stock<=5),at:now0};}
CI.data=()=>safe(D,null,'datos');

/* ---------- equipo: quién hace qué hoy (sólo lectura de auditoría, ventas, fichadas y tareas) ---------- */
const FN={vendedor:{n:'Vendedor',c:'#5aa0ff'},cajero:{n:'Cajero',c:'#3ccf7e'},repositor:{n:'Repositor',c:'#f2b632'},deposito:{n:'Depósito',c:'#b88cff'},gerente:{n:'Gerente',c:'#c9963e'}};
CI.FN=FN;
const CAT=a=>/^(VENTA|COBRO|ANULAR|PAGO_|PEDIDOSYA_VENTA|SELLO)/.test(a)?'ventas':/^(INGRESO_CAJA|EGRESO_CAJA|APERTURA_CAJA|CIERRE_CAJA|TRASPASO|NOTA_CIERRE)/.test(a)?'caja':/^(AJUSTE_STOCK|INV_|ALTA_PRODUCTO|EDITAR_PRODUCTO|PRECIO_PRODUCTO|PRESENTACIONES|COMBO|FOTO_PRODUCTO)/.test(a)?'stock':/^(COMPRA|OC_|PROVEEDOR|FACTURA_)/.test(a)?'deposito':/^(TAREA)/.test(a)?'tareas':/^(FICHAJE)/.test(a)?'fichaje':/^(LOGIN|LOGOUT)/.test(a)?'acceso':'admin';
const CATN={ventas:'Ventas y cobros',caja:'Caja',stock:'Inventario y reposición',deposito:'Depósito y compras',tareas:'Tareas',fichaje:'Fichaje',acceso:'Ingreso al sistema',admin:'Administración'};
const fold=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function team(){const now0=typeof now==='function'?now():Date.now();const tk=dkey(now0);const P={};const key=n=>String(n||'').trim().toLowerCase();
 const get=(name)=>{const k=key(name);if(!k)return null;return P[k]||(P[k]={k,name:String(name).trim(),roles:[],puesto:'',empId:'',tickets:0,total:0,cat:{},acts:[],tasks:0,punches:[],last:0});};
 (S.users||[]).forEach(u=>{const p=get(u.name);if(p)p.roles.push(u.role);});
 (S.employees||[]).filter(e=>e.active!==false).forEach(e=>{const p=get(e.name);if(!p)return;p.empId=e.id;const pu=(S.puestos||[]).find(x=>x.id===e.puestoId);p.puesto=pu?pu.name:'';});
 (S.sales||[]).forEach(s=>{if(!ok(s)||dkey(s.ts)!==tk)return;const p=get(s.user);if(!p)return;p.tickets++;p.total+=s.total;p.last=Math.max(p.last,s.ts);});
 (S.audit||[]).forEach(a=>{if(dkey(a.ts)!==tk||!a.user||a.user==='sistema')return;const p=get(a.user);if(!p)return;const c=CAT(a.action);p.cat[c]=(p.cat[c]||0)+1;p.acts.push(a);if(c!=='acceso')p.last=Math.max(p.last,a.ts);});
 (S.taskLogs||[]).forEach(l=>{if(l.day!==tk)return;const p=get(l.user);if(p)p.tasks++;});
 (S.punches||[]).forEach(x=>{if(dkey(x.ts)!==tk)return;const e=(S.employees||[]).find(e=>e.id===x.empId);const p=e&&get(e.name);if(p)p.punches.push(x);});
  return Object.values(P).map(p=>{p.punches.sort((a,b)=>a.ts-b.ts);const lp=p.punches[p.punches.length-1];p.onShift=!!(lp&&lp.kind==='in');p.since=p.punches.find(x=>x.kind==='in')||null;
  const pz=fold(p.puesto);const sc0=stf(p.k);p.cf=sc0;let f=sc0.fn;
  if(!FN[f]){if(p.roles.includes('admin'))f='gerente';else if(/caja|cajer/.test(pz))f='cajero';else if(/deposit/.test(pz)&&/repos/.test(pz))f=(p.cat.deposito||0)>(p.cat.stock||0)?'deposito':'repositor';else if(/deposit/.test(pz))f='deposito';else if(/repos/.test(pz))f='repositor';else if(/most|vend/.test(pz))f=p.tickets?'cajero':'vendedor';
   else if(p.cat.deposito)f='deposito';else if(p.cat.stock)f='repositor';else if(p.tickets||p.cat.caja)f='cajero';else f='vendedor';}
  p.fn=f;p.active=!!(p.onShift||(p.last&&now0-p.last<45*60000));p.show=(sc0.alias||p.name);p.av=sc0.av==='robot'?'robot':'humano';p.col=okCol(sc0.col)||FN[f].c;p.ph=okPh(sc0.ph)?sc0.ph:'';p.hide=!!sc0.hide;p.pos=okPos(sc0.pos);return p;})
  .sort((a,b)=>(b.active-a.active)||(b.last-a.last)||a.name.localeCompare(b.name,'es'));}
CI.team=()=>safe(team,[],'equipo');
/* configuración propia de cada persona dentro del módulo (no toca la ficha de Personal ni el usuario) */
function stf(k){const v=(cfg().staff||{})[k];return typeof v==='string'?{fn:v}:(v&&typeof v==='object'?v:{});}
const okCol=c=>/^#[0-9a-fA-F]{6}$/.test(String(c||''))?c:'';
const okPh=v=>typeof v==='string'&&v.length<60000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(v);
const okPos=v=>Array.isArray(v)&&v.length===2&&v.every(n=>typeof n==='number'&&isFinite(n)&&n>=0&&n<=60)?v:null;
CI._imgs={};function imgOf(src){if(!okPh(src))return null;let im=CI._imgs[src];if(!im){im=new Image();im.onload=()=>CI.draw();im.src=src;CI._imgs[src]=im;}return im.complete&&im.naturalWidth?im:null;}
function personSum(p){const L=[];if(p.tickets)L.push(p.tickets+' venta'+(p.tickets>1?'s':'')+' · '+$m(p.total));
 if(p.cat.caja)L.push(p.cat.caja+' mov. de caja');if(p.cat.stock)L.push(p.cat.stock+' en inventario');if(p.cat.deposito)L.push(p.cat.deposito+' en depósito/compras');if(p.tasks)L.push(p.tasks+' tarea'+(p.tasks>1?'s':''));if(p.cat.admin)L.push(p.cat.admin+' de administración');
 return L.join(' · ')||'Sin actividad registrada hoy';}
function personState(p){if(p.onShift)return'En turno desde '+hm(p.since?p.since.ts:p.punches[0].ts);if(p.punches.length)return'Salió a las '+hm(p.punches[p.punches.length-1].ts);if(p.last)return'Último movimiento '+hm(p.last);return'Sin actividad hoy';}

/* ---------- escena 3D isométrica del local ---------- */
function layout(R){const n=Math.max(1,R.length);const cols=Math.max(1,Math.min(4,Math.ceil(Math.sqrt(n*1.4))));const rows=Math.ceil(n/cols);
 const G=[];R.forEach((r,i)=>{const c=i%cols,w=Math.floor(i/cols);G.push({r,x:1.2+c*3.2,y:2+w*3,w:2.2,d:0.9});});
 const W=Math.max(cols*3.2+1.6,8.5),Dp=rows*3+5.2;return{G,W,D:Dp,cols,rows};}
const MT={gond:{n:'Góndola / estantería',w:2.2,d:0.9,h:1.9},caja:{n:'Caja de cobro',w:1.5,d:0.75,h:0.75},mostr:{n:'Mostrador de atención',w:2,d:0.7,h:0.9,c:'#7a5d3c'},dep:{n:'Depósito',w:3,d:1.4,h:0.1},
 heladera:{n:'Heladera',w:1.2,d:0.7,h:1.9,c:'#cfe3ee'},freezer:{n:'Freezer',w:1.6,d:0.8,h:0.85,c:'#e8eef2'},vitrina:{n:'Vitrina',w:1.6,d:0.6,h:1,c:'#9fc4d6'},isla:{n:'Isla / exhibidor',w:1.2,d:1.2,h:0.8,c:'#a07a4a'},oficina:{n:'Oficina / gerencia',w:1.8,d:1.4,h:0.1,c:'#4b4338'},puerta:{n:'Puerta / entrada',w:2.2,d:0.15,h:0,c:'#c9963e'},columna:{n:'Columna',w:0.4,d:0.4,h:2.4,c:'#8a8278'}};
CI.MT=MT;
function autoMap(R,nOpen){const L=layout(R);const it=[];L.G.forEach((g,i)=>it.push({id:'g'+i,t:'gond',x:g.x,y:g.y,w:g.w,d:g.d,rubro:g.r.id,label:''}));
 it.push({id:'dep',t:'dep',x:+(L.W-3.3).toFixed(1),y:0.25,w:3,d:1.4,label:'Depósito'});
 const n=Math.max(1,Math.min(4,nOpen||1));for(let i=0;i<n;i++)it.push({id:'c'+(i+1),t:'caja',x:+(0.7+i*2.1).toFixed(1),y:+(L.D-1.55).toFixed(2),w:1.5,d:0.75,label:'Caja '+(i+1)});
 it.push({id:'pu',t:'puerta',x:+(L.W/2-1.1).toFixed(1),y:+(L.D-0.15).toFixed(2),w:2.2,d:0.15,label:'Entrada'});
 return{W:+L.W.toFixed(1),D:+L.D.toFixed(1),items:it,auto:true,rows:L.rows};}
function cleanMap(m){if(!m||!Array.isArray(m.items))return null;const W=Math.min(60,Math.max(3,+m.W||0)),Dd=Math.min(60,Math.max(3,+m.D||0));if(!W||!Dd)return null;
 const items=m.items.slice(0,80).map((x,i)=>{const t=MT[x&&x.t]?x.t:null;if(!t)return null;const w=Math.min(W,Math.max(0.1,+x.w||MT[t].w)),dd=Math.min(Dd,Math.max(0.1,+x.d||MT[t].d));
  return{id:String(x.id||('e'+i)).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,20)||('e'+i),t,x:Math.min(W-w,Math.max(0,Math.round((+x.x||0)*10)/10)),y:Math.min(Dd-dd,Math.max(0,Math.round((+x.y||0)*10)/10)),w:Math.round(w*10)/10,d:Math.round(dd*10)/10,
   label:String(x.label||'').slice(0,30),rubro:t==='gond'&&x.rubro&&(S.rubros||[]).some(r=>r.id===x.rubro)?x.rubro:'',color:okCol(x.color)};}).filter(Boolean);return{W,D:Dd,items};}
function mapOf(d){if(CI.st.edit&&CI.st.draft)return CI.st.draft.map;const m=cleanMap(cfg().map);return m||autoMap(d.R,d.open.length);}
CI.mapOf=()=>safe(()=>mapOf(D()),null,'local');
function shade(hex,f){const n=parseInt(String(hex).slice(1),16);if(isNaN(n))return hex;let r=n>>16,g=n>>8&255,b=n&255;const m=x=>Math.max(0,Math.min(255,Math.round(f<0?x*(1+f):x+(255-x)*f)));return`rgb(${m(r)},${m(g)},${m(b)})`;}
function zonePos(M,f,i){/* dónde se para cada función (siempre del lado del pasillo, a la vista) */
 const of=t=>M.items.filter(x=>x.t===t);const fr=(e,dx)=>[Math.min(M.W-0.3,Math.max(0.3,e.x+(dx==null?e.w/2:dx))),Math.min(M.D-0.3,e.y+e.d+0.75)];
 const G=of('gond'),C=of('caja'),Dp=of('dep'),Mo=of('mostr'),Of=of('oficina');
 if(f==='cajero'&&C.length)return fr(C[i%C.length],C[i%C.length].w/2-0.1-(i>=C.length?0.5:0));
 if(f==='deposito'&&Dp.length)return fr(Dp[i%Dp.length],Dp[0].w/2+(i%2?0.6:-0.3));
 if(f==='repositor'&&G.length){const g=G[(i*2+1)%G.length];return fr(g,g.w-0.25);}
 if(f==='gerente'){if(Of.length)return[Of[0].x+Of[0].w/2+(i%2)*0.5,Of[0].y+Of[0].d/2];return[M.W/2+1.5+(i%2)*0.9,Math.max(1,M.D-3.3)];}
 if(f==='vendedor'&&Mo.length)return fr(Mo[i%Mo.length],Mo[0].w/2);
 const g=G[(i*2)%Math.max(1,G.length)];return g?fr(g,0.35):[M.W/2,Math.max(1,M.D-3)];}
let anim=0,tick=0;
const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}};
const fsz=sc=>Math.max(10,Math.min(14,Math.round(sc*0.2)));
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function draw(){const cv=document.querySelector('.ci-root canvas.ci-cv');if(!cv)return;
 if(CI._failDraw){CI._failDraw=false;throw new Error('falla simulada del mapa (prueba de aislamiento)');}
 const ctx=cv.getContext&&cv.getContext('2d');if(!ctx){const f=document.querySelector('.ci-root .ci-nocv');if(f)f.hidden=false;return;}
 const dpr=Math.min(2,window.devicePixelRatio||1);const Wc=cv.clientWidth||600,Hc=cv.clientHeight||400;if(cv.width!==Math.round(Wc*dpr)||cv.height!==Math.round(Hc*dpr)){cv.width=Math.round(Wc*dpr);cv.height=Math.round(Hc*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);
 const gold=(getComputedStyle(cv).getPropertyValue('--ci-acc')||'').trim()||'#c9963e';
 ctx.clearRect(0,0,Wc,Hc);const d=CI._d||D();const T=CI._t||[];const L=mapOf(d);const st=CI.st;const is3=st.mode==='3d'&&!st.edit;const rot=st.edit?0:((st.rot%4)+4)%4;const cx=L.W/2,cy=L.D/2;
 const rp=(x,y)=>{let dx=x-cx,dy=y-cy;for(let i=0;i<rot;i++){const t=dx;dx=-dy;dy=t;}return[dx,dy];};
 const raw=(x,y,z)=>{const [a,b]=rp(x,y);return is3?[(a-b)*0.5,(a+b)*0.29-(z||0)*0.55]:[a,b];};
 const cn=[[0,0,0],[L.W,0,0],[L.W,L.D,0],[0,L.D,0],[0,0,2.6],[L.W,0,2.6],[L.W,L.D,2.6],[0,L.D,2.6]].map(c=>raw(c[0],c[1],is3?c[2]:0));
 const bx=[Math.min(...cn.map(c=>c[0])),Math.max(...cn.map(c=>c[0]))],by=[Math.min(...cn.map(c=>c[1])),Math.max(...cn.map(c=>c[1]))];
 const sbar=document.querySelector('.ci-root .ci-sbar');const top=sbar&&getComputedStyle(sbar).position==='absolute'?sbar.offsetHeight+22:16;const pad=is3?26:40;const sc=Math.min((Wc-pad*2)/(bx[1]-bx[0]),(Hc-pad-top)/(by[1]-by[0]));
 const ox=Wc/2-(bx[0]+bx[1])/2*sc,oy=top+(Hc-pad-top)/2-(by[0]+by[1])/2*sc;CI._view={ox,oy,sc,cx,cy,is3,rot};
 const P=(x,y,z)=>{const r=raw(x,y,z);return[ox+r[0]*sc,oy+r[1]*sc];};
 const poly=(pts,fill,stroke,lw)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}};
 const box=(x0,y0,w,dd,z0,h,c,stroke)=>{const x1=x0+w,y1=y0+dd;const b=[P(x0,y0,z0),P(x1,y0,z0),P(x1,y1,z0),P(x0,y1,z0)];
  if(!is3||h<=0){poly(b,c,stroke||'rgba(0,0,0,.35)');return b;}const t=[P(x0,y0,z0+h),P(x1,y0,z0+h),P(x1,y1,z0+h),P(x0,y1,z0+h)];
  [[0,1],[1,2],[2,3],[3,0]].forEach(([i,j],k)=>poly([b[i],b[j],t[j],t[i]],shade(c,k%2?-0.38:-0.2),'rgba(0,0,0,.22)'));poly(t,shade(c,0.1),stroke||'rgba(0,0,0,.25)');return b.concat(t);};
 /* piso con baldosas y líneas de circulación */
 poly([P(0,0),P(L.W,0),P(L.W,L.D),P(0,L.D)],'#3a362f','rgba(201,150,62,.45)',1.5);
 ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;for(let x=1;x<L.W;x++){const a=P(x,0),b=P(x,L.D);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}for(let y=1;y<L.D;y++){const a=P(0,y),b=P(L.W,y);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
 ctx.strokeStyle='rgba(242,182,50,.7)';ctx.lineWidth=Math.max(2,sc*0.05);ctx.setLineDash([sc*0.35,sc*0.2]);
 if(L.auto)for(let w=0;w<=L.rows;w++){const y=1.45+w*3;const a=P(0.6,y),b=P(L.W-0.6,y);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
 ctx.setLineDash([]);

 if(st.edit){ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1;ctx.setLineDash([2,4]);for(let x=0.5;x<L.W;x+=0.5){const a=P(x,0),b=P(x,L.D);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}ctx.setLineDash([]);}
 /* objetos con profundidad */
 const items=[];const maxU=Math.max(1,...d.R.map(r=>r.units));let ci=0;
 L.items.forEach(e=>{const b={kind:e.t,e,x:e.x,y:e.y,w:e.w,d:e.d,label:e.label};
  if(e.t==='gond'){const r=d.R.find(x=>x.id===e.rubro);b.r=r||{id:'',name:e.label||'Estantería',color:e.color||'#8f857a',units:maxU/2,neg:0,low:0,generic:true};b.fill=r?Math.min(1,r.units/maxU):0.5;}
  if(e.t==='caja'){b.sess=d.open[ci++]||null;b.label=b.sess?(b.sess.regName||e.label||('Caja '+ci)):(e.label||'Caja')+' (cerrada)';}
  items.push(b);});
 const T2=T.filter(p=>!p.hide&&(p.active||p.fn==='gerente'||p.pos));const cnt={};const dpos=(st.edit&&st.draft)?st.draft.pos:null;
 T2.forEach(p=>{const i=cnt[p.fn]=(cnt[p.fn]||0);cnt[p.fn]++;const pp=(dpos&&dpos[p.k]!==undefined)?dpos[p.k]:p.pos;const [x,y]=pp||zonePos(L,p.fn,i);items.push({kind:'person',x:x-0.2,y:y-0.2,w:0.4,d:0.4,p,fixed:!!pp});});
 items.push({kind:'bot',x:Math.max(0.3,cx-0.05),y:Math.max(0.5,L.D-3.85),w:0.5,d:0.5});
 items.forEach(it=>{const c=rp(it.x+it.w/2,it.y+it.d/2);it.k=c[0]+c[1]+(it.kind==='person'||it.kind==='bot'?0.3:0);});items.sort((a,b)=>a.k-b.k);
 CI._hits=[];const bob=k=>(is3&&!reduced())?Math.sin(tick/6+k)*0.04:0;const tags=[];
 items.forEach((it,ix)=>{const sel=(it.r&&st.sel===it.r.id);
  if(it.kind==='gond'){const H=is3?1.9:0;const c=it.r.color;const pts=[];
   pts.push(...box(it.x,it.y,it.w,it.d,0,is3?0.12:0,'#5b544a'));
   if(is3){[[it.x,it.y],[it.x+it.w-0.08,it.y],[it.x,it.y+it.d-0.08],[it.x+it.w-0.08,it.y+it.d-0.08]].forEach(([x,y])=>box(x,y,0.08,0.08,0.12,H,'#8f857a'));
    for(let s=0;s<3;s++){const z=0.12+s*0.6;box(it.x,it.y,it.w,it.d,z,0.05,'#a69b8c');const nB=Math.round(5*Math.min(1,Math.max(0,it.fill*3-s)));for(let b=0;b<nB;b++)pts.push(...box(it.x+0.1+b*0.42,it.y+0.12,0.36,it.d-0.24,z+0.05,0.38,c));}
    pts.push(P(it.x,it.y,H+0.12),P(it.x+it.w,it.y+it.d,H+0.12),P(it.x+it.w,it.y,H+0.12),P(it.x,it.y+it.d,H+0.12));}
   else{box(it.x,it.y,it.w,it.d,0,0,c,sel?gold:null);pts.push(P(it.x,it.y),P(it.x+it.w,it.y),P(it.x+it.w,it.y+it.d),P(it.x,it.y+it.d));}
   if(st.edit&&st.esel===it.e.id){poly([P(it.x,it.y),P(it.x+it.w,it.y),P(it.x+it.w,it.y+it.d),P(it.x,it.y+it.d)],'rgba(201,150,62,.22)',gold,3);}
   if(sel){const z=is3?2.05:0;poly([P(it.x,it.y,z),P(it.x+it.w,it.y,z),P(it.x+it.w,it.y+it.d,z),P(it.x,it.y+it.d,z)],'rgba(201,150,62,.18)',gold,3);}
   CI._hits.push({it,pts:hullOf(pts)});
   const lc=P(it.x+it.w/2,it.y+it.d/2,is3?2.15:0);tags.push({x:lc[0],y:lc[1],t:it.label||it.r.name,c:it.r.color,alert:it.r.neg?['#ff6b5b',it.r.neg]:it.r.low?['#f2b632',it.r.low]:null});}
  else if(it.kind==='dep'){const pts=[...box(it.x,it.y,it.w,it.d,0,is3?0.1:0,'#4a443b')];if(is3){for(let i=0;i<3;i++)for(let j=0;j<2;j++)pts.push(...box(it.x+0.15+i*0.95,it.y+0.15+j*0.6,0.8,0.5,0.1,0.25+((i+j)%2)*0.25,'#c79a5b'));pts.push(...box(it.x+0.15,it.y+0.15,0.8,0.5,0.6,0.3,'#d8ad6c'));}
   const lc=P(it.x+it.w/2,it.y+it.d/2,is3?1.1:0);if(st.edit&&st.esel===it.e.id)poly([P(it.x,it.y),P(it.x+it.w,it.y),P(it.x+it.w,it.y+it.d),P(it.x,it.y+it.d)],'rgba(201,150,62,.22)',gold,3);tags.push({x:lc[0],y:lc[1],t:it.label||'Depósito',c:'#c79a5b'});CI._hits.push({it,pts:hullOf(pts)});}
  else if(it.kind==='puerta'){const a=P(it.x,it.y+it.d/2),b2=P(it.x+it.w,it.y+it.d/2);ctx.strokeStyle=it.e.color||gold;ctx.lineWidth=Math.max(4,sc*0.12);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b2[0],b2[1]);ctx.stroke();
   const pts=[P(it.x,it.y),P(it.x+it.w,it.y),P(it.x+it.w,it.y+Math.max(it.d,0.4)),P(it.x,it.y+Math.max(it.d,0.4))];CI._hits.push({it,pts:hullOf(pts)});if(st.edit||it.label){const lc=P(it.x+it.w/2,it.y+it.d/2,0);tags.push({x:lc[0],y:lc[1]+fsz(sc)*1.2,t:it.label||'Entrada',c:gold});}}
  else if(it.kind!=='gond'&&it.kind!=='dep'&&it.kind!=='caja'&&MT[it.kind]){const m=MT[it.kind];const c=it.e.color||m.c||'#8f857a';const pts=[...box(it.x,it.y,it.w,it.d,0,is3?m.h:0,c)];
   if(is3&&it.kind==='heladera'){pts.push(...box(it.x+0.08,it.y+it.d-0.02,it.w-0.16,0.02,0.15,m.h-0.3,'#7fb8d6'));}
   if(is3&&it.kind==='freezer'){pts.push(...box(it.x+0.08,it.y+0.08,it.w-0.16,it.d-0.16,m.h,0.03,'#8ec9e6'));}
   if(is3&&it.kind==='oficina'){pts.push(...box(it.x+0.2,it.y+0.2,1,0.5,0.1,0.65,'#6b5137'));}
   if(is3&&it.kind==='mostr'){pts.push(...box(it.x,it.y,it.w,0.1,m.h,0.05,'#c9a476'));}
   if(st.edit&&st.esel===it.e.id){poly([P(it.x,it.y),P(it.x+it.w,it.y),P(it.x+it.w,it.y+it.d),P(it.x,it.y+it.d)],'rgba(201,150,62,.22)',gold,3);}
   const lc=P(it.x+it.w/2,it.y+it.d/2,is3?m.h+0.25:0);tags.push({x:lc[0],y:lc[1],t:it.label||m.n,c:c});CI._hits.push({it,pts:hullOf(pts)});}
  else if(it.kind==='caja'){const on=!!it.sess;const pts=[...box(it.x,it.y,it.w,it.d,0,is3?0.75:0,on?'#2f7d55':'#6b665f')];if(is3)pts.push(...box(it.x+it.w-0.45,it.y+0.15,0.35,0.3,0.75,0.28,'#1b1813'));
   const lc=P(it.x+it.w/2,it.y+it.d/2,is3?1.25:0);if(st.edit&&st.esel===it.e.id)poly([P(it.x,it.y),P(it.x+it.w,it.y),P(it.x+it.w,it.y+it.d),P(it.x,it.y+it.d)],'rgba(201,150,62,.22)',gold,3);tags.push({x:lc[0],y:lc[1],t:it.label,c:on?'#3ccf7e':'#8a857c'});CI._hits.push({it,pts:hullOf(pts)});}
  else{const fx=it.x+it.w/2,fy=it.y+it.d/2,z=bob(ix);const g=P(fx,fy,0);
   ctx.save();ctx.translate(g[0],g[1]);ctx.scale(1,is3?0.5:1);const rr0=sc*0.42;const grd=ctx.createRadialGradient(0,0,rr0*0.2,0,0,rr0);grd.addColorStop(0,'rgba(201,150,62,0)');grd.addColorStop(0.7,'rgba(201,150,62,.35)');grd.addColorStop(1,'rgba(201,150,62,0)');ctx.fillStyle=grd;ctx.beginPath();ctx.arc(0,0,rr0,0,7);ctx.fill();ctx.strokeStyle='rgba(242,182,50,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,rr0*0.62,0,7);ctx.stroke();ctx.restore();
   const s2=sc*(is3?1:0.8);const base=P(fx,fy,z);const bx0=base[0],by0=base[1];
   if(it.kind==='bot'){ctx.fillStyle='#ece6da';ctx.beginPath();ctx.ellipse(bx0,by0-s2*0.42,s2*0.2,s2*0.26,0,0,7);ctx.fill();ctx.beginPath();ctx.arc(bx0,by0-s2*0.82,s2*0.17,0,7);ctx.fill();
    ctx.fillStyle='#1b1813';ctx.fillRect(bx0-s2*0.13,by0-s2*0.88,s2*0.26,s2*0.1);ctx.fillStyle=gold;ctx.beginPath();ctx.arc(bx0-s2*0.06,by0-s2*0.83,s2*0.03,0,7);ctx.arc(bx0+s2*0.06,by0-s2*0.83,s2*0.03,0,7);ctx.fill();
    ctx.strokeStyle=gold;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bx0,by0-s2*0.99);ctx.lineTo(bx0,by0-s2*1.08);ctx.stroke();ctx.fillStyle=gold;ctx.beginPath();ctx.arc(bx0,by0-s2*1.1,s2*0.035,0,7);ctx.fill();
    tags.push({x:bx0,y:by0-s2*1.27,t:'Gerente IA',sub:'Asistente',c:gold,dot:'#3ccf7e'});CI._hits.push({it,pts:[[bx0-s2*0.3,by0-s2*1.2],[bx0+s2*0.3,by0-s2*1.2],[bx0+s2*0.3,by0+4],[bx0-s2*0.3,by0+4]]});}
   else{const f=FN[it.p.fn]||FN.vendedor;const uc=it.p.col||f.c;const im=imgOf(it.p.ph);
    if(it.p.av==='robot'){ctx.fillStyle='#ece6da';ctx.beginPath();ctx.ellipse(bx0,by0-s2*0.42,s2*0.19,s2*0.25,0,0,7);ctx.fill();ctx.fillStyle=uc;ctx.fillRect(bx0-s2*0.12,by0-s2*0.52,s2*0.24,s2*0.16);
     ctx.fillStyle='#ece6da';ctx.beginPath();ctx.arc(bx0,by0-s2*0.82,s2*0.17,0,7);ctx.fill();ctx.strokeStyle=uc;ctx.lineWidth=2;ctx.stroke();
     if(im){ctx.save();ctx.beginPath();ctx.arc(bx0,by0-s2*0.82,s2*0.12,0,7);ctx.clip();ctx.drawImage(im,bx0-s2*0.12,by0-s2*0.94,s2*0.24,s2*0.24);ctx.restore();}
     else{ctx.fillStyle='#1b1813';ctx.fillRect(bx0-s2*0.13,by0-s2*0.88,s2*0.26,s2*0.1);ctx.fillStyle=uc;ctx.beginPath();ctx.arc(bx0-s2*0.06,by0-s2*0.83,s2*0.03,0,7);ctx.arc(bx0+s2*0.06,by0-s2*0.83,s2*0.03,0,7);ctx.fill();}
     ctx.strokeStyle=uc;ctx.beginPath();ctx.moveTo(bx0,by0-s2*0.99);ctx.lineTo(bx0,by0-s2*1.08);ctx.stroke();}
    else{ctx.fillStyle='#2a2622';ctx.fillRect(bx0-s2*0.1,by0-s2*0.36,s2*0.08,s2*0.36);ctx.fillRect(bx0+s2*0.02,by0-s2*0.36,s2*0.08,s2*0.36);
     ctx.fillStyle=uc;ctx.beginPath();ctx.moveTo(bx0-s2*0.17,by0-s2*0.34);ctx.lineTo(bx0+s2*0.17,by0-s2*0.34);ctx.lineTo(bx0+s2*0.14,by0-s2*0.74);ctx.quadraticCurveTo(bx0,by0-s2*0.82,bx0-s2*0.14,by0-s2*0.74);ctx.closePath();ctx.fill();
     ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(bx0-s2*0.04,by0-s2*0.7,s2*0.08,s2*0.3);
     if(im){ctx.save();ctx.beginPath();ctx.arc(bx0,by0-s2*0.93,s2*0.15,0,7);ctx.clip();ctx.drawImage(im,bx0-s2*0.15,by0-s2*1.08,s2*0.3,s2*0.3);ctx.restore();ctx.strokeStyle=uc;ctx.lineWidth=2;ctx.beginPath();ctx.arc(bx0,by0-s2*0.93,s2*0.15,0,7);ctx.stroke();}
     else{ctx.fillStyle='#e7c39d';ctx.beginPath();ctx.arc(bx0,by0-s2*0.92,s2*0.13,0,7);ctx.fill();ctx.fillStyle='#3b2a1e';ctx.beginPath();ctx.arc(bx0,by0-s2*0.96,s2*0.135,Math.PI,0);ctx.fill();}
     if(it.p.fn==='repositor'||it.p.fn==='deposito'){ctx.fillStyle='#c79a5b';ctx.fillRect(bx0+s2*0.08,by0-s2*0.62,s2*0.2,s2*0.16);ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=1;ctx.strokeRect(bx0+s2*0.08,by0-s2*0.62,s2*0.2,s2*0.16);}
     if(it.p.fn==='gerente'||it.p.fn==='cajero'){ctx.fillStyle='#e9e3d6';ctx.fillRect(bx0-s2*0.3,by0-s2*0.62,s2*0.14,s2*0.18);}}
    if(st.edit&&st.psel===it.p.k){ctx.strokeStyle=gold;ctx.lineWidth=3;ctx.beginPath();ctx.arc(bx0,by0-s2*0.55,s2*0.55,0,7);ctx.stroke();}
    const nm=seeTeam()?String(it.p.show).split(/\s+/)[0]:f.n;tags.push({x:bx0,y:by0-s2*1.14,t:nm,sub:f.n+(it.fixed&&st.edit?' · fijado':''),c:uc,dot:it.p.onShift||it.p.active?'#3ccf7e':'#8a857c'});
    CI._hits.push({it,pts:[[bx0-s2*0.3,by0-s2*1.25],[bx0+s2*0.3,by0-s2*1.25],[bx0+s2*0.3,by0+4],[bx0-s2*0.3,by0+4]]});}}});
 /* carteles arriba de todo */
 const fs=fsz(sc);
 /* carteles sin encimarse: se miden y, si chocan con uno ya puesto, se corren hacia arriba (con una guía al lugar) */
 const placed=[];tags.forEach(t=>{ctx.font='700 '+fs+'px sans-serif';t.t1=String(t.t).slice(0,20);t.t2=t.sub?String(t.sub):'';const w1=ctx.measureText(t.t1).width;ctx.font='500 '+(fs-2)+'px sans-serif';const w2=t.t2?ctx.measureText(t.t2).width:0;
  t.W=Math.max(w1,w2)+(t.dot?fs+12:14);t.H=t.t2?fs*2.3:fs*1.55;t.bx=t.x-t.W/2;t.by=t.y-t.H/2;t.oy=t.by;
  for(let k=0;k<12;k++){const hit=placed.find(o=>t.bx<o.bx+o.W+2&&t.bx+t.W+2>o.bx&&t.by<o.by+o.H+2&&t.by+t.H+2>o.by);if(!hit)break;t.by=hit.by-t.H-3;}
  if(t.by<4)t.by=4;placed.push(t);});
 tags.forEach(t=>{const t1=t.t1,t2=t.t2,W=t.W,H=t.H,x=t.bx,y=t.by;ctx.textBaseline='middle';ctx.textAlign='left';
  if(Math.abs(t.by-t.oy)>2){ctx.strokeStyle='rgba(242,182,50,.6)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(t.x,y+H);ctx.lineTo(t.x,t.oy+H/2);ctx.stroke();}
  ctx.fillStyle='rgba(23,21,18,.86)';ctx.strokeStyle=t.c||gold;ctx.lineWidth=1.5;rr(ctx,x,y,W,H,7);ctx.fill();ctx.stroke();
  let tx=x+7;if(t.dot){ctx.fillStyle=t.dot;ctx.beginPath();ctx.arc(x+7+fs*0.35,y+H/2,fs*0.33,0,7);ctx.fill();tx+=fs*0.7+5;}
  ctx.fillStyle='#f4efe6';ctx.font='700 '+fs+'px sans-serif';ctx.fillText(t1,tx,t2?y+fs*0.75:y+H/2);if(t2){ctx.fillStyle='#bcb2a3';ctx.font='500 '+(fs-2)+'px sans-serif';ctx.fillText(t2,tx,y+fs*1.65);}
  if(t.alert){const ax=x+W-2,ay=y+2;ctx.fillStyle=t.alert[0];ctx.beginPath();ctx.arc(ax,ay,fs*0.62,0,7);ctx.fill();ctx.fillStyle='#1b1813';ctx.textAlign='center';ctx.font='800 '+(fs-2)+'px sans-serif';ctx.fillText(String(t.alert[1]),ax,ay+1);}});
 const lbl=document.querySelector('.ci-root .ci-cvsum');if(lbl)lbl.textContent='Local '+(is3?'3D':'2D')+': '+d.R.length+' góndolas por rubro, '+d.open.length+' caja(s) abierta(s), '+T2.filter(p=>p.active).length+' persona(s) del equipo trabajando, '+d.negAll.length+' artículo(s) en negativo y '+d.lowAll.length+' con stock bajo. Abajo están la lista de rubros y la actividad de cada persona.';}
function hullOf(pts){if(pts.length<3)return pts;const P=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[],up=[];
 P.forEach(p=>{while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);});for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}
 up.pop();lo.pop();return lo.concat(up);}
function inPoly(x,y,pts){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;}
CI.draw=()=>safe(draw,null,'mapa');
function loop(){cancelAnimationFrame(anim);anim=0;if(reduced())return;let last=0;const f=t=>{const cv=document.querySelector('.ci-root canvas.ci-cv');if(!cv){anim=0;return;}
  if(!document.hidden&&t-last>66){last=t;tick++;if(safe(draw,'x','animación')==='x'){anim=0;return;}}anim=requestAnimationFrame(f);};anim=requestAnimationFrame(f);}

/* ---------- Gerente IA (local, sólo lectura) ---------- */
const BOT=`<svg class="ci-bot" viewBox="0 0 120 130" role="img" aria-label="Gerente IA"><line x1="60" y1="8" x2="60" y2="24" stroke="currentColor" stroke-width="4"/><circle cx="60" cy="8" r="6" fill="currentColor"/>
 <rect x="18" y="24" width="84" height="64" rx="20" fill="#ece6da" stroke="currentColor" stroke-width="4"/><rect x="28" y="38" width="64" height="30" rx="12" fill="#1b1813"/>
 <ellipse class="ci-eye" cx="46" cy="53" rx="7" ry="8" fill="currentColor"/><ellipse class="ci-eye" cx="74" cy="53" rx="7" ry="8" fill="currentColor"/>
 <rect class="ci-mouth" x="48" y="75" width="24" height="5" rx="2.5" fill="currentColor"/><rect x="34" y="94" width="52" height="32" rx="12" fill="#ece6da" stroke="currentColor" stroke-width="3"/><circle cx="60" cy="110" r="6" fill="currentColor"/>
 <rect x="6" y="44" width="12" height="22" rx="5" fill="currentColor"/><rect x="102" y="44" width="12" height="22" rx="5" fill="currentColor"/></svg>`;
const CHIPS=[['hoy','¿Cuánto vendimos hoy?','sales'],['reponer','¿Qué productos reponer?','box'],['stock','Mostrar el stock','search'],['analizar','Analizar mi negocio','pie']];
const MORE=[['top','¿Qué se vende más?'],['caja','¿Cómo está la caja?'],['margen','¿Qué rubro deja más margen?'],['deuda','¿Quién me debe?'],['equipo','¿Qué hizo el equipo hoy?']];
function intent(q){const t=fold(q);
 if(/(analiz|negocio|diagnost|panorama)/.test(t))return'analizar';if(/(equipo|personal|emplead|quien trabaj|hizo)/.test(t))return'equipo';
 if(/(mostrar el stock|stock total|stock por|ver stock)/.test(t))return'stock';
 if(/(hoy|vendimos|vamos|resumen|como va|dia)/.test(t))return'hoy';if(/(repon|falta|negativ|agot|bajo)/.test(t))return'reponer';
 if(/(mas vend|top|se vende|mejor|estrella)/.test(t))return'top';if(/(caja|efectivo|cajon|arqueo)/.test(t))return'caja';
 if(/(margen|ganancia|rentab|deja mas)/.test(t))return'margen';if(/(debe|deuda|fiado|cuenta corriente|cta)/.test(t))return'deuda';
 if(/(stock)/.test(t))return'stock';if(/(ayuda|que podes|que sabes)/.test(t))return'ayuda';return'buscar';}
const li=a=>'<ul>'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
function A_hoy(d){const tp=d.n?Math.round(d.tot/d.n):0;const dif=pct(d.tot,d.totY);const best=d.R.slice().sort((a,b)=>b.today-a.today)[0];
 return`Hoy llevás <b>${$m(d.tot)}</b> en ${d.n} venta(s)${d.n?', ticket promedio '+$m(tp):''}.`+li([dif==null?'Ayer no hubo ventas para comparar.':'Contra ayer ('+$m(d.totY)+'): '+(dif>=0?'+':'')+dif+' %.',best&&best.today?'El rubro que más vendió: <b>'+E(best.name)+'</b> ('+$m(best.today)+').':'Todavía no hay ventas por rubro hoy.',(d.negAll.length+d.lowAll.length)?'Alertas de stock: '+d.negAll.length+' en negativo y '+d.lowAll.length+' bajos.':'Sin alertas de stock.']);}
function A_reponer(d){const L=d.negAll.concat(d.lowAll).sort((a,b)=>a.stock-b.stock).slice(0,10);if(!L.length)return'No hay artículos con stock bajo (5 o menos) ni en negativo.';
 return`Para reponer primero (${d.negAll.length} en negativo, ${d.lowAll.length} con 5 o menos):`+li(L.map(p=>E(p.name)+(p.sub?' '+E(p.sub):'')+': <b class="'+(p.stock<0?'ci-neg':'ci-low')+'">'+E(nf(p.stock))+'</b>'+(d.sold7[p.id]?' · vendió '+E(nf(d.sold7[p.id]))+' en 7 días':'')));}
function A_stock(d){return`Stock total: <b>${E(nf(d.units))} u.</b> en ${d.prods.length} artículos.`+li(d.R.slice().sort((a,b)=>b.units-a.units).map(r=>E(r.name)+': '+E(nf(r.units))+' u.'+(r.neg?' · <span class="ci-neg">'+r.neg+' en negativo</span>':'')+(r.low?' · <span class="ci-low">'+r.low+' bajos</span>':'')));}
function A_top(d){const T=Object.entries(d.sold7).map(([id,q])=>({p:(S.products||[]).find(x=>x.id===id),q})).filter(x=>x.p).sort((a,b)=>b.q-a.q).slice(0,5);
 if(!T.length)return'No hay ventas en los últimos 7 días para armar el ranking.';return'Lo más vendido en los últimos 7 días (unidades):'+li(T.map((x,i)=>(i+1)+'. '+E(x.p.name)+': <b>'+E(nf(x.q))+'</b>'));}
function A_caja(d){if(!(can('close_cash')||can('cash_mov')||isAdm()))return'No tenés permiso para ver la caja.';if(!d.open.length)return'No hay cajas abiertas en este momento.';
 return`Hay ${d.open.length} caja(s) abierta(s):`+li(d.open.map(s=>{const e=safe(()=>typeof arqueoCalc==='function'?arqueoCalc(s,{emp:null,hours:0,rate:0,merienda:0,gastosManual:0,declared:NaN,taxes:{},payFromCash:false,detailAll:false,mono:true,notes:''}).expectedCash:null,null,'caja');
  return E(s.regName||('Caja '+(s.caja||1)))+': abierta desde '+E(hm(s.openedAt||Date.now()))+(e!=null?' · efectivo esperado <b>'+$m(e)+'</b>':'');}))+'<span class="ci-mut">Es lo que calcula el sistema; el conteo real se hace en Arqueo.</span>';}
function A_margen(d){if(!can('view_cost'))return'Para ver márgenes necesitás el permiso «Ver costos y ganancias».';const d30=d.at-30*86400000;const M={};
 (S.sales||[]).forEach(s=>{if(!ok(s)||s.ts<d30)return;(s.items||[]).forEach(it=>{const m=M[it.rubro]||(M[it.rubro]={v:0,c:0});m.v+=lineTotal(it);m.c+=lineCost(it);});});
 const L=d.R.map(r=>({r,m:M[r.id]||{v:0,c:0}})).filter(x=>x.m.v>0).map(x=>({...x,p:(x.m.v-x.m.c)/x.m.v*100})).sort((a,b)=>b.p-a.p);
 if(!L.length)return'No hay ventas con costo en los últimos 30 días.';return'Margen bruto estimado por rubro (30 días, sin impuestos ni gastos):'+li(L.map(x=>E(x.r.name)+': <b>'+x.p.toFixed(1).replace('.',',')+' %</b> sobre '+$m(x.m.v)));}
function A_deuda(){if(!can('customers'))return'Para ver deudas de clientes necesitás el permiso «Clientes».';const L=(S.customers||[]).filter(c=>c.status!=='baja').map(c=>({c,d:typeof debtOf==='function'?debtOf(c.id):0})).filter(x=>x.d>0).sort((a,b)=>b.d-a.d);
 if(!L.length)return'Nadie te debe en cuenta corriente.';const tot=L.reduce((a,x)=>a+x.d,0);return`Te deben <b>${$m(tot)}</b> entre ${L.length} cliente(s):`+li(L.slice(0,8).map(x=>E(typeof custFull==='function'?custFull(x.c):(x.c.name||''))+': '+$m(x.d)));}
function A_equipo(){if(!seeTeam())return'Para ver la actividad del equipo necesitás el permiso «Personal y fichaje».';const T=team();if(!T.length)return'No hay personas cargadas.';
 return'Hoy en el equipo:'+li(T.map(p=>'<b>'+E(p.name)+'</b> ('+E((FN[p.fn]||FN.vendedor).n)+'): '+E(personState(p))+' · '+E(personSum(p))));}
function answer(q){const d=D();const k=intent(q);
 if(k==='hoy')return A_hoy(d);if(k==='reponer')return A_reponer(d);if(k==='stock')return A_stock(d);if(k==='top')return A_top(d);if(k==='caja')return A_caja(d);if(k==='margen')return A_margen(d);if(k==='deuda')return A_deuda();if(k==='equipo')return A_equipo();
 if(k==='analizar'){const parts=['<b>Ventas.</b> '+A_hoy(d),'<b>Lo que más sale.</b> '+A_top(d),'<b>Reposición.</b> '+A_reponer(d)];if(can('view_cost'))parts.push('<b>Márgenes.</b> '+A_margen(d));if(can('customers'))parts.push('<b>Cuentas corrientes.</b> '+A_deuda());return parts.join('<hr style="border:0;border-top:1px solid rgba(201,150,62,.25);margin:.4rem 0">');}
 if(k==='ayuda')return'Respondo con los datos de este equipo (sólo leo, no cambio nada):'+li(CHIPS.concat(MORE).map(c=>E(c[1])))+'También podés escribir un artículo («fernet 750») o un precio («3500»).';
 const Q=typeof invQueryParse==='function'?invQueryParse(q):null;const F=Q&&typeof prodMatch==='function'?(S.products||[]).filter(p=>!p.archived&&prodMatch(p,Q)).slice(0,6):[];
 if(F.length)return'Encontré:'+li(F.map(p=>E(p.name)+(p.sub?' '+E(p.sub):'')+': '+$m(p.price)+' · stock <b class="'+(p.stock<0?'ci-neg':p.stock<=5?'ci-low':'')+'">'+E(nf(p.stock))+'</b>'+(d.sold7[p.id]?' · '+E(nf(d.sold7[p.id]))+' vendidos en 7 días':'')));
 return'No entendí la pregunta. Probá con «¿cuánto vendimos hoy?», «¿qué productos reponer?» o escribí un artículo.';}
CI.answer=q=>safe(()=>answer(q),'No pude responder ahora (el error quedó registrado).','gerente');

/* ---------- voz (V26.38): hablarle al Gerente y que responda en voz alta ----------
   · Micrófono: reconocimiento de voz del navegador (Chrome/Edge en PC y Android; Safari según versión). El navegador
     envía el audio a su servicio (Google/Microsoft/Apple) para pasarlo a texto: por eso viene APAGADO y lo enciende el
     administrador. El sistema no graba ni guarda audio; sólo escucha mientras el botón está encendido.
   · Respuesta en voz alta: síntesis de voz del propio navegador (no sale del equipo).
   · Configuración propia del módulo (S.cfg.ci.voice / .tts); no toca la del Asistente general. */
const SRc=()=>window.SpeechRecognition||window.webkitSpeechRecognition||null;
const voiceOK=()=>!!cfg().voice&&!!SRc();
const ttsOK=()=>!!cfg().tts&&!!window.speechSynthesis&&!CI.st.mute;
let rec=null;
function plain(h){const d=document.createElement('div');d.innerHTML=String(h||'').replace(/<li>/g,'. ').replace(/<br\s*\/?>/g,'. ').replace(/<hr[^>]*>/g,'. ');return (d.textContent||'').replace(/\$\s?([\d.]+),(\d\d)/g,'$1 pesos con $2').replace(/\$\s?([\d.]+)/g,'$1 pesos').replace(/\s+/g,' ').replace(/(\. )+/g,'. ').trim();}
function speak(h){if(!ttsOK())return;safe(()=>{const t=plain(h).slice(0,600);if(!t)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='es-AR';u.rate=1.02;
 const vs=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];const v=vs.find(x=>/^es[-_]AR/i.test(x.lang))||vs.find(x=>/^es/i.test(x.lang));if(v)u.voice=v;
 const bot=()=>document.querySelector('.ci-root .ci-bot');u.onstart=()=>{const b=bot();if(b)b.classList.add('ci-talk');};u.onend=u.onerror=()=>{const b=bot();if(b)b.classList.remove('ci-talk');};
 window.speechSynthesis.speak(u);CI._spoken=t;},null,'voz');}
CI.speak=speak;
function listenStart(){if(!voiceOK())return toast('La voz del Centro Inteligente está apagada o este navegador no la ofrece. Escribí tu pregunta.',1);
 if(CI.st.listen){safe(()=>rec&&rec.stop(),null,'micrófono');return;}
 safe(()=>{const R=SRc();rec=new R();rec.lang='es-AR';rec.interimResults=false;rec.continuous=false;rec.maxAlternatives=1;
  rec.onresult=ev=>{const t=ev.results&&ev.results[0]&&ev.results[0][0]?ev.results[0][0].transcript:'';CI.st.listen=false;logEv('voz','pregunta por voz');if(t)ask(t,true);else rerender();};
  rec.onerror=ev=>{CI.st.listen=false;logEv('voz','no se pudo escuchar ('+(ev&&ev.error||'error')+')');toast(ev&&ev.error==='not-allowed'?'El navegador no dio permiso al micrófono. Habilitalo desde el candado de la barra de direcciones.':'No pude escuchar. Probá de nuevo o escribí.',1);rerender();};
  rec.onend=()=>{if(CI.st.listen){CI.st.listen=false;rerender();}};
  if(window.speechSynthesis)window.speechSynthesis.cancel();CI.st.listen=true;rerender();rec.start();},null,'micrófono');}
function voiceCard(){if(!isAdm())return'';const c=cfg();const sr=!!SRc(),ss=!!window.speechSynthesis;
 return`<details class="ci-vc"><summary><b style="color:var(--ci-tx)">Voz del Gerente IA</b>&nbsp;<span class="tag ${c.voice||c.tts?'ok':''}">${c.voice&&c.tts?'micrófono y voz':c.voice?'micrófono':c.tts?'voz':'apagada'}</span></summary>
  <label class="chk"><input type="checkbox" class="ci-vset" data-k="voice" ${c.voice?'checked':''} ${sr?'':'disabled'}> Hablarle por micrófono${sr?'':' — este navegador no lo ofrece (usá Chrome o Edge)'}</label>
  <p>El navegador manda el audio a su servicio (Google o Microsoft) para pasarlo a texto. El sistema no graba ni guarda audio y sólo escucha mientras tocás el micrófono.</p>
  <label class="chk"><input type="checkbox" class="ci-vset" data-k="tts" ${c.tts?'checked':''} ${ss?'':'disabled'}> Que lea las respuestas en voz alta${ss?'':' — este navegador no lo ofrece'}</label>
  <p>La lectura en voz alta la hace el propio equipo; no sale información.</p></details>`;}
document.addEventListener('change',e=>safe(()=>{const t=e.target;if(!t||!t.classList||!t.classList.contains('ci-vset'))return;if(!isAdm()){toast('Sólo el administrador cambia la voz',1);rerender();return;}
 const k=t.dataset.k==='tts'?'tts':'voice';S.cfg.ci=Object.assign({},cfg(),{[k]:!!t.checked});audit('CENTRO_INTELIGENTE','voz: '+(k==='voice'?'micrófono':'lectura en voz alta')+' '+(t.checked?'encendida':'apagada'));logEv('voz',(k==='voice'?'micrófono':'lectura')+' '+(t.checked?'encendido':'apagado'));save();rerender();},null,'voz config'));

/* ---------- gráficos (SVG propio) ---------- */
function barsSVG(d){const K=Object.keys(d.days);const V=K.map(k=>d.days[k]);const mx=Math.max(1,...V);const W=300,H=150,bw=W/K.length;const dn=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
 return`<svg class="ci-ch" viewBox="0 0 ${W} ${H+30}" role="img" aria-label="Ventas de los últimos 7 días"><defs><linearGradient id="ci-g0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9963e"/><stop offset="1" stop-color="#7a5a22"/></linearGradient><linearGradient id="ci-g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2b632"/><stop offset="1" stop-color="#9a6b1f"/></linearGradient></defs>${K.map((k,i)=>{const h=Math.round(V[i]/mx*(H-24));const x=i*bw+bw*0.18,w=bw*0.64,y=H-h;const pe=V[i]/100;const lab=pe>=1e6?(pe/1e6).toFixed(1).replace('.',',')+'M':pe>=1000?Math.round(pe/1000)+'k':String(Math.round(pe));const dt=new Date(d.at-(6-i)*86400000);
  return`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="url(#ci-g${i===6?1:0})"/><text x="${x+w/2}" y="${y-5}" fill="#f4efe6" font-size="11" font-weight="700" text-anchor="middle">${lab}</text><text x="${x+w/2}" y="${H+18}" fill="#bcb2a3" font-size="11" text-anchor="middle">${i===6?'Hoy':dn[dt.getDay()]}</text>`;}).join('')}<line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="rgba(201,150,62,.35)"/></svg>`;}
const PMC={efectivo:'#3ccf7e',debito:'#5aa0ff',credito:'#8d7bff',transferencia:'#ff8fb1',qr:'#22c3d6',modo:'#f2b632',fiado:'#ff6b5b',pedidosya:'#ff9f43',mixto:'#bcb2a3'};
function donutSVG(d){const E2=Object.entries(d.pm).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);const T=E2.reduce((a,[,v])=>a+v,0);
 if(!T)return'<p class="ci-mut">Sin ventas en 7 días.</p>';let a0=-Math.PI/2;const R=46,r=28,cx=60,cy=60;
 const arcs=E2.map(([m,v])=>{const a1=a0+v/T*Math.PI*2;const lg=a1-a0>Math.PI?1:0;const p=(a,rr2)=>[cx+rr2*Math.cos(a),cy+rr2*Math.sin(a)];const [x0,y0]=p(a0,R),[x1,y1]=p(a1,R),[x2,y2]=p(a1,r),[x3,y3]=p(a0,r);
  const path=E2.length===1?`M${cx-R},${cy}a${R},${R} 0 1,0 ${2*R},0a${R},${R} 0 1,0 -${2*R},0M${cx-r},${cy}a${r},${r} 0 1,1 ${2*r},0a${r},${r} 0 1,1 -${2*r},0`:`M${x0},${y0}A${R},${R} 0 ${lg} 1 ${x1},${y1}L${x2},${y2}A${r},${r} 0 ${lg} 0 ${x3},${y3}Z`;a0=a1;return`<path d="${path}" fill="${PMC[m]||'#bcb2a3'}" fill-rule="evenodd"/>`;}).join('');
 return`<div style="display:flex;gap:.7rem;align-items:center"><svg viewBox="0 0 120 120" width="112" height="112" role="img" aria-label="Medios de pago de los últimos 7 días" style="flex:0 0 auto">${arcs}</svg><div style="flex:1;min-width:0">${E2.slice(0,5).map(([m,v])=>`<div class="ci-hb" style="grid-template-columns:minmax(0,1fr) 3rem"><span><i class="ci-dot" style="background:${PMC[m]||'#bcb2a3'}"></i>${E((typeof MET!=='undefined'&&MET[m])||m)}</span><b style="text-align:right">${Math.round(v/T*100)} %</b></div>`).join('')}</div></div>`;}
function stockBars(d){const T=Math.max(1,d.units);return d.R.slice().sort((a,b)=>b.units-a.units).slice(0,6).map(r=>`<div class="ci-hb"><span title="${E(r.name)}">${E(r.name)}</span><i style="background:linear-gradient(90deg,${r.color},${shade(r.color,0.35)});width:${Math.max(4,Math.round(r.units/T*100))}%"></i><b style="text-align:right">${Math.round(r.units/T*100)} %</b></div>`).join('')||'<p class="ci-mut">Sin artículos.</p>';}
function feed(){const tk=dkey(typeof now==='function'?now():Date.now());const F=[];
 (S.audit||[]).slice(-80).forEach(a=>{if(dkey(a.ts)!==tk||a.action==='VENTA')return;const c=CAT(a.action);if(c==='acceso'||(c==='admin'&&!/CENTRO|META/.test(a.action)))return;F.push({ts:a.ts,c,t:(CATN[c]||'')+': '+(a.detail||a.action),u:a.user});});
 (S.sales||[]).slice(-40).forEach(s=>{if(!ok(s)||dkey(s.ts)!==tk)return;F.push({ts:s.ts,c:'venta',t:'Venta '+(s.n||'')+' · '+$m(s.total),u:s.user});});
 const M={venta:['#3ccf7e','✓'],ventas:['#3ccf7e','$'],caja:['#5aa0ff','$'],stock:['#f2b632','!'],deposito:['#b88cff','↓'],tareas:['#22c3d6','✓'],fichaje:['#bcb2a3','⏱'],admin:['#c9963e','i']};
 const L=F.sort((a,b)=>b.ts-a.ts).slice(0,7);if(!L.length)return'<p class="ci-mut">Sin actividad hoy todavía.</p>';
 return'<ul class="ci-feed">'+L.map(x=>{const m=M[x.c]||M.admin;return`<li><span class="ci-fi" style="background:${m[0]}">${m[1]}</span><span title="${E(x.t)}">${E(x.t)}${x.u&&seeTeam()?' · <span class="ci-mut">'+E(x.u)+'</span>':''}</span><span class="ci-mut">${E(hm(x.ts))}</span></li>`;}).join('')+'</ul>';}

/* ---------- pantalla ---------- */
function kpiHTML(d){const tp=d.n?Math.round(d.tot/d.n):0,tpY=d.nY?Math.round(d.totY/d.nY):0;const t1=pct(d.tot,d.totY),t2=pct(tp,tpY);const al=d.negAll.length+d.lowAll.length;
 const tr=v=>v==null?'<span class="ci-mut">sin datos de ayer</span>':`<span class="${v>=0?'ci-up':'ci-dn'}">${v>=0?'▲ +':'▼ '}${v} %</span> <span class="ci-mut">vs ayer</span>`;
 const K=(icn,bg,lbl,val,sub)=>`<div class="ci-pan ci-kpi"><div class="ci-kic" style="background:${bg}">${ic(icn)}</div><div style="min-width:0"><span>${lbl}</span><b>${val}</b><span>${sub}</span></div></div>`;
 return`<div class="ci-kpis">${K('sales','linear-gradient(135deg,#3ccf7e,#1f8a52)','Ventas hoy',$m(d.tot),tr(t1))}${K('ticket','linear-gradient(135deg,#5aa0ff,#2b5fb8)','Ticket promedio',$m(tp),tr(t2))}${K('box','linear-gradient(135deg,#b88cff,#6d42c7)','Stock total',E(nf(d.units))+' u.',d.prods.length+' artículos')}${K('alert','linear-gradient(135deg,#f2b632,#c9783e)','Alertas',String(al),al?`<span class="ci-wn">Revisar: ${d.negAll.length} negativo · ${d.lowAll.length} bajo</span>`:'<span class="ci-up">Todo en orden</span>')}</div>`;}
function teamHTML(T){if(!seeTeam())return'';
 return`<section class="ci-pan ci-team" aria-label="Actividad del equipo"><h3 style="display:flex;gap:.5rem;align-items:center">${ic('team').replace('<svg','<svg style="width:22px;height:22px;color:var(--ci-acc)"')} Actividad del equipo hoy</h3><p class="ci-mut" style="margin:.2rem 0 0;font-size:.85rem">Vendedor, cajero, repositor, depósito y gerente: lo que registró cada uno en el sistema hoy (ventas, caja, inventario, compras, tareas y fichaje). Tocá una persona para ver el detalle.</p>
 <div class="ci-tgrid">${T.map(p=>{const f=FN[p.fn]||FN.vendedor;const ini=p.show.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const avh=p.ph?`<img alt="" src="${E(p.ph)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:p.av==='robot'?`<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="4" fill="#ece6da"/><rect x="7" y="9" width="10" height="5" rx="2" fill="#1b1813"/><circle cx="10" cy="11.5" r="1.2" fill="${p.col}"/><circle cx="14" cy="11.5" r="1.2" fill="${p.col}"/><path d="M12 6V3" stroke="#ece6da" stroke-width="2"/></svg>`:`<span style="color:#1b1813">${E(ini)}</span>`;
  return`<button type="button" class="ci-person" data-act="ciPerson" data-id="${E(p.k)}"><span class="ci-ph"><span class="ci-av" style="background:${p.col};color:${p.col};overflow:hidden">${avh}</span><span style="min-width:0"><b>${E(p.show)}</b>${p.show!==p.name?' <span class="ci-mut" style="font-size:.75rem">('+E(p.name)+')</span>':''}${p.hide?' <span class="ci-mut" style="font-size:.75rem">· oculto en el local</span>':''}<span class="ci-fn" style="background:${p.col}">${E(f.n)}</span></span></span>
   <span class="ci-ps"><i class="ci-dot" style="background:${p.onShift||p.active?'#3ccf7e':'#6b665f'}"></i>${E(personState(p))}</span><span class="ci-pn">${E(personSum(p))}</span></button>`;}).join('')||'<p class="ci-mut">No hay personas cargadas en Personal ni en Usuarios.</p>'}</div>${isAdm()?'<p class="ci-mut" style="font-size:.8rem;margin:.5rem 0 0">La función se deduce del puesto y de lo que hace cada uno; el administrador la puede corregir desde el detalle.</p>':''}</section>`;}
function offHTML(){const roles=Object.keys((typeof S!=='undefined'&&S.roles)||{}).filter(r=>r!=='admin');const c=cfg();
 return`<div class="ci-pan ci-off"><div class="ci-gmh" style="gap:1rem;align-items:flex-start;flex-wrap:wrap">${BOT}<div style="flex:1;min-width:220px"><h2>El Centro Inteligente está apagado</h2><p class="ci-mut">Es un módulo aparte: tablero con el local en 3D, el equipo trabajando, alertas de stock, gráficos y un Gerente IA que responde con los datos de este equipo. <b style="color:var(--ci-tx)">Sólo lee</b>: no cambia ventas, caja, inventario ni la sincronización. Apagarlo no borra nada.</p>
  ${roles.length?`<fieldset style="border:1px solid var(--ci-ln);border-radius:12px;padding:.5rem .7rem;margin:.6rem 0"><legend style="color:var(--ci-tx);font-size:.85rem"><b>Además del administrador, lo pueden ver:</b></legend>${roles.map(r=>`<label class="chk" style="color:var(--ci-tx)"><input type="checkbox" class="ci-role" value="${E(r)}" ${(c.roles||[]).includes(r)?'checked':''}> ${E(r)}</label>`).join('')}</fieldset>`:''}
  <button class="ci-btn on" style="min-height:48px" data-act="ciToggle">Activar el Centro Inteligente</button></div></div></div>`;}
function view(){if(CI._failRender){CI._failRender=false;throw new Error('falla simulada de la pantalla (prueba de aislamiento)');}
 css();const adm=isAdm();
 const head=on=>`<div class="ci-top"><div class="ci-brand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICN.cart}"/></svg><div><b>${E((S.tenant&&S.tenant.name)||'SISTEMA VB')}</b><span class="ci-mut" style="font-size:.85rem">Centro Inteligente · tu negocio, más inteligente</span></div></div>
  ${on?`<span class="ci-live"><i class="ci-dotl"></i>Sólo lectura · ${E(typeof fmtDT==='function'?fmtDT(Date.now()):'')}</span><button class="ci-btn" data-act="ciLog">Registro</button>${adm?'<button class="ci-btn" data-act="ciToggle">Desactivar</button>':''}`:''}</div>`;
 if(!isOn())return`<div class="ci-root">${head(false)}${adm?offHTML():'<p class="ci-mut">El administrador no activó el Centro Inteligente.</p>'}</div>`;
 const d=D();CI._d=d;const T=team();CI._t=T;const st=CI.st;
 const stage=`<div class="ci-pan ci-stage" id="ci-stage"><div class="ci-sbar"><span class="ci-stitle">${ic('box').replace('<svg','<svg style="width:18px;height:18px;vertical-align:-3px;color:var(--ci-acc)"')} ${st.edit?'Editando el local (vista de plano)':'Local '+(st.mode==='3d'?'3D':'2D')+' · en vivo'}</span>
   <button class="ci-btn ${st.mode==='2d'?'on':''}" data-act="ciMode" data-id="2d">2D</button><button class="ci-btn ${st.mode==='3d'?'on':''}" data-act="ciMode" data-id="3d">3D</button><button class="ci-btn" data-act="ciRot" aria-label="Girar el local">⟳</button><button class="ci-btn" data-act="ciFull" aria-label="Pantalla completa">⛶</button>${adm?`<button class="ci-btn ${st.edit?'on':''}" data-act="ciEdit">✎ Editar local</button>`:''}</div>
   <canvas class="ci-cv" aria-hidden="true"></canvas><p class="ci-sr ci-cvsum" aria-live="polite"></p><p class="ci-nocv" hidden style="padding:1rem">Este equipo no puede dibujar el local; usá las listas de abajo.</p>
   <div class="ci-legend"><span><i class="ci-dot" style="background:#ff6b5b"></i>stock negativo</span><span><i class="ci-dot" style="background:#f2b632"></i>stock bajo</span><span><i class="ci-dot" style="background:#3ccf7e"></i>en turno / caja abierta</span>${Object.values(FN).map(f=>`<span><i class="ci-dot" style="background:${f.c}"></i>${f.n}</span>`).join('')}<span>Tocá una góndola o una persona</span></div></div>`;
 const vb=voiceOK()?`<button class="ci-btn ${st.listen?'ci-rec':''}" data-act="ciMic" aria-pressed="${st.listen}" aria-label="${st.listen?'Detener el micrófono':'Hablar con el Gerente'}">${st.listen?'■ Detener':'🎙 Hablar'}</button>`:'';
 const mb=cfg().tts&&window.speechSynthesis?`<button class="ci-btn" data-act="ciMute" aria-pressed="${!st.mute}" aria-label="${st.mute?'Activar la voz de las respuestas':'Silenciar las respuestas'}">${st.mute?'🔇':'🔊'}</button>`:'';
 const gm=`<div class="ci-pan ci-gm" id="ci-gm"><div class="ci-gmh"><h2>Gerente IA</h2><span class="ci-live"><i class="ci-dotl"></i>Activo</span></div>${voiceCard()}${BOT}
   <div class="ci-bubble">¡Hola${typeof user!=='undefined'&&user?', '+E(user.name):''}! ¿Cómo puedo ayudarte hoy?</div>
   ${CHIPS.map(c=>`<button class="ci-btn ci-qb" data-act="ciChip" data-id="${c[0]}">${ic(c[2])}${E(c[1])}</button>`).join('')}
   <details><summary>Más preguntas</summary><div class="ci-chips">${MORE.map(c=>`<button class="ci-btn" data-act="ciChip" data-id="${c[0]}">${E(c[1])}</button>`).join('')}</div></details>
   <div class="ci-chat" aria-live="polite" ${st.chat.length?'':'hidden'}>${st.chat.map(m=>`<div class="ci-msg ${m.q?'ci-q':'ci-a'}">${m.q?E(m.q):m.a}</div>`).join('')}</div>
   <div class="ci-ask"><label class="ci-sr" for="ci-q">Pregunta al Gerente IA</label><input id="ci-q" autocomplete="off" maxlength="200" placeholder="Escribí tu pregunta o un artículo"><button class="ci-btn on" data-act="ciAsk">Preguntar</button>${vb}${mb}</div>
   ${st.listen?'<p role="status" style="margin:0;font-size:.85rem"><b>🎙 Escuchando…</b><span class="ci-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span> hablá ahora (por ejemplo: «¿cómo vamos hoy?»).</p>':voiceOK()?'<p class="ci-mut" style="margin:0;font-size:.8rem">Tocá «Hablar» y preguntá en voz alta. No se guarda audio.</p>':''}</div>`;
 const sel=d.R.find(r=>r.id===st.sel);
 const rubTable=`<details class="ci-pan" style="margin-top:12px;padding:0 .8rem" ${sel?'open':''}><summary>Rubros y artículos (misma información que el local)</summary><div class="tw"><table class="ci-tb"><thead><tr><th>Rubro</th><th>Artículos</th><th>Negativo</th><th>Bajo</th><th>Vendido hoy</th><th></th></tr></thead><tbody>
   ${d.R.map(r=>`<tr><td><span class="ci-dot" style="background:${r.color}"></span>${E(r.name)}</td><td>${r.items}</td><td class="${r.neg?'ci-neg':''}">${r.neg}</td><td class="${r.low?'ci-low':''}">${r.low}</td><td>${$m(r.today)}</td><td><button class="ci-btn" data-act="ciSel" data-id="${E(r.id)}">Ver</button></td></tr>`).join('')}</tbody></table></div>
   ${sel?`<div class="ci-card" style="margin:.6rem 0" id="ci-rub"><h3><span class="ci-dot" style="background:${sel.color}"></span>${E(sel.name)}</h3><p class="ci-mut" style="font-size:.85rem;margin:0 0 .4rem">${sel.owner?E(sel.owner)+' · ':''}${sel.items} artículos · vendido hoy ${$m(sel.today)}</p><div class="tw" style="max-height:260px;overflow:auto"><table class="ci-tb"><thead><tr><th>Artículo</th><th>Stock</th><th>Hoy</th></tr></thead><tbody>${sel.prods.slice().sort((a,b)=>(a.stock-b.stock)||a.name.localeCompare(b.name,'es')).map(p=>`<tr><td>${E(p.name)}${p.sub?' <span class="ci-mut">'+E(p.sub)+'</span>':''}</td><td class="${p.stock<0?'ci-neg':p.stock<=5?'ci-low':''}">${E(nf(p.stock))}</td><td>${d.sold[p.id]?E(nf(d.sold[p.id])):'—'}</td></tr>`).join('')}</tbody></table></div><button class="ci-btn" style="margin-top:.5rem" data-act="ciInv" data-id="${E(sel.id)}">Abrir en Inventario</button></div>`:''}</details>`;
 const row2=`<div class="ci-row2"><div class="ci-pan ci-card"><h3>Ventas por día <span style="font-size:.8rem;margin-left:auto">${(()=>{const v=pct(d.tot,d.totY);return v==null?'':(v>=0?'<span class="ci-up">▲ +':'<span class="ci-dn">▼ ')+v+' %</span>';})()}</span></h3>${barsSVG(d)}</div>
   <div class="ci-pan ci-card"><h3>Medios de pago <span class="ci-mut" style="font-size:.8rem">· 7 días</span></h3>${donutSVG(d)}</div>
   <div class="ci-pan ci-card"><h3>Stock por rubro</h3>${stockBars(d)}</div>
   <div class="ci-pan ci-card"><h3>Actividad reciente</h3>${feed()}</div></div>`;
 return`<div class="ci-root">${head(true)}${kpiHTML(d)}<div class="ci-main">${stage}${gm}</div>${st.edit&&adm?edHTML(d):''}${row2}${teamHTML(T)}${rubTable}</div>`;}
function after(){if(!isOn())return;draw();loop();const cv=document.querySelector('.ci-root canvas.ci-cv');
 if(cv)edBind(cv);if(cv)cv.addEventListener('click',e=>safe(()=>{if(CI.st.edit)return;const b=cv.getBoundingClientRect();const x=e.clientX-b.left,y=e.clientY-b.top;
   const order=CI._hits.slice().sort((a,b)=>(b.it.kind==='person'||b.it.kind==='bot')-(a.it.kind==='person'||a.it.kind==='bot'));
   for(const h of order){if(inPoly(x,y,h.pts)){const it=h.it;
     if(it.kind==='gond'){CI.st.sel=it.r.id;logEv('mapa','góndola '+it.r.name);rerender();setTimeout(()=>{const r=document.getElementById('ci-rub');if(r&&r.scrollIntoView)r.scrollIntoView({block:'nearest'});},50);}
     else if(it.kind==='person'){if(seeTeam())personModal(it.p.k);}
     else if(it.kind==='bot'){const i=document.getElementById('ci-q');if(i)i.focus();}
     else if(it.kind==='caja'){go('caja');}else if(it.kind==='dep'){if(typeof can==='function'&&can('purchases'))go('proveedores');}
     return;}}},null,'clic mapa'));
 const i=document.getElementById('ci-q');if(i)i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();A.ciAsk();}});const c=document.querySelector('.ci-root .ci-chat');if(c)c.scrollTop=c.scrollHeight;}
window.addEventListener('hashchange',()=>safe(()=>{if(!/#panel\/centro/.test(location.hash)){if(CI.st.edit){CI.st.edit=false;CI.st.draft=null;}if(CI.st.listen&&rec){CI.st.listen=false;rec.abort&&rec.abort();}if(window.speechSynthesis&&CI._spoken)window.speechSynthesis.cancel();}},null,'salir'));
let rz;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(document.querySelector('.ci-root canvas.ci-cv'))CI.draw();},150);});
document.addEventListener('fullscreenchange',()=>{setTimeout(()=>{if(document.querySelector('.ci-root canvas.ci-cv'))CI.draw();},60);});

/* ---------- editor del local (sólo administrador; trabaja sobre un borrador y se guarda con «Guardar») ---------- */
function edHTML(d){const st=CI.st;const M=st.draft.map;const e=M.items.find(x=>x.id===st.esel);const T=(CI._t||[]).filter(p=>!p.hide);const pp=T.find(p=>p.k===st.psel);
 const rubOpt=v=>`<option value="">— sin rubro —</option>${(S.rubros||[]).filter(r=>r.kind==='rubro').map(r=>`<option value="${E(r.id)}" ${v===r.id?'selected':''}>${E(r.name)}</option>`).join('')}`;
 const num=(k,v,l,mx)=>`<div><label for="ci-e-${k}">${l}</label><input id="ci-e-${k}" data-ef="${k}" inputmode="decimal" type="number" step="0.1" min="0" max="${mx}" value="${E(String(v))}"></div>`;
 const pad=(id)=>`<div class="ci-pad" role="group" aria-label="Mover"><span></span><button class="ci-btn" data-act="ciEdMove" data-dx="0" data-dy="-0.5" aria-label="Mover hacia el fondo">↑</button><span></span><button class="ci-btn" data-act="ciEdMove" data-dx="-0.5" data-dy="0" aria-label="Mover a la izquierda">←</button><span></span><button class="ci-btn" data-act="ciEdMove" data-dx="0.5" data-dy="0" aria-label="Mover a la derecha">→</button><span></span><button class="ci-btn" data-act="ciEdMove" data-dx="0" data-dy="0.5" aria-label="Mover hacia el frente">↓</button><span></span></div>`;
 const form=e?`<h3 style="font-size:1rem">${E(e.label||MT[e.t].n)}</h3><div class="ci-ed2"><div><label for="ci-e-t">Tipo</label><select id="ci-e-t" data-ef="t">${Object.entries(MT).map(([k,v])=>`<option value="${k}" ${e.t===k?'selected':''}>${v.n}</option>`).join('')}</select></div>
   <div><label for="ci-e-label">Nombre</label><input id="ci-e-label" data-ef="label" maxlength="30" value="${E(e.label||'')}" placeholder="${E(MT[e.t].n)}"></div></div>
   ${e.t==='gond'?`<label for="ci-e-rubro">Rubro que muestra (stock, alertas y color)</label><select id="ci-e-rubro" data-ef="rubro">${rubOpt(e.rubro)}</select>`:''}
   <div class="ci-ed2">${num('w',e.w,'Ancho (m)',M.W)}${num('d',e.d,'Fondo (m)',M.D)}${num('x',e.x,'Posición X (m)',M.W)}${num('y',e.y,'Posición Y (m)',M.D)}</div>
   ${e.t!=='gond'||!e.rubro?`<label for="ci-e-color">Color</label><input id="ci-e-color" data-ef="color" type="color" value="${E(e.color||MT[e.t].c||'#8f857a')}">`:''}
   ${pad()}<div class="ci-adds" style="margin-top:.5rem"><button class="ci-btn" data-act="ciEdRot">Girar 90°</button><button class="ci-btn" data-act="ciEdDup">Duplicar</button><button class="ci-btn" data-act="ciEdDel" style="border-color:var(--ci-bad);color:var(--ci-bad)">Eliminar</button></div>`
  :pp?`<h3 style="font-size:1rem">${E(pp.show)} <span class="ci-mut" style="font-size:.8rem">· ${E((FN[pp.fn]||FN.vendedor).n)}</span></h3><p class="ci-mut" style="font-size:.85rem;margin:.2rem 0">Ubicación: <b style="color:var(--ci-tx)">${(st.draft.pos[pp.k]!==undefined?st.draft.pos[pp.k]:pp.pos)?'fijada a mano':'automática según su función'}</b>. Arrastrala en el plano o usá las flechas.</p>${pad()}<button class="ci-btn" style="margin-top:.5rem" data-act="ciEdPAuto">Volver a ubicación automática</button>`
  :'<p class="ci-mut">Tocá un elemento o una persona en el plano (o en la lista) para editarlo. Arrastrá para moverlo.</p>';
 return`<section class="ci-pan ci-ed" aria-label="Editar el local"><h3>Editar el local</h3><p class="ci-mut" style="margin:.2rem 0 0;font-size:.85rem">Agregá, mové, cambiá o eliminá góndolas, cajas, mostradores, heladeras y más. El plano se ve desde arriba mientras editás. Nada se guarda hasta tocar «Guardar cambios».</p>
  <div class="ci-edg"><div><div class="ci-ed2">${num('W',M.W,'Ancho del local (m)',60)}${num('D',M.D,'Fondo del local (m)',60)}</div>
   <label>Agregar</label><div class="ci-adds">${Object.entries(MT).map(([k,v])=>`<button class="ci-btn" data-act="ciEdAdd" data-t="${k}">+ ${E(v.n)}</button>`).join('')}</div>
   <label>Elementos del local (${M.items.length})</label><div class="ci-elist">${M.items.map(x=>`<button class="${x.id===st.esel?'on':''}" data-act="ciEdSel" data-id="${E(x.id)}"><span>${E(x.label||(x.t==='gond'&&(S.rubros||[]).find(r=>r.id===x.rubro)||{}).name||MT[x.t].n)}</span><span class="ci-mut">${E(MT[x.t].n)}</span></button>`).join('')||'<p class="ci-mut" style="padding:.5rem">Sin elementos.</p>'}</div>
   ${T.length?`<label>Personas</label><div class="ci-adds">${T.map(p=>`<button class="ci-btn ${p.k===st.psel?'on':''}" data-act="ciEdPSel" data-id="${E(p.k)}">${E(String(p.show).split(/\s+/)[0])}</button>`).join('')}</div>`:''}</div>
   <div>${form}</div></div>
  <div class="ci-edf"><button class="ci-btn on" data-act="ciEdSave">Guardar cambios</button><button class="ci-btn" data-act="ciEdCancel">Descartar</button><button class="ci-btn" data-act="ciEdAuto">Volver al plano automático</button></div></section>`;}
function edItem(){const st=CI.st;return st.draft&&st.draft.map.items.find(x=>x.id===st.esel);}
function edClamp(e,M){e.w=Math.round(Math.min(M.W,Math.max(0.1,+e.w||0.1))*10)/10;e.d=Math.round(Math.min(M.D,Math.max(0.1,+e.d||0.1))*10)/10;e.x=Math.round(Math.min(M.W-e.w,Math.max(0,+e.x||0))*10)/10;e.y=Math.round(Math.min(M.D-e.d,Math.max(0,+e.y||0))*10)/10;}
document.addEventListener('input',e=>safe(()=>{const t=e.target;if(!t||!t.dataset||!t.dataset.ef||!CI.st.edit||!t.closest('.ci-ed'))return;const M=CI.st.draft.map;const k=t.dataset.ef;M.auto=false;
 if(k==='W'||k==='D'){const v=parseFloat(String(t.value).replace(',','.'));if(isFinite(v)&&v>=3&&v<=60){M[k]=Math.round(v*10)/10;M.items.forEach(x=>edClamp(x,M));CI.draw();}return;}
 const it=edItem();if(!it)return;
 if(k==='label'){it.label=String(t.value).slice(0,30);const lb=document.querySelector('.ci-elist [data-id="'+it.id+'"] span');if(lb)lb.textContent=it.label||MT[it.t].n;CI.draw();return;}
 if(k==='color'){it.color=okCol(t.value)||'';CI.draw();return;}
 if(k==='t'||k==='rubro'){it[k]=t.value;if(k==='t'&&MT[t.value]){it.w=MT[t.value].w;it.d=MT[t.value].d;edClamp(it,M);if(t.value!=='gond')it.rubro='';}rerender();return;}
 const v=parseFloat(String(t.value).replace(',','.'));if(!isFinite(v))return;it[k]=v;edClamp(it,M);CI.draw();},null,'editar local'));
/* los campos de texto y números no redibujan la pantalla (así no se pierde el foco al pasar de un campo a otro) */
function edStart(){if(!isAdm())return toast('Sólo el administrador edita el local',1);const d=D();const M=JSON.parse(JSON.stringify(mapOf(d)));M.auto=!!M.auto;const pos={};
 CI.st.edit=true;CI.st.draft={map:M,pos};CI.st.esel=null;CI.st.psel=null;logEv('local','edición iniciada');rerender();}
function edMovePerson(k,x,y){const M=CI.st.draft.map;CI.st.draft.pos[k]=[Math.round(Math.min(M.W-0.3,Math.max(0.3,x))*10)/10,Math.round(Math.min(M.D-0.3,Math.max(0.3,y))*10)/10];}
function personXY(k){const h=CI._hits.find(h=>h.it.kind==='person'&&h.it.p.k===k);return h?[h.it.x+0.2,h.it.y+0.2]:null;}
function edBind(cv){let drag=null;const W=(ev)=>{const b=cv.getBoundingClientRect(),v=CI._view;return[(ev.clientX-b.left-v.ox)/v.sc+v.cx,(ev.clientY-b.top-v.oy)/v.sc+v.cy];};
 cv.addEventListener('pointerdown',ev=>safe(()=>{if(!CI.st.edit)return;const [wx,wy]=W(ev);const b=cv.getBoundingClientRect();const sx=ev.clientX-b.left,sy=ev.clientY-b.top;
  const ph=CI._hits.filter(h=>h.it.kind==='person').reverse().find(h=>inPoly(sx,sy,h.pts));
  if(ph){CI.st.psel=ph.it.p.k;CI.st.esel=null;const xy=personXY(ph.it.p.k);drag={k:ph.it.p.k,ox:wx-xy[0],oy:wy-xy[1],moved:false};}
  else{const M=CI.st.draft.map;const e=M.items.slice().reverse().find(x=>wx>=x.x&&wx<=x.x+x.w&&wy>=x.y-(x.t==='puerta'?0.2:0)&&wy<=x.y+Math.max(x.d,x.t==='puerta'?0.4:0));
   CI.st.esel=e?e.id:null;CI.st.psel=null;if(e)drag={e,ox:wx-e.x,oy:wy-e.y,moved:false};}
  if(drag){cv.setPointerCapture&&cv.setPointerCapture(ev.pointerId);ev.preventDefault();}CI.draw();},null,'arrastre'));
 cv.addEventListener('pointermove',ev=>safe(()=>{if(!drag||!CI.st.edit)return;const [wx,wy]=W(ev);const M=CI.st.draft.map;drag.moved=true;M.auto=false;
  if(drag.e){drag.e.x=wx-drag.ox;drag.e.y=wy-drag.oy;edClamp(drag.e,M);}else edMovePerson(drag.k,wx-drag.ox,wy-drag.oy);CI.draw();},null,'arrastre'));
 const up=()=>{if(!drag)return;drag=null;rerender();};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);}
CI.ed={start:()=>safe(edStart,null,'editar local'),move:(id,x,y)=>safe(()=>{const e=CI.st.draft.map.items.find(z=>z.id===id);if(e){e.x=x;e.y=y;edClamp(e,CI.st.draft.map);CI.st.draft.map.auto=false;CI.draw();}},null,'editar local'),movePerson:(k,x,y)=>safe(()=>{edMovePerson(k,x,y);CI.draw();},null,'editar local')};

/* ---------- detalle de una persona ---------- */
function personModal(k){const p=team().find(x=>x.k===k);if(!p)return;const f=FN[p.fn]||FN.vendedor;const tk=dkey(Date.now());const adm=isAdm();
 const rows=[];p.punches.forEach(x=>rows.push({ts:x.ts,t:'Fichaje · '+(x.kind==='in'?'entrada':'salida')}));
 (S.sales||[]).forEach(s=>{if(ok(s)&&dkey(s.ts)===tk&&String(s.user||'').trim().toLowerCase()===k)rows.push({ts:s.ts,t:'Venta '+(s.n||'')+' · '+$m(s.total)+' · '+((typeof MET!=='undefined'&&MET[s.method])||s.method||'')});});
 p.acts.forEach(a=>{if(a.action==='VENTA')return;rows.push({ts:a.ts,t:(CATN[CAT(a.action)]||a.action)+' · '+(a.detail||a.action)});});
 rows.sort((a,b)=>b.ts-a.ts);const c0=p.cf||{};let ph=p.ph;
 const ed=adm?`<fieldset style="border:1px solid var(--line);border-radius:12px;padding:.6rem .8rem;margin:.4rem 0"><legend><b>Cómo se ve en el Centro Inteligente</b></legend>
  <div class="grid g2"><div><label for="ci-al">Nombre que se muestra</label><input id="ci-al" maxlength="30" value="${E(c0.alias||'')}" placeholder="${E(p.name)}"></div>
  <div><label for="ci-fn">Función</label><select id="ci-fn"><option value="">Automática (según puesto y actividad)</option>${Object.entries(FN).map(([key,v])=>`<option value="${key}" ${c0.fn===key?'selected':''}>${v.n}</option>`).join('')}</select></div></div>
  <div class="grid g2"><div><span class="sm"><b>Avatar</b></span><label class="chk"><input type="radio" name="ci-av" value="humano" ${p.av!=='robot'?'checked':''}> Persona</label><label class="chk"><input type="radio" name="ci-av" value="robot" ${p.av==='robot'?'checked':''}> Robot</label></div>
  <div><label for="ci-col">Color del uniforme</label><input id="ci-col" type="color" value="${E(p.col||f.c)}" style="min-height:44px;width:100%"></div></div>
  <div style="display:flex;gap:.8rem;align-items:center;flex-wrap:wrap;margin-top:.4rem"><span id="ci-phv" style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:${E(p.col||f.c)};display:grid;place-items:center;font-weight:800;color:#1b1813;flex:0 0 64px">${ph?`<img alt="" src="${E(ph)}" style="width:100%;height:100%;object-fit:cover">`:E(p.show.slice(0,2).toUpperCase())}</span>
   <div style="flex:1;min-width:180px"><label for="ci-ph">Foto para el avatar (opcional)</label><input id="ci-ph" type="file" accept="image/jpeg,image/png,image/webp"><button type="button" class="btn sm" id="ci-phx" style="margin-top:.3rem;min-height:44px" ${ph?'':'hidden'}>Quitar foto</button>
   <p class="sm mut" style="margin:.2rem 0 0">Se achica a 128 × 128 en este equipo y se guarda con la configuración del módulo. Subila sólo con permiso de la persona.</p></div></div>
  <label class="chk" style="margin-top:.4rem"><input type="checkbox" id="ci-sh" ${p.hide?'':'checked'}> Mostrar en el local 3D</label>
  <p class="sm" style="margin:.2rem 0 0">Ubicación en el local: <b>${p.pos?'fijada a mano':'automática según su función'}</b>${p.pos?' <button type="button" class="btn sm" id="ci-pa" style="min-height:44px">Volver a automática</button>':''} <span class="mut">(se mueve desde «Editar local»).</span></p>
  <p class="sm mut" style="margin:.4rem 0 0">Los datos de la persona (nombre real, PIN, valor hora, puesto) se editan en ${p.empId?'<a href="#panel/personal">Personal y fichaje</a>':''}${p.empId&&p.roles.length?' o ':''}${p.roles.length?'<a href="#panel/roles">Usuarios y permisos</a>':''}${!p.empId&&!p.roles.length?'Personal y fichaje':''}.</p></fieldset>`:'';
 let clrPos=false;
 const w=modal('Actividad de '+p.show,`<p><b>${E(f.n)}</b>${p.show!==p.name?' · '+E(p.name):''}${p.puesto?' · puesto '+E(p.puesto):''}${p.roles.length?' · usuario '+E(p.roles.join(', ')):''}<br><span class="mut">${E(personState(p))}</span></p><p>${E(personSum(p))}</p>${ed}
  <div class="tw" style="max-height:300px;overflow:auto;margin-top:.6rem"><table data-nosort><thead><tr><th>Hora</th><th>Actividad de hoy</th></tr></thead><tbody>${rows.slice(0,120).map(r=>`<tr><td>${E(hm(r.ts))}</td><td>${E(r.t)}</td></tr>`).join('')||'<tr><td colspan="2" class="mut">Sin actividad registrada hoy.</td></tr>'}</tbody></table></div>`,
  {wide:adm,okText:adm?'Guardar':'Cerrar',onOk:()=>safe(()=>{if(!adm)return;const n={};const v=val('ci-fn');if(FN[v])n.fn=v;const al=String(val('ci-al')||'').trim().slice(0,30);if(al&&al!==p.name)n.alias=al;
   const av=(w.querySelector('input[name=ci-av]:checked')||{}).value;if(av==='robot')n.av='robot';const cl=okCol(val('ci-col'));if(cl&&cl.toLowerCase()!==f.c.toLowerCase())n.col=cl;if(okPh(ph))n.ph=ph;
   if(!$('#ci-sh',w).checked)n.hide=true;if(p.pos&&!clrPos)n.pos=p.pos;
   const st=Object.assign({},cfg().staff||{});if(Object.keys(n).length)st[p.k]=n;else delete st[p.k];
   if(JSON.stringify(st)!==JSON.stringify(cfg().staff||{})){S.cfg.ci=Object.assign({},cfg(),{staff:st});const ch=[];if((c0.fn||'')!==(n.fn||''))ch.push('función '+(n.fn?FN[n.fn].n:'automática'));if((c0.alias||'')!==(n.alias||''))ch.push('nombre visible');if((c0.av||'humano')!==(n.av||'humano'))ch.push('avatar '+(n.av||'persona'));if((c0.col||'')!==(n.col||''))ch.push('color');if((c0.ph||'')!==(n.ph||''))ch.push(n.ph?'foto nueva':'foto quitada');if(!!c0.hide!==!!n.hide)ch.push(n.hide?'oculto en el local':'visible en el local');if(clrPos)ch.push('ubicación automática');
    audit('CENTRO_INTELIGENTE','equipo · '+p.name+': '+(ch.join(', ')||'cambios'));save();logEv('equipo','editado '+p.name);rerender();toast('Guardado: '+p.show);}},null,'editar persona')});
 if(adm){const inp=$('#ci-ph',w),pv=$('#ci-phv',w),bx=$('#ci-phx',w);
  inp.addEventListener('change',()=>safe(()=>{const fl=inp.files&&inp.files[0];if(!fl)return;if(!/^image\/(jpeg|png|webp)$/.test(fl.type))return w._err('Elegí una imagen JPG, PNG o WebP.');if(fl.size>8e6)return w._err('La imagen es muy grande (máximo 8 MB).');
   const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>safe(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const m=Math.min(im.width,im.height);g.drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,128,128);
     let q=0.85,u=c.toDataURL('image/jpeg',q);while(u.length>40000&&q>0.4){q-=0.1;u=c.toDataURL('image/jpeg',q);}if(!okPh(u))return w._err('No se pudo procesar la imagen.');ph=u;w._err('');pv.innerHTML='<img alt="" style="width:100%;height:100%;object-fit:cover">';pv.firstChild.src=u;bx.hidden=false;},null,'foto');
    im.onerror=()=>w._err('No se pudo leer la imagen.');im.src=rd.result;};rd.readAsDataURL(fl);},null,'foto'));
  bx.addEventListener('click',()=>{ph='';pv.textContent=p.show.slice(0,2).toUpperCase();bx.hidden=true;inp.value='';});
  const pa=$('#ci-pa',w);if(pa)pa.addEventListener('click',()=>{clrPos=true;pa.parentNode.innerHTML='Ubicación en el local: <b>automática</b> (al guardar).';});
  w.querySelectorAll('a[href^="#panel/"]').forEach(a=>a.addEventListener('click',()=>w.remove()));}
 logEv('equipo','detalle de '+p.name);return w;}
CI.personModal=k=>safe(()=>personModal(k),null,'equipo');

/* ---------- acciones (todas protegidas) ---------- */
const act=(name,fn)=>{A[name]=(el,e)=>safe(()=>fn(el,e),null,name);};
act('ciToggle',()=>{if(!isAdm())return toast('Sólo el administrador activa o desactiva el Centro Inteligente',1);const was=isOn();if(was){CI.st.listen=false;safe(()=>{rec&&rec.abort&&rec.abort();window.speechSynthesis&&window.speechSynthesis.cancel();},null,'apagar voz');}
 const roles=was?(cfg().roles||[]):[...document.querySelectorAll('.ci-root .ci-role:checked')].map(x=>x.value);
 S.cfg.ci=Object.assign({},cfg(),{on:!was,roles,by:user.name,at:now()});audit('CENTRO_INTELIGENTE',(was?'desactivado':'activado')+(was?'':' · lo ven: administrador'+(roles.length?', '+roles.join(', '):'')));
 logEv(was?'desactivado':'activado','por '+user.name);CI.st.sel=null;cancelAnimationFrame(anim);anim=0;save();rerender();toast(was?'Centro Inteligente desactivado. El sistema sigue igual.':'Centro Inteligente activado (sólo lectura).');});
act('ciTab',el=>{/* compatibilidad: el tablero ya muestra todo junto; lleva a la sección pedida */const m={gerente:'ci-gm',mapa:'ci-stage'};const t=document.getElementById(m[el.dataset.id]||'');if(el.dataset.id==='registro')return A.ciLog();if(t&&t.scrollIntoView)t.scrollIntoView({block:'nearest'});});
act('ciEdit',()=>{if(CI.st.edit){A.ciEdCancel();return;}edStart();});
act('ciEdSel',el=>{CI.st.esel=el.dataset.id;CI.st.psel=null;rerender();});
act('ciEdPSel',el=>{CI.st.psel=el.dataset.id;CI.st.esel=null;rerender();});
act('ciEdAdd',el=>{const t=MT[el.dataset.t]?el.dataset.t:'gond';const M=CI.st.draft.map;if(M.items.length>=80)return toast('Máximo 80 elementos en el local',1);M.auto=false;
 const n=M.items.filter(x=>x.t===t).length+1;const e={id:'e'+Date.now().toString(36),t,x:M.W/2-MT[t].w/2,y:M.D/2-MT[t].d/2,w:MT[t].w,d:MT[t].d,label:t==='gond'?'':MT[t].n.split(' /')[0]+(n>1?' '+n:''),rubro:'',color:''};edClamp(e,M);M.items.push(e);CI.st.esel=e.id;CI.st.psel=null;rerender();});
act('ciEdDel',()=>{const M=CI.st.draft.map;const i=M.items.findIndex(x=>x.id===CI.st.esel);if(i<0)return;M.items.splice(i,1);M.auto=false;CI.st.esel=null;rerender();});
act('ciEdDup',()=>{const e=edItem();if(!e)return;const M=CI.st.draft.map;if(M.items.length>=80)return;const c=Object.assign({},e,{id:'e'+Date.now().toString(36),x:e.x+0.5,y:e.y+0.5});edClamp(c,M);M.items.push(c);M.auto=false;CI.st.esel=c.id;rerender();});
act('ciEdRot',()=>{const e=edItem();if(!e)return;const w=e.w;e.w=e.d;e.d=w;edClamp(e,CI.st.draft.map);CI.st.draft.map.auto=false;rerender();});
act('ciEdMove',el=>{const dx=+el.dataset.dx||0,dy=+el.dataset.dy||0;const e=edItem();if(e){e.x+=dx;e.y+=dy;edClamp(e,CI.st.draft.map);CI.st.draft.map.auto=false;rerender();return;}
 if(CI.st.psel){const xy=CI.st.draft.pos[CI.st.psel]||personXY(CI.st.psel);if(xy){edMovePerson(CI.st.psel,xy[0]+dx,xy[1]+dy);rerender();}}});
act('ciEdPAuto',()=>{if(CI.st.psel){CI.st.draft.pos[CI.st.psel]=null;rerender();}});
act('ciEdCancel',()=>{CI.st.edit=false;CI.st.draft=null;CI.st.esel=CI.st.psel=null;logEv('local','edición descartada');rerender();});
act('ciEdAuto',()=>{modal('Volver al plano automático','<p>El local vuelve a armarse solo: una góndola por rubro, cajas, depósito y entrada. Se descartan los elementos agregados a mano (al guardar).</p>',{okText:'Volver al automático',onOk:()=>{const d=D();CI.st.draft.map=autoMap(d.R,d.open.length);CI.st.esel=null;rerender();}});});
act('ciEdSave',()=>{if(!isAdm())return;const dr=CI.st.draft;const st=Object.assign({},cfg().staff||{});let np=0;
 Object.entries(dr.pos).forEach(([k,v])=>{const cur=Object.assign({},stf(k));if(v)cur.pos=v;else delete cur.pos;np++;if(Object.keys(cur).length)st[k]=cur;else delete st[k];});
 const map=dr.map.auto?undefined:cleanMap(dr.map);const nc=Object.assign({},cfg(),{staff:st});if(map)nc.map=map;else delete nc.map;S.cfg.ci=nc;
 audit('CENTRO_INTELIGENTE','local '+(map?'personalizado: '+map.items.length+' elementos, '+map.W+' × '+map.D+' m':'automático')+(np?' · '+np+' ubicación(es) de personas':''));logEv('local','guardado');
 CI.st.edit=false;CI.st.draft=null;CI.st.esel=CI.st.psel=null;save();rerender();toast('Local guardado');});
act('ciMode',el=>{CI.st.mode=el.dataset.id==='2d'?'2d':'3d';logEv('mapa','vista '+CI.st.mode);rerender();});
act('ciRot',()=>{CI.st.rot=(CI.st.rot+1)%4;CI.draw();});
act('ciFull',()=>{const s=document.getElementById('ci-stage');if(!s)return;if(document.fullscreenElement)document.exitFullscreen();else if(s.requestFullscreen)s.requestFullscreen().catch(()=>toast('Este navegador no permite pantalla completa',1));});
act('ciSel',el=>{CI.st.sel=CI.st.sel===el.dataset.id?null:el.dataset.id;rerender();});
act('ciInv',el=>{if(typeof invF!=='undefined')invF.rub=el.dataset.id;go('inventario');});
act('ciPerson',el=>{if(seeTeam())personModal(el.dataset.id);});
act('ciLog',()=>{modal('Registro del Centro Inteligente',`<p class="sm mut">Actividad y errores del módulo en este equipo (los errores no afectan al resto del sistema).</p>${CI.log.length?`<div class="tw" style="max-height:360px;overflow:auto"><table data-nosort><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>${CI.log.slice().reverse().slice(0,80).map(x=>`<tr><td>${E(fmtDT(x.ts))}</td><td>${x.kind==='error'?'<span class="tag bad">error</span>':E(x.kind)}</td><td>${E(x.msg)}${x.u?' <span class="mut">· '+E(x.u)+'</span>':''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="mut">Sin actividad todavía.</p>'}`,{okText:'Cerrar',noCancel:true});});
const ask=(q,byVoice)=>{q=String(q||'').trim().slice(0,200);if(!q)return;const a=CI.answer(q);CI.st.chat.push({q:(byVoice?'🎙 ':'')+q},{a});if(CI.st.chat.length>40)CI.st.chat.splice(0,CI.st.chat.length-40);logEv('gerente','consulta: '+intent(q));
 rerender();if(ttsOK())speak(a);else{const b=document.querySelector('.ci-root .ci-bot');if(b){b.classList.add('ci-talk');setTimeout(()=>b.classList.remove('ci-talk'),1400);}}};
act('ciAsk',()=>{const i=document.getElementById('ci-q');ask(i?i.value:'');});
act('ciMic',()=>listenStart());
act('ciMute',()=>{CI.st.mute=!CI.st.mute;if(CI.st.mute&&window.speechSynthesis)window.speechSynthesis.cancel();rerender();});
act('ciChip',el=>{const c=CHIPS.concat(MORE).find(x=>x[0]===el.dataset.id);ask(c?c[1]:el.dataset.id);});

/* ---------- registro en el menú (debajo de Resumen; sólo admin o roles habilitados) ---------- */
safe(()=>{IC.spark=IC.spark||'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z';
 reg('centro','Centro Inteligente','spark',null,()=>safe(view,'<div class="card"><h2>Centro Inteligente</h2><p>El Centro Inteligente tuvo un error y se detuvo. <b>El resto del sistema sigue funcionando.</b> El error quedó en su registro.</p></div>','pantalla'),()=>safe(after,null,'pantalla'),'Resumen');
 SCREENS.centro.show=()=>safe(()=>isAdm()||allowed(),false,'visible');
 if(Array.isArray(NAV)&&!NAV.some(x=>x[0]==='centro')){const i=NAV.findIndex(x=>x[0]==='inicio');NAV.splice(i+1,0,['centro','Resumen']);}},null,'registro');
})();
