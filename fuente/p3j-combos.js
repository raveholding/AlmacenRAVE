/* ===== V26.14 · Combos que descuentan cada artículo (Almacén RAVE y demo) =====
   Un combo es un producto que se vende con su propio precio, pero NO tiene stock propio: se arma con artículos del inventario.
   Ejemplo: «Fernet Branca 750 + Coca-Cola 3 lt + Hielo» → al vender 1 combo se resta 1 Fernet 750, 1 Coca-Cola 3 lt y 1 hielo.
   · p.kit = [{pid, qty}] (cantidad de cada artículo por combo). El stock que se muestra del combo = cuántos se pueden armar.
   · La venta guarda en cada línea la composición usada (it.kit) para que anular / nota de crédito devuelva exactamente eso,
     aunque después se cambie la receta del combo.
   · Con la nube no hay nada nuevo en el servidor: el stock viaja como movimientos de cada artículo (igual que una venta suelta). */
const isKit=p=>!!(p&&Array.isArray(p.kit)&&p.kit.length);
function kitComps(p){return(p&&p.kit||[]).map(k=>({pid:k.pid,qty:+k.qty,p:prod(k.pid)})).filter(x=>x.p);}
function kitStock(p){const c=kitComps(p);if(!c.length)return 0;let m=Infinity;for(const x of c){const v=Math.floor((x.p.stock+1e-9)/x.qty);if(v<m)m=v;}return m===Infinity?0:m;}
const stockOf=p=>isKit(p)?kitStock(p):p.stock;
function kitCost(p){return kitComps(p).reduce((a,x)=>a+Math.round((x.p.cost||0)*x.qty),0);}
const kitTxt=p=>kitComps(p).map(x=>(x.qty!==1?numAR(x.qty,3)+' × ':'')+pfull(x.p)).join(' + ');
/* lo que hay que descontar del stock por las líneas de una venta (los combos se abren en sus artículos) */
function kitNeed(lines){const need={};(lines||[]).forEach(l=>{const p=prod(l.pid);
 if(isKit(p))p.kit.forEach(k=>{need[k.pid]=(need[k.pid]||0)+l.qty*k.qty;});else need[l.pid]=(need[l.pid]||0)+l.qty;});
 for(const k in need)need[k]=Math.round(need[k]*1000)/1000;return need;}
/* foto de la composición para guardar en la línea vendida */
function kitSnap(pid){const p=prod(pid);if(!isKit(p))return null;return kitComps(p).map(x=>({pid:x.pid,name:pfull(x.p),qty:x.qty}));}
/* ---------- editor (Inventario → producto) ---------- */
function comboBlock(p){const on=isKit(p);const rows=on?p.kit:[];
 return`<fieldset class="card" id="kit-box" style="margin:.6rem 0;padding:.7rem"><legend class="sm"><b>Combo</b></legend>
 <label class="chk"><input type="checkbox" id="kit-on" ${on?'checked':''}> Es un combo: se arma con otros artículos del inventario y al venderlo se descuenta cada uno</label>
 <div id="kit-rows" ${on?'':'hidden'}>${rows.map(r=>kitRowHTML(r.pid,r.qty)).join('')}</div>
 <div id="kit-act" ${on?'':'hidden'}><button type="button" class="btn sm" id="kit-add">+ Agregar artículo</button><p class="sm" id="kit-sum" role="status"></p></div></fieldset>`;}
function kitOpts(sel,self){return S.products.filter(x=>!x.archived&&!isKit(x)&&x.id!==self).sort((a,b)=>pfull(a).localeCompare(pfull(b),'es'))
 .map(x=>`<option value="${esc(x.id)}" ${x.id===sel?'selected':''}>${esc(pfull(x))} · stock ${esc(stockTxt(x))}</option>`).join('');}
function kitRowHTML(pid,qty){return`<div class="row kit-row" style="flex-wrap:wrap;gap:.4rem;margin:.3rem 0"><select class="kit-p" aria-label="Artículo del combo" style="flex:1 1 220px"><option value="">— Elegí el artículo —</option>${kitOpts(pid,kitSelf)}</select>
 <input class="kit-q" inputmode="decimal" aria-label="Cantidad por combo" style="max-width:90px" value="${qty?esc(String(qty).replace('.',',')):'1'}"><button type="button" class="btn sm red kit-rm" aria-label="Quitar artículo">✕</button></div>`;}
