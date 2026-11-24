-- =====================================================================
-- 40-productos-web.sql · V27.31 · Sistema Vincular Business
-- Alta de productos desde internet (función «productos»):
--  · productos_maestro: fichas PÚBLICAS de producto confirmadas por algún comercio (nombre, marca, presentación,
--    descripción, categoría de la fuente, unidad). Nunca precio, costo, stock, comercio ni usuario.
--    Lectura: miembros de algún comercio. Escritura: sólo la función (service_role) por productos_maestro_aportar.
--    El aporte está APAGADO por defecto en el sistema (Configuración: «compartir fichas»), hasta que el dueño lo acepte.
--  · productos_web_uso: contador diario por comercio (búsquedas y búsquedas con IA) para los límites y el costo visible.
-- Idempotente.
-- =====================================================================
create table if not exists public.productos_maestro (
  barcode text primary key check (barcode ~ '^[0-9]{8,14}$'),
  ficha jsonb not null,
  fuente text not null default 'comercio',
  confianza numeric not null default 0.9,
  confirmaciones int not null default 0,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
alter table public.productos_maestro enable row level security;
drop policy if exists productos_maestro_leer on public.productos_maestro;
create policy productos_maestro_leer on public.productos_maestro for select to authenticated
  using (exists (select 1 from public.miembros m where m.usuario_id = auth.uid()));
revoke insert, update, delete on public.productos_maestro from anon, authenticated;

create table if not exists public.productos_web_uso (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  dia date not null default current_date,
  consultas int not null default 0,
  con_ia int not null default 0,
  primary key (comercio_id, dia)
);
alter table public.productos_web_uso enable row level security;
drop policy if exists productos_web_uso_leer on public.productos_web_uso;
create policy productos_web_uso_leer on public.productos_web_uso for select to authenticated
  using (public.rol_en(comercio_id) is not null);
revoke insert, update, delete on public.productos_web_uso from anon, authenticated;

-- suma una búsqueda (o una con IA) y devuelve el uso del día · sólo la función
create or replace function public.productos_web_contar(p_comercio uuid, p_ia boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.productos_web_uso;
begin
  insert into public.productos_web_uso as u (comercio_id, dia, consultas, con_ia)
  values (p_comercio, current_date, case when p_ia then 0 else 1 end, case when p_ia then 1 else 0 end)
  on conflict (comercio_id, dia) do update set
    consultas = u.consultas + case when p_ia then 0 else 1 end,
    con_ia = u.con_ia + case when p_ia then 1 else 0 end
  returning * into r;
  return jsonb_build_object('consultas', r.consultas, 'con_ia', r.con_ia);
end $$;
revoke all on function public.productos_web_contar(uuid, boolean) from public, anon, authenticated;
grant execute on function public.productos_web_contar(uuid, boolean) to service_role;

-- aporta una ficha confirmada: suma una confirmación y reemplaza la ficha sólo con datos públicos · sólo la función
create or replace function public.productos_maestro_aportar(p_barcode text, p_ficha jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare f jsonb;
begin
  if p_barcode !~ '^[0-9]{8,14}$' or p_barcode ~ '^2[0-9]{12}$' then raise exception 'código inválido' using errcode = '22023'; end if;
  f := jsonb_strip_nulls(jsonb_build_object(
    'nombre', left(p_ficha->>'nombre', 80), 'marca', left(p_ficha->>'marca', 40), 'presentacion', left(p_ficha->>'presentacion', 40),
    'descripcion', left(p_ficha->>'descripcion', 120), 'categoria_fuente', left(p_ficha->>'categoria_fuente', 120),
    'unidad', case when p_ficha->>'unidad' in ('u','kg','l') then p_ficha->>'unidad' else 'u' end));
  if coalesce(f->>'nombre', '') = '' then raise exception 'falta el nombre' using errcode = '22023'; end if;
  insert into public.productos_maestro as m (barcode, ficha, fuente, confianza, confirmaciones)
  values (p_barcode, f, 'comercio', 0.9, 1)
  on conflict (barcode) do update set ficha = excluded.ficha, confirmaciones = m.confirmaciones + 1,
    confianza = least(0.98, m.confianza + 0.01), actualizado = now();
end $$;
revoke all on function public.productos_maestro_aportar(text, jsonb) from public, anon, authenticated;
grant execute on function public.productos_maestro_aportar(text, jsonb) to service_role;
