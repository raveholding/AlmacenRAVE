/* ===== V26.79 · Atención al cliente: Pipeline de ventas (Kanban), datos de tarjeta, modo agente y diseño =====
   Se engancha al CRM existente (p6j-crm.js, p6l-omni.js, p6m-omni2.js) sin reescribirlo:
   · Pestaña «Oportunidades»: embudo por etapas editables con arrastrar y soltar (mouse y dedo), flechas y teclado (Alt + ←/→).
   · «＋ Oportunidad» desde la conversación; el presupuesto del chat crea/actualiza la oportunidad y al convertirlo en venta se gana sola.
   · Datos de tarjeta (Luhn), CVV y PIN se ocultan SIEMPRE antes de guardar o enviar un mensaje del CRM.
   · Modo agente: sólo mis conversaciones y la cola sin asignar, sin configuración.
   Nube: colección «deal» (SQL 31); la app la sube recién cuando vb_version() ≥ 31. Apagado en Almacén RAVE hasta activarlo. */

GI_MODS.push({k:'pipeline',t:'Pipeline de ventas (oportunidades)',d:'Embudo comercial tipo Kanban dentro de Atención al cliente: etapas editables, arrastrar y soltar, montos, prioridad, próxima acción, pronóstico ponderado y ganado/perdido con motivo.',plan:'mayorista',scr:'crm'});
if(typeof GI_PACKS!=='undefined'){['both','may','todo'].forEach(ch=>{if(GI_PACKS[ch]&&!GI_PACKS[ch].k.includes('pipeline'))GI_PACKS[ch].k.push('pipeline');});}

/* ---------- 1) Datos de tarjeta: nunca se guardan ni se envían ---------- */
function vbLuhn(d){let s=0,alt=false;for(let i=d.length-1;i>=0;i--){let n=+d[i];if(alt){n*=2;if(n>9)n-=9;}s+=n;alt=!alt;}return s%10===0;}
/* devuelve {t: texto seguro, hit: cantidad de datos ocultados} */
function vbCardScrub(t){t=String(t==null?'':t);let hit=0;
 t=t.replace(/(?:\d[ \-.]?){12,18}\d/g,m=>{const d=m.replace(/\D/g,'');if(d.length<13||d.length>19||!vbLuhn(d)||/^(\d)\1+$/.test(d))return m;hit++;return'•••• '+d.slice(-4)+' [tarjeta oculta]';});
 t=t.replace(/\b(cvv2?|cvc2?|c[oó]digo de seguridad|cod\.? seg\.?)\b(\s*(?:es|:|=|-)?\s*)(\d{3,4})\b/gi,(m,a,b)=>{hit++;return a+b+'[oculto]';});
 t=t.replace(/\b(pin|clave(?: de la tarjeta| del cajero)?)\b(\s*(?:es|:|=|-)?\s*)(\d{4,6})\b/gi,(m,a,b)=>{hit++;return a+b+'[oculto]';});
 return{t,hit};}
{const _add=crmAdd;crmAdd=function(c,dir,text,extra){const r=vbCardScrub(text);const m=_add.call(this,c,dir,r.t,extra);
 if(r.hit&&c&&dir!=='note'&&dir!=='sys'){try{_add.call(this,c,'note','🔒 Se ocultaron '+r.hit+' dato(s) de tarjeta o clave del mensaje. Por seguridad no se guardan: pedí el pago por el link oficial o en el local.',{kind:'seguridad'});audit('CRM_DATO_TARJETA',(typeof crmWho==='function'?crmWho(c):c.id)+' · '+r.hit+' dato(s) ocultos ('+(dir==='in'?'entrante':'saliente')+')');}catch(e){}}return m;};}
{const _send=crmSend;crmSend=async function(c,text,extra){return _send.call(this,c,vbCardScrub(text).t,extra);};}

/* ---------- 2) Oportunidades: datos y lógica ---------- */
const dls=()=>S.deals||(S.deals=[]);
const DL_DEF=[{k:'calificado',t:'Calificado',p:10},{k:'contacto',t:'Contacto realizado',p:25},{k:'reunion',t:'Reunión / demo agendada',p:40},{k:'propuesta',t:'Propuesta enviada',p:60},{k:'negociacion',t:'Negociación',p:80}];
const DL_LOST=['Precio','Eligió a la competencia','Sin stock','No respondió','No lo necesita','Otro'];
const DL_PRIO={alta:'Alta',media:'Media',baja:'Baja'};
function dlStages(){const C=S.cfg.crm||{};const L=Array.isArray(C.stages)&&C.stages.length?C.stages:DL_DEF;return L;}
const dlStage=k=>dlStages().find(s=>s.k===k);
const dlOn=()=>giOn('pipeline')&&typeof crmCfg==='function';
function dlById(id){return dls().find(d=>d.id===id);}
function dlAmt(d){return Math.max(0,Math.round(+d.amount||0));}
/* o: {title, cust, conv, amount, stage, prio, owner, next, nextAt, tags, quote, prods} */
function dlCreate(o){if(!dlOn())return{err:'El pipeline de ventas está apagado.'};if(!can('crm'))return{err:'Sin permiso.'};
 const t=String(o.title||'').replace(/[<>]/g,'').trim().slice(0,80);if(t.length<2)return{err:'Escribí un título.'};const st=o.stage&&dlStage(o.stage)?o.stage:dlStages()[0].k;
 const cu=o.cust?custById(o.cust):null;const cv=o.conv&&typeof convById==='function'?convById(o.conv):null;
 const d={id:uid(),n:vbSeq('seqOP','OP-',4),ts:now(),upd:now(),stAt:now(),title:t,cust:cu?cu.id:'',custName:cu?custFull(cu):(cv&&typeof crmWho==='function'?crmWho(cv):String(o.custName||'').slice(0,60)),conv:cv?cv.id:'',
  amount:Math.max(0,Math.round(+o.amount||0)),stage:st,prio:DL_PRIO[o.prio]?o.prio:'media',owner:String(o.owner||(typeof crmMe==='function'?crmMe():user.name)).slice(0,40),
  next:String(o.next||'').replace(/[<>]/g,'').slice(0,120),nextAt:/^\d{4}-\d{2}-\d{2}$/.test(o.nextAt||'')?o.nextAt:'',tags:(o.tags||[]).map(x=>String(x).replace(/[<>]/g,'').slice(0,20)).slice(0,6),
  quote:o.quote||'',prods:(o.prods||[]).slice(0,30),status:'open',hist:[{ts:now(),u:user.name,to:st}]};
 dls().push(d);audit('OPORTUNIDAD',d.n+' · '+d.title+' · '+d.custName+' · '+money(d.amount)+' · '+dlStage(st).t);if(cv)crmAdd(cv,'sys','Oportunidad '+d.n+' · '+d.title+' · '+money(d.amount),{kind:'deal'});save();return{d};}
