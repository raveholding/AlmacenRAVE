# 0 · INVENTARIO FUNCIONAL Y CHECKLIST DE PARIDAD · Sistemas Vincular Business (al 2026-11-12, V26.67)

> **Para qué sirve:** es la lista de TODO lo que ya existe en los sistemas de Vincular Business. La plataforma v4 no sale a producción hasta que **cada línea** de este documento tenga su prueba automática en verde (o una decisión escrita del dueño de dejarla afuera).
> **Cómo se usa:** en la Fase 0, Claude convierte cada línea en una fila de `docs/checklist-paridad.md` con: regla → archivo de origen → prueba v4 → estado.
> **Fuentes:** relevadas del código real, no de memoria. Si algo de acá no aparece en el código, se marca `[VERIFICAR]` y se pregunta: no se inventa.

## Fuentes de verdad
| Sistema | Repo | Cómo se arma | Qué aporta |
|---|---|---|---|
| Núcleo ERP/POS (AlmacenRAVE, raveV3, Kini, raveV2) | `raveholding/AlmacenRAVE` → `fuente/` | `fuente/build.py` (`cliente`, `v3`, `kini`, `solo`, `demo`) | 55 módulos `p*.js`, 25 migraciones `supabase/*.sql`, ~80 pruebas `fuente/pruebas/*.py`, 675 pruebas SQL |
| Especificación maestra | `AlmacenRAVE/fuente/SISTEMA_VB_26F.md` | 2.300 líneas, secciones 4.1–4.32, 5.1–5.24, 6, anexos A–AF | Reglas de negocio, decisiones, lecciones aprendidas |
| raveV3 (empresas + asistentes) | `raveholding/raveV3` | build `v3` + `PROMPT_DEMO_RAVEV3_ASISTENTES.md` + `propuestas/S1-seguridad-*.sql` | Centro inteligente, equipo SVB R2AVE, centro vivo 2D/3D, principio rector de integridad, esquema de seguridad integrada |
| Mayorista | `raveholding/KiniDistribuidoraDemo` | build `kini` | Distribuidora de un solo dueño, sólo mayorista, presentaciones |
| Seguridad física | `raveholding/SistemasVBSeguridadIntegral` y `SeguridadRave` | Node.js + go2rtc + Electron + firmware ESP32 | Cámaras, accesos, alarmas, video portero, analítica de video |
| Estudio contable | `raveholding/VBContabledemo` | HTML5 + `servidor/vb-api.mjs` | Contabilidad, impuestos, ARCA, cartera de clientes del estudio |
| Plataforma SaaS VB | `raveholding/SistemaIntegralSVB` | Next.js 15 + Supabase + FastAPI + agente Node | Monitor de infraestructura, documentos y contratos, suscripciones, CMS, portal de autogestión |
| Facturación propia | `raveholding/SVBARCA` (privado) | sv.arca.sdk | WSAA/WSFE con certificado propio |

---

## A. Núcleo operativo (POS, caja y dinero)
**Vender (POS)** — `p3b-pos.js`, `p3n-posquick.js`, `p3e-saledetail.js`, `p3j-combos.js`, spec 4.2, 4.20, anexo N
- Búsqueda por nombre, código, PLU, **precio** y categoría; lector de códigos USB sin doble conteo; cursor vuelve solo al buscador; ventas rápidas con atajos.
- Cambiar precio y **crear artículo sin salir** de Vender (con permiso); combos y packs; productos pesables (u/kg/l, EAN-13 de balanza, cantidad × precio × importe enlazados).
- Ticket con − / +, quitar, nota; cliente del ticket; canal minorista/mayorista por operación; descuentos, cupones, membresías, monedero, gift card; un solo beneficio por compra.
- **Cobro:** efectivo con **importe recibido obligatorio**, «Justo» y vuelto; transferencia/alias, QR, **MODO**, débito, crédito (cuotas), **pago mixto** con suma exacta, **cuenta corriente parcial**, fiado; **recargo o descuento por medio de pago** (% o monto, sólo admin, aviso Ley 25.065); a qué **cuenta de cobro** entró cada cobro digital (`p3m-payacc.js`); **detalle del cobro digital** (comprobante, últimos 4, lote/cupón) (`p3g-paydetail.js`).
- Atajos actuales: **F1** Vender, **F12** al importe recibido, Enter cobra, `Ctrl+K` buscador global. Ticket interno o factura ARCA; ticket 80 mm impreso o por WhatsApp; anulación y devolución parcial con permiso.
- Venta sin conexión con numeración por equipo y sincronización idempotente.

