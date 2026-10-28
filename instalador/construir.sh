#!/bin/bash
# Arma el instalador de Windows (64 y 32 bits) con la versión «cliente» publicada en ../index.html.
set -e
cd "$(dirname "$0")"
cp ../index.html app/index.html
R=$(go run . --validar app/index.html); echo "validación: $R"; case "$R" in *"<nil>"*) ;; *) echo "EL index.html NO VALIDA"; exit 1;; esac
RSRC=${RSRC:-$HOME/go/bin/rsrc}
$RSRC -arch amd64 -ico rave.ico -manifest rave.manifest -o rsrc_windows_amd64.syso
$RSRC -arch 386   -ico rave.ico -manifest rave.manifest -o rsrc_windows_386.syso
mkdir -p dist
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H windowsgui" -o dist/AlmacenRAVE-Instalador-64bits.exe .
GOOS=windows GOARCH=386   CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -H windowsgui" -o dist/AlmacenRAVE-Instalador-32bits.exe .
( cd dist && sha256sum *.exe > SHA256SUMS.txt && cat SHA256SUMS.txt )
