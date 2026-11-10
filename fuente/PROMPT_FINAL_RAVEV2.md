# SISTEMA VINCULAR BUSINESS · PROMPT FINAL — raveV2 «Mi Negocio» (sistema genérico, sin rubro)

**Versión:** V26.64 · 2026-11-10 · **Repositorio y publicación:** `raveV2` → `https://raveholding.github.io/raveV2/` · **Perfil de compilación:** `solo` · **Base local del navegador:** `rave-solo-demo-v1`
Desarrollado por **VINCULAR BUSINESS** · Celular **(387) 4484132** · **https://www.vincularbusiness.com.ar/** · **vincularbusiness@gmail.com** · «Tu idea, en buenas manos.»

> Orden de lectura: **este prompt** (qué es y qué lleva raveV2) → `PROMPT_ESQUELETO_VB.md` V27.2 (reglas, UX, módulos) → `SISTEMA_VB_26F.md` (detalle técnico de cada módulo y anexos). Si difieren, para esta demo manda este prompt.

---

## 1. Qué es

raveV2 es el **Sistema Vincular Business genérico**: se le muestra a **cualquier** negocio de un dueño para que lo pruebe como propio. **No pertenece a ningún rubro**: no es almacén, kiosco, bar ni licorería. Por eso:

- Marca neutra **«Mi Negocio»** (logo «MI NEGOCIO / DEMO»), sin nombre, dirección, redes ni catálogo de ningún cliente (nada de Almacén RAVE).
- **Sin venta restringida** (`S.cfg.restricted=false`): no hay control de edad en el menú, ni horario de alcohol, ni «excluye tabaco», ni leyendas de bebidas o «+18» en el ticket, en el panel ni en los legales. Los campos de alcohol/tabaco de categorías y tienda quedan ocultos.
- Todos los módulos del producto **completos** y con datos rotulados «ejemplo».

## 2. Mapa de versiones (no mezclarlas)

| Versión | Repositorio | Perfil | Para quién | Base local |
|---|---|---|---|---|
| Cliente Almacén RAVE (producción) | `AlmacenRAVE` | `cliente` | El negocio real, con nube | `rave-almacenrave-v1` |
| **raveV2 «Mi Negocio»** (ESTA) | `raveV2` | `solo` | Cualquier negocio de un dueño | `rave-solo-demo-v1` |
| raveV3 «Corporación Demo» | `raveV3` | `v3` | Empresas medianas y grandes | `rave-v3-demo-v2` |
| KiniDistribuidoraDemo | `KiniDistribuidoraDemo` | `kini` | Distribuidoras sólo mayoristas | `rave-kini-demo-v2` |

Una sola fuente de código (`AlmacenRAVE/fuente`); las versiones son **perfiles de compilación**, nunca copias. No se edita a mano el `index.html` publicado. Publicar raveV2 no toca las otras.

## 3. Ficha de la demo (datos de ejemplo)

| Dato | Valor |
|---|---|
| Nombre | **Mi Negocio** · «Mi Negocio · demo» |
| Paleta | Grafito `#1f2a37` (tinta) · verde comercial `#2e8b74` (acento) · `#23695a` (acento oscuro); letra negra sobre el acento (contraste ≥ 4,5:1); en oscuro, textos de acento `#5cc2a8` |
| Tipo de negocio | Un solo dueño, fijo (`cfg.biz='owner'`, `bizLocked`) |
| Categorías | **Productos · Servicios · Accesorios · Insumos · Paquetes** (sólo ordenan; no son personas ni cajas) |
| Catálogo | 19 artículos genéricos sin marca (estándar, premium, económico, a granel, de temporada, servicios, accesorios, insumos) + «Paquete inicial» (kit) |
| Cajas | Perfil **simple** (se pueden sumar cajas, caja principal y sucursales desde «Cajas y sucursales») |
| Equipo | ADMIN · 1234 / Supervisor · 1111 / Mostrador · 0000; un colaborador de ejemplo con fichaje |
| Resumen (dashboard) | Sólo el administrador (ADMIN); el administrador puede habilitarlo para otro rol en Usuarios y permisos. Claves olvidadas: se piden al administrador |
| Clientes y Club | 3 clientes con consentimiento, sellos, membresía, cupón `BIENVENIDA10`; premio genérico |
| Venta | Minorista (el canal mayorista está en la demo Kini) |
| Venta restringida | **Apagada** |

