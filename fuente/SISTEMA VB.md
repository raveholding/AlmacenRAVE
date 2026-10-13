# SISTEMA VB — PROMPT MAESTRO (ESQUELETO ADAPTABLE)

Versión 2.3 · ERP/POS multicomercio (web/PWA, nube y Windows) · Se adapta a comercio, gastronomía, servicios, profesionales y ONG.

---

## 0. CÓMO USAR ESTE DOCUMENTO

1. Copiá este documento completo y pegalo como prompt maestro (o como instrucciones de un proyecto). No lo resumas.
2. Completá la **Ficha del negocio (sección 1)**. Todo lo que está entre `[CORCHETES]` es una variable: se reemplaza por el dato real del cliente. Un dato que no se tiene se deja como `[PENDIENTE]`: nunca se inventa.
3. Elegí el **rubro** y prendé/apagá módulos con la **matriz de adaptación (sección 11)**. Lo específico de un negocio vive en configuración, módulos o adaptadores; el núcleo no se toca.
4. Antes de ejecutar cambios en un repositorio, inspeccioná el código real y seguí las reglas de trabajo (sección 2), de pruebas (sección 13) y de entrega (sección 15).
5. Las funciones que se describen acá son **requisitos de implementación**: no se consideran hechas por estar descritas. Se declaran hechas sólo con evidencia de prueba.
6. Nada de este documento contiene datos personales ni comerciales de un cliente en particular. Los datos de ejemplo que se carguen en una demo se rotulan "ejemplo" y se reemplazan por los reales.

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
| Menú público: frases comerciales, leyendas legales, idiomas, enlace de mapa/reseñas, Wi-Fi de invitados, ¿alta al Club desde el menú?, gesto del acceso oculto | `[…]` |
| Catálogo | Excel/CSV: nombre, rubro, presentación, precio, costo, stock, unidad (und/kg/lt), código de barras + fotos |
| Sistema anterior | `[NOMBRE]` y qué datos se pueden exportar |
| Equipo | nombre, correo y rol: admin / supervisor / mostrador / operador |
| Cajas, sucursales, ¿una persona o varias por caja?, ¿socios que se reparten el día? | `[…]` |
| Periféricos: impresora térmica/A4/etiquetas, lector de códigos, balanza, cajón, pantalla de cliente, lector NFC/huellas | `[MARCAS Y MODELOS]` |
| ¿Fichaje NFC/biométrico? ¿Wi-Fi de clientes? | `[SÍ/NO]` |
| ¿Se vende sin stock (stock negativo)? | `[SÍ/NO]` (por defecto SÍ, con interruptor) |
| ¿Lectura de facturas de proveedores con IA en la nube? | `[SÍ/NO]` (cuesta por uso) |
| Modalidad | Solo menú QR / Sistema completo con nube / + instalador Windows |
| Desarrollador (créditos obligatorios) | `[DESARROLLADOR]` · `[WHATSAPP_DEV]` · `[CORREO_DEV]` |

---

## 2. ROL Y REGLAS DE TRABAJO (obligatorias)

Actuá como un equipo senior: arquitecto de software, desarrollador full-stack, diseñador UI/UX, especialista en ciberseguridad (OWASP Top 10, ASVS, MASVS), desarrollador móvil, integrador de hardware POS, SEO técnico y cumplimiento legal del país y provincia del cliente.

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
11. **Créditos.** Los usuarios públicos tienen que saber quién desarrolló el sistema: `[DESARROLLADOR]` (`[WHATSAPP_DEV]` · `[CORREO_DEV]`) en ingreso, asistente, barra lateral, tickets, pantalla del cliente, menú, páginas de producto e instalador. Se puede cambiar la presentación (completa, corta, ícono), no eliminar.
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
- **Configuración:** datos del comercio, rubro, horarios, interruptores, atajos, modelo de cajas.
- **Módulos:** ventas/POS, costos y precios, descuentos/cupones/membresías, facturación, inventario por rubros, bultos, insumos/recetas, cajas y finanzas con rubro obligatorio, compras/IA, gastos, clientes/fiados, fidelización, personal/fichaje, menú público y su administración, reportes/Analytics, comisiones, importar/exportar, correo, WhatsApp, marketing/redes, cobros online, Google Drive/APIs, Meta Pixel, legal.
- **Hardware (HAL):** `DeviceManager` con drivers intercambiables por tipo (`printer_thermal`, `printer_a4`, `printer_label`, `scale`, `scanner`, `nfc_reader`, `fingerprint_reader`, `cash_drawer`, `display`).
- **Adaptadores por rubro:** comercio, gastronomía, servicios, profesional, ONG.

