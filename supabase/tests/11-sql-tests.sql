\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000a4','a4@a.com') on conflict do nothing;
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3'; uA4 uuid := '00000000-0000-0000-0000-0000000000a4';
  uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := t.ctxget('cA')::uuid; cB uuid := t.ctxget('cB')::uuid;
  r jsonb; n int; h64 text := repeat('ef',32); big text;
begin
  -- ===== 03 recuperación y soporte =====
  perform t.call(uA,'a@a.com',format($q$select to_jsonb(public.invitar_miembro(%L,'a3@a.com','mostrador','Caja 3',%L,'{"kdf":{"x":1},"wrap":{"y":2}}'::jsonb))$q$, cA, h64));
  perform t.call(uA3,'a3@a.com',format($q$select public.aceptar_invitacion(%L)$q$, h64));
  select count(*) into n from public.llaves where comercio_id=cA and usuario_id=uA3 and temporal;
  perform t.chk('entrar con invitación deja la llave marcada como temporal', n=1);
  perform t.call(uA3,'a3@a.com',format($q$select to_jsonb(public.registrar_caja(%L,2,'device-aaaaaaaa','Caja 2'))$q$, cA));
  r := t.call(uA3,'a3@a.com',format($q$select to_jsonb(public.restablecer_clave_miembro(%L,%L,'TempClave-123'))$q$, cA, uA));
  perform t.chk('un mostrador NO restablece claves', r ? 'err');
  update auth.users set encrypted_password='viejo' where id=uA3;
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.restablecer_clave_miembro(%L,%L,'TempClave-123'))$q$, cA, uA3));
  perform t.chk('el admin restablece la clave de su equipo', not (r ? 'err'), r::text);
  perform t.chk('la clave quedó hasheada (bcrypt), no en texto plano', (select encrypted_password like '$2%' and encrypted_password <> 'TempClave-123' from auth.users where id=uA3));
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.restablecer_clave_miembro(%L,%L,'corta'))$q$, cA, uA3));
  perform t.chk('clave temporal < 8 caracteres se rechaza', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select to_jsonb(public.restablecer_clave_miembro(%L,%L,'TempClave-123'))$q$, cA, uA));
  perform t.chk('el admin no se restablece a sí mismo por esta vía', r ? 'err');
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(public.restablecer_clave_miembro(%L,%L,'TempClave-123'))$q$, cA, uA3));
  perform t.chk('un admin de OTRO comercio no restablece claves ajenas', r ? 'err');
  r := t.call(uA,'a@a.com',$q$select public.soporte_restablecer_clave('a3@a.com','Soporte-2026')$q$);
  perform t.chk('soporte_restablecer_clave NO ejecutable por la API', r ? 'err');
  r := t.call(null,'',$q$select public.soporte_restablecer_clave('a3@a.com','Soporte-2026')$q$,'anon');
  perform t.chk('soporte_restablecer_clave NO ejecutable por anon', r ? 'err');
  perform t.chk('soporte desde el SQL Editor sí funciona', public.soporte_restablecer_clave('a3@a.com','Soporte-2026') like 'Listo%');
  r := t.call(null,'',$q$select to_jsonb(public.pedir_soporte('{"contacto":"3875551111","motivo":"clave","comercio":"A"}'::jsonb))$q$,'anon');
  perform t.chk('anon puede pedir ayuda', not (r ? 'err'), r::text);
  r := t.call(null,'',$q$select to_jsonb(public.pedir_soporte('{"contacto":"1"}'::jsonb))$q$,'anon');
  perform t.chk('pedido de ayuda sin contacto válido se rechaza', r ? 'err');
  for i in 1..6 loop r := t.call(null,'',$q$select to_jsonb(public.pedir_soporte('{"contacto":"3875551111","motivo":"otro"}'::jsonb))$q$,'anon'); end loop;
  perform t.chk('límite de pedidos por contacto (5/día)', r ? 'err', r::text);
  r := t.call(null,'',$q$select to_jsonb(count(*)) from public.solicitudes_soporte$q$,'anon');
  perform t.chk('anon no lee las solicitudes de soporte', r ? 'err');
  r := t.call(uA,'a@a.com',$q$select to_jsonb(count(*)) from public.soporte_config$q$);
  perform t.chk('nadie lee soporte_config por la API', r ? 'err');

  -- ===== 04 menú público =====
  big := '{"site":{"title":"Almacén A"},"catalog":{"secciones":[{"cat":"r1","nom":"Bebidas","costoInterno":9,"layout":"grid"}],"productos":[{"id":"p1","cat":"r1","nom":"Fernet","precio":12,"img":"","cost":700,"costo":700,"stock":47,"proveedor":"Distribuidora X","margen":30,"agotado":false}]},"plans":[],"coupons":[],"clubkey":{"kty":"RSA","n":"abc"},"secretos":{"apiKey":"X"}}';
  r := t.call(uA3,'a3@a.com',format($q$select public.publicar_menu(%L,%L::jsonb,%L)$q$, cA, big, repeat('1',32)));
  perform t.chk('un mostrador NO publica el menú', r ? 'err');
  r := t.call(uB,'b@b.com',format($q$select public.publicar_menu(%L,%L::jsonb,%L)$q$, cA, big, repeat('1',32)));
  perform t.chk('el admin de B NO publica en A', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.publicar_menu(%L,%L::jsonb,%L)$q$, cA, big, repeat('1',32)));
  perform t.chk('el admin publica v1', (r->>'version')='1', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.publicar_menu(%L,%L::jsonb,%L)$q$, cA, big, repeat('1',32)));
  perform t.chk('publicar lo mismo no crea otra versión', (r->>'sin_cambios')='true', r::text);
  r := t.call(null,'',$q$select public.menu_publico('comercio-a')$q$,'anon');
  perform t.chk('el público lee el menú publicado (anon)', r->>'version'='1' and r#>>'{contenido,site,title}'='Almacén A', left(r::text,200));
  perform t.chk('NINGÚN campo interno llega al público (costo/stock/proveedor/margen/secretos)',
    r::text !~* '(costo|"cost"|stock|proveedor|margen|secretos|apiKey|costoInterno)', r::text);
  perform t.chk('el público sí recibe nombre, precio y llave pública del club', r::text like '%Fernet%' and r::text like '%"kty"%');
  r := t.call(null,'',$q$select public.menu_publico('no-existe')$q$,'anon');
  perform t.chk('slug inexistente → nada', r is null or r='null'::jsonb);
  r := t.call(null,'',$q$select to_jsonb(count(*)) from public.menus$q$,'anon');
  perform t.chk('anon no lee la tabla menus directo', r ? 'err');
  r := t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.menus where comercio_id=%L$q$, cA));
  perform t.chk('B no ve el menú (tabla) de A', r::text='0');
  r := t.call(uA,'a@a.com',format($q$select public.publicar_menu(%L,'{"site":{"title":"v2"}}'::jsonb,%L)$q$, cA, repeat('2',32)));
  perform t.chk('segunda publicación → v2', (r->>'version')='2');
  r := t.call(uA,'a@a.com',format($q$select public.revertir_menu(%L,1)$q$, cA));
  perform t.chk('revertir a v1 crea v3 con el contenido de v1', (r->>'version')='3' and (select contenido#>>'{site,title}' from public.menus where comercio_id=cA)='Almacén A', r::text);
  r := t.call(uA3,'a3@a.com',format($q$select public.revertir_menu(%L,1)$q$, cA));
  perform t.chk('un mostrador NO revierte', r ? 'err');
  r := t.call(uA,'a@a.com',format($q$select public.publicar_menu(%L,%L::jsonb,%L)$q$, cA, '{"site":{"x":"'||repeat('A',3100000)||'"}}', repeat('9',32)));
  perform t.chk('menú de más de 3 MB se rechaza', r ? 'err');

  -- ===== Club RAVE =====
  r := t.call(null,'',$q$select public.club_alta('comercio-a', repeat('a',64), '{"k":"x","iv":"y","ct":"z"}'::jsonb)$q$,'anon');
  perform t.chk('alta al club desde el público (anon)', (r->>'ok')='true', r::text);
  r := t.call(null,'',$q$select public.club_alta('comercio-a', repeat('a',64), '{"k":"x","iv":"y","ct":"z"}'::jsonb)$q$,'anon');
  select count(*) into n from public.club_altas where comercio_id=cA;
  perform t.chk('el mismo número dos veces no duplica y responde igual (no revela existencia)', n=1 and (r->>'ok')='true', r::text);
  r := t.call(null,'',$q$select public.club_alta('comercio-a', repeat('b',64), '{"nombre":"Juan"}'::jsonb)$q$,'anon');
  perform t.chk('alta con datos sin cifrar (formato inválido) se rechaza', (r->>'ok')='false', r::text);
  r := t.call(null,'',$q$select public.club_alta('no-existe', repeat('c',64), '{"k":"x","iv":"y","ct":"z"}'::jsonb)$q$,'anon');
  perform t.chk('alta a un comercio inexistente se rechaza', (r->>'ok')='false');
  perform t.chk('B no ve altas de A', (t.call(uB,'b@b.com',format($q$select to_jsonb(count(*)) from public.club_altas where comercio_id=%L$q$, cA)))::text='0');
  perform t.chk('anon no lee altas', (t.call(null,'',$q$select to_jsonb(count(*)) from public.club_altas$q$,'anon')) ? 'err');
  perform t.chk('un mostrador de A sí ve las altas', (t.call(uA3,'a3@a.com',format($q$select to_jsonb(count(*)) from public.club_altas where comercio_id=%L$q$, cA)))::text='1');
  -- límite por IP (6/hora)
  perform set_config('request.headers','{"x-forwarded-for":"9.9.9.9"}',false);
  for i in 1..8 loop
    perform t.call(null,'',format($q$select public.club_alta('comercio-a', %L, '{"k":"x","iv":"y","ct":"z"}'::jsonb)$q$, repeat(i::text,40)),'anon');
  end loop;
  r := t.call(null,'',$q$select public.club_alta('comercio-a', repeat('z',40), '{"k":"x","iv":"y","ct":"z"}'::jsonb)$q$,'anon');
  perform set_config('request.headers','',false);
  perform t.chk('límite por IP en el alta (6/hora)', (r->>'ok')='false' and r->>'error' like 'Demasiados%', r::text);
  -- eventos
  perform t.call(null,'',$q$select to_jsonb(public.menu_evento('comercio-a','pedido',3,150000)::text)$q$,'anon');
  perform t.call(null,'',$q$select to_jsonb(public.menu_evento('comercio-a','hackeo',3,150000)::text)$q$,'anon');
  select count(*) into n from public.menu_eventos where comercio_id=cA;
  perform t.chk('eventos del menú: sólo tipos válidos', n=1);
  r := t.call(uA,'a@a.com',format($q$select public.club_altas_marcar(%L, array[(select min(id) from public.club_altas)], 'importada')$q$, cA));
  perform t.chk('el equipo marca altas como importadas', r::text='1', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.club_altas_marcar(%L, array[1], 'importada')$q$, cA));
  perform t.chk('B no marca altas de A', r ? 'err');
end $$;
