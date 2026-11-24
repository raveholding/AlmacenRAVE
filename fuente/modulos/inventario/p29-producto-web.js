/* ===== V27.31 · Alta de productos desde internet (prompt claude/PROMPT_V27_31_ALTA_PRODUCTO_WEB.md) =====
   En «Nuevo producto» aparece «Buscar en la web»: código de barras (escáner), SKU o nombre.
   · Reglas de códigos: EAN-13 / EAN-8 con dígito verificador, UPC-A → EAN-13, DUN-14 → su unidad; los códigos de balanza o internos
     (prefijos 20–29, PLU) NO se buscan.
   · Cascada: (A) productos del comercio → (B) caché de este equipo (90 días) → (C) demos: catálogo de ejemplo sin marcas reales ·
     Almacén RAVE: función «productos» de la nube (Open Food Facts y sus hermanas, opcionales UPCitemdb / búsqueda web / IA).
   · El resultado es un BORRADOR en el mismo formulario de siempre: nombre, presentación, marca, descripción, unidad, foto (con su
     licencia) y una sugerencia de rubro/categoría que nunca se elige sola cuando el rubro es de un socio. Los precios NUNCA vienen
     de internet. «Publicar en el menú» queda apagado.
   · Sin conexión, sin resultados o con el límite alcanzado: «Cargalo a mano», sin bloquear nada. */
const PW_DEMO=!IS_CLIENT;
const pwN=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function pwEanOk(s){if(!/^\d{8}$|^\d{12,14}$/.test(s))return false;const d=s.split('').map(Number);const c=d.pop();let t=0;d.reverse().forEach((x,i)=>{t+=x*(i%2?1:3);});return (10-t%10)%10===c;}
function pwEanFix(b){let t=0;b.split('').map(Number).reverse().forEach((x,i)=>{t+=x*(i%2?1:3);});return b+((10-t%10)%10);}
/* interpreta lo que se escribió: {tipo:'ean'|'texto'|'interno'|'invalido', code, nota} */
function pwCode(q){q=String(q||'').trim();const d=q.replace(/[\s-]/g,'');
 if(/^\d{1,5}$/.test(d))return{tipo:'interno',nota:'Es un PLU o código interno: cargalo a mano.'};
 if(/^\d+$/.test(d)){let c=d;if(c.length===12&&pwEanOk('0'+c))c='0'+c;
  if(c.length===14&&pwEanOk(c)){const u=pwEanFix(c.slice(1,13));return{tipo:'ean',code:u,bulto:c,nota:'Código de bulto (DUN-14): busco la unidad '+u+'.'};}
  if(c.length===13&&/^2/.test(c))return{tipo:'interno',nota:'Es un código de balanza o de uso interno (empieza con 2): cargalo a mano.'};
  if((c.length===13||c.length===8)&&pwEanOk(c))return{tipo:'ean',code:c,ar:/^77[89]/.test(c)};
  if(c.length===13||c.length===8||c.length===12)return{tipo:'invalido',code:c,nota:'El código no es válido (dígito verificador).'};}
 return q.length>=3?{tipo:'texto',q}:{tipo:'invalido',nota:'Escribí al menos 3 letras o un código.'};}
/* ---------- normalización por reglas (también en las demos) ---------- */
function pwPres(t){const m=/(\d+(?:[.,]\d+)?)\s*(ml|cc|cm3|l|lt|lts|litros?|g|gr|grs|gramos?|kg|kilos?)\b/i.exec(String(t||''));if(!m)return '';let v=+m[1].replace(',','.');let u=m[2].toLowerCase();
 if(/^(cc|cm3|ml)$/.test(u))u='ml';else if(/^(l|lt|lts|litro|litros)$/.test(u))u='L';else if(/^(g|gr|grs|gramo|gramos)$/.test(u))u='g';else u='kg';
 if(u==='ml'&&v>=1000){v=v/1000;u='L';}if(u==='g'&&v>=1000){v=v/1000;u='kg';}const s=String(Math.round(v*100)/100).replace('.',',');return s+' '+u;}