**Orden del panel (navegación):** Resumen (Dashboard Analytics, **primera pantalla, antes de Vender**) → Operación (Vender, Pedidos, Caja, Arqueo/cierre, Cajas cerradas, Inventario) → Clientes y fidelización (Clientes, Fidelización, Cupones y membresías) → Equipo (Personal y fichaje, Tareas) → Menú y web (Menú público, Legal y cumplimiento) → Sistema (Periféricos y ticket, Importar/Exportar, Integraciones, Roles, Auditoría, Configuración).

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
- **Documento:** Sin factura fiscal → Ticket interno, Remito o Presupuesto, numeración propia por caja ("2-15" = ticket 15 de la caja 2), leyenda "DOCUMENTO NO VÁLIDO COMO FACTURA" (nunca "Factura"). Con factura → A/B/C y notas de crédito/débito, validación de condición fiscal del cliente; el **CAE se pide solo al servidor fiscal (ver 4.12)** y, mientras la integración no esté habilitada y probada, queda "pendiente de CAE" y se carga a mano; con CAE es inmutable (se corrige con nota). El interruptor tiene texto y color distintos, el documento resultante es visible antes de confirmar, el valor por defecto es configurable por sucursal y rol, y cambiarlo pide motivo y queda auditado. Los presupuestos no suman como venta.
- Los totales se recalculan siempre en el sistema (servidor): nunca se confía en el precio que llega de afuera. Se muestra el cálculo completo antes de confirmar.
- **Modo táctil/POS:** áreas de 48×48 px con 8 px de separación, teclado numérico en pantalla, gestos; nada depende sólo del hover o del clic derecho. Kiosco a pantalla completa con PIN de supervisor, cierre por inactividad y pantalla de cliente secundaria.
- **Campos numéricos (regla de todo el sistema):** nunca arrancan con "0" cargado; vacíos con placeholder; si traen valor, al entrar quedan seleccionados. Teclado en pantalla: teclas ≥ 56 px, el primer dígito reemplaza el valor, vacío muestra "Escribí el número", botones "Borrar todo / Cancelar / Listo".
- Los campos `type=number` se leen con `valueAsNumber`; los textos con el parser local (coma decimal); fechas con año de 4 cifras primero.

### 4.3 Descuentos, cupones, membresías y beneficios
- **Regla de oro:** un beneficio por compra. Cupón **o** membresía (se aplica el mejor, nunca acumulados), mayorista, descuento manual y promociones de tarjeta tampoco se acumulan salvo configuración expresa visible antes de cobrar.
- Los productos de venta restringida por edad (p. ej. tabaco) **no participan** de promociones ni descuentos.
- Cupón: código único por tenant, estado, vigencia, porcentaje o monto fijo, compra mínima, tope, límite total y por cliente, audiencia (todos / socios / cumpleaños), exclusiones. El servidor valida y consume de forma atómica e idempotente; devolver/anular libera el uso.
- El descuento se **reparte por línea** (método del mayor resto, centavos enteros); el ticket conserva base, cupón, descuento, regla y precio final.
- Membresías/suscripciones: plan (nombre, precio, periodicidad, beneficio), consentimiento versionado, cancelación sin obstáculos; no se marca activa hasta confirmar el pago.

