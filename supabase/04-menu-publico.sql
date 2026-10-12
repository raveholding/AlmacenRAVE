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
