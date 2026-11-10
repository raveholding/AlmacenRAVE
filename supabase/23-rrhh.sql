-- =====================================================================
-- SISTEMA VB · 23 · V26.64 · Recursos Humanos (Plan Micro / Plan Completo)
--
-- Correr DESPUÉS de 01..22 (se puede repetir). Aditiva: no borra ni cambia datos.
-- Qué agrega a la sincronización (colecciones del equipo, como todo lo demás):
--   hrshift = turnos por persona y día          (se pueden borrar)
--   hrreq   = licencias, vacaciones y justificantes con su circuito de aprobación
--   hrdoc   = DESCRIPCIÓN de los documentos del legajo (el archivo NO viaja: queda en el equipo y en el respaldo)
--   hrpay   = liquidaciones internas cerradas (foto del período)
--   hrjob / hrcand = vacantes y candidatos (datos personales del candidato van cifrados, __pii)
--   hritem  = entregas de uniformes y herramientas
--   hrmsg   = avisos al personal               (se escriben UNA vez)
--   hrplan  = cambios de plan Micro ↔ Completo (se escriben UNA vez; sirven para facturar)
-- Quién escribe: administrador todo; supervisor turnos, solicitudes (aprobaciones) y avisos; mostrador y operador nada de esto
-- (las fichadas siguen en 'fich', que ya escriben).
-- No crea el rol «empleado» en el servidor: el portal del empleado con cuentas propias en la nube es una etapa futura.
-- =====================================================================
do $mig$
declare
  d text;
  o1 constant text := $o$'gift','presup','conv','cmsg'];$o$;
  n1 constant text := $n$'gift','presup','conv','cmsg','hrshift','hrreq','hrdoc','hrpay','hrjob','hrcand','hritem','hrmsg','hrplan'];$n$;
  o2 constant text := $o$'devol','merma','cmsg'];$o$;
  n2 constant text := $n$'devol','merma','cmsg','hrmsg','hrplan'];$n$;
  o3 constant text := $o$'tlogs','pedidos','acuer'];$o$;
  n3 constant text := $n$'tlogs','pedidos','acuer','hrshift','hrdoc','hrjob','hrcand'];$n$;
  o4 constant text := $o$'acuer','cexc','cexcu','ctev','cdet')$o$;
  n4 constant text := $n$'acuer','cexc','cexcu','ctev','cdet','hrshift','hrreq','hrmsg')$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''hrplan''' in d) = 0 then
    if position(o1 in d) = 0 or position(o2 in d) = 0 or position(o3 in d) = 0 then
      raise exception '23: no encontré las listas de sincronizar (¿falta correr 22?)';
    end if;
    d := replace(replace(replace(d, o1, n1), o2, n2), o3, n3);
    execute d;
  end if;
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''hrreq''' in d) = 0 then
    if position(o4 in d) = 0 then raise exception '23: no encontré la lista del supervisor en rave_puede_escribir (¿falta correr 22?)'; end if;
    d := replace(d, o4, n4);
    execute d;
  end if;
end
$mig$;
