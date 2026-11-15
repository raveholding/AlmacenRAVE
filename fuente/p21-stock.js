/* ===== V26.78 · Stock por sucursal y depósito · Toma de inventario con el celular =====
   Depósitos: el stock total del artículo (el de siempre, el que usa Vender) se reparte entre depósitos.
   Regla única: el depósito de ESTE equipo = stock total − lo de los demás depósitos − lo que está en tránsito.
   Así toda venta, compra, merma o ajuste de este equipo cae en su depósito sin tocar Vender ni Compras,
   y las transferencias mueven entre depósitos sin cambiar el total. Los datos van en S.dstk (colección «dstk» del SQL 30).
   Inventario: conteo a ciegas por sector, varios contadores, segundo conteo de diferencias, ajuste único auditado. */

GI_MODS.push(
 {k:'depots',t:'Stock por sucursal y depósito',d:'Stock separado por depósito, transferencias con remito interno y mercadería en tránsito, mínimos y sugerencia de reposición.',plan:'mayorista',scr:'depositos'},
 {k:'count',t:'Toma de inventario con el celular',d:'Conteo a ciegas por sector con escáner o cámara, varios contadores, segundo conteo de diferencias y ajuste único auditado con valorización.',plan:'esencial',scr:'inventariof'});
Object.assign(PERMS,{depots:'Stock por depósito y transferencias',count:'Toma de inventario: contar y (con supervisor) ajustar'});

/* ---------- Depósitos ---------- */
const VB_TR='_tr';
function dpList(){const c=S.cfg.depots||(S.cfg.depots=[]);if(!c.length)c.push({id:'d1',name:'Depósito principal',suc:''});return c;}
const dpById=id=>dpList().find(d=>d.id===id);
function dpCur(){let id='';try{id=localStorage.getItem('vb.depot')||'';}catch(e){}return dpById(id)?id:dpList()[0].id;}
function dpSetCur(id){if(!dpById(id))return;try{localStorage.setItem('vb.depot',id);}catch(e){}audit('DEPOSITO_EQUIPO','Este equipo trabaja con '+dpById(id).name);}
const dpRec=pid=>{let r=vbArr('dstk').find(x=>x.id===pid);if(!r){r={id:pid,q:{},min:{}};vbArr('dstk').push(r);}if(!r.q)r.q={};if(!r.min)r.min={};return r;};

/* reparte: el depósito del equipo absorbe la diferencia con el total */
function dpSync(){if(!giOn('depots')||!S.products)return;const cur=dpCur();
 for(const p of S.products){if(p.id==='p_envio'||p.archived)continue;const has=vbArr('dstk').find(x=>x.id===p.id);if(!has&&!(+p.stock))continue;const r=dpRec(p.id);
  let others=0;for(const k in r.q)if(k!==cur)others+=+r.q[k]||0;const v=r3((+p.stock||0)-others);if(r.q[cur]!==v)r.q[cur]=v;}}
{const _sv=save;save=function(){try{dpSync();}catch(e){}return _sv.apply(this,arguments);};}
const dpQty=(pid,dep)=>{const r=vbArr('dstk').find(x=>x.id===pid);return r&&r.q?r3(+r.q[dep]||0):0;};
function dpAdd(name,suc){if(!giAdm())return{err:'Sólo el administrador crea depósitos.'};name=String(name||'').replace(/[<>]/g,'').trim().slice(0,40);if(name.length<2)return{err:'Escribí el nombre del depósito.'};
 if(dpList().some(d=>d.name.toLowerCase()===name.toLowerCase()))return{err:'Ya hay un depósito con ese nombre.'};const d={id:'d'+uid().slice(-6),name,suc:String(suc||'').slice(0,40)};dpList().push(d);audit('DEPOSITO_NUEVO',d.name);save();return{d};}
