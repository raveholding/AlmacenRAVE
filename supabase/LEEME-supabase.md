> **Proyecto nuevo:** el proyecto Supabase anterior ya no existe. Para uno nuevo alcanza con pegar **el contenido** de `INSTALAR-TODO.sql` (= 01 a 08, sin el 00) en el SQL Editor y ejecutarlo una vez. Después: `select public.rave_invitar_comercio('correo','Almacén RAVE','CODIGO');`, desactivar «Confirm email» y desplegar la función `arca`.

# Supabase · proyecto raveholding · Sistema RAVE

Todo se hace con el **dueño del proyecto** (Vincular Business). Nada de esto va en el HTML.

## 0 · Antes de empezar
- **Backup** del proyecto (Database → Backups) por si ya tenía datos del sistema viejo.
- *Authentication → Providers → Email*: **«Confirm email» desactivado**.

## 1 · SQL (SQL Editor → pegar TODO el contenido del archivo → Run), en este orden
| Archivo | Para qué |
|---|---|
| `00-limpiar-proyecto-anterior.sql` | **OPCIONAL.** Sólo si el proyecto ya tuvo el sistema viejo `menu-rave`: mueve sus tablas al esquema `anterior_menu_rave` (no borra datos) y quita las funciones viejas de `public`. Si el proyecto está vacío, no hace falta. |
| `01-base.sql` | Comercios, equipo, invitaciones, claves. |
| `02-sincronizacion.sql` | Sincronización entre equipos, stock por movimientos, roles. |
| `03-recuperacion-soporte.sql` | Recuperación de clave y pedidos de ayuda. |
| `04-menu-publico.sql` | Menú público en la nube y alta al Club. |
| `05-arca.sql` | Facturación electrónica (tablas y funciones del CAE). |
| `06-v26.sql` | V26: borrado protegido y archivo de artículos (sólo administrador), cajas/sucursales/traspasos (colecciones `sucs`, `cajas`, `ctransf`). Aditivo e idempotente: si ya tenías 01 a 05, pegá sólo este. |
| `08-proveedores-compras.sql` | **Proveedores y compras (V26.2):** tablas `proveedores`, `ordenes_compra`(+detalles), `ingresos_mercaderia`(+detalles) y `cuenta_corriente_proveedores` (libro sólo-agregar), con RLS por comercio, y las funciones `procesar_recepcion` (stock + costo + deuda/caja en una sola transacción), pagos, notas de crédito y `compras_snapshot`. Aditivo e idempotente. **Requiere 06 y 07 ya aplicados.** |
| `90-reiniciar-pruebas.sql` | **SÓLO PRUEBAS. Borra lo subido por todos los comercios.** No correr con el sistema en uso real. |

Todos (menos 90) se pueden repetir sin romper nada.

## 2 · Crear el comercio del cliente (una vez, desde el SQL Editor)
```sql
select public.rave_invitar_comercio('correo-del-dueño@…', 'Almacén RAVE', 'CODIGO-DE-INVITACION');
```
El dueño abre el sistema → *Crear comercio* → usa ese correo, una contraseña propia y el código. El sistema le muestra **una sola vez** su código de recuperación (20 caracteres): tiene que guardarlo.
Slug resultante: `almacen-rave` (si ya existiera, agrega `-2`): tiene que coincidir con `RAVE_SLUG` al compilar.

## 3 · Función de ARCA (CAE automático)
```bash
supabase link --project-ref <ref>
supabase secrets set ARCA_MASTER_KEY="$(openssl rand -base64 32)"
supabase secrets set ALLOWED_ORIGINS="https://raveholding.github.io"
supabase functions deploy arca --no-verify-jwt   # la propia función valida al usuario con arca_quien()  [VERIFICAR flags vigentes del CLI]
```
- `ARCA_MASTER_KEY` cifra las claves privadas de ARCA en la base. **Guardala en un lugar seguro: si se pierde hay que regenerar los certificados.** No va al repositorio.
- Opcionales: `ARCA_WSAA_URL_HOMO/PROD`, `ARCA_WSFE_URL_HOMO/PROD`, `ARCA_QR_BASE`.
- Los nombres de menús, servicios y URLs de ARCA cambian: confirmar en arca.gob.ar [VERIFICAR].

## 4 · Primer CAE (lo hace el dueño dentro del sistema)
*Periféricos y ticket → Facturación electrónica (ARCA)*: datos del emisor → generar clave y CSR → trámite en la web de ARCA con Clave Fiscal → cargar el .crt → autorizar el servicio WSFE y crear el punto de venta «web services» → *Probar conexión* → activar. **Primero en homologación; producción sólo después de probar.**

## 5 · Seguridad que conviene verificar
- La clave **publicable** (`sb_publishable_…`) es la única que va en el HTML. La **secreta / service_role no** va en ningún lado fuera de Supabase.
- Si alguna clave del proyecto anterior (`menu-rave`) estuvo escrita en un HTML o repositorio público, **rotarla** en Supabase (Settings → API Keys).

## 6 · Pruebas incluidas (`tests/`)
`tests/run.sh` corre 152 comprobaciones SQL (aislamiento entre comercios, roles, stock, cierres, ARCA), `20-concurrency.sh` prueba dos cajas vendiendo a la vez y `functions/arca/arca_test.ts` (Deno) prueba la función contra un ARCA **falso**. Necesitan un Postgres/PostgREST local (`tests/mk-e2e-db.sh`). **No sustituyen la prueba en homologación con ARCA real.**

## Función `api` (REST de Proveedores y Compras) · opcional
La pantalla del sistema **no la necesita** (usa las funciones SQL con la sesión del usuario). Sirve para integrar otros sistemas. Se despliega igual que `arca` (ver `despliegue-panel/LEEME.md`), **sin ningún secreto propio**: usa `SUPABASE_URL` y `SUPABASE_ANON_KEY`, que Supabase ya provee, y reenvía el JWT del usuario; la base decide qué puede hacer. Rutas y formato en la sección 4.21 de `fuente/sistema_vb_26.md`.
