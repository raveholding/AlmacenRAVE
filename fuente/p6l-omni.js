/* =====================================================================
   V26.73 · VB OMNI-ASSIST — mejoras de «Atención al cliente» (sobre p6j-crm.js, sin reemplazarlo)
   · Ficha 360° extendida: presencial / online, ticket promedio, última compra, frecuencia, favoritos, cumpleaños,
     presupuestos vigentes con «Convertir en venta», turnos y cobros pendientes; WhatsApp y DNI enmascarados salvo
     para quien tiene «Clientes: datos sensibles».
   · Copiloto ERP (reglas, sin IA, sin costo): lee el último mensaje, detecta productos y CANTIDADES, muestra precio,
     stock y subtotal reales, ofrece alternativas con stock del mismo rubro cuando falta, propone horarios libres y
     arma la respuesta; consulta rápida de stock/precio dentro del chat.
   · Presupuesto desde el chat: se arma en el mismo chat (precargado con lo que pidió el cliente), queda en
     Presupuestos (no descuenta stock), se envía por el canal, abre el PDF y se convierte en venta con un clic.
   · Agenda de 7 días: franjas según el horario de atención, duración y capacidad configurables; no deja reservar
     una franja llena ni fuera de horario (choques por superposición real, no por ±15 min).
   · Analíticas: tasa de resolución, cumplimiento del tiempo de primera respuesta (SLA), pendientes por antigüedad,
     volumen por hora, por departamento, prioridad y ánimo. Prioridad: lo que pasa el SLA sube a «alta».
   · Cliente: APAGADO hasta que el administrador lo active (S.cfg.crm.omni). Demos: encendido.
   ===================================================================== */
const OMNI_AG_DEF={ini:'09:00',fin:'20:00',dur:30,cap:1,dias:[1,2,3,4,5,6]};
const omniOn=()=>{const c=S.cfg.crm||{};return c.omni===undefined?!IS_CLIENT:!!c.omni;};
const omniAg=()=>{const c=(S.cfg.crm||{}).agenda||{};const o=Object.assign({},OMNI_AG_DEF,c);if(!Array.isArray(o.dias))o.dias=OMNI_AG_DEF.dias;o.dur=Math.max(10,Math.min(240,+o.dur||30));o.cap=Math.max(1,Math.min(20,+o.cap||1));return o;};
const omniSla=()=>{const v=+((S.cfg.crm||{}).slaMin);return v>0?Math.min(1440,v):15;};
const omniHM=s=>{const m=/^(\d{2}):(\d{2})$/.exec(s||'');return m?(+m[1])*60+(+m[2]):null;};
const omniDays=ts=>Math.floor((now()-ts)/864e5);
const omniMask=t=>{t=String(t||'');if(!t)return '';if(can('customers_admin'))return t;const d=t.replace(/\D/g,'');return d.length>4?'•••• '+d.slice(-4):'••••';};
/* ---------- cantidades en el texto: «2 fernet», «tres coca», «x6», «una caja» ---------- */
function omniQty(text,p){const t=' '+crmNorm(text)+' ';const ws=[...new Set(crmNorm(p.name).split(/[^a-z0-9]+/).filter(w=>w.length>=4))];let best=null;
 ws.forEach(w=>{let i=t.indexOf(w);while(i>=0&&best===null){const before=t.slice(Math.max(0,i-14),i).trim().split(/\s+/);for(let k=before.length-1;k>=Math.max(0,before.length-3);k--){const x=before[k].replace(/^x/,'');if(/^\d{1,4}$/.test(x)){best=+x;break;}if(typeof AS_NUM!=='undefined'&&AS_NUM[x]!==undefined&&AS_NUM[x]>=1){best=AS_NUM[x];break;}}
  if(best===null){const after=t.slice(i+w.length,i+w.length+8).match(/^\s*x\s*(\d{1,4})\b/);if(after)best=+after[1];}i=t.indexOf(w,i+1);}});
 return best&&best>0&&best<=9999?best:1;}