### 4.4 Inventario por rubros
- **Rubros diferenciados y visibles:** pestañas de rubros con **color propio** y contador; vista agrupada por rubro con encabezado de color (cantidad, alcohol, +18, fuera del menú); chip de rubro en cada fila; filtros por rubro, texto (nombre, presentación, código) y "sólo stock bajo/negativo"; productos sin rubro se muestran aparte.
- **Alta y edición de rubros** (rol autorizado): nombre único, color (paleta + validación `#RRGGBB` estricta antes de usarlo en estilos), responsable opcional, diseño en el menú (grilla / filas / por bodega), nombre en el menú, interruptores "mostrar en el menú", "vende alcohol" y "sólo +18 (sin promociones)". Un rubro con operaciones no se borra: se edita o desactiva. **ABM completo y siempre visible (v2.3):** en Configuración → "Rubros, responsables y reparto" cada rubro es una tarjeta que **se acomoda (flex-wrap) y nunca recorta** sus controles: encabezado con nombre + botones **Editar** y **Eliminar** (≥44 px, con `aria-label`), y debajo responsable, "reparte" e impuesto diario. Eliminar: sin productos ni historial → se borra; con productos → pide el rubro de destino (nunca quedan productos huérfanos); con ventas/movimientos → se **archiva** (el historial y los reportes se conservan). Todo con auditoría y sincronizado (borrado lógico). **Prueba obligatoria:** los botones deben verse completos a 1600/1280/768/360 px **con "reparte" tildado** (el campo de impuesto agranda la fila), y editar/alta/baja vacía/baja con productos deben funcionar y llegar al servidor.
- **Unidades:** `und`, `kg`, `lt` (internamente `u`, `kg`, `l`). Etiquetas coherentes en edición, Vender, ajustes, exportación e importación (la importación acepta und/lt/litro/litros). Stock en unidad base común; conversión atómica para bultos/packs.
- Producto: nombre, presentación, grupo/bodega, rubro, unidad, costo, tipo de cálculo (recargo sobre costo o margen sobre precio, nunca mezclados), precio final, stock (puede ser negativo si se vende sin stock), código de barras único, PLU de balanza, descripción, nombre en inglés, "Publicar en menú digital" (apagado por defecto), activo, "Exigir stock". Margen se muestra sólo con costo cargado ("—" si el costo es cero). No se borran productos con historial: se desactivan.
- Ajuste rápido con motivo obligatorio; movimientos de stock auditados; stock mínimo/máximo con alertas; depósitos/sucursales como extensión opcional.
- La API pública nunca expone costo, stock exacto, proveedor ni márgenes.

### 4.5 Caja y cierres
- Apertura, movimientos (ingresos, egresos, retiros, reintegros), cierre con arqueo; cada equipo tiene su caja. **Todo movimiento financiero lleva un rubro válido obligatorio** (sección 6.10).
- Al cerrar se guarda una foto inmutable: medios de pago, fiscal vs. interno, egresos y retiros, esperado vs. declarado, usuario y hora, observaciones y sello SHA-256; en la nube el cierre queda congelado (sólo se agregan notas).
- Pantalla "Cajas cerradas": lista y calendario, filtros, alertas de días sin cierre, ficha imprimible (A4) con verificación de integridad, CSV.
- Importes en centavos enteros o `DECIMAL(14,2)`, nunca float. Fechas en UTC y visualización en `[ZONA_HORARIA]`.
- Modelo flexible de cajas (una caja/una persona, varias personas, varias cajas, por sucursal/turno/responsable/socio). Reparto entre socios, sueldos y reporte de cierre para WhatsApp son un **módulo opcional apagado por defecto** (sección 5.9); sin socios configurados el reporte no muestra secciones vacías ni "()" huérfanos.

### 4.6 Clientes, Club y fidelización
- **Clientes:** consentimientos separados por finalidad (atención/club, comunicaciones comerciales, analítica/publicidad) con versión, fecha y origen; sin consentimiento comercial el cliente queda fuera de campañas; WhatsApp y correo cifrados; duplicados por los últimos 10 dígitos del WhatsApp; fiados (límite de crédito sólo modificable por rol autorizado, antigüedad, alertas); baja que anonimiza y conserva el historial contable.
- **Alta al Club desde el menú público** (nombre y apellido, WhatsApp, fecha de nacimiento): reutiliza el módulo de clientes (no crea una base paralela); fecha de nacimiento con su propio validador (un cumpleaños anterior al 2000 es válido); menores de 18 no se dan de alta con beneficios ni comunicaciones; respuesta genérica ante duplicados (nunca confirma si un número ya existe); límites por dispositivo/IP/hora; idempotencia (doble toque = un cliente); sin conexión o con error el mensaje es honesto, nunca un alta "exitosa" sin confirmación.
- **Tarjeta de sellos:** libro mayor (los sellos no se editan, se corrigen con un movimiento compensatorio auditado); meta configurable; 1 sello por día por socio; código de 8 dígitos (N.º de socio + código de 4 dígitos que cambia cada 2 minutos) o QR firmado, de **un solo uso**; el cliente consulta su tarjeta digital en el menú (recuperación con dos factores: WhatsApp + fecha de nacimiento); canje de premio auditado y reversión al anular la venta. El alta al Club no regala sellos.
- **Tarjeta modelo del negocio (en Fidelización):** vista previa de frente y dorso a tamaño tarjeta (85,6 × 54 mm) con logo, nombre, sellos de ejemplo configurables, premio, dirección, WhatsApp y red social del comercio; el dorso lleva un QR al menú; impresión "con ejemplo" y "en blanco" lista para imprimir/cortar. Los datos salen de la configuración, nunca fijos en el código.

