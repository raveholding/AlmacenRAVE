#!/usr/bin/env python3
"""Arma el index.html. Uso: python3 build.py demo|cliente [salida.html]
Variables de entorno (sólo cliente): SUPABASE_URL, SUPABASE_KEY (clave PUBLICABLE), RAVE_SLUG, PUBLIC_URL"""
import sys,os,json,subprocess,re
V=sys.argv[1] if len(sys.argv)>1 else 'demo'
assert V in('demo','cliente','kini')
KINI=V=='kini'
if KINI: V='demo'
out=sys.argv[2] if len(sys.argv)>2 else 'index.html'
B=lambda f:open(f,encoding='utf8').read()
subprocess.check_call(['python3','gen_data.py'],stdout=subprocess.DEVNULL);subprocess.check_call(['python3','assemble.py'],stdout=subprocess.DEVNULL)
url=os.environ.get('SUPABASE_URL','').rstrip('/');key=os.environ.get('SUPABASE_KEY','')
if V=='demo': url='';key=''
assert not re.search(r'service_role|sb_secret_',key),'¡Esa es una clave SECRETA! Usá la clave publicable (sb_publishable_…)'
if url: assert re.fullmatch(r'https://[A-Za-z0-9.-]+(:\d+)?',url),'URL inválida'
slug=os.environ.get('RAVE_SLUG','almacen-rave' if V=='cliente' else '')
pub=os.environ.get('PUBLIC_URL','https://raveholding.github.io/'+('AlmacenRAVE/' if V=='cliente' else 'raveV2/'))
import datetime
if KINI: pub=os.environ.get('PUBLIC_URL','https://raveholding.github.io/KiniDistribuidoraDemo/')
build={'ver':datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M')+' UTC','variant':V,'db':'rave-almacenrave-v1' if V=='cliente' else ('rave-kini-demo-v2' if KINI else 'rave-cliente-v3'),'publicUrl':pub}
if KINI: build['profile']='kini'
cfg='<script>window.RAVE_BUILD=%s;window.RAVE_CLOUD=%s;</script>\n'%(json.dumps(build),json.dumps({'url':url,'key':key,'slug':slug}))
head=B('p1-head.html')
head=head.replace("connect-src 'none'","connect-src "+(url if url else "'none'"))
if V=='cliente':
    head=head.replace('<title>Sistema RAVE · Almacén y Licorería RAVE — Demo</title>','<title>Sistema RAVE · Almacén y Licorería RAVE</title>')
head=head.replace('<style>',cfg+'<style>',1)
parts=['p2-core.js','p2b-sort.js','p3-ops.js','p3b-pos.js','p3c-cash.js','p3f-transfers.js','p3g-paydetail.js','p3h-expediente.js','p3i-rubcash.js','p3j-combos.js','p3k-owner.js','p3l-kini.js','p3m-payacc.js','p3d-assist.js','p3e-saledetail.js','p6-loyalty.js','p6c-custadmin.js','p6d-cardportable.js','p6e-wallet.js','p6b-wholesale.js','p4-mods.js','p4c-compras.js','p4d-compras-ui.js','p4b-online.js','p7a-dash.js','p7-devices.js','p8-legal.js','p9-cloud.js','p9b-arca.js','p9c-tiendanube.js','p5c-menusec.js','p5b-store.js','p5-menu-boot.js']
parts=[p for p in parts if os.path.exists(p)]
import base64
def kini_brand(h):
    # Marca de la demo Kini: logo y colores (se reemplazan con los del cliente cuando lleguen); los créditos de Vincular Business no se tocan
    lg=os.environ.get('KINI_LOGO','assets/kini-logo.webp')
    if os.path.exists(lg):
        mime='image/png' if lg.endswith('.png') else ('image/webp' if lg.endswith('.webp') else ('image/svg+xml' if lg.endswith('.svg') else 'image/jpeg'))
        uri='data:%s;base64,%s'%(mime,base64.b64encode(open(lg,'rb').read()).decode())
    else:
        svg='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" rx="22" fill="#1f3a5f"/><text x="160" y="98" font-family="Arial,Helvetica,sans-serif" font-size="74" font-weight="700" fill="#ffffff" text-anchor="middle">KINI</text><text x="160" y="140" font-family="Arial,Helvetica,sans-serif" font-size="22" letter-spacing="4" fill="#f2b33d" text-anchor="middle">DISTRIBUIDORA</text></svg>'
        uri='data:image/svg+xml;base64,'+base64.b64encode(svg.encode()).decode()
    h=re.sub(r'const LOGO_MENU="[^"]*"','const LOGO_MENU="%s"'%uri,h,count=1)
    h=re.sub(r'const LOGO_TICKET="[^"]*"','const LOGO_TICKET="%s"'%uri,h,count=1)
    c1=os.environ.get('KINI_C1','#1b1b1b');c2=os.environ.get('KINI_C2','#5fd33a');c3=os.environ.get('KINI_C3','#3fa521')
    h=h.replace('--ink:#242220;','--ink:%s;'%c1,1).replace('--gold:#c9963e;','--gold:%s;'%c2,1).replace('--gold2:#a87a28;','--gold2:%s;'%c3,1)
    h=h.replace('style="width:48px;height:27px;object-fit:cover;border-radius:6px"','style="width:40px;height:40px;object-fit:contain;border-radius:50%"')
    h=h.replace('Sistema RAVE','Sistema Kini').replace('alt="RAVE"','alt="Kini Distribuidora"')
    h=re.sub(r'<title>[^<]*</title>','<title>Kini Distribuidora · Demo</title>',h,count=1)
    # menú público (documento del iframe): logo, textos fijos y título
    h=re.sub(r'(class=\\"logo\\" src=\\")data:image/[a-z]+;base64,[A-Za-z0-9+/=]+',lambda m:m.group(1)+uri,h,count=1)
    for o,n in [('Almacén y Licorería RAVE, Urquiza 1052, Salta, Argentina. Contacto: WhatsApp 387 4574892.','Kini Distribuidora (demo de evaluación, datos de ejemplo).'),
                ('Almacén y Licorería · Urquiza 1052 · Salta, Argentina','Kini Distribuidora · demo'),
                ('Mirá el menú de Almacén y Licorería RAVE (Urquiza 1052, Salta): vinos, bebidas, cigarrillos y combos. Pedí por WhatsApp 👇','Mirá el catálogo mayorista de Kini Distribuidora. Pedí por WhatsApp 👇'),
                ('Check out the menu of Almacén y Licorería RAVE (Urquiza 1052, Salta): wines, drinks, cigarettes and combos. Order via WhatsApp 👇','Check out the Kini Distribuidora wholesale catalog. Order via WhatsApp 👇'),
                ('Almacén y Licorería RAVE','Kini Distribuidora'),('Almacén y Licorería · Salta','Distribuidora mayorista'),('RAVE DIGITAL','KINI DISTRIBUIDORA'),('Club RAVE','Club Kini'),('class=\\"foot-brand\\">RAVE<','class=\\"foot-brand\\">KINI<'),('alt=\\"RAVE','alt=\\"Kini'),('que RAVE guarde','que Kini Distribuidora guarde'),('RAVE Club','Kini Club'),('<title>RAVE','<title>Kini'),('Este menú incluye bebidas alcohólicas y tabaco.','Este catálogo incluye bebidas alcohólicas.'),('This menu includes alcoholic beverages and tobacco.','This catalog includes alcoholic beverages.')]:
        h=h.replace(o,n)
    h=h.replace('--gold:#c9963e','--gold:%s'%c2)

    return h
vbj='const VB_BANNER="data:image/webp;base64,'+base64.b64encode(open('assets/vb-banner.webp','rb').read()).decode()+'";\n'
html=head+'\n'+vbj+B('build/p0-data.js')+B('build/p0-pub.js')+"const SOCIAL_ICONS_OK=1;\n"+B('build/qr.js')+'\n'+'\n'.join(B(p) for p in parts)+'\n</script>\n</body></html>\n'
if KINI: html=kini_brand(html)
open(out,'w',encoding='utf8').write(html)
m=re.search(r'\n<script>\n(.*?)\n</script>\n</body>',html,re.S)
open('all.js','w',encoding='utf8').write(m.group(1))
subprocess.check_call(['node','--check','all.js'])
print('BUILD OK',V,out,len(html))
