# 4.33 · PRECIOS POR VOLUMEN (CIERRE DE F1) Y AJUSTES POR MEDIO DE PAGO (V26.49 · propuesta)

> **Versión corregida del adjunto «esquema de ventas multi-nivel».** Se escribió después de inspeccionar el código real (`AlmacenRAVE/fuente`, V26.48, 2026-11-04) y de correr las pruebas `ws1.py` (78/78) y `kn3.py` (18/18). Rige la regla 2 de la sección 2: lo que el adjunto pedía y choca con decisiones ya tomadas está en 4.33.2 con la decisión adoptada; no se implementa en silencio ninguna de las dos versiones.

> **Decisiones del dueño (2026-11-04) y estado V26.49 — prevalecen sobre el resto de esta sección:**
> 1. **Recargo O descuento en cada medio** (efectivo, débito, crédito, transferencia, QR y MODO), en % o monto fijo, editable por el administrador. **No se bloquea** el recargo a tarjeta/QR/transferencia: se muestra el aviso de la Ley 25.065 art. 37 inc. c, el administrador lo acepta una vez y queda en Auditoría. Esto reemplaza la fila 1 de 4.33.2 y el punto 7 de 4.33.8.
> 2. **Construido en V26.49:** 4.33.4 completo (cálculo, cobro simple y mixto, vuelto, reparto por línea `pa`, ticket, arqueo, detalle de cobros digitales) y 4.33.6 (`16-ajustes-medios-pago.sql`). Cliente: **apagado** sin reglas; demos: reglas de ejemplo (efectivo −10 %, transferencia −5 %) **apagadas**, se encienden con un clic. Pruebas: `pa1.py` 31/31 en las 4 variantes, SQL `24-sql-tests.sql`.
> 3. **Pendiente (no construido):** 4.33.3 a (tramos en el ticket impreso), c (ingreso de compras por presentación) y d (importar/exportar presentaciones). Venta online (Tiendanube) no lleva ajuste del mostrador.

**Estado:** ESPECIFICACIÓN. Nada de 4.33.3 en adelante está construido. Todo va detrás de banderas, apagado en el sistema del cliente; con las banderas apagadas el sistema se comporta **exactamente** como V26.48 (regresión completa obligatoria apagado y encendido).

**Rol para quien construye:** el de la sección 2 del prompt maestro (no se reemplaza por «arquitecto senior»): se inspecciona antes de tocar, se reutiliza lo que existe, no se crea un segundo POS, stock, caja ni cálculo de precio.

---

## 4.33.0 Matriz de detección (inspección del código real, 2026-11-04)

