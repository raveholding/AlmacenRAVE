-- ACTUALIZAR-20-22-23-26.sql · para un proyecto que ya tiene 01 a 19, 21, 24 y 25 (como AlmacenRAVE en producción).
-- Junta 20, 22 (Atención al cliente), 23 (RR. HH.) y 26 (reparto) en orden. Aditivo e idempotente: se puede correr más de una vez.

-- ===== 20-fidelizacion-operacion.sql =====
-- =====================================================================
-- SISTEMA RAVE · 20 · V26.54 · Fidelización ampliada y operación
--
-- Correr DESPUÉS de 01..19 (se puede repetir). Aditiva: no borra ni cambia datos.
-- Qué agrega:
--   · Colecciones nuevas:
--       fidmov  = libro del monedero digital (cargas, pagos, cashback, premios). Se escribe UNA vez.
--       giftmov = libro de cada gift card / voucher (emisión y canjes). Se escribe UNA vez.
--       juego   = jugadas de la ruleta / trivia con el premio que salió. Se escribe UNA vez.
--       devol   = devoluciones parciales de una venta. Se escribe UNA vez.
--       merma   = mermas, roturas, vencimientos y faltantes valorizados. Se escribe UNA vez.
--       gift    = cabecera de la gift card (código, titular, vencimiento, estado).
--       presup  = presupuestos (no mueven stock ni caja hasta convertirse en venta).
--     Los saldos (monedero, gift card) NO se guardan: se derivan sumando el libro.
--   · Ventas: dos medios de pago nuevos, 'monedero' y 'giftcard'.
--   · Validación de los libros: importe entero distinto de cero y tipo de movimiento conocido.
-- Cómo: modifica en el lugar las definiciones VIGENTES de public.sincronizar y public.rave_puede_escribir.
--   Si ya tienen 'fidmov', no hace nada.
-- =====================================================================
do $mig$
declare
  d text;
  o1 constant text := $o$'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf','acuer','cexc','cexcu','ctev','cdet','cortesx'];$o$;
  n1 constant text := $n$'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf','acuer','cexc','cexcu','ctev','cdet','cortesx','fidmov','giftmov','juego','devol','merma','gift','presup'];$n$;
  o2 constant text := $o$c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf','cexc','cexcu','ctev','cdet','cortesx'];$o$;
  n2 constant text := $n$c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf','cexc','cexcu','ctev','cdet','cortesx','fidmov','giftmov','juego','devol','merma'];$n$;
  o3 constant text := $o$        if v_motivo is null and v_col = 'ventas' and v_datos ? 'pays' then$o$;
  n3 constant text := $n$        -- V26.54 · 20 · libros del monedero y de las gift cards: importe entero distinto de cero y tipo conocido
        if v_motivo is null and v_col = 'fidmov' and not v_borrado then
          if jsonb_typeof(v_datos -> 'amount') <> 'number' or (v_datos ->> 'amount')::numeric <> trunc((v_datos ->> 'amount')::numeric)
             or (v_datos ->> 'amount')::numeric = 0 then
            v_motivo := 'monedero: el importe debe ser un entero distinto de cero';
          elsif coalesce(v_datos ->> 'kind', '') not in ('carga','pago','cashback','premio','ajuste','reverso','devolucion') then
            v_motivo := 'monedero: tipo de movimiento inválido';
          elsif coalesce(v_datos ->> 'cust', '') = '' then
            v_motivo := 'monedero: falta el cliente';
          end if;
        end if;
        if v_motivo is null and v_col = 'giftmov' and not v_borrado then
          if jsonb_typeof(v_datos -> 'amount') <> 'number' or (v_datos ->> 'amount')::numeric <> trunc((v_datos ->> 'amount')::numeric)
             or (v_datos ->> 'amount')::numeric = 0 then
            v_motivo := 'gift card: el importe debe ser un entero distinto de cero';
          elsif coalesce(v_datos ->> 'gift', '') = '' then
            v_motivo := 'gift card: falta la tarjeta';
          end if;
        end if;
        if v_motivo is null and v_col = 'ventas' and v_datos ? 'pays' then$n$;
  o5 constant text := $o$'qr','modo','pedidosya'])) then$o$;
  n5 constant text := $n$'qr','modo','pedidosya','monedero','giftcard'])) then$n$;
  o4 constant text := $o$'ventas','smov','turnos','movs','audit','cortesx'$o$;
  n4 constant text := $n$'ventas','smov','turnos','movs','audit','cortesx','fidmov','giftmov','juego','devol','merma','gift','presup'$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''fidmov''' in d) = 0 then
    if position(o1 in d) = 0 or position(o2 in d) = 0 or position(o3 in d) = 0 or position(o5 in d) = 0 then
      raise exception '20: no encontré las listas de sincronizar (¿faltan 01..19?)';
    end if;
    d := replace(replace(replace(replace(d, o1, n1), o2, n2), o3, n3), o5, n5);
    execute d;
  end if;
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''fidmov''' in d) = 0 then
    if position(o4 in d) = 0 then raise exception '20: no encontré las listas de rave_puede_escribir'; end if;
    d := replace(d, o4, n4);
    execute d;
  end if;
