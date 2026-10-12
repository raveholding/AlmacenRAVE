-- =====================================================================
-- SISTEMA RAVE · 02 · Sincronización entre equipos
--
-- Correr DESPUÉS de 01-base.sql (mismo procedimiento; se puede repetir).
--
-- Cómo funciona:
--   · Cada registro del sistema (un producto, una venta, un cliente…) es una
--     fila de "registros". Se LEE con bajar() y se ESCRIBE sólo con
--     sincronizar(): nadie escribe directo en la tabla.
--   · El servidor aplica las reglas: qué rol puede tocar qué, qué se escribe
--     una sola vez, qué no se puede borrar, y el STOCK: el navegador no manda
--     el stock, manda movimientos y el servidor los suma. Si dos cajas venden
--     la misma botella al mismo tiempo, las dos restan y el total cierra.
--   · Los datos personales llegan ya cifrados desde el navegador: el
--     servidor no los puede leer.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Registros
-- ---------------------------------------------------------------------
create table if not exists public.registros (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  coleccion   text not null check (coleccion ~ '^[a-zA-Z]{2,24}$'),
  id          text not null check (length(id) between 1 and 80),
  datos       jsonb not null default '{}'::jsonb,
  borrado     boolean not null default false,
  dispositivo text,
  usuario_id  uuid references auth.users(id) on delete set null,
  actualizado timestamptz not null default clock_timestamp(),
  primary key (comercio_id, coleccion, id)
);
create index if not exists registros_cursor on public.registros (comercio_id, actualizado);

alter table public.registros enable row level security;
drop policy if exists "leer registros de mi comercio" on public.registros;
create policy "leer registros de mi comercio" on public.registros for select to authenticated
  using (comercio_id in (select public.mis_comercios()));

revoke all on public.registros from anon;
revoke insert, update, delete, truncate on public.registros from authenticated;
grant select on public.registros to authenticated;

-- ---------------------------------------------------------------------
-- 2. Quién puede escribir qué (piso de seguridad en el servidor)
--    La interfaz puede ser más estricta, nunca más permisiva.
-- ---------------------------------------------------------------------
create or replace function public.rave_puede_escribir(p_rol text, p_col text, p_id text)
returns boolean language sql immutable as $$
  select case p_rol
    when 'admin' then true
    when 'supervisor' then p_col in ('ventas','smov','turnos','movs','audit','sellos','otp','cusos','tlogs',
                                     'clientes','fiado','fich','pedidos','arrep','pya','membs',
                                     'prod','rubros','cierres','cnotas','cupones','planes','lotes','tareas')
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
                                        'sellos','otp','pedidos','arrep','pya','lotes','cfg'];
  c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado'];
  c_borrables  constant text[] := array['prod','rubros','clientes','emp','puestos','tareas','cupones','planes','tlogs','pedidos'];
  c_cfg_ids    constant text[] := array['tenant','cfg','menu','loyalty','roles','integ','legal','clubkey'];
  c_secretos   constant text[] := array['arcaCert','arcaKey','arcaPem','accessToken','refreshToken','clientSecret','apiKey','serviceKey'];
  v_k          text;
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

-- ---------------------------------------------------------------------
-- 4. BAJAR: lo que cambió desde un momento dado (el cliente resta 30 s por las dudas)
-- ---------------------------------------------------------------------
create or replace function public.bajar(p_comercio uuid, p_desde timestamptz default null, p_limite int default 500)
returns table (coleccion text, id text, datos jsonb, borrado boolean, actualizado text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.rol_en(p_comercio) is null then
    raise exception 'no sos miembro de este comercio' using errcode = '42501';
  end if;
  return query
    select r.coleccion, r.id, r.datos, r.borrado,
           to_char(r.actualizado at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      from public.registros r
     where r.comercio_id = p_comercio
       and (p_desde is null or r.actualizado >= p_desde)
     order by r.actualizado, r.coleccion, r.id
     limit least(greatest(coalesce(p_limite, 500), 1), 1000);
end $$;
revoke all on function public.bajar(uuid, timestamptz, int) from public, anon;
grant execute on function public.bajar(uuid, timestamptz, int) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Llaves de cifrado (la llave real de los datos va envuelta; el servidor no la puede abrir)
-- ---------------------------------------------------------------------
create table if not exists public.llaves (
  comercio_id uuid not null references public.comercios(id) on delete cascade,
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  kdf         jsonb not null,
  wrap        jsonb not null,
  temporal    boolean not null default false,
  actualizado timestamptz not null default now(),
  primary key (comercio_id, usuario_id)
);
alter table public.llaves enable row level security;
drop policy if exists "mi llave" on public.llaves;
create policy "mi llave" on public.llaves for select to authenticated using (usuario_id = auth.uid());
drop policy if exists "guardar mi llave" on public.llaves;
create policy "guardar mi llave" on public.llaves for insert to authenticated
  with check (usuario_id = auth.uid() and comercio_id in (select public.mis_comercios()));
drop policy if exists "actualizar mi llave" on public.llaves;
create policy "actualizar mi llave" on public.llaves for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid() and comercio_id in (select public.mis_comercios()));
revoke all on public.llaves from anon;
revoke delete, truncate on public.llaves from authenticated;
grant select, insert, update on public.llaves to authenticated;

-- Llave envuelta con el código de recuperación (la ve y la cambia sólo el administrador)
create table if not exists public.llaves_recuperacion (
  comercio_id uuid primary key references public.comercios(id) on delete cascade,
  kdf         jsonb not null,
  wrap        jsonb not null,
  creado      timestamptz not null default now()
);
alter table public.llaves_recuperacion enable row level security;
drop policy if exists "admin lee la llave de recuperación" on public.llaves_recuperacion;
create policy "admin lee la llave de recuperación" on public.llaves_recuperacion for select to authenticated
  using (public.es_admin(comercio_id));
drop policy if exists "admin guarda la llave de recuperación" on public.llaves_recuperacion;
create policy "admin guarda la llave de recuperación" on public.llaves_recuperacion for insert to authenticated
  with check (public.es_admin(comercio_id));
drop policy if exists "admin cambia la llave de recuperación" on public.llaves_recuperacion;
create policy "admin cambia la llave de recuperación" on public.llaves_recuperacion for update to authenticated
  using (public.es_admin(comercio_id)) with check (public.es_admin(comercio_id));
revoke all on public.llaves_recuperacion from anon;
revoke delete, truncate on public.llaves_recuperacion from authenticated;
grant select, insert, update on public.llaves_recuperacion to authenticated;
