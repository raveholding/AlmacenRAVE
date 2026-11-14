-- =====================================================================
-- 29 · V26.74 · CRM omnicanal (conexión automática OAuth, eventos y webhooks, claves de API) y Finanzas para comercios
-- Correr DESPUÉS de 01 a 28. Aditivo e idempotente (se puede repetir). No borra ni cambia datos.
--
-- Qué agrega (todo queda APAGADO hasta que se carguen los secretos de cada proveedor en la función correspondiente):
--  1) oauth_estados + oauth_cuentas: conexión «con un clic» de Gmail (Google), Outlook / Office 365 (Microsoft) y WhatsApp Business /
--     Instagram / Messenger (Meta Embedded Signup) desde la función «conectar». Los tokens se guardan CIFRADOS (AES-256-GCM) y sólo
--     la clave de servicio los lee. El equipo ve las cuentas conectadas (sin tokens) con oauth_cuentas_ver.
--  2) vb_eventos + wh_destinos + wh_cola: eventos del comercio (message.received, conversation.closed, contact.created, sale.created)
--     que se generan solos en la base y se envían a webhooks propios firmados con HMAC-SHA256 (función «eventos»). Los eventos llevan
--     identificadores y estados, nunca textos ni datos personales.
--  3) api_claves: claves de API por comercio (se muestran UNA vez; se guarda sólo su huella SHA-256), con alcance y revocación.
--  4) mp_pagos: cobros de Mercado Pago Point recibidos por webhook (función «mpago»), para conciliar con las ventas.
--  5) Colecciones nuevas de la sincronización: finmov (movimientos de banco y billeteras), finrem (recordatorios enviados), kb (base de
--     conocimiento de Atención al cliente). Escriben administrador y supervisor.
--  6) pg_cron (si existe): despierta «eventos» y «conectar» cada minuto (si no, los despierta el sistema abierto).
-- =====================================================================

-- ---------- 1) OAuth ----------
create table if not exists public.oauth_estados (
  n          text primary key check (n ~ '^[A-Za-z0-9_-]{20,64}$'),
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  usuario_id uuid,
  proveedor  text not null check (proveedor in ('google', 'microsoft', 'meta')),
  verifier   text not null,
  expira     timestamptz not null default now() + interval '10 minutes'
);
create table if not exists public.oauth_cuentas (
  id          uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  proveedor   text not null check (proveedor in ('google', 'microsoft', 'meta')),
  cuenta      text not null check (length(cuenta) between 3 and 200),
  token_cif   text not null,
  expira      timestamptz,
  estado      text not null default 'activa' check (estado in ('activa', 'revocada', 'error')),
  datos       jsonb not null default '{}'::jsonb,
  error       text,
  creado      timestamptz not null default now(),
  renovado    timestamptz,
  ultimo_sync timestamptz,
  unique (comercio_id, proveedor, cuenta)
);
alter table public.oauth_estados enable row level security;
alter table public.oauth_cuentas enable row level security;
revoke all on public.oauth_estados, public.oauth_cuentas from public, anon, authenticated;

create or replace function public.oauth_cuentas_ver(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if public.rol_en(p_comercio) is null then raise exception 'sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'proveedor', proveedor, 'cuenta', cuenta, 'estado', estado, 'expira', expira,
            'error', error, 'creado', creado, 'renovado', renovado, 'ultimo_sync', ultimo_sync,
            'canales', coalesce(datos->'canales', '[]'::jsonb)) order by proveedor, cuenta)
          from public.oauth_cuentas where comercio_id = p_comercio), '[]'::jsonb);
end $$;

