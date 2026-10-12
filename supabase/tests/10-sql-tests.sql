-- Pruebas SQL de la nube (Postgres local + shim de Supabase). Cada check imprime OK / FALLA.
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
drop schema if exists t cascade; create schema t;
create table t.res(n serial, name text, ok boolean, info text);
create table t.ctx(k text primary key, v text);
-- ejecuta una consulta que devuelve jsonb como un usuario; devuelve {"err": ...} si falla
create function t.call(uid uuid, email text, q text, rol text default 'authenticated') returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',uid,'email',email,'role',rol)::text, true);
  execute 'set local role ' || rol;
  begin execute q into r; exception when others then r := jsonb_build_object('err', sqlerrm, 'code', sqlstate); end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return r;
end $$;
create function t.chk(name text, cond boolean, info text default null) returns void language sql as $$
  insert into t.res(name, ok, info) values (name, coalesce(cond,false), info) $$;
create function t.ctxset(k text, v text) returns void language sql as $$ insert into t.ctx values (k, v) on conflict (k) do update set v = excluded.v $$;
create function t.ctxget(k text) returns text language sql as $$ select v from t.ctx where t.ctx.k = k $$;

insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-00000000000a','a@a.com'),('00000000-0000-0000-0000-0000000000a2','a2@a.com'),('00000000-0000-0000-0000-0000000000a3','a3@a.com'),
 ('00000000-0000-0000-0000-00000000000b','b@b.com'),('00000000-0000-0000-0000-0000000000e1','eve@x.com');

do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA2 uuid := '00000000-0000-0000-0000-0000000000a2'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3';
  uB uuid := '00000000-0000-0000-0000-00000000000b'; uE uuid := '00000000-0000-0000-0000-0000000000e1';
  r jsonb; cA uuid; cB uuid; huella text := repeat('ab', 32); n int;
