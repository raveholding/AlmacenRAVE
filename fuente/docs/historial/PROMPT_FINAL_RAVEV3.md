# SISTEMA VINCULAR BUSINESS · PROMPT FINAL — raveV3 «Corporación Demo» (gestión empresarial integral)

**Versión:** V26.72 · 2026-11-14 · **Repositorio y publicación:** `raveV3` → `https://raveholding.github.io/raveV3/` · **Perfil:** `v3` · **Base local:** `rave-v3-demo-v2`
Desarrollado por **VINCULAR BUSINESS** · Celular **(387) 4484132** · **https://www.vincularbusiness.com.ar/** · **vincularbusiness@gmail.com** · «Tu idea, en buenas manos.»

> Orden de lectura: **principio rector (§0)** → este prompt → `PROMPT_ESQUELETO_VB.md` V27.6 → `SISTEMA_VB_26F.md` (anexo P: Centro Inteligente). Si hay conflicto manda ese orden.

---

## 0. Principio rector (manda sobre todo)

Integridad de datos y operaciones → seguridad → exactitud → estabilidad → recuperación ante errores → calidad → rendimiento → experiencia de uso → calidad visual. No suponer ni inventar funciones, datos ni integraciones; distinguir **Real** / **Simulación** / estimación; una animación no es una operación; validar e incluir pruebas negativas antes de publicar; respaldo y reversión probados.

## 1. Qué es

raveV3 es el **Sistema Vincular Business con visión empresarial**: la demo para **empresas medianas y grandes** que necesitan gestión integral (comercial, tesorería, sucursales, abastecimiento, RR. HH., atención al cliente, auditoría e inteligencia). Por eso:

- Marca **«Corporación Demo»** (logo «CORPORACIÓN DEMO / GESTIÓN INTEGRAL»), sin datos de ningún cliente.
- **Nada de rubros de comercio chico ni leyendas de bebidas**: no hay almacén, kiosco, golosinas, vinos, cervezas, tabaco ni «+18». Venta restringida **apagada** (`S.cfg.restricted=false`): sin control de edad, horario de alcohol ni exclusión de tabaco en ningún lado.
- Vocabulario y datos corporativos: líneas de negocio, áreas, casa central y sucursal, tesorería, ejecutivos de cuentas, analistas, soporte.

## 2. Mapa de versiones

| Versión | Repositorio | Perfil | Asistentes |
|---|---|---|---|
| Cliente Almacén RAVE | `AlmacenRAVE` | `cliente` | Centro Inteligente apagado hasta activarlo; sin SVB R2AVE |
| raveV2 «Mi Negocio» | `raveV2` | `solo` | No |
| **raveV3 «Corporación Demo»** (ESTA) | `raveV3` | `v3` | **Sí**: Centro Inteligente + equipo SVB R2AVE (10 especialistas) + centro de operaciones vivo |
| KiniDistribuidoraDemo | `KiniDistribuidoraDemo` | `kini` | No |

`v3` es el único perfil que incluye `p10b-r2ave.js` y `p10c-vivo.js`.

## 3. Ficha de la demo (datos de ejemplo, rotulados)

