import re,json
B=lambda f:open(f,encoding='utf8').read()
body=B('build/pub_body.html'); css=B('build/pub_css.html'); fonts=B('build/pub_fonts.html')
extra=B('pub/extra.css'); blocks=B('pub/blocks.html'); pre=B('pub/pre.js'); post=B('pub/post.js')
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
# pre.js antes del script de idioma
k="var lang = 'es';\n  window.RAVE_LANG"
i=body.index(k); j=body.rindex('<script>',0,i)
body=body[:j]+'<script>\n'+pre+'\n</script>\n'+body[j:]
# post.js al final
body=body+'\n<script>\n'+post+'\n</script>\n</body>'
doc='<!doctype html>\n<html lang="es" translate="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>RAVE · Almacén y Licorería</title>\n'+fonts+'\n'+css.replace('</style>',extra+'\n</style>')+'\n</head>\n'+body+'</html>'
open('build/pubdoc.html','w',encoding='utf8').write(doc)
js='const PUB_DOC='+json.dumps(doc,ensure_ascii=False).replace('</','<\\/').replace('<!--','<\\!--').replace('<script','<\\script')+';\n'
open('build/p0-pub.js','w',encoding='utf8').write(js)
print('pubdoc',len(doc))
