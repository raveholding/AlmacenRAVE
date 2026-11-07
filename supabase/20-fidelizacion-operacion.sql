-- =====================================================================
-- SISTEMA RAVE · 20 · V26.54 · Fidelización ampliada y operación
--
-- Correr DESPUÉS de 01..19 (se puede repetir). Aditiva: no borra ni cambia datos.
-- Qué agrega:
--   · Colecciones nuevas:
--       fidmov  = libro del monedero digital (cargas, pagos, cashback, premios). Se escribe UNA vez.
--       giftmov = libro de cada gift card / voucher (emisión y canjes). Se escribe UNA vez.
--       juego   = jugadas de la ruleta / trivia con el premio que salió. Se escribe UNA vez.
--       devol   = devoluciones parciales de una venta. Se escribe UNA vez.
--       merma   = mermas, roturas, vencimientos y faltantes valorizados. Se escribe UNA vez.
--       gift    = cabecera de la gift card (código, titular, vencimiento, estado).
--       presup  = presupuestos (no mueven stock ni caja hasta convertirse en venta).
--     Los saldos (monedero, gift card) NO se guardan: se derivan sumando el libro.
--   · Ventas: dos medios de pago nuevos, 'monedero' y 'giftcard'.
--   · Validación de los libros: importe entero distinto de cero y tipo de movimiento conocido.
-- Cómo: modifica en el lugar las definiciones VIGENTES de public.sincronizar y public.rave_puede_escribir.
--   Si ya tienen 'fidmov', no hace nada.
-- =====================================================================
do $mig$
declare
  d text;
  o1 constant text := $o$'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf','acuer','cexc','cexcu','ctev','cdet','cortesx'];$o$;
  n1 constant text := $n$'sellos','otp','pedidos','arrep','pya','lotes','cfg','sucs','cajas','ctransf','acuer','cexc','cexcu','ctev','cdet','cortesx','fidmov','giftmov','juego','devol','merma','gift','presup'];$n$;
  o2 constant text := $o$c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf','cexc','cexcu','ctev','cdet','cortesx'];$o$;
  n2 constant text := $n$c_una_vez    constant text[] := array['smov','audit','cierres','cnotas','otp','sellos','cusos','fiado','ctransf','cexc','cexcu','ctev','cdet','cortesx','fidmov','giftmov','juego','devol','merma'];$n$;
  o3 constant text := $o$        if v_motivo is null and v_col = 'ventas' and v_datos ? 'pays' then$o$;
  n3 constant text := $n$        -- V26.54 · 20 · libros del monedero y de las gift cards: importe entero distinto de cero y tipo conocido
        if v_motivo is null and v_col = 'fidmov' and not v_borrado then
          if jsonb_typeof(v_datos -> 'amount') <> 'number' or (v_datos ->> 'amount')::numeric <> trunc((v_datos ->> 'amount')::numeric)
             or (v_datos ->> 'amount')::numeric = 0 then
            v_motivo := 'monedero: el importe debe ser un entero distinto de cero';
          elsif coalesce(v_datos ->> 'kind', '') not in ('carga','pago','cashback','premio','ajuste','reverso','devolucion') then
            v_motivo := 'monedero: tipo de movimiento inválido';
          elsif coalesce(v_datos ->> 'cust', '') = '' then
            v_motivo := 'monedero: falta el cliente';
          end if;
        end if;
        if v_motivo is null and v_col = 'giftmov' and not v_borrado then
          if jsonb_typeof(v_datos -> 'amount') <> 'number' or (v_datos ->> 'amount')::numeric <> trunc((v_datos ->> 'amount')::numeric)
             or (v_datos ->> 'amount')::numeric = 0 then
            v_motivo := 'gift card: el importe debe ser un entero distinto de cero';
          elsif coalesce(v_datos ->> 'gift', '') = '' then
            v_motivo := 'gift card: falta la tarjeta';
          end if;
        end if;
        if v_motivo is null and v_col = 'ventas' and v_datos ? 'pays' then$n$;
  o5 constant text := $o$'qr','modo','pedidosya'])) then$o$;
  n5 constant text := $n$'qr','modo','pedidosya','monedero','giftcard'])) then$n$;
  o4 constant text := $o$'ventas','smov','turnos','movs','audit','cortesx'$o$;
  n4 constant text := $n$'ventas','smov','turnos','movs','audit','cortesx','fidmov','giftmov','juego','devol','merma','gift','presup'$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''fidmov''' in d) = 0 then
    if position(o1 in d) = 0 or position(o2 in d) = 0 or position(o3 in d) = 0 or position(o5 in d) = 0 then
      raise exception '20: no encontré las listas de sincronizar (¿faltan 01..19?)';
    end if;
    d := replace(replace(replace(replace(d, o1, n1), o2, n2), o3, n3), o5, n5);
    execute d;
  end if;
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''fidmov''' in d) = 0 then
    if position(o4 in d) = 0 then raise exception '20: no encontré las listas de rave_puede_escribir'; end if;
    d := replace(d, o4, n4);
    execute d;
  end if;
end
$mig$;
