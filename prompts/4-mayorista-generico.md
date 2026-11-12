# PROMPT 4 · «Sistema VB · Mayorista» (genérico para almacenes y negocios mayoristas; demo base: Kini Distribuidora)

> **Requisito:** usá completo el **PROMPT 1 (Plataforma Sistema VB v4)** con **`0-inventario-funcional-y-paridad.md`** (en especial la sección D) y **`S-seguridad-obligatoria.md`**. Este prompt define la **edición Mayorista** como perfil y módulos de la misma plataforma: sin forks ni código especial por cliente.

---

## Rol (además del PROMPT 1)
Sumá experiencia en **distribución mayorista y venta B2B en Argentina**: almacenes mayoristas, autoservicios mayoristas, distribuidoras de bebidas, golosinas, limpieza y almacén; preventa, reparto, crédito comercial, listas de precio por canal, márgenes por presentación, facturación A/B y cobranzas en calle.

## Contexto
- Hoy existe la demo **Kini Distribuidora** (`raveholding/KiniDistribuidoraDemo`, build `kini` de `AlmacenRAVE/fuente`): mayorista de un solo dueño, **sólo mayorista**, presentaciones (unidad, display, fardo, pallet), Caja 1, Caja 2 y Caja principal, proveedores con deuda y órdenes de compra, el dueño elige de qué caja sale el pago a un proveedor y mueve fondos entre cajas.
- Especificación de referencia: `SISTEMA_VB_26F.md` **4.22** (mayorista/minorista con trazabilidad integral y control administrativo-contable, con su matriz 4.22.0 de lo hecho y lo pendiente), **4.29** (tipo de negocio y traspasos del dueño) y **anexo L** (distribuidora sólo mayorista).
- **Objetivo:** un sistema **genérico** que sirva a cualquier almacén o negocio mayorista (también al que vende minorista y mayorista a la vez), con su demo «Sistema VB · Mayorista».

## Principios propios (de 4.22, no se negocian)
1. **Un solo catálogo, un solo stock (unidad base), un solo libro de clientes y una sola caja**: el canal es un atributo de la operación, no un sistema paralelo.
2. **Un solo punto de cálculo de precio** (`priceResolve` en `packages/core`), usado por la pantalla, el cobro y el servidor.
3. **Una fuente de precio y un solo beneficio por compra**: lista, acuerdo o escalón definen el precio; después, a lo sumo un beneficio.
4. **El servidor recalcula** precio, descuento, stock, lote, crédito y totales.
5. **Histórico congelado**: cada línea guarda la regla aplicada; cambiar listas o costos no reescribe ventas, remitos, cierres ni asientos.
6. Dinero en centavos enteros o `numeric(14,2)`; toda entidad con `tenant_id`, RLS, auditoría e idempotencia.

## Configuración del perfil (por cliente, sin código)
- **Modelo:** un solo dueño (predeterminado) o rubros con responsable. **Canal:** sólo mayorista / minorista y mayorista.
- Presentaciones por producto (unidad base, display, fardo, caja, pallet, con unidades por presentación y código de barras propio), listas de precio por canal y por zona, escalones por cantidad, acuerdos por cliente, márgenes mínimos.
- Rubros de ejemplo intercambiables: bebidas sin alcohol, cervezas, vinos y aperitivos, almacén, golosinas y snacks, limpieza, perfumería, packs y combos.

