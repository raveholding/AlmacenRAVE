/* ===== V26.76 · Gestión integral — Etapa B (Kini primero) =====
   Panel de Módulos de Vincular Business · Ticket en espera · Precios (historial, etiquetas de góndola pendientes,
   actualización masiva con deshacer, lista del proveedor) · Verificador de precios en góndola · Vales y adelantos del personal.
   AISLAMIENTO: este archivo sólo entra en los perfiles demo y kini (build.py). Almacén RAVE (perfil cliente) NO lo lleva
   hasta que el dueño apruebe Kini; cuando pase, todo nace apagado y lo activa el administrador desde «Módulos».
   No modifica otros archivos: se engancha envolviendo save(), posCart(), showPanel() y route().
   Dinero en centavos enteros; cada operación queda en Auditoría; nada edita un comprobante emitido. */

/* ---------- Panel de Módulos ---------- */
const GI_MODS=[
 {k:'pos_hold',t:'Ticket en espera',d:'Pausar la venta en curso, atender a otro cliente y retomarla después (Alt + E / Alt + R). No toca stock ni caja hasta cobrar.',plan:'esencial',scr:'vender'},
 {k:'price_hist',t:'Historial de precios y etiquetas de góndola',d:'Cada cambio de precio o costo queda registrado (antes/después, quién, cuándo, desde dónde) y arma sola la lista de etiquetas para reimprimir.',plan:'esencial',scr:'precios'},
 {k:'price_bulk',t:'Actualización masiva y lista del proveedor',d:'Subir o bajar precios por rubro, proveedor o búsqueda (% o $, redondeo, vista previa con margen) y deshacer. Pegar la lista del proveedor y actualizar costos.',plan:'esencial',dep:['price_hist'],scr:'precios'},
 {k:'kiosk',t:'Verificador de precios en góndola',d:'Una tablet o PC con lector queda como consulta de precios para los clientes: sin datos de costo y sin sesión de empleado.',plan:'esencial',scr:'precios'},
 {k:'hr_vales',t:'Vales y adelantos del personal',d:'Adelantos de sueldo, consumos y préstamos en cuotas, confirmados por el empleado y descontados en la liquidación.',plan:'mayorista',scr:'vales'}];
/* módulos que ya existían: se muestran con su estado y se activan en su propia pantalla (no se tocan desde acá) */
const GI_EXIST=[
 {t:'Venta mayorista por presentaciones, listas y acuerdos',plan:'mayorista',on:()=>!!(S.cfg.wholesale&&S.cfg.wholesale.on),scr:'config'},
 {t:'Reparto, despacho y rendición',plan:'mayorista',on:()=>typeof repCfg==='function'&&!!repCfg().on,scr:'reparto'},
 {t:'Recursos Humanos',plan:'mayorista',on:()=>typeof hrOn==='function'&&hrOn(),scr:'rrhh'},
 {t:'Finanzas',plan:'total',on:()=>typeof finOn==='function'&&finOn(),scr:'finanzas'},
 {t:'Contabilidad de gestión',plan:'total',on:()=>typeof acOn==='function'&&acOn(),scr:'contable'},
 {t:'Atención al cliente (CRM omnicanal)',plan:'total',on:()=>typeof crmCfg==='function'&&!!crmCfg().on,scr:'crm'},
 {t:'Notificaciones push',plan:'total',on:()=>typeof pushOn==='function'&&pushOn(),scr:'push'}];
/* lo que sigue en la hoja de ruta (prompt V26.76, etapas C y D): se muestra para la venta, rotulado «en construcción» */
const GI_NEXT=[['Circuito pedido → armado → remito → factura → recibo','mayorista'],['Preventa (app del preventista)','mayorista'],['GPS del equipo en tiempo real','mayorista'],['Stock por sucursal y depósito','mayorista'],['Toma de inventario con el celular','mayorista'],['Acopio','mayorista'],['Precios por escala de volumen','mayorista'],['Bot de pedidos por WhatsApp','total'],['Portal B2B del cliente mayorista','total']];
const GI_PLANS={esencial:{t:'VB Esencial',d:'Comercio chico: vender, caja, ARCA, stock, precios y etiquetas, Club.'},mayorista:{t:'VB Mayorista',d:'Esencial + mayorista, reparto, personal y vales; preventa y depósitos al terminar la etapa C.'},total:{t:'VB Total',d:'Todo: además CRM omnicanal, finanzas, contabilidad y bots.'}};
const GI_PORD=['esencial','mayorista','total'];
function giCfg(){const c=S.cfg.mods||(S.cfg.mods={});return c;}
const giPlan=()=>GI_PORD.includes(S.cfg.plan)?S.cfg.plan:'total';
const giInPlan=pl=>GI_PORD.indexOf(pl||'esencial')<=GI_PORD.indexOf(giPlan());
const giMod=k=>GI_MODS.find(m=>m.k===k);
const giOn=k=>{const m=giMod(k);return !!(m&&giCfg()[k]&&giInPlan(m.plan));};
const giAdm=()=>!!user&&user.role==='admin';
function giSetMod(k,on){const m=giMod(k);if(!m)return'Módulo inexistente.';if(!giAdm())return'Sólo el administrador activa o desactiva módulos.';
 if(on&&!giInPlan(m.plan))return'«'+m.t+'» no está incluido en el plan '+GI_PLANS[giPlan()].t+'.';
 const c=giCfg();const ch=[];
 if(on){(m.dep||[]).forEach(d=>{if(!c[d]){c[d]=1;ch.push(d);}});c[k]=1;}
 else{c[k]=0;GI_MODS.filter(x=>(x.dep||[]).includes(k)&&c[x.k]).forEach(x=>{c[x.k]=0;ch.push(x.k);});}
 audit('MODULO_'+(on?'ACTIVADO':'DESACTIVADO'),m.t+(ch.length?' · también '+ch.map(x=>giMod(x).t).join(', '):''));save();return'';}
A.giMod=el=>{const k=el.dataset.k,on=el.dataset.on==='1';const m=giMod(k);if(!m)return;
 const deps=on?(m.dep||[]).filter(d=>!giCfg()[d]):GI_MODS.filter(x=>(x.dep||[]).includes(k)&&giCfg()[x.k]).map(x=>x.k);
 const doIt=()=>{const e=giSetMod(k,on);if(e)return toast(e,1);toast(m.t+(on?' activado':' desactivado'));rerender();};
 if(deps.length)confirmBox(on?'Activar con sus dependencias':'Desactivar también lo que depende',`${on?'Para usar':'Al apagar'} <b>${esc(m.t)}</b> ${on?'se activa también':'se apaga también'}: <b>${deps.map(d=>esc(giMod(d).t)).join(', ')}</b>.${on?'':' Los datos no se borran: quedan guardados.'}`,doIt,on?'Activar':'Desactivar');
 else if(!on)confirmBox('Desactivar módulo',`Se oculta <b>${esc(m.t)}</b>. Los datos no se borran y vuelven al activarlo.`,doIt,'Desactivar');else doIt();};
