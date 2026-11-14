-- 29-omnicanal-finanzas.sql: OAuth (tokens fuera del alcance de todos), eventos y webhooks firmados, claves de API, Mercado Pago Point, colecciones nuevas
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uB uuid := '00000000-0000-0000-0000-00000000000b'; uM uuid := '00000000-0000-0000-0000-0000000000a3'; uC uuid := '00000000-0000-0000-0000-0000000000c7';
  cA uuid := t.ctxget('cA')::uuid; r jsonb; n int; k text; whid uuid; ev bigint;
begin
  -- OAuth
  insert into public.oauth_cuentas (comercio_id, proveedor, cuenta, token_cif, expira, datos) values (cA, 'google', 'ventas@almacen.com', 'CIFRADO-xyz', now() + interval '1 hour', '{"canales":["mail"]}') on conflict do nothing;
  r := t.call(uA,'a@a.com',$q$select to_jsonb(count(*)) from public.oauth_cuentas$q$);
  perform t.chk('37: nadie del equipo lee la tabla de tokens', r ? 'err', r::text);
  r := t.call(null,'',$q$select to_jsonb(count(*)) from public.oauth_cuentas$q$,'anon');
  perform t.chk('37: anon tampoco', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.oauth_cuentas_ver(%L)$q$,cA));
  perform t.chk('37: el equipo ve las cuentas conectadas SIN tokens', jsonb_array_length(r)=1 and r->0->>'cuenta'='ventas@almacen.com' and not (r->0 ? 'token_cif') and r::text not like '%CIFRADO%', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.oauth_cuentas_ver(%L)$q$,cA));
  perform t.chk('37: otro comercio no ve las cuentas', r ? 'err');
  -- webhooks
  r := t.call(uM,'a3@a.com',format($q$select public.wh_crear(%L,'https://hooks.ejemplo.com/vb',array['sale.created'])$q$,cA));
  perform t.chk('37: el mostrador no crea webhooks', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.wh_crear(%L,'http://inseguro.com/x',array['sale.created'])$q$,cA));
  perform t.chk('37: webhook sin https se rechaza', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.wh_crear(%L,'https://localhost/x',array['sale.created'])$q$,cA));
  perform t.chk('37: webhook a una red interna se rechaza', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.wh_crear(%L,'https://hooks.ejemplo.com/vb',array['borrar.todo'])$q$,cA));
  perform t.chk('37: evento inventado se rechaza', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.wh_crear(%L,'https://hooks.ejemplo.com/vb',array['sale.created','contact.created','conversation.closed','message.received'])$q$,cA));
  perform t.chk('37: el administrador crea el webhook y ve el secreto una vez', r->>'secreto' like 'whsec_%', r::text);
  whid := (r->>'id')::uuid;
  r := t.call(uA,'a@a.com',format($q$select public.wh_listar(%L)$q$,cA));
  perform t.chk('37: el listado no muestra el secreto', r::text not like '%whsec_%' and jsonb_array_length(r)>=1, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"ventas","id":"v37","d":{"n":"V-37","total":12345,"status":"ok","cust":"secreto"}},{"c":"clientes","id":"cl37","d":{"num":37}}]'::jsonb)$q$,cA));
  perform t.chk('37: una venta y un cliente nuevos generan sus eventos solos', exists(select 1 from public.vb_eventos where comercio_id=cA and evento='sale.created' and datos->>'id'='v37' and (datos->>'total_centavos')::bigint=12345) and exists(select 1 from public.vb_eventos where comercio_id=cA and evento='contact.created' and datos->>'id'='cl37'), r::text);
  perform t.chk('37: el evento no lleva datos personales', not exists(select 1 from public.vb_eventos where comercio_id=cA and datos::text like '%secreto%'));
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"conv","id":"cv37","d":{"state":"proceso","chan":"wa"}}]'::jsonb)$q$,cA));
  select count(*) into n from public.vb_eventos where comercio_id=cA and evento='conversation.closed';
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"conv","id":"cv37","d":{"state":"cerrado","chan":"wa"}}]'::jsonb)$q$,cA));
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"conv","id":"cv37","d":{"state":"cerrado","chan":"wa","x":1}}]'::jsonb)$q$,cA));
  perform t.chk('37: cerrar una conversación emite el evento una sola vez', (select count(*) from public.vb_eventos where comercio_id=cA and evento='conversation.closed')=n+1);
  insert into public.crm_entrantes (comercio_id, conv, cifrado) values (cA, 'wwa-ABCDEFGHIJKLMNOPQRSTUVWX', '{}'::jsonb);
  perform t.chk('37: un mensaje que entra emite message.received con el canal', exists(select 1 from public.vb_eventos where comercio_id=cA and evento='message.received' and datos->>'canal'='wa'));
  select count(*) into n from public.wh_cola where destino_id=whid;
  perform t.chk('37: cada evento queda en la cola del webhook', n>=4, n::text);
  r := t.call(uA,'a@a.com',$q$select to_jsonb(count(*)) from public.wh_tomar(10)$q$);
  perform t.chk('37: el equipo no puede tomar la cola (sólo la función con la clave de servicio)', r ? 'err');
  select count(*) into n from public.wh_tomar(100);
  perform t.chk('37: el trabajador toma los pendientes', n>=4);
  select id into ev from public.wh_cola where destino_id=whid and estado='enviando' limit 1;
  perform public.wh_resultado(ev, false, 500);
  perform t.chk('37: un error se reintenta más tarde', (select estado='pendiente' and due>now() from public.wh_cola where id=ev));
  select id into ev from public.wh_cola where destino_id=whid and estado='enviando' limit 1;
  perform public.wh_resultado(ev, true, 200);
  perform t.chk('37: un envío exitoso queda registrado', (select estado from public.wh_cola where id=ev)='enviado');
  -- claves de API
  r := t.call(uA,'a@a.com',format($q$select public.api_clave_crear(%L,'Mi ERP',array['borrar:todo'])$q$,cA));
  perform t.chk('37: alcance inventado se rechaza', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.api_clave_crear(%L,'Mi ERP',array['eventos:leer'])$q$,cA));
  k := r->>'clave';
  perform t.chk('37: la clave se entrega una vez y se guarda sólo su huella', k like 'vb_%' and not exists(select 1 from public.api_claves where huella=k or prefijo=k), r::text);
  r := public.api_eventos(k, 0, 50);
  perform t.chk('37: con la clave se leen los eventos de SU comercio', (r->>'ok')::boolean and jsonb_array_length(r->'eventos')>=4, left(r::text,200));
  r := public.api_eventos('vb_inventada', 0, 50);
  perform t.chk('37: una clave inventada no lee nada', not (r->>'ok')::boolean);
  r := t.call(uA,'a@a.com',format($q$select public.api_claves_listar(%L)$q$,cA));
  perform t.chk('37: el listado no muestra la clave', r::text not like '%'||k||'%' and jsonb_array_length(r)=1, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.api_clave_revocar(%L,%L)$q$,cA,(select id from public.api_claves where comercio_id=cA limit 1)));
  r := public.api_eventos(k, 0, 50);
  perform t.chk('37: una clave revocada deja de funcionar', not (r->>'ok')::boolean);
  r := t.call(uA,'a@a.com',$q$select public.api_eventos('x',0,1)$q$);
  perform t.chk('37: la lectura por clave sólo la hace la función', r ? 'err');
  -- Mercado Pago Point
  insert into public.mp_pagos (id, comercio_id, monto, neto, estado, medio, fecha) values ('123456789', cA, 150000, 145000, 'approved', 'debit_card', now()) on conflict do nothing;
  r := t.call(uA,'a@a.com',format($q$select public.mp_pagos_leer(%L,null)$q$,cA));
  perform t.chk('37: el administrador ve los cobros de Mercado Pago Point', jsonb_array_length(r)=1 and (r->0->>'monto')::bigint=150000, r::text);
  r := t.call(uM,'a3@a.com',format($q$select public.mp_pagos_leer(%L,null)$q$,cA));
  perform t.chk('37: el mostrador no', r ? 'err');
  r := t.call(uB,'b@b.com',format($q$select public.mp_pagos_leer(%L,null)$q$,cA));
  perform t.chk('37: otro comercio no', r ? 'err');
  -- colecciones nuevas
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"finmov","id":"fm37","d":{"monto":100}},{"c":"finrem","id":"fr37","d":{}},{"c":"kb","id":"kb37","d":{"t":"Horarios"}}]'::jsonb)$q$,cA));
  perform t.chk('37: sincroniza movimientos de banco, recordatorios y base de conocimiento', (r->>'aplicados')::int=3, r::text);
  perform t.chk('37: el supervisor también; el mostrador no', public.rave_puede_escribir('supervisor','kb','x') and not public.rave_puede_escribir('mostrador','finmov','x'));
  r := t.call(uA,'a@a.com',format($q$select public.vb_urls(%L,'https://evil.com')$q$,cA));
  perform t.chk('37: las direcciones de las funciones sólo pueden ser de Supabase', r ? 'err');
end $$;