function pwTitle(t){t=String(t||'').replace(/[\u{1F300}-\u{1FAFF}]/gu,'').replace(/\s+/g,' ').trim();if(t===t.toUpperCase()&&/[A-Z]{4}/.test(t))t=t.toLowerCase();return (t.charAt(0).toUpperCase()+t.slice(1)).slice(0,80);}
function pwNorm(f){const o=Object.assign({},f);o.nombre=pwTitle(o.nombre||'');o.presentacion=o.presentacion?pwPres(o.presentacion)||String(o.presentacion).slice(0,40):pwPres(o.nombre);
 if(o.presentacion&&o.nombre&&!pwN(o.nombre).includes(pwN(o.presentacion).replace(',','.'))&&!pwN(o.nombre).includes(pwN(o.presentacion)))o.nombre=(o.nombre+' '+o.presentacion).slice(0,80);
 o.unidad=/granel|por kilo|x kg/i.test(o.nombre+' '+(o.categoria_fuente||''))?'kg':'u';o.descripcion=String(o.descripcion||'').replace(/<[^>]*>/g,'').slice(0,120);o.marca=String(o.marca||'').slice(0,40);return o;}
/* ---------- sugerencia de rubro/categoría (nunca se crean rubros) ---------- */
const PW_CATS=[['alcohol',/cerveza|vino|fernet|aperitivo|whisky|vodka|gin\b|licor|espumante|champa|sidra|ron\b/,/alcohol|vino|cerveza|licor|bodega|\+18/],
 ['bebidas',/gaseosa|agua|jugo|bebida|soda|energizante|isoton/,/bebida/],['lacteos',/leche|yogur|queso|manteca|crema de leche|dulce de leche/,/l[aá]cteo|fresco|heladera/],
 ['golosinas',/chocolate|alfajor|caramelo|chicle|papas fritas|snack|galletita|golosina|turr[oó]n/,/golosina|snack|kiosco|confite/],
 ['limpieza',/detergente|lavandina|jab[oó]n en polvo|suavizante|limpiador|desinfectante|papel higi|rollo de cocina|esponja/,/limpieza/],
 ['perfumeria',/shampoo|acondicionador|jab[oó]n|desodorante|crema|pasta dental|cepillo/,/perfum|higiene|tocador|limpieza/],
 ['almacen',/yerba|fideo|arroz|aceite|harina|az[uú]car|caf[eé]|\bt[eé]\b|conserva|at[uú]n|tomate|mermelada|polenta|lenteja|arveja|sal\b|vinagre|mayonesa|galleta/,/almac[eé]n|abarrote|despensa/]];
function pwRubroSug(f){const t=pwN([f.nombre,f.categoria_fuente].join(' '));const cat=PW_CATS.find(([,re])=>re.test(t));if(!cat)return null;
 const R=S.rubros.filter(r=>r.kind==='rubro');const r=R.find(r=>cat[2].test(pwN(r.name+' '+(r.mNom||''))));return r?{id:r.id,name:r.name,cat:cat[0]}:{id:'',name:'',cat:cat[0]};}
