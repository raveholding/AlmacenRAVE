-- =====================================================================
-- 12 · V26.12 · Pago a proveedor repartido entre varias cajas (caja principal + operativas)
-- Aditivo e idempotente. Un solo evento de negocio (el Pago del libro) con asignaciones por caja que suman EXACTAMENTE el pago;
-- cada asignación crea su egreso de caja con el mismo rubro. Todo o nada. Sin `asignaciones` el comportamiento es el de siempre.
-- =====================================================================
create table if not exists public.pagos_proveedor_asignaciones (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.comercios(id) on delete restrict,
  pago_id            uuid not null references public.cuenta_corriente_proveedores(id) on delete restrict,
  proveedor_id       uuid not null references public.proveedores(id) on delete restrict,
  turno_id           text not null,
  monto              numeric(14,2) not null check (monto > 0),
  movimiento_caja_id text not null,
  created_at         timestamptz not null default now(),
  created_by         uuid
);
create index if not exists pagos_asig_pago on public.pagos_proveedor_asignaciones (tenant_id, pago_id);
alter table public.pagos_proveedor_asignaciones enable row level security;
drop policy if exists pagos_asig_leer on public.pagos_proveedor_asignaciones;
create policy pagos_asig_leer on public.pagos_proveedor_asignaciones for select to authenticated using (public.rol_en(tenant_id) in ('admin', 'supervisor'));
revoke all on public.pagos_proveedor_asignaciones from anon, authenticated;
grant select on public.pagos_proveedor_asignaciones to authenticated;
drop trigger if exists pagos_asig_solo_agregar on public.pagos_proveedor_asignaciones;
create trigger pagos_asig_solo_agregar before update or delete on public.pagos_proveedor_asignaciones for each row execute function public.rave_solo_agregar();

create or replace function public.proveedor_pago_registrar(p_comercio uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prov public.proveedores; v_key text; v_monto numeric; v_medio text; v_rubro text; v_turno text; v_ref text; v_saldo numeric(14,2); v_mov text; v_ex public.cuenta_corriente_proveedores; v_id uuid; v_asig jsonb; v_a jsonb; v_suma bigint := 0; v_cen bigint; v_movs jsonb := '[]'::jsonb; v_m text; v_tid text; v_vistos text[] := array[]::text[];
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
  v_asig := p -> 'asignaciones';
  if v_asig is not null and jsonb_typeof(v_asig) <> 'null' then
    -- V26.12 · pago repartido entre varias cajas (p. ej. desde la caja principal y otras operativas): UN solo evento de negocio
    if v_medio <> 'efectivo' then raise exception 'el reparto entre cajas sólo corresponde a pagos en efectivo'; end if;
    if jsonb_typeof(v_asig) <> 'array' or jsonb_array_length(v_asig) not between 1 and 20 then raise exception 'asignaciones inválidas (1 a 20 cajas)'; end if;
    for v_a in select * from jsonb_array_elements(v_asig) loop
      v_tid := public.rave_txt(v_a, 'turno_id');
      v_cen := round(public.rave_num(v_a, 'monto') * 100)::bigint;
      if v_tid is null or v_cen is null or v_cen <= 0 or public.rave_num(v_a, 'monto') <> round(public.rave_num(v_a, 'monto'), 2) then raise exception 'cada caja del reparto necesita turno e importe mayor a cero'; end if;
      if v_tid = any(v_vistos) then raise exception 'una misma caja no puede repetirse en el reparto'; end if;
      v_vistos := v_vistos || v_tid; v_suma := v_suma + v_cen;
    end loop;
    if v_suma <> round(v_monto * 100)::bigint then raise exception 'el reparto entre cajas (%) no suma el pago (%)', v_suma / 100.0, v_monto; end if;
    for v_a in select * from jsonb_array_elements(v_asig) loop
      v_m := public.rave_mov_caja(p_comercio, public.rave_txt(v_a, 'turno_id'), v_rubro, 'Pago a proveedor ' || v_prov.razon_social || coalesce(' · ' || v_ref, ''),
                                  round(public.rave_num(v_a, 'monto') * 100)::bigint, 'pago');
      v_movs := v_movs || jsonb_build_object('turno_id', public.rave_txt(v_a, 'turno_id'), 'monto', public.rave_num(v_a, 'monto'), 'movimiento_caja_id', v_m);
    end loop;
  elsif v_medio = 'efectivo' then
    v_mov := public.rave_mov_caja(p_comercio, v_turno, v_rubro, 'Pago a proveedor ' || v_prov.razon_social || coalesce(' · ' || v_ref, ''), round(v_monto * 100)::bigint, 'pago');
  end if;
  v_saldo := round(v_prov.saldo_cuenta_corriente - v_monto, 2);
  insert into public.cuenta_corriente_proveedores (tenant_id, proveedor_id, tipo_movimiento, monto, saldo_acumulado, referencia, medio_pago, rubro_id, movimiento_caja_id, idempotency_key, created_by)
  values (p_comercio, v_prov.id, 'Pago', v_monto, v_saldo, v_ref, v_medio, v_rubro, v_mov, v_key, auth.uid()) returning id into v_id;
  update public.proveedores set saldo_cuenta_corriente = v_saldo, updated_at = now() where id = v_prov.id;
  if jsonb_array_length(v_movs) > 0 then
    insert into public.pagos_proveedor_asignaciones (tenant_id, pago_id, proveedor_id, turno_id, monto, movimiento_caja_id, created_by)
    select p_comercio, v_id, v_prov.id, x ->> 'turno_id', (x ->> 'monto')::numeric(14,2), x ->> 'movimiento_caja_id', auth.uid() from jsonb_array_elements(v_movs) x;
  end if;
  perform public.rave_auditar(p_comercio, 'PROVEEDOR_PAGO', v_prov.razon_social || ' · ' || v_monto || ' · ' || v_medio || case when jsonb_array_length(v_movs) > 0 then ' · repartido en ' || jsonb_array_length(v_movs) || ' cajas' else '' end);
  return jsonb_build_object('ok', true, 'repetido', false, 'movimiento_id', v_id, 'monto', v_monto, 'saldo_proveedor', v_saldo, 'movimiento_caja_id', v_mov, 'asignaciones', v_movs);
exception when unique_violation then
  select * into v_ex from public.cuenta_corriente_proveedores where tenant_id = p_comercio and idempotency_key = v_key;
  if found then return jsonb_build_object('ok', true, 'repetido', true, 'movimiento_id', v_ex.id, 'monto', v_ex.monto); end if;
  raise;
end $$;


revoke all on function public.proveedor_pago_registrar(uuid, jsonb) from public, anon;
grant execute on function public.proveedor_pago_registrar(uuid, jsonb) to authenticated;
