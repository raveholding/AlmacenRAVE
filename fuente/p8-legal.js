/* ===== Legal: textos del menú y de la web, y lista de verificación (Argentina / Salta) =====
   Son PLANTILLAS: ninguna cita legal está validada por un abogado. Todo lo marcado [VERIFICAR] se confirma con asesor legal y fuente oficial. */
function legalBase(){const T=S.tenant;const nm=T.legal||T.name;const ad=T.address||'';const wa=T.phone||'';
 return[
 {id:'privacidad',title:'Términos y Política de Privacidad',titleEn:'Terms and Privacy Policy',text:
`**¿Quién trata tus datos?**
${nm}, ${ad}. Contacto: WhatsApp ${wa}. [Completar con razón social y CUIT del titular de la base de datos].

**¿Para qué usamos tus datos?**
Nombre, apellido, WhatsApp y fecha de cumpleaños se usan para gestionar tu participación en el Club RAVE (tarjeta de sellos, cupones y membresías), y —sólo si lo aceptás en una casilla aparte— para enviarte promociones por WhatsApp. Cada finalidad tiene su propio consentimiento y podés retirarlo cuando quieras.

**Base legal y minimización**
Tratamos tus datos con tu consentimiento expreso (Ley 25.326 de Protección de Datos Personales) [VERIFICAR con asesor legal]. Pedimos sólo lo necesario: no se solicitan DNI, dirección ni correo. El Club es sólo para mayores de 18 años: no se registran datos de menores.

**¿Cómo se guardan?**
Se guardan en el sistema de gestión del comercio, con acceso restringido por usuario y permisos, y quedan registradas las acciones sobre los datos. Los datos no se venden ni se ceden a terceros. [VERIFICAR plazos de conservación y medidas de seguridad definitivas con asesor legal.]

**Tus derechos (acceso, rectificación, supresión y oposición)**
Podés pedir en cualquier momento ver, corregir o borrar tus datos, o dejar de recibir mensajes, escribiendo por WhatsApp al local. Respondemos dentro de los plazos legales [VERIFICAR plazos]. La Agencia de Acceso a la Información Pública (AAIP) es el órgano de control de la Ley 25.326 y atiende denuncias y reclamos [VERIFICAR texto oficial exigido].

**Terceros que ve tu navegador**
Este menú muestra un mapa de Google y usa tipografías de Google Fonts: Google puede recibir tu dirección IP al cargarlos. No usamos cookies publicitarias ni píxeles de seguimiento. La tarjeta del Club se recuerda en este dispositivo (almacenamiento local) y podés quitarla cuando quieras.

Última actualización: octubre de 2026 (plantilla).`},
 {id:'compra',title:'Precios, pedidos y entregas',titleEn:'Prices, orders and delivery',text:
`**Precios**
Todos los precios publicados incluyen impuestos y pueden cambiar sin previo aviso (Ley 24.240 de Defensa del Consumidor [VERIFICAR]). El precio final se confirma por WhatsApp antes de coordinar el pago y la entrega.

**Pedidos**
El carrito de este menú arma una solicitud de pedido que se envía por WhatsApp: no es una venta ni cobra online. La venta se concreta cuando el comercio la confirma y se cobra en el local o por el medio acordado.

**Cupones y membresías**
En cada compra se aplica un solo beneficio (el mayor entre cupón y membresía; no se acumulan). Los productos de tabaco no participan de descuentos ni promociones [VERIFICAR Ley 26.687]. Las condiciones de cada cupón figuran en su tarjeta.

**Cambios y devoluciones**
[Completar la política del comercio: plazos y condiciones, siempre sin perjuicio de los derechos del consumidor que fija la ley.]`},
 {id:'arrepentimiento',title:'Botón de arrepentimiento y defensa del consumidor',titleEn:'Withdrawal button and consumer protection',text:
`**Botón de arrepentimiento**
Si contrataste a distancia (por WhatsApp o canales digitales) podés revocar tu compra dentro de los 10 días corridos desde que recibís el producto, sin costo (Ley 24.240, art. 34 y Resolución 424/2020 de la Secretaría de Comercio Interior [VERIFICAR vigencia y alcance]). Usá el botón "Botón de arrepentimiento" de esta página: se abre WhatsApp con el pedido ya redactado.

**Defensa del consumidor**
Información y reclamos: Dirección de Defensa del Consumidor de la provincia de Salta y Defensa del Consumidor de la Nación [VERIFICAR datos de contacto oficiales vigentes antes de publicar].`},
 {id:'alcohol',title:'Venta de alcohol y tabaco',titleEn:'Alcohol and tobacco sales',text:
`**Alcohol**
Prohibida su venta a menores de 18 años (Ley 24.788). Beber con moderación. La venta de bebidas alcohólicas está habilitada en el horario que fija la normativa de la provincia de Salta [VERIFICAR horario y normativa vigente]; fuera de ese horario el menú oculta esos productos.

**Tabaco**
Prohibida su venta a menores de 18 años. La publicidad y promoción de productos de tabaco está regulada (Ley 26.687) [VERIFICAR con asesor si publicar tabaco en el menú digital, con fotos de marcas, es admisible y con qué advertencias sanitarias]. El fumar daña tu salud.`},
 {id:'wifi',title:'Wi-Fi para clientes',titleEn:'Guest Wi-Fi',text:
`Red de invitados, separada de la red del comercio. Uso sujeto a los términos del local; el comercio no se responsabiliza por el uso que terceros hagan de la red. [VERIFICAR el texto del cartel obligatorio para ofrecer Wi-Fi al público; el encargo del proyecto menciona la Ley 25.891 y su aplicación debe confirmarse.]`}];}
function legalDocs(){const ov=(S.legal&&S.legal.over)||{};return legalBase().map(d=>({...d,text:ov[d.id]!==undefined?ov[d.id]:d.text,edited:ov[d.id]!==undefined}));}
function legalHtml(t){const e=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');return String(t).split(/\n\s*\n/).map(b=>{b=b.trim();if(!b)return'';const L=b.split('\n');
 if(L.length===1&&/^\*\*.+\*\*$/.test(L[0]))return'<h4>'+e(L[0])+'</h4>';if(/^\*\*.+\*\*$/.test(L[0])&&L.length>1)return'<h4>'+e(L[0])+'</h4><p>'+e(L.slice(1).join(' '))+'</p>';return'<p>'+e(L.join(' '))+'</p>';}).join('');}
