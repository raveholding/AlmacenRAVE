/* ===== V26.32 · Contraste automático a partir del color de la marca =====
   --gold-ink : el color de la marca como LETRA (más oscuro sobre fondo claro, más claro en modo oscuro) con contraste ≥ 4,6:1.
   --on-gold  : la letra que va ENCIMA del color de la marca (negra o blanca, la que se lea mejor).
   --vino-ink : lo mismo para el color secundario. Sirve para cualquier marca (RAVE, Kini u otra) y para los dos modos. */
(function(){
  function hex(s){ s=String(s||'').trim(); var m=/^#([0-9a-f]{6})$/i.exec(s); if(m){ var n=parseInt(m[1],16); return [n>>16&255,n>>8&255,n&255]; }
    m=/rgba?\(([^)]+)\)/.exec(s); if(m){ var a=m[1].split(/[ ,\/]+/).map(Number); return [a[0],a[1],a[2]]; } return null; }
  function lum(c){ var f=function(v){ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); }
  function cr(a,b){ var x=lum(a),y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
  function mix(a,b,t){ return [0,1,2].map(function(i){ return Math.round(a[i]+(b[i]-a[i])*t); }); }
  function css(c){ return 'rgb('+c.join(',')+')'; }
  function tune(base,bgs,toward){ for(var t=0;t<=1.0001;t+=0.03){ var c=mix(base,toward,t); if(bgs.every(function(b){return cr(c,b)>=4.6;})) return c; } return toward; }
  function apply(){
    var root=document.documentElement, cs=getComputedStyle(root);
    var dark=false; try{ dark=matchMedia('(prefers-color-scheme: dark)').matches; }catch(e){}
    var g=hex(cs.getPropertyValue('--gold'))||[201,150,62], v=hex(cs.getPropertyValue('--vino'))||[156,59,70];
    var bgs=dark?[[42,39,35],[27,25,23],[36,34,32]]:[[255,255,255],[251,250,247],[253,246,232]];
    var to=dark?[255,255,255]:[0,0,0];
    root.style.setProperty('--gold-ink',css(tune(g,bgs,to)));
    root.style.setProperty('--vino-ink',css(tune(v,bgs,to)));
    var ink=[22,19,16];
    root.style.setProperty('--on-gold',cr(ink,g)>=cr([255,255,255],g)?css(ink):'#ffffff');
  }
  apply(); try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',apply); }catch(e){}
  window.RAVE_CONTRAST=apply;
})();
/* ===== Sistema RAVE · datos del comercio (antes del selector de idioma) ===== */
(function(){
  var API=null; try{ API=window.parent.RAVE_API; }catch(e){}
  if(!API) return;
  var S=API.site();
  window.RAVE_WA=S.wa;
  window.RAVE_ALCH={from:S.alcFrom,to:S.alcTo};
  function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function md(t){return esc(t).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');}
  var $=function(s){return document.querySelector(s);};
  var X=[]; // filas extra de traducción: [selector, inglés, modo]
  function set(sel,es,en,mode){var e=$(sel); if(!e) return; if(!mode) e.innerHTML=es; if(en!=null) X.push([sel,en,mode]);}
  // identidad
  var bt=$('#brand-title'); if(bt) bt.textContent=S.title;
  set('.brand-sub',md(S.sub.es),md(S.sub.en));
  set('.pitch',md(S.pitch.es),md(S.pitch.en));
  var pb=$('.promo-banner'); if(pb){ if(!S.promo.on) pb.style.display='none'; else set('.promo-banner .pt',md(S.promo.es),md(S.promo.en)); }
  var an=$('#alc-notice'); if(an){ var hh=function(h){h=+h; return h>=24?'00:00':(h<10?'0':'')+h+':00';}; var f=hh(S.alcFrom), t=hh(S.alcTo); set('#alc-notice','Venta de bebidas alcohólicas habilitada de '+f+' a '+t+' (Salta). Volvé en ese horario.','Alcohol sales are allowed from '+f+' to '+t+' (Salta time). Please come back during those hours.'); }
  // mapa, reseñas
  var q=encodeURIComponent(S.mapQuery);
  var fr=$('.map-embed iframe'); if(fr) fr.setAttribute('src','https://www.google.com/maps?q='+q+'&output=embed');
  var mp=$('.map-panel .info-sub'); if(mp) mp.textContent=S.address;
  var ml=$('.map-panel a.info-btn'); if(ml) ml.setAttribute('href',S.mapUrl);
  var rl=$('.review-panel a.info-btn'); if(rl) rl.setAttribute('href',S.reviewUrl);
  // Wi-Fi
  var wp=$('.wifi-panel');
  if(wp){ if(!S.wifi.on) wp.style.display='none'; else {
    $('#wifi-ssid').textContent=S.wifi.ssid; $('#wifi-pass').textContent=S.wifi.pass;
    var tg=wp.querySelector('.wifi-tag'); if(tg&&!S.wifi.example) tg.remove();
  } }
  // redes
  var ul=$('#social-list');
  if(ul){ var ic=S.icons||{}; ul.innerHTML=S.social.map(function(s){
    var svg=ic[s.k]||'<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#555"/><path d="M8 12h8M12 8v8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
    return '<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+svg+'<span><b>'+esc(s.label)+'</b><small>'+esc(s.handle)+'</small></span></a></li>';}).join('');
    var sp=$('.social-panel'); if(sp&&!S.social.length) sp.style.display='none'; }
  // pie
  var ft=$('footer'); if(ft){ for(var i=0;i<ft.childNodes.length;i++){var n=ft.childNodes[i]; if(n.nodeType===3&&n.nodeValue.trim()){ n.nodeValue=' '+S.footer.es+' '; X.push(['footer',' '+S.footer.en+' ','text']); break; } } }
  // textos de los bloques nuevos (inglés)
  [['#coupons-block h2','Coupons &amp; perks'],
   ['#coupons-block .club-sub','Type the code in your order (cart) or show it at the counter. One benefit per purchase.'],
   ['#loyalty-block h2','Your loyalty card'],
   ['#loy-sub','Collect a stamp on every purchase and redeem them for Club RAVE rewards.'],
   ['#loy-nocard-txt','Your card is created when you join the Club (form above). If you are already a member on another device, recover it with your WhatsApp and birthday.'],
   ['label[for="loy-wa"]','WhatsApp'],['label[for="loy-bd"]','Birthday'],
   ['#loy-ask','Ask for my card on WhatsApp'],['#loy-err','We could not find a card with those details.'],['#loy-recover','See my card'],
   ['#plans-h','Memberships'],['#plans-sub','Permanent perks for members. Activated at the counter.'],
   ['#legal-block h2','Legal information'],['#legal-sub','Everything you need to know about your purchase and your data.'],
   ['#arrep-btn','↩️ Withdrawal button'],
   ['#cp-coupon-lbl','Got a coupon?'],['#cp-coupon-ok','Apply'],
   ['#club-comm-txt','I agree to receive promotions and coupons via WhatsApp (optional, you can unsubscribe at any time).']
  ].forEach(function(r){X.push(r);});
  window.RAVE_T_EXTRA=X;
})();
