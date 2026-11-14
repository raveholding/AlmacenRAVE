import re,json
B=lambda f:open(f,encoding='utf8').read()
body=B('build/pub_body.html'); css=B('build/pub_css.html'); fonts=B('build/pub_fonts.html')
extra=B('pub/extra.css')+'\n'+B('pub/v2.css'); blocks=B('pub/blocks.html'); pre=B('pub/pre.js'); post=B('pub/post.js')
logo=B('build/logo_menu.txt')
import base64
vbb='data:image/webp;base64,'+base64.b64encode(open('assets/vb-banner.webp','rb').read()).decode()
body=B('build/pub_body.html').replace('VB_BANNER_SRC',vbb)
# logo liviano
body,n=re.subn(r'<img class="logo" src="data:image/png;base64,[^"]+"','<img class="logo" src="'+logo+'"',body); assert n==1
# bloques nuevos
mark='<!-- El panel de administrador viejo fue reemplazado'
assert body.count(mark)==1; body=body.replace(mark,blocks+'\n  '+mark)
# alta del club: la versión con nube responde con una Promise (cifra y envía al servidor)
p1="var r = API ? API.clubJoin({ nombre:nombre, whatsapp:whatsDigits, cumple:cumple, comm:comm, dni:dniDigits }) : { ok:false };"
assert body.count(p1)==1
body=body.replace(p1,"var r0 = API ? API.clubJoin({ nombre:nombre, whatsapp:whatsDigits, cumple:cumple, comm:comm, dni:dniDigits }) : { ok:false };\n    Promise.resolve(r0).then(function(r){")
p2="setTimeout(function(){ okMsg.style.display = 'none'; }, 5000);\n  });"
assert body.count(p2)==1
body=body.replace(p2,"setTimeout(function(){ okMsg.style.display = 'none'; }, 5000);\n    }).catch(function(){ errMsg.style.display = 'block'; });\n  });")
# horario de alcohol desde el panel
a="var ALCOHOL_RESTRICTION = { enabled:true, from:7, to:24,"
assert a in body; body=body.replace(a,"var ALCOHOL_RESTRICTION = { enabled:!window.RAVE_NORESTR, from:(window.RAVE_ALCH?window.RAVE_ALCH.from:7), to:(window.RAVE_ALCH?window.RAVE_ALCH.to:24),")
# V26.63: sin venta restringida no se abre el control de edad
g="  if(!ok()) open();"
assert g in body; body=body.replace(g,"  if(window.RAVE_NORESTR){ /* sin control de edad */ } else if(!ok()) open();",1)
# V26.69: el reparto con seguimiento puede tomar el pedido (en vez de abrir WhatsApp) cuando el cliente eligió «envío a domicilio»
hk="    var url = 'https://wa.me/' + (window.RAVE_WA || '5493874574892') + '?text=' + encodeURIComponent(msg);\n    window.open(url, '_blank');"
assert body.count(hk)==1,'falta el envío por WhatsApp del carrito'
body=body.replace(hk,"    if(window.RAVE_SEND_HOOK){ try{ if(window.RAVE_SEND_HOOK(msg, total, ids.map(function(i){ return { id:i, name:cart[i].name, price:cart[i].price, qty:cart[i].qty }; }))) return; }catch(e){} }\n"+hk)
# ===== V26.75 · Tienda premium: búsqueda por marca/categoría, gramaje, deshacer, notas por producto =====
def rp(old,new,n=1):
    global body
    assert body.count(old)==n,('V26.75: no encontré',old[:80],body.count(old))
    body=body.replace(old,new)
rp("  function nombreCompleto(p){ return p.nom + (p.sub ? ' (' + p.sub + ')' : ''); }",
   "  function nombreCompleto(p){ return p.nom + (p.sub ? ' (' + p.sub + ')' : ''); }\n  function rvQ(p){ var s = secs.filter(function(x){ return x.cat === p.cat; })[0]; return [p.nom, p.sub, p.desc, p.grupo, s && (s.nom || s.titulo)].join(' '); }")
