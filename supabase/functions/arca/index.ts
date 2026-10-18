// Punto de entrada de la Edge Function "arca" (Supabase / Deno).
// Variables que ya existen en Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Secreto que carga Vincular Business (NO va al repositorio):   ARCA_MASTER_KEY  = 32 bytes aleatorios en base64
//   supabase secrets set ARCA_MASTER_KEY="$(openssl rand -base64 32)"
// Opcionales: ALLOWED_ORIGINS (ej. https://raveholding.github.io), ARCA_*_URL_*, ARCA_QR_BASE.
import { manejar, type Entorno } from "./handler.ts";

Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = {
    SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ARCA_MASTER_KEY: e("ARCA_MASTER_KEY"), ALLOWED_ORIGINS: e("ALLOWED_ORIGINS"),
    ARCA_WSAA_URL_HOMO: e("ARCA_WSAA_URL_HOMO"), ARCA_WSAA_URL_PROD: e("ARCA_WSAA_URL_PROD"),
    ARCA_WSFE_URL_HOMO: e("ARCA_WSFE_URL_HOMO"), ARCA_WSFE_URL_PROD: e("ARCA_WSFE_URL_PROD"), ARCA_QR_BASE: e("ARCA_QR_BASE"),
  };
  return manejar(req, env);
});
