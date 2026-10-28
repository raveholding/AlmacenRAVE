-- INSTALAR-TODO.sql · proyecto Supabase NUEVO · Vincular Business · Sistema VB V26F
-- Pegar el CONTENIDO completo en SQL Editor y ejecutar una sola vez. Incluye 01 a 13 (no incluye 00 ni 90).
-- Si tu proyecto YA tenía 01 a 11 instalados, alcanza con pegar 12-pago-proveedor-cajas.sql y 13-tiendanube.sql (son aditivos e idempotentes, en ese orden). Si tenía 01 a 10, pegá 11, 12 y 13. Si ya tenía 01 a 13, alcanza con pegar 14-auditoria-search-path.sql.

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
--     que carga Vincular Business (ver rave_invitar_comercio al final).
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
--   comercio_id NULL  → alta de un comercio nuevo (la carga Vincular Business)
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
    raise exception 'Tu correo no tiene una invitación para crear un comercio. Pedila a Vincular Business.' using errcode = '42501';
  end if;
  if v_inv.intentos >= 8 then
    return jsonb_build_object('ok', false, 'error', 'Demasiados intentos con el código: pedí una invitación nueva a Vincular Business.');
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
-- 6. Soporte de Vincular Business (SÓLO desde el SQL Editor):
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
-- Sistema RAVE · 03 · Recuperación de clave y soporte de Vincular Business
-- Correr DESPUÉS de 01 y 02. Se puede correr las veces que haga falta.
--
--   (La llave de recuperación y la marca "temporal" ya están en 02.)
--   1. restablecer_clave_miembro(): el ADMINISTRADOR pone una clave temporal
--      a alguien de su equipo (nunca a otro administrador ni a gente que
--      también está en otro comercio).
--   2. soporte_restablecer_clave(): sólo Vincular Business, desde el SQL Editor.
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
    raise exception 'esa persona también está en otro comercio: el restablecimiento lo hace soporte de Vincular Business';
  end if;
  if exists (select 1 from public.miembros where comercio_id = p_comercio and usuario_id = p_usuario and rol = 'admin') then
    raise exception 'la clave de otro administrador la restablece soporte de Vincular Business';
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
-- 2. Soporte de Vincular Business (SÓLO desde el SQL Editor de Supabase):
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
-- 3. Pedidos de ayuda a Vincular Business
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

-- Configuración privada del aviso por mail (la carga Vincular Business en el SQL Editor):
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

-- ===== 06-v26.sql =====
-- =====================================================================
-- SISTEMA RAVE · 06 · V26: eliminación protegida de artículos, cajas/sucursales y traspasos
--
-- Correr DESPUÉS de 01..05 (se puede repetir: sólo "create or replace" y "if not exists").
-- Aditiva: no borra ni cambia datos. Reemplaza sincronizar() y rave_puede_escribir() por versiones
-- con las reglas nuevas (todo lo anterior sigue igual):
--   · Artículos: sólo el administrador elimina; un artículo con ventas/movimientos NO se borra
--     (se archiva); sólo el administrador archiva/restaura. Vista previa en inventario_vista_previa_borrado().
--   · Colecciones nuevas: sucs (sucursales), cajas (cajas operativas/principal), ctransf (traspasos entre cajas,
--     se escriben una vez; exigen perfil "main" o "branches", cajas existentes, importe entero > 0 y rubro válido).
-- =====================================================================

-- Referencias de un artículo (null = sin historial). Conservadora: cualquier mención cuenta.
create or replace function public.rave_prod_refs(p_comercio uuid, p_pid text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_n int; v_lista text[] := array[]::text[];
begin
  if p_pid is null or length(p_pid) < 1 then return null; end if;
  select count(*) into v_n from public.registros
   where comercio_id = p_comercio and coleccion = 'ventas' and not borrado
     and datos -> 'items' @> jsonb_build_array(jsonb_build_object('pid', p_pid));
  if v_n > 0 then v_lista := array_append(v_lista, (v_n || ' venta' || case when v_n = 1 then '' else 's' end)::text); end if;
  select count(*) into v_n from public.registros
   where comercio_id = p_comercio and coleccion = 'smov' and datos ->> 'pid' = p_pid;
  if v_n > 1 then v_lista := array_append(v_lista, 'movimientos de stock'::text); end if;
  if exists (select 1 from public.registros where comercio_id = p_comercio and not borrado
              and coleccion in ('pedidos', 'pya', 'cupones', 'planes', 'lotes')
              and position('"' || p_pid || '"' in datos::text) > 0) then
    v_lista := array_append(v_lista, 'pedidos, cupones o lotes'::text);
  end if;
  if array_length(v_lista, 1) is null then return null; end if;
  return array_to_string(v_lista, ', ');
end $$;
revoke all on function public.rave_prod_refs(uuid, text) from public, anon, authenticated;

-- Vista previa de una eliminación (sólo administrador). No cambia nada.
create or replace function public.inventario_vista_previa_borrado(p_comercio uuid, p_ids text[])
returns table (id text, nombre text, estado text, motivo text)
language plpgsql stable security definer set search_path = public as $$
declare v_id text; v_p public.registros; v_ref text;
begin
  if public.rol_en(p_comercio) is distinct from 'admin' then
    raise exception 'sólo el administrador' using errcode = '42501';
  end if;
  if p_ids is null or array_length(p_ids, 1) is null then return; end if;
  if array_length(p_ids, 1) > 500 then raise exception 'demasiados artículos (máximo 500)'; end if;
  foreach v_id in array p_ids loop
    select * into v_p from public.registros where comercio_id = p_comercio and coleccion = 'prod' and registros.id = v_id and not borrado;
    if not found then
      return query select v_id, '(no existe)'::text, 'inexistente'::text, 'No existe en el servidor.'::text;
    else
      v_ref := public.rave_prod_refs(p_comercio, v_id);
      return query select v_id, coalesce(v_p.datos ->> 'name', '?'),
                          case when v_ref is null then 'eliminable' else 'archivable' end,
                          case when v_ref is null then 'Sin historial.' else 'Tiene ' || v_ref || '.' end;
    end if;
  end loop;
end $$;
revoke all on function public.inventario_vista_previa_borrado(uuid, text[]) from public, anon;
grant execute on function public.inventario_vista_previa_borrado(uuid, text[]) to authenticated;

create or replace function public.rave_puede_escribir(p_rol text, p_col text, p_id text)
returns boolean language sql immutable as $$
  select case p_rol
    when 'admin' then true
    when 'supervisor' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                     'clientes','fiado','fich','pedidos','arrep','pya','membs',
                                     'prod','rubros','cierres','cnotas','cupones','planes','lotes','tareas','ctransf')
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
                                        'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf'];
  c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf'];
  c_borrables  constant text[] := array['prod','rubros','clientes','emp','puestos','tareas','cupones','planes','tlogs','pedidos'];
  c_cfg_ids    constant text[] := array['tenant','cfg','menu','loyalty','roles','integ','legal','clubkey'];
  c_secretos   constant text[] := array['arcaCert','arcaKey','arcaPem','accessToken','refreshToken','clientSecret','apiKey','serviceKey'];
  v_k          text;
  v_ref        text;
  v_perfil     text;
  v_aid        text;
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
        elsif v_borrado and v_col = 'prod' and v_rol <> 'admin' then
          v_motivo := 'sólo el administrador elimina artículos';
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

        -- V26 · 4.16 · un artículo con historial no se borra: se archiva. Sólo el administrador archiva o restaura.
        if v_motivo is null and v_col = 'prod' then
          if v_borrado and v_hay then
            v_ref := public.rave_prod_refs(p_comercio, v_id);
            if v_ref is not null then v_motivo := 'no se elimina (' || v_ref || '): archivalo'; end if;
          end if;
          if v_motivo is null and not v_borrado
             and coalesce((v_datos ->> 'archived')::boolean, false)
                 is distinct from coalesce((case when v_hay then (v_prev.datos ->> 'archived')::boolean end), false)
             and v_rol <> 'admin' then
            v_motivo := 'sólo el administrador archiva o restaura artículos';
          end if;
        end if;
        -- V26 · 4.14 · cajas y sucursales: sólo el administrador las define; los traspasos exigen el perfil habilitado
        if v_motivo is null and v_col = 'ctransf' then
          select datos ->> 'cashProfile' into v_perfil from public.registros
           where comercio_id = p_comercio and coleccion = 'cfg' and id = 'cfg' and not borrado;
          if coalesce(v_perfil, 'simple') not in ('main', 'branches') then
            v_motivo := 'el módulo de caja principal no está habilitado';
          elsif coalesce(v_datos ->> 'from', '') = '' or coalesce(v_datos ->> 'to', '') = '' or (v_datos ->> 'from') = (v_datos ->> 'to') then
            v_motivo := 'traspaso inválido: origen y destino deben ser cajas distintas';
          elsif jsonb_typeof(v_datos -> 'amount') is distinct from 'number' or (v_datos ->> 'amount')::numeric <= 0
                or (v_datos ->> 'amount')::numeric <> trunc((v_datos ->> 'amount')::numeric) or (v_datos ->> 'amount')::numeric > 100000000000 then
            v_motivo := 'traspaso inválido: el importe debe ser un entero positivo en centavos';
          elsif coalesce(btrim(v_datos ->> 'rubro'), '') = '' or not exists
                (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = (v_datos ->> 'rubro') and not borrado) then
            v_motivo := 'el rubro del movimiento es obligatorio y debe existir en este comercio';
          elsif (select count(*) from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and not borrado
                  and id in (v_datos ->> 'from', v_datos ->> 'to')) <> 2 then
            v_motivo := 'las cajas del traspaso no existen en este comercio';
          end if;
        end if;
        if v_motivo is null and v_col in ('cajas', 'sucs') and jsonb_typeof(v_datos -> 'name') is distinct from 'string' then
          v_motivo := 'falta el nombre';
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
        if v_col = 'prod' and v_borrado then
          v_aid := 'srv-' || gen_random_uuid()::text;
          insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
          values (p_comercio, 'audit', v_aid,
                  jsonb_build_object('id', v_aid, 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint,
                                     'user', coalesce(public.mi_email(), '?'), 'action', 'INV_ELIMINAR_SERVIDOR',
                                     'detail', 'artículo ' || v_id || ' eliminado (sin historial)', 'dev', left(p_dispositivo, 40)),
                  false, left(p_dispositivo, 40), auth.uid(), clock_timestamp())
          on conflict do nothing;
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


-- ===== 07-pagos-mixtos.sql =====
-- =====================================================================
-- SISTEMA RAVE · 07 · V26.1: pagos mixtos, vuelto y cuenta corriente parcial
--
-- Correr DESPUÉS de 01..06 (se puede repetir: sólo "create or replace").
-- Aditiva: no borra ni cambia datos. Reemplaza sincronizar() por una versión que, además de todo lo anterior:
--   · valida las ventas con pagos mixtos (ventas.pays): 1 a 5 medios, sin repetir, importes enteros > 0,
--     suma EXACTA = total, cuenta corriente sólo con cliente existente, cobros digitales (QR/MODO) no combinables;
--   · calcula en el servidor fiadoAmt / paid / balance / pstate (pagada · parcial · pendiente);
--   · congela importes, pagos, cliente e ítems de una venta con pagos ya registrados.
-- Modelo de datos (equivalente relacional de lo que guarda `registros`):
--   Ventas(id, n, ts, total, cust, status, pstate)            · Detalle_Ventas = ventas.items[]
--   Pagos_Venta(venta, m, a)                                  · = ventas.pays[]  (a = importe IMPUTADO, sin vuelto)
--   Cuentas_Corrientes_Movimientos: débito = parte 'fiado' de cada venta · crédito = registros 'fiado' (cobros)
--   -> se consulta con cc_movimientos(comercio, cliente); el saldo nunca se guarda aparte (no puede desfasarse).
-- =====================================================================

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
                                        'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf'];
  c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf'];
  c_borrables  constant text[] := array['prod','rubros','clientes','emp','puestos','tareas','cupones','planes','tlogs','pedidos'];
  c_cfg_ids    constant text[] := array['tenant','cfg','menu','loyalty','roles','integ','legal','clubkey'];
  c_secretos   constant text[] := array['arcaCert','arcaKey','arcaPem','accessToken','refreshToken','clientSecret','apiKey','serviceKey'];
  v_k          text;
  v_ref        text;
  v_perfil     text;
  v_aid        text;
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
        elsif v_borrado and v_col = 'prod' and v_rol <> 'admin' then
          v_motivo := 'sólo el administrador elimina artículos';
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

        -- V26 · 4.16 · un artículo con historial no se borra: se archiva. Sólo el administrador archiva o restaura.
        if v_motivo is null and v_col = 'prod' then
          if v_borrado and v_hay then
            v_ref := public.rave_prod_refs(p_comercio, v_id);
            if v_ref is not null then v_motivo := 'no se elimina (' || v_ref || '): archivalo'; end if;
          end if;
          if v_motivo is null and not v_borrado
             and coalesce((v_datos ->> 'archived')::boolean, false)
                 is distinct from coalesce((case when v_hay then (v_prev.datos ->> 'archived')::boolean end), false)
             and v_rol <> 'admin' then
            v_motivo := 'sólo el administrador archiva o restaura artículos';
          end if;
        end if;
        -- V26 · 4.14 · cajas y sucursales: sólo el administrador las define; los traspasos exigen el perfil habilitado
        if v_motivo is null and v_col = 'ctransf' then
          select datos ->> 'cashProfile' into v_perfil from public.registros
           where comercio_id = p_comercio and coleccion = 'cfg' and id = 'cfg' and not borrado;
          if coalesce(v_perfil, 'simple') not in ('main', 'branches') then
            v_motivo := 'el módulo de caja principal no está habilitado';
          elsif coalesce(v_datos ->> 'from', '') = '' or coalesce(v_datos ->> 'to', '') = '' or (v_datos ->> 'from') = (v_datos ->> 'to') then
            v_motivo := 'traspaso inválido: origen y destino deben ser cajas distintas';
          elsif jsonb_typeof(v_datos -> 'amount') is distinct from 'number' or (v_datos ->> 'amount')::numeric <= 0
                or (v_datos ->> 'amount')::numeric <> trunc((v_datos ->> 'amount')::numeric) or (v_datos ->> 'amount')::numeric > 100000000000 then
            v_motivo := 'traspaso inválido: el importe debe ser un entero positivo en centavos';
          elsif coalesce(btrim(v_datos ->> 'rubro'), '') = '' or not exists
                (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = (v_datos ->> 'rubro') and not borrado) then
            v_motivo := 'el rubro del movimiento es obligatorio y debe existir en este comercio';
          elsif (select count(*) from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and not borrado
                  and id in (v_datos ->> 'from', v_datos ->> 'to')) <> 2 then
            v_motivo := 'las cajas del traspaso no existen en este comercio';
          end if;
        end if;
        -- V26.1 · pagos mixtos: la suma de los pagos tiene que dar el total exacto; la cuenta corriente exige cliente real.
        -- Los valores derivados (fiadoAmt, paid, balance, pstate) los calcula el servidor: el navegador no los puede falsear.
        if v_motivo is null and v_col = 'ventas' and v_datos ? 'pays' then
          declare
            v_p   jsonb;  v_sum numeric := 0;  v_fi numeric := 0;  v_tot numeric;  v_seen text[] := '{}';  v_m text;
          begin
            v_tot := case when jsonb_typeof(v_datos -> 'total') = 'number' then (v_datos ->> 'total')::numeric end;
            if jsonb_typeof(v_datos -> 'pays') is distinct from 'array' or jsonb_array_length(v_datos -> 'pays') not between 1 and 5 then
              v_motivo := 'pagos inválidos: tiene que haber entre 1 y 5 medios';
            elsif v_tot is null or v_tot <= 0 or v_tot <> trunc(v_tot) then
              v_motivo := 'total de la venta inválido (entero positivo en centavos)';
            else
              for v_p in select * from jsonb_array_elements(v_datos -> 'pays') loop
                v_m := v_p ->> 'm';
                if v_m is null or not (v_m = any(array['efectivo','debito','credito','transferencia','fiado','qr','modo','pedidosya'])) then
                  v_motivo := 'medio de pago inválido'; exit;
                elsif v_m = any(v_seen) then
                  v_motivo := 'medio de pago repetido'; exit;
                elsif jsonb_typeof(v_p -> 'a') is distinct from 'number' or (v_p ->> 'a')::numeric <= 0 or (v_p ->> 'a')::numeric <> trunc((v_p ->> 'a')::numeric) then
                  v_motivo := 'importe de pago inválido (entero positivo en centavos)'; exit;
                end if;
                v_seen := v_seen || v_m;
                v_sum := v_sum + (v_p ->> 'a')::numeric;
                if v_m = 'fiado' then v_fi := v_fi + (v_p ->> 'a')::numeric; end if;
              end loop;
              if v_motivo is null and v_sum <> v_tot then
                v_motivo := 'la suma de los pagos (' || v_sum || ') no coincide con el total (' || v_tot || ')';
              elsif v_motivo is null and jsonb_array_length(v_datos -> 'pays') > 1 and (v_seen && array['qr','modo','pedidosya']) then
                v_motivo := 'los cobros digitales no se combinan con otro medio';
              elsif v_motivo is null and v_fi > 0 and (coalesce(v_datos ->> 'cust', '') = '' or not exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'clientes'
                        and id = (v_datos ->> 'cust') and not borrado)) then
                v_motivo := 'la cuenta corriente exige un cliente identificado que exista en este comercio';
              end if;
            end if;
            if v_motivo is null then
              v_datos := v_datos || jsonb_build_object('fiadoAmt', v_fi, 'paid', v_tot - v_fi, 'balance', v_fi, 'fiado', v_fi > 0,
                                  'pstate', case when v_fi = 0 then 'pagada' when v_fi >= v_tot then 'pendiente' else 'parcial' end);
            end if;
          end;
        end if;
        if v_motivo is null and v_col in ('cajas', 'sucs') and jsonb_typeof(v_datos -> 'name') is distinct from 'string' then
          v_motivo := 'falta el nombre';
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
            -- V26.1 · una venta con pagos registrados no cambia sus importes ni su cliente (se corrige con anulación / nota de crédito)
            if v_prev.datos ? 'pays' then
              v_datos := (v_datos - 'pays' - 'fiadoAmt' - 'paid' - 'balance' - 'vuelto' - 'recv' - 'total' - 'items' - 'cust' - 'custName' - 'method' - 'pstate' - 'fiado')
                         || jsonb_strip_nulls(jsonb_build_object('pays', v_prev.datos -> 'pays', 'fiadoAmt', v_prev.datos -> 'fiadoAmt',
                            'paid', v_prev.datos -> 'paid', 'balance', v_prev.datos -> 'balance', 'vuelto', v_prev.datos -> 'vuelto',
                            'recv', v_prev.datos -> 'recv', 'total', v_prev.datos -> 'total', 'items', v_prev.datos -> 'items',
                            'cust', v_prev.datos -> 'cust', 'custName', v_prev.datos -> 'custName', 'method', v_prev.datos -> 'method',
                            'pstate', v_prev.datos -> 'pstate', 'fiado', v_prev.datos -> 'fiado'));
            end if;
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
        if v_col = 'prod' and v_borrado then
          v_aid := 'srv-' || gen_random_uuid()::text;
          insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
          values (p_comercio, 'audit', v_aid,
                  jsonb_build_object('id', v_aid, 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint,
                                     'user', coalesce(public.mi_email(), '?'), 'action', 'INV_ELIMINAR_SERVIDOR',
                                     'detail', 'artículo ' || v_id || ' eliminado (sin historial)', 'dev', left(p_dispositivo, 40)),
                  false, left(p_dispositivo, 40), auth.uid(), clock_timestamp())
          on conflict do nothing;
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