## Módulos de la edición Mayorista
1. **Venta mayorista en mostrador** (autoservicio mayorista): POS rápido con presentaciones, precio por unidad que pasa al mayorista al completar la presentación, escalones visibles, margen mínimo con aviso, venta por bulto cerrado o suelta, cliente obligatorio para cuenta corriente (CUIT), factura A/B o remito.
2. **Clientes B2B:** razón social, CUIT, condición IVA, domicilio fiscal y de entrega, canal, lista, zona, vendedor, **límite y plazo de crédito**, vencimientos por documento (FIFO), antigüedad de saldos, bloqueo automático y excepción autorizada de un solo uso, datos para facturar precargados.
3. **Pedidos de venta** (pendiente en el sistema actual): toma de pedido en mostrador, por **preventista** (celular, sin conexión) o por el **catálogo B2B online** del cliente con usuario propio; reserva de stock; aprobación por crédito; estados (pendiente, aprobado, preparado, despachado, entregado, facturado).
4. **Depósito:** picking por zona, **remito con constancia de entrega** (firma o foto en el celular del repartidor), control de faltantes, **lotes y vencimientos con FEFO**, trazabilidad inversa (de un lote a los clientes que lo recibieron), conteos cíclicos, kits y combos con una sola estructura de componentes.
5. **Reparto:** hoja de ruta por zona y vehículo, orden de visitas, entregas y **cobranza en calle** (efectivo, transferencia, cheque), rendición del repartidor contra la caja con diferencias justificadas.
6. **Compras y proveedores:** órdenes de compra, **recepción** con lote y vencimiento, costo promedio y último costo, cuenta corriente de proveedores, **pago desde la caja o cuenta elegida**, bonificaciones y notas de crédito de proveedor, reposición sugerida por rotación.
7. **Cajas y tesorería:** Caja 1, Caja 2, caja principal, traspasos del dueño entre cajas abiertas o cerradas, cuentas bancarias, cheques en cartera, conciliación de Mercado Pago y banco, flujo de fondos.
8. **Fiscal y contable:** facturación A/B/C con **sv.arca.sdk**, NC/ND, libro IVA, percepciones de IIBB cuando corresponda `[VERIFICAR según jurisdicción]`, asientos automáticos y exportación al estudio contable.
9. **Reportes mayoristas:** ventas por canal, zona, vendedor, cliente, presentación y proveedor; margen real por línea; rotación y cobertura de stock; clientes que dejaron de comprar; comisiones de vendedores congeladas al vender.
10. **Comunicación:** lista de precios en PDF o link para WhatsApp por canal, aviso de saldo y vencimientos al cliente, pedido recibido y en camino.
11. **Además, todo el núcleo del inventario:** caja, cierres y arqueos, inventario, usuarios y permisos, auditoría, importar/exportar, periféricos (balanza, lector, impresora), nube, legal, configuración y Resumen.

## Diseño (además del PROMPT 1)
- Vender mayorista con **tabla densa** además de la grilla con fotos (cantidad por presentación en columnas), carga por código y cantidad con teclado.
- App del **preventista y del repartidor** pensada para celular, una mano y sin conexión: lista de visitas, catálogo con stock y precio del cliente, pedido, cobro y firma.
- Catálogo B2B online con la marca del cliente: login del comprador, precios de su lista, pedido mínimo, repetir el último pedido.

## Demo «Sistema VB · Mayorista»
- Distribuidora **ficticia** («Distribuidora Demo», sin marcas reales): un solo dueño, sólo mayorista, 300 productos en 8 rubros con presentaciones, 80 clientes B2B en 4 zonas, 2 vendedores, 1 repartidor, 6 proveedores con deuda y una OC pendiente, Caja 1, Caja 2 y principal abiertas, lotes con vencimientos próximos.
- Usuarios de prueba: dueño, supervisor, mostrador, preventista y repartidor; botón **Reiniciar demo**; ARCA en homologación.
- Recorrido guiado: pedido del preventista → aprobación por crédito → picking y remito → reparto y cobranza → rendición → cierre → Resumen.
- Paridad con **Kini Distribuidora** actual antes de agregar lo nuevo.

## Fases propias (después de las fases 1–3 del PROMPT 1)
- **M1:** perfil mayorista, presentaciones, listas, escalones, acuerdos y `priceResolve` con pruebas (paridad Kini).
- **M2:** clientes B2B, crédito, vencimientos y cobranzas.
- **M3:** pedidos de venta, catálogo B2B y app del preventista (offline).
- **M4:** depósito, picking, remitos, lotes FEFO y kits.
- **M5:** reparto, hoja de ruta, cobranza en calle y rendición.
- **M6:** compras con recepción por lote, tesorería y bancos.
- **M7:** fiscal, contabilidad y reportes mayoristas.

## Formato de cada entrega
El mismo del PROMPT 1 (diagnóstico, decisión, árbol, código completo, pruebas, checklist de paridad).
