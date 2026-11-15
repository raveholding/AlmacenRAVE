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
 const em=L.filter(r=>r.menuOn!==false&&!cnt(r.id));
 return`<div class="card" style="margin-top:1rem" id="msec-card"><div class="row" style="flex-wrap:wrap;gap:.5rem"><h3 class="sp">Secciones del menú</h3><button class="btn sm" data-act="mpPreview">Ver cómo queda</button>${ed?'<button class="btn sm gold" data-act="msecAdd">+ Nueva sección</button>':''}</div>
 ${em.length?`<div class="warnbox" id="msec-empty">Sin productos en el menú: <b>${em.map(r=>esc(r.mNom||r.name)).join(', ')}</b>. No se muestran al público hasta que tengan productos (tocá «Productos» para agregarlos) o podés ocultarlas.</div>`:''}
 <p class="sm mut">Son los títulos del menú, en el orden en que se ven. Tocá <b>Editar</b> para cambiar el nombre, el título que se ve arriba de los productos, la aclaración, el diseño, el color, el tipo o el ${esc(RW())}. Las <b>sólo del menú</b> no tienen dinero ni caja.</p>
 <div id="msec-list">${L.map((r,i)=>`<div class="msec-item" data-sec="${r.id}" style="border:1px solid var(--line);border-left:6px solid ${safeColor(r.color)};border-radius:12px;padding:.6rem .7rem;margin:.5rem 0;${r.menuOn===false?'background:var(--bg)':''}">
  <div class="row" style="flex-wrap:wrap;gap:.5rem;align-items:center">${ed?`<span><button class="btn sm" data-act="msecMove" data-id="${r.id}" data-d="-1" ${i===0?'disabled':''} aria-label="Subir ${esc(r.mNom||r.name)}">↑</button> <button class="btn sm" data-act="msecMove" data-id="${r.id}" data-d="1" ${i===L.length-1?'disabled':''} aria-label="Bajar ${esc(r.mNom||r.name)}">↓</button></span>`:`<span class="sm mut">${i+1}</span>`}
   <span class="sp" style="min-width:160px"><b>${esc(r.mNom||r.name)}</b>${r.menuOn===false?' <span class="tag bad">oculta</span>':''}<div class="sm mut">Título: ${esc(r.mTitle||r.mNom||r.name)}${r.mHint?' · '+esc(r.mHint):''}</div><div class="sm mut">${r.kind==='msec'?'Tipo: sólo del menú':'Tipo: '+esc(RW())+' «'+esc(r.name)+'»'} · ${cnt(r.id)} producto${cnt(r.id)===1?'':'s'} en el menú</div></span></div>
  <div class="row" style="flex-wrap:wrap;gap:.4rem;margin-top:.45rem">${ed?`<button class="btn sm gold" data-act="msecEdit" data-id="${r.id}">Editar</button>`:''}
   <button class="btn sm" data-act="msecProds" data-id="${r.id}" aria-expanded="${msecOpen===r.id}">${msecOpen===r.id?'Cerrar productos':'Productos'}</button>
   ${ed?`<label class="chk" style="margin:0"><input type="checkbox" data-msecon="${r.id}" ${r.menuOn!==false?'checked':''}> se muestra</label>`:''}
   ${ed?(r.kind==='msec'?`<button class="btn sm red" data-act="msecDel" data-id="${r.id}">Eliminar</button>`:`<button class="btn sm red" data-act="msecRubDel" data-id="${r.id}">Eliminar</button>`):''}</div>
  ${msecOpen===r.id?`<div class="msec-prow" style="margin-top:.4rem">${msecProdsHTML(r,ed)}</div>`:''}</div>`).join('')||'<p class="mut">No hay secciones.</p>'}</div></div>`;}
document.addEventListener('change',e=>{const id=e.target&&e.target.dataset&&e.target.dataset.msecon;if(!id)return;if(!can('menu_admin')){e.target.checked=!e.target.checked;return toast('Sin permiso',1);}
 const r=rub(id);if(!r)return;r.menuOn=e.target.checked;audit('MENU_SECCION_VISIBLE',(r.mNom||r.name)+' · '+(r.menuOn?'se muestra':'oculta'));save();pubRefreshSafe();rerender();});
