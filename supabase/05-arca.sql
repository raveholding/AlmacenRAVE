-- =====================================================================
-- SISTEMA RAVE · 05 · Facturación electrónica ARCA (CAE automático)
-- Correr DESPUÉS de 01 a 04. Se puede correr las veces que haga falta.
--
-- Todo el trato con ARCA (WSAA + WSFEv1) lo hace la Edge Function "arca"
-- en el servidor: el navegador NUNCA habla con ARCA ni ve la clave privada.
--
--   · arca_config        datos del emisor por ambiente (homologación / producción)
--   · arca_credenciales  clave privada (cifrada con un secreto de la función),
--                        CSR, certificado y ticket de acceso. SIN políticas:
--                        ningún usuario la lee por la API; sólo el rol de servicio.
--   · arca_comprobantes  un renglón por documento: pendiente → enviando →
--                        aprobado / rechazado / error. Con CAE es INMUTABLE.
--   · arca_locks         cerrojo con vencimiento por (comercio, ambiente, punto
--                        de venta, tipo) para numerar de a uno.
-- Apagado por defecto: nada se factura hasta que el administrador lo active
-- y se haya probado en homologación con su certificado real.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Validación de CUIT/CUIL (dígito verificador, módulo 11)
-- ---------------------------------------------------------------------
create or replace function public.rave_cuit_ok(p text)
returns boolean
language plpgsql immutable set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  w int[] := array[5,4,3,2,7,6,5,4,3,2];
  s int := 0; i int; r int; v int;
begin
  if length(d) <> 11 then return false; end if;
  if d !~ '^(20|23|24|25|26|27|30|33|34)' then return false; end if;
  for i in 1..10 loop s := s + substr(d, i, 1)::int * w[i]; end loop;
  r := 11 - (s % 11);
  v := case r when 11 then 0 when 10 then 9 else r end;
  return v = substr(d, 11, 1)::int;
end $$;

-- ---------------------------------------------------------------------
-- 2. Configuración del emisor
-- ---------------------------------------------------------------------
create table if not exists public.arca_config (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  ambiente    text not null check (ambiente in ('homologacion','produccion')),
  cuit        text not null check (cuit ~ '^[0-9]{11}$'),
  razon_social text not null check (length(razon_social) between 2 and 120),
  cond_iva    text not null check (cond_iva in ('RI','MONO','EXENTO')),
  pto_vta     int  not null check (pto_vta between 1 and 99999),
  alias       text not null check (alias ~ '^[A-Za-z0-9_-]{3,30}$'),
  alicuota    numeric(5,2) not null default 21 check (alicuota in (0,2.5,5,10.5,21,27)),
  activo      boolean not null default false,   -- apagado por defecto
  actualizado timestamptz not null default now(),
  actualizado_por uuid,
  primary key (comercio_id, ambiente)
);
alter table public.arca_config enable row level security;
drop policy if exists "el equipo ve la config de ARCA" on public.arca_config;
create policy "el equipo ve la config de ARCA" on public.arca_config for select to authenticated
  using (public.rol_en(comercio_id) in ('admin','supervisor','mostrador'));
revoke all on public.arca_config from anon;
revoke insert, update, delete, truncate on public.arca_config from authenticated;
grant select on public.arca_config to authenticated;

