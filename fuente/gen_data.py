import json,base64,io
from PIL import Image
d=json.load(open('catalog_real.json'))
imgs={}
prods=[]
def ean13(body12):
    s=sum(int(c)*(3 if i%2 else 1) for i,c in enumerate(body12));return body12+str((10-s%10)%10)
for i,p in enumerate(d['productos']):
    if p['img']: imgs[p['id']]=p['img']
    q={'id':p['id'],'cat':p['cat'],'grupo':p.get('grupo',''),'nom':p['nom'],'sub':p.get('sub',''),'precio':p['precio'],'destacado':bool(p.get('destacado')),'desc':p.get('desc','')}
    q['bc']=ean13('779999'+str(100000+i))   # código de barras de PRUEBA (no es del producto real)
    prods.append(q)
# logos
def save_jpeg(im,w,q):
    im=im.convert('RGB');h=round(im.height*w/im.width);im=im.resize((w,h),Image.LANCZOS)
    b=io.BytesIO();im.save(b,'JPEG',quality=q,optimize=True);return b.getvalue(),im
raw,im=save_jpeg(Image.open('build/logo_user.png'),420,85)
logo_menu='data:image/jpeg;base64,'+base64.b64encode(raw).decode()
# ticket: 1 bit, invertido (el original es claro sobre oscuro)
g=Image.open('build/logo_user.png').convert('L')
W=384;H=round(g.height*W/g.width);g=g.resize((W,H),Image.LANCZOS)
bw=g.point(lambda v:0 if v>110 else 255).convert('1')   # claro->negro, fondo oscuro->blanco
b=io.BytesIO();bw.save(b,'PNG',optimize=True)
logo_ticket='data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
bw.convert('L').save('build/logo_ticket_preview.png')
js="/* ===== Datos reales del cliente (catálogo y logo del menú público de RAVE) ===== */\n"
js+="const LOGO_MENU="+json.dumps(logo_menu)+";\nconst LOGO_TICKET="+json.dumps(logo_ticket)+";\n"
js+="const IMGS="+json.dumps(imgs)+";\n"
js+="const SEED_SECS="+json.dumps(d['secciones'],ensure_ascii=False)+";\n"
js+="const SEED_PRODS="+json.dumps(prods,ensure_ascii=False)+";\n"
js+='const SOCIAL_ICONS='+json.dumps(json.load(open('build/social_icons.json')))+';\n'
open('build/p0-data.js','w',encoding='utf8').write(js)
open('build/logo_menu.txt','w').write(logo_menu)
print(len(js),len(logo_menu),len(logo_ticket),len(prods))
