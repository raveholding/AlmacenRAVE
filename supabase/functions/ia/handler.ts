// Función «ia» — inteligencia artificial OPCIONAL para Atención al cliente · V26.74
// APAGADA si no hay clave: todo sigue funcionando con las reglas gratis del sistema. Si el dueño carga su propia clave en Supabase
// (OPENAI_API_KEY o GEMINI_API_KEY; el costo por uso lo cobra ese proveedor), se habilitan: resumir el hilo, mejorar el tono y
// proponer una respuesta usando SÓLO la base de conocimiento y los datos que manda el sistema (precios, stock, deuda).
//   POST {accion:'estado'|'resumir'|'tono'|'responder', comercio, texto, contexto?:string[]}   con la sesión de alguien del comercio
// Opcional: IA_MODELO (por defecto gpt-4o-mini / gemini-1.5-flash), IA_LIMITE_HORA (por usuario, por defecto 60). «Verify JWT» puede quedar ENCENDIDO.
export type Entorno = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string; ALLOWED_ORIGINS?: string; OPENAI_API_KEY?: string; GEMINI_API_KEY?: string; IA_MODELO?: string; IA_LIMITE_HORA?: string; OPENAI_BASE?: string; GEMINI_BASE?: string };
type F = typeof fetch; type J = any;
const hits = new Map<string, number[]>();
function limite(k: string, n: number, ms: number) { const t = Date.now(); const a = (hits.get(k) ?? []).filter((x) => t - x < ms); if (a.length >= n) return false; a.push(t); hits.set(k, a); return true; }
const limpio = (t: unknown, n: number) => String(t ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
export const SIS: Record<string, string> = {
  resumir: "Sos asistente de atención al cliente de un comercio argentino. Resumí la conversación en 3 a 5 viñetas cortas: qué pide el cliente, qué se le respondió, qué falta hacer. Español rioplatense, sin inventar nada.",
  tono: "Reescribí el mensaje del agente para que sea amable, claro y profesional, en español rioplatense, sin cambiar los datos (precios, fechas, cantidades) ni agregar promesas. Devolvé sólo el mensaje.",
  responder: "Sos asistente de atención al cliente de un comercio argentino. Proponé UNA respuesta breve al último mensaje del cliente usando ÚNICAMENTE la información de CONTEXTO. Si el contexto no alcanza, decí que lo consultás con el equipo. Nunca inventes precios, stock, horarios ni políticas. Español rioplatense. Devolvé sólo el mensaje.",
};
export function proveedor(env: Entorno) { return env.OPENAI_API_KEY ? "openai" : env.GEMINI_API_KEY ? "gemini" : ""; }
export async function preguntar(env: Entorno, f: F, sis: string, user: string): Promise<string> {
  const p = proveedor(env);
  if (p === "openai") {
    const r = await f(`${env.OPENAI_BASE ?? "https://api.openai.com"}/v1/chat/completions`, { method: "POST", headers: { authorization: "Bearer " + env.OPENAI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ model: env.IA_MODELO || "gpt-4o-mini", temperature: 0.2, max_tokens: 400, messages: [{ role: "system", content: sis }, { role: "user", content: user }] }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error("el proveedor de IA respondió " + r.status); return limpio(j.choices?.[0]?.message?.content, 2000);
  }
  if (p === "gemini") {
    const m = env.IA_MODELO || "gemini-1.5-flash";
    const r = await f(`${env.GEMINI_BASE ?? "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(m)}:generateContent`, { method: "POST", headers: { "x-goog-api-key": env.GEMINI_API_KEY!, "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sis }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 400 } }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error("el proveedor de IA respondió " + r.status); return limpio(j.candidates?.[0]?.content?.parts?.map((x: J) => x.text).join("") ?? "", 2000);
  }
  throw new Error("sin clave de IA");
}
export async function manejar(req: Request, env: Entorno, f: F = fetch): Promise<Response> {
  const base = env.SUPABASE_URL.replace(/\/$/, ""); const SR = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY };
  const allow = (env.ALLOWED_ORIGINS ?? "").split(",").map((x) => x.trim()).filter(Boolean); const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = { "access-control-allow-origin": allow.length ? (allow.includes(origin) ? origin : allow[0]) : "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS", vary: "origin" };
  const R = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return R({ error: "método no permitido" }, 405);
  let b: J; try { const t = await req.text(); if (t.length > 16000) return R({ error: "pedido demasiado grande" }, 413); b = JSON.parse(t); } catch { return R({ error: "JSON inválido" }, 400); }
  const auth = req.headers.get("authorization") ?? ""; if (!auth.startsWith("Bearer ")) return R({ error: "sin sesión" }, 401);
  const com = String(b.comercio ?? ""); if (!/^[0-9a-f-]{36}$/i.test(com)) return R({ error: "comercio inválido" }, 400);
  const ur = await f(base + "/auth/v1/user", { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth } }); if (!ur.ok) return R({ error: "sesión inválida" }, 401);
  const uid = String((await ur.json()).id ?? "");
  const mr = await f(`${base}/rest/v1/miembros?select=rol&comercio_id=eq.${com}&usuario_id=eq.${uid}`, { headers: SR }); const mem = mr.ok ? await mr.json() : [];
  if (!Array.isArray(mem) || !mem.length || !["admin", "supervisor", "mostrador", "operador"].includes(mem[0].rol)) return R({ error: "sin permiso" }, 403);
  const acc = String(b.accion ?? "");
  if (acc === "estado") return R({ ok: true, ia: !!proveedor(env), proveedor: proveedor(env) || null });
  if (!SIS[acc]) return R({ error: "acción desconocida" }, 400);
  if (!proveedor(env)) return R({ error: "La IA está apagada: el sistema usa las reglas gratis." }, 412);
  if (!limite(uid, Math.max(1, +(env.IA_LIMITE_HORA ?? 60) || 60), 3600_000)) return R({ error: "llegaste al límite de consultas de IA por hora" }, 429);
  const texto = limpio(b.texto, 6000); if (!texto) return R({ error: "falta el texto" }, 400);
  const ctx = Array.isArray(b.contexto) ? b.contexto.slice(0, 12).map((x: unknown) => limpio(x, 800)).filter(Boolean) : [];
  const user = acc === "responder" ? `CONTEXTO:\n${ctx.map((x: string, i: number) => `[${i + 1}] ${x}`).join("\n") || "(sin contexto)"}\n\nCONVERSACIÓN:\n${texto}` : texto;
  try { return R({ ok: true, texto: await preguntar(env, f, SIS[acc], user) }); } catch (e) { return R({ error: String((e as Error).message).slice(0, 120) }, 502); }
}
