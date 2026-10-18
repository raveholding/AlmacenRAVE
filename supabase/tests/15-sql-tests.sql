-- 08-proveedores-compras.sql: proveedores, órdenes de compra, ingreso de mercadería atómico, cuenta corriente
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000d1','op@a.com') on conflict do nothing;
do $$
declare
  uA uuid := '00000000-0000-0000-0000-00000000000a'; uA3 uuid := '00000000-0000-0000-0000-0000000000a3';
  uS uuid := '00000000-0000-0000-0000-0000000000c1'; uB uuid := '00000000-0000-0000-0000-00000000000b';
  cA uuid := (select comercio_id from public.miembros where usuario_id='00000000-0000-0000-0000-00000000000a' limit 1);
  cB uuid := (select comercio_id from public.miembros where usuario_id='00000000-0000-0000-0000-00000000000b' limit 1);
  r jsonb; r2 jsonb; sync text := $q$select public.sincronizar(%L,'dev1',%L::jsonb)$q$;
  pv1 uuid; pv2 uuid; pvB uuid; oc1 uuid; oc2 uuid; oc3 uuid; ocB uuid; n int; n2 int; x numeric; x2 numeric; s text;
  cuitA text := '30712345671'; cuitB text := '30698765433'; cuitC text := '30505050505';
