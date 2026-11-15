-- =====================================================================
-- 30-gestion-integral.sql · V26.78 · Sistema Vincular Business
-- Gestión integral en la nube (todo sigue apagado hasta que el administrador lo activa en Sistema → Módulos):
--  1) Roles nuevos «preventista» y «deposito».
--  2) Colecciones nuevas en sincronizar():
--       pedv (pedidos de venta) · remv (remitos) · visit (visitas de preventa, sólo alta) · cobrr (cobranza en la calle)
--       gps (posiciones del equipo, sólo alta) · tdep (transferencias entre depósitos) · dstk (stock por depósito)
--       tinv (tomas de inventario) · acop (acopios) · plog (historial de precios, sólo alta) · lblq (cola de etiquetas)
--       hold (tickets en espera) · vale (vales del personal)
--  3) Permisos de escritura por rol (rave_puede_escribir).
--  4) vb_version(): el sistema la consulta para saber que este script está aplicado y recién entonces sube esas colecciones.
-- Aditivo e idempotente: no borra ni cambia datos. Requiere 01 a 29.
-- =====================================================================

-- ---------- 1) roles «preventista» y «deposito» ----------
do $mig$
declare r record; d text;
begin
  for r in select conrelid::regclass as t, conname from pg_constraint
            where conrelid in ('public.miembros'::regclass, 'public.invitaciones'::regclass)
              and contype = 'c' and pg_get_constraintdef(oid) like '%contador%' and pg_get_constraintdef(oid) not like '%preventista%'
  loop
    execute format('alter table %s drop constraint %I', r.t, r.conname);
    execute format('alter table %s add constraint %I check (rol in (''admin'', ''supervisor'', ''mostrador'', ''operador'', ''repartidor'', ''contador'', ''preventista'', ''deposito''))', r.t, r.conname);
  end loop;
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('invitar_miembro', 'cambiar_rol')
  loop
    d := pg_get_functiondef(r.oid);
    if position('''preventista''' in d) = 0 then
      if position('p_rol not in (''admin'', ''supervisor'', ''mostrador'', ''operador'', ''repartidor'', ''contador'')' in d) = 0 then
        raise exception '30: no encontré la lista de roles en % (¿falta correr 27?)', r.oid::regprocedure;
      end if;
      execute replace(d, 'p_rol not in (''admin'', ''supervisor'', ''mostrador'', ''operador'', ''repartidor'', ''contador'')',
                         'p_rol not in (''admin'', ''supervisor'', ''mostrador'', ''operador'', ''repartidor'', ''contador'', ''preventista'', ''deposito'')');
    end if;
  end loop;
end
$mig$;

-- ---------- 2) sincronización: colecciones nuevas ----------
do $mig$
declare
  d text;
  -- «todas» y «se pueden borrar» terminan igual desde el 29
  o1 constant text := $o$'fincmp','finrec','pushc','finmov','finrem','kb'];$o$;
  n1 constant text := $n$'fincmp','finrec','pushc','finmov','finrem','kb','pedv','remv','visit','cobrr','gps','tdep','dstk','tinv','acop','plog','lblq','hold','vale'];$n$;
  nb constant text := $n$'fincmp','finrec','pushc','finmov','finrem','kb','lblq','hold'];$n$;
  o2 constant text := $o$'rendrep','asiento','cierrec','finiva'];$o$;
  n2 constant text := $n$'rendrep','asiento','cierrec','finiva','visit','gps','plog'];$n$;
begin
  select pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure) into d;
  if position('''pedv''' in d) = 0 then
    if position(o1 in d) = 0 or position(o2 in d) = 0 then raise exception '30: no encontré las listas de sincronizar (¿falta correr 29?)'; end if;
    d := replace(d, o2, n2);                                                                              -- «una vez» (sólo alta)
    d := regexp_replace(d, '(c_borrables\s+constant text\[\] := array\[[^;]*)''fincmp'',''finrec'',''pushc'',''finmov'',''finrem'',''kb''\];', '\1' || nb);
    d := regexp_replace(d, '(c_todas\s+constant text\[\] := array\[[^;]*)''fincmp'',''finrec'',''pushc'',''finmov'',''finrem'',''kb''\];', '\1' || n1);
    if position('''vale''' in d) = 0 or position('''hold''];' in d) = 0 then raise exception '30: no se pudieron completar las listas de sincronizar'; end if;
    execute d;
  end if;
end
$mig$;

-- ---------- 3) permisos de escritura por rol ----------
do $mig$
declare
  d text;
  os constant text := $o$'pushc','finmov','finrem','kb')
                           or (p_col = 'cfg' and p_id = 'cfg')$o$;
  ns constant text := $n$'pushc','finmov','finrem','kb','pedv','remv','visit','cobrr','gps','tdep','dstk','tinv','acop','plog','lblq','hold','vale')
                           or (p_col = 'cfg' and p_id = 'cfg')$n$;
  om constant text := $o$'cexcu','ctransf','ctev','cdet','envio','ruta','rendrep')$o$;
  nm constant text := $n$'cexcu','ctransf','ctev','cdet','envio','ruta','rendrep','pedv','remv','cobrr','dstk','tinv','acop','plog','lblq','hold')$n$;
  oo constant text := $o$'tlogs','cexcu','ctransf','ctev','cdet','envio')$o$;
  no constant text := $n$'tlogs','cexcu','ctransf','ctev','cdet','envio','plog','hold')$n$;
  orp constant text := $o$when 'repartidor' then p_col in ('envio','ruta','audit','fich')$o$;
  nrp constant text := $n$when 'repartidor' then p_col in ('envio','ruta','audit','fich','gps')
    when 'preventista' then p_col in ('pedv','visit','cobrr','gps','audit','fich')
    when 'deposito' then p_col in ('pedv','remv','tdep','dstk','tinv','smov','plog','lblq','audit','fich')$n$;
begin
  select pg_get_functiondef('public.rave_puede_escribir(text,text,text)'::regprocedure) into d;
  if position('''preventista''' in d) = 0 then
    if position(os in d) = 0 or position(om in d) = 0 or position(oo in d) = 0 or position(orp in d) = 0 then
      raise exception '30: no encontré las listas de rave_puede_escribir (¿falta correr 29?)';
    end if;
    d := replace(d, os, ns);
    d := replace(d, om, nm);
    d := replace(d, oo, no);
    d := replace(d, orp, nrp);
    execute d;
  end if;
end
$mig$;

-- ---------- 4) versión del esquema (el sistema la consulta antes de subir las colecciones nuevas) ----------
create or replace function public.vb_version()
returns int language sql stable set search_path = public as $$ select 30 $$;
revoke all on function public.vb_version() from public, anon;
grant execute on function public.vb_version() to authenticated;
