-- =====================================================================
-- 33-licencias-combos.sql · Licencias alineadas con la web de Vincular Business
-- Modelo comercial (decisión del dueño, 2026-11-15): pago único del combo +
-- mantenimiento mensual. Si el mantenimiento no se paga, SOLO SE AVISA:
-- la licencia nunca bloquea nada (bloquea = false siempre).
-- Combos: menu · basico · completo · completo_app · medida (planes viejos aceptados).
-- Extras sumables: ia (Pro + IA), nfc, turnos, taller, abonos, gastro, kiosco,
-- wifi, sucursal, mayorista, logistica, equipo, ventas, digital, inteligente.
-- Aditivo e idempotente. Requiere 32. vb_version() = 33.
-- =====================================================================

create or replace function public.vb_lic_json(l public.licencias)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'plan', l.plan, 'paquetes', to_jsonb(l.paquetes), 'estado_cargado', l.estado,
    'vence', l.vence, 'gracia_dias', l.gracia_dias,
    'estado', case
      when l.estado = 'suspendida' then 'suspendida'
      when l.vence is null or l.vence >= current_date then l.estado
      when l.vence + l.gracia_dias >= current_date then 'gracia'
      else 'vencida' end,
    'dias', case when l.vence is null then null else l.vence - current_date end,
    'bloquea', false,
    'aviso', case
      when l.estado = 'suspendida' then 'Mantenimiento suspendido: comunicate con Vincular Business.'
      when l.vence is not null and l.vence < current_date then 'Mantenimiento mensual pendiente desde el '||to_char(l.vence,'DD/MM/YYYY')||'.'
      when l.vence is not null and l.vence - current_date <= 5 then 'El mantenimiento mensual vence el '||to_char(l.vence,'DD/MM/YYYY')||'.'
      else null end)
$$;

create or replace function public.vb_licencia_set(p_comercio uuid, p_plan text, p_paquetes text[],
  p_estado text, p_vence date, p_gracia int default 7, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare bad text; l public.licencias;
begin
  if not public.vb_es_staff() then return jsonb_build_object('err','solo Vincular Business'); end if;
  if not exists(select 1 from public.comercios where id = p_comercio) then return jsonb_build_object('err','comercio inexistente'); end if;
  if p_plan not in ('menu','basico','completo','completo_app','medida','esencial','profesional','mayorista','total') then
    return jsonb_build_object('err','plan inválido'); end if;
  if p_estado not in ('prueba','activa','suspendida') then return jsonb_build_object('err','estado inválido'); end if;
  select string_agg(x, ',') into bad from unnest(coalesce(p_paquetes,'{}')) x
   where x not in ('ia','nfc','turnos','taller','abonos','gastro','kiosco','wifi','sucursal','mayorista','logistica','equipo','ventas','digital','inteligente');
  if bad is not null then return jsonb_build_object('err','paquete inválido: '||bad); end if;
  insert into public.licencias(comercio_id, plan, paquetes, estado, vence, gracia_dias, nota, actualizado, actualizado_por)
  values (p_comercio, p_plan, (select coalesce(array_agg(distinct x order by x),'{}') from unnest(coalesce(p_paquetes,'{}')) x),
          p_estado, p_vence, greatest(0, least(60, coalesce(p_gracia,7))), left(p_nota,500), now(), public.mi_email())
  on conflict (comercio_id) do update set plan = excluded.plan, paquetes = excluded.paquetes, estado = excluded.estado,
    vence = excluded.vence, gracia_dias = excluded.gracia_dias, nota = excluded.nota,
    actualizado = now(), actualizado_por = excluded.actualizado_por
  returning * into l;
  return public.vb_lic_json(l);
end $$;

revoke all on function public.vb_lic_json(public.licencias) from public, anon;
revoke all on function public.vb_licencia_set(uuid,text,text[],text,date,int,text) from public, anon;
grant execute on function public.vb_licencia_set(uuid,text,text[],text,date,int,text) to authenticated;

create or replace function public.vb_version()
returns int language sql stable set search_path = public as $$ select 33 $$;
revoke all on function public.vb_version() from public, anon;
grant execute on function public.vb_version() to authenticated;
