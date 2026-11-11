-- =====================================================================
-- 24 · V26.66 · El administrador restablece el acceso de alguien de su equipo EN UN PASO
-- Correr DESPUÉS de 01 a 23. Aditivo e idempotente (se puede repetir).
--
-- Antes: si alguien del equipo olvidaba su contraseña, el administrador tenía que quitarlo,
-- volver a invitarlo y pasarle un código nuevo (la persona entraba por «Tengo una invitación»).
-- Si sólo se cambiaba la contraseña (restablecer_clave_miembro, de 03), la persona quedaba
-- sin poder abrir los datos cifrados porque su llave seguía envuelta con la clave vieja.
--
-- Ahora: el sistema del administrador genera una CLAVE TEMPORAL, envuelve con ella la llave de
-- datos del comercio (en el navegador del administrador: el servidor nunca ve la llave abierta)
-- y llama a esta función, que en una sola transacción:
--   1. pone la clave temporal en la cuenta de la persona (mismas reglas que 03: sólo gente de SU
--      equipo, nunca otro administrador ni personas que también están en otro comercio);
--   2. reemplaza la llave de esa persona por la envuelta con la clave temporal y la marca
--      «temporal»: al entrar con la clave temporal el sistema le pide elegir su contraseña nueva.
-- =====================================================================

create or replace function public.restablecer_acceso_miembro(p_comercio uuid, p_usuario uuid, p_clave text, p_llave jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare v_email text;
begin
  if p_llave is null or jsonb_typeof(p_llave) <> 'object'
     or jsonb_typeof(p_llave->'kdf') <> 'object' or jsonb_typeof(p_llave->'wrap') <> 'object'
     or length(p_llave::text) > 4000 then
    raise exception 'la llave temporal no tiene el formato esperado' using errcode = '22023';
  end if;
  -- mismas comprobaciones de seguridad que 03 (administrador del comercio, persona de su equipo,
  -- no otro administrador, no alguien de otro comercio, ya entró alguna vez) + cambio de clave
  perform public.restablecer_clave_miembro(p_comercio, p_usuario, p_clave);
  update public.llaves
     set kdf = p_llave->'kdf', wrap = p_llave->'wrap', temporal = true, actualizado = now()
   where comercio_id = p_comercio and usuario_id = p_usuario;
  select email into v_email from auth.users where id = p_usuario;
  return jsonb_build_object('ok', true, 'email', v_email);
end $$;
revoke all on function public.restablecer_acceso_miembro(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.restablecer_acceso_miembro(uuid, uuid, text, jsonb) to authenticated;