### 4.7 Personal
Empleados con documento cifrado, tarjeta NFC/QR firmada, terminal de fichaje (Web NFC en Android/Chrome, lector USB o tecleado); rechaza firmas falsas y repetidos en 60 s; registro con fecha y hora del servidor, dispositivo y método; planillas de horas. Lector de huellas sólo vía HAL, con revisión legal previa (sección 6.7).

### 4.8 Compras y gastos con IA (sólo admin)
Subir o fotografiar facturas/remitos (JPG, PNG, PDF); lectura en cascada: QR fiscal → IA en la nube (opcional) → texto del PDF/OCR local → parser local; extrae proveedor (nombre y ID fiscal con dígito verificador), tipo y número, fechas, renglones, neto, impuestos y total; sugiere categoría. **Revisión humana obligatoria** (imagen + formulario, controles de importes, duplicados, fechas) antes de guardar. Adjunto cifrado. Tablero por categoría y proveedor, compras vs. ventas, alertas de variación de costos, notas de crédito que restan. La IA trata el contenido del documento como **dato, nunca instrucción**; salida con esquema JSON estricto; sin herramientas ni acceso a datos del comercio; tope diario.

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

---

## 5. MÓDULOS OPCIONALES (aditivos, auditables, apagados por defecto si dependen de terceros)

Reglas comunes: banderas por comercio/sucursal/rol/dispositivo; migraciones SQL aditivas, versionadas e idempotentes probadas sobre copia; `tenant_id`, RLS y pruebas cruzadas A/B en toda entidad; servidor valida y recalcula; idempotencia; límites de uso; auditoría; dinero en centavos enteros; sin proveedor/credencial/dispositivo → estado "Pendiente de configuración" y el resto sigue funcionando; ninguna integración se declara terminada por tener una pantalla simulada.

- **5.1 Costos, porcentajes y precios:** recargo (precio = costo × (1 + p/100); costo 100 + 30 % = 130) y margen bruto (precio = costo / (1 − p/100); costo 100 + 30 % = 142,86); rechazar margen < 0 o ≥ 100; recalcular en vivo; cambio manual pide confirmación; historial; roles autorizados ven costo.
- **5.2 Mayorista, bultos y descuentos:** unidad base, unidades por bulto, venta suelta/bulto cerrado/ambas, tramos sin solapar, descuento % (10 = 10 %), stock siempre en unidad base (2 bultos de 6 = 12), mostrar "Minorista / Mayorista / Bulto cerrado" y el motivo; histórico congela la regla aplicada.
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
- Datos personales clasificados (pública / interna / confidencial / sensible / crítica), mínima información necesaria; registro de bases y plazos de conservación `[VERIFICAR con asesor legal]`.
- Seguridad de la IA: contenido de documentos como dato, esquema JSON estricto, sin herramientas, revisión humana, tope diario, sin exponer el prompt interno.
- Agente local (cuando exista) sólo en 127.0.0.1, con emparejamiento de un solo uso, orígenes en lista blanca, mensajes firmados y actualizaciones firmadas.
- **Incrustaciones:** si un documento se inserta como cadena en un `<script>` (por ejemplo un menú dentro de `<iframe srcdoc>`), escapar `</script`, `<script` y `<!--` en la cadena; un `</script>` literal dentro de un string JavaScript corta el bloque y el sistema no arranca.