function omniAlt(p){const pr=+p.price||0;return S.products.filter(x=>x.active&&!x.archived&&x.id!==p.id&&x.rubro===p.rubro&&stockOf(x)>0&&(!pr||Math.abs((+x.price||0)-pr)<=pr*.4)).sort((a,b)=>Math.abs(a.price-pr)-Math.abs(b.price-pr)).slice(0,2);}
function omniItems(c){const ins=convMsgs(c.id).filter(m=>m.dir==='in');const last=ins.slice(-2).map(m=>m.text).join(' \n ');if(!last)return[];
 return crmProdsIn(last).map(p=>{const qty=omniQty(last,p),st=stockOf(p);return{p,qty,price:+p.price||0,st,sub:Math.round(qty*(+p.price||0)),ok:st>=qty,alt:st>=qty?[]:omniAlt(p)};});}
/* ---------- agenda ---------- */
function omniAppts(){return convs().flatMap(x=>(x.appts||[]).filter(a=>a.st!=='cancelado').map(a=>Object.assign({conv:x.id,who:crmWho(x)},a)));}
function omniBusy(at,dur,skip){const end=at+dur*60000;return omniAppts().filter(a=>a.id!==skip&&a.at<end&&a.at+(a.dur||omniAg().dur)*60000>at).length;}
function omniSlotsOf(dayTs){const g=omniAg(),d=new Date(dayTs);d.setHours(0,0,0,0);if(!g.dias.includes(d.getDay()))return[];const a=omniHM(g.ini),b=omniHM(g.fin);if(a===null||b===null||b<=a)return[];
 const out=[];for(let m=a;m+g.dur<=b;m+=g.dur){const at=d.getTime()+m*60000;const n=omniBusy(at,g.dur);out.push({at,n,free:n<g.cap&&at>now()});}return out;}
function omniFree(k){const out=[];const d0=new Date(now());d0.setHours(0,0,0,0);for(let i=0;i<14&&out.length<k;i++)omniSlotsOf(d0.getTime()+i*864e5).forEach(s=>{if(s.free&&out.length<k)out.push(s.at);});return out;}
function omniCheck(at,dur,skip){const g=omniAg(),d=new Date(at);const m=d.getHours()*60+d.getMinutes();if(!(at>now()))return 'El turno tiene que ser a futuro.';
 if(!g.dias.includes(d.getDay()))return 'Ese día no se atiende (ver horario de la agenda).';if(m<omniHM(g.ini)||m+dur>omniHM(g.fin))return 'Fuera del horario de atención ('+g.ini+' a '+g.fin+').';
 if(omniBusy(at,dur,skip)>=g.cap)return 'Esa franja ya está completa ('+g.cap+' turno'+(g.cap>1?'s':'')+' a la vez). Elegí otro horario.';return '';}
let omniDay=0;
function omniAgendaHTML(c){const C=crmCfg();if(!C.turnos)return'';const g=omniAg(),d0=new Date(now());d0.setHours(0,0,0,0);const days=[...Array(7)].map((_,i)=>d0.getTime()+i*864e5);
 const sl=omniSlotsOf(days[omniDay]);const mine=(c.appts||[]).filter(a=>a.st!=='cancelado').sort((a,b)=>a.at-b.at);
 return `<div class="crm-box"><h4>📅 Agenda · próximos 7 días</h4><div class="om-days" role="tablist" aria-label="Día">${days.map((t,i)=>{const s=omniSlotsOf(t);const fr=s.filter(x=>x.free).length;const dd=new Date(t);return `<button type="button" role="tab" aria-selected="${i===omniDay}" class="om-day${i===omniDay?' on':''}" data-act="omniDayGo" data-i="${i}"><span>${['Do','Lu','Ma','Mi','Ju','Vi','Sá'][dd.getDay()]} ${dd.getDate()}</span><small>${s.length?fr+' libre'+(fr===1?'':'s'):'cerrado'}</small></button>`;}).join('')}</div>
  <div class="om-slots">${sl.length?sl.map(s=>`<button type="button" class="om-slot${s.free?'':' full'}" ${s.free?`data-act="omniBook" data-at="${s.at}"`:'disabled'} aria-label="${crmHm(s.at)} ${s.free?'libre':'ocupado'}">${new Date(s.at).toTimeString().slice(0,5)}${g.cap>1?`<small>${s.n}/${g.cap}</small>`:''}</button>`).join(''):'<p class="sm mut">Ese día no se atiende.</p>'}</div>
  <p class="sm mut">Franjas de ${g.dur} min · ${g.ini} a ${g.fin} · hasta ${g.cap} a la vez.</p>
  ${mine.length?mine.map(a=>`<div class="crm-ap"><b>${crmHm(a.at)}</b> · ${esc(a.what)} <span class="crm-st ${a.st==='confirmado'?'crm-st-p':'crm-st-w'}">${a.st==='confirmado'?'Confirmado':'Reservado'}</span>${a.at<now()?' <span class="sm mut">(pasado)</span>':''}<div class="row" style="gap:.25rem;margin-top:.2rem">${a.st!=='confirmado'?`<button class="btn sm gold" data-act="crmApptOk" data-id="${esc(a.id)}">Confirmar</button>`:''}<button class="btn sm" data-act="omniBook" data-id="${esc(a.id)}">Reprogramar</button><button class="btn sm" data-act="crmApptX" data-id="${esc(a.id)}">Cancelar</button></div></div>`).join(''):'<p class="sm mut">Sin turnos para este cliente.</p>'}</div>`;}
