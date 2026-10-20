/* =====================================================================
   MENÚ PÚBLICO: MODALIDAD «LOCAL» O «TIENDA CON ENVÍOS» (V26.10 · 4.26)
   Opcional por comercio. «Local» (por defecto) = el menú de siempre: se consulta y se pide por WhatsApp para retirar o
   coordinar. «Tienda con envíos» = el mismo menú, más una sección de entrega en el carrito: retiro, envío local y envío a
   otras provincias con costo por provincia, envío gratis desde un monto, plazo, transportista, mínimo de compra y datos de
   entrega que viajan en el mensaje de WhatsApp. NO cobra ni descuenta stock: el pedido sigue siendo una SOLICITUD que el
   comercio confirma y cobra en el POS (que recalcula todo). El pago online y las guías de transportistas siguen siendo la
   integración opcional de 4.18/O.2 (pendiente de proveedor y servidor). Se guarda en S.menu.ship: usa el mismo borrador →
   publicar → versión → revertir que el resto del menú. ===================================================== */
const PROVS=['Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán'];
const shipCfg=()=>{const m=S.menu;const s=m.ship=m.ship||{};s.mode=s.mode==='tienda'?'tienda':'local';s.pickup=s.pickup||{on:true,place:'',hours:''};s.local=s.local||{on:false,fee:0,free:0,zones:''};
 s.zones=Array.isArray(s.zones)?s.zones:[];s.rest=s.rest||{on:false,quote:true,fee:0,eta:''};s.min=+s.min||0;s.note=s.note||'';s.alcohol=s.alcohol==='si'?'si':'no';return s;};
/* lo único que se publica: nada de datos internos; los importes van en pesos como el resto del menú */
function shipPublic(c){const s=c&&c.ship;if(!s||s.mode!=='tienda')return null;
 const z=(s.zones||[]).filter(x=>PROVS.includes(x.prov)).map(x=>({prov:x.prov,fee:(+x.fee||0)/100,free:(+x.free||0)/100,eta:String(x.eta||'').slice(0,60),carrier:String(x.carrier||'').slice(0,60)}));
 return{mode:'tienda',pickup:s.pickup&&s.pickup.on?{place:String(s.pickup.place||'').slice(0,120),hours:String(s.pickup.hours||'').slice(0,120)}:null,
  local:s.local&&s.local.on?{fee:(+s.local.fee||0)/100,free:(+s.local.free||0)/100,zones:String(s.local.zones||'').slice(0,120)}:null,zones:z,
  rest:s.rest&&s.rest.on?{quote:!!s.rest.quote,fee:s.rest.quote?0:(+s.rest.fee||0)/100,eta:String(s.rest.eta||'').slice(0,60)}:null,
  min:(+s.min||0)/100,note:String(s.note||'').slice(0,300),alcohol:s.alcohol==='si'};}
function shipRowHtml(z){return `<div class="sh-row card" style="margin:.4rem 0;padding:.6rem"><div class="grid g2"><div><label>Provincia</label><select class="sh-p">${PROVS.map(p=>`<option ${z.prov===p?'selected':''}>${esc(p)}</option>`).join('')}</select></div><div><label>Transportista / servicio (texto)</label><input class="sh-c" maxlength="60" value="${esc(z.carrier||'')}" placeholder="Ej.: correo o transporte que uses"></div></div>
 <div class="grid g2"><div><label>Costo de envío ($)</label>${numIn('', z.fee||0,'0','class="sh-f"')}</div><div><label>Gratis desde ($, vacío = nunca)</label>${numIn('', z.free||0,'0','class="sh-g"')}</div></div>
 <label>Plazo estimado</label><input class="sh-e" maxlength="60" value="${esc(z.eta||'')}" placeholder="Ej.: 3 a 5 días hábiles"><div class="row" style="margin-top:.4rem"><button class="btn sm red" type="button" data-act="shDelRow">Quitar</button></div></div>`;}
