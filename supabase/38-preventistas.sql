-- =====================================================================
-- 38-preventistas.sql · V27.26 · Sistema Vincular Business
-- Preventistas y rutas + reposición automática: colecciones «prevr» (preventistas) y «repo» (reglas de
-- reposición por producto) en sincronizar(); escritura con los mismos permisos que «prod» (productos);
-- vb_version() = 38. Las órdenes de compra siguen por el circuito de compras del servidor.
-- Aditivo e idempotente: no borra ni cambia datos. Requiere 01 a 37.
-- =====================================================================
do $mig$
declare d text;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''prevr''' in d) = 0 then
    if position($o$'devt','aviso','ctask']$o$ in d) = 0 then raise exception '38: no encontré la lista de sincronizar (¿falta correr 36?)'; end if;
    d := replace(d, $o$'devt','aviso','ctask']$o$, $n$'devt','aviso','ctask','prevr','repo']$n$);
    execute d;
  end if;
end
$mig$;

do $mig$
declare d text;
begin
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''prevr''' in d) = 0 then
    -- toda lista que permite «prod» (productos) permite también preventistas y reglas
    if position($o$'prod',$o$ in d) = 0 then raise exception '38: no encontré «prod» en rave_puede_escribir'; end if;
    d := replace(d, $o$'prod',$o$, $n$'prod','prevr','repo',$n$);
    execute d;
  end if;
end
$mig$;

create or replace function public.vb_version()
returns int language sql stable set search_path = public as $$ select 38 $$;
revoke all on function public.vb_version() from public, anon;
grant execute on function public.vb_version() to authenticated;