A.giPlan=el=>{if(!giAdm()||IS_CLIENT)return;const p=el.value||el.dataset.p;if(!GI_PORD.includes(p))return;S.cfg.plan=p;audit('PLAN_VISTA_PREVIA',GI_PLANS[p].t);save();rerender();};
const giBadge=(on,lock)=>lock?'<span class="tag">🔒 Otro plan</span>':on?'<span class="tag ok">Activo</span>':'<span class="tag">Apagado</span>';
reg('modulos','Módulos','gear','config',()=>{const pl=giPlan();
 return`<div class="row"><h1 class="sp">Módulos del sistema</h1></div>
 <p class="mut">Cada comercio usa sólo lo que necesita. Activar no borra nada y desactivar tampoco: los datos quedan guardados. Cada cambio queda en Auditoría.</p>
 <div class="card"><h3 style="margin-top:0">Plan: ${esc(GI_PLANS[pl].t)}</h3><p class="sm mut">${esc(GI_PLANS[pl].d)}</p>
 ${IS_CLIENT?'<p class="sm mut">El plan lo fija Vincular Business según el contrato.</p>':`<label for="gi-plan">Vista previa de planes (demo: en producción lo fija Vincular Business)</label><select id="gi-plan" data-chg="giPlan">${GI_PORD.map(p=>`<option value="${p}" ${p===pl?'selected':''}>${esc(GI_PLANS[p].t)}</option>`).join('')}</select>`}</div>
 <h2>Módulos nuevos (V26.76)</h2><div class="grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:.8rem">
 ${GI_MODS.map(m=>{const lock=!giInPlan(m.plan),on=giOn(m.k);return`<div class="card" data-mod="${m.k}"><div class="row"><b class="sp">${esc(m.t)}</b>${giBadge(on,lock)}</div><p class="sm">${esc(m.d)}</p>${m.dep?`<p class="sm mut">Necesita: ${m.dep.map(d=>esc(giMod(d).t)).join(', ')}</p>`:''}<p class="sm mut">Incluido desde ${esc(GI_PLANS[m.plan].t)}</p>
  ${lock?'':`<button class="btn sm ${on?'':'gold'}" data-act="giMod" data-k="${m.k}" data-on="${on?0:1}">${on?'Desactivar':'Activar'}</button>`}${on&&m.scr?` <button class="btn sm" data-act="nav" data-id="${m.scr}">Abrir</button>`:''}</div>`;}).join('')}</div>
 <h2>Módulos que ya tenías</h2><p class="sm mut">Se activan desde su propia pantalla (cada uno tiene su configuración).</p><div class="tw"><table data-nosort><thead><tr><th>Módulo</th><th>Plan</th><th>Estado</th><th></th></tr></thead><tbody>
 ${GI_EXIST.map(x=>{const lock=!giInPlan(x.plan);let on=false;try{on=!!x.on();}catch(e){}return`<tr><td>${esc(x.t)}</td><td>${esc(GI_PLANS[x.plan].t)}</td><td>${giBadge(on,lock)}</td><td class="r">${!lock&&SCREENS[x.scr]?`<button class="btn sm" data-act="nav" data-id="${x.scr}">Ir</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>
 <h2>En construcción</h2><p class="sm mut">Próximas etapas del plan de gestión integral (se activan acá cuando estén terminadas y probadas).</p><ul>${GI_NEXT.map(([t,p])=>`<li>${esc(t)} <span class="tag">${esc(GI_PLANS[p].t)}</span></li>`).join('')}</ul>`;},
 ()=>{const s=$('#gi-plan');if(s)s.addEventListener('change',()=>A.giPlan(s));},'Sistema');
SCREENS.modulos.show=()=>giAdm();
NAV.push(['modulos','Sistema'],['precios','Operación'],['vales','Equipo']);

/* ---------- Ticket en espera ---------- */
const giHolds=()=>S.holds||(S.holds=[]);
const giHoldsHere=()=>giHolds().filter(h=>String(h.caja)===String(S.tenant.caja));
function giHoldPut(note){if(!giOn('pos_hold'))return{err:'El módulo «Ticket en espera» está apagado.'};if(!can('sell'))return{err:'Sin permiso para vender.'};if(!pos.lines.length)return{err:'No hay nada para poner en espera.'};
 S.seqH=(S.seqH||0)+1;const c=custById?custById(pos.cust):null;
 const h={id:uid(),n:'E-'+S.seqH,ts:now(),user:user.name,caja:S.tenant.caja,lines:JSON.parse(JSON.stringify(pos.lines)),cust:pos.cust||'',custName:c?custFull(c):'',method:pos.method,arca:!!pos.arca,coupon:pos.coupon||'',chanSet:pos.chanSet||null,quote:pos.quote||'',note:String(note||'').replace(/[<>]/g,'').slice(0,60)};
 h.total=h.lines.reduce((a,l)=>a+lineTotal(l),0);giHolds().push(h);
 audit('TICKET_ESPERA',h.n+' · '+h.lines.length+' líneas · '+money(h.total)+(h.custName?' · '+h.custName:''));
 pos.lines=[];pos.sel=-1;pos.cust='';pos.chanSet=null;pos.coupon='';pos.quote='';save();return{h};}
function giHoldTake(id){const h=giHolds().find(x=>x.id===id);if(!h)return{err:'Ese ticket ya no está en espera.'};if(!can('sell'))return{err:'Sin permiso para vender.'};
 let swapped=null;if(pos.lines.length){const r=giHoldPut('cambio de ticket');if(r.err)return r;swapped=r.h;}
 const miss=[];let upd=0;
 pos.lines=h.lines.filter(l=>{const p=prod(l.pid);if(!p||p.active===false||p.archived){miss.push(l.name);return false;}return true;}).map(l=>{const p=prod(l.pid);
  if(l.price===l.list&&p.price!==l.list&&l.src!=='etiqueta'&&!l.lv){upd++;return Object.assign({},l,{price:p.price,list:p.price,cost:p.cost});}return l;});
 pos.cust=h.cust;pos.method=h.method||pos.method;pos.arca=!!h.arca;pos.coupon=h.coupon||'';pos.chanSet=h.chanSet||null;pos.quote=h.quote||'';pos.sel=pos.lines.length-1;
 S.holds=giHolds().filter(x=>x.id!==id);audit('TICKET_RETOMADO',h.n+' · '+money(h.total)+(upd?' · '+upd+' precio(s) actualizados':'')+(miss.length?' · sin '+miss.join(', '):''));save();return{h,swapped,miss,upd};}
A.giHold=()=>{const r=giHoldPut('');if(r.err)return toast(r.err,1);posCart();if(typeof posGrid==='function')posGrid();toast('Ticket '+r.h.n+' en espera ('+money(r.h.total)+'). Retomalo con Alt + R.');};
A.giHoldTake=el=>{const r=giHoldTake(el.dataset.id);if(r.err)return toast(r.err,1);$$('#modal-root .ov').forEach(o=>o.remove());posCart();if(typeof posGrid==='function')posGrid();
 toast('Retomado '+r.h.n+(r.swapped?' · el que estaba quedó como '+r.swapped.n:'')+(r.upd?' · '+r.upd+' precio(s) actualizados':'')+(r.miss.length?' · se quitaron artículos dados de baja':''));};
A.giHoldDrop=el=>{const h=giHolds().find(x=>x.id===el.dataset.id);if(!h)return;confirmBox('Descartar ticket en espera',`Se descarta <b>${esc(h.n)}</b> (${money(h.total)}). No hay stock ni dinero que devolver: nunca se cobró.`,()=>{S.holds=giHolds().filter(x=>x.id!==h.id);audit('TICKET_ESPERA_DESCARTADO',h.n+' · '+money(h.total));save();$$('#modal-root .ov').forEach(o=>o.remove());posCart();toast('Descartado '+h.n);},'Descartar');};
A.giHoldList=()=>{const L=giHoldsHere().slice().reverse();
 modal('Tickets en espera · caja '+esc(String(S.tenant.caja)),L.length?`<div class="tw"><table data-nosort><thead><tr><th>N.º</th><th>Hora</th><th>Cliente / nota</th><th>Cajero</th><th class="r">Artículos</th><th class="r">Total</th><th></th></tr></thead><tbody>
 ${L.map(h=>`<tr><td><b>${esc(h.n)}</b></td><td>${fmtDT(h.ts)}</td><td>${esc(h.custName||h.note||'—')}</td><td>${esc(h.user)}</td><td class="r">${h.lines.length}</td><td class="r">${money(h.total)}</td><td class="r"><button class="btn sm gold" data-act="giHoldTake" data-id="${h.id}">Retomar</button> <button class="btn sm red" data-act="giHoldDrop" data-id="${h.id}" aria-label="Descartar ${esc(h.n)}">✕</button></td></tr>`).join('')}</tbody></table></div>
 <p class="sm mut">${pos.lines.length?'Al retomar, la operación que está ahora en Vender queda en espera automáticamente.':'Al retomar se actualizan los precios de lista que cambiaron mientras esperaba (los precios cambiados a mano se respetan).'}</p>`:'<p>No hay tickets en espera en esta caja.</p>',{okText:'Cerrar',cancelText:''});};
function giHoldBar(){if(!giOn('pos_hold')||!can('sell'))return'';const n=giHoldsHere().length;
 return`<div class="row" id="gi-hold" style="margin-top:.5rem;gap:.4rem">${pos.lines.length?`<button class="btn sm sp" data-act="giHold" title="Alt + E">⏸ Poner en espera</button>`:''}<button class="btn sm sp ${n?'gold':''}" data-act="giHoldList" title="Alt + R" ${n?'':'disabled'}>Tickets en espera (${n})</button></div>`;}
{const _pc=posCart;posCart=function(){const r=_pc.apply(this,arguments);try{const c=$('#pcart');if(c&&!c.querySelector('#gi-hold')){const b=giHoldBar();if(b)c.insertAdjacentHTML('beforeend',b);}}catch(e){}return r;};}
document.addEventListener('keydown',e=>{if(!e.altKey||e.ctrlKey||e.metaKey||curScreen!=='vender'||$('#panel').hidden||$('#modal-root .ov')||!giOn('pos_hold'))return;
 const k=(e.key||'').toLowerCase();if(k==='e'){e.preventDefault();A.giHold();}else if(k==='r'){e.preventDefault();A.giHoldList();}});

/* ---------- Historial de precios (se detecta al guardar: cubre Inventario, Vender, compras, importación y la API) ---------- */
let giOrigin='';
const GI_SCR_ORIGIN={vender:'Vender',inventario:'Inventario',proveedores:'Compra a proveedor',impex:'Importación',pedidos:'Pedidos',precios:'Precios'};
const giLog=()=>S.priceLog||(S.priceLog=[]);
function giPriceKeys(p){const o={price:+p.price||0,cost:+p.cost||0};(p.pres||[]).forEach(x=>{if(x&&x.lv)o['pres:'+x.lv]=+x.unit||0;});return o;}
const GI_FLD=f=>f==='price'?'Precio de venta':f==='cost'?'Costo':'Precio '+(f.slice(5)==='d'?'display':f.slice(5)==='f'?'fardo':f.slice(5)==='p'?'pallet':f.slice(5));
function giPriceDiff(){if(!S||!Array.isArray(S.products))return;const snap=S.priceSnap;const first=!snap;const ns={};const t=now();const log=giOn('price_hist')&&!first;let n=0;
 for(const p of S.products){const k=giPriceKeys(p);ns[p.id]=k;if(!log)continue;const o=snap[p.id];if(!o)continue;
  for(const f of Object.keys(k))if(o[f]!==undefined&&o[f]!==k[f]){giLog().push({id:uid(),ts:t,pid:p.id,name:pfull(p),f,from:o[f],to:k[f],origin:giOrigin||GI_SCR_ORIGIN[curScreen]||(SCREENS[curScreen]&&SCREENS[curScreen].t)||'Sistema',user:user?user.name:'sistema'});n++;}}
 S.priceSnap=ns;if(n&&giLog().length>20000)S.priceLog=giLog().slice(-20000);}
{const _sv=save;save=function(){try{giPriceDiff();}catch(e){}return _sv.apply(this,arguments);};}

/* ---------- Etiquetas de góndola ---------- */
const giLblTs=()=>S.lblTs||(S.lblTs={});
function giLblPending(){const ts=giLblTs();const last={};giLog().forEach(e=>{if(e.f!=='cost'&&e.ts>(last[e.pid]||0))last[e.pid]=e.ts;});
 return S.products.filter(p=>p.active!==false&&!p.archived&&last[p.id]&&last[p.id]>(ts[p.id]||0));}
function giEanOk(c){const s=String(c||'');if(!/^\d{13}$/.test(s))return false;let t=0;for(let i=0;i<12;i++)t+=(+s[i])*(i%2?3:1);return (10-t%10)%10===+s[12];}
function giEanSvg(code){if(!giEanOk(code))return'';const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'],G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'],R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
 const P=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'][+code[0]];let b='101';for(let i=1;i<=6;i++)b+=(P[i-1]==='L'?L:G)[+code[i]];b+='01010';for(let i=7;i<=12;i++)b+=R[+code[i]];b+='101';
 let x=0,r='';for(const ch of b){if(ch==='1')r+=`<rect x="${x}" y="0" width="1" height="40"/>`;x++;}
 return`<svg class="ean" viewBox="0 0 ${b.length} 48" preserveAspectRatio="none" aria-label="Código ${code}">${r}<text x="${b.length/2}" y="47" font-size="7" text-anchor="middle" font-family="monospace">${code}</text></svg>`;}
