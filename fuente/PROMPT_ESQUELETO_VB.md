# SISTEMA VINCULAR BUSINESS — PROMPT ESQUELETO (base genérica para cualquier comercio)

Versión de esqueleto **V27.2** · construido a partir de `SISTEMA_VB_26F.md` (revisión V26.63) · 2026-11-10
Desarrollado por **VINCULAR BUSINESS** · Celular **(387) 4484132** · **https://www.vincularbusiness.com.ar/** · **vincularbusiness@gmail.com** · lema **“Tu idea, en buenas manos.”**

> Este documento es el **esqueleto**: describe el producto genérico que se vende a cualquier comercio (minorista, gastronomía, mayorista/distribuidora, servicios, profesionales, ONG). **No contiene datos de ningún cliente.** Lo propio de cada negocio se carga en la **Ficha del negocio (sección 2)** y en una **capa de particularidades (sección 12)**, nunca en el núcleo. El detalle técnico de cada módulo vive en `SISTEMA_VB_26F.md` (secciones 4.x y anexos); acá está el orden, las reglas y el estado.

---

## 0. CÓMO SE USA

1. Pegá este documento completo como instrucciones del proyecto. No lo resumas.
2. Completá la **Ficha del negocio** (sección 2). Lo que falte se deja `[PENDIENTE]`; nunca se inventa.
3. Elegí el **perfil de compilación** y los **módulos** (secciones 3 y 6). Lo específico vive en configuración, módulos o adaptadores: el núcleo no se toca.
4. Antes de cambiar código: **inspeccioná el repositorio real** (sección 10), corré la regresión como línea base y listá los supuestos.
5. Una función se declara hecha **sólo con evidencia**: archivo, migración y prueba que pasa. Nunca «100 % funcional» ni «sin errores».
6. Si el pedido es contradictorio o riesgoso, se dice antes de programar y se propone la alternativa segura. Si falta un dato, se pregunta **una sola vez y todo junto**.

Convenciones: identificadores de código en inglés; textos de pantalla en castellano rioplatense simple (con inglés en el menú público); `[VERIFICAR]` = dato normativo o técnico a confirmar en la fuente oficial antes de afirmarlo.

---

## 1. QUÉ ES EL PRODUCTO

**Sistema Vincular Business**: ERP/POS conversacional y modular, multicomercio y multisucursal, que unifica ventas, caja, inventario, compras, clientes y fidelización, CRM omnicanal, personal, menú público/tienda y facturación electrónica. Funciona **sin conexión** y sincroniza con la nube cuando hay internet.

Tres piezas con el mismo código:
1. **Archivo HTML único** (hosting estático / GitHub Pages): adelante el **menú público** del comercio; detrás de «Acceso del equipo» (`#acceso`) el **panel** (`#panel/<pantalla>`). Base local cifrada (IndexedDB, AES-256-GCM).
2. **Nube (Supabase con RLS):** un proyecto para todos los comercios, aislados por `comercio_id`; escritura sólo por la función `sincronizar()`; secretos sólo del lado servidor.
3. **Programa de Windows** (instalador 64/32 bits que abre, actualiza y desinstala). No se modifica salvo pedido expreso.

**Por qué no React/Vue ni Figma en el código:** el producto ya es una SPA (las pantallas cambian sin recargar), funciona por `file://` y en un solo archivo instalable; cambiar de framework rompería lo que está en producción sin ganar velocidad. Las maquetas pueden hacerse en una herramienta de diseño, pero la fuente de verdad visual son las **variables CSS** del sistema (sección 7).

---

## 2. FICHA DEL NEGOCIO (completar por cliente)

