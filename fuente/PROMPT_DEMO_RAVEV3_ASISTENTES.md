# SISTEMA VB · PROMPT DE VERSIÓN — DEMO «CON ASISTENTES INTELIGENTES SVB R2AVE» (repositorio `raveV3`)

**Versión:** V26.44 · 2026-11-02 · **Producto:** SISTEMA VB de **VINCULAR BUSINESS** · **Publicación:** `https://raveholding.github.io/raveV3/`
**Para qué es:** la demo «como Almacén RAVE» (rubros por persona, socios, reparto y cierre por rubro, Club, mayorista/minorista) **más el Centro Inteligente con el equipo oficial SVB R2AVE** y su centro de operaciones vivo. Acá se desarrolla y se prueba todo lo de asistentes antes de decidir si se lleva a Almacén RAVE.

> Los requisitos de cada módulo están en el prompt maestro genérico `SISTEMA_VB_26F.md`. Este prompt agrega lo propio de esta versión: el equipo SVB R2AVE (especificación del 2026-11-01), el **centro inteligente vivo** (especificación del 2026-11-02) y el **principio rector de integridad**, que manda sobre todo lo demás. Si hay conflicto, el orden es: **principio rector → este prompt → maestro**.

---

## 0. PRINCIPIO RECTOR ABSOLUTO (manda sobre todo)

La prioridad máxima es **no cometer errores que comprometan el sistema, los datos, las operaciones ni la actividad comercial**. Lo visual nunca tiene prioridad sobre la integridad.

**Jerarquía innegociable:**
1. Integridad de datos y operaciones.
2. Seguridad.
3. Exactitud.
4. Estabilidad y compatibilidad.
5. Prevención y recuperación de errores.
6. Calidad del software.
7. Rendimiento.
8. Experiencia de usuario.
9. Calidad visual y espectacularidad 3D.

- **No suponer.** No inventar funciones, servicios, tablas, datos ni integraciones. Lo incierto se identifica, se documenta y se verifica.
- **Proteger el sistema original:** ventas, POS, caja, arqueos, inventario, compras, clientes, proveedores, RR. HH., sincronización, permisos, multicomercio y multisucursal. Nada destructivo sobre el núcleo.
- **Validar antes de implementar:** inspeccionar el código, identificar dependencias y efectos, diseñar, escribir las pruebas de aceptación e implementar aislado.
- **Pruebas obligatorias:** funcionales, de permisos, de datos, de regresión, de rendimiento y de recuperación ante fallos, incluidos los escenarios negativos.
- **Información con fuente:** no se inventan ventas, stock, costos, clientes, asistencias ni estados. Se distinguen datos reales, simulación visual, estimación y demostración. **Una animación de un personaje trabajando no es una operación.**
- **Versiones y reversión:** respaldo verificable, registro de archivos cambiados y procedimiento de reversión probado.
- **Criterio de detención:** ante un error crítico, una inconsistencia o una dependencia sin verificar, se detiene lo afectado, se corrige, se vuelve a probar y se documenta. No se oculta.
- **Publicación:** auditoría, pruebas, regresión, seguridad, respaldo, reversión, demostración y **autorización expresa del dueño**. Aprobar una imagen o una maqueta no es aprobar una implementación.
- **Regla final:** un trabajo no está terminado porque se vea bien. Está terminado cuando funciona, está validado, es seguro y hay evidencia.

## 1. Mapa de versiones (ver también el prompt de raveV2)

| Versión | Repositorio | Compilación | Asistentes |
|---|---|---|---|
| Cliente Almacén RAVE (producción) | `AlmacenRAVE` | `cliente` | Centro Inteligente V26.41 apagado; **sin** SVB R2AVE hasta que el dueño apruebe raveV3 |
| Demo mayorista | `KiniDistribuidoraDemo` | `kini` | No |
| Demo un solo dueño | `raveV2` | `solo` | No |
| **Demo con asistentes** (ESTA) | `raveV3` | `v3` | **Sí**: Centro Inteligente + equipo SVB R2AVE + centro vivo |

