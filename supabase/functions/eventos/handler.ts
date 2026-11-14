// Función «eventos» — webhooks del comercio y lectura de eventos con clave de API · V26.74
// Se despliega con «Verify JWT» APAGADO.
//   POST {accion:'procesar'}            entrega los eventos pendientes a los webhooks (pg_cron o el sistema abierto; no recibe datos)
//   GET  ?desde=<id>&limite=<n>         lee los eventos del comercio dueño de la clave (cabecera X-API-Key: vb_…)
// Cada entrega lleva la cabecera  X-VB-Firma: t=<segundos>,v1=<HMAC-SHA256 hex de "<t>.<cuerpo>" con el secreto whsec_…>
// Los eventos llevan identificadores y estados (nunca textos de mensajes ni datos personales). Reintentos con espera creciente (hasta 6).
export type Entorno = { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string };
type F = typeof fetch; type J = any;
const te = new TextEncoder();
const hits = new Map<string, number[]>();
function limite(k: string, n: number, ms: number) { const t = Date.now(); const a = (hits.get(k) ?? []).filter((x) => t - x < ms); if (a.length >= n) return false; a.push(t); hits.set(k, a); return true; }
export async function firma(secreto: string, t: number, cuerpo: string) {
  const k = await crypto.subtle.importKey("raw", te.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, te.encode(t + "." + cuerpo))), (x) => x.toString(16).padStart(2, "0")).join("");
}
/* sólo https a hosts públicos (sin IP privadas ni nombres internos) */
export const destinoOk = (u: string) => { try { const x = new URL(u); if (x.protocol !== "https:" || x.username || x.password) return false; const h = x.hostname.toLowerCase();
  if (!/\.[a-z]{2,}$/.test(h) || /^(localhost|.*\.local|.*\.internal)$/.test(h) || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return false; return true; } catch { return false; } };
export async function manejar(req: Request, env: Entorno, f: F = fetch): Promise<Response> {
  const base = env.SUPABASE_URL.replace(/\/$/, ""); const SR = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const R = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*", "access-control-allow-headers": "x-api-key, content-type" } });
  const rpc = async (fn: string, a: J) => { const r = await f(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers: SR, body: JSON.stringify(a) }); if (!r.ok) throw new Error(fn + " " + r.status); const t = await r.text(); return t ? JSON.parse(t) : null; };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "x-api-key, content-type", "access-control-allow-methods": "GET, POST" } });
  if (req.method === "GET") {
    const k = req.headers.get("x-api-key") ?? ""; if (!/^vb_[0-9a-f]{48}$/.test(k)) return R({ ok: false, error: "falta la cabecera X-API-Key" }, 401);
    if (!limite("k|" + k.slice(0, 12), 120, 60_000)) return R({ ok: false, error: "demasiados pedidos" }, 429);
    const u = new URL(req.url); const desde = Math.max(0, Math.floor(+(u.searchParams.get("desde") ?? 0) || 0)), lim = Math.min(500, Math.max(1, Math.floor(+(u.searchParams.get("limite") ?? 100) || 100)));
    const r = await rpc("api_eventos", { p_clave: k, p_desde: desde, p_lim: lim }).catch(() => null);
    if (!r || !r.ok) return R({ ok: false, error: "clave inválida o revocada" }, 401);
    const L = r.eventos ?? []; return R({ ok: true, eventos: L, siguiente: L.length ? L[L.length - 1].id : desde });
  }
  if (req.method !== "POST") return R({ error: "método no permitido" }, 405);
  let b: J; try { b = JSON.parse((await req.text()).slice(0, 2000)); } catch { return R({ error: "JSON inválido" }, 400); }
  if (b.accion !== "procesar") return R({ error: "acción desconocida" }, 400);
  if (!limite("procesar", 30, 60_000)) return R({ ok: true, ocupado: true });
  let env_ = 0, err = 0;
  const L: J[] = (await rpc("wh_tomar", { p_lim: 50 }).catch(() => [])) ?? [];
  await Promise.all(L.map(async (x) => {
    let ok = false, cod = 0;
    try {
      if (!destinoOk(x.url)) { cod = 0; } else {
        const cuerpo = JSON.stringify({ id: x.evento_id, evento: x.evento, comercio: x.comercio_id, creado: x.creado, datos: x.datos ?? {} }); const t = Math.floor(Date.now() / 1000);
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
        const r = await f(x.url, { method: "POST", redirect: "manual", signal: ctl.signal, headers: { "content-type": "application/json", "user-agent": "VincularBusiness-Webhooks/1", "x-vb-evento": x.evento, "x-vb-id": String(x.evento_id), "x-vb-firma": `t=${t},v1=${await firma(x.secreto, t, cuerpo)}` }, body: cuerpo });
        clearTimeout(to); cod = r.status; ok = r.status >= 200 && r.status < 300;
      }
    } catch { ok = false; }
    if (ok) env_++; else err++;
    await rpc("wh_resultado", { p_id: x.id, p_ok: ok, p_codigo: cod }).catch(() => null);
  }));
  return R({ ok: true, enviados: env_, errores: err });
}
