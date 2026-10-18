# Almacén RAVE · Sistema RAVE (Rave Holding)

Sistema de gestión (POS + inventario + caja + clientes + menú público) para **Almacén RAVE**.
Un solo archivo HTML5 (`index.html`): menú digital adelante, panel del equipo detrás de **Acceso del equipo** (`/#acceso`).
Funciona sin internet y sincroniza con la nube (Supabase) cuando hay conexión. **El proyecto Supabase anterior ya no existe: hay que crear uno nuevo** (ver «Conectar la nube»); no queda ninguna clave vieja que rotar.

## Versión: SISTEMA VB V26

El prompt maestro vigente está en `fuente/SISTEMA_VB_V26.md` (incluye un anexo *as-built* con lo que está hecho, probado y pendiente). Las pruebas automáticas están en `fuente/pruebas/`.

## Estado de esta entrega (leer antes de usar)

| Pieza | Estado |
|---|---|
| `index.html` | **Armado sin conexión a la nube**: el ingreso dice *Pendiente de configuración* hasta compilarlo con la URL y la clave **publicable** del proyecto (ver «Conectar la nube»). |
| Nube (Supabase) | Scripts SQL `supabase/00…06` + función `arca`. Probados con Postgres/PostgREST locales (no contra el proyecto real todavía). |
| CAE automático de ARCA | Implementado (servidor + navegador). **Sin probar contra ARCA real**: requiere certificado del comercio y prueba en homologación. Mientras tanto la venta «Con ARCA» queda *pendiente de CAE*. |
| Hardware (impresora, balanza, lector) | Sin probar con equipos reales [VERIFICAR por modelo]. |
| Textos legales | Plantillas [VERIFICAR] con asesor legal. |

## Conectar la nube (lo hace Rave Holding)

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

Desarrollado por Rave Holding · WhatsApp +54 9 387 514-3900 · raveholding@gmail.com
