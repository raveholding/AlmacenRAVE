// Punto de entrada de la Edge Function «canales» (Atención al cliente: Telegram, WhatsApp Business, Instagram, Messenger y correo).
// Desplegar con «Verify JWT» APAGADO. Secretos (Supabase → Edge Functions → Secrets; nunca en el repositorio, el chat ni el navegador):
//   CANALES_COMERCIO   código del comercio (p. ej. almacen-rave)          FUNCTION_URL  https://<proyecto>.supabase.co/functions/v1/canales
//   TG_CLIENTES_TOKEN  token del bot de clientes (@BotFather)             TG_CLIENTES_SECRET  32+ caracteres al azar
//   META_VERIFY_TOKEN  texto al azar (el mismo que se pega en Meta)       META_APP_SECRET  clave secreta de la app de Meta
//   WA_TOKEN, WA_PHONE_ID  WhatsApp Cloud API                             META_PAGE_TOKEN  token de la página (Messenger e Instagram)
//   MAIL_IN_SECRET     texto al azar para el reenvío de correo            RESEND_API_KEY, MAIL_FROM  salida de correo (Resend)
//   ALLOWED_ORIGINS    https://raveholding.github.io
import { manejar, type Entorno } from "./handler.ts";
Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = { SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ALLOWED_ORIGINS: e("ALLOWED_ORIGINS"), FUNCTION_URL: e("FUNCTION_URL"), CANALES_COMERCIO: e("CANALES_COMERCIO"), TG_CLIENTES_TOKEN: e("TG_CLIENTES_TOKEN"), TG_CLIENTES_SECRET: e("TG_CLIENTES_SECRET"),
    META_VERIFY_TOKEN: e("META_VERIFY_TOKEN"), META_APP_SECRET: e("META_APP_SECRET"), META_PAGE_TOKEN: e("META_PAGE_TOKEN"), WA_TOKEN: e("WA_TOKEN"), WA_PHONE_ID: e("WA_PHONE_ID"),
    RESEND_API_KEY: e("RESEND_API_KEY"), MAIL_FROM: e("MAIL_FROM"), MAIL_IN_SECRET: e("MAIL_IN_SECRET") };
  return manejar(req, env);
});
