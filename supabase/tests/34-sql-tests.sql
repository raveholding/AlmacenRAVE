-- 26-reparto.sql: rol repartidor, colecciones envio/ruta/rendrep, pedidos del menú cifrados y seguimiento sin datos personales
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uB uuid := '00000000-0000-0000-0000-00000000000b';
  uR uuid := '00000000-0000-0000-0000-0000000000d1';
  cA uuid := t.ctxget('cA')::uuid; slugA text; r jsonb; box text := '{"k":"a","iv":"b","ct":"c"}'; ref1 text := 'refREPARTO12345678901';
begin
  select slug into slugA from public.comercios where id=cA;
  insert into auth.users(id,email) values (uR,'rep@a.com') on conflict do nothing;
  insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uR,'repartidor','rep@a.com','Cadete') on conflict (comercio_id,usuario_id) do update set rol='repartidor';
  perform t.chk('34: existe el rol repartidor', exists(select 1 from public.miembros where usuario_id=uR and rol='repartidor'));
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(true) from (select public.cambiar_rol(%L,%L,'repartidor')) x$q$, cA, uR));
  perform t.chk('34: el admin puede asignar el rol repartidor', not (r ? 'err'), r::text);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(true) from (select public.cambiar_rol(%L,%L,'cadete')) x$q$, cA, uR));
  perform t.chk('34: un rol inventado sigue rechazado', r ? 'err', r::text);
  -- sincronización
  r := t.call(uR,'rep@a.com',format($q$select public.sincronizar(%L,'devR','[{"c":"envio","id":"e34","d":{"estado":"en_ruta","__pii":"x"}},{"c":"ruta","id":"r34","d":{"estado":"en_curso"}}]'::jsonb)$q$,cA));
  perform t.chk('34: el repartidor escribe envíos y su hoja de ruta', (r->>'aplicados')::int=2, r::text);
  r := t.call(uR,'rep@a.com',format($q$select public.sincronizar(%L,'devR','[{"c":"ventas","id":"v34","d":{"total":1}},{"c":"movs","id":"m34","d":{"amount":1}},{"c":"clientes","id":"c34","d":{}},{"c":"rendrep","id":"rr34","d":{}},{"c":"cfg","id":"cfg","d":{}}]'::jsonb)$q$,cA));
  perform t.chk('34: el repartidor NO escribe ventas, caja, clientes, rendiciones ni configuración', coalesce((r->>'aplicados')::int,0)=0, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"rendrep","id":"rr35","d":{"esperado":100}}]'::jsonb)$q$,cA));
  perform t.chk('34: el admin registra una rendición', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"rendrep","id":"rr35","d":{"esperado":1}}]'::jsonb)$q$,cA));
  perform t.chk('34: una rendición no se reescribe', coalesce((r->>'aplicados')::int,0)=0, r::text);
  perform t.chk('34: mostrador y supervisor despachan y rinden', public.rave_puede_escribir('mostrador','envio','x') and public.rave_puede_escribir('mostrador','ruta','x') and public.rave_puede_escribir('mostrador','rendrep','x') and public.rave_puede_escribir('supervisor','rendrep','x'));
  perform t.chk('34: el operador sólo carga envíos', public.rave_puede_escribir('operador','envio','x') and not public.rave_puede_escribir('operador','ruta','x'));
  perform t.chk('34: los roles anteriores no cambian', public.rave_puede_escribir('mostrador','ventas','x') and not public.rave_puede_escribir('mostrador','prod','x') and public.rave_puede_escribir('supervisor','hrreq','x'));
  -- pedidos del menú
  r := t.call(null,'',format($q$select public.reparto_pedir(%L,%L,%L::jsonb)$q$, slugA, ref1, box),'anon');
  perform t.chk('34: sin reparto publicado en el menú no se aceptan pedidos', r::text like '%"ok": false%', r::text);
  insert into public.menus(comercio_id,hash,contenido) values (cA,'h34','{"site":{"rep":{"on":true}}}'::jsonb)
    on conflict (comercio_id) do update set contenido = jsonb_set(coalesce(public.menus.contenido,'{}'::jsonb),'{site}',coalesce(public.menus.contenido->'site','{}'::jsonb)||'{"rep":{"on":true}}'::jsonb);
  r := t.call(null,'',format($q$select public.reparto_pedir(%L,%L,'{"x":1}'::jsonb)$q$, slugA, ref1),'anon');
  perform t.chk('34: pedido sin cifrar se rechaza', r::text like '%"ok": false%', r::text);
  r := t.call(null,'',format($q$select public.reparto_pedir(%L,'corto',%L::jsonb)$q$, slugA, box),'anon');
  perform t.chk('34: referencia inválida se rechaza', r::text like '%"ok": false%', r::text);
  r := t.call(null,'',format($q$select public.reparto_pedir(%L,%L,%L::jsonb)$q$, slugA, ref1, box),'anon');
  perform t.chk('34: el cliente (anon) manda su pedido cifrado', r::text like '%"ok": true%', r::text);
  r := t.call(null,'',format($q$select public.reparto_pedir(%L,%L,%L::jsonb)$q$, slugA, ref1, box),'anon');
  perform t.chk('34: reintentar el mismo pedido no lo duplica', (select count(*) from public.reparto_web where ref=ref1)=1);
  r := t.call(null,'',$q$select count(*) from public.reparto_web$q$,'anon');
  perform t.chk('34: anon no lee los pedidos', r ? 'err');
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.reparto_web where comercio_id=%L$q$,cA));
  perform t.chk('34: otro comercio no ve los pedidos de A', coalesce((r#>>'{}')::int,0)=0 or r ? 'err', r::text);
  r := t.call(uR,'rep@a.com',format($q$select to_jsonb(count(*)) from public.reparto_web where comercio_id=%L$q$,cA));
  perform t.chk('34: el repartidor no lee los pedidos cifrados del menú', coalesce((r#>>'{}')::int,0)=0 or r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.reparto_web_marcar(%L,array[(select id from public.reparto_web where ref=%L)],'importado')$q$, cA, ref1));
  perform t.chk('34: el sistema marca el pedido como importado', (select estado from public.reparto_web where ref=ref1)='importado', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.reparto_web_marcar(%L,array[1::bigint],'importado')$q$, cA));
  perform t.chk('34: otro comercio no marca pedidos ajenos', r ? 'err');
  -- seguimiento
  r := t.call(null,'',format($q$select public.reparto_estado_ver(%L,array[%L])$q$, slugA, ref1),'anon');
  perform t.chk('34: el cliente ve «recibido» apenas manda el pedido', r::text like '%recibido%', r::text);
  r := t.call(uR,'rep@a.com',format($q$select public.reparto_estado_poner(%L,%L,'en_camino','15 min','Juan',null)$q$, cA, ref1));
  perform t.chk('34: el repartidor actualiza el estado', not (r ? 'err'), r::text);
  r := t.call(null,'',format($q$select public.reparto_estado_ver(%L,array[%L])$q$, slugA, ref1),'anon');
  perform t.chk('34: el cliente ve «en camino», demora y repartidor, sin datos personales', r::text like '%en_camino%' and r::text like '%15 min%' and r::text not like '%cifrado%' and r::text not like '%rep@a.com%', r::text);
  r := t.call(null,'',format($q$select public.reparto_estado_ver(%L,array['otraREFERENCIA1234567'])$q$, slugA),'anon');
  perform t.chk('34: con otra referencia no se ve nada', r::text like '%"pedidos": []%', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.reparto_estado_poner(%L,%L,'entregado',null,null,null)$q$, cA, ref1));
  perform t.chk('34: otro comercio no cambia el estado', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.reparto_estado_poner(%L,%L,'volando',null,null,null)$q$, cA, ref1));
  perform t.chk('34: estado inventado se rechaza', r ? 'err');
  r := t.call(null,'',$q$select count(*) from public.reparto_seguimiento$q$,'anon');
  perform t.chk('34: anon no lee la tabla de seguimiento', r ? 'err');
end $$;
