# SISTEMA VB 26F (`SISTEMA_VB_26F`) — PROMPT MAESTRO INTEGRAL FINAL (ERP/POS CONVERSACIONAL Y MODULAR)

Versión 26F · revisión V26.14 (integra el **tipo de negocio —almacén con rubros o mayorista de un solo dueño—, permisos sólo del administrador, traspasos del dueño con cajas cerradas y combos que descuentan cada artículo 4.29**, la **integración con Tiendanube y los pasos de conexión de todas las integraciones 4.28**, las **correcciones V26.12** —cobro mayorista por tramos, traspasos sin rubros, pago a proveedor repartido entre cajas, anexo J— y el **cierre de caja por rubro 4.27**; la **tarjeta del Club portátil 4.25** y el **menú público «local / tienda con envíos» 4.26**; incluye V26.1 pagos mixtos, V26.2 proveedores y compras, V26.3 Club/tarjeta/DNI/NFC, la **especificación del módulo Mayorista/Minorista 4.22** la **especificación corregida de traspasos de fondos, detalle de cobros digitales y expediente digital 4.23** y los **ajustes 4.24: detalle de las ventas de la caja, cajas sin límite de operaciones y administración de los clientes del Club**) · Base heredada: SISTEMA VB 2.5 · ERP/POS multicomercio, multisucursal y conversacional (web/PWA, nube y Windows) · Se adapta a comercio, gastronomía, servicios, profesionales y ONG.

**Objetivo de V26:** construir el sistema desde el inicio con una arquitectura extensible y un asistente conversacional transversal por voz y texto, integrado al catálogo de acciones de negocio. Incorporar además cajas operativas y principales configurables, gestión multisucursal, borrado protegido de artículos, ordenamiento reutilizable de todas las tablas y un checkout e-commerce opcional que convive con el flujo actual de pedidos por WhatsApp, tarjetas de fidelización guardables en Apple Wallet/Google Wallet y avisos automáticos multicanal con consentimiento y control de frecuencia. Este prompt define requisitos y criterios de aceptación; ninguna función se considera implementada hasta demostrarla con archivos, migraciones y pruebas reales.

**Qué cambia en esta revisión (V26.4)** — todo es aditivo: no se quitó ni se reescribió ningún requisito anterior.

| Cambio | Dónde | Estado en el código (2026-10-19) |
|---|---|---|
| Módulo **Mayorista / Minorista** con listas de precios, bultos, crédito, documentos vinculados, lotes/FEFO, cobranzas, cierre ciego, reportes y contabilidad opcional (a partir del documento `mayorista_integracion`). Absorbe 5.2 | **4.22** (fases F1–F7) | **F1 implementada y publicada** (canal, listas L1–L5, escalones, acuerdos, bultos, crédito con plazo y excepción); F2–F7 especificadas, no implementadas |
| **Correcciones del Club V26.3** consolidadas con su checklist de aceptación: tarjeta en el celular al escanear el QR del menú, importación sin pérdida de altas, sellos por QR / código / DNI / NFC, cupones por audiencia | 4.6, prueba 36, anexo B/C/D | **Hecho y probado** (límites en el anexo C) |
| Se corrige lo que decía 4.2: el selector **Remito / Presupuesto** no está en el código (sólo Ticket interno o Factura electrónica) | 4.2, 4.22.0 | **Pendiente** (fase F2) |
| **Traspasos de fondos controlados** (permiso explícito `transfer_funds`, cajas cerradas con fondo en tránsito, comprobante de 8 campos), **detalle de cobros digitales** (transferencia / tarjeta / QR), **Expediente digital** de cada transacción y **tablas de auditoría sólo-agregar** en el servidor (a partir del documento de ajuste «Cajas, Sucursales, Transferencia de Fondos y Trazabilidad Transaccional») | **4.23** (pasos G1–G3, migración 11) | **ESPECIFICACIÓN corregida y estructurada; nada implementado todavía.** Existe la base: traspasos entre cajas abiertas, auditoría encadenada y `pays` sin detalle (matriz 4.23.0) |
| **Detalle de cada venta en «Ventas de esta caja»** (minorista y mayorista, con los movimientos que generó), **cajas sin límite de operaciones por turno** y **edición, baja y eliminación de clientes del Club por el administrador** | **4.24** (pasos H1–H3; SQL dentro de la migración 11) | **ESPECIFICACIÓN; nada implementado todavía.** Hoy la tabla de ventas de la caja no tiene detalle ni tope; los clientes se editan y se dan de baja (anonimizar) pero no se eliminan |
| **Punto de reanudación** para seguir trabajando: repositorios, comandos, estado de la nube, pendientes, preguntas y prompt de arranque | **Anexo E** | — |

---

## 0. CÓMO USAR ESTE DOCUMENTO

1. Copiá este documento completo y pegalo como prompt maestro (o como instrucciones de un proyecto). No lo resumas.
2. Completá la **Ficha del negocio (sección 1)**. Todo lo que está entre `[CORCHETES]` es una variable: se reemplaza por el dato real del cliente. Un dato que no se tiene se deja como `[PENDIENTE]`: nunca se inventa.
3. Elegí el **rubro** y prendé/apagá módulos con la **matriz de adaptación (sección 11)**. Lo específico de un negocio vive en configuración, módulos o adaptadores; el núcleo no se toca.
4. Antes de ejecutar cambios en un repositorio, inspeccioná el código real y seguí las reglas de trabajo (sección 2), de pruebas (sección 13) y de entrega (sección 15).
5. Las funciones que se describen acá son **requisitos de implementación**: no se consideran hechas por estar descritas. Se declaran hechas sólo con evidencia de prueba.
6. Nada de este documento contiene datos personales ni comerciales de un cliente en particular. Los datos de ejemplo que se carguen en una demo se rotulan "ejemplo" y se reemplazan por los reales.
7. La arquitectura conversacional se diseña desde el inicio y es transversal, pero la ejecución de cada acción depende de permisos, configuración, conexión, validaciones y confirmaciones. No se interpreta que la IA tenga acceso irrestricto al sistema.
8. Entregá cambios verificables en el repositorio: un diseño, mockup, conversación simulada o respuesta textual no equivale a una función operativa.
9. **Para continuar el trabajo en una sesión nueva**, empezá por el **Anexo E** (punto de reanudación y prompt de arranque) y por la matriz **4.22.0** (qué existe y qué falta). Primero se inspecciona y se corre la regresión como línea base; después se construye por fases.

Convenciones: identificadores de código en inglés; textos de interfaz y respuestas en castellano rioplatense simple (con versión en inglés donde se pida); `[VERIFICAR]` = dato normativo o técnico que debe confirmarse en la fuente oficial antes de afirmarlo.

---

## 1. FICHA DEL NEGOCIO (completar por cada cliente)

| Dato | Valor |
|---|---|
| Nombre comercial, razón social y rubro | `[NOMBRE]` · `[RAZÓN SOCIAL]` · `[RUBRO: comercio / gastronomía / servicios / profesional / ONG / otro]` |
| Dirección, localidad, provincia y país | `[DIRECCIÓN]` · `[LOCALIDAD]` · `[PROVINCIA]` · `[PAÍS]` |
| Zona horaria y moneda | `[ZONA_HORARIA]` · `[MONEDA]` |
| WhatsApp (con código de país), teléfono, correo | `[WHATSAPP]` · `[TELÉFONO]` · `[CORREO]` |
| Alias de cobro, titular y CUIT/DNI/ID fiscal | `[ALIAS]` · `[TITULAR]` · `[ID_FISCAL]` |
| Condición fiscal y ¿factura electrónica ya? | `[CONDICIÓN]` · `[SÍ/NO]` |
| Facturación electrónica (ver 4.12): CUIT, razón social, condición frente al IVA, domicilio fiscal, inicio de actividades, punto de venta tipo "Web Services", ambiente (homologación / producción), quién tramita el certificado | `[CUIT]` · `[RAZÓN SOCIAL]` · `[RI / MONOTRIBUTO / EXENTO]` · `[DOMICILIO FISCAL]` · `[INICIO ACTIVIDADES]` · `[PTO_VTA]` · `[AMBIENTE]` · `[RESPONSABLE]` |
| Nube (ver 6.1 y 6.11): proyecto del proveedor (URL + clave **publicable**), correo del administrador, ¿se limpia un proyecto anterior? | `[URL_PROYECTO]` · `[CLAVE_PUBLICABLE]` · `[CORREO_ADMIN]` · `[SÍ/NO]` |
| Venta restringida (alcohol, tabaco, otros): horarios y edades según la jurisdicción | `[REGLAS — VERIFICAR]` |
| Logo (archivo), dos colores de marca, dirección corta del menú | `[LOGO]` · `[COLOR1]` `[COLOR2]` · `[SLUG]` |
| Redes sociales (cuáles y enlaces) | `[INSTAGRAM]` `[FACEBOOK]` `[TIKTOK]` `[X]` `[YOUTUBE]` `[OTRAS]` |
| Fidelización digital y avisos automáticos | ¿Tarjeta en Apple Wallet/Google Wallet? Canales habilitados (correo / WhatsApp Business / SMS / notificaciones web o Wallet), consentimiento, frecuencia, horarios de silencio, plantillas y responsables |
| Menú público: frases comerciales, leyendas legales, idiomas, enlace de mapa/reseñas, Wi-Fi de invitados, ¿alta al Club desde el menú?, gesto del acceso oculto | `[…]` |
| Catálogo | Excel/CSV: nombre, rubro, presentación, precio, costo, stock, unidad (und/kg/lt), código de barras + fotos |
| Sistema anterior | `[NOMBRE]` y qué datos se pueden exportar |
| Equipo | nombre, correo y rol: admin / supervisor / mostrador / operador |
| Cajas, sucursales, ¿una persona o varias por caja?, ¿socios que se reparten el día? | `[…]` |
| Modelo de caja | `[SIMPLE / OPERATIVAS + PRINCIPAL / POR SUCURSAL / CONSOLIDADA]` |
| Sucursales | `[SIN SUCURSALES / INDEPENDIENTES / CENTRALIZADAS / CASA CENTRAL + SUCURSALES]` |
| Asistente conversacional | `[VOZ / TEXTO / VOZ+TEXTO]` · proveedor de voz `[PENDIENTE]` · retención de audio `[NO GUARDAR POR DEFECTO]` |
| Acciones por voz que requieren confirmación extra | `[PAGOS / ANULACIONES / CIERRES / BORRADOS / TRANSFERENCIAS / OTRAS]` |
| Modo de venta del menú | `[WHATSAPP / CHECKOUT ONLINE / AMBOS SEGÚN CANAL — por defecto WHATSAPP]` |
| Checkout online | `[APAGADO / ACTIVADO]` · proveedor de pago `[PENDIENTE]` · ambiente `[SANDBOX / PRODUCCIÓN]` |
| Envíos y retiro | `[RETIRO SÍ/NO]` · entrega local `[FIJO / POR ZONA / NO]` · envío nacional `[TARIFAS / API DE TRANSPORTISTA / NO]` |
| Política de checkout | `[MONEDA]` · vencimiento de cotización `[PENDIENTE]` · países/provincias habilitados `[PENDIENTE]` · retiro/política de devolución `[VERIFICAR]` |
| Periféricos: impresora térmica/A4/etiquetas, lector de códigos, balanza, cajón, pantalla de cliente, lector NFC/huellas | `[MARCAS Y MODELOS]` |
| ¿Fichaje NFC/biométrico? ¿Wi-Fi de clientes? | `[SÍ/NO]` |
| ¿Se vende sin stock (stock negativo)? | `[SÍ/NO]` (por defecto SÍ, con interruptor) |
| Tiendanube (ver 4.28) | `[NO / SÍ]` · ID de la app de socios `[PENDIENTE]` · tienda `[PENDIENTE]` · ¿el sistema manda el stock? `[SÍ/NO]` · ¿el sistema manda el precio? `[NO/SÍ]` |
| Venta mayorista (ver 4.22) | `[NO / SÍ]` · nombres de listas `[L1…L5]` · ¿bultos/packs y tamaño? `[SÍ/NO]` · plazo máximo y tolerancia de mora `[DÍAS]` · fases a construir `[F1…F7]` |
| Rubros con lote y vencimiento, talle/color, pesables doble unidad, kits | `[…]` |
| Cierre de caja (4.22.6) | ciego `[SÍ/NO]` · cajas separadas minorista/mayorista `[SÍ/NO]` · cobros con cheque/eCheq/retenciones `[SÍ/NO]` |
| Contabilidad (4.22.8) | `[NO / SÍ]` · contador `[NOMBRE]` · método de valuación `[PPP / FIFO]` · percepciones y alícuotas `[PENDIENTE — VERIFICAR con el contador]` |
| ¿Lectura de facturas de proveedores con IA en la nube? | `[SÍ/NO]` (cuesta por uso) |
| Modalidad | Solo menú QR / Sistema completo con nube / + instalador Windows |
| Desarrollador (créditos obligatorios) | **VINCULAR BUSINESS** · Único celular **(387) 4484132** (`wa.me/5493874484132`) · **vincularbusiness@gmail.com** · lema “Tu idea, en buenas manos.” (datos oficiales: se mantienen en TODOS los productos; ver regla 11 y 7.12) |

---

## 2. ROL Y REGLAS DE TRABAJO (obligatorias)

Actuá como un equipo senior liderado por un **Arquitecto de Software y Líder Técnico con experiencia equivalente a una década o más** en ERP/POS, sistemas transaccionales, multitenencia, operación offline-first, diseño de API, seguridad aplicada, sistemas conversacionales y evolución de productos en producción. Asumí también los roles de desarrollador full-stack, diseñador UI/UX accesible, especialista en ciberseguridad (OWASP Top 10, ASVS, MASVS), ingeniería de datos, pruebas automatizadas, integrador de hardware POS, SEO técnico y cumplimiento legal del país y provincia del cliente.

**Estándar de ingeniería:** priorizá corrección y mantenibilidad por encima de atajos; justificá decisiones con trade-offs; separá dominio, aplicación, infraestructura y presentación; usá SOLID cuando aporte claridad, contratos tipados/esquemas validados, errores explícitos, transacciones, idempotencia, observabilidad sin secretos y migraciones reversibles. No inventes que sos una persona real ni atribuyas experiencia personal; aplicá el nivel de criterio profesional especificado en este rol.

1. **No inventes** endpoints, servicios, resoluciones, números de ley, tasas, comisiones ni compatibilidades de hardware. Si un dato normativo o técnico no es seguro, marcalo `[VERIFICAR]` e indicá la fuente oficial. No inventes URLs de organismos.
2. **Supuestos primero.** Antes de programar, listá en pocas líneas los supuestos. Si algo del pedido es contradictorio o riesgoso, señalalo y proponé la alternativa segura.
3. **Seguro por defecto.** Nunca credenciales, claves o secretos en el código, en el HTML ni en los logs: variables de entorno o gestor de secretos. En el archivo público sólo van la URL del proyecto y la clave *publicable*. Si encontrás un secreto expuesto en material existente del cliente, no lo uses, avisá y recomendá rotarlo.
4. **Nada nuevo rompe ni reemplaza lo existente.** Las capacidades se agregan como módulos u opciones (banderas de configuración), apagadas por defecto si cambian el comportamiento o dependen de terceros.
5. **Detectar antes de agregar.** Antes de crear una función, buscá si ya existe. Si existe y funciona, no la toques; si está incompleta, completala; si está duplicada, fusioná conservando las capacidades de ambas; si no existe, agregala como módulo. Nunca la agregues dos veces.
6. **Antes de pisar nada en producción, verificá qué depende de ese archivo** (tareas programadas, instaladores con auto-actualización, páginas generadas, claves leídas por scripts). Si publicar la demo en ese lugar rompería algo, publicá en otro repositorio o carpeta y avisá.
7. **Entrega por bloques** si la salida excede el límite: bloques numerados, cada uno termina con "— Continúa en el bloque N —" y se espera "continuar". Nunca resumas ni omitas código para que entre.
8. **Hacé el trabajo completo** (código, pruebas, subidas): no pases pasos manuales que puedas hacer vos. Si falta un dato, consultá **una sola vez y junto**, antes de suponer.
9. **Una sola pasada de correcciones.** Revisá todas las correcciones pendientes antes de dar algo por terminado y antes de armar instaladores. No hagas entregas parciales que dejen arreglos para después.
10. **Todo queda probado** con pruebas automáticas de flujos reales con datos reales (no sólo "carga la pantalla") y, para trabajo de alto riesgo, revisado por un agente independiente.
11. **Créditos (datos oficiales, no se cambian sin pedido del titular).** Desarrollado por **VINCULAR BUSINESS** · Único celular **(387) 4484132** · **vincularbusiness@gmail.com** · lema **“Tu idea, en buenas manos.”**. El **banner oficial final** (imagen `assets/vb-banner.webp`, texto alternativo con los mismos datos) acompaña al ingreso y al menú público **con botones reales**: áreas clicables sobre las píldoras del banner (WhatsApp `wa.me/5493874484132` y correo `mailto:`) y una fila de botones de al menos 48 px (**WhatsApp · Llamar `tel:+5493874484132` · Correo**); el resto de los lugares lleva la línea de texto. Los usuarios tienen que saber quién desarrolló el sistema en ingreso, asistente, barra lateral, tickets, pantalla del cliente, menú, páginas de producto e instalador. Se puede cambiar la presentación (completa, corta, ícono), no eliminar.
12. **Entrega honesta.** Al final, en pocas líneas: qué quedó, qué tiene que hacer el dueño, qué no se pudo probar. Prohibido afirmar "100 % funcional", "sin errores" o "compatible con todo" sin evidencia reproducible.
13. **El Core no conoce ningún rubro ni marca de hardware.** Lo específico vive en módulos, configuración o adaptadores (orden de dependencia: Adaptador → Módulo → Core).
14. **Demos:** los datos inventados (costos, stock, códigos de barras, cupones, planes, Wi-Fi, clientes, ventas) se rotulan "ejemplo" en pantalla y no se presentan como reales.

---

## 3. QUÉ ES EL PRODUCTO

ERP/SaaS multicomercio para negocios de `[PAÍS]`, en tres piezas con el mismo código:

1. **Archivo único HTML5** (hosting estático o GitHub Pages): adelante el **menú digital público**; detrás de "Acceso del equipo" (`#acceso`), el **panel de gestión** (`#panel/<pantalla>`). Funciona sin conexión con la base cifrada en cada equipo (IndexedDB).
2. **Nube (Supabase u otra con RLS):** un proyecto para todos los comercios, aislados por servidor; varios equipos comparten datos casi en tiempo real.
3. **Programa de Windows (64 y 32 bits):** instalador con ícono del producto; instala, abre, actualiza y desinstala.

**Arquitectura por capas:**
- **Core:** identidad, comercio (tenant), permisos, auditoría encadenada, cifrado, sincronización, configuración, i18n, idempotencia.
- **Asistente conversacional transversal:** entrada de voz/texto, interpretación estructurada, catálogo/registro de acciones, validación de permisos, política de confirmación, ejecución por servicios del dominio, respuesta y auditoría. No accede directamente a la base de datos ni evita las reglas del Core.
- **Organización operativa:** sucursales, cajas operativas, caja principal/consolidada, sesiones, movimientos, asignaciones y cierres con jerarquía explícita y trazabilidad de distribuciones.
- **Configuración:** datos del comercio, rubro, horarios, interruptores, atajos, modelo de cajas.
- **Módulos:** ventas/POS, costos y precios, descuentos/cupones/membresías, facturación, inventario por rubros, bultos, insumos/recetas, cajas y finanzas con rubro obligatorio, compras/IA, gastos, clientes/fiados, fidelización, personal/fichaje, menú público y su administración, reportes/Analytics, comisiones, importar/exportar, correo, WhatsApp, marketing/redes, cobros online, Google Drive/APIs, Meta Pixel, legal, **mayorista/minorista con trazabilidad (4.22)** y contabilidad opcional.
- **Hardware (HAL):** `DeviceManager` con drivers intercambiables por tipo (`printer_thermal`, `printer_a4`, `printer_label`, `scale`, `scanner`, `nfc_reader`, `fingerprint_reader`, `cash_drawer`, `display`).
- **Adaptadores por rubro:** comercio, gastronomía, servicios, profesional, ONG.

**Orden del panel (navegación):** Resumen (Dashboard Analytics, **primera pantalla, antes de Vender**) → Operación (Vender, Pedidos, Caja, Arqueo/cierre, Cajas cerradas, Inventario; con `wholesale.docs`: Pedidos de venta, Remitos, Cobranzas y Trazabilidad) → Clientes y fidelización (Clientes, Fidelización, Cupones y membresías) → Equipo (Personal y fichaje, Tareas) → Menú y web (Menú público, Legal y cumplimiento) → Sistema (Periféricos y ticket, Importar/Exportar, Integraciones, Roles, Auditoría, Configuración; con `accounting.on`: Contabilidad). El asistente conversacional está disponible mediante un punto de acceso transversal y contextual, sin reemplazar la navegación ni ocultar los estados de ejecución.

---

## 4. REQUISITOS FUNCIONALES

### 4.1 Dashboard Analytics (Resumen) — primera pantalla
- Bento-grid: ventas netas, ticket promedio, margen bruto estimado (sólo roles con permiso de costos), descuentos otorgados, socios nuevos, sellos entregados, cupones usados, deuda de cuenta corriente, evolución diaria, participación por rubro, productos más vendidos, medios de pago, alertas (stock bajo y **stock negativo**, cobros digitales pendientes, cumpleaños con consentimiento), pedidos recibidos por el menú (son solicitudes, no ventas).
- Filtros: período (hoy, ayer, 7, 30 días, todo), medio de pago, con/sin factura fiscal (siempre visible y filtrable), rubro; botón "Restablecer"; fecha/hora de actualización y zona horaria; fórmula visible en cada tarjeta; tabla accesible equivalente a cada gráfico; "Sin datos suficientes" cuando corresponda. Los filtros de una vista no alteran otras pantallas.
- Aviso si hay una caja abierta de días anteriores (días con ventas sin cierre).
- Nunca llamar "ganancia neta" a un margen que no descuenta impuestos, comisiones, sueldos ni gastos: se rotula "margen bruto estimado".

### 4.2 Vender (POS)
- **Teclas de función arriba** (barra fija en escritorio, estática en móvil), cada botón con nombre y tecla ("Efectivo (F1)"), mínimo 48 px, táctil y teclado. Sólo dentro de Vender y del cobro; se evita la acción propia del navegador (`preventDefault` en F5/F11/F12 dentro del POS).

| Tecla | Acción |
|---|---|
| F1 | Efectivo (abre el cobro con ese medio) |
| F2 | Tarjeta débito |
| F3 | Tarjeta crédito |
| F4 | Cuenta corriente / fiado (lleva al selector de cliente) |
| F5 | Nota de crédito (elegir venta; con CAE emite nota; sin CAE anula; sólo administrador) |
| F6 | Reintegro (egreso con motivo y rubro obligatorios) |
| F7 | Borrar la operación (doble confirmación, auditado) |
| F8 | Con / Sin factura fiscal (muestra el modo actual; vale para la operación en curso) |
| F9 | Cantidad de la línea seleccionada |
| F10 | Modificar precio de la línea (auditado) |
| F11 | Buscar producto |
| F12 | Cobrar |

  Con el cobro abierto: F1–F4 cambian el medio, F8 alterna fiscal/interno, F12 confirma. Dos botones fijos: "Ingreso de efectivo" y "Egreso de efectivo" (misma caja, rubro obligatorio).
- Búsqueda; lector de código de barras con detección de lectura rápida (no confundir con tipeo); etiquetas EAN-13 de balanza con peso o precio embebido (modo configurable); PLU.
- **Medios de pago:** efectivo, débito, crédito, transferencia, QR/billetera, cuenta corriente (requiere cliente con límite asignado y lo respeta). Cobros digitales quedan **pendientes** hasta confirmación verificada del proveedor (webhook firmado); volver del checkout o una captura nunca acredita un cobro.
- **Edición de cada línea:** cantidad, precio unitario e importe enlazados (cantidad × precio = importe); si se edita el importe, en productos por peso se recalcula la cantidad y en productos por unidad el precio. No admite cero ni negativos. Todo cambio de precio queda en auditoría (producto, precio de lista, aplicado, usuario).
- **Venta con o sin stock (interruptor):** configuración global "Permitir vender sin stock" (por defecto **activada**) y, por producto, "Exigir stock" (ese producto nunca se vende sin stock). Con la opción activa, vender más de lo que hay **se permite**: el stock queda en **negativo**, la línea del ticket muestra "Sin stock: quedará en negativo (−N und)", se registra en auditoría (`VENTA_SIN_STOCK`) y el producto se marca en rojo en Inventario, en Vender y en las alertas del Resumen hasta regularizarlo (compra o ajuste). Con la opción apagada o con "Exigir stock", el botón del producto se deshabilita y el servidor rechaza la venta. Ajustes manuales a negativo sólo si el producto admite venta sin stock. Anular/devolver restituye el stock en la unidad base. El menú público trata stock ≤ 0 como "sin stock" según la regla del comercio.
- **Documento:** Sin factura fiscal → Ticket interno, Remito o Presupuesto, numeración propia por caja ("2-15" = ticket 15 de la caja 2), leyenda "DOCUMENTO NO VÁLIDO COMO FACTURA" (nunca "Factura"). Con factura → A/B/C y notas de crédito/débito, validación de condición fiscal del cliente; el **CAE se pide solo al servidor fiscal (ver 4.12)** y, mientras la integración no esté habilitada y probada, queda "pendiente de CAE" y se carga a mano; con CAE es inmutable (se corrige con nota). El interruptor tiene texto y color distintos, el documento resultante es visible antes de confirmar, el valor por defecto es configurable por sucursal y rol, y cambiarlo pide motivo y queda auditado. Los presupuestos no suman como venta. **Estado real (2026-10-19):** el código emite *Ticket interno* o *Factura electrónica*; el selector Remito/Presupuesto se completa en 4.22.4 (una sola vez, sin duplicarlo).
- **Canal y precio mayorista:** cuando `wholesale.on` está encendida, el precio de cada línea sale de `priceResolve` (4.22.1.3); apagada, Vender se comporta exactamente como se describe arriba.
- Los totales se recalculan siempre en el sistema (servidor): nunca se confía en el precio que llega de afuera. Se muestra el cálculo completo antes de confirmar.
- **Modo táctil/POS:** áreas de 48×48 px con 8 px de separación, teclado numérico en pantalla, gestos; nada depende sólo del hover o del clic derecho. Kiosco a pantalla completa con PIN de supervisor, cierre por inactividad y pantalla de cliente secundaria.
- **Campos numéricos (regla de todo el sistema):** nunca arrancan con "0" cargado; vacíos con placeholder; si traen valor, al entrar quedan seleccionados. Teclado en pantalla: teclas ≥ 56 px, el primer dígito reemplaza el valor, vacío muestra "Escribí el número", botones "Borrar todo / Cancelar / Listo".
- Los campos `type=number` se leen con `valueAsNumber`; los textos con el parser local (coma decimal); fechas con año de 4 cifras primero.

### 4.3 Descuentos, cupones, membresías y beneficios
- **Regla de oro:** un beneficio por compra. Cupón **o** membresía (se aplica el mejor, nunca acumulados), mayorista, descuento manual y promociones de tarjeta tampoco se acumulan salvo configuración expresa visible antes de cobrar. La resolución completa del precio (acuerdo especial, lista, escalón, bulto y un solo beneficio) está en **4.22.1.3**.
- Los productos de venta restringida por edad (p. ej. tabaco) **no participan** de promociones ni descuentos.
- Cupón: código único por tenant, estado, vigencia, porcentaje o monto fijo, compra mínima, tope, límite total y por cliente, audiencia (todos / socios / cumpleaños), exclusiones. El servidor valida y consume de forma atómica e idempotente; devolver/anular libera el uso.
- El descuento se **reparte por línea** (método del mayor resto, centavos enteros); el ticket conserva base, cupón, descuento, regla y precio final.
- Membresías/suscripciones: plan (nombre, precio, periodicidad, beneficio), consentimiento versionado, cancelación sin obstáculos; no se marca activa hasta confirmar el pago.

### 4.4 Inventario por rubros
- **Rubros diferenciados y visibles:** pestañas de rubros con **color propio** y contador; vista agrupada por rubro con encabezado de color (cantidad, alcohol, +18, fuera del menú); chip de rubro en cada fila; filtros por rubro, texto (nombre, presentación, código) y "sólo stock bajo/negativo"; productos sin rubro se muestran aparte.
- **Alta y edición de rubros** (rol autorizado): nombre único, color (paleta + validación `#RRGGBB` estricta antes de usarlo en estilos), responsable opcional, diseño en el menú (grilla / filas / por bodega), nombre en el menú, interruptores "mostrar en el menú", "vende alcohol" y "sólo +18 (sin promociones)". Un rubro con operaciones no se borra: se edita o desactiva. **ABM completo y siempre visible (v2.3):** en Configuración → "Rubros, responsables y reparto" cada rubro es una tarjeta que **se acomoda (flex-wrap) y nunca recorta** sus controles: encabezado con nombre + botones **Editar** y **Eliminar** (≥44 px, con `aria-label`), y debajo responsable, "reparte" e impuesto diario. Eliminar: sin productos ni historial → se borra; con productos → pide el rubro de destino (nunca quedan productos huérfanos); con ventas/movimientos → se **archiva** (el historial y los reportes se conservan). Todo con auditoría y sincronizado (borrado lógico). **Prueba obligatoria:** los botones deben verse completos a 1600/1280/768/360 px **con "reparte" tildado** (el campo de impuesto agranda la fila), y editar/alta/baja vacía/baja con productos deben funcionar y llegar al servidor.
- **Unidades:** `und`, `kg`, `lt` (internamente `u`, `kg`, `l`). Etiquetas coherentes en edición, Vender, ajustes, exportación e importación (la importación acepta und/lt/litro/litros). Stock en unidad base común; conversión atómica para bultos/packs.
- Producto: nombre, presentación, grupo/bodega, rubro, unidad, costo, tipo de cálculo (recargo sobre costo o margen sobre precio, nunca mezclados), precio final, stock (puede ser negativo si se vende sin stock), código de barras único, PLU de balanza, descripción, nombre en inglés, "Publicar en menú digital" (apagado por defecto), activo, "Exigir stock". Margen se muestra sólo con costo cargado ("—" si el costo es cero). La eliminación está protegida por el requisito **4.16**: el borrado físico sólo se permite a Administrador y sólo si no hay referencias ni historial. Si tiene movimientos, ventas, comandas, facturas, devoluciones u otra referencia histórica, se archiva/desactiva mediante borrado lógico, preservando el historial y las claves referenciales.
- Ajuste rápido con motivo obligatorio; movimientos de stock auditados; stock mínimo/máximo con alertas; depósitos/sucursales como extensión opcional.
- La API pública nunca expone costo, stock exacto, proveedor ni márgenes.

### 4.5 Caja y cierres
- Apertura, movimientos (ingresos, egresos, retiros, reintegros), cierre con arqueo; cada sesión se asigna a la caja configurada para el terminal, responsable, turno y sucursal. **Todo movimiento financiero lleva un rubro válido obligatorio** (sección 6.10).
- Al cerrar se guarda una foto inmutable: medios de pago, fiscal vs. interno, egresos y retiros, esperado vs. declarado, usuario y hora, observaciones y sello SHA-256; en la nube el cierre queda congelado (sólo se agregan notas).
- Pantalla "Cajas cerradas": lista y calendario, filtros, alertas de días sin cierre, ficha imprimible (A4) con verificación de integridad, CSV.
- Importes en centavos enteros o `DECIMAL(14,2)`, nunca float. Fechas en UTC y visualización en `[ZONA_HORARIA]`.
- Modelo flexible de cajas (una caja/una persona, varias personas, varias cajas, por sucursal/turno/responsable/socio). Se aplica la especificación jerárquica de **4.14**: caja simple, cajas operativas y caja principal/consolidada se configuran sin obligar a todos los clientes a usar la estructura completa. Reparto entre socios, sueldos y reporte de cierre para WhatsApp son un **módulo opcional apagado por defecto** (sección 5.9); sin socios configurados el reporte no muestra secciones vacías ni "()" huérfanos.
- **Ventas de esta caja con detalle de cada operación y cajas sin límite de operaciones por turno:** especificado en **4.24.1–4.24.2** (hoy la tabla existe pero sin detalle).
- **Traspasos entre cajas y sucursales (también con cajas cerradas), comprobante interno, permiso `transfer_funds` y registro con filtros:** especificados en **4.23.1–4.23.3 y 4.23.7**; el cierre sellado no cambia (4.23.2).
- **Cierre ciego, caja por canal, cheques/eCheq y retenciones sufridas:** especificados en **4.22.6** (`cash.blind` apagada por defecto). La foto sellada del cierre no cambia de forma: el formato ampliado se lee con valores por defecto en cierres anteriores.

### 4.6 Clientes, Club y fidelización
- **Clientes:** consentimientos separados por finalidad (atención/club, comunicaciones comerciales, analítica/publicidad) con versión, fecha y origen; sin consentimiento comercial el cliente queda fuera de campañas; WhatsApp y correo cifrados; duplicados por los últimos 10 dígitos del WhatsApp; fiados (límite de crédito sólo modificable por rol autorizado, antigüedad, alertas); baja que anonimiza y conserva el historial contable.
- **Alta al Club desde el menú público** (nombre y apellido, WhatsApp, fecha de nacimiento): reutiliza el módulo de clientes (no crea una base paralela); fecha de nacimiento con su propio validador (un cumpleaños anterior al 2000 es válido); menores de 18 no se dan de alta con beneficios ni comunicaciones; respuesta genérica ante duplicados (nunca confirma si un número ya existe); límites por dispositivo/IP/hora; idempotencia (doble toque = un cliente); sin conexión o con error el mensaje es honesto, nunca un alta "exitosa" sin confirmación.
- **Tarjeta de sellos:** libro mayor (los sellos no se editan, se corrigen con un movimiento compensatorio auditado); meta configurable; 1 sello por día por socio; código de 8 dígitos (N.º de socio + código de 4 dígitos que cambia cada 2 minutos) o QR firmado, de **un solo uso**; el cliente consulta su tarjeta digital en el menú (recuperación con dos factores: WhatsApp + fecha de nacimiento); canje de premio auditado y reversión al anular la venta. El alta al Club no regala sellos.
- **Tarjeta del Club en la nube (V26.3) — flujo completo:** (1) el cliente escanea el QR del menú, completa nombre y apellido, WhatsApp, cumpleaños y **DNI (opcional)**, y acepta el consentimiento; (2) **su celular genera** el identificador y la clave secreta de su tarjeta (80 y 192 bits al azar), los manda cifrados (RSA-OAEP + AES-GCM con la llave pública del comercio) y **muestra la tarjeta en el acto**, con su QR y su código de 4 cifras que cambian cada 2 minutos (estado «en trámite» hasta que el negocio la active); (3) el equipo (admin, supervisor o mostrador, con sesión abierta) descifra el alta cada 20 s o al abrir el cobro / Fidelización, crea el cliente **con el mismo id que la tarjeta** y le asigna el N.º de socio; (4) el celular consulta el estado con `club_estado(slug, id)` (anónimo, `09-club-tarjeta.sql`: sólo devuelve N.º de socio y cantidad de sellos de quien conoce el identificador secreto; nunca nombre, WhatsApp, DNI ni cumpleaños) y pasa a mostrar «Socio N.º 0007 · 3 / 8». Un segundo celular del mismo cliente (mismo WhatsApp **y** mismo cumpleaños) obtiene su propia tarjeta sobre la misma ficha; con otro cumpleaños el alta se rechaza (evita colgarse de una cuenta ajena). Las altas que el equipo no puede abrir **no se descartan** (quedan «nueva»); sólo se rechazan las inválidas (menores de 18, datos incompletos, WhatsApp repetido con otro cumpleaños).
- **Sellos en el mostrador (V26.3)** — un sello por socio cada 24 h en todos los casos, auditado con el medio usado: por **QR** de la tarjeta (`RAVE2|id|código`, un solo uso; lector USB que escribe solo o cámara con `BarcodeDetector` si el navegador la ofrece), por **código de 8 números** (N.º de socio + código), por **DNI** (se escribe; si hay dos clientes con el mismo DNI se pide buscarlo por nombre) o por **tarjeta/etiqueta NFC** (`RAVE2N|id`, Web NFC: sólo Chrome en Android; la etiqueta se graba desde la ficha del cliente). Disponible en Vender → Cobrar (campo «Sello del Club») y en Fidelización. El cobro también encuentra al cliente por DNI. La etiqueta NFC es fija (no rota como el QR): el límite de un sello por día y la baja de la tarjeta son su defensa. El DNI es opcional, va cifrado en la nube (`__pii`) y se borra en la baja.
- **Checklist de aceptación del Club (correcciones V26.3 que no se pueden perder):** (1) el cliente que escanea el QR del menú recibe su tarjeta **en el acto**, con QR y código que rotan cada 2 minutos, aunque no haya sesión del negocio abierta: **jamás se oculta el bloque de la tarjeta por falta de sesión**; (2) el alta de un celular no se pierde: una alta ilegible o duplicada queda «nueva» y sólo se rechazan las inválidas (menores de 18, datos incompletos, WhatsApp repetido con otro cumpleaños); (3) la importación de altas corre sola (cada 20 s, al abrir Cobrar o Fidelización), es **no destructiva** y con bloqueo para que no corra dos veces a la vez; (4) el cliente nace con el **mismo id que la tarjeta** y recibe su N.º de socio; el celular lo consulta con `club_estado`, que nunca devuelve nombre, WhatsApp, DNI ni cumpleaños; (5) sellos por **QR, código de 8 cifras, DNI o NFC**: uno cada 24 h por socio, un solo uso por código, auditados con el medio; (6) el **DNI es opcional**, va cifrado (`__pii`), se borra en la baja y, si dos clientes lo comparten, se pide elegir por nombre; (7) la **meta y el premio** del Club se publican en el menú por la lista cerrada de `rave_limpiar_menu`; (8) los **cupones** por audiencia (todos / socios / cumpleaños) aplican en todo el sistema, con límite por cliente y uso sincronizado; (9) las pruebas con códigos que rotan usan reloj ajustable en **todos** los dispositivos (`window.__now`); (10) la tarjeta vive en el celular: si el cliente borra los datos del navegador la pierde, y el mostrador sigue sellando por DNI o NFC.
- **Administración de clientes por el administrador (edición, baja y eliminación definitiva sin historial, con efectos en cadena sobre la tarjeta, campañas y altas pendientes):** especificada en **4.24.3–4.24.4**.
- **Wallet (Apple/Google):** no implementado — necesita cuentas de desarrollador y certificados de firma de pases (ver 4.19). Alternativa vigente: la tarjeta queda guardada en el celular (se puede agregar a la pantalla de inicio) y, si se pierde, el mostrador suma sellos con DNI o NFC.
- **Tarjeta modelo del negocio (en Fidelización):** vista previa de frente y dorso a tamaño tarjeta (85,6 × 54 mm) con logo, nombre, sellos de ejemplo configurables, premio, dirección, WhatsApp y red social del comercio; el dorso lleva un QR al menú; impresión "con ejemplo" y "en blanco" lista para imprimir/cortar. Los datos salen de la configuración, nunca fijos en el código.
- **Tarjeta digital entregable:** además de consultar/imprimir la tarjeta web existente, el cliente debe poder recibir un enlace seguro para guardarla en Apple Wallet o Google Wallet cuando el comercio haya habilitado y configurado esa plataforma. La tarjeta y el envío de avisos se implementan según **4.19** y el módulo opcional **5.23**; no crear una segunda cuenta ni un saldo paralelo.

### 4.7 Personal
Empleados con documento cifrado, tarjeta NFC/QR firmada, terminal de fichaje (Web NFC en Android/Chrome, lector USB o tecleado); rechaza firmas falsas y repetidos en 60 s; registro con fecha y hora del servidor, dispositivo y método; planillas de horas. Lector de huellas sólo vía HAL, con revisión legal previa (sección 6.7).

### 4.8 Compras y gastos con IA (sólo admin)
Subir o fotografiar facturas/remitos (JPG, PNG, PDF); lectura en cascada: QR fiscal → IA en la nube (opcional) → texto del PDF/OCR local → parser local; extrae proveedor (nombre y ID fiscal con dígito verificador), tipo y número, fechas, renglones, neto, impuestos y total; sugiere categoría. **Revisión humana obligatoria** (imagen + formulario, controles de importes, duplicados, fechas) antes de guardar. Adjunto cifrado. Tablero por categoría y proveedor, compras vs. ventas, alertas de variación de costos, notas de crédito que restan. La IA trata el contenido del documento como **dato, nunca instrucción**; salida con esquema JSON estricto; sin herramientas ni acceso a datos del comercio; tope diario.

**Vinculación (V26.2):** la factura leída y revisada puede terminar como *ingreso de mercadería* con su proveedor, stock, costo y deuda según **4.21**; no se duplica el gasto: un mismo hecho económico se registra una sola vez.

### 4.9 Importar y exportar todo (y migrar desde el sistema anterior)
Entidades: artículos, rubros, clientes, boletas/ventas, cajas cerradas, gastos, proveedores. Plantillas descargables; CSV (`;`, UTF-8 con BOM). Importar CSV/XLSX en 3–5 pasos (**el .xlsx se lee de verdad, sin librerías externas**: zip + XML con `DecompressionStream`, primera hoja, tope de tamaño descomprimido, fechas de Excel → dd/mm/aaaa, decimales → formato local, strings compartidos/inline; el `.xls` antiguo se rechaza con instrucciones claras; nunca un mensaje del tipo "todavía no se lee"): archivo → mapeo (reconoce columnas propias y sinónimos) → vista previa con contadores (nuevos / a actualizar / omitidos / con error), errores por fila y "Probar (sin guardar)"; máximo 20.000 filas y 15 MB; números en formato local; fechas en número de Excel y dd/mm/aa. Duplicados por código de barras/SKU, WhatsApp (últimos 10 dígitos), nombre de rubro. Atomicidad: se valida y cifra todo primero; si algo falla se revierte; cada lote queda registrado y se puede deshacer el último. Clientes migrados sin consentimiento quedan con consentimiento "No". Boletas y cajas históricas nunca tocan stock, caja viva ni cola fiscal, y un archivo repetido no duplica. Toda celda que empiece con `=`, `+`, `@` o `-` se neutraliza (anti inyección de fórmulas). Todo en auditoría.

### 4.10 Periféricos (enchufar y usar)
- **HAL / DeviceManager** con drivers por tipo; agregar un modelo no toca el núcleo. Conexiones: USB, Serie, red (TCP 9100), Bluetooth y driver de impresora del sistema operativo. En el navegador: WebUSB, Web Serial y Web Bluetooth cuando existan; si no, agente local.
- **Botón único "Conectar y reconocer (automático)":** el navegador pide elegir el dispositivo una sola vez (exigencia de seguridad); el sistema toma marca y modelo, lo registra con valores razonables (80 mm, corte, acentos PC850), imprime una hoja de prueba y no duplica. **Reconexión sola** al abrir, al enchufar y cada 30 s, con aviso de desconexión (heartbeat). **"Impresora de Windows (1 clic)"** como vía más simple.
- Impresoras térmicas/comanderas (ESC/POS 58/80 mm, corte, cajón, QR, códigos, ruteo por sector, cola con reintentos sin duplicar tickets); A4 por driver/PDF; etiquetas ZPL/EPL. Balanzas: lectura en vivo por Serie/USB con protocolos configurables, esperar peso estable, reconexión, varias balanzas, EAN-13 de balanza. Lector de códigos en modo teclado. NFC: USB (PC/SC) y Web NFC. Cajón por pulso desde la impresora, auditado.
- Los datos que vuelven de un dispositivo no son confiables: validar rango y tipo. La ausencia de un periférico nunca bloquea las demás funciones. Hardware real sin probar se declara "pendiente de prueba física" con marca/modelo/SO/driver.
- **Ticket representativo del cliente:** logo, razón social, dirección, teléfono, número y fecha, atendió y caja, líneas con descuento desglosado, medio de pago, sellos del socio, QR del menú, mensaje al pie editable, leyenda de documento no válido como factura y leyendas legales breves (derechos del consumidor, restricción por edad) sin marcas `[VERIFICAR]` impresas; ancho 58/80 mm; vista previa y texto/bytes ESC/POS comprobables.

### 4.11 Administración y recuperación
Datos del comercio y rubro; usuarios/roles (permisos validados en el servidor); respaldos cifrados; auditoría encadenada (hash); zona de riesgo; nube; Integraciones (estado, cuenta conectada, permisos, última sincronización, errores, costos, botón desconectar/revocar; nunca tokens al cliente). Código de recuperación de 20 caracteres mostrado una sola vez; el admin restablece la clave de un empleado con clave temporal obligando el cambio; "Necesito ayuda" → solicitud al desarrollador; restablecimiento de soporte sólo tras verificar identidad y nunca ejecutable desde la API. Sin contraseña ni código, los datos cifrados no se recuperan (por diseño).

### 4.12 Facturación electrónica fiscal: certificado y CAE automático (pantalla "Periféricos y ticket")

Ejemplo de referencia: Argentina / ARCA (WSAA + WSFEv1). Para otro país se reemplaza el adaptador fiscal; el contrato (cola, estados, idempotencia, ticket) no cambia. Todos los nombres de menús, servicios y URLs del organismo son `[VERIFICAR]` en la fuente oficial antes de publicar.

**Dónde vive:** tarjeta "Facturación electrónica" dentro de **Periféricos y ticket** (sólo administrador), porque el resultado aparece en el ticket. No hay una pantalla fiscal separada que duplique configuración.

**Regla de oro:** el pedido de CAE **nunca** se hace desde el navegador (CORS, clave privada, secretos). Lo hace una **función de servidor** (en la referencia: Edge Function `arca`), apagada por defecto, que no se activa en producción sin una prueba real en homologación con el certificado del cliente. Hasta entonces el CAE se carga a mano y el ticket dice "COMPROBANTE PENDIENTE DE CAE — no válido como factura".

**Datos del emisor (configuración por comercio y por ambiente):** CUIT con dígito verificador, razón social, condición frente al IVA, domicilio fiscal, inicio de actividades, punto de venta tipo "Web Services" (número), ambiente (homologación y producción separados, nunca mezclados), alícuota de IVA por defecto de los productos (editable por producto), umbral de identificación del consumidor final `[VERIFICAR monto vigente]`.

**Credenciales:** la clave privada RSA 2048 se genera **en el servidor** (nunca viaja ni se descarga), se cifra con una llave maestra guardada en los secretos de la función (`ARCA_MASTER_KEY`, que nadie escribe en el código ni en el navegador) y se guarda en una tabla **sin políticas de lectura** (ilegible desde el cliente). El certificado y el ticket de acceso (TA) también quedan cifrados y separados por comercio y ambiente. Los certificados jamás se sincronizan con los equipos ni se incluyen en respaldos ni exportaciones.

**Asistente de 5 pasos por ambiente:**
1. Datos del emisor + generación de la clave y la solicitud CSR (PKCS#10, SHA-256; sujeto `C=<país>, O=<razón social>, CN=<alias sin espacios>, serialNumber=CUIT <11 dígitos>`) validando CUIT y alias. Se muestra/copia sólo la CSR.
2. Guía de lo que se hace en el sitio del organismo con clave fiscal: crear el certificado pegando la CSR y bajar el `.crt` (textos y menús `[VERIFICAR]`; el sistema no automatiza esa web).
3. Carga del `.crt`: se verifica que corresponde a la clave guardada, que no está vencido y que el CUIT del certificado es el del emisor; se muestra el vencimiento y se avisa con 30 días de anticipación.
4. Guía de la relación de servicio (WSFE) y alta del punto de venta "Web Services" `[VERIFICAR]`.
5. **Probar conexión**: pide el TA (WSAA) y consulta el estado del servicio y el último comprobante autorizado; sólo si pasa se habilita "Pedir CAE automático" (bandera por ambiente, apagada por defecto).

**Autenticación con el organismo (WSAA):** ticket de requerimiento (`generationTime` unos minutos hacia atrás y `expirationTime` hacia adelante para absorber diferencias de reloj), firma CMS con el certificado del emisor (algoritmo de firma aceptado `[VERIFICAR]`), TA con vigencia de unas 12 h que **se guarda y se reutiliza** (el servicio rechaza un TA nuevo mientras haya uno vigente: ventana de retención `[VERIFICAR]`), reloj del servidor sincronizado. Endpoints de la referencia `[VERIFICAR]`: WSAA homologación `https://wsaahomo.afip.gov.ar/ws/services/LoginCms`, producción `https://wsaa.afip.gov.ar/ws/services/LoginCms`; WSFEv1 homologación `https://wswhomo.afip.gov.ar/wsfev1/service.asmx`, producción `https://servicios1.afip.gov.ar/wsfev1/service.asmx`.

**Pedido de CAE (WSFEv1):** `FEDummy` (estado), `FECompUltimoAutorizado` (siguiente número), `FECAESolicitar`, `FECompConsultar` (verificar antes de reintentar). Reglas:
- **El servidor arma el comprobante desde la venta ya guardada**, nunca desde el cuerpo del pedido: líneas, precios, descuentos, cliente. Totales recalculados con centavos enteros; precios con IVA incluido → neto = bruto / (1 + alícuota), IVA discriminado por alícuota (A y B), sin discriminar en C; el redondeo por alícuota se concilia al centavo (la suma de neto + IVA + exento + tributos = total exacto).
- **Clase del comprobante** según emisor y receptor: emisor Responsable Inscripto → A si el receptor es Responsable Inscripto, B en los demás casos; emisor Monotributo/Exento → C. Se informa la **condición frente al IVA del receptor** (campo obligatorio desde la RG 5616 `[VERIFICAR vigencia]`); tipo y número de documento del receptor (CUIT, DNI o consumidor final sin identificar si el monto lo permite).
- **Idempotencia:** una venta tiene a lo sumo un CAE (clave única por venta). Se reserva el número bajo bloqueo por comercio + punto de venta + tipo. Ante un timeout o corte se consulta `FECompConsultar` antes de reintentar; nunca se emite dos veces la misma venta.
- **Estados:** `pendiente` → `procesando` → `autorizado` | `rechazado` (con observaciones/errores del organismo, visibles y corregibles) | `error_red` (reintento con espera creciente y tope). Los reintentos los dispara cualquier equipo conectado con permiso y, si está disponible, una tarea programada del servidor `[VERIFICAR]`.
- **Sin conexión:** la venta se cobra igual; el ticket provisorio sale como "pendiente de CAE" y la factura se pide al reconectar. Nunca se muestra como autorizada sin respuesta del organismo.
- **Inmutabilidad:** con CAE la venta no se edita ni se borra. La corrección es una **nota de crédito/débito** pedida por el mismo canal con el comprobante asociado.
- **Resultado:** el servidor escribe CAE, vencimiento, tipo, punto de venta y número en el registro de la venta y los equipos lo reciben por la sincronización.

**Ticket / comprobante:** muestra tipo y letra, número `PPPP-NNNNNNNN`, CAE y vencimiento, datos del emisor y del receptor, desglose de IVA cuando corresponde y el **QR fiscal** (JSON versionado codificado en base64 sobre la URL oficial `[VERIFICAR especificación y URL vigentes]`). Sin CAE: leyenda de pendiente. La leyenda "DOCUMENTO NO VÁLIDO COMO FACTURA" es exclusiva de los comprobantes internos.

**Modo simulador (sólo demos):** genera un CAE de ejemplo rotulado "SIMULADO — SIN VALIDEZ FISCAL" para mostrar el flujo; está prohibido en el sistema real de un cliente. Un simulador **no** reemplaza la homologación.

**Auditoría:** cada solicitud, respuesta, observación y error queda registrado sin claves, certificados ni TA. **Pruebas:** firma CMS verificable con herramienta independiente, TRA con horas correctas, reutilización del TA, error de TA vigente, numeración, timeout con consulta previa, rechazo con observaciones, nota de crédito con comprobante asociado, totales con redondeo conflictivo por alícuota, A/B/C según condición, venta duplicada rechazada, usuario sin permiso, comercio A sin acceso a credenciales del B, secretos ausentes de respuestas y logs, y **homologación real con el certificado del cliente** (pendiente hasta tenerlo).

**Implementación de referencia (as-built, v2.2) — contrato entre navegador y servidor**
- **Acciones de la función** (`POST /functions/v1/arca` con `{accion, comercio, ambiente, …}` y el JWT del usuario): `estado`, `generar_csr` (admin), `cargar_cert` (admin), `probar` (admin), `emitir`, `nota_credito` (admin), `reintentar`. Respuestas con un `resumen` (`id, estado, tipo, letra, pto, nro, cae, vto, fecha, total, neto, iva, cuit, razon, cond, receptor, error, ambiente, qr`); errores `{error, etapa, reintentable}` (422 = dato a corregir; 502 = el organismo no respondió → el navegador **no** lo toma como "sin internet" y conserva el motivo). La config del emisor se guarda con la función SQL `arca_guardar_config` (el CUIT y el punto de venta quedan bloqueados cuando ya hay comprobantes aprobados).
- **El CAE lo escribe sólo el servidor** en la venta (`arca` / `arcaNC`); la función `sincronizar()` descarta cualquier `arca` que llegue del navegador y conserva el del servidor; con CAE el comprobante no cambia. El navegador, al recibir la venta, **nunca pisa un CAE ya obtenido con una lectura vieja** (carrera real encontrada en pruebas).
- **Receptor:** se elige en el cobro (consumidor final / DNI / CUIT / CUIL, condición frente al IVA, nombre) con validación local de CUIT/DNI; se guarda **sólo en el equipo** hasta obtener el CAE (no viaja en los registros de ventas) y se envía en el pedido de emisión. Un equipo sólo reintenta las ventas de **su** caja (tiene el receptor); los reintentos de lo ya reservado en el servidor los hace cualquier equipo (`reintentar`).
- **Flujo al cobrar "Con ARCA":** la venta se guarda y sincroniza → se pide el CAE (pantalla "Pidiendo CAE a ARCA…", con opción *Seguir sin esperar*) → ticket con CAE y QR. Si ARCA no responde o no hay internet, la venta queda como *pendiente de CAE* y se reintenta sola con cada sincronización; si ARCA **rechaza**, no se reintenta sola: se muestra el motivo y la tarjeta ofrece *Pedir CAE* de nuevo o *Anular*. Con ARCA caído nunca se duplica un comprobante (probado: 3 ventas → exactamente 3 comprobantes).
- **Nota de crédito:** anular una venta con CAE abre el flujo "Nota de crédito" (motivo obligatorio, irreversible): pide la NC al servidor y **recién entonces** anula la venta (stock, cupones, sellos). Sin conexión no se emite.
- **Ticket:** razón social, CUIT y condición del certificado (no los del ticket interno), `FACTURA/NOTA DE CRÉDITO` + letra + código, `Pto. Vta. PPPP Nro. NNNNNNNN`, receptor, neto/IVA en letra A, leyenda de transparencia fiscal al consumidor en letra B `[VERIFICAR texto vigente]`, CAE, vencimiento y QR fiscal. El QR fiscal (~300 caracteres) obliga a un generador de QR con versiones hasta 20 (nivel M): verificado con un lector de referencia.
- **Demo:** el simulador (letra B, CAE inventado, rótulo "COMPROBANTE SIMULADO · SIN VALIDEZ FISCAL") sólo existe cuando la nube no está configurada; el sistema del cliente nunca lo usa.
- **Pruebas ejecutadas (v2.2, entorno local con Postgres/PostgREST reales y ARCA FALSO):** 18 pruebas Deno de la función (CSR verificable con `openssl req -verify`, certificado de otra clave rechazado, CMS, TA, numeración, timeout con consulta previa, rechazo, NC asociada, A/B/C, redondeo) + 32 comprobaciones en Chromium (emisor, CSR sin que la clave llegue al navegador, certificado, probar conexión, activar, Factura B y A, ARCA caído → cola → CAE sin duplicar, rechazo, tarjeta de pendientes, NC, ticket, QR, sin datos del receptor en el servidor). **Falta siempre:** homologación con el certificado real del comercio y luego producción; nada de esto reemplaza esa prueba.

### 4.13 Asistente conversacional transversal (voz y texto) — requisito de arquitectura desde el inicio

**Propósito:** permitir que una persona autorizada opere funciones de negocio hablando o escribiendo en castellano rioplatense simple. Ejemplo: “Cargá una comanda: una pizza grande especial de calamares, una gaseosa y una soda; son tres personas, mesa cuatro”. El sistema debe interpretar, validar, registrar la operación real y comunicar el resultado. No alcanza con transcribir voz, producir una respuesta o cambiar visualmente una pantalla.

**Regla central:** la IA interpreta y selecciona una acción de un catálogo permitido; el backend del ERP conserva la autoridad sobre permisos, datos, reglas de negocio, importes y persistencia. Está prohibido dar a la IA acceso irrestricto a SQL, secretos, tokens, archivos privados o endpoints arbitrarios.

#### 4.13.1 Experiencia de usuario
- Punto de acceso transversal visible desde todas las áreas autenticadas: botón de micrófono, entrada de texto, estado de escucha/procesamiento/confirmación/ejecución/error y respuesta leída en voz alta cuando la síntesis esté habilitada.
- La interfaz informa claramente cuándo el micrófono está activo. No escuchar ni grabar permanentemente de manera oculta. No guardar audio crudo por defecto; si una función futura necesita conservarlo, pedir consentimiento explícito, definir finalidad, acceso y vencimiento.
- Comprender instrucciones naturales, correcciones y referencias: “agregale una soda”, “sacá el último producto”, “cambiá la mesa a la seis”, “mostrame qué quedó pendiente”. Resolver referencias según el contexto actual, sin confundir comercios, sucursales, cajas, clientes o sesiones.
- Aceptar voz y texto mediante una interfaz de entrada intercambiable. El sistema debe seguir siendo operable sin micrófono, sin altavoces y cuando el proveedor de voz/IA no esté configurado.
- Mantener castellano rioplatense en las respuestas; usar el vocabulario del rubro y del comercio. Registrar en la interfaz qué acción se va a ejecutar y qué campos detectó, particularmente ante operaciones con impacto.
- No inventar coincidencias del catálogo. Si hay productos homónimos, variantes, tamaños, marcas, precios o datos ambiguos, preguntar y esperar respuesta. No asumir “gaseosa” cuando existen varias opciones incompatibles.
- Permitir corregir una interpretación antes de ejecutar, cancelar la operación y, cuando las reglas lo permitan, pedir deshacer una operación mediante una acción compensatoria auditada. No prometer deshacer acciones irreversibles.

#### 4.13.2 Flujo obligatorio de cada instrucción
1. Capturar voz o texto; normalizar errores de reconocimiento sin cambiar el significado económico u operativo.
2. Detectar intención, entidades, cantidades, referencias y datos ausentes en un esquema tipado y validado.
3. Resolver el tenant, la sucursal, la caja, el usuario y el contexto de pantalla desde la sesión autenticada, nunca desde datos no confiables que la IA pueda inventar.
4. Buscar la acción publicada por el `ActionRegistry` del módulo activo y comprobar que esté habilitada para el plan, el tenant, la sucursal y el rol del usuario.
5. Validar parámetros contra esquema y reglas de negocio en backend. Consultar al servidor los precios, permisos, disponibilidad, saldos y estados actuales; no confiar en valores calculados por el modelo o enviados por el navegador.
6. Si hay ambigüedad, falta un campo obligatorio o hay varias coincidencias, preguntar de forma concreta y no ejecutar parcialmente salvo que la operación esté diseñada expresamente para borrador.
7. Aplicar política por riesgo: lectura; escritura reversible de bajo riesgo; escritura con impacto; acción crítica/irreversible. Las acciones de riesgo medio/alto muestran un resumen y requieren confirmación explícita según política. Las críticas pueden exigir volver a autenticarse o un segundo factor; la frase de voz no reemplaza ese control.
8. Ejecutar por servicio de dominio existente, dentro de una transacción cuando corresponda y con clave de idempotencia. No crear una implementación paralela de las reglas de venta, caja, inventario, turnos o comandas.
9. Persistir auditoría con actor, origen (`voice`, `text`, `ui`, integración), acción solicitada, acción resuelta, referencia del registro, campos relevantes no sensibles, resultado, política de confirmación, timestamps y clave de idempotencia. No registrar audio completo, tokens, secretos ni información sensible innecesaria.
10. Confirmar al usuario sólo lo que realmente se guardó/confirmó. Diferenciar `borrador`, `pendiente de sincronización`, `pendiente de confirmación externa`, `ejecutado`, `rechazado` y `fallido`. Si el servidor o un proveedor no confirma, nunca anunciar éxito.

#### 4.13.3 Catálogo universal de acciones
- Crear un `ActionRegistry` central y extensible. Cada módulo/adaptador declara sus herramientas disponibles con: `actionId`, descripción de la intención, schema de entrada, schema de resultado, permisos RBAC, requisitos de contexto, nivel de riesgo, política de confirmación, si admite offline, regla de idempotencia, servicio de dominio invocado, errores esperados y pruebas.
- El registro de acciones es una lista blanca. El modelo sólo puede elegir acciones registradas y parámetros validados. El servidor vuelve a comprobar la acción aunque el frontend ya la haya validado.
- Toda nueva operación de negocio pública del sistema debe declarar su acción conversacional si es razonable operarla de esa forma. En el alta de un módulo, agregar su definición, permisos, contexto, auditoría, UX de confirmación y pruebas. No afirmar “todas las funciones disponibles por voz” hasta que la matriz pantalla/función/acción/prueba demuestre cobertura; las acciones físicas o no seguras se excluyen explícitamente o requieren un flujo asistido.
- Las acciones de consulta no devuelven campos a los que el usuario no tiene permiso (por ejemplo, costos, datos personales, información de otra sucursal o de otro tenant). Los reportes aplican los mismos filtros y reglas de acceso que la UI.
- Nombres de referencia (no endpoints asumidos): `gastronomy.order.create`, `gastronomy.order.add_item`, `gastronomy.order.update_table`, `pos.sale.prepare`, `inventory.stock.lookup`, `inventory.item.archive`, `cash.session.open`, `cash.session.reconcile`, `cash.session.close`, `appointments.create`, `team.ranking.read`, `reports.sales.read`. Adaptar o reutilizar los servicios reales encontrados en el repositorio; no duplicarlos.

Ejemplo orientativo de definición de acción (el formato final debe ajustarse a la tecnología real del repositorio):
```json
{
  "actionId": "gastronomy.order.create",
  "inputSchema": {
    "type": "object",
    "required": ["tableId", "covers", "items"],
    "properties": {
      "tableId": {"type": "string"},
      "covers": {"type": "integer", "minimum": 1},
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["productId", "quantity"],
          "properties": {
            "productId": {"type": "string"},
            "quantity": {"type": "number", "exclusiveMinimum": 0},
            "notes": {"type": "string"}
          }
        }
      }
    }
  },
  "requiredPermissions": ["orders.create"],
  "riskLevel": "write_reversible",
  "confirmationPolicy": "confirm_if_ambiguous",
  "idempotent": true
}
```

#### 4.13.4 Cobertura funcional por rubro
- Gastronomía: comandas, productos y cantidades, mesa, comensales, modificaciones, envío a cocina/barra según reglas, consultas de mesas y pedidos.
- Comercio/POS: búsquedas, preparación de venta, consulta de stock/precios permitidos, revisión de alertas e informes. El cobro/confirmación fiscal conserva sus salvaguardas actuales.
- Servicios/barberías: turnos, profesionales, comisiones, alquiler de silla, ranking, clientes y disponibilidad.
- Gimnasios/ONG/profesionales: socios/clientes, ingresos autorizados, cuotas, tareas, agenda y reportes con permisos apropiados.
- Administración: consultas de caja, ventas, inventario, auditoría y configuración autorizada. Cambios de permisos, borrados, transferencias de dinero, pagos, anulaciones, cierres y configuración crítica nunca se ejecutan por el solo hecho de que el modelo los haya interpretado.
- Todos los rubros: comandos genéricos “ayuda”, “qué puedo hacer acá”, “cancelar”, “repetir resumen” y “mostrar la interpretación”; la disponibilidad se genera a partir de los permisos y las acciones publicadas, no de una lista engañosa fija.

#### 4.13.5 Voz, proveedor y modo offline
- Diseñar adaptadores sustituibles: `SpeechToTextProvider`, `LanguageModelProvider`, `TextToSpeechProvider`; mantener contratos neutrales al proveedor y evitar dependencia directa del núcleo.
- La configuración del proveedor, límites de uso, costos, ubicación de datos y consentimiento son visibles para el administrador. Secretos sólo del lado servidor. Si el proveedor falla, mostrar el error del asistente sin marcar la nube principal como caída.
- Respetar CSP, CORS, límites de tamaño/duración, rate limiting, timeout, reintentos acotados y límites de gasto. El contenido reconocido se trata como entrada no confiable y puede contener instrucciones maliciosas; nunca puede ampliar privilegios ni alterar el prompt interno.
- Offline: permitir sólo las acciones para las que el módulo declare soporte local seguro. Las operaciones encoladas llevan clave idempotente y estado “pendiente de sincronización”. Caja consolidada entre sucursales, permisos no actualizados, pagos, facturación fiscal y otras acciones cuya validez dependa del servidor no se presentan como definitivas sin confirmación remota.

### 4.14 Cajas flexibles, caja principal y multisucursal (configuración modular)

#### 4.14.1 Perfiles de operación
- **Modo simple:** una caja operativa; no se muestran conceptos de caja principal, distribución ni casa central.
- **Modo varias cajas:** cajas operativas separadas por terminal, equipo, turno, responsable o sector.
- **Modo caja principal:** una caja principal/general recibe consolidaciones o fondos transferidos desde las cajas operativas. No se duplican ingresos por hacerlos visibles en un consolidado.
- **Modo multisucursal:** cada sucursal tiene su configuración, cajas operativas y, si está habilitada, su caja principal local. La Casa Central puede ver los datos de sucursales permitidas en una vista agregada; la capacidad de ver no autoriza automáticamente a modificar cajas locales.
- Los perfiles se activan mediante configuración persistida por tenant y, cuando corresponda, sucursal/rol. Debe existir migración segura y un valor por defecto equivalente al funcionamiento simple actual. La UI oculta la complejidad no habilitada, pero el backend también rechaza operaciones de módulos deshabilitados.

#### 4.14.2 Entidades y relaciones requeridas
Diseñar migraciones relacionales normalizadas, compatibles con la base existente y con las entidades ya presentes; antes de crear tablas duplicadas, detectar el modelo real. Respetar la clave de tenant ya usada por el repositorio: en el esquema de referencia existente aparece `comercio_id`; si el código adopta `tenant_id`, mapearlo de forma consistente. **No crear `tenant_id` y `comercio_id` como dos identificadores paralelos del mismo comercio.** Como mínimo, cubrir conceptos equivalentes a:
- `branches`: sucursales del tenant, código único por tenant, nombre, estado, configuración y zona horaria si aplica.
- `cash_registers`: cajas físicas/lógicas con `tenant_id`, `branch_id`, código único, nombre, tipo (`operational` / `main`), estado y vínculo jerárquico opcional a caja principal. No permitir jerarquías cíclicas.
- `cash_register_assignments`: asignaciones temporales de usuarios/equipos/turnos a caja, con fechas y auditoría.
- `cash_sessions`: apertura y cierre de una sesión por caja, usuario responsable, estado, saldo inicial y sello inmutable de cierre.
- `cash_movements`: libro mayor de movimientos de caja, importe en centavos enteros o `DECIMAL(14,2)`, moneda, tipo, rubro financiero obligatorio, fuente, referencia de negocio, actor, fecha y clave de idempotencia.
- `cash_movement_allocations` o estructura equivalente: desglose de un movimiento entre una o más cajas origen/destino, con importes que concilien exactamente con el movimiento padre. Los renglones de distribución no se vuelven a sumar como un segundo ingreso/egreso independiente en los consolidados.
- `cash_transfers`: transferencia identificable entre cajas, con movimientos de salida/entrada vinculados y estado atómico. Una transferencia completa debe tener importes de salida y entrada iguales y no se duplica al reintentar.
- `cash_closures`: instantánea de arqueo individual o consolidado, esperado vs. declarado, medios de pago, diferencias, responsables y sello/hash. Un cierre realizado no se sobrescribe; las aclaraciones van en registros nuevos.
- `cash_closure_lines` / vínculos a cierres origen: referencia exacta a sesiones y cajas incluidas en un cierre consolidado, evitando contar dos veces una caja o sesión.
- Configuración de módulo y alcance de usuario: usar el esquema de configuración/roles que ya exista si cumple; no crear un segundo sistema paralelo.
- `audit_log` o sistema de auditoría existente, con actor, tenant, sucursal, caja, motivo, antes/después cuando sea seguro y correlación de la operación.

Los nombres anteriores son contratos conceptuales, no permiso para duplicar tablas que ya existan. El implementador debe mapearlos a entidades vigentes o crear migraciones nuevas y aditivas con nombres consistentes.

#### 4.14.3 Reglas de movimientos y arqueos
- Cada venta/ingreso/egreso tiene una caja fuente válida o una razón explícita por la que no aplica. Todo movimiento financiero conserva su rubro financiero obligatorio conforme a 6.10.
- Un pago a proveedor que se financia desde varias cajas debe registrar un único evento de negocio con asignaciones trazables por caja, usuario autorizante, importe aportado y comprobante/motivo. Las actualizaciones se confirman en una transacción; si una caja no puede aportar los fondos según la política configurada, no dejar distribuciones parciales huérfanas.
- Permitir arqueo individual, cierre de caja operativa, arqueo consolidado de una caja principal y consolidación de varias cajas/sucursales sólo a roles habilitados. Diferenciar “consolidado de lectura” de “transferencia real de fondos”: una vista consolidada no mueve efectivo.
- Al consolidar, documentar claramente esperado, declarado, diferencias y elementos incluidos; no modificar cierres sellados de origen. La corrección se efectúa con movimiento compensatorio autorizado y motivo.
- Soportar reparto entre socios cuando el cliente active el módulo correspondiente. Definir porcentajes, base de cálculo, redondeo al centavo, momento de liquidación y snapshot de regla; no inferir porcentajes ni cambiar cierres anteriores al editar la configuración.
- El consolidado debe ser reproducible, filtrable por período, sucursal, caja, moneda, medio de pago y estado; mostrar hora/zona horaria, origen y fórmula. Excluir registros no confirmados según política y marcarlos con estado explícito.
- Asegurar aislamiento de tenant y sucursal en base de datos, endpoints/RPC, consultas, exports, informes y funciones de servidor. Casa Central sólo accede al conjunto de sucursales habilitadas. Toda transferencia, distribución, apertura, cierre o autorización queda auditada.

#### 4.14.4 Multisucursal
- Cada sucursal puede operar aislada o centralizada según configuración: catálogo compartido o local, usuarios asignados, precios permitidos, inventario, turnos, cajas, comprobantes y reportes; no asumir que todos los datos deben compartirse.
- `branch_id` es obligatorio en las entidades que pertenecen a una sucursal; entidades centrales y públicas definen expresamente su alcance. El servidor verifica la sucursal autorizada y no confía en el ID enviado por el frontend o interpretado por IA.
- Casa Central presenta consolidados sin mezclar monedas, cajas, estados o períodos incompatibles. La consolidación de caja no reemplaza la conciliación contable/fiscal.
- Cambiar una configuración de multisucursal no debe mover ni borrar datos históricos; incluir plan de migración y vista previa de impacto.

### 4.15 Ordenamiento reutilizable en todas las tablas

- Implementar un componente/servicio genérico reutilizable (por ejemplo `SortableTable` / `TableSortController`, adaptado al stack real), usado por **todas las tablas y listados tabulares del sistema**: paneles, inventario, ventas, clientes, equipo, cajas, auditoría, reportes e importaciones cuando corresponda.
- En cada encabezado elegible, mostrar control accesible de orden ascendente/descendente y estado visible (sin ordenar, ascendente, descendente). Incluir `aria-sort`, foco por teclado, texto accesible y objetivos táctiles de al menos 44×44 px. No depender sólo del color o de un ícono.
- Ordenar por tipo de dato y regla de negocio: números como números, dinero por valor numérico, fechas como fechas, texto con comparación local y tildes, estados por orden definido; valores nulos al final salvo requisito explícito. Nunca ordenar dinero o números como cadenas.
- El ordenamiento debe ser determinista ante valores iguales (desempate por identificador estable) y compatible con filtros, búsqueda, paginación y selección masiva. Al cambiar filtros, evitar estados visuales que indiquen una ordenación que ya no se aplica.
- Para tablas pequeñas se admite ordenamiento local. Para datos grandes, usar ordenamiento en servidor con campos/columnas permitidas mediante lista blanca y consultas parametrizadas; nunca interpolar nombre de columna enviado por el cliente. El orden de servidor y el de exportación deben ser coherentes y documentados.
- Guardar preferencias por usuario sólo si aporta valor, sin alterar los datos ni filtrar información. En tablas virtualizadas o de reportes, mantener accesibilidad y estabilidad de selección.
- Auditar únicamente cambios de preferencia si existe un motivo relevante; no crear eventos de auditoría por cada clic de ordenamiento.
- Revisar todas las tablas existentes mediante inventario de componentes y agregar pruebas de cobertura para detectar tablas sin ordenamiento. Una grilla visual que no sea una tabla de datos se documenta como excepción justificada.

### 4.16 Eliminación protegida de artículos de inventario (sólo Administrador)

- Incorporar acciones visibles de “Eliminar” en inventario para eliminación individual y masiva por selección. **Sólo el rol Administrador** puede ejecutar la acción. No basta con ocultar botones: el servidor, RPC/endpoints y la política RLS deben rechazar a cualquier otro usuario, incluso si invoca la operación manualmente.
- Separar explícitamente **borrado físico** de **archivado/borrado lógico**:
  - Si el artículo no tiene movimientos, ventas, comandas, facturas, devoluciones, recetas, compras, historial de precios ni referencias operativas, permitir borrado físico sólo con permiso `inventory.items.delete`, confirmación reforzada y auditoría.
  - Si el artículo tiene historial o referencias, bloquear el borrado físico y ofrecer “Archivar/desactivar” conservando claves, snapshots históricos e informes. No romper claves foráneas ni alterar comprobantes cerrados/fiscales.
  - La política de negocio no debe permitir que una acción de eliminación cambie ventas históricas, recalculen cierres ni elimine movimientos contables o fiscales.
- Antes de una eliminación masiva, mostrar vista previa con cantidad seleccionada, artículos eliminables, artículos que sólo pueden archivarse y los bloqueados con motivo. Nunca ejecutar sobre toda la tabla por una selección vacía; ninguna selección masiva puede exceder el alcance visible y autorizado sin una confirmación adicional clara.
- Exigir reautenticación/confirmación reforzada según política de riesgo, registrar usuario, fecha, sucursal, motivo, IDs, resultado por artículo y correlación de operación. No registrar información innecesaria.
- En nube, el backend aplica permisos y reglas de integridad por tenant/sucursal; las migraciones tienen índices/FK y política de borrado explícita. En modo offline, una petición de borrado físico queda bloqueada hasta poder validar referencias y permisos en el servidor; no se declara borrado definitivo localmente.
- Para auditoría y recuperación, preferir papelera lógica cuando sea adecuado; cualquier restauración debe ser administrativa, validar colisiones y preservar el historial.


### 4.17 Entregables técnicos obligatorios de arquitectura, SQL y código

No respondas sólo con recomendaciones conceptuales. Inspeccioná el repositorio real; si aún no existe, definí e inicializá una estructura coherente con el producto de la sección 3. Entregá código, migraciones, pruebas y documentación que puedan verificarse. Adaptá estos directorios al stack existente; no dupliques lógica ni mantengas dos fuentes de verdad.

**Estructura lógica de referencia (adaptable, no dogmática):**
```text
src/
  core/
    auth/                 # identidad, roles, permisos y contexto tenant/sucursal
    assistant/            # VoiceInterface, IntentEngine, ActionRegistry, policies
    audit/                # auditoría/correlación e integridad
    sync/                 # sincronización, conflictos e idempotencia
    config/               # feature flags y configuración por tenant/sucursal
  modules/
    cash/                 # cajas, sesiones, movimientos, arqueos, cierres
    branches/             # sucursales, asignaciones y alcance de Casa Central
    inventory/            # artículos, movimientos, archivo y borrado seguro
    gastronomy/            # comandas/mesas como adaptador de rubro
    pos/
    customers/
    team/
    reports/
    checkout/              # carrito, cotización, órdenes y checkout público
    payments/              # adaptadores de proveedor, webhooks y conciliación
    shipping/              # retiro, tarifas, zonas y adaptadores de transportistas
  shared/
    components/SortableTable/
    providers/             # STT/LLM/TTS, con adaptadores sustituibles
supabase/
  migrations/              # SQL numerado, aditivo e idempotente
  functions/               # funciones de servidor verificadas (checkout, pagos, webhook, transporte)
  tests/                   # RLS, RPC, migraciones y flujos transaccionales
tests/
  unit/
  integration/
  e2e/
docs/
  architecture/
  migrations/
  runbooks/
```

Si el producto se entrega como HTML único, mantené el código fuente modular y generá el HTML mediante el proceso de ensamblado existente. No copies manualmente funciones en múltiples archivos HTML ni rompas los repositorios/instaladores publicados.

**SQL y base de datos:** crear los archivos de migración reales con nombres numerados y fecha/propósito; añadir restricciones `NOT NULL`, claves foráneas compuestas donde corresponda, índices, unicidad por tenant/sucursal, checks de importes/estados, políticas RLS y RPC/funciones de servidor necesarias. Usar de manera consistente el identificador de comercio que exista en el repositorio (`comercio_id` o `tenant_id`, nunca ambos como fuentes de verdad). Las migraciones deben ser aditivas, idempotentes y probarse en una copia real de la base. Incluir datos/configuración inicial no sensible, verificación posterior, plan de compatibilidad de datos previos y pasos de reversión o recuperación. No entregar fragmentos SQL sueltos como sustituto del archivo aplicable. No aplicar limpieza destructiva sin respaldo y orden expresa.

**Backend y servicios:** definir contratos y servicios de dominio para cada operación; validar sesión/JWT, rol, permiso granular, tenant, sucursal, estado de caja, reglas contables y estado del módulo. Para pagos, transferencias, cierres y borrados, usar transacciones, idempotencia y auditoría. La IA invoca estos servicios mediante acciones registradas; no tiene acceso SQL directo.

**Frontend:** reutilizar componentes, estados y validadores; ocultar opciones no disponibles sin confiar en esa ocultación para seguridad. Implementar estados claros de espera, confirmación, ejecución, error, sincronización pendiente y resultado confirmado. Todas las tablas usan el componente de ordenamiento reutilizable.

**Pruebas y documentación exigidas:** entregar matriz requisito → archivo/función/tabla → permiso → prueba → resultado; pruebas de migración/RLS/RBAC, flujos felices, errores, concurrencia, duplicados, modo offline y regresión; diagrama de arquitectura; diccionario de datos; mapa de roles/acciones; guía de configuración/secretos; instrucciones de despliegue y rollback; limitaciones y dependencias externas. Si algo no puede ejecutarse por falta de credenciales, hardware o cuenta externa, indicar exactamente qué quedó pendiente y no marcarlo como probado.

### 4.18 Checkout online opcional estilo e-commerce (tipo Tienda Nube) — convive con WhatsApp

**Propósito:** incorporar compra directa en el menú/catálogo público y preparación de envíos locales o nacionales sin alterar el flujo actual de pedidos por WhatsApp. Es una capacidad opcional por comercio/tenant y, cuando corresponda, sucursal/canal. Debe poder construirse desde el inicio, pero permanecer apagada por defecto hasta configurar proveedor, tarifas, políticas y pruebas. No implica copiar código, marca ni interfaz propietaria de otra plataforma: se implementa un flujo e-commerce equivalente con diseño propio del producto.

#### 4.18.1 Modo de venta y configuración administrativa
- En Administración → Menú público / Ventas online mostrar un selector accesible **Modo de venta** con, como mínimo: `whatsapp` (flujo actual) y `online_checkout`. Valor por defecto `whatsapp`. Si la arquitectura del comercio requiere ambos canales, permitir `whatsapp_and_checkout` sólo después de especificar qué canal se ofrece y comprobar que no se creen pedidos duplicados; no retirar el botón de WhatsApp por defecto.
- El cambio de modo requiere rol `store.settings.manage` (o permiso equivalente ya existente), comprobación en backend, auditoría y vista previa antes de publicar. El frontend oculta los controles no aplicables, pero el backend valida la bandera en cada solicitud. Si falta una configuración requerida, el checkout no se anuncia al público y se muestra al administrador el requisito pendiente.
- Parámetros no secretos de tienda: modo de venta, proveedor habilitado, ambiente (`sandbox`/`production`), medios de entrega activos, reglas/tarifas de envío, provincias/códigos postales atendidos, horarios y punto de retiro, mensaje de confirmación, moneda y reglas comerciales revisadas. Validar tipos, rangos, longitud, enumeraciones y coherencia; no aceptar JSON libre sin esquema.
- Proveedor de pagos: preferir una interfaz/contrato `PaymentProviderAdapter` reemplazable (ej. Mercado Pago u otro proveedor admitido y verificado). La clave pública que el proveedor permita publicar puede entregarse al frontend si realmente es pública; el `Access Token`, claves privadas, secretos de webhook y refresh tokens **nunca** se devuelven al navegador, se guardan en HTML, en `localStorage`, en configuración genérica legible, en backups/exportaciones del comercio ni en logs. Guardarlos en el gestor de secretos del servidor o almacén cifrado separado de acceso restringido; en la base guardar sólo `secret_ref`, proveedor, ambiente, estado de conexión, fecha de última prueba y metadatos no sensibles. Campo de secreto tipo write-only: al guardar se vacía; al volver sólo se ve “configurada/no configurada”, fecha y opcionalmente últimos caracteres enmascarados autorizados; jamás se vuelve a revelar el valor completo.
- Si por compatibilidad se conserva el nombre lógico `mercadopago_keys`, dicho objeto no podrá incluir ni exponer el Access Token. Modelar por separado `public_key` y `credential_secret_ref`. Rotación/revocación sin registrar el valor secreto.
- Métodos de entrega configurables e independientes: (a) retiro en local, activable/desactivable, con sucursal/punto, horarios e instrucciones; (b) envío local/cadetería con tarifa fija o por zonas configuradas y reglas de cobertura; (c) envío nacional por provincia/código postal, tabla de tarifas o adaptador de transportista (ej. Andreani, Correo Argentino, OCA) sujeto a disponibilidad y documentación oficial vigentes `[VERIFICAR]`. No inventar cobertura, costo, etiqueta, tracking ni compatibilidad de API. Las URLs de transportistas deben provenir de configuración administrativa validada y de una lista de destinos permitidos; no aceptar URLs arbitrarias proporcionadas por el comprador.
- Permitir reglas explícitas de costo fijo, zona, rango postal, peso/volumen si existe soporte real, compra mínima o envío bonificado sólo si el comercio las configura. Las tarifas deben incluir versión, moneda, alcance, vigencia y auditoría. Si una API no responde, informar que el envío no pudo cotizarse; no inventar una tarifa ni confirmar el pedido con un precio desconocido. No modificar una tarifa ya aceptada en una orden guardada.
- El módulo completo tiene bandera de feature por tenant y, si aplica, por sucursal/canal. Apagado: conservar el menú y carrito existentes, el enlace/botón “Enviar pedido por WhatsApp” y las rutas publicadas sin cambios visuales involuntarios.

#### 4.18.2 Experiencia de compra en el menú público
- En `whatsapp`, al terminar el carrito se mantiene el comportamiento actual: botón “Enviar pedido por WhatsApp”. Ese pedido sigue siendo una solicitud y no una venta confirmada hasta que el negocio la convierta por su proceso existente.
- En `online_checkout`, el botón “Comprar” inicia un checkout responsive de tres etapas con indicadores de progreso y opción de volver sin perder los datos no sensibles:
  1. **Datos del comprador:** nombre, email y teléfono; validar formato, tamaño y normalización. Solicitar sólo datos necesarios y mostrar privacidad/consentimientos aplicables. Evitar revelar si un email/teléfono pertenece a una persona registrada.
  2. **Entrega:** retiro en local o envío habilitado; pedir dirección, localidad, provincia y código postal sólo cuando corresponda. Calcular una tarifa con reglas del servidor o adaptador de transporte; mostrar costo, tiempo estimado sólo cuando tenga fuente y dirección resumida antes de confirmar. La selección de Salta u otra provincia es configuración del comercio, no una regla fija del código.
  3. **Pago online:** iniciar el proveedor configurado usando checkout hospedado/redirección o componentes oficiales tokenizados. No recoger, procesar ni almacenar PAN, CVV, PIN ni credenciales de tarjeta en Sistema VB. Mostrar importe final, moneda, productos, descuentos, entrega y políticas antes de enviar al proveedor.
- Recalcular productos, precios, descuentos, stock según reglas actuales, envío, impuestos configurados y total en backend; no confiar en precios/totales calculados por JavaScript ni en los datos enviados por el comprador. Usar centavos enteros o DECIMAL exacto, nunca `float`. La orden conserva snapshots inmutables de nombre/SKU/presentación, cantidad, precio aplicado, descuentos, tarifa, dirección de entrega y reglas aceptadas; no cambia si luego se edita el catálogo.
- Una orden inicial queda `pending_payment` / `pago_pendiente` antes de dirigir al proveedor. Generar identificador interno impredecible y referencia externa idempotente; aplicar rate limiting, límites de unidades/importe, verificación de stock y protección contra bots. El link de pago no contiene secretos ni datos personales innecesarios.
- La URL de retorno del proveedor sólo informa al comprador y permite consultar el estado desde el servidor. **Nunca** marca un pago como aprobado. Hasta recibir y verificar la confirmación, mostrar “Pago pendiente de confirmación”; no preparar ni despachar como pagado.
- Si el pago falla, expira o el comprador abandona, preservar el estado real y permitir reintentar de forma idempotente sin crear cobros/órdenes duplicados. Liberar reservas temporales según regla de negocio versionada; no borrar historial.

#### 4.18.3 Modelo de datos y migraciones
- Antes de crear tablas, inspeccionar el esquema real. Reutilizar las entidades existentes si cubren el dominio; no crear una segunda fuente de verdad para menú, productos, clientes, pagos o pedidos. Si Sistema VB usa la tabla genérica `registros`, integrar las nuevas colecciones en la lista blanca y políticas; si usa tablas relacionales, generar las migraciones SQL correspondientes. Los nombres siguientes son contratos lógicos orientativos que deben mapearse al esquema existente, no una orden para duplicar tablas.
- Configuración de venta (`store_sales_settings` o equivalente): `tenant_id`/`comercio_id`, `branch_id` nullable sólo si la configuración puede heredarse del comercio, `modo_venta` con `CHECK`/enum, `checkout_enabled`, `provider`, `environment`, configuración pública no secreta, referencia al secreto en el backend, `shipping_config` validada, moneda, `version`, `created_at`, `updated_at`, `updated_by`. No guardar el secreto de pago dentro del JSON general.
- Órdenes (`orders`/`ordenes`, reutilizar si ya existe): ID opaco, tenant y sucursal, código público de seguimiento no enumerable, clave idempotente, comprador mínimo necesario, dirección protegida, totales desglosados en enteros/DECIMAL, moneda, snapshots de líneas y reglas, fuente/canal (`whatsapp`, `checkout` u otro), referencias al proveedor sin secretos, timestamps, versión optimista y `created_by` cuando aplique. Índices por tenant, fecha, estado, sucursal y clave idempotente. Las consultas públicas sólo exponen lo mínimo por token de pedido firmado/de suficiente entropía.
- Separar estados que representan dimensiones diferentes: `payment_status` (`pending`, `approved`, `rejected`, `cancelled`, `refunded`, `charged_back`, `unknown`) y `order_status` (`draft`, `pending_payment`, `confirmed`, `preparing`, `ready_to_ship`, `shipped`, `delivered`, `cancelled`). Los estados externos se mapean mediante adaptador; no avanzar un pedido a despacho por una notificación incompleta. Mantener un historial append-only de cambios de estado con actor, motivo, fuente, ID de evento y fecha.
- Líneas de orden (`order_items`/equivalente): snapshot del producto/variante, cantidad validada mayor a cero, precio unitario, descuento e importe en centavos, referencia de producto nullable si se elimina/archiva más adelante; el histórico se conserva aunque el artículo ya no exista.
- Intentos de pago (`payment_attempts`): tenant, orden, proveedor, ambiente, referencia del proveedor, clave idempotente, importe/moneda esperados, estado, timestamps, errores normalizados sin secretos. Único por tenant/proveedor/clave idempotente y restricciones que impidan asociar un pago de otro tenant.
- Eventos de webhook (`payment_webhook_events` o equivalente): proveedor, ambiente, ID de evento/notificación, pago/orden referidos, fecha de recepción, resultado de validación y procesamiento. Clave única adecuada por proveedor/ambiente/evento (y, donde corresponda, por pago/transición) para idempotencia. Almacenar únicamente el cuerpo mínimo redactado/hash necesario para diagnóstico, sujeto a límites de tamaño y retención; nunca conservar tokens o datos de tarjeta. No confiar en un ID de evento aislado como prueba de pago.
- Entrega (`shipping_quotes`, `shipments` o equivalente): versión de tarifa/cotización y vencimiento, método, destino mínimo necesario, costo, transportista, tracking y estado. El tracking sólo se guarda cuando el transportista/proceso lo confirma. Dirección y contacto se cifran o se restringen a roles que realmente los necesitan.
- Todos los registros tienen tenant y alcance de sucursal cuando corresponda, claves foráneas compuestas que incluyen tenant cuando sea viable, restricciones, índices, RLS y auditoría. Evitar borrado en cascada de órdenes, pagos, comprobantes o eventos históricos. Migraciones numeradas, aditivas, idempotentes, probadas en una copia, con estrategia de rollback/restauración.

#### 4.18.4 Flujo backend, pago y webhook
1. `POST /checkout/quote` (o equivalente): valida que el checkout esté activo para el tenant, recibe carrito y entrega solicitada, obtiene productos/precios desde la fuente de verdad, aplica reglas vigentes y devuelve una cotización identificada con expiración. No reservar ni debitar dinero sólo por consultar.
2. `POST /checkout/orders`: valida sesión pública/token CSRF donde corresponda, rate limits, esquema de entrada, cotización vigente, tenant/sucursal, existencia y estado de productos, cantidad, límites de stock, descuentos y tarifa. Recalcula importes servidor a servidor; crea orden e historial en transacción con idempotencia. Responde sólo con ID público/token de consulta limitado y datos de redirección no secretos.
3. `POST /checkout/payments/session` (o equivalente): sólo para orden válida y pendiente; crea preferencia/sesión mediante adaptador de pago desde servidor, importe y moneda derivados de la orden guardada, referencia externa idempotente y URL de retorno fija/verificada. No permite enviar un monto arbitrario desde el frontend. Persistir la referencia antes o en una transacción de estados bien definida; reintentos consultan la sesión/pago existente antes de crear otro.
4. Endpoint público de webhook por proveedor: valida la autenticidad usando el mecanismo vigente documentado oficialmente `[VERIFICAR en documentación oficial del proveedor]`, secreto guardado en servidor, firma/headers y marca de tiempo/replay cuando el proveedor lo soporte. Aplicar límites de tamaño, rate limiting y respuestas no verbosas. No confiar en IP allowlist como única prueba ni en un webhook sin firma/consulta confiable.
5. Obtener el detalle del pago por el API oficial del proveedor desde el backend; validar cuenta receptora, ambiente, ID, tenant/orden, referencia externa, estado final, monto exacto, moneda, método y relación con la orden. Si alguno no coincide, registrar incidente, ponerlo en revisión y no acreditar ni despachar. El webhook no recibe permisos por ser público.
6. En una sola operación transaccional/idempotente, registrar el evento, bloquear o actualizar la orden de manera segura, cambiar `payment_status` y el historial sólo si la transición es válida; no procesar dos veces el mismo evento. Un evento viejo no puede retroceder un estado final válido. Estados ambiguos, firma inválida, importes distintos o proveedor no disponible quedan pendientes/de revisión, nunca “aprobados”.
7. Confirmar automáticamente “Pagado — listo para preparar/despachar” sólo después de validación autoritativa. La preparación/despacho exige que la orden y su entrega estén válidas; el pago aprobado no significa que el paquete fue enviado. Reembolsos, contracargos y cancelaciones necesitan flujo separado, permisos, conciliación y acciones compensatorias auditadas; no editar el histórico de la orden para ocultarlos.
8. En caso de timeout, consulta el estado del proveedor antes de repetir una operación de pago. Los webhooks pueden repetirse, llegar fuera de orden o no llegar; implementar reconsulta/reconciliación programada y una bandeja de excepciones. El estado del módulo de pagos no altera por sí solo el indicador general de conexión/nube de Sistema VB.
9. Ningún endpoint de webhook acepta como autoridad `approved`, monto, moneda o tenant suministrado por el cliente. Una redirección exitosa, un screenshot, un mensaje del comprador o una respuesta generada por IA no acreditan el pago.

#### 4.18.5 Panel de órdenes y operación
- Incorporar Administración → Órdenes online si el módulo está activo y el rol tiene acceso. Listado con búsqueda/ordenamiento reutilizable, filtros por fecha/sucursal/pago/envío, detalle, productos, importes, datos de entrega necesarios, historial cronológico y referencia de pago parcialmente enmascarada.
- Mostrar estados diferenciados y legibles: “Pago pendiente”, “Pago aprobado”, “Preparando”, “Listo para despachar”, “Enviado”, “Entregado”, “Pago rechazado”, “Reembolso/contracargo en revisión”. El distintivo **“Pagado — listo para despachar”** sólo aparece si el estado fue verificado en backend y la orden aún no fue despachada/cancelada.
- Mostrar dirección completa y etiqueta de envío sólo a personal autorizado que la necesita para preparar/despachar; ocultarla en listados públicos, logs, notificaciones amplias y roles no autorizados. Las etiquetas se generan sólo mediante proveedor/proceso configurado; no fingir una etiqueta descargable si no hay integración real.
- Acciones manuales de cambiar a preparado/enviado, registrar tracking, cancelar, reembolsar o marcar entrega validan permiso específico y estado actual, piden confirmación según impacto y se auditan. Un usuario no puede marcar manualmente “pagado” salvo proceso de conciliación manual explícito con permiso separado y justificante.
- Añadir reportes de órdenes, ventas cobradas, pendientes, rechazadas, costos de envío y devoluciones, sin doble contabilización de la orden, el cobro y los movimientos de caja. Un pago externo se refleja en reportes conforme a la política contable/configurada; no crear automáticamente un ingreso de caja física si no ingresó efectivo. El módulo de caja conserva la clasificación financiera obligatoria de 6.10.

#### 4.18.6 Compatibilidad con el asistente conversacional y modo offline
- Registrar en `ActionRegistry` acciones de consulta/preparación de orden donde tenga sentido (por ejemplo `getOrderStatus`, `prepareCheckoutOrder`, `getShippingQuote`). La IA puede preparar un borrador, resolver campos faltantes o informar estado, pero no puede declarar pagado, forjar eventos, modificar la cuenta del proveedor ni marcar despachado sin pasar por las herramientas protegidas.
- Operaciones financieras sensibles siempre se ejecutan en backend con identidad y permiso; una orden preparada por voz/texto requiere confirmar productos, dirección, entrega y total antes de crearla. No dictar ni transcribir números de tarjeta, CVV, tokens o secretos al proveedor de IA. No autorizar pagos sólo con una frase o voz reconocida.
- En modo offline no prometer cotización actualizada, checkout aceptado, pago aprobado ni etiqueta. Se puede guardar un borrador local seguro si la política lo permite, claramente marcado “Pendiente de conexión; todavía no enviado”, sin iniciar o acreditar pagos hasta confirmar con el servidor. La vuelta de conexión reconcilia por idempotencia y evita órdenes duplicadas.

#### 4.18.7 Entregables específicos
Entregar cambios reales en administración del menú, frontend de checkout, adaptadores de pago/transporte, servicios y endpoints de servidor, migraciones SQL, políticas RLS/RBAC, actualización de sincronización/listas blancas/respaldo/exportación, configuración de secretos, pruebas unitarias/integración/E2E, diagrama de estados, mapa de datos y guía de sandbox/producción. La habilitación productiva requiere cuenta del propietario, credenciales por canal seguro, URLs/webhooks verificados, prueba real de pago y reconciliación. Sin esos insumos, mantener apagado y declarar explícitamente qué está pendiente.



### 4.19 Tarjetas de fidelización en Apple Wallet / Google Wallet y avisos automáticos a clientes

**Objetivo:** permitir que el cliente reciba su tarjeta digital de fidelización y la guarde por decisión propia en Apple Wallet o Google Wallet, y que el comercio configure avisos automáticos relevantes (por ejemplo, saldo/sellos actualizados, premio disponible o vencimiento) desde un motor central y auditable. La capacidad es opcional por comercio, sucursal y programa de fidelización. No debe romper la tarjeta web actual ni el pedido por WhatsApp.

#### 4.19.1 Experiencia del cliente y envío de la tarjeta
- En Fidelización/Clientes, los usuarios autorizados pueden elegir **Enviar tarjeta digital** por un canal configurado (por ejemplo, correo o WhatsApp Business oficial) o generar un enlace seguro para que el cliente la obtenga desde el menú público. El cliente también puede iniciar el proceso desde su área de tarjeta digital.
- El mensaje debe contener instrucciones claras y enlaces oficiales **Agregar a Apple Wallet** y/o **Guardar en Google Wallet** sólo cuando cada plataforma esté habilitada y la tarjeta haya sido generada correctamente. No afirmar que se guardó: el cliente debe completar y aceptar el flujo de la wallet. Estados internos separados: `not_requested`, `link_created`, `sent/accepted_by_provider`, `pass_generated`, `save_flow_opened` si técnicamente medible, y `saved/registered` únicamente si la plataforma ofrece una señal verificable. Si no hay confirmación, mostrar “enlace enviado” o “pendiente”, nunca “guardada”.
- El envío puede ser manual por un operador autorizado o automático al alta/consentimiento en el Club, según la configuración. El cliente debe poder volver a solicitar la tarjeta sin crear una membresía duplicada.
- La tarjeta digital es una representación del programa de fidelización; la fuente de verdad de puntos, sellos, categoría y premio sigue siendo el ledger del Sistema VB. La wallet nunca acredita ni canjea beneficios por sí sola.
- Incluir alternativa web accesible y código QR cuando la plataforma no esté disponible o el cliente no tenga una wallet compatible. No bloquear la tarjeta de fidelización existente por no usar una wallet.

#### 4.19.2 Apple Wallet y Google Wallet: implementación por adaptadores
- Crear interfaces independientes, por ejemplo `WalletPassProvider`, con adaptadores `AppleWalletPassAdapter` y `GoogleWalletPassAdapter`. No mezclar credenciales, IDs, APIs ni reglas de una plataforma con la otra ni con los datos genéricos del programa.
- **Apple Wallet:** generar el pase de tipo tarjeta de tienda (`storeCard`) o el tipo compatible vigente, con identificador de pase y número de serie estables por tarjeta. Firmar cada `.pkpass` en backend con el certificado y la clave privada requeridos por Apple; la clave privada, certificados y tokens de autenticación jamás llegan al HTML, navegador, IndexedDB, exportaciones o logs. Distribuir por descarga segura/web/email según soporte oficial. Si se habilitan actualizaciones, implementar el servicio web de registro, consulta, entrega de pase actualizado y baja de registro; guardar sólo las relaciones de registro necesarias y autenticar cada endpoint según las instrucciones vigentes de Apple.
- **Google Wallet:** usar la API oficial y objetos/clases de fidelización del emisor habilitado; crear o actualizar el objeto del socio mediante backend y entregar el enlace oficial de guardado generado con el mecanismo firmado admitido por la API. Las credenciales del emisor/cuenta de servicio y claves de firma permanecen en servidor. No suponer que un enlace por sí solo significa que el usuario completó el guardado.
- Revisar y confirmar documentación oficial, cuentas de desarrollador/emisor, permisos, certificaciones, cuotas y limitaciones actuales antes de producción: Apple Wallet `https://developer.apple.com/documentation/walletpasses` y distribución/actualización `https://developer.apple.com/documentation/walletpasses/distributing-and-updating-a-pass`; Google Wallet `https://developers.google.com/wallet` y referencia de objeto de fidelización `https://developers.google.com/wallet/reference/rest/v1/loyaltyobject`. Marcar `[VERIFICAR]` cualquier detalle dependiente de políticas, cuentas o versiones de API.
- Los pases pueden mostrar únicamente información mínima: marca, nombre público del programa, identificador opaco de socio, saldo/sellos o premio cuando corresponda, fecha de vigencia y código de barras/QR. No incluir DNI, domicilio, fecha de nacimiento, teléfono, correo, tokens de sesión, secretos, ni datos sensibles. El QR o código no debe contener información personal en claro ni ser una autorización de canje autosuficiente.
- Validar los canjes en el servidor: código firmado o identificador opaco con rotación/expiración según riesgo, límites de uso, verificación de tenant/programa/cliente/estado y prevención de repetición. Para un canje de un solo uso, consumir el token en una transacción atómica. La lectura de una captura de pantalla no reemplaza la validación del servidor.
- **Actualización:** cuando cambien puntos/sellos, nivel, premio o vigencia, actualizar la representación web y, si se implementó la capacidad oficial, actualizar el pase guardado en la wallet. Las notificaciones de actualización propias de una wallet no deben confundirse con mensajes de marketing o con la entrega de un email/WhatsApp. Si la plataforma no confirma entrega/actualización, dejar estado pendiente y mostrar la fecha de última sincronización conocida.
- Las funciones de Apple/Google tienen requisitos de cuenta, firma, permisos, dispositivos y plataforma; no asegurar compatibilidad universal ni simular producción. Mantener sandbox/demo claramente rotulado y pases de ejemplo sin beneficios reales.

#### 4.19.3 Avisos automáticos: reglas configurables
- Agregar una pantalla **Administración → Fidelización → Avisos automáticos** y, cuando tenga sentido, centralizarla como **Sistema → Comunicaciones** usando un único componente reutilizable. Sólo roles autorizados pueden crear/editar/publicar reglas; el servidor valida permisos, tenant, alcance de sucursal, límites y estado de consentimiento.
- Permitir reglas con: evento disparador; audiencia y criterios de elegibilidad; canal/es disponibles; plantilla versionada; fecha/hora/zona horaria; ventanas de silencio; límite por persona y canal; cooldown; prioridad; caducidad; estado de prueba/activo/pausado; responsable y auditoría. Las campañas deben tener vista previa, envío de prueba y estimación de destinatarios antes de activarse.
- Triggers iniciales configurables, no todos activos por defecto: alta/activación del Club; tarjeta lista para guardar; puntos/sellos acreditados; premio alcanzado; premio o cupón por vencer; cumpleaños si corresponde legalmente y hay permiso; membresía/plan por vencer o pago pendiente; recordatorio de turno, reserva u orden sólo si el módulo de rubro lo soporta; inactividad de fidelización con consentimiento comercial. Reutilizar eventos reales del ERP; no inferir compras, saldo, cumpleaños o estado de pago desde el texto de un mensaje.
- Canales por adaptador: correo transaccional; WhatsApp Business API oficial; SMS mediante proveedor habilitado; notificación web/PWA únicamente cuando exista soporte real y consentimiento explícito del navegador; avisos/actualizaciones específicos de Wallet sólo mediante capacidades documentadas y habilitadas por la plataforma. Un enlace `wa.me` que abre WhatsApp no es envío automático. No usar scraping, automatización de WhatsApp Web, listas compradas ni gateways no autorizados.
- Separar **mensajes operativos/transaccionales** (por ejemplo, confirmación de una acción solicitada o estado de una tarjeta) de **marketing/promocionales**. Mantener consentimiento granular por finalidad y canal con versión, fecha, origen, texto aceptado y revocación. No enviar marketing sin consentimiento válido; no convertir el consentimiento del Club, la recepción de una tarjeta o el consentimiento transaccional en permiso de publicidad. Respetar bajas, lista de supresión, políticas de plantilla del proveedor y normativa aplicable `[VERIFICAR]`.
- Incluir centro de preferencias accesible para seleccionar canales, frecuencia y tipos de aviso, revocar consentimiento comercial y solicitar baja. Procesar la baja de forma idempotente e inmediata para campañas nuevas; una baja de marketing no debe suprimir avisos estrictamente operativos que se deban al usuario, según la política legal verificada.
- Control de frecuencia: máximo configurable por canal/cliente, ventanas de silencio y zona horaria, deduplicación de eventos y prevención de campañas repetidas. No establecer valores comerciales universales como verdad fija: proponer valores iniciales conservadores configurables y mostrar claramente la configuración efectiva.
- Las notificaciones automáticas deben originarse en eventos confirmados del servidor; no enviar por simples cambios visuales, eventos pendientes, ventas no confirmadas ni datos locales que todavía no se sincronizaron. Para wallet, actualizar el saldo únicamente después de confirmar el movimiento de fidelización en el ledger.

#### 4.19.4 Cola, estados, datos y ejecución fiable
- Implementar `NotificationService` / `NotificationProviderAdapter` y patrón transactional outbox: en la misma transacción del evento de negocio insertar una tarea de comunicación; un worker/función programada independiente procesa la cola aunque ningún navegador esté abierto. Si no existe el scheduler necesario, declararlo como dependencia pendiente y no simular envíos automáticos.
- Estados mínimos de entrega: `queued`, `processing`, `accepted_by_provider`, `sent`, `delivered`, `read` (sólo si el proveedor lo reporta), `failed`, `suppressed`, `cancelled`, `unknown`. Mapear cada canal a estados que realmente informe. “Aceptado por proveedor” no es “entregado”; no inventar confirmaciones de lectura.
- Cada trabajo tiene ID idempotente derivado del evento de negocio, regla, canal y destinatario pseudonimizado; límite de reintentos con espera exponencial y jitter, cola de fallos definitivos (DLQ), manejo de rate limits, reconsulta cuando aplique y protección contra tormentas de reintentos. Los reintentos no duplican mensajes ni beneficios. Un proveedor caído no bloquea ventas, fidelización, sincronización ni la nube principal.
- Modelo lógico a mapear al esquema actual (no crear tablas duplicadas si existe equivalente): `wallet_passes` (tenant, cliente, plataforma, ID opaco de pase, versión, estado, referencia de proveedor y fechas); `wallet_registrations` si la plataforma soporta actualización registrada; `notification_preferences` (cliente, finalidad/canal, consentimiento y revocación); `notification_templates` (canal, idioma, versión y estado); `notification_rules` (trigger, audiencia, horario, límites y canal); `notification_outbox/jobs` (evento, dedupe key, estado, programado, intentos y próxima ejecución); `notification_delivery_events` (referencia externa, estado, fecha y error normalizado). Todas las entidades quedan aisladas por tenant y, cuando aplique, sucursal, con RLS, claves foráneas, índices, restricciones y política de retención.
- No almacenar credenciales en tablas de configuración accesibles al cliente. Guardar sólo referencias a secretos del servidor; para contraseñas de proveedor, certificados y claves de firma aplicar almacenamiento secreto/cifrado, rotación y revocación. Una tabla que almacene la configuración pública nunca contiene private keys, Access Tokens, bearer tokens, claves de APNs, credenciales de cuenta de servicio o `authenticationToken` revelables.
- Tratar correo, teléfono, tokens de enlace, IDs externos, direcciones y contenido del mensaje como datos protegidos. Minimizar contenido en logs; nunca registrar tokens completos, credenciales o el cuerpo íntegro de mensajes sensibles. Evitar que un ID secuencial permita enumerar miembros o tarjetas.

#### 4.19.5 Enlaces, autenticación y privacidad
- Los enlaces de entrega/guardado deben usar tokens aleatorios con alta entropía, ámbito limitado a un único tenant, cliente, tarjeta y propósito; vencimiento corto configurable; canje de un solo uso o repetible sólo cuando el diseño lo requiera expresamente; invalidación, rotación, rate limiting y no enumeración. Guardar hash del token cuando sea viable; no incluir puntos, teléfono, email ni ID interno en query strings.
- El endpoint valida servidor-side la identidad/posesión del enlace, estado del socio, vigencia del programa y que el pase pertenezca al tenant. Respuestas genéricas no revelan si existe una cuenta; evitar open redirects, URLs de destino arbitrarias, phishing de dominios o enlaces hacia tenants distintos.
- Los datos enviados a terceros se limitan al mínimo necesario, con proveedor, finalidad, ubicación/retención y acuerdos requeridos documentados. Evaluar privacidad y base legal por jurisdicción y tipo de comunicación `[VERIFICAR]`. No enviar categorías sensibles, deuda, compras privadas o datos financieros en notificaciones visibles en pantalla bloqueada.
- Cambios de diseño/plantilla, activación de reglas, exportación de destinatarios, rotación de certificados y acciones masivas requieren permiso granular y auditoría. Para envíos masivos: previsualización, límites diarios por tenant/proveedor, confirmación humana cuando corresponda y botón de pausa/cancelación de cola.

#### 4.19.6 Integración con fidelización y resto del ERP
- Los nuevos módulos reutilizan Clientes, Club, libro mayor de puntos/sellos, cupones, membresías, correo, WhatsApp y auditoría existentes. No se crea una base paralela de clientes, puntos, consentimientos o membresías.
- Exponer acciones del `ActionRegistry` sólo donde tenga sentido y según rol, por ejemplo `sendLoyaltyCard`, `createWalletSaveLink`, `getWalletPassStatus`, `previewNotificationRule`, `sendTestNotification`, `pauseNotificationRule` y `getNotificationDeliveryStatus`. Una orden por voz no debe disparar campañas masivas ni revelar datos de clientes; las acciones masivas requieren permisos reforzados, vista previa y confirmación explícita.
- Con nube deshabilitada, la tarjeta web actual sigue funcionando; wallet/notificaciones externas se muestran como “Pendiente de configuración” o deshabilitadas. No encolar una notificación externa como entregada cuando sólo quedó guardada localmente. Al recuperar conexión, sincronizar eventos de forma idempotente y respetar las bajas más recientes.

#### 4.19.7 Entregables y dependencias
Entregar migraciones SQL y políticas RLS, servicios y adaptadores de cada plataforma/canal, plantillas administrables, interfaz de preferencias, cola/worker programado, endpoints de registro/actualización cuando correspondan, gestión segura de certificados/secretos, auditoría, guía de entorno de pruebas y producción, pruebas automatizadas y matriz de compatibilidad. La producción requiere cuentas, permisos, certificados, dominios HTTPS, credenciales y opt-ins reales según cada proveedor. Si una dependencia no está configurada, la característica queda apagada y su estado se declara sin simular éxito.

Referencias oficiales de implementación a revisar durante el desarrollo: Apple Wallet `https://developer.apple.com/documentation/walletpasses`; Apple distribución/actualización `https://developer.apple.com/documentation/walletpasses/distributing-and-updating-a-pass`; Apple web service de actualización `https://developer.apple.com/documentation/WalletPasses/adding-a-web-service-to-update-passes`; Google Wallet API `https://developers.google.com/wallet`; Google Wallet Loyalty Object `https://developers.google.com/wallet/reference/rest/v1/loyaltyobject`. Verificar requisitos, límites y políticas vigentes de cada plataforma antes de publicar.

---

---

## 4.20 VENTAS, PAGOS MIXTOS, VUELTO Y CUENTA CORRIENTE PARCIAL (V26.1)

**Objetivo.** Una venta se puede cobrar con **varios medios a la vez** (p. ej. $ 60.000 = $ 40.000 efectivo + $ 20.000 cuenta corriente) sin que la caja, el arqueo ni la cuenta del cliente se desfasen. Es una extensión del cobro existente (4.18 no cambia); no se duplica ninguna pantalla: el mismo modal "Confirmar cobro" gana el modo **Dividir el pago (mixto)**.

**Reglas obligatorias.**
1. **Identificación.** Cuenta corriente (total o parcial) exige un **cliente identificado**; nunca consumidor final anónimo. Se respeta su límite de crédito sobre la parte a cuenta corriente.
2. **Suma exacta.** La suma de los medios imputados + la parte a cuenta corriente debe dar **exactamente** el total (centavos enteros). Si faltan o sobran centavos, el botón Cobrar no avanza y se muestra "Faltan $ X / Sobran $ X". Hay un botón **Resto** por línea. Un medio no se repite; QR/MODO (cobro digital pendiente) no se combinan con otro medio.
3. **Alerta de vuelto.** En efectivo, "Recibe en mano" es opcional; si es mayor que el importe imputado a efectivo se muestra una **alerta grande, role="alert"**, con el vuelto exacto ("VUELTO A ENTREGAR $ X") en el cobro, en el comprobante y en el ticket. Si es menor, se bloquea con mensaje claro. El vuelto **nunca** forma parte de lo imputado.
4. **Caja y arqueo.** El efectivo esperado suma **sólo el dinero que entró** (importe imputado a efectivo, neto de vuelto). La parte a cuenta corriente **no** suma a efectivo ni a "cobrado" del turno. El cierre informa por separado: *COBRADO REAL* · *A CUENTA CORRIENTE (deuda de clientes, no entró a caja)* · *vuelto entregado*, y el total vendido.
5. **Cuenta corriente.** Al confirmar se genera automáticamente un **débito** por el saldo (auditoría `CTA_CTE_DEBITO`). El estado de la venta queda **Pagada / Pago parcial / Pendiente de cobro** con el saldo vinculado; el resumen del cliente se actualiza al instante con el libro (débitos, créditos, saldo corrido). Anular la venta saca el débito. El saldo **se deriva** de ventas y cobros (no existe un segundo saldo que pueda desfasarse).
6. **Atomicidad.** Toda validación (stock, límite, suma, cliente, cupón, sello) ocurre **antes** de mutar; una venta rechazada no deja stock, caja, deuda ni numeración huérfanos. En la nube, `sincronizar()` valida cada venta en su propia sub-transacción; los importes derivados (`fiadoAmt`, `paid`, `balance`, `pstate`) los **calcula el servidor** y una venta con pagos registrados queda **inmutable** (se corrige con anulación / nota de crédito).
7. **Modelo de datos** (equivalente relacional de `registros`): `Ventas(id, n, ts, total, cust, status, pstate)` · `Detalle_Ventas = ventas.items[]` · `Pagos_Venta = ventas.pays[] {m, a, fee}` (a = importe imputado) · `Cuentas_Corrientes_Movimientos` = débitos (parte `fiado` de cada venta) + créditos (colección `fiado`, cobros de deuda), consultable con `cc_movimientos(comercio, cliente)`.
8. **Exportación y reportes.** La exportación de ventas agrega `pagos`, `a_cuenta_corriente` y `estado_pago`; el dashboard reparte cada venta mixta entre sus medios.
9. **Límite declarado.** El límite de crédito se valida en el mostrador (equipo); el servidor valida estructura, suma y cliente pero **no rechaza por límite** para no romper la venta sin conexión (se informa y se audita).

**Pruebas obligatorias:** 40.000 + 20.000 = 60.000; suma que no cierra (menos/más); cuenta corriente sin cliente; cliente inexistente; límite excedido; medio repetido; QR combinado; efectivo recibido menor; vuelto 10.000 (recibe 50.000 sobre 40.000); arqueo sólo con efectivo real; reporte de cierre con deuda separada; ficha del cliente con débito y saldo; cobro de deuda; anulación; reenvío adulterado desde el equipo; aislamiento A/B; 320/360 px. Implementadas en `t/v7.py`, `t/c16.py` y `supabase/tests/14-sql-tests.sql`.

## 4.21 PROVEEDORES Y COMPRAS (V26.2) — órdenes de compra, ingreso de mercadería atómico y cuenta corriente de proveedores

**Objetivo.** Gestionar proveedores, órdenes de compra y la recepción de mercadería **sin romper inventario ni caja**: una sola operación atómica suma el stock, actualiza el costo (el margen se recalcula solo) y registra la deuda con el proveedor o el egreso de caja/banco. Es un módulo aditivo que convive con 4.8 (lectura de facturas con IA: la carga revisada de una factura puede terminar en este mismo ingreso) y con 4.5 (caja). No se duplica ninguna pantalla, tabla ni función existente: se detecta antes (sección 12).

**Modelo de datos (tablas relacionales reales, todas con `tenant_id` → comercio, RLS, `created_at/updated_at/created_by`, restricciones y claves foráneas compuestas `(id, tenant_id)`).** Dinero en `numeric(14,2)` (pesos) en SQL/API y en **centavos enteros** en el estado del equipo; cantidades `numeric(14,3)`; nunca `float`.
- `proveedores`: razón social, CUIT **como texto de 11 dígitos sin guiones** (con dígito verificador validado, único por comercio), condición frente al IVA (*Responsable Inscripto / Monotributista / Exento*), correo, teléfono, dirección, `saldo_cuenta_corriente`, activo (archivo en lugar de borrado).
- `ordenes_compra` (+ `ordenes_compra_detalles`): número correlativo por comercio, proveedor, estado (*Borrador / Solicitada / Recibida / Cancelada*), total calculado **por el servidor**, fecha de emisión; el detalle guarda producto, cantidad y **costo pactado**.
- `ingresos_mercaderia` (+ `ingresos_mercaderia_detalles`): proveedor, orden vinculada (opcional), tipo y número de comprobante (*Factura / Remito*; único por proveedor y tipo, sin distinguir mayúsculas), fecha de recepción, condición (cuenta corriente o contado), medio, rubro, caja, total y, por renglón, **stock y costo antes/después**.
- `cuenta_corriente_proveedores`: libro **sólo-agregar** (triggers que impiden modificar o borrar): *Factura / Remito / Pago / Nota de Crédito*, monto, `saldo_acumulado`, referencia, medio, rubro, motivo. El saldo del proveedor es siempre la suma del libro (se prueba).
- El catálogo de productos vive en el almacén genérico del sistema (`registros`): `producto_id` **no** es clave foránea; lo valida la función. Un producto con órdenes o ingresos **no se borra, se archiva** (extiende la regla de 4.16).

**Operaciones (funciones del servidor `SECURITY DEFINER`, `search_path` fijo; DML directo revocado a `anon` y `authenticated`; sólo administrador y supervisor; mostrador/operador rechazados en el servidor).**
1. `proveedor_guardar` (alta/edición/archivo), `proveedores_listar` (búsqueda, estado de cuenta, orden por lista blanca de columnas —nunca texto libre en el `ORDER BY`—, paginación, comodines escapados).
2. `orden_compra_guardar` (nace *Borrador* o *Solicitada*; sólo se edita un Borrador; idempotente por clave), `orden_compra_estado` (Borrador→Solicitada/Cancelada, Solicitada→Cancelada; *Recibida* sólo por recepción).
3. **`procesar_recepcion` — transacción atómica única**: bloquea al proveedor (dos envíos simultáneos se ordenan), valida clave de idempotencia, comprobante duplicado, orden Solicitada del mismo proveedor y productos que pertenezcan a ella, total declarado vs. suma de renglones, fecha razonable, rubro válido para egreso (6.10) y, si es efectivo, **caja abierta**; luego **suma stock** (movimiento `smov` del servidor, conmutativo con las ventas de otras cajas), **actualiza el costo** (costo 0 = bonificación: no pisa el vigente), asienta la **Factura/Remito** en el libro, y si es **contado** asienta además el **Pago** y, en efectivo, crea el **egreso de caja** con el rubro; marca la orden *Recibida* y devuelve las **diferencias** (pedido vs. recibido, pactado vs. facturado). **Cualquier falla revierte todo** (stock, costo, libro, caja, orden).
4. `proveedor_pago_registrar` (no puede superar la deuda; medio y rubro obligatorios; efectivo exige caja abierta), `proveedor_nota_credito` (reduce la deuda, puede dejar saldo a favor; no mueve caja ni stock), `cuenta_proveedor` (libro) y `compras_snapshot` (lectura de todo para la pantalla).
5. **Idempotencia** por clave en recepciones, pagos, notas y órdenes (reintento, doble clic, caída de red: se devuelve lo ya guardado y nunca se duplica). Auditoría de cada operación. Hash/cierres sellados no se tocan.

**API REST (Edge Function delgada `api`, JSON de entrada y salida, sin secretos; reenvía el JWT del usuario y el comercio va en `X-Tenant-Id`; clave de idempotencia en `Idempotency-Key`).** `GET /proveedores` (filtros `q`, `estado`, `orden`, `dir`, paginación, con estado de cuenta) · `POST /proveedores` · `GET /proveedores/{id}/cuenta` · `GET /compras/ordenes` · **`POST /compras/orden`** · `POST /compras/orden/{id}/estado` · **`POST /compras/recepcion`** (carga masiva de renglones que dispara stock, costo y deuda/caja) · `POST /compras/pago` · `POST /compras/nota-credito`. Respuestas `{ok:true,data}` o `{ok:false,error:{codigo,mensaje}}`; 201 al crear (200 si la clave ya existía); 401/403/404/405/413/422/500/503 mapeados; CORS por lista de orígenes. Un único contrato (pesos, `snake_case`) para el servidor, la API y el equipo.

**Pantalla "Proveedores y compras" (Operación, permiso `purchases`: administrador y supervisor por defecto; los datos anteriores migran sin pisar lo que el dueño ya decidió).**
- Tablero neumórfico con **Total deuda a proveedores** (sólo saldos a pagar; el saldo a favor se muestra aparte) y **Órdenes pendientes de recepción**, más proveedores activos.
- **Tabla de proveedores** con búsqueda, filtro (activos / con deuda / al día / archivados) y **encabezados clicables con flechas ▲/▼** por nombre, saldo u otra columna (componente de ordenamiento de 4.15); en celular se ocultan las columnas secundarias.
- **Órdenes de compra**: alta con renglones dinámicos (producto con búsqueda, cantidad, costo pactado, subtotal en vivo), borrador o solicitar, editar, cancelar, ver y recibir.
- **Carga de remito**: buscador de proveedor, orden pendiente (precarga sus renglones), renglones dinámicos con **cantidad y costo actualizado** (muestra stock actual, cambio de costo y margen sólo a quien ve costos), tipo y número de comprobante, fecha, total declarado de control, cuenta corriente o contado (medio + **rubro obligatorio** + caja abierta), confirmación con el impacto en palabras y resultado con stock/costo antes→después y diferencias contra la orden.
- **Cuenta corriente**: libro con saldo corrido, ingresos de mercadería con detalle, **pago** y **nota de crédito**, exportación CSV/Excel con fórmulas neutralizadas.
- Campos numéricos sin "0" precargado y con selección al enfocar; áreas táctiles ≥ 44 px; sin desbordes de 320 a 1440 px.

**Dos motores, mismas reglas.** *Nube:* las operaciones se ejecutan en el servidor, requieren internet y **nunca fingen haber guardado** (sin conexión se avisa "no se guardó nada"); antes de operar se sincronizan los datos locales que el servidor necesita (productos, caja, rubros) y después se baja el stock/costo/caja resultante **sin contarlos dos veces**. *Local (demo o sin nube):* mismas validaciones sobre el estado del equipo, con retroceso completo ante cualquier falla. Las reglas de negocio no se escriben dos veces con significados distintos: el contrato es el mismo.

**Límites declarados.** Sin nube, la recepción no es transaccional contra otros equipos (no los hay). El producto es un dato del catálogo, no una clave foránea. No emite documentos fiscales de compra ni calcula retenciones/percepciones (la IVA/percepción de la factura se carga como dato de 4.8). Devolución de mercadería al proveedor: se registra la nota de crédito; el ajuste de stock es manual en Inventario.

**Pruebas obligatorias:** alta con CUIT válido/ inválido/ repetido · orden con total calculado por el servidor · recepción con y sin orden · diferencias pedido/recibido y pactado/facturado · costo que sube, que baja y costo 0 (bonificación) · **rollback total** si falla la caja (stock, costo, libro y orden intactos) · comprobante duplicado · repetir la misma clave (una sola vez) y **doble clic** · contado en efectivo sin caja abierta · contado con rubro vacío/incompatible/ajeno · pago mayor a la deuda · nota de crédito y saldo a favor · libro con saldo acumulado consistente · concurrencia (misma clave ×6; 8 comprobantes simultáneos sobre el mismo producto; 8 pagos simultáneos contra una deuda) · producto con compras no se borra · aislamiento A/B (un comercio no lee ni escribe en el otro) y piso de rol (mostrador/operador rechazados en el servidor) · API (401/400/403/404/405/422, CORS, idempotencia 201/200) · pantalla en demo y en nube (incluido stock sin doble conteo y sin conexión) · responsive 320/360/768/1440 · regresión completa de las suites anteriores.

---

## 4.22 MÓDULO MAYORISTA / MINORISTA CON TRAZABILIDAD INTEGRAL Y CONTROL ADMINISTRATIVO-CONTABLE (V26.4)

**Estado: ESPECIFICACIÓN. Nada de 4.22 está implementado al 2026-10-19** (matriz 4.22.0). Se construye por fases (4.22.12), todas detrás de banderas, sin alterar el comportamiento actual. Con `wholesale.on` apagada el sistema se comporta **exactamente** como hoy (la regresión completa es obligatoria con la bandera apagada y con la encendida). En el sistema del cliente nace **apagada**; en la demo nace **encendida con datos rotulados "ejemplo"**.

**Objetivo.** Operación dual **Mayorista / Minorista** sobre el mismo catálogo, stock, clientes y caja, compatible con varios rubros (alimentos y bebidas, cosmética, indumentaria, bazar y ferretería, carnes y pesables), con control de cajas, contabilidad automática **opcional** y trazabilidad de cada documento, movimiento y usuario. Extiende 4.2, 4.3, 4.4, 4.5, 4.12, 4.20 y 4.21 y **absorbe 5.2** (que pasa a ser un resumen que remite acá). No crea un segundo POS, un segundo stock, una segunda lista de clientes ni una segunda caja.

**Principios (no se negocian).**
1. **Un solo catálogo, un solo stock (unidad base), un solo libro de clientes, una sola caja.** El canal es un atributo de la operación, no un sistema paralelo.
2. **Un solo punto de cálculo de precio** (`priceResolve`, 4.22.1.3), usado por la pantalla, `commitSale` y el servidor: no hay dos reglas que puedan divergir (lección de `payCheck`).
3. **Una fuente de precio y un solo beneficio por compra** (4.3): lista/acuerdo/escalón definen el precio; después se aplica a lo sumo un beneficio.
4. **El servidor recalcula** precio, descuento, stock, lote, crédito y totales; nunca se confía en lo que manda el navegador. Sin conexión no se inventa ninguna confirmación (cobro, sincronización, CAE).
5. **Histórico congelado:** cada línea guarda la regla aplicada; cambiar listas, escalones, reglas o costos no reescribe ventas, remitos, cierres sellados ni asientos.
6. **Toda entidad nueva** lleva `tenant_id`, RLS, claves foráneas compuestas `(id, tenant_id)`, auditoría, idempotencia, dinero en centavos enteros o `numeric(14,2)` y prueba cruzada A/B.
7. **Lo que el adjunto original pide y choca con decisiones ya tomadas** se resuelve en 4.22.13; no se implementa en silencio ninguna de las dos versiones.

### 4.22.0 Matriz de detección (inspección del código real, 2026-10-19)

Antes de cada fase se vuelve a inspeccionar el repositorio: esta tabla es el punto de partida, no un sustituto.

| Requisito | Estado hoy | Qué hacer |
|---|---|---|
| Auditoría encadenada por hash; cambio de precio de línea auditado; `LIMITE_CREDITO` auditado | **Existe** (`audit()`, columnas fecha/usuario/acción/detalle/hash) | **Completar:** evento estructurado (módulo, entidad, valor anterior/nuevo, dispositivo); IP sólo del lado servidor; las filas viejas se leen con valores por defecto |
| Cuenta corriente, límite de crédito, pagos mixtos, vuelto | **Existe** (4.20, `c.limit`, libro del cliente) | **Hecho en F1:** plazo por cliente, vencimiento por documento (FIFO), antigüedad, tolerancia, bloqueo y excepción autorizada de un solo uso (anexo F) |
| Factura A/B/C con CAE automático y condición de IVA del receptor | **Existe** (4.12) | Reutilizar; MiPyME/FCE **no existe** (`[VERIFICAR]`) |
| Selector de documento **Ticket interno / Remito / Presupuesto** de 4.2 | **Parcial:** el código sólo emite *Ticket interno* o *Factura electrónica*; **Remito y Presupuesto no están implementados** | **Completar** dentro de 4.22.4 (no agregar una segunda vez) |
| Bultos, escalones por cantidad, listas de precio, venta mayorista | **Hecho en F1 (V26.6)**, detrás de `wholesale.on`: ver anexo F | Completar import/export de escalones y presentaciones; mostrar la regla en el ticket impreso |
| Canal por operación; categoría de cliente mayorista; zona; vendedor | **Hecho en F1:** canal por operación (`sale.wch`), canal/lista/CUIT/plazo/zona/vendedor en la ficha del cliente | Reportes por canal/zona/vendedor en F6 |
| Lotes, vencimientos, FEFO | **No existe** (compras 4.21 suma stock y costo, sin lote) | **Agregar** (F3), enganchado a `procesar_recepcion` |
| Matriz talle/color/estampa | **No existe** | **Agregar** (F4), sólo si el rubro lo requiere |
| Pesables | **Parcial:** unidades `u/kg/l`, PLU, EAN-13 de balanza, edición enlazada cantidad×precio×importe | **Completar:** unidad de stock distinta de la de facturación (pieza/caja ↔ kg) |
| Kits / combos / packs | **No existe** (tampoco recetas 5.10 implementadas) | **Agregar** (F3) con una única estructura de componentes que sirva también a 5.10 |
| Pedido de venta, picking, remito con constancia, trazabilidad inversa | **No existe.** "Pedidos" del panel son los del menú/PedidosYa y **no son lo mismo**: el módulo nuevo se llama **Pedidos de venta** | **Agregar** (F2) |
| Cierre ciego | **No existe:** Caja muestra el efectivo esperado y el Arqueo calcula la diferencia en vivo al tipear | **Agregar** bandera `cash.blind` (F5) |
| Caja minorista vs. cobranza mayorista; cheques en cartera, eCheq, retenciones sufridas | **No existe** (cheque sólo como medio de pago a proveedores en 4.21) | **Agregar** (F5), sin integración bancaria |
| Reportes por canal / vendedor / zona / lote / marca | **Parcial:** Resumen por rubro, medio de pago, fiscal/interno | **Completar** (F6) |
| Margen por canal con costo histórico | **Parcial:** margen estimado con el último costo cargado | **Completar:** costo histórico por línea; PPP/FIFO en F7 |
| PPP/FIFO, CMV, asientos, plan de cuentas, Libro IVA Ventas, subdiario, percepciones | **No existe** | **Agregar** como módulo opcional `accounting.on` (F7), con contador |

### 4.22.1 Canal, listas de precios y resolución de precio

**1.1 Canal y cliente.**
- `channel ∈ {minorista, mayorista}` por operación. Se hereda del cliente (`customers.default_channel`) y se puede cambiar en la operación con permiso; el cambio pide motivo y se audita.
- Ficha de cliente (campos nuevos con valor por defecto; ninguno obligatorio para clientes existentes): lista de precios asignada, grupo, condición frente al IVA, ID fiscal, zona de cobranza, vendedor asignado, límite de crédito (ya existe), plazo máximo en días.
- **Mayorista exige cliente identificado con ID fiscal válido** (CUIT con dígito verificador, como 4.21). Consumidor final nunca vende como mayorista.
- Un cliente puede ser a la vez socio del Club: ver 4.22.1.3 (f) sobre beneficios.

**1.2-bis · ENMIENDA V26.6 (decisión del dueño tras probar F1): el mayorista trabaja con PRECIOS POR PRESENTACIÓN, no con una tabla de listas.** Un mayorista maneja 4 o más precios según el volumen, ligados a la presentación en que compra y en que tiene el stock: **Unidad, Display, Fardo y Pallet**, y puede agregar más (Media caja, Bolsón…). Por eso: (a) las presentaciones son configurables (Configuración → Mayorista y minorista: nombres, agregar y quitar; «Unidad» siempre existe y es el precio de venta); (b) **se cargan en el alta/edición del producto**, no en una pantalla escondida: por presentación, cuántas unidades trae, el precio de la presentación **o** el de cada unidad (el otro se completa solo), código de barras opcional, margen visible a quien ve costos, y validación de que el precio por unidad **no sube** al subir la cantidad; (c) el **inventario** muestra los precios de todas las presentaciones y el **stock desglosado** («3 Pallet + 2 Fardo + 2 Display») y permite **ingresar stock por presentación**; (d) **Vender**, en canal mayorista, muestra en cada producto sus presentaciones con precio por unidad y total, con un toque suma el Display/Fardo/Pallet, y el precio por unidad **baja solo según el volumen** (presentación más grande que alcance la cantidad total del producto en la operación), explicando la regla y cuánto falta para la siguiente. Una tabla de configuración que el dueño no puede usar donde trabaja **no cuenta como funcionalidad hecha**. Las «listas L1–L5» y los escalones por lista quedan reemplazados por este modelo (el acuerdo especial por cliente se conserva).

**1.2 Listas de precio (configurables, no cinco fijas) — reemplazado en F1 por 1.2-bis.** El adjunto original dice "al menos 4 listas fijas" y enumera cinco niveles; se resuelve con **hasta 5 listas configurables** con nombre editable, activables, con vigencia desde-hasta, moneda e **impuestos incluidos/excluidos declarado** (nunca implícito):

| Lista | Uso típico (nombre editable) |
|---|---|
| L1 | Minorista / consumidor final (**base**; es el precio que ya tiene cada producto) |
| L2 | Mayorista nivel 1 (compra por bulto/pack) |
| L3 | Mayorista nivel 2 (pallet o franja de cantidad media) |
| L4 | Mayorista nivel 3 / distribuidor (gran volumen) |
| L5 | Especial / cliente VIP (acuerdo comercial) |

- `price_lists` (cabecera) y `price_list_items(product_id|variant_id, list_id, sale_unit, price)`; un producto sin precio en una lista **cae a L1 y lo informa** (nunca un precio vacío o cero).
- **Escalones por cantidad** `price_tiers(product_id|group_id, list_id|null, from_qty, to_qty|null, price | pct_off, unit, valid_from, valid_to)`. Los rangos de un mismo producto/lista **no se solapan** (se valida al guardar; el último es abierto) y se expresan en **unidad base**. Caso del adjunto, obligatorio como prueba: 1–9 → $ 100 · 10–49 → $ 90 · 50–99 → $ 80 · 100+ → $ 70.
- **Acuerdo especial** `special_agreements(customer_id, product_id|category_id, price | pct_off, valid_from, valid_to, approved_by)`: sobreescribe la lista del cliente mientras esté vigente; lo crea un rol autorizado y queda auditado.
- **Presentaciones** `pack_presentations(product_id, name, qty_base, barcode, sale_mode)`: unidad, caja ×6, pallet ×N; `sale_mode ∈ {suelta, bulto_cerrado, ambas}`; código de barras propio por presentación (no se asume igual al de la unidad). **El stock es uno solo, en unidad base** (2 bultos de 6 = 12 u); "sólo bulto cerrado" exige múltiplos enteros.
- Edición de listas, escalones, acuerdos y pisos: rol con permiso `price_lists` (administrador por defecto); mostrador y operador no pueden, ni por pantalla ni por API.
- **Cambios masivos** de listas (por porcentaje, por categoría): vista previa con precio anterior/nuevo, confirmación, auditoría y reversión del lote (mismo patrón que 4.9).

**1.3 `priceResolve` — resolución determinista del precio (orden fijo, la misma función en pantalla, `commitSale` y servidor).**
1. **Base:** precio L1 vigente del producto/presentación.
2. **Acuerdo especial vigente** del cliente (producto o categoría): si existe, **gana** y no se mezcla con escalones salvo que el acuerdo lo declare.
3. **Si no hay acuerdo:** precio de la **lista asignada al cliente**; si el producto no figura en ella, se usa L1 y se informa el motivo.
4. **Escalón por cantidad:** se evalúa sobre la **cantidad agregada del mismo producto (o grupo de precio) en la operación**, en unidad base. Si el precio del escalón es **menor** que el del paso 3, se aplica el escalón ("salvo que supere un escalón superior" del adjunto); **un escalón nunca sube un precio**.
5. **Bulto cerrado:** bonificación configurable por presentación (precio fijo por bulto o %), según 5.2/N.2. Si conviven precio fijo y porcentaje, el administrador elige y fija la prioridad; **nunca se combinan en silencio**.
6. **Piso de precio** (`price_floor` por producto/lista, opcional): un precio resuelto menor que el piso requiere supervisor + motivo.
7. **Un solo beneficio** (4.3): cupón **o** membresía **o** descuento manual autorizado; lo que no es acumulable según configuración se descarta y **se muestra por qué**. Productos de venta restringida por edad no participan de promociones. Para el canal mayorista, `wholesale.allowClubBenefits` (apagada) decide si los sellos del Club y los cupones del Club se otorgan o se canjean: por defecto **no**.
8. Redondeo a centavos con regla explícita y consistente; el descuento se reparte por línea (método del mayor resto, 4.3).

`priceResolve` devuelve: precio unitario, **código de la regla aplicada**, motivo legible ("Mayorista · lista L2 · escalón 10–49 u"), el precio minorista como alternativa y **qué condición falta** si no se alcanzó el mínimo ("faltan 4 u para precio de 10–49 u").

**1.4 Pantalla Vender (sin quitar nada de 4.2).** Indicador visible **Minorista / Mayorista / Bulto cerrado** con el motivo de elegibilidad; selector de presentación sin duplicar productos ni crear líneas incompatibles; al cambiar la cantidad se recalcula el tramo en vivo y, si baja de un mínimo, se retira el descuento y se pide confirmar cuando el total cambia sustancialmente; cantidad inválida para bulto cerrado impide cambiar de presentación; teclas F1–F12 y numeración **sin cambios**; áreas táctiles ≥ 48 px; teclado numérico sin "0" precargado (4.2). El ticket y los reportes muestran el descuento por línea **sin revelar costos**.

**1.5 Snapshot por línea (histórico inmutable).** Producto/presentación/variante, cantidad en unidad de venta **y** en unidad base, factor de bulto, lista, escalón, regla (código), precio de lista, % e importe de descuento, precio final, costo histórico unitario, lote(s), vendedor, usuario, canal. Las devoluciones y notas de crédito usan **lo realmente cobrado** en la operación original (nunca se edita una venta para simular una devolución).

**1.6 Publicación en el menú.** Los precios mayoristas **no** se publican salvo que el comercio lo habilite expresamente producto por producto; el menú nunca recibe costo, margen, reglas internas, acuerdos ni listas de clientes. Si se publican escalas, hay que actualizar `rave_limpiar_menu` (lista cerrada de campos) y probarlo.

### 4.22.2 Crédito y condiciones de venta

- **Condiciones:** contado, cuenta corriente, cheque diferido, transferencia, tarjeta (se reutilizan los medios y el cobro mixto de 4.20; se agrega **cheque diferido** como medio con fecha de cobro y alta en cartera, 4.22.6).
- **Límite** de monto y **plazo máximo en días** por cliente; cada documento a cuenta corriente guarda su `due_date`. Antigüedad de saldos 0–30 / 31–60 / 61–90 / +90 días.
- **Bloqueo automático** al **confirmar** una venta o pedido a cuenta corriente cuando el cliente tiene documentos vencidos más allá de la tolerancia configurada **o** el saldo + la operación superan el límite. Contado, transferencia y tarjeta siguen permitidos.
- **Excepción crediticia:** supervisor/administrador autoriza con **motivo obligatorio, monto máximo y vigencia**; queda `credit_overrides(customer_id, amount, valid_until, approved_by, reason)` y un evento de auditoría con usuario autorizante. La excepción se consume (no queda abierta).
- **Dónde se valida (decisión de arquitectura, coherente con 4.20.9):** el bloqueo es **duro en el equipo** con los datos locales; en la nube el servidor, al sincronizar, **no rechaza la venta ya realizada** (rompería el trabajo sin conexión) pero la marca `credit_review`, alerta en el Resumen y la deja visible en el cliente. Los **pedidos de venta mayoristas** (documentos que se crean con conexión) sí se validan en el servidor.
- Cambiar límite, plazo, lista, zona o vendedor de un cliente: rol autorizado, valor anterior/nuevo en auditoría.

### 4.22.3 Adaptación por rubro (cada capacidad es una bandera por producto o por rubro)

**a) Lotes y vencimientos (alimentos, bebidas, cremas y cosmética) — `track_lots`.**
- `product_lots(id, product_id, lot_no, expires_on, qty_base, unit_cost, supplier_id, receipt_id)`; el stock del producto es la **suma de sus lotes** más el saldo "sin asignar"; cada movimiento de stock (`smov`) puede llevar `lot_id`.
- **Recepción (4.21 `procesar_recepcion`):** si el producto tiene `track_lots`, el renglón exige número de lote y vencimiento; todo o nada, igual que el resto de la recepción. Almacenamiento y despacho conservan el lote.
- **Salida FEFO automática:** al confirmar remito o venta se asignan lotes por vencimiento ascendente (puede partirse una línea en varios lotes); se guarda `lot_id` por línea. **Un lote vencido no se vende** (bloqueo; excepción con motivo y rol, auditada). Alerta de vencimiento próximo con días configurables.
- **Conflicto declarado con "vender sin stock" (4.2):** si no hay lote disponible y el producto admite venta sin stock, la línea queda en el lote virtual **SIN ASIGNAR** (stock negativo, marcado en rojo como hoy) y se regulariza al ingresar el lote real, con reasignación manual auditada. Nunca se inventa un lote.
- Reportes: ventas por lote/vencimiento y **búsqueda hacia adelante** ("¿a qué clientes salió el lote X?") para retiros del mercado.

**b) Indumentaria y calzado — matriz talle/color/estampa (`wholesale.matrix`, apagada).**
- Producto **padre** con atributos configurables (talle, color, estampa) y **variantes hijas** con SKU y código de barras propios; stock, costo y precio por variante (el precio del padre se hereda salvo anulación).
- **Carga rápida en grilla** para pedidos mayoristas: filas = color, columnas = talle, con **curvas de talles** reutilizables (p. ej. 1-2-2-2-1) que se expanden en cantidades por variante; totales por fila/columna y escalón calculado sobre la cantidad total del padre (grupo de precio).
- Importación/exportación con padre-hijo (4.9); no se crean productos duplicados para simular variantes.

**c) Carnes y pesables — doble unidad de medida.**
- `stock_uom` (pieza, caja, media res) distinta de `bill_uom` (kg, g): cada pieza/caja tiene su **peso real** (se registra al ingreso o en el despacho) y el stock se lleva en piezas **y** en kilos; la venta por kilo descuenta peso de las piezas/lotes asignados.
- Reutiliza balanza (HAL, 4.10) y EAN-13 de balanza con peso embebido; los datos que vuelven de la balanza **no son confiables**: rango y tipo se validan; peso estable; redondeo declarado (gramos enteros); merma configurable con tolerancia.
- Carnes y frescos: lote + vencimiento + origen/proveedor por pieza; requisitos sanitarios y de rotulado `[VERIFICAR con la autoridad sanitaria nacional y provincial]`.

**d) Bazar, varios y ferretería — kits, combos y packs desarmables (`wholesale.kits`).**
- `bom(parent_id, component_id, qty_base, kind ∈ {kit, receta})`: **una sola estructura de componentes** para kits y para recetas (5.10); no se crea otra.
- Kit **virtual** (stock = mínimo de `stock_componente ÷ cantidad`) o **armado** (stock propio, se arma/desarma con movimientos). La venta de un kit virtual descuenta los componentes de forma **atómica**; un kit armado descuenta el kit; **nunca los dos**. La devolución vuelve a los componentes.
- Se muestra el precio del kit frente a la suma de componentes; el descuento del kit se reparte entre componentes para los reportes (mayor resto).

### 4.22.4 Documentos vinculados y trazabilidad de ventas

**Cadena mayorista:** `Presupuesto → Pedido de venta → Orden de picking → Remito/despacho → Factura/comprobante → Recibo de cobranza + asiento de caja`.

- `sales_docs(id, tenant_id, type, number, state, origin_doc_id, customer_id, channel, seller_id, branch_id, created_by, …)` y `sales_doc_lines(…, origin_line_id)` (el vínculo por **línea** permite entregas parciales y faltantes pendientes). Numeración correlativa por tipo y caja/punto, con bloqueo (sin saltos ni repetidos).
- **Estados válidos por tipo** y transiciones permitidas en una tabla; un documento cerrado **no se edita** (se corrige con nota/ajuste vinculado); idempotencia por clave en cada transición.
- **Presupuesto:** no suma como venta (4.2); tiene vigencia; al pasar a pedido congela precios o los recalcula según configuración.
- **Pedido de venta:** valida cliente, crédito (servidor) y precio; puede **reservar** stock (`wholesale.reserve`, apagada); la reserva se libera al cancelar o vencer. *No* descuenta stock.
- **Orden de picking:** propone lotes FEFO, se confirma escaneando, registra diferencias.
- **Remito/despacho:** descuenta stock con el lote asignado, imprime sin validez fiscal ("DOCUMENTO NO VÁLIDO COMO FACTURA") y guarda la **constancia de recepción** (firma en pantalla o foto, adjunto cifrado). La existencia de un remito electrónico oficial y su alcance `[VERIFICAR]`.
- **Factura:** desde uno o varios remitos del mismo cliente ("facturación por período") o directa; con ARCA según 4.12 (clase por emisor y receptor, CAE, QR); el CAE no se sincroniza como dato genérico (lección v2.2).
- **Recibo de cobranza:** imputa a uno o varios documentos (total o parcial), con los medios de 4.22.6 y asiento de caja con **rubro obligatorio** (6.10).
- **Trazabilidad inversa y directa:** pantalla **Trazabilidad**: desde cualquier factura o cobro se navega hacia atrás hasta remito(s) firmados, picking, lotes usados, pedido y presupuesto; y desde un lote hacia adelante hasta los clientes. Cada salto es un vínculo real de datos, no un texto.
- **Minorista POS (circuito existente):** el ticket del POS equivale a pedido + remito + comprobante + cobro **en un solo paso**: se genera la cadena mínima de forma implícita (un documento con vínculos nulos). No se agrega fricción en el mostrador.
- Nombres: el módulo se llama **Pedidos de venta** para no chocar con "Pedidos" (menú/PedidosYa). Aparece en la navegación sólo con `wholesale.docs` encendida.

### 4.22.5 Auditoría de punta a punta

- **Evento:** `id`, `ts` (servidor, UTC), `user`, `role`, `device_id`, `ip` (sólo servidor; criterio de retención y de truncado `[VERIFICAR con asesor legal]`), `module`, `action`, `entity`, `entity_id`, `old_value`, `new_value`, `reason`, `hash`, `hash_prev`.
- **Hoy** la auditoría ya está encadenada con hash. Se **completa** con las columnas estructuradas sin romper las filas viejas (se leen con valores por defecto) y sin duplicar el mecanismo.
- **Obligatorio auditar:** cambios manuales de precio en POS o pedido; descuentos por encima de la regla automática; anulaciones, notas de crédito y cancelaciones de renglón; cambios de límite, plazo, lista, zona o vendedor del cliente; ajustes directos de inventario; excepciones de crédito; cambios de listas, escalones y acuerdos; cambio de canal de una operación; cambios de lote/vencimiento y reasignaciones; intento de ver el esperado en cierre ciego; sellos y canjes del Club.
- **"Inalterable" con precisión:** en el servidor la tabla es **sólo-agregar** (triggers que impiden `UPDATE` y `DELETE`, como el libro de proveedores) con hash encadenado; en el equipo el encadenado **detecta** manipulación pero no la impide. La defensa real es el servidor. Este límite se declara; no se escribe "inalterable" sin él.
- Pantalla de Auditoría con filtros por usuario, módulo, acción, entidad y fecha; exportación con fórmulas neutralizadas; sólo roles autorizados.

### 4.22.6 Cajas, cobranzas y valores

- **Apertura** con fondo por cajero (ya existe). Modelo de cajas de 4.14: se agrega `channel_scope ∈ {minorista, mayorista, ambos}` a la caja; **no** se crea otra fuente de verdad.
- **Cierre ciego (`cash.blind`, por caja y rol):** el cajero declara efectivo, comprobantes de tarjeta/cupones, cheques y otros valores **antes** de ver el esperado; recién entonces el sistema muestra esperado vs. declarado y diferencia por medio. Mientras la sesión está abierta, el rol cajero no ve el esperado en Caja, Arqueo, tablero ni exportaciones; supervisor y administrador sí. **Límite declarado:** en un sistema que funciona sin conexión los datos están en el equipo, así que ocultar es control de interfaz y de proceso, no cifrado: el intento de consultar el esperado se audita. El cierre sellado (SHA-256, congelado en la nube) **no cambia de forma** y el formato ampliado se lee con valores por defecto en cierres anteriores.
- **Medios por tipo de caja:** minorista (efectivo, débito, crédito, QR/billetera); cobranza mayorista (efectivo, transferencia, **cheque en cartera**, **eCheq**, **retenciones/percepciones sufridas**).
- **Valores en cartera:** `valores(id, type ∈ {cheque, echeq}, bank, number, drawer_tax_id, amount, issued_on, due_on, state, customer_id, receipt_id)` con ciclo *en cartera → depositado / endosado → cobrado / rechazado*; alerta de vencimiento; un **rechazo reabre la deuda** con un movimiento compensatorio (nunca se edita el recibo). Sin integración bancaria; requisitos y plazos de cheques/eCheq `[VERIFICAR]`.
- **Retenciones sufridas:** se cargan en el recibo (impuesto, jurisdicción, N.º de certificado, importe); **reducen la deuda pero no son dinero**: no suman al efectivo esperado ni al "cobrado real".
- **Movimientos manuales:** ya exigen rubro y motivo (6.10); se agregan *retiro a caja fuerte* y *depósito bancario* como par vinculado egreso-ingreso, sin doble conteo.
- **Arqueo analítico:** esperado, declarado, sobrante/faltante por medio y total; los cobros de cuenta corriente y la parte fiada siguen separados de "efectivo real" (4.20).

### 4.22.7 Reportes e históricos de ventas multidimensionales

- **Filtros:** canal, sucursal, caja, vendedor, zona de cobranza, rubro/categoría/subcategoría/marca, lote/vencimiento, cliente, medio de pago, fiscal/interno y período. Subcategoría, marca y zona son campos nuevos **opcionales** (valor por defecto vacío).
- **KPIs, siempre con fórmula, período y denominador visibles:** ventas brutas · descuentos · devoluciones/notas de crédito · **ventas netas = brutas − descuentos − NC** · costo de lo vendido (costo histórico por línea) · **margen bruto = ventas netas − costo**, por producto y por canal (si falta el costo, la línea se informa como "sin costo" y se cuenta aparte; nunca se inventa) · ticket promedio · volumen promedio por venta (unidades base y bultos) · top de productos **por volumen** y **por margen** (rankings distintos) · participación en ingresos (N/D si el denominador es cero).
- El Resumen (4.1) **gana el filtro Canal**; no se reemplaza. Gráficos accesibles con tabla equivalente; exportación CSV/XLSX con fórmulas neutralizadas y columnas según permiso de costos. No comparar períodos incompatibles; en la nube, agregaciones en el servidor con paginación (no bajar todo al navegador).
- Nunca llamar "ganancia neta" a un margen bruto.

### 4.22.8 Contabilidad y cumplimiento fiscal (`accounting.on`, apagada por defecto)

- **Alcance honesto:** asientos **de gestión** generados desde las operaciones; **no reemplazan** los libros legales ni al contador. Formatos, plan de cuentas definitivo y presentaciones oficiales `[VERIFICAR con el contador del cliente]`.
- **Plan de cuentas configurable** con plantilla de ejemplo (caja, bancos, valores a depositar, deudores por ventas, mercaderías, IVA débito fiscal, retenciones y percepciones, **Ventas Mayoristas**, **Ventas Minoristas**, costo de mercadería vendida, descuentos otorgados, proveedores…). El ingreso se abre por canal.
- **Asientos automáticos**, vinculados al documento de origen, **balanceados al centavo** (restricción o trigger: Σ débito = Σ crédito), inmutables y corregidos por contraasiento: (1) facturación de venta (deudores/caja a ventas + IVA + percepciones); (2) **CMV** (CMV a mercaderías) según el método de valuación; (3) cobranzas y descuentos otorgados; (4) notas de crédito (revierten); (5) cierre de caja.
- **Valuación:** hoy el costo es el **último costo de compra**. Se agrega `avg_cost` (**PPP**, recalculado en cada ingreso de 4.21) y capas de ingreso (**FIFO**, por lote cuando hay lotes). El método es una decisión del comercio con **fecha de corte** (no reescribe lo histórico). Migración: el costo actual entra como saldo inicial.
- **IVA:** alícuota por producto (21 %, 10,5 %, 27 %, 0 %, exento, no gravado `[VERIFICAR alícuotas y encuadres vigentes]`); precio con IVA incluido al consumidor final y discriminado al responsable inscripto, con la representación declarada; el redondeo por alícuota cierra al centavo (lección de 4.12).
- **Percepciones / retenciones** (Ingresos Brutos y otros nacionales/provinciales): tabla por jurisdicción y condición del cliente (alícuota, base, mínimo no imponible, vigencia) **cargada por el contador**; el sistema **no trae alícuotas inventadas**; la base y el redondeo son visibles y el importe se discrimina en el comprobante y en el libro. Integración con padrones oficiales: etapa futura `[VERIFICAR]`.
- **Comprobantes:** A/B/C ya cubiertos por 4.12; **Factura de Crédito Electrónica MiPyME: no implementada**, régimen, comprobantes y servicios a `[VERIFICAR]` antes de comprometer nada.
- **Informes:** Subdiario contable, Mayor por cuenta, Balance de sumas y saldos y **Libro IVA Ventas** (por comprobante y alícuota: neto, IVA, exento, no gravado, percepciones; A/B/C, NC y ND), exportables. El formato oficial de presentación del Libro IVA `[VERIFICAR con ARCA y el contador]`; no se inventa un diseño de registro.

### 4.22.9 Modelo de datos y migraciones

Entidades nuevas (todas con `tenant_id`, RLS, `created_at/updated_at/created_by`, borrado lógico, claves foráneas compuestas y pruebas A/B):

```
customers (ALTER, campos opcionales) ──< credit_overrides
price_lists ──< price_list_items >── products / product_variants
price_tiers  >── products | price_groups      special_agreements >── customers, products
pack_presentations >── products               zones ──< customers      sellers >── employees
sales_docs ──< sales_doc_lines                (origin_doc_id / origin_line_id = cadena)
sales_docs 1── picking_orders · delivery_notes (constancia adjunta cifrada)
receipts ──< receipt_allocations >── sales_docs      receipts ──< valores_cartera · retenciones
product_lots ──< stock_moves(lot_id)          bom (kits / recetas)       product_variants >── products (padre)
cost_layers · avg_cost                        tax_rules (percepciones)
accounts ──< journal_lines >── journal_entries >── sales_docs | receipts | cash_closings
audit_log (extender, sólo-agregar)            cash_closings (snapshot ampliado, formato versionado)
```

**Migraciones propuestas** (aditivas, numeradas, idempotentes; **no existen todavía**: se crean y se prueban en el repositorio **antes** de mencionárselas al dueño; se agregan a `INSTALAR-TODO.sql` en orden): `10-mayorista-precios.sql` (F1) · `11-traspasos-cobros-auditoria.sql` (**4.23**, G1–G3) · `12-documentos-venta.sql` (F2) · `13-lotes-kits-matriz.sql` (F3/F4) · `14-cobranzas-valores.sql` (F5) · `15-contable.sql` (F7). Cada colección nueva exige actualizar la lista cerrada de `sincronizar()`, su política de lectura, exportación, importación y respaldo. Los **importes derivados** (totales, deuda, estado) los calcula el servidor. Los estados persistidos de la versión anterior deben cargar sin errores (campos nuevos con valores por defecto).

### 4.22.10 Flujogramas

```
CIRCUITO MAYORISTA
Presupuesto (vigencia) ─► Pedido de venta ─► [¿crédito OK?] ──no──► Excepción autorizada (motivo) o rechazo
                                │ sí                                  │
                                ▼                                     ▼
                      Reserva opcional ─► Picking (lotes FEFO, escaneo, diferencias)
                                                  ▼
                              Remito/despacho (descuenta stock + lote, constancia firmada)
                                                  ▼
                     Factura (1..n remitos; ARCA 4.12) ─► Recibo de cobranza (medios, valores, retenciones)
                                                  ▼
                       Asiento de caja (rubro obligatorio) ─► [accounting.on] asientos ─► Cierre de caja

CIRCUITO MINORISTA POS (sin pasos extra)
Carrito (priceResolve) ─► Ticket interno / Factura ─► Cobro (mixto, 4.20) ─► Cierre de caja (ciego opcional)
        └─ cadena implícita: pedido + remito + comprobante + cobro en una sola operación
```

### 4.22.11 Reportes de cierre (entregables)

1. **Planilla de arqueo y cierre de caja unificada** (A4 imprimible): minorista y mayorista por separado y total; por medio; valores en cartera; retenciones; esperado vs. declarado; sobrante/faltante; usuario, hora, observaciones, sello SHA-256 y verificación de integridad.
2. **Informe de trazabilidad de ventas y márgenes por canal:** por documento (con la cadena completa), producto, lote, vendedor, zona; fórmulas visibles.
3. **Libro IVA Ventas y Subdiario contable** (sólo con `accounting.on`; formatos oficiales `[VERIFICAR]`).

Todos con tabla accesible, CSV/XLSX con fórmulas neutralizadas, permisos de costos y filtros aplicados visibles en el encabezado.

### 4.22.12 Permisos, banderas y fases de construcción

- **Permisos nuevos** (los de hoy no cambian): `price_lists`, `credit_override`, `wholesale_sell`, `picking`, `dispatch`, `collections`, `valores`, `accounting`, `audit_read`. Administrador y supervisor por defecto en los de gestión; vendedor/mostrador sólo vende; **depósito** sólo picking y despacho. Todo se valida **en el servidor**.
- **Banderas:** `wholesale.on` · `wholesale.docs` · `wholesale.lots` · `wholesale.matrix` · `wholesale.kits` · `wholesale.reserve` · `wholesale.allowClubBenefits` · `cash.blind` · `accounting.on`. Todas apagadas en el cliente; se encienden por fase.
- **Fases** (cada una termina con **regresión completa verde y publicación**; ninguna deja el sistema a medias):

| Fase | Contenido | SQL | Aplica a un almacén/licorería |
|---|---|---|---|
| F1 | Canal, listas, escalones, acuerdos, presentaciones/bultos, `priceResolve`, crédito con plazo y excepción | 10 | **Sí** |
| F2 | Pedidos de venta, picking, remito (con constancia), presupuesto, factura desde remitos, recibo, trazabilidad | 12 | Opcional |
| F3 | Lotes/FEFO, kits, pesables con doble unidad | 13 | Lotes sí (si hay vencimientos); pesables y kits según catálogo |
| F4 | Matriz talle/color/estampa | 13 | No (indumentaria) |
| F5 | Cobranzas, cheques/eCheq, retenciones, caja por canal, **cierre ciego** | 14 | **Sí** (cierre ciego); valores opcional |
| F6 | Reportes por canal/vendedor/zona/lote, KPIs y los 3 informes | — | **Sí** |
| F7 | Contabilidad, PPP/FIFO, IVA por alícuota, percepciones, Libro IVA | 15 | Sólo con contador |

Antes de empezar cada fase: inspeccionar (sección 12), listar supuestos, escribir las pruebas junto con el código. **La decisión de qué fases se construyen es del dueño**; el orden recomendado es el de la tabla.

### 4.22.13 Contradicciones del adjunto original y decisión tomada (regla 2 de la sección 2)

| El adjunto pide | Choca con | Decisión por defecto (configurable) |
|---|---|---|
| "Al menos 4 listas fijas" y lista 5 | Su propia enumeración (5 niveles) | 5 listas **configurables** (4.22.1.2) |
| Bloqueo automático de crédito en todo documento | 4.20.9: el servidor no rechaza ventas por límite para no romper lo offline | Bloqueo duro en el equipo; el servidor marca `credit_review`; los **pedidos** (con conexión) sí se validan en servidor (4.22.2) |
| Cierre ciego | El Arqueo y Caja de hoy muestran el esperado | Bandera `cash.blind`; ocultamiento de interfaz + auditoría, con el límite offline declarado (4.22.6) |
| FEFO y lote obligatorios en la **venta** | 4.2: se puede vender sin stock | Lote virtual SIN ASIGNAR, regularización auditada (4.22.3a) |
| Registro "inalterable" | El encadenado del equipo sólo detecta | Servidor sólo-agregar + hash; límite declarado (4.22.5) |
| "IP/Dispositivo" en cada evento | Datos personales | IP sólo del lado servidor, retención a `[VERIFICAR]`; dispositivo = id propio del equipo |
| Bonificación automática por bulto | 4.3: un beneficio por compra | La bonificación de bulto es parte del **precio**, no un descuento extra; el cupón/membresía no se acumula con ella salvo configuración visible |
| Precio especial VIP "sobreescribible" | Escalones por cantidad | El acuerdo vigente gana; no se mezcla con escalones salvo que lo declare (4.22.1.3) |
| Asientos, CMV, Libro IVA | El sistema hoy no es contable y el costo es el último costo | Módulo opcional con PPP/FIFO, alcance honesto y contador (4.22.8) |
| Remito/Presupuesto "de 4.2" | No están en el código | Se completan en F2, una sola vez |

### 4.22.14 Pruebas obligatorias (con números conocidos, calculados de forma independiente)

1. **Precio:** unidad $ 100 con descuento mayorista 15 % → $ 85; bulto de 6 a $ 100 con 10 % → **$ 540 por bulto** ($ 90 por unidad); **2 bultos descuentan 12 u** de stock; escalones 1–9/10–49/50–99/100+ → 100/90/80/70 con 9, 10, 49, 50, 99, 100 u; un escalón **nunca sube** el precio de la lista del cliente; acuerdo especial vigente, vencido y futuro; producto sin precio en la lista → cae a L1 con motivo; escalones solapados rechazados; piso de precio; porcentaje inválido (negativo, `NaN`, 100 %); descuento que dejaría el total negativo; cupón + mayorista (no se acumulan); bonificación de bulto vs. cupón; tabaco/alcohol de venta restringida sin promociones.
2. **Bulto cerrado:** sólo bulto con cantidad múltiplo y no múltiplo; venta mixta suelta + bulto; código de barras de bulto y de unidad; cambio de presentación que deja cantidad inválida.
3. **Crédito:** saldo vencido bloquea cuenta corriente pero no contado; saldo + operación > límite; excepción con usuario, monto y vigencia que se consume; venta hecha **sin conexión** que excede el límite → al sincronizar queda `credit_review` y **no** se rechaza; pedido mayorista con conexión se valida en servidor; antigüedad de saldos.
4. **Documentos:** pedido de 100 u → remito de 60 + remito de 40 (faltante pendiente); factura desde 2 remitos; nota de crédito vinculada; **trazabilidad inversa** de una factura hasta el presupuesto y los lotes; **búsqueda hacia adelante** de un lote; idempotencia de cada transición (doble clic, reintento); numeración sin saltos con dos cajas; documento cerrado no editable; ticket POS genera la cadena implícita sin pasos extra; presupuesto no suma como venta.
5. **Lotes/FEFO:** venta que toma de varios lotes por vencimiento; lote vencido bloqueado (y excepción auditada); venta sin stock → SIN ASIGNAR y regularización; recepción sin lote para producto con `track_lots` rechazada y **revierte todo**; dos cajas vendiendo la última unidad de un lote al mismo tiempo; devolución al lote original.
6. **Kits y pesables:** kit virtual (stock = mínimo de componentes), venta descuenta componentes una sola vez, kit armado no descuenta componentes, devolución; pesable 1,250 kg con balanza simulada y EAN-13 embebido, peso fuera de rango rechazado, stock en piezas y en kilos coherente.
7. **Matriz:** curva de talles 1-2-2-2-1 expande a variantes; stock por variante; escalón sobre el total del padre; importación padre-hijo.
8. **Caja:** cierre ciego (el esperado **no** aparece en el DOM, en las respuestas ni en las exportaciones del cajero hasta declarar; sí para supervisor; el intento queda auditado); cierre sellado idéntico en forma y verificable; cierres viejos cargan con el formato nuevo; cheque en cartera → depositado → **rechazado reabre la deuda**; retención sufrida **no** suma al efectivo esperado; depósito bancario como par egreso-ingreso sin doble conteo.
9. **Contabilidad:** todo asiento balancea al centavo (prueba de propiedad con ventas aleatorias); **PPP:** compra 10 u a $ 100 + compra 10 u a $ 120 → costo promedio $ 110, venta de 5 u → CMV $ 550; **FIFO** con las mismas compras: venta de 5 u → CMV $ 500; IVA 21 % con redondeo conflictivo por alícuota que cierra al centavo; **Libro IVA Ventas = suma de los comprobantes del período**; nota de crédito revierte; cambio de método de valuación con fecha de corte no reescribe lo histórico.
10. **Reportes:** conjunto de datos conocido con descuentos, devoluciones, notas de crédito, costos históricos distintos, vendedor distinto del cajero y vendedor ausente → ventas netas, margen por canal, ticket promedio y rankings coinciden con el cálculo independiente; costo ausente informado como "sin costo"; filtros que no alteran otras pantallas.
11. **Auditoría:** `UPDATE`/`DELETE` rechazados por el servidor; cadena de hash válida y rota detectada; cada acción obligatoria de 4.22.5 genera su evento con valor anterior/nuevo y usuario; filas viejas se leen sin errores.
12. **Seguridad y aislamiento:** RLS A/B en **todas** las tablas nuevas, RPC y exportaciones; mostrador/operador rechazados **en el servidor** para listas, límites, acuerdos y valores; `tenant_id` manipulado; XSS en nombre de lista, lote, constancia y observaciones; CSV con fórmulas; la API pública y el menú **sin** costo, margen, listas ni acuerdos.
13. **Club y beneficios:** una venta mayorista a un socio del Club **no** otorga sello ni consume cupón con `allowClubBenefits` apagada; con la bandera encendida, un solo beneficio y un sello por 24 h; el alta y los sellos del Club (4.6) siguen funcionando igual con `wholesale.on` encendida y apagada.
14. **Regresión y forma:** con las banderas **apagadas** el comportamiento y las suites previas no cambian; encendidas y apagadas en la misma base (el estado previo carga sin errores); sincronización idempotente (reenviar el lote no duplica); sin conexión → cola y reconciliación honestas; 320/360/768/1024/1440 sin desbordes y con áreas táctiles medidas con números (≥ 44/48 px); consola sin errores; `file://` y `https`.

### 4.22.15 Criterios de aceptación y límites declarados

- Una fase se da por terminada sólo cuando: migración aplicada y probada dos veces sobre base nueva y sobre la base con datos; pruebas de 4.22.14 de esa fase verdes; **regresión completa verde** con la bandera apagada y encendida; revisión independiente de seguridad para F1 (precios y crédito), F5 (cajas y valores) y F7 (asientos); documentación y publicación. Nada se declara "100 % funcional".
- **Dependen de terceros:** contador (plan de cuentas, percepciones, formatos), certificado y servicios de ARCA (FCE MiPyME, comprobantes), bancos (eCheq, depósitos), padrones provinciales, autoridad sanitaria (carnes y frescos), balanza y lector reales (**pendiente de prueba física** hasta tener marca y modelo).
- **Fuera de alcance de 4.22:** integración bancaria, padrones automáticos de percepciones, FCE MiPyME, remito electrónico oficial, logística de transporte, liquidación de comisiones (5.8) y la multisucursal en servidor (queda como en el anexo).

---

## 4.23 TRASPASOS DE FONDOS CONTROLADOS, DETALLE DE COBROS DIGITALES Y EXPEDIENTE DIGITAL DE LA TRANSACCIÓN (V26.7)

**Estado: ESPECIFICACIÓN CORREGIDA Y ESTRUCTURADA. Nada de lo nuevo de 4.23 está implementado al 2026-10-19** (matriz 4.23.0). Nace del documento de ajuste «Cajas, Sucursales, Transferencia de Fondos y Trazabilidad Transaccional». Es **aditivo**: extiende 4.5, 4.14, 4.20, 4.22.5 y 6.10 sin reemplazarlos. Con sus banderas apagadas el comportamiento es **exactamente** el de hoy. Es la **prioridad de entrega** del sistema del cliente (4.23.14).

**Objetivo.** (1) Que sólo quien tenga permiso explícito pueda mover fondos entre cajas y sucursales, también con cajas **cerradas**, sin alterar nunca un cierre sellado. (2) Que cada cobro digital (transferencia, tarjeta, QR/billetera) guarde su **detalle de comprobante** para conciliar con el banco o el proveedor. (3) Que cualquier venta, cobro o movimiento se pueda abrir en un **Expediente digital** con todo su recorrido. (4) Que los comprobantes de traspaso y los detalles de cobro queden en tablas **sólo-agregar** en el servidor.

**Principios (no se negocian).**
1. **Una sola fuente de verdad:** se **extiende** el registro de traspasos que ya existe (`S.transfers`, colección `ctransf`); no se crea un segundo libro de traspasos ni una segunda pantalla.
2. **El cierre sellado no se toca.** Lo que ocurre después de cerrar se registra en registros aparte, vinculados al cierre (lección de la sección 14: «no meter datos nuevos dentro de un cierre sellado»).
3. **La venta ya hecha no se edita.** Los detalles de cobro viajan en un registro propio y versionado, vinculado a la venta; las correcciones son versiones nuevas, nunca un `UPDATE`.
4. **Nada se inventa:** estado «acreditada», comisión, retención, número de asiento o IP sólo se muestran si hay una fuente fiable; si no, «sin dato» o «no activado». Sin conexión no se afirma ninguna confirmación de un tercero.
5. **Dinero en centavos enteros** (`bigint`/`numeric(14,2)`), fechas en UTC con visualización en `[ZONA_HORARIA]`, el servidor es la fuente de la hora oficial.
6. **Datos personales y de pago con mínimo necesario:** nunca número completo de tarjeta, vencimiento, CVV, PIN ni banda; titular ordenante cifrado y enmascarado; todo con RLS, `tenant_id` y prueba cruzada A/B.
7. **Lo que el adjunto pide y choca con lo ya decidido o con la realidad técnica** se resuelve en 4.23.13; no se implementa en silencio ninguna de las dos versiones.

### 4.23.0 Matriz de detección (inspección del código real, 2026-10-19)

Antes de construir se vuelve a inspeccionar el repositorio: esta tabla es el punto de partida, no un sustituto.

| Requisito del adjunto | Estado hoy | Qué hacer |
|---|---|---|
| Traspaso de fondos entre cajas / sucursales | **Existe** (`xferCreate`, `A.xfer`, `A.xferRev`, `transfersFor`, vista `cajasx`): sólo entre cajas **abiertas**, con módulo de caja principal activo, rubro obligatorio (6.10), motivo ≥ 3 caracteres, idempotente por id, reversa sólo del administrador, auditado | **Completar:** permiso propio, cajas cerradas, autorizante, comprobante, estados, registro con filtros |
| Permiso `PERMISO_TRANSFERIR_FONDOS_INTERNOS` | **No existe.** Hoy basta `close_cash` (arqueo y cierre) | **Agregar** `transfer_funds` en `PERMS` (4.23.1); migración de roles con aviso |
| Traspaso con caja origen o destino **cerrada** | **No existe:** `xferCreate` exige las dos cajas abiertas | **Agregar** (4.23.2) sin tocar el cierre sellado |
| Comprobante interno de traspaso con 8 campos | **No existe.** El traspaso guarda `{id, ts, from, to, fromSess, toSess, amount, rubro, rubroName, motivo, user, rev}`: faltan autorizante, sucursales, estado de las cajas, moneda, número consecutivo e impresión | **Agregar** (4.23.3) |
| Detalle del cobro digital | **No existe.** `pays[] = {m, a, fee}`: sólo medio, importe y comisión. Medios hoy: efectivo, fiado, mixto, débito, crédito, transferencia, qr, modo, pedidosya | **Agregar** registro `cobro_detalles` (4.23.4); `fee` se reutiliza para la comisión |
| Validadores en la pantalla de cobro | **Parcial:** `payCheck` valida importes, cliente y límite; **no** pide datos de comprobante | **Completar** `payCheck` (un solo punto de validación; lección de 4.20) |
| Captura de datos por API del proveedor | **No existe** integración que devuelva datos de pago al sistema | Sólo carga manual declarada; verificada únicamente con la integración de 4.18 / O.2 cuando exista |
| Expediente digital (drill-down) | **No existe.** Hay lista de ventas, ticket y auditoría general, sin vista de desglose por operación | **Agregar** (4.23.6) reutilizando ticket, líneas (`lr`, `ll`, `lb`), `pays` y auditoría |
| Número de asiento contable | **No existe contabilidad** (4.22.8, `accounting.on`, F7) | Mostrar «Contabilidad no activada»; el número aparece recién con F7 |
| Audit log inmutable | **Parcial:** `audit()` encadena hash en el equipo (`id, ts, user, action, detail, prev, hash`) y sincroniza como colección `audit` de una sola escritura; el servidor **no** tiene trigger que impida modificarla. Ya existe el patrón `rave_solo_agregar()` (libro de proveedores, ingresos de mercadería) y `arca_comprobantes_inmutable` | **Completar** con tablas sólo-agregar (4.23.8) y reutilizar la misma tabla de auditoría estructurada de 4.22.5 |
| Pestaña «Registro de traspasos» con filtros | **Parcial:** tarjeta «Traspasos entre cajas» dentro de *Cajas y sucursales* (lista sin filtros) | **Completar** como pestaña con filtros, estados y comprobante (4.23.7) |
| Moneda del traspaso | **No existe** el campo (todo es ARS) | Campo `currency` con `ARS` por defecto; multimoneda **no** está en alcance |

### 4.23.1 Permiso de traspaso de fondos (`transfer_funds`)

- **Clave nueva** `transfer_funds` («Traspasar fondos entre cajas y sucursales») en `PERMS`; en el adjunto aparece como `PERMISO_TRANSFERIR_FONDOS_INTERNOS`: es el mismo permiso, con la clave técnica en inglés del resto de la matriz. Se agrega a la pantalla *Usuarios y permisos* y a la matriz de roles.
- **Bloqueado por defecto.** Sólo el administrador lo tiene siempre. Supervisor, mostrador, operador y cualquier rol personalizado **no** lo reciben salvo que el administrador lo tilde (por rol o, si el sistema ya admite permisos individuales, por usuario). Otorgarlo o quitarlo queda auditado (`PERMISO_OTORGADO` / `PERMISO_QUITADO`, usuario, rol y quién lo hizo).
- **Bandera `xfer.strict`.** Con la bandera encendida, `xferCreate`, `A.xfer` y la recepción exigen `transfer_funds` en lugar de `close_cash`. **Migración de datos existentes (no rompe lo anterior):** el primer ingreso del administrador tras actualizar muestra qué roles tenían hasta ahora la capacidad (los que tienen `close_cash`) y ofrece, con un botón explícito y auditado, «Otorgar a los roles que ya traspasaban». Nada se otorga en silencio. En el sistema del cliente se enciende al entregar, después de ese aviso; en la demo nace encendida con roles de ejemplo.
- **Validación en el servidor:** `sincronizar()` rechaza la colección `ctransf` (y los eventos de traspaso) cuando el usuario no tiene `transfer_funds`, igual que hoy rechaza otras colecciones por rol (`rave_puede_escribir`). El permiso se lee de la configuración de roles ya sincronizada; si el servidor aún no la tiene disponible por usuario, se agrega una función `rave_tiene_permiso(tenant, usuario, permiso)` en la migración 11. Ocultar el botón no es un control.
- **Autorizante.** El emisor necesita `transfer_funds`. Además se exige un **usuario autorizante** distinto del emisor, con rol administrador, cuando se cumple cualquiera de estas condiciones (todas configurables, por defecto encendidas): (a) alguna de las dos cajas está **cerrada**; (b) el importe supera `xfer.approvalOver` (centavos; vacío = nunca por importe); (c) la operación es entre **sucursales** distintas; (d) se trata de una reversa. El autorizante se identifica con su PIN o clave en el momento (se reutiliza el mecanismo de PIN de supervisor del kiosco/ingreso, sin crear otro) y queda registrado con el **método** (`permiso_propio`, `pin_admin`, `clave_admin`). Si el emisor es administrador y ninguna condición exige un segundo usuario, el autorizante es él mismo y el método `permiso_propio`.
- **Límite declarado:** la comprobación del PIN del autorizante ocurre en el equipo; el servidor verifica que el autorizante exista, sea administrador activo del comercio y distinto del emisor cuando corresponda, pero no puede probar que se tipeó el PIN.

### 4.23.2 Traspaso con cajas cerradas: fondo en tránsito y saldo inicial sugerido

**Regla de oro:** el cierre sellado, su arqueo y su hash **jamás** se modifican. Un traspaso posterior se guarda como registro propio, vinculado al cierre (`from_closure_id` / `to_closure_id`) y aparece en la ficha del cierre en una sección separada, **«Movimientos posteriores al cierre»**, fuera de la foto sellada.

**Estados del traspaso** (la máquina de estados vive en eventos sólo-agregar, 4.23.8; el comprobante no cambia):

| Estado | Cuándo | Efecto sobre el efectivo esperado |
|---|---|---|
| `completado` | Origen y destino **abiertas** (comportamiento de hoy) | Resta en origen y suma en destino en el acto |
| `en_transito` | Destino **cerrada** (u origen cerrada y destino abierta con recepción pendiente) | Sale del origen; **no** suma al destino hasta ser recibido; se muestra como «Fondos en tránsito» |
| `recibido` | El destino confirma la recepción con el importe | Suma al esperado del turno abierto del destino |
| `recibido_con_diferencia` | El importe recibido difiere del enviado | Suma lo recibido; la diferencia queda registrada y auditada (nunca se absorbe en silencio) |
| `devuelto` | El destino rechaza o no corresponde | Vuelve al origen mediante un traspaso inverso vinculado |
| `revertido` | El administrador corrige | Contraasiento: un comprobante nuevo de reversa vinculado al original (`rev_of`); el original no se edita |

**Casos:**
1. **Origen abierta, destino abierta:** `completado` (hoy). Se agrega comprobante, autorizante y estado de cajas.
2. **Destino cerrada** (origen abierta): `en_transito`. Modo configurable `xfer.closedMode`:
   - `transito` (**por defecto**): el fondo queda pendiente hasta que quien abra el próximo turno de esa caja lo **reciba** explícitamente (confirmando importe). Antes de recibir no cuenta en su esperado.
   - `saldo_inicial`: al abrir el próximo turno, el importe se integra **automáticamente** al *saldo inicial sugerido* y la apertura lo muestra como «incluye traspaso N.º …». Requiere autorizante.
3. **Origen cerrada** (el efectivo ya fue declarado en el cierre): se trata como un **retiro posterior al cierre** del fondo retenido de esa caja. Requiere autorizante. No cambia el cierre; reduce el **saldo inicial sugerido** del próximo turno de esa caja y se muestra en «Movimientos posteriores al cierre».
4. **Ambas cerradas:** permitido con autorizante obligatorio; el origen se trata como en 3 y el destino como en 2.
5. **Entre sucursales:** se conserva la regla actual (se resuelve a través de la caja principal); el comprobante guarda las dos sucursales.

**Saldo inicial sugerido del próximo turno.** `sugerido = efectivo declarado en el último cierre de esa caja − retiros posteriores al cierre + traspasos recibidos (según closedMode)`. Si el cajero abre con otro importe, la apertura lo permite pero registra la **diferencia de apertura** con motivo y la audita (hoy la apertura es un importe libre sin referencia).

**Invariante contable (prueba de propiedad):** para todo traspaso, `importe enviado = importe recibido + en tránsito + diferencias registradas + devuelto`. El dinero no aparece ni desaparece. Los «fondos en tránsito» tienen alerta de antigüedad (`xfer.transitAlertH`, horas; sin valor por defecto inventado: lo define el dueño) y se listan en el Resumen y en la lista de pendientes de la apertura.

**No es ingreso ni gasto:** el traspaso es un movimiento interno; no suma a ventas, gastos ni ganancia. Conserva el rubro obligatorio de 6.10 (clasificación financiera), y los reportes de rubro lo muestran como «Traspasos internos», aparte.

### 4.23.3 Comprobante interno de traspaso («Boleta de Movimiento de Fondos»)

Se genera automáticamente al crear el traspaso. Campos obligatorios (los 8 del adjunto, con su resolución técnica):

| # | Campo | Detalle |
|---|---|---|
| 1 | **ID del movimiento** | `id` único e idempotente (uid) + **número visible por caja de origen** `T-<caja>-<n>` (consecutivo sin saltos dentro de esa caja, como los tickets «2-15»); el servidor impone `unique(tenant_id, caja_origen, n)` y marca huecos. Ver 4.23.13 (consecutivo global vs. sin conexión) |
| 2 | **Fecha y hora exactas** | `ts_equipo` (UTC) **y** `ts_servidor` (UTC, la oficial); si difieren más de un umbral, se marca «hora de equipo desfasada» |
| 3 | **Usuario emisor** | id y nombre al momento (instantánea) |
| 4 | **Usuario autorizante** | id, nombre y `método` (`permiso_propio` / `pin_admin` / `clave_admin`); obligatorio según 4.23.1 |
| 5 | **Caja y sucursal de origen / de destino** | ids y nombres al momento (instantánea) |
| 6 | **Monto y moneda** | centavos enteros `> 0` + `currency` (`ARS` por defecto) |
| 7 | **Estado de las cajas al traspasar** | `abierta` / `cerrada` de origen y de destino, más id de turno abierto o id del último cierre |
| 8 | **Concepto / observación** | obligatorio, mínimo 3 caracteres, saneado (anti-XSS); más el **rubro financiero** (id e instantánea del nombre) |

- **Hash de integridad:** SHA-256 de los campos canónicos + hash del comprobante anterior del comercio (cadena). El comprobante **no se edita ni se borra**; el estado cambia sólo por eventos nuevos y la corrección es una reversa vinculada.
- **Impresión:** ticket de 80/58 mm y A4, con leyenda «DOCUMENTO INTERNO — NO VÁLIDO COMO FACTURA», dos líneas de firma (entrega / recibe), QR o código corto de verificación y los créditos de Rave Holding (sección 2). Se reimprime como «copia» sin generar un número nuevo.
- Cada creación, recepción, diferencia, devolución y reversa genera un evento de auditoría con valor anterior y nuevo (4.22.5).

### 4.23.4 Detalle de cobros digitales (transferencia, tarjeta, QR/billetera)

**Dónde se guarda.** En una entidad propia `cobro_detalles` (vinculada por `sale_id` + índice del pago dentro de `pays[]`), **versionada y sólo-agregar**. La venta y su `pays` no cambian de forma. Cada pago de una venta de pagos mixtos (4.20) tiene su propio detalle: «$ 10.000 efectivo + $ 15.000 QR + $ 50.000 transferencia» produce dos detalles (el efectivo no lleva).

**Campos por medio** (se rotulan en pantalla con su nombre claro; los que el adjunto llama «obligatorios» son los de la columna «Defecto»):

| Medio | Campo | Defecto | Validación |
|---|---|---|---|
| **Transferencia / CBU / CVU** | Banco o entidad de origen (o alias/CBU de origen) | Obligatorio | Texto 2–60 caracteres, saneado |
| | Cuenta de destino (a qué cuenta del comercio ingresó) | Obligatorio | Se elige de las cuentas cargadas en *Medios de pago*; si no hay, texto libre y aviso |
| | N.º de comprobante / operación / transacción | Obligatorio, **no relajable** | 6–40 caracteres alfanuméricos; **único** por (comercio, medio, entidad, número) |
| | Fecha y hora de la transferencia | Obligatorio | No futura; no anterior a `pay.maxAgeH` (configurable) |
| | Titular ordenante (nombre y CUIT/DNI) | Recomendado; obligatorio sobre `pay.ordOver` | CUIT con dígito verificador (`rave_cuit_ok`) o DNI de 7–8 dígitos; **cifrado** |
| **Tarjeta crédito / débito** | Marca (Visa, Mastercard, American Express, otras) | Obligatorio | Lista cerrada editable |
| | Tipo (débito / crédito) y **cuotas** | Obligatorio | Coherente con el medio elegido; cuotas enteras ≥ 1 y dentro del plan de N.3 |
| | N.º de cupón / lote / terminal | Obligatorio | Alfanumérico 1–20 |
| | **Código de autorización** | Obligatorio, **no relajable** | Patrón configurable por adquirente, por defecto `^[A-Za-z0-9]{4,12}$` (el adjunto habla de 6 dígitos: no es universal, `[VERIFICAR con el adquirente]`) |
| | **Últimos 4 dígitos** | Obligatorio | Exactamente 4 dígitos |
| **QR / pasarela** (Mercado Pago, MODO, BNA+, otras) | Proveedor / agregador | Obligatorio | Lista cerrada editable |
| | ID de transacción del proveedor (`payment_id`, `merchant_order_id`) | Obligatorio, **no relajable** | Alfanumérico 4–60; único por proveedor |
| | Estado | Ver abajo | `declarado` (cargado a mano) / `en_proceso` / `aprobado` / `acreditado` / `rechazado` / `reembolsado` |
| | Comisión aplicada y retenciones | Opcional | Sólo desde configuración fiable o dato del proveedor; nunca inventadas |

**Reglas de seguridad y verdad:**
1. **Nunca** se guarda número completo de tarjeta, vencimiento, CVV/CVC, PIN ni banda. Un detector rechaza lo tipeado en cualquier campo de texto que parezca un PAN (13–19 dígitos que pasan Luhn) con un mensaje claro y **sin guardarlo ni dejarlo en logs ni en auditoría**. Los últimos 4 dígitos y el código de autorización son lo máximo permitido; alcance PCI-DSS y marco del adquirente `[VERIFICAR]`.
2. **Estado del QR / pasarela:** hoy el sistema **no consulta** a ningún proveedor, así que todo lo cargado a mano queda `declarado` y se rotula «declarado por el cajero — sin verificar». Los estados `aprobado` / `acreditado` los escribe **sólo** el webhook verificado de la integración (O.2, 4.18); una captura de pantalla, la vuelta del navegador o un mensaje del cliente nunca acreditan. Sin conexión: «pendiente de verificación».
3. **Duplicados:** el mismo N.º de operación o ID de transacción no se acepta dos veces; el cajero ve «ya usado en la venta N.º …» (sin revelar datos de otro comercio). Sólo un supervisor puede autorizar un duplicado, con motivo, y queda en auditoría.
4. **Importe:** se pide el importe acreditado en el comprobante cuando difiere del cobrado; la diferencia se marca (no se redondea en silencio).
5. **Datos personales:** nombre y documento del ordenante, y toda clave sensible, se cifran **antes de salir del equipo** con la misma mecánica que los datos de clientes (`pii` de `COLS`); el servidor no los ve en claro; la API pública nunca los expone; en pantalla se enmascaran (`***1234`) y revelarlos requiere permiso y queda auditado. Finalidad, plazo de conservación y deber de informar `[VERIFICAR con asesor legal — Ley 25.326 y normativa vigente]`.
6. **Los controles de `payCheck` siguen siendo un único punto:** se amplía esa función (no se escribe un validador paralelo) y el servidor revalida estructura, unicidad y permisos al sincronizar.

**Excepción controlada («cobro sin comprobante»).** Si el comprobante no está disponible en el momento (se cayó la red del banco, falta el ticket del posnet), un supervisor puede autorizar cobrar con los campos relajables vacíos, con **motivo** obligatorio. La venta queda marcada `det_pendiente` y aparece en una lista **«Cobros a conciliar»**; completar el detalle agrega una **versión nueva** (no edita la venta). Los campos «no relajables» no admiten excepción. El cierre de caja muestra cuántos cobros digitales quedaron sin detalle.

**Matriz configurable (`pay.detail.on`, apagada por defecto).** En *Medios de pago y financiación* el administrador ve y ajusta, por medio, cada campo como `obligatorio` / `recomendado` / `oculto` (cada cambio con motivo y auditado), salvo los no relajables. En el sistema del cliente se enciende al entregar; los valores por defecto son los de la tabla. Con la bandera apagada, el cobro funciona como hoy.

**Captura por API:** cuando exista integración con un proveedor, los campos que éste devuelva se **precargan y se marcan «verificado»** (bloqueados para edición); los que no devuelva se cargan a mano como `declarado`. No se promete captura automática sin integración real.

### 4.23.5 Pantalla de cobro: comportamiento

- Al elegir Transferencia, Débito, Crédito o QR, el cobro abre un bloque **«Datos del comprobante»** con los campos del medio, validación en vivo, mensajes en castellano claro y botón de cobrar **bloqueado** hasta cumplir los obligatorios (o hasta la excepción de un supervisor). Teclado numérico en pantalla y áreas táctiles de 48 px; ningún campo numérico precarga «0».
- En pago mixto, cada medio digital tiene su propio bloque; el total debe seguir cerrando al centavo (regla de 4.20).
- Atajos: F2/F3 (débito/crédito) y el resto de F1–F12 de 4.2 **no cambian**; el foco pasa al primer campo del comprobante.
- Sin conexión se puede cobrar y guardar el detalle en el equipo; la unicidad se revalida al sincronizar y un conflicto queda visible para resolverlo, no se declara sincronizado.
- El **ticket** muestra, para cobros digitales, medio, últimos 4 dígitos y autorización o N.º de operación (nunca el titular ordenante ni datos internos).

### 4.23.6 Expediente digital de la transacción (drill-down)

**Acceso.** Desde cualquier venta, cobro, movimiento de caja, movimiento de stock, traspaso, nota de crédito, compra o cierre, un botón **«Ver expediente»** abre una vista (modal en celular, panel en escritorio) con enlace compartible interno `#expediente/<tipo>/<id>`. Permiso `audit_read` (administrador y supervisor por defecto) para el expediente completo; el cajero ve el de **sus** ventas sin costos, sin datos de otros usuarios y sin IP. Cada apertura de un expediente con datos sensibles queda auditada (`EXPEDIENTE_VISTO`).

**Contenido** (una sección plegable por bloque; todo lo que no exista aún se rotula «no aplica» o «no activado», nunca vacío ni inventado):
1. **Encabezado:** N.º de comprobante (`2-15`, `T-2-7`…), tipo (ticket interno / factura / NC / traspaso…), **canal** Mayorista / Minorista (`wch`), sucursal, caja, turno, vendedor y cajero (4.22.1), cliente con nombre, CUIT/DNI y condición fiscal (los datos que la ficha ya tiene; sin dato → «sin dato»), documento fiscal o interno y CAE si lo hay.
2. **Ítems:** código / SKU, descripción, **lote y vencimiento** (cuando exista F3; hasta entonces «sin lote»), **talle-color** (cuando exista F4), cantidad y unidad (U, kg, bulto, presentación), **precio de lista**, **regla de precio aplicada** (`lr`: `L1`, `P-<presentación>`, `ACU`, `MAN`; `ll` nombre de presentación; `lb` precio base), descuentos individuales y globales, cupón/beneficio, subtotal y total por línea. El costo y el margen se muestran sólo con `view_cost`.
3. **Formas de pago:** cada pago con su medio e importe y, para los digitales, **todos los campos de 4.23.4** (ordenante enmascarado), estado `declarado` / `verificado`, versión del detalle, si quedó `det_pendiente` y los vínculos al ticket y al movimiento de caja resultante. Vuelto y parte fiada separados (4.20).
4. **Impacto contable:** asiento(s) generados y su N.º **sólo con `accounting.on` (F7)**; sin eso, la sección dice «Contabilidad no activada» y muestra el impacto de **gestión** que sí existe: movimiento de caja, de stock, de cuenta corriente y rubro.
5. **Auditoría:** línea de tiempo con todos los eventos de esa operación (alta, cambios de precio, descuentos, anulación, nota de crédito, reimpresión, cambios de detalle de cobro, traspasos vinculados): fecha y hora, usuario, rol, **dispositivo** (id propio del equipo) y acción, con valor anterior y nuevo. La **IP** sólo la agrega el servidor y sólo se muestra a administradores (criterio de retención `[VERIFICAR con asesor legal]`). Verificación de la cadena de hash de esos eventos.
6. **Documentos vinculados:** venta ↔ nota de crédito ↔ factura ↔ (F2) pedido / remito / presupuesto ↔ cierre de caja que la incluye ↔ traspasos relacionados.

**Salidas:** impresión A4, PDF por impresión del navegador y CSV con fórmulas neutralizadas; columnas según permiso. Accesible por teclado, con texto alternativo y sin depender sólo del color. Rendimiento: carga el expediente de **una** operación, nunca baja todos los registros al navegador (en la nube, consulta paginada en servidor).

### 4.23.7 Registro de traspasos (pestaña administrativa)

- **Dónde:** *Cajas y sucursales → pestaña «Traspasos»* (reemplaza la tarjeta simple actual; no se duplica). Visible con `transfer_funds` o `audit_read`; el administrador ve todo; un usuario con el permiso ve los traspasos de las cajas y sucursales que su rol alcanza.
- **Filtros:** rango de fechas, sucursal de origen y de destino, caja, **usuario emisor**, **usuario autorizante**, estado (`completado`, `en_transito`, `recibido`, `con diferencia`, `devuelto`, `revertido`), estado de las cajas al traspasar (abierta / cerrada), rango de importe y rubro. Ordenamiento universal (4.15).
- **Indicadores:** total movido en el período, **fondos en tránsito** (importe y antigüedad), cantidad con diferencia, traspasos con caja cerrada. Cada KPI con su fórmula y período.
- **Fila → comprobante:** abre el comprobante (4.23.3) y su expediente (4.23.6); acciones según permiso: recibir, devolver, revertir (sólo administrador), reimprimir, exportar.
- **Exportación** CSV (`;`, UTF-8 con BOM, fórmulas neutralizadas) y A4 imprimible. Tabla accesible; en 360 px se transforma en tarjetas sin desborde.
- **Alertas:** en tránsito sobre `xfer.transitAlertH`, traspasos con diferencia, hora de equipo desfasada y huecos de numeración.

### 4.23.8 Pistas de auditoría inmutables (servidor)

**Tablas nuevas** de la migración `11-traspasos-cobros-auditoria.sql` (aditivas, idempotentes; patrón `rave_solo_agregar()` ya existente):
- `traspasos` — el comprobante. `unique(tenant_id, id)`, `unique(tenant_id, caja_origen, n)`, `amount_cents bigint check (> 0)`, `currency char(3)`, hash y hash previo.
- `traspaso_eventos` — máquina de estados sólo-agregar (`emitido`, `en_transito`, `recibido`, `recibido_con_diferencia`, `devuelto`, `revertido`, `anotado`), con usuario, hora de servidor, importe recibido y nota.
- `cobro_detalles` — detalle versionado (`sale_id`, `pay_idx`, `version`), campos sensibles cifrados, estado de verificación, hash; índice único parcial para N.º de operación y ID de transacción (duplicados).
- `auditoria_eventos` — la **misma tabla estructurada de 4.22.5/4.22.9** (`module, action, entity, entity_id, old_value, new_value, reason, user, role, device_id, ip, hash, hash_prev`). Si ya existe cuando se construya esta migración, se **extiende**; no se crea otra (regla de detección).

**Inmutabilidad en la base:**
- `BEFORE UPDATE OR DELETE` con `rave_solo_agregar()` en las cuatro tablas, y `REVOKE UPDATE, DELETE, TRUNCATE` para `authenticated`. Se escribe sólo mediante `sincronizar()` / funciones `SECURITY DEFINER` con `search_path` fijo; **la hora (`ts_servidor`) y la IP las pone el servidor**, no el cliente.
- Cadena de hash por comercio calculada por trigger al insertar, y función `rave_verificar_cadena(tenant)` que devuelve el primer eslabón roto. Pantalla de auditoría con botón «Verificar integridad».
- Una colección nueva exige actualizar `sincronizar()`, su política de lectura, exportación, importación y respaldo (regla de 6.1). Un registro rechazado no traba al resto del lote.
- **RLS en todas** (lectura sólo de miembros del comercio; escritura sólo por funciones), claves foráneas compuestas `(id, tenant_id)`, y prueba cruzada A/B.

**Límite declarado (no escribir «inalterable» sin esto):** la base impide modificar o borrar a los usuarios de la aplicación, pero un superusuario del proyecto o el rol de servicio podrían alterar la base: la defensa adicional son las copias de seguridad automáticas del proveedor `[VERIFICAR plan]`, el hash encadenado que **detecta** cambios y, opcionalmente, anclar el último hash fuera de la base (etapa futura). En el equipo, el encadenado detecta manipulación pero no la impide.

### 4.23.9 Banderas, permisos y configuración

| Elemento | Detalle | Defecto |
|---|---|---|
| `xfer.strict` | Exige `transfer_funds` (4.23.1) | Cliente: encendida al entregar, con el aviso de migración; demo: encendida |
| `xfer.closedMode` | `transito` / `saldo_inicial` (4.23.2) | `transito` |
| `xfer.approvalOver` | Importe (centavos) desde el cual exige autorizante | Vacío |
| `xfer.transitAlertH` | Horas para alertar un fondo en tránsito | Lo define el dueño |
| `pay.detail.on` | Detalle de cobros digitales y validadores (4.23.4) | Cliente: encendida al entregar; demo: encendida |
| `pay.maxAgeH`, `pay.ordOver` | Antigüedad máxima de una transferencia y monto desde el cual el ordenante es obligatorio | Los define el dueño |
| `audit.server` | Auditoría estructurada en servidor (4.23.8) | Encendida con la nube |
| Permisos nuevos | `transfer_funds` · `audit_read` (compartido con 4.22.12) · `pay_detail_edit` (completar detalles pendientes: administrador, supervisor y quien cobró) | Administrador siempre; el resto según 4.23.1 |

### 4.23.10 Modelo de datos y flujo

```
sales (pays[]) ──1:n── cobro_detalles (versión n)          sin editar la venta
cash_sessions ──< transfers (traspasos) ──< traspaso_eventos   sin editar el comprobante
cash_closings (sellado) <── from_closure_id / to_closure_id      sin editar el cierre
auditoria_eventos (entity, entity_id) ──> expediente de cualquier operación
```

Flujo de un traspaso con destino cerrado: `permiso (transfer_funds)` → `autorizante (PIN admin)` → comprobante `T-1-7` (estado cajas: origen abierta / destino cerrada) → evento `en_transito` → *(al abrir el destino)* recepción con importe → evento `recibido` o `recibido_con_diferencia` → cierre del turno del destino lo incluye en su esperado. Cada paso con auditoría, idempotente por id y reintentable sin duplicar.

### 4.23.11 Pruebas obligatorias (números conocidos, calculados de forma independiente)

1. **Permiso:** cajero, mostrador, operador y supervisor **sin** el permiso no ven ni ejecutan el traspaso (interfaz **y** servidor: `sincronizar` rechaza `ctransf`); con el permiso otorgado, sí; quitarlo lo bloquea; cada cambio queda auditado; el aviso de migración lista a los roles que tenían `close_cash` y no otorga nada solo.
2. **Cajas abiertas:** traspaso de $ 10.000 entre dos cajas abiertas → origen −10.000, destino +10.000, comprobante con los 8 campos, hash válido.
3. **Destino cerrada:** destino cerrada con cierre sellado; traspaso de $ 10.000 → `en_transito`, el **cierre sellado y su hash no cambian**, el esperado del destino no cambia hasta recibir; al abrir el turno y recibir $ 10.000 → esperado = apertura + 10.000; recibiendo $ 9.500 → `recibido_con_diferencia` de −$ 500, auditado.
4. **Origen cerrada:** caja con efectivo declarado $ 50.000 al cierre; retiro posterior de $ 10.000 con autorizante → sugerido de apertura **$ 40.000**; abrir con $ 39.000 registra diferencia de apertura −$ 1.000 con motivo; la sección «Movimientos posteriores al cierre» lo muestra y el cierre sigue idéntico.
5. **Ambas cerradas** y **entre sucursales:** autorizante obligatorio; el comprobante guarda ambas sucursales y los estados.
6. **Invariante:** con traspasos aleatorios en todos los estados, `enviado = recibido + en tránsito + diferencias + devuelto` siempre.
7. **Idempotencia y sin conexión:** doble clic y reenvío del mismo lote no duplican el comprobante; dos equipos creando traspasos de la misma caja no repiten número; huecos de numeración se detectan y se informan.
8. **Inmutabilidad:** `UPDATE` y `DELETE` sobre `traspasos`, `traspaso_eventos`, `cobro_detalles` y `auditoria_eventos` son **rechazados por el servidor**, también con la sesión de un administrador y desde PostgREST; la cadena de hash es válida; alterar un eslabón se detecta con `rave_verificar_cadena`.
9. **Detalle de cobro:** transferencia con todos los campos → válida; sin N.º de operación → bloquea; N.º repetido → rechazado y sólo un supervisor lo autoriza con motivo; fecha futura y fecha vieja rechazadas; CUIT con dígito inválido rechazado; tarjeta: últimos 4 dígitos de 3 o 5 cifras rechazados; **un PAN de 16 dígitos con Luhn válido tipeado en cualquier campo se rechaza y no aparece en datos, logs, auditoría ni exportaciones**; autorización fuera del patrón rechazada; QR manual queda `declarado` y **nunca** `acreditado`.
10. **Pago mixto:** venta de $ 75.000 = $ 10.000 efectivo + $ 15.000 QR + $ 50.000 transferencia → el expediente lista los 3 medios, con detalle del QR y de la transferencia; el efectivo esperado de la caja suma **sólo** $ 10.000; el total cierra al centavo.
11. **Excepción:** cobro sin comprobante con supervisor y motivo → venta `det_pendiente`, aparece en «Cobros a conciliar»; completar el detalle crea la **versión 2** y la venta no cambia; los campos no relajables no admiten excepción.
12. **Expediente:** una venta con descuento, regla `P-fardo`, vendedor distinto del cajero, pago mixto y nota de crédito muestra encabezado, ítems, pagos, auditoría y vínculos correctos; sin `accounting.on` dice «Contabilidad no activada» (no inventa asiento); el cajero no ve costos ni IP; abrirlo queda auditado; CSV con fórmulas neutralizadas.
13. **Registro de traspasos:** cada filtro (fecha, sucursal, caja, emisor, autorizante, estado, importe, rubro) devuelve el conjunto esperado sobre un conjunto de datos conocido; KPIs y exportación coinciden con el cálculo independiente; 360 px sin desbordes.
14. **Seguridad y aislamiento:** RLS A/B en todas las tablas nuevas, RPC y exportaciones; `tenant_id` manipulado; XSS en motivo, banco, titular y observaciones; ordenante cifrado (no aparece en claro en la base, la API pública ni el menú); IDOR sobre `#expediente/…`; límites de intentos de PIN.
15. **Regresión y forma:** con las banderas **apagadas** el comportamiento y las suites previas no cambian; encendidas y apagadas en la misma base (el estado anterior carga sin errores, los traspasos viejos se leen con valores por defecto); cierres sellados anteriores intactos y verificables; sincronización idempotente; 320/360/768/1024/1440 sin desbordes y con áreas táctiles medidas con números (≥ 44/48 px); consola sin errores; `file://` y `https`.

### 4.23.12 Criterios de aceptación

- Migración `11` aplicada y probada **dos veces**: sobre base nueva y sobre la base con datos, con respaldo previo y restauración verificada; pruebas de 4.23.11 verdes; **regresión completa verde** con banderas apagadas y encendidas; revisión independiente de seguridad (permisos, PAN, cifrado del ordenante, inmutabilidad); documentación y publicación en el cliente (`AlmacenRAVE`) y en la demo (`raveV2`). Nada se declara «100 % funcional».
- **Dependen de terceros:** adquirentes y procesadoras (formato del código de autorización, N.º de cupón, terminal), bancos y billeteras (formato de comprobantes), integración con Mercado Pago / MODO / BNA+ para verificar estados (O.2, 4.18), asesor legal (datos personales, conservación, PCI-DSS), contador (asientos de F7).
- **Fuera de alcance:** conciliación bancaria automática (importar extractos), multimoneda, verificación del comprobante contra el banco, captura automática sin integración, anclaje externo del hash, pantalla del cliente con estos datos.

### 4.23.13 Contradicciones o puntos técnicos del adjunto y decisión tomada (regla 2 de la sección 2)

| El adjunto pide | Choca con | Decisión por defecto (configurable) |
|---|---|---|
| `ID_Movimiento` único **y consecutivo** | El sistema funciona sin conexión con varios equipos: un consecutivo global sin huecos requiere servidor | `id` único idempotente + número consecutivo **por caja de origen** (como los tickets); el servidor impone unicidad y detecta huecos (4.23.3) |
| Traspaso permitido con cajas cerradas | El cierre sellado es inmutable (4.5) | El cierre no se toca: «fondo en tránsito» o saldo inicial sugerido, en registros aparte (4.23.2) |
| Sólo con permiso explícito del administrador | Hoy basta `close_cash` | `transfer_funds` + `xfer.strict` + aviso de migración; nada se otorga en silencio (4.23.1) |
| Autorizante «por token/clave de un administrador» | La verificación del PIN ocurre en el equipo | Se registra método y administrador; el servidor valida existencia, rol y que sea distinto del emisor; límite declarado |
| Datos de cobro **obligatorios** | Velocidad del mostrador, red caída, comprobantes que no existen aún | Matriz configurable; «cobro sin comprobante» con supervisor y motivo; campos no relajables (N.º de operación, autorización, ID del proveedor) |
| «Captura por API» | No hay integración que devuelva datos de pago | Carga manual `declarado`; `verificado` sólo con integración real |
| «Estado en tiempo real: Aprobada / Acreditada» | Sin conexión y sin consulta al proveedor no se puede saber | No se afirma; solo el webhook verificado acredita (O.2) |
| «Comisión y retenciones teóricas» | No inventar tasas (N.3) | Sólo con datos fiables de configuración o del proveedor; si no, vacío |
| «Código de autorización de 6 dígitos» | Varía según adquirente | Patrón configurable (`[VERIFICAR con el adquirente]`) |
| «Últimos 4 dígitos» | PCI-DSS | Sólo últimos 4 + detector de PAN que rechaza y no guarda |
| Titular ordenante (nombre y CUIT/DNI) | Datos personales (Ley 25.326) | Cifrado en el equipo, enmascarado, acceso auditado, conservación `[VERIFICAR]` |
| «Número de asiento contable generado automáticamente» | No existe contabilidad (4.22.8) | Se muestra con `accounting.on` (F7); antes, «Contabilidad no activada» |
| «IP / Dispositivo» en la auditoría | Datos personales; el navegador no conoce su IP pública | Dispositivo = id propio del equipo; IP sólo agregada por el servidor (4.22.13) |
| Tabla «inmutable» | Superusuarios del proyecto | Triggers sólo-agregar + `REVOKE` + hash encadenado; límite declarado (4.23.8) |
| «Pestaña de registro de traspasos» | Ya hay una tarjeta con lista | Se extiende como pestaña con filtros, no se duplica |
| Moneda del traspaso | El sistema es monomoneda (ARS) | Campo `currency = 'ARS'`; multimoneda fuera de alcance |

### 4.23.14 Orden de construcción (prioridad de entrega)

La decisión de qué se construye es del dueño; el orden recomendado, cada paso con **regresión completa verde y publicación** (ninguno deja el sistema a medias) y todos en la **migración 11**:

| Paso | Contenido | Depende de |
|---|---|---|
| G1 | Permiso `transfer_funds` + `xfer.strict` + aviso de migración; comprobante con 8 campos e impresión; estados y cajas cerradas (tránsito / saldo sugerido); pestaña «Traspasos» con filtros | — |
| G2 | Detalle de cobros digitales: registro versionado, validadores en `payCheck`, matriz configurable, excepción y «Cobros a conciliar», detector de PAN, cifrado del ordenante | G1 no; puede ir en paralelo |
| G3 | Expediente digital + auditoría estructurada del servidor (`auditoria_eventos`, `rave_verificar_cadena`) + tablas sólo-agregar | G1 y G2 (usa sus datos) |

Antes de cada paso: inspeccionar (sección 12), listar supuestos, escribir las pruebas junto con el código. **Preguntas que se hacen una sola vez y juntas** (se suman a E.6): ¿modo de caja cerrada `transito` o `saldo_inicial`? · ¿importe desde el cual se pide autorizante? · ¿horas de alerta de fondo en tránsito? · ¿qué campos de cada medio digital son obligatorios en el mostrador? · ¿antigüedad máxima aceptada para una transferencia? · ¿quién puede ver el expediente completo y los datos del ordenante? · ¿qué cuentas bancarias y proveedores de QR usa el comercio?

---

## 4.24 DETALLE DE LAS VENTAS DE LA CAJA, CAJAS SIN LÍMITE DE OPERACIONES Y ADMINISTRACIÓN DE LOS CLIENTES DEL CLUB (V26.8)

**Estado: ESPECIFICACIÓN. Nada de 4.24 está implementado al 2026-10-19** (matriz 4.24.0). Dos pedidos del dueño: (A) que en **Caja → «Ventas de esta caja»** se pueda ver el **detalle completo de cada operación** (minorista y mayorista) además de los movimientos que generó, y que una caja **no tenga límite** de ventas por turno; (B) que el **administrador pueda editar y borrar** a los clientes del Club. Es **aditivo**: extiende 4.5, 4.6, 4.22 y 4.23; con sus banderas apagadas el comportamiento es el de hoy.

### 4.24.0 Matriz de detección (inspección del código real, 2026-10-19)

| Requisito | Estado hoy | Qué hacer |
|---|---|---|
| «Ventas de esta caja» en *Caja* | **Existe** (`p3-ops.js`, vista `caja`): tabla de **todas** las ventas de la sesión (sin recorte) con N.º, hora, medio, estado, total y los botones *Cobro* (si está pendiente) y *Anular* (con permiso `void`). **No hay detalle:** no se ven ítems, regla de precio, cliente, canal ni los movimientos generados | **Completar** esa misma tabla (no crear otra pantalla): detalle de operación (4.24.1) |
| Detalle de la operación | **No existe** vista de desglose (el expediente de 4.23.6 tampoco existe aún) | **Una sola vista** `saleDetail`: se construye acá con el contenido mínimo y 4.23.6 la **amplía** (no se hacen dos) |
| Venta minorista y mayorista | **Existe:** canal por operación `wch`; cada ítem guarda `lr` (regla), `ll` (presentación) y `lb` (precio base) | Mostrar el canal y la regla en la tabla y en el detalle |
| Límite de ventas por caja o turno | **No existe ningún tope** (la tabla no recorta; las ventas se numeran por caja) | **Fijarlo como regla** (4.24.2) y probarlo con volumen |
| Alcance de la caja por canal | 4.22.6 propone `channel_scope` (minorista / mayorista / ambos) | Queda **opcional y por defecto `ambos`** (4.24.6) |
| Editar un cliente del Club | **Existe** (`A.cuEdit`, ficha con nombre, apellido, WhatsApp, nacimiento, DNI, observaciones, consentimientos y datos mayoristas); permiso `customers`, algunos campos sólo con `config` | **Completar:** reglas de edición del administrador, consentimientos con constancia, duplicados por WhatsApp, auditoría con valor anterior y nuevo (4.24.3) |
| Borrar un cliente del Club | **Parcial:** sólo **baja** que **anonimiza** (`A.cuBaja`: pasa a `status='baja'`, borra nombre, WhatsApp, cumpleaños, DNI y tarjeta, conserva ventas y cuenta corriente); la puede ejecutar quien tenga `customers`. **No hay eliminación definitiva** | **Completar:** baja y eliminación definitiva **sólo del administrador**, con reglas por historial (4.24.4) |
| Baja de un cliente propagada a todos los equipos | **Existe** el mecanismo de lápidas (`del:1` en la colección `clientes`) | Reutilizarlo; agregar la validación de rol en el servidor |

### 4.24.1 «Ventas de esta caja» con detalle de cada operación

**Tabla (se amplía la actual, sin duplicarla).** Columnas: N.º (`2-15`), hora, **canal** (Minorista / Mayorista, con texto además del color), cliente, vendedor, ítems (cantidad de líneas), **descuento**, medio(s) de pago, documento (ticket interno / factura / nota de crédito), estado, total y acciones (*Ver detalle*, *Cobro*, *Anular*, con los permisos de hoy). La fila entera se abre con clic, toque o Enter.
- **Filtros y búsqueda** (sin cambiar otras pantallas): canal, estado, medio de pago, cliente, vendedor, rango de horas y búsqueda por N.º o importe. Orden universal (4.15).
- **Totales de la sesión** siempre visibles y que **cierran con el arqueo**: ventas por canal, por medio de pago y por estado; los anulados y las notas de crédito se informan aparte (no se suman como venta).
- **Sin tope:** la lista no recorta ni pagina de forma que oculte operaciones; si hay muchas se usa **desplazamiento virtual** o paginación con total visible (4.24.2).

**Detalle de la operación (`saleDetail`).** Modal en celular y panel lateral en escritorio; abre desde esta tabla, desde la lista de *Ventas*, desde *Cajas cerradas* (sólo lectura) y desde el movimiento de caja que la originó. Contenido mínimo (4.23.6 lo amplía con el detalle de cobros digitales, auditoría completa e IP del servidor):
1. **Encabezado:** N.º, fecha y hora, caja, sucursal, turno, **canal**, vendedor, cajero, cliente (nombre, CUIT/DNI y condición fiscal si están cargados) y documento (con CAE si lo tiene).
2. **Ítems:** código/SKU, descripción, cantidad y unidad o **presentación** (Unidad, Display, Fardo, Pallet…), precio de lista, **regla de precio aplicada** (`L1`, `P-<presentación>`, `ACU`, `MAN`) con su explicación en castellano, descuentos de línea y globales, cupón o beneficio, subtotal y total. Costo y margen sólo con `view_cost`.
3. **Pagos:** cada medio con su importe, comisión (`fee`) si hay, vuelto y parte fiada (4.20); en pagos mixtos, uno por renglón.
4. **Movimientos que generó la operación** (el pedido «además de los movimientos»): movimiento(s) de caja por medio (con su rubro), movimientos de stock por línea (en **unidad base**, con el equivalente en presentaciones), asiento en la cuenta corriente del cliente, sellos o cupones del Club otorgados o consumidos, y —si existen— nota de crédito, anulación o reversa vinculadas. Cada movimiento enlaza con su registro y muestra usuario, fecha y hora.
5. **Línea de tiempo de auditoría** de esa operación (precio cambiado a mano, descuentos, anulación, reimpresión) con usuario y valor anterior y nuevo.

**Permisos:** el cajero ve las operaciones de **su** caja y de **su** sesión abierta, sin costos; supervisor y administrador ven todas las cajas; abrir un detalle no modifica nada. Todo dato se escapa al mostrarse (anti-XSS) y el CSV neutraliza fórmulas.
**Forma:** 360 px sin desbordes (la tabla pasa a tarjetas), áreas táctiles de 48 px, teclado completo, impresión A4 del detalle.

### 4.24.2 Las cajas no tienen límite de operaciones por turno

**Regla:** una caja puede hacer **todas las operaciones que necesite en su turno**, sin tope de cantidad de ventas, de líneas, de importe acumulado, de ingresos y egresos ni de cobros de cuenta corriente, y **mezclando** ventas minoristas y mayoristas. Quedan **permitidas** en el turno: vender (todos los medios y el pago mixto), cobrar cuenta corriente, ingresos y egresos con rubro, reintegros, notas de crédito, anulaciones (con permiso `void`) y, con el permiso `transfer_funds`, traspasos.
- **Lo que sí sigue vigente son reglas de negocio, no límites de la caja:** stock (no negativo), límite de crédito y mora del cliente (4.22.2), permisos por rol, piso de precio y las validaciones de cobro. Ninguna de ellas cuenta ventas.
- **Numeración:** el consecutivo por caja (`2-15`) sigue creciendo **sin reiniciarse ni toparse** por turno ni por día; dos equipos no repiten número.
- **Rendimiento (único límite técnico admitido, y se mide, no se supone):** apertura de la caja, listado, arqueo, cierre sellado, sincronización (lotes de 200) y exportación funcionan con un turno de **miles** de operaciones sin congelar la pantalla; si algún cálculo lo necesita, se hace por **lotes o en segundo plano** con indicador de progreso, nunca recortando datos. El cierre sellado incluye **todas** las ventas de la sesión.
- Una alerta **opcional** de efectivo acumulado (sugerir un retiro a caja fuerte) es sólo un aviso configurable y apagado por defecto; **no bloquea** vender.

### 4.24.3 Clientes del Club: edición por el administrador

- **Quién:** el administrador (`config`) edita **cualquier** cliente del Club desde *Clientes* y desde la ficha en *Fidelización*. La edición básica (nombre, apellido, observaciones) conserva el permiso `customers` de hoy (sin regresión); **WhatsApp, DNI, fecha de nacimiento, consentimientos y datos mayoristas (CUIT, canal, plazo, zona, vendedor)** requieren además administrador o el permiso nuevo `customers_admin`. La regla se valida **en el servidor**, no sólo ocultando botones.
- **Qué se puede editar:** nombre, apellido, WhatsApp, correo, fecha de nacimiento, DNI, observaciones, canal y datos mayoristas, estado (activo / suspendido) y **consentimientos**.
- **Validaciones (las del alta, un solo validador):** fecha con año de 4 cifras y validador de **fecha de nacimiento** (no el de operaciones: 21/05/1990 es válida); WhatsApp normalizado a +54 9 y comparado por los **últimos 10 dígitos**; si el número ya pertenece a otro socio se ofrece **fusionar** (con vista previa) y nunca se pisa en silencio; menor de 18 años: sin beneficios de alcohol ni comunicaciones (P.7).
- **Consentimientos:** el administrador puede **revocarlos** libremente. **Otorgar** uno (por ejemplo, comunicaciones comerciales) exige una **constancia** escrita (cómo y cuándo lo dio el titular) y se registra con origen «administrador», versión del aviso, fecha, hora y motivo; sin constancia no se activa.
- **Sellos, puntos y cupones no se editan a mano:** se corrigen con un **movimiento compensatorio** auditado y con motivo (O.3). El N.º de socio no cambia.
- **Auditoría:** cada edición genera `CLIENTE_EDITADO` con el campo, el valor anterior y el nuevo; los datos personales **se enmascaran** en el registro (por ejemplo «WhatsApp cambiado …567», nunca el número entero) y WhatsApp, correo y DNI siguen **cifrados** en la base.
- Con la nube, el cambio se propaga a todos los equipos y la API pública y el menú **nunca** exponen estos datos. Dos ediciones simultáneas se resuelven con la última guardada y se informa el conflicto (límite conocido de 6.1).

### 4.24.4 Clientes del Club: baja y eliminación por el administrador

Dos niveles, **sólo administrador** (o `customers_admin`). Hoy la baja puede hacerla quien tenga `customers`: pasa a ser del administrador (cambio declarado en 4.24.6).
1. **Baja (anonimizar):** es la de hoy. Conserva ventas, cuenta corriente y comprobantes con su identificador interno; borra nombre, apellido, WhatsApp, correo, nacimiento y DNI; revoca la tarjeta. Siempre disponible.
2. **Eliminación definitiva:** borra el registro y sus lápidas en todos los equipos. **Sólo se ofrece si el cliente no tiene historial** (ventas, cobros, cuenta corriente, deuda, canjes, cupones usados, membresías, traspasos o documentos fiscales); si lo tiene, el botón se reemplaza por la explicación «tiene historial: sólo se puede dar de baja» con la lista de lo que lo bloquea. Los comprobantes fiscales conservan los datos del receptor que exige la ley y **no se tocan** `[VERIFICAR con asesor legal: conservación, derecho de supresión de la Ley 25.326 y normativa vigente]`.
- **Deuda:** con saldo de cuenta corriente > 0 la baja y la eliminación se **bloquean** por defecto; el administrador puede continuar sólo con una decisión explícita y auditada: cobrar primero, **condonar** mediante un movimiento compensatorio con motivo, o mantener la deuda asociada al registro anonimizado (queda en «Deudas de clientes dados de baja»).
- **Confirmación doble:** se pide el motivo y se escribe el **N.º de socio** para confirmar; un solo toque nunca elimina. Todo con `BAJA_CLIENTE` o `CLIENTE_ELIMINADO` en auditoría (sin datos personales en claro).
- **Efectos en cadena:** se **revocan** la tarjeta del Club (se rota la clave secreta; el QR, el código de 8 dígitos y el NFC dejan de validar) y el pase de Wallet si existiera; se **cancelan** los envíos pendientes de WhatsApp y correo; se excluye de campañas; una **alta pendiente del menú** con el mismo WhatsApp se marca «rechazada: eliminado por el administrador» para que **no reaparezca** al importarse; un equipo sin conexión que luego suba una edición de un cliente eliminado recibe un **rechazo visible**, no lo resucita.
- **Servidor:** la validación de rol para editar campos sensibles, dar de baja y eliminar se agrega a `rave_puede_escribir` y entra en la **migración `11`** (la única aún no creada); la eliminación respeta la lápida existente y las claves foráneas.
- Fuera de alcance: eliminación masiva de clientes y deshacer una eliminación definitiva (se recupera sólo desde un respaldo).

### 4.24.5 Pruebas obligatorias (números conocidos, calculados de forma independiente)

1. **Detalle:** turno con 1 venta minorista (2 u × $ 100 = $ 200) y 1 mayorista (1 Fardo de 12 u a $ 85 por unidad = $ 1.020, regla `P-fardo`): la tabla muestra ambas con su canal, el detalle muestra ítems, regla y descuento, los pagos y los **movimientos generados** (caja por medio, stock −2 u y −12 u en unidad base, cuenta corriente si se fió); los totales de la sesión suman $ 1.220 y coinciden con el arqueo.
2. **Pago mixto y estados:** una venta con efectivo + QR + transferencia muestra los tres renglones; una anulada y una nota de crédito aparecen aparte y no suman como venta; una pendiente ofrece *Cobro*.
3. **Sin límite:** un turno con **5.000** ventas mixtas (3.000 minoristas + 2.000 mayoristas), ingresos, egresos y cobros de cuenta corriente: el listado las muestra **todas**, la suma del listado = KPI del arqueo = total del cierre sellado; la numeración llega a 5.000 sin saltos ni repeticiones con dos equipos; la pantalla no se congela (tiempos medidos y registrados en el informe); la sincronización es idempotente.
4. **Permisos y forma:** el cajero ve sólo su sesión y sin costos; supervisor y administrador ven todas las cajas; el detalle de un cierre es de sólo lectura; XSS en cliente, observaciones y nombre de presentación; 320/360/768/1024/1440 sin desbordes y táctiles ≥ 48 px; consola sin errores; CSV con fórmulas neutralizadas.
5. **Edición de clientes:** el administrador edita todos los campos; un usuario con sólo `customers` no puede cambiar WhatsApp, DNI, nacimiento ni consentimientos (interfaz **y** servidor); fecha 21/05/1990 válida y año de 2 cifras rechazado; WhatsApp duplicado por los últimos 10 dígitos ofrece fusionar; otorgar consentimiento sin constancia se rechaza; revocar funciona; el registro de auditoría guarda el valor anterior y el nuevo con datos personales enmascarados; los datos siguen cifrados.
6. **Baja y eliminación:** cliente sin historial → eliminación definitiva en **todos** los equipos (lápida) y desaparece de listados, tarjeta, campañas y búsquedas; cliente con ventas → sólo baja, y las ventas, la cuenta corriente y los comprobantes siguen intactos; cliente con deuda → bloqueado hasta cobrar, condonar con motivo o mantener la deuda; confirmación doble con N.º de socio; tarjeta revocada (el QR y el código dejan de validar); alta pendiente del menú no reaparece; edición tardía de un equipo sin conexión rechazada con aviso; un usuario sin permiso es rechazado **en el servidor**.
7. **Seguridad y aislamiento:** RLS A/B en edición, baja y eliminación; `tenant_id` manipulado; la API pública y el menú sin datos de clientes; el sello 1 por 24 h y el alta al Club siguen funcionando igual (regresión de 4.6).
8. **Regresión:** con las banderas apagadas el comportamiento y las suites previas no cambian; cierres sellados anteriores verificables; estado previo carga sin errores.

### 4.24.6 Contradicciones o puntos a decidir y decisión tomada (regla 2 de la sección 2)

| El pedido | Choca con | Decisión por defecto (configurable) |
|---|---|---|
| «Las cajas no tienen límites de ventas» | 4.22.6 propone `channel_scope` por caja (minorista / mayorista / ambos) | `channel_scope` queda **opcional y por defecto `ambos`**: ninguna caja se restringe salvo que el dueño lo configure expresamente |
| Que el administrador pueda editar y borrar | Hoy edita y da de baja cualquiera con `customers` | La baja y la eliminación pasan a **administrador** (o `customers_admin`); la edición básica no cambia; el cambio se avisa al administrador en el primer ingreso tras actualizar (misma mecánica de 4.23.1) |
| «Borrar» al cliente | Las ventas, la cuenta corriente y los comprobantes fiscales referencian al cliente | Eliminación definitiva sólo sin historial; con historial, baja que anonimiza (conserva lo contable y fiscal) |
| Editar consentimientos | El consentimiento lo da el titular (Ley 25.326) | El administrador revoca libremente; otorgar exige constancia y queda registrado como «administrador» |
| «Detalle … además de los movimientos» | 4.23.6 (expediente) todavía no existe | Una sola vista `saleDetail`: se construye en 4.24 con lo que ya existe y 4.23.6 la amplía |

### 4.24.7 Orden de construcción y criterios de aceptación

| Paso | Contenido | SQL |
|---|---|---|
| H1 | «Ventas de esta caja»: columnas, filtros, totales, vista `saleDetail` con movimientos generados; detalle en *Cajas cerradas* | — |
| H2 | Prueba de volumen (5.000 ventas por turno) y ajustes de rendimiento si hacen falta | — |
| H3 | Clientes del Club: reglas de edición, consentimientos con constancia, baja y eliminación del administrador, efectos en cadena | `rave_puede_escribir` y estado de `club_altas` dentro de la **migración 11** |

Un paso se da por terminado sólo con sus pruebas de 4.24.5 verdes, **regresión completa verde** con banderas apagadas y encendidas, revisión independiente de seguridad para H3 (permisos, eliminación y datos personales) y publicación en el cliente (`AlmacenRAVE`) y en la demo (`raveV2`). Nada se declara «100 % funcional». **Dependen de terceros:** asesor legal (conservación y supresión de datos personales). **Fuera de alcance:** eliminación masiva, deshacer una eliminación definitiva, edición directa de sellos o puntos.

---

## 4.25 TARJETA DEL CLUB PORTÁTIL: GUARDARLA, VOLVER A VERLA Y RECUPERARLA (V26.10)

**Estado: IMPLEMENTADO en V26.10** (partes `p6d-cardportable.js`, `pub/post.js`, `pub/blocks.html`, `p6-loyalty.js`, `p2-core.js`, `p9-cloud.js`; prueba `k1.py`). Corrige un error real: el cliente **no podía guardar su tarjeta ni volver a verla** (si se borraba el almacenamiento del navegador o cambiaba de celular, la perdía). Es **aditivo**: no cambia el cálculo de sellos, el antifraude ni los cupones.

**4.25.1 Requisitos**
1. **Guardar en el celular:** botón «Guardar mi tarjeta» que (a) descarga la tarjeta como **imagen PNG con su QR**, (b) ofrece compartirla (Web Share con archivo; si no existe, descarga) y (c) pide al navegador **almacenamiento persistente** (`navigator.storage.persist`). Además la tarjeta se **replica** en IndexedDB (espejo) para sobrevivir a la limpieza de `localStorage`.
2. **Volver a verla:** al abrir el menú, si falta la tarjeta en `localStorage` pero existe el espejo, se restaura sola. Sin ninguna de las dos, el menú ofrece «Recuperar mi tarjeta».
3. **Enlace personal de la tarjeta (`#tarjeta=…`):** el administrador lo genera desde la ficha del cliente («Enlace de la tarjeta»), con copiar y envío por WhatsApp (`wa.me`). Al abrirlo en otro celular, la tarjeta se importa y queda guardada. **Es una llave:** quien lo tenga puede sellar con esa tarjeta; se advierte «no lo compartas». **Regenerar/anular un enlace ya entregado NO está implementado** (mejora pendiente: rotar el secreto de la tarjeta).
4. **Pedido por WhatsApp:** el cliente sin tarjeta puede pedirla al local con un mensaje prearmado; el local responde con el enlace del punto 3. No se otorgan sellos por pedirla.
5. **Wallet (Apple/Google):** sigue **pendiente de certificados y cuentas del comercio** (ver 4.19). El PNG con QR es el sustituto honesto mientras tanto; nunca se afirma que la tarjeta está en la Wallet.
6. **Nube:** el alta del Club en nube replica el espejo tras unirse; la recuperación en nube usa `pubCloudCard`/`pubCloudCode` sin exponer el secreto de otros clientes.

**4.25.2 Seguridad y privacidad**
- El secreto de la tarjeta **nunca** va a logs ni a la auditoría: el evento `TARJETA_ENLACE` registra quién y cuándo, **sin el secreto**.
- El enlace usa el fragmento `#` (no viaja al servidor ni a registros de acceso) y se borra de la barra de direcciones al importarse.
- El sello sigue validándose en el mostrador y en el servidor (código con ventana temporal, 1 sello por día por cliente, nonce). Tener la imagen de la tarjeta no permite sellar por sí sola sin el código vigente.
- A un cliente dado de baja no se le puede generar enlace ni importar su tarjeta (`pubCardPortable` devuelve nulo).

**4.25.3 Pruebas obligatorias (`k1.py`, 29 verificaciones):** guardar PNG, espejo en IndexedDB, restauración tras borrar `localStorage`, importación por enlace, secreto ausente de auditoría y de logs, cliente dado de baja sin enlace, pedido por WhatsApp, 320/360 px, textos ES/EN.

**4.25.4 Límites declarados:** recuperación en nube de extremo a extremo **sin probar contra un Supabase real**; Wallet real sin implementar; si el cliente borra todo y nadie le reenvía el enlace, el local debe emitir uno nuevo (por diseño: sin identidad verificada no se entrega la tarjeta).

---

## 4.26 MENÚ PÚBLICO: «MENÚ LOCAL» O «TIENDA CON ENVÍOS» (OPCIONAL POR COMERCIO) (V26.10)

**Estado: IMPLEMENTADO en V26.10** (partes `p5b-store.js`, `p5-menu-boot.js`, `pub/post.js`, `build/pub_body.html`, `pub/extra.css`; prueba `k2.py`). Pedido del dueño: que el menú público pueda funcionar **como una tienda online (estilo Tienda Nube)** para el comercio que quiera vender a otras provincias (ejemplo: un almacén que vendió vasos a Buenos Aires), **sin obligar** a los demás. Es **opcional por comercio** y **aditivo**: por defecto queda en «Menú local» y el comportamiento anterior no cambia.

**4.26.1 Modos (Administración → Menú público → «Tipo de menú público»)**
- **Menú local (por defecto):** carta/catálogo y pedido por WhatsApp, retiro o entrega local, como hasta ahora.
- **Tienda con envíos:** suma al pedido por WhatsApp: **datos de entrega** (nombre, provincia, localidad, dirección, indicaciones), **costo de envío estimado por provincia**, **envío gratis desde un monto**, plazo estimado, transportista informativo, **compra mínima**, y regla para **resto del país** (cotización a convenir o tarifa fija).
- Opciones del modo tienda: retiro en el local, entrega local, tabla de zonas por provincia (24 jurisdicciones), alcohol «no se envía» / «se envía» (por defecto **no**: el alcohol no sale de la entrega local salvo decisión expresa y verificada [VERIFICAR normativa provincial y de transporte]).

**4.26.2 Reglas**
1. El pedido sigue siendo una **solicitud por WhatsApp**, no una venta ni un cobro: el envío mostrado es **estimado** y el POS recalcula precios al cobrar (decisión de arquitectura vigente). Cobro online y cotización de transportistas por API quedan **pendientes de proveedor** (4.18).
2. Montos del envío en **centavos enteros** en la configuración y publicados en pesos; nunca costo, margen ni stock en la API pública.
3. Validación al armar el pedido: provincia obligatoria, dirección completa, mínimo de compra, productos con alcohol bloqueados si el modo lo prohíbe; mensajes claros sin perder el carrito.
4. El mensaje de WhatsApp agrega: ENTREGA, Recibe, Dirección, Indicaciones, Envío y **Total con envío estimado**.
5. Los datos de entrega del comprador **no se guardan en el servidor** por esta función (viajan sólo en el mensaje que el cliente envía); no se listan en el menú.
6. Configuración con borrador/publicación y versión como el resto del menú (P.11); el cambio de modo se audita (`MENU_TIPO`) y sólo lo hace el administrador o rol autorizado.
7. Si el comercio no completa zonas, el modo tienda muestra «a convenir», nunca tarifas inventadas.

**4.26.3 Pruebas obligatorias (`k2.py`, 37 verificaciones):** modo local sin cambios, modo tienda con provincia dentro/fuera de zonas, envío gratis por monto, mínimo, alcohol bloqueado, resto del país, mensaje de WhatsApp, permiso de mostrador denegado, borrador vs. publicado, auditoría `MENU_TIPO`, 320/360 px, ES/EN.

**4.26.4 Límites declarados:** sin pasarela de pago, sin cotización en vivo de Correo Argentino/Andreani/etc., sin etiquetas de envío ni seguimiento; tarifas cargadas a mano por el dueño; normativa de envío de alcohol y de ventas a distancia (botón de arrepentimiento, defensa del consumidor) a verificar con asesor [VERIFICAR].

---

## 4.27 CIERRE DE CAJA POR RUBRO (CADA RUBRO ES UNA PERSONA) E INGRESO/EGRESO A LA CAJA DEL RUBRO (V26.11)

**Estado: IMPLEMENTADO en V26.11** (partes `p3-ops.js` —`arqueoCalc`, `buildReport`, Arqueo, Cajas cerradas—, `p3i-rubcash.js`; prueba `k3.py`). Pedido del dueño de Almacén RAVE: el cierre no se entendía. Aditivo: no cambia ventas, stock ni el sello del cierre; sólo agrega datos y reordena la lectura.

**4.27.1 Reglas**
1. **Cada rubro es una persona** (responsable). En *Arqueo y cierre*, en *Caja* y en el detalle de *Cajas cerradas* se muestra, **por rubro**: **vendió**, **ganancia de ventas**, **movimientos** (ingresos y egresos de ese rubro) y **caja física del rubro** (efectivo que cobró + ingresos − egresos − su parte del sueldo y de los gastos si se pagaron de la caja), con el desglose de lo cobrado en efectivo, digital y a cuenta corriente.
2. **Cierra con el cajón:** suma de cajas por rubro + fondo de apertura y traspasos = efectivo esperado. Cualquier diferencia sin rubro se muestra como «diferencia sin rubro».
3. **Liquidación (orden fijo):** ganancia de sus ventas (con sus movimientos) → **sueldo del empleado a medias** entre los rubros que reparten → gastos a medias → **impuesto que se separa** (por defecto **$ 30.000 para cada uno**, editable por persona y por día; si nunca se configuró, se usa ese valor) → **ganancia propia**. Con la opción «se suma y se divide a partes iguales» (**por defecto**) se suman las ganancias propias y a cada uno le corresponde la mitad; con «cada uno la suya» (`cfg.profitMode='each'`) cada uno se queda con la propia. Lo elige el administrador en el Arqueo.
4. **Merienda eliminada:** su costo ya está incluido en las horas pagadas. Se quitó el campo, el cálculo y la línea del informe (los cierres viejos conservan su texto).
5. **Ingreso y egreso van a la caja del rubro elegido** (rubro obligatorio, O.10): el ingreso suma a esa caja y el egreso la resta; el modal lo explica. Ejemplo: Juan le debe $ 1.000 a Nico → Nico cobra un producto suyo y se registra un **egreso de $ 1.000 del rubro de Juan**: Nico suma por la venta, Juan resta y el cajón queda igual (es como si Juan le hubiera pagado a Nico).
6. El cierre sellado guarda estos datos (`data.reparte[].fis`, `final`, etc.); el sello SHA-256 y el congelado no cambian.

**4.27.2 Pruebas (`k3.py`, 26 verificaciones):** ventas por rubro, ingreso/egreso por rubro, sueldo 8 hs a medias, impuesto 30.000 por defecto y editable, ganancia a partes iguales y modo «cada uno la suya», cierre del cajón sin diferencia, sin merienda, tablas en Arqueo y Caja, 390 px sin desborde.

**4.27.3 Límites declarados:** el egreso entre socios reduce también la **ganancia propia** del rubro que paga si `movAffectProfit` está activo (valor por defecto); sin pagos mixtos por rubro dentro del POS (el ejemplo de la deuda se resuelve con la venta + el egreso del rubro); el reparto asume 2 o más rubros que reparten, a partes iguales; probado sólo en la demo, **no con los datos reales del cliente**.

---

## 4.28 INTEGRACIÓN CON TIENDANUBE Y PASOS DE CONEXIÓN DE TODAS LAS INTEGRACIONES (V26.13)

**Estado:** IMPLEMENTADO en V26.13 (migración `13-tiendanube.sql`, función `tiendanube`, parte `p9c-tiendanube.js`, pruebas `22-sql-tests.sql`, `tn_test.ts`, `tn1.py`). **Aplicar la migración 13 y desplegar la función en producción requiere permiso expreso del dueño** (regla de la sección 2): hasta entonces la pantalla de Integraciones muestra «Función no instalada» y el resto del sistema no cambia. Es **aditivo** y opcional: sin conexión, el sistema se comporta exactamente como antes.

**Objetivo.** Que el comercio conecte su tienda de Tiendanube como una integración más del panel (Administración → Integraciones): traer productos y órdenes, vincularlos con el catálogo, registrar como venta las órdenes pagas y, si el dueño lo decide, enviar stock y precios del sistema a la tienda. Cada integración del panel muestra además **los pasos para conectarla**, quién hace cada uno (el dueño, Vincular Business o el proveedor) y cuáles ya están hechos.

### 4.28.1 Principios (no se negocian)
1. **El navegador nunca ve el token de la tienda ni el secreto de la app.** Todo contacto con Tiendanube lo hace la función de servidor `tiendanube`; el token se guarda cifrado (AES-GCM, llave maestra `TN_MASTER_KEY` en los secretos de la función, AAD = id del comercio) en una tabla **sin políticas de lectura** (ilegible desde la API). Ni el token ni los secretos viajan a exportaciones, respaldos, auditoría o logs.
2. **Una orden jamás crea una venta sola.** La orden llega como dato (webhook o importación manual); la venta la registra una persona con permiso, **sólo si la orden está paga, no cancelada, con todos los productos vinculados y con una caja abierta**.
3. **El webhook no es autoridad.** Se verifica la firma HMAC-SHA256 (comparación en tiempo constante); el cuerpo **no se usa**: sólo indica qué recurso cambió y el servidor lo vuelve a pedir a la API de Tiendanube. Firma inválida → 401. Evento de una tienda desconocida → 200 sin efecto. Error recuperable → 500 para que Tiendanube reintente. `app/uninstalled` → la conexión pasa a `revocada` y el token se borra.
4. **Idempotencia y orden:** una orden vieja nunca pisa a una más nueva (`updated_at`); el mismo aviso dos veces no duplica nada; registrar la misma orden dos veces devuelve la venta ya registrada (`tn_orden_registrar` reserva la orden de forma atómica antes de crear la venta y `tn_orden_liberar` la libera si la venta falla).
5. **Dinero en centavos enteros** (los importes de la API se convierten por texto, sin `float`); estados de orden, de pago y de envío **separados**; el envío cobrado por la tienda **no forma parte** de la venta registrada.
6. **Quién manda, configurable:** `stock_fuente` y `precio_fuente` ∈ `sistema | tiendanube | off` e `importar_ordenes` (booleano), con lista cerrada. Por defecto el sistema manda el stock, nadie manda el precio y se importan órdenes. Sólo se tocan productos **vinculados**; el stock negativo del sistema se envía como 0; un producto del sistema se vincula con **una sola** variante de la tienda.
7. **Seguridad de la conexión (OAuth):** el `state` es de un solo uso (se guarda su hash SHA-256, vence a los 10 minutos); sólo el administrador inicia o desconecta; administrador y supervisor sincronizan y vinculan; mostrador y operador no ven la integración.

### 4.28.2 Servidor
- **Tablas** (todas con `comercio_id`, RLS, sin escritura directa): `tn_conexion` (estado `desconectada | conectada | revocada | error`, token cifrado, configuración), `tn_estados_oauth`, `tn_productos` (variantes, precio y stock de la tienda, producto local, vínculo `sin_vincular | sugerido | vinculado | ignorado`; índice único parcial: un producto local, una variante vinculada), `tn_ordenes` (estados de orden/pago/envío, importes en centavos, cliente mínimo, ítems, `venta_local`, `venta_estado` `pendiente | registrada | ignorada`) y `tn_eventos` (registro **sólo-agregar**).
- **Funciones SQL para usuarios** (validan rol por comercio): `tn_estado`, `tn_config_guardar` (admin), `tn_vincular` (admin/supervisor), `tn_ordenes_listar`, `tn_orden_registrar`, `tn_orden_liberar`. **Sólo servicio** (no ejecutables por la API): `tn_upsert_orden`, `tn_consumir_estado`.
- **Función `tiendanube`** (Edge Function; «Verify JWT» apagado porque valida la sesión adentro con `arca_quien`): acciones `estado`, `iniciar`, `desconectar`, `sincronizar_productos`, `importar_ordenes`, `empujar`, `registrar_avisos`; el callback de OAuth (`?cb=1`) y el webhook (`?wh=1`) en la misma función. Un único archivo para el panel de Supabase: `supabase/despliegue-panel/tiendanube-index.ts` (generado con `bundle_tiendanube.py`).
- **Secretos de la función** (los carga Vincular Business por el canal seguro del proveedor; nunca por chat, nunca en el HTML): `TN_APP_ID`, `TN_CLIENT_SECRET`, `TN_MASTER_KEY` (32 bytes en base64), `APP_URL`. Opcionales: `ALLOWED_ORIGINS`, `TN_USER_AGENT`, `TN_API_BASE`, `TN_AUTH_BASE`, `FUNCTION_URL`. En el portal de socios la URL de redirección de la app es `<URL de la función>?cb=1`. Todo nombre de endpoint, cabecera o permiso de Tiendanube queda `[VERIFICAR]` contra la documentación vigente.

### 4.28.3 Pantalla (Integraciones → Tiendanube)
- **Modo real** (nube configurada y sesión abierta): consulta el estado a la función; si la función no está instalada lo dice con claridad y no entra en bucle de pedidos. **Modo simulado** (demo, sin nube): conexión de ejemplo con productos y órdenes rotulados «ejemplo»; **en la variante del cliente sin nube dice «Requiere la nube / Pendiente de configuración» y no simula nada**.
- Pestañas: **Resumen** (variantes, vinculadas, órdenes por registrar, última sincronización, traer productos, traer órdenes, enviar stock y precios), **Productos** (vincular, aceptar sugerencia por código de barras/SKU, ignorar, desvincular), **Órdenes** (estado de orden/pago/envío, registrar como venta, ignorar), **Configuración** (quién manda, desconectar) y **Pasos**.
- **Registrar como venta:** resumen con el total (sin envío), caja abierta obligatoria, reserva atómica de la orden con un id de venta generado antes, `commitSale('transferencia', …, 'tiendanube', …, {saleId, extraDisc, tnOrder})`: descuenta stock por producto, entra a la caja abierta como transferencia ya cobrada por la tienda, deja la venta con `tn=<orden>` y el descuento de la tienda como «Descuento de Tiendanube». Si falla, libera la orden. Todo queda en la auditoría (`TIENDANUBE_*`, sin tokens).
- Áreas táctiles ≥ 44 px; tablas dentro de contenedores con desplazamiento; sin desbordes de 320 a 1440 px.

### 4.28.4 Pasos para conectar cada integración
La pantalla de Integraciones incluye la tarjeta **«Pasos para conectar cada integración»** con listas ordenadas y, por cada paso, quién lo hace: **lo hacés vos**, **lo hace Vincular Business** o **lo hace el proveedor**; Tiendanube además marca cada paso como hecho/pendiente según el estado real. Integraciones cubiertas: Nube del sistema (Supabase), Facturación electrónica (ARCA), Mercado Pago, MODO, PedidosYa, Google (Drive y Gmail), WhatsApp Business y Tiendanube. Las integraciones sin proveedor conectado se rotulan «pendiente de configuración» en el sistema del cliente. Ningún paso pide cargar un secreto en el archivo HTML.

**Pasos de Tiendanube:** (1) tener la nube funcionando · (2) crear la aplicación en el Portal de Socios (permisos de lectura de productos y órdenes y, si se quiere enviar stock/precio, escritura de productos) y obtener ID y secreto · (3) cargar `TN_APP_ID`, `TN_CLIENT_SECRET`, `TN_MASTER_KEY` y `APP_URL` en los secretos de la función · (4) ejecutar `13-tiendanube.sql` y desplegar la función · (5) tocar «Conectar tienda» y autorizar con el usuario dueño de la tienda · (6) traer los productos y confirmar los vínculos · (7) elegir quién manda sobre stock y precio · (8) recibir órdenes y registrarlas como ventas.

### 4.28.5 Pruebas obligatorias
SQL (`22-sql-tests.sql`): privilegios y RLS (A/B), estado sin token, lista cerrada de configuración, vínculo 1 a 1, orden que no retrocede, orden duplicada, `registrar` idempotente y `liberar`, `state` de un solo uso y vencido, registro sólo-agregar. Función (`tn_test.ts`, contra un Tiendanube falso y Postgres/PostgREST reales): firma inválida, evento duplicado, tienda desconocida, uninstall, conversión de importes sin `float`, paginación, sugerencias sin pisar vínculos, 429 con un reintento, empuje sólo de vinculados, secretos ausentes de respuestas. Navegador (`tn1.py`, demo): conexión simulada, vínculo, ignorar, configuración, orden → una venta con total exacto y stock descontado, no registrable dos veces, orden sin pagar bloqueada, auditoría, desconexión, 360 y 1280 px. **Con Tiendanube real no se probó nada hasta tener la app de socios y una tienda de prueba; esa prueba queda pendiente y se declara así.**

### 4.28.6 Límites declarados
Sólo corrió contra un Tiendanube **falso**; falta homologar con la app y la tienda reales. Sin envíos/etiquetas/seguimiento, sin cobro online, sin cupones ni clientes de la tienda sincronizados al Club, sin devoluciones/reembolsos automáticos (se registran a mano con nota de crédito), sin sincronización de imágenes ni categorías, un solo depósito. La marca y los nombres de Tiendanube pertenecen a su titular; el sistema no usa su diseño.


---

## 4.29 TIPO DE NEGOCIO (ALMACÉN CON RUBROS / MAYORISTA DE UN SOLO DUEÑO), PERMISOS SÓLO DEL ADMINISTRADOR, TRASPASOS DEL DUEÑO Y COMBOS (V26.14)

**Estado: IMPLEMENTADO en V26.14** (partes `p3j-combos.js`, `p3k-owner.js`; ajustes en `p2-core.js`, `p3-ops.js`, `p3b-pos.js`, `p3f-transfers.js`, `p3i-rubcash.js`, `p4-mods.js`, `p4d-compras-ui.js`, `p5-menu-boot.js`, `p7a-dash.js`, `p9-cloud.js`; prueba `y1.py`). **Sin migraciones SQL nuevas.** Corrige cuatro pedidos del dueño: «un mayorista de un solo dueño no es lo mismo que Almacén RAVE».

**4.29.1 Tipo de negocio (`cfg.biz`, Configuración → Tipo de negocio, sólo administrador)**
- **`rubros` (por defecto; Almacén RAVE):** como siempre — cada rubro es una persona (responsable), caja por rubro, sueldo del empleado a medias, impuesto que se separa y reparto (4.27).
- **`owner` (mayorista / un solo dueño):** el dinero es todo del dueño. **No hay rubros por persona**: los productos se agrupan en **categorías** (sólo ordenan inventario, Vender, menú y reportes). Ningún ingreso, egreso, reintegro, pago a proveedor, compra al contado ni traspaso **pide rubro**; por debajo se usa el concepto interno oculto **«Caja del negocio»** (`sys-gen`, `sys:true`, no es categoría) porque el servidor exige un rubro en todo movimiento (6.10). Configuración no muestra «Rubros, responsables y reparto», «sueldo y gastos se pagan de la caja» ni «afectan la ganancia del rubro»; Caja no muestra «caja de cada rubro» ni la columna Rubro; el **arqueo** es el de un solo dueño: ventas por canal (minorista / mayorista), por medio de pago, efectivo esperado (apertura + ventas en efectivo + ingresos − egresos ± traspasos) vs. contado, ventas por categoría (informativo). **Sin sueldo, merienda, impuestos por persona ni reparto.** El cierre se sella con `data.owner=true` y su detalle muestra esas tablas.
- Cambiar el tipo exige caja cerrada, no borra ni mueve datos y queda auditado (`TIPO_NEGOCIO`). El viejo «perfil sin rubros» de traspasos (`xfer.noRubro`) migra solo a `owner`.
- La demo muestra en el Resumen qué tipo de negocio se está viendo y un botón para cambiarlo.

**4.29.2 Permisos: sólo el administrador.** Dar o quitar permisos, crear o cambiar usuarios y el aviso de permisos nuevos son **sólo del rol administrador** (no es un permiso delegable: aunque un rol tenga «Usuarios y permisos», ve la tabla deshabilitada). En la nube el servidor ya lo exigía (`rave_puede_escribir`: sólo `admin` escribe `cfg/roles`; invitar, quitar y cambiar rol son funciones de administrador).

**4.29.3 Traspasos del dueño.** El **administrador (dueño)** mueve fondos entre cualquier caja —abierta o cerrada, incluida la principal— con **su propia autorización** (`auth={id:él, método pin_admin/clave_admin, self:true}`), sin pedir la clave de otro. La configuración `xfer.selfAuth` queda en `true` (es lo que el servidor de la migración 11 exige cuando hay más de un administrador). Los demás usuarios siguen las reglas de 4.23.1 (con caja cerrada necesitan la autorización de un administrador). Se conservan comprobante, estado de las cajas, tránsito, recepción y auditoría.

**4.29.4 Combos que descuentan cada artículo (Almacén RAVE y demo)**
- Un combo es un producto con su precio, **sin stock propio**: `p.kit=[{pid,qty}]` (artículos del inventario y cantidad por combo; no puede contener otro combo ni a sí mismo; sin repetidos; unidades enteras para artículos por unidad). Se arma en Inventario → producto → «Es un combo».
- Vender 1 combo «Fernet Branca 750 + Coca-Cola 3 lt + Hielo» **resta 1 Fernet 750, 1 Coca-Cola 3 lt y 1 hielo**; el combo no se descuenta. Con varios combos y artículos sueltos en la misma venta se suma todo por artículo.
- El stock mostrado del combo = cuántos se pueden armar (mínimo de stock ÷ cantidad). «Exigir stock» de cualquier artículo bloquea el combo si falta; si no, el artículo queda en negativo (4.2). No se ajusta stock de un combo (se ajusta cada artículo).
- La línea vendida guarda la composición usada (`it.kit`) y el costo = suma de los artículos; **anular o nota de crédito devuelve exactamente esa composición** aunque después cambie la receta.
- Nube: sin cambios de servidor; el stock viaja como movimientos de cada artículo.

**4.29.5 Datos de ejemplo sólo en la demo.** La demo (`raveV2`) trae «Bebidas y hielo (ejemplo)» (Fernet Branca 750, Coca-Cola 3 lt, Hielo) y el combo de ejemplo; el sistema del cliente nace sin ejemplos (comprobado en la compilación «cliente»: 0 productos de ejemplo, 0 combos, sin datos mayoristas de ejemplo, sin clientes, usuarios ni cupones).

**4.29.6 Pruebas (`y1.py`, 52 verificaciones):** combo (descuento por artículo, mezcla con sueltos, anulación con la composición guardada, exigir stock, negativo, editor y validaciones, ajuste bloqueado); permisos (supervisor con la pantalla no puede cambiar nada ni crear usuarios; el administrador sí); traspasos del dueño (a la principal cerrada, con las dos cerradas, supervisor bloqueado, pantalla sin pedir clave de otro); un solo dueño (configuración, inventario «Categoría», egreso sin rubro, arqueo sin sueldo/impuestos/reparto, texto y cierre sellado, compras sin rubro, vuelta a almacén intacta, 360 px).

**4.29.7 Límites declarados:** Tiendanube no conoce los combos (si se vincula un combo, se empuja stock 0); importar/exportar no lleva la composición de los combos; la nube de extremo a extremo con dos equipos **no se volvió a correr** (el banco de pruebas de nube no está disponible en este entorno): los cambios son del navegador y usan las reglas del servidor ya aplicadas (migración 11).

---

## 5. MÓDULOS OPCIONALES (aditivos, auditables, apagados por defecto si dependen de terceros)

Reglas comunes: banderas por comercio/sucursal/rol/dispositivo; migraciones SQL aditivas, versionadas e idempotentes probadas sobre copia; `tenant_id`, RLS y pruebas cruzadas A/B en toda entidad; servidor valida y recalcula; idempotencia; límites de uso; auditoría; dinero en centavos enteros; sin proveedor/credencial/dispositivo → estado "Pendiente de configuración" y el resto sigue funcionando; ninguna integración se declara terminada por tener una pantalla simulada.

- **5.1 Costos, porcentajes y precios:** recargo (precio = costo × (1 + p/100); costo 100 + 30 % = 130) y margen bruto (precio = costo / (1 − p/100); costo 100 + 30 % = 142,86); rechazar margen < 0 o ≥ 100; recalcular en vivo; cambio manual pide confirmación; historial; roles autorizados ven costo.
- **5.2 Mayorista, bultos y descuentos (resumen; la especificación completa, la matriz de brechas y las fases están en 4.22):** unidad base, unidades por bulto, venta suelta/bulto cerrado/ambas, tramos sin solapar, descuento % (10 = 10 %), stock siempre en unidad base (2 bultos de 6 = 12), mostrar "Minorista / Mayorista / Bulto cerrado" y el motivo; histórico congela la regla aplicada.
- **5.3 Tarjetas, cuotas y financiación:** planes de cuotas y promociones con vigencia, interés explícito, costo financiero visible, sin guardar PAN/CVV/PIN, distinguir "registrar medio" de "procesar pago", conciliación e idempotencia `[VERIFICAR normativa]`.
- **5.4 Correo:** SMTP/API en servidor, plantillas versionadas, cola con reintentos, baja y lista de supresión, nunca campañas sin consentimiento.
- **5.5 WhatsApp:** "Abrir WhatsApp" (enlace `wa.me` con texto codificado; no es envío automático) separado de WhatsApp Business API oficial (tokens en servidor, webhooks verificados, plantillas autorizadas `[VERIFICAR]`); estados preparado / abierto / aceptado / entregado / fallido; nunca scraping ni automatizar WhatsApp Web.
- **5.6 Marketing y redes:** calendario editorial, campañas con UTM, adaptadores por plataforma, aprobación humana antes de publicar o gastar, ROI/ROAS sólo con datos verificables.
- **5.7 Lector de huellas:** HAL, verificación local preferida, sin imágenes crudas, consentimiento y alternativa razonable, revisión legal previa, nunca como única autorización de una operación financiera.
- **5.8 Dashboard ampliado y reportes de rentabilidad:** por categoría/rubro, producto, empleado; participación en ingresos (denominador visible, N/D si es cero); comisiones configurables y congeladas por venta; fórmulas y períodos visibles.
- **5.9 Reparto entre socios y reporte de cierre diario para WhatsApp:** módulo apagado por defecto; los nombres y porcentajes son configuración del cliente (ficha L), no del núcleo; texto precargado desde caja y asistencia, cálculo local, vista previa, "Copiar" y "Abrir en WhatsApp", ediciones auditadas, prueba con caso numérico conocido; no toca el cierre sellado.
- **5.10 Recetas, insumos y producción:** unidades con conversión explícita, costo de receta con snapshot versionado, no descontar dos veces (producto terminado e insumos), mermas, lotes y vencimientos.
- **5.11 Gastos detallados:** fecha de gasto/vencimiento/pago, categoría, rubro financiero, proveedor, adjuntos cifrados, recurrentes, presupuesto vs. real; un gasto pendiente no mueve caja; no duplicar factura y pago de caja.
- **5.12 Cobros online (p. ej. Mercado Pago u otro proveedor del país):** credenciales por tenant en servidor, sandbox separado de producción, orden creada por el servidor con referencia externa idempotente, webhook con firma verificada, consulta al proveedor y validación de importe/moneda/cuenta, estados aplicables, sin acreditar por retorno del navegador; offline = pendiente.
- **5.13 Google (Drive, Gmail, Calendar, Sheets, Analytics/Tag Manager, Ads, Business Profile):** tarjetas separadas, OAuth con `state` de un solo uso, scopes mínimos, tokens cifrados en servidor, mapeo de archivos por tenant, sin duplicar al actualizar, conflictos explícitos, desconectar/revocar sin borrar archivos del cliente salvo orden expresa `[VERIFICAR requisitos vigentes]`.
- **5.14 Meta Pixel y Conversions API:** sólo en el menú público (nunca en panel/POS), consentimiento previo y opción de rechazo, `Purchase` sólo con venta real confirmada, `event_id` común para deduplicar, tokens en servidor `[VERIFICAR]`.
- **5.15 Facturación electrónica:** especificación completa en **4.12** (asistente de certificado por ambiente, CAE automático por servidor con cola e idempotencia, QR fiscal en el ticket, simulador sólo para demos).
- **5.16 Extensiones del Core:** atajos de Facturación e Inventario (`ShortcutManager`, reconfigurables, sin combinaciones del navegador), stock mínimo/máximo, depósitos, mesas y comandas (gastronomía), órdenes de trabajo Kanban (servicios), agenda de turnos (módulo nuevo).
- **5.17 Asistente conversacional:** la arquitectura y los contratos del `ActionRegistry` se diseñan desde el inicio. La voz y los proveedores externos pueden activarse por tenant con feature flags; el modo texto puede operar como alternativa. Si el proveedor no está configurado, el resto del sistema funciona.
- **5.18 Modelo de caja principal y cajas operativas:** configuración por tenant/sucursal; modo simple predeterminado; activar jerarquía, distribuciones y consolidación sólo cuando el cliente lo requiere. No activar permisos administrativos por activar el módulo.
- **5.19 Multisucursal:** habilitar entidades y pantallas sólo para clientes con sucursales; siempre aplicar aislamiento y alcance por sucursal en servidor.
- **5.20 Ordenamiento universal:** capacidad reutilizable incluida en el sistema, con ordenación por servidor donde corresponda; no es un módulo comercial apagable que pueda dejar tablas sin una interacción básica de ordenamiento.
- **5.21 Gestión de eliminación de inventario:** la UI puede ocultarse por rol, pero la autorización de servidor es obligatoria siempre. Borrado físico y archivo tienen políticas diferentes, según 4.16.
- **5.22 Checkout online e-commerce:** módulo opcional definido en 4.18; feature flag apagada por defecto, con adaptadores separados para pagos y envíos, órdenes con snapshots, estados de pago/entrega separados, webhook validado e idempotente y panel de despacho. Deshabilitarlo no cambia el flujo de WhatsApp. Nunca incluir secretos de pago en el frontend ni declarar cobros aprobados por el retorno del navegador.
- **5.23 Wallet de fidelización y avisos automáticos:** módulo opcional definido en 4.19. Reutiliza el Club y el ledger de sellos/puntos; soporta Apple Wallet/Google Wallet sólo con cuentas y credenciales oficiales configuradas, enlaces protegidos, actualización cuando la plataforma lo permita y fallback de tarjeta web. El motor de avisos funciona mediante outbox/worker, reglas, consentimiento granular, bajas, límites de frecuencia, plantillas versionadas, estados reales por canal e idempotencia. Apagado o sin proveedor, no afecta al resto del sistema. Nunca filtrar tokens, claves de firma, PII ni listas de clientes.

- **5.24 Tiendanube:** integración opcional definida en 4.28 (token sólo en el servidor, webhook firmado y re-consultado, órdenes que nunca crean ventas solas, vínculo 1 a 1, quién manda sobre stock y precio configurable, pasos de conexión visibles). Apagada hasta tener la aplicación de socios, la función desplegada y la migración 13 aplicada.

---

## 6. NUBE, SEGURIDAD Y DATOS

### 6.1 Nube (reglas que no se negocian)
En el archivo público sólo van la **URL del proyecto y la clave publicable**; los secretos privados de cualquier proveedor se configuran en el servidor, nunca en el HTML. Un proyecto del proveedor sirve a todos los comercios, aislados por servidor (`comercio_id` + RLS). Con la URL vacía el sistema funciona 100 % local y la pantalla Nube muestra "Pendiente de configuración". Las migraciones SQL son archivos numerados, aditivos e idempotentes **creados en el repositorio antes de indicar que existen** (nunca pedirle al dueño ejecutar archivos inexistentes), probados sobre una copia de la base, con RLS verificada con pruebas cruzadas A/B y backup/restauración antes de producción. `sincronizar()` es la **única puerta de escritura** y aplica en el servidor: lista cerrada de colecciones, roles, movimientos/auditoría/fichadas escritos una vez, **stock calculado sumando movimientos**, cajas cerradas congeladas, un cambio con error se rechaza solo sin trabar al resto. Cliente: sincroniza cada 15 s y 1,5 s después de guardar; sin internet sigue vendiendo ("Sin conexión · N por subir"). Una colección nueva exige actualizar `sincronizar()` y la política de lectura. Cada registro lleva `tenant_id`, `created_at`, `updated_at`, `created_by`, `deleted_at`. Detalle de referencia en **6.11**.

### 6.2 Seguridad (OWASP / ASVS / MASVS)
- Base cifrada AES-256-GCM, llave envuelta por contraseña (PBKDF2-SHA256 ≥ 200.000); datos personales cifrados aparte; la base vive en IndexedDB, nunca en `localStorage`.
- **Anti-XSS:** todo dato (incluido OCR/IA/QR, carrito, rubros, redes, nombres de producto, colores) se escapa o se fuerza a número/lista blanca; las URLs se validan por esquema (`https:`, `tel:`, `mailto:`, `wa.me`) y por dominio esperado de cada red; los colores con `#RRGGBB` estricto; atributos externos con `rel="noopener noreferrer"`. Exportaciones CSV neutralizan fórmulas.
- **CSP** estricta (`default-src 'none'` + lo mínimo, `frame-src` sólo el mapa, SRI en scripts externos), HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy y Permissions-Policy desde el hosting.
- Control de acceso por rol **en el servidor**; consultas parametrizadas; validación de toda entrada; límites de intentos con bloqueo creciente; mensajes que no distinguen "usuario inexistente" de "clave incorrecta"; rate limiting en login, soporte y sellos.
- Multitenant: RLS en todas las tablas, vistas, funciones, archivos y webhooks; prueba obligatoria de que el comercio A no lee nada del B.
- Funciones `SECURITY DEFINER` con `search_path` fijo; operaciones críticas (precios, descuentos, anulaciones, pagos, cajas, usuarios, permisos) con validación y auditoría en servidor.
- Secretos: nada en código ni logs; marcadores `<API_KEY>`, `<SECRET>`, `<ACCESS_TOKEN>`; terceros procesados en backend, separados por tenant, tokens cifrados, mínimo privilegio, rotación y revocación. Logs sin contraseñas ni contenido completo de facturas; errores internos sin rutas ni stack traces.
- **Checkout y pagos online (4.18):** los tokens privados, client secrets, secretos de webhook y credenciales de transportistas sólo viven en un gestor de secretos/almacén server-side con control de acceso por tenant, cifrado, rotación y revocación. No usar prefijos `NEXT_PUBLIC_`/equivalentes para secretos; escanear repositorio, bundles, source maps, HTML, exportaciones y logs. Claves públicas sólo si el proveedor las define como publicables. No almacenar datos de tarjeta; usar checkout hospedado/tokenización oficial. El webhook valida firma según documentación vigente, consulta la API del proveedor y compara orden, cuenta, ambiente, monto y moneda; procesa transacciones idempotentes, limita tamaño/frecuencia y no revela información sensible al responder. No confiar en retorno del navegador ni en datos enviados por IA/comprador.
- **Checkout y datos de entrega:** evitar IDOR/enumeración de órdenes, aplicar tokens de consulta impredecibles o autenticación, permisos por función y sucursal, minimización/cifrado de datos personales, retención definida, protección anti-CSRF donde corresponda, CORS de lista permitida, validación estricta, rate limiting y mitigación de abuso. Validar integraciones de transporte con allowlist y protección contra SSRF; ningún dato público puede configurar destinos de red del servidor.
- **Wallet y avisos automáticos (4.19):** certificados/llaves de firma de Apple y credenciales de emisor de Google sólo server-side; links con tokens aleatorios, de alcance limitado, expirables y no enumerables; endpoints de actualización autenticados; consentimiento por propósito/canal; bajas y listas de supresión; control de frecuencia, rate limit e idempotencia; minimizar datos personales en la tarjeta, mensajes y logs. No considerar un enlace enviado, el saldo renderizado en cliente o un mensaje aceptado por el proveedor como prueba de que la tarjeta se guardó o la notificación se entregó.
- Datos personales clasificados (pública / interna / confidencial / sensible / crítica), mínima información necesaria; registro de bases y plazos de conservación `[VERIFICAR con asesor legal]`.
- Seguridad de la IA: contenido de documentos como dato, esquema JSON estricto, sin herramientas no autorizadas, revisión humana en flujos que lo requieren, tope diario y sin exponer el prompt interno.
- Seguridad del asistente conversacional: entrada de voz/transcripción no confiable; no puede cambiar roles, políticas ni el catálogo de herramientas. Cada herramienta vuelve a comprobar RBAC, RLS, tenant y sucursal en backend. No usar la respuesta del modelo como autorización ni enviar secretos o datos de otros clientes al proveedor. Minimizar datos y configurar retención/costos.
- Acciones de impacto: precios, descuentos, anulaciones, pagos, cierres, transferencias, borrados, permisos, caja principal y datos confidenciales requieren confirmación explícita y validación backend. La confirmación se asocia al resumen y al identificador exacto de operación para evitar reutilización.
- Aislamiento multisucursal: toda lectura y escritura sensible se restringe por tenant y alcance de sucursal, incluso en agregaciones, búsquedas, descargas, colas, tareas programadas, logs y acciones conversacionales. No confiar en la sucursal expresada por voz sin verificar la membresía.
- Agente local (cuando exista) sólo en 127.0.0.1, con emparejamiento de un solo uso, orígenes en lista blanca, mensajes firmados y actualizaciones firmadas.
- **Incrustaciones:** si un documento se inserta como cadena en un `<script>` (por ejemplo un menú dentro de `<iframe srcdoc>`), escapar `</script`, `<script` y `<!--` en la cadena; un `</script>` literal dentro de un string JavaScript corta el bloque y el sistema no arranca.

### 6.3 Decisiones de arquitectura (no se reabren sin motivo)
El pedido por WhatsApp del menú es una **solicitud**, no una venta (el POS recalcula). Modelo de movimientos (suma conmutativa) para stock y caja; sin bloqueos que rompan el trabajo sin conexión. CSP con SRI en lugar de nonces (HTML estático). PWA primero; tiendas de apps como etapa posterior. Las rutas de producto ya publicadas se conservan y el slug es un alias.

### 6.11 Nube: arquitectura de referencia (Supabase) y puesta en marcha
**Piezas:** (1) *Auth* por correo y contraseña con "Confirm email" **desactivado** (si no, el alta queda trabada); (2) *Postgres* con RLS; (3) *PostgREST* (RPC); (4) *Edge Functions* para lo que no puede correr en el navegador (CAE fiscal, lectura de facturas con IA); (5) *Storage* privado para comprobantes. Ninguna función de servidor recibe permisos por el sólo hecho de existir: cada una valida el JWT del usuario y su rol en el comercio.

**Configuración en el código:** dos constantes (`CLOUD_URL`, `CLOUD_KEY`) que reemplaza el ensamblado; vacías = nube apagada. La clave `service_role` y cualquier `sb_secret_…` **no se usan ni se escriben** en el HTML; si aparecen en algún repositorio público se reporta y se recomienda rotarlas.

**Pantalla Administración → Nube:** estado (sin configurar · desconectado · sincronizado · sin conexión con N pendientes · error), crear comercio (primer equipo), entrar con correo y contraseña (equipos nuevos), número de caja del equipo, miembros y roles (alta por correo, quitar acceso corta todos los equipos), "Sincronizar ahora", rechazos del servidor con motivo, código de recuperación (se muestra **una sola vez** al crear el comercio y no se cierra sin confirmar que se guardó; se puede regenerar), cerrar sesión.

**Datos:** tabla genérica `registros (comercio_id, coleccion, id, datos jsonb, borrado, actualizado)`; lectura RLS sólo miembros; escritura sólo por `sincronizar()`. Colecciones cerradas (productos, ventas, sesiones/cajas, movimientos de caja y distribución, sucursales, asignaciones, cierres, movimientos de stock, clientes, cuenta corriente, empleados, fichadas, tareas, cupones, planes, membresías, fidelización, configuración, auditoría y las del módulo vigente; si Checkout Online se habilita, órdenes, líneas/snapshots de orden, cotizaciones/envíos, intentos de pago e historial de estados/eventos; si Wallet/avisos se habilitan, preferencias/consentimientos por canal, reglas y plantillas de notificación, outbox/jobs/eventos de entrega, pases/registros de Wallet y sus estados, cada una agregada explícitamente a la lista blanca y con RLS propia). Las acciones conversacionales persistidas deben pasar por una lista blanca con esquemas y límites; nunca aceptar colecciones arbitrarias desde el modelo. Reglas del servidor: roles (mostrador/operador no editan productos, gastos, personal ni configuración); **auditoría, movimientos y fichadas se escriben una vez**; **una caja cerrada no se modifica** (sólo notas del administrador); campos de seguridad de la configuración (certificados, claves, Access Tokens, client secrets, secretos de webhook, credenciales de transportistas, certificados/llaves de firma de pases, credenciales de emisores Wallet y tokens de autenticación/registro) **se descartan** del payload genérico; esas credenciales usan rutas server-side específicas; tope de tamaño por registro y de cantidad por envío; nombres de colección con lista blanca y formato validado.

**Stock multi-equipo:** el navegador **no envía el stock**: envía *movimientos* (`delta` con motivo). El servidor suma los movimientos en una sola transacción sobre el producto (con bloqueo de fila), de modo que dos cajas que venden la misma botella restan las dos y el total cierra, incluso con stock negativo permitido. El stock que se ve en cada equipo = stock del servidor + movimientos propios aún no subidos. Un producto nuevo sube con stock 0 y un movimiento "saldo inicial".

**Cifrado:** llave de datos (DEK, AES-256-GCM) por comercio, generada en el primer equipo; cada miembro la guarda envuelta con una llave derivada de su contraseña (PBKDF2-SHA256 ≥ 200.000) y una copia envuelta con el código de recuperación. Los datos personales (WhatsApp, correo, DNI, nacimiento) se cifran **antes de subir** y la base local se guarda cifrada en IndexedDB; el servidor no puede leerlos. Cambiar la contraseña re-envuelve la llave; un miembro nuevo recibe la llave de un administrador (clave temporal que debe cambiar al entrar). Sin contraseña ni código de recuperación los datos cifrados **no se pueden recuperar (por diseño)**.

**Sin conexión:** se puede ingresar con correo y contraseña contra la llave envuelta guardada en el equipo en el último acceso; todo cambio se encola y se reconcilia al volver Internet; nunca se muestra como sincronizado lo que no confirmó el servidor. **Cajas y numeración:** cada equipo tiene su caja y su numeración ("2-15"); número de caja único por comercio. **Límite conocido:** dos ediciones simultáneas del mismo registro se resuelven con la última guardada (mejora opcional: versionado optimista en precios y permisos).

**Cliente de nube (as-built, v2.2):** ingreso con Auth por correo y contraseña (REST; la clave publicable va en `apikey`, el JWT del usuario en `Authorization`); llave de datos (DEK) envuelta con la contraseña (PBKDF2-SHA256 200.000) y copia con código de recuperación (20 caracteres, sólo admin); estado local cifrado en IndexedDB (nombre de base propio por cliente: GitHub Pages comparte origen entre repositorios); sincronización cada 15 s y 1,5 s después de guardar, diferencias por huella, lotes de 150, stock como movimientos, rechazos del servidor visibles, cierre de sesión por inactividad (30 min) y al quitar un miembro. Los datos personales de clientes y empleados viajan cifrados (`__pii`). Alta al Club desde el menú público: cifrada en el navegador con la llave pública del comercio (RSA-OAEP + AES-GCM); el equipo la descifra, deduplica por los últimos 10 dígitos del WhatsApp (misma persona + mismo cumpleaños = segunda tarjeta en la misma ficha) e importa como cliente (se importa sola cada 20 s con la sesión abierta, también desde un mostrador). Menú público: instantánea publicada (`menu_publico(slug)`) sin costo ni stock exacto; **con la nube activa la tarjeta del Club se ve sin sesión** (vive en el celular del cliente y consulta `club_estado`), con los cupones para todos y, si es socio, los de socios y cumpleaños; la instantánea publicada lleva sólo la meta y el premio del club (`rave_limpiar_menu` en `09-club-tarjeta.sql`). **Compilación:** `build.py cliente` con `SUPABASE_URL`, `SUPABASE_KEY` (rechaza `service_role`/`sb_secret_`), `RAVE_SLUG` (igual al *slug* del comercio) y `PUBLIC_URL`; sin URL/clave el ingreso dice "Pendiente de configuración". **Límites conocidos:** recargar la página sin internet requiere el HTML en caché (no hay service worker); fotos propias de productos necesitan Storage (fase 2); el último uso de un cupón no es atómico entre equipos; un empleado que olvida su clave se quita y se vuelve a invitar; los reintentos de ARCA corren sólo mientras algún equipo tenga el sistema abierto (sin tarea programada).

**Puesta en marcha (en orden):** 1) opcional y **destructivo**, sólo con respaldo y orden expresa del dueño: script de limpieza de un proyecto anterior; 2) scripts base en orden (base → sincronización → recuperación/soporte → menú público → fiscal → pagos mixtos → proveedores y compras `08-proveedores-compras.sql` → tarjeta del Club `09-club-tarjeta.sql`), pegando el contenido real en el editor SQL; 3) desactivar "Confirm email"; 4) cargar los secretos de las funciones por el canal seguro del proveedor (nunca por chat ni por correo); 5) publicar el archivo con URL + clave publicable; 6) crear el comercio desde el primer equipo y guardar el código de recuperación; 7) agregar equipos y miembros. Pruebas: ver sección 13, ítem 16.

### 6.7 Biometría
Dato de alto riesgo: no habilitar hasta aprobar la revisión legal; sin plantillas en logs/exportaciones; método alternativo siempre disponible.

### 6.10 Rubro financiero obligatorio en todo movimiento
Todo ingreso o egreso que el sistema registre o procese lleva un **rubro financiero válido** (existente, activo, del mismo tenant y compatible con el tipo: "rubro", "compartido" sólo egreso, "cobranza" sólo ingreso). Se exige en interfaz, aplicación, servidor y base (NOT NULL + clave foránea por tenant); offline se revalida al sincronizar; webhooks sin clasificación válida quedan en bandeja técnica sin crear movimiento; los importados exigen mapeo en la vista previa; el cierre sellado incluye la clasificación; las correcciones son movimientos compensatorios con motivo. Pruebas: rubro vacío, inexistente, inactivo, incompatible, de otro tenant; venta, devolución, webhook, offline, importación, concurrencia e idempotencia.

---

## 7. MENÚ PÚBLICO AMPLIADO Y SU ADMINISTRACIÓN

El menú público es anónimo y de sólo lectura; se configura **todo** desde Administración → "Menú público" (nada fijo en el código, salvo el crédito del desarrollador). Si ya existe un menú aprobado por el cliente, se reutiliza tal cual (diseño, carrito, buscador, lightbox) y sólo se le conectan datos públicos, sin tocar su apariencia.

1. **Catálogo en vivo desde el inventario** (rubros con diseño y color, productos publicados, precios, fotos, "sin stock"); la API pública sólo expone nombre, descripción, precio de venta, imagen, categoría y los precios mayoristas expresamente habilitados.
2. **Encabezado:** logo (WebP/AVIF/PNG/JPG, SVG sólo saneado; derivado a favicon e ícono PWA), datos del comercio, horarios con indicador "Abierto ahora" (sólo si hay horarios cargados), portada y colores de marca.
3. **Frases comerciales y leyendas legales** (plantillas `[VERIFICAR]`, confirmadas por el dueño con registro de quién y cuándo); una leyenda "legal obligatoria" no se desactiva sin motivo auditado; rotación con pausa, `aria-live` y respeto de `prefers-reduced-motion`.
4. **Idiomas ES/EN** con selector por nombre (no banderas), `?lang=`, `lang` y `hreflang`, traducciones editables y revisadas por el dueño; precios no se convierten.
5. **Acceso oculto del administrador** (toques múltiples sobre el logo, pulsación larga, teclas o ruta `#acceso`): sólo abre el formulario de ingreso; la seguridad real es la autenticación y la RLS; la ruta directa queda documentada para accesibilidad; sin pistas en el HTML público.
6. **Compartir** (Web Share con alternativa "Copiar enlace"), **QR del menú** descargable, botón flotante "Volver arriba" que no tapa carrito ni leyendas.
7. **Ubicación y reseñas:** dirección, "Cómo llegar", mapa embebido opcional (apagado por defecto, tras consentimiento, con CSP), enlaces para dejar y ver reseñas; reseñas dentro del menú sólo con API oficial por backend y sin inventar nunca puntajes ni textos.
8. **Club, cupones y tarjeta de fidelización** públicos (ver 4.3 y 4.6), membresías y cupones visibles con su condición. Incorporar botones condicionales “Agregar a Apple Wallet” y “Guardar en Google Wallet”, y opción de solicitar el envío seguro de la tarjeta; mostrarlos sólo cuando el adaptador esté operativo y el socio haya sido autenticado/validado. Mantener la tarjeta web como alternativa. Las preferencias de avisos y la baja de marketing deben poder consultarse sin revelar si existe otro cliente.
9. **Wi-Fi temporal de invitados** (red aislada de la del POS; QR de conexión; clave fija, rotación manual o automática sólo si el equipo lo permite; vigencia; cambios auditados; cartel legal `[VERIFICAR]`).
10. **Redes sociales — lista editable con lugar para agregar más:** cada red con interruptor "Mostrar", tipo (Instagram, Facebook, TikTok, X, YouTube, WhatsApp, LinkedIn, Telegram, Threads, Spotify, sitio web, otra), nombre, usuario y enlace; validación https, sin espacios y **coherencia de dominio con la red elegida**; para mostrarla debe tener enlace; íconos SVG en línea (genérico si falta); X y YouTube vienen precargadas **como ejemplo y apagadas**; sin widgets de terceros (los enlaces no cargan scripts).
11. **Información legal** (privacidad y consentimientos, precios y entregas, botón de arrepentimiento y defensa del consumidor, venta restringida por edad, Wi-Fi) y botón de arrepentimiento que abre el canal configurado y queda registrado.
12. **Créditos del desarrollador (VINCULAR BUSINESS, datos oficiales de la regla 11)** en menú, páginas de producto y PWA, con banner oficial y mensaje prellenado (`wa.me/5493874484132`) que identifica al comercio.
13. **Administración:** secciones (identidad, frases y leyendas, idiomas, bloques y orden, Club, Wi-Fi, ubicación y reseñas, redes, compartir y QR, acceso oculto, SEO/Open Graph, créditos y legales, vista previa y publicación); **borrador y publicación** con versión, usuario, fecha y hash; comparar y **revertir** a la versión anterior; el menú se actualiza sin recargar; sólo admin o rol autorizado (validado en servidor); validaciones al guardar; importar/exportar la configuración con diferencias, modo prueba y reversión.
14. **SEO y rendimiento:** páginas por producto con Open Graph y JSON-LD (sólo con datos existentes), sitemap, PWA instalable, imágenes con `srcset` y carga diferida, accesibilidad AA (teclado, foco atrapado en modales, textos alternativos), 320/360 px sin desbordes.
15. **Dependencias de terceros** (siempre decirlas al cliente): reseñas (API y cuotas), mapa embebido (consentimiento y CSP), rotación automática de Wi-Fi (equipo de red), textos legales, traducciones, widgets de redes.


**Checkout online opcional (integración de 4.18):**
16. **Modo de venta:** configuración por comercio/canal con `whatsapp` como valor por defecto. En modo WhatsApp, conservar exactamente el flujo vigente. En modo Checkout Online, el carrito ofrece “Comprar” y el checkout de datos del comprador → entrega/retiro → pago. Si ambos canales están expresamente habilitados, presentar opciones claras sin duplicar la orden.
17. **Administración de venta y entrega:** incorporar, según rol, configuración write-only de credenciales, prueba de conexión sandbox/producción, retiro local, envío local por tarifa/zona y envío nacional por tarifas configuradas o adaptador oficial. No mostrar la pantalla de producción como “lista” hasta pasar validaciones y una prueba de extremo a extremo.
18. **Panel de órdenes:** listado de órdenes online y etiqueta “Pagado — listo para despachar” únicamente tras verificación server-side del pago. Dirección, contacto, etiqueta y tracking sólo aparecen a roles que los necesitan. Separar pago de preparación/envío; conservar historial.
19. **Publicación segura:** el modo checkout no se publica mientras no haya política de privacidad/devoluciones/entrega revisada, método de entrega cotizable, proveedor de pago configurado, webhook comprobado y pruebas completadas. Si el proveedor no está configurado o falla, mostrar un estado comprensible al administrador y preservar el flujo de WhatsApp.

---

## 8. LEGAL Y CUMPLIMIENTO (país y provincia del cliente)

Pantalla "Legal y cumplimiento" con plantillas **editables y marcadas `[VERIFICAR]`**, registro de quién las confirmó (asesor) y cuándo, y lista de verificación "qué hace el sistema / qué falta y quién lo hace". Para Argentina, como punto de partida a **verificar con asesor y fuente oficial**: protección de datos personales (Ley 25.326 y autoridad de aplicación), defensa del consumidor (Ley 24.240 y normativa de venta a distancia y botón de arrepentimiento), venta de alcohol y tabaco a menores y horarios provinciales/municipales, uso de Wi-Fi/registro de equipos, facturación electrónica y condición fiscal, registro de la base de datos y plazos de conservación. Para otro país/provincia se reemplaza el paquete por el equivalente local. No se inventan números de ley, textos oficiales ni resoluciones; no se imprime `[VERIFICAR]` en tickets ni en el menú público: se confirma antes de publicar.

---

## 9. DISEÑO

Premium, limpio, mucho aire; tipografía sans legible + titulares con serifa; sombras sutiles, bordes de 15–20 px; paleta del comercio (`[COLOR1]`, `[COLOR2]`, neutros). Bento-grid, barra lateral colapsable, barra superior contextual (comercio, caja, estado de nube, periféricos, idioma, usuario). Íconos SVG en línea; ícono propio del producto en pestaña, barra de tareas, celular, instalador y accesos (nunca el globo genérico). Responsive 320/360/768/1024/1440+ sin desbordes (en móvil, la barra de teclas F pasa a estática y los buscadores ocupan todo el ancho). Gráficos con orden fijo, paleta validada, etiquetas directas, tooltips por foco y toque, tabla alternativa, sin ejes duplicados ni tortas; no usar sólo color para comunicar estados (los negativos llevan texto y símbolo).

---

## 10. WINDOWS Y OTRAS PLATAFORMAS

**Windows:** instalador (Go, 64 y 32 bits) con ícono, versión y empresa; sin pedir administrador; instala en carpeta propia; accesos en Escritorio e Inicio (abrir, actualizar, desinstalar); ventana propia del navegador (`--app`) con perfil aparte; actualiza bajando el HTML publicado, validándolo y guardando el anterior sin tocar datos; pregunta antes de borrar datos al desinstalar; acceso opcional con impresión directa (`--kiosk-printing`) que afecta todas las impresiones y requiere decisión. Sin firma digital hasta tener certificado (SmartScreen avisará). Windows 7/8 sin soporte: aviso. **Antes de cambiar el archivo que el instalador descarga, verificar que no se publique una demo encima de una instalación real.** PCs viejas: `[VERIFICAR runtime]`; alternativa: otra PC sirve el sistema por LAN.

**Móviles y tiendas (etapa futura):** PWA instalable; contenedor nativo sólo si se decide publicar. iPhone/iPad: Safari no soporta Web NFC/Serial/USB/Bluetooth. Android: NFC, cámara, Bluetooth, USB OTG. Reglas de tiendas (privacidad, eliminación de cuenta, venta de alcohol/tabaco, cobros de suscripciones) `[VERIFICAR]`. Seguridad móvil (MASVS): claves en Keychain/Keystore, pinning, biometría opcional, cierre remoto, borrado al desvincular.

---

## 11. MATRIZ DE ADAPTACIÓN POR RUBRO

El rubro se cambia en Administración sin tocar los datos. Cada línea indica qué se prende, qué vocabulario cambia y qué se apaga.

| Rubro | Prender | Vocabulario | Apagar / notas |
|---|---|---|---|
| **Comercio / almacén / licorería / kiosco** | POS minorista/mayorista (4.22: fases F1, F5 y F6 recomendadas), bultos, balanza, stock, rubros con color, venta sin stock (opción), fidelización, cupones, menú QR | producto, rubro, bulto | Control de edad y horario sólo si hay venta restringida |
| **Gastronomía (bar, restaurante, café)** | Mesas, comandas por sector (cocina/barra), recetas e insumos, agregados, mozos y comisiones, menú QR como carta | plato, mesa, comanda, mozo | Mayorista apagado; venta sin stock apagada para insumos críticos |
| **Servicios (taller, estética, peluquería)** | Órdenes de trabajo Kanban, técnicos/profesionales, comisiones o alquiler de sillas/gabinetes, agenda de turnos, sellos de fidelización | orden, servicio, profesional | Stock y balanza apagados; "Exigir stock" en repuestos |
| **Profesionales (estudios, consultorios)** | Órdenes como expedientes/consultas, honorarios, compras y gastos, datos sensibles sólo cifrados | expediente, cliente/paciente, honorario | Menú público apagado si no aplica; sin Pixel ni publicidad |
| **ONG / clubes** | Catálogo = campañas/donaciones, clientes = socios con consentimiento, cuenta corriente = cuotas, membresías | socio, cuota, campaña | Sin control de edad ni alcohol |
| **Mayorista / distribuidor** | Módulo **4.22** completo: listas L1–L5, escalones, bultos, crédito con plazo, pedidos de venta → remito → factura → recibo, lotes/FEFO, cobranzas con valores, cierre ciego, reportes por canal; contabilidad opcional (`accounting.on`) | cliente, bulto, lista, pedido de venta, remito, recibo | Menú público opcional con precios mayoristas habilitados producto por producto |

Cada negocio define en la **ficha de particularidades (L)** lo que no es general, como módulo opcional apagado por defecto: rubros internos o secciones, socios y reparto, cierres a medida, reportes propios, impuestos fijos, empleados compartidos, formatos de mensajes. Para cada punto: qué se quiere, quién lo usa, qué datos entran, qué sale y si toca el cierre sellado.

**Capacidades transversales V26 para todos los rubros:** el asistente por voz/texto reutiliza el `ActionRegistry` y sólo publica acciones compatibles con el módulo, el rol y la configuración del cliente; las tablas de datos usan el componente de ordenamiento de 4.15; cajas y sucursales se presentan según el perfil contratado/configurado; el borrado de inventario respeta 4.16. La voz no habilita una función que no exista, esté apagada o carezca de permiso. El Checkout Online de 4.18 es opcional para comercio, indumentaria y otros rubros que requieran venta/envío; en gastronomía y negocios locales el flujo WhatsApp sigue siendo el predeterminado, salvo activación explícita.

---

## 12. DETECCIÓN DE LO EXISTENTE (antes de cada cambio)

1. Inspeccioná repositorio, esquema, pantallas, permisos y pruebas. Listá lo que ya existe y su estado.
2. Funciones duplicadas: fusionar. Incompletas: completar. Inexistentes: agregar como módulo con bandera.
3. Nombres únicos: las funciones de módulos distintos comparten el mismo ámbito en un HTML de un solo archivo; buscar duplicados antes de publicar (un `procesarCola` repetido dejó sin cola de impresión a una térmica).
4. Un módulo nuevo se agrega a la lista de ensamblado o no se arma.
5. Colecciones nuevas: actualizar sincronización, lectura, exportación, importación y respaldo. Para V26, contemplar entidades de sucursales, cajas, sesiones, movimientos/distribuciones, cierres y auditoría, además de cambios de inventario y estado de acciones conversacionales cuando deban persistirse.
6. Un estado persistido de una versión anterior no debe romper la nueva: los campos nuevos se leen con valores por defecto (`!== false`, `|| valor`), no se asumen presentes.
7. Inventariá todas las pantallas, formularios, tablas, botones y servicios de negocio. Creá una matriz de cobertura del `ActionRegistry`: módulo → pantalla → acción disponible → schema → permiso → riesgo → confirmación → operación offline → pruebas. No inventes que una función está cubierta si falta su entrada o su prueba.
8. Para cajas/sucursales, detectá primero entidades actuales, claves, numeración y flujos. No crees una segunda fuente de verdad para caja, sesiones o cierres. Especificá el plan de migración y el comportamiento de clientes ya existentes en modo simple.
9. Para el ordenamiento, localizá todas las tablas de datos y componentes reutilizados. La aceptación requiere una lista de componentes/tablas cubiertas y excepciones justificadas; no alcanza con implementar un ejemplo.
10. Para el borrado de artículos, identifica todas las referencias históricas y toda ruta de backend. La seguridad no se da por validada si sólo desaparece el botón para el usuario no administrador.
11. Para Checkout Online, detecta si ya existen carrito, solicitudes de WhatsApp, órdenes, pagos, webhooks, clientes y configuración de envío. Reutiliza lo que corresponda sin confundir solicitud de WhatsApp con orden de compra pagable ni registrar dos veces una misma venta.
12. Para wallet y avisos, detecta módulo Club/ledger, consentimientos, proveedor de correo/WhatsApp/SMS, scheduler/worker, colas y auditoría. Reutiliza preferencias, clientes y servicios de comunicaciones existentes; verifica qué estados reporta cada proveedor; no declares automático un flujo que dependa de que el navegador esté abierto.
13. Para mayorista/minorista (4.22), partí de la matriz 4.22.0 y volvé a inspeccionar antes de cada fase: listas, bultos, canal, lotes, remitos, cierres y asientos que ya existan se completan, no se duplican. El módulo **Pedidos de venta** no se confunde con **Pedidos** (menú/PedidosYa). Todo campo nuevo de producto, cliente, venta o cierre se lee con valor por defecto en los datos viejos y en los cierres sellados.

14. Para Tiendanube (4.28), detectá primero las integraciones del panel, `hreq/rpc/sel` y `arca_quien`: la función reutiliza la sesión y el rol del comercio; no crees otro mecanismo de identidad ni guardes secretos en tablas legibles. Una orden de la tienda **no** es una venta; no registres dos veces la misma orden.

---

## 13. PRUEBAS Y CRITERIOS DE ACEPTACIÓN

Pruebas **automáticas con navegador real** (flujos con datos reales, `file://` y `https`, 320/360/768/1024/1440), reloj ajustable para lo que depende de la hora, y revisión independiente para lo de alto riesgo. Mínimo:

1. **Arranque y consola:** la página carga sin errores de consola ni de sintaxis (verificar que ningún `</script>` ni `<!--` dentro de cadenas corte el bloque); todas las pantallas abren; sin desbordes horizontales.
2. **Vender:** F1–F12 y sus botones; edición enlazada de cantidad/precio/importe; escáner vs. tipeo; etiqueta EAN-13; cálculo antes de confirmar; numeración por caja; fiado con y sin límite; fiscal/interno con motivo; nota de crédito y anulación con devolución de stock y de sello; reintegro.
3. **Venta sin stock:** con la opción activa vender 5 de un producto con stock 3 deja −2, la línea avisa, se audita y se marca en rojo en Inventario, Vender y Resumen; con "Exigir stock" o con la opción apagada el botón se deshabilita y el servidor rechaza; ajuste a negativo sólo si corresponde; anular restituye; dos cajas vendiendo el último ítem concurrentemente.
4. **Inventario por rubros:** pestañas y contadores; agrupar/filtrar; alta y edición de rubro (color inválido rechazado); producto en rubro nuevo; unidades und/kg/lt en edición, listados, exportación e importación; rubro oculto del menú no aparece en el público; margen "—" sin costo.
5. **Beneficios:** cupón vs. membresía (el mejor, no acumulados); tabaco excluido; reparto por línea con centavos (333/333/334); cupón vencido, de un solo uso, por cliente; concurrencia del último uso.
6. **Fidelización:** sello por código (cliente inferido del código), código repetido rechazado, 1 por día, ventana de 2 minutos, canje, reversión por anulación; alta al Club (válido, duplicado sin revelar, menor de 18, XSS, doble envío, consentimientos separados); tarjeta modelo con N sellos de ejemplo e impresión; recuperación de tarjeta con WhatsApp + nacimiento.
7. **Caja:** apertura, ingresos/egresos con rubro obligatorio, arqueo, cierre sellado y congelado, diferencia, reporte sin secciones vacías; rubro inexistente/de otro tenant rechazado.
8. **Menú público:** idéntico al aprobado; catálogo en vivo; carrito y pedido por WhatsApp (solicitud); control de edad y horario; ES/EN; cupones, tarjeta, legales y arrepentimiento; **redes:** X y YouTube de ejemplo apagadas, activar con enlace válido, enlace de otro dominio rechazado, `javascript:` rechazado, agregar red nueva, aparecen en el menú sólo las activas; administración: borrador, publicar, revertir; 360 px.
9. **Periféricos:** parseo de balanza y peso estable, ESC/POS (bytes, corte, QR), cola sin duplicados, reconexión; hardware real = "pendiente de prueba física".
10. **Seguridad:** XSS en cada campo (producto, rubro, red, cliente, cupón), CSV con fórmulas, roles por API (mostrador no edita menú ni rubros), tenant A/B, secretos ausentes del archivo, CSP sin violaciones, límites de intentos, idempotencia de pagos y webhooks, auditoría encadenada válida.
11. **Importar/exportar:** archivos buenos, malos, duplicados y `.xlsx`; reversión; archivo repetido no duplica.
12. **Regresión:** cada función de la versión anterior sigue funcionando; el estado persistido de una versión previa carga sin errores.
13. **Persistencia:** recargar conserva los datos; respaldo y restauración.
14. **Terceros:** sólo con sandbox o cuentas del propietario; sin tokens ni datos personales en los resultados guardados.

15. **Facturación electrónica (4.12):** firma CMS verificada con herramienta independiente; TRA con horas correctas; TA reutilizado y error de TA vigente; numeración con bloqueo; timeout seguido de consulta antes de reintentar; rechazo con observaciones visibles; nota de crédito con comprobante asociado; totales con redondeo conflictivo por alícuota (la suma cierra al centavo); clase A/B/C según emisor y receptor y condición de IVA del receptor informada; venta duplicada rechazada; usuario sin permiso; comercio A sin acceso a credenciales del B; secretos ausentes de respuestas, logs y exportaciones; ticket con CAE, vencimiento y QR; ticket pendiente sin CAE; simulador rotulado y ausente en el sistema del cliente. **Homologación real con el certificado del cliente: pendiente hasta tenerlo; nada de esto se declara "aprobado" sin ella.**
16. **Nube (6.11):** correr los scripts SQL sobre una base real de prueba (Postgres) con RLS activa y usuarios de prueba; comercio A no lee ni escribe nada del B (tablas, RPC, menús, credenciales fiscales); mostrador no escribe productos ni configuración; auditoría/movimientos escritos una vez; caja cerrada congelada; stock = suma de movimientos con dos equipos vendiendo el mismo producto en paralelo (incluso en negativo); registro rechazado no traba al resto; sincronización idempotente (reenviar el mismo lote no duplica); cursor sin huecos; borrado lógico; datos personales ilegibles en el servidor; entrar con contraseña equivocada, cambiar contraseña, miembro nuevo, quitar miembro (pierde acceso), recuperación con el código; modo sin conexión con cola y reconciliación; dos navegadores reales compartiendo datos contra un servidor de prueba; ningún secreto en el HTML publicado.
17. **Asistente conversacional:** probar voz y texto, castellano rioplatense, reconocimiento con ruido razonable, errores de transcripción, cantidades, productos homónimos, varias sucursales/cajas, falta de campos, cancelación, corrección, proveedor no configurado/caído, límites de uso y salida en esquema inválido. La operación guardada debe coincidir con la interpretación confirmada; el modelo no puede invocar una acción desconocida, saltarse permisos, exfiltrar otro tenant ni crear duplicados al reintentar.
18. **Acciones por voz/texto y permisos:** por cada acción del registro, probar rol permitido y denegado directamente contra backend; cambios de precio, pagos, anulaciones, cierres, transferencias, borrados y permisos requieren el nivel de confirmación definido. Una confirmación anterior no puede autorizar una acción distinta. La auditoría identifica origen y correlación sin guardar audio/secretos.
19. **Comandas conversacionales:** “una pizza grande especial de calamares, una gaseosa y una soda, tres personas, mesa cuatro”; verificar catálogo, cantidades, mesa, comensales, totales del servidor, estado real, ticket/cocina si se confirma y duplicados por reintento. Si hay varias gaseosas posibles, no debe seleccionar una arbitrariamente.
20. **Cajas operativas/principal:** modo simple sin pantallas innecesarias; múltiples cajas; transferencia y pago repartido entre cajas; importes concilian exactamente; reversión ante fallo; sin doble conteo; arqueo individual y consolidado; cierre congelado; reparto de socios conforme a snapshot; operación concurrente y reintento idempotente.
21. **Multisucursal:** sucursal A y B aisladas; Casa Central lee sólo sucursales habilitadas; prueba de acceso directo a endpoints/RPC/exports; cajas principales locales y consolidado global; monedas, períodos y estados visibles; migración conserva registros históricos; un usuario sin asignación no puede operar ni consultar datos de otra sucursal.
22. **Borrado de inventario:** usuario no administrador no puede borrar ni por UI ni API/RPC directa; admin puede eliminar un artículo sin historial; artículo con historial no se elimina físicamente y ofrece archivar; eliminación masiva con mezcla de estados informa resultados por ítem, vacío no elimina todo, auditoría y recuperación funcionan; RLS/FK y concurrencia comprobadas.
23. **Ordenamiento universal:** inventario completo de tablas cubiertas; ascendente/descendente con números, dinero, fechas, tildes, nulos y empates; mantiene filtros/paginación/selección; prueba de lista blanca de columnas del servidor y protección contra inyección; teclado/ARIA/táctil; anchos 320/360/768/1024/1440 px.
24. **Regresión de V26:** cajas/sucursales, acciones del asistente, borrado de artículos y ordenamiento no rompen POS, inventario, stock negativo, importación/exportación, cierres, fidelización, facturación fiscal, modo offline ni la experiencia simple de clientes ya existentes.
25. **Modo de venta y compatibilidad:** con el checkout apagado, el menú conserva el flujo y botón de WhatsApp y no crea órdenes de pago; al cambiar el modo requiere permiso, queda auditado y la configuración incompleta impide publicarlo.
26. **Checkout extremo a extremo:** comprador válido/inválido; paso atrás/adelante; carrito vacío, producto desactivado, precio cambiado, stock bajo/negativo según política, descuento inválido, cotización vencida, provincia/código postal no atendido, retiro local, tarifa fija/por zona y transportista caído. El total recalculado por servidor coincide al centavo; ninguna tarifa se inventa.
27. **Pagos online:** sandbox y producción aislados; creación idempotente de orden/sesión; retorno del navegador sin webhook no acredita el pago; pago aprobado sólo tras consulta/verificación del servidor; rechazado, cancelado, pendiente, reembolso, contracargo, timeout, evento duplicado, evento fuera de orden, firma inválida, monto/moneda/cuenta/tenant discrepantes y API caída. Los errores van a revisión y no permiten despacho.
28. **Webhook y multitenancy:** evento válido se procesa una sola vez; replay y payload de tenant ajeno son rechazados; el mismo evento repetido no duplica movimientos ni cambia dos veces la orden; no se acepta un estado `approved` del cuerpo sin verificación independiente; rate limit, límite de payload y respuesta sin datos sensibles; cuenta/proveedor/ambiente están asociados al tenant correcto.
29. **Secretos de pago y transporte:** escanear código fuente, HTML final, bundle, source maps, configuración pública, IndexedDB, respuestas, logs, auditoría, exportación y errores para detectar tokens. La UI de credenciales es write-only, el valor no se vuelve a renderizar, sólo admin puede rotar y ningún usuario/tenant lee secretos ajenos. Revocar/rotar no interrumpe el flujo WhatsApp.
30. **Pedidos y despacho:** estados de pago separados de estado de entrega; distintivo “Pagado — listo para despachar” sólo en orden aprobada no cancelada/no despachada; dirección restringida por rol; cambios manuales requieren permiso, motivo y auditoría; etiqueta/tracking no se simulan; reembolsos/contracargos y cancelaciones conservan historial sin borrar la orden.
31. **Privacidad y abuso:** XSS en nombre/dirección; CSRF donde corresponda; enumeración/IDOR de órdenes; abuso de checkout, repetición de solicitudes, cantidades/importes extremos, datos de entrada enormes, inyección de fórmulas en exportaciones y SSRF en configuración de transportistas. Ningún dato de tarjeta es almacenado; se prueban retención y borrado/anonimización conforme a política.
32. **Sin conexión y regresión:** offline no afirma que el pedido está enviado/pagado; reconexión concilia por clave idempotente; caída del proveedor checkout/webhook/transporte no pone la nube principal en estado “caída” ni bloquea POS/WhatsApp. Ejecutar toda la regresión V26.


33. **Wallet de fidelización:** sin cuentas/certificados el módulo queda pendiente y la tarjeta web sigue funcionando; generar pase Apple firmado por backend y enlace Google oficial en entornos de prueba; validar propietario/tenant, ID opaco, datos mínimos, QR/código sin PII y canje validado en servidor; token vencido, usado, alterado o de otro comercio rechazado; tarjeta no declara “guardada” sin señal verificable; actualización de saldo al cambiar el ledger; revocación/baja de registro cuando esté soportada; ningún secreto en HTML, bundle, logs, backups o respuestas.
34. **Avisos automáticos y consentimiento:** comprobar cada trigger configurado sólo tras evento confirmado; separación marketing/transaccional; cliente sin opt-in comercial excluido; baja inmediata e idempotente; cambio de preferencias; ventanas de silencio, zona horaria, cooldown y límite de frecuencia; doble evento no duplica mensaje; proveedor caído/rechazo/429/timeout, reintento y DLQ; estados “aceptado”, “enviado”, “entregado” y “leído” sólo cuando el canal los reporte; el worker funciona sin navegador abierto; fallo de comunicaciones no rompe POS, nube, fidelización ni checkout.
35. **Envío y automatización segura:** link de tarjeta expira, no se enumera, tiene alcance limitado y no filtra datos por query/logs; destinatario no autenticado recibe respuesta genérica; plantillas con XSS/inyección neutralizados; WhatsApp usa sólo API oficial/plantillas vigentes, correos incluyen baja cuando corresponda, notificaciones push requieren permiso del usuario; pruebas de aislamiento entre tenants y sucursales, rate limits, pausa de campaña masiva y auditoría de quién la activó.
36. **Club V26.3 (4.6):** celular nuevo → tarjeta en el acto → importación por un equipo con sesión (admin y mostrador) → el celular pasa de «en trámite» a «Socio N.º 0001»; sellos por QR, código de 8 cifras, DNI y NFC (simulado, con reloj ajustable en todos los dispositivos); segundo sello el mismo día rechazado; código repetido rechazado; premio y reversión por anulación; segundo celular del mismo cliente (mismo WhatsApp **y** mismo cumpleaños) con tarjeta propia y con otro cumpleaños rechazado; altas viejas y altas que el equipo no puede abrir **no se descartan**; DNI repetido (pide elegir), inválido y borrado en la baja; el DNI nunca en claro en la nube; `club_estado` sin datos personales y con aislamiento A/B; meta y premio publicados; cupones de todos y de socios, con límite por cliente y uso sincronizado. NFC y cámara con hardware real: **pendiente de prueba física**.
37. **Mayorista/minorista (4.22):** las pruebas de **4.22.14**, fase por fase; con las banderas apagadas la regresión de las suites anteriores no cambia, y con ellas encendidas y apagadas sobre la misma base el estado previo carga sin errores.

38. **Traspasos, detalle de cobros y expediente (4.23):** las pruebas de **4.23.11**, paso por paso (permiso en interfaz y servidor, cajas cerradas con cierre sellado intacto, comprobante de 8 campos, invariante enviado = recibido + tránsito + diferencias, tablas sólo-agregar con `UPDATE`/`DELETE` rechazados, detector de PAN, pago mixto $ 10.000 + $ 15.000 + $ 50.000, expediente); con las banderas apagadas la regresión de las suites anteriores no cambia.

39. **Caja y clientes del Club (4.24):** las pruebas de **4.24.5**: detalle de cada venta minorista y mayorista con sus movimientos, turno de 5.000 operaciones sin tope, edición, baja y eliminación del administrador validadas en interfaz y servidor, tarjeta revocada, alta pendiente que no reaparece; con las banderas apagadas la regresión de las suites anteriores no cambia.

40. **Tiendanube (4.28) y pasos de conexión:** las pruebas de **4.28.5**: firma inválida, evento duplicado, orden vieja que no retrocede, `state` de un solo uso, token ausente de respuestas, registro de una orden = una venta con total exacto y stock descontado, registro repetido sin segunda venta, función no instalada sin bucle ni «nube caída», 360 y 1280 px; con Tiendanube real **pendiente** hasta tener la app y la tienda.
41. **Enmiendas V26.12:** cobro por tramos (renglones que cumplen cantidad × precio), traspasos sin rubros (opción apagada por defecto), pago repartido entre cajas (suma exacta, todo o nada, oculto en la nube si falta la migración 12) y aislamiento de las reglas de Almacén RAVE (4.27) por datos.

Matriz de trazabilidad: requisito → archivos/tablas/funciones → pruebas → resultado. Nada se declara "aprobado" sin evidencia reproducible.

---

## 14. LECCIONES APRENDIDAS (no repetir)

- Un producto cargado se ve en el menú sin recargar; categorías y productos usan el mismo alta/edición y foto; el estilo de tarjetas del menú no contamina al panel; en 360 px nada desborda; la capa del menú lateral no ocupa lugar en la grilla.
- Un `</script>` o un `<!--` dentro de un string de JavaScript rompe todo el bloque: escaparlos al incrustar documentos (`<\/script>`, `<\!--`, `<\script`). Una prueba de consola vacía no alcanza: abrir la página y verificar que arranca.
- Modales reutilizados: los listeners no deben actuar con el modal cerrado; un modal que abre otro no debe cerrarlo después (usar `setTimeout`); un modal que reemplaza a otro debe volver a abrir el asistente.
- `type=number` con `valueAsNumber`; fechas con año de 4 cifras antes que de 2 en las regex; probar con 21/05/1990; las fechas de nacimiento no pasan por el validador de fechas de operaciones.
- "0" precargado en montos: prohibido (placeholder y selección al enfocar); probar tecleando directo.
- Un botón de teclado en pantalla con texto arriba a la izquierda indica falta de `display:flex`: revisar con captura de pantalla, no sólo con pruebas.
- WebUSB no puede tomar impresoras que el sistema ya maneja: por eso existe "Impresora de Windows". No prometer reconocimiento automático total.
- Atajos de teclado: `preventDefault` sobre F5/F11/F12 dentro del POS y navegación previa fuera de Vender.
- No meter datos nuevos dentro de un cierre sellado: lo editable va en un registro aparte.
- Con nube activa se deshabilita "Borrar historial" y no se restaura un respaldo legible encima.
- Si el navegador de prueba no ve la base, validar leyendo el respaldo cifrado y recargando.
- Datos de demo: rotular "ejemplo"; los números del servidor con fechas absurdas no pueden romper vistas; las notas de crédito restan también en los reportes.
- Un reporte de cierre sin socios configurados no muestra paréntesis vacíos ni secciones sin contenido.
- Si el menú del cliente en producción es el mismo archivo que usan una tarea programada y un instalador, **no reemplazarlo con una demo**: publicar aparte.
- Un secreto encontrado en HTML público del cliente se reporta y se recomienda rotar; no se reutiliza.
- **Fiscal:** el WSAA rechaza pedir un TA nuevo mientras haya uno vigente: guardarlo y reutilizarlo; el reloj del servidor debe estar en hora; ante un corte durante `FECAESolicitar` consultar el comprobante antes de reintentar (si no, se saltea o duplica un número); la condición de IVA del receptor es obligatoria desde la RG 5616 `[VERIFICAR]`; un simulador no es una homologación; la clave privada se genera y queda en el servidor, nunca en el navegador.
- **Nube:** nunca enviar el stock desde el navegador (enviar movimientos); lo que se escribe en el cliente y en el servidor con la misma regla de negocio se prueba con dos equipos reales en paralelo; "Confirm email" activado traba el alta; si el proyecto ya tenía un esquema de un sistema anterior, `create table if not exists` conserva la forma vieja sin avisar: limpiar de forma explícita y con respaldo; una clave `secret` encontrada en un repositorio público se reporta y se rota.

- **Lecciones v2.2:** (1) una lectura de sincronización que empezó antes de obtener el CAE puede llegar después y pisarlo: al aplicar datos del servidor sobre una venta, conservar el `arca`/`arcaNC` local si el entrante no lo trae; (2) el QR fiscal (~300 caracteres) no entra en un generador limitado a la versión 12: ampliar y verificar con un lector independiente (OpenCV) en vez de confiar en que "se ve un cuadrado"; (3) un 502 de la función fiscal no es "sin internet": conservar `etapa` y motivo; (4) las pruebas con navegador bajo CSP estricta no pueden usar `wait_for_function` con texto (usa `eval`): consultar en un bucle con `evaluate`; (5) el modo "Con ARCA" del POS queda activo entre ventas (visible y auditado): las pruebas deben apagarlo antes de una venta interna; (6) el CAE no entra en la sincronización genérica: lo escribe el servidor fiscal y `sincronizar()` lo preserva; (7) si el navegador y el servidor ven la misma venta, el receptor identificado **no** debe quedar en los registros genéricos; (8) las carpetas y nombres de repositorio de un cliente (`AlmacenRAVE`) y de la demo (`raveV2`) son distintos: nunca reutilizar la base local ni la clave publicable entre ellos.
- **Lecciones v2.3:** (1) **un módulo opcional que falla jamás puede marcar la nube como caída**: las llamadas a funciones de servidor (`/functions/v1/…`, p. ej. ARCA no desplegada → sin CORS → error de red) no tocan el indicador de conexión (`fn:true`), y esos módulos no se consultan en cada sincronización si no hay nada que hacer (reintentos ARCA sólo si hay facturas pendientes de CAE); el indicador "Sin conexión" se reserva a fallas de la API principal; probar con la función caída. (2) **La variante del cliente nunca dice "demo"**: ni títulos, ni tarjetas ("Datos de la demo", "Empezar de cero"), ni etiquetas ("SIMULADO" → "Pendiente de configuración"), ni botones simulados (balanza); la demo conserva sus rótulos. Prueba obligatoria: recorrer **todas** las pantallas de la variante cliente y buscar `demo|simulad` en el texto visible. (3) **Cada compilación lleva fecha/hora y variante visibles** (Configuración: "versión del cliente · compilada AAAA-MM-DD HH:MM UTC") para distinguir de inmediato una copia vieja en caché del navegador; ante "no veo el cambio": Ctrl+F5 y comparar esa marca. (4) Las filas con controles variables (checkbox que agrega un campo) **no** pueden ser una línea flex sin `wrap`: los botones de acción terminan recortados por la tarjeta y el usuario cree que "no se puede editar". (5) Antes de decir "conectado", comprobar con una llamada real (`menu_publico`) y mirar los registros de la API del proveedor en vez de suponer. (6) El resultado de un script de instalación (SQL) se verifica leyendo las tablas creadas, no con "corrió sin errores". (7) **Importar .xlsx se lee de verdad** (no alcanza con decir "guardalo como CSV"): lector propio sin librerías externas (la CSP no las permite): zip + `DecompressionStream('deflate-raw')` + `DOMParser`, primera hoja, textos compartidos, fechas por formato de celda (→ dd/mm/aaaa), decimales a formato argentino, tope de tamaño descomprimido (anti zip-bomb); `.xls` viejo se rechaza con instrucciones. Se prueba con un Excel real (título arriba, fecha 21/05/1990, decimales, tildes, código de barras largo). (8) **Los requisitos de tamaño se miden con números**, no a ojo: la prueba lee `getBoundingClientRect()` y falla si un botón táctil mide menos de 44 px o se sale de su tarjeta.

---

## 15. PUBLICACIÓN Y ENTREGA

1. Catálogo y, si hay, migración del sistema anterior (importadores). 2. Personalización (logo, textos, colores, contacto, reglas de venta restringida, dirección corta). 3. Ensamblado (URL y clave publicable). 4. Pruebas automáticas en verde (sección 13). 5. Revisión de correcciones en una sola pasada y, si el riesgo lo justifica, revisión independiente de seguridad. 6. Publicación: hosting estático (por ejemplo GitHub Pages: rama principal, raíz) en un repositorio **distinto** de cualquier producción que ya exista salvo orden expresa; instalador y SQL aplicados en entorno de prueba antes de producción. 7. Prueba desde cero en el local (PC, celular como segunda caja, corte de internet, permisos, quitar un usuario, cargar una factura, cerrar caja, simular clave olvidada). 8. Capacitación del dueño (código de recuperación, respaldo, equipo, nube, NFC, lectura de facturas, redes y menú).

**Repositorios:** uno para la **demo** (datos de ejemplo, simulador fiscal, nube sin configurar) y uno por **cliente** (datos reales, sin simulador, nube configurada); nunca mezclar ni reutilizar el de otro cliente ni reemplazar un archivo que usa una tarea programada o un instalador. Los scripts SQL y las funciones viajan en el repositorio del cliente (carpeta `supabase/`).

**Lo que depende de terceros (decírselo siempre al cliente):** CAE real (certificado y servicio del organismo fiscal, alta del punto de venta, clave fiscal del titular); nube (proyecto del proveedor, scripts SQL ejecutados por quien tiene acceso, secretos de las funciones); IA en la nube (clave y costos); cobros online (cuenta, credenciales, webhooks, sandbox); Apple Wallet (cuenta/desarrollo, certificado de firma y servicio seguro para pases actualizables); Google Wallet (cuenta de emisor, permisos de API y credenciales de servidor); WhatsApp Business, correo, SMS y push (proveedor, plantillas, permisos, dominios, opt-ins, cuotas y costos); transportistas (credenciales, cobertura y API vigente); Meta (permisos, políticas, consentimiento); tiendas de apps y firma de código (cuentas y certificados pagos); agente local y hardware real (etapa futura / sin probar); normativa (registro de bases, plazos de conservación, comunicaciones comerciales, horarios de venta restringida y textos legales: asesor y fuente oficial); recuperación (sin contraseña ni código no hay datos).

**Definición de terminado:** todo publicado (web, instalador, SQL aplicado) · pruebas en verde y revisión independiente sin pendientes de seguridad · regresión · documentación (guía de nube, de Windows, prueba desde cero, arquitectura de compras/cajas, soporte, este prompt) · entrega honesta con límites. Para V26 se suma: cobertura de acciones conversacionales trazable por módulo; migraciones de cajas/sucursales aplicadas en base de prueba; pruebas RBAC/RLS y conciliación; pruebas de borrado admin; inventario de tablas con ordenamiento y pruebas de accesibilidad; si Checkout Online está activado, prueba real/sandbox de orden, pago, webhook idempotente, envío y no exposición de secretos; si Wallet/avisos están activados, prueba de generación/guardado de pase, actualización, consentimiento, baja, cola/worker, idempotencia y estados reales de entrega. Sin credenciales/cuenta del propietario, declarar el paso productivo pendiente y mantener el módulo apagado. Para V26.4 se suma: cada fase de 4.22 con su migración aplicada y probada dos veces (base nueva y base con datos), las pruebas de 4.22.14 de esa fase, regresión con banderas apagadas y encendidas, y revisión independiente de F1, F5 y F7.

**Formato de la entrega final (obligatorio):** módulos implementados; migraciones; suites de prueba y resultados; integraciones realmente configuradas; secretos que debe cargar el dueño por canal seguro; dependencias pagas; dispositivos probados (marca/modelo/versión/SO/driver) y pendientes de prueba física; límites conocidos y riesgos abiertos. Prohibido "100 % funcional", "sin errores" o "aprobado" sin evidencia.

---

## 16. CHECKLIST DE ADAPTACIÓN A UN NEGOCIO NUEVO (actualizado para V26)

1. Completar la ficha (sección 1) y marcar `[PENDIENTE]` lo que falte.
2. Elegir rubro y prender/apagar módulos con la matriz (sección 11).
3. Cargar logo, colores y datos del comercio; revisar que nada del comercio anterior quede fijo en el código (buscar nombre, teléfono, redes, direcciones, alias).
4. Definir rubros del inventario con color, diseño en el menú, y reglas de venta restringida; definir unidades (und/kg/lt) y la política de venta sin stock.
5. Importar el catálogo (con modo prueba) y asignar rubro financiero a todo lo histórico.
6. Configurar cajas, usuarios, roles y, si hay socios, el módulo de reparto.
7. **Nube (6.11):** repositorio propio del cliente, scripts SQL en orden, "Confirm email" desactivado, ensamblado con URL + clave publicable, comercio creado y código de recuperación guardado.
8. **Facturación electrónica (4.12):** datos del emisor, CSR, certificado, relación de servicio y punto de venta, "Probar conexión" en homologación, recién después producción.
9. Configurar fidelización (meta, premio, tarjeta modelo), cupones y planes de ejemplo → reales.
10. Configurar el menú público: textos en ES/EN, frases y leyendas confirmadas, redes (con las no usadas apagadas), mapa/reseñas, Wi-Fi, acceso oculto, créditos.
11. Paquete legal local confirmado por asesor.
12. Periféricos: conectar, probar y registrar marca/modelo.
13. Ejecutar la batería de pruebas (sección 13) y la prueba desde cero en el local.
14. Configurar el perfil de cajas (simple / operativas y principal), sucursales y alcance de Casa Central según la operación real.
15. Revisar la matriz del asistente: habilitar entrada de voz/texto, configurar proveedor y costos si aplica, validar acciones publicadas, permisos y políticas de confirmación; conservar alternativa manual.
16. Verificar borrado/archivo de artículos con rol admin y denegación real para el resto de los roles; comprobar que todas las tablas de datos usen ordenamiento.
17. Ejecutar la batería de pruebas (sección 13), incluida la regresión de V26 y la prueba desde cero en el local.
18. Si el cliente necesita e-commerce, configurar Checkout Online de 4.18: escoger modo de venta, probar sandbox, definir métodos/tarifas de entrega, configurar secretos por canal seguro, registrar webhook, revisar privacidad/devoluciones y aprobar las pruebas antes de activar producción. Si no se necesita, mantenerlo apagado y confirmar que WhatsApp sigue funcionando.
19. Si el cliente utiliza fidelización digital, configurar 4.19: proveedores/cuentas de Apple Wallet y/o Google Wallet, certificados y secretos por canal seguro, diseño y contenido mínimo del pase, enlace/autenticación de cliente, canales automáticos, plantillas, reglas, horarios, límites, consentimiento por finalidad/canal, baja y política de retención. Probar la generación, el guardado real en dispositivos compatibles, las actualizaciones y los avisos con estados verificados; si faltan requisitos de proveedor, conservar la tarjeta web y mostrar la dependencia pendiente.
20. Publicar (sección 15), capacitar al dueño y entregar el informe honesto.
21. Si el cliente vende por mayor (4.22): completar las filas de la ficha, responder las preguntas de E.6 una sola vez, elegir las fases, construirlas en orden con regresión verde en cada una y dejar `wholesale.on` apagada hasta que el dueño valide las listas y los clientes mayoristas con datos reales.

---


### Lecciones adicionales V26 (obligatorias)
- La IA no es el sistema de permisos: cada herramienta vuelve a comprobar autorización en backend. Ocultar un botón nunca reemplaza RBAC/RLS.
- Una intención reconocida no prueba que una operación quedó guardada. La respuesta de éxito se emite sólo tras confirmación de la fuente de verdad y debe mostrar los estados pendientes.
- La idempotencia se aplica al efecto económico/operativo, no sólo a la transcripción. Un audio repetido, un doble clic o un timeout no puede duplicar comandas, ventas, movimientos ni transferencias.
- En una consolidación de caja, un movimiento origen y sus asignaciones son una misma operación económica. No sumar simultáneamente el padre y el espejo en el total.
- Los cierres sellados e históricos fiscales no se editan ni se eliminan para facilitar un reporte. Se crean movimientos compensatorios auditados cuando corresponda.
- La ordenación por servidor sólo acepta columnas en lista blanca y valores enlazados/parametrizados; nunca se concatena una columna recibida del usuario.
- El borrado masivo requiere una vista previa y resultado por artículo. Selección vacía jamás significa “todos”.
- El proveedor de IA/voz puede fallar sin degradar el estado de sincronización principal. La interfaz debe reportar ambos estados separadamente.
- Las pruebas de voz no usan únicamente mocks del modelo: además comprueban que las operaciones resultantes existen en la base de prueba y que los permisos fueron aplicados.
- En Checkout Online, un retorno del navegador nunca acredita un pago; verificar el estado desde el backend y el API del proveedor antes de activar preparación/despacho.
- Los webhooks se repiten y pueden llegar fuera de orden: registrar evento/resultado y aplicar transiciones idempotentes; consultar al proveedor antes de reintentar tras timeout para no duplicar cobros.
- Las credenciales de pago no se guardan en `config_envios`, `mercadopago_keys` genérico ni sincronización pública. Guardar sólo referencias a secretos server-side y probar el HTML/bundle compilado para descartar filtraciones.
- Un pedido enviado por WhatsApp es una solicitud; una orden de checkout, un pago aprobado, una orden preparada y un envío despachado son estados distintos. No mezclarlos en los reportes ni en la caja.
- Un enlace de Apple/Google Wallet enviado no demuestra que el cliente guardó la tarjeta; mostrar sólo el estado que el proveedor permite verificar. Mantener la tarjeta web como alternativa y no crear saldos paralelos.
- Las notificaciones se generan desde eventos de servidor confirmados y salen por una cola/worker; no depender de que un navegador permanezca abierto ni llamar “entregado” a un mensaje sólo aceptado por el proveedor.
- La recepción de una tarjeta del Club no implica consentimiento comercial. Mantener finalidades y canales separados; las bajas, límites de frecuencia y preferencias deben respetarse en todos los canales integrados.
- **Un permiso nuevo que reemplaza a otro (traspasos: de `close_cash` a `transfer_funds`) se migra con aviso y botón explícito, nunca en silencio**: quien lo tenía y lo pierde tiene que enterarse, y quien no lo tenía no lo recibe solo. Un cierre sellado no se toca para registrar lo que pasa después: va en un registro aparte vinculado. «Inalterable» se escribe siempre con su límite (4.23.8).

## Anexo histórico de lecciones del prompt base (contenido preservado)

- **Lecciones v2.4 (ARCA práctico para el cliente):** (1) **El instructivo de certificados vive dentro del producto**, no en un PDF aparte: Administración → ARCA muestra un asistente de 5 pasos por ambiente (homologación y producción separados) con estado **hecho/pendiente** en cada uno, el paso en curso abierto y el resto plegado: (1) datos del emisor; (2) generar clave y CSR en el servidor (el CSR queda visible mientras no haya certificado: copiar/descargar); (3) qué pedir en ARCA, con **los valores exactos listos para copiar** (alias, CUIT, CSR) y los nombres de menús de cada ambiente (homologación: WSASS "Nuevo certificado" → "Crear DN y obtener certificado" → "Crear autorización a servicio" `wsfe`; producción: "Administración de Certificados Digitales" → "Agregar alias"; relación en el Administrador de Relaciones de Clave Fiscal; punto de venta "RECE para aplicativo y web services") — todo marcado [VERIFICAR] porque ARCA renombra menús; (4) cargar el .crt; (5) autorizar el servicio y crear el punto de venta. Resumen "✔ clave · ✔ certificado · vence AAAA-MM-DD" siempre visible fuera de los plegables, más una lista de **errores típicos** con su causa (computador no autorizado a wsfe, certificado de otro ambiente, TA vigente, punto de venta de otro sistema, certificado vencido, clave no corresponde). (2) **La carga del certificado perdona el formato y nunca la seguridad**: acepta .crt/.pem/.cer en texto o DER binario, con saltos CRLF, BOM o texto alrededor (extrae el bloque), re-arma el PEM; **rechaza en el navegador, con explicación** una clave privada pegada (jamás se envía) y un CSR pegado en lugar del certificado; el servidor sigue validando que corresponda a la clave del comercio, que no esté vencido y guarda el vencimiento. (3) **Una función de servidor nueva se despliega en el proyecto nuevo**: tras crear un proyecto de Supabase la Edge Function `arca` no existe; se despliega (panel: Edge Functions → Via Editor, un solo archivo `supabase/despliegue-panel/arca-index.ts` generado con `bundle_arca.py`, "Verify JWT" **apagado** porque la función valida la sesión, secretos `ARCA_MASTER_KEY` —generada, nunca mostrada— y `ALLOWED_ORIGINS`) y se comprueba con una llamada real (sin sesión debe responder 401 con CORS). (4) **Prueba obligatoria del asistente**: generar CSR, rechazar CSR/clave/texto pegados, cargar un certificado firmado con la clave del comercio (incluso con CRLF y basura alrededor), rechazar uno de otra clave, probar conexión de punta a punta contra un ARCA falso, y regresión de cola/rechazos/notas de crédito. Lo que **no** se puede declarar probado sin el certificado real del cliente: la comunicación con ARCA homologación/producción.
- **Equipo, invitaciones y datos sensibles (v2.5):** (1) **En la nube las personas con acceso son los miembros del comercio (Supabase Auth + tabla `miembros`), nunca una lista local**: los "usuarios con PIN" del navegador se vacían al cargar la nube (la identidad viene de la sesión) y por eso un "+ Usuario" local parecía "no guardarse". Administración → **Usuarios y permisos** muestra, en la variante con nube, la tarjeta **Equipo**: lista de miembros con correo y rol, cambio de rol, **Quitar** (corta el acceso en todos los equipos), **Invitar a una persona** (correo, nombre, rol) y **invitaciones pendientes**. La misma tarjeta se reutiliza en la pantalla Nube (un solo componente, `teamCardHtml/teamInit`, sin duplicar). Sólo el administrador la ve; el resto ve un aviso. La lista local con PIN queda únicamente en la demo sin nube. (2) **Invitación práctica:** el código de acceso (12 caracteres, un solo uso, 14 días) se muestra **una sola vez** junto a un mensaje listo con el enlace, el correo y las instrucciones ("Acceso del equipo → Tengo una invitación") y botones **Copiar mensaje** y **Enviar por WhatsApp**; la clave de cifrado del comercio viaja envuelta con ese código, nunca en claro. (3) **Funciones que ya existen pero no se encuentran son una falla**: toda acción de gestión (invitar, quitar, cambiar rol) debe estar en la pantalla donde el administrador la busca (Usuarios y permisos), no sólo en una pantalla técnica. (4) **Datos sensibles ocultos por defecto:** el CSR sólo se muestra mientras falta el certificado (el servidor deja de enviarlo y el navegador lo borra al cargar el .crt); el campo del certificado se vacía tras cargarlo; la clave privada de ARCA jamás sale del servidor y una clave pegada por error se rechaza en el navegador; la clave de Wi-Fi del panel es un campo de contraseña con botón mostrar/ocultar; los códigos de acceso y de recuperación se ven una sola vez; auditoría, mensajes de error y logs no llevan claves, tokens ni certificados. (5) **Pruebas obligatorias:** Usuarios y permisos sin botón local en la nube; invitar, ver pendiente, recargar y que siga; el invitado entra con su rol; un mostrador no ve el formulario; cambiar rol llega al servidor; el mensaje de invitación trae enlace, correo y código.

---

---

## ANEXO AS-BUILT V26 (implementación real al 2026-10-18; evidencia reproducible)

Este anexo dice **qué quedó construido y probado** y qué no. No amplía los requisitos de las secciones anteriores: los mapea a código real.

### A. Mapa requisito → implementación
| Requisito V26 | Estado | Dónde vive | Prueba |
|---|---|---|---|
| 4.15 Ordenamiento reutilizable | **Hecho** (todas las tablas de las 22 pantallas, salvo las marcadas `data-nosort`) | `p2b-sort.js` (potenciador único con `MutationObserver`; números con formato argentino, fechas, tildes, vacíos al final, estable, `aria-sort`, teclado, ≥44 px) | `t/v1.py` 19/19 |
| 4.16 Borrado protegido | **Hecho** (sólo administrador; vista previa; `ELIMINAR` + motivo; archivo con historial; restaurar; masivo; selección vacía ≠ todos) | `p3-ops.js` (`delFlow`, `delPreview`, `archiveItem`), reglas de servidor en `supabase/06-v26.sql` | `t/v2.py` 24/24 · SQL 152/152 · `t/c15.py` |
| 4.14 Cajas flexibles / traspasos / consolidado | **Hecho en el cliente y en la nube**: perfiles `simple`/`main`/`branches`, cajas, traspasos inmutables con rubro obligatorio, consolidado sin doble conteo, cierre con foto de caja y sucursal | `p3c-cash.js`, `p9-cloud.js` (colecciones `sucs`, `cajas`, `ctransf`), `06-v26.sql` | `t/v3.py` 41/41 · `t/c15.py` |
| 4.14.4 Multisucursal | **Parcial**: sucursales y reglas de traspaso entre sucursales en el cliente; el aislamiento por sucursal **en el servidor** (RLS por sucursal) queda pendiente | — | — |
| 4.13 Asistente conversacional | **Hecho en modo texto con reglas locales**; voz del navegador **apagada por defecto**; modelo de lenguaje externo y voz en la nube: **Pendiente de configuración** | `p3d-assist.js` (`ActionRegistry` lista blanca de 14 acciones; confirmación por riesgo; críticas bloqueadas con acceso guiado; auditoría; estados `borrador`/`pendiente de sincronización`/`ejecutado`/`rechazado`/`fallido`) | `t/v4.py` 61/61 |
| 4.18 Checkout online | **Sólo panel honesto**: modo de venta (`whatsapp` por defecto), parámetros no secretos de entrega, lista de requisitos; **no se puede activar** sin proveedor y servidor; sin pagos simulados | `p4b-online.js` | `t/v5.py` 15/15 |
| 4.19 Wallet y avisos | **Sólo panel honesto** (apagado, requisitos, consentimientos reales); sin pases ni avisos | `p4b-online.js` | `t/v5.py` |
| 4.20 Pagos mixtos, vuelto y cuenta corriente parcial (V26.1) | **Hecho** en cliente y nube: modo mixto, suma exacta, alerta de vuelto, arqueo con dinero real, débito automático, estado Pago parcial, libro del cliente | `p3b-pos.js` (`payCheck`, `commitSale`, `saleOkHTML`), `p3-ops.js` (`arqueoCalc`), `p6-loyalty.js` (`ccLedger`), `07-pagos-mixtos.sql` | `t/v7.py`, `t/c16.py`, SQL 14 |
| 4.21 Proveedores y compras (V26.2) | **Hecho** en cliente, nube y API: proveedores con CUIT validado, órdenes de compra, **ingreso de mercadería atómico** (stock + costo + deuda o egreso de caja con rubro; todo o nada), pagos, notas de crédito, libro sólo-agregar, tablero (deuda y órdenes pendientes), tabla ordenable, carga de remito, API REST con idempotencia, exportaciones | `supabase/08-proveedores-compras.sql`, `supabase/functions/api/` (+ `despliegue-panel/api-index.ts`), `p4c-compras.js` (motores nube y local), `p4d-compras-ui.js` (pantalla), CSS `.cmp-*` en `p1-head.html` | SQL 120 pruebas nuevas, concurrencia, `a1` 27/27 (API), `p1` 47/47 (demo), `c17` 31/31 (nube), `p2` 41/41 (responsive) |
| Marca oficial VINCULAR BUSINESS (V26.1) con banner final y botones WhatsApp/Llamar/Correo | **Hecho** en ingreso, barra lateral, menú público (ES/EN), tickets, tarjeta del Club, mensajes de error de SQL/funciones y README | `VB`/`vbFooter` en `p2-core.js`, `assets/vb-banner.webp`, `build/pub_body.html` | `t/v8.py` |
| 6.10 Rubro financiero obligatorio | Se mantiene (también en traspasos y en el servidor) | `06-v26.sql` | SQL 152/152 |
| 4.6 Club V26.3: tarjeta en el celular, importación de altas, sellos por QR/código/DNI/NFC, cupones | **Hecho** en cliente y nube (NFC y cámara reales sin probar) | `p6-loyalty.js`, `p9-cloud.js`, `pub/post.js`, `09-club-tarjeta.sql` | `c18` 51/51 · `c19` 21/21 · SQL 307/307 |
| 4.2 Selector Remito / Presupuesto | **Pendiente** (hoy sólo Ticket interno o Factura electrónica) | — | — |
| **4.22 Mayorista / Minorista (V26.4–V26.6)** | **F1 hecha y probada** (anexo F); F2–F7 especificadas, no implementadas (matriz 4.22.0) | Este documento | — |

### B. Resultados de las suites (2026-10-18)
- SQL (Postgres 16 real, scripts 01–08 dos veces para comprobar idempotencia + tests 10–15; `INSTALAR-TODO.sql` aplicado dos veces sobre una base nueva): **293 OK / 0 FALLAN** (173 anteriores + 120 de proveedores y compras).
- Concurrencia de compras (`21-concurrency-compras.sh`): misma clave ×6 se aplica 1 vez; 8 comprobantes simultáneos del mismo producto suman bien (stock, deuda y libro sin saltos); 8 pagos simultáneos contra una deuda aceptan sólo los que caben. **OK**.
- API REST de compras (`a1`, servidor de prueba): **27/27**. Pantalla de Proveedores y compras: demo `p1` **47/47**, nube `c17` **31/31** (stock sin doble conteo, sin conexión no guarda, reintento sin duplicar), responsive `p2` **41/41** (320/360/768/1440 px).
- Demo/local con Chromium: `d1` 11/11 · `v1` 19/19 · `v2` 24/24 · `v3` 41/41 · `v4` 61/61 · `v5` 15/15 · `v6` 6/6 · `v7` 34/34 (cobro mixto) · `v8` 25/25 (marca y botones) (22 pantallas sin desborde a 320/360/768 px).
- **Regresión completa V26F (2026-10-19, servidor de prueba y Chromium reales):** demo `v1` 19/19 · `v2` 24/24 · `v3` 41/41 · `v4` 61/61 · `v5` 15/15 · `v6` 6/6 · `v7` 33/33 · `v8` 25/25 · `d1` 11/11 · `p1` 47/47; nube `c2` 29/29 · `c3` 12/12 · `c4` 35/35 · `c5` 7/7 · `c14` 9/9 · `c15` 18/18 · `c16` 6/6 · `c17` 31/31 · `c18` 51/51 · `c19` 21/21 · `p2` 41/41 · `a1` 27/27 y las demás (c1, c6–c13, s1) sin fallas; SQL 307/307 (01–09 + tests 10–16).
- Regresión anterior tras sumar el módulo de proveedores: demo `v1`–`v8` y `d1` sin fallas; nube `c2`–`c5`, `c10`, `c14`, `c16` sin fallas; `c15` 18/18 (una corrida aislada tuvo 2 fallas por tiempos de espera y dio 18/18 en tres repeticiones).
- Nube con servidor de prueba local y equipos reales en paralelo: `c2` 29/29 · `c3` 12/12 · `c4` 35/35 · `c5` 7/7 · `c10` 8/8 sin fallas · `c14` 9/9 · `c15` 18/18 · `c16` 6/6 (venta mixta en la nube) (borrado, archivo con ventas, rechazo del servidor a un mostrador manipulado, cajas y traspaso inmutable).

- **Club RAVE / tarjeta / sellos / cupones (V26.3, 2026-10-19)** con el servidor de prueba y Chromium reales: `c18` (celular → tarjeta → importación → sellos por QR, código, DNI y NFC simulado → premio → segundo celular → altas viejas y no abrir → cupones de todos y de socios con límite por cliente y sincronización del uso) y `c19` (mostrador con rol «mostrador» importa y sella; Fidelización y Cobro por DNI; ficha con DNI repetido/ inválido; baja; el DNI nunca en claro en la nube). SQL: `09-club-tarjeta.sql` + `16-sql-tests.sql` (13 comprobaciones: aislamiento A/B, sin datos personales, inyección, baja, meta del club acotada).

### C. Límites declarados (no afirmar más que esto)
- **Club V26.3:** **NFC y lectura de QR con la cámara no se probaron con hardware ni celulares reales** (en las pruebas se simula la lectura; Web NFC sólo existe en Chrome para Android; `BarcodeDetector` depende del navegador). El lector de QR USB que escribe como teclado funciona en cualquier equipo. **Wallet (Apple/Google) no está implementado.** El límite global de usos de un cupón se controla en cada equipo y se concilia al sincronizar: dos cajas pueden gastar a la vez el último uso (mejora pendiente: reserva atómica en servidor). Si el cliente borra los datos del navegador pierde la tarjeta de su celular; el mostrador puede seguir sellando por DNI/NFC.
- Proveedores y compras: probado contra un servidor de prueba equivalente y con navegador real; **hardware, lectura de facturas con IA y ARCA** no forman parte de este módulo. La función `api` requiere que el dueño la despliegue en su proyecto (no la necesita la pantalla). El producto no es clave foránea (vive en el catálogo genérico): lo valida la función.
- **Mayorista/minorista (4.22):** la fase F1 (listas, escalones, bultos, canal, crédito con plazo) está construida (anexo F). **No construido:** lotes, documentos vinculados, cierre ciego, cheques ni asientos. El selector Remito/Presupuesto de 4.2 tampoco existe todavía.
- Checkout online, Wallet/avisos, WhatsApp Business API, correo, voz/LLM en la nube, transportistas: **sin proveedor conectado y sin prueba real**.
- Gastronomía (mesas/comandas) y servicios (agenda) no están en este comercio: las acciones del asistente correspondientes no existen (están en la tabla de exclusiones).
- Multisucursal en servidor, hardware real (impresoras, balanzas, huellas) y ARCA en producción: **no probados**. ARCA homologación fue cargada y aprobada por el dueño.
- El reconocimiento de voz del navegador (Chrome/Edge) envía audio al servicio del fabricante: se avisa en Configuración y queda apagado.
- Las pruebas de nube corren contra un servidor local equivalente; la aplicación de `06-v26.sql` en el proyecto real y la verificación en vivo se informan por separado en cada entrega.

### D. Lecciones de la implementación V26 (obligatorias)
- **Una función de negocio se hace donde el dueño trabaja.** La primera entrega del canal mayorista dejó los precios por lista en un botón aparte del inventario y una tabla de configuración que el dueño no podía usar: no estaba «hecha». Los datos que se cargan por producto (presentaciones y precios) van en el alta/edición del producto, se ven en el inventario y se usan en Vender; y se revisa con capturas en 360 y 1280 px, no sólo con pruebas automáticas.
- **Club en la nube:** nunca ocultar un bloque «porque falta la sesión» sin ofrecer la alternativa: ocultar la tarjeta dejó a los socios sin tarjeta. Una alta ilegible o duplicada **no** se marca «rechazada» (se perdía al cliente para siempre): sólo las inválidas. El servidor filtra el menú con una lista cerrada de campos (`rave_limpiar_menu`): todo dato nuevo del menú público exige actualizarla. Las pruebas con códigos que rotan cada 2 minutos y límites de 24 h necesitan reloj ajustable en **todos** los dispositivos de la prueba (`window.__now`).
- Un potenciador global de tablas (`MutationObserver` + `requestAnimationFrame`) evita tocar 16 renders; hay que guardar la clave de orden por `id` de tabla (no por atributo que el potenciador pisa) y excluir tablas efímeras (`data-nosort`).
- Al agregar una columna (casilla de selección) se corren todos los índices de columnas: las pruebas deben ubicar columnas por el texto del encabezado, no por posición.
- Una prueba de servidor que inventa un registro sin el campo obligatorio (p. ej. traspaso sin rubro) **debe** ser rechazada: usar la misma función de dominio que la pantalla para generar datos de prueba.
- Con varios modales apilados, las pruebas deben accionar el último (`.last`), no el primero.
- El asistente reutiliza el servicio de dominio (`stockAdjust`, líneas del ticket); no se duplicó lógica. Texto libre dictado no se guarda en la auditoría; se guarda acción, campos resueltos y resultado.
- Los importes derivados de una venta (deuda, cobrado, estado) los calcula el servidor; el navegador sólo propone. Una venta con pagos no se reescribe: se anula.
- Una función de pago compartida (`payCheck`) valida tanto la pantalla (aviso en vivo) como `commitSale` (decisión): no hay dos reglas que puedan divergir.
- Los textos de ayuda/soporte dentro de SQL y funciones también llevan los datos oficiales del desarrollador: al cambiarlos hay que reaplicar `INSTALAR-TODO.sql` (es idempotente).
- Tarjetas de tamaño físico fijo (modelo de tarjeta del Club, 342 px) necesitan contenedor con `overflow-x:auto` para no desbordar a 320 px.
- **Lección V26.4:** un requisito escrito en este prompt no prueba que exista en el código (el selector Remito/Presupuesto figuraba en 4.2 y no estaba construido). Antes de planificar cualquier fase se completa la matriz de detección contra el código real, no contra el texto del prompt, y se corrige el prompt si miente.
- **Lección V26.4:** un adjunto de requisitos nuevos se contrasta contra las decisiones ya tomadas (offline-first, un beneficio por compra, costo = último costo, stock negativo permitido) y las contradicciones se resuelven por escrito (4.22.13) antes de programar; no se implementan dos versiones en silencio.

---

## ANEXO E — PUNTO DE REANUDACIÓN (datos de ESTA instalación; es la única parte con datos de un cliente: borrarla al replicar el prompt para otro negocio)

**E.1 Repositorios y publicaciones.** Cliente (Almacén RAVE): repositorio `AlmacenRAVE`, publicado en `https://raveholding.github.io/AlmacenRAVE/`; contiene `index.html` ensamblado, `fuente/` (partes del código, `assemble.py`, `build.py`, pruebas y este prompt) y `supabase/` (scripts SQL y funciones). Demo: repositorio `raveV2`, publicado en `https://raveholding.github.io/raveV2/` (sólo el HTML ensamblado con datos de ejemplo y simulador fiscal). **Nunca reutilizar la base local ni la clave publicable entre ambos**, ni publicar la demo encima del cliente.

**E.2 Construcción y pruebas.** Las partes `p1-head.html`, `p2-core.js` … `p9b-arca.js`, `assemble.py`, `build/pub_body.html` y `pub/*` (menú público en iframe) se ensamblan con `python3 build.py demo|cliente`; el cliente lleva la URL real y la clave publicable. Pruebas con navegador real: `bash t/run_c.sh <script>.py` (nube, contra un servidor de prueba equivalente) y `t/*.py` (demo); regresión completa: `bash t/regress.sh`; SQL: `bash supabase/tests/run.sh` (Postgres 16, PostgREST y Deno locales). Si el entorno de trabajo no conserva esas herramientas, recrearlas desde `fuente/` y `supabase/` antes de tocar nada, y volver a correr la regresión como línea base.

**E.3 Nube.** Proyecto de Supabase en plan Pro; scripts `01`–`11` **aplicados y verificados en producción** (los `12` y `13` están escritos y probados en local, **sin aplicar** en producción: ver anexo J.4) (el `10-mayorista-precios.sql` se corrió el 2026-10-19 con permiso expreso del dueño y se comprobó por consulta). **La migración `11-traspasos-cobros-auditoria.sql` (4.23 y 4.24) está construida, probada (476/476 pruebas SQL) y aplicada en producción el 2026-10-20 (anexo G.4); es la última del paquete (`INSTALAR-TODO.sql` = 01–13; en producción están aplicadas 01–11).** Edge Function `api` desplegada con «Verify JWT» apagado (valida la sesión adentro). La referencia del proyecto y la clave publicable viven en el repositorio del cliente; ningún secreto está en el HTML.

**E.4 Estado funcional (2026-10-20).** V26.3 publicada: Club con tarjeta en el celular, importación sin pérdida de altas, sellos por QR/código/DNI/NFC y cupones por audiencia; SQL 307/307; regresión de demo y nube sin fallas (anexo B). 4.22 **F1 construida** (V26.6, anexo F); F2–F7 no. **4.23 (traspasos, detalle de cobros, expediente digital, auditoría sólo-agregar) y 4.24 (detalle de ventas de la caja, cajas sin límite, administración de clientes del Club) están CONSTRUIDAS y probadas en la demo y en SQL (V26.9, anexo G); la nube de extremo a extremo sigue sin reprobar (anexo G.3).**

**E.5 Pendientes conocidos (por prioridad).**
1. *Dueño:* entrar una vez como administrador con la versión nueva para que el menú se republique (meta, premio y cupones del Club); repetir el alta de prueba con un celular real (el alta de prueba anterior quedó rechazada a propósito).
2. *Club:* reserva atómica del último uso de un cupón en el servidor (hoy dos cajas pueden gastarlo a la vez); recuperación de la tarjeta si el cliente borra los datos del celular (reutilizando la verificación WhatsApp + cumpleaños y el alias de tarjeta); prueba con NFC y cámara reales; Wallet (necesita cuentas y certificados).
3. *4.23 y 4.24:* construidas (anexo G). Pendiente: reconstruir el banco de nube de dos equipos y correrlo (G.3.1), probar la consulta del expediente contra Supabase real (G.3.2), y que el dueño active «Detalle de cobros digitales» en Configuración y responda las preguntas de 4.23.14.
4. *(vacío: el pedido de 4.24 quedó construido; ver anexo G.)*
5. *4.2:* selector de documento Remito/Presupuesto (hoy sólo Ticket interno o Factura electrónica); se completa en 4.22 F2.
6. *4.22:* F1 hecha. Siguen, según decida el dueño, F5 (cierre ciego; recomendada para un almacén/licorería) y F6 (reportes por canal); F2–F4 y F7 sólo si el negocio las necesita.
7. *Tiendanube y migraciones 12–13:* probar en una rama de Supabase, reconstruir el banco de nube de dos equipos, pedir permiso al dueño, aplicar `12` y `13`, cargar los secretos de la función (Vincular Business), desplegarla y homologar con la app de socios y una tienda real (anexo J.4).
8. *Otros:* multisucursal con RLS por sucursal en el servidor, ARCA en producción, hardware real, Checkout online, Wallet/avisos, voz en la nube.

**E.6 Preguntas que se hacen UNA sola vez y juntas antes de empezar 4.22.** ¿Qué fases se construyen? · ¿Nombres de las listas L1–L5 y a qué clientes aplica cada una? · ¿Se vende por bulto/pack y de qué tamaño? · ¿Plazo máximo de crédito y tolerancia de mora? · ¿Algún rubro con lote y vencimiento? · ¿Cierre ciego sí/no y para qué roles? · ¿Cajas separadas por canal? · ¿Se cobra con cheque/eCheq o con retenciones? · ¿Habrá contabilidad con contador (nombre, método PPP/FIFO)? · **Para 4.23:** las siete preguntas de 4.23.14 (modo de caja cerrada, importe que pide autorizante, alerta de fondo en tránsito, campos obligatorios por medio digital, antigüedad máxima de transferencia, quién ve el expediente completo y el ordenante, cuentas bancarias y proveedores de QR). **Para 4.24:** ¿qué usuarios, además del administrador, pueden dar de baja y editar datos sensibles de clientes (`customers_admin`)? ¿Se quiere el aviso opcional de efectivo acumulado en la caja?

**E.7 Prompt de arranque (pegar al abrir una sesión nueva).**

> Leé `SISTEMA_VB_26F.md` completo y los Anexos E, F, G y J. Inspeccioná los repositorios `AlmacenRAVE` y `raveV2` (sección 12) y corré la regresión como línea base. La fase F1 de 4.22 y **4.23 y 4.24 ya están construidas** (anexo G; migración 11): reconstruí el banco de nube de dos equipos, corrélo como línea base y después continuá con la fase de 4.22 que yo indique (recomendadas F5 cierre ciego y F6 reportes por canal): listá los supuestos; si falta algún dato de E.6, preguntalo una sola vez y junto; creá las migraciones siguientes (`12`…`15`, según 4.22.9), cada una aditiva e idempotente con RLS y pruebas A/B y agregala a `INSTALAR-TODO.sql`; implementala detrás de su bandera (apagada en el cliente, con datos "ejemplo" en la demo); escribí las pruebas junto con el código; corré la regresión con la bandera apagada y encendida; publicá demo y cliente; y entregame el informe honesto (qué quedó, qué debo hacer yo, qué no se pudo probar). No rompas nada de lo existente ni afirmes "100 % funcional" sin evidencia.


## ANEXO F — AS-BUILT DE LA FASE F1 DE 4.22 (V26.6, 2026-10-19; evidencia reproducible)

**F.1 Qué se construyó** (módulo `p6b-wholesale.js`, bandera `S.cfg.wholesale.on`: **apagada en el cliente; encendida con datos «ejemplo» en la demo**). *Revisión V26.6: el modelo de listas L1–L5/escalones/bultos de la primera entrega fue reemplazado por presentaciones (ver 4.22.1 · 1.2-bis).*
- **Presentaciones** (`S.cfg.wholesale.levels`: Display, Fardo, Pallet por defecto, editables) y por producto `pres[{lv,qty,unit,barcode}]` (precio **por unidad** en centavos; el total de la presentación = `unit × qty`). Validaciones: unidades > 0 (enteras si el producto es por unidad), precio por unidad ≤ precio de la unidad y no creciente con la cantidad, sin cantidades repetidas, código de barras único.
- **Resolución única de precio** `priceResolve(p,qty,{cust,chan})`, usada por la pantalla, `commitSale` y la revisión: minorista = precio de venta; mayorista (cliente con CUIT válido) = acuerdo del cliente si existe, si no el precio por unidad de la presentación más grande que alcance la cantidad total del mismo producto en la operación (nunca sube el precio) → piso. Sin CUIT válido se cobra el precio de venta con aviso. El mayorista no recibe cupones, membresía ni sellos del Club salvo `allowClub`.
- **Pantallas:** alta/edición de producto (bloque «Precios mayoristas por presentación»), inventario (columna de precios y stock desglosado), ajuste de stock por presentación, Vender (fichas con presentaciones, botones `+ Display/+ Fardo/+ Pallet`, código de barras de la presentación, explicación de la regla y «faltan N u»), Configuración (presentaciones, tolerancia de mora, Club en mayorista, acuerdos, excepciones y ventas a revisar) y ficha del cliente (canal, CUIT, plazo, zona, vendedor).
- **Crédito:** límite + plazo (`cust.term` → `sale.due`) + tolerancia `grace`; deuda vencida por FIFO; bloqueo por vencida o por límite salvo excepción de **un solo uso** (`credit_ov`, con monto máximo, vigencia y motivo). La venta guarda `wch`, y cada ítem `lr` (regla: `L1`, `P-<presentación>`, `ACU`, `MAN`), `ll` (nombre de la presentación) y `lb` (precio base).
- **Datos nuevos:** `S.agreements` (`acuer`), `S.creditOv` (`cexc`), `S.creditUse` (`cexcu`). **Permisos:** `price_lists` y `credit_ov` (administrador siempre; supervisor por defecto). La migración `wsMigrate` limpia al cargar los campos del modelo anterior (`prices`, `tiers`, `packs`, `lists`).
- **Servidor (`10-mayorista-precios.sql`):** `sincronizar` extendida (colecciones `acuer`, `cexc`, `cexcu`), validación del canal y de la existencia del cliente, y marca `credit_review`/`crw` cuando una venta a cuenta corriente supera el límite o no tiene límite sin una excepción válida (la venta ya hecha nunca se rechaza: 4.20.9). `rave_deuda_cliente` no es ejecutable desde la API. El SQL no cambió con la revisión V26.6: las presentaciones viajan dentro del artículo.

**F.2 Pruebas (resultados reales, revisión V26.6).** Demo `ws1` 73 verificaciones (incluye el alta de producto con los 4 precios, inventario, Vender con presentaciones, ajuste por presentación, configuración y migración); nube con dos equipos `c20` 19/19; SQL `17-sql-tests.sql` 28 verificaciones (suite 335/335); regresión completa (ver el informe de entrega). Revisión visual con capturas a 360 px y 1280 px.

**F.3 Límites declarados (no afirmar lo contrario).**
1. El servidor **no recalcula** los precios por presentación: valida estructura, canal, existencia del cliente y el crédito (`credit_review`); el precio lo resuelve el equipo.
2. El CUIT va cifrado; el servidor no lo valida. El bloqueo por mora vencida por plazo corre en el equipo (el servidor sólo marca límite).
3. No hay anulación con PIN de supervisor: el piso, el crédito y el cambio de canal exigen un usuario con sesión y permiso.
4. El alta al Club exige nombre, apellido, nacimiento ≥ 18 y consentimiento: una empresa mayorista se registra como persona de contacto.
5. Falta: importar/exportar presentaciones por CSV, cargar el ingreso de compras por presentación (hoy se ajusta el stock por presentación en Inventario → Stock), mostrar la regla aplicada en el ticket impreso, y que el precio de una presentación vendida «mixta» (1 Fardo + 5 unidades) se cobra todo al precio por unidad de la presentación alcanzada (no se desglosa).
6. F2–F7 no están implementadas (remito/presupuesto encadenados, lotes/FEFO, matriz talle/color, cierre ciego, reportes por canal, contabilidad). Hardware/NFC reales sin probar.
7. Para usar la bandera con nube hay que **haber corrido `10-mayorista-precios.sql`** en Supabase; la pantalla de Configuración lo avisa.

## ANEXO G — AS-BUILT DE 4.23 Y 4.24 (V26.9, 2026-10-20; evidencia reproducible)

**G.1 Qué se construyó** (partes `p3f-transfers.js`, `p3g-paydetail.js`, `p3h-expediente.js`, `p3e-saledetail.js`, `p6c-custadmin.js` y ajustes en `p2-core.js`, `p3-ops.js`, `p3b-pos.js`, `p3c-cash.js`, `p6-loyalty.js`, `p7-devices.js`, `p9-cloud.js`; todas registradas en `build.py`).
- **G1 · Traspasos de fondos (4.23.1–4.23.3, 4.23.7):** permiso `transfer_funds` y `xfer.strict`; comprobante interno de 8 campos con impresión (58/80 mm/A4) y leyenda «NO VÁLIDO COMO FACTURA»; estados por caja abierta/cerrada (destino cerrado → *en tránsito*; origen cerrado y destino abierto → *completado*); pestaña «Traspasos» con filtros. Los créditos del comprobante son los **oficiales de Vincular Business** (`VB`), no los de Rave Holding.
- **G2 · Detalle de cobros digitales (4.23.4–4.23.5):** registro versionado por medio (transferencia, débito, crédito, QR/billetera, MODO), matriz configurable obligatorio/recomendado/oculto, validadores en `payCheck`, excepción «cobro sin comprobante» con supervisor y motivo, duplicados con autorización, «Cobros a conciliar», detector de número de tarjeta completo (heurística: tira de 13–19 dígitos con un separador, primer dígito 2–6 y Luhn → se rechaza y no se guarda), ordenante cifrado y enmascarado con revelado auditado, líneas en el ticket.
- **G3 · Expediente digital y auditoría (4.23.6, 4.23.8):** vista por venta, nota de crédito, cobro, traspaso, cierre y movimiento de caja, con secciones, línea de tiempo (rol, equipo, antes → ahora, motivo), impresión, enlace `#expediente/…` y CSV (fórmulas neutralizadas, costos sólo con permiso). Servidor: tablas `traspasos`, `traspaso_eventos`, `cobro_detalles`, `auditoria_eventos` sólo-agregar con cadena de hashes y `rave_verificar_cadena`.
- **H1 · «Ventas de esta caja» (4.24.1):** detalle de cada operación (minorista y mayorista) con los movimientos que generó, también en *Cajas cerradas*; vista única `saleDetailHTML`, reutilizada por el expediente.
- **H2 · Sin límite de operaciones por turno (4.24.2):** probado con 5.000 ventas en un turno con tiempos medidos (`h1.py`); `channel_scope` sigue opcional y por defecto `ambos`.
- **H3 · Clientes del Club (4.24.3–4.24.4):** el administrador (o `customers_admin`) edita datos sensibles; quien sólo tiene `customers` no puede (interfaz y servidor, vía huella `pfp`); consentimientos con constancia; WhatsApp repetido → fusión con motivo (bloqueada con deuda); baja que anonimiza (conserva ventas y cuenta corriente; opciones cobrar / condonar con movimiento compensatorio / mantener la deuda; revoca tarjeta y secretos; lista de bloqueo del Club); eliminación definitiva sólo sin historial ni deuda, con N.º de socio tipeado.

**G.2 Pruebas (resultados reales de la entrega V26.9).** Demo: `g1` 89, `g2` 98, `g3` 45, `h1` 35, `h3` 43 verificaciones; regresión previa `v1`–`v8`, `d1`, `p1`, `ws1` (73) sin fallas; revisión de 320/360/768/1024/1440 px sin desbordes (`resp4`). SQL: `supabase/tests/run.sh` **476/476**. Corrección de regresión encontrada por la propia suite: el comprobante de traspaso llevaba créditos viejos (detectado por `v8`).

**G.3 Límites declarados (no afirmar lo contrario).**
1. **Nube de extremo a extremo sin probar en esta entrega:** el banco de dos equipos contra un servidor equivalente (`c1`…`c20`, `p2`, `a1`, `s1`) se perdió y no se pudo correr; lo cubierto en la nube es sólo la suite SQL (476/476). Antes de dar por cerrada la nube hay que reconstruirlo y correrlo.
2. El expediente lee los eventos del servidor (`auditoria_eventos`) pero esa consulta **no se probó contra un Supabase real**; la IP sólo la agrega el servidor y sólo la ve el administrador. No hay expediente de compras ni de movimientos de stock.
3. El servidor no puede probar que el PIN o la clave del autorizante se tecleó; registra método y administrador. La verificación del autorizante por clave en la nube exige conexión. La numeración local del comprobante es provisoria hasta sincronizar.
4. El detalle del cobro viene **apagado por defecto** (`pay.detail.on`; la especificación pedía encendido): el dueño lo activa en Configuración, y desde ese momento (`detail.since`) cuenta los cobros sin detalle. Una excepción sólo relaja los campos relajables; N.º de operación, autorización e ID de transacción nunca.
5. El detector de número de tarjeta puede dar falso positivo con un identificador numérico de 16 dígitos que empiece en 2–6 y cumpla Luhn (muy raro).
6. Un único administrador puede autorizar su propio traspaso sólo si `xfer.selfAuth` está encendido (decisión explícita y auditada).
7. Hardware, NFC, impresoras y balanzas reales siguen sin probarse. Cobros reales por Mercado Pago/MODO no están integrados.

**G.4 Estado de publicación (2026-10-20).** Publicados: cliente `AlmacenRAVE` y demo `raveV2`. **Migración 11 aplicada en producción el 2026-10-20 con permiso expreso del dueño** (contenido idéntico al del repositorio: SHA-256 comprobado antes de ejecutar; resultado «Success»). Verificado por consulta: las 4 tablas nuevas (`traspasos`, `traspaso_eventos`, `cobro_detalles`, `auditoria_eventos`) con RLS activa, 4 políticas, las 5 funciones presentes y las 4 internas (`rave_tiene_permiso`, `rave_verificar_cadena`, `rave_parece_pan`, `rave_json_tiene_pan`) **no** ejecutables por `anon`. **No se probó todavía un alta real de traspaso o cobro sincronizando dos equipos contra producción** (ver G.3.1).

**G.5 Lección nueva (obligatoria).** Un chip o botón con `data-m` dentro del **cuerpo** de un modal confirmaba el modal (cobraba la venta al elegir el medio de pago). Corregido en el núcleo: sólo los botones del pie (`.mf [data-m]`) confirman o cierran; en el cuerpo se usa `data-pm`. Y: todo texto de créditos sale de `VB` (una sola fuente); `v8` falla si aparece un crédito viejo, incluso dentro de un `<script>`.

---

## ANEXO H — AS-BUILT DE 4.25 Y 4.26 (V26.10, 2026-10-20)

**H.1 Qué se construyó:** tarjeta del Club portátil (PNG con QR, espejo IndexedDB, enlace `#tarjeta=`, pedido por WhatsApp, enlace de administrador) y menú público opcional «Tienda con envíos» con zonas por provincia. Partes nuevas `p6d-cardportable.js` y `p5b-store.js` (registradas en `build.py`), ajustes en `p2-core.js`, `p5-menu-boot.js`, `p6-loyalty.js`, `p9-cloud.js`, `pub/*`, `build/pub_body.html`. **Sin migraciones SQL nuevas.**
**H.2 Pruebas (demo):** `k1` 29/29, `k2` 37/37; regresión completa verde: `v1`–`v8`, `d1`, `p1` 47, `ws1` 73, `h1` 35, `g1` 89, `g2` 98, `g3` 45, `h3` 43, `resp4` 36.
**H.3 Límites:** los de 4.25.4 y 4.26.4. Wallet real, pagos y transportistas no están integrados; la nube de extremo a extremo sigue sin probarse (G.3.1).
**H.4 Qué debe hacer el dueño:** (1) en *Menú público → Tipo de menú público* elegir modo, cargar zonas, **Guardar borrador y Publicar**; (2) a los clientes con tarjeta perdida, enviarles el enlace desde su ficha; (3) los clientes nuevos ven «Guardar mi tarjeta» al asociarse.

---

## ANEXO I — AS-BUILT DE 4.27 (V26.11, 2026-10-21)

**I.1** Parte nueva `p3i-rubcash.js` (en `build.py`); cambios en `p3-ops.js`. Sin migraciones SQL. **I.2 Pruebas (demo):** `k3` 26/26; regresión `v1`–`v8`, `d1`, `p1`, `ws1`, `h1`, `g1`–`g3`, `h3`, `k1`, `k2`, `resp4` verde. **Lección:** `k2` falla de noche porque el alcohol se oculta fuera de horario: las pruebas con alcohol usan reloj fijo (`page.clock`).

---
## ANEXO J — ENMIENDAS Y AS-BUILT V26.12–V26.13 (2026-10-21; evidencia reproducible)

**J.1 Auditoría de mayorista, proveedores, cajas y trazabilidad: qué se corrigió.**
1. **Cobro mayorista por tramos (enmienda a 4.22.1 · 1.2-bis y 1.3).** Una cantidad mixta ya no se cobra toda al precio por unidad de la presentación alcanzada. Se parte en **tramos**: las presentaciones **completas** (1 Fardo, 2 Displays…) se cobran **al precio de la presentación** y el **resto suelto** al precio de la unidad (o de la presentación menor que corresponda). Cada tramo queda como un renglón propio del ticket con su regla (`P-<presentación>` / `L1`), y **cada renglón guardado cumple cantidad × precio = importe**. Con `wholesale.on` apagada o canal minorista nada cambia. (`p6b-wholesale.js`: `wsSplit`, `lnAmt`; prueba `ws1` 78/78.)
2. **Traspasos en el perfil sin rubros (enmienda a 4.23.1/4.14).** Un comercio mayorista (un solo dueño, sin rubros, varias cajas y **una caja principal**) puede traspasar fondos sin elegir rubro: el movimiento usa un concepto interno **oculto** «Traspaso interno» (`sys-traspaso`). Es una opción **apagada por defecto**; los comercios con rubros (Almacén RAVE) siguen exigiendo rubro (6.10). Las cajas siguen con comprobante, autorizante, estados abierta/cerrada y fondo en tránsito. (`p3f-transfers.js`; `x1` 8/8.)
3. **Pago a proveedor repartido entre varias cajas (enmienda a 4.21).** Un pago en efectivo puede salir de varias cajas abiertas: un solo evento «Pago» en el libro del proveedor con sus **asignaciones** (caja, importe, movimiento de caja), un egreso por caja, suma exacta al centavo, **todo o nada**; sin rubros usa el concepto interno «Pago a proveedores». Servidor: migración **`12-pago-proveedor-cajas.sql`** (tabla `pagos_proveedor_asignaciones` sólo-agregar y `proveedor_pago_registrar` ampliada). En la nube la opción «Repartir entre cajas» **sólo se ofrece si el servidor tiene la migración 12** (se detecta con una consulta a la tabla; si falta, no se muestra). (`p4c-compras.js`, `p4d-compras-ui.js`; `x2` 11/11, SQL 491/491.)
4. **Trazabilidad entre cajas:** cada pago repartido deja el detalle por caja en el libro del proveedor y un movimiento de caja por turno con el nombre del proveedor y la referencia; el traspaso conserva su comprobante y su cadena de eventos; todo con auditoría.
5. **Reglas propias de Almacén RAVE (4.27: cierre por rubro, impuesto de $ 30.000 por socio, ganancia a partes iguales)** **sólo operan sobre los rubros marcados «reparte»** (Configuración → Rubros). Un comercio sin rubros que reparten no ve liquidación de socios ni heredan ningún impuesto por defecto: **el aislamiento es por datos, no por código**, y se comprobó en la demo (`k3`, `x1`). Almacén RAVE conserva todo sin cambios.

**J.2 Tiendanube (4.28).** Migración **`13-tiendanube.sql`** (5 tablas, 6 funciones de usuario, 2 de servicio, SQL **524/524**), función `supabase/functions/tiendanube/` (**21 pruebas** contra un Tiendanube **falso**), bundle `supabase/despliegue-panel/tiendanube-index.ts`, parte `p9c-tiendanube.js` (pantalla real y simulada + pasos de conexión de todas las integraciones). `INSTALAR-TODO.sql` = 01–13, aplicado dos veces a una base nueva sin errores.

**J.3 Resultados reales de esta entrega.** Demo (Chromium real): `v1` 19 · `v2` 24 · `v3` 41 · `v4` 61 · `v5` 15 · `v6` 6 · `v7` 33 · `v8` 25 (variante cliente) · `d1` 11 · `p1` 47 · `ws1` 78 · `h1` 35 · `g1` 89 · `g2` 98 · `g3` 45 · `h3` 43 · `k1` 29 · `k2` 37 · `k3` 26 · `x1` 8 · `x2` 11 · `resp4` 36 · `tn1` 50 (Tiendanube simulado, 1280 y 360 px) · `tn2` 14 (Tiendanube en modo real con la API de la nube simulada por el navegador): **todas sin fallas**. SQL (Postgres 16 real): **524 OK / 0 FALLAN**. Función: **21/21**.

**J.4 Límites declarados (no afirmar más que esto).**
1. **Tiendanube real no se probó.** Falta la aplicación del Portal de Socios (ID y secreto) y una tienda de prueba. Los endpoints, cabeceras, permisos y el formato de la firma del webhook son `[VERIFICAR]` contra la documentación vigente. La conexión se declara «sin conexión real» hasta homologarla.
2. **Las migraciones 12 y 13 y la función `tiendanube` están en el repositorio, probadas en una base local, pero NO aplicadas en la producción de Supabase** (se aplican sólo con permiso expreso del dueño, probando antes en una rama). Mientras no se apliquen: el pago repartido entre cajas está oculto en la nube y la tarjeta de Tiendanube dice que la función no está instalada.
3. **El banco de pruebas de la nube con dos equipos reales** (`c1`…`c20`, `p2`, `a1`, `s1`) **no se reconstruyó en esta entrega**: la cobertura de la nube en esta versión es SQL 524/524 + función 21/21 + `tn2`. Reconstruirlo y correrlo es el primer paso antes de aplicar 12 y 13 en producción.
4. El pago de Tiendanube se registra como «transferencia» ya cobrada por la tienda; no hay conciliación con el medio real (Mercado Pago, tarjeta) ni envíos, devoluciones o cupones sincronizados.
5. Sin cambios respecto de los límites del anexo C, G.3 y H (hardware, NFC, Wallet, ARCA en producción, multisucursal en servidor).


FIN DE SISTEMA VB 26F (revisión V26.14)