const GI_LV={d:'Display',f:'Fardo',p:'Pallet'};
function giLabelHTML(pids){const ps=pids.map(prod).filter(Boolean);const d=dmy(dkey(now()));const shop=esc(S.tenant.name);
 const one=p=>{const unit=p.unit==='kg'?' x kg':p.unit==='lt'?' x litro':'';const pres=(S.cfg.wholesale&&S.cfg.wholesale.on&&Array.isArray(p.pres))?p.pres.filter(x=>x&&x.qty>1&&x.unit>0):[];
  return`<div class="lb"><div class="nm">${esc(p.name)}</div><div class="sb">${esc(p.sub||'')}</div><div class="pr">${money(p.price)}<small>${unit}</small></div>
  ${pres.length?`<div class="ps">${pres.map(x=>`${esc(GI_LV[x.lv]||x.lv)} x${x.qty}: ${money(x.unit)} c/u`).join(' · ')}</div>`:''}${giEanSvg(p.barcode)}<div class="ft">${shop} · vigente desde ${d}</div></div>`;};
 return`<!doctype html><html lang="es"><meta charset="utf-8"><title>Etiquetas de góndola</title><style>@page{size:A4;margin:8mm}body{font-family:Arial,sans-serif;margin:0}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
 .lb{border:1px dashed #999;padding:2.5mm;height:34mm;box-sizing:border-box;break-inside:avoid;display:flex;flex-direction:column}.nm{font-weight:700;font-size:10.5pt;line-height:1.1;max-height:2.3em;overflow:hidden}.sb{font-size:8pt;color:#444;min-height:1em}
 .pr{font-size:21pt;font-weight:800;margin-top:auto}.pr small{font-size:9pt;font-weight:400}.ps{font-size:7.2pt}.ean{width:34mm;height:9mm;display:block}.ft{font-size:6.5pt;color:#555}</style>
 <body><div class="g">${ps.map(one).join('')}</div><script>window.onload=function(){setTimeout(function(){print()},150)}<\/script></body></html>`;}
let giLblSel=[];
A.giLblPrint=el=>{const which=el&&el.dataset&&el.dataset.w;const pids=which==='sel'?giLblSel.slice():giLblPending().map(p=>p.id);if(!pids.length)return toast('No hay etiquetas para imprimir.',1);
 const w=window.open('','_blank','width=900,height=700');if(!w)return toast('El navegador bloqueó la ventana de impresión.',1);w.document.write(giLabelHTML(pids));w.document.close();
 confirmBox('¿Salieron bien las etiquetas?',`Se mandaron <b>${pids.length}</b> etiqueta(s) a imprimir. Si salieron bien, las marco como impresas y salen de «pendientes».`,()=>{const t=now();pids.forEach(id=>giLblTs()[id]=t);audit('ETIQUETAS_GONDOLA',pids.length+' etiqueta(s) impresas');if(which==='sel')giLblSel=[];save();rerender();toast('Etiquetas marcadas como impresas');},'Sí, marcar impresas');};
A.giLblAdd=()=>{const q=val('gi-lq').trim();if(!q)return;const p=giFind(q)[0];if(!p)return toast('No encontré ese artículo.',1);if(!giLblSel.includes(p.id))giLblSel.push(p.id);rerender();};
A.giLblRm=el=>{giLblSel=giLblSel.filter(x=>x!==el.dataset.id);rerender();};

/* ---------- Búsqueda común (código de barras, código de presentación o nombre sin acentos) ---------- */
const giNorm=t=>{t=String(t||'').toLowerCase();try{t=t.normalize('NFD').replace(/[̀-ͯ]/g,'');}catch(e){}return t.trim();};
function giFind(q,max=8){q=String(q||'').trim();if(!q)return[];const act=S.products.filter(p=>p.active!==false&&!p.archived);
 const byCode=act.filter(p=>p.barcode===q||p.plu===q||(p.pres||[]).some(x=>x&&x.barcode===q));if(byCode.length)return byCode.slice(0,max);
 const w=giNorm(q).split(/\s+/).filter(Boolean);return act.filter(p=>{const n=giNorm(pfull(p));return w.every(x=>n.includes(x));}).slice(0,max);}

/* ---------- Actualización masiva de precios ---------- */
const giBatches=()=>S.priceBatches||(S.priceBatches=[]);
const giRound=(c,r)=>{r=+r||0;if(!r)return Math.round(c);const s=r*100;return Math.max(s,Math.round(c/s)*s);};
const giMargin=(price,cost)=>price>0&&cost>0?Math.round((price-cost)/price*1000)/10:null;
function giSupPids(sid){const s=new Set();(S.pOrders||[]).concat(S.receipts||[]).forEach(o=>{if(o&&(o.provId===sid||o.proveedor_id===sid))(o.items||[]).forEach(i=>i&&i.pid&&s.add(i.pid));});return s;}
function giScope(f){let L=S.products.filter(p=>p.active!==false&&!p.archived&&!(typeof isKit==='function'&&isKit(p)));
 if(f.rubro)L=L.filter(p=>p.rubro===f.rubro);if(f.sup){const s=giSupPids(f.sup);L=L.filter(p=>s.has(p.id));}
 if(f.q){const w=giNorm(f.q).split(/\s+/).filter(Boolean);L=L.filter(p=>{const n=giNorm(pfull(p));return w.every(x=>n.includes(x));});}return L;}
/* f: {rubro,sup,q, field:'price'|'cost'|'costm', mode:'pct'|'amt', v:number (pct) | cents (amt), round:0|10|50|100, pres:bool} */
function giBulkPlan(f){const v=+f.v;if(!isFinite(v)||v===0)return{err:'Indicá cuánto subir o bajar (distinto de cero).'};if(f.mode==='pct'&&(v<=-90||v>500))return{err:'El porcentaje tiene que estar entre -90 % y 500 %.'};
 const L=giScope(f);if(!L.length)return{err:'Ningún artículo coincide con el filtro.'};const ap=x=>f.mode==='pct'?x*(1+v/100):x+v;const rows=[],bad=[];
 for(const p of L){const r={pid:p.id,name:pfull(p),ch:[]};
  if(f.field==='price'||f.field==='costm'){if(f.field==='price'){const np=giRound(ap(p.price),f.round);if(!(np>0)){bad.push(r.name);continue;}if(np!==p.price)r.ch.push({f:'price',from:p.price,to:np});}
   else{const nc=Math.round(ap(p.cost||0));if(!(p.cost>0)||!(nc>0)){bad.push(r.name);continue;}const k=p.price/p.cost;const np=giRound(nc*k,f.round);if(nc!==p.cost)r.ch.push({f:'cost',from:p.cost,to:nc});if(np!==p.price)r.ch.push({f:'price',from:p.price,to:np});}
   if(f.pres&&Array.isArray(p.pres)){const pr=p.price?((r.ch.find(c=>c.f==='price')||{to:p.price}).to/p.price):1;p.pres.forEach(x=>{if(!x||!x.lv||!(x.unit>0))return;const nu=giRound(x.unit*pr,f.round);if(nu>0&&nu!==x.unit)r.ch.push({f:'pres:'+x.lv,from:x.unit,to:nu});});}}
  else if(f.field==='cost'){if(!(p.cost>0)){bad.push(r.name);continue;}const nc=Math.round(ap(p.cost));if(!(nc>0)){bad.push(r.name);continue;}if(nc!==p.cost)r.ch.push({f:'cost',from:p.cost,to:nc});}
  if(r.ch.length){const p2=r.ch.find(c=>c.f==='price'),c2=r.ch.find(c=>c.f==='cost');r.m0=giMargin(p.price,p.cost);r.m1=giMargin(p2?p2.to:p.price,c2?c2.to:p.cost);rows.push(r);}}
 return{rows,bad};}
