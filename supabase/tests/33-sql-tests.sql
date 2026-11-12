\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
-- 25 · sello por chip NFC en el mostrador
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uB uuid := '00000000-0000-0000-0000-00000000000b';
  uA6 uuid := '00000000-0000-0000-0000-0000000000a6';
  cA uuid := t.ctxget('cA')::uuid; slugA text; r jsonb; tok text := 'pPUNTOdeSELLO1234567'; box text := '{"k":"a","iv":"b","ct":"c"}';
begin
  select slug into slugA from public.comercios where id=cA;
  r := t.call(uA6,'a6@a.com',format($q$select public.sello_punto_guardar(%L,%L,'Mostrador',true)$q$, cA, tok));
  perform t.chk('25: un mostrador NO crea puntos de sello', r ? 'err');
  r := t.call(uB,'b@b.com',format($q$select public.sello_punto_guardar(%L,%L,'Mostrador',true)$q$, cA, tok));
  perform t.chk('25: el admin de otro comercio NO crea puntos ajenos', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.sello_punto_guardar(%L,'malo','Mostrador',true)$q$, cA));
  perform t.chk('25: token inválido se rechaza', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.sello_punto_guardar(%L,%L,'Mostrador',true)$q$, cA, tok));
  perform t.chk('25: el admin crea el punto', not (r ? 'err'), r::text);
  r := t.call(null,'',format($q$select public.club_pedir_sello(%L,'pNOEXISTE12345678901','refrefrefrefrefref01',%L::jsonb)$q$, slugA, box),'anon');
  perform t.chk('25: punto inexistente no acepta pedidos', (r->'v'->>'ok')='false' or (r->>'ok')='false' or r::text like '%"ok": false%', r::text);
  r := t.call(null,'',format($q$select public.club_pedir_sello(%L,%L,'refrefrefrefrefref01','{"x":1}'::jsonb)$q$, slugA, tok),'anon');
  perform t.chk('25: pedido sin cifrar se rechaza', r::text like '%"ok": false%', r::text);
  r := t.call(null,'',format($q$select public.club_pedir_sello(%L,%L,'refrefrefrefrefref01',%L::jsonb)$q$, slugA, tok, box),'anon');
  perform t.chk('25: el celular (anon) pide el sello', r::text like '%"ok": true%', r::text);
  perform t.chk('25: queda guardado como nuevo', (select estado from public.sello_pedidos where ref='refrefrefrefrefref01')='nuevo');
  r := t.call(null,'',format($q$select public.club_sello_estado(%L,'refrefrefrefrefref01')$q$, slugA),'anon');
  perform t.chk('25: el celular ve su estado (sin datos personales)', r::text like '%nuevo%' and r::text not like '%cifrado%', r::text);
  r := t.call(null,'',$q$select count(*) from public.sello_pedidos$q$,'anon');
  perform t.chk('25: anon no lee la tabla de pedidos', r ? 'err');
  r := t.call(uB,'b@b.com',format($q$select public.sello_resolver(%L,(select id from public.sello_pedidos where ref='refrefrefrefrefref01'),'aprobado','x')$q$, cA));
  perform t.chk('25: otro comercio no resuelve pedidos ajenos', r ? 'err');
  r := t.call(uA6,'a6@a.com',format($q$select public.sello_resolver(%L,(select id from public.sello_pedidos where ref='refrefrefrefrefref01'),'aprobado','Tenés 3 de 8 sellos')$q$, cA));
  perform t.chk('25: el mostrador resuelve el pedido', not (r ? 'err'), r::text);
  r := t.call(null,'',format($q$select public.club_sello_estado(%L,'refrefrefrefrefref01')$q$, slugA),'anon');
  perform t.chk('25: el celular ve «aprobado» y el detalle', r::text like '%aprobado%' and r::text like '%3 de 8%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sello_punto_guardar(%L,%L,'Mostrador',false)$q$, cA, tok));
  r := t.call(null,'',format($q$select public.club_pedir_sello(%L,%L,'refrefrefrefrefref02',%L::jsonb)$q$, slugA, tok, box),'anon');
  perform t.chk('25: punto desactivado deja de aceptar pedidos', r::text like '%"ok": false%', r::text);
end $$;
