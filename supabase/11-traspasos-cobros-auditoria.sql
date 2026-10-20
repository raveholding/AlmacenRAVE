-- =====================================================================
-- SISTEMA RAVE · 11 · V26.9 · 4.23 / 4.24 · Traspasos de fondos controlados, detalle de cobros digitales,
--                      auditoría sólo-agregar y administración de los clientes del Club
--
-- Correr DESPUÉS de 01..10 (se puede repetir: sólo "create or replace", "if not exists" y "drop ... if exists").
-- Aditiva: no borra ni cambia datos existentes. Con las banderas apagadas (cfg.xfer.strict / cfg.pay.detail.on) el
-- comportamiento de sincronizar() es el de la migración 10.
--
-- Qué agrega:
--   · rave_tiene_permiso(): lee el permiso del rol desde la configuración de roles ya sincronizada (el administrador siempre).
--   · Tablas SÓLO-AGREGAR con cadena de hash por comercio: traspasos, traspaso_eventos, cobro_detalles, auditoria_eventos.
--     UPDATE/DELETE/TRUNCATE rechazados por trigger (también para el administrador) + REVOKE; la hora y la IP las pone el servidor.
--     rave_verificar_cadena() detecta un eslabón alterado o faltante.
--   · sincronizar(): colecciones nuevas `ctev` (eventos de un traspaso) y `cdet` (detalle de un cobro digital, versionado);
--     `ctransf` v2 (permiso transfer_funds, autorizante, cajas cerradas, número T-<caja>-<n> asignado por el servidor);
--     reglas de clientes (baja y eliminación sólo del administrador, sin historial ni deuda; consentimientos con constancia;
--     una edición tardía no resucita a un cliente eliminado); `cfg.xfer` y `cfg.pay` sólo los cambia el administrador.
-- Límites declarados (no se escribe «inalterable» sin esto):
--   · Un superusuario del proyecto o el rol de servicio podrían alterar la base: la defensa adicional son las copias de seguridad
--     automáticas del proveedor [VERIFICAR plan] y el hash encadenado, que DETECTA el cambio pero no lo impide.
--   · El servidor no ve los datos personales cifrados del cliente (WhatsApp, DNI, correo, nacimiento): para esos campos la regla
--     «sólo administrador» se aplica en el equipo y el servidor sólo compara una huella (`pfp`) que el equipo calcula; un equipo
--     adulterado podría falsearla. Los campos en claro (estado, consentimientos, límite, canal, plazo, zona, vendedor) sí se validan acá.
--   · La clave o el PIN del autorizante se comprueba en el equipo; el servidor verifica que exista, sea administrador del comercio
--     y (salvo comercio de un único administrador) distinto del emisor, pero no puede probar que se tipeó la clave.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Ayudas internas
-- ---------------------------------------------------------------------
create or replace function public.rave_tiene_permiso(p_comercio uuid, p_usuario uuid, p_permiso text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_rol text; v_arr jsonb;
begin
  if p_comercio is null or p_usuario is null or p_permiso is null then return false; end if;
  if public.rol_en(p_comercio) is null then return false; end if;      -- quien pregunta tiene que ser del comercio
  select rol into v_rol from public.miembros where comercio_id = p_comercio and usuario_id = p_usuario;
  if v_rol is null then return false; end if;
  if v_rol = 'admin' then return true; end if;
  select datos -> v_rol into v_arr from public.registros
   where comercio_id = p_comercio and coleccion = 'cfg' and id = 'roles' and not borrado;
  return coalesce(jsonb_typeof(v_arr) = 'array' and v_arr ? p_permiso, false);
end $$;
revoke all on function public.rave_tiene_permiso(uuid, uuid, text) from public, anon;
grant execute on function public.rave_tiene_permiso(uuid, uuid, text) to authenticated;

-- Luhn + prefijo plausible de tarjeta: un número de tarjeta completo NUNCA se guarda (PCI-DSS)
create or replace function public.rave_luhn_ok(p text) returns boolean language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s int := 0; i int; n int; alt boolean := false;
begin
  if length(d) < 13 or length(d) > 19 then return false; end if;
  for i in reverse length(d)..1 loop
    n := substr(d, i, 1)::int;
    if alt then n := n * 2; if n > 9 then n := n - 9; end if; end if;
    s := s + n; alt := not alt;
  end loop;
  return s % 10 = 0;
end $$;

create or replace function public.rave_parece_pan(p text) returns boolean language plpgsql immutable as $$
declare m text[]; d text;
begin
  if p is null then return false; end if;
  for m in select regexp_matches(p, '((?:\d[ -]?){13,19})', 'g') loop
    d := regexp_replace(m[1], '\D', '', 'g');
    if length(d) between 13 and 19 and substr(d, 1, 1) in ('2','3','4','5','6') and public.rave_luhn_ok(d) then return true; end if;
  end loop;
  return false;
end $$;

-- ¿Algún valor de texto del documento parece un número de tarjeta? (las claves de cifrado __pii no se recorren)
create or replace function public.rave_json_tiene_pan(p jsonb) returns boolean language plpgsql immutable as $$
declare k text; v jsonb;
begin
  if p is null then return false; end if;
  if jsonb_typeof(p) = 'string' then return public.rave_parece_pan(p #>> '{}'); end if;
  if jsonb_typeof(p) = 'object' then
    for k, v in select * from jsonb_each(p) loop
      continue when k = '__pii';
      if public.rave_json_tiene_pan(v) then return true; end if;
    end loop;
  elsif jsonb_typeof(p) = 'array' then
    for v in select * from jsonb_array_elements(p) loop
      if public.rave_json_tiene_pan(v) then return true; end if;
    end loop;
  end if;
  return false;
end $$;

create or replace function public.rave_cfg_bloque(p_comercio uuid, p_clave text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select datos -> p_clave from public.registros
                    where comercio_id = p_comercio and coleccion = 'cfg' and id = 'cfg' and not borrado), '{}'::jsonb)
$$;
revoke all on function public.rave_cfg_bloque(uuid, text), public.rave_luhn_ok(text), public.rave_parece_pan(text), public.rave_json_tiene_pan(jsonb) from public, anon, authenticated;

-- ¿Puede este rol escribir traspasos? Con xfer.strict hace falta el permiso transfer_funds; sin la bandera, como siempre (admin y supervisor).
create or replace function public.rave_xfer_autorizado(p_comercio uuid, p_rol text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_rol = 'admin' then return true; end if;
  if coalesce((public.rave_cfg_bloque(p_comercio, 'xfer') ->> 'strict')::boolean, false) then
    return public.rave_tiene_permiso(p_comercio, auth.uid(), 'transfer_funds');
  end if;
  return p_rol = 'supervisor';
end $$;
revoke all on function public.rave_xfer_autorizado(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Cadena de hash por comercio (la calcula el servidor al insertar) + inmutabilidad
-- ---------------------------------------------------------------------
create or replace function public.rave_cadena() returns trigger
language plpgsql security definer set search_path = public, extensions set timezone = 'UTC' as $$
declare v_seq bigint; v_prev text;
begin
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.tenant_id::text, 11));
  execute format('select seq, hash from public.%I where tenant_id = $1 order by seq desc limit 1', tg_table_name)
     into v_seq, v_prev using new.tenant_id;
  new.seq       := coalesce(v_seq, 0) + 1;
  new.hash_prev := coalesce(v_prev, repeat('0', 64));
  new.hash      := encode(extensions.digest(new.hash_prev || '|' || (to_jsonb(new) - 'hash' - 'hash_prev')::text, 'sha256'), 'hex');
  return new;
end $$;

create or replace function public.rave_no_truncate() returns trigger language plpgsql as $$
begin
  raise exception '% no se vacía: es un registro contable', tg_table_name;
end $$;
revoke all on function public.rave_cadena(), public.rave_no_truncate() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Tablas
-- ---------------------------------------------------------------------
-- 3.1 traspasos: el comprobante interno de un traspaso de fondos («Boleta de Movimiento de Fondos»)
create table if not exists public.traspasos (
  tenant_id          uuid   not null references public.comercios(id) on delete cascade,
  seq                bigint not null,
  id                 text   not null check (length(id) between 1 and 80),
  caja_origen        text   not null check (length(caja_origen) between 1 and 80),
  caja_destino       text   not null check (length(caja_destino) between 1 and 80),
  n                  integer not null check (n > 0),
  num                text   not null check (length(num) between 3 and 40),
  amount_cents       bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  currency           char(3) not null default 'ARS' check (currency = 'ARS'),
  rubro_id           text   not null,
  rubro_nombre       text,
  motivo             text   not null check (length(btrim(motivo)) between 3 and 200),
  emisor_id          uuid,
  emisor_nombre      text,
  autorizante_id     uuid   not null,
  autorizante_nombre text,
  auth_metodo        text   not null check (auth_metodo in ('permiso_propio', 'pin_admin', 'clave_admin')),
  suc_origen         text,
  suc_destino        text,
  estado_caja_origen  text  not null check (estado_caja_origen in ('abierta', 'cerrada')),
  estado_caja_destino text  not null check (estado_caja_destino in ('abierta', 'cerrada')),
  ref_origen         text,
  ref_destino        text,
  estado_inicial     text   not null check (estado_inicial in ('completado', 'en_transito')),
  rev_of             text,
  ts_equipo          timestamptz,
  ts_servidor        timestamptz not null default clock_timestamp(),
  hora_desfasada     boolean not null default false,
  datos              jsonb  not null,
  hash               text   not null,
  hash_prev          text   not null,
  primary key (tenant_id, seq),
  unique (tenant_id, id),
  unique (tenant_id, caja_origen, n)
);
create index if not exists traspasos_fecha on public.traspasos (tenant_id, ts_servidor);

-- 3.2 traspaso_eventos: máquina de estados sólo-agregar
create table if not exists public.traspaso_eventos (
  tenant_id     uuid   not null references public.comercios(id) on delete cascade,
  seq           bigint not null,
  id            text   not null check (length(id) between 1 and 80),
  traspaso_id   text   not null,
  kind          text   not null check (kind in ('emitido', 'en_transito', 'recibido', 'recibido_con_diferencia', 'devuelto', 'revertido', 'anotado')),
  amount_cents  bigint check (amount_cents is null or (amount_cents >= 0 and amount_cents <= 100000000000)),
  nota          text   check (nota is null or length(nota) <= 300),
  sess          text,
  usuario_id    uuid,
  usuario_nombre text,
  ts_equipo     timestamptz,
  ts_servidor   timestamptz not null default clock_timestamp(),
  datos         jsonb  not null default '{}'::jsonb,
  hash          text   not null,
  hash_prev     text   not null,
  primary key (tenant_id, seq),
  unique (tenant_id, id),
  foreign key (tenant_id, traspaso_id) references public.traspasos (tenant_id, id)
);
create index if not exists traspaso_eventos_t on public.traspaso_eventos (tenant_id, traspaso_id, seq);

-- 3.3 cobro_detalles: detalle versionado de un cobro digital (la venta no cambia; cada corrección es una versión nueva)
create table if not exists public.cobro_detalles (
  tenant_id     uuid   not null references public.comercios(id) on delete cascade,
  seq           bigint not null,
  id            text   not null check (length(id) between 1 and 80),
  sale_id       text   not null check (length(sale_id) between 1 and 80),
  pay_idx       integer not null check (pay_idx between 0 and 4),
  version       integer not null check (version >= 1),
  medio         text   not null check (medio in ('transferencia', 'debito', 'credito', 'qr', 'modo')),
  estado        text   not null default 'declarado' check (estado in ('declarado', 'en_proceso', 'aprobado', 'acreditado', 'rechazado', 'reembolsado', 'verificado')),
  entidad       text,
  nro_operacion text,
  clave_unica   text,
  pendiente     boolean not null default false,
  excepcion     jsonb,
  duplicado_ok  jsonb,
  created_by    uuid,
  ts_equipo     timestamptz,
  ts_servidor   timestamptz not null default clock_timestamp(),
  datos         jsonb  not null,
  hash          text   not null,
  hash_prev     text   not null,
  primary key (tenant_id, seq),
  unique (tenant_id, id),
  unique (tenant_id, sale_id, pay_idx, version)
);
create unique index if not exists cobro_detalles_clave_unica on public.cobro_detalles (tenant_id, clave_unica) where clave_unica is not null;
create index if not exists cobro_detalles_venta on public.cobro_detalles (tenant_id, sale_id, pay_idx, version);

-- 3.4 auditoria_eventos: la pista estructurada del servidor (se alimenta de la colección `audit` y de rave_auditar)
create table if not exists public.auditoria_eventos (
  tenant_id   uuid   not null references public.comercios(id) on delete cascade,
  seq         bigint not null,
  id          text   not null check (length(id) between 1 and 80),
  module      text,
  action      text   not null,
  entity      text,
  entity_id   text,
  old_value   text,
  new_value   text,
  reason      text,
  detail      text,
  usuario     text,
  usuario_id  uuid,
  rol         text,
  device_id   text,
  ip          text,
  ts_equipo   bigint,
  ts_servidor timestamptz not null default clock_timestamp(),
  hash        text   not null,
  hash_prev   text   not null,
  primary key (tenant_id, seq),
  unique (tenant_id, id)
);
create index if not exists auditoria_entidad on public.auditoria_eventos (tenant_id, entity, entity_id, seq);
create index if not exists auditoria_fecha on public.auditoria_eventos (tenant_id, ts_servidor);

do $$
declare t text;
begin
  foreach t in array array['traspasos', 'traspaso_eventos', 'cobro_detalles', 'auditoria_eventos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_cadena', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.rave_cadena()', t || '_cadena', t);
    execute format('drop trigger if exists %I on public.%I', t || '_solo_agregar', t);
    execute format('create trigger %I before update or delete on public.%I for each row execute function public.rave_solo_agregar()', t || '_solo_agregar', t);
    execute format('drop trigger if exists %I on public.%I', t || '_no_truncate', t);
    execute format('create trigger %I before truncate on public.%I for each statement execute function public.rave_no_truncate()', t || '_no_truncate', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists "traspasos: leen quienes los gestionan" on public.traspasos;
create policy "traspasos: leen quienes los gestionan" on public.traspasos for select to authenticated
  using (public.rol_en(tenant_id) in ('admin', 'supervisor') or public.rave_tiene_permiso(tenant_id, auth.uid(), 'transfer_funds'));
drop policy if exists "traspaso_eventos: leen quienes los gestionan" on public.traspaso_eventos;
create policy "traspaso_eventos: leen quienes los gestionan" on public.traspaso_eventos for select to authenticated
  using (public.rol_en(tenant_id) in ('admin', 'supervisor') or public.rave_tiene_permiso(tenant_id, auth.uid(), 'transfer_funds'));
drop policy if exists "cobro_detalles: leen admin, supervisor y quien cobró" on public.cobro_detalles;
create policy "cobro_detalles: leen admin, supervisor y quien cobró" on public.cobro_detalles for select to authenticated
  using (public.rol_en(tenant_id) in ('admin', 'supervisor') or (created_by = auth.uid() and public.rol_en(tenant_id) is not null));
drop policy if exists "auditoria_eventos: leen admin y supervisor" on public.auditoria_eventos;
create policy "auditoria_eventos: leen admin y supervisor" on public.auditoria_eventos for select to authenticated
  using (public.rol_en(tenant_id) in ('admin', 'supervisor'));

-- Estado actual de cada traspaso: enviado = recibido + en tránsito + diferencia + devuelto (el dinero no aparece ni desaparece)
create or replace view public.traspasos_estado with (security_invoker = true) as
select t.tenant_id, t.id, t.num, t.amount_cents as enviado, t.estado_inicial,
       case when t.estado_inicial = 'completado' then t.amount_cents
            else coalesce((select sum(e.amount_cents) from public.traspaso_eventos e
                            where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind in ('recibido', 'recibido_con_diferencia')), 0) end as recibido,
       case when t.estado_inicial = 'en_transito' and not exists
                 (select 1 from public.traspaso_eventos e where e.tenant_id = t.tenant_id and e.traspaso_id = t.id
                     and e.kind in ('recibido', 'recibido_con_diferencia', 'devuelto'))
            then t.amount_cents else 0 end as en_transito,
       coalesce((select t.amount_cents - e.amount_cents from public.traspaso_eventos e
                  where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'recibido_con_diferencia' limit 1), 0) as diferencia,
       coalesce((select sum(e.amount_cents) from public.traspaso_eventos e
                  where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'devuelto'), 0) as devuelto,
       case when exists (select 1 from public.traspaso_eventos e where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'devuelto') then 'devuelto'
            when exists (select 1 from public.traspaso_eventos e where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'recibido_con_diferencia') then 'recibido_con_diferencia'
            when exists (select 1 from public.traspaso_eventos e where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'recibido') then 'recibido'
            else t.estado_inicial end
         || case when exists (select 1 from public.traspaso_eventos e where e.tenant_id = t.tenant_id and e.traspaso_id = t.id and e.kind = 'revertido') then '+revertido' else '' end as estado
  from public.traspasos t;
revoke all on public.traspasos_estado from anon;
grant select on public.traspasos_estado to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verificación de la cadena y huecos de numeración
-- ---------------------------------------------------------------------
create or replace function public.rave_verificar_cadena(p_comercio uuid, p_tabla text default 'auditoria_eventos')
returns jsonb language plpgsql stable security definer set search_path = public, extensions set timezone = 'UTC' as $$
declare r record; v_prev text := repeat('0', 64); v_esp bigint := 1; v_total bigint := 0; v_h text;
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin', 'supervisor') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_tabla not in ('traspasos', 'traspaso_eventos', 'cobro_detalles', 'auditoria_eventos') then raise exception 'tabla inválida'; end if;
  for r in execute format('select seq, hash, hash_prev, to_jsonb(t) as j from public.%I t where tenant_id = $1 order by seq', p_tabla) using p_comercio loop
    v_total := v_total + 1;
    if r.seq <> v_esp then
      return jsonb_build_object('ok', false, 'tabla', p_tabla, 'total', v_total, 'roto', v_esp, 'motivo', 'falta un registro de la cadena');
    end if;
    if r.hash_prev <> v_prev then
      return jsonb_build_object('ok', false, 'tabla', p_tabla, 'total', v_total, 'roto', r.seq, 'motivo', 'el eslabón anterior no coincide');
    end if;
    v_h := encode(extensions.digest(r.hash_prev || '|' || ((r.j) - 'hash' - 'hash_prev')::text, 'sha256'), 'hex');
    if v_h <> r.hash then
      return jsonb_build_object('ok', false, 'tabla', p_tabla, 'total', v_total, 'roto', r.seq, 'motivo', 'el contenido fue alterado');
    end if;
    v_prev := r.hash; v_esp := r.seq + 1;
  end loop;
  return jsonb_build_object('ok', true, 'tabla', p_tabla, 'total', v_total, 'roto', null, 'motivo', null);
end $$;
revoke all on function public.rave_verificar_cadena(uuid, text) from public, anon;
grant execute on function public.rave_verificar_cadena(uuid, text) to authenticated;

-- Números de traspaso que faltan (huecos) por caja de origen
create or replace function public.rave_traspasos_huecos(p_comercio uuid)
returns table (caja text, falta integer) language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin', 'supervisor') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  return query
    select t.caja_origen, g.n from (select caja_origen, max(n) as mx from public.traspasos where tenant_id = p_comercio group by caja_origen) t,
           generate_series(1, t.mx) g(n)
     where not exists (select 1 from public.traspasos x where x.tenant_id = p_comercio and x.caja_origen = t.caja_origen and x.n = g.n)
     order by 1, 2;
end $$;
revoke all on function public.rave_traspasos_huecos(uuid) from public, anon;
grant execute on function public.rave_traspasos_huecos(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. La colección `audit` (una escritura por evento) alimenta la pista estructurada del servidor
-- ---------------------------------------------------------------------
create or replace function public.rave_espejo_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_d jsonb := new.datos; v_ip text; v_rol text; v_h jsonb;
begin
  if new.coleccion <> 'audit' then return new; end if;
  begin
    v_h := nullif(current_setting('request.headers', true), '')::jsonb;
    v_ip := nullif(btrim(split_part(coalesce(v_h ->> 'x-forwarded-for', v_h ->> 'x-real-ip', ''), ',', 1)), '');
    if v_ip is not null then v_ip := host(v_ip::inet); end if;
  exception when others then v_ip := null; end;
  select rol into v_rol from public.miembros where comercio_id = new.comercio_id and usuario_id = new.usuario_id;
  insert into public.auditoria_eventos (tenant_id, id, module, action, entity, entity_id, old_value, new_value, reason, detail,
                                        usuario, usuario_id, rol, device_id, ip, ts_equipo)
  values (new.comercio_id, left(new.id, 80), lower(split_part(coalesce(v_d ->> 'action', ''), '_', 1)),
          left(coalesce(nullif(v_d ->> 'action', ''), '?'), 80),
          left(v_d ->> 'ent', 40), left(v_d ->> 'eid', 80),
          left(v_d ->> 'old', 300), left(v_d ->> 'new', 300), left(v_d ->> 'reason', 300), left(v_d ->> 'detail', 400),
          left(v_d ->> 'user', 80), new.usuario_id, v_rol, left(coalesce(new.dispositivo, v_d ->> 'dev'), 40), v_ip,
          case when jsonb_typeof(v_d -> 'ts') = 'number' then (v_d ->> 'ts')::numeric::bigint end)
  on conflict (tenant_id, id) do nothing;
  return new;
end $$;
revoke all on function public.rave_espejo_auditoria() from public, anon, authenticated;
drop trigger if exists registros_espejo_auditoria on public.registros;
create trigger registros_espejo_auditoria after insert on public.registros
  for each row when (new.coleccion = 'audit') execute function public.rave_espejo_auditoria();

-- ---------------------------------------------------------------------
-- 6. Quién escribe qué, y sincronizar() con las reglas de V26.9
-- ---------------------------------------------------------------------
create or replace function public.rave_puede_escribir(p_rol text, p_col text, p_id text)
returns boolean language sql immutable as $$
  select case p_rol
    when 'admin' then true
    when 'supervisor' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                     'clientes','fiado','fich','pedidos','arrep','pya','membs',
                                     'prod','rubros','cierres','cnotas','cupones','planes','lotes','tareas','ctransf',
                                     'acuer','cexc','cexcu','ctev','cdet')
                           or (p_col = 'cfg' and p_id = 'cfg')
    when 'mostrador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                    'clientes','fiado','fich','pedidos','arrep','pya','membs','cexcu','ctransf','ctev','cdet')
    when 'operador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs','cexcu','ctransf','ctev','cdet')
    else false end
$$;

create or replace function public.sincronizar(p_comercio uuid, p_dispositivo text, p_cambios jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_rol        text;
  v_cambio     jsonb;
  v_col        text;
  v_id         text;
  v_datos      jsonb;
  v_borrado    boolean;
  v_prev       public.registros;
  v_hay        boolean;
  v_aplicados  int := 0;
  v_omitidos   int := 0;
  v_rechazos   jsonb := '[]'::jsonb;
  v_pasada     int;
  v_motivo     text;
  v_delta      numeric;
  v_pid        text;
  v_stock      numeric;
  c_todas      constant text[] := array['prod','smov','ventas','turnos','movs','cierres','cnotas','rubros','clientes','fiado',
                                        'emp','fich','puestos','tareas','tlogs','audit','cupones','cusos','planes','membs',
                                        'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf','acuer','cexc','cexcu','ctev','cdet'];
  c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf','cexc','cexcu','ctev','cdet'];
  c_borrables  constant text[] := array['prod','rubros','clientes','emp','puestos','tareas','cupones','planes','tlogs','pedidos','acuer'];
  c_cfg_ids    constant text[] := array['tenant','cfg','menu','loyalty','roles','integ','legal','clubkey'];
  c_secretos   constant text[] := array['arcaCert','arcaKey','arcaPem','accessToken','refreshToken','clientSecret','apiKey','serviceKey'];
  v_k          text;
  v_ref        text;
  v_perfil     text;
  v_aid        text;
  v_late       boolean;
  v_uid        uuid := auth.uid();
  v_xf         jsonb;
  v_strict     boolean;
  v_n          int;
  v_num        text;
  v_estado     text;
  v_seq        bigint;
  v_hs         text;
  v_tss        timestamptz;
  v_rn         text;
  v_code       text;
  v_ev         text;
  v_ck         text;
begin
  v_rol := public.rol_en(p_comercio);
  if v_rol is null then
    raise exception 'no sos miembro de este comercio' using errcode = '42501';
  end if;
  if jsonb_typeof(p_cambios) <> 'array' then
    raise exception 'formato de cambios inválido';
  end if;
  if jsonb_array_length(p_cambios) > 500 then
    raise exception 'demasiados cambios juntos (máximo 500 por envío)';
  end if;

  -- Dos pasadas: primero todo lo que no es movimiento de stock (así un producto nuevo ya existe),
  -- después los movimientos de stock.
  for v_pasada in 1..2 loop
    for v_cambio in select * from jsonb_array_elements(p_cambios) loop
      v_col    := v_cambio ->> 'c';
      v_id     := v_cambio ->> 'id';
      v_motivo := null;
      v_late := v_col in ('smov', 'ctev', 'cdet');
      continue when (v_pasada = 1 and coalesce(v_late, false)) or (v_pasada = 2 and not coalesce(v_late, false));

      begin   -- cada cambio en su propia sub-transacción: uno malo no traba a los demás
        v_datos   := coalesce(v_cambio -> 'd', '{}'::jsonb);
        v_borrado := coalesce((v_cambio ->> 'x')::boolean, false);
        v_hay     := false;

        if v_col is null or v_id is null or length(v_id) > 80 or length(v_id) < 1 or not (v_col = any(c_todas)) then
          v_motivo := 'colección o formato inválido';
        elsif jsonb_typeof(v_datos) <> 'object' or length(v_datos::text) > 400000 then
          v_motivo := 'datos inválidos o muy grandes';
        elsif not public.rave_puede_escribir(v_rol, v_col, v_id) then
          v_motivo := 'tu rol no puede modificar esto';
        elsif v_col = 'cfg' and not (v_id = any(c_cfg_ids)) then
          v_motivo := 'configuración desconocida';
        elsif v_col in ('ctransf', 'ctev') and not public.rave_xfer_autorizado(p_comercio, v_rol) then
          v_motivo := 'no tenés permiso para traspasar fondos entre cajas';
        elsif v_borrado and not (v_col = any(c_borrables)) then
          v_motivo := 'este tipo de registro no se borra';
        elsif v_borrado and v_col = 'prod' and v_rol <> 'admin' then
          v_motivo := 'sólo el administrador elimina artículos';
        end if;

        if v_motivo is null then
          select * into v_prev from public.registros
           where comercio_id = p_comercio and coleccion = v_col and id = v_id for update;
          v_hay := found;

          -- se escriben una sola vez: un reenvío del mismo lote no duplica nada
          if v_hay and v_col = any(c_una_vez) then
            v_omitidos := v_omitidos + 1;
            continue;
          end if;
          -- una caja cerrada no se toca
          if v_hay and v_col = 'turnos' and coalesce((v_prev.datos ->> 'closedAt')::numeric, 0) > 0 then
            v_motivo := 'la caja ya está cerrada: no se modifica';
          end if;
          -- las fichadas se escriben una vez; sólo el administrador las corrige
          if v_motivo is null and v_hay and v_col = 'fich' and v_rol <> 'admin' then
            v_motivo := 'las fichadas sólo las corrige el administrador';
          end if;
        end if;

        -- V26 · 4.16 · un artículo con historial no se borra: se archiva. Sólo el administrador archiva o restaura.
        if v_motivo is null and v_col = 'prod' then
          if v_borrado and v_hay then
            v_ref := public.rave_prod_refs(p_comercio, v_id);
            if v_ref is not null then v_motivo := 'no se elimina (' || v_ref || '): archivalo'; end if;
          end if;
          if v_motivo is null and not v_borrado
             and coalesce((v_datos ->> 'archived')::boolean, false)
                 is distinct from coalesce((case when v_hay then (v_prev.datos ->> 'archived')::boolean end), false)
             and v_rol <> 'admin' then
            v_motivo := 'sólo el administrador archiva o restaura artículos';
          end if;
        end if;
        -- V26 · 4.14 / V26.9 · 4.23 · cajas y sucursales: sólo el administrador las define; los traspasos exigen el perfil habilitado
        -- y, con la versión 2 del comprobante, permiso `transfer_funds`, autorizante y estado de las cajas verificado.
        if v_motivo is null and v_col = 'ctransf' then
          select datos ->> 'cashProfile' into v_perfil from public.registros
           where comercio_id = p_comercio and coleccion = 'cfg' and id = 'cfg' and not borrado;
          v_xf := public.rave_cfg_bloque(p_comercio, 'xfer');
          v_strict := coalesce((v_xf ->> 'strict')::boolean, false);
          if coalesce(v_perfil, 'simple') not in ('main', 'branches') then
            v_motivo := 'el módulo de caja principal no está habilitado';
          elsif coalesce(v_datos ->> 'from', '') = '' or coalesce(v_datos ->> 'to', '') = '' or (v_datos ->> 'from') = (v_datos ->> 'to') then
            v_motivo := 'traspaso inválido: origen y destino deben ser cajas distintas';
          elsif jsonb_typeof(v_datos -> 'amount') is distinct from 'number' or (v_datos ->> 'amount')::numeric <= 0
                or (v_datos ->> 'amount')::numeric <> trunc((v_datos ->> 'amount')::numeric) or (v_datos ->> 'amount')::numeric > 100000000000 then
            v_motivo := 'traspaso inválido: el importe debe ser un entero positivo en centavos';
          elsif coalesce(btrim(v_datos ->> 'rubro'), '') = '' or not exists
                (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'rubros' and id = (v_datos ->> 'rubro') and not borrado) then
            v_motivo := 'el rubro del movimiento es obligatorio y debe existir en este comercio';
          elsif (select count(*) from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and not borrado
                  and id in (v_datos ->> 'from', v_datos ->> 'to')) <> 2 then
            v_motivo := 'las cajas del traspaso no existen en este comercio';
          elsif v_strict and coalesce(case when jsonb_typeof(v_datos -> 'v') = 'number' then (v_datos ->> 'v')::int end, 0) <> 2 then
            v_motivo := 'este traspaso viene de una versión vieja del sistema: actualizá el equipo';
          elsif coalesce(case when jsonb_typeof(v_datos -> 'v') = 'number' then (v_datos ->> 'v')::int end, 0) = 2 then
            declare
              w_fs   text := v_datos ->> 'fromState';
              w_ts   text := v_datos ->> 'toState';
              w_m    text := v_datos -> 'auth' ->> 'method';
              w_aid  uuid;
              w_cond boolean;
              w_fbr  text;
              w_tbr  text;
              w_over numeric := coalesce(case when (v_xf ->> 'approvalOver') ~ '^[0-9]+$' then (v_xf ->> 'approvalOver')::numeric end, 0);
              w_tsm  numeric := coalesce(case when jsonb_typeof(v_datos -> 'ts') = 'number' then (v_datos ->> 'ts')::numeric end, 0);
              w_amt  numeric := (v_datos ->> 'amount')::numeric;
              w_org  public.traspasos;
              w_adm  int;
            begin
              if coalesce(v_datos ->> 'cur', 'ARS') <> 'ARS' then
                v_motivo := 'moneda no admitida: el sistema opera sólo en pesos (ARS)';
              elsif length(btrim(coalesce(v_datos ->> 'motivo', ''))) < 3 or length(v_datos ->> 'motivo') > 200 then
                v_motivo := 'el concepto del traspaso es obligatorio (3 a 200 caracteres)';
              elsif w_fs is null or w_ts is null or w_fs not in ('abierta', 'cerrada') or w_ts not in ('abierta', 'cerrada') then
                v_motivo := 'falta el estado de las cajas al traspasar';
              elsif w_fs = 'abierta' and not exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and not borrado
                        and id = coalesce(v_datos ->> 'fromSess', '') and datos ->> 'regId' = (v_datos ->> 'from')
                        and (coalesce((datos ->> 'closedAt')::numeric, 0) = 0 or (datos ->> 'closedAt')::numeric >= w_tsm)) then
                v_motivo := 'la sesión de la caja de origen no existe en el servidor o no era la abierta: esperá a que sincronice';
              elsif w_ts = 'abierta' and not exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and not borrado
                        and id = coalesce(v_datos ->> 'toSess', '') and datos ->> 'regId' = (v_datos ->> 'to')
                        and (coalesce((datos ->> 'closedAt')::numeric, 0) = 0 or (datos ->> 'closedAt')::numeric >= w_tsm)) then
                v_motivo := 'la sesión de la caja de destino no existe en el servidor o no era la abierta: esperá a que sincronice';
              elsif w_fs = 'cerrada' and exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and not borrado
                        and datos ->> 'regId' = (v_datos ->> 'from') and coalesce((datos ->> 'closedAt')::numeric, 0) = 0
                        and coalesce((datos ->> 'openedAt')::numeric, 0) <= w_tsm) then
                v_motivo := 'la caja de origen figura abierta en el servidor: el estado informado no coincide';
              elsif w_ts = 'cerrada' and exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and not borrado
                        and datos ->> 'regId' = (v_datos ->> 'to') and coalesce((datos ->> 'closedAt')::numeric, 0) = 0
                        and coalesce((datos ->> 'openedAt')::numeric, 0) <= w_tsm) then
                v_motivo := 'la caja de destino figura abierta en el servidor: el estado informado no coincide';
              elsif coalesce(v_datos -> 'auth' ->> 'id', '') !~ '^[0-9a-fA-F-]{36}$' or w_m is null or w_m not in ('permiso_propio', 'pin_admin', 'clave_admin') then
                v_motivo := 'falta el autorizante del traspaso o su método';
              else
                w_aid := (v_datos -> 'auth' ->> 'id')::uuid;
                select datos ->> 'branchId' into w_fbr from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and id = (v_datos ->> 'from');
                select datos ->> 'branchId' into w_tbr from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and id = (v_datos ->> 'to');
                w_cond := w_fs = 'cerrada' or w_ts = 'cerrada' or coalesce(v_datos ->> 'rev', '') <> ''
                          or coalesce(w_fbr, '') <> coalesce(w_tbr, '') or (w_over > 0 and w_amt > w_over);
                if w_m = 'permiso_propio' then
                  if w_cond then
                    v_motivo := 'esta operación (caja cerrada, entre sucursales, importe alto o reversa) necesita la autorización de un administrador';
                  elsif w_aid is distinct from v_uid then
                    v_motivo := 'con permiso propio el autorizante es quien emite el traspaso';
                  end if;
                else
                  select count(*) into w_adm from public.miembros where comercio_id = p_comercio and rol = 'admin';
                  if not exists (select 1 from public.miembros where comercio_id = p_comercio and usuario_id = w_aid and rol = 'admin') then
                    v_motivo := 'el autorizante no es administrador de este comercio';
                  elsif w_aid = v_uid and not coalesce((v_datos -> 'auth' ->> 'self')::boolean, false) then
                    v_motivo := 'el autorizante tiene que ser un administrador distinto de quien emite';
                  elsif w_aid = v_uid and w_adm > 1 and not coalesce((v_xf ->> 'selfAuth')::boolean, false) then
                    v_motivo := 'hay otro administrador: tiene que autorizar él (o habilitar la autorización propia en la configuración)';
                  end if;
                end if;
                if v_motivo is null and coalesce(v_datos ->> 'rev', '') <> '' then
                  select * into w_org from public.traspasos where tenant_id = p_comercio and id = (v_datos ->> 'rev');
                  if not found then v_motivo := 'el traspaso que se quiere revertir no existe';
                  elsif v_rol <> 'admin' then v_motivo := 'sólo el administrador revierte un traspaso';
                  elsif exists (select 1 from public.traspaso_eventos where tenant_id = p_comercio and traspaso_id = w_org.id and kind = 'revertido') then
                    v_motivo := 'ese traspaso ya fue revertido';
                  elsif w_org.amount_cents <> w_amt or w_org.caja_origen <> (v_datos ->> 'to') or w_org.caja_destino <> (v_datos ->> 'from') then
                    v_motivo := 'la reversa tiene que devolver el mismo importe por el camino inverso';
                  elsif w_org.estado_inicial = 'en_transito' and not exists
                        (select 1 from public.traspaso_eventos where tenant_id = p_comercio and traspaso_id = w_org.id and kind in ('recibido', 'recibido_con_diferencia', 'devuelto')) then
                    v_motivo := 'ese traspaso sigue en tránsito: devolvelo en lugar de revertirlo';
                  end if;
                end if;
              end if;
            end;
          end if;
        end if;
        -- V26.1 · pagos mixtos: la suma de los pagos tiene que dar el total exacto; la cuenta corriente exige cliente real.
        -- Los valores derivados (fiadoAmt, paid, balance, pstate) los calcula el servidor: el navegador no los puede falsear.
        if v_motivo is null and v_col = 'ventas' and v_datos ? 'pays' then
          declare
            v_p   jsonb;  v_sum numeric := 0;  v_fi numeric := 0;  v_tot numeric;  v_seen text[] := '{}';  v_m text;
          begin
            v_tot := case when jsonb_typeof(v_datos -> 'total') = 'number' then (v_datos ->> 'total')::numeric end;
            if jsonb_typeof(v_datos -> 'pays') is distinct from 'array' or jsonb_array_length(v_datos -> 'pays') not between 1 and 5 then
              v_motivo := 'pagos inválidos: tiene que haber entre 1 y 5 medios';
            elsif v_tot is null or v_tot <= 0 or v_tot <> trunc(v_tot) then
              v_motivo := 'total de la venta inválido (entero positivo en centavos)';
            else
              for v_p in select * from jsonb_array_elements(v_datos -> 'pays') loop
                v_m := v_p ->> 'm';
                if v_m is null or not (v_m = any(array['efectivo','debito','credito','transferencia','fiado','qr','modo','pedidosya'])) then
                  v_motivo := 'medio de pago inválido'; exit;
                elsif v_m = any(v_seen) then
                  v_motivo := 'medio de pago repetido'; exit;
                elsif jsonb_typeof(v_p -> 'a') is distinct from 'number' or (v_p ->> 'a')::numeric <= 0 or (v_p ->> 'a')::numeric <> trunc((v_p ->> 'a')::numeric) then
                  v_motivo := 'importe de pago inválido (entero positivo en centavos)'; exit;
                end if;
                v_seen := v_seen || v_m;
                v_sum := v_sum + (v_p ->> 'a')::numeric;
                if v_m = 'fiado' then v_fi := v_fi + (v_p ->> 'a')::numeric; end if;
              end loop;
              if v_motivo is null and v_sum <> v_tot then
                v_motivo := 'la suma de los pagos (' || v_sum || ') no coincide con el total (' || v_tot || ')';
              elsif v_motivo is null and jsonb_array_length(v_datos -> 'pays') > 1 and (v_seen && array['qr','modo','pedidosya']) then
                v_motivo := 'los cobros digitales no se combinan con otro medio';
              elsif v_motivo is null and v_fi > 0 and (coalesce(v_datos ->> 'cust', '') = '' or not exists
                    (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'clientes'
                        and id = (v_datos ->> 'cust') and not borrado)) then
                v_motivo := 'la cuenta corriente exige un cliente identificado que exista en este comercio';
              end if;
            end if;
            if v_motivo is null then
              v_datos := v_datos || jsonb_build_object('fiadoAmt', v_fi, 'paid', v_tot - v_fi, 'balance', v_fi, 'fiado', v_fi > 0,
                                  'pstate', case when v_fi = 0 then 'pagada' when v_fi >= v_tot then 'pendiente' else 'parcial' end);
            end if;
          end;
        end if;
        -- V26.4 · 4.22 · canal mayorista y revisión de crédito. El servidor NO rechaza una venta ya hecha por superar el
        -- crédito (el equipo trabaja sin conexión): la marca `credit_review` y el motivo `crw`, que sólo el servidor escribe.
        if v_motivo is null and v_col = 'ventas' then
          declare
            v_fi2 numeric; v_cust text; v_lim numeric; v_deu numeric; v_cov text; v_ok_cov boolean := false; v_why text;
          begin
            v_datos := v_datos - 'credit_review' - 'crw';
            v_cust  := coalesce(v_datos ->> 'cust', '');
            if coalesce(v_datos ->> 'wch', '') not in ('', 'minorista', 'mayorista') then
              v_motivo := 'canal de venta inválido';
            elsif v_datos ->> 'wch' = 'mayorista' and (v_cust = '' or not exists
                  (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'clientes' and id = v_cust and not borrado)) then
              v_motivo := 'una venta mayorista exige un cliente identificado que exista en este comercio';
            elsif v_hay then
              if v_prev.datos ? 'credit_review' then
                v_datos := v_datos || jsonb_build_object('credit_review', v_prev.datos -> 'credit_review', 'crw', v_prev.datos -> 'crw');
              end if;
            else
              v_fi2 := coalesce(case when jsonb_typeof(v_datos -> 'fiadoAmt') = 'number' then (v_datos ->> 'fiadoAmt')::numeric end,
                                case when coalesce((v_datos ->> 'fiado')::boolean, false) and jsonb_typeof(v_datos -> 'total') = 'number'
                                     then (v_datos ->> 'total')::numeric end, 0);
              if v_fi2 > 0 and v_cust <> '' then
                select coalesce((datos ->> 'limit')::numeric, 0) into v_lim from public.registros
                 where comercio_id = p_comercio and coleccion = 'clientes' and id = v_cust and not borrado;
                v_deu := public.rave_deuda_cliente(p_comercio, v_cust);
                v_cov := coalesce(v_datos ->> 'cov', '');
                if v_cov <> '' then
                  select exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'cexc' and id = v_cov and not borrado
                                    and datos ->> 'cust' = v_cust and (datos ->> 'max')::numeric >= v_fi2) into v_ok_cov;
                end if;
                if coalesce(v_lim, 0) <= 0 then v_why := 'sin_limite';
                elsif v_deu + v_fi2 > v_lim then v_why := 'supera_limite'; end if;
                if v_why is not null and not v_ok_cov then
                  v_datos := v_datos || jsonb_build_object('credit_review', true,
                               'crw', v_why || case when v_cov <> '' then '+excepcion_invalida' else '' end);
                end if;
              end if;
            end if;
          end;
        end if;
        -- V26.4 · 4.22 · acuerdos especiales, excepciones de crédito y su consumo
        if v_motivo is null and v_col in ('acuer', 'cexc') and not v_borrado then
          if coalesce(v_datos ->> 'cust', '') = '' or not exists
             (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'clientes' and id = (v_datos ->> 'cust') and not borrado) then
            v_motivo := 'tiene que apuntar a un cliente que exista en este comercio';
          elsif v_col = 'cexc' then
            if jsonb_typeof(v_datos -> 'max') is distinct from 'number' or (v_datos ->> 'max')::numeric <= 0
               or (v_datos ->> 'max')::numeric <> trunc((v_datos ->> 'max')::numeric) or (v_datos ->> 'max')::numeric > 100000000000 then
              v_motivo := 'monto de la excepción inválido (entero positivo en centavos)';
            elsif jsonb_typeof(v_datos -> 'until') is distinct from 'number' then
              v_motivo := 'vigencia de la excepción inválida';
            elsif length(btrim(coalesce(v_datos ->> 'reason', ''))) < 5 then
              v_motivo := 'el motivo de la excepción es obligatorio (mínimo 5 letras)';
            end if;
          else
            if coalesce(v_datos ->> 'pid', '') = '' and coalesce(v_datos ->> 'rubro', '') = '' then
              v_motivo := 'el acuerdo tiene que ser sobre un producto o un rubro';
            elsif (jsonb_typeof(v_datos -> 'price') is distinct from 'number' and jsonb_typeof(v_datos -> 'pct') is distinct from 'number') then
              v_motivo := 'el acuerdo necesita un precio o un porcentaje';
            elsif coalesce((v_datos ->> 'price')::numeric, 0) < 0 or coalesce((v_datos ->> 'price')::numeric, 0) <> trunc(coalesce((v_datos ->> 'price')::numeric, 0))
                  or coalesce((v_datos ->> 'pct')::numeric, 0) < 0 or coalesce((v_datos ->> 'pct')::numeric, 0) >= 100
                  or (coalesce((v_datos ->> 'price')::numeric, 0) > 0) = (coalesce((v_datos ->> 'pct')::numeric, 0) > 0) then
              v_motivo := 'acuerdo inválido: usá un precio entero en centavos o un porcentaje menor a 100, no ambos';
            end if;
          end if;
        end if;
        if v_motivo is null and v_col = 'cexcu' then
          if not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'cexc' and id = coalesce(v_datos ->> 'ov', '') and not borrado) then
            v_motivo := 'la excepción de crédito no existe en este comercio';
          elsif jsonb_typeof(v_datos -> 'amt') is distinct from 'number' or (v_datos ->> 'amt')::numeric <= 0
                or (v_datos ->> 'amt')::numeric <> trunc((v_datos ->> 'amt')::numeric) then
            v_motivo := 'importe de uso inválido';
          end if;
        end if;
        if v_motivo is null and v_col in ('cajas', 'sucs') and jsonb_typeof(v_datos -> 'name') is distinct from 'string' then
          v_motivo := 'falta el nombre';
        end if;

        -- V26.9 · 4.23.8 · eventos de un traspaso: recepción, diferencia, devolución y notas (sólo-agregar)
        if v_motivo is null and v_col = 'ctev' then
          declare
            w_tr   public.traspasos;
            w_k    text := v_datos ->> 'kind';
            w_amt  numeric;
            w_ses  text := coalesce(v_datos ->> 'sess', '');
            w_reg  text;
          begin
            select * into w_tr from public.traspasos where tenant_id = p_comercio and id = coalesce(v_datos ->> 'tid', '');
            if not found then
              v_motivo := 'el traspaso no existe en este comercio (esperá a que sincronice)';
            elsif w_k is null or w_k not in ('recibido', 'recibido_con_diferencia', 'devuelto', 'anotado') then
              v_motivo := 'tipo de evento inválido';
            elsif w_k = 'anotado' then
              if length(btrim(coalesce(v_datos ->> 'nota', ''))) < 3 then v_motivo := 'la nota es obligatoria (mínimo 3 letras)'; end if;
            elsif w_tr.estado_inicial <> 'en_transito' then
              v_motivo := 'este traspaso no está en tránsito';
            elsif exists (select 1 from public.traspaso_eventos where tenant_id = p_comercio and traspaso_id = w_tr.id
                             and kind in ('recibido', 'recibido_con_diferencia', 'devuelto')) then
              v_motivo := 'este traspaso ya fue resuelto';
            elsif jsonb_typeof(v_datos -> 'amt') is distinct from 'number' or (v_datos ->> 'amt')::numeric < 0
                  or (v_datos ->> 'amt')::numeric <> trunc((v_datos ->> 'amt')::numeric) then
              v_motivo := 'importe inválido (entero en centavos)';
            else
              w_amt := (v_datos ->> 'amt')::numeric;
              if w_k in ('recibido', 'devuelto') and w_amt <> w_tr.amount_cents then
                v_motivo := 'el importe tiene que ser el enviado; si difiere, registralo como «recibido con diferencia»';
              elsif w_k = 'recibido_con_diferencia' and (w_amt >= w_tr.amount_cents) then
                v_motivo := 'con diferencia el importe recibido es menor al enviado (no se acepta recibir de más)';
              elsif w_k = 'recibido_con_diferencia' and length(btrim(coalesce(v_datos ->> 'nota', ''))) < 5 then
                v_motivo := 'explicá la diferencia (mínimo 5 letras)';
              end if;
              if v_motivo is null and w_ses <> '' then
                w_reg := case when w_k = 'devuelto' then w_tr.caja_origen else w_tr.caja_destino end;
                if not exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'turnos' and id = w_ses
                                  and not borrado and datos ->> 'regId' = w_reg) then
                  v_motivo := 'la sesión de caja indicada no corresponde a la caja que recibe';
                end if;
              end if;
            end if;
          end;
        end if;

        -- V26.9 · 4.23.4 · detalle de un cobro digital (transferencia, tarjeta, QR): versionado, sólo-agregar, nunca un número de tarjeta
        if v_motivo is null and v_col = 'cdet' then
          declare
            w_sale  public.registros;
            w_med   text := v_datos ->> 'medio';
            w_idx   int;
            w_ver   int;
            w_prev  public.cobro_detalles;
            w_pay   jsonb := public.rave_cfg_bloque(p_comercio, 'pay');
            w_fld   jsonb;
            w_ahora numeric := extract(epoch from clock_timestamp()) * 1000;
            w_fh    numeric := coalesce(case when jsonb_typeof(v_datos -> 'fh') = 'number' then (v_datos ->> 'fh')::numeric end, 0);
            w_age   numeric := coalesce(case when (w_pay ->> 'maxAgeH') ~ '^[0-9]+$' then (w_pay ->> 'maxAgeH')::numeric end, 0);
            w_pend  boolean := coalesce((v_datos ->> 'pend')::boolean, false);
            w_key   text;
            w_ent   text;
            w_nro   text;
            w_ok    boolean;
            -- ¿el campo es obligatorio? (los no relajables siempre; el resto según la matriz del comercio, por defecto obligatorio)
            w_req   text;
          begin
            w_idx := case when (v_datos ->> 'idx') ~ '^[0-9]$' then (v_datos ->> 'idx')::int end;
            w_ver := case when (v_datos ->> 'ver') ~ '^[0-9]{1,3}$' then (v_datos ->> 'ver')::int end;
            w_fld := coalesce(w_pay -> 'detail' -> 'fields' -> w_med, '{}'::jsonb);
            select * into w_sale from public.registros where comercio_id = p_comercio and coleccion = 'ventas' and id = coalesce(v_datos ->> 'sale', '') and not borrado;
            if w_med is null or w_med not in ('transferencia', 'debito', 'credito', 'qr', 'modo') then
              v_motivo := 'medio del detalle inválido';
            elsif w_idx is null or w_ver is null or w_ver < 1 or v_id <> (v_datos ->> 'sale') || '#' || w_idx || '#' || w_ver then
              v_motivo := 'identificador del detalle inválido (venta#pago#versión)';
            elsif not found then
              v_motivo := 'la venta del detalle no existe en este comercio (esperá a que sincronice)';
            elsif jsonb_typeof(w_sale.datos -> 'pays') is distinct from 'array' or jsonb_array_length(w_sale.datos -> 'pays') <= w_idx
                  or (w_sale.datos -> 'pays' -> w_idx ->> 'm') is distinct from w_med then
              v_motivo := 'el detalle no corresponde al medio de pago de esa venta';
            elsif coalesce(v_datos ->> 'st', 'declarado') <> 'declarado' then
              v_motivo := 'un cobro cargado a mano queda «declarado»: sólo una integración verificada lo acredita';
            elsif v_datos ? 'ordName' or v_datos ? 'ordDoc' or v_datos ? 'ord' then
              v_motivo := 'el titular ordenante viaja cifrado: no se acepta en claro';
            elsif public.rave_json_tiene_pan(v_datos) then
              v_motivo := 'un campo parece un número de tarjeta completo: nunca se guarda (sólo los últimos 4 dígitos)';
            elsif w_fh > w_ahora + 300000 then
              v_motivo := 'la fecha y hora del comprobante está en el futuro';
            elsif w_age > 0 and w_fh > 0 and w_fh < w_ahora - w_age * 3600000 then
              v_motivo := 'el comprobante es más viejo que lo permitido (' || w_age || ' h)';
            elsif w_ver > 1 and not (v_rol in ('admin', 'supervisor') or exists
                   (select 1 from public.cobro_detalles where tenant_id = p_comercio and sale_id = (v_datos ->> 'sale') and pay_idx = w_idx and created_by = v_uid)) then
              v_motivo := 'sólo el administrador, el supervisor o quien cobró completan el detalle';
            else
              select * into w_prev from public.cobro_detalles where tenant_id = p_comercio and sale_id = (v_datos ->> 'sale') and pay_idx = w_idx
                order by version desc limit 1;
              if w_ver > 1 and (not found or w_prev.version <> w_ver - 1) then
                v_motivo := 'falta la versión anterior del detalle';
              elsif w_ver = 1 and found then
                v_motivo := 'ya hay un detalle para ese pago: la corrección es una versión nueva';
              end if;
            end if;
            -- campos por medio
            if v_motivo is null then
              if w_med = 'transferencia' then
                w_req := coalesce(w_fld ->> 'ent', 'obligatorio');
                if (w_req = 'obligatorio' and not w_pend and length(btrim(coalesce(v_datos ->> 'ent', ''))) not between 2 and 60)
                   or (coalesce(v_datos ->> 'ent', '') <> '' and length(btrim(v_datos ->> 'ent')) not between 2 and 60) then
                  v_motivo := 'banco o entidad de origen inválido (2 a 60 caracteres)';
                end if;
                if v_motivo is null and coalesce(w_fld ->> 'dest', 'obligatorio') = 'obligatorio' and not w_pend and length(btrim(coalesce(v_datos ->> 'dest', ''))) not between 2 and 60 then
                  v_motivo := 'falta la cuenta de destino';
                end if;
                if v_motivo is null and coalesce(v_datos ->> 'nro', '') !~ '^[A-Za-z0-9]{6,40}$' then
                  v_motivo := 'el N.º de comprobante/operación es obligatorio (6 a 40 letras o números) y no se puede omitir';
                end if;
                if v_motivo is null and w_fh = 0 and coalesce(w_fld ->> 'fh', 'obligatorio') = 'obligatorio' and not w_pend then
                  v_motivo := 'falta la fecha y hora de la transferencia';
                end if;
                w_ent := lower(btrim(coalesce(v_datos ->> 'ent', '')));
                w_nro := lower(v_datos ->> 'nro');
                w_key := 'transferencia|' || w_ent || '|' || w_nro;
              elsif w_med in ('debito', 'credito') then
                if (v_datos ->> 'kind') is distinct from w_med then
                  v_motivo := 'el tipo de tarjeta no coincide con el medio de pago';
                elsif coalesce(v_datos ->> 'auth', '') !~ '^[A-Za-z0-9]{4,12}$' then
                  v_motivo := 'el código de autorización es obligatorio (4 a 12 letras o números) y no se puede omitir';
                elsif coalesce(v_datos ->> 'last4', '') !~ '^[0-9]{4}$' then
                  v_motivo := 'los últimos 4 dígitos de la tarjeta son exactamente 4 números';
                elsif jsonb_typeof(v_datos -> 'cuotas') is distinct from 'number' or (v_datos ->> 'cuotas')::numeric <> trunc((v_datos ->> 'cuotas')::numeric)
                      or (v_datos ->> 'cuotas')::numeric < 1 or (v_datos ->> 'cuotas')::numeric > 60 or (w_med = 'debito' and (v_datos ->> 'cuotas')::numeric <> 1) then
                  v_motivo := 'cuotas inválidas (entero de 1 a 60; el débito es 1)';
                elsif not w_pend and coalesce(w_fld ->> 'brand', 'obligatorio') = 'obligatorio' and length(btrim(coalesce(v_datos ->> 'brand', ''))) not between 2 and 30 then
                  v_motivo := 'falta la marca de la tarjeta';
                elsif not w_pend and coalesce(w_fld ->> 'cupon', 'obligatorio') = 'obligatorio' and coalesce(v_datos ->> 'cupon', '') !~ '^[A-Za-z0-9]{1,20}$' then
                  v_motivo := 'falta el N.º de cupón / lote / terminal (1 a 20 letras o números)';
                end if;
                w_key := null;
              else
                if coalesce(v_datos ->> 'txid', '') !~ '^[A-Za-z0-9]{4,60}$' then
                  v_motivo := 'el ID de transacción del proveedor es obligatorio (4 a 60 letras o números) y no se puede omitir';
                elsif not w_pend and coalesce(w_fld ->> 'prov', 'obligatorio') = 'obligatorio' and length(btrim(coalesce(v_datos ->> 'prov', ''))) not between 2 and 40 then
                  v_motivo := 'falta el proveedor del cobro (Mercado Pago, MODO…)';
                end if;
                w_ent := lower(btrim(coalesce(v_datos ->> 'prov', '')));
                w_nro := lower(v_datos ->> 'txid');
                w_key := 'qr|' || w_ent || '|' || w_nro;
              end if;
            end if;
            -- excepción «cobro sin comprobante»: la autoriza un supervisor/administrador con motivo
            if v_motivo is null and w_pend then
              if length(btrim(coalesce(v_datos -> 'exc' ->> 'reason', ''))) < 5 or coalesce(v_datos -> 'exc' ->> 'by', '') !~ '^[0-9a-fA-F-]{36}$'
                 or not exists (select 1 from public.miembros where comercio_id = p_comercio and usuario_id = (v_datos -> 'exc' ->> 'by')::uuid and rol in ('admin', 'supervisor')) then
                v_motivo := 'el cobro sin comprobante necesita un supervisor o administrador y un motivo';
              end if;
            end if;
            -- duplicados: el N.º de operación / ID de transacción no se repite salvo autorización con motivo
            if v_motivo is null and w_key is not null then
              if w_ver > 1 and w_prev.clave_unica is not null and w_prev.clave_unica = w_key then
                w_key := null;                                    -- misma clave que la versión anterior: la sigue reservando esa versión
              elsif w_ver > 1 and lower(coalesce(w_prev.nro_operacion, '')) = coalesce(w_nro, '') and lower(btrim(coalesce(w_prev.entidad, ''))) = w_ent then
                w_key := null;                                    -- ya estaba autorizada como repetida
              elsif exists (select 1 from public.cobro_detalles where tenant_id = p_comercio and clave_unica = w_key
                               and not (sale_id = (v_datos ->> 'sale') and pay_idx = w_idx)) then
                if length(btrim(coalesce(v_datos -> 'dupAuth' ->> 'reason', ''))) >= 5 and coalesce(v_datos -> 'dupAuth' ->> 'by', '') ~ '^[0-9a-fA-F-]{36}$'
                   and exists (select 1 from public.miembros where comercio_id = p_comercio and usuario_id = (v_datos -> 'dupAuth' ->> 'by')::uuid and rol in ('admin', 'supervisor')) then
                  w_key := null;
                else
                  v_motivo := 'ese N.º de operación / ID de transacción ya fue cargado en otro cobro: sólo un supervisor lo autoriza, con motivo';
                end if;
              end if;
            end if;
            if v_motivo is null then
              v_datos := v_datos || jsonb_build_object('_ck', w_key);   -- clave única calculada por el servidor (se usa al insertar)
            end if;
          end;
        end if;

        -- V26.9 · 4.24 · clientes del Club: baja y eliminación sólo del administrador, sin historial ni deuda, sin resucitar
        if v_motivo is null and v_col = 'clientes' then
          declare
            w_adm  boolean := v_rol = 'admin' or public.rave_tiene_permiso(p_comercio, v_uid, 'customers_admin');
            w_old  jsonb := case when v_hay then v_prev.datos else '{}'::jsonb end;
            w_deu  numeric;
            w_hist text;
            w_mode text;
            w_grant boolean;
          begin
            if v_hay and v_prev.borrado and not v_borrado then
              v_motivo := 'ese cliente fue eliminado por el administrador: no se vuelve a cargar';
            elsif v_borrado then
              if not w_adm then
                v_motivo := 'sólo el administrador elimina clientes';
              elsif v_hay and not v_prev.borrado then
                select string_agg(x, ', ') into w_hist from (
                  select 'ventas' x where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'ventas' and not borrado and datos ->> 'cust' = v_id)
                  union all select 'cuenta corriente' where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'fiado' and not borrado and datos ->> 'cust' = v_id)
                  union all select 'cupones usados' where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'cusos' and not borrado and datos ->> 'cust' = v_id)
                  union all select 'membresías' where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'membs' and not borrado and datos ->> 'cust' = v_id)
                  union all select 'sellos o canjes' where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion = 'sellos' and not borrado and datos ->> 'cust' = v_id)
                  union all select 'excepciones o acuerdos' where exists (select 1 from public.registros where comercio_id = p_comercio and coleccion in ('cexc', 'acuer') and not borrado and datos ->> 'cust' = v_id)
                ) q;
                w_deu := public.rave_deuda_cliente(p_comercio, v_id);
                if w_hist is not null then
                  v_motivo := 'tiene historial (' || w_hist || '): sólo se puede dar de baja';
                elsif w_deu > 0 then
                  v_motivo := 'tiene deuda en cuenta corriente: no se elimina';
                end if;
              end if;
            else
              if coalesce(v_datos ->> 'status', '') = 'baja' and coalesce(w_old ->> 'status', '') <> 'baja' then
                if not w_adm then
                  v_motivo := 'sólo el administrador da de baja a un cliente';
                else
                  w_deu := public.rave_deuda_cliente(p_comercio, v_id);
                  w_mode := v_datos -> 'debtDec' ->> 'mode';
                  if w_deu > 0 and (w_mode is distinct from 'mantener' or length(btrim(coalesce(v_datos -> 'debtDec' ->> 'reason', ''))) < 5) then
                    v_motivo := 'tiene deuda en cuenta corriente: cobrala, condonala con un movimiento y motivo, o decidí mantenerla (con motivo)';
                  end if;
                end if;
              elsif coalesce(w_old ->> 'status', '') = 'baja' and coalesce(v_datos ->> 'status', '') <> 'baja' and not w_adm then
                v_motivo := 'un cliente dado de baja sólo lo reactiva el administrador';
              end if;
              if v_motivo is null and v_hay and not w_adm then
                if coalesce(v_datos ->> 'channel', '') is distinct from coalesce(w_old ->> 'channel', '')
                   or coalesce(v_datos ->> 'term', '') is distinct from coalesce(w_old ->> 'term', '')
                   or coalesce(v_datos ->> 'zone', '') is distinct from coalesce(w_old ->> 'zone', '')
                   or coalesce(v_datos ->> 'seller', '') is distinct from coalesce(w_old ->> 'seller', '') then
                  v_motivo := 'los datos mayoristas (canal, plazo, zona, vendedor) los cambia el administrador';
                elsif coalesce(v_datos ->> 'pfp', '') is distinct from coalesce(w_old ->> 'pfp', '') and coalesce(w_old ->> 'pfp', '') <> '' then
                  v_motivo := 'WhatsApp, correo, DNI, nacimiento y CUIT del cliente los cambia el administrador';
                end if;
              end if;
              if v_motivo is null and v_hay then
                w_grant := (coalesce((v_datos -> 'consent' ->> 'comm')::boolean, false) and not coalesce((w_old -> 'consent' ->> 'comm')::boolean, false))
                           or (coalesce((v_datos -> 'consent' ->> 'analytics')::boolean, false) and not coalesce((w_old -> 'consent' ->> 'analytics')::boolean, false));
                if w_grant and not w_adm then
                  v_motivo := 'otorgar un consentimiento lo registra el administrador, con la constancia del titular';
                elsif w_grant and length(btrim(coalesce(v_datos -> 'consent' ->> 'proof', ''))) < 10 then
                  v_motivo := 'otorgar un consentimiento exige la constancia (cómo y cuándo lo dio el titular, mínimo 10 letras)';
                end if;
              end if;
              if v_motivo is null and v_rol in ('mostrador', 'operador') and not w_adm
                 and coalesce((v_datos ->> 'limit')::numeric, 0) is distinct from coalesce((w_old ->> 'limit')::numeric, 0) then
                v_motivo := 'el límite de crédito lo cambia el administrador';
              end if;
            end if;
          end;
        end if;

        if v_motivo is not null then
          v_rechazos := v_rechazos || jsonb_build_object('c', v_col, 'id', v_id, 'motivo', v_motivo);
          continue;
        end if;

        -- ---- reglas por colección ----
        if v_col = 'smov' then
          -- movimiento de stock: se suma en el servidor sobre el producto
          v_pid := v_datos ->> 'pid';
          begin v_delta := (v_datos ->> 'd')::numeric; exception when others then v_delta := null; end;
          if v_pid is null or v_delta is null or abs(v_delta) > 1000000 then
            v_rechazos := v_rechazos || jsonb_build_object('c', v_col, 'id', v_id, 'motivo', 'movimiento de stock inválido');
            continue;
          end if;
          select * into v_prev from public.registros
           where comercio_id = p_comercio and coleccion = 'prod' and id = v_pid and not borrado for update;
          if not found then
            v_rechazos := v_rechazos || jsonb_build_object('c', v_col, 'id', v_id, 'motivo', 'el producto no existe');
            continue;
          end if;
          v_stock := round(coalesce((v_prev.datos ->> 'stock')::numeric, 0) + v_delta, 3);
          update public.registros
             set datos = jsonb_set(datos, '{stock}', to_jsonb(v_stock)),
                 dispositivo = left(p_dispositivo, 40), usuario_id = auth.uid(), actualizado = clock_timestamp()
           where comercio_id = p_comercio and coleccion = 'prod' and id = v_pid;
        elsif v_col = 'ctransf' and coalesce(case when jsonb_typeof(v_datos -> 'v') = 'number' then (v_datos ->> 'v')::int end, 0) = 2 then
          -- V26.9 · comprobante de traspaso v2: el servidor asigna el número consecutivo por caja de origen, la hora oficial y la cadena de hash
          perform pg_advisory_xact_lock(hashtextextended('xfer-n:' || p_comercio::text || ':' || (v_datos ->> 'from'), 12));
          select coalesce(max(n), 0) + 1 into v_n from public.traspasos where tenant_id = p_comercio and caja_origen = (v_datos ->> 'from');
          select coalesce(nullif(datos ->> 'code', ''), left(id, 12)) into v_code from public.registros
           where comercio_id = p_comercio and coleccion = 'cajas' and id = (v_datos ->> 'from');
          select coalesce(datos ->> 'name', '') into v_rn from public.registros
           where comercio_id = p_comercio and coleccion = 'rubros' and id = (v_datos ->> 'rubro');
          v_num := 'T-' || v_code || '-' || v_n;
          v_estado := case when v_datos ->> 'toState' = 'cerrada' then 'en_transito' else 'completado' end;
          v_datos := v_datos || jsonb_build_object('n', v_n, 'num', v_num, 'state', v_estado, 'uid', v_uid::text, 'rubroName', v_rn);
          insert into public.traspasos (tenant_id, id, caja_origen, caja_destino, n, num, amount_cents, currency, rubro_id, rubro_nombre, motivo,
                                        emisor_id, emisor_nombre, autorizante_id, autorizante_nombre, auth_metodo, suc_origen, suc_destino,
                                        estado_caja_origen, estado_caja_destino, ref_origen, ref_destino, estado_inicial, rev_of,
                                        ts_equipo, hora_desfasada, datos)
          values (p_comercio, v_id, v_datos ->> 'from', v_datos ->> 'to', v_n, v_num, (v_datos ->> 'amount')::bigint, 'ARS', v_datos ->> 'rubro', v_rn,
                  btrim(v_datos ->> 'motivo'), v_uid, coalesce(public.rave_nombre_usuario(p_comercio), left(v_datos ->> 'user', 80)),
                  (v_datos -> 'auth' ->> 'id')::uuid, left(v_datos -> 'auth' ->> 'name', 80), v_datos -> 'auth' ->> 'method',
                  (select datos ->> 'branchId' from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and id = (v_datos ->> 'from')),
                  (select datos ->> 'branchId' from public.registros where comercio_id = p_comercio and coleccion = 'cajas' and id = (v_datos ->> 'to')),
                  v_datos ->> 'fromState', v_datos ->> 'toState',
                  left(coalesce(nullif(v_datos ->> 'fromSess', ''), v_datos ->> 'fromRef'), 80), left(coalesce(nullif(v_datos ->> 'toSess', ''), v_datos ->> 'toRef'), 80),
                  v_estado, nullif(v_datos ->> 'rev', ''),
                  case when jsonb_typeof(v_datos -> 'ts') = 'number' then to_timestamp((v_datos ->> 'ts')::numeric / 1000.0) end,
                  case when jsonb_typeof(v_datos -> 'ts') = 'number' then abs((v_datos ->> 'ts')::numeric - extract(epoch from clock_timestamp()) * 1000) > 600000 else true end,
                  v_datos)
          returning seq, hash, ts_servidor into v_seq, v_hs, v_tss;
          v_datos := v_datos || jsonb_build_object('sseq', v_seq, 'sh', v_hs, 'tss', (extract(epoch from v_tss) * 1000)::bigint);
          insert into public.traspaso_eventos (tenant_id, id, traspaso_id, kind, usuario_id, usuario_nombre, ts_equipo)
          values (p_comercio, 'srv-' || gen_random_uuid()::text, v_id, 'emitido', v_uid, coalesce(public.rave_nombre_usuario(p_comercio), '?'),
                  case when jsonb_typeof(v_datos -> 'ts') = 'number' then to_timestamp((v_datos ->> 'ts')::numeric / 1000.0) end);
          if v_estado = 'en_transito' then
            insert into public.traspaso_eventos (tenant_id, id, traspaso_id, kind, usuario_id, usuario_nombre)
            values (p_comercio, 'srv-' || gen_random_uuid()::text, v_id, 'en_transito', v_uid, coalesce(public.rave_nombre_usuario(p_comercio), '?'));
          end if;
          if coalesce(v_datos ->> 'rev', '') <> '' then
            insert into public.traspaso_eventos (tenant_id, id, traspaso_id, kind, nota, usuario_id, usuario_nombre)
            values (p_comercio, 'srv-' || gen_random_uuid()::text, v_datos ->> 'rev', 'revertido', 'reversa ' || v_num, v_uid, coalesce(public.rave_nombre_usuario(p_comercio), '?'));
          end if;
        elsif v_col = 'ctev' then
          insert into public.traspaso_eventos (tenant_id, id, traspaso_id, kind, amount_cents, nota, sess, usuario_id, usuario_nombre, ts_equipo, datos)
          values (p_comercio, v_id, v_datos ->> 'tid', v_datos ->> 'kind',
                  case when v_datos ->> 'kind' <> 'anotado' then (v_datos ->> 'amt')::bigint end,
                  left(btrim(coalesce(v_datos ->> 'nota', '')), 300), nullif(v_datos ->> 'sess', ''), v_uid,
                  coalesce(public.rave_nombre_usuario(p_comercio), '?'),
                  case when jsonb_typeof(v_datos -> 'ts') = 'number' then to_timestamp((v_datos ->> 'ts')::numeric / 1000.0) end, v_datos)
          returning seq, hash, ts_servidor into v_seq, v_hs, v_tss;
          v_datos := v_datos || jsonb_build_object('uid', v_uid::text, 'sseq', v_seq, 'sh', v_hs, 'tss', (extract(epoch from v_tss) * 1000)::bigint);
        elsif v_col = 'cdet' then
          v_ck := v_datos ->> '_ck';
          v_datos := v_datos - '_ck';
          insert into public.cobro_detalles (tenant_id, id, sale_id, pay_idx, version, medio, estado, entidad, nro_operacion, clave_unica,
                                             pendiente, excepcion, duplicado_ok, created_by, ts_equipo, datos)
          values (p_comercio, v_id, v_datos ->> 'sale', (v_datos ->> 'idx')::int, (v_datos ->> 'ver')::int, v_datos ->> 'medio', 'declarado',
                  left(coalesce(nullif(v_datos ->> 'ent', ''), nullif(v_datos ->> 'prov', ''), v_datos ->> 'brand'), 60),
                  left(coalesce(nullif(v_datos ->> 'nro', ''), nullif(v_datos ->> 'txid', ''), v_datos ->> 'auth'), 60), v_ck,
                  coalesce((v_datos ->> 'pend')::boolean, false), v_datos -> 'exc', v_datos -> 'dupAuth', v_uid,
                  case when jsonb_typeof(v_datos -> 'ts') = 'number' then to_timestamp((v_datos ->> 'ts')::numeric / 1000.0) end, v_datos)
          returning seq, hash, ts_servidor into v_seq, v_hs, v_tss;
          v_datos := v_datos || jsonb_build_object('uid', v_uid::text, 'sseq', v_seq, 'sh', v_hs, 'tss', (extract(epoch from v_tss) * 1000)::bigint);
        elsif v_col = 'prod' then
          -- el stock lo manda el servidor, nunca el navegador
          v_datos := v_datos - 'stock';
          v_datos := v_datos || jsonb_build_object('stock', case when v_hay then coalesce(v_prev.datos -> 'stock', '0'::jsonb) else '0'::jsonb end);
        elsif v_col = 'ventas' then
          -- el CAE lo escribe sólo el servidor fiscal: el navegador no lo puede pisar ni inventar
          v_datos := v_datos - 'arca' - 'arcaNC';
          if v_hay then
            -- V26.1 · una venta con pagos registrados no cambia sus importes ni su cliente (se corrige con anulación / nota de crédito)
            if v_prev.datos ? 'pays' then
              v_datos := (v_datos - 'pays' - 'fiadoAmt' - 'paid' - 'balance' - 'vuelto' - 'recv' - 'total' - 'items' - 'cust' - 'custName' - 'method' - 'pstate' - 'fiado')
                         || jsonb_strip_nulls(jsonb_build_object('pays', v_prev.datos -> 'pays', 'fiadoAmt', v_prev.datos -> 'fiadoAmt',
                            'paid', v_prev.datos -> 'paid', 'balance', v_prev.datos -> 'balance', 'vuelto', v_prev.datos -> 'vuelto',
                            'recv', v_prev.datos -> 'recv', 'total', v_prev.datos -> 'total', 'items', v_prev.datos -> 'items',
                            'cust', v_prev.datos -> 'cust', 'custName', v_prev.datos -> 'custName', 'method', v_prev.datos -> 'method',
                            'pstate', v_prev.datos -> 'pstate', 'fiado', v_prev.datos -> 'fiado'));
            end if;
            if v_prev.datos ? 'arca'   then v_datos := v_datos || jsonb_build_object('arca',   v_prev.datos -> 'arca');   end if;
            if v_prev.datos ? 'arcaNC' then v_datos := v_datos || jsonb_build_object('arcaNC', v_prev.datos -> 'arcaNC'); end if;
            -- con CAE, el comprobante no cambia: el cliente sólo puede agregar su estado de anulación
            if (v_prev.datos -> 'arca' ->> 'cae') is not null then
              v_datos := v_prev.datos || (v_datos - 'items' - 'total' - 'doc' - 'n' - 'ts' - 'cust' - 'custName' - 'method');
            end if;
          end if;
        elsif v_col = 'cfg' then
          foreach v_k in array c_secretos loop
            v_datos := v_datos - v_k;
          end loop;
          -- V26.9 · las banderas de traspasos y de detalle de cobros las cambia sólo el administrador
          if v_id = 'cfg' and v_rol <> 'admin' then
            v_datos := v_datos - 'xfer' - 'pay';
            if v_hay then
              v_datos := v_datos || jsonb_strip_nulls(jsonb_build_object('xfer', v_prev.datos -> 'xfer', 'pay', v_prev.datos -> 'pay'));
            end if;
          end if;
        end if;

        if v_col <> 'smov' then
          insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
          values (p_comercio, v_col, v_id, v_datos, v_borrado, left(p_dispositivo, 40), auth.uid(), clock_timestamp())
          on conflict (comercio_id, coleccion, id) do update
             set datos = excluded.datos, borrado = excluded.borrado, dispositivo = excluded.dispositivo,
                 usuario_id = excluded.usuario_id, actualizado = excluded.actualizado;
        else
          -- el propio movimiento queda registrado (una sola vez)
          insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
          values (p_comercio, 'smov', v_id, v_datos, false, left(p_dispositivo, 40), auth.uid(), clock_timestamp());
        end if;
        if v_col = 'prod' and v_borrado then
          v_aid := 'srv-' || gen_random_uuid()::text;
          insert into public.registros (comercio_id, coleccion, id, datos, borrado, dispositivo, usuario_id, actualizado)
          values (p_comercio, 'audit', v_aid,
                  jsonb_build_object('id', v_aid, 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint,
                                     'user', coalesce(public.mi_email(), '?'), 'action', 'INV_ELIMINAR_SERVIDOR',
                                     'detail', 'artículo ' || v_id || ' eliminado (sin historial)', 'dev', left(p_dispositivo, 40)),
                  false, left(p_dispositivo, 40), auth.uid(), clock_timestamp())
          on conflict do nothing;
        end if;
        v_aplicados := v_aplicados + 1;
      exception when others then
        v_rechazos := v_rechazos || jsonb_build_object('c', v_col, 'id', v_id, 'motivo', left(sqlerrm, 160));
      end;
    end loop;
  end loop;

  return jsonb_build_object('aplicados', v_aplicados, 'omitidos', v_omitidos, 'rechazos', v_rechazos,
                            'ahora', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end $$;
revoke all on function public.sincronizar(uuid, text, jsonb) from public, anon;
grant execute on function public.sincronizar(uuid, text, jsonb) to authenticated;
