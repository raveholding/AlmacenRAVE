/* ===== V27.28 · Kit de acciones CRUD del Sistema VB =====
   Una sola forma de agregar, editar, borrar y deshacer en todo el sistema:
   · Botones de fila con íconos y tooltip: ✏️ Editar (lápiz) y 🗑 Borrar (tacho, se pone rojo al pasar).
     Los botones de texto «Editar», «Eliminar», «Borrar» o «Quitar» de las tablas se convierten solos.
   · Borrado sin confirmaciones que frenan: el registro desaparece al instante y aparece abajo
     «Registro eliminado · ↶ Deshacer» durante 6 segundos (también Ctrl/Cmd + Z). Deshacer lo vuelve
     a su posición exacta. Los borrados con consecuencias fiscales o de dinero siguen pidiendo confirmación.
   · Selección múltiple: casillas por fila y barra flotante «N seleccionados · Eliminar».
   · Esc cierra modales y paneles.
   Se aplica a Cajas y sucursales, tareas de la Agenda, preventistas y reglas de reposición, y la
   normalización visual a todas las tablas. Los datos borrados viajan a la nube como borrados; deshacer
   los vuelve a subir. */

/* ---------- 1) Íconos ---------- */
const VB_IC={edit:'<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
 del:'<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
 undo:'<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>'};
/* botón de fila estándar: vbBtn('edit','regEdit',id,'Editar caja') */
const vbBtn=(k,act,id,lbl,extra)=>`<button type="button" class="vb-ib vb-${k}" data-act="${act}" data-id="${esc(id)}" title="${esc(lbl)}" aria-label="${esc(lbl)}" ${extra||''}>${VB_IC[k]}</button>`;

/* ---------- 2) Deshacer ---------- */
let vbUndoQ=[];
/* quita ítems de un arreglo de S y deja la marcha atrás lista. o: {key|get, ids, label, audit, after} */
function vbRemove(o){const arr=o.get?o.get():(S[o.key]||[]);const set=new Set(o.ids.map(String));const taken=[];
 for(let i=arr.length-1;i>=0;i--)if(set.has(String(arr[i].id))){taken.push({i,x:arr[i]});arr.splice(i,1);}
 if(!taken.length)return 0;taken.reverse();if(o.audit)audit(o.audit,(o.label||'')+' · '+taken.length+' registro(s)');save();if(o.after)try{o.after();}catch(e){}
 vbUndoPush({label:o.label||(taken.length>1?taken.length+' registros eliminados':'Registro eliminado'),undo:()=>{const a=o.get?o.get():(S[o.key]=S[o.key]||[]);taken.forEach(t=>{if(!a.some(y=>y.id===t.x.id))a.splice(Math.min(t.i,a.length),0,t.x);});if(o.audit)audit(o.audit+'_DESHECHO',(o.label||'')+' · '+taken.length);save();if(o.after)try{o.after();}catch(e){}}});
 return taken.length;}
function vbUndoPush(u){u.t=Date.now();vbUndoQ.push(u);vbUndoQ=vbUndoQ.slice(-10);vbSnack(u);}
function vbUndoLast(){const u=vbUndoQ.pop();if(!u||Date.now()-u.t>6500)return false;try{u.undo();}catch(e){return toast('No se pudo deshacer: '+(e.message||e),1),false;}const s=$('#vb-snack');if(s)s.remove();toast('Listo, se deshizo');return true;}
function vbSnack(u){let s=$('#vb-snack');if(s)s.remove();s=document.createElement('div');s.id='vb-snack';s.setAttribute('role','status');s.setAttribute('aria-live','polite');
 s.innerHTML=`<span>${esc(u.label)}</span><button type="button" class="vb-undo">${VB_IC.undo} Deshacer</button><i class="vb-bar"></i>`;document.body.appendChild(s);
 s.querySelector('.vb-undo').addEventListener('click',()=>{const i=vbUndoQ.indexOf(u);if(i<0)return;vbUndoQ.splice(i,1);vbUndoQ.push(u);u.t=Date.now();vbUndoLast();});
 clearTimeout(vbSnack._t);vbSnack._t=setTimeout(()=>{if(s.isConnected)s.remove();},6000);}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&(e.key==='z'||e.key==='Z')){const t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;if(vbUndoQ.length&&Date.now()-vbUndoQ[vbUndoQ.length-1].t<=6500){e.preventDefault();vbUndoLast();}}
 if(e.key==='Escape'){const b=$('.vb-bulk');if(b&&!$$('#modal-root .ov').length){vbBulkClear();}}});