### 6.3 Decisiones de arquitectura (no se reabren sin motivo)
El pedido por WhatsApp del menú es una **solicitud**, no una venta (el POS recalcula). Modelo de movimientos (suma conmutativa) para stock y caja; sin bloqueos que rompan el trabajo sin conexión. CSP con SRI en lugar de nonces (HTML estático). PWA primero; tiendas de apps como etapa posterior. Las rutas de producto ya publicadas se conservan y el slug es un alias.

### 6.11 Nube: arquitectura de referencia (Supabase) y puesta en marcha
**Piezas:** (1) *Auth* por correo y contraseña con "Confirm email" **desactivado** (si no, el alta queda trabada); (2) *Postgres* con RLS; (3) *PostgREST* (RPC); (4) *Edge Functions* para lo que no puede correr en el navegador (CAE fiscal, lectura de facturas con IA); (5) *Storage* privado para comprobantes. Ninguna función de servidor recibe permisos por el sólo hecho de existir: cada una valida el JWT del usuario y su rol en el comercio.

**Configuración en el código:** dos constantes (`CLOUD_URL`, `CLOUD_KEY`) que reemplaza el ensamblado; vacías = nube apagada. La clave `service_role` y cualquier `sb_secret_…` **no se usan ni se escriben** en el HTML; si aparecen en algún repositorio público se reporta y se recomienda rotarlas.

**Pantalla Administración → Nube:** estado (sin configurar · desconectado · sincronizado · sin conexión con N pendientes · error), crear comercio (primer equipo), entrar con correo y contraseña (equipos nuevos), número de caja del equipo, miembros y roles (alta por correo, quitar acceso corta todos los equipos), "Sincronizar ahora", rechazos del servidor con motivo, código de recuperación (se muestra **una sola vez** al crear el comercio y no se cierra sin confirmar que se guardó; se puede regenerar), cerrar sesión.

**Datos:** tabla genérica `registros (comercio_id, coleccion, id, datos jsonb, borrado, actualizado)`; lectura RLS sólo miembros; escritura sólo por `sincronizar()`. Colecciones cerradas (productos, ventas, sesiones/cajas, movimientos de caja, movimientos de stock, clientes, cuenta corriente, empleados, fichadas, tareas, cupones, planes, membresías, fidelización, configuración, auditoría, y las del módulo vigente). Reglas del servidor: roles (mostrador/operador no editan productos, gastos, personal ni configuración); **auditoría, movimientos y fichadas se escriben una vez**; **una caja cerrada no se modifica** (sólo notas del administrador); campos de seguridad de la configuración (certificados, claves) **se descartan**; tope de tamaño por registro y de cantidad por envío; nombres de colección con lista blanca y formato validado.

**Stock multi-equipo:** el navegador **no envía el stock**: envía *movimientos* (`delta` con motivo). El servidor suma los movimientos en una sola transacción sobre el producto (con bloqueo de fila), de modo que dos cajas que venden la misma botella restan las dos y el total cierra, incluso con stock negativo permitido. El stock que se ve en cada equipo = stock del servidor + movimientos propios aún no subidos. Un producto nuevo sube con stock 0 y un movimiento "saldo inicial".

**Cifrado:** llave de datos (DEK, AES-256-GCM) por comercio, generada en el primer equipo; cada miembro la guarda envuelta con una llave derivada de su contraseña (PBKDF2-SHA256 ≥ 200.000) y una copia envuelta con el código de recuperación. Los datos personales (WhatsApp, correo, DNI, nacimiento) se cifran **antes de subir** y la base local se guarda cifrada en IndexedDB; el servidor no puede leerlos. Cambiar la contraseña re-envuelve la llave; un miembro nuevo recibe la llave de un administrador (clave temporal que debe cambiar al entrar). Sin contraseña ni código de recuperación los datos cifrados **no se pueden recuperar (por diseño)**.

