-- =====================================================================
-- 28 · V26.73 · Notificaciones push a los clientes del Club (Web Push estándar, sin Firebase) + geocercas preparadas
-- Correr DESPUÉS de 01 a 27. Aditivo e idempotente (se puede repetir). No borra ni cambia datos.
--
-- Qué agrega:
--  1) push_subs: suscripciones de los celulares (endpoint del navegador + llaves públicas p256dh/auth). Las crea el propio
--     celular del cliente con push_suscribir (sólo si el comercio publicó las notificaciones en el menú), con límites por IP
--     y por comercio y sólo hacia servicios de push conocidos (Google, Mozilla, Apple, Microsoft). El cliente se da de baja y
--     BORRA todo lo suyo (suscripción, última ubicación y estado de geocercas) con push_baja.
--  2) push_campanas + push_envios: cada campaña se programa con push_programar (administrador o supervisor), que crea un envío
--     por suscripción (único por campaña + suscripción + serie → reintentar no duplica). «Hora local»: cada envío sale a esa hora
--     en la zona horaria del celular. Estados: BORRADOR, PROGRAMADA, ACTIVA, PAUSADA, FINALIZADA.
--  3) Métricas: enviados, entregados, abiertos y errores por campaña (push_metricas). El celular avisa «entregado» y «abierto»
--     con un código al azar de cada envío (push_evento): no se puede inflar la métrica de otro envío.
--  4) El envío real lo hace la función «push» (Edge Function) con push_tomar / push_resultado (sólo con la clave de servicio):
--     cifra cada mensaje para ese celular (RFC 8291) y firma con VAPID. Si el servicio responde 404/410 la suscripción se borra sola.
--     push_tick() la despierta cada minuto desde pg_cron si el proyecto lo tiene (si no, la despierta el sistema abierto).
--  5) Geocercas (preparadas para la app nativa; la app web NO las usa): push_geocercas (centro, radio 100 m a 5 km, ENTRAR / SALIR /
--     PERMANENCIA, días y horario, vencimiento, enfriamiento e histéresis) y push_geo_ping con firma HMAC por dispositivo, ventana
--     de 2 minutos, anti-repetición y descarte de saltos imposibles (GPS falso).
--  6) Colección «pushc» (borradores de campañas) en la sincronización. Escriben administrador y supervisor.
-- Llaves VAPID: las crea y guarda la función «push» en push_vapid la primera vez (nadie las pega ni las ve; sólo la clave de servicio).
-- =====================================================================

create table if not exists public.push_vapid (
  comercio_id uuid primary key references public.comercios(id) on delete cascade,
  pub         text not null,
  priv        jsonb not null,
  creado      timestamptz not null default now()
);
alter table public.push_vapid enable row level security;
revoke all on public.push_vapid from public, anon, authenticated;

create table if not exists public.push_subs (
  id          uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  cliente     text,
  os          text not null default 'otro',
  tz          text not null default 'America/Argentina/Salta',
  ver         text,
  ip          text,
  geo_secreto text,
  creado      timestamptz not null default now(),
  ultimo      timestamptz not null default now()
);
create index if not exists push_subs_com on public.push_subs (comercio_id, cliente);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from public, anon, authenticated;

create table if not exists public.push_campanas (
  id          text not null,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  titulo      text not null,
  cuerpo      text not null,
  imagen_url  text,
  accion_url  text,
  tipo        text not null default 'ESTANDAR' check (tipo in ('ESTANDAR','GEOLOCALIZADO')),
  estado      text not null default 'PROGRAMADA' check (estado in ('BORRADOR','PROGRAMADA','ACTIVA','PAUSADA','FINALIZADA')),
  prioridad   text not null default 'normal' check (prioridad in ('alta','normal')),
  ttl         int not null default 86400 check (ttl between 60 and 2419200),
  por         uuid,
  creado      timestamptz not null default now(),
  primary key (comercio_id, id)
);
alter table public.push_campanas enable row level security;
revoke all on public.push_campanas from public, anon, authenticated;

