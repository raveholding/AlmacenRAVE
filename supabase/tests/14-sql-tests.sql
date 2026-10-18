-- V26.1 · 07-pagos-mixtos.sql: pagos mixtos, cuenta corriente parcial, cc_movimientos
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3';
  uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid; cB uuid := t.ctxget('cB')::uuid;
  r jsonb; sync text := $q$select public.sincronizar(%L,'dev1',%L::jsonb)$q$; d jsonb;
begin
  perform t.call(uA,'a@a.com',format(sync,cA,'[{"c":"clientes","id":"cm1","d":{"name":"Ana","last":"Gómez","limit":9000000}}]'));
  -- 40.000 efectivo + 20.000 cuenta corriente = 60.000
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm1","d":{"n":"1-1","ts":1000,"total":6000000,"status":"ok","cust":"cm1","items":[{"pid":"x","qty":1,"price":6000000}],"method":"mixto","pays":[{"m":"efectivo","a":4000000},{"m":"fiado","a":2000000}],"fiadoAmt":1,"paid":99,"pstate":"pagada"}}]'));
  perform t.chk('venta mixta 40k+20k = 60k se acepta', (r->>'aplicados')='1', r::text);
  select datos into d from public.registros where comercio_id=cA and coleccion='ventas' and id='pm1';
  perform t.chk('el servidor calcula fiadoAmt=2.000.000 (no confía en el navegador)', (d->>'fiadoAmt')::numeric=2000000, d::text);
  perform t.chk('el servidor calcula paid=4.000.000', (d->>'paid')::numeric=4000000, d::text);
  perform t.chk('estado pago parcial', d->>'pstate'='parcial', d::text);
  perform t.chk('fiado=true', (d->>'fiado')::boolean, d::text);
  -- sumas que no cierran
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm2","d":{"n":"1-2","total":6000000,"cust":"cm1","pays":[{"m":"efectivo","a":4000000},{"m":"fiado","a":1000000}]}}]'));
  perform t.chk('suma de pagos < total: rechazada', (r->>'aplicados')='0' and r::text like '%no coincide%', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm3","d":{"n":"1-3","total":6000000,"cust":"cm1","pays":[{"m":"efectivo","a":5000000},{"m":"fiado","a":2000000}]}}]'));
  perform t.chk('suma de pagos > total: rechazada', (r->>'aplicados')='0' and r::text like '%no coincide%', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm4","d":{"n":"1-4","total":6000000,"pays":[{"m":"efectivo","a":4000000},{"m":"fiado","a":2000000}]}}]'));
  perform t.chk('cuenta corriente sin cliente: rechazada', (r->>'aplicados')='0' and r::text like '%cliente identificado%', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm5","d":{"n":"1-5","total":6000000,"cust":"inexistente","pays":[{"m":"fiado","a":6000000}]}}]'));
  perform t.chk('cuenta corriente con cliente inexistente: rechazada', (r->>'aplicados')='0', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm6","d":{"n":"1-6","total":6000000,"pays":[{"m":"efectivo","a":3000000},{"m":"efectivo","a":3000000}]}}]'));
  perform t.chk('medio repetido: rechazado', (r->>'aplicados')='0' and r::text like '%repetido%', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm7","d":{"n":"1-7","total":6000000,"pays":[{"m":"efectivo","a":-100},{"m":"debito","a":6000100}]}}]'));
  perform t.chk('importe negativo: rechazado', (r->>'aplicados')='0', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm8","d":{"n":"1-8","total":6000000,"pays":[{"m":"efectivo","a":3000000.5},{"m":"debito","a":2999999.5}]}}]'));
  perform t.chk('importes con decimales: rechazados (sólo centavos enteros)', (r->>'aplicados')='0', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm9","d":{"n":"1-9","total":6000000,"pays":[{"m":"efectivo","a":3000000},{"m":"qr","a":3000000}]}}]'));
  perform t.chk('QR combinado con efectivo: rechazado', (r->>'aplicados')='0' and r::text like '%digitales%', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm10","d":{"n":"1-10","total":6000000,"pays":[{"m":"cheque","a":6000000}]}}]'));
  perform t.chk('medio inventado: rechazado', (r->>'aplicados')='0', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm11","d":{"n":"1-11","ts":2000,"total":1000000,"status":"ok","pays":[{"m":"efectivo","a":600000},{"m":"debito","a":400000}]}}]'));
  perform t.chk('mixta efectivo+débito sin deuda: pagada', (r->>'aplicados')='1' and (select datos->>'pstate' from public.registros where comercio_id=cA and coleccion='ventas' and id='pm11')='pagada', r::text);
  -- inmutabilidad
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"pm1","d":{"n":"1-1","ts":1000,"total":100,"status":"ok","cust":"cm1","pays":[{"m":"efectivo","a":100}],"fiadoAmt":0}}]'));
  select datos into d from public.registros where comercio_id=cA and coleccion='ventas' and id='pm1';
  perform t.chk('reenvío adulterado: total, pagos y deuda NO cambian', (d->>'total')::numeric=6000000 and (d->>'fiadoAmt')::numeric=2000000 and jsonb_array_length(d->'pays')=2, d::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"ventas","id":"pm1","d":{"status":"anulada","voidReason":"prueba"}}]'));
  select datos into d from public.registros where comercio_id=cA and coleccion='ventas' and id='pm1';
  perform t.chk('anular sí se puede y conserva los pagos', d->>'status'='anulada' and (d->>'fiadoAmt')::numeric=2000000, d::text);
  -- libro de cuenta corriente
  perform t.call(uA,'a@a.com',format(sync,cA,'[{"c":"ventas","id":"pm20","d":{"n":"1-20","ts":3000,"total":5000000,"status":"ok","cust":"cm1","pays":[{"m":"fiado","a":5000000}]}},{"c":"ventas","id":"pm21","d":{"n":"1-21","ts":4000,"total":3000000,"status":"ok","cust":"cm1","pays":[{"m":"efectivo","a":1000000},{"m":"fiado","a":2000000}]}},{"c":"fiado","id":"fp1","d":{"cust":"cm1","ts":5000,"amount":1500000,"method":"efectivo"}}]'));
  r := t.call(uA,'a@a.com',format($q$select jsonb_agg(to_jsonb(x) order by x.ts) from public.cc_movimientos(%L,'cm1') x$q$, cA));
  perform t.chk('cc_movimientos: 3 renglones (la anulada no cuenta)', jsonb_array_length(r)=3, r::text);
  perform t.chk('cc_movimientos: saldo final = 5.000.000 + 2.000.000 − 1.500.000 = 5.500.000', (r->2->>'saldo')::numeric=5500000, r::text);
  r := t.call(uB,'b@b.com',format($q$select jsonb_agg(to_jsonb(x)) from public.cc_movimientos(%L,'cm1') x$q$, cA));
  perform t.chk('admin de OTRO comercio NO ve la cuenta corriente', r ? 'err', r::text);
  r := t.call(uB,'b@b.com',format(sync,cA,'[{"c":"ventas","id":"pmx","d":{"n":"9-9","total":100,"pays":[{"m":"efectivo","a":100}]}}]'));
  perform t.chk('admin de OTRO comercio NO escribe ventas', r ? 'err', r::text);
end $$;
