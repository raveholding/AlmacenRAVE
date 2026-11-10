# SISTEMA VINCULAR BUSINESS · PROMPT FINAL — KiniDistribuidoraDemo (distribuidora sólo mayorista)

**Versión:** V26.63 · 2026-11-10 · **Repositorio:** `KiniDistribuidoraDemo` → `https://raveholding.github.io/KiniDistribuidoraDemo/` · **Perfil:** `kini` · **Base local:** `rave-kini-demo-v2`
Desarrollado por **VINCULAR BUSINESS** · Celular **(387) 4484132** · **https://www.vincularbusiness.com.ar/** · **vincularbusiness@gmail.com** · «Tu idea, en buenas manos.»

> Orden de lectura: este prompt → `PROMPT_ESQUELETO_VB.md` V27.2 → `SISTEMA_VB_26F.md` (4.22 mayorista y anexos F, S). Si difieren, para esta demo manda este prompt.

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
| Clientes | 5 clientes mayoristas con CUIT, crédito, plazo y acuerdos de ejemplo |
| Venta restringida | **Encendida** (vende bebidas con alcohol: control de edad, horario configurable, tabaco sin promociones) |

## 3. Módulos

Todos completos: Resumen «Hoy», Vender mayorista (tramos, presentaciones, código de barras por presentación), **Gestión de caja** con tablero del turno, Stock por presentación (desglose «3 Pallet + 2 Fardo…»), Presupuestos, Mermas, Proveedores y compras, Club, **Atención al cliente** completa (canales de demostración rotulados, departamentos Ventas · Soporte · Cobranzas, cobros, turnos, analíticas, alertas, campañas), Personal, Tareas, Menú/tienda con envíos por provincia, Legales, Periféricos, Importar/Exportar, Auditoría, Configuración. Sin Centro Inteligente.

## 4. Diseño

Sección 7 del esqueleto con la paleta Kini (contraste AA verificado por `kc1`): línea de ayuda por pantalla, tablero del turno en caja, tablas con encabezado fijo, pestañas, Ctrl + K, tema claro/oscuro, ≥ 44 px.

## 5. Compilar, probar y publicar

```bash
cd AlmacenRAVE/fuente
python3 assemble.py && python3 build.py kini /tmp/rave/kini.html && rm -f all.js
cd pruebas && python3 kn1.py && python3 kn2.py && python3 kn3.py && python3 kc1.py
# regresión completa de los cuatro perfiles (esqueleto §10)
cp /tmp/rave/kini.html ../../../kinidistribuidorademo/index.html   # commit con atribución y push
```

## 6. Pendientes (decide el dueño o depende de terceros)

Pedidos de venta → picking → remito → factura → recibo, lotes/FEFO, cierre ciego, cheques/eCheq y contabilidad (4.22 F2–F7, especificados); logo y paleta definitivos del cliente; integraciones reales (Meta, ARCA producción, Mercado Pago).

## 7. Prompt de arranque

> Leé `PROMPT_FINAL_KINI.md`, `PROMPT_ESQUELETO_VB.md` y `SISTEMA_VB_26F.md` (4.22). Compilá `kini`, corré `kn1`–`kn3`, `kc1` y la regresión. Hacé el cambio pedido respetando la marca Kini y el canal sólo mayorista, con pruebas; publicá KiniDistribuidoraDemo y entregame un informe honesto.