end
$mig$;

-- ===== 22-crm.sql =====
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

-- ===== 23-rrhh.sql =====
-- =====================================================================
-- SISTEMA VB · 23 · V26.64 · Recursos Humanos (Plan Micro / Plan Completo)
--
-- Correr DESPUÉS de 01..22 (se puede repetir). Aditiva: no borra ni cambia datos.
-- Qué agrega a la sincronización (colecciones del equipo, como todo lo demás):
--   hrshift = turnos por persona y día          (se pueden borrar)
--   hrreq   = licencias, vacaciones y justificantes con su circuito de aprobación
--   hrdoc   = DESCRIPCIÓN de los documentos del legajo (el archivo NO viaja: queda en el equipo y en el respaldo)
--   hrpay   = liquidaciones internas cerradas (foto del período)
--   hrjob / hrcand = vacantes y candidatos (datos personales del candidato van cifrados, __pii)
--   hritem  = entregas de uniformes y herramientas
--   hrmsg   = avisos al personal               (se escriben UNA vez)
--   hrplan  = cambios de plan Micro ↔ Completo (se escriben UNA vez; sirven para facturar)
-- Quién escribe: administrador todo; supervisor turnos, solicitudes (aprobaciones) y avisos; mostrador y operador nada de esto
-- (las fichadas siguen en 'fich', que ya escriben).
-- No crea el rol «empleado» en el servidor: el portal del empleado con cuentas propias en la nube es una etapa futura.
-- =====================================================================
do $mig$
declare
  d text;
  o1 constant text := $o$'gift','presup','conv','cmsg'];$o$;
  n1 constant text := $n$'gift','presup','conv','cmsg','hrshift','hrreq','hrdoc','hrpay','hrjob','hrcand','hritem','hrmsg','hrplan'];$n$;
  o2 constant text := $o$'devol','merma','cmsg'];$o$;
  n2 constant text := $n$'devol','merma','cmsg','hrmsg','hrplan'];$n$;
  o3 constant text := $o$'tlogs','pedidos','acuer'];$o$;
  n3 constant text := $n$'tlogs','pedidos','acuer','hrshift','hrdoc','hrjob','hrcand'];$n$;
  o4 constant text := $o$'acuer','cexc','cexcu','ctev','cdet')$o$;
  n4 constant text := $n$'acuer','cexc','cexcu','ctev','cdet','hrshift','hrreq','hrmsg')$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''hrplan''' in d) = 0 then
    if position(o1 in d) = 0 or position(o2 in d) = 0 or position(o3 in d) = 0 then
      raise exception '23: no encontré las listas de sincronizar (¿falta correr 22?)';
    end if;
    d := replace(replace(replace(d, o1, n1), o2, n2), o3, n3);
    execute d;
  end if;
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''hrreq''' in d) = 0 then
    if position(o4 in d) = 0 then raise exception '23: no encontré la lista del supervisor en rave_puede_escribir (¿falta correr 22?)'; end if;
    d := replace(d, o4, n4);
    execute d;
  end if;
