#!/bin/bash
# Dos (o más) cajas vendiendo la misma botella a la vez: el stock tiene que restar todas.
C=$(su postgres -c "psql -d rave_t -At -c \"select id from public.comercios where slug='comercio-a'\"")
U=00000000-0000-0000-0000-00000000000a
su postgres -c "psql -d rave_t -q -c \"insert into public.registros(comercio_id,coleccion,id,datos) values ('$C','prod','pc','{\\\"stock\\\":100,\\\"name\\\":\\\"Concurrente\\\"}') on conflict do nothing\""
one(){ # $1 = prefijo de ids, $2 = dispositivo
  su postgres -c "psql -q -d rave_t -At -c \"begin; set local role authenticated; select set_config('request.jwt.claims','{\\\"sub\\\":\\\"$U\\\",\\\"email\\\":\\\"a@a.com\\\",\\\"role\\\":\\\"authenticated\\\"}',true); select (public.sincronizar('$C','$2','[{\\\"c\\\":\\\"smov\\\",\\\"id\\\":\\\"$1\\\",\\\"d\\\":{\\\"pid\\\":\\\"pc\\\",\\\"d\\\":-1}}]'::jsonb))->>'aplicados'; commit;\"" >/dev/null
}
export -f one; export C U
for i in $(seq 1 40); do one "cc$i" "dev$((i%2))" & done; wait
S1=$(su postgres -c "psql -d rave_t -At -c \"select datos->>'stock' from public.registros where coleccion='prod' and id='pc'\"")
# reenvío de los mismos 40 (simula reintento tras corte de red)
for i in $(seq 1 40); do one "cc$i" "dev$((i%2))" & done; wait
S2=$(su postgres -c "psql -d rave_t -At -c \"select datos->>'stock' from public.registros where coleccion='prod' and id='pc'\"")
M=$(su postgres -c "psql -d rave_t -At -c \"select count(*) from public.registros where coleccion='smov' and id like 'cc%'\"")
echo "stock tras 40 ventas simultáneas: $S1 (esperado 60) · tras reenviar todo: $S2 (esperado 60) · movimientos guardados: $M (esperado 40)"
[ "${S1%.*}" = "60" ] && [ "${S2%.*}" = "60" ] && [ "$M" = "40" ] && echo "CONCURRENCIA OK" || echo "CONCURRENCIA FALLA"
