# PROMPT 2 · «Sistema VB · Edición Empresas» (demo raveV3)

> **Requisito:** usá completo el **PROMPT 1 (Plataforma Sistema VB v4)**: rol, principios, stack, estructura, sistema de diseño, App Shell y forma de trabajo. Este prompt sólo agrega lo propio de la edición para **empresas**. No dupliques código: todo se resuelve como **módulos y perfil de tenant** sobre la misma plataforma.

---

## Rol (además del PROMPT 1)
Sumá experiencia como **arquitecto de ERP para PyMEs y empresas medianas** (multi-sucursal, depósitos, distribución, tesorería, cumplimiento fiscal argentino) y como **diseñador de tableros ejecutivos**.

## Contexto
- **raveV3** (hoy `raveholding.github.io/raveV3`, perfil `v3` de `fuente/build.py`) es la demo más completa: incluye el **Centro inteligente** y el equipo de agentes **SVB R2AVE** (`fuente/p10-centro.js`, `p10b-r2ave.js`, `p10c-vivo.js`) además de todo lo del sistema base.
- Objetivo: convertirla en la **edición Empresas** de la plataforma (perfil `empresas-v3`), para vender a empresas con varias sucursales, depósitos y equipos grandes. Sigue siendo una **demo** con datos ficticios.

## Perfil de tenant `empresas-v3`
- Marca: «Sistema VB · Empresas» (acento ámbar de VB), empresa ficticia **«Grupo Demo S.A.»**: 3 sucursales, 1 depósito central, 40 empleados, 2 razones sociales (CUIT distintos), 1.500 productos, 400 clientes (minoristas y mayoristas), 12 meses de historial.
- Todos los módulos del PROMPT 1 activos + los de abajo.

## Módulos adicionales de la edición Empresas
1. **Estructura multiempresa:** razones sociales, sucursales, depósitos, cajas y puntos de venta ARCA por sucursal; usuario con acceso a una o varias sucursales; selector de contexto en la topbar.
2. **Stock multi-depósito:** transferencias entre depósitos y sucursales con remito y recepción, stock en tránsito, reposición sugerida por velocidad de venta, lotes y vencimientos, conteos cíclicos con diferencias aprobadas.
3. **Compras:** solicitud → orden de compra → recepción → factura de proveedor (control de 3 vías), cuentas por pagar con vencimientos, comparativo de precios de proveedores.
4. **Ventas empresa y distribución:** listas de precios por canal, presentaciones (unidad/display/fardo/pallet), acuerdos por cliente, crédito con límite y aprobación, preventa y **hoja de ruta** de reparto, remitos, cobranzas en calle.
5. **Tesorería:** cajas y bancos, cheques (en cartera, depositados, rechazados), **conciliación** con Mercado Pago y extractos bancarios (CSV/OFX), flujo de fondos a 30/60/90 días.
6. **Facturación ARCA completa** con **sv.arca.sdk**: Factura A/B/C, NC/ND, múltiples puntos de venta, consulta de padrón por CUIT, libro IVA ventas/compras exportable, alertas de vencimiento del certificado.
7. **RR. HH.:** legajos (cifrados), fichaje por QR/PIN/NFC con geocerca opcional, turnos, ausencias y licencias, horas extra, pre-liquidación exportable al estudio contable.
8. **Aprobaciones y controles:** flujos configurables (descuentos > X %, anulaciones, ajustes de stock, crédito), doble control en cierres, auditoría consultable y exportable.
9. **Centro inteligente + agentes SVB R2AVE:** panel de alertas accionables (quiebres de stock, caídas de venta, fraude/anomalías de caja, clientes que se van) y asistentes por área usando la **API de Claude** desde Edge Functions, con: datos mínimos y anonimizados, registro de cada consulta, límite de costo mensual por tenant y modo «sugerir, no ejecutar» salvo aprobación humana.
10. **BI y tableros:** ventas por sucursal/canal/categoría/vendedor, margen, rotación, ticket promedio, cohortes de clientes, comparativos interanuales; exportación a Excel/CSV y envío programado por correo.
11. **Integraciones:** Mercado Pago (cobros y conciliación), Tienda Nube (catálogo y pedidos), PedidosYa, WhatsApp/Telegram (avisos y bots), API REST pública con **claves por tenant y webhooks firmados** (`packages/api`, documentada con OpenAPI).
12. **Seguridad empresa:** roles granulares por módulo y acción, inicio con Google Workspace, 2FA para administradores, sesiones por dispositivo con cierre remoto, política de contraseñas, registro de accesos.

## Diseño (además del sistema de diseño del PROMPT 1)
- Modo **compacto** por defecto para backoffice; tablas densas con columnas configurables, filtros guardados, edición en línea y acciones masivas.
- **Tableros ejecutivos** con tarjetas KPI (valor, variación, minigráfico), una pregunta por gráfico, colores accesibles y modo presentación.
- Vistas maestro-detalle (lista + panel lateral) para documentos: órdenes, remitos, facturas.

## Demo y venta
- Recorridos guiados por rol: Dueño (tableros y Centro inteligente), Encargado de sucursal (caja, stock, personal), Administración (compras, tesorería, ARCA), Vendedor (preventa y reparto).
- Botón **Reiniciar demo**; integraciones y ARCA en **modo homologación/simulado**; nada real.

## Fases propias (después de las fases 1–3 del PROMPT 1)
- **E1:** multiempresa, sucursales y depósitos + selector de contexto.
- **E2:** stock multi-depósito y compras con 3 vías.
- **E3:** distribución, crédito y reparto.
- **E4:** tesorería y conciliación.
- **E5:** ARCA completo con sv.arca.sdk.
- **E6:** RR. HH. y aprobaciones.
- **E7:** Centro inteligente, agentes y BI.
- **E8:** API pública, webhooks e integraciones.
Cada fase con pruebas (Vitest, Playwright y pgTAP), capturas claro/oscuro y checklist de paridad contra raveV3.

## Formato de cada entrega
El mismo del PROMPT 1 (diagnóstico, decisión, árbol, código completo, pruebas, checklist).
