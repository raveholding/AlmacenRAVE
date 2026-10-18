/* ===== V26 · 4.14 Cajas flexibles, caja principal y multisucursal =====
   Perfil de operación por comercio (cfg.cashProfile): simple (por defecto, igual que siempre) · multi · main · branches.
   · Una sola fuente de verdad: las SESIONES de caja de siempre (turnos) llevan regId/branchId; no hay un segundo libro de caja.
   · Traspasos entre cajas (ctransf): un único registro con importe entero en centavos, rubro obligatorio y las dos sesiones
     vinculadas. NO se cuentan como ingreso ni egreso en los consolidados (no hay doble conteo): sólo mueven el efectivo
     esperado de cada sesión. Se escriben una vez; se corrigen con un traspaso inverso vinculado (nunca se editan).
   · El consolidado es de LECTURA: no mueve efectivo ni toca cierres sellados.
   · Aislamiento por sucursal en el servidor: PENDIENTE (hoy los miembros ven todas las sucursales del comercio). */
const CASH_PROFILES={simple:'Simple · una caja por equipo',multi:'Varias cajas',main:'Varias cajas + caja principal',branches:'Multisucursal (cajas + principal por sucursal)'};
const CASH_DESC={simple:'Como siempre: cada equipo tiene su caja. No se muestra ninguna pantalla extra.',
 multi:'Definís cajas (por equipo, turno, responsable o sector). Cada apertura se asigna a una caja y hay un consolidado de lectura.',
 main:'Además de las cajas operativas hay una caja principal que recibe fondos por traspasos registrados (nunca se suman dos veces).',
 branches:'Agrega sucursales: cada caja pertenece a una sucursal y el consolidado se ve por sucursal y total. El aislamiento de datos por sucursal en el servidor está pendiente: hoy todo el equipo ve todas las sucursales.'};
const cashProfile=()=>(S.cfg&&S.cfg.cashProfile)||'simple';
const cashOn=()=>cashProfile()!=='simple';
const mainOn=()=>cashProfile()==='main'||cashProfile()==='branches';
const brOn=()=>cashProfile()==='branches';
const regOf=id=>(S.registers||[]).find(r=>r.id===id);
const brOf=id=>(S.branches||[]).find(b=>b.id===id);
const regName=id=>{const r=regOf(id);return r?r.name:'(caja eliminada)';};
function transfersFor(sess){const o={tin:0,tout:0,list:[]};if(!sess||!S.transfers)return o;
 S.transfers.forEach(t=>{if(t.toSess===sess.id){o.tin+=t.amount;o.list.push({ts:t.ts,dir:'in',other:regName(t.from),amount:t.amount,motivo:t.motivo,rubro:t.rubroName||''});}
  if(t.fromSess===sess.id){o.tout+=t.amount;o.list.push({ts:t.ts,dir:'out',other:regName(t.to),amount:t.amount,motivo:t.motivo,rubro:t.rubroName||''});}});return o;}
/* --- apertura de sesión con caja asignada --- */
function cashOpenPick(){if(!cashOn())return'';const rs=(S.registers||[]).filter(r=>r.active!==false);
 if(!rs.length)return`<p class="errtxt">No hay cajas definidas. ${can('config')?'Creá una en <a href="#panel/cajasx">Cajas y sucursales</a>.':'Pedile al administrador que defina las cajas.'}</p>`;
 const free=rs.filter(r=>!S.sessions.some(s=>!s.closedAt&&s.regId===r.id));
 return`<label for="ap-reg">Caja a abrir</label><select id="ap-reg">${rs.map(r=>`<option value="${r.id}" ${(S.tenant.regId===r.id)?'selected':''} ${free.includes(r)?'':'disabled'}>${esc(r.name)}${r.type==='main'?' (principal)':''}${brOn()&&r.branchId?' · '+esc((brOf(r.branchId)||{}).name||''):''}${free.includes(r)?'':' · ya abierta'}</option>`).join('')}</select>`;}
