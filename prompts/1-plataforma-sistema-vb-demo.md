# PROMPT 1 · Plataforma «Sistema VB» v4 + Demo Vincular Business (sin personalización de cliente)

> Prompt base. Los prompts 2 (raveV3 · Empresas) y 3 (AlmacenRAVE) **parten de este** y sólo agregan lo suyo.
> Usalo en Claude Code dentro del repo nuevo de la plataforma, con el repo `raveholding/AlmacenRAVE` disponible como referencia.

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
1. **Paridad funcional antes que novedades.** Nada que hoy funcione puede perderse. Antes de cada módulo, listá sus reglas desde `SISTEMA_VB_26F.md` y `fuente/p*.js` y convertí cada una en una prueba.
2. **Offline-first real.** Vender, cobrar, abrir/cerrar caja y sumar sellos sin internet; sincroniza al volver, sin duplicar ventas (idempotencia por `id` de cliente + outbox).
3. **Seguridad.** RLS en todas las tablas; operaciones sensibles sólo por RPC `security definer` con chequeo de rol; **datos personales cifrados en el navegador** (Web Crypto, AES-GCM con llave de datos envuelta por usuario, mismo modelo que hoy para poder migrar); auditoría append-only; nunca secretos en el cliente.
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
- **Cobrar** con **F9** y `Ctrl+Enter` (F12 abre las herramientas del navegador): efectivo con vuelto, transferencia/alias, QR, débito/crédito con recargo configurable, **pago mixto**, fiado/cuenta corriente con límite, factura ARCA opcional, ticket impreso o por WhatsApp.
- Todo funciona sin conexión.

## Módulos (mapa completo; cada uno con su checklist de paridad)
Resumen · Centro inteligente · Vender (POS) · Pedidos (WhatsApp, PedidosYa, menú) · Caja y movimientos · Cajas y sucursales · Arqueo y cierre (con sello de integridad) · Inventario (stock, mermas, devoluciones, conteos) · Proveedores y compras · Presupuestos · Clientes (ficha, CRM liviano, consentimientos) · Fidelización (Club, sellos con QR/código/DNI/NFC, **sello por chip NFC del mostrador**, cupones, premios) · Monedero y gift cards · Mayorista (presentaciones, acuerdos, crédito) · Fiado y cuenta corriente · Facturación ARCA · Personal y fichaje (QR, PIN, NFC) y RR. HH. · Menú público y web · Nube, usuarios y permisos (Google, restablecer acceso, custodia de llaves) · Configuración (agrupada, con buscador) · Auditoría · Reportes y exportaciones · Respaldo y restauración.

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
- **Fase 0 · Relevamiento:** leer `SISTEMA_VB_26F.md`, `fuente/p*.js` y `supabase/*.sql`; entregar `docs/mapa-modulos.md`, `docs/checklist-paridad.md` (regla → prueba) y los ADR de stack, offline y cifrado.
- **Fase 1 · Base:** monorepo, CI, design system (`packages/ui`), AppShell, tema, auth (correo + Google), perfiles de tenant, permisos, demo con datos.
- **Fase 2 · Operación:** Vender + Cobro + Caja + Arqueo **offline** con outbox y pruebas e2e sin red.
- **Fase 3 · Clientes y Club:** clientes, Club, sellos (incluye NFC y chip del mostrador), cupones, monedero.
- **Fase 4 · Inventario, compras, mayorista, fiado.**
- **Fase 5 · ARCA, RR. HH., pedidos e integraciones.**
- **Fase 6 · Web pública y sitio de VB.**
- **Fase 7 · Migración de datos** (importador desde el respaldo del sistema actual) y salida a producción.
Mantené `CLAUDE.md` y `docs/` al día con cada decisión.

## Formato de cada entrega
1. **Diagnóstico** (qué hay, qué falta, riesgos).
2. **Decisión** de arquitectura (una línea por qué).
3. **Árbol de archivos** tocados.
4. **Código completo** (TypeScript estricto, sin `any`, sin placeholders).
5. **Pruebas** y cómo correrlas.
6. **Checklist de paridad** actualizado y próximos pasos.
