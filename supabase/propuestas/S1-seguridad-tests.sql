-- Pruebas del esquema propuesto S1 (Postgres local + shim). Usa t.call / t.chk de 10-sql-tests.sql.
\set ON_ERROR_STOP off
do $$
declare uA uuid := '00000000-0000-0000-0000-00000000000a'; uM uuid := '00000000-0000-0000-0000-0000000000a3'; uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid; cB uuid; r jsonb; pid uuid; n int; h1 text; h2 text;
begin
  insert into public.comercios(nombre) values ('Seg A') returning id into cA;
  insert into public.comercios(nombre) values ('Seg B') returning id into cB;
  insert into public.miembros(comercio_id,usuario_id,rol) values (cA,uA,'admin'),(cA,uM,'mostrador'),(cB,uB,'admin') on conflict do nothing;
  perform t.ctxset('sA',cA::text); perform t.ctxset('sB',cB::text);
  r := t.call(uA,'a@a.com',format($q$with x as (insert into public.seg_dispositivos(tenant_id,id,tipo,nombre) values (%L,'d1','puerta','Puerta principal'),(%L,'c1','camara','Entrada') returning 1) select to_jsonb(count(*)) from x$q$,cA,cA));
  perform t.chk('S1 · el admin da de alta puerta y cámara', r::text='2', r::text);
  r := t.call(uA,'a@a.com',format($q$with x as (insert into public.seg_dispositivos(tenant_id,id,tipo,nombre,gateway_url) values (%L,'c9','camara','X','rtsp://admin:clave@10.0.0.9/') returning 1) select to_jsonb(count(*)) from x$q$,cA));
  perform t.chk('S1 · una dirección rtsp:// con usuario y clave se rechaza', r ? 'err', r::text);
  r := t.call(uM,'a3@a.com',format($q$with x as (insert into public.seg_dispositivos(tenant_id,id,tipo,nombre) values (%L,'d2','puerta','Depo') returning 1) select to_jsonb(count(*)) from x$q$,cA));
  perform t.chk('S1 · el mostrador no administra dispositivos', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$with x as (insert into public.seg_reglas values (%L,'visita','d1',0,24) returning 1) select to_jsonb(count(*)) from x$q$,cA));
  perform t.chk('S1 · regla de visitas para la puerta', r::text='1', r::text);
  -- pánico: cualquier miembro, silencioso y crítico aunque pida otra cosa
  r := t.call(uM,'a3@a.com',format($q$select public.seg_registrar_evento(%L,'PANICO','info','{"caja":"1","venta":"1-15","detalle":"desde Vender"}')$q$,cA));
  perform t.chk('S1 · el mostrador registra un pánico', (r->>'ok')='true', r::text);
  select count(*) into n from public.seg_eventos where tenant_id=cA and tipo='PANICO' and silencioso and nivel='crit' and caja='1' and venta_id='1-15';
  perform t.chk('S1 · el pánico queda crítico, silencioso y unido a la caja y la venta', n=1);
  r := t.call(uM,'a3@a.com',format($q$select public.seg_registrar_evento(%L,'PUERTA_ABIERTA','info','{}')$q$,cA));
  perform t.chk('S1 · el mostrador no puede registrar aperturas de puerta', (r->>'ok')='false', r::text);
  r := t.call(uM,'a3@a.com',format($q$select to_jsonb(count(*)) from public.seg_eventos where tenant_id=%L$q$,cA));
  perform t.chk('S1 · el mostrador no lee los eventos de seguridad', r::text='0', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.seg_registrar_evento(%L,'PUERTA_FORZADA','crit','{"puerta":"d1","detalle":"sin credencial"}')$q$,cA));
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(count(*)) from public.seg_eventos where tenant_id=%L$q$,cA));
  perform t.chk('S1 · el admin lee los eventos', r::text='2', r::text);
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.seg_eventos where tenant_id=%L$q$,cA));
  perform t.chk('S1 · el comercio B no ve eventos de A', r::text='0', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.seg_registrar_evento(%L,'PANICO','crit','{}')$q$,cA));
  perform t.chk('S1 · B no puede registrar eventos en A', (r->>'ok')='false', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.seg_registrar_evento(%L,'ACCESO_DENEGADO','alta','{"detalle":"tarjeta 4509953566233704"}')$q$,cA));
  perform t.chk('S1 · un número largo en el detalle se rechaza', r ? 'err', r::text);
  -- sólo agregar y cadena
  r := t.call(uA,'a@a.com',format($q$with x as (update public.seg_eventos set detalle='x' where tenant_id=%L returning 1) select to_jsonb(count(*)) from x$q$,cA));
  perform t.chk('S1 · nadie modifica eventos (ni el admin)', r ? 'err', r::text);
  begin update public.seg_eventos set detalle='x' where tenant_id=cA; perform t.chk('S1 · el trigger impide modificar aun como superusuario',false);
  exception when others then perform t.chk('S1 · el trigger impide modificar aun como superusuario',true); end;
  select hash_prev, (select hash from public.seg_eventos where tenant_id=cA order by ts limit 1) into h1, h2 from public.seg_eventos where tenant_id=cA order by ts desc limit 1;
  perform t.chk('S1 · cadena de hash: cada evento apunta al anterior', h1=h2, h1||' / '||h2);
  -- pases
  r := t.call(uA,'a@a.com',format($q$with x as (insert into public.seg_pases(tenant_id,nombre,motivo,desde,hasta,max_usos,puertas) values (%L,'Proveedor X','entrega',now()-interval '1 minute',now()+interval '2 hours',1,array['d1']) returning id) select to_jsonb(id) from x$q$,cA));
  pid := case when r ? 'err' then null else (r #>> '{}')::uuid end; perform t.chk('S1 · el admin emite un pase', pid is not null, r::text);
  r := t.call(uA,'a@a.com',format($q$with x as (insert into public.seg_pases(tenant_id,nombre,motivo,desde,hasta,puertas) values (%L,'Largo','entrega',now(),now()+interval '9 days',array['d1']) returning 1) select to_jsonb(count(*)) from x$q$,cA));
  perform t.chk('S1 · un pase de más de 7 días se rechaza', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.seg_usar_pase(%L,%L,'d1')$q$,cA,pid));
  perform t.chk('S1 · el pase abre una vez', (r->>'ok')='true', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.seg_usar_pase(%L,%L,'d1')$q$,cA,pid));
  perform t.chk('S1 · el pase de un uso no abre dos veces', (r->>'ok')='false', r::text);
  r := t.call(uA,'a@a.com',format($q$with x as (update public.seg_pases set usos=0 where id=%L returning 1) select to_jsonb(count(*)) from x$q$,pid));
  perform t.chk('S1 · nadie reinicia los usos de un pase', r ? 'err' or r::text='0', r::text);
  -- coacción: huella no legible
  insert into public.seg_coaccion values (cA,uM,repeat('ab',32));
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(count(*)) from public.seg_coaccion where tenant_id=%L$q$,cA));
  perform t.chk('S1 · ni el admin lee las huellas de coacción', r ? 'err' or r::text='0', r::text);
  r := t.call(uM,'a3@a.com',format($q$select to_jsonb(public.seg_coaccion_coincide(%L,%L,%L))$q$,cA,uM,repeat('ab',32)));
  perform t.chk('S1 · la huella se compara en el servidor', r::text='true', r::text);
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(public.seg_coaccion_coincide(%L,%L,%L))$q$,cA,uM,repeat('ab',32)));
  perform t.chk('S1 · otro comercio no puede probar huellas', r::text='false', r::text);
end $$;
select case when ok then 'OK   ' else 'FALLA' end || ' ' || name || coalesce(' · '||left(info,140),'') from t.res where name like 'S1 ·%' order by n;
select count(*) filter (where ok) || ' OK / ' || count(*) filter (where not ok) || ' FALLAN de ' || count(*) from t.res where name like 'S1 ·%';
