/* ===== V27.33 · Menú público compacto y orientado a la venta (brief de rediseño UX/UI) =====
   Reordena sin borrar nada de lo que ya funciona (mismos datos, mismo carrito, mismo WhatsApp, mismos legales):
   · encabezado compacto con el horario, banner único de envío gratis y «Armá tu evento» arriba
   · categorías con íconos, Combos/Promos primero; «+ Agregar» grande en cada producto
   · barra del pedido con total, «Ver pedido» y el progreso del envío gratis; el pedido sigue si se recarga la página (misma pestaña)
   · Club destacado con tarjeta de ejemplo (sumarse / ver mi tarjeta), pie compacto con mapa, reseña, WhatsApp y redes, y legales en una ventana
   · créditos de Vincular Business en una línea (se despliegan al tocarla) */
(function(){
  var $=function(s,r){return (r||document).querySelector(s);}, $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
  function L(es,en){return (window.RAVE_LANG&&window.RAVE_LANG()==='en')?en:es;}
  function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function norm(t){ t=String(t||'').toLowerCase(); try{ t=t.normalize('NFD').replace(/[̀-ͯ]/g,''); }catch(e){} return t; }
  var API=null; try{ API=window.parent.RAVE_API; }catch(e){}
  function site(){ try{ return (API&&API.site())||{}; }catch(e){ return {}; } }
  var sheet=$('.sheet'); if(!sheet) return;
  document.documentElement.classList.add('v3');

  /* ---------- 1) encabezado ---------- */
  var header=$('header',sheet);
  function pillToHeader(){ var p=$('#alc-pill'); if(p&&header&&p.parentNode!==header) header.appendChild(p); }
  pillToHeader(); if(window.MutationObserver) new MutationObserver(pillToHeader).observe(sheet,{childList:true,subtree:false});

  /* ---------- 2) «Armá tu evento» debajo del banner ---------- */
  function evMove(){ var ev=$('#ev-block'), pb=$('.promo-banner',sheet); if(!ev||!pb||ev.classList.contains('v3-ev')) return;
    ev.classList.add('v3-ev'); var t=document.createElement('div'); t.className='v3-ev-t'; var h=$('h2',ev), p=$('.club-sub',ev); if(h) t.appendChild(h); if(p){ p.textContent=L('Calculá comida y bebida para tu juntada, con presupuesto al instante.','Food and drinks for your party, with an instant quote.'); t.appendChild(p); }
    ev.insertBefore(t,ev.firstChild); var b=$('.ev-open',ev); if(b) b.textContent=L('Calcular','Plan it'); pb.parentNode.insertBefore(ev,pb.nextSibling); }
  evMove();

  /* ---------- 3) categorías: íconos y Combos/Promos primero ---------- */
  var EM=[[/combo|promo|oferta/,'🔥'],[/vino/,'🍷'],[/cervez/,'🍺'],[/sin alcohol|gaseos|bebida|jugo|agua/,'🥤'],[/panader|pan\b/,'🥖'],[/fiambre|picada|queso/,'🧀'],[/golosin|snack|dulce/,'🍫'],[/almacen|drugstore|despensa/,'🛒'],[/limpieza|perfum/,'🧴']];
  function chips(){ var cf=$('#cat-filter'); if(!cf) return; $$('.cat-chip',cf).forEach(function(c){ if($('.v3-em',c)||c.dataset.cat==='all') return; var n=norm(c.textContent);
      for(var i=0;i<EM.length;i++){ if(EM[i][0].test(n)){ var s=document.createElement('span'); s.className='v3-em'; s.setAttribute('aria-hidden','true'); s.textContent=EM[i][1]; c.insertBefore(s,c.firstChild); break; } } });
    var all=$('.cat-chip[data-cat="all"]',cf), promo=$$('.cat-chip',cf).filter(function(c){ return /combo|promo|oferta/.test(norm(c.textContent)); })[0];
    if(all&&promo&&all.nextElementSibling!==promo) cf.insertBefore(promo,all.nextElementSibling); }
  chips(); var cfo=$('#cat-filter'); if(cfo&&window.MutationObserver) new MutationObserver(function(m){ if(m.some(function(x){ return x.type==='childList'&&x.addedNodes.length; })) chips(); }).observe(cfo,{childList:true});

  /* ---------- 4) botones accesibles en las tarjetas ---------- */
  function labels(){ $$('.card,.row,.featured').forEach(function(el){ var n=el.dataset.name||''; var p=$('.qty-btn.plus',el), m=$('.qty-btn.minus',el);
      if(p&&!p.getAttribute('aria-label')) p.setAttribute('aria-label',L('Agregar ','Add ')+n); if(m&&!m.getAttribute('aria-label')) m.setAttribute('aria-label',L('Quitar uno de ','Remove one ')+n); }); }
  labels(); var cat=$('#catalogo-menu'); if(cat&&window.MutationObserver) new MutationObserver(labels).observe(cat,{childList:true});

  /* ---------- 5) barra del pedido + envío gratis + pedido guardado ---------- */
  var bar=$('#cart-bar'), KEY='rave.pub.cart';
  function money(v){ return '$ '+Math.round(+v||0).toLocaleString('es-AR'); }
  function freeTxt(){ var s=null; try{ s=window.RAVE_FREE_STATE&&window.RAVE_FREE_STATE(); }catch(e){} if(!s) return null; var z=s.e.zona||L('tu zona','your area');
    if(s.ok) return {ok:true,t:'🎉 '+L('¡Tenés ENVÍO GRATIS en '+z+'!','You get FREE delivery in '+z+'!'),pr:1};
    var a=[]; if(s.faltaC) a.push(s.faltaC+' '+(s.faltaC===1?'combo':'combos')); if(s.faltaV) a.push(s.faltaV+' '+(s.faltaV===1?L('vino','wine'):L('vinos','wines')));
    return {ok:false,t:'🚚 '+L('Agregá '+a.join(' o ')+' más y tenés ENVÍO GRATIS','Add '+a.join(' or ')+' more for FREE delivery'),pr:s.pr}; }
  var painting=false;
  function paintBar(){ if(!bar||painting) return; painting=true; try{ paintBar0(); }finally{ painting=false; } }
  function paintBar0(){ var vis=bar.style.display==='flex'; if(document.body.classList.contains('v3-cart')!==vis) document.body.classList.toggle('v3-cart',vis);
    var r=$('.cb-right',bar); if(r&&!$('.v3-go',r)){ var g=document.createElement('span'); g.className='v3-go'; g.textContent=L('Ver pedido ›','View order ›'); r.appendChild(g); }
    var f=$('.v3-free',bar); var ft=freeTxt(); if(!ft){ if(f) f.remove(); return; }
    if(!f){ f=document.createElement('div'); f.className='v3-free'; f.setAttribute('aria-live','polite'); bar.appendChild(f); }
    var cls='v3-free'+(ft.ok?' ok':''), h=esc(ft.t)+'<i aria-hidden="true"><b style="width:'+Math.round((ft.pr||0)*100)+'%"></b></i>';
    if(f.className!==cls) f.className=cls; if(f.getAttribute('data-h')!==h){ f.setAttribute('data-h',h); f.innerHTML=h; } }
  function saveCart(){ try{ var c=window.RAVE_CART&&window.RAVE_CART.items(); if(!c) return; if(!Object.keys(c).length) sessionStorage.removeItem(KEY); else sessionStorage.setItem(KEY,JSON.stringify({t:Date.now(),c:c})); }catch(e){} }
  function navReload(){ try{ var w=window.parent; if(w.__rvCartRestored) return false; w.__rvCartRestored=1; var e=w.performance.getEntriesByType('navigation')[0]; return !!e&&(e.type==='reload'||e.type==='back_forward'); }catch(e){ return false; } }
  function restoreCart(){ if(!navReload()) return; try{ var x=JSON.parse(sessionStorage.getItem(KEY)||'null'); if(!x||!x.c||Date.now()-x.t>12*3600e3||!window.RAVE_CART||!window.RAVE_CART.restore) return;
      var ok={}; $$('[data-id]',$('#catalogo-menu')||sheet).forEach(function(el){ ok[el.dataset.id]=1; }); var c={};
      Object.keys(x.c).forEach(function(id){ var it=x.c[id]; if(ok[id]&&it&&it.qty>0&&it.qty<1000) c[id]={name:String(it.name||'').slice(0,120),price:it.price===null?null:+it.price,qty:Math.floor(it.qty),note:it.note?String(it.note).slice(0,120):undefined,g:it.g}; });
      if(Object.keys(c).length) window.RAVE_CART.restore(c); }catch(e){} }
  if(bar&&window.MutationObserver){ new MutationObserver(function(){ if(painting) return; paintBar(); saveCart(); }).observe(bar,{attributes:true,attributeFilter:['style'],childList:true,characterData:true,subtree:true}); }
  setTimeout(function(){ restoreCart(); paintBar(); },0);

  /* mensaje de WhatsApp: si no se completó entrega y pago, deja el lugar para escribirlos */
  window.RAVE_MSG_END=function(lines){ if(lines.some(function(l){ return /ENTREGA|Direcci[oó]n/.test(l); })) return;
    lines.push(''); lines.push('📍 Dirección de entrega: '); lines.push('💳 Forma de pago (efectivo / transferencia): '); };

  /* ---------- 6) Club plegado ---------- */
  (function(){ var form=$('#club-form'), join=form&&form.closest('.club-block'), loy=$('#loyalty-block'); if(!join) return;
    if(getComputedStyle(join).display==='none') return;
    var cp=$('#coupons-block'); var s=site(), cl=s.club||{}, has=false; try{ has=!!localStorage.getItem('rave.card'); }catch(e){}
    /* V27.38 · Club destacado (como los menús de Sistema VB): beneficios reales a la izquierda y TARJETA DE EJEMPLO a la derecha */
    var shop=String(s.title||(($('header .brand-title')||{}).textContent)||'').replace(/\s*digital$/i,'').trim();
    var g=Math.max(2,Math.min(20,+cl.goal||10)), n=Math.min(g-1,Math.max(1,Math.round(g*0.7))), rw=cl.reward&&!/a definir/i.test(cl.reward)?String(cl.reward):'';
    var hasCp=!!(cp&&getComputedStyle(cp).display!=='none'&&cp.textContent.trim().length>20), hasPush=!!(s.push&&(s.push.on||s.push===true));
    var ben=[['🎁',L('Sumá sellos','Collect stamps'),rw?L('Cada compra suma un sello. Con '+g+' te llevás ','Every purchase adds a stamp. '+g+' stamps = ')+esc(rw)+'.':L('Cada compra suma un sello y canjeás premios.','Every purchase adds a stamp.')],
      ['🎟️',L('Cupones de socio','Member coupons'),hasCp?L('Promos y códigos que sólo reciben los socios del Club.','Promos and codes only for members.'):L('Promos y códigos exclusivos para socios por WhatsApp.','Exclusive promos and codes for members.')],
      ['📲',L('Tu tarjeta en el celular','Your card on your phone'),L('Instalá la app del Club: ves tus sellos y tus beneficios cuando quieras.','Install the Club app to see your stamps any time.')],
      ['⚡',L('Pedís más rápido','Faster orders'),L('Tus datos quedan guardados y repetís tus pedidos en segundos.','Your details are saved for quicker orders.')]];
    var dots=''; for(var i=0;i<g;i++){ var on=i<n, last=i===g-1; dots+='<i class="'+(on?'on':'')+(last&&!on?' gift':'')+'">'+(on?'✓':(last?'🎁':(i+1)))+'</i>'; }
    var mini=document.createElement('section'); mini.id='club-mini'; mini.className='club-block'; mini.setAttribute('aria-labelledby','club-h');
    mini.innerHTML='<div class="ch-l"><div class="ch-k">✦ CLUB '+esc(shop.toUpperCase())+'</div><h2 id="club-h">'+L('Registrate gratis y empezá a ganar en cada compra','Join for free and earn with every purchase')+'</h2>'
      +'<p class="ch-p">'+L('Con tu tarjeta sumás sellos, recibís cupones de socio y pedís más rápido.','Collect stamps, get member coupons and order faster.')+'</p>'
      +'<div class="ch-ben">'+ben.map(function(b){ return '<div class="ch-b"><span class="ch-i" aria-hidden="true">'+b[0]+'</span><div><b>'+b[1]+'</b><small>'+b[2]+'</small></div></div>'; }).join('')+'</div>'
      +'<div class="v3-row"><button type="button" class="'+(has?'':'pri')+'" data-club="join">👤 '+L('Crear mi cuenta gratis','Create my free account')+'</button><button type="button" class="'+(has?'pri':'')+'" data-club="card">'+L('Ya soy socio: ver mi tarjeta','I am a member: my card')+'</button></div></div>'
      +'<div class="ch-r" aria-label="'+L('Tarjeta de ejemplo','Sample card')+'"><div class="ch-card"><div class="ch-ct"><div><small>'+L('TARJETA DE EJEMPLO','SAMPLE CARD')+'</small><b>'+L('Sofía · Socia del Club','Sofia · Club member')+'</b></div>'+(shop?'<span class="ch-lv">★ '+esc(shop)+'</span>':'')+'</div>'
      +'<div class="ch-st"><div class="ch-sth"><span>'+L('Tus sellos','Your stamps')+'</span><span>'+n+' / '+g+'</span></div><div class="ch-dots" style="grid-template-columns:repeat('+Math.min(5,g)+',1fr)">'+dots+'</div></div>'
      +'<div class="ch-bx"><div class="ch-x1"><small>'+L('TU PREMIO','YOUR REWARD')+'</small><b>'+(rw?esc(rw):L('Un regalo del Club','A Club gift'))+'</b></div><div class="ch-x2"><small>'+L('TE FALTAN','TO GO')+'</small><b>'+(g-n)+' '+L(g-n===1?'sello':'sellos',g-n===1?'stamp':'stamps')+'</b></div></div></div>'
      +'<p class="ch-ej">'+L('Es un ejemplo: tu tarjeta real se crea al registrarte.','This is a sample: your real card is created when you join.')+'</p></div>';
    var more=document.createElement('div'); more.id='club-more'; more.hidden=true;
    join.parentNode.insertBefore(mini,join); mini.parentNode.insertBefore(more,mini.nextSibling); more.appendChild(join); if(loy) more.appendChild(loy);
    if(cp) mini.parentNode.insertBefore(cp,mini);
    mini.addEventListener('click',function(e){ var b=e.target.closest('[data-club]'); if(!b) return; more.hidden=false; var t=b.dataset.club==='card'&&loy?loy:join; setTimeout(function(){ t.scrollIntoView({behavior:'smooth',block:'start'}); },30); });
    if(/^#(club|tarjeta)/.test(location.hash)||(window.parent&&/^#(club|tarjeta)/.test(window.parent.location.hash))) more.hidden=false; })();

  /* ---------- 7) ventanas (legales, Wi-Fi) ---------- */
  function dialog(id,title,node){ var d=$('#'+id); if(!d){ d=document.createElement('div'); d.id=id; d.className='v3-dlg'; d.hidden=true; d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true'); d.setAttribute('aria-label',title);
      d.innerHTML='<div class="v3-box"><div class="v3-top"><h3>'+esc(title)+'</h3><button type="button" class="v3-x" aria-label="'+L('Cerrar','Close')+'">✕</button></div></div>'; document.body.appendChild(d);
      d.addEventListener('click',function(e){ if(e.target===d||e.target.closest('.v3-x')) close(d); }); d.addEventListener('keydown',function(e){ if(e.key==='Escape') close(d); }); }
    if(node&&node.parentNode!==$('.v3-box',d)) $('.v3-box',d).appendChild(node); return d; }
  var lastFocus=null;
  function open(d,focus){ lastFocus=document.activeElement; d.hidden=false; document.documentElement.style.overflow='hidden'; setTimeout(function(){ var f=focus||$('.v3-x',d); if(f) f.focus(); },30); }
  function close(d){ d.hidden=true; document.documentElement.style.overflow=''; if(lastFocus&&lastFocus.focus) lastFocus.focus(); }
  var legal=$('#legal-block'), dLegal=legal?dialog('v3-legal',L('Términos, privacidad y derechos','Terms, privacy and rights'),legal):null;
  var wifiP=$('.wifi-panel'), dWifi=null; var s0=site(); if(wifiP&&s0.wifi&&s0.wifi.on) dWifi=dialog('v3-wifi','Wi-Fi',wifiP);

  /* ---------- 8) pie compacto ---------- */
  (function(){ var ft=$('footer',sheet); if(!ft) return; var s=site();
    var team=$('#team-access-btn'), lang=$('.lang-toggle');
    var mapA=$('.map-panel a.info-btn'), revA=$('.review-panel a.info-btn');
    var mapU=s.mapUrl||(mapA&&mapA.href)||(s.address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s.address):'');
    var revU=s.reviewUrl||(revA&&revA.href)||''; var wa=String(s.wa||window.RAVE_WA||'').replace(/\D/g,'');
    var addr=s.address||''; var ttl=String(s.title||(($('header .brand-title')||{}).textContent)||'').replace(/\s*digital$/i,'');
    /* V27.44 · bloque «Dónde estamos»: mapa a la izquierda y, al lado, Reseñas arriba y WhatsApp abajo (misma altura que el mapa) */
    var emb=$('.map-panel .map-embed iframe'), loc=null, acts='';
    if(emb&&!$('#v3-loc')){ loc=document.createElement('section'); loc.id='v3-loc'; loc.setAttribute('aria-label',L('Dónde estamos','Where we are'));
      var rs=$('.review-panel .info-sub'), rh=$('.review-panel h2');
      loc.innerHTML='<div class="vl-map"></div><div class="vl-side">'
        +'<div class="vl-card vl-rev"><div class="vl-stars" aria-hidden="true">★★★★★</div><b>'+esc(rh?rh.textContent.trim():L('Reseñas en Google','Google reviews'))+'</b><small>'+esc(rs?rs.textContent.trim():L('Contanos cómo te atendimos.','Tell us about your visit.'))+'</small>'
        +(revU?'<a href="'+esc(revU)+'" target="_blank" rel="noopener noreferrer">⭐ '+L('Dejar reseña en Google','Review us on Google')+'</a>':'')+'</div>'
        +(wa?'<div class="vl-card vl-wa"><div class="vl-ic" aria-hidden="true">💬</div><b>'+L('¿Tenés una consulta?','Any questions?')+'</b><small>'+L('Escribinos y te respondemos por WhatsApp.','Message us on WhatsApp.')+'</small><a href="https://wa.me/'+wa+'?text='+encodeURIComponent(L('Hola! ','Hi! '))+'" target="_blank" rel="noopener noreferrer">'+L('Escribir por WhatsApp','Chat on WhatsApp')+'</a></div>':'')+'</div>';
      var mb=$('.vl-map',loc); mb.appendChild(emb); emb.removeAttribute('height'); emb.setAttribute('title',L('Mapa: ','Map: ')+(s.address||ttl));
      if(addr||mapU) mb.insertAdjacentHTML('beforeend','<div class="vl-addr"><span>📍 '+esc(addr)+'</span>'+(mapU?'<a href="'+esc(mapU)+'" target="_blank" rel="noopener noreferrer">'+L('Cómo llegar','Directions')+' ›</a>':'')+'</div>');
      ft.parentNode.insertBefore(loc,ft); }
    else { if(mapU) acts+='<a href="'+esc(mapU)+'" target="_blank" rel="noopener noreferrer">📍 '+L('Cómo llegar','Directions')+'</a>';
      if(wa) acts+='<a class="wa" href="https://wa.me/'+wa+'?text='+encodeURIComponent(L('Hola! ','Hi! '))+'" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>';
      if(revU) acts+='<a href="'+esc(revU)+'" target="_blank" rel="noopener noreferrer">⭐ '+L('Dejar reseña','Leave a review')+'</a>'; }
    if(dWifi) acts+='<button type="button" data-v3="wifi">📶 Wi-Fi</button>';
    var soc=(s.social||[]).filter(function(x){ return x&&/^https:\/\//.test(x.url||''); }).slice(0,6).map(function(x){ var ic=(s.icons||{})[x.k]; var svg=typeof ic==='string'&&/^<svg[\s>]/.test(ic)&&!/<script|on\w+=/i.test(ic)?ic:'🔗';
      return '<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(x.label||x.k)+'">'+svg+'</a>'; }).join('');
    ft.classList.add('v3-foot');
    ft.innerHTML='<div class="v3-fb">'+esc(ttl.toUpperCase())+'</div><div>'+esc((typeof s.sub==='string'?s.sub:'')||(($('header .brand-sub')||{}).textContent)||'')+(addr?' · '+esc(addr):'')+'</div>'
      +(acts?'<div class="v3-acts">'+acts+'</div>':'')+(soc?'<div class="v3-soc">'+soc+'</div>':'')
      +'<div class="v3-links">'+(dLegal?'<button type="button" data-v3="legal">'+L('Términos y privacidad','Terms & privacy')+'</button><button type="button" data-v3="arrep">'+L('Botón de arrepentimiento','Cancellation button')+'</button>':'')+'</div>'
      +'<p class="v3-small"><b>🔞 '+L('Prohibida su venta a menores de 18 años. Beber con moderación.','Sale to minors under 18 is prohibited. Drink responsibly.')+'</b></p>'
      +'<p class="v3-small">🧾 '+L('Los precios publicados incluyen impuestos; el total se confirma por WhatsApp.','Prices include taxes; the total is confirmed on WhatsApp.')+'</p>';
    if(lang) ft.appendChild(lang); if(team) ft.appendChild(team);
    var dc=$('.dev-credit'); if(dc){ dc.classList.add('v3-col'); var b=document.createElement('button'); b.type='button'; b.className='v3-dev'; b.setAttribute('aria-expanded','false');
      b.innerHTML=L('Desarrollado por ','Developed by ')+'<b>VINCULAR BUSINESS</b> · '+L('ver más','more'); ft.appendChild(b);
      var fine=document.createElement('p'); fine.className='v3-small v3-vb'; fine.innerHTML='“Tu idea, en buenas manos.” · <a href="https://wa.me/5493874484132?text='+encodeURIComponent('Hola Vincular Business! Vi un menú digital de Vincular Business y quiero un sistema para mi negocio.')+'" target="_blank" rel="noopener noreferrer">(387) 4484132</a> · <a href="mailto:vincularbusiness@gmail.com">vincularbusiness@gmail.com</a>'; ft.appendChild(fine);
      b.addEventListener('click',function(){ var o=!dc.classList.contains('open'); dc.classList.toggle('open',o); b.setAttribute('aria-expanded',String(o)); if(o) setTimeout(function(){ dc.scrollIntoView({behavior:'smooth'}); },30); }); }
    ft.addEventListener('click',function(e){ var b=e.target.closest('[data-v3]'); if(!b) return; var k=b.dataset.v3;
      if(k==='legal'&&dLegal) open(dLegal); else if(k==='arrep'&&dLegal){ open(dLegal,$('#arrep-btn')); var ab=$('#arrep-btn'); if(ab){ ab.scrollIntoView({block:'center'}); } } else if(k==='wifi'&&dWifi) open(dWifi); }); })();
})();
