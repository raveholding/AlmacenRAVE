\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3';
  uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid; cB uuid := t.ctxget('cB')::uuid;
  r jsonb; n int; tok uuid; tok2 uuid; idc uuid; imp jsonb := '{"total":12100,"neto":10000,"iva":2100}';
begin
  perform t.chk('CUIT válido (20-12345678-6)', public.rave_cuit_ok('20-12345678-6'));
  perform t.chk('CUIT con dígito verificador malo', not public.rave_cuit_ok('20123456789'));
  perform t.chk('CUIT con prefijo inexistente', not public.rave_cuit_ok('11111111111'));
  perform t.chk('CUIT corto', not public.rave_cuit_ok('2012345'));
  -- config
  r := t.call(uA3,'a3@a.com',format($q$select public.arca_guardar_config(%L,'homologacion','20123456786','Almacén A','MONO',1,'ravea',21,false)$q$, cA));
  perform t.chk('un mostrador NO configura ARCA', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.arca_guardar_config(%L,'homologacion','20123456789','Almacén A','MONO',1,'ravea',21,false)$q$, cA));
  perform t.chk('CUIT inválido rechazado en el servidor', (r->>'ok')='false', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.arca_guardar_config(%L,'homologacion','20123456786','Almacén A','MONO',1,'ra vea',21,false)$q$, cA));
  perform t.chk('alias con espacios rechazado', (r->>'ok')='false', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.arca_guardar_config(%L,'homologacion','20123456786','Almacén A','MONO',1,'ravea',21,false)$q$, cA));
  perform t.chk('admin guarda la config (apagada)', (r->>'ok')='true', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.arca_guardar_config(%L,'homologacion','20123456786','Almacén A','MONO',1,'ravea',21,true)$q$, cA));
  perform t.chk('NO se puede activar sin certificado cargado', (r->>'ok')='false', r::text);
  perform t.chk('ARCA queda apagada por defecto', (select not activo from public.arca_config where comercio_id=cA));
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.arca_config where comercio_id=%L$q$, cA));
  perform t.chk('B no ve la config ARCA de A', r::text='0');
  -- credenciales: nadie las lee
  insert into public.arca_credenciales(comercio_id, ambiente, key_enc, csr, cert, cert_vence) values (cA,'homologacion','CIFRADO','CSR-PEM','CERT-PEM', now()+interval '1 year');
  r := t.call(uA,'a@a.com',$q$select to_jsonb(count(*)) from public.arca_credenciales$q$);
  perform t.chk('ni el admin lee arca_credenciales por la API', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.arca_estado_credenciales(%L,'homologacion')$q$, cA));
  perform t.chk('el estado de credenciales no incluye la clave', r::text not like '%CIFRADO%' and (r->>'tiene_cert')='true', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.arca_estado_credenciales(%L,'homologacion')$q$, cA));
  perform t.chk('B no ve el estado de credenciales de A', r is null or r='null'::jsonb, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.arca_guardar_config(%L,'homologacion','20123456786','Almacén A','MONO',1,'ravea',21,true)$q$, cA));
  perform t.chk('con certificado cargado sí se puede activar', (r->>'ok')='true', r::text);
  -- reservar / idempotencia / locks (rol de servicio)
  r := t.call(null,'',format($q$select public.arca_reservar(%L,'homologacion','venta-1',1,11,'{"docTipo":99,"docNro":0}'::jsonb,%L::jsonb,null,%L)$q$, cA, imp, uA),'service_role');
  perform t.chk('reservar → trabajar', r->>'accion'='trabajar', r::text); idc := (r->>'id')::uuid;
  r := t.call(null,'',format($q$select public.arca_reservar(%L,'homologacion','venta-1',1,11,null,%L::jsonb,null,%L)$q$, cA, imp, uA),'service_role');
  perform t.chk('segunda reserva simultánea → ocupado (no duplica el pedido)', r->>'accion'='ocupado', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.arca_reservar(%L,'homologacion','venta-1',1,11,null,%L::jsonb,null,%L)$q$, cA, imp, uA));
  perform t.chk('un usuario NO puede reservar/emitir por la API directa', r ? 'err');
  perform public.arca_resultado(idc,'aprobado',1,'74123456789012','2026-10-22','2026-10-12','{"x":1}'::jsonb,'{"ok":1}'::jsonb,null,null);
  r := t.call(null,'',format($q$select public.arca_reservar(%L,'homologacion','venta-1',1,11,null,%L::jsonb,null,%L)$q$, cA, imp, uA),'service_role');
  perform t.chk('con CAE: reservar de nuevo devuelve "hecho" y NO pide otro CAE', r->>'accion'='hecho', r::text);
  begin update public.arca_comprobantes set cae='OTRO' where id=idc; perform t.chk('CAE inmutable (UPDATE)', false); exception when others then perform t.chk('CAE inmutable (UPDATE)', true, sqlerrm); end;
  begin delete from public.arca_comprobantes where id=idc; perform t.chk('comprobante con CAE no se borra', false); exception when others then perform t.chk('comprobante con CAE no se borra', true, sqlerrm); end;
  -- mismo nº no se repite
  r := t.call(null,'',format($q$select public.arca_reservar(%L,'homologacion','venta-2',1,11,null,%L::jsonb,null,%L)$q$, cA, imp, uA),'service_role');
  begin
    perform public.arca_resultado((r->>'id')::uuid,'aprobado',1,'74123456789099','2026-10-22','2026-10-12',null,null,null,null);
    perform t.chk('el mismo número aprobado dos veces es imposible', false);
  exception when others then perform t.chk('el mismo número aprobado dos veces es imposible', true, sqlerrm); end;
  perform public.arca_resultado((r->>'id')::uuid,'error',null,null,null,null,null,'{"e":"timeout"}'::jsonb,'timeout',30);
  r := t.call(null,'',format($q$select public.arca_reservar(%L,'homologacion','venta-2',1,11,null,%L::jsonb,null,%L)$q$, cA, imp, uA),'service_role');
  perform t.chk('tras un error se puede reintentar', r->>'accion'='trabajar', r::text);
  perform t.chk('el reintento cuenta los intentos', (select intentos from public.arca_comprobantes where venta_id='venta-2')=2);
  -- lock
  tok := public.arca_lock_tomar(cA,'homologacion',1,11,90);
  tok2 := public.arca_lock_tomar(cA,'homologacion',1,11,90);
  perform t.chk('cerrojo: el segundo no lo toma', tok is not null and tok2 is null);
  perform public.arca_lock_soltar(cA,'homologacion',1,11,tok);
  perform t.chk('cerrojo: liberado se puede tomar', public.arca_lock_tomar(cA,'homologacion',1,11,90) is not null);
  update public.arca_locks set hasta = now() - interval '1 second';
  perform t.chk('cerrojo vencido se recupera (no queda trabado para siempre)', public.arca_lock_tomar(cA,'homologacion',1,11,90) is not null);
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.arca_lock_tomar(%L,'homologacion',1,11,90))$q$, cA));
  perform t.chk('usuarios no pueden tomar cerrojos', r ? 'err');
  -- lectura
  r := t.call(uA3,'a3@a.com',format($q$select to_jsonb(count(*)) from public.arca_comprobantes where comercio_id=%L$q$, cA));
  perform t.chk('el mostrador ve los comprobantes de su comercio', r::text='2', r::text);
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.arca_comprobantes where comercio_id=%L$q$, cA));
  perform t.chk('B no ve comprobantes de A', r::text='0');
  r := t.call(null,'',$q$select to_jsonb(count(*)) from public.arca_comprobantes$q$,'anon');
  perform t.chk('anon no ve comprobantes', r ? 'err');
  -- no cambiar CUIT con comprobantes aprobados
  r := t.call(uA,'a@a.com',format($q$select public.arca_guardar_config(%L,'homologacion','20111111112','Otro','RI',1,'ravea',21,true)$q$, cA));
  perform t.chk('con comprobantes aprobados no se cambia el CUIT', (r->>'ok')='false', r::text);
end $$;