begin
  -- ===== 01 base: invitaciones y alta de comercio =====
  r := t.call(uE,'eve@x.com',$q$select to_jsonb(public.rave_invitar_comercio('eve@x.com','X','CODIGO-123'))$q$);
  perform t.chk('anon/usuario NO puede crear invitaciones de comercio', r ? 'err');
  perform public.rave_invitar_comercio('a@a.com','Comercio A','CODIGO-A-1');
  perform public.rave_invitar_comercio('b@b.com','Comercio B','CODIGO-B-1');
  r := t.call(uE,'eve@x.com',$q$select public.crear_comercio('Robo','comercio','CODIGO-A-1')$q$);
  perform t.chk('sin invitación no se crea comercio', r ? 'err');
  r := t.call(uA,'a@a.com',$q$select public.crear_comercio('X','comercio','mal-codigo')$q$);
  perform t.chk('código incorrecto → ok:false', (r->>'ok')='false', r::text);
  select intentos into n from public.invitaciones where lower(email)='a@a.com' and comercio_id is null;
  perform t.chk('el contador de intentos persiste', n=1, 'intentos='||coalesce(n::text,'null'));
  for i in 1..8 loop r := t.call(uA,'a@a.com',$q$select public.crear_comercio('X','comercio','mal')$q$); end loop;
  r := t.call(uA,'a@a.com',$q$select public.crear_comercio('X','comercio','CODIGO-A-1')$q$);
  perform t.chk('bloqueo tras 8 intentos (aún con el código bueno)', (r->>'ok')='false', r::text);
  perform public.rave_invitar_comercio('a@a.com','Comercio A','CODIGO-A-1');
  r := t.call(uA,'a@a.com',$q$select public.crear_comercio('X','comercio','CODIGO-A-1')$q$);
  perform t.chk('alta de comercio A con invitación nueva', (r->>'ok')='true', r::text); cA := (r->>'id')::uuid;
  r := t.call(uB,'b@b.com',$q$select public.crear_comercio('X','gastronomia','CODIGO-B-1')$q$);
  perform t.chk('alta de comercio B', (r->>'ok')='true', r::text); cB := (r->>'id')::uuid;
  perform t.ctxset('cA',cA::text); perform t.ctxset('cB',cB::text);
  r := t.call(uA,'a@a.com',$q$select public.crear_comercio('Otro','comercio','CODIGO-A-1')$q$);
  perform t.chk('la invitación es de un solo uso', r ? 'err' or (r->>'ok')='false');

  -- ===== RLS: A no ve B =====
  r := t.call(uA,'a@a.com',$q$select to_jsonb(count(*)) from public.comercios$q$);
  perform t.chk('A sólo ve su comercio', r::text='1', r::text);
  r := t.call(uE,'eve@x.com',$q$select to_jsonb(count(*)) from public.comercios$q$);
  perform t.chk('un extraño no ve ningún comercio', r::text='0', r::text);
  r := t.call(uE,'eve@x.com',$q$select to_jsonb(count(*)) from public.miembros$q$);
  perform t.chk('un extraño no ve miembros', r::text='0');
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"prod","id":"p1","d":{"name":"X"}}]'::jsonb)$q$, cB));
  perform t.chk('A no puede escribir en B', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(count(*)) from public.bajar(%L)$q$, cB));
  perform t.chk('A no puede bajar datos de B', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',$q$insert into public.registros(comercio_id,coleccion,id) values (gen_random_uuid(),'prod','x') returning to_jsonb(1)$q$);
  perform t.chk('INSERT directo a registros prohibido', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$update public.miembros set rol='admin' where comercio_id=%L returning to_jsonb(1)$q$, cA));
  perform t.chk('UPDATE directo a miembros prohibido', r ? 'err');
  r := t.call(null,'', $q$select to_jsonb(count(*)) from public.comercios$q$, 'anon');
  perform t.chk('anon no lee comercios', r ? 'err');
  r := t.call(null,'', $q$select to_jsonb(count(*)) from public.registros$q$, 'anon');
  perform t.chk('anon no lee registros', r ? 'err');

  -- ===== equipo: invitar, aceptar, roles =====
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.invitar_miembro(%L,'a2@a.com','mostrador','Caja 2',%L,'{"kdf":{},"wrap":{}}'::jsonb))$q$, cA, huella));
  perform t.chk('admin invita a un mostrador', not (r ? 'err'), r::text);
  r := t.call(uA2,'a2@a.com',format($q$select public.aceptar_invitacion(%L)$q$, repeat('cd',32)));
  perform t.chk('huella incorrecta no entra', (r->>'ok')='false', r::text);
  r := t.call(uA2,'a2@a.com',format($q$select public.aceptar_invitacion(%L)$q$, huella));
  perform t.chk('huella correcta entra al equipo', (r->>'ok')='true', r::text);
  r := t.call(uA2,'a2@a.com',format($q$select to_jsonb(public.invitar_miembro(%L,'x@x.com','admin','X',%L,null))$q$, cA, huella));
  perform t.chk('un mostrador NO puede invitar', r ? 'err');
  r := t.call(uA2,'a2@a.com',format($q$select to_jsonb(public.cambiar_rol(%L,%L,'admin'))$q$, cA, uA2));
  perform t.chk('un mostrador NO se sube el rol', r ? 'err');
  perform public.rave_invitar_comercio('x@x.com','x','CODIGO-XX-1');
  r := t.call(uE,'eve@x.com',format($q$select public.aceptar_invitacion(%L)$q$, huella));
  perform t.chk('una invitación ajena (otro correo) no la usa un tercero', (r->>'ok')='false', r::text);

  -- ===== sincronizar: roles y reglas =====
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1',%L::jsonb)$q$, cA,
    '[{"c":"prod","id":"p1","d":{"name":"Fernet","price":1000,"stock":999}},{"c":"cfg","id":"integ","d":{"apiKey":"SECRETO","x":1,"arcaKey":"k"}}]'));
  perform t.chk('admin escribe productos y cfg', (r->>'aplicados')::int=2, r::text);
  select datos->>'stock' into n from public.registros where coleccion='prod' and id='p1'; 
  perform t.chk('el stock enviado por el navegador se ignora (0)', n=0, 'stock='||n);
  perform t.chk('los secretos se quitan de cfg', (select not (datos ? 'apiKey') and not (datos ? 'arcaKey') and datos ? 'x' from public.registros where coleccion='cfg' and id='integ'));
  r := t.call(uA2,'a2@a.com',format($q$select public.sincronizar(%L,'devA2','[{"c":"prod","id":"p2","d":{"name":"Hack"}},{"c":"ventas","id":"v0","d":{"n":"2-1","total":100}}]'::jsonb)$q$, cA));
  perform t.chk('mostrador no escribe productos pero sí ventas', (r->>'aplicados')::int=1 and jsonb_array_length(r->'rechazos')=1, r::text);
  r := t.call(uA2,'a2@a.com',format($q$select public.sincronizar(%L,'devA2','[{"c":"cfg","id":"integ","d":{}},{"c":"cfg","id":"menu","d":{}}]'::jsonb)$q$, cA));
  perform t.chk('mostrador no toca la configuración', (r->>'aplicados')::int=0, r::text);
  -- stock por movimientos
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"smov","id":"m1","d":{"pid":"p1","d":50}},{"c":"smov","id":"m2","d":{"pid":"p1","d":-3}}]'::jsonb)$q$, cA));
  select (datos->>'stock')::numeric into n from public.registros where coleccion='prod' and id='p1';
  perform t.chk('stock = suma de movimientos (47)', n=47, 'stock='||n);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"smov","id":"m1","d":{"pid":"p1","d":50}},{"c":"smov","id":"m2","d":{"pid":"p1","d":-3}}]'::jsonb)$q$, cA));
  select (datos->>'stock')::numeric into n from public.registros where coleccion='prod' and id='p1';
  perform t.chk('reenviar el mismo lote NO duplica movimientos (idempotente)', n=47 and (r->>'omitidos')::int=2, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"prod","id":"p1","d":{"name":"Fernet 750","price":1200,"stock":5}}]'::jsonb)$q$, cA));
  select (datos->>'stock')::numeric into n from public.registros where coleccion='prod' and id='p1';
  perform t.chk('editar el producto NO pisa el stock del servidor', n=47, 'stock='||n);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"smov","id":"m9","d":{"pid":"noexiste","d":1}}]'::jsonb)$q$, cA));
  perform t.chk('movimiento de un producto inexistente se rechaza', jsonb_array_length(r->'rechazos')=1, r::text);
  -- caja cerrada congelada
  perform t.call(uA2,'a2@a.com',format($q$select public.sincronizar(%L,'devA2','[{"c":"turnos","id":"t1","d":{"openAt":1,"closedAt":0,"total":0}}]'::jsonb)$q$, cA));
  r := t.call(uA2,'a2@a.com',format($q$select public.sincronizar(%L,'devA2','[{"c":"turnos","id":"t1","d":{"openAt":1,"closedAt":99,"total":500}}]'::jsonb)$q$, cA));
  perform t.chk('se puede cerrar la caja', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA2,'a2@a.com',format($q$select public.sincronizar(%L,'devA2','[{"c":"turnos","id":"t1","d":{"openAt":1,"closedAt":99,"total":1}}]'::jsonb)$q$, cA));
  perform t.chk('una caja cerrada NO se modifica', (r->>'aplicados')::int=0 and jsonb_array_length(r->'rechazos')=1, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"turnos","id":"t1","d":{"closedAt":99,"total":1}}]'::jsonb)$q$, cA));
  perform t.chk('ni siquiera el admin modifica una caja cerrada', (r->>'aplicados')::int=0, r::text);
  -- audit una vez
  perform t.call(uA2,'a2@a.com',format($q$select public.sincronizar(%L,'devA2','[{"c":"audit","id":"au1","d":{"msg":"uno"}}]'::jsonb)$q$, cA));
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"audit","id":"au1","d":{"msg":"CAMBIADO"}}]'::jsonb)$q$, cA));
  perform t.chk('la auditoría no se reescribe', (select datos->>'msg' from public.registros where coleccion='audit' and id='au1')='uno', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"ventas","id":"vx","d":{}},{"c":"audit","id":"au1","d":{}},{"c":"audit","id":"au2","d":{}}]'::jsonb)$q$, cA));
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"audit","id":"au1","x":true}]'::jsonb)$q$, cA));
  perform t.chk('la auditoría no se borra', jsonb_array_length(r->'rechazos')=1, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"inventada","id":"z","d":{}}]'::jsonb)$q$, cA));
  perform t.chk('colección fuera de la lista cerrada', jsonb_array_length(r->'rechazos')=1);
  -- CAE protegido
  perform t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"ventas","id":"vc","d":{"n":"1-5","total":1000,"arca":{"cae":"FALSO"}}}]'::jsonb)$q$, cA));
  perform t.chk('el navegador NO puede inventar un CAE', (select not (datos ? 'arca') from public.registros where coleccion='ventas' and id='vc'));
  update public.registros set datos = datos || '{"arca":{"cae":"74123456789012","nro":7}}' where coleccion='ventas' and id='vc';
  perform t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA1','[{"c":"ventas","id":"vc","d":{"n":"1-5","total":5,"items":[],"arca":null,"anulada":true}}]'::jsonb)$q$, cA));
  perform t.chk('con CAE: ni el total ni el CAE se pisan', (select datos->>'total'='1000' and datos->'arca'->>'cae'='74123456789012' and datos->>'anulada'='true' from public.registros where coleccion='ventas' and id='vc'));
  -- bajar: aislamiento
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.bajar(%L)$q$, cB));
  perform t.chk('B baja y no ve nada de A', r::text='0', r::text);
  r := t.call(uB,'b@b.com',$q$select to_jsonb(count(*)) from public.registros$q$);
  perform t.chk('RLS: B no ve registros de A en la tabla', r::text='0', r::text);
  -- quitar miembro corta el acceso
  perform t.call(uA,'a@a.com',format($q$select to_jsonb(public.quitar_miembro(%L,%L))$q$, cA, uA2));
  r := t.call(uA2,'a2@a.com',format($q$select public.sincronizar(%L,'devA2','[{"c":"ventas","id":"v5","d":{}}]'::jsonb)$q$, cA));
  perform t.chk('quitar a alguien le corta el acceso', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.quitar_miembro(%L,%L))$q$, cA, uA));
  perform t.chk('no se puede quitar al único administrador', r ? 'err');
end $$;