-- ---------- 2) eventos y webhooks ----------
create table if not exists public.vb_eventos (
  id          bigint generated always as identity primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  evento      text not null,
  datos       jsonb not null default '{}'::jsonb,
  creado      timestamptz not null default now()
);
create index if not exists vb_eventos_com on public.vb_eventos (comercio_id, id);
create table if not exists public.wh_destinos (
  id          uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  url         text not null check (url ~ '^https://' and length(url) <= 400),
  secreto     text not null,
  eventos     text[] not null,
  activo      boolean not null default true,
  creado      timestamptz not null default now(),
  fallas      int not null default 0
);
create table if not exists public.wh_cola (
  id          bigint generated always as identity primary key,
  destino_id  uuid not null references public.wh_destinos(id) on delete cascade,
  evento_id   bigint not null references public.vb_eventos(id) on delete cascade,
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'enviando', 'enviado', 'error')),
  intentos    int not null default 0,
  codigo      int,
  due         timestamptz not null default now(),
  tomado      timestamptz,
  unique (destino_id, evento_id)
);
create index if not exists wh_cola_due on public.wh_cola (estado, due);
alter table public.vb_eventos enable row level security;
alter table public.wh_destinos enable row level security;
alter table public.wh_cola enable row level security;
revoke all on public.vb_eventos, public.wh_destinos, public.wh_cola from public, anon, authenticated;

create or replace function public.vb_emitir(p_comercio uuid, p_evento text, p_datos jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  insert into public.vb_eventos (comercio_id, evento, datos) values (p_comercio, p_evento, coalesce(p_datos, '{}'::jsonb)) returning id into v_id;
  insert into public.wh_cola (destino_id, evento_id)
  select d.id, v_id from public.wh_destinos d where d.comercio_id = p_comercio and d.activo and p_evento = any(d.eventos)
  on conflict do nothing;
  if random() < 0.02 then delete from public.vb_eventos where comercio_id = p_comercio and creado < now() - interval '30 days'; end if;   -- se guardan 30 días
end $$;
revoke all on function public.vb_emitir(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.vb_ev_registros() returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.borrado then return new; end if;
  if new.coleccion = 'clientes' and tg_op = 'INSERT' then
    perform public.vb_emitir(new.comercio_id, 'contact.created', jsonb_build_object('id', new.id));
  elsif new.coleccion = 'ventas' and tg_op = 'INSERT' then
    perform public.vb_emitir(new.comercio_id, 'sale.created', jsonb_build_object('id', new.id, 'numero', new.datos->>'n', 'total_centavos', (new.datos->>'total')::bigint, 'estado', new.datos->>'status'));
  elsif new.coleccion = 'conv' and new.datos->>'state' = 'cerrado' and (tg_op = 'INSERT' or coalesce(old.datos->>'state', '') <> 'cerrado') then
    perform public.vb_emitir(new.comercio_id, 'conversation.closed', jsonb_build_object('id', new.id, 'canal', new.datos->>'chan', 'csat', new.datos->'csat'));
  end if;
  return new;
exception when others then return new;   -- un evento nunca frena la sincronización
end $$;
drop trigger if exists vb_ev_registros on public.registros;
create trigger vb_ev_registros after insert or update on public.registros for each row execute function public.vb_ev_registros();

create or replace function public.vb_ev_entrantes() returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.vb_emitir(new.comercio_id, 'message.received', jsonb_build_object('conversacion', new.conv, 'canal', substring(new.conv from '^w([a-z]+)-')));
  return new;
exception when others then return new;
end $$;
drop trigger if exists vb_ev_entrantes on public.crm_entrantes;
create trigger vb_ev_entrantes after insert on public.crm_entrantes for each row execute function public.vb_ev_entrantes();

create or replace function public.wh_crear(p_comercio uuid, p_url text, p_eventos text[])
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_s text := 'whsec_' || encode(extensions.gen_random_bytes(24), 'hex'); v_id uuid;
begin
  if not coalesce(public.es_admin(p_comercio), false) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  if coalesce(p_url, '') !~ '^https://[a-z0-9.-]+\.[a-z]{2,}(:[0-9]{2,5})?(/[^\s<>"]*)?$' or length(p_url) > 400
     or p_url ~* '^https://(localhost|127\.|10\.|192\.168\.|169\.254\.|[^/]*\.supabase\.co/rest)' then
    raise exception 'la dirección tiene que ser https pública' using errcode = '22023'; end if;
  if p_eventos is null or cardinality(p_eventos) = 0 or not (p_eventos <@ array['message.received', 'conversation.closed', 'contact.created', 'sale.created']) then
    raise exception 'eventos inválidos' using errcode = '22023'; end if;
  if (select count(*) from public.wh_destinos where comercio_id = p_comercio) >= 10 then raise exception 'hasta 10 webhooks por comercio' using errcode = '22023'; end if;
  insert into public.wh_destinos (comercio_id, url, secreto, eventos) values (p_comercio, p_url, v_s, p_eventos) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'secreto', v_s);   -- el secreto se muestra UNA vez
end $$;
create or replace function public.wh_listar(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not coalesce(public.es_admin(p_comercio), false) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'url', d.url, 'eventos', d.eventos, 'activo', d.activo, 'fallas', d.fallas, 'creado', d.creado,
      'enviados', (select count(*) from public.wh_cola q where q.destino_id = d.id and q.estado = 'enviado'),
      'errores', (select count(*) from public.wh_cola q where q.destino_id = d.id and q.estado = 'error'),
      'pendientes', (select count(*) from public.wh_cola q where q.destino_id = d.id and q.estado in ('pendiente', 'enviando'))) order by d.creado)
    from public.wh_destinos d where d.comercio_id = p_comercio), '[]'::jsonb);
