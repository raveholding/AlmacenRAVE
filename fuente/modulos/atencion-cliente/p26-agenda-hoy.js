/* ===== V27.25 · Atención al cliente: «Hoy» (centro de trabajo diario), Agenda y mejoras del Pipeline =====
   Se engancha al CRM (p6j/p6l/p6m) y al Pipeline (p22) sin reescribirlos:
   · Hoy: cola de trabajo ordenada por urgencia y monto (seguimientos vencidos y de hoy, consultas sin responder
     con SLA de 15 min, propuestas sin respuesta hace más de 48 h, oportunidades estancadas o sin próximo paso),
     acciones en 1 toque (WhatsApp con plantilla, llamada con resultado, posponer, hecho) y KPIs del día.
   · Agenda: mes, semana y día con tareas, llamadas, reuniones y visitas; próximos pasos de las oportunidades
     y turnos reservados desde el chat.
   · Pipeline: semáforo de estancamiento por etapa, vista lista con edición en línea, origen del cliente,
     próximo paso sugerido al mover una tarjeta, ficha 360° con línea de tiempo y notas, y «deal.won».
   Nube: colección «ctask» (SQL 36); la app la sube recién cuando vb_version() ≥ 36. */

const cts=()=>S.ctasks||(S.ctasks=[]);
const CT_KIND={llamada:{t:'Llamada',i:'📞'},whatsapp:{t:'WhatsApp',i:'💬'},reunion:{t:'Reunión',i:'🤝'},visita:{t:'Visita',i:'🚗'},tarea:{t:'Tarea',i:'✅'},nota:{t:'Nota',i:'📝'}};
const CT_SRC={'':'Sin origen',whatsapp:'WhatsApp',web:'Web / tienda',instagram:'Instagram',referido:'Referido',preventa:'Preventa',local:'En el local',otro:'Otro'};
const CT_CALL=[['nocontesto','No contestó'],['interesado','Interesado'],['reprogramar','Reprogramar'],['descartado','Descartado']];
const ctOn=()=>typeof crmCfg==='function'&&SCREENS.crm&&SCREENS.crm.show();
const ctDl=()=>typeof dlOn==='function'&&dlOn();
const ctDay0=k=>new Date((k||dkey(now()))+'T00:00:00').getTime();
const ctTs=(k,hm)=>new Date(k+'T'+(/^\d\d:\d\d$/.test(hm||'')?hm:'09:00')+':00').getTime();
const ctHm=ts=>new Date(ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hour12:false});
const ctAddDays=(k,n)=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+n);return dkey(d.getTime());};
const ctClean=(s,n)=>String(s==null?'':s).replace(/[<>]/g,'').trim().slice(0,n);
const ctById=id=>cts().find(t=>t.id===id);
const ctMin=ms=>{const m=Math.round(ms/60000);return m<60?m+' min':m<1440?Math.round(m/60)+' h':Math.round(m/1440)+' d';};
function dlLim(s){return Math.max(1,Math.round(+(s&&s.d)||({calificado:3,contacto:5,reunion:7,propuesta:5,negociacion:10}[s&&s.k]||7)));}

/* ---------- 1) Tareas y actividades ---------- */
/* o: {title, kind, at, dur, owner, cust, custName, deal, conv, prio, notes} */
function ctCreate(o){if(!can('crm'))return{err:'Sin permiso.'};const kind=CT_KIND[o.kind]?o.kind:'tarea';
 const title=ctClean(o.title,90)||(kind!=='tarea'?CT_KIND[kind].t:'');if(title.length<2)return{err:'Escribí qué hay que hacer.'};
 if(!(+o.at>0))return{err:'Elegí la fecha.'};const cu=o.cust?custById(o.cust):null;const d=o.deal&&typeof dlById==='function'?dlById(o.deal):null;const cv=o.conv&&typeof convById==='function'?convById(o.conv):null;
 const t={id:uid(),ts:now(),upd:now(),title,kind,at:+o.at,dur:Math.max(0,Math.min(600,Math.round(+o.dur||(kind==='reunion'?60:kind==='visita'?45:15)))),
  owner:ctClean(o.owner||crmMe(),40),cust:cu?cu.id:(d&&d.cust)||'',custName:cu?custFull(cu):(d?d.custName:cv&&typeof crmWho==='function'?crmWho(cv):ctClean(o.custName,60)),
  deal:d?d.id:'',conv:cv?cv.id:(d&&d.conv)||'',prio:DL_PRIO&&DL_PRIO[o.prio]?o.prio:'media',notes:ctClean(o.notes,400),done:kind==='nota'?now():0,result:'',by:user?user.name:''};
 cts().push(t);if(d&&kind!=='nota'&&(!d.nextAt||d.nextAt<dkey(now())||t.at<=ctTs(d.nextAt,'23:59'))){d.next=title;d.nextAt=dkey(t.at);d.upd=now();}
 audit(kind==='nota'?'CRM_NOTA':'CRM_TAREA',(d?d.n+' · ':'')+CT_KIND[kind].t+' · '+title+' · '+fmtDT(t.at)+' · '+t.owner);save();return{t};}
function ctEdit(id,o){const t=ctById(id);if(!t)return{err:'Tarea inexistente.'};if(!can('crm'))return{err:'Sin permiso.'};
 if(o.title!==undefined){const x=ctClean(o.title,90);if(x.length<2)return{err:'Escribí qué hay que hacer.'};t.title=x;}
 if(o.kind&&CT_KIND[o.kind])t.kind=o.kind;if(+o.at>0)t.at=+o.at;if(o.dur!==undefined)t.dur=Math.max(0,Math.min(600,Math.round(+o.dur||0)));
 if(o.owner!==undefined)t.owner=ctClean(o.owner,40);if(o.prio&&DL_PRIO[o.prio])t.prio=o.prio;if(o.notes!==undefined)t.notes=ctClean(o.notes,400);
 t.upd=now();ctDealNext(t.deal);audit('CRM_TAREA_EDITADA',t.title+' · '+fmtDT(t.at));save();return{t};}
function ctDone(id,result){const t=ctById(id);if(!t)return{err:'Tarea inexistente.'};if(!can('crm'))return{err:'Sin permiso.'};if(t.done)return{t};
 t.done=now();t.result=ctClean(result,120);t.upd=now();const d=t.deal&&dlById(t.deal);
 if(d){d.hist.push({ts:now(),u:user.name,to:d.stage,why:CT_KIND[t.kind].t+': '+t.title+(t.result?' · '+t.result:'')});d.upd=now();d.stAt=d.stAt||now();d.act=now();ctDealNext(d.id);}
 const cv=t.conv&&convById(t.conv);if(cv&&t.kind!=='whatsapp')crmAdd(cv,'note',CT_KIND[t.kind].i+' '+CT_KIND[t.kind].t+' hecha: '+t.title+(t.result?' · '+t.result:''),{kind:'tarea'});
 audit('CRM_TAREA_HECHA',CT_KIND[t.kind].t+' · '+t.title+(t.result?' · '+t.result:''));save();return{t};}
function ctSnooze(id,days){const t=ctById(id);if(!t)return{err:'Tarea inexistente.'};const k=ctAddDays(dkey(Math.max(t.at,ctDay0())),days);const hm=new Date(t.at).toTimeString().slice(0,5);
 t.at=ctTs(k,hm);t.upd=now();ctDealNext(t.deal);audit('CRM_TAREA_POSPUESTA',t.title+' → '+dmy(k));save();return{t};}
/* la próxima acción de la oportunidad sigue a su tarea pendiente más cercana */
function ctDealNext(dealId){const d=dealId&&typeof dlById==='function'&&dlById(dealId);if(!d||d.status!=='open')return;
 const P=cts().filter(t=>t.deal===d.id&&!t.done&&t.kind!=='nota').sort((a,b)=>a.at-b.at)[0];if(P){d.next=P.title;d.nextAt=dkey(P.at);}else if(d.nextAt&&d.nextAt<dkey(now())){d.next='';d.nextAt='';}d.upd=now();}
const ctPend=dealId=>cts().some(t=>t.deal===dealId&&!t.done&&t.kind!=='nota');

