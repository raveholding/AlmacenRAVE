#!/usr/bin/env python3
"""Genera despliegue-panel/arca-index.ts (un solo archivo) a partir de functions/arca/{core,handler,index}.ts"""
import re,os
b=os.path.dirname(os.path.abspath(__file__));d=b+'/functions/arca/'
core=open(d+'core.ts',encoding='utf8').read();h=open(d+'handler.ts',encoding='utf8').read();idx=open(d+'index.ts',encoding='utf8').read()
imps=[l for l in core.split('\n') if l.startswith('import ')]
cb='\n'.join(l for l in core.split('\n') if not l.startswith('import '))
hb=re.sub(r'^import .*\n','',h,flags=re.M).replace('export interface','interface').replace('export async function','async function').replace('export function','function')
ib=re.sub(r'^import .*\n','',idx,flags=re.M)
open(b+'/despliegue-panel/arca-index.ts','w',encoding='utf8').write('\n'.join(imps)+'\n// ===== core.ts =====\nnamespace core {\n'+cb+'\n}\nconst ErrorArca = core.ErrorArca;\ntype ErrorArca = core.ErrorArca;\n// ===== handler.ts =====\n'+hb+'\n// ===== index.ts =====\n'+ib)
print('ok')
