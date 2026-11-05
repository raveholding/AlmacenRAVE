-- =====================================================================
-- SISTEMA RAVE · 16 · V26.49 · 4.33 · Recargos y descuentos por medio de pago
--
-- Correr DESPUÉS de 01..15 (se puede repetir). Aditiva: no borra ni cambia datos.
-- Qué agrega:
--   · Documento de configuración nuevo `cfg/payadj` (reglas de recargo/descuento por medio de pago).
--     Lo escribe SÓLO el administrador: rave_puede_escribir() ya limita al supervisor a `cfg/cfg`
--     y a mostrador/operador no les deja escribir configuración. Todos los roles lo LEEN (lo necesitan para cobrar).
--   · Validación de los pagos con ajuste dentro de una venta: si un pago trae `adj`, tiene que traer `b` (base)
--     y cumplir a = b + adj, enteros; un descuento no puede superar la base. La suma de los pagos = total
--     se sigue validando como siempre (07).
-- Cómo: toma la definición VIGENTE de public.sincronizar (la de 11, con todo lo de 10–15) y le agrega
--   'payadj' a la lista cerrada de configuraciones y el control de los pagos. No copia la función entera,
--   así no pisa cambios de otras migraciones. Si la función ya tiene 'payadj', no hace nada.
-- Límite declarado: el servidor no recalcula el ajuste con las reglas (la regla pudo cambiar mientras el equipo
--   estaba sin conexión); valida forma y sumas. La foto de la regla viaja en la venta (`adj`).
-- =====================================================================

do $mig$
declare
  d   text;
  o1  constant text := $o$c_cfg_ids    constant text[] := array['tenant','cfg','menu','loyalty','roles','integ','legal','clubkey'];$o$;
  n1  constant text := $n$c_cfg_ids    constant text[] := array['tenant','cfg','menu','loyalty','roles','integ','legal','clubkey','payadj'];$n$;
  o2  constant text := $o$                v_seen := v_seen || v_m;$o$;
  n2  constant text := $n$                -- V26.49 · 16 · pago con recargo/descuento por medio de pago: a = b + adj, enteros
                if v_p ? 'adj' and (jsonb_typeof(v_p -> 'adj') is distinct from 'number' or jsonb_typeof(v_p -> 'b') is distinct from 'number'
                     or (v_p ->> 'adj')::numeric <> trunc((v_p ->> 'adj')::numeric) or (v_p ->> 'b')::numeric <= 0
                     or (v_p ->> 'b')::numeric <> trunc((v_p ->> 'b')::numeric)
                     or (v_p ->> 'b')::numeric + (v_p ->> 'adj')::numeric <> (v_p ->> 'a')::numeric
                     or -(v_p ->> 'adj')::numeric > (v_p ->> 'b')::numeric) then
                  v_motivo := 'ajuste por medio de pago inválido (a = base + ajuste, enteros)'; exit;
                end if;
                v_seen := v_seen || v_m;$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''payadj''' in d) > 0 then
    raise notice '16: sincronizar ya tiene payadj (nada que hacer)';
    return;
  end if;
  if position(o1 in d) = 0 then raise exception '16: no encontré la lista de configuraciones de sincronizar (¿faltan 01..15?)'; end if;
  if position(o2 in d) = 0 then raise exception '16: no encontré el control de pagos de sincronizar (¿falta 07?)'; end if;
  d := replace(d, o1, n1);
  d := replace(d, o2, n2);
  execute d;
end
$mig$;

comment on function public.sincronizar(uuid, text, jsonb) is
  'Sincroniza cambios del equipo. V26.49 (16): cfg/payadj (sólo admin) y validación de pagos con ajuste por medio de pago.';
