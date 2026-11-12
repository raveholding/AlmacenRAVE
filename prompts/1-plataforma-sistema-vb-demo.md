# PROMPT 1 · Plataforma «Sistema VB» v4 + Demo Vincular Business (sin personalización de cliente)

> Prompt base. Los prompts 2 (raveV3 · Empresas), 3 (AlmacenRAVE) y 4 (Mayorista genérico) **parten de este** y sólo agregan lo suyo.
> Usalo en Claude Code dentro del repo nuevo de la plataforma, con los repos de referencia disponibles (ver «Documentos obligatorios»).

## Documentos obligatorios (leer antes de escribir una línea)
1. **`0-inventario-funcional-y-paridad.md`**: TODO lo que ya existe (núcleo ERP/POS, raveV3, Kini, seguridad física, estudio contable, plataforma SaaS de VB). Es el alcance mínimo: nada de esa lista se pierde.
2. **`S-seguridad-obligatoria.md`**: anexo de seguridad. Manda sobre el diseño y los plazos.
3. **`AlmacenRAVE/fuente/SISTEMA_VB_26F.md`**: especificación maestra con reglas, decisiones (6.3) y lecciones aprendidas (14). Las decisiones ya tomadas no se reabren sin motivo escrito.
4. Repos de referencia: `raveholding/AlmacenRAVE` (núcleo), `raveV3`, `KiniDistribuidoraDemo`, `SistemasVBSeguridadIntegral`, `VBContabledemo`, `SistemaIntegralSVB`, `SVBARCA` (privado).
Si este prompt y esos documentos se contradicen, el orden es: **principio rector (S·0) → seguridad (S) → este prompt → inventario → maestro**.

---

## Rol
Actuá como **Staff Software Architect + Principal Product Designer** con más de 12 años construyendo **ERP, POS y SaaS B2B multi-tenant** para comercios de Latinoamérica (Argentina): facturación electrónica ARCA, medios de pago locales (efectivo, transferencia/alias, QR de Mercado Pago, débito/crédito con recargo, fiado/cuenta corriente), operación sin conexión, hardware de mostrador (lectores de código, NFC, impresoras térmicas) y diseño de interfaces de alta densidad operativa. Tomás decisiones con criterio de producción, justificás cada una en una línea y no agregás nada que no sume.

## Contexto
- **Vincular Business** («VB», Salta, Argentina · WhatsApp (387) 4484132 · vincularbusiness@gmail.com) desarrolla **sistemas de gestión integral personalizados** para comercios y empresas: gestión, digitalización y fidelización.
- Hoy existe un sistema maduro (versión **V26.67**) hecho como **una sola página HTML offline-first** en JavaScript, con Supabase y cifrado de punta a punta. Repo de referencia: `raveholding/AlmacenRAVE`.
  - **Especificación funcional «as-built»:** `fuente/SISTEMA_VB_26F.md` (con anexos por versión). Es la fuente de verdad de las reglas de negocio.
  - **Reglas de negocio en código:** `fuente/p*.js` (por ejemplo `p3b-pos.js` venta y cobro, `p6-loyalty.js` Club y sellos, `p7d-nfc.js` NFC, `p6k-sellonfc.js` sello por chip, `p9-cloud.js` nube y cifrado).
  - **Base de datos:** `supabase/01…25-*.sql` (RLS, RPC) y pruebas en `supabase/tests`.
  - **Pruebas de comportamiento:** `fuente/pruebas/*.py` (Playwright): describen lo que el sistema TIENE que seguir haciendo.
- **Objetivo:** construir la **plataforma v4 «Sistema VB»**: una sola base de código, multi-tenant, con **perfiles por cliente** (marca, módulos, rubros, textos), de aspecto SaaS profesional, que reemplace al sistema actual **sin perder ninguna función** y sea la base de todos los sistemas de VB.
- **Este prompt entrega la plataforma + la demo genérica «Sistema VB»** (comercio ficticio, sin marcas reales), que se usa para vender.

