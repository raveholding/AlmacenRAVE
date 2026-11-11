\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
-- 24 · restablecer_acceso_miembro: clave temporal + llave temporal en un paso
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000a6','a6@a.com') on conflict do nothing;
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA6 uuid := '00000000-0000-0000-0000-0000000000a6';
  uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid; r jsonb; h64 text := repeat('a6',32);
  k text := '{"kdf":{"s":"nuevo"},"wrap":{"iv":"x","ct":"y"}}';
begin
  perform t.call(uA,'a@a.com',format($q$select to_jsonb(public.invitar_miembro(%L,'a6@a.com','mostrador','Caja 6',%L,'{"kdf":{"x":1},"wrap":{"y":2}}'::jsonb))$q$, cA, h64));
  perform t.call(uA6,'a6@a.com',format($q$select public.aceptar_invitacion(%L)$q$, h64));
  update public.llaves set temporal=false, kdf='{"s":"propia"}', wrap='{"w":"propia"}' where comercio_id=cA and usuario_id=uA6;
  update auth.users set encrypted_password='vieja' where id=uA6;
  r := t.call(uA6,'a6@a.com',format($q$select public.restablecer_acceso_miembro(%L,%L,'TEMPORAL1234',%L::jsonb)$q$, cA, uA, k));
  perform t.chk('24: un mostrador NO restablece accesos', r ? 'err');
  r := t.call(uB,'b@b.com',format($q$select public.restablecer_acceso_miembro(%L,%L,'TEMPORAL1234',%L::jsonb)$q$, cA, uA6, k));
  perform t.chk('24: un admin de OTRO comercio no restablece accesos ajenos', r ? 'err');
  perform t.chk('24: ...y la llave de la persona no cambió', (select kdf->>'s' from public.llaves where comercio_id=cA and usuario_id=uA6)='propia');
  r := t.call(uA,'a@a.com',format($q$select public.restablecer_acceso_miembro(%L,%L,'TEMPORAL1234','{"kdf":"x"}'::jsonb)$q$, cA, uA6));
  perform t.chk('24: llave con formato inválido se rechaza', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.restablecer_acceso_miembro(%L,%L,'TEMPORAL1234',%L::jsonb)$q$, cA, uA, k));
  perform t.chk('24: el admin no se restablece a sí mismo', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.restablecer_acceso_miembro(%L,%L,'TEMPORAL1234',%L::jsonb)$q$, cA, uA6, k));
  perform t.chk('24: el admin restablece el acceso de su equipo', not (r ? 'err') and (r->>'ok')::boolean, r::text);
  perform t.chk('24: la clave temporal quedó hasheada', (select encrypted_password like '$2%' from auth.users where id=uA6));
  perform t.chk('24: la llave quedó envuelta con la clave temporal y marcada temporal', (select temporal and kdf->>'s'='nuevo' and wrap->>'ct'='y' from public.llaves where comercio_id=cA and usuario_id=uA6));
  r := t.call(null,'',format($q$select public.restablecer_acceso_miembro(%L,%L,'TEMPORAL1234',%L::jsonb)$q$, cA, uA6, k),'anon');
  perform t.chk('24: anon no puede llamarla', r ? 'err');
end $$;
