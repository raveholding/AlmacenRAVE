-- 31-pipeline.sql: colección «deal» y vb_version() = 31
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uB uuid := '00000000-0000-0000-0000-00000000000b';
  uP uuid := '00000000-0000-0000-0000-0000000000e1'; cA uuid := t.ctxget('cA')::uuid; r jsonb;
begin
  r := t.call(uA,'a@a.com',$q$select to_jsonb(public.vb_version())$q$);
  perform t.chk('39: vb_version() >= 31', r::text::int>=31, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"deal","id":"op1","d":{"n":"OP-0001","stage":"propuesta"}}]'::jsonb)$q$,cA));
  perform t.chk('39: el admin sube oportunidades', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"deal","id":"op1","d":{"n":"OP-0001","stage":"negociacion"}}]'::jsonb)$q$,cA));
  perform t.chk('39: una oportunidad cambia de etapa', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devA','[{"c":"deal","id":"op1","d":{},"x":true}]'::jsonb)$q$,cA));
  perform t.chk('39: las oportunidades no se borran en la nube', coalesce((r->>'aplicados')::int,0)=0, r::text);
  perform t.chk('39: supervisor, mostrador y operador escriben oportunidades', public.rave_puede_escribir('supervisor','deal','x') and public.rave_puede_escribir('mostrador','deal','x') and public.rave_puede_escribir('operador','deal','x'));
  perform t.chk('39: preventista, depósito, repartidor y contador no', not public.rave_puede_escribir('preventista','deal','x') and not public.rave_puede_escribir('deposito','deal','x') and not public.rave_puede_escribir('repartidor','deal','x') and not public.rave_puede_escribir('contador','deal','x'));
  perform t.chk('39: lo del 30 sigue igual', public.rave_puede_escribir('mostrador','pedv','x') and public.rave_puede_escribir('preventista','visit','x') and not public.rave_puede_escribir('mostrador','vale','x'));
  r := t.call(uB,'b@b.com',format($q$select public.sincronizar(%L,'devB','[{"c":"deal","id":"op9","d":{}}]'::jsonb)$q$,cA));
  perform t.chk('39: otro comercio no escribe oportunidades ajenas', r ? 'err' or coalesce((r->>'aplicados')::int,0)=0, r::text);
end $$;
