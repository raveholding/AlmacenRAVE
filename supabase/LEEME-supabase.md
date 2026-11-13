> **Ingreso con Google y recuperación de acceso:** ver `LEEME-google.md` (valores exactos para Google Cloud y Supabase).

> **Proyecto nuevo:** el proyecto Supabase anterior ya no existe. Para uno nuevo alcanza con pegar **el contenido** de `INSTALAR-TODO.sql` (= 01 a 17, sin el 00) en el SQL Editor y ejecutarlo una vez. Después: `select public.rave_invitar_comercio('correo','Almacén RAVE','CODIGO');`, desactivar «Confirm email» y desplegar la función `arca`.

# Supabase · proyecto raveholding · Sistema RAVE

Todo se hace con el **dueño del proyecto** (Vincular Business). Nada de esto va en el HTML.

## 0 · Antes de empezar
- **Backup** del proyecto (Database → Backups) por si ya tenía datos del sistema viejo.
- *Authentication → Providers → Email*: **«Confirm email» desactivado**.

## 1 · SQL (SQL Editor → pegar TODO el contenido del archivo → Run), en este orden
| Archivo | Para qué |
|---|---|
| `00-limpiar-proyecto-anterior.sql` | **OPCIONAL.** Sólo si el proyecto ya tuvo el sistema viejo `menu-rave`: mueve sus tablas al esquema `anterior_menu_rave` (no borra datos) y quita las funciones viejas de `public`. Si el proyecto está vacío, no hace falta. |
| `01-base.sql` | Comercios, equipo, invitaciones, claves. |
| `02-sincronizacion.sql` | Sincronización entre equipos, stock por movimientos, roles. |
| `03-recuperacion-soporte.sql` | Recuperación de clave y pedidos de ayuda. |
| `04-menu-publico.sql` | Menú público en la nube y alta al Club. |
| `05-arca.sql` | Facturación electrónica (tablas y funciones del CAE). |
| `06-v26.sql` | V26: borrado protegido y archivo de artículos (sólo administrador), cajas/sucursales/traspasos (colecciones `sucs`, `cajas`, `ctransf`). Aditivo e idempotente: si ya tenías 01 a 05, pegá sólo este. |
| `08-proveedores-compras.sql` | **Proveedores y compras (V26.2):** tablas `proveedores`, `ordenes_compra`(+detalles), `ingresos_mercaderia`(+detalles) y `cuenta_corriente_proveedores` (libro sólo-agregar), con RLS por comercio, y las funciones `procesar_recepcion` (stock + costo + deuda/caja en una sola transacción), pagos, notas de crédito y `compras_snapshot`. Aditivo e idempotente. **Requiere 06 y 07 ya aplicados.** |
| `10-mayorista-precios.sql` | **Mayorista/Minorista (V26.6, fase F1):** función interna `rave_deuda_cliente`, permisos de las colecciones nuevas `acuer` (acuerdos de precio), `cexc` (excepciones de crédito) y `cexcu` (consumo, sólo-agregar), validación del canal de venta y marca `credit_review` cuando una venta a cuenta corriente supera el límite sin excepción válida. Aditivo e idempotente. **Requiere 06, 07 y 09 ya aplicados. Correrlo ANTES de activar «Canal mayorista» en Configuración.** |
| `11-traspasos-cobros-auditoria.sql` | **Traspasos entre cajas, detalle de cobros digitales y auditoría sólo-agregar (V26.8):** tablas `traspasos`, `traspaso_eventos`, `cobro_detalles`, `auditoria_eventos` (cadena de hashes verificable con `rave_verificar_cadena`), detector de números de tarjeta completos (`rave_parece_pan`), reglas del detalle del cobro configurables por comercio y espejo de la auditoría del panel. Aditivo e idempotente. **Requiere 01 a 10 ya aplicados.** |
| `13-tiendanube.sql` | **Integración con Tiendanube (V26.13):** conexión por tienda con token cifrado (sin lectura por la API), espejo de variantes con vínculo uno a uno al producto del sistema, órdenes con estados separados (orden / pago / envío) que nunca retroceden, bitácora sólo-agregar. **Requiere 01 a 12 y la función `tiendanube`.** |
| `12-pago-proveedor-cajas.sql` | **Pago a proveedor repartido entre varias cajas (V26.12):** el pago en efectivo puede salir de la caja principal y de otras cajas a la vez (`asignaciones`); un solo Pago en el libro, un egreso por caja, todo o nada, tabla sólo-agregar `pagos_proveedor_asignaciones`. Sin `asignaciones` funciona como siempre. **Requiere 01 a 11.** |
| `16-ajustes-medios-pago.sql` | **Recargos y descuentos por medio de pago (V26.49):** documento de configuración `cfg/payadj` que escribe **sólo el administrador** (todos los roles lo leen para cobrar) y control de los pagos con ajuste dentro de cada venta (`a = base + ajuste`, enteros; un descuento no supera la base). Modifica la función vigente `sincronizar` en el lugar (no la copia entera). Aditivo e idempotente. **Requiere 01 a 15. Correrlo ANTES de activar los recargos en Configuración** (sin él, el servidor rechaza la configuración nueva). |
| `17-fiado-cc-cortes.sql` | **Fiado / Cuenta corriente y cortes X (V26.49):** colección `cortesx` (foto del turno que no cierra la caja; escritura única, todos los roles de caja) y validación del tipo de deuda de la venta (`ck` = `fiado` o `cc`). Modifica en el lugar `sincronizar` y `rave_puede_escribir`. Aditivo e idempotente. **Requiere 01 a 16.** |
| `18-telegram.sql` | **R2AVE en Telegram (@R2aveBot, V26.52, sólo Almacén RAVE):** configuración del bot por comercio (encendido, ventana de correcciones de stock, límites, IA, grupo de alertas) que cambia **sólo el administrador**; vínculos Telegram ↔ administrador con códigos de un solo uso; correcciones de stock en dos pasos que se vuelven a verificar al confirmar (mismo camino que los equipos: `smov` + stock + Auditoría). Las tablas no se leen por la API: sólo la función `telegram` (service role) y las funciones del administrador. Aditivo e idempotente; no toca `sincronizar`. **Requiere 01 a 17 y la función `telegram`.** |
| `24-restablecer-acceso.sql` | **Restablecer acceso en un paso (V26.66):** función `restablecer_acceso_miembro`: el administrador le da a alguien de su equipo una clave temporal y su llave de datos queda envuelta con esa clave (marcada temporal); al entrar, la persona elige su contraseña nueva. Mismas restricciones que `03` (no otro administrador, no personas de otro comercio). Aditivo e idempotente. **Requiere 01 a 23.** Guía: `LEEME-google.md`. |
| `25-sello-nfc-mostrador.sql` | **Sello con el celular del cliente (V26.67):** tablas `sello_puntos` y `sello_pedidos` + funciones `sello_punto_guardar` (admin), `club_pedir_sello` y `club_sello_estado` (celular, anónimas, con límites) y `sello_resolver` (equipo). El pedido viaja cifrado con la llave pública del comercio: lo valida el sistema del mostrador. Aditivo e idempotente. **Requiere 01 a 24.** |
| `26-reparto.sql` | **Reparto y despacho (V26.69):** rol de equipo **repartidor**; colecciones `envio`, `ruta` y `rendrep` en la sincronización (datos del cliente cifrados; rendiciones de una sola vez); `reparto_web` + `reparto_pedir` (pedido con envío desde el menú, **cifrado** con la llave pública del comercio, con límites) y `reparto_web_marcar`; `reparto_seguimiento` + `reparto_estado_poner` (equipo) y `reparto_estado_ver` (celular del cliente: sólo estado, demora y nombre de pila del repartidor). Aditivo e idempotente. **Requiere 01 a 25.** |
| `90-reiniciar-pruebas.sql` | **SÓLO PRUEBAS. Borra lo subido por todos los comercios.** No correr con el sistema en uso real. |

