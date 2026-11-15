-- 33-licencias-combos.sql: combos de la web, extras, y la licencia nunca bloquea (solo avisa)
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a';
  uV uuid := '00000000-0000-0000-0000-0000000000f1'; cA uuid := t.ctxget('cA')::uuid; r jsonb;
begin
  insert into public.vb_staff(email) values ('vb@vb.com') on conflict do nothing;
  r := t.call(uA,'a@a.com',$q$select to_jsonb(public.vb_version())$q$);
  perform t.chk('41: vb_version() = 33', r::text='33', r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'completo','{ia,nfc,turnos}','activa',current_date+30)$q$,cA));
  perform t.chk('41: combo Completo con extras Pro + IA, NFC y turnos', r->>'plan'='completo' and r->'paquetes'='["ia","nfc","turnos"]'::jsonb and r->>'aviso' is null and (r->>'bloquea')::boolean=false, r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'completo_app','{}','activa',current_date+3)$q$,cA));
  perform t.chk('41: aviso de vencimiento próximo (3 días)', r->>'aviso' like 'El mantenimiento mensual vence el%' and (r->>'bloquea')::boolean=false, r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'menu','{}','activa',current_date-40)$q$,cA));
  perform t.chk('41: mantenimiento impago: vencida pero NO bloquea, solo avisa', r->>'estado'='vencida' and (r->>'bloquea')::boolean=false and r->>'aviso' like 'Mantenimiento mensual pendiente desde el%', r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'basico','{}','suspendida',null)$q$,cA));
  perform t.chk('41: suspendida tampoco bloquea', r->>'estado'='suspendida' and (r->>'bloquea')::boolean=false, r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'total','{ventas}','activa',null)$q$,cA));
  perform t.chk('41: los planes y paquetes de la versión 32 siguen aceptados', r->>'plan'='total', r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_set(%L,'oro','{}','activa',null)$q$,cA));
  perform t.chk('41: combo inexistente rechazado', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.vb_licencia_set(%L,'completo','{}','activa',null)$q$,cA));
  perform t.chk('41: el comercio no se cambia el combo', r ? 'err', r::text);
  r := t.call(uV,'vb@vb.com',format($q$select public.vb_licencia_quitar(%L)$q$,cA));
  delete from public.vb_staff where email='vb@vb.com';
end $$;