let kitSelf='';
function comboBind(w,p){kitSelf=p?p.id:'';const box=w.querySelector('#kit-box');if(!box)return;
 const sum=()=>{const r=comboRead(w,p,true);const el=w.querySelector('#kit-sum');if(!el)return;
  if(!w.querySelector('#kit-on').checked){el.textContent='';return;}
  if(r.err){el.innerHTML='<span class="errtxt">'+esc(r.err)+'</span>';return;}
  const fake={kit:r.kit};el.innerHTML='Se pueden armar <b>'+kitStock(fake)+'</b> combos con el stock actual'+(can('view_cost')?' · costo de los artículos <b>'+money(kitCost(fake))+'</b>':'')+'. El combo no tiene stock propio.';
  const st=w.querySelector('#pm-st');if(st){st.disabled=true;st.value=String(kitStock(fake));}};
 box.addEventListener('change',e=>{if(e.target.id==='kit-on'){const on=e.target.checked;w.querySelector('#kit-rows').hidden=!on;w.querySelector('#kit-act').hidden=!on;
   if(on&&!w.querySelectorAll('.kit-row').length)w.querySelector('#kit-rows').insertAdjacentHTML('beforeend',kitRowHTML('',1));
   const st=w.querySelector('#pm-st');if(st&&!on){st.disabled=false;}const u=w.querySelector('#pm-u');if(u&&on){u.value='u';u.disabled=true;}else if(u)u.disabled=false;}
  sum();});
 box.addEventListener('input',sum);
 box.addEventListener('click',e=>{if(e.target.id==='kit-add'){w.querySelector('#kit-rows').insertAdjacentHTML('beforeend',kitRowHTML('',1));sum();}
  const rm=e.target.closest('.kit-rm');if(rm){rm.closest('.kit-row').remove();sum();}});
 if(isKit(p)){const u=w.querySelector('#pm-u');if(u){u.value='u';u.disabled=true;}}sum();}
/* lee y valida la composición: {kit:[...]} · {kit:null} si no es combo · {err} */
function comboRead(w,p,soft){const on=w.querySelector('#kit-on');if(!on||!on.checked)return{kit:null};
 const rows=[...w.querySelectorAll('.kit-row')];const kit=[],seen=new Set();
 for(const r of rows){const pid=r.querySelector('.kit-p').value;const q=parseNum(r.querySelector('.kit-q').value);
  if(!pid){if(soft)continue;return{err:'Elegí el artículo de cada renglón del combo (o quitá el renglón vacío).'};}
  const c=prod(pid);if(!c)return{err:'Un artículo del combo ya no existe.'};if(isKit(c))return{err:'Un combo no puede llevar otro combo adentro.'};
  if(p&&pid===p.id)return{err:'El combo no puede contenerse a sí mismo.'};
  if(!(q>0)||q>1000)return{err:'La cantidad de «'+pfull(c)+'» tiene que ser mayor a cero.'};if(c.unit==='u'&&!Number.isInteger(q))return{err:'«'+pfull(c)+'» se cuenta por unidad entera.'};
  if(seen.has(pid))return{err:'«'+pfull(c)+'» está repetido: poné la cantidad total en un solo renglón.'};seen.add(pid);kit.push({pid,qty:Math.round(q*1000)/1000});}
 if(!kit.length)return soft?{kit:[]}:{err:'Un combo tiene que tener al menos un artículo.'};
 if(kit.length===1&&kit[0].qty===1&&!soft)return{err:'Un combo de un solo artículo es el mismo producto: agregá los demás artículos.'};
 return{kit};}
/* ---------- datos de ejemplo: SÓLO en la demo ---------- */
function comboDemoSeed(st){if(IS_CLIENT||!st||!st.cfg||st.cfg.comboSeeded)return;st.cfg.comboSeeded=1;
 const P=st.products;const has=id=>P.some(p=>p.id===id);
 if(!st.rubros.some(r=>r.id==='bebidas-ej'))st.rubros.splice(Math.max(0,st.rubros.findIndex(r=>r.kind!=='rubro')),0,{id:'bebidas-ej',name:'Bebidas y hielo (ejemplo)',owner:'',reparte:false,alcohol:true,kind:'rubro',color:'#2f6f8f',mNom:'Bebidas',mTitle:'Bebidas',mHint:'',layout:'rows',menuOn:false});
 const mk=(id,name,sub,price,cost,stock)=>{if(!has(id))P.push({id,name,sub,grupo:'',rubro:'bebidas-ej',price,cost,stock,unit:'u',barcode:'',plu:'',menu:false,active:true,desc:'',demo:true});};
 mk('ej-fernet-750','Fernet Branca','750 ml',1450000,1050000,24);mk('ej-coca-3l','Coca-Cola','3 lt',520000,370000,30);mk('ej-hielo','Hielo','bolsa 2 kg',180000,90000,40);
 if(!has('ej-combo-fernet'))P.push({id:'ej-combo-fernet',name:'Combo Fernet Branca 750 + Coca-Cola 3 lt + Hielo',sub:'ejemplo de combo',grupo:'',rubro:'promo',price:2050000,cost:1510000,stock:0,unit:'u',barcode:'',plu:'',menu:true,active:true,desc:'Se descuenta 1 de cada artículo',demo:true,
  kit:[{pid:'ej-fernet-750',qty:1},{pid:'ej-coca-3l',qty:1},{pid:'ej-hielo',qty:1}]});}