function dlMove(id,to){const d=dlById(id);if(!d)return{err:'Oportunidad inexistente.'};if(!can('crm'))return{err:'Sin permiso.'};if(d.status!=='open')return{err:'Está cerrada: reabrila para moverla.'};
 if(!dlStage(to))return{err:'Etapa inexistente.'};if(d.stage===to)return{d};const from=d.stage;d.stage=to;d.stAt=now();d.upd=now();d.hist.push({ts:now(),u:user.name,from,to});
 audit('OPORTUNIDAD_ETAPA',d.n+' · '+(dlStage(from)||{t:from}).t+' → '+dlStage(to).t);save();return{d};}
function dlStep(id,dir){const d=dlById(id);if(!d)return{err:'Oportunidad inexistente.'};const L=dlStages();const i=L.findIndex(s=>s.k===d.stage);const j=i+dir;if(j<0||j>=L.length)return{err:'No hay etapa '+(dir>0?'siguiente':'anterior')+'.'};return dlMove(id,L[j].k);}
function dlWin(id,why){const d=dlById(id);if(!d)return{err:'Oportunidad inexistente.'};if(!can('crm'))return{err:'Sin permiso.'};if(d.status!=='open')return{err:'Ya está cerrada.'};
 d.status='won';d.closedAt=now();d.upd=now();d.hist.push({ts:now(),u:user.name,to:'ganado',why:why||''});audit('OPORTUNIDAD_GANADA',d.n+' · '+d.title+' · '+money(dlAmt(d))+(why?' · '+why:''));
 const cv=d.conv&&convById(d.conv);if(cv)crmAdd(cv,'sys','🏆 Oportunidad '+d.n+' ganada · '+money(dlAmt(d)),{kind:'deal'});save();return{d};}
function dlLose(id,why){const d=dlById(id);if(!d)return{err:'Oportunidad inexistente.'};if(!can('crm'))return{err:'Sin permiso.'};if(d.status!=='open')return{err:'Ya está cerrada.'};
 why=String(why||'').trim();if(why.length<2)return{err:'Elegí el motivo de la pérdida.'};d.status='lost';d.lostWhy=why.slice(0,80);d.closedAt=now();d.upd=now();d.hist.push({ts:now(),u:user.name,to:'perdido',why:d.lostWhy});
 audit('OPORTUNIDAD_PERDIDA',d.n+' · '+d.title+' · '+d.lostWhy);save();return{d};}
function dlReopen(id){const d=dlById(id);if(!d||d.status==='open')return{err:'No está cerrada.'};if(!can('crm'))return{err:'Sin permiso.'};d.status='open';d.closedAt=0;d.lostWhy='';d.stAt=now();d.upd=now();d.hist.push({ts:now(),u:user.name,to:d.stage,why:'reabierta'});audit('OPORTUNIDAD_REABIERTA',d.n);save();return{d};}
function dlEdit(id,o){const d=dlById(id);if(!d)return{err:'Oportunidad inexistente.'};if(!can('crm'))return{err:'Sin permiso.'};
 if(o.title!==undefined){const t=String(o.title).replace(/[<>]/g,'').trim().slice(0,80);if(t.length<2)return{err:'Escribí un título.'};d.title=t;}
 if(o.amount!==undefined){const a=Math.round(+o.amount);if(!(a>=0))return{err:'Monto inválido.'};d.amount=a;}
 if(o.prio&&DL_PRIO[o.prio])d.prio=o.prio;if(o.owner!==undefined)d.owner=String(o.owner).slice(0,40);if(o.next!==undefined)d.next=String(o.next).replace(/[<>]/g,'').slice(0,120);
 if(o.nextAt!==undefined)d.nextAt=/^\d{4}-\d{2}-\d{2}$/.test(o.nextAt)?o.nextAt:'';if(o.tags)d.tags=o.tags.map(x=>String(x).replace(/[<>]/g,'').trim().slice(0,20)).filter(Boolean).slice(0,6);
 d.upd=now();audit('OPORTUNIDAD_EDITADA',d.n);save();return{d};}