function giSetField(p,f,v){if(f==='price')p.price=v;else if(f==='cost')p.cost=v;else if(f.startsWith('pres:')){const x=(p.pres||[]).find(y=>y&&y.lv===f.slice(5));if(x)x.unit=v;}}
function giGetField(p,f){if(f==='price')return p.price;if(f==='cost')return p.cost;const x=(p.pres||[]).find(y=>y&&y.lv===f.slice(5));return x?x.unit:undefined;}
function giBulkApply(plan,desc){if(!can('edit_products'))return{err:'Sin permiso para editar el inventario.'};if(!plan||!plan.rows||!plan.rows.length)return{err:'No hay cambios para aplicar.'};
 S.seqPB=(S.seqPB||0)+1;const b={id:uid(),n:'AM-'+S.seqPB,ts:now(),user:user.name,desc:String(desc||'').slice(0,160),changes:[],undone:0};
 giOrigin='Actualización masiva '+b.n;try{for(const r of plan.rows){const p=prod(r.pid);if(!p)continue;for(const c of r.ch){if(giGetField(p,c.f)!==c.from)continue;giSetField(p,c.f,c.to);b.changes.push({pid:p.id,f:c.f,from:c.from,to:c.to});}}
  giBatches().push(b);audit('PRECIOS_MASIVO',b.n+' · '+b.desc+' · '+new Set(b.changes.map(c=>c.pid)).size+' artículo(s)');save();}finally{giOrigin='';}return{b};}
function giBulkUndo(id){if(!can('edit_products'))return{err:'Sin permiso para editar el inventario.'};const b=giBatches().find(x=>x.id===id);if(!b)return{err:'Actualización inexistente.'};if(b.undone)return{err:'Esa actualización ya se deshizo.'};
 let ok=0,skip=0;giOrigin='Deshacer '+b.n;try{for(const c of b.changes){const p=prod(c.pid);if(!p||giGetField(p,c.f)!==c.to){skip++;continue;}giSetField(p,c.f,c.from);ok++;}
  b.undone=now();b.undoneBy=user.name;audit('PRECIOS_MASIVO_DESHECHO',b.n+' · '+ok+' valor(es) restaurados'+(skip?' · '+skip+' sin tocar (cambiaron después)':''));save();}finally{giOrigin='';}return{ok,skip};}
let giPlanCur=null,giPlanDesc='';
function giBulkForm(){return{rubro:val('gi-br'),sup:val('gi-bs'),q:val('gi-bq'),field:val('gi-bf')||'price',mode:val('gi-bm')||'pct',v:val('gi-bm')==='amt'?cents(val('gi-bv')):parseNum(val('gi-bv')),round:+val('gi-bo')||0,pres:!!($('#gi-bp')&&$('#gi-bp').checked)};}
A.giBulkPrev=()=>{const f=giBulkForm();const r=giBulkPlan(f);if(r.err){giPlanCur=null;return toast(r.err,1);}giPlanCur=r;
 giPlanDesc=({price:'Precio de venta',cost:'Costo',costm:'Costo y precio (mismo margen)'}[f.field])+' '+(f.mode==='pct'?(f.v>0?'+':'')+String(f.v).replace('.',',')+' %':(f.v>0?'+':'- ')+money(Math.abs(f.v)))+(f.rubro?' · '+rubName(f.rubro):'')+(f.sup?' · proveedor '+((S.suppliers||[]).find(s=>s.id===f.sup)||{}).name:'')+(f.q?' · «'+f.q+'»':'')+(f.round?' · redondeo $ '+f.round:'');
 const box=$('#gi-bprev');if(box)box.innerHTML=giPrevHTML(r);};
function giPrevHTML(r){const cv=can('view_cost');return`<div class="okbox"><b>${r.rows.length}</b> artículo(s) cambian${r.bad.length?` · <b>${r.bad.length}</b> sin cambiar (sin costo o el resultado da cero o menos)`:''}.</div>
 <div class="tw" style="max-height:24rem;overflow:auto"><table data-nosort><thead><tr><th>Artículo</th><th>Campo</th><th class="r">Actual</th><th class="r">Nuevo</th>${cv?'<th class="r">Margen</th>':''}</tr></thead><tbody>
 ${r.rows.slice(0,300).map(x=>x.ch.map((c,i)=>`<tr><td>${i?'':esc(x.name)}</td><td>${esc(GI_FLD(c.f))}</td><td class="r">${money(c.from)}</td><td class="r"><b>${money(c.to)}</b></td>${cv?`<td class="r">${i?'':(x.m1===null?'—':(x.m0===null?'':String(x.m0).replace('.',',')+' % → ')+String(x.m1).replace('.',',')+' %')}</td>`:''}</tr>`).join('')).join('')}</tbody></table></div>
 ${r.rows.length>300?'<p class="sm mut">Se muestran los primeros 300.</p>':''}<button class="btn gold" data-act="giBulkGo">Aplicar a ${r.rows.length} artículo(s)</button>`;}
A.giBulkGo=()=>{if(!giPlanCur)return;confirmBox('Aplicar actualización masiva',`Se cambian <b>${giPlanCur.rows.length}</b> artículo(s): ${esc(giPlanDesc)}. Queda en el historial y se puede deshacer.`,()=>{const r=giBulkApply(giPlanCur,giPlanDesc);if(r.err)return toast(r.err,1);giPlanCur=null;toast('Listo: '+r.b.n+' aplicada');rerender();},'Aplicar');};
A.giBulkUndo=el=>{const b=giBatches().find(x=>x.id===el.dataset.id);if(!b)return;confirmBox('Deshacer '+esc(b.n),'Se vuelven los valores anteriores. Si algún precio se cambió después, ese no se toca.',()=>{const r=giBulkUndo(b.id);if(r.err)return toast(r.err,1);toast(r.ok+' valor(es) restaurados'+(r.skip?' · '+r.skip+' sin tocar':''));rerender();},'Deshacer');};

/* ---------- Lista del proveedor (pegar CSV/TSV) ---------- */
function giParseList(txt){const lines=String(txt||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);if(!lines.length)return{rows:[],sep:';'};
 const sep=[';','\t',','].map(s=>[s,lines[0].split(s).length]).sort((a,b)=>b[1]-a[1])[0][0];
 const rows=lines.map(l=>l.split(sep).map(x=>x.trim().replace(/^"|"$/g,'')));return{rows,sep};}
