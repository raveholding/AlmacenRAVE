/* ===== V26.36 · Vender más rápido: cambiar el precio de un artículo y crear artículos sin salir de Vender =====
   · «✎ $» en cada artículo: cambia el precio de venta (y el costo, si se ven costos) del inventario; queda auditado.
   · «+ Artículo» (o «Crear artículo» cuando la búsqueda no encuentra nada): abre el alta completa del inventario con el
     nombre o el código ya escritos y, al guardar, lo suma al ticket.
   · En el ticket, si se cambió el precio de una línea a mano, «Guardar como precio del producto» lo pasa al inventario.
   Todo con el permiso «Editar productos» (edit_products), igual que en Inventario. */
let pEditAfter=null;
/* presentaciones mayoristas editables desde Vender (sólo con el módulo mayorista y permiso de listas de precios) */
const posPresList=p=>(Array.isArray(p.pres)?p.pres:[]).map((k,i)=>({k,i})).filter(x=>x.k&&x.k.qty>0);
const posPresEd=p=>typeof wsOn==='function'&&wsOn()&&can('price_lists')&&posPresList(p).length>0;
function posPriceCheck(p,pr){if(!(pr>0))return'El precio de venta debe ser mayor a cero.';
 const P=(Array.isArray(p.pres)?p.pres:[]).filter(k=>k&&k.unit>pr);
 if(P.length)return'Con ese precio, '+P.map(k=>(typeof wsLvName==='function'?wsLvName(k.lv):'la presentación')+' ('+money(k.unit)+' c/u)').join(', ')+' quedaría más caro por unidad que la unidad suelta. Usá «Editar todo» para ajustar también las presentaciones.';
 return'';}
function posApplyPrice(p,pr,cost){const old=p.price,oc=p.cost;if(old===pr&&(cost==null||oc===cost))return false;
 audit('PRECIO_PRODUCTO',p.name+': precio '+money(old)+' → '+money(pr)+(cost!=null&&oc!==cost?' · costo '+money(oc)+' → '+money(cost):'')+' · desde Vender');
 p.price=pr;if(cost!=null)p.cost=cost;
 /* las líneas del ticket con el precio anterior (no puestas a mano) pasan al precio nuevo */
 pos.lines.forEach(l=>{if(l.pid===p.id&&!l.man&&l.price===old){l.price=pr;l.list=pr;}if(l.pid===p.id&&cost!=null)l.cost=cost;});
 save();if(typeof pubRefresh==='function')pubRefresh();return true;}
