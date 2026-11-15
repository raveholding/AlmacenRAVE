# Prompt corregido · Mejoras de App Shell y «Vender (Punto de Venta)» en Sistema RAVE (AlmacenRAVE)

Actuá como Senior Product Designer y Staff Engineer especializado en ERP y puntos de venta (POS) de alta densidad operativa.

## Contexto real del sistema (no cambiar sin pedirlo)
- **Sistema RAVE** de **Vincular Business**, cliente **Almacén RAVE** (raveholding.github.io/AlmacenRAVE).
- **Arquitectura actual:** una sola página HTML que funciona **sin internet** (offline-first), en JavaScript sin framework, armada desde módulos `fuente/p*.js` + `fuente/p1-head.html` (CSS) con `fuente/build.py` (`cliente` → `index.html`). Se publica en **GitHub Pages**, no en Vercel.
- **Nube:** Supabase con **cifrado de punta a punta** (los datos se cifran en el navegador; el servidor no los ve), RLS, funciones RPC y migraciones numeradas en `supabase/NN-*.sql` (la última es la 25). Nada de lógica de negocio nueva en el servidor sin migración y sin pruebas en `supabase/tests`.
- **Ya existe y no puede perderse:** tema Claro · Oscuro · Sistema (`themeBtn`), Configuración por grupos, NFC configurable (`p7d-nfc.js`), sello por chip del mostrador (`p6k-sellonfc.js`), cobro mixto, fiado y cuenta corriente, recargos por medio de pago, facturación ARCA, mayorista (presentaciones y acuerdos), Club de clientes (sellos, cupones, monedero), cajas y sucursales, arqueo con sello SHA-256, auditoría, permisos por rol, Recursos Humanos, PedidosYa, Telegram y la búsqueda global `Ctrl+K`.
- **Marca:** el color de acento y el logo salen de la configuración del comercio (hoy dorado `--gold` sobre charcoal). La marca del desarrollador va en el pie: «Desarrollado por Vincular Business · WhatsApp (387) 4484132 · vincularbusiness@gmail.com».

## Objetivo
Llevar el **App Shell** y la pantalla **Vender (Punto de Venta)** a un acabado de SaaS profesional **dentro de la arquitectura actual**, sin perder funciones ni el modo sin conexión.

## Requisitos
1. **Shell:** sidebar colapsable (240 px / 68 px, se recuerda por equipo) con los grupos REALES del menú (Resumen · Operación comercial · Logística e inventario · Clientes y fidelidad · Equipo · Menú y web · Sistema), indicador del activo y contadores. Topbar de 56 px: migas de pan, `Ctrl+K`, sucursal/caja, estado de caja, sincronización, tema, notificaciones y usuario. En el celular: barra inferior con Vender, Caja, Clientes y Más.
2. **Tokens de diseño** en variables CSS para claro y oscuro (oscuro: fondo `#0F1115`, tarjetas `#181A20`, bordes `#262932`; claro: `#F8FAFC`, `#FFFFFF`, `#E2E8F0`). El acento lo define el comercio y tiene que pasar contraste AA en los dos temas.
3. **Vender:** catálogo (≈65 %) con categorías reales del comercio + Favoritos, buscador instantáneo compatible con lector de códigos de barras y con el lector NFC (no romper `p7d-nfc.js`), tarjetas con imagen, nombre en 2 líneas, precio en ARS y stock. Ticket (≈35 %, scroll propio) con cantidades, quitar, cliente del ticket, sello del Club, cupón, Subtotal / Descuentos / Recargos / Total.
4. **Cobro:** botón «Cobrar $ Total» con atajo **F9** (F12 abre las herramientas del navegador) y `Ctrl+Enter`. Se mantienen TODOS los medios actuales: efectivo con vuelto, transferencia o alias, débito o crédito con recargo, QR, mixto, fiado o cuenta corriente, y facturación ARCA.
5. **Animaciones** sólo con `transform` y `opacity`, de 150 a 250 ms, respetando `prefers-reduced-motion`.
6. **Accesibilidad:** foco visible, objetivos de 44 px o más, `aria-live` en el total y en los avisos, todo usable con teclado.

## Cómo entregar
- Cambios en los módulos `fuente/*.js` y en `p1-head.html` (nada de archivos sueltos fuera del build). Con un diagnóstico breve antes y la lista de qué se movió.
- Pruebas Playwright nuevas en `fuente/pruebas/`; las existentes tienen que seguir pasando.
- Versión nueva en README y anexo en `SISTEMA_VB_26F.md`.

> **Si se quiere migrar a Next.js + Tailwind + shadcn + Vercel**, es un proyecto aparte («Sistema RAVE v4»): primero hay que definir cómo se conservan el modo sin conexión, el cifrado de punta a punta, el esquema y las RPC de Supabase y las ~70 pantallas actuales. No se hace como «actualización».