const giMoney=s=>{s=String(s||'').replace(/[$\s]/g,'');if(!s)return NaN;if(/,\d{1,2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');else if(/\.\d{3}(\.|$)/.test(s)&&!/\.\d{1,2}$/.test(s))s=s.replace(/\./g,'');else s=s.replace(/,/g,'');const n=parseFloat(s);return isFinite(n)?Math.round(n*100):NaN;};
/* o: {txt, colCode, colVal, target:'cost'|'price', keepMargin, round, header} */
function giListPlan(o){const P=giParseList(o.txt);let rows=P.rows;if(o.header)rows=rows.slice(1);if(!rows.length)return{err:'Pegá la lista del proveedor (una línea por artículo).'};
 const cc=+o.colCode||0,cvv=+o.colVal||1;const out=[],miss=[],bad=[];const byName=new Map(S.products.map(p=>[giNorm(pfull(p)),p]));
 for(const r of rows){const code=String(r[cc]||'').trim();const v=giMoney(r[cvv]);if(!code)continue;if(!(v>0)){bad.push(code);continue;}
  const p=S.products.find(x=>x.barcode===code||x.id===code||x.plu===code)||byName.get(giNorm(code));if(!p){miss.push(code);continue;}
  const x={pid:p.id,name:pfull(p),ch:[]};
  if(o.target==='price'){const np=giRound(v,o.round);if(np!==p.price)x.ch.push({f:'price',from:p.price,to:np});}
  else{if(v!==p.cost)x.ch.push({f:'cost',from:p.cost||0,to:v});if(o.keepMargin&&p.cost>0){const np=giRound(v*p.price/p.cost,o.round);if(np>0&&np!==p.price)x.ch.push({f:'price',from:p.price,to:np});}}
  if(x.ch.length){const p2=x.ch.find(c=>c.f==='price'),c2=x.ch.find(c=>c.f==='cost');x.m0=giMargin(p.price,p.cost);x.m1=giMargin(p2?p2.to:p.price,c2?c2.to:p.cost);out.push(x);}}
 return{rows:out,bad,miss,cols:(P.rows[0]||[]).length};}
A.giListPrev=()=>{const r=giListPlan({txt:val('gi-lt'),colCode:val('gi-lc'),colVal:val('gi-lv'),target:val('gi-lg')||'cost',keepMargin:!!($('#gi-lk')&&$('#gi-lk').checked),round:+val('gi-lo')||0,header:!!($('#gi-lh')&&$('#gi-lh').checked)});
 if(r.err)return toast(r.err,1);giPlanCur=r;giPlanDesc='Lista del proveedor'+(val('gi-ls')?' · '+(((S.suppliers||[]).find(s=>s.id===val('gi-ls'))||{}).name||''):'');
 const box=$('#gi-lprev');if(box)box.innerHTML=(r.miss.length?`<div class="warnbox">No encontré ${r.miss.length} código(s): ${r.miss.slice(0,12).map(esc).join(', ')}${r.miss.length>12?'…':''}</div>`:'')+(r.rows.length?giPrevHTML(r):'<p>No hay cambios: los valores ya coinciden.</p>');};

/* ---------- Pantalla «Precios y etiquetas» ---------- */
let giPTab='hist';
A.giPTab=el=>{giPTab=el.dataset.t;rerender();};
function giHistHTML(){const q=giNorm(val('gi-hq')||'');const L=giLog().slice(-400).reverse().filter(e=>!q||giNorm(e.name).includes(q)).slice(0,200);const cv=can('view_cost');
 return`<p class="sm mut">Cada cambio de precio${cv?' o costo':''} queda acá con el valor anterior, el nuevo, quién y desde dónde (Inventario, Vender, compra a proveedor, importación o actualización masiva).</p>
 <div class="tw"><table><thead><tr><th>Fecha</th><th>Artículo</th><th>Campo</th><th class="r">Antes</th><th class="r">Después</th><th class="r">Variación</th><th>Origen</th><th>Usuario</th></tr></thead><tbody>
 ${L.filter(e=>cv||e.f!=='cost').map(e=>`<tr><td>${fmtDT(e.ts)}</td><td>${esc(e.name)}</td><td>${esc(GI_FLD(e.f))}</td><td class="r">${money(e.from)}</td><td class="r">${money(e.to)}</td><td class="r">${e.from>0?((e.to>=e.from?'+':'')+(Math.round((e.to-e.from)/e.from*1000)/10).toString().replace('.',',')+' %'):'—'}</td><td>${esc(e.origin)}</td><td>${esc(e.user)}</td></tr>`).join('')||'<tr><td colspan="8" class="mut">Todavía no hay cambios registrados.</td></tr>'}</tbody></table></div>
 ${giBatches().length?`<h3>Actualizaciones masivas</h3><div class="tw"><table data-nosort><thead><tr><th>N.º</th><th>Fecha</th><th>Detalle</th><th class="r">Valores</th><th>Usuario</th><th></th></tr></thead><tbody>${giBatches().slice().reverse().map(b=>`<tr><td>${esc(b.n)}</td><td>${fmtDT(b.ts)}</td><td>${esc(b.desc)}</td><td class="r">${b.changes.length}</td><td>${esc(b.user)}</td><td class="r">${b.undone?'<span class="tag">Deshecha</span>':(giOn('price_bulk')&&can('edit_products')?`<button class="btn sm" data-act="giBulkUndo" data-id="${b.id}">Deshacer</button>`:'')}</td></tr>`).join('')}</tbody></table></div>`:''}`;}
function giLblHTML(){const P=giLblPending();
 return`<div class="card"><div class="row"><h3 class="sp" style="margin:0">Pendientes de reimprimir (${P.length})</h3><button class="btn gold" data-act="giLblPrint" data-w="pend" ${P.length?'':'disabled'}>Imprimir pendientes</button></div>
 <p class="sm mut">Artículos cuyo precio cambió después de la última etiqueta impresa. Salen de la lista cuando confirmás que se imprimieron.</p>
 ${P.length?`<div class="tw"><table data-nosort><thead><tr><th>Artículo</th><th class="r">Precio actual</th><th>Código</th></tr></thead><tbody>${P.map(p=>`<tr><td>${esc(pfull(p))}</td><td class="r">${money(p.price)}</td><td>${esc(p.barcode||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="mut">No hay etiquetas pendientes.</p>'}</div>
 <div class="card"><h3 style="margin-top:0">Imprimir etiquetas elegidas</h3><div class="row"><input id="gi-lq" class="sp" placeholder="Código de barras o nombre" autocomplete="off"><button class="btn" data-act="giLblAdd">Agregar</button></div>
 ${giLblSel.length?`<ul>${giLblSel.map(id=>{const p=prod(id);return p?`<li>${esc(pfull(p))} · ${money(p.price)} <button class="btn sm red" data-act="giLblRm" data-id="${id}" aria-label="Quitar">✕</button></li>`:'';}).join('')}</ul><button class="btn gold" data-act="giLblPrint" data-w="sel">Imprimir ${giLblSel.length} etiqueta(s)</button>`:'<p class="sm mut">Formato A4, 3 columnas, con precio grande, presentaciones mayoristas y código de barras EAN-13.</p>'}</div>`;}
function giBulkHTML(){const rubs=S.rubros.filter(r=>r.kind==='rubro');const sups=(S.suppliers||[]).filter(s=>s.activo!==false);const cv=can('view_cost');
 return`<div class="card"><h3 style="margin-top:0">Actualización masiva</h3><div class="f">
 <div><label for="gi-br">Rubro</label><select id="gi-br"><option value="">Todos</option>${rubs.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></div>
 <div><label for="gi-bs">Proveedor (artículos que le compraste)</label><select id="gi-bs"><option value="">Todos</option>${sups.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
 <div><label for="gi-bq">Nombre contiene</label><input id="gi-bq" autocomplete="off"></div></div><div class="f">
 <div><label for="gi-bf">Qué cambia</label><select id="gi-bf"><option value="price">Precio de venta</option>${cv?'<option value="costm">Costo y precio (mantiene el margen)</option><option value="cost">Sólo el costo</option>':''}</select></div>
 <div><label for="gi-bm">Cómo</label><select id="gi-bm"><option value="pct">Porcentaje (%)</option><option value="amt">Importe fijo ($)</option></select></div>
 <div><label for="gi-bv">Cuánto (negativo para bajar)</label><input id="gi-bv" inputmode="decimal" placeholder="Ej.: 8 o -5" autocomplete="off"></div>
 <div><label for="gi-bo">Redondeo del precio</label><select id="gi-bo"><option value="0">Sin redondeo</option><option value="10">A $ 10</option><option value="50">A $ 50</option><option value="100">A $ 100</option></select></div></div>
 ${S.cfg.wholesale&&S.cfg.wholesale.on?'<label class="row" style="gap:.4rem"><input type="checkbox" id="gi-bp" checked> Aplicar la misma proporción a los precios por presentación (display, fardo, pallet)</label>':''}
 <button class="btn" data-act="giBulkPrev">Ver vista previa</button><div id="gi-bprev" style="margin-top:.8rem"></div></div>
 ${cv?`<div class="card"><h3 style="margin-top:0">Lista del proveedor</h3><p class="sm mut">Pegá la lista (copiada de Excel o del PDF del proveedor): una línea por artículo, con el código de barras (o el nombre exacto) y el precio.</p>
 <label for="gi-ls">Proveedor (para el historial)</label><select id="gi-ls"><option value="">—</option>${sups.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
 <label for="gi-lt">Lista</label><textarea id="gi-lt" rows="6" placeholder="7790000000011;Gaseosa cola 2,25 L;1.850,00"></textarea>
 <div class="f"><div><label for="gi-lc">Columna del código (1 = primera)</label><select id="gi-lc">${[0,1,2,3].map(i=>`<option value="${i}">${i+1}</option>`).join('')}</select></div>
 <div><label for="gi-lv">Columna del precio</label><select id="gi-lv">${[0,1,2,3,4].map(i=>`<option value="${i}" ${i===2?'selected':''}>${i+1}</option>`).join('')}</select></div>
 <div><label for="gi-lg">Ese precio es</label><select id="gi-lg"><option value="cost">El costo (lo que me cobra el proveedor)</option><option value="price">Mi precio de venta</option></select></div>
 <div><label for="gi-lo">Redondeo</label><select id="gi-lo"><option value="0">Sin redondeo</option><option value="10">A $ 10</option><option value="50">A $ 50</option><option value="100">A $ 100</option></select></div></div>
 <label class="row" style="gap:.4rem"><input type="checkbox" id="gi-lk" checked> Si cambia el costo, recalcular el precio de venta manteniendo el margen</label><label class="row" style="gap:.4rem"><input type="checkbox" id="gi-lh"> La primera línea son títulos</label>
 <button class="btn" data-act="giListPrev">Ver vista previa</button><div id="gi-lprev" style="margin-top:.8rem"></div></div>`:''}`;}
function giKioskCard(){return`<div class="card"><h3 style="margin-top:0">Verificador de precios en góndola</h3><p class="sm">Este equipo queda como consulta de precios para los clientes: pasan el producto por el lector (o escriben el nombre) y ven el precio, el precio por kilo y los precios por bulto. No muestra costos ni stock, y no queda ninguna sesión abierta.</p>
 <p class="sm mut">Para salir del verificador hace falta el PIN de un administrador. En esta versión el verificador lee los precios de este mismo equipo; para una tablet aparte, se conecta a la nube del comercio en la etapa de pase a producción [VERIFICAR].</p>
 <button class="btn gold" data-act="giKioskOpen">Convertir este equipo en verificador</button></div>`;}
reg('precios','Precios y etiquetas','list','edit_products',()=>{const tabs=[['hist','Historial',giOn('price_hist')],['lbl','Etiquetas de góndola',giOn('price_hist')],['bulk','Actualizar precios',giOn('price_bulk')],['kiosk','Verificador',giOn('kiosk')]].filter(x=>x[2]);
 if(!tabs.some(t=>t[0]===giPTab))giPTab=(tabs[0]||['hist'])[0];
 return`<div class="row"><h1 class="sp">Precios y etiquetas</h1></div><div class="ux-tabs" role="tablist">${tabs.map(([k,t])=>`<a role="tab" tabindex="0" data-act="giPTab" data-t="${k}" aria-selected="${k===giPTab}" class="${k===giPTab?'on':''}">${esc(t)}</a>`).join('')}</div>
 ${giPTab==='hist'?`<div class="row" style="margin:.6rem 0"><input id="gi-hq" class="sp" placeholder="Filtrar por artículo" autocomplete="off" value=""></div><div id="gi-hbox">${giHistHTML()}</div>`:giPTab==='lbl'?giLblHTML():giPTab==='bulk'?giBulkHTML():giKioskCard()}`;},
 ()=>{const h=$('#gi-hq');if(h)h.addEventListener('input',()=>{const b=$('#gi-hbox');if(b)b.innerHTML=giHistHTML();});const l=$('#gi-lq');if(l)l.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();A.giLblAdd();}});},'Operación');
SCREENS.precios.show=()=>giOn('price_hist')||giOn('price_bulk')||giOn('kiosk');

/* ---------- Verificador de precios (modo kiosco) ---------- */
let giKT=0;
A.giKioskOpen=()=>{if(!giOn('kiosk'))return;if(!giAdm()&&!can('config'))return toast('Lo activa el administrador.',1);
 confirmBox('Convertir en verificador','Se cierra tu sesión y este equipo queda mostrando precios a los clientes. Para salir, el PIN de un administrador.',()=>{audit('VERIFICADOR_ON',user.name);S.kioskOn=1;save();user=null;location.hash='#verificador';},'Convertir');};
function giKioskShow(){let k=$('#gi-kiosk');if(!k){k=document.createElement('div');k.id='gi-kiosk';document.body.appendChild(k);}
 ['#pub','#login','#panel'].forEach(s=>{const e=$(s);if(e)e.hidden=true;});
 k.setAttribute('style','position:fixed;inset:0;z-index:50;background:var(--bg,#111);color:var(--ink,#eee);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:4vh 4vw;overflow:auto');
 k.innerHTML=`<h1 style="font-size:clamp(1.6rem,4vw,3rem);margin:.2em 0">${esc(S.tenant.name)}</h1><p style="font-size:1.3rem;margin:0 0 1rem">Pasá el producto por el lector para ver el precio</p>
 <input id="gi-kq" aria-label="Código de barras o nombre del producto" autocomplete="off" placeholder="o escribí el nombre" style="font-size:1.6rem;padding:.6rem 1rem;width:min(40rem,92vw);border-radius:12px">
 <div id="gi-kr" aria-live="polite" style="width:min(56rem,94vw);margin-top:1.5rem"></div><button class="btn sm" data-act="giKioskExit" style="position:fixed;right:1rem;bottom:1rem;opacity:.55">Salir</button>`;
 const q=$('#gi-kq');q.focus();q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();giKioskLook(q.value);q.value='';}});
 q.addEventListener('input',()=>{const v=q.value.trim();if(v.length>=3&&!/^\d+$/.test(v))giKioskLook(v,1);});
 k.addEventListener('click',e=>{if(!e.target.closest('button,input'))q.focus();});}