/* ---------- 2) Cola de trabajo de «Hoy» ---------- */
let ctF={mine:false,ag:{v:'semana',k:'',own:''},hoyN:12};
function hoyItems(){const me=crmMe();const k0=dkey(now());const t0=ctDay0(k0),t1=t0+864e5;const out=[];const seen=new Set();const mine=x=>!ctF.mine||!x||x===me;
 const D=ctDl()?dls().filter(d=>d.status==='open'):[];
 cts().filter(t=>!t.done&&t.kind!=='nota'&&t.at<t1&&mine(t.owner)).forEach(t=>{const d=t.deal&&dlById(t.deal);if(d)seen.add(d.id);
  out.push({k:'t'+t.id,lv:t.at<t0?0:1,ico:CT_KIND[t.kind].i,t:t.title,sub:(t.custName||'Sin cliente')+(d?' · '+d.n:''),when:t.at<t0?'Vencida '+dmy(dkey(t.at)):'Hoy '+ctHm(t.at),amt:d?dlAmt(d):0,task:t.id,deal:d?d.id:'',conv:t.conv,cust:t.cust,motivo:t.title});});
 D.filter(d=>!seen.has(d.id)&&d.nextAt&&d.nextAt<=k0&&mine(d.owner)).forEach(d=>{seen.add(d.id);out.push({k:'d'+d.id,lv:d.nextAt<k0?0:1,ico:'💼',t:d.next||'Seguimiento',sub:(d.custName||'Sin cliente')+' · '+d.n,when:d.nextAt<k0?'Vencida '+dmy(d.nextAt):'Hoy',amt:dlAmt(d),deal:d.id,conv:d.conv,cust:d.cust,motivo:d.title});});
 convs().map(crmFix).filter(c=>c.state!=='cerrado'&&c.firstIn&&!c.firstOut&&c.lastIn>=c.lastOut&&mine(c.asg)).forEach(c=>{const w=now()-(c.firstIn||c.ts);
  out.push({k:'c'+c.id,lv:w>15*60000?0:1,ico:'🆕',t:'Consulta nueva sin responder',sub:crmWho(c)+' · '+(CHAN&&CHAN[c.chan]||c.chan),when:'Espera hace '+ctMin(w),amt:0,conv:c.id,cust:c.cust,lead:1,sla:w>15*60000,motivo:'tu consulta'});});
 D.filter(d=>!seen.has(d.id)&&mine(d.owner)).forEach(d=>{const s=dlStage(d.stage)||{};const age=now()-(d.stAt||d.ts);const cv=d.conv&&convById(d.conv);
  if((d.stage==='propuesta'||/propuest|presupuest/i.test(s.t||''))&&age>48*3600e3&&(!cv||(cv.lastIn||0)<(d.stAt||d.ts))){seen.add(d.id);out.push({k:'p'+d.id,lv:1,ico:'📄',t:'Propuesta sin respuesta',sub:(d.custName||'Sin cliente')+' · '+d.n,when:'Enviada hace '+ctMin(age),amt:dlAmt(d),deal:d.id,conv:d.conv,cust:d.cust,motivo:'la propuesta que te enviamos'});return;}
  const dd=dlDays(d);if(dd>dlLim(s)){seen.add(d.id);out.push({k:'r'+d.id,lv:1,ico:'🐢',t:'Estancada en «'+(s.t||d.stage)+'»',sub:(d.custName||'Sin cliente')+' · '+d.n,when:dd+' d sin avanzar',amt:dlAmt(d),deal:d.id,conv:d.conv,cust:d.cust,motivo:d.title});return;}
  if(!d.nextAt&&!ctPend(d.id)){seen.add(d.id);out.push({k:'n'+d.id,lv:2,ico:'❔',t:'Sin próximo paso',sub:(d.custName||'Sin cliente')+' · '+d.n,when:'Programalo',amt:dlAmt(d),deal:d.id,conv:d.conv,cust:d.cust,motivo:d.title,nx:1});}});
 return out.sort((a,b)=>a.lv-b.lv||b.amt-a.amt||(a.when<b.when?-1:1));}
function hoyKpi(){const t7=now()-7*864e5;const D=ctDl()?dls():[];const st=ctDl()?dlStats({}):{weighted:0,wonMonth:0};const goal=Math.max(0,+(crmCfg().goal||0));
 const cl=D.filter(d=>d.status!=='open'&&d.closedAt>=t7);const won=cl.filter(d=>d.status==='won').length;
 const R=convs().filter(c=>c.firstIn>=t7&&c.firstOut>c.firstIn).map(c=>c.firstOut-c.firstIn);const resp=R.length?R.reduce((a,b)=>a+b,0)/R.length:0;
 return{goal,won:st.wonMonth,pct:goal?Math.min(100,Math.round(st.wonMonth/goal*100)):0,weighted:st.weighted,conv:cl.length?Math.round(won/cl.length*100):null,resp,nResp:R.length};}
function ctWaNum(it){const cv=it.conv&&convById(it.conv);if(cv){const n=crmWa(cv);if(n)return n;}const cu=it.cust&&custById(it.cust);return cu&&waOk(cu)?waDigits(cu):'';}
function ctWaText(it){const cu=it.cust&&custById(it.cust);const cv=it.conv&&convById(it.conv);const nom=(cu&&cu.name)||(cv&&crmFirst(cv))||'';
 const tpl=crmCfg().waTpl||'Hola {nombre}, te escribo por {motivo}.';return tpl.replace(/\{nombre\}/g,nom.split(/\s+/)[0]||'').replace(/\{motivo\}/g,it.motivo||'tu consulta').replace(/\s+,/,',').replace(/Hola ,/,'Hola,');}
function hoyRow(it){const wa=ctWaNum(it);
 return`<li class="hy-r hy-l${it.lv}" data-k="${esc(it.k)}"><span class="hy-i" aria-hidden="true">${it.ico}</span>
 <button class="hy-m" data-act="hoyOpen" data-k="${esc(it.k)}"><b>${esc(it.t)}</b><span>${esc(it.sub)}</span></button>
 <span class="hy-w"><span class="hy-tag">${esc(it.when)}</span>${it.amt?`<b>${money(it.amt)}</b>`:''}</span>
 <span class="hy-a" role="group" aria-label="Acciones">
  ${wa?`<a class="hy-b" href="${waLink(ctWaText(it),wa)}" target="_blank" rel="noopener" data-hywa="${esc(it.k)}" title="WhatsApp con mensaje listo" aria-label="WhatsApp">💬</a>`:`<button class="hy-b" disabled title="Sin WhatsApp cargado" aria-label="Sin WhatsApp">💬</button>`}
  ${it.lead?'':`<button class="hy-b" data-act="hoyCall" data-k="${esc(it.k)}" title="Registrar llamada" aria-label="Registrar llamada">📞</button>`}
  ${it.task||it.deal&&!it.nx?`<button class="hy-b" data-act="hoySnz" data-k="${esc(it.k)}" title="Posponer" aria-label="Posponer">⏰</button>`:''}
  <button class="hy-b ok" data-act="hoyDone" data-k="${esc(it.k)}" title="${it.lead?'Responder':it.nx?'Programar próximo paso':'Hecho'}" aria-label="${it.lead?'Responder':it.nx?'Programar próximo paso':'Hecho'}">${it.lead?'↩':it.nx?'📅':'✔'}</button></span></li>`;}
function hoyHTML(){const I=hoyItems();const K=hoyKpi();const red=I.filter(x=>x.lv===0).length,amb=I.filter(x=>x.lv===1).length;const L=I.slice(0,ctF.hoyN);
 const nx=cts().filter(t=>!t.done&&t.kind!=='nota'&&t.at>=ctDay0()+864e5&&(!ctF.mine||t.owner===crmMe())).sort((a,b)=>a.at-b.at).slice(0,5);
 const hr=new Date().getHours();
 return`<div class="hy-hd"><div><h2>${hr<12?'Buen día':hr<20?'Buenas tardes':'Buenas noches'}${user&&user.name?', '+esc(String(user.name).split(' ')[0]):''}</h2><p class="sm mut">${red?`<b class="hy-red">${red} urgente${red>1?'s':''}</b> · `:''}${amb} para hoy · ${I.length} en tu cola</p></div>
 <div class="hy-tb"><button class="btn sm ${ctF.mine?'gold':''}" data-act="hoyMine" aria-pressed="${ctF.mine}">${ctF.mine?'👤 Sólo lo mío':'👥 Todo el equipo'}</button><button class="btn gold" data-act="ctNew">+ Tarea</button></div></div>
 <div class="hy-kpi">
  <div class="hy-goal"><span>Meta del mes</span><b>${money(K.won)}${K.goal?` <small>de ${money(K.goal)}</small>`:''}</b>${K.goal?`<i class="hy-pg" role="progressbar" aria-valuenow="${K.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance de la meta"><i style="width:${K.pct}%"></i></i><small>${K.pct} %</small>`:crmSup()?'<button class="lnk" data-act="hoyGoal">Fijar meta</button>':'<small class="mut">Sin meta fijada</small>'}${K.goal&&crmSup()?' <button class="lnk" data-act="hoyGoal">Cambiar</button>':''}</div>
  <div><span>Pronóstico ponderado</span><b>${money(K.weighted)}</b><small class="mut">monto × probabilidad</small></div>
  <div><span>Conversión 7 días</span><b>${K.conv==null?'—':K.conv+' %'}</b><small class="mut">ganadas / cerradas</small></div>
  <div><span>Respuesta promedio</span><b>${K.nResp?ctMin(K.resp):'—'}</b><small class="${K.nResp&&K.resp>15*60000?'hy-red':'mut'}">meta: menos de 15 min</small></div></div>
 <div class="hy-grid"><section class="hy-q" aria-label="Cola de trabajo"><h3>Para hacer ahora</h3>
  ${L.length?`<ul class="hy-list">${L.map(hoyRow).join('')}</ul>${I.length>L.length?`<button class="btn sm" data-act="hoyMore">Ver ${I.length-L.length} más</button>`:''}`:'<div class="hy-zero"><b>🎉 Estás al día</b><p class="sm mut">No hay seguimientos vencidos, consultas sin responder ni oportunidades trabadas.</p></div>'}</section>
 <aside class="hy-side"><div class="crm-box"><h4>📅 Próximos días</h4>${nx.length?`<ul class="hy-nx">${nx.map(t=>`<li><button class="lnk" data-act="ctOpen" data-id="${t.id}">${CT_KIND[t.kind].i} <b>${esc(t.title)}</b></button><span class="sm mut">${dmy(dkey(t.at))} ${ctHm(t.at)} · ${esc(t.custName||'')}</span></li>`).join('')}</ul>`:'<p class="sm mut">Nada agendado.</p>'}<button class="btn sm" data-act="crmTab" data-t="agenda">Abrir la agenda</button></div>
  <div class="crm-box"><h4>Cómo se ordena</h4><p class="sm mut"><span class="hy-dot l0"></span> Vencido o consulta esperando más de 15 min<br><span class="hy-dot l1"></span> Para hoy, propuestas sin respuesta y trabadas<br><span class="hy-dot l2"></span> Oportunidades sin próximo paso<br>Dentro de cada color, primero lo de mayor monto.</p></div></aside></div>`;}
const hoyFind=k=>hoyItems().find(x=>x.k===k);
A.hoyMine=()=>{ctF.mine=!ctF.mine;crmPaint();};
A.hoyMore=()=>{ctF.hoyN+=12;crmPaint();};
A.hoyGoal=()=>{const g=+(crmCfg().goal||0);modal('Meta de ventas del mes',`<label for="hg-v">Monto a ganar en oportunidades este mes ($)</label>${numIn('hg-v',g/100)}<label for="hg-t">Mensaje de WhatsApp de seguimiento</label><input id="hg-t" maxlength="160" value="${esc(crmCfg().waTpl||'Hola {nombre}, te escribo por {motivo}.')}"><p class="sm mut">Podés usar {nombre} y {motivo}.</p>`,
 {okText:'Guardar',onOk:w=>{const v=cents(val('hg-v'));if(!(v>=0))return w._err('Monto inválido.'),false;const t=ctClean(val('hg-t'),160);crmSet({goal:v,waTpl:t||''});audit('CRM_META',money(v));save();crmPaint();}});};
