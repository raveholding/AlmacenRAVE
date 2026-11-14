// Punto de entrada de la Edge Function «mpago» (cobros de Mercado Pago Point) · V26.74 · «Verify JWT» APAGADO.
// Secretos: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_COMERCIO. En Mercado Pago Developers → Webhooks: URL = https://<proyecto>.supabase.co/functions/v1/mpago?c=webhook, evento «Pagos».
import { manejar, type Entorno } from "./handler.ts";
Deno.serve((req) => { const e = (k: string) => Deno.env.get(k) ?? undefined;
  return manejar(req, { SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "", MP_ACCESS_TOKEN: e("MP_ACCESS_TOKEN"), MP_WEBHOOK_SECRET: e("MP_WEBHOOK_SECRET"), MP_COMERCIO: e("MP_COMERCIO") } as Entorno); });
