-- 14 · Auditoría V26.30 (2026-10-27): fija el search_path de las funciones auxiliares que el linter de Supabase
-- marcó como «role mutable search_path». Es aditiva, idempotente y no cambia datos ni permisos.
do $$
declare f text;
begin
  foreach f in array array[
    'public.mi_email()','public.rave_hoy()','public.rave_json_tiene_pan(jsonb)','public.rave_luhn_ok(text)',
    'public.rave_no_truncate()','public.rave_num(jsonb,text)','public.rave_parece_pan(text)',
    'public.rave_puede_escribir(text,text,text)','public.rave_siguiente(uuid,text)','public.rave_solo_agregar()',
    'public.rave_txt(jsonb,text)','public.rave_uuid(text)']
  loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s set search_path = public, pg_temp', f);
    end if;
  end loop;
end $$;