end $$;
create or replace function public.wh_borrar(p_comercio uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if not coalesce(public.es_admin(p_comercio), false) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  delete from public.wh_destinos where comercio_id = p_comercio and id = p_id; get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;
create or replace function public.wh_probar(p_comercio uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(public.es_admin(p_comercio), false) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  insert into public.vb_eventos (comercio_id, evento, datos) values (p_comercio, 'ping', jsonb_build_object('prueba', true));
  insert into public.wh_cola (destino_id, evento_id) select d.id, (select max(id) from public.vb_eventos where comercio_id = p_comercio and evento = 'ping')
    from public.wh_destinos d where d.comercio_id = p_comercio and d.activo on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.wh_tomar(p_lim int)
returns table (id bigint, url text, secreto text, evento text, evento_id bigint, comercio_id uuid, datos jsonb, creado timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
begin
  update public.wh_cola q set estado = 'pendiente' where q.estado = 'enviando' and q.tomado < now() - interval '10 minutes';
  return query
  with t as (select q.id from public.wh_cola q join public.wh_destinos d on d.id = q.destino_id
              where q.estado = 'pendiente' and q.due <= now() and d.activo order by q.id limit greatest(1, least(coalesce(p_lim, 50), 200)) for update of q skip locked)
  update public.wh_cola q set estado = 'enviando', tomado = now(), intentos = q.intentos + 1 from t, public.wh_destinos d, public.vb_eventos e
   where q.id = t.id and d.id = q.destino_id and e.id = q.evento_id
  returning q.id, d.url, d.secreto, e.evento, e.id, e.comercio_id, e.datos, e.creado;
end $$;
create or replace function public.wh_resultado(p_id bigint, p_ok boolean, p_codigo int)
returns void language plpgsql security definer set search_path = public
as $$
declare v_d uuid; v_i int;
begin
  select destino_id, intentos into v_d, v_i from public.wh_cola where id = p_id and estado = 'enviando';
  if not found then return; end if;
  if p_ok then
    update public.wh_cola set estado = 'enviado', codigo = p_codigo where id = p_id;
    update public.wh_destinos set fallas = 0 where id = v_d;
  elsif v_i < 6 then
    update public.wh_cola set estado = 'pendiente', codigo = p_codigo, due = now() + make_interval(mins => power(2, v_i)::int) where id = p_id;
  else
    update public.wh_cola set estado = 'error', codigo = p_codigo where id = p_id;
    update public.wh_destinos set fallas = fallas + 1, activo = (fallas + 1) < 20 where id = v_d;   -- 20 eventos perdidos seguidos: se pausa
  end if;
end $$;
revoke all on function public.wh_tomar(int) from public, anon, authenticated;
revoke all on function public.wh_resultado(bigint, boolean, int) from public, anon, authenticated;

-- ---------- 3) claves de API ----------
create table if not exists public.api_claves (
  id          uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  nombre      text not null check (length(nombre) between 1 and 60),
  prefijo     text not null,
  huella      text not null unique,
  alcance     text[] not null default '{eventos:leer}',
  creada      timestamptz not null default now(),
  revocada    timestamptz,
  ultimo_uso  timestamptz
);
alter table public.api_claves enable row level security;
revoke all on public.api_claves from public, anon, authenticated;
create or replace function public.api_clave_crear(p_comercio uuid, p_nombre text, p_alcance text[])
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_k text := 'vb_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not coalesce(public.es_admin(p_comercio), false) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_nombre, ''))) not between 1 and 60 then raise exception 'poné un nombre' using errcode = '22023'; end if;
  if p_alcance is null or cardinality(p_alcance) = 0 or not (p_alcance <@ array['eventos:leer']) then raise exception 'alcance inválido' using errcode = '22023'; end if;
  if (select count(*) from public.api_claves where comercio_id = p_comercio and revocada is null) >= 10 then raise exception 'hasta 10 claves activas' using errcode = '22023'; end if;
  insert into public.api_claves (comercio_id, nombre, prefijo, huella, alcance) values (p_comercio, btrim(p_nombre), left(v_k, 9), encode(extensions.digest(v_k, 'sha256'), 'hex'), p_alcance);
  return jsonb_build_object('ok', true, 'clave', v_k);   -- se muestra UNA vez: se guarda sólo la huella
end $$;
create or replace function public.api_claves_listar(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not coalesce(public.es_admin(p_comercio), false) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'prefijo', prefijo, 'alcance', alcance, 'creada', creada, 'revocada', revocada, 'ultimo_uso', ultimo_uso) order by creada)
    from public.api_claves where comercio_id = p_comercio), '[]'::jsonb);
