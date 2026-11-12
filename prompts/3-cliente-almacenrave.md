# PROMPT 3 · Cliente «Almacén RAVE» sobre la plataforma Sistema VB v4

> **Requisito:** usá completo el **PROMPT 1 (Plataforma Sistema VB v4)**. Este prompt define el **perfil del cliente AlmacenRAVE** y su **migración** desde el sistema actual. Nada de código especial para el cliente: todo es configuración del tenant `almacenrave` + datos.

---

## Rol (además del PROMPT 1)
Sumá experiencia en **migraciones de sistemas en producción sin cortar la operación** (comercio que vende todos los días) y en **puesta en marcha con el personal del local**.

## El cliente
- **Almacén RAVE** · Licorería y Vinería · Urquiza 1052, Salta, Argentina · WhatsApp (387) 457-4892 · Instagram RAVE_LICORERIA · Facebook LICORERIA_RAVE.
- Sistema actual en producción: `https://raveholding.github.io/AlmacenRAVE/` (V26.67, repo `raveholding/AlmacenRAVE`, Supabase `rdvwrrroerxikfqvpgnh`, plan Pro).
- Rubros: bebidas (vinos, cervezas, aperitivos, gin, vodka, ron, champagne, energizantes, gaseosas, jugos), cigarrillos y tabaco, combos y promociones; venta en mostrador, pedidos por WhatsApp desde el menú QR y entregas (incluida la venta a pasajeros con el cartel QR en el auto).

## Perfil de tenant `almacenrave`
- **Marca:** logo oficial (isotipo botella con guardas doradas + «RAVE» en blanco sobre charcoal), acento **dorado** sobre **charcoal**, tipografía con serif para títulos (como hoy) y sans para la UI. Debe verse como la referencia de diseño aprobada (sidebar oscuro, catálogo con fotos, ticket a la derecha, botón dorado «Cobrar»), en claro y oscuro.
- **Organización del dinero:** **por rubros, cada uno con su responsable** (caja por rubro, sueldo del empleado a medias, impuesto que se separa, reparto de ganancia). Canal: **minorista** (mayorista apagado, activable).
- **Módulos activos:** todos los del sistema base que usa hoy: Vender, Caja, Cajas y sucursales, Arqueo/cierre, Inventario, Proveedores y compras, Presupuestos, Mermas y devoluciones, Clientes, Club de clientes, Fidelización, Monedero y gift cards, Fiado, Personal y fichaje, Recursos Humanos, Tareas y organigrama, Menú público y web, PedidosYa, Telegram (R2AVE en el bot), Facturación ARCA, Nube y usuarios. **Centro inteligente: apagado** (se puede prender).
- **Hardware del mostrador:** lector de códigos USB, **lector NFC USB en modo teclado**, celular Android con NFC opcional, impresora térmica; **chip NFC + cartel QR de «Sumá tu sello»** en el mostrador (puntos de sello ya creados en el sistema actual).
- **Menú público:** secciones MENÚ DE PROMOS, VINOS (agrupados por bodega con sus variedades y precios), CIGARRILLOS Y TABACO; carrito con pedido por WhatsApp (primero se confirma stock, después se coordina el pago), medios de pago (alias y QR de Mercado Pago), mapa del local, sumarse al Club y tarjeta digital.
- **Datos del desarrollador** en el pie y en «Acerca de»: Vincular Business · WhatsApp (387) 4484132 · vincularbusiness@gmail.com.

## Migración sin cortar la venta
1. **Inventario de datos actuales:** productos, rubros, precios, stock, clientes (datos personales cifrados), Club (sellos, premios, tarjetas, tarjetas NFC vinculadas, puntos de sello), ventas, cajas, cierres y su sello de integridad, fiado, proveedores, empleados y fichajes, configuración, usuarios y permisos, auditoría.
2. **Importador** en la v4 (`features/migracion`): toma el **respaldo** del sistema actual (y/o lee la nube actual con la llave del comercio **en el navegador del administrador**), valida, muestra un informe (cuántos registros, diferencias de totales) y recién ahí escribe. Los datos personales nunca viajan descifrados.
3. **Compatibilidad de credenciales:** las tarjetas del Club, códigos de socio, QR impresos, tarjetas/llaveros NFC y chips del mostrador **tienen que seguir funcionando** sin reimprimir nada (mismos formatos `RAVE2|…`, `RAVE2N|…`, `VBHRN|…`, `#sello=p…` o redirección).
4. **Convivencia:** 1–2 semanas en paralelo (la v4 en `staging`, el sistema actual en producción), con un cierre de caja comparado día por día. Criterio de salida: **checklist de paridad al 100 %** y cierres que coinciden.
5. **Corte:** respaldo final, importación, la dirección actual pasa a redirigir a la v4, el sistema actual queda **solo lectura** 90 días como resguardo.
6. **Capacitación:** guía de una página por rol (cajero, encargado, dueño) y video corto de Vender/Cobrar/Cierre.

## Primera entrega esperada
- Perfil `tenants/almacenrave` completo (marca, módulos, rubros, textos, integraciones).
- Capturas de **Vender** y del **App Shell** con la marca RAVE en claro, oscuro y celular, para aprobación del cliente.
- `docs/migracion-almacenrave.md` con el mapeo de cada colección actual → tabla v4 y el plan de corte con fechas.

## Formato de cada entrega
El mismo del PROMPT 1 (diagnóstico, decisión, árbol, código completo, pruebas, checklist de paridad).
