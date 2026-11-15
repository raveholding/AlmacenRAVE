# 4.34 · MOSTRADOR: BALANZA, ETIQUETAS PESABLES, PANTALLA DEL CLIENTE, FIADO / CUENTA CORRIENTE, CORTES X/Z, CAJÓN Y USO SIN INTERNET (V26.50 · propuesta)

> **Versión corregida del adjunto «arquitectura completa del POS y núcleo operativo local (6 módulos)».** Se escribió después de inspeccionar el código real (`AlmacenRAVE/fuente`, V26.48, 2026-11-04). El adjunto pedía «diseñar e implementar la arquitectura completa»; la inspección muestra que **la mayor parte ya existe** (periféricos, EAN-13 de balanza, ESC/POS, caja, arqueo, cola de sincronización). Esta sección pide **sólo lo que falta**, sobre lo existente, por fases y detrás de banderas. Rige la regla 2 de la sección 2 (contradicciones en 4.34.1).

> **Decisiones del dueño (2026-11-04) y estado V26.49 — prevalecen sobre el resto de esta sección:**
> 1. **Fiado / Cuenta corriente separados** (también en Almacén RAVE). Cuenta corriente de un cliente **sin plazo** = sin vencimiento fijo (como antes); no se le niega la CC. Cobros: a lo más viejo (como siempre) o primero al tipo elegido.
> 2. **Pantalla del cliente sin saldos** (apagado; los mensajes no llevan saldos).
> 3. **Balanzas Systel y Kretz con reconocimiento automático:** el navegador exige elegir el puerto UNA vez (no lo puede evitar ningún sistema web); después el sistema prueba solo 9600/4800/19200/2400 baudios y los protocolos envío continuo, Systel (pedido ENQ 0x05) y Kretz («P»+CR → «PE»/«PI» + peso), lo nombra, y se reconecta solo al abrir y al enchufar. Fuente de los protocolos: notas públicas de un instalador; **[VERIFICAR con el equipo real]**.
> 4. **Construido en V26.49:** H1 (balanza + etiquetas, con el defecto del prefijo de 2 cifras corregido), H2 (cajón ESC p y corte del papel), H3 (Fiado/CC), H4 (cortes X y Z), H5 (pantalla del cliente) y `17-fiado-cc-cortes.sql`. Pruebas: `bz1` 25/25, `ck1` 30/30, `xz1` 27/27 en las 4 variantes; `cs1` 13/13; SQL 553/553.
> 5. **Pendiente (no construido):** H6 service worker (abrir en frío sin internet), modo «Mostrador táctil grande» de 60 px en todo Vender (los botones nuevos de Fiado/CC ya miden 64 px), cierre ciego (F5) y perfiles por modelo más allá de Systel/Kretz/genérico.

**Estado:** ESPECIFICACIÓN. Con las banderas apagadas el sistema se comporta exactamente como V26.48. Hardware real: **sin probar** hasta tener marca y modelo exactos de cada equipo (balanza, impresora, cajón).

---

## 4.34.0 Matriz de detección (inspección del código real, 2026-11-04)