/* ---------- 3) Selección múltiple ----------
   Una tabla se suma con data-bulk="tipo" en <table> y data-id en cada <tr> del cuerpo; VB_BULK[tipo] dice cómo borrar. */
const VB_BULK={};
function vbBulkScan(root){$$('table[data-bulk]',root).forEach(t=>{if(t._vbb)return;const tp=VB_BULK[t.dataset.bulk];if(!tp||(tp.can&&!tp.can()))return;t._vbb=1;
 const hr=t.tHead&&t.tHead.rows[0];if(hr)hr.insertAdjacentHTML('afterbegin','<th class="vb-ck"><input type="checkbox" aria-label="Seleccionar todo" data-vball="1"></th>');
 $$('tbody tr',t).forEach(r=>{if(r.dataset.id)r.insertAdjacentHTML('afterbegin',`<td class="vb-ck"><input type="checkbox" aria-label="Seleccionar" data-vbck="${esc(r.dataset.id)}"></td>`);else if(r.cells.length)r.cells[0].colSpan=(r.cells[0].colSpan||1)+1;});
 t.addEventListener('change',e=>{if(e.target.dataset.vball)$$('[data-vbck]',t).forEach(c=>{c.checked=e.target.checked;});if(e.target.dataset.vball||e.target.dataset.vbck)vbBulkBar(t);});});}
function vbBulkBar(t){const ids=$$('[data-vbck]:checked',t).map(c=>c.dataset.vbck);$$('tr',t).forEach(r=>{const c=r.querySelector('[data-vbck]');r.classList.toggle('vb-sel',!!(c&&c.checked));});let b=$('.vb-bulk');
 if(!ids.length){if(b)b.remove();return;}if(!b){b=document.createElement('div');b.className='vb-bulk';b.setAttribute('role','toolbar');b.setAttribute('aria-label','Acciones sobre la selección');document.body.appendChild(b);}
 const tp=VB_BULK[t.dataset.bulk];b.innerHTML=`<b>${ids.length} seleccionado${ids.length>1?'s':''}</b><button type="button" class="btn sm vb-bdel">${VB_IC.del} Eliminar</button><button type="button" class="btn sm vb-bx">Cancelar</button>`;
 b.querySelector('.vb-bx').onclick=vbBulkClear;b.querySelector('.vb-bdel').onclick=()=>{const r=tp.del(ids);if(r&&r.err)toast(r.err,1);b.remove();};}
function vbBulkClear(){$$('[data-vbck],[data-vball]').forEach(c=>{c.checked=false;});$$('tr.vb-sel').forEach(r=>r.classList.remove('vb-sel'));const b=$('.vb-bulk');if(b)b.remove();}

/* ---------- 4) Normalización visual de los botones de fila en todas las tablas ---------- */
const VB_EDIT_RX=/^(editar|✏️?|✎)$/i,VB_DEL_RX=/^(eliminar|borrar|quitar|✕|×|🗑️?)$/i;
function vbIcons(root){$$('td button.btn, td a.btn',root).forEach(b=>{if(b._vbi||b.querySelector('svg'))return;const t=(b.textContent||'').trim();let k='';
 if(VB_EDIT_RX.test(t))k='edit';else if(VB_DEL_RX.test(t))k='del';if(!k)return;b._vbi=1;const lbl=b.getAttribute('aria-label')||(k==='edit'?'Editar':t.length>2?t:'Eliminar');
 b.classList.add('vb-ib','vb-'+k);b.setAttribute('title',b.getAttribute('title')||lbl);b.setAttribute('aria-label',lbl);b.innerHTML=VB_IC[k];});}
