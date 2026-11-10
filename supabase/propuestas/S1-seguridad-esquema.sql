-- =====================================================================================================================
-- S1 · SEGURIDAD INTEGRADA AL ERP · ESQUEMA PROPUESTO (V26.63)
-- ESTADO: PROPUESTA. NO está en INSTALAR-TODO.sql y NO se aplicó en ningún proyecto. Se probó sólo en un Postgres local
-- con el shim de Supabase (supabase/propuestas/S1-seguridad-tests.sql). La demo raveV3 no usa nube.
-- Aditivo e idempotente. Requiere 01–11 (comercios, miembros, rol_en, rave_tiene_permiso, rave_solo_agregar).
-- Reglas: dinero no aplica; hora e IP las pone el servidor; eventos sólo-agregar con cadena de hash; ninguna clave de
-- cámara, gateway o relé en estas tablas (sólo una referencia al secreto del servidor); biometría NO se guarda.
-- =====================================================================================================================

-- Dispositivos: cámaras, puertas (relés), timbres y gateways locales
create table if not exists public.seg_dispositivos (
  tenant_id   uuid not null references public.comercios(id) on delete cascade,
  id          text not null check (id ~ '^[a-z0-9_-]{1,40}$'),
  tipo        text not null check (tipo in ('camara','puerta','timbre','gateway')),
  nombre      text not null check (length(nombre) between 2 and 60),
  zona        text not null default '' check (length(zona) <= 40),
  sucursal    text not null default '' check (length(sucursal) <= 40),
  camara_id   text,                       -- puerta/timbre: cámara asociada
  gateway_url text check (gateway_url is null or gateway_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/'),
  secreto_ref text check (secreto_ref is null or secreto_ref ~ '^[A-Za-z0-9_:/.-]{3,120}$'), -- referencia al gestor de secretos; nunca la clave
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  primary key (tenant_id, id)
);

-- Reglas de acceso heredadas: grupo (personal activo, socios con membresía activa, pases) × puerta × horario
create table if not exists public.seg_reglas (
  tenant_id  uuid not null references public.comercios(id) on delete cascade,
  grupo      text not null check (grupo in ('emp','socio','visita')),
  puerta_id  text not null,
  hora_desde smallint not null check (hora_desde between 0 and 23),
  hora_hasta smallint not null check (hora_hasta between 1 and 24),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, grupo, puerta_id),
  foreign key (tenant_id, puerta_id) references public.seg_dispositivos(tenant_id, id) on delete cascade,
  check (hora_desde < hora_hasta)
);

-- Pases temporales de visitas y proveedores
create table if not exists public.seg_pases (
  tenant_id   uuid not null references public.comercios(id) on delete cascade,
  id          uuid not null default gen_random_uuid(),
  nombre      text not null check (length(nombre) between 2 and 60),
  motivo      text not null check (length(motivo) between 3 and 80),
  desde       timestamptz not null,
  hasta       timestamptz not null,
  max_usos    smallint not null default 1 check (max_usos between 1 and 20),
  usos        smallint not null default 0 check (usos >= 0),
  puertas     text[] not null check (cardinality(puertas) between 1 and 20),
  revocado_en timestamptz,
  revocado_por uuid,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  primary key (tenant_id, id),
  check (hasta > desde and hasta - desde <= interval '7 days'),
  check (usos <= max_usos)
);

-- Eventos de seguridad: sólo-agregar, hora del servidor, cadena de hash por comercio
create table if not exists public.seg_eventos (
  tenant_id  uuid not null references public.comercios(id) on delete cascade,
  id         uuid not null default gen_random_uuid(),
  ts         timestamptz not null default now(),
  tipo       text not null check (tipo in ('COACCION_PIN','PANICO','PUERTA_FORZADA','TIMBRE','MOVIMIENTO','ACCESO_OK','ACCESO_DENEGADO','PUERTA_ABIERTA','PASE_EMITIDO','PASE_REVOCADO','CONFIG')),
  nivel      text not null check (nivel in ('crit','alta','info')),
  silencioso boolean not null default false,
  real       boolean not null default true,
  puerta_id  text,
  camara_id  text,
  persona    text not null default '' check (length(persona) <= 80),
  detalle    text not null default '' check (length(detalle) <= 300),
  caja       text,
  sesion_id  text,
  venta_id   text,
  usuario_id uuid,
  ip         inet,
  hash_prev  text not null,
  hash       text not null,
  primary key (tenant_id, id),
  check (tipo not in ('COACCION_PIN','PANICO') or (silencioso and nivel = 'crit')),
  check (detalle !~ '[0-9]{13,19}')        -- nunca un número largo (podría ser una tarjeta)
);
create index if not exists seg_eventos_ts on public.seg_eventos (tenant_id, ts desc);

-- «Recibido» de una alerta: registro aparte (el evento no se modifica)
create table if not exists public.seg_recibidos (
  tenant_id  uuid not null,
  evento_id  uuid not null,
  ts         timestamptz not null default now(),
  usuario_id uuid not null default auth.uid(),
  primary key (tenant_id, evento_id),
  foreign key (tenant_id, evento_id) references public.seg_eventos(tenant_id, id) on delete cascade
);

