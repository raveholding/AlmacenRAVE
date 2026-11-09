-- =====================================================================
-- SISTEMA RAVE · 22 · V26.60 · CRM omnicanal (fase 1, sin costos)
--
-- Correr DESPUÉS de 01..21 (se puede repetir). Aditiva: no borra ni cambia datos.
-- Qué agrega:
--   · Colecciones nuevas del equipo (viajan por sincronizar(), como todo lo demás):
--       conv = conversaciones con clientes (canal, estado, asignada a, etiquetas). La clave del chat web va cifrada (__pii).
--       cmsg = mensajes, notas internas y avisos de cada conversación. Se escribe UNA vez; el texto va cifrado (__pii).
--   · Chat web desde el menú público (sin cuenta, sin costo):
--       crm_entrantes  = mensajes que escribe el cliente. Llegan CIFRADOS con la llave pública del comercio
--                        (la misma del Club): el servidor no puede leerlos.
--       crm_salientes  = respuestas del equipo. Van cifradas con la clave del chat que generó el celular del cliente.
--       crm_web_enviar / crm_web_leer       → anónimas (el cliente), con límites por IP, por chat y por comercio.
--       crm_web_responder / crm_entrantes_marcar → sólo el equipo (admin, supervisor, mostrador).
--   · No guarda datos de tarjeta ni pide pagos: el «cobro asistido» es un mensaje con alias/CBU y se confirma a mano en Caja.
-- =====================================================================
do $mig$
declare
  d text;
  o1 constant text := $o$'ctev','cdet','cortesx','fidmov','giftmov','juego','devol','merma','gift','presup'];$o$;
  n1 constant text := $n$'ctev','cdet','cortesx','fidmov','giftmov','juego','devol','merma','gift','presup','conv','cmsg'];$n$;
  o2 constant text := $o$'cortesx','fidmov','giftmov','juego','devol','merma'];$o$;
  n2 constant text := $n$'cortesx','fidmov','giftmov','juego','devol','merma','cmsg'];$n$;
  o4 constant text := $o$'fidmov','giftmov','juego','devol','merma','gift','presup'$o$;
  n4 constant text := $n$'fidmov','giftmov','juego','devol','merma','gift','presup','conv','cmsg'$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''cmsg''' in d) = 0 then
    if position(o1 in d) = 0 or position(o2 in d) = 0 then
      raise exception '22: no encontré las listas de sincronizar (¿falta correr 20?)';
    end if;
    d := replace(replace(d, o1, n1), o2, n2);
    execute d;
  end if;
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''cmsg''' in d) = 0 then
    if position(o4 in d) = 0 then raise exception '22: no encontré las listas de rave_puede_escribir (¿falta correr 20?)'; end if;
    d := replace(d, o4, n4);
    execute d;
  end if;
end
$mig$;

-- ---------- chat web: mensajes del cliente (cifrados con la llave pública del comercio) ----------
create table if not exists public.crm_entrantes (
  id          bigint generated always as identity primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  creado      timestamptz not null default now(),
  conv        text not null check (conv ~ '^w[A-Za-z0-9_-]{16,40}$'),
  cifrado     jsonb not null,
  ip          text,
  estado      text not null default 'nueva' check (estado in ('nueva','importada','rechazada'))
);
create index if not exists crm_entrantes_estado on public.crm_entrantes (comercio_id, estado, id);
create index if not exists crm_entrantes_conv on public.crm_entrantes (comercio_id, conv);
alter table public.crm_entrantes enable row level security;
drop policy if exists "el equipo ve los mensajes del chat web" on public.crm_entrantes;
create policy "el equipo ve los mensajes del chat web" on public.crm_entrantes for select to authenticated
  using (public.rol_en(comercio_id) in ('admin','supervisor','mostrador'));
revoke all on public.crm_entrantes from anon;
revoke insert, update, delete, truncate on public.crm_entrantes from authenticated;
grant select on public.crm_entrantes to authenticated;

-- ---------- chat web: respuestas del equipo (cifradas con la clave del chat; sólo las lee el celular del cliente) ----------
create table if not exists public.crm_salientes (
  id          bigint generated always as identity primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  creado      timestamptz not null default now(),
  conv        text not null check (conv ~ '^w[A-Za-z0-9_-]{16,40}$'),
  cifrado     jsonb not null
);
create index if not exists crm_salientes_conv on public.crm_salientes (comercio_id, conv, id);
alter table public.crm_salientes enable row level security;
revoke all on public.crm_salientes from anon, authenticated;

