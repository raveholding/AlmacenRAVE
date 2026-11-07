-- 19-liberar-caja.sql: sólo el administrador libera un número de caja; no puede liberar el de su propio equipo; aislamiento A/B
\set ON_ERROR_STOP off
do $$
declare uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3'; uB uuid := '00000000-0000-0000-0000-00000000000b';
 cA uuid := t.ctxget('cA')::uuid; r jsonb;
begin
  delete from public.cajas where comercio_id=cA and nro in (41,42);
  insert into public.cajas(comercio_id,nro,dispositivo,nombre) values (cA,41,'dequipo-viejo-1','Viejo'),(cA,42,'dequipo-actual-2','Actual');
  r := t.call(uA3,'a3@a.com',format('select to_jsonb(public.liberar_caja(%L,41,%L))',cA,'dotro-equipo-9'));
  perform t.chk('un mostrador no puede liberar un número de caja', r::text ilike '%error%' or r::text ilike '%administrador%', r::text);
  perform t.chk('tras el intento del mostrador la caja 41 sigue reservada', exists(select 1 from public.cajas where comercio_id=cA and nro=41), '');
  r := t.call(uB,'b@b.com',format('select to_jsonb(public.liberar_caja(%L,41,%L))',cA,'dotro-equipo-9'));
  perform t.chk('el administrador de otro comercio no puede liberar', exists(select 1 from public.cajas where comercio_id=cA and nro=41), r::text);
  r := t.call(uA,'a@a.com',format('select to_jsonb(public.liberar_caja(%L,42,%L))',cA,'dequipo-actual-2'));
  perform t.chk('no se puede liberar el número del propio equipo', exists(select 1 from public.cajas where comercio_id=cA and nro=42), r::text);
  r := t.call(uA,'a@a.com',format('select to_jsonb(public.liberar_caja(%L,41,%L))',cA,'dequipo-actual-2'));
  perform t.chk('el administrador libera el número de un equipo viejo', not exists(select 1 from public.cajas where comercio_id=cA and nro=41), r::text);
  r := t.call(uA,'a@a.com',format('select to_jsonb(public.liberar_caja(%L,41,%L))',cA,'dequipo-actual-2'));
  perform t.chk('liberar un número que no está reservado devuelve falso', r::text ilike '%false%', r::text);
  -- caso del dueño: la caja 41 quedó reservada por un equipo viejo (el mismo navegador con datos borrados); el administrador la pasa a este equipo
  insert into public.cajas(comercio_id,nro,dispositivo,nombre) values (cA,41,'dequipo-viejo-1','Viejo') on conflict do nothing;
  r := t.call(uA,'a@a.com',format('select to_jsonb(public.registrar_caja(%L,41,%L,%L))',cA,'dequipo-nuevo-7','Dueño'));
  perform t.chk('antes de liberarla, el equipo nuevo no puede usar la caja 41', r::text ilike '%false%', r::text);
  r := t.call(uA,'a@a.com',format('select to_jsonb(public.liberar_caja(%L,41,%L))',cA,'dequipo-nuevo-7'));
  r := t.call(uA,'a@a.com',format('select to_jsonb(public.registrar_caja(%L,41,%L,%L))',cA,'dequipo-nuevo-7','Dueño'));
  perform t.chk('después de liberarla, el equipo nuevo usa la caja 41', r::text ilike '%true%' and exists(select 1 from public.cajas where comercio_id=cA and nro=41 and dispositivo='dequipo-nuevo-7'), r::text);
  r := t.call(uA,'a@a.com',format('select to_jsonb(public.registrar_caja(%L,41,%L,%L))',cA,'dequipo-viejo-1','Viejo'));
  perform t.chk('el equipo viejo ya no puede volver a tomar la caja 41', r::text ilike '%false%', r::text);
  perform t.chk('la API anónima no puede ejecutarla', not has_function_privilege('anon','public.liberar_caja(uuid,int,text)','execute'), '');
  delete from public.cajas where comercio_id=cA and nro in (41,42);
end $$;