Una sola fuente de código (`AlmacenRAVE/fuente`, rama de trabajo `centro-r2ave`). La compilación `v3` es la **única** que incluye `p10b-r2ave.js` (equipo) y `p10c-vivo.js` (centro vivo). La base local propia es `rave-v3-demo-v1`.

## 2. El equipo oficial SVB R2AVE

**Identidad.** La imagen original del dueño manda en identidad, diseño, anatomía, proporciones, vestimenta, armaduras, colores y materiales. No se rediseña ni se generan versiones alternativas. Las fichas usan recortes de esa imagen.

| Integrante | Identidad | Rol | Puede modificar datos |
|---|---|---|---|
| **R2AVE** | Humanoide demoníaco: cráneo metálico, cuernos, capucha oscura, ojos rojos | Asistente principal y coordinador; mano derecha del dueño | **Sólo** corrección de inventario (`inventory.stock.adjust`), apagada hasta que el administrador la habilita, limitada por el permiso del usuario (`edit_products`), con confirmación, idempotencia y auditoría, usando el servicio existente `stockAdjust` |
| **M2ARGOTH** | Cane Corso robótico, armadura negra y roja, ojos rojos | Guardián: alertas, anomalías, dispositivos desconectados, riesgos | No (no es una cámara: no hay integración física) |
| **T2ULUZ** | Drone esférico negro y rojo | Explorador: mapa, depósito, recepción y despacho | No (sus movimientos son una representación digital) |
| **S2HAKIRA** | Perra holográfica cian/turquesa | Segunda opinión con criterio propio: tendencias, omisiones, clientes | No |

Jerarquía: dueño → R2AVE → M2ARGOTH, T2ULUZ y S2HAKIRA. El dueño tiene siempre la última palabra. Las capacidades futuras de R2AVE (pedidos de compra, promociones, precios, tareas y aprobaciones) están **deshabilitadas** hasta que el dueño las autorice.

## 3. Centro de operaciones vivo (especificación del 2026-11-02)

**Lo pedido:** un centro tecnológico 3D vivo, con los cuatro integrantes de **cuerpo completo** que caminan, trabajan, colaboran, vuelan e interactúan. Las fichas con caras no son la representación principal. Hay que reconstruir la arquitectura de la imagen de referencia (estaciones, monitoreo, análisis, comunicaciones, laboratorio, descanso, pasarelas, plataformas y pantallas holográficas gigantes), con luces rojo/cian, sombras y reflejos dinámicos, partículas, cámara orbital, zoom, seguimiento individual, rutinas propias, reacción a acontecimientos y la simulación separada de lo real.

**Lo construido en V26.43** (`p10c-vivo.js`):
- **Escena 2.5D propia en `<canvas>`**:
  - Centro de coordinación con anillos holográficos.
  - Estación de R2AVE, sala de monitoreo con pantallas, área de análisis con holograma, laboratorio y hangar del drone, centro de comunicaciones con antena, zona de descanso.
  - Pasarela elevada con baranda, columnas con franjas de luz y pasillos iluminados.
  - Suelo reflectante con grilla.
  - **Tres pantallas holográficas gigantes con datos reales**: ventas de hoy, alertas y compras pendientes.
- **Los cuatro de cuerpo completo**, dibujados y animados en tiempo real con los rasgos y colores de la imagen oficial:
  - **R2AVE:** piernas articuladas, túnica rasgada con humo rojo, brazos que caminan, trabajan, señalan y gesticulan, capucha, cráneo, cuernos y ojos rojos.
  - **M2ARGOTH:** marcha de cuatro patas en diagonal, armadura roja, cresta, se sienta, se acuesta y olfatea.
  - **S2HAKIRA:** holograma cian translúcido con brillo, líneas de barrido, cola que se mueve, pulso de base y desmaterialización parcial.
  - **T2ULUZ:** vuela en altura con sombra en el piso, rotores girando, luces y un haz de proyección hacia R2AVE.
- **Vida autónoma:**
  - Navegación con aceleración y giro suaves, separación entre ellos y rodeo de estaciones (sin teletransportes: está probado).
  - Rutinas propias: R2AVE trabaja, coordina e inspecciona; M2ARGOTH acompaña, patrulla o descansa; S2HAKIRA sigue a R2AVE y juega con M2ARGOTH; T2ULUZ inspecciona, proyecta, aterriza y recorre.
  - Reuniones periódicas en el centro de coordinación.
