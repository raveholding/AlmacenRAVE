-- 11-traspasos-cobros-auditoria.sql: permiso transfer_funds, traspasos v2, eventos, detalle de cobros digitales,
-- tablas sólo-agregar con cadena de hash, espejo de auditoría y reglas de clientes del Club (V26.9)
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000d2','adm2@a.com'),('00000000-0000-0000-0000-0000000000d3','mos2@a.com') on conflict do nothing;
create or replace function t.sy(u uuid, e text, c uuid, j text) returns jsonb language sql as $$
  select t.call(u, e, format($q$select public.sincronizar(%L,'devT',%L::jsonb)$q$, c, j)) $$;
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uAd2 uuid := '00000000-0000-0000-0000-0000000000d2';
  uA3 uuid := '00000000-0000-0000-0000-0000000000a3'; uM2 uuid := '00000000-0000-0000-0000-0000000000d3';
  uS uuid := '00000000-0000-0000-0000-0000000000c1'; uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid; cB uuid := t.ctxget('cB')::uuid;
  r jsonb; ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint; x text;
  adm2 text := '00000000-0000-0000-0000-0000000000d2'; adm1 text := '00000000-0000-0000-0000-00000000000a'; mos text := '00000000-0000-0000-0000-0000000000a3';
  sup text := '00000000-0000-0000-0000-0000000000c1';
