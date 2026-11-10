# SISTEMA VINCULAR BUSINESS · PROMPT FINAL — Cliente ALMACÉN RAVE (producción)

**Versión:** V26.63 · 2026-11-10 · **Repositorio y publicación:** `AlmacenRAVE` → `https://raveholding.github.io/AlmacenRAVE/` · **Perfil:** `cliente` (con nube) · **Base local:** `rave-almacenrave-v1` · **Comercio en la nube:** slug `almacen-rave`
Desarrollado por **VINCULAR BUSINESS** · Celular **(387) 4484132** · **https://www.vincularbusiness.com.ar/** · **vincularbusiness@gmail.com** · «Tu idea, en buenas manos.»

> Orden de lectura: este prompt → `PROMPT_ESQUELETO_VB.md` V27.2 → `SISTEMA_VB_26F.md` (secciones 4.x y anexos A–Z, AA). **Este es el sistema en uso de un negocio real: no se rompe.** Si algo de este prompt choca con las reglas de seguridad del esqueleto, mandan las reglas.

---

## 1. Qué es

El sistema real de **Almacén y Licorería RAVE** (Salta). Es la única versión con **datos reales**, **nube Supabase** y **particularidades del cliente**. Comparte el código con las demos, pero sus particularidades **nunca** se copian a raveV2, raveV3 ni Kini.

## 2. Reglas propias de este cliente (además del esqueleto §5)

1. **No romper lo que está en uso.** Toda novedad nace **apagada** hasta que el administrador la activa; la variante cliente nunca dice «demo» ni «simulado».
2. **Base de producción:** cambios sólo con **autorización expresa del dueño**; el SQL se entrega para que lo pegue el dueño y se verifica después por consulta. Nunca claves secretas en el chat, el código ni el HTML (sólo URL del proyecto y clave publicable).
3. Sólo el **administrador** otorga o quita permisos y da de baja o desactiva socios.
4. Enviar mensajes, aceptar términos o enviar formularios con efecto externo: «sí» explícito del dueño para cada acción.
5. El **instalador de Windows** no se modifica salvo pedido.
6. Olvido de clave: lo resuelve el administrador del comercio.
7. Regresión completa de los cuatro perfiles antes de publicar.

## 3. Ficha del cliente

| Dato | Valor |
|---|---|
| Comercio | Almacén y Licorería RAVE · Urquiza 1052, Salta, Argentina |
| Marca | Logo RAVE; paleta **negro cálido `#242220`** (tinta) · **dorado `#c9963e`** (acento) · `#a87a28`; el acento no cambia con el tema |
| Modelo de negocio | **Socios con rubros por persona** (`cfg.biz='rubros'`): cada rubro es una persona; **cierre de caja por rubro** con sueldo a medias, impuesto diario (por defecto $ 30.000 c/u, editable) y ganancia a partes iguales o propia (4.27) |
| Venta restringida | **Encendida** (alcohol y tabaco): control de edad en el menú, horario de alcohol configurable (07:00–00:00 cargado, [VERIFICAR]), tabaco sin promociones, leyendas en ticket y legales |
| Canales de venta | Minorista; mayorista por presentaciones (Unidad · Display · Fardo · Pallet) disponible detrás de `wholesale.on` |
| Club | Club RAVE: tarjeta digital en el celular, sellos por QR/código/DNI/NFC, niveles, cumpleaños, monedero, gift cards, cashback, cupones |
| Fiscal | ARCA: homologación aprobada; producción con certificado real [D] |
| Nube | Supabase (plan del dueño), scripts `01`…`22` en `INSTALAR-TODO.sql`; colecciones por `sincronizar()` |
| Telegram | Bot del dueño **@R2aveBot** (prompt 4.35) para administradores |
| Créditos | Vincular Business en ingreso, barra lateral, ticket, menú, tarjeta e instalador |

## 4. Módulos y estado en este cliente

Hechos y en uso: Resumen «Hoy», Vender (F1–F12, pagos mixtos, cuenta corriente, recargos por medio, balanza Systel/Kretz, EAN-13), **Gestión de caja** (pestañas + **tablero del turno**: estado, 4 pasos, indicadores) con cierre sellado SHA-256 y cierre por rubro, traspasos con `transfer_funds`, cortes X/Z, inventario, presupuestos, mermas, proveedores y compras, Club completo, datos para facturar, personal y fichaje, tareas, menú público (local o tienda con envíos), legales, periféricos, importar/exportar, auditoría, nube.

Apagados hasta que el administrador los active: **Atención al cliente** (chat web cifrado del menú + WhatsApp asistido + teléfono + local; sin Instagram/Messenger/Telegram/correo de demostración), Centro Inteligente, detalle de cobros digitales, canal mayorista.

**Pendiente de verificar con el dueño:** que `22-crm.sql` esté aplicado en Supabase antes de encender el chat web en la nube (consulta de control: existencia de `crm_entrantes` y de la función `crm_web_enviar`). Sin ese script el resto del sistema funciona igual.

## 5. Diseño

Sección 7 del esqueleto con la marca RAVE (dorado sobre negro cálido): «Vender POS [F1]» dorado, secciones plegables, Ctrl + K, campana, avatar, pestañas en Caja y Club, **línea de ayuda por pantalla**, **tablero del turno en caja**, tablas con encabezado fijo y filas alternadas, transición suave (respeta «reducir movimiento»), tema claro/oscuro/automático, modo mostrador (entra a Vender, ≤ 7 entradas).

## 6. Compilar, probar y publicar

```bash
cd AlmacenRAVE/fuente
python3 assemble.py
SUPABASE_URL=<url del proyecto> SUPABASE_KEY=<clave PUBLICABLE> RAVE_SLUG=almacen-rave \
  python3 build.py cliente /tmp/rave/out_cliente.html && rm -f all.js
# regresión completa (demo_all.sh) + SQL (supabase/tests/run.sh, 643/643 al 2026-11-09)
cp /tmp/rave/out_cliente.html ../index.html   # commit con atribución y push a main
```

`build.py cliente` rechaza claves `service_role` / `sb_secret_`.

## 7. Límites y pendientes declarados

Nube de extremo a extremo con dos equipos reales sin reprobar desde V26.9 (G.3.1); ARCA producción, Wallet, Mercado Pago, Meta/WhatsApp Business API, hardware y NFC reales: [D] o pendientes de prueba física; 4.22 F2–F7 especificadas, no construidas.

## 8. Prompt de arranque

> Leé `PROMPT_FINAL_ALMACENRAVE.md`, `PROMPT_ESQUELETO_VB.md` y `SISTEMA_VB_26F.md`. Inspeccioná `AlmacenRAVE` y compilá los cuatro perfiles; corré la regresión y el SQL como línea base. Hacé el cambio pedido **sin romper el sistema en uso**: apagado por defecto en el cliente, completo con ejemplos en las demos, sin copiar particularidades de RAVE a las demos; pruebas junto con el código, regresión completa, publicación de los cuatro sitios; si hay SQL nuevo, entregámelo para pegarlo yo y verificalo después. Informe honesto al final.
