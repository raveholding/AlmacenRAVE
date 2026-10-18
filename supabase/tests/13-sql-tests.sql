-- V26 · 06-v26.sql: eliminación protegida de artículos, cajas/sucursales y traspasos
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000c1','sup@a.com') on conflict do nothing;
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3';
  uB uuid := '00000000-0000-0000-0000-00000000000b'; uS uuid := '00000000-0000-0000-0000-0000000000c1';
  cA uuid := t.ctxget('cA')::uuid; cB uuid := t.ctxget('cB')::uuid;
  r jsonb; n int; sync text := $q$select public.sincronizar(%L,'dev1',%L::jsonb)$q$;
begin
  insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uS,'supervisor','sup@a.com','Sup') on conflict (comercio_id,usuario_id) do update set rol='supervisor';
  insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uA3,'mostrador','a3@a.com','Most') on conflict (comercio_id,usuario_id) do update set rol='mostrador';
  -- ===== artículos =====
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"prod","id":"pv1","d":{"name":"Sin historial","price":100}},{"c":"prod","id":"pv2","d":{"name":"Con ventas","price":100}},{"c":"prod","id":"pv3","d":{"name":"Con ajustes","price":100}},{"c":"prod","id":"pv4","d":{"name":"Stock inicial","price":100}}]'));
  perform t.chk('admin crea artículos de prueba', (r->>'aplicados')='4', r::text);
  perform t.call(uA,'a@a.com',format(sync,cA,'[{"c":"smov","id":"v26m1","d":{"pid":"pv3","d":10}},{"c":"smov","id":"v26m2","d":{"pid":"pv3","d":-1}},{"c":"smov","id":"v26m3","d":{"pid":"pv4","d":5}}]'));
  perform t.call(uA,'a@a.com',format(sync,cA,'[{"c":"ventas","id":"vx1","d":{"n":"1-1","total":100,"items":[{"pid":"pv2","qty":1,"price":100}]}}]'));
  -- vista previa
  r := t.call(uA,'a@a.com',format($q$select jsonb_object_agg(id, to_jsonb(x)) from public.inventario_vista_previa_borrado(%L, array['pv1','pv2','pv3','pv4','nada']) x$q$, cA));
  perform t.chk('vista previa: sin historial = eliminable', r->'pv1'->>'estado'='eliminable', r::text);
  perform t.chk('vista previa: con venta = archivable', r->'pv2'->>'estado'='archivable' and r->'pv2'->>'motivo' like '%1 venta%', r::text);
  perform t.chk('vista previa: con ajustes = archivable', r->'pv3'->>'estado'='archivable', r::text);
  perform t.chk('vista previa: sólo saldo inicial = eliminable', r->'pv4'->>'estado'='eliminable', r::text);
  perform t.chk('vista previa: inexistente', r->'nada'->>'estado'='inexistente', r::text);
  r := t.call(uS,'sup@a.com',format($q$select to_jsonb(count(*)) from public.inventario_vista_previa_borrado(%L, array['pv1'])$q$, cA));
  perform t.chk('el supervisor NO usa la vista previa de eliminación', r ? 'err', r::text);
  r := t.call(uA3,'a3@a.com',format($q$select to_jsonb(count(*)) from public.inventario_vista_previa_borrado(%L, array['pv1'])$q$, cA));
  perform t.chk('el mostrador NO usa la vista previa de eliminación', r ? 'err', r::text);
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.inventario_vista_previa_borrado(%L, array['pv1'])$q$, cA));
  perform t.chk('el admin de B NO ve artículos de A', r ? 'err', r::text);
  -- borrado
  r := t.call(uS,'sup@a.com',format(sync,cA,'[{"c":"prod","id":"pv1","d":{},"x":true}]'));
  perform t.chk('supervisor NO elimina artículos (API directa)', (r->>'aplicados')='0' and r::text like '%sólo el administrador elimina%', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"prod","id":"pv1","d":{},"x":true}]'));
  perform t.chk('mostrador NO elimina artículos (API directa)', (r->>'aplicados')='0', r::text);
  perform t.chk('el artículo sigue ahí', (select not borrado from public.registros where comercio_id=cA and coleccion='prod' and id='pv1'));
  r := t.call(uB,'b@b.com',format(sync,cA,'[{"c":"prod","id":"pv1","d":{},"x":true}]'));
  perform t.chk('admin de OTRO comercio NO elimina', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"prod","id":"pv2","d":{},"x":true}]'));
  perform t.chk('artículo con ventas: el admin tampoco lo borra', (r->>'aplicados')='0' and r::text like '%no se elimina%', r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"prod","id":"pv3","d":{},"x":true}]'));
  perform t.chk('artículo con movimientos: no se borra', (r->>'aplicados')='0', r::text);
  perform t.chk('pv2 y pv3 siguen vivos', (select count(*) from public.registros where comercio_id=cA and coleccion='prod' and id in ('pv2','pv3') and not borrado)=2);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"prod","id":"pv1","d":{},"x":true},{"c":"prod","id":"pv4","d":{},"x":true},{"c":"prod","id":"pv2","d":{},"x":true}]'));
  perform t.chk('lote mixto: elimina los limpios y rechaza el resto', (r->>'aplicados')='2' and jsonb_array_length(r->'rechazos')=1, r::text);
  perform t.chk('pv1 y pv4 eliminados', (select count(*) from public.registros where comercio_id=cA and coleccion='prod' and id in ('pv1','pv4') and borrado)=2);
  perform t.chk('queda auditoría de servidor de cada eliminación', (select count(*) from public.registros where comercio_id=cA and coleccion='audit' and datos->>'action'='INV_ELIMINAR_SERVIDOR')=2);
  -- archivar / restaurar
  r := t.call(uS,'sup@a.com',format(sync,cA,'[{"c":"prod","id":"pv2","d":{"name":"Con ventas","price":100,"archived":true,"active":false}}]'));
  perform t.chk('supervisor NO archiva', (r->>'aplicados')='0' and r::text like '%sólo el administrador archiva%', r::text);
  r := t.call(uS,'sup@a.com',format(sync,cA,'[{"c":"prod","id":"pv2","d":{"name":"Con ventas","price":150}}]'));
  perform t.chk('supervisor SÍ edita precio (sin archivar)', (r->>'aplicados')='1', r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"prod","id":"pv2","d":{"name":"Con ventas","price":150,"archived":true,"active":false}}]'));
  perform t.chk('admin archiva', (r->>'aplicados')='1', r::text);
  r := t.call(uS,'sup@a.com',format(sync,cA,'[{"c":"prod","id":"pv2","d":{"name":"Con ventas","price":150,"archived":false,"active":true}}]'));
  perform t.chk('supervisor NO restaura', (r->>'aplicados')='0', r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"prod","id":"pv2","d":{"name":"Con ventas","price":150,"archived":false,"active":true}}]'));
  perform t.chk('admin restaura', (r->>'aplicados')='1', r::text);
  perform t.chk('la venta histórica sigue intacta', (select count(*) from public.registros where comercio_id=cA and coleccion='ventas' and id='vx1' and not borrado)=1);
  begin insert into public.registros(comercio_id,coleccion,id) values (cA,'prod','hack'); perform t.chk('escritura directa en registros (rol postgres de prueba)', true); exception when others then null; end;
  -- ===== cajas / sucursales / traspasos =====
  r := t.call(uS,'sup@a.com',format(sync,cA,'[{"c":"cajas","id":"cj1","d":{"name":"Caja 1","type":"operational"}}]'));
  perform t.chk('supervisor NO crea cajas', (r->>'aplicados')='0', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"sucs","id":"s1","d":{"name":"Centro"}}]'));
  perform t.chk('mostrador NO crea sucursales', (r->>'aplicados')='0', r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"rubros","id":"r1","d":{"name":"Varios","kind":"rubro"}},{"c":"cajas","id":"cj1","d":{"name":"Caja 1","type":"operational"}},{"c":"cajas","id":"cj2","d":{"name":"Principal","type":"main"}},{"c":"sucs","id":"s1","d":{"name":"Centro"}},{"c":"cajas","id":"cjx","d":{"type":"operational"}}]'));
  perform t.chk('admin crea rubro, cajas y sucursal; sin nombre se rechaza', (r->>'aplicados')='4' and jsonb_array_length(r->'rechazos')=1, r::text);
  r := t.call(uS,'sup@a.com',format(sync,cA,'[{"c":"ctransf","id":"tr1","d":{"from":"cj1","to":"cj2","amount":50000,"rubro":"r1"}}]'));
  perform t.chk('en modo simple el traspaso se rechaza (módulo deshabilitado)', (r->>'aplicados')='0' and r::text like '%no está habilitado%', r::text);
  perform t.call(uA,'a@a.com',format(sync,cA,'[{"c":"cfg","id":"cfg","d":{"cashProfile":"main"}}]'));
  r := t.call(uS,'sup@a.com',format(sync,cA,'[{"c":"ctransf","id":"tr1","d":{"from":"cj1","to":"cj2","amount":50000,"rubro":"r1"}}]'));
  perform t.chk('con perfil caja principal el supervisor traspasa', (r->>'aplicados')='1', r::text);
  r := t.call(uS,'sup@a.com',format(sync,cA,'[{"c":"ctransf","id":"tr1","d":{"from":"cj1","to":"cj2","amount":99999,"rubro":"r1"}}]'));
  perform t.chk('reenviar el mismo traspaso no lo duplica ni lo cambia', (r->>'omitidos')='1' and (select (datos->>'amount')::int from public.registros where comercio_id=cA and coleccion='ctransf' and id='tr1')=50000, r::text);
  r := t.call(uS,'sup@a.com',format(sync,cA,'[{"c":"ctransf","id":"tr2","d":{"from":"cj1","to":"cj1","amount":100,"rubro":"r1"}},{"c":"ctransf","id":"tr3","d":{"from":"cj1","to":"cj2","amount":0,"rubro":"r1"}},{"c":"ctransf","id":"tr4","d":{"from":"cj1","to":"cj2","amount":10.5,"rubro":"r1"}},{"c":"ctransf","id":"tr5","d":{"from":"cj1","to":"cj2","amount":100,"rubro":""}},{"c":"ctransf","id":"tr6","d":{"from":"cj1","to":"cj2","amount":100,"rubro":"noexiste"}},{"c":"ctransf","id":"tr7","d":{"from":"cj1","to":"cjZ","amount":100,"rubro":"r1"}},{"c":"ctransf","id":"tr8","d":{"from":"cj1","to":"cj2","amount":"100","rubro":"r1"}}]'));
  perform t.chk('traspasos inválidos (misma caja, 0, decimal, sin rubro, rubro ajeno, caja inexistente, importe texto) se rechazan', (r->>'aplicados')='0' and jsonb_array_length(r->'rechazos')=7, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ctransf","id":"tr9","d":{"from":"cj1","to":"cj2","amount":100,"rubro":"r1"}}]'));
  perform t.chk('el mostrador NO traspasa fondos', (r->>'aplicados')='0', r::text);
  r := t.call(uB,'b@b.com',format(sync,cB,'[{"c":"ctransf","id":"trB","d":{"from":"cj1","to":"cj2","amount":100,"rubro":"r1"}}]'));
  perform t.chk('comercio B no puede traspasar usando cajas/rubros de A', r ? 'err' or (r->>'aplicados')='0', r::text);
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.bajar(%L,null,500) where coleccion in ('cajas','sucs','ctransf')$q$, cA));
  perform t.chk('B no puede leer cajas/traspasos de A', r ? 'err', r::text);
end $$;