A.posEditPrice=el=>{if(!can('edit_products'))return toast('Sin permiso para cambiar precios',1);const p=prod(el.dataset.id);if(!p)return;const cv=can('view_cost');
 const w=modal('Cambiar precio',`<p style="margin-top:0"><b>${esc(pfull(p))}</b><br><span class="sm mut">${esc(rubName(p.rubro))} · precio actual ${money(p.price)}${p.unit!=='u'?' / '+unitLbl(p.unit):''}</span></p>
  <label for="qp-p">Precio de venta ($)</label>${numIn('qp-p',p.price)}
  ${cv?`<label for="qp-c">Costo ($)</label>${numIn('qp-c',p.cost)}<p id="qp-m" class="sm mut"></p>`:''}
  ${posPresEd(p)?`<fieldset style="border:1px solid var(--line);border-radius:12px;padding:.5rem .7rem;margin:.6rem 0"><legend class="sm"><b>Precios mayoristas (por unidad)</b></legend>${posPresList(p).map(({k,i})=>`<label for="qp-k${i}">${esc(typeof wsLvName==='function'?wsLvName(k.lv):k.lv)} ×${numAR(k.qty,3)} — precio por unidad ($)</label>${numIn('qp-k'+i,k.unit)}`).join('')}<p class="sm mut" style="margin:.3rem 0 0">A más cantidad, el precio por unidad no puede subir.</p></fieldset>`:''}
  <p class="sm mut">Cambia el precio en el inventario${p.menu?' y en el menú público':''}. Queda registrado en Auditoría.</p>
  <button type="button" class="btn sm" id="qp-all">Editar todo el artículo…</button>`,
  {okText:'Guardar precio',onOk:w=>{const pr=cents(val('qp-p'));if(!(pr>0))return w._err('El precio de venta debe ser mayor a cero.'),false;
   let cost=null;if(cv){const c=cents(val('qp-c')===''?'0':val('qp-c'));if(isNaN(c)||c<0)return w._err('Costo inválido.'),false;cost=c;}
   let np=null;if(posPresEd(p)){np=(p.pres||[]).map(k=>Object.assign({},k));for(const {i} of posPresList(p)){const c=cents(val('qp-k'+i));if(!(c>0))return w._err('Cada precio mayorista debe ser mayor a cero.'),false;np[i].unit=c;}
    const ord=np.map((k,i)=>({k,i})).filter(x=>x.k&&x.k.qty>0).sort((a,b)=>a.k.qty-b.k.qty);let prev=pr;for(const x of ord){if(x.k.unit>prev)return w._err((typeof wsLvName==='function'?wsLvName(x.k.lv):'Una presentación')+' quedaría más cara por unidad ('+money(x.k.unit)+') que la cantidad menor ('+money(prev)+').'),false;prev=x.k.unit;}}
   else{const e2=posPriceCheck(p,pr);if(e2)return w._err(e2),false;}
   let chP=false;if(np&&JSON.stringify(np)!==JSON.stringify(p.pres)){p.pres=np;chP=true;audit('PRESENTACIONES_PRODUCTO',p.name+' · '+np.map(k=>(typeof wsLvName==='function'?wsLvName(k.lv):k.lv)+' ×'+k.qty+' '+money(k.unit)+'/u').join(' · ')+' · desde Vender');}
   const ch=posApplyPrice(p,pr,cost)||chP;if(chP){save();if(typeof pubRefresh==='function')pubRefresh();}rerender();toast(ch?'Precio de '+p.name+': '+money(pr):'Sin cambios');}});
 const upd=()=>{const m=$('#qp-m',w);if(!m)return;const pr=cents(val('qp-p')),c=cents(val('qp-c'));m.textContent=pr>0&&c>0?'Margen bruto: '+numAR((pr-c)/pr*100,1)+' %':'';};
 w.addEventListener('input',upd);upd();
 $('#qp-all',w).addEventListener('click',()=>{w.remove();A.pedit({dataset:{id:p.id}});});};
A.posNewItem=()=>{if(!can('edit_products'))return toast('Sin permiso para crear artículos',1);const q=(pos.q||'').trim();
 pEditAfter=np=>{pos.q='';const s=$('#psearch');if(s)s.value='';posGrid();A.padd({dataset:{id:np.id}});toast('Artículo creado y agregado al ticket: '+np.name);};
 A.pedit({dataset:{id:''}});
 const n=$('#pm-n'),b=$('#pm-b'),r=$('#pm-r');
 if(q&&/^\d{6,}$/.test(q)){if(b)b.value=q;}else if(q&&n&&!/^[<>$\d.,\-]+$/.test(q)){n.value=q.charAt(0).toUpperCase()+q.slice(1);}
 if(r&&pos.rub&&rub(pos.rub))r.value=pos.rub;
 setTimeout(()=>{const f=$('#pm-n');if(f&&!f.value)f.focus();else{const pf=$('#pm-f');if(pf)pf.focus();}},50);};
function posSaveBtn(l,i){if(!l.man||!can('edit_products'))return'';const p=prod(l.pid);if(!p||isKit(p)||l.price===p.price)return'';
 if(typeof wsOn==='function'&&wsOn()&&typeof wsChan==='function'&&wsChan()==='mayorista')return'';
 return`<button class="btn sm" style="margin-top:.35rem" data-act="posSavePrice" data-i="${i}">Guardar ${money(l.price)} como precio de ${esc(p.name)}</button>`;}
A.posSavePrice=el=>{if(!can('edit_products'))return toast('Sin permiso',1);const l=pos.lines[+el.dataset.i];if(!l)return;const p=prod(l.pid);if(!p)return;
 const e=posPriceCheck(p,l.price);if(e)return toast(e,1);
 modal('Guardar precio',`<p>¿Cambiar el precio de <b>${esc(p.name)}</b> de ${money(p.price)} a <b>${money(l.price)}</b> en el inventario${p.menu?' y en el menú':''}?</p>`,
  {okText:'Sí, guardar',onOk:()=>{posApplyPrice(p,l.price,null);l.man=0;l.list=l.price;rerender();toast('Precio guardado: '+p.name+' '+money(l.price));}});};