| Módulo del adjunto | Estado real | Dónde | Qué falta |
|---|---|---|---|
| 1 · Balanza por Web Serial 9600 8N1 | **Existe:** conexión serie (9600 por defecto; 8 bits, 1 stop y sin paridad son los valores por defecto de Web Serial), reconexión automática, balanza simulada, lectura «estable» = 3 muestras iguales + bandera de estabilidad | `p7-devices.js` (`devSerialModal`, `scaleListen`, `parseScale`, `scaleRead`, `A.pesar`) | Estabilidad **por tiempo** (≥ 400 ms), guardia anti-duplicado, perfiles por marca/modelo (Systel, Kretz) |
| 2 · EAN-13 pesable | **Existe:** prefijo `2`, PLU de 5 dígitos, valor de 5 dígitos, modo global peso/precio (`S.cfg.scaleMode`), rango 0–50 kg, control de stock | `p3b-pos.js` (lector en modo teclado) | **Defecto encontrado:** el código toma el prefijo como de **1 dígito** (`code.slice(1,6)` / `slice(6,11)`); con una etiqueta `20` + PLU 5 + peso 5, `2000012012501` se lee como PLU 1 y **20,125 kg** en vez de PLU 12 y 1,250 kg (verificado con el mismo cálculo del código). Además falta el dígito verificador, formato **por prefijo** (20, 21… con largo de PLU y decimales configurables), importe exacto de la etiqueta, anti-doble lectura |
| 3 · Pantalla táctil y pantalla del cliente | **Parcial:** áreas táctiles ≥ 44/48 px medidas en las pruebas; **no hay** pantalla del cliente ni `BroadcastChannel` | `p1-head.html` (CSS), `p3b-pos.js` | Modo táctil grande (60 px) opcional, `touch-action`, pantalla del cliente |
| 3 · «Mandar a Fiado» / «Mandar a Cuenta Corriente» | **Parcial:** hay **un solo** medio `fiado` («Cta. cte. / Fiado», tecla F4) con límite, plazo por cliente (`cust.term` → `sale.due`, del módulo mayorista) y cobros FIFO | `p3b-pos.js`, `p6-loyalty.js`, `p6b-wholesale.js` | Dos **tipos** de deuda sobre el mismo libro del cliente (4.34.5) |
| 4 · Caja: apertura, movimientos, X, Z, descuadre | **Existe casi todo:** apertura con efectivo inicial, ingresos/egresos con motivo, arqueo en vivo («Vista previa · todavía no cierra la caja» = corte X en pantalla), cierre sellado con diferencia guardada, efectivo / digitales / cta. cte. separados, varias cajas y cierre unificado | `p3-ops.js` (`arqueoCalc`), `p3c-cash.js` | Corte X **guardado, numerado e imprimible**; numeración Z correlativa; Fiado y CC separados en el Z; cierre ciego = bandera `cash.blind` ya especificada en 4.22.6 (F5) |
| 5 · ESC/POS directo | **Existe:** buffer `Uint8Array`, logo rasterizado, QR, PC850, 58/80 mm, corte parcial, envío por USB/serie/Bluetooth, impresora de Windows como respaldo, cola con estado | `p7-devices.js` (`escposTicket`, `devSend`) | **Apertura de cajón** (no existe), corte total/parcial configurable, columnas por modelo, imprimir después de confirmar sin trabar la venta |
| 6 · Service worker / PWA | **No existe.** El sistema ya funciona sin internet **una vez abierto** (un solo archivo + IndexedDB + cola de sincronización idempotente) | `p2-core.js`, `p9-cloud.js` | Abrir el sistema en frío sin conexión (4.34.8) |
| 6 · IndexedDB «estructurado en object stores» | **Choca** con la decisión 6.3: una sola store `kv` con el estado (cifrado AES-256-GCM en el cliente) | `p2-core.js` (`idb`, `loadState`) | **No** se reestructura; se agregan campos a los documentos |
| 6 · Saldos sin conflictos de concurrencia | **Existe por diseño:** el saldo **no se guarda**; se deriva de ventas y cobros (`rave_deuda_cliente`) y los cobros son de escritura única | `10-mayorista-precios.sql` | Mantener esa regla con los dos tipos de deuda |

---

## 4.34.1 Contradicciones del adjunto y decisión tomada

