// Función «canales» — mensajes de Telegram, WhatsApp Business, Instagram, Messenger y correo dentro de «Atención al cliente» (V26.70).
// Se despliega con «Verify JWT» APAGADO: Telegram, Meta y el reenvío de correo llaman sin sesión. Cada aviso se valida con SU secreto
// (Telegram: cabecera secreta · Meta: firma X-Hub-Signature-256 con la clave secreta de la app · correo: clave en la dirección).
// Lo que entra se CIFRA acá mismo con la llave pública del comercio (la misma del Club y del chat web) y se guarda en crm_entrantes:
// sólo el sistema del local puede leerlo. Responder, ver el estado y conectar Telegram exigen la sesión de alguien del comercio.
//   GET  ?c=meta                       verificación del webhook de Meta (hub.verify_token = META_VERIFY_TOKEN)
//   POST ?c=meta                       mensajes de WhatsApp Business, Messenger e Instagram
//   POST ?c=tg                         mensajes del bot de Telegram para clientes
//   POST ?c=mail&k=MAIL_IN_SECRET      correo reenviado (Postmark, Mailgun, Cloudflare Email Worker o JSON {from,name,subject,text})
//   POST {accion:'estado'|'enviar'|'tg_conectar'|'probar', comercio, ...}   con la sesión del usuario
import { cuentaPara, enviarCorreo } from "../conectar/correo.ts";
export type Entorno = { OAUTH_KEY?: string; GOOGLE_BASE?: string; MS_BASE?: string; SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string; ALLOWED_ORIGINS?: string; FUNCTION_URL?: string;
  CANALES_COMERCIO?: string; TG_CLIENTES_TOKEN?: string; TG_CLIENTES_SECRET?: string; META_VERIFY_TOKEN?: string; META_APP_SECRET?: string; META_PAGE_TOKEN?: string;
  WA_TOKEN?: string; WA_PHONE_ID?: string; RESEND_API_KEY?: string; MAIL_FROM?: string; MAIL_IN_SECRET?: string; TG_API_BASE?: string; GRAPH_BASE?: string };