/* transferencia: sale del origen y queda en tránsito; al recibir entra al destino. Faltante → ajuste de stock con motivo. */
function dpSend(from,to,items,note){if(!giOn('depots'))return{err:'El módulo está apagado.'};if(!can('depots'))return{err:'Sin permiso.'};if(!dpById(from)||!dpById(to)||from===to)return{err:'Elegí origen y destino distintos.'};
 const L=[];for(const it of items||[]){const p=prod(it.pid);const q=r3(+it.qty||0);if(!p||!(q>0))continue;if(q>dpQty(p.id,from)+1e-9)return{err:'«'+pfull(p)+'»: en '+dpById(from).name+' hay '+dpQty(p.id,from)+'.'};L.push({pid:p.id,name:pfull(p),qty:q,rec:null});}
 if(!L.length)return{err:'Indicá qué se manda.'};dpSync();
 for(const x of L){const r=dpRec(x.pid);r.q[from]=r3((+r.q[from]||0)-x.qty);r.q[VB_TR]=r3((+r.q[VB_TR]||0)+x.qty);}
 const t={id:uid(),n:vbSeq('seqTD','RI-',6),ts:now(),user:user.name,from,to,items:L,note:String(note||'').slice(0,160),state:'en_transito'};vbArr('tdep').push(t);
 audit('TRANSFERENCIA_DEPOSITO',t.n+' · '+dpById(from).name+' → '+dpById(to).name+' · '+L.map(x=>x.qty+' '+x.name).join(', '));save();return{t};}
function dpReceive(id,recv,why){const t=vbArr('tdep').find(x=>x.id===id);if(!t)return{err:'Transferencia inexistente.'};if(!can('depots'))return{err:'Sin permiso.'};if(t.state!=='en_transito')return{err:'Ya se recibió.'};
 const dif=[];for(const x of t.items){const q=r3(Math.max(0,+((recv||{})[x.pid]??x.qty)));if(q>x.qty+1e-9)return{err:'«'+x.name+'»: no se puede recibir más de lo enviado ('+x.qty+').'};x.rec=q;if(q<x.qty)dif.push(x);}
 if(dif.length&&(!why||String(why).trim().length<3))return{err:'Hay faltantes: escribí el motivo.'};
 for(const x of t.items){const r=dpRec(x.pid);r.q[VB_TR]=r3((+r.q[VB_TR]||0)-x.qty);r.q[t.to]=r3((+r.q[t.to]||0)+x.rec);
  if(x.rec<x.qty){const p=prod(x.pid);if(p){p.stock=r3((+p.stock||0)-(x.qty-x.rec));}}}
 /* el total bajó por el faltante: que lo absorba el destino y no el depósito de este equipo */
 if(dif.length){const cur=dpCur();if(cur!==t.to){for(const x of dif){const r=dpRec(x.pid);r.q[cur]=r3((+r.q[cur]||0)+(x.qty-x.rec));}}}
 t.state='recibida';t.recAt=now();t.recBy=user.name;t.why=dif.length?String(why).trim().slice(0,120):'';
 audit('TRANSFERENCIA_RECIBIDA',t.n+(dif.length?' · faltantes: '+dif.map(x=>(x.qty-x.rec)+' '+x.name).join(', ')+' · '+t.why:' · completa'));save();return{t,dif};}
function dpSuggest(dep){const out=[];for(const r of vbArr('dstk')){const p=prod(r.id);if(!p||p.archived)continue;const mn=+((r.min||{})[dep])||0;if(!(mn>0))continue;const have=dpQty(p.id,dep);if(have>=mn)continue;
 const need=r3(mn-have);const src=dpList().filter(d=>d.id!==dep).map(d=>({d,q:dpQty(p.id,d.id)-(+((r.min||{})[d.id])||0)})).filter(x=>x.q>0).sort((a,b)=>b.q-a.q)[0];
 out.push({pid:p.id,name:pfull(p),have,min:mn,need,from:src?src.d.id:'',fromQ:src?r3(Math.min(src.q,need)):0});}return out;}