| Dato | Valor |
|---|---|
| Nombre | **Corporación Demo** · «Corporación Demo · Casa central · demo» |
| Paleta corporativa | Azul pizarra `#0f172a` (tinta) · azul `#3b82f6` (acento) · `#1d4ed8` (acento oscuro); letra **negra** sobre el acento (≥ 4,5:1); en oscuro textos de acento `#60a5fa`; Centro Inteligente `--ci-acc:#60a5fa` |
| Estructura | **Casa central** y **Sucursal Norte**; cajas «Caja Casa central», «Caja Sucursal Norte» y **Tesorería (caja principal)**; perfil de caja `branches` |
| Líneas de negocio | **Equipamiento · Software y licencias · Servicios profesionales · Insumos corporativos · Logística y distribución · Mantenimiento y soporte** |
| Catálogo | 23 ítems corporativos (servidor de rack 1U, notebook corporativa, multifunción láser, monitor 27", switch administrable, licencia de gestión integral, consultoría, implementación, logística, contratos de soporte…) + «Kit puesto de trabajo» |
| Equipo | Ejecutivo de cuentas, analista administrativo y técnico de soporte (ejemplo); organigrama y tareas por área |
| Usuarios | ADMIN · 1234 / Supervisor · 1111 / Mostrador · 0000 |
| Resumen (dashboard) | Sólo el administrador (ADMIN); el administrador puede habilitarlo para otro rol en Usuarios y permisos. Claves olvidadas: se piden al administrador |
| Club | Programa de fidelización de clientes corporativos con premio genérico |
| Venta restringida | **Apagada** |

## 4. Módulos

Todo lo de raveV2 (completo) **más**: multisucursal y tesorería con traspasos y comprobante, **Centro Inteligente** con mapa básico automático, chat con los asistentes y alertas de 4 prioridades, **equipo SVB R2AVE** (R2AVE coordinador; M2ARGOTH guardián; T2ULUZ explorador; S2HAKIRA segunda opinión; VÉRTICE Comercial, NÉBULA Marketing, QUANTUM Inventario, ORIÓN Finanzas, ATENEA RR. HH., NEXUS Datos e IA) y el **centro de operaciones vivo** 2.5D con datos reales rotulados. Sólo lectura, salvo la corrección de stock de R2AVE (apagada hasta que el administrador la habilita, con permiso, confirmación, idempotencia y auditoría `R2AVE_AJUSTE`). Sin editor del local ni plano de ejemplo, sin personal con fotos. R2AVE en Telegram se muestra como **demostración simulada** (el bot real es sólo del cliente).

**Atención al cliente** completa (canales de demostración rotulados, colas por departamento Ventas · Soporte · Cobranzas, turnos, cobros con link fijo validado, CSAT/NPS, analíticas, alertas ERP, campañas asistidas) con mensajes de ejemplo genéricos (sin productos de rubro chico).


## Recursos Humanos (V26.64)

Módulo de la sección 7-ter del esqueleto. **En esta demo: Plan Completo** (14 legajos activos de ejemplo): portal del empleado, aprobaciones Supervisor → RR. HH. → Administración, nómina interna, documentos con vencimientos, reclutamiento Kanban, vacaciones y tablero por área. El plan lo decide sola la cantidad de legajos activos (0–10 Micro, 11 o más Completo); el botón «+ Personal de ejemplo» / «Dar de baja el de ejemplo» de la pestaña *Plan y resumen* muestra la transición automática. Fichaje en kiosco con PIN (bloqueo tras 5 intentos), QR, NFC y geocerca; rostro y huella figuran como **pendientes de dispositivo y revisión legal**. Usuario de prueba del portal del empleado: **Empleado (portal) · 2222**. Nómina, firma y archivos bancarios son internos y se rotulan [VERIFICAR] (no reemplazan el recibo legal ni la firma digital).

## Finanzas y Contabilidad (V26.72)

Módulos de la sección 7-quater del esqueleto, en la sección **Finanzas** del menú. **Finanzas** (permiso `finance`; editar con `finance_edit`): tablero con efectivo en cajas abiertas, bancos, a cobrar (cuentas corrientes + tarjetas y billeteras por acreditar), a pagar (proveedores + compromisos) y margen neto estimado; **flujo de fondos proyectado** de 4, 8 o 12 semanas con gráfico y alertas de bache; rentabilidad por operación; **conciliación asistida** del extracto bancario (CSV); tablero de cobros digitales; copiloto de reglas (sin IA ni costo). **Contabilidad** (permiso `accounting`; administrar con `accounting_admin`): asientos de partida doble generados solos desde cada operación, con huella SHA-256 y **cierre de período encadenado**; Libro Diario, Mayor, Sumas y saldos, pre-liquidación de IVA, plan de cuentas modelo editable [VERIFICAR con el contador]. Rol **Contador** de sólo lectura. Es contabilidad de **gestión**: no reemplaza libros legales ni la DDJJ. La pasarela **VB Pay** queda preparada y **apagada** (falta cuenta del procesador y credenciales).

**En el código fuente: encendidos** con datos de ejemplo y usuario **Contador · 4444**. **raveV3 no se republicó en V26.72** (decisión del dueño: «Dejar raveV3 como está»; además otra sesión publicó un módulo de seguridad directo en su `index.html`). Al retomarlo, integrar esos cambios antes de publicar.


> **V26.73 (Omni-Assist y Notificaciones push):** están en el código fuente y funcionan en este perfil, pero **no se publicaron en esta demo**: el dueño pidió trabajar sólo en Almacén RAVE. Se publican cuando lo pida.

> **V26.74 (CRM omnicanal y Finanzas para comercios):** en el código fuente y probados en este perfil; **no publicados en esta demo** (el dueño pidió sólo Almacén RAVE).
> **V26.75 (tienda pública premium):** en el código fuente y probada en este perfil; **no publicada en esta demo** (sólo Almacén RAVE).

## 5. Diseño

Sección 7 del esqueleto completa (barra oscura, «Vender POS [F1]» azul con letra negra, Ctrl + K, campana, avatar, pestañas, línea de ayuda por pantalla, **tablero del turno** en caja con estado, 4 pasos e indicadores, tablas con encabezado fijo, transición suave, tema claro/oscuro, ≥ 44 px, 320–1440 px). El Centro Inteligente conserva su estética oscura con el acento azul claro.

## 6. Compilar, probar y publicar

```bash
cd AlmacenRAVE/fuente
python3 assemble.py && python3 build.py v3 /tmp/rave/v3.html && rm -f all.js
cd pruebas && python3 gen1.py v3 && python3 v3b.py && python3 vv1.py && python3 ci6.py
# regresión completa de los cuatro perfiles (esqueleto §10)
cp /tmp/rave/v3.html ../../../ravev3/index.html    # commit con atribución y push en raveV3
```

`gen1.py v3` falla ante cualquier palabra de rubro chico o bebidas en el menú y en las 29 pantallas, y exige el tablero del turno.

## 7. Reversión

«Desactivar» en el Centro (inmediato) → compilar con `R2AVE=0` → volver a publicar el `index.html` anterior de raveV3.

## 8. Pendientes que decide el dueño (no se implementan en silencio)

- Figura extra «NÉRULA / Investing» de la imagen guía (¿integrante 11 o error?).
- Que algún especialista ejecute acciones (p. ej. NÉBULA enviando promociones): requiere autorización, integración real y pruebas.
- Modelos 3D con esqueleto (artista 3D + motor WebGL ~600 KB + revisión de CSP).
- Módulos empresariales especificados y no construidos: pedidos de venta y remitos encadenados, lotes/FEFO, cierre ciego (4.22 F2–F7 del maestro). La contabilidad con asientos ya existe (V26.72) pero raveV3 todavía no la publicó.

## 9. Prompt de arranque

> Leé `PROMPT_FINAL_RAVEV3.md` (principio rector primero), `PROMPT_ESQUELETO_VB.md` y `SISTEMA_VB_26F.md`. Compilá `v3`, corré `gen1.py v3`, `v3b.py`, `vv1.py`, `ci6.py` y la regresión. Hacé el cambio pedido con **visión empresarial** (sin rubros de comercio chico ni leyendas de bebidas, sin datos de clientes), detrás de banderas y con pruebas; publicá raveV3 y entregame un informe honesto.