end
$mig$;

-- ===== 26-reparto.sql =====
-- =====================================================================
-- 26 · V26.69 · Reparto y despacho omnicanal + app del cliente (seguimiento del pedido)
-- Correr DESPUÉS de 01 a 25. Aditivo e idempotente (se puede repetir). No borra ni cambia datos.
--
-- Qué agrega:
--  1) Rol de equipo «repartidor» (invitaciones y cambio de rol). El repartidor sólo puede escribir sus envíos,
--     sus hojas de ruta, la auditoría y sus fichadas. No ve ni toca ventas, caja, clientes ni configuración.
--  2) Colecciones nuevas de la sincronización (igual que todo lo demás, por documento → reintentar no duplica):
--       envio   = pedidos con entrega a domicilio (datos del cliente y de la entrega van CIFRADOS, __pii)
--       ruta    = hojas de ruta (repartidor, orden de paradas, cambio inicial, estado, lo que declaró al rendir)
--       rendrep = rendiciones de reparto en caja (se escriben UNA vez)
--     Escriben: administrador todo; supervisor y mostrador envio, ruta y rendrep; operador envio; repartidor envio y ruta.
--  3) Pedidos con envío desde el menú digital (canal digital): el celular del cliente los manda CIFRADOS con la llave
--     pública del comercio (el servidor no puede leer nombre, teléfono ni domicilio). El sistema los descifra y los suma
--     a la bandeja de despacho. Límites por IP y por comercio; sólo si el comercio publicó el reparto en el menú.
--  4) Seguimiento del pedido para el cliente: el sistema publica SOLO el estado (recibido, en camino, entregado…),
--     la demora estimada y el nombre de pila del repartidor, con una referencia secreta que tiene el celular del cliente.
--     Sin datos personales. Se borra solo a los 30 días.
-- =====================================================================

-- ---------- 1) rol «repartidor» ----------
do $mig$
declare r record; d text;
begin
  for r in select conrelid::regclass as t, conname from pg_constraint
            where conrelid in ('public.miembros'::regclass, 'public.invitaciones'::regclass)
              and contype = 'c' and pg_get_constraintdef(oid) like '%operador%' and pg_get_constraintdef(oid) not like '%repartidor%'
  loop
    execute format('alter table %s drop constraint %I', r.t, r.conname);
    execute format('alter table %s add constraint %I check (rol in (''admin'', ''supervisor'', ''mostrador'', ''operador'', ''repartidor''))', r.t, r.conname);
  end loop;
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('invitar_miembro', 'cambiar_rol')
  loop
    d := pg_get_functiondef(r.oid);
    if position('''repartidor''' in d) = 0 then
      if position('p_rol not in (''admin'', ''supervisor'', ''mostrador'', ''operador'')' in d) = 0 then
        raise exception '26: no encontré la lista de roles en %', r.oid::regprocedure;
      end if;
      execute replace(d, 'p_rol not in (''admin'', ''supervisor'', ''mostrador'', ''operador'')',
                         'p_rol not in (''admin'', ''supervisor'', ''mostrador'', ''operador'', ''repartidor'')');
    end if;
  end loop;
end
$mig$;

