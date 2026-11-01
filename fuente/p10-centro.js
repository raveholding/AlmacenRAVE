/* ===================================================================================================
   V26.37 · CENTRO INTELIGENTE — módulo aislado, apagado por defecto (Protocolo de aislamiento y protección)
   · Sólo LECTURA: nunca escribe ventas, caja, stock, clientes ni movimientos. La única escritura es su propia
     configuración (S.cfg.ci: encendido y roles que lo ven), hecha por el administrador y auditada.
   · Aislado: todo vive dentro de este archivo (espacio de nombres CI / clases «ci-»), con estilos encapsulados
     bajo .ci-root que se inyectan recién al abrir la pantalla y usan las variables de color del comercio.
   · Si falla, se apaga solo: cada pantalla, dibujo y acción está protegida; el error queda en su registro y el
     resto del sistema sigue funcionando.
   · Liviano: mapa 3D isométrico propio en <canvas> (sin librerías), vista 2D y lista accesible equivalente;
     Gerente IA local (reglas sobre los datos del equipo, sin proveedor externo ni envío de datos).
   =================================================================================================== */
(function(){
'use strict';
const CI={ver:'1.0',log:[],st:{mode:'3d',rot:0,sel:null,tab:'mapa',chat:[]},_hits:[]};
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
CI.isOn=isOn;CI.allowed=allowed;
const E=v=>typeof esc==='function'?esc(v):String(v);
const $m=c=>typeof money==='function'?money(c):String(c);
const col=c=>/^#[0-9a-fA-F]{6}$/.test(String(c||''))?c:'#8a6fb0';

/* ---------- estilos encapsulados (sólo dentro de .ci-root; no cambia variables globales) ---------- */
function css(){if(document.getElementById('ci-style'))return;const s=document.createElement('style');s.id='ci-style';s.textContent=`
.ci-root{--ci-r:14px}
.ci-root .ci-head{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap}
.ci-root .ci-head h1{margin:0;flex:1 1 auto}
.ci-root .ci-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem;margin:.7rem 0}
.ci-root .ci-kpi{border:1px solid var(--line);border-radius:var(--ci-r);padding:.6rem .8rem;background:var(--card)}
.ci-root .ci-kpi b{display:block;font-size:1.25rem}
.ci-root .ci-kpi span{font-size:.8rem;color:var(--mut)}
.ci-root .ci-tabs{display:flex;gap:.4rem;flex-wrap:wrap;margin:.4rem 0 .6rem}
.ci-root .ci-tabs button{min-height:44px}
.ci-root .ci-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:.8rem;align-items:start}
@media (max-width:900px){.ci-root .ci-grid{grid-template-columns:minmax(0,1fr)}}
.ci-root .ci-grid>*,.ci-root .ci-gm>*{min-width:0}
.ci-root .ci-stage{position:relative;border:1px solid var(--line);border-radius:var(--ci-r);background:var(--card);overflow:hidden}
.ci-root canvas.ci-cv{display:block;width:100%;height:420px;touch-action:manipulation;cursor:pointer}
@media (max-width:600px){.ci-root canvas.ci-cv{height:300px}}
.ci-root .ci-tools{display:flex;gap:.4rem;flex-wrap:wrap;padding:.5rem;border-top:1px solid var(--line)}
.ci-root .ci-tools button{min-height:44px;min-width:44px}
.ci-root .ci-legend{display:flex;gap:.8rem;flex-wrap:wrap;font-size:.8rem;color:var(--mut);padding:0 .6rem .6rem}
.ci-root .ci-dot{display:inline-block;width:.75rem;height:.75rem;border-radius:50%;vertical-align:middle;margin-right:.3rem;border:1px solid var(--line)}
.ci-root .ci-side{border:1px solid var(--line);border-radius:var(--ci-r);background:var(--card);padding:.8rem}
.ci-root .ci-side h3{margin:.1rem 0 .4rem}
.ci-root .ci-plist{max-height:360px;overflow:auto}
.ci-root .ci-prow{display:flex;justify-content:space-between;gap:.5rem;padding:.35rem 0;border-bottom:1px solid var(--line);font-size:.86rem}
.ci-root .ci-neg{color:var(--red)}
.ci-root .ci-low{color:#a86b00}
.ci-root .ci-gm{display:grid;grid-template-columns:120px minmax(0,1fr);gap:.8rem;align-items:start}
@media (max-width:600px){.ci-root .ci-gm{grid-template-columns:minmax(0,1fr)}}
.ci-root .ci-bot{width:110px;height:120px;color:var(--gold)}
.ci-root .ci-bot .ci-eye{transform-origin:center;transform-box:fill-box;animation:ci-blink 5s infinite}
.ci-root .ci-bot.ci-talk .ci-mouth{animation:ci-talk .35s infinite alternate;transform-origin:center;transform-box:fill-box}
@keyframes ci-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes ci-talk{from{transform:scaleY(.4)}to{transform:scaleY(1.1)}}
@media (prefers-reduced-motion:reduce){.ci-root .ci-bot .ci-eye,.ci-root .ci-bot.ci-talk .ci-mouth{animation:none}}
.ci-root .ci-chat{border:1px solid var(--line);border-radius:var(--ci-r);background:var(--card);padding:.6rem;max-height:380px;overflow:auto}
.ci-root .ci-msg{margin:.3rem 0;padding:.5rem .7rem;border-radius:12px;max-width:95%}
.ci-root .ci-msg.ci-q{background:var(--bg);margin-left:auto;width:fit-content}
.ci-root .ci-msg.ci-a{border:1px solid var(--line)}
.ci-root .ci-msg ul{margin:.3rem 0 .1rem 1.1rem;padding:0}
.ci-root .ci-ask{display:flex;gap:.4rem;margin-top:.5rem}
.ci-root .ci-ask input{flex:1;min-width:0}
.ci-root .ci-ask button,.ci-root .ci-chips button{min-height:44px}
.ci-root .ci-chips{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.5rem}
.ci-root .ci-off{border:1px dashed var(--line);border-radius:var(--ci-r);padding:1rem;background:var(--card)}
.ci-root .ci-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;document.head.appendChild(s);}

/* ---------- datos: SÓLO LECTURA (todo se arma con objetos nuevos; nunca se toca S) ---------- */
const ok=s=>s&&s.status==='ok';
function D(){const now0=typeof now==='function'?now():Date.now();const tk=dkey(now0);const yk=dkey(now0-86400000);
 const rubs=(S.rubros||[]).filter(r=>r.kind==='rubro');const prods=(S.products||[]).filter(p=>!p.archived&&p.active!==false);
 const sold={},sold7={},rubToday={};let tot=0,n=0,totY=0,nY=0;const d7=now0-7*86400000;
 (S.sales||[]).forEach(s=>{if(!ok(s))return;const k=dkey(s.ts);
  if(k===tk){tot+=s.total;n++;(s.items||[]).forEach(it=>{sold[it.pid]=(sold[it.pid]||0)+(+it.qty||0);rubToday[it.rubro]=(rubToday[it.rubro]||0)+lineTotal(it);});}
  else if(k===yk){totY+=s.total;nY++;}
  if(s.ts>=d7)(s.items||[]).forEach(it=>{sold7[it.pid]=(sold7[it.pid]||0)+(+it.qty||0);});});
 const R=rubs.map(r=>{const L=prods.filter(p=>p.rubro===r.id);const neg=L.filter(p=>p.stock<0),low=L.filter(p=>p.stock>=0&&p.stock<=5);
  return{id:r.id,name:r.name,owner:r.owner||'',color:col(r.color),items:L.length,units:L.reduce((a,p)=>a+Math.max(0,+p.stock||0),0),neg:neg.length,low:low.length,today:rubToday[r.id]||0,prods:L};});
 const open=(S.sessions||[]).filter(s=>!s.closedAt);
 return{tk,tot,n,totY,nY,R,prods,sold,sold7,open,negAll:prods.filter(p=>p.stock<0),lowAll:prods.filter(p=>p.stock>=0&&p.stock<=5),at:now0};}
CI.data=()=>safe(D,null,'datos');

/* ---------- mapa del local: 3D isométrico / 2D (canvas propio, sin librerías) ---------- */
function layout(R){const n=Math.max(1,R.length);const cols=Math.max(1,Math.min(4,Math.ceil(Math.sqrt(n*1.4))));const rows=Math.ceil(n/cols);
 const G=[];R.forEach((r,i)=>{const c=i%cols,w=Math.floor(i/cols);G.push({kind:'gond',r,x:1+c*3,y:1.8+w*2.6,w:2,d:1});});
 const W=Math.max(cols*3+1,7),Dp=rows*2.6+5;return{G,W,D:Dp};}
function shade(hex,f){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const m=x=>Math.max(0,Math.min(255,Math.round(f<0?x*(1+f):x+(255-x)*f)));return`rgb(${m(r)},${m(g)},${m(b)})`;}
function draw(){const cv=document.querySelector('.ci-root canvas.ci-cv');if(!cv)return;
 if(CI._failDraw){CI._failDraw=false;throw new Error('falla simulada del mapa (prueba de aislamiento)');}
 const ctx=cv.getContext&&cv.getContext('2d');if(!ctx){const f=document.querySelector('.ci-root .ci-nocv');if(f)f.hidden=false;return;}
 const dpr=Math.min(2,window.devicePixelRatio||1);const Wc=cv.clientWidth||600,Hc=cv.clientHeight||400;cv.width=Wc*dpr;cv.height=Hc*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
 const cs=getComputedStyle(cv);const ink=cs.getPropertyValue('--ink').trim()||'#242220',line=cs.getPropertyValue('--line').trim()||'#e6e0d6',bg=cs.getPropertyValue('--bg').trim()||'#f6f3ee',gold=cs.getPropertyValue('--gold').trim()||'#c9963e',mut=cs.getPropertyValue('--mut').trim()||'#6d675f';
 ctx.clearRect(0,0,Wc,Hc);const d=D();const L=layout(d.R);const st=CI.st;const is3=st.mode==='3d';
 const rot=((st.rot%4)+4)%4;const cx=L.W/2,cy=L.D/2;
 const rp=(x,y)=>{let dx=x-cx,dy=y-cy;for(let i=0;i<rot;i++){const t=dx;dx=-dy;dy=t;}return[dx,dy];};
 /* se ajusta la escala para que el local ocupe todo el lienzo (con margen para alturas y carteles) */
 const raw=(x,y,z)=>{const [a,b]=rp(x,y);return is3?[(a-b)*0.5,(a+b)*0.28-(z||0)*0.5]:[a,b];};
 const cn=[[0,0,0],[L.W,0,0],[L.W,L.D,0],[0,L.D,0],[0,0,2.4],[L.W,0,2.4],[L.W,L.D,2.4],[0,L.D,2.4]].map(c=>raw(c[0],c[1],is3?c[2]:0));
 const bx=[Math.min(...cn.map(c=>c[0])),Math.max(...cn.map(c=>c[0]))],by=[Math.min(...cn.map(c=>c[1])),Math.max(...cn.map(c=>c[1]))];
 const pad=24;const sc=Math.min((Wc-pad*2)/(bx[1]-bx[0]),(Hc-pad*2)/(by[1]-by[0]));
 const ox=Wc/2-(bx[0]+bx[1])/2*sc,oy=Hc/2-(by[0]+by[1])/2*sc;
 const P=(x,y,z)=>{const r=raw(x,y,z);return[ox+r[0]*sc,oy+r[1]*sc];};
 const poly=(pts,fill,stroke)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}};
 /* piso */
 poly([P(0,0),P(L.W,0),P(L.W,L.D),P(0,L.D)],bg,line);
 /* entrada (frente) y depósito (fondo) */
 const ent=[P(cx-1,L.D),P(cx+1,L.D)];ctx.strokeStyle=gold;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(ent[0][0],ent[0][1]);ctx.lineTo(ent[1][0],ent[1][1]);ctx.stroke();
 const items=[];
 items.push({kind:'dep',x:L.W-2.6,y:0.1,w:2.4,d:0.6,h:is3?1.2:0,color:'#9a8f80',label:'Depósito'});
 const nC=Math.max(1,d.open.length);for(let i=0;i<Math.min(nC,4);i++){const s=d.open[i];items.push({kind:'caja',x:0.6+i*1.8,y:L.D-1.4,w:1.4,d:0.7,h:is3?0.6:0,color:s?'#2e8b57':'#9a9a9a',label:s?(s.regName||('Caja '+(s.caja||1))):'Caja cerrada',sess:s});}
 const maxU=Math.max(1,...d.R.map(r=>r.units));
 L.G.forEach(g=>items.push({kind:'gond',x:g.x,y:g.y,w:g.w,d:g.d,h:is3?0.35+1.6*Math.min(1,g.r.units/maxU):0,color:g.r.color,label:g.r.name,r:g.r}));
 items.forEach(it=>{const c=rp(it.x+it.w/2,it.y+it.d/2);it.k=c[0]+c[1];});items.sort((a,b)=>a.k-b.k);
 CI._hits=[];
 items.forEach(it=>{const x0=it.x,y0=it.y,x1=it.x+it.w,y1=it.y+it.d,h=it.h;const sel=it.r&&st.sel===it.r.id;
  const base=[P(x0,y0),P(x1,y0),P(x1,y1),P(x0,y1)];
  if(is3){const top=[P(x0,y0,h),P(x1,y0,h),P(x1,y1,h),P(x0,y1,h)];
   /* caras laterales visibles: se dibujan las 4 y la de arriba encima (el orden de pintado resuelve la profundidad) */
   const sides=[[0,1],[1,2],[2,3],[3,0]];sides.forEach(([i,j],k)=>poly([base[i],base[j],top[j],top[i]],shade(it.color,k%2?-0.32:-0.18),'rgba(0,0,0,.18)'));
   poly(top,shade(it.color,0.12),sel?gold:'rgba(0,0,0,.25)');
   if(sel){ctx.lineWidth=3;ctx.strokeStyle=gold;ctx.stroke();}
   const hull=base.concat(top);CI._hits.push({it,pts:hullOf(hull)});
  }else{poly(base,shade(it.color,0.05),sel?gold:'rgba(0,0,0,.3)');if(sel){ctx.lineWidth=3;ctx.strokeStyle=gold;ctx.stroke();}CI._hits.push({it,pts:base});}
  });
 /* segunda pasada: alertas y nombres arriba de todo, para que ninguna góndola los tape */
 items.forEach(it=>{const x0=it.x,y0=it.y,h=it.h;
  if(it.r&&(it.r.neg||it.r.low)){const c=P(x0+it.w/2,y0+it.d/2,h+(is3?0.5:0));ctx.beginPath();ctx.arc(c[0],c[1]-(is3?0:0),Math.max(6,sc*0.16),0,7);ctx.fillStyle=it.r.neg?'#c0392b':'#e0a020';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();
   ctx.fillStyle='#fff';ctx.font='700 '+Math.max(9,Math.round(sc*0.2))+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(it.r.neg||it.r.low),c[0],c[1]);}
  /* nombre */
  const lc=P(x0+it.w/2,y0+it.d/2,h);const fs=Math.max(10,Math.min(14,Math.round(sc*0.22)));ctx.font='600 '+fs+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  const txt=String(it.label||'').slice(0,18);const tw=ctx.measureText(txt).width+8;const ly=lc[1]+(is3?-fs*0.2:0)+(it.r&&(it.r.neg||it.r.low)&&!is3?fs:0);
  ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(lc[0]-tw/2,ly-fs*0.7,tw,fs*1.4);ctx.fillStyle='#222';ctx.fillText(txt,lc[0],ly);});
 const lbl=document.querySelector('.ci-root .ci-cvsum');if(lbl)lbl.textContent='Mapa '+(is3?'3D':'2D')+' del local: '+d.R.length+' góndolas por rubro, '+d.open.length+' caja(s) abierta(s), '+d.negAll.length+' artículo(s) en stock negativo y '+d.lowAll.length+' con stock bajo. La lista de abajo tiene la misma información.';}
function hullOf(pts){const P=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[],up=[];
 P.forEach(p=>{while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);});for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}
 up.pop();lo.pop();return lo.concat(up);}
function inPoly(x,y,pts){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;}
CI.draw=()=>safe(draw,null,'mapa');

/* ---------- panel de la góndola (rubro): artículos, stock y ventas de hoy ---------- */
function sideHTML(d){const r=d.R.find(x=>x.id===CI.st.sel);
 if(!r)return`<div class="ci-side"><h3>Tocá una góndola</h3><p class="sm mut">Cada góndola es un rubro. La altura muestra cuánto stock tiene; el círculo rojo, artículos en negativo; el amarillo, stock bajo (5 o menos).</p>
  ${d.negAll.length||d.lowAll.length?`<p class="sm"><b>${d.negAll.length}</b> en negativo · <b>${d.lowAll.length}</b> con stock bajo.</p>`:'<p class="sm">Sin alertas de stock.</p>'}</div>`;
 const L=r.prods.slice().sort((a,b)=>(a.stock-b.stock)||a.name.localeCompare(b.name,'es'));
 return`<div class="ci-side"><h3><span class="ci-dot" style="background:${r.color}"></span>${E(r.name)}</h3><p class="sm mut">${r.owner?E(r.owner)+' · ':''}${r.items} artículos · vendido hoy ${$m(r.today)}</p>
  <div class="ci-plist">${L.map(p=>`<div class="ci-prow"><span>${E(p.name)}${p.sub?' <span class="mut">'+E(p.sub)+'</span>':''}</span><span class="${p.stock<0?'ci-neg':p.stock<=5?'ci-low':''}">${E(String(p.stock).replace('.',','))} ${p.unit==='u'?'u':E(p.unit)}${d.sold[p.id]?' · hoy '+E(String(d.sold[p.id]).replace('.',',')):''}</span></div>`).join('')||'<p class="sm mut">Sin artículos.</p>'}</div>
  <button class="btn sm" style="margin-top:.6rem;min-height:44px" data-act="ciInv" data-id="${E(r.id)}">Abrir en Inventario</button></div>`;}

/* ---------- Gerente IA (local, sólo lectura) ---------- */
const BOT=`<svg class="ci-bot" viewBox="0 0 120 130" role="img" aria-label="Gerente IA"><line x1="60" y1="8" x2="60" y2="24" stroke="currentColor" stroke-width="4"/><circle cx="60" cy="8" r="6" fill="currentColor"/>
 <rect x="18" y="24" width="84" height="64" rx="18" fill="var(--card)" stroke="currentColor" stroke-width="4"/>
 <ellipse class="ci-eye" cx="44" cy="52" rx="8" ry="9" fill="var(--ink)"/><ellipse class="ci-eye" cx="76" cy="52" rx="8" ry="9" fill="var(--ink)"/>
 <rect class="ci-mouth" x="44" y="70" width="32" height="7" rx="3.5" fill="currentColor"/><rect x="34" y="94" width="52" height="30" rx="10" fill="currentColor" opacity=".85"/>
 <rect x="8" y="46" width="10" height="20" rx="4" fill="currentColor"/><rect x="102" y="46" width="10" height="20" rx="4" fill="currentColor"/></svg>`;
const CHIPS=[['hoy','¿Cómo vamos hoy?'],['reponer','¿Qué tengo que reponer?'],['top','¿Qué se vende más?'],['caja','¿Cómo está la caja?'],['margen','¿Qué rubro deja más margen?'],['deuda','¿Quién me debe?']];
const fold=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function intent(q){const t=fold(q);
 if(/(hoy|vamos|resumen|como va|dia)/.test(t))return'hoy';if(/(repon|falta|stock|negativ|agot|bajo)/.test(t))return'reponer';
 if(/(mas vend|top|se vende|mejor|estrella)/.test(t))return'top';if(/(caja|efectivo|cajon|arqueo)/.test(t))return'caja';
 if(/(margen|ganancia|rentab|deja mas)/.test(t))return'margen';if(/(debe|deuda|fiado|cuenta corriente|cta)/.test(t))return'deuda';
 if(/(ayuda|que podes|que sabes)/.test(t))return'ayuda';return'buscar';}
function answer(q){const d=D();const k=intent(q);const li=a=>'<ul>'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>';const H=x=>x;
 if(k==='hoy'){const tp=d.n?Math.round(d.tot/d.n):0;const dif=d.totY?Math.round((d.tot-d.totY)/d.totY*100):null;const best=d.R.slice().sort((a,b)=>b.today-a.today)[0];
  return H(`Hoy llevás <b>${$m(d.tot)}</b> en ${d.n} venta(s)${d.n?', ticket promedio '+$m(tp):''}.`+li([dif==null?'Ayer no hubo ventas para comparar.':'Contra ayer ('+$m(d.totY)+'): '+(dif>=0?'+':'')+dif+' %.',best&&best.today?'El rubro que más vendió: <b>'+E(best.name)+'</b> ('+$m(best.today)+').':'Todavía no hay ventas por rubro hoy.',(d.negAll.length+d.lowAll.length)?'Alertas de stock: '+d.negAll.length+' en negativo y '+d.lowAll.length+' bajos (preguntame «¿qué tengo que reponer?»).':'Sin alertas de stock.']));}
 if(k==='reponer'){const L=d.negAll.concat(d.lowAll).sort((a,b)=>a.stock-b.stock).slice(0,10);if(!L.length)return'No hay artículos con stock bajo (5 o menos) ni en negativo.';
  return H(`Para reponer primero (${d.negAll.length} en negativo, ${d.lowAll.length} con 5 o menos):`+li(L.map(p=>E(p.name)+(p.sub?' '+E(p.sub):'')+': <b class="'+(p.stock<0?'ci-neg':'ci-low')+'">'+E(String(p.stock).replace('.',','))+'</b>'+(d.sold7[p.id]?' · vendió '+E(String(d.sold7[p.id]).replace('.',','))+' en 7 días':''))));}
 if(k==='top'){const T=Object.entries(d.sold7).map(([id,q])=>({p:(S.products||[]).find(x=>x.id===id),q})).filter(x=>x.p).sort((a,b)=>b.q-a.q).slice(0,5);
  if(!T.length)return'No hay ventas en los últimos 7 días para armar el ranking.';return H('Lo más vendido en los últimos 7 días (unidades):'+li(T.map((x,i)=>(i+1)+'. '+E(x.p.name)+': <b>'+E(String(x.q).replace('.',','))+'</b>')));}
 if(k==='caja'){if(!(can('close_cash')||can('cash_mov')||isAdm()))return'No tenés permiso para ver la caja.';if(!d.open.length)return'No hay cajas abiertas en este momento.';
  return H(`Hay ${d.open.length} caja(s) abierta(s):`+li(d.open.map(s=>{const e=safe(()=>typeof arqueoCalc==='function'?arqueoCalc(s,{emp:null,hours:0,rate:0,merienda:0,gastosManual:0,declared:NaN,taxes:{},payFromCash:false,detailAll:false,mono:true,notes:''}).expectedCash:null,null,'caja');
   return E(s.regName||('Caja '+(s.caja||1)))+': abierta desde '+E(fmtDT(s.openedAt||s.ts||Date.now()))+(e!=null?' · efectivo esperado <b>'+$m(e)+'</b>':'');}))+'<span class="sm mut">Es lo que el sistema calcula; el conteo real se hace en Arqueo.</span>');}
 if(k==='margen'){if(!can('view_cost'))return'Para ver márgenes necesitás el permiso «Ver costos y ganancias».';const d30=d.at-30*86400000;const M={};
  (S.sales||[]).forEach(s=>{if(!ok(s)||s.ts<d30)return;(s.items||[]).forEach(it=>{const m=M[it.rubro]||(M[it.rubro]={v:0,c:0});m.v+=lineTotal(it);m.c+=lineCost(it);});});
  const L=d.R.map(r=>({r,m:M[r.id]||{v:0,c:0}})).filter(x=>x.m.v>0).map(x=>({...x,p:(x.m.v-x.m.c)/x.m.v*100})).sort((a,b)=>b.p-a.p);
  if(!L.length)return'No hay ventas con costo en los últimos 30 días.';return H('Margen bruto estimado por rubro (30 días, sin impuestos ni gastos):'+li(L.map(x=>E(x.r.name)+': <b>'+x.p.toFixed(1).replace('.',',')+' %</b> sobre '+$m(x.m.v))));}
 if(k==='deuda'){if(!can('customers'))return'Para ver deudas de clientes necesitás el permiso «Clientes».';const L=(S.customers||[]).filter(c=>c.status!=='baja').map(c=>({c,d:typeof debtOf==='function'?debtOf(c.id):0})).filter(x=>x.d>0).sort((a,b)=>b.d-a.d);
  if(!L.length)return'Nadie te debe en cuenta corriente.';const tot=L.reduce((a,x)=>a+x.d,0);return H(`Te deben <b>${$m(tot)}</b> entre ${L.length} cliente(s):`+li(L.slice(0,8).map(x=>E(typeof custFull==='function'?custFull(x.c):(x.c.name||''))+': '+$m(x.d))));}
 if(k==='ayuda')return H('Puedo responder con los datos de este equipo (sólo leo, no cambio nada):'+li(CHIPS.map(c=>E(c[1])))+'También podés escribir un artículo («fernet 750») o un precio («3500») y te digo su stock y ventas.');
 const Q=typeof invQueryParse==='function'?invQueryParse(q):null;const F=Q&&typeof prodMatch==='function'?(S.products||[]).filter(p=>!p.archived&&prodMatch(p,Q)).slice(0,6):[];
 if(F.length)return H('Encontré:'+li(F.map(p=>E(p.name)+(p.sub?' '+E(p.sub):'')+': '+$m(p.price)+' · stock <b class="'+(p.stock<0?'ci-neg':p.stock<=5?'ci-low':'')+'">'+E(String(p.stock).replace('.',','))+'</b>'+(d.sold7[p.id]?' · '+E(String(d.sold7[p.id]).replace('.',','))+' vendidos en 7 días':''))));
 return'No entendí la pregunta. Probá con «¿cómo vamos hoy?», «¿qué tengo que reponer?» o escribí un artículo.';}
CI.answer=q=>safe(()=>answer(q),'No pude responder ahora (el error quedó registrado).','gerente');

/* ---------- pantalla ---------- */
function kpis(d){return`<div class="ci-kpis"><div class="ci-kpi"><span>Ventas de hoy</span><b>${$m(d.tot)}</b><span>${d.n} venta(s)</span></div>
 <div class="ci-kpi"><span>Cajas abiertas</span><b>${d.open.length}</b><span>${d.open.map(s=>E(s.regName||('Caja '+(s.caja||1)))).join(', ')||'—'}</span></div>
 <div class="ci-kpi"><span>Stock negativo</span><b class="${d.negAll.length?'ci-neg':''}">${d.negAll.length}</b><span>artículos</span></div>
 <div class="ci-kpi"><span>Stock bajo (≤ 5)</span><b class="${d.lowAll.length?'ci-low':''}">${d.lowAll.length}</b><span>artículos</span></div></div>`;}
function offHTML(){const roles=Object.keys((typeof S!=='undefined'&&S.roles)||{}).filter(r=>r!=='admin');const c=cfg();
 return`<div class="ci-off"><h3 style="margin-top:0">El Centro Inteligente está apagado</h3><p class="sm">Es un módulo aparte: mapa 2D/3D del local por rubros, alertas de stock y un Gerente IA que responde con los datos de este equipo. <b>Sólo lee</b>: no cambia ventas, caja, inventario ni la sincronización. Apagarlo no borra nada.</p>
  ${roles.length?`<fieldset style="border:1px solid var(--line);border-radius:12px;padding:.5rem .7rem;margin:.6rem 0"><legend class="sm"><b>Además del administrador, lo pueden ver:</b></legend>${roles.map(r=>`<label class="chk"><input type="checkbox" class="ci-role" value="${E(r)}" ${(c.roles||[]).includes(r)?'checked':''}> ${E(r)}</label>`).join('')}</fieldset>`:''}
  <button class="btn gold" style="min-height:48px" data-act="ciToggle">Activar el Centro Inteligente</button></div>`;}
function view(){if(CI._failRender){CI._failRender=false;throw new Error('falla simulada de la pantalla (prueba de aislamiento)');}
 css();const adm=isAdm();
 if(!isOn())return`<div class="ci-root"><div class="ci-head"><h1>Centro Inteligente</h1></div>${adm?offHTML():'<p class="mut">El administrador no activó el Centro Inteligente.</p>'}</div>`;
 const d=D();const st=CI.st;const t=st.tab;
 const tabs=`<div class="ci-tabs" role="tablist">${[['mapa','Mapa del local'],['gerente','Gerente IA'],['registro','Registro']].map(([k,l])=>`<button class="btn sm ${t===k?'on':''}" role="tab" aria-selected="${t===k}" data-act="ciTab" data-id="${k}">${l}</button>`).join('')}</div>`;
 let body='';
 if(t==='mapa')body=`<div class="ci-grid"><div><div class="ci-stage"><canvas class="ci-cv" aria-hidden="true"></canvas><p class="ci-sr ci-cvsum" aria-live="polite"></p><p class="ci-nocv" hidden style="padding:1rem">Este equipo no puede dibujar el mapa; usá la lista de abajo.</p>
   <div class="ci-tools"><button class="btn sm ${st.mode==='3d'?'on':''}" data-act="ciMode" data-id="3d">3D</button><button class="btn sm ${st.mode==='2d'?'on':''}" data-act="ciMode" data-id="2d">2D</button><button class="btn sm" data-act="ciRot" aria-label="Girar el mapa">⟳ Girar</button></div>
   <div class="ci-legend"><span><i class="ci-dot" style="background:#c0392b"></i>stock negativo</span><span><i class="ci-dot" style="background:#e0a020"></i>stock bajo</span><span><i class="ci-dot" style="background:#2e8b57"></i>caja abierta</span><span>Altura = stock</span></div></div>
   <div class="tw" style="margin-top:.6rem"><table data-nosort><caption class="ci-sr">Góndolas por rubro (misma información que el mapa)</caption><thead><tr><th>Rubro</th><th class="r">Artículos</th><th class="r">Negativo</th><th class="r">Bajo</th><th class="r">Vendido hoy</th><th></th></tr></thead><tbody>
   ${d.R.map(r=>`<tr><td><span class="ci-dot" style="background:${r.color}"></span>${E(r.name)}</td><td class="r">${r.items}</td><td class="r ${r.neg?'ci-neg':''}">${r.neg}</td><td class="r ${r.low?'ci-low':''}">${r.low}</td><td class="r">${$m(r.today)}</td><td><button class="btn sm" style="min-height:44px" data-act="ciSel" data-id="${E(r.id)}">Ver</button></td></tr>`).join('')}</tbody></table></div></div>
   ${sideHTML(d)}</div>`;
 else if(t==='gerente')body=`<div class="ci-gm"><div>${BOT}<p class="sm mut">Gerente IA · responde con los datos de este equipo. Sólo lee.</p></div><div><div class="ci-chat" aria-live="polite">${st.chat.length?st.chat.map(m=>`<div class="ci-msg ${m.q?'ci-q':'ci-a'}">${m.q?E(m.q):m.a}</div>`).join(''):`<div class="ci-msg ci-a">Hola${typeof user!=='undefined'&&user?', '+E(user.name):''}. Preguntame cómo va el día, qué reponer, qué se vende más, cómo está la caja, márgenes o deudas.</div>`}</div>
   <div class="ci-ask"><label class="ci-sr" for="ci-q">Pregunta al Gerente IA</label><input id="ci-q" autocomplete="off" maxlength="200" placeholder="Escribí tu pregunta o un artículo"><button class="btn gold" data-act="ciAsk">Preguntar</button></div>
   <div class="ci-chips">${CHIPS.map(c=>`<button class="btn sm" data-act="ciChip" data-id="${c[0]}">${E(c[1])}</button>`).join('')}</div></div></div>`;
 else body=`<div class="card"><p class="sm mut">Actividad y errores del Centro Inteligente en este equipo (los errores no afectan al resto del sistema).</p>${CI.log.length?`<div class="tw"><table data-nosort><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>${CI.log.slice().reverse().slice(0,60).map(x=>`<tr><td>${E(fmtDT(x.ts))}</td><td>${x.kind==='error'?'<span class="tag bad">error</span>':E(x.kind)}</td><td>${E(x.msg)}${x.u?' <span class="mut">· '+E(x.u)+'</span>':''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="mut">Sin actividad todavía.</p>'}</div>`;
 return`<div class="ci-root"><div class="ci-head"><h1>Centro Inteligente</h1><span class="tag ok">Sólo lectura</span>${adm?'<button class="btn sm" style="min-height:44px" data-act="ciToggle">Desactivar</button>':''}</div>
  <p class="sm mut">Datos de este equipo al ${E(fmtDT(d.at))}. No cambia ventas, caja, inventario ni la sincronización.</p>${kpis(d)}${tabs}${body}</div>`;}
function after(){if(!isOn())return;if(CI.st.tab==='mapa'){draw();const cv=document.querySelector('.ci-root canvas.ci-cv');if(cv)cv.addEventListener('click',e=>safe(()=>{const b=cv.getBoundingClientRect();const x=e.clientX-b.left,y=e.clientY-b.top;
   for(let i=CI._hits.length-1;i>=0;i--){const h=CI._hits[i];if(inPoly(x,y,h.pts)){if(h.it.r){CI.st.sel=h.it.r.id;logEv('mapa','góndola '+h.it.r.name);rerender();}else if(h.it.kind==='caja'){go('caja');}return;}}},null,'clic mapa'));}
 if(CI.st.tab==='gerente'){const i=document.getElementById('ci-q');if(i)i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();A.ciAsk();}});const c=document.querySelector('.ci-root .ci-chat');if(c)c.scrollTop=c.scrollHeight;}}
let rz;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(document.querySelector('.ci-root canvas.ci-cv'))CI.draw();},150);});

