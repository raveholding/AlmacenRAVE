-- =====================================================================
-- 35-licencias-respaldos.sql · Consola Vincular Business y respaldos automáticos
--  · Prueba gratis automática de 30 días para cada comercio NUEVO (los
--    existentes siguen sin licencia = sin restricciones).
--  · Contacto del cliente, avisos enviados y «pago informado» en la licencia.
--  · Acciones de alta/baja para el equipo VB (vb_licencia_accion). La baja
--    nunca borra datos: primero hace un respaldo.
--  · Respaldos diarios automáticos de cada comercio (pg_cron 03:15 ART):
--    se guardan 7 diarios + 4 semanales (domingos), comprimidos, sin acceso
--    directo desde la API. Solo el equipo VB y el dueño pueden descargarlos.
-- Aditivo e idempotente. Requiere 01 a 34. vb_version() = 35.
-- =====================================================================

alter table public.licencias add column if not exists contacto_nombre   text;
alter table public.licencias add column if not exists contacto_whatsapp text;
alter table public.licencias add column if not exists avisos            jsonb not null default '{}'::jsonb;
alter table public.licencias add column if not exists pago_informado    timestamptz;

-- ---------- sistemas propios de Vincular Business: nunca vencen ni se dan de baja ----------
create table if not exists public.vb_propios (
  comercio_id uuid primary key references public.comercios(id) on delete cascade,
  nota text, creado timestamptz not null default now()
);
alter table public.vb_propios enable row level security;
revoke all on public.vb_propios from public, anon, authenticated;
insert into public.vb_propios(comercio_id, nota)
  select id, 'Sistema propio de Vincular Business (sin vencimientos)' from public.comercios where nombre = 'Almacén RAVE'
  on conflict do nothing;
-- por las dudas: un sistema propio no tiene licencia
delete from public.licencias where comercio_id in (select comercio_id from public.vb_propios);

-- ---------- estado efectivo (amplía el de 32) ----------
create or replace function public.vb_lic_json(l public.licencias)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'plan', l.plan, 'paquetes', to_jsonb(l.paquetes), 'estado_cargado', l.estado,
    'vence', l.vence, 'gracia_dias', l.gracia_dias,
    'estado', case
      when l.estado = 'suspendida' then 'suspendida'
      when l.vence is null or l.vence >= current_date then l.estado
      when l.vence + l.gracia_dias >= current_date then 'gracia'
      else 'vencida' end,
    'dias', case when l.vence is null then null else l.vence - current_date end,
    'contacto_nombre', l.contacto_nombre, 'contacto_whatsapp', l.contacto_whatsapp,
    'avisos', l.avisos, 'pago_informado', l.pago_informado, 'nota', l.nota)
$$;

-- ---------- prueba gratis automática para comercios nuevos ----------
create or replace function public.vb_lic_prueba_nueva()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists(select 1 from public.vb_propios where comercio_id = new.id) then return new; end if;
  insert into public.licencias(comercio_id, plan, estado, vence, nota, actualizado_por)
  values (new.id, 'esencial', 'prueba', current_date + 30, 'Prueba gratis automática', 'sistema')
  on conflict (comercio_id) do nothing;
  return new;
end $$;
drop trigger if exists vb_lic_prueba_nueva on public.comercios;
create trigger vb_lic_prueba_nueva after insert on public.comercios
  for each row execute function public.vb_lic_prueba_nueva();

-- ---------- respaldos ----------
create table if not exists public.respaldos (
  id          bigint generated always as identity primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  creado      timestamptz not null default now(),
  tipo        text not null default 'diario' check (tipo in ('diario','semanal','manual','previo')),
  filas       int not null,
  bytes       int not null,
  sha256      text not null,
  hasta       timestamptz,
  datos       text not null
);
do $$ begin
  begin alter table public.respaldos alter column datos set compression lz4; exception when others then null; end;
end $$;
create index if not exists respaldos_comercio on public.respaldos(comercio_id, creado desc);
alter table public.respaldos enable row level security;
revoke all on public.respaldos from public, anon, authenticated;

