-- =====================================================================
-- SISTEMA RAVE · 10 · V26.4 · 4.22 · Mayorista / minorista: listas de precio, acuerdos y crédito con plazo
--
-- Correr DESPUÉS de 01..09 (se puede repetir: sólo "create or replace"). Aditiva: no borra ni cambia datos.
-- Qué agrega:
--   · Colecciones nuevas en sincronizar(): `acuer` (acuerdos especiales por cliente; el administrador y el
--     supervisor los escriben, se desactivan pero no se borran del historial de ventas), `cexc` (excepciones de
--     crédito: se escriben UNA vez, con cliente, monto entero, vigencia y motivo de 5+ letras) y `cexcu`
--     (consumo de una excepción: se escribe una vez; cualquier rol de caja puede registrarlo al vender).
--   · Ventas: `wch` (canal) sólo vale minorista|mayorista; una venta mayorista exige un cliente que exista.
--     Una venta a cuenta corriente que supera el límite (o de un cliente sin límite) NO se rechaza —el equipo trabaja
--     sin conexión y ya la hizo—: se marca `credit_review`/`crw` (sólo el servidor puede escribirlos) salvo que traiga
--     una excepción válida (`cov`) del mismo cliente por un monto suficiente.
--   · rave_deuda_cliente(): saldo adeudado calculado desde ventas y cobros (no se guarda aparte).
-- Límites declarados: el servidor NO recalcula precios de lista/escalón (sólo la estructura, el canal y el crédito);
--   el CUIT del cliente viaja cifrado y no se puede validar del lado del servidor; el vencimiento por plazo
--   (documentos vencidos) lo bloquea el equipo con sus datos, el servidor sólo revisa límite y excepción.
-- =====================================================================

create or replace function public.rave_deuda_cliente(p_comercio uuid, p_cliente text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select sum(case when r.datos ? 'pays'
                                   then coalesce((select sum((p ->> 'a')::numeric) from jsonb_array_elements(r.datos -> 'pays') p where p ->> 'm' = 'fiado'), 0)
                                   else coalesce((r.datos ->> 'total')::numeric, 0) end)
                     from public.registros r
                    where r.comercio_id = p_comercio and r.coleccion = 'ventas' and not r.borrado
                      and r.datos ->> 'cust' = p_cliente and coalesce((r.datos ->> 'fiado')::boolean, false)
                      and r.datos ->> 'status' = 'ok'), 0)
       - coalesce((select sum((r.datos ->> 'amount')::numeric) from public.registros r
                    where r.comercio_id = p_comercio and r.coleccion = 'fiado' and not r.borrado and r.datos ->> 'cust' = p_cliente), 0);
$$;
revoke all on function public.rave_deuda_cliente(uuid, text) from public, anon, authenticated;

create or replace function public.rave_puede_escribir(p_rol text, p_col text, p_id text)
returns boolean language sql immutable as $$
  select case p_rol
    when 'admin' then true
    when 'supervisor' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                     'clientes','fiado','fich','pedidos','arrep','pya','membs',
                                     'prod','rubros','cierres','cnotas','cupones','planes','lotes','tareas','ctransf',
                                     'acuer','cexc','cexcu')
                           or (p_col = 'cfg' and p_id = 'cfg')
    when 'mostrador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                    'clientes','fiado','fich','pedidos','arrep','pya','membs','cexcu')
    when 'operador' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs','cexcu')
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
                                        'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf','acuer','cexc','cexcu'];
  c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf','cexc','cexcu'];
  c_borrables  constant text[] := array['prod','rubros','clientes','emp','puestos','tareas','cupones','planes','tlogs','pedidos','acuer'];
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