/* ---------- acciones (todas protegidas) ---------- */
const act=(name,fn)=>{A[name]=(el,e)=>safe(()=>fn(el,e),null,name);};
act('ciToggle',()=>{if(!isAdm())return toast('Sólo el administrador activa o desactiva el Centro Inteligente',1);const was=isOn();
 const roles=was?(cfg().roles||[]):[...document.querySelectorAll('.ci-root .ci-role:checked')].map(x=>x.value);
 S.cfg.ci=Object.assign({},cfg(),{on:!was,roles,by:user.name,at:now()});audit('CENTRO_INTELIGENTE',(was?'desactivado':'activado')+(was?'':' · lo ven: administrador'+(roles.length?', '+roles.join(', '):'')));
 logEv(was?'desactivado':'activado','por '+user.name);CI.st.sel=null;save();rerender();toast(was?'Centro Inteligente desactivado. El sistema sigue igual.':'Centro Inteligente activado (sólo lectura).');});
act('ciTab',el=>{CI.st.tab=el.dataset.id;rerender();});
act('ciMode',el=>{CI.st.mode=el.dataset.id==='2d'?'2d':'3d';logEv('mapa','vista '+CI.st.mode);rerender();});
act('ciRot',()=>{CI.st.rot=(CI.st.rot+1)%4;CI.draw();});
act('ciSel',el=>{CI.st.sel=el.dataset.id;rerender();});
act('ciInv',el=>{if(typeof invF!=='undefined')invF.rub=el.dataset.id;go('inventario');});
const ask=q=>{q=String(q||'').trim().slice(0,200);if(!q)return;const a=CI.answer(q);CI.st.chat.push({q},{a});if(CI.st.chat.length>40)CI.st.chat.splice(0,CI.st.chat.length-40);logEv('gerente','consulta: '+intent(q));
 rerender();const b=document.querySelector('.ci-root .ci-bot');if(b){b.classList.add('ci-talk');setTimeout(()=>b.classList.remove('ci-talk'),1400);}};
act('ciAsk',()=>{const i=document.getElementById('ci-q');ask(i?i.value:'');});
act('ciChip',el=>{const c=CHIPS.find(x=>x[0]===el.dataset.id);ask(c?c[1]:el.dataset.id);});

/* ---------- registro en el menú (al final de Resumen; sólo admin o roles habilitados) ---------- */
safe(()=>{IC.spark=IC.spark||'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z';
 reg('centro','Centro Inteligente','spark',null,()=>safe(view,'<div class="card"><h2>Centro Inteligente</h2><p>El Centro Inteligente tuvo un error y se detuvo. <b>El resto del sistema sigue funcionando.</b> El error quedó en su registro.</p></div>','pantalla'),()=>safe(after,null,'pantalla'),'Resumen');
 SCREENS.centro.show=()=>safe(()=>isAdm()||allowed(),false,'visible');
 if(Array.isArray(NAV)&&!NAV.some(x=>x[0]==='centro')){const i=NAV.findIndex(x=>x[0]==='inicio');NAV.splice(i+1,0,['centro','Resumen']);}},null,'registro');
})();
