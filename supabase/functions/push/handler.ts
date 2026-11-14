// Función «push» — notificaciones push de la app del Club (Web Push estándar con VAPID, sin Firebase) · V26.73
// Se despliega con «Verify JWT» APAGADO: «procesar» lo llama pg_cron o el sistema abierto sin sesión (sólo envía lo que ya está
// programado y vencido; no recibe datos). «llave» y «url» exigen la sesión del administrador del comercio.
//   POST {accion:'procesar'}                        envía los pendientes vencidos (hasta 3 tandas de 100)
//   POST {accion:'llave', comercio}                 crea (una vez) y devuelve la llave PÚBLICA VAPID del comercio
// Secretos: ninguno propio. Usa SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY (Supabase los pone solos) y ALLOWED_ORIGINS.
import { cifrar, nuevasLlaves, vapid, HOST_OK } from "./webpush.ts";
export type Entorno = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string; ALLOWED_ORIGINS?: string; VAPID_SUB?: string };
type F = typeof fetch; type J = any;
const te = new TextEncoder();
const hits = new Map<string, number[]>();
function limite(k: string, n: number, ms: number) { const t = Date.now(); const a = (hits.get(k) ?? []).filter((x) => t - x < ms); if (a.length >= n) return false; a.push(t); hits.set(k, a); return true; }
export function cuerpo(r: J) {
  const o: J = { t: String(r.titulo ?? "").slice(0, 65), b: String(r.cuerpo ?? "").slice(0, 240), k: r.tok, c: r.campana_id };
  if (r.imagen_url && /^https:\/\//.test(r.imagen_url)) o.i = String(r.imagen_url).slice(0, 400);
  if (r.accion_url && /^(#|https:\/\/)/.test(r.accion_url)) o.u = String(r.accion_url).slice(0, 400);
  return te.encode(JSON.stringify(o));
}
export async function manejar(req: Request, env: Entorno, f: F = fetch): Promise<Response> {
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const SR = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const allow = (env.ALLOWED_ORIGINS ?? "").split(",").map((x) => x.trim()).filter(Boolean); const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = { "access-control-allow-origin": allow.length ? (allow.includes(origin) ? origin : allow[0]) : "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS", vary: "origin" };
  const R = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return R({ error: "método no permitido" }, 405);
  let b: J; try { const t = await req.text(); if (t.length > 4000) return R({ error: "pedido demasiado grande" }, 413); b = JSON.parse(t); } catch { return R({ error: "JSON inválido" }, 400); }
  const acc = String(b.accion ?? "");
  const rpc = async (fn: string, args: J) => { const r = await f(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers: SR, body: JSON.stringify(args) }); if (!r.ok) throw new Error(fn + " " + r.status); const t = await r.text(); return t ? JSON.parse(t) : null; };
  async function llaves(com: string): Promise<{ pub: string; priv: JsonWebKey } | null> {
    const r = await f(`${base}/rest/v1/push_vapid?select=pub,priv&comercio_id=eq.${com}`, { headers: SR }); const a = r.ok ? await r.json() : [];
    return a[0] ? { pub: a[0].pub, priv: a[0].priv } : null;
  }
  if (acc === "procesar") {
    if (!limite("procesar", 30, 60_000)) return R({ ok: true, ocupado: true });
    const cache = new Map<string, { pub: string; priv: JsonWebKey } | null>(); let env_ = 0, err = 0;
    try {
      for (let tanda = 0; tanda < 3; tanda++) {
        const L: J[] = (await rpc("push_tomar", { p_lim: 100 })) ?? []; if (!L.length) break;
        await Promise.all(L.map(async (r) => {
          let estado = "error", cod = 0;
          try {
            if (!cache.has(r.comercio_id)) cache.set(r.comercio_id, await llaves(r.comercio_id));
            const k = cache.get(r.comercio_id);
            if (!k || !HOST_OK.test(r.endpoint)) { estado = "error"; }
            else {
              const body = await cifrar(cuerpo(r), r.p256dh, r.auth);
              const res = await f(r.endpoint, { method: "POST", headers: { "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: String(r.ttl ?? 86400), urgency: r.prioridad === "alta" ? "high" : "normal", authorization: await vapid(r.endpoint, k.pub, k.priv, env.VAPID_SUB || undefined) }, body });
              cod = res.status; estado = res.ok ? "enviado" : (cod === 404 || cod === 410) ? "invalido" : (cod === 429 || cod >= 500) ? "reintentar" : "error";
            }
          } catch (e) { estado = "reintentar"; console.error("push:", String((e as Error).message).slice(0, 120)); }
          if (estado === "enviado") env_++; else err++;
          await rpc("push_resultado", { p_id: r.id, p_estado: estado, p_codigo: cod }).catch(() => null);
        }));
        if (L.length < 100) break;
      }
    } catch (e) { return R({ error: "no se pudo procesar", detalle: String((e as Error).message).slice(0, 80) }, 500); }
    return R({ ok: true, enviados: env_, errores: err });
  }
  // ---------- con la sesión del administrador ----------
  const auth = req.headers.get("authorization") ?? ""; if (!auth.startsWith("Bearer ")) return R({ error: "sin sesión" }, 401);
  const com = String(b.comercio ?? ""); if (!/^[0-9a-f-]{36}$/i.test(com)) return R({ error: "comercio inválido" }, 400);
  const ur = await f(base + "/auth/v1/user", { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth } }); if (!ur.ok) return R({ error: "sesión inválida" }, 401);
  const uid = String((await ur.json()).id ?? ""); if (!limite(uid + "|" + acc, 20, 600_000)) return R({ error: "demasiados pedidos: esperá unos minutos" }, 429);
  const mr = await f(`${base}/rest/v1/miembros?select=rol&comercio_id=eq.${com}&usuario_id=eq.${uid}`, { headers: SR }); const mem = mr.ok ? await mr.json() : [];
  if (!Array.isArray(mem) || !mem.length || mem[0].rol !== "admin") return R({ error: "sólo el administrador del comercio" }, 403);
  if (acc === "llave") {
    let k = await llaves(com);
    if (!k) { const n = await nuevasLlaves(); const r = await f(`${base}/rest/v1/push_vapid`, { method: "POST", headers: { ...SR, prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ comercio_id: com, pub: n.pub, priv: n.priv }) });
      if (!r.ok) return R({ error: "no se pudo guardar la llave (¿falta pegar 28-push.sql?)" }, 500); k = await llaves(com); }
    return R({ ok: true, pub: k?.pub ?? "" });
  }
  return R({ error: "acción desconocida" }, 400);
}