let vbObsT=0;const vbObs=new MutationObserver(()=>{clearTimeout(vbObsT);vbObsT=setTimeout(()=>{const v=$('#view');if(v){vbIcons(v);vbBulkScan(v);}const m=$('#modal-root');if(m){vbIcons(m);vbBulkScan(m);}},30);});
function vbObsStart(){const v=$('#view'),m=$('#modal-root');if(v)vbObs.observe(v,{childList:true,subtree:true});if(m)vbObs.observe(m,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',vbObsStart);else vbObsStart();

/* ---------- 5) Cajas y sucursales: borrar con deshacer ---------- */
/* una caja que ya tuvo movimientos no se borra (los cierres y arqueos son historia fiscal): se desactiva */
function regUsed(id){const s=String(id);return(S.sessions||[]).some(x=>x.regId===s)||(S.transfers||[]).some(x=>JSON.stringify(x).includes(s))||(S.closures||[]).some(x=>x.regId===s)||(S.registers||[]).some(x=>x.parentId===s)||(S.tenant&&S.tenant.regId===s&&(S.sessions||[]).some(x=>!x.regId));}
function regDelIds(ids){if(!can('config'))return{err:'Sólo el administrador.'};const used=ids.filter(regUsed);const ok=ids.filter(i=>!used.includes(i));
 if(!ok.length)return{err:used.length>1?'Esas cajas ya tuvieron movimientos: desactivalas (sus cierres se conservan).':'Esa caja ya tuvo movimientos: desactivala (sus cierres se conservan).'};
 const was=S.tenant.regId;if(ok.includes(was))S.tenant.regId='';
 vbRemove({key:'registers',ids:ok,label:ok.length>1?ok.length+' cajas eliminadas':'Caja eliminada',audit:'CAJA_BORRAR',after:()=>{if(ok.includes(was)&&(S.registers||[]).some(r=>r.id===was))S.tenant.regId=was;rerender();}});
 if(used.length)toast(used.length+' caja(s) con movimientos quedaron sin borrar: desactivalas.',1);return{ok:ok.length};}
A.regDel=el=>{const r=regDelIds([el.dataset.id]);if(r.err)toast(r.err,1);};
function brUsed(id){return(S.registers||[]).some(r=>r.branchId===id)||(S.sessions||[]).some(x=>x.branchId===id);}
A.brDel=el=>{if(!can('config'))return toast('Sólo el administrador',1);const id=el.dataset.id;if(brUsed(id))return toast('Esa sucursal tiene cajas o movimientos: pasalas a otra sucursal o desactivala.',1);
 vbRemove({key:'branches',ids:[id],label:'Sucursal eliminada',audit:'SUCURSAL_BORRAR',after:rerender});};
VB_BULK.cajas={can:()=>can('config'),del:regDelIds};
if(SCREENS.cajasx){const s=SCREENS.cajasx;const r0=s.render;s.render=function(){let h=r0.apply(this,arguments);if(!can('config'))return h;
 /* marca la tabla de cajas para la selección múltiple y suma el tacho por fila */
 h=h.replace(/(<h3 class="sp">Cajas<\/h3>[\s\S]*?<table)>/,'$1 data-bulk="cajas">');
 h=h.replace(/<tr><td>([^<]*)<\/td><td>([^<]*)<\/td><td>(principal|operativa)<\/td>/g,(m,a,b,c)=>{const r=(S.registers||[]).find(x=>esc(x.code)===a&&esc(x.name)===b);return r?`<tr data-id="${r.id}"><td>${a}</td><td>${b}</td><td>${c}</td>`:m;});
 h=h.replace(/<button class="btn sm" data-act="regEdit" data-id="([^"]+)">Editar<\/button> <button class="btn sm" data-act="regToggle" data-id="\1">(Activar|Desactivar)<\/button>/g,(m,id,t)=>`<span class="vb-acts">${vbBtn('edit','regEdit',id,'Editar caja')}<button class="btn sm" data-act="regToggle" data-id="${id}">${t}</button>${vbBtn('del','regDel',id,regUsed(id)?'Tiene movimientos: desactivala en lugar de borrarla':'Borrar caja',regUsed(id)?'aria-disabled="true" data-used="1"':'')}</span>`);
 h=h.replace(/<button class="btn sm" data-act="brEdit" data-id="([^"]+)">Editar<\/button> <button class="btn sm" data-act="brToggle" data-id="\1">(Activar|Desactivar)<\/button>/g,(m,id,t)=>`<span class="vb-acts">${vbBtn('edit','brEdit',id,'Editar sucursal')}<button class="btn sm" data-act="brToggle" data-id="${id}">${t}</button>${vbBtn('del','brDel',id,'Borrar sucursal')}</span>`);
 h=h.replace(/<button class="btn sm" data-act="regEdit" data-id="">\+ Caja<\/button>/,'<button class="btn gold" data-act="regEdit" data-id="">+ Agregar caja</button>').replace(/<button class="btn sm" data-act="brEdit" data-id="">\+ Sucursal<\/button>/,'<button class="btn gold" data-act="brEdit" data-id="">+ Agregar sucursal</button>');
 return h;};}