-- PIN de coacción: sólo la huella; nadie la lee (ni el administrador): se compara en el servidor
create table if not exists public.seg_coaccion (
  tenant_id  uuid not null references public.comercios(id) on delete cascade,
  usuario_id uuid not null,
  huella     text not null check (huella ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, usuario_id)
);

-- sólo-agregar en eventos y recibidos
do $$ declare t text; begin
  foreach t in array array['seg_eventos','seg_recibidos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_solo_agregar', t);
    execute format('create trigger %I before update or delete on public.%I for each row execute function public.rave_solo_agregar()', t || '_solo_agregar', t);
  end loop; end $$;

-- cadena de hash y hora del servidor (el cliente no puede fijar ts, ip ni hash)
create or replace function public.seg_eventos_cadena() returns trigger language plpgsql security definer set search_path = public as $$
declare v_prev text;
begin
  perform pg_advisory_xact_lock(hashtext('seg_eventos:' || new.tenant_id::text));
  select hash into v_prev from public.seg_eventos where tenant_id = new.tenant_id order by ts desc, id desc limit 1;
  new.ts := clock_timestamp();
  new.hash_prev := coalesce(v_prev, 'GENESIS');
  new.hash := encode(sha256(convert_to(new.hash_prev || '|' || new.tenant_id || '|' || new.ts || '|' || new.tipo || '|' || new.nivel || '|' ||
              coalesce(new.puerta_id,'') || '|' || new.persona || '|' || new.detalle || '|' || coalesce(new.usuario_id::text,''), 'UTF8')), 'hex');
  return new;
end $$;
drop trigger if exists seg_eventos_cadena on public.seg_eventos;
create trigger seg_eventos_cadena before insert on public.seg_eventos for each row execute function public.seg_eventos_cadena();

-- Registrar un evento. Pánico y coacción: cualquier miembro del comercio. El resto: admin, supervisor o permiso sec_doors.
create or replace function public.seg_registrar_evento(p_comercio uuid, p_tipo text, p_nivel text, p_datos jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rol text := public.rol_en(p_comercio); v_id uuid; v_ip inet;
begin
  if v_rol is null then return jsonb_build_object('ok', false, 'error', 'no sos miembro de este comercio'); end if;
  if p_tipo not in ('COACCION_PIN','PANICO') and v_rol not in ('admin','supervisor') and not public.rave_tiene_permiso(p_comercio, auth.uid(), 'sec_doors') then
    return jsonb_build_object('ok', false, 'error', 'sin permiso para registrar eventos de seguridad'); end if;
  begin v_ip := nullif(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1), '')::inet; exception when others then v_ip := null; end;
  insert into public.seg_eventos(tenant_id, tipo, nivel, silencioso, real, puerta_id, camara_id, persona, detalle, caja, sesion_id, venta_id, usuario_id, ip, hash_prev, hash)
  values (p_comercio, p_tipo, case when p_tipo in ('COACCION_PIN','PANICO') then 'crit' else p_nivel end, p_tipo in ('COACCION_PIN','PANICO'),
          coalesce((p_datos ->> 'real')::boolean, true), p_datos ->> 'puerta', p_datos ->> 'camara', left(coalesce(p_datos ->> 'persona',''), 80),
          left(coalesce(p_datos ->> 'detalle',''), 300), p_datos ->> 'caja', p_datos ->> 'sesion', p_datos ->> 'venta', auth.uid(), v_ip, '', '')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Usar un pase: valida vigencia, revocación, puerta, horario de la regla y usos, de forma atómica
create or replace function public.seg_usar_pase(p_comercio uuid, p_pase uuid, p_puerta text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.seg_pases; r public.seg_reglas; h int := extract(hour from now() at time zone 'America/Argentina/Salta');
begin
  if public.rol_en(p_comercio) not in ('admin','supervisor') and not public.rave_tiene_permiso(p_comercio, auth.uid(), 'sec_doors') then
    return jsonb_build_object('ok', false, 'error', 'sin permiso'); end if;
  select * into p from public.seg_pases where tenant_id = p_comercio and id = p_pase for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'pase inexistente'); end if;
  if p.revocado_en is not null then return jsonb_build_object('ok', false, 'error', 'pase revocado'); end if;
  if now() < p.desde or now() > p.hasta then return jsonb_build_object('ok', false, 'error', 'pase fuera de vigencia'); end if;
  if not (p_puerta = any(p.puertas)) then return jsonb_build_object('ok', false, 'error', 'el pase no incluye esa puerta'); end if;
  select * into r from public.seg_reglas where tenant_id = p_comercio and grupo = 'visita' and puerta_id = p_puerta;
  if not found or h < r.hora_desde or h >= r.hora_hasta then return jsonb_build_object('ok', false, 'error', 'fuera del horario o sin regla para visitas'); end if;
  if p.usos >= p.max_usos then return jsonb_build_object('ok', false, 'error', 'el pase ya se usó'); end if;
  update public.seg_pases set usos = usos + 1 where tenant_id = p_comercio and id = p_pase;
  return jsonb_build_object('ok', true, 'nombre', p.nombre);