function legalPublic(){const c=mCfg();return legalDocs().filter(d=>d.id!=='wifi'||(c.wifi&&c.wifi.on)).map(d=>({id:d.id,title:d.title,titleEn:d.titleEn,html:legalHtml(d.text)}));}

const LEGAL_CHECK=[
 ['Política de privacidad pública y consentimiento expreso por finalidad',(IS_CLIENT?'Hecho':'Hecho en la demo'),'Confirmar el texto con asesor legal (Ley 25.326).'],
 ['Registro de la base de datos de clientes ante la autoridad (AAIP / Registro Nacional de Bases de Datos)','No es del sistema','El dueño verifica si debe inscribirse y lo tramita [VERIFICAR].'],
 ['Derechos de acceso, rectificación y supresión','Hecho: baja desde Clientes; canal por WhatsApp','Definir quién responde y en qué plazo [VERIFICAR].'],
 ['Club sólo para mayores de 18 (no se guardan datos de menores)','Hecho','Revisar con asesor el tratamiento de datos de menores.'],
 ['Control de edad al entrar al menú (alcohol y tabaco, Ley 24.788 / 26.687)','Hecho (el del menú original)','Confirmar leyendas exactas [VERIFICAR].'],
 ['Horario de venta de alcohol (Salta)','Configurable; cargado 07:00–00:00 de ejemplo','Confirmar el horario vigente [VERIFICAR].'],
 ['Tabaco: sin descuentos ni promociones','Hecho (el sistema lo excluye de cupones y membresías)','Consultar si publicar tabaco con fotos de marcas en el menú es admisible [VERIFICAR Ley 26.687].'],
 ['Precios con impuestos incluidos y pedido = solicitud (no venta)','Hecho','—'],
 ['Botón de arrepentimiento (10 días, Res. 424/2020)','Hecho: abre WhatsApp con el pedido redactado y queda registro','Confirmar que el mecanismo cumple lo exigido [VERIFICAR].'],
 ['Información de Defensa del Consumidor visible','Plantilla cargada','Completar datos oficiales de contacto [VERIFICAR].'],
 ['Ticket: "DOCUMENTO NO VÁLIDO COMO FACTURA" cuando no hay CAE','Hecho','—'],
 ['Facturación electrónica (ARCA): certificado, punto de venta y CAE',((window.RAVE_CLOUD&&window.RAVE_CLOUD.url)?'Implementado (servidor + WSAA/WSFE); falta probarlo en homologación con el certificado real del comercio':'En la demo es simulado; el sistema del cliente lo pide a ARCA desde el servidor y falta probarlo en homologación'),'Trámite de certificado y servicio WSFE con Clave Fiscal; probar contra homologación [VERIFICAR].'],
 ['CUIT y condición frente al IVA en el ticket','Campos vacíos para completar','El dueño los carga en Periféricos y ticket.'],
 ['Terceros en la web (Google Maps y Google Fonts)','Informado en la política de privacidad','Evaluar un aviso de cookies si se suma analítica o píxeles.'],
 ['Wi-Fi de invitados: red aislada y cartel','Texto de plantilla','Confirmar el cartel obligatorio [VERIFICAR Ley 25.891 u otra norma].'],
 ['Fotos y marcas de productos del menú','Tomadas del menú actual del cliente','Confirmar que tiene autorización de uso de imágenes y marcas.'],
 ['Plazos de conservación de datos y de comprobantes','No definido','Definir con contador y asesor legal [VERIFICAR].'],
 ['Membresías: términos aceptados, precio y cancelación visibles','Hecho (se acepta al activar)','Revisar redacción final.']];
