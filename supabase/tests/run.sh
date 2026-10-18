#!/bin/bash
# Reconstruye la base de pruebas, corre 01..05 dos veces (idempotencia) y todas las pruebas SQL.
set -e
D=/tmp/rave/supabase
su postgres -c "psql -q -c 'drop database if exists rave_t' -c 'create database rave_t'" 2>&1 | grep -v NOTICE || true
P="su postgres -c"
$P "psql -q -v ON_ERROR_STOP=1 -d rave_t -f $D/tests/00-shim.sql" 2>&1 | grep -v NOTICE || true
for pass in 1 2; do
  for f in 01-base 02-sincronizacion 03-recuperacion-soporte 04-menu-publico 05-arca 06-v26 07-pagos-mixtos; do
    $P "psql -q -v ON_ERROR_STOP=1 -d rave_t -f $D/$f.sql" 2>&1 | grep -v "NOTICE\|^$" || true
  done
done
for t in 10 11 12 13 14; do [ -f $D/tests/$t-sql-tests.sql ] && $P "psql -q -d rave_t -f $D/tests/$t-sql-tests.sql" 2>&1 | grep -v "NOTICE\|^$" || true; done
$P "psql -d rave_t -At -F' | ' -c \"select case when ok then 'OK   ' else 'FALLA' end, name, left(coalesce(info,''),200) from t.res where not ok order by n\""
$P "psql -d rave_t -At -c \"select count(*) filter (where ok) || ' OK / ' || count(*) filter (where not ok) || ' FALLAN de ' || count(*) from t.res\""
