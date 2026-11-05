-- 17-fiado-cc-cortes.sql: cortes X (escritura única, todos los roles de caja) y tipo de deuda de la venta
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3';
  uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid; r jsonb; rol3 text;
  sync text := $q$select public.sincronizar(%L,'devCX',%L::jsonb)$q$;
begin
  select rol into rol3 from public.miembros where comercio_id=cA and usuario_id=uA3;
  if rol3 is null then insert into public.miembros(comercio_id,usuario_id,rol,email,nombre) values (cA,uA3,'mostrador','a3@a.com','Caja CX'); end if;
  update public.miembros set rol='mostrador' where comercio_id=cA and usuario_id=uA3;
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"cortesx","id":"x1","d":{"id":"x1","n":"X-1-1","total":900000,"expectedCash":950000}}]'));
  perform t.chk('17: el mostrador guarda un corte X', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"cortesx","id":"x1","d":{"id":"x1","n":"X-1-1","total":1,"expectedCash":1}}]'));
  perform t.chk('17: el corte X no se modifica (escritura única)', (r->>'omitidos')::int=1 and (select datos->>'total' from public.registros where comercio_id=cA and coleccion='cortesx' and id='x1')='900000', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"cortesx","id":"x1","x":true,"d":{}}]'));
  perform t.chk('17: el corte X no se borra', (r->>'aplicados')::int=0 and exists(select 1 from public.registros where comercio_id=cA and coleccion='cortesx' and id='x1' and not borrado), r::text);
  r := t.call(uB,'b@b.com',format($q$select coalesce(jsonb_agg(id),'[]') from public.registros where comercio_id=%L and coleccion='cortesx'$q$,cA));
  perform t.chk('17: otro comercio NO ve los cortes X (RLS)', r::text not like '%x1%', r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vck1","d":{"id":"vck1","n":"1-951","total":200000,"status":"ok","method":"efectivo","ck":"fiado","items":[],"pays":[{"m":"efectivo","a":200000}]}}]'));
  perform t.chk('17: venta con ck=fiado aceptada', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vck2","d":{"id":"vck2","n":"1-952","total":200000,"status":"ok","method":"efectivo","ck":"cc","items":[],"pays":[{"m":"efectivo","a":200000}]}}]'));
  perform t.chk('17: venta con ck=cc aceptada', (r->>'aplicados')::int=1, r::text);
  r := t.call(uA3,'a3@a.com',format(sync,cA,'[{"c":"ventas","id":"vck3","d":{"id":"vck3","n":"1-953","total":200000,"status":"ok","method":"efectivo","ck":"otro","items":[],"pays":[{"m":"efectivo","a":200000}]}}]'));
  perform t.chk('17: tipo de deuda inválido → rechazada', (r->>'aplicados')::int=0 and r::text like '%tipo de deuda%', r::text);
  perform t.chk('17: payadj de 16 sigue en sincronizar', position('''payadj''' in pg_get_functiondef('public.sincronizar(uuid,text,jsonb)'::regprocedure))>0);
  if rol3 is null then delete from public.miembros where comercio_id=cA and usuario_id=uA3; else update public.miembros set rol=rol3 where comercio_id=cA and usuario_id=uA3; end if;
end $$;