A.omniDayGo=el=>{omniDay=Math.max(0,Math.min(6,+el.dataset.i||0));crmPaint();};
A.omniBook=el=>{const c=crmCur();if(!c||!crmCfg().turnos)return;const old=el&&el.dataset.id?(c.appts||[]).find(a=>a.id===el.dataset.id):null;const g=omniAg();
 const at0=old?old.at:(el&&+el.dataset.at)||omniFree(1)[0]||now()+864e5;const d=new Date(at0);const ds=dkey(at0),hs=d.toTimeString().slice(0,5);
 modal(old?'Reprogramar turno':'Reservar turno',`<div class="grid g2"><div><label for="ob-d">Día</label><input id="ob-d" type="date" value="${ds}"></div><div><label for="ob-h">Hora</label><input id="ob-h" type="time" value="${hs}" step="${g.dur*60}"></div></div>
  <label for="ob-w">Motivo / servicio</label><input id="ob-w" maxlength="60" value="${old?esc(old.what):''}" placeholder="Ej.: retiro de pedido, degustación, consulta"><label for="ob-u">Duración (min)</label><input id="ob-u" type="number" min="10" max="240" step="5" value="${old&&old.dur||g.dur}">
  <label class="chk"><input type="checkbox" id="ob-s" checked> <span>Avisarle al cliente ahora</span></label><p class="sm mut">Próximos libres: ${omniFree(4).map(t=>crmHm(t)).join(' · ')||'—'}</p>`,
  {okText:old?'Reprogramar':'Reservar',onOk:async w=>{const dd=val('ob-d'),hh=val('ob-h'),wt=val('ob-w').trim().replace(/[<>]/g,'').slice(0,60),du=Math.round(+val('ob-u'));
   if(!/^\d{4}-\d{2}-\d{2}$/.test(dd)||!/^\d{2}:\d{2}$/.test(hh))return w._err('Elegí día y hora.'),false;if(!wt)return w._err('Escribí el motivo.'),false;if(!(du>=10&&du<=240))return w._err('La duración va de 10 a 240 minutos.'),false;
   const at=new Date(dd+'T'+hh+':00').getTime();const er=omniCheck(at,du,old&&old.id);if(er)return w._err(er),false;
   let a;if(old){const prev=old.at;Object.assign(old,{at,what:wt,dur:du,st:'reservado',rem:0});a=old;crmAdd(c,'sys','Turno reprogramado: '+crmHm(prev)+' → '+crmHm(at),{kind:'turno'});}
   else{a={id:uid(),at,dur:du,what:wt,st:'reservado',by:crmMe()};c.appts=(c.appts||[]).concat(a);crmAdd(c,'sys','Turno reservado: '+crmHm(at)+' · '+wt,{kind:'turno'});}
   audit('CRM_TURNO',crmWho(c)+' · '+(old?'reprogramado ':'')+crmHm(at)+' · '+du+' min');save();
   if($('#ob-s',w).checked){try{await crmSend(c,`Hola ${crmFirst(c)}, ${old?'reprogramamos':'te reservamos'} tu turno para el ${crmHm(at)} (${wt}). ¿Nos confirmás?`,{kind:'turno'});}catch(e){toast(e.message,1);}}crmPaint();}});};
