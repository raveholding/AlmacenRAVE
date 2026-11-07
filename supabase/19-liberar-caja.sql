-- SISTEMA VB · 19 · Liberar el número de caja de un equipo que ya no se usa (V26.53)
-- Cada navegador/equipo reserva su número de caja (registrar_caja) para que los tickets no se repitan.
-- Si un equipo deja de usarse (otra PC, otro navegador, datos borrados), su número queda reservado para siempre.
-- Esta función deja que SÓLO el administrador lo libere. No toca ventas, cajas abiertas ni cierres: sólo la reserva del número.
-- Aditiva e idempotente.
create or replace function public.liberar_caja(p_comercio uuid, p_nro int, p_disp text default '')
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_disp text;
begin
  if public.rol_en(p_comercio) is distinct from 'admin' then
    raise exception 'sólo el administrador puede liberar un número de caja' using errcode = '42501';
  end if;
  if p_nro is null or p_nro < 1 or p_nro > 99 then raise exception 'número de caja inválido'; end if;
  select dispositivo into v_disp from public.cajas where comercio_id = p_comercio and nro = p_nro for update;
  if not found then return false; end if;
  if coalesce(p_disp,'') <> '' and v_disp = p_disp then
    raise exception 'ese número es el de este mismo equipo' using errcode = '22023';
  end if;
  delete from public.cajas where comercio_id = p_comercio and nro = p_nro;
  return true;
end $$;
revoke all on function public.liberar_caja(uuid, int, text) from public, anon;
grant execute on function public.liberar_caja(uuid, int, text) to authenticated;
