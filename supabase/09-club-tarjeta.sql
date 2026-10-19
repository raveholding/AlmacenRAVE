-- =====================================================================
-- SISTEMA VB · 09 · Tarjeta del Club desde el menú público (estado de la tarjeta)
--
-- Correr DESPUÉS de 01..08 (se puede repetir: sólo "create or replace").
-- ADITIVA: no cambia ni borra nada existente.
--
-- Para qué sirve: quien se suma al Club desde el menú recibe su tarjeta en el
-- acto (el celular genera su propia clave). Esta función sólo le dice a ese
-- celular, con el identificador secreto de su tarjeta (80 bits al azar):
--   · si el comercio ya lo registró como socio y con qué N.º de socio,
--   · cuántos sellos lleva.
-- No devuelve nombre, WhatsApp, DNI, cumpleaños ni nada de otras personas.
-- Quien no conoce el identificador de una tarjeta no obtiene nada: la
-- respuesta es la misma para "no existe" que para "todavía no importada".
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

  return jsonb_build_object('ok', true, 'socio', true, 'num', v_num, 'sellos', v_n);
end $$;
revoke all on function public.club_estado(text, text) from public;
grant execute on function public.club_estado(text, text) to anon, authenticated;

-- El menú publicado también lleva las reglas del club (sellos para el premio y el premio),
-- para que el celular del cliente muestre "3 / 8" con la meta correcta. Sólo estos dos datos.
-- (Misma función que la de 04, con 'loyalty' agregado.)
create or replace function public.rave_limpiar_menu(p jsonb)
returns jsonb
language plpgsql immutable set search_path = public
as $$
declare
  v_cat  jsonb := coalesce(p->'catalog', '{}'::jsonb);
  v_prod jsonb := '[]'::jsonb;
  v_sec  jsonb := '[]'::jsonb;
  v_it   jsonb;
  v_o    jsonb;
  k      text;
  keys_p constant text[] := array['id','cat','grupo','nom','sub','precio','img','destacado','desc','unidad','agotado'];
  keys_s constant text[] := array['cat','nom','titulo','hint','layout','alc','menu'];
begin
  for v_it in select * from jsonb_array_elements(case when jsonb_typeof(v_cat->'productos') = 'array' then v_cat->'productos' else '[]'::jsonb end) loop
    v_o := '{}'::jsonb;
    foreach k in array keys_p loop
      if v_it ? k then v_o := v_o || jsonb_build_object(k, v_it->k); end if;
    end loop;
    v_prod := v_prod || jsonb_build_array(v_o);
  end loop;
  for v_it in select * from jsonb_array_elements(case when jsonb_typeof(v_cat->'secciones') = 'array' then v_cat->'secciones' else '[]'::jsonb end) loop
    v_o := '{}'::jsonb;
    foreach k in array keys_s loop
      if v_it ? k then v_o := v_o || jsonb_build_object(k, v_it->k); end if;
    end loop;
    v_sec := v_sec || jsonb_build_array(v_o);
  end loop;
  return jsonb_build_object(
    'site',    coalesce(p->'site', '{}'::jsonb),
    'catalog', jsonb_build_object('secciones', v_sec, 'productos', v_prod),
    'plans',   case when jsonb_typeof(p->'plans') = 'array' then p->'plans' else '[]'::jsonb end,
    'coupons', case when jsonb_typeof(p->'coupons') = 'array' then p->'coupons' else '[]'::jsonb end,
    'legal',   coalesce(p->'legal', '{}'::jsonb),
    'clubkey', p->'clubkey',
    'loyalty', jsonb_build_object(
      'goal',   case when (p->'loyalty'->>'goal') ~ '^[0-9]{1,2}$' then least(30, greatest(2, (p->'loyalty'->>'goal')::int)) else 10 end,
      'reward', left(coalesce(p->'loyalty'->>'reward', ''), 100))
  );
end $$;
