# PROMPT 2 · «Sistema VB · Edición Empresas» (demo raveV3)

> **Requisito:** usá completo el **PROMPT 1 (Plataforma Sistema VB v4)** con sus documentos obligatorios **`0-inventario-funcional-y-paridad.md`** y **`S-seguridad-obligatoria.md`**: rol, principios, stack, estructura, sistema de diseño, App Shell y forma de trabajo. Este prompt sólo agrega lo propio de la edición para **empresas**. No dupliques código: todo se resuelve como **módulos y perfil de tenant** sobre la misma plataforma.

---

## Rol (además del PROMPT 1)
Sumá experiencia como **arquitecto de ERP para PyMEs y empresas medianas** (multi-sucursal, depósitos, distribución, tesorería, cumplimiento fiscal argentino) y como **diseñador de tableros ejecutivos**.

## Contexto
- **raveV3** (hoy `raveholding.github.io/raveV3`, perfil `v3` de `fuente/build.py`) es la demo más completa: incluye el **Centro inteligente** y el equipo de agentes **SVB R2AVE** (`fuente/p10-centro.js`, `p10b-r2ave.js`, `p10c-vivo.js`) además de todo lo del sistema base.
- Objetivo: convertirla en la **edición Empresas** de la plataforma (perfil `empresas-v3`), para vender a empresas con varias sucursales, depósitos y equipos grandes. Sigue siendo una **demo** con datos ficticios.

## Perfil de tenant `empresas-v3`
- Marca: «Sistema VB · Empresas» (acento ámbar de VB), empresa ficticia **«Grupo Demo S.A.»**: 3 sucursales, 1 depósito central, 40 empleados, 2 razones sociales (CUIT distintos), 1.500 productos, 400 clientes (minoristas y mayoristas), 12 meses de historial.
- **Todos** los módulos del inventario activos (A a L, incluida seguridad física y contabilidad) + los de abajo. Paridad total con la demo raveV3 actual: Centro inteligente con mapa 2D/3D, equipo SVB R2AVE (R2AVE, M2ARGOTH, T2ULUZ, S2HAKIRA) con sus permisos y su principio rector (`raveV3/PROMPT_DEMO_RAVEV3_ASISTENTES.md`), centro de operaciones vivo, catálogo corporativo de ejemplo.

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
12. **Seguridad empresa:** todo `S-seguridad-obligatoria.md` + roles granulares por módulo, acción y sucursal, inicio con Google Workspace, passkeys, 2FA obligatorio para administradores, sesiones por dispositivo con cierre remoto, registro de accesos y alertas de seguridad.
13. **Seguridad física integrada (inventario J):** cámaras de cualquier marca en vivo y grabaciones, cerraduras y portones, video portero, PIN de coacción y SOS, pases QR/NFC para personal y visitas, analítica de video (patentes, EPP, merodeo, aforo), alarmas con foto a Telegram; reglas de acceso heredadas del ERP (personal activo, socios con membresía, visitas) por puerta y horario (esquema `raveV3/propuestas/S1-seguridad-esquema.sql`); fichaje de RR. HH. y accesos unificados; credenciales sólo en el gateway local.
14. **Contabilidad completa:** plan de cuentas configurable, asientos automáticos desde ventas, compras, caja, bancos, sueldos y ajustes; libro diario, mayor, balance de sumas y saldos, estado de resultados, centros de costo por sucursal; libro IVA ventas/compras, IIBB y Ganancias de referencia; cierre de período con bloqueo; exportación para el estudio contable (y conexión directa con el producto Estudio contable de VB, inventario E).
15. **Cobros y bancos:** todos los medios del inventario A + cuentas bancarias por razón social, conciliación automática (Mercado Pago, MODO, extractos CSV/OFX), cheques propios y de terceros, posnet por lote y cupón, liquidaciones de tarjetas con retenciones, cuotas y costo financiero.
16. **RR. HH. completo (inventario F):** todo lo de la demo actual (legajos, turnos, licencias, vacaciones, nómina, reclutamiento, documentos y entregas, reporte al contador, solicitudes, tablero y alertas) + evaluaciones de desempeño, metas y comisiones por tramos, capacitaciones, portal del empleado (recibos, solicitudes), integración con el fichaje y con los accesos físicos.
17. **Plataforma y servicio (inventario K):** monitor de salud de los equipos de la empresa, gestor documental y de contratos con vencimientos, portal de autogestión.

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
- **E9:** contabilidad, bancos y conciliación.
- **E10:** seguridad física integrada (gateway, cámaras, accesos).
- **E11:** RR. HH. completo y portal del empleado.
Cada fase con pruebas (Vitest, Playwright y pgTAP), capturas claro/oscuro y checklist de paridad contra raveV3.

## Formato de cada entrega
El mismo del PROMPT 1 (diagnóstico, decisión, árbol, código completo, pruebas, checklist).