Todos (menos 90) se pueden repetir sin romper nada.

## 2 · Crear el comercio del cliente (una vez, desde el SQL Editor)
```sql
select public.rave_invitar_comercio('correo-del-dueño@…', 'Almacén RAVE', 'CODIGO-DE-INVITACION');
```
El dueño abre el sistema → *Crear comercio* → usa ese correo, una contraseña propia y el código. El sistema le muestra **una sola vez** su código de recuperación (20 caracteres): tiene que guardarlo.
Slug resultante: `almacen-rave` (si ya existiera, agrega `-2`): tiene que coincidir con `RAVE_SLUG` al compilar.

## 3 · Función de ARCA (CAE automático)
```bash
supabase link --project-ref <ref>
supabase secrets set ARCA_MASTER_KEY="$(openssl rand -base64 32)"
supabase secrets set ALLOWED_ORIGINS="https://raveholding.github.io"
supabase functions deploy arca --no-verify-jwt   # la propia función valida al usuario con arca_quien()  [VERIFICAR flags vigentes del CLI]
```
- `ARCA_MASTER_KEY` cifra las claves privadas de ARCA en la base. **Guardala en un lugar seguro: si se pierde hay que regenerar los certificados.** No va al repositorio.
- Opcionales: `ARCA_WSAA_URL_HOMO/PROD`, `ARCA_WSFE_URL_HOMO/PROD`, `ARCA_QR_BASE`.
- Los nombres de menús, servicios y URLs de ARCA cambian: confirmar en arca.gob.ar [VERIFICAR].