/* ---------- caché de este equipo ---------- */
const PW_CK='rave.pw.cache';
function pwCache(){try{return JSON.parse(localStorage.getItem(PW_CK)||'{}')||{};}catch(e){return{};}}
function pwCacheGet(code){const c=pwCache()[code];return c&&Date.now()-c.ts<90*864e5?c.f:null;}
function pwCachePut(code,f){if(!code)return;try{const c=pwCache();c[code]={ts:Date.now(),f:Object.assign({},f,{imagenes:[]})};const K=Object.keys(c);if(K.length>200)K.sort((a,b)=>c[a].ts-c[b].ts).slice(0,K.length-200).forEach(k=>delete c[k]);localStorage.setItem(PW_CK,JSON.stringify(c));}catch(e){}}
/* ---------- catálogo de ejemplo de las demos (genérico, SIN marcas reales; códigos de ejemplo válidos) ---------- */
const PW_SEED_RAW=[['Gaseosa cola','2,25 L','Bebidas > Gaseosas'],['Agua mineral sin gas','1,5 L','Bebidas > Aguas'],['Jugo de naranja','1 L','Bebidas > Jugos'],['Agua saborizada pomelo','1,5 L','Bebidas > Aguas'],
 ['Cerveza rubia lata','473 ml','Bebidas alcohólicas > Cervezas'],['Vino tinto Malbec','750 ml','Bebidas alcohólicas > Vinos'],['Fernet','750 ml','Bebidas alcohólicas > Aperitivos'],['Aperitivo rojo','1 L','Bebidas alcohólicas > Aperitivos'],
 ['Yerba mate con palo','1 kg','Almacén > Infusiones'],['Fideos spaghetti','500 g','Almacén > Pastas secas'],['Arroz largo fino','1 kg','Almacén > Arroz'],['Aceite de girasol','900 ml','Almacén > Aceites'],
 ['Harina de trigo 000','1 kg','Almacén > Harinas'],['Azúcar común','1 kg','Almacén > Azúcar'],['Café molido','250 g','Almacén > Infusiones'],['Té en saquitos x 25','50 g','Almacén > Infusiones'],
 ['Atún al natural','170 g','Almacén > Conservas'],['Tomate triturado','520 g','Almacén > Conservas'],['Leche entera','1 L','Lácteos > Leches'],['Dulce de leche clásico','400 g','Lácteos > Dulce de leche'],
 ['Yogur bebible frutilla','1 L','Lácteos > Yogures'],['Chocolate con leche','100 g','Golosinas > Chocolates'],['Alfajor triple','70 g','Golosinas > Alfajores'],['Papas fritas clásicas','150 g','Snacks > Papas fritas'],
 ['Galletitas dulces surtidas','300 g','Almacén > Galletitas'],['Detergente limón','750 ml','Limpieza > Lavavajillas'],['Lavandina','1 L','Limpieza > Lavandinas'],['Jabón en polvo','800 g','Limpieza > Ropa'],
 ['Papel higiénico x 4 rollos','','Limpieza > Papel'],['Shampoo uso diario','400 ml','Perfumería > Cabello']];
const PW_SEED=PW_SEED_RAW.map(([n,p,c],i)=>({barcode:pwEanFix('779999'+String(100000+i).slice(-6)),nombre:n+(p?' '+p:''),marca:'Marca de ejemplo',presentacion:p,categoria_fuente:c,
 descripcion:'Producto de ejemplo para la demostración: '+n.toLowerCase()+(p?' de '+p:'')+'.',fuente:'demo',imagenes:[],alcohol:/alcoh/i.test(c)}));
PW_SEED.push({barcode:pwEanFix('779999100030'),nombre:'Pack gaseosa cola 6 × 2,25 L',marca:'Marca de ejemplo',presentacion:'6 × 2,25 L',categoria_fuente:'Bebidas > Gaseosas',descripcion:'Bulto de 6 botellas de gaseosa cola de 2,25 L (ejemplo).',fuente:'demo',imagenes:[],bulto:{unidades:6}});
/* ---------- búsqueda ---------- */
let pwCtl=null;
async function pwBuscar(q,signal){const c=pwCode(q);if(c.tipo==='interno'||c.tipo==='invalido')return{ok:false,error:c.nota,etapa:'validacion'};
 if(c.tipo==='ean'){const own=S.products.find(p=>p.barcode===c.code||(c.bulto&&p.barcode===c.bulto));if(own)return{ok:false,existe:own.id,error:'Ese código ya está cargado: '+own.name+(own.archived?' (archivado)':'')+'.',etapa:'duplicado'};
  const k=pwCacheGet(c.code);if(k)return{ok:true,fuente:'cache',confianza:k.confianza||.8,borrador:k,nota:c.nota};}
 if(PW_DEMO){await new Promise(r=>setTimeout(r,350));if(signal&&signal.aborted)throw new Error('cancelado');
  let f=null;if(c.tipo==='ean')f=PW_SEED.find(x=>x.barcode===c.code);else{const qq=pwN(c.q);const L=PW_SEED.map(x=>({x,s:typeof uxScore==='function'?uxScore(qq,x.nombre+' '+x.categoria_fuente):(pwN(x.nombre).includes(qq)?50:0)})).filter(y=>y.s>0).sort((a,b)=>b.s-a.s);f=L.length?L[0].x:null;}
  if(!f)return{ok:false,error:'No lo encontré en el catálogo de ejemplo de la demostración. Cargalo a mano.',etapa:'vacio'};
  return{ok:true,fuente:'demo',confianza:.9,borrador:Object.assign({},f),nota:c.nota};}
 if(!navigator.onLine)return{ok:false,error:'Sin conexión: cargalo a mano.',etapa:'red'};
 if(!(typeof CLOUD!=='undefined'&&CLOUD.on&&cl.ready&&cl.comercio))return{ok:false,error:'La búsqueda en internet necesita la nube del comercio. Cargalo a mano.',etapa:'config'};
 const r=await hreq('/functions/v1/productos',{method:'POST',fn:true,signal,body:{accion:'buscar',comercio:cl.comercio.id,q:c.tipo==='ean'?c.code:c.q}});
 if(r&&r.ok&&c.nota)r.nota=c.nota;return r||{ok:false,error:'La nube no respondió.',etapa:'red'};}