/* el presupuesto del chat crea o actualiza la oportunidad; al convertirlo en venta se gana sola */
function dlSync(){if(!dlOn())return;const Q=typeof quotes==='function'?quotes():[];let ch=0;
 for(const q of Q){if(!q.conv)continue;let d=dls().find(x=>x.quote===q.id)||dls().find(x=>x.conv===q.conv&&x.status==='open'&&!x.quote);
  const tot=typeof qtTotal==='function'?qtTotal(q):0;
  if(!d&&qtState(q)==='vigente'&&!q.dlSeen){q.dlSeen=1;const cv=convById(q.conv);const L=dlStages();const pr=L.find(s=>s.k==='propuesta')||L[Math.min(3,L.length-1)];
   d={id:uid(),n:vbSeq('seqOP','OP-',4),ts:now(),upd:now(),stAt:now(),title:'Presupuesto '+q.n,cust:q.cust||'',custName:cv?crmWho(cv):(q.name||''),conv:q.conv,amount:tot,stage:pr.k,prio:'media',owner:(cv&&cv.asg)||crmMe(),next:'Seguimiento del presupuesto',nextAt:q.exp?dkey(q.exp):'',tags:[],quote:q.id,prods:[],status:'open',hist:[{ts:now(),u:'sistema',to:pr.k,why:'presupuesto '+q.n}]};
   dls().push(d);audit('OPORTUNIDAD',d.n+' · desde el presupuesto '+q.n+' · '+money(tot));ch=1;continue;}
  if(d&&!d.quote&&q.conv===d.conv){d.quote=q.id;d.amount=tot;const L=dlStages();const pr=L.find(s=>s.k==='propuesta');if(pr&&L.findIndex(s=>s.k===d.stage)<L.indexOf(pr)){d.hist.push({ts:now(),u:'sistema',from:d.stage,to:pr.k,why:'presupuesto '+q.n});d.stage=pr.k;d.stAt=now();}d.upd=now();ch=1;}
  if(d&&d.status==='open'&&d.quote===q.id&&qtState(q)==='convertido'){d.status='won';d.closedAt=now();d.amount=tot||d.amount;d.hist.push({ts:now(),u:'sistema',to:'ganado',why:'presupuesto convertido en venta '+(q.saleN||'')});audit('OPORTUNIDAD_GANADA',d.n+' · presupuesto '+q.n+' convertido en venta');ch=1;}}
 return ch;}
{const _sv=save;save=function(){try{dlSync();}catch(e){}return _sv.apply(this,arguments);};}
/* métricas del embudo */
function dlStats(f){f=f||{};const D=dls().filter(d=>(!f.owner||d.owner===f.owner));const open=D.filter(d=>d.status==='open');const L=dlStages();
 const t0=new Date(now());t0.setDate(1);t0.setHours(0,0,0,0);const won=D.filter(d=>d.status==='won'),lost=D.filter(d=>d.status==='lost');
 const cyc=won.filter(d=>d.closedAt).map(d=>(d.closedAt-d.ts)/864e5);const lw={};lost.forEach(d=>lw[d.lostWhy]=(lw[d.lostWhy]||0)+1);
 return{open:open.length,value:open.reduce((a,d)=>a+dlAmt(d),0),weighted:Math.round(open.reduce((a,d)=>a+dlAmt(d)*((dlStage(d.stage)||{p:0}).p/100),0)),
  wonMonth:won.filter(d=>d.closedAt>=t0.getTime()).reduce((a,d)=>a+dlAmt(d),0),winRate:won.length+lost.length?Math.round(won.length/(won.length+lost.length)*100):0,
  cycle:cyc.length?Math.round(cyc.reduce((a,b)=>a+b,0)/cyc.length*10)/10:0,lostWhy:lw,byStage:L.map(s=>{const X=open.filter(d=>d.stage===s.k);return{k:s.k,n:X.length,v:X.reduce((a,d)=>a+dlAmt(d),0)};})};}

