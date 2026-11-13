# Almacén RAVE · Sistema RAVE (VINCULAR BUSINESS)

Sistema de gestión (POS + inventario + caja + clientes + menú público) para **Almacén RAVE**.
Un solo archivo HTML5 (`index.html`): menú digital adelante, panel del equipo detrás de **Acceso del equipo** (`/#acceso`).
Funciona sin internet y sincroniza con la nube (Supabase) cuando hay conexión. **El proyecto Supabase anterior ya no existe: hay que crear uno nuevo** (ver «Conectar la nube»); no queda ninguna clave vieja que rotar.

## Versión: SISTEMA VB 26F (`SISTEMA_VB_26F`)

**V26.71 (2026-11-13):** «Detalle de los cobros digitales» compacto: interruptor y resumen a la vista; los ajustes por medio y campo quedan plegados en «Ajustes avanzados».

**V26.70 (2026-11-12):** **Atención al cliente · Centro de canales.** Pestaña **🔌 Canales** con los 8 canales (tienda web y chat, WhatsApp Business, Instagram, Messenger, Telegram, correo, TikTok y Tiendanube), estado y avance. **⚡ Conectar todo con un clic** toma el WhatsApp del comercio y las redes del menú y publica los botones oficiales (wa.me, ig.me, m.me, t.me, mailto, TikTok) en el menú y en la app del Club. Cada canal se puede pasar a **Integrado** con un asistente paso a paso (enlaces exactos, botones para copiar y generar valores, «Probar y activar»): los mensajes de Telegram, WhatsApp Business, Instagram, Messenger y correo entran **cifrados** a la Bandeja y se responden desde el sistema (función `canales`; las claves quedan sólo como secretos de Supabase).

**V26.69 (2026-11-12):** **Reparto y despacho omnicanal + apps.** 📲 Botón **Instalar app** (sistema para el equipo y app del Club para clientes; funcionan sin señal). ⭐ **App del cliente**: tarjeta, beneficios, pedidos con seguimiento en vivo y código de entrega, y botones de contacto según el rubro. 🛵 **Reparto**: «Envío a domicilio» en Vender (ya pagado / efectivo con vuelto / QR en la puerta), bandeja única con pedidos del mostrador, teléfono, WhatsApp y **menú digital** (llegan cifrados), picking, hojas de ruta con orden óptimo y Google Maps/Waze, **copiloto del repartidor** (una parada, PIN, cliente ausente, billetera) y **rendición ciega en caja**. Conectores a un clic: gratis listos; Google Routes, Mercado Pago y WhatsApp Cloud preparados (función `reparto-pro`). Migración `supabase/26-reparto.sql`. Rol nuevo **Repartidor**.

**V26.68 (2026-11-12):** **Seguridad y portero** (Operación → *Seguridad y portero*): el portero del local, **SeguridadRave**, queda integrado al sistema como en Cannabismática. Los timbres (en la puerta y por QR) y las alertas llegan a cualquier pantalla, con sonido y la foto de la cámara, y se responde a la visita con *Ya voy · Un momento · Dejar en la puerta · No atendemos*. Pánico y coacción llegan como alertas silenciosas sólo a quien tiene el permiso. Los temas de aviso se guardan cifrados; la puerta se sigue abriendo desde SeguridadRave. Permisos nuevos «Seguridad y portero» y «Alertas silenciosas de seguridad».

**V26.67 (2026-11-11):** **Sello con el celular del cliente**: un chip NFC (y el mismo enlace en QR, para celulares sin NFC) en el mostrador; el cliente acerca su celular con la tarjeta del Club guardada y pide su sello; el sistema del mostrador lo valida (un solo uso, un sello cada 24 h) y lo aprueba el cajero (aviso «Aprobar / Rechazar») o se aprueba solo. Configuración → Clientes y NFC → *Sello con el celular del cliente*: puntos de sello, enlace para grabar el chip con NFC Tools y cartel A5 con QR. Migración `supabase/25-sello-nfc-mostrador.sql`. Prompt de mejoras corregido en `fuente/PROMPT-mejoras-POS.md`.

