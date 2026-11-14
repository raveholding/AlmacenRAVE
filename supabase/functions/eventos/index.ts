// Punto de entrada de la Edge Function «eventos» (webhooks firmados y lectura con clave de API) · V26.74
// Desplegar con «Verify JWT» APAGADO. No lleva secretos propios (usa los que Supabase pone solos).
import { manejar, type Entorno } from "./handler.ts";
Deno.serve((req) => manejar(req, { SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "", SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" }));
