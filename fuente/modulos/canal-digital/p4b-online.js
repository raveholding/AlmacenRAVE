/* =====================================================================
   VENTAS ONLINE (V26 · 4.18) y WALLET / AVISOS (V26 · 4.19)
   Paneles de configuración HONESTOS: dejan preparado el modo de venta y los
   requisitos, pero NO simulan pagos, envíos ni tarjetas de Wallet. Mientras
   falten el proveedor y el servidor, el menú sigue enviando por WhatsApp.
   ===================================================================== */
const ONL_MODES={whatsapp:'Pedido por WhatsApp (actual)',online_checkout:'Checkout online (compra directa)',whatsapp_and_checkout:'WhatsApp + checkout online'};
const onlCfg=()=>{const o=S.cfg.online=S.cfg.online||{};o.mode=ONL_MODES[o.mode]?o.mode:'whatsapp';o.pickup=o.pickup||{on:false,place:'',hours:''};o.local=o.local||{on:false,fee:0,zones:''};o.msg=o.msg||'';o.policiesOk=!!o.policiesOk;return o;};
/* Lista de requisitos que faltan para anunciar el checkout al público. Vacía = listo. */
function onlineMissing(){const o=onlCfg(),m=[];
 m.push({k:'prov',t:'Proveedor de pagos conectado (Mercado Pago u otro verificado)',why:'Requiere cuenta del comercio, credenciales cargadas como secreto en el servidor y el contrato PaymentProviderAdapter. En esta versión no hay ningún proveedor conectado.',ext:true});
 m.push({k:'srv',t:'Servidor de órdenes y webhook firmado',why:'La orden, el total, el stock y la confirmación del pago se calculan y validan en el servidor; la vuelta del navegador nunca acredita un pago. Este servicio todavía no está desplegado.',ext:true});
 if(!(o.pickup.on&&o.pickup.place.trim().length>=3)&&!(o.local.on&&o.local.fee>=0))m.push({k:'ent',t:'Al menos un medio de entrega completo (retiro con punto, o envío local con tarifa)',why:'Cargalo abajo.'});
 if(o.msg.trim().length<5)m.push({k:'msg',t:'Mensaje de confirmación de la compra',why:'Escribilo abajo (mínimo 5 letras).'});
 if(!o.policiesOk)m.push({k:'pol',t:'Políticas revisadas (términos, arrepentimiento, privacidad)',why:'Marcá abajo cuando las hayas revisado con tu asesor [VERIFICAR].'});
 m.push({k:'sbx',t:'Pruebas en sandbox del proveedor (aprobado, rechazado, pendiente, webhook repetido)',why:'Sólo se pueden hacer con la cuenta del comercio conectada.',ext:true});
 return m;}
function onlineCard(){const o=onlCfg(),miss=onlineMissing(),can_=can('config');
 const mode=(k,dis)=>`<label class="chk"><input type="radio" name="onl-m" value="${k}" ${o.mode===k?'checked':''} ${can_?'':'disabled'}> ${esc(ONL_MODES[k])}${dis?' <span class="tag warn">bloqueado hasta cumplir los requisitos</span>':''}</label>`;
 return `<div class="card" style="margin-top:1rem" id="onl-card"><div class="row"><h3 class="sp">Ventas online (checkout)</h3><span class="tag ${o.mode==='whatsapp'?'ok':'warn'}">Modo: ${esc(ONL_MODES[o.mode])}</span><span class="tag warn">Pendiente de configuración</span></div>
 <p class="sm mut">Compra directa desde el menú, con retiro o envío. Está <b>apagada</b>: el menú público sigue enviando los pedidos por WhatsApp, sin cambios. No se anuncia al público hasta que se cumplan todos los requisitos de abajo; no hay pagos simulados.</p>
 <fieldset style="border:0;padding:0;margin:.4rem 0"><legend class="sm"><b>Modo de venta</b></legend>${mode('whatsapp',false)}${mode('online_checkout',miss.length>0)}${mode('whatsapp_and_checkout',miss.length>0)}</fieldset>
 <h4 style="margin:.6rem 0 .2rem">Requisitos</h4><ul class="sm" id="onl-miss" style="list-style:none;padding:0">${miss.map(x=>`<li style="margin:.3rem 0"><span class="tag ${x.ext?'warn':'bad'}">${x.ext?'Pendiente (externo)':'Falta'}</span> <b>${esc(x.t)}</b><br><span class="mut">${esc(x.why)}</span></li>`).join('')}</ul>
 <h4 style="margin:.6rem 0 .2rem">Entrega (parámetros no secretos)</h4>
 <label class="chk"><input type="checkbox" id="onl-pk" ${o.pickup.on?'checked':''} ${can_?'':'disabled'}> Retiro en el local</label>
 <label for="onl-pp">Punto de retiro</label><input id="onl-pp" maxlength="80" value="${esc(o.pickup.place)}" placeholder="Dirección o sucursal" ${can_?'':'disabled'}><label for="onl-ph">Horarios e instrucciones</label><input id="onl-ph" maxlength="120" value="${esc(o.pickup.hours)}" ${can_?'':'disabled'}>
 <label class="chk" style="margin-top:.5rem"><input type="checkbox" id="onl-lc" ${o.local.on?'checked':''} ${can_?'':'disabled'}> Envío local / cadetería (tarifa fija)</label>
 <label for="onl-lf">Tarifa fija en $</label>${numIn('onl-lf',o.local.fee,'0',can_?'':'disabled')}<label for="onl-lz">Zonas atendidas</label><input id="onl-lz" maxlength="120" value="${esc(o.local.zones)}" placeholder="Barrios o zonas" ${can_?'':'disabled'}>
 <p class="sm mut">Envío nacional (transportistas): <span class="tag warn">Pendiente de configuración</span> — requiere el adaptador y la documentación vigente de cada transportista [VERIFICAR]; no se inventan tarifas ni cobertura.</p>
 <label for="onl-ms">Mensaje de confirmación de la compra</label><input id="onl-ms" maxlength="160" value="${esc(o.msg)}" ${can_?'':'disabled'}>
 <label class="chk"><input type="checkbox" id="onl-po" ${o.policiesOk?'checked':''} ${can_?'':'disabled'}> Revisé términos, arrepentimiento y privacidad con mi asesor</label>
 ${can_?`<div class="row" style="margin-top:.6rem"><button class="btn gold" data-act="onlSave">Guardar configuración</button></div>`:'<p class="sm mut">Sólo quien puede modificar la configuración puede cambiar esto.</p>'}</div>`;}