let dpTab='stock',dpSel='',dpDraft=null;
A.dpTab=el=>{dpTab=el.dataset.t;rerender();};
A.dpNew=()=>modal('Nuevo depósito',`<label for="dn-n">Nombre</label><input id="dn-n" maxlength="40" placeholder="Ej.: Depósito Norte"><label for="dn-s">Sucursal (opcional)</label><input id="dn-s" maxlength="40">`,{okText:'Crear',onOk:w=>{const r=dpAdd(val('dn-n'),val('dn-s'));if(r.err)return w._err(r.err),false;rerender();}});
A.dpCurSet=el=>{dpSetCur(el.dataset.id);save();rerender();toast('Este equipo trabaja con '+dpById(el.dataset.id).name);};
A.dpSendNew=()=>{dpDraft={from:dpCur(),to:(dpList().find(d=>d.id!==dpCur())||{}).id||'',items:[],note:''};dpTab='enviar';rerender();};
A.dpDAdd=el=>{const x=dpDraft.items.find(i=>i.pid===el.dataset.id);if(x)x.qty+=1;else dpDraft.items.push({pid:el.dataset.id,qty:1});rerender();};
A.dpDGo=()=>{const r=dpSend(dpDraft.from,dpDraft.to,dpDraft.items,dpDraft.note);if(r.err)return toast(r.err,1);dpDraft=null;dpTab='transf';rerender();
 confirmBox('Remito interno '+esc(r.t.n),'¿Lo imprimimos para que viaje con la mercadería?',()=>vbPrint(dpDoc(r.t)),'Imprimir');};
A.dpRecv=el=>{const t=vbArr('tdep').find(x=>x.id===el.dataset.id);if(!t)return;modal('Recibir '+t.n,`${t.items.map(x=>`<label for="rc-${x.pid}">${esc(x.name)} · enviado ${x.qty}</label><input id="rc-${x.pid}" class="dp-rc" data-pid="${x.pid}" type="number" min="0" step="any" value="${x.qty}">`).join('')}<label for="rc-w">Motivo si falta algo</label><input id="rc-w" maxlength="120">`,
 {okText:'Recibir',onOk:w=>{const m={};$$('.dp-rc',w).forEach(i=>m[i.dataset.pid]=+i.value);const r=dpReceive(t.id,m,val('rc-w'));if(r.err)return w._err(r.err),false;toast(r.dif.length?'Recibida con faltantes (ajuste registrado)':'Recibida completa');rerender();}});};
A.dpPrint=el=>{const t=vbArr('tdep').find(x=>x.id===el.dataset.id);if(t)vbPrint(dpDoc(t));};
function dpDoc(t){return vbDoc('Remito interno '+t.n,`<h1>Remito interno ${esc(t.n)}</h1><div class="mut">${esc(vbShop().name)} · ${fmtDT(t.ts)} · ${esc(t.user)}</div><div class="box"><b>Desde:</b> ${esc((dpById(t.from)||{}).name||'')} · <b>Hacia:</b> ${esc((dpById(t.to)||{}).name||'')}${t.note?'<br>'+esc(t.note):''}</div>
 <table><thead><tr><th>Artículo</th><th class="r">Enviado</th><th class="r">Recibido</th></tr></thead><tbody>${t.items.map(x=>`<tr><td>${esc(x.name)}</td><td class="r">${x.qty}</td><td class="r">${x.rec===null?'______':x.rec}</td></tr>`).join('')}</tbody></table><div class="sig"><div>Despachó</div><div>Recibió</div></div><p class="mut">Movimiento interno entre depósitos del mismo comercio.</p>`);}
