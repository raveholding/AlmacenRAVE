-- =====================================================================
-- 39-push-clientes.sql · V27.27 · Sistema Vincular Business
-- push_subs_clientes(p_comercio): ids de los clientes del Club que tienen los avisos push activos en al
-- menos un celular (sólo ids, nunca las direcciones de envío ni llaves). Para que «Suscriptos» muestre
-- quién ya los activó y a quién conviene invitar. Sólo miembros del comercio. Idempotente.
-- =====================================================================
create or replace function public.push_subs_clientes(p_comercio uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if public.rol_en(p_comercio) is null then raise exception 'sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(distinct cliente) from public.push_subs where comercio_id = p_comercio and cliente is not null), '[]'::jsonb);
end $$;
revoke all on function public.push_subs_clientes(uuid) from public, anon;
grant execute on function public.push_subs_clientes(uuid) to authenticated;
