/* ===== V26.51 · WhatsApp al cliente desde su ficha (aviso libre o saldo de Fiado / Cuenta corriente) =====
   · Abre wa.me con el número del cliente (guardado como +549 + 10 dígitos) y el mensaje ya escrito; el mensaje se puede editar
     antes de abrir WhatsApp. El sistema NO envía nada solo: el envío lo confirma la persona en WhatsApp.
   · Saldo: total y, si están separados, Fiado / Cuenta corriente, con cada compra abierta (fecha, saldo y vencimiento).
   · Queda en Auditoría (WHATSAPP_CLIENTE) con el tipo de mensaje; no se guarda el texto. */
const waDigits=c=>String((c&&c.wa)||'').replace(/\D/g,'');
const waOk=c=>/^549\d{10}$/.test(waDigits(c));
function waDebtText(c){const first=String(c.name||'').trim().split(/\s+/)[0]||'';const biz=(S.tenant&&S.tenant.name)||'el comercio';const tot=debtOf(c.id);
 if(!(tot>0))return `Hola ${first}, te escribimos de ${biz}. Tu cuenta está al día: no tenés saldo pendiente. ¡Gracias!`;
 const L=[`Hola ${first}, te escribimos de ${biz}.`,`Te recordamos que tu saldo pendiente es de ${money(tot)}.`];
 if(typeof creditSplit==='function'&&creditSplit()){const k=ccByKind(c.id);if(k.fiado&&k.cc)L.push(`(Fiado ${money(k.fiado)} · Cuenta corriente ${money(k.cc)})`);}
 const docs=typeof wsOpenDocs==='function'?wsOpenDocs(c.id).slice(0,10):[];
 if(docs.length){L.push('');L.push('Detalle:');const t=now();
  docs.forEach(d=>{const ven=d.due?(d.due<t?' · VENCIDO el '+dmy(dkey(d.due)):' · vence el '+dmy(dkey(d.due))):'';L.push(`• ${dmy(dkey(d.s.ts))} · ${typeof saleCk==='function'&&creditSplit()?(saleCk(d.s)==='fiado'?'Fiado':'Cta. cte.')+' · ':''}${money(d.left)}${ven}`);});}
 L.push('');L.push('Podés acercarte al local o consultarnos por acá para abonarlo. ¡Gracias!');return L.join('\n');}
function waFreeText(c){const first=String(c.name||'').trim().split(/\s+/)[0]||'';return `Hola ${first}, te escribimos de ${(S.tenant&&S.tenant.name)||'el comercio'}. `;}
A.cuWa=el=>{const c=custById(el.dataset.id);if(!c)return;
 if(!waOk(c))return toast('Este cliente no tiene un WhatsApp válido cargado (código de área + número).',1);
 const debt=debtOf(c.id);const kind0=debt>0?'saldo':'aviso';
 const body=`<p class="sm">Para: <b>${esc(custFull(c))}</b> · ${esc(c.wa)}</p>
  <div class="row" role="group" aria-label="Tipo de mensaje"><button type="button" class="btn sm ${kind0==='saldo'?'on':''}" data-wk="saldo" aria-pressed="${kind0==='saldo'}">Saldo de la cuenta${debt>0?' ('+money(debt)+')':''}</button><button type="button" class="btn sm ${kind0==='aviso'?'on':''}" data-wk="aviso" aria-pressed="${kind0==='aviso'}">Aviso</button></div>
  <label for="wa-t">Mensaje (lo podés cambiar)</label><textarea id="wa-t" rows="9" maxlength="1500">${esc(kind0==='saldo'?waDebtText(c):waFreeText(c))}</textarea>
  ${typeof hasComm==='function'&&!hasComm(c)?'<p class="sm mut">Este cliente no aceptó recibir promociones: usalo sólo para avisos de su cuenta o de sus pedidos.</p>':''}
  <p class="sm mut">Se abre WhatsApp con el mensaje escrito; el envío lo confirmás vos en WhatsApp.</p>`;
 let kind=kind0;
 const w=modal('WhatsApp a '+custFull(c),body,{okText:'Abrir WhatsApp',onOk:()=>{const t=String($('#wa-t',w).value||'').trim();if(!t){w._err('Escribí el mensaje.');return false;}
  audit('WHATSAPP_CLIENTE',(kind==='saldo'?'saldo de la cuenta':'aviso')+' · '+custFull(c)+(kind==='saldo'?' · '+money(debtOf(c.id)):''));save();
  openExternal('https://wa.me/'+waDigits(c)+'?text='+encodeURIComponent(t));}});
 w.addEventListener('click',e=>{const b=e.target.closest('[data-wk]');if(!b)return;kind=b.dataset.wk;w.querySelectorAll('[data-wk]').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on);});
  $('#wa-t',w).value=kind==='saldo'?waDebtText(c):waFreeText(c);const ta=$('#wa-t',w);ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);});
 setTimeout(()=>{const ta=$('#wa-t',w);if(ta){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);}},60);};