| El adjunto pide | Problema | Decisión |
|---|---|---|
| Archivo aparte `customer-screen.html` | El sistema es **un solo archivo** compilado en 4 variantes; un archivo aparte no recibe la marca, la CSP ni las banderas de cada build | Ruta `#pantalla-cliente` dentro del mismo `index.html`, que arranca en **modo mínimo**: no abre el estado, no descifra nada, sólo escucha |
| Mostrar en el monitor del cliente sus saldos históricos | Lo ven también quienes esperan en la fila (Ley 25.326 de datos personales) | **Apagado** por defecto. Encendido: sólo con cliente identificado, sólo su nombre de pila y el cajero lo muestra por venta con un botón. `[VERIFICAR con asesor]` |
| «Prohibir cobrar el mismo peso dos veces seguidas» | Dos productos iguales pueden pesar lo mismo (dos bandejas de 0,500 kg): bloquear sería un error | **Confirmación**, no bloqueo: «Mismo peso que el anterior (0,500 kg). ¿Es otro producto?» Sin confirmar no se suma |
| «Idéntico por más de 400 ms» | Con ruido eléctrico la última cifra puede oscilar aunque el plato esté quieto | Idéntico **dentro de una tolerancia** configurable (por defecto 0, es decir idéntico; opción de 1 división de la balanza) durante ≥ 400 ms medidos con la hora de cada muestra, más la bandera de estabilidad de la trama si la marca la manda |
| Protocolos Systel y Kretz | No hay manual ni modelo: no se inventan formatos de trama | Perfil «genérico» (el de hoy) + **modo diagnóstico** que muestra la trama cruda para armar el perfil de cada modelo. Perfiles Systel/Kretz `[VERIFICAR con el manual y el equipo]` |
| Botones de 60 px en todo el POS | Rompe la pantalla a 320–360 px (celular) | Opción «Mostrador táctil grande» (60 px) sólo para Vender; por defecto se mantiene el mínimo de 48 px |
| Impedir el zoom por doble toque | Bloquear todo el zoom (`user-scalable=no`) afecta la accesibilidad | `touch-action: manipulation` en botones y fichas (quita el zoom por doble toque y deja el de pellizco); `user-select: none` sólo en botones y fichas, **nunca** en campos, totales ni tickets |
| Service worker «Cache First» para el HTML | El equipo podría quedar pegado a una versión vieja | El HTML se sirve de la caché y se busca la versión nueva en segundo plano; si hay una, aviso «Actualizar» (nunca se recarga solo en medio de una venta) |
| «Network First con fallback» para la API | Las llamadas a Supabase son POST/RPC (no se cachean) y traen datos del comercio | El service worker **no toca** ninguna llamada a Supabase; el trabajo sin conexión lo sigue haciendo la cola existente |
| Background Sync que resuelva las transacciones en Supabase | La sincronización necesita la sesión y la clave de cifrado, que viven sólo en la página abierta; el service worker no debe tenerlas. Además Background Sync sólo existe en Chrome/Edge | Background Sync sólo **despierta** a una pestaña abierta para que sincronice; con el sistema cerrado no sincroniza (límite declarado) |
| Reestructurar IndexedDB | Decisión 6.3 y riesgo de perder datos de equipos en uso | Campos nuevos en los documentos, con valores por defecto para los viejos |
| «Implementá todo de grado de producción» | Hardware no probado | Cada módulo se declara probado sólo con el equipo físico; mientras tanto, pruebas con puerto serie y USB simulados y verificación byte a byte |

**Hallazgo que el adjunto no menciona:** las cuatro publicaciones (`raveholding.github.io/AlmacenRAVE`, `/raveV2`, `/raveV3`, `/KiniDistribuidoraDemo`) comparten **el mismo origen**. IndexedDB ya se separa por nombre de base (`RAVE_BUILD.db`), pero la caché del service worker, el `BroadcastChannel` y `localStorage` son del origen entero. Por eso: nombres de caché con prefijo de la build (`svb-<db>-<versión>`), cada service worker borra **sólo** sus cachés y el canal de la pantalla del cliente lleva la build y la caja en el nombre. Sin esto, una demo abierta en el mismo navegador podría borrar la caché del sistema real o mostrar su carrito.

---

## 4.34.2 Balanza (`p7-devices.js`) — fase H1

1. **Estabilizador** como función pura `scaleStab(state, {kg, t, flag})` → `{stable, kg}`: estable cuando todas las muestras de los últimos ≥ 400 ms (por `t`, no por cantidad) están dentro de la tolerancia y, si la trama trae bandera de estabilidad, está en «estable». `scaleRead` lo usa en lugar de «3 muestras».
2. **Guardia anti-duplicado** `scaleDup(state, kg, t)` por ticket: después de capturar `W`, la próxima captura necesita (a) que la balanza haya pasado por cero (≤ 0,005 kg), **o** (b) un peso distinto de `W` estable y ≥ 3 s desde la captura anterior. Si no se cumple y el peso es igual → la confirmación de 4.34.1. Toda confirmación queda en Auditoría.
3. **Perfiles:** `genérico` (hoy) + `diagnóstico` (muestra las últimas 20 tramas crudas en Periféricos para armar el perfil). Systel y Kretz se agregan cuando haya modelo y manual.
4. **Origen del peso** en la línea: `src: 'balanza' | 'etiqueta' | 'manual'` y, si es balanza, el id del equipo.

