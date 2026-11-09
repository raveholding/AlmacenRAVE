-- 22-crm.sql: chat web del menú (anónimo, cifrado), respuestas del equipo, colecciones conv/cmsg
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a';
  uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid; r jsonb; cv text := 'wconv30abcdefghijklmn'; n int;
begin
  r := t.call(null,'',format($q$select public.crm_web_enviar('comercio-a',%L,'{"k":"x","iv":"y","ct":"z"}'::jsonb)$q$,cv),'anon');
  perform t.chk('30: el cliente escribe por el chat web sin cuenta', (r->>'ok')::boolean, r::text);
  r := t.call(null,'',$q$select public.crm_web_enviar('comercio-a','malo','{"k":"x","iv":"y","ct":"z"}'::jsonb)$q$,'anon');
  perform t.chk('30: identificador de chat inválido rechazado', not coalesce((r->>'ok')::boolean,true), r::text);
  r := t.call(null,'',format($q$select public.crm_web_enviar('comercio-a',%L,'{"texto":"hola en claro"}'::jsonb)$q$,cv),'anon');
  perform t.chk('30: un mensaje sin cifrar se rechaza', not coalesce((r->>'ok')::boolean,true), r::text);
  r := t.call(null,'',format($q$select public.crm_web_enviar('no-existe',%L,'{"k":"x","iv":"y","ct":"z"}'::jsonb)$q$,cv),'anon');
  perform t.chk('30: comercio inexistente', not coalesce((r->>'ok')::boolean,true), r::text);
  r := t.call(null,'',$q$select to_jsonb(count(*)) from public.crm_entrantes$q$,'anon');
  perform t.chk('30: anon no lee los mensajes entrantes', r ? 'err', r::text);
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.crm_entrantes where comercio_id=%L$q$,cA));
  perform t.chk('30: otro comercio no ve los mensajes de A', coalesce((r->>'r')::int,(r#>>'{}')::int,0)=0 or r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(count(*)) from public.crm_entrantes where comercio_id=%L$q$,cA));
  perform t.chk('30: el equipo de A ve su mensaje', r::text ~ '1', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.crm_web_responder(%L,%L,'{"iv":"a","ct":"b"}'::jsonb)$q$,cA,cv));
  perform t.chk('30: otro comercio no puede responder el chat de A', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.crm_web_responder(%L,'wnoexiste30abcdefghij','{"iv":"a","ct":"b"}'::jsonb)$q$,cA));
  perform t.chk('30: no se responde un chat que no existe', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.crm_web_responder(%L,%L,'{"iv":"a","ct":"b"}'::jsonb)$q$,cA,cv));
  perform t.chk('30: el equipo responde', not (r ? 'err'), r::text);
  r := t.call(null,'',format($q$select public.crm_web_leer('comercio-a',%L,0)$q$,cv),'anon');
  perform t.chk('30: el cliente lee la respuesta de su chat', r::text ~ '"ct"', r::text);
  r := t.call(null,'',$q$select public.crm_web_leer('comercio-a','wotrochat30abcdefghij',0)$q$,'anon');
  perform t.chk('30: otro chat no ve nada', r::text !~ '"ct"', r::text);
  r := t.call(null,'',$q$select to_jsonb(count(*)) from public.crm_salientes$q$,'anon');
  perform t.chk('30: anon no lee la tabla de respuestas', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devT30','[{"c":"conv","id":"cv30","d":{"id":"cv30","chan":"wa","state":"abierta"}},{"c":"cmsg","id":"m30","d":{"id":"m30","conv":"cv30","dir":"out"}}]'::jsonb)$q$,cA));
  perform t.chk('30: conv y cmsg se sincronizan', r::text !~ 'colecci', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devT30','[{"c":"cmsg","id":"m30","d":{"id":"m30","conv":"cv30","dir":"in"}}]'::jsonb)$q$,cA));
  perform t.chk('30: un mensaje ya guardado no se reescribe', r::text ~ '(una vez|ya existe|inmutable|rechaz)', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.crm_entrantes_marcar(%L,array(select id from public.crm_entrantes where comercio_id=%L),'importada')$q$,cA,cA));
  perform t.chk('30: el equipo marca los mensajes importados', r::text ~ '1', r::text);
end $$;
