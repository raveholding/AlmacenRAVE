-- 10-mayorista-precios.sql: acuerdos, excepciones de crédito, canal mayorista y revisión de crédito
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3';
  uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid; cB uuid := (select comercio_id from public.miembros where usuario_id='00000000-0000-0000-0000-00000000000b' limit 1);
  r jsonb; n int;
  sync text := $q$select public.sincronizar(%L,'devW',%L::jsonb)$q$;
  function_dummy int;
begin
  -- clientes de A: uno con límite $1.000 (100000 centavos), uno sin límite
  perform t.call(uA,'a@a.com',format(sync,cA,'[{"c":"clientes","id":"cl_w1","d":{"id":"cl_w1","num":71,"status":"activo","limit":100000}},{"c":"clientes","id":"cl_w2","d":{"id":"cl_w2","num":72,"status":"activo"}},{"c":"clientes","id":"cl_w3","d":{"id":"cl_w3","num":73,"status":"activo","limit":5000000}}]'));
  -- ===== acuerdos especiales =====
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"acuer","id":"ag1","d":{"id":"ag1","cust":"cl_w1","pid":"p1","price":8000,"pct":0,"active":true}}]'));
  perform t.chk('admin crea un acuerdo especial válido', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"acuer","id":"ag2","d":{"id":"ag2","cust":"cl_w1","pid":"p1","price":8000,"pct":10,"active":true}}]'));
  perform t.chk('acuerdo con precio Y porcentaje: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"acuer","id":"ag3","d":{"id":"ag3","cust":"nadie","pid":"p1","price":8000,"pct":0}}]'));
  perform t.chk('acuerdo de un cliente inexistente: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"acuer","id":"ag4","d":{"id":"ag4","cust":"cl_w1","pid":"p1","price":0,"pct":100}}]'));
  perform t.chk('acuerdo con 100 % de descuento: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"acuer","id":"ag5","d":{"id":"ag5","cust":"cl_w1","price":8000,"pct":0}}]'));
  perform t.chk('acuerdo sin producto ni rubro: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"acuer","id":"ag6","d":{"id":"ag6","cust":"cl_w1","pid":"p1","price":1,"pct":0}}]'));
  perform t.chk('un mostrador NO crea acuerdos', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"acuer","id":"ag1","d":{"id":"ag1","cust":"cl_w1","pid":"p1","price":8000,"pct":0,"active":false}}]'));
  perform t.chk('el acuerdo se puede desactivar (se edita)', (r->>'aplicados')::int=1 and (select (datos->>'active')::boolean=false from public.registros where coleccion='acuer' and id='ag1'), r::text);
  -- ===== excepciones de crédito =====
  r := t.call(uA,'a@a.com',format(sync,cA,format('[{"c":"cexc","id":"ov1","d":{"id":"ov1","cust":"cl_w1","max":200000,"until":%s,"reason":"Cliente histórico, paga el viernes","by":"ADMIN"}}]',(extract(epoch from now())*1000+86400000)::bigint)));
  perform t.chk('admin autoriza una excepción de crédito', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"cexc","id":"ov2","d":{"id":"ov2","cust":"cl_w1","max":200000,"until":9999999999999,"reason":"no"}}]'));
  perform t.chk('excepción sin motivo suficiente: rechazada', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"cexc","id":"ov3","d":{"id":"ov3","cust":"cl_w1","max":1500.5,"until":9999999999999,"reason":"monto con decimales"}}]'));
  perform t.chk('excepción con monto no entero: rechazada', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"cexc","id":"ov4","d":{"id":"ov4","cust":"cl_w1","max":100,"until":9999999999999,"reason":"intento de mostrador"}}]'));
  perform t.chk('un mostrador NO autoriza excepciones', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"cexc","id":"ov1","d":{"id":"ov1","cust":"cl_w1","max":999999999,"until":9999999999999,"reason":"cambio de monto después"}}]'));
  perform t.chk('una excepción ya escrita no se modifica (una sola vez)', (r->>'omitidos')::int=1 and (select (datos->>'max')::numeric=200000 from public.registros where coleccion='cexc' and id='ov1'), r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"cexcu","id":"u1","d":{"id":"u1","ov":"ov1","sale":"v1","amt":150000}},{"c":"cexcu","id":"u2","d":{"id":"u2","ov":"noexiste","sale":"v2","amt":1}}]'));
  perform t.chk('el mostrador registra el uso de una excepción existente, no de una inexistente', (r->>'aplicados')::int=1 and jsonb_array_length(r->'rechazos')=1, r::text);
  -- ===== ventas: canal y revisión de crédito =====
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vw1","d":{"id":"vw1","n":"2-1","ts":1,"total":50000,"status":"ok","wch":"mayorista","cust":"","pays":[{"m":"efectivo","a":50000}]}}]'));
  perform t.chk('venta mayorista sin cliente: rechazada', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vw2","d":{"id":"vw2","n":"2-2","ts":2,"total":50000,"status":"ok","wch":"mayorista","cust":"fantasma","pays":[{"m":"efectivo","a":50000}]}}]'));
  perform t.chk('venta mayorista con cliente inexistente: rechazada', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vw3","d":{"id":"vw3","n":"2-3","ts":3,"total":50000,"status":"ok","wch":"cualquiera","cust":"cl_w1","pays":[{"m":"efectivo","a":50000}]}}]'));
  perform t.chk('canal de venta inválido: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vw4","d":{"id":"vw4","n":"2-4","ts":4,"total":50000,"status":"ok","wch":"mayorista","cust":"cl_w1","pays":[{"m":"efectivo","a":50000}]}}]'));
  perform t.chk('venta mayorista al contado con cliente válido: se acepta', (r->>'aplicados')::int=1 and not (select datos ? 'credit_review' from public.registros where coleccion='ventas' and id='vw4'), r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vw5","d":{"id":"vw5","n":"2-5","ts":5,"total":60000,"status":"ok","cust":"cl_w1","credit_review":false,"pays":[{"m":"fiado","a":60000}]}}]'));
  perform t.chk('cta. cte. dentro del límite: sin marca de revisión (y se ignora la marca falsa del equipo)', (r->>'aplicados')::int=1 and not (select datos ? 'credit_review' from public.registros where coleccion='ventas' and id='vw5'), r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vw6","d":{"id":"vw6","n":"2-6","ts":6,"total":150000,"status":"ok","cust":"cl_w1","pays":[{"m":"fiado","a":150000}]}}]'));
  perform t.chk('supera el límite: NO se rechaza (trabajo sin conexión) pero queda marcada para revisión', (r->>'aplicados')::int=1 and (select (datos->>'credit_review')::boolean and datos->>'crw'='supera_limite' from public.registros where coleccion='ventas' and id='vw6'), r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vw7","d":{"id":"vw7","n":"2-7","ts":7,"total":30000,"status":"ok","cust":"cl_w2","pays":[{"m":"fiado","a":30000}]}}]'));
  perform t.chk('cliente sin límite: marcada sin_limite', (select datos->>'crw'='sin_limite' from public.registros where coleccion='ventas' and id='vw7'), r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vw8","d":{"id":"vw8","n":"2-8","ts":8,"total":180000,"status":"ok","cust":"cl_w1","cov":"ov1","pays":[{"m":"fiado","a":180000}]}}]'));
  perform t.chk('con excepción válida del mismo cliente: sin marca de revisión', (r->>'aplicados')::int=1 and not (select datos ? 'credit_review' from public.registros where coleccion='ventas' and id='vw8'), r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vw9","d":{"id":"vw9","n":"2-9","ts":9,"total":180000,"status":"ok","cust":"cl_w3","cov":"ov1","pays":[{"m":"fiado","a":180000}]}}]'));
  perform t.chk('excepción de OTRO cliente: no vale (cl_w3 tiene límite alto, no se marca)', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vw10","d":{"id":"vw10","n":"2-10","ts":10,"total":900000,"status":"ok","cust":"cl_w1","cov":"ov1","pays":[{"m":"fiado","a":900000}]}}]'));
  perform t.chk('excepción insuficiente (monto mayor al autorizado): marcada con excepcion_invalida', (select (datos->>'credit_review')::boolean and datos->>'crw' like '%excepcion_invalida' from public.registros where coleccion='ventas' and id='vw10'), (select datos::text from public.registros where coleccion='ventas' and id='vw10'));
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vw6","d":{"id":"vw6","n":"2-6","ts":6,"total":150000,"status":"anulada","cust":"cl_w1","pays":[{"m":"fiado","a":150000}]}}]'));
  perform t.chk('al reenviar/actualizar la venta se conserva la marca de revisión', (select (datos->>'credit_review')::boolean from public.registros where coleccion='ventas' and id='vw6'), r::text);
  -- ===== aislamiento A/B =====
  r := t.call(uB,'b@b.com',format(sync,cB,'[{"c":"cexcu","id":"ub1","d":{"id":"ub1","ov":"ov1","sale":"x","amt":1}}]'));
  perform t.chk('aislamiento: B no puede consumir una excepción de A', (r->>'aplicados')::int=0, r::text);
  perform t.chk('aislamiento: B no ve los acuerdos ni las excepciones de A', (t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.registros where comercio_id=%L and coleccion in ('acuer','cexc','cexcu')$q$,cA)))::text='0');
  perform t.chk('rave_deuda_cliente no es ejecutable desde la API', not has_function_privilege('authenticated','public.rave_deuda_cliente(uuid,text)','execute'));
  perform t.chk('deuda calculada desde las ventas (cl_w1 = 60.000 + 150.000 anulada=NO + 180.000 + 900.000)', public.rave_deuda_cliente(cA,'cl_w1') = 60000+180000+900000, public.rave_deuda_cliente(cA,'cl_w1')::text);
end $$;