create table if not exists public.push_envios (
  id          bigint generated always as identity primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  campana_id  text not null,
  sub_id      uuid references public.push_subs(id) on delete set null,
  serie       int not null default 0,
  tok         text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  due         timestamptz not null default now(),
  estado      text not null default 'pendiente' check (estado in ('pendiente','enviando','enviado','error','cancelado')),
  intentos    int not null default 0,
  codigo      int,
  tomado      timestamptz,
  enviado_at  timestamptz,
  entregado_at timestamptz,
  abierto_at  timestamptz,
  unique (campana_id, sub_id, serie)
);
create index if not exists push_envios_due on public.push_envios (estado, due);
create index if not exists push_envios_camp on public.push_envios (comercio_id, campana_id);
alter table public.push_envios enable row level security;
revoke all on public.push_envios from public, anon, authenticated;

create table if not exists public.push_geocercas (
  campana_id  text not null,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  radio_m     int not null check (radio_m between 100 and 5000),
  disparo     text not null check (disparo in ('ENTRAR','SALIR','PERMANENCIA')),
  minutos     int not null default 0 check (minutos between 0 and 240),
  dias        int[] not null default '{1,2,3,4,5,6}',
  desde       time not null default '09:00',
  hasta       time not null default '21:00',
  expira      timestamptz,
  enfriar_min int not null default 240 check (enfriar_min between 10 and 10080),
  histeresis_m int not null default 30 check (histeresis_m between 0 and 500),
  primary key (comercio_id, campana_id)
);
alter table public.push_geocercas enable row level security;
revoke all on public.push_geocercas from public, anon, authenticated;

create table if not exists public.push_geo_pos (
  sub_id uuid primary key references public.push_subs(id) on delete cascade,
  lat double precision not null, lng double precision not null, ts bigint not null, rechazos int not null default 0
);
create table if not exists public.push_geo_estado (
  sub_id uuid not null references public.push_subs(id) on delete cascade,
  campana_id text not null,
  dentro boolean not null default false,
  entro_at timestamptz,
  disparo_at timestamptz,
  serie int not null default 0,
  primary key (sub_id, campana_id)
);
alter table public.push_geo_pos enable row level security;
alter table public.push_geo_estado enable row level security;
revoke all on public.push_geo_pos, public.push_geo_estado from public, anon, authenticated;

create table if not exists public.push_ajustes (clave text primary key, valor text not null);
alter table public.push_ajustes enable row level security;
revoke all on public.push_ajustes from public, anon, authenticated;

