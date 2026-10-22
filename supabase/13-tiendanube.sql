-- =====================================================================
-- 13 · V26.13 · Integración con Tiendanube (Nuvemshop)  — aditiva e idempotente
-- Todo el trato con Tiendanube lo hace la Edge Function "tiendanube" (servidor):
-- el navegador NUNCA ve el token de acceso ni el secreto de la app.
--   tn_conexion        1 por comercio: tienda conectada, token CIFRADO (AES-GCM con un secreto de la función),
--                      configuración. SIN políticas: ningún usuario la lee por la API.
--   tn_estados_oauth   "state" de un solo uso (guardado como hash) para el flujo OAuth.
--   tn_productos       espejo de variantes de Tiendanube + vínculo con el producto del sistema.
--   tn_ordenes         espejo de órdenes con estados SEPARADOS (orden / pago / envío). Una orden nunca retrocede.
--   tn_eventos         bitácora sólo-agregar de webhooks y de la sincronización (sin cuerpos ni datos personales).
-- Apagada por defecto: nada se conecta hasta que el administrador autoriza la app en Tiendanube.
-- =====================================================================
create table if not exists public.tn_conexion (
  comercio_id   uuid primary key references public.comercios(id) on delete cascade,
  store_id      bigint,
  token_cifrado text,
  scope         text,
  estado        text not null default 'desconectada' check (estado in ('desconectada','conectada','revocada','error')),
  config        jsonb not null default '{}'::jsonb,
  conectado_por uuid,
  conectado_en  timestamptz,
  ultima_sync   timestamptz,
  ultimo_error  text,
  actualizado   timestamptz not null default now()
);
create unique index if not exists tn_conexion_tienda on public.tn_conexion (store_id) where store_id is not null and estado = 'conectada';
alter table public.tn_conexion enable row level security;
revoke all on public.tn_conexion from anon, authenticated;

create table if not exists public.tn_estados_oauth (
  state_hash  text primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  usuario     uuid,
  vence       timestamptz not null,
  usado       boolean not null default false,
  creado      timestamptz not null default now()
);
alter table public.tn_estados_oauth enable row level security;
revoke all on public.tn_estados_oauth from anon, authenticated;

create table if not exists public.tn_productos (
  comercio_id    uuid not null references public.comercios(id) on delete cascade,
  variant_id     bigint not null,
  product_id     bigint not null,
  sku            text,
  barcode        text,
  nombre         text not null default '',
  precio_cents   bigint check (precio_cents is null or precio_cents >= 0),
  stock          numeric(14,3),                       -- null = stock ilimitado en Tiendanube
  producto_local text,                                -- id del producto en el sistema
  vinculo        text not null default 'sin_vincular' check (vinculo in ('sin_vincular','sugerido','vinculado','ignorado')),
  tn_actualizado timestamptz,
  sincronizado   timestamptz not null default now(),
  primary key (comercio_id, variant_id)
);
create unique index if not exists tn_productos_local on public.tn_productos (comercio_id, producto_local) where vinculo = 'vinculado' and producto_local is not null;
create index if not exists tn_productos_estado on public.tn_productos (comercio_id, vinculo);
alter table public.tn_productos enable row level security;
drop policy if exists tn_productos_leer on public.tn_productos;
create policy tn_productos_leer on public.tn_productos for select to authenticated using (public.rol_en(comercio_id) in ('admin','supervisor'));
revoke all on public.tn_productos from anon, authenticated;
grant select on public.tn_productos to authenticated;

create table if not exists public.tn_ordenes (
  comercio_id    uuid not null references public.comercios(id) on delete cascade,
  orden_id       bigint not null,
  numero         bigint,
  estado         text not null default 'open',          -- open / closed / cancelled
  pago_estado    text not null default 'pending',       -- pending / authorized / paid / partially_paid / abandoned / refunded / partially_refunded / voided
  envio_estado   text not null default 'unshipped',     -- unpacked / unshipped / partially_packed / shipped / delivered ...
  total_cents    bigint not null default 0 check (total_cents >= 0),
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  descuento_cents bigint not null default 0 check (descuento_cents >= 0),
  envio_cents    bigint not null default 0 check (envio_cents >= 0),
  moneda         text not null default 'ARS',
  medio_pago     text,
  cliente        jsonb not null default '{}'::jsonb,    -- nombre / correo / teléfono: sólo admin y supervisor
  items          jsonb not null default '[]'::jsonb,    -- [{variant_id, product_id, nombre, sku, qty, precio_cents, producto_local}]
  nota           text,
  tn_creada      timestamptz,
  tn_actualizada timestamptz,
  venta_local    text,                                  -- id de la venta registrada en el sistema
  venta_estado   text not null default 'pendiente' check (venta_estado in ('pendiente','registrada','ignorada')),
  recibida       timestamptz not null default now(),
  primary key (comercio_id, orden_id)
);
create index if not exists tn_ordenes_lista on public.tn_ordenes (comercio_id, venta_estado, tn_creada desc);
alter table public.tn_ordenes enable row level security;
drop policy if exists tn_ordenes_leer on public.tn_ordenes;
create policy tn_ordenes_leer on public.tn_ordenes for select to authenticated using (public.rol_en(comercio_id) in ('admin','supervisor'));
revoke all on public.tn_ordenes from anon, authenticated;
grant select on public.tn_ordenes to authenticated;

