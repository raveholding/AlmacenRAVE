-- 16-ajustes-medios-pago.sql: cfg/payadj sólo administrador y pagos con ajuste (a = b + adj)
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA2 uuid := '00000000-0000-0000-0000-0000000000a2'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3';
  uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid; cB uuid := (select comercio_id from public.miembros where usuario_id='00000000-0000-0000-0000-00000000000b' limit 1);
  r jsonb; rol2 text; rol3 text;
  sync text := $q$select public.sincronizar(%L,'devPA',%L::jsonb)$q$;
  cfgj text := '[{"c":"cfg","id":"payadj","d":{"on":true,"stack":false,"rules":{"efectivo":{"sign":-1,"kind":"pct","v":1000,"ver":1}}}}]';
begin
  select rol into rol2 from public.miembros where comercio_id=cA and usuario_id=uA2;
  select rol into rol3 from public.miembros where comercio_id=cA and usuario_id=uA3;
  if rol2 is null then insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uA2,'supervisor','a2@a.com','Sup PA'); end if;
  update public.miembros set rol='supervisor' where comercio_id=cA and usuario_id=uA2;
  update public.miembros set rol='mostrador' where comercio_id=cA and usuario_id=uA3;
  -- ===== configuración =====
  r := t.call(uA,'a@a.com',format(sync,cA,cfgj));
  perform t.chk('16: el administrador guarda cfg/payadj', (r->>'aplicados')::int=1, r::text);
  perform t.chk('16: queda guardado en registros', exists(select 1 from public.registros where comercio_id=cA and coleccion='cfg' and id='payadj' and datos->'rules'->'efectivo'->>'v'='1000'));
  r := t.call(uA2,'a2@a.com',format(sync,cA,replace(cfgj,'1000','9000')));
  perform t.chk('16: el supervisor NO puede escribir cfg/payadj', (r->>'aplicados')::int=0 and (select datos->'rules'->'efectivo'->>'v' from public.registros where comercio_id=cA and coleccion='cfg' and id='payadj')='1000', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,replace(cfgj,'1000','9000')));
  perform t.chk('16: el mostrador NO puede escribir cfg/payadj', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA2,'a2@a.com',format(sync,cA,'[{"c":"cfg","id":"cfg","d":{"biz":"rubros"}}]'));
  perform t.chk('16: el supervisor sigue pudiendo escribir cfg/cfg (sin cambios)', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"cfg","id":"payadjX","d":{}}]'));
  perform t.chk('16: una configuración desconocida sigue rechazada', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format($q$select coalesce(jsonb_agg(id),'[]') from public.registros where comercio_id=%L and coleccion='cfg' and id='payadj'$q$,cA));
  perform t.chk('16: el mostrador LEE cfg/payadj (lo necesita para cobrar)', r::text like '%payadj%', r::text);
  r := t.call(uB,'b@b.com',format($q$select coalesce(jsonb_agg(id),'[]') from public.registros where comercio_id=%L and coleccion='cfg' and id='payadj'$q$,cA));
  perform t.chk('16: otro comercio NO ve el payadj de A (RLS)', r::text not like '%payadj%', r::text);
  -- ===== ventas con ajuste =====
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vpa1","d":{"id":"vpa1","n":"1-901","total":900000,"status":"ok","method":"efectivo","items":[{"pid":"p1","qty":1,"price":1000000,"pa":-100000}],"pays":[{"m":"efectivo","a":900000,"b":1000000,"adj":-100000}],"adj":[{"m":"efectivo","sign":-1,"kind":"pct","v":1000,"amt":-100000}]}}]'));
  perform t.chk('16: venta con descuento por efectivo válida (9.000 = 10.000 − 1.000)', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vpa2","d":{"id":"vpa2","n":"1-902","total":1100000,"status":"ok","method":"credito","items":[],"pays":[{"m":"credito","a":1100000,"b":1000000,"adj":100000}]}}]'));
  perform t.chk('16: venta con recargo a crédito válida (11.000)', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vpa3","d":{"id":"vpa3","n":"1-903","total":900000,"status":"ok","method":"efectivo","items":[],"pays":[{"m":"efectivo","a":900000,"b":1000000,"adj":-50000}]}}]'));
  perform t.chk('16: a ≠ b + adj → rechazada', (r->>'aplicados')::int=0 and r::text like '%ajuste por medio de pago%', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vpa4","d":{"id":"vpa4","n":"1-904","total":900000,"status":"ok","method":"efectivo","items":[],"pays":[{"m":"efectivo","a":900000,"adj":-100000}]}}]'));
  perform t.chk('16: ajuste sin base → rechazada', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vpa5","d":{"id":"vpa5","n":"1-905","total":980000,"status":"ok","method":"mixto","items":[],"pays":[{"m":"efectivo","a":540000,"b":600000,"adj":-60000},{"m":"credito","a":440000,"b":400000,"adj":40000}]}}]'));
  perform t.chk('16: mixto con dos ajustes (5.400 + 4.400 = 9.800) válido', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vpa6","d":{"id":"vpa6","n":"1-906","total":1000000,"status":"ok","method":"mixto","items":[],"pays":[{"m":"efectivo","a":540000,"b":600000,"adj":-60000},{"m":"credito","a":440000,"b":400000,"adj":40000}]}}]'));
  perform t.chk('16: suma de pagos ≠ total sigue rechazada', (r->>'aplicados')::int=0, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vpa7","d":{"id":"vpa7","n":"1-907","total":1000000,"status":"ok","method":"efectivo","items":[],"pays":[{"m":"efectivo","a":1000000}]}}]'));
  perform t.chk('16: venta sin ajuste igual que siempre', (r->>'aplicados')::int=1, r::text);
  if rol2 is null then delete from public.miembros where comercio_id=cA and usuario_id=uA2; else update public.miembros set rol=rol2 where comercio_id=cA and usuario_id=uA2; end if;
  update public.miembros set rol=rol3 where comercio_id=cA and usuario_id=uA3;
end $$;