## 4. Módulos (todos completos)

Resumen «Hoy» · Vender (F1–F12, pagos mixtos, cuenta corriente) · PedidosYa (demostración) · **Gestión de caja** con tablero del turno (Caja actual · Cajas y sucursales · Arqueo/cierre · Historial) · Stock e inventario · Presupuestos · Mermas y devoluciones · Proveedores y compras · **Club** (Clientes · Sellos · Niveles y cumpleaños · Monedero · Cupones) · **Atención al cliente** (CRM omnicanal completo: chat web, WhatsApp asistido, Instagram/Messenger/Telegram/correo **rotulados de demostración**, turnos, cobros, CSAT/NPS, analíticas, alertas ERP, campañas, «Simular mensaje entrante») · Personal y fichaje · Tareas y organigrama · Menú público (local o tienda con envíos) · Legales (sin alcohol/tabaco) · Periféricos y ticket · Importar/Exportar · Integraciones · Usuarios y permisos · Auditoría · Configuración · Nube (sin configurar).

No lleva: socios ni rubros por persona, cierre por rubro, Centro Inteligente ni asistentes R2AVE (eso es raveV3), nada de Almacén RAVE.

## 5. Diseño (sección 7 del esqueleto, obligatoria)

Barra lateral oscura con «Vender POS [F1]» en el acento, secciones plegables, búsqueda global Ctrl + K, campana y avatar; pestañas en Caja y Club; **línea de ayuda** debajo de cada título; **tablero del turno** en caja (estado, 4 pasos, indicadores, acción principal); tarjetas con relieve, tablas con encabezado fijo y filas alternadas, transición suave; tema claro/oscuro/automático; ≥ 44 px; 320–1440 px sin desbordes.

## 6. Compilar, probar y publicar

```bash
cd AlmacenRAVE/fuente
python3 assemble.py && python3 build.py solo /tmp/rave/solo.html && rm -f all.js
cd pruebas && python3 gen1.py solo && python3 sv1.py && python3 ux1.py file:///tmp/rave/solo.html
# regresión completa de los cuatro perfiles: demo_all.sh (ver esqueleto §10)
cp /tmp/rave/solo.html ../../../ravev2/index.html   # commit con atribución y push en raveV2
```

`gen1.py` recorre el menú y **todas** las pantallas y falla si aparece: bebida, vino, cerveza, fernet, almacén, kiosco, licorería, golosina, cigarrillo, tabaco, alcohol, whisky, gaseosa, soda, aperitivo o «+18»; además exige el tablero del turno y la línea de ayuda en Caja.

## 7. Límites declarados

Integraciones sin cuenta real (Meta, Telegram, correo, Mercado Pago, ARCA, Wallet) se muestran como demostración y nunca simulan un cobro, un CAE ni un envío reales. Los datos viven en el navegador del visitante.

## 8. Prompt de arranque

> Leé `PROMPT_FINAL_RAVEV2.md`, `PROMPT_ESQUELETO_VB.md` y `SISTEMA_VB_26F.md`. Compilá el perfil `solo`, corré `gen1.py`, `sv1.py` y la regresión como línea base. Hacé el cambio pedido manteniendo raveV2 **genérico y sin rubro** (nada de bebidas, tabaco, almacén ni datos de clientes), con todos los módulos completos y datos «ejemplo»; escribí las pruebas, corré la regresión de los cuatro perfiles, publicá raveV2 y entregame un informe honesto.
