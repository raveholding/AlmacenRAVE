#!/bin/sh
# Compila las demos de Vincular Business que salen de esta fuente: Mostrador, Mayorista y Distribuidora.
# Uso: sh tools/demos/build-demos.sh <carpeta-salida>   → deja <salida>/{mostrador,mayorista,distribuidora}/index.html (+ sw.js e íconos)
# Cada demo viene armada para su rubro (DEMO_FIJO=1): no hay que configurar nada para probarla.
set -e
H="$(cd "$(dirname "$0")" && pwd)"; OUT="${1:-/tmp/vbd}"; cd "$H/../../fuente"
mk(){ rm -rf "$OUT/$1"; mkdir -p "$OUT/$1"; }
mk mostrador; mk mayorista; mk distribuidora
KINI_LOGO="$H/mostrador.svg" KINI_LOGO_TICKET="$H/mostrador-ticket.svg" KINI_C1='#0b0b0c' KINI_C2='#3fbf6f' KINI_C3='#2e9e57' DEMO_ID=vb-demo-mostrador PUBLIC_URL=https://raveholding.github.io/VB-Demo-mostrador/ \
 DEMO_NOMBRE="Mostrador Demo" DEMO_SLOGAN="Almacén, kiosco y autoservicio · demo de Vincular Business" DEMO_CANAL=min DEMO_PLAN=esencial DEMO_CATALOGO=almacen DEMO_FIJO=1 \
 DEMO_MODS=pos_hold,price_hist,price_bulk,labels,kiosk python3 build.py kini "$OUT/mostrador/index.html" | tail -1
KINI_LOGO="$H/mayorista.svg" KINI_LOGO_TICKET="$H/mayorista-ticket.svg" KINI_C1='#0b0b0c' KINI_C2='#ff7a1a' KINI_C3='#e0650c' DEMO_ID=vb-demo-mayorista PUBLIC_URL=https://raveholding.github.io/VB-Demo-Mayorista/ DEMO_FIJO=1 \
 DEMO_NOMBRE="Mayorista Demo" DEMO_SLOGAN="Mayorista y minorista · demo de Vincular Business" DEMO_CANAL=both DEMO_MODS=pos_hold,price_hist,price_bulk,labels,kiosk,count,hr_vales DEMO_PLAN=mayorista python3 build.py kini "$OUT/mayorista/index.html" | tail -1
KINI_LOGO="$H/distribuidora.svg" KINI_LOGO_TICKET="$H/distribuidora-ticket.svg" KINI_C1='#0b0b0c' KINI_C2='#2fa8f0' KINI_C3='#1c84c6' DEMO_ID=vb-demo-distribuidora PUBLIC_URL=https://raveholding.github.io/VB-Demo-Distribuidora/ DEMO_FIJO=1 \
 DEMO_NOMBRE="Distribuidora Demo" DEMO_SLOGAN="Distribuidora con preventa y reparto · demo de Vincular Business" DEMO_CANAL=may DEMO_MODS=pos_hold,price_hist,price_bulk,labels,count,hr_vales,orders,presale,gps,depots,stockpile,wa_orders,b2b,pipeline DEMO_PLAN=mayorista python3 build.py kini "$OUT/distribuidora/index.html" | tail -1