/* ---------- interfaz dentro de «Nuevo producto» ---------- */
function pwBarHTML(){return `<div class="pw-bar" id="pw-bar"><div class="pw-row"><label for="pw-q" class="pw-sr">Código de barras, SKU o nombre</label><input id="pw-q" placeholder="Escaneá el código o escribí el nombre" autocomplete="off" inputmode="search">
 <button type="button" class="btn gold" id="pw-go">🔎 Buscar en la web</button><button type="button" class="btn" id="pw-gg" title="Abre Google en otra pestaña (gratis)">Buscar en Google</button></div><div id="pw-res" aria-live="polite"><p class="sm mut" style="margin:.35rem 0 0">${PW_DEMO?'Demostración: busca en un catálogo de ejemplo. ':''}Completa nombre, presentación, marca y foto. El precio lo ponés vos.</p></div></div>`;}
function pwMarcaHTML(p){return `<label for="pm-mk">Marca (opcional)</label><input id="pm-mk" maxlength="40" value="${esc(p&&p.marca?p.marca:'')}">`;}
function pwFill(w,id,v){const el=w.querySelector('#'+id);if(!el||v==null||v==='')return false;el.value=v;el.classList.add('pw-fill');el.addEventListener('input',()=>el.classList.remove('pw-fill'),{once:true});return true;}
function pwApply(w,r){const f=pwNorm(r.borrador||{});w._pw={f,fuente:r.fuente,conf:r.confianza};const n=[];
 if(pwFill(w,'pm-n',f.nombre))n.push('nombre');if(pwFill(w,'pm-sub',f.presentacion))n.push('presentación');if(pwFill(w,'pm-b',f.barcode))n.push('código');
 if(pwFill(w,'pm-d',f.descripcion))n.push('descripción');if(pwFill(w,'pm-mk',f.marca))n.push('marca');const u=w.querySelector('#pm-u');if(u&&f.unidad){u.value=f.unidad;u.dispatchEvent(new Event('change',{bubbles:true}));}
 const sg=pwRubroSug(f);const sel=w.querySelector('#pm-r');let sgTxt='';
 if(sg&&sg.id&&sel){if(typeof ownerMode==='function'&&ownerMode()&&!sel.value){sel.value=sg.id;sel.classList.add('pw-fill');sgTxt='Categoría sugerida: <b>'+esc(sg.name)+'</b> (revisala).';}else sgTxt='Sugerencia: <b>'+esc(sg.name)+'</b>. Elegí '+(ownerMode()?'la categoría':'el rubro')+' vos.';}
 else if(sg)sgTxt='Elegí '+(typeof ownerMode==='function'&&ownerMode()?'la categoría':'el rubro')+' (no encontré uno parecido para «'+esc(f.categoria_fuente||sg.cat)+'»).';
 const src={demo:'catálogo de ejemplo',cache:'guardado en este equipo',maestro:'fichas confirmadas',off:'Open Food Facts',obf:'Open Beauty Facts',opf:'Open Products Facts',upcitemdb:'UPCitemdb',web:'búsqueda web'}[r.fuente]||r.fuente;
 const imgs=(f.imagenes||[]).slice(0,5);
 $('#pw-res',w).innerHTML=`<div class="pw-ok"><div class="pw-okh">${uiBadge('info','Borrador')}<b>Desde ${esc(src)}</b><span class="sm mut">· confianza ${Math.round((r.confianza||0)*100)} %</span><button type="button" class="cx-lk" id="pw-undo">Descartar</button></div>
 <p class="sm" style="margin:.3rem 0">Completé: ${esc(n.join(', ')||'nada')}. Los campos marcados <span class="pw-mk">ⓦ</span> vienen de internet: <b>revisalos</b> y poné el precio.${r.nota?' '+esc(r.nota):''}</p>
 ${sgTxt?`<p class="sm" style="margin:.2rem 0">${sgTxt}</p>`:''}${f.alcohol?'<p class="sm warn" style="margin:.2rem 0">Bebida con alcohol: usá un rubro que tenga «Vende alcohol» (+18).</p>':''}${f.bulto&&f.bulto.unidades?`<p class="sm" style="margin:.2rem 0">Bulto de <b>${f.bulto.unidades}</b> unidades: si vendés por mayor, cargalo en Presentaciones (sin precio sugerido).</p>`:''}
 ${imgs.length?`<div class="pw-imgs" role="list">${imgs.map((x,i)=>`<button type="button" class="pw-img" role="listitem" data-pwi="${i}" title="Usar esta foto"><img src="${esc(x.url)}" alt="Foto candidata ${i+1}" loading="lazy" referrerpolicy="no-referrer"><small>${esc(x.licencia||'')}</small></button>`).join('')}</div><p class="sm mut" style="margin:.2rem 0">Tocá una foto para usarla (se achica y se guarda en el sistema). Mejor aún: subí tu propia foto.</p>`:''}
 ${f.atribucion?`<p class="sm mut" style="margin:.2rem 0">${esc(f.atribucion)}</p>`:''}</div>`;
 $('#pw-undo',w).addEventListener('click',()=>{['pm-n','pm-sub','pm-d','pm-mk'].forEach(id=>{const e=w.querySelector('#'+id);if(e&&e.classList.contains('pw-fill')){e.value='';e.classList.remove('pw-fill');}});w._pw=null;$('#pw-res',w).innerHTML='<p class="sm mut" style="margin:.35rem 0 0">Descartado. Podés cargarlo a mano.</p>';});
 $$('.pw-img',w).forEach(b=>b.addEventListener('click',()=>pwFoto(w,imgs[+b.dataset.pwi],b)));
 const nm=w.querySelector('#pm-f')||w.querySelector('#pm-c');if(nm)setTimeout(()=>nm.focus(),60);}