create or replace function public.cc_movimientos(p_comercio uuid, p_cliente text)
returns table(ts numeric, tipo text, importe numeric, detalle text, saldo numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.rol_en(p_comercio) is null then
    raise exception 'no sos miembro de este comercio' using errcode = '42501';
  end if;
  return query
    with mov as (
      select (r.datos ->> 'ts')::numeric as t, 'debito'::text as k,
             case when r.datos ? 'pays'
                  then coalesce((select sum((p ->> 'a')::numeric) from jsonb_array_elements(r.datos -> 'pays') p where p ->> 'm' = 'fiado'), 0)
                  else (r.datos ->> 'total')::numeric end as imp,
             'Venta ' || coalesce(r.datos ->> 'n', r.id) as det
        from public.registros r
       where r.comercio_id = p_comercio and r.coleccion = 'ventas' and not r.borrado
         and r.datos ->> 'cust' = p_cliente and coalesce((r.datos ->> 'fiado')::boolean, false)
         and r.datos ->> 'status' = 'ok'
      union all
      select (r.datos ->> 'ts')::numeric, 'credito', (r.datos ->> 'amount')::numeric, 'Cobro de deuda'
        from public.registros r
       where r.comercio_id = p_comercio and r.coleccion = 'fiado' and not r.borrado and r.datos ->> 'cust' = p_cliente
    )
    select m.t, m.k, m.imp, m.det,
           sum(case when m.k = 'debito' then m.imp else -m.imp end) over (order by m.t, m.k rows unbounded preceding)
      from mov m order by m.t, m.k;
end $$;
revoke all on function public.cc_movimientos(uuid, text) from public, anon;
grant execute on function public.cc_movimientos(uuid, text) to authenticated;

-- ===== 08-proveedores-compras.sql =====
-- =====================================================================
-- SISTEMA VB · 08 · Proveedores, órdenes de compra, ingreso de mercadería y cuenta corriente
--
-- Correr DESPUÉS de 01..07 (se puede repetir: sólo "if not exists" y "create or replace").
-- ADITIVA: no borra ni cambia datos, no toca ventas, caja ni stock existentes. Reemplaza únicamente
-- rave_prod_refs() (06) para que un artículo comprado a un proveedor se archive en vez de borrarse.
--
-- Modelo (el comercio = tenant; la columna se llama tenant_id y apunta a public.comercios.id,
-- el mismo identificador que `comercio_id` en el resto del esquema):
--   proveedores · ordenes_compra · ordenes_compra_detalles · ingresos_mercaderia (+ _detalles)
--   · cuenta_corriente_proveedores (libro mayor: sólo se agrega, nunca se edita ni se borra)
--
-- Seguridad:
--   · RLS en todas las tablas: sólo admin y supervisor del comercio las LEEN; nadie las escribe directo
--     (sin INSERT/UPDATE/DELETE para `authenticated`): se escribe sólo con las funciones de abajo,
--     que validan comercio, rol, importes y existencia de cada dato en el servidor.
--   · Los importes los recalcula el servidor (el navegador no manda totales).
--   · Idempotencia: cada operación de dinero exige una idempotency_key; reenviar la misma no duplica nada.
--
-- Integración con lo existente (el inventario y la caja viven en `registros`, jsonb por colección):
--   · producto_id es el id del artículo (coleccion 'prod'). No puede ser una clave foránea real porque el
--     catálogo no es una tabla relacional: cada función verifica en el servidor que exista en el mismo comercio.
--   · El ingreso de mercadería suma stock al artículo (más un movimiento 'smov' de respaldo), actualiza su
--     costo (último costo de compra) y, si es al contado en efectivo, escribe el egreso en la caja abierta
--     (colección 'movs') con rubro obligatorio. Todo en una sola transacción: si algo falla, no queda nada.
--   · Importes en esta parte: pesos con 2 decimales (numeric(14,2)). El catálogo y la caja los guardan en
--     centavos enteros; la conversión se hace en un único lugar de cada función (round(x * 100)).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------
create table if not exists public.proveedores (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.comercios(id) on delete cascade,
  razon_social  text not null check (length(btrim(razon_social)) between 2 and 120),
  cuit          text not null check (cuit ~ '^[0-9]{11}$'),
  condicion_iva text not null check (condicion_iva in ('Responsable Inscripto', 'Monotributista', 'Exento')),
  email         text check (email is null or (length(email) <= 120 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  telefono      text check (telefono is null or length(telefono) <= 40),
  direccion     text check (direccion is null or length(direccion) <= 200),
  saldo_cuenta_corriente numeric(14,2) not null default 0,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  deleted_at    timestamptz,
  unique (id, tenant_id)
);
create unique index if not exists proveedores_cuit_unico on public.proveedores (tenant_id, cuit) where deleted_at is null;
create index if not exists proveedores_tenant on public.proveedores (tenant_id, razon_social);

create table if not exists public.compras_contadores (
  tenant_id uuid not null references public.comercios(id) on delete cascade,
  clave     text not null,
  valor     bigint not null default 0,
  primary key (tenant_id, clave)
);

create table if not exists public.ordenes_compra (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.comercios(id) on delete cascade,
  numero          bigint not null,
  proveedor_id    uuid not null,
  estado          text not null check (estado in ('Borrador', 'Solicitada', 'Recibida', 'Cancelada')),
  total           numeric(14,2) not null check (total >= 0),
  fecha_emision   timestamptz not null default now(),
  observaciones   text check (observaciones is null or length(observaciones) <= 500),
  idempotency_key text check (idempotency_key is null or length(idempotency_key) between 8 and 80),
  recibida_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  unique (id, tenant_id),
  unique (tenant_id, numero),
  foreign key (proveedor_id, tenant_id) references public.proveedores (id, tenant_id)
);
create unique index if not exists ordenes_compra_idem on public.ordenes_compra (tenant_id, idempotency_key) where idempotency_key is not null;
create index if not exists ordenes_compra_prov on public.ordenes_compra (tenant_id, proveedor_id, estado);

create table if not exists public.ordenes_compra_detalles (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.comercios(id) on delete cascade,
  orden_id             uuid not null,
  producto_id          text not null check (length(producto_id) between 1 and 80),
  producto_nombre      text,
  cantidad             numeric(14,3) not null check (cantidad > 0),
  precio_costo_pactado numeric(14,2) not null check (precio_costo_pactado >= 0),
  foreign key (orden_id, tenant_id) references public.ordenes_compra (id, tenant_id) on delete cascade,
  unique (orden_id, producto_id)
);

create table if not exists public.ingresos_mercaderia (
  id                         uuid primary key default gen_random_uuid(),
  tenant_id                  uuid not null references public.comercios(id) on delete cascade,
  proveedor_id               uuid not null,
  orden_compra_id            uuid,
  nro_comprobante_o_remito   text not null check (length(nro_comprobante_o_remito) between 1 and 40),
  tipo_comprobante           text not null check (tipo_comprobante in ('Factura', 'Remito')),
  fecha_recepcion            date not null,
  condicion_pago             text not null check (condicion_pago in ('credito', 'contado')),
  medio_pago                 text check (medio_pago is null or medio_pago in ('efectivo', 'transferencia', 'cheque', 'tarjeta')),
  rubro_id                   text,
  turno_id                   text,
  movimiento_caja_id         text,
  total                      numeric(14,2) not null check (total > 0),
  observaciones              text check (observaciones is null or length(observaciones) <= 500),
  idempotency_key            text not null check (length(idempotency_key) between 8 and 80),
  resultado                  jsonb,
  created_at                 timestamptz not null default now(),
  created_by                 uuid references auth.users(id) on delete set null,
  unique (id, tenant_id),
  foreign key (proveedor_id, tenant_id) references public.proveedores (id, tenant_id),
  foreign key (orden_compra_id, tenant_id) references public.ordenes_compra (id, tenant_id)
);
create unique index if not exists ingresos_idem on public.ingresos_mercaderia (tenant_id, idempotency_key);
create unique index if not exists ingresos_comprobante_unico on public.ingresos_mercaderia (tenant_id, proveedor_id, tipo_comprobante, lower(nro_comprobante_o_remito));
create index if not exists ingresos_prov on public.ingresos_mercaderia (tenant_id, proveedor_id, fecha_recepcion desc);

create table if not exists public.ingresos_mercaderia_detalles (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.comercios(id) on delete cascade,
  ingreso_id       uuid not null,
  producto_id      text not null check (length(producto_id) between 1 and 80),
  producto_nombre  text,
  cantidad         numeric(14,3) not null check (cantidad > 0),
  precio_costo     numeric(14,2) not null check (precio_costo >= 0),
  stock_anterior   numeric(14,3),
  stock_nuevo      numeric(14,3),
  costo_anterior   numeric(14,2),
  costo_nuevo      numeric(14,2),
  foreign key (ingreso_id, tenant_id) references public.ingresos_mercaderia (id, tenant_id) on delete cascade,
  unique (ingreso_id, producto_id)
);

create table if not exists public.cuenta_corriente_proveedores (
  id               uuid primary key default gen_random_uuid(),
  seq              bigint generated always as identity,
  tenant_id        uuid not null references public.comercios(id) on delete cascade,
  proveedor_id     uuid not null,
  tipo_movimiento  text not null check (tipo_movimiento in ('Factura', 'Remito', 'Pago', 'Nota de Crédito')),
  monto            numeric(14,2) not null check (monto > 0),
  saldo_acumulado  numeric(14,2) not null,
  fecha            timestamptz not null default clock_timestamp(),
  ingreso_id       uuid,
  referencia       text check (referencia is null or length(referencia) <= 80),
  medio_pago       text check (medio_pago is null or medio_pago in ('efectivo', 'transferencia', 'cheque', 'tarjeta')),
  rubro_id         text,
  movimiento_caja_id text,
  motivo           text check (motivo is null or length(motivo) <= 200),
  idempotency_key  text check (idempotency_key is null or length(idempotency_key) between 8 and 80),
  created_by       uuid references auth.users(id) on delete set null,
  foreign key (proveedor_id, tenant_id) references public.proveedores (id, tenant_id),
  foreign key (ingreso_id, tenant_id) references public.ingresos_mercaderia (id, tenant_id)
);
create unique index if not exists ccprov_idem on public.cuenta_corriente_proveedores (tenant_id, idempotency_key) where idempotency_key is not null;
create index if not exists ccprov_prov on public.cuenta_corriente_proveedores (tenant_id, proveedor_id, seq);

-- El libro mayor y los ingresos NO se editan ni se borran (un error se corrige con una nota de crédito o un pago).
-- Los borrados en cascada al eliminar un comercio entero sí se permiten (corren a profundidad > 1).
create or replace function public.rave_solo_agregar() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then raise exception '% no se modifica: es un registro contable (se corrige con un movimiento nuevo)', tg_table_name; end if;
  if tg_op = 'DELETE' and pg_trigger_depth() <= 1 then raise exception '% no se borra: es un registro contable', tg_table_name; end if;
  return old;
end $$;
drop trigger if exists ccprov_solo_agregar on public.cuenta_corriente_proveedores;
create trigger ccprov_solo_agregar before update or delete on public.cuenta_corriente_proveedores for each row execute function public.rave_solo_agregar();
drop trigger if exists ingresos_solo_agregar on public.ingresos_mercaderia;
create trigger ingresos_solo_agregar before delete on public.ingresos_mercaderia for each row execute function public.rave_solo_agregar();
drop trigger if exists ingresos_det_solo_agregar on public.ingresos_mercaderia_detalles;
create trigger ingresos_det_solo_agregar before update or delete on public.ingresos_mercaderia_detalles for each row execute function public.rave_solo_agregar();

-- ---------------------------------------------------------------------
-- 2. RLS: lectura sólo para admin y supervisor del mismo comercio; escritura sólo por funciones
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['proveedores', 'compras_contadores', 'ordenes_compra', 'ordenes_compra_detalles', 'ingresos_mercaderia',
                           'ingresos_mercaderia_detalles', 'cuenta_corriente_proveedores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    if t <> 'compras_contadores' then
      execute format('grant select on public.%I to authenticated', t);
      execute format('drop policy if exists "compras: leen admin y supervisor" on public.%I', t);
      execute format($p$create policy "compras: leen admin y supervisor" on public.%I for select to authenticated
                        using (public.rol_en(tenant_id) in ('admin', 'supervisor'))$p$, t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Ayudas internas (no se pueden llamar desde la API)
-- ---------------------------------------------------------------------
create or replace function public.rave_compras_acceso(p_comercio uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_rol text := public.rol_en(p_comercio);
begin
  if v_rol is null then raise exception 'no sos miembro de este comercio' using errcode = '42501'; end if;
  if v_rol not in ('admin', 'supervisor') then raise exception 'tu rol no puede operar compras y proveedores' using errcode = '42501'; end if;
  return v_rol;
end $$;

create or replace function public.rave_num(p jsonb, k text) returns numeric language sql immutable as $$
  select case when jsonb_typeof(p -> k) = 'number' then (p ->> k)::numeric end $$;
create or replace function public.rave_txt(p jsonb, k text) returns text language sql immutable as $$
  select case when jsonb_typeof(p -> k) = 'string' then nullif(btrim(p ->> k), '') end $$;
create or replace function public.rave_uuid(p text) returns uuid language plpgsql immutable as $$
begin return p::uuid; exception when others then return null; end $$;

create or replace function public.rave_nombre_usuario(p_comercio uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(nombre), ''), email, 'usuario') from public.miembros where comercio_id = p_comercio and usuario_id = auth.uid() $$;

-- hoy en la zona del comercio (Salta)
create or replace function public.rave_hoy() returns date language sql stable as $$
  select (now() at time zone 'America/Argentina/Salta')::date $$;

create or replace function public.rave_siguiente(p_comercio uuid, p_clave text) returns bigint language sql as $$
  insert into public.compras_contadores (tenant_id, clave, valor) values (p_comercio, p_clave, 1)
  on conflict (tenant_id, clave) do update set valor = public.compras_contadores.valor + 1
  returning valor $$;

-- renglón de auditoría del servidor (misma forma que usa el resto del sistema)
create or replace function public.rave_auditar(p_comercio uuid, p_accion text, p_detalle text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id text := 'srv-' || gen_random_uuid()::text;
begin
  insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
  values (p_comercio, 'audit', v_id,
          jsonb_build_object('id', v_id, 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint,
                             'user', coalesce(public.rave_nombre_usuario(p_comercio), '?'), 'action', p_accion,
                             'detail', left(p_detalle, 400), 'dev', 'servidor'),
          false, 'servidor', auth.uid(), clock_timestamp())
  on conflict do nothing;
end $$;

-- Egreso en la caja ABIERTA (colección movs), con rubro obligatorio y válido para egresos. Devuelve el id del movimiento.
create or replace function public.rave_mov_caja(p_comercio uuid, p_turno text, p_rubro text, p_concepto text, p_centavos bigint, p_ref text)
returns text language plpgsql security definer set search_path = public as $$
declare v_t public.registros; v_r public.registros; v_id text := 'srv-' || gen_random_uuid()::text;
begin
  if p_turno is null then raise exception 'indicá la caja abierta de donde sale el efectivo'; end if;
  select * into v_t from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and id = p_turno and not borrado;
  if not found then raise exception 'la caja indicada no existe en el servidor: esperá a que sincronice'; end if;
  if coalesce((v_t.datos ->> 'closedAt')::numeric, 0) > 0 then raise exception 'la caja indicada ya está cerrada'; end if;
  if p_rubro is null then raise exception 'el rubro es obligatorio para todo movimiento de dinero'; end if;
  select * into v_r from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = p_rubro and not borrado;
  if not found then raise exception 'el rubro elegido no existe en este comercio'; end if;
  if (v_r.datos ->> 'kind') = 'cobr' then raise exception 'ese rubro sólo admite ingresos'; end if;
  if p_centavos is null or p_centavos <= 0 then raise exception 'el importe debe ser mayor a cero'; end if;
  insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
  values (p_comercio, 'movs', v_id,
          jsonb_build_object('id', v_id, 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint, 'sessId', p_turno,
                             'type', 'egreso', 'rubro', p_rubro, 'rubroName', coalesce(v_r.datos ->> 'name', p_rubro),
                             'concept', left(p_concepto, 120), 'amount', p_centavos,
                             'user', coalesce(public.rave_nombre_usuario(p_comercio), '?'), 'srv', true, 'ref', left(coalesce(p_ref, ''), 80)),
          false, 'servidor', auth.uid(), clock_timestamp());
  return v_id;
end $$;

revoke all on function public.rave_compras_acceso(uuid), public.rave_num(jsonb, text), public.rave_txt(jsonb, text), public.rave_uuid(text),
  public.rave_nombre_usuario(uuid), public.rave_hoy(), public.rave_siguiente(uuid, text), public.rave_auditar(uuid, text, text),
  public.rave_mov_caja(uuid, text, text, text, bigint, text), public.rave_solo_agregar() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Proveedores
-- ---------------------------------------------------------------------
create or replace function public.proveedor_guardar(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_row public.proveedores; v_cuit text; v_iva text; v_email text; v_rs text; v_activo boolean;
begin
  perform public.rave_compras_acceso(p_comercio);
  if jsonb_typeof(p) is distinct from 'object' or length(p::text) > 20000 then raise exception 'datos inválidos'; end if;
  v_rs := public.rave_txt(p, 'razon_social');
  v_cuit := regexp_replace(coalesce(public.rave_txt(p, 'cuit'), ''), '\D', '', 'g');
  v_iva := public.rave_txt(p, 'condicion_iva');
  v_email := lower(public.rave_txt(p, 'email'));
  if v_rs is null or length(v_rs) < 2 or length(v_rs) > 120 then raise exception 'la razón social es obligatoria (2 a 120 caracteres)'; end if;
  if not public.rave_cuit_ok(v_cuit) then raise exception 'el CUIT no es válido (11 dígitos con dígito verificador correcto)'; end if;
  if v_iva is null or v_iva not in ('Responsable Inscripto', 'Monotributista', 'Exento') then
    raise exception 'condición de IVA inválida (Responsable Inscripto, Monotributista o Exento)'; end if;
  if v_email is not null and (length(v_email) > 120 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'el correo no es válido'; end if;
  v_activo := coalesce((p ->> 'activo')::boolean, true);
  if p ? 'id' and p ->> 'id' is not null then
    v_id := public.rave_uuid(p ->> 'id');
    if v_id is null then raise exception 'id de proveedor inválido'; end if;
    select * into v_row from public.proveedores where id = v_id and tenant_id = p_comercio and deleted_at is null for update;
    if not found then raise exception 'el proveedor no existe en este comercio'; end if;
    -- el saldo NO se edita: sólo lo mueve el libro de cuenta corriente
    update public.proveedores set razon_social = v_rs, cuit = v_cuit, condicion_iva = v_iva, email = v_email,
           telefono = left(public.rave_txt(p, 'telefono'), 40), direccion = left(public.rave_txt(p, 'direccion'), 200),
           activo = v_activo, updated_at = now() where id = v_id returning * into v_row;
    perform public.rave_auditar(p_comercio, 'PROVEEDOR_EDITAR', v_row.razon_social || ' · CUIT ' || v_row.cuit || (case when v_activo then '' else ' · archivado' end));
  else
    insert into public.proveedores (tenant_id, razon_social, cuit, condicion_iva, email, telefono, direccion, activo, created_by)
    values (p_comercio, v_rs, v_cuit, v_iva, v_email, left(public.rave_txt(p, 'telefono'), 40), left(public.rave_txt(p, 'direccion'), 200), v_activo, auth.uid())
    returning * into v_row;
    perform public.rave_auditar(p_comercio, 'PROVEEDOR_ALTA', v_row.razon_social || ' · CUIT ' || v_row.cuit);
  end if;
  return to_jsonb(v_row);
exception when unique_violation then
  raise exception 'ya existe un proveedor con ese CUIT en este comercio';
end $$;

create or replace function public.proveedores_listar(
  p_comercio uuid, p_q text default null, p_estado text default null, p_orden text default 'razon_social',
  p_dir text default 'asc', p_limite int default 50, p_desde int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), ''); v_ord text := coalesce(p_orden, 'razon_social'); v_dir text := lower(coalesce(p_dir, 'asc'));
  v_lim int := least(greatest(coalesce(p_limite, 50), 1), 200); v_off int := greatest(coalesce(p_desde, 0), 0);
  v_items jsonb; v_total int; v_deuda numeric; v_pend int;
begin
  perform public.rave_compras_acceso(p_comercio);
  if v_ord not in ('razon_social', 'cuit', 'saldo', 'ordenes_pendientes', 'ultimo_movimiento') then raise exception 'orden inválido'; end if;
  if v_dir not in ('asc', 'desc') then raise exception 'dirección de orden inválida'; end if;
  if p_estado is not null and p_estado not in ('con_deuda', 'al_dia', 'a_favor') then raise exception 'estado de cuenta inválido (con_deuda, al_dia, a_favor)'; end if;
  if v_q is not null then v_q := '%' || replace(replace(replace(lower(v_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;

  with base as (
    select p.*, (select count(*) from public.ordenes_compra o where o.tenant_id = p.tenant_id and o.proveedor_id = p.id and o.estado = 'Solicitada') as ordenes_pendientes,
           (select max(c.fecha) from public.cuenta_corriente_proveedores c where c.tenant_id = p.tenant_id and c.proveedor_id = p.id) as ultimo_movimiento
      from public.proveedores p
     where p.tenant_id = p_comercio and p.deleted_at is null
       and (v_q is null or lower(p.razon_social) like v_q escape '\' or p.cuit like v_q escape '\')
       and (p_estado is null or (p_estado = 'con_deuda' and p.saldo_cuenta_corriente > 0) or (p_estado = 'al_dia' and p.saldo_cuenta_corriente = 0)
            or (p_estado = 'a_favor' and p.saldo_cuenta_corriente < 0))),
  num as (
    select base.*, row_number() over (
       order by case when v_ord = 'razon_social' and v_dir = 'asc'  then lower(razon_social) end asc,
                case when v_ord = 'razon_social' and v_dir = 'desc' then lower(razon_social) end desc,
                case when v_ord = 'cuit' and v_dir = 'asc'  then cuit end asc,
                case when v_ord = 'cuit' and v_dir = 'desc' then cuit end desc,
                case when v_ord = 'saldo' and v_dir = 'asc'  then saldo_cuenta_corriente end asc,
                case when v_ord = 'saldo' and v_dir = 'desc' then saldo_cuenta_corriente end desc,
                case when v_ord = 'ordenes_pendientes' and v_dir = 'asc'  then ordenes_pendientes end asc,
                case when v_ord = 'ordenes_pendientes' and v_dir = 'desc' then ordenes_pendientes end desc,
                case when v_ord = 'ultimo_movimiento' and v_dir = 'asc'  then ultimo_movimiento end asc nulls last,
                case when v_ord = 'ultimo_movimiento' and v_dir = 'desc' then ultimo_movimiento end desc nulls last,
                lower(razon_social), id) as rn
      from base)
  select coalesce(jsonb_agg((to_jsonb(num) - 'rn') || jsonb_build_object('estado_cuenta',
           case when num.saldo_cuenta_corriente > 0 then 'Con deuda' when num.saldo_cuenta_corriente < 0 then 'Saldo a favor' else 'Al día' end) order by num.rn)
           filter (where num.rn > v_off and num.rn <= v_off + v_lim), '[]'::jsonb),
         count(*)
    into v_items, v_total from num;
  select coalesce(sum(saldo_cuenta_corriente) filter (where saldo_cuenta_corriente > 0), 0) into v_deuda
    from public.proveedores where tenant_id = p_comercio and deleted_at is null;
  select count(*) into v_pend from public.ordenes_compra where tenant_id = p_comercio and estado = 'Solicitada';
  return jsonb_build_object('total', v_total, 'limite', v_lim, 'desde', v_off, 'items', v_items,
                            'kpis', jsonb_build_object('deuda_total_proveedores', v_deuda, 'ordenes_pendientes_recepcion', v_pend));
end $$;

-- ---------------------------------------------------------------------
-- 5. Órdenes de compra (crear / editar borrador / cambiar estado)
-- ---------------------------------------------------------------------
-- Valida y normaliza los renglones: devuelve [{producto_id, nombre, cantidad, precio}] y el total. Todo se verifica contra el
-- catálogo del MISMO comercio. El navegador nunca manda totales.
create or replace function public.rave_items_compra(p_comercio uuid, p_items jsonb, out o_items jsonb, out o_total numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_it jsonb; v_pid text; v_cant numeric; v_pre numeric; v_prod public.registros; v_seen text[] := '{}';
begin
  o_items := '[]'::jsonb; o_total := 0;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'la lista de productos debe tener entre 1 y 200 renglones'; end if;
  for v_it in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_it) is distinct from 'object' then raise exception 'renglón inválido'; end if;
    v_pid := public.rave_txt(v_it, 'producto_id');
    v_cant := public.rave_num(v_it, 'cantidad');
    v_pre := coalesce(public.rave_num(v_it, 'precio_costo'), public.rave_num(v_it, 'precio_costo_pactado'));
    if v_pid is null or length(v_pid) > 80 then raise exception 'falta el producto de un renglón'; end if;
    if v_pid = any(v_seen) then raise exception 'producto repetido en la lista (%): sumá las cantidades en un solo renglón', v_pid; end if;
    v_seen := v_seen || v_pid;
    if v_cant is null or v_cant <= 0 or v_cant > 1000000 or v_cant <> round(v_cant, 3) then
      raise exception 'cantidad inválida en %: mayor a cero, hasta 3 decimales', v_pid; end if;
    if v_pre is null or v_pre < 0 or v_pre > 1000000000 or v_pre <> round(v_pre, 2) then
      raise exception 'costo inválido en %: cero o más, hasta 2 decimales', v_pid; end if;
    select * into v_prod from public.registros where comercio_id = p_comercio and coleccion = 'prod' and id = v_pid and not borrado;
    if not found then raise exception 'el producto % no existe en este comercio', v_pid; end if;
    if coalesce((v_prod.datos ->> 'archived')::boolean, false) then raise exception 'el producto % está archivado', coalesce(v_prod.datos ->> 'name', v_pid); end if;
    o_items := o_items || jsonb_build_array(jsonb_build_object('producto_id', v_pid, 'nombre', coalesce(v_prod.datos ->> 'name', v_pid), 'cantidad', v_cant, 'precio', v_pre));
    o_total := o_total + round(v_cant * v_pre, 2);
  end loop;
end $$;
revoke all on function public.rave_items_compra(uuid, jsonb) from public, anon, authenticated;

create or replace function public.orden_compra_json(p_comercio uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(o) - 'tenant_id' - 'idempotency_key' || jsonb_build_object('proveedor', (select razon_social from public.proveedores where id = o.proveedor_id),
         'items', coalesce((select jsonb_agg(to_jsonb(d) - 'tenant_id' - 'orden_id' order by d.producto_nombre, d.id) from public.ordenes_compra_detalles d where d.orden_id = o.id and d.tenant_id = o.tenant_id), '[]'::jsonb))
    from public.ordenes_compra o where o.id = p_id and o.tenant_id = p_comercio $$;
revoke all on function public.orden_compra_json(uuid, uuid) from public, anon, authenticated;

create or replace function public.orden_compra_guardar(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prov public.proveedores; v_oc public.ordenes_compra; v_calc record; v_it jsonb; v_estado text; v_key text; v_id uuid;
begin
  perform public.rave_compras_acceso(p_comercio);
  if jsonb_typeof(p) is distinct from 'object' or length(p::text) > 200000 then raise exception 'datos inválidos'; end if;
  v_estado := coalesce(public.rave_txt(p, 'estado'), 'Borrador');
  if v_estado not in ('Borrador', 'Solicitada') then raise exception 'una orden nueva nace como Borrador o Solicitada'; end if;
  select * into v_prov from public.proveedores where id = public.rave_uuid(p ->> 'proveedor_id') and tenant_id = p_comercio and deleted_at is null for update;
  if not found then raise exception 'el proveedor no existe en este comercio'; end if;
  if not v_prov.activo then raise exception 'el proveedor está archivado'; end if;
  v_key := public.rave_txt(p, 'idempotency_key');
  if p ? 'id' and p ->> 'id' is not null then
    -- editar un Borrador
    v_id := public.rave_uuid(p ->> 'id');
    select * into v_oc from public.ordenes_compra where id = v_id and tenant_id = p_comercio for update;
    if not found then raise exception 'la orden no existe en este comercio'; end if;
    if v_oc.estado <> 'Borrador' then raise exception 'sólo se edita una orden en Borrador (esta está %)', v_oc.estado; end if;
    if v_oc.proveedor_id <> v_prov.id then raise exception 'no se cambia el proveedor de una orden: creá una nueva'; end if;
  else
    if v_key is not null then
      select * into v_oc from public.ordenes_compra where tenant_id = p_comercio and idempotency_key = v_key;
      if found then return public.orden_compra_json(p_comercio, v_oc.id) || jsonb_build_object('repetido', true); end if;
    end if;
  end if;
  select * into v_calc from public.rave_items_compra(p_comercio, p -> 'items');
  if v_calc.o_total <= 0 and v_estado = 'Solicitada' then raise exception 'una orden solicitada necesita costos pactados (total mayor a cero)'; end if;
  if v_oc.id is null then
    insert into public.ordenes_compra (tenant_id, numero, proveedor_id, estado, total, observaciones, idempotency_key, created_by)
    values (p_comercio, public.rave_siguiente(p_comercio, 'orden_compra'), v_prov.id, v_estado, v_calc.o_total, left(public.rave_txt(p, 'observaciones'), 500), v_key, auth.uid())
    returning * into v_oc;
  else
    update public.ordenes_compra set total = v_calc.o_total, estado = v_estado, observaciones = left(public.rave_txt(p, 'observaciones'), 500), updated_at = now()
     where id = v_oc.id returning * into v_oc;
    delete from public.ordenes_compra_detalles where orden_id = v_oc.id and tenant_id = p_comercio;
  end if;
  for v_it in select * from jsonb_array_elements(v_calc.o_items) loop
    insert into public.ordenes_compra_detalles (tenant_id, orden_id, producto_id, producto_nombre, cantidad, precio_costo_pactado)
    values (p_comercio, v_oc.id, v_it ->> 'producto_id', v_it ->> 'nombre', (v_it ->> 'cantidad')::numeric, (v_it ->> 'precio')::numeric);
  end loop;
  perform public.rave_auditar(p_comercio, 'OC_' || upper(v_oc.estado), 'OC-' || v_oc.numero || ' · ' || v_prov.razon_social || ' · total ' || v_oc.total);
  return public.orden_compra_json(p_comercio, v_oc.id) || jsonb_build_object('repetido', false);
end $$;

create or replace function public.orden_compra_estado(p_comercio uuid, p_orden uuid, p_estado text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_oc public.ordenes_compra;
begin
  perform public.rave_compras_acceso(p_comercio);
  if p_estado not in ('Solicitada', 'Cancelada') then raise exception 'estado inválido: sólo se pasa a Solicitada o Cancelada (Recibida se logra recibiendo la mercadería)'; end if;
  select * into v_oc from public.ordenes_compra where id = p_orden and tenant_id = p_comercio for update;
  if not found then raise exception 'la orden no existe en este comercio'; end if;
  if v_oc.estado = p_estado then return public.orden_compra_json(p_comercio, v_oc.id); end if;
  if not ((v_oc.estado = 'Borrador' and p_estado in ('Solicitada', 'Cancelada')) or (v_oc.estado = 'Solicitada' and p_estado = 'Cancelada')) then
    raise exception 'no se puede pasar una orden de % a %', v_oc.estado, p_estado; end if;
  if p_estado = 'Solicitada' and v_oc.total <= 0 then raise exception 'una orden solicitada necesita costos pactados (total mayor a cero)'; end if;
  update public.ordenes_compra set estado = p_estado, updated_at = now() where id = v_oc.id;
  perform public.rave_auditar(p_comercio, 'OC_' || upper(p_estado), 'OC-' || v_oc.numero);
  return public.orden_compra_json(p_comercio, v_oc.id);
end $$;

create or replace function public.ordenes_listar(p_comercio uuid, p_estado text default null, p_proveedor uuid default null, p_limite int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.rave_compras_acceso(p_comercio);
  if p_estado is not null and p_estado not in ('Borrador', 'Solicitada', 'Recibida', 'Cancelada') then raise exception 'estado inválido'; end if;
  return coalesce((select jsonb_agg(public.orden_compra_json(p_comercio, x.id) order by x.numero desc)
                     from (select id, numero from public.ordenes_compra where tenant_id = p_comercio and (p_estado is null or estado = p_estado)
                              and (p_proveedor is null or proveedor_id = p_proveedor) order by numero desc limit least(greatest(coalesce(p_limite, 100), 1), 500)) x), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- 6. INGRESO DE MERCADERÍA (atómico: o se aplica todo, o no queda nada)
--    1) la orden pasa a Recibida · 2) se suma el stock · 3) se actualiza el costo del artículo
--    4) a crédito: sube la deuda con el proveedor · al contado: Pago + egreso de caja (si es efectivo)
-- ---------------------------------------------------------------------
create or replace function public.procesar_recepcion(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_key text; v_prov public.proveedores; v_oc public.ordenes_compra; v_exist public.ingresos_mercaderia;
  v_tipo text; v_nro text; v_cond text; v_medio text; v_rubro text; v_turno text; v_fecha date; v_calc record;
  v_decl numeric; v_ing public.ingresos_mercaderia; v_it jsonb; v_pid text; v_cant numeric; v_pre numeric;
  v_prod public.registros; v_stock_ant numeric; v_stock_new numeric; v_cost_ant bigint; v_cost_new bigint; v_price bigint;
  v_saldo numeric(14,2); v_mov text; v_sal jsonb := '[]'::jsonb; v_dif jsonb := '[]'::jsonb; v_res jsonb; v_n int := 0; v_ocd record;
  v_ocid uuid; v_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  perform public.rave_compras_acceso(p_comercio);
  if jsonb_typeof(p) is distinct from 'object' or length(p::text) > 400000 then raise exception 'datos inválidos o muy grandes'; end if;
  v_key := public.rave_txt(p, 'idempotency_key');
  if v_key is null or length(v_key) not between 8 and 80 then raise exception 'falta idempotency_key (8 a 80 caracteres) para no duplicar la carga'; end if;

  -- el proveedor se bloquea primero: dos envíos simultáneos se ordenan acá
  select * into v_prov from public.proveedores where id = public.rave_uuid(p ->> 'proveedor_id') and tenant_id = p_comercio and deleted_at is null for update;
  if not found then raise exception 'el proveedor no existe en este comercio'; end if;
  select * into v_exist from public.ingresos_mercaderia where tenant_id = p_comercio and idempotency_key = v_key;
  if found then return v_exist.resultado || jsonb_build_object('repetido', true); end if;
  if not v_prov.activo then raise exception 'el proveedor está archivado'; end if;

  v_tipo := public.rave_txt(p, 'tipo_comprobante');
  v_nro := public.rave_txt(p, 'nro_comprobante');
  if v_tipo is null or v_tipo not in ('Factura', 'Remito') then raise exception 'tipo de comprobante inválido (Factura o Remito)'; end if;
  if v_nro is null or length(v_nro) > 40 or v_nro !~ '^[A-Za-z0-9./ -]+$' then raise exception 'el número de comprobante es obligatorio (letras, números, guión, barra y punto)'; end if;
  if exists (select 1 from public.ingresos_mercaderia where tenant_id = p_comercio and proveedor_id = v_prov.id and tipo_comprobante = v_tipo and lower(nro_comprobante_o_remito) = lower(v_nro)) then
    raise exception 'ese % ya fue cargado para este proveedor (duplicado)', lower(v_tipo); end if;
  v_cond := coalesce(public.rave_txt(p, 'condicion_pago'), 'credito');
  if v_cond not in ('credito', 'contado') then raise exception 'condición de pago inválida (credito o contado)'; end if;
  v_rubro := public.rave_txt(p, 'rubro_id'); v_turno := public.rave_txt(p, 'turno_id'); v_medio := public.rave_txt(p, 'medio_pago');
  if v_cond = 'contado' then
    if v_medio is null or v_medio not in ('efectivo', 'transferencia', 'cheque', 'tarjeta') then raise exception 'al contado hay que indicar el medio de pago (efectivo, transferencia, cheque o tarjeta)'; end if;
    if v_rubro is null then raise exception 'el rubro es obligatorio para todo movimiento de dinero'; end if;
    if not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = v_rubro and not borrado and coalesce(datos ->> 'kind', '') <> 'cobr') then
      raise exception 'el rubro elegido no existe en este comercio o no admite egresos'; end if;
    if v_medio = 'efectivo' and v_turno is null then raise exception 'pago en efectivo: indicá la caja abierta de donde sale la plata'; end if;
  else
    v_medio := null; v_turno := null;
    if v_rubro is not null and not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = v_rubro and not borrado) then
      raise exception 'el rubro elegido no existe en este comercio'; end if;
  end if;
  v_fecha := coalesce(case when public.rave_txt(p, 'fecha_recepcion') ~ '^\d{4}-\d{2}-\d{2}$' then (p ->> 'fecha_recepcion')::date end, public.rave_hoy());
  if v_fecha > public.rave_hoy() + 1 or v_fecha < public.rave_hoy() - 400 then raise exception 'la fecha de recepción no es razonable'; end if;

  -- orden de compra (opcional)
  v_ocid := public.rave_uuid(p ->> 'orden_compra_id');
  if p ->> 'orden_compra_id' is not null and v_ocid is null then raise exception 'id de orden inválido'; end if;
  if v_ocid is not null then
    select * into v_oc from public.ordenes_compra where id = v_ocid and tenant_id = p_comercio for update;
    if not found then raise exception 'la orden de compra no existe en este comercio'; end if;
    if v_oc.proveedor_id <> v_prov.id then raise exception 'la orden pertenece a otro proveedor'; end if;
    if v_oc.estado <> 'Solicitada' then raise exception 'la orden está %: sólo se recibe una orden Solicitada', v_oc.estado; end if;
  end if;

  select * into v_calc from public.rave_items_compra(p_comercio, p -> 'items');
  if v_oc.id is not null then
    for v_it in select * from jsonb_array_elements(v_calc.o_items) loop
      if not exists (select 1 from public.ordenes_compra_detalles where orden_id = v_oc.id and tenant_id = p_comercio and producto_id = v_it ->> 'producto_id') then
        raise exception 'el producto % no está en la orden de compra', v_it ->> 'nombre'; end if;
    end loop;
  end if;
  if v_calc.o_total <= 0 then raise exception 'el total del comprobante debe ser mayor a cero'; end if;
  v_decl := public.rave_num(p, 'total_declarado');
  if v_decl is not null and abs(v_decl - v_calc.o_total) > 0.009 then
    raise exception 'el total declarado (%) no coincide con la suma de los renglones (%)', v_decl, v_calc.o_total; end if;

  -- ---- se aplica todo ----
  insert into public.ingresos_mercaderia (tenant_id, proveedor_id, orden_compra_id, nro_comprobante_o_remito, tipo_comprobante, fecha_recepcion, condicion_pago,
                                          medio_pago, rubro_id, turno_id, total, observaciones, idempotency_key, created_by)
  values (p_comercio, v_prov.id, v_oc.id, v_nro, v_tipo, v_fecha, v_cond, v_medio, v_rubro, v_turno, v_calc.o_total, left(public.rave_txt(p, 'observaciones'), 500), v_key, auth.uid())
  returning * into v_ing;

  -- stock + costo (productos en orden fijo: sin bloqueos cruzados entre cajas)
  for v_it in select e from jsonb_array_elements(v_calc.o_items) e order by e ->> 'producto_id' loop
    v_pid := v_it ->> 'producto_id'; v_cant := (v_it ->> 'cantidad')::numeric; v_pre := (v_it ->> 'precio')::numeric; v_n := v_n + 1;
    select * into v_prod from public.registros where comercio_id = p_comercio and coleccion = 'prod' and id = v_pid and not borrado for update;
    v_stock_ant := coalesce((v_prod.datos ->> 'stock')::numeric, 0);
    v_stock_new := round(v_stock_ant + v_cant, 3);
    v_cost_ant := coalesce((v_prod.datos ->> 'cost')::numeric, 0)::bigint;
    v_price := coalesce((v_prod.datos ->> 'price')::numeric, 0)::bigint;
    v_cost_new := case when v_pre > 0 then round(v_pre * 100)::bigint else v_cost_ant end;   -- costo cero = bonificación: no pisa el costo vigente
    update public.registros
       set datos = datos || jsonb_build_object('stock', v_stock_new, 'cost', v_cost_new, 'costAt', v_ms),
           dispositivo = 'servidor', usuario_id = auth.uid(), actualizado = clock_timestamp()
     where comercio_id = p_comercio and coleccion = 'prod' and id = v_pid;
    insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
    values (p_comercio, 'smov', left('srv-rcp-' || v_ing.id::text || '-' || v_n, 80),
            jsonb_build_object('pid', v_pid, 'd', v_cant, 'dev', 'servidor', 'ref', 'ingreso:' || v_ing.id::text), false, 'servidor', auth.uid(), clock_timestamp());
    insert into public.ingresos_mercaderia_detalles (tenant_id, ingreso_id, producto_id, producto_nombre, cantidad, precio_costo, stock_anterior, stock_nuevo, costo_anterior, costo_nuevo)
    values (p_comercio, v_ing.id, v_pid, v_it ->> 'nombre', v_cant, v_pre, v_stock_ant, v_stock_new, v_cost_ant / 100.0, v_cost_new / 100.0);
    v_sal := v_sal || jsonb_build_array(jsonb_build_object('producto_id', v_pid, 'nombre', v_it ->> 'nombre', 'cantidad', v_cant, 'precio_costo', v_pre,
              'stock_anterior', v_stock_ant, 'stock_nuevo', v_stock_new, 'costo_anterior', v_cost_ant / 100.0, 'costo_nuevo', v_cost_new / 100.0,
              'margen_pct', case when v_price > 0 and v_cost_new > 0 then round((v_price - v_cost_new)::numeric / v_price * 100, 1) end));
  end loop;

  -- cuenta corriente: el comprobante genera deuda; si es al contado se cancela con un Pago (y, en efectivo, sale de la caja)
  v_saldo := round(v_prov.saldo_cuenta_corriente + v_calc.o_total, 2);
  insert into public.cuenta_corriente_proveedores (tenant_id, proveedor_id, tipo_movimiento, monto, saldo_acumulado, ingreso_id, referencia, rubro_id, created_by)
  values (p_comercio, v_prov.id, v_tipo, v_calc.o_total, v_saldo, v_ing.id, v_nro, v_rubro, auth.uid());
  if v_cond = 'contado' then
    if v_medio = 'efectivo' then
      v_mov := public.rave_mov_caja(p_comercio, v_turno, v_rubro, 'Pago contado a ' || v_prov.razon_social || ' · ' || v_tipo || ' ' || v_nro, round(v_calc.o_total * 100)::bigint, 'ingreso:' || v_ing.id::text);
    end if;
    v_saldo := round(v_saldo - v_calc.o_total, 2);
    insert into public.cuenta_corriente_proveedores (tenant_id, proveedor_id, tipo_movimiento, monto, saldo_acumulado, ingreso_id, referencia, medio_pago, rubro_id, movimiento_caja_id, created_by)
    values (p_comercio, v_prov.id, 'Pago', v_calc.o_total, v_saldo, v_ing.id, v_tipo || ' ' || v_nro, v_medio, v_rubro, v_mov, auth.uid());
  end if;
  update public.proveedores set saldo_cuenta_corriente = v_saldo, updated_at = now() where id = v_prov.id;

  -- orden de compra: Recibida + diferencias contra lo pactado
  if v_oc.id is not null then
    update public.ordenes_compra set estado = 'Recibida', recibida_at = now(), updated_at = now() where id = v_oc.id;
    for v_ocd in select d.producto_id, d.producto_nombre, d.cantidad, d.precio_costo_pactado, i.cantidad as recibida, i.precio_costo as precio_real
                   from public.ordenes_compra_detalles d
                   left join public.ingresos_mercaderia_detalles i on i.ingreso_id = v_ing.id and i.producto_id = d.producto_id
                  where d.orden_id = v_oc.id and d.tenant_id = p_comercio loop
      if v_ocd.recibida is null or v_ocd.recibida <> v_ocd.cantidad or v_ocd.precio_real <> v_ocd.precio_costo_pactado then
        v_dif := v_dif || jsonb_build_array(jsonb_build_object('producto_id', v_ocd.producto_id, 'nombre', v_ocd.producto_nombre,
                  'cantidad_pedida', v_ocd.cantidad, 'cantidad_recibida', coalesce(v_ocd.recibida, 0),
                  'costo_pactado', v_ocd.precio_costo_pactado, 'costo_facturado', v_ocd.precio_real));
      end if;
    end loop;
  end if;

  update public.ingresos_mercaderia set movimiento_caja_id = v_mov where id = v_ing.id;
  perform public.rave_auditar(p_comercio, 'COMPRA_RECEPCION', v_prov.razon_social || ' · ' || v_tipo || ' ' || v_nro || ' · total ' || v_calc.o_total || ' · ' || v_cond
                              || case when v_oc.id is not null then ' · OC-' || v_oc.numero else '' end);
  v_res := jsonb_build_object('ok', true, 'repetido', false, 'ingreso_id', v_ing.id, 'orden_compra_id', v_oc.id,
             'orden_estado', case when v_oc.id is not null then 'Recibida' end, 'proveedor_id', v_prov.id, 'tipo_comprobante', v_tipo, 'nro_comprobante', v_nro,
             'total', v_calc.o_total, 'condicion_pago', v_cond, 'medio_pago', v_medio, 'saldo_proveedor', v_saldo, 'movimiento_caja_id', v_mov,
             'items', v_sal, 'diferencias', v_dif);
  update public.ingresos_mercaderia set resultado = v_res where id = v_ing.id;
  return v_res;
exception when unique_violation then
  -- carrera entre dos envíos iguales que pasaron el control: el segundo ve el resultado del primero
  select * into v_exist from public.ingresos_mercaderia where tenant_id = p_comercio and idempotency_key = v_key;
  if found and v_exist.resultado is not null then return v_exist.resultado || jsonb_build_object('repetido', true); end if;
  raise exception 'ese comprobante ya fue cargado para este proveedor (duplicado)';
end $$;

-- ---------------------------------------------------------------------
-- 7. Pagos y notas de crédito del proveedor
-- ---------------------------------------------------------------------
create or replace function public.proveedor_pago_registrar(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prov public.proveedores; v_key text; v_monto numeric; v_medio text; v_rubro text; v_turno text; v_ref text; v_saldo numeric(14,2); v_mov text; v_ex public.cuenta_corriente_proveedores; v_id uuid;
begin
  perform public.rave_compras_acceso(p_comercio);
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'datos inválidos'; end if;
  v_key := public.rave_txt(p, 'idempotency_key');
  if v_key is null or length(v_key) not between 8 and 80 then raise exception 'falta idempotency_key (8 a 80 caracteres)'; end if;
  select * into v_prov from public.proveedores where id = public.rave_uuid(p ->> 'proveedor_id') and tenant_id = p_comercio and deleted_at is null for update;
  if not found then raise exception 'el proveedor no existe en este comercio'; end if;
  select * into v_ex from public.cuenta_corriente_proveedores where tenant_id = p_comercio and idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'repetido', true, 'movimiento_id', v_ex.id, 'monto', v_ex.monto, 'saldo_proveedor', v_prov.saldo_cuenta_corriente);
  end if;
  v_monto := public.rave_num(p, 'monto'); v_medio := public.rave_txt(p, 'medio_pago'); v_rubro := public.rave_txt(p, 'rubro_id'); v_turno := public.rave_txt(p, 'turno_id');
  v_ref := left(public.rave_txt(p, 'referencia'), 80);
  if v_monto is null or v_monto <= 0 or v_monto > 100000000000 or v_monto <> round(v_monto, 2) then raise exception 'el monto debe ser mayor a cero, con hasta 2 decimales'; end if;
  if v_monto > v_prov.saldo_cuenta_corriente then raise exception 'el pago (%) supera la deuda con el proveedor (%)', v_monto, v_prov.saldo_cuenta_corriente; end if;
  if v_medio is null or v_medio not in ('efectivo', 'transferencia', 'cheque', 'tarjeta') then raise exception 'indicá el medio de pago (efectivo, transferencia, cheque o tarjeta)'; end if;
  if v_rubro is null then raise exception 'el rubro es obligatorio para todo movimiento de dinero'; end if;
  if not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = v_rubro and not borrado and coalesce(datos ->> 'kind', '') <> 'cobr') then
    raise exception 'el rubro elegido no existe en este comercio o no admite egresos'; end if;
  if v_medio = 'efectivo' then
    v_mov := public.rave_mov_caja(p_comercio, v_turno, v_rubro, 'Pago a proveedor ' || v_prov.razon_social || coalesce(' · ' || v_ref, ''), round(v_monto * 100)::bigint, 'pago');
  end if;
  v_saldo := round(v_prov.saldo_cuenta_corriente - v_monto, 2);
  insert into public.cuenta_corriente_proveedores (tenant_id, proveedor_id, tipo_movimiento, monto, saldo_acumulado, referencia, medio_pago, rubro_id, movimiento_caja_id, idempotency_key, created_by)
  values (p_comercio, v_prov.id, 'Pago', v_monto, v_saldo, v_ref, v_medio, v_rubro, v_mov, v_key, auth.uid()) returning id into v_id;
  update public.proveedores set saldo_cuenta_corriente = v_saldo, updated_at = now() where id = v_prov.id;
  perform public.rave_auditar(p_comercio, 'PROVEEDOR_PAGO', v_prov.razon_social || ' · ' || v_monto || ' · ' || v_medio);
  return jsonb_build_object('ok', true, 'repetido', false, 'movimiento_id', v_id, 'monto', v_monto, 'saldo_proveedor', v_saldo, 'movimiento_caja_id', v_mov);
exception when unique_violation then
  select * into v_ex from public.cuenta_corriente_proveedores where tenant_id = p_comercio and idempotency_key = v_key;
  if found then return jsonb_build_object('ok', true, 'repetido', true, 'movimiento_id', v_ex.id, 'monto', v_ex.monto); end if;
  raise;
end $$;

create or replace function public.proveedor_nota_credito(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_prov public.proveedores; v_key text; v_monto numeric; v_ref text; v_motivo text; v_saldo numeric(14,2); v_ex public.cuenta_corriente_proveedores; v_id uuid;
begin
  perform public.rave_compras_acceso(p_comercio);
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'datos inválidos'; end if;
  v_key := public.rave_txt(p, 'idempotency_key');
  if v_key is null or length(v_key) not between 8 and 80 then raise exception 'falta idempotency_key (8 a 80 caracteres)'; end if;
  select * into v_prov from public.proveedores where id = public.rave_uuid(p ->> 'proveedor_id') and tenant_id = p_comercio and deleted_at is null for update;
  if not found then raise exception 'el proveedor no existe en este comercio'; end if;
  select * into v_ex from public.cuenta_corriente_proveedores where tenant_id = p_comercio and idempotency_key = v_key;
  if found then return jsonb_build_object('ok', true, 'repetido', true, 'movimiento_id', v_ex.id, 'monto', v_ex.monto, 'saldo_proveedor', v_prov.saldo_cuenta_corriente); end if;
  v_monto := public.rave_num(p, 'monto'); v_ref := left(public.rave_txt(p, 'referencia'), 80); v_motivo := left(public.rave_txt(p, 'motivo'), 200);
  if v_monto is null or v_monto <= 0 or v_monto > 100000000000 or v_monto <> round(v_monto, 2) then raise exception 'el monto debe ser mayor a cero, con hasta 2 decimales'; end if;
  if v_ref is null then raise exception 'indicá el número de la nota de crédito'; end if;
  if v_motivo is null or length(v_motivo) < 3 then raise exception 'indicá el motivo de la nota de crédito'; end if;
  v_saldo := round(v_prov.saldo_cuenta_corriente - v_monto, 2);   -- puede quedar a favor
  insert into public.cuenta_corriente_proveedores (tenant_id, proveedor_id, tipo_movimiento, monto, saldo_acumulado, referencia, motivo, idempotency_key, created_by)
  values (p_comercio, v_prov.id, 'Nota de Crédito', v_monto, v_saldo, v_ref, v_motivo, v_key, auth.uid()) returning id into v_id;
  update public.proveedores set saldo_cuenta_corriente = v_saldo, updated_at = now() where id = v_prov.id;
  perform public.rave_auditar(p_comercio, 'PROVEEDOR_NC', v_prov.razon_social || ' · ' || v_monto || ' · ' || v_ref);
  return jsonb_build_object('ok', true, 'repetido', false, 'movimiento_id', v_id, 'monto', v_monto, 'saldo_proveedor', v_saldo);
exception when unique_violation then
  select * into v_ex from public.cuenta_corriente_proveedores where tenant_id = p_comercio and idempotency_key = v_key;
  if found then return jsonb_build_object('ok', true, 'repetido', true, 'movimiento_id', v_ex.id, 'monto', v_ex.monto); end if;
  raise;
end $$;

-- ---------------------------------------------------------------------
-- 8. Lecturas para la pantalla y la API
-- ---------------------------------------------------------------------
create or replace function public.cuenta_proveedor(p_comercio uuid, p_proveedor uuid, p_limite int default 200) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_prov public.proveedores;
begin
  perform public.rave_compras_acceso(p_comercio);
  select * into v_prov from public.proveedores where id = p_proveedor and tenant_id = p_comercio and deleted_at is null;
  if not found then raise exception 'el proveedor no existe en este comercio'; end if;
  return jsonb_build_object('proveedor', to_jsonb(v_prov),
    'movimientos', coalesce((select jsonb_agg(to_jsonb(x) - 'tenant_id' order by x.seq) from (select * from public.cuenta_corriente_proveedores
        where tenant_id = p_comercio and proveedor_id = p_proveedor order by seq desc limit least(greatest(coalesce(p_limite, 200), 1), 1000)) x), '[]'::jsonb));
end $$;

create or replace function public.compras_snapshot(p_comercio uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.rave_compras_acceso(p_comercio);
  return jsonb_build_object(
    'generado', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'proveedores', coalesce((select jsonb_agg(to_jsonb(p) - 'tenant_id' order by lower(p.razon_social)) from public.proveedores p where p.tenant_id = p_comercio and p.deleted_at is null), '[]'::jsonb),
    'ordenes', coalesce((select jsonb_agg(public.orden_compra_json(p_comercio, o.id) order by o.numero desc)
                           from (select id, numero from public.ordenes_compra where tenant_id = p_comercio order by numero desc limit 500) o), '[]'::jsonb),
    'ingresos', coalesce((select jsonb_agg(to_jsonb(i) - 'tenant_id' - 'resultado' - 'idempotency_key' ||
                              jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(d) - 'tenant_id' - 'ingreso_id') from public.ingresos_mercaderia_detalles d where d.ingreso_id = i.id and d.tenant_id = i.tenant_id), '[]'::jsonb))
                              order by i.created_at desc)
                           from (select * from public.ingresos_mercaderia where tenant_id = p_comercio order by created_at desc limit 300) i), '[]'::jsonb),
    'cuenta', coalesce((select jsonb_agg(to_jsonb(c) - 'tenant_id' - 'idempotency_key' order by c.seq)
                          from (select * from public.cuenta_corriente_proveedores where tenant_id = p_comercio order by seq desc limit 1500) c), '[]'::jsonb));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'proveedor_guardar(uuid, jsonb)', 'proveedores_listar(uuid, text, text, text, text, int, int)', 'orden_compra_json(uuid, uuid)',
    'orden_compra_guardar(uuid, jsonb)', 'orden_compra_estado(uuid, uuid, text)', 'ordenes_listar(uuid, text, uuid, int)',
    'procesar_recepcion(uuid, jsonb)', 'proveedor_pago_registrar(uuid, jsonb)', 'proveedor_nota_credito(uuid, jsonb)',
    'cuenta_proveedor(uuid, uuid, int)', 'compras_snapshot(uuid)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  revoke all on function public.orden_compra_json(uuid, uuid) from authenticated;
end $$;

-- ---------------------------------------------------------------------
-- 9. Un artículo comprado a un proveedor se archiva, no se borra (reemplaza rave_prod_refs de 06 con la misma lógica + compras)
-- ---------------------------------------------------------------------
create or replace function public.rave_prod_refs(p_comercio uuid, p_pid text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_n int; v_lista text[] := array[]::text[];
begin
  if p_pid is null or length(p_pid) < 1 then return null; end if;
  select count(*) into v_n from public.registros
   where comercio_id = p_comercio and coleccion = 'ventas' and not borrado
     and datos -> 'items' @> jsonb_build_array(jsonb_build_object('pid', p_pid));
  if v_n > 0 then v_lista := array_append(v_lista, (v_n || ' venta' || case when v_n = 1 then '' else 's' end)::text); end if;
  select count(*) into v_n from public.registros
   where comercio_id = p_comercio and coleccion = 'smov' and datos ->> 'pid' = p_pid;
  if v_n > 1 then v_lista := array_append(v_lista, 'movimientos de stock'::text); end if;
  if exists (select 1 from public.registros where comercio_id = p_comercio and not borrado
              and coleccion in ('pedidos', 'pya', 'cupones', 'planes', 'lotes')
              and position('"' || p_pid || '"' in datos::text) > 0) then
    v_lista := array_append(v_lista, 'pedidos, cupones o lotes'::text);
  end if;
  if exists (select 1 from public.ordenes_compra_detalles where tenant_id = p_comercio and producto_id = p_pid)
     or exists (select 1 from public.ingresos_mercaderia_detalles where tenant_id = p_comercio and producto_id = p_pid) then
    v_lista := array_append(v_lista, 'órdenes de compra o ingresos de mercadería'::text);
  end if;
  if array_length(v_lista, 1) is null then return null; end if;
  return array_to_string(v_lista, ', ');
end $$;
revoke all on function public.rave_prod_refs(uuid, text) from public, anon, authenticated;

-- ===== 09-club-tarjeta.sql =====
-- =====================================================================
-- SISTEMA VB · 09 · Tarjeta del Club desde el menú público (estado de la tarjeta)
--
-- Correr DESPUÉS de 01..08 (se puede repetir: sólo "create or replace").
-- ADITIVA: no cambia ni borra nada existente.
--
-- Para qué sirve: quien se suma al Club desde el menú recibe su tarjeta en el
-- acto (el celular genera su propia clave). Esta función sólo le dice a ese
-- celular, con el identificador secreto de su tarjeta (80 bits al azar):
--   · si el comercio ya lo registró como socio y con qué N.º de socio,
--   · cuántos sellos lleva.
-- No devuelve nombre, WhatsApp, DNI, cumpleaños ni nada de otras personas.
-- Quien no conoce el identificador de una tarjeta no obtiene nada: la
-- respuesta es la misma para "no existe" que para "todavía no importada".
-- =====================================================================

create or replace function public.club_estado(p_slug text, p_cid text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_c   uuid;
  v_id  text;
  v_num text;
  v_baja boolean;
  v_n   numeric;
begin
  select id into v_c from public.comercios where slug = lower(left(coalesce(p_slug, ''), 40));
  if v_c is null or coalesce(p_cid, '') !~ '^[A-Za-z0-9_-]{8,64}$' then
    return jsonb_build_object('ok', false);
  end if;

  -- el socio: su propio id o una tarjeta alias (mismo WhatsApp registrado dos veces)
  select r.id, r.datos->>'num', coalesce(r.datos->>'status', '') = 'baja'
    into v_id, v_num, v_baja
    from public.registros r
   where r.comercio_id = v_c and r.coleccion = 'clientes' and not r.borrado
     and (r.id = p_cid
          or (jsonb_typeof(r.datos->'cards') = 'array' and (r.datos->'cards') ? p_cid))
   order by (r.id = p_cid) desc
   limit 1;

  if v_id is null or v_baja then
    return jsonb_build_object('ok', true, 'socio', false);
  end if;

  select coalesce(sum((s.datos->>'n')::numeric), 0) into v_n
    from public.registros s
   where s.comercio_id = v_c and s.coleccion = 'sellos' and not s.borrado
     and s.datos->>'cust' = v_id;

  return jsonb_build_object('ok', true, 'socio', true, 'num', v_num, 'sellos', v_n);
end $$;
revoke all on function public.club_estado(text, text) from public;
grant execute on function public.club_estado(text, text) to anon, authenticated;

-- El menú publicado también lleva las reglas del club (sellos para el premio y el premio),
-- para que el celular del cliente muestre "3 / 8" con la meta correcta. Sólo estos dos datos.
-- (Misma función que la de 04, con 'loyalty' agregado.)
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
    'clubkey', p->'clubkey',
    'loyalty', jsonb_build_object(
      'goal',   case when (p->'loyalty'->>'goal') ~ '^[0-9]{1,2}$' then least(30, greatest(2, (p->'loyalty'->>'goal')::int)) else 10 end,
      'reward', left(coalesce(p->'loyalty'->>'reward', ''), 100))
  );
end $$;

-- ===== 10-mayorista-precios.sql =====
-- =====================================================================
-- SISTEMA RAVE · 10 · V26.4 · 4.22 · Mayorista / minorista: listas de precio, acuerdos y crédito con plazo
--
-- Correr DESPUÉS de 01..09 (se puede repetir: sólo "create or replace"). Aditiva: no borra ni cambia datos.
-- Qué agrega:
--   · Colecciones nuevas en sincronizar(): `acuer` (acuerdos especiales por cliente; el administrador y el
--     supervisor los escriben, se desactivan pero no se borran del historial de ventas), `cexc` (excepciones de
--     crédito: se escriben UNA vez, con cliente, monto entero, vigencia y motivo de 5+ letras) y `cexcu`
--     (consumo de una excepción: se escribe una vez; cualquier rol de caja puede registrarlo al vender).
--   · Ventas: `wch` (canal) sólo vale minorista|mayorista; una venta mayorista exige un cliente que exista.
--     Una venta a cuenta corriente que supera el límite (o de un cliente sin límite) NO se rechaza —el equipo trabaja
--     sin conexión y ya la hizo—: se marca `credit_review`/`crw` (sólo el servidor puede escribirlos) salvo que traiga
--     una excepción válida (`cov`) del mismo cliente por un monto suficiente.
--   · rave_deuda_cliente(): saldo adeudado calculado desde ventas y cobros (no se guarda aparte).
-- Límites declarados: el servidor NO recalcula precios de lista/escalón (sólo la estructura, el canal y el crédito);
--   el CUIT del cliente viaja cifrado y no se puede validar del lado del servidor; el vencimiento por plazo
--   (documentos vencidos) lo bloquea el equipo con sus datos, el servidor sólo revisa límite y excepción.
-- =====================================================================

create or replace function public.rave_deuda_cliente(p_comercio uuid, p_cliente text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select sum(case when r.datos ? 'pays'
                                   then coalesce((select sum((p ->> 'a')::numeric) from jsonb_array_elements(r.datos -> 'pays') p where p ->> 'm' = 'fiado'), 0)
                                   else coalesce((r.datos ->> 'total')::numeric, 0) end)
                     from public.registros r
                    where r.comercio_id = p_comercio and r.coleccion = 'ventas' and not r.borrado
                      and r.datos ->> 'cust' = p_cliente and coalesce((r.datos ->> 'fiado')::boolean, false)
                      and r.datos ->> 'status' = 'ok'), 0)
       - coalesce((select sum((r.datos ->> 'amount')::numeric) from public.registros r
                    where r.comercio_id = p_comercio and r.coleccion = 'fiado' and not r.borrado and r.datos ->> 'cust' = p_cliente), 0);
$$;
revoke all on function public.rave_deuda_cliente(uuid, text) from public, anon, authenticated;

create or replace function public.rave_puede_escribir(p_rol text, p_col text, p_id text)
returns boolean language sql immutable as $$
  select case p_rol
    when 'admin' then true
    when 'supervisor' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                     'clientes','fiado','fich','pedidos','arrep','pya','membs',
                                     'prod','rubros','cierres','cnotas','cupones','planes','lotes','tareas','ctransf',
                                     'acuer','cexc','cexcu')
                           or (p_col = 'cfg' and p_id = 'cfg')
    when 'mostrador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                    'clientes','fiado','fich','pedidos','arrep','pya','membs','cexcu')
    when 'operador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs','cexcu')
    else false end
$$;

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
                                        'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf','acuer','cexc','cexcu'];
  c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf','cexc','cexcu'];
  c_borrables  constant text[] := array['prod','rubros','clientes','emp','puestos','tareas','cupones','planes','tlogs','pedidos','acuer'];
  c_cfg_ids    constant text[] := array['tenant','cfg','menu','loyalty','roles','integ','legal','clubkey'];
  c_secretos   constant text[] := array['arcaCert','arcaKey','arcaPem','accessToken','refreshToken','clientSecret','apiKey','serviceKey'];
  v_k          text;
  v_ref        text;
  v_perfil     text;
  v_aid        text;
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
        elsif v_borrado and v_col = 'prod' and v_rol <> 'admin' then
          v_motivo := 'sólo el administrador elimina artículos';
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

        -- V26 · 4.16 · un artículo con historial no se borra: se archiva. Sólo el administrador archiva o restaura.
        if v_motivo is null and v_col = 'prod' then
          if v_borrado and v_hay then
            v_ref := public.rave_prod_refs(p_comercio, v_id);
            if v_ref is not null then v_motivo := 'no se elimina (' || v_ref || '): archivalo'; end if;
          end if;
          if v_motivo is null and not v_borrado
             and coalesce((v_datos ->> 'archived')::boolean, false)
                 is distinct from coalesce((case when v_hay then (v_prev.datos ->> 'archived')::boolean end), false)
             and v_rol <> 'admin' then
            v_motivo := 'sólo el administrador archiva o restaura artículos';
          end if;
        end if;
        -- V26 · 4.14 · cajas y sucursales: sólo el administrador las define; los traspasos exigen el perfil habilitado
        if v_motivo is null and v_col = 'ctransf' then
          select datos ->> 'cashProfile' into v_perfil from public.registros
           where comercio_id = p_comercio and coleccion = 'cfg' and id = 'cfg' and not borrado;
          if coalesce(v_perfil, 'simple') not in ('main', 'branches') then
            v_motivo := 'el módulo de caja principal no está habilitado';
          elsif coalesce(v_datos ->> 'from', '') = '' or coalesce(v_datos ->> 'to', '') = '' or (v_datos ->> 'from') = (v_datos ->> 'to') then
            v_motivo := 'traspaso inválido: origen y destino deben ser cajas distintas';
          elsif jsonb_typeof(v_datos -> 'amount') is distinct from 'number' or (v_datos ->> 'amount')::numeric <= 0
                or (v_datos ->> 'amount')::numeric <> trunc((v_datos ->> 'amount')::numeric) or (v_datos ->> 'amount')::numeric > 100000000000 then
            v_motivo := 'traspaso inválido: el importe debe ser un entero positivo en centavos';
          elsif coalesce(btrim(v_datos ->> 'rubro'), '') = '' or not exists
                (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = (v_datos ->> 'rubro') and not borrado) then
            v_motivo := 'el rubro del movimiento es obligatorio y debe existir en este comercio';
          elsif (select count(*) from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and not borrado
                  and id in (v_datos ->> 'from', v_datos ->> 'to')) <> 2 then
            v_motivo := 'las cajas del traspaso no existen en este comercio';
          end if;
        end if;
        -- V26.1 · pagos mixtos: la suma de los pagos tiene que dar el total exacto; la cuenta corriente exige cliente real.
        -- Los valores derivados (fiadoAmt, paid, balance, pstate) los calcula el servidor: el navegador no los puede falsear.
        if v_motivo is null and v_col = 'ventas' and v_datos ? 'pays' then
          declare
            v_p   jsonb;  v_sum numeric := 0;  v_fi numeric := 0;  v_tot numeric;  v_seen text[] := '{}';  v_m text;
          begin
            v_tot := case when jsonb_typeof(v_datos -> 'total') = 'number' then (v_datos ->> 'total')::numeric end;
            if jsonb_typeof(v_datos -> 'pays') is distinct from 'array' or jsonb_array_length(v_datos -> 'pays') not between 1 and 5 then
              v_motivo := 'pagos inválidos: tiene que haber entre 1 y 5 medios';
            elsif v_tot is null or v_tot <= 0 or v_tot <> trunc(v_tot) then
              v_motivo := 'total de la venta inválido (entero positivo en centavos)';
            else
              for v_p in select * from jsonb_array_elements(v_datos -> 'pays') loop
                v_m := v_p ->> 'm';
                if v_m is null or not (v_m = any(array['efectivo','debito','credito','transferencia','fiado','qr','modo','pedidosya'])) then
                  v_motivo := 'medio de pago inválido'; exit;
                elsif v_m = any(v_seen) then
                  v_motivo := 'medio de pago repetido'; exit;
                elsif jsonb_typeof(v_p -> 'a') is distinct from 'number' or (v_p ->> 'a')::numeric <= 0 or (v_p ->> 'a')::numeric <> trunc((v_p ->> 'a')::numeric) then
                  v_motivo := 'importe de pago inválido (entero positivo en centavos)'; exit;
                end if;
                v_seen := v_seen || v_m;
                v_sum := v_sum + (v_p ->> 'a')::numeric;
                if v_m = 'fiado' then v_fi := v_fi + (v_p ->> 'a')::numeric; end if;
              end loop;
              if v_motivo is null and v_sum <> v_tot then
                v_motivo := 'la suma de los pagos (' || v_sum || ') no coincide con el total (' || v_tot || ')';
              elsif v_motivo is null and jsonb_array_length(v_datos -> 'pays') > 1 and (v_seen && array['qr','modo','pedidosya']) then
                v_motivo := 'los cobros digitales no se combinan con otro medio';
              elsif v_motivo is null and v_fi > 0 and (coalesce(v_datos ->> 'cust', '') = '' or not exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'clientes'
                        and id = (v_datos ->> 'cust') and not borrado)) then
                v_motivo := 'la cuenta corriente exige un cliente identificado que exista en este comercio';
              end if;
            end if;
            if v_motivo is null then
              v_datos := v_datos || jsonb_build_object('fiadoAmt', v_fi, 'paid', v_tot - v_fi, 'balance', v_fi, 'fiado', v_fi > 0,
                                  'pstate', case when v_fi = 0 then 'pagada' when v_fi >= v_tot then 'pendiente' else 'parcial' end);
            end if;
          end;
        end if;
        -- V26.4 · 4.22 · canal mayorista y revisión de crédito. El servidor NO rechaza una venta ya hecha por superar el
        -- crédito (el equipo trabaja sin conexión): la marca `credit_review` y el motivo `crw`, que sólo el servidor escribe.
        if v_motivo is null and v_col = 'ventas' then
          declare
            v_fi2 numeric; v_cust text; v_lim numeric; v_deu numeric; v_cov text; v_ok_cov boolean := false; v_why text;
          begin
            v_datos := v_datos - 'credit_review' - 'crw';
            v_cust  := coalesce(v_datos ->> 'cust', '');
            if coalesce(v_datos ->> 'wch', '') not in ('', 'minorista', 'mayorista') then
              v_motivo := 'canal de venta inválido';
            elsif v_datos ->> 'wch' = 'mayorista' and (v_cust = '' or not exists
                  (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'clientes' and id = v_cust and not borrado)) then
              v_motivo := 'una venta mayorista exige un cliente identificado que exista en este comercio';
            elsif v_hay then
              if v_prev.datos ? 'credit_review' then
                v_datos := v_datos || jsonb_build_object('credit_review', v_prev.datos -> 'credit_review', 'crw', v_prev.datos -> 'crw');
              end if;
            else
              v_fi2 := coalesce(case when jsonb_typeof(v_datos -> 'fiadoAmt') = 'number' then (v_datos ->> 'fiadoAmt')::numeric end,
                                case when coalesce((v_datos ->> 'fiado')::boolean, false) and jsonb_typeof(v_datos -> 'total') = 'number'
                                     then (v_datos ->> 'total')::numeric end, 0);
              if v_fi2 > 0 and v_cust <> '' then
                select coalesce((datos ->> 'limit')::numeric, 0) into v_lim from public.registros
                 where comercio_id = p_comercio and coleccion = 'clientes' and id = v_cust and not borrado;
                v_deu := public.rave_deuda_cliente(p_comercio, v_cust);
                v_cov := coalesce(v_datos ->> 'cov', '');
                if v_cov <> '' then
                  select exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'cexc' and id = v_cov and not borrado
                                    and datos ->> 'cust' = v_cust and (datos ->> 'max')::numeric >= v_fi2) into v_ok_cov;
                end if;
                if coalesce(v_lim, 0) <= 0 then v_why := 'sin_limite';
                elsif v_deu + v_fi2 > v_lim then v_why := 'supera_limite'; end if;
                if v_why is not null and not v_ok_cov then
                  v_datos := v_datos || jsonb_build_object('credit_review', true,
                               'crw', v_why || case when v_cov <> '' then '+excepcion_invalida' else '' end);
                end if;
              end if;
            end if;
          end;
        end if;
        -- V26.4 · 4.22 · acuerdos especiales, excepciones de crédito y su consumo
        if v_motivo is null and v_col in ('acuer', 'cexc') and not v_borrado then
          if coalesce(v_datos ->> 'cust', '') = '' or not exists
             (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'clientes' and id = (v_datos ->> 'cust') and not borrado) then
            v_motivo := 'tiene que apuntar a un cliente que exista en este comercio';
          elsif v_col = 'cexc' then
            if jsonb_typeof(v_datos -> 'max') is distinct from 'number' or (v_datos ->> 'max')::numeric <= 0
               or (v_datos ->> 'max')::numeric <> trunc((v_datos ->> 'max')::numeric) or (v_datos ->> 'max')::numeric > 100000000000 then
              v_motivo := 'monto de la excepción inválido (entero positivo en centavos)';
            elsif jsonb_typeof(v_datos -> 'until') is distinct from 'number' then
              v_motivo := 'vigencia de la excepción inválida';
            elsif length(btrim(coalesce(v_datos ->> 'reason', ''))) < 5 then
              v_motivo := 'el motivo de la excepción es obligatorio (mínimo 5 letras)';
            end if;
          else
            if coalesce(v_datos ->> 'pid', '') = '' and coalesce(v_datos ->> 'rubro', '') = '' then
              v_motivo := 'el acuerdo tiene que ser sobre un producto o un rubro';
            elsif (jsonb_typeof(v_datos -> 'price') is distinct from 'number' and jsonb_typeof(v_datos -> 'pct') is distinct from 'number') then
              v_motivo := 'el acuerdo necesita un precio o un porcentaje';
            elsif coalesce((v_datos ->> 'price')::numeric, 0) < 0 or coalesce((v_datos ->> 'price')::numeric, 0) <> trunc(coalesce((v_datos ->> 'price')::numeric, 0))
                  or coalesce((v_datos ->> 'pct')::numeric, 0) < 0 or coalesce((v_datos ->> 'pct')::numeric, 0) >= 100
                  or (coalesce((v_datos ->> 'price')::numeric, 0) > 0) = (coalesce((v_datos ->> 'pct')::numeric, 0) > 0) then
              v_motivo := 'acuerdo inválido: usá un precio entero en centavos o un porcentaje menor a 100, no ambos';
            end if;
          end if;
        end if;
        if v_motivo is null and v_col = 'cexcu' then
          if not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'cexc' and id = coalesce(v_datos ->> 'ov', '') and not borrado) then
            v_motivo := 'la excepción de crédito no existe en este comercio';
          elsif jsonb_typeof(v_datos -> 'amt') is distinct from 'number' or (v_datos ->> 'amt')::numeric <= 0
                or (v_datos ->> 'amt')::numeric <> trunc((v_datos ->> 'amt')::numeric) then
            v_motivo := 'importe de uso inválido';
          end if;
        end if;
        if v_motivo is null and v_col in ('cajas', 'sucs') and jsonb_typeof(v_datos -> 'name') is distinct from 'string' then
          v_motivo := 'falta el nombre';
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
            -- V26.1 · una venta con pagos registrados no cambia sus importes ni su cliente (se corrige con anulación / nota de crédito)
            if v_prev.datos ? 'pays' then
              v_datos := (v_datos - 'pays' - 'fiadoAmt' - 'paid' - 'balance' - 'vuelto' - 'recv' - 'total' - 'items' - 'cust' - 'custName' - 'method' - 'pstate' - 'fiado')
                         || jsonb_strip_nulls(jsonb_build_object('pays', v_prev.datos -> 'pays', 'fiadoAmt', v_prev.datos -> 'fiadoAmt',
                            'paid', v_prev.datos -> 'paid', 'balance', v_prev.datos -> 'balance', 'vuelto', v_prev.datos -> 'vuelto',
                            'recv', v_prev.datos -> 'recv', 'total', v_prev.datos -> 'total', 'items', v_prev.datos -> 'items',
                            'cust', v_prev.datos -> 'cust', 'custName', v_prev.datos -> 'custName', 'method', v_prev.datos -> 'method',
                            'pstate', v_prev.datos -> 'pstate', 'fiado', v_prev.datos -> 'fiado'));
            end if;
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
        if v_col = 'prod' and v_borrado then
          v_aid := 'srv-' || gen_random_uuid()::text;
          insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
          values (p_comercio, 'audit', v_aid,
                  jsonb_build_object('id', v_aid, 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint,
                                     'user', coalesce(public.mi_email(), '?'), 'action', 'INV_ELIMINAR_SERVIDOR',
                                     'detail', 'artículo ' || v_id || ' eliminado (sin historial)', 'dev', left(p_dispositivo, 40)),
                  false, left(p_dispositivo, 40), auth.uid(), clock_timestamp())
          on conflict do nothing;
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

-- ===== 11-traspasos-cobros-auditoria.sql =====
-- =====================================================================
-- SISTEMA RAVE · 11 · V26.9 · 4.23 / 4.24 · Traspasos de fondos controlados, detalle de cobros digitales,
--                      auditoría sólo-agregar y administración de los clientes del Club
--
-- Correr DESPUÉS de 01..10 (se puede repetir: sólo "create or replace", "if not exists" y "drop ... if exists").
-- Aditiva: no borra ni cambia datos existentes. Con las banderas apagadas (cfg.xfer.strict / cfg.pay.detail.on) el
-- comportamiento de sincronizar() es el de la migración 10.
--
-- Qué agrega:
--   · rave_tiene_permiso(): lee el permiso del rol desde la configuración de roles ya sincronizada (el administrador siempre).
--   · Tablas SÓLO-AGREGAR con cadena de hash por comercio: traspasos, traspaso_eventos, cobro_detalles, auditoria_eventos.
--     UPDATE/DELETE/TRUNCATE rechazados por trigger (también para el administrador) + REVOKE; la hora y la IP las pone el servidor.
--     rave_verificar_cadena() detecta un eslabón alterado o faltante.
--   · sincronizar(): colecciones nuevas `ctev` (eventos de un traspaso) y `cdet` (detalle de un cobro digital, versionado);
--     `ctransf` v2 (permiso transfer_funds, autorizante, cajas cerradas, número T-<caja>-<n> asignado por el servidor);
--     reglas de clientes (baja y eliminación sólo del administrador, sin historial ni deuda; consentimientos con constancia;
--     una edición tardía no resucita a un cliente eliminado); `cfg.xfer` y `cfg.pay` sólo los cambia el administrador.
-- Límites declarados (no se escribe «inalterable» sin esto):
--   · Un superusuario del proyecto o el rol de servicio podrían alterar la base: la defensa adicional son las copias de seguridad
--     automáticas del proveedor [VERIFICAR plan] y el hash encadenado, que DETECTA el cambio pero no lo impide.
--   · El servidor no ve los datos personales cifrados del cliente (WhatsApp, DNI, correo, nacimiento): para esos campos la regla
--     «sólo administrador» se aplica en el equipo y el servidor sólo compara una huella (`pfp`) que el equipo calcula; un equipo
--     adulterado podría falsearla. Los campos en claro (estado, consentimientos, límite, canal, plazo, zona, vendedor) sí se validan acá.
--   · La clave o el PIN del autorizante se comprueba en el equipo; el servidor verifica que exista, sea administrador del comercio
--     y (salvo comercio de un único administrador) distinto del emisor, pero no puede probar que se tipeó la clave.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Ayudas internas
-- ---------------------------------------------------------------------
create or replace function public.rave_tiene_permiso(p_comercio uuid, p_usuario uuid, p_permiso text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_rol text; v_arr jsonb;
begin
  if p_comercio is null or p_usuario is null or p_permiso is null then return false; end if;
  if public.rol_en(p_comercio) is null then return false; end if;      -- quien pregunta tiene que ser del comercio
  select rol into v_rol from public.miembros where comercio_id = p_comercio and usuario_id = p_usuario;
  if v_rol is null then return false; end if;
  if v_rol = 'admin' then return true; end if;
  select datos -> v_rol into v_arr from public.registros
   where comercio_id = p_comercio and coleccion = 'cfg' and id = 'roles' and not borrado;
  return coalesce(jsonb_typeof(v_arr) = 'array' and v_arr ? p_permiso, false);
end $$;
revoke all on function public.rave_tiene_permiso(uuid, uuid, text) from public, anon;
grant execute on function public.rave_tiene_permiso(uuid, uuid, text) to authenticated;

-- Luhn + prefijo plausible de tarjeta: un número de tarjeta completo NUNCA se guarda (PCI-DSS)
create or replace function public.rave_luhn_ok(p text) returns boolean language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s int := 0; i int; n int; alt boolean := false;
begin
  if length(d) < 13 or length(d) > 19 then return false; end if;
  for i in reverse length(d)..1 loop
    n := substr(d, i, 1)::int;
    if alt then n := n * 2; if n > 9 then n := n - 9; end if; end if;
    s := s + n; alt := not alt;
  end loop;
  return s % 10 = 0;
end $$;

create or replace function public.rave_parece_pan(p text) returns boolean language plpgsql immutable as $$
declare m text[]; d text;
begin
  if p is null then return false; end if;
  for m in select regexp_matches(p, '((?:\d[ -]?){13,19})', 'g') loop
    d := regexp_replace(m[1], '\D', '', 'g');
    if length(d) between 13 and 19 and substr(d, 1, 1) in ('2','3','4','5','6') and public.rave_luhn_ok(d) then return true; end if;
  end loop;
  return false;
end $$;

-- ¿Algún valor de texto del documento parece un número de tarjeta? (las claves de cifrado __pii no se recorren)
create or replace function public.rave_json_tiene_pan(p jsonb) returns boolean language plpgsql immutable as $$
declare k text; v jsonb;
begin
  if p is null then return false; end if;
  if jsonb_typeof(p) = 'string' then return public.rave_parece_pan(p #>> '{}'); end if;
  if jsonb_typeof(p) = 'object' then
    for k, v in select * from jsonb_each(p) loop
      continue when k = '__pii';
      if public.rave_json_tiene_pan(v) then return true; end if;
    end loop;
  elsif jsonb_typeof(p) = 'array' then
    for v in select * from jsonb_array_elements(p) loop
      if public.rave_json_tiene_pan(v) then return true; end if;
    end loop;
  end if;
  return false;
end $$;

create or replace function public.rave_cfg_bloque(p_comercio uuid, p_clave text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select datos -> p_clave from public.registros
                    where comercio_id = p_comercio and coleccion = 'cfg' and id = 'cfg' and not borrado), '{}'::jsonb)
$$;
revoke all on function public.rave_cfg_bloque(uuid, text), public.rave_luhn_ok(text), public.rave_parece_pan(text), public.rave_json_tiene_pan(jsonb) from public, anon, authenticated;

-- ¿Puede este rol escribir traspasos? Con xfer.strict hace falta el permiso transfer_funds; sin la bandera, como siempre (admin y supervisor).
create or replace function public.rave_xfer_autorizado(p_comercio uuid, p_rol text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_rol = 'admin' then return true; end if;
  if coalesce((public.rave_cfg_bloque(p_comercio, 'xfer') ->> 'strict')::boolean, false) then
    return public.rave_tiene_permiso(p_comercio, auth.uid(), 'transfer_funds');
  end if;
  return p_rol = 'supervisor';
end $$;
revoke all on function public.rave_xfer_autorizado(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Cadena de hash por comercio (la calcula el servidor al insertar) + inmutabilidad
-- ---------------------------------------------------------------------
create or replace function public.rave_cadena() returns trigger
language plpgsql security definer set search_path = public, extensions set timezone = 'UTC' as $$
declare v_seq bigint; v_prev text;
begin
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.tenant_id::text, 11));
  execute format('select seq, hash from public.%I where tenant_id = $1 order by seq desc limit 1', tg_table_name)
     into v_seq, v_prev using new.tenant_id;
  new.seq       := coalesce(v_seq, 0) + 1;
  new.hash_prev := coalesce(v_prev, repeat('0', 64));
  new.hash      := encode(extensions.digest(new.hash_prev || '|' || (to_jsonb(new) - 'hash' - 'hash_prev')::text, 'sha256'), 'hex');
  return new;
end $$;

create or replace function public.rave_no_truncate() returns trigger language plpgsql as $$
begin
  raise exception '% no se vacía: es un registro contable', tg_table_name;
end $$;
revoke all on function public.rave_cadena(), public.rave_no_truncate() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Tablas
-- ---------------------------------------------------------------------
-- 3.1 traspasos: el comprobante interno de un traspaso de fondos («Boleta de Movimiento de Fondos»)
create table if not exists public.traspasos (
  tenant_id          uuid   not null references public.comercios(id) on delete cascade,
  seq                bigint not null,
  id                 text   not null check (length(id) between 1 and 80),
  caja_origen        text   not null check (length(caja_origen) between 1 and 80),
  caja_destino       text   not null check (length(caja_destino) between 1 and 80),
  n                  integer not null check (n > 0),
  num                text   not null check (length(num) between 3 and 40),
  amount_cents       bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  currency           char(3) not null default 'ARS' check (currency = 'ARS'),
  rubro_id           text   not null,
  rubro_nombre       text,
  motivo             text   not null check (length(btrim(motivo)) between 3 and 200),
  emisor_id          uuid,
  emisor_nombre      text,
  autorizante_id     uuid   not null,
  autorizante_nombre text,
  auth_metodo        text   not null check (auth_metodo in ('permiso_propio', 'pin_admin', 'clave_admin')),
  suc_origen         text,
  suc_destino        text,
  estado_caja_origen  text  not null check (estado_caja_origen in ('abierta', 'cerrada')),
  estado_caja_destino text  not null check (estado_caja_destino in ('abierta', 'cerrada')),
  ref_origen         text,
  ref_destino        text,
  estado_inicial     text   not null check (estado_inicial in ('completado', 'en_transito')),
  rev_of             text,
  ts_equipo          timestamptz,
  ts_servidor        timestamptz not null default clock_timestamp(),
  hora_desfasada     boolean not null default false,
  datos              jsonb  not null,
  hash               text   not null,
  hash_prev          text   not null,
  primary key (tenant_id, seq),
  unique (tenant_id, id),
  unique (tenant_id, caja_origen, n)
);
create index if not exists traspasos_fecha on public.traspasos (tenant_id, ts_servidor);

-- 3.2 traspaso_eventos: máquina de estados sólo-agregar
create table if not exists public.traspaso_eventos (
  tenant_id     uuid   not null references public.comercios(id) on delete cascade,
  seq           bigint not null,
  id            text   not null check (length(id) between 1 and 80),
  traspaso_id   text   not null,
  kind          text   not null check (kind in ('emitido', 'en_transito', 'recibido', 'recibido_con_diferencia', 'devuelto', 'revertido', 'anotado')),
  amount_cents  bigint check (amount_cents is null or (amount_cents >= 0 and amount_cents <= 100000000000)),
  nota          text   check (nota is null or length(nota) <= 300),
  sess          text,
  usuario_id    uuid,
  usuario_nombre text,
  ts_equipo     timestamptz,
  ts_servidor   timestamptz not null default clock_timestamp(),
  datos         jsonb  not null default '{}'::jsonb,
  hash          text   not null,
  hash_prev     text   not null,
  primary key (tenant_id, seq),
  unique (tenant_id, id),
  foreign key (tenant_id, traspaso_id) references public.traspasos (tenant_id, id)
);
create index if not exists traspaso_eventos_t on public.traspaso_eventos (tenant_id, traspaso_id, seq);

-- 3.3 cobro_detalles: detalle versionado de un cobro digital (la venta no cambia; cada corrección es una versión nueva)
create table if not exists public.cobro_detalles (
  tenant_id     uuid   not null references public.comercios(id) on delete cascade,
  seq           bigint not null,
  id            text   not null check (length(id) between 1 and 80),
  sale_id       text   not null check (length(sale_id) between 1 and 80),
  pay_idx       integer not null check (pay_idx between 0 and 4),
  version       integer not null check (version >= 1),
  medio         text   not null check (medio in ('transferencia', 'debito', 'credito', 'qr', 'modo')),
  estado        text   not null default 'declarado' check (estado in ('declarado', 'en_proceso', 'aprobado', 'acreditado', 'rechazado', 'reembolsado', 'verificado')),
  entidad       text,
  nro_operacion text,
  clave_unica   text,
  pendiente     boolean not null default false,
  excepcion     jsonb,
  duplicado_ok  jsonb,
  created_by    uuid,
  ts_equipo     timestamptz,
  ts_servidor   timestamptz not null default clock_timestamp(),
  datos         jsonb  not null,
  hash          text   not null,
  hash_prev     text   not null,
  primary key (tenant_id, seq),
  unique (tenant_id, id),
  unique (tenant_id, sale_id, pay_idx, version)
);
create unique index if not exists cobro_detalles_clave_unica on public.cobro_detalles (tenant_id, clave_unica) where clave_unica is not null;
create index if not exists cobro_detalles_venta on public.cobro_detalles (tenant_id, sale_id, pay_idx, version);

-- 3.4 auditoria_eventos: la pista estructurada del servidor (se alimenta de la colección `audit` y de rave_auditar)
create table if not exists public.auditoria_eventos (
  tenant_id   uuid   not null references public.comercios(id) on delete cascade,
  seq         bigint not null,
  id          text   not null check (length(id) between 1 and 80),
  module      text,
  action      text   not null,
  entity      text,
  entity_id   text,
  old_value   text,
  new_value   text,
  reason      text,
  detail      text,
  usuario     text,
  usuario_id  uuid,
  rol         text,
  device_id   text,
  ip          text,
  ts_equipo   bigint,
  ts_servidor timestamptz not null default clock_timestamp(),
  hash        text   not null,
  hash_prev   text   not null,
  primary key (tenant_id, seq),
  unique (tenant_id, id)
);
create index if not exists auditoria_entidad on public.auditoria_eventos (tenant_id, entity, entity_id, seq);
create index if not exists auditoria_fecha on public.auditoria_eventos (tenant_id, ts_servidor);

do $$
declare t text;
begin
  foreach t in array array['traspasos', 'traspaso_eventos', 'cobro_detalles', 'auditoria_eventos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_cadena', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.rave_cadena()', t || '_cadena', t);
    execute format('drop trigger if exists %I on public.%I', t || '_solo_agregar', t);
    execute format('create trigger %I before update or delete on public.%I for each row execute function public.rave_solo_agregar()', t || '_solo_agregar', t);
    execute format('drop trigger if exists %I on public.%I', t || '_no_truncate', t);
    execute format('create trigger %I before truncate on public.%I for each statement execute function public.rave_no_truncate()', t || '_no_truncate', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists "traspasos: leen quienes los gestionan" on public.traspasos;
create policy "traspasos: leen quienes los gestionan" on public.traspasos for select to authenticated
  using (public.rol_en(tenant_id) in ('admin', 'supervisor') or public.rave_tiene_permiso(tenant_id, auth.uid(), 'transfer_funds'));
drop policy if exists "traspaso_eventos: leen quienes los gestionan" on public.traspaso_eventos;
create policy "traspaso_eventos: leen quienes los gestionan" on public.traspaso_eventos for select to authenticated
  using (public.rol_en(tenant_id) in ('admin', 'supervisor') or public.rave_tiene_permiso(tenant_id, auth.uid(), 'transfer_funds'));
drop policy if exists "cobro_detalles: leen admin, supervisor y quien cobró" on public.cobro_detalles;
create policy "cobro_detalles: leen admin, supervisor y quien cobró" on public.cobro_detalles for select to authenticated
  using (public.rol_en(tenant_id) in ('admin', 'supervisor') or (created_by = auth.uid() and public.rol_en(tenant_id) is not null));
drop policy if exists "auditoria_eventos: leen admin y supervisor" on public.auditoria_eventos;
create policy "auditoria_eventos: leen admin y supervisor" on public.auditoria_eventos for select to authenticated
  using (public.rol_en(tenant_id) in ('admin', 'supervisor'));

-- Estado actual de cada traspaso: enviado = recibido + en tránsito + diferencia + devuelto (el dinero no aparece ni desaparece)
create or replace view public.traspasos_estado with (security_invoker = true) as
select t.tenant_id, t.id, t.num, t.amount_cents as enviado, t.estado_inicial,
       case when t.estado_inicial = 'completado' then t.amount_cents
            else coalesce((select sum(e.amount_cents) from public.traspaso_eventos e
                            where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind in ('recibido', 'recibido_con_diferencia')), 0) end as recibido,
       case when t.estado_inicial = 'en_transito' and not exists
                 (select 1 from public.traspaso_eventos e where e.tenant_id = t.tenant_id and e.traspaso_id = t.id
                     and e.kind in ('recibido', 'recibido_con_diferencia', 'devuelto'))
            then t.amount_cents else 0 end as en_transito,
       coalesce((select t.amount_cents - e.amount_cents from public.traspaso_eventos e
                  where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'recibido_con_diferencia' limit 1), 0) as diferencia,
       coalesce((select sum(e.amount_cents) from public.traspaso_eventos e
                  where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'devuelto'), 0) as devuelto,
       case when exists (select 1 from public.traspaso_eventos e where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'devuelto') then 'devuelto'
            when exists (select 1 from public.traspaso_eventos e where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'recibido_con_diferencia') then 'recibido_con_diferencia'
            when exists (select 1 from public.traspaso_eventos e where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'recibido') then 'recibido'
            else t.estado_inicial end
         || case when exists (select 1 from public.traspaso_eventos e where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'revertido') then '+revertido' else '' end as estado
  from public.traspasos t;
revoke all on public.traspasos_estado from anon;
grant select on public.traspasos_estado to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verificación de la cadena y huecos de numeración
-- ---------------------------------------------------------------------
create or replace function public.rave_verificar_cadena(p_comercio uuid, p_tabla text default 'auditoria_eventos')
returns jsonb language plpgsql stable security definer set search_path = public, extensions set timezone = 'UTC' as $$
declare r record; v_prev text := repeat('0', 64); v_esp bigint := 1; v_total bigint := 0; v_h text;
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin', 'supervisor') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_tabla not in ('traspasos', 'traspaso_eventos', 'cobro_detalles', 'auditoria_eventos') then raise exception 'tabla inválida'; end if;
  for r in execute format('select seq, hash, hash_prev, to_jsonb(t) as j from public.%I t where tenant_id = $1 order by seq', p_tabla) using p_comercio loop
    v_total := v_total + 1;
    if r.seq <> v_esp then
      return jsonb_build_object('ok', false, 'tabla', p_tabla, 'total', v_total, 'roto', v_esp, 'motivo', 'falta un registro de la cadena');
    end if;
    if r.hash_prev <> v_prev then
      return jsonb_build_object('ok', false, 'tabla', p_tabla, 'total', v_total, 'roto', r.seq, 'motivo', 'el eslabón anterior no coincide');
    end if;
    v_h := encode(extensions.digest(r.hash_prev || '|' || ((r.j) - 'hash' - 'hash_prev')::text, 'sha256'), 'hex');
    if v_h <> r.hash then
      return jsonb_build_object('ok', false, 'tabla', p_tabla, 'total', v_total, 'roto', r.seq, 'motivo', 'el contenido fue alterado');
    end if;
    v_prev := r.hash; v_esp := r.seq + 1;
  end loop;
  return jsonb_build_object('ok', true, 'tabla', p_tabla, 'total', v_total, 'roto', null, 'motivo', null);
end $$;
revoke all on function public.rave_verificar_cadena(uuid, text) from public, anon;
grant execute on function public.rave_verificar_cadena(uuid, text) to authenticated;

-- Números de traspaso que faltan (huecos) por caja de origen
create or replace function public.rave_traspasos_huecos(p_comercio uuid)
returns table (caja text, falta integer) language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin', 'supervisor') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  return query
    select t.caja_origen, g.n from (select caja_origen, max(n) as mx from public.traspasos where tenant_id = p_comercio group by caja_origen) t,
           generate_series(1, t.mx) g(n)
     where not exists (select 1 from public.traspasos x where x.tenant_id = p_comercio and x.caja_origen = t.caja_origen and x.n = g.n)
     order by 1, 2;
end $$;
revoke all on function public.rave_traspasos_huecos(uuid) from public, anon;
grant execute on function public.rave_traspasos_huecos(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. La colección `audit` (una escritura por evento) alimenta la pista estructurada del servidor
-- ---------------------------------------------------------------------
create or replace function public.rave_espejo_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_d jsonb := new.datos; v_ip text; v_rol text; v_h jsonb;
begin
  if new.coleccion <> 'audit' then return new; end if;
  begin
    v_h := nullif(current_setting('request.headers', true), '')::jsonb;
    v_ip := nullif(btrim(split_part(coalesce(v_h ->> 'x-forwarded-for', v_h ->> 'x-real-ip', ''), ',', 1)), '');
    if v_ip is not null then v_ip := host(v_ip::inet); end if;
  exception when others then v_ip := null; end;
  select rol into v_rol from public.miembros where comercio_id = new.comercio_id and usuario_id = new.usuario_id;
  insert into public.auditoria_eventos (tenant_id, id, module, action, entity, entity_id, old_value, new_value, reason, detail,
                                        usuario, usuario_id, rol, device_id, ip, ts_equipo)
  values (new.comercio_id, left(new.id, 80), lower(split_part(coalesce(v_d ->> 'action', ''), '_', 1)),
          left(coalesce(nullif(v_d ->> 'action', ''), '?'), 80),
          left(v_d ->> 'ent', 40), left(v_d ->> 'eid', 80),
          left(v_d ->> 'old', 300), left(v_d ->> 'new', 300), left(v_d ->> 'reason', 300), left(v_d ->> 'detail', 400),
          left(v_d ->> 'user', 80), new.usuario_id, v_rol, left(coalesce(new.dispositivo, v_d ->> 'dev'), 40), v_ip,
          case when jsonb_typeof(v_d -> 'ts') = 'number' then (v_d ->> 'ts')::numeric::bigint end)
  on conflict (tenant_id, id) do nothing;
  return new;
end $$;
revoke all on function public.rave_espejo_auditoria() from public, anon, authenticated;
drop trigger if exists registros_espejo_auditoria on public.registros;
create trigger registros_espejo_auditoria after insert on public.registros
  for each row when (new.coleccion = 'audit') execute function public.rave_espejo_auditoria();

-- ---------------------------------------------------------------------
-- 6. Quién escribe qué, y sincronizar() con las reglas de V26.9
-- ---------------------------------------------------------------------
create or replace function public.rave_puede_escribir(p_rol text, p_col text, p_id text)
returns boolean language sql immutable as $$
  select case p_rol
    when 'admin' then true
    when 'supervisor' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                     'clientes','fiado','fich','pedidos','arrep','pya','membs',
                                     'prod','rubros','cierres','cnotas','cupones','planes','lotes','tareas','ctransf',
                                     'acuer','cexc','cexcu','ctev','cdet')
                           or (p_col = 'cfg' and p_id = 'cfg')
    when 'mostrador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                    'clientes','fiado','fich','pedidos','arrep','pya','membs','cexcu','ctransf','ctev','cdet')
    when 'operador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs','cexcu','ctransf','ctev','cdet')
    else false end
$$;

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
                                        'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf','acuer','cexc','cexcu','ctev','cdet'];
  c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf','cexc','cexcu','ctev','cdet'];
  c_borrables  constant text[] := array['prod','rubros','clientes','emp','puestos','tareas','cupones','planes','tlogs','pedidos','acuer'];
  c_cfg_ids    constant text[] := array['tenant','cfg','menu','loyalty','roles','integ','legal','clubkey'];
  c_secretos   constant text[] := array['arcaCert','arcaKey','arcaPem','accessToken','refreshToken','clientSecret','apiKey','serviceKey'];
  v_k          text;
  v_ref        text;
  v_perfil     text;
  v_aid        text;
  v_late       boolean;
  v_uid        uuid := auth.uid();
  v_xf         jsonb;
  v_strict     boolean;
  v_n          int;
  v_num        text;
  v_estado     text;
  v_seq        bigint;
  v_hs         text;
  v_tss        timestamptz;
  v_rn         text;
  v_code       text;
  v_ev         text;
  v_ck         text;
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
      v_late := v_col in ('smov', 'ctev', 'cdet');
      continue when (v_pasada = 1 and coalesce(v_late, false)) or (v_pasada = 2 and not coalesce(v_late, false));

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
        elsif v_col in ('ctransf', 'ctev') and not public.rave_xfer_autorizado(p_comercio, v_rol) then
          v_motivo := 'no tenés permiso para traspasar fondos entre cajas';
        elsif v_borrado and not (v_col = any(c_borrables)) then
          v_motivo := 'este tipo de registro no se borra';
        elsif v_borrado and v_col = 'prod' and v_rol <> 'admin' then
          v_motivo := 'sólo el administrador elimina artículos';
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

        -- V26 · 4.16 · un artículo con historial no se borra: se archiva. Sólo el administrador archiva o restaura.
        if v_motivo is null and v_col = 'prod' then
          if v_borrado and v_hay then
            v_ref := public.rave_prod_refs(p_comercio, v_id);
            if v_ref is not null then v_motivo := 'no se elimina (' || v_ref || '): archivalo'; end if;
          end if;
          if v_motivo is null and not v_borrado
             and coalesce((v_datos ->> 'archived')::boolean, false)
                 is distinct from coalesce((case when v_hay then (v_prev.datos ->> 'archived')::boolean end), false)
             and v_rol <> 'admin' then
            v_motivo := 'sólo el administrador archiva o restaura artículos';
          end if;
        end if;
        -- V26 · 4.14 / V26.9 · 4.23 · cajas y sucursales: sólo el administrador las define; los traspasos exigen el perfil habilitado
        -- y, con la versión 2 del comprobante, permiso `transfer_funds`, autorizante y estado de las cajas verificado.
        if v_motivo is null and v_col = 'ctransf' then
          select datos ->> 'cashProfile' into v_perfil from public.registros
           where comercio_id = p_comercio and coleccion = 'cfg' and id = 'cfg' and not borrado;
          v_xf := public.rave_cfg_bloque(p_comercio, 'xfer');
          v_strict := coalesce((v_xf ->> 'strict')::boolean, false);
          if coalesce(v_perfil, 'simple') not in ('main', 'branches') then
            v_motivo := 'el módulo de caja principal no está habilitado';
          elsif coalesce(v_datos ->> 'from', '') = '' or coalesce(v_datos ->> 'to', '') = '' or (v_datos ->> 'from') = (v_datos ->> 'to') then
            v_motivo := 'traspaso inválido: origen y destino deben ser cajas distintas';
          elsif jsonb_typeof(v_datos -> 'amount') is distinct from 'number' or (v_datos ->> 'amount')::numeric <= 0
                or (v_datos ->> 'amount')::numeric <> trunc((v_datos ->> 'amount')::numeric) or (v_datos ->> 'amount')::numeric > 100000000000 then
            v_motivo := 'traspaso inválido: el importe debe ser un entero positivo en centavos';
          elsif coalesce(btrim(v_datos ->> 'rubro'), '') = '' or not exists
                (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = (v_datos ->> 'rubro') and not borrado) then
            v_motivo := 'el rubro del movimiento es obligatorio y debe existir en este comercio';
          elsif (select count(*) from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and not borrado
                  and id in (v_datos ->> 'from', v_datos ->> 'to')) <> 2 then
            v_motivo := 'las cajas del traspaso no existen en este comercio';
          elsif v_strict and coalesce(case when jsonb_typeof(v_datos -> 'v') = 'number' then (v_datos ->> 'v')::int end, 0) <> 2 then
            v_motivo := 'este traspaso viene de una versión vieja del sistema: actualizá el equipo';
          elsif coalesce(case when jsonb_typeof(v_datos -> 'v') = 'number' then (v_datos ->> 'v')::int end, 0) = 2 then
            declare
              w_fs   text := v_datos ->> 'fromState';
              w_ts   text := v_datos ->> 'toState';
              w_m    text := v_datos -> 'auth' ->> 'method';
              w_aid  uuid;
              w_cond boolean;
              w_fbr  text;
              w_tbr  text;
              w_over numeric := coalesce(case when (v_xf ->> 'approvalOver') ~ '^[0-9]+$' then (v_xf ->> 'approvalOver')::numeric end, 0);
              w_tsm  numeric := coalesce(case when jsonb_typeof(v_datos -> 'ts') = 'number' then (v_datos ->> 'ts')::numeric end, 0);
              w_amt  numeric := (v_datos ->> 'amount')::numeric;
              w_org  public.traspasos;
              w_adm  int;
            begin
              if coalesce(v_datos ->> 'cur', 'ARS') <> 'ARS' then
                v_motivo := 'moneda no admitida: el sistema opera sólo en pesos (ARS)';
              elsif length(btrim(coalesce(v_datos ->> 'motivo', ''))) < 3 or length(v_datos ->> 'motivo') > 200 then
                v_motivo := 'el concepto del traspaso es obligatorio (3 a 200 caracteres)';
              elsif w_fs is null or w_ts is null or w_fs not in ('abierta', 'cerrada') or w_ts not in ('abierta', 'cerrada') then
                v_motivo := 'falta el estado de las cajas al traspasar';
              elsif w_fs = 'abierta' and not exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and not borrado
                        and id = coalesce(v_datos ->> 'fromSess', '') and datos ->> 'regId' = (v_datos ->> 'from')
                        and (coalesce((datos ->> 'closedAt')::numeric, 0) = 0 or (datos ->> 'closedAt')::numeric >= w_tsm)) then
                v_motivo := 'la sesión de la caja de origen no existe en el servidor o no era la abierta: esperá a que sincronice';
              elsif w_ts = 'abierta' and not exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and not borrado
                        and id = coalesce(v_datos ->> 'toSess', '') and datos ->> 'regId' = (v_datos ->> 'to')
                        and (coalesce((datos ->> 'closedAt')::numeric, 0) = 0 or (datos ->> 'closedAt')::numeric >= w_tsm)) then
                v_motivo := 'la sesión de la caja de destino no existe en el servidor o no era la abierta: esperá a que sincronice';
              elsif w_fs = 'cerrada' and exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and not borrado
                        and datos ->> 'regId' = (v_datos ->> 'from') and coalesce((datos ->> 'closedAt')::numeric, 0) = 0
                        and coalesce((datos ->> 'openedAt')::numeric, 0) <= w_tsm) then
                v_motivo := 'la caja de origen figura abierta en el servidor: el estado informado no coincide';
              elsif w_ts = 'cerrada' and exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and not borrado
                        and datos ->> 'regId' = (v_datos ->> 'to') and coalesce((datos ->> 'closedAt')::numeric, 0) = 0
                        and coalesce((datos ->> 'openedAt')::numeric, 0) <= w_tsm) then
                v_motivo := 'la caja de destino figura abierta en el servidor: el estado informado no coincide';
              elsif coalesce(v_datos -> 'auth' ->> 'id', '') !~ '^[0-9a-fA-F-]{36}$' or w_m is null or w_m not in ('permiso_propio', 'pin_admin', 'clave_admin') then
                v_motivo := 'falta el autorizante del traspaso o su método';
              else
                w_aid := (v_datos -> 'auth' ->> 'id')::uuid;
                select datos ->> 'branchId' into w_fbr from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and id = (v_datos ->> 'from');
                select datos ->> 'branchId' into w_tbr from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and id = (v_datos ->> 'to');
                w_cond := w_fs = 'cerrada' or w_ts = 'cerrada' or coalesce(v_datos ->> 'rev', '') <> ''
                          or coalesce(w_fbr, '') <> coalesce(w_tbr, '') or (w_over > 0 and w_amt > w_over);
                if w_m = 'permiso_propio' then
                  if w_cond then
                    v_motivo := 'esta operación (caja cerrada, entre sucursales, importe alto o reversa) necesita la autorización de un administrador';
                  elsif w_aid is distinct from v_uid then
                    v_motivo := 'con permiso propio el autorizante es quien emite el traspaso';
                  end if;
                else
                  select count(*) into w_adm from public.miembros where comercio_id = p_comercio and rol = 'admin';
                  if not exists (select 1 from public.miembros where comercio_id = p_comercio and usuario_id = w_aid and rol = 'admin') then
                    v_motivo := 'el autorizante no es administrador de este comercio';
                  elsif w_aid = v_uid and not coalesce((v_datos -> 'auth' ->> 'self')::boolean, false) then
                    v_motivo := 'el autorizante tiene que ser un administrador distinto de quien emite';
                  elsif w_aid = v_uid and w_adm > 1 and not coalesce((v_xf ->> 'selfAuth')::boolean, false) then
                    v_motivo := 'hay otro administrador: tiene que autorizar él (o habilitar la autorización propia en la configuración)';
                  end if;
                end if;
                if v_motivo is null and coalesce(v_datos ->> 'rev', '') <> '' then
                  select * into w_org from public.traspasos where tenant_id = p_comercio and id = (v_datos ->> 'rev');
                  if not found then v_motivo := 'el traspaso que se quiere revertir no existe';
                  elsif v_rol <> 'admin' then v_motivo := 'sólo el administrador revierte un traspaso';
                  elsif exists (select 1 from public.traspaso_eventos where tenant_id = p_comercio and traspaso_id = w_org.id and kind = 'revertido') then
                    v_motivo := 'ese traspaso ya fue revertido';
                  elsif w_org.amount_cents <> w_amt or w_org.caja_origen <> (v_datos ->> 'to') or w_org.caja_destino <> (v_datos ->> 'from') then
                    v_motivo := 'la reversa tiene que devolver el mismo importe por el camino inverso';
                  elsif w_org.estado_inicial = 'en_transito' and not exists
                        (select 1 from public.traspaso_eventos where tenant_id = p_comercio and traspaso_id = w_org.id and kind in ('recibido', 'recibido_con_diferencia', 'devuelto')) then
                    v_motivo := 'ese traspaso sigue en tránsito: devolvelo en lugar de revertirlo';
                  end if;
                end if;
              end if;
            end;
          end if;
        end if;
        -- V26.1 · pagos mixtos: la suma de los pagos tiene que dar el total exacto; la cuenta corriente exige cliente real.
        -- Los valores derivados (fiadoAmt, paid, balance, pstate) los calcula el servidor: el navegador no los puede falsear.
        if v_motivo is null and v_col = 'ventas' and v_datos ? 'pays' then
          declare
            v_p   jsonb;  v_sum numeric := 0;  v_fi numeric := 0;  v_tot numeric;  v_seen text[] := '{}';  v_m text;
          begin
            v_tot := case when jsonb_typeof(v_datos -> 'total') = 'number' then (v_datos ->> 'total')::numeric end;
            if jsonb_typeof(v_datos -> 'pays') is distinct from 'array' or jsonb_array_length(v_datos -> 'pays') not between 1 and 5 then
              v_motivo := 'pagos inválidos: tiene que haber entre 1 y 5 medios';
            elsif v_tot is null or v_tot <= 0 or v_tot <> trunc(v_tot) then
              v_motivo := 'total de la venta inválido (entero positivo en centavos)';
            else
              for v_p in select * from jsonb_array_elements(v_datos -> 'pays') loop
                v_m := v_p ->> 'm';
                if v_m is null or not (v_m = any(array['efectivo','debito','credito','transferencia','fiado','qr','modo','pedidosya'])) then
                  v_motivo := 'medio de pago inválido'; exit;
                elsif v_m = any(v_seen) then
                  v_motivo := 'medio de pago repetido'; exit;
                elsif jsonb_typeof(v_p -> 'a') is distinct from 'number' or (v_p ->> 'a')::numeric <= 0 or (v_p ->> 'a')::numeric <> trunc((v_p ->> 'a')::numeric) then
                  v_motivo := 'importe de pago inválido (entero positivo en centavos)'; exit;
                end if;
                v_seen := v_seen || v_m;
                v_sum := v_sum + (v_p ->> 'a')::numeric;
                if v_m = 'fiado' then v_fi := v_fi + (v_p ->> 'a')::numeric; end if;
              end loop;
              if v_motivo is null and v_sum <> v_tot then
                v_motivo := 'la suma de los pagos (' || v_sum || ') no coincide con el total (' || v_tot || ')';
              elsif v_motivo is null and jsonb_array_length(v_datos -> 'pays') > 1 and (v_seen && array['qr','modo','pedidosya']) then
                v_motivo := 'los cobros digitales no se combinan con otro medio';
              elsif v_motivo is null and v_fi > 0 and (coalesce(v_datos ->> 'cust', '') = '' or not exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'clientes'
                        and id = (v_datos ->> 'cust') and not borrado)) then
                v_motivo := 'la cuenta corriente exige un cliente identificado que exista en este comercio';
              end if;
            end if;
            if v_motivo is null then
              v_datos := v_datos || jsonb_build_object('fiadoAmt', v_fi, 'paid', v_tot - v_fi, 'balance', v_fi, 'fiado', v_fi > 0,
                                  'pstate', case when v_fi = 0 then 'pagada' when v_fi >= v_tot then 'pendiente' else 'parcial' end);
            end if;
          end;
        end if;
        -- V26.4 · 4.22 · canal mayorista y revisión de crédito. El servidor NO rechaza una venta ya hecha por superar el
        -- crédito (el equipo trabaja sin conexión): la marca `credit_review` y el motivo `crw`, que sólo el servidor escribe.
        if v_motivo is null and v_col = 'ventas' then
          declare
            v_fi2 numeric; v_cust text; v_lim numeric; v_deu numeric; v_cov text; v_ok_cov boolean := false; v_why text;
          begin
            v_datos := v_datos - 'credit_review' - 'crw';
            v_cust  := coalesce(v_datos ->> 'cust', '');
            if coalesce(v_datos ->> 'wch', '') not in ('', 'minorista', 'mayorista') then
              v_motivo := 'canal de venta inválido';
            elsif v_datos ->> 'wch' = 'mayorista' and (v_cust = '' or not exists
                  (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'clientes' and id = v_cust and not borrado)) then
              v_motivo := 'una venta mayorista exige un cliente identificado que exista en este comercio';
            elsif v_hay then
              if v_prev.datos ? 'credit_review' then
                v_datos := v_datos || jsonb_build_object('credit_review', v_prev.datos -> 'credit_review', 'crw', v_prev.datos -> 'crw');
              end if;
            else
              v_fi2 := coalesce(case when jsonb_typeof(v_datos -> 'fiadoAmt') = 'number' then (v_datos ->> 'fiadoAmt')::numeric end,
                                case when coalesce((v_datos ->> 'fiado')::boolean, false) and jsonb_typeof(v_datos -> 'total') = 'number'
                                     then (v_datos ->> 'total')::numeric end, 0);
              if v_fi2 > 0 and v_cust <> '' then
                select coalesce((datos ->> 'limit')::numeric, 0) into v_lim from public.registros
                 where comercio_id = p_comercio and coleccion = 'clientes' and id = v_cust and not borrado;
                v_deu := public.rave_deuda_cliente(p_comercio, v_cust);
                v_cov := coalesce(v_datos ->> 'cov', '');
                if v_cov <> '' then
                  select exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'cexc' and id = v_cov and not borrado
                                    and datos ->> 'cust' = v_cust and (datos ->> 'max')::numeric >= v_fi2) into v_ok_cov;
                end if;
                if coalesce(v_lim, 0) <= 0 then v_why := 'sin_limite';
                elsif v_deu + v_fi2 > v_lim then v_why := 'supera_limite'; end if;
                if v_why is not null and not v_ok_cov then
                  v_datos := v_datos || jsonb_build_object('credit_review', true,
                               'crw', v_why || case when v_cov <> '' then '+excepcion_invalida' else '' end);
                end if;
              end if;
            end if;
          end;
        end if;
        -- V26.4 · 4.22 · acuerdos especiales, excepciones de crédito y su consumo
        if v_motivo is null and v_col in ('acuer', 'cexc') and not v_borrado then
          if coalesce(v_datos ->> 'cust', '') = '' or not exists
             (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'clientes' and id = (v_datos ->> 'cust') and not borrado) then
            v_motivo := 'tiene que apuntar a un cliente que exista en este comercio';
          elsif v_col = 'cexc' then
            if jsonb_typeof(v_datos -> 'max') is distinct from 'number' or (v_datos ->> 'max')::numeric <= 0
               or (v_datos ->> 'max')::numeric <> trunc((v_datos ->> 'max')::numeric) or (v_datos ->> 'max')::numeric > 100000000000 then
              v_motivo := 'monto de la excepción inválido (entero positivo en centavos)';
            elsif jsonb_typeof(v_datos -> 'until') is distinct from 'number' then
              v_motivo := 'vigencia de la excepción inválida';
            elsif length(btrim(coalesce(v_datos ->> 'reason', ''))) < 5 then
              v_motivo := 'el motivo de la excepción es obligatorio (mínimo 5 letras)';
            end if;
          else
            if coalesce(v_datos ->> 'pid', '') = '' and coalesce(v_datos ->> 'rubro', '') = '' then
              v_motivo := 'el acuerdo tiene que ser sobre un producto o un rubro';
            elsif (jsonb_typeof(v_datos -> 'price') is distinct from 'number' and jsonb_typeof(v_datos -> 'pct') is distinct from 'number') then
              v_motivo := 'el acuerdo necesita un precio o un porcentaje';
            elsif coalesce((v_datos ->> 'price')::numeric, 0) < 0 or coalesce((v_datos ->> 'price')::numeric, 0) <> trunc(coalesce((v_datos ->> 'price')::numeric, 0))
                  or coalesce((v_datos ->> 'pct')::numeric, 0) < 0 or coalesce((v_datos ->> 'pct')::numeric, 0) >= 100
                  or (coalesce((v_datos ->> 'price')::numeric, 0) > 0) = (coalesce((v_datos ->> 'pct')::numeric, 0) > 0) then
              v_motivo := 'acuerdo inválido: usá un precio entero en centavos o un porcentaje menor a 100, no ambos';
            end if;
          end if;
        end if;
        if v_motivo is null and v_col = 'cexcu' then
          if not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'cexc' and id = coalesce(v_datos ->> 'ov', '') and not borrado) then
            v_motivo := 'la excepción de crédito no existe en este comercio';
          elsif jsonb_typeof(v_datos -> 'amt') is distinct from 'number' or (v_datos ->> 'amt')::numeric <= 0
                or (v_datos ->> 'amt')::numeric <> trunc((v_datos ->> 'amt')::numeric) then
            v_motivo := 'importe de uso inválido';
          end if;
        end if;
        if v_motivo is null and v_col in ('cajas', 'sucs') and jsonb_typeof(v_datos -> 'name') is distinct from 'string' then
          v_motivo := 'falta el nombre';
        end if;

        -- V26.9 · 4.23.8 · eventos de un traspaso: recepción, diferencia, devolución y notas (sólo-agregar)
        if v_motivo is null and v_col = 'ctev' then
          declare
            w_tr   public.traspasos;
            w_k    text := v_datos ->> 'kind';
            w_amt  numeric;
            w_ses  text := coalesce(v_datos ->> 'sess', '');
            w_reg  text;
          begin
            select * into w_tr from public.traspasos where tenant_id = p_comercio and id = coalesce(v_datos ->> 'tid', '');
            if not found then
              v_motivo := 'el traspaso no existe en este comercio (esperá a que sincronice)';
            elsif w_k is null or w_k not in ('recibido', 'recibido_con_diferencia', 'devuelto', 'anotado') then
              v_motivo := 'tipo de evento inválido';
            elsif w_k = 'anotado' then
              if length(btrim(coalesce(v_datos ->> 'nota', ''))) < 3 then v_motivo := 'la nota es obligatoria (mínimo 3 letras)'; end if;
            elsif w_tr.estado_inicial <> 'en_transito' then
              v_motivo := 'este traspaso no está en tránsito';
            elsif exists (select 1 from public.traspaso_eventos where tenant_id = p_comercio and traspaso_id = w_tr.id
                             and kind in ('recibido', 'recibido_con_diferencia', 'devuelto')) then
              v_motivo := 'este traspaso ya fue resuelto';
            elsif jsonb_typeof(v_datos -> 'amt') is distinct from 'number' or (v_datos ->> 'amt')::numeric < 0
                  or (v_datos ->> 'amt')::numeric <> trunc((v_datos ->> 'amt')::numeric) then
              v_motivo := 'importe inválido (entero en centavos)';
            else
              w_amt := (v_datos ->> 'amt')::numeric;
              if w_k in ('recibido', 'devuelto') and w_amt <> w_tr.amount_cents then
                v_motivo := 'el importe tiene que ser el enviado; si difiere, registralo como «recibido con diferencia»';
              elsif w_k = 'recibido_con_diferencia' and (w_amt >= w_tr.amount_cents) then
                v_motivo := 'con diferencia el importe recibido es menor al enviado (no se acepta recibir de más)';
              elsif w_k = 'recibido_con_diferencia' and length(btrim(coalesce(v_datos ->> 'nota', ''))) < 5 then
                v_motivo := 'explicá la diferencia (mínimo 5 letras)';
              end if;
              if v_motivo is null and w_ses <> '' then
                w_reg := case when w_k = 'devuelto' then w_tr.caja_origen else w_tr.caja_destino end;
                if not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and id = w_ses
                                  and not borrado and datos ->> 'regId' = w_reg) then
                  v_motivo := 'la sesión de caja indicada no corresponde a la caja que recibe';
                end if;
              end if;
            end if;
          end;
        end if;

        -- V26.9 · 4.23.4 · detalle de un cobro digital (transferencia, tarjeta, QR): versionado, sólo-agregar, nunca un número de tarjeta
        if v_motivo is null and v_col = 'cdet' then
          declare
            w_sale  public.registros;
            w_med   text := v_datos ->> 'medio';
            w_idx   int;
            w_ver   int;
            w_prev  public.cobro_detalles;
            w_pay   jsonb := public.rave_cfg_bloque(p_comercio, 'pay');
            w_fld   jsonb;
            w_ahora numeric := extract(epoch from clock_timestamp()) * 1000;
            w_fh    numeric := coalesce(case when jsonb_typeof(v_datos -> 'fh') = 'number' then (v_datos ->> 'fh')::numeric end, 0);
            w_age   numeric := coalesce(case when (w_pay ->> 'maxAgeH') ~ '^[0-9]+$' then (w_pay ->> 'maxAgeH')::numeric end, 0);
            w_pend  boolean := coalesce((v_datos ->> 'pend')::boolean, false);
            w_key   text;
            w_ent   text;
            w_nro   text;
            w_ok    boolean;
            -- ¿el campo es obligatorio? (los no relajables siempre; el resto según la matriz del comercio, por defecto obligatorio)
            w_req   text;
          begin
            w_idx := case when (v_datos ->> 'idx') ~ '^[0-9]$' then (v_datos ->> 'idx')::int end;
            w_ver := case when (v_datos ->> 'ver') ~ '^[0-9]{1,3}$' then (v_datos ->> 'ver')::int end;
            w_fld := coalesce(w_pay -> 'detail' -> 'fields' -> w_med, '{}'::jsonb);
            select * into w_sale from public.registros where comercio_id = p_comercio and coleccion = 'ventas' and id = coalesce(v_datos ->> 'sale', '') and not borrado;
            if w_med is null or w_med not in ('transferencia', 'debito', 'credito', 'qr', 'modo') then
              v_motivo := 'medio del detalle inválido';
            elsif w_idx is null or w_ver is null or w_ver < 1 or v_id <> (v_datos ->> 'sale') || '#' || w_idx || '#' || w_ver then
              v_motivo := 'identificador del detalle inválido (venta#pago#versión)';
            elsif not found then
              v_motivo := 'la venta del detalle no existe en este comercio (esperá a que sincronice)';
            elsif jsonb_typeof(w_sale.datos -> 'pays') is distinct from 'array' or jsonb_array_length(w_sale.datos -> 'pays') <= w_idx
                  or (w_sale.datos -> 'pays' -> w_idx ->> 'm') is distinct from w_med then
              v_motivo := 'el detalle no corresponde al medio de pago de esa venta';
            elsif coalesce(v_datos ->> 'st', 'declarado') <> 'declarado' then
              v_motivo := 'un cobro cargado a mano queda «declarado»: sólo una integración verificada lo acredita';
            elsif v_datos ? 'ordName' or v_datos ? 'ordDoc' or v_datos ? 'ord' then
              v_motivo := 'el titular ordenante viaja cifrado: no se acepta en claro';
            elsif public.rave_json_tiene_pan(v_datos) then
              v_motivo := 'un campo parece un número de tarjeta completo: nunca se guarda (sólo los últimos 4 dígitos)';
            elsif w_fh > w_ahora + 300000 then
              v_motivo := 'la fecha y hora del comprobante está en el futuro';
            elsif w_age > 0 and w_fh > 0 and w_fh < w_ahora - w_age * 3600000 then
              v_motivo := 'el comprobante es más viejo que lo permitido (' || w_age || ' h)';
            elsif w_ver > 1 and not (v_rol in ('admin', 'supervisor') or exists
                   (select 1 from public.cobro_detalles where tenant_id = p_comercio and sale_id = (v_datos ->> 'sale') and pay_idx = w_idx and created_by = v_uid)) then
              v_motivo := 'sólo el administrador, el supervisor o quien cobró completan el detalle';
            else
              select * into w_prev from public.cobro_detalles where tenant_id = p_comercio and sale_id = (v_datos ->> 'sale') and pay_idx = w_idx
                order by version desc limit 1;
              if w_ver > 1 and (not found or w_prev.version <> w_ver - 1) then
                v_motivo := 'falta la versión anterior del detalle';
              elsif w_ver = 1 and found then
                v_motivo := 'ya hay un detalle para ese pago: la corrección es una versión nueva';
              end if;
            end if;
            -- campos por medio
            if v_motivo is null then
              if w_med = 'transferencia' then
                w_req := coalesce(w_fld ->> 'ent', 'obligatorio');
                if (w_req = 'obligatorio' and not w_pend and length(btrim(coalesce(v_datos ->> 'ent', ''))) not between 2 and 60)
                   or (coalesce(v_datos ->> 'ent', '') <> '' and length(btrim(v_datos ->> 'ent')) not between 2 and 60) then
                  v_motivo := 'banco o entidad de origen inválido (2 a 60 caracteres)';
                end if;
                if v_motivo is null and coalesce(w_fld ->> 'dest', 'obligatorio') = 'obligatorio' and not w_pend and length(btrim(coalesce(v_datos ->> 'dest', ''))) not between 2 and 60 then
                  v_motivo := 'falta la cuenta de destino';
                end if;
                if v_motivo is null and coalesce(v_datos ->> 'nro', '') !~ '^[A-Za-z0-9]{6,40}$' then
                  v_motivo := 'el N.º de comprobante/operación es obligatorio (6 a 40 letras o números) y no se puede omitir';
                end if;
                if v_motivo is null and w_fh = 0 and coalesce(w_fld ->> 'fh', 'obligatorio') = 'obligatorio' and not w_pend then
                  v_motivo := 'falta la fecha y hora de la transferencia';
                end if;
                w_ent := lower(btrim(coalesce(v_datos ->> 'ent', '')));
                w_nro := lower(v_datos ->> 'nro');
                w_key := 'transferencia|' || w_ent || '|' || w_nro;
              elsif w_med in ('debito', 'credito') then
                if (v_datos ->> 'kind') is distinct from w_med then
                  v_motivo := 'el tipo de tarjeta no coincide con el medio de pago';
                elsif coalesce(v_datos ->> 'auth', '') !~ '^[A-Za-z0-9]{4,12}$' then
                  v_motivo := 'el código de autorización es obligatorio (4 a 12 letras o números) y no se puede omitir';
                elsif coalesce(v_datos ->> 'last4', '') !~ '^[0-9]{4}$' then
                  v_motivo := 'los últimos 4 dígitos de la tarjeta son exactamente 4 números';
                elsif jsonb_typeof(v_datos -> 'cuotas') is distinct from 'number' or (v_datos ->> 'cuotas')::numeric <> trunc((v_datos ->> 'cuotas')::numeric)
                      or (v_datos ->> 'cuotas')::numeric < 1 or (v_datos ->> 'cuotas')::numeric > 60 or (w_med = 'debito' and (v_datos ->> 'cuotas')::numeric <> 1) then
                  v_motivo := 'cuotas inválidas (entero de 1 a 60; el débito es 1)';
                elsif not w_pend and coalesce(w_fld ->> 'brand', 'obligatorio') = 'obligatorio' and length(btrim(coalesce(v_datos ->> 'brand', ''))) not between 2 and 30 then
                  v_motivo := 'falta la marca de la tarjeta';
                elsif not w_pend and coalesce(w_fld ->> 'cupon', 'obligatorio') = 'obligatorio' and coalesce(v_datos ->> 'cupon', '') !~ '^[A-Za-z0-9]{1,20}$' then
                  v_motivo := 'falta el N.º de cupón / lote / terminal (1 a 20 letras o números)';
                end if;
                w_key := null;
              else
                if coalesce(v_datos ->> 'txid', '') !~ '^[A-Za-z0-9]{4,60}$' then
                  v_motivo := 'el ID de transacción del proveedor es obligatorio (4 a 60 letras o números) y no se puede omitir';
                elsif not w_pend and coalesce(w_fld ->> 'prov', 'obligatorio') = 'obligatorio' and length(btrim(coalesce(v_datos ->> 'prov', ''))) not between 2 and 40 then
                  v_motivo := 'falta el proveedor del cobro (Mercado Pago, MODO…)';
                end if;
                w_ent := lower(btrim(coalesce(v_datos ->> 'prov', '')));
                w_nro := lower(v_datos ->> 'txid');
                w_key := 'qr|' || w_ent || '|' || w_nro;
              end if;
            end if;
            -- excepción «cobro sin comprobante»: la autoriza un supervisor/administrador con motivo
            if v_motivo is null and w_pend then
              if length(btrim(coalesce(v_datos -> 'exc' ->> 'reason', ''))) < 5 or coalesce(v_datos -> 'exc' ->> 'by', '') !~ '^[0-9a-fA-F-]{36}$'
                 or not exists (select 1 from public.miembros where comercio_id = p_comercio and usuario_id = (v_datos -> 'exc' ->> 'by')::uuid and rol in ('admin', 'supervisor')) then
                v_motivo := 'el cobro sin comprobante necesita un supervisor o administrador y un motivo';
              end if;
            end if;
            -- duplicados: el N.º de operación / ID de transacción no se repite salvo autorización con motivo
            if v_motivo is null and w_key is not null then
              if w_ver > 1 and w_prev.clave_unica is not null and w_prev.clave_unica = w_key then
                w_key := null;                                    -- misma clave que la versión anterior: la sigue reservando esa versión
              elsif w_ver > 1 and lower(coalesce(w_prev.nro_operacion, '')) = coalesce(w_nro, '') and lower(btrim(coalesce(w_prev.entidad, ''))) = w_ent then
                w_key := null;                                    -- ya estaba autorizada como repetida
              elsif exists (select 1 from public.cobro_detalles where tenant_id = p_comercio and clave_unica = w_key
                               and not (sale_id = (v_datos ->> 'sale') and pay_idx = w_idx)) then
                if length(btrim(coalesce(v_datos -> 'dupAuth' ->> 'reason', ''))) >= 5 and coalesce(v_datos -> 'dupAuth' ->> 'by', '') ~ '^[0-9a-fA-F-]{36}$'
                   and exists (select 1 from public.miembros where comercio_id = p_comercio and usuario_id = (v_datos -> 'dupAuth' ->> 'by')::uuid and rol in ('admin', 'supervisor')) then
                  w_key := null;
                else
                  v_motivo := 'ese N.º de operación / ID de transacción ya fue cargado en otro cobro: sólo un supervisor lo autoriza, con motivo';
                end if;
              end if;
            end if;
            if v_motivo is null then
              v_datos := v_datos || jsonb_build_object('_ck', w_key);   -- clave única calculada por el servidor (se usa al insertar)
            end if;
          end;
        end if;

        -- V26.9 · 4.24 · clientes del Club: baja y eliminación sólo del administrador, sin historial ni deuda, sin resucitar
        if v_motivo is null and v_col = 'clientes' then
          declare
            w_adm  boolean := v_rol = 'admin' or public.rave_tiene_permiso(p_comercio, v_uid, 'customers_admin');
            w_old  jsonb := case when v_hay then v_prev.datos else '{}'::jsonb end;
            w_deu  numeric;
            w_hist text;
            w_mode text;
            w_grant boolean;
          begin
            if v_hay and v_prev.borrado and not v_borrado then
              v_motivo := 'ese cliente fue eliminado por el administrador: no se vuelve a cargar';
            elsif v_borrado then
              if not w_adm then
                v_motivo := 'sólo el administrador elimina clientes';
              elsif v_hay and not v_prev.borrado then
                select string_agg(x, ', ') into w_hist from (
                  select 'ventas' x where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'ventas' and not borrado and datos ->> 'cust' = v_id)
                  union all select 'cuenta corriente' where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'fiado' and not borrado and datos ->> 'cust' = v_id)
                  union all select 'cupones usados' where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'cusos' and not borrado and datos ->> 'cust' = v_id)
                  union all select 'membresías' where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'membs' and not borrado and datos ->> 'cust' = v_id)
                  union all select 'sellos o canjes' where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'sellos' and not borrado and datos ->> 'cust' = v_id)
                  union all select 'excepciones o acuerdos' where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion in ('cexc', 'acuer') and not borrado and datos ->> 'cust' = v_id)
                ) q;
                w_deu := public.rave_deuda_cliente(p_comercio, v_id);
                if w_hist is not null then
                  v_motivo := 'tiene historial (' || w_hist || '): sólo se puede dar de baja';
                elsif w_deu > 0 then
                  v_motivo := 'tiene deuda en cuenta corriente: no se elimina';
                end if;
              end if;
            else
              if coalesce(v_datos ->> 'status', '') = 'baja' and coalesce(w_old ->> 'status', '') <> 'baja' then
                if not w_adm then
                  v_motivo := 'sólo el administrador da de baja a un cliente';
                else
                  w_deu := public.rave_deuda_cliente(p_comercio, v_id);
                  w_mode := v_datos -> 'debtDec' ->> 'mode';
                  if w_deu > 0 and (w_mode is distinct from 'mantener' or length(btrim(coalesce(v_datos -> 'debtDec' ->> 'reason', ''))) < 5) then
                    v_motivo := 'tiene deuda en cuenta corriente: cobrala, condonala con un movimiento y motivo, o decidí mantenerla (con motivo)';
                  end if;
                end if;
              elsif coalesce(w_old ->> 'status', '') = 'baja' and coalesce(v_datos ->> 'status', '') <> 'baja' and not w_adm then
                v_motivo := 'un cliente dado de baja sólo lo reactiva el administrador';
              end if;
              if v_motivo is null and v_hay and not w_adm then
                if coalesce(v_datos ->> 'channel', '') is distinct from coalesce(w_old ->> 'channel', '')
                   or coalesce(v_datos ->> 'term', '') is distinct from coalesce(w_old ->> 'term', '')
                   or coalesce(v_datos ->> 'zone', '') is distinct from coalesce(w_old ->> 'zone', '')
                   or coalesce(v_datos ->> 'seller', '') is distinct from coalesce(w_old ->> 'seller', '') then
                  v_motivo := 'los datos mayoristas (canal, plazo, zona, vendedor) los cambia el administrador';
                elsif coalesce(v_datos ->> 'pfp', '') is distinct from coalesce(w_old ->> 'pfp', '') and coalesce(w_old ->> 'pfp', '') <> '' then
                  v_motivo := 'WhatsApp, correo, DNI, nacimiento y CUIT del cliente los cambia el administrador';
                end if;
              end if;
              if v_motivo is null and v_hay then
                w_grant := (coalesce((v_datos -> 'consent' ->> 'comm')::boolean, false) and not coalesce((w_old -> 'consent' ->> 'comm')::boolean, false))
                           or (coalesce((v_datos -> 'consent' ->> 'analytics')::boolean, false) and not coalesce((w_old -> 'consent' ->> 'analytics')::boolean, false));
                if w_grant and not w_adm then
                  v_motivo := 'otorgar un consentimiento lo registra el administrador, con la constancia del titular';
                elsif w_grant and length(btrim(coalesce(v_datos -> 'consent' ->> 'proof', ''))) < 10 then
                  v_motivo := 'otorgar un consentimiento exige la constancia (cómo y cuándo lo dio el titular, mínimo 10 letras)';
                end if;
              end if;
              if v_motivo is null and v_rol in ('mostrador', 'operador') and not w_adm
                 and coalesce((v_datos ->> 'limit')::numeric, 0) is distinct from coalesce((w_old ->> 'limit')::numeric, 0) then
                v_motivo := 'el límite de crédito lo cambia el administrador';
              end if;
            end if;
          end;
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
        elsif v_col = 'ctransf' and coalesce(case when jsonb_typeof(v_datos -> 'v') = 'number' then (v_datos ->> 'v')::int end, 0) = 2 then
          -- V26.9 · comprobante de traspaso v2: el servidor asigna el número consecutivo por caja de origen, la hora oficial y la cadena de hash
          perform pg_advisory_xact_lock(hashtextextended('xfer-n:' || p_comercio::text || ':' || (v_datos ->> 'from'), 12));
          select coalesce(max(n), 0) + 1 into v_n from public.traspasos where tenant_id = p_comercio and caja_origen = (v_datos ->> 'from');
          select coalesce(nullif(datos ->> 'code', ''), left(id, 12)) into v_code from public.registros
           where comercio_id = p_comercio and coleccion = 'cajas' and id = (v_datos ->> 'from');
          select coalesce(datos ->> 'name', '') into v_rn from public.registros
           where comercio_id = p_comercio and coleccion = 'rubros' and id = (v_datos ->> 'rubro');
          v_num := 'T-' || v_code || '-' || v_n;
          v_estado := case when v_datos ->> 'toState' = 'cerrada' then 'en_transito' else 'completado' end;
          v_datos := v_datos || jsonb_build_object('n', v_n, 'num', v_num, 'state', v_estado, 'uid', v_uid::text, 'rubroName', v_rn);
          insert into public.traspasos (tenant_id, id, caja_origen, caja_destino, n, num, amount_cents, currency, rubro_id, rubro_nombre, motivo,
                                        emisor_id, emisor_nombre, autorizante_id, autorizante_nombre, auth_metodo, suc_origen, suc_destino,
                                        estado_caja_origen, estado_caja_destino, ref_origen, ref_destino, estado_inicial, rev_of,
                                        ts_equipo, hora_desfasada, datos)
          values (p_comercio, v_id, v_datos ->> 'from', v_datos ->> 'to', v_n, v_num, (v_datos ->> 'amount')::bigint, 'ARS', v_datos ->> 'rubro', v_rn,
                  btrim(v_datos ->> 'motivo'), v_uid, coalesce(public.rave_nombre_usuario(p_comercio), left(v_datos ->> 'user', 80)),
                  (v_datos -> 'auth' ->> 'id')::uuid, left(v_datos -> 'auth' ->> 'name', 80), v_datos -> 'auth' ->> 'method',
                  (select datos ->> 'branchId' from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and id = (v_datos ->> 'from')),
                  (select datos ->> 'branchId' from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and id = (v_datos ->> 'to')),
                  v_datos ->> 'fromState', v_datos ->> 'toState',
                  left(coalesce(nullif(v_datos ->> 'fromSess', ''), v_datos ->> 'fromRef'), 80), left(coalesce(nullif(v_datos ->> 'toSess', ''), v_datos ->> 'toRef'), 80),
                  v_estado, nullif(v_datos ->> 'rev', ''),
                  case when jsonb_typeof(v_datos -> 'ts') = 'number' then to_timestamp((v_datos ->> 'ts')::numeric / 1000.0) end,
                  case when jsonb_typeof(v_datos -> 'ts') = 'number' then abs((v_datos ->> 'ts')::numeric - extract(epoch from clock_timestamp()) * 1000) > 600000 else true end,
                  v_datos)
          returning seq, hash, ts_servidor into v_seq, v_hs, v_tss;
          v_datos := v_datos || jsonb_build_object('sseq', v_seq, 'sh', v_hs, 'tss', (extract(epoch from v_tss) * 1000)::bigint);
          insert into public.traspaso_eventos (tenant_id, id, traspaso_id, kind, usuario_id, usuario_nombre, ts_equipo)
          values (p_comercio, 'srv-' || gen_random_uuid()::text, v_id, 'emitido', v_uid, coalesce(public.rave_nombre_usuario(p_comercio), '?'),
                  case when jsonb_typeof(v_datos -> 'ts') = 'number' then to_timestamp((v_datos ->> 'ts')::numeric / 1000.0) end);
          if v_estado = 'en_transito' then
            insert into public.traspaso_eventos (tenant_id, id, traspaso_id, kind, usuario_id, usuario_nombre)
            values (p_comercio, 'srv-' || gen_random_uuid()::text, v_id, 'en_transito', v_uid, coalesce(public.rave_nombre_usuario(p_comercio), '?'));
          end if;
          if coalesce(v_datos ->> 'rev', '') <> '' then
            insert into public.traspaso_eventos (tenant_id, id, traspaso_id, kind, nota, usuario_id, usuario_nombre)
            values (p_comercio, 'srv-' || gen_random_uuid()::text, v_datos ->> 'rev', 'revertido', 'reversa ' || v_num, v_uid, coalesce(public.rave_nombre_usuario(p_comercio), '?'));
          end if;
        elsif v_col = 'ctev' then
          insert into public.traspaso_eventos (tenant_id, id, traspaso_id, kind, amount_cents, nota, sess, usuario_id, usuario_nombre, ts_equipo, datos)
          values (p_comercio, v_id, v_datos ->> 'tid', v_datos ->> 'kind',
                  case when v_datos ->> 'kind' <> 'anotado' then (v_datos ->> 'amt')::bigint end,
                  left(btrim(coalesce(v_datos ->> 'nota', '')), 300), nullif(v_datos ->> 'sess', ''), v_uid,
                  coalesce(public.rave_nombre_usuario(p_comercio), '?'),
                  case when jsonb_typeof(v_datos -> 'ts') = 'number' then to_timestamp((v_datos ->> 'ts')::numeric / 1000.0) end, v_datos)
          returning seq, hash, ts_servidor into v_seq, v_hs, v_tss;
          v_datos := v_datos || jsonb_build_object('uid', v_uid::text, 'sseq', v_seq, 'sh', v_hs, 'tss', (extract(epoch from v_tss) * 1000)::bigint);
        elsif v_col = 'cdet' then
          v_ck := v_datos ->> '_ck';
          v_datos := v_datos - '_ck';
          insert into public.cobro_detalles (tenant_id, id, sale_id, pay_idx, version, medio, estado, entidad, nro_operacion, clave_unica,
                                             pendiente, excepcion, duplicado_ok, created_by, ts_equipo, datos)
          values (p_comercio, v_id, v_datos ->> 'sale', (v_datos ->> 'idx')::int, (v_datos ->> 'ver')::int, v_datos ->> 'medio', 'declarado',
                  left(coalesce(nullif(v_datos ->> 'ent', ''), nullif(v_datos ->> 'prov', ''), v_datos ->> 'brand'), 60),
                  left(coalesce(nullif(v_datos ->> 'nro', ''), nullif(v_datos ->> 'txid', ''), v_datos ->> 'auth'), 60), v_ck,
                  coalesce((v_datos ->> 'pend')::boolean, false), v_datos -> 'exc', v_datos -> 'dupAuth', v_uid,
                  case when jsonb_typeof(v_datos -> 'ts') = 'number' then to_timestamp((v_datos ->> 'ts')::numeric / 1000.0) end, v_datos)
          returning seq, hash, ts_servidor into v_seq, v_hs, v_tss;
          v_datos := v_datos || jsonb_build_object('uid', v_uid::text, 'sseq', v_seq, 'sh', v_hs, 'tss', (extract(epoch from v_tss) * 1000)::bigint);
        elsif v_col = 'prod' then
          -- el stock lo manda el servidor, nunca el navegador
          v_datos := v_datos - 'stock';
          v_datos := v_datos || jsonb_build_object('stock', case when v_hay then coalesce(v_prev.datos -> 'stock', '0'::jsonb) else '0'::jsonb end);
        elsif v_col = 'ventas' then
          -- el CAE lo escribe sólo el servidor fiscal: el navegador no lo puede pisar ni inventar
          v_datos := v_datos - 'arca' - 'arcaNC';
          if v_hay then
            -- V26.1 · una venta con pagos registrados no cambia sus importes ni su cliente (se corrige con anulación / nota de crédito)
            if v_prev.datos ? 'pays' then
              v_datos := (v_datos - 'pays' - 'fiadoAmt' - 'paid' - 'balance' - 'vuelto' - 'recv' - 'total' - 'items' - 'cust' - 'custName' - 'method' - 'pstate' - 'fiado')
                         || jsonb_strip_nulls(jsonb_build_object('pays', v_prev.datos -> 'pays', 'fiadoAmt', v_prev.datos -> 'fiadoAmt',
                            'paid', v_prev.datos -> 'paid', 'balance', v_prev.datos -> 'balance', 'vuelto', v_prev.datos -> 'vuelto',
                            'recv', v_prev.datos -> 'recv', 'total', v_prev.datos -> 'total', 'items', v_prev.datos -> 'items',
                            'cust', v_prev.datos -> 'cust', 'custName', v_prev.datos -> 'custName', 'method', v_prev.datos -> 'method',
                            'pstate', v_prev.datos -> 'pstate', 'fiado', v_prev.datos -> 'fiado'));
            end if;
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
          -- V26.9 · las banderas de traspasos y de detalle de cobros las cambia sólo el administrador
          if v_id = 'cfg' and v_rol <> 'admin' then
            v_datos := v_datos - 'xfer' - 'pay';
            if v_hay then
              v_datos := v_datos || jsonb_strip_nulls(jsonb_build_object('xfer', v_prev.datos -> 'xfer', 'pay', v_prev.datos -> 'pay'));
            end if;
          end if;
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
        if v_col = 'prod' and v_borrado then
          v_aid := 'srv-' || gen_random_uuid()::text;
          insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
          values (p_comercio, 'audit', v_aid,
                  jsonb_build_object('id', v_aid, 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint,
                                     'user', coalesce(public.mi_email(), '?'), 'action', 'INV_ELIMINAR_SERVIDOR',
                                     'detail', 'artículo ' || v_id || ' eliminado (sin historial)', 'dev', left(p_dispositivo, 40)),
                  false, left(p_dispositivo, 40), auth.uid(), clock_timestamp())
          on conflict do nothing;
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

