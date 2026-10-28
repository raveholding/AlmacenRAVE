// ARCHIVO ÚNICO para pegar en Supabase → Edge Functions → Via Editor (nombre: llave). Generado desde functions/llave.
// Edge Function «llave» · V26.31 · CUSTODIA DE LA LLAVE PARA INGRESAR SÓLO CON GOOGLE (opcional, la activa el administrador).
// Guarda la llave de datos del comercio (DEK) envuelta con una llave maestra que vive SÓLO en los secretos de la función
// (LLAVE_MASTER_KEY). La base guarda únicamente el sobre cifrado: una copia de la base sola no alcanza para leer nada.
// · guardar  (sólo administrador): recibe la DEK (la tiene abierta en su equipo) y la guarda envuelta.
// · abrir    (miembro que ENTRÓ CON GOOGLE): devuelve la DEK. Con correo y contraseña no se usa (ya tienen su llave).
// · estado / borrar (administrador).
export type Entorno = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string; LLAVE_MASTER_KEY?: string; ALLOWED_ORIGINS?: string };
type F = typeof fetch;
const te = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const usos = new Map<string, number[]>();
function limite(k: string, n: number, ms: number) { const t = Date.now(); const a = (usos.get(k) ?? []).filter((x) => t - x < ms); if (a.length >= n) return false; a.push(t); usos.set(k, a); return true; }
async function kek(env: Entorno) {
  const raw = unb64(env.LLAVE_MASTER_KEY ?? ""); if (raw.length !== 32) throw new Error("falta LLAVE_MASTER_KEY (32 bytes en base64)");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
function jwtPayload(tok: string) { try { const p = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(atob(p + "===".slice((p.length + 3) % 4))); } catch { return {}; } }
export async function manejar(req: Request, env: Entorno, f: F = fetch): Promise<Response> {
  const allow = (env.ALLOWED_ORIGINS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = { "access-control-allow-origin": allow.length ? (allow.includes(origin) ? origin : allow[0]) : "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS", vary: "origin" };
  const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return J({ error: "método no permitido" }, 405);
  const auth = req.headers.get("authorization") ?? ""; if (!auth.startsWith("Bearer ")) return J({ error: "sin sesión" }, 401);
  const ur = await f(env.SUPABASE_URL + "/auth/v1/user", { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth } });
  if (!ur.ok) return J({ error: "sesión inválida" }, 401);
  const u = await ur.json(); const uid = String(u.id ?? "");
  let b: { accion?: string; comercio?: string; dek?: string }; try { b = await req.json(); } catch { return J({ error: "JSON inválido" }, 400); }
  const com = String(b.comercio ?? ""), acc = String(b.accion ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(com)) return J({ error: "comercio inválido" }, 400);
  if (!limite(uid + "|" + acc, 20, 10 * 60_000)) return J({ error: "demasiados intentos: esperá unos minutos" }, 429);
  const SR = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const mr = await f(`${env.SUPABASE_URL}/rest/v1/miembros?select=rol&comercio_id=eq.${com}&usuario_id=eq.${uid}`, { headers: SR });
  const mem = mr.ok ? await mr.json() : []; if (!Array.isArray(mem) || !mem.length) return J({ error: "no sos parte de este comercio" }, 403);
  const rol = String(mem[0].rol);
  const aad = te.encode("custodia|" + com);
  const audit = (accion: string, detalle: string) => f(`${env.SUPABASE_URL}/rest/v1/custodia_eventos`, { method: "POST", headers: { ...SR, prefer: "return=minimal" }, body: JSON.stringify({ comercio_id: com, usuario_id: uid, accion, detalle }) }).catch(() => null);
  if (acc === "estado") {
    if (rol !== "admin") return J({ error: "sólo el administrador" }, 403);
    const r = await f(`${env.SUPABASE_URL}/rest/v1/llaves_custodia?select=actualizado&comercio_id=eq.${com}`, { headers: SR });
    const a = r.ok ? await r.json() : []; return J({ ok: true, activa: Array.isArray(a) && a.length > 0, desde: a[0]?.actualizado ?? null, servidor: !!env.LLAVE_MASTER_KEY });
  }
  if (acc === "guardar") {
    if (rol !== "admin") return J({ error: "sólo el administrador activa el ingreso con Google" }, 403);
    let raw: Uint8Array; try { raw = unb64(String(b.dek ?? "")); } catch { return J({ error: "llave inválida" }, 422); }
    if (raw.length !== 32) return J({ error: "llave inválida" }, 422);
    let k; try { k = await kek(env); } catch (e) { return J({ error: String((e as Error).message), etapa: "config" }, 422); }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, k, raw));
    const w = await f(`${env.SUPABASE_URL}/rest/v1/llaves_custodia?on_conflict=comercio_id`, { method: "POST", headers: { ...SR, prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ comercio_id: com, wrap: { v: 1, iv: b64(iv), ct: b64(ct) }, creado_por: uid, actualizado: new Date().toISOString() }) });
    if (!w.ok) return J({ error: "no se pudo guardar (" + w.status + ")" }, 500);
    await audit("CUSTODIA_ACTIVADA", "ingreso sólo con Google activado");
    return J({ ok: true });
  }
  if (acc === "borrar") {
    if (rol !== "admin") return J({ error: "sólo el administrador" }, 403);
    await f(`${env.SUPABASE_URL}/rest/v1/llaves_custodia?comercio_id=eq.${com}`, { method: "DELETE", headers: SR });
    await audit("CUSTODIA_DESACTIVADA", "ingreso sólo con Google desactivado"); return J({ ok: true });
  }
  if (acc === "abrir") {
    const p = jwtPayload(auth.slice(7));
    const oauth = Array.isArray(p.amr) && p.amr.some((x: { method?: string }) => x && x.method === "oauth");
    const google = Array.isArray(u.identities) && u.identities.some((i: { provider?: string }) => i && i.provider === "google");
    if (!oauth || !google) return J({ error: "la llave sólo se entrega a quien entró con Google" }, 403);
    const r = await f(`${env.SUPABASE_URL}/rest/v1/llaves_custodia?select=wrap&comercio_id=eq.${com}`, { headers: SR });
    const a = r.ok ? await r.json() : []; if (!Array.isArray(a) || !a.length) return J({ ok: false, activa: false });
    let k; try { k = await kek(env); } catch (e) { return J({ error: String((e as Error).message), etapa: "config" }, 422); }
    let raw: Uint8Array; try { raw = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(a[0].wrap.iv), additionalData: aad }, k, unb64(a[0].wrap.ct))); } catch { return J({ error: "la llave guardada no se puede abrir (¿cambió LLAVE_MASTER_KEY?)" }, 500); }
    await audit("CUSTODIA_ENTREGA", "llave entregada por ingreso con Google");
    return J({ ok: true, activa: true, dek: b64(raw) });
  }
  return J({ error: "acción desconocida" }, 400);
}

// Punto de entrada de la Edge Function «llave» (Supabase / Deno). Ver handler.ts.
// Secreto (lo carga Vincular Business, nunca en el repositorio): LLAVE_MASTER_KEY = 32 bytes aleatorios en base64.
// «Verify JWT» apagado: la función valida la sesión adentro. Opcional: ALLOWED_ORIGINS.
Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = { SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "", LLAVE_MASTER_KEY: e("LLAVE_MASTER_KEY"), ALLOWED_ORIGINS: e("ALLOWED_ORIGINS") };
  return manejar(req, env);
});
