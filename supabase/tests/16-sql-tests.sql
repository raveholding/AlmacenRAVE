-- 09-club-tarjeta.sql: estado de la tarjeta del Club para el celular del cliente (anónimo)
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a';
  uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := (select comercio_id from public.miembros where usuario_id='00000000-0000-0000-0000-00000000000a' limit 1);
  cB uuid := (select comercio_id from public.miembros where usuario_id='00000000-0000-0000-0000-00000000000b' limit 1);
  slugA text := (select slug from public.comercios where id=(select comercio_id from public.miembros where usuario_id='00000000-0000-0000-0000-00000000000a' limit 1));
  slugB text := (select slug from public.comercios where id=(select comercio_id from public.miembros where usuario_id='00000000-0000-0000-0000-00000000000b' limit 1));
  r jsonb; sync text := $q$select public.sincronizar(%L,'dev1',%L::jsonb)$q$;
  cid text := 'k0123456789abcdef0123'; cidAlias text := 'kalias9876543210zyx'; cidBaja text := 'kbaja000000000000001';
begin
  -- el equipo sincroniza un socio (con una tarjeta alias), sellos de ese socio y un socio de baja; el otro comercio tiene un socio propio
  perform t.call(uA,'a@a.com',format(sync,cA,format($j$[
    {"c":"clientes","id":"%s","d":{"id":"%s","num":7,"status":"activo","cards":["%s"],"__pii":{"ct":"x"}}},
    {"c":"clientes","id":"%s","d":{"id":"%s","num":8,"status":"baja"}},
    {"c":"sellos","id":"sl1","d":{"id":"sl1","cust":"%s","n":1,"kind":"stamp","ts":1}},
    {"c":"sellos","id":"sl2","d":{"id":"sl2","cust":"%s","n":1,"kind":"stamp","ts":2}},
    {"c":"sellos","id":"sl3","d":{"id":"sl3","cust":"%s","n":-1,"kind":"adjust","ts":3}},
    {"c":"sellos","id":"sl4","d":{"id":"sl4","cust":"%s","n":1,"kind":"stamp","ts":4}}]$j$,cid,cid,cidAlias,cidBaja,cidBaja,cid,cid,cid,cidBaja)));
  perform t.call(uB,'b@b.com',format(sync,cB,'[{"c":"clientes","id":"kotrocomercio00000001","d":{"id":"kotrocomercio00000001","num":1,"status":"activo"}}]'));

  r := t.call(null,'',format($q$select public.club_estado(%L,%L)$q$,slugA,cid),'anon');
  perform t.chk('anon: la tarjeta del socio devuelve su N.º y sus sellos (1+1-1 = 1)', r->>'socio'='true' and (r->>'num')='7' and (r->>'sellos')::numeric=1, r::text);
  r := t.call(null,'',format($q$select public.club_estado(%L,%L)$q$,slugA,cidAlias),'anon');
  perform t.chk('anon: una tarjeta alias devuelve el mismo socio', r->>'socio'='true' and (r->>'num')='7' and (r->>'sellos')::numeric=1, r::text);
  r := t.call(null,'',format($q$select public.club_estado(%L,%L)$q$,slugA,'kinexistente00000000'),'anon');
  perform t.chk('anon: identificador desconocido = "todavía no es socio" (sin pistas)', r->>'ok'='true' and r->>'socio'='false' and not (r ? 'num'), r::text);
  r := t.call(null,'',format($q$select public.club_estado(%L,%L)$q$,slugA,cidBaja),'anon');
  perform t.chk('un socio dado de baja ya no devuelve datos', r->>'socio'='false' and not (r ? 'num'), r::text);
  r := t.call(null,'',format($q$select public.club_estado(%L,%L)$q$,slugB,cid),'anon');
  perform t.chk('aislamiento: el identificador del comercio A no existe en el B', r->>'socio'='false', r::text);
  r := t.call(null,'',format($q$select public.club_estado(%L,%L)$q$,slugA,'kotrocomercio00000001'),'anon');
  perform t.chk('aislamiento: el socio del B no se ve desde el slug del A', r->>'socio'='false', r::text);
  r := t.call(null,'',format($q$select public.club_estado(%L,%L)$q$,slugA,'corto'),'anon');
  perform t.chk('identificador demasiado corto: rechazado', r->>'ok'='false', r::text);
  r := t.call(null,'',format($q$select public.club_estado(%L,%L)$q$,slugA,'x'' or ''1''=''1'' --a'),'anon');
  perform t.chk('inyección en el identificador: rechazada', r->>'ok'='false', r::text);
  r := t.call(null,'',format($q$select public.club_estado(%L,%L)$q$,'no-existe',cid),'anon');
  perform t.chk('comercio inexistente: ok=false', r->>'ok'='false', r::text);
  r := t.call(null,'',format($q$select public.club_estado(%L,%L)$q$,slugA,cid),'anon');
  perform t.chk('la respuesta no trae nombre, WhatsApp, DNI ni cumpleaños', not (r ? 'name') and not (r ? 'wa') and not (r ? 'dni') and not (r ? 'birth') and not (r::text like '%__pii%'), r::text);
  r := public.rave_limpiar_menu('{"site":{},"loyalty":{"goal":"5","reward":"Una birra","x":"y"},"catalog":{}}'::jsonb);
  perform t.chk('el menú publicado lleva la meta y el premio del club (y nada más del bloque)', (r->'loyalty'->>'goal')='5' and r->'loyalty'->>'reward'='Una birra' and not (r->'loyalty' ? 'x'), r::text);
  r := public.rave_limpiar_menu('{"loyalty":{"goal":"99","reward":"a"}}'::jsonb);
  perform t.chk('meta del club acotada (2..30)', (r->'loyalty'->>'goal')::int=30, r::text);
  r := public.rave_limpiar_menu('{"loyalty":{"goal":"999","reward":"a"}}'::jsonb);
  perform t.chk('meta absurda (3 cifras): valor por defecto', (r->'loyalty'->>'goal')::int=10, r::text);
  r := public.rave_limpiar_menu('{"loyalty":{"goal":"x; drop"}}'::jsonb);
  perform t.chk('meta inválida: vuelve al valor por defecto', (r->'loyalty'->>'goal')::int=10, r::text);
end $$;