| Dato | Valor |
|---|---|
| Nombre comercial, razón social, rubro | `[NOMBRE]` · `[RAZÓN SOCIAL]` · `[COMERCIO / GASTRONOMÍA / MAYORISTA / SERVICIOS / PROFESIONAL / ONG]` |
| Dirección, localidad, provincia, país, zona horaria, moneda | `[…]` |
| WhatsApp (con código de país), teléfono, correo, redes | `[…]` |
| Marca: logo, color principal (acento), color secundario, nombre del Club | `[LOGO]` · `[#RRGGBB]` · `[#RRGGBB]` · `[CLUB …]` |
| Fiscal: CUIT, condición IVA, punto de venta Web Services, ambiente | `[…]` (ver módulo Facturación) |
| Nube: URL del proyecto + clave **publicable**, correo del administrador | `[…]` (nunca claves secretas) |
| Equipo: nombre, correo y rol (admin / supervisor / mostrador / operador) | `[…]` |
| Cajas y sucursales: modelo (simple / varias / principal / multisucursal) | `[…]` |
| Socios y reparto por rubro (cada rubro es una persona) | `[SÍ/NO]` |
| Mayorista: presentaciones (Unidad, Display, Fardo, Pallet…), sólo mayorista, crédito y plazo | `[…]` |
| Venta restringida (alcohol, tabaco): horarios y edad | `[REGLAS — VERIFICAR]` |
| Cobro asistido: alias, CBU/CVU, titular | `[…]` |
| Menú público: modo (local / tienda con envíos), zonas y tarifas, textos legales | `[…]` |
| Periféricos: impresora, balanza (Systel/Kretz…), lector, cajón, pantalla del cliente | `[MARCA Y MODELO]` |
| Catálogo y sistema anterior | Excel/CSV, qué se puede exportar |

---

## 3. PERFILES DE COMPILACIÓN (una base, varios productos)

`python3 build.py <perfil> <salida>` arma el HTML único. Cada perfil es configuración, no código copiado.

| Perfil | Uso | Datos | Nube |
|---|---|---|---|
| `solo` | **raveV2 · «Mi Negocio»**: sistema **genérico, sin rubro** (sirve para cualquier negocio de un dueño) | Ejemplo rotulado: Productos · Servicios · Accesorios · Insumos · Paquetes | Sin configurar |
| `v3` | **raveV3 · «Corporación Demo»**: **gestión integral empresarial** (casa central + sucursal, tesorería, áreas corporativas, Centro Inteligente con asistentes) | Ejemplo rotulado: Equipamiento · Software y licencias · Servicios profesionales · Insumos corporativos · Logística · Mantenimiento | Sin configurar |
| `kini` | **KiniDistribuidoraDemo**: distribuidora **sólo mayorista** (presentaciones, tramos, crédito) | Ejemplo rotulado (bebidas y almacén mayorista) | Sin configurar |
| `cliente` | Sistema real de un comercio | Reales | URL + clave publicable |

**Venta restringida por edad (`S.cfg.restricted`).** Encendida por defecto (comercios con alcohol o tabaco: control de edad en el menú, horario de alcohol, exclusión de tabaco en promociones, leyendas del ticket y textos legales). **raveV2 y raveV3 la apagan**: no aparece ninguna leyenda de bebidas, tabaco ni «+18» en el menú, el panel, el ticket ni los legales (prueba `gen1.py`). raveV3 además no usa rubros de comercio chico: su vocabulario y datos son de empresa.

**Reglas de las demos:** son **genéricas** («Sistema Vincular Business», sin nombre, dirección, redes ni catálogo de ningún cliente); muestran los módulos **completos** con datos «ejemplo»; las integraciones sin cuenta real se rotulan «demostración» y nunca simulan un cobro, un CAE o un envío reales. **Regla del cliente:** todo módulo nuevo nace **apagado** hasta que el administrador lo activa; la variante cliente nunca dice «demo» ni «simulado».

---

## 4. ARQUITECTURA

- **Núcleo (Core):** identidad y roles, comercio (tenant), permisos, auditoría encadenada por hash, cifrado, sincronización, configuración, idiomas, idempotencia. **No conoce rubros ni marcas de hardware.**
- **Módulos:** se registran con `reg(id, título, ícono, permiso, render, after)` y se activan por banderas en `S.cfg`. Dependencia: Adaptador → Módulo → Núcleo.
- **Adaptadores:** por rubro, por proveedor (pagos, voz, mensajería, transportistas) y por hardware (HAL `DeviceManager`).
- **Asistente conversacional transversal:** `ActionRegistry` (lista blanca de acciones con esquema, permiso, riesgo y confirmación); la IA nunca toca la base ni los secretos.
- **Persistencia:** estado `S` en memoria → IndexedDB cifrada; nube por colecciones (`registros`) con lista cerrada en `sincronizar()`; libros que se escriben **una sola vez** (movimientos de stock y caja, auditoría, monedero, mensajes…); saldos **derivados** (nunca un segundo saldo que pueda desfasarse).
- **Dinero:** centavos enteros (o `numeric(14,2)` en SQL). Nunca `float`. Fechas en UTC, mostradas en la zona del comercio.

