-- 15-custodia-google.sql: la API no lee ni escribe la llave en custodia; eventos sólo-agregar y legibles sólo por el admin
\set ON_ERROR_STOP off
do $$
declare uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3'; cA uuid := t.ctxget('cA')::uuid; r jsonb; ok boolean;
begin
  perform t.chk('llaves_custodia con RLS y sin permisos para la API', (select relrowsecurity from pg_class where oid='public.llaves_custodia'::regclass)
    and not has_table_privilege('authenticated','public.llaves_custodia','select') and not has_table_privilege('anon','public.llaves_custodia','select')
    and not has_table_privilege('authenticated','public.llaves_custodia','insert') and not has_table_privilege('authenticated','public.llaves_custodia','update'), '');
  perform t.chk('custodia_eventos: la API no escribe', not has_table_privilege('authenticated','public.custodia_eventos','insert') and not has_table_privilege('anon','public.custodia_eventos','select'), '');
  insert into public.llaves_custodia(comercio_id,wrap) values (cA,'{"v":1,"iv":"x","ct":"y"}') on conflict (comercio_id) do nothing;
  insert into public.custodia_eventos(comercio_id,usuario_id,accion,detalle) values (cA,uA,'CUSTODIA_ENTREGA','prueba');
  r := t.call(uA,'a@a.com',format('select coalesce(jsonb_agg(accion),''[]'') from public.custodia_eventos where comercio_id=%L',cA));
  perform t.chk('el administrador ve el historial de entregas', r::text like '%CUSTODIA_ENTREGA%', r::text);
  r := t.call(uA3,'a3@a.com',format('select coalesce(jsonb_agg(accion),''[]'') from public.custodia_eventos where comercio_id=%L',cA));
  perform t.chk('un mostrador no ve el historial', r::text not like '%CUSTODIA_ENTREGA%', r::text);
  begin update public.custodia_eventos set accion='CAMBIADO' where comercio_id=cA; ok := false; exception when others then ok := true; end;
  perform t.chk('custodia_eventos es sólo-agregar (UPDATE rechazado)', ok, '');
  begin insert into public.llaves_custodia(comercio_id,wrap) values (gen_random_uuid(),'{"x":1}'); ok := false; exception when others then ok := true; end;
  perform t.chk('sobre mal formado rechazado', ok, '');
  delete from public.llaves_custodia where comercio_id=cA;
end $$;