## Principios no negociables
1. **Paridad funcional antes que novedades.** Nada que hoy funcione puede perderse. Antes de cada módulo, tomá sus líneas del inventario (`0-…`), sus reglas de `SISTEMA_VB_26F.md` y del código de origen, y convertí cada una en una prueba.
2. **Offline-first real.** Vender, cobrar, abrir/cerrar caja y sumar sellos sin internet; sincroniza al volver, sin duplicar ventas (idempotencia por `id` de cliente + outbox).
3. **Seguridad según `S-seguridad-obligatoria.md`** (ASVS nivel 2, nivel 3 en llaves, pagos, fiscal y seguridad física): RLS y prueba A/B en todo, 2FA para administradores, datos personales cifrados en el navegador (compatible con el modelo actual), secretos sólo en el servidor, auditoría con hash encadenado, modelo de amenazas por módulo.
4. **Multi-tenant por configuración, no por forks.** Cada cliente es un perfil (`tenants/<slug>`): marca, paleta, módulos activos, rubros/categorías, textos, integraciones. Cero `if (cliente === 'x')` en el código.
5. **Accesibilidad AA y es-AR.** Contraste AA en claro y oscuro, foco visible, teclado completo, objetivos de 44 px, `Intl` es-AR (ARS, fechas, CUIT/DNI).
6. **Rendimiento:** LCP < 2,5 s, INP < 200 ms, CLS < 0,1. Listas grandes virtualizadas. Bundle por ruta.
7. **Costo:** herramientas gratuitas u open source. Lo pago, sólo donde no hay alternativa razonable y avisado (ver «Infraestructura»).

## Stack (verificado a noviembre de 2026; confirmar versiones con `npm view` al iniciar)
| Capa | Elección | Por qué |
|---|---|---|
| Monorepo | **pnpm + Turborepo** | apps y paquetes compartidos, caché de builds |
| App y web | **Next.js 16 (App Router) + React 19 + TypeScript `strict`** | RSC para lo público/SEO, cliente para el POS |
| Estilos | **Tailwind CSS v4** (configuración en CSS, `@theme`, colores OKLCH) | tokens por tenant con variables CSS |
| Componentes | **shadcn/ui (CLI v4)** sobre Radix o Base UI + **lucide-react** | accesibles, propios (copy-and-own) |
| Animación | **motion** (ex Framer Motion) | `layoutId` en pestañas, transiciones de paneles |
| Datos UI | **TanStack Query, Table y Virtual**; **react-hook-form + zod** | cache, tablas densas, formularios tipados |
| Estado POS | **Zustand** | carrito y caja rápidos, persistentes |
| Offline | **Dexie (IndexedDB) + outbox de sincronización propia** contra RPC de Supabase; **Serwist** para el service worker (PWA instalable) | gratis y sin proveedor; alternativa evaluada: PowerSync (su plan gratis se desactiva tras una semana sin uso; Open Edition autoalojada) |
| Backend | **Supabase**: Postgres, Auth (correo + Google), RLS, RPC, Edge Functions, Realtime, Storage; **Supabase CLI** para migraciones y **pgTAP** para pruebas SQL | ya se usa y se conoce |
| Calidad | **Vitest + Testing Library**, **Playwright** (e2e, también offline), **Biome** (lint + formato), **axe** (accesibilidad) | |
| CI/CD | **GitHub Actions** (lint, tipos, pruebas, pgTAP, Lighthouse CI) + previews por PR | |
| Observabilidad | **Sentry** (plan gratis) y **PostHog** (plan gratis, sin datos personales) | |
| Gráficos | **Recharts** vía shadcn charts | |
| Hardware | Lector de códigos y **NFC USB en modo teclado** (escucha global, como `p7d-nfc.js`), **Web NFC** en Android, **BarcodeDetector** con cámara, impresora térmica **ESC/POS** por WebUSB/WebSerial con respaldo de impresión CSS | |
| Facturación | **sv.arca.sdk** (SDK propio de VB, repo `SVBARCA`) detrás de una Edge Function; nunca credenciales en el navegador | |