end $$;

-- Comparar un PIN de coacción sin exponer la huella
create or replace function public.seg_coaccion_coincide(p_comercio uuid, p_usuario uuid, p_huella text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.rol_en(p_comercio) is not null and exists (select 1 from public.seg_coaccion where tenant_id = p_comercio and usuario_id = p_usuario and huella = p_huella)
$$;

-- RLS
alter table public.seg_dispositivos enable row level security;
alter table public.seg_reglas       enable row level security;
alter table public.seg_pases        enable row level security;
alter table public.seg_eventos      enable row level security;
alter table public.seg_recibidos    enable row level security;
alter table public.seg_coaccion     enable row level security;   -- sin políticas de lectura: nadie la lee
revoke all on public.seg_dispositivos, public.seg_reglas, public.seg_pases, public.seg_eventos, public.seg_recibidos, public.seg_coaccion from anon;
revoke insert, update, delete, truncate on public.seg_eventos, public.seg_recibidos, public.seg_coaccion from authenticated;
revoke update (usos) on public.seg_pases from authenticated;
grant select on public.seg_dispositivos, public.seg_reglas, public.seg_pases, public.seg_eventos, public.seg_recibidos to authenticated;

drop policy if exists "seg_dispositivos: leen miembros" on public.seg_dispositivos;
create policy "seg_dispositivos: leen miembros" on public.seg_dispositivos for select to authenticated using (public.rol_en(tenant_id) is not null);
drop policy if exists "seg_reglas: leen miembros" on public.seg_reglas;
create policy "seg_reglas: leen miembros" on public.seg_reglas for select to authenticated using (public.rol_en(tenant_id) is not null);
drop policy if exists "seg_pases: leen quienes gestionan" on public.seg_pases;
create policy "seg_pases: leen quienes gestionan" on public.seg_pases for select to authenticated
  using (public.rol_en(tenant_id) in ('admin','supervisor') or public.rave_tiene_permiso(tenant_id, auth.uid(), 'sec_doors'));
drop policy if exists "seg_eventos: leen quienes vigilan" on public.seg_eventos;
create policy "seg_eventos: leen quienes vigilan" on public.seg_eventos for select to authenticated
  using (public.rol_en(tenant_id) in ('admin','supervisor') or public.rave_tiene_permiso(tenant_id, auth.uid(), 'sec_view'));
drop policy if exists "seg_recibidos: leen quienes vigilan" on public.seg_recibidos;
create policy "seg_recibidos: leen quienes vigilan" on public.seg_recibidos for select to authenticated
  using (public.rol_en(tenant_id) in ('admin','supervisor') or public.rave_tiene_permiso(tenant_id, auth.uid(), 'sec_view'));

revoke all on function public.seg_eventos_cadena() from public, anon, authenticated;
revoke all on function public.seg_registrar_evento(uuid, text, text, jsonb) from public, anon;
revoke all on function public.seg_usar_pase(uuid, uuid, text) from public, anon;
revoke all on function public.seg_coaccion_coincide(uuid, uuid, text) from public, anon;
grant execute on function public.seg_registrar_evento(uuid, text, text, jsonb), public.seg_usar_pase(uuid, uuid, text), public.seg_coaccion_coincide(uuid, uuid, text) to authenticated;

-- Altas y cambios: administración por el administrador; pases también por supervisor o permiso sec_doors
grant insert, update, delete on public.seg_dispositivos, public.seg_reglas to authenticated;
grant insert on public.seg_pases to authenticated;
grant update (revocado_en, revocado_por) on public.seg_pases to authenticated;
drop policy if exists "seg_dispositivos: administra el admin" on public.seg_dispositivos;
create policy "seg_dispositivos: administra el admin" on public.seg_dispositivos for all to authenticated
  using (public.rol_en(tenant_id) = 'admin') with check (public.rol_en(tenant_id) = 'admin');
drop policy if exists "seg_reglas: administra el admin" on public.seg_reglas;
create policy "seg_reglas: administra el admin" on public.seg_reglas for all to authenticated
  using (public.rol_en(tenant_id) = 'admin') with check (public.rol_en(tenant_id) = 'admin');
drop policy if exists "seg_pases: emiten quienes gestionan" on public.seg_pases;
create policy "seg_pases: emiten quienes gestionan" on public.seg_pases for insert to authenticated
  with check ((public.rol_en(tenant_id) in ('admin','supervisor') or public.rave_tiene_permiso(tenant_id, auth.uid(), 'sec_doors')) and usos = 0 and revocado_en is null);
drop policy if exists "seg_pases: revocan quienes gestionan" on public.seg_pases;
create policy "seg_pases: revocan quienes gestionan" on public.seg_pases for update to authenticated
  using (public.rol_en(tenant_id) in ('admin','supervisor') or public.rave_tiene_permiso(tenant_id, auth.uid(), 'sec_doors'))
  with check (revocado_en is not null);