Estructura del repositorio: `fuente/` (partes `p*.js`, `p1-head.html`, `build.py`, `pub/` menú público, `pruebas/`), `supabase/` (SQL numerado 01…N + `INSTALAR-TODO.sql`, funciones, pruebas SQL), `index.html` ensamblado.

---

## 5. REGLAS DE TRABAJO (obligatorias)

1. No inventar endpoints, leyes, tasas, alícuotas ni compatibilidades: `[VERIFICAR]` + fuente oficial.
2. Seguro por defecto: ningún secreto en el código, el HTML, los logs ni el chat. En el archivo público sólo URL y clave publicable. Si aparece un secreto expuesto, se avisa y se recomienda rotarlo.
3. **Nada nuevo rompe lo existente.** Detectar antes de agregar: si existe y funciona, no se toca; si está incompleto, se completa; si está duplicado, se fusiona.
4. Antes de pisar algo publicado, verificar qué depende de ese archivo (instalador, tareas, otros repositorios). Nunca publicar una demo encima de un cliente.
5. Cambios en la base de producción **sólo con autorización expresa** del dueño; el SQL se entrega para que lo pegue el dueño, se verifica después por consulta.
6. Una sola pasada de correcciones, **regresión completa** antes de publicar, revisión independiente para lo de alto riesgo (dinero, permisos, datos personales).
7. Entrega honesta: qué quedó, qué tiene que hacer el dueño, qué no se pudo probar.
8. Créditos de Vincular Business **en todos los productos** (ingreso, barra lateral, ticket, menú público, tarjeta, instalador): nombre, **Celular (387) 4484132**, **página https://www.vincularbusiness.com.ar/**, correo y lema. Se puede cambiar la presentación, no eliminarlos.
9. Acciones con efecto externo (enviar mensajes, pagar, aceptar términos, publicar) sólo con el «sí» explícito del dueño para esa acción.
10. Olvido de clave: se le pide al **administrador del comercio**, no al soporte del desarrollador.

---

## 6. CATÁLOGO DE MÓDULOS (estado real al 2026-11-10)

Estado: **H** = hecho y probado · **P** = parcial · **E** = especificado, no construido · **D** = depende de terceros.

| Área | Módulo | Estado | Notas |
|---|---|---|---|
| Resumen | Tablero (ventas netas, ticket promedio, margen bruto estimado, medios, alertas) | H | «Margen bruto estimado», nunca «ganancia neta» |
| Operación | **Vender (POS)**: F1–F12, lector, balanza, pagos mixtos, vuelto, fiado/cuenta corriente, recargos por medio, buscar por precio, crear artículo sin salir | H | Venta sin stock opcional, auditada |
| Operación | Presupuestos (no mueven stock ni caja), devoluciones parciales, mermas valorizadas | H | |
| Operación | **Gestión de caja** (pestañas): Caja actual · Cajas y sucursales · Arqueo/cierre · Historial cerrado | H | Cierre sellado SHA-256 inmutable; rubro obligatorio en todo movimiento; cierre por rubro/persona; traspasos con permiso `transfer_funds`; cortes X/Z |
| Operación | Inventario por rubros, unidades und/kg/lt, borrado protegido (sólo admin), archivo | H | |
| Operación | Proveedores y compras: órdenes, recepción atómica, cuenta corriente de proveedores | H | |
| Operación | Mayorista: presentaciones, cobro por tramos, acuerdos, crédito con plazo, «sólo mayorista» | H | Pedidos de venta, remitos, lotes/FEFO, cierre ciego, contabilidad: E |
| Operación | Pedidos del menú y PedidosYa | P | PedidosYa real: D |
| Clientes | **Club** (pestañas): Clientes · Sellos · Niveles y cumpleaños · Monedero · Cupones y membresías | H | Tarjeta digital a pantalla completa (alternativa a Wallet), sellos por QR/código/DNI/NFC, gift cards, cashback, ruleta/trivia |
| Clientes | Datos para facturar (condición frente al IVA) con precarga en el cobro | H | |
| Clientes | **Atención al cliente** (CRM omnicanal + ERP, sección 7-bis) | H | Bandeja con estados, colas, agentes, transferencia con resumen, bot de preguntas frecuentes, ruteo, copiloto por reglas, turnos, cobros con link fijo, CSAT/NPS, analíticas, alertas ERP y campañas asistidas. API de Meta, bot de Telegram para clientes, correo, links dinámicos con webhook, plantillas HSM e IA: D |
| Equipo | Personal y fichaje, tareas y organigrama | H | Huellas: E (revisión legal) |
| Menú y web | Menú público (local o tienda con envíos), legales, SEO | H | Cobro online y transportistas por API: D |
| Inteligencia | Centro Inteligente (mapa del local, asistentes R2AVE, bot de Telegram para administradores) | H | Apagado en cliente hasta activarlo |
| Sistema | Nube y sincronización, periféricos y ticket, importar/exportar (CSV/XLSX real), integraciones, usuarios y permisos, auditoría, configuración | H | |
| Fiscal | Facturación electrónica ARCA (CAE, QR, notas de crédito) | H | Producción con certificado real: D |
| Pagos | Checkout online / Mercado Pago / Wallet Apple-Google / avisos automáticos por API | E/D | Hoy: cobro asistido y tarjeta digital |