create table if not exists public.tn_eventos (
  id          bigserial primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  evento      text not null check (length(evento) <= 80),
  recurso_id  bigint,
  resultado   text not null check (resultado in ('ok','duplicado','ignorado','rechazado','error')),
  detalle     text check (detalle is null or length(detalle) <= 300),
  creado      timestamptz not null default now()
);
create index if not exists tn_eventos_lista on public.tn_eventos (comercio_id, id desc);
alter table public.tn_eventos enable row level security;
drop policy if exists tn_eventos_leer on public.tn_eventos;
create policy tn_eventos_leer on public.tn_eventos for select to authenticated using (public.rol_en(comercio_id) in ('admin','supervisor'));
revoke all on public.tn_eventos from anon, authenticated;
grant select on public.tn_eventos to authenticated;
drop trigger if exists tn_eventos_solo_agregar on public.tn_eventos;
create trigger tn_eventos_solo_agregar before update or delete on public.tn_eventos for each row execute function public.rave_solo_agregar();

-- ---------------------------------------------------------------------
-- Estado visible para el equipo (sin token, sin secretos)
-- ---------------------------------------------------------------------
create or replace function public.tn_estado(p_comercio uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.tn_conexion; r text := public.rol_en(p_comercio);
begin
  if r is null or r not in ('admin','supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  select * into c from public.tn_conexion where comercio_id = p_comercio;
  return jsonb_build_object('ok', true,
    'estado', coalesce(c.estado, 'desconectada'), 'store_id', c.store_id, 'scope', c.scope, 'config', coalesce(c.config, '{}'::jsonb),
    'conectado_en', c.conectado_en, 'ultima_sync', c.ultima_sync, 'ultimo_error', c.ultimo_error,
    'productos', jsonb_build_object(
       'total', (select count(*) from public.tn_productos where comercio_id = p_comercio),
       'vinculados', (select count(*) from public.tn_productos where comercio_id = p_comercio and vinculo = 'vinculado'),
       'sugeridos', (select count(*) from public.tn_productos where comercio_id = p_comercio and vinculo = 'sugerido'),
       'sin_vincular', (select count(*) from public.tn_productos where comercio_id = p_comercio and vinculo = 'sin_vincular')),
    'ordenes', jsonb_build_object(
       'total', (select count(*) from public.tn_ordenes where comercio_id = p_comercio),
       'pendientes', (select count(*) from public.tn_ordenes where comercio_id = p_comercio and venta_estado = 'pendiente' and estado <> 'cancelled'),
       'por_cobrar', (select count(*) from public.tn_ordenes where comercio_id = p_comercio and venta_estado = 'pendiente' and estado <> 'cancelled' and pago_estado <> 'paid')),
    'eventos_error', (select count(*) from public.tn_eventos where comercio_id = p_comercio and resultado in ('error','rechazado') and creado > now() - interval '7 days'));
end $$;

-- ---------------------------------------------------------------------
-- Configuración (lista cerrada de claves y valores)
--   stock_fuente  : quién manda sobre el stock  — sistema | tiendanube | off
--   precio_fuente : quién manda sobre el precio — sistema | tiendanube | off
--   importar_ordenes : traer las órdenes de la tienda (no crea ventas solas)
-- ---------------------------------------------------------------------
create or replace function public.tn_config_guardar(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; k text;
begin
  if not public.es_admin(p_comercio) then raise exception 'sólo el administrador' using errcode = '42501'; end if;
  for k in select jsonb_object_keys(coalesce(p, '{}'::jsonb)) loop
    if k not in ('stock_fuente','precio_fuente','importar_ordenes') then return jsonb_build_object('ok', false, 'error', 'Opción desconocida: ' || left(k, 30)); end if;
  end loop;
  if p ? 'stock_fuente' and (p->>'stock_fuente') not in ('sistema','tiendanube','off') then return jsonb_build_object('ok', false, 'error', 'stock_fuente inválido'); end if;
  if p ? 'precio_fuente' and (p->>'precio_fuente') not in ('sistema','tiendanube','off') then return jsonb_build_object('ok', false, 'error', 'precio_fuente inválido'); end if;
  if p ? 'importar_ordenes' and jsonb_typeof(p->'importar_ordenes') <> 'boolean' then return jsonb_build_object('ok', false, 'error', 'importar_ordenes inválido'); end if;
  insert into public.tn_conexion (comercio_id) values (p_comercio) on conflict (comercio_id) do nothing;
  update public.tn_conexion set config = config || p, actualizado = now() where comercio_id = p_comercio returning config into cfg;
  return jsonb_build_object('ok', true, 'config', cfg);
end $$;

-- ---------------------------------------------------------------------
-- Vincular una variante de Tiendanube con un producto del sistema (uno a uno)
-- ---------------------------------------------------------------------
create or replace function public.tn_vincular(p_comercio uuid, p_variant bigint, p_producto text, p_vinculo text default 'vinculado') returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.tn_productos;
begin
  if public.rol_en(p_comercio) not in ('admin','supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  if p_vinculo not in ('vinculado','ignorado','sin_vincular') then return jsonb_build_object('ok', false, 'error', 'vínculo inválido'); end if;
  select * into t from public.tn_productos where comercio_id = p_comercio and variant_id = p_variant for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Esa variante no está en la lista de Tiendanube (sincronizá primero).'); end if;
  if p_vinculo = 'vinculado' then
    if p_producto is null or not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'productos' and id = p_producto and not borrado) then
      return jsonb_build_object('ok', false, 'error', 'El producto del sistema no existe.');
    end if;
    if exists (select 1 from public.tn_productos where comercio_id = p_comercio and producto_local = p_producto and vinculo = 'vinculado' and variant_id <> p_variant) then
      return jsonb_build_object('ok', false, 'error', 'Ese producto ya está vinculado con otra variante de Tiendanube.');
    end if;
    update public.tn_productos set producto_local = p_producto, vinculo = 'vinculado' where comercio_id = p_comercio and variant_id = p_variant;
  else
    update public.tn_productos set producto_local = null, vinculo = p_vinculo where comercio_id = p_comercio and variant_id = p_variant;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Órdenes: lista para la pantalla y registro (idempotente) como venta del sistema
-- ---------------------------------------------------------------------
create or replace function public.tn_ordenes_listar(p_comercio uuid, p_venta_estado text default null, p_limite int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if public.rol_en(p_comercio) not in ('admin','supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(o) - 'comercio_id' order by o.tn_creada desc nulls last)
    from (select * from public.tn_ordenes where comercio_id = p_comercio and (p_venta_estado is null or venta_estado = p_venta_estado)
          order by tn_creada desc nulls last limit least(greatest(coalesce(p_limite, 50), 1), 200)) o), '[]'::jsonb);
end $$;

create or replace function public.tn_orden_registrar(p_comercio uuid, p_orden bigint, p_venta text, p_ignorar boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.tn_ordenes;
begin
  if public.rol_en(p_comercio) not in ('admin','supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  select * into o from public.tn_ordenes where comercio_id = p_comercio and orden_id = p_orden for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'La orden no existe.'); end if;
  if o.venta_estado = 'registrada' then
    return jsonb_build_object('ok', true, 'repetido', true, 'venta', o.venta_local);   -- idempotente: nunca dos ventas por orden
  end if;
  if p_ignorar then
    update public.tn_ordenes set venta_estado = 'ignorada' where comercio_id = p_comercio and orden_id = p_orden;
    return jsonb_build_object('ok', true, 'ignorada', true);
  end if;
  if o.estado = 'cancelled' then return jsonb_build_object('ok', false, 'error', 'La orden está cancelada en Tiendanube.'); end if;
  if p_venta is null or length(p_venta) not between 3 and 80 then return jsonb_build_object('ok', false, 'error', 'Falta el id de la venta.'); end if;
  update public.tn_ordenes set venta_estado = 'registrada', venta_local = p_venta where comercio_id = p_comercio and orden_id = p_orden;
  return jsonb_build_object('ok', true, 'venta', p_venta);
end $$;


-- Si la venta no se pudo crear en el equipo, se libera la orden para poder registrarla de nuevo.
create or replace function public.tn_orden_liberar(p_comercio uuid, p_orden bigint, p_venta text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if public.rol_en(p_comercio) not in ('admin','supervisor') then raise exception 'sin permiso' using errcode = '42501'; end if;
  update public.tn_ordenes set venta_estado = 'pendiente', venta_local = null
   where comercio_id = p_comercio and orden_id = p_orden and venta_estado = 'registrada' and venta_local = p_venta;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Sólo el rol de servicio (la Edge Function): guardar orden sin retroceder, consumir el state OAuth
-- ---------------------------------------------------------------------
create or replace function public.tn_upsert_orden(p_comercio uuid, p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare ex public.tn_ordenes; v_upd timestamptz := nullif(p->>'tn_actualizada', '')::timestamptz;
begin
  select * into ex from public.tn_ordenes where comercio_id = p_comercio and orden_id = (p->>'orden_id')::bigint for update;
  if found then
    if ex.tn_actualizada is not null and v_upd is not null and v_upd < ex.tn_actualizada then return 'ignorado'; end if;   -- evento viejo fuera de orden
    if ex.tn_actualizada = v_upd and ex.estado = p->>'estado' and ex.pago_estado = p->>'pago_estado' and ex.envio_estado = p->>'envio_estado' then return 'duplicado'; end if;
    update public.tn_ordenes set numero = (p->>'numero')::bigint, estado = p->>'estado', pago_estado = p->>'pago_estado', envio_estado = p->>'envio_estado',
      total_cents = (p->>'total_cents')::bigint, subtotal_cents = (p->>'subtotal_cents')::bigint, descuento_cents = (p->>'descuento_cents')::bigint, envio_cents = (p->>'envio_cents')::bigint,
      moneda = coalesce(p->>'moneda', 'ARS'), medio_pago = p->>'medio_pago', cliente = coalesce(p->'cliente', '{}'::jsonb), items = coalesce(p->'items', '[]'::jsonb),
      nota = p->>'nota', tn_creada = nullif(p->>'tn_creada', '')::timestamptz, tn_actualizada = v_upd
      where comercio_id = p_comercio and orden_id = ex.orden_id;
    return 'ok';
  end if;
  insert into public.tn_ordenes (comercio_id, orden_id, numero, estado, pago_estado, envio_estado, total_cents, subtotal_cents, descuento_cents, envio_cents, moneda, medio_pago, cliente, items, nota, tn_creada, tn_actualizada)
  values (p_comercio, (p->>'orden_id')::bigint, (p->>'numero')::bigint, p->>'estado', p->>'pago_estado', p->>'envio_estado',
    (p->>'total_cents')::bigint, (p->>'subtotal_cents')::bigint, (p->>'descuento_cents')::bigint, (p->>'envio_cents')::bigint,
    coalesce(p->>'moneda', 'ARS'), p->>'medio_pago', coalesce(p->'cliente', '{}'::jsonb), coalesce(p->'items', '[]'::jsonb), p->>'nota',
    nullif(p->>'tn_creada', '')::timestamptz, v_upd)
  on conflict (comercio_id, orden_id) do nothing;
  return 'ok';
end $$;

create or replace function public.tn_consumir_estado(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.tn_estados_oauth;
begin
  select * into e from public.tn_estados_oauth where state_hash = p_hash for update;
  if not found or e.usado or e.vence < now() then return null; end if;
  update public.tn_estados_oauth set usado = true where state_hash = p_hash;
  delete from public.tn_estados_oauth where vence < now() - interval '1 day';
  return jsonb_build_object('comercio', e.comercio_id, 'usuario', e.usuario);
end $$;

revoke all on function public.tn_upsert_orden(uuid, jsonb), public.tn_consumir_estado(text) from public, anon, authenticated;
revoke all on function public.tn_estado(uuid), public.tn_config_guardar(uuid, jsonb), public.tn_vincular(uuid, bigint, text, text),
  public.tn_ordenes_listar(uuid, text, int), public.tn_orden_registrar(uuid, bigint, text, boolean), public.tn_orden_liberar(uuid, bigint, text) from public, anon;
grant execute on function public.tn_estado(uuid), public.tn_config_guardar(uuid, jsonb), public.tn_vincular(uuid, bigint, text, text),
  public.tn_ordenes_listar(uuid, text, int), public.tn_orden_registrar(uuid, bigint, text, boolean), public.tn_orden_liberar(uuid, bigint, text) to authenticated;
