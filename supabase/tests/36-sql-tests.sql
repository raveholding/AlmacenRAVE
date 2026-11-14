-- 28-push.sql: suscripciones, campañas, trabajador, métricas, limpieza de suscripciones inválidas, geocercas con anti-GPS falso, baja y sincronización
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uB uuid := '00000000-0000-0000-0000-00000000000b'; uM uuid := '00000000-0000-0000-0000-0000000000a3';
  cA uuid := t.ctxget('cA')::uuid; slugA text; r jsonb; ep1 text := 'https://fcm.googleapis.com/fcm/send/AAAA1111-bbbb'; ep2 text := 'https://web.push.apple.com/QWERTY-12345';
  ep3 text := 'https://updates.push.services.mozilla.com/wpush/v2/zzzz9999';
  k1 text := repeat('B',87); a1 text := 'abcdefghijklmnopqrstuv'; n int; sec text; base bigint; vtok text; sid uuid;
  la double precision := -24.7859; lo double precision := -65.4117; lat2 double precision;
begin
  select slug into slugA from public.comercios where id=cA;
  r := t.call(null,'',format($q$select public.push_suscribir(%L,%L,%L,%L,null,'android','America/Argentina/Salta','1')$q$,slugA,ep1,k1,a1),'anon');
  perform t.chk('36: sin publicar las notificaciones en el menú no se suscribe nadie', r::text like '%"ok": false%', r::text);
  update public.menus set contenido = jsonb_set(coalesce(contenido,'{}'::jsonb),'{site,push}','{"on":true}'::jsonb,true) where comercio_id=cA;
  r := t.call(null,'',format($q$select public.push_suscribir(%L,'https://evil.example.com/robar/123456789',%L,%L,null,'android',null,'1')$q$,slugA,k1,a1),'anon');
  perform t.chk('36: un endpoint que no es de un servicio de push se rechaza (SSRF)', r::text like '%"ok": false%', r::text);
  r := t.call(null,'',format($q$select public.push_suscribir(%L,%L,'corto',%L,null,'android',null,'1')$q$,slugA,ep1,a1),'anon');
  perform t.chk('36: llaves inválidas se rechazan', r::text like '%"ok": false%', r::text);
  insert into public.registros(comercio_id,coleccion,id,datos) values (cA,'clientes','cliPUSH0001','{}'::jsonb) on conflict do nothing;
  r := t.call(null,'',format($q$select public.push_suscribir(%L,%L,%L,%L,'cliPUSH0001','android','America/Argentina/Salta','1')$q$,slugA,ep1,k1,a1),'anon');
  perform t.chk('36: el celular del cliente se suscribe', r::text like '%"ok": true%' and exists(select 1 from public.push_subs where endpoint=ep1 and cliente='cliPUSH0001'), r::text);
  r := t.call(null,'',format($q$select public.push_suscribir(%L,%L,%L,%L,'noexiste123','ios','Zona/Inventada','1')$q$,slugA,ep2,k1,a1),'anon');
  perform t.chk('36: cliente inexistente y zona horaria inventada no se guardan', (select cliente is null and tz='America/Argentina/Salta' from public.push_subs where endpoint=ep2), r::text);
  r := t.call(null,'',format($q$select public.push_suscribir(%L,%L,%L,%L,null,'android',null,'2')$q$,slugA,ep1,k1,a1),'anon');
  perform t.chk('36: volver a suscribirse no duplica y conserva el cliente', (select count(*) from public.push_subs where endpoint=ep1)=1 and (select cliente from public.push_subs where endpoint=ep1)='cliPUSH0001');
  r := t.call(null,'',$q$select count(*) from public.push_subs$q$,'anon');
  perform t.chk('36: anon no lee las suscripciones', r ? 'err');
  r := t.call(uA,'a@a.com',$q$select count(*) from public.push_subs$q$);
  perform t.chk('36: el equipo tampoco lee la tabla directo (sólo métricas)', r ? 'err');
  -- campañas
  r := t.call(uB,'b@b.com',format($q$select public.push_programar(%L,'{"id":"camp001x","titulo":"Hola","cuerpo":"Promo"}'::jsonb,null,null,null)$q$,cA));
  perform t.chk('36: otro comercio no programa campañas ajenas', r ? 'err', r::text);
  insert into auth.users(id,email) values (uM,'a3@a.com') on conflict do nothing;
  insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uM,'mostrador','a3@a.com','Most') on conflict (comercio_id,usuario_id) do update set rol='mostrador';
  r := t.call(uM,'a3@a.com',format($q$select public.push_programar(%L,'{"id":"camp001x","titulo":"Hola","cuerpo":"Promo"}'::jsonb,null,null,null)$q$,cA));
  perform t.chk('36: el mostrador no programa campañas', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.push_programar(%L,'{"id":"camp001x","titulo":"","cuerpo":"Promo"}'::jsonb,null,null,null)$q$,cA));
  perform t.chk('36: sin título se rechaza', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.push_programar(%L,'{"id":"camp001x","titulo":"Hola","cuerpo":"Promo","accion_url":"javascript:alert(1)"}'::jsonb,null,null,null)$q$,cA));
  perform t.chk('36: enlace javascript: se rechaza', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.push_programar(%L,'{"id":"camp001x","titulo":"Hola","cuerpo":"Promo de la semana","accion_url":"#mitarjeta/ben","prioridad":"alta"}'::jsonb,array['cliPUSH0001'],null,null)$q$,cA));
  perform t.chk('36: campaña segmentada: sólo el cliente elegido', (r->>'envios')::int=1, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.push_programar(%L,'{"id":"camp001x","titulo":"Hola","cuerpo":"otra vez"}'::jsonb,null,null,null)$q$,cA));
  perform t.chk('36: una campaña programada no se vuelve a programar (no duplica envíos)', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.push_programar(%L,'{"id":"camp002x","titulo":"Buen día","cuerpo":"A la hora local"}'::jsonb,null,now()+interval '1 day','09:30')$q$,cA));
  perform t.chk('36: hora local: cada envío sale a las 09:30 de la zona del celular', (r->>'envios')::int=2 and (select bool_and(to_char(due at time zone 'America/Argentina/Salta','HH24:MI')='09:30') from public.push_envios where campana_id='camp002x'), r::text);
  -- trabajador (clave de servicio)
  r := t.call(uA,'a@a.com',$q$select to_jsonb(count(*)) from public.push_tomar(10)$q$);
  perform t.chk('36: el equipo no puede ejecutar el trabajador', r ? 'err', r::text);
  select count(*) into n from public.push_tomar(50);
  perform t.chk('36: el trabajador toma sólo lo que ya venció (no lo de mañana)', n=1 and (select estado from public.push_envios where campana_id='camp001x')='enviando', n::text);
  select count(*) into n from public.push_tomar(50);
  perform t.chk('36: lo que está enviándose no se toma dos veces', n=0);
  select e.id, e.tok into n, vtok from public.push_envios e where e.campana_id='camp001x';
  perform public.push_resultado(n,'enviado',201);
  perform t.chk('36: campaña sin pendientes queda FINALIZADA', (select estado from public.push_campanas where id='camp001x' and comercio_id=cA)='FINALIZADA');
  r := t.call(null,'',format($q$select public.push_evento(%L,'abierto')$q$,vtok),'anon');
  r := t.call(null,'',$q$select public.push_evento('00000000000000000000000000000000','abierto')$q$,'anon');
  r := t.call(uA,'a@a.com',format($q$select public.push_metricas(%L)$q$,cA));
  perform t.chk('36: métricas: enviado, entregado y abierto (un código ajeno no suma)', (r#>>'{campanas,camp001x,enviados}')::int=1 and (r#>>'{campanas,camp001x,abiertos}')::int=1 and (r#>>'{campanas,camp001x,entregados}')::int=1 and (r->>'subs')::int=2, r::text);
  r := t.call(uB,'b@b.com',format($q$select public.push_metricas(%L)$q$,cA));
  perform t.chk('36: otro comercio no ve las métricas', r ? 'err');
  -- pausa y limpieza de suscripciones inválidas
  update public.push_envios set due=now()-interval '1 minute' where campana_id='camp002x';
  r := t.call(uA,'a@a.com',format($q$select public.push_estado(%L,'camp002x','PAUSADA')$q$,cA));
  select count(*) into n from public.push_tomar(50);
  perform t.chk('36: una campaña pausada no sale', n=0);
  r := t.call(uA,'a@a.com',format($q$select public.push_estado(%L,'camp002x','PROGRAMADA')$q$,cA));
  select id into n from public.push_tomar(50) where endpoint=ep2;
  perform public.push_resultado(n,'invalido',410);
  perform t.chk('36: respuesta 410 borra la suscripción sola (limpieza de tokens)', not exists(select 1 from public.push_subs where endpoint=ep2) and (select estado from public.push_envios where id=n)='error');
  select id into n from public.push_envios where campana_id='camp002x' and estado='enviando' limit 1;
  perform public.push_resultado(n,'reintentar',503);
  perform t.chk('36: error temporal se reintenta más tarde', (select estado='pendiente' and due>now() from public.push_envios where id=n));
  -- geocercas (preparadas para la app nativa)
  r := t.call(uA,'a@a.com',format($q$select public.push_geo_guardar(%L,'{"id":"geo001xx","titulo":"Estás cerca","cuerpo":"Pasá por tu promo"}'::jsonb,'{"lat":-24.7859,"lng":-65.4117,"radio_m":50,"disparo":"ENTRAR"}'::jsonb)$q$,cA));
  perform t.chk('36: radio menor a 100 m se rechaza', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.push_geo_guardar(%L,'{"id":"geo001xx","titulo":"Estás cerca","cuerpo":"Pasá por tu promo"}'::jsonb,'{"lat":-24.7859,"lng":-65.4117,"radio_m":200,"disparo":"ENTRAR","dias":[0,1,2,3,4,5,6],"desde":"00:00","hasta":"23:59","enfriar_min":60,"histeresis_m":30,"activa":true}'::jsonb)$q$,cA));
  perform t.chk('36: geocerca guardada y activa', r::text like '%ACTIVA%', r::text);
  r := t.call(null,'',format($q$select public.push_geo_registrar(%L,%L)$q$,slugA,ep1),'anon');sec := r->>'secreto';
  perform t.chk('36: el dispositivo recibe su secreto una sola vez', sec ~ '^[0-9a-f]{64}$', r::text);
  r := t.call(null,'',format($q$select public.push_geo_registrar(%L,%L)$q$,slugA,ep1),'anon');
  perform t.chk('36: pedirlo de nuevo no lo entrega', r::text like '%"ok": false%', r::text);
  base := (extract(epoch from now())*1000)::bigint - 100000;
  lat2 := la + 0.0030;  -- ~330 m al norte: afuera
  r := t.call(null,'',format($q$select public.push_geo_ping(%L,%L,%s,%s,%s,'firmafalsa')$q$,slugA,ep1,lat2,lo,base),'anon');
  perform t.chk('36: ubicación sin firma válida se rechaza', r::text like '%firma%', r::text);
  r := t.call(null,'',format($q$select public.push_geo_ping(%L,%L,%s,%s,%s,%L)$q$,slugA,ep1,lat2,lo,base,encode(extensions.hmac(ep1||'|'||lat2::text||'|'||lo::text||'|'||base::text,sec,'sha256'),'hex')),'anon');
  perform t.chk('36: afuera de la geocerca no dispara', (r->>'disparos')::int=0, r::text);
  r := t.call(null,'',format($q$select public.push_geo_ping(%L,%L,%s,%s,%s,%L)$q$,slugA,ep1,la,lo,base+20000,encode(extensions.hmac(ep1||'|'||la::text||'|'||lo::text||'|'||(base+20000)::text,sec,'sha256'),'hex')),'anon');
  perform t.chk('36: al ENTRAR dispara una notificación', (r->>'disparos')::int=1 and exists(select 1 from public.push_envios where campana_id='geo001xx'), r::text);
  lat2 := la + 0.0019;  -- ~210 m: dentro de radio + histéresis
  r := t.call(null,'',format($q$select public.push_geo_ping(%L,%L,%s,%s,%s,%L)$q$,slugA,ep1,lat2,lo,base+30000,encode(extensions.hmac(ep1||'|'||lat2::text||'|'||lo::text||'|'||(base+30000)::text,sec,'sha256'),'hex')),'anon');
  perform t.chk('36: histéresis: a 210 m sigue «adentro» (no rebota en el borde)', (select dentro from public.push_geo_estado e join public.push_subs s on s.id=e.sub_id where s.endpoint=ep1), r::text);
  lat2 := la + 0.0030;
  r := t.call(null,'',format($q$select public.push_geo_ping(%L,%L,%s,%s,%s,%L)$q$,slugA,ep1,lat2,lo,base+40000,encode(extensions.hmac(ep1||'|'||lat2::text||'|'||lo::text||'|'||(base+40000)::text,sec,'sha256'),'hex')),'anon');
  r := t.call(null,'',format($q$select public.push_geo_ping(%L,%L,%s,%s,%s,%L)$q$,slugA,ep1,la,lo,base+60000,encode(extensions.hmac(ep1||'|'||la::text||'|'||lo::text||'|'||(base+60000)::text,sec,'sha256'),'hex')),'anon');
  perform t.chk('36: salir y volver a entrar enseguida no repite (enfriamiento)', (r->>'disparos')::int=0 and (select count(*) from public.push_envios where campana_id='geo001xx')=1, r::text);
  r := t.call(null,'',format($q$select public.push_geo_ping(%L,%L,%s,%s,%s,%L)$q$,slugA,ep1,la,lo,base+60000,encode(extensions.hmac(ep1||'|'||la::text||'|'||lo::text||'|'||(base+60000)::text,sec,'sha256'),'hex')),'anon');
  perform t.chk('36: la misma ubicación repetida se rechaza (anti-repetición)', r::text like '%repetida%', r::text);
  lat2 := la + 1.0;  -- 110 km en 10 s
  r := t.call(null,'',format($q$select public.push_geo_ping(%L,%L,%s,%s,%s,%L)$q$,slugA,ep1,lat2,lo,base+70000,encode(extensions.hmac(ep1||'|'||lat2::text||'|'||lo::text||'|'||(base+70000)::text,sec,'sha256'),'hex')),'anon');
  perform t.chk('36: salto imposible (GPS falso) se descarta', r::text like '%salto imposible%', r::text);
  r := t.call(null,'',format($q$select public.push_geo_ping(%L,%L,%s,%s,%s,%L)$q$,slugA,ep1,la,lo,base-600000,encode(extensions.hmac(ep1||'|'||la::text||'|'||lo::text||'|'||(base-600000)::text,sec,'sha256'),'hex')),'anon');
  perform t.chk('36: ubicación vieja se rechaza', r::text like '%vencida%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.push_alcance(%L,-24.7859,-65.4117,300)$q$,cA));
  perform t.chk('36: alcance estimado de la geocerca (dispositivos con ubicación reciente)', (r->>'con_ubicacion')::int=1 and (r->>'dentro')::int=1, r::text);
  r := t.call(uB,'b@b.com',format($q$select public.push_alcance(%L,-24.7859,-65.4117,300)$q$,cA));
  perform t.chk('36: otro comercio no consulta el alcance', r ? 'err');
  -- baja y borrado de datos
  select id into sid from public.push_subs where endpoint=ep1;
  r := t.call(null,'',format($q$select public.push_baja(%L,%L)$q$,slugA,ep1),'anon');
  perform t.chk('36: la baja borra la suscripción, la última ubicación y el estado de geocercas', not exists(select 1 from public.push_subs where endpoint=ep1) and not exists(select 1 from public.push_geo_pos where sub_id=sid) and not exists(select 1 from public.push_geo_estado where sub_id=sid), r::text);
  -- sincronización
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"pushc","id":"pc36","d":{"titulo":"x"}}]'::jsonb)$q$,cA));
  perform t.chk('36: el administrador sincroniza borradores de campañas', (r->>'aplicados')::int=1, r::text);
  perform t.chk('36: el supervisor también; el mostrador no', public.rave_puede_escribir('supervisor','pushc','x') and not public.rave_puede_escribir('mostrador','pushc','x'));
  r := t.call(uA,'a@a.com',format($q$select public.push_url(%L,'https://evil.com/functions/v1/push')$q$,cA));
  perform t.chk('36: la dirección de la función sólo puede ser de Supabase', r ? 'err', r::text);
end $$;