-- ===== 12-pago-proveedor-cajas.sql =====
-- =====================================================================
-- 12 · V26.12 · Pago a proveedor repartido entre varias cajas (caja principal + operativas)
-- Aditivo e idempotente. Un solo evento de negocio (el Pago del libro) con asignaciones por caja que suman EXACTAMENTE el pago;
-- cada asignación crea su egreso de caja con el mismo rubro. Todo o nada. Sin `asignaciones` el comportamiento es el de siempre.
-- =====================================================================
create table if not exists public.pagos_proveedor_asignaciones (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.comercios(id) on delete restrict,
  pago_id            uuid not null references public.cuenta_corriente_proveedores(id) on delete restrict,
  proveedor_id       uuid not null references public.proveedores(id) on delete restrict,
  turno_id           text not null,
  monto              numeric(14,2) not null check (monto > 0),
  movimiento_caja_id text not null,
  created_at         timestamptz not null default now(),
  created_by         uuid
);
create index if not exists pagos_asig_pago on public.pagos_proveedor_asignaciones (tenant_id, pago_id);
alter table public.pagos_proveedor_asignaciones enable row level security;
drop policy if exists pagos_asig_leer on public.pagos_proveedor_asignaciones;
create policy pagos_asig_leer on public.pagos_proveedor_asignaciones for select to authenticated using (public.rol_en(tenant_id) in ('admin', 'supervisor'));
revoke all on public.pagos_proveedor_asignaciones from anon, authenticated;
grant select on public.pagos_proveedor_asignaciones to authenticated;
drop trigger if exists pagos_asig_solo_agregar on public.pagos_proveedor_asignaciones;
create trigger pagos_asig_solo_agregar before update or delete on public.pagos_proveedor_asignaciones for each row execute function public.rave_solo_agregar();

