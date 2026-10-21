-- 12-pago-proveedor-cajas.sql: pago a proveedor repartido entre varias cajas (corre después de 15)
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3';
  cA uuid := t.ctxget('cA')::uuid; r jsonb; pv uuid; d0 numeric; d1 numeric; nm int;
  sync text := $q$select public.sincronizar(%L,'devW',%L::jsonb)$q$;
  pay text := $q$select public.proveedor_pago_registrar(%L,%L::jsonb)$q$;
begin
  perform t.call(uA,'a@a.com',format(sync,cA,'[{"c":"turnos","id":"tkP","d":{"openAt":1,"closedAt":0,"total":0}},{"c":"turnos","id":"tkQ","d":{"openAt":1,"closedAt":0,"total":0}},{"c":"turnos","id":"tkC","d":{"openAt":1,"closedAt":99,"total":0}}]'));
  select id, saldo_cuenta_corriente into pv, d0 from public.proveedores where tenant_id=cA and saldo_cuenta_corriente > 400 order by saldo_cuenta_corriente desc limit 1;
  perform t.chk('hay un proveedor con deuda para probar', pv is not null, coalesce(d0::text,''));
  select count(*) into nm from public.registros where comercio_id=cA and coleccion='movs';
  -- pago de 300 repartido 200 + 100
  r := t.call(uA,'a@a.com',format(pay,cA,format('{"proveedor_id":"%s","monto":300,"medio_pago":"efectivo","rubro_id":"rgen","referencia":"Recibo repartido","idempotency_key":"pago-rep-001","asignaciones":[{"turno_id":"tkP","monto":200},{"turno_id":"tkQ","monto":100}]}',pv)));
  perform t.chk('pago repartido 200+100: ok', (r->>'ok')='true' and jsonb_array_length(r->'asignaciones')=2, r::text);
  select saldo_cuenta_corriente into d1 from public.proveedores where id=pv;
  perform t.chk('la deuda baja exactamente 300', d1 = d0-300, d0||' → '||d1);
  perform t.chk('se crean 2 egresos de caja (20.000 y 10.000 centavos) en sus cajas, con el rubro', (select count(*) from public.registros where comercio_id=cA and coleccion='movs')=nm+2
     and exists(select 1 from public.registros where comercio_id=cA and coleccion='movs' and datos->>'sessId'='tkP' and (datos->>'amount')::int=20000 and datos->>'rubro'='rgen')
     and exists(select 1 from public.registros where comercio_id=cA and coleccion='movs' and datos->>'sessId'='tkQ' and (datos->>'amount')::int=10000), '');
  perform t.chk('las asignaciones quedan vinculadas a UN solo pago y suman 300', (select count(distinct pago_id) from public.pagos_proveedor_asignaciones where tenant_id=cA)=1 and (select sum(monto) from public.pagos_proveedor_asignaciones where tenant_id=cA)=300, '');
  perform t.chk('en el libro hay un único Pago de 300', (select count(*) from public.cuenta_corriente_proveedores where tenant_id=cA and idempotency_key='pago-rep-001')=1, '');
  -- idempotencia
  r := t.call(uA,'a@a.com',format(pay,cA,format('{"proveedor_id":"%s","monto":300,"medio_pago":"efectivo","rubro_id":"rgen","idempotency_key":"pago-rep-001","asignaciones":[{"turno_id":"tkP","monto":200},{"turno_id":"tkQ","monto":100}]}',pv)));
  perform t.chk('reintento con la misma clave: no duplica', (r->>'repetido')='true' and (select count(*) from public.registros where comercio_id=cA and coleccion='movs')=nm+2 and (select saldo_cuenta_corriente from public.proveedores where id=pv)=d1, r::text);
  -- errores: todo o nada
  r := t.call(uA,'a@a.com',format(pay,cA,format('{"proveedor_id":"%s","monto":50,"medio_pago":"efectivo","rubro_id":"rgen","idempotency_key":"pago-rep-002","asignaciones":[{"turno_id":"tkP","monto":20},{"turno_id":"tkQ","monto":20}]}',pv)));
  perform t.chk('el reparto no suma el pago: rechazado', r ? 'err' and r->>'err' like '%no suma%', r::text);
  r := t.call(uA,'a@a.com',format(pay,cA,format('{"proveedor_id":"%s","monto":50,"medio_pago":"efectivo","rubro_id":"rgen","idempotency_key":"pago-rep-003","asignaciones":[{"turno_id":"tkP","monto":25},{"turno_id":"tkC","monto":25}]}',pv)));
  perform t.chk('una caja cerrada en el reparto: rechazado y NO queda ningún egreso parcial', r ? 'err' and (select count(*) from public.registros where comercio_id=cA and coleccion='movs')=nm+2 and (select saldo_cuenta_corriente from public.proveedores where id=pv)=d1, r::text);
  r := t.call(uA,'a@a.com',format(pay,cA,format('{"proveedor_id":"%s","monto":50,"medio_pago":"efectivo","rubro_id":"rgen","idempotency_key":"pago-rep-004","asignaciones":[{"turno_id":"tkP","monto":25},{"turno_id":"tkP","monto":25}]}',pv)));
  perform t.chk('una caja repetida en el reparto: rechazado', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format(pay,cA,format('{"proveedor_id":"%s","monto":50,"medio_pago":"transferencia","rubro_id":"rgen","idempotency_key":"pago-rep-005","asignaciones":[{"turno_id":"tkP","monto":50}]}',pv)));
  perform t.chk('reparto con transferencia: rechazado (sólo efectivo)', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format(pay,cA,format('{"proveedor_id":"%s","monto":99999,"medio_pago":"efectivo","rubro_id":"rgen","idempotency_key":"pago-rep-006","asignaciones":[{"turno_id":"tkP","monto":99999}]}',pv)));
  perform t.chk('pago mayor a la deuda con reparto: rechazado', r ? 'err', r::text);
  r := t.call(uA3,'a3@a.com',format(pay,cA,format('{"proveedor_id":"%s","monto":10,"medio_pago":"efectivo","rubro_id":"rgen","idempotency_key":"pago-rep-007","asignaciones":[{"turno_id":"tkP","monto":10}]}',pv)));
  perform t.chk('el mostrador NO paga a proveedores (servidor)', r ? 'err', r::text);
  -- sin asignaciones: el comportamiento de siempre
  r := t.call(uA,'a@a.com',format(pay,cA,format('{"proveedor_id":"%s","monto":10,"medio_pago":"efectivo","rubro_id":"rgen","turno_id":"tkP","idempotency_key":"pago-rep-008"}',pv)));
  perform t.chk('sin asignaciones se comporta como antes (una caja)', (r->>'ok')='true' and r->>'movimiento_caja_id' is not null, r::text);
  -- inmutabilidad
  begin update public.pagos_proveedor_asignaciones set monto=1; perform t.chk('las asignaciones no se modifican', false, ''); exception when others then perform t.chk('las asignaciones no se modifican', true, sqlerrm); end;
end $$;
