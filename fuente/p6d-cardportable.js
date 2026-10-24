/* =====================================================================
   TARJETA DEL CLUB PORTÁTIL (V26.10 · 4.25)
   Problema que resuelve: la tarjeta vivía sólo en el almacenamiento del navegador del celular
   (localStorage). Si el cliente abría el menú desde el navegador de Instagram/WhatsApp, borraba los datos
   del navegador, usaba otro celular o el sistema purgaba el almacenamiento, la tarjeta «desaparecía» y no había
   forma de volver a verla (el servidor nunca guarda el secreto de la tarjeta en claro).
   Solución (aditiva, sin tocar la validación de sellos ni el servidor):
   1) Espejo en IndexedDB + pedido de almacenamiento persistente: se restaura solo si el navegador borró localStorage.
   2) «Guardar mi tarjeta»: enlace personal (el secreto viaja en el # del enlace, que NUNCA llega a ningún servidor),
      botón compartir/copiar e imagen PNG con QR para la galería. Abrir el enlace o escanear el QR restaura la tarjeta.
   3) «Pedir mi tarjeta por WhatsApp» y, del lado del negocio, «Enlace de la tarjeta» en la ficha del cliente (sólo administrador,
      auditado, sin guardar el secreto en la auditoría).
   Wallet (Apple/Google) sigue pendiente de cuentas y certificados (4.19). ===================================================== */
const CARD_RE_ID=/^[A-Za-z0-9_-]{8,64}$/,CARD_RE_SEC=/^[A-Za-z0-9_-]{16,96}$/;
function cardB64(o){return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function cardUnB64(s){try{s=String(s||'').replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return JSON.parse(decodeURIComponent(escape(atob(s))));}catch(e){return null;}}
function cardLinkBase(){return /^https?:/.test(location.protocol)?location.href.split('#')[0].split('?')[0]:PUBLIC_URL();}
function cardLinkFor(id,secret,name,birth){if(!CARD_RE_ID.test(String(id||''))||!CARD_RE_SEC.test(String(secret||'')))return '';
 return cardLinkBase()+'#tarjeta='+cardB64({v:1,i:id,s:secret,n:String(name||'').replace(/[<>]/g,'').slice(0,80),b:/^\d{4}-\d{2}-\d{2}$/.test(String(birth||''))?birth:''});}
/* lo que el menú público necesita para ofrecer «Guardar mi tarjeta» */
function pubCardPortable(id){if(!id)return null;let secret='',name='',birth='';
 if(id===LS.get('rave.card')&&LS.get('rave.cardsec')){secret=LS.get('rave.cardsec');try{const i=JSON.parse(LS.get('rave.cardinfo')||'{}');name=i.name||'';birth=i.birth||'';}catch(e){}}
 else{const c=custByCard(id);if(!c||c.status==='baja')return null;secret=cardSecret(c,id);name=(c.name||'');birth=c.birth||'';}
 const link=cardLinkFor(id,secret,name,birth);if(!link)return null;
 return{link,qr:QR.svg(link,3,3),name:(name||'').split(' ')[0]};}
/* Importar desde el enlace (#tarjeta=…): valida todo, guarda en el celular y limpia la dirección */
function cardImportFromHash(){const h=location.hash||'';const m=/^#tarjeta=([A-Za-z0-9_-]{20,1500})$/.exec(h);
 const clean=()=>{try{history.replaceState(null,'',location.href.split('#')[0]+'#menu');}catch(e){location.hash='#menu';}};
 if(!m){clean();return false;}
 const o=cardUnB64(m[1]);clean();
 if(!o||o.v!==1||!CARD_RE_ID.test(String(o.i||''))||!CARD_RE_SEC.test(String(o.s||'')))return toast('El enlace de la tarjeta no es válido. Pedí uno nuevo en el local.',1),false;
 const name=String(o.n||'').replace(/[<>]/g,'').slice(0,80),birth=/^\d{4}-\d{2}-\d{2}$/.test(String(o.b||''))?o.b:'';
 LS.set('rave.card',o.i);LS.set('rave.cardsec',o.s);LS.set('rave.cardinfo',JSON.stringify({name,birth}));LS.del('rave.cardest');try{delete cardEst[o.i];}catch(e){}
 cardMirrorSave();try{cardFrameRefresh();}catch(e){}try{if(typeof cardPoll==='function')setTimeout(cardPoll,1500);}catch(e){}
 return true;}
/* Espejo en IndexedDB (sobrevive a más limpiezas que localStorage; igual no es eterno: por eso existe el enlace/imagen) */
function cardIdb(fn){try{const rq=indexedDB.open('rave-card',1);rq.onupgradeneeded=()=>rq.result.createObjectStore('kv');rq.onsuccess=()=>{try{fn(rq.result);}catch(e){}};rq.onerror=()=>{};}catch(e){}}
function cardMirrorSave(){const id=LS.get('rave.card');if(!id)return;const v={i:id,s:LS.get('rave.cardsec'),n:LS.get('rave.cardinfo')};cardIdb(db=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(v,'card');});}
function cardMirrorSync(){if(LS.get('rave.card')){cardMirrorSave();return;}
 cardIdb(db=>{const rq=db.transaction('kv').objectStore('kv').get('card');rq.onsuccess=()=>{const v=rq.result;if(!v||!CARD_RE_ID.test(String(v.i||''))||LS.get('rave.card'))return;
  LS.set('rave.card',v.i);if(v.s)LS.set('rave.cardsec',v.s);if(v.n)LS.set('rave.cardinfo',v.n);try{cardFrameRefresh();pubRefresh();}catch(e){}};});}
