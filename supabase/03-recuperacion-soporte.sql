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