async function pwFoto(w,x,btn){const s=w.querySelector('#pm-imgs');btn.disabled=true;if(s)s.textContent='Bajando la foto…';
 try{const r=await hreq('/functions/v1/productos',{method:'POST',fn:true,body:{accion:'imagen',comercio:cl.comercio.id,url:x.url}});if(!r||!r.ok)throw new Error(r&&r.error||'no se pudo bajar');
  const im=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('La imagen no se pudo leer.'));i.src='data:'+r.mime+';base64,'+r.b64;});
  const d=imgEncode(im);w._img=d;w._pwImg={fuente:x.fuente||'',licencia:x.licencia||'',autor:x.autor||'',url:x.url};
  const v=w.querySelector('#pm-imgv'),n=w.querySelector('#pm-imgn'),xx=w.querySelector('#pm-imgx');if(v){v.src=d;v.style.display='';}if(n)n.hidden=true;if(xx)xx.hidden=false;
  if(s)s.textContent='Foto lista ('+(x.licencia||'licencia de la fuente')+'). Se guarda al tocar «Guardar».';$$('.pw-img',w).forEach(b=>b.classList.toggle('on',b===btn));}
 catch(e){if(s)s.textContent='No se pudo usar esa foto: '+String(e.message||e).slice(0,120)+'. Subí la tuya.';}btn.disabled=false;}