### Infraestructura y costos (decidir y dejar escrito)
- **Desarrollo y previews: gratis.**
- **Producción comercial:** Vercel **Hobby no sirve** (es sólo para uso personal, no comercial). Opciones: **Cloudflare Workers con OpenNext** (plan pago desde USD 5/mes, porque el gratis limita a 3 MiB y 10 ms de CPU) o **Vercel Pro** (USD 20/mes). Recomendado: Cloudflare.
- **Supabase:** el plan gratis pausa el proyecto tras 7 días sin actividad → producción en **Pro** (USD 25/mes; ya lo usa AlmacenRAVE). Demo en plan gratis con un ping programado.
- Sitios públicos (menú, catálogo) como páginas estáticas/ISR: costo casi cero.

## Estructura
```
sistema-vb/
  apps/
    app/        # Sistema (PWA) por tenant (dominio de VB a definir) → panel, POS, módulos
    web/        # Sitio de Vincular Business + sitios públicos por cliente (menú QR, catálogo, turnos, tarjeta del Club)
    gateway/    # Agente local (127.0.0.1): impresora ESC/POS, balanza, cajón, cámaras (go2rtc), cerraduras ESP32; emparejado y firmado
    desktop/    # Empaquetado de escritorio (Tauri o Electron) para mostradores Windows
    vb-admin/   # Interno de VB: tenants, suscripciones, monitor, documentos, soporte (sin acceso a datos cifrados)
  packages/
    ui/         # Design system: tokens, componentes shadcn personalizados, AppShell, íconos
    core/       # Reglas de negocio PURAS en TS (precios, recargos, vuelto, cierre, sellos, códigos de un solo uso, stock, IVA) + pruebas
    db/         # Tipos generados de Supabase, cliente server/browser, outbox Dexie, cifrado
    tenants/    # Perfiles: demo-vb, empresas-v3, almacenrave… (marca, módulos, rubros, textos, integraciones)
    config/     # tsconfig, biome, tailwind preset
  supabase/     # migraciones numeradas, seeds por perfil, pgTAP
  docs/         # ADR (decisiones), mapa de módulos, checklist de paridad
  CLAUDE.md     # reglas para trabajar en el repo (este prompt resumido)
```
Dentro de `apps/app/src/features/<módulo>/` cada módulo encapsula `components/`, `hooks/`, `actions/`, `schemas/`, `types.ts` y pruebas. Lo compartido entre 2+ módulos sube a `packages/`.

## Sistema de diseño
- **Tokens semánticos** (`--background`, `--foreground`, `--card`, `--muted`, `--border`, `--primary`, `--primary-foreground`, `--success`, `--warning`, `--destructive`, `--ring`) en OKLCH.
  - Oscuro: fondo `#0F1115`, tarjetas `#181A20`, bordes `#262932`.
  - Claro: fondo `#F8FAFC`, tarjetas `#FFFFFF`, bordes `#E2E8F0`.
  - **Acento del tenant** (demo: ámbar `#F59E0B` / `#D97706`) validado AA en ambos temas; si no pasa, se ajusta la luminosidad automáticamente.
- Tema **Claro · Oscuro · Sistema** con `next-themes`, sin parpadeo.
- Tipografía: **Geist o Inter** (UI) + **Geist Mono** (montos y códigos), cifras tabulares en importes.
- Densidad **cómoda / compacta** por usuario. Radios 10–14 px, sombras sutiles, grilla de 4 px.
- Estados obligatorios en cada vista: cargando (skeleton), vacío (con acción), error (con reintento), sin conexión (banner + cola pendiente).
- Movimiento: sólo `transform`/`opacity`, 150–250 ms, respetando `prefers-reduced-motion`.