## 4.34.3 Etiquetas EAN-13 pesables (`p3b-pos.js`) — fase H1

1. Función pura `parseEan13Scale(code, layouts)` → `{plu, mode, kg | priceC}` o un error explicado.
2. **Dígito verificador** EAN-13 (módulo 10) obligatorio; si no da: «Etiqueta mal leída, volvé a pasarla».
3. **Formato por prefijo** en Configuración → Periféricos (por defecto se mantiene lo de hoy: prefijo 2, PLU 5, valor 5, modo global):

```
scaleLabels = [{ prefix:'20', pluLen:5, mode:'peso',   dec:3 },
               { prefix:'21', pluLen:5, mode:'precio', dec:0 }]
```
4. **Modo precio:** el importe de la línea es **exactamente** el de la etiqueta (es lo que el cliente ve impreso); la cantidad se informa como peso equivalente pero no se recalcula el importe. Aviso: con 5 dígitos el importe máximo es $ 99.999 (con precios actuales una pieza grande lo puede superar) `[VERIFICAR con la balanza]`.
5. Leer la **misma etiqueta** dos veces seguidas en el mismo ticket pide confirmación.

## 4.34.4 POS táctil y pantalla del cliente — fase H5

1. Opción «Mostrador táctil grande»: botones y fichas de Vender a 60 × 60 px como mínimo (medido en las pruebas), sin desbordes a 768 px y más; en celular sigue el mínimo de 48 px.
2. `touch-action: manipulation` y `user-select: none` según 4.34.1. Estados `.selected` con `aria-pressed` y con texto/ícono (no sólo color).
3. **Pantalla del cliente** (`#pantalla-cliente`): botón «Abrir pantalla del cliente» en Vender (`window.open`; si el navegador lo permite, en el segundo monitor). Canal `BroadcastChannel('svb-cs-' + RAVE_BUILD.db + '-' + caja)`. Mensajes versionados `{v:1, type:'cart'|'total'|'paid'|'idle', seq, lines:[{name, qty, unitLabel, amt}], sub, adj, total, cust:{first}|null, bal:{fiado, cc}|null}`. **Nunca** viajan costos, márgenes, CUIT, DNI ni teléfono. La pantalla ignora mensajes con `seq` viejo y vuelve a «En espera» (logo y, si está encendido, QR del Club) a los 60 s del cobro.
4. Si el navegador no tiene `BroadcastChannel`, el botón no aparece.

## 4.34.5 Fiado y cuenta corriente como dos tipos de deuda — fase H3

1. Mismo medio `fiado`, mismo libro del cliente, mismo límite. Cada parte a crédito guarda `ck: 'fiado' | 'cc'` y `due` (vencimiento).
2. Al cobrar con parte a crédito, el cajero **tiene que elegir** «Mandar a Fiado» o «Mandar a Cuenta Corriente» (nada viene preseleccionado; sin elegir no se confirma).
   - **Fiado:** vence a los `cfg.credit.fiadoDays` días (7 por defecto).
   - **Cuenta corriente:** vence según el plazo del cliente (`cust.term`); si el cliente no tiene plazo, no se ofrece CC y se explica.
3. Ventas viejas sin `ck` = `'cc'` (es lo que eran). Saldos separados en la ficha del cliente, en la pantalla del cliente (si está encendido) y en el Z: **siempre derivados**, nunca guardados.
4. **Cobros:** se aplican primero a lo más vencido, sin importar el tipo (FIFO por `due`); el cajero puede elegir el tipo a mano. Sigue valiendo el reparto por rubro de 4.27/M.1.
5. Bloqueos de 4.22.2 (mora vencida, límite, excepción de un solo uso) iguales para los dos tipos.
6. Nube: `17-fiado-cc-cortes.sql` — `rave_deuda_cliente` devuelve también el saldo por tipo; validación de `ck`/`due` en `ventas`.

