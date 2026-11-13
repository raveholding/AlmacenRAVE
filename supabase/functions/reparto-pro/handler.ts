// Función «reparto-pro» — conectores Pro del reparto (V26.69). Las claves viven SOLO acá, como secretos de Supabase.
// Se despliega con «Verify JWT» APAGADO: Mercado Pago llama al aviso (webhook) sin sesión. Todas las demás acciones
// validan la sesión del usuario (/auth/v1/user) y que sea parte del comercio (tabla miembros, con su rol).
//   test        {conector:'mapas'|'cobro'|'wa'}       sólo administrador: prueba la clave contra el servicio real
//   rutas       {origen:{lat,lng}, paradas:[{id,lat,lng}]}  Google Routes: orden óptimo de paradas (vuelta al local)
//   mp_qr       {ref, monto(centavos), desc}          Mercado Pago: link de pago del monto exacto (se muestra como QR)
//   mp_estado   {ref}                                 Mercado Pago: ¿está aprobado el pago de ese pedido?
//   wa_salida   {mensajes:[{tel,texto}]}              WhatsApp Cloud API: aviso «tu pedido salió» (plantilla aprobada)
//   ?aviso=mp   (POST de Mercado Pago, sin sesión)    valida la firma x-signature y responde 200 (la confirmación la lee mp_estado)
export type Entorno = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string; ALLOWED_ORIGINS?: string;
  GOOGLE_ROUTES_KEY?: string; MP_ACCESS_TOKEN?: string; MP_WEBHOOK_SECRET?: string; WA_TOKEN?: string; WA_PHONE_ID?: string; WA_TEMPLATE?: string; WA_LANG?: string; FUNCTION_URL?: string };