**Caja, cajas y sucursales, arqueo y cierres** — `p3c-cash.js`, `p3i-rubcash.js`, `p3f-transfers.js`, `p3q-cortes.js`, `p3r-oper.js`, `p3h-expediente.js`, spec 4.5, 4.14, 4.23, 4.24, 4.27, anexo S
- Apertura con fondo, ingresos y egresos con **rubro financiero obligatorio**, **cortes X/Z**, apertura del cajón, caja sin límite de operaciones.
- Cajas operativas + **caja principal**, multisucursal, **consolidado del día**, **traspasos de fondos controlados** con reglas (aprobación, motivo), traspasos del dueño.
- Arqueo por denominación, diferencias justificadas, **cierre sellado con hash (integridad)**, historial de cerradas, reapertura controlada.
- **Cierre por rubro** (cada rubro es una persona): ingreso/egreso a la caja del rubro, reparto de ganancia, sueldo compartido, impuesto separado; reporte de cierre para WhatsApp.
- **Expediente digital de la transacción**: todo lo que pasó con una venta/movimiento (quién, cuándo, medios, impacto en caja y en gestión).

**Presupuestos, mermas y devoluciones** — `p3r-oper.js`, anexo T: presupuestos que pasan a venta, mermas con motivo, devoluciones parciales con impacto en stock y caja.

## B. Catálogo, stock y compras
**Inventario** — `p3-ops.js`, `p2b-sort.js`, spec 4.4, 4.4.1, 4.16, 5.1: categorías/rubros, búsqueda y orden en todas las tablas, stock mínimo, movimientos (no se envía stock: se envían deltas), costos con recargo o margen, **eliminación protegida** (sólo admin, archivo vs. borrado), etiquetas EAN-13, balanza Systel/Kretz (`p7c-scale.js`).
**Proveedores y compras** — `p4c-compras.js`, `p4d-compras-ui.js`, spec 4.21: proveedores, **órdenes de compra**, **carga de remito** (ingreso atómico con costo), **cuenta corriente de proveedores**, pagar desde la caja elegida, **lectura de facturas con IA** (opcional, sólo admin, revisión humana).
**Importar / exportar todo** — spec 4.9: CSV (`;`, UTF-8 con BOM) o Excel, lote importado auditable, migración desde el sistema anterior.

## C. Clientes, fidelización y ventas a crédito
- **Clientes** (`p6c-custadmin.js`): ficha, datos personales cifrados, consentimientos, **datos para facturar** (CUIT, razón social, condición IVA, domicilio fiscal) precargados al cobrar con ARCA, WhatsApp con saldo o aviso, baja que revoca la tarjeta.
- **Club y sellos** (`p6-loyalty.js`, `p6h-fidel.js`): tarjeta modelo del negocio, reglas, premios, **sumar sello por QR, código de un solo uso, DNI, NFC (lector USB o Android) y chip NFC del mostrador** (`p7d-nfc.js`, `p6k-sellonfc.js`), un sello cada 24 h, alta desde el menú público, socios importados solos.
- **Tarjeta digital** (`p6d-cardportable.js`): guardarla, verla a pantalla completa, recuperarla, Apple/Google Wallet (`p6e-wallet.js`).
- **Niveles por consumo, cumpleaños automático, ruleta y trivia** (`fidplus`), **cupones y membresías**, **monedero digital, cashback, gift cards y vouchers**, «Día de Cuenta Comercio».
- **Fiado y cuenta corriente** (`p6f-credito.js`): límite, plazo, vencimientos FIFO, antigüedad, bloqueo, excepción autorizada, cobros por rubro.
- **CRM / Atención al cliente** (`p6j-crm.js`): bandeja omnicanal (WhatsApp, web, menú), analíticas, campañas, **alertas del ERP**, contacto entrante cifrado.
- **WhatsApp al cliente** (`p6g-wacliente.js`).