/* ---------- 3) Pantalla Kanban ---------- */
let dlF={owner:'',prio:'',q:'',show:'open'};
const dlDays=d=>Math.floor((now()-(d.stAt||d.ts))/864e5);
function dlCard(d){const late=d.nextAt&&d.nextAt<dkey(now())&&d.status==='open';const age=dlDays(d);const L=dlStages();const i=L.findIndex(s=>s.k===d.stage);
 return`<article class="dl-card dl-p-${d.prio}" tabindex="0" draggable="false" data-dl="${d.id}" aria-label="${esc(d.title)}, ${esc(d.custName||'sin cliente')}, ${money(dlAmt(d))}">
 <div class="dl-top"><b class="dl-t">${esc(d.title)}</b><span class="dl-pr" title="Prioridad">${esc(DL_PRIO[d.prio])}</span></div>
 <div class="dl-c">${esc(d.custName||'Sin cliente')}${d.conv?' <span title="Tiene conversación">💬</span>':''}</div>
 <div class="dl-amt">${money(dlAmt(d))}</div>
 ${d.tags.length?`<div class="dl-tags">${d.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}
 ${d.next?`<div class="dl-nx ${late?'late':''}">${late?'⏰ ':'→ '}${esc(d.next)}${d.nextAt?' · '+dmy(d.nextAt):''}</div>`:''}
 <div class="dl-ft"><span class="dl-age ${age>14?'old':age>7?'mid':''}" title="Días en esta etapa">${age} d</span><span class="dl-ow">${esc(d.owner||'')}</span>
 ${d.status==='open'?`<span class="dl-mv"><button class="dl-b" data-act="dlStepA" data-id="${d.id}" data-d="-1" aria-label="Etapa anterior" ${i<=0?'disabled':''}>◀</button><button class="dl-b" data-act="dlStepA" data-id="${d.id}" data-d="1" aria-label="Etapa siguiente" ${i>=L.length-1?'disabled':''}>▶</button></span>`:''}</div></article>`;}
function dlFiltered(){const q=typeof crmNorm==='function'?crmNorm(dlF.q||''):String(dlF.q||'').toLowerCase();return dls().filter(d=>(!dlF.owner||d.owner===dlF.owner)&&(!dlF.prio||d.prio===dlF.prio)&&(!q||(typeof crmNorm==='function'?crmNorm(d.title+' '+d.custName+' '+d.tags.join(' ')):(d.title+' '+d.custName).toLowerCase()).includes(q)));}
function dlBoardHTML(){if(!dlOn())return'<div class="card"><p>El <b>Pipeline de ventas</b> está apagado. '+(giAdm()?'Activalo en <a href="#" data-act="nav" data-id="modulos">Sistema → Módulos</a>.':'Pedile al administrador que lo active.')+'</p></div>';
 const st=dlStats({owner:dlF.owner});const L=dlStages();const D=dlFiltered();const owners=[...new Set(dls().map(d=>d.owner).concat(typeof crmAgents==='function'?crmAgents():[]))].filter(Boolean);
 const closed=D.filter(d=>d.status!=='open').sort((a,b)=>b.closedAt-a.closedAt);
 return`<div class="dl-kpi"><div><span>Abiertas</span><b>${st.open}</b></div><div><span>Valor del embudo</span><b>${money(st.value)}</b></div><div><span>Pronóstico ponderado</span><b>${money(st.weighted)}</b></div><div><span>Ganado este mes</span><b>${money(st.wonMonth)}</b></div><div><span>% de cierre</span><b>${st.winRate} %</b></div><div><span>Ciclo promedio</span><b>${String(st.cycle).replace('.',',')} d</b></div></div>
 <div class="dl-bar"><input id="dl-q" placeholder="Buscar oportunidad, cliente o etiqueta" value="${esc(dlF.q)}" aria-label="Buscar oportunidad"><select id="dl-o" aria-label="Responsable"><option value="">Todos</option>${owners.map(o=>`<option ${dlF.owner===o?'selected':''}>${esc(o)}</option>`).join('')}</select>
 <select id="dl-p" aria-label="Prioridad"><option value="">Toda prioridad</option>${Object.entries(DL_PRIO).map(([k,v])=>`<option value="${k}" ${dlF.prio===k?'selected':''}>${v}</option>`).join('')}</select>
 <button class="btn sm ${dlF.show==='closed'?'gold':''}" data-act="dlShow">${dlF.show==='closed'?'← Embudo':'Cerradas ('+closed.length+')'}</button>${crmSup()?'<button class="btn sm" data-act="dlStagesEd">Etapas</button>':''}<button class="btn gold" data-act="dlNew">+ Oportunidad</button></div>
 ${dlF.show==='closed'?`<div class="tw"><table><thead><tr><th>N.º</th><th>Oportunidad</th><th>Cliente</th><th class="r">Monto</th><th>Resultado</th><th>Cerrada</th><th></th></tr></thead><tbody>${closed.map(d=>`<tr><td>${esc(d.n)}</td><td>${esc(d.title)}</td><td>${esc(d.custName)}</td><td class="r">${money(dlAmt(d))}</td><td>${d.status==='won'?'<span class="tag ok">Ganada</span>':'<span class="tag bad">Perdida</span> '+esc(d.lostWhy||'')}</td><td>${fmtDT(d.closedAt)}</td><td class="r"><button class="btn sm" data-act="dlOpen" data-id="${d.id}">Ver</button></td></tr>`).join('')||'<tr><td colspan="7" class="mut">Sin oportunidades cerradas.</td></tr>'}</tbody></table></div>
  ${Object.keys(st.lostWhy).length?`<h3>Motivos de pérdida</h3><table class="crm-bars">${Object.entries(st.lostWhy).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><th>${esc(k)}</th><td><span class="crm-bar-f" style="width:${Math.round(v/Math.max(...Object.values(st.lostWhy))*100)}%"></span></td><td class="r">${v}</td></tr>`).join('')}</table>`:''}`
 :`<div class="dl-board" id="dl-board" role="list" aria-label="Embudo de ventas">${L.map(s=>{const X=D.filter(d=>d.status==='open'&&d.stage===s.k).sort((a,b)=>({alta:0,media:1,baja:2}[a.prio]-{alta:0,media:1,baja:2}[b.prio])||b.upd-a.upd);const tot=X.reduce((a,d)=>a+dlAmt(d),0);
  return`<section class="dl-col" data-stage="${s.k}" role="listitem" aria-label="${esc(s.t)}"><header><b>${esc(s.t)}</b><span class="dl-n">${X.length}</span><div class="sm mut">${money(tot)} · ${s.p} % → ${money(Math.round(tot*s.p/100))}</div></header><div class="dl-drop">${X.map(dlCard).join('')||'<p class="dl-empty">Soltá acá</p>'}</div></section>`;}).join('')}
  <section class="dl-col dl-end" data-stage="__won" aria-label="Ganado"><header><b>🏆 Ganado</b></header><div class="dl-drop"><p class="dl-empty">Soltá para ganar</p></div></section>
  <section class="dl-col dl-end dl-lost" data-stage="__lost" aria-label="Perdido"><header><b>✖ Perdido</b></header><div class="dl-drop"><p class="dl-empty">Soltá para perder</p></div></section></div>
  <p class="sm mut">Arrastrá las tarjetas (también con el dedo), usá ◀ ▶ o Alt + ← / → con la tarjeta seleccionada. Tocá una tarjeta para ver y editar.</p>`}`;}
/* arrastrar y soltar con eventos de puntero (mouse, lápiz y dedo) */
function dlBindBoard(){const b=$('#dl-board');const q=$('#dl-q'),o=$('#dl-o'),p=$('#dl-p');
 if(q)q.addEventListener('change',()=>{dlF.q=q.value;crmPaint();});if(o)o.addEventListener('change',()=>{dlF.owner=o.value;crmPaint();});if(p)p.addEventListener('change',()=>{dlF.prio=p.value;crmPaint();});
 if(!b)return;let dr=null;
 b.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;const c=e.target.closest('.dl-card');if(!c)return;dr={c,id:c.dataset.dl,x:e.clientX,y:e.clientY,on:false,pid:e.pointerId};});
 b.addEventListener('pointermove',e=>{if(!dr)return;if(!dr.on){if(Math.abs(e.clientX-dr.x)+Math.abs(e.clientY-dr.y)<8)return;dr.on=true;try{b.setPointerCapture(dr.pid);}catch(x){}const r=dr.c.getBoundingClientRect();
   dr.g=dr.c.cloneNode(true);dr.g.classList.add('dl-ghost');dr.g.style.width=r.width+'px';document.body.appendChild(dr.g);dr.c.classList.add('dl-lift');dr.ox=e.clientX-r.left;dr.oy=e.clientY-r.top;}
  e.preventDefault();dr.g.style.transform=`translate(${e.clientX-dr.ox}px,${e.clientY-dr.oy}px) rotate(2deg)`;dr.g.style.visibility='hidden';const el=document.elementFromPoint(e.clientX,e.clientY);dr.g.style.visibility='';
  const col=el&&el.closest('.dl-col');$$('.dl-col.over').forEach(x=>{if(x!==col)x.classList.remove('over');});if(col)col.classList.add('over');dr.col=col;
  const sc=b.getBoundingClientRect();if(e.clientX>sc.right-40)b.scrollLeft+=14;else if(e.clientX<sc.left+40)b.scrollLeft-=14;});
 const end=e=>{if(!dr)return;const x=dr;dr=null;$$('.dl-col.over').forEach(c=>c.classList.remove('over'));if(x.g)x.g.remove();x.c.classList.remove('dl-lift');
  if(!x.on){A.dlOpen({dataset:{id:x.id}});return;}const k=x.col&&x.col.dataset.stage;if(!k)return;
  if(k==='__won')return A.dlWinA({dataset:{id:x.id}});if(k==='__lost')return A.dlLoseA({dataset:{id:x.id}});const r=dlMove(x.id,k);if(r.err)toast(r.err,1);else{toast('Movida a «'+dlStage(k).t+'»');crmPaint();}};
 b.addEventListener('pointerup',end);b.addEventListener('pointercancel',()=>{if(dr&&dr.g)dr.g.remove();if(dr)dr.c.classList.remove('dl-lift');dr=null;});
 b.addEventListener('keydown',e=>{const c=e.target.closest('.dl-card');if(!c)return;if(e.altKey&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();const r=dlStep(c.dataset.dl,e.key==='ArrowRight'?1:-1);if(r.err)return toast(r.err,1);crmPaint();setTimeout(()=>{const n=$(`[data-dl="${c.dataset.dl}"]`);if(n)n.focus();},30);}
  else if(e.key==='Enter'){e.preventDefault();A.dlOpen({dataset:{id:c.dataset.dl}});}});}