type F = typeof fetch;
const te = new TextEncoder();
const hits = new Map<string, number[]>();
function limite(k: string, n: number, ms: number) { const t = Date.now(); const a = (hits.get(k) ?? []).filter((x) => t - x < ms); if (a.length >= n) return false; a.push(t); hits.set(k, a); return true; }
async function hmac(key: string, msg: string) { const k = await crypto.subtle.importKey("raw", te.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, te.encode(msg))), (b) => b.toString(16).padStart(2, "0")).join(""); }
function iguales(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const num = (x: unknown) => typeof x === "number" && isFinite(x);
const ll = (p: any) => p && num(p.lat) && num(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
export async function manejar(req: Request, env: Entorno, f: F = fetch): Promise<Response> {
  const url = new URL(req.url);
  // ---- aviso de Mercado Pago (sin sesión): sólo se valida la firma; no se guarda nada
  if (req.method === "POST" && url.searchParams.get("aviso") === "mp") {
    const sig = req.headers.get("x-signature") ?? "", rid = req.headers.get("x-request-id") ?? "", id = url.searchParams.get("data.id") ?? "";
    const p = Object.fromEntries(sig.split(",").map((x) => x.trim().split("=", 2) as [string, string]));
    if (!env.MP_WEBHOOK_SECRET || !p.ts || !p.v1) return new Response("no", { status: 401 });
    const calc = await hmac(env.MP_WEBHOOK_SECRET, `id:${id.toLowerCase()};request-id:${rid};ts:${p.ts};`);
    return iguales(calc, p.v1) ? new Response("ok") : new Response("no", { status: 401 });
  }
  const allow = (env.ALLOWED_ORIGINS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = { "access-control-allow-origin": allow.length ? (allow.includes(origin) ? origin : allow[0]) : "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS", vary: "origin" };
  const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return J({ error: "método no permitido" }, 405);
  const auth = req.headers.get("authorization") ?? ""; if (!auth.startsWith("Bearer ")) return J({ error: "sin sesión" }, 401);
  let b: any; try { const t = await req.text(); if (t.length > 20000) return J({ error: "pedido demasiado grande" }, 413); b = JSON.parse(t); } catch { return J({ error: "JSON inválido" }, 400); }
  const com = String(b.comercio ?? ""), acc = String(b.accion ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(com)) return J({ error: "comercio inválido" }, 400);
  const ur = await f(env.SUPABASE_URL + "/auth/v1/user", { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth } });
  if (!ur.ok) return J({ error: "sesión inválida" }, 401);
  const uid = String((await ur.json()).id ?? "");
  if (!limite(uid + "|" + acc, acc === "mp_estado" ? 120 : 30, 10 * 60_000)) return J({ error: "demasiados pedidos: esperá unos minutos" }, 429);
  const SR = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY };
  const mr = await f(`${env.SUPABASE_URL}/rest/v1/miembros?select=rol&comercio_id=eq.${com}&usuario_id=eq.${uid}`, { headers: SR });
  const mem = mr.ok ? await mr.json() : []; if (!Array.isArray(mem) || !mem.length) return J({ error: "no sos parte de este comercio" }, 403);
  const rol = String(mem[0].rol);
  try {
    if (acc === "test") {
      if (rol !== "admin") return J({ error: "sólo el administrador" }, 403);
      const k = String(b.conector ?? "");
      if (k === "mapas") {
        if (!env.GOOGLE_ROUTES_KEY) return J({ ok: false, msg: "Falta el secreto GOOGLE_ROUTES_KEY" });
        const r = await rutas(env, f, { lat: -34.6037, lng: -58.3816 }, [{ id: "a", lat: -34.6083, lng: -58.3712 }, { id: "b", lat: -34.5997, lng: -58.3920 }]);
        return J({ ok: Array.isArray(r), msg: Array.isArray(r) ? "Google Routes responde" : String(r) });
      }
      if (k === "cobro") {
        if (!env.MP_ACCESS_TOKEN) return J({ ok: false, msg: "Falta el secreto MP_ACCESS_TOKEN" });
        const r = await f("https://api.mercadopago.com/users/me", { headers: { authorization: "Bearer " + env.MP_ACCESS_TOKEN } });
        const j = await r.json().catch(() => ({})); return J({ ok: r.ok, msg: r.ok ? "Mercado Pago: cuenta " + String(j.nickname ?? j.id ?? "").slice(0, 40) : "Mercado Pago rechazó la clave (" + r.status + ")" });
      }
      if (k === "wa") {
        if (!env.WA_TOKEN || !env.WA_PHONE_ID) return J({ ok: false, msg: "Faltan los secretos WA_TOKEN y WA_PHONE_ID" });
        const r = await f(`https://graph.facebook.com/v21.0/${encodeURIComponent(env.WA_PHONE_ID)}?fields=display_phone_number`, { headers: { authorization: "Bearer " + env.WA_TOKEN } });
        const j = await r.json().catch(() => ({})); return J({ ok: r.ok, msg: r.ok ? "WhatsApp: número " + String(j.display_phone_number ?? "").slice(0, 30) + (env.WA_TEMPLATE ? " · plantilla " + env.WA_TEMPLATE : " · sin plantilla (sólo llega si el cliente escribió en las últimas 24 h)") : "WhatsApp rechazó la clave (" + r.status + ")" });
      }
      return J({ error: "conector inválido" }, 400);
    }
    if (!["admin", "supervisor", "mostrador", "operador", "repartidor"].includes(rol)) return J({ error: "sin permiso" }, 403);
    if (acc === "rutas") {
      if (!env.GOOGLE_ROUTES_KEY) return J({ error: "Google Routes no está configurado" }, 412);
      const P = Array.isArray(b.paradas) ? b.paradas.slice(0, 25) : [];
      if (!ll(b.origen) || P.length < 2 || !P.every((p: any) => ll(p) && typeof p.id === "string" && p.id.length <= 40)) return J({ error: "datos de ruta inválidos" }, 400);
      const r = await rutas(env, f, b.origen, P); if (!Array.isArray(r)) return J({ error: String(r) }, 502);
      return J({ ok: true, orden: r });
    }
    if (acc === "mp_qr") {
      if (!env.MP_ACCESS_TOKEN) return J({ error: "Mercado Pago no está configurado" }, 412);
      const ref = String(b.ref ?? ""), monto = +b.monto; if (!/^[\w-]{4,40}$/.test(ref) || !Number.isInteger(monto) || monto <= 0 || monto > 1e10) return J({ error: "datos de cobro inválidos" }, 400);
      const body: any = { items: [{ title: String(b.desc ?? "Pedido").slice(0, 120), quantity: 1, unit_price: monto / 100, currency_id: "ARS" }], external_reference: com + ":" + ref,
        expires: true, expiration_date_to: new Date(Date.now() + 2 * 3600_000).toISOString(), payment_methods: { installments: 1 } };
      if (env.FUNCTION_URL) body.notification_url = env.FUNCTION_URL.replace(/\?.*$/, "") + "?aviso=mp";
      const r = await f("https://api.mercadopago.com/checkout/preferences", { method: "POST", headers: { authorization: "Bearer " + env.MP_ACCESS_TOKEN, "content-type": "application/json", "x-idempotency-key": com + ":" + ref + ":" + monto }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.init_point) return J({ error: "Mercado Pago no generó el cobro (" + r.status + ")" }, 502);
      return J({ ok: true, url: String(j.init_point), id: String(j.id ?? "") });
    }
    if (acc === "mp_estado") {
      if (!env.MP_ACCESS_TOKEN) return J({ error: "Mercado Pago no está configurado" }, 412);
      const ref = String(b.ref ?? ""); if (!/^[\w-]{4,40}$/.test(ref)) return J({ error: "referencia inválida" }, 400);
      const r = await f("https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&external_reference=" + encodeURIComponent(com + ":" + ref), { headers: { authorization: "Bearer " + env.MP_ACCESS_TOKEN } });
      const j = await r.json().catch(() => ({})); const pa = (j.results ?? []).find((x: any) => x.status === "approved");
      return J({ ok: true, estado: pa ? "approved" : ((j.results ?? [])[0]?.status ?? "pendiente"), id: pa ? String(pa.id) : "" });
    }
    if (acc === "wa_salida") {
      if (!env.WA_TOKEN || !env.WA_PHONE_ID) return J({ error: "WhatsApp Cloud no está configurado" }, 412);
      const M = Array.isArray(b.mensajes) ? b.mensajes.slice(0, 30) : []; let n = 0;
      for (const m of M) {
        const tel = String(m.tel ?? "").replace(/\D/g, ""), txt = String(m.texto ?? "").slice(0, 900); if (tel.length < 10 || !txt) continue;
        const payload = env.WA_TEMPLATE ? { messaging_product: "whatsapp", to: tel, type: "template", template: { name: env.WA_TEMPLATE, language: { code: env.WA_LANG ?? "es_AR" }, components: [{ type: "body", parameters: [{ type: "text", text: txt.slice(0, 900) }] }] } }
          : { messaging_product: "whatsapp", to: tel, type: "text", text: { body: txt, preview_url: false } };
        const r = await f(`https://graph.facebook.com/v21.0/${encodeURIComponent(env.WA_PHONE_ID)}/messages`, { method: "POST", headers: { authorization: "Bearer " + env.WA_TOKEN, "content-type": "application/json" }, body: JSON.stringify(payload) });
        if (r.ok) n++;
      }
      return J({ ok: n > 0, enviados: n });
    }
    return J({ error: "acción desconocida" }, 400);
  } catch (e) { console.error("reparto-pro:", String((e as Error).message ?? e).slice(0, 200)); return J({ error: "falló el servicio externo" }, 502); }
}
async function rutas(env: Entorno, f: F, o: { lat: number; lng: number }, P: { id: string; lat: number; lng: number }[]): Promise<string[] | string> {
  const pt = (p: { lat: number; lng: number }) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const r = await f("https://routes.googleapis.com/directions/v2:computeRoutes", { method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": env.GOOGLE_ROUTES_KEY ?? "", "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex" },
    body: JSON.stringify({ origin: pt(o), destination: pt(o), intermediates: P.map(pt), travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", optimizeWaypointOrder: true }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) return "Google Routes respondió " + r.status;
  const ix = j.routes?.[0]?.optimizedIntermediateWaypointIndex; if (!Array.isArray(ix) || ix.length !== P.length) return "Google Routes no devolvió el orden";
  return ix.map((i: number) => P[i].id);
}