### App Shell
- **Sidebar** 240 px / 68 px colapsado (se recuerda por usuario y equipo), animado con motion, grupos en versalitas:
  RESUMEN (Resumen, Centro inteligente) · OPERACIÓN (Vender, Pedidos, Caja, Cajas y sucursales, Arqueo/cierre, Inventario, Proveedores y compras) · CLIENTES Y FIDELIZACIÓN (Clientes, Fidelización, Monedero y gift cards) · EQUIPO Y SISTEMA (Personal y fichaje, Menú público, Nube, Configuración).
  Los grupos y módulos visibles salen del perfil del tenant y de los permisos del rol. Pie: logo del cliente arriba, «Desarrollado por Vincular Business» abajo.
- **Topbar 56 px:** colapsar, migas de pan (`Operación / Vender`), buscador `Ctrl/Cmd+K` (CommandDialog: módulos, productos, clientes, acciones), sucursal/caja, estado de caja, estado de sincronización, tema, notificaciones, usuario.
- **Celular:** barra inferior (Vender, Caja, Clientes, Más) y hojas (sheets) en vez de modales.

### Pantalla «Vender» (referencia visual: catálogo con fotos a la izquierda, ticket a la derecha, botón dorado «Cobrar $ total»)
- Catálogo ≈65 %: pestañas de categorías del tenant + Favoritos (animadas), buscador instantáneo que acepta lector de código y no se confunde con el lector NFC, grilla de tarjetas (imagen, nombre en 2 líneas, precio ARS, stock y alerta de bajo stock), atajos numéricos.
- Ticket ≈35 % fijo con scroll propio: líneas con − / +, quitar, nota; cliente del ticket (por búsqueda, QR, DNI o tarjeta NFC); sello del Club, cupón, monedero; Subtotal, Descuentos, Recargos, **Total** (`aria-live`).
- **Cobrar** con los atajos actuales (**F12** al importe recibido, Enter cobra; agregar `Ctrl+Enter`; en la PWA instalada F12 no abre herramientas): efectivo con **importe recibido obligatorio**, «Justo» y vuelto, transferencia/alias, QR, débito/crédito con recargo configurable, **pago mixto**, fiado/cuenta corriente con límite, factura ARCA opcional, ticket impreso o por WhatsApp.
- Todo funciona sin conexión.

## Módulos
**El alcance es el inventario completo (`0-inventario-funcional-y-paridad.md`, secciones A a L), sin recortes.** Cada módulo es un paquete activable por tenant:
- **Núcleo (siempre):** Resumen · Vender (POS) · Caja, cajas y sucursales, arqueo y cierres (por rubro, X/Z, traspasos, expediente) · Inventario · Proveedores y compras · Presupuestos, mermas y devoluciones · Clientes · Usuarios y permisos · Auditoría · Configuración · Importar/exportar · Respaldo · Periféricos · Legal.
- **Comerciales:** Club y fidelización completa (sellos por QR/código/DNI/NFC y chip del mostrador, niveles, cumpleaños, juegos, cupones, membresías, monedero, cashback, gift cards, Wallet) · Fiado y cuenta corriente · Mayorista/distribuidora · CRM omnicanal · Menú público, tienda y checkout · Pedidos (WhatsApp, PedidosYa, Tiendanube).
- **Cobros y bancos:** todos los medios actuales + cuentas de cobro por socio, detalle del cobro digital, recargos por medio, conciliación de Mercado Pago/MODO/bancos (extractos CSV/OFX), cheques.
- **Fiscal y contable:** Facturación ARCA con **sv.arca.sdk** · **Contabilidad** (plan de cuentas, asientos automáticos desde ventas, compras, caja y bancos, libro diario y mayor, balance, libro IVA ventas/compras, IIBB, exportación al estudio) · **Estudio contable** como producto propio (inventario E).
- **Personas:** Personal y fichaje (PIN, QR, NFC) · RR. HH. micro y completo (legajos, turnos, licencias, vacaciones, nómina, reclutamiento, documentos, reporte al contador) · Tareas y organigrama.
- **Inteligencia:** Asistente texto/voz (ActionRegistry) · Centro inteligente y equipo SVB R2AVE · bot de Telegram · lectura de facturas con IA.
- **Seguridad física (opcional):** cámaras, accesos, video portero, alarmas y analítica (inventario J), integrado al ERP con el esquema S1 y un **gateway local**.
- **Plataforma VB (interno de Vincular Business):** monitor de clientes, documentos y contratos, suscripciones, CMS y portal de autogestión (inventario K).