-- Crea un respaldo de un comercio (uso interno: lo llaman el cron y las funciones de abajo).
create or replace function public.vb_respaldo_hacer(p_comercio uuid, p_tipo text default 'manual')
returns jsonb language plpgsql security definer set search_path = public as $$
declare t text; n int; h timestamptz; rid bigint;
begin
  select count(*), max(actualizado),
         jsonb_build_object('formato','vb-respaldo-1','comercio',p_comercio,'creado',now(),
           'registros', coalesce(jsonb_agg(jsonb_build_object('c',coleccion,'i',id,'d',datos,'b',borrado,'u',actualizado)
                                  order by coleccion, id), '[]'::jsonb))::text
    into n, h, t
    from public.registros where comercio_id = p_comercio;
  insert into public.respaldos(comercio_id, tipo, filas, bytes, sha256, hasta, datos)
  values (p_comercio, p_tipo, n, octet_length(t), encode(extensions.digest(t,'sha256'),'hex'), h, t)
  returning id into rid;
  return jsonb_build_object('id', rid, 'filas', n, 'bytes', octet_length(t));
end $$;
revoke all on function public.vb_respaldo_hacer(uuid,text) from public, anon, authenticated;

-- Respaldo diario de todos los comercios + limpieza (7 diarios, 4 semanales; manuales/previos: 90 días).
create or replace function public.vb_respaldos_tick()
returns int language plpgsql security definer set search_path = public as $$
declare c record; k int := 0; ultimo timestamptz; cambio timestamptz;
begin
  for c in select id from public.comercios loop
    select max(creado) into ultimo from public.respaldos where comercio_id = c.id and tipo in ('diario','semanal');
    select max(actualizado) into cambio from public.registros where comercio_id = c.id;
    -- sin cambios desde el último respaldo: no duplica (el anterior sigue siendo válido)
    if ultimo is not null and (cambio is null or cambio <= ultimo) and ultimo > now() - interval '7 days' then continue; end if;
    perform public.vb_respaldo_hacer(c.id, case when extract(dow from now() at time zone 'America/Argentina/Salta') = 0 then 'semanal' else 'diario' end);
    k := k + 1;
  end loop;
  delete from public.respaldos r where r.tipo = 'diario' and r.id not in
    (select id from public.respaldos x where x.comercio_id = r.comercio_id and x.tipo = 'diario' order by creado desc limit 7);
  delete from public.respaldos r where r.tipo = 'semanal' and r.id not in
    (select id from public.respaldos x where x.comercio_id = r.comercio_id and x.tipo = 'semanal' order by creado desc limit 4);
  delete from public.respaldos where tipo in ('manual','previo') and creado < now() - interval '90 days';
  return k;
end $$;
revoke all on function public.vb_respaldos_tick() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('vb-respaldos') where exists (select 1 from cron.job where jobname = 'vb-respaldos');
  perform cron.schedule('vb-respaldos', '15 6 * * *', 'select public.vb_respaldos_tick()');  -- 03:15 en Argentina
end $$;

-- Lista de respaldos (equipo VB o dueño/admin del comercio).
create or replace function public.vb_respaldos_listar(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.vb_es_staff() and coalesce(public.rol_en(p_comercio),'') <> 'admin' then
    return jsonb_build_object('err','sin acceso'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'creado',creado,'tipo',tipo,'filas',filas,'bytes',bytes,'sha256',sha256) order by creado desc)
    from public.respaldos where comercio_id = p_comercio), '[]'::jsonb);
end $$;

-- Descarga de un respaldo (texto JSON).
create or replace function public.vb_respaldo_bajar(p_id bigint)
returns text language plpgsql stable security definer set search_path = public as $$
declare r public.respaldos;
begin
  select * into r from public.respaldos where id = p_id;
  if not found then return null; end if;
  if not public.vb_es_staff() and coalesce(public.rol_en(r.comercio_id),'') <> 'admin' then return null; end if;
  return r.datos;
end $$;