function storeCard(){const s=shipCfg(),t=s.mode==='tienda',ok=can('menu_admin');
 return `<div class="card" style="margin-top:1rem" id="st-card"><div class="row"><h3 class="sp">Tipo de menú público</h3><span class="tag ${t?'warn':'ok'}">${t?'Tienda con envíos':'Menú local'}</span></div>
 <p class="sm mut">Elegí cómo trabaja tu menú. <b>Menú local</b>: se mira y se pide por WhatsApp para retirar o coordinar (como siempre). <b>Tienda con envíos</b>: el carrito pide los datos de entrega y calcula el envío por provincia, para vender a otras provincias. En ambos casos el pedido es una <b>solicitud</b>: vos lo confirmás y lo cobrás en el sistema, que recalcula precios y stock. Los cambios se guardan como borrador y se publican con «Publicar».</p>
 <fieldset style="border:0;padding:0;margin:.3rem 0"><label class="chk"><input type="radio" name="st-m" value="local" ${t?'':'checked'} ${ok?'':'disabled'}> Menú local (retiro / consulta por WhatsApp)</label><label class="chk"><input type="radio" name="st-m" value="tienda" ${t?'checked':''} ${ok?'':'disabled'}> Tienda con envíos (también a otras provincias)</label></fieldset>
 <div id="st-box" ${t?'':'hidden'}>
 <h4 style="margin:.6rem 0 .2rem">Formas de entrega</h4>
 <label class="chk"><input type="checkbox" id="st-pk" ${s.pickup.on?'checked':''}> Retiro en el local</label><div class="grid g2"><div><label for="st-pp">Punto de retiro</label><input id="st-pp" maxlength="120" value="${esc(s.pickup.place)}"></div><div><label for="st-ph">Horarios e instrucciones</label><input id="st-ph" maxlength="120" value="${esc(s.pickup.hours)}"></div></div>
 <label class="chk"><input type="checkbox" id="st-lc" ${s.local.on?'checked':''}> Envío local (cadetería / zona cercana)</label><div class="grid g2"><div><label for="st-lf">Costo ($)</label>${numIn('st-lf',s.local.fee,'0')}</div><div><label for="st-lg">Gratis desde ($, vacío = nunca)</label>${numIn('st-lg',s.local.free,'0')}</div></div><label for="st-lz">Zonas que cubre</label><input id="st-lz" maxlength="120" value="${esc(s.local.zones)}" placeholder="Barrios o ciudades">
 <h4 style="margin:.8rem 0 .2rem">Envíos a otras provincias (costo por provincia)</h4><p class="sm mut">Cargá sólo las provincias a las que enviás y el costo que vos definís. No se inventan tarifas ni coberturas de transportistas.</p>
 <div id="st-rows">${s.zones.map(shipRowHtml).join('')}</div><div class="row"><button class="btn sm" type="button" data-act="shAddRow">+ Agregar provincia</button></div>
 <label class="chk" style="margin-top:.6rem"><input type="checkbox" id="st-ron" ${s.rest.on?'checked':''}> Aceptar pedidos de otras provincias no listadas</label><div class="grid g2"><div><label class="chk"><input type="checkbox" id="st-rq" ${s.rest.quote?'checked':''}> Costo a cotizar por WhatsApp</label></div><div><label for="st-rf">o costo fijo ($)</label>${numIn('st-rf',s.rest.fee,'0')}</div></div><label for="st-re">Plazo estimado (resto del país)</label><input id="st-re" maxlength="60" value="${esc(s.rest.eta)}">
 <h4 style="margin:.8rem 0 .2rem">Reglas</h4><div class="grid g2"><div><label for="st-mn">Compra mínima para envíos ($, vacío = sin mínimo)</label>${numIn('st-mn',s.min,'0')}</div><div><label for="st-al">Bebidas alcohólicas</label><select id="st-al"><option value="no" ${s.alcohol==='no'?'selected':''}>Sólo retiro en el local (recomendado)</option><option value="si" ${s.alcohol==='si'?'selected':''}>Permitir envío (verificá la normativa de cada provincia)</option></select></div></div>
 <label for="st-nt">Condiciones que se muestran al cliente (plazos, seguros, cambios)</label><textarea id="st-nt" rows="2" maxlength="300">${esc(s.note)}</textarea>
 <p class="sm mut">Los datos de entrega que escribe el cliente (domicilio, teléfono) <b>sólo viajan dentro de su mensaje de WhatsApp</b>: el menú no los guarda. Condiciones de envío, derecho de arrepentimiento, venta de alcohol a otras provincias y datos personales: confirmalos con tu asesor [VERIFICAR].</p></div>
 ${ok?'<div class="row" style="margin-top:.6rem"><button class="btn gold" data-act="shSave">Guardar borrador del tipo de menú</button></div>':'<p class="sm mut">Sólo quien administra el menú público puede cambiar esto.</p>'}</div>`;}