## D. Mayorista / distribuidora
`p6b-wholesale.js`, `p3l-kini.js`, `p3k-owner.js`, spec 4.22, 4.29, anexo L
- Modelo de negocio: **por rubros con responsable** o **un solo dueño**; canales: sólo minorista / minorista y mayorista / **sólo mayorista**.
- **Presentaciones** (unidad, display, fardo, pallet) con precio mayorista al completar la presentación, listas por canal, **acuerdos por cliente**, escalones por cantidad, crédito con plazo y revisión del servidor, CUIT obligatorio para cuenta corriente, zona y vendedor.
- Especificado y **pendiente** (spec 4.22.0): pedidos de venta, picking, remito con constancia, lotes y vencimientos FEFO, kits, matriz talle/color, trazabilidad inversa, reportes por canal/zona/vendedor.

## E. Fiscal y contable
- **Facturación electrónica ARCA** (`p4e-factura.js`, `p6i-fiscal.js`, `p9b-arca.js`, spec 4.12): asistente de certificado por ambiente, CAE automático por servidor con cola e idempotencia, QR fiscal en el ticket, A/B/C, NC/ND. Motor propio: **sv.arca.sdk** (`SVBARCA`).
- **Impacto contable** de cada movimiento (expediente) y **trazabilidad administrativo-contable** del mayorista (spec 4.22).
- **Estudio contable** (`VBContabledemo`): cartera de clientes (monotributistas, RI, sociedades, personas humanas), bandeja (Domicilio Fiscal Electrónico, vencimientos, credenciales), agenda por terminación de CUIT, **comprobantes emitidos/recibidos con asiento automático y anulación**, importación de «Mis Comprobantes», carga por foto con IA, **liquidación de IVA** (saldo técnico y de libre disponibilidad), **Ingresos Brutos** (local y Convenio Multilateral), **Ganancias**, **Monotributo** (topes y recategorización), retenciones y percepciones, DDJJ simuladas con VEP, CCMA, SCT, Libro IVA Digital, honorarios y cobranzas, reportes con la marca del estudio, roles Administrador/Secretaria, API para empresas.

## F. Personas
- **Personal y fichaje** (`p4f-rrhh.js`): terminal/kiosco de fichaje por **PIN, QR (lector o cámara) y NFC**, credenciales imprimibles y revocables.
- **Recursos Humanos** (plan micro / plan completo, anexo AC): legajos cifrados, turnos y licencias, fichaje, **reporte para el contador**, solicitudes, vacaciones, **nómina**, documentos y entregas (EPP, uniformes), **reclutamiento**, tablero, alertas.
- **Tareas y organigrama**; **usuarios y permisos por rol** (`roles`), sólo el administrador cambia permisos.

## G. Canales online y públicos
- **Menú público** (`p5-menu-boot.js`, `p5b-store.js`, `p5c-menusec.js`, spec 4.26, 4.30, 7): menú local o **tienda con envíos**, secciones editables, foto por producto, carrito con pedido por WhatsApp (solicitud, no venta), identidad y textos, contacto, mapa y reseñas, **Wi-Fi de clientes**, redes, accesos, SEO y Google.
- **Checkout online** opcional (spec 4.18) y **Tiendanube** (`p9c-tiendanube.js`, spec 4.28), **PedidosYa** (pedidos), **pantalla del cliente** (`p5d-cscreen.js`).

## H. Integraciones (`integ`)
Mercado Pago · MODO · PedidosYa · WhatsApp · Google (Drive, Gmail, Calendar, Business Profile) · cobros digitales pendientes por webhook · **cola de eventos asíncrona** · Tiendanube · ventas online (checkout) · Wallet y avisos automáticos · **Telegram: bot R2AVE** (`p10d-telegram.js`, consultas y corrección de stock en dos pasos, alertas a grupo) · pasos guiados para conectar cada una.