function pwBind(w){const q=w.querySelector('#pw-q'),b=w.querySelector('#pw-go');if(!q||!b)return;
 const run=async()=>{const v=q.value.trim();if(!v){q.focus();return;}if(pwCtl){pwCtl.abort();}const ctl=new AbortController();pwCtl=ctl;
  $('#pw-res',w).innerHTML='<p class="sm" style="margin:.35rem 0 0"><span class="pw-spin" aria-hidden="true"></span> Buscando… <button type="button" class="cx-lk" id="pw-x">Cancelar</button> · <button type="button" class="cx-lk" id="pw-man">Cargar a mano</button></p>';
  const stop=()=>{ctl.abort();$('#pw-res',w).innerHTML='<p class="sm mut" style="margin:.35rem 0 0">Búsqueda cancelada. Cargalo a mano o probá de nuevo.</p>';};
  $('#pw-x',w).addEventListener('click',stop);$('#pw-man',w).addEventListener('click',()=>{stop();const n=w.querySelector('#pm-n');if(n){if(!n.value&&pwCode(v).tipo==='texto')n.value=pwTitle(v);n.focus();}const bb=w.querySelector('#pm-b');const c=pwCode(v);if(bb&&!bb.value&&c.code)bb.value=c.code;});
  b.disabled=true;let r;try{r=await pwBuscar(v,ctl.signal);}catch(e){r=ctl.signal.aborted?null:{ok:false,error:'No se pudo buscar ('+String(e.message||e).slice(0,100)+'). Cargalo a mano.'};}b.disabled=false;if(pwCtl===ctl)pwCtl=null;if(!r||ctl.signal.aborted)return;
  if(r.ok){pwApply(w,r);return;}
  const c=pwCode(v);const bb=w.querySelector('#pm-b');if(bb&&!bb.value&&c.code&&r.etapa!=='duplicado')bb.value=c.code;
  $('#pw-res',w).innerHTML=`<p class="sm ${r.etapa==='validacion'?'warn':''}" style="margin:.35rem 0 0">${esc(r.error||'Sin resultados.')}${r.existe?` <button type="button" class="btn sm" id="pw-open">Abrir ese producto</button>`:''}${(r.avisos||[]).length?' <span class="mut">('+esc(r.avisos.join(' · '))+')</span>':''}</p>`;
  const op=$('#pw-open',w);if(op)op.addEventListener('click',()=>{w.remove();A.pedit({dataset:{id:r.existe}});});};
 {const g=w.querySelector('#pw-gg');if(g)g.addEventListener('click',()=>pwGoogle(w,false));}b.addEventListener('click',run);q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run();}});
 /* desde Vender el código se completa justo después de abrir: se mira un instante después */
 setTimeout(()=>{const bc=w.querySelector('#pm-b');if(bc&&bc.value&&pwCode(bc.value).tipo==='ean'){q.value=bc.value;run();}else if(!w.querySelector('#pm-n').value)q.focus();},90);}
/* ---------- V27.31b · Google y foto pegada (gratis, sin claves ni servicios pagos) ----------
   «Buscar en Google» abre Google en otra pestaña con el nombre o el código. La foto se trae copiándola
   («Copiar imagen») y tocando «Pegar foto» (o Ctrl+V dentro del formulario), o guardándola y usando «Cargar foto».
   Siempre pasa por el recorte y se achica igual que la foto propia, y queda guardada en el producto (sin enlaces a otros sitios). */
function pwGQ(w){const v=id=>{const e=w.querySelector('#'+id);return e?String(e.value||'').trim():'';};
 return [v('pm-n')||v('pw-q'),v('pm-mk'),v('pm-sub')].filter(Boolean).join(' ')||v('pm-b');}
