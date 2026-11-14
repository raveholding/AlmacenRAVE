// Punto de entrada de la Edge Function «conectar» (conexión automática OAuth de Gmail, Outlook y Meta) · V26.74
// Desplegar con «Verify JWT» APAGADO. Secretos (Supabase → Edge Functions → Secrets; nunca en el repositorio, el chat ni el navegador):
//   OAUTH_KEY         32+ caracteres al azar (cifra los tokens; usar el MISMO en la función «canales»)
//   CANALES_COMERCIO  código del comercio (p. ej. almacen-rave)       FUNCTION_URL  https://<proyecto>.supabase.co/functions/v1/conectar
//   ALLOWED_ORIGINS   https://raveholding.github.io
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET      (Google Cloud → OAuth; redirección = FUNCTION_URL?c=cb)
//   MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT   (Microsoft Entra → App registrations; MS_TENANT opcional, por defecto «common»)
//   META_APP_ID, META_APP_SECRET, META_CONFIG_ID (Meta for Developers → Facebook Login for Business → configuración de Embedded Signup)
import { manejar, type Entorno } from "./handler.ts";
Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = { SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ALLOWED_ORIGINS: e("ALLOWED_ORIGINS"), FUNCTION_URL: e("FUNCTION_URL"), CANALES_COMERCIO: e("CANALES_COMERCIO"), OAUTH_KEY: e("OAUTH_KEY"),
    GOOGLE_CLIENT_ID: e("GOOGLE_CLIENT_ID"), GOOGLE_CLIENT_SECRET: e("GOOGLE_CLIENT_SECRET"), MS_CLIENT_ID: e("MS_CLIENT_ID"), MS_CLIENT_SECRET: e("MS_CLIENT_SECRET"), MS_TENANT: e("MS_TENANT"),
    META_APP_ID: e("META_APP_ID"), META_APP_SECRET: e("META_APP_SECRET"), META_CONFIG_ID: e("META_CONFIG_ID") };
  return manejar(req, env);
});
