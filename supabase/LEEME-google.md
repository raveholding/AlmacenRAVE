# Ingreso con Google y recuperación de acceso · Almacén RAVE

Guía para dejar funcionando **«Ingresar con Google»** y la **recuperación de acceso** del equipo.
El sistema muestra este mismo paso a paso, con los valores exactos y un control en vivo, en
**Configuración → Equipo y seguridad → Ingreso con Google (configuración)** (y en *Usuarios y permisos*, *Nube*).

Valores de Almacén RAVE (proyecto Supabase `rdvwrrroerxikfqvpgnh`):

| Dónde | Campo | Valor |
|---|---|---|
| Google Cloud → Credenciales → ID de cliente OAuth (Aplicación web) | Orígenes de JavaScript autorizados | `https://raveholding.github.io` |
| ídem | URI de redireccionamiento autorizados | `https://rdvwrrroerxikfqvpgnh.supabase.co/auth/v1/callback` |
| Supabase → Authentication → URL Configuration | Site URL | `https://raveholding.github.io/AlmacenRAVE/` |
| ídem | Redirect URLs | `https://raveholding.github.io/AlmacenRAVE/**` |
| Supabase → Edge Functions → Secrets (función `llave`) | `LLAVE_MASTER_KEY` | 32 bytes al azar en base64 (botón «Generar un valor» en el sistema, o `openssl rand -base64 32`) |
| ídem | `ALLOWED_ORIGINS` | `https://raveholding.github.io` |

## A · Google Cloud: la «llave» de Google (ID y secreto de cliente)
1. <https://console.cloud.google.com/apis/credentials> con la cuenta de Google del negocio. Crear un proyecto si no hay (ej. «Sistema RAVE»).
2. **Pantalla de consentimiento de OAuth** (la primera vez): tipo **Externo**, nombre de la app, correo de soporte, guardar. Luego **Publicar la app**: si queda «En prueba», sólo pueden entrar los correos cargados como *usuarios de prueba*.
3. **Crear credenciales → ID de cliente de OAuth → Aplicación web**, con los orígenes y la URI de la tabla.
4. Copiar el **ID de cliente** y el **Secreto del cliente**. El secreto **no** se manda por chat/WhatsApp ni se escribe en el sistema: se pega directo en Supabase.

## B · Supabase: activar Google
1. *Authentication → Sign In / Providers → Google*: activar, pegar ID y secreto, **Save**.
2. *Authentication → URL Configuration*: Site URL y Redirect URLs de la tabla.
3. En el sistema: *Volver a verificar* → «Proveedor Google en Supabase ✔». El botón **Ingresar con Google** aparece solo en la pantalla de ingreso.

Cada persona entra con **el mismo Gmail con el que fue invitada**. La primera vez en cada equipo se pide la clave del sistema (para abrir los datos cifrados), salvo que se active el paso C.

## C · (Opcional) «Ingreso sólo con Google»: función `llave`
Permite entrar con Google **sin** la clave del sistema en cualquier equipo.
1. *Edge Functions → Deploy a new function → Via Editor*: nombre `llave`, pegar `supabase/despliegue-panel/llave-index.ts`, **Deploy**. En sus ajustes **apagar «Verify JWT»** (la función valida la sesión adentro).
2. *Edge Functions → Secrets*: `LLAVE_MASTER_KEY` y `ALLOWED_ORIGINS` (tabla). Guardar `LLAVE_MASTER_KEY` en un lugar seguro.
3. Requiere `15-custodia-google.sql` aplicado. En el sistema: *Usuarios y permisos → Ingreso sólo con Google → Activar*.

## Recuperar el acceso de alguien del equipo (sin Google)
Requiere `24-restablecer-acceso.sql` aplicado en Supabase (SQL Editor → pegar el contenido → Run).
1. El administrador: *Usuarios y permisos → Equipo* → **Restablecer acceso** al lado de la persona.
2. El sistema muestra una **clave temporal** (y el mensaje listo para WhatsApp).
3. La persona entra por **Ingresar** con su correo y esa clave (sirve en minúsculas o sin guiones) y elige su contraseña nueva. No pierde nada.

Límites (por seguridad, iguales a `03`): no sirve para otro administrador ni para personas que también están en otro comercio; esos casos los resuelve soporte de Vincular Business con `soporte_restablecer_clave` desde el SQL Editor. Si el **administrador** olvida su contraseña: «Olvidé mi contraseña» (correo) y después su **código de recuperación**, o «Ingresar con Google» si está configurado.

## Si algo falla
- **`redirect_uri_mismatch`** en Google: la URI de redireccionamiento no es exactamente la de la tabla (sin barra final, con `https`).
- **Vuelve de Google a otra página** o pide entrar de nuevo: falta la *Redirect URL* en Supabase (paso B-2).
- **«La cuenta de Google que elegiste no está asociada a este comercio»**: la persona usó otro Gmail; tiene que ser el de la invitación (o el administrador la invita con ese Gmail).
- **«Falta configurar la función llave»**: paso C (sólo si se quiere entrar sin la clave del sistema).