rp("(Number(p.precio) || 0) + '\">'","(Number(p.precio) || 0) + '\" data-u=\"' + esc(p.unidad || '') + '\" data-q=\"' + esc(rvQ(p)) + '\">'",3)
rp("  function fmt(n){\n    return '$ ' + n.toLocaleString('es-AR');\n  }",
   "  function fmt(n){\n    return '$ ' + n.toLocaleString('es-AR');\n  }\n  function rvNorm(t){ t = String(t || '').toLowerCase(); try{ t = t.normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); }catch(e){} return t; }")
rp("    var term = (searchInput.value || '').trim().toLowerCase();","    var term = rvNorm((searchInput.value || '').trim());")
rp("        var name = (container.dataset.name || '').toLowerCase();","        var name = rvNorm(container.dataset.q || container.dataset.name);")
rp("        var iname = (item.dataset.name || '').toLowerCase();","        var iname = rvNorm(item.dataset.q || item.dataset.name);")
# historial del carrito (deshacer cualquier cambio), notas y gramaje
rp("  var cart = {}; // id -> {name, price(number|null), qty}",
   "  var cart = {}; // id -> {name, price(number|null), qty, note?, g?}\n"
   "  var undoStack = [];\n"
   "  function rvSnap(lbl, name){ undoStack.push(JSON.stringify(cart)); if(undoStack.length > 40) undoStack.shift(); if(window.RAVE_UNDO_CHANGED) window.RAVE_UNDO_CHANGED(undoStack.length, lbl || '', name || ''); }\n"
   "  window.RAVE_CART = {\n"
   "    items:function(){ return cart; },\n"
   "    canUndo:function(){ return undoStack.length > 0; },\n"
   "    undo:function(){ if(!undoStack.length) return false; cart = JSON.parse(undoStack.pop()); lastCleared = null; syncCatalogUI(); refreshBar(); renderPanel(); if(window.RAVE_UNDO_CHANGED) window.RAVE_UNDO_CHANGED(undoStack.length, 'undo', ''); return true; },\n"
   "    note:function(id, t){ if(cart[id]) cart[id].note = String(t || '').replace(/[\\r\\n\\t]+/g, ' ').slice(0, 120); },\n"
   "    gram:function(id, g, price, name){ if(!cart[id]) return; rvSnap('gram', name); cart[id].g = g; cart[id].price = price; cart[id].name = name; refreshBar(); if(overlay.style.display === 'flex') renderPanel(); }\n"
   "  };")
rp("    if(!cart[id]) cart[id] = { name: name, price: price, qty: 0 };\n    cart[id].qty += delta;",
   "    rvSnap(delta > 0 ? 'add' : ((cart[id] ? cart[id].qty : 0) + delta <= 0 ? 'remove' : 'dec'), name);\n"
   "    if(!cart[id]) cart[id] = { name: name, price: price, qty: 0 };\n    if(el.dataset.g) cart[id].g = el.dataset.g;\n    cart[id].qty += delta;")
rp("    else if(cart[id]){ cart[id].qty += d; if(cart[id].qty <= 0) delete cart[id]; refreshBar(); }",
   "    else if(cart[id]){ rvSnap(d > 0 ? 'add' : (cart[id].qty + d <= 0 ? 'remove' : 'dec'), cart[id].name); cart[id].qty += d; if(cart[id].qty <= 0) delete cart[id]; refreshBar(); }")
rp("    lastCleared = JSON.parse(JSON.stringify(cart));\n    cart = {};",
   "    rvSnap('clear', '');\n    lastCleared = JSON.parse(JSON.stringify(cart));\n    cart = {};")
rp("    if(!lastCleared) return;\n    cart = lastCleared; lastCleared = null;\n    syncCatalogUI(); refreshBar(); renderPanel();",
   "    if(!lastCleared) return;\n    if(window.RAVE_CART && window.RAVE_CART.canUndo()){ window.RAVE_CART.undo(); return; }\n    cart = lastCleared; lastCleared = null;\n    syncCatalogUI(); refreshBar(); renderPanel();")
