/* =====================================================================
   ASISTENTE CONVERSACIONAL (V26 · 4.13) — texto y voz opcional
   - ActionRegistry = lista blanca. El texto se interpreta con reglas locales
     (proveedor "local-rules"); un modelo externo (LLM) sigue "pendiente de
     configuración": el contrato LanguageModelProvider es intercambiable.
   - El asistente NUNCA ejecuta nada que el usuario no pueda hacer en pantalla:
     cada acción vuelve a comprobar can() y reutiliza el servicio de dominio.
   - Acciones críticas (cobrar, cerrar caja, borrar, permisos, ARCA, traspasos)
     se rechazan y se ofrece el camino asistido por pantalla.
   ===================================================================== */
const ASSIST_RISK={read:'Lectura',write_reversible:'Escritura reversible',write_impact:'Escritura con impacto',critical:'Crítica (no se ejecuta)'};
const ACTIONS=new Map();
function assistRegister(d){
 const need=['id','desc','risk','confirm','offline','idempotent','match','run'];
 for(const k of need)if(d[k]===undefined)throw new Error('ActionRegistry: falta '+k+' en '+(d.id||'?'));
 if(!ASSIST_RISK[d.risk])throw new Error('ActionRegistry: riesgo inválido '+d.id);
 if(ACTIONS.has(d.id))throw new Error('ActionRegistry: acción repetida '+d.id);
 ACTIONS.set(d.id,Object.assign({perm:null,ctx:'',schema:{},service:'',test:'v4.py'},d));
}
const asCfg=()=>{S.cfg.assistant=S.cfg.assistant||{on:true,voice:false,tts:false};return S.cfg.assistant;};
const asFold=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[¿?¡!.;:()"]/g,' ').replace(/\s+/g,' ').trim();
const AS_NUM={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,docena:12,quince:15,veinte:20,media:0.5,medio:0.5};
function asQty(tok){if(tok===undefined||tok===null||tok==='')return NaN;if(/^\d+([.,]\d+)?$/.test(tok))return parseFloat(tok.replace(',','.'));return AS_NUM[tok]!==undefined?AS_NUM[tok]:NaN;}
const AS={open:false,log:[],pending:null,last:null,lastSummary:'',done:new Set(),busy:false,origin:'text',listening:false};
function asSync(){try{if(typeof CLOUD!=='undefined'&&CLOUD.on&&typeof cl!=='undefined'&&cl&&!cl.online)return 'pendiente de sincronización';}catch(e){}return 'ejecutado';}

/* ---- búsqueda de productos (nunca inventa coincidencias) ---- */
function asFindProducts(q){
 const f=asFold(q).replace(/\b(el|la|los|las|de|del|un|una|unos|unas|al|a la|en|por|mas|para)\b/g,' ').replace(/\s+/g,' ').trim();
 if(!f)return[];const toks=f.split(' ').filter(Boolean);
 const list=S.products.filter(p=>!p.archived&&p.active!==false);
 const exact=list.filter(p=>asFold(p.name)===f||asFold(pfull(p))===f);
 if(exact.length===1)return exact;
 const hit=list.filter(p=>{const hay=asFold(pfull(p)+' '+(p.barcode||''));return toks.every(t=>hay.includes(t));});
 return hit.slice(0,8);
}
/* si hay varias, devuelve la pregunta; si no, el producto */
function asResolve(q,then){
 const r=asFindProducts(q);
 if(!r.length)return{state:'rechazado',msg:'No encontré ningún producto que se parezca a «'+q.trim()+'». Probá con otro nombre o con el código de barras.'};
 if(r.length>1){AS.pending={type:'choose',opts:r.map(p=>p.id),then,key:uid()};
  return{state:'pregunta',msg:'Encontré varias opciones para «'+q.trim()+'». ¿Cuál? Respondé con el número:\n'+r.map((p,i)=>(i+1)+') '+pfull(p)+' — '+money(p.price)).join('\n')};}
 return{prod:r[0]};
}

/* ---- acciones publicadas ---- */
assistRegister({id:'assistant.help',desc:'Ayuda: qué puedo hacer acá',risk:'read',confirm:'none',offline:true,idempotent:true,service:'registro de acciones',
 match:t=>/^(ayuda|ayudame|help|que puedo hacer( aca| aqui| en esta pantalla)?|que sabes hacer|comandos)$/.test(t)?{}:null,
 run:()=>{const l=assistAvailable();return{state:'ejecutado',msg:'Con tu rol puedo:\n'+l.map(a=>'• '+a.desc+(a.example?' — ej.: «'+a.example+'»':'')).join('\n')+'\nTambién: «cancelar», «repetir resumen» y «mostrar la interpretación».'};}});
assistRegister({id:'assistant.cancel',desc:'Cancelar lo que estaba pendiente',risk:'read',confirm:'none',offline:true,idempotent:true,
 match:t=>/^(cancelar|cancela|cancelalo|dejalo|olvidalo|no|no gracias)$/.test(t)?{}:null,
 run:()=>{if(AS.pending){AS.pending=null;return{state:'rechazado',msg:'Cancelado. No se guardó nada.'};}return{state:'ejecutado',msg:'No había nada pendiente.'};}});
assistRegister({id:'assistant.repeat',desc:'Repetir el último resumen',risk:'read',confirm:'none',offline:true,idempotent:true,
 match:t=>/^(repetir resumen|repeti(\s+el)?\s*resumen|repeti|repetilo|de nuevo)$/.test(t)?{}:null,
 run:()=>({state:'ejecutado',msg:AS.lastSummary||'Todavía no hay nada para repetir.'})});
assistRegister({id:'assistant.explain',desc:'Mostrar cómo interpreté tu frase',risk:'read',confirm:'none',offline:true,idempotent:true,
 match:t=>/^(mostrar (la )?interpretacion|como (lo |la )?interpretaste|que entendiste|interpretacion)$/.test(t)?{}:null,
 run:()=>{const L=AS.last;if(!L)return{state:'ejecutado',msg:'Todavía no interpreté ninguna frase.'};return{state:'ejecutado',msg:'Frase: «'+L.text+'»\nAcción: '+L.actionId+' ('+ASSIST_RISK[L.risk]+')\nCampos: '+(L.fields||'—')+'\nOrigen: '+L.origin+' · Intérprete: reglas locales'};}});

assistRegister({id:'inventory.stock.lookup',desc:'Consultar stock y precio de un producto',example:'cuánto stock hay de coca cola',perm:'sell',risk:'read',confirm:'confirm_if_ambiguous',offline:true,idempotent:true,service:'S.products (lectura)',
 match:t=>{let m=t.match(/^(?:cuanto|cuantos|cuantas)\s+(?:stock\s+)?(?:hay|queda|quedan|tenemos|tengo)\s+(?:de\s+|del\s+)?(.+)$/)||t.match(/^(?:stock|precio|cuanto sale|cuanto cuesta|cuanto cuestan)\s+(?:de\s+|del\s+)?(.+)$/)||t.match(/^hay\s+(.+)$/);return m?{q:m[1]}:null;},
 run:p=>{const r=asResolve(p.q,'stock');if(!r.prod)return r;return asStockMsg(r.prod);}});
function asStockMsg(pr){const neg=pr.stock<0;return{state:'ejecutado',msg:pfull(pr)+': stock '+stockTxt(pr)+(neg?' (negativo: hay que ajustar)':'')+' · precio '+money(pr.price)+(can('view_cost')?' · costo '+money(pr.cost):'')+'.'};}

assistRegister({id:'inventory.stock.low',desc:'Ver qué stock está bajo',example:'qué stock está bajo',perm:'sell',risk:'read',confirm:'none',offline:true,idempotent:true,
 match:t=>/^(?:que )?(?:stock bajo|poco stock|se esta(?:n)? acabando|por acabarse|que falta|que reponer|que hay que reponer|stock minimo)$/.test(t)||/^que (?:stock )?(?:esta|hay) bajo$/.test(t)?{}:null,
 run:()=>{const l=S.products.filter(p=>!p.archived&&p.active!==false&&!isKit(p)&&p.stock<=5).sort((a,b)=>a.stock-b.stock);if(!l.length)return{state:'ejecutado',msg:'No hay productos con stock bajo (5 o menos).'};
  return{state:'ejecutado',msg:l.length+' producto(s) con stock bajo:\n'+l.slice(0,10).map(p=>'• '+pfull(p)+': '+stockTxt(p)).join('\n')+(l.length>10?'\n… y '+(l.length-10)+' más (Inventario → «Stock bajo»).':'')};}});

assistRegister({id:'reports.sales.read',desc:'Ver las ventas de hoy o de ayer',example:'cuánto vendimos hoy',perm:'sell',risk:'read',confirm:'none',offline:true,idempotent:true,service:'S.sales (lectura)',
 match:t=>{if(/^(?:ventas|cuanto vendimos|cuanto se vendio|cuanto llevamos vendido|como venimos)(?:\s+de)?\s*(hoy|ayer)?$/.test(t)||/^(?:ventas de hoy|ventas de ayer|ventas de|cuanto vendimos hoy)$/.test(t)){return{day:/ayer/.test(t)?'ayer':'hoy'};}return null;},
 run:p=>{const day=p.day==='ayer'?dkey(now()-86400000):dkey(now());const v=S.sales.filter(s=>s.status==='ok'&&dkey(s.ts)===day);
  const tot=v.reduce((a,s)=>a+s.total,0);const by={};v.forEach(s=>{by[s.method]=(by[s.method]||0)+s.total;});
  return{state:'ejecutado',msg:'Ventas '+p.day+' ('+day+'): '+v.length+' operación(es) por '+money(tot)+(v.length?' · ticket promedio '+money(Math.round(tot/v.length)):'')+'.'+(v.length?'\n'+Object.entries(by).map(([m,t])=>'• '+(MET[m]||m)+': '+money(t)).join('\n'):'')+'\nSon ventas confirmadas; no incluye pendientes de cobro digital ni es ganancia.'};}});

assistRegister({id:'cash.session.status',desc:'Ver el estado de la caja de este equipo',example:'cómo está la caja',perm:'sell',risk:'read',confirm:'none',offline:true,idempotent:true,service:'arqueoCalc (lectura)',
 match:t=>/^(?:como esta la caja|estado de (?:la )?caja|la caja esta abierta|caja abierta|cuanto hay en (?:la )?caja|como viene la caja)$/.test(t)?{}:null,
 run:()=>{const s=openSess();if(!s)return{state:'ejecutado',msg:'La caja de este equipo está cerrada.'};
  let extra='';if(can('close_cash')){try{const c=arqueoCalc(s,arqInputs(s));extra=' Efectivo esperado: '+money(c.expectedCash)+' · ventas '+c.count+' por '+money(c.total)+'.';}catch(e){}}
  return{state:'ejecutado',msg:'Caja '+S.tenant.caja+' abierta desde '+fmtDT(s.openedAt)+' con fondo de '+money(s.opening)+'.'+extra};}});

assistRegister({id:'pos.sale.prepare',desc:'Agregar productos al ticket (sin cobrar)',example:'agregá 2 coca cola',perm:'sell',risk:'write_reversible',confirm:'confirm_if_ambiguous',offline:true,idempotent:true,service:'pos.lines (borrador)',ctx:'requiere caja abierta para cobrar',
 match:t=>{const m=t.match(/^(?:agrega(?:me)?|suma(?:le)?|carga(?:me)?|pone(?:le)?|vende(?:me)?|anota(?:me)?)\s+(?:(\d+(?:[.,]\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|docena|quince|veinte|media|medio)\s+)?(?:de\s+)?(.+)$/);
  if(!m)return null;return{qty:m[1],q:m[2]};},
 run:p=>{const q=p.qty===undefined||p.qty===null?1:asQty(p.qty);if(!(q>0))return{state:'rechazado',msg:'La cantidad tiene que ser mayor que cero.'};
  const r=asResolve(p.q,{kind:'prepare',qty:q});if(!r.prod)return r;return asAddLine(r.prod,q);}});
function asAddLine(pr,q){
 if(!can('sell'))return{state:'rechazado',msg:'Tu rol no puede vender.'};
 if(pr.archived||pr.active===false)return{state:'rechazado',msg:pfull(pr)+' no está disponible para la venta.'};
 const cur=qtyIn(pr.id);let warn='';
 if(!canOver(pr)&&cur+q>pr.stock)return{state:'rechazado',msg:'Sin stock suficiente de '+pfull(pr)+' (hay '+stockTxt(pr)+' y este producto exige stock).'};
 if(cur+q>pr.stock)warn=' Ojo: no alcanza el stock y se vende igual, queda en negativo.';
 const L=pos.lines.find(l=>l.pid===pr.id);if(L){L.qty=Math.round((L.qty+q)*1000)/1000;pos.sel=pos.lines.indexOf(L);}else{pos.lines.push({pid:pr.id,name:pfull(pr),rubro:pr.rubro,qty:q,price:pr.price,cost:pr.cost,unit:pr.unit,list:pr.price});pos.sel=pos.lines.length-1;}
 if(curScreen==='vender')posCart();
 return{state:'borrador',msg:'Agregué '+String(q).replace('.',',')+' × '+pfull(pr)+' al ticket ('+money(Math.round(q*pr.price))+'). Es un borrador: todavía no se cobró nada.'+warn+(openSess()?'':' No hay caja abierta: abrila para cobrar.')};
}
assistRegister({id:'pos.sale.remove_last',desc:'Sacar el último producto del ticket',example:'sacá el último producto',perm:'sell',risk:'write_reversible',confirm:'none',offline:true,idempotent:false,service:'pos.lines (borrador)',
 match:t=>/^(?:saca|quita|borra|elimina)(?:le|me)?\s+(?:el\s+)?ultimo(?:\s+(?:producto|articulo|item|renglon))?$/.test(t)?{}:null,
 run:()=>{if(!can('sell'))return{state:'rechazado',msg:'Tu rol no puede vender.'};if(!pos.lines.length)return{state:'rechazado',msg:'El ticket está vacío.'};const l=pos.lines.pop();pos.sel=pos.lines.length-1;if(curScreen==='vender')posCart();return{state:'borrador',msg:'Saqué «'+l.name+'» del ticket.'};}});
assistRegister({id:'pos.sale.show',desc:'Mostrar lo que hay en el ticket',example:'qué hay en el ticket',perm:'sell',risk:'read',confirm:'none',offline:true,idempotent:true,
 match:t=>/^(?:que hay en (?:el )?ticket|mostrame el ticket|que tengo cargado|que quedo pendiente|mostrame que quedo pendiente|ticket)$/.test(t)?{}:null,
 run:()=>{if(!pos.lines.length)return{state:'ejecutado',msg:'El ticket está vacío.'};const tot=posGross();return{state:'ejecutado',msg:'Ticket (borrador):\n'+pos.lines.map(l=>'• '+String(l.qty).replace('.',',')+' × '+l.name+' — '+money(Math.round(l.qty*l.price))).join('\n')+'\nSubtotal '+money(tot)+'. Para cobrar usá «Cobrar (F12)».'};}});

assistRegister({id:'inventory.stock.adjust',desc:'Ajustar stock con motivo (pide confirmación)',example:'ajustá el stock de coca cola en -2 por rotura',perm:'edit_products',risk:'write_impact',confirm:'confirm',offline:true,idempotent:true,service:'stockAdjust (mismo que la pantalla)',
 match:t=>{const m=t.match(/^ajusta(?:r|me)?\s+(?:el\s+)?stock\s+de\s+(.+?)\s+(?:en|por)\s+(-?\d+(?:[.,]\d+)?)(?:\s+(?:por|motivo|porque)\s+(.+))?$/);return m?{q:m[1],d:m[2],why:m[3]||''}:null;},
 run:p=>{if(!can('edit_products'))return{state:'rechazado',msg:'Tu rol no puede editar el inventario.'};const d=parseNum(p.d);if(isNaN(d)||d===0)return{state:'rechazado',msg:'La cantidad a ajustar tiene que ser distinta de cero.'};
  if(!p.why||p.why.trim().length<3){AS.pending={type:'slot',slot:'why',p,key:uid()};return{state:'pregunta',msg:'¿Cuál es el motivo del ajuste? (obligatorio, mínimo 3 letras)'};}
  const r=asResolve(p.q,{kind:'adjust',d,why:p.why});if(!r.prod)return r;return asAskAdjust(r.prod,d,p.why);}});
function asAskAdjust(pr,d,why){
 if(pr.stock+d<0&&!canOver(pr))return{state:'rechazado',msg:'El stock no puede quedar negativo (este producto exige stock o la venta sin stock está bloqueada).'};
 AS.pending={type:'confirm',actionId:'inventory.stock.adjust',summary:'Ajustar stock de «'+pfull(pr)+'»: '+stockTxt(pr)+' → '+String(Math.round((pr.stock+d)*1000)/1000).replace('.',',')+' ('+(d>0?'+':'')+String(d).replace('.',',')+'). Motivo: '+why+'.',key:uid(),
  exec:()=>{if(!can('edit_products'))return{state:'rechazado',msg:'Tu rol no puede editar el inventario.'};const q=prod(pr.id);if(!q)return{state:'fallido',msg:'El producto ya no existe.'};
   if(q.stock+d<0&&!canOver(q))return{state:'rechazado',msg:'El stock cambió y ahora quedaría negativo.'};stockAdjust(q,d,why,'asistente');return{state:asSync(),msg:'Stock de '+pfull(q)+' ajustado: ahora '+stockTxt(q)+'.'+(asSync()!=='ejecutado'?' Queda pendiente de sincronización hasta que vuelva internet.':'')};}};
 return{state:'confirmar',msg:AS.pending.summary+'\n¿Confirmás? Respondé «sí» o «cancelar».'};
}

/* acciones críticas: se reconocen sólo para NO ejecutarlas y guiar por pantalla */
const AS_CRIT=[
 [/^(?:cobra(?:r|le|me)?|cobralo|pagar|registra(?:r)? (?:el )?pago)\b/,'Cobrar','vender','El cobro conserva sus salvaguardas: se confirma en pantalla (F12).'],
 [/^(?:cerra(?:r)?|cierre|cerrame)\b.*caja|^cerra(?:r)? la caja/,'Cerrar la caja','caja','El cierre es crítico e irreversible: se hace en Caja con arqueo.'],
 [/\b(?:borra(?:r)?|elimina(?:r)?|archiva(?:r)?)\b.*\b(?:articulo|producto|inventario|item)/,'Borrar o archivar artículos','inventario','El borrado protegido pide vista previa, «ELIMINAR» y motivo; sólo el Administrador, en Inventario.'],
 [/\b(?:permiso|permisos|rol|roles|usuario|usuarios|contrasena|clave|pin)\b.*\b(?:cambia|cambiar|da|dar|saca|sacar|agrega|agregar)|\b(?:cambia|cambiar|da|dar)\w*\s+(?:los\s+)?permisos/,'Cambiar permisos','usuarios','Los permisos se cambian en Usuarios y permisos, nunca por frase.'],
 [/\b(?:transferi|transferir|traspasa|traspasar|enviar plata|mandar plata)\b/,'Transferir dinero','cajasx','Los traspasos entre cajas se confirman en pantalla.'],
 [/\b(?:anula|anular|devolve|devolver|reintegra|reintegrar|nota de credito)\b/,'Anular o devolver','ventas','Anulaciones y devoluciones se hacen en pantalla con motivo.'],
 [/\b(?:factura|facturar|arca|afip|cae)\b/,'Facturación fiscal','periferic','La facturación fiscal no se opera por frase.'],
 [/\b(?:importa|importar|exporta|exportar)\b/,'Importar / exportar','impex','Importar y exportar se hace con su asistente en pantalla.']
];
assistRegister({id:'assistant.critical_guard',desc:'Reconoce acciones críticas para no ejecutarlas y guiarte',risk:'critical',confirm:'blocked',offline:true,idempotent:true,
 match:t=>{for(const c of AS_CRIT){if(c[0].test(t))return{name:c[1],screen:c[2],why:c[3]};}return null;},
 run:p=>{const ok=SCREENS[p.screen]&&(!SCREENS[p.screen].perm||can(SCREENS[p.screen].perm))&&(!SCREENS[p.screen].show||SCREENS[p.screen].show());
  return{state:'rechazado',msg:'«'+p.name+'» no se ejecuta por texto ni por voz. '+p.why+(ok?' Te dejo el acceso directo abajo.':''),go:ok?p.screen:null};}});

assistRegister({id:'nav.go',desc:'Llevarte a una pantalla',example:'llevame a inventario',risk:'read',confirm:'none',offline:true,idempotent:true,service:'router (go)',
 match:t=>{const m=t.match(/^(?:llevame a|llevame al|ir a|ir al|anda a|anda al|abri|abrime|mostrame|abrir)\s+(?:la |el |los |las )?(.+)$/);return m?{q:m[1]}:null;},
 run:p=>{const q=asFold(p.q);const cands=Object.entries(SCREENS).filter(([k,s])=>(!s.perm||can(s.perm))&&(!s.show||s.show())&&(asFold(s.t).includes(q)||asFold(k)===q));
  if(!cands.length){const hid=Object.entries(SCREENS).some(([k,s])=>asFold(s.t).includes(q)||asFold(k)===q);
   return{state:'rechazado',msg:hid?'Esa pantalla existe pero tu rol no tiene permiso para entrar.':'No encontré una pantalla que se llame «'+p.q+'».'};}
  if(cands.length>1){AS.pending={type:'choose',opts:cands.map(c=>c[0]),then:'nav',key:uid()};return{state:'pregunta',msg:'¿A cuál? Respondé con el número:\n'+cands.map((c,i)=>(i+1)+') '+c[1].t).join('\n')};}
  go(cands[0][0]);return{state:'ejecutado',msg:'Listo, te llevé a «'+cands[0][1].t+'».'};}});


/* lo disponible para ESTE usuario, generado desde el registro */
function asReset(){AS.log=[];AS.pending=null;AS.last=null;AS.lastSummary='';AS.open=false;AS.listening=false;try{asRec&&asRec.stop();}catch(e){}try{window.speechSynthesis&&window.speechSynthesis.cancel();}catch(e){}}
function assistAvailable(){return [...ACTIONS.values()].filter(a=>a.id.startsWith('assistant.')===false&&a.risk!=='critical'&&(!a.perm||can(a.perm)));}

/* ---- motor ---- */
function assistInterpret(raw){
 const t=asFold(raw);if(!t)return null;
 if(AS.pending){const pd=AS.pending;
  if(pd.type==='confirm'){if(/^(si|sii|dale|ok|okey|confirmo|confirmar|confirma|hacelo|adelante|de una)$/.test(t))return{act:{id:'__confirm'},params:{},text:raw};if(/^(no|cancelar|cancela|dejalo|nono|no gracias)$/.test(t))return{act:ACTIONS.get('assistant.cancel'),params:{},text:raw};}
  if(pd.type==='choose'){const n=/^\d+$/.test(t)?+t:(AS_NUM[t]||0);if(n>=1&&n<=pd.opts.length)return{act:{id:'__choose'},params:{n},text:raw};
   if(/^(cancelar|cancela|no|dejalo)$/.test(t))return{act:ACTIONS.get('assistant.cancel'),params:{},text:raw};
   const nar=pd.opts.filter(id=>{const p=prod(id);const hay=asFold(p?pfull(p):(SCREENS[id]||{}).t||'');return t.split(' ').every(w=>hay.includes(w));});
   if(nar.length===1)return{act:{id:'__choose'},params:{n:pd.opts.indexOf(nar[0])+1},text:raw};}
  if(pd.type==='slot'&&!/^(cancelar|cancela|no|dejalo)$/.test(t))return{act:{id:'__slot'},params:{v:raw.trim()},text:raw};
 }
 for(const a of ACTIONS.values()){const m=a.match(t);if(m)return{act:a,params:m,text:raw};}
 return{act:null,params:{},text:raw};
}
function assistExec(a,params,origin,text){
 const base={text,origin,actionId:a.id,risk:a.risk,fields:Object.entries(params||{}).filter(([k])=>k!=='why').map(([k,v])=>k+'='+v).join(', ')||'—'};
 AS.last=base;
 if(a.perm&&!can(a.perm)){auditA(a,'rechazado: sin permiso');return{state:'rechazado',msg:'Tu rol no tiene permiso para esto ('+(PERMS[a.perm]||a.perm)+').'};}
 const r=a.run(params);
 if(r&&r.state!=='pregunta'&&r.state!=='confirmar')auditA(a,r.state);
 return r;
}
function auditA(a,res){if(a.risk==='read'&&res==='ejecutado'&&!a.id.startsWith('inventory')&&!a.id.startsWith('reports')&&!a.id.startsWith('cash'))return;
 audit('ASISTENTE',a.id+' · '+(AS.last?AS.last.origin:'text')+' · '+res+' · '+(AS.last?AS.last.fields:''));}
function assistHandle(raw,origin){
 AS.origin=origin||'text';
 const it=assistInterpret(raw);if(!it)return null;
 if(it.act&&it.act.id==='__confirm'){const pd=AS.pending;AS.pending=null;
  if(AS.done.has(pd.key))return{state:'rechazado',msg:'Esa operación ya se había procesado; no se repite.'};AS.done.add(pd.key);
  AS.last={text:raw,origin:AS.origin,actionId:pd.actionId,risk:'write_impact',fields:pd.summary};
  const r=pd.exec();audit('ASISTENTE',pd.actionId+' · '+AS.origin+' · '+r.state+' · '+pd.summary);return r;}
 if(it.act&&it.act.id==='__choose'){const pd=AS.pending;AS.pending=null;const id=pd.opts[it.params.n-1];
  if(pd.then==='nav'){go(id);return{state:'ejecutado',msg:'Listo, te llevé a «'+SCREENS[id].t+'».'};}
  const pr=prod(id);if(!pr)return{state:'fallido',msg:'Ese producto ya no existe.'};
  const th=pd.then;AS.last={text:raw,origin:AS.origin,actionId:th.kind==='prepare'?'pos.sale.prepare':th.kind==='adjust'?'inventory.stock.adjust':'inventory.stock.lookup',risk:th.kind==='adjust'?'write_impact':th.kind==='prepare'?'write_reversible':'read',fields:'producto='+pfull(pr)};
  if(th==='stock')return asStockMsg(pr);
  if(th.kind==='prepare'){const r=asAddLine(pr,th.qty);auditA({id:'pos.sale.prepare',risk:'write_reversible'},r.state);return r;}
  if(th.kind==='adjust'){if(!can('edit_products'))return{state:'rechazado',msg:'Tu rol no puede editar el inventario.'};return asAskAdjust(pr,th.d,th.why);}}
 if(it.act&&it.act.id==='__slot'){const pd=AS.pending;if(pd.slot==='why'){const why=it.params.v;if(why.length<3){return{state:'pregunta',msg:'El motivo necesita al menos 3 letras. ¿Cuál es?'};}AS.pending=null;
   const r=asResolve(pd.p.q,{kind:'adjust',d:parseNum(pd.p.d),why});if(!r.prod)return r;return asAskAdjust(r.prod,parseNum(pd.p.d),why);}}
 if(!it.act){return{state:'rechazado',msg:'No entendí eso. Probá con «ayuda» para ver qué puedo hacer con tu rol. No ejecuté nada.'};}
 if(AS.pending&&it.act.id!=='assistant.cancel'&&it.act.id!=='assistant.explain'&&it.act.id!=='assistant.repeat'&&it.act.id!=='assistant.help'){AS.pending=null;}
 return assistExec(it.act,it.params,AS.origin,raw);
}

/* ---- interfaz ---- */
const assistOn=()=>asCfg().on!==false;
function asBtn(){return assistOn()?`<button class="btn sm" id="as-open" data-act="asToggle" aria-haspopup="dialog" aria-expanded="${AS.open}">Asistente</button>`:'';}
function asDock(){let d=$('#as-dock');if(!d){d=document.createElement('section');d.id='as-dock';d.setAttribute('role','dialog');d.setAttribute('aria-label','Asistente');d.hidden=true;document.body.appendChild(d);
  d.addEventListener('keydown',e=>{if(e.key==='Escape'){AS.open=false;asPaint();const b=$('#as-open');b&&b.focus();}});}return d;}
function asSpeechOK(){return !!(window.SpeechRecognition||window.webkitSpeechRecognition);}
function asPaint(){if(!user&&(AS.log.length||AS.pending||AS.open))asReset();const d=asDock();const show=AS.open&&user&&!$('#panel').hidden&&assistOn();d.hidden=!show;const ob=$('#as-open');if(ob)ob.setAttribute('aria-expanded',String(!!show));if(!show){return;}
 const cfg=asCfg();const voice=cfg.voice&&asSpeechOK();
 d.innerHTML=`<div class="as-h"><b>Asistente</b><span class="tag sm" id="as-st" role="status">${AS.listening?'🎙 Escuchando…':AS.busy?'Procesando…':'Listo'}</span><button class="btn sm" data-act="asClose" aria-label="Cerrar asistente">✕</button></div>
 <div class="as-log" id="as-log" aria-live="polite" tabindex="0">${AS.log.length?AS.log.map(m=>`<div class="as-m ${m.who}"><span class="as-w">${m.who==='u'?'Vos':'Asistente'}${m.state?` · <span class="tag ${m.state==='ejecutado'?'ok':m.state==='rechazado'||m.state==='fallido'?'bad':'warn'}">${esc(m.state)}</span>`:''}</span><div>${esc(m.t).replace(/\n/g,'<br>')}</div>${m.go?`<button class="btn sm gold" data-act="asGo" data-id="${esc(m.go)}">Ir a «${esc((SCREENS[m.go]||{}).t||m.go)}»</button>`:''}</div>`).join(''):'<p class="sm mut">Escribí o hablá en castellano simple. Probá «ayuda».</p>'}</div>
 ${AS.pending&&AS.pending.type==='confirm'?`<div class="row" style="margin:.4rem 0"><button class="btn gold sp" data-act="asYes">Confirmar</button><button class="btn sp" data-act="asNo">Cancelar</button></div>`:''}
 <div class="row as-in"><input id="as-i" aria-label="Escribí tu pedido" placeholder="Ej.: cuánto stock hay de coca" autocomplete="off" maxlength="200"><button class="btn gold" data-act="asSend">Enviar</button>${voice?`<button class="btn ${AS.listening?'red':''}" data-act="asMic" aria-pressed="${AS.listening}" aria-label="${AS.listening?'Detener micrófono':'Hablar'}">🎙</button>`:''}</div>
 <p class="sm mut" style="margin:.3rem 0 0">${voice?'Micrófono sólo mientras está encendido. No se guarda audio.':cfg.voice?'Tu navegador no ofrece reconocimiento de voz: usá texto.':'Voz apagada (un administrador puede habilitarla en Configuración). Intérprete: reglas locales.'}</p>`;
 const l=$('#as-log');if(l)l.scrollTop=l.scrollHeight;}
function asPush(who,t,state,go){AS.log.push({who,t,state,go});if(AS.log.length>60)AS.log.shift();}
function asSay(t){try{if(asCfg().tts&&window.speechSynthesis){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t.replace(/\n/g,'. '));u.lang='es-AR';window.speechSynthesis.speak(u);}}catch(e){}}
function asRun(raw,origin){raw=String(raw||'').slice(0,200);if(!raw.trim())return;asPush('u',raw);AS.busy=true;let r;
 try{r=assistHandle(raw,origin);}catch(e){r={state:'fallido',msg:'Hubo un error interno del asistente; no se guardó nada.'};}
 AS.busy=false;if(r){asPush('a',r.msg,r.state,r.go);if(r.state==='ejecutado'||r.state==='borrador'||r.state==='pendiente de sincronización')AS.lastSummary=r.msg;asSay(r.msg);}
 asPaint();const i=$('#as-i');i&&i.focus();}
A.asToggle=()=>{AS.open=!AS.open;asPaint();if(AS.open){const i=$('#as-i');i&&i.focus();}};
A.asClose=()=>{AS.open=false;asPaint();const b=$('#as-open');b&&b.focus();};
A.asSend=()=>{const i=$('#as-i');if(!i)return;const v=i.value;i.value='';asRun(v,'text');};
A.asYes=()=>asRun('sí','text');A.asNo=()=>asRun('cancelar','text');
A.asGo=el=>{AS.open=false;go(el.dataset.id);};
let asRec=null;
A.asMic=()=>{if(AS.listening){try{asRec&&asRec.stop();}catch(e){}return;}
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR||!asCfg().voice)return;
 try{asRec=new SR();asRec.lang='es-AR';asRec.interimResults=false;asRec.continuous=false;asRec.maxAlternatives=1;
  asRec.onresult=ev=>{const t=ev.results[0]&&ev.results[0][0]?ev.results[0][0].transcript:'';AS.listening=false;if(t)asRun(t,'voice');else asPaint();};
  asRec.onerror=ev=>{AS.listening=false;asPush('a','No pude escuchar ('+(ev.error||'error')+'). Podés escribir.','fallido');asPaint();};
  asRec.onend=()=>{if(AS.listening){AS.listening=false;asPaint();}};
  AS.listening=true;asPaint();asRec.start();}catch(e){AS.listening=false;asPush('a','El micrófono no está disponible. Usá texto.','fallido');asPaint();}};
