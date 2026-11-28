# Historial de versiones · Almacén RAVE / Sistema VB

Sistema de gestión (POS + inventario + caja + clientes + menú público) para **Almacén RAVE**.
Un solo archivo HTML5 (`index.html`): menú digital adelante, panel del equipo detrás de **Acceso del equipo** (`/#acceso`).
Funciona sin internet y sincroniza con la nube (Supabase) cuando hay conexión. **El proyecto Supabase anterior ya no existe: hay que crear uno nuevo** (ver «Conectar la nube»); no queda ninguna clave vieja que rotar.

## V27.45 — Atención: botón «Enviar» con WhatsApp integrado (sólo Almacén RAVE)
- Con el canal en modo integrado (API oficial), el botón dice **«Enviar ➤»** y el aviso explica que la respuesta sale directo al cliente; antes decía «Abrir WhatsApp y registrar» aunque ya enviaba por la API.
- Sin modo integrado sigue igual («Abrir WhatsApp y registrar»).

## V27.44 — Menú: encabezado centrado y bloque «Dónde estamos» (sólo Almacén RAVE)
- En pantallas anchas el encabezado queda centrado (logo, nombre, rubro y horario al medio; compartir y tema arriba a la derecha).
- Abajo, antes del pie: **mapa de Google** con la dirección y «Cómo llegar», y al lado **Reseñas** (arriba, «Dejar reseña en Google») y **WhatsApp** (abajo, «Escribir por WhatsApp»), con la misma altura que el mapa. En el celular se apilan.
- mv3: el límite de alto contempla el Club y el mapa.

## V27.42 — Barra lateral ordenada y con íconos de color (sólo Almacén RAVE)
- 9 secciones claras: Resumen · Ventas y caja · Pedidos y reparto · Productos y stock · Clientes y Club RAVE · Finanzas · Equipo · Menú y web · Sistema.
- Sin entradas repetidas: las pantallas hermanas quedan en una sola entrada con pestañas — **Precios y etiquetas** (Precios · Etiquetas), **Stock e inventario** (Inventario · Toma de inventario · Depósitos), **Reparto y despacho** (Despacho · Mi hoja de ruta · Armado de cargas · Torre de control · Equipo en el mapa · Devoluciones en tránsito) y **Ventas mayoristas** (Pedidos de venta · Preventa · Acopios).
- «Seguridad y portero» pasa a Equipo; Bot de pedidos y Notificaciones push a Clientes.
- Íconos de color en todas las entradas (🛒 💵 📦 🏷️ 🚚 ⭐ 💬 💰 ⚙️ …), como la barra inferior. Sin cambios de permisos.

## V27.41 — Botones grandes para trabajar rápido (sólo Almacén RAVE)
- **«¿Qué querés hacer?»** arriba del Resumen: botones grandes con ícono (🛒 Vender destacado, 📦 Productos, 💵 Abrir caja / Caja abierta, 🔒 Cerrar caja, ➕ Nuevo producto, 👥 Clientes, 💬 Atención, 🚚 Proveedores). Sólo los que la persona puede usar.
- **Barra inferior del celular** más clara: 🏠 Inicio · 🛒 Vender · 📦 Productos · 💵 Caja · 👥 Clientes · ☰ Más, con íconos de color, textos más grandes y la pestaña activa resaltada. La barra del ticket de Vender queda arriba de ella.
- Cabecera del celular sin «Ver menú público» y deslizable si no entra (320 px sin desborde).
- Prueba nueva `qa1.py` (12).

## V27.40 — Vender sin lista eterna (sólo Almacén RAVE)
- Sin búsqueda ni rubro elegido, Vender muestra **sólo «Más vendidos»** (hasta 12) y una ayuda; el resto aparece al escribir el nombre o el código, pasar el lector o elegir un rubro.
- Con un rubro elegido se ven los primeros 48 y «Mostrar todos».
- Arreglo: sólo el buscador y los rubros quedan fijos al bajar (antes quedaba fija toda la tarjeta con la grilla y tapaba la pantalla), debajo de la barra de teclas F1–F12.
- Prueba `pv3.py`: 17 verificaciones.