function giKioskCardHTML(p){const unit=p.unit==='kg'?'por kilo':p.unit==='lt'?'por litro':'';const pres=(S.cfg.wholesale&&S.cfg.wholesale.on&&Array.isArray(p.pres))?p.pres.filter(x=>x&&x.qty>1&&x.unit>0):[];
 return`<div class="card" style="text-align:center;padding:1.5rem"><div style="font-size:clamp(1.3rem,3vw,2.2rem);font-weight:700">${esc(p.name)}</div><div class="mut" style="font-size:1.2rem">${esc(p.sub||'')}</div>
 <div style="font-size:clamp(3rem,10vw,6.5rem);font-weight:800;line-height:1.1;margin:.3em 0">${money(p.price)}</div>${unit?`<div style="font-size:1.4rem">${unit}</div>`:''}
 ${pres.length?`<div class="tw" style="margin-top:1rem"><table data-nosort style="font-size:1.25rem"><thead><tr><th>Presentación</th><th class="r">Unidades</th><th class="r">Precio por unidad</th><th class="r">Total</th></tr></thead><tbody>${pres.map(x=>`<tr><td>${esc(GI_LV[x.lv]||x.lv)}</td><td class="r">${x.qty}</td><td class="r">${money(x.unit)}</td><td class="r">${money(x.unit*x.qty)}</td></tr>`).join('')}</tbody></table></div>`:''}</div>`;}
function giKioskLook(q,soft){const r=$('#gi-kr');if(!r)return;clearTimeout(giKT);const L=giFind(q,6);
 if(!L.length){if(!soft)r.innerHTML='<div class="card" style="text-align:center;font-size:1.4rem">No encontramos ese producto. Consultá en el mostrador.</div>';}
 else if(L.length===1||!soft)r.innerHTML=giKioskCardHTML(L[0]);
 else r.innerHTML=`<div class="card"><ul style="font-size:1.3rem;list-style:none;padding:0;margin:0">${L.map(p=>`<li style="display:flex;justify-content:space-between;gap:1rem;padding:.5rem 0;border-bottom:1px solid #8884"><span>${esc(pfull(p))}</span><b>${money(p.price)}</b></li>`).join('')}</ul></div>`;
 giKT=setTimeout(()=>{const x=$('#gi-kr');if(x)x.innerHTML='';},15000);}
A.giKioskExit=()=>{modal('Salir del verificador','<label for="gi-kp">PIN de un administrador</label><input id="gi-kp" type="password" inputmode="numeric" autocomplete="off">',{okText:'Salir',onOk:w=>{const pin=val('gi-kp');const u=S.users.find(x=>x.role==='admin'&&x.pin&&x.pin===pin);
 if(!u){audit('VERIFICADOR_PIN_FALLIDO','');w._err('PIN incorrecto.');return false;}S.kioskOn=0;audit('VERIFICADOR_OFF',u.name);save();const k=$('#gi-kiosk');if(k)k.remove();location.hash='#acceso';}});};

/* ---------- Vales y adelantos del personal ---------- */
const giVales=()=>S.vales||(S.vales=[]);
const GI_VT={adelanto:'Adelanto de sueldo',consumo:'Consumo en el local',prestamo:'Préstamo en cuotas'};
const giValeSaldo=v=>v.state==='anulado'?0:Math.max(0,v.amount-(v.desc||[]).reduce((a,d)=>a+d.amount,0));
const giValeCuota=v=>Math.min(giValeSaldo(v),v.cuotaAmt||v.amount);
/* f: {emp, tipo, amount (centavos), cuotas, note, pin, paper, rubro} */
function giValeCreate(f){if(!giOn('hr_vales'))return{err:'El módulo «Vales» está apagado.'};if(!can('staff'))return{err:'Sin permiso de personal.'};
 const e=(S.employees||[]).find(x=>x.id===f.emp&&x.active);if(!e)return{err:'Elegí un empleado activo.'};if(!GI_VT[f.tipo])return{err:'Tipo de vale inválido.'};
 const amt=+f.amount;if(!(Number.isInteger(amt)&&amt>0))return{err:'El importe tiene que ser mayor a cero.'};
 const cu=f.tipo==='prestamo'?(+f.cuotas||0):1;if(!(Number.isInteger(cu)&&cu>=1&&cu<=24))return{err:'Las cuotas van de 1 a 24.'};
 if(e.pin){if(String(f.pin||'')!==String(e.pin))return{err:'El PIN del empleado no coincide: tiene que confirmarlo él.'};}else if(!f.paper)return{err:'El empleado no tiene PIN: marcá que firmó el comprobante en papel.'};
 const cash=f.tipo!=='consumo';S.seqV=(S.seqV||0)+1;const n='V-'+S.seqV;let movId='',sessId='';
 if(cash){if(!can('cash_mov'))return{err:'Sin permiso para sacar efectivo de la caja.'};const s=openSess();if(!s)return{err:'Abrí la caja: el adelanto sale en efectivo.'};
  const rub=(typeof ownerMode==='function'&&ownerMode())?ownerRubro():f.rubro;const er=addMov('egreso',rub,'Vale '+n+' · '+GI_VT[f.tipo]+' · '+e.name,amt);if(er){S.seqV--;return{err:er};}
  const m=S.movs[S.movs.length-1];movId=m.id;sessId=s.id;m.vale=n;}
 const v={id:uid(),n,ts:now(),user:user.name,emp:e.id,empName:e.name,tipo:f.tipo,amount:amt,cuotas:cu,cuotaAmt:Math.ceil(amt/cu),note:String(f.note||'').replace(/[<>]/g,'').slice(0,120),movId,sessId,conf:e.pin?'PIN del empleado':'Firma en papel',desc:[],state:'pendiente'};
 giVales().push(v);audit('VALE',n+' · '+GI_VT[f.tipo]+' · '+e.name+' · '+money(amt)+(cu>1?' en '+cu+' cuotas':'')+' · confirmado con '+v.conf);save();return{v};}