---

## 7. SISTEMA DE EXPERIENCIA DE USO (UX) — obligatorio en todos los perfiles

**7.0 Diseño aprobado (referencia visual del dueño).** Barra lateral oscura con el **botón dorado «Vender POS [F1]»** arriba y secciones plegables (Operación comercial · Logística e inventario · Clientes y Club · Equipo · Menú y web · Sistema); barra superior con **búsqueda global**, **campana de avisos** y **avatar** del usuario; Resumen que empieza con **«Hoy»**: Ventas hoy (con % contra ayer), Órdenes abiertas, Pedidos delivery, Stock alerta, Últimas ventas (POS) con estado, Tendencia de ventas de la semana (contra la semana anterior) y Proveedores pendientes. Atención al cliente sigue la referencia del CRM: lista de conversaciones con filtros y colas, conversación activa con barra Transferir · Notas internas · Etiquetar · Cerrar, columna derecha con ficha 360°, copiloto, gestión de turnos, gestión de cobros y reportes/fidelización, y abajo CRM Analytics y Alertas del ERP.

**7.1 Identidad.** Logo, iconografía y paleta del cliente se respetan **siempre**; si el comercio no tiene marca definida, se usa una paleta de ejemplo atractiva para la venta (contraste AA verificado) y se reemplaza cuando la entregue. El **color de acento** (`--gold` u otro definido en la ficha) es el elemento jerárquico dominante (botón Vender, pestaña activa, foco) y **no cambia con el tema**.

**7.2 Tema claro / oscuro / automático.** Un solo juego de estilos: el tema se aplica con un atributo en la raíz (`document.documentElement[data-theme]`) que cambia **sólo variables CSS** (`--ink`, `--bg`, `--card`, `--line`, `--mut`…). Prohibido duplicar hojas de estilo. Botón visible en la barra superior (Automático → Claro → Oscuro), preferencia guardada en `localStorage` (`rave.theme`). Cambio medido < 100 ms. Contraste mínimo 4,5:1 (3:1 letra grande) en ambos temas, verificado por prueba automática en todas las pantallas.

**7.3 Navegación por roles.**
- **Administrador / supervisor (modo gestión):** todos los módulos permitidos, agrupados por sección.
- **Mostrador / operador (modo mostrador):** entra directo a **Vender** y la barra muestra sólo Vender, Pedidos, Gestión de caja y —si tiene el permiso— Club, Atención al cliente y Tareas. Es simplificación visual: los permisos los valida el sistema (y el servidor en la nube). El administrador puede desactivarlo (`S.cfg.ux.fullNav`).

**7.4 Pestañas horizontales en lugar de listas largas.** Grupos que son **una sola entrada** en la barra y llevan pestañas arriba (`role=tablist`, flechas del teclado, ≥ 44 px): **Gestión de caja** y **Club**. Un grupo nuevo se declara en `UX_GROUPS` (`p2c-ux.js`); las rutas individuales siguen funcionando.

