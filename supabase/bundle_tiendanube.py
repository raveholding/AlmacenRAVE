#!/usr/bin/env python3
"""Genera despliegue-panel/tiendanube-index.ts (un solo archivo) a partir de functions/tiendanube/{handler,index}.ts"""
import re,os
b=os.path.dirname(os.path.abspath(__file__));d=b+'/functions/tiendanube/'
h=open(d+'handler.ts',encoding='utf8').read();idx=open(d+'index.ts',encoding='utf8').read()
hb=h.replace('export interface','interface').replace('export async function','async function').replace('export function','function').replace('export class','class').replace('export const','const')
ib=re.sub(r'^import .*\n','',idx,flags=re.M)
open(b+'/despliegue-panel/tiendanube-index.ts','w',encoding='utf8').write(hb+'\n// ===== index.ts =====\n'+ib)
print('ok')