**Sin conexión:** se puede ingresar con correo y contraseña contra la llave envuelta guardada en el equipo en el último acceso; todo cambio se encola y se reconcilia al volver Internet; nunca se muestra como sincronizado lo que no confirmó el servidor. **Cajas y numeración:** cada equipo tiene su caja y su numeración ("2-15"); número de caja único por comercio. **Límite conocido:** dos ediciones simultáneas del mismo registro se resuelven con la última guardada (mejora opcional: versionado optimista en precios y permisos).

**Cliente de nube (as-built, v2.2):** ingreso con Auth por correo y contraseña (REST; la clave publicable va en `apikey`, el JWT del usuario en `Authorization`); llave de datos (DEK) envuelta con la contraseña (PBKDF2-SHA256 200.000) y copia con código de recuperación (20 caracteres, sólo admin); estado local cifrado en IndexedDB (nombre de base propio por cliente: GitHub Pages comparte origen entre repositorios); sincronización cada 15 s y 1,5 s después de guardar, diferencias por huella, lotes de 150, stock como movimientos, rechazos del servidor visibles, cierre de sesión por inactividad (30 min) y al quitar un miembro. Los datos personales de clientes y empleados viajan cifrados (`__pii`). Alta al Club desde el menú público: cifrada en el navegador con la llave pública del comercio (RSA-OAEP + AES-GCM); el equipo la descifra, deduplica por los últimos 10 dígitos del WhatsApp e importa como cliente (se importa sola cada minuto con la sesión abierta). Menú público: instantánea publicada (`menu_publico(slug)`) sin costo ni stock exacto; sin sesión no se ve nada del club ni de las tarjetas. **Compilación:** `build.py cliente` con `SUPABASE_URL`, `SUPABASE_KEY` (rechaza `service_role`/`sb_secret_`), `RAVE_SLUG` (igual al *slug* del comercio) y `PUBLIC_URL`; sin URL/clave el ingreso dice "Pendiente de configuración". **Límites conocidos:** recargar la página sin internet requiere el HTML en caché (no hay service worker); fotos propias de productos necesitan Storage (fase 2); el último uso de un cupón no es atómico entre equipos; un empleado que olvida su clave se quita y se vuelve a invitar; los reintentos de ARCA corren sólo mientras algún equipo tenga el sistema abierto (sin tarea programada).