- **Conexión con lo real**, rotulada «● Real». Lo ambiental se rotula «○ Simulación».
  - Con alertas importantes, M2ARGOTH va a vigilar el monitoreo.
  - Una consulta al chat lleva a R2AVE a responder al centro de coordinación.
  - Una corrección de stock de R2AVE lo lleva a su estación.
  - Con pedidos de compra pendientes, T2ULUZ va a recepción.
  - Con oportunidades, S2HAKIRA las señala.
- **Cámara:**
  - Vista general, zoom progresivo y órbita (botones y arrastre), movimiento con zoom y enfoque de estaciones.
  - **Seguir a un integrante**: la cámara se acerca y lo muestra de cuerpo completo; también tocándolo en la escena.
- En el **mapa del local** los cuatro también aparecen de cuerpo completo. Las fichas con fotos quedan plegadas.
- **V26.44 · Equipo de 10 según la imagen guía** («Equipo SVB R2AVE · 10 especialistas inteligentes», entregada por el dueño):
  - Se suman seis especialistas: **VÉRTICE** (Comercial), **NÉBULA** (Marketing), **QUANTUM** (Inventario), **ORIÓN** (Finanzas), **ATENEA** (RR.HH.) y **NEXUS** (Datos e IA).
  - Sus fichas usan recortes de la imagen guía (no se rediseñan). La imagen guía completa queda en «Imagen oficial del equipo».
  - En el centro vivo cada uno tiene su plataforma holográfica y su consola, se dibuja de cuerpo completo con sus rasgos (armadura roja y negra, capucha y capa, armadura pesada, abrigo con la V azul, androide plateado) y trabaja con una tableta holográfica.
  - Escenografía de la imagen guía: globo holográfico central, cartel «SVB R2AVE · Centro Inteligente», estandartes con la calavera roja y los carteles «Equipo SVB R2AVE · 10 especialistas inteligentes» y «Un equipo · Una visión».
  - **Sólo leen datos de su área**, con el rótulo Real/Simulación: VÉRTICE ventas de hoy; NÉBULA cupones activos y socios del Club; QUANTUM stock bajo y negativo; ORIÓN cajas abiertas y ventas por medio de pago; ATENEA personal y fichadas (sólo con permiso de personal); NEXUS auditoría y estado de la nube.
  - Se les puede preguntar desde el chat del Centro: cada uno responde con los datos reales de su área. Ninguno modifica nada: la única capacidad de escritura sigue siendo la corrección de stock de R2AVE (QUANTUM tampoco puede).
  - En el **mapa del local** siguen apareciendo sólo los cuatro originales; los especialistas están en el centro de operaciones.
- **Accesibilidad y cuidado del sistema:**
  - Tabla alternativa: dónde está cada uno, qué hace y si es real o simulación.
  - Resumen para lectores de pantalla.
  - Pausa cuando la escena no se ve; con «reducir movimiento» queda quieta.
  - Unos 30 cuadros por segundo.
  - Fallas atajadas: el Centro sigue funcionando.
  - **Sólo lectura**: está probado que no cambia productos, ventas, movimientos, fichadas ni cierres.

**Lo que NO se cumple todavía (dicho con claridad, por el principio rector):**
- **No son modelos 3D con esqueleto (rigging) ni WebGL.** Son figuras dibujadas en 2.5D. Para modelos 3D reales hacen falta tres cosas:
  1. Que un artista 3D modele los cuatro personajes desde la imagen oficial (archivos glTF con esqueleto y animaciones).
  2. Un motor WebGL incluido dentro del archivo (por ejemplo three.js, ~600 KB).
  3. La autorización del dueño para ese peso y para revisar la política de seguridad (CSP).

  Con esos archivos, el centro vivo ya tiene preparados el comportamiento, la cámara y la conexión con datos para reemplazar el dibujo por los modelos.