A.dpMin=el=>{const r=dpRec(el.dataset.id);const dep=el.dataset.d;modal('Mínimo en '+esc(dpById(dep).name),`<label for="mn-v">Stock mínimo de ${esc(pfull(prod(el.dataset.id)))}</label><input id="mn-v" type="number" min="0" step="any" value="${+(r.min[dep]||0)}">`,{okText:'Guardar',onOk:w=>{const v=Math.max(0,+val('mn-v')||0);r.min[dep]=v;save();rerender();}});};
reg('depositos','Depósitos','box','depots',()=>{dpSync();const D=dpList(),cur=dpCur();const tabs=[['stock','Stock por depósito'],['transf','Transferencias'],['repo','Reposición']];
 const q=giNorm(val('dp-q')||'');const P=S.products.filter(p=>p.active!==false&&!p.archived&&p.id!=='p_envio').filter(p=>!q||giNorm(pfull(p)).includes(q)).slice(0,250);
 const T=vbArr('tdep').slice().reverse();const sel=dpSel&&dpById(dpSel)?dpSel:cur;const sug=dpSuggest(sel);
 let body='';
 if(dpTab==='enviar'&&dpDraft){body=`<div class="card"><h3 style="margin-top:0">Nueva transferencia</h3><div class="f"><div><label for="dt-f">Desde</label><select id="dt-f">${D.map(d=>`<option value="${d.id}" ${d.id===dpDraft.from?'selected':''}>${esc(d.name)}</option>`).join('')}</select></div><div><label for="dt-t">Hacia</label><select id="dt-t">${D.map(d=>`<option value="${d.id}" ${d.id===dpDraft.to?'selected':''}>${esc(d.name)}</option>`).join('')}</select></div></div>
  <label for="dt-p">Agregar artículo</label><input id="dt-p" autocomplete="off" placeholder="Código o nombre (Enter)">
  ${dpDraft.items.length?`<div class="tw"><table data-nosort><thead><tr><th>Artículo</th><th class="r">Hay en origen</th><th class="r">Enviar</th></tr></thead><tbody>${dpDraft.items.map((x,i)=>`<tr><td>${esc(pfull(prod(x.pid)))}</td><td class="r">${dpQty(x.pid,dpDraft.from)}</td><td class="r"><input class="dt-q" data-i="${i}" type="number" min="0" step="any" value="${x.qty}" style="width:5.5rem" aria-label="Cantidad"></td></tr>`).join('')}</tbody></table></div>`:''}
  <label for="dt-n">Nota</label><input id="dt-n" maxlength="160" value="${esc(dpDraft.note)}"><div class="row" style="gap:.5rem;margin-top:.6rem"><button class="btn gold" data-act="dpDGo" ${dpDraft.items.length?'':'disabled'}>Enviar</button><button class="btn ghost" data-act="dpTab" data-t="transf">Cancelar</button></div></div>`;}
 else if(dpTab==='transf')body=`<div class="row" style="margin:.5rem 0"><span class="sp"></span><button class="btn gold" data-act="dpSendNew" ${D.length>1?'':'disabled'}>+ Nueva transferencia</button></div>${T.length?`<div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Desde → Hacia</th><th>Artículos</th><th>Estado</th><th></th></tr></thead><tbody>${T.map(t=>`<tr><td>${esc(t.n)}</td><td>${fmtDT(t.ts)}</td><td>${esc((dpById(t.from)||{}).name||'?')} → ${esc((dpById(t.to)||{}).name||'?')}</td><td class="sm">${t.items.map(x=>x.qty+' '+esc(x.name)).join(', ')}</td><td><span class="tag ${t.state==='en_transito'?'warn':'ok'}">${t.state==='en_transito'?'En tránsito':'Recibida'}</span></td><td class="r"><button class="btn sm" data-act="dpPrint" data-id="${t.id}">Imprimir</button>${t.state==='en_transito'?` <button class="btn sm gold" data-act="dpRecv" data-id="${t.id}">Recibir</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="okbox">No hay transferencias.</div>'}`;
 else if(dpTab==='repo')body=`<label for="dp-sel">Depósito</label><select id="dp-sel">${D.map(d=>`<option value="${d.id}" ${d.id===sel?'selected':''}>${esc(d.name)}</option>`).join('')}</select>${sug.length?`<div class="tw"><table data-nosort><thead><tr><th>Artículo</th><th class="r">Hay</th><th class="r">Mínimo</th><th class="r">Faltan</th><th>Sugerencia</th></tr></thead><tbody>${sug.map(s=>`<tr><td>${esc(s.name)}</td><td class="r">${s.have}</td><td class="r">${s.min}</td><td class="r">${s.need}</td><td>${s.from?'Transferir '+s.fromQ+' desde '+esc(dpById(s.from).name)+(s.fromQ<s.need?' y comprar '+r3(s.need-s.fromQ):''):'Comprar '+s.need}</td></tr>`).join('')}</tbody></table></div>`:'<div class="okbox">Nada por debajo del mínimo en este depósito. Cargá mínimos tocando la cantidad en «Stock por depósito».</div>'}`;
 else body=`<div class="row" style="margin:.5rem 0"><input id="dp-q" class="sp" placeholder="Buscar artículo" value="${esc(val('dp-q')||'')}" autocomplete="off"></div><div class="tw"><table><thead><tr><th>Artículo</th>${D.map(d=>`<th class="r">${esc(d.name)}${d.id===cur?' ★':''}</th>`).join('')}<th class="r">En tránsito</th><th class="r">Total</th></tr></thead><tbody>
  ${P.map(p=>`<tr><td>${esc(pfull(p))}</td>${D.map(d=>{const r=vbArr('dstk').find(x=>x.id===p.id);const mn=r&&r.min?+(r.min[d.id]||0):0;const v=dpQty(p.id,d.id);return`<td class="r"><button class="btn sm ${mn&&v<mn?'red':''}" data-act="dpMin" data-id="${p.id}" data-d="${d.id}" title="Tocar para el mínimo">${v}${mn?' / '+mn:''}</button></td>`;}).join('')}<td class="r">${dpQty(p.id,VB_TR)}</td><td class="r"><b>${+p.stock||0}</b></td></tr>`).join('')}</tbody></table></div>`;
 return`<div class="row"><h1 class="sp">Stock por depósito</h1>${giAdm()?'<button class="btn sm" data-act="dpNew">+ Depósito</button>':''}</div>
 <div class="card"><p class="sm" style="margin:0">Este equipo trabaja con: ${D.map(d=>`<button class="btn sm ${d.id===cur?'gold':''}" data-act="dpCurSet" data-id="${d.id}">${esc(d.name)}</button>`).join(' ')}</p><p class="sm mut" style="margin:.4rem 0 0">Las ventas, compras y ajustes de este equipo salen de su depósito. ★ = el de este equipo.</p></div>
 ${dpTab==='enviar'?'':`<div class="ux-tabs" role="tablist">${tabs.map(([k,t])=>`<a role="tab" tabindex="0" data-act="dpTab" data-t="${k}" aria-selected="${k===dpTab}" class="${k===dpTab?'on':''}">${t}</a>`).join('')}</div>`}${body}`;},
 ()=>{const q=$('#dp-q');if(q)q.addEventListener('change',()=>rerender());const s=$('#dp-sel');if(s)s.addEventListener('change',()=>{dpSel=s.value;rerender();});
  if(dpDraft){const f=$('#dt-f'),t=$('#dt-t');if(f)f.addEventListener('change',()=>{dpDraft.from=f.value;rerender();});if(t)t.addEventListener('change',()=>{dpDraft.to=t.value;});const n=$('#dt-n');if(n)n.addEventListener('change',()=>dpDraft.note=n.value);
   const p=$('#dt-p');if(p)p.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const x=giFind(p.value)[0];if(!x)return toast('No encontré ese artículo.',1);A.dpDAdd({dataset:{id:x.id}});}});
   $$('.dt-q').forEach(i=>i.addEventListener('change',()=>{const v=+i.value||0;const x=dpDraft.items[+i.dataset.i];if(x){if(v>0)x.qty=v;else dpDraft.items.splice(+i.dataset.i,1);}rerender();}));}},'Logística');
