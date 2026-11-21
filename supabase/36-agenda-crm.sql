-- =====================================================================
-- 36-agenda-crm.sql · V27.25 · Sistema Vincular Business
-- Agenda y «Hoy» de Atención al cliente: colección «ctask» (tareas, llamadas, reuniones, visitas y notas)
-- en sincronizar(); escritura para administrador, supervisor, mostrador y operador (las mismas listas
-- que «deal»); vb_version() = 36. Aditivo e idempotente: no borra ni cambia datos. Requiere 01 a 35.
-- =====================================================================
do $mig$
declare d text;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''ctask''' in d) = 0 then
    if position($o$'clog','devt','aviso']$o$ in d) = 0 then raise exception '36: no encontré la lista de sincronizar (¿falta correr 35?)'; end if;
    d := replace(d, $o$'clog','devt','aviso']$o$, $n$'clog','devt','aviso','ctask']$n$);
    execute d;
  end if;
end
$mig$;

do $mig$
declare d text;
begin
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''ctask''' in d) = 0 then
    -- toda lista que ya permite «deal» permite también «ctask»
    if position($o$'deal'$o$ in d) = 0 then raise exception '36: no encontré «deal» en rave_puede_escribir (¿falta correr 31?)'; end if;
    d := replace(d, $o$'deal'$o$, $n$'deal','ctask'$n$);
    execute d;
  end if;
end
$mig$;

create or replace function public.vb_version()
returns int language sql stable set search_path = public as $$ select 36 $$;
revoke all on function public.vb_version() from public, anon;
grant execute on function public.vb_version() to authenticated;
