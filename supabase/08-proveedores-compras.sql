-- =====================================================================
-- SISTEMA VB · 08 · Proveedores, órdenes de compra, ingreso de mercadería y cuenta corriente
--
-- Correr DESPUÉS de 01..07 (se puede repetir: sólo "if not exists" y "create or replace").
-- ADITIVA: no borra ni cambia datos, no toca ventas, caja ni stock existentes. Reemplaza únicamente
-- rave_prod_refs() (06) para que un artículo comprado a un proveedor se archive en vez de borrarse.
--
-- Modelo (el comercio = tenant; la columna se llama tenant_id y apunta a public.comercios.id,
-- el mismo identificador que `comercio_id` en el resto del esquema):
--   proveedores · ordenes_compra · ordenes_compra_detalles · ingresos_mercaderia (+ _detalles)
--   · cuenta_corriente_proveedores (libro mayor: sólo se agrega, nunca se edita ni se borra)
--
-- Seguridad:
--   · RLS en todas las tablas: sólo admin y supervisor del comercio las LEEN; nadie las escribe directo
--     (sin INSERT/UPDATE/DELETE para `authenticated`): se escribe sólo con las funciones de abajo,
--     que validan comercio, rol, importes y existencia de cada dato en el servidor.
--   · Los importes los recalcula el servidor (el navegador no manda totales).
--   · Idempotencia: cada operación de dinero exige una idempotency_key; reenviar la misma no duplica nada.
--
-- Integración con lo existente (el inventario y la caja viven en `registros`, jsonb por colección):
--   · producto_id es el id del artículo (coleccion 'prod'). No puede ser una clave foránea real porque el
--     catálogo no es una tabla relacional: cada función verifica en el servidor que exista en el mismo comercio.
--   · El ingreso de mercadería suma stock al artículo (más un movimiento 'smov' de respaldo), actualiza su
--     costo (último costo de compra) y, si es al contado en efectivo, escribe el egreso en la caja abierta
--     (colección 'movs') con rubro obligatorio. Todo en una sola transacción: si algo falla, no queda nada.
--   · Importes en esta parte: pesos con 2 decimales (numeric(14,2)). El catálogo y la caja los guardan en
--     centavos enteros; la conversión se hace en un único lugar de cada función (round(x * 100)).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------
create table if not exists public.proveedores (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.comercios(id) on delete cascade,
  razon_social  text not null check (length(btrim(razon_social)) between 2 and 120),
  cuit          text not null check (cuit ~ '^[0-9]{11}$'),
  condicion_iva text not null check (condicion_iva in ('Responsable Inscripto', 'Monotributista', 'Exento')),
  email         text check (email is null or (length(email) <= 120 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  telefono      text check (telefono is null or length(telefono) <= 40),
  direccion     text check (direccion is null or length(direccion) <= 200),
  saldo_cuenta_corriente numeric(14,2) not null default 0,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  deleted_at    timestamptz,
  unique (id, tenant_id)
);
create unique index if not exists proveedores_cuit_unico on public.proveedores (tenant_id, cuit) where deleted_at is null;
create index if not exists proveedores_tenant on public.proveedores (tenant_id, razon_social);

create table if not exists public.compras_contadores (
  tenant_id uuid not null references public.comercios(id) on delete cascade,
  clave     text not null,
  valor     bigint not null default 0,
  primary key (tenant_id, clave)
);

create table if not exists public.ordenes_compra (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.comercios(id) on delete cascade,
  numero          bigint not null,
  proveedor_id    uuid not null,
  estado          text not null check (estado in ('Borrador', 'Solicitada', 'Recibida', 'Cancelada')),
  total           numeric(14,2) not null check (total >= 0),
  fecha_emision   timestamptz not null default now(),
  observaciones   text check (observaciones is null or length(observaciones) <= 500),
  idempotency_key text check (idempotency_key is null or length(idempotency_key) between 8 and 80),
  recibida_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null,
  unique (id, tenant_id),
  unique (tenant_id, numero),
  foreign key (proveedor_id, tenant_id) references public.proveedores (id, tenant_id)
);
create unique index if not exists ordenes_compra_idem on public.ordenes_compra (tenant_id, idempotency_key) where idempotency_key is not null;
create index if not exists ordenes_compra_prov on public.ordenes_compra (tenant_id, proveedor_id, estado);

create table if not exists public.ordenes_compra_detalles (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.comercios(id) on delete cascade,
  orden_id             uuid not null,
  producto_id          text not null check (length(producto_id) between 1 and 80),
  producto_nombre      text,
  cantidad             numeric(14,3) not null check (cantidad > 0),
  precio_costo_pactado numeric(14,2) not null check (precio_costo_pactado >= 0),
  foreign key (orden_id, tenant_id) references public.ordenes_compra (id, tenant_id) on delete cascade,
  unique (orden_id, producto_id)
);

create table if not exists public.ingresos_mercaderia (
  id                         uuid primary key default gen_random_uuid(),
  tenant_id                  uuid not null references public.comercios(id) on delete cascade,
  proveedor_id               uuid not null,
  orden_compra_id            uuid,
  nro_comprobante_o_remito   text not null check (length(nro_comprobante_o_remito) between 1 and 40),
  tipo_comprobante           text not null check (tipo_comprobante in ('Factura', 'Remito')),
  fecha_recepcion            date not null,
  condicion_pago             text not null check (condicion_pago in ('credito', 'contado')),
  medio_pago                 text check (medio_pago is null or medio_pago in ('efectivo', 'transferencia', 'cheque', 'tarjeta')),
  rubro_id                   text,
  turno_id                   text,
  movimiento_caja_id         text,
  total                      numeric(14,2) not null check (total > 0),
  observaciones              text check (observaciones is null or length(observaciones) <= 500),
  idempotency_key            text not null check (length(idempotency_key) between 8 and 80),
  resultado                  jsonb,
  created_at                 timestamptz not null default now(),
  created_by                 uuid references auth.users(id) on delete set null,
  unique (id, tenant_id),
  foreign key (proveedor_id, tenant_id) references public.proveedores (id, tenant_id),
  foreign key (orden_compra_id, tenant_id) references public.ordenes_compra (id, tenant_id)
);
create unique index if not exists ingresos_idem on public.ingresos_mercaderia (tenant_id, idempotency_key);
create unique index if not exists ingresos_comprobante_unico on public.ingresos_mercaderia (tenant_id, proveedor_id, tipo_comprobante, lower(nro_comprobante_o_remito));
create index if not exists ingresos_prov on public.ingresos_mercaderia (tenant_id, proveedor_id, fecha_recepcion desc);

create table if not exists public.ingresos_mercaderia_detalles (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.comercios(id) on delete cascade,
  ingreso_id       uuid not null,
  producto_id      text not null check (length(producto_id) between 1 and 80),
  producto_nombre  text,
  cantidad         numeric(14,3) not null check (cantidad > 0),
  precio_costo     numeric(14,2) not null check (precio_costo >= 0),
  stock_anterior   numeric(14,3),
  stock_nuevo      numeric(14,3),
  costo_anterior   numeric(14,2),
  costo_nuevo      numeric(14,2),
  foreign key (ingreso_id, tenant_id) references public.ingresos_mercaderia (id, tenant_id) on delete cascade,
  unique (ingreso_id, producto_id)
);

create table if not exists public.cuenta_corriente_proveedores (
  id               uuid primary key default gen_random_uuid(),
  seq              bigint generated always as identity,
  tenant_id        uuid not null references public.comercios(id) on delete cascade,
  proveedor_id     uuid not null,
  tipo_movimiento  text not null check (tipo_movimiento in ('Factura', 'Remito', 'Pago', 'Nota de Crédito')),
  monto            numeric(14,2) not null check (monto > 0),
  saldo_acumulado  numeric(14,2) not null,
  fecha            timestamptz not null default clock_timestamp(),
  ingreso_id       uuid,
  referencia       text check (referencia is null or length(referencia) <= 80),
  medio_pago       text check (medio_pago is null or medio_pago in ('efectivo', 'transferencia', 'cheque', 'tarjeta')),
  rubro_id         text,
  movimiento_caja_id text,
  motivo           text check (motivo is null or length(motivo) <= 200),
  idempotency_key  text check (idempotency_key is null or length(idempotency_key) between 8 and 80),
  created_by       uuid references auth.users(id) on delete set null,
  foreign key (proveedor_id, tenant_id) references public.proveedores (id, tenant_id),
  foreign key (ingreso_id, tenant_id) references public.ingresos_mercaderia (id, tenant_id)
);
create unique index if not exists ccprov_idem on public.cuenta_corriente_proveedores (tenant_id, idempotency_key) where idempotency_key is not null;
create index if not exists ccprov_prov on public.cuenta_corriente_proveedores (tenant_id, proveedor_id, seq);

-- El libro mayor y los ingresos NO se editan ni se borran (un error se corrige con una nota de crédito o un pago).
-- Los borrados en cascada al eliminar un comercio entero sí se permiten (corren a profundidad > 1).
create or replace function public.rave_solo_agregar() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then raise exception '% no se modifica: es un registro contable (se corrige con un movimiento nuevo)', tg_table_name; end if;
  if tg_op = 'DELETE' and pg_trigger_depth() <= 1 then raise exception '% no se borra: es un registro contable', tg_table_name; end if;
  return old;
end $$;
drop trigger if exists ccprov_solo_agregar on public.cuenta_corriente_proveedores;
create trigger ccprov_solo_agregar before update or delete on public.cuenta_corriente_proveedores for each row execute function public.rave_solo_agregar();
drop trigger if exists ingresos_solo_agregar on public.ingresos_mercaderia;
create trigger ingresos_solo_agregar before delete on public.ingresos_mercaderia for each row execute function public.rave_solo_agregar();
drop trigger if exists ingresos_det_solo_agregar on public.ingresos_mercaderia_detalles;
create trigger ingresos_det_solo_agregar before update or delete on public.ingresos_mercaderia_detalles for each row execute function public.rave_solo_agregar();

-- ---------------------------------------------------------------------
-- 2. RLS: lectura sólo para admin y supervisor del mismo comercio; escritura sólo por funciones
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['proveedores', 'compras_contadores', 'ordenes_compra', 'ordenes_compra_detalles', 'ingresos_mercaderia',
                           'ingresos_mercaderia_detalles', 'cuenta_corriente_proveedores'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    if t <> 'compras_contadores' then
      execute format('grant select on public.%I to authenticated', t);
      execute format('drop policy if exists "compras: leen admin y supervisor" on public.%I', t);
      execute format($p$create policy "compras: leen admin y supervisor" on public.%I for select to authenticated
                        using (public.rol_en(tenant_id) in ('admin', 'supervisor'))$p$, t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Ayudas internas (no se pueden llamar desde la API)
-- ---------------------------------------------------------------------
create or replace function public.rave_compras_acceso(p_comercio uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_rol text := public.rol_en(p_comercio);
begin
  if v_rol is null then raise exception 'no sos miembro de este comercio' using errcode = '42501'; end if;
  if v_rol not in ('admin', 'supervisor') then raise exception 'tu rol no puede operar compras y proveedores' using errcode = '42501'; end if;
  return v_rol;
end $$;

create or replace function public.rave_num(p jsonb, k text) returns numeric language sql immutable as $$
  select case when jsonb_typeof(p -> k) = 'number' then (p ->> k)::numeric end $$;
create or replace function public.rave_txt(p jsonb, k text) returns text language sql immutable as $$
  select case when jsonb_typeof(p -> k) = 'string' then nullif(btrim(p ->> k), '') end $$;
create or replace function public.rave_uuid(p text) returns uuid language plpgsql immutable as $$
begin return p::uuid; exception when others then return null; end $$;

create or replace function public.rave_nombre_usuario(p_comercio uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(nombre), ''), email, 'usuario') from public.miembros where comercio_id = p_comercio and usuario_id = auth.uid() $$;

-- hoy en la zona del comercio (Salta)
create or replace function public.rave_hoy() returns date language sql stable as $$
  select (now() at time zone 'America/Argentina/Salta')::date $$;

create or replace function public.rave_siguiente(p_comercio uuid, p_clave text) returns bigint language sql as $$
  insert into public.compras_contadores (tenant_id, clave, valor) values (p_comercio, p_clave, 1)
  on conflict (tenant_id, clave) do update set valor = public.compras_contadores.valor + 1
  returning valor $$;

-- renglón de auditoría del servidor (misma forma que usa el resto del sistema)
create or replace function public.rave_auditar(p_comercio uuid, p_accion text, p_detalle text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id text := 'srv-' || gen_random_uuid()::text;
begin
  insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
  values (p_comercio, 'audit', v_id,
          jsonb_build_object('id', v_id, 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint,
                             'user', coalesce(public.rave_nombre_usuario(p_comercio), '?'), 'action', p_accion,
                             'detail', left(p_detalle, 400), 'dev', 'servidor'),
          false, 'servidor', auth.uid(), clock_timestamp())
  on conflict do nothing;
end $$;

-- Egreso en la caja ABIERTA (colección movs), con rubro obligatorio y válido para egresos. Devuelve el id del movimiento.
create or replace function public.rave_mov_caja(p_comercio uuid, p_turno text, p_rubro text, p_concepto text, p_centavos bigint, p_ref text)
returns text language plpgsql security definer set search_path = public as $$
declare v_t public.registros; v_r public.registros; v_id text := 'srv-' || gen_random_uuid()::text;
begin
  if p_turno is null then raise exception 'indicá la caja abierta de donde sale el efectivo'; end if;
  select * into v_t from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and id = p_turno and not borrado;
  if not found then raise exception 'la caja indicada no existe en el servidor: esperá a que sincronice'; end if;
  if coalesce((v_t.datos ->> 'closedAt')::numeric, 0) > 0 then raise exception 'la caja indicada ya está cerrada'; end if;
  if p_rubro is null then raise exception 'el rubro es obligatorio para todo movimiento de dinero'; end if;
  select * into v_r from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = p_rubro and not borrado;
  if not found then raise exception 'el rubro elegido no existe en este comercio'; end if;
  if (v_r.datos ->> 'kind') = 'cobr' then raise exception 'ese rubro sólo admite ingresos'; end if;
  if p_centavos is null or p_centavos <= 0 then raise exception 'el importe debe ser mayor a cero'; end if;
  insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
  values (p_comercio, 'movs', v_id,
          jsonb_build_object('id', v_id, 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint, 'sessId', p_turno,
                             'type', 'egreso', 'rubro', p_rubro, 'rubroName', coalesce(v_r.datos ->> 'name', p_rubro),
                             'concept', left(p_concepto, 120), 'amount', p_centavos,
                             'user', coalesce(public.rave_nombre_usuario(p_comercio), '?'), 'srv', true, 'ref', left(coalesce(p_ref, ''), 80)),
          false, 'servidor', auth.uid(), clock_timestamp());
  return v_id;
end $$;

revoke all on function public.rave_compras_acceso(uuid), public.rave_num(jsonb, text), public.rave_txt(jsonb, text), public.rave_uuid(text),
  public.rave_nombre_usuario(uuid), public.rave_hoy(), public.rave_siguiente(uuid, text), public.rave_auditar(uuid, text, text),
  public.rave_mov_caja(uuid, text, text, text, bigint, text), public.rave_solo_agregar() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Proveedores
-- ---------------------------------------------------------------------
create or replace function public.proveedor_guardar(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_row public.proveedores; v_cuit text; v_iva text; v_email text; v_rs text; v_activo boolean;
begin
  perform public.rave_compras_acceso(p_comercio);
  if jsonb_typeof(p) is distinct from 'object' or length(p::text) > 20000 then raise exception 'datos inválidos'; end if;
  v_rs := public.rave_txt(p, 'razon_social');
  v_cuit := regexp_replace(coalesce(public.rave_txt(p, 'cuit'), ''), '\D', '', 'g');
  v_iva := public.rave_txt(p, 'condicion_iva');
  v_email := lower(public.rave_txt(p, 'email'));
  if v_rs is null or length(v_rs) < 2 or length(v_rs) > 120 then raise exception 'la razón social es obligatoria (2 a 120 caracteres)'; end if;
  if not public.rave_cuit_ok(v_cuit) then raise exception 'el CUIT no es válido (11 dígitos con dígito verificador correcto)'; end if;
  if v_iva is null or v_iva not in ('Responsable Inscripto', 'Monotributista', 'Exento') then
    raise exception 'condición de IVA inválida (Responsable Inscripto, Monotributista o Exento)'; end if;
  if v_email is not null and (length(v_email) > 120 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'el correo no es válido'; end if;
  v_activo := coalesce((p ->> 'activo')::boolean, true);
  if p ? 'id' and p ->> 'id' is not null then
    v_id := public.rave_uuid(p ->> 'id');
    if v_id is null then raise exception 'id de proveedor inválido'; end if;
    select * into v_row from public.proveedores where id = v_id and tenant_id = p_comercio and deleted_at is null for update;
    if not found then raise exception 'el proveedor no existe en este comercio'; end if;
    -- el saldo NO se edita: sólo lo mueve el libro de cuenta corriente
    update public.proveedores set razon_social = v_rs, cuit = v_cuit, condicion_iva = v_iva, email = v_email,
           telefono = left(public.rave_txt(p, 'telefono'), 40), direccion = left(public.rave_txt(p, 'direccion'), 200),
           activo = v_activo, updated_at = now() where id = v_id returning * into v_row;
    perform public.rave_auditar(p_comercio, 'PROVEEDOR_EDITAR', v_row.razon_social || ' · CUIT ' || v_row.cuit || (case when v_activo then '' else ' · archivado' end));
  else
    insert into public.proveedores (tenant_id, razon_social, cuit, condicion_iva, email, telefono, direccion, activo, created_by)
    values (p_comercio, v_rs, v_cuit, v_iva, v_email, left(public.rave_txt(p, 'telefono'), 40), left(public.rave_txt(p, 'direccion'), 200), v_activo, auth.uid())
    returning * into v_row;
    perform public.rave_auditar(p_comercio, 'PROVEEDOR_ALTA', v_row.razon_social || ' · CUIT ' || v_row.cuit);
  end if;
  return to_jsonb(v_row);
exception when unique_violation then
  raise exception 'ya existe un proveedor con ese CUIT en este comercio';
end $$;

create or replace function public.proveedores_listar(
  p_comercio uuid, p_q text default null, p_estado text default null, p_orden text default 'razon_social',
  p_dir text default 'asc', p_limite int default 50, p_desde int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), ''); v_ord text := coalesce(p_orden, 'razon_social'); v_dir text := lower(coalesce(p_dir, 'asc'));
  v_lim int := least(greatest(coalesce(p_limite, 50), 1), 200); v_off int := greatest(coalesce(p_desde, 0), 0);
  v_items jsonb; v_total int; v_deuda numeric; v_pend int;
begin
  perform public.rave_compras_acceso(p_comercio);
  if v_ord not in ('razon_social', 'cuit', 'saldo', 'ordenes_pendientes', 'ultimo_movimiento') then raise exception 'orden inválido'; end if;
  if v_dir not in ('asc', 'desc') then raise exception 'dirección de orden inválida'; end if;
  if p_estado is not null and p_estado not in ('con_deuda', 'al_dia', 'a_favor') then raise exception 'estado de cuenta inválido (con_deuda, al_dia, a_favor)'; end if;
  if v_q is not null then v_q := '%' || replace(replace(replace(lower(v_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;

  with base as (
    select p.*, (select count(*) from public.ordenes_compra o where o.tenant_id = p.tenant_id and o.proveedor_id = p.id and o.estado = 'Solicitada') as ordenes_pendientes,
           (select max(c.fecha) from public.cuenta_corriente_proveedores c where c.tenant_id = p.tenant_id and c.proveedor_id = p.id) as ultimo_movimiento
      from public.proveedores p
     where p.tenant_id = p_comercio and p.deleted_at is null
       and (v_q is null or lower(p.razon_social) like v_q escape '\' or p.cuit like v_q escape '\')
       and (p_estado is null or (p_estado = 'con_deuda' and p.saldo_cuenta_corriente > 0) or (p_estado = 'al_dia' and p.saldo_cuenta_corriente = 0)
            or (p_estado = 'a_favor' and p.saldo_cuenta_corriente < 0))),
  num as (
    select base.*, row_number() over (
       order by case when v_ord = 'razon_social' and v_dir = 'asc'  then lower(razon_social) end asc,
                case when v_ord = 'razon_social' and v_dir = 'desc' then lower(razon_social) end desc,
                case when v_ord = 'cuit' and v_dir = 'asc'  then cuit end asc,
                case when v_ord = 'cuit' and v_dir = 'desc' then cuit end desc,
                case when v_ord = 'saldo' and v_dir = 'asc'  then saldo_cuenta_corriente end asc,
                case when v_ord = 'saldo' and v_dir = 'desc' then saldo_cuenta_corriente end desc,
                case when v_ord = 'ordenes_pendientes' and v_dir = 'asc'  then ordenes_pendientes end asc,
                case when v_ord = 'ordenes_pendientes' and v_dir = 'desc' then ordenes_pendientes end desc,
                case when v_ord = 'ultimo_movimiento' and v_dir = 'asc'  then ultimo_movimiento end asc nulls last,
                case when v_ord = 'ultimo_movimiento' and v_dir = 'desc' then ultimo_movimiento end desc nulls last,
                lower(razon_social), id) as rn
      from base)
  select coalesce(jsonb_agg((to_jsonb(num) - 'rn') || jsonb_build_object('estado_cuenta',
           case when num.saldo_cuenta_corriente > 0 then 'Con deuda' when num.saldo_cuenta_corriente < 0 then 'Saldo a favor' else 'Al día' end) order by num.rn)
           filter (where num.rn > v_off and num.rn <= v_off + v_lim), '[]'::jsonb),
         count(*)
    into v_items, v_total from num;
  select coalesce(sum(saldo_cuenta_corriente) filter (where saldo_cuenta_corriente > 0), 0) into v_deuda
    from public.proveedores where tenant_id = p_comercio and deleted_at is null;
  select count(*) into v_pend from public.ordenes_compra where tenant_id = p_comercio and estado = 'Solicitada';
  return jsonb_build_object('total', v_total, 'limite', v_lim, 'desde', v_off, 'items', v_items,
                            'kpis', jsonb_build_object('deuda_total_proveedores', v_deuda, 'ordenes_pendientes_recepcion', v_pend));
end $$;

-- ---------------------------------------------------------------------
-- 5. Órdenes de compra (crear / editar borrador / cambiar estado)
-- ---------------------------------------------------------------------
-- Valida y normaliza los renglones: devuelve [{producto_id, nombre, cantidad, precio}] y el total. Todo se verifica contra el
-- catálogo del MISMO comercio. El navegador nunca manda totales.
create or replace function public.rave_items_compra(p_comercio uuid, p_items jsonb, out o_items jsonb, out o_total numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_it jsonb; v_pid text; v_cant numeric; v_pre numeric; v_prod public.registros; v_seen text[] := '{}';
begin
  o_items := '[]'::jsonb; o_total := 0;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'la lista de productos debe tener entre 1 y 200 renglones'; end if;
  for v_it in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_it) is distinct from 'object' then raise exception 'renglón inválido'; end if;
    v_pid := public.rave_txt(v_it, 'producto_id');
    v_cant := public.rave_num(v_it, 'cantidad');
    v_pre := coalesce(public.rave_num(v_it, 'precio_costo'), public.rave_num(v_it, 'precio_costo_pactado'));
    if v_pid is null or length(v_pid) > 80 then raise exception 'falta el producto de un renglón'; end if;
    if v_pid = any(v_seen) then raise exception 'producto repetido en la lista (%): sumá las cantidades en un solo renglón', v_pid; end if;
    v_seen := v_seen || v_pid;
    if v_cant is null or v_cant <= 0 or v_cant > 1000000 or v_cant <> round(v_cant, 3) then
      raise exception 'cantidad inválida en %: mayor a cero, hasta 3 decimales', v_pid; end if;
    if v_pre is null or v_pre < 0 or v_pre > 1000000000 or v_pre <> round(v_pre, 2) then
      raise exception 'costo inválido en %: cero o más, hasta 2 decimales', v_pid; end if;
    select * into v_prod from public.registros where comercio_id = p_comercio and coleccion = 'prod' and id = v_pid and not borrado;
    if not found then raise exception 'el producto % no existe en este comercio', v_pid; end if;
    if coalesce((v_prod.datos ->> 'archived')::boolean, false) then raise exception 'el producto % está archivado', coalesce(v_prod.datos ->> 'name', v_pid); end if;
    o_items := o_items || jsonb_build_array(jsonb_build_object('producto_id', v_pid, 'nombre', coalesce(v_prod.datos ->> 'name', v_pid), 'cantidad', v_cant, 'precio', v_pre));
    o_total := o_total + round(v_cant * v_pre, 2);
  end loop;
end $$;
revoke all on function public.rave_items_compra(uuid, jsonb) from public, anon, authenticated;

create or replace function public.orden_compra_json(p_comercio uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(o) - 'tenant_id' - 'idempotency_key' || jsonb_build_object('proveedor', (select razon_social from public.proveedores where id = o.proveedor_id),
         'items', coalesce((select jsonb_agg(to_jsonb(d) - 'tenant_id' - 'orden_id' order by d.producto_nombre, d.id) from public.ordenes_compra_detalles d where d.orden_id = o.id and d.tenant_id = o.tenant_id), '[]'::jsonb))
    from public.ordenes_compra o where o.id = p_id and o.tenant_id = p_comercio $$;
revoke all on function public.orden_compra_json(uuid, uuid) from public, anon, authenticated;

create or replace function public.orden_compra_guardar(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prov public.proveedores; v_oc public.ordenes_compra; v_calc record; v_it jsonb; v_estado text; v_key text; v_id uuid;
begin
  perform public.rave_compras_acceso(p_comercio);
  if jsonb_typeof(p) is distinct from 'object' or length(p::text) > 200000 then raise exception 'datos inválidos'; end if;
  v_estado := coalesce(public.rave_txt(p, 'estado'), 'Borrador');
  if v_estado not in ('Borrador', 'Solicitada') then raise exception 'una orden nueva nace como Borrador o Solicitada'; end if;
  select * into v_prov from public.proveedores where id = public.rave_uuid(p ->> 'proveedor_id') and tenant_id = p_comercio and deleted_at is null for update;
  if not found then raise exception 'el proveedor no existe en este comercio'; end if;
  if not v_prov.activo then raise exception 'el proveedor está archivado'; end if;
  v_key := public.rave_txt(p, 'idempotency_key');
  if p ? 'id' and p ->> 'id' is not null then
    -- editar un Borrador
    v_id := public.rave_uuid(p ->> 'id');
    select * into v_oc from public.ordenes_compra where id = v_id and tenant_id = p_comercio for update;
    if not found then raise exception 'la orden no existe en este comercio'; end if;
    if v_oc.estado <> 'Borrador' then raise exception 'sólo se edita una orden en Borrador (esta está %)', v_oc.estado; end if;
    if v_oc.proveedor_id <> v_prov.id then raise exception 'no se cambia el proveedor de una orden: creá una nueva'; end if;
  else
    if v_key is not null then
      select * into v_oc from public.ordenes_compra where tenant_id = p_comercio and idempotency_key = v_key;
      if found then return public.orden_compra_json(p_comercio, v_oc.id) || jsonb_build_object('repetido', true); end if;
    end if;
  end if;
  select * into v_calc from public.rave_items_compra(p_comercio, p -> 'items');
  if v_calc.o_total <= 0 and v_estado = 'Solicitada' then raise exception 'una orden solicitada necesita costos pactados (total mayor a cero)'; end if;
  if v_oc.id is null then
    insert into public.ordenes_compra (tenant_id, numero, proveedor_id, estado, total, observaciones, idempotency_key, created_by)
    values (p_comercio, public.rave_siguiente(p_comercio, 'orden_compra'), v_prov.id, v_estado, v_calc.o_total, left(public.rave_txt(p, 'observaciones'), 500), v_key, auth.uid())
    returning * into v_oc;
  else
    update public.ordenes_compra set total = v_calc.o_total, estado = v_estado, observaciones = left(public.rave_txt(p, 'observaciones'), 500), updated_at = now()
     where id = v_oc.id returning * into v_oc;
    delete from public.ordenes_compra_detalles where orden_id = v_oc.id and tenant_id = p_comercio;
  end if;
  for v_it in select * from jsonb_array_elements(v_calc.o_items) loop
    insert into public.ordenes_compra_detalles (tenant_id, orden_id, producto_id, producto_nombre, cantidad, precio_costo_pactado)
    values (p_comercio, v_oc.id, v_it ->> 'producto_id', v_it ->> 'nombre', (v_it ->> 'cantidad')::numeric, (v_it ->> 'precio')::numeric);
  end loop;
  perform public.rave_auditar(p_comercio, 'OC_' || upper(v_oc.estado), 'OC-' || v_oc.numero || ' · ' || v_prov.razon_social || ' · total ' || v_oc.total);
  return public.orden_compra_json(p_comercio, v_oc.id) || jsonb_build_object('repetido', false);
end $$;

create or replace function public.orden_compra_estado(p_comercio uuid, p_orden uuid, p_estado text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_oc public.ordenes_compra;
begin
  perform public.rave_compras_acceso(p_comercio);
  if p_estado not in ('Solicitada', 'Cancelada') then raise exception 'estado inválido: sólo se pasa a Solicitada o Cancelada (Recibida se logra recibiendo la mercadería)'; end if;
  select * into v_oc from public.ordenes_compra where id = p_orden and tenant_id = p_comercio for update;
  if not found then raise exception 'la orden no existe en este comercio'; end if;
  if v_oc.estado = p_estado then return public.orden_compra_json(p_comercio, v_oc.id); end if;
  if not ((v_oc.estado = 'Borrador' and p_estado in ('Solicitada', 'Cancelada')) or (v_oc.estado = 'Solicitada' and p_estado = 'Cancelada')) then
    raise exception 'no se puede pasar una orden de % a %', v_oc.estado, p_estado; end if;
  if p_estado = 'Solicitada' and v_oc.total <= 0 then raise exception 'una orden solicitada necesita costos pactados (total mayor a cero)'; end if;
  update public.ordenes_compra set estado = p_estado, updated_at = now() where id = v_oc.id;
  perform public.rave_auditar(p_comercio, 'OC_' || upper(p_estado), 'OC-' || v_oc.numero);
  return public.orden_compra_json(p_comercio, v_oc.id);
end $$;

create or replace function public.ordenes_listar(p_comercio uuid, p_estado text default null, p_proveedor uuid default null, p_limite int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.rave_compras_acceso(p_comercio);
  if p_estado is not null and p_estado not in ('Borrador', 'Solicitada', 'Recibida', 'Cancelada') then raise exception 'estado inválido'; end if;
  return coalesce((select jsonb_agg(public.orden_compra_json(p_comercio, x.id) order by x.numero desc)
                     from (select id, numero from public.ordenes_compra where tenant_id = p_comercio and (p_estado is null or estado = p_estado)
                              and (p_proveedor is null or proveedor_id = p_proveedor) order by numero desc limit least(greatest(coalesce(p_limite, 100), 1), 500)) x), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- 6. INGRESO DE MERCADERÍA (atómico: o se aplica todo, o no queda nada)
--    1) la orden pasa a Recibida · 2) se suma el stock · 3) se actualiza el costo del artículo
--    4) a crédito: sube la deuda con el proveedor · al contado: Pago + egreso de caja (si es efectivo)
-- ---------------------------------------------------------------------
create or replace function public.procesar_recepcion(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_key text; v_prov public.proveedores; v_oc public.ordenes_compra; v_exist public.ingresos_mercaderia;
  v_tipo text; v_nro text; v_cond text; v_medio text; v_rubro text; v_turno text; v_fecha date; v_calc record;
  v_decl numeric; v_ing public.ingresos_mercaderia; v_it jsonb; v_pid text; v_cant numeric; v_pre numeric;
  v_prod public.registros; v_stock_ant numeric; v_stock_new numeric; v_cost_ant bigint; v_cost_new bigint; v_price bigint;
  v_saldo numeric(14,2); v_mov text; v_sal jsonb := '[]'::jsonb; v_dif jsonb := '[]'::jsonb; v_res jsonb; v_n int := 0; v_ocd record;
  v_ocid uuid; v_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  perform public.rave_compras_acceso(p_comercio);
  if jsonb_typeof(p) is distinct from 'object' or length(p::text) > 400000 then raise exception 'datos inválidos o muy grandes'; end if;
  v_key := public.rave_txt(p, 'idempotency_key');
  if v_key is null or length(v_key) not between 8 and 80 then raise exception 'falta idempotency_key (8 a 80 caracteres) para no duplicar la carga'; end if;

  -- el proveedor se bloquea primero: dos envíos simultáneos se ordenan acá
  select * into v_prov from public.proveedores where id = public.rave_uuid(p ->> 'proveedor_id') and tenant_id = p_comercio and deleted_at is null for update;
  if not found then raise exception 'el proveedor no existe en este comercio'; end if;
  select * into v_exist from public.ingresos_mercaderia where tenant_id = p_comercio and idempotency_key = v_key;
  if found then return v_exist.resultado || jsonb_build_object('repetido', true); end if;
  if not v_prov.activo then raise exception 'el proveedor está archivado'; end if;

  v_tipo := public.rave_txt(p, 'tipo_comprobante');
  v_nro := public.rave_txt(p, 'nro_comprobante');
  if v_tipo is null or v_tipo not in ('Factura', 'Remito') then raise exception 'tipo de comprobante inválido (Factura o Remito)'; end if;
  if v_nro is null or length(v_nro) > 40 or v_nro !~ '^[A-Za-z0-9./ -]+$' then raise exception 'el número de comprobante es obligatorio (letras, números, guión, barra y punto)'; end if;
  if exists (select 1 from public.ingresos_mercaderia where tenant_id = p_comercio and proveedor_id = v_prov.id and tipo_comprobante = v_tipo and lower(nro_comprobante_o_remito) = lower(v_nro)) then
    raise exception 'ese % ya fue cargado para este proveedor (duplicado)', lower(v_tipo); end if;
  v_cond := coalesce(public.rave_txt(p, 'condicion_pago'), 'credito');
  if v_cond not in ('credito', 'contado') then raise exception 'condición de pago inválida (credito o contado)'; end if;
  v_rubro := public.rave_txt(p, 'rubro_id'); v_turno := public.rave_txt(p, 'turno_id'); v_medio := public.rave_txt(p, 'medio_pago');
  if v_cond = 'contado' then
    if v_medio is null or v_medio not in ('efectivo', 'transferencia', 'cheque', 'tarjeta') then raise exception 'al contado hay que indicar el medio de pago (efectivo, transferencia, cheque o tarjeta)'; end if;
    if v_rubro is null then raise exception 'el rubro es obligatorio para todo movimiento de dinero'; end if;
    if not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = v_rubro and not borrado and coalesce(datos ->> 'kind', '') <> 'cobr') then
      raise exception 'el rubro elegido no existe en este comercio o no admite egresos'; end if;
    if v_medio = 'efectivo' and v_turno is null then raise exception 'pago en efectivo: indicá la caja abierta de donde sale la plata'; end if;
  else
    v_medio := null; v_turno := null;
    if v_rubro is not null and not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = v_rubro and not borrado) then
      raise exception 'el rubro elegido no existe en este comercio'; end if;
  end if;
  v_fecha := coalesce(case when public.rave_txt(p, 'fecha_recepcion') ~ '^\d{4}-\d{2}-\d{2}$' then (p ->> 'fecha_recepcion')::date end, public.rave_hoy());
  if v_fecha > public.rave_hoy() + 1 or v_fecha < public.rave_hoy() - 400 then raise exception 'la fecha de recepción no es razonable'; end if;

  -- orden de compra (opcional)
  v_ocid := public.rave_uuid(p ->> 'orden_compra_id');
  if p ->> 'orden_compra_id' is not null and v_ocid is null then raise exception 'id de orden inválido'; end if;
  if v_ocid is not null then
    select * into v_oc from public.ordenes_compra where id = v_ocid and tenant_id = p_comercio for update;
    if not found then raise exception 'la orden de compra no existe en este comercio'; end if;
    if v_oc.proveedor_id <> v_prov.id then raise exception 'la orden pertenece a otro proveedor'; end if;
    if v_oc.estado <> 'Solicitada' then raise exception 'la orden está %: sólo se recibe una orden Solicitada', v_oc.estado; end if;
  end if;

  select * into v_calc from public.rave_items_compra(p_comercio, p -> 'items');
  if v_oc.id is not null then
    for v_it in select * from jsonb_array_elements(v_calc.o_items) loop
      if not exists (select 1 from public.ordenes_compra_detalles where orden_id = v_oc.id and tenant_id = p_comercio and producto_id = v_it ->> 'producto_id') then
        raise exception 'el producto % no está en la orden de compra', v_it ->> 'nombre'; end if;
    end loop;
  end if;
  if v_calc.o_total <= 0 then raise exception 'el total del comprobante debe ser mayor a cero'; end if;
  v_decl := public.rave_num(p, 'total_declarado');
  if v_decl is not null and abs(v_decl - v_calc.o_total) > 0.009 then
    raise exception 'el total declarado (%) no coincide con la suma de los renglones (%)', v_decl, v_calc.o_total; end if;

  -- ---- se aplica todo ----
  insert into public.ingresos_mercaderia (tenant_id, proveedor_id, orden_compra_id, nro_comprobante_o_remito, tipo_comprobante, fecha_recepcion, condicion_pago,
                                          medio_pago, rubro_id, turno_id, total, observaciones, idempotency_key, created_by)
  values (p_comercio, v_prov.id, v_oc.id, v_nro, v_tipo, v_fecha, v_cond, v_medio, v_rubro, v_turno, v_calc.o_total, left(public.rave_txt(p, 'observaciones'), 500), v_key, auth.uid())
  returning * into v_ing;

  -- stock + costo (productos en orden fijo: sin bloqueos cruzados entre cajas)
  for v_it in select e from jsonb_array_elements(v_calc.o_items) e order by e ->> 'producto_id' loop
    v_pid := v_it ->> 'producto_id'; v_cant := (v_it ->> 'cantidad')::numeric; v_pre := (v_it ->> 'precio')::numeric; v_n := v_n + 1;
    select * into v_prod from public.registros where comercio_id = p_comercio and coleccion = 'prod' and id = v_pid and not borrado for update;
    v_stock_ant := coalesce((v_prod.datos ->> 'stock')::numeric, 0);
    v_stock_new := round(v_stock_ant + v_cant, 3);
    v_cost_ant := coalesce((v_prod.datos ->> 'cost')::numeric, 0)::bigint;
    v_price := coalesce((v_prod.datos ->> 'price')::numeric, 0)::bigint;
    v_cost_new := case when v_pre > 0 then round(v_pre * 100)::bigint else v_cost_ant end;   -- costo cero = bonificación: no pisa el costo vigente
    update public.registros
       set datos = datos || jsonb_build_object('stock', v_stock_new, 'cost', v_cost_new, 'costAt', v_ms),
           dispositivo = 'servidor', usuario_id = auth.uid(), actualizado = clock_timestamp()
     where comercio_id = p_comercio and coleccion = 'prod' and id = v_pid;
    insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
    values (p_comercio, 'smov', left('srv-rcp-' || v_ing.id::text || '-' || v_n, 80),
            jsonb_build_object('pid', v_pid, 'd', v_cant, 'dev', 'servidor', 'ref', 'ingreso:' || v_ing.id::text), false, 'servidor', auth.uid(), clock_timestamp());
    insert into public.ingresos_mercaderia_detalles (tenant_id, ingreso_id, producto_id, producto_nombre, cantidad, precio_costo, stock_anterior, stock_nuevo, costo_anterior, costo_nuevo)
    values (p_comercio, v_ing.id, v_pid, v_it ->> 'nombre', v_cant, v_pre, v_stock_ant, v_stock_new, v_cost_ant / 100.0, v_cost_new / 100.0);
    v_sal := v_sal || jsonb_build_array(jsonb_build_object('producto_id', v_pid, 'nombre', v_it ->> 'nombre', 'cantidad', v_cant, 'precio_costo', v_pre,
              'stock_anterior', v_stock_ant, 'stock_nuevo', v_stock_new, 'costo_anterior', v_cost_ant / 100.0, 'costo_nuevo', v_cost_new / 100.0,
              'margen_pct', case when v_price > 0 and v_cost_new > 0 then round((v_price - v_cost_new)::numeric / v_price * 100, 1) end));
  end loop;

  -- cuenta corriente: el comprobante genera deuda; si es al contado se cancela con un Pago (y, en efectivo, sale de la caja)
  v_saldo := round(v_prov.saldo_cuenta_corriente + v_calc.o_total, 2);
  insert into public.cuenta_corriente_proveedores (tenant_id, proveedor_id, tipo_movimiento, monto, saldo_acumulado, ingreso_id, referencia, rubro_id, created_by)
  values (p_comercio, v_prov.id, v_tipo, v_calc.o_total, v_saldo, v_ing.id, v_nro, v_rubro, auth.uid());
  if v_cond = 'contado' then
    if v_medio = 'efectivo' then
      v_mov := public.rave_mov_caja(p_comercio, v_turno, v_rubro, 'Pago contado a ' || v_prov.razon_social || ' · ' || v_tipo || ' ' || v_nro, round(v_calc.o_total * 100)::bigint, 'ingreso:' || v_ing.id::text);
    end if;
    v_saldo := round(v_saldo - v_calc.o_total, 2);
    insert into public.cuenta_corriente_proveedores (tenant_id, proveedor_id, tipo_movimiento, monto, saldo_acumulado, ingreso_id, referencia, medio_pago, rubro_id, movimiento_caja_id, created_by)
    values (p_comercio, v_prov.id, 'Pago', v_calc.o_total, v_saldo, v_ing.id, v_tipo || ' ' || v_nro, v_medio, v_rubro, v_mov, auth.uid());
  end if;
  update public.proveedores set saldo_cuenta_corriente = v_saldo, updated_at = now() where id = v_prov.id;

  -- orden de compra: Recibida + diferencias contra lo pactado
  if v_oc.id is not null then
    update public.ordenes_compra set estado = 'Recibida', recibida_at = now(), updated_at = now() where id = v_oc.id;
    for v_ocd in select d.producto_id, d.producto_nombre, d.cantidad, d.precio_costo_pactado, i.cantidad as recibida, i.precio_costo as precio_real
                   from public.ordenes_compra_detalles d
                   left join public.ingresos_mercaderia_detalles i on i.ingreso_id = v_ing.id and i.producto_id = d.producto_id
                  where d.orden_id = v_oc.id and d.tenant_id = p_comercio loop
      if v_ocd.recibida is null or v_ocd.recibida <> v_ocd.cantidad or v_ocd.precio_real <> v_ocd.precio_costo_pactado then
        v_dif := v_dif || jsonb_build_array(jsonb_build_object('producto_id', v_ocd.producto_id, 'nombre', v_ocd.producto_nombre,
                  'cantidad_pedida', v_ocd.cantidad, 'cantidad_recibida', coalesce(v_ocd.recibida, 0),
                  'costo_pactado', v_ocd.precio_costo_pactado, 'costo_facturado', v_ocd.precio_real));
      end if;
    end loop;
  end if;

  update public.ingresos_mercaderia set movimiento_caja_id = v_mov where id = v_ing.id;
  perform public.rave_auditar(p_comercio, 'COMPRA_RECEPCION', v_prov.razon_social || ' · ' || v_tipo || ' ' || v_nro || ' · total ' || v_calc.o_total || ' · ' || v_cond
                              || case when v_oc.id is not null then ' · OC-' || v_oc.numero else '' end);
  v_res := jsonb_build_object('ok', true, 'repetido', false, 'ingreso_id', v_ing.id, 'orden_compra_id', v_oc.id,
             'orden_estado', case when v_oc.id is not null then 'Recibida' end, 'proveedor_id', v_prov.id, 'tipo_comprobante', v_tipo, 'nro_comprobante', v_nro,
             'total', v_calc.o_total, 'condicion_pago', v_cond, 'medio_pago', v_medio, 'saldo_proveedor', v_saldo, 'movimiento_caja_id', v_mov,
             'items', v_sal, 'diferencias', v_dif);
  update public.ingresos_mercaderia set resultado = v_res where id = v_ing.id;
  return v_res;
exception when unique_violation then
  -- carrera entre dos envíos iguales que pasaron el control: el segundo ve el resultado del primero
  select * into v_exist from public.ingresos_mercaderia where tenant_id = p_comercio and idempotency_key = v_key;
  if found and v_exist.resultado is not null then return v_exist.resultado || jsonb_build_object('repetido', true); end if;
  raise exception 'ese comprobante ya fue cargado para este proveedor (duplicado)';
end $$;

-- ---------------------------------------------------------------------
-- 7. Pagos y notas de crédito del proveedor
-- ---------------------------------------------------------------------
create or replace function public.proveedor_pago_registrar(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prov public.proveedores; v_key text; v_monto numeric; v_medio text; v_rubro text; v_turno text; v_ref text; v_saldo numeric(14,2); v_mov text; v_ex public.cuenta_corriente_proveedores; v_id uuid;
begin
  perform public.rave_compras_acceso(p_comercio);
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'datos inválidos'; end if;
  v_key := public.rave_txt(p, 'idempotency_key');
  if v_key is null or length(v_key) not between 8 and 80 then raise exception 'falta idempotency_key (8 a 80 caracteres)'; end if;
  select * into v_prov from public.proveedores where id = public.rave_uuid(p ->> 'proveedor_id') and tenant_id = p_comercio and deleted_at is null for update;
  if not found then raise exception 'el proveedor no existe en este comercio'; end if;
  select * into v_ex from public.cuenta_corriente_proveedores where tenant_id = p_comercio and idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'repetido', true, 'movimiento_id', v_ex.id, 'monto', v_ex.monto, 'saldo_proveedor', v_prov.saldo_cuenta_corriente);
  end if;
  v_monto := public.rave_num(p, 'monto'); v_medio := public.rave_txt(p, 'medio_pago'); v_rubro := public.rave_txt(p, 'rubro_id'); v_turno := public.rave_txt(p, 'turno_id');
  v_ref := left(public.rave_txt(p, 'referencia'), 80);
  if v_monto is null or v_monto <= 0 or v_monto > 100000000000 or v_monto <> round(v_monto, 2) then raise exception 'el monto debe ser mayor a cero, con hasta 2 decimales'; end if;
  if v_monto > v_prov.saldo_cuenta_corriente then raise exception 'el pago (%) supera la deuda con el proveedor (%)', v_monto, v_prov.saldo_cuenta_corriente; end if;
  if v_medio is null or v_medio not in ('efectivo', 'transferencia', 'cheque', 'tarjeta') then raise exception 'indicá el medio de pago (efectivo, transferencia, cheque o tarjeta)'; end if;
  if v_rubro is null then raise exception 'el rubro es obligatorio para todo movimiento de dinero'; end if;
  if not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = v_rubro and not borrado and coalesce(datos ->> 'kind', '') <> 'cobr') then
    raise exception 'el rubro elegido no existe en este comercio o no admite egresos'; end if;
  if v_medio = 'efectivo' then
    v_mov := public.rave_mov_caja(p_comercio, v_turno, v_rubro, 'Pago a proveedor ' || v_prov.razon_social || coalesce(' · ' || v_ref, ''), round(v_monto * 100)::bigint, 'pago');
  end if;
  v_saldo := round(v_prov.saldo_cuenta_corriente - v_monto, 2);
  insert into public.cuenta_corriente_proveedores (tenant_id, proveedor_id, tipo_movimiento, monto, saldo_acumulado, referencia, medio_pago, rubro_id, movimiento_caja_id, idempotency_key, created_by)
  values (p_comercio, v_prov.id, 'Pago', v_monto, v_saldo, v_ref, v_medio, v_rubro, v_mov, v_key, auth.uid()) returning id into v_id;
  update public.proveedores set saldo_cuenta_corriente = v_saldo, updated_at = now() where id = v_prov.id;
  perform public.rave_auditar(p_comercio, 'PROVEEDOR_PAGO', v_prov.razon_social || ' · ' || v_monto || ' · ' || v_medio);
  return jsonb_build_object('ok', true, 'repetido', false, 'movimiento_id', v_id, 'monto', v_monto, 'saldo_proveedor', v_saldo, 'movimiento_caja_id', v_mov);
exception when unique_violation then
  select * into v_ex from public.cuenta_corriente_proveedores where tenant_id = p_comercio and idempotency_key = v_key;
  if found then return jsonb_build_object('ok', true, 'repetido', true, 'movimiento_id', v_ex.id, 'monto', v_ex.monto); end if;
  raise;
end $$;

create or replace function public.proveedor_nota_credito(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_prov public.proveedores; v_key text; v_monto numeric; v_ref text; v_motivo text; v_saldo numeric(14,2); v_ex public.cuenta_corriente_proveedores; v_id uuid;
begin
  perform public.rave_compras_acceso(p_comercio);
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'datos inválidos'; end if;
  v_key := public.rave_txt(p, 'idempotency_key');
  if v_key is null or length(v_key) not between 8 and 80 then raise exception 'falta idempotency_key (8 a 80 caracteres)'; end if;
  select * into v_prov from public.proveedores where id = public.rave_uuid(p ->> 'proveedor_id') and tenant_id = p_comercio and deleted_at is null for update;
  if not found then raise exception 'el proveedor no existe en este comercio'; end if;
  select * into v_ex from public.cuenta_corriente_proveedores where tenant_id = p_comercio and idempotency_key = v_key;
  if found then return jsonb_build_object('ok', true, 'repetido', true, 'movimiento_id', v_ex.id, 'monto', v_ex.monto, 'saldo_proveedor', v_prov.saldo_cuenta_corriente); end if;
  v_monto := public.rave_num(p, 'monto'); v_ref := left(public.rave_txt(p, 'referencia'), 80); v_motivo := left(public.rave_txt(p, 'motivo'), 200);
  if v_monto is null or v_monto <= 0 or v_monto > 100000000000 or v_monto <> round(v_monto, 2) then raise exception 'el monto debe ser mayor a cero, con hasta 2 decimales'; end if;
  if v_ref is null then raise exception 'indicá el número de la nota de crédito'; end if;
  if v_motivo is null or length(v_motivo) < 3 then raise exception 'indicá el motivo de la nota de crédito'; end if;
  v_saldo := round(v_prov.saldo_cuenta_corriente - v_monto, 2);   -- puede quedar a favor
  insert into public.cuenta_corriente_proveedores (tenant_id, proveedor_id, tipo_movimiento, monto, saldo_acumulado, referencia, motivo, idempotency_key, created_by)
  values (p_comercio, v_prov.id, 'Nota de Crédito', v_monto, v_saldo, v_ref, v_motivo, v_key, auth.uid()) returning id into v_id;
  update public.proveedores set saldo_cuenta_corriente = v_saldo, updated_at = now() where id = v_prov.id;
  perform public.rave_auditar(p_comercio, 'PROVEEDOR_NC', v_prov.razon_social || ' · ' || v_monto || ' · ' || v_ref);
  return jsonb_build_object('ok', true, 'repetido', false, 'movimiento_id', v_id, 'monto', v_monto, 'saldo_proveedor', v_saldo);
exception when unique_violation then
  select * into v_ex from public.cuenta_corriente_proveedores where tenant_id = p_comercio and idempotency_key = v_key;
  if found then return jsonb_build_object('ok', true, 'repetido', true, 'movimiento_id', v_ex.id, 'monto', v_ex.monto); end if;
  raise;
end $$;

-- ---------------------------------------------------------------------
-- 8. Lecturas para la pantalla y la API
-- ---------------------------------------------------------------------
create or replace function public.cuenta_proveedor(p_comercio uuid, p_proveedor uuid, p_limite int default 200) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_prov public.proveedores;
begin
  perform public.rave_compras_acceso(p_comercio);
  select * into v_prov from public.proveedores where id = p_proveedor and tenant_id = p_comercio and deleted_at is null;
  if not found then raise exception 'el proveedor no existe en este comercio'; end if;
  return jsonb_build_object('proveedor', to_jsonb(v_prov),
    'movimientos', coalesce((select jsonb_agg(to_jsonb(x) - 'tenant_id' order by x.seq) from (select * from public.cuenta_corriente_proveedores
        where tenant_id = p_comercio and proveedor_id = p_proveedor order by seq desc limit least(greatest(coalesce(p_limite, 200), 1), 1000)) x), '[]'::jsonb));
end $$;

create or replace function public.compras_snapshot(p_comercio uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.rave_compras_acceso(p_comercio);
  return jsonb_build_object(
    'generado', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'proveedores', coalesce((select jsonb_agg(to_jsonb(p) - 'tenant_id' order by lower(p.razon_social)) from public.proveedores p where p.tenant_id = p_comercio and p.deleted_at is null), '[]'::jsonb),
    'ordenes', coalesce((select jsonb_agg(public.orden_compra_json(p_comercio, o.id) order by o.numero desc)
                           from (select id, numero from public.ordenes_compra where tenant_id = p_comercio order by numero desc limit 500) o), '[]'::jsonb),
    'ingresos', coalesce((select jsonb_agg(to_jsonb(i) - 'tenant_id' - 'resultado' - 'idempotency_key' ||
                              jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(d) - 'tenant_id' - 'ingreso_id') from public.ingresos_mercaderia_detalles d where d.ingreso_id = i.id and d.tenant_id = i.tenant_id), '[]'::jsonb))
                              order by i.created_at desc)
                           from (select * from public.ingresos_mercaderia where tenant_id = p_comercio order by created_at desc limit 300) i), '[]'::jsonb),
    'cuenta', coalesce((select jsonb_agg(to_jsonb(c) - 'tenant_id' - 'idempotency_key' order by c.seq)
                          from (select * from public.cuenta_corriente_proveedores where tenant_id = p_comercio order by seq desc limit 1500) c), '[]'::jsonb));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'proveedor_guardar(uuid, jsonb)', 'proveedores_listar(uuid, text, text, text, text, int, int)', 'orden_compra_json(uuid, uuid)',
    'orden_compra_guardar(uuid, jsonb)', 'orden_compra_estado(uuid, uuid, text)', 'ordenes_listar(uuid, text, uuid, int)',
    'procesar_recepcion(uuid, jsonb)', 'proveedor_pago_registrar(uuid, jsonb)', 'proveedor_nota_credito(uuid, jsonb)',
    'cuenta_proveedor(uuid, uuid, int)', 'compras_snapshot(uuid)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  revoke all on function public.orden_compra_json(uuid, uuid) from authenticated;
end $$;

-- ---------------------------------------------------------------------
-- 9. Un artículo comprado a un proveedor se archiva, no se borra (reemplaza rave_prod_refs de 06 con la misma lógica + compras)
-- ---------------------------------------------------------------------
create or replace function public.rave_prod_refs(p_comercio uuid, p_pid text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_n int; v_lista text[] := array[]::text[];
begin
  if p_pid is null or length(p_pid) < 1 then return null; end if;
  select count(*) into v_n from public.registros
   where comercio_id = p_comercio and coleccion = 'ventas' and not borrado
     and datos -> 'items' @> jsonb_build_array(jsonb_build_object('pid', p_pid));
  if v_n > 0 then v_lista := array_append(v_lista, (v_n || ' venta' || case when v_n = 1 then '' else 's' end)::text); end if;
  select count(*) into v_n from public.registros
   where comercio_id = p_comercio and coleccion = 'smov' and datos ->> 'pid' = p_pid;
  if v_n > 1 then v_lista := array_append(v_lista, 'movimientos de stock'::text); end if;
  if exists (select 1 from public.registros where comercio_id = p_comercio and not borrado
              and coleccion in ('pedidos', 'pya', 'cupones', 'planes', 'lotes')
              and position('"' || p_pid || '"' in datos::text) > 0) then
    v_lista := array_append(v_lista, 'pedidos, cupones o lotes'::text);
  end if;
  if exists (select 1 from public.ordenes_compra_detalles where tenant_id = p_comercio and producto_id = p_pid)
     or exists (select 1 from public.ingresos_mercaderia_detalles where tenant_id = p_comercio and producto_id = p_pid) then
    v_lista := array_append(v_lista, 'órdenes de compra o ingresos de mercadería'::text);
  end if;
  if array_length(v_lista, 1) is null then return null; end if;
  return array_to_string(v_lista, ', ');
end $$;
revoke all on function public.rave_prod_refs(uuid, text) from public, anon, authenticated;
