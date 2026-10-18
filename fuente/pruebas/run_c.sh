#!/bin/bash
# reinicia base + servidor de pruebas y corre el script indicado
export PATH=/tmp/infra/node/node_modules/.bin:$PATH
pkill -x deno 2>/dev/null
/tmp/rave/supabase/tests/mk-e2e-db.sh >/dev/null 2>&1
cd /tmp/rave/rig && (nohup deno run -A --no-check run.ts > /tmp/rig.log 2>&1 &)
sleep 2
cd /tmp/rave/t && python3 "$@"
