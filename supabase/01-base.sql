-- =====================================================================
-- SISTEMA RAVE · 01 · Base: comercios, equipo, invitaciones y claves
--
-- Cómo se corre: SQL Editor de Supabase → pegar TODO el contenido → Run.
-- Se puede correr más de una vez sin romper nada (idempotente).
-- Orden: 01-base → 02-sincronizacion → 03-recuperacion-soporte →
--        04-menu-publico → 05-arca.
--
-- Qué hace:
--   · Un solo proyecto sirve a muchos comercios; cada fila lleva comercio_id
--     y la base (RLS) sólo deja ver lo del comercio del que sos miembro.
--   · Nadie puede crear un comercio por su cuenta: hace falta una invitación
--     que carga Rave Holding (ver rave_invitar_comercio al final).
--   · Roles: admin · supervisor · mostrador · operador.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
-- si pgcrypto quedó instalada en "public" (proyectos viejos), se pasa a "extensions" (las funciones la usan ahí)
do $$ begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto' and n.nspname = 'public') then
    alter extension pgcrypto set schema extensions;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Comercios y equipo
-- ---------------------------------------------------------------------
create table if not exists public.comercios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (length(nombre) between 2 and 80),
  rubro      text not null default 'comercio',
  slug       text unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}$'),
  creado     timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null
);

create table if not exists public.miembros (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  rol         text not null check (rol in ('admin', 'supervisor', 'mostrador', 'operador')),
  email       text,
  nombre      text,
  creado      timestamptz not null default now(),
  primary key (comercio_id, usuario_id)
);
create index if not exists miembros_usuario on public.miembros (usuario_id);

-- Cada equipo (caja) del comercio. El número de caja es único por comercio.
create table if not exists public.cajas (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  nro         int  not null check (nro between 1 and 99),
  dispositivo text not null check (length(dispositivo) between 8 and 60),
  usuario_id  uuid references auth.users(id) on delete set null,
  nombre      text,
  visto       timestamptz not null default now(),
  primary key (comercio_id, nro)
);

-- Invitaciones. Dos tipos:
--   comercio_id NULL  → alta de un comercio nuevo (la carga Rave Holding)
--   comercio_id dado  → alta de una persona al equipo (la carga el admin)
-- La persona debe presentar el código: acá sólo se guarda su huella.
create table if not exists public.invitaciones (
  id              bigint generated always as identity primary key,
  email           text not null,
  comercio_id     uuid references public.comercios(id) on delete cascade,
  nombre_comercio text,
  rol             text not null default 'operador' check (rol in ('admin', 'supervisor', 'mostrador', 'operador')),
  nombre          text,
  codigo_hash     text not null,
  llave           jsonb,
  intentos        int  not null default 0,
  creada          timestamptz not null default now(),
  vence           timestamptz not null default now() + interval '14 days',
  usada           timestamptz,
  creada_por      uuid
);
create index if not exists invitaciones_email on public.invitaciones (lower(email));

-- ---------------------------------------------------------------------
-- 2. Funciones de apoyo (todas con search_path fijo)
-- ---------------------------------------------------------------------
create or replace function public.mis_comercios()
returns setof uuid language sql stable security definer set search_path = public as $$
  select comercio_id from public.miembros where usuario_id = auth.uid()
$$;

create or replace function public.rol_en(c uuid)
returns text language sql stable security definer set search_path = public as $$
  select rol from public.miembros where comercio_id = c and usuario_id = auth.uid()
$$;

create or replace function public.es_admin(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_en(c) = 'admin', false)
$$;

create or replace function public.mi_email()
returns text language sql stable as $$
  select lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''))
$$;

-- ---------------------------------------------------------------------
-- 3. Permisos de tablas + RLS
-- ---------------------------------------------------------------------
alter table public.comercios    enable row level security;
alter table public.miembros     enable row level security;
alter table public.cajas        enable row level security;
alter table public.invitaciones enable row level security;

drop policy if exists "ver mi comercio" on public.comercios;
create policy "ver mi comercio" on public.comercios for select to authenticated
  using (id in (select public.mis_comercios()));

