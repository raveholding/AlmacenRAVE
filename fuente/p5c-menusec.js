/* ===== V26.18 · Menú público editable: secciones, sección de cada producto y foto =====
   · Secciones del menú = los rubros/categorías que se muestran + «secciones sólo del menú» (kind 'msec': Ofertas, Novedades…).
     Una sección sólo del menú NO tiene dinero, caja ni reparto: sólo ordena el menú. Se crean, editan, ordenan y borran
     desde Menú público → «Secciones del menú».
   · Cada producto elige en qué sección del menú aparece (p.msec); si no elige, va a la de su rubro/categoría.
   · Foto del producto: se carga desde el equipo o el celular (cámara), se achica en el navegador (máx. 480 px, WebP/JPEG)
     y se guarda con el producto (p.img). «Quitar foto» (p.imgOff) también oculta la foto que traía el catálogo. */
const MSEC_LAYOUTS=[['grid','Grilla (tarjetas)'],['rows','Filas (lista)'],['bodegas','Por bodega / grupo']];
const isMenuSec=r=>!!r&&(r.kind==='rubro'||r.kind==='msec')&&!!r.layout;
function menuSecs(all){const L=S.rubros.filter(r=>isMenuSec(r)&&(all||r.menuOn!==false));
 const pos=new Map(S.rubros.map((r,i)=>[r.id,i]));
 return L.slice().sort((a,b)=>((a.mOrd!==undefined?a.mOrd:1000+pos.get(a.id))-(b.mOrd!==undefined?b.mOrd:1000+pos.get(b.id))));}