document.addEventListener('change',e=>{const r=e.target.closest&&e.target.closest('input[name=st-m]');if(r){const b=document.getElementById('st-box');if(b)b.hidden=r.value!=='tienda';}});
A.shAddRow=()=>{const box=$('#st-rows');if(!box)return;const d=document.createElement('div');d.innerHTML=shipRowHtml({prov:PROVS[0],fee:0,free:0});box.appendChild(d.firstElementChild);};
A.shDelRow=el=>{const r=el.closest('.sh-row');if(r)r.remove();};
function shipRead(){const mode=(document.querySelector('input[name=st-m]:checked')||{}).value==='tienda'?'tienda':'local';
 const money=(v,lbl)=>{const t=String(v||'').trim();if(t==='')return 0;const n=parseNum(t);if(isNaN(n)||n<0||n>1e8)throw new Error(lbl+': ingresá un monto válido.');return Math.round(n*100);};
 try{const zones=[],seen=new Set();
  $$('#st-rows .sh-row').forEach(r=>{const prov=r.querySelector('.sh-p').value;if(!PROVS.includes(prov))throw new Error('Provincia inválida.');if(seen.has(prov))throw new Error('La provincia '+prov+' está repetida.');seen.add(prov);
   zones.push({prov,carrier:r.querySelector('.sh-c').value.trim().slice(0,60),fee:money(r.querySelector('.sh-f').value,'Costo de '+prov),free:money(r.querySelector('.sh-g').value,'Gratis desde ('+prov+')'),eta:r.querySelector('.sh-e').value.trim().slice(0,60)});});
  const o={mode,pickup:{on:$('#st-pk')?$('#st-pk').checked:true,place:val('st-pp').trim().slice(0,120),hours:val('st-ph').trim().slice(0,120)},
   local:{on:$('#st-lc')?$('#st-lc').checked:false,fee:money(val('st-lf'),'Envío local'),free:money(val('st-lg'),'Envío local gratis desde'),zones:val('st-lz').trim().slice(0,120)},zones,
   rest:{on:$('#st-ron')?$('#st-ron').checked:false,quote:$('#st-rq')?$('#st-rq').checked:true,fee:money(val('st-rf'),'Costo del resto del país'),eta:val('st-re').trim().slice(0,60)},
   min:money(val('st-mn'),'Compra mínima'),note:val('st-nt').trim().slice(0,300),alcohol:val('st-al')==='si'?'si':'no'};
  if(mode==='tienda'){const any=o.pickup.on||o.local.on||zones.length||o.rest.on;if(!any)throw new Error('Activá al menos una forma de entrega.');
   if(o.pickup.on&&o.pickup.place.length<3)throw new Error('Cargá el punto de retiro.');if(o.local.on&&o.local.zones.length<2)throw new Error('Indicá las zonas del envío local.');
   if(o.rest.on&&!o.rest.quote&&!o.rest.fee)throw new Error('Para «resto del país» cargá un costo fijo o elegí «a cotizar».');}
  return{o};}catch(e){return{err:e.message};}}
A.shSave=()=>{if(!can('menu_admin'))return toast('No tenés permiso',1);const r=shipRead();if(r.err)return toast(r.err,1);const s=shipCfg();const old=s.mode;
 S.menu.ship=r.o;audit('MENU_TIPO',(old+' → '+r.o.mode)+' · provincias '+r.o.zones.length+' · retiro '+(r.o.pickup.on?'sí':'no')+' · envío local '+(r.o.local.on?'sí':'no')+' · resto '+(r.o.rest.on?'sí':'no'),{ent:'menu',eid:'ship',old:{mode:old},nw:{mode:r.o.mode}});
 save();rerender();toast('Borrador guardado. Para que lo vea el público, tocá «Publicar».');};
