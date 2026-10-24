/* ===== V26.25 · Tarjeta del Club en Apple Wallet / Google Wallet (opción visible al enviar y al ver la tarjeta) =====
   · Al enviar la tarjeta (Fidelización / ficha del cliente) y en la tarjeta del menú público aparecen
     «Agregar a Apple Wallet» y «Guardar en Google Wallet».
   · DEMO (raveV2 y Kini): muestran una SIMULACIÓN rotulada de cómo queda el pase (frente con sellos y QR de la tarjeta).
     No se genera ningún pase real ni se dice que quedó guardado.
   · SISTEMA DEL CLIENTE: hasta que el comercio tenga la cuenta de emisor de Google Wallet y/o el certificado de Apple
     (4.19) y el servidor que firma los pases, los botones explican que falta activarlo y ofrecen «Guardar mi tarjeta».
   · El código del pase es el identificador fijo de la tarjeta (mismo formato que la etiqueta NFC: RAVE2N|id):
     el mostrador lo acepta con la regla de un sello cada 24 h. Nunca lleva nombre, WhatsApp, DNI ni el secreto. */
function walletMode(){if(!IS_CLIENT)return'demo';const w=(S.integ&&S.integ.wallet)||{};return(w.google&&w.google.live)||(w.apple&&w.apple.live)?'live':'pending';}
const WALLET_NAME={apple:'Apple Wallet',google:'Google Wallet'};
function walletData(c,cardId){const g=S.loyalty.goal,st=stampsOf(c.id);const title=(S.menu&&S.menu.title)||S.tenant.name||'Club';
 return{title,club:'Club '+(S.tenant.name||''),name:(c.name||'')+(c.last?' '+c.last:''),num:pad4(c.num),stamps:Math.min(st,g),goal:g,reward:S.loyalty.reward||'',code:'RAVE2N|'+(cardId||c.id)};}
/* pase simulado: todo con estilos en línea (se usa en el panel y dentro del menú público, que es otro documento) */
function walletPassHTML(kind,d){const e=esc;const dots=Array.from({length:d.goal},(_,i)=>`<span style="display:inline-block;width:18px;height:18px;border-radius:50%;margin:2px;border:2px solid ${kind==='apple'?'#c9963e':'#1a73e8'};background:${i<d.stamps?(kind==='apple'?'#c9963e':'#1a73e8'):'transparent'}"></span>`).join('');
 const qr=`<div style="background:#fff;border-radius:10px;padding:8px;width:150px;margin:12px auto 4px">${QR.svg(d.code,3,1)}</div><div style="text-align:center;font:600 11px/1.3 Arial,sans-serif;opacity:.8">Tarjeta N.º ${e(d.num)}</div>`;
 const ban=`<div style="background:#fff3cd;color:#5c4400;border:1px solid #e0c060;border-radius:10px;padding:8px 10px;margin:0 0 10px;font:600 12px/1.35 Arial,sans-serif">SIMULACIÓN DE LA DEMO · así se vería en ${WALLET_NAME[kind]}. En el sistema real este botón abre ${WALLET_NAME[kind]} para guardarla (necesita la cuenta del comercio).</div>`;
 if(kind==='apple')return ban+`<div style="max-width:320px;margin:0 auto;background:#1c1c1e;color:#fff;border-radius:16px;padding:16px;font-family:-apple-system,Helvetica,Arial,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35)">
  <div style="display:flex;justify-content:space-between;align-items:flex-start"><b style="font-size:15px">${e(d.title)}</b><div style="text-align:right"><div style="font-size:10px;opacity:.7;letter-spacing:.06em">SELLOS</div><b style="font-size:18px">${d.stamps}/${d.goal}</b></div></div>
  <div style="margin-top:14px;font-size:10px;opacity:.7;letter-spacing:.06em">SOCIO</div><div style="font-size:20px;font-weight:600">${e(d.name)}</div>
  <div style="margin:10px 0 4px;text-align:center">${dots}</div>
  ${d.reward?`<div style="font-size:10px;opacity:.7;letter-spacing:.06em;margin-top:6px">PREMIO</div><div style="font-size:13px">${e(d.reward)}</div>`:''}${qr}</div>`;
 return ban+`<div style="max-width:320px;margin:0 auto;background:#fff;color:#202124;border-radius:20px;overflow:hidden;font-family:Roboto,Arial,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.25)">
  <div style="background:#1a73e8;color:#fff;padding:14px 16px"><b style="font-size:16px">${e(d.title)}</b><div style="font-size:12px;opacity:.9">${e(d.club)}</div></div>
  <div style="padding:14px 16px"><div style="font-size:11px;color:#5f6368">Socio</div><div style="font-size:18px;font-weight:500">${e(d.name)}</div>
  <div style="display:flex;gap:24px;margin-top:10px"><div><div style="font-size:11px;color:#5f6368">Sellos</div><b>${d.stamps} de ${d.goal}</b></div><div><div style="font-size:11px;color:#5f6368">N.º</div><b>${e(d.num)}</b></div></div>
  <div style="margin:10px 0 0;text-align:center">${dots}</div>${qr}</div></div>`;}
/* menú público: qué hacer al tocar el botón de Wallet */
function pubWallet(id,kind){if(!WALLET_NAME[kind])return{mode:'error'};const mode=walletMode();
 if(mode!=='demo')return{mode};const c=custByCard(id);if(!c||c.status==='baja')return{mode:'error'};
 audit('WALLET_SIMULADO',WALLET_NAME[kind]+' · socio '+pad4(c.num)+' (simulación de la demo)');save();
 return{mode,html:walletPassHTML(kind,walletData(c,id))};}
/* panel: sección Wallet dentro de «Enviar tarjeta» */
function walletSendHTML(c){const m=walletMode();
 if(m==='demo')return`<div class="card" style="margin:.8rem 0"><h3 style="margin-top:0">Apple Wallet y Google Wallet</h3><p class="sm">Cuando el cliente abre el enlace, en su tarjeta ve los botones <b>«Agregar a Apple Wallet»</b> y <b>«Guardar en Google Wallet»</b>. En esta demo el pase es una <b>simulación</b>: mirá cómo queda.</p>
  <div class="row"><button class="btn sm" type="button" data-act="walPrev" data-id="${c.id}" data-k="apple">Ver en Apple Wallet (simulación)</button><button class="btn sm" type="button" data-act="walPrev" data-id="${c.id}" data-k="google">Ver en Google Wallet (simulación)</button></div></div>`;
 if(m==='live')return'';
 return`<div class="card warnbox" style="margin:.8rem 0"><b>Apple Wallet y Google Wallet: pendiente de activar.</b><p class="sm">El cliente ya ve los botones en su tarjeta, pero para que guarden el pase hace falta la cuenta de emisor de Google Wallet y/o la cuenta Apple Developer con el certificado de pases del comercio, y el servidor que firma los pases. Mientras tanto el cliente guarda su tarjeta con «Guardar mi tarjeta» (enlace e imagen con QR).</p><button class="btn sm" type="button" data-act="nav" data-id="integ">Ver cómo activarlo</button></div>`;}
A.walPrev=el=>{const c=custById(el.dataset.id),k=el.dataset.k;if(!c||!WALLET_NAME[k])return;
 const cid=cardIdOk(c.id)?c.id:((c.cards||[]).find(cardIdOk)||c.id);
 modal(WALLET_NAME[k]+' · '+custFull(c),walletPassHTML(k,walletData(c,cid)),{noCancel:true,okText:'Cerrar'});};
