// Punto de entrada de la Edge Function «reparto-pro» (conectores Pro del reparto). Desplegar con «Verify JWT» APAGADO.
// Secretos (Supabase → Edge Functions → Secrets; nunca en el repositorio, el chat ni el navegador):
//   GOOGLE_ROUTES_KEY                 clave de Google Maps Platform con «Routes API» habilitada
//   MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET  Mercado Pago (credenciales de producción) y la clave secreta de notificaciones
//   WA_TOKEN, WA_PHONE_ID             WhatsApp Cloud API (token permanente del usuario del sistema y el ID del número)
//   WA_TEMPLATE, WA_LANG              plantilla aprobada con 1 variable en el cuerpo (p. ej. «pedido_salio») y su idioma (es_AR)
//   FUNCTION_URL                      https://<proyecto>.supabase.co/functions/v1/reparto-pro (para el aviso de Mercado Pago)
//   ALLOWED_ORIGINS                   https://raveholding.github.io
import { manejar, type Entorno } from "./handler.ts";
Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = { SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ALLOWED_ORIGINS: e("ALLOWED_ORIGINS"), GOOGLE_ROUTES_KEY: e("GOOGLE_ROUTES_KEY"), MP_ACCESS_TOKEN: e("MP_ACCESS_TOKEN"), MP_WEBHOOK_SECRET: e("MP_WEBHOOK_SECRET"),
    WA_TOKEN: e("WA_TOKEN"), WA_PHONE_ID: e("WA_PHONE_ID"), WA_TEMPLATE: e("WA_TEMPLATE"), WA_LANG: e("WA_LANG"), FUNCTION_URL: e("FUNCTION_URL") };
  return manejar(req, env);
});