-- ---------- 2) sincronización: colecciones y permisos ----------
do $mig$
declare
  d text;
  o1 constant text := $o$'hrmsg','hrplan'];$o$;
  n1 constant text := $n$'hrmsg','hrplan','envio','ruta','rendrep'];$n$;
  o2 constant text := $o$'cmsg','hrmsg','hrplan'];$o$;
  n2 constant text := $n$'cmsg','hrmsg','hrplan','rendrep'];$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''rendrep''' in d) = 0 then
    if position($x$c_todas      constant text[] := array[$x$ in d) = 0 or position(o1 in d) = 0 or position(o2 in d) = 0 then
      raise exception '26: no encontré las listas de sincronizar (¿falta correr 23?)';
    end if;
    -- la lista de «todas» termina en 'hrmsg','hrplan']; y la de «una vez» en 'cmsg','hrmsg','hrplan'];
    d := replace(d, o2, n2);                    -- primero la de «una vez» (es la más específica)
    d := regexp_replace(d, '(c_todas\s+constant text\[\] := array\[[^;]*)''hrmsg'',''hrplan''\];', '\1' || n1);
    execute d;
  end if;

  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''repartidor''' in d) = 0 then
    if position($x$'hrshift','hrreq','hrmsg')$x$ in d) = 0 or position($x$'cexcu','ctransf','ctev','cdet')
    when 'operador'$x$ in d) = 0 or position($x$'tlogs','cexcu','ctransf','ctev','cdet')
    else false end$x$ in d) = 0 then
      raise exception '26: no encontré las listas de rave_puede_escribir (¿falta correr 23?)';
    end if;
    d := replace(d, $x$'hrshift','hrreq','hrmsg')$x$, $x$'hrshift','hrreq','hrmsg','envio','ruta','rendrep')$x$);
    d := replace(d, $x$'cexcu','ctransf','ctev','cdet')
    when 'operador'$x$, $x$'cexcu','ctransf','ctev','cdet','envio','ruta','rendrep')
    when 'operador'$x$);
    d := replace(d, $x$'tlogs','cexcu','ctransf','ctev','cdet')
    else false end$x$, $x$'tlogs','cexcu','ctransf','ctev','cdet','envio')
    when 'repartidor' then p_col in ('envio','ruta','audit','fich')
    else false end$x$);
    execute d;
  end if;
end
$mig$;

-- ---------- 3) pedidos con envío desde el menú (cifrados) ----------
create table if not exists public.reparto_web (
  id          bigint generated always as identity primary key,
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  ref         text not null unique check (ref ~ '^[A-Za-z0-9_-]{16,40}$'),
  cifrado     jsonb not null,
  ip          text,
  creado      timestamptz not null default now(),
  estado      text not null default 'nuevo' check (estado in ('nuevo','importado','rechazado'))
);
create index if not exists reparto_web_estado on public.reparto_web (comercio_id, estado, id);
alter table public.reparto_web enable row level security;
drop policy if exists "el equipo ve los pedidos del menú" on public.reparto_web;
create policy "el equipo ve los pedidos del menú" on public.reparto_web for select to authenticated
  using (public.rol_en(comercio_id) in ('admin','supervisor','mostrador'));
revoke all on public.reparto_web from anon;
revoke insert, update, delete, truncate on public.reparto_web from authenticated;
grant select on public.reparto_web to authenticated;

