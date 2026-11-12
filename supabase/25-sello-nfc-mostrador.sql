-- =====================================================================
-- 25 · V26.67 · Sello por chip NFC en el mostrador (el cliente acerca SU celular)
-- Correr DESPUÉS de 01 a 24. Aditivo e idempotente (se puede repetir).
--
-- Cómo funciona:
--  · En el mostrador hay un chip NFC (sticker NTAG213/215) grabado con un enlace del tipo
--      https://…/AlmacenRAVE/#sello=p<token>
--    y al lado el MISMO enlace como QR (para celulares sin NFC).
--  · El cliente acerca el celular: se abre el menú, que toma su tarjeta del Club guardada en ESE celular,
--    arma un código de un solo uso (RAVE2|tarjeta|código de 4, el mismo de siempre) y lo manda CIFRADO con la
--    llave pública del comercio (club_pedir_sello). El servidor no puede leerlo ni validarlo: sólo lo guarda.
--  · El sistema del mostrador (abierto y con la nube) lo descifra, valida el código (vencimiento, un solo uso,
--    un sello cada 24 h) y, según la configuración, lo aprueba solo o le pregunta al cajero. Después marca el
--    resultado (sello_resolver) y el celular del cliente lo ve (club_sello_estado, sin datos personales).
--  · Un chip copiado o un enlace compartido no alcanza: hace falta la tarjeta (con su clave) en el celular y,
--    en el modo recomendado, que el cajero apruebe. Hay límites por IP, por punto y por comercio.
-- =====================================================================

create table if not exists public.sello_puntos (
  id          bigint generated always as identity primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  token       text not null unique check (token ~ '^p[A-Za-z0-9_-]{16,40}$'),
  nombre      text not null default 'Mostrador' check (length(nombre) between 1 and 60),
  activo      boolean not null default true,
  creado      timestamptz not null default now()
);
create index if not exists sello_puntos_c on public.sello_puntos (comercio_id);
alter table public.sello_puntos enable row level security;
drop policy if exists "el equipo ve sus puntos de sello" on public.sello_puntos;
create policy "el equipo ve sus puntos de sello" on public.sello_puntos for select to authenticated
  using (public.rol_en(comercio_id) in ('admin','supervisor','mostrador'));
revoke all on public.sello_puntos from anon;
revoke insert, update, delete, truncate on public.sello_puntos from authenticated;
grant select on public.sello_puntos to authenticated;

create table if not exists public.sello_pedidos (
  id          bigint generated always as identity primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  punto_id    bigint not null references public.sello_puntos(id) on delete cascade,
  ref         text not null unique check (ref ~ '^[A-Za-z0-9_-]{16,40}$'),
  cifrado     jsonb not null,
  ip          text,
  creado      timestamptz not null default now(),
  estado      text not null default 'nuevo' check (estado in ('nuevo','espera','aprobado','rechazado','vencido')),
  detalle     text check (detalle is null or length(detalle) <= 160),
  resuelto    timestamptz
);
create index if not exists sello_pedidos_estado on public.sello_pedidos (comercio_id, estado, id);
alter table public.sello_pedidos enable row level security;
drop policy if exists "el equipo ve los pedidos de sello" on public.sello_pedidos;
create policy "el equipo ve los pedidos de sello" on public.sello_pedidos for select to authenticated
  using (public.rol_en(comercio_id) in ('admin','supervisor','mostrador'));
revoke all on public.sello_pedidos from anon;
revoke insert, update, delete, truncate on public.sello_pedidos from authenticated;
grant select on public.sello_pedidos to authenticated;

-- El administrador crea, renombra o desactiva un punto (el token lo genera su navegador).
create or replace function public.sello_punto_guardar(p_comercio uuid, p_token text, p_nombre text, p_activo boolean)
returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  if public.rol_en(p_comercio) is distinct from 'admin' then
    raise exception 'sólo el administrador configura los puntos de sello' using errcode = '42501';
  end if;
  if coalesce(p_token,'') !~ '^p[A-Za-z0-9_-]{16,40}$' then raise exception 'punto inválido' using errcode = '22023'; end if;
  insert into public.sello_puntos (comercio_id, token, nombre, activo)
       values (p_comercio, p_token, left(coalesce(nullif(trim(p_nombre),''),'Mostrador'),60), coalesce(p_activo,true))
  on conflict (token) do update set nombre = excluded.nombre, activo = excluded.activo
       where public.sello_puntos.comercio_id = p_comercio;
  if not exists (select 1 from public.sello_puntos where token = p_token and comercio_id = p_comercio) then
    raise exception 'punto inválido' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.sello_punto_guardar(uuid, text, text, boolean) from public, anon;