-- Respaldo a pedido (equipo VB o dueño/admin), máximo uno cada 10 minutos por comercio.
create or replace function public.vb_respaldo_ahora(p_comercio uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.vb_es_staff() and coalesce(public.rol_en(p_comercio),'') <> 'admin' then
    return jsonb_build_object('err','sin acceso'); end if;
  if exists(select 1 from public.respaldos where comercio_id = p_comercio and tipo = 'manual' and creado > now() - interval '10 minutes') then
    return jsonb_build_object('err','Ya se hizo un respaldo hace menos de 10 minutos'); end if;
  return public.vb_respaldo_hacer(p_comercio, 'manual');
end $$;

-- ---------- acciones de alta y baja (solo equipo VB) ----------
-- activar: plan activo por p_dias (30 por defecto) desde hoy o desde el vencimiento si todavía no venció.
-- extender: suma p_dias al vencimiento actual sin cambiar el estado.
-- prueba: reinicia una prueba gratis de p_dias.  suspender: baja (respaldo previo, no borra nada).
-- reactivar: vuelve a 'activa' sin tocar el vencimiento.
create or replace function public.vb_licencia_accion(p_comercio uuid, p_accion text, p_dias int default 30,
  p_plan text default null, p_paquetes text[] default null, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.licencias; base date; d int := greatest(1, least(800, coalesce(p_dias,30)));
begin
  if not public.vb_es_staff() then return jsonb_build_object('err','solo Vincular Business'); end if;
  if p_accion not in ('activar','extender','prueba','suspender','reactivar') then return jsonb_build_object('err','acción inválida'); end if;
  if not exists(select 1 from public.comercios where id = p_comercio) then return jsonb_build_object('err','comercio inexistente'); end if;
  if exists(select 1 from public.vb_propios where comercio_id = p_comercio) then return jsonb_build_object('err','Sistema propio de Vincular Business: no tiene vencimientos'); end if;
  insert into public.licencias(comercio_id, estado, vence, actualizado_por) values (p_comercio, 'prueba', current_date + 30, public.mi_email())
    on conflict (comercio_id) do nothing;
  select * into l from public.licencias where comercio_id = p_comercio for update;
  if p_accion = 'suspender' then perform public.vb_respaldo_hacer(p_comercio, 'previo'); end if;
  base := case when l.vence is not null and l.vence >= current_date then l.vence else current_date end;
  update public.licencias set
    plan = coalesce(p_plan, plan),
    paquetes = coalesce((select array_agg(distinct x order by x) from unnest(p_paquetes) x), paquetes),
    estado = case p_accion when 'activar' then 'activa' when 'prueba' then 'prueba' when 'suspender' then 'suspendida'
                           when 'reactivar' then 'activa' else estado end,
    vence = case p_accion when 'activar' then base + d when 'extender' then base + d when 'prueba' then current_date + d else vence end,
    avisos = case when p_accion in ('activar','extender','prueba') then '{}'::jsonb else avisos end,
    pago_informado = case when p_accion = 'activar' then null else pago_informado end,
    nota = coalesce(left(p_nota,500), nota), actualizado = now(), actualizado_por = public.mi_email()
  where comercio_id = p_comercio returning * into l;
  if l.plan not in ('esencial','profesional','mayorista','total','medida') then raise exception 'plan inválido'; end if;
  return public.vb_lic_json(l);
end $$;

-- Contacto del cliente (para los avisos por WhatsApp).
create or replace function public.vb_licencia_contacto(p_comercio uuid, p_nombre text, p_whatsapp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.licencias;
begin
  if not public.vb_es_staff() then return jsonb_build_object('err','solo Vincular Business'); end if;
  if exists(select 1 from public.vb_propios where comercio_id = p_comercio) then return jsonb_build_object('err','Sistema propio de Vincular Business'); end if;
  insert into public.licencias(comercio_id, estado, vence, actualizado_por) values (p_comercio, 'prueba', current_date + 30, public.mi_email())
    on conflict (comercio_id) do nothing;
  update public.licencias set contacto_nombre = left(nullif(trim(p_nombre),''),80),
    contacto_whatsapp = nullif(regexp_replace(coalesce(p_whatsapp,''),'\D','','g'),''), actualizado = now()
  where comercio_id = p_comercio returning * into l;
  return public.vb_lic_json(l);
end $$;

-- Marca un aviso como enviado (d10, d3, d1, vencida) para no repetirlo.
create or replace function public.vb_licencia_avisado(p_comercio uuid, p_aviso text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.vb_es_staff() then return jsonb_build_object('err','solo Vincular Business'); end if;
  if p_aviso not in ('d10','d3','d1','vencida') then return jsonb_build_object('err','aviso inválido'); end if;
  update public.licencias set avisos = avisos || jsonb_build_object(p_aviso, now()) where comercio_id = p_comercio;
  return jsonb_build_object('ok', true);
end $$;

-- El cliente avisa que pagó (lo ve el equipo VB en la consola).
create or replace function public.mi_licencia_pague(p_comercio uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.rol_en(p_comercio),'') <> 'admin' then return jsonb_build_object('err','sin acceso'); end if;
  update public.licencias set pago_informado = now() where comercio_id = p_comercio;
  return jsonb_build_object('ok', true);
end $$;

-- Lista para la consola (amplía la de 32 con respaldos y dueño).
create or replace function public.vb_comercios_listar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.vb_es_staff() then return jsonb_build_object('err','solo Vincular Business'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'rubro', c.rubro, 'creado', c.creado,
      'miembros', (select count(*) from public.miembros m where m.comercio_id = c.id),
      'registros', (select count(*) from public.registros r where r.comercio_id = c.id),
      'ultimo_uso', (select max(actualizado) from public.registros r where r.comercio_id = c.id),
      'respaldo', (select jsonb_build_object('creado', creado, 'tipo', tipo, 'filas', filas) from public.respaldos x
                    where x.comercio_id = c.id order by creado desc limit 1),
      'respaldos', (select count(*) from public.respaldos x where x.comercio_id = c.id),
      'propio', exists(select 1 from public.vb_propios p where p.comercio_id = c.id),
      'licencia', case when l.comercio_id is null then null else public.vb_lic_json(l) end) order by c.creado)
    from public.comercios c left join public.licencias l on l.comercio_id = c.id), '[]'::jsonb);
end $$;

revoke all on function public.vb_respaldos_listar(uuid), public.vb_respaldo_bajar(bigint), public.vb_respaldo_ahora(uuid),
  public.vb_licencia_accion(uuid,text,int,text,text[],text), public.vb_licencia_contacto(uuid,text,text),
  public.vb_licencia_avisado(uuid,text), public.mi_licencia_pague(uuid), public.vb_comercios_listar(),
  public.vb_lic_prueba_nueva() from public, anon;
grant execute on function public.vb_respaldos_listar(uuid), public.vb_respaldo_bajar(bigint), public.vb_respaldo_ahora(uuid),
  public.vb_licencia_accion(uuid,text,int,text,text[],text), public.vb_licencia_contacto(uuid,text,text),
  public.vb_licencia_avisado(uuid,text), public.mi_licencia_pague(uuid), public.vb_comercios_listar() to authenticated;

create or replace function public.mi_licencia(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l public.licencias;
begin
  if public.rol_en(p_comercio) is null and not public.vb_es_staff() then
    return jsonb_build_object('err','sin acceso'); end if;
  if exists(select 1 from public.vb_propios where comercio_id = p_comercio) then
    return jsonb_build_object('propio', true); end if;
  select * into l from public.licencias where comercio_id = p_comercio;
  if not found then return null; end if;
  return public.vb_lic_json(l);
end $$;
revoke all on function public.mi_licencia(uuid) from public, anon;
grant execute on function public.mi_licencia(uuid) to authenticated;

create or replace function public.vb_version()
returns int language sql stable set search_path = public as $$ select 35 $$;
revoke all on function public.vb_version() from public, anon;
grant execute on function public.vb_version() to authenticated;