| Lo que pedía el adjunto | Estado real | Dónde está | Qué hacer |
|---|---|---|---|
| Tablas `price_lists` / `product_prices` con `min_quantity` | **Existe con otro modelo, decidido por el dueño (4.22.1 · 1.2-bis, V26.6):** precios **por presentación** dentro de cada producto | `p.pres[{lv,qty,unit,barcode}]`, `S.cfg.wholesale.levels` (Display, Fardo, Pallet, editables), `p6b-wholesale.js` | **No crear tablas nuevas.** Las «listas L1–L5» ya fueron reemplazadas una vez; volver a ellas rompería las demos y la decisión del dueño |
| `product_packages` (Bulto = 12, Pallet = 120) | **Existe** | `pres[].qty` (unidades base por presentación), código de barras propio por presentación | Nada |
| Stock siempre en unidad base | **Existe** | El stock es uno solo en unidad base; el servidor suma el stock con `smov` (deltas) en la 2.ª pasada de `sincronizar()` | Nada; sólo extender a compras (4.33.3-c) |
| Desglose automático 1 bulto + sueltas en dos líneas | **Existe** («cobro por tramos») | `priceResolve()` arma `tr[]`; la venta guarda un renglón por tramo. Probado: 13 u = 12 u a $ 90 (Display) + 1 u a $ 100 = **$ 1.180**, stock −13 (`ws1.py`); Kini 26 u = 1 Fardo + 2 sueltas $ 34.200 (`kn3.py`) | Nada. Corregir el texto viejo del anexo F.3.5, que todavía dice «no se desglosa» |
| Resolver en memoria antes de confirmar | **Existe** | `wsRecalc()` sobre `pos.lines` (estado del ticket persistido en IndexedDB), `wsGate()` al cobrar con el mismo cálculo | Nada |
| «Foto» de precios por ítem | **Existe en gran parte** | Ítem: `lr` (regla `L1`/`P-<pres>`/`ACU`/`MAN`/`MIX`), `ll` (presentación), `lb` (precio base), tramos; venta: `wch` (canal), `pays[]` | **Completar:** factor y unidades base por tramo explícitos, y el objeto de ajuste por medio de pago (4.33.5) |
| Recargo / descuento por medio de pago | **No existe.** Sólo hay `S.cfg.fee[m]`, que es la **comisión que retiene el procesador** (costo del comercio, no se cobra al cliente) | `p3b-pos.js` (`p.fee`) | **Agregar** (4.33.4), sin mezclarlo con `fee` |
| RLS «sólo dueño modifica precios y configuración» | **Existe con otro alcance:** RLS por comercio + `rave_puede_escribir()`: el **supervisor** hoy puede escribir `prod` (precios incluidos) y `cfg/cfg` | `supabase/10-mayorista-precios.sql` | Precios: **no cambia** (el permiso `price_lists` ya es admin + supervisor por decisión previa). Ajustes por medio de pago: documento de configuración **nuevo** que sólo escribe el administrador (4.33.6) |
| Dinero `NUMERIC` | **Choca:** el sistema guarda **centavos enteros** en el equipo | todo `p*.js` | Centavos enteros; porcentajes en **puntos básicos** enteros (10 % = 1000) |
| Tablas relacionales por entidad | **Choca:** la nube es un almacén de documentos `registros(comercio_id, coleccion, id, datos jsonb)` con `sincronizar()` | `01-base.sql`, `02-sincronizacion.sql` | Seguir el patrón: colecciones/documentos nuevos + validación en `sincronizar()` |

**Conclusión de la matriz:** de los 5 módulos del adjunto, 3 ya están hechos y probados (1, 2 y 3). Lo nuevo de verdad es el **motor de ajustes por medio de pago** (4.33.4) y tres pendientes declarados de F1 (4.33.3).

---

## 4.33.1 Objetivo (corregido)

1. Cerrar los pendientes declarados de F1 que tocan lo que pide el adjunto (ticket impreso con tramos, compras por presentación, importar/exportar presentaciones).
2. Agregar ajustes **administrables** por medio de pago (porcentaje o monto fijo), con historial congelado en la venta, **dentro del marco legal argentino** (4.33.2, fila 1).
3. No tocar `priceResolve` ni el cobro por tramos salvo para agregar campos al snapshot.

---

## 4.33.2 Contradicciones del adjunto y decisión tomada

| El adjunto pide | Choca con | Decisión por defecto |
|---|---|---|
| Recargo por medio de pago (ej. +15 % tarjeta) | **Ley 25.065, art. 37 inc. c:** el comercio no puede hacer diferencias de precio entre contado y tarjeta. Sigue aplicándose: la Justicia de Salta lo ratificó en julio de 2026 | **Recargo bloqueado** para débito, crédito en 1 pago, QR, MODO y transferencia (el sistema no deja guardarlo y explica por qué). Sólo se admite **interés de financiación en cuotas** (crédito 2+ cuotas), rotulado como tal. `[VERIFICAR con asesor]` |
| Descuento por pagar en efectivo (ej. −10 %) | Las oficinas de defensa del consumidor suelen considerarlo un «recargo encubierto» a la tarjeta | Permitido **sólo si el dueño lo enciende y acepta el aviso legal** (queda en auditoría con usuario y fecha). Apagado por defecto. `[VERIFICAR con asesor]` |
| Tablas `price_lists`/`product_prices` | Decisión del dueño V26.6 (precios por presentación) | Se mantiene el modelo por presentación |
| `NUMERIC` | Centavos enteros en el equipo | Centavos y puntos básicos enteros |
| «Sólo el dueño modifica precios» | Permiso `price_lists` = admin + supervisor (4.22.12) | Precios sin cambios; los ajustes de pago, sólo administrador |
| Ajuste «sobre el subtotal» | 4.3: **un solo beneficio por compra**; y existe el cobro mixto (4.20) | El ajuste se calcula **después** del beneficio y **por cada parte** del cobro mixto (4.33.4.2). Si hay cupón/membresía, un descuento por medio de pago **no se acumula** salvo `payadj.stack` encendido |
| JSON de orden nuevo | Ya existe la estructura de venta que se sincroniza | Se **agregan campos** a la venta actual; no hay un segundo formato |