## V27.39 — Vender más visual y ágil (sólo Almacén RAVE)
- **«⚡ Más vendidos»** arriba de la grilla: hasta 12, primero los fijados por el dueño («★ Fijar», permiso de configuración) y después los de más rotación de los últimos 30 días. Un toque los suma al ticket. En el celular es un carrusel.
- Buscador y rubros **fijos arriba** al bajar; rubros deslizables; tarjetas con **foto**, nombre en 2 líneas y **precio grande**; marca visual al tocar.
- En la PC el **ticket queda fijo a la derecha**. En el celular: grilla de 2–3 columnas y **barra inferior** con artículos, total y «Ver ticket y cobrar».
- Carga de fotos ya gratuita (V27.31b): «Pegar foto», «Buscar foto en Google» y Open Food Facts, achicadas a WebP en el equipo.
- No cambia el cobro, el stock ni la auditoría. Prueba nueva `pv3.py` (15); v2 ajustada para tocar la grilla general.

## V27.38 — Menú: Club destacado con tarjeta de ejemplo y centrado en pantallas anchas (sólo Almacén RAVE)
- El Club vuelve a mostrarse completo, como en los menús de Sistema VB: título «Registrate gratis y empezá a ganar en cada compra», cuatro beneficios reales (sellos con la meta y el premio configurados, cupones de socio, tarjeta en el celular, pedidos más rápidos), «Crear mi cuenta gratis» / «Ya soy socio» y, a la derecha, la **TARJETA DE EJEMPLO** con sellos, premio y cuántos faltan, en negro y dorado. En celular se apila.
- En pantallas anchas el banner de envío gratis y los bloques ocupan el ancho del menú (antes quedaban corridos a la izquierda).
- Arreglo: el pie mostraba «[object Object]» en lugar de la descripción del comercio.
- Pruebas: mv3 sigue el horario de alcohol (de noche usa productos habilitados); kc1 con contraste correcto en la tarjeta.

## V27.33 — Menú público compacto y orientado a la venta (sólo Almacén RAVE)
- Nueva capa `pub/v3.css` + `pub/v3.js` sobre la tienda premium (no borra nada de lo que funcionaba): la página en celular pasa de ~15.500 a ~10.400 px.
- Encabezado compacto (logo, nombre, horario de alcohol, compartir y tema); el idioma pasa al pie. Banner único de envío gratis y «Armá tu evento» debajo.
- Categorías con íconos y Combos/Promos primero; tarjetas compactas con precio grande y botón «+ Agregar» (− cantidad + al agregar); botones accesibles.
- Barra del pedido ancha con total, «Ver pedido» y el progreso del envío gratis; el pedido se recupera al recargar la página (misma pestaña).
- Club plegado en una tarjeta («Sumarme gratis» / «Ver mi tarjeta»); pie compacto con «Cómo llegar», WhatsApp, reseña, redes, +18 e impuestos; términos, privacidad y arrepentimiento en una ventana; créditos de Vincular Business en una línea con sus datos oficiales (el banner se despliega).
- Mensaje de WhatsApp: «• 2 x Producto - $ subtotal», «Total estimado» y lugar para dirección y forma de pago cuando no se completaron.
- «Armá tu evento»: botón «Sugerir productos automáticamente» en Reglas y, si no hay ningún producto vinculado, el menú publica la sugerencia automática.
- Pruebas: `mv3.py` (22); ajustadas c5, c18, c19, m2 (Club plegado), k2 (pedido recuperado) y ev1.