-- El cliente escribe. La respuesta es siempre genérica (no revela nada del comercio ni de otros chats).
create or replace function public.crm_web_enviar(p_slug text, p_conv text, p_cifrado jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_c  uuid;
  v_ip text := public.rave_ip();
begin
  select id into v_c from public.comercios where slug = lower(left(coalesce(p_slug, ''), 40));
  if v_c is null or not exists (select 1 from public.menus where comercio_id = v_c) then
    return jsonb_build_object('ok', false, 'error', 'chat no disponible');
  end if;
  if coalesce(p_conv, '') !~ '^w[A-Za-z0-9_-]{16,40}$'
     or jsonb_typeof(p_cifrado) <> 'object' or not (p_cifrado ? 'k' and p_cifrado ? 'iv' and p_cifrado ? 'ct')
     or pg_column_size(p_cifrado) > 6000 then
    return jsonb_build_object('ok', false, 'error', 'datos inválidos');
  end if;
  if v_ip <> '' and (select count(*) from public.crm_entrantes where ip = v_ip and creado > now() - interval '1 hour') >= 40 then
    return jsonb_build_object('ok', false, 'error', 'demasiados mensajes, probá en un rato');
  end if;
  if (select count(*) from public.crm_entrantes where comercio_id = v_c and conv = p_conv and creado > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'demasiados mensajes, probá en un rato');
  end if;
  if (select count(*) from public.crm_entrantes where comercio_id = v_c and creado > now() - interval '1 hour') >= 600 then
    return jsonb_build_object('ok', false, 'error', 'el chat está saturado, probá en un rato');
  end if;
  insert into public.crm_entrantes (comercio_id, conv, cifrado, ip) values (v_c, p_conv, p_cifrado, nullif(v_ip, ''));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.crm_web_enviar(text, text, jsonb) from public;
grant execute on function public.crm_web_enviar(text, text, jsonb) to anon, authenticated;

-- El cliente lee las respuestas de SU chat (el identificador del chat es secreto y sólo lo conoce su celular y el equipo).
create or replace function public.crm_web_leer(p_slug text, p_conv text, p_desde bigint)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_c uuid;
begin
  select id into v_c from public.comercios where slug = lower(left(coalesce(p_slug, ''), 40));
  if v_c is null or coalesce(p_conv, '') !~ '^w[A-Za-z0-9_-]{16,40}$' then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'creado', s.creado, 'cifrado', s.cifrado) order by s.id)
    from (select * from public.crm_salientes
           where comercio_id = v_c and conv = p_conv and id > coalesce(p_desde, 0)
           order by id limit 50) s), '[]'::jsonb);
end $$;
revoke all on function public.crm_web_leer(text, text, bigint) from public;
grant execute on function public.crm_web_leer(text, text, bigint) to anon, authenticated;

-- El equipo responde un chat web que exista en este comercio.
create or replace function public.crm_web_responder(p_comercio uuid, p_conv text, p_cifrado jsonb)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare v_id bigint;
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin','supervisor','mostrador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if coalesce(p_conv, '') !~ '^w[A-Za-z0-9_-]{16,40}$'
     or not exists (select 1 from public.crm_entrantes where comercio_id = p_comercio and conv = p_conv) then
    raise exception 'chat inexistente' using errcode = '22023';
  end if;
  if jsonb_typeof(p_cifrado) <> 'object' or not (p_cifrado ? 'iv' and p_cifrado ? 'ct') or pg_column_size(p_cifrado) > 6000 then
    raise exception 'datos inválidos' using errcode = '22023';
  end if;
  if (select count(*) from public.crm_salientes where comercio_id = p_comercio and creado > now() - interval '1 hour') >= 1000 then
    raise exception 'demasiadas respuestas en una hora' using errcode = '54000';
  end if;
  insert into public.crm_salientes (comercio_id, conv, cifrado) values (p_comercio, p_conv, p_cifrado) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.crm_web_responder(uuid, text, jsonb) from public, anon;
grant execute on function public.crm_web_responder(uuid, text, jsonb) to authenticated;

create or replace function public.crm_entrantes_marcar(p_comercio uuid, p_ids bigint[], p_estado text)
returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin','supervisor','mostrador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_estado not in ('importada','rechazada') then raise exception 'estado inválido'; end if;
  update public.crm_entrantes set estado = p_estado
   where comercio_id = p_comercio and id = any(p_ids) and estado = 'nueva';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.crm_entrantes_marcar(uuid, bigint[], text) from public, anon;
grant execute on function public.crm_entrantes_marcar(uuid, bigint[], text) to authenticated;