---

## 4.33.3 Pendientes de F1 a cerrar (sin cambiar reglas de precio)

a. **Ticket impreso con tramos:** el ticket (vista previa, navegador y ESC/POS) muestra cada tramo en su renglón: «12 u Display × $ 90 = $ 1.080» y «1 u × $ 100 = $ 100». Sin costos ni márgenes.
b. **Snapshot por tramo:** cada renglón guarda `pf` (unidades base por presentación: 12) y `bu` (unidades base descontadas: 12). La suma de `bu` de la venta es exactamente lo que baja el stock. Las ventas viejas sin estos campos se leen con `pf=1`, `bu=qty`.
c. **Ingreso de compras por presentación** (`p4c-compras.js`, 4.21): poder recibir «3 Fardo» y que el stock suba 3 × qty base; el costo se carga por presentación o por unidad (el otro se calcula). La recepción sigue siendo atómica en `procesar_recepcion`.
d. **Importar/exportar presentaciones** por CSV/Excel junto con los productos (mismo patrón de vista previa y reversión de 4.9).

---

## 4.33.4 Motor de ajustes por medio de pago

### 4.33.4.1 Configuración (Configuración → Medios de pago → Ajustes; sólo administrador)

Documento `cfg/payadj` (nuevo, separado de `cfg/cfg` para que el supervisor no pueda escribirlo):

```
payadj = {
  on: false,                 // apagado por defecto en el cliente
  legalAck: null,            // {user, ts} cuando el dueño acepta el aviso legal
  stack: false,              // ¿se acumula con cupón/membresía? por defecto NO
  fiado: false,              // ¿se aplica a la parte a cuenta corriente? por defecto NO
  rules: [{
    id, ver,                 // ver sube en cada edición (el historial guarda id+ver)
    m: 'efectivo',           // uno de POS_METHODS
    kind: 'pct' | 'fixed',
    sign: -1 | +1,           // -1 descuento, +1 recargo/interés
    v: 1000,                 // pct en puntos básicos (10 %) | fixed en centavos
    cuotas: null,            // sólo crédito: número de cuotas al que aplica el interés
    label: 'Descuento efectivo',
    active: true
  }]
}
```

Validaciones al guardar: `v` entero > 0; pct ≤ 5000 (50 %); `sign:+1` rechazado para `debito`, `credito` sin `cuotas ≥ 2`, `qr`, `modo`, `transferencia` (mensaje con la ley); a lo sumo una regla activa por (medio, cuotas); todo cambio queda en Auditoría con valor anterior y nuevo.

### 4.33.4.2 Cálculo (función pura `payAdjCalc`, la misma en pantalla, en `commitSale` y en la revisión del servidor)

Orden fijo:

1. `sub` = suma de líneas después de `priceResolve` (tramos incluidos).
2. `ben` = el único beneficio de 4.3 (cupón, membresía o descuento manual autorizado).
3. `base = sub − ben`. Si hay beneficio y `stack` está apagado, los ajustes con `sign:-1` **no se aplican** y la pantalla dice por qué.
4. **Cobro simple:** `adj = f(regla del medio, base)`. **Cobro mixto:** el cajero reparte la **base** (no el total final) entre los medios; cada parte recibe su propio ajuste; un ajuste `fixed` se aplica una sola vez por medio presente, a lo sumo hasta el importe de esa parte.
5. Porcentaje: `amt = sign × redondeo(|parte| × v / 10000)` con **redondeo al centavo, mitad hacia arriba sobre el valor absoluto** (no `Math.round` sobre negativos, que redondea distinto).
6. La parte `fiado` no lleva ajuste salvo `payadj.fiado`.
7. `total = base + Σ amt`; nunca < 0 (un descuento fijo mayor que su parte se recorta y se avisa).
8. El ajuste se **reparte por línea** con el método del mayor resto (el mismo de 4.3) en el campo nuevo `pa` de cada línea, para que la factura de ARCA, las notas de crédito y el margen por producto cierren al centavo. `pa` se guarda separado del descuento de beneficio (`disc`) para que los reportes distingan uno de otro.

### 4.33.4.3 Pantalla de cobro

- Debajo del total: «Subtotal $ 10.000 · Descuento efectivo −10 % −$ 1.000 · **Total $ 9.000**». Al cambiar de medio se recalcula al instante.
- En cobro mixto, cada fila de medio muestra su ajuste; la validación de «suma exacta» de 4.20 se hace contra la **base** repartida, y el «total a cobrar» mostrado ya incluye los ajustes.
- El vuelto se calcula sobre el importe final del efectivo.
- Si el ticket tiene beneficio y la regla no se acumula: «El descuento por efectivo no se suma al cupón».

### 4.33.4.4 Efectos en el resto del sistema

- **Arqueo:** el efectivo esperado usa lo realmente recibido (con ajuste). La comisión `fee` se calcula sobre el importe final de esa parte.
- **Devolución / nota de crédito:** se devuelve lo efectivamente cobrado por línea (`price × qty − disc − pa`).
- **Factura ARCA:** el total del comprobante es el total con ajuste, ya repartido por línea. Tratamiento del interés por cuotas en el comprobante: `[VERIFICAR con contador]`.
- **Menú público:** no cambia. Opción aparte (apagada) para mostrar «−10 % pagando en efectivo».
- **Kini (sólo mayorista):** el ajuste se aplica después del cobro por tramos, igual que en minorista.

---

## 4.33.5 Snapshot de la venta (campos nuevos; los viejos no cambian)

```
venta += {
  sub,                       // subtotal antes de beneficio y ajuste (centavos)
  adj: [{ rid, ver, m, kind, sign, v, cuotas, base, amt, label }],
  adjReview: false           // sólo lo escribe el servidor (4.33.6)
}
item/renglón += { pf, bu, pa }   // factor, unidades base, ajuste repartido
```

Invariantes que verifica el equipo antes de guardar y el servidor al sincronizar: `total = sub − ben + Σ adj.amt`; `Σ item.pa = Σ adj.amt`; `Σ item.bu` = unidades que bajan del stock; cada renglón cumple `qty × price` = importe (ya se verifica hoy).

---

## 4.33.6 Nube: migración `16-ajustes-medios-pago.sql` (aditiva, idempotente)

- Agregar `'payadj'` a `c_cfg_ids` en `sincronizar()`. `rave_puede_escribir`: `cfg/payadj` **sólo administrador** (el supervisor sigue limitado a `cfg/cfg`).
- En `ventas`: validar los invariantes de 4.33.5 (estructura, enteros, signos, suma). **La venta ya hecha no se rechaza** si la regla cambió mientras el equipo estaba sin conexión (mismo criterio que 4.20.9 y `credit_review`): se marca `adjReview`/`arw` y aparece en Configuración → Ventas a revisar. Sí se rechaza un formato inválido (sumas que no cierran, `NaN`, signo prohibido).
- `adjReview` sólo lo puede escribir el servidor.
- Agregar al final de `INSTALAR-TODO.sql`; actualizar `LEEME-supabase.md`, exportación, importación y respaldo.