/* ---------- ficha 360° extendida ---------- */
const omniOnline=s=>!!(s.tn||s.tnOrder||s.order||s.web||s.envio||s.envioId);
function omni360HTML(c){const cu=c.cust?custById(c.cust):null;if(!cu)return'';const S0=S.sales.filter(s=>s.cust===cu.id&&s.status==='ok').sort((a,b)=>b.ts-a.ts);
 const on=S0.filter(omniOnline),pr=S0.length-on.length,tot=S0.reduce((a,s)=>a+(s.total||0),0),avg=S0.length?Math.round(tot/S0.length):0;
 const first=S0.length?S0[S0.length-1].ts:0,months=first?Math.max(1,(now()-first)/(30*864e5)):1,freq=S0.length/months;
 const fav={};S0.slice(0,60).forEach(s=>(s.items||[]).forEach(i=>{fav[i.name]=(fav[i.name]||0)+(+i.qty||0);}));const top=Object.entries(fav).sort((a,b)=>b[1]-a[1]).slice(0,3);
 const qv=quotes().filter(q=>q.cust===cu.id&&qtState(q)==='vigente');const ap=(c.appts||[]).filter(a=>a.st!=='cancelado'&&a.at>now());
 const bd=typeof isBirthWeek==='function'&&isBirthWeek(cu);
 return `<div class="crm-box om-360"><h4>📊 Ficha 360° · detalle</h4><div class="om-g">
  <div><b>${pr}</b><span>presenciales</span></div><div><b>${on.length}</b><span>online</span></div><div><b>${money(avg)}</b><span>ticket promedio</span></div><div><b>${S0.length?omniDays(S0[0].ts)+' d':'—'}</b><span>desde la última</span></div><div><b>${S0.length?freq.toFixed(1).replace('.',','):'—'}</b><span>compras / mes</span></div></div>
  ${top.length?`<p class="sm"><b>Favoritos:</b> ${top.map(([n,q])=>esc(n)+' ('+numAR(q,0)+')').join(' · ')}</p>`:''}
  ${bd?'<p class="sm">🎂 <b>Cumple esta semana</b>: buen momento para un saludo o un beneficio.</p>':''}
  ${c.pay&&c.pay.state==='pendiente'?`<p class="sm">💳 Cobro pendiente: <b>${money(c.pay.amount)}</b></p>`:''}
  ${ap.length?`<p class="sm">📅 Próximo turno: <b>${crmHm(ap[0].at)}</b> · ${esc(ap[0].what)}</p>`:''}
  <p class="sm mut">Contacto: ${esc(omniMask(cu.wa))}${cu.dni?' · DNI '+esc(omniMask(cu.dni)):''}${can('customers_admin')?'':' (enmascarado)'}</p>
  ${qv.length?`<p class="sm" style="margin:.35rem 0 .1rem"><b>Presupuestos vigentes</b></p>${qv.map(q=>`<div class="row om-qv"><span class="sp sm">${esc(q.n)} · ${money(q.total)} · vence ${dmy(dkey(q.exp))}</span>${can('sell')?`<button class="btn sm gold" data-act="qtLoad" data-id="${q.id}">Convertir en venta</button>`:''}<button class="btn sm" data-act="qtPrint" data-id="${q.id}">PDF</button></div>`).join('')}`:''}</div>`;}
/* ---------- copiloto ERP ---------- */
function omniReply(c,items){const nm=crmFirst(c);if(!items.length)return '';const L=items.map(x=>x.ok?`• ${x.qty} × ${x.p.name}${x.p.sub?' '+x.p.sub:''}: ${money(x.price)} c/u = ${money(x.sub)}`:`• ${x.p.name}: ${x.st>0?'nos quedan sólo '+numAR(x.st,0):'no nos queda en este momento'}${x.alt.length?' (tenemos '+x.alt.map(a=>a.name+' a '+money(a.price)).join(' o ')+')':''}`);
 const tot=items.filter(x=>x.ok).reduce((a,x)=>a+x.sub,0);return `Hola ${nm}! Te paso lo que consultaste:\n${L.join('\n')}${tot?'\nTotal: '+money(tot)+'.':''}\n¿Te lo preparamos?`;}