function cashOpenCheck(){if(!cashOn())return{extra:{}};const id=val('ap-reg')||S.tenant.regId;const r=regOf(id);
 if(!r||r.active===false)return{err:'Elegí la caja que vas a abrir.'};
 if(S.sessions.some(s=>!s.closedAt&&s.regId===r.id))return{err:'Esa caja ya está abierta en otro equipo.'};
 return{extra:{regId:r.id,regName:r.name,branchId:r.branchId||''}};}
const cashHdr=s=>s&&s.regName?` · ${esc(s.regName)}`:'';
/* --- tarjeta en Configuración (sólo admin) --- */
function cashCfgCard(){const pr=cashProfile();
 return`<div class="card" style="margin-top:1rem"><h3>Cajas y sucursales</h3><p class="sm mut">Perfil de operación. El modo simple es el de siempre y no agrega pantallas. Cambiar el perfil no borra ni mueve datos anteriores ni toca cierres sellados.</p>
 <label for="cx-p">Perfil</label><select id="cx-p">${Object.entries(CASH_PROFILES).map(([k,v])=>`<option value="${k}" ${pr===k?'selected':''}>${esc(v)}</option>`).join('')}</select>
 <p class="sm mut" id="cx-d">${esc(CASH_DESC[pr])}</p>
 <div class="row"><button class="btn gold" data-act="cashProfileSave">Aplicar perfil</button>${cashOn()?'<button class="btn" data-act="nav" data-id="cajasx">Abrir «Cajas y sucursales»</button>':''}</div></div>`;}
document.addEventListener('change',e=>{if(e.target&&e.target.id==='cx-p'){const d=$('#cx-d');if(d)d.textContent=CASH_DESC[e.target.value]||'';}});
A.cashProfileSave=()=>{if(!can('config'))return toast('Sólo el administrador',1);const nv=val('cx-p'),ov=cashProfile();if(!CASH_PROFILES[nv])return;if(nv===ov)return toast('Ya está en ese perfil');
 modal('Cambiar perfil de cajas',`<p>De <b>${esc(CASH_PROFILES[ov])}</b> a <b>${esc(CASH_PROFILES[nv])}</b>.</p><p class="sm">No se borra ni se mueve nada: las sesiones y cierres anteriores quedan como estaban${nv==='simple'?'; las cajas y traspasos que definiste se conservan guardados pero dejan de usarse':''}.</p>${S.sessions.some(s=>!s.closedAt)?'<p class="warnbox">Hay una caja abierta. Seguirá abierta con su configuración actual.</p>':''}`,
 {okText:'Cambiar perfil',onOk:()=>{S.cfg.cashProfile=nv;
  if(nv!=='simple'&&!(S.registers||[]).length){S.registers=S.registers||[];const r={id:uid(),code:String(S.tenant.caja),name:'Caja '+S.tenant.caja,type:'operational',branchId:'',parentId:'',active:true,created:now()};S.registers.push(r);S.tenant.regId=r.id;}
  if(nv==='branches'&&!(S.branches||[]).length){S.branches=S.branches||[];const b={id:uid(),code:'1',name:'Casa central',active:true};S.branches.push(b);(S.registers||[]).forEach(r=>{if(!r.branchId)r.branchId=b.id;});}
  audit('CAJA_PERFIL',ov+' → '+nv);save();rerender();toast('Perfil aplicado');}});};
