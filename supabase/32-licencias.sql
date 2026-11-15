-- =====================================================================
-- 32-licencias.sql · Vincular Business como SaaS: licencia por comercio
-- Plan, paquetes contratados, estado y vencimiento de cada comercio.
-- Solo el equipo de Vincular Business (vb_staff) la modifica; el comercio
-- la lee con mi_licencia(). Sin fila de licencia = sin restricciones
-- (el sistema funciona como hoy). vb_version() = 32.
-- Aditivo e idempotente: no borra ni cambia datos. Requiere 01 a 31.
-- =====================================================================

create table if not exists public.vb_staff (
  email  text primary key check (email = lower(email)),
  creado timestamptz not null default now()
);
alter table public.vb_staff enable row level security;
revoke all on public.vb_staff from public, anon, authenticated;
insert into public.vb_staff(email) values ('vincularbusiness@gmail.com') on conflict do nothing;

create table if not exists public.licencias (
  comercio_id     uuid primary key references public.comercios(id) on delete cascade,
  plan            text not null default 'esencial',
  paquetes        text[] not null default '{}',
  estado          text not null default 'prueba',
  vence           date,
  gracia_dias     int  not null default 7 check (gracia_dias between 0 and 60),
  nota            text,
  actualizado     timestamptz not null default now(),
  actualizado_por text
);
alter table public.licencias enable row level security;
revoke all on public.licencias from public, anon, authenticated;

create or replace function public.vb_es_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.vb_staff where email = public.mi_email() and email <> '')
$$;

-- Estado efectivo: prueba/activa vigentes; vencida dentro de la gracia = gracia; después = vencida.
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
    'dias', case when l.vence is null then null else l.vence - current_date end)
$$;

create or replace function public.mi_licencia(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l public.licencias;
begin
  if public.rol_en(p_comercio) is null and not public.vb_es_staff() then
    return jsonb_build_object('err','sin acceso');
  end if;
  select * into l from public.licencias where comercio_id = p_comercio;
  if not found then return null; end if;
  return public.vb_lic_json(l);
end $$;

create or replace function public.vb_licencia_set(p_comercio uuid, p_plan text, p_paquetes text[],
  p_estado text, p_vence date, p_gracia int default 7, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare bad text; l public.licencias;
begin
  if not public.vb_es_staff() then return jsonb_build_object('err','solo Vincular Business'); end if;
  if not exists(select 1 from public.comercios where id = p_comercio) then return jsonb_build_object('err','comercio inexistente'); end if;
  if p_plan not in ('esencial','profesional','mayorista','total','medida') then return jsonb_build_object('err','plan inválido'); end if;
  if p_estado not in ('prueba','activa','suspendida') then return jsonb_build_object('err','estado inválido'); end if;
  select string_agg(x, ',') into bad from unnest(coalesce(p_paquetes,'{}')) x
   where x not in ('ventas','equipo','logistica','digital','inteligente','gastro','turnos','taller','mayorista');
  if bad is not null then return jsonb_build_object('err','paquete inválido: '||bad); end if;
  insert into public.licencias(comercio_id, plan, paquetes, estado, vence, gracia_dias, nota, actualizado, actualizado_por)
  values (p_comercio, p_plan, (select coalesce(array_agg(distinct x order by x),'{}') from unnest(coalesce(p_paquetes,'{}')) x),
          p_estado, p_vence, greatest(0, least(60, coalesce(p_gracia,7))), left(p_nota,500), now(), public.mi_email())
  on conflict (comercio_id) do update set plan = excluded.plan, paquetes = excluded.paquetes, estado = excluded.estado,
    vence = excluded.vence, gracia_dias = excluded.gracia_dias, nota = excluded.nota,
    actualizado = now(), actualizado_por = excluded.actualizado_por
  returning * into l;
  return public.vb_lic_json(l);
end $$;

create or replace function public.vb_licencia_quitar(p_comercio uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.vb_es_staff() then return jsonb_build_object('err','solo Vincular Business'); end if;
  delete from public.licencias where comercio_id = p_comercio;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.vb_comercios_listar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.vb_es_staff() then return jsonb_build_object('err','solo Vincular Business'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'rubro', c.rubro, 'creado', c.creado,
      'miembros', (select count(*) from public.miembros m where m.comercio_id = c.id),
      'licencia', case when l.comercio_id is null then null else public.vb_lic_json(l) end) order by c.creado)
    from public.comercios c left join public.licencias l on l.comercio_id = c.id), '[]'::jsonb);
end $$;

revoke all on function public.vb_es_staff(), public.vb_lic_json(public.licencias), public.mi_licencia(uuid),
  public.vb_licencia_set(uuid,text,text[],text,date,int,text), public.vb_licencia_quitar(uuid),
  public.vb_comercios_listar() from public, anon;
grant execute on function public.vb_es_staff(), public.mi_licencia(uuid),
  public.vb_licencia_set(uuid,text,text[],text,date,int,text), public.vb_licencia_quitar(uuid),
  public.vb_comercios_listar() to authenticated;

create or replace function public.vb_version()
returns int language sql stable set search_path = public as $$ select 32 $$;
revoke all on function public.vb_version() from public, anon;
grant execute on function public.vb_version() to authenticated;