/* ---------- 6) Tareas de la Agenda: borrar con deshacer (sin confirmación) ---------- */
if(typeof A.ctDel==='function'){A.ctDel=el=>{const t=typeof ctById==='function'&&ctById(el.dataset.id);if(!t)return;const deal=t.deal;if(typeof dlCloseTop==='function')dlCloseTop();
 vbRemove({key:'ctasks',ids:[t.id],label:'Tarea eliminada',audit:'CRM_TAREA_BORRADA',after:()=>{if(typeof ctDealNext==='function')ctDealNext(deal);if(typeof ctRepaint==='function')ctRepaint();}});};}

/* ---------- 7) Preventistas y reglas de reposición ---------- */
if(typeof prvReps==='function'){
 A.prvDel=el=>{const r=prvRep(el.dataset.id);if(!r)return;$$('#modal-root .ov').forEach(o=>o.remove());vbRemove({key:'prevr',ids:[r.id],label:'Preventista eliminado',audit:'PREVENTISTA_BORRAR',after:()=>{if(curScreen==='proveedores')cmpRepaint();}});};
 /* el lápiz y el tacho en cada ficha */
 const _pc=prvCard;prvCard=function(r){return _pc.apply(this,arguments).replace(`<button class="btn sm" data-act="prvEdit" data-id="${r.id}">Editar</button>`,vbBtn('edit','prvEdit',r.id,'Editar preventista')+vbBtn('del','prvDel',r.id,'Borrar preventista'));};
 /* reglas: el ✕ pasa a borrar con deshacer */
 document.addEventListener('click',e=>{const b=e.target.closest('[data-prvdel]');if(!b)return;e.stopImmediatePropagation();e.preventDefault();const id=b.dataset.prvdel;const tr=b.closest('tr');
  vbRemove({key:'repo',ids:[id],label:'Regla de reposición eliminada',audit:'REPOSICION_BORRAR',after:()=>{const tb=$('#prv-rb');if(!tb)return;if(!prvRules().some(x=>x.id===id)){if(tr&&tr.isConnected)tr.remove();}else if(tr&&!tr.isConnected){tb.appendChild(tr);}}});},true);
 VB_BULK.repo={can:()=>can('purchases'),del:ids=>{vbRemove({key:'repo',ids,label:ids.length+' regla(s) eliminada(s)',audit:'REPOSICION_BORRAR',after:()=>{const tb=$('#prv-rb');if(tb)$$('tr[data-pr]',tb).forEach(t=>{if(!prvRules().some(x=>x.id===t.dataset.pr))t.remove();});}});}};
 /* la tabla de reglas se marca para selección múltiple (sus filas usan data-pr) */
 const _ro=A.prvRulesOpen;A.prvRulesOpen=function(){_ro.apply(this,arguments);setTimeout(()=>{const t=$('#prv-rb');if(!t)return;const tbl=t.closest('table');$$('tr[data-pr]',t).forEach(r=>{r.dataset.id=r.dataset.pr;});tbl.dataset.bulk='repo';vbBulkScan($('#modal-root'));},30);};}

