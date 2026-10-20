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
    if(!c){ no.hidden=false; cd.hidden=true; if(id&&canRec){try{localStorage.removeItem('rave.card');}catch(e){}} renderPlans(null); return; }
    no.hidden=true; cd.hidden=false;
    var dots=''; for(var i=0;i<c.goal;i++) dots+='<i class="'+(i<c.stamps?'on':'')+'">'+(i<c.stamps?'★':'')+'</i>';
    var left=Math.max(0,c.goal-c.stamps);
    cd.innerHTML='<div class="loy-card"><h3>'+esc(c.name)+'</h3><div class="loy-sub">'+(c.pending?L('Socio N° en trámite · el negocio la activa en unos segundos','Member # pending · the shop activates it in a few seconds'):L('Socio N° ','Member # ')+esc(c.num))+'</div>'
     +'<div class="loy-stamps" style="grid-template-columns:repeat('+Math.min(c.goal,5)+',1fr)">'+dots+'</div>'
     +'<div class="loy-meta"><span>'+c.stamps+' / '+c.goal+' '+L('sellos','stamps')+'</span><span>'+(left?L('Te faltan '+left,left+' to go'):L('¡Tenés un premio!','You have a reward!'))+'</span></div>'
     +(c.rewards?'<div class="loy-reward">🎁 '+L('Premio disponible: ','Reward available: ')+esc(c.rewardText)+(c.rewards>1?' (x'+c.rewards+')':'')+'</div>':'')
     +(c.member?'<div class="loy-member">⭐ '+esc(c.member.name)+' · '+L('hasta ','until ')+esc(c.member.until)+(c.member.pct?' · '+c.member.pct+'% '+L('de descuento en el mostrador','off at the counter'):'')+'</div>':'')
     +'<div id="loy-codebox"></div>'
     +'<button type="button" class="loy-btn" id="loy-show">'+L('Mostrar mi código para sumar sello','Show my code to get a stamp')+'</button>'
     +'<p class="loy-tip">'+L('Tip: agregá esta página a la pantalla de inicio de tu celular para tener tu tarjeta siempre a mano. Si la perdés, en el mostrador te pueden sumar los sellos con tu DNI.','Tip: add this page to your phone home screen to keep your card at hand. If you lose it, the counter can add your stamps with your ID number.')+'</p>'
     +'<button type="button" class="loy-btn loy-alt" id="loy-save">'+L('Guardar mi tarjeta (por si cambio de celular)','Save my card (in case I change phones)')+'</button><div id="loy-savebox" hidden></div>'
     +'<button type="button" class="loy-link" id="loy-out">'+L('No soy yo / quitar tarjeta de este dispositivo','Not me / remove card from this device')+'</button></div>';
    $('#loy-show').addEventListener('click',showCode);
    $('#loy-save').addEventListener('click',toggleSave);
    $('#loy-out').addEventListener('click',function(){try{localStorage.removeItem('rave.card');}catch(e){} renderCard(); renderCoupons();});
    renderPlans(c);
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
  window.RAVE_CARD_REFRESH=function(){renderCard();renderCoupons();};
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
})();
