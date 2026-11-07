-- =====================================================================
-- SISTEMA RAVE · 21 · V26.57 · Tarjeta digital del cliente: club_estado devuelve también el SALDO del monedero
--
-- Correr DESPUÉS de 01..20 (se puede repetir). No borra ni cambia datos: sólo reemplaza la función pública
-- club_estado, que ahora además de N.º de socio y sellos devuelve 'saldo' (centavos) sumando el libro del monedero.
-- Sigue sin devolver nombre, WhatsApp, DNI ni cumpleaños, y sólo responde a quien tiene el id secreto de la tarjeta.
-- =====================================================================
create or replace function public.club_estado(p_slug text, p_cid text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_c   uuid;
  v_id  text;
  v_num text;
  v_baja boolean;
  v_n   numeric;
  v_saldo numeric;
begin
  select id into v_c from public.comercios where slug = lower(left(coalesce(p_slug, ''), 40));
  if v_c is null or coalesce(p_cid, '') !~ '^[A-Za-z0-9_-]{8,64}$' then
    return jsonb_build_object('ok', false);
  end if;

  -- el socio: su propio id o una tarjeta alias (mismo WhatsApp registrado dos veces)
  select r.id, r.datos->>'num', coalesce(r.datos->>'status', '') = 'baja'
    into v_id, v_num, v_baja
    from public.registros r
   where r.comercio_id = v_c and r.coleccion = 'clientes' and not r.borrado
     and (r.id = p_cid
          or (jsonb_typeof(r.datos->'cards') = 'array' and (r.datos->'cards') ? p_cid))
   order by (r.id = p_cid) desc
   limit 1;

  if v_id is null or v_baja then
    return jsonb_build_object('ok', true, 'socio', false);
  end if;

  select coalesce(sum((s.datos->>'n')::numeric), 0) into v_n
    from public.registros s
   where s.comercio_id = v_c and s.coleccion = 'sellos' and not s.borrado
     and s.datos->>'cust' = v_id;

  -- V26.57 · saldo del monedero (centavos): suma del libro fidmov del socio. Sólo lo ve quien tiene el id secreto de la tarjeta.
  select coalesce(sum((m.datos->>'amount')::numeric), 0) into v_saldo
    from public.registros m
   where m.comercio_id = v_c and m.coleccion = 'fidmov' and not m.borrado
     and m.datos->>'cust' = v_id and jsonb_typeof(m.datos->'amount') = 'number';

  return jsonb_build_object('ok', true, 'socio', true, 'num', v_num, 'sellos', v_n, 'saldo', v_saldo);
end $$;
revoke all on function public.club_estado(text, text) from public;
grant execute on function public.club_estado(text, text) to anon, authenticated;
