import re,json,sys
s=open('/tmp/mref/index.html',encoding='utf8').read()
def cut(a,b,incl=True):
    i=s.index(a); j=s.index(b,i)+(len(b) if incl else 0); return s[i:j]
css=cut('<style>\n  :root{','</style>')
fonts='<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">'
endm='window.RAVE_applyHours = applyHours; window.RAVE_ALC = ALCOHOL_RESTRICTION;\n})();\n</script>'
body=s[s.index('<body>'):s.index(endm)+len(endm)]
def rep(old,new,cnt=1):
    global body
    assert body.count(old)>=1,('falta: '+old[:60])
    if cnt==1: assert body.count(old)==1,('no único: '+old[:60]+' x'+str(body.count(old)))
    body=body.replace(old,new)
# ---- logo (se guarda aparte para el panel y el ticket)
m=re.search(r'<img class="logo" src="(data:image/png;base64,[^"]+)"',body)
open('build/logo_public.txt','w').write(m.group(1))
# ---- catálogo: sale del panel (RAVE_API); el archivo ya no lleva datos duplicados
i=body.index('var MENU_PUBLICADO = /*__CATALOGO_DATOS__*/')
j=body.index('/*__CATALOGO_FIN__*/')
body=body[:i]+'var MENU_PUBLICADO = {"secciones":[],"productos":[]};\n'+body[j:]
rep("function catalogo(){\n    try{","function catalogo(){\n    try{ var pa = window.parent && window.parent.RAVE_API; if(pa){ var cc = pa.catalog(); if(valido(cc)) return cc; } }catch(e){}\n    try{")
# sin nube propia en la demo (no se toca la base real del cliente)
body=re.sub(r"var NUBE = \{ url:'https://[^']+', key:'[^']+', slug:'rave' \};","var NUBE = { url:'__sin-nube-en-la-demo__', key:'', slug:'rave' };",body)
assert 'supabase.co' not in body
# querystring: el iframe es srcdoc, la dirección real se la pasa el panel
body=body.replace("new URLSearchParams(location.search)","new URLSearchParams(window.__QS || '')")
# whatsapp del comercio configurable
body=body.replace("'https://wa.me/5493874574892?text='","'https://wa.me/' + (window.RAVE_WA || '5493874574892') + '?text='")
rep("var WA_NUMBER = '5493874574892';","var WA_NUMBER = window.RAVE_WA || '5493874574892';")
# planilla de Google del cliente: NO se usa en la demo (la URL y el token estaban en el HTML público)
body=re.sub(r"var SHEET_WEBHOOK_URL = '[^']*';","var SHEET_WEBHOOK_URL = '';",body)
body=re.sub(r"var SHEET_TOKEN = '[^']*';[^\n]*","var SHEET_TOKEN = '';",body)
# alta del club: va al panel (clientes), con consentimientos separados
a=body.index("var clientes = getClientes();")
b=body.index("okMsg.style.display = 'block';")
body=body[:a]+"""var API = null; try{ API = window.parent.RAVE_API; }catch(e){}
    var comm = !!(document.getElementById('club-comm') && document.getElementById('club-comm').checked);
    var r = API ? API.clubJoin({ nombre:nombre, whatsapp:whatsDigits, cumple:cumple, comm:comm }) : { ok:false };
    var e2 = document.getElementById('club-error2');
    if(!r || !r.ok){
      if(e2){ e2.textContent = (r && r.msg) || ''; e2.style.display = (r && r.msg) ? 'block' : 'none'; }
      if(!(r && r.msg)) errMsg.style.display = 'block';
      return;
    }
    if(e2) e2.style.display = 'none';
    try{ if(r.cardId) localStorage.setItem('rave.card', r.cardId); }catch(e){}
    if(window.RAVE_CARD_REFRESH) window.RAVE_CARD_REFRESH();
    """+body[b:]
# casilla opcional de promociones (consentimiento separado) y mensaje dinámico
rep('<button type="button" id="arco-btn" class="arco-link">','<label class="club-consent club-consent2"><input type="checkbox" id="club-comm"><span id="club-comm-txt">Acepto recibir promociones y cupones por WhatsApp (opcional, podés darte de baja cuando quieras).</span></label>\n      <button type="button" id="arco-btn" class="arco-link">')
rep('<div class="club-error" id="club-error">','<div class="club-error" id="club-error2" role="alert"></div>\n      <div class="club-error" id="club-error">')
# idioma: gancho para los bloques nuevos
rep("['#pm-close','Keep browsing']\n  ];","['#pm-close','Keep browsing']\n  ].concat(window.RAVE_T_EXTRA || []);")
rep("function setLang(l){\n    lang = l;","function setLang(l){\n    lang = l; window.RAVE_LANGV = l;")
rep("var lang = 'es';\n  try {","var lang = 'es';\n  window.RAVE_LANG = function(){ return lang; };\n  try {")
# carrito: cupón, total con cupón y registro del pedido como SOLICITUD
rep('<div class="cp-total-row">\n      <span>Total estimado</span>','<div class="cp-coupon"><label for="cp-coupon-in" id="cp-coupon-lbl">¿Tenés un cupón?</label><div class="cp-coupon-row"><input id="cp-coupon-in" maxlength="24" autocomplete="off" placeholder="CÓDIGO"><button type="button" id="cp-coupon-ok">Aplicar</button></div><div id="cp-coupon-msg" role="status"></div></div>\n    <div class="cp-total-row">\n      <span>Total estimado</span>')
rep("totalValEl.textContent = fmt(total);\n    }","totalValEl.textContent = fmt(total);\n    }\n    window.RAVE_CART_TOTAL = total; if(window.RAVE_COUPON_RENDER) window.RAVE_COUPON_RENDER(total);")
rep("lines.push('Subtotal estimado: ' + fmt(total));","lines.push('Subtotal estimado: ' + fmt(total));\n    if(window.RAVE_COUPON_LINES) window.RAVE_COUPON_LINES(lines, total);")
rep("var msg = lines.join('\\n');","var msg = lines.join('\\n');\n    try{ if(window.RAVE_ORDER_LOG) window.RAVE_ORDER_LOG(ids.map(function(i){ return { id:i, name:cart[i].name, price:cart[i].price, qty:cart[i].qty }; }), total); }catch(e){}")
# redes: se arman desde la configuración del panel
a=body.index('<ul class="social-grid">'); b=body.index('</ul>',a)+5
social_html=body[a:b]
icons={}
for m in re.finditer(r'<li>\s*(?:<!--.*?-->\s*)?<a href="([^"]+)"[^>]*>\s*(<svg.*?</svg>)\s*<span><b>([^<]+)</b>',social_html,re.S):
    icons[m.group(3).lower()]=m.group(2)
print('iconos',list(icons))
json.dump(icons,open('build/social_icons.json','w'))
body=body[:a]+'<ul class="social-grid" id="social-list"></ul>'+body[b:]
# acceso del equipo / título: van al panel (lo conecta el bloque nuevo)
open('build/pub_body.html','w',encoding='utf8').write(body)
open('build/pub_css.html','w',encoding='utf8').write(css)
open('build/pub_fonts.html','w',encoding='utf8').write(fonts)
print('ok',len(body),len(css))
