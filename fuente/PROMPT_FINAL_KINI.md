# SISTEMA VINCULAR BUSINESS · PROMPT FINAL — KiniDistribuidoraDemo (distribuidora sólo mayorista)

**Versión:** V26.72 · 2026-11-14 · **Repositorio:** `KiniDistribuidoraDemo` → `https://raveholding.github.io/KiniDistribuidoraDemo/` · **Perfil:** `kini` · **Base local:** `rave-kini-demo-v2`
Desarrollado por **VINCULAR BUSINESS** · Celular **(387) 4484132** · **https://www.vincularbusiness.com.ar/** · **vincularbusiness@gmail.com** · «Tu idea, en buenas manos.»

> Orden de lectura: este prompt → `PROMPT_ESQUELETO_VB.md` V27.5 → `SISTEMA_VB_26F.md` (4.22 mayorista y anexos F, S). Si difieren, para esta demo manda este prompt.

---

## 1. Qué es

La demo para **distribuidoras y mayoristas**: muestra el Sistema Vincular Business con el canal **sólo mayorista** encendido (presentaciones Unidad · Display · Fardo · Pallet, cobro por tramos según volumen, acuerdos por cliente, crédito con plazo y excepción autorizada). Marca **Kini Distribuidora** con su logo (`assets/kini-logo.webp`) y su paleta (tinta `#1b1b1b`, acento verde `#5fd33a`); se reemplazan por los del cliente cuando los entregue. Sin datos de Almacén RAVE.

## 2. Ficha de la demo (datos de ejemplo)

| Dato | Valor |
|---|---|
| Nombre | **Kini Distribuidora** |
| Canal | **Sólo mayorista** (`wholesale.on` + `wholesale.only`); clientes con CUIT válido, lista y plazo |
| Rubros | Bebidas sin alcohol · Cervezas · Vinos y aperitivos · Almacén · Golosinas y snacks · Limpieza · Packs y combos (es una distribuidora: el rubro bebidas es real de su negocio) |
| Catálogo | 29 artículos genéricos con presentaciones y precios por tramo |
| Cajas | Caja 1 · Caja 2 · **Caja principal** (perfil `main`, traspasos con comprobante) |
| Equipo | Depósito y vendedor de mostrador (ejemplo); ADMIN · 1234 / Supervisor · 1111 / Mostrador · 0000 |
| Resumen (dashboard) | Sólo el administrador (ADMIN); el administrador puede habilitarlo para otro rol en Usuarios y permisos. Claves olvidadas: se piden al administrador |
| Clientes | 5 clientes mayoristas con CUIT, crédito, plazo y acuerdos de ejemplo |
| Venta restringida | **Encendida** (vende bebidas con alcohol: control de edad, horario configurable, tabaco sin promociones) |

## 3. Módulos

Todos completos: Resumen «Hoy», Vender mayorista (tramos, presentaciones, código de barras por presentación), **Gestión de caja** con tablero del turno, Stock por presentación (desglose «3 Pallet + 2 Fardo…»), Presupuestos, Mermas, Proveedores y compras, Club, **Atención al cliente** completa (canales de demostración rotulados, departamentos Ventas · Soporte · Cobranzas, cobros, turnos, analíticas, alertas, campañas), Personal, Tareas, Menú/tienda con envíos por provincia, Legales, Periféricos, Importar/Exportar, Auditoría, Configuración. Sin Centro Inteligente.

## 4. Diseño

Sección 7 del esqueleto con la paleta Kini (contraste AA verificado por `kc1`): línea de ayuda por pantalla, tablero del turno en caja, tablas con encabezado fijo, pestañas, Ctrl + K, tema claro/oscuro, ≥ 44 px.


## Recursos Humanos (V26.64)

Módulo de la sección 7-ter del esqueleto. **En esta demo: Plan Micro** (2 legajos activos de ejemplo) — el visitante ve con candado qué suma el Plan Completo. El plan lo decide sola la cantidad de legajos activos (0–10 Micro, 11 o más Completo); el botón «+ Personal de ejemplo» / «Dar de baja el de ejemplo» de la pestaña *Plan y resumen* muestra la transición automática. Fichaje en kiosco con PIN (bloqueo tras 5 intentos), QR, NFC y geocerca; rostro y huella figuran como **pendientes de dispositivo y revisión legal**. Usuario de prueba del portal del empleado: **Empleado (portal) · 2222**. Nómina, firma y archivos bancarios son internos y se rotulan [VERIFICAR] (no reemplazan el recibo legal ni la firma digital).

## Finanzas y Contabilidad (V26.72)

Módulos de la sección 7-quater del esqueleto, en la sección **Finanzas** del menú. **Finanzas** (permiso `finance`; editar con `finance_edit`): tablero con efectivo en cajas abiertas, bancos, a cobrar (cuentas corrientes + tarjetas y billeteras por acreditar), a pagar (proveedores + compromisos) y margen neto estimado; **flujo de fondos proyectado** de 4, 8 o 12 semanas con gráfico y alertas de bache; rentabilidad por operación; **conciliación asistida** del extracto bancario (CSV); tablero de cobros digitales; copiloto de reglas (sin IA ni costo). **Contabilidad** (permiso `accounting`; administrar con `accounting_admin`): asientos de partida doble generados solos desde cada operación, con huella SHA-256 y **cierre de período encadenado**; Libro Diario, Mayor, Sumas y saldos, pre-liquidación de IVA, plan de cuentas modelo editable [VERIFICAR con el contador]. Rol **Contador** de sólo lectura. Es contabilidad de **gestión**: no reemplaza libros legales ni la DDJJ. La pasarela **VB Pay** queda preparada y **apagada** (falta cuenta del procesador y credenciales).

**En esta demo: encendidos** con datos de ejemplo; las ventas mayoristas van a la cuenta 4.1.02 «Ventas mayoristas» y las cuentas corrientes con plazo alimentan el flujo de fondos. Usuario **Contador · 4444**.


> **V26.73 (Omni-Assist y Notificaciones push):** están en el código fuente y funcionan en este perfil, pero **no se publicaron en esta demo**: el dueño pidió trabajar sólo en Almacén RAVE. Se publican cuando lo pida.

> **V26.74 (CRM omnicanal y Finanzas para comercios):** en el código fuente y probados en este perfil; **no publicados en esta demo** (el dueño pidió sólo Almacén RAVE).

## 5. Compilar, probar y publicar

```bash
cd AlmacenRAVE/fuente
python3 assemble.py && python3 build.py kini /tmp/rave/kini.html && rm -f all.js
cd pruebas && python3 kn1.py && python3 kn2.py && python3 kn3.py && python3 kc1.py
# regresión completa de los cuatro perfiles (esqueleto §10)
cp /tmp/rave/kini.html ../../../kinidistribuidorademo/index.html   # commit con atribución y push
```

## 6. Pendientes (decide el dueño o depende de terceros)

Pedidos de venta → picking → remito → factura → recibo, lotes/FEFO, cierre ciego, cheques/eCheq (4.22 F2–F7, especificados); la contabilidad de gestión ya está hecha (V26.72); logo y paleta definitivos del cliente; integraciones reales (Meta, ARCA producción, Mercado Pago).

## 7. Prompt de arranque

> Leé `PROMPT_FINAL_KINI.md`, `PROMPT_ESQUELETO_VB.md` y `SISTEMA_VB_26F.md` (4.22). Compilá `kini`, corré `kn1`–`kn3`, `kc1` y la regresión. Hacé el cambio pedido respetando la marca Kini y el canal sólo mayorista, con pruebas; publicá KiniDistribuidoraDemo y entregame un informe honesto.