const dlCloseTop=()=>{const o=$$('#modal-root .ov');if(o.length)o[o.length-1].remove();};
A.dlStepA=el=>{const r=dlStep(el.dataset.id,+el.dataset.d);if(r.err)return toast(r.err,1);crmPaint();};
A.dlShow=()=>{dlF.show=dlF.show==='closed'?'open':'closed';crmPaint();};
function dlForm(d){d=d||{};const owners=typeof crmAgents==='function'?crmAgents():[user.name];const cu=d.cust?custById(d.cust):null;
 return`<label for="dlf-t">Título</label><input id="dlf-t" maxlength="80" value="${esc(d.title||'')}" placeholder="Ej.: Provisión mensual de bebidas">
 ${d.id?`<p class="sm">Cliente: <b>${esc(d.custName||'—')}</b></p>`:`<label for="dlf-c">Cliente (opcional)</label><input id="dlf-c" autocomplete="off" placeholder="Nombre, CUIT o teléfono" value="${esc(cu?custFull(cu):'')}"><input type="hidden" id="dlf-ci" value="${esc(d.cust||'')}"><div id="dlf-cr"></div>`}
 <div class="f"><div><label for="dlf-a">Monto estimado ($)</label>${numIn('dlf-a',d.amount?d.amount/100:0)}</div><div><label for="dlf-p">Prioridad</label><select id="dlf-p">${Object.entries(DL_PRIO).map(([k,v])=>`<option value="${k}" ${(d.prio||'media')===k?'selected':''}>${v}</option>`).join('')}</select></div>
 ${d.id?'':`<div><label for="dlf-s">Etapa</label><select id="dlf-s">${dlStages().map(s=>`<option value="${s.k}" ${d.stage===s.k?'selected':''}>${esc(s.t)}</option>`).join('')}</select></div>`}
 <div><label for="dlf-o">Responsable</label><select id="dlf-o">${owners.map(o=>`<option ${(d.owner||crmMe())===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div></div>
 <div class="f"><div><label for="dlf-n">Próxima acción</label><input id="dlf-n" maxlength="120" value="${esc(d.next||'')}" placeholder="Ej.: Llamar para cerrar"></div><div><label for="dlf-na">Fecha</label><input id="dlf-na" type="date" value="${esc(d.nextAt||'')}"></div></div>
 <label for="dlf-g">Etiquetas (separadas por coma)</label><input id="dlf-g" maxlength="120" value="${esc((d.tags||[]).join(', '))}">`;}
function dlFormRead(){return{title:val('dlf-t'),amount:cents(val('dlf-a')),prio:val('dlf-p'),owner:val('dlf-o'),next:val('dlf-n'),nextAt:val('dlf-na'),tags:String(val('dlf-g')||'').split(',').map(s=>s.trim()).filter(Boolean)};}
function dlFormBind(){const ci=$('#dlf-c');if(!ci)return;ci.addEventListener('input',()=>{$('#dlf-ci').value='';const L=typeof vbCustFind==='function'?vbCustFind(ci.value):S.customers.filter(c=>custFull(c).toLowerCase().includes(ci.value.toLowerCase())).slice(0,6);
 $('#dlf-cr').innerHTML=L.map(c=>`<button type="button" class="btn sm dlf-cb" data-id="${c.id}" style="margin:.15rem">${esc(custFull(c))}</button>`).join('');$$('.dlf-cb').forEach(b=>b.addEventListener('click',()=>{$('#dlf-ci').value=b.dataset.id;ci.value=b.textContent;$('#dlf-cr').innerHTML='';}));});}
A.dlNew=(el,pre)=>{pre=pre||{};modal('Nueva oportunidad',dlForm(pre),{okText:'Crear',onOk:w=>{const f=dlFormRead();const r=dlCreate(Object.assign({},pre,f,{cust:val('dlf-ci')||pre.cust||'',stage:val('dlf-s')}));if(r.err)return w._err(r.err),false;toast('Oportunidad '+r.d.n+' creada');crmPaint();}});setTimeout(dlFormBind,30);};
A.dlOpen=el=>{const d=dlById(el.dataset.id);if(!d)return;const cv=d.conv&&convById(d.conv);const q=d.quote&&quotes().find(x=>x.id===d.quote);
 modal(d.n+' · '+d.title,`<p class="sm">${esc(d.custName||'Sin cliente')} · ${d.status==='open'?esc((dlStage(d.stage)||{t:d.stage}).t)+' · '+dlDays(d)+' día(s) en la etapa':d.status==='won'?'🏆 Ganada':'✖ Perdida: '+esc(d.lostWhy||'')}${q?' · Presupuesto '+esc(q.n)+' ('+esc(QT_TXT[qtState(q)]||'')+')':''}</p>
  ${d.status==='open'?dlForm(d):''}
  <div class="row" style="gap:.4rem;flex-wrap:wrap;margin:.6rem 0">${cv?`<button class="btn sm" data-act="dlConv" data-id="${d.id}">💬 Abrir conversación</button>`:''}${d.status==='open'?`<button class="btn sm gold" data-act="dlWinA" data-id="${d.id}">🏆 Ganada</button><button class="btn sm red" data-act="dlLoseA" data-id="${d.id}">✖ Perdida</button>`:`<button class="btn sm" data-act="dlReopenA" data-id="${d.id}">Reabrir</button>`}</div>
  <details><summary>Historial (${d.hist.length})</summary><ul class="sm">${d.hist.map(h=>`<li>${fmtDT(h.ts)} · ${esc(h.u)} · ${h.from?esc((dlStage(h.from)||{t:h.from}).t)+' → ':''}${esc((dlStage(h.to)||{t:h.to}).t)}${h.why?' · '+esc(h.why):''}</li>`).join('')}</ul></details>`,
  d.status==='open'?{okText:'Guardar',onOk:w=>{const r=dlEdit(d.id,dlFormRead());if(r.err)return w._err(r.err),false;toast('Guardado');crmPaint();}}:{ok:false,cancelText:'Cerrar'});};
A.dlConv=el=>{const d=dlById(el.dataset.id);if(!d||!d.conv)return;dlCloseTop();crmSel=d.conv;crmTab='inbox';if(curScreen!=='crm')go('crm');else rerender();};
A.dlWinA=el=>{const d=dlById(el.dataset.id);if(!d)return;const q=d.quote&&quotes().find(x=>x.id===d.quote);confirmBox('Ganar '+d.n,`Se marca como ganada por ${money(dlAmt(d))}.${q&&qtState(q)==='vigente'?`<br>El presupuesto ${esc(q.n)} sigue vigente: convertilo en venta desde Presupuestos (Vender → Cargar presupuesto).`:''}`,()=>{const r=dlWin(d.id);if(r.err)return toast(r.err,1);dlCloseTop();toast('🏆 ¡Ganada!');crmPaint();},'Ganada');};
A.dlLoseA=el=>{const d=dlById(el.dataset.id);if(!d)return;modal('Perder '+d.n,`<label for="dll-w">Motivo</label><select id="dll-w">${DL_LOST.map(x=>`<option>${esc(x)}</option>`).join('')}</select><label for="dll-o">Detalle (opcional)</label><input id="dll-o" maxlength="60">`,{okText:'Marcar perdida',onOk:w=>{const why=val('dll-w')+(val('dll-o')?' · '+val('dll-o'):'');const r=dlLose(d.id,why);if(r.err)return w._err(r.err),false;toast('Marcada como perdida');crmPaint();}});};
A.dlReopenA=el=>{const r=dlReopen(el.dataset.id);if(r.err)return toast(r.err,1);dlCloseTop();toast('Reabierta');crmPaint();};
A.dlStagesEd=()=>{const L=dlStages().map(s=>Object.assign({},s));modal('Etapas del embudo',`<p class="sm mut">Nombre y probabilidad de cierre de cada etapa. Una etapa con oportunidades abiertas no se puede borrar.</p><div id="dls-l">${L.map((s,i)=>`<div class="row dls-r" style="gap:.4rem;margin:.3rem 0"><input class="dls-t" value="${esc(s.t)}" maxlength="30" aria-label="Nombre de la etapa ${i+1}" style="flex:1"><input class="dls-p" type="number" min="0" max="100" value="${s.p}" style="width:5rem" aria-label="Probabilidad %"><input type="hidden" class="dls-k" value="${esc(s.k)}"></div>`).join('')}</div><button class="btn sm" type="button" id="dls-add">+ Etapa</button>`,
 {okText:'Guardar',onOk:w=>{const R=$$('.dls-r',w).map(r=>({k:$('.dls-k',r).value||('e'+uid().slice(-5)),t:$('.dls-t',r).value.replace(/[<>]/g,'').trim().slice(0,30),p:Math.max(0,Math.min(100,Math.round(+$('.dls-p',r).value||0)))})).filter(s=>s.t);
  if(R.length<2)return w._err('El embudo necesita al menos 2 etapas.'),false;const gone=dlStages().filter(s=>!R.some(x=>x.k===s.k));const busy=gone.filter(s=>dls().some(d=>d.status==='open'&&d.stage===s.k));
  if(busy.length)return w._err('«'+busy[0].t+'» tiene oportunidades abiertas: movelas antes de borrarla.'),false;crmSet({stages:R});audit('PIPELINE_ETAPAS',R.map(s=>s.t+' '+s.p+'%').join(' · '));save();crmPaint();}});
 setTimeout(()=>{const a=$('#dls-add');if(a)a.addEventListener('click',()=>{$('#dls-l').insertAdjacentHTML('beforeend','<div class="row dls-r" style="gap:.4rem;margin:.3rem 0"><input class="dls-t" value="" maxlength="30" placeholder="Nueva etapa" aria-label="Nombre de la etapa" style="flex:1"><input class="dls-p" type="number" min="0" max="100" value="50" style="width:5rem" aria-label="Probabilidad %"><input type="hidden" class="dls-k" value=""></div>');});},30);};
/* ＋ Oportunidad desde la conversación */
A.dlFromConv=()=>{const c=typeof crmCur==='function'?crmCur():null;if(!c)return;const q=quotes().filter(x=>x.conv===c.id&&qtState(x)==='vigente').slice(-1)[0];
 A.dlNew(null,{conv:c.id,cust:c.cust||'',custName:crmWho(c),title:q?'Presupuesto '+q.n:'Oportunidad de '+crmWho(c),amount:q?qtTotal(q):0,quote:q?q.id:'',stage:q?'propuesta':''});};

/* ---------- 4) Modo agente ---------- */
/* se activa a mano (botón «Vista completa / Modo agente»); no cambia lo que ya ve cada usuario hasta que lo elige */
const crmAgentOn=()=>{try{return localStorage.getItem('vb.crm.agent')==='1';}catch(e){return false;}};
A.crmAgentT=()=>{const on=!crmAgentOn();try{localStorage.setItem('vb.crm.agent',on?'1':'0');}catch(e){}if(on){crmF.ag=crmMe();crmTab='inbox';}else crmF.ag='';rerender();toast(on?'Modo agente: tus conversaciones y la cola sin asignar':'Vista completa');};
{const _l=crmList;crmList=function(){const L=_l.apply(this,arguments);if(!crmAgentOn())return L;const me=crmMe();return L.filter(c=>!c.asg||c.asg===me);};}

/* ---------- 5) Enganches con la pantalla de Atención al cliente ---------- */
{const _b=crmBody;crmBody=function(){if(crmTab==='deals')return dlBoardHTML();return _b.apply(this,arguments);};}
{const _p=crmPaint;crmPaint=function(){const r=_p.apply(this,arguments);if(crmTab==='deals')dlBindBoard();return r;};}
{const _t=crmThreadHTML;crmThreadHTML=function(){let h=_t.apply(this,arguments);const c=typeof crmCur==='function'?crmCur():null;if(!c||!dlOn())return h;
 const D=dls().filter(d=>d.conv===c.id&&d.status==='open');const chip=D.length?D.map(d=>`<button class="btn sm dl-chip" data-act="dlOpen" data-id="${d.id}" title="Oportunidad">💼 ${esc(d.n)} · ${esc((dlStage(d.stage)||{t:''}).t)} · ${money(dlAmt(d))}</button>`).join(''):'';
 return h.replace('<div class="crm-bar" role="toolbar" aria-label="Acciones de la conversación">','<div class="crm-bar" role="toolbar" aria-label="Acciones de la conversación"><button class="btn sm gold" data-act="dlFromConv">＋ Oportunidad</button>'+chip);};}
{const s=SCREENS.crm;const _r=s.render;s.render=function(){let h=_r.apply(this,arguments);const ag=crmAgentOn();
 if(dlOn()&&!ag)h=h.replace(/(<a role="tab"[^>]*data-t="inbox"[^>]*>[^<]*<\/a>)/,'$1<a role="tab" tabindex="0" data-act="crmTab" data-t="deals" aria-selected="'+(crmTab==='deals')+'" class="'+(crmTab==='deals'?'on':'')+'">💼 Oportunidades ('+dls().filter(d=>d.status==='open').length+')</a>');
 else if(dlOn()&&ag)h=h.replace(/<div class="ux-tabs" role="tablist" aria-label="Atención al cliente">[\s\S]*?<\/div>/,'<div class="ux-tabs" role="tablist" aria-label="Atención al cliente"><a role="tab" tabindex="0" data-act="crmTab" data-t="inbox" aria-selected="'+(crmTab==='inbox')+'" class="'+(crmTab==='inbox'?'on':'')+'">Mis conversaciones</a><a role="tab" tabindex="0" data-act="crmTab" data-t="deals" aria-selected="'+(crmTab==='deals')+'" class="'+(crmTab==='deals'?'on':'')+'">💼 Mis oportunidades</a></div>');
 else if(ag)h=h.replace(/<div class="ux-tabs" role="tablist" aria-label="Atención al cliente">[\s\S]*?<\/div>/,'');
 h=h.replace('<h1 class="sp">Atención al cliente</h1>','<h1 class="sp">Atención al cliente</h1><button class="btn sm '+(ag?'gold':'')+'" data-act="crmAgentT" aria-pressed="'+ag+'" title="Muestra sólo tus conversaciones y la cola sin asignar">'+(ag?'👤 Modo agente':'👥 Vista completa')+'</button>');
 if(ag)h=h.replace(/<button class="btn" data-act="crmTab" data-t="(stats|canales)">[^<]*<\/button>/g,'').replace(/<button class="btn" data-act="crmCfgOpen">Ajustes<\/button>/,'').replace(/<button class="btn" data-act="crmSim">[^<]*<\/button>/,'');
 if(ag&&crmTab!=='inbox'&&crmTab!=='deals'){crmTab='inbox';}
 return h+DL_CSS;};}

/* ---------- 6) Nube: colección «deal» (SQL 31) ---------- */
let vb31=false,vb31At=0;
function vb31Enable(){if(vb31||typeof COLS==='undefined')return;const x={c:'deal',key:'deals',pii:['custName','next','title']};if(!COLS.some(y=>y.c==='deal')){COLS.push(x);BYC.deal=x;}vb31=true;}
if(typeof pushAll==='function'){const _pa=pushAll;pushAll=async function(){if(!vb31&&typeof cl!=='undefined'&&cl.comercio&&Date.now()-vb31At>600000){vb31At=Date.now();try{const v=await rpc('vb_version',{});if(+v>=31)vb31Enable();}catch(e){}}return _pa.apply(this,arguments);};}

/* ---------- 7) Diseño: Kanban y pulido de la bandeja (variables del sistema, claro/oscuro, AA, 320–1440 px) ---------- */
const DL_CSS=`<style>
.dl-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.5rem;margin:.6rem 0}.dl-kpi>div{border:1px solid var(--line);border-radius:12px;padding:.5rem .65rem;background:var(--card)}.dl-kpi span{display:block;font-size:.75rem;color:var(--mut)}.dl-kpi b{font-size:1.1rem}
.dl-bar{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;margin:.4rem 0 .6rem}.dl-bar input{flex:1 1 12rem;min-width:0}.dl-bar select{flex:0 1 10rem;min-width:0}
.dl-board{display:flex;gap:.6rem;overflow-x:auto;padding:.2rem .1rem .8rem;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.dl-col{flex:0 0 min(270px,82vw);scroll-snap-align:start;background:rgba(127,127,127,.07);border:1px solid var(--line);border-radius:14px;display:flex;flex-direction:column;max-height:70vh;transition:background .12s,border-color .12s}
.dl-col header{padding:.55rem .65rem;border-bottom:1px solid var(--line);position:sticky;top:0}.dl-col header b{font-size:.92rem}.dl-n{float:right;font-size:.75rem;font-weight:700;border:1px solid var(--line);border-radius:999px;padding:0 .45rem}
.dl-col.over{border-color:var(--gold);background:rgba(201,150,62,.14)}.dl-end{flex-basis:150px}.dl-end header{text-align:center}.dl-lost.over{border-color:var(--crm-a);background:rgba(200,60,50,.12)}
.dl-drop{padding:.45rem;display:flex;flex-direction:column;gap:.45rem;overflow-y:auto;min-height:80px;flex:1}.dl-empty{margin:auto;color:var(--mut);font-size:.82rem;text-align:center}
.dl-card{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:11px;padding:.5rem .6rem;cursor:grab;touch-action:pan-y;user-select:none;transition:transform .1s,box-shadow .1s}
.dl-card:hover{box-shadow:0 3px 10px rgba(0,0,0,.12);transform:translateY(-1px)}.dl-card:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.dl-p-alta{border-left-color:var(--crm-a)}.dl-p-media{border-left-color:var(--gold)}.dl-p-baja{border-left-color:var(--crm-n)}
.dl-top{display:flex;gap:.4rem;align-items:flex-start;justify-content:space-between}.dl-t{font-size:.9rem;line-height:1.2}.dl-pr{font-size:.68rem;font-weight:700;padding:0 .35rem;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
.dl-p-alta .dl-pr{color:var(--crm-a)}.dl-p-media .dl-pr{color:var(--crm-m)}.dl-p-baja .dl-pr{color:var(--crm-n)}
.dl-c{font-size:.8rem;color:var(--mut);margin:.15rem 0}.dl-amt{font-weight:700;font-size:1rem}.dl-tags{display:flex;flex-wrap:wrap;gap:.2rem;margin:.25rem 0}.dl-tags span{font-size:.68rem;background:rgba(127,127,127,.15);border-radius:6px;padding:0 .3rem}
.dl-nx{font-size:.78rem;margin-top:.2rem}.dl-nx.late{color:var(--crm-a);font-weight:600}.dl-ft{display:flex;align-items:center;gap:.35rem;margin-top:.35rem;font-size:.72rem;color:var(--mut)}.dl-ow{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dl-age.mid{color:var(--crm-m);font-weight:600}.dl-age.old{color:var(--crm-a);font-weight:700}.dl-mv{display:flex;gap:.15rem}
.dl-b{min-width:32px;min-height:32px;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit;cursor:pointer;font-size:.75rem}.dl-b:disabled{opacity:.35;cursor:default}
.dl-lift{opacity:.35}.dl-ghost{position:fixed;left:0;top:0;z-index:9999;pointer-events:none;box-shadow:0 12px 30px rgba(0,0,0,.3);opacity:.95}
.dl-chip{border-color:var(--gold)}
.crm-it{transition:border-color .1s,background .1s}.crm-it:hover{background:rgba(127,127,127,.07)}.crm-m{box-shadow:0 1px 1px rgba(0,0,0,.06);line-height:1.35}
.crm-th{scroll-behavior:smooth}#crm-tx{min-height:3rem}
@media(prefers-reduced-motion:reduce){.dl-card,.dl-col,.crm-it{transition:none}.crm-th{scroll-behavior:auto}}
</style>`;