type F = typeof fetch; type J = any;
const te = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const b64u = (u: Uint8Array) => b64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function sha(s: string) { return new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(s))); }
async function hmacHex(key: string, msg: Uint8Array) { const k = await crypto.subtle.importKey("raw", te.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, msg)), (b) => b.toString(16).padStart(2, "0")).join(""); }
export function iguales(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const hits = new Map<string, number[]>();
function limite(k: string, n: number, ms: number) { const t = Date.now(); const a = (hits.get(k) ?? []).filter((x) => t - x < ms); if (a.length >= n) return false; a.push(t); hits.set(k, a); return true; }
/* mismo formato que rsaSeal() del sistema: {k, iv, ct} (RSA-OAEP con SHA-256 + AES-GCM 256) */
export async function sellar(jwk: J, obj: unknown) {
  const pk = await crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const ak = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]); const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, ak, te.encode(JSON.stringify(obj))));
  const k = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pk, new Uint8Array(await crypto.subtle.exportKey("raw", ak))));
  return { k: b64(k), iv: b64(iv), ct: b64(ct) };
}
/* identificador de conversación: estable por canal + contacto, sin revelar el contacto */
export async function convDe(canal: string, ext: string) { return "w" + canal + "-" + b64u(await sha(canal + "|" + ext)).slice(0, 24); }
const limpio = (t: unknown, n = 1500) => String(t ?? "").replace(/\r/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
export type Entrante = { chan: "tg" | "wa" | "ig" | "fb" | "mail"; ext: string; name?: string; text: string; mid: string; ts?: number; email?: string; subject?: string };
/* ---- lectura de cada proveedor (funciones puras: se prueban sin red) ---- */
export function deTelegram(u: J): Entrante[] {
  const m = u?.message ?? u?.edited_message; if (!m || !m.chat || m.chat.type !== "private") return [];
  const text = m.text ?? m.caption ?? (m.photo ? "[foto]" : m.voice ? "[audio]" : m.document ? "[archivo]" : m.location ? `[ubicación] https://maps.google.com/?q=${m.location.latitude},${m.location.longitude}` : m.contact ? `[contacto] ${m.contact.phone_number}` : "");
  if (!text) return [];
  const nm = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" ") || m.from?.username || "";
  return [{ chan: "tg", ext: String(m.chat.id), name: nm, text: limpio(text), mid: "tg" + m.chat.id + "_" + m.message_id, ts: (m.date ?? 0) * 1000 }];
}
export function deMeta(b: J): Entrante[] {
  const out: Entrante[] = [];
  if (b?.object === "whatsapp_business_account") for (const e of b.entry ?? []) for (const ch of e.changes ?? []) {
    const v = ch.value ?? {}; const nombres: Record<string, string> = {}; (v.contacts ?? []).forEach((c: J) => { nombres[c.wa_id] = c.profile?.name ?? ""; });
    for (const m of v.messages ?? []) {
      const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? (m.image ? "[foto]" : m.audio ? "[audio]" : m.document ? "[archivo]" : m.location ? `[ubicación] https://maps.google.com/?q=${m.location.latitude},${m.location.longitude}` : "");
      if (text) out.push({ chan: "wa", ext: String(m.from), name: nombres[m.from] ?? "", text: limpio(text), mid: "wa" + String(m.id).replace(/[^A-Za-z0-9]/g, "").slice(-30), ts: +m.timestamp * 1000 || 0 });
    }
  }
  if (b?.object === "page" || b?.object === "instagram") for (const e of b.entry ?? []) for (const ev of e.messaging ?? []) {
    const m = ev.message; if (!m || m.is_echo) continue;
    const text = m.text ?? (m.attachments?.length ? "[" + (m.attachments[0].type === "image" ? "foto" : m.attachments[0].type ?? "adjunto") + "]" : "");
    if (text) out.push({ chan: b.object === "instagram" ? "ig" : "fb", ext: String(ev.sender?.id ?? ""), text: limpio(text), mid: (b.object === "instagram" ? "ig" : "fb") + String(m.mid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(-30), ts: +ev.timestamp || 0 });
  }
  return out.filter((x) => x.ext);
}
export function deCorreo(b: J): Entrante[] {
  const from = String(b?.FromFull?.Email ?? b?.from_email ?? b?.sender ?? b?.from ?? b?.From ?? "").trim();
  const mail = (/<([^>]+)>/.exec(from)?.[1] ?? from).toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return [];
  const name = String(b?.FromName ?? b?.FromFull?.Name ?? b?.name ?? (/^"?([^"<]+)"?\s*</.exec(from)?.[1] ?? "")).trim();
  const subject = limpio(b?.Subject ?? b?.subject ?? "", 140);
  const body = limpio(b?.StrippedTextReply ?? b?.TextBody ?? b?.["stripped-text"] ?? b?.["body-plain"] ?? b?.text ?? "", 1400);
  if (!body && !subject) return [];
  const mid = "ml" + b64u(te.encode(String(b?.MessageID ?? b?.["Message-Id"] ?? b?.messageId ?? mail + subject + body.slice(0, 40)))).slice(-30);
  return [{ chan: "mail", ext: mail, email: mail, name, subject, text: (subject ? "Asunto: " + subject + "\n" : "") + body, mid }];
}
export async function manejar(req: Request, env: Entorno, f: F = fetch): Promise<Response> {
  const url = new URL(req.url), c = url.searchParams.get("c") ?? "";
  const SR = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  async function comercio(): Promise<{ id: string; key: J } | null> {
    const slug = (env.CANALES_COMERCIO ?? "").toLowerCase(); if (!slug) return null;
    const r = await f(`${base}/rest/v1/comercios?select=id&slug=eq.${encodeURIComponent(slug)}`, { headers: SR }); const a = r.ok ? await r.json() : [];
    if (!a[0]) return null; const m = await f(`${base}/rest/v1/menus?select=contenido->clubkey&comercio_id=eq.${a[0].id}`, { headers: SR }); const mm = m.ok ? await m.json() : [];
    return { id: a[0].id, key: mm[0]?.clubkey ?? null };
  }
  async function guardar(L: Entrante[]) {
    if (!L.length) return 0; const co = await comercio(); if (!co || !co.key) return 0; let n = 0;
    for (const x of L.slice(0, 20)) {
      if (!limite("in|" + x.chan + "|" + x.ext, 30, 3600_000)) continue;
      const conv = await convDe(x.chan, x.ext);
      const cifrado = await sellar(co.key, { conv, chan: x.chan, ext: x.ext, name: (x.name ?? "").slice(0, 60), email: x.email ?? "", text: x.text, mid: x.mid, ts: x.ts || Date.now() });
      const r = await f(`${base}/rest/v1/crm_entrantes`, { method: "POST", headers: { ...SR, prefer: "return=minimal" }, body: JSON.stringify({ comercio_id: co.id, conv, cifrado }) });
      if (r.ok) n++;
    }
    return n;
  }
  // ---------------- avisos de los proveedores (sin sesión) ----------------
  if (c === "meta" && req.method === "GET") {
    const ok = env.META_VERIFY_TOKEN && url.searchParams.get("hub.mode") === "subscribe" && iguales(url.searchParams.get("hub.verify_token") ?? "", env.META_VERIFY_TOKEN);
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "") : new Response("no", { status: 403 });
  }
  if (c === "meta" && req.method === "POST") {
    const raw = new Uint8Array(await req.arrayBuffer()); if (raw.length > 200_000) return new Response("grande", { status: 413 });
    const sig = (req.headers.get("x-hub-signature-256") ?? "").replace(/^sha256=/, "");
    if (!env.META_APP_SECRET || !iguales(sig, await hmacHex(env.META_APP_SECRET, raw))) return new Response("no", { status: 401 });
    try { await guardar(deMeta(JSON.parse(new TextDecoder().decode(raw)))); } catch (e) { console.error("canales meta:", String((e as Error).message).slice(0, 160)); }
    return new Response("ok");
  }
  if (c === "tg" && req.method === "POST") {
    if (!env.TG_CLIENTES_SECRET || !iguales(req.headers.get("x-telegram-bot-api-secret-token") ?? "", env.TG_CLIENTES_SECRET)) return new Response("no", { status: 401 });
    try { const u = await req.json(); const L = deTelegram(u); const n = await guardar(L);
      if (L.length && n && env.TG_CLIENTES_TOKEN && /^\/start\b/.test(L[0].text)) await tg(env, f, "sendMessage", { chat_id: L[0].ext, text: "¡Hola! Escribinos acá y te respondemos enseguida 🙂" }).catch(() => null);
    } catch (e) { console.error("canales tg:", String((e as Error).message).slice(0, 160)); }
    return new Response("ok");
  }
  if (c === "mail" && req.method === "POST") {
    if (!env.MAIL_IN_SECRET || !iguales(url.searchParams.get("k") ?? "", env.MAIL_IN_SECRET)) return new Response("no", { status: 401 });
    const t = await req.text(); if (t.length > 300_000) return new Response("grande", { status: 413 });
    let b: J = {}; try { b = JSON.parse(t); } catch { b = Object.fromEntries(new URLSearchParams(t)); }
    try { await guardar(deCorreo(b)); } catch (e) { console.error("canales mail:", String((e as Error).message).slice(0, 160)); }
    return new Response("ok");
  }
  // ---------------- acciones del sistema (con sesión) ----------------
  const allow = (env.ALLOWED_ORIGINS ?? "").split(",").map((x) => x.trim()).filter(Boolean); const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = { "access-control-allow-origin": allow.length ? (allow.includes(origin) ? origin : allow[0]) : "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS", vary: "origin" };
  const R = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return R({ error: "método no permitido" }, 405);
  const auth = req.headers.get("authorization") ?? ""; if (!auth.startsWith("Bearer ")) return R({ error: "sin sesión" }, 401);
  let b: J; try { const t = await req.text(); if (t.length > 8000) return R({ error: "pedido demasiado grande" }, 413); b = JSON.parse(t); } catch { return R({ error: "JSON inválido" }, 400); }
  const com = String(b.comercio ?? ""), acc = String(b.accion ?? ""); if (!/^[0-9a-f-]{36}$/i.test(com)) return R({ error: "comercio inválido" }, 400);
  const ur = await f(base + "/auth/v1/user", { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth } }); if (!ur.ok) return R({ error: "sesión inválida" }, 401);
  const uid = String((await ur.json()).id ?? ""); if (!limite(uid + "|" + acc, acc === "enviar" ? 200 : 30, 600_000)) return R({ error: "demasiados pedidos: esperá unos minutos" }, 429);
  const mr = await f(`${base}/rest/v1/miembros?select=rol&comercio_id=eq.${com}&usuario_id=eq.${uid}`, { headers: SR }); const mem = mr.ok ? await mr.json() : [];
  if (!Array.isArray(mem) || !mem.length) return R({ error: "no sos parte de este comercio" }, 403); const rol = String(mem[0].rol);
  const co = await comercio(); const mio = !!co && co.id === com;
  const fn = (env.FUNCTION_URL ?? base + "/functions/v1/canales").replace(/\?.*$/, "");
  try {
    if (acc === "estado") {
      if (rol !== "admin") return R({ error: "sólo el administrador" }, 403);
      return R({ ok: true, comercio: mio, llave: !!co?.key, url: fn,
        tg: !!(env.TG_CLIENTES_TOKEN && env.TG_CLIENTES_SECRET), meta: !!(env.META_VERIFY_TOKEN && env.META_APP_SECRET), wa: !!(env.WA_TOKEN && env.WA_PHONE_ID),
        page: !!env.META_PAGE_TOKEN, mailIn: !!env.MAIL_IN_SECRET, mailOut: !!(env.RESEND_API_KEY && env.MAIL_FROM) });
    }
    if (acc === "tg_conectar") {
      if (rol !== "admin") return R({ error: "sólo el administrador" }, 403);
      if (!mio) return R({ error: "Falta el secreto CANALES_COMERCIO con el código de tu comercio" }, 412);
      if (!env.TG_CLIENTES_TOKEN || !env.TG_CLIENTES_SECRET) return R({ error: "Faltan los secretos TG_CLIENTES_TOKEN y TG_CLIENTES_SECRET" }, 412);
      const me = await tg(env, f, "getMe", {});
      await tg(env, f, "setWebhook", { url: fn + "?c=tg", secret_token: env.TG_CLIENTES_SECRET, allowed_updates: ["message", "edited_message"], drop_pending_updates: true });
      return R({ ok: true, bot: "@" + String(me.username ?? ""), link: "https://t.me/" + String(me.username ?? "") });
    }
    if (acc === "probar") {
      if (rol !== "admin") return R({ error: "sólo el administrador" }, 403);
      const k = String(b.canal ?? "");
      if (k === "tg") { if (!env.TG_CLIENTES_TOKEN) return R({ ok: false, msg: "Falta TG_CLIENTES_TOKEN" }); const i = await tg(env, f, "getWebhookInfo", {}); const me = await tg(env, f, "getMe", {});
        return R({ ok: String(i.url ?? "").startsWith(fn), msg: String(i.url ?? "").startsWith(fn) ? "Bot @" + me.username + " conectado" : "El bot @" + me.username + " existe pero falta tocar «Conectar»", link: "https://t.me/" + me.username }); }
      if (k === "wa") { if (!env.WA_TOKEN || !env.WA_PHONE_ID) return R({ ok: false, msg: "Faltan WA_TOKEN y WA_PHONE_ID" }); const r = await f(`${env.GRAPH_BASE ?? "https://graph.facebook.com"}/v21.0/${encodeURIComponent(env.WA_PHONE_ID)}?fields=display_phone_number,verified_name`, { headers: { authorization: "Bearer " + env.WA_TOKEN } });
        const j = await r.json().catch(() => ({})); return R({ ok: r.ok && !!env.META_APP_SECRET, msg: r.ok ? "WhatsApp " + String(j.display_phone_number ?? "") + (env.META_APP_SECRET ? "" : " · falta META_APP_SECRET para recibir") : "Meta rechazó el token (" + r.status + ")" }); }
      if (k === "ig" || k === "fb") { if (!env.META_PAGE_TOKEN) return R({ ok: false, msg: "Falta META_PAGE_TOKEN" }); const r = await f(`${env.GRAPH_BASE ?? "https://graph.facebook.com"}/v21.0/me?fields=name,instagram_business_account{username}`, { headers: { authorization: "Bearer " + env.META_PAGE_TOKEN } });
        const j = await r.json().catch(() => ({})); const ig = j.instagram_business_account?.username;
        return R({ ok: r.ok && !!env.META_APP_SECRET && (k === "fb" || !!ig), msg: r.ok ? (k === "ig" ? (ig ? "Instagram @" + ig : "La página no tiene una cuenta de Instagram profesional vinculada") : "Página «" + String(j.name ?? "") + "»") + (env.META_APP_SECRET ? "" : " · falta META_APP_SECRET") : "Meta rechazó el token (" + r.status + ")" }); }
      if (k === "mail") return R({ ok: !!env.MAIL_IN_SECRET && !!(env.RESEND_API_KEY && env.MAIL_FROM), msg: (env.MAIL_IN_SECRET ? "Entrada lista" : "Falta MAIL_IN_SECRET") + " · " + (env.RESEND_API_KEY && env.MAIL_FROM ? "salida con " + env.MAIL_FROM : "falta RESEND_API_KEY / MAIL_FROM") });
      return R({ error: "canal inválido" }, 400);
    }
    if (acc === "enviar") {
      if (!["admin", "supervisor", "mostrador"].includes(rol)) return R({ error: "sin permiso" }, 403);
      if (!mio) return R({ error: "los canales están configurados para otro comercio" }, 403);
      const k = String(b.canal ?? ""), para = String(b.para ?? "").slice(0, 120), txt = limpio(b.texto, 3500); if (!para || !txt) return R({ error: "falta el destinatario o el texto" }, 400);
      const G = env.GRAPH_BASE ?? "https://graph.facebook.com";
      if (k === "tg") { if (!/^-?\d{1,20}$/.test(para)) return R({ error: "destinatario inválido" }, 400); await tg(env, f, "sendMessage", { chat_id: para, text: txt }); return R({ ok: true }); }
      // V26.74: si no hay secretos manuales, responde por la cuenta conectada con un clic (OAuth) en la función «conectar»
      const oa = (k === "mail" && !(env.RESEND_API_KEY && env.MAIL_FROM)) || (k === "wa" && !(env.WA_TOKEN && env.WA_PHONE_ID)) || ((k === "ig" || k === "fb") && !env.META_PAGE_TOKEN) ? await cuentaPara(env, f, com, k) : null;
      if (oa && k === "mail") { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return R({ error: "correo inválido" }, 400); const e = await enviarCorreo(env, f, oa.prov, oa.cuenta, oa.tok, para, limpio(b.asunto || "Respuesta a tu consulta", 140), txt); return e ? R({ error: e }, 502) : R({ ok: true, via: oa.cuenta }); }
      if (oa && k === "wa") { const ph = oa.datos?.wa?.[0]?.phone_id; if (!/^\d{6,16}$/.test(para) || !ph) return R({ error: "número inválido" }, 400);
        const r = await f(`${G}/v21.0/${encodeURIComponent(ph)}/messages`, { method: "POST", headers: { authorization: "Bearer " + oa.tok.at, "content-type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: txt, preview_url: false } }) });
        return r.ok ? R({ ok: true }) : R({ error: "WhatsApp no lo envió (" + r.status + "): pasaron más de 24 h desde el último mensaje del cliente o falta una plantilla" }, 502); }
      if (oa && (k === "ig" || k === "fb")) { const pg = oa.datos?.paginas?.[0]?.id; const pt = pg && oa.tok.pages?.[pg]; if (!/^\d{1,30}$/.test(para) || !pt) return R({ error: "Instagram / Messenger no está configurado" }, 412);
        const r = await f(`${G}/v21.0/me/messages`, { method: "POST", headers: { authorization: "Bearer " + pt, "content-type": "application/json" }, body: JSON.stringify({ recipient: { id: para }, messaging_type: "RESPONSE", message: { text: txt.slice(0, 1000) } }) });
        return r.ok ? R({ ok: true }) : R({ error: "Meta no lo envió (" + r.status + "): sólo se puede responder dentro de las 24 h del último mensaje" }, 502); }
      if (k === "wa") { if (!/^\d{6,16}$/.test(para) || !env.WA_TOKEN || !env.WA_PHONE_ID) return R({ error: "WhatsApp no está configurado o el número es inválido" }, 412);
        const r = await f(`${G}/v21.0/${encodeURIComponent(env.WA_PHONE_ID)}/messages`, { method: "POST", headers: { authorization: "Bearer " + env.WA_TOKEN, "content-type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: txt, preview_url: false } }) });
        if (!r.ok) return R({ error: "WhatsApp no lo envió (" + r.status + "): pasaron más de 24 h desde el último mensaje del cliente o falta una plantilla" }, 502); return R({ ok: true }); }
      if (k === "ig" || k === "fb") { if (!/^\d{1,30}$/.test(para) || !env.META_PAGE_TOKEN) return R({ error: "Instagram / Messenger no está configurado" }, 412);
        const r = await f(`${G}/v21.0/me/messages`, { method: "POST", headers: { authorization: "Bearer " + env.META_PAGE_TOKEN, "content-type": "application/json" }, body: JSON.stringify({ recipient: { id: para }, messaging_type: "RESPONSE", message: { text: txt.slice(0, 1000) } }) });
        if (!r.ok) return R({ error: "Meta no lo envió (" + r.status + "): sólo se puede responder dentro de las 24 h del último mensaje" }, 502); return R({ ok: true }); }
      if (k === "mail") { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para) || !env.RESEND_API_KEY || !env.MAIL_FROM) return R({ error: "el correo de salida no está configurado" }, 412);
        const r = await f("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" }, body: JSON.stringify({ from: env.MAIL_FROM, to: [para], subject: limpio(b.asunto || "Respuesta a tu consulta", 140), text: txt }) });
        if (!r.ok) return R({ error: "el correo no salió (" + r.status + ")" }, 502); return R({ ok: true }); }
      return R({ error: "canal inválido" }, 400);
    }
    return R({ error: "acción desconocida" }, 400);
  } catch (e) { return R({ error: String((e as Error).message ?? e).slice(0, 200) }, 502); }
}
async function tg(env: Entorno, f: F, metodo: string, cuerpo: Record<string, unknown>) {
  const r = await f(`${env.TG_API_BASE ?? "https://api.telegram.org"}/bot${env.TG_CLIENTES_TOKEN}/${metodo}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error("Telegram " + metodo + ": " + String(j.description ?? r.status).slice(0, 120)); return j.result;
}