**V26.66 (2026-11-11):** **NFC configurable** en todo el sistema: Configuración → *Lector NFC del mostrador* elige el lector de cada equipo (lector USB en modo teclado, celular Android o sin NFC) y qué hace el NFC en el negocio (sumar sello, identificar al cliente en Vender y el cobro, fichar en el kiosco o en el mostrador); las tarjetas se **vinculan por su número** (sin grabarlas) desde la ficha del cliente o del empleado, o acercando una tarjeta nueva en Fidelización; *Probar lector* y lista de tarjetas vinculadas. **Configuración ordenada**: tarjeta única *Modelo de negocio* (¿de quién es el dinero? · ¿a quién le vendés?: sólo minorista / minorista y mayorista / sólo mayorista) y accesos por grupo (Negocio, Equipo y seguridad, Ventas y cobros, Clientes y NFC…). **Modo claro/oscuro arreglado**: selector Claro · Oscuro · Sistema (antes el primer toque no cambiaba nada), también en el ingreso y en Configuración → Apariencia. **Restablecer acceso** del equipo en un paso (clave temporal; migración `supabase/24-restablecer-acceso.sql`) y **asistente de Ingreso con Google** con verificación en vivo (`supabase/LEEME-google.md`).

**V26.52 (2026-11-05):** R2AVE en Telegram (@R2aveBot), sólo para administradores: consultas de ventas, stock, cajas, cierres y deudas; corrección de stock en dos pasos con límites cuando el administrador la habilita; alertas a un grupo. Se configura en Configuración → R2AVE en Telegram (instalación en `supabase/LEEME-supabase.md`).

**V26.51 (2026-11-05):** con una ventana abierta el Tab ya no se va a la pantalla de atrás; y desde la ficha del cliente se le puede mandar un WhatsApp con su saldo (Fiado / Cuenta corriente y vencimientos) o un aviso.

**V26.50 (2026-11-05):** modo oscuro y claro revisados pantalla por pantalla: la línea seleccionada del ticket ya no queda con fondo claro y letra clara, y los avisos en rojo se leen en los dos modos.

**V26.50 (2026-11-05):** cobro en efectivo con **importe recibido obligatorio**, ubicado debajo del total y arriba de los medios de pago; F12 deja el cursor ahí, Enter cobra y «Justo» completa el total exacto.

**V26.50 (2026-11-04):** en Vender, después de sumar un artículo el cursor vuelve solo a «Buscar artículo» para seguir cargando sin tocar el mouse; corregido el doble conteo al leer un código de barras con el cursor en el buscador.

**V26.49 (2026-11-04):** **recargo o descuento por medio de pago** (efectivo, débito, crédito, transferencia, QR, MODO; % o monto; sólo el administrador; aviso legal de la Ley 25.065), **balanzas Systel y Kretz con reconocimiento automático** (pide el peso, estable 400 ms, anti-duplicado), **etiquetas EAN-13 de balanza corregidas** (prefijo de 2 cifras y dígito verificador), **Fiado y Cuenta corriente separados**, **cortes X y Z** numerados, **apertura del cajón** y corte del papel, y **pantalla del cliente** para un segundo monitor. Migraciones `supabase/16-ajustes-medios-pago.sql` y `17-fiado-cc-cortes.sql` (**correrlas en Supabase antes de activar los recargos y de usar el corte X**). Detalle y pruebas: anexo S de `fuente/SISTEMA_VB_26F.md`.

**Prompt V26.4 (2026-10-19):** `fuente/SISTEMA_VB_26F.md` suma la especificación del módulo **Mayorista / Minorista (sección 4.22)** y el **Anexo E** (punto de reanudación con prompt de arranque). Es sólo documentación: el sistema publicado no cambió y 4.22 todavía no está construido.

