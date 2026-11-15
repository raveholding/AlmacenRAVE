/* ===== V26.55 · Datos para facturar de cada cliente (condición frente a ARCA) y precarga en el cobro =====
   Pedido del dueño: al elegir un cliente en el cobro con factura electrónica, los datos que ya están en su ficha
   tienen que cargarse solos; y cada cliente tiene que tener su condición frente al IVA (ARCA).
   · La ficha del cliente gana el bloque «Datos para facturar (ARCA)»: CUIT/CUIL, condición frente al IVA, razón social
     y domicilio fiscal (el DNI sigue en el formulario principal). El CUIT es el MISMO campo que usa Mayorista (taxid).
   · En el cobro con ARCA, al identificar al cliente se precargan documento, número, condición y razón social.
     Siempre se puede corregir antes de cobrar; si se completan datos que la ficha no tenía, se guardan en la ficha
     (sólo se completan campos vacíos; cambiar datos ya cargados lo hace el administrador desde la ficha).
   · CUIT, razón social y domicilio viajan cifrados a la nube (como el resto de los datos personales). */
const IVA_COND=[['','Sin cargar'],['5','Consumidor final'],['1','IVA Responsable Inscripto'],['6','Responsable Monotributo'],['4','IVA Sujeto Exento'],['13','Monotributista Social']];
const ivaTxt=k=>(IVA_COND.find(x=>x[0]===String(k||''))||IVA_COND[0])[1];
function fiscCardHTML(c){const ed=!c||(typeof custAdm==='function'?custAdm():can('config'));const dis=ed?'':'disabled';
 return `<div class="card" style="margin:.6rem 0"><h3 style="margin-top:0">Datos para facturar (ARCA)</h3>
 <p class="sm mut">Se usan solos al hacer una factura electrónica a este cliente. El DNI va arriba; para Factura A hace falta CUIT y «Responsable Inscripto».</p>
 <div class="grid g2"><div><label for="fc-cond">Condición frente al IVA</label><select id="fc-cond" ${dis}>${IVA_COND.map(([k,t])=>`<option value="${k}" ${String((c&&c.ivaCond)||'')===k?'selected':''}>${t}</option>`).join('')}</select></div>
 <div><label for="fc-tx">CUIT / CUIL</label><input id="fc-tx" inputmode="numeric" maxlength="13" autocomplete="off" placeholder="20-12345678-6" value="${esc((c&&c.taxid)||'')}" ${dis}></div>
 <div><label for="fc-rz">Razón social (como figura en ARCA)</label><input id="fc-rz" maxlength="80" autocomplete="off" placeholder="Si se deja vacío, va el nombre" value="${esc((c&&c.razon)||'')}" ${dis}></div>
 <div><label for="fc-dom">Domicilio fiscal (opcional)</label><input id="fc-dom" maxlength="100" autocomplete="off" value="${esc((c&&c.domFis)||'')}" ${dis}></div></div>
 ${ed?'':'<p class="sm mut">Los datos fiscales ya cargados los cambia el administrador. En el cobro se pueden completar los que falten.</p>'}</div>`;}
function fiscRead(w){const q=id=>w.querySelector('#'+id);if(!q('fc-cond')||q('fc-cond').disabled)return null;
 const tx=q('fc-tx').value.replace(/\D/g,''),cond=q('fc-cond').value,rz=q('fc-rz').value.trim().replace(/[<>]/g,'').slice(0,80),dom=q('fc-dom').value.trim().replace(/[<>]/g,'').slice(0,100);
 if(tx&&!arcaCuitOk(tx))return{err:'El CUIT/CUIL no es válido (11 dígitos con dígito verificador correcto).'};
 if(cond==='1'&&!tx)return{err:'Un Responsable Inscripto necesita su CUIT para la Factura A.'};
 return{tx,cond,rz,dom};}
function fiscApply(c,f,origen){if(!c||!f)return;const chg=[];const set=(k,v,lbl,mask)=>{if(String(c[k]||'')!==String(v||'')){chg.push(lbl+(mask?(v?' cargado':' borrado'):': '+(v||'—')));c[k]=v;}};
 set('taxid',f.tx,'CUIT',1);set('ivaCond',f.cond,'condición IVA',0);if(chg.length&&chg[chg.length-1].startsWith('condición'))chg[chg.length-1]='condición IVA: '+ivaTxt(f.cond);
 set('razon',f.rz,'razón social',1);set('domFis',f.dom,'domicilio fiscal',1);
 if(chg.length)audit('CLIENTE_FISCAL','socio '+pad4(c.num)+' · '+chg.join(' · ')+(origen?' · '+origen:''));}

/* ---- cobro con ARCA: precarga del receptor desde la ficha ---- */
function arcaRcpFromCust(c){const r={from:c.id,t:'99',n:'',c:'5',nm:'',hint:''};const tx=String(c.taxid||'').replace(/\D/g,'');const dn=String(c.dni||'').replace(/\D/g,'');
 r.nm=(c.razon||custFull(c)||'').slice(0,80);
 if(tx.length===11){r.t='80';r.n=tx;r.c=c.ivaCond||'1';if(!c.ivaCond)r.hint='La ficha no tiene la condición frente al IVA: revisala antes de facturar.';}
 else if(dn){r.t='96';r.n=dn;r.c=c.ivaCond||'5';}
 else{r.c=c.ivaCond||'5';r.hint='La ficha no tiene CUIT ni DNI: si los completás acá, quedan guardados en la ficha.';}
 return r;}
function arcaRcpAuto(){if(!pos.arca)return;const r=pos.rcp;
 if(pos.cust){if(!r||r.from!==pos.cust){const c=custById(pos.cust);if(c)pos.rcp=arcaRcpFromCust(c);}}
 else if(r&&r.from){pos.rcp={t:'99',n:'',c:'5',nm:''};}}
/* después de cobrar: completa en la ficha lo que no tenía (no pisa lo cargado) */
function arcaRcpToCust(cust){const r=pos.rcp;if(!cust||!r||r.t==='99'||r.from!==cust.id)return;const n=String(r.n||'').replace(/\D/g,'');const f={};
 if((r.t==='80'||r.t==='86')&&n.length===11&&!cust.taxid&&arcaCuitOk(n)&&!S.customers.some(x=>x.id!==cust.id&&x.status!=='baja'&&x.taxid===n))f.taxid=n;
 if(r.t==='96'&&/^\d{7,8}$/.test(n)&&!cust.dni&&!S.customers.some(x=>x.id!==cust.id&&x.status!=='baja'&&x.dni&&normDni(x.dni)===n))f.dni=n;
 if(!cust.ivaCond&&r.c)f.ivaCond=r.c;if(!cust.razon&&r.nm&&r.nm!==custFull(cust))f.razon=r.nm.slice(0,80);
 const k=Object.keys(f);if(!k.length)return;Object.assign(cust,f);
 audit('CLIENTE_FISCAL','socio '+pad4(cust.num)+' · completado desde la factura: '+k.map(x=>({taxid:'CUIT',dni:'DNI',ivaCond:'condición IVA ('+ivaTxt(f.ivaCond)+')',razon:'razón social'}[x])).join(', '));}
