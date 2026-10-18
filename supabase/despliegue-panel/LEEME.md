# Desplegar la función `arca` desde el panel de Supabase (sin CLI)

`arca-index.ts` es la función `arca` en **un solo archivo** (core + handler + entrada), generada desde `functions/arca/`.
No se edita a mano: si cambia `functions/arca/*.ts`, se vuelve a generar con `python3 bundle_arca.py`.

1. Supabase → Edge Functions → *Deploy a new function* → *Via Editor*.
2. Nombre: `arca`. Pegar el contenido de `arca-index.ts` reemplazando todo. *Deploy function*.
3. En la función → *Details/Settings*: **desactivar «Verify JWT with legacy secret»** [VERIFICAR en el panel vigente]: la función valida sola la sesión del usuario y el comercio.
4. Edge Functions → *Secrets*: cargar `ARCA_MASTER_KEY` (32 bytes aleatorios en base64; **no** va en el repositorio) y `ALLOWED_ORIGINS=https://raveholding.github.io`.

---

# Función `api` (REST de Proveedores y Compras) · opcional

`api-index.ts` es la función `api` en un solo archivo (generada con `python3 bundle_api.py` desde `functions/api/`).
1. Supabase → Edge Functions → *Deploy a new function* → *Via Editor*. Nombre: `api`. Pegar `api-index.ts`. *Deploy function*.
2. **No** requiere secretos propios (usa `SUPABASE_URL` y `SUPABASE_ANON_KEY` del proyecto). Opcional: secreto `ALLOWED_ORIGINS=https://raveholding.github.io`.
3. Dejá activa la verificación de JWT: la función reenvía el token del usuario y las reglas (rol, comercio) las aplica la base de datos.
4. Cabeceras: `Authorization: Bearer <token>`, `X-Tenant-Id: <id del comercio>`, `Idempotency-Key` en las operaciones que escriben. Requiere haber aplicado `08-proveedores-compras.sql`.