**7.5 Buscador universal (Ctrl + K / ⌘ + K / botón 🔍).** Clientes (nombre, N.º, DNI, WhatsApp), artículos (nombre, presentación, código de barras, PLU, códigos de presentaciones) y pantallas; tolera errores de tipeo (subsecuencias y una letra de diferencia); ↑ ↓ Enter Esc; sólo ofrece lo que el rol puede abrir; un artículo elegido se agrega a Vender. Objetivo: **cualquier acción crítica en menos de 3 acciones** desde la pantalla de inicio.

**7.6 Avisos en la barra lateral (badges).** Círculos con número y color semántico, con texto alternativo, actualizados solos cada 5 s: rojo que titila = pedido PedidosYa recibido o conversación sin responder; amarillo = stock bajo (rojo si hay negativos), caja abierta de un día anterior, presupuesto por vencer. Respetan «reducir movimiento».

**7.7 Atajos visibles.** **F1 → Vender** desde cualquier pantalla (con la tecla impresa en la barra); dentro de Vender rigen F1–F12 (F1 Efectivo … F12 Cobrar), cada botón con su tecla. **Ctrl + K** impreso en el botón Buscar.

**7.8 Ergonomía táctil.** Todo control ≥ 44 px (teclas del POS ≥ 48 px, teclado numérico ≥ 56 px), separación ≥ 8 px, nada depende sólo del mouse; campos numéricos sin «0» precargado; 320–1440 px sin desbordes.

**7.9 Diseño dinámico e intuitivo en todos los módulos (V26.63).**
- **Ayuda en contexto:** cada pantalla abre con **una línea** que dice para qué sirve y qué conviene hacer primero (`UX_DESC` en `p2c-ux.js`). Una pantalla nueva no se publica sin su línea.
- **Tablero del turno en Gestión de caja** (Caja actual · Arqueo/cierre · Historial): estado de la caja con indicador vivo (verde abierta, gris cerrada, rojo si es de un día anterior), **4 pasos del día** (Abrir caja → Vender y cobrar → Ingresos y egresos → Arqueo y cierre) con el paso actual marcado y cada paso como atajo, e indicadores complementarios (ticket promedio, última venta, ingresos y egresos del turno, duración del turno) sin repetir los totales que ya muestra la pantalla. El mismo patrón (estado + pasos + indicadores + acción principal) se aplica a todo flujo de varias etapas.
- **Estilo general:** tarjetas con relieve al pasar el mouse, tablas con encabezado fijo, filas alternadas y resaltado al pasar, transición suave entre pantallas, estados vacíos centrados; todo con las variables de la marca y respetando «reducir movimiento».
- **Contraste del acento:** si el color de marca no da 4,5:1 con letra blanca, la letra sobre el acento es negra (verde de raveV2, azul de raveV3) y en modo oscuro se usa una variante más clara para textos. Verificado por `kc1`, `tm1`, `ci6`.

---

## 7-bis. ATENCIÓN AL CLIENTE (CRM OMNICANAL + ERP INTEGRADO)

**Nombre en pantalla: «Atención al cliente»** (sección Clientes). Sirve a cualquier rubro: comercio, gastronomía, spa, canchas y centros deportivos, profesionales, e-commerce. Permiso `crm`; roles: **Agente** (mostrador: ve sus chats y los sin asignar), **Supervisor** y **Administrador** (todas las colas, panel de supervisión, transferencias); Ajustes sólo con `config`.

**Bloque 1 · Canales e inbox unificado.**
- Estado real: chat web del menú público (cifrado de punta a punta: identificador y clave nacen en el celular del cliente; el servidor no lee nada), WhatsApp asistido (`wa.me` con texto listo + registro manual de lo recibido), teléfono y local. Las demos muestran además Instagram, Messenger, Telegram y correo **rotulados de demostración**.
- Requiere cuentas del comercio [D]: WhatsApp Business API, Instagram Direct y Messenger por **Meta Graph API** (webhooks verificados, tokens en servidor), bot de Telegram para clientes, correo entrante. Tiempo real por **WebSockets/Realtime** cuando haya servidor; hoy se consulta cada 8 s.
- Bandeja con filtros por **canal, estado (Nuevo · En proceso · Pendiente · Cerrado), agente y cola**, búsqueda, prioridad y **colas de espera** por departamento.