**Puesta en marcha (en orden):** 1) opcional y **destructivo**, sólo con respaldo y orden expresa del dueño: script de limpieza de un proyecto anterior; 2) scripts base en orden (base → sincronización → recuperación/soporte → menú público → fiscal), pegando el contenido real en el editor SQL; 3) desactivar "Confirm email"; 4) cargar los secretos de las funciones por el canal seguro del proveedor (nunca por chat ni por correo); 5) publicar el archivo con URL + clave publicable; 6) crear el comercio desde el primer equipo y guardar el código de recuperación; 7) agregar equipos y miembros. Pruebas: ver sección 13, ítem 16.

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
8. **Club, cupones y tarjeta de fidelización** públicos (ver 4.3 y 4.6), membresías y cupones visibles con su condición.
9. **Wi-Fi temporal de invitados** (red aislada de la del POS; QR de conexión; clave fija, rotación manual o automática sólo si el equipo lo permite; vigencia; cambios auditados; cartel legal `[VERIFICAR]`).
10. **Redes sociales — lista editable con lugar para agregar más:** cada red con interruptor "Mostrar", tipo (Instagram, Facebook, TikTok, X, YouTube, WhatsApp, LinkedIn, Telegram, Threads, Spotify, sitio web, otra), nombre, usuario y enlace; validación https, sin espacios y **coherencia de dominio con la red elegida**; para mostrarla debe tener enlace; íconos SVG en línea (genérico si falta); X y YouTube vienen precargadas **como ejemplo y apagadas**; sin widgets de terceros (los enlaces no cargan scripts).
11. **Información legal** (privacidad y consentimientos, precios y entregas, botón de arrepentimiento y defensa del consumidor, venta restringida por edad, Wi-Fi) y botón de arrepentimiento que abre el canal configurado y queda registrado.
12. **Créditos del desarrollador** en menú, páginas de producto y PWA, con mensaje prellenado que identifica al comercio.
13. **Administración:** secciones (identidad, frases y leyendas, idiomas, bloques y orden, Club, Wi-Fi, ubicación y reseñas, redes, compartir y QR, acceso oculto, SEO/Open Graph, créditos y legales, vista previa y publicación); **borrador y publicación** con versión, usuario, fecha y hash; comparar y **revertir** a la versión anterior; el menú se actualiza sin recargar; sólo admin o rol autorizado (validado en servidor); validaciones al guardar; importar/exportar la configuración con diferencias, modo prueba y reversión.
14. **SEO y rendimiento:** páginas por producto con Open Graph y JSON-LD (sólo con datos existentes), sitemap, PWA instalable, imágenes con `srcset` y carga diferida, accesibilidad AA (teclado, foco atrapado en modales, textos alternativos), 320/360 px sin desbordes.
15. **Dependencias de terceros** (siempre decirlas al cliente): reseñas (API y cuotas), mapa embebido (consentimiento y CSP), rotación automática de Wi-Fi (equipo de red), textos legales, traducciones, widgets de redes.

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
| **Comercio / almacén / licorería / kiosco** | POS minorista/mayorista, bultos, balanza, stock, rubros con color, venta sin stock (opción), fidelización, cupones, menú QR | producto, rubro, bulto | Control de edad y horario sólo si hay venta restringida |
| **Gastronomía (bar, restaurante, café)** | Mesas, comandas por sector (cocina/barra), recetas e insumos, agregados, mozos y comisiones, menú QR como carta | plato, mesa, comanda, mozo | Mayorista apagado; venta sin stock apagada para insumos críticos |
| **Servicios (taller, estética, peluquería)** | Órdenes de trabajo Kanban, técnicos/profesionales, comisiones o alquiler de sillas/gabinetes, agenda de turnos, sellos de fidelización | orden, servicio, profesional | Stock y balanza apagados; "Exigir stock" en repuestos |
| **Profesionales (estudios, consultorios)** | Órdenes como expedientes/consultas, honorarios, compras y gastos, datos sensibles sólo cifrados | expediente, cliente/paciente, honorario | Menú público apagado si no aplica; sin Pixel ni publicidad |
| **ONG / clubes** | Catálogo = campañas/donaciones, clientes = socios con consentimiento, cuenta corriente = cuotas, membresías | socio, cuota, campaña | Sin control de edad ni alcohol |
| **Mayorista / distribuidor** | Bultos cerrados, tramos mayoristas, cuenta corriente con límites, listas de precios por grupo de clientes | cliente, bulto, lista | Menú público opcional con precios mayoristas habilitados |

Cada negocio define en la **ficha de particularidades (L)** lo que no es general, como módulo opcional apagado por defecto: rubros internos o secciones, socios y reparto, cierres a medida, reportes propios, impuestos fijos, empleados compartidos, formatos de mensajes. Para cada punto: qué se quiere, quién lo usa, qué datos entran, qué sale y si toca el cierre sellado.

---

## 12. DETECCIÓN DE LO EXISTENTE (antes de cada cambio)

1. Inspeccioná repositorio, esquema, pantallas, permisos y pruebas. Listá lo que ya existe y su estado.
2. Funciones duplicadas: fusionar. Incompletas: completar. Inexistentes: agregar como módulo con bandera.
3. Nombres únicos: las funciones de módulos distintos comparten el mismo ámbito en un HTML de un solo archivo; buscar duplicados antes de publicar (un `procesarCola` repetido dejó sin cola de impresión a una térmica).
4. Un módulo nuevo se agrega a la lista de ensamblado o no se arma.
5. Colecciones nuevas: actualizar sincronización, lectura, exportación, importación y respaldo.
6. Un estado persistido de una versión anterior no debe romper la nueva: los campos nuevos se leen con valores por defecto (`!== false`, `|| valor`), no se asumen presentes.

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
- **Lecciones v2.3:** (1) **un módulo opcional que falla jamás puede marcar la nube como caída**: las llamadas a funciones de servidor (`/functions/v1/…`, p. ej. ARCA no desplegada → sin CORS → error de red) no tocan el indicador de conexión (`fn:true`), y esos módulos no se consultan en cada sincronización si no hay nada que hacer (reintentos ARCA sólo si hay facturas pendientes de CAE); el indicador "Sin conexión" se reserva a fallas de la API principal; probar con la función caída. (2) **La variante del cliente nunca dice "demo"**: ni títulos, ni tarjetas ("Datos de la demo", "Empezar de cero"), ni etiquetas ("SIMULADO" → "Pendiente de configuración"), ni botones simulados (balanza); la demo conserva sus rótulos. Prueba obligatoria: recorrer **todas** las pantallas de la variante cliente y buscar `demo|simulad` en el texto visible. (3) **Cada compilación lleva fecha/hora y variante visibles** (Configuración: "versión del cliente · compilada AAAA-MM-DD HH:MM UTC") para distinguir de inmediato una copia vieja en caché del navegador; ante "no veo el cambio": Ctrl+F5 y comparar esa marca. (4) Las filas con controles variables (checkbox que agrega un campo) **no** pueden ser una línea flex sin `wrap`: los botones de acción terminan recortados por la tarjeta y el usuario cree que "no se puede editar". (5) Antes de decir "conectado", comprobar con una llamada real (`menu_publico`) y mirar los registros de la API del proveedor en vez de suponer. (6) El resultado de un script de instalación (SQL) se verifica leyendo las tablas creadas, no con "corrió sin errores".

