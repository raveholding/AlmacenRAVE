import re,json
B=lambda f:open(f,encoding='utf8').read()
body=B('build/pub_body.html'); css=B('build/pub_css.html'); fonts=B('build/pub_fonts.html')
extra=B('pub/extra.css'); blocks=B('pub/blocks.html'); pre=B('pub/pre.js'); post=B('pub/post.js')
logo=B('build/logo_menu.txt')
# logo liviano
body,n=re.subn(r'<img class="logo" src="data:image/png;base64,[^"]+"','<img class="logo" src="'+logo+'"',body); assert n==1
# bloques nuevos
mark='<!-- El panel de administrador viejo fue reemplazado'
assert body.count(mark)==1; body=body.replace(mark,blocks+'\n  '+mark)
# alta del club: la versión con nube responde con una Promise (cifra y envía al servidor)
p1="var r = API ? API.clubJoin({ nombre:nombre, whatsapp:whatsDigits, cumple:cumple, comm:comm }) : { ok:false };"
assert body.count(p1)==1
body=body.replace(p1,"var r0 = API ? API.clubJoin({ nombre:nombre, whatsapp:whatsDigits, cumple:cumple, comm:comm }) : { ok:false };\n    Promise.resolve(r0).then(function(r){")
p2="setTimeout(function(){ okMsg.style.display = 'none'; }, 5000);\n  });"
assert body.count(p2)==1
body=body.replace(p2,"setTimeout(function(){ okMsg.style.display = 'none'; }, 5000);\n    }).catch(function(){ errMsg.style.display = 'block'; });\n  });")
# horario de alcohol desde el panel
a="var ALCOHOL_RESTRICTION = { enabled:true, from:7, to:24,"
assert a in body; body=body.replace(a,"var ALCOHOL_RESTRICTION = { enabled:true, from:(window.RAVE_ALCH?window.RAVE_ALCH.from:7), to:(window.RAVE_ALCH?window.RAVE_ALCH.to:24),")
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