end $$;
create or replace function public.api_clave_revocar(p_comercio uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if not coalesce(public.es_admin(p_comercio), false) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  update public.api_claves set revocada = now() where comercio_id = p_comercio and id = p_id and revocada is null; get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;
-- la función «eventos» valida la clave (sólo con la clave de servicio) y devuelve los eventos del comercio dueño de la clave
create or replace function public.api_eventos(p_clave text, p_desde bigint, p_lim int)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare k record;
begin
  select * into k from public.api_claves where huella = encode(extensions.digest(coalesce(p_clave, ''), 'sha256'), 'hex') and revocada is null;
  if not found or not ('eventos:leer' = any(k.alcance)) then return jsonb_build_object('ok', false, 'error', 'clave inválida'); end if;
  update public.api_claves set ultimo_uso = now() where id = k.id;
  return jsonb_build_object('ok', true, 'eventos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'evento', evento, 'datos', datos, 'creado', creado) order by id)
    from (select * from public.vb_eventos where comercio_id = k.comercio_id and id > coalesce(p_desde, 0) order by id limit greatest(1, least(coalesce(p_lim, 100), 500))) x), '[]'::jsonb));
end $$;
revoke all on function public.api_eventos(text, bigint, int) from public, anon, authenticated;

-- ---------- 4) Mercado Pago Point ----------
create table if not exists public.mp_pagos (
  id          text not null check (id ~ '^[0-9]{1,24}$'),
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  monto       bigint not null,
  neto        bigint,
  estado      text not null,
  medio       text,
  terminal    text,
  referencia  text,
  fecha       timestamptz not null,
  recibido    timestamptz not null default now(),
  primary key (comercio_id, id)
);
alter table public.mp_pagos enable row level security;
revoke all on public.mp_pagos from public, anon, authenticated;
create or replace function public.mp_pagos_leer(p_comercio uuid, p_desde timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin', 'supervisor', 'contador') then raise exception 'sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'monto', monto, 'neto', neto, 'estado', estado, 'medio', medio, 'terminal', terminal, 'referencia', referencia, 'fecha', fecha) order by fecha desc)
    from public.mp_pagos where comercio_id = p_comercio and fecha >= coalesce(p_desde, now() - interval '30 days')), '[]'::jsonb);
end $$;

-- ---------- 5) despertador (pg_cron si existe) ----------
create or replace function public.vb_tick() returns void language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  for r in select clave, valor from public.push_ajustes where clave in ('url_eventos', 'url_conectar') loop
    if r.valor ~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/(eventos|conectar)$'
       and (r.clave <> 'url_eventos' or exists (select 1 from public.wh_cola where estado = 'pendiente' and due <= now())) then
      begin
        execute 'select net.http_post(url := $1, body := ''{"accion":"procesar"}''::jsonb, headers := ''{"content-type":"application/json"}''::jsonb)' using r.valor;
      exception when others then null;
      end;
    end if;
  end loop;
