#!/bin/bash
# Ingreso de mercadería y pagos a proveedores desde varios equipos a la vez (corre después de run.sh).
C=$(su postgres -c "psql -d rave_t -At -c \"select id from public.comercios where slug='comercio-a'\"")
U=00000000-0000-0000-0000-00000000000a
SQL(){ su postgres -c "psql -d rave_t -At -c \"$1\""; }
SQL "insert into public.registros(comercio_id,coleccion,id,datos) values ('$C','prod','pcc','{\\\"stock\\\":10,\\\"cost\\\":100,\\\"price\\\":1000,\\\"name\\\":\\\"Concurrente compras\\\"}') on conflict (comercio_id,coleccion,id) do update set datos=excluded.datos" >/dev/null
SQL "insert into public.registros(comercio_id,coleccion,id,datos) values ('$C','rubros','rcc','{\\\"name\\\":\\\"Merc\\\",\\\"kind\\\":\\\"shared\\\"}') on conflict (comercio_id,coleccion,id) do nothing" >/dev/null
P=$(su postgres -c "psql -d rave_t -q -At" <<EOF | tail -1
begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"$U","email":"a@a.com","role":"authenticated"}',true);
select (public.proveedor_guardar('$C','{"razon_social":"Concurrente SA","cuit":"30111111118","condicion_iva":"Exento"}'::jsonb))->>'id'; commit;
EOF
)
rec(){ # $1 clave  $2 nro comprobante  $3 cantidad
su postgres -c "psql -q -d rave_t -At" <<EOF >/dev/null 2>&1
begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"$U","email":"a@a.com","role":"authenticated"}',true);
select public.procesar_recepcion('$C','{"idempotency_key":"$1","proveedor_id":"$P","tipo_comprobante":"Factura","nro_comprobante":"$2","items":[{"producto_id":"pcc","cantidad":$3,"precio_costo":1}]}'::jsonb);
select pg_sleep(0.3); commit;
EOF
}
pago(){ # $1 clave  $2 monto
su postgres -c "psql -q -d rave_t -At" <<EOF >/dev/null 2>&1
begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"$U","email":"a@a.com","role":"authenticated"}',true);
select public.proveedor_pago_registrar('$C','{"proveedor_id":"$P","monto":$2,"medio_pago":"transferencia","rubro_id":"rcc","idempotency_key":"$1"}'::jsonb);
select pg_sleep(0.2); commit;
EOF
}
export -f rec pago; export C U P
# A) el MISMO comprobante enviado 6 veces a la vez (doble clic / reintentos): se aplica una sola vez
for i in 1 2 3 4 5 6; do rec "conc-misma-clave" "F-1" 5 & done; wait
A_STOCK=$(SQL "select datos->>'stock' from public.registros where coleccion='prod' and id='pcc'")
A_ING=$(SQL "select count(*) from public.ingresos_mercaderia where proveedor_id='$P'")
# B) 8 comprobantes DISTINTOS a la vez para el mismo producto: ninguna suma se pierde (8 × 2 = 16)
for i in 1 2 3 4 5 6 7 8; do rec "conc-distinta-$i" "G-$i" 2 & done; wait
B_STOCK=$(SQL "select datos->>'stock' from public.registros where coleccion='prod' and id='pcc'")
B_SALDO=$(SQL "select saldo_cuenta_corriente from public.proveedores where id='$P'")
B_LIB=$(SQL "select saldo_acumulado from public.cuenta_corriente_proveedores where proveedor_id='$P' order by seq desc limit 1")
B_GAPS=$(SQL "select count(*) from (select saldo_acumulado, tipo_movimiento, monto, lag(saldo_acumulado,1,0::numeric) over (order by seq) p from public.cuenta_corriente_proveedores where proveedor_id='$P') z where z.saldo_acumulado <> z.p + case when z.tipo_movimiento in ('Factura','Remito') then z.monto else -z.monto end")
# C) 5 pagos de 6 a la vez contra una deuda de 21: pasan 3 (18) y los demás se rechazan o dejan saldo >= 0
for i in 1 2 3 4 5 6 7 8; do pago "conc-pago-$i" 6 & done; wait
C_SALDO=$(SQL "select saldo_cuenta_corriente from public.proveedores where id='$P'")
C_PAGOS=$(SQL "select count(*) from public.cuenta_corriente_proveedores where proveedor_id='$P' and tipo_movimiento='Pago'")
echo "A) misma clave x6: stock $A_STOCK (esperado 15) · ingresos $A_ING (esperado 1)"
echo "B) 8 comprobantes a la vez: stock $B_STOCK (esperado 31) · deuda $B_SALDO (esperado 21) · último saldo del libro $B_LIB · saltos en el libro $B_GAPS (esperado 0)"
echo "C) 8 pagos de 6 contra deuda 21: saldo final $C_SALDO (nunca negativo; esperado 3) · pagos aceptados $C_PAGOS (esperado 3)"
[ "${A_STOCK%.*}" = "15" ] && [ "$A_ING" = "1" ] && [ "${B_STOCK%.*}" = "31" ] && [ "${B_SALDO%.*}" = "21" ] && [ "${B_LIB%.*}" = "21" ] && [ "$B_GAPS" = "0" ] && [ "${C_SALDO%.*}" = "3" ] && [ "$C_PAGOS" = "3" ] && echo "CONCURRENCIA COMPRAS OK" || echo "CONCURRENCIA COMPRAS FALLA"
