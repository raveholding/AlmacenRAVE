/* ===== V26.75 · TIENDA PREMIUM =====
   Sobre el menú de siempre (mismos datos del POS, mismo carrito, mismo WhatsApp) suma:
   · modo oscuro / claro elegido por el cliente (oscuro por defecto, se guarda en el dispositivo)
   · píldora en vivo del horario de venta de alcohol (America/Argentina/Salta)
   · imágenes ilustrativas (rotuladas) para los productos que todavía no tienen foto — no son fotos del producto
   · gramaje para lo que se vende por kilo (100 g · 250 g · 500 g · 1 kg · a coordinar), con el precio proporcional en vivo
   · sugerencias mientras se escribe en el buscador (nombre, marca, categoría)
   · en el pedido: «Deshacer último cambio», barra de envío gratis (regla del comercio), nota por producto,
     sugerencias para completar el pedido y entrega + pago guiados (retiro / envío, efectivo con vuelto, transferencia, Mercado Pago)
   · banner «Instalá la app»
   Nada de esto inventa datos: precios, productos, alias y reglas salen del panel del comercio. */
(function(){
  var API=null; try{ API=window.parent.RAVE_API; }catch(e){}
  var $=function(s,r){ return (r||document).querySelector(s); };
  var $$=function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function L(es,en){ return (window.RAVE_LANG&&window.RAVE_LANG()==='en')?en:es; }
  function money(p){ return '$ '+Math.round(p).toLocaleString('es-AR'); }
  function site(){ try{ return API?API.site():{}; }catch(e){ return {}; } }
  /* menú publicado antes de V26.75 (sin «tienda»): se usan los valores del comercio por defecto (la regla de su banner) */
  var TDEF={envGratis:{zona:'el macrocentro de Salta',combos:2,vinos:3,palabras:['vino','tinto','malbec']},chk:{zonaEnvio:'Salta Capital',alias:'',titular:'',mp:true},xsell:true,inst:true};
  function tienda(){ var t=site().tienda; return t===undefined?TDEF:(t||{envGratis:null,chk:null,xsell:false,inst:false}); }
  function cat(){ try{ return API?API.catalog():{secciones:[],productos:[]}; }catch(e){ return {secciones:[],productos:[]}; } }
  function norm(t){ t=String(t||'').toLowerCase(); try{ t=t.normalize('NFD').replace(/[̀-ͯ]/g,''); }catch(e){} return t; }
  function cart(){ return window.RAVE_CART?window.RAVE_CART.items():{}; }
  function cardOf(id){ return document.querySelector('.sheet [data-id="'+(window.CSS&&CSS.escape?CSS.escape(id):String(id).replace(/"/g,''))+'"]'); }
  function copy(t){ if(navigator.clipboard&&navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(function(){}); var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); return Promise.resolve(); }
  function toast(t){ var el=$('#rv-toast'); if(!el) return; el.textContent=t; el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(function(){ el.classList.remove('show'); },2400); }

  /* ---------- 1) tema oscuro / claro ---------- */
  var root=document.documentElement;
  function paintTheme(){ var b=$('#theme-btn'), ic=$('#theme-ic'), dark=root.getAttribute('data-theme')!=='light';
    if(ic) ic.textContent=dark?'☀️':'🌙';
    if(b){ b.setAttribute('aria-label',dark?L('Cambiar a modo claro','Switch to light mode'):L('Cambiar a modo oscuro','Switch to dark mode')); b.title=b.getAttribute('aria-label'); }
    var mt=$('meta[name=theme-color]'); if(!mt){ mt=document.createElement('meta'); mt.name='theme-color'; document.head.appendChild(mt); } mt.content=dark?'#161412':'#fbfaf7'; }
  function setTheme(t){ root.setAttribute('data-theme',t); try{ localStorage.setItem('rave.tema',t); }catch(e){} if(window.RAVE_CONTRAST) window.RAVE_CONTRAST(); paintTheme(); }
  var tb=$('#theme-btn'); if(tb) tb.addEventListener('click',function(){ setTheme(root.getAttribute('data-theme')==='light'?'dark':'light'); });
  paintTheme();

  /* ---------- 2) píldora del horario de alcohol ---------- */
  var bar=$('#toolbar'), pill=null;
  function hh(n){ n=+n||0; return (n%24<10?'0':'')+(n%24)+':00'; }
  function paintPill(){ if(window.RAVE_NORESTR||!window.RAVE_ALC||!window.RAVE_ALC.enabled){ if(pill) pill.hidden=true; return; }
    if(!pill){ pill=document.createElement('div'); pill.id='alc-pill'; pill.setAttribute('role','status'); pill.setAttribute('aria-live','polite'); if(bar) bar.insertBefore(pill,bar.firstChild); else return; }
    var R=window.RAVE_ALC, closed=document.body.classList.contains('alc-closed'); pill.hidden=false; pill.className=closed?'off':'on';
    pill.innerHTML='<span class="dot" aria-hidden="true"></span>'+(closed
      ?L('Horario restringido · Venta de bebidas alcohólicas pausada hasta las '+hh(R.from)+' hs','Restricted hours · Alcohol sales paused until '+hh(R.from))
      :L('Venta de alcohol habilitada · '+hh(R.from)+' a '+hh(R.to)+' hs','Alcohol sales open · '+hh(R.from)+' to '+hh(R.to))); }
  paintPill();
  if(window.MutationObserver) new MutationObserver(paintPill).observe(document.body,{attributes:true,attributeFilter:['class']});

  /* ---------- 3) imágenes ilustrativas, gramaje y datos para el buscador ---------- */
  var ICONS={
    bebida:'<path d="M54 18h12v16c0 4 8 8 8 20v44a6 6 0 0 1-6 6H52a6 6 0 0 1-6-6V54c0-12 8-16 8-20z"/><path d="M50 64h20" stroke-width="3"/><path d="M84 52h18l-2 22a7 7 0 0 1-7 6h0a7 7 0 0 1-7-6z"/><path d="M93 80v18M86 98h14"/>',
    pan:'<path d="M18 74c0-18 20-32 42-32s42 14 42 32c0 6-4 10-10 10H28c-6 0-10-4-10-10z"/><path d="M38 52l6 12M56 46l2 14M76 50l-4 12"/>',
    miel:'<path d="M40 40h40v6c8 4 10 12 10 20v26a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8V66c0-8 2-16 10-20z"/><path d="M38 30h44v10H38z"/><path d="M48 70l12-8 12 8v14l-12 8-12-8z"/>',
    tabaco:'<path d="M60 22c22 12 30 34 24 58-14-2-28-12-32-30S50 26 60 22z"/><path d="M60 26c-2 22 2 42 22 54"/><path d="M30 98h60"/>',
    snack:'<path d="M36 24h48l-6 76H42z"/><path d="M36 24l6-6h36l6 6M44 52h32M46 70h28"/>',
    dulce:'<rect x="30" y="38" width="60" height="44" rx="6"/><path d="M30 60h60M50 38v44M70 38v44"/>',
    fiambre:'<circle cx="54" cy="64" r="28"/><circle cx="54" cy="64" r="16"/><path d="M84 46l16-8v40l-16-8"/>',
    almacen:'<path d="M26 50h68l-8 46H34z"/><path d="M42 50l10-24M78 50L68 26"/><path d="M46 66v16M60 66v16M74 66v16"/>'
  };
  function kind(name,sec){ var n=norm(name+' '+(sec||''));
    if(/empanad|tarta|pizza|pan\b|panader|medialun|factura|sandwich|budin/.test(n)) return 'pan';
    if(/miel|mermelad|dulce de leche/.test(n)) return 'miel';
    if(/tabac|celulosa|filtro|papel|blunt|parafern|cigarr/.test(n)) return 'tabaco';
    if(/papas|snack|chizit|mani\b|nachos|palitos/.test(n)) return 'snack';
    if(/chocolat|ferrero|alfajor|caramel|golosin|bombon/.test(n)) return 'dulce';
    if(/fiambre|jamon|queso|salame|mortadel|bondiola|picada/.test(n)) return 'fiambre';
    if(/vino|fernet|gin\b|vodka|ron\b|whisk|cerveza|champag|gancia|campari|aperitiv|bebida|jugo|gaseosa|coca|sprite|agua|promo/.test(n)) return 'bebida';
    return 'almacen'; }
  var ilusCache={};
  function ilus(k){ if(ilusCache[k]) return ilusCache[k];
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><radialGradient id="g" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#3a342c"/><stop offset="1" stop-color="#1c1a17"/></radialGradient></defs><rect width="120" height="120" rx="14" fill="url(#g)"/><g fill="none" stroke="#c9963e" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">'+ICONS[k]+'</g></svg>';
    return (ilusCache[k]='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)); }
  var GRAMS=[100,250,500,1000,'c'];
  function glbl(g){ return g==='c'?L('A coordinar','To be arranged'):(g>=1000?(g/1000)+' kg':g+' g'); }
  function secName(c){ var s=(cat().secciones||[]).filter(function(x){ return x.cat===c; })[0]; return s?(s.nom||s.titulo||''):''; }
  function setGram(el,g,fromUser){ var pkg=+el.dataset.pkg||0, base=el.dataset.base||el.dataset.name||'';
    var price=g==='c'?null:Math.round(pkg*g/1000), name=base+' · '+(g==='c'?'cantidad a coordinar':glbl(g));
    el.dataset.g=String(g); el.dataset.price=price===null?'':String(price); el.dataset.name=name;
    $$('.gr-chip',el).forEach(function(b){ var on=b.dataset.g===String(g); b.classList.toggle('on',on); b.setAttribute('aria-checked',on?'true':'false'); });
    var calc=$('.gr-calc',el); if(calc) calc.textContent=g==='c'?L('El peso y el precio se coordinan por WhatsApp','Weight and price arranged by WhatsApp'):glbl(g)+' = '+money(price);
    if(fromUser&&cart()[el.dataset.id]&&window.RAVE_CART) window.RAVE_CART.gram(el.dataset.id,String(g),price,name); }
  function enhance(){
    $$('.sheet [data-id]').forEach(function(el){
      if(el.dataset.rv2) return; el.dataset.rv2='1';
      var sec=el.closest('[data-cat]'), sn=sec?secName(sec.getAttribute('data-cat')):'';
      /* imagen ilustrativa cuando el producto no tiene foto */
      var noimg=$('.c-noimg, .row-noimg',el), has=$('img',el);
      if(noimg||(!has&&el.classList.contains('featured'))){ var k=kind(el.dataset.name||'',sn);
        var im=document.createElement('img'); im.className='rv-ilus'+(el.classList.contains('featured')?' feat-img':''); im.src=ilus(k); im.alt=L('Imagen ilustrativa','Illustrative image'); im.decoding='async'; im.dataset.ilus='1';
        if(noimg){ noimg.parentNode.replaceChild(im,noimg); } else { el.insertBefore(im,el.firstChild); }
        var tag=document.createElement('span'); tag.className='rv-ilus-tag'; tag.textContent=L('Imagen ilustrativa','Illustrative image'); im.parentNode.appendChild(tag); el.classList.add('has-ilus'); }
      /* gramaje: productos que se venden por kilo */
      if(el.dataset.u==='kg'&&!el.dataset.pkg){ el.dataset.pkg=el.dataset.price||'0'; el.dataset.base=el.dataset.name||''; el.classList.add('by-kg');
        var row=document.createElement('div'); row.className='gr-row'; row.setAttribute('role','radiogroup'); row.setAttribute('aria-label',L('Cantidad','Amount'));
        row.innerHTML=GRAMS.map(function(g){ return '<button type="button" class="gr-chip" role="radio" data-g="'+g+'" aria-checked="false">'+esc(glbl(g))+'</button>'; }).join('')+'<div class="gr-calc" aria-live="polite"></div>';
        var q=$('.qty-row',el); el.insertBefore(row,q||null);
        var inC=cart()[el.dataset.id]; setGram(el,inC&&inC.g?(inC.g==='c'?'c':+inC.g):250,false); }
    }); }
  document.addEventListener('click',function(e){ var b=e.target.closest?e.target.closest('.gr-chip'):null; if(!b) return; e.stopPropagation(); var el=b.closest('[data-id]'); if(!el) return; setGram(el,b.dataset.g==='c'?'c':+b.dataset.g,true); },true);
  enhance();
  var mr=window.RAVE_MENU_REFRESH; window.RAVE_MENU_REFRESH=function(){ if(mr) mr.apply(this,arguments); enhance(); };

  /* ---------- 4) sugerencias del buscador ---------- */
  var si=$('#search-input'), sw=$('#search-wrap'), sg=null;
  if(si&&sw){ sg=document.createElement('div'); sg.id='search-sug'; sg.setAttribute('role','listbox'); sg.hidden=true; sw.appendChild(sg); si.setAttribute('aria-controls','search-sug'); si.setAttribute('autocomplete','off');
    si.addEventListener('input',function(){ var t=norm(si.value.trim()); if(t.length<2){ sg.hidden=true; return; }
      var seen={}, hits=$$('.sheet [data-id]').filter(function(el){ var id=el.dataset.id; if(seen[id]) return false; seen[id]=1; return norm(el.dataset.q||el.dataset.name).indexOf(t)!==-1; }).slice(0,6);
      if(!hits.length){ sg.hidden=true; return; }
      sg.innerHTML=hits.map(function(el){ var im=$('img',el); return '<button type="button" role="option" data-go="'+esc(el.dataset.id)+'">'+(im?'<img src="'+esc(im.src)+'" alt="">':'')+'<span>'+esc(el.dataset.base||el.dataset.name)+'</span><b>'+(el.dataset.price?money(+el.dataset.price):'')+'</b></button>'; }).join(''); sg.hidden=false; });
    sg.addEventListener('click',function(e){ var b=e.target.closest('[data-go]'); if(!b) return; sg.hidden=true; var el=cardOf(b.dataset.go); if(el){ el.scrollIntoView({block:'center',behavior:'smooth'}); el.classList.add('rv-flash'); setTimeout(function(){ el.classList.remove('rv-flash'); },1600); } });
    document.addEventListener('click',function(e){ if(sg&&!sg.hidden&&!e.target.closest('#search-wrap')) sg.hidden=true; });
    si.addEventListener('keydown',function(e){ if(e.key==='Escape') sg.hidden=true; }); }

  /* ---------- 5) el pedido ---------- */
  var panel=$('#cart-panel'), items=$('#cart-items'), totalRow=panel&&$('.cp-total-row',panel), head=panel&&$('.cp-head',panel);
  if(!panel||!items||!totalRow) return;
  function prod(id){ var P=cat().productos||[]; for(var i=0;i<P.length;i++) if(P[i].id===id) return P[i]; return null; }
  function sub(){ var c=cart(), t=0; Object.keys(c).forEach(function(id){ if(c[id].price!==null) t+=c[id].price*c[id].qty; }); return t; }
  function totalEst(){ var d=$('#cp-disc-row span:last-child'); if(d){ var v=parseInt(String(d.textContent).replace(/[^\d]/g,''),10); if(v>=0) return v; } return sub(); }
  function isEmpty(){ return !Object.keys(cart()).length; }

  /* 5a) deshacer */
  var ub=document.createElement('button'); ub.type='button'; ub.id='cp-undo'; ub.className='cp-undo'; ub.hidden=true;
  if(head) head.parentNode.insertBefore(ub,head.nextSibling);
  ub.addEventListener('click',function(){ if(window.RAVE_CART) window.RAVE_CART.undo(); hideUT(); });
  var ut=document.createElement('div'); ut.id='rv-undo-toast'; ut.setAttribute('role','status'); ut.setAttribute('aria-live','polite'); ut.hidden=true; document.body.appendChild(ut);
  function hideUT(){ ut.hidden=true; clearTimeout(ut._t); }
  ut.addEventListener('click',function(e){ if(e.target.closest('button')&&window.RAVE_CART){ window.RAVE_CART.undo(); hideUT(); } });
  function paintUndo(){ ub.textContent='↶ '+L('Deshacer último cambio','Undo last change'); ub.hidden=!(window.RAVE_CART&&window.RAVE_CART.canUndo()); }
  window.RAVE_UNDO_CHANGED=function(n,lbl,name){ paintUndo();
    if(lbl==='remove'||lbl==='clear'){ ut.innerHTML='<span>'+esc(lbl==='clear'?L('Vaciaste el pedido','Order cleared'):L('Quitaste ','Removed ')+name)+'</span><button type="button">'+L('Deshacer','Undo')+'</button>'; ut.hidden=false; clearTimeout(ut._t); ut._t=setTimeout(hideUT,6000); }
    else if(lbl==='undo'){ hideUT(); toast(L('Listo: volvió el cambio anterior','Done: previous change restored')); } };

  /* 5b) envío gratis */
  var fb=document.createElement('div'); fb.id='free-bar'; fb.hidden=true; fb.setAttribute('role','status'); fb.setAttribute('aria-live','polite');
  panel.insertBefore(fb,items);
  function freeState(){ var e=tienda().envGratis; if(!e) return null; var c=cart(), co=0, vi=0, pal=e.palabras||[];
    Object.keys(c).forEach(function(id){ var p=prod(id); if(!p) return; var q=c[id].qty, sn=norm(secName(p.cat)), nm=norm(p.nom+' '+(p.sub||''));
      if(/promo|combo/.test(sn)) co+=q;
      if(pal.some(function(w){ return new RegExp('(^|[^a-z])'+norm(w).replace(/[^a-z0-9 ]/g,'')+'s?([^a-z]|$)').test(nm); })) vi+=q; });
    var okC=e.combos>0&&co>=e.combos, okV=e.vinos>0&&vi>=e.vinos;
    var pr=Math.max(e.combos>0?co/e.combos:0, e.vinos>0?vi/e.vinos:0);
    return {ok:okC||okV, co:co, vi:vi, faltaC:e.combos>0?Math.max(0,e.combos-co):0, faltaV:e.vinos>0?Math.max(0,e.vinos-vi):0, pr:Math.min(1,pr), e:e, por:okC?'combos':(okV?'vinos':'')}; }
  function pl(n,s,p){ return n+' '+(n===1?s:p); }
  function paintFree(){ var s=freeState(); if(!s||isEmpty()){ fb.hidden=true; return; } fb.hidden=false;
    var z=s.e.zona||L('tu zona','your area'), t;
    if(s.ok) t='🎉 '+L('¡Tu pedido tiene Envío Gratis en '+z+'!','Your order gets Free Delivery in '+z+'!');
    else { var a=[]; if(s.faltaC) a.push(L(pl(s.faltaC,'combo','combos'),pl(s.faltaC,'combo','combos'))); if(s.faltaV) a.push(L(pl(s.faltaV,'vino','vinos'),pl(s.faltaV,'wine','wines')));
      var f1=s.faltaC||s.faltaV; t='🚚 '+L('¡Te falta'+(f1===1?'':'n')+' '+a.join(' o ')+' para Envío Gratis en '+z+'!','Add '+a.join(' or ')+' for Free Delivery in '+z+'!'); }
    fb.className=s.ok?'ok':'';
    fb.innerHTML='<div class="fb-t">'+esc(t)+'</div><div class="fb-bar" aria-hidden="true"><i style="width:'+Math.round(s.pr*100)+'%"></i></div>'; }
  window.RAVE_FREE_LINES=function(lines){ var s=freeState(); if(!s||!s.ok) return; lines.push('🎁 Califica para envío gratis en '+(s.e.zona||'la zona')+' ('+(s.por==='combos'?s.co+' combos':s.vi+' vinos')+'): se confirma con la dirección.'); };

  /* 5c) foto y nota de cada producto del pedido */
  var openNote={};
  window.RAVE_CP_THUMB=function(id){ var el=cardOf(id), im=el&&$('img',el); return im?'<img class="cp-th" src="'+esc(im.src)+'" alt="" loading="lazy">':'<span class="cp-th" aria-hidden="true"></span>'; };
  window.RAVE_CP_NOTE=function(id,it){ var n=it.note||'';
    if(openNote[id]) return '<input class="cp-nt-in" data-nt="'+esc(id)+'" maxlength="120" value="'+esc(n)+'" placeholder="'+esc(L('Ej.: feteado fino, bien fría, cortado para picada','E.g. thinly sliced, well chilled'))+'" aria-label="'+esc(L('Nota para este producto','Note for this item'))+'">';
    return '<button type="button" class="cp-nt" data-nt="'+esc(id)+'">'+(n?'📝 '+esc(n)+' <small>'+L('editar','edit')+'</small>':'＋ '+L('Agregar nota','Add a note'))+'</button>'; };
  items.addEventListener('click',function(e){ var b=e.target.closest?e.target.closest('button.cp-nt'):null; if(!b) return; var id=b.dataset.nt; openNote[id]=1;
    var row=b.closest('.cp-item'); var tmp=document.createElement('div'); tmp.innerHTML=window.RAVE_CP_NOTE(id,cart()[id]||{}); b.parentNode.replaceChild(tmp.firstChild,b); var inp=$('.cp-nt-in',row); if(inp) inp.focus(); });
  items.addEventListener('input',function(e){ var i=e.target; if(i.classList&&i.classList.contains('cp-nt-in')&&window.RAVE_CART) window.RAVE_CART.note(i.dataset.nt,i.value); });
  items.addEventListener('focusout',function(e){ var i=e.target; if(!(i.classList&&i.classList.contains('cp-nt-in'))) return; var id=i.dataset.nt; setTimeout(function(){ if(document.activeElement===i) return; delete openNote[id]; var tmp=document.createElement('div'); tmp.innerHTML=window.RAVE_CP_NOTE(id,cart()[id]||{}); if(i.parentNode) i.parentNode.replaceChild(tmp.firstChild,i); },0); });
  items.addEventListener('keydown',function(e){ if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('cp-nt-in')){ e.preventDefault(); e.target.blur(); } });

  /* 5d) sugerencias para completar el pedido */
  var xs=document.createElement('div'); xs.id='xsell'; xs.hidden=true; panel.insertBefore(xs,$('.cp-coupon',panel)||totalRow);
  function paintXs(){ if(!tienda().xsell||isEmpty()){ xs.hidden=true; return; }
    var c=cart(), secs=cat().secciones||[], alcSecs={}, inSec={};
    secs.forEach(function(s){ if(s.alc) alcSecs[s.cat]=1; });
    Object.keys(c).forEach(function(id){ var p=prod(id); if(p) inSec[p.cat]=1; });
    var closed=document.body.classList.contains('alc-closed');
    var cand=(cat().productos||[]).filter(function(p){ return !c[p.id]&&!p.agotado&&p.precio>0&&p.unidad!=='kg'&&!(closed&&alcSecs[p.cat])&&cardOf(p.id); });
    cand.sort(function(a,b){ var sa=(inSec[a.cat]?1:0)-(inSec[b.cat]?1:0); if(sa) return sa; var sl=(alcSecs[a.cat]?1:0)-(alcSecs[b.cat]?1:0); if(sl) return sl; var ia=(a.img?0:1)-(b.img?0:1); if(ia) return ia; return a.precio-b.precio; });
    cand=cand.slice(0,8); if(!cand.length){ xs.hidden=true; return; }
    xs.hidden=false;
    xs.innerHTML='<div class="xs-h">'+L('¿Le sumás algo más?','Anything else?')+'</div><div class="xs-row">'+cand.map(function(p){ var el=cardOf(p.id), im=el&&$('img',el);
      return '<div class="xs-it"><img src="'+esc(im?im.src:ilus(kind(p.nom,secName(p.cat))))+'" alt=""><div class="xs-n">'+esc(p.nom)+'</div><div class="xs-p">'+money(p.precio)+'</div><button type="button" class="xs-add" data-add="'+esc(p.id)+'" aria-label="'+esc(L('Agregar ','Add ')+p.nom)+'">+ '+L('Agregar','Add')+'</button></div>'; }).join('')+'</div>'; }
  xs.addEventListener('click',function(e){ var b=e.target.closest?e.target.closest('[data-add]'):null; if(!b) return; var el=cardOf(b.dataset.add), plus=el&&$('.qty-btn.plus',el); if(plus){ plus.click(); if(window.RAVE_CART_RERENDER) window.RAVE_CART_RERENDER(); toast(L('Agregado al pedido','Added to your order')); } });

  /* 5e) entrega y pago guiados (si el comercio no usa «Tienda con envíos» ni el reparto con seguimiento) */
  var ck=document.createElement('div'); ck.id='chk-box'; ck.hidden=true; panel.insertBefore(ck,totalRow.nextSibling);
  var K={modo:'retiro',pago:'efectivo',f:{}};
  function chkOn(){ var s=site(), t=tienda(); if(!t.chk) return null; if(s.ship&&s.ship.mode==='tienda') return null; if(s.rep&&s.rep.on) return null; return t.chk; }
  function keepK(){ $$('input[data-k]',ck).forEach(function(i){ K.f[i.dataset.k]=i.value; }); }
  function fld(k,lb,mx,mode,ph){ return '<label for="ck-'+k+'">'+lb+'</label><input id="ck-'+k+'" data-k="'+k+'" maxlength="'+mx+'"'+(mode?' inputmode="'+mode+'"':'')+(ph?' placeholder="'+esc(ph)+'"':'')+' autocomplete="off" value="'+esc(K.f[k]||'')+'">'; }
  function opt(n,v,cur,txt){ return '<label class="ck-opt'+(v===cur?' on':'')+'"><input type="radio" name="'+n+'" value="'+v+'"'+(v===cur?' checked':'')+'> '+txt+'</label>'; }
  function vuelto(){ var ab=parseInt(String(K.f.abona||'').replace(/[^\d]/g,''),10); if(!ab) return null; return ab-totalEst(); }
  function paintChk(){ var c=chkOn(); if(!c||isEmpty()){ ck.hidden=true; ck.innerHTML=''; return; } keepK();
    var s=site(), fs=freeState(), h='<h4 class="ck-h">'+L('Entrega y pago','Delivery & payment')+'</h4>';
    h+='<div class="ck-opts" role="radiogroup" aria-label="'+esc(L('Modalidad de entrega','Delivery method'))+'">'+opt('ck-modo','retiro',K.modo,'🏪 '+L('Retiro en el local','Pick up at the shop')+(s.address?' <small>('+esc(String(s.address).split(',')[0])+')</small>':''))+opt('ck-modo','envio',K.modo,'🛵 '+L('Envío a domicilio','Home delivery')+(c.zonaEnvio?' <small>('+esc(c.zonaEnvio)+')</small>':''))+'</div>';
    if(K.modo==='envio'){ h+=fld('dir',L('Dirección (calle y número)','Address (street and number)'),90,'','')+fld('ref',L('Referencias (barrio, piso, timbre, entre calles)','Notes (area, floor, bell)'),120,'','');
      if(fs&&fs.ok) h+='<p class="ck-ok">✅ '+esc(L('Calificás para envío gratis en '+(fs.e.zona||'la zona')+' (se confirma con la dirección).','You qualify for free delivery in '+(fs.e.zona||'the area')+'.'))+'</p>'; }
    h+='<div class="ck-opts" role="radiogroup" aria-label="'+esc(L('Medio de pago','Payment method'))+'">'+opt('ck-pago','efectivo',K.pago,'💵 '+L('Efectivo','Cash'))+opt('ck-pago','transferencia',K.pago,'🏦 '+L('Transferencia','Bank transfer'))+(c.mp?opt('ck-pago','mp',K.pago,'📱 Mercado Pago'):'')+'</div>';
    if(K.pago==='efectivo'){ h+=fld('abona',L('¿Con cuánto abonás? (opcional, para el vuelto)','How much will you pay with? (optional)'),10,'numeric',L('Ej.: 20000','E.g. 20000')); var v=vuelto();
      h+='<p class="ck-v" id="ck-v" aria-live="polite">'+(v===null?'':(v<0?'<span class="ck-err">'+L('Es menos que el total estimado ('+money(totalEst())+').','Less than the estimated total.')+'</span>':L('Tu vuelto: ','Your change: ')+'<b>'+money(v)+'</b>'))+'</p>'; }
    else if(K.pago==='transferencia'){ h+=c.alias?'<div class="ck-alias"><span>'+L('Alias','Alias')+': <b>'+esc(c.alias)+'</b>'+(c.titular?'<br><small>'+esc(c.titular)+'</small>':'')+'</span><button type="button" id="ck-copy">'+L('Copiar alias','Copy alias')+'</button></div>':'<p class="ck-n">'+L('Te pasamos el alias por WhatsApp cuando confirmemos el pedido.','We send you the alias by WhatsApp when we confirm.')+'</p>'; }
    else h+='<p class="ck-n">'+L('Te enviamos el link de pago de Mercado Pago por WhatsApp al confirmar el pedido.','We send you the Mercado Pago payment link by WhatsApp.')+'</p>';
    h+=fld('nom',L('Tu nombre (opcional)','Your name (optional)'),60,'','')+'<div class="ck-err" id="ck-err" role="alert" hidden></div>';
    ck.innerHTML=h; ck.hidden=false; }
  ck.addEventListener('change',function(e){ var i=e.target; if(i.name==='ck-modo'){ keepK(); K.modo=i.value; paintChk(); } else if(i.name==='ck-pago'){ keepK(); K.pago=i.value; paintChk(); } });
  ck.addEventListener('input',function(e){ var i=e.target; if(!i.dataset||!i.dataset.k) return; K.f[i.dataset.k]=i.value; if(i.dataset.k==='abona'){ var v=vuelto(), p=$('#ck-v'); if(p) p.innerHTML=v===null?'':(v<0?'<span class="ck-err">'+L('Es menos que el total estimado ('+money(totalEst())+').','Less than the estimated total.')+'</span>':L('Tu vuelto: ','Your change: ')+'<b>'+money(v)+'</b>'); } });
  ck.addEventListener('click',function(e){ if(e.target.id==='ck-copy'){ var c=chkOn(); if(c&&c.alias) copy(c.alias).then(function(){ toast(L('Alias copiado','Alias copied')); }); } });
  function ckErr(m){ var e=$('#ck-err'); if(e){ e.textContent=m; e.hidden=false; e.scrollIntoView&&e.scrollIntoView({block:'nearest'}); } }
  var send=$('#btn-send');
  if(send) send.addEventListener('click',function(ev){ if(!chkOn()||ck.hidden) return; keepK(); var m='';
    if(K.modo==='envio'&&String(K.f.dir||'').trim().length<4) m=L('Escribí la dirección de entrega.','Enter the delivery address.');
    else if(K.pago==='efectivo'&&vuelto()!==null&&vuelto()<0) m=L('El importe con el que abonás es menor al total.','The amount is lower than the total.');
    if(m){ ev.stopImmediatePropagation(); ev.preventDefault(); ckErr(m); } },true);
  window.RAVE_CHK_LINES=function(lines){ var c=chkOn(); if(!c||ck.hidden) return; keepK(); var s=site(), f=K.f; lines.push('');
    if(K.modo==='retiro') lines.push('🏪 ENTREGA: Retiro en el local'+(s.address?' ('+s.address+')':''));
    else { lines.push('🛵 ENTREGA: Envío a domicilio'+(c.zonaEnvio?' ('+c.zonaEnvio+')':'')); lines.push('📍 Dirección: '+String(f.dir||'').trim()); if(String(f.ref||'').trim()) lines.push('🧭 Referencias: '+String(f.ref).trim()); }
    if(K.pago==='efectivo'){ var v=vuelto(); lines.push('💵 PAGO: Efectivo'+(v!==null&&v>=0?' · abono con '+money(v+totalEst())+' · vuelto '+money(v):'')); }
    else if(K.pago==='transferencia') lines.push('🏦 PAGO: Transferencia'+(c.alias?' (alias '+c.alias+')':' (pásenme el alias)'));
    else lines.push('📱 PAGO: Mercado Pago (envíenme el link de pago)');
    if(String(f.nom||'').trim()) lines.push('👤 Nombre: '+String(f.nom).trim()); };

  /* 5f) todo se repinta cuando cambia el pedido */
  function paintAll(){ paintUndo(); paintFree(); paintXs(); var a=document.activeElement; if(!(a&&ck.contains(a))) paintChk(); }
  if(window.MutationObserver){ new MutationObserver(paintAll).observe(items,{childList:true}); var tv=$('#cp-total-val'); if(tv) new MutationObserver(function(){ var p=$('#ck-v'); if(p&&!ck.hidden){ var a=$('#ck-abona'); if(a) a.dispatchEvent(new Event('input',{bubbles:true})); } }).observe(tv,{childList:true,characterData:true,subtree:true}); }
  ['#lang-es','#lang-en'].forEach(function(s){ var b=$(s); if(b) b.addEventListener('click',function(){ setTimeout(function(){ paintTheme(); paintPill(); paintAll(); $$('.rv-ilus-tag').forEach(function(t){ t.textContent=L('Imagen ilustrativa','Illustrative image'); }); $$('.by-kg').forEach(function(el){ var g=el.dataset.g; if(g){ $$('.gr-chip',el).forEach(function(b){ b.textContent=glbl(b.dataset.g==='c'?'c':+b.dataset.g); }); setGram(el,g==='c'?'c':+g,false); } }); },0); }); });
  paintAll();

  /* ---------- 6) banner «Instalá la app» ---------- */
  (function(){ var ra=null; try{ ra=window.parent.RAVE_APP||null; }catch(e){}
    if(!tienda().inst||!ra||!ra.can||!ra.can()||(ra.installed&&ra.installed())) return;
    try{ if(localStorage.getItem('rave.inst.no')==='1') return; }catch(e){}
    var b=document.createElement('div'); b.id='inst-bar'; b.setAttribute('role','region'); b.setAttribute('aria-label',L('Instalar la app','Install the app'));
    b.innerHTML='<span class="ib-ic" aria-hidden="true">📲</span><span class="ib-t">'+L('Instalá la App de RAVE para pedir más rápido y ver tus sellos','Install the RAVE app to order faster and see your stamps')+'</span><button type="button" class="ib-go">'+L('Instalar App','Install app')+'</button><button type="button" class="ib-x" aria-label="'+L('Ahora no','Not now')+'">✕</button>';
    var sh=$('.sheet')||document.body; sh.insertBefore(b,sh.firstChild);
    b.querySelector('.ib-go').addEventListener('click',function(){ try{ Promise.resolve(ra.install()).then(function(){ if(ra.installed&&ra.installed()) b.remove(); }); }catch(e){} });
    b.querySelector('.ib-x').addEventListener('click',function(){ try{ localStorage.setItem('rave.inst.no','1'); }catch(e){} b.remove(); });
  })();
})();