## I. Inteligencia y asistentes
- **Resumen (dashboard del administrador)** (`p7a-dash.js`, `p7b-charts.js`): ventas, metas, tendencias, categorías, medios de pago, más vendidos, alertas, acciones.
- **Asistente conversacional** texto y voz (`p3d-assist.js`, spec 4.13: ActionRegistry, confirmación, RBAC por herramienta).
- **Centro inteligente** (`p10-centro.js`): mapa 2D/3D del local, gerente IA, bajo protocolo de aislamiento.
- **Equipo SVB R2AVE** (`p10b-r2ave.js`) y **centro de operaciones vivo** (`p10c-vivo.js`): R2AVE, M2ARGOTH, T2ULUZ, S2HAKIRA (raveV3), principio rector de integridad.

## J. Seguridad física (SistemasVBSeguridadIntegral)
Cámaras en vivo de cualquier marca (ONVIF, RTSP, Dahua/DMSS, Hikvision, Uniview, Axis, Reolink, XMeye) vía go2rtc (WebRTC/MSE), grabaciones y PTZ · cerradura y portón (ESP32 + relé) · **video portero** · PIN de coacción, SOS 911 · pases QR/NFC, huella y rostro (sin guardar biometría en la nube) · analítica de video (patentes, EPP, caídas, merodeo, aglomeraciones, filtro fauna/clima) · aforo y geocercas · escenas del hogar · red de alerta vecinal · avisos con foto a Telegram · API REST, MQTT, Home Assistant (Alexa, Google, Siri), webhooks · panel adaptable (tablet de pared, celular, PC, monitor de cámaras) · instalador Windows/Linux y app Electron · esquema propuesto para integrarlo al ERP (`raveV3/propuestas/S1-seguridad-esquema.sql`: dispositivos, reglas de acceso por grupo × puerta × horario, eventos sólo-agregar con cadena de hash, sin claves en la base).

## K. Plataforma SaaS de VB (SistemaIntegralSVB)
Monitor de salud e infraestructura de los clientes (heartbeat, CPU/memoria/latencia, alertas a Telegram con ACK) · **gestor documental y de contratos** (PDF versionados con SHA-256, vencimientos 30/15/7) · **CRM de suscripciones** (abonos Esencial / Pro + IA, upgrade con prorrateo) · RR. HH. con metas y comisiones por tramos · **CMS / gestor web** (páginas, landings, leads) · **portal de autogestión del cliente** (estado, contrato, facturas, tickets) · auditoría con hash encadenado · agente de monitoreo para servidores de clientes.

## L. Dispositivos, apps y plataforma técnica
Periféricos y ticket (`p7-devices.js`): impresora térmica con cola y reintentos, ticket 80 mm editable, balanza, lector de códigos, **lector NFC** · app de escritorio/instalador Windows (`instalador/`) · PWA instalable · **nube** (`p9-cloud.js`): sincronización por colecciones, stock por deltas, cifrado de datos personales, ingreso con correo y Google (PKCE), **custodia de llave** (función `llave`), **restablecer acceso** con clave temporal, código de recuperación, multi-equipo y multi-caja · **auditoría** con hash encadenado · **legal y cumplimiento Argentina/Salta** (`p8-legal.js`) · configuración agrupada con buscador · tema Claro/Oscuro/Sistema · modo mostrador · atajos · respaldo y restauración.

## M. Perfiles actuales (qué trae cada uno hoy)
| Perfil | Organización | Canal | Extras |
|---|---|---|---|
| **AlmacenRAVE** (cliente) | rubros con responsable | minorista (mayorista activable) | menú QR licorería, Club con chip NFC, PedidosYa, Telegram R2AVE, Centro inteligente apagado |
| **raveV3** (demo empresas) | rubros / dueño | ambos | Centro inteligente + SVB R2AVE + centro vivo, catálogo corporativo de ejemplo |
| **Kini** (demo mayorista) | un solo dueño | sólo mayorista | presentaciones, cajas 1/2 + principal, pago a proveedores desde la caja elegida |
| **raveV2** (demo genérica) | un solo dueño | minorista | base genérica sin personalización |