**V26.3 (2026-10-19) · Club RAVE:** el cliente escanea el QR del menú, se anota (DNI opcional) y **recibe su tarjeta en el celular**; el negocio la importa sola y en el mostrador se suma el sello por **QR, código, DNI o NFC** (migración `supabase/09-club-tarjeta.sql`; pruebas `fuente/pruebas/c18.py`, `c19.py`, SQL 16). Wallet de Apple/Google: no implementado.

**V26.1 (2026-10-18):** cobro con **pagos mixtos** (p. ej. $ 40.000 efectivo + $ 20.000 cuenta corriente), validación de suma exacta, **alerta de vuelto**, arqueo que cuenta sólo el dinero que entró, débito automático en la cuenta corriente con estado *Pago parcial* y libro del cliente (migración `supabase/07-pagos-mixtos.sql`; pruebas `fuente/pruebas/v7.py`, `c16.py`, SQL 14). Marca oficial **VINCULAR BUSINESS** (banner, único celular (387) 4484132, vincularbusiness@gmail.com, lema) en ingreso, menú lateral, menú público ES/EN, tickets y mensajes del sistema.

El prompt maestro vigente está en `fuente/SISTEMA_VB_26F.md` (el anterior `sistema_vb_26.md` queda como historial) (incluye un anexo *as-built* con lo que está hecho, probado y pendiente). Las pruebas automáticas están en `fuente/pruebas/`.

## Estado de esta entrega (leer antes de usar)

| Pieza | Estado |
|---|---|
| `index.html` | **Armado sin conexión a la nube**: el ingreso dice *Pendiente de configuración* hasta compilarlo con la URL y la clave **publicable** del proyecto (ver «Conectar la nube»). |
| Nube (Supabase) | Scripts SQL `supabase/00…06` + función `arca`. Probados con Postgres/PostgREST locales (no contra el proyecto real todavía). |
| CAE automático de ARCA | Implementado (servidor + navegador). **Sin probar contra ARCA real**: requiere certificado del comercio y prueba en homologación. Mientras tanto la venta «Con ARCA» queda *pendiente de CAE*. |
| Hardware (impresora, balanza, lector) | Sin probar con equipos reales [VERIFICAR por modelo]. |
| Textos legales | Plantillas [VERIFICAR] con asesor legal. |

## Conectar la nube (lo hace Vincular Business)

0. Crear un proyecto nuevo en Supabase y anotar la *Project URL* y la clave **publicable** (`sb_publishable_…`).
1. En ese proyecto: **Authentication → Providers → Email → desactivar «Confirm email»**.
2. Aplicar los SQL en el *SQL Editor* siguiendo `supabase/LEEME-supabase.md`: en un proyecto nuevo se aplican `01` a `06` y **se salta el `00`** (sólo archiva un esquema viejo) (pegar el **contenido**, no el nombre del archivo).
3. Desplegar la función `arca` y cargar su secreto (ver el mismo LEEME).
4. Compilar con la dirección y la clave **publicable** (nunca la secreta):

```bash
cd fuente
SUPABASE_URL="https://<ref>.supabase.co" SUPABASE_KEY="sb_publishable_…" RAVE_SLUG="almacen-rave" \
  python3 build.py cliente ../index.html
```

`build.py` rechaza cualquier clave que parezca secreta (`service_role`, `sb_secret_…`). El archivo sólo lleva la URL y la clave publicable.
5. Publicar con GitHub Pages (Settings → Pages → rama `main`, carpeta `/`).

> El `RAVE_SLUG` tiene que coincidir con el *slug* del comercio en la base (con el nombre «Almacén RAVE» queda `almacen-rave`).

## Seguridad en una línea

Cifrado AES-256-GCM en el equipo (clave envuelta con PBKDF2-SHA256 200.000), datos personales cifrados antes de subir, aislamiento por comercio con RLS, roles validados en el servidor, stock sumado por el servidor, clave privada de ARCA sólo en el servidor, sin secretos en el archivo. Sin la contraseña ni el código de recuperación los datos cifrados no se pueden recuperar (por diseño).

Desarrollado por **VINCULAR BUSINESS** · Único celular (387) 4484132 · vincularbusiness@gmail.com · *“Tu idea, en buenas manos.”*
