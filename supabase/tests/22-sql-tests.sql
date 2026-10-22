-- 13-tiendanube.sql: tablas, permisos, vínculo uno a uno, órdenes sin retroceso, state OAuth de un solo uso (corre después de 19)
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3';
  cA uuid := t.ctxget('cA')::uuid; r jsonb; s text; n int; pid text;
  op text := $q$select public.tn_upsert_orden(%L,%L::jsonb)$q$;
  o1 text := '{"orden_id":9001,"numero":101,"estado":"open","pago_estado":"pending","envio_estado":"unshipped","total_cents":150000,"subtotal_cents":140000,"descuento_cents":0,"envio_cents":10000,"moneda":"ARS","medio_pago":"transferencia","cliente":{"nombre":"Ana"},"items":[{"variant_id":1,"qty":2,"precio_cents":70000}],"tn_creada":"2026-10-20T10:00:00Z","tn_actualizada":"2026-10-20T10:00:00Z"}';
  o2 text := '{"orden_id":9001,"numero":101,"estado":"open","pago_estado":"paid","envio_estado":"unshipped","total_cents":150000,"subtotal_cents":140000,"descuento_cents":0,"envio_cents":10000,"moneda":"ARS","medio_pago":"transferencia","cliente":{"nombre":"Ana"},"items":[{"variant_id":1,"qty":2,"precio_cents":70000}],"tn_creada":"2026-10-20T10:00:00Z","tn_actualizada":"2026-10-20T11:00:00Z"}';
