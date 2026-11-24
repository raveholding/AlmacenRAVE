// Punto de entrada de la Edge Function «productos» (alta de productos desde internet, V27.31). «Verify JWT» ENCENDIDO.
// Secretos opcionales: OFF_USER_AGENT, UPCITEMDB_KEY / UPCITEMDB_TRIAL, BRAVE_API_KEY, ANTHROPIC_API_KEY, PW_AI_MODEL, PW_MAX_DIA, PW_MAX_IA, ALLOWED_ORIGINS.
import { manejar, type Entorno } from "./handler.ts";
Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = { SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ALLOWED_ORIGINS: e("ALLOWED_ORIGINS"), OFF_USER_AGENT: e("OFF_USER_AGENT"), UPCITEMDB_KEY: e("UPCITEMDB_KEY"), UPCITEMDB_TRIAL: e("UPCITEMDB_TRIAL"),
    BRAVE_API_KEY: e("BRAVE_API_KEY"), ANTHROPIC_API_KEY: e("ANTHROPIC_API_KEY"), PW_AI_MODEL: e("PW_AI_MODEL"), PW_MAX_DIA: e("PW_MAX_DIA"), PW_MAX_IA: e("PW_MAX_IA") };
  return manejar(req, env);
});