## 4 · Primer CAE (lo hace el dueño dentro del sistema)
*Periféricos y ticket → Facturación electrónica (ARCA)*: datos del emisor → generar clave y CSR → trámite en la web de ARCA con Clave Fiscal → cargar el .crt → autorizar el servicio WSFE y crear el punto de venta «web services» → *Probar conexión* → activar. **Primero en homologación; producción sólo después de probar.**

## 5 · Seguridad que conviene verificar
- La clave **publicable** (`sb_publishable_…`) es la única que va en el HTML. La **secreta / service_role no** va en ningún lado fuera de Supabase.
- Si alguna clave del proyecto anterior (`menu-rave`) estuvo escrita en un HTML o repositorio público, **rotarla** en Supabase (Settings → API Keys).

## 6 · Pruebas incluidas (`tests/`)
`tests/run.sh` corre 152 comprobaciones SQL (aislamiento entre comercios, roles, stock, cierres, ARCA), `20-concurrency.sh` prueba dos cajas vendiendo a la vez y `functions/arca/arca_test.ts` (Deno) prueba la función contra un ARCA **falso**. Necesitan un Postgres/PostgREST local (`tests/mk-e2e-db.sh`). **No sustituyen la prueba en homologación con ARCA real.**

## Función `telegram` · R2AVE en Telegram (@R2aveBot) · sólo Almacén RAVE
Lo usan **sólo los administradores**. Pasos (una vez):
1. **SQL:** correr `16-ajustes-medios-pago.sql`, `17-fiado-cc-cortes.sql` y `18-telegram.sql` (en ese orden, si no estaban).
2. **Función:** Supabase → Edge Functions → *Deploy a new function* → nombre `telegram`, con los dos archivos de `functions/telegram/` (`index.ts` y `handler.ts`). En la configuración de la función, **apagar «Verify JWT»** (Telegram no manda sesión; la protege la cabecera secreta y las acciones del sistema verifican al administrador en la base).
3. **Secretos** (Edge Functions → Secrets). Los carga el administrador; **el token no se manda por chat, mail ni WhatsApp y no se escribe en el sistema**:
   - `TELEGRAM_BOT_TOKEN`: el que da @BotFather para @R2aveBot (si alguna vez se compartió, pedile a @BotFather `/revoke` y cargá el nuevo).
   - `TELEGRAM_WEBHOOK_SECRET`: 32 o más caracteres aleatorios, sólo `A-Z a-z 0-9 _ -` (por ejemplo, el resultado de `openssl rand -hex 32`).
   - `TG_COMERCIO` = `almacen-rave` (el bot atiende a un solo comercio).
   - Opcional: `ANTHROPIC_API_KEY` (preguntas en lenguaje natural; si no está, el bot responde con los comandos).
4. **Conectar:** en el sistema, Configuración → *R2AVE en Telegram* → **Conectar con Telegram** (registra el webhook con el secreto y la lista de comandos) → encender el bot → **Vincular mi Telegram** (código de un solo uso, 10 minutos).
5. **Alertas (opcional):** agregar @R2aveBot a un grupo y que un administrador vinculado escriba `/alertas_aqui`. Para el resumen diario, programar en Supabase → Integrations → Cron una llamada `POST https://<proyecto>.supabase.co/functions/v1/telegram?alertas=1` con la cabecera `x-tg-cron: <TELEGRAM_WEBHOOK_SECRET>` (por ejemplo, todos los días a las 8:30 y a las 20:30). Las alertas no se repiten.

Pruebas: `./tests/mk-e2e-db.sh && bun test functions/telegram/tg_test.ts` (Telegram e IA **falsos**). La prueba real se hace con @R2aveBot una vez instalado.