## V27.32 — Calculador de eventos y «Mi cuenta» del cliente mayorista (sólo Almacén RAVE)
- **Calculador y cotizador de eventos** (Ventas → Eventos): adultos, niños, vegetarianos y sin TACC, tipo de evento, duración y margen. Sugiere cantidades de comida para compartir, bebidas, hielo y descartables con los **precios y el stock reales**, redondeadas a unidades de venta (pizzas enteras, medias docenas, packs, bolsas). Se corrigen a mano y se pasan a **Presupuesto** (no descuenta stock) o a **Vender**; imprimir o guardar PDF.
- Reglas configurables (pestaña «Reglas», permiso de configuración): cada ítem es un producto real con consumo por adulto, «se vende de a», peso en la combinación y aptitud vegetariana / sin TACC; factores por tipo de evento y duración. Redistribución al combinar comidas (+10 % por variedad, tope 30 %).
- **«Armá tu evento»** en el menú público y en la app del Club (Contacto): mismo motor con las reglas y precios publicados; «Agregar al pedido» (un solo deshacer), «Enviar por WhatsApp» e imprimir/PDF. Sólo muestra productos publicados en el menú.
- **App del Club → «Mi cuenta»**: el portal del cliente mayorista queda guardado en el celular al abrir el enlace; desde la app se abre para ver saldo y comprobantes y hacer pedidos, con botón para pedir los datos actualizados. El portal tiene «← App del Club».
- Prompt: `claude/PROMPT_V27_32_CALCULADOR_EVENTOS.md`. Pruebas: `ev1.py` (20), `cta1.py` (9) y 11 del motor.

## V27.31b — Alta de productos simple y gratis (sólo Almacén RAVE)
- «Buscar en Google» (datos) y «Buscar foto en Google» abren Google en otra pestaña con el nombre o el código: sin claves ni servicios pagos.
- «Pegar foto» (o Ctrl+V en el formulario): la foto copiada de Google pasa por el recorte, se achica y queda guardada en el producto.
- Al agregar una foto en un producto nuevo se marca «Publicar en menú digital» (se puede destildar); la búsqueda ya no apaga el menú.
- Función `productos` v2: sólo fuentes gratuitas (Open Food/Beauty/Products Facts). UPCitemdb, Brave e IA quedan apagadas aunque exista una clave (se encienden sólo con `PW_PAGOS=si`).
- El Launch pad no es pantalla de inicio ni aparece en el portal del empleado.

## Versión: SISTEMA VB 26F (`SISTEMA_VB_26F`)

**V27.31 (2026-11-24):** **Rediseño de Atención al cliente, Launch pad y alta de productos desde internet.**
- **Kit de interfaz común** (`app/p2f-ui.js`): encabezado de pantalla con una acción principal y el resto en «Más», insignias de estado estándar (Activo · Enlace directo · Sin conectar · Requiere atención · Con error), panel lateral, estados vacíos, tiras de indicadores y pasos de asistente.
- **Atención al cliente:**
  - Registro de pestañas (`crmTabAdd`): Hoy, Oportunidades, Agenda y Automatización ya no parchean el HTML con expresiones regulares.
  - Encabezado limpio («Nueva conversación» + «Más»); los indicadores solo se ven en la Bandeja.
  - **Canales**: 8 tarjetas iguales sin bordes de color, estados claros («En la Bandeja» / «Enlace directo» / «Sin conectar» / «Requiere atención»), una acción por tarjeta y un **panel guiado** (enlace directo o en la Bandeja, estado real de la conexión leído de la función «canales», «Probar y activar») con lo técnico en «Opciones avanzadas».
- **Launch pad** arriba de Resumen (`app/p2g-launch.js`): buscador, accesos rápidos, favoritos y recientes por usuario, con las mismas reglas de visibilidad que la barra lateral.
- **Alta de productos desde internet** (`modulos/inventario/p29-producto-web.js`, función `productos`, SQL 40):
  - Reglas de códigos argentinos: EAN, UPC y DUN-14; los códigos de balanza no se buscan.
  - Borrador en el formulario de siempre, con el campo **Marca** nuevo. Los precios nunca vienen de internet y el menú queda apagado.
  - Fotos con licencia (Open Food Facts, CC BY-SA), validadas y achicadas.
  - Alta desde Vender cuando se escanea un código sin cargar.
  - Las demos usan un catálogo de ejemplo sin marcas reales. Las fichas compartidas quedan apagadas por defecto.
- **Canales (V27.30):** WhatsApp, Messenger e Instagram con token propio. «Probar» activa la recepción del número y de la página.

