// Punto de entrada de la Edge Function "tiendanube" (Supabase / Deno).
// Variables que ya existen en Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Secretos que carga Vincular Business (NO van al repositorio):
//   TN_APP_ID        número de la app en el Portal de Socios de Tiendanube
//   TN_CLIENT_SECRET secreto de esa app (también firma los webhooks)
//   TN_MASTER_KEY    32 bytes aleatorios en base64:  openssl rand -base64 32   (cifra el token de cada tienda)
//   APP_URL          dirección del sistema a donde se vuelve después de autorizar (https://…)
// Opcionales: ALLOWED_ORIGINS, TN_USER_AGENT, TN_API_BASE, TN_AUTH_BASE, FUNCTION_URL.
import { manejar, type Entorno } from "./handler.ts";

Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = {
    SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    TN_APP_ID: e("TN_APP_ID"), TN_CLIENT_SECRET: e("TN_CLIENT_SECRET"), TN_MASTER_KEY: e("TN_MASTER_KEY"), APP_URL: e("APP_URL"),
    ALLOWED_ORIGINS: e("ALLOWED_ORIGINS"), TN_USER_AGENT: e("TN_USER_AGENT"), TN_API_BASE: e("TN_API_BASE"), TN_AUTH_BASE: e("TN_AUTH_BASE"), FUNCTION_URL: e("FUNCTION_URL"),
  };
  return manejar(req, env);
});
