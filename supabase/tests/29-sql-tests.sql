-- 21-tarjeta-digital.sql: club_estado devuelve el saldo del monedero sin datos personales
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a';
  cA uuid := t.ctxget('cA')::uuid; slug text; r jsonb;
begin
  select c.slug into slug from public.comercios c where c.id=cA;
  r := t.call(uA,'a@a.com',format($q$select public.sincronizar(%L,'devT29','[{"c":"clientes","id":"tarjeta29abcdefgh","d":{"id":"tarjeta29abcdefgh","num":29,"status":"activo"}},{"c":"fidmov","id":"f29a","d":{"id":"f29a","cust":"tarjeta29abcdefgh","kind":"carga","amount":300000}},{"c":"fidmov","id":"f29b","d":{"id":"f29b","cust":"tarjeta29abcdefgh","kind":"pago","amount":-50000}}]'::jsonb)$q$,cA));
  r := public.club_estado(slug,'tarjeta29abcdefgh');
  perform t.chk('29: club_estado devuelve el saldo del monedero (2.500,00)', (r->>'saldo')::numeric=250000 and (r->>'socio')::boolean, r::text);
  perform t.chk('29: sin datos personales', not (r ? 'name') and not (r ? 'wa') and not (r ? 'dni') and not (r ? 'birth'), r::text);
  r := public.club_estado(slug,'noexiste29abcdef');
  perform t.chk('29: tarjeta desconocida no es socio y no tiene saldo', not coalesce((r->>'socio')::boolean,false) and not (r ? 'saldo'), r::text);
end $$;