end $$;
revoke all on function public.vb_tick() from public, anon, authenticated;
create or replace function public.vb_urls(p_comercio uuid, p_base text)
returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(public.es_admin(p_comercio), false) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  if p_base !~ '^https://[a-z0-9-]+\.supabase\.co$' then raise exception 'dirección inválida' using errcode = '22023'; end if;
  insert into public.push_ajustes (clave, valor) values ('url_eventos', p_base || '/functions/v1/eventos'), ('url_conectar', p_base || '/functions/v1/conectar')
  on conflict (clave) do update set valor = excluded.valor;
  return jsonb_build_object('ok', true);
end $$;
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin execute $j$select cron.schedule('svb-eventos', '* * * * *', 'select public.vb_tick()')$j$;
    exception when others then raise notice '29: no se pudo programar pg_cron (%)', sqlerrm; end;
  else
    raise notice '29: sin pg_cron: los webhooks y la sincronización de correo corren cuando el sistema está abierto';
  end if;
end
$cron$;

-- ---------- permisos de ejecución ----------
revoke all on function public.oauth_cuentas_ver(uuid) from public, anon;            grant execute on function public.oauth_cuentas_ver(uuid) to authenticated;
revoke all on function public.wh_crear(uuid, text, text[]) from public, anon;        grant execute on function public.wh_crear(uuid, text, text[]) to authenticated;
revoke all on function public.wh_listar(uuid) from public, anon;                    grant execute on function public.wh_listar(uuid) to authenticated;
revoke all on function public.wh_borrar(uuid, uuid) from public, anon;              grant execute on function public.wh_borrar(uuid, uuid) to authenticated;
revoke all on function public.wh_probar(uuid) from public, anon;                    grant execute on function public.wh_probar(uuid) to authenticated;
revoke all on function public.api_clave_crear(uuid, text, text[]) from public, anon; grant execute on function public.api_clave_crear(uuid, text, text[]) to authenticated;
revoke all on function public.api_claves_listar(uuid) from public, anon;            grant execute on function public.api_claves_listar(uuid) to authenticated;
revoke all on function public.api_clave_revocar(uuid, uuid) from public, anon;      grant execute on function public.api_clave_revocar(uuid, uuid) to authenticated;
revoke all on function public.mp_pagos_leer(uuid, timestamptz) from public, anon;   grant execute on function public.mp_pagos_leer(uuid, timestamptz) to authenticated;
revoke all on function public.vb_urls(uuid, text) from public, anon;                grant execute on function public.vb_urls(uuid, text) to authenticated;

-- ---------- 6) sincronización: finmov, finrem, kb ----------
do $mig$
declare
  d text;
  o1 constant text := $o$'fincmp','finrec','pushc'];$o$;
  n1 constant text := $n$'fincmp','finrec','pushc','finmov','finrem','kb'];$n$;
  o3 constant text := $o$'pcta','fincmp','finrec','pushc')$o$;
  n3 constant text := $n$'pcta','fincmp','finrec','pushc','finmov','finrem','kb')$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''finmov''' in d) = 0 then
    if position(o1 in d) = 0 then raise exception '29: no encontré las listas de sincronizar (¿falta correr 28?)'; end if;
    execute replace(d, o1, n1);   -- suma a «todas» y a «se pueden borrar»
  end if;
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''finmov''' in d) = 0 then
    if position(o3 in d) = 0 then raise exception '29: no encontré la lista del supervisor (¿falta correr 28?)'; end if;
    execute replace(d, o3, n3);
  end if;
end
$mig$;

-- ---------- 7) endurecimiento (avisos del asesor de seguridad de Supabase) ----------
alter function public.push_host_ok(text) set search_path = public;
alter function public.push_dist_m(double precision, double precision, double precision, double precision) set search_path = public;
revoke all on function public.vb_ev_registros() from public, anon, authenticated;
revoke all on function public.vb_ev_entrantes() from public, anon, authenticated;