**Bloque 2 · Acciones ERP en el chat.**
- Presupuesto: se envía el detalle y se abre el **PDF** para guardarlo/adjuntarlo (WhatsApp asistido no adjunta solo); nuevo presupuesto lleva a Vender con el cliente cargado.
- **Turnos**: reservar, confirmar, reprogramar y cancelar desde el chat, calendario de 7 días, choque de horario ±15 min, recordatorio 24–36 h.
- **Cobros**: datos de transferencia y **link de pago fijo** del comercio (sólo https de Mercado Pago o Stripe). El link **por importe** y la confirmación automática por **webhook** que actualiza el pedido y factura necesitan credenciales y servidor [D]; hasta entonces «Llegó el pago» se confirma a mano y **no mueve la caja**.
- **Ficha 360°** en el lateral: socio, nivel, sellos, saldo deudor, monedero, historial de compras y presupuestos, etiquetas y **notas internas** (el cliente nunca las ve).

**Bloque 3 · Copiloto y automatización.** Por reglas, sin costo (IA paga: [D], opcional): respuestas sugeridas con datos del ERP (precio y stock del producto mencionado, deuda, datos de pago), **resumen automático al transferir** entre departamentos, **ánimo** del cliente (Positivo · Neutro · Urgente/enojado) que sube la prioridad, **bot de primer nivel** con preguntas frecuentes editables (responde una sola vez por tema, sólo en canales que admiten respuesta automática), **calificación de leads** y **ruteo** manual, por departamento según el tema o por turnos entre agentes (**round robin**).

**Bloque 4 · Analíticas, alertas y crecimiento.**
- Analíticas (sin datos personales, con fórmula visible): **FRT** (primera respuesta humana − primer mensaje), **AHT** (cierre − primer mensaje), **CSAT** (4–5 de 5 ÷ respuestas), **NPS** (% 9–10 − % 0–6), **conversión a venta** (venta del cliente en los 3 días siguientes) y ventas atribuidas, por canal, por día y por agente (panel de supervisión).
- **Alertas del ERP**: stock crítico, deudas y pagos vencidos, presupuestos por vencer, cobros sin confirmar > 48 h, turnos sin confirmar.
- **Campañas** segmentadas (con consentimiento comercial; el aviso de saldo es operativo), hasta 300 destinatarios, envío **asistido uno por uno**; plantillas **HSM** aprobadas por Meta para envío masivo automático: [D].
- **Encuesta postventa** CSAT automática al cerrar un chat web; NPS a pedido.

**Modelo de datos.** Equipo: colecciones `conv` (conversación: canal, cliente, estado, cola, agente, etiquetas, turnos, cobro, CSAT, NPS, marcas de tiempo; clave del chat cifrada) y `cmsg` (mensajes, notas y eventos; se escriben una vez; texto cifrado). Servidor (`22-crm.sql`): `crm_entrantes` (mensajes del cliente cifrados con la llave pública del comercio) y `crm_salientes` (respuestas cifradas con la clave del chat), RPC anónimas con límites por IP, chat y comercio, y RPC del equipo con rol. Equivalencia con el esquema relacional pedido: **Conversaciones** = `conv`; **Mensajes** = `cmsg` + `crm_entrantes`/`crm_salientes`; **Canales** = configuración `S.cfg.crm.chans` (+ tabla `crm_canales` con credenciales en servidor cuando se conecte Meta/Telegram) [E]; **Webhooks** = tabla de eventos con firma verificada e idempotencia [E, con proveedores]; **Alertas** = calculadas del ERP en vivo (no se duplican); **Métricas** = calculadas de `conv` (snapshot diario opcional [E]).

**Componentes (frontend).** `p6j-crm.js`: bandeja (lista, filtros, colas), conversación (barra de acciones, mensajes, redacción con respuestas rápidas y nota interna), lateral (ficha 360°, copiloto, turnos, cobros, reportes), pestañas Analíticas · Campañas · Alertas ERP, ajustes. Menú público: botón «Escribinos» con encuestas CSAT (1–5) y NPS (0–10). Pruebas: `crm1.py`, `crm2.py`; SQL `30-sql-tests.sql`.

---

## 8. SEGURIDAD Y DATOS