SCREENS.depositos.show=()=>giOn('depots');NAV.push(['depositos','Logística']);

/* ---------- Toma de inventario ---------- */
const ivList=()=>vbArr('counts');
const ivById=id=>ivList().find(x=>x.id===id);
function ivScope(c){return S.products.filter(p=>p.active!==false&&!p.archived&&p.id!=='p_envio'&&!(typeof isKit==='function'&&isKit(p))&&(!c.rubro||p.rubro===c.rubro));}
function ivCreate(rubro,name){if(!giOn('count'))return{err:'El módulo está apagado.'};if(!can('count'))return{err:'Sin permiso.'};if(ivList().some(c=>c.state!=='cerrado'&&c.state!=='anulado'&&(c.rubro||'')===(rubro||'')))return{err:'Ya hay un inventario abierto de ese sector.'};
 const c={id:uid(),n:vbSeq('seqTI','TI-',4),ts:now(),user:user.name,rubro:rubro||'',name:String(name||'').slice(0,60)||(rubro?rubName(rubro):'Todo el local'),state:'contando',c1:{},c2:{},dep:giOn('depots')?dpCur():''};
 ivList().push(c);audit('INVENTARIO_INICIO',c.n+' · '+c.name);save();return{c};}
/* conteo: se suma (cada pasada del lector suma 1; o una cantidad); ronda 1 o 2 */
function ivCount(id,pid,qty,round,set){const c=ivById(id);if(!c)return{err:'Inventario inexistente.'};if(!can('count'))return{err:'Sin permiso.'};if(!['contando','revision'].includes(c.state))return{err:'Ese inventario ya se cerró.'};
 const p=prod(pid);if(!p||!ivScope(c).some(x=>x.id===pid))return{err:'Ese artículo no es de este sector.'};const q=r3(+qty);if(!(q>=0)||q>1e6)return{err:'Cantidad inválida.'};
 const k=round===2?'c2':'c1';const prev=c[k][pid];const v=set||!prev?q:r3(prev.q+q);c[k][pid]={q:v,u:user.name,ts:now()};save();return{q:v,p};}