A.hoyOpen=el=>{const it=hoyFind(el.dataset.k);if(!it)return crmPaint();if(it.task)return A.ctOpen({dataset:{id:it.task}});if(it.deal)return A.dlOpen({dataset:{id:it.deal}});if(it.conv){crmSel=it.conv;crmTab='inbox';rerender();}};
/* el toque en WhatsApp queda registrado como actividad */
function hoyWaLog(k){const it=hoyFind(k);if(!it)return;const d=it.deal&&dlById(it.deal);if(d){d.hist.push({ts:now(),u:user.name,to:d.stage,why:'WhatsApp enviado: '+ctWaText(it).slice(0,80)});d.act=now();d.upd=now();}
 if(it.task){const t=ctById(it.task);if(t&&t.kind==='whatsapp')ctDone(t.id,'Mensaje enviado');}audit('CRM_WHATSAPP',(it.sub||'')+' · '+ctWaText(it).slice(0,60));save();}
A.hoyCall=el=>{const it=hoyFind(el.dataset.k);if(!it)return;
 const w=modal('Registrar llamada',`<p class="sm">${esc(it.t)} · ${esc(it.sub)}</p><div class="hy-res" role="group" aria-label="Resultado">${CT_CALL.map(([k,t])=>`<button type="button" class="btn" data-res="${k}">${t}</button>`).join('')}</div><label for="hc-n">Comentario (opcional)</label><input id="hc-n" maxlength="100">`,{ok:false,cancelText:'Cancelar'});
 w.addEventListener('click',e=>{const b=e.target.closest('[data-res]');if(!b)return;const res=b.dataset.res;const txt=(CT_CALL.find(x=>x[0]===res)||[])[1]+(val('hc-n')?' · '+ctClean(val('hc-n'),100):'');w.remove();
  if(it.task)ctDone(it.task,'Llamada: '+txt);else{const r=ctCreate({kind:'llamada',title:'Llamada',at:now(),deal:it.deal,conv:it.conv,cust:it.cust});if(r.t)ctDone(r.t.id,txt);}
  if(res==='nocontesto'){ctCreate({kind:'llamada',title:'Volver a llamar',at:ctTs(ctAddDays(dkey(now()),1),'10:00'),deal:it.deal,conv:it.conv,cust:it.cust});toast('Quedó para mañana a las 10');crmPaint();}
  else if(res==='descartado'&&it.deal){crmPaint();A.dlLoseA({dataset:{id:it.deal}});}
  else if(res==='reprogramar'||res==='interesado'){crmPaint();A.ctNext({dataset:{deal:it.deal||'',conv:it.conv||'',cust:it.cust||''}});}
  else{toast('Llamada registrada');crmPaint();}});};
A.hoySnz=el=>{const it=hoyFind(el.dataset.k);if(!it)return;
 const w=modal('Posponer',`<div class="hy-res">${[[1,'+1 día'],[3,'+3 días'],[7,'Próxima semana']].map(([n,t])=>`<button type="button" class="btn" data-n="${n}">${t}</button>`).join('')}</div>`,{ok:false});
 w.addEventListener('click',e=>{const b=e.target.closest('[data-n]');if(!b)return;const n=+b.dataset.n;w.remove();
  if(it.task)ctSnooze(it.task,n);else if(it.deal){const d=dlById(it.deal);if(d){d.nextAt=ctAddDays(dkey(now()),n);d.upd=now();d.hist.push({ts:now(),u:user.name,to:d.stage,why:'Seguimiento pospuesto al '+dmy(d.nextAt)});save();}}
  toast('Pospuesto');crmPaint();});};
A.hoyDone=el=>{const it=hoyFind(el.dataset.k);if(!it)return;
 if(it.lead){crmSel=it.conv;crmTab='inbox';rerender();setTimeout(()=>{const t=$('#crm-tx');if(t)t.focus();},60);return;}
 if(it.nx)return A.ctNext({dataset:{deal:it.deal}});
 if(it.task){ctDone(it.task,'Hecho');}else if(it.deal){const d=dlById(it.deal);if(d){d.hist.push({ts:now(),u:user.name,to:d.stage,why:'Hecho: '+(d.next||'seguimiento')});d.next='';d.nextAt='';d.act=now();d.upd=now();save();}}
 toast('¡Hecho!');crmPaint();if(it.deal&&dlById(it.deal)&&dlById(it.deal).status==='open'&&!ctPend(it.deal))A.ctNext({dataset:{deal:it.deal}});};