create or replace function public.proveedor_pago_registrar(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prov public.proveedores; v_key text; v_monto numeric; v_medio text; v_rubro text; v_turno text; v_ref text; v_saldo numeric(14,2); v_mov text; v_ex public.cuenta_corriente_proveedores; v_id uuid; v_asig jsonb; v_a jsonb; v_suma bigint := 0; v_cen bigint; v_movs jsonb := '[]'::jsonb; v_m text; v_tid text; v_vistos text[] := array[]::text[];
begin
  perform public.rave_compras_acceso(p_comercio);
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'datos inválidos'; end if;
  v_key := public.rave_txt(p, 'idempotency_key');
  if v_key is null or length(v_key) not between 8 and 80 then raise exception 'falta idempotency_key (8 a 80 caracteres)'; end if;
  select * into v_prov from public.proveedores where id = public.rave_uuid(p ->> 'proveedor_id') and tenant_id = p_comercio and deleted_at is null for update;
  if not found then raise exception 'el proveedor no existe en este comercio'; end if;
  select * into v_ex from public.cuenta_corriente_proveedores where tenant_id = p_comercio and idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'repetido', true, 'movimiento_id', v_ex.id, 'monto', v_ex.monto, 'saldo_proveedor', v_prov.saldo_cuenta_corriente);
  end if;
  v_monto := public.rave_num(p, 'monto'); v_medio := public.rave_txt(p, 'medio_pago'); v_rubro := public.rave_txt(p, 'rubro_id'); v_turno := public.rave_txt(p, 'turno_id');
  v_ref := left(public.rave_txt(p, 'referencia'), 80);
  if v_monto is null or v_monto <= 0 or v_monto > 100000000000 or v_monto <> round(v_monto, 2) then raise exception 'el monto debe ser mayor a cero, con hasta 2 decimales'; end if;
  if v_monto > v_prov.saldo_cuenta_corriente then raise exception 'el pago (%) supera la deuda con el proveedor (%)', v_monto, v_prov.saldo_cuenta_corriente; end if;
  if v_medio is null or v_medio not in ('efectivo', 'transferencia', 'cheque', 'tarjeta') then raise exception 'indicá el medio de pago (efectivo, transferencia, cheque o tarjeta)'; end if;
  if v_rubro is null then raise exception 'el rubro es obligatorio para todo movimiento de dinero'; end if;
  if not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = v_rubro and not borrado and coalesce(datos ->> 'kind', '') <> 'cobr') then
    raise exception 'el rubro elegido no existe en este comercio o no admite egresos'; end if;
  v_asig := p -> 'asignaciones';
  if v_asig is not null and jsonb_typeof(v_asig) <> 'null' then
    -- V26.12 · pago repartido entre varias cajas (p. ej. desde la caja principal y otras operativas): UN solo evento de negocio
    if v_medio <> 'efectivo' then raise exception 'el reparto entre cajas sólo corresponde a pagos en efectivo'; end if;
    if jsonb_typeof(v_asig) <> 'array' or jsonb_array_length(v_asig) not between 1 and 20 then raise exception 'asignaciones inválidas (1 a 20 cajas)'; end if;
    for v_a in select * from jsonb_array_elements(v_asig) loop
      v_tid := public.rave_txt(v_a, 'turno_id');
      v_cen := round(public.rave_num(v_a, 'monto') * 100)::bigint;
      if v_tid is null or v_cen is null or v_cen <= 0 or public.rave_num(v_a, 'monto') <> round(public.rave_num(v_a, 'monto'), 2) then raise exception 'cada caja del reparto necesita turno e importe mayor a cero'; end if;
      if v_tid = any(v_vistos) then raise exception 'una misma caja no puede repetirse en el reparto'; end if;
      v_vistos := v_vistos || v_tid; v_suma := v_suma + v_cen;
    end loop;
    if v_suma <> round(v_monto * 100)::bigint then raise exception 'el reparto entre cajas (%) no suma el pago (%)', v_suma / 100.0, v_monto; end if;
    for v_a in select * from jsonb_array_elements(v_asig) loop
      v_m := public.rave_mov_caja(p_comercio, public.rave_txt(v_a, 'turno_id'), v_rubro, 'Pago a proveedor ' || v_prov.razon_social || coalesce(' · ' || v_ref, ''),
                                  round(public.rave_num(v_a, 'monto') * 100)::bigint, 'pago');
      v_movs := v_movs || jsonb_build_object('turno_id', public.rave_txt(v_a, 'turno_id'), 'monto', public.rave_num(v_a, 'monto'), 'movimiento_caja_id', v_m);
    end loop;
  elsif v_medio = 'efectivo' then
    v_mov := public.rave_mov_caja(p_comercio, v_turno, v_rubro, 'Pago a proveedor ' || v_prov.razon_social || coalesce(' · ' || v_ref, ''), round(v_monto * 100)::bigint, 'pago');
  end if;
  v_saldo := round(v_prov.saldo_cuenta_corriente - v_monto, 2);
  insert into public.cuenta_corriente_proveedores (tenant_id, proveedor_id, tipo_movimiento, monto, saldo_acumulado, referencia, medio_pago, rubro_id, movimiento_caja_id, idempotency_key, created_by)
  values (p_comercio, v_prov.id, 'Pago', v_monto, v_saldo, v_ref, v_medio, v_rubro, v_mov, v_key, auth.uid()) returning id into v_id;
  update public.proveedores set saldo_cuenta_corriente = v_saldo, updated_at = now() where id = v_prov.id;
  if jsonb_array_length(v_movs) > 0 then
    insert into public.pagos_proveedor_asignaciones (tenant_id, pago_id, proveedor_id, turno_id, monto, movimiento_caja_id, created_by)
    select p_comercio, v_id, v_prov.id, x ->> 'turno_id', (x ->> 'monto')::numeric(14,2), x ->> 'movimiento_caja_id', auth.uid() from jsonb_array_elements(v_movs) x;
  end if;
  perform public.rave_auditar(p_comercio, 'PROVEEDOR_PAGO', v_prov.razon_social || ' · ' || v_monto || ' · ' || v_medio || case when jsonb_array_length(v_movs) > 0 then ' · repartido en ' || jsonb_array_length(v_movs) || ' cajas' else '' end);
  return jsonb_build_object('ok', true, 'repetido', false, 'movimiento_id', v_id, 'monto', v_monto, 'saldo_proveedor', v_saldo, 'movimiento_caja_id', v_mov, 'asignaciones', v_movs);