A.onlSave=()=>{if(!can('config'))return toast('No tenés permiso',1);const o=onlCfg();
 const mEl=document.querySelector('input[name=onl-m]:checked');const mode=mEl?mEl.value:'whatsapp';
 const fee=val('onl-lf').trim()===''?0:parseNum(val('onl-lf'));if(isNaN(fee)||fee<0||fee>1e7)return toast('La tarifa tiene que ser un monto válido.',1);
 const n={pickup:{on:$('#onl-pk').checked,place:val('onl-pp').trim().slice(0,80),hours:val('onl-ph').trim().slice(0,120)},local:{on:$('#onl-lc').checked,fee:Math.round(fee*100),zones:val('onl-lz').trim().slice(0,120)},msg:val('onl-ms').trim().slice(0,160),policiesOk:$('#onl-po').checked};
 Object.assign(o,n);
 if(mode!=='whatsapp'){const miss=onlineMissing();if(miss.length){o.mode='whatsapp';audit('VENTA_ONLINE_MODO_RECHAZADO',mode+' · faltan '+miss.length+' requisito(s)');save();rerender();return toast('No se puede activar: faltan '+miss.length+' requisito(s). El menú sigue por WhatsApp.',1);}}
 if(o.mode!==mode){audit('VENTA_ONLINE_MODO',o.mode+' → '+mode);}o.mode=mode;audit('VENTA_ONLINE_CONFIG','retiro '+(n.pickup.on?'sí':'no')+', envío local '+(n.local.on?'sí':'no')+', políticas '+(n.policiesOk?'ok':'sin revisar'));save();rerender();toast('Configuración guardada');};

/* ---------- Wallet y avisos automáticos (4.19) ---------- */
function walletCard(){const cs=S.customers||[];const club=cs.filter(c=>c.consent&&c.consent.club).length,comm=cs.filter(c=>c.consent&&c.consent.comm).length;
 const req=[['Apple Wallet','Cuenta Apple Developer, Pass Type ID, certificado de firma de pases (guardado cifrado en el servidor), dominio HTTPS y web service de actualización [VERIFICAR documentación vigente de Apple].'],['Google Wallet','Cuenta de emisor (Issuer), clase de Loyalty y credenciales de servicio en el servidor; revisión de Google [VERIFICAR].'],['Correo transaccional','Proveedor de correo configurado en el servidor (hoy: pendiente).'],['WhatsApp Business API','Cuenta oficial, plantillas aprobadas y webhooks verificados (hoy: pendiente). Abrir wa.me NO es envío automático.'],['Cola y worker programado','Servicio en el servidor que envía sólo desde eventos confirmados del ledger, con límites, reintentos e idempotencia.']];
 return `<div class="card" style="margin-top:1rem" id="wal-card"><div class="row"><h3 class="sp">Tarjetas en Wallet y avisos automáticos</h3><span class="tag">Apagado</span><span class="tag warn">Pendiente de configuración</span></div>
 <p class="sm mut">Permite que el cliente guarde su tarjeta del Club en Apple Wallet o Google Wallet y recibir avisos (sellos, premio, vencimiento). No se activa sin los servicios de abajo; no se generan tarjetas ni se envían avisos de prueba que parezcan reales. La tarjeta web del Club actual y el pedido por WhatsApp siguen igual.</p>
 <label class="chk"><input type="checkbox" disabled> Habilitar Wallet y avisos (bloqueado: faltan los servicios)</label>
 <h4 style="margin:.6rem 0 .2rem">Qué hace falta</h4><ul class="sm" style="list-style:none;padding:0">${req.map(r=>`<li style="margin:.3rem 0"><span class="tag warn">Pendiente</span> <b>${esc(r[0])}</b><br><span class="mut">${esc(r[1])}</span></li>`).join('')}</ul>
 <h4 style="margin:.6rem 0 .2rem">Consentimientos hoy (datos reales de tus clientes)</h4><p class="sm">Clientes del Club con alta consentida: <b>${club}</b> · con permiso de comunicaciones comerciales: <b>${comm}</b> de ${cs.length}. Los avisos comerciales sólo irían a quienes tengan permiso vigente; los operativos (por ejemplo, confirmar una acción pedida) se tratan aparte [VERIFICAR con asesor legal]. Hoy no hay reglas de avisos activas.</p></div>`;}