## 4.34.6 Caja: cortes X y Z — fase H4

1. **Estados** del turno (explícitos, validados en el equipo y en el servidor): `CERRADA → ABIERTA → (cortes X) → CERRADA (Z sellado)`. Una caja cerrada no se modifica (ya lo valida `sincronizar()`).
2. **Corte X:** foto guardada del arqueo en ese momento, numerada por caja y turno (`X-<caja>-<turno>-<n>`), colección nueva `cortesx` de escritura única, imprimible por ESC/POS; **no** cierra ni reinicia nada. Permiso `close_cash` o uno nuevo `cash_x`.
3. **Corte Z:** el cierre sellado de hoy + número correlativo por caja (`Z-<caja>-<n>`) sin saltos; si el servidor detecta un salto o un duplicado entre dos equipos, lo marca para revisión (no lo rechaza).
4. Totales del Z: efectivo, débito, crédito, QR/billeteras (MODO incluido), transferencia, **Fiado** y **Cuenta corriente** por separado, ingresos, egresos, traspasos, efectivo esperado, declarado y **diferencia** (ya se guarda).
5. Cierre ciego: se construye como está en 4.22.6 / F5 (`cash.blind`), no se especifica de nuevo.

## 4.34.7 Impresora térmica y cajón — fase H2

1. **Cajón:** `ESC p m t1 t2` (`0x1B 0x70`), pin 2 o 5 y duración configurables; se abre **después** de confirmar una venta con parte en efectivo (o «siempre», configurable) y desde Caja con permiso. Toda apertura sin venta queda en Auditoría (`CAJON_ABIERTO`).
2. **Corte:** total o parcial configurable (`GS V 0x41 / 0x42`) o sin corte (modelos sin cuchilla).
3. **Columnas** por modelo (típico 32 en 58 mm y 48 en 80 mm; configurable) y página de códigos (PC850 hoy; `ESC t n` si el modelo lo pide).
4. La venta se confirma **antes** de imprimir; si la impresión falla, queda en la cola para reintentar o reimprimir y nunca se pierde la venta.
5. Sin diálogo del navegador sólo con USB/serie/Bluetooth; con la impresora de Windows aparece el diálogo (límite declarado; el instalador puede abrir el navegador en modo kiosco `[VERIFICAR]`).

## 4.34.8 Uso sin internet desde cero (service worker) — fase H6, la última

1. Archivo `sw.js` y `manifest.webmanifest` **por publicación**, generados por `build.py` con la versión de la build.
2. **CSP:** hoy `default-src 'none'` bloquea el service worker; agregar `worker-src 'self'` y `manifest-src 'self'` en `p1-head.html` y comprobar que no se abre nada más.
3. Precaché: `index.html`, `privacidad.html`, íconos y manifiesto. Fuentes de Google: caché con respaldo a la fuente del sistema.
4. HTML: caché primero + revisión en segundo plano + aviso «Hay una versión nueva · Actualizar».
5. Supabase: **sin intervención** del service worker (ni caché ni reintentos).
6. Cachés con prefijo de la build; en `activate` se borran sólo las propias.
7. `file://` (instalador de Windows y pruebas) no admite service worker: el registro se intenta sólo en `https` y el sistema sigue igual sin él.
8. Background Sync según 4.34.1.

## 4.34.9 Datos nuevos (campos con valor por defecto; ningún dato viejo cambia)

```
línea  += { src, dev }                      // origen del peso
pago   += { ck, due }                       // sólo partes a crédito
cfg    += { scaleLabels, scaleTol, credit:{fiadoDays}, touch:{big},
            drawer:{on, pin, ms, when}, ticket:{cut, cols, cp},
            cscreen:{on, showBal} }
cortesx (colección nueva, escritura única)
cierres += { zn }                           // número de Z
```
Cada colección nueva: lista cerrada de `sincronizar()`, política de lectura, exportación, importación, respaldo y prueba A/B.

## 4.34.10 Banderas por sistema (propuesta; decide el dueño)