document.addEventListener('keydown',e=>{if(e.target&&e.target.id==='as-i'&&e.key==='Enter'){e.preventDefault();A.asSend();}});
window.addEventListener('hashchange',()=>{setTimeout(asPaint,0);});

/* ---- administración del asistente (Configuración) ---- */
const AS_EXCL=[['Cobrar (F12), notas de crédito, anulaciones','Crítica: conserva salvaguardas en pantalla'],['Cierre de caja y traspasos','Crítica: arqueo y confirmación en pantalla'],['Borrar/archivar artículos','Crítica: vista previa + ELIMINAR + motivo'],['Permisos y usuarios','Crítica: sólo en Usuarios y permisos'],['Facturación fiscal (ARCA)','Excluida: certificado y CAE por su flujo'],['Importar / exportar','Asistida: su asistente en pantalla'],['Comandas de mesa (gastronomía)','No aplica: este comercio no usa mesas'],['Turnos y agenda (servicios)','No aplica: este comercio no usa agenda']];
function assistCfgCard(){if(!can('config'))return'';const c=asCfg();
 return `<div class="card" style="margin-top:1rem"><div class="row"><h3 class="sp">Asistente (texto y voz)</h3><span class="tag ok">Texto: funciona</span><span class="tag warn">Modelo de lenguaje externo: pendiente de configuración</span></div>
 <p class="sm mut">Interpreta frases con reglas locales y sólo puede elegir acciones de la lista blanca de abajo. Siempre comprueba tu permiso y reutiliza las mismas reglas que la pantalla. No guarda audio ni el texto completo de lo que dictás en la auditoría.</p>
 <label class="chk"><input type="checkbox" id="as-on" ${c.on!==false?'checked':''}> Asistente habilitado (botón «Asistente» en la barra superior)</label>
 <label class="chk"><input type="checkbox" id="as-voice" ${c.voice?'checked':''} ${asSpeechOK()?'':'disabled'}> Entrada por voz (apagada por defecto) ${asSpeechOK()?'':'— este navegador no la ofrece'}</label>
 <p class="sm mut" style="margin:.1rem 0 .5rem 1.6rem">Aviso: en Chrome/Edge el reconocimiento de voz del navegador envía el audio al servicio de voz del fabricante. Activala sólo con consentimiento de quienes la usen. El micrófono se enciende únicamente al tocar 🎙 y se muestra «Escuchando…».</p>
 <label class="chk"><input type="checkbox" id="as-tts" ${c.tts?'checked':''}> Leer las respuestas en voz alta (síntesis del navegador)</label>
 <h4 style="margin:.9rem 0 .3rem">Matriz de cobertura (función → acción → prueba)</h4>
 <div class="tw"><table><thead><tr><th>Acción</th><th>Qué hace</th><th>Riesgo</th><th>Permiso</th><th>Sin conexión</th><th>Confirmación</th></tr></thead><tbody>${[...ACTIONS.values()].map(a=>`<tr><td><code>${esc(a.id)}</code></td><td>${esc(a.desc)}</td><td>${esc(ASSIST_RISK[a.risk])}</td><td>${esc(a.perm?(PERMS[a.perm]||a.perm):'—')}</td><td>${a.offline?'Sí':'No'}</td><td>${esc({none:'No',confirm_if_ambiguous:'Si hay ambigüedad',confirm:'Siempre',blocked:'No se ejecuta'}[a.confirm]||a.confirm)}</td></tr>`).join('')}</tbody></table></div>
 <h4 style="margin:.9rem 0 .3rem">Excluido o asistido por pantalla</h4><ul class="sm">${AS_EXCL.map(x=>`<li><b>${esc(x[0])}</b> — ${esc(x[1])}</li>`).join('')}</ul>
 <p class="sm mut">No se afirma «todo por voz»: la cobertura es la de esta tabla. Proveedores de voz/modelo en la nube (STT, LLM, TTS): <span class="tag warn">Pendiente de configuración</span> — el contrato es intercambiable y las credenciales irían siempre en el servidor.</p></div>`;}
document.addEventListener('change',e=>{const t=e.target;if(!t||!['as-on','as-voice','as-tts'].includes(t.id))return;if(!can('config')){toast('No tenés permiso',1);rerender();return;}
 const c=asCfg();if(t.id==='as-on')c.on=t.checked;if(t.id==='as-voice')c.voice=t.checked&&asSpeechOK();if(t.id==='as-tts')c.tts=t.checked;
 audit('ASISTENTE_CONFIG',t.id+'='+(t.checked?'si':'no'));save();rerender();});