OWASP/ASVS: escapar todo dato al mostrarlo (incluido lo que llega de IA, OCR, QR, chat); URLs por lista de esquemas y dominios; CSP estricta con SRI; RLS en todas las tablas con prueba cruzada A/B; funciones `SECURITY DEFINER` con `search_path` fijo; idempotencia en pagos, cierres, traspasos e importaciones; datos personales cifrados antes de subir (`__pii`), mínimos y con consentimiento por finalidad; nunca número de tarjeta, CVV ni PIN (detector que los rechaza); exportaciones CSV con fórmulas neutralizadas; auditoría sin textos de mensajes ni secretos. «Inalterable» se escribe siempre con su límite (sólo-agregar en servidor + hash que detecta).

---

## 9. NUBE (referencia Supabase)

Scripts numerados, aditivos e idempotentes (`01`…`22` al 2026-11-10; `INSTALAR-TODO.sql` los reúne). Una colección nueva exige: lista de `sincronizar()`, permiso en `rave_puede_escribir`, lectura, exportación, importación, respaldo y prueba SQL. El navegador **no envía saldos ni stock**: envía movimientos. Sin conexión se trabaja igual y nunca se muestra como confirmado lo que el servidor no confirmó. «Confirm email» desactivado. Recuperación con código de 20 caracteres (sin clave ni código, los datos cifrados no se recuperan, por diseño).

---

## 10. DETECCIÓN, PRUEBAS Y ENTREGA

- **Detectar:** inventario de pantallas, funciones, tablas y pruebas antes de cada cambio; nombres únicos (un HTML único comparte ámbito); un módulo nuevo se agrega a `build.py`; los estados guardados de versiones anteriores cargan con valores por defecto.
- **Probar:** navegador real (Playwright) con datos reales, en `file://`, a 320/360/768/1024/1440 px, en claro y oscuro; SQL sobre Postgres real (dos pasadas para idempotencia); regresión completa (`demo_all.sh` + `supabase/tests/run.sh`) en **todos los perfiles** antes de publicar. Un requisito de tamaño se mide con números (`getBoundingClientRect`), no a ojo.
- **Publicar:** cliente y cada demo en su repositorio propio; commit con atribución; SQL entregado al dueño; documento actualizado (anexo con lo construido, pruebas y límites).

---

## 11. CRITERIOS DE ACEPTACIÓN COMERCIAL

1. Cualquier acción crítica (vender, cobrar, abrir/cerrar caja, buscar cliente o artículo, responder un mensaje, reservar un turno) en **≤ 3 acciones** desde el inicio; la pantalla respeta el diseño aprobado (7.0) y la marca del cliente.
2. Cambio de tema **< 100 ms** con el acento de marca fijo y contraste AA en ambos temas.
3. Navegación sin recargas ni saltos de diseño; pestañas y barra estables.
4. Modo mostrador: ≤ 7 entradas en la barra.
5. Cero errores de consola; regresión verde en todos los perfiles.

---

## 12. CAPA DE PARTICULARIDADES DEL CLIENTE

Todo lo que no es general se declara aparte, como **módulo opcional apagado por defecto**, con: qué se quiere, quién lo usa, qué datos entran y salen, y si toca el cierre sellado. Ejemplos ya resueltos así: rubros por persona con reparto e impuesto diario, cierre de caja por rubro, Club con nombre propio, bot de Telegram del dueño, menú con ficha de Google del local. **Nunca** se copia una particularidad al esqueleto ni a las demos.

---

## 13. PROMPT DE ARRANQUE (sesión nueva)

> Leé `PROMPT_ESQUELETO_VB.md` y `SISTEMA_VB_26F.md` (anexos incluidos). Inspeccioná el repositorio del cliente y los de las demos (raveV2 = `solo`, raveV3 = `v3`, KiniDistribuidoraDemo = `kini`), compilá los cuatro perfiles y corré la regresión como línea base. Después hacé lo que te pida respetando las reglas de la sección 5: listá los supuestos, preguntá una sola vez lo que falte, construí detrás de banderas (apagado en el cliente, completo y con ejemplos en las demos), escribí las pruebas con el código, corré la regresión completa, publicá los cuatro sitios y entregame el SQL nuevo (si hay) y un informe honesto.
