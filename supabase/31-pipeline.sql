-- =====================================================================
-- 31-pipeline.sql · V26.79 · Sistema Vincular Business
-- Pipeline de ventas de Atención al cliente: colección «deal» (oportunidades) en sincronizar(),
-- escritura para administrador, supervisor, mostrador y operador; vb_version() = 31.
-- Aditivo e idempotente: no borra ni cambia datos. Requiere 01 a 30.
-- =====================================================================
do $mig$
declare d text;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''deal''' in d) = 0 then
    if position($o$'lblq','hold','vale'];$o$ in d) = 0 then raise exception '31: no encontré la lista de sincronizar (¿falta correr 30?)'; end if;
    d := replace(d, $o$'lblq','hold','vale'];$o$, $n$'lblq','hold','vale','deal'];$n$);
    execute d;
  end if;
end
$mig$;

do $mig$
declare d text;
  os constant text := $o$'tdep','dstk','tinv','acop','plog','lblq','hold','vale')$o$;
  om constant text := $o$'dstk','tinv','acop','plog','lblq','hold')$o$;
  oo constant text := $o$'tlogs','cexcu','ctransf','ctev','cdet','envio','plog','hold')$o$;
begin
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''deal''' in d) = 0 then
    if position(os in d) = 0 or position(om in d) = 0 or position(oo in d) = 0 then raise exception '31: no encontré las listas de rave_puede_escribir (¿falta correr 30?)'; end if;
    d := replace(d, os, $n$'tdep','dstk','tinv','acop','plog','lblq','hold','vale','deal')$n$);
    d := replace(d, om, $n$'dstk','tinv','acop','plog','lblq','hold','deal')$n$);
    d := replace(d, oo, $n$'tlogs','cexcu','ctransf','ctev','cdet','envio','plog','hold','deal')$n$);
    execute d;
  end if;
end
$mig$;

create or replace function public.vb_version()
returns int language sql stable set search_path = public as $$ select 31 $$;
revoke all on function public.vb_version() from public, anon;
grant execute on function public.vb_version() to authenticated;
