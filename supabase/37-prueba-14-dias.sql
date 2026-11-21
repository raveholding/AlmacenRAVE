-- =====================================================================
-- 37-prueba-14-dias.sql · V27.25 · Sistema Vincular Business
-- La prueba gratis de los comercios nuevos pasa de 30 a 14 días (las licencias que ya existen no se tocan).
-- Aditivo e idempotente. Requiere 35.
-- =====================================================================
do $mig$
declare d text; f text;
begin
  foreach f in array array['public.vb_lic_prueba_nueva()','public.vb_licencia_accion(uuid,text,integer,text,text[],text)'] loop
    select pg_get_functiondef(f::regprocedure) into d;
    if position('current_date + 30' in d) > 0 then
      d := replace(d, 'current_date + 30', 'current_date + 14');
      execute d;
    end if;
  end loop;
end
$mig$;
