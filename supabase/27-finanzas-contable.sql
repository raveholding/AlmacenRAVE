-- =====================================================================
-- 27 · V26.72 · Finanzas y Contabilidad de gestión
-- Correr DESPUÉS de 01 a 26. Aditivo e idempotente (se puede repetir). No borra ni cambia datos.
--
-- Qué agrega:
--  1) Rol de equipo «contador»: SÓLO LECTURA. Ve todo lo que el comercio ya sincroniza (como cualquier miembro) y lo
--     único que puede escribir es la auditoría (sus exportaciones quedan registradas). No vende, no toca caja,
--     no genera ni cierra asientos.
--  2) Colecciones nuevas de la sincronización (por documento → reintentar no duplica):
--       asiento = asientos contables automáticos (id determinístico por operación; se escriben UNA vez, nunca se editan)
--       cierrec = cierres de período contable con la huella encadenada (UNA vez)
--       finiva  = IVA crédito fiscal cargado a una compra (UNA vez)
--       pcta    = plan de cuentas (editable por el administrador)
--       fincmp  = compromisos de pago del flujo de fondos (se pueden quitar)
--       finrec  = renglones del extracto bancario para conciliar (la descripción viaja CIFRADA, __pii; se pueden quitar)
--     Escriben: administrador todo; supervisor estas seis (el sistema sólo le deja usarlas si el administrador le da
--     el permiso de Finanzas o Contabilidad); mostrador, operador y repartidor ninguna; contador sólo 'audit'.
-- =====================================================================

-- ---------- 1) rol «contador» ----------
do $mig$
declare r record; d text;
begin
  for r in select conrelid::regclass as t, conname from pg_constraint
            where conrelid in ('public.miembros'::regclass, 'public.invitaciones'::regclass)
              and contype = 'c' and pg_get_constraintdef(oid) like '%repartidor%' and pg_get_constraintdef(oid) not like '%contador%'
  loop
    execute format('alter table %s drop constraint %I', r.t, r.conname);
    execute format('alter table %s add constraint %I check (rol in (''admin'', ''supervisor'', ''mostrador'', ''operador'', ''repartidor'', ''contador''))', r.t, r.conname);
  end loop;
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('invitar_miembro', 'cambiar_rol')
  loop
    d := pg_get_functiondef(r.oid);
    if position('''contador''' in d) = 0 then
      if position('p_rol not in (''admin'', ''supervisor'', ''mostrador'', ''operador'', ''repartidor'')' in d) = 0 then
        raise exception '27: no encontré la lista de roles en % (¿falta correr 26?)', r.oid::regprocedure;
      end if;
      execute replace(d, 'p_rol not in (''admin'', ''supervisor'', ''mostrador'', ''operador'', ''repartidor'')',
                         'p_rol not in (''admin'', ''supervisor'', ''mostrador'', ''operador'', ''repartidor'', ''contador'')');
    end if;
  end loop;
end
$mig$;

-- ---------- 2) sincronización: colecciones y permisos ----------
do $mig$
declare
  d text;
  o1 constant text := $o$'envio','ruta','rendrep'];$o$;
  n1 constant text := $n$'envio','ruta','rendrep','asiento','cierrec','finiva','pcta','fincmp','finrec'];$n$;
  o2 constant text := $o$'cmsg','hrmsg','hrplan','rendrep'];$o$;
  n2 constant text := $n$'cmsg','hrmsg','hrplan','rendrep','asiento','cierrec','finiva'];$n$;
  o3 constant text := $o$'hrshift','hrdoc','hrjob','hrcand'];$o$;
  n3 constant text := $n$'hrshift','hrdoc','hrjob','hrcand','fincmp','finrec'];$n$;
  o4 constant text := $o$'hrshift','hrreq','hrmsg','envio','ruta','rendrep')$o$;
  n4 constant text := $n$'hrshift','hrreq','hrmsg','envio','ruta','rendrep','asiento','cierrec','finiva','pcta','fincmp','finrec')$n$;
  o5 constant text := $o$when 'repartidor' then p_col in ('envio','ruta','audit','fich')$o$;
  n5 constant text := $n$when 'repartidor' then p_col in ('envio','ruta','audit','fich')
    when 'contador' then p_col in ('audit')$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''asiento''' in d) = 0 then
    if position(o1 in d) = 0 or position(o2 in d) = 0 or position(o3 in d) = 0 then
      raise exception '27: no encontré las listas de sincronizar (¿falta correr 26?)';
    end if;
    d := replace(d, o2, n2);                    -- primero la de «una vez» (termina igual que la de «todas»)
    d := regexp_replace(d, '(c_todas\s+constant text\[\] := array\[[^;]*)''envio'',''ruta'',''rendrep''\];', '\1' || n1);
    d := replace(d, o3, n3);
    execute d;
  end if;

  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''contador''' in d) = 0 then
    if position(o4 in d) = 0 or position(o5 in d) = 0 then
      raise exception '27: no encontré las listas de rave_puede_escribir (¿falta correr 26?)';
    end if;
    d := replace(replace(d, o4, n4), o5, n5);
    execute d;
  end if;
end
$mig$;

-- Control (debe devolver true, true, true):
-- select position('''asiento''' in pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure)) > 0,
--        public.rave_puede_escribir('contador','audit','x') and not public.rave_puede_escribir('contador','asiento','x'),
--        public.rave_puede_escribir('supervisor','asiento','x') and not public.rave_puede_escribir('mostrador','asiento','x');