**V27.9 (2026-11-17):** **Mayorista · vender sólo a comercios.** Con «Sólo mayorista» se puede exigir un cliente mayorista con CUIT en cada venta (Configuración → Mayorista); sin comercio elegido no se cobra. La **demo Mayorista** pasa a ser sólo para mayoristas: sin canal minorista, sin «Consumidor final» ni «Cambiar canal», clientes y ventas de ejemplo todos comercios con CUIT, sin modo kiosco/autoservicio (`DEMO_CANAL=may DEMO_CLIENTE=1`; también corrige los datos ya guardados en el navegador).

**V26.71 (2026-11-13):** «Detalle de los cobros digitales» compacto: interruptor y resumen a la vista; los ajustes por medio y campo quedan plegados en «Ajustes avanzados».

**V26.70 (2026-11-12):** **Atención al cliente · Centro de canales.** Pestaña **🔌 Canales** con los 8 canales (tienda web y chat, WhatsApp Business, Instagram, Messenger, Telegram, correo, TikTok y Tiendanube), estado y avance. **⚡ Conectar todo con un clic** toma el WhatsApp del comercio y las redes del menú y publica los botones oficiales (wa.me, ig.me, m.me, t.me, mailto, TikTok) en el menú y en la app del Club. Cada canal se puede pasar a **Integrado** con un asistente paso a paso (enlaces exactos, botones para copiar y generar valores, «Probar y activar»): los mensajes de Telegram, WhatsApp Business, Instagram, Messenger y correo entran **cifrados** a la Bandeja y se responden desde el sistema (función `canales`; las claves quedan sólo como secretos de Supabase).

**V26.69 (2026-11-12):** **Reparto y despacho omnicanal + apps.** 📲 Botón **Instalar app** (sistema para el equipo y app del Club para clientes; funcionan sin señal). ⭐ **App del cliente**: tarjeta, beneficios, pedidos con seguimiento en vivo y código de entrega, y botones de contacto según el rubro. 🛵 **Reparto**: «Envío a domicilio» en Vender (ya pagado / efectivo con vuelto / QR en la puerta), bandeja única con pedidos del mostrador, teléfono, WhatsApp y **menú digital** (llegan cifrados), picking, hojas de ruta con orden óptimo y Google Maps/Waze, **copiloto del repartidor** (una parada, PIN, cliente ausente, billetera) y **rendición ciega en caja**. Conectores a un clic: gratis listos; Google Routes, Mercado Pago y WhatsApp Cloud preparados (función `reparto-pro`). Migración `supabase/26-reparto.sql`. Rol nuevo **Repartidor**.

**V26.68 (2026-11-12):** **Seguridad y portero** (Operación → *Seguridad y portero*): el portero del local, **SeguridadRave**, queda integrado al sistema como en Cannabismática. Los timbres (en la puerta y por QR) y las alertas llegan a cualquier pantalla, con sonido y la foto de la cámara, y se responde a la visita con *Ya voy · Un momento · Dejar en la puerta · No atendemos*. Pánico y coacción llegan como alertas silenciosas sólo a quien tiene el permiso. Los temas de aviso se guardan cifrados; la puerta se sigue abriendo desde SeguridadRave. Permisos nuevos «Seguridad y portero» y «Alertas silenciosas de seguridad».

**V26.67 (2026-11-11):** **Sello con el celular del cliente**: un chip NFC (y el mismo enlace en QR, para celulares sin NFC) en el mostrador; el cliente acerca su celular con la tarjeta del Club guardada y pide su sello; el sistema del mostrador lo valida (un solo uso, un sello cada 24 h) y lo aprueba el cajero (aviso «Aprobar / Rechazar») o se aprueba solo. Configuración → Clientes y NFC → *Sello con el celular del cliente*: puntos de sello, enlace para grabar el chip con NFC Tools y cartel A5 con QR. Migración `supabase/25-sello-nfc-mostrador.sql`. Prompt de mejoras corregido en `fuente/docs/historial/PROMPT-mejoras-POS.md`.