/* ---------- 3) Formularios: tarea y «próximo paso» ---------- */
function ctForm(t,pre){t=t||{};pre=pre||{};const owners=typeof crmAgents==='function'?crmAgents():[crmMe()];const k=t.at?dkey(t.at):(pre.k||dkey(now()));const hm=t.at?new Date(t.at).toTimeString().slice(0,5):(pre.hm||'');
 const D=ctDl()?dls().filter(d=>d.status==='open'):[];const dsel=t.deal||pre.deal||'';const cu=(t.cust||pre.cust)?custById(t.cust||pre.cust):null;
 return`<div class="ct-kinds" role="group" aria-label="Tipo">${Object.entries(CT_KIND).filter(([x])=>x!=='nota').map(([x,v])=>`<label class="ct-k"><input type="radio" name="ctf-k" value="${x}" ${(t.kind||pre.kind||'llamada')===x?'checked':''}><span>${v.i} ${v.t}</span></label>`).join('')}</div>
 <label for="ctf-t">Qué hay que hacer</label><input id="ctf-t" maxlength="90" value="${esc(t.title||pre.title||'')}" placeholder="Ej.: Llamar para confirmar el pedido">
 <div class="f"><div><label for="ctf-d">Día</label><input id="ctf-d" type="date" value="${k}"></div><div><label for="ctf-h">Hora</label><input id="ctf-h" type="time" value="${hm||'10:00'}"></div><div><label for="ctf-u">Duración</label><select id="ctf-u">${[15,30,45,60,90,120].map(m=>`<option value="${m}" ${(t.dur||30)===m?'selected':''}>${m<60?m+' min':m/60+' h'}</option>`).join('')}</select></div></div>
 <div class="f"><div><label for="ctf-o">Responsable</label><select id="ctf-o">${owners.map(o=>`<option ${(t.owner||crmMe())===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div><div><label for="ctf-p">Prioridad</label><select id="ctf-p">${Object.entries(DL_PRIO).map(([x,v])=>`<option value="${x}" ${(t.prio||'media')===x?'selected':''}>${v}</option>`).join('')}</select></div></div>
 ${t.id?`<p class="sm">Cliente: <b>${esc(t.custName||'—')}</b></p>`:`<label for="ctf-c">Cliente (opcional)</label><input id="ctf-c" autocomplete="off" placeholder="Nombre, CUIT o teléfono" value="${esc(cu?custFull(cu):'')}"><input type="hidden" id="ctf-ci" value="${esc(cu?cu.id:'')}"><div id="ctf-cr"></div>`}
 ${D.length?`<label for="ctf-dl">Oportunidad (opcional)</label><select id="ctf-dl" ${t.id?'disabled':''}><option value="">Ninguna</option>${D.map(d=>`<option value="${d.id}" ${dsel===d.id?'selected':''}>${esc(d.n+' · '+d.title+' · '+(d.custName||''))}</option>`).join('')}</select>`:''}
 <label for="ctf-n">Notas</label><textarea id="ctf-n" rows="2" maxlength="400">${esc(t.notes||'')}</textarea>`;}
function ctFormRead(){const k=val('ctf-d');const r=$('input[name="ctf-k"]:checked');return{kind:r?r.value:'tarea',title:val('ctf-t'),at:/^\d{4}-\d{2}-\d{2}$/.test(k)?ctTs(k,val('ctf-h')):0,dur:+val('ctf-u'),owner:val('ctf-o'),prio:val('ctf-p'),notes:val('ctf-n'),cust:val('ctf-ci'),deal:val('ctf-dl')};}
function ctFormBind(){const ci=$('#ctf-c');if(!ci)return;ci.addEventListener('input',()=>{$('#ctf-ci').value='';const L=typeof vbCustFind==='function'?vbCustFind(ci.value):S.customers.filter(c=>custFull(c).toLowerCase().includes(ci.value.toLowerCase())).slice(0,6);
 $('#ctf-cr').innerHTML=L.map(c=>`<button type="button" class="btn sm ctf-cb" data-id="${c.id}" style="margin:.15rem">${esc(custFull(c))}</button>`).join('');$$('.ctf-cb').forEach(b=>b.addEventListener('click',()=>{$('#ctf-ci').value=b.dataset.id;ci.value=b.textContent;$('#ctf-cr').innerHTML='';}));});}
const ctRepaint=()=>{if(curScreen==='crm')crmPaint();};
A.ctNew=(el,pre)=>{pre=pre||{};if(el&&el.dataset){if(el.dataset.k)pre.k=el.dataset.k;if(el.dataset.hm)pre.hm=el.dataset.hm;}
 modal('Nueva tarea o evento',ctForm(null,pre),{okText:'Agendar',onOk:w=>{const f=ctFormRead();const r=ctCreate(Object.assign({},pre,f,{cust:f.cust||pre.cust||'',deal:f.deal||pre.deal||'',conv:pre.conv||''}));if(r.err)return w._err(r.err),false;toast('Agendado para el '+dmy(dkey(r.t.at))+' '+ctHm(r.t.at));ctRepaint();}});setTimeout(ctFormBind,30);};
A.ctOpen=el=>{const t=ctById(el.dataset.id);if(!t)return;const d=t.deal&&dlById(t.deal);const cv=t.conv&&convById(t.conv);
 modal(CT_KIND[t.kind].i+' '+t.title,`${t.done?`<p class="tag ok">Hecha ${fmtDT(t.done)}${t.result?' · '+esc(t.result):''}</p>`:''}${ctForm(t)}
  <div class="row" style="gap:.4rem;flex-wrap:wrap;margin-top:.6rem">${d?`<button class="btn sm" data-act="dlOpen" data-id="${d.id}">💼 ${esc(d.n)}</button>`:''}${cv?`<button class="btn sm" data-act="ctConv" data-id="${cv.id}">💬 Conversación</button>`:''}${t.done?'':`<button class="btn sm gold" data-act="ctDoneA" data-id="${t.id}">✔ Marcar hecha</button>`}<button class="btn sm red" data-act="ctDel" data-id="${t.id}">Borrar</button></div>`,
  {okText:'Guardar',onOk:w=>{const r=ctEdit(t.id,ctFormRead());if(r.err)return w._err(r.err),false;toast('Guardado');ctRepaint();}});};
A.ctConv=el=>{dlCloseTop();crmSel=el.dataset.id;crmTab='inbox';if(curScreen!=='crm')go('crm');else rerender();};
A.ctDoneA=el=>{const t=ctById(el.dataset.id);if(!t)return;ctDone(t.id,'Hecho');dlCloseTop();toast('¡Hecho!');ctRepaint();if(t.deal&&dlById(t.deal)&&dlById(t.deal).status==='open'&&!ctPend(t.deal))A.ctNext({dataset:{deal:t.deal}});};
A.ctDel=el=>{const t=ctById(el.dataset.id);if(!t)return;confirmBox('Borrar tarea','Se borra «'+esc(t.title)+'».',()=>{S.ctasks=cts().filter(x=>x.id!==t.id);if(typeof pushDel==='function')try{pushDel('ctask',t.id);}catch(e){}ctDealNext(t.deal);audit('CRM_TAREA_BORRADA',t.title);save();dlCloseTop();ctRepaint();},'Borrar');};
/* Regla del siguiente paso: al mover una oportunidad o cerrar una actividad se propone agendar lo próximo */
A.ctNext=el=>{const ds=el.dataset||{};const d=ds.deal&&dlById(ds.deal);const k0=dkey(now());
 const opts=[['hoy','Hoy',k0],['man','Mañana',ctAddDays(k0,1)],['3d','En 3 días',ctAddDays(k0,3)],['sem','Próxima semana',ctAddDays(k0,7)]];
 const w=modal(d?'Próximo paso · '+d.n:'Próximo paso',`${d?`<p class="sm">${esc(d.title)} · ${esc(d.custName||'')} · ${esc((dlStage(d.stage)||{t:''}).t)}</p>`:''}
  <div class="ct-kinds" role="group" aria-label="Tipo">${['llamada','whatsapp','reunion','visita','tarea'].map(x=>`<label class="ct-k"><input type="radio" name="ctn-k" value="${x}" ${x==='llamada'?'checked':''}><span>${CT_KIND[x].i} ${CT_KIND[x].t}</span></label>`).join('')}</div>
  <label for="ctn-t">Qué sigue</label><input id="ctn-t" maxlength="90" placeholder="Ej.: Llamar para cerrar el pedido">
  <div class="hy-res" role="group" aria-label="Cuándo">${opts.map(([x,t,k],i)=>`<button type="button" class="btn ${i===1?'gold':''}" data-q="${k}">${t}</button>`).join('')}</div>
  <div class="f"><div><label for="ctn-d">Día</label><input id="ctn-d" type="date" value="${opts[1][2]}"></div><div><label for="ctn-h">Hora</label><input id="ctn-h" type="time" value="10:00"></div></div>
  <p class="sm mut">Ninguna oportunidad abierta queda sin una próxima acción: si la salteás, aparece en «Hoy» como pendiente.</p>`,
  {okText:'Agendar',cancelText:'Ahora no',onOk:w=>{const r=$('input[name="ctn-k"]:checked');const kind=r?r.value:'llamada';const k=val('ctn-d');if(!/^\d{4}-\d{2}-\d{2}$/.test(k))return w._err('Elegí el día.'),false;
   const x=ctCreate({kind,title:val('ctn-t')||CT_KIND[kind].t+(d&&d.custName?' a '+d.custName.split(' ')[0]:''),at:ctTs(k,val('ctn-h')),deal:d?d.id:'',conv:ds.conv||(d&&d.conv)||'',cust:ds.cust||(d&&d.cust)||''});if(x.err)return w._err(x.err),false;toast('Próximo paso: '+dmy(k)+' '+ctHm(x.t.at));ctRepaint();}});
 w.addEventListener('click',e=>{const b=e.target.closest('[data-q]');if(!b)return;$('#ctn-d').value=b.dataset.q;$$('[data-q]',w).forEach(x=>x.classList.toggle('gold',x===b));});};

/* ---------- 4) Agenda: mes, semana y día ---------- */
function agEvents(k0,k1){const t0=ctDay0(k0),t1=ctDay0(k1)+864e5;const own=ctF.ag.own;const ok=o=>!own||o===own;const E=[];
 cts().filter(t=>t.kind!=='nota'&&t.at>=t0&&t.at<t1&&ok(t.owner)).forEach(t=>E.push({id:t.id,ty:'t',kind:t.kind,at:t.at,dur:t.dur,t:t.title,c:t.custName,o:t.owner,done:!!t.done,late:!t.done&&t.at<now()}));
 if(ctDl())dls().filter(d=>d.status==='open'&&d.nextAt&&!ctPend(d.id)&&ctDay0(d.nextAt)>=t0&&ctDay0(d.nextAt)<t1&&ok(d.owner)).forEach(d=>E.push({id:d.id,ty:'d',kind:'deal',at:ctDay0(d.nextAt),allDay:1,t:d.next||'Seguimiento '+d.n,c:d.custName,o:d.owner,late:d.nextAt<dkey(now())}));
 convs().forEach(c=>(c.appts||[]).filter(a=>a.at>=t0&&a.at<t1&&a.st!=='cancelado'&&ok(a.by||c.asg)).forEach(a=>E.push({id:c.id,ty:'a',kind:'turno',at:a.at,dur:30,t:a.what||'Turno',c:crmWho(c),o:a.by||c.asg||'',st:a.st})));
 return E.sort((a,b)=>(b.allDay?1:0)-(a.allDay?1:0)||a.at-b.at);}
const AG_IC={deal:'💼',turno:'🗓️'};
const agIco=e=>AG_IC[e.kind]||(CT_KIND[e.kind]||{}).i||'•';
const agChip=(e,full)=>`<button class="ag-e ag-${e.kind}${e.done?' done':''}${e.late?' late':''}" data-act="agOpen" data-ty="${e.ty}" data-id="${e.id}" title="${esc(e.t+(e.c?' · '+e.c:''))}">${e.allDay?'':`<span class="ag-h">${ctHm(e.at)}</span>`}${agIco(e)} ${esc(e.t)}${full&&e.c?`<small>${esc(e.c)}${e.o?' · '+esc(e.o):''}</small>`:''}</button>`;
const AG_DOW=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
function agMonday(k){const d=new Date(k+'T12:00:00');const w=(d.getDay()+6)%7;d.setDate(d.getDate()-w);return dkey(d.getTime());}
function agHTML(){const v=ctF.ag.v;const k=ctF.ag.k||dkey(now());const today=dkey(now());const owners=typeof crmAgents==='function'?crmAgents():[];
 const d=new Date(k+'T12:00:00');const MES=d.toLocaleDateString('es-AR',{month:'long',year:'numeric'});
 let title='',body='';
 if(v==='mes'){const f=new Date(d.getFullYear(),d.getMonth(),1,12);const k0=agMonday(dkey(f.getTime()));const k1=ctAddDays(k0,41);const E=agEvents(k0,k1);title=MES;
  body=`<div class="ag-m" role="grid" aria-label="${esc(MES)}">${AG_DOW.map(x=>`<div class="ag-dw" role="columnheader">${x}</div>`).join('')}${Array.from({length:42},(_,i)=>{const kk=ctAddDays(k0,i);const X=E.filter(e=>dkey(e.at)===kk);const out=+kk.slice(5,7)!==d.getMonth()+1;
   return`<div class="ag-c${out?' out':''}${kk===today?' hoy':''}" role="gridcell"><button class="ag-n" data-act="agDay" data-k="${kk}" aria-label="Ver el ${dmy(kk)}">${+kk.slice(8)}</button>${X.slice(0,3).map(e=>agChip(e)).join('')}${X.length>3?`<button class="ag-more" data-act="agDay" data-k="${kk}">+${X.length-3} más</button>`:''}</div>`;}).join('')}</div>`;}
 else if(v==='semana'){const k0=agMonday(k);const E=agEvents(k0,ctAddDays(k0,6));title='Semana del '+dmy(k0)+' al '+dmy(ctAddDays(k0,6));
  body=`<div class="ag-w">${Array.from({length:7},(_,i)=>{const kk=ctAddDays(k0,i);const X=E.filter(e=>dkey(e.at)===kk);
   return`<section class="ag-wd${kk===today?' hoy':''}" aria-label="${AG_DOW[i]} ${dmy(kk)}"><header><button class="ag-n" data-act="agDay" data-k="${kk}">${AG_DOW[i]} <b>${+kk.slice(8)}</b></button><button class="ag-add" data-act="ctNew" data-k="${kk}" aria-label="Agendar el ${dmy(kk)}">+</button></header>${X.map(e=>agChip(e,1)).join('')||'<p class="ag-0">Libre</p>'}</section>`;}).join('')}</div>`;}
 else{const E=agEvents(k,k);title=d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});const H=[];for(let h=7;h<=21;h++)H.push(h);
  const all=E.filter(e=>e.allDay);
  body=`${all.length?`<div class="ag-all"><span class="sm mut">Todo el día</span>${all.map(e=>agChip(e,1)).join('')}</div>`:''}<div class="ag-d">${H.map(h=>{const hh=String(h).padStart(2,'0');const X=E.filter(e=>!e.allDay&&new Date(e.at).getHours()===h);
   return`<div class="ag-hr${k===today&&new Date().getHours()===h?' now':''}"><button class="ag-hl" data-act="ctNew" data-k="${k}" data-hm="${hh}:00" aria-label="Agendar a las ${hh}:00">${hh}:00</button><div>${X.map(e=>agChip(e,1)).join('')}</div></div>`;}).join('')}</div>`;}
 const E7=agEvents(today,today);
 return`<div class="ag-bar"><div class="ag-nav"><button class="btn sm" data-act="agMove" data-d="-1" aria-label="Anterior">◀</button><button class="btn sm" data-act="agToday">Hoy</button><button class="btn sm" data-act="agMove" data-d="1" aria-label="Siguiente">▶</button><h2>${esc(title)}</h2></div>
  <div class="ag-tools"><div class="segmento" role="group" aria-label="Vista">${[['dia','Día'],['semana','Semana'],['mes','Mes']].map(([x,t])=>`<button class="btn sm ${v===x?'gold':''}" data-act="agView" data-v="${x}" aria-pressed="${v===x}">${t}</button>`).join('')}</div>
  <select id="ag-o" aria-label="Responsable"><option value="">Todo el equipo</option>${owners.map(o=>`<option ${ctF.ag.own===o?'selected':''}>${esc(o)}</option>`).join('')}</select><button class="btn gold" data-act="ctNew" data-k="${v==='dia'?k:today}">+ Agendar</button></div></div>
 <p class="sm mut">Hoy: ${E7.length} evento(s). ${Object.entries(Object.assign({},CT_KIND,{deal:{i:'💼',t:'Próximo paso de oportunidad'},turno:{i:'🗓️',t:'Turno del chat'}})).filter(([x])=>x!=='nota').map(([x,o])=>`<span class="ag-lg ag-${x}">${o.i} ${o.t}</span>`).join(' ')}</p>${body}`;}
A.agView=el=>{ctF.ag.v=el.dataset.v;crmPaint();};
A.agToday=()=>{ctF.ag.k='';crmPaint();};
A.agMove=el=>{const n=+el.dataset.d;const k=ctF.ag.k||dkey(now());const v=ctF.ag.v;
 if(v==='mes'){const d=new Date(k+'T12:00:00');d.setDate(1);d.setMonth(d.getMonth()+n);ctF.ag.k=dkey(d.getTime());}else ctF.ag.k=ctAddDays(k,v==='semana'?7*n:n);crmPaint();};
A.agDay=el=>{ctF.ag.k=el.dataset.k;ctF.ag.v='dia';crmPaint();};
A.agOpen=el=>{const ty=el.dataset.ty,id=el.dataset.id;if(ty==='t')return A.ctOpen({dataset:{id}});if(ty==='d')return A.dlOpen({dataset:{id}});crmSel=id;crmTab='inbox';rerender();};
function agBind(){const o=$('#ag-o');if(o)o.addEventListener('change',()=>{ctF.ag.own=o.value;crmPaint();});}

/* ---------- 5) Pipeline: semáforo, lista, origen, próximo paso y ganado ---------- */
dlF.view=dlF.view||'board';dlF.src='';
{const _f=dlFiltered;dlFiltered=function(){return _f.apply(this,arguments).filter(d=>!dlF.src||(d.src||'')===dlF.src);};}
{const _c=dlCard;dlCard=function(d){let h=_c.apply(this,arguments);if(d.status!=='open')return h;const s=dlStage(d.stage);const lim=dlLim(s);const age=dlDays(d);const lv=age>lim?'r':age>lim/2?'a':'v';
 const lbl={v:'Al día',a:'Se está enfriando',r:'Estancada'}[lv];h=h.replace(/<span class="dl-age[^"]*" title="Días en esta etapa">(\d+) d<\/span>/,`<span class="dl-rot dl-rot-${lv}" title="${lbl}: ${age} de ${lim} días en la etapa">● $1 d</span>`);
 if(d.src)h=h.replace('<div class="dl-amt">',`<div class="dl-src">${esc(CT_SRC[d.src]||d.src)}</div><div class="dl-amt">`);
 if(!d.nextAt&&!ctPend(d.id))h=h.replace('<div class="dl-ft">','<div class="dl-nx late">❔ Sin próximo paso</div><div class="dl-ft">');return h;};}
function dlListHTML(){const D=dlFiltered().filter(d=>d.status==='open');const L=dlStages();const owners=typeof crmAgents==='function'?crmAgents():[];
 return`<div class="tw"><table class="dl-tbl"><thead><tr><th>Oportunidad</th><th>Etapa</th><th class="r">Monto</th><th>Próximo paso</th><th>Fecha</th><th>Responsable</th><th>Estado</th></tr></thead><tbody>
 ${D.sort((a,b)=>L.findIndex(s=>s.k===a.stage)-L.findIndex(s=>s.k===b.stage)||b.amount-a.amount).map(d=>{const s=dlStage(d.stage);const lim=dlLim(s);const age=dlDays(d);const lv=age>lim?'r':age>lim/2?'a':'v';
  return`<tr data-dli="${d.id}"><td><button class="lnk" data-act="dlOpen" data-id="${d.id}"><b>${esc(d.title)}</b></button><div class="sm mut">${esc(d.n)} · ${esc(d.custName||'Sin cliente')}${d.src?' · '+esc(CT_SRC[d.src]||''):''}</div></td>
  <td><select data-f="stage" aria-label="Etapa">${L.map(x=>`<option value="${x.k}" ${x.k===d.stage?'selected':''}>${esc(x.t)}</option>`).join('')}</select></td>
  <td class="r"><input data-f="amount" inputmode="decimal" value="${String(dlAmt(d)/100)}" aria-label="Monto" style="width:7.5rem;text-align:right"></td>
  <td><input data-f="next" maxlength="120" value="${esc(d.next||'')}" placeholder="—" aria-label="Próximo paso"></td><td><input data-f="nextAt" type="date" value="${esc(d.nextAt||'')}" aria-label="Fecha del próximo paso"></td>
  <td><select data-f="owner" aria-label="Responsable">${owners.concat(owners.includes(d.owner)?[]:[d.owner]).filter(Boolean).map(o=>`<option ${o===d.owner?'selected':''}>${esc(o)}</option>`).join('')}</select></td>
  <td><span class="dl-rot dl-rot-${lv}">● ${age} d</span></td></tr>`;}).join('')||'<tr><td colspan="7" class="mut">No hay oportunidades abiertas con estos filtros.</td></tr>'}</tbody></table></div><p class="sm mut">Los cambios se guardan solos al salir de cada casilla.</p>`;}
{const _b=dlBoardHTML;dlBoardHTML=function(){let h=_b.apply(this,arguments);if(!dlOn())return h;
 const src=`<select id="dl-src" aria-label="Origen"><option value="">Todo origen</option>${Object.entries(CT_SRC).filter(([k])=>k).map(([k,v])=>`<option value="${k}" ${dlF.src===k?'selected':''}>${v}</option>`).join('')}</select>`;
 const tog=dlF.show==='closed'?'':`<span class="segmento" role="group" aria-label="Vista"><button class="btn sm ${dlF.view!=='list'?'gold':''}" data-act="dlView" data-v="board" aria-pressed="${dlF.view!=='list'}">▦ Tablero</button><button class="btn sm ${dlF.view==='list'?'gold':''}" data-act="dlView" data-v="list" aria-pressed="${dlF.view==='list'}">☰ Lista</button></span>`;
 h=h.replace('<button class="btn gold" data-act="dlNew">',src+tog+'<button class="btn gold" data-act="dlNew">');
 if(dlF.view==='list'&&dlF.show!=='closed')h=h.replace(/<div class="dl-board" id="dl-board"[\s\S]*$/,dlListHTML());return h;};}
A.dlView=el=>{dlF.view=el.dataset.v;crmPaint();};
function dlListBind(){const s=$('#dl-src');if(s)s.addEventListener('change',()=>{dlF.src=s.value;crmPaint();});const T=$('.dl-tbl');if(!T)return;
 T.addEventListener('change',e=>{const f=e.target.dataset.f;const tr=e.target.closest('tr[data-dli]');if(!f||!tr)return;const id=tr.dataset.dli;let r;
  if(f==='stage')r=dlMove(id,e.target.value);else if(f==='amount'){const v=cents(e.target.value);r=v>=0?dlEdit(id,{amount:v}):{err:'Monto inválido.'};}else r=dlEdit(id,{[f]:e.target.value});
  if(r&&r.err){toast(r.err,1);crmPaint();}else{toast('Guardado');if(f==='stage')crmPaint();}});}
/* origen del cliente en el alta y en la ficha */
{const _f=dlForm;dlForm=function(d){d=d||{};return _f.apply(this,arguments)+`<label for="dlf-src">Origen</label><select id="dlf-src">${Object.entries(CT_SRC).map(([k,v])=>`<option value="${k}" ${(d.src||'')===k?'selected':''}>${v}</option>`).join('')}</select>`;};}
{const _r=dlFormRead;dlFormRead=function(){const o=_r.apply(this,arguments);const s=$('#dlf-src');if(s)o.src=s.value;return o;};}
{const _c=dlCreate;dlCreate=function(o){const r=_c.apply(this,arguments);if(r.d&&o&&CT_SRC[o.src]!==undefined){r.d.src=o.src;save();}if(r.d&&o&&o.nextAt&&!o.noTask)ctCreate({kind:'llamada',title:r.d.next||'Seguimiento',at:ctTs(r.d.nextAt,'10:00'),deal:r.d.id});return r;};}
{const _e=dlEdit;dlEdit=function(id,o){const r=_e.apply(this,arguments);if(r.d&&o&&CT_SRC[o.src]!==undefined){r.d.src=o.src;save();}return r;};}
/* al mover de etapa se propone el próximo paso (una vez pintado el tablero) */
let ctAsk='';
{const _m=dlMove;dlMove=function(id,to){const before=(dlById(id)||{}).stage;const r=_m.apply(this,arguments);if(r.d&&before!==to&&r.d.status==='open'&&crmCfg().askNext!==false)ctAsk=id;return r;};}
/* deal.won: el cliente pasa a «activo», se cierran sus tareas y queda el evento para facturación o alta */
{const _w=dlWin;dlWin=function(id,why){const r=_w.apply(this,arguments);if(!r.d)return r;const d=r.d;const cu=d.cust&&custById(d.cust);
 if(cu){cu.tags=Array.isArray(cu.tags)?cu.tags:[];if(!cu.tags.includes('Cliente activo'))cu.tags.push('Cliente activo');cu.lastWon=now();}
 cts().filter(t=>t.deal===d.id&&!t.done&&t.kind!=='nota').forEach(t=>{t.done=now();t.result='Oportunidad ganada';t.upd=now();});
 try{window.dispatchEvent(new CustomEvent('vb:deal.won',{detail:{id:d.id,n:d.n,cust:d.cust,amount:dlAmt(d),quote:d.quote||''}}));}catch(e){}save();return r;};}

/* ---------- 6) Ficha 360° de la oportunidad ---------- */
function dlTimeline(d){const T=[];(d.hist||[]).forEach(h=>T.push({ts:h.ts,ic:h.why&&/^(Llamada|WhatsApp|Reunión|Visita|Tarea|Hecho)/.test(h.why)?'✔':'🔀',u:h.u,x:(h.from?(dlStage(h.from)||{t:h.from}).t+' → ':'')+((dlStage(h.to)||{t:h.to}).t||h.to)+(h.why?' · '+h.why:'')}));
 cts().filter(t=>t.deal===d.id).forEach(t=>{if(t.kind==='nota')T.push({ts:t.ts,ic:'📝',u:t.by,x:t.notes||t.title,note:1});else if(!t.done)T.push({ts:t.ts,ic:'📅',u:t.by,x:'Agendó '+CT_KIND[t.kind].t.toLowerCase()+': '+t.title+' · '+dmy(dkey(t.at))+' '+ctHm(t.at)});});
 const cv=d.conv&&convById(d.conv);if(cv)cmsgs().filter(m=>m.conv===cv.id&&(m.dir==='in'||m.dir==='out')).slice(-25).forEach(m=>T.push({ts:m.ts,ic:m.dir==='in'?'⬅️':'➡️',u:m.dir==='in'?crmWho(cv):m.user,x:m.text,chan:(CHAN&&CHAN[m.chan])||''}));
 const mt=s=>esc(s).replace(/@([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/g,'<b class="ct-at">@$1</b>');
 return T.sort((a,b)=>b.ts-a.ts).map(x=>`<li class="${x.note?'tl-note':''}"><span class="tl-i" aria-hidden="true">${x.ic}</span><div><div class="tl-x">${mt(x.x)}</div><div class="sm mut">${fmtDT(x.ts)} · ${esc(x.u||'')}${x.chan?' · '+esc(x.chan):''}</div></div></li>`).join('');}
A.dlOpen=el=>{const d=dlById(el.dataset.id);if(!d)return;const cv=d.conv&&convById(d.conv);const q=d.quote&&typeof quotes==='function'&&quotes().find(x=>x.id===d.quote);const cu=d.cust&&custById(d.cust);
 const others=d.cust?dls().filter(x=>x.cust===d.cust&&x.id!==d.id):[];const P=cts().filter(t=>t.deal===d.id&&!t.done&&t.kind!=='nota').sort((a,b)=>a.at-b.at);const s=dlStage(d.stage)||{t:d.stage,p:0};
 const lim=dlLim(s);const age=dlDays(d);const lv=age>lim?'r':age>lim/2?'a':'v';const wa=cv?crmWa(cv):cu&&waOk(cu)?waDigits(cu):'';
 const w=modal(d.n+' · '+d.title,`<div class="d360">
 <section class="d360-l" aria-label="Datos"><div class="d360-st">${d.status==='open'?`<b>${esc(s.t)}</b> · ${s.p} % · <span class="dl-rot dl-rot-${lv}">● ${age} de ${lim} d</span>`:d.status==='won'?'🏆 Ganada':'✖ Perdida: '+esc(d.lostWhy||'')}</div>
  <div class="d360-amt">${money(dlAmt(d))}${d.status==='open'?` <small class="mut">→ ${money(Math.round(dlAmt(d)*s.p/100))} ponderado</small>`:''}</div>
  <h4>Cliente</h4><p class="sm"><b>${esc(d.custName||'Sin cliente')}</b>${cu?`<br>${esc(cu.wa?'WhatsApp '+cu.wa:'')}${cu.email?'<br>'+esc(cu.email):''}${cu.cuit?'<br>CUIT '+esc(cu.cuit):''}${(cu.tags||[]).length?'<br>'+cu.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join(' '):''}`:''}${d.src?'<br>Origen: '+esc(CT_SRC[d.src]||d.src):''}</p>
  ${others.length?`<h4>Otras oportunidades</h4><ul class="sm d360-o">${others.slice(0,5).map(x=>`<li><button class="lnk" data-act="dlOpen" data-id="${x.id}">${esc(x.n)}</button> ${esc(x.title)} · ${money(dlAmt(x))} · ${x.status==='won'?'ganada':x.status==='lost'?'perdida':'abierta'}</li>`).join('')}</ul>`:''}
  ${d.status==='open'?`<details class="d360-ed"><summary>Editar datos</summary>${dlForm(d)}</details>`:''}</section>
 <section class="d360-c" aria-label="Línea de tiempo"><h4>Línea de tiempo</h4><div class="d360-nt"><textarea id="d360-n" rows="2" maxlength="400" placeholder="Nota interna… usá @nombre para avisar a un compañero"></textarea><button class="btn sm gold" type="button" data-act="dlNote" data-id="${d.id}">Agregar nota</button></div><ul class="tl">${dlTimeline(d)||'<li class="mut">Sin movimientos.</li>'}</ul></section>
 <section class="d360-r" aria-label="Próximos pasos"><div class="d360-nx ${P.length||d.status!=='open'?'':'falta'}"><h4>Próxima acción</h4>${P.length?P.slice(0,3).map(t=>`<button class="lnk" data-act="ctOpen" data-id="${t.id}">${CT_KIND[t.kind].i} <b>${esc(t.title)}</b></button><div class="sm ${t.at<now()?'hy-red':'mut'}">${dmy(dkey(t.at))} ${ctHm(t.at)} · ${esc(t.owner)}</div>`).join(''):d.status==='open'?'<p class="sm">⚠ Sin próximo paso programado.</p>':'<p class="sm mut">Cerrada.</p>'}
  ${d.status==='open'?`<button class="btn sm gold" data-act="ctNext" data-deal="${d.id}">📅 Programar</button>`:''}</div>
  ${q?`<h4>Presupuesto</h4><p class="sm">${esc(q.n)} · ${esc(QT_TXT[qtState(q)]||'')} · ${money(typeof qtTotal==='function'?qtTotal(q):dlAmt(d))}</p>`:''}${(d.prods||[]).length?`<h4>Productos</h4><ul class="sm">${d.prods.slice(0,8).map(p=>`<li>${esc(p.name||p.n||'')}${p.qty?' × '+p.qty:''}</li>`).join('')}</ul>`:''}
  <div class="d360-ac">${wa?`<a class="btn sm" href="${waLink(ctWaText({cust:d.cust,conv:d.conv,motivo:d.title}),wa)}" target="_blank" rel="noopener" data-dlwa="${d.id}">💬 WhatsApp</a>`:''}${cv?`<button class="btn sm" data-act="dlConv" data-id="${d.id}">Abrir conversación</button>`:''}
  ${d.status==='open'?`<button class="btn sm gold" data-act="dlWinA" data-id="${d.id}">🏆 Ganada</button><button class="btn sm red" data-act="dlLoseA" data-id="${d.id}">✖ Perdida</button>`:`<button class="btn sm" data-act="dlReopenA" data-id="${d.id}">Reabrir</button>`}</div></section></div>`,
  d.status==='open'?{wide:true,okText:'Guardar cambios',cancelText:'Cerrar',onOk:w=>{if(!$('#dlf-t',w))return true;const r=dlEdit(d.id,dlFormRead());if(r.err)return w._err(r.err),false;toast('Guardado');crmPaint();}}:{wide:true,ok:false,cancelText:'Cerrar'});
 w.addEventListener('click',e=>{const a=e.target.closest('[data-dlwa]');if(a){d.hist.push({ts:now(),u:user.name,to:d.stage,why:'WhatsApp enviado'});d.act=now();save();}});};
A.dlNote=el=>{const d=dlById(el.dataset.id);const t=$('#d360-n');if(!d||!t)return;const x=ctClean(t.value,400);if(x.length<2)return toast('Escribí la nota.',1);
 const r=ctCreate({kind:'nota',title:'Nota',notes:x,at:now(),deal:d.id});if(r.err)return toast(r.err,1);
 const men=[...new Set((x.match(/@([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/g)||[]).map(s=>s.slice(1).toLowerCase()))];const ag=(typeof crmAgents==='function'?crmAgents():[]).filter(n=>men.some(m=>n.toLowerCase().split(/\s+/)[0]===m));
 ag.forEach(n=>{if(n!==crmMe())ctCreate({kind:'tarea',title:'Te mencionaron en '+d.n+': '+x.slice(0,60),at:now(),owner:n,cust:d.cust,custName:d.custName});});
 dlCloseTop();A.dlOpen({dataset:{id:d.id}});toast(ag.length?'Nota guardada · avisado a '+ag.join(', '):'Nota guardada');};
/* etapas: probabilidad y días límite para el semáforo */
{const _s=A.dlStagesEd;A.dlStagesEd=function(){_s.apply(this,arguments);setTimeout(()=>{const w=$$('#modal-root .ov').slice(-1)[0];if(!w)return;const L=dlStages();
 $$('.dls-r',w).forEach((r,i)=>r.insertAdjacentHTML('beforeend',`<input class="dls-d" type="number" min="1" max="90" value="${dlLim(L[i])}" style="width:4.5rem" aria-label="Días límite antes de marcarla estancada" title="Días límite">`));
 const p=$('p',w);if(p)p.insertAdjacentHTML('afterend','<p class="sm mut">Columnas: nombre · probabilidad % · días límite (después se marca 🔴 estancada).</p>');
 const ok=$('[data-m="ok"]',w);if(ok)ok.addEventListener('click',()=>{const D=$$('.dls-r',w).map(r=>{const x=$('.dls-d',r);return x?Math.max(1,Math.min(90,Math.round(+x.value||7))):7;});
  setTimeout(()=>{const S2=dlStages().map((s,i)=>Object.assign({},s,{d:D[i]||dlLim(s)}));crmSet({stages:S2});save();crmPaint();},0);},true);
 const add=$('#dls-add',w);if(add)add.addEventListener('click',()=>setTimeout(()=>{const R=$$('.dls-r',w);const r=R[R.length-1];if(r&&!$('.dls-d',r))r.insertAdjacentHTML('beforeend','<input class="dls-d" type="number" min="1" max="90" value="7" style="width:4.5rem" aria-label="Días límite">');},0));},40);};}

/* ---------- 7) Enganches con la pantalla de Atención al cliente ---------- */
{const _b=crmBody;crmBody=function(){if(crmTab==='hoy')return hoyHTML();if(crmTab==='agenda')return agHTML();return _b.apply(this,arguments);};}
{const _p=crmPaint;crmPaint=function(){const r=_p.apply(this,arguments);if(crmTab==='agenda')agBind();if(crmTab==='deals')dlListBind();
 const v=$('#view');if(v&&!v._ctwa){v._ctwa=1;v.addEventListener('click',e=>{const a=e.target.closest('[data-hywa]');if(a)hoyWaLog(a.dataset.hywa);});}
 if(ctAsk){const id=ctAsk;ctAsk='';setTimeout(()=>{const d=dlById(id);if(d&&d.status==='open')A.ctNext({dataset:{deal:id}});},120);}return r;};}
{const s=SCREENS.crm;const _r=s.render;s.render=function(){if(typeof ctDemoSeed==='function')try{ctDemoSeed();}catch(e){}let h=_r.apply(this,arguments);
 const I=hoyItems();const urg=I.filter(x=>x.lv===0).length;const tab=(k,t)=>`<a role="tab" tabindex="0" data-act="crmTab" data-t="${k}" aria-selected="${crmTab===k}" class="${crmTab===k?'on':''}">${t}</a>`;
 h=h.replace(/(<div class="ux-tabs" role="tablist" aria-label="Atención al cliente">)/,'$1'+tab('hoy','⚡ Hoy'+(urg?' <span class="hy-badge">'+urg+'</span>':'')));
 h=h.replace(/(<a role="tab"[^>]*data-t="deals"[^>]*>[^<]*<\/a>)/,'$1'+tab('agenda','📅 Agenda'));
 if(!/data-t="agenda"/.test(h))h=h.replace(/(<a role="tab"[^>]*data-t="inbox"[^>]*>[^<]*<\/a>)/,'$1'+tab('agenda','📅 Agenda'));
 return h+CT_CSS;};}
/* V27.25 · en los sistemas propios de VB (Almacén RAVE) el Pipeline se enciende una sola vez, si nunca se tocó a mano */
function ctPipeAuto(){try{if(!IS_CLIENT||typeof VBL==='undefined'||!VBL.lic||!VBL.lic.propio||!user||!giAdm())return;const m=giCfg();if(m.pipeline!==undefined||S.cfg.pipeAuto)return;
 m.pipeline=true;S.cfg.pipeAuto=1;audit('MODULO','Pipeline de ventas encendido (sistema propio)');save();}catch(e){}}
{const _sp=showPanel;showPanel=function(){ctPipeAuto();return _sp.apply(this,arguments);};}
/* «Hoy» es la pantalla de llegada de Atención al cliente */
if(typeof crmTab!=='undefined'&&crmTab==='inbox')crmTab='hoy';

/* ---------- 8) Nube: colección «ctask» (SQL 36) ---------- */
let vb36=false,vb36At=0;
function vb36Enable(){if(vb36||typeof COLS==='undefined')return;const x={c:'ctask',key:'ctasks',pii:['title','custName','notes','result']};if(!COLS.some(y=>y.c==='ctask')){COLS.push(x);BYC.ctask=x;}vb36=true;}
if(typeof pushAll==='function'){const _pa=pushAll;pushAll=async function(){if(!vb36&&typeof cl!=='undefined'&&cl.comercio&&Date.now()-vb36At>600000){vb36At=Date.now();try{const v=await rpc('vb_version',{});if(+v>=36)vb36Enable();}catch(e){}}return _pa.apply(this,arguments);};}

/* ---------- 9) Datos de ejemplo (sólo demos) ---------- */
function ctDemoSeed(){if(IS_CLIENT||S.ctDemo>=1)return;const L=S.customers.filter(c=>c.status!=='baja');if(L.length<4||!ctDl())return;S.ctDemo=1;
 const ag=(S.users||[]).map(u=>u.name);const a0=ag[0]||crmMe(),a1=ag[1]||a0,a2=ag[2]||a0;const k0=dkey(now());const day=n=>ctAddDays(k0,n);const t=now();
 const mk=(o,ageD)=>{const r=dlCreate(Object.assign({noTask:1},o));if(r.d){r.d.stAt=t-ageD*864e5;r.d.ts=Math.min(r.d.ts,r.d.stAt);}return r.d;};
 const C=i=>L[i%L.length];const st=k=>(dlStages().find(s=>s.k===k)||dlStages()[0]).k;
 const d1=mk({title:'Provisión mensual',cust:C(0).id,amount:48000000,stage:st('negociacion'),prio:'alta',owner:a0,src:'referido',next:'Llamar para cerrar',nextAt:day(-1)},4);
 const d2=mk({title:'Pedido para evento',cust:C(1).id,amount:21500000,stage:st('propuesta'),prio:'media',owner:a1,src:'whatsapp'},3);
 const d3=mk({title:'Alta de cuenta corriente',cust:C(2).id,amount:9800000,stage:st('contacto'),prio:'media',owner:a2,src:'web'},9);
 const d4=mk({title:'Reposición semanal',cust:C(3).id,amount:15600000,stage:st('reunion'),prio:'baja',owner:a0,src:'preventa',next:'Visita al local',nextAt:k0},2);
 const d5=mk({title:'Primera compra',cust:C(4).id,amount:6200000,stage:st('calificado'),prio:'media',owner:a1,src:'instagram'},1);
 mk({title:'Combo aniversario',cust:C(5).id,amount:12300000,stage:st('propuesta'),prio:'alta',owner:a2,src:'web',next:'Enviar propuesta ajustada',nextAt:day(2)},1);
 if(d1)ctCreate({kind:'llamada',title:'Llamar para cerrar la provisión',at:ctTs(day(-1),'11:00'),deal:d1.id,owner:a0});
 if(d4)ctCreate({kind:'visita',title:'Visita al local para relevar góndola',at:ctTs(k0,'16:30'),deal:d4.id,owner:a0,dur:45});
 if(d2)ctCreate({kind:'whatsapp',title:'Confirmar cantidades del evento',at:ctTs(k0,'12:00'),deal:d2.id,owner:a1});
 if(d5)ctCreate({kind:'reunion',title:'Presentación de lista de precios',at:ctTs(day(1),'10:00'),deal:d5.id,owner:a1,dur:60});
 ctCreate({kind:'tarea',title:'Preparar lista de precios mayorista',at:ctTs(day(3),'09:00'),owner:a2});
 if(d3)d3.nextAt='';const won=mk({title:'Pedido inaugural',cust:C(6).id,amount:27000000,stage:st('negociacion'),owner:a0,src:'referido'},6);if(won){dlWin(won.id);won.closedAt=t-2*864e5;}
 const lost=mk({title:'Cotización especial',cust:C(7).id,amount:8000000,stage:st('propuesta'),owner:a1,src:'web'},8);if(lost){dlLose(lost.id,'Precio');lost.closedAt=t-3*864e5;}
 if(!crmCfg().goal)crmSet({goal:150000000});save();}

/* ---------- 10) Diseño (variables del sistema, claro/oscuro, 320–1440 px, AA) ---------- */
const CT_CSS=`<style>
.hy-badge{display:inline-block;min-width:1.2em;padding:0 .35em;border-radius:999px;background:var(--crm-a);color:#fff;font-size:.72rem;font-weight:700;line-height:1.35;text-align:center}
.hy-hd{display:flex;flex-wrap:wrap;gap:.6rem;align-items:flex-end;justify-content:space-between;margin:.2rem 0 .6rem}.hy-hd h2{margin:0;font-size:1.35rem}.hy-hd p{margin:.15rem 0 0}.hy-tb{display:flex;gap:.4rem;flex-wrap:wrap}
.hy-red{color:var(--crm-a);font-weight:700}
.hy-kpi{display:grid;grid-template-columns:1.4fr repeat(3,1fr);gap:.5rem;margin-bottom:.8rem}.hy-kpi>div{border:1px solid var(--line);border-radius:14px;padding:.65rem .8rem;background:var(--card);display:flex;flex-direction:column;gap:.15rem;min-width:0}
.hy-kpi span{font-size:.75rem;color:var(--mut);text-transform:uppercase;letter-spacing:.03em}.hy-kpi b{font-size:1.25rem;line-height:1.2}.hy-kpi b small{font-size:.8rem;font-weight:500;color:var(--mut)}.hy-kpi small{font-size:.75rem}
.hy-pg{display:block;height:8px;border-radius:99px;background:rgba(127,127,127,.18);overflow:hidden;margin:.2rem 0 .1rem}.hy-pg i{display:block;height:100%;background:var(--gold);border-radius:99px}
.lnk{background:none;border:0;padding:0;color:var(--gold);font:inherit;cursor:pointer;text-align:left;text-decoration:underline;text-underline-offset:2px}
.hy-grid{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:.8rem;align-items:start}.hy-q h3{margin:.1rem 0 .5rem;font-size:1rem}.hy-side{display:flex;flex-direction:column;gap:.6rem}
.hy-list{list-style:none;margin:0 0 .6rem;padding:0;display:flex;flex-direction:column;gap:.4rem}
.hy-r{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:.55rem;align-items:center;background:var(--card);border:1px solid var(--line);border-left:5px solid var(--line);border-radius:12px;padding:.5rem .6rem}
.hy-l0{border-left-color:var(--crm-a)}.hy-l1{border-left-color:var(--crm-m)}.hy-l2{border-left-color:#5b8def}
.hy-i{font-size:1.25rem;width:1.6rem;text-align:center}.hy-m{all:unset;cursor:pointer;display:flex;flex-direction:column;min-width:0}.hy-m:focus-visible{outline:3px solid var(--gold);outline-offset:2px;border-radius:6px}
.hy-m b{font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hy-m span{font-size:.8rem;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hy-w{display:flex;flex-direction:column;align-items:flex-end;gap:.1rem;font-size:.85rem;white-space:nowrap}.hy-tag{font-size:.72rem;font-weight:600;border-radius:999px;padding:.05rem .45rem;background:rgba(127,127,127,.14)}
.hy-l0 .hy-tag{background:rgba(200,60,50,.15);color:var(--crm-a)}.hy-l1 .hy-tag{background:rgba(201,150,62,.18)}
.hy-a{display:flex;gap:.25rem}.hy-b{min-width:38px;min-height:38px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:10px;background:transparent;color:inherit;cursor:pointer;font-size:1rem;text-decoration:none}
.hy-b:hover{border-color:var(--gold)}.hy-b:disabled{opacity:.35;cursor:not-allowed}.hy-b.ok{background:var(--gold);border-color:var(--gold);color:#1a1307;font-weight:700}
.hy-zero{border:1px dashed var(--line);border-radius:14px;padding:1.4rem;text-align:center}.hy-nx{list-style:none;padding:0;margin:0 0 .5rem}.hy-nx li{padding:.3rem 0;border-bottom:1px solid var(--line);display:flex;flex-direction:column}
.hy-dot{display:inline-block;width:.7em;height:.7em;border-radius:50%;margin-right:.3em;vertical-align:-.05em}.hy-dot.l0{background:var(--crm-a)}.hy-dot.l1{background:var(--crm-m)}.hy-dot.l2{background:#5b8def}
.hy-res{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0}.ct-kinds{display:flex;flex-wrap:wrap;gap:.3rem;margin:.2rem 0 .4rem}.ct-k input{position:absolute;opacity:0}.ct-k span{display:inline-block;padding:.35rem .65rem;border:1px solid var(--line);border-radius:999px;font-size:.85rem;cursor:pointer}
.ct-k input:checked+span{background:var(--tx,var(--gold));border-color:var(--gold);background:var(--gold);color:#1a1307;font-weight:600}.ct-k input:focus-visible+span{outline:3px solid var(--gold);outline-offset:2px}
.ag-bar{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;justify-content:space-between;margin:.2rem 0 .4rem}.ag-nav{display:flex;align-items:center;gap:.3rem;flex-wrap:wrap}.ag-nav h2{margin:0 0 0 .4rem;font-size:1.15rem;text-transform:capitalize}
.ag-tools{display:flex;gap:.35rem;flex-wrap:wrap;align-items:center}.ag-tools .segmento{display:inline-flex;gap:.2rem}.ag-tools select{min-width:0;max-width:12rem}
.ag-lg{font-size:.75rem;white-space:nowrap;margin-right:.35rem}
.ag-e{display:block;width:100%;text-align:left;border:0;border-left:3px solid var(--gold);background:rgba(201,150,62,.13);color:inherit;border-radius:6px;padding:.2rem .35rem;margin:.12rem 0;font:inherit;font-size:.78rem;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ag-e small{display:block;color:var(--mut);font-size:.72rem;overflow:hidden;text-overflow:ellipsis}.ag-e:focus-visible{outline:2px solid var(--gold)}.ag-h{font-weight:700;margin-right:.25rem}
.ag-llamada{border-left-color:#3f8f5a;background:rgba(63,143,90,.13)}.ag-whatsapp{border-left-color:#25a35a;background:rgba(37,163,90,.13)}.ag-reunion{border-left-color:#5b8def;background:rgba(91,141,239,.14)}
.ag-visita{border-left-color:#a868d8;background:rgba(168,104,216,.13)}.ag-deal{border-left-color:var(--gold)}.ag-turno{border-left-color:#e07b39;background:rgba(224,123,57,.13)}
.ag-e.done{opacity:.5;text-decoration:line-through}.ag-e.late{box-shadow:inset 0 0 0 1px var(--crm-a)}
.ag-m{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border:1px solid var(--line);border-radius:14px;overflow:hidden}.ag-dw{padding:.35rem;font-size:.75rem;font-weight:700;text-align:center;background:rgba(127,127,127,.08);border-bottom:1px solid var(--line)}
.ag-c{min-height:96px;padding:.25rem;border-right:1px solid var(--line);border-bottom:1px solid var(--line);min-width:0}.ag-c:nth-child(7n){border-right:0}.ag-c.out{background:rgba(127,127,127,.05)}.ag-c.out .ag-n{opacity:.45}
.ag-n{all:unset;cursor:pointer;font-size:.8rem;font-weight:600;padding:.1rem .35rem;border-radius:999px}.ag-n:focus-visible{outline:2px solid var(--gold)}.ag-c.hoy .ag-n,.ag-wd.hoy header .ag-n b{background:var(--gold);color:#1a1307}
.ag-more{all:unset;cursor:pointer;font-size:.72rem;color:var(--gold);padding:0 .3rem}
.ag-w{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:.4rem}.ag-wd{border:1px solid var(--line);border-radius:12px;padding:.35rem;min-height:180px;background:var(--card);min-width:0}.ag-wd.hoy{border-color:var(--gold)}
.ag-wd header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem}.ag-wd header b{display:inline-block;min-width:1.6em;text-align:center;border-radius:999px;padding:0 .2em}
.ag-add{border:1px solid var(--line);background:transparent;color:inherit;border-radius:8px;width:28px;height:28px;cursor:pointer}.ag-0{color:var(--mut);font-size:.78rem;text-align:center;margin:.6rem 0}
.ag-all{display:flex;flex-wrap:wrap;gap:.3rem;align-items:center;margin-bottom:.4rem}.ag-all .ag-e{width:auto}
.ag-d{border:1px solid var(--line);border-radius:14px;overflow:hidden}.ag-hr{display:grid;grid-template-columns:64px 1fr;border-bottom:1px solid var(--line);min-height:44px}.ag-hr:last-child{border-bottom:0}.ag-hr.now{background:rgba(201,150,62,.08)}
.ag-hl{all:unset;cursor:pointer;font-size:.78rem;color:var(--mut);padding:.35rem .5rem;border-right:1px solid var(--line)}.ag-hl:hover{color:var(--gold)}.ag-hr>div{padding:.15rem .35rem}
.dl-rot{font-weight:700;font-size:.72rem;white-space:nowrap}.dl-rot-v{color:#2e9a55}.dl-rot-a{color:var(--crm-m)}.dl-rot-r{color:var(--crm-a)}.dl-src{font-size:.7rem;color:var(--mut)}
.dl-tbl input,.dl-tbl select{min-width:0;padding:.3rem .4rem}.dl-tbl td{vertical-align:middle}
.d360{display:grid;grid-template-columns:240px minmax(0,1fr) 240px;gap:1rem;align-items:start}.d360 h4{margin:.6rem 0 .25rem;font-size:.85rem;text-transform:uppercase;letter-spacing:.03em;color:var(--mut)}
.d360-st{font-size:.85rem}.d360-amt{font-size:1.5rem;font-weight:800;margin:.2rem 0}.d360-amt small{font-size:.8rem;font-weight:500}.d360-o{padding-left:1rem;margin:0}
.d360-c{border-left:1px solid var(--line);border-right:1px solid var(--line);padding:0 1rem;min-width:0}.d360-nt{display:flex;flex-direction:column;gap:.3rem;margin-bottom:.6rem}.d360-nt .btn{align-self:flex-end}
.tl{list-style:none;padding:0;margin:0;max-height:52vh;overflow:auto}.tl li{display:flex;gap:.5rem;padding:.45rem 0;border-bottom:1px solid var(--line)}.tl-i{width:1.4rem;text-align:center}.tl-x{white-space:pre-wrap;word-break:break-word;font-size:.88rem}
.tl-note .tl-x{background:rgba(201,150,62,.12);border-radius:8px;padding:.25rem .4rem}.ct-at{color:var(--gold)}
.d360-nx{border:1px solid var(--line);border-radius:12px;padding:.6rem;display:flex;flex-direction:column;gap:.25rem}.d360-nx.falta{border-color:var(--crm-a);background:rgba(200,60,50,.07)}.d360-nx h4{margin-top:0}
.d360-ac{display:flex;flex-direction:column;gap:.35rem;margin-top:.7rem}.d360-ac .btn{text-align:center;justify-content:center}
.dlg.wide:has(.d360){max-width:min(1100px,96vw)}
@media (max-width:1020px){.hy-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}.hy-grid{grid-template-columns:1fr}.ag-w{grid-template-columns:repeat(2,minmax(0,1fr))}.d360{grid-template-columns:1fr 1fr}.d360-c{grid-column:1/-1;grid-row:2;border:0;border-top:1px solid var(--line);padding:.6rem 0 0}}
@media (max-width:640px){.hy-r{grid-template-columns:auto minmax(0,1fr);row-gap:.35rem}.hy-w{grid-column:2;flex-direction:row;align-items:center;gap:.5rem}.hy-a{grid-column:1/-1;justify-content:flex-end}
 .hy-kpi b{font-size:1.05rem}.ag-w{grid-template-columns:1fr}.ag-wd{min-height:0}.ag-c{min-height:64px}.ag-c .ag-e{font-size:0;padding:0;height:6px;margin:.1rem 0}.ag-c .ag-e *{display:none}
 .d360{grid-template-columns:1fr}.d360-c{grid-row:auto}}
</style>`;