exception when unique_violation then
  select * into v_ex from public.cuenta_corriente_proveedores where tenant_id = p_comercio and idempotency_key = v_key;
  if found then return jsonb_build_object('ok', true, 'repetido', true, 'movimiento_id', v_ex.id, 'monto', v_ex.monto); end if;
  raise;
end $$;


revoke all on function public.proveedor_pago_registrar(uuid, jsonb) from public, anon;
grant execute on function public.proveedor_pago_registrar(uuid, jsonb) to authenticated;

-- ===== 13-tiendanube.sql =====
-- =====================================================================
-- 13 · V26.13 · Integración con Tiendanube (Nuvemshop)  — aditiva e idempotente
-- Todo el trato con Tiendanube lo hace la Edge Function "tiendanube" (servidor):
-- el navegador NUNCA ve el token de acceso ni el secreto de la app.
--   tn_conexion        1 por comercio: tienda conectada, token CIFRADO (AES-GCM con un secreto de la función),
--                      configuración. SIN políticas: ningún usuario la lee por la API.
--   tn_estados_oauth   "state" de un solo uso (guardado como hash) para el flujo OAuth.
--   tn_productos       espejo de variantes de Tiendanube + vínculo con el producto del sistema.
--   tn_ordenes         espejo de órdenes con estados SEPARADOS (orden / pago / envío). Una orden nunca retrocede.
--   tn_eventos         bitácora sólo-agregar de webhooks y de la sincronización (sin cuerpos ni datos personales).
-- Apagada por defecto: nada se conecta hasta que el administrador autoriza la app en Tiendanube.
-- =====================================================================
create table if not exists public.tn_conexion (
  comercio_id   uuid primary key references public.comercios(id) on delete cascade,
  store_id      bigint,
  token_cifrado text,
  scope         text,
  estado        text not null default 'desconectada' check (estado in ('desconectada','conectada','revocada','error')),
  config        jsonb not null default '{}'::jsonb,
  conectado_por uuid,
  conectado_en  timestamptz,
  ultima_sync   timestamptz,
  ultimo_error  text,
  actualizado   timestamptz not null default now()
);
create unique index if not exists tn_conexion_tienda on public.tn_conexion (store_id) where store_id is not null and estado = 'conectada';
alter table public.tn_conexion enable row level security;
revoke all on public.tn_conexion from anon, authenticated;