/* esperado = stock actual (si se vendió durante el conteo, se cuenta igual porque el conteo es de lo que hay ahora) */
function ivDiffs(c){const exp=p=>c.dep&&giOn('depots')?dpQty(p.id,c.dep):(+p.stock||0);return ivScope(c).map(p=>{const k1=c.c1[p.id],k2=c.c2[p.id];const counted=k2?k2.q:k1?k1.q:null;const e=r3(exp(p));
 return{pid:p.id,name:pfull(p),exp:e,c1:k1?k1.q:null,c2:k2?k2.q:null,counted,diff:counted===null?null:r3(counted-e),val:counted===null?0:Math.round((counted-e)*(+p.cost||0))};});}
function ivReview(id){const c=ivById(id);if(!c)return{err:'Inventario inexistente.'};if(!can('count'))return{err:'Sin permiso.'};if(c.state!=='contando')return{err:'Sólo se revisa un inventario en conteo.'};
 c.state='revision';c.revAt=now();const D=ivDiffs(c).filter(d=>d.diff);audit('INVENTARIO_REVISION',c.n+' · '+D.length+' diferencia(s) para segundo conteo');save();return{c,dif:D};}
/* cierre: ajusta sólo lo contado; lo no contado queda igual (o en cero si se pide) */
function ivClose(id,zeroUncounted){const c=ivById(id);if(!c)return{err:'Inventario inexistente.'};if(!(can('count')&&(user.role==='admin'||user.role==='supervisor'||can('close_cash'))))return{err:'El cierre lo hace un supervisor o el administrador.'};
 if(!['contando','revision'].includes(c.state))return{err:'Ese inventario ya se cerró.'};const D=ivDiffs(c);let n=0,val=0;const lines=[];
 for(const d of D){let counted=d.counted;if(counted===null){if(!zeroUncounted)continue;counted=0;}const diff=r3(counted-d.exp);if(!diff)continue;const p=prod(d.pid);p.stock=r3((+p.stock||0)+diff);if(c.dep&&giOn('depots')&&c.dep!==dpCur()){const r=dpRec(p.id);r.q[c.dep]=r3((+r.q[c.dep]||0)+diff);}n++;val+=Math.round(diff*(+p.cost||0));lines.push(d.name+' '+(diff>0?'+':'')+diff);}
 c.state='cerrado';c.closedAt=now();c.closedBy=user.name;c.adj={n,val,zero:!!zeroUncounted};
 audit('AJUSTE_INVENTARIO',c.n+' · '+c.name+' · '+n+' artículo(s) ajustados · valorización '+money(val)+(lines.length?' · '+lines.slice(0,40).join(', '):''));save();return{c,n,val};}
