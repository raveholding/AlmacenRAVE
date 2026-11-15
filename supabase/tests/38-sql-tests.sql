-- 30-gestion-integral.sql: roles preventista y deposito, colecciones de la gestión integral, permisos y vb_version()
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uB uuid := '00000000-0000-0000-0000-00000000000b';
  uP uuid := '00000000-0000-0000-0000-0000000000e1'; uD uuid := '00000000-0000-0000-0000-0000000000e2'; uM uuid := '00000000-0000-0000-0000-0000000000a3';
  cA uuid := t.ctxget('cA')::uuid; r jsonb; n int;
begin
  insert into auth.users(id,email) values (uP,'prev@a.com'),(uD,'dep@a.com') on conflict do nothing;
  insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uP,'preventista','prev@a.com','Preventista') on conflict (comercio_id,usuario_id) do update set rol='preventista';
  insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uD,'deposito','dep@a.com','Depósito') on conflict (comercio_id,usuario_id) do update set rol='deposito';
  perform t.chk('38: existen los roles preventista y deposito', exists(select 1 from public.miembros where usuario_id=uP and rol='preventista') and exists(select 1 from public.miembros where usuario_id=uD and rol='deposito'));
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(true) from (select public.cambiar_rol(%L,%L,'deposito')) x$q$, cA, uP));
  perform t.chk('38: el admin puede asignar el rol deposito', not (r ? 'err'), r::text);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(true) from (select public.cambiar_rol(%L,%L,'preventista')) x$q$, cA, uP));
  perform t.chk('38: y volver a preventista', not (r ? 'err'), r::text);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(true) from (select public.cambiar_rol(%L,%L,'vendedor_ambulante')) x$q$, cA, uP));
  perform t.chk('38: un rol inventado sigue rechazado', r ? 'err', r::text);
  -- versión
  r := t.call(uA,'a@a.com',$q$select to_jsonb(public.vb_version())$q$);
  perform t.chk('38: vb_version() = 30 para el equipo', r::text='30', r::text);
  r := t.call(null,'',$q$select to_jsonb(public.vb_version())$q$,'anon');
  perform t.chk('38: anon no consulta la versión', r ? 'err', r::text);
  -- admin: todas las colecciones nuevas
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"pedv","id":"pv1","d":{"n":"PV-1"}},{"c":"remv","id":"rm1","d":{}},{"c":"visit","id":"vi1","d":{}},{"c":"cobrr","id":"co1","d":{}},{"c":"gps","id":"g1","d":{}},{"c":"tdep","id":"td1","d":{}},{"c":"dstk","id":"p1","d":{}},{"c":"tinv","id":"ti1","d":{}},{"c":"acop","id":"ac1","d":{}},{"c":"plog","id":"pl1","d":{}},{"c":"lblq","id":"lq1","d":{}},{"c":"hold","id":"h1","d":{}},{"c":"vale","id":"va1","d":{}}]'::jsonb)$q$,cA));
  perform t.chk('38: el admin sube las 13 colecciones nuevas', (r->>'aplicados')::int=13, r::text);
  -- sólo alta
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"visit","id":"vi1","d":{"x":2}},{"c":"gps","id":"g1","d":{"x":2}},{"c":"plog","id":"pl1","d":{"x":2}}]'::jsonb)$q$,cA));
  perform t.chk('38: visitas, GPS e historial de precios no se reescriben', coalesce((r->>'aplicados')::int,0)=0, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"pedv","id":"pv1","d":{"n":"PV-1","state":"armado"}}]'::jsonb)$q$,cA));
  perform t.chk('38: un pedido sí cambia de estado', (r->>'aplicados')::int=1, r::text);
  -- borrado
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"hold","id":"h1","d":{},"x":true},{"c":"lblq","id":"lq1","d":{},"x":true}]'::jsonb)$q$,cA));
  perform t.chk('38: tickets en espera y cola de etiquetas se pueden borrar', (r->>'aplicados')::int=2, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"pedv","id":"pv1","d":{},"x":true},{"c":"remv","id":"rm1","d":{},"x":true}]'::jsonb)$q$,cA));
  perform t.chk('38: pedidos y remitos NO se borran', coalesce((r->>'aplicados')::int,0)=0, r::text);
  -- preventista
  r := t.call(uP,'prev@a.com',format($q$select public.sincronizar(%L,'devP','[{"c":"pedv","id":"pv2","d":{}},{"c":"visit","id":"vi2","d":{}},{"c":"cobrr","id":"co2","d":{}},{"c":"gps","id":"g2","d":{}}]'::jsonb)$q$,cA));
  perform t.chk('38: el preventista sube pedidos, visitas, cobranzas y su posición', (r->>'aplicados')::int=4, r::text);
  r := t.call(uP,'prev@a.com',format($q$select public.sincronizar(%L,'devP','[{"c":"ventas","id":"v38","d":{}},{"c":"movs","id":"m38","d":{}},{"c":"prod","id":"p38","d":{}},{"c":"remv","id":"rm38","d":{}},{"c":"tinv","id":"ti38","d":{}},{"c":"cfg","id":"cfg","d":{}}]'::jsonb)$q$,cA));
  perform t.chk('38: el preventista NO escribe ventas, caja, artículos, remitos, inventarios ni configuración', coalesce((r->>'aplicados')::int,0)=0, r::text);
  -- depósito
  r := t.call(uD,'dep@a.com',format($q$select public.sincronizar(%L,'devD','[{"c":"remv","id":"rm3","d":{}},{"c":"tdep","id":"td3","d":{}},{"c":"dstk","id":"p3","d":{}},{"c":"tinv","id":"ti3","d":{}}]'::jsonb)$q$,cA));
  perform t.chk('38: depósito sube remitos, transferencias, stock por depósito e inventarios', (r->>'aplicados')::int=4, r::text);
  r := t.call(uD,'dep@a.com',format($q$select public.sincronizar(%L,'devD','[{"c":"ventas","id":"v39","d":{}},{"c":"movs","id":"m39","d":{}},{"c":"prod","id":"p39","d":{}},{"c":"clientes","id":"c39","d":{}},{"c":"vale","id":"va39","d":{}}]'::jsonb)$q$,cA));
  perform t.chk('38: depósito NO escribe ventas, caja, artículos, clientes ni vales', coalesce((r->>'aplicados')::int,0)=0, r::text);
  -- mostrador y otros roles
  perform t.chk('38: el mostrador arma pedidos, remitos, acopios y tickets en espera', public.rave_puede_escribir('mostrador','pedv','x') and public.rave_puede_escribir('mostrador','remv','x') and public.rave_puede_escribir('mostrador','acop','x') and public.rave_puede_escribir('mostrador','hold','x'));
  perform t.chk('38: el mostrador NO carga vales ni transferencias de depósito', not public.rave_puede_escribir('mostrador','vale','x') and not public.rave_puede_escribir('mostrador','tdep','x'));
  perform t.chk('38: el repartidor suma sólo GPS', public.rave_puede_escribir('repartidor','gps','x') and not public.rave_puede_escribir('repartidor','pedv','x'));
  perform t.chk('38: el contador sigue de sólo lectura', not public.rave_puede_escribir('contador','pedv','x') and public.rave_puede_escribir('contador','audit','x'));
  perform t.chk('38: los roles anteriores no cambian', public.rave_puede_escribir('mostrador','ventas','x') and not public.rave_puede_escribir('mostrador','prod','x') and public.rave_puede_escribir('supervisor','finmov','x') and public.rave_puede_escribir('repartidor','envio','x'));
  -- otro comercio
  r := t.call(uB,'b@b.com',format($q$select public.sincronizar(%L,'devB','[{"c":"pedv","id":"pv9","d":{}}]'::jsonb)$q$,cA));
  perform t.chk('38: otro comercio no escribe pedidos ajenos', r ? 'err' or coalesce((r->>'aplicados')::int,0)=0, r::text);
end $$;
