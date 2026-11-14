// Función «mpago» — cobros de Mercado Pago Point (Posnet) que llegan solos para conciliar con las ventas · V26.74
// Se despliega con «Verify JWT» APAGADO. APAGADA hasta que el dueño cree su aplicación en Mercado Pago Developers y cargue:
//   MP_ACCESS_TOKEN (credencial de producción de la aplicación)   MP_WEBHOOK_SECRET (clave secreta de las notificaciones)
//   MP_COMERCIO (código del comercio, p. ej. almacen-rave)
//   POST ?c=webhook        notificación de Mercado Pago (se valida la firma x-signature); trae el pago por la API y lo guarda en mp_pagos
//   POST {accion:'estado'} ¿está configurada? (sin datos)
// Sólo guarda importe (en centavos), estado, medio, terminal, referencia y fecha. Nunca datos de la tarjeta ni del pagador.
export type Entorno = { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string; MP_ACCESS_TOKEN?: string; MP_WEBHOOK_SECRET?: string; MP_COMERCIO?: string; MP_API?: string };
type F = typeof fetch; type J = any;
const te = new TextEncoder();
async function hmacHex(key: string, msg: string) { const k = await crypto.subtle.importKey("raw", te.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, te.encode(msg))), (x) => x.toString(16).padStart(2, "0")).join(""); }
const iguales = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
/* plantilla de Mercado Pago: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" firmada con la clave secreta */
export async function firmaOk(secreto: string, xsig: string, xreq: string, dataId: string, ahora = Date.now()) {
  const p = Object.fromEntries(String(xsig).split(",").map((x) => x.trim().split("=", 2) as [string, string])); const ts = p.ts ?? "", v1 = p.v1 ?? "";
  if (!/^\d{10,13}$/.test(ts) || !/^[0-9a-f]{64}$/.test(v1)) return false;
  const tms = ts.length === 13 ? +ts : +ts * 1000; if (Math.abs(ahora - tms) > 10 * 60_000) return false;
  let man = ""; if (dataId) man += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`; if (xreq) man += `request-id:${xreq};`; man += `ts:${ts};`;
  return iguales(v1, await hmacHex(secreto, man));
}
export async function manejar(req: Request, env: Entorno, f: F = fetch): Promise<Response> {
  const R = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const ok = !!(env.MP_ACCESS_TOKEN && env.MP_WEBHOOK_SECRET && env.MP_COMERCIO);
  if (req.method !== "POST") return R({ error: "método no permitido" }, 405);
  const url = new URL(req.url); let b: J = {}; try { const t = await req.text(); if (t.length > 8000) return R({ error: "demasiado grande" }, 413); b = t ? JSON.parse(t) : {}; } catch { return R({ error: "JSON inválido" }, 400); }
  if (url.searchParams.get("c") !== "webhook") return b.accion === "estado" ? R({ ok: true, configurado: ok }) : R({ error: "acción desconocida" }, 400);
  if (!ok) return R({ ok: false, error: "Mercado Pago no está configurado" }, 503);
  const dataId = String(url.searchParams.get("data.id") ?? b?.data?.id ?? "");
  if (!(await firmaOk(env.MP_WEBHOOK_SECRET!, req.headers.get("x-signature") ?? "", req.headers.get("x-request-id") ?? "", dataId))) return R({ error: "firma inválida" }, 401);
  const tipo = String(url.searchParams.get("type") ?? b.type ?? b.topic ?? ""); if (tipo !== "payment" || !/^\d{1,24}$/.test(dataId)) return R({ ok: true, ignorado: true });
  const pr = await f(`${env.MP_API ?? "https://api.mercadopago.com"}/v1/payments/${dataId}`, { headers: { authorization: "Bearer " + env.MP_ACCESS_TOKEN } });
  if (!pr.ok) return R({ error: "no se pudo leer el pago (" + pr.status + ")" }, 502);   // Mercado Pago reintenta solo
  const p = await pr.json(); const base = env.SUPABASE_URL.replace(/\/$/, ""); const SR = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const cr = await f(`${base}/rest/v1/comercios?select=id&slug=eq.${encodeURIComponent(env.MP_COMERCIO!.toLowerCase())}`, { headers: SR }); const ca = cr.ok ? await cr.json() : []; if (!ca[0]) return R({ error: "comercio no encontrado" }, 500);
  const c = (n: unknown) => Math.round((+(n as number) || 0) * 100);
  const fila = { id: String(p.id ?? dataId), comercio_id: ca[0].id, monto: c(p.transaction_amount), neto: p.transaction_details?.net_received_amount != null ? c(p.transaction_details.net_received_amount) : null,
    estado: String(p.status ?? "").slice(0, 30), medio: String(p.payment_type_id ?? p.payment_method_id ?? "").slice(0, 30),
    terminal: String(p.point_of_interaction?.device?.serial_number ?? p.point_of_interaction?.type ?? "").slice(0, 60) || null, referencia: p.external_reference ? String(p.external_reference).slice(0, 80) : null,
    fecha: p.date_approved ?? p.date_created ?? new Date().toISOString() };
  const ins = await f(`${base}/rest/v1/mp_pagos?on_conflict=comercio_id,id`, { method: "POST", headers: { ...SR, prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(fila) });
  return ins.ok ? R({ ok: true }) : R({ error: "no se pudo guardar (" + ins.status + ")" }, 500);
}