grant execute on function public.sello_punto_guardar(uuid, text, text, boolean) to authenticated;

-- El celular del cliente pide el sello. Respuestas genéricas (no revela nada del comercio ni de otros clientes).
create or replace function public.club_pedir_sello(p_slug text, p_punto text, p_ref text, p_cifrado jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_c uuid; v_p bigint; v_ip text := public.rave_ip();
begin
  select id into v_c from public.comercios where slug = lower(left(coalesce(p_slug,''),40));
  if v_c is null then return jsonb_build_object('ok', false, 'error', 'no disponible'); end if;
  select id into v_p from public.sello_puntos where comercio_id = v_c and token = p_punto and activo;
  if v_p is null then return jsonb_build_object('ok', false, 'error', 'este punto de sello no está activo'); end if;
  if coalesce(p_ref,'') !~ '^[A-Za-z0-9_-]{16,40}$'
     or jsonb_typeof(p_cifrado) <> 'object' or not (p_cifrado ? 'k' and p_cifrado ? 'iv' and p_cifrado ? 'ct')
     or pg_column_size(p_cifrado) > 3000 then
    return jsonb_build_object('ok', false, 'error', 'datos inválidos');
  end if;
  if v_ip <> '' and (select count(*) from public.sello_pedidos where ip = v_ip and creado > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'demasiados pedidos, probá en un rato');
  end if;
  if (select count(*) from public.sello_pedidos where punto_id = v_p and creado > now() - interval '10 minutes') >= 60
     or (select count(*) from public.sello_pedidos where comercio_id = v_c and creado > now() - interval '1 hour') >= 400 then
    return jsonb_build_object('ok', false, 'error', 'hay muchos pedidos, pedile el sello al cajero');
  end if;
  insert into public.sello_pedidos (comercio_id, punto_id, ref, cifrado, ip) values (v_c, v_p, p_ref, p_cifrado, nullif(v_ip,''))
  on conflict (ref) do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.club_pedir_sello(text, text, text, jsonb) from public;
grant execute on function public.club_pedir_sello(text, text, text, jsonb) to anon, authenticated;

-- El celular consulta cómo quedó SU pedido (sólo con su referencia secreta; sin datos personales).
create or replace function public.club_sello_estado(p_slug text, p_ref text)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_c uuid; r record;
begin
  select id into v_c from public.comercios where slug = lower(left(coalesce(p_slug,''),40));
  if v_c is null or coalesce(p_ref,'') !~ '^[A-Za-z0-9_-]{16,40}$' then return jsonb_build_object('ok', false); end if;
  select estado, detalle, creado into r from public.sello_pedidos where comercio_id = v_c and ref = p_ref;
  if not found then return jsonb_build_object('ok', true, 'estado', 'desconocido'); end if;
  return jsonb_build_object('ok', true,
    'estado', case when r.estado in ('nuevo','espera') and r.creado < now() - interval '6 minutes' then 'vencido' else r.estado end,
    'detalle', r.detalle);
end $$;
revoke all on function public.club_sello_estado(text, text) from public;
grant execute on function public.club_sello_estado(text, text) to anon, authenticated;

-- El equipo marca el resultado (lo valida el sistema del mostrador, que es el único que puede leer el pedido).
create or replace function public.sello_resolver(p_comercio uuid, p_id bigint, p_estado text, p_detalle text)
returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  if public.rol_en(p_comercio) is null or public.rol_en(p_comercio) not in ('admin','supervisor','mostrador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_estado not in ('espera','aprobado','rechazado','vencido') then raise exception 'estado inválido' using errcode = '22023'; end if;
  update public.sello_pedidos set estado = p_estado, detalle = left(p_detalle,160),
         resuelto = case when p_estado = 'espera' then null else now() end
   where id = p_id and comercio_id = p_comercio and estado in ('nuevo','espera');
  return jsonb_build_object('ok', found);
end $$;
revoke all on function public.sello_resolver(uuid, bigint, text, text) from public, anon;
grant execute on function public.sello_resolver(uuid, bigint, text, text) to authenticated;