drop policy if exists "ver mi equipo" on public.miembros;
create policy "ver mi equipo" on public.miembros for select to authenticated
  using (comercio_id in (select public.mis_comercios()));

drop policy if exists "ver mis cajas" on public.cajas;
create policy "ver mis cajas" on public.cajas for select to authenticated
  using (comercio_id in (select public.mis_comercios()));

revoke all on public.comercios, public.miembros, public.cajas, public.invitaciones from anon;
revoke insert, update, delete, truncate on public.comercios, public.miembros, public.cajas from authenticated;
revoke all on public.invitaciones from authenticated;
grant select on public.comercios, public.miembros, public.cajas to authenticated;

-- ---------------------------------------------------------------------
-- 4. Alta de un comercio nuevo (sólo con invitación + código de Rave)
-- ---------------------------------------------------------------------
create or replace function public.crear_comercio(p_nombre text, p_rubro text default 'comercio', p_codigo text default '')
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_email text := public.mi_email();
  v_inv   public.invitaciones;
  v_id    uuid;
  v_slug  text;
  v_base  text;
  v_n     int := 1;
  v_nombre text;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'tenés que ingresar primero' using errcode = '42501';
  end if;
  select * into v_inv from public.invitaciones
   where lower(email) = v_email and comercio_id is null and usada is null and vence > now()
   order by id desc limit 1 for update;
  if not found then
    raise exception 'Tu correo no tiene una invitación para crear un comercio. Pedila a Rave Holding.' using errcode = '42501';
  end if;
  if v_inv.intentos >= 8 then
    return jsonb_build_object('ok', false, 'error', 'Demasiados intentos con el código: pedí una invitación nueva a Rave Holding.');
  end if;
  if v_inv.codigo_hash is distinct from extensions.crypt(coalesce(p_codigo, ''), v_inv.codigo_hash) then
    -- no se usa "raise": el contador de intentos tiene que quedar guardado
    update public.invitaciones set intentos = intentos + 1 where id = v_inv.id;
    return jsonb_build_object('ok', false, 'error', 'El código de invitación no es correcto.');
  end if;

  v_nombre := left(trim(coalesce(nullif(v_inv.nombre_comercio, ''), p_nombre)), 80);
  if length(coalesce(v_nombre, '')) < 2 then
    raise exception 'el comercio necesita un nombre';
  end if;
  v_base := trim(both '-' from regexp_replace(lower(translate(v_nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^a-z0-9]+', '-', 'g'));
  v_base := left(coalesce(nullif(v_base, ''), 'comercio'), 34);
  v_slug := v_base;
  while exists (select 1 from public.comercios where slug = v_slug) loop
    v_n := v_n + 1; v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.comercios (nombre, rubro, slug, creado_por)
  values (v_nombre, left(coalesce(nullif(p_rubro, ''), 'comercio'), 30), v_slug, auth.uid())
  returning id into v_id;
  insert into public.miembros (comercio_id, usuario_id, rol, email, nombre)
  values (v_id, auth.uid(), 'admin', v_email, left(coalesce(nullif(v_inv.nombre, ''), split_part(v_email, '@', 1)), 60));
  update public.invitaciones set usada = now() where id = v_inv.id;
  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug);
end $$;
revoke all on function public.crear_comercio(text, text, text) from public, anon;
grant execute on function public.crear_comercio(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Equipo: invitar, aceptar, quitar, cambiar rol
-- ---------------------------------------------------------------------
-- El administrador invita a una persona. p_huella = SHA-256 hex calculada en el navegador a partir del
-- código que le va a pasar a la persona (el servidor nunca ve el código). p_llave = la llave de datos
-- envuelta con ese código.
create or replace function public.invitar_miembro(p_comercio uuid, p_email text, p_rol text, p_nombre text, p_huella text, p_llave jsonb)
returns bigint
language plpgsql security definer set search_path = public, extensions
as $$
declare v_email text := lower(trim(coalesce(p_email, ''))); v_id bigint;
begin
  if not public.es_admin(p_comercio) then
    raise exception 'sólo el administrador del comercio' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 120 then
    raise exception 'el correo no es válido';
  end if;
  if p_rol not in ('admin', 'supervisor', 'mostrador', 'operador') then
    raise exception 'rol inválido';
  end if;
  if coalesce(p_huella, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'falta la huella del código';
  end if;
  if exists (select 1 from public.miembros where comercio_id = p_comercio and lower(email) = v_email) then
    raise exception 'esa persona ya es parte del comercio';
  end if;
  update public.invitaciones set usada = now()
   where comercio_id = p_comercio and lower(email) = v_email and usada is null;
  insert into public.invitaciones (email, comercio_id, rol, nombre, codigo_hash, llave, creada_por)
  values (v_email, p_comercio, p_rol, left(coalesce(p_nombre, ''), 60), extensions.crypt(p_huella, extensions.gen_salt('bf', 8)), p_llave, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.invitar_miembro(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.invitar_miembro(uuid, text, text, text, text, jsonb) to authenticated;

-- La persona invitada presenta la huella de su código. Si coincide, entra al equipo y recibe la llave
-- envuelta con ese código (queda marcada como temporal hasta que la re-envuelva con su contraseña).
create or replace function public.aceptar_invitacion(p_huella text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare v_email text := public.mi_email(); v_inv public.invitaciones; v_vistas int := 0;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'tenés que ingresar primero' using errcode = '42501';
  end if;
  for v_inv in
    select * from public.invitaciones
     where lower(email) = v_email and comercio_id is not null and usada is null and vence > now()
     order by id desc for update
  loop
    v_vistas := v_vistas + 1;
    if v_inv.intentos >= 8 then continue; end if;
    if v_inv.codigo_hash = extensions.crypt(coalesce(p_huella, ''), v_inv.codigo_hash) then
      insert into public.miembros (comercio_id, usuario_id, rol, email, nombre)
      values (v_inv.comercio_id, auth.uid(), v_inv.rol, v_email, coalesce(nullif(v_inv.nombre, ''), split_part(v_email, '@', 1)))
      on conflict (comercio_id, usuario_id) do update set rol = excluded.rol;
      if v_inv.llave is not null then
        insert into public.llaves (comercio_id, usuario_id, kdf, wrap, temporal)
        values (v_inv.comercio_id, auth.uid(), v_inv.llave->'kdf', v_inv.llave->'wrap', true)
        on conflict (comercio_id, usuario_id) do update set kdf = excluded.kdf, wrap = excluded.wrap, temporal = true, actualizado = now();
      end if;
      update public.invitaciones set usada = now() where id = v_inv.id;
      return jsonb_build_object('ok', true, 'comercio', v_inv.comercio_id);
    else
      update public.invitaciones set intentos = intentos + 1 where id = v_inv.id;
    end if;
  end loop;
  -- no se usa "raise": el contador de intentos tiene que quedar guardado
  return jsonb_build_object('ok', false, 'error',
    case when v_vistas = 0 then 'No hay una invitación vigente para tu correo.' else 'El código no es correcto.' end);
end $$;
revoke all on function public.aceptar_invitacion(text) from public, anon;
grant execute on function public.aceptar_invitacion(text) to authenticated;

create or replace function public.quitar_miembro(p_comercio uuid, p_usuario uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin(p_comercio) then
    raise exception 'sólo el administrador del comercio' using errcode = '42501';
  end if;
  if exists (select 1 from public.miembros where comercio_id = p_comercio and usuario_id = p_usuario and rol = 'admin')
     and (select count(*) from public.miembros where comercio_id = p_comercio and rol = 'admin') <= 1 then
    raise exception 'no se puede quitar al único administrador';
  end if;
  delete from public.miembros where comercio_id = p_comercio and usuario_id = p_usuario;
  delete from public.llaves   where comercio_id = p_comercio and usuario_id = p_usuario;
  update public.cajas set usuario_id = null where comercio_id = p_comercio and usuario_id = p_usuario;
end $$;
revoke all on function public.quitar_miembro(uuid, uuid) from public, anon;
grant execute on function public.quitar_miembro(uuid, uuid) to authenticated;

create or replace function public.cambiar_rol(p_comercio uuid, p_usuario uuid, p_rol text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin(p_comercio) then
    raise exception 'sólo el administrador del comercio' using errcode = '42501';
  end if;
  if p_rol not in ('admin', 'supervisor', 'mostrador', 'operador') then
    raise exception 'rol inválido';
  end if;
  if p_rol <> 'admin'
     and exists (select 1 from public.miembros where comercio_id = p_comercio and usuario_id = p_usuario and rol = 'admin')
     and (select count(*) from public.miembros where comercio_id = p_comercio and rol = 'admin') <= 1 then
    raise exception 'tiene que quedar al menos un administrador';
  end if;
  update public.miembros set rol = p_rol where comercio_id = p_comercio and usuario_id = p_usuario;
end $$;
revoke all on function public.cambiar_rol(uuid, uuid, text) from public, anon;
grant execute on function public.cambiar_rol(uuid, uuid, text) to authenticated;

-- Invitaciones abiertas del comercio (sólo admin; sin huellas ni llaves).
create or replace function public.invitaciones_de(p_comercio uuid)
returns table (id bigint, email text, rol text, nombre text, creada timestamptz, vence timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.email, i.rol, i.nombre, i.creada, i.vence
    from public.invitaciones i
   where i.comercio_id = p_comercio and i.usada is null and i.vence > now() and public.es_admin(p_comercio)
   order by i.id desc
$$;
revoke all on function public.invitaciones_de(uuid) from public, anon;
grant execute on function public.invitaciones_de(uuid) to authenticated;

-- Cada equipo reserva su número de caja. Devuelve false si ya lo usa otro equipo.
create or replace function public.registrar_caja(p_comercio uuid, p_nro int, p_disp text, p_nombre text default '')
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_actual text;
begin
  if public.rol_en(p_comercio) is null then
    raise exception 'no sos miembro de este comercio' using errcode = '42501';
  end if;
  if p_nro is null or p_nro < 1 or p_nro > 99 then raise exception 'número de caja inválido'; end if;
  if coalesce(length(p_disp), 0) < 8 then raise exception 'equipo inválido'; end if;
  select dispositivo into v_actual from public.cajas where comercio_id = p_comercio and nro = p_nro for update;
  if found and v_actual <> p_disp then
    return false;
  end if;
  -- un equipo no puede tener dos números a la vez
  delete from public.cajas where comercio_id = p_comercio and dispositivo = p_disp and nro <> p_nro;
  insert into public.cajas (comercio_id, nro, dispositivo, usuario_id, nombre)
  values (p_comercio, p_nro, p_disp, auth.uid(), left(coalesce(p_nombre, ''), 40))
  on conflict (comercio_id, nro) do update set usuario_id = excluded.usuario_id, nombre = excluded.nombre, visto = now();
  return true;
end $$;
revoke all on function public.registrar_caja(uuid, int, text, text) from public, anon;
grant execute on function public.registrar_caja(uuid, int, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Soporte de Rave Holding (SÓLO desde el SQL Editor):
--      select public.rave_invitar_comercio('dueño@correo.com', 'Nombre del comercio', 'CODIGO-DE-INVITACION');
--    El dueño crea su cuenta en el sistema (correo + contraseña propia) y, en la pantalla "Crear comercio",
--    escribe ese código. Sin invitación nadie puede crear comercios en este proyecto.
-- ---------------------------------------------------------------------
create or replace function public.rave_invitar_comercio(p_email text, p_nombre text, p_codigo text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role' in ('anon', 'authenticated') then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if length(coalesce(p_codigo, '')) < 8 then raise exception 'el código necesita al menos 8 caracteres'; end if;
  if lower(trim(p_email)) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'correo inválido'; end if;
  update public.invitaciones set usada = now()
   where lower(email) = lower(trim(p_email)) and comercio_id is null and usada is null;
  insert into public.invitaciones (email, comercio_id, nombre_comercio, rol, codigo_hash)
  values (lower(trim(p_email)), null, left(trim(p_nombre), 80), 'admin', extensions.crypt(p_codigo, extensions.gen_salt('bf', 8)));
  return 'Invitación creada para ' || lower(trim(p_email)) || ' (vence en 14 días).';
end $$;
revoke all on function public.rave_invitar_comercio(text, text, text) from public, anon, authenticated;
