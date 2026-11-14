// Punto de entrada de la Edge Function «ia» (IA opcional de Atención al cliente) · V26.74
// Secretos opcionales: OPENAI_API_KEY o GEMINI_API_KEY (el costo por uso lo cobra el proveedor), IA_MODELO, IA_LIMITE_HORA, ALLOWED_ORIGINS.
import { manejar, type Entorno } from "./handler.ts";
Deno.serve((req) => { const e = (k: string) => Deno.env.get(k) ?? undefined;
  return manejar(req, { SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "", ALLOWED_ORIGINS: e("ALLOWED_ORIGINS"),
    OPENAI_API_KEY: e("OPENAI_API_KEY"), GEMINI_API_KEY: e("GEMINI_API_KEY"), IA_MODELO: e("IA_MODELO"), IA_LIMITE_HORA: e("IA_LIMITE_HORA") } as Entorno); });
