-- 18-telegram.sql: R2AVE en Telegram (sólo administradores, vinculación, límites, dos pasos, smov + Auditoría)
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3'; uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid; cB uuid := (select comercio_id from public.miembros where usuario_id='00000000-0000-0000-0000-00000000000b' limit 1);
  r jsonb; rol3 text; cod text; pid text; s numeric; n int; tgA bigint := 7001; tgX bigint := 7999;
  SV text := 'service_role';
begin
  -- permisos de ejecución
  perform t.chk('18: el navegador NO puede ejecutar tg_srv_ajustar', not has_function_privilege('authenticated','public.tg_srv_ajustar(uuid,bigint,text)','execute'));
  perform t.chk('18: anon NO puede ejecutar tg_srv_datos', not has_function_privilege('anon','public.tg_srv_datos(uuid,text,bigint,int)','execute'));
  perform t.chk('18: el servidor (service_role) SÍ puede', has_function_privilege('service_role','public.tg_srv_ajustar(uuid,bigint,text)','execute'));
  perform t.chk('18: el navegador no lee la tabla de vínculos', not has_table_privilege('authenticated','public.tg_vinculos','select'));
  -- roles de prueba
  select rol into rol3 from public.miembros where comercio_id=cA and usuario_id=uA3;
  if rol3 is null then insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uA3,'mostrador','a3@a.com','Caja TG'); end if;
  update public.miembros set rol='mostrador' where comercio_id=cA and usuario_id=uA3;
  update public.miembros set rol='admin' where comercio_id=cA and usuario_id=uA;
  -- producto de prueba (12 u, costo $1.000)
  pid := 'tgp1';
  insert into public.registros(comercio_id,coleccion,id,datos) values (cA,'prod',pid,'{"id":"tgp1","name":"Coca-Cola","sub":"2,25 L","stock":12,"cost":100000,"price":250000,"unit":"u","active":true}')
    on conflict (comercio_id,coleccion,id) do update set datos=excluded.datos, borrado=false;
  -- configuración: sólo el administrador
  r := t.call(uA3,'a3@a.com',format($q$select public.tg_admin_estado(%L)$q$,cA));
  perform t.chk('18: un mostrador NO ve la configuración del bot', r ? 'err', r::text);
  r := t.call(uA3,'a3@a.com',format($q$select public.tg_codigo_crear(%L)$q$,cA));
  perform t.chk('18: un mostrador NO puede vincular su Telegram (sólo administradores)', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.tg_admin_estado(%L)$q$,cA));
  perform t.chk('18: el administrador ve el estado; arranca apagado y sin correcciones', (r->>'activo')::boolean=false and (r->>'ajuste_on')::boolean=false and (r->>'max_unidades')::numeric=24 and (r->>'max_valor')::bigint=5000000 and (r->>'max_dia')::int=10, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.tg_admin_guardar(%L,'{"activo":true,"horas":3}')$q$,cA));
  perform t.chk('18: horas inválidas (3) → rechazado', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.tg_admin_guardar(%L,'{"activo":true,"alertas":true}')$q$,cA));
  perform t.chk('18: el administrador enciende el bot', (r->>'activo')::boolean, r::text);
  perform t.chk('18: queda en Auditoría', exists(select 1 from public.registros where comercio_id=cA and coleccion='audit' and datos->>'action'='TELEGRAM_CONFIG'));
  -- vinculación con código de un solo uso
  r := t.call(uA,'a@a.com',format($q$select public.tg_codigo_crear(%L)$q$,cA)); cod := r->>'codigo';
  perform t.chk('18: código de 8 caracteres', cod ~ '^[A-HJ-NP-Z2-9]{8}$', cod);
  perform t.chk('18: en la base se guarda sólo el hash', not exists(select 1 from public.tg_codigos where hash=cod) and exists(select 1 from public.tg_codigos where hash=encode(sha256(convert_to(cod,'UTF8')),'hex')));
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_vincular(%L,%s,'nico','%s')$q$,cA,tgA,cod));
  perform t.chk('18: el navegador no puede llamar a tg_srv_vincular', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_vincular(%L,%s,'nico','XXXXXXXX')$q$,cA,tgA),SV);
  perform t.chk('18: código incorrecto → no vincula', (r->>'ok')::boolean=false, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_vincular(%L,%s,'nico','%s')$q$,cA,tgA,lower(cod)),SV);
  perform t.chk('18: código correcto (sin importar mayúsculas) → vincula al administrador', (r->>'ok')::boolean, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_vincular(%L,%s,'otro','%s')$q$,cA,tgX,cod),SV);
  perform t.chk('18: el mismo código no sirve dos veces', (r->>'ok')::boolean=false, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.tg_codigo_crear(%L)$q$,cA)); cod := r->>'codigo';
  update public.tg_codigos set vence=now()-interval '1 second' where hash=encode(sha256(convert_to(cod,'UTF8')),'hex');
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_vincular(%L,%s,'otro','%s')$q$,cA,tgX,cod),SV);
  perform t.chk('18: código vencido → no vincula', (r->>'ok')::boolean=false and r->>'why' like '%venció%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_quien(%L,%s)$q$,cA,tgA),SV);
  perform t.chk('18: quién es: administrador vinculado', (r->>'ok')::boolean and r->>'rol'='admin', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_quien(%L,%s)$q$,cA,tgX),SV);
  perform t.chk('18: Telegram desconocido → no autorizado', (r->>'ok')::boolean=false, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_quien(%L,%s)$q$,cB,tgA),SV);
  perform t.chk('18: el vínculo no sirve para otro comercio', (r->>'ok')::boolean=false, r::text);
  -- datos: lista cerrada y sin datos personales
  insert into public.registros(comercio_id,coleccion,id,datos) values (cA,'clientes','tgc1','{"id":"tgc1","num":7,"limit":100000,"pii":{"iv":"x","ct":"SECRETO"},"name":"NO-DEBERIA"}')
    on conflict (comercio_id,coleccion,id) do update set datos=excluded.datos;
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_datos(%L,'clientes',0,100)$q$,cA),SV);
  perform t.chk('18: clientes: sólo número y límite, nunca nombre ni datos cifrados', r::text like '%"num": 7%' and r::text not like '%NO-DEBERIA%' and r::text not like '%SECRETO%', left(r::text,200));
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_datos(%L,'audit',0,100)$q$,cA),SV);
  perform t.chk('18: colección fuera de la lista → rechazada', r ? 'err', r::text);
  -- corrección de stock: apagada
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_pendiente(%L,%s,%L,'{"tipo":"ajuste","pid":"tgp1","fisico":18,"motivo":"conteo físico"}'))$q$,cA,tgA,uA),SV);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,r#>>'{}'),SV);
  perform t.chk('18: con las correcciones apagadas → rechazada', (r->>'ok')::boolean=false and r->>'why' like '%apagadas%', r::text);
  perform t.chk('18: …y el stock sigue en 12', (select (datos->>'stock')::numeric from public.registros where comercio_id=cA and coleccion='prod' and id=pid)=12);
  -- se habilitan por 1 hora
  r := t.call(uA,'a@a.com',format($q$select public.tg_admin_guardar(%L,'{"horas":1}')$q$,cA));
  perform t.chk('18: correcciones habilitadas por 1 h', (r->>'ajuste_on')::boolean, r::text);
  -- otra persona no confirma
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_pendiente(%L,%s,%L,'{"tipo":"ajuste","pid":"tgp1","fisico":18,"motivo":"conteo físico"}'))$q$,cA,tgA,uA),SV);
  cod := r#>>'{}';
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgX,cod),SV);
  perform t.chk('18: otra persona no puede confirmar', (r->>'ok')::boolean=false and r->>'why' like '%Sólo la persona%', r::text);
  -- confirmación válida 12 → 18
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,cod),SV);
  perform t.chk('18: corrección 12 → 18 (+6)', (r->>'ok')::boolean and (r->>'d')::numeric=6 and (r->>'nuevo')::numeric=18, r::text);
  perform t.chk('18: el producto en la nube queda en 18', (select (datos->>'stock')::numeric from public.registros where comercio_id=cA and coleccion='prod' and id=pid)=18);
  perform t.chk('18: hay un smov de +6 con dev=telegram', exists(select 1 from public.registros where comercio_id=cA and coleccion='smov' and id='tg-'||cod and (datos->>'d')::numeric=6 and datos->>'dev'='telegram'));
  perform t.chk('18: Auditoría AJUSTE_STOCK [R2AVE Telegram]', exists(select 1 from public.registros where comercio_id=cA and coleccion='audit' and datos->>'action'='AJUSTE_STOCK' and datos->>'detail' like '%(12 → 18)%R2AVE Telegram%'));
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,cod),SV);
  perform t.chk('18: confirmar dos veces → una sola corrección', (r->>'ya')::boolean and (select (datos->>'stock')::numeric from public.registros where comercio_id=cA and coleccion='prod' and id=pid)=18, r::text);
  -- límites
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_pendiente(%L,%s,%L,'{"tipo":"ajuste","pid":"tgp1","fisico":43,"motivo":"conteo físico"}'))$q$,cA,tgA,uA),SV);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,r#>>'{}'),SV);
  perform t.chk('18: diferencia de 25 (máx. 24) → rechazada', (r->>'ok')::boolean=false and r->>'why' like '%supera el máximo%', r::text);
  update public.registros set datos=jsonb_set(datos,'{cost}','300000') where comercio_id=cA and coleccion='prod' and id=pid;
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_pendiente(%L,%s,%L,'{"tipo":"ajuste","pid":"tgp1","fisico":1,"motivo":"conteo físico"}'))$q$,cA,tgA,uA),SV);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,r#>>'{}'),SV);
  perform t.chk('18: 17 u × $3.000 = $51.000 a costo (máx. $50.000) → rechazada', (r->>'ok')::boolean=false and r->>'why' like '%vale $51000%', r::text);
  update public.registros set datos=jsonb_set(datos,'{cost}','100000') where comercio_id=cA and coleccion='prod' and id=pid;
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_pendiente(%L,%s,%L,'{"tipo":"ajuste","pid":"tgp1","fisico":1.5,"motivo":"conteo físico"}'))$q$,cA,tgA,uA),SV);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,r#>>'{}'),SV);
  perform t.chk('18: 1,5 en un artículo por unidad → rechazada', (r->>'ok')::boolean=false and r->>'why' like '%enteras%', r::text);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_pendiente(%L,%s,%L,'{"tipo":"ajuste","pid":"tgp1","fisico":-1,"motivo":"conteo físico"}'))$q$,cA,tgA,uA),SV);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,r#>>'{}'),SV);
  perform t.chk('18: cantidad negativa → rechazada', (r->>'ok')::boolean=false, r::text);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_pendiente(%L,%s,%L,'{"tipo":"ajuste","pid":"tgp1","fisico":17,"motivo":"conteo"}'))$q$,cA,tgA,uA),SV);
  cod := r#>>'{}'; update public.tg_pendientes set vence=now()-interval '1 second' where id=cod;
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,cod),SV);
  perform t.chk('18: confirmar después de 5 minutos → rechazada', (r->>'ok')::boolean=false and r->>'why' like '%5 minutos%', r::text);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_pendiente(%L,%s,%L,'{"tipo":"ajuste","pid":"tgp1","fisico":17,"motivo":"conteo"}'))$q$,cA,tgA,uA),SV);
  cod := r#>>'{}';
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_cancelar(%L,%s,%L))$q$,cA,tgA,cod),SV);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,cod),SV);
  perform t.chk('18: cancelada → no se puede confirmar', (r->>'ok')::boolean=false and r->>'why' like '%cancelado%', r::text);
  -- selección de artículo: tomar consume (una vez, sólo la misma persona) y no se puede confirmar como ajuste
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_pendiente(%L,%s,%L,'{"tipo":"elegir","cands":["tgp1"],"fisico":17,"motivo":"conteo"}'))$q$,cA,tgA,uA),SV);
  cod := r#>>'{}';
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,cod),SV);
  perform t.chk('18: una selección no se confirma como corrección', (r->>'ok')::boolean=false, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_tomar(%L,%s,%L)$q$,cA,tgX,cod),SV);
  perform t.chk('18: otra persona no toma la selección', r is null or jsonb_typeof(r)='null', coalesce(r::text,'null'));
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_tomar(%L,%s,%L)$q$,cA,tgA,cod),SV);
  perform t.chk('18: tomar la selección devuelve los candidatos', r->'cands'->>0='tgp1', coalesce(r::text,'null'));
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_tomar(%L,%s,%L)$q$,cA,tgA,cod),SV);
  perform t.chk('18: …y una sola vez', r is null or jsonb_typeof(r)='null', coalesce(r::text,'null'));
  -- combos: no se corrigen
  insert into public.registros(comercio_id,coleccion,id,datos) values (cA,'prod','tgk1','{"id":"tgk1","name":"Combo","unit":"u","stock":0,"cost":0,"kit":[{"pid":"tgp1","qty":2}]}')
    on conflict (comercio_id,coleccion,id) do update set datos=excluded.datos;
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_pendiente(%L,%s,%L,'{"tipo":"ajuste","pid":"tgk1","fisico":3,"motivo":"conteo"}'))$q$,cA,tgA,uA),SV);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,r#>>'{}'),SV);
  perform t.chk('18: un combo no se corrige por Telegram', (r->>'ok')::boolean=false and r->>'why' like '%combo%', r::text);
  -- máximo por día
  update public.tg_config set max_dia=1 where comercio_id=cA;
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.tg_srv_pendiente(%L,%s,%L,'{"tipo":"ajuste","pid":"tgp1","fisico":17,"motivo":"conteo"}'))$q$,cA,tgA,uA),SV);
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_ajustar(%L,%s,%L)$q$,cA,tgA,r#>>'{}'),SV);
  perform t.chk('18: más correcciones que el máximo del día → rechazada', (r->>'ok')::boolean=false and r->>'why' like '%correcciones hoy%', r::text);
  update public.tg_config set max_dia=10 where comercio_id=cA;
  -- dejar de ser administrador desvincula
  update public.miembros set rol='supervisor' where comercio_id=cA and usuario_id=uA;
  r := t.call(uA,'a@a.com',format($q$select public.tg_srv_quien(%L,%s)$q$,cA,tgA),SV);
  perform t.chk('18: si deja de ser administrador, el bot deja de responderle', (r->>'ok')::boolean=false and not exists(select 1 from public.tg_vinculos where comercio_id=cA and tg_user_id=tgA and activo), r::text);
  update public.miembros set rol='admin' where comercio_id=cA and usuario_id=uA;
  -- IA: tope diario
  update public.tg_config set ia=true, ia_max_dia=2 where comercio_id=cA; delete from public.tg_ia_uso where comercio_id=cA;
  perform t.chk('18: IA: 1.ª y 2.ª consulta permitidas, 3.ª no', public.tg_srv_ia(cA) and public.tg_srv_ia(cA) and not public.tg_srv_ia(cA));
  -- updates repetidos y alertas sin repetir
  perform t.chk('18: update_id nuevo → true; repetido → false', public.tg_srv_update(990001) and not public.tg_srv_update(990001));
  perform t.chk('18: alerta nueva → true; la misma → false', public.tg_srv_alerta_nueva(cA,'bajo:tgp1:2026-11-05') and not public.tg_srv_alerta_nueva(cA,'bajo:tgp1:2026-11-05'));
  -- desvincular (administrador)
  update public.tg_vinculos set activo=true where comercio_id=cA and tg_user_id=tgA;
  r := t.call(uA,'a@a.com',format($q$select public.tg_admin_desvincular(%L,'%s')$q$,cA,tgA));
  perform t.chk('18: el administrador desvincula', jsonb_array_length(r->'vinculos')=0, r::text);
  perform t.chk('18: payadj (16) y cortesx (17) siguen en sincronizar', position('''payadj''' in pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure))>0 and position('''cortesx''' in pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure))>0);
  delete from public.registros where comercio_id=cA and id in ('tgp1','tgc1','tgk1');
  if rol3 is null then delete from public.miembros where comercio_id=cA and usuario_id=uA3; else update public.miembros set rol=rol3 where comercio_id=cA and usuario_id=uA3; end if;
end $$;