const prodMenuSec=p=>{const s=p.msec?rub(p.msec):null;return s&&isMenuSec(s)?s.id:p.rubro;};
const prodImg=p=>p.imgOff?'':(safeImg(p.img)||((typeof IMGS!=='undefined'&&IMGS[p.id])||''));
function safeImg(u){return typeof u==='string'&&/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(u)&&u.length<=300000?u:'';}
/* ---------- tarjeta en Menú público ---------- */
function menuSecCard(){const L=menuSecs(true);const cnt=id=>S.products.filter(p=>!p.archived&&p.menu&&prodMenuSec(p)===id).length;const ed=can('menu_admin');
 return`<div class="card" style="margin-top:1rem" id="msec-card"><div class="row"><h3 class="sp">Secciones del menú</h3>${ed?'<button class="btn sm gold" data-act="msecAdd">+ Nueva sección</button>':''}</div>
 <p class="sm mut">Son los títulos del menú (Promos, Vinos, Ofertas…). Las que dicen <b>${esc(RW())}</b> salen de tus ${esc(RWs())}; las <b>sólo del menú</b> no tienen dinero ni caja: sirven para agrupar productos en el menú. Cada producto elige su sección en Inventario (o queda en la de su ${esc(RW())}).</p>
 <div class="tw"><table id="msec-tbl"><thead><tr><th>Orden</th><th>Sección</th><th>Tipo</th><th class="r">Productos en el menú</th><th>Se muestra</th><th></th></tr></thead><tbody>
 ${L.map((r,i)=>`<tr><td>${ed?`<button class="btn sm" data-act="msecMove" data-id="${r.id}" data-d="-1" ${i===0?'disabled':''} aria-label="Subir ${esc(r.mNom||r.name)}">↑</button> <button class="btn sm" data-act="msecMove" data-id="${r.id}" data-d="1" ${i===L.length-1?'disabled':''} aria-label="Bajar ${esc(r.mNom||r.name)}">↓</button>`:i+1}</td>
  <td><i class="rdot" style="background:${safeColor(r.color)}"></i> <b>${esc(r.mNom||r.name)}</b>${r.mTitle&&r.mTitle!==(r.mNom||r.name)?`<div class="sm mut">${esc(r.mTitle)}</div>`:''}</td>
  <td>${r.kind==='msec'?'Sólo del menú':esc(RW(1))+' «'+esc(r.name)+'»'}</td><td class="r">${cnt(r.id)}</td>
  <td>${ed?`<label class="chk" style="margin:0"><input type="checkbox" data-msecon="${r.id}" ${r.menuOn!==false?'checked':''}> sí</label>`:(r.menuOn!==false?'sí':'no')}</td>
  <td class="r">${ed?`<button class="btn sm" data-act="${r.kind==='msec'?'msecEdit':'rubEdit'}" data-id="${r.id}">Editar</button>${r.kind==='msec'?` <button class="btn sm red" data-act="msecDel" data-id="${r.id}">Eliminar</button>`:''}`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="mut">No hay secciones.</td></tr>'}
 </tbody></table></div></div>`;}
document.addEventListener('change',e=>{const id=e.target&&e.target.dataset&&e.target.dataset.msecon;if(!id)return;if(!can('menu_admin')){e.target.checked=!e.target.checked;return toast('Sin permiso',1);}
 const r=rub(id);if(!r)return;r.menuOn=e.target.checked;audit('MENU_SECCION_VISIBLE',(r.mNom||r.name)+' · '+(r.menuOn?'se muestra':'oculta'));save();pubRefreshSafe();rerender();});
function pubRefreshSafe(){try{if(typeof pubRefresh==='function')pubRefresh();}catch(e){}try{if(typeof pubReload==='function')pubReload();}catch(e){}}
A.msecMove=el=>{if(!can('menu_admin'))return toast('Sin permiso',1);const L=menuSecs(true);const i=L.findIndex(r=>r.id===el.dataset.id);const j=i+(+el.dataset.d);if(i<0||j<0||j>=L.length)return;
 const t=L[i];L[i]=L[j];L[j]=t;L.forEach((r,k)=>{r.mOrd=k;});audit('MENU_SECCION_ORDEN',L.map(r=>r.mNom||r.name).join(' > ').slice(0,300));save();pubRefreshSafe();rerender();};
A.msecAdd=()=>A.msecEdit({dataset:{id:''}});
A.msecEdit=el=>{if(!can('menu_admin'))return toast('Sin permiso',1);const r=el&&el.dataset.id?rub(el.dataset.id):null;if(el&&el.dataset.id&&(!r||r.kind!=='msec'))return;
 const col=safeColor(r?r.color:RUB_COLORS[(S.rubros.length)%RUB_COLORS.length]);
 const w=modal(r?'Editar sección del menú':'Nueva sección del menú',`<p class="sm mut">Sólo ordena el menú público: no tiene dinero, caja ni reparto.</p>
 <label for="ms-n">Nombre en el menú</label><input id="ms-n" maxlength="30" value="${esc(r?(r.mNom||r.name):'')}" autocomplete="off" placeholder="Ej.: Ofertas de la semana">
 <label for="ms-t">Título de la sección (opcional)</label><input id="ms-t" maxlength="60" value="${esc(r&&r.mTitle&&r.mTitle!==r.mNom?r.mTitle:'')}" autocomplete="off">
 <label for="ms-h">Aclaración debajo del título (opcional)</label><input id="ms-h" maxlength="80" value="${esc(r?r.mHint||'':'')}" autocomplete="off">
 <label for="ms-l">Diseño</label><select id="ms-l">${MSEC_LAYOUTS.map(([v,t])=>`<option value="${v}" ${(r?r.layout:'grid')===v?'selected':''}>${t}</option>`).join('')}</select>
 <label>Color</label><div class="row" id="ms-cols">${RUB_COLORS.map(c=>`<button type="button" class="swatch ${c.toLowerCase()===col.toLowerCase()?'on':''}" data-col="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div><input type="hidden" id="ms-c" value="${col}">
 <label class="chk"><input type="checkbox" id="ms-a" ${r&&r.alcohol?'checked':''}> Tiene bebidas con alcohol (se ocultan fuera del horario permitido)</label>
 <label class="chk"><input type="checkbox" id="ms-on" ${!r||r.menuOn!==false?'checked':''}> Mostrar en el menú</label>`,
 {okText:'Guardar sección',onOk:w=>{const n=val('ms-n').trim();if(n.length<2)return w._err('Escribí el nombre (mínimo 2 letras).'),false;
  if(S.rubros.some(x=>isMenuSec(x)&&norm(x.mNom||x.name)===norm(n)&&(!r||x.id!==r.id)))return w._err('Ya hay una sección con ese nombre.'),false;
  const d={name:n,mNom:n,mTitle:val('ms-t').trim()||n,mHint:val('ms-h').trim(),layout:MSEC_LAYOUTS.some(x=>x[0]===val('ms-l'))?val('ms-l'):'grid',color:safeColor(val('ms-c')),alcohol:$('#ms-a',w).checked,menuOn:$('#ms-on',w).checked};
  if(r){Object.assign(r,d);audit('MENU_SECCION_EDITAR',n);}else{const L=menuSecs(true);L.forEach((x,k)=>{x.mOrd=k;});S.rubros.push(Object.assign({id:uid(),kind:'msec',owner:'',reparte:false,mOrd:L.length},d));audit('MENU_SECCION_ALTA',n);}
  save();pubRefreshSafe();rerender();toast('Sección guardada');}});
 w.addEventListener('click',e=>{const b=e.target.closest('.swatch');if(!b)return;$('#ms-c',w).value=b.dataset.col;$$('.swatch',w).forEach(x=>x.classList.toggle('on',x===b));});};
A.msecDel=el=>{if(!can('menu_admin'))return toast('Sin permiso',1);const r=rub(el.dataset.id);if(!r||r.kind!=='msec')return;const ps=S.products.filter(p=>p.msec===r.id);
 confirmBox('Eliminar sección del menú','«'+(r.mNom||r.name)+'» se borra del menú.'+(ps.length?' Sus '+ps.length+' producto(s) vuelven a la sección de su '+RW()+'.':'')+' No cambia ventas, stock ni dinero.',
  ()=>{ps.forEach(p=>{delete p.msec;});S.rubros=S.rubros.filter(x=>x.id!==r.id);audit('MENU_SECCION_BAJA',(r.mNom||r.name)+(ps.length?' · '+ps.length+' productos a su '+RW():''));save();pubRefreshSafe();rerender();toast('Sección eliminada');},'Eliminar');};
/* ---------- bloque en el alta/edición de producto ---------- */
function menuProdBlock(p){const secs=menuSecs(true);const own=p?rub(p.rubro):null;const cur=p&&p.msec&&rub(p.msec)?p.msec:'';const img=p?prodImg(p):'';
 return`<fieldset class="card" id="mpb" style="margin:.6rem 0;padding:.7rem"><legend class="sm"><b>Menú público</b></legend>
 <label for="pm-ms">Sección del menú donde aparece</label><select id="pm-ms"><option value="">La de su ${esc(RW())}${own?' ('+esc(own.mNom||own.name)+')':''}</option>${secs.map(s=>`<option value="${s.id}" ${cur===s.id?'selected':''}>${esc(s.mNom||s.name)}${s.kind==='msec'?' · sólo del menú':''}${s.menuOn===false?' (oculta)':''}</option>`).join('')}</select>
 ${can('menu_admin')?'<p class="sm mut">¿Falta una sección? Creala en <a href="#panel/menuadmin">Menú público → Secciones del menú</a>.</p>':''}
 <label>Foto del producto</label><div class="row" style="gap:.6rem;align-items:center"><img id="pm-imgv" alt="Foto de ${esc(p?p.name:'producto')}" src="${img||''}" style="width:96px;height:96px;object-fit:cover;border-radius:12px;border:1px solid var(--line);${img?'':'display:none'}">
 <span id="pm-imgn" class="sm mut" ${img?'hidden':''}>Sin foto</span>
 <label class="btn sm" for="pm-imgf">${img?'Cambiar foto':'Cargar foto'}</label><input type="file" id="pm-imgf" accept="image/*" hidden>
 <button type="button" class="btn sm" id="pm-imgx" ${img?'':'hidden'}>Quitar foto</button></div>
 <p class="sm mut" id="pm-imgs">Desde la computadora o el celular (abre la cámara). Se achica sola para que el menú cargue rápido.</p></fieldset>`;}
async function imgShrink(file){if(!file||!/^image\//.test(file.type))throw new Error('Elegí un archivo de imagen (JPG, PNG o WebP).');if(file.size>15*1024*1024)throw new Error('La imagen es muy grande (más de 15 MB).');
 const url=URL.createObjectURL(file);try{const im=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('No se pudo leer la imagen.'));i.src=url;});
  const M=480,s=Math.min(1,M/Math.max(im.naturalWidth,im.naturalHeight));const w=Math.max(1,Math.round(im.naturalWidth*s)),h=Math.max(1,Math.round(im.naturalHeight*s));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);
  let q=0.78,d=c.toDataURL('image/webp',q);if(!/^data:image\/webp/.test(d))d=c.toDataURL('image/jpeg',q);
  while(d.length>90000&&q>0.4){q-=0.12;d=/^data:image\/webp/.test(d)?c.toDataURL('image/webp',q):c.toDataURL('image/jpeg',q);}
  if(!safeImg(d))throw new Error('La foto quedó demasiado grande: probá con otra.');return d;}finally{URL.revokeObjectURL(url);}}
