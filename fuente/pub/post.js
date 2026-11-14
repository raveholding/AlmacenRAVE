/* ===== Sistema RAVE · fidelización, cupones, legal, acceso del equipo ===== */
(function(){
  var API=null; try{ API=window.parent.RAVE_API; }catch(e){}
  if(!API) return;
  var $=function(s,r){return (r||document).querySelector(s);};
  function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function L(es,en){return (window.RAVE_LANG&&window.RAVE_LANG()==='en')?en:es;}
  function money(p){return '$ '+Math.round(p).toLocaleString('es-AR');}
  function toast(t){var el=$('#rv-toast'); if(!el) return; el.textContent=t; el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(function(){el.classList.remove('show');},2400);}
  function copy(t){ if(navigator.clipboard&&navigator.clipboard.writeText) return navigator.clipboard.writeText(t); var ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(e){} ta.remove(); return Promise.resolve(); }

  /* --- acceso del equipo: botón, doble clic en el título y 5 toques al logo --- */
  function openPanel(){ try{ API.openPanel(); }catch(e){} }
  var tb=$('#team-access-btn'); if(tb) tb.addEventListener('click',openPanel);
  var bt=$('#brand-title'); if(bt) bt.addEventListener('dblclick',openPanel);
  var lg=$('header .logo'), taps=[];
  if(lg) lg.addEventListener('click',function(){var t=Date.now(); taps=taps.filter(function(x){return t-x<3000;}); taps.push(t); if(taps.length>=5){taps=[]; openPanel();}});
  if(API.site().hideTeamBtn&&tb) tb.style.display='none';

  /* --- cupones públicos --- */
  function renderCoupons(){
    var box=$('#coupons-block'), list=$('#coupons-list'); if(!box||!list) return;
    var id=null; try{id=localStorage.getItem('rave.card');}catch(e){}
    var cs=API.coupons(id);
    box.hidden=!cs.length;
    list.innerHTML=cs.map(function(c){
      return '<div class="cp-card"><div class="cc-txt"><b class="cc-code">'+esc(c.code)+'</b><div class="cc-d">'+esc(c.desc)+'</div><div class="cc-s">'+esc(c.cond)+'</div></div><button type="button" data-copy="'+esc(c.code)+'">'+L('Copiar','Copy')+'</button></div>';}).join('');
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-copy]'); if(!b) return;
    var code=b.getAttribute('data-copy'); copy(code).then(function(){toast(L('Código copiado','Code copied')+': '+code);});
    var inp=$('#cp-coupon-in'); if(inp) inp.value=code;
  });

  /* --- cupón dentro del pedido (se valida de nuevo en el mostrador) --- */
  var applied=null;
  function msg(t,cls){var m=$('#cp-coupon-msg'); if(!m) return; m.textContent=t||''; m.className=cls||'';}
  function drawDisc(total){
    var old=$('#cp-disc-row'); if(old) old.remove();
    if(!applied) return;
    var r=API.couponInfo(applied,total); 
    if(!r.ok){ msg(L(r.msg,r.msgEn||r.msg),'bad'); applied=null; return; }
    msg(L('Cupón '+r.code+' aplicado: '+r.desc,'Coupon '+r.code+' applied: '+(r.descEn||r.desc)),'ok');
    var row=document.createElement('div'); row.id='cp-disc-row'; row.className='cp-total-row disc';
    row.innerHTML='<span>'+L('Total con cupón (estimado)','Total with coupon (estimate)')+'</span><span>'+money(r.total)+'</span>';
    var tr=$('.cp-total-row'); tr.parentNode.insertBefore(row,tr.nextSibling);
  }
  window.RAVE_COUPON_RENDER=function(total){drawDisc(total);};
  window.RAVE_COUPON_LINES=function(lines,total){
    if(!applied) return; var r=API.couponInfo(applied,total); if(!r.ok) return;
    lines.push('Cupón: '+r.code+' (se valida en el local) — total estimado con cupón: '+money(r.total));
  };
  window.RAVE_ORDER_LOG=function(items,total){ try{ API.orderRequest({items:items,total:total,coupon:applied||''}); }catch(e){} };
  var ok=$('#cp-coupon-ok'), inp=$('#cp-coupon-in');
  if(ok) ok.addEventListener('click',function(){
    var code=(inp.value||'').trim().toUpperCase(); if(!code){msg('');applied=null;drawDisc(0);return;}
    var tot=window.RAVE_CART_TOTAL||0; var r=API.couponInfo(code,tot);
    if(!r.ok){applied=null;msg(L(r.msg,r.msgEn||r.msg),'bad');var o=$('#cp-disc-row');if(o)o.remove();return;}
    applied=r.code; drawDisc(tot);
  });

  /* --- tarjeta de fidelización --- */
  /* V26.19: tarjeta de EJEMPLO (como en todos los menús de Sistema VB): muestra cómo se ve la tarjeta, la meta y el premio antes de sumarse */
  function renderSample(){
    var box=$('#loy-sample'); if(!box) return; var s={}; try{s=API.site()||{};}catch(e){}
    var cl=s.club||{}, g=Math.max(2,Math.min(30,+cl.goal||10)), n=Math.min(g-1,Math.max(1,Math.round(g*0.6))), rw=String(cl.reward||'');
    var dots=''; for(var i=0;i<g;i++){ var on=i<n, pz=(i===g-1); dots+='<i class="'+(on?'on':'')+(pz&&!on?' loy-pz':'')+'">'+(on?'★':(pz?'🎁':(i+1)))+'</i>'; }
    box.innerHTML='<div class="loy-card loy-sample"><span class="loy-ej">'+L('EJEMPLO','SAMPLE')+'</span><h3>'+L('Así se ve tu tarjeta','This is how your card looks')+'</h3>'
     +'<div class="loy-sub">'+L('Un sello por cada compra','One stamp per purchase')+'</div>'
     +'<div class="loy-stamps" style="grid-template-columns:repeat('+Math.min(g,5)+',1fr)">'+dots+'</div>'
     +'<div class="loy-meta"><span>'+n+' / '+g+' '+L('sellos','stamps')+'</span><span>'+L('Te faltan '+(g-n),(g-n)+' to go')+'</span></div>'
     +(rw&&!/a definir/i.test(rw)?'<div class="loy-reward">🎁 '+L('Con ','With ')+g+L(' sellos: ',' stamps: ')+esc(rw)+'</div>':'')
     +'</div>';
  }
  var tick=null;
  function cardId(){try{return localStorage.getItem('rave.card')||'';}catch(e){return '';}}
  function stopTick(){clearInterval(tick);tick=null;}
  function renderCard(){
    var id=cardId(), c=id?API.card(id):null;
    var no=$('#loy-nocard'), cd=$('#loy-card'); if(!no||!cd) return;
    stopTick();
    var rec=document.querySelector('.loy-rec'), canRec=!(API.canRecover&&!API.canRecover());
    if(rec) rec.style.display=canRec?'':'none';
    var nt=$('#loy-nocard-txt'); if(nt&&!canRec) nt.textContent=L('Tu tarjeta se crea al sumarte al Club (formulario de arriba) y queda guardada en este celular. Si ya eras socio y no la ves (cambiaste de celular o borraste los datos del navegador), pedila por WhatsApp: el negocio te manda el enlace de tu tarjeta y al abrirlo vuelve a quedar guardada.','Your card is created when you join the Club (form above) and is kept on this phone. If you were already a member and cannot see it (new phone or cleared browser data), ask for it on WhatsApp: the shop sends you your card link and opening it saves it again.');
    var ask=$('#loy-ask'); if(ask){ ask.hidden=canRec; if(!canRec){ var sw=''; try{sw=API.site().wa||'';}catch(e){} sw=String(sw).replace(/\D/g,'')||String(window.RAVE_WA||'').replace(/\D/g,''); ask.onclick=function(){ window.open('https://wa.me/'+sw+'?text='+encodeURIComponent(L('Hola! Ya soy socio del Club pero no veo mi tarjeta en este celular. ¿Me mandan el enlace de mi tarjeta? Mi nombre es: ','Hi! I am already a Club member but I cannot see my card on this phone. Could you send me my card link? My name is: ')),'_blank','noopener'); }; } }
    if(!c){ renderSample(); no.hidden=false; cd.hidden=true; if(id&&canRec){try{localStorage.removeItem('rave.card');}catch(e){}} renderPlans(null); return; }
    no.hidden=true; cd.hidden=false;
    var dots=''; for(var i=0;i<c.goal;i++) dots+='<i class="'+(i<c.stamps?'on':'')+'">'+(i<c.stamps?'★':'')+'</i>';
    var left=Math.max(0,c.goal-c.stamps);
    cd.innerHTML='<div class="loy-card"><h3>'+esc(c.name)+'</h3><div class="loy-sub">'+(c.pending?L('Socio N° en trámite · el negocio la activa en unos segundos','Member # pending · the shop activates it in a few seconds'):L('Socio N° ','Member # ')+esc(c.num))+'</div>'
     +'<div class="loy-stamps" style="grid-template-columns:repeat('+Math.min(c.goal,5)+',1fr)">'+dots+'</div>'
     +'<div class="loy-meta"><span>'+c.stamps+' / '+c.goal+' '+L('sellos','stamps')+'</span><span>'+(left?L('Te faltan '+left,left+' to go'):L('¡Tenés un premio!','You have a reward!'))+'</span></div>'
     +(c.rewards?'<div class="loy-reward">🎁 '+L('Premio disponible: ','Reward available: ')+esc(c.rewardText)+(c.rewards>1?' (x'+c.rewards+')':'')+'</div>':'')
     +(c.member?'<div class="loy-member">⭐ '+esc(c.member.name)+' · '+L('hasta ','until ')+esc(c.member.until)+(c.member.pct?' · '+c.member.pct+'% '+L('de descuento en el mostrador','off at the counter'):'')+'</div>':'')
     +'<button type="button" class="loy-btn" id="loy-full">'+L('Abrir mi tarjeta digital','Open my digital card')+'</button>'
     +'<div id="loy-codebox"></div>'
     +'<button type="button" class="loy-btn" id="loy-show">'+L('Mostrar mi código para sumar sello','Show my code to get a stamp')+'</button>'
     +'<p class="loy-tip">'+L('Tip: agregá esta página a la pantalla de inicio de tu celular para tener tu tarjeta siempre a mano. Si la perdés, en el mostrador te pueden sumar los sellos con tu DNI.','Tip: add this page to your phone home screen to keep your card at hand. If you lose it, the counter can add your stamps with your ID number.')+'</p>'
     +'<div class="loy-wallet"><button type="button" class="wal-btn wal-apple" id="loy-apple">'+L('Agregar a Apple Wallet','Add to Apple Wallet')+'</button><button type="button" class="wal-btn wal-google" id="loy-google">'+L('Guardar en Google Wallet','Save to Google Wallet')+'</button></div><div id="loy-walbox" role="status" hidden></div>'
     +'<button type="button" class="loy-btn loy-alt" id="loy-save">'+L('Guardar mi tarjeta (por si cambio de celular)','Save my card (in case I change phones)')+'</button><div id="loy-savebox" hidden></div>'
     +'<button type="button" class="loy-link" id="loy-out">'+L('No soy yo / quitar tarjeta de este dispositivo','Not me / remove card from this device')+'</button></div>';
    $('#loy-show').addEventListener('click',showCode);
    $('#loy-full').addEventListener('click',function(){ try{ var pw=window.parent; pw.history.replaceState(null,'',pw.location.href.split('#')[0]+'#mitarjeta'); }catch(e){} mtOpen(); });
    $('#loy-save').addEventListener('click',toggleSave);
    $('#loy-apple').addEventListener('click',function(){walletGo('apple');});
    $('#loy-google').addEventListener('click',function(){walletGo('google');});
    $('#loy-out').addEventListener('click',function(){try{localStorage.removeItem('rave.card');}catch(e){} renderCard(); renderCoupons();});
    renderPlans(c);
  }
  /* --- Apple Wallet / Google Wallet: en la demo es una simulación rotulada; sin cuenta del comercio, se explica qué falta --- */
  function walletGo(kind){
    var box=$('#loy-walbox'); if(!box) return; var r=null; try{ r=API.wallet?API.wallet(cardId(),kind):null; }catch(e){}
    var nm=kind==='apple'?'Apple Wallet':'Google Wallet';
    if(r&&r.mode==='demo'&&r.html){ box.innerHTML=r.html+'<button type="button" class="loy-link" id="wal-close">'+L('Cerrar','Close')+'</button>'; box.hidden=false; var x=$('#wal-close'); if(x) x.addEventListener('click',function(){box.hidden=true;}); return; }
    if(r&&r.mode==='live'&&r.url&&/^https:\/\//.test(r.url)){ window.open(r.url,'_blank','noopener'); return; }
    box.innerHTML='<p class="loy-tip">'+L(nm+' todavía no está activado en este comercio. Mientras tanto guardá tu tarjeta con «Guardar mi tarjeta» (enlace e imagen con QR) o agregá esta página a la pantalla de inicio.',nm+' is not enabled by this shop yet. Meanwhile save your card with “Save my card” (link and QR image) or add this page to your home screen.')+'</p>'; box.hidden=false;
  }
  /* --- guardar la tarjeta fuera del navegador: enlace, compartir e imagen con QR --- */
  function toggleSave(){
    var box=$('#loy-savebox'); if(!box) return; if(!box.hidden){box.hidden=true;return;}
    var id=cardId(), p=null; try{p=API.cardPortable?API.cardPortable(id):null;}catch(e){}
    if(!p){ box.innerHTML='<p class="loy-tip">'+L('No pudimos preparar tu tarjeta para guardarla. Probá de nuevo en unos segundos.','We could not prepare your card to be saved. Please try again in a few seconds.')+'</p>'; box.hidden=false; return; }
    box.innerHTML='<p class="loy-tip">'+L('Este enlace es tu tarjeta personal: si cambiás de celular o se borran los datos del navegador, abrilo (o escaneá el QR de la imagen) y tu tarjeta vuelve. No lo compartas con nadie.','This link is your personal card: if you change phones or the browser data is cleared, open it (or scan the QR in the image) and your card comes back. Do not share it.')+'</p>'
      +'<button type="button" class="loy-btn" id="sv-img">'+L('Descargar imagen con QR','Download image with QR')+'</button>'
      +'<button type="button" class="loy-btn loy-alt" id="sv-copy">'+L('Copiar enlace de mi tarjeta','Copy my card link')+'</button>'
      +(navigator.share?'<button type="button" class="loy-btn loy-alt" id="sv-share">'+L('Compartir conmigo (WhatsApp, correo, notas)','Send to myself (WhatsApp, email, notes)')+'</button>':'')
      +'<div class="loy-tip" id="sv-msg" role="status"></div>';
    box.hidden=false;
    function say(t){var m=$('#sv-msg'); if(m) m.textContent=t;}
    $('#sv-copy').addEventListener('click',function(){
      var done=function(){say(L('Enlace copiado. Pegalo en tus notas o mandátelo por WhatsApp.','Link copied. Paste it in your notes or send it to yourself on WhatsApp.'));};
      try{ navigator.clipboard.writeText(p.link).then(done,function(){prompt(L('Copiá el enlace:','Copy the link:'),p.link);}); }catch(e){ prompt(L('Copiá el enlace:','Copy the link:'),p.link); }
    });
    var sh=$('#sv-share'); if(sh) sh.addEventListener('click',function(){ navigator.share({title:L('Mi tarjeta del Club','My Club card'),text:L('Mi tarjeta del Club (personal, no la compartas):','My Club card (personal, do not share):'),url:p.link}).catch(function(){}); });
    $('#sv-img').addEventListener('click',function(){ drawCardPng(p,id,function(ok){ say(ok?L('Listo: la imagen se descargó. Guardala en tu galería.','Done: the image was downloaded. Keep it in your gallery.'):L('No se pudo generar la imagen en este navegador. Usá «Copiar enlace».','The image could not be created in this browser. Use “Copy link”.')); }); });
  }
  function drawCardPng(p,id,cb){
    try{
      var c=document.createElement('canvas'); c.width=720; c.height=460; var g=c.getContext('2d');
      g.fillStyle='#242220'; g.fillRect(0,0,720,460); g.strokeStyle='#c9963e'; g.lineWidth=6; g.strokeRect(12,12,696,436);
      g.fillStyle='#c9963e'; g.font='700 30px Poppins,Arial,sans-serif'; var t=''; try{t=API.site().title||'';}catch(e){} g.fillText(String(t||'Club').slice(0,28),40,70);
      g.fillStyle='#fff'; g.font='600 26px Poppins,Arial,sans-serif'; g.fillText(L('Tarjeta del Club','Club card'),40,112);
      g.font='700 34px Poppins,Arial,sans-serif'; g.fillText(String(p.name||'').slice(0,18),40,190);
      g.fillStyle='#d9cbb0'; g.font='500 18px Poppins,Arial,sans-serif';
      L('Escaneá el QR con la cámara','Scan the QR with your camera').split('\n').forEach(function(l,i){g.fillText(l,40,250+i*26);});
      g.fillText(L('para recuperar tu tarjeta en un celular nuevo.','to get your card back on a new phone.'),40,276);
      g.fillStyle='#e8c98d'; g.font='500 15px Poppins,Arial,sans-serif'; g.fillText(L('Personal: no la compartas con nadie.','Personal: do not share it.'),40,420);
      var img=new Image(); var url=URL.createObjectURL(new Blob([p.qr],{type:'image/svg+xml'}));
      img.onload=function(){ g.fillStyle='#fff'; g.fillRect(400,60,290,290); g.drawImage(img,405,65,280,280); URL.revokeObjectURL(url);
        c.toBlob(function(b){ if(!b) return cb(false); var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='mi-tarjeta-del-club.png'; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href); a.remove();},1500); cb(true); },'image/png'); };
      img.onerror=function(){ cb(false); }; img.src=url;
    }catch(e){ cb(false); }
  }
  function showCode(){
    var id=cardId(), box=$('#loy-codebox'); if(!id||!box) return;
    function draw(){
      var k=API.cardCode(id); if(!k){box.innerHTML=''; stopTick(); return;}
      box.innerHTML='<div class="loy-code">'+k.qr+'<div class="lc-n">'+(k.pending?esc(k.otp):esc(k.socio)+' · '+esc(k.otp))+'</div>'+(k.pending?'<div class="lc-s">'+L('Tarjeta todavía no activada: mostrá igual este QR en el mostrador.','Card not activated yet: show this QR at the counter anyway.')+'</div>':'')+'<div class="lc-s">'+L('Mostralo en el mostrador · vence en ','Show it at the counter · expires in ')+'<b id="lc-t">'+k.secs+'</b> s · '+L('un sello por día','one stamp per day')+'</div></div>';
    }
    draw(); stopTick();
    tick=setInterval(function(){
      var t=$('#lc-t'); if(!t){stopTick();return;}
      var s=+t.textContent-1; if(s<=0){draw();} else t.textContent=s;
      if(!$('#loy-card')||$('#loy-card').hidden) stopTick();
    },1000);
  }
  function renderPlans(c){
    var box=$('#plans-box'), list=$('#plans-list'); if(!box) return;
    var ps=API.plans(); box.hidden=!ps.length;
    list.innerHTML=ps.map(function(p){return '<div class="pl"><b>'+esc(p.name)+'</b> · '+money(p.price)+' / '+esc(p.period)+'<br>'+esc(p.desc)+'</div>';}).join('');
  }

  /* --- TIENDA CON ENVÍOS: entrega, costo por provincia y datos de envío en el carrito (sólo si el comercio la activó) --- */
  (function(){
    var panel=$('#cart-panel'), totalRow=panel&&panel.querySelector('.cp-total-row'); if(!panel||!totalRow) return;
    var box=document.createElement('div'); box.id='ship-box'; box.hidden=true; panel.insertBefore(box,totalRow);
    var S0={method:'',prov:'',f:{}};
    function cfg(){ try{ var s=API.site(); return (s&&s.ship&&s.ship.mode==='tienda')?s.ship:null; }catch(e){ return null; } }
    function sub(){ var t=$('#cp-total-val'); if(!t) return 0; return parseInt(String(t.textContent).replace(/[^\d,]/g,'').split(',')[0]||'0',10)||0; }
    function hasAlc(){ var alc=window.RAVE_CATS_ALC||[], pr=[]; try{pr=API.catalog().productos||[];}catch(e){}
      var rows=panel.querySelectorAll('.cp-item[data-pid]'); for(var i=0;i<rows.length;i++){ var id=rows[i].getAttribute('data-pid'); for(var j=0;j<pr.length;j++){ if(String(pr[j].id)===id && alc.indexOf(pr[j].cat)>=0) return true; } } return false; }
    function options(c){ var o=[]; if(c.pickup) o.push(['pickup',L('Retiro en el local','Pick up at the shop')]); if(c.local) o.push(['local',L('Envío local','Local delivery')]); if(c.zones.length||c.rest) o.push(['nacional',L('Envío a otra provincia','Shipping to another province')]); return o; }
    /* devuelve {fee:Number|null, eta, label, free} (null = a cotizar) */
    function quote(c,m,prov,s){
      if(m==='pickup') return {fee:0,eta:'',label:L('Retiro sin costo','Free pick up')};
      if(m==='local'){ var f=c.local.fee, fr=c.local.free>0&&s>=c.local.free; return {fee:fr?0:f,eta:'',label:fr?L('Envío gratis','Free delivery'):''}; }
      var z=null; for(var i=0;i<c.zones.length;i++){ if(c.zones[i].prov===prov) z=c.zones[i]; }
      if(z){ var free=z.free>0&&s>=z.free; return {fee:free?0:z.fee,eta:z.eta,label:free?L('Envío gratis','Free shipping'):'',carrier:z.carrier}; }
      if(c.rest&&prov==='__rest') return c.rest.quote?{fee:null,eta:c.rest.eta,label:L('A cotizar por WhatsApp','Quoted on WhatsApp')}:{fee:c.rest.fee,eta:c.rest.eta,label:''};
      return null;
    }
    function esc2(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];}); }
    function fld(id,lbl,ph,mx){ return '<label for="'+id+'">'+lbl+'</label><input id="'+id+'" maxlength="'+mx+'" placeholder="'+esc2(ph||'')+'" autocomplete="off" value="'+esc2(S0.f[id]||'')+'">'; }
    function render(){
      var c=cfg(); if(!c){ box.hidden=true; box.innerHTML=''; return; }
      var op=options(c); if(!op.length){ box.hidden=true; return; }
      if(!S0.method||!op.some(function(x){return x[0]===S0.method;})) S0.method=op[0][0];
      var h='<h4 class="sh-h">'+L('Entrega','Delivery')+'</h4><div class="sh-opts" role="radiogroup" aria-label="'+L('Forma de entrega','Delivery method')+'">';
      op.forEach(function(x){ h+='<label class="sh-opt"><input type="radio" name="sh-m" value="'+x[0]+'" '+(S0.method===x[0]?'checked':'')+'> '+x[1]+'</label>'; });
      h+='</div>';
      if(S0.method==='pickup'){ h+='<p class="sh-n">'+esc2(c.pickup.place)+(c.pickup.hours?' · '+esc2(c.pickup.hours):'')+'</p>'; }
      else {
        if(S0.method==='nacional'){
          h+='<label for="sh-prov">'+L('Provincia','Province')+'</label><select id="sh-prov"><option value="">'+L('Elegí tu provincia','Choose your province')+'</option>';
          c.zones.forEach(function(z){ h+='<option value="'+esc2(z.prov)+'" '+(S0.prov===z.prov?'selected':'')+'>'+esc2(z.prov)+'</option>'; });
          if(c.rest) h+='<option value="__rest" '+(S0.prov==='__rest'?'selected':'')+'>'+L('Otra provincia (a cotizar)','Another province (quote)')+'</option>';
          h+='</select>';
        } else if(c.local.zones){ h+='<p class="sh-n">'+L('Zonas: ','Areas: ')+esc2(c.local.zones)+'</p>'; }
        h+=fld('sh-name',L('Nombre de quien recibe','Recipient name'),'',60)+fld('sh-tel',L('Teléfono de contacto','Contact phone'),'',20)+fld('sh-street',L('Calle y número','Street and number'),'',80)+fld('sh-city',L('Localidad','City'),'',60)+fld('sh-cp',L('Código postal','Postal code'),'',10)+fld('sh-obs',L('Indicaciones (piso, horario, referencias)','Notes (floor, time, landmarks)'),'',120);
      }
      h+='<div class="sh-sum" id="sh-sum" role="status" aria-live="polite"></div><div class="sh-err" id="sh-err" role="alert" hidden></div>';
      if(c.note) h+='<p class="sh-n">'+esc2(c.note)+'</p>';
      h+='<p class="sh-n">'+L('Es una solicitud: el comercio te confirma disponibilidad, costo y plazo por WhatsApp. Tus datos de entrega sólo van en ese mensaje; este menú no los guarda.','This is a request: the shop confirms stock, cost and time on WhatsApp. Your delivery details only go in that message; this menu does not store them.')+'</p>';
      box.innerHTML=h; box.hidden=false; bind(); summary();
    }
    function bind(){
      box.querySelectorAll('input[name=sh-m]').forEach(function(r){ r.addEventListener('change',function(){ keep(); S0.method=r.value; render(); }); });
      var p=$('#sh-prov'); if(p) p.addEventListener('change',function(){ keep(); S0.prov=p.value; summary(); });
      box.querySelectorAll('input[type=text],input:not([type])').forEach(function(i){ i.addEventListener('input',function(){S0.f[i.id]=i.value;}); });
    }
    function keep(){ box.querySelectorAll('input[id^=sh-]').forEach(function(i){S0.f[i.id]=i.value;}); }
    function fee(c){ return quote(c,S0.method,S0.prov,sub()); }
    function summary(){
      var c=cfg(), el=$('#sh-sum'); if(!c||!el) return; var s=sub(), q=fee(c), t='';
      if(S0.method==='nacional'&&!S0.prov) t=L('Elegí la provincia para ver el costo de envío.','Choose the province to see the shipping cost.');
      else if(!q) t='';
      else { t='<b>'+L('Envío','Shipping')+':</b> '+(q.fee===null?q.label:(q.fee===0?(q.label||L('sin costo','free')):money(q.fee)))+(q.eta?' · '+esc2(q.eta):'')+(q.carrier?' · '+esc2(q.carrier):'');
        if(q.fee!==null) t+='<br><b>'+L('Total con envío (estimado)','Total with shipping (estimate)')+':</b> '+money(s+q.fee); else t+='<br>'+L('El costo se suma al total cuando el comercio lo cotice.','The cost is added to the total once the shop quotes it.'); }
      el.innerHTML=t;
    }
    function validate(){
      var c=cfg(); if(!c) return ''; var s=sub();
      if(S0.method!=='pickup'){
        if(c.min>0&&s<c.min) return L('La compra mínima para envíos es ','The minimum purchase for delivery is ')+money(c.min)+'.';
        if(S0.method==='nacional'&&!S0.prov) return L('Elegí la provincia de entrega.','Choose the delivery province.');
        if(!c.alcohol&&hasAlc()) return L('Las bebidas alcohólicas se retiran en el local: sacalas del pedido o elegí «Retiro en el local».','Alcoholic drinks are pick-up only: remove them or choose “Pick up at the shop”.');
        keep(); var f=S0.f, need=[['sh-name',L('el nombre de quien recibe','the recipient name')],['sh-tel',L('un teléfono de contacto','a contact phone')],['sh-street',L('calle y número','street and number')],['sh-city',L('la localidad','the city')]];
        for(var i=0;i<need.length;i++){ if(String(f[need[i][0]]||'').trim().length<2) return L('Falta ','Missing ')+need[i][1]+'.'; }
        if(S0.method==='nacional'&&!/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/.test(String(f['sh-cp']||'').trim())) return L('Ingresá un código postal válido (4 números).','Enter a valid postal code (4 digits).');
        if(!/^[\d\s+()-]{6,20}$/.test(String(f['sh-tel']||'').trim())) return L('Ingresá un teléfono válido.','Enter a valid phone number.');
      }
      return '';
    }
    var send=$('#btn-send');
    if(send) send.addEventListener('click',function(ev){ var c=cfg(); if(!c||box.hidden) return; var m=validate(), er=$('#sh-err'); if(m){ ev.stopImmediatePropagation(); ev.preventDefault(); if(er){er.textContent=m;er.hidden=false;er.scrollIntoView&&er.scrollIntoView({block:'nearest'});} } else if(er){ er.hidden=true; } },true);
    window.RAVE_SHIP_LINES=function(lines,total){
      var c=cfg(); if(!c||box.hidden) return; keep(); var f=S0.f, q=fee(c); lines.push('');
      lines.push('ENTREGA: '+({pickup:'Retiro en el local',local:'Envío local',nacional:'Envío a otra provincia'})[S0.method]);
      if(S0.method!=='pickup'){
        lines.push('Recibe: '+String(f['sh-name']||'').trim()+' · Tel: '+String(f['sh-tel']||'').trim());
        lines.push('Dirección: '+String(f['sh-street']||'').trim()+', '+String(f['sh-city']||'').trim()+(S0.method==='nacional'?', '+(S0.prov==='__rest'?'(otra provincia)':S0.prov)+(String(f['sh-cp']||'').trim()?' (CP '+String(f['sh-cp']).trim()+')':''):''));
        if(String(f['sh-obs']||'').trim()) lines.push('Indicaciones: '+String(f['sh-obs']).trim());
        if(q){ lines.push('Envío: '+(q.fee===null?'a cotizar':(q.fee===0?'sin costo':money(q.fee)))+(q.eta?' ('+q.eta+')':'')); if(q.fee!==null) lines.push('Total con envío estimado: '+money(total+q.fee)); }
      }
    };
    var tv=$('#cp-total-val'); if(tv&&window.MutationObserver) new MutationObserver(function(){ summary(); }).observe(tv,{childList:true,characterData:true,subtree:true});
    var cb=$('#cart-bar'); if(cb) cb.addEventListener('click',function(){ setTimeout(render,0); });
    window.RAVE_SHIP_REFRESH=render; render();
  })();
  /* ===== V26.57 · TARJETA DIGITAL a pantalla completa (#mitarjeta) =====
     Mientras Apple/Google Wallet no estén contratados: la tarjeta se abre como una «app» propia, con los datos del socio,
     sellos, saldo del monedero, código para sumar sellos, y accesos para escribir al local, hacer un pedido e invitar amigos.
     «Invitar amigos» comparte el MENÚ, nunca el enlace personal (que es la tarjeta). */
  var mtTick=null;
  function mtStyle(){ if($('#mt-style')) return; var st=document.createElement('style'); st.id='mt-style';
    st.textContent='#mt-full{position:fixed;inset:0;z-index:2147483000;overflow:auto;background:radial-gradient(circle at 20% 0,#3a3020,#121110 70%);color:#fff;font-family:Poppins,Arial,sans-serif;-webkit-overflow-scrolling:touch}'
     +'#mt-full .mt-w{max-width:440px;margin:0 auto;padding:16px 16px 40px}'
     +'#mt-full .mt-top{display:flex;align-items:center;gap:10px;margin-bottom:14px}#mt-full .mt-top img{width:52px;height:30px;object-fit:cover;border-radius:6px}#mt-full .mt-top b{flex:1;font:700 1.05rem Georgia,serif;color:#e8c98d}'
     +'#mt-full .mt-x{background:rgba(255,255,255,.1);border:0;color:#fff;border-radius:999px;min-width:44px;min-height:44px;font-size:1.1rem;cursor:pointer}'
     +'#mt-full .mt-card{position:relative;border-radius:20px;padding:20px;background:linear-gradient(135deg,#c9963e,#7a5a22 55%,#2d2418);box-shadow:0 12px 40px rgba(0,0,0,.5);overflow:hidden}'
     +'#mt-full .mt-card:after{content:"";position:absolute;right:-60px;top:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.08)}'
     +'#mt-full .mt-k{font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;opacity:.85}#mt-full .mt-n{font:700 1.6rem Georgia,serif;margin:.2rem 0}#mt-full .mt-s{opacity:.9;font-size:.9rem}'
     +'#mt-full .mt-st{display:grid;gap:8px;margin:16px 0 8px}#mt-full .mt-st i{aspect-ratio:1;border-radius:50%;border:2px dashed rgba(255,255,255,.55);display:grid;place-items:center;font-style:normal;font-size:1.1rem}#mt-full .mt-st i.on{background:#fff;color:#7a5a22;border-style:solid}'
     +'#mt-full .mt-row{display:flex;justify-content:space-between;gap:8px;font-size:.9rem}#mt-full .mt-chip{display:inline-block;background:rgba(0,0,0,.28);border-radius:999px;padding:4px 10px;font-size:.82rem;margin:8px 6px 0 0}'
     +'#mt-full .mt-bal{margin-top:14px;background:rgba(0,0,0,.3);border-radius:14px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center}#mt-full .mt-bal b{font-size:1.35rem}'
     +'#mt-full .mt-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}#mt-full .mt-b{min-height:56px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;font:600 .92rem Poppins,Arial,sans-serif;cursor:pointer;padding:8px;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px}'
     +'#mt-full .mt-b.big{grid-column:1/-1;background:#e8c98d;color:#1b1100;border:0;font-size:1rem}#mt-full .mt-b.wa{background:#1f8f4e;border:0}'
     +'#mt-full .mt-code{background:#fff;color:#111;border-radius:16px;padding:14px;text-align:center;margin-top:14px}#mt-full .mt-code svg{width:210px;height:210px;max-width:100%}#mt-full .mt-code .n{font:700 1.4rem monospace;letter-spacing:.1em}'
     +'#mt-full .mt-tip{font-size:.82rem;opacity:.8;margin-top:14px;line-height:1.4}#mt-full .mt-rw{margin-top:10px;background:rgba(255,255,255,.95);color:#5a3d0c;border-radius:12px;padding:8px 12px;font-weight:600;font-size:.9rem}';
    document.head.appendChild(st); }
  function mtSite(){ try{return API.site()||{};}catch(e){return {};} }
  function mtBrand(){ try{return (API.brand&&API.brand())||{};}catch(e){return {};} }
  function mtWa(){ var s=mtSite(); return String(s.wa||window.RAVE_WA||'').replace(/\D/g,''); }
  function mtClose(){ clearInterval(mtTick); mtTick=null; var o=$('#mt-full'); if(o) o.remove(); try{ var pw=window.parent; if(pw.location.hash==='#mitarjeta') pw.history.replaceState(null,'',pw.location.href.split('#')[0]+'#menu'); }catch(e){} }
  function mtMenuUrl(){ var b=mtBrand(); return String(b.url||'').split('#')[0]; }
  var mtCodeOn=false;
  function mtOpen(keep){
    mtStyle(); var old=$('#mt-full'), sc=old&&keep?old.scrollTop:0; if(old) old.remove(); clearInterval(mtTick); mtTick=null; if(!keep) mtCodeOn=false;
    /* V26.58: al abrir, pedir YA los sellos y el saldo al servidor (antes se mostraba la tarjeta vacía hasta el próximo sondeo) */
    if(!keep){ try{ if(window.parent.cardPoll) window.parent.cardPoll(); }catch(e){} }
    var id=cardId(), c=id?API.card(id):null, s=mtSite(), b=mtBrand(), title=s.title||b.name||'', wa=mtWa();
    var o=document.createElement('div'); o.id='mt-full'; o.setAttribute('role','dialog'); o.setAttribute('aria-label',L('Mi tarjeta del Club','My Club card'));
    var top='<div class="mt-top">'+(b.logo?'<img src="'+esc(b.logo)+'" alt="">':'')+'<b>'+esc(title)+'</b><button type="button" class="mt-x" id="mt-x" aria-label="'+L('Cerrar y ver el menú','Close and see the menu')+'">✕</button></div>';
    if(!c){
      o.innerHTML='<div class="mt-w">'+top+'<div class="mt-card"><div class="mt-k">'+L('Club','Club')+'</div><div class="mt-n">'+L('No hay una tarjeta en este celular','No card on this phone')+'</div><div class="mt-s">'+L('Sumate al Club desde el menú o pedile al local el enlace de tu tarjeta.','Join the Club from the menu or ask the shop for your card link.')+'</div></div>'
        +'<div class="mt-btns"><button type="button" class="mt-b big" id="mt-menu">'+L('Ir al menú y sumarme','Go to the menu and join')+'</button>'+(wa?'<a class="mt-b wa" style="grid-column:1/-1" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+wa+'?text='+encodeURIComponent(L('Hola! Ya soy socio del Club pero no veo mi tarjeta en este celular. ¿Me mandan el enlace de mi tarjeta? Mi nombre es: ','Hi! I am a Club member but I cannot see my card on this phone. Could you send me my card link? My name is: '))+'">💬 '+L('Pedir mi tarjeta por WhatsApp','Ask for my card on WhatsApp')+'</a>':'')+'</div></div>';
      document.body.appendChild(o); $('#mt-x').addEventListener('click',mtClose); $('#mt-menu').addEventListener('click',function(){mtClose(); var j=document.querySelector('#club,#loy,.loy-join'); if(j) j.scrollIntoView({behavior:'smooth'});}); mtAppify(o,'',null); return;
    }
    var g=c.goal||8, n=Math.min(c.stamps||0,g), dots=''; for(var i=0;i<g;i++) dots+='<i class="'+(i<n?'on':'')+'">'+(i<n?'★':'')+'</i>';
    var left=Math.max(0,g-n), hello=L('Hola, soy ','Hi, I am ')+(c.name||'')+(c.pending?'':L(', socio N.º ',', member #')+c.num)+L(' del Club. ',' from the Club. ');
    var bal=(c.saldo!==null&&c.saldo!==undefined)?'<div class="mt-bal"><span>👛 '+L('Tu crédito en el local','Your credit at the shop')+'</span><b>'+money(c.saldo/100)+'</b></div>':'';
    o.innerHTML='<div class="mt-w">'+top
      +'<div class="mt-card"><div class="mt-k">'+L('Tarjeta del Club','Club card')+'</div><div class="mt-n">'+esc(c.name||'')+'</div>'
      +'<div class="mt-s">'+(c.pending?L('Buscando tus sellos… (si recién te sumaste, el local la activa en unos segundos)','Loading your stamps… (if you just joined, the shop activates it shortly)'):L('Socio N.º ','Member # ')+esc(c.num))+'</div>'
      +(c.tier?'<span class="mt-chip">'+({bronce:'🥉',plata:'🥈',oro:'🥇'}[c.tier.k]||'⭐')+' '+L('Nivel ','Level ')+esc(c.tier.name)+(c.tier.pct?' · '+c.tier.pct+' %':'')+'</span>':'')
      +(c.member?'<span class="mt-chip">⭐ '+esc(c.member.name)+'</span>':'')
      +'<div class="mt-st" style="grid-template-columns:repeat('+Math.min(g,5)+',1fr)">'+dots+'</div>'
      +'<div class="mt-row"><span>'+n+' / '+g+' '+L('sellos','stamps')+'</span><span>'+(left?L('Te faltan '+left,left+' to go'):L('¡Tenés un premio!','You have a reward!'))+'</span></div>'
      +(c.rewardText&&!/a definir/i.test(c.rewardText)?'<div class="mt-rw">🎁 '+(c.rewards?L('Premio disponible: ','Reward available: '):L('Con '+g+' sellos: ','With '+g+' stamps: '))+esc(c.rewardText)+'</div>':'')
      +(c.tier&&c.tier.next?'<div class="mt-s" style="margin-top:8px">'+L('Te faltan ','')+money((c.tier.missing||0)/100)+L(' de compras para '+esc(c.tier.next),' in purchases to reach '+esc(c.tier.next))+'</div>':'')
      +bal+'</div>'
      +'<div id="mt-codebox"></div>'
      +'<div class="mt-btns"><button type="button" class="mt-b big" id="mt-code">📲 '+L('Mostrar mi código para sumar sellos','Show my code to get a stamp')+'</button>'
      +(wa?'<a class="mt-b wa" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+wa+'?text='+encodeURIComponent(hello)+'">💬 '+L('Escribir al local','Message the shop')+'</a>':'')
      +(wa?'<a class="mt-b" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+wa+'?text='+encodeURIComponent(hello+L('Quería consultar / reservar: ','I would like to ask / book: '))+'">📅 '+L('Consultar o reservar','Ask or book')+'</a>':'')
      +'<button type="button" class="mt-b" id="mt-menu">🛒 '+L('Ver el menú y pedir','See the menu and order')+'</button>'
      +'<button type="button" class="mt-b" id="mt-inv">🎉 '+L('Invitar amigos al Club','Invite friends to the Club')+'</button>'
      +'<button type="button" class="mt-b" id="mt-img">🖼️ '+L('Imagen para mostrar','Image to show')+'</button>'
      +'<button type="button" class="mt-b" id="mt-home">📌 '+L('Tenerla en mi inicio','Keep it on my home screen')+'</button></div>'
      +'<div class="mt-tip" id="mt-msg" role="status"></div>'
      +'<p class="mt-tip">'+L('Esta tarjeta es personal y queda guardada en este celular. Si cambiás de celular, pedile al local el enlace de tu tarjeta. En el mostrador también te suman sellos con tu DNI.','This card is personal and is kept on this phone. If you change phones, ask the shop for your card link. At the counter they can also add stamps with your ID number.')+'</p></div>';
    document.body.appendChild(o); mtAppify(o,id,c); o.scrollTop=sc;
    function say(t){ var m=$('#mt-msg'); if(m) m.textContent=t; }
    $('#mt-x').addEventListener('click',mtClose);
    $('#mt-menu').addEventListener('click',mtClose);
    function mtShowCode(){
      var box=$('#mt-codebox'); mtCodeOn=true; function draw(){ var k=API.cardCode(id); if(!k){box.innerHTML='';clearInterval(mtTick);return;}
        box.innerHTML='<div class="mt-code">'+k.qr+'<div class="n">'+(k.pending?esc(k.otp):esc(k.socio)+' · '+esc(k.otp))+'</div><div style="font-size:.85rem;color:#444">'+L('Mostralo en el mostrador · cambia en ','Show it at the counter · changes in ')+'<b id="mt-t">'+k.secs+'</b> s</div></div>'; }
      draw(); clearInterval(mtTick); mtTick=setInterval(function(){ var t=$('#mt-t'); if(!t){clearInterval(mtTick);return;} var x=+t.textContent-1; if(x<=0) draw(); else t.textContent=x; },1000);
    }
    $('#mt-code').addEventListener('click',function(){ mtShowCode(); $('#mt-codebox').scrollIntoView({behavior:'smooth',block:'center'}); });
    if(mtCodeOn) mtShowCode();
    $('#mt-inv').addEventListener('click',function(){
      var url=mtMenuUrl()+'#menu', txt=L('¡Sumate al Club de '+title+'! Juntás sellos y tenés premios. Mirá el menú acá:','Join the '+title+' Club! Collect stamps and get rewards. See the menu here:');
      if(navigator.share){ navigator.share({title:title,text:txt,url:url}).catch(function(){}); }
      else { window.open('https://wa.me/?text='+encodeURIComponent(txt+' '+url),'_blank','noopener'); }
    });
    $('#mt-home').addEventListener('click',function(){
      var ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
      say(ios?L('En iPhone: tocá el botón Compartir (el cuadrado con la flecha) y elegí «Agregar a pantalla de inicio». Así abrís tu tarjeta como una app.','On iPhone: tap Share (square with arrow) and choose “Add to Home Screen”. Your card opens like an app.')
             :L('En Android: tocá el menú ⋮ del navegador y elegí «Agregar a la pantalla principal» (o «Instalar»). Así abrís tu tarjeta como una app.','On Android: tap the browser menu ⋮ and choose “Add to Home screen” (or “Install”). Your card opens like an app.'));
    });
    $('#mt-img').addEventListener('click',function(){ mtPng(c,title,function(ok){ say(ok?L('Listo: se descargó la imagen de tu tarjeta para mostrarla (no sirve para sumar sellos).','Done: your card image was downloaded to show it (it cannot be used to get stamps).'):L('No se pudo generar la imagen en este navegador.','The image could not be created in this browser.')); }); });
  }
  /* imagen «para mostrar»: sellos y nivel, con un QR al MENÚ (no al enlace personal) */
  function mtPng(c,title,cb){
    try{
      var W=720,H=440,cv=document.createElement('canvas'); cv.width=W; cv.height=H; var g=cv.getContext('2d');
      var gr=g.createLinearGradient(0,0,W,H); gr.addColorStop(0,'#c9963e'); gr.addColorStop(.55,'#7a5a22'); gr.addColorStop(1,'#2d2418'); g.fillStyle=gr; g.fillRect(0,0,W,H);
      g.fillStyle='#fff'; g.font='600 20px Poppins,Arial,sans-serif'; g.fillText(String(title||'').slice(0,34),36,52);
      g.font='700 40px Georgia,serif'; g.fillText(String(c.name||'').slice(0,18),36,112);
      g.font='500 18px Poppins,Arial,sans-serif'; g.fillText((c.pending?L('Socio del Club','Club member'):L('Socio N.º ','Member # ')+c.num)+(c.tier?'  ·  '+L('Nivel ','Level ')+c.tier.name:''),36,144);
      var gl=c.goal||8, n=Math.min(c.stamps||0,gl), per=Math.min(gl,5), r=24;
      for(var i=0;i<gl;i++){ var x=60+(i%per)*62, y=200+Math.floor(i/per)*62; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); if(i<n){g.fillStyle='#fff';g.fill();g.fillStyle='#7a5a22';g.font='700 22px Arial';g.textAlign='center';g.fillText('★',x,y+8);g.textAlign='left';} else {g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=3;g.setLineDash([5,5]);g.stroke();g.setLineDash([]);} }
      g.fillStyle='#fff'; g.font='600 18px Poppins,Arial,sans-serif'; g.fillText(n+' / '+gl+' '+L('sellos','stamps'),36,H-60);
      g.font='500 15px Poppins,Arial,sans-serif'; g.fillText(L('¡Sumate vos también! Escaneá el QR','Join too! Scan the QR'),36,H-32);
      var qs=''; try{ qs=API.qr?API.qr(mtMenuUrl()+'#menu'):''; }catch(e){}
      var fin=function(){ cv.toBlob(function(bl){ if(!bl) return cb(false); var a=document.createElement('a'); a.href=URL.createObjectURL(bl); a.download='mi-tarjeta-club.png'; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1500); cb(true); },'image/png'); };
      if(!qs) return fin();
      var img=new Image(), u=URL.createObjectURL(new Blob([qs],{type:'image/svg+xml'}));
      img.onload=function(){ g.fillStyle='#fff'; g.fillRect(W-230,H-250,200,200); g.drawImage(img,W-222,H-242,184,184); URL.revokeObjectURL(u); fin(); };
      img.onerror=function(){ fin(); }; img.src=u;
    }catch(e){ cb(false); }
  }
  /* ===== V26.69 · APP DEL CLIENTE: pestañas Tarjeta · Beneficios · Pedidos · Contacto (+ instalar la app) ===== */
  var mtTab='card', mtPedT=null;
  function RA(){ try{ return window.parent.RAVE_APP||null; }catch(e){ return null; } }
  function pedsGet(){ try{ var a=JSON.parse(localStorage.getItem('rave.peds')||'[]'); return Array.isArray(a)?a.filter(function(x){return x&&/^[A-Za-z0-9_-]{16,40}$/.test(x.tok||'');}):[]; }catch(e){ return []; } }
  function pedsSet(a){ try{ localStorage.setItem('rave.peds',JSON.stringify(a.slice(0,10))); }catch(e){} }
  window.RAVE_PED_ADD=function(p){ var a=pedsGet().filter(function(x){return x.tok!==p.tok;}); a.unshift(p); pedsSet(a); };
  function appStyle(){ if($('#mta-style')) return; var st=document.createElement('style'); st.id='mta-style';
    st.textContent='#mt-full .mt-w{padding-bottom:96px}#mt-full .mta-nav{position:fixed;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(4,1fr);background:#16130f;border-top:1px solid #3a3020;padding:6px 6px calc(6px + env(safe-area-inset-bottom));z-index:2}'
     +'#mt-full .mta-nav button{background:none;border:0;color:#bfb29a;font:600 .72rem Poppins,Arial,sans-serif;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:12px;cursor:pointer;min-height:52px}'
     +'#mt-full .mta-nav button span{font-size:1.35rem;line-height:1}#mt-full .mta-nav button[aria-selected=true]{color:#16130f;background:#e8c98d}'
     +'#mt-full .mta-inst{display:flex;align-items:center;gap:10px;background:#2a2318;border:1px solid #5a4724;border-radius:14px;padding:10px 12px;margin-bottom:12px}#mt-full .mta-inst b{flex:1;font-size:.9rem}'
     +'#mt-full .mta-inst button{background:#e8c98d;color:#16130f;border:0;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer}#mt-full .mta-inst .x{background:none;color:#bfb29a;padding:4px 8px}'
     +'#mt-full .mta-h{font:700 1.15rem Georgia,serif;color:#e8c98d;margin:4px 0 10px}#mt-full .mta-c{background:#1f1b15;border:1px solid #3a3020;border-radius:14px;padding:12px;margin-bottom:10px}'
     +'#mt-full .mta-c small{color:#bfb29a}#mt-full .mta-cp{display:flex;align-items:center;gap:8px}#mt-full .mta-cp code{font-size:1.05rem;color:#e8c98d;font-weight:700}#mt-full .mta-cp button{margin-left:auto}'
     +'#mt-full .mta-btn{display:flex;align-items:center;gap:10px;width:100%;background:#2a2318;color:#fff;border:1px solid #4a3b20;border-radius:14px;padding:12px 14px;margin-bottom:8px;font:600 1rem Poppins,Arial,sans-serif;text-decoration:none;cursor:pointer;text-align:left}'
     +'#mt-full .mta-btn span{font-size:1.35rem}#mt-full .mta-btn.wa{background:#128c4a;border-color:#128c4a}#mt-full .mta-g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
     +'#mt-full .mta-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:10px 0 6px}#mt-full .mta-steps i{height:6px;border-radius:3px;background:#3a3020}#mt-full .mta-steps i.on{background:#e8c98d}#mt-full .mta-steps i.bad{background:#c0392b}'
     +'#mt-full .mta-pin{font:800 1.8rem Poppins,Arial,sans-serif;letter-spacing:.3em;color:#fff;text-align:center;background:#16130f;border:1px dashed #e8c98d;border-radius:12px;padding:6px;margin:8px 0}'
     +'#mt-full .mta-est{font-weight:700;font-size:1.05rem}#mt-full .mta-mut{color:#bfb29a;font-size:.85rem}#mt-full .mta-sm{background:none;border:1px solid #5a4724;color:#e8c98d;border-radius:10px;padding:6px 10px;cursor:pointer;font-weight:600}';
    document.head.appendChild(st); }
  var EST={recibido:['📨',L('Recibido','Received'),1],confirmado:['✅',L('Confirmado','Confirmed'),1],preparando:['👨‍🍳',L('Preparando tu pedido','Preparing your order'),2],listo:['📦',L('Listo para salir','Ready to go'),3],en_camino:['🛵',L('En camino','On the way'),4],entregado:['🎉',L('Entregado','Delivered'),5],ausente:['🚪',L('No te encontramos','We could not find you'),-1],cancelado:['✖️',L('Cancelado','Cancelled'),-1]};
  function paneBen(id,c){var h='<div class="mta-h">'+L('Tus beneficios','Your benefits')+'</div>';
    if(c){ if(c.rewards) h+='<div class="mta-c">🎁 <b>'+L('Tenés un premio para canjear','You have a reward')+'</b><br><small>'+esc(c.rewardText||'')+' · '+L('mostrá tu código en el mostrador','show your code at the counter')+'</small></div>';
      else h+='<div class="mta-c">⭐ '+L('Te faltan ','')+Math.max(0,(c.goal||8)-(c.stamps||0))+L(' sellos para tu premio',' stamps to your reward')+(c.rewardText&&!/a definir/i.test(c.rewardText)?'<br><small>'+esc(c.rewardText)+'</small>':'')+'</div>';
      if(c.tier) h+='<div class="mta-c">'+({bronce:'🥉',plata:'🥈',oro:'🥇'}[c.tier.k]||'⭐')+' '+L('Nivel ','Level ')+'<b>'+esc(c.tier.name)+'</b>'+(c.tier.pct?' · '+c.tier.pct+' % '+L('de descuento','off'):'')+(c.tier.next?'<br><small>'+L('Te faltan ','')+money((c.tier.missing||0)/100)+L(' de compras para '+esc(c.tier.next),' to reach '+esc(c.tier.next))+'</small>':'')+'</div>';
      if(c.saldo!==null&&c.saldo!==undefined) h+='<div class="mta-c">👛 '+L('Crédito en el local','Credit at the shop')+': <b>'+money(c.saldo/100)+'</b></div>';
      if(c.member) h+='<div class="mta-c">⭐ '+L('Membresía','Membership')+': <b>'+esc(c.member.name)+'</b></div>'; }
    var cs=[]; try{ cs=API.coupons(id)||[]; }catch(e){}
    h+='<div class="mta-h" style="font-size:1rem">'+L('Cupones','Coupons')+'</div>'+(cs.length?cs.map(function(x){return '<div class="mta-c"><div class="mta-cp"><code>'+esc(x.code)+'</code><button type="button" class="mta-sm" data-copy="'+esc(x.code)+'">'+L('Copiar','Copy')+'</button></div><div>'+esc(x.desc)+'</div><small>'+esc(x.cond||'')+'</small></div>';}).join(''):'<p class="mta-mut">'+L('No hay cupones activos ahora.','No active coupons now.')+'</p>');
    var ps=[]; try{ ps=API.plans()||[]; }catch(e){}
    if(ps.length) h+='<div class="mta-h" style="font-size:1rem">'+L('Membresías','Memberships')+'</div>'+ps.map(function(p){return '<div class="mta-c"><b>'+esc(p.name)+'</b> · '+money(p.price)+' / '+esc(p.period)+'<br><small>'+esc(p.desc||'')+'</small></div>';}).join('');
    return h; }
  function panePed(){var P=pedsGet(), wa=mtWa();
    if(!P.length) return '<div class="mta-h">'+L('Tus pedidos','Your orders')+'</div><div class="mta-c">'+L('Todavía no hiciste pedidos con envío desde este celular.','You have not placed delivery orders from this phone yet.')+'</div><button type="button" class="mta-btn" data-mta="menu"><span>🛒</span>'+L('Hacer un pedido','Place an order')+'</button>';
    return '<div class="row" style="display:flex;align-items:center"><div class="mta-h" style="flex:1">'+L('Tus pedidos','Your orders')+'</div><button type="button" class="mta-sm" data-mta="refresh">↻ '+L('Actualizar','Refresh')+'</button></div><div id="mta-peds">'+P.map(function(p){return pedHtml(p,null);}).join('')+'</div>'; }
  function pedHtml(p,st){var e=st&&EST[st.estado]?EST[st.estado]:(p.st&&EST[p.st]?EST[p.st]:EST.recibido), k=e[2], wa=mtWa(), steps='';
    for(var i=1;i<=5;i++) steps+='<i class="'+(k<0?(i===1?'bad':''):(i<=k?'on':''))+'"></i>';
    var fin=st&&(st.estado==='entregado'||st.estado==='cancelado');
    return '<div class="mta-c" data-tok="'+esc(p.tok)+'"><div style="display:flex;gap:8px;align-items:center"><span style="font-size:1.5rem">'+e[0]+'</span><div style="flex:1"><div class="mta-est">'+esc(e[1])+'</div><small>'+(p.n?'#'+esc(p.n)+' · ':'')+new Date(p.ts||Date.now()).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+(p.total?' · '+money(p.total):'')+'</small></div></div>'
      +'<div class="mta-steps">'+steps+'</div>'+(st&&st.eta&&!fin?'<small>⏱️ '+L('Llega en ','Arrives in ')+esc(st.eta)+'</small><br>':'')+(st&&st.rep&&!fin?'<small>🛵 '+L('Te lo lleva ','Delivered by ')+esc(st.rep)+'</small>':'')
      +(st&&st.estado==='ausente'?'<p class="mta-mut">'+L('Escribinos para coordinar otra entrega.','Message us to arrange another delivery.')+'</p>':'')
      +(p.pin&&!fin?'<div class="mta-mut">'+L('Decile este código al repartidor:','Tell this code to the courier:')+'</div><div class="mta-pin">'+esc(p.pin)+'</div>':'')
      +(wa?'<a class="mta-sm" style="display:inline-block;margin-top:6px;text-decoration:none" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+wa+'?text='+encodeURIComponent(L('Hola! Consulto por mi pedido '+(p.n?'#'+p.n:'')+' (seguimiento '+p.tok.slice(0,6)+').','Hi! About my order '+(p.n?'#'+p.n:'')+' (tracking '+p.tok.slice(0,6)+').'))+'">💬 '+L('Consultar por este pedido','Ask about this order')+'</a>':'')+'</div>'; }
  function pedRefresh(){var P=pedsGet(); if(!P.length||!API.track) return; var r; try{ r=API.track(P.map(function(p){return p.tok;})); }catch(e){ return; }
    Promise.resolve(r).then(function(L2){ if(!L2) return; var box=$('#mta-peds'); var map={}; L2.forEach(function(x){ if(x&&x.ref) map[x.ref]=x; });
      var A=pedsGet(); A.forEach(function(p){ if(map[p.tok]) p.st=map[p.tok].estado; }); pedsSet(A);
      if(box) box.innerHTML=A.map(function(p){return pedHtml(p,map[p.tok]||null);}).join(''); }).catch(function(){}); }
  function paneCon(){var s=mtSite(), a=s.app||{}, wa=mtWa(), title=s.title||mtBrand().name||'', h='<div class="mta-h">'+L('Hablá con ','Talk to ')+esc(title)+'</div>';
    var hi=L('Hola! ','Hi! ');
    (a.btns||[{k:'pedir',ic:'🛒',t:L('Hacer un pedido','Place an order'),msg:''}]).forEach(function(b){
      if(b.k==='pedir') h+='<button type="button" class="mta-btn" data-mta="menu"><span>'+esc(b.ic)+'</span>'+esc(b.t)+'</button>';
      else if(wa) h+='<a class="mta-btn" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+wa+'?text='+encodeURIComponent(b.msg||hi)+'"><span>'+esc(b.ic)+'</span>'+esc(b.t)+'</a>'; });
    if(wa) h+='<a class="mta-btn wa" target="_blank" rel="noopener noreferrer" href="https://wa.me/'+wa+'?text='+encodeURIComponent(hi)+'"><span>💬</span>'+L('Escribir por WhatsApp','Message on WhatsApp')+'</a>';
    if(window.RAVE_CHAT_OPEN&&s.chat) h+='<button type="button" class="mta-btn" data-mta="chat"><span>🗨️</span>'+L('Chatear con el local','Chat with the shop')+'</button>';
    var CN=(s.canales||[]).filter(function(x){return x.k!=='wa'&&/^(https:|mailto:)/.test(x.url);}); CN.forEach(function(x){ h+='<a class="mta-btn" target="_blank" rel="noopener noreferrer" href="'+esc(x.url)+'"><span>'+esc(x.ic)+'</span>'+L('Escribir por ','Message on ')+esc(x.t)+'</a>'; });
    var cub={instagram:'ig',facebook:'fb',tiktok:'tt',telegram:'tg'};
    var g='';var tel=a.tel||(wa?'+'+wa:'');
    if(a.llamar!==false&&tel) g+='<a class="mta-btn" href="tel:'+esc(tel)+'"><span>📞</span>'+L('Llamar','Call')+'</a>';
    var mp=s.mapUrl||(s.address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s.address):'');
    if(a.mapa!==false&&mp) g+='<a class="mta-btn" target="_blank" rel="noopener noreferrer" href="'+esc(mp)+'"><span>📍</span>'+L('Cómo llegar','Directions')+'</a>';
    if(a.resena!==false&&s.reviewUrl) g+='<a class="mta-btn" target="_blank" rel="noopener noreferrer" href="'+esc(s.reviewUrl)+'"><span>⭐</span>'+L('Dejar reseña','Leave a review')+'</a>';
    if(a.redes!==false) (s.social||[]).filter(function(x){ return !CN.some(function(c){ return c.k===cub[x.k]; }); }).slice(0,4).forEach(function(x){ g+='<a class="mta-btn" target="_blank" rel="noopener noreferrer" href="'+esc(x.url)+'"><span>🔗</span>'+esc(x.label||x.k)+'</a>'; });
    if(g) h+='<div class="mta-g2">'+g+'</div>';
    try{ var pz2=RA()&&RA().push?RA().push.estado():null; if(pz2&&pz2.activo) h+='<button type="button" class="mta-btn" data-mta="pushoff"><span>🔕</span>'+L('Desactivar avisos','Turn off notifications')+'</button>'; }catch(e){}
    if(a.horario||s.address) h+='<div class="mta-c">'+(a.horario?'🕒 '+esc(a.horario)+'<br>':'')+(s.address?'📍 '+esc(s.address):'')+'</div>';
    return h; }
  function mtAppify(o,id,c){ appStyle(); var w=o.querySelector('.mt-w'); if(!w) return; var top=w.querySelector('.mt-top');
    var p0=document.createElement('div'); p0.className='mt-pane'; p0.setAttribute('data-p','card');
    Array.prototype.slice.call(w.children).forEach(function(ch){ if(ch!==top) p0.appendChild(ch); }); w.appendChild(p0);
    var ra=RA(), inst='';
    try{ if(ra&&ra.can()&&!ra.installed()&&localStorage.getItem('rave.mta.noinst')!=='1') inst='<div class="mta-inst"><span style="font-size:1.4rem">📲</span><b>'+L('Instalá la app del Club en tu celular','Install the Club app on your phone')+'</b><button type="button" data-mta="inst">'+L('Instalar','Install')+'</button><button type="button" class="x" data-mta="noinst" aria-label="'+L('Ahora no','Not now')+'">✕</button></div>'; }catch(e){}
    if(inst) top.insertAdjacentHTML('afterend',inst);
    /* V26.73 · aviso amable ANTES del permiso del navegador (notificaciones push) */
    var pz=null; try{ pz=ra&&ra.push?ra.push.estado():null; }catch(e){}
    try{ if(pz&&pz.on&&!pz.activo&&pz.perm!=='denied'&&(pz.sup||pz.iosNeedsInstall)&&localStorage.getItem('rave.mta.nopush')!=='1'){
      var pc='<div class="mta-inst mta-push" role="region" aria-label="'+L('Avisos','Notifications')+'"><span style="font-size:1.4rem" aria-hidden="true">🔔</span><b>'+esc(pz.t||L('¿Te avisamos de las promos?','Get our deals?'))+'<br><small style="font-weight:400;color:#bfb29a">'+esc(pz.iosNeedsInstall?L('En iPhone, primero instalá la app (Compartir → Agregar a inicio) y abrila desde el ícono.','On iPhone, install the app first (Share → Add to Home Screen).'):(pz.b||''))+'</small></b>'
        +(pz.iosNeedsInstall?'':'<button type="button" data-mta="push">'+L('Activar','Turn on')+'</button>')+'<button type="button" class="x" data-mta="nopush" aria-label="'+L('Ahora no','Not now')+'">✕</button></div>';
      (o.querySelector('.mta-inst')||top).insertAdjacentHTML('afterend',pc); } }catch(e){}
    [['ben',paneBen(id,c)],['ped',panePed()],['con',paneCon()]].forEach(function(x){ var d=document.createElement('div'); d.className='mt-pane'; d.setAttribute('data-p',x[0]); d.innerHTML=x[1]; w.appendChild(d); });
    var nav=document.createElement('nav'); nav.className='mta-nav'; nav.setAttribute('role','tablist'); nav.setAttribute('aria-label',L('Secciones de la app','App sections'));
    nav.innerHTML=[['card','⭐',L('Tarjeta','Card')],['ben','🎁',L('Beneficios','Benefits')],['ped','📦',L('Pedidos','Orders')],['con','💬',L('Contacto','Contact')]].map(function(t){return '<button type="button" role="tab" data-mtab="'+t[0]+'" aria-selected="false"><span aria-hidden="true">'+t[1]+'</span>'+t[2]+'</button>';}).join('');
    o.appendChild(nav); mtShow(o);
    o.addEventListener('click',function(ev){ var t=ev.target.closest('[data-mtab]'); if(t){ mtTab=t.getAttribute('data-mtab'); mtShow(o); o.scrollTop=0; return; }
      var b=ev.target.closest('[data-mta]'); if(!b) return; var k=b.getAttribute('data-mta');
      if(k==='menu'){ mtClose(); } else if(k==='refresh'){ pedRefresh(); } else if(k==='chat'){ mtClose(); try{window.RAVE_CHAT_OPEN();}catch(e){} }
      else if(k==='inst'){ try{ Promise.resolve(RA().install()).then(function(){ var x=o.querySelector('.mta-inst'); if(x&&RA().installed()) x.remove(); }); }catch(e){} }
      else if(k==='push'){ if(b.disabled) return; var pb=o.querySelector('.mta-push'); b.disabled=true; Promise.resolve(RA().push.activar()).then(function(){ if(pb) pb.innerHTML='<span style="font-size:1.4rem">✅</span><b>'+L('Avisos activados. Los podés desactivar en Contacto.','Notifications on. You can turn them off in Contact.')+'</b>'; }).catch(function(er){ b.disabled=false; if(pb){ var sm=pb.querySelector('small'); if(sm) sm.textContent=String(er&&er.message||er).slice(0,160); } }); }
      else if(k==='nopush'){ try{localStorage.setItem('rave.mta.nopush','1');}catch(e){} var x2=o.querySelector('.mta-push'); if(x2) x2.remove(); }
      else if(k==='pushoff'){ Promise.resolve(RA().push.desactivar()).then(function(){ b.outerHTML='<p class="mta-mut">'+L('Avisos desactivados: se borró tu suscripción.','Notifications off: your subscription was deleted.')+'</p>'; }); }
      else if(k==='noinst'){ try{localStorage.setItem('rave.mta.noinst','1');}catch(e){} var x=o.querySelector('.mta-inst'); if(x) x.remove(); } });
    var hb=$('#mt-home'); if(hb&&ra&&ra.can()) hb.addEventListener('click',function(e){ e.stopImmediatePropagation(); try{RA().install();}catch(x){} },true); }
  function mtShow(o){ o.querySelectorAll('.mt-pane').forEach(function(p){ p.hidden=p.getAttribute('data-p')!==mtTab; }); o.querySelectorAll('[data-mtab]').forEach(function(b){ b.setAttribute('aria-selected',String(b.getAttribute('data-mtab')===mtTab)); });
    clearInterval(mtPedT); if(mtTab==='ped'){ pedRefresh(); mtPedT=setInterval(function(){ if(!$('#mt-full')||mtTab!=='ped'){clearInterval(mtPedT);return;} pedRefresh(); },20000); } }
  window.RAVE_OPEN_APP=function(tab){ mtTab=tab||'card'; mtOpen(); };
  try{ var hq=window.parent.location.hash; if(/^#mitarjeta\/(ben|ped|con)$/.test(hq)){ mtTab=hq.split('/')[1]; } }catch(e){}
  window.RAVE_OPEN_MYCARD=mtOpen;
  try{ if(/^#mitarjeta(\/|$)/.test(window.parent.location.hash)) setTimeout(mtOpen,60); }catch(e){}
  window.RAVE_CARD_REFRESH=function(){renderCard();renderCoupons();if($('#mt-full'))mtOpen(true);};
  var rb=$('#loy-recover');
  if(rb) rb.addEventListener('click',function(){
    var id=API.cardLogin($('#loy-wa').value,$('#loy-bd').value), er=$('#loy-err');
    if(!id){er.style.display='block';return;} er.style.display='none';
    try{localStorage.setItem('rave.card',id);}catch(e){}
    $('#loy-wa').value='';$('#loy-bd').value=''; renderCard(); renderCoupons();
  });

  /* --- información legal (los textos se editan en Administración → Legal y cumplimiento) --- */
  function renderLegal(){
    var list=$('#legal-list'); if(!list) return;
    var items=API.legal(); var note='<p class="legal-lang-note">'+L('Texto vigente en español.','The text below is the legally binding Spanish version.')+'</p>';
    items.forEach(function(x){ if(x.id==='privacidad'){ var b=$('#legal-rave .legal-body'); if(b) b.innerHTML=note+x.html; } });
    list.innerHTML=items.filter(function(x){return x.id!=='privacidad';}).map(function(x){return '<details class="legal-details"><summary>'+esc(L(x.title,x.titleEn||x.title))+'</summary><div class="legal-body">'+note+x.html+'</div></details>';}).join('');
  }
  var ab=$('#arrep-btn');
  if(ab) ab.addEventListener('click',function(){
    var t='Botón de arrepentimiento: quiero revocar mi compra. Pedido/fecha: ____ Nombre: ____ (dentro de los 10 días corridos).';
    window.open('https://wa.me/'+(window.RAVE_WA||'')+'?text='+encodeURIComponent(t),'_blank');
    try{API.logArrep();}catch(e){}
  });

  /* al cambiar de idioma se vuelven a dibujar las partes dinámicas */
  var lastLang=L('es','en');
  setInterval(function(){var l=L('es','en'); if(l!==lastLang){lastLang=l; renderCard(); renderCoupons(); renderLegal();}},500);
  renderCoupons(); renderCard(); renderLegal();
  /* si el panel cambia datos (cupones, sellos) el menú se redibuja */
  window.RAVE_PUB_REFRESH=function(){renderCoupons();renderCard();renderLegal();try{if(window.RAVE_SHIP_REFRESH)window.RAVE_SHIP_REFRESH();}catch(e){}};

  /* --- V26.60 · chat «Escribinos» (CRM): el celular guarda su chat; en la nube viaja cifrado de punta a punta --- */
  (function(){
    if(typeof API.chatOn!=='function') return;
    var st=document.createElement('style');
    st.textContent='#rv-chat-fab{position:fixed;right:16px;bottom:76px;z-index:56;min-width:52px;height:52px;border-radius:26px;padding:0 16px;border:1px solid var(--gold,#c9963e);background:var(--charcoal,#222);color:var(--gold-deep,#e6c27a);font:700 14px Poppins,sans-serif;display:none;align-items:center;gap:6px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer}'+
     '#rv-chat-fab .d{width:9px;height:9px;border-radius:50%;background:#e74c3c;display:none}#rv-chat-fab.new .d{display:inline-block}'+
     '#rv-chat{position:fixed;right:12px;bottom:12px;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 24px));z-index:12000;background:#fffaf2;color:#2b2216;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.4);display:none;flex-direction:column;overflow:hidden;font-family:Poppins,sans-serif}'+
     '#rv-chat header{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--charcoal,#222);color:#fff}#rv-chat header b{flex:1}#rv-chat header button{background:none;border:0;color:#fff;font-size:22px;min-width:44px;min-height:44px;cursor:pointer}'+
     '#rv-chat .th{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}#rv-chat .m{max-width:85%;padding:8px 11px;border-radius:12px;white-space:pre-wrap;word-break:break-word;font-size:14px}'+
     '#rv-chat .m.in{align-self:flex-end;background:#e7d5b0}#rv-chat .m.out{align-self:flex-start;background:#fff;border:1px solid #e6dccb}#rv-chat .m.sys{align-self:center;font-size:12px;opacity:.75;background:none}'+
     '#rv-chat .m small{display:block;opacity:.6;font-size:11px;margin-top:3px}#rv-chat form{padding:10px;border-top:1px solid #e6dccb;display:flex;flex-direction:column;gap:6px}'+
     '#rv-chat input,#rv-chat textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d8ccb5;border-radius:10px;font:14px Poppins,sans-serif;background:#fff;color:#2b2216}'+
     '#rv-chat .snd{min-height:46px;border:0;border-radius:10px;background:linear-gradient(135deg,#b8862f,#e6c27a);color:#2b2216;font-weight:700;cursor:pointer}#rv-chat .err{color:#b0302a;font-size:12.5px;min-height:1em}'+
     '#rv-chat .cs{display:flex;gap:6px;justify-content:center}#rv-chat .cs button{min-width:44px;min-height:44px;border-radius:10px;border:1px solid #d8ccb5;background:#fff;font-size:16px;cursor:pointer}#rv-chat .note{font-size:11.5px;opacity:.7}';
    document.head.appendChild(st);
    var fab=document.createElement('button');fab.id='rv-chat-fab';fab.type='button';fab.setAttribute('aria-label',L('Escribinos por chat','Chat with us'));
    fab.innerHTML='<span aria-hidden="true">💬</span><span class="t"></span><span class="d" aria-hidden="true"></span>';document.body.appendChild(fab);
    var box=document.createElement('div');box.id='rv-chat';box.setAttribute('role','dialog');box.setAttribute('aria-modal','false');box.setAttribute('aria-label',L('Chat con el comercio','Chat with the shop'));
    document.body.appendChild(box);var open=false,timer=null,seen=0;
    function paint(keep){var s=API.chatState();var greet=API.chatGreet()||L('¡Hola! Escribinos y te respondemos por acá.','Hi! Write to us and we will answer here.');
      var msgs=s?s.msgs:[];var th='<div class="m out">'+esc(greet)+'</div>'+msgs.map(function(m){return '<div class="m '+(m.d==='in'?'in':m.d==='sys'?'sys':'out')+'">'+esc(m.x)+(m.d!=='sys'?'<small>'+(m.d==='out'&&m.u?esc(m.u)+' · ':'')+new Date(m.ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+'</small>':'')+'</div>';}).join('');
      if(s&&s.csat) th+='<div class="m sys">'+L('¿Cómo te atendimos?','How did we do?')+'</div><div class="cs">'+[1,2,3,4,5].map(function(v){return '<button type="button" data-cs="'+v+'" aria-label="'+v+' de 5">'+v+'★</button>';}).join('')+'</div>';
      if(s&&s.nps) th+='<div class="m sys">'+L('Del 0 al 10, ¿nos recomendarías?','From 0 to 10, would you recommend us?')+'</div><div class="cs" style="flex-wrap:wrap">'+[0,1,2,3,4,5,6,7,8,9,10].map(function(v){return '<button type="button" data-np="'+v+'" aria-label="'+v+' de 10">'+v+'</button>';}).join('')+'</div>';
      var draft=keep&&box.querySelector('#rv-ct')?box.querySelector('#rv-ct').value:'';
      box.innerHTML='<header><span aria-hidden="true">💬</span><b>'+L('Escribinos','Chat with us')+'</b><button type="button" data-x aria-label="'+L('Cerrar','Close')+'">×</button></header><div class="th" aria-live="polite">'+th+'</div>'+
       '<form novalidate>'+(s?'':'<input id="rv-cn" maxlength="60" autocomplete="name" placeholder="'+L('Tu nombre','Your name')+'" aria-label="'+L('Tu nombre','Your name')+'"><input id="rv-cw" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="'+L('WhatsApp (opcional)','WhatsApp (optional)')+'" aria-label="WhatsApp">')+
       '<textarea id="rv-ct" rows="2" maxlength="1500" placeholder="'+L('Escribí tu mensaje…','Type your message…')+'" aria-label="'+L('Mensaje','Message')+'"></textarea><div class="err" role="alert"></div><button class="snd" type="submit">'+L('Enviar','Send')+'</button>'+
       (s?'':'<div class="note">'+L('Usamos tus datos sólo para responderte. La conversación queda guardada en este celular.','We only use your details to reply. The chat is saved on this phone.')+'</div>')+'</form>';
      var ta=box.querySelector('#rv-ct');if(draft)ta.value=draft;var t=box.querySelector('.th');t.scrollTop=t.scrollHeight;seen=msgs.length;fab.classList.remove('new');}
    function poll(){return API.chatPoll().then(function(n){if(n>0){if(open)paint(true);else fab.classList.add('new');}}).catch(function(){});}
    function show(v){open=v;box.style.display=v?'flex':'none';fab.style.display=v?'none':(API.chatOn()?'flex':'none');clearInterval(timer);
      if(v){paint();poll();timer=setInterval(poll,8000);var f=box.querySelector(API.chatState()?'#rv-ct':'#rv-cn');if(f)f.focus();}else{timer=setInterval(poll,60000);}}
    box.addEventListener('click',function(e){if(e.target.closest('[data-x]')){show(false);fab.focus();return;}
      var c=e.target.closest('[data-cs]');if(c){API.chatCsat(+c.dataset.cs).then(function(r){if(r&&r.ok)paint(true);else toast((r&&r.msg)||L('No se pudo enviar.','Could not send.'));});}
      var n=e.target.closest('[data-np]');if(n&&API.chatNps){API.chatNps(+n.dataset.np).then(function(r){if(r&&r.ok)paint(true);else toast((r&&r.msg)||L('No se pudo enviar.','Could not send.'));});}});
    box.addEventListener('keydown',function(e){if(e.key==='Escape'){show(false);fab.focus();}});
    box.addEventListener('submit',function(e){e.preventDefault();var ta=box.querySelector('#rv-ct'),er=box.querySelector('.err'),b=box.querySelector('.snd');var n=box.querySelector('#rv-cn'),w=box.querySelector('#rv-cw');
      b.disabled=true;er.textContent='';API.chatSend(ta.value,n?n.value:'',w?w.value:'').then(function(r){b.disabled=false;if(!r||!r.ok){er.textContent=(r&&r.msg)||L('No se pudo enviar.','Could not send.');return;}ta.value='';paint();}).catch(function(){b.disabled=false;er.textContent=L('No se pudo enviar.','Could not send.');});});
    fab.addEventListener('click',function(){show(true);});
    function tick(){var on=API.chatOn();fab.querySelector('.t').textContent=L('Escribinos','Chat');if(!open)fab.style.display=on?'flex':'none';if(!on&&open)show(false);
      var cb=document.getElementById('cart-bar');var lift=cb&&getComputedStyle(cb).display!=='none';fab.style.bottom=lift?'150px':'76px';}
    tick();setInterval(tick,1500);if(API.chatState()){poll();timer=setInterval(poll,60000);}
    window.RAVE_CHAT_OPEN=function(){show(true);};
  })();
  /* ===== V26.69 · ENVÍO A DOMICILIO CON SEGUIMIENTO (canal digital del reparto) =====
     Si el comercio activó el reparto para el menú: el cliente elige «Envío a domicilio», su zona, deja sus datos y la forma de pago.
     El pedido va CIFRADO al sistema del local (no por WhatsApp), recibe su código de entrega y lo sigue en la app (pestaña Pedidos).
     Los precios los pone el sistema del local al recibirlo. */
  (function(){
    var panel=$('#cart-panel'), totalRow=panel&&panel.querySelector('.cp-total-row'); if(!panel||!totalRow) return;
    var box=document.createElement('div'); box.id='rep-box'; box.hidden=true; panel.insertBefore(box,totalRow);
    var R={on:false,f:{},z:'',pago:'efectivo',ll:null,busy:false};
    function rc(){ try{ var s=API.site(); return s&&s.rep&&s.rep.on?s.rep:null; }catch(e){ return null; } }
    function sub(){ var t=$('#cp-total-val'); if(!t) return 0; return parseInt(String(t.textContent).replace(/[^\d,]/g,'').split(',')[0]||'0',10)||0; }
    function e2(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];}); }
    function fi(id,lb,mx,tp){ return '<label for="'+id+'">'+lb+'</label><input id="'+id+'" maxlength="'+mx+'" '+(tp?'inputmode="'+tp+'"':'')+' autocomplete="off" value="'+e2(R.f[id]||'')+'">'; }
    function keep(){ box.querySelectorAll('input[id^=rp-]').forEach(function(i){ if(i.type!=='radio'&&i.type!=='checkbox') R.f[i.id]=i.value; }); var z=$('#rp-z'); if(z) R.z=z.value; }
    function zona(c){ for(var i=0;i<c.zonas.length;i++) if(c.zonas[i].id===R.z) return c.zonas[i]; return null; }
    function render(){ var c=rc(); var sb=$('#ship-box'); if(!c){ box.hidden=true; box.innerHTML=''; if(sb) sb.style.display=''; return; }
      if(!R.z&&c.zonas.length===1) R.z=c.zonas[0].id;
      var h='<h4 class="sh-h">🛵 '+L('Envío a domicilio','Home delivery')+'</h4><label class="sh-opt"><input type="checkbox" id="rp-on" '+(R.on?'checked':'')+'> '+L('Quiero que me lo lleven (con seguimiento en vivo)','Deliver it to me (live tracking)')+'</label>';
      if(R.on){ var z=zona(c), s=sub();
        h+='<label for="rp-z">'+L('Zona','Area')+'</label><select id="rp-z"><option value="">'+L('Elegí tu zona','Choose your area')+'</option>'+c.zonas.map(function(x){return '<option value="'+e2(x.id)+'" '+(R.z===x.id?'selected':'')+'>'+e2(x.nombre)+' · '+(x.tarifa?money(x.tarifa):L('sin costo','free'))+(x.eta?' · '+e2(x.eta):'')+'</option>';}).join('')+'</select>'
          +fi('rp-nm',L('Nombre de quien recibe','Recipient name'),60)+fi('rp-tl',L('Teléfono / WhatsApp','Phone / WhatsApp'),24,'tel')+fi('rp-dr',L('Calle y número','Street and number'),90)+fi('rp-lc',L('Barrio','Neighbourhood'),60)+fi('rp-rf',L('Referencias (piso, timbre, entre calles)','Notes (floor, bell, cross streets)'),120)
          +'<button type="button" class="sh-loc" id="rp-gps">📍 '+(R.ll?L('Ubicación compartida ✓','Location shared ✓'):L('Compartir mi ubicación (ayuda al repartidor)','Share my location (helps the courier)'))+'</button>'
          +'<div class="sh-opts" role="radiogroup" aria-label="'+L('Forma de pago','Payment')+'"><label class="sh-opt"><input type="radio" name="rp-pg" value="efectivo" '+(R.pago==='efectivo'?'checked':'')+'> 💵 '+L('Efectivo al recibir','Cash on delivery')+'</label><label class="sh-opt"><input type="radio" name="rp-pg" value="digital" '+(R.pago==='digital'?'checked':'')+'> 📱 '+L('QR o transferencia al recibir','QR or transfer on delivery')+'</label></div>'
          +(R.pago==='efectivo'?fi('rp-ab',L('¿Con cuánto pagás? (para llevarte el vuelto)','How much will you pay with? (for change)'),10,'numeric'):(c.alias?'<p class="sh-n">'+L('Alias: ','Alias: ')+'<b>'+e2(c.alias)+'</b></p>':''))
          +'<div class="sh-sum" id="rp-sum" role="status" aria-live="polite">'+(z?'<b>'+L('Envío','Delivery')+':</b> '+(z.tarifa?money(z.tarifa):L('sin costo','free'))+(z.eta?' · '+e2(z.eta):'')+'<br><b>'+L('Total estimado','Estimated total')+':</b> '+money(s+(z.tarifa||0))+(z.minimo&&s<z.minimo?'<br><span class="sh-err">'+L('Compra mínima para esta zona: ','Minimum purchase for this area: ')+money(z.minimo)+'</span>':''):'')+'</div>'
          +'<div class="sh-err" id="rp-err" role="alert" hidden></div><p class="sh-n">'+L('Tu pedido y tus datos viajan cifrados al local. Te damos un código para el repartidor y lo seguís en «Mi tarjeta» → Pedidos.','Your order and details are sent encrypted to the shop. You get a code for the courier and can track it in “My card” → Orders.')+'</p>'; }
      box.innerHTML=h; box.hidden=false; if(sb) sb.style.display=R.on?'none':''; bind(); var bt=$('#btn-send'); if(bt){ if(!bt.dataset.t0) bt.dataset.t0=bt.textContent; bt.textContent=R.on?L('Enviar pedido con envío','Send delivery order'):bt.dataset.t0; } }
    function bind(){ var o=$('#rp-on'); if(o) o.addEventListener('change',function(){ keep(); R.on=o.checked; render(); });
      var z=$('#rp-z'); if(z) z.addEventListener('change',function(){ keep(); render(); });
      box.querySelectorAll('input[name=rp-pg]').forEach(function(r){ r.addEventListener('change',function(){ keep(); R.pago=r.value; render(); }); });
      box.querySelectorAll('input[id^=rp-]').forEach(function(i){ if(i.type!=='radio'&&i.type!=='checkbox') i.addEventListener('input',function(){ R.f[i.id]=i.value; }); });
      var g=$('#rp-gps'); if(g) g.addEventListener('click',function(){ if(!navigator.geolocation){ toast(L('Tu celular no comparte la ubicación.','Location is not available.')); return; } g.textContent=L('Buscando tu ubicación…','Finding your location…');
        navigator.geolocation.getCurrentPosition(function(p){ keep(); R.ll={lat:Math.round(p.coords.latitude*1e6)/1e6,lng:Math.round(p.coords.longitude*1e6)/1e6}; render(); },function(){ keep(); toast(L('No se pudo tomar la ubicación: escribí bien la dirección.','Could not get your location.')); render(); },{enableHighAccuracy:true,timeout:10000}); }); }
    function err(m){ var e=$('#rp-err'); if(e){ e.textContent=m; e.hidden=false; e.scrollIntoView&&e.scrollIntoView({block:'nearest'}); } return true; }
    window.RAVE_SEND_HOOK=function(msg,total,items){ var c=rc(); if(!c||!R.on) return false; if(R.busy) return true; keep();
      var z=zona(c); if(!z) return err(L('Elegí tu zona.','Choose your area.'));
      if(z.minimo&&total<z.minimo) return err(L('La compra mínima para tu zona es ','Minimum purchase for your area is ')+money(z.minimo)+'.');
      var f=R.f; if(String(f['rp-nm']||'').trim().length<2) return err(L('Escribí el nombre de quien recibe.','Enter the recipient name.'));
      if(!/^[\d\s+()-]{6,24}$/.test(String(f['rp-tl']||'').trim())) return err(L('Escribí un teléfono válido.','Enter a valid phone.'));
      if(String(f['rp-dr']||'').trim().length<4&&!R.ll) return err(L('Escribí la calle y el número (o compartí tu ubicación).','Enter street and number (or share your location).'));
      var it=items.filter(function(x){return x.price!==null&&x.qty>0;}).map(function(x){return {id:x.id,q:x.qty};}); if(!it.length) return err(L('Tu pedido está vacío.','Your order is empty.'));
      var ab=String(f['rp-ab']||'').replace(/[^\d]/g,''); var ped={nombre:String(f['rp-nm']).trim(),tel:String(f['rp-tl']).trim(),dir:String(f['rp-dr']||'').trim(),loc:String(f['rp-lc']||'').trim(),ref:String(f['rp-rf']||'').trim(),lat:R.ll?R.ll.lat:null,lng:R.ll?R.ll.lng:null,zona:z.id,items:it,pago:R.pago,abona:ab?+ab:0,cupon:''};
      if(R.pago==='efectivo'&&ped.abona&&ped.abona<total+(z.tarifa||0)) return err(L('El importe con el que pagás es menor al total.','The amount is lower than the total.'));
      R.busy=true; var bt=$('#btn-send'); if(bt) bt.disabled=true; var e=$('#rp-err'); if(e) e.hidden=true;
      Promise.resolve(API.repOrder?API.repOrder(ped):{ok:false}).then(function(r){ R.busy=false; if(bt) bt.disabled=false;
        if(!r||!r.ok){ err((r&&r.msg)||L('No pudimos enviar el pedido. Probá de nuevo o pedí por WhatsApp.','We could not send the order.')); return; }
        window.RAVE_PED_ADD({tok:r.tok,pin:r.pin,n:r.n||'',ts:Date.now(),total:total+(z.tarifa||0),st:'recibido'});
        var cl=$('#btn-clear'); if(cl) cl.click(); R.on=false; R.ll=null; render();
        var cp=$('#cart-overlay'); if(cp) cp.style.display='none';
        try{ window.RAVE_OPEN_APP('ped'); }catch(x){}
        toast(L('¡Pedido enviado! Tu código de entrega es ','Order sent! Your delivery code is ')+r.pin); }).catch(function(){ R.busy=false; if(bt) bt.disabled=false; err(L('No pudimos enviar el pedido (¿hay internet?).','Could not send the order.')); });
      return true; };
    var tv=$('#cp-total-val'); if(tv&&window.MutationObserver) new MutationObserver(function(){ if(R.on){ keep(); var s=$('#rp-sum'); if(s) render(); } }).observe(tv,{childList:true,characterData:true,subtree:true});
    var cb=$('#cart-bar'); if(cb) cb.addEventListener('click',function(){ setTimeout(render,0); });
    window.RAVE_REP_REFRESH=render; render();
  })();
})();