| | Almacén RAVE | Kini | raveV2 | raveV3 |
|---|---|---|---|---|
| Balanza / etiquetas (H1) | Encendido (tiene producto a granel) | Apagado | Encendido con balanza simulada | Encendido con balanza simulada |
| Cajón y corte (H2) | Encendido al configurar la impresora | Igual | Vista previa | Vista previa |
| Fiado / CC (H3) | **Decide el dueño** | CC sí, fiado no | Encendido | Encendido |
| Cortes X/Z (H4) | Encendido | Encendido | Encendido | Encendido |
| Pantalla del cliente (H5) | Apagada; saldos apagados | Apagada | Encendida (ejemplo) | Encendida (ejemplo) |
| Service worker (H6) | Después de probar en las demos | Sí | Sí | Sí |

## 4.34.11 Pruebas obligatorias (números conocidos)

1. **Estabilidad:** muestras 1,250 cada 100 ms durante 300 ms → no estable; durante 400 ms → estable 1,250; 1,250/1,252 alternados con tolerancia 0 → no estable; con tolerancia 0,002 → estable.
2. **Anti-duplicado:** capturar 0,500 → plato con 0,500 de nuevo sin pasar por cero → pide confirmación; pasa por 0,000 → se acepta sin preguntar; 0,500 → 0,750 estable a los 3,2 s → se acepta.
3. **EAN-13:** `2000012012501` (prefijo 20, PLU 00012, 1,250 kg, verificador 1) → 1,250 kg del PLU 12 (**hoy se lee PLU 1 y 20,125 kg**: es la prueba que tiene que pasar a verde); `2000012012508` (verificador cambiado) → rechazado; `2100012106252` (prefijo 21, modo precio) → línea de **$ 10.625 exactos**; producto por unidad con etiqueta de balanza → rechazado (como hoy). Los códigos de la prueba se generan con el verificador calculado por una función independiente.
4. **Fiado/CC:** sin elegir tipo no se confirma; fiado del 4/11 vence el 11/11; CC con plazo 30 vence el 4/12; cliente sin plazo no ofrece CC; cobro de $ 3.000 con fiado vencido $ 2.000 y CC al día $ 5.000 → cancela el fiado y deja $ 1.000 a cuenta de la CC; saldos por tipo = cálculo aparte; venta vieja sin `ck` cuenta como CC.
5. **Cortes:** X no cambia nada (dos X seguidos con los mismos números; el turno sigue abierto); Z con efectivo esperado $ 58.400 y declarado $ 58.000 → diferencia −$ 400 guardada; numeración Z 1, 2, 3 sin saltos; dos equipos con el mismo número → revisión.
6. **ESC/POS:** el buffer de una venta en efectivo contiene `1B 70 00 19 FA` (pin 2, valores de ejemplo) **después** de los bytes del ticket y termina en el corte configurado; venta sólo con débito no abre el cajón (modo «con efectivo»); falla de impresión → la venta existe y queda en la cola.
7. **Pantalla del cliente:** el carrito llega en < 200 ms; los mensajes no contienen costo, CUIT, DNI ni teléfono (se revisa el JSON); con saldos apagados `bal` es `null`; dos builds abiertas en el mismo navegador no se cruzan.
8. **Service worker:** con la red cortada, `https://…/raveV2/` abre y permite vender; la caché de raveV2 no borra la de Almacén RAVE; una versión nueva muestra el aviso y no recarga sola; ninguna petición a `*.supabase.co` pasa por la caché.
9. **Regresión:** banderas apagadas → suites sin cambios; 320/360/768/1024/1440 px; consola sin errores; `file://` y `https`.

## 4.34.12 Orden de construcción

H1 balanza + etiquetas (funciones puras primero) → H2 cajón y corte → H3 Fiado/CC (+ `17-fiado-cc-cortes.sql`) → H4 cortes X/Z → H5 pantalla del cliente → H6 service worker (primero en las demos). Cada fase termina con regresión completa verde, build de las 4 variantes, publicación y anexo *as-built*.

**Límites declarados:** sin equipos físicos no se afirma compatibilidad con ninguna marca; Safari/iPhone no tiene Web Serial, WebUSB ni Background Sync; la pantalla del cliente funciona en el mismo equipo y el mismo navegador.