begin
  -- catálogo, rubros y cajas de prueba (por la vía normal del sistema)
  perform t.call(uA,'a@a.com',format(sync,cA,$j$[
    {"c":"prod","id":"cp1","d":{"name":"Fernet 750","price":2000000,"cost":1000000,"unit":"u"}},
    {"c":"prod","id":"cp2","d":{"name":"Coca 2,25","price":500000,"cost":200000,"unit":"u"}},
    {"c":"prod","id":"cp3","d":{"name":"Granel kg","price":800000,"cost":500000,"unit":"kg"}},
    {"c":"prod","id":"cpar","d":{"name":"Archivado","price":100,"archived":true}},
    {"c":"rubros","id":"rgen","d":{"name":"Mercadería","kind":"shared"}},
    {"c":"rubros","id":"rcob","d":{"name":"Cobranza","kind":"cobr"}},
    {"c":"turnos","id":"tk1","d":{"openAt":1,"closedAt":0,"total":0}},
    {"c":"turnos","id":"tk2","d":{"openAt":1,"closedAt":0,"total":0}}]$j$));
  perform t.call(uA,'a@a.com',format(sync,cA,'[{"c":"smov","id":"s-ini-1","d":{"pid":"cp1","d":5}},{"c":"turnos","id":"tk2","d":{"openAt":1,"closedAt":99,"total":0}}]'));
  perform t.call(uB,'b@b.com',format(sync,cB,'[{"c":"prod","id":"cpB","d":{"name":"Prod B","price":100,"cost":50}}]'));

  -- ================= PROVEEDORES =================
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cA,
        '{"razon_social":"Distribuidora Norte SA","cuit":"30-71234567-1","condicion_iva":"Responsable Inscripto","email":"ventas@norte.com","telefono":"387 400000","direccion":"Ruta 9 km 4","saldo_cuenta_corriente":99999}'));
  perform t.chk('admin crea proveedor (CUIT con guiones se normaliza a 11 dígitos)', r ? 'id' and r->>'cuit'=cuitA, r::text);
  perform t.chk('el saldo inicial NO se puede fijar desde el pedido (queda en 0)', (r->>'saldo_cuenta_corriente')::numeric=0, r::text);
  pv1 := (r->>'id')::uuid;
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cA,'{"razon_social":"Otra SRL","cuit":"30712345672","condicion_iva":"Exento"}'));
  perform t.chk('CUIT con dígito verificador incorrecto: rechazado', r ? 'err' and r->>'err' like '%CUIT%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cA,'{"razon_social":"Dup SA","cuit":"30712345671","condicion_iva":"Exento"}'));
  perform t.chk('CUIT repetido en el mismo comercio: rechazado', r ? 'err' and r->>'err' like '%ya existe%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cA,'{"razon_social":"X SA","cuit":"30698765433","condicion_iva":"Monotributo"}'));
  perform t.chk('condición de IVA inventada: rechazada', r ? 'err' and r->>'err' like '%IVA%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cA,'{"razon_social":"X SA","cuit":"30698765433","condicion_iva":"Exento","email":"no-es-mail"}'));
  perform t.chk('correo inválido: rechazado', r ? 'err' and r->>'err' like '%correo%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cA,'{"razon_social":"","cuit":"30698765433","condicion_iva":"Exento"}'));
  perform t.chk('razón social vacía: rechazada', r ? 'err', r::text);
  r := t.call(uS,'sup@a.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cA,'{"razon_social":"Bebidas del Sur","cuit":"30698765433","condicion_iva":"Monotributista"}'));
  perform t.chk('el supervisor también da de alta proveedores', r ? 'id', r::text); pv2 := (r->>'id')::uuid;
  r := t.call(uA3,'a3@a.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cA,'{"razon_social":"Mostrador SA","cuit":"30505050505","condicion_iva":"Exento"}'));
  perform t.chk('el mostrador NO da de alta proveedores (servidor)', r ? 'err', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cA,'{"razon_social":"Intruso SA","cuit":"30505050505","condicion_iva":"Exento"}'));
  perform t.chk('el admin de OTRO comercio NO escribe en este', r ? 'err', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cB,'{"razon_social":"Prov B","cuit":"30712345671","condicion_iva":"Exento"}'));
  perform t.chk('el mismo CUIT puede existir en otro comercio (aislamiento por tenant)', r ? 'id', r::text); pvB := (r->>'id')::uuid;
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cA,format('{"id":"%s","razon_social":"Distribuidora Norte SA (editada)","cuit":"30712345671","condicion_iva":"Responsable Inscripto","telefono":"1"}',pv1)));
  perform t.chk('editar proveedor', r->>'razon_social' like '%editada%', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cB,format('{"id":"%s","razon_social":"Hack","cuit":"30712345671","condicion_iva":"Exento"}',pv1)));
  perform t.chk('no se edita un proveedor de otro comercio aunque se conozca su id', r ? 'err', r::text);
  -- RLS y permisos de tabla
  r := t.call(uA,'a@a.com',$q$select to_jsonb(count(*)) from public.proveedores$q$);
  perform t.chk('RLS: el admin A ve sus 2 proveedores y ninguno de B', r::text='2', r::text);
  r := t.call(uB,'b@b.com',$q$select to_jsonb(count(*)) from public.proveedores$q$);
  perform t.chk('RLS: el admin B ve sólo el suyo', r::text='1', r::text);
  r := t.call(uA3,'a3@a.com',$q$select to_jsonb(count(*)) from public.proveedores$q$);
  perform t.chk('RLS: el mostrador no lee proveedores', r::text='0', r::text);
  r := t.call(uA,'a@a.com',format($q$insert into public.proveedores(tenant_id,razon_social,cuit,condicion_iva) values (%L,'Directo','30505050505','Exento') returning to_jsonb(proveedores)$q$,cA));
  perform t.chk('nadie escribe las tablas directo (sólo por funciones)', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$update public.proveedores set saldo_cuenta_corriente = 0 where id=%L returning to_jsonb(proveedores)$q$,pv1));
  perform t.chk('nadie edita el saldo directo', r ? 'err', r::text);
  r := t.call(null,'','select public.proveedores_listar(' || quote_literal(cA) || ')','anon');
  perform t.chk('anónimo no usa la API de proveedores', r ? 'err', r::text);

  -- ================= ÓRDENES DE COMPRA =================
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,
     format('{"proveedor_id":"%s","estado":"Solicitada","idempotency_key":"oc-key-0001","total":1,"items":[{"producto_id":"cp1","cantidad":10,"precio_costo_pactado":100.50},{"producto_id":"cp2","cantidad":3,"precio_costo_pactado":20}]}',pv1)));
  perform t.chk('orden Solicitada: el total lo calcula el servidor (10×100,50 + 3×20 = 1065), no el navegador', (r->>'total')::numeric=1065 and r->>'estado'='Solicitada' and jsonb_array_length(r->'items')=2, r::text);
  oc1 := (r->>'id')::uuid; perform t.chk('numeración correlativa por comercio (OC 1)', (r->>'numero')::int=1, r::text);
  r2 := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,
     format('{"proveedor_id":"%s","estado":"Solicitada","idempotency_key":"oc-key-0001","items":[{"producto_id":"cp1","cantidad":10,"precio_costo_pactado":100.50}]}',pv1)));
  select count(*) into n from public.ordenes_compra where tenant_id=cA;
  perform t.chk('reenviar la misma orden (misma clave) no crea otra', (r2->>'repetido')='true' and (r2->>'id')::uuid=oc1 and n=1, r2::text||' n='||n);
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","items":[{"producto_id":"nope","cantidad":1,"precio_costo_pactado":1}]}',pv1)));
  perform t.chk('producto inexistente: rechazado', r ? 'err' and r->>'err' like '%no existe%', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cB,format('{"proveedor_id":"%s","items":[{"producto_id":"cp1","cantidad":1,"precio_costo_pactado":1}]}',pvB)));
  perform t.chk('producto de OTRO comercio: rechazado', r ? 'err' and r->>'err' like '%no existe%', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cB,format('{"proveedor_id":"%s","items":[{"producto_id":"cpB","cantidad":1,"precio_costo_pactado":1}]}',pv1)));
  perform t.chk('proveedor de OTRO comercio: rechazado', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","items":[{"producto_id":"cpar","cantidad":1,"precio_costo_pactado":1}]}',pv1)));
  perform t.chk('producto archivado: rechazado', r ? 'err' and r->>'err' like '%archivado%', r::text);
  foreach s in array array['0','-2','1.2345','"diez"'] loop
    r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","items":[{"producto_id":"cp1","cantidad":%s,"precio_costo_pactado":1}]}',pv1,s)));
    perform t.chk('cantidad inválida ('||s||'): rechazada', r ? 'err', r::text);
  end loop;
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","items":[{"producto_id":"cp1","cantidad":1,"precio_costo_pactado":-5}]}',pv1)));
  perform t.chk('costo negativo: rechazado', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","items":[{"producto_id":"cp1","cantidad":1,"precio_costo_pactado":1.005}]}',pv1)));
  perform t.chk('costo con más de 2 decimales: rechazado', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","items":[{"producto_id":"cp1","cantidad":1,"precio_costo_pactado":1},{"producto_id":"cp1","cantidad":2,"precio_costo_pactado":1}]}',pv1)));
  perform t.chk('producto repetido en la orden: rechazado', r ? 'err' and r->>'err' like '%repetido%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","items":[]}',pv1)));
  perform t.chk('orden sin renglones: rechazada', r ? 'err', r::text);
  r := t.call(uA3,'a3@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","items":[{"producto_id":"cp1","cantidad":1,"precio_costo_pactado":1}]}',pv1)));
  perform t.chk('el mostrador NO crea órdenes de compra', r ? 'err', r::text);
  -- borrador editable
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","items":[{"producto_id":"cp3","cantidad":2.5,"precio_costo_pactado":10}]}',pv1)));
  perform t.chk('orden en Borrador (total 25) y numero 2', r->>'estado'='Borrador' and (r->>'total')::numeric=25 and (r->>'numero')::int=2, r::text); oc2 := (r->>'id')::uuid;
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"id":"%s","proveedor_id":"%s","items":[{"producto_id":"cp3","cantidad":4,"precio_costo_pactado":10},{"producto_id":"cp2","cantidad":1,"precio_costo_pactado":5}]}',oc2,pv1)));
  perform t.chk('se edita un Borrador (renglones reemplazados, total 45)', (r->>'total')::numeric=45 and jsonb_array_length(r->'items')=2, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"id":"%s","proveedor_id":"%s","items":[{"producto_id":"cp1","cantidad":1,"precio_costo_pactado":1}]}',oc1,pv1)));
  perform t.chk('una orden Solicitada ya no se edita', r ? 'err' and r->>'err' like '%Borrador%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_estado(%L,%L,'Solicitada')$q$,cA,oc2));
  perform t.chk('Borrador → Solicitada', r->>'estado'='Solicitada', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_estado(%L,%L,'Recibida')$q$,cA,oc2));
  perform t.chk('no se marca Recibida a mano', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_estado(%L,%L,'Cancelada')$q$,cA,oc2));
  perform t.chk('Solicitada → Cancelada', r->>'estado'='Cancelada', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_estado(%L,%L,'Solicitada')$q$,cA,oc2));
  perform t.chk('una Cancelada no se reabre', r ? 'err', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.orden_compra_estado(%L,%L,'Cancelada')$q$,cB,oc1));
  perform t.chk('no se opera una orden de otro comercio', r ? 'err', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cB,format('{"proveedor_id":"%s","estado":"Solicitada","items":[{"producto_id":"cpB","cantidad":1,"precio_costo_pactado":5}]}',pvB)));
  perform t.chk('el comercio B arranca su propia numeración en 1', (r->>'numero')::int=1, r::text); ocB := (r->>'id')::uuid;

  -- ================= INGRESO DE MERCADERÍA =================
  select (datos->>'stock')::numeric, (datos->>'cost')::numeric into x, x2 from public.registros where comercio_id=cA and coleccion='prod' and id='cp1';
  perform t.chk('punto de partida cp1: stock 5, costo 1.000.000 centavos', x=5 and x2=1000000, x||'/'||x2);
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0001","proveedor_id":"%s","orden_compra_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"0001-00001234","condicion_pago":"credito","total_declarado":1065,"items":[{"producto_id":"cp1","cantidad":10,"precio_costo":100.50},{"producto_id":"cp2","cantidad":3,"precio_costo":20}]}',pv1,oc1)));
  perform t.chk('recepción a crédito: ok y orden Recibida', (r->>'ok')='true' and r->>'orden_estado'='Recibida' and (r->>'total')::numeric=1065, r::text);
  perform t.chk('la deuda con el proveedor sube a 1065', (r->>'saldo_proveedor')::numeric=1065 and (select saldo_cuenta_corriente from public.proveedores where id=pv1)=1065, r::text);
  select (datos->>'stock')::numeric, (datos->>'cost')::numeric into x, x2 from public.registros where comercio_id=cA and coleccion='prod' and id='cp1';
  perform t.chk('stock cp1: 5 + 10 = 15', x=15, x::text);
  perform t.chk('costo cp1 actualizado a 100,50 pesos = 10.050 centavos', x2=10050, x2::text);
  perform t.chk('margen real recalculado: (20.000−10,05)/20.000 centavos', (r->'items'->0->>'margen_pct')::numeric = round((2000000-10050)::numeric/2000000*100,1), (r->'items'->0)::text);
  select count(*) into n from public.registros where comercio_id=cA and coleccion='smov' and datos->>'ref' like 'ingreso:%';
  perform t.chk('queda el movimiento de stock de respaldo (2 renglones)', n=2, n::text);
  perform t.chk('orden en la base: Recibida', (select estado from public.ordenes_compra where id=oc1)='Recibida');
  select count(*) into n from public.cuenta_corriente_proveedores where proveedor_id=pv1;
  perform t.chk('cuenta corriente: un renglón "Factura" por 1065 con saldo acumulado 1065', n=1 and (select tipo_movimiento||monto||saldo_acumulado from public.cuenta_corriente_proveedores where proveedor_id=pv1)='Factura1065.001065.00', n::text);
  select count(*) into n from public.registros where comercio_id=cA and coleccion='movs';
  perform t.chk('a crédito NO sale plata de la caja', n=0, n::text);
  -- idempotencia
  r2 := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0001","proveedor_id":"%s","orden_compra_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"0001-00001234","items":[{"producto_id":"cp1","cantidad":10,"precio_costo":100.50},{"producto_id":"cp2","cantidad":3,"precio_costo":20}]}',pv1,oc1)));
  select (datos->>'stock')::numeric into x from public.registros where comercio_id=cA and coleccion='prod' and id='cp1';
  select count(*) into n from public.cuenta_corriente_proveedores where proveedor_id=pv1;
  perform t.chk('reenviar la MISMA recepción devuelve el mismo resultado y no suma de nuevo', (r2->>'repetido')='true' and x=15 and n=1 and (r2->>'ingreso_id')=(r->>'ingreso_id'), r2::text);
  r2 := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0002","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"0001-00001234","items":[{"producto_id":"cp1","cantidad":10,"precio_costo":100.50}]}',pv1)));
  select (datos->>'stock')::numeric into x from public.registros where comercio_id=cA and coleccion='prod' and id='cp1';
  perform t.chk('el mismo comprobante con otra clave: duplicado rechazado y el stock no cambia', r2 ? 'err' and r2->>'err' like '%duplicado%' and x=15, r2::text);
  r2 := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0003","proveedor_id":"%s","orden_compra_id":"%s","tipo_comprobante":"Remito","nro_comprobante":"R-1","items":[{"producto_id":"cp1","cantidad":1,"precio_costo":1}]}',pv1,oc1)));
  perform t.chk('una orden ya Recibida no se recibe otra vez', r2 ? 'err' and r2->>'err' like '%Recibida%', r2::text);
  r2 := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"proveedor_id":"%s","tipo_comprobante":"Remito","nro_comprobante":"R-3","items":[{"producto_id":"cp1","cantidad":1,"precio_costo":1}]}',pv1)));
  perform t.chk('sin idempotency_key: rechazado', r2 ? 'err' and r2->>'err' like '%idempotency_key%', r2::text);

  -- contado, ATOMICIDAD: falla la caja DESPUÉS de sumar el stock → todo vuelve atrás
  select (datos->>'stock')::numeric into x from public.registros where comercio_id=cA and coleccion='prod' and id='cp2';
  select count(*) into n from public.cuenta_corriente_proveedores where proveedor_id=pv2;
  select count(*) into n2 from public.ingresos_mercaderia where tenant_id=cA;
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0010","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"A-10","condicion_pago":"contado","medio_pago":"efectivo","rubro_id":"rgen","turno_id":"tk2","items":[{"producto_id":"cp2","cantidad":6,"precio_costo":25}]}',pv2)));
  perform t.chk('contado en efectivo con la caja CERRADA: rechazado', r ? 'err' and r->>'err' like '%cerrada%', r::text);
  perform t.chk('ATOMICIDAD: no cambió el stock', (select (datos->>'stock')::numeric from public.registros where comercio_id=cA and coleccion='prod' and id='cp2') is not distinct from x);
  perform t.chk('ATOMICIDAD: no quedó ingreso, ni renglón de cuenta corriente, ni saldo', (select count(*) from public.ingresos_mercaderia where tenant_id=cA)=n2
     and (select count(*) from public.cuenta_corriente_proveedores where proveedor_id=pv2)=n and (select saldo_cuenta_corriente from public.proveedores where id=pv2)=0);
  perform t.chk('ATOMICIDAD: no quedó movimiento de caja ni costo cambiado', (select count(*) from public.registros where comercio_id=cA and coleccion='movs')=0
     and (select (datos->>'cost')::numeric from public.registros where comercio_id=cA and coleccion='prod' and id='cp2')=2000);
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0011","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"A-11","condicion_pago":"contado","medio_pago":"efectivo","turno_id":"tk1","items":[{"producto_id":"cp2","cantidad":6,"precio_costo":25}]}',pv2)));
  perform t.chk('contado sin rubro: rechazado (rubro obligatorio)', r ? 'err' and r->>'err' like '%rubro%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0012","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"A-12","condicion_pago":"contado","medio_pago":"efectivo","rubro_id":"rcob","turno_id":"tk1","items":[{"producto_id":"cp2","cantidad":6,"precio_costo":25}]}',pv2)));
  perform t.chk('contado con un rubro que sólo admite ingresos: rechazado', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0013","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"A-13","condicion_pago":"contado","medio_pago":"efectivo","rubro_id":"no-existe","turno_id":"tk1","items":[{"producto_id":"cp2","cantidad":6,"precio_costo":25}]}',pv2)));
  perform t.chk('contado con rubro inexistente: rechazado', r ? 'err', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cB,
     format('{"idempotency_key":"rcp-key-0014","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"B-1","condicion_pago":"contado","medio_pago":"efectivo","rubro_id":"rgen","turno_id":"tk1","items":[{"producto_id":"cpB","cantidad":1,"precio_costo":5}]}',pvB)));
  perform t.chk('rubro y caja de OTRO comercio no sirven', r ? 'err', r::text);
  -- contado en efectivo OK
  r := t.call(uS,'sup@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0015","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"A-15","condicion_pago":"contado","medio_pago":"efectivo","rubro_id":"rgen","turno_id":"tk1","total_declarado":150,"items":[{"producto_id":"cp2","cantidad":6,"precio_costo":25}]}',pv2)));
  perform t.chk('el supervisor recibe al contado en efectivo', (r->>'ok')='true' and (r->>'saldo_proveedor')::numeric=0 and r->>'movimiento_caja_id' is not null, r::text);
  select datos into r2 from public.registros where comercio_id=cA and coleccion='movs' and id=r->>'movimiento_caja_id';
  perform t.chk('egreso de caja: 150 pesos = 15.000 centavos, tipo egreso, rubro y caja correctos', (r2->>'amount')::numeric=15000 and r2->>'type'='egreso' and r2->>'rubro'='rgen' and r2->>'sessId'='tk1', r2::text);
  select count(*) into n from public.cuenta_corriente_proveedores where proveedor_id=pv2 and tipo_movimiento in ('Factura','Pago');
  perform t.chk('cuenta corriente: Factura y Pago por 150 (saldo queda en 0)', n=2 and (select saldo_acumulado from public.cuenta_corriente_proveedores where proveedor_id=pv2 order by seq desc limit 1)=0, n::text);
  select (datos->>'stock')::numeric, (datos->>'cost')::numeric into x, x2 from public.registros where comercio_id=cA and coleccion='prod' and id='cp2';
  perform t.chk('cp2: stock 3 + 6 = 9 (3 de la orden anterior) y costo 25 pesos = 2.500 centavos', x=9 and x2=2500, x||'/'||x2);
  -- contado por transferencia: no toca la caja
  select count(*) into n from public.registros where comercio_id=cA and coleccion='movs';
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0016","proveedor_id":"%s","tipo_comprobante":"Remito","nro_comprobante":"R-16","condicion_pago":"contado","medio_pago":"transferencia","rubro_id":"rgen","items":[{"producto_id":"cp3","cantidad":2.5,"precio_costo":0}]}',pv2)));
  perform t.chk('remito con costo 0 (bonificado): se rechaza porque el total no puede ser 0', r ? 'err' and r->>'err' like '%mayor a cero%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0017","proveedor_id":"%s","tipo_comprobante":"Remito","nro_comprobante":"R-17","condicion_pago":"contado","medio_pago":"transferencia","rubro_id":"rgen","items":[{"producto_id":"cp3","cantidad":2.5,"precio_costo":10},{"producto_id":"cp1","cantidad":1,"precio_costo":0}]}',pv2)));
  perform t.chk('contado por transferencia: ok, sin movimiento de caja', (r->>'ok')='true' and r->>'movimiento_caja_id' is null and (select count(*) from public.registros where comercio_id=cA and coleccion='movs')=n, r::text);
  perform t.chk('un renglón con costo 0 (bonificación) suma stock pero NO pisa el costo vigente', (select (datos->>'cost')::numeric from public.registros where comercio_id=cA and coleccion='prod' and id='cp1')=10050
     and (select (datos->>'stock')::numeric from public.registros where comercio_id=cA and coleccion='prod' and id='cp1')=16, '');
  perform t.chk('stock con decimales (kg): 2,5', (select (datos->>'stock')::numeric from public.registros where comercio_id=cA and coleccion='prod' and id='cp3')=2.5);
  -- controles de importes
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0020","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"A-20","total_declarado":999,"items":[{"producto_id":"cp2","cantidad":6,"precio_costo":25}]}',pv2)));
  perform t.chk('total declarado distinto de la suma: rechazado', r ? 'err' and r->>'err' like '%no coincide%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0021","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"A-21","fecha_recepcion":"2099-01-01","items":[{"producto_id":"cp2","cantidad":6,"precio_costo":25}]}',pv2)));
  perform t.chk('fecha de recepción futura: rechazada', r ? 'err' and r->>'err' like '%fecha%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0022","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"A-22","items":[{"producto_id":"cp2","cantidad":6,"precio_costo":25},{"producto_id":"fantasma","cantidad":1,"precio_costo":1}]}',pv2)));
  perform t.chk('un renglón inválido cancela TODO el comprobante', r ? 'err' and (select (datos->>'stock')::numeric from public.registros where comercio_id=cA and coleccion='prod' and id='cp2')=9, r::text);
  -- orden con diferencias y producto fuera de la orden
  r := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","estado":"Solicitada","items":[{"producto_id":"cp2","cantidad":10,"precio_costo_pactado":20},{"producto_id":"cp3","cantidad":4,"precio_costo_pactado":10}]}',pv1)));
  oc3 := (r->>'id')::uuid;
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0030","proveedor_id":"%s","orden_compra_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"A-30","items":[{"producto_id":"cp1","cantidad":1,"precio_costo":1}]}',pv1,oc3)));
  perform t.chk('producto que no está en la orden: rechazado', r ? 'err' and r->>'err' like '%no está en la orden%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0031","proveedor_id":"%s","orden_compra_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"A-31","items":[{"producto_id":"cp2","cantidad":8,"precio_costo":22}]}',pv2,oc3)));
  perform t.chk('orden de OTRO proveedor: rechazada', r ? 'err' and r->>'err' like '%otro proveedor%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0032","proveedor_id":"%s","orden_compra_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"A-32","items":[{"producto_id":"cp2","cantidad":8,"precio_costo":22}]}',pv1,oc3)));
  perform t.chk('recepción parcial y con otro costo: ok y se informan las diferencias (cp2 8≠10, 22≠20; cp3 no llegó)', (r->>'ok')='true' and jsonb_array_length(r->'diferencias')=2, r::text);
  r := t.call(uA3,'a3@a.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0040","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"M-1","items":[{"producto_id":"cp2","cantidad":1,"precio_costo":1}]}',pv1)));
  perform t.chk('el mostrador NO recibe mercadería (servidor)', r ? 'err', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.procesar_recepcion(%L,%L::jsonb)$q$,cA,
     format('{"idempotency_key":"rcp-key-0041","proveedor_id":"%s","tipo_comprobante":"Factura","nro_comprobante":"M-2","items":[{"producto_id":"cp2","cantidad":1,"precio_costo":1}]}',pv1)));
  perform t.chk('el admin de OTRO comercio NO recibe en este', r ? 'err', r::text);
  perform t.chk('la deuda de B quedó intacta', (select saldo_cuenta_corriente from public.proveedores where id=pvB)=0);

  -- ================= PAGOS Y NOTAS DE CRÉDITO =================
  select saldo_cuenta_corriente into x from public.proveedores where id=pv1;   -- 1065 + 8×22 = 1241
  perform t.chk('deuda con Distribuidora Norte = 1065 + 176 = 1241', x=1241, x::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_pago_registrar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","monto":500,"medio_pago":"efectivo","rubro_id":"rgen","turno_id":"tk1","referencia":"Recibo 1","idempotency_key":"pago-key-001"}',pv1)));
  perform t.chk('pago parcial en efectivo: saldo 741 y egreso de caja', (r->>'saldo_proveedor')::numeric=741 and r->>'movimiento_caja_id' is not null, r::text);
  r2 := t.call(uA,'a@a.com',format($q$select public.proveedor_pago_registrar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","monto":500,"medio_pago":"efectivo","rubro_id":"rgen","turno_id":"tk1","referencia":"Recibo 1","idempotency_key":"pago-key-001"}',pv1)));
  perform t.chk('reenviar el mismo pago no descuenta dos veces', (r2->>'repetido')='true' and (select saldo_cuenta_corriente from public.proveedores where id=pv1)=741, r2::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_pago_registrar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","monto":9999,"medio_pago":"transferencia","rubro_id":"rgen","idempotency_key":"pago-key-002"}',pv1)));
  perform t.chk('pagar más que la deuda: rechazado', r ? 'err' and r->>'err' like '%supera%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_pago_registrar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","monto":10,"medio_pago":"transferencia","idempotency_key":"pago-key-003"}',pv1)));
  perform t.chk('pago sin rubro: rechazado', r ? 'err' and r->>'err' like '%rubro%', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_pago_registrar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","monto":10,"medio_pago":"transferencia","rubro_id":"rcob","idempotency_key":"pago-key-004"}',pv1)));
  perform t.chk('pago con rubro de sólo ingresos: rechazado', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_pago_registrar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","monto":-10,"medio_pago":"transferencia","rubro_id":"rgen","idempotency_key":"pago-key-005"}',pv1)));
  perform t.chk('pago negativo: rechazado', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_pago_registrar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","monto":10,"medio_pago":"efectivo","rubro_id":"rgen","turno_id":"tk2","idempotency_key":"pago-key-006"}',pv1)));
  perform t.chk('pago en efectivo con caja cerrada: rechazado y la deuda no cambia', r ? 'err' and (select saldo_cuenta_corriente from public.proveedores where id=pv1)=741, r::text);
  select count(*) into n from public.registros where comercio_id=cA and coleccion='movs';
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_pago_registrar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","monto":41,"medio_pago":"transferencia","rubro_id":"rgen","idempotency_key":"pago-key-007"}',pv1)));
  perform t.chk('pago por transferencia: saldo 700 sin tocar la caja', (r->>'saldo_proveedor')::numeric=700 and (select count(*) from public.registros where comercio_id=cA and coleccion='movs')=n, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_nota_credito(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","monto":100,"referencia":"NC 0001-55","motivo":"Mercadería dañada","idempotency_key":"nc-key-0001"}',pv1)));
  perform t.chk('nota de crédito: baja la deuda a 600', (r->>'saldo_proveedor')::numeric=600, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_nota_credito(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","monto":100,"idempotency_key":"nc-key-0002"}',pv1)));
  perform t.chk('nota de crédito sin número ni motivo: rechazada', r ? 'err', r::text);
  r := t.call(uA3,'a3@a.com',format($q$select public.proveedor_pago_registrar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","monto":1,"medio_pago":"transferencia","rubro_id":"rgen","idempotency_key":"pago-key-008"}',pv1)));
  perform t.chk('el mostrador no registra pagos a proveedores', r ? 'err', r::text);
  -- libro mayor
  select saldo_acumulado into x from public.cuenta_corriente_proveedores where proveedor_id=pv1 order by seq desc limit 1;
  select coalesce(sum(case when tipo_movimiento in ('Factura','Remito') then monto else -monto end),0) into x2 from public.cuenta_corriente_proveedores where proveedor_id=pv1;
  perform t.chk('el saldo del proveedor = último saldo acumulado = suma del libro', x=600 and x2=600 and (select saldo_cuenta_corriente from public.proveedores where id=pv1)=600, x||'/'||x2);
  perform t.chk('cada renglón arrastra el saldo anterior (sin saltos)', not exists (
    select 1 from (select saldo_acumulado, tipo_movimiento, monto, lag(saldo_acumulado, 1, 0::numeric) over (order by seq) as prev from public.cuenta_corriente_proveedores where proveedor_id=pv1) z
     where z.saldo_acumulado <> z.prev + case when z.tipo_movimiento in ('Factura','Remito') then z.monto else -z.monto end));
  begin update public.cuenta_corriente_proveedores set monto = 1 where proveedor_id=pv1; perform t.chk('el libro NO se edita', false); exception when others then perform t.chk('el libro NO se edita', true); end;
  begin delete from public.cuenta_corriente_proveedores where proveedor_id=pv1; perform t.chk('el libro NO se borra', false); exception when others then perform t.chk('el libro NO se borra', true); end;
  begin delete from public.ingresos_mercaderia where tenant_id=cA; perform t.chk('los ingresos NO se borran', false); exception when others then perform t.chk('los ingresos NO se borran', true); end;

  -- ================= LISTADO / API =================
  r := t.call(uA,'a@a.com',format($q$select public.proveedores_listar(%L,null,null,'saldo','desc')$q$,cA));
  perform t.chk('listado ordenado por saldo desc: primero el que más se debe', r->'items'->0->>'razon_social' like 'Distribuidora Norte%' and (r->>'total')::int=2, r::text);
  perform t.chk('KPI deuda total = 600 y órdenes pendientes = 0 (la OC 3 se recibió)', (r->'kpis'->>'deuda_total_proveedores')::numeric=600 and (r->'kpis'->>'ordenes_pendientes_recepcion')::int=0, r->>'kpis');
  r := t.call(uA,'a@a.com',format($q$select public.proveedores_listar(%L,null,'con_deuda')$q$,cA));
  perform t.chk('filtro "con deuda": 1 proveedor', (r->>'total')::int=1 and r->'items'->0->>'estado_cuenta'='Con deuda', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedores_listar(%L,null,'al_dia')$q$,cA));
  perform t.chk('filtro "al día": Bebidas del Sur', (r->>'total')::int=1 and r->'items'->0->>'razon_social'='Bebidas del Sur', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedores_listar(%L,'bebidas')$q$,cA));
  perform t.chk('búsqueda por nombre sin distinguir mayúsculas', (r->>'total')::int=1, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedores_listar(%L,'3071')$q$,cA));
  perform t.chk('búsqueda por CUIT', (r->>'total')::int=1, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedores_listar(%L,'%%')$q$,cA));
  perform t.chk('el comodín % se trata como texto (0 resultados, no "todos")', (r->>'total')::int=0, r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedores_listar(%L,null,null,'saldo; drop table proveedores','asc')$q$,cA));
  perform t.chk('columna de orden fuera de la lista blanca: rechazada (sin inyección)', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.proveedores_listar(%L,null,null,'razon_social','asc',1,1)$q$,cA));
  perform t.chk('paginación: 1 por página, desde el 2.º', jsonb_array_length(r->'items')=1 and (r->>'total')::int=2 and r->'items'->0->>'razon_social' like 'Distribuidora%', r::text);
  r := t.call(uB,'b@b.com',format($q$select public.proveedores_listar(%L)$q$,cA));
  perform t.chk('el admin B no lista proveedores de A', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.cuenta_proveedor(%L,%L)$q$,cA,pv1));
  perform t.chk('estado de cuenta del proveedor: movimientos en orden', jsonb_array_length(r->'movimientos')>=5 and (r->'proveedor'->>'saldo_cuenta_corriente')::numeric=600, left(r::text,200));
  r := t.call(uB,'b@b.com',format($q$select public.cuenta_proveedor(%L,%L)$q$,cB,pv1));
  perform t.chk('no se lee la cuenta de un proveedor de otro comercio', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.compras_snapshot(%L)$q$,cA));
  perform t.chk('snapshot: proveedores, órdenes, ingresos y cuenta', jsonb_array_length(r->'proveedores')=2 and jsonb_array_length(r->'ordenes')=3 and jsonb_array_length(r->'ingresos')>=4 and r->'cuenta' is not null, left(r::text,160));
  perform t.chk('el snapshot no expone claves de idempotencia ni el tenant', position('idempotency_key' in r::text)=0 and position('tenant_id' in r::text)=0);
  r := t.call(uA3,'a3@a.com',format($q$select public.compras_snapshot(%L)$q$,cA));
  perform t.chk('el mostrador no lee compras', r ? 'err', r::text);
  r := t.call(uA,'a@a.com',format($q$select public.ordenes_listar(%L,'Recibida')$q$,cA));
  perform t.chk('órdenes por estado', jsonb_array_length(r)=2, r::text);
  -- integración con el inventario
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"prod","id":"cp1","d":{},"x":true}]'));
  perform t.chk('un artículo comprado a un proveedor no se elimina (se archiva)', (r->>'aplicados')='0' and r::text like '%órdenes de compra o ingresos%', r::text);
  r := t.call(uA,'a@a.com',format(sync,cA,'[{"c":"prod","id":"cp1","d":{"name":"Fernet 750","price":2100000,"cost":1,"stock":9999}}]'));
  select (datos->>'stock')::numeric into x from public.registros where comercio_id=cA and coleccion='prod' and id='cp1';
  perform t.chk('el stock sigue siendo del servidor (el navegador no lo pisa)', x=16, x::text);
  -- auditoría
  select count(*) into n from public.registros where comercio_id=cA and coleccion='audit' and datos->>'action' in ('COMPRA_RECEPCION','PROVEEDOR_ALTA','OC_SOLICITADA','PROVEEDOR_PAGO','PROVEEDOR_NC');
  perform t.chk('las operaciones quedan en la auditoría del servidor', n>=8, n::text);
  -- baja lógica
  r := t.call(uA,'a@a.com',format($q$select public.proveedor_guardar(%L,%L::jsonb)$q$,cA,format('{"id":"%s","razon_social":"Bebidas del Sur","cuit":"30698765433","condicion_iva":"Monotributista","activo":false}',pv2)));
  r2 := t.call(uA,'a@a.com',format($q$select public.orden_compra_guardar(%L,%L::jsonb)$q$,cA,format('{"proveedor_id":"%s","items":[{"producto_id":"cp1","cantidad":1,"precio_costo_pactado":1}]}',pv2)));
  perform t.chk('proveedor archivado: sigue en el historial pero no recibe órdenes nuevas', (r->>'activo')='false' and r2 ? 'err' and r2->>'err' like '%archivado%', r2::text);
  perform t.ctxset('prov1', pv1::text); perform t.ctxset('prov2', pv2::text);
end $$;