function menuProdBind(w,p){const f=w.querySelector('#pm-imgf');if(!f)return;const v=w.querySelector('#pm-imgv'),n=w.querySelector('#pm-imgn'),x=w.querySelector('#pm-imgx'),s=w.querySelector('#pm-imgs');
 const show=src=>{v.src=src||'';v.style.display=src?'':'none';n.hidden=!!src;x.hidden=!src;};
 f.addEventListener('change',async()=>{const file=f.files&&f.files[0];if(!file)return;s.textContent='Achicando la foto…';
  try{const d=await imgShrink(file);w._img=d;show(d);s.textContent='Foto lista ('+Math.round(d.length*0.75/1024)+' KB). Se guarda al tocar «Guardar».';}catch(e){s.textContent=e.message;s.classList.add('errtxt');}f.value='';});
 x.addEventListener('click',()=>{w._img='';show('');s.textContent='La foto se quita al tocar «Guardar».';});}
/* lee lo del bloque: {msec, img|undefined (sin cambio), imgOff} */
function menuProdRead(w){const ms=val('pm-ms');const o={msec:ms&&rub(ms)&&isMenuSec(rub(ms))?ms:''};
 if(w._img!==undefined){if(w._img){if(!safeImg(w._img))return{err:'La foto no es válida.'};o.img=w._img;o.imgOff=false;}else{o.img='';o.imgOff=true;}}return o;}
/* tamaño estimado del menú publicado (la nube acepta hasta 3 MB) */
function menuSizeKB(){try{return Math.round(JSON.stringify(pubCatalog()).length/1024);}catch(e){return 0;}}
