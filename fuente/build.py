#!/usr/bin/env python3
"""Arma el index.html. Uso: python3 build.py demo|cliente [salida.html]
Variables de entorno (sólo cliente): SUPABASE_URL, SUPABASE_KEY (clave PUBLICABLE), RAVE_SLUG, PUBLIC_URL"""
import sys,os,json,subprocess,re
V=sys.argv[1] if len(sys.argv)>1 else 'demo'
assert V in('demo','cliente','kini','solo','v3')
# perfiles de demo (V26.43): kini = mayorista (KiniDistribuidoraDemo) · solo = comercio de un solo dueño (raveV2) · v3 = como Almacén RAVE con el equipo SVB R2AVE (raveV3)
PROFILE=V if V in('kini','solo','v3') else ''
KINI=V=='kini'
if PROFILE: V='demo'
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
if PROFILE=='v3': pub=os.environ.get('PUBLIC_URL','https://raveholding.github.io/raveV3/')
build={'ver':datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M')+' UTC','variant':V,'db':'rave-almacenrave-v1' if V=='cliente' else {'kini':'rave-kini-demo-v2','solo':'rave-solo-demo-v1','v3':'rave-v3-demo-v2'}.get(PROFILE,'rave-cliente-v3'),'publicUrl':pub}
if PROFILE: build['profile']=PROFILE
cfg='<script>window.RAVE_BUILD=%s;window.RAVE_CLOUD=%s;</script>\n'%(json.dumps(build),json.dumps({'url':url,'key':key,'slug':slug}))
head=B('p1-head.html')
head=head.replace("connect-src 'none'","connect-src "+(url if url else "'none'"))
if V=='cliente':
    # SEO del menú público (V26.33): título, descripción, dirección canónica y datos del local para buscadores.
    # Reemplaza en Google la dirección vieja (raveholding.github.io/menu-rave) por la actual.
    seo_t='Almacén y Licorería RAVE · Menú digital · Salta'
    seo_d='Almacén y Licorería RAVE, Urquiza 1052, Salta, Argentina. Menú digital con precios, pedidos por WhatsApp (387 4574892) y Club RAVE.'
    ld={"@context":"https://schema.org","@type":"LiquorStore","name":"Almacén y Licorería RAVE","url":pub,"telephone":"+54 9 387 457 4892",
        "address":{"@type":"PostalAddress","streetAddress":"Urquiza 1052","addressLocality":"Salta","addressRegion":"Salta","addressCountry":"AR"}}
    seo=('<title>%s</title>\n<meta name="description" content="%s">\n<meta name="robots" content="index,follow">\n<link rel="canonical" href="%s">\n'
         '<meta property="og:type" content="website">\n<meta property="og:title" content="%s">\n<meta property="og:description" content="%s">\n<meta property="og:url" content="%s">\n'
         '<meta property="og:locale" content="es_AR">\n<script type="application/ld+json">%s</script>')%(seo_t,seo_d,pub,seo_t,seo_d,pub,json.dumps(ld,ensure_ascii=False))
    head=head.replace('<title>Sistema RAVE · Almacén y Licorería RAVE — Demo</title>',seo)
head=head.replace('<style>',cfg+'<style>',1)
parts=['p2-core.js','p2b-sort.js','p2c-ux.js','p3-ops.js','p3b-pos.js','p3p-payadj.js','p3n-posquick.js','p3c-cash.js','p3q-cortes.js','p3f-transfers.js','p3g-paydetail.js','p3h-expediente.js','p3i-rubcash.js','p3j-combos.js','p3k-owner.js','p3l-kini.js','p3o-solo.js','p3m-payacc.js','p3d-assist.js','p3e-saledetail.js','p3r-oper.js','p6-loyalty.js','p6c-custadmin.js','p6d-cardportable.js','p6e-wallet.js','p6b-wholesale.js','p6f-credito.js','p6g-wacliente.js','p6h-fidel.js','p6i-fiscal.js','p6j-crm.js','p4-mods.js','p4c-compras.js','p4d-compras-ui.js','p4e-factura.js','p4b-online.js','p7a-dash.js','p7b-charts.js','p7c-scale.js','p7-devices.js','p8-legal.js','p9-cloud.js','p9b-arca.js','p9c-tiendanube.js','p5c-menusec.js','p5b-store.js','p5d-cscreen.js','p5-menu-boot.js']
parts=[p for p in parts if os.path.exists(p)]
# V26.37 · Centro Inteligente (p10-centro.js): módulo aislado.
# V26.40: aprobado por el dueño para Almacén RAVE (apagado por defecto; lo activa el administrador). Kini no lo lleva salvo CI=1.
# raveV2 (solo) y Kini no llevan el Centro Inteligente: es de raveV3 y de Almacén RAVE (apagado)
if (V in ('demo','cliente') and PROFILE not in('kini','solo')) or os.environ.get('CI')=='1': parts.append('p10-centro.js')
# V26.42 · Equipo SVB R2AVE (p10b-r2ave.js): extensión del Centro Inteligente SÓLO para la demo raveV2 hasta que el dueño
# apruebe la demostración. El cliente (Almacén RAVE) y Kini NO la llevan; con R2AVE=1 se fuerza (pruebas).
# V26.43: el equipo SVB R2AVE y su centro vivo SÓLO en raveV3 (perfil v3). El cliente, raveV2 y Kini no los llevan.
# V26.45: aprobado por el dueño para Almacén RAVE (2026-11-02): el cliente también lleva el equipo y el centro vivo.
if ('p10-centro.js' in parts and (PROFILE=='v3' or V=='cliente') and os.environ.get('R2AVE','1')!='0') or os.environ.get('R2AVE')=='1': parts.append('p10b-r2ave.js');parts.append('p10c-vivo.js') if os.path.exists('p10c-vivo.js') else None
# V26.52 · R2AVE en Telegram (p10d-telegram.js, prompt 4.35): Almacén RAVE (real, con la nube) y raveV3 (demo simulada). Kini y raveV2 no.
if os.path.exists('p10d-telegram.js') and ((V=='cliente' or PROFILE=='v3') and os.environ.get('TG','1')!='0' or os.environ.get('TG')=='1'): parts.append('p10d-telegram.js')
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
    h=h.replace('--gold-deep:#dba854','--gold-deep:%s'%c2)

    return h
def solo_brand(h,v3=False):
    # Demo raveV2 «Mi Comercio» (un solo dueño): marca genérica, sin nada de Almacén RAVE. Los créditos de Vincular Business no se tocan.
    svg='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" rx="22" fill="#1f2a37"/><text x="160" y="92" font-family="Arial,Helvetica,sans-serif" font-size="46" font-weight="700" fill="#ffffff" text-anchor="middle">MI COMERCIO</text><text x="160" y="136" font-family="Arial,Helvetica,sans-serif" font-size="20" letter-spacing="4" fill="#5cc2a8" text-anchor="middle">DEMO</text></svg>'
    uri='data:image/svg+xml;base64,'+base64.b64encode(svg.encode()).decode()
    h=re.sub(r'const LOGO_MENU="[^"]*"','const LOGO_MENU="%s"'%uri,h,count=1)
    h=re.sub(r'const LOGO_TICKET="[^"]*"','const LOGO_TICKET="%s"'%uri,h,count=1)
    c1,c2,c3='#1f2a37','#2e8b74','#23695a'
    h=h.replace('--ink:#242220;','--ink:%s;'%c1,1).replace('--gold:#c9963e;','--gold:%s;'%c2,1).replace('--gold2:#a87a28;','--gold2:%s;'%c3,1)
    h=h.replace('style="width:48px;height:27px;object-fit:cover;border-radius:6px"','style="width:48px;height:27px;object-fit:contain;border-radius:6px"')
    h=h.replace('Sistema RAVE','Sistema VB').replace('alt="RAVE"','alt="Mi Comercio"')
    h=re.sub(r'<title>[^<]*</title>','<title>Mi Comercio · %s · Sistema VB</title>'%('Demo con asistentes inteligentes' if v3 else 'Demo de un solo dueño'),h,count=1)
    h=re.sub(r'(class=\\"logo\\" src=\\")data:image/[a-z]+;base64,[A-Za-z0-9+/=]+',lambda m:m.group(1)+uri,h,count=1)
    for o,n in [('Almacén y Licorería RAVE, Urquiza 1052, Salta, Argentina. Contacto: WhatsApp 387 4574892.','Mi Comercio (demo de evaluación, datos de ejemplo).'),
                ('Almacén y Licorería · Urquiza 1052 · Salta, Argentina','Mi Comercio · demo'),
                ('Mirá el menú de Almacén y Licorería RAVE (Urquiza 1052, Salta): vinos, bebidas, cigarrillos y combos. Pedí por WhatsApp 👇','Mirá el catálogo de Mi Comercio. Pedí por WhatsApp 👇'),
                ('Check out the menu of Almacén y Licorería RAVE (Urquiza 1052, Salta): wines, drinks, cigarettes and combos. Order via WhatsApp 👇','Check out the Mi Comercio catalog. Order via WhatsApp 👇'),
                ('Almacén y Licorería RAVE','Mi Comercio'),('Almacén y Licorería · Salta','Almacén y kiosco · demo'),('RAVE DIGITAL','MI COMERCIO'),('Club RAVE','Club Mi Comercio'),('class=\\"foot-brand\\">RAVE<','class=\\"foot-brand\\">MI COMERCIO<'),('alt=\\"RAVE','alt=\\"Mi Comercio'),('que RAVE guarde','que Mi Comercio guarde'),('RAVE Club','Mi Comercio Club'),('<title>RAVE','<title>Mi Comercio'),('Este menú incluye bebidas alcohólicas y tabaco.','Este catálogo incluye bebidas alcohólicas.'),('This menu includes alcoholic beverages and tobacco.','This catalog includes alcoholic beverages.')]:
        h=h.replace(o,n)
    h=h.replace('--gold:#c9963e','--gold:%s'%c2).replace('--gold-deep:#dba854','--gold-deep:%s'%c2)
    # menú lateral: el ítem activo sobre el verde de la marca lleva texto negro (5,0:1; con #1b1100 daba 4,49:1)
    h=h.replace('#side a.on{background:var(--gold);color:#1b1100;','#side a.on{background:var(--gold);color:#000;',1)
    # raveV3: el Centro Inteligente usa una variante más clara del mismo verde para cumplir contraste 4,5:1 sobre su fondo oscuro
    if v3: h=h.replace('--ci-acc:var(--gold,#c9963e)','--ci-acc:#45ad92',1)
    # V26.50 · contraste 4,5:1 con el verde de la marca: texto negro en botones dorados (también «F12») y verde más claro sobre el fondo oscuro
    h=h.replace('</style>','.btn.gold,.fk.gold,.fk.gold small,.cmp .btn.gold,html[data-theme=dark] .btn.gold,html[data-theme=dark] .fk.gold,html[data-theme=dark] .fk.gold small{color:#000!important}html[data-theme=dark] .cmp-tab.on{color:#45ad92}\n</style>',1)
    return h
vbj='const VB_BANNER="data:image/webp;base64,'+base64.b64encode(open('assets/vb-banner.webp','rb').read()).decode()+'";\n'
html=head+'\n'+vbj+B('build/p0-data.js')+B('build/p0-pub.js')+"const SOCIAL_ICONS_OK=1;\n"+B('build/qr.js')+'\n'+'\n'.join(B(p) for p in parts)+'\n</script>\n</body></html>\n'
if KINI: html=kini_brand(html)
if PROFILE in('solo','v3'): html=solo_brand(html,PROFILE=='v3')
open(out,'w',encoding='utf8').write(html)
m=re.search(r'\n<script>\n(.*?)\n</script>\n</body>',html,re.S)
open('all.js','w',encoding='utf8').write(m.group(1))
subprocess.check_call(['node','--check','all.js'])
print('BUILD OK',V,out,len(html))