---

## 4.33.7 Banderas y despliegue por sistema

| Sistema (build) | `payadj.on` al publicar | Notas |
|---|---|---|
| Almacén RAVE (`cliente`) | **Apagado** | Lo enciende el dueño después del aviso legal |
| KiniDistribuidoraDemo (`kini`) | Encendido con regla de **ejemplo** (efectivo −5 %) rotulada | Sólo mayorista, con tramos |
| raveV2 (`solo`) | Encendido con ejemplo | Sin mayorista (apagado desde V26.43) |
| raveV3 (`v3`) | Encendido con ejemplo | Igual que raveV2, con el Centro Inteligente |

Una sola fuente (`AlmacenRAVE/fuente`), cuatro builds; `index.html` no se edita a mano en ningún repositorio.

---

## 4.33.8 Pruebas obligatorias (números calculados aparte)

1. Sin ajustes y con `payadj.on` apagado: `ws1`, `kn3` (con la build genérica), `pq1` y la regresión completa sin cambios.
2. Subtotal $ 10.000, efectivo −10 % → **$ 9.000**; transferencia con descuento fijo $ 500 → **$ 9.500**.
3. Mixto: $ 6.000 efectivo (−10 % = −$ 600) + $ 4.000 débito (sin ajuste) → **$ 9.400**; vuelto sobre $ 5.400 de efectivo.
4. Redondeo: base $ 3.333,33 × 10 % → **$ 333,33**; descuento y recargo simétricos (mitad hacia arriba sobre el valor absoluto).
5. Cupón 10 % + efectivo −10 % con `stack` apagado → sólo el cupón, con el aviso; encendido → $ 10.000 − $ 1.000 − $ 900 = **$ 8.100**.
6. Descuento fijo $ 500 sobre una parte de $ 300 → se recorta a $ 300, total nunca negativo.
7. Intentar guardar recargo +15 % en débito → rechazado con el texto legal; crédito 3 cuotas +12 % → permitido y rotulado «interés de financiación».
8. El supervisor no puede escribir `cfg/payadj` (equipo **y** servidor, prueba A/B de RLS); `adjReview` enviado por el equipo se ignora.
9. Venta sin conexión con una regla vieja → sincroniza, **no** se rechaza, queda `adjReview`.
10. Tramos + ajuste: 13 u (12 Display a $ 90 + 1 a $ 100 = $ 1.180) en efectivo −10 % → **$ 1.062**; `Σ pa = −$ 118`; stock −13; `Σ bu = 13`.
11. Devolución parcial de la línea de Display → devuelve lo cobrado neto de su `pa`.
12. Arqueo: efectivo esperado = apertura + efectivo neto de ajustes; comisión calculada sobre el neto.
13. Ticket impreso (los 3 formatos) con tramos y línea de ajuste; sin costos.
14. Compras: recibir 3 Fardo de 6 → stock +18; anular la recepción revierte todo.
15. Forma: 360/768/1280 px sin desbordes, áreas táctiles ≥ 48 px, consola sin errores, `file://` y `https`.

## 4.33.9 Orden de construcción

1. `payAdjCalc` como función pura + pruebas unitarias con los números de 4.33.8.
2. Pantalla de configuración y pantalla de cobro (simple y mixto).
3. Snapshot, ticket, arqueo, devoluciones, ARCA.
4. `16-ajustes-medios-pago.sql` + pruebas SQL A/B.
5. Pendientes de F1 (4.33.3 a → d).
6. Regresión completa apagado/encendido → build de las 4 variantes → publicación → anexo *as-built*.

**Límites declarados:** el servidor valida estructura y sumas, no recalcula el precio por presentación (igual que F.3.1). La legalidad del descuento por efectivo y el tratamiento fiscal del interés en cuotas quedan `[VERIFICAR]` con asesor y contador.