let ivSel='',ivRound=1;
A.ivNew=()=>{const rubs=S.rubros.filter(r=>r.kind==='rubro'||!r.kind);modal('Nueva toma de inventario',`<label for="iv-r">Sector</label><select id="iv-r"><option value="">Todo el local</option>${rubs.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select><p class="sm mut">Conviene contar con el sector quieto. El conteo es a ciegas: quien cuenta no ve lo que dice el sistema.</p>`,
 {okText:'Empezar',onOk:w=>{const r=ivCreate(val('iv-r'));if(r.err)return w._err(r.err),false;ivSel=r.c.id;ivRound=1;rerender();}});};
A.ivOpen=el=>{ivSel=el.dataset.id;const c=ivById(ivSel);ivRound=c&&c.state==='revision'?2:1;rerender();};
A.ivBack=()=>{ivSel='';rerender();};
A.ivReview=()=>{const r=ivReview(ivSel);if(r.err)return toast(r.err,1);ivRound=2;toast(r.dif.length+' artículo(s) para volver a contar');rerender();};
A.ivClose=()=>{const c=ivById(ivSel);const D=ivDiffs(c);const unc=D.filter(d=>d.counted===null).length;confirmBox('Cerrar y ajustar '+esc(c.n),`Se ajusta el stock de lo contado con diferencia.${unc?`<br><label class="row" style="gap:.4rem"><input type="checkbox" id="iv-z"> Poner en cero los ${unc} artículo(s) no contados</label>`:''}`,
 ()=>{const r=ivClose(c.id,!!($('#iv-z')&&$('#iv-z').checked));if(r.err)return toast(r.err,1);toast(r.n+' ajuste(s) · '+money(r.val));rerender();},'Cerrar y ajustar');};
function ivScan(v){const c=ivById(ivSel);if(!c)return;const s=String(v||'').trim();if(!s)return;const m=s.match(/^(\d+(?:[.,]\d+)?)\s*[x*]\s*(.+)$/i);const qty=m?parseFloat(m[1].replace(',','.')):1;const code=m?m[2]:s;
 const p=giFind(code)[0];if(!p)return toast('No encontré «'+code+'».',1);const r=ivCount(c.id,p.id,qty,ivRound);if(r.err)return toast(r.err,1);
 const b=$('#iv-last');if(b)b.innerHTML=`<div class="okbox"><b>${esc(pfull(p))}</b> · contado: <b>${r.q}</b></div>`;const t=$('#iv-tbl');if(t)t.innerHTML=ivTable(c);}