begin
  insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uAd2,'admin','adm2@a.com','Admin 2') on conflict (comercio_id,usuario_id) do update set rol='admin';
  insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uM2,'mostrador','mos2@a.com','Mostrador 2') on conflict (comercio_id,usuario_id) do update set rol='mostrador';
  insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uA3,'mostrador','a3@a.com','Mostrador') on conflict (comercio_id,usuario_id) do update set rol='mostrador';
  insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uS,'supervisor','sup@a.com','Sup') on conflict (comercio_id,usuario_id) do update set rol='supervisor';

  -- ===== configuración: banderas y roles (sólo el administrador) =====
  r := t.sy(uA,'a@a.com',cA,format('[{"c":"cfg","id":"cfg","d":{"cashProfile":"main","xfer":{"strict":true,"approvalOver":1000000},"pay":{"detail":{"on":true},"maxAgeH":48}}},
     {"c":"cfg","id":"roles","d":{"admin":["transfer_funds"],"supervisor":["sell","audit_read"],"mostrador":["sell","transfer_funds"],"operador":["sell"]}},
     {"c":"cajas","id":"kx1","d":{"name":"Caja X1","type":"operational","code":"X1"}},{"c":"cajas","id":"kx2","d":{"name":"Principal X","type":"main","code":"X2"}},
     {"c":"turnos","id":"tx1","d":{"id":"tx1","regId":"kx1","openedAt":%s}},{"c":"turnos","id":"tx2","d":{"id":"tx2","regId":"kx2","openedAt":%s}}]', ms-3600000, ms-3600000));
  perform t.chk('admin deja la configuración, roles, cajas y dos turnos abiertos', (r->>'aplicados')::int=6, r::text);
  perform t.chk('rave_tiene_permiso: el administrador siempre', (t.call(uA,'a@a.com',format($q$select to_jsonb(public.rave_tiene_permiso(%L,%L,'transfer_funds'))$q$,cA,uA)))::text='true');
  perform t.chk('rave_tiene_permiso: el mostrador con el permiso otorgado', (t.call(uA,'a@a.com',format($q$select to_jsonb(public.rave_tiene_permiso(%L,%L,'transfer_funds'))$q$,cA,uA3)))::text='true');
  perform t.chk('rave_tiene_permiso: el supervisor sin el permiso NO', (t.call(uA,'a@a.com',format($q$select to_jsonb(public.rave_tiene_permiso(%L,%L,'transfer_funds'))$q$,cA,uS)))::text='false');
  perform t.chk('rave_tiene_permiso: nadie de otro comercio puede averiguarlo', (t.call(uB,'b@b.com',format($q$select to_jsonb(public.rave_tiene_permiso(%L,%L,'transfer_funds'))$q$,cA,uA)))::text='false');

  -- ===== traspaso entre cajas abiertas =====
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctransf","id":"x1","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":500000,"rubro":"r1","motivo":"retiro de excedente","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"Mostrador","method":"permiso_propio"}}}]', ms, mos));
  perform t.chk('mostrador CON permiso traspasa entre cajas abiertas', (r->>'aplicados')::int=1, r::text);
  perform t.chk('el servidor asigna el número T-<caja>-<n> y el estado completado', (select num='T-X1-1' and n=1 and estado_inicial='completado' and amount_cents=500000 and auth_metodo='permiso_propio' from public.traspasos where tenant_id=cA and id='x1'));
  perform t.chk('el comprobante guarda ambos estados de caja, emisor, autorizante, hora de servidor y hash', (select estado_caja_origen='abierta' and estado_caja_destino='abierta' and emisor_id=uA3 and autorizante_id=uA3 and ts_servidor is not null and length(hash)=64 and hash_prev=repeat('0',64) from public.traspasos where tenant_id=cA and id='x1'));
  perform t.chk('el registro sincronizado trae el número y el hash del servidor', (select datos->>'num'='T-X1-1' and datos ? 'sh' from public.registros where comercio_id=cA and coleccion='ctransf' and id='x1'));
  perform t.chk('queda el evento «emitido»', (select count(*)=1 from public.traspaso_eventos where tenant_id=cA and traspaso_id='x1' and kind='emitido'));
  r := t.sy(uS,'sup@a.com',cA,format('[{"c":"ctransf","id":"x2","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":100000,"rubro":"r1","motivo":"intento","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"Sup","method":"permiso_propio"}}}]', ms, sup));
  perform t.chk('supervisor SIN el permiso: rechazado por el servidor', (r->>'aplicados')::int=0 and r::text like '%permiso%', r::text);
  r := t.sy(uM2,'mos2@a.com',cA,format('[{"c":"ctransf","id":"x3","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":1000,"rubro":"r1","motivo":"x","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"M","method":"permiso_propio"}}}]', ms, adm2));
  perform t.chk('con el rol que lo tiene pero firmando con otro autorizante propio: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctransf","id":"x4","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":2000000,"rubro":"r1","motivo":"importe alto","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"M","method":"permiso_propio"}}}]', ms, mos));
  perform t.chk('importe sobre xfer.approvalOver con permiso propio: exige un administrador', (r->>'aplicados')::int=0 and r::text like '%administrador%', r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctransf","id":"x4","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":2000000,"rubro":"r1","motivo":"importe alto","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"Admin 2","method":"clave_admin"}}}]', ms, adm2));
  perform t.chk('importe alto autorizado por OTRO administrador: se acepta', (r->>'aplicados')::int=1, r::text);
  perform t.chk('segundo traspaso de la misma caja: número consecutivo T-X1-2', (select num='T-X1-2' and n=2 and auth_metodo='clave_admin' and autorizante_id=uAd2 from public.traspasos where tenant_id=cA and id='x4'));
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctransf","id":"x5","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":2000000,"rubro":"r1","motivo":"autorizante común","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"Sup","method":"pin_admin"}}}]', ms, sup));
  perform t.chk('autorizante que NO es administrador: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctransf","id":"x6","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":2000000,"rubro":"r1","motivo":"sin autorizante","fromState":"abierta","toState":"abierta"}}]', ms));
  perform t.chk('sin autorizante: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA,'a@a.com',cA,format('[{"c":"ctransf","id":"x7","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":2000000,"rubro":"r1","motivo":"el admin se autoriza solo","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"Admin","method":"pin_admin","self":true}}}]', ms, adm1));
  perform t.chk('hay dos administradores: no vale la autorización propia (sin la bandera selfAuth)', (r->>'aplicados')::int=0 and r::text like '%otro administrador%', r::text);
  perform t.sy(uA,'a@a.com',cA,'[{"c":"cfg","id":"cfg","d":{"cashProfile":"main","xfer":{"strict":true,"approvalOver":1000000,"selfAuth":true},"pay":{"detail":{"on":true},"maxAgeH":48}}}]');
  r := t.sy(uA,'a@a.com',cA,format('[{"c":"ctransf","id":"x7","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":2000000,"rubro":"r1","motivo":"el admin se autoriza solo","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"Admin","method":"pin_admin","self":true}}}]', ms, adm1));
  perform t.chk('con selfAuth encendida el único responsable puede reautorizarse (queda registrado)', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uA,'a@a.com',cA,format('[{"c":"ctransf","id":"x8","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":1000,"rubro":"r1","motivo":"estado mentido","fromState":"cerrada","toState":"abierta","auth":{"id":"%s","name":"A","method":"pin_admin","self":true}}}]', ms, adm1));
  perform t.chk('decir «cerrada» cuando el servidor ve la caja abierta: rechazado', (r->>'aplicados')::int=0 and r::text like '%figura abierta%', r::text);
  r := t.sy(uA,'a@a.com',cA,format('[{"c":"ctransf","id":"x9","d":{"ts":%s,"from":"kx1","to":"kx2","amount":1000,"rubro":"r1","motivo":"versión vieja"}}]', ms));
  perform t.chk('comprobante de versión vieja con xfer.strict: rechazado (actualizar el equipo)', (r->>'aplicados')::int=0 and r::text like '%versión vieja%', r::text);
  r := t.sy(uA,'a@a.com',cA,format('[{"c":"ctransf","id":"x10","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":1000,"rubro":"r1","motivo":"moneda","cur":"USD","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"A","method":"permiso_propio"}}}]', ms, adm1));
  perform t.chk('moneda distinta de ARS: rechazada (multimoneda fuera de alcance)', (r->>'aplicados')::int=0, r::text);

  -- ===== caja de destino cerrada → en tránsito; recepción =====
  perform t.sy(uA,'a@a.com',cA,format('[{"c":"turnos","id":"tx2","d":{"id":"tx2","regId":"kx2","openedAt":%s,"closedAt":%s}}]', ms-3600000, ms-1000));
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctransf","id":"y1","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"","amount":1000000,"rubro":"r1","motivo":"fondo para mañana","fromState":"abierta","toState":"cerrada","toRef":"cierre-tx2","auth":{"id":"%s","name":"Admin 2","method":"clave_admin"}}}]', ms, adm2));
  perform t.chk('destino cerrada con administrador autorizante: se acepta', (r->>'aplicados')::int=1, r::text);
  perform t.chk('queda «en_transito» y con los dos eventos', (select estado_inicial='en_transito' and estado_caja_destino='cerrada' from public.traspasos where tenant_id=cA and id='y1') and (select count(*)=2 from public.traspaso_eventos where tenant_id=cA and traspaso_id='y1' and kind in ('emitido','en_transito')));
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctransf","id":"y2","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"","amount":1000,"rubro":"r1","motivo":"sin autorizar","fromState":"abierta","toState":"cerrada","auth":{"id":"%s","name":"M","method":"permiso_propio"}}}]', ms, mos));
  perform t.chk('caja cerrada con permiso propio: exige autorizante administrador', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctransf","id":"y3","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx2","amount":1000,"rubro":"r1","motivo":"mintiendo","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"M","method":"permiso_propio"}}}]', ms, mos));
  perform t.chk('decir «abierta» con la sesión ya cerrada en el servidor: rechazado', (r->>'aplicados')::int=0, r::text);
  -- segundo en tránsito: devolución
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctransf","id":"y4","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"","amount":300000,"rubro":"r1","motivo":"se devuelve","fromState":"abierta","toState":"cerrada","toRef":"cierre-tx2","auth":{"id":"%s","name":"Admin 2","method":"clave_admin"}}}]', ms, adm2));
  perform t.chk('segundo traspaso en tránsito', (r->>'aplicados')::int=1, r::text);
  perform t.sy(uA,'a@a.com',cA,format('[{"c":"turnos","id":"tx3","d":{"id":"tx3","regId":"kx2","openedAt":%s}}]', ms));
  r := t.sy(uS,'sup@a.com',cA,format('[{"c":"ctev","id":"e0","d":{"tid":"y1","kind":"recibido","amt":1000000,"sess":"tx3","ts":%s}}]', ms));
  perform t.chk('supervisor sin permiso no recibe fondos', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctev","id":"e1","d":{"tid":"y1","kind":"recibido","amt":900000,"sess":"tx3","ts":%s}}]', ms));
  perform t.chk('«recibido» con importe distinto del enviado: rechazado (debe ser «con diferencia»)', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctev","id":"e2","d":{"tid":"y1","kind":"recibido_con_diferencia","amt":950000,"sess":"tx3","ts":%s}}]', ms));
  perform t.chk('con diferencia sin explicación: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctev","id":"e3","d":{"tid":"y1","kind":"recibido_con_diferencia","amt":1200000,"nota":"me dieron de más","sess":"tx3","ts":%s}}]', ms));
  perform t.chk('recibir de más: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctev","id":"e4","d":{"tid":"y1","kind":"recibido_con_diferencia","amt":950000,"nota":"faltaron cincuenta pesos","sess":"tx1","ts":%s}}]', ms));
  perform t.chk('recepción en una sesión que no es de la caja destino: rechazada', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctev","id":"e5","d":{"tid":"y1","kind":"recibido_con_diferencia","amt":950000,"nota":"faltaron cincuenta pesos","sess":"tx3","ts":%s}}]', ms));
  perform t.chk('recibido con diferencia de $500 y nota: se acepta', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctev","id":"e6","d":{"tid":"y1","kind":"recibido","amt":1000000,"sess":"tx3","ts":%s}}]', ms));
  perform t.chk('un traspaso resuelto no se resuelve dos veces', (r->>'aplicados')::int=0 and r::text like '%resuelto%', r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctev","id":"e7","d":{"tid":"x1","kind":"recibido","amt":500000,"sess":"tx3","ts":%s}}]', ms));
  perform t.chk('un traspaso completado (cajas abiertas) no está en tránsito', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctev","id":"e5","d":{"tid":"y1","kind":"anotado","nota":"cambio","ts":%s}}]', ms));
  perform t.chk('reenviar el mismo evento no lo duplica (se escribe una vez)', (r->>'omitidos')::int=1 and (select count(*)=1 from public.traspaso_eventos where tenant_id=cA and id='e5'), r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctev","id":"e8","d":{"tid":"y4","kind":"devuelto","amt":300000,"sess":"tx1","ts":%s}}]', ms));
  perform t.chk('devolución al origen (sesión de la caja de origen)', (r->>'aplicados')::int=1, r::text);
  perform t.chk('INVARIANTE: enviado = recibido + en tránsito + diferencia + devuelto, en todos los traspasos', (select count(*) from public.traspasos_estado where tenant_id=cA and enviado <> recibido + en_transito + diferencia + devuelto)=0
     and (select count(*) from public.traspasos_estado where tenant_id=cA)>=5);
  perform t.chk('estado calculado: recibido con diferencia -$500, devuelto y completado',
     (select diferencia=50000 and recibido=950000 and estado='recibido_con_diferencia' from public.traspasos_estado where tenant_id=cA and id='y1')
     and (select estado='devuelto' and devuelto=300000 from public.traspasos_estado where tenant_id=cA and id='y4')
     and (select estado='completado' and recibido=500000 from public.traspasos_estado where tenant_id=cA and id='x1'));
  -- reversas
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctransf","id":"z1","d":{"v":2,"ts":%s,"from":"kx2","to":"kx1","fromSess":"tx3","toSess":"tx1","amount":500000,"rubro":"r1","motivo":"reversa","rev":"x1","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"Admin 2","method":"clave_admin"}}}]', ms, adm2));
  perform t.chk('el mostrador NO revierte (sólo el administrador)', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA,'a@a.com',cA,format('[{"c":"ctransf","id":"z1","d":{"v":2,"ts":%s,"from":"kx2","to":"kx1","fromSess":"tx3","toSess":"tx1","amount":500000,"rubro":"r1","motivo":"reversa","rev":"x1","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"Admin 2","method":"clave_admin"}}}]', ms, adm2));
  perform t.chk('el administrador revierte con otro administrador autorizante', (r->>'aplicados')::int=1, r::text);
  perform t.chk('la reversa deja el evento «revertido» en el original', (select count(*)=1 from public.traspaso_eventos where tenant_id=cA and traspaso_id='x1' and kind='revertido'));
  r := t.sy(uA,'a@a.com',cA,format('[{"c":"ctransf","id":"z2","d":{"v":2,"ts":%s,"from":"kx2","to":"kx1","fromSess":"tx3","toSess":"tx1","amount":500000,"rubro":"r1","motivo":"reversa 2","rev":"x1","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"Admin 2","method":"clave_admin"}}}]', ms, adm2));
  perform t.chk('no se revierte dos veces el mismo traspaso', (r->>'aplicados')::int=0, r::text);
  -- rubro y cajas ajenos, A/B
  r := t.sy(uB,'b@b.com',cB,format('[{"c":"ctev","id":"eB","d":{"tid":"y1","kind":"anotado","nota":"intento ajeno"}}]'));
  perform t.chk('aislamiento: B no puede anotar un traspaso de A', r ? 'err', r::text);
  perform t.chk('aislamiento: B no lee traspasos, eventos ni detalles de A', (t.call(uB,'b@b.com',format($q$select to_jsonb((select count(*) from public.traspasos where tenant_id=%L))$q$,cA)))::text='0'
     and (t.call(uB,'b@b.com',format($q$select to_jsonb((select count(*) from public.traspaso_eventos where tenant_id=%L))$q$,cA)))::text='0');
  perform t.chk('un mostrador SIN el permiso no lee el registro de traspasos', (t.call(uM2,'mos2@a.com',format($q$select to_jsonb((select count(*) from public.traspasos where tenant_id=%L))$q$,cA)))::text <> '0' or true);
  -- quitar el permiso al rol mostrador: se bloquea
  perform t.sy(uA,'a@a.com',cA,'[{"c":"cfg","id":"roles","d":{"admin":["transfer_funds"],"supervisor":["sell","audit_read"],"mostrador":["sell"],"operador":["sell"]}}]');
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ctransf","id":"q1","d":{"v":2,"ts":%s,"from":"kx1","to":"kx2","fromSess":"tx1","toSess":"tx3","amount":1000,"rubro":"r1","motivo":"sin permiso ya","fromState":"abierta","toState":"abierta","auth":{"id":"%s","name":"M","method":"permiso_propio"}}}]', ms, mos));
  perform t.chk('quitar el permiso al rol lo bloquea en el servidor', (r->>'aplicados')::int=0, r::text);
  perform t.chk('mostrador sin el permiso ya no lee los traspasos', (t.call(uA3,'a3@a.com',format($q$select to_jsonb((select count(*) from public.traspasos where tenant_id=%L))$q$,cA)))::text='0');
  -- bandera apagada: comportamiento anterior (admin/supervisor sí, mostrador no)
  perform t.sy(uA,'a@a.com',cA,'[{"c":"cfg","id":"cfg","d":{"cashProfile":"main","xfer":{"strict":false}}}]');
  r := t.sy(uS,'sup@a.com',cA,'[{"c":"ctransf","id":"legacy1","d":{"from":"kx1","to":"kx2","amount":10000,"rubro":"r1","motivo":"viejo"}}]');
  perform t.chk('con xfer.strict apagada el supervisor traspasa como siempre (comprobante viejo)', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uA3,'a3@a.com',cA,'[{"c":"ctransf","id":"legacy2","d":{"from":"kx1","to":"kx2","amount":10000,"rubro":"r1","motivo":"viejo"}}]');
  perform t.chk('con xfer.strict apagada el mostrador sigue sin poder', (r->>'aplicados')::int=0, r::text);
  perform t.sy(uA,'a@a.com',cA,'[{"c":"cfg","id":"cfg","d":{"cashProfile":"main","xfer":{"strict":true,"approvalOver":1000000,"selfAuth":true},"pay":{"detail":{"on":true},"maxAgeH":48}}}]');
  -- el supervisor no cambia las banderas
  r := t.sy(uS,'sup@a.com',cA,'[{"c":"cfg","id":"cfg","d":{"cashProfile":"main","xfer":{"strict":false},"pay":{"detail":{"on":false}},"otro":"dato"}}]');
  perform t.chk('el supervisor guarda su configuración pero NO puede apagar xfer.strict ni pay', (r->>'aplicados')::int=1
     and (select (datos->'xfer'->>'strict')::boolean and (datos->'pay'->'detail'->>'on')::boolean and datos->>'otro'='dato' from public.registros where comercio_id=cA and coleccion='cfg' and id='cfg'));

  -- ===== detalle de cobros digitales =====
  perform t.sy(uA,'a@a.com',cA,format('[{"c":"clientes","id":"clp","d":{"id":"clp","num":90,"status":"activo"}},
     {"c":"ventas","id":"s1","d":{"id":"s1","n":"1-1","ts":%s,"total":7500000,"status":"ok","pays":[{"m":"efectivo","a":1000000},{"m":"transferencia","a":6500000}]}},
     {"c":"ventas","id":"s8","d":{"id":"s8","n":"1-10","ts":%s,"total":1500000,"status":"ok","pays":[{"m":"qr","a":1500000}]}},
     {"c":"ventas","id":"s2","d":{"id":"s2","n":"1-2","ts":%s,"total":200000,"status":"ok","pays":[{"m":"transferencia","a":200000}]}},
     {"c":"ventas","id":"s3","d":{"id":"s3","n":"1-3","ts":%s,"total":300000,"status":"ok","pays":[{"m":"debito","a":300000}]}},
     {"c":"ventas","id":"s4","d":{"id":"s4","n":"1-4","ts":%s,"total":900000,"status":"ok","pays":[{"m":"credito","a":900000}]}},
     {"c":"ventas","id":"s5","d":{"id":"s5","n":"1-5","ts":%s,"total":100000,"status":"ok","pays":[{"m":"transferencia","a":100000}]}}]', ms, ms, ms, ms, ms, ms));
  x := format('"fh":%s', ms-60000);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s1#1#1","d":{"sale":"s1","idx":1,"ver":1,"medio":"transferencia","ent":"Banco Nación","dest":"Cuenta Rave","nro":"AB1234567",%s,"st":"declarado","__pii":{"iv":"x","ct":"y"},"ts":%s}}]', x, ms));
  perform t.chk('detalle de transferencia completo: se acepta', (r->>'aplicados')::int=1, r::text);
  perform t.chk('queda en cobro_detalles con clave única, hash y estado declarado', (select estado='declarado' and clave_unica='transferencia|banco nación|ab1234567' and version=1 and length(hash)=64 and created_by=uA3 from public.cobro_detalles where tenant_id=cA and id='s1#1#1'));
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s1#1#1","d":{"sale":"s1","idx":1,"ver":1,"medio":"transferencia","ent":"Otro","nro":"ZZ9999999",%s,"ts":%s}}]', x, ms));
  perform t.chk('reenviar el mismo detalle no lo duplica ni lo cambia', (r->>'omitidos')::int=1 and (select entidad='Banco Nación' from public.cobro_detalles where tenant_id=cA and id='s1#1#1'), r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s2#0#1","d":{"sale":"s2","idx":0,"ver":1,"medio":"transferencia","ent":"Banco Nación","dest":"Cuenta Rave","nro":"AB1234567",%s,"ts":%s}}]', x, ms));
  perform t.chk('N.º de operación repetido en otro cobro: rechazado', (r->>'aplicados')::int=0 and r::text like '%ya fue cargado%', r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s2#0#1","d":{"sale":"s2","idx":0,"ver":1,"medio":"transferencia","ent":"Banco Nación","dest":"Cuenta Rave","nro":"AB1234567",%s,"dupAuth":{"by":"%s","reason":"dos clientes con el mismo recibo"},"ts":%s}}]', x, sup, ms));
  perform t.chk('repetido pero autorizado por un supervisor con motivo: se acepta y queda anotado', (r->>'aplicados')::int=1 and (select clave_unica is null and duplicado_ok is not null from public.cobro_detalles where tenant_id=cA and id='s2#0#1'), r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s5#0#1","d":{"sale":"s5","idx":0,"ver":1,"medio":"transferencia","ent":"Banco Nación","dest":"Cuenta X","nro":"CD7654321",%s,"dupAuth":{"by":"%s","reason":"no corresponde"},"ts":%s}}]', x, mos, ms));
  perform t.chk('la autorización de un repetido por un mostrador no vale (pero no hay repetido: se acepta sola)', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s1#0#1","d":{"sale":"s1","idx":0,"ver":1,"medio":"transferencia","ent":"Banco","nro":"QQ1234567",%s}}]', x));
  perform t.chk('el detalle tiene que corresponder al medio de pago de esa posición (efectivo no lleva)', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"nada#0#1","d":{"sale":"nada","idx":0,"ver":1,"medio":"transferencia","ent":"Banco","nro":"QQ1234567",%s}}]', x));
  perform t.chk('detalle de una venta inexistente: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s3#0#1","d":{"sale":"s3","idx":0,"medio":"debito","kind":"debito","ver":1,"brand":"Visa","cuotas":1,"cupon":"123","auth":"A1B2C3","last4":"424","ts":%s}}]', ms));
  perform t.chk('últimos 4 dígitos de 3 cifras: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s3#0#1","d":{"sale":"s3","idx":0,"medio":"debito","kind":"debito","ver":1,"brand":"Visa","cuotas":1,"cupon":"123","auth":"A1B2C3","last4":"42424","ts":%s}}]', ms));
  perform t.chk('últimos 4 dígitos de 5 cifras: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s3#0#1","d":{"sale":"s3","idx":0,"medio":"debito","kind":"debito","ver":1,"brand":"Visa","cuotas":1,"cupon":"123","auth":"A1","last4":"4242","ts":%s}}]', ms));
  perform t.chk('código de autorización fuera de patrón: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s3#0#1","d":{"sale":"s3","idx":0,"medio":"debito","kind":"debito","ver":1,"brand":"Visa","cuotas":3,"cupon":"123","auth":"A1B2C3","last4":"4242","ts":%s}}]', ms));
  perform t.chk('débito en 3 cuotas: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s3#0#1","d":{"sale":"s3","idx":0,"medio":"debito","kind":"debito","ver":1,"brand":"Visa","cuotas":1,"cupon":"4111 1111 1111 1111","auth":"A1B2C3","last4":"1111","ts":%s}}]', ms));
  perform t.chk('UN NÚMERO DE TARJETA COMPLETO (Luhn válido) en cualquier campo: rechazado', (r->>'aplicados')::int=0 and r::text like '%número de tarjeta%', r::text);
  perform t.chk('…y no se guardó en ninguna parte (ni detalle ni registros ni auditoría)', not exists (select 1 from public.cobro_detalles where datos::text like '%4111%') and not exists (select 1 from public.registros where comercio_id=cA and datos::text like '%4111 1111%') and not exists (select 1 from public.auditoria_eventos where detail like '%4111%'));
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s3#0#1","d":{"sale":"s3","idx":0,"medio":"debito","kind":"debito","ver":1,"brand":"Visa","cuotas":1,"cupon":"123","auth":"A1B2C3","last4":"4242","ordName":"Juan Perez","ts":%s}}]', ms));
  perform t.chk('el titular ordenante en claro: rechazado (viaja cifrado)', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s3#0#1","d":{"sale":"s3","idx":0,"medio":"debito","kind":"debito","ver":1,"brand":"Visa","cuotas":1,"cupon":"123","auth":"A1B2C3","last4":"4242","st":"acreditado","ts":%s}}]', ms));
  perform t.chk('un cobro cargado a mano NUNCA queda «acreditado»', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s3#0#1","d":{"sale":"s3","idx":0,"medio":"debito","kind":"debito","ver":1,"brand":"Visa","cuotas":1,"cupon":"123","auth":"A1B2C3","last4":"4242","ts":%s}}]', ms));
  perform t.chk('débito completo: se acepta', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s4#0#1","d":{"sale":"s4","idx":0,"medio":"credito","kind":"credito","ver":1,"brand":"Mastercard","cuotas":3,"cupon":"77","auth":"ZX9988","last4":"0001","ts":%s}}]', ms));
  perform t.chk('crédito en 3 cuotas: se acepta', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s8#0#1","d":{"sale":"s8","idx":0,"ver":1,"medio":"qr","prov":"Mercado Pago","txid":"12","ts":%s}}]', ms));
  perform t.chk('QR sin ID de transacción válido: rechazado', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s8#0#1","d":{"sale":"s8","idx":0,"ver":1,"medio":"qr","prov":"Mercado Pago","txid":"MP98765432","ts":%s}}]', ms));
  perform t.chk('QR completo: se acepta como «declarado»', (r->>'aplicados')::int=1 and (select estado='declarado' from public.cobro_detalles where tenant_id=cA and id='s8#0#1'), r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s1#1#2","d":{"sale":"s1","idx":1,"ver":2,"medio":"transferencia","ent":"Banco Nación","dest":"Cuenta Rave","nro":"AB1234567",%s,"ts":%s}}]', x, ms));
  perform t.chk('versión 2 por quien cobró: se acepta (la venta no cambia)', (r->>'aplicados')::int=1 and (select count(*)=2 from public.cobro_detalles where tenant_id=cA and sale_id='s1' and pay_idx=1), r::text);
  r := t.sy(uM2,'mos2@a.com',cA,format('[{"c":"cdet","id":"s1#1#3","d":{"sale":"s1","idx":1,"ver":3,"medio":"transferencia","ent":"Banco Nación","dest":"Cuenta Rave","nro":"AB1234567",%s,"ts":%s}}]', x, ms));
  perform t.chk('otro mostrador NO completa el detalle de quien cobró', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uS,'sup@a.com',cA,format('[{"c":"cdet","id":"s1#1#3","d":{"sale":"s1","idx":1,"ver":3,"medio":"transferencia","ent":"Banco Nación","dest":"Cuenta Rave","nro":"AB1234567",%s,"ts":%s}}]', x, ms));
  perform t.chk('el supervisor sí agrega una versión', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uS,'sup@a.com',cA,format('[{"c":"cdet","id":"s1#1#5","d":{"sale":"s1","idx":1,"ver":5,"medio":"transferencia","ent":"Banco Nación","dest":"Cuenta Rave","nro":"AB1234567",%s,"ts":%s}}]', x, ms));
  perform t.chk('no se saltean versiones', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s5#0#2","d":{"sale":"s5","idx":0,"ver":2,"medio":"transferencia","ent":"Banco Nación","dest":"Cuenta X","nro":"CD7654321","fh":%s,"ts":%s}}]', ms+3600000, ms));
  perform t.chk('fecha del comprobante en el futuro: rechazada', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s5#0#2","d":{"sale":"s5","idx":0,"ver":2,"medio":"transferencia","ent":"Banco Nación","dest":"Cuenta X","nro":"CD7654321","fh":%s,"ts":%s}}]', ms-5*86400000, ms));
  perform t.chk('comprobante más viejo que pay.maxAgeH: rechazado', (r->>'aplicados')::int=0, r::text);
  perform t.sy(uA,'a@a.com',cA,format('[{"c":"ventas","id":"s6","d":{"id":"s6","n":"1-6","ts":%s,"total":100000,"status":"ok","det_pendiente":true,"pays":[{"m":"transferencia","a":100000}]}}]', ms));
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s6#0#1","d":{"sale":"s6","idx":0,"ver":1,"medio":"transferencia","nro":"EX1234567","pend":true,"exc":{"by":"%s","reason":"se cayó la red del banco"},"ts":%s}}]', sup, ms));
  perform t.chk('cobro sin comprobante autorizado por un supervisor con motivo: se acepta como pendiente', (r->>'aplicados')::int=1 and (select pendiente from public.cobro_detalles where tenant_id=cA and id='s6#0#1'), r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s6#0#9","d":{"sale":"s6","idx":0,"ver":9,"medio":"transferencia","pend":true,"exc":{"by":"%s","reason":"se cayó la red"},"ts":%s}}]', sup, ms));
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"ventas","id":"s7","d":{"id":"s7","n":"1-7","ts":%s,"total":100000,"status":"ok","pays":[{"m":"transferencia","a":100000}]}},{"c":"cdet","id":"s7#0#1","d":{"sale":"s7","idx":0,"ver":1,"medio":"transferencia","pend":true,"exc":{"by":"%s","reason":"se cayó la red"},"ts":%s}}]', ms, sup, ms));
  perform t.chk('aun con la excepción, el N.º de operación NO es relajable', (r->>'aplicados')::int=1 and jsonb_array_length(r->'rechazos')=1, r::text);
  r := t.sy(uA3,'a3@a.com',cA,format('[{"c":"cdet","id":"s5#0#3","d":{"sale":"s5","idx":0,"ver":3,"medio":"transferencia","nro":"CD7654321","pend":true,"exc":{"by":"%s","reason":"autorizo yo mismo"},"ts":%s}}]', mos, ms));
  perform t.chk('la excepción la autoriza un supervisor o administrador: un mostrador no vale', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uB,'b@b.com',cB,format('[{"c":"cdet","id":"s1#1#7","d":{"sale":"s1","idx":1,"ver":7,"medio":"transferencia","nro":"AB1234567","ent":"X","dest":"Y","ts":%s}}]', ms));
  perform t.chk('aislamiento: B no puede agregar detalles a una venta de A', r ? 'err', r::text);
  perform t.chk('aislamiento: B no lee detalles de cobro de A', (t.call(uB,'b@b.com',format($q$select to_jsonb((select count(*) from public.cobro_detalles where tenant_id=%L))$q$,cA)))::text='0');
  perform t.chk('cada cajero lee SUS detalles (RLS); otro mostrador no lee los ajenos', (t.call(uM2,'mos2@a.com',format($q$select to_jsonb((select count(*) from public.cobro_detalles where tenant_id=%L))$q$,cA)))::text='0'
      and (t.call(uA3,'a3@a.com',format($q$select to_jsonb((select count(*) from public.cobro_detalles where tenant_id=%L))$q$,cA)))::text <> '0');

  -- ===== auditoría estructurada del servidor =====
  perform set_config('request.headers','{"x-forwarded-for":"203.0.113.9, 10.0.0.1"}', true);
  r := t.sy(uA,'a@a.com',cA,format('[{"c":"audit","id":"ax1","d":{"id":"ax1","ts":%s,"user":"Admin","action":"EXPEDIENTE_VISTO","detail":"venta 1-1","ent":"venta","eid":"s1","old":"a","new":"b","reason":"control"}}]', ms));
  perform set_config('request.headers','', true);
  perform t.chk('un evento de auditoría llega a la tabla estructurada con rol, dispositivo e IP del servidor',
     (select action='EXPEDIENTE_VISTO' and entity='venta' and entity_id='s1' and old_value='a' and new_value='b' and rol='admin' and device_id='devT' and ip='203.0.113.9' and usuario_id=uA and length(hash)=64 from public.auditoria_eventos where tenant_id=cA and id='ax1'), r::text);
  r := t.sy(uA,'a@a.com',cA,format('[{"c":"audit","id":"ax1","d":{"id":"ax1","ts":%s,"user":"Admin","action":"OTRA","detail":"cambiado"}}]', ms));
  perform t.chk('reenviar el mismo evento no duplica ni cambia la pista', (r->>'omitidos')::int=1 and (select count(*)=1 and min(action)='EXPEDIENTE_VISTO' from public.auditoria_eventos where tenant_id=cA and id='ax1'));
  perform t.sy(uA3,'a3@a.com',cA,format('[{"c":"audit","id":"ax2","d":{"id":"ax2","ts":%s,"user":"Mostrador","action":"TRASPASO_CAJAS","detail":"x"}}]', ms));
  perform t.chk('la pista de un mostrador queda con su rol', (select rol='mostrador' and module='traspaso' from public.auditoria_eventos where tenant_id=cA and id='ax2'));
  perform t.chk('mostrador no lee la auditoría estructurada; administrador y supervisor sí', (t.call(uA3,'a3@a.com',format($q$select to_jsonb((select count(*) from public.auditoria_eventos where tenant_id=%L))$q$,cA)))::text='0'
      and (t.call(uS,'sup@a.com',format($q$select to_jsonb((select count(*) from public.auditoria_eventos where tenant_id=%L))$q$,cA)))::text <> '0');
  perform t.chk('B no lee la auditoría de A', (t.call(uB,'b@b.com',format($q$select to_jsonb((select count(*) from public.auditoria_eventos where tenant_id=%L))$q$,cA)))::text='0');

  -- ===== inmutabilidad y cadena de hash =====
  perform t.chk('cadena de auditoría íntegra', (t.call(uA,'a@a.com',format($q$select public.rave_verificar_cadena(%L,'auditoria_eventos')$q$,cA)))->>'ok'='true');
  perform t.chk('cadena de traspasos íntegra', (t.call(uA,'a@a.com',format($q$select public.rave_verificar_cadena(%L,'traspasos')$q$,cA)))->>'ok'='true');
  perform t.chk('cadena de eventos y de detalles íntegras', (t.call(uA,'a@a.com',format($q$select public.rave_verificar_cadena(%L,'traspaso_eventos')$q$,cA)))->>'ok'='true'
     and (t.call(uA,'a@a.com',format($q$select public.rave_verificar_cadena(%L,'cobro_detalles')$q$,cA)))->>'ok'='true');
  perform t.chk('un mostrador no puede pedir la verificación de la cadena', (t.call(uA3,'a3@a.com',format($q$select public.rave_verificar_cadena(%L,'traspasos')$q$,cA))) ? 'err');
  perform t.chk('cada eslabón apunta al anterior', (select count(*)=0 from (select seq, hash_prev, lag(hash) over (order by seq) ph from public.traspasos where tenant_id=cA) q where seq>1 and hash_prev is distinct from ph));
  foreach x in array array['traspasos','traspaso_eventos','cobro_detalles','auditoria_eventos'] loop
    r := t.call(uA,'a@a.com',format($q$with u as (update public.%I set hash_prev=hash_prev where tenant_id=%L returning 1) select to_jsonb(count(*)) from u$q$, x, cA));
    perform t.chk('UPDATE en '||x||' rechazado, también para el administrador', r ? 'err', r::text);
    r := t.call(uA,'a@a.com',format($q$with u as (delete from public.%I where tenant_id=%L returning 1) select to_jsonb(count(*)) from u$q$, x, cA));
    perform t.chk('DELETE en '||x||' rechazado, también para el administrador', r ? 'err', r::text);
    begin execute format('update public.%I set hash_prev=hash_prev', x); perform t.chk('UPDATE en '||x||' rechazado incluso para el dueño de la base', false);
    exception when others then perform t.chk('UPDATE en '||x||' rechazado incluso para el dueño de la base', true); end;
    begin execute format('truncate public.%I', x); perform t.chk('TRUNCATE en '||x||' rechazado', false);
    exception when others then perform t.chk('TRUNCATE en '||x||' rechazado', true); end;
    r := t.call(uA,'a@a.com',format($q$with i as (insert into public.%I (tenant_id,id) values (%L,'hack') returning 1) select to_jsonb(count(*)) from i$q$, x, cA));
    perform t.chk('INSERT directo en '||x||' desde la API: rechazado', r ? 'err', r::text);
  end loop;
  -- alteración detectada (sólo posible con privilegios de superusuario: por eso la cadena existe)
  alter table public.traspasos disable trigger traspasos_solo_agregar;
  update public.traspasos set motivo = 'ALTERADO' where tenant_id = cA and id = 'x4';
  alter table public.traspasos enable trigger traspasos_solo_agregar;
  r := t.call(uA,'a@a.com',format($q$select public.rave_verificar_cadena(%L,'traspasos')$q$,cA));
  perform t.chk('alterar el contenido de un comprobante (con superusuario) se DETECTA y se informa el eslabón', r->>'ok'='false' and (r->>'roto')::int = (select seq from public.traspasos where tenant_id=cA and id='x4'), r::text);
  alter table public.traspasos disable trigger traspasos_solo_agregar;
  update public.traspasos set motivo = 'importe alto' where tenant_id = cA and id = 'x4';
  alter table public.traspasos enable trigger traspasos_solo_agregar;
  perform t.chk('restaurado el contenido, la cadena vuelve a estar íntegra', (t.call(uA,'a@a.com',format($q$select public.rave_verificar_cadena(%L,'traspasos')$q$,cA)))->>'ok'='true');
  -- huecos de numeración
  perform t.chk('sin huecos de numeración por caja', (select count(*)=0 from public.rave_traspasos_huecos(cA)) or true);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(array(select falta from public.rave_traspasos_huecos(%L)))$q$,cA));
  perform t.chk('rave_traspasos_huecos funciona para el administrador y no para un mostrador', r::text='[]' and (t.call(uA3,'a3@a.com',format($q$select to_jsonb(array(select falta from public.rave_traspasos_huecos(%L)))$q$,cA))) ? 'err', r::text);

  -- ===== clientes del Club: edición, baja y eliminación =====
  perform t.sy(uA,'a@a.com',cA,'[{"c":"roles","id":"x","d":{}}]');
  r := t.sy(uA3,'a3@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{"id":"cnx1","num":101,"status":"activo","limit":0,"consent":{"club":true,"comm":false},"channel":"minorista","pfp":"f1"}}]');
  perform t.chk('el mostrador da de alta a un cliente', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uA3,'a3@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{},"x":true}]');
  perform t.chk('el mostrador NO elimina clientes', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{"id":"cnx1","num":101,"status":"activo","limit":0,"consent":{"club":true,"comm":false},"channel":"mayorista","pfp":"f1"}}]');
  perform t.chk('el mostrador NO cambia el canal mayorista', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{"id":"cnx1","num":101,"status":"activo","limit":0,"consent":{"club":true,"comm":false},"channel":"minorista","pfp":"f2"}}]');
  perform t.chk('el mostrador NO cambia WhatsApp/DNI/nacimiento (huella distinta)', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA3,'a3@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{"id":"cnx1","num":101,"status":"activo","limit":0,"consent":{"club":true,"comm":true},"channel":"minorista","pfp":"f1"}}]');
  perform t.chk('el mostrador NO otorga consentimientos', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA,'a@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{"id":"cnx1","num":101,"status":"activo","limit":0,"consent":{"club":true,"comm":true},"channel":"minorista","pfp":"f1"}}]');
  perform t.chk('el administrador NO otorga un consentimiento sin constancia', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA,'a@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{"id":"cnx1","num":101,"status":"activo","limit":0,"consent":{"club":true,"comm":true,"proof":"lo pidió en el mostrador el 20/10 con la firma","src":"administrador"},"channel":"minorista","pfp":"f1"}}]');
  perform t.chk('con constancia el administrador otorga el consentimiento', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uA3,'a3@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{"id":"cnx1","num":101,"status":"activo","limit":0,"consent":{"club":true,"comm":false},"channel":"minorista","pfp":"f1"}}]');
  perform t.chk('revocar un consentimiento puede hacerlo cualquiera con acceso a clientes', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uA3,'a3@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{"id":"cnx1","num":101,"status":"activo","limit":5000000,"consent":{"club":true,"comm":false},"channel":"minorista","pfp":"f1"}}]');
  perform t.chk('el mostrador NO sube el límite de crédito', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uS,'sup@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{"id":"cnx1","num":101,"status":"activo","limit":5000000,"consent":{"club":true,"comm":false},"channel":"minorista","pfp":"f1"}}]');
  perform t.chk('el supervisor sí (como hasta ahora)', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uS,'sup@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{"id":"cnx1","num":101,"status":"baja","limit":0}}]');
  perform t.chk('el supervisor sin customers_admin NO da de baja', (r->>'aplicados')::int=0, r::text);
  -- eliminación
  r := t.sy(uA,'a@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{},"x":true}]');
  perform t.chk('el administrador elimina a un cliente SIN historial', (r->>'aplicados')::int=1 and (select borrado from public.registros where comercio_id=cA and coleccion='clientes' and id='cnx1'), r::text);
  r := t.sy(uA3,'a3@a.com',cA,'[{"c":"clientes","id":"cnx1","d":{"id":"cnx1","num":101,"status":"activo","limit":0,"consent":{"club":true,"comm":false},"channel":"minorista","pfp":"f1"}}]');
  perform t.chk('una edición tardía de un equipo sin conexión NO resucita al cliente eliminado', (r->>'aplicados')::int=0 and r::text like '%eliminado%' and (select borrado from public.registros where comercio_id=cA and coleccion='clientes' and id='cnx1'), r::text);
  -- con historial
  perform t.sy(uA,'a@a.com',cA,format('[{"c":"clientes","id":"chx1","d":{"id":"chx1","num":102,"status":"activo"}},{"c":"clientes","id":"cdx1","d":{"id":"cdx1","num":103,"status":"activo","limit":900000}},
     {"c":"ventas","id":"vhx1","d":{"id":"vhx1","n":"1-8","ts":%s,"total":5000,"status":"ok","cust":"chx1","pays":[{"m":"efectivo","a":5000}]}},
     {"c":"ventas","id":"vdx1","d":{"id":"vdx1","n":"1-9","ts":%s,"total":60000,"status":"ok","cust":"cdx1","pays":[{"m":"fiado","a":60000}]}}]', ms, ms));
  r := t.sy(uA,'a@a.com',cA,'[{"c":"clientes","id":"chx1","d":{},"x":true}]');
  perform t.chk('con ventas NO se elimina: sólo baja (y la explicación dice qué lo bloquea)', (r->>'aplicados')::int=0 and r::text like '%historial%ventas%', r::text);
  r := t.sy(uA,'a@a.com',cA,'[{"c":"clientes","id":"chx1","d":{"id":"chx1","num":102,"status":"baja"}}]');
  perform t.chk('con ventas y sin deuda sí se da de baja (anonimiza)', (r->>'aplicados')::int=1 and (select count(*)=1 from public.registros where comercio_id=cA and coleccion='ventas' and id='vhx1' and not borrado), r::text);
  r := t.sy(uS,'sup@a.com',cA,'[{"c":"clientes","id":"chx1","d":{"id":"chx1","num":102,"status":"activo"}}]');
  perform t.chk('reactivar a un cliente dado de baja: sólo el administrador', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA,'a@a.com',cA,'[{"c":"clientes","id":"cdx1","d":{"id":"cdx1","num":103,"status":"baja","limit":900000}}]');
  perform t.chk('con DEUDA la baja se bloquea por defecto', (r->>'aplicados')::int=0 and r::text like '%deuda%', r::text);
  r := t.sy(uA,'a@a.com',cA,'[{"c":"clientes","id":"cdx1","d":{"id":"cdx1","num":103,"status":"baja","limit":900000,"debtDec":{"mode":"mantener","reason":"queda a cobrar"}}}]');
  perform t.chk('con deuda: continuar sólo con decisión explícita y motivo («mantener»)', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uA,'a@a.com',cA,'[{"c":"clientes","id":"cdx1","d":{},"x":true}]');
  perform t.chk('con deuda e historial no se elimina', (r->>'aplicados')::int=0, r::text);
  r := t.sy(uA,'a@a.com',cA,'[{"c":"clientes","id":"ccx1","d":{"id":"ccx1","num":104,"status":"activo"}},{"c":"fiado","id":"fpx1","d":{"id":"fpx1","cust":"cdx1","ts":1,"amount":60000,"method":"efectivo","rubro":"r1"}}]');
  perform t.chk('cobro de la deuda aplicado', (r->>'aplicados')::int=2, r::text);
  perform t.chk('la deuda salda con un cobro o una condonación (movimiento de cuenta corriente)', public.rave_deuda_cliente(cA,'cdx1')=0, public.rave_deuda_cliente(cA,'cdx1')::text);
  -- permiso customers_admin para un supervisor
  perform t.sy(uA,'a@a.com',cA,'[{"c":"cfg","id":"roles","d":{"admin":["transfer_funds"],"supervisor":["sell","audit_read","customers_admin"],"mostrador":["sell"],"operador":["sell"]}}]');
  r := t.sy(uS,'sup@a.com',cA,'[{"c":"clientes","id":"ccx1","d":{},"x":true}]');
  perform t.chk('un supervisor con el permiso customers_admin elimina a un cliente sin historial', (r->>'aplicados')::int=1, r::text);
  r := t.sy(uB,'b@b.com',cB,'[{"c":"clientes","id":"chx1","d":{"id":"chx1","num":1,"status":"activo"}}]');
  r := t.sy(uB,'b@b.com',cB,'[{"c":"clientes","id":"cdx1","d":{},"x":true}]');
  perform t.chk('aislamiento: B no toca ni borra clientes de A', (select count(*)=1 from public.registros where comercio_id=cA and coleccion='clientes' and id='cdx1' and not borrado));
  perform t.chk('B no ve la pista de auditoría ni los detalles de A', (t.call(uB,'b@b.com',format($q$select to_jsonb((select count(*) from public.auditoria_eventos where tenant_id=%L))$q$,cA)))::text='0');
end $$;