---

## 15. PUBLICACIÓN Y ENTREGA

1. Catálogo y, si hay, migración del sistema anterior (importadores). 2. Personalización (logo, textos, colores, contacto, reglas de venta restringida, dirección corta). 3. Ensamblado (URL y clave publicable). 4. Pruebas automáticas en verde (sección 13). 5. Revisión de correcciones en una sola pasada y, si el riesgo lo justifica, revisión independiente de seguridad. 6. Publicación: hosting estático (por ejemplo GitHub Pages: rama principal, raíz) en un repositorio **distinto** de cualquier producción que ya exista salvo orden expresa; instalador y SQL aplicados en entorno de prueba antes de producción. 7. Prueba desde cero en el local (PC, celular como segunda caja, corte de internet, permisos, quitar un usuario, cargar una factura, cerrar caja, simular clave olvidada). 8. Capacitación del dueño (código de recuperación, respaldo, equipo, nube, NFC, lectura de facturas, redes y menú).

**Repositorios:** uno para la **demo** (datos de ejemplo, simulador fiscal, nube sin configurar) y uno por **cliente** (datos reales, sin simulador, nube configurada); nunca mezclar ni reutilizar el de otro cliente ni reemplazar un archivo que usa una tarea programada o un instalador. Los scripts SQL y las funciones viajan en el repositorio del cliente (carpeta `supabase/`).

**Lo que depende de terceros (decírselo siempre al cliente):** CAE real (certificado y servicio del organismo fiscal, alta del punto de venta, clave fiscal del titular); nube (proyecto del proveedor, scripts SQL ejecutados por quien tiene acceso, secretos de las funciones); IA en la nube (clave y costos); cobros online (cuenta, credenciales, webhooks, sandbox); Google (proyecto, consentimiento, scopes, verificación); Meta (permisos, políticas, consentimiento); tiendas de apps y firma de código (cuentas y certificados pagos); agente local y hardware real (etapa futura / sin probar); normativa (registro de bases, plazos, horarios de venta restringida, textos legales: asesor y fuente oficial); recuperación (sin contraseña ni código no hay datos).

**Definición de terminado:** todo publicado (web, instalador, SQL aplicado) · pruebas en verde y revisión independiente sin pendientes de seguridad · regresión · documentación (guía de nube, de Windows, prueba desde cero, arquitectura de compras/cajas, soporte, este prompt) · entrega honesta con límites.

**Formato de la entrega final (obligatorio):** módulos implementados; migraciones; suites de prueba y resultados; integraciones realmente configuradas; secretos que debe cargar el dueño por canal seguro; dependencias pagas; dispositivos probados (marca/modelo/versión/SO/driver) y pendientes de prueba física; límites conocidos y riesgos abiertos. Prohibido "100 % funcional", "sin errores" o "aprobado" sin evidencia.

---

## 16. CHECKLIST DE ADAPTACIÓN A UN NEGOCIO NUEVO (14 pasos)

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
14. Publicar (sección 15), capacitar al dueño y entregar el informe honesto.

---

FIN DE SISTEMA VB