create table if not exists public.tn_estados_oauth (
  state_hash  text primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  usuario     uuid,
  vence       timestamptz not null,
  usado       boolean not null default false,
  creado      timestamptz not null default now()
);
alter table public.tn_estados_oauth enable row level security;
revoke all on public.tn_estados_oauth from anon, authenticated;

create table if not exists public.tn_productos (
  comercio_id    uuid not null references public.comercios(id) on delete cascade,
  variant_id     bigint not null,
  product_id     bigint not null,
  sku            text,
  barcode        text,
  nombre         text not null default '',
  precio_cents   bigint check (precio_cents is null or precio_cents >= 0),
  stock          numeric(14,3),                       -- null = stock ilimitado en Tiendanube
  producto_local text,                                -- id del producto en el sistema
  vinculo        text not null default 'sin_vincular' check (vinculo in ('sin_vincular','sugerido','vinculado','ignorado')),
  tn_actualizado timestamptz,
  sincronizado   timestamptz not null default now(),
  primary key (comercio_id, variant_id)
);
create unique index if not exists tn_productos_local on public.tn_productos (comercio_id, producto_local) where vinculo = 'vinculado' and producto_local is not null;
create index if not exists tn_productos_estado on public.tn_productos (comercio_id, vinculo);
alter table public.tn_productos enable row level security;
drop policy if exists tn_productos_leer on public.tn_productos;
create policy tn_productos_leer on public.tn_productos for select to authenticated using (public.rol_en(comercio_id) in ('admin','supervisor'));
revoke all on public.tn_productos from anon, authenticated;
grant select on public.tn_productos to authenticated;

