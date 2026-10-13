-- INSTALAR-TODO.sql · proyecto Supabase NUEVO · Rave Holding
-- Pegar el CONTENIDO completo en SQL Editor y ejecutar una sola vez. Incluye 01 a 05 (no incluye 00 ni 90).

-- ===== 01-base.sql =====
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

-- ===== 02-sincronizacion.sql =====
-- =====================================================================
-- SISTEMA RAVE · 02 · Sincronización entre equipos
--
-- Correr DESPUÉS de 01-base.sql (mismo procedimiento; se puede repetir).
--
-- Cómo funciona:
--   · Cada registro del sistema (un producto, una venta, un cliente…) es una
--     fila de "registros". Se LEE con bajar() y se ESCRIBE sólo con
--     sincronizar(): nadie escribe directo en la tabla.
--   · El servidor aplica las reglas: qué rol puede tocar qué, qué se escribe
--     una sola vez, qué no se puede borrar, y el STOCK: el navegador no manda
--     el stock, manda movimientos y el servidor los suma. Si dos cajas venden
--     la misma botella al mismo tiempo, las dos restan y el total cierra.
--   · Los datos personales llegan ya cifrados desde el navegador: el
--     servidor no los puede leer.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Registros
-- ---------------------------------------------------------------------
create table if not exists public.registros (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  coleccion   text not null check (coleccion ~ '^[a-zA-Z]{2,24}$'),
  id          text not null check (length(id) between 1 and 80),
  datos       jsonb not null default '{}'::jsonb,
  borrado     boolean not null default false,
  dispositivo text,
  usuario_id  uuid references auth.users(id) on delete set null,
  actualizado timestamptz not null default clock_timestamp(),
  primary key (comercio_id, coleccion, id)
);
create index if not exists registros_cursor on public.registros (comercio_id, actualizado);

alter table public.registros enable row level security;
drop policy if exists "leer registros de mi comercio" on public.registros;
create policy "leer registros de mi comercio" on public.registros for select to authenticated
  using (comercio_id in (select public.mis_comercios()));

revoke all on public.registros from anon;
revoke insert, update, delete, truncate on public.registros from authenticated;
grant select on public.registros to authenticated;

-- ---------------------------------------------------------------------
-- 2. Quién puede escribir qué (piso de seguridad en el servidor)
--    La interfaz puede ser más estricta, nunca más permisiva.
-- ---------------------------------------------------------------------
create or replace function public.rave_puede_escribir(p_rol text, p_col text, p_id text)
returns boolean language sql immutable as $$
  select case p_rol
    when 'admin' then true
    when 'supervisor' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                     'clientes','fiado','fich','pedidos','arrep','pya','membs',
                                     'prod','rubros','cierres','cnotas','cupones','planes','lotes','tareas')
                           or (p_col = 'cfg' and p_id = 'cfg')
    when 'mostrador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                    'clientes','fiado','fich','pedidos','arrep','pya','membs')
    when 'operador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs')
    else false end
$$;

