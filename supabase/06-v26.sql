-- =====================================================================
-- SISTEMA RAVE · 06 · V26: eliminación protegida de artículos, cajas/sucursales y traspasos
--
-- Correr DESPUÉS de 01..05 (se puede repetir: sólo "create or replace" y "if not exists").
-- Aditiva: no borra ni cambia datos. Reemplaza sincronizar() y rave_puede_escribir() por versiones
-- con las reglas nuevas (todo lo anterior sigue igual):
--   · Artículos: sólo el administrador elimina; un artículo con ventas/movimientos NO se borra
--     (se archiva); sólo el administrador archiva/restaura. Vista previa en inventario_vista_previa_borrado().
--   · Colecciones nuevas: sucs (sucursales), cajas (cajas operativas/principal), ctransf (traspasos entre cajas,
--     se escriben una vez; exigen perfil "main" o "branches", cajas existentes, importe entero > 0 y rubro válido).
-- =====================================================================

-- Referencias de un artículo (null = sin historial). Conservadora: cualquier mención cuenta.
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
  if array_length(v_lista, 1) is null then return null; end if;
  return array_to_string(v_lista, ', ');
end $$;
revoke all on function public.rave_prod_refs(uuid, text) from public, anon, authenticated;

-- Vista previa de una eliminación (sólo administrador). No cambia nada.
create or replace function public.inventario_vista_previa_borrado(p_comercio uuid, p_ids text[])
returns table (id text, nombre text, estado text, motivo text)
language plpgsql stable security definer set search_path = public as $$
declare v_id text; v_p public.registros; v_ref text;
begin
  if public.rol_en(p_comercio) is distinct from 'admin' then
    raise exception 'sólo el administrador' using errcode = '42501';
  end if;
  if p_ids is null or array_length(p_ids, 1) is null then return; end if;
  if array_length(p_ids, 1) > 500 then raise exception 'demasiados artículos (máximo 500)'; end if;
  foreach v_id in array p_ids loop
    select * into v_p from public.registros where comercio_id = p_comercio and coleccion = 'prod' and registros.id = v_id and not borrado;
    if not found then
      return query select v_id, '(no existe)'::text, 'inexistente'::text, 'No existe en el servidor.'::text;
    else
      v_ref := public.rave_prod_refs(p_comercio, v_id);
      return query select v_id, coalesce(v_p.datos ->> 'name', '?'),
                          case when v_ref is null then 'eliminable' else 'archivable' end,
                          case when v_ref is null then 'Sin historial.' else 'Tiene ' || v_ref || '.' end;
    end if;
  end loop;
end $$;
revoke all on function public.inventario_vista_previa_borrado(uuid, text[]) from public, anon;
grant execute on function public.inventario_vista_previa_borrado(uuid, text[]) to authenticated;

create or replace function public.rave_puede_escribir(p_rol text, p_col text, p_id text)
returns boolean language sql immutable as $$
  select case p_rol
    when 'admin' then true
    when 'supervisor' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                     'clientes','fiado','fich','pedidos','arrep','pya','membs',
                                     'prod','rubros','cierres','cnotas','cupones','planes','lotes','tareas','ctransf')
                           or (p_col = 'cfg' and p_id = 'cfg')
    when 'mostrador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                    'clientes','fiado','fich','pedidos','arrep','pya','membs')
    when 'operador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs')
    else false end
$$;

-- ---------------------------------------------------------------------
-- 3. SINCRONIZAR: la única puerta de escritura
--    Recibe  [{ "c": colección, "id": id, "d": {datos}, "x": true si se borró }]
--    Devuelve cuántos aplicó, cuáles rechazó y por qué, y la hora del servidor.
-- ---------------------------------------------------------------------
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
                                        'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf'];
  c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf'];
  c_borrables  constant text[] := array['prod','rubros','clientes','emp','puestos','tareas','cupones','planes','tlogs','pedidos'];
  c_cfg_ids    constant text[] := array['tenant','cfg','menu','loyalty','roles','integ','legal','clubkey'];
  c_secretos   constant text[] := array['arcaCert','arcaKey','arcaPem','accessToken','refreshToken','clientSecret','apiKey','serviceKey'];
  v_k          text;
  v_ref        text;
  v_perfil     text;
  v_aid        text;
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
      continue when (v_pasada = 1 and v_col = 'smov') or (v_pasada = 2 and v_col is distinct from 'smov');

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
        -- V26 · 4.14 · cajas y sucursales: sólo el administrador las define; los traspasos exigen el perfil habilitado
        if v_motivo is null and v_col = 'ctransf' then
          select datos ->> 'cashProfile' into v_perfil from public.registros
           where comercio_id = p_comercio and coleccion = 'cfg' and id = 'cfg' and not borrado;
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
          end if;
        end if;
        if v_motivo is null and v_col in ('cajas', 'sucs') and jsonb_typeof(v_datos -> 'name') is distinct from 'string' then
          v_motivo := 'falta el nombre';
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
        elsif v_col = 'prod' then
          -- el stock lo manda el servidor, nunca el navegador
          v_datos := v_datos - 'stock';
          v_datos := v_datos || jsonb_build_object('stock', case when v_hay then coalesce(v_prev.datos -> 'stock', '0'::jsonb) else '0'::jsonb end);
        elsif v_col = 'ventas' then
          -- el CAE lo escribe sólo el servidor fiscal: el navegador no lo puede pisar ni inventar
          v_datos := v_datos - 'arca' - 'arcaNC';
          if v_hay then
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