create table if not exists public.tn_ordenes (
  comercio_id    uuid not null references public.comercios(id) on delete cascade,
  orden_id       bigint not null,
  numero         bigint,
  estado         text not null default 'open',          -- open / closed / cancelled
  pago_estado    text not null default 'pending',       -- pending / authorized / paid / partially_paid / abandoned / refunded / partially_refunded / voided
  envio_estado   text not null default 'unshipped',     -- unpacked / unshipped / partially_packed / shipped / delivered ...
  total_cents    bigint not null default 0 check (total_cents >= 0),
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  descuento_cents bigint not null default 0 check (descuento_cents >= 0),
  envio_cents    bigint not null default 0 check (envio_cents >= 0),
  moneda         text not null default 'ARS',
  medio_pago     text,
  cliente        jsonb not null default '{}'::jsonb,    -- nombre / correo / teléfono: sólo admin y supervisor
  items          jsonb not null default '[]'::jsonb,    -- [{variant_id, product_id, nombre, sku, qty, precio_cents, producto_local}]
  nota           text,
  tn_creada      timestamptz,
  tn_actualizada timestamptz,
  venta_local    text,                                  -- id de la venta registrada en el sistema
  venta_estado   text not null default 'pendiente' check (venta_estado in ('pendiente','registrada','ignorada')),
  recibida       timestamptz not null default now(),
  primary key (comercio_id, orden_id)
);
create index if not exists tn_ordenes_lista on public.tn_ordenes (comercio_id, venta_estado, tn_creada desc);
alter table public.tn_ordenes enable row level security;
drop policy if exists tn_ordenes_leer on public.tn_ordenes;
create policy tn_ordenes_leer on public.tn_ordenes for select to authenticated using (public.rol_en(comercio_id) in ('admin','supervisor'));
revoke all on public.tn_ordenes from anon, authenticated;
grant select on public.tn_ordenes to authenticated;