function giValeDesc(id,amount,ref){if(!can('staff'))return{err:'Sin permiso de personal.'};const v=giVales().find(x=>x.id===id);if(!v||v.state!=='pendiente')return{err:'Ese vale no tiene saldo pendiente.'};
 const s=giValeSaldo(v);const a=amount===undefined?giValeCuota(v):+amount;if(!(Number.isInteger(a)&&a>0&&a<=s))return{err:'El descuento tiene que ser mayor a cero y hasta el saldo ('+money(s)+').'};
 v.desc.push({id:uid(),ts:now(),amount:a,user:user.name,ref:String(ref||'Liquidación').slice(0,60)});if(giValeSaldo(v)===0)v.state='saldado';
 audit('VALE_DESCUENTO',v.n+' · '+v.empName+' · '+money(a)+' · saldo '+money(giValeSaldo(v)));save();return{v,a};}
function giValeVoid(id,why){if(!can('staff'))return{err:'Sin permiso de personal.'};const v=giVales().find(x=>x.id===id);if(!v||v.state!=='pendiente')return{err:'Sólo se anula un vale pendiente.'};
 if((v.desc||[]).length)return{err:'Ya tiene descuentos: no se anula (registrá el reintegro como movimiento aparte).'};if(!why||String(why).trim().length<3)return{err:'Escribí el motivo de la anulación.'};
 if(v.movId){const s=openSess();if(!s)return{err:'Abrí la caja: el empleado devuelve el efectivo y entra como ingreso.'};const m=S.movs.find(x=>x.id===v.movId);const rub=(typeof ownerMode==='function'&&ownerMode())?ownerRubro():(m?m.rubro:'');
  const er=addMov('ingreso',rub,'Devolución vale '+v.n+' · '+v.empName,v.amount);if(er)return{err:er};}
 v.state='anulado';v.voidAt=now();v.voidWhy=String(why).trim().slice(0,120);audit('VALE_ANULADO',v.n+' · '+v.empName+' · '+money(v.amount)+' · '+v.voidWhy);save();return{v};}
