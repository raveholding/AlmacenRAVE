-- 23-rrhh.sql: colecciones de Recursos Humanos, permisos por rol y escritura única de avisos y cambios de plan
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a';
  uA2 uuid := '00000000-0000-0000-0000-0000000000a2';
  uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid; r jsonb; n int;
begin
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devT31','[{"c":"hrshift","id":"e1:2026-11-10","d":{"empId":"e1","day":"2026-11-10","from":"09:00","to":"17:00"}},{"c":"hrreq","id":"q31","d":{"empId":"e1","type":"vacaciones","state":"pendiente"}},{"c":"hrdoc","id":"d31","d":{"empId":"e1","kind":"dni","name":"DNI"}},{"c":"hrpay","id":"p31","d":{"period":"2026-10","total":100}},{"c":"hrjob","id":"j31","d":{"title":"Vendedor"}},{"c":"hrcand","id":"c31","d":{"jobId":"j31","stage":"recibido"}},{"c":"hritem","id":"i31","d":{"empId":"e1","item":"Remera"}},{"c":"hrmsg","id":"m31","d":{"to":"all","txt":"hola"}},{"c":"hrplan","id":"pl31","d":{"from":"micro","to":"full","active":11}}]'::jsonb)$q$,cA));
  perform t.chk('31: el administrador sincroniza las 9 colecciones de RR. HH.', (r->>'aplicados')::int=9, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devT31','[{"c":"hrplan","id":"pl31","d":{"from":"micro","to":"micro","active":1}}]'::jsonb)$q$,cA));
  perform t.chk('31: un cambio de plan ya registrado no se reescribe', coalesce((r->>'aplicados')::int,0)=0, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devT31','[{"c":"hrmsg","id":"m31","d":{"to":"all","txt":"cambiado"}}]'::jsonb)$q$,cA));
  perform t.chk('31: un aviso ya publicado no se reescribe', coalesce((r->>'aplicados')::int,0)=0, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devT31','[{"c":"hrshift","id":"e1:2026-11-10","x":true,"d":{}}]'::jsonb)$q$,cA));
  perform t.chk('31: un turno se puede borrar', not (r ? 'err'), r::text);
  r := t.call(uA2,'a2@a.com',format($q$select public.sincronizar(%L,'devA2','[{"c":"hrpay","id":"p32","d":{"period":"2026-11"}},{"c":"hrreq","id":"q32","d":{"state":"aprobada"}},{"c":"hrplan","id":"pl32","d":{}}]'::jsonb)$q$,cA));
  perform t.chk('31: el mostrador no escribe nómina, solicitudes ni plan', coalesce((r->>'aplicados')::int,0)=0, r::text);
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.registros where comercio_id=%L and coleccion like 'hr%%'$q$,cA));
  perform t.chk('31: otro comercio no ve los datos de RR. HH. de A', coalesce((r->>'r')::int,(r#>>'{}')::int,0)=0 or r ? 'err', r::text);
  perform t.chk('31: el supervisor puede escribir solicitudes, turnos y avisos', public.rave_puede_escribir('supervisor','hrreq','x') and public.rave_puede_escribir('supervisor','hrshift','x') and public.rave_puede_escribir('supervisor','hrmsg','x'));
  perform t.chk('31: el supervisor no escribe nómina ni plan', not public.rave_puede_escribir('supervisor','hrpay','x') and not public.rave_puede_escribir('supervisor','hrplan','x'));
  perform t.chk('31: operador sin acceso a RR. HH.', not public.rave_puede_escribir('operador','hrreq','x') and not public.rave_puede_escribir('operador','hrdoc','x'));
end $$;