## Sitio web (`apps/web`)
1. **Sitio de Vincular Business:** inicio, soluciones por rubro (almacén y licorería, gastronomía, barbería, gimnasio, estudio contable, distribuidora), casos (con permiso), precios/planes, demo en vivo, contacto por WhatsApp, blog. SEO local Salta/Argentina, schema.org (`Organization`, `LocalBusiness`, `SoftwareApplication`), Open Graph, `sitemap.xml`, `robots.txt`, `llms.txt`.
2. **Sitios públicos por cliente** (`/<tenant>`): menú QR/catálogo con carrito y pedido por WhatsApp, turnos, tarjeta digital del Club, sumarse al Club, punto de sello por chip NFC/QR. Estáticos/ISR, ultra livianos, con la marca del cliente.

## Demo «Sistema VB» (perfil `demo-vb`)
- Comercio **ficticio** («Almacén Demo»), sin marcas ni personas reales; productos y fotos genéricas con licencia libre.
- Datos de ejemplo realistas: 120 productos en 8 categorías, 60 clientes, 3 meses de ventas, 2 cajas, 6 empleados, Club con sellos y premios.
- Banner «Demo» discreto, botón **Reiniciar demo**, usuarios de prueba por rol (admin, supervisor, mostrador), integraciones en modo simulado.
- Pensada para vender: un recorrido guiado de 3 minutos (Vender → Cobrar → Club → Cierre → Resumen).

## Forma de trabajo (para cuidar tiempo y consumo)
Trabajamos por **fases chicas con criterio de aceptación**. En cada fase: 1) plan corto (archivos a tocar, riesgos), 2) implementación, 3) pruebas, 4) capturas claro/oscuro y celular, 5) PR con resumen. No reescribas lo que no se pidió; no generes código de relleno.
- **Fase 0 · Relevamiento:** leer los documentos obligatorios y el código de origen; entregar `docs/checklist-paridad.md` (cada línea del inventario → regla → archivo de origen → prueba v4), `docs/mapa-modulos.md`, modelos de amenazas por módulo, el esquema de datos v4 y los ADR (stack, offline, cifrado, multi-tenant, hosting). **No se programa hasta aprobar la Fase 0.**
- **Fase 1 · Base:** monorepo, CI, design system (`packages/ui`), AppShell, tema, auth (correo + Google), perfiles de tenant, permisos, demo con datos.
- **Fase 2 · Operación:** Vender + Cobro + Caja + Arqueo **offline** con outbox y pruebas e2e sin red.
- **Fase 3 · Clientes y Club:** clientes, Club, sellos (incluye NFC y chip del mostrador), cupones, monedero.
- **Fase 4 · Inventario, compras, mayorista, fiado.**
- **Fase 5 · Cobros y bancos, ARCA y contabilidad.**
- **Fase 6 · RR. HH., pedidos, CRM e integraciones.**
- **Fase 7 · Inteligencia** (asistente, Centro inteligente, R2AVE, Telegram).
- **Fase 8 · Seguridad física** (gateway, cámaras, accesos) — opcional por tenant.
- **Fase 9 · Web pública, sitio de VB y plataforma interna (vb-admin).**
- **Fase 10 · Migración de datos** (importador desde el respaldo del sistema actual), revisión de seguridad independiente y salida a producción con autorización del dueño.
Mantené `CLAUDE.md` y `docs/` al día con cada decisión.

## Formato de cada entrega
1. **Diagnóstico** (qué hay, qué falta, riesgos).
2. **Decisión** de arquitectura (una línea por qué).
3. **Árbol de archivos** tocados.
4. **Código completo** (TypeScript estricto, sin `any`, sin placeholders).
5. **Pruebas** y cómo correrlas.
6. **Checklist de paridad** actualizado y próximos pasos.