function pwGoogle(w,img){const q=pwGQ(w);if(!q){toast('Escribí primero el nombre o el código.');const n=w.querySelector('#pm-n');if(n)n.focus();return;}
 window.open('https://www.google.com/search?'+(img?'tbm=isch&':'')+'q='+encodeURIComponent(q),'_blank','noopener');}
async function pwPegarBlob(w,blob){const v=w.querySelector('#pm-imgv'),n=w.querySelector('#pm-imgn'),x=w.querySelector('#pm-imgx'),s=w.querySelector('#pm-imgs');
 if(!blob||!/^image\//.test(blob.type||'')){if(s)s.textContent='Lo que pegaste no es una foto. En Google tocá la foto y elegí «Copiar imagen».';return;}
 if(blob.size>8*1024*1024){if(s)s.textContent='La foto es muy pesada (más de 8 MB).';return;}
 try{if(s)s.textContent='Achicando la foto…';const im=await imgLoad(blob);if(s)s.textContent='Recortá la foto…';const r=await imgCropModal(im);if(!r){if(s)s.textContent='No se cambió la foto.';return;}
  const d=imgEncode(im,r);w._img=d;w._pwImg=null;if(v){v.src=d;v.style.display='';}if(n)n.hidden=true;if(x)x.hidden=false;
  const m=w.querySelector('#pm-m');let extra='';if(m&&!m.checked&&!w._pwEdit){m.checked=true;extra=' Marqué «Publicar en menú digital» (podés destildarlo).';}
  if(s)s.textContent='Foto lista ('+Math.round(d.length*0.75/1024)+' KB). Se guarda al tocar «Guardar».'+extra;}
 catch(e){if(s)s.textContent=String(e.message||e).slice(0,140);}}
async function pwPegar(w){const s=w.querySelector('#pm-imgs');
 try{if(!navigator.clipboard||!navigator.clipboard.read)throw new Error('x');const items=await navigator.clipboard.read();
  for(const it of items){const t=it.types.find(y=>/^image\//.test(y));if(t){await pwPegarBlob(w,await it.getType(t));return;}}
  if(s)s.textContent='No hay ninguna foto copiada. En Google tocá la foto y elegí «Copiar imagen»; después volvé y tocá «Pegar foto».';}
 catch(e){if(s)s.textContent='Tu navegador no deja leer lo copiado con el botón: tocá dentro del formulario y pegá con Ctrl+V (en el celular, guardá la foto y usá «Cargar foto»).';}}
function pwFotoBind(w,p){const f=w.querySelector('#pm-imgf');if(!f||w.querySelector('#pw-gimg'))return;w._pwEdit=!!p;
 const x=w.querySelector('#pm-imgx');const box=document.createElement('span');box.className='pw-ft';
 box.innerHTML='<button type="button" class="btn sm" id="pw-gimg" title="Abre Google Imágenes en otra pestaña">🔎 Buscar foto en Google</button><button type="button" class="btn sm" id="pw-paste">📋 Pegar foto</button>';
 (x||f).insertAdjacentElement('afterend',box);
 const s=w.querySelector('#pm-imgs');if(s)s.textContent='Cargá tu foto, o buscala en Google: tocá la foto, «Copiar imagen», y acá «Pegar foto». Se achica sola para el menú.';
 box.querySelector('#pw-gimg').addEventListener('click',()=>pwGoogle(w,true));box.querySelector('#pw-paste').addEventListener('click',()=>pwPegar(w));
 w.addEventListener('paste',e=>{const it=[...(e.clipboardData&&e.clipboardData.items||[])].find(y=>y.kind==='file'&&/^image\//.test(y.type));if(!it)return;e.preventDefault();pwPegarBlob(w,it.getAsFile());});}
if(typeof menuProdBind==='function'){const _mb=menuProdBind;menuProdBind=function(w,p){const r=_mb.apply(this,arguments);try{pwFotoBind(w,p);}catch(e){}return r;};}
/* al guardar: marca, origen de la foto, auditoría, caché y (opcional) aporte a las fichas compartidas */
function pwRead(w,p){const o={};const mk=w.querySelector('#pm-mk');if(mk)o.marca=mk.value.trim().slice(0,40);if(w._pwImg&&w._img)o.imgSrc=w._pwImg;
 const P=w._pw;if(P&&!p){const f=P.f;audit('ALTA_PRODUCTO_WEB',(val('pm-n')||f.nombre)+' · '+(rubName?rubName(val('pm-r')):'')+' · fuente '+P.fuente+' · confianza '+Math.round((P.conf||0)*100)+' %');
  const code=val('pm-b').trim();if(code&&P.fuente!=='demo')pwCachePut(code,Object.assign({},f,{nombre:val('pm-n'),presentacion:val('pm-sub'),marca:o.marca||f.marca,confianza:P.conf}));
  if(!PW_DEMO&&code&&S.cfg.pw&&S.cfg.pw.compartir&&typeof CLOUD!=='undefined'&&CLOUD.on&&cl.ready)hreq('/functions/v1/productos',{method:'POST',fn:true,body:{accion:'confirmar',comercio:cl.comercio.id,barcode:code,ficha:{nombre:val('pm-n'),marca:o.marca||'',presentacion:val('pm-sub'),descripcion:val('pm-d'),categoria_fuente:f.categoria_fuente||'',unidad:val('pm-u')}}}).catch(()=>{});}
 return o;}
/* desde Vender: un código válido que no está cargado ofrece darlo de alta (con la búsqueda ya hecha) */
if(typeof addByCode==='function'){const _ab=addByCode;addByCode=function(code){const r=_ab.apply(this,arguments);if(r)return r;
 try{const c=pwCode(code);if(c.tipo==='ean'&&can('edit_products')&&!$('#modal-root .ov')&&typeof A.posNewItem==='function')
  modal('Código sin cargar',`<p>El código <b>${esc(c.code)}</b> no está en el inventario.</p><p class="sm mut">Te abro el alta con la búsqueda en la web ya hecha; al guardar se suma al ticket.</p>`,{okText:'Dar de alta',onOk:()=>{pos.q=c.code;setTimeout(()=>A.posNewItem(),0);}});}catch(e){}
 return r;};}
(function(){if(typeof document==='undefined'||document.getElementById('pw-css'))return;const st=document.createElement('style');st.id='pw-css';
 st.textContent=`.pw-bar{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:.7rem;margin:0 0 .8rem}.pw-row{display:flex;gap:.5rem;flex-wrap:wrap}.pw-row input{flex:1 1 220px;min-width:0}.pw-sr{position:absolute;left:-9999px}.pw-ft{display:inline-flex;gap:.4rem;flex-wrap:wrap}
.pw-fill{box-shadow:inset 0 0 0 2px rgba(37,99,235,.45)!important}.pw-mk{color:#1d4ed8;font-weight:700}.pw-ok{margin-top:.5rem}.pw-okh{display:flex;gap:.45rem;align-items:center;flex-wrap:wrap}.pw-okh .cx-lk{margin-left:auto}
.pw-imgs{display:flex;gap:.45rem;flex-wrap:wrap;margin:.4rem 0}.pw-img{display:flex;flex-direction:column;align-items:center;gap:.15rem;background:var(--card);border:2px solid var(--line);border-radius:12px;padding:.25rem;cursor:pointer;font:inherit;color:inherit}.pw-img img{width:76px;height:76px;object-fit:contain;border-radius:8px;background:#fff}.pw-img small{font-size:.65rem;color:var(--mut)}.pw-img.on{border-color:var(--gold)}
.pw-spin{display:inline-block;width:.9rem;height:.9rem;border:2px solid var(--line);border-top-color:var(--gold);border-radius:50%;animation:pwsp .8s linear infinite;vertical-align:-2px}@keyframes pwsp{to{transform:rotate(360deg)}}
[data-theme=dark] .pw-mk{color:#93b4ff}@media(prefers-color-scheme:dark){:root:not([data-theme=light]) .pw-mk{color:#93b4ff}}`;document.head.appendChild(st);})();
