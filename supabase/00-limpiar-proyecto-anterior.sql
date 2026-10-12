-- =====================================================================
-- SISTEMA RAVE · 00 · Apartar el esquema del proyecto anterior (OPCIONAL)
--
-- Usalo SOLO si este proyecto de Supabase ya tuvo el sistema viejo "menu-rave"
-- (tablas comercios/miembros/productos/ventas…). Los scripts 01-05 nuevos
-- usan los mismos nombres de tabla (comercios, miembros, menus, llaves,
-- registros…) con otra estructura y "create table if not exists" NO pisa una
-- tabla vieja: quedaría todo mezclado. Este script lo evita.
--
-- Qué hace (NO borra datos):
--   · mueve las tablas y tipos viejos al esquema  anterior_menu_rave
--     (los datos quedan ahí, intactos, para consultarlos o exportarlos);
--   · elimina las vistas y funciones viejas de "public" (son código, no datos;
--     también cae la política de storage que dependía de ellas);
--   · si el proyecto ya tiene el esquema NUEVO (comercios con columna "slug")
--     o está vacío, no hace nada.
-- Cuando ya exportaste lo que necesitabas:  drop schema anterior_menu_rave cascade;
-- Los usuarios (auth.users) NO se tocan.
-- Orden: 00 (si hace falta) → 01 → 02 → 03 → 04 → 05.
-- =====================================================================
do $$
declare
  r record;
  v_old boolean;
begin
  select exists (select 1 from information_schema.columns where table_schema='public' and table_name='comercios')
         and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='comercios' and column_name='slug')
    into v_old;
  if not v_old then
    raise notice 'No hay esquema anterior para apartar: no se hizo nada.';
    return;
  end if;

  create schema if not exists anterior_menu_rave;

  -- vistas viejas
  for r in select schemaname, viewname from pg_views where schemaname = 'public' loop
    execute format('drop view if exists %I.%I cascade', r.schemaname, r.viewname);
  end loop;
  -- funciones viejas (las de extensiones no se tocan)
  for r in
    select p.oid::regprocedure as f from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('drop function if exists %s cascade', r.f);
  end loop;
  -- tablas viejas → esquema de archivo
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I set schema anterior_menu_rave', r.tablename);
  end loop;
  -- tipos viejos
  for r in select t.typname from pg_type t where t.typnamespace = 'public'::regnamespace and t.typtype = 'e' loop
    execute format('alter type public.%I set schema anterior_menu_rave', r.typname);
  end loop;
  raise notice 'Listo: lo anterior quedó en el esquema anterior_menu_rave. Ahora corré 01-base.sql y siguientes.';
end $$;
