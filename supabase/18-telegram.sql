-- =====================================================================
-- SISTEMA RAVE · 18 · V26.52 · 4.35 · R2AVE en Telegram (@R2aveBot) — sólo Almacén RAVE
--
-- Correr DESPUÉS de 01..17 (se puede repetir). Aditiva: no borra ni cambia datos ni toca `sincronizar`.
-- Qué agrega (tablas SIN acceso directo para el navegador; todo pasa por funciones):
--   · tg_config      configuración del bot por comercio (encendido, correcciones de stock permitidas HASTA una hora,
--                    límites, IA, grupo de alertas). La cambia SÓLO el administrador.
--   · tg_vinculos    Telegram ↔ usuario del sistema (sólo administradores).
--   · tg_codigos     códigos de vinculación de un solo uso (se guarda el hash; vencen a los 10 minutos).
--   · tg_updates     update_id ya procesados (Telegram reintenta: nada se ejecuta dos veces).
--   · tg_pendientes  correcciones de stock esperando «Confirmar» (vencen a los 5 minutos).
--   · tg_ia_uso      tope diario de consultas a la IA.  · tg_alertas_env  alertas ya avisadas (no se repiten).
-- Funciones:
--   · del administrador (con su sesión): tg_admin_estado, tg_admin_guardar, tg_codigo_crear, tg_admin_desvincular.
--   · del servidor (SÓLO service_role, las llama la Edge Function «telegram»): tg_srv_*.
-- La corrección de stock usa EL MISMO camino que los equipos: un movimiento `smov` (escritura única) + el stock del
-- producto actualizado en `registros` + un registro de Auditoría `AJUSTE_STOCK`. Los equipos lo reciben al sincronizar.
-- El servidor NO puede leer datos personales de clientes (viajan cifrados): el bot no los ve ni los manda.
-- =====================================================================

create table if not exists public.tg_config (
  comercio_id   uuid primary key references public.comercios(id) on delete cascade,
  activo        boolean not null default false,
  ajuste_hasta  timestamptz,
  max_unidades  numeric not null default 24 check (max_unidades > 0 and max_unidades <= 1000),
  max_valor     bigint  not null default 5000000 check (max_valor > 0 and max_valor <= 1000000000),   -- centavos, a costo
  max_dia       int     not null default 10 check (max_dia between 1 and 100),
  ia            boolean not null default true,
  ia_max_dia    int     not null default 30 check (ia_max_dia between 0 and 500),
  alertas       boolean not null default false,
  alertas_chat  bigint,
  webhook_ok    timestamptz,
  actualizado   timestamptz not null default now(),
  actualizado_por uuid references auth.users(id) on delete set null
);
create table if not exists public.tg_vinculos (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  tg_user_id  bigint not null,
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  tg_nombre   text,
  alta        timestamptz not null default now(),
  ultimo_uso  timestamptz,
  activo      boolean not null default true,
  primary key (comercio_id, tg_user_id)
);
create table if not exists public.tg_codigos (
  hash        text primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  vence       timestamptz not null,
  usado       timestamptz
);
create table if not exists public.tg_updates (update_id bigint primary key, recibido timestamptz not null default now());
create table if not exists public.tg_pendientes (
  id          text primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  tg_user_id  bigint not null,
  usuario_id  uuid not null,
  datos       jsonb not null,
  creado      timestamptz not null default now(),
  vence       timestamptz not null,
  estado      text not null default 'pendiente' check (estado in ('pendiente','hecho','cancelado','vencido','rechazado')),
  resultado   jsonb
);
create index if not exists tg_pendientes_dia on public.tg_pendientes (comercio_id, estado, creado);
create table if not exists public.tg_ia_uso (comercio_id uuid not null, dia date not null, n int not null default 0, primary key (comercio_id, dia));
create table if not exists public.tg_alertas_env (comercio_id uuid not null, clave text not null, enviado timestamptz not null default now(), primary key (comercio_id, clave));