- **No hay sombras ni iluminación física reales:** son luces y sombras dibujadas (resplandores, sombras de contacto y reflejos en el piso).
- **No hay navegación por rutas sobre una malla:** se usa navegación por dirección con rodeo de obstáculos, y no hay niveles caminables (la pasarela es decorativa).
- **No hay rotación libre de cámara en altura (inclinación):** sólo hay órbita horizontal.

## 4. Lo que ya hacía el Centro con R2AVE (V26.42, se conserva)

- Gerente IA como R2AVE, con selector de quién responde y tipo de respuesta.
- Centro de alertas con 4 prioridades.
- Oficina de RR. HH. que lee el fichaje.
- Recepción y despacho.
- Zonas del local y plano de ejemplo SVB.
- Zoom y movimiento del mapa.
- Integraciones con su estado real.
- Permisos de los asistentes (administrador).
- Corrección de stock en 14 pasos con auditoría `R2AVE_AJUSTE`.

Detalle completo en el **Anexo P** del maestro.

## 5. Compilar, probar y publicar

```bash
cd AlmacenRAVE/fuente           # rama centro-r2ave
python3 build.py v3 /tmp/rave/v3.html && rm -f all.js
cd pruebas && python3 vv1.py && python3 ci6.py     # 43 + 63 verificaciones del equipo y del centro vivo
# regresión: ci1–ci5 v1 v2 v4–v7 d1 p1 ws1 h1 h3 g1–g3 k1–k4 kc1 kn2 kn3 resp4 pq1 sv1
cp /tmp/rave/v3.html ../../../ravev3/index.html     # commit y push en raveV3
```

Qué cubre `vv1`:
- La escena es el primer panel y las fichas quedan plegadas.
- Al menos tres integrantes se desplazan solos y la escena se anima a más de 20 cuadros por segundo.
- **No hay saltos** (el máximo en 0,1 s es menor a 0,8 m de escena) y T2ULUZ vuela en altura.
- Cada integrante se dibuja **de cuerpo completo**: R2AVE mide más de 150 px de pies a cuernos con 70 px por metro.
- La cámara sigue, centra, orbita, hace zoom, enfoca estaciones y vuelve a la vista general.
- Las alertas reales mueven a M2ARGOTH (rotulado Real) y una consulta real lleva a R2AVE a responder (Real); las animaciones dicen Simulación.
- La tabla alternativa funciona y hay nota honesta de que no son modelos 3D con esqueleto.
- Están los **diez** integrantes, cada uno de cuerpo completo y con botón para seguirlo; QUANTUM muestra el stock bajo real; ORIÓN y NÉBULA responden con datos reales; QUANTUM no puede corregir stock.
- Es de **sólo lectura**: los datos del negocio no cambian.
- En el mapa del local aparecen los cuatro de cuerpo completo.
- La animación se pausa fuera de la pantalla.
- Una falla del dibujo queda en el registro sin romper el Centro.
- A 390 px no desborda y los controles miden 44 px o más.
- Con «reducir movimiento» queda quieta.
- No hay errores de consola.

## 6. Reversión

1. «Desactivar» en el Centro (inmediato).
2. Compilar la demo con `R2AVE=0` (sin equipo ni centro vivo).
3. Volver a publicar el `index.html` anterior de raveV3.
4. La rama `centro-r2ave` no se une a `main` de AlmacenRAVE sin autorización del dueño.

## 7. Contradicciones a resolver con el dueño (no se implementan en silencio)

- **Resuelto en V26.44:** los «diez asistentes» y QUANTUM salen de la imagen guía. **Pendiente:** la imagen tiene una figura extra (encapuchada, entre NÉBULA y R2AVE) con el rótulo ilegible «NÉRULA / Investing», que sería el integrante número 11. No se agregó: el dueño tiene que decir si es un error del dibujo o un integrante más (nombre, rol e imagen).
- **Funciones de los especialistas:** hoy sólo consultan. Si el dueño quiere que alguno haga algo (por ejemplo, NÉBULA enviando promociones), hace falta la autorización, la integración real (WhatsApp Business o correo) y pruebas.
- **Modelos 3D reales con esqueleto:** los puntos 2 y 3 de la sección 3.
- **Llevar R2AVE y el centro vivo a Almacén RAVE:** sólo con la demostración aprobada en raveV3.