create or replace function public.arca_guardar_config(
  p_comercio uuid, p_ambiente text, p_cuit text, p_razon text, p_cond text,
  p_pto int, p_alias text, p_alicuota numeric default 21, p_activo boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_cuit text := regexp_replace(coalesce(p_cuit, ''), '\D', '', 'g');
begin
  if not public.es_admin(p_comercio) then
    raise exception 'sólo el administrador' using errcode = '42501';
  end if;
  if not public.rave_cuit_ok(v_cuit) then
    return jsonb_build_object('ok', false, 'error', 'El CUIT no es válido (revisá los 11 dígitos).');
  end if;
  if p_activo and not exists (select 1 from public.arca_credenciales
                               where comercio_id = p_comercio and ambiente = p_ambiente and cert is not null) then
    return jsonb_build_object('ok', false, 'error', 'Para activar la facturación primero hay que cargar el certificado de ARCA.');
  end if;
  insert into public.arca_config as t (comercio_id, ambiente, cuit, razon_social, cond_iva, pto_vta, alias, alicuota, activo, actualizado_por)
  values (p_comercio, p_ambiente, v_cuit, left(trim(p_razon), 120), p_cond, p_pto, p_alias, coalesce(p_alicuota, 21), coalesce(p_activo, false), auth.uid())
  on conflict (comercio_id, ambiente) do update
    set cuit = excluded.cuit, razon_social = excluded.razon_social, cond_iva = excluded.cond_iva,
        pto_vta = excluded.pto_vta, alias = excluded.alias, alicuota = excluded.alicuota,
        activo = excluded.activo, actualizado = now(), actualizado_por = auth.uid()
    where (t.cuit, t.pto_vta) is not distinct from (excluded.cuit, excluded.pto_vta)
       or not exists (select 1 from public.arca_comprobantes c
                       where c.comercio_id = t.comercio_id and c.ambiente = t.ambiente and c.estado = 'aprobado');
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ya hay comprobantes aprobados: no se puede cambiar el CUIT ni el punto de venta de este ambiente.');
  end if;
  return jsonb_build_object('ok', true);
exception when check_violation then
  return jsonb_build_object('ok', false, 'error', 'Datos inválidos: revisá alias (sin espacios), punto de venta y alícuota.');
end $$;
revoke all on function public.arca_guardar_config(uuid, text, text, text, text, int, text, numeric, boolean) from public, anon;
grant execute on function public.arca_guardar_config(uuid, text, text, text, text, int, text, numeric, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Credenciales (sin políticas: sólo el rol de servicio)
-- ---------------------------------------------------------------------
create table if not exists public.arca_credenciales (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  ambiente    text not null check (ambiente in ('homologacion','produccion')),
  key_enc     text,          -- clave privada RSA, cifrada AES-GCM con ARCA_MASTER_KEY (secreto de la función)
  csr         text,
  cert        text,          -- certificado .crt (público)
  cert_vence  timestamptz,
  ta_enc      text,          -- ticket de acceso WSAA (token+sign) cifrado
  ta_vence    timestamptz,
  actualizado timestamptz not null default now(),
  primary key (comercio_id, ambiente)
);
alter table public.arca_credenciales enable row level security;
revoke all on public.arca_credenciales from anon, authenticated;

-- Lo único que ve el equipo de las credenciales: si hay CSR/certificado y cuándo vence.
create or replace function public.arca_estado_credenciales(p_comercio uuid, p_ambiente text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when public.rol_en(p_comercio) in ('admin','supervisor','mostrador') then
    coalesce((select jsonb_build_object('tiene_clave', key_enc is not null, 'tiene_csr', csr is not null,
              'tiene_cert', cert is not null, 'cert_vence', cert_vence, 'csr', case when cert is null then csr end)
       from public.arca_credenciales where comercio_id = p_comercio and ambiente = p_ambiente),
       jsonb_build_object('tiene_clave', false, 'tiene_csr', false, 'tiene_cert', false))
  else null end;
$$;
revoke all on function public.arca_estado_credenciales(uuid, text) from public, anon;
grant execute on function public.arca_estado_credenciales(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Comprobantes
-- ---------------------------------------------------------------------
create table if not exists public.arca_comprobantes (
  id          uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  ambiente    text not null check (ambiente in ('homologacion','produccion')),
  venta_id    text not null check (length(venta_id) between 1 and 80),   -- id de la venta (o de la nota de crédito) en el sistema
  pto_vta     int  not null,
  tipo        int  not null check (tipo in (1,2,3,6,7,8,11,12,13)),      -- A/B/C: factura, ND, NC
  numero      bigint,
  estado      text not null default 'pendiente' check (estado in ('pendiente','enviando','aprobado','rechazado','error')),
  cae         text,
  cae_vto     date,
  fecha_cbte  date,
  imp_total   bigint,                  -- centavos
  imp_neto    bigint,
  imp_iva     bigint,
  receptor    jsonb,                   -- {docTipo, docNro, condIva, nombre}
  solicitud   jsonb,                   -- lo enviado a ARCA (sin credenciales)
  respuesta   jsonb,                   -- lo respondido (observaciones/errores)
  asociado    jsonb,                   -- CbtesAsoc para notas de crédito/débito
  intentos    int  not null default 0,
  lease_hasta timestamptz,
  proximo_intento timestamptz,
  error       text,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  creado_por  uuid,
  unique (comercio_id, ambiente, venta_id, tipo)
);
create index if not exists arca_cbte_estado on public.arca_comprobantes (comercio_id, estado, proximo_intento);
create unique index if not exists arca_cbte_numero on public.arca_comprobantes (comercio_id, ambiente, pto_vta, tipo, numero) where numero is not null and estado = 'aprobado';
alter table public.arca_comprobantes enable row level security;
drop policy if exists "el equipo ve los comprobantes ARCA" on public.arca_comprobantes;
create policy "el equipo ve los comprobantes ARCA" on public.arca_comprobantes for select to authenticated
  using (public.rol_en(comercio_id) in ('admin','supervisor','mostrador'));
revoke all on public.arca_comprobantes from anon;
revoke insert, update, delete, truncate on public.arca_comprobantes from authenticated;
grant select on public.arca_comprobantes to authenticated;

-- Con CAE el comprobante no se toca más (se corrige con nota de crédito/débito).
create or replace function public.arca_inmutable()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.estado = 'aprobado' then raise exception 'un comprobante con CAE no se borra'; end if;
    return old;
  end if;
  if old.estado = 'aprobado' then
    raise exception 'un comprobante con CAE es inmutable: se corrige con nota de crédito o débito';
  end if;
  return new;
end $$;
drop trigger if exists arca_comprobantes_inmutable on public.arca_comprobantes;
create trigger arca_comprobantes_inmutable before update or delete on public.arca_comprobantes
  for each row execute function public.arca_inmutable();

-- ---------------------------------------------------------------------
-- 5. Cerrojo de numeración + reserva idempotente (sólo rol de servicio)
-- ---------------------------------------------------------------------
create table if not exists public.arca_locks (
  comercio_id uuid not null,
  ambiente    text not null,
  pto_vta     int  not null,
  tipo        int  not null,
  token       uuid not null,
  hasta       timestamptz not null,
  primary key (comercio_id, ambiente, pto_vta, tipo)
);
alter table public.arca_locks enable row level security;
revoke all on public.arca_locks from anon, authenticated;

create or replace function public.arca_lock_tomar(p_comercio uuid, p_ambiente text, p_pto int, p_tipo int, p_segundos int default 90)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_t uuid := gen_random_uuid(); n int;
begin
  insert into public.arca_locks (comercio_id, ambiente, pto_vta, tipo, token, hasta)
  values (p_comercio, p_ambiente, p_pto, p_tipo, v_t, now() + make_interval(secs => p_segundos))
  on conflict (comercio_id, ambiente, pto_vta, tipo) do update
    set token = excluded.token, hasta = excluded.hasta
    where public.arca_locks.hasta < now();
  get diagnostics n = row_count;
  if n = 0 then return null; end if;
  return v_t;
end $$;
revoke all on function public.arca_lock_tomar(uuid, text, int, int, int) from public, anon, authenticated;

create or replace function public.arca_lock_soltar(p_comercio uuid, p_ambiente text, p_pto int, p_tipo int, p_token uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from public.arca_locks
   where comercio_id = p_comercio and ambiente = p_ambiente and pto_vta = p_pto and tipo = p_tipo and token = p_token;
$$;
revoke all on function public.arca_lock_soltar(uuid, text, int, int, uuid) from public, anon, authenticated;

-- Reserva: una sola solicitud en vuelo por documento. Devuelve la fila y si hay que trabajar.
--   accion = 'hecho'   → ya tiene CAE (devolver tal cual, NO volver a pedir)
--            'ocupado' → otra solicitud está en curso
--            'trabajar'→ este llamado debe pedir el CAE
create or replace function public.arca_reservar(
  p_comercio uuid, p_ambiente text, p_venta text, p_pto int, p_tipo int,
  p_receptor jsonb, p_importes jsonb, p_asociado jsonb, p_usuario uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare r public.arca_comprobantes;
begin
  insert into public.arca_comprobantes (comercio_id, ambiente, venta_id, pto_vta, tipo, receptor, asociado, creado_por,
                                        imp_total, imp_neto, imp_iva)
  values (p_comercio, p_ambiente, p_venta, p_pto, p_tipo, p_receptor, p_asociado, p_usuario,
          (p_importes->>'total')::bigint, (p_importes->>'neto')::bigint, (p_importes->>'iva')::bigint)
  on conflict (comercio_id, ambiente, venta_id, tipo) do nothing;
  select * into r from public.arca_comprobantes
   where comercio_id = p_comercio and ambiente = p_ambiente and venta_id = p_venta and tipo = p_tipo for update;
  if r.estado = 'aprobado' then
    return jsonb_build_object('accion', 'hecho', 'id', r.id);
  end if;
  if r.estado = 'enviando' and r.lease_hasta > now() then
    return jsonb_build_object('accion', 'ocupado', 'id', r.id);
  end if;
  update public.arca_comprobantes
     set estado = 'enviando', lease_hasta = now() + interval '120 seconds', intentos = intentos + 1,
         receptor = coalesce(p_receptor, receptor), asociado = coalesce(p_asociado, asociado),
         imp_total = coalesce((p_importes->>'total')::bigint, imp_total), imp_neto = coalesce((p_importes->>'neto')::bigint, imp_neto),
         imp_iva = coalesce((p_importes->>'iva')::bigint, imp_iva), actualizado = now()
   where id = r.id;
  return jsonb_build_object('accion', 'trabajar', 'id', r.id, 'intentos', r.intentos + 1);
end $$;
revoke all on function public.arca_reservar(uuid, text, text, int, int, jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;

-- Resultado: lo escribe sólo la función de servidor.
create or replace function public.arca_resultado(
  p_id uuid, p_estado text, p_numero bigint, p_cae text, p_cae_vto date, p_fecha date,
  p_solicitud jsonb, p_respuesta jsonb, p_error text, p_reintento_seg int default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_estado not in ('enviando','aprobado','rechazado','error','pendiente') then raise exception 'estado inválido'; end if;
  if p_estado = 'enviando' then
    -- sólo anota el número que se está por pedir (para poder recuperar el CAE si la respuesta se pierde)
    update public.arca_comprobantes set numero = p_numero, actualizado = now()
     where id = p_id and estado = 'enviando';
    return;
  end if;
  update public.arca_comprobantes
     set estado = p_estado, numero = coalesce(p_numero, numero), cae = coalesce(p_cae, cae),
         cae_vto = coalesce(p_cae_vto, cae_vto), fecha_cbte = coalesce(p_fecha, fecha_cbte),
         solicitud = coalesce(p_solicitud, solicitud), respuesta = p_respuesta, error = left(p_error, 500),
         lease_hasta = null, actualizado = now(),
         proximo_intento = case when p_reintento_seg is null then null else now() + make_interval(secs => p_reintento_seg) end
   where id = p_id;
end $$;
revoke all on function public.arca_resultado(uuid, text, bigint, text, date, date, jsonb, jsonb, text, int) from public, anon, authenticated;

-- Quién soy yo para este comercio (la Edge Function reenvía el JWT del usuario y así no hace falta decodificarlo).
create or replace function public.arca_quien(p_comercio uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('uid', auth.uid(), 'rol', public.rol_en(p_comercio));
$$;
revoke all on function public.arca_quien(uuid) from public, anon;
grant execute on function public.arca_quien(uuid) to authenticated;

-- El CAE llega a la venta por acá (sólo el rol de servicio): el navegador no puede escribir el campo "arca".
create or replace function public.arca_aplicar_venta(p_comercio uuid, p_venta text, p_clave text, p_arca jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if p_clave not in ('arca', 'arcaNC') then raise exception 'clave inválida'; end if;
  update public.registros
     set datos = jsonb_set(datos, array[p_clave], p_arca, true), actualizado = clock_timestamp()
   where comercio_id = p_comercio and coleccion = 'ventas' and id = p_venta;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.arca_aplicar_venta(uuid, text, text, jsonb) from public, anon, authenticated;