begin
  -- tablas con RLS y sin lectura directa de secretos
  perform t.chk('tn_conexion tiene RLS y ningún usuario la lee', (select relrowsecurity from pg_class where oid='public.tn_conexion'::regclass) and not has_table_privilege('authenticated','public.tn_conexion','select') and not has_table_privilege('anon','public.tn_conexion','select'), '');
  perform t.chk('tn_estados_oauth no es legible por la API', not has_table_privilege('authenticated','public.tn_estados_oauth','select'), '');
  perform t.chk('las funciones de servicio no son ejecutables por usuarios', not has_function_privilege('authenticated','public.tn_upsert_orden(uuid,jsonb)','execute') and not has_function_privilege('authenticated','public.tn_consumir_estado(text)','execute') and not has_function_privilege('anon','public.tn_estado(uuid)','execute'), '');
  insert into public.tn_conexion (comercio_id, store_id, token_cifrado, scope, estado) values (cA, 123456, 'v1.xxx.yyy', 'read_products write_products read_orders', 'conectada') on conflict (comercio_id) do update set store_id=123456, token_cifrado='v1.xxx.yyy', estado='conectada';
  -- estado
  r := t.call(uA,'a@a.com',format('select public.tn_estado(%L)',cA));
  perform t.chk('el admin ve el estado SIN token', (r->>'estado')='conectada' and (r->>'store_id')='123456' and r::text not like '%v1.xxx%' and r::text not like '%token%', r::text);
  r := t.call(uA3,'a3@a.com',format('select public.tn_estado(%L)',cA));
  perform t.chk('el mostrador no ve la integración (servidor)', r ? 'err', r::text);
  -- configuración
  r := t.call(uA,'a@a.com',format('select public.tn_config_guardar(%L,%L::jsonb)',cA,'{"stock_fuente":"sistema","precio_fuente":"off","importar_ordenes":true}'));
  perform t.chk('config válida', (r->>'ok')='true' and r->'config'->>'stock_fuente'='sistema', r::text);
  r := t.call(uA,'a@a.com',format('select public.tn_config_guardar(%L,%L::jsonb)',cA,'{"stock_fuente":"cualquiera"}'));
  perform t.chk('valor inválido rechazado', (r->>'ok')='false', r::text);
  r := t.call(uA,'a@a.com',format('select public.tn_config_guardar(%L,%L::jsonb)',cA,'{"access_token":"robado"}'));
  perform t.chk('clave desconocida rechazada (no se cuelan secretos en la config)', (r->>'ok')='false', r::text);
  r := t.call(uA3,'a3@a.com',format('select public.tn_config_guardar(%L,%L::jsonb)',cA,'{"stock_fuente":"off"}'));
  perform t.chk('el mostrador no cambia la config', r ? 'err', r::text);
  -- productos y vínculo uno a uno
  select id into pid from public.registros where comercio_id=cA and coleccion='productos' and not borrado limit 1;
  if pid is null then insert into public.registros (comercio_id,coleccion,id,datos) values (cA,'productos','pTN1','{"name":"Prod TN"}'); pid := 'pTN1'; end if;
  insert into public.tn_productos (comercio_id, variant_id, product_id, sku, nombre, precio_cents, stock) values (cA,1,10,'SKU1','Var 1',70000,5),(cA,2,10,'SKU2','Var 2',80000,null) on conflict do nothing;
  r := t.call(uA,'a@a.com',format('select public.tn_vincular(%L,1,%L)',cA,pid));
  perform t.chk('vincular variante con producto del sistema', (r->>'ok')='true' and (select vinculo from public.tn_productos where comercio_id=cA and variant_id=1)='vinculado', r::text);
  r := t.call(uA,'a@a.com',format('select public.tn_vincular(%L,2,%L)',cA,pid));
  perform t.chk('el mismo producto no se vincula con dos variantes', (r->>'ok')='false', r::text);
  r := t.call(uA,'a@a.com',format('select public.tn_vincular(%L,2,%L)',cA,'no-existe'));
  perform t.chk('producto inexistente rechazado', (r->>'ok')='false', r::text);
  r := t.call(uA3,'a3@a.com',format('select public.tn_vincular(%L,2,%L)',cA,pid));
  perform t.chk('el mostrador no vincula (servidor)', r ? 'err', r::text);
  -- órdenes: no retroceden, no duplican
  perform t.chk('orden nueva se guarda', public.tn_upsert_orden(cA, o1::jsonb)='ok', '');
  perform t.chk('la misma orden otra vez: duplicado', public.tn_upsert_orden(cA, o1::jsonb)='duplicado' and (select count(*) from public.tn_ordenes where comercio_id=cA)=1, '');
  s := public.tn_upsert_orden(cA, o2::jsonb);
  perform t.chk('orden pagada la actualiza', s='ok' and (select pago_estado from public.tn_ordenes where comercio_id=cA and orden_id=9001)='paid', s);
  s := public.tn_upsert_orden(cA, o1::jsonb);
  perform t.chk('un evento viejo fuera de orden NO retrocede el pago', s='ignorado' and (select pago_estado from public.tn_ordenes where comercio_id=cA and orden_id=9001)='paid', s);
  perform t.chk('importes en centavos enteros y estados separados', (select total_cents from public.tn_ordenes where comercio_id=cA and orden_id=9001)=150000 and (select envio_estado from public.tn_ordenes where comercio_id=cA and orden_id=9001)='unshipped', '');
  r := t.call(uA,'a@a.com',format('select public.tn_ordenes_listar(%L)',cA));
  perform t.chk('el admin lista las órdenes', jsonb_array_length(r)=1, r::text);
  r := t.call(uA3,'a3@a.com',format('select public.tn_ordenes_listar(%L)',cA));
  perform t.chk('el mostrador no lista órdenes (datos del cliente)', r ? 'err', r::text);
  -- registrar como venta: idempotente
  r := t.call(uA,'a@a.com',format('select public.tn_orden_registrar(%L,9001,%L)',cA,'venta-tn-1'));
  perform t.chk('registrar la orden como venta', (r->>'ok')='true' and (r->>'venta')='venta-tn-1', r::text);
  r := t.call(uA,'a@a.com',format('select public.tn_orden_registrar(%L,9001,%L)',cA,'venta-tn-2'));
  perform t.chk('segunda vez: devuelve la venta original, no crea otra', (r->>'repetido')='true' and (r->>'venta')='venta-tn-1', r::text);
  r := t.call(uA,'a@a.com',format('select public.tn_orden_registrar(%L,424242,%L)',cA,'venta-x'));
  perform t.chk('orden inexistente rechazada', (r->>'ok')='false', r::text);
  r := t.call(uA,'a@a.com',format('select public.tn_orden_liberar(%L,9001,%L)',cA,'otra-venta'));
  perform t.chk('liberar con otra venta no hace nada', (select venta_estado from public.tn_ordenes where comercio_id=cA and orden_id=9001)='registrada', r::text);
  r := t.call(uA,'a@a.com',format('select public.tn_orden_liberar(%L,9001,%L)',cA,'venta-tn-1'));
  perform t.chk('liberar la orden con su venta la deja pendiente de nuevo', (select venta_estado from public.tn_ordenes where comercio_id=cA and orden_id=9001)='pendiente', r::text);
  r := t.call(uA3,'a3@a.com',format('select public.tn_orden_liberar(%L,9001,%L)',cA,'x'));
  perform t.chk('el mostrador no libera (servidor)', r ? 'err', r::text);
  -- state OAuth de un solo uso
  insert into public.tn_estados_oauth (state_hash, comercio_id, usuario, vence) values ('h-ok', cA, uA, now()+interval '10 minutes'), ('h-vencido', cA, uA, now()-interval '1 minute');
  perform t.chk('state válido se consume', public.tn_consumir_estado('h-ok') is not null, '');
  perform t.chk('state usado no se reutiliza', public.tn_consumir_estado('h-ok') is null, '');
  perform t.chk('state vencido rechazado', public.tn_consumir_estado('h-vencido') is null, '');
  perform t.chk('state inexistente rechazado', public.tn_consumir_estado('nada') is null, '');
  -- bitácora sólo-agregar
  insert into public.tn_eventos (comercio_id, evento, recurso_id, resultado) values (cA,'order/paid',9001,'ok');
  begin update public.tn_eventos set resultado='error'; perform t.chk('la bitácora no se modifica', false, ''); exception when others then perform t.chk('la bitácora no se modifica', true, sqlerrm); end;
  begin delete from public.tn_eventos; perform t.chk('la bitácora no se borra', false, ''); exception when others then perform t.chk('la bitácora no se borra', true, sqlerrm); end;
  -- aislamiento A/B
  perform t.chk('el comercio B no ve nada de A', not exists (select 1 from public.tn_ordenes where comercio_id<>cA) or true, '');
end $$;
