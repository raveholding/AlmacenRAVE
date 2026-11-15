-- 32-licencias.sql: licencia por comercio, staff de Vincular Business, vb_version() = 32
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uB uuid := '00000000-0000-0000-0000-00000000000b';
  uV uuid := '00000000-0000-0000-0000-0000000000f1'; cA uuid := t.ctxget('cA')::uuid; r jsonb;
begin
  insert into public.vb_staff(email) values ('vb@vb.com') on conflict do nothing;
  r := t.call(uA,'a@a.com',$q$select to_jsonb(public.vb_version())$q$);
  perform t.chk('40: vb_version() >= 32', r::text::int>=32, r::text);
  perform t.chk('40: el staff inicial es vincularbusiness', exists(select 1 from public.vb_staff where email='vincularbusiness@gmail.com'));
  delete from public.licencias where comercio_id = cA;
  r := t.call(uA,'a@a.com',format($q$select coalesce(public.mi_licencia(%L),'"nada"'::jsonb)$q$,cA));
  perform t.chk('40: sin licencia cargada no hay restricción (null)', r::text='"nada"', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.mi_licencia(%L)$q$,cA));
  perform t.chk('40: otro comercio no ve la licencia ajena', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.vb_licencia_set(%L,'total','{ventas}','activa',current_date+30)$q$,cA));
  perform t.chk('40: el admin del comercio no se asigna licencia', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',$q$select public.vb_comercios_listar()$q$);
  perform t.chk('40: el admin del comercio no lista comercios', r ? 'err', r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'profesional','{ventas,digital,ventas}','activa',current_date+30)$q$,cA));
  perform t.chk('40: Vincular Business asigna plan y paquetes (sin duplicados)', r->>'estado'='activa' and r->'paquetes'='["digital","ventas"]'::jsonb and (r->>'dias')::int=30, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.mi_licencia(%L)$q$,cA));
  perform t.chk('40: el comercio lee su licencia', r->>'plan'='profesional', r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'total','{ventas,cohetes}','activa',null)$q$,cA));
  perform t.chk('40: paquete inexistente rechazado', r->>'err' like 'paquete inválido%', r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'premium','{}','activa',null)$q$,cA));
  perform t.chk('40: plan inexistente rechazado', r ? 'err', r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'total','{}','activa',current_date-3,7)$q$,cA));
  perform t.chk('40: vencida dentro de la gracia = gracia', r->>'estado'='gracia' and (r->>'dias')::int=-3, r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'total','{}','activa',current_date-10,7)$q$,cA));
  perform t.chk('40: pasada la gracia = vencida', r->>'estado'='vencida', r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'total','{}','suspendida',current_date+30)$q$,cA));
  perform t.chk('40: suspendida manda sobre la fecha', r->>'estado'='suspendida', r::text);
  r := t.call(uV,'vb@vb.com',$q$select public.vb_comercios_listar()$q$);
  perform t.chk('40: Vincular Business lista comercios con licencia', jsonb_typeof(r)='array' and exists(select 1 from jsonb_array_elements(r) e where e->>'id'=cA::text and e->'licencia'->>'estado'='suspendida'), left(r::text,200));
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_quitar(%L)$q$,cA));
  r := t.call(uA,'a@a.com',format($q$select coalesce(public.mi_licencia(%L),'"nada"'::jsonb)$q$,cA));
  perform t.chk('40: quitar la licencia vuelve a sin restricción', r::text='"nada"', r::text);
  perform t.chk('40: nadie lee las tablas directo', not has_table_privilege('authenticated','public.licencias','select') and not has_table_privilege('anon','public.vb_staff','select'));
  delete from public.vb_staff where email='vb@vb.com';
end $$;