/* ---------- 8) Diseño ---------- */
const VB_CRUD_CSS=`<style id="vb-crud-css">
.vb-ib{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border:1px solid var(--line);border-radius:10px;background:transparent;color:inherit;cursor:pointer;vertical-align:middle;transition:background .15s,color .15s,border-color .15s}
.vb-ib:hover{border-color:var(--gold);color:var(--gold)}.vb-ib:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.vb-del{color:var(--mut)}.vb-del:hover{color:#fff;background:#c0392b;border-color:#c0392b}.vb-ib[aria-disabled="true"]{opacity:.35;cursor:not-allowed}.vb-ib[aria-disabled="true"]:hover{background:transparent;color:var(--mut);border-color:var(--line)}
.vb-acts{display:inline-flex;gap:.3rem;align-items:center;flex-wrap:wrap;justify-content:flex-end}
td .vb-ib{width:34px;height:34px}.vb-ck{width:2.2rem;text-align:center}.vb-ck input{width:18px;height:18px;cursor:pointer}tr.vb-sel td{background:rgba(201,150,62,.1)}
#vb-snack{position:fixed;left:1rem;bottom:1rem;z-index:9999;display:flex;align-items:center;gap:.8rem;background:#1d1b18;color:#fff;border-radius:12px;padding:.7rem .8rem .7rem 1rem;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:calc(100vw - 2rem);overflow:hidden;animation:vbIn .18s ease-out}
#vb-snack .vb-undo{display:inline-flex;align-items:center;gap:.35rem;background:var(--gold);color:#1a1307;border:0;border-radius:9px;padding:.45rem .75rem;font-weight:800;cursor:pointer}#vb-snack .vb-undo:focus-visible{outline:3px solid #fff}
#vb-snack .vb-bar{position:absolute;left:0;bottom:0;height:3px;background:var(--gold);width:100%;animation:vbBar 6s linear forwards}
.vb-bulk{position:fixed;top:.8rem;left:50%;transform:translateX(-50%);z-index:9998;display:flex;align-items:center;gap:.6rem;background:var(--card);color:inherit;border:1px solid var(--gold);border-radius:14px;padding:.5rem .7rem;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.vb-bulk .vb-bdel{display:inline-flex;align-items:center;gap:.3rem;color:#fff;background:#c0392b;border-color:#c0392b}
@keyframes vbIn{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}@keyframes vbBar{from{width:100%}to{width:0}}
@media (prefers-reduced-motion:reduce){#vb-snack,#vb-snack .vb-bar{animation:none}}
@media (max-width:560px){#vb-snack{left:.5rem;right:.5rem;bottom:calc(.5rem + env(safe-area-inset-bottom));}.vb-bulk{top:auto;bottom:4.5rem;left:.5rem;right:.5rem;transform:none;justify-content:space-between}}
</style>`;
/* el estilo del kit queda siempre cargado */
(function(){const d=document.createElement('div');d.innerHTML=VB_CRUD_CSS;document.head.appendChild(d.firstElementChild);})();