function cardMirrorInit(){try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}cardMirrorSync();if(typeof setInterval==='function')setInterval(cardMirrorSync,20000);}
/* Del lado del negocio: enlace de la tarjeta de un cliente (para mandárselo por WhatsApp si la perdió) */
A.cuCardLink=el=>{const c=custById(el.dataset.id);if(!c)return;
 if(!custAdm())return toast('Sólo el administrador entrega el enlace de una tarjeta.',1);
 if(c.status==='baja'||!c.secret)return toast('Este cliente no tiene una tarjeta activa.',1);
 /* id de tarjeta válido: el del cliente o una tarjeta adicional; si no tiene (clientes viejos con id corto), se le crea una */
 let cid=cardIdOk(c.id)?c.id:(c.cards||[]).find(x=>cardIdOk(x)&&cardSecret(c,x));
 if(!cid){cid=uid()+uid();c.cards=Array.isArray(c.cards)?c.cards:[];c.cards.push(cid);c.cardSecrets=c.cardSecrets||{};c.cardSecrets[cid]=c.secret;}
 const link=cardLinkFor(cid,cardSecret(c,cid),(c.name||''),c.birth||'');if(!link)return toast('No se pudo armar el enlace de la tarjeta.',1);
 audit('TARJETA_ENLACE','enlace de tarjeta emitido · socio '+pad4(c.num),{ent:'cliente',eid:c.id});save();
 const wa=normWA(c.wa),msg='Hola '+(c.name||'')+'! Este es el enlace de tu tarjeta del Club. Abrilo desde tu celular y guardá la página en tu pantalla de inicio. No lo compartas con nadie: es tu tarjeta personal.'+(walletMode()!=='pending'?' Desde ese enlace también podés guardarla en Apple Wallet o Google Wallet.':'')+'\n'+link;
 const w=modal('Enviar tarjeta · '+custFull(c),`<p class="sm">Quien abra este enlace tiene la tarjeta de <b>${esc(c.name||'')}</b> en su celular. Mandáselo sólo al cliente, por un medio que sea suyo. El secreto de la tarjeta viaja en la parte del enlace que no llega a ningún servidor.</p>
  <label for="cl-l">Enlace</label><input id="cl-l" readonly value="${esc(link)}" onfocus="this.select()">
  <div class="row" style="margin-top:.5rem"><button class="btn sm" type="button" id="cl-copy">Copiar enlace</button>${wa?`<a class="btn sm gold" id="cl-wa" target="_blank" rel="noopener noreferrer" href="https://wa.me/${encodeURIComponent(waFull(wa).replace(/\D/g,''))}?text=${encodeURIComponent(msg)}">Abrir WhatsApp con el mensaje</a>`:''}</div>
  <p class="sm mut">«Abrir WhatsApp» sólo prepara el mensaje: lo envía una persona. No se confirma la entrega.</p>${typeof walletSendHTML==='function'?walletSendHTML(c):''}`,{noCancel:true,okText:'Cerrar',wide:true});
 const b=$('#cl-copy',w);if(b)b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link);toast('Enlace copiado');}catch(e){const i=$('#cl-l',w);i.select();toast('Seleccionado: copialo con Ctrl+C',0);}});};
