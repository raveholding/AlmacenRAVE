#!/usr/bin/env python3
"""Arma el index.html. Uso: python3 build.py demo|cliente [salida.html]
Variables de entorno (sólo cliente): SUPABASE_URL, SUPABASE_KEY (clave PUBLICABLE), RAVE_SLUG, PUBLIC_URL"""
import sys,os,json,subprocess,re
V=sys.argv[1] if len(sys.argv)>1 else 'demo'
assert V in('demo','cliente')
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
build={'ver':datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M')+' UTC','variant':V,'db':'rave-almacenrave-v1' if V=='cliente' else 'rave-cliente-v3','publicUrl':pub}
cfg='<script>window.RAVE_BUILD=%s;window.RAVE_CLOUD=%s;</script>\n'%(json.dumps(build),json.dumps({'url':url,'key':key,'slug':slug}))
head=B('p1-head.html')
head=head.replace("connect-src 'none'","connect-src "+(url if url else "'none'"))
if V=='cliente':
    head=head.replace('<title>Sistema RAVE · Almacén y Licorería RAVE — Demo</title>','<title>Sistema RAVE · Almacén y Licorería RAVE</title>')
head=head.replace('<style>',cfg+'<style>',1)
parts=['p2-core.js','p2b-sort.js','p3-ops.js','p3b-pos.js','p3c-cash.js','p3d-assist.js','p6-loyalty.js','p4-mods.js','p4b-online.js','p7a-dash.js','p7-devices.js','p8-legal.js','p9-cloud.js','p9b-arca.js','p5-menu-boot.js']
parts=[p for p in parts if os.path.exists(p)]
html=head+'\n'+B('build/p0-data.js')+B('build/p0-pub.js')+"const SOCIAL_ICONS_OK=1;\n"+B('build/qr.js')+'\n'+'\n'.join(B(p) for p in parts)+'\n</script>\n</body></html>\n'
open(out,'w',encoding='utf8').write(html)
m=re.search(r'\n<script>\n(.*?)\n</script>\n</body>',html,re.S)
open('all.js','w',encoding='utf8').write(m.group(1))
subprocess.check_call(['node','--check','all.js'])
print('BUILD OK',V,out,len(html))