**V26.66 (2026-11-11):** **NFC configurable** en todo el sistema: Configuración → *Lector NFC del mostrador* elige el lector de cada equipo (lector USB en modo teclado, celular Android o sin NFC) y qué hace el NFC en el negocio (sumar sello, identificar al cliente en Vender y el cobro, fichar en el kiosco o en el mostrador); las tarjetas se **vinculan por su número** (sin grabarlas) desde la ficha del cliente o del empleado, o acercando una tarjeta nueva en Fidelización; *Probar lector* y lista de tarjetas vinculadas. **Configuración ordenada**: tarjeta única *Modelo de negocio* (¿de quién es el dinero? · ¿a quién le vendés?: sólo minorista / minorista y mayorista / sólo mayorista) y accesos por grupo (Negocio, Equipo y seguridad, Ventas y cobros, Clientes y NFC…). **Modo claro/oscuro arreglado**: selector Claro · Oscuro · Sistema (antes el primer toque no cambiaba nada), también en el ingreso y en Configuración → Apariencia. **Restablecer acceso** del equipo en un paso (clave temporal; migración `supabase/24-restablecer-acceso.sql`) y **asistente de Ingreso con Google** con verificación en vivo (`supabase/LEEME-google.md`).

**V26.52 (2026-11-05):** R2AVE en Telegram (@R2aveBot), sólo para administradores: consultas de ventas, stock, cajas, cierres y deudas; corrección de stock en dos pasos con límites cuando el administrador la habilita; alertas a un grupo. Se configura en Configuración → R2AVE en Telegram (instalación en `supabase/LEEME-supabase.md`).

**V26.51 (2026-11-05):** con una ventana abierta el Tab ya no se va a la pantalla de atrás; y desde la ficha del cliente se le puede mandar un WhatsApp con su saldo (Fiado / Cuenta corriente y vencimientos) o un aviso.

**V26.50 (2026-11-05):** modo oscuro y claro revisados pantalla por pantalla: la línea seleccionada del ticket ya no queda con fondo claro y letra clara, y los avisos en rojo se leen en los dos modos.

**V26.50 (2026-11-05):** cobro en efectivo con **importe recibido obligatorio**, ubicado debajo del total y arriba de los medios de pago; F12 deja el cursor ahí, Enter cobra y «Justo» completa el total exacto.

**V26.50 (2026-11-04):** en Vender, después de sumar un artículo el cursor vuelve solo a «Buscar artículo» para seguir cargando sin tocar el mouse; corregido el doble conteo al leer un código de barras con el cursor en el buscador.

**V26.49 (2026-11-04):** **recargo o descuento por medio de pago** (efectivo, débito, crédito, transferencia, QR, MODO; % o monto; sólo el administrador; aviso legal de la Ley 25.065), **balanzas Systel y Kretz con reconocimiento automático** (pide el peso, estable 400 ms, anti-duplicado), **etiquetas EAN-13 de balanza corregidas** (prefijo de 2 cifras y dígito verificador), **Fiado y Cuenta corriente separados**, **cortes X y Z** numerados, **apertura del cajón** y corte del papel, y **pantalla del cliente** para un segundo monitor. Migraciones `supabase/16-ajustes-medios-pago.sql` y `17-fiado-cc-cortes.sql` (**correrlas en Supabase antes de activar los recargos y de usar el corte X**). Detalle y pruebas: anexo S de `fuente/docs/historial/SISTEMA_VB_26F.md`.

**Prompt V26.4 (2026-10-19):** `fuente/docs/historial/SISTEMA_VB_26F.md` suma la especificación del módulo **Mayorista / Minorista (sección 4.22)** y el **Anexo E** (punto de reanudación con prompt de arranque). Es sólo documentación: el sistema publicado no cambió y 4.22 todavía no está construido.

**V26.3 (2026-10-19) · Club RAVE:** el cliente escanea el QR del menú, se anota (DNI opcional) y **recibe su tarjeta en el celular**; el negocio la importa sola y en el mostrador se suma el sello por **QR, código, DNI o NFC** (migración `supabase/09-club-tarjeta.sql`; pruebas `fuente/pruebas/c18.py`, `c19.py`, SQL 16). Wallet de Apple/Google: no implementado.