function pubRefreshSafe(){try{if(typeof pubRefresh==='function')pubRefresh();}catch(e){}try{if(typeof pubReload==='function')pubReload();}catch(e){}}
A.msecMove=el=>{if(!can('menu_admin'))return toast('Sin permiso',1);const L=menuSecs(true);const i=L.findIndex(r=>r.id===el.dataset.id);const j=i+(+el.dataset.d);if(i<0||j<0||j>=L.length)return;
 const t=L[i];L[i]=L[j];L[j]=t;L.forEach((r,k)=>{r.mOrd=k;});audit('MENU_SECCION_ORDEN',L.map(r=>r.mNom||r.name).join(' > ').slice(0,300));save();pubRefreshSafe();rerender();};
A.msecAdd=()=>A.msecEdit({dataset:{id:''}});
A.msecEdit=el=>{if(!can('menu_admin'))return toast('Sin permiso',1);const r=el&&el.dataset.id?rub(el.dataset.id):null;if(el&&el.dataset.id&&!isMenuSec(r))return;
 const isRub=!!r&&r.kind==='rubro';const col=safeColor(r?r.color:RUB_COLORS[(S.rubros.length)%RUB_COLORS.length]);
 const nProdsRub=r?S.products.filter(p=>p.rubro===r.id&&!p.archived).length:0;
 const histRub=r?(S.sales.some(s=>(s.items||[]).some(i=>i.rubro===r.id))||S.movs.some(m=>m.rubro===r.id)):false;
 const w=modal(r?'Editar sección del menú':'Nueva sección del menú',`
 <label for="ms-n">Nombre en el menú (botón de filtro)</label><input id="ms-n" maxlength="30" value="${esc(r?(r.mNom||r.name):'')}" autocomplete="off" placeholder="Ej.: Ofertas de la semana">
 <label for="ms-t">Título de la sección (arriba de los productos)</label><input id="ms-t" maxlength="60" value="${esc(r?(r.mTitle||r.mNom||r.name):'')}" autocomplete="off" placeholder="Igual que el nombre">
 <label for="ms-h">Aclaración debajo del título (opcional)</label><input id="ms-h" maxlength="80" value="${esc(r?r.mHint||'':'')}" autocomplete="off">
 <label for="ms-l">Diseño</label><select id="ms-l">${MSEC_LAYOUTS.map(([v,t])=>`<option value="${v}" ${(r?r.layout:'grid')===v?'selected':''}>${t}</option>`).join('')}</select>
 <label>Color</label><div class="row" id="ms-cols" style="flex-wrap:wrap">${RUB_COLORS.map(c=>`<button type="button" class="swatch ${c.toLowerCase()===col.toLowerCase()?'on':''}" data-col="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div><input type="hidden" id="ms-c" value="${col}">
 <label class="chk"><input type="checkbox" id="ms-a" ${r&&r.alcohol?'checked':''}> Tiene bebidas con alcohol (se ocultan fuera del horario permitido)</label>
 <label class="chk"><input type="checkbox" id="ms-on" ${!r||r.menuOn!==false?'checked':''}> Mostrar en el menú</label>
 <fieldset class="card" style="padding:.6rem;margin-top:.6rem"><legend class="sm"><b>Tipo</b></legend>
  <label class="chk"><input type="radio" name="ms-k" value="msec" ${!isRub?'checked':''} ${isRub&&(nProdsRub||histRub)?'disabled':''}> <span>Sólo del menú <span class="sm mut">(sin dinero ni caja)</span></span></label>
  <label class="chk"><input type="radio" name="ms-k" value="rubro" ${isRub?'checked':''}> <span>${esc(RW(1))} del sistema <span class="sm mut">(aparece en Inventario, Vender, Caja${ownerMode()?'':' y reparto'})</span></span></label>
  ${isRub&&(nProdsRub||histRub)?`<p class="sm mut">No se puede pasar a «sólo del menú» porque el ${esc(RW())} tiene ${nProdsRub?nProdsRub+' producto(s)':''}${nProdsRub&&histRub?' y ':''}${histRub?'ventas o movimientos':''}.</p>`:''}
  <div id="ms-rbox" ${isRub?'':'hidden'}><label for="ms-rn">Nombre del ${esc(RW())} en el sistema</label><input id="ms-rn" maxlength="40" value="${esc(r&&isRub?r.name:'')}" autocomplete="off">
  ${ownerMode()?'':`<label for="ms-ro">Responsable (opcional)</label><input id="ms-ro" maxlength="40" value="${esc(r&&isRub?r.owner||'':'')}" autocomplete="off">`}</div></fieldset>`,
 {okText:'Guardar sección',onOk:w=>{const n=val('ms-n').trim();if(n.length<2)return w._err('Escribí el nombre (mínimo 2 letras).'),false;
  if(S.rubros.some(x=>isMenuSec(x)&&norm(x.mNom||x.name)===norm(n)&&(!r||x.id!==r.id)))return w._err('Ya hay una sección con ese nombre.'),false;
  const kind=(w.querySelector('input[name=ms-k]:checked')||{}).value==='rubro'?'rubro':'msec';
  const d={mNom:n,mTitle:val('ms-t').trim()||n,mHint:val('ms-h').trim(),layout:MSEC_LAYOUTS.some(x=>x[0]===val('ms-l'))?val('ms-l'):'grid',color:safeColor(val('ms-c')),alcohol:$('#ms-a',w).checked,menuOn:$('#ms-on',w).checked};
  if(kind==='rubro'){const rn=(val('ms-rn')||'').trim()||n;if(rn.length<2)return w._err('Escribí el nombre del '+RW()+'.'),false;
   if(S.rubros.some(x=>x.kind==='rubro'&&norm(x.name)===norm(rn)&&(!r||x.id!==r.id)))return w._err('Ya existe '+(ownerMode()?'una categoría':'un rubro')+' con ese nombre.'),false;d.name=rn;if(!ownerMode()&&w.querySelector('#ms-ro'))d.owner=val('ms-ro').trim();}
  else{if(isRub&&(nProdsRub||histRub))return w._err('Este '+RW()+' tiene productos o historial: no puede pasar a «sólo del menú».'),false;d.name=n;}
  const old=r?{kind:r.kind,name:r.name,mNom:r.mNom,mTitle:r.mTitle}:null;
  if(r){Object.assign(r,d);if(r.kind!==kind){r.kind=kind;if(kind==='rubro'){r.reparte=false;r.owner=r.owner||'';}audit('MENU_SECCION_TIPO',n+' · '+(old.kind==='msec'?'sólo del menú':RW())+' → '+(kind==='msec'?'sólo del menú':RW()));}
   audit('MENU_SECCION_EDITAR',n+(old.name!==r.name?' · '+RW()+' «'+old.name+'» → «'+r.name+'»':'')+(old.mTitle!==r.mTitle?' · título «'+(old.mTitle||'')+'» → «'+r.mTitle+'»':''));}
  else{const L=menuSecs(true);L.forEach((x,k)=>{x.mOrd=k;});const nr=Object.assign({id:uid(),kind,owner:d.owner||'',reparte:false,mOrd:L.length},d);
   if(kind==='rubro'){const k0=S.rubros.findIndex(x=>x.kind!=='rubro'&&x.kind!=='msec');if(k0>=0)S.rubros.splice(k0,0,nr);else S.rubros.push(nr);}else S.rubros.push(nr);audit('MENU_SECCION_ALTA',n+' · '+(kind==='msec'?'sólo del menú':RW()));}
  save();pubRefreshSafe();rerender();toast('Sección guardada');}});
 w.addEventListener('change',e=>{if(e.target.name==='ms-k'){const rb=w.querySelector('#ms-rbox');rb.hidden=e.target.value!=='rubro';const rn=w.querySelector('#ms-rn');if(rn&&!rn.value)rn.value=val('ms-n');}});
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
function imgLoad(file){if(!file||!/^image\//.test(file.type))return Promise.reject(new Error('Elegí un archivo de imagen (JPG, PNG o WebP).'));if(file.size>15*1024*1024)return Promise.reject(new Error('La imagen es muy grande (más de 15 MB).'));
 const url=URL.createObjectURL(file);return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('No se pudo leer la imagen.'));i.src=url;}).finally(()=>setTimeout(()=>URL.revokeObjectURL(url),5000));}
/* achica un recorte {sx,sy,sw,sh} de la imagen a máx. 480 px y lo codifica (WebP o JPEG, ≤ ~90 KB) */
function imgEncode(im,r){r=r||{sx:0,sy:0,sw:im.naturalWidth,sh:im.naturalHeight};const M=480,k=Math.min(1,M/Math.max(r.sw,r.sh));const w=Math.max(1,Math.round(r.sw*k)),h=Math.max(1,Math.round(r.sh*k));
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,r.sx,r.sy,r.sw,r.sh,0,0,w,h);
 let q=0.8,d=c.toDataURL('image/webp',q);const webp=/^data:image\/webp/.test(d);if(!webp)d=c.toDataURL('image/jpeg',q);
 while(d.length>90000&&q>0.4){q-=0.12;d=webp?c.toDataURL('image/webp',q):c.toDataURL('image/jpeg',q);}
 if(!safeImg(d))throw new Error('La foto quedó demasiado grande: probá con otra.');return d;}
async function imgShrink(file){return imgEncode(await imgLoad(file));}
/* ---------- recortar la foto al cargarla: forma, acercar y mover ---------- */
const CROP_AR=[['1','Cuadrada'],['1.333','Horizontal 4:3'],['0.75','Vertical 3:4'],['0','Original (sin recortar)']];
function imgCropModal(im){return new Promise(resolve=>{let done=false;const fin=v=>{if(!done){done=true;resolve(v);}};
 const W=300;const st={ar:1,z:1,cx:im.naturalWidth/2,cy:im.naturalHeight/2};
 const w=modal('Recortar la foto',`<p class="sm mut">Elegí la forma, acercá con la barra y arrastrá la foto para encuadrar. Lo de afuera del recuadro no se guarda.</p>
 <div class="row" style="gap:.4rem;flex-wrap:wrap">${CROP_AR.map(([v,t])=>`<button type="button" class="btn sm ${v==='1'?'gold':''}" data-crar="${v}">${t}</button>`).join('')}</div>
 <div style="display:flex;justify-content:center;margin:.6rem 0"><canvas id="crop-cv" width="${W}" height="${W}" style="max-width:100%;touch-action:none;cursor:grab;border-radius:12px;background:#222" aria-label="Vista del recorte"></canvas></div>
 <label for="crop-z">Acercar</label><input type="range" id="crop-z" min="1" max="4" step="0.01" value="1" style="width:100%">`,{okText:'Usar esta foto',onOk:()=>{fin(rect());}});
 w.addEventListener('click',e=>{if(e.target.closest('.mf [data-m="x"]'))fin(null);},true);
 const cv=w.querySelector('#crop-cv'),ctx=cv.getContext('2d'),IW=im.naturalWidth,IH=im.naturalHeight;
 function rect(){if(!st.ar)return{sx:0,sy:0,sw:IW,sh:IH};let bw,bh;if(IW/IH>st.ar){bh=IH;bw=IH*st.ar;}else{bw=IW;bh=IW/st.ar;}
  const sw=bw/st.z,sh=bh/st.z;let sx=st.cx-sw/2,sy=st.cy-sh/2;sx=Math.max(0,Math.min(IW-sw,sx));sy=Math.max(0,Math.min(IH-sh,sy));st.cx=sx+sw/2;st.cy=sy+sh/2;return{sx,sy,sw,sh};}
 function draw(){const r=rect();const k=Math.min(W/r.sw,W/r.sh);const dw=r.sw*k,dh=r.sh*k;cv.width=Math.round(dw);cv.height=Math.round(dh);ctx.drawImage(im,r.sx,r.sy,r.sw,r.sh,0,0,cv.width,cv.height);
  ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=2;ctx.strokeRect(1,1,cv.width-2,cv.height-2);}
 w.querySelectorAll('[data-crar]').forEach(b=>b.addEventListener('click',()=>{st.ar=+b.dataset.crar;w.querySelectorAll('[data-crar]').forEach(x=>x.classList.toggle('gold',x===b));const zr=w.querySelector('#crop-z');zr.disabled=!st.ar;draw();}));
 w.querySelector('#crop-z').addEventListener('input',e=>{st.z=+e.target.value||1;draw();});
 let drag=null;cv.addEventListener('pointerdown',e=>{if(!st.ar)return;drag={x:e.clientX,y:e.clientY,cx:st.cx,cy:st.cy};cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing';});
 cv.addEventListener('pointermove',e=>{if(!drag)return;const r=rect();const k=r.sw/cv.getBoundingClientRect().width;st.cx=drag.cx-(e.clientX-drag.x)*k;st.cy=drag.cy-(e.clientY-drag.y)*k;draw();});
 const up=()=>{drag=null;cv.style.cursor='grab';};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
 w._crop={st,rect,draw};draw();});}
function menuProdBind(w,p){const f=w.querySelector('#pm-imgf');if(!f)return;const v=w.querySelector('#pm-imgv'),n=w.querySelector('#pm-imgn'),x=w.querySelector('#pm-imgx'),s=w.querySelector('#pm-imgs');
 const show=src=>{v.src=src||'';v.style.display=src?'':'none';n.hidden=!!src;x.hidden=!src;};
 f.addEventListener('change',async()=>{const file=f.files&&f.files[0];if(!file)return;s.textContent='Achicando la foto…';
  try{const im=await imgLoad(file);s.textContent='Recortá la foto…';const r=await imgCropModal(im);if(!r){s.textContent='No se cambió la foto.';f.value='';return;}const d=imgEncode(im,r);w._img=d;show(d);s.textContent='Foto lista ('+Math.round(d.length*0.75/1024)+' KB). Se guarda al tocar «Guardar».';}catch(e){s.textContent=e.message;s.classList.add('errtxt');}f.value='';});
 x.addEventListener('click',()=>{w._img='';show('');s.textContent='La foto se quita al tocar «Guardar».';});}
/* lee lo del bloque: {msec, img|undefined (sin cambio), imgOff} */
function menuProdRead(w){const ms=val('pm-ms');const o={msec:ms&&rub(ms)&&isMenuSec(rub(ms))?ms:''};
 if(w._img!==undefined){if(w._img){if(!safeImg(w._img))return{err:'La foto no es válida.'};o.img=w._img;o.imgOff=false;}else{o.img='';o.imgOff=true;}}return o;}
/* tamaño estimado del menú publicado (la nube acepta hasta 3 MB) */
function menuSizeKB(){try{return Math.round(JSON.stringify(pubCatalog()).length/1024);}catch(e){return 0;}}

/* V26.20: una sección que sale de un rubro/categoría: «Eliminar» ofrece quitarla sólo del menú o eliminar el rubro (con sus protecciones) */
A.msecRubDel=el=>{const r=rub(el.dataset.id);if(!r||r.kind!=='rubro')return;
 modal('Eliminar «'+(r.mNom||r.name)+'»',`<p>Esta sección sale del ${esc(RW())} «${esc(r.name)}». ¿Qué querés hacer?</p>
 <label class="chk"><input type="radio" name="mrd" value="menu" checked> <span><b>Sacarla sólo del menú público</b><br><span class="sm mut">El ${esc(RW())} y sus productos siguen igual en el sistema (ventas, caja, reparto). Se puede volver a mostrar cuando quieras.</span></span></label>
 <label class="chk"><input type="radio" name="mrd" value="rubro"> <span><b>Eliminar el ${esc(RW())}</b><br><span class="sm mut">Sus productos pasan a otro ${esc(RW())}; si tiene ventas o movimientos no se borra: se archiva y el historial queda.</span></span></label>`,
 {okText:'Continuar',onOk:w=>{const v=(w.querySelector('input[name=mrd]:checked')||{}).value;
  if(v==='rubro'){if(!can('edit_products')){w._err('Sin permiso para eliminar rubros.');return false;}setTimeout(()=>A.rubDel({dataset:{id:r.id}}),60);return;}
  if(!can('menu_admin')){w._err('Sin permiso.');return false;}
  r.menuOn=false;S.products.forEach(p=>{if(p.msec===r.id)delete p.msec;});audit('MENU_SECCION_QUITADA',(r.mNom||r.name)+' · sale del menú (el rubro sigue)');save();pubRefreshSafe();rerender();toast('Sacada del menú');}});};

/* ---------- V26.21: productos de cada sección: mostrar/ocultar, destacado y orden ---------- */
let msecOpen='';
const prodMOrd=(p,i)=>p.mOrd!==undefined?p.mOrd:100000+i;
function secProds(id){const L=S.products.map((p,i)=>[p,i]).filter(([p])=>!p.archived&&p.active!==false&&prodMenuSec(p)===id);return L.sort((a,b)=>prodMOrd(a[0],a[1])-prodMOrd(b[0],b[1])).map(x=>x[0]);}
function msecProdsHTML(r,ed){const L=secProds(r.id);if(!L.length)return'<p class="sm mut">Esta sección no tiene productos. En Inventario, al editar un producto, elegí esta sección en «Sección del menú».</p>';
 return`<div class="sm mut" style="margin:.2rem 0 .4rem">Tildá «en el menú» para mostrarlo, ★ para destacarlo y usá las flechas para el orden en que aparece.</div><div class="msec-plist">${L.map((p,i)=>{const im=prodImg(p);return`<div class="row msec-p" style="gap:.5rem;align-items:center;flex-wrap:wrap;padding:.3rem 0;border-top:1px solid var(--line)">
 ${ed?`<button class="btn sm" data-act="msecPMove" data-id="${p.id}" data-d="-1" ${i===0?'disabled':''} aria-label="Subir ${esc(p.name)}">↑</button><button class="btn sm" data-act="msecPMove" data-id="${p.id}" data-d="1" ${i===L.length-1?'disabled':''} aria-label="Bajar ${esc(p.name)}">↓</button>`:''}
 ${im?`<img src="${im}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px">`:'<span style="width:40px;height:40px;border-radius:8px;background:var(--line);display:inline-block"></span>'}
 <span class="sp"><b>${esc(p.name)}</b>${p.sub?` <span class="sm mut">${esc(p.sub)}</span>`:''} <span class="sm mut">${money(p.price)}</span></span>
 <label class="chk" style="margin:0"><input type="checkbox" data-mpon="${p.id}" ${p.menu?'checked':''} ${ed?'':'disabled'}> en el menú</label>
 <button class="btn sm ${p.featured?'gold':''}" data-act="msecFeat" data-id="${p.id}" aria-pressed="${!!p.featured}" ${ed?'':'disabled'} title="Destacado">★ ${p.featured?'Destacado':'Destacar'}</button></div>`;}).join('')}</div>`;}
A.msecProds=el=>{msecOpen=msecOpen===el.dataset.id?'':el.dataset.id;rerender();};
A.msecPMove=el=>{if(!can('menu_admin'))return toast('Sin permiso',1);const p=prod(el.dataset.id);if(!p)return;const L=secProds(prodMenuSec(p));const i=L.indexOf(p),j=i+(+el.dataset.d);if(i<0||j<0||j>=L.length)return;
 const t=L[i];L[i]=L[j];L[j]=t;L.forEach((x,k)=>{x.mOrd=k;});audit('MENU_ORDEN_PRODUCTOS',(rub(prodMenuSec(p))||{}).name+': '+L.slice(0,8).map(x=>x.name).join(' > ').slice(0,250));save();pubRefreshSafe();rerender();};
A.msecFeat=el=>{if(!can('menu_admin'))return toast('Sin permiso',1);const p=prod(el.dataset.id);if(!p)return;p.featured=!p.featured;audit('MENU_DESTACADO',p.name+' · '+(p.featured?'destacado':'normal'));save();pubRefreshSafe();rerender();};
document.addEventListener('change',e=>{const id=e.target&&e.target.dataset&&e.target.dataset.mpon;if(!id)return;if(!can('menu_admin')){e.target.checked=!e.target.checked;return toast('Sin permiso',1);}
 const p=prod(id);if(!p)return;p.menu=e.target.checked;audit('MENU_PRODUCTO',p.name+' · '+(p.menu?'en el menú':'fuera del menú'));save();pubRefreshSafe();rerender();});
/* ---------- V26.21: ver cómo queda el menú con los cambios todavía no publicados ---------- */
let menuPreview=false;
A.mpPreview=()=>{menuPreview=true;const w=modal('Vista previa del menú (borrador)',`<p class="sm mut">Así lo vería un cliente con los textos del borrador y los productos de ahora. Para que lo vea el público, tocá «Publicar».</p><iframe id="mp-prev" title="Vista previa del menú" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:12px;background:#fff"></iframe>`,{wide:true,okText:'Cerrar vista previa',noCancel:true,onOk:()=>{menuPreview=false;}});
 const f=w.querySelector('#mp-prev');f.srcdoc=buildPubDoc();
 new MutationObserver((m,o)=>{if(!document.body.contains(w)){menuPreview=false;o.disconnect();}}).observe(document.getElementById('modal-root'),{childList:true});};