-- ---------- utilidades ----------
create or replace function public.push_host_ok(p text) returns boolean language sql immutable as $$
  select length(coalesce(p, '')) between 30 and 800 and p ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)(:443)?/[^\s"<>]{8,}$'
$$;
create or replace function public.push_dist_m(a1 double precision, o1 double precision, a2 double precision, o2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(a2 - a1) / 2), 2) + cos(radians(a1)) * cos(radians(a2)) * power(sin(radians(o2 - o1) / 2), 2)))
$$;
create or replace function public.push_publicado(p_slug text) returns uuid language sql stable security definer set search_path = public as $$
  select c.id from public.comercios c join public.menus m on m.comercio_id = c.id
   where c.slug = lower(left(coalesce(p_slug, ''), 40)) and coalesce((m.contenido #>> '{site,push,on}')::boolean, false)
$$;

-- ---------- 1) el celular del cliente ----------
create or replace function public.push_suscribir(p_slug text, p_endpoint text, p_p256dh text, p_auth text, p_cliente text, p_os text, p_tz text, p_ver text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_c uuid := public.push_publicado(p_slug); v_ip text := public.rave_ip(); v_cli text; v_tz text;
begin
  if v_c is null then return jsonb_build_object('ok', false, 'error', 'las notificaciones no están disponibles'); end if;
  if not public.push_host_ok(p_endpoint) or coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{80,100}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{16,32}$' then
    return jsonb_build_object('ok', false, 'error', 'suscripción inválida');
  end if;
  if v_ip <> '' and (select count(*) from public.push_subs where ip = v_ip and creado > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'demasiados intentos, probá más tarde');
  end if;
  if (select count(*) from public.push_subs where comercio_id = v_c and creado > now() - interval '1 hour') >= 2000 then
    return jsonb_build_object('ok', false, 'error', 'probá más tarde');
  end if;
  if coalesce(p_cliente, '') ~ '^[A-Za-z0-9_-]{8,64}$' and exists (select 1 from public.registros r where r.comercio_id = v_c and r.coleccion = 'clientes' and r.id = p_cliente and not r.borrado) then
    v_cli := p_cliente;
  end if;
  v_tz := case when coalesce(p_tz, '') ~ '^[A-Za-z_]+(/[A-Za-z_+-]+){0,2}$' and exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'America/Argentina/Salta' end;
  insert into public.push_subs (comercio_id, endpoint, p256dh, auth, cliente, os, tz, ver, ip)
  values (v_c, p_endpoint, p_p256dh, p_auth, v_cli, case when p_os in ('android','ios','windows','mac','linux') then p_os else 'otro' end, v_tz, left(coalesce(p_ver, ''), 20), nullif(v_ip, ''))
  on conflict (endpoint) do update set comercio_id = excluded.comercio_id, p256dh = excluded.p256dh, auth = excluded.auth,
    cliente = coalesce(excluded.cliente, public.push_subs.cliente), os = excluded.os, tz = excluded.tz, ver = excluded.ver, ultimo = now()
    where public.push_subs.comercio_id = excluded.comercio_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.push_baja(p_slug text, p_endpoint text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_c uuid; n int;
begin
  select id into v_c from public.comercios where slug = lower(left(coalesce(p_slug, ''), 40));
  delete from public.push_subs where comercio_id = v_c and endpoint = p_endpoint;  -- se llevan su posición y su estado de geocercas (cascade)
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'borradas', n);
end $$;

create or replace function public.push_evento(p_tok text, p_tipo text)
returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(p_tok, '') !~ '^[0-9a-f]{32}$' or p_tipo not in ('entregado', 'abierto') then return jsonb_build_object('ok', false); end if;
  if p_tipo = 'entregado' then
    update public.push_envios set entregado_at = coalesce(entregado_at, now()) where tok = p_tok and estado = 'enviado';
  else
    update public.push_envios set abierto_at = coalesce(abierto_at, now()), entregado_at = coalesce(entregado_at, now()) where tok = p_tok and estado = 'enviado';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 2) el equipo del comercio ----------
create or replace function public.push_programar(p_comercio uuid, p_campana jsonb, p_destinos text[], p_cuando timestamptz, p_hora_local text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_id text := left(coalesce(p_campana->>'id', ''), 40); v_tit text := btrim(coalesce(p_campana->>'titulo', '')); v_cue text := btrim(coalesce(p_campana->>'cuerpo', ''));
        v_img text := nullif(btrim(coalesce(p_campana->>'imagen_url', '')), ''); v_url text := nullif(btrim(coalesce(p_campana->>'accion_url', '')), '');
        v_pri text := coalesce(p_campana->>'prioridad', 'normal'); v_ttl int := coalesce((p_campana->>'ttl')::int, 86400); n int; v_est text;
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin', 'supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  if v_id !~ '^[A-Za-z0-9_-]{6,40}$' then raise exception 'campaña inválida' using errcode = '22023'; end if;
  if length(v_tit) not between 1 and 65 or length(v_cue) not between 1 and 240 then raise exception 'título (hasta 65) y texto (hasta 240) obligatorios' using errcode = '22023'; end if;
  if v_img is not null and (length(v_img) > 400 or v_img !~ '^https://[^\s<>"]{4,}$') then raise exception 'la imagen tiene que ser un enlace https' using errcode = '22023'; end if;
  if v_url is not null and (length(v_url) > 400 or v_url !~ '^(#[A-Za-z0-9/_=-]{1,60}|https://[^\s<>"]{4,})$') then raise exception 'enlace de la acción inválido' using errcode = '22023'; end if;
  if v_pri not in ('alta', 'normal') or v_ttl not between 60 and 2419200 then raise exception 'prioridad o vigencia inválida' using errcode = '22023'; end if;
  if p_hora_local is not null and p_hora_local !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'hora local inválida' using errcode = '22023'; end if;
  if p_destinos is not null and cardinality(p_destinos) > 20000 then raise exception 'demasiados destinatarios' using errcode = '22023'; end if;
  select estado into v_est from public.push_campanas where comercio_id = p_comercio and id = v_id;
  if v_est is not null and v_est <> 'BORRADOR' then raise exception 'esa campaña ya fue programada' using errcode = '23505'; end if;
  insert into public.push_campanas (id, comercio_id, titulo, cuerpo, imagen_url, accion_url, tipo, estado, prioridad, ttl, por)
  values (v_id, p_comercio, v_tit, v_cue, v_img, v_url, 'ESTANDAR', 'PROGRAMADA', v_pri, v_ttl, auth.uid())
  on conflict (comercio_id, id) do update set titulo = excluded.titulo, cuerpo = excluded.cuerpo, imagen_url = excluded.imagen_url, accion_url = excluded.accion_url,
    estado = 'PROGRAMADA', prioridad = excluded.prioridad, ttl = excluded.ttl;
  insert into public.push_envios (comercio_id, campana_id, sub_id, due)
  select p_comercio, v_id, s.id,
         case when p_hora_local is null then coalesce(p_cuando, now())
              else greatest(now(), ((coalesce(p_cuando, now()) at time zone s.tz)::date + p_hora_local::time) at time zone s.tz) end
    from public.push_subs s
   where s.comercio_id = p_comercio and (p_destinos is null or s.cliente = any(p_destinos))
  on conflict (campana_id, sub_id, serie) do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'envios', n);
end $$;

create or replace function public.push_estado(p_comercio uuid, p_campana text, p_estado text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin', 'supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  if p_estado not in ('PAUSADA', 'PROGRAMADA', 'ACTIVA', 'FINALIZADA') then raise exception 'estado inválido' using errcode = '22023'; end if;
  update public.push_campanas set estado = p_estado where comercio_id = p_comercio and id = p_campana and estado <> 'FINALIZADA';
  get diagnostics n = row_count;
  if p_estado = 'FINALIZADA' then
    update public.push_envios set estado = 'cancelado' where comercio_id = p_comercio and campana_id = p_campana and estado = 'pendiente';
  end if;
  return jsonb_build_object('ok', n = 1);
end $$;

create or replace function public.push_metricas(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if public.rol_en(p_comercio) is null then raise exception 'sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'subs', (select count(*) from public.push_subs where comercio_id = p_comercio),
    'subs_cliente', (select count(*) from public.push_subs where comercio_id = p_comercio and cliente is not null),
    'por_os', coalesce((select jsonb_object_agg(os, n) from (select os, count(*) n from public.push_subs where comercio_id = p_comercio group by os) x), '{}'::jsonb),
    'campanas', coalesce((select jsonb_object_agg(c.id, jsonb_build_object('estado', c.estado, 'tipo', c.tipo,
        'total', (select count(*) from public.push_envios e where e.comercio_id = p_comercio and e.campana_id = c.id),
        'pendientes', (select count(*) from public.push_envios e where e.comercio_id = p_comercio and e.campana_id = c.id and e.estado in ('pendiente','enviando')),
        'enviados', (select count(*) from public.push_envios e where e.comercio_id = p_comercio and e.campana_id = c.id and e.estado = 'enviado'),
        'entregados', (select count(*) from public.push_envios e where e.comercio_id = p_comercio and e.campana_id = c.id and e.entregado_at is not null),
        'abiertos', (select count(*) from public.push_envios e where e.comercio_id = p_comercio and e.campana_id = c.id and e.abierto_at is not null),
        'errores', (select count(*) from public.push_envios e where e.comercio_id = p_comercio and e.campana_id = c.id and e.estado = 'error')))
      from public.push_campanas c where c.comercio_id = p_comercio), '{}'::jsonb));
end $$;

-- ---------- 3) el trabajador (sólo la función «push», con la clave de servicio) ----------
create or replace function public.push_tomar(p_lim int)
returns table (id bigint, comercio_id uuid, tok text, endpoint text, p256dh text, auth text, titulo text, cuerpo text, imagen_url text, accion_url text, prioridad text, ttl int, campana_id text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
begin
  update public.push_envios e set estado = 'pendiente' where e.estado = 'enviando' and e.tomado < now() - interval '10 minutes';
  return query
  with t as (
    select e.id from public.push_envios e join public.push_campanas c on c.comercio_id = e.comercio_id and c.id = e.campana_id
     where e.estado = 'pendiente' and e.due <= now() and e.sub_id is not null and c.estado in ('PROGRAMADA', 'ACTIVA')
     order by c.prioridad = 'alta' desc, e.due limit greatest(1, least(coalesce(p_lim, 100), 500)) for update of e skip locked)
  update public.push_envios e set estado = 'enviando', tomado = now(), intentos = e.intentos + 1 from t, public.push_subs s, public.push_campanas c
   where e.id = t.id and s.id = e.sub_id and c.comercio_id = e.comercio_id and c.id = e.campana_id
  returning e.id, e.comercio_id, e.tok, s.endpoint, s.p256dh, s.auth, c.titulo, c.cuerpo, c.imagen_url, c.accion_url, c.prioridad, c.ttl, c.id;
end $$;

create or replace function public.push_resultado(p_id bigint, p_estado text, p_codigo int)
returns void language plpgsql security definer set search_path = public
as $$
declare v_sub uuid; v_int int; v_com uuid; v_camp text;
begin
  select sub_id, intentos, comercio_id, campana_id into v_sub, v_int, v_com, v_camp from public.push_envios where id = p_id and estado = 'enviando';
  if not found then return; end if;
  if p_estado = 'enviado' then
    update public.push_envios set estado = 'enviado', enviado_at = now(), codigo = p_codigo where id = p_id;
  elsif p_estado = 'reintentar' and v_int < 3 then
    update public.push_envios set estado = 'pendiente', codigo = p_codigo, due = now() + make_interval(mins => power(2, v_int)::int) where id = p_id;
  elsif p_estado = 'invalido' then
    update public.push_envios set estado = 'error', codigo = p_codigo where id = p_id;
    delete from public.push_subs where id = v_sub;   -- limpieza automática: el navegador dio de baja esa suscripción (404/410)
  else
    update public.push_envios set estado = 'error', codigo = p_codigo where id = p_id;
  end if;
  -- una campaña estándar sin pendientes queda FINALIZADA
  if not exists (select 1 from public.push_envios where comercio_id = v_com and campana_id = v_camp and estado in ('pendiente', 'enviando')) then
    update public.push_campanas set estado = 'FINALIZADA' where comercio_id = v_com and id = v_camp and tipo = 'ESTANDAR' and estado = 'PROGRAMADA';
  end if;
end $$;

create or replace function public.push_tick() returns void language plpgsql security definer set search_path = public
as $$
declare v_url text;
begin
  if not exists (select 1 from public.push_envios where estado = 'pendiente' and due <= now()) then return; end if;
  select valor into v_url from public.push_ajustes where clave = 'url';
  if v_url is null or v_url !~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/push$' then return; end if;
  begin
    execute 'select net.http_post(url := $1, body := ''{"accion":"procesar"}''::jsonb, headers := ''{"content-type":"application/json"}''::jsonb)' using v_url;
  exception when others then null;  -- sin pg_net: lo despierta el sistema abierto
  end;
end $$;

create or replace function public.push_url(p_comercio uuid, p_url text) returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(public.es_admin(p_comercio), false) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  if p_url !~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/push$' then raise exception 'dirección inválida' using errcode = '22023'; end if;
  insert into public.push_ajustes (clave, valor) values ('url', p_url) on conflict (clave) do update set valor = excluded.valor;
  return jsonb_build_object('ok', true);
end $$;

-- pg_cron (si el proyecto lo tiene): despertar al trabajador cada minuto
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $j$select cron.schedule('svb-push', '* * * * *', 'select public.push_tick()')$j$;
    exception when others then raise notice '28: no se pudo programar pg_cron (%); los envíos programados salen cuando el sistema está abierto', sqlerrm;
    end;
  else
    raise notice '28: el proyecto no tiene pg_cron: los envíos programados salen cuando el sistema está abierto (Database → Extensions → pg_cron y pg_net para que salgan solos)';
  end if;
end
$cron$;

-- ---------- 4) geocercas (preparadas para la app nativa) ----------
create or replace function public.push_geo_guardar(p_comercio uuid, p_campana jsonb, p_geo jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_id text := left(coalesce(p_campana->>'id', ''), 40); v_est text;
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin', 'supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  if v_id !~ '^[A-Za-z0-9_-]{6,40}$' or length(btrim(coalesce(p_campana->>'titulo', ''))) not between 1 and 65 or length(btrim(coalesce(p_campana->>'cuerpo', ''))) not between 1 and 240 then
    raise exception 'campaña inválida' using errcode = '22023'; end if;
  if (p_geo->>'radio_m')::int not between 100 and 5000 then raise exception 'el radio va de 100 m a 5 km' using errcode = '22023'; end if;
  v_est := case when coalesce((p_geo->>'activa')::boolean, false) then 'ACTIVA' else 'PAUSADA' end;
  insert into public.push_campanas (id, comercio_id, titulo, cuerpo, imagen_url, accion_url, tipo, estado, prioridad, ttl, por)
  values (v_id, p_comercio, btrim(p_campana->>'titulo'), btrim(p_campana->>'cuerpo'), nullif(p_campana->>'imagen_url', ''), nullif(p_campana->>'accion_url', ''), 'GEOLOCALIZADO', v_est,
          case when p_campana->>'prioridad' = 'alta' then 'alta' else 'normal' end, 3600, auth.uid())
  on conflict (comercio_id, id) do update set titulo = excluded.titulo, cuerpo = excluded.cuerpo, imagen_url = excluded.imagen_url, accion_url = excluded.accion_url, estado = v_est, prioridad = excluded.prioridad
    where public.push_campanas.tipo = 'GEOLOCALIZADO';
  insert into public.push_geocercas (campana_id, comercio_id, lat, lng, radio_m, disparo, minutos, dias, desde, hasta, expira, enfriar_min, histeresis_m)
  values (v_id, p_comercio, (p_geo->>'lat')::float8, (p_geo->>'lng')::float8, (p_geo->>'radio_m')::int, p_geo->>'disparo', coalesce((p_geo->>'minutos')::int, 0),
          coalesce((select array_agg(x::int) from jsonb_array_elements_text(p_geo->'dias') x), '{1,2,3,4,5,6}'), coalesce((p_geo->>'desde')::time, '09:00'), coalesce((p_geo->>'hasta')::time, '21:00'),
          nullif(p_geo->>'expira', '')::timestamptz, coalesce((p_geo->>'enfriar_min')::int, 240), coalesce((p_geo->>'histeresis_m')::int, 30))
  on conflict (comercio_id, campana_id) do update set lat = excluded.lat, lng = excluded.lng, radio_m = excluded.radio_m, disparo = excluded.disparo, minutos = excluded.minutos, dias = excluded.dias,
    desde = excluded.desde, hasta = excluded.hasta, expira = excluded.expira, enfriar_min = excluded.enfriar_min, histeresis_m = excluded.histeresis_m;
  return jsonb_build_object('ok', true, 'estado', v_est);
end $$;

-- la app nativa registra su dispositivo y recibe UNA vez su secreto para firmar las ubicaciones
create or replace function public.push_geo_registrar(p_slug text, p_endpoint text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_c uuid := public.push_publicado(p_slug); v_s text := encode(extensions.gen_random_bytes(32), 'hex'); n int;
begin
  if v_c is null then return jsonb_build_object('ok', false); end if;
  update public.push_subs set geo_secreto = v_s where comercio_id = v_c and endpoint = p_endpoint and geo_secreto is null;
  get diagnostics n = row_count;
  return case when n = 1 then jsonb_build_object('ok', true, 'secreto', v_s) else jsonb_build_object('ok', false) end;
end $$;

create or replace function public.push_geo_ping(p_slug text, p_endpoint text, p_lat double precision, p_lng double precision, p_ts bigint, p_firma text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_c uuid := public.push_publicado(p_slug); s record; prev record; g record; st record; d double precision; v_in boolean; fire boolean; n int := 0;
        v_now bigint := (extract(epoch from now()) * 1000)::bigint; v_loc timestamp;
begin
  if v_c is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then return jsonb_build_object('ok', false, 'error', 'datos inválidos'); end if;
  select * into s from public.push_subs where comercio_id = v_c and endpoint = p_endpoint;
  if not found or s.geo_secreto is null then return jsonb_build_object('ok', false, 'error', 'dispositivo no registrado'); end if;
  if coalesce(p_firma, '') <> encode(extensions.hmac(p_endpoint || '|' || p_lat::text || '|' || p_lng::text || '|' || p_ts::text, s.geo_secreto, 'sha256'), 'hex') then
    return jsonb_build_object('ok', false, 'error', 'firma inválida'); end if;
  if abs(v_now - p_ts) > 120000 then return jsonb_build_object('ok', false, 'error', 'ubicación vencida'); end if;
  select * into prev from public.push_geo_pos where sub_id = s.id;
  if found then
    if p_ts <= prev.ts then return jsonb_build_object('ok', false, 'error', 'ubicación repetida'); end if;
    if public.push_dist_m(prev.lat, prev.lng, p_lat, p_lng) / greatest((p_ts - prev.ts) / 1000.0, 1) > 70 then   -- más de ~250 km/h: GPS falso o salto imposible
      update public.push_geo_pos set rechazos = rechazos + 1 where sub_id = s.id;
      return jsonb_build_object('ok', false, 'error', 'salto imposible');
    end if;
  end if;
  insert into public.push_geo_pos (sub_id, lat, lng, ts) values (s.id, p_lat, p_lng, p_ts)
  on conflict (sub_id) do update set lat = excluded.lat, lng = excluded.lng, ts = excluded.ts;
  for g in select gc.*, c.estado from public.push_geocercas gc join public.push_campanas c on c.comercio_id = gc.comercio_id and c.id = gc.campana_id
            where gc.comercio_id = v_c and c.estado = 'ACTIVA' and (gc.expira is null or gc.expira > now()) loop
    d := public.push_dist_m(g.lat, g.lng, p_lat, p_lng);
    select * into st from public.push_geo_estado where sub_id = s.id and campana_id = g.campana_id;
    if not found then insert into public.push_geo_estado (sub_id, campana_id) values (s.id, g.campana_id) returning * into st; end if;
    v_in := case when st.dentro then d <= g.radio_m + g.histeresis_m else d <= g.radio_m end;   -- histéresis: no rebota en el borde
    fire := (g.disparo = 'ENTRAR' and v_in and not st.dentro)
         or (g.disparo = 'SALIR' and not v_in and st.dentro)
         or (g.disparo = 'PERMANENCIA' and v_in and st.dentro and st.entro_at is not null and st.entro_at <= now() - make_interval(mins => g.minutos)
             and (st.disparo_at is null or st.disparo_at < st.entro_at));
    v_loc := now() at time zone s.tz;
    if fire and (extract(dow from v_loc))::int = any(g.dias) and v_loc::time between g.desde and g.hasta
       and (st.disparo_at is null or st.disparo_at < now() - make_interval(mins => g.enfriar_min)) then
      insert into public.push_envios (comercio_id, campana_id, sub_id, serie, due) values (v_c, g.campana_id, s.id, st.serie + 1, now()) on conflict do nothing;
      update public.push_geo_estado set disparo_at = now(), serie = serie + 1 where sub_id = s.id and campana_id = g.campana_id;
      n := n + 1;
    end if;
    update public.push_geo_estado set dentro = v_in,
      entro_at = case when v_in and not st.dentro then now() when not v_in then null else push_geo_estado.entro_at end
     where sub_id = s.id and campana_id = g.campana_id;
  end loop;
  return jsonb_build_object('ok', true, 'disparos', n);
end $$;

-- alcance estimado de una geocerca: dispositivos con ubicación de los últimos 30 minutos (sólo existirán con la app nativa)
create or replace function public.push_alcance(p_comercio uuid, p_lat double precision, p_lng double precision, p_r int)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_ts bigint := (extract(epoch from now() - interval '30 minutes') * 1000)::bigint;
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin', 'supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  return (select jsonb_build_object('con_ubicacion', count(*),
            'dentro', count(*) filter (where public.push_dist_m(p.lat, p.lng, p_lat, p_lng) <= greatest(100, least(p_r, 5000))),
            'cerca', count(*) filter (where public.push_dist_m(p.lat, p.lng, p_lat, p_lng) between greatest(100, least(p_r, 5000)) and 2 * greatest(100, least(p_r, 5000))))
            from public.push_geo_pos p join public.push_subs s on s.id = p.sub_id where s.comercio_id = p_comercio and p.ts >= v_ts);
end $$;

-- ---------- 5) permisos de ejecución ----------
revoke all on function public.push_suscribir(text, text, text, text, text, text, text, text) from public;
grant execute on function public.push_suscribir(text, text, text, text, text, text, text, text) to anon, authenticated;
revoke all on function public.push_baja(text, text) from public;
grant execute on function public.push_baja(text, text) to anon, authenticated;
revoke all on function public.push_evento(text, text) from public;
grant execute on function public.push_evento(text, text) to anon, authenticated;
revoke all on function public.push_geo_registrar(text, text) from public;
grant execute on function public.push_geo_registrar(text, text) to anon, authenticated;
revoke all on function public.push_geo_ping(text, text, double precision, double precision, bigint, text) from public;
grant execute on function public.push_geo_ping(text, text, double precision, double precision, bigint, text) to anon, authenticated;
revoke all on function public.push_programar(uuid, jsonb, text[], timestamptz, text) from public, anon;
grant execute on function public.push_programar(uuid, jsonb, text[], timestamptz, text) to authenticated;
revoke all on function public.push_estado(uuid, text, text) from public, anon;
grant execute on function public.push_estado(uuid, text, text) to authenticated;
revoke all on function public.push_metricas(uuid) from public, anon;
grant execute on function public.push_metricas(uuid) to authenticated;
revoke all on function public.push_geo_guardar(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.push_geo_guardar(uuid, jsonb, jsonb) to authenticated;
revoke all on function public.push_alcance(uuid, double precision, double precision, int) from public, anon;
grant execute on function public.push_alcance(uuid, double precision, double precision, int) to authenticated;
revoke all on function public.push_url(uuid, text) from public, anon;
grant execute on function public.push_url(uuid, text) to authenticated;
revoke all on function public.push_tomar(int) from public, anon, authenticated;
revoke all on function public.push_resultado(bigint, text, int) from public, anon, authenticated;
revoke all on function public.push_tick() from public, anon, authenticated;
revoke all on function public.push_publicado(text) from public, anon, authenticated;

-- ---------- 6) sincronización: borradores de campañas ----------
do $mig$
declare
  d text;
  o1 constant text := $o$'fincmp','finrec'];$o$;
  n1 constant text := $n$'fincmp','finrec','pushc'];$n$;
  o3 constant text := $o$'pcta','fincmp','finrec')$o$;
  n3 constant text := $n$'pcta','fincmp','finrec','pushc')$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''pushc''' in d) = 0 then
    -- 'fincmp','finrec']; cierra tanto la lista de «todas» como la de «se pueden borrar»: las dos suman pushc
    if position(o1 in d) = 0 then raise exception '28: no encontré las listas de sincronizar (¿falta correr 27?)'; end if;
    execute replace(d, o1, n1);
  end if;
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''pushc''' in d) = 0 then
    if position(o3 in d) = 0 then raise exception '28: no encontré la lista del supervisor (¿falta correr 27?)'; end if;
    execute replace(d, o3, n3);
  end if;
end
$mig$;