function omniCopilotHTML(c){const items=omniItems(c),it=(()=>{const ins=convMsgs(c.id).filter(m=>m.dir==='in');const l=ins[ins.length-1];return l?crmIntent(l.text):null;})();const cu=c.cust?custById(c.cust):null;const debt=cu?debtOf(cu.id):0;
 const free=it&&it.k==='turno'&&crmCfg().turnos?omniFree(3):[];
 return `<div class="crm-box om-cop"><h4>🧠 Copiloto ERP</h4>${items.length?`<div class="tw"><table class="sm"><thead><tr><th>Pidió</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Stock</th><th class="r">Subtotal</th></tr></thead><tbody>${items.map(x=>`<tr${x.ok?'':' class="om-no"'}><td>${esc(x.p.name)}${x.alt.length?`<br><small>alternativa: ${x.alt.map(a=>esc(a.name)+' ('+numAR(stockOf(a),0)+')').join(', ')}</small>`:''}</td><td class="r">${x.qty}</td><td class="r">${money(x.price)}</td><td class="r">${numAR(x.st,0)}</td><td class="r">${x.ok?money(x.sub):'sin stock'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="sm mut">No encontré productos en el último mensaje.</p>'}
  ${debt>0?`<p class="sm">⚠ Debe <b>${money(debt)}</b> en cuenta corriente.</p>`:''}${free.length?`<p class="sm">🕒 Libres: ${free.map(t=>crmHm(t)).join(' · ')}</p>`:''}
  <div class="row" style="gap:.3rem;margin-top:.3rem">${items.length?'<button class="btn sm" data-act="omniUse" data-k="items">Usar respuesta</button>':''}${free.length?'<button class="btn sm" data-act="omniUse" data-k="slots">Proponer horarios</button>':''}${can('sell')?'<button class="btn sm gold" data-act="omniQuote">Presupuesto desde el chat</button>':''}</div>
  <label for="om-q" class="sm" style="margin-top:.45rem;display:block">Consultar stock y precio</label><input id="om-q" placeholder="Producto o código" autocomplete="off"><div id="om-qr"></div></div>`;}
A.omniUse=el=>{const c=crmCur();if(!c)return;const tx=$('#crm-tx');if(!tx)return;let t='';if(el.dataset.k==='items')t=omniReply(c,omniItems(c));else if(el.dataset.k==='slots')t=`Hola ${crmFirst(c)}! Tenemos libre: ${omniFree(3).map(x=>crmHm(x)).join(', ')}. ¿Cuál te queda mejor?`;else if(el.dataset.k==='prod'){const p=prod(el.dataset.id);if(p)t=`${p.name}${p.sub?' '+p.sub:''}: ${money(p.price)}${stockOf(p)>0?' (lo tenemos disponible)':' (sin stock por ahora)'}.`;}
 if(!t)return;if(typeof crmMode!=='undefined'&&crmMode==='note')crmMode='msg';tx.value=(tx.value?tx.value+'\n':'')+t;tx.focus();};
/* ---------- presupuesto desde el chat ---------- */
let omniQL=[];
function omniQLines(){return omniQL.length?`<div class="tw"><table class="sm"><thead><tr><th>Artículo</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Importe</th><th></th></tr></thead><tbody>${omniQL.map((l,i)=>`<tr><td>${esc(l.name)}${stockOf(prod(l.pid)||{stock:0})<l.qty?' <small class="neg">(stock '+numAR(stockOf(prod(l.pid)),0)+')</small>':''}</td><td class="r"><input class="om-qq" data-i="${i}" type="number" min="1" max="9999" value="${l.qty}" aria-label="Cantidad de ${esc(l.name)}" style="width:5.5em"></td><td class="r">${money(l.price)}</td><td class="r">${money(Math.round(l.qty*l.price))}</td><td><button type="button" class="btn sm" data-act="omniQDel" data-i="${i}" aria-label="Quitar ${esc(l.name)}">✕</button></td></tr>`).join('')}<tr><td colspan="3"><b>Total</b></td><td class="r"><b>${money(omniQL.reduce((a,l)=>a+Math.round(l.qty*l.price),0))}</b></td><td></td></tr></tbody></table></div>`:'<p class="sm mut">Agregá productos con el buscador.</p>';}
const omniQLine=(p,q)=>({pid:p.id,name:p.name+(p.sub?' '+p.sub:''),rubro:p.rubro,qty:q,price:+p.price||0,unit:p.unit,list:+p.price||0,cost:+p.cost||0});
A.omniQuote=()=>{const c=crmCur();if(!c)return;if(!can('sell'))return toast('Sin permiso',1);omniQL=omniItems(c).map(x=>omniQLine(x.p,x.qty));
 const w=modal('Presupuesto desde el chat',`<p class="sm">Para: <b>${esc(crmWho(c))}</b>. No descuenta stock ni entra a la caja; se convierte en venta desde la ficha o desde Presupuestos.</p>
  <label for="oq-s">Agregar producto</label><input id="oq-s" placeholder="Nombre o código" autocomplete="off"><div id="oq-r"></div><div id="oq-l">${omniQLines()}</div>
  <div class="grid g2"><div><label for="oq-d">Validez (días)</label><input id="oq-d" type="number" min="1" max="90" value="7"></div><div><label for="oq-o">Observaciones</label><input id="oq-o" maxlength="200"></div></div>
  <label class="chk"><input type="checkbox" id="oq-send" checked> <span>Enviarlo por el chat</span></label><label class="chk"><input type="checkbox" id="oq-pdf" checked> <span>Abrir el PDF</span></label>`,
  {okText:'Guardar presupuesto',onOk:async w2=>{if(!omniQL.length)return w2._err('El presupuesto está vacío.'),false;const d=Math.round(+val('oq-d'));if(!(d>=1&&d<=90))return w2._err('La validez va de 1 a 90 días.'),false;
   const r=qtCreate({lines:omniQL,cust:c.cust||'',name:c.cust?'':crmWho(c),days:d,note:val('oq-o')});if(r.err)return w2._err(r.err),false;const q=r.q;q.conv=c.id;
   crmAdd(c,'sys','Presupuesto '+q.n+' · '+money(q.total),{kind:'presupuesto'});if(!c.dept)c.dept='Ventas';audit('CRM_PRESUPUESTO',q.n+' · '+crmWho(c)+' · desde el chat');save();
   if($('#oq-send',w2).checked){try{await crmSend(c,crmQuoteText(c,q),{kind:'presupuesto'});}catch(e){toast(e.message,1);}}
   if($('#oq-pdf',w2).checked&&typeof qtPrint==='function')setTimeout(()=>qtPrint(q),80);omniQL=[];crmPaint();toast('Presupuesto '+q.n+' guardado');}});
 const box=w&&w.querySelector?w:document;const s=$('#oq-s');if(s)s.addEventListener('input',()=>{const t=crmNorm(s.value).trim();const r=$('#oq-r');if(t.length<2){r.innerHTML='';return;}
  const L=S.products.filter(p=>p.active&&!p.archived&&crmNorm(p.name+' '+(p.sub||'')+' '+(p.code||'')+' '+(p.barcode||'')).includes(t)).slice(0,6);
  r.innerHTML=L.map(p=>`<button type="button" class="btn sm om-res" data-act="omniQAdd" data-id="${p.id}">${esc(p.name)}${p.sub?' '+esc(p.sub):''} · ${money(p.price)} · stock ${numAR(stockOf(p),0)}</button>`).join('')||'<p class="sm mut">Sin resultados.</p>';});
 omniQBind();};
function omniQBind(){document.querySelectorAll('.om-qq').forEach(i=>i.addEventListener('change',()=>{const l=omniQL[+i.dataset.i];const v=Math.round(+i.value);if(l&&v>=1&&v<=9999)l.qty=v;omniQRe();}));}
function omniQRe(){const b=$('#oq-l');if(b){b.innerHTML=omniQLines();omniQBind();}}
A.omniQAdd=el=>{const p=prod(el.dataset.id);if(!p)return;const l=omniQL.find(x=>x.pid===p.id);if(l)l.qty++;else omniQL.push(omniQLine(p,1));const s=$('#oq-s');if(s)s.value='';const r=$('#oq-r');if(r)r.innerHTML='';omniQRe();};
A.omniQDel=el=>{omniQL.splice(+el.dataset.i,1);omniQRe();};
/* ---------- analíticas extendidas ---------- */
function omniStats(days){const t0=now()-(days||30)*864e5,sla=omniSla();const L=convs().map(crmFix).filter(c=>c.ts>=t0&&crmVisible(c));
 const res=L.filter(c=>c.state==='cerrado').length;const fr=L.filter(c=>c.firstIn&&c.firstOut&&c.firstOut>=c.firstIn);const inS=fr.filter(c=>c.firstOut-c.firstIn<=sla*60000).length;
 const open=L.filter(c=>crmOpen(c)&&c.unread&&c.lastIn);const age={'< 1 h':0,'1 a 4 h':0,'4 a 24 h':0,'más de 24 h':0};open.forEach(c=>{const h=(now()-c.lastIn)/36e5;age[h<1?'< 1 h':h<4?'1 a 4 h':h<24?'4 a 24 h':'más de 24 h']++;});
 const byH={};for(let h=0;h<24;h++)byH[String(h).padStart(2,'0')+' h']=0;L.forEach(c=>{const h=new Date(c.firstIn||c.ts).getHours();byH[String(h).padStart(2,'0')+' h']++;});Object.keys(byH).forEach(k=>{if(!byH[k])delete byH[k];});
 const byD={};L.forEach(c=>{const d=c.dept||'Sin cola';byD[d]=(byD[d]||0)+1;});const pr={alta:0,media:0,normal:0,baja:0};L.forEach(c=>{pr[crmPrio(c).lv]++;});const mo={pos:0,neu:0,neg:0};L.forEach(c=>{mo[crmMood(c)]++;});
 return{n:L.length,res,rate:L.length?Math.round(res/L.length*100):null,sla,slaPct:fr.length?Math.round(inS/fr.length*100):null,slaN:fr.length,age,byH,byD,pr,mo,pend:open.length};}
function omniStatsHTML(){const s=omniStats(+crmF.days||30);return `<div class="card om-an" style="margin-top:.8rem"><h3 style="margin-top:0">Omni-Assist · resolución, SLA y prioridad</h3><div class="grid g4" style="margin-bottom:.6rem">
 <div class="card kpi"><b>${s.rate==null?'—':s.rate+' %'}</b><span>Tasa de resolución (${s.res}/${s.n} cerradas)</span></div><div class="card kpi"><b>${s.slaPct==null?'—':s.slaPct+' %'}</b><span>Primera respuesta en ≤ ${s.sla} min (${s.slaN})</span></div>
 <div class="card kpi"><b>${s.pend}</b><span>Esperando respuesta</span></div><div class="card kpi"><b style="color:${s.pr.alta?'var(--crm-a)':'inherit'}">${s.pr.alta}</b><span>Prioridad alta</span></div></div>
 <div class="grid g2"><div><h4>Pendientes por antigüedad</h4>${crmBarsHTML(s.age,k=>k)}</div><div><h4>Por hora del día</h4>${Object.keys(s.byH).length?crmBarsHTML(s.byH,k=>k):'<p class="sm mut">Sin datos.</p>'}</div><div><h4>Por departamento</h4>${crmBarsHTML(s.byD,k=>k)}</div><div><h4>Ánimo del cliente</h4>${crmBarsHTML({'Positivo':s.mo.pos,'Neutral':s.mo.neu,'Molesto':s.mo.neg},k=>k)}</div></div>
 <p class="sm mut">Resolución = conversaciones cerradas / iniciadas en el período. SLA = primera respuesta humana dentro de ${s.sla} min (se cambia en Ajustes de Omni-Assist). Una conversación sin responder que pasa el SLA sube sola a prioridad alta.</p></div>`;}
/* ---------- ajustes y activación ---------- */
function omniCfgHTML(){if(!isAdm())return'';const g=omniAg();const on=omniOn();
 return `<div class="card om-cfg" style="margin-top:.8rem"><h3 style="margin-top:0">Omni-Assist ${on?'<span class="tag ok">activo</span>':'<span class="tag">apagado</span>'}</h3>
 <p class="sm">Ficha 360° extendida, copiloto ERP con stock y precios reales, presupuesto desde el chat, agenda de 7 días con choques y analíticas de resolución y SLA. ${on?'':'Hoy el equipo sigue viendo la Atención al cliente de siempre.'}</p>
 <div class="grid g3"><div><label for="om-sla">Primera respuesta (SLA, minutos)</label><input id="om-sla" type="number" min="1" max="1440" value="${omniSla()}"></div><div><label for="om-ini">Agenda: abre</label><input id="om-ini" type="time" value="${g.ini}"></div><div><label for="om-fin">Agenda: cierra</label><input id="om-fin" type="time" value="${g.fin}"></div>
 <div><label for="om-dur">Duración de cada turno (min)</label><input id="om-dur" type="number" min="10" max="240" value="${g.dur}"></div><div><label for="om-cap">Turnos a la vez</label><input id="om-cap" type="number" min="1" max="20" value="${g.cap}"></div></div>
 <fieldset class="om-dias"><legend class="sm">Días de atención</legend>${['Do','Lu','Ma','Mi','Ju','Vi','Sá'].map((d,i)=>`<label class="chk"><input type="checkbox" class="om-dia" value="${i}" ${g.dias.includes(i)?'checked':''}> <span>${d}</span></label>`).join('')}</fieldset>
 <div class="row"><button class="btn" data-act="omniCfgSave">Guardar</button><button class="btn ${on?'':'gold'}" data-act="omniToggle">${on?'Apagar Omni-Assist':'Activar Omni-Assist'}</button></div></div>`;}
A.omniToggle=()=>{if(!isAdm())return toast('Sólo el administrador',1);const c=S.cfg.crm=S.cfg.crm||{};c.omni=!omniOn();audit('CRM_OMNI',c.omni?'activado':'apagado');save();crmPaint();toast(c.omni?'Omni-Assist activado':'Omni-Assist apagado');};
A.omniCfgSave=()=>{if(!isAdm())return toast('Sólo el administrador',1);const c=S.cfg.crm=S.cfg.crm||{};const sla=Math.round(+val('om-sla')),ini=val('om-ini'),fin=val('om-fin'),dur=Math.round(+val('om-dur')),cap=Math.round(+val('om-cap'));
 const dias=[...document.querySelectorAll('.om-dia')].filter(x=>x.checked).map(x=>+x.value);
 if(!(sla>=1&&sla<=1440))return toast('El SLA va de 1 a 1440 minutos',1);if(omniHM(ini)===null||omniHM(fin)===null||omniHM(fin)<=omniHM(ini))return toast('El horario de cierre tiene que ser posterior a la apertura',1);
 if(!(dur>=10&&dur<=240))return toast('La duración va de 10 a 240 minutos',1);if(!(cap>=1&&cap<=20))return toast('Turnos a la vez: de 1 a 20',1);if(!dias.length)return toast('Elegí al menos un día',1);
 c.slaMin=sla;c.agenda={ini,fin,dur,cap,dias};audit('CRM_OMNI','ajustes: SLA '+sla+' min · agenda '+ini+'–'+fin+' · '+dur+' min × '+cap);save();toast('Guardado');crmPaint();};
/* ---------- enganche con Atención al cliente (sin tocar p6j-crm.js) ---------- */
{const _ctx=crmCtxHTML,_cal=crmCalHTML,_stats=crmStatsHTML,_prio=crmPrio,_bind=crmBindCtx,_appt=A.crmAppt;
 crmCtxHTML=function(){let h=_ctx();const c=convById(crmSel);if(!c)return h;
  if(!omniOn())return isAdm()?h+`<div class="crm-box om-off"><h4>✨ Omni-Assist (nuevo)</h4><p class="sm">Ficha 360° extendida, copiloto ERP con stock y precios reales, presupuesto desde el chat y agenda de 7 días.</p><button class="btn sm gold" data-act="omniToggle">Activar</button></div>`:h;
  const add=omni360HTML(c)+omniCopilotHTML(c);const k=h.indexOf('<div class="crm-box"><h4>🤖');return k>=0?h.slice(0,k)+add+h.slice(k):h+add;};
 crmCalHTML=function(c){return omniOn()?omniAgendaHTML(c):_cal(c);};
 crmStatsHTML=function(){return _stats()+(omniOn()?omniStatsHTML():'')+omniCfgHTML();};
 crmPrio=function(c){const r=_prio(c);if(!omniOn()||!crmOpen(c)||!c.unread||!c.lastIn)return r;const w=Math.floor((now()-c.lastIn)/60000);if(w>=omniSla()&&!r.why.some(x=>/SLA/.test(x))){r.why.unshift('fuera de SLA ('+omniSla()+' min)');r.lv='alta';}return r;};
 crmBindCtx=function(){_bind();const q=$('#om-q');if(q)q.addEventListener('input',()=>{const t=crmNorm(q.value).trim();const r=$('#om-qr');if(!r)return;if(t.length<2){r.innerHTML='';return;}
  const L=S.products.filter(p=>p.active&&!p.archived&&crmNorm(p.name+' '+(p.sub||'')+' '+(p.code||'')+' '+(p.barcode||'')).includes(t)).slice(0,5);
  r.innerHTML=L.map(p=>`<div class="om-res row"><span class="sp sm">${esc(p.name)}${p.sub?' '+esc(p.sub):''} · <b>${money(p.price)}</b> · stock ${numAR(stockOf(p),0)}</span><button class="btn sm" data-act="omniUse" data-k="prod" data-id="${p.id}">Insertar</button></div>`).join('')||'<p class="sm mut">Sin resultados.</p>';});};
 A.crmAppt=el=>omniOn()?A.omniBook(el):_appt(el);}