function ivTable(c){const D=ivDiffs(c);const rev=c.state!=='contando';const cv=can('view_cost');const L=rev?D.filter(d=>d.diff||d.c2!==null):D.filter(d=>d.counted!==null);
 return L.length?`<div class="tw"><table data-nosort><thead><tr><th>Artículo</th><th class="r">Conteo 1</th>${rev?'<th class="r">Conteo 2</th><th class="r">Sistema</th><th class="r">Diferencia</th>'+(cv?'<th class="r">Valor</th>':''):''}</tr></thead><tbody>${L.map(d=>`<tr><td>${esc(d.name)}</td><td class="r">${d.c1===null?'—':d.c1}</td>${rev?`<td class="r">${d.c2===null?'—':d.c2}</td><td class="r">${d.exp}</td><td class="r ${d.diff?'bad':''}">${d.diff===null?'sin contar':(d.diff>0?'+':'')+d.diff}</td>${cv?`<td class="r">${money(d.val)}</td>`:''}`:''}</tr>`).join('')}</tbody></table></div>`:'<p class="sm mut">Todavía no hay conteos.</p>';}
reg('inventariof','Toma de inventario','list','count',()=>{const c=ivSel&&ivById(ivSel);
 if(c){const done=c.state==='cerrado';const sup=user.role==='admin'||user.role==='supervisor'||can('close_cash');const D=ivDiffs(c);const nc=D.filter(d=>d.counted!==null).length;
  return`<div class="row" style="gap:.5rem;flex-wrap:wrap"><button class="btn sm" data-act="ivBack">← Inventarios</button><h2 class="sp" style="margin:0">${esc(c.n)} · ${esc(c.name)}</h2><span class="tag ${done?'ok':'warn'}">${done?'Cerrado':c.state==='revision'?'Segundo conteo':'Contando'}</span></div>
  <p class="sm mut">${nc} de ${D.length} artículos contados${c.dep?' · depósito '+esc((dpById(c.dep)||{}).name||''):''}${done?' · ajustados '+c.adj.n+' · '+money(c.adj.val):''}</p>
  ${done?'':`<div class="card"><label for="iv-s">${ivRound===2?'Segundo conteo de las diferencias':'Escaneá o escribí el artículo'} (podés poner «12 x código»)</label><input id="iv-s" autocomplete="off" inputmode="search" placeholder="Código de barras o nombre" style="font-size:1.2rem"><div id="iv-last"></div>
   <div class="row" style="gap:.5rem;margin-top:.6rem;flex-wrap:wrap">${c.state==='contando'&&sup?'<button class="btn" data-act="ivReview">Ver diferencias y pedir segundo conteo</button>':''}${sup?'<button class="btn gold" data-act="ivClose">Cerrar y ajustar stock</button>':''}</div></div>`}
  <div id="iv-tbl">${ivTable(c)}</div>`;}
 const L=ivList().slice().reverse();return`<div class="row"><h1 class="sp">Toma de inventario</h1><button class="btn gold" data-act="ivNew">+ Nueva</button></div><p class="sm mut">Contá desde el celular con el lector o la cámara. Quien cuenta no ve el stock del sistema; las diferencias se revisan con un segundo conteo y el ajuste queda en Auditoría con su valor.</p>
 ${L.length?`<div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Sector</th><th>Estado</th><th></th></tr></thead><tbody>${L.map(c=>`<tr><td>${esc(c.n)}</td><td>${fmtDT(c.ts)}</td><td>${esc(c.name)}</td><td><span class="tag ${c.state==='cerrado'?'ok':'warn'}">${{contando:'Contando',revision:'Segundo conteo',cerrado:'Cerrado'}[c.state]||c.state}</span></td><td class="r"><button class="btn sm" data-act="ivOpen" data-id="${c.id}">Abrir</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="okbox">No hay inventarios.</div>'}`;},
 ()=>{const s=$('#iv-s');if(s){s.focus();s.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ivScan(s.value);s.value='';}});}},'Logística');
SCREENS.inventariof.show=()=>giOn('count');NAV.push(['inventariof','Logística']);
