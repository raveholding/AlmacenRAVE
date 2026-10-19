#!/bin/bash
# Base "rave_e2e" limpia con el esquema nuevo (para PostgREST + pruebas de la función y del navegador)
D=/tmp/rave/supabase
pkill -x postgrest 2>/dev/null; sleep 0.5
su postgres -c "psql -q -c 'drop database if exists rave_e2e' -c 'create database rave_e2e'" 2>&1 | grep -v NOTICE
su postgres -c "psql -q -v ON_ERROR_STOP=1 -d rave_e2e -f $D/tests/00-shim.sql" 2>&1 | grep -v NOTICE
for f in 01-base 02-sincronizacion 03-recuperacion-soporte 04-menu-publico 05-arca 06-v26 07-pagos-mixtos 08-proveedores-compras 09-club-tarjeta 10-mayorista-precios; do su postgres -c "psql -q -v ON_ERROR_STOP=1 -d rave_e2e -f $D/$f.sql" 2>&1 | grep -v "NOTICE"; done
sed -i 's#/rave_t"#/rave_e2e"#' $D/tests/pgrst/test.conf
(nohup /tmp/infra/postgrest $D/tests/pgrst/test.conf >/tmp/pgrst.log 2>&1 &)
for i in 1 2 3 4 5 6 7 8; do curl -s -m 2 http://127.0.0.1:3011/ >/dev/null && break; sleep 0.5; done
echo "e2e db lista"