## Función `reparto-pro` · conectores Pro del reparto · opcional
Lo gratis del reparto (Google Maps / Waze por enlace, OpenStreetMap, QR fijo o alias, aviso por WhatsApp con un toque) funciona **sin esta función**. Sólo hace falta para los conectores Pro.
1. Edge Functions → **Deploy a new function** → nombre `reparto-pro` → pegar `functions/reparto-pro/index.ts` y `handler.ts`. **Verify JWT: APAGADO** (Mercado Pago avisa sin sesión; las acciones del sistema validan la sesión y el rol adentro).
2. Edge Functions → **Secrets** (sólo los que vayas a usar; nunca en el chat ni en el sistema):
   - Google Routes: `GOOGLE_ROUTES_KEY` (clave de Google Maps Platform con *Routes API* habilitada y restringida a esa API).
   - Mercado Pago: `MP_ACCESS_TOKEN` (credencial de producción) y `MP_WEBHOOK_SECRET` (Tus integraciones → Webhooks → clave secreta); `FUNCTION_URL` = `https://<proyecto>.supabase.co/functions/v1/reparto-pro`.
   - WhatsApp Cloud API: `WA_TOKEN`, `WA_PHONE_ID`, `WA_TEMPLATE` (plantilla aprobada de tipo *utilidad* con **una** variable en el cuerpo, p. ej. `pedido_salio`) y `WA_LANG` (`es_AR`).
   - `ALLOWED_ORIGINS` = `https://raveholding.github.io`.
3. En el sistema: Reparto → Configuración → **Conectores a un clic** → elegir el modo Pro → **Probar y activar** (sólo el administrador). Si la prueba falla, sigue funcionando el modo gratis.
4. Pruebas locales: `node --experimental-strip-types functions/reparto-pro/reparto_test.mjs` (15/15).

## Función `canales` · Atención al cliente integrada (Telegram, WhatsApp Business, Instagram, Messenger, correo) · opcional
El modo **rápido** de cada canal (botones oficiales en el menú y la app del Club) no necesita esta función. El modo **integrado** sí: los mensajes entran cifrados a `crm_entrantes` (la misma tabla del chat web; no hace falta SQL nuevo) y se responden desde la Bandeja.
1. Edge Functions → **Deploy a new function** → `canales` → pegar `functions/canales/index.ts` y `handler.ts`. **Verify JWT: APAGADO** (Telegram, Meta y el correo avisan sin sesión; cada aviso se valida con su secreto y las acciones del sistema validan sesión y rol).
2. Secrets comunes: `CANALES_COMERCIO` (código del comercio, p. ej. `almacen-rave`), `FUNCTION_URL` (`https://<proyecto>.supabase.co/functions/v1/canales`), `ALLOWED_ORIGINS`.
3. Por canal (el asistente de Atención al cliente → Canales muestra cada paso con enlaces y botones para copiar):
   - Telegram: `TG_CLIENTES_TOKEN` (de @BotFather) y `TG_CLIENTES_SECRET` (botón «Generar valor») → en el sistema tocar **Conectar Telegram**.
   - WhatsApp Business / Instagram / Messenger (una sola app de Meta): webhook `FUNCTION_URL?c=meta`, `META_VERIFY_TOKEN`, `META_APP_SECRET`; WhatsApp: `WA_TOKEN` y `WA_PHONE_ID`; Instagram y Messenger: `META_PAGE_TOKEN`.
   - Correo: entrada por reenvío (Postmark / Mailgun / Cloudflare Email Routing) a `FUNCTION_URL?c=mail&k=<MAIL_IN_SECRET>`; salida con Resend: `RESEND_API_KEY` y `MAIL_FROM`.
4. Pruebas locales: `node --experimental-strip-types functions/canales/canales_test.mjs` (33/33).

## Función `api` (REST de Proveedores y Compras) · opcional
La pantalla del sistema **no la necesita** (usa las funciones SQL con la sesión del usuario). Sirve para integrar otros sistemas. Se despliega igual que `arca` (ver `despliegue-panel/LEEME.md`), **sin ningún secreto propio**: usa `SUPABASE_URL` y `SUPABASE_ANON_KEY`, que Supabase ya provee, y reenvía el JWT del usuario; la base decide qué puede hacer. Rutas y formato en la sección 4.21 de `fuente/sistema_vb_26.md`.
