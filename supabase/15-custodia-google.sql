-- 15 · V26.31 · Ingresar SÓLO con Google (opcional): custodia de la llave de datos del comercio.
-- La tabla guarda la llave envuelta con LLAVE_MASTER_KEY (secreto de la Edge Function «llave»): sin ese secreto no se abre.
-- Nadie la lee por la API (RLS sin políticas + permisos revocados): sólo la función, con el rol de servicio.
create table if not exists public.llaves_custodia (
  comercio_id uuid primary key references public.comercios(id) on delete cascade,
  wrap        jsonb not null check (jsonb_typeof(wrap) = 'object' and wrap ? 'iv' and wrap ? 'ct'),
  creado_por  uuid,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
alter table public.llaves_custodia enable row level security;
revoke all on public.llaves_custodia from public, anon, authenticated;

create table if not exists public.custodia_eventos (
  id          bigserial primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  usuario_id  uuid,
  accion      text not null check (length(accion) between 3 and 40),
  detalle     text check (length(detalle) <= 200),
  ts          timestamptz not null default clock_timestamp()
);
alter table public.custodia_eventos enable row level security;
revoke all on public.custodia_eventos from public, anon, authenticated;
drop trigger if exists custodia_eventos_solo_agregar on public.custodia_eventos;
create trigger custodia_eventos_solo_agregar before update or delete on public.custodia_eventos
  for each row execute function public.rave_solo_agregar();
-- el administrador ve el historial de entregas de la llave de su comercio
drop policy if exists custodia_eventos_leer on public.custodia_eventos;
create policy custodia_eventos_leer on public.custodia_eventos for select to authenticated using (public.es_admin(comercio_id));
grant select on public.custodia_eventos to authenticated;
