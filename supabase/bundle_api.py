#!/usr/bin/env python3
"""Genera despliegue-panel/api-index.ts (un solo archivo) a partir de functions/api/{handler,index}.ts"""
import re,os
b=os.path.dirname(os.path.abspath(__file__));d=b+'/functions/api/'
h=open(d+'handler.ts',encoding='utf8').read();idx=open(d+'index.ts',encoding='utf8').read()
hb=h.replace('export interface','interface').replace('export async function','async function').replace('export function','function')
ib=re.sub(r'^import .*\n','',idx,flags=re.M)
open(b+'/despliegue-panel/api-index.ts','w',encoding='utf8').write('// ===== handler.ts =====\n'+hb+'\n// ===== index.ts =====\n'+ib)
print('ok')
