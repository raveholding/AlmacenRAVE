// Punto de entrada de la Edge Function «llave» (Supabase / Deno). Ver handler.ts.
// Secreto (lo carga Vincular Business, nunca en el repositorio): LLAVE_MASTER_KEY = 32 bytes aleatorios en base64.
// «Verify JWT» apagado: la función valida la sesión adentro. Opcional: ALLOWED_ORIGINS.
import { manejar, type Entorno } from "./handler.ts";
Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = { SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "", LLAVE_MASTER_KEY: e("LLAVE_MASTER_KEY"), ALLOWED_ORIGINS: e("ALLOWED_ORIGINS") };
  return manejar(req, env);
});
