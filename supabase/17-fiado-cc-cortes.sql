-- =====================================================================
-- SISTEMA RAVE · 17 · V26.49 · 4.34 · Fiado / Cuenta corriente y cortes X
--
-- Correr DESPUÉS de 01..16 (se puede repetir). Aditiva: no borra ni cambia datos.
-- Qué agrega:
--   · Colección nueva `cortesx` (corte X: foto del turno que NO cierra la caja). Se escribe UNA vez
--     (un reenvío no la duplica ni la cambia); la pueden escribir todos los roles de caja.
--   · Ventas: el tipo de deuda `ck` sólo puede ser 'fiado' o 'cc' (las ventas viejas no lo traen = cuenta corriente).
--     El saldo por tipo NO se guarda: se deriva de ventas y cobros, igual que el saldo total.
-- Cómo: modifica en el lugar las definiciones VIGENTES de public.sincronizar y public.rave_puede_escribir
--   (no las copia enteras). Si ya tienen 'cortesx', no hace nada.
-- =====================================================================
do $mig$
declare
  d text;
  o1 constant text := $o$'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf','acuer','cexc','cexcu','ctev','cdet'];$o$;
  n1 constant text := $n$'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf','acuer','cexc','cexcu','ctev','cdet','cortesx'];$n$;
  o2 constant text := $o$c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf','cexc','cexcu','ctev','cdet'];$o$;
  n2 constant text := $n$c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf','cexc','cexcu','ctev','cdet','cortesx'];$n$;
  o3 constant text := $o$        if v_motivo is null and v_col = 'ventas' and v_datos ? 'pays' then$o$;
  n3 constant text := $n$        -- V26.49 · 17 · tipo de deuda de la venta: sólo 'fiado' o 'cc'
        if v_motivo is null and v_col = 'ventas' and v_datos ? 'ck' and coalesce(v_datos ->> 'ck', '') not in ('fiado', 'cc') then
          v_motivo := 'tipo de deuda inválido (fiado o cc)';
        end if;
        if v_motivo is null and v_col = 'ventas' and v_datos ? 'pays' then$n$;
  o4 constant text := $o$'ventas','smov','turnos','movs','audit'$o$;
  n4 constant text := $n$'ventas','smov','turnos','movs','audit','cortesx'$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''cortesx''' in d) = 0 then
    if position(o1 in d) = 0 or position(o2 in d) = 0 or position(o3 in d) = 0 then
      raise exception '17: no encontré las listas de sincronizar (¿faltan 01..16?)';
    end if;
    d := replace(replace(replace(d, o1, n1), o2, n2), o3, n3);
    execute d;
  end if;
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''cortesx''' in d) = 0 then
    if position(o4 in d) = 0 then raise exception '17: no encontré las listas de rave_puede_escribir'; end if;
    d := replace(d, o4, n4);
    execute d;
  end if;
end
$mig$;
