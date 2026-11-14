// Punto de entrada de la Edge Function «push» (notificaciones push de la app del Club, Web Push estándar) · V26.73
// Desplegar con «Verify JWT» APAGADO. No necesita secretos propios: las llaves VAPID las crea ella misma y las guarda en la base.
// Opcional: ALLOWED_ORIGINS=https://raveholding.github.io   VAPID_SUB=mailto:correo-del-comercio
import { manejar, type Entorno } from "./handler.ts";
Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = { SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "", ALLOWED_ORIGINS: e("ALLOWED_ORIGINS"), VAPID_SUB: e("VAPID_SUB") };
  return manejar(req, env);
});