create table if not exists public.tn_eventos (
  id          bigserial primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  evento      text not null check (length(evento) <= 80),
  recurso_id  bigint,
  resultado   text not null check (resultado in ('ok','duplicado','ignorado','rechazado','error')),
  detalle     text check (detalle is null or length(detalle) <= 300),
  creado      timestamptz not null default now()
);
create index if not exists tn_eventos_lista on public.tn_eventos (comercio_id, id desc);
alter table public.tn_eventos enable row level security;
drop policy if exists tn_eventos_leer on public.tn_eventos;
create policy tn_eventos_leer on public.tn_eventos for select to authenticated using (public.rol_en(comercio_id) in ('admin','supervisor'));
revoke all on public.tn_eventos from anon, authenticated;
grant select on public.tn_eventos to authenticated;
drop trigger if exists tn_eventos_solo_agregar on public.tn_eventos;
create trigger tn_eventos_solo_agregar before update or delete on public.tn_eventos for each row execute function public.rave_solo_agregar();

-- ---------------------------------------------------------------------
-- Estado visible para el equipo (sin token, sin secretos)
-- ---------------------------------------------------------------------
create or replace function public.tn_estado(p_comercio uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.tn_conexion; r text := public.rol_en(p_comercio);
begin
  if r is null or r not in ('admin','supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  select * into c from public.tn_conexion where comercio_id = p_comercio;
  return jsonb_build_object('ok', true,
    'estado', coalesce(c.estado, 'desconectada'), 'store_id', c.store_id, 'scope', c.scope, 'config', coalesce(c.config, '{}'::jsonb),
    'conectado_en', c.conectado_en, 'ultima_sync', c.ultima_sync, 'ultimo_error', c.ultimo_error,
    'productos', jsonb_build_object(
       'total', (select count(*) from public.tn_productos where comercio_id = p_comercio),
       'vinculados', (select count(*) from public.tn_productos where comercio_id = p_comercio and vinculo = 'vinculado'),
       'sugeridos', (select count(*) from public.tn_productos where comercio_id = p_comercio and vinculo = 'sugerido'),
       'sin_vincular', (select count(*) from public.tn_productos where comercio_id = p_comercio and vinculo = 'sin_vincular')),
    'ordenes', jsonb_build_object(
       'total', (select count(*) from public.tn_ordenes where comercio_id = p_comercio),
       'pendientes', (select count(*) from public.tn_ordenes where comercio_id = p_comercio and venta_estado = 'pendiente' and estado <> 'cancelled'),
       'por_cobrar', (select count(*) from public.tn_ordenes where comercio_id = p_comercio and venta_estado = 'pendiente' and estado <> 'cancelled' and pago_estado <> 'paid')),
    'eventos_error', (select count(*) from public.tn_eventos where comercio_id = p_comercio and resultado in ('error','rechazado') and creado > now() - interval '7 days'));
end $$;

-- ---------------------------------------------------------------------
-- Configuración (lista cerrada de claves y valores)
--   stock_fuente  : quién manda sobre el stock  — sistema | tiendanube | off
--   precio_fuente : quién manda sobre el precio — sistema | tiendanube | off
--   importar_ordenes : traer las órdenes de la tienda (no crea ventas solas)
-- ---------------------------------------------------------------------
create or replace function public.tn_config_guardar(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; k text;
begin
  if not public.es_admin(p_comercio) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  for k in select jsonb_object_keys(coalesce(p, '{}'::jsonb)) loop
    if k not in ('stock_fuente','precio_fuente','importar_ordenes') then return jsonb_build_object('ok', false, 'error', 'Opción desconocida: ' || left(k, 30)); end if;
  end loop;
  if p ? 'stock_fuente' and (p->>'stock_fuente') not in ('sistema','tiendanube','off') then return jsonb_build_object('ok', false, 'error', 'stock_fuente inválido'); end if;
  if p ? 'precio_fuente' and (p->>'precio_fuente') not in ('sistema','tiendanube','off') then return jsonb_build_object('ok', false, 'error', 'precio_fuente inválido'); end if;
  if p ? 'importar_ordenes' and jsonb_typeof(p->'importar_ordenes') <> 'boolean' then return jsonb_build_object('ok', false, 'error', 'importar_ordenes inválido'); end if;
  insert into public.tn_conexion (comercio_id) values (p_comercio) on conflict (comercio_id) do nothing;
  update public.tn_conexion set config = config || p, actualizado = now() where comercio_id = p_comercio returning config into cfg;
  return jsonb_build_object('ok', true, 'config', cfg);
end $$;

-- ---------------------------------------------------------------------
-- Vincular una variante de Tiendanube con un producto del sistema (uno a uno)
-- ---------------------------------------------------------------------
create or replace function public.tn_vincular(p_comercio uuid, p_variant bigint, p_producto text, p_vinculo text default 'vinculado') returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.tn_productos;
begin
  if public.rol_en(p_comercio) not in ('admin','supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  if p_vinculo not in ('vinculado','ignorado','sin_vincular') then return jsonb_build_object('ok', false, 'error', 'vínculo inválido'); end if;
  select * into t from public.tn_productos where comercio_id = p_comercio and variant_id = p_variant for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Esa variante no está en la lista de Tiendanube (sincronizá primero).'); end if;
  if p_vinculo = 'vinculado' then
    if p_producto is null or not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'productos' and id = p_producto and not borrado) then
      return jsonb_build_object('ok', false, 'error', 'El producto del sistema no existe.');
    end if;
    if exists (select 1 from public.tn_productos where comercio_id = p_comercio and producto_local = p_producto and vinculo = 'vinculado' and variant_id <> p_variant) then
      return jsonb_build_object('ok', false, 'error', 'Ese producto ya está vinculado con otra variante de Tiendanube.');
    end if;
    update public.tn_productos set producto_local = p_producto, vinculo = 'vinculado' where comercio_id = p_comercio and variant_id = p_variant;
  else
    update public.tn_productos set producto_local = null, vinculo = p_vinculo where comercio_id = p_comercio and variant_id = p_variant;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Órdenes: lista para la pantalla y registro (idempotente) como venta del sistema
-- ---------------------------------------------------------------------
create or replace function public.tn_ordenes_listar(p_comercio uuid, p_venta_estado text default null, p_limite int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if public.rol_en(p_comercio) not in ('admin','supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(o) - 'comercio_id' order by o.tn_creada desc nulls last)
    from (select * from public.tn_ordenes where comercio_id = p_comercio and (p_venta_estado is null or venta_estado = p_venta_estado)
          order by tn_creada desc nulls last limit least(greatest(coalesce(p_limite, 50), 1), 200)) o), '[]'::jsonb);
end $$;

create or replace function public.tn_orden_registrar(p_comercio uuid, p_orden bigint, p_venta text, p_ignorar boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.tn_ordenes;
begin
  if public.rol_en(p_comercio) not in ('admin','supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  select * into o from public.tn_ordenes where comercio_id = p_comercio and orden_id = p_orden for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'La orden no existe.'); end if;
  if o.venta_estado = 'registrada' then
    return jsonb_build_object('ok', true, 'repetido', true, 'venta', o.venta_local);   -- idempotente: nunca dos ventas por orden
  end if;
  if p_ignorar then
    update public.tn_ordenes set venta_estado = 'ignorada' where comercio_id = p_comercio and orden_id = p_orden;
    return jsonb_build_object('ok', true, 'ignorada', true);
  end if;
  if o.estado = 'cancelled' then return jsonb_build_object('ok', false, 'error', 'La orden está cancelada en Tiendanube.'); end if;
  if p_venta is null or length(p_venta) not between 3 and 80 then return jsonb_build_object('ok', false, 'error', 'Falta el id de la venta.'); end if;
  update public.tn_ordenes set venta_estado = 'registrada', venta_local = p_venta where comercio_id = p_comercio and orden_id = p_orden;
  return jsonb_build_object('ok', true, 'venta', p_venta);
end $$;


-- Si la venta no se pudo crear en el equipo, se libera la orden para poder registrarla de nuevo.
create or replace function public.tn_orden_liberar(p_comercio uuid, p_orden bigint, p_venta text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if public.rol_en(p_comercio) not in ('admin','supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  update public.tn_ordenes set venta_estado = 'pendiente', venta_local = null
   where comercio_id = p_comercio and orden_id = p_orden and venta_estado = 'registrada' and venta_local = p_venta;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Sólo el rol de servicio (la Edge Function): guardar orden sin retroceder, consumir el state OAuth
-- ---------------------------------------------------------------------
create or replace function public.tn_upsert_orden(p_comercio uuid, p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare ex public.tn_ordenes; v_upd timestamptz := nullif(p->>'tn_actualizada', '')::timestamptz;
begin
  select * into ex from public.tn_ordenes where comercio_id = p_comercio and orden_id = (p->>'orden_id')::bigint for update;
  if found then
    if ex.tn_actualizada is not null and v_upd is not null and v_upd < ex.tn_actualizada then return 'ignorado'; end if;   -- evento viejo fuera de orden
    if ex.tn_actualizada = v_upd and ex.estado = p->>'estado' and ex.pago_estado = p->>'pago_estado' and ex.envio_estado = p->>'envio_estado' then return 'duplicado'; end if;
    update public.tn_ordenes set numero = (p->>'numero')::bigint, estado = p->>'estado', pago_estado = p->>'pago_estado', envio_estado = p->>'envio_estado',
      total_cents = (p->>'total_cents')::bigint, subtotal_cents = (p->>'subtotal_cents')::bigint, descuento_cents = (p->>'descuento_cents')::bigint, envio_cents = (p->>'envio_cents')::bigint,
      moneda = coalesce(p->>'moneda', 'ARS'), medio_pago = p->>'medio_pago', cliente = coalesce(p->'cliente', '{}'::jsonb), items = coalesce(p->'items', '[]'::jsonb),
      nota = p->>'nota', tn_creada = nullif(p->>'tn_creada', '')::timestamptz, tn_actualizada = v_upd
      where comercio_id = p_comercio and orden_id = ex.orden_id;
    return 'ok';
  end if;
  insert into public.tn_ordenes (comercio_id, orden_id, numero, estado, pago_estado, envio_estado, total_cents, subtotal_cents, descuento_cents, envio_cents, moneda, medio_pago, cliente, items, nota, tn_creada, tn_actualizada)
  values (p_comercio, (p->>'orden_id')::bigint, (p->>'numero')::bigint, p->>'estado', p->>'pago_estado', p->>'envio_estado',
    (p->>'total_cents')::bigint, (p->>'subtotal_cents')::bigint, (p->>'descuento_cents')::bigint, (p->>'envio_cents')::bigint,
    coalesce(p->>'moneda', 'ARS'), p->>'medio_pago', coalesce(p->'cliente', '{}'::jsonb), coalesce(p->'items', '[]'::jsonb), p->>'nota',
    nullif(p->>'tn_creada', '')::timestamptz, v_upd)
  on conflict (comercio_id, orden_id) do nothing;
  return 'ok';
end $$;

create or replace function public.tn_consumir_estado(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.tn_estados_oauth;
begin
  select * into e from public.tn_estados_oauth where state_hash = p_hash for update;
  if not found or e.usado or e.vence < now() then return null; end if;
  update public.tn_estados_oauth set usado = true where state_hash = p_hash;
  delete from public.tn_estados_oauth where vence < now() - interval '1 day';
  return jsonb_build_object('comercio', e.comercio_id, 'usuario', e.usuario);
end $$;

revoke all on function public.tn_upsert_orden(uuid, jsonb), public.tn_consumir_estado(text) from public, anon, authenticated;
revoke all on function public.tn_estado(uuid), public.tn_config_guardar(uuid, jsonb), public.tn_vincular(uuid, bigint, text, text),
  public.tn_ordenes_listar(uuid, text, int), public.tn_orden_registrar(uuid, bigint, text, boolean), public.tn_orden_liberar(uuid, bigint, text) from public, anon;
grant execute on function public.tn_estado(uuid), public.tn_config_guardar(uuid, jsonb), public.tn_vincular(uuid, bigint, text, text),
  public.tn_ordenes_listar(uuid, text, int), public.tn_orden_registrar(uuid, bigint, text, boolean), public.tn_orden_liberar(uuid, bigint, text) to authenticated;

-- ===== 14-auditoria-search-path.sql =====
-- 14 · Auditoría V26.30 (2026-10-27): fija el search_path de las funciones auxiliares que el linter de Supabase
-- marcó como «role mutable search_path». Es aditiva, idempotente y no cambia datos ni permisos.
do $$
declare f text;
begin
  foreach f in array array[
    'public.mi_email()','public.rave_hoy()','public.rave_json_tiene_pan(jsonb)','public.rave_luhn_ok(text)',
    'public.rave_no_truncate()','public.rave_num(jsonb,text)','public.rave_parece_pan(text)',
    'public.rave_puede_escribir(text,text,text)','public.rave_siguiente(uuid,text)','public.rave_solo_agregar()',
    'public.rave_txt(jsonb,text)','public.rave_uuid(text)']
  loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s set search_path = public, pg_temp', f);
    end if;
  end loop;
end $$;
