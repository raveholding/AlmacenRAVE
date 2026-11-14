-- 27-finanzas-contable.sql: rol contador (sólo lectura), asientos y cierres inmutables, plan de cuentas, compromisos y conciliación
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uB uuid := '00000000-0000-0000-0000-00000000000b';
  uC uuid := '00000000-0000-0000-0000-0000000000c7';
  cA uuid := t.ctxget('cA')::uuid; r jsonb;
begin
  insert into auth.users(id,email) values (uC,'conta@a.com') on conflict do nothing;
  insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uC,'contador','conta@a.com','Estudio') on conflict (comercio_id,usuario_id) do update set rol='contador';
  perform t.chk('35: existe el rol contador', exists(select 1 from public.miembros where usuario_id=uC and rol='contador'));
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(true) from (select public.cambiar_rol(%L,%L,'contador')) x$q$, cA, uC));
  perform t.chk('35: el admin puede asignar el rol contador', not (r ? 'err'), r::text);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(true) from (select public.cambiar_rol(%L,%L,'auditor')) x$q$, cA, uC));
  perform t.chk('35: un rol inventado sigue rechazado', r ? 'err', r::text);
  perform t.chk('35: el repartidor sigue existiendo', public.rave_puede_escribir('repartidor','envio','x'));
  -- el admin contabiliza
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"asiento","id":"AS-v-35","d":{"f":"2026-11-01","l":[{"c":"1.1.01","d":100,"h":0},{"c":"4.1.01","d":0,"h":100}],"h":"abc"}},{"c":"cierrec","id":"2026-10","d":{"h":"x"}},{"c":"finiva","id":"rc35","d":{"iva":21}},{"c":"pcta","id":"1.1.01","d":{"name":"Caja"}},{"c":"fincmp","id":"fc35","d":{"amount":100}},{"c":"finrec","id":"fr35","d":{"imp":5,"__pii":"x"}}]'::jsonb)$q$,cA));
  perform t.chk('35: el admin sincroniza asientos, cierres, IVA de compras, plan, compromisos y conciliación', (r->>'aplicados')::int=6, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"asiento","id":"AS-v-35","d":{"f":"2026-11-01","l":[{"c":"1.1.01","d":999,"h":0}],"h":"zzz"}}]'::jsonb)$q$,cA));
  perform t.chk('35: un asiento no se reescribe (ni el administrador)', coalesce((r->>'aplicados')::int,0)=0 and (select datos->>'h' from public.registros where comercio_id=cA and coleccion='asiento' and id='AS-v-35')='abc', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"cierrec","id":"2026-10","d":{"h":"y"}}]'::jsonb)$q$,cA));
  perform t.chk('35: un cierre de período no se reescribe', coalesce((r->>'aplicados')::int,0)=0, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"asiento","id":"AS-v-35","x":true},{"c":"cierrec","id":"2026-10","x":true}]'::jsonb)$q$,cA));
  perform t.chk('35: asientos y cierres no se borran', coalesce((r->>'aplicados')::int,0)=0 and exists(select 1 from public.registros where comercio_id=cA and coleccion='asiento' and id='AS-v-35'), r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"fincmp","id":"fc35","x":true},{"c":"finrec","id":"fr35","x":true}]'::jsonb)$q$,cA));
  perform t.chk('35: compromisos y renglones del extracto sí se pueden quitar', (r->>'aplicados')::int=2, r::text);
  -- el contador sólo lee
  r := t.call(uC,'conta@a.com',format($q$select public.sincronizar(%L,'devC','[{"c":"asiento","id":"AS-x-35","d":{}},{"c":"cierrec","id":"2026-09","d":{}},{"c":"pcta","id":"9.9","d":{}},{"c":"ventas","id":"v35","d":{"total":1}},{"c":"movs","id":"m35","d":{}},{"c":"cfg","id":"cfg","d":{}},{"c":"fincmp","id":"fc36","d":{}}]'::jsonb)$q$,cA));
  perform t.chk('35: el contador NO escribe asientos, cierres, plan, ventas, caja, configuración ni compromisos', coalesce((r->>'aplicados')::int,0)=0, r::text);
  r := t.call(uC,'conta@a.com',format($q$select public.sincronizar(%L,'devC','[{"c":"audit","id":"au35","d":{"action":"CONTABILIDAD_EXPORT"}}]'::jsonb)$q$,cA));
  perform t.chk('35: el contador deja registro de sus exportaciones (audit)', (r->>'aplicados')::int=1, r::text);
  r := t.call(uC,'conta@a.com',format($q$select to_jsonb(count(*)) from public.registros where comercio_id=%L and coleccion='asiento'$q$,cA));
  perform t.chk('35: el contador lee los asientos de su comercio', coalesce((r#>>'{}')::int,0)>=1, r::text);
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.registros where comercio_id=%L and coleccion='asiento'$q$,cA));
  perform t.chk('35: otro comercio no ve los asientos de A', coalesce((r#>>'{}')::int,0)=0 or r ? 'err', r::text);
  perform t.chk('35: mostrador, operador y repartidor no contabilizan', not public.rave_puede_escribir('mostrador','asiento','x') and not public.rave_puede_escribir('operador','pcta','x') and not public.rave_puede_escribir('repartidor','finrec','x'));
  perform t.chk('35: el supervisor puede (si el administrador le da el permiso en el sistema)', public.rave_puede_escribir('supervisor','asiento','x') and public.rave_puede_escribir('supervisor','fincmp','x'));
  perform t.chk('35: los roles anteriores no cambian', public.rave_puede_escribir('mostrador','ventas','x') and public.rave_puede_escribir('supervisor','rendrep','x') and not public.rave_puede_escribir('mostrador','prod','x'));
  perform t.chk('35: un rol desconocido no escribe nada', not coalesce(public.rave_puede_escribir('auditor','audit','x'),false));
end $$;
