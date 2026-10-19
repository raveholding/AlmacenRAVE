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
    var nt=$('#loy-nocard-txt'); if(nt&&!canRec) nt.textContent=L('Tu tarjeta se crea al sumarte al Club (formulario de arriba) y queda guardada en este celular. Si cambiaste de celular, volvé a anotarte con el mismo WhatsApp y cumpleaños.','Your card is created when you join the Club (form above) and is kept on this phone. If you changed phones, sign up again with the same WhatsApp and birthday.');
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
     +'<button type="button" class="loy-link" id="loy-out">'+L('No soy yo / quitar tarjeta de este dispositivo','Not me / remove card from this device')+'</button></div>';
    $('#loy-show').addEventListener('click',showCode);
    $('#loy-out').addEventListener('click',function(){try{localStorage.removeItem('rave.card');}catch(e){} renderCard(); renderCoupons();});
    renderPlans(c);
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
  window.RAVE_PUB_REFRESH=function(){renderCoupons();renderCard();renderLegal();};
})();