-- ---------------------------------------------------------------------
-- 3. SINCRONIZAR: la única puerta de escritura
--    Recibe  [{ "c": colección, "id": id, "d": {datos}, "x": true si se borró }]
--    Devuelve cuántos aplicó, cuáles rechazó y por qué, y la hora del servidor.
-- ---------------------------------------------------------------------
create or replace function public.sincronizar(p_comercio uuid, p_dispositivo text, p_cambios jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_rol        text;
  v_cambio     jsonb;
  v_col        text;
  v_id         text;
  v_datos      jsonb;
  v_borrado    boolean;
  v_prev       public.registros;
  v_hay        boolean;
  v_aplicados  int := 0;
  v_omitidos   int := 0;
  v_rechazos   jsonb := '[]'::jsonb;
  v_pasada     int;
  v_motivo     text;
  v_delta      numeric;
  v_pid        text;
  v_stock      numeric;
  c_todas      constant text[] := array['prod','smov','ventas','turnos','movs','cierres','cnotas','rubros','clientes','fiado',
                                        'emp','fich','puestos','tareas','tlogs','audit','cupones','cusos','planes','membs',
                                        'sellos','otp','pedidos','arrep','pya','lotes','cfg'];
  c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado'];
  c_borrables  constant text[] := array['prod','rubros','clientes','emp','puestos','tareas','cupones','planes','tlogs','pedidos'];
  c_cfg_ids    constant text[] := array['tenant','cfg','menu','loyalty','roles','integ','legal','clubkey'];
  c_secretos   constant text[] := array['arcaCert','arcaKey','arcaPem','accessToken','refreshToken','clientSecret','apiKey','serviceKey'];
  v_k          text;
begin
  v_rol := public.rol_en(p_comercio);
  if v_rol is null then
    raise exception 'no sos miembro de este comercio' using errcode = '42501';
  end if;
  if jsonb_typeof(p_cambios) <> 'array' then
    raise exception 'formato de cambios inválido';
  end if;
  if jsonb_array_length(p_cambios) > 500 then
    raise exception 'demasiados cambios juntos (máximo 500 por envío)';
  end if;

  -- Dos pasadas: primero todo lo que no es movimiento de stock (así un producto nuevo ya existe),
  -- después los movimientos de stock.
  for v_pasada in 1..2 loop
    for v_cambio in select * from jsonb_array_elements(p_cambios) loop
      v_col    := v_cambio ->> 'c';
      v_id     := v_cambio ->> 'id';
      v_motivo := null;
      continue when (v_pasada = 1 and v_col = 'smov') or (v_pasada = 2 and v_col is distinct from 'smov');

      begin   -- cada cambio en su propia sub-transacción: uno malo no traba a los demás
        v_datos   := coalesce(v_cambio -> 'd', '{}'::jsonb);
        v_borrado := coalesce((v_cambio ->> 'x')::boolean, false);
        v_hay     := false;

        if v_col is null or v_id is null or length(v_id) > 80 or length(v_id) < 1 or not (v_col = any(c_todas)) then
          v_motivo := 'colección o formato inválido';
        elsif jsonb_typeof(v_datos) <> 'object' or length(v_datos::text) > 400000 then
          v_motivo := 'datos inválidos o muy grandes';
        elsif not public.rave_puede_escribir(v_rol, v_col, v_id) then
          v_motivo := 'tu rol no puede modificar esto';
        elsif v_col = 'cfg' and not (v_id = any(c_cfg_ids)) then
          v_motivo := 'configuración desconocida';
        elsif v_borrado and not (v_col = any(c_borrables)) then
          v_motivo := 'este tipo de registro no se borra';
        end if;

        if v_motivo is null then
          select * into v_prev from public.registros
           where comercio_id = p_comercio and coleccion = v_col and id = v_id for update;
          v_hay := found;

          -- se escriben una sola vez: un reenvío del mismo lote no duplica nada
          if v_hay and v_col = any(c_una_vez) then
            v_omitidos := v_omitidos + 1;
            continue;
          end if;
          -- una caja cerrada no se toca
          if v_hay and v_col = 'turnos' and coalesce((v_prev.datos ->> 'closedAt')::numeric, 0) > 0 then
            v_motivo := 'la caja ya está cerrada: no se modifica';
          end if;
          -- las fichadas se escriben una vez; sólo el administrador las corrige
          if v_motivo is null and v_hay and v_col = 'fich' and v_rol <> 'admin' then
            v_motivo := 'las fichadas sólo las corrige el administrador';
          end if;
        end if;

        if v_motivo is not null then
          v_rechazos := v_rechazos || jsonb_build_object('c', v_col, 'id', v_id, 'motivo', v_motivo);
          continue;
        end if;

        -- ---- reglas por colección ----
        if v_col = 'smov' then
          -- movimiento de stock: se suma en el servidor sobre el producto
          v_pid := v_datos ->> 'pid';
          begin v_delta := (v_datos ->> 'd')::numeric; exception when others then v_delta := null; end;
          if v_pid is null or v_delta is null or abs(v_delta) > 1000000 then
            v_rechazos := v_rechazos || jsonb_build_object('c', v_col, 'id', v_id, 'motivo', 'movimiento de stock inválido');
            continue;
          end if;
          select * into v_prev from public.registros
           where comercio_id = p_comercio and coleccion = 'prod' and id = v_pid and not borrado for update;
          if not found then
            v_rechazos := v_rechazos || jsonb_build_object('c', v_col, 'id', v_id, 'motivo', 'el producto no existe');
            continue;
          end if;
          v_stock := round(coalesce((v_prev.datos ->> 'stock')::numeric, 0) + v_delta, 3);
          update public.registros
             set datos = jsonb_set(datos, '{stock}', to_jsonb(v_stock)),
                 dispositivo = left(p_dispositivo, 40), usuario_id = auth.uid(), actualizado = clock_timestamp()
           where comercio_id = p_comercio and coleccion = 'prod' and id = v_pid;
        elsif v_col = 'prod' then
          -- el stock lo manda el servidor, nunca el navegador
          v_datos := v_datos - 'stock';
          v_datos := v_datos || jsonb_build_object('stock', case when v_hay then coalesce(v_prev.datos -> 'stock', '0'::jsonb) else '0'::jsonb end);
        elsif v_col = 'ventas' then
          -- el CAE lo escribe sólo el servidor fiscal: el navegador no lo puede pisar ni inventar
          v_datos := v_datos - 'arca' - 'arcaNC';
          if v_hay then
            if v_prev.datos ? 'arca'   then v_datos := v_datos || jsonb_build_object('arca',   v_prev.datos -> 'arca');   end if;
            if v_prev.datos ? 'arcaNC' then v_datos := v_datos || jsonb_build_object('arcaNC', v_prev.datos -> 'arcaNC'); end if;
            -- con CAE, el comprobante no cambia: el cliente sólo puede agregar su estado de anulación
            if (v_prev.datos -> 'arca' ->> 'cae') is not null then
              v_datos := v_prev.datos || (v_datos - 'items' - 'total' - 'doc' - 'n' - 'ts' - 'cust' - 'custName' - 'method');
            end if;
          end if;
        elsif v_col = 'cfg' then
          foreach v_k in array c_secretos loop
            v_datos := v_datos - v_k;
          end loop;
        end if;

        if v_col <> 'smov' then
          insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
          values (p_comercio, v_col, v_id, v_datos, v_borrado, left(p_dispositivo, 40), auth.uid(), clock_timestamp())
          on conflict (comercio_id, coleccion, id) do update
             set datos = excluded.datos, borrado = excluded.borrado, dispositivo = excluded.dispositivo,
                 usuario_id = excluded.usuario_id, actualizado = excluded.actualizado;
        else
          -- el propio movimiento queda registrado (una sola vez)
          insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
          values (p_comercio, 'smov', v_id, v_datos, false, left(p_dispositivo, 40), auth.uid(), clock_timestamp());
        end if;
        v_aplicados := v_aplicados + 1;
      exception when others then
        v_rechazos := v_rechazos || jsonb_build_object('c', v_col, 'id', v_id, 'motivo', left(sqlerrm, 160));
      end;
    end loop;
  end loop;

  return jsonb_build_object('aplicados', v_aplicados, 'omitidos', v_omitidos, 'rechazos', v_rechazos,
                            'ahora', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end $$;
revoke all on function public.sincronizar(uuid, text, jsonb) from public, anon;
grant execute on function public.sincronizar(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. BAJAR: lo que cambió desde un momento dado (el cliente resta 30 s por las dudas)
-- ---------------------------------------------------------------------
create or replace function public.bajar(p_comercio uuid, p_desde timestamptz default null, p_limite int default 500)
returns table (coleccion text, id text, datos jsonb, borrado boolean, actualizado text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.rol_en(p_comercio) is null then
    raise exception 'no sos miembro de este comercio' using errcode = '42501';
  end if;
  return query
    select r.coleccion, r.id, r.datos, r.borrado,
           to_char(r.actualizado at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      from public.registros r
     where r.comercio_id = p_comercio
       and (p_desde is null or r.actualizado >= p_desde)
     order by r.actualizado, r.coleccion, r.id
     limit least(greatest(coalesce(p_limite, 500), 1), 1000);
end $$;
revoke all on function public.bajar(uuid, timestamptz, int) from public, anon;
grant execute on function public.bajar(uuid, timestamptz, int) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Llaves de cifrado (la llave real de los datos va envuelta; el servidor no la puede abrir)
-- ---------------------------------------------------------------------
create table if not exists public.llaves (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  kdf         jsonb not null,
  wrap        jsonb not null,
  temporal    boolean not null default false,
  actualizado timestamptz not null default now(),
  primary key (comercio_id, usuario_id)
);
alter table public.llaves enable row level security;
drop policy if exists "mi llave" on public.llaves;
create policy "mi llave" on public.llaves for select to authenticated using (usuario_id = auth.uid());
drop policy if exists "guardar mi llave" on public.llaves;
create policy "guardar mi llave" on public.llaves for insert to authenticated
  with check (usuario_id = auth.uid() and comercio_id in (select public.mis_comercios()));
drop policy if exists "actualizar mi llave" on public.llaves;
create policy "actualizar mi llave" on public.llaves for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid() and comercio_id in (select public.mis_comercios()));
revoke all on public.llaves from anon;
revoke delete, truncate on public.llaves from authenticated;
grant select, insert, update on public.llaves to authenticated;

-- Llave envuelta con el código de recuperación (la ve y la cambia sólo el administrador)
create table if not exists public.llaves_recuperacion (
  comercio_id uuid primary key references public.comercios(id) on delete cascade,
  kdf         jsonb not null,
  wrap        jsonb not null,
  creado      timestamptz not null default now()
);
alter table public.llaves_recuperacion enable row level security;
drop policy if exists "admin lee la llave de recuperación" on public.llaves_recuperacion;
create policy "admin lee la llave de recuperación" on public.llaves_recuperacion for select to authenticated
  using (public.es_admin(comercio_id));
drop policy if exists "admin guarda la llave de recuperación" on public.llaves_recuperacion;
create policy "admin guarda la llave de recuperación" on public.llaves_recuperacion for insert to authenticated
  with check (public.es_admin(comercio_id));
drop policy if exists "admin cambia la llave de recuperación" on public.llaves_recuperacion;
create policy "admin cambia la llave de recuperación" on public.llaves_recuperacion for update to authenticated
  using (public.es_admin(comercio_id)) with check (public.es_admin(comercio_id));
revoke all on public.llaves_recuperacion from anon;
revoke delete, truncate on public.llaves_recuperacion from authenticated;
grant select, insert, update on public.llaves_recuperacion to authenticated;

-- ===== 03-recuperacion-soporte.sql =====
-- =====================================================================
-- Sistema RAVE · 03 · Recuperación de clave y soporte de Rave Holding
-- Correr DESPUÉS de 01 y 02. Se puede correr las veces que haga falta.
--
--   (La llave de recuperación y la marca "temporal" ya están en 02.)
--   1. restablecer_clave_miembro(): el ADMINISTRADOR pone una clave temporal
--      a alguien de su equipo (nunca a otro administrador ni a gente que
--      también está en otro comercio).
--   2. soporte_restablecer_clave(): sólo Rave Holding, desde el SQL Editor.
--   3. Pedidos de ayuda (solicitudes_soporte + pedir_soporte) con aviso por
--      mail opcional.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. El administrador restablece la clave de alguien de SU equipo
--    (no puede tocar a personas que también están en comercios ajenos)
-- ---------------------------------------------------------------------
create or replace function public.restablecer_clave_miembro(p_comercio uuid, p_usuario uuid, p_clave text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if not public.es_admin(p_comercio) then
    raise exception 'sólo el administrador del comercio' using errcode = '42501';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'para tu propia clave usá "Cambiar mi contraseña"';
  end if;
  if not exists (select 1 from public.miembros where comercio_id = p_comercio and usuario_id = p_usuario) then
    raise exception 'esa persona no es parte de este comercio';
  end if;
  if exists (select 1 from public.miembros m
              where m.usuario_id = p_usuario
                and not exists (select 1 from public.miembros a
                                 where a.comercio_id = m.comercio_id and a.usuario_id = auth.uid() and a.rol = 'admin')) then
    raise exception 'esa persona también está en otro comercio: el restablecimiento lo hace soporte de Rave Holding';
  end if;
  if exists (select 1 from public.miembros where comercio_id = p_comercio and usuario_id = p_usuario and rol = 'admin') then
    raise exception 'la clave de otro administrador la restablece soporte de Rave Holding';
  end if;
  -- sólo personas que ya entraron alguna vez a este comercio (tienen su llave): evita tomar cuentas ajenas
  if not exists (select 1 from public.llaves where comercio_id = p_comercio and usuario_id = p_usuario) then
    raise exception 'esa persona todavía no entró nunca a este comercio: no hay nada para restablecer';
  end if;
  if length(coalesce(p_clave, '')) < 8 then
    raise exception 'la clave temporal necesita al menos 8 caracteres';
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf', 10))
   where id = p_usuario;
end $$;
revoke all on function public.restablecer_clave_miembro(uuid, uuid, text) from public, anon;
grant execute on function public.restablecer_clave_miembro(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Soporte de Rave Holding (SÓLO desde el SQL Editor de Supabase):
--      select public.soporte_restablecer_clave('correo@cliente.com', 'ClaveTemporal-2026');
--    Después la persona entra con esa clave y el sistema le pide su código de
--    recuperación (o su clave anterior) para volver a abrir la llave.
-- ---------------------------------------------------------------------
create or replace function public.soporte_restablecer_clave(p_email text, p_clave text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare v_id uuid;
begin
  -- jamás desde la API pública: sólo desde el SQL Editor / rol de servicio
  if coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'role' in ('anon', 'authenticated') then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if length(coalesce(p_clave, '')) < 8 then
    raise exception 'la clave temporal necesita al menos 8 caracteres';
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf', 10))
   where lower(email) = lower(trim(p_email))
  returning id into v_id;
  if v_id is null then
    raise exception 'no existe un usuario con el correo %', p_email;
  end if;
  return 'Listo: ' || p_email || ' ya puede entrar con la clave temporal.';
end $$;
revoke all on function public.soporte_restablecer_clave(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Pedidos de ayuda a Rave Holding
-- ---------------------------------------------------------------------
create table if not exists public.solicitudes_soporte (
  numero     bigint generated always as identity primary key,
  creado     timestamptz not null default now(),
  motivo     text not null,
  comercio   text,
  nombre     text,
  contacto   text not null,
  usuario    text,
  detalle    text,
  version    text,
  equipo     text,
  estado     text not null default 'nueva',
  aviso_mail boolean not null default false,
  ip         text
);
alter table public.solicitudes_soporte add column if not exists ip text;
alter table public.solicitudes_soporte enable row level security;
-- sin políticas: nadie la lee ni la escribe por la API; se ve en el panel de Supabase.
revoke all on public.solicitudes_soporte from anon, authenticated;

-- Configuración privada del aviso por mail (la carga Rave Holding en el SQL Editor):
--   insert into public.soporte_config (id, url, token) values (1, 'https://script.google.com/macros/s/…/exec', '…')
--   on conflict (id) do update set url = excluded.url, token = excluded.token;
create table if not exists public.soporte_config (
  id    int primary key default 1 check (id = 1),
  url   text,
  token text
);
alter table public.soporte_config enable row level security;
revoke all on public.soporte_config from anon, authenticated;

create or replace function public.pedir_soporte(p jsonb)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_num      bigint;
  v_contacto text := left(trim(coalesce(p->>'contacto', '')), 120);
  v_motivo   text := coalesce(nullif(p->>'motivo', ''), 'otro');
  v_cfg      public.soporte_config;
  v_ip       text := left(coalesce(split_part(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json->>'x-forwarded-for', ',', 1), ''), 45);
begin
  if length(v_contacto) < 6 then
    raise exception 'dejanos un WhatsApp o un correo para contactarte';
  end if;
  if v_motivo not in ('clave', 'sistema', 'ventas', 'otro') then v_motivo := 'otro'; end if;
  if (select count(*) from public.solicitudes_soporte
       where contacto = v_contacto and creado > now() - interval '1 day') >= 5 then
    raise exception 'ya recibimos tus pedidos: te vamos a contactar';
  end if;
  if v_ip <> '' and (select count(*) from public.solicitudes_soporte where ip = v_ip and creado > now() - interval '1 hour') >= 8 then
    raise exception 'ya recibimos varios pedidos desde tu conexión: escribinos por WhatsApp';
  end if;
  if (select count(*) from public.solicitudes_soporte where creado > now() - interval '1 hour') >= 120 then
    raise exception 'hay muchos pedidos en este momento: escribinos por WhatsApp';
  end if;

  insert into public.solicitudes_soporte (motivo, comercio, nombre, contacto, usuario, detalle, version, equipo, ip)
  values (v_motivo,
          left(trim(coalesce(p->>'comercio', '')), 80),
          left(trim(coalesce(p->>'nombre', '')), 80),
          v_contacto,
          left(trim(coalesce(p->>'usuario', '')), 120),
          left(trim(coalesce(p->>'detalle', '')), 1000),
          left(coalesce(p->>'version', ''), 20),
          left(coalesce(p->>'equipo', ''), 120), v_ip)
  returning numero into v_num;

  -- Aviso por mail (si está configurado y existe pg_net). Si falla, el pedido igual queda guardado.
  select * into v_cfg from public.soporte_config where id = 1;
  if v_cfg.url is not null and exists (select 1 from pg_namespace where nspname = 'net') then
    begin
      execute 'select net.http_post(url := $1, body := $2, headers := $3)'
        using v_cfg.url,
              jsonb_build_object('token', v_cfg.token, 'solicitud',
                (select to_jsonb(s) from public.solicitudes_soporte s where s.numero = v_num)),
              '{"Content-Type": "application/json"}'::jsonb;
      update public.solicitudes_soporte set aviso_mail = true where numero = v_num;
    exception when others then null;
    end;
  end if;
  return v_num;
end $$;
revoke all on function public.pedir_soporte(jsonb) from public;
grant execute on function public.pedir_soporte(jsonb) to anon, authenticated;

-- ===== 04-menu-publico.sql =====
-- =====================================================================
-- SISTEMA RAVE · 04 · Menú público en la nube y alta al Club
-- Correr DESPUÉS de 01, 02 y 03. Se puede correr las veces que haga falta.
--
--   · menus / menus_historial: lo PUBLICADO del menú de cada comercio
--     (sólo campos públicos). El público lo lee sin ingresar con
--     menu_publico('slug'); nadie puede leer la tabla directo.
--   · publicar_menu(): sólo el administrador; limpia el contenido (lista
--     blanca de campos: jamás costo, stock exacto ni proveedor) y guarda
--     versión + hash. revertir_menu() vuelve a una versión anterior.
--   · club_altas + club_alta(): el público se anota al Club desde su celular.
--     Los datos personales viajan CIFRADOS en el navegador con la llave
--     pública del comercio (RSA-OAEP) y sólo el equipo del comercio puede
--     abrirlos: el servidor no ve nombre, WhatsApp ni cumpleaños.
--   · menu_eventos(): "pedido por WhatsApp" y "botón de arrepentimiento"
--     (solicitudes, no ventas), con límite por IP.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Menú publicado
-- ---------------------------------------------------------------------
create table if not exists public.menus (
  comercio_id uuid primary key references public.comercios(id) on delete cascade,
  version     int  not null default 1,
  hash        text not null,
  contenido   jsonb not null,
  publicado   timestamptz not null default now(),
  publicado_por uuid references auth.users(id) on delete set null
);
create table if not exists public.menus_historial (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  version     int  not null,
  hash        text not null,
  contenido   jsonb not null,
  publicado   timestamptz not null,
  publicado_por uuid,
  primary key (comercio_id, version)
);
alter table public.menus enable row level security;
alter table public.menus_historial enable row level security;
drop policy if exists "admin ve su menú" on public.menus;
create policy "admin ve su menú" on public.menus for select to authenticated using (public.rol_en(comercio_id) = 'admin');
drop policy if exists "admin ve el historial del menú" on public.menus_historial;
create policy "admin ve el historial del menú" on public.menus_historial for select to authenticated using (public.rol_en(comercio_id) = 'admin');
revoke all on public.menus, public.menus_historial from anon;
revoke insert, update, delete, truncate on public.menus, public.menus_historial from authenticated;
grant select on public.menus, public.menus_historial to authenticated;

-- Lista blanca de campos públicos de cada producto y sección.
create or replace function public.rave_limpiar_menu(p jsonb)
returns jsonb
language plpgsql immutable set search_path = public
as $$
declare
  v_cat  jsonb := coalesce(p->'catalog', '{}'::jsonb);
  v_prod jsonb := '[]'::jsonb;
  v_sec  jsonb := '[]'::jsonb;
  v_it   jsonb;
  v_o    jsonb;
  k      text;
  keys_p constant text[] := array['id','cat','grupo','nom','sub','precio','img','destacado','desc','unidad','agotado'];
  keys_s constant text[] := array['cat','nom','titulo','hint','layout','alc','menu'];
begin
  for v_it in select * from jsonb_array_elements(case when jsonb_typeof(v_cat->'productos') = 'array' then v_cat->'productos' else '[]'::jsonb end) loop
    v_o := '{}'::jsonb;
    foreach k in array keys_p loop
      if v_it ? k then v_o := v_o || jsonb_build_object(k, v_it->k); end if;
    end loop;
    v_prod := v_prod || jsonb_build_array(v_o);
  end loop;
  for v_it in select * from jsonb_array_elements(case when jsonb_typeof(v_cat->'secciones') = 'array' then v_cat->'secciones' else '[]'::jsonb end) loop
    v_o := '{}'::jsonb;
    foreach k in array keys_s loop
      if v_it ? k then v_o := v_o || jsonb_build_object(k, v_it->k); end if;
    end loop;
    v_sec := v_sec || jsonb_build_array(v_o);
  end loop;
  return jsonb_build_object(
    'site',    coalesce(p->'site', '{}'::jsonb),
    'catalog', jsonb_build_object('secciones', v_sec, 'productos', v_prod),
    'plans',   case when jsonb_typeof(p->'plans') = 'array' then p->'plans' else '[]'::jsonb end,
    'coupons', case when jsonb_typeof(p->'coupons') = 'array' then p->'coupons' else '[]'::jsonb end,
    'legal',   coalesce(p->'legal', '{}'::jsonb),
    'clubkey', p->'clubkey'
  );
end $$;

create or replace function public.publicar_menu(p_comercio uuid, p_contenido jsonb, p_hash text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_ver int;
  v_old public.menus;
  v_c   jsonb;
begin
  if not public.es_admin(p_comercio) then
    raise exception 'sólo el administrador publica el menú' using errcode = '42501';
  end if;
  if p_contenido is null or jsonb_typeof(p_contenido) <> 'object' then
    raise exception 'contenido inválido';
  end if;
  if pg_column_size(p_contenido) > 3000000 then
    raise exception 'el menú es demasiado grande (máximo 3 MB): achicá las fotos';
  end if;
  if length(coalesce(p_hash, '')) not between 16 and 128 then
    raise exception 'falta la huella del contenido';
  end if;
  v_c := public.rave_limpiar_menu(p_contenido);
  select * into v_old from public.menus where comercio_id = p_comercio for update;
  if found then
    if v_old.hash = p_hash then
      return jsonb_build_object('ok', true, 'version', v_old.version, 'sin_cambios', true);
    end if;
    insert into public.menus_historial (comercio_id, version, hash, contenido, publicado, publicado_por)
    values (v_old.comercio_id, v_old.version, v_old.hash, v_old.contenido, v_old.publicado, v_old.publicado_por)
    on conflict do nothing;
    delete from public.menus_historial where comercio_id = p_comercio
      and version <= v_old.version - 20;
    v_ver := v_old.version + 1;
    update public.menus set version = v_ver, hash = p_hash, contenido = v_c,
           publicado = now(), publicado_por = auth.uid() where comercio_id = p_comercio;
  else
    v_ver := 1;
    insert into public.menus (comercio_id, version, hash, contenido, publicado_por)
    values (p_comercio, 1, p_hash, v_c, auth.uid());
  end if;
  return jsonb_build_object('ok', true, 'version', v_ver);
end $$;
revoke all on function public.publicar_menu(uuid, jsonb, text) from public, anon;
grant execute on function public.publicar_menu(uuid, jsonb, text) to authenticated;

create or replace function public.revertir_menu(p_comercio uuid, p_version int)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_h public.menus_historial;
  v_cur public.menus;
  v_ver int;
begin
  if not public.es_admin(p_comercio) then
    raise exception 'sólo el administrador' using errcode = '42501';
  end if;
  select * into v_h from public.menus_historial where comercio_id = p_comercio and version = p_version;
  if not found then raise exception 'esa versión ya no está guardada'; end if;
  select * into v_cur from public.menus where comercio_id = p_comercio for update;
  insert into public.menus_historial (comercio_id, version, hash, contenido, publicado, publicado_por)
  values (v_cur.comercio_id, v_cur.version, v_cur.hash, v_cur.contenido, v_cur.publicado, v_cur.publicado_por)
  on conflict do nothing;
  v_ver := v_cur.version + 1;
  update public.menus set version = v_ver, hash = v_h.hash, contenido = v_h.contenido,
         publicado = now(), publicado_por = auth.uid() where comercio_id = p_comercio;
  return jsonb_build_object('ok', true, 'version', v_ver, 'desde', p_version);
end $$;
revoke all on function public.revertir_menu(uuid, int) from public, anon;
grant execute on function public.revertir_menu(uuid, int) to authenticated;

-- Lectura PÚBLICA: sólo por dirección corta y sólo lo ya publicado.
create or replace function public.menu_publico(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('version', m.version, 'publicado', m.publicado, 'nombre', c.nombre, 'contenido', m.contenido)
    from public.menus m join public.comercios c on c.id = m.comercio_id
   where c.slug = lower(left(coalesce(p_slug, ''), 40));
$$;
revoke all on function public.menu_publico(text) from public;
grant execute on function public.menu_publico(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Alta al Club desde el menú (datos cifrados de punta a punta)
-- ---------------------------------------------------------------------
create table if not exists public.club_altas (
  id          bigint generated always as identity primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  creado      timestamptz not null default now(),
  huella      text not null check (length(huella) between 32 and 128),
  cifrado     jsonb not null,
  ip          text,
  estado      text not null default 'nueva' check (estado in ('nueva','importada','rechazada')),
  unique (comercio_id, huella)
);
create index if not exists club_altas_estado on public.club_altas (comercio_id, estado, id);
alter table public.club_altas enable row level security;
drop policy if exists "el equipo ve las altas del club" on public.club_altas;
create policy "el equipo ve las altas del club" on public.club_altas for select to authenticated
  using (public.rol_en(comercio_id) in ('admin','supervisor','mostrador'));
revoke all on public.club_altas from anon;
revoke insert, update, delete, truncate on public.club_altas from authenticated;
grant select on public.club_altas to authenticated;

-- El equipo marca lo que ya importó (así la bandeja no crece sin fin).
create or replace function public.club_altas_marcar(p_comercio uuid, p_ids bigint[], p_estado text)
returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin','supervisor','mostrador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_estado not in ('importada','rechazada') then raise exception 'estado inválido'; end if;
  update public.club_altas set estado = p_estado
   where comercio_id = p_comercio and id = any(p_ids) and estado = 'nueva';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.club_altas_marcar(uuid, bigint[], text) from public, anon;
grant execute on function public.club_altas_marcar(uuid, bigint[], text) to authenticated;

create table if not exists public.menu_eventos (
  id          bigint generated always as identity primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  creado      timestamptz not null default now(),
  tipo        text not null check (tipo in ('pedido','arrepentimiento')),
  items       int,
  total       bigint,
  ip          text
);
create index if not exists menu_eventos_c on public.menu_eventos (comercio_id, creado);
alter table public.menu_eventos enable row level security;
drop policy if exists "el equipo ve eventos del menú" on public.menu_eventos;
create policy "el equipo ve eventos del menú" on public.menu_eventos for select to authenticated
  using (public.rol_en(comercio_id) in ('admin','supervisor'));
revoke all on public.menu_eventos from anon;
revoke insert, update, delete, truncate on public.menu_eventos from authenticated;
grant select on public.menu_eventos to authenticated;

create or replace function public.rave_ip()
returns text
language sql stable set search_path = public
as $$
  select left(coalesce(split_part(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json->>'x-forwarded-for', ',', 1), ''), 45);
$$;

-- Alta: p_cifrado = {k, iv, ct} (RSA-OAEP + AES-GCM, armado en el navegador).
-- La respuesta es SIEMPRE la misma (no revela si el número ya estaba).
create or replace function public.club_alta(p_slug text, p_huella text, p_cifrado jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_c  uuid;
  v_ip text := public.rave_ip();
begin
  select id into v_c from public.comercios where slug = lower(left(coalesce(p_slug, ''), 40));
  if v_c is null or not exists (select 1 from public.menus where comercio_id = v_c) then
    return jsonb_build_object('ok', false, 'error', 'menú no disponible');
  end if;
  if jsonb_typeof(p_cifrado) <> 'object' or not (p_cifrado ? 'k' and p_cifrado ? 'iv' and p_cifrado ? 'ct')
     or pg_column_size(p_cifrado) > 4000 or length(coalesce(p_huella, '')) not between 32 and 128 then
    return jsonb_build_object('ok', false, 'error', 'datos inválidos');
  end if;
  if v_ip <> '' and (select count(*) from public.club_altas where ip = v_ip and creado > now() - interval '1 hour') >= 6 then
    return jsonb_build_object('ok', false, 'error', 'Demasiados intentos desde tu conexión: probá más tarde.');
  end if;
  if (select count(*) from public.club_altas where comercio_id = v_c and creado > now() - interval '1 hour') >= 200 then
    return jsonb_build_object('ok', false, 'error', 'Hay muchas altas en este momento: probá más tarde.');
  end if;
  insert into public.club_altas (comercio_id, huella, cifrado, ip)
  values (v_c, p_huella, p_cifrado, nullif(v_ip, ''))
  on conflict (comercio_id, huella) do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.club_alta(text, text, jsonb) from public;
grant execute on function public.club_alta(text, text, jsonb) to anon, authenticated;

create or replace function public.menu_evento(p_slug text, p_tipo text, p_items int default null, p_total bigint default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_c uuid;
  v_ip text := public.rave_ip();
begin
  if p_tipo not in ('pedido','arrepentimiento') then return; end if;
  select id into v_c from public.comercios where slug = lower(left(coalesce(p_slug, ''), 40));
  if v_c is null then return; end if;
  if v_ip <> '' and (select count(*) from public.menu_eventos where ip = v_ip and creado > now() - interval '1 hour') >= 30 then return; end if;
  if (select count(*) from public.menu_eventos where comercio_id = v_c and creado > now() - interval '1 hour') >= 500 then return; end if;
  insert into public.menu_eventos (comercio_id, tipo, items, total, ip)
  values (v_c, p_tipo, least(greatest(coalesce(p_items, 0), 0), 500),
          least(greatest(coalesce(p_total, 0), 0), 100000000000), nullif(v_ip, ''));
end $$;
revoke all on function public.menu_evento(text, text, int, bigint) from public;
grant execute on function public.menu_evento(text, text, int, bigint) to anon, authenticated;

-- ===== 05-arca.sql =====
-- =====================================================================
-- SISTEMA RAVE · 05 · Facturación electrónica ARCA (CAE automático)
-- Correr DESPUÉS de 01 a 04. Se puede correr las veces que haga falta.
--
-- Todo el trato con ARCA (WSAA + WSFEv1) lo hace la Edge Function "arca"
-- en el servidor: el navegador NUNCA habla con ARCA ni ve la clave privada.
--
--   · arca_config        datos del emisor por ambiente (homologación / producción)
--   · arca_credenciales  clave privada (cifrada con un secreto de la función),
--                        CSR, certificado y ticket de acceso. SIN políticas:
--                        ningún usuario la lee por la API; sólo el rol de servicio.
--   · arca_comprobantes  un renglón por documento: pendiente → enviando →
--                        aprobado / rechazado / error. Con CAE es INMUTABLE.
--   · arca_locks         cerrojo con vencimiento por (comercio, ambiente, punto
--                        de venta, tipo) para numerar de a uno.
-- Apagado por defecto: nada se factura hasta que el administrador lo active
-- y se haya probado en homologación con su certificado real.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Validación de CUIT/CUIL (dígito verificador, módulo 11)
-- ---------------------------------------------------------------------
create or replace function public.rave_cuit_ok(p text)
returns boolean
language plpgsql immutable set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  w int[] := array[5,4,3,2,7,6,5,4,3,2];
  s int := 0; i int; r int; v int;
begin
  if length(d) <> 11 then return false; end if;
  if d !~ '^(20|23|24|25|26|27|30|33|34)' then return false; end if;
  for i in 1..10 loop s := s + substr(d, i, 1)::int * w[i]; end loop;
  r := 11 - (s % 11);
  v := case r when 11 then 0 when 10 then 9 else r end;
  return v = substr(d, 11, 1)::int;
end $$;

-- ---------------------------------------------------------------------
-- 2. Configuración del emisor
-- ---------------------------------------------------------------------
create table if not exists public.arca_config (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  ambiente    text not null check (ambiente in ('homologacion','produccion')),
  cuit        text not null check (cuit ~ '^[0-9]{11}$'),
  razon_social text not null check (length(razon_social) between 2 and 120),
  cond_iva    text not null check (cond_iva in ('RI','MONO','EXENTO')),
  pto_vta     int  not null check (pto_vta between 1 and 99999),
  alias       text not null check (alias ~ '^[A-Za-z0-9_-]{3,30}$'),
  alicuota    numeric(5,2) not null default 21 check (alicuota in (0,2.5,5,10.5,21,27)),
  activo      boolean not null default false,   -- apagado por defecto
  actualizado timestamptz not null default now(),
  actualizado_por uuid,
  primary key (comercio_id, ambiente)
);
alter table public.arca_config enable row level security;
drop policy if exists "el equipo ve la config de ARCA" on public.arca_config;
create policy "el equipo ve la config de ARCA" on public.arca_config for select to authenticated
  using (public.rol_en(comercio_id) in ('admin','supervisor','mostrador'));
revoke all on public.arca_config from anon;
revoke insert, update, delete, truncate on public.arca_config from authenticated;
grant select on public.arca_config to authenticated;

create or replace function public.arca_guardar_config(
  p_comercio uuid, p_ambiente text, p_cuit text, p_razon text, p_cond text,
  p_pto int, p_alias text, p_alicuota numeric default 21, p_activo boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_cuit text := regexp_replace(coalesce(p_cuit, ''), '\D', '', 'g');
begin
  if not public.es_admin(p_comercio) then
    raise exception 'sólo el administrador' using errcode = '42501';
  end if;
  if not public.rave_cuit_ok(v_cuit) then
    return jsonb_build_object('ok', false, 'error', 'El CUIT no es válido (revisá los 11 dígitos).');
  end if;
  if p_activo and not exists (select 1 from public.arca_credenciales
                               where comercio_id = p_comercio and ambiente = p_ambiente and cert is not null) then
    return jsonb_build_object('ok', false, 'error', 'Para activar la facturación primero hay que cargar el certificado de ARCA.');
  end if;
  insert into public.arca_config as t (comercio_id, ambiente, cuit, razon_social, cond_iva, pto_vta, alias, alicuota, activo, actualizado_por)
  values (p_comercio, p_ambiente, v_cuit, left(trim(p_razon), 120), p_cond, p_pto, p_alias, coalesce(p_alicuota, 21), coalesce(p_activo, false), auth.uid())
  on conflict (comercio_id, ambiente) do update
    set cuit = excluded.cuit, razon_social = excluded.razon_social, cond_iva = excluded.cond_iva,
        pto_vta = excluded.pto_vta, alias = excluded.alias, alicuota = excluded.alicuota,
        activo = excluded.activo, actualizado = now(), actualizado_por = auth.uid()
    where (t.cuit, t.pto_vta) is not distinct from (excluded.cuit, excluded.pto_vta)
       or not exists (select 1 from public.arca_comprobantes c
                       where c.comercio_id = t.comercio_id and c.ambiente = t.ambiente and c.estado = 'aprobado');
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ya hay comprobantes aprobados: no se puede cambiar el CUIT ni el punto de venta de este ambiente.');
  end if;
  return jsonb_build_object('ok', true);
exception when check_violation then
  return jsonb_build_object('ok', false, 'error', 'Datos inválidos: revisá alias (sin espacios), punto de venta y alícuota.');
end $$;
revoke all on function public.arca_guardar_config(uuid, text, text, text, text, int, text, numeric, boolean) from public, anon;
grant execute on function public.arca_guardar_config(uuid, text, text, text, text, int, text, numeric, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Credenciales (sin políticas: sólo el rol de servicio)
-- ---------------------------------------------------------------------
create table if not exists public.arca_credenciales (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  ambiente    text not null check (ambiente in ('homologacion','produccion')),
  key_enc     text,          -- clave privada RSA, cifrada AES-GCM con ARCA_MASTER_KEY (secreto de la función)
  csr         text,
  cert        text,          -- certificado .crt (público)
  cert_vence  timestamptz,
  ta_enc      text,          -- ticket de acceso WSAA (token+sign) cifrado
  ta_vence    timestamptz,
  actualizado timestamptz not null default now(),
  primary key (comercio_id, ambiente)
);
alter table public.arca_credenciales enable row level security;
revoke all on public.arca_credenciales from anon, authenticated;

-- Lo único que ve el equipo de las credenciales: si hay CSR/certificado y cuándo vence.
create or replace function public.arca_estado_credenciales(p_comercio uuid, p_ambiente text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when public.rol_en(p_comercio) in ('admin','supervisor','mostrador') then
    coalesce((select jsonb_build_object('tiene_clave', key_enc is not null, 'tiene_csr', csr is not null,
              'tiene_cert', cert is not null, 'cert_vence', cert_vence, 'csr', case when cert is null then csr end)
       from public.arca_credenciales where comercio_id = p_comercio and ambiente = p_ambiente),
       jsonb_build_object('tiene_clave', false, 'tiene_csr', false, 'tiene_cert', false))
  else null end;
$$;
revoke all on function public.arca_estado_credenciales(uuid, text) from public, anon;
grant execute on function public.arca_estado_credenciales(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Comprobantes
-- ---------------------------------------------------------------------
create table if not exists public.arca_comprobantes (
  id          uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  ambiente    text not null check (ambiente in ('homologacion','produccion')),
  venta_id    text not null check (length(venta_id) between 1 and 80),   -- id de la venta (o de la nota de crédito) en el sistema
  pto_vta     int  not null,
  tipo        int  not null check (tipo in (1,2,3,6,7,8,11,12,13)),      -- A/B/C: factura, ND, NC
  numero      bigint,
  estado      text not null default 'pendiente' check (estado in ('pendiente','enviando','aprobado','rechazado','error')),
  cae         text,
  cae_vto     date,
  fecha_cbte  date,
  imp_total   bigint,                  -- centavos
  imp_neto    bigint,
  imp_iva     bigint,
  receptor    jsonb,                   -- {docTipo, docNro, condIva, nombre}
  solicitud   jsonb,                   -- lo enviado a ARCA (sin credenciales)
  respuesta   jsonb,                   -- lo respondido (observaciones/errores)
  asociado    jsonb,                   -- CbtesAsoc para notas de crédito/débito
  intentos    int  not null default 0,
  lease_hasta timestamptz,
  proximo_intento timestamptz,
  error       text,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  creado_por  uuid,
  unique (comercio_id, ambiente, venta_id, tipo)
);
create index if not exists arca_cbte_estado on public.arca_comprobantes (comercio_id, estado, proximo_intento);
create unique index if not exists arca_cbte_numero on public.arca_comprobantes (comercio_id, ambiente, pto_vta, tipo, numero) where numero is not null and estado = 'aprobado';
alter table public.arca_comprobantes enable row level security;
drop policy if exists "el equipo ve los comprobantes ARCA" on public.arca_comprobantes;
create policy "el equipo ve los comprobantes ARCA" on public.arca_comprobantes for select to authenticated
  using (public.rol_en(comercio_id) in ('admin','supervisor','mostrador'));
revoke all on public.arca_comprobantes from anon;
revoke insert, update, delete, truncate on public.arca_comprobantes from authenticated;
grant select on public.arca_comprobantes to authenticated;

-- Con CAE el comprobante no se toca más (se corrige con nota de crédito/débito).
create or replace function public.arca_inmutable()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.estado = 'aprobado' then raise exception 'un comprobante con CAE no se borra'; end if;
    return old;
  end if;
  if old.estado = 'aprobado' then
    raise exception 'un comprobante con CAE es inmutable: se corrige con nota de crédito o débito';
  end if;
  return new;
end $$;
drop trigger if exists arca_comprobantes_inmutable on public.arca_comprobantes;
create trigger arca_comprobantes_inmutable before update or delete on public.arca_comprobantes
  for each row execute function public.arca_inmutable();

-- ---------------------------------------------------------------------
-- 5. Cerrojo de numeración + reserva idempotente (sólo rol de servicio)
-- ---------------------------------------------------------------------
create table if not exists public.arca_locks (
  comercio_id uuid not null,
  ambiente    text not null,
  pto_vta     int  not null,
  tipo        int  not null,
  token       uuid not null,
  hasta       timestamptz not null,
  primary key (comercio_id, ambiente, pto_vta, tipo)
);
alter table public.arca_locks enable row level security;
revoke all on public.arca_locks from anon, authenticated;

create or replace function public.arca_lock_tomar(p_comercio uuid, p_ambiente text, p_pto int, p_tipo int, p_segundos int default 90)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_t uuid := gen_random_uuid(); n int;
begin
  insert into public.arca_locks (comercio_id, ambiente, pto_vta, tipo, token, hasta)
  values (p_comercio, p_ambiente, p_pto, p_tipo, v_t, now() + make_interval(secs => p_segundos))
  on conflict (comercio_id, ambiente, pto_vta, tipo) do update
    set token = excluded.token, hasta = excluded.hasta
    where public.arca_locks.hasta < now();
  get diagnostics n = row_count;
  if n = 0 then return null; end if;
  return v_t;
end $$;
revoke all on function public.arca_lock_tomar(uuid, text, int, int, int) from public, anon, authenticated;

create or replace function public.arca_lock_soltar(p_comercio uuid, p_ambiente text, p_pto int, p_tipo int, p_token uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from public.arca_locks
   where comercio_id = p_comercio and ambiente = p_ambiente and pto_vta = p_pto and tipo = p_tipo and token = p_token;
$$;
revoke all on function public.arca_lock_soltar(uuid, text, int, int, uuid) from public, anon, authenticated;

-- Reserva: una sola solicitud en vuelo por documento. Devuelve la fila y si hay que trabajar.
--   accion = 'hecho'   → ya tiene CAE (devolver tal cual, NO volver a pedir)
--            'ocupado' → otra solicitud está en curso
--            'trabajar'→ este llamado debe pedir el CAE
create or replace function public.arca_reservar(
  p_comercio uuid, p_ambiente text, p_venta text, p_pto int, p_tipo int,
  p_receptor jsonb, p_importes jsonb, p_asociado jsonb, p_usuario uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare r public.arca_comprobantes;
begin
  insert into public.arca_comprobantes (comercio_id, ambiente, venta_id, pto_vta, tipo, receptor, asociado, creado_por,
                                        imp_total, imp_neto, imp_iva)
  values (p_comercio, p_ambiente, p_venta, p_pto, p_tipo, p_receptor, p_asociado, p_usuario,
          (p_importes->>'total')::bigint, (p_importes->>'neto')::bigint, (p_importes->>'iva')::bigint)
  on conflict (comercio_id, ambiente, venta_id, tipo) do nothing;
  select * into r from public.arca_comprobantes
   where comercio_id = p_comercio and ambiente = p_ambiente and venta_id = p_venta and tipo = p_tipo for update;
  if r.estado = 'aprobado' then
    return jsonb_build_object('accion', 'hecho', 'id', r.id);
  end if;
  if r.estado = 'enviando' and r.lease_hasta > now() then
    return jsonb_build_object('accion', 'ocupado', 'id', r.id);
  end if;
  update public.arca_comprobantes
     set estado = 'enviando', lease_hasta = now() + interval '120 seconds', intentos = intentos + 1,
         receptor = coalesce(p_receptor, receptor), asociado = coalesce(p_asociado, asociado),
         imp_total = coalesce((p_importes->>'total')::bigint, imp_total), imp_neto = coalesce((p_importes->>'neto')::bigint, imp_neto),
         imp_iva = coalesce((p_importes->>'iva')::bigint, imp_iva), actualizado = now()
   where id = r.id;
  return jsonb_build_object('accion', 'trabajar', 'id', r.id, 'intentos', r.intentos + 1);
end $$;
revoke all on function public.arca_reservar(uuid, text, text, int, int, jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;

-- Resultado: lo escribe sólo la función de servidor.
create or replace function public.arca_resultado(
  p_id uuid, p_estado text, p_numero bigint, p_cae text, p_cae_vto date, p_fecha date,
  p_solicitud jsonb, p_respuesta jsonb, p_error text, p_reintento_seg int default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_estado not in ('enviando','aprobado','rechazado','error','pendiente') then raise exception 'estado inválido'; end if;
  if p_estado = 'enviando' then
    -- sólo anota el número que se está por pedir (para poder recuperar el CAE si la respuesta se pierde)
    update public.arca_comprobantes set numero = p_numero, actualizado = now()
     where id = p_id and estado = 'enviando';
    return;
  end if;
  update public.arca_comprobantes
     set estado = p_estado, numero = coalesce(p_numero, numero), cae = coalesce(p_cae, cae),
         cae_vto = coalesce(p_cae_vto, cae_vto), fecha_cbte = coalesce(p_fecha, fecha_cbte),
         solicitud = coalesce(p_solicitud, solicitud), respuesta = p_respuesta, error = left(p_error, 500),
         lease_hasta = null, actualizado = now(),
         proximo_intento = case when p_reintento_seg is null then null else now() + make_interval(secs => p_reintento_seg) end
   where id = p_id;
end $$;
revoke all on function public.arca_resultado(uuid, text, bigint, text, date, date, jsonb, jsonb, text, int) from public, anon, authenticated;

-- Quién soy yo para este comercio (la Edge Function reenvía el JWT del usuario y así no hace falta decodificarlo).
create or replace function public.arca_quien(p_comercio uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('uid', auth.uid(), 'rol', public.rol_en(p_comercio));
$$;
revoke all on function public.arca_quien(uuid) from public, anon;
grant execute on function public.arca_quien(uuid) to authenticated;

-- El CAE llega a la venta por acá (sólo el rol de servicio): el navegador no puede escribir el campo "arca".
create or replace function public.arca_aplicar_venta(p_comercio uuid, p_venta text, p_clave text, p_arca jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if p_clave not in ('arca', 'arcaNC') then raise exception 'clave inválida'; end if;
  update public.registros
     set datos = jsonb_set(datos, array[p_clave], p_arca, true), actualizado = clock_timestamp()
   where comercio_id = p_comercio and coleccion = 'ventas' and id = p_venta;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.arca_aplicar_venta(uuid, text, text, jsonb) from public, anon, authenticated;