function giValeDue(){const o={};giVales().filter(v=>v.state==='pendiente').forEach(v=>{const c=giValeCuota(v);if(c>0){(o[v.emp]=o[v.emp]||{emp:v.emp,name:v.empName,total:0,vales:[]}).total+=c;o[v.emp].vales.push({id:v.id,n:v.n,c});}});return Object.values(o);}
function giValeTxt(v){return['COMPROBANTE DE VALE '+v.n,S.tenant.name,fmtDT(v.ts),'',GI_VT[v.tipo],'Empleado: '+v.empName,'Importe: '+money(v.amount)+(v.cuotas>1?' en '+v.cuotas+' cuotas de '+money(v.cuotaAmt):''),v.note?'Nota: '+v.note:'','Confirmado con: '+v.conf,'Entregó: '+v.user,'','Se descuenta de la liquidación del empleado.','','Firma del empleado: ______________________','Aclaración: ______________________'].filter(x=>x!==null).join('\n');}
A.giValeNew=()=>{const E=(S.employees||[]).filter(e=>e.active);if(!E.length)return toast('No hay empleados activos.',1);const rubs=S.rubros.filter(r=>r.kind==='rubro');const own=typeof ownerMode==='function'&&ownerMode();
 const w=modal('Nuevo vale',`<label for="gv-e">Empleado</label><select id="gv-e">${E.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>
 <label for="gv-t">Tipo</label><select id="gv-t">${Object.entries(GI_VT).map(([k,t])=>`<option value="${k}">${esc(t)}</option>`).join('')}</select>
 <label for="gv-a">Importe ($)</label>${numIn('gv-a',0,'0')}<div id="gv-cw" hidden><label for="gv-c">Cuotas</label><input id="gv-c" inputmode="numeric" value="3"></div>
 ${own?'':`<div id="gv-rw"><label for="gv-r">Caja del rubro de donde sale el efectivo</label><select id="gv-r">${rubs.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></div>`}
 <label for="gv-n">Nota (opcional)</label><input id="gv-n" maxlength="120"><div id="gv-pw"><label for="gv-p">PIN del empleado (lo escribe él para confirmar)</label><input id="gv-p" type="password" inputmode="numeric" autocomplete="off"></div>
 <label class="row" id="gv-fw" style="gap:.4rem" hidden><input type="checkbox" id="gv-f"> El empleado firmó el comprobante en papel</label>
 <p class="sm mut">Adelanto y préstamo salen en efectivo de la caja abierta (egreso con su comprobante). El consumo no mueve caja: queda a descontar.</p>`,
 {okText:'Registrar vale',onOk:w=>{const r=giValeCreate({emp:val('gv-e'),tipo:val('gv-t'),amount:cents(val('gv-a')),cuotas:parseNum(val('gv-c')),note:val('gv-n'),pin:val('gv-p'),paper:$('#gv-f')&&$('#gv-f').checked,rubro:val('gv-r')});
  if(r.err)return w._err(r.err),false;toast('Vale '+r.v.n+' registrado');rerender();setTimeout(()=>A.giValePrint({dataset:{id:r.v.id}}),60);}});
 const sync=()=>{const t=val('gv-t');const e=E.find(x=>x.id===val('gv-e'));$('#gv-cw').hidden=t!=='prestamo';const rw=$('#gv-rw');if(rw)rw.hidden=t==='consumo';$('#gv-pw').hidden=!(e&&e.pin);$('#gv-fw').hidden=!!(e&&e.pin);};
 ['gv-t','gv-e'].forEach(i=>$('#'+i).addEventListener('change',sync));sync();};
A.giValePrint=el=>{const v=giVales().find(x=>x.id===el.dataset.id);if(!v)return;modal('Vale '+v.n,`<pre class="rep">${esc(giValeTxt(v))}</pre>`,{okText:'Imprimir',cancelText:'Cerrar',onOk:()=>{if(typeof printText==='function')printText('Vale '+v.n,giValeTxt(v));return false;}});};
A.giValeDesc=el=>{const v=giVales().find(x=>x.id===el.dataset.id);if(!v)return;modal('Descontar '+v.n,`<p>${esc(v.empName)} · saldo <b>${money(giValeSaldo(v))}</b></p><label for="gd-a">Importe a descontar ($)</label>${numIn('gd-a',giValeCuota(v))}<label for="gd-r">Referencia</label><input id="gd-r" maxlength="60" value="Liquidación ${esc(dmy(dkey(now())))}">`,
 {okText:'Descontar',onOk:w=>{const r=giValeDesc(v.id,cents(val('gd-a')),val('gd-r'));if(r.err)return w._err(r.err),false;toast('Descontado '+money(r.a));rerender();}});};
A.giValeVoid=el=>{const v=giVales().find(x=>x.id===el.dataset.id);if(!v)return;modal('Anular '+v.n,`<p>${v.movId?'El empleado devuelve <b>'+money(v.amount)+'</b> en efectivo y entra a la caja abierta.':'No mueve caja.'}</p><label for="gx-w">Motivo</label><input id="gx-w" maxlength="120">`,
 {okText:'Anular',onOk:w=>{const r=giValeVoid(v.id,val('gx-w'));if(r.err)return w._err(r.err),false;toast('Vale anulado');rerender();}});};
A.giValeLiq=()=>{const D=giValeDue();if(!D.length)return toast('No hay cuotas para descontar.',1);
 confirmBox('Registrar descuentos de la liquidación',`Se descuenta la cuota de cada vale pendiente:<br>${D.map(d=>esc(d.name)+': <b>'+money(d.total)+'</b>').join('<br>')}`,()=>{const ref='Liquidación '+dmy(dkey(now()));let n=0;D.forEach(d=>d.vales.forEach(x=>{if(!giValeDesc(x.id,x.c,ref).err)n++;}));audit('VALES_LIQUIDACION',ref+' · '+n+' descuento(s)');toast(n+' descuento(s) registrados');rerender();},'Registrar');};
reg('vales','Vales del personal','users','staff',()=>{const L=giVales().slice().reverse();const D=giValeDue();const pend=giVales().filter(v=>v.state==='pendiente');
 return`<div class="row"><h1 class="sp">Vales y adelantos del personal</h1><button class="btn gold" data-act="giValeNew">+ Nuevo vale</button></div>
 <p class="mut">Adelantos de sueldo, consumos en el local y préstamos en cuotas. Cada vale lo confirma el empleado (con su PIN o firma) y se descuenta en la liquidación.</p>
 <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:.8rem"><div class="card"><div class="sm mut">Saldo total a descontar</div><div class="total">${money(pend.reduce((a,v)=>a+giValeSaldo(v),0))}</div></div><div class="card"><div class="sm mut">Vales pendientes</div><div class="total">${pend.length}</div></div><div class="card"><div class="sm mut">Próxima liquidación</div><div class="total">${money(D.reduce((a,d)=>a+d.total,0))}</div></div></div>
 ${D.length?`<div class="card" style="margin-top:1rem"><div class="row"><h3 class="sp" style="margin:0">A descontar en la próxima liquidación</h3><button class="btn" data-act="giValeLiq">Registrar descuentos</button></div><div class="tw"><table data-nosort><thead><tr><th>Empleado</th><th>Vales</th><th class="r">A descontar</th></tr></thead><tbody>${D.map(d=>`<tr><td>${esc(d.name)}</td><td>${d.vales.map(x=>esc(x.n)).join(', ')}</td><td class="r">${money(d.total)}</td></tr>`).join('')}</tbody></table></div><p class="sm mut">El recibo de sueldo legal lo hace el contador: esto informa los descuentos [VERIFICAR con el contador].</p></div>`:''}
 <h3>Todos los vales</h3><div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Empleado</th><th>Tipo</th><th class="r">Importe</th><th class="r">Saldo</th><th>Estado</th><th></th></tr></thead><tbody>
 ${L.map(v=>`<tr><td>${esc(v.n)}</td><td>${fmtDT(v.ts)}</td><td>${esc(v.empName)}</td><td>${esc(GI_VT[v.tipo])}${v.cuotas>1?' ('+v.cuotas+' cuotas)':''}</td><td class="r">${money(v.amount)}</td><td class="r">${money(giValeSaldo(v))}</td><td><span class="tag ${v.state==='saldado'?'ok':v.state==='anulado'?'bad':'warn'}">${v.state==='pendiente'?'Pendiente':v.state==='saldado'?'Saldado':'Anulado'}</span></td>
 <td class="r"><button class="btn sm" data-act="giValePrint" data-id="${v.id}">Comprobante</button>${v.state==='pendiente'?` <button class="btn sm" data-act="giValeDesc" data-id="${v.id}">Descontar</button>${(v.desc||[]).length?'':` <button class="btn sm red" data-act="giValeVoid" data-id="${v.id}">Anular</button>`}`:''}</td></tr>`).join('')||'<tr><td colspan="8" class="mut">Sin vales.</td></tr>'}</tbody></table></div>`;},null,'Equipo');
SCREENS.vales.show=()=>giOn('hr_vales');

/* ---------- Avisos en Caja: tickets en espera antes de cerrar ---------- */
{const _sp=showPanel;showPanel=function(){const r=_sp.apply(this,arguments);try{if(['arqueo','caja'].includes(curScreen)&&giOn('pos_hold')){const n=giHoldsHere().length;const v=$('#view');
 if(n&&v&&!v.querySelector('#gi-holdw'))v.insertAdjacentHTML('afterbegin',`<div class="warnbox" id="gi-holdw">Hay <b>${n}</b> ticket(s) en espera en esta caja (${money(giHoldsHere().reduce((a,h)=>a+h.total,0))}). No son ventas ni dinero: retomalos en Vender o descartalos antes de cerrar.</div>`);}}catch(e){}return r;};}

/* ---------- Arranque: verificador por dirección y datos de ejemplo de la demo ---------- */
function giDemoSeed(){if(IS_CLIENT||!S||!S.cfg||S.giDemo)return;S.giDemo=1;
 const c=giCfg();GI_MODS.forEach(m=>{if(c[m.k]===undefined)c[m.k]=1;});if(!S.cfg.plan)S.cfg.plan='total';
 const P=S.products.filter(p=>p.active!==false&&!p.archived&&p.unit==='u'&&p.price>0&&!(typeof isKit==='function'&&isKit(p)));
 S.priceSnap=null;giPriceDiff();if(!P.length)return;
 /* historial de 60 días: dos aumentos de proveedor en 8 artículos; la mitad ya tiene la etiqueta impresa */
 const d=86400000,t=now();const r10=x=>Math.max(1000,Math.round(x/1000)*1000);
 P.slice(0,8).forEach((p,i)=>{const p2=p.price,p1=r10(p2/1.06),p0=r10(p1/1.08);const c2=p.cost||0,c1=Math.round(c2/1.06),c0=Math.round(c1/1.08);
  giLog().push({id:uid(),ts:t-58*d+i*3600e3,pid:p.id,name:pfull(p),f:'cost',from:c0,to:c1,origin:'Compra a proveedor (ejemplo)',user:'ejemplo'},
   {id:uid(),ts:t-57*d+i*3600e3,pid:p.id,name:pfull(p),f:'price',from:p0,to:p1,origin:'Actualización masiva (ejemplo)',user:'ejemplo'},
   {id:uid(),ts:t-12*d+i*3600e3,pid:p.id,name:pfull(p),f:'cost',from:c1,to:c2,origin:'Compra a proveedor (ejemplo)',user:'ejemplo'},
   {id:uid(),ts:t-11*d+i*3600e3,pid:p.id,name:pfull(p),f:'price',from:p1,to:p2,origin:'Inventario (ejemplo)',user:'ejemplo'});
  if(i%2===0)giLblTs()[p.id]=t-10*d;});
 /* tres tickets en espera en la caja actual */
 const ln=(p,q)=>({pid:p.id,name:pfull(p),rubro:p.rubro,qty:q,price:p.price,cost:p.cost,unit:p.unit,list:p.price});
 [[0,2,'Cliente que fue a buscar la billetera'],[3,6,'Pedido telefónico (ejemplo)'],[5,1,'']].forEach(([a,q,nt],i)=>{const L=[ln(P[a%P.length],q),ln(P[(a+1)%P.length],1)];S.seqH=(S.seqH||0)+1;
  giHolds().push({id:uid(),n:'E-'+S.seqH,ts:t-(40-i*12)*60000,user:'ejemplo',caja:S.tenant.caja,lines:L,cust:'',custName:'',method:'efectivo',arca:false,coupon:'',chanSet:null,quote:'',note:nt,total:L.reduce((x,l)=>x+lineTotal(l),0),demo:true});});
 /* vales de ejemplo (sin mover la caja: son de días anteriores) */
 const E=(S.employees||[]).filter(e=>e.active);if(E.length){S.seqV=(S.seqV||0);
  const mk=(e,tipo,amt,cu,days,desc)=>{S.seqV++;const v={id:uid(),n:'V-'+S.seqV,ts:t-days*d,user:'ejemplo',emp:e.id,empName:e.name,tipo,amount:amt,cuotas:cu,cuotaAmt:Math.ceil(amt/cu),note:'Ejemplo',movId:'',sessId:'',conf:'PIN del empleado',desc:[],state:'pendiente',demo:true};
   (desc||[]).forEach(x=>v.desc.push({id:uid(),ts:t-x*d,amount:v.cuotaAmt,user:'ejemplo',ref:'Liquidación (ejemplo)'}));giVales().push(v);};
  mk(E[0],'adelanto',3000000,1,6);mk(E[E.length>1?1:0],'prestamo',6000000,3,35,[5]);mk(E[0],'consumo',450000,1,2);}}
{const _rt=route;route=function(){try{if(S&&S.cfg&&!S.giDemo&&!IS_CLIENT)giDemoSeed();}catch(e){console.warn('giDemoSeed',e);}
 if(location.hash==='#verificador'&&S&&S.cfg){if(giOn('kiosk')){user=null;giKioskShow();return;}location.hash='#acceso';return;}
 const k=$('#gi-kiosk');if(k){if(S&&S.kioskOn&&!user){location.hash='#verificador';return;}k.remove();}
 return _rt.apply(this,arguments);};}
window.addEventListener('hashchange',()=>{if(location.hash==='#verificador'&&S&&S.cfg&&giOn('kiosk')){user=null;giKioskShow();}});
/* «Borrar todo y empezar vacío» (Kini) también vacía lo de este módulo; «Volver a los ejemplos» lo vuelve a sembrar */
if(typeof A.emptyDemo==='function'){const _ed=A.emptyDemo;A.emptyDemo=function(){const r=_ed.apply(this,arguments);const mr=$('#modal-root');const ok=mr&&mr.querySelector('.ov:last-child [data-m=ok]');
 if(ok)ok.addEventListener('click',()=>{S.holds=[];S.vales=[];S.priceLog=[];S.priceBatches=[];S.lblTs={};S.priceSnap=null;save();},{once:true,capture:true});return r;};}
