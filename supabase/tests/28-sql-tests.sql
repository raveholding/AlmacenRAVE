-- 20-fidelizacion-operacion.sql: monedero, gift cards, juego, devoluciones, mermas y presupuestos
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3';
  uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid;
  r jsonb; rol3 text;
  sync text := $q$select public.sincronizar(%L,'devFID',%L::jsonb)$q$;
begin
  select rol into rol3 from public.miembros where comercio_id=cA and usuario_id=uA3;
  if rol3 is null then insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uA3,'mostrador','a3@a.com','Most FID'); end if;
  update public.miembros set rol='mostrador' where comercio_id=cA and usuario_id=uA3;
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"fidmov","id":"fm1","d":{"id":"fm1","cust":"c1","kind":"carga","amount":500000}}]'));
  perform t.chk('28: el mostrador carga el monedero', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"fidmov","id":"fm1","d":{"id":"fm1","cust":"c1","kind":"carga","amount":900000}}]'));
  perform t.chk('28: el libro del monedero no se reescribe', (select datos->>'amount' from public.registros where comercio_id=cA and coleccion='fidmov' and id='fm1')='500000', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"fidmov","id":"fm2","d":{"id":"fm2","cust":"c1","kind":"carga","amount":10.5}}]'));
  perform t.chk('28: monedero con importe no entero rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"fidmov","id":"fm3","d":{"id":"fm3","cust":"c1","kind":"regalo","amount":100}}]'));
  perform t.chk('28: monedero con tipo desconocido rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"fidmov","id":"fm4","d":{"id":"fm4","kind":"carga","amount":100}}]'));
  perform t.chk('28: monedero sin cliente rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"fidmov","id":"fm5","d":{"id":"fm5","cust":"c1","kind":"pago","amount":-200000}}]'));
  perform t.chk('28: pago con monedero (negativo) aceptado', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"gift","id":"g1","d":{"id":"g1","code":"GIFT-AAAA-BBBB","status":"activa"}},{"c":"giftmov","id":"gm1","d":{"id":"gm1","gift":"g1","amount":1000000,"kind":"emision"}}]'));
  perform t.chk('28: emisión de gift card', (r->>'aplicados')::int=2, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"giftmov","id":"gm2","d":{"id":"gm2","amount":-100}}]'));
  perform t.chk('28: canje sin tarjeta rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"juego","id":"j1","d":{"id":"j1","cust":"c1","prize":"x"}},{"c":"devol","id":"d1","d":{"id":"d1","sale":"v1","total":100}},{"c":"merma","id":"m1","d":{"id":"m1","pid":"p1","qty":-1}},{"c":"presup","id":"q1","d":{"id":"q1","state":"vigente"}}]'));
  perform t.chk('28: juego, devolución, merma y presupuesto', (r->>'aplicados')::int=4, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vfid1","d":{"id":"vfid1","n":"1-950","total":300000,"status":"ok","method":"mixto","items":[],"pays":[{"m":"monedero","a":200000},{"m":"giftcard","a":100000}]}}]'));
  perform t.chk('28: venta pagada con monedero + gift card', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vfid2","d":{"id":"vfid2","n":"1-951","total":300000,"status":"ok","method":"puntos","items":[],"pays":[{"m":"puntos","a":300000}]}}]'));
  perform t.chk('28: un medio inventado sigue rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.call(uB,'b@b.com',format($q$select coalesce(jsonb_agg(id),'[]') from public.registros where comercio_id=%L and coleccion='fidmov'$q$,cA));
  perform t.chk('28: otro comercio NO ve el monedero de A (RLS)', r::text not like '%fm1%', r::text);
end $$;