rp("      row.innerHTML = '<div class=\"cp-main\"><div class=\"cp-name\">' + nm + '</div><div class=\"cp-unit\">' + esc3(unitTxt) + '</div></div>' +",
   "      row.innerHTML = (window.RAVE_CP_THUMB ? window.RAVE_CP_THUMB(id) : '') + '<div class=\"cp-main\"><div class=\"cp-name\">' + nm + '</div><div class=\"cp-unit\">' + esc3(unitTxt) + '</div>' + (window.RAVE_CP_NOTE ? window.RAVE_CP_NOTE(id, it) : '') + '</div>' +")
rp("        lines.push('- ' + it.qty + 'x ' + it.name + ' — a coordinar');\n      }",
   "        lines.push('- ' + it.qty + 'x ' + it.name + ' — a coordinar');\n      }\n      if(it.note) lines.push('   📝 ' + it.note);")
rp("    lines.push('');\n    lines.push('Espero su confirmación, gracias!');",
   "    if(window.RAVE_FREE_LINES) window.RAVE_FREE_LINES(lines, total);\n    if(window.RAVE_CHK_LINES) window.RAVE_CHK_LINES(lines, total);\n    lines.push('');\n    lines.push('Espero su confirmación, gracias!');")
# selector de tema en la barra superior
rp('<span class="st-txt">Compartir</span></button>','<span class="st-txt">Compartir</span></button>\n      <button type="button" class="theme-top" id="theme-btn" aria-label="Cambiar a modo claro"><span aria-hidden="true" id="theme-ic">☀️</span></button>')
# pre.js antes del script de idioma
k="var lang = 'es';\n  window.RAVE_LANG"
i=body.index(k); j=body.rindex('<script>',0,i)
body=body[:j]+'<script>\n'+pre+'\n</script>\n'+body[j:]
# post.js al final
body=body+'\n<script>\n'+post+'\n</script>\n<script>\n'+B('pub/v2.js')+'\n</script>\n</body>'

# V26.75: el modo oscuro deja de seguir sólo al sistema: lo elige el cliente (botón ☀️/🌙, se guarda en el dispositivo; oscuro por defecto)
def darkify(c):
    k='@media (prefers-color-scheme: dark){'
    out='';i=0
    while True:
        j=c.find(k,i)
        if j<0: out+=c[i:]; break
        out+=c[i:j]; p=j+len(k); d=1; q=p
        while d:
            ch=c[q]
            if ch=='{': d+=1
            elif ch=='}': d-=1
            q+=1
        inner=c[p:q-1]; res=[]
        for blk in inner.split('}'):
            if '{' not in blk: continue
            sel,dec=blk.split('{',1); sels=[]
            for x in sel.split(','):
                x=x.strip()
                if not x: continue
                if x==':root' or x=='html': sels.append('html[data-theme=dark]')
                else: sels.append('html[data-theme=dark] '+x)
            res.append(','.join(sels)+'{'+dec+'}')
        out+='\n'.join(res); i=q
    return out
css=darkify(css); extra=darkify(extra)
css=css.replace('color-scheme: light dark;','color-scheme: light;')+''
extra+='\nhtml[data-theme=dark]{color-scheme:dark}\n'
assert 'prefers-color-scheme: dark' not in css+extra
doc='<!doctype html>\n<html lang="es" translate="no" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>RAVE · Almacén y Licorería</title>\n'+fonts+'\n'+css.replace('</style>',extra+'\n</style>')+'\n</head>\n'+body+'</html>'
open('build/pubdoc.html','w',encoding='utf8').write(doc)
js='const PUB_DOC='+json.dumps(doc,ensure_ascii=False).replace('</','<\\/').replace('<!--','<\\!--').replace('<script','<\\script')+';\n'
open('build/p0-pub.js','w',encoding='utf8').write(js)
print('pubdoc',len(doc))
