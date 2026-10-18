// Punto de entrada de la Edge Function "api" (Supabase / Deno): REST de Proveedores y Compras.
// Usa sólo variables que Supabase ya trae (SUPABASE_URL, SUPABASE_ANON_KEY). No necesita ningún secreto propio:
// reenvía el JWT del usuario y la base decide qué puede hacer. Opcional: ALLOWED_ORIGINS (ej. https://raveholding.github.io).
import { manejar, type Entorno } from "./handler.ts";

Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = { SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", ALLOWED_ORIGINS: e("ALLOWED_ORIGINS") };
  return manejar(req, env);
});