**V26.1 (2026-10-18):** cobro con **pagos mixtos** (p. ej. $ 40.000 efectivo + $ 20.000 cuenta corriente), validación de suma exacta, **alerta de vuelto**, arqueo que cuenta sólo el dinero que entró, débito automático en la cuenta corriente con estado *Pago parcial* y libro del cliente (migración `supabase/07-pagos-mixtos.sql`; pruebas `fuente/pruebas/v7.py`, `c16.py`, SQL 14). Marca oficial **VINCULAR BUSINESS** (banner, único celular (387) 4484132, vincularbusiness@gmail.com, lema) en ingreso, menú lateral, menú público ES/EN, tickets y mensajes del sistema.

El prompt maestro vigente está en `fuente/docs/historial/SISTEMA_VB_26F.md` (el anterior `docs/historial/sistema_vb_26.md` queda como historial) (incluye un anexo *as-built* con lo que está hecho, probado y pendiente). Las pruebas automáticas están en `fuente/pruebas/`.

## Estado de esta entrega (leer antes de usar)

| Pieza | Estado |
|---|---|
| `index.html` | **Armado sin conexión a la nube**: el ingreso dice *Pendiente de configuración* hasta compilarlo con la URL y la clave **publicable** del proyecto (ver «Conectar la nube»). |
| Nube (Supabase) | Scripts SQL `supabase/00…06` + función `arca`. Probados con Postgres/PostgREST locales (no contra el proyecto real todavía). |
| CAE automático de ARCA | Implementado (servidor + navegador). **Sin probar contra ARCA real**: requiere certificado del comercio y prueba en homologación. Mientras tanto la venta «Con ARCA» queda *pendiente de CAE*. |
| Hardware (impresora, balanza, lector) | Sin probar con equipos reales [VERIFICAR por modelo]. |
| Textos legales | Plantillas [VERIFICAR] con asesor legal. |

## Conectar la nube (lo hace Vincular Business)

0. Crear un proyecto nuevo en Supabase y anotar la *Project URL* y la clave **publicable** (`sb_publishable_…`).
1. En ese proyecto: **Authentication → Providers → Email → desactivar «Confirm email»**.
2. Aplicar los SQL en el *SQL Editor* siguiendo `supabase/LEEME-supabase.md`: en un proyecto nuevo se aplican `01` a `06` y **se salta el `00`** (sólo archiva un esquema viejo) (pegar el **contenido**, no el nombre del archivo).
3. Desplegar la función `arca` y cargar su secreto (ver el mismo LEEME).
4. Compilar con la dirección y la clave **publicable** (nunca la secreta):

```bash
cd fuente
SUPABASE_URL="https://<ref>.supabase.co" SUPABASE_KEY="sb_publishable_…" RAVE_SLUG="almacen-rave" \
  python3 build.py cliente ../index.html
```

`build.py` rechaza cualquier clave que parezca secreta (`service_role`, `sb_secret_…`). El archivo sólo lleva la URL y la clave publicable.
5. Publicar con GitHub Pages (Settings → Pages → rama `main`, carpeta `/`).

> El `RAVE_SLUG` tiene que coincidir con el *slug* del comercio en la base (con el nombre «Almacén RAVE» queda `almacen-rave`).

## Seguridad en una línea

Cifrado AES-256-GCM en el equipo (clave envuelta con PBKDF2-SHA256 200.000), datos personales cifrados antes de subir, aislamiento por comercio con RLS, roles validados en el servidor, stock sumado por el servidor, clave privada de ARCA sólo en el servidor, sin secretos en el archivo. Sin la contraseña ni el código de recuperación los datos cifrados no se pueden recuperar (por diseño).

Desarrollado por **VINCULAR BUSINESS** · Único celular (387) 4484132 · vincularbusiness@gmail.com · *“Tu idea, en buenas manos.”*
