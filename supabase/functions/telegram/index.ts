// Punto de entrada de la Edge Function "telegram" — R2AVE en Telegram (@R2aveBot). SÓLO Almacén RAVE.
// Se despliega con "Verify JWT" APAGADO (Telegram no manda sesión): la protege la cabecera secreta del webhook,
// y las acciones del sistema validan la sesión del administrador en la base.
// Variables que ya existen en Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Secretos que carga el administrador en Supabase → Edge Functions → Secrets (NO van al repositorio ni al chat):
//   TELEGRAM_BOT_TOKEN       el token que da @BotFather para @R2aveBot
//   TELEGRAM_WEBHOOK_SECRET  32+ caracteres aleatorios (A-Z a-z 0-9 _ -):  openssl rand -hex 32
//   TG_COMERCIO              almacen-rave   (el bot atiende a un solo comercio)
// Opcionales: ANTHROPIC_API_KEY (preguntas en lenguaje natural), TG_AI_MODEL, ALLOWED_ORIGINS, FUNCTION_URL.
import { manejar, type Entorno } from "./handler.ts";

Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = {
    SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    TELEGRAM_BOT_TOKEN: e("TELEGRAM_BOT_TOKEN"), TELEGRAM_WEBHOOK_SECRET: e("TELEGRAM_WEBHOOK_SECRET"), TG_COMERCIO: e("TG_COMERCIO"),
    ANTHROPIC_API_KEY: e("ANTHROPIC_API_KEY"), TG_AI_MODEL: e("TG_AI_MODEL"), ALLOWED_ORIGINS: e("ALLOWED_ORIGINS"), FUNCTION_URL: e("FUNCTION_URL"),
  };
  return manejar(req, env);
});