do $$ declare t text; begin
  foreach t in array array['tg_config','tg_vinculos','tg_codigos','tg_updates','tg_pendientes','tg_ia_uso','tg_alertas_env'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- ayudas internas
create or replace function public.tg_hoy() returns date language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

create or replace function public.tg_n(x numeric) returns text language sql immutable as $$
  select replace(trim_scale(x)::text, '.', ',') $$;

create or replace function public.tg_audit(p_comercio uuid, p_usuario uuid, p_user text, p_action text, p_detail text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id text := 'tg-' || replace(gen_random_uuid()::text, '-', '');
begin
  insert into public.registros (comercio_id, coleccion, id, datos, dispositivo, usuario_id)
  values (p_comercio, 'audit', v_id,
          jsonb_build_object('id', v_id, 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint, 'user', left(coalesce(p_user, 'R2AVE'), 60),
                             'action', p_action, 'detail', left(coalesce(p_detail, ''), 400), 'prev', 'TELEGRAM', 'dev', 'telegram'),
          'telegram', p_usuario);
end $$;

create or replace function public.tg_cfg_row(p_comercio uuid) returns public.tg_config
language plpgsql security definer set search_path = public as $$
declare r public.tg_config;
begin
  insert into public.tg_config (comercio_id) values (p_comercio) on conflict (comercio_id) do nothing;
  select * into r from public.tg_config where comercio_id = p_comercio;
  return r;
end $$;

create or replace function public.tg_cfg_json(r public.tg_config) returns jsonb language sql stable as $$
  select jsonb_build_object('activo', r.activo, 'ajuste_hasta', r.ajuste_hasta,
    'ajuste_on', r.ajuste_hasta is not null and r.ajuste_hasta > now(),
    'max_unidades', r.max_unidades, 'max_valor', r.max_valor, 'max_dia', r.max_dia,
    'ia', r.ia, 'ia_max_dia', r.ia_max_dia, 'alertas', r.alertas, 'alertas_chat', r.alertas_chat is not null,
    'webhook_ok', r.webhook_ok, 'actualizado', r.actualizado) $$;

-- ---------------------------------------------------------------- funciones del ADMINISTRADOR (con su sesión)
create or replace function public.tg_admin_estado(p_comercio uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.tg_config; v jsonb; a jsonb; hechas int;
begin
  if not public.es_admin(p_comercio) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  r := public.tg_cfg_row(p_comercio);
  select coalesce(jsonb_agg(jsonb_build_object('tg_user_id', x.tg_user_id::text, 'tg_nombre', x.tg_nombre, 'usuario', coalesce(m.nombre, m.email, '—'),
           'yo', x.usuario_id = auth.uid(), 'alta', x.alta, 'ultimo_uso', x.ultimo_uso) order by x.alta), '[]'::jsonb) into v
    from public.tg_vinculos x left join public.miembros m on m.comercio_id = x.comercio_id and m.usuario_id = x.usuario_id
   where x.comercio_id = p_comercio and x.activo;
  select coalesce(jsonb_agg(d order by (d->>'ts')::bigint desc), '[]'::jsonb) into a from (
    select datos d from public.registros where comercio_id = p_comercio and coleccion = 'audit' and datos->>'dev' = 'telegram'
     order by actualizado desc limit 15) q;
  select count(*) into hechas from public.tg_pendientes where comercio_id = p_comercio and estado = 'hecho'
     and (creado at time zone 'America/Argentina/Buenos_Aires')::date = public.tg_hoy();
  return public.tg_cfg_json(r) || jsonb_build_object('vinculos', v, 'acciones', a, 'correcciones_hoy', hechas);
end $$;

create or replace function public.tg_admin_guardar(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.tg_config; v_h int; v_nombre text; v_det text := '';
begin
  if not public.es_admin(p_comercio) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  r := public.tg_cfg_row(p_comercio);
  select coalesce(nombre, email, 'admin') into v_nombre from public.miembros where comercio_id = p_comercio and usuario_id = auth.uid();
  if p ? 'activo' then r.activo := coalesce((p->>'activo')::boolean, false); v_det := v_det || ' bot ' || case when r.activo then 'encendido' else 'apagado' end; end if;
  if p ? 'horas' then
    v_h := (p->>'horas')::int;
    if v_h not in (0, 1, 4, 8, 24) then raise exception 'horas: 0, 1, 4, 8 o 24' using errcode = '22023'; end if;
    r.ajuste_hasta := case when v_h = 0 then null else now() + make_interval(hours => v_h) end;
    v_det := v_det || ' · correcciones de stock ' || case when v_h = 0 then 'apagadas' else 'permitidas por ' || v_h || ' h' end;
  end if;
  if p ? 'max_unidades' then r.max_unidades := (p->>'max_unidades')::numeric; v_det := v_det || ' · máx. ' || public.tg_n(r.max_unidades) || ' u'; end if;
  if p ? 'max_valor' then r.max_valor := (p->>'max_valor')::bigint; v_det := v_det || ' · máx. $' || (r.max_valor / 100); end if;
  if p ? 'max_dia' then r.max_dia := (p->>'max_dia')::int; v_det := v_det || ' · ' || r.max_dia || ' por día'; end if;
  if p ? 'ia' then r.ia := coalesce((p->>'ia')::boolean, false); v_det := v_det || ' · IA ' || case when r.ia then 'sí' else 'no' end; end if;
  if p ? 'ia_max_dia' then r.ia_max_dia := (p->>'ia_max_dia')::int; end if;
  if p ? 'alertas' then r.alertas := coalesce((p->>'alertas')::boolean, false); v_det := v_det || ' · alertas ' || case when r.alertas then 'sí' else 'no' end; end if;
  if coalesce((p->>'quitar_grupo')::boolean, false) then r.alertas_chat := null; v_det := v_det || ' · grupo de alertas quitado'; end if;
  update public.tg_config set activo = r.activo, ajuste_hasta = r.ajuste_hasta, max_unidades = r.max_unidades, max_valor = r.max_valor, max_dia = r.max_dia,
         ia = r.ia, ia_max_dia = r.ia_max_dia, alertas = r.alertas, alertas_chat = r.alertas_chat, actualizado = now(), actualizado_por = auth.uid()
   where comercio_id = p_comercio;
  perform public.tg_audit(p_comercio, auth.uid(), v_nombre, 'TELEGRAM_CONFIG', trim(both ' ·' from v_det));
  return public.tg_admin_estado(p_comercio);
end $$;

create or replace function public.tg_codigo_crear(p_comercio uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; u text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); c text := ''; i int;
begin
  if not public.es_admin(p_comercio) then raise exception 'el bot es sólo para administradores' using errcode = '42501'; end if;
  for i in 0..7 loop c := c || substr(abc, (('x' || substr(u, i * 4 + 1, 4))::bit(16)::int % 32) + 1, 1); end loop;
  delete from public.tg_codigos where usuario_id = auth.uid() and comercio_id = p_comercio and usado is null;
  delete from public.tg_codigos where vence < now() - interval '1 day';
  insert into public.tg_codigos (hash, comercio_id, usuario_id, vence) values (encode(sha256(convert_to(c, 'UTF8')), 'hex'), p_comercio, auth.uid(), now() + interval '10 minutes');
  return jsonb_build_object('codigo', c, 'vence', now() + interval '10 minutes');
end $$;

create or replace function public.tg_admin_desvincular(p_comercio uuid, p_tg_user text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_nombre text; n int;
begin
  if not public.es_admin(p_comercio) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  update public.tg_vinculos set activo = false where comercio_id = p_comercio and tg_user_id = p_tg_user::bigint and activo;
  get diagnostics n = row_count;
  select coalesce(nombre, email, 'admin') into v_nombre from public.miembros where comercio_id = p_comercio and usuario_id = auth.uid();
  if n > 0 then perform public.tg_audit(p_comercio, auth.uid(), v_nombre, 'TELEGRAM_DESVINCULADO', 'Telegram ' || p_tg_user); end if;
  return public.tg_admin_estado(p_comercio);
end $$;

-- ---------------------------------------------------------------- funciones del SERVIDOR (sólo service_role)
create or replace function public.tg_srv_comercio(p_slug text) returns uuid language sql stable security definer set search_path = public as $$
  select id from public.comercios where slug = p_slug $$;

create or replace function public.tg_srv_update(p_update_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.tg_updates (update_id) values (p_update_id) on conflict do nothing;
  get diagnostics n = row_count;
  if random() < 0.02 then delete from public.tg_updates where recibido < now() - interval '7 days'; end if;
  return n = 1;
end $$;

create or replace function public.tg_srv_config(p_comercio uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.tg_config;
begin r := public.tg_cfg_row(p_comercio); return public.tg_cfg_json(r) || jsonb_build_object('alertas_chat_id', r.alertas_chat::text); end $$;

create or replace function public.tg_srv_quien(p_comercio uuid, p_tg_user bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.tg_vinculos; m public.miembros;
begin
  select * into v from public.tg_vinculos where comercio_id = p_comercio and tg_user_id = p_tg_user and activo;
  if not found then return jsonb_build_object('ok', false); end if;
  select * into m from public.miembros where comercio_id = p_comercio and usuario_id = v.usuario_id;
  if not found or m.rol <> 'admin' then                        -- dejó de ser administrador: se desvincula solo
    update public.tg_vinculos set activo = false where comercio_id = p_comercio and tg_user_id = p_tg_user;
    return jsonb_build_object('ok', false);
  end if;
  update public.tg_vinculos set ultimo_uso = now() where comercio_id = p_comercio and tg_user_id = p_tg_user;
  return jsonb_build_object('ok', true, 'usuario_id', v.usuario_id, 'nombre', coalesce(m.nombre, m.email, 'admin'), 'rol', m.rol);
end $$;

create or replace function public.tg_srv_vincular(p_comercio uuid, p_tg_user bigint, p_tg_nombre text, p_codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.tg_codigos; m public.miembros; h text := encode(sha256(convert_to(upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g')), 'UTF8')), 'hex');
begin
  select * into c from public.tg_codigos where hash = h and comercio_id = p_comercio for update;
  if not found or c.usado is not null then return jsonb_build_object('ok', false, 'why', 'Código inválido o ya usado. Generá uno nuevo en el sistema (Configuración → R2AVE en Telegram).'); end if;
  if c.vence < now() then return jsonb_build_object('ok', false, 'why', 'El código venció (dura 10 minutos). Generá uno nuevo.'); end if;
  select * into m from public.miembros where comercio_id = p_comercio and usuario_id = c.usuario_id;
  if not found or m.rol <> 'admin' then return jsonb_build_object('ok', false, 'why', 'El bot es sólo para administradores.'); end if;
  update public.tg_codigos set usado = now() where hash = h;
  update public.tg_vinculos set activo = false where comercio_id = p_comercio and usuario_id = c.usuario_id and tg_user_id <> p_tg_user;
  insert into public.tg_vinculos (comercio_id, tg_user_id, usuario_id, tg_nombre, alta, activo)
  values (p_comercio, p_tg_user, c.usuario_id, left(p_tg_nombre, 60), now(), true)
  on conflict (comercio_id, tg_user_id) do update set usuario_id = excluded.usuario_id, tg_nombre = excluded.tg_nombre, alta = now(), activo = true;
  perform public.tg_audit(p_comercio, c.usuario_id, coalesce(m.nombre, m.email, 'admin'), 'TELEGRAM_VINCULADO', 'Telegram ' || coalesce(p_tg_nombre, '') || ' (' || p_tg_user || ')');
  return jsonb_build_object('ok', true, 'nombre', coalesce(m.nombre, m.email, 'admin'));
end $$;

create or replace function public.tg_srv_desvincular(p_comercio uuid, p_tg_user bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare v public.tg_vinculos;
begin
  update public.tg_vinculos set activo = false where comercio_id = p_comercio and tg_user_id = p_tg_user and activo returning * into v;
  if not found then return false; end if;
  perform public.tg_audit(p_comercio, v.usuario_id, 'R2AVE', 'TELEGRAM_DESVINCULADO', 'por la propia persona desde Telegram');
  return true;
end $$;

-- datos de sólo lectura para los informes (lista cerrada de colecciones; los clientes SIN datos personales)
create or replace function public.tg_srv_datos(p_comercio uuid, p_col text, p_desde_ms bigint default 0, p_limite int default 20000) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare lim int := least(greatest(coalesce(p_limite, 20000), 1), 50000); out jsonb;
begin
  if p_col not in ('prod', 'ventas', 'turnos', 'cierres', 'fiado', 'clientes', 'rubros', 'movs', 'cajas') then
    raise exception 'colección no permitida' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(d), '[]'::jsonb) into out from (
    select case when p_col = 'clientes'
                then jsonb_build_object('id', datos->'id', 'num', datos->'num', 'limit', datos->'limit', 'term', datos->'term', 'status', datos->'status')
                else datos end d
      from public.registros
     where comercio_id = p_comercio and coleccion = p_col and not borrado
       and (p_col not in ('ventas', 'cierres', 'movs', 'turnos') or coalesce(p_desde_ms, 0) = 0
            or coalesce(nullif(datos->>'ts', ''), nullif(datos->>'openedAt', ''), '0')::numeric >= p_desde_ms
            or (p_col = 'turnos' and coalesce(nullif(datos->>'closedAt', ''), '0')::numeric = 0))
     order by actualizado desc limit lim) q;
  return out;
end $$;

create or replace function public.tg_srv_pendiente(p_comercio uuid, p_tg_user bigint, p_usuario uuid, p_datos jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_id text := replace(gen_random_uuid()::text, '-', '');
begin
  update public.tg_pendientes set estado = 'vencido' where comercio_id = p_comercio and estado = 'pendiente' and vence < now();
  insert into public.tg_pendientes (id, comercio_id, tg_user_id, usuario_id, datos, vence) values (v_id, p_comercio, p_tg_user, p_usuario, p_datos, now() + interval '5 minutes');
  return v_id;
end $$;

create or replace function public.tg_srv_cancelar(p_comercio uuid, p_tg_user bigint, p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.tg_pendientes set estado = 'cancelado' where id = p_id and comercio_id = p_comercio and tg_user_id = p_tg_user and estado = 'pendiente';
  get diagnostics n = row_count; return n = 1;
end $$;

-- toma (y consume) un pendiente de SELECCIÓN de artículo: sólo la misma persona, dentro de los 5 minutos
create or replace function public.tg_srv_tomar(p_comercio uuid, p_tg_user bigint, p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pd public.tg_pendientes;
begin
  select * into pd from public.tg_pendientes where id = p_id and comercio_id = p_comercio and tg_user_id = p_tg_user and estado = 'pendiente' for update;
  if not found or pd.vence < now() then return null; end if;
  update public.tg_pendientes set estado = 'cancelado' where id = p_id;
  return pd.datos;
end $$;

-- corrección de stock: vuelve a verificar TODO en el momento de confirmar y lo hace en una sola transacción
create or replace function public.tg_srv_ajustar(p_comercio uuid, p_tg_user bigint, p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pd public.tg_pendientes; q jsonb; r public.tg_config; pr public.registros; v_stock numeric; v_fis numeric; v_d numeric; v_cost numeric; v_val numeric;
        hechas int; v_nombre text; v_motivo text; v_unit text; res jsonb;
  rech constant text := 'rechazado';
begin
  select * into pd from public.tg_pendientes where id = p_id and comercio_id = p_comercio for update;
  if not found then return jsonb_build_object('ok', false, 'why', 'No encontré esa corrección.'); end if;
  if pd.estado = 'hecho' then return jsonb_build_object('ok', true, 'ya', true) || coalesce(pd.resultado, '{}'::jsonb); end if;
  if pd.estado <> 'pendiente' then return jsonb_build_object('ok', false, 'why', 'Esa corrección ya está ' || pd.estado || '.'); end if;
  if pd.tg_user_id <> p_tg_user then return jsonb_build_object('ok', false, 'why', 'Sólo la persona que pidió la corrección puede confirmarla.'); end if;
  if coalesce(pd.datos->>'tipo', '') <> 'ajuste' then return jsonb_build_object('ok', false, 'why', 'No encontré esa corrección.'); end if;
  if pd.vence < now() then update public.tg_pendientes set estado = 'vencido' where id = p_id; return jsonb_build_object('ok', false, 'why', 'Pasaron más de 5 minutos: volvé a pedir la corrección.'); end if;
  q := public.tg_srv_quien(p_comercio, p_tg_user);
  if not coalesce((q->>'ok')::boolean, false) then update public.tg_pendientes set estado = rech where id = p_id; return jsonb_build_object('ok', false, 'why', 'No estás autorizado.'); end if;
  r := public.tg_cfg_row(p_comercio);
  if not r.activo or r.ajuste_hasta is null or r.ajuste_hasta <= now() then
    update public.tg_pendientes set estado = rech where id = p_id;
    return jsonb_build_object('ok', false, 'why', 'Las correcciones de stock por Telegram están apagadas. Se habilitan por unas horas en el sistema: Configuración → R2AVE en Telegram.');
  end if;
  select count(*) into hechas from public.tg_pendientes where comercio_id = p_comercio and estado = 'hecho'
     and (creado at time zone 'America/Argentina/Buenos_Aires')::date = public.tg_hoy();
  if hechas >= r.max_dia then update public.tg_pendientes set estado = rech where id = p_id; return jsonb_build_object('ok', false, 'why', 'Ya se hicieron ' || hechas || ' correcciones hoy (máximo ' || r.max_dia || ').'); end if;
  select * into pr from public.registros where comercio_id = p_comercio and coleccion = 'prod' and id = pd.datos->>'pid' and not borrado for update;
  if not found or coalesce((pr.datos->>'active')::boolean, true) = false or coalesce((pr.datos->>'archived')::boolean, false)
     or jsonb_typeof(pr.datos->'kit') = 'array' and jsonb_array_length(pr.datos->'kit') > 0 then
    update public.tg_pendientes set estado = rech where id = p_id; return jsonb_build_object('ok', false, 'why', 'El artículo no existe, está archivado o es un combo.');
  end if;
  v_stock := coalesce(nullif(pr.datos->>'stock', '')::numeric, 0);
  v_fis := (pd.datos->>'fisico')::numeric; v_unit := coalesce(pr.datos->>'unit', 'u'); v_motivo := left(coalesce(pd.datos->>'motivo', ''), 120);
  if v_fis is null or v_fis < 0 then update public.tg_pendientes set estado = rech where id = p_id; return jsonb_build_object('ok', false, 'why', 'La cantidad física no puede ser negativa.'); end if;
  if v_unit = 'u' and v_fis <> trunc(v_fis) then update public.tg_pendientes set estado = rech where id = p_id; return jsonb_build_object('ok', false, 'why', 'Este artículo se cuenta por unidades enteras.'); end if;
  if length(trim(v_motivo)) < 3 then update public.tg_pendientes set estado = rech where id = p_id; return jsonb_build_object('ok', false, 'why', 'Falta el motivo de la corrección.'); end if;
  v_d := round(v_fis - v_stock, 3);
  if v_d = 0 then update public.tg_pendientes set estado = rech where id = p_id; return jsonb_build_object('ok', false, 'why', 'El stock del sistema ya es ' || public.tg_n(v_fis) || ': no hay nada que corregir.'); end if;
  if abs(v_d) > r.max_unidades then update public.tg_pendientes set estado = rech where id = p_id;
    return jsonb_build_object('ok', false, 'why', 'La diferencia (' || public.tg_n(v_d) || ') supera el máximo permitido por Telegram (' || public.tg_n(r.max_unidades) || '). Hacela desde el sistema.'); end if;
  v_cost := coalesce(nullif(pr.datos->>'cost', '')::numeric, 0); v_val := round(abs(v_d) * v_cost);
  if v_val > r.max_valor then update public.tg_pendientes set estado = rech where id = p_id;
    return jsonb_build_object('ok', false, 'why', 'La diferencia vale $' || round(v_val / 100) || ' a costo y supera el máximo permitido por Telegram ($' || round(r.max_valor / 100) || '). Hacela desde el sistema.'); end if;
  -- mismo camino que los equipos: movimiento smov (escritura única) + stock del producto + Auditoría
  insert into public.registros (comercio_id, coleccion, id, datos, dispositivo, usuario_id)
  values (p_comercio, 'smov', 'tg-' || p_id, jsonb_build_object('pid', pd.datos->>'pid', 'd', v_d, 'dev', 'telegram'), 'telegram', (q->>'usuario_id')::uuid);
  update public.registros set datos = jsonb_set(datos, '{stock}', to_jsonb(round(v_stock + v_d, 3))), dispositivo = 'telegram', usuario_id = (q->>'usuario_id')::uuid, actualizado = clock_timestamp()
   where comercio_id = p_comercio and coleccion = 'prod' and id = pr.id;
  v_nombre := trim(coalesce(pr.datos->>'name', '') || ' ' || coalesce(pr.datos->>'sub', ''));
  perform public.tg_audit(p_comercio, (q->>'usuario_id')::uuid, q->>'nombre', 'AJUSTE_STOCK',
    v_nombre || ' ' || case when v_d > 0 then '+' else '' end || public.tg_n(v_d) || ' (' || public.tg_n(v_stock) || ' → ' || public.tg_n(round(v_stock + v_d, 3)) || ') · ' || v_motivo || ' [R2AVE Telegram]');
  res := jsonb_build_object('nombre', v_nombre, 'anterior', trim_scale(v_stock), 'nuevo', trim_scale(round(v_stock + v_d, 3)), 'd', trim_scale(v_d), 'unit', v_unit, 'motivo', v_motivo, 'valor', v_val);
  update public.tg_pendientes set estado = 'hecho', resultado = res where id = p_id;
  return jsonb_build_object('ok', true) || res;
end $$;

create or replace function public.tg_srv_ia(p_comercio uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.tg_config; v_n int;
begin
  r := public.tg_cfg_row(p_comercio);
  if not r.ia or r.ia_max_dia < 1 then return false; end if;
  insert into public.tg_ia_uso as u (comercio_id, dia, n) values (p_comercio, public.tg_hoy(), 1)
  on conflict (comercio_id, dia) do update set n = u.n + 1 where u.n < r.ia_max_dia
  returning u.n into v_n;
  return v_n is not null;
end $$;

create or replace function public.tg_srv_alertas_grupo(p_comercio uuid, p_tg_user bigint, p_chat bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q jsonb;
begin
  q := public.tg_srv_quien(p_comercio, p_tg_user);
  if not coalesce((q->>'ok')::boolean, false) then return jsonb_build_object('ok', false, 'why', 'Sólo un administrador vinculado puede elegir el grupo de alertas.'); end if;
  update public.tg_config set alertas_chat = p_chat, alertas = true, actualizado = now(), actualizado_por = (q->>'usuario_id')::uuid where comercio_id = p_comercio;
  perform public.tg_audit(p_comercio, (q->>'usuario_id')::uuid, q->>'nombre', 'TELEGRAM_CONFIG', 'grupo de alertas elegido');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.tg_srv_alerta_nueva(p_comercio uuid, p_clave text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.tg_alertas_env (comercio_id, clave) values (p_comercio, left(p_clave, 120)) on conflict do nothing;
  get diagnostics n = row_count;
  delete from public.tg_alertas_env where enviado < now() - interval '30 days';
  return n = 1;
end $$;

create or replace function public.tg_srv_webhook_ok(p_comercio uuid) returns void language sql security definer set search_path = public as $$
  update public.tg_config set webhook_ok = now() where comercio_id = p_comercio $$;

-- ---------------------------------------------------------------- permisos
revoke all on function public.tg_n(numeric), public.tg_hoy(), public.tg_audit(uuid, uuid, text, text, text), public.tg_cfg_row(uuid), public.tg_cfg_json(public.tg_config) from public, anon, authenticated;
revoke all on function public.tg_admin_estado(uuid), public.tg_admin_guardar(uuid, jsonb), public.tg_codigo_crear(uuid), public.tg_admin_desvincular(uuid, text) from public, anon;
grant execute on function public.tg_admin_estado(uuid), public.tg_admin_guardar(uuid, jsonb), public.tg_codigo_crear(uuid), public.tg_admin_desvincular(uuid, text) to authenticated;
do $$ declare f text; begin
  foreach f in array array['tg_srv_comercio(text)','tg_srv_update(bigint)','tg_srv_config(uuid)','tg_srv_quien(uuid,bigint)','tg_srv_vincular(uuid,bigint,text,text)',
    'tg_srv_desvincular(uuid,bigint)','tg_srv_datos(uuid,text,bigint,int)','tg_srv_pendiente(uuid,bigint,uuid,jsonb)','tg_srv_cancelar(uuid,bigint,text)',
    'tg_srv_ajustar(uuid,bigint,text)','tg_srv_tomar(uuid,bigint,text)','tg_srv_ia(uuid)','tg_srv_alertas_grupo(uuid,bigint,bigint)','tg_srv_alerta_nueva(uuid,text)','tg_srv_webhook_ok(uuid)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
    execute 'grant execute on function public.' || f || ' to service_role';
  end loop;
end $$;