create or replace function public.reparto_pedir(p_slug text, p_ref text, p_cifrado jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_c uuid; v_ip text := public.rave_ip();
begin
  select c.id into v_c from public.comercios c join public.menus m on m.comercio_id = c.id
   where c.slug = lower(left(coalesce(p_slug,''),40))
     and coalesce((m.contenido #>> '{site,rep,on}')::boolean, false);
  if v_c is null then return jsonb_build_object('ok', false, 'error', 'el envío a domicilio no está disponible'); end if;
  if coalesce(p_ref,'') !~ '^[A-Za-z0-9_-]{16,40}$'
     or jsonb_typeof(p_cifrado) <> 'object' or not (p_cifrado ? 'k' and p_cifrado ? 'iv' and p_cifrado ? 'ct')
     or pg_column_size(p_cifrado) > 12000 then
    return jsonb_build_object('ok', false, 'error', 'datos inválidos');
  end if;
  if v_ip <> '' and (select count(*) from public.reparto_web where ip = v_ip and creado > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'demasiados pedidos desde tu conexión, probá en un rato o escribinos por WhatsApp');
  end if;
  if (select count(*) from public.reparto_web where comercio_id = v_c and creado > now() - interval '1 hour') >= 300 then
    return jsonb_build_object('ok', false, 'error', 'hay muchos pedidos en este momento, escribinos por WhatsApp');
  end if;
  insert into public.reparto_web (comercio_id, ref, cifrado, ip) values (v_c, p_ref, p_cifrado, nullif(v_ip,''))
  on conflict (ref) do nothing;
  insert into public.reparto_seguimiento (comercio_id, ref, estado) values (v_c, p_ref, 'recibido')
  on conflict (comercio_id, ref) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.reparto_web_marcar(p_comercio uuid, p_ids bigint[], p_estado text)
returns int language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin','supervisor','mostrador') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_estado not in ('importado','rechazado') then raise exception 'estado inválido' using errcode = '22023'; end if;
  update public.reparto_web set estado = p_estado where comercio_id = p_comercio and id = any(p_ids) and estado = 'nuevo';
  get diagnostics n = row_count;
  delete from public.reparto_web where comercio_id = p_comercio and estado <> 'nuevo' and creado < now() - interval '30 days';
  return n;
end $$;

-- ---------- 4) seguimiento del pedido (sin datos personales) ----------
create table if not exists public.reparto_seguimiento (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  ref         text not null check (ref ~ '^[A-Za-z0-9_-]{16,40}$'),
  estado      text not null default 'recibido'
              check (estado in ('recibido','confirmado','preparando','listo','en_camino','entregado','ausente','cancelado')),
  eta         text check (eta is null or length(eta) <= 40),
  rep         text check (rep is null or length(rep) <= 30),
  nota        text check (nota is null or length(nota) <= 120),
  actualizado timestamptz not null default now(),
  primary key (comercio_id, ref)
);
alter table public.reparto_seguimiento enable row level security;
revoke all on public.reparto_seguimiento from anon, authenticated;

create or replace function public.reparto_estado_poner(p_comercio uuid, p_ref text, p_estado text, p_eta text, p_rep text, p_nota text)
returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(public.rol_en(p_comercio), '') not in ('admin','supervisor','mostrador','operador','repartidor') then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if coalesce(p_ref,'') !~ '^[A-Za-z0-9_-]{16,40}$' then raise exception 'referencia inválida' using errcode = '22023'; end if;
  if p_estado not in ('recibido','confirmado','preparando','listo','en_camino','entregado','ausente','cancelado') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  insert into public.reparto_seguimiento (comercio_id, ref, estado, eta, rep, nota, actualizado)
       values (p_comercio, p_ref, p_estado, left(p_eta,40), left(p_rep,30), left(p_nota,120), now())
  on conflict (comercio_id, ref) do update
       set estado = excluded.estado, eta = excluded.eta, rep = excluded.rep, nota = excluded.nota, actualizado = now();
  delete from public.reparto_seguimiento where comercio_id = p_comercio and actualizado < now() - interval '30 days';
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.reparto_estado_ver(p_slug text, p_refs text[])
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_c uuid;
begin
  select id into v_c from public.comercios where slug = lower(left(coalesce(p_slug,''),40));
  if v_c is null or p_refs is null or cardinality(p_refs) = 0 or cardinality(p_refs) > 10 then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'pedidos', coalesce((
    select jsonb_agg(jsonb_build_object('ref', ref, 'estado', estado, 'eta', eta, 'rep', rep, 'nota', nota, 'ts', extract(epoch from actualizado)::bigint))
      from public.reparto_seguimiento
     where comercio_id = v_c and ref = any(p_refs) and ref ~ '^[A-Za-z0-9_-]{16,40}$'), '[]'::jsonb));
end $$;

revoke all on function public.reparto_pedir(text, text, jsonb) from public;
grant execute on function public.reparto_pedir(text, text, jsonb) to anon, authenticated;
revoke all on function public.reparto_web_marcar(uuid, bigint[], text) from public, anon;
grant execute on function public.reparto_web_marcar(uuid, bigint[], text) to authenticated;
revoke all on function public.reparto_estado_poner(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.reparto_estado_poner(uuid, text, text, text, text, text) to authenticated;
revoke all on function public.reparto_estado_ver(text, text[]) from public;
grant execute on function public.reparto_estado_ver(text, text[]) to anon, authenticated;