/* --- alta / edición de cajas y sucursales (admin) --- */
A.regEdit=el=>{if(!can('config'))return toast('Sólo el administrador',1);const r=el&&el.dataset.id?regOf(el.dataset.id):null;
 const brs=(S.branches||[]).filter(b=>b.active!==false);const mains=(S.registers||[]).filter(x=>x.type==='main'&&x.active!==false&&(!r||x.id!==r.id));
 modal(r?'Editar caja':'Nueva caja',`<label for="rg-n">Nombre</label><input id="rg-n" maxlength="40" value="${esc(r?r.name:'')}" autocomplete="off">
 <label for="rg-c">Código (único)</label><input id="rg-c" maxlength="12" value="${esc(r?r.code:'')}" autocomplete="off">
 <label for="rg-t">Tipo</label><select id="rg-t"><option value="operational" ${!r||r.type!=='main'?'selected':''}>Operativa (vende y cobra)</option>${mainOn()?`<option value="main" ${r&&r.type==='main'?'selected':''}>Principal (recibe fondos por traspaso)</option>`:''}</select>
 ${brOn()?`<label for="rg-b">Sucursal</label><select id="rg-b"><option value="">— Elegí —</option>${brs.map(b=>`<option value="${b.id}" ${r&&r.branchId===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select>`:''}
 ${mainOn()?`<label for="rg-p">Depende de la caja principal (opcional)</label><select id="rg-p"><option value="">— Ninguna —</option>${mains.map(m=>`<option value="${m.id}" ${r&&r.parentId===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select>`:''}`,
 {okText:'Guardar',onOk:w=>{const name=val('rg-n').trim(),code=val('rg-c').trim(),type=val('rg-t')||'operational',bid=brOn()?val('rg-b'):'',par=mainOn()?val('rg-p'):'';
  if(!name)return w._err('Falta el nombre.'),false;if(!code)return w._err('Falta el código.'),false;
  if((S.registers||[]).some(x=>x.code.toLowerCase()===code.toLowerCase()&&(!r||x.id!==r.id)))return w._err('Ya hay una caja con ese código.'),false;
  if(brOn()&&!bid)return w._err('Elegí la sucursal de la caja.'),false;
  if(type==='main'&&(S.registers||[]).some(x=>x.type==='main'&&x.active!==false&&(x.branchId||'')===(bid||'')&&(!r||x.id!==r.id)))return w._err('Ya hay una caja principal'+(brOn()?' en esa sucursal':'')+'.'),false;
  if(par){const pm=regOf(par);if(!pm||pm.type!=='main')return w._err('La caja de la que depende debe ser principal.'),false;if(type==='main')return w._err('Una caja principal no depende de otra.'),false;if(brOn()&&(pm.branchId||'')!==bid)return w._err('La caja principal debe ser de la misma sucursal.'),false;}
  if(r&&r.type==='main'&&type!=='main'&&(S.registers||[]).some(x=>x.parentId===r.id))return w._err('Hay cajas que dependen de esta principal: cambialas primero.'),false;
  const d={name,code,type,branchId:bid,parentId:type==='main'?'':par};
  if(r){Object.assign(r,d);audit('CAJA_EDITAR',name);}else{S.registers=S.registers||[];S.registers.push(Object.assign({id:uid(),active:true,created:now()},d));audit('CAJA_ALTA',name+' · '+type);}
  save();rerender();toast('Caja guardada');}});};
A.regToggle=el=>{if(!can('config'))return toast('Sólo el administrador',1);const r=regOf(el.dataset.id);if(!r)return;
 if(r.active!==false){if(S.sessions.some(s=>!s.closedAt&&s.regId===r.id))return toast('Está abierta: cerrá la caja antes de desactivarla.',1);if((S.registers||[]).some(x=>x.parentId===r.id&&x.active!==false))return toast('Hay cajas que dependen de esta principal.',1);r.active=false;}else{r.active=true;}
 audit('CAJA_ESTADO',r.name+' '+(r.active?'activa':'inactiva'));save();rerender();};
A.brEdit=el=>{if(!can('config'))return toast('Sólo el administrador',1);const b=el&&el.dataset.id?brOf(el.dataset.id):null;
 modal(b?'Editar sucursal':'Nueva sucursal',`<label for="br-n">Nombre</label><input id="br-n" maxlength="40" value="${esc(b?b.name:'')}" autocomplete="off"><label for="br-c">Código (único)</label><input id="br-c" maxlength="12" value="${esc(b?b.code:'')}" autocomplete="off">`,
 {okText:'Guardar',onOk:w=>{const name=val('br-n').trim(),code=val('br-c').trim();if(!name||!code)return w._err('Completá nombre y código.'),false;
  if((S.branches||[]).some(x=>x.code.toLowerCase()===code.toLowerCase()&&(!b||x.id!==b.id)))return w._err('Ya hay una sucursal con ese código.'),false;
  if(b){Object.assign(b,{name,code});audit('SUCURSAL_EDITAR',name);}else{S.branches=S.branches||[];S.branches.push({id:uid(),name,code,active:true});audit('SUCURSAL_ALTA',name);}save();rerender();}});};
A.brToggle=el=>{if(!can('config'))return toast('Sólo el administrador',1);const b=brOf(el.dataset.id);if(!b)return;
 if(b.active!==false&&(S.registers||[]).some(r=>r.branchId===b.id&&r.active!==false))return toast('Tiene cajas activas: desactivalas primero.',1);b.active=b.active===false;audit('SUCURSAL_ESTADO',b.name);save();rerender();};
A.devReg=()=>{if(!can('config'))return;const id=val('dv-reg');if(id&&!regOf(id))return;if(id&&S.sessions.some(s=>!s.closedAt&&s.caja===S.tenant.caja&&s.regId&&s.regId!==id))return toast('Cerrá la caja abierta de este equipo antes de cambiarla.',1);S.tenant.regId=id;audit('CAJA_EQUIPO',regName(id));save();rerender();toast('Listo');};
/* --- traspaso de fondos entre cajas --- */
function openOf(regId){return S.sessions.find(s=>!s.closedAt&&s.regId===regId);}
function xferCreate(o){ /* lógica pura (la usa el modal y las pruebas) */
 if(!mainOn())return'El módulo de caja principal no está habilitado.';if(!can('close_cash'))return'Sin permiso para traspasar fondos.';
 if((S.transfers||[]).some(t=>t.id===o.id))return'';  /* idempotente: el mismo id no se repite */
 if(!o.from||!o.to||o.from===o.to)return'Elegí dos cajas distintas.';const fr=regOf(o.from),to=regOf(o.to);if(!fr||!to||fr.active===false||to.active===false)return'Caja inexistente o inactiva.';
 const ss=openOf(o.from),ts=openOf(o.to);if(!ss||!ts)return'Las dos cajas tienen que estar abiertas para traspasar.';
 if(brOn()&&(fr.branchId||'')!==(to.branchId||'')&&fr.type!=='main'&&to.type!=='main')return'Entre sucursales distintas sólo se traspasa desde o hacia una caja principal.';
 if(!Number.isInteger(o.amount)||!(o.amount>0))return'El importe debe ser mayor a cero.';
 const e=validRubro(o.rubro,'ingreso')||validRubro(o.rubro,'egreso');if(e)return e;
 if(!o.motivo||o.motivo.trim().length<3)return'Escribí el motivo (mínimo 3 letras).';
 const a=arqueoCalc(ss,arqInputs(ss));if(o.amount>a.expectedCash&&!o.force)return'La caja de origen no tiene efectivo suficiente (esperado '+money(a.expectedCash)+').';
 const t={id:o.id,ts:now(),from:o.from,to:o.to,fromSess:ss.id,toSess:ts.id,amount:o.amount,rubro:o.rubro,rubroName:rubName(o.rubro),motivo:o.motivo.trim().slice(0,120),user:user.name};if(o.rev)t.rev=o.rev;
 S.transfers=S.transfers||[];S.transfers.push(t);audit(o.rev?'TRASPASO_REVERSA':'TRASPASO_CAJAS',regName(o.from)+' → '+regName(o.to)+' · '+money(o.amount)+' · '+rubName(o.rubro)+' · '+t.motivo);emit('cash.transfer',{from:o.from,to:o.to,amount:o.amount});save();return'';}
A.xfer=el=>{if(!mainOn()||!can('close_cash'))return toast('Sin permiso o módulo apagado',1);
 const op=(S.registers||[]).filter(r=>r.active!==false&&openOf(r.id));if(op.length<2)return toast('Hacen falta dos cajas abiertas para traspasar.',1);
 const id=uid(),rb=S.rubros.filter(r=>r.kind==='rubro');const myReg=S.tenant.regId;
 modal('Traspasar fondos entre cajas',`<label for="xf-f">Desde</label><select id="xf-f">${op.map(r=>`<option value="${r.id}" ${r.id===myReg?'selected':''}>${esc(r.name)}</option>`).join('')}</select>
 <label for="xf-t">Hacia</label><select id="xf-t">${op.map(r=>`<option value="${r.id}" ${r.type==='main'?'selected':''}>${esc(r.name)}</option>`).join('')}</select>
 <label for="xf-a">Importe ($)</label>${numIn('xf-a',0,'0')}
 <label for="xf-r">Rubro (obligatorio)</label><select id="xf-r"><option value="">— Elegí un rubro —</option>${rb.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>
 <label for="xf-m">Motivo</label><input id="xf-m" maxlength="120" placeholder="Ej.: retiro de excedente a caja principal" autocomplete="off">
 <p class="sm mut">Es un movimiento interno: sale del efectivo esperado de una caja y entra en el de la otra. No suma como venta, ingreso ni egreso.</p>`,
 {okText:'Traspasar',onOk:w=>{const e=xferCreate({id,from:val('xf-f'),to:val('xf-t'),amount:cents(val('xf-a')),rubro:val('xf-r'),motivo:val('xf-m')});if(e){w._err(e);return false;}toast('Traspaso registrado');rerender();}});};
A.xferRev=el=>{if(!can('config'))return toast('Sólo el administrador corrige traspasos',1);const t=(S.transfers||[]).find(x=>x.id===el.dataset.id);if(!t)return;
 if(S.transfers.some(x=>x.rev===t.id))return toast('Ya fue revertido',1);
 const e=xferCreate({id:uid(),from:t.to,to:t.from,amount:t.amount,rubro:t.rubro,motivo:'Reversa: '+t.motivo,rev:t.id,force:true});if(e)return toast(e,1);toast('Reversa registrada');rerender();};
/* --- consolidado de lectura --- */
function cashRows(day,brFilter){
 const inDay=s=>dkey(s.openedAt)===day||!s.closedAt||(s.closedAt&&dkey(s.closedAt)===day);
 const regs=(S.registers||[]).filter(r=>!brFilter||r.branchId===brFilter);const rows=[];
 const calc=s=>{const a=arqueoCalc(s,arqInputs(s));const k=S.closures.find(c=>c.sessId===s.id);return{s,a,diff:k?k.data.diff:null};};
 regs.forEach(r=>{const ss=S.sessions.filter(s=>s.regId===r.id&&inDay(s)).map(calc);
  rows.push({r,ss,n:ss.length,sales:ss.reduce((x,c)=>x+c.a.total,0),cash:ss.reduce((x,c)=>x+c.a.cashSales,0),ing:ss.reduce((x,c)=>x+c.a.ing,0),egr:ss.reduce((x,c)=>x+c.a.egr,0),
   tin:ss.reduce((x,c)=>x+c.a.tin,0),tout:ss.reduce((x,c)=>x+c.a.tout,0),exp:ss.filter(c=>!c.s.closedAt).reduce((x,c)=>x+c.a.expectedCash,0),open:ss.some(c=>!c.s.closedAt)});});
 return rows;}
reg('cajasx','Cajas y sucursales','cash','close_cash',()=>{
 const day=cxF.day||dkey(now());const brs=(S.branches||[]).filter(b=>b.active!==false);const f=brOn()?cxF.br:'';
 const rows=cashRows(day,f);const adm=can('config');const T=k=>rows.reduce((x,r)=>x+r[k],0);
 const legacy=S.sessions.filter(s=>!s.regId&&(dkey(s.openedAt)===day||!s.closedAt)).map(s=>arqueoCalc(s,arqInputs(s)));
 const rowHtml=r=>`<tr><td><b>${esc(r.r.name)}</b>${r.r.type==='main'?' <span class="tag warn">principal</span>':''}${r.r.active===false?' <span class="tag bad">inactiva</span>':''}</td>${brOn()?`<td>${esc((brOf(r.r.branchId)||{}).name||'—')}</td>`:''}<td>${r.open?'<span class="tag ok">abierta</span>':(r.n?'cerrada':'—')}</td><td class="r">${money(r.sales)}</td><td class="r">${money(r.ing)}</td><td class="r">${money(r.egr)}</td><td class="r">${money(r.tin)}</td><td class="r">${money(r.tout)}</td><td class="r">${r.open?money(r.exp):'—'}</td></tr>`;
 const tbl=`<div class="tw"><table id="cx-res"><thead><tr><th>Caja</th>${brOn()?'<th>Sucursal</th>':''}<th>Estado</th><th class="r">Ventas</th><th class="r">Ingresos</th><th class="r">Egresos</th><th class="r">Traspasos recibidos</th><th class="r">Traspasos enviados</th><th class="r">Efectivo esperado (abiertas)</th></tr></thead><tbody>${rows.map(rowHtml).join('')||`<tr><td colspan="${brOn()?9:8}" class="mut">No hay cajas definidas.</td></tr>`}</tbody>
  <tfoot><tr><th>TOTAL consolidado</th>${brOn()?'<th></th>':''}<th></th><th class="r">${money(T('sales'))}</th><th class="r">${money(T('ing'))}</th><th class="r">${money(T('egr'))}</th><th class="r">${money(T('tin'))}</th><th class="r">${money(T('tout'))}</th><th class="r">${money(T('exp'))}</th></tr></tfoot></table></div>`;
 const tr=(S.transfers||[]).slice().reverse();const regsAll=(S.registers||[]).slice();
 return`<div class="row"><h1 class="sp">Cajas y sucursales</h1>${mainOn()&&can('close_cash')?'<button class="btn gold" data-act="xfer">Traspasar fondos</button>':''}</div>
 <p class="sm mut">Perfil: <b>${esc(CASH_PROFILES[cashProfile()])}</b>. Consolidado de <b>lectura</b>: no mueve efectivo ni toca cierres. Los traspasos entre cajas se muestran aparte y no se suman como ingreso ni egreso.</p>
 <div class="card"><div class="row"><h3 class="sp">Consolidado del día</h3><label class="sm" for="cx-day">Día</label><input type="date" id="cx-day" value="${day}" style="max-width:170px">${brOn()?`<label class="sm" for="cx-br">Sucursal</label><select id="cx-br" style="max-width:220px"><option value="">Todas</option>${brs.map(b=>`<option value="${b.id}" ${cxF.br===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select>`:''}</div>${tbl}
 ${legacy.length?`<p class="sm mut">Hay ${legacy.length} sesión(es) de antes del cambio de perfil, sin caja asignada: no están en esta tabla (siguen en «Cajas cerradas»).</p>`:''}
 <p class="sm mut">Fórmula: efectivo esperado = apertura + ventas en efectivo + ingresos − egresos − pagos de caja + traspasos recibidos − traspasos enviados. Zona horaria del comercio. Actualizado ${fmtDT(now())}.</p></div>
 <div class="card" style="margin-top:1rem"><div class="row"><h3 class="sp">Cajas</h3>${adm?'<button class="btn sm" data-act="regEdit" data-id="">+ Caja</button>':''}</div>
 <div class="tw"><table><thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th>${brOn()?'<th>Sucursal</th>':''}<th>Depende de</th><th>Estado</th><th></th></tr></thead><tbody>${regsAll.map(r=>`<tr><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${r.type==='main'?'principal':'operativa'}</td>${brOn()?`<td>${esc((brOf(r.branchId)||{}).name||'—')}</td>`:''}<td>${esc(r.parentId?regName(r.parentId):'—')}</td><td>${r.active===false?'<span class="tag bad">inactiva</span>':'<span class="tag ok">activa</span>'}</td><td class="r">${adm?`<button class="btn sm" data-act="regEdit" data-id="${r.id}">Editar</button> <button class="btn sm" data-act="regToggle" data-id="${r.id}">${r.active===false?'Activar':'Desactivar'}</button>`:''}</td></tr>`).join('')||`<tr><td colspan="7" class="mut">Sin cajas.</td></tr>`}</tbody></table></div>
 ${adm?`<div class="row" style="margin-top:.7rem"><label for="dv-reg" class="sm">Este equipo opera la caja</label><select id="dv-reg" style="max-width:260px"><option value="">— Elegir al abrir —</option>${regsAll.filter(r=>r.active!==false).map(r=>`<option value="${r.id}" ${S.tenant.regId===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select><button class="btn sm" data-act="devReg">Guardar</button></div>`:''}</div>
 ${brOn()?`<div class="card" style="margin-top:1rem"><div class="row"><h3 class="sp">Sucursales</h3>${adm?'<button class="btn sm" data-act="brEdit" data-id="">+ Sucursal</button>':''}</div><div class="tw"><table><thead><tr><th>Código</th><th>Nombre</th><th>Estado</th><th></th></tr></thead><tbody>${(S.branches||[]).map(b=>`<tr><td>${esc(b.code)}</td><td>${esc(b.name)}</td><td>${b.active===false?'<span class="tag bad">inactiva</span>':'<span class="tag ok">activa</span>'}</td><td class="r">${adm?`<button class="btn sm" data-act="brEdit" data-id="${b.id}">Editar</button> <button class="btn sm" data-act="brToggle" data-id="${b.id}">${b.active===false?'Activar':'Desactivar'}</button>`:''}</td></tr>`).join('')||'<tr><td colspan="4" class="mut">Sin sucursales.</td></tr>'}</tbody></table></div></div>`:''}
 ${mainOn()?`<div class="card" style="margin-top:1rem"><h3>Traspasos entre cajas</h3><div class="tw"><table><thead><tr><th>Fecha</th><th>Desde</th><th>Hacia</th><th class="r">Importe</th><th>Rubro</th><th>Motivo</th><th>Usuario</th><th>Estado</th><th></th></tr></thead><tbody>${tr.map(t=>{const rv=(S.transfers||[]).some(x=>x.rev===t.id);return`<tr><td data-sv="${t.ts}">${fmtDT(t.ts)}</td><td>${esc(regName(t.from))}</td><td>${esc(regName(t.to))}</td><td class="r">${money(t.amount)}</td><td>${esc(t.rubroName||'')}</td><td>${esc(t.motivo)}</td><td>${esc(t.user)}</td><td>${t.rev?'<span class="tag warn">reversa</span>':(rv?'<span class="tag bad">revertido</span>':'<span class="tag ok">ok</span>')}</td><td class="r">${adm&&!t.rev&&!rv?`<button class="btn sm" data-act="xferRev" data-id="${t.id}">Revertir</button>`:''}</td></tr>`;}).join('')||'<tr><td colspan="9" class="mut">Sin traspasos.</td></tr>'}</tbody></table></div></div>`:''}`;},
 ()=>{const d=$('#cx-day');d&&d.addEventListener('change',e=>{cxF.day=e.target.value;rerender();});const b=$('#cx-br');b&&b.addEventListener('change',e=>{cxF.br=e.target.value;rerender();});},'Operación');
const cxF={day:'',br:''};
SCREENS.cajasx.show=cashOn;