reg('legal','Legal y cumplimiento','shield','config',()=>{const L=S.legal;const docs=legalDocs();
 return `<div class="row"><h1 class="sp">Legal y cumplimiento · Argentina / Salta</h1></div>
 <div class="${L.confirmedAt?'okbox':'warnbox'}">${L.confirmedAt?`Textos confirmados por <b>${esc(L.confirmedBy)}</b> el ${fmtDT(L.confirmedAt)}.`:'<b>Los textos legales son plantillas sin revisar.</b> No reemplazan el asesoramiento de un abogado: confirmalos antes de publicar el menú.'}<div class="row" style="margin-top:.5rem"><button class="btn sm" data-act="lgConfirm">Registrar confirmación del asesor</button></div></div>
 <div class="card" style="margin-top:1rem"><h3>Textos que ve el público</h3><div class="tw"><table><tbody>${docs.map(d=>`<tr><td><b>${esc(d.title)}</b>${d.edited?' <span class="tag warn">editado</span>':''}</td><td class="r"><button class="btn sm" data-act="lgEdit" data-id="${d.id}">Editar</button>${d.edited?` <button class="btn sm" data-act="lgReset" data-id="${d.id}">Restaurar</button>`:''}</td></tr>`).join('')}</tbody></table></div><p class="sm mut">Se muestran en el menú público dentro de "Información legal". Los cambios se ven al instante.</p></div>
 <div class="card" style="margin-top:1rem"><h3>Lista de verificación</h3><div class="tw"><table><thead><tr><th>Requisito</th><th>${IS_CLIENT?'Estado':'Estado en esta demo'}</th><th>Qué falta / quién lo hace</th></tr></thead><tbody>${LEGAL_CHECK.map(r=>`<tr><td>${esc(r[0])}</td><td class="sm">${esc(r[1])}</td><td class="sm">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div><p class="sm mut">Ninguna norma citada fue validada por un profesional: todo [VERIFICAR] se confirma con asesor legal y la fuente oficial (infoleg.gob.ar, argentina.gob.ar, boletín oficial de Salta).</p></div>`;},null,'Menú y web');
A.lgEdit=el=>{const d=legalDocs().find(x=>x.id===el.dataset.id);if(!d)return;modal('Editar: '+d.title,`<p class="sm mut">Párrafos separados por una línea en blanco. **Negrita** para títulos.</p><textarea id="lg-t" rows="14" style="width:100%">${esc(d.text)}</textarea>`,{wide:true,okText:'Guardar',onOk:w=>{const t=val('lg-t');if(t.trim().length<20)return w._err('El texto es muy corto.'),false;S.legal.over=S.legal.over||{};S.legal.over[d.id]=t;S.legal.confirmedAt=0;S.legal.confirmedBy='';audit('LEGAL_EDITAR',d.title);save();pubRefresh();rerender();}});};
A.lgReset=el=>{if(S.legal.over)delete S.legal.over[el.dataset.id];audit('LEGAL_RESTAURAR',el.dataset.id);save();pubRefresh();rerender();};
A.lgConfirm=()=>modal('Confirmación del asesor',`<label for="lg-n">Nombre de quien confirmó (asesor legal o titular)</label><input id="lg-n" maxlength="60"><p class="sm mut">Queda registrado con fecha y hora. Si después se edita un texto, la confirmación se borra.</p>`,{onOk:w=>{if(val('lg-n').trim().length<3)return w._err('Escribí el nombre.'),false;S.legal.confirmedBy=val('lg-n').trim();S.legal.confirmedAt=now();audit('LEGAL_CONFIRMADO',S.legal.confirmedBy);save();rerender();}});
