// Función «conectar» — conexión AUTOMÁTICA (OAuth 2.0) de canales para Atención al cliente · V26.74
//   Gmail (Google) y Outlook / Office 365 (Microsoft): varias casillas por comercio; lee la bandeja de entrada y envía respuestas.
//   Meta (Embedded Signup): WhatsApp Business + páginas de Facebook (Messenger) e Instagram en una sola ventana.
// Se despliega con «Verify JWT» APAGADO (la vuelta del proveedor llega sin sesión; se valida con «state» firmado de un solo uso).
//   POST {accion:'estado', comercio}                     proveedores disponibles + cuentas conectadas (sin tokens)      [admin]
//   POST {accion:'inicio', comercio, proveedor}          devuelve la dirección para abrir la ventana del proveedor       [admin]
//   GET  ?c=cb&code=…&state=…                            vuelta del proveedor: canjea el código, cifra y guarda los tokens
//   POST {accion:'desconectar', comercio, id}            revoca en el proveedor (si se puede) y borra la cuenta          [admin]
//   POST {accion:'procesar'}                             renueva tokens por vencer y trae correos nuevos (pg_cron o el sistema abierto)
// Secretos (los carga el dueño en Supabase; NUNCA en el sistema ni por chat):
//   OAUTH_KEY (≥ 32 caracteres, cifra los tokens), CANALES_COMERCIO (código del comercio), ALLOWED_ORIGINS,
//   GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET · MS_CLIENT_ID + MS_CLIENT_SECRET · META_APP_ID + META_APP_SECRET + META_CONFIG_ID
// Sin los secretos de un proveedor, su botón aparece apagado con la explicación: nada se rompe.
import { cifrar, descifrar, firmar, iguales, pkce, azar, b64u, deb64u } from "./cripto.ts";
import { sellar, convDe } from "../canales/handler.ts";
import { leerCorreos, sinHtml, sinCita, mime, enviarCorreo, cuentaPara } from "./correo.ts";
export { leerCorreos, sinHtml, sinCita, mime, enviarCorreo, cuentaPara };
export type Entorno = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string; ALLOWED_ORIGINS?: string; FUNCTION_URL?: string; CANALES_COMERCIO?: string;
  OAUTH_KEY?: string; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; MS_CLIENT_ID?: string; MS_CLIENT_SECRET?: string; MS_TENANT?: string;
  META_APP_ID?: string; META_APP_SECRET?: string; META_CONFIG_ID?: string; GRAPH_BASE?: string; GOOGLE_BASE?: string; MS_BASE?: string };
type F = typeof fetch; type J = any;
const te = new TextEncoder(), td = new TextDecoder();
const hits = new Map<string, number[]>();
function limite(k: string, n: number, ms: number) { const t = Date.now(); const a = (hits.get(k) ?? []).filter((x) => t - x < ms); if (a.length >= n) return false; a.push(t); hits.set(k, a); return true; }
const limpio = (t: unknown, n = 1500) => String(t ?? "").replace(/\r/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
export function disponibles(env: Entorno) {
  const k = !!(env.OAUTH_KEY && env.OAUTH_KEY.length >= 32);
  return { google: k && !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), microsoft: k && !!(env.MS_CLIENT_ID && env.MS_CLIENT_SECRET), meta: k && !!(env.META_APP_ID && env.META_APP_SECRET && env.META_CONFIG_ID), llave: k };
}
const GB = (e: Entorno) => e.GRAPH_BASE ?? "https://graph.facebook.com", GG = (e: Entorno) => e.GOOGLE_BASE ?? "https://gmail.googleapis.com", GM = (e: Entorno) => e.MS_BASE ?? "https://graph.microsoft.com";
const MST = (e: Entorno) => e.MS_TENANT || "common";
export function urlProveedor(p: string, env: Entorno, redirect: string, state: string, challenge: string) {
  const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
  if (p === "google") return "https://accounts.google.com/o/oauth2/v2/auth?" + q({ client_id: env.GOOGLE_CLIENT_ID!, redirect_uri: redirect, response_type: "code", scope: "openid email https://www.googleapis.com/auth/gmail.modify", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state, code_challenge: challenge, code_challenge_method: "S256" });
  if (p === "microsoft") return `https://login.microsoftonline.com/${MST(env)}/oauth2/v2.0/authorize?` + q({ client_id: env.MS_CLIENT_ID!, redirect_uri: redirect, response_type: "code", response_mode: "query", scope: "offline_access openid email User.Read Mail.ReadWrite Mail.Send", state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account" });
  return "https://www.facebook.com/v21.0/dialog/oauth?" + q({ client_id: env.META_APP_ID!, redirect_uri: redirect, state, config_id: env.META_CONFIG_ID!, response_type: "code", override_default_response_type: "true", extras: JSON.stringify({ setup: {}, sessionInfoVersion: "3" }) });
}
async function form(f: F, url: string, o: Record<string, string>) { const r = await f(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(o).toString() }); const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j }; }
export const jwtCorreo = (idt: string) => { try { return String(JSON.parse(td.decode(deb64u(idt.split(".")[1]))).email ?? "").toLowerCase(); } catch { return ""; } };
/* ---------- manejador ---------- */
export async function manejar(req: Request, env: Entorno, f: F = fetch): Promise<Response> {
  const url = new URL(req.url); const base = env.SUPABASE_URL.replace(/\/$/, "");
  const SR = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" };
  const allow = (env.ALLOWED_ORIGINS ?? "").split(",").map((x) => x.trim()).filter(Boolean); const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = { "access-control-allow-origin": allow.length ? (allow.includes(origin) ? origin : allow[0]) : "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, GET, OPTIONS", vary: "origin" };
  const R = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors } });
  const fn = (env.FUNCTION_URL ?? base + "/functions/v1/conectar").replace(/\?.*$/, ""), redirect = fn + "?c=cb";
  const disp = disponibles(env); const K = env.OAUTH_KEY ?? "";
  const rest = async (path: string, o: RequestInit = {}) => f(`${base}/rest/v1/${path}`, { ...o, headers: { ...SR, ...(o.headers ?? {}) } });
  const cuentas = async (q: string) => { const r = await rest("oauth_cuentas?select=*&" + q); return r.ok ? (await r.json()) as J[] : []; };
  const guardarCuenta = (c: J) => rest("oauth_cuentas?on_conflict=comercio_id,proveedor,cuenta", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(c) });
  const actualizar = (id: string, c: J) => rest(`oauth_cuentas?id=eq.${id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(c) });
  const pagina = (ok: boolean, msg: string, p = "") => { const o = JSON.stringify(allow.length ? allow : []); const dato = JSON.stringify({ vb_oauth: ok ? "ok" : "error", proveedor: p, msg });
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vincular Business</title><body style="font:16px system-ui;padding:2rem;text-align:center"><h2>${ok ? "✅ Listo" : "⚠️ No se pudo conectar"}</h2><p>${msg.replace(/[<>&]/g, "")}</p><p>Ya podés cerrar esta ventana.</p><script>try{${o}.forEach(function(x){window.opener&&window.opener.postMessage(${dato},x)});}catch(e){}setTimeout(function(){window.close()},2500)</script></body>`,
      { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'", "x-frame-options": "DENY", "referrer-policy": "no-referrer" } }); };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  // ---------- vuelta del proveedor ----------
  if (req.method === "GET" && url.searchParams.get("c") === "cb") {
    const st = url.searchParams.get("state") ?? "", code = url.searchParams.get("code") ?? "";
    if (url.searchParams.get("error")) return pagina(false, "Cancelaste el permiso o el proveedor lo rechazó (" + limpio(url.searchParams.get("error"), 60) + ").");
    const [cuerpo, firma] = st.split("."); if (!cuerpo || !firma || !K || !iguales(firma, await firmar(K, cuerpo))) return pagina(false, "La solicitud no es válida o venció. Volvé a intentarlo desde el sistema.");
    let s: J; try { s = JSON.parse(td.decode(deb64u(cuerpo))); } catch { return pagina(false, "Solicitud inválida."); }
    if (!s.exp || s.exp < Date.now()) return pagina(false, "Pasaron más de 10 minutos. Volvé a intentarlo.");
    const er = await rest(`oauth_estados?n=eq.${encodeURIComponent(s.n)}`, { method: "DELETE", headers: { prefer: "return=representation" } }); const est = er.ok ? await er.json() : [];
    if (!est[0] || est[0].comercio_id !== s.c || est[0].proveedor !== s.p) return pagina(false, "Esta solicitud ya se usó. Volvé a intentarlo.");
    const p = s.p; if (!/^[A-Za-z0-9._-]{8,2000}$/.test(code)) return pagina(false, "Código inválido.");
    try {
      if (p === "google") {
        const t = await form(f, "https://oauth2.googleapis.com/token", { code, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirect, grant_type: "authorization_code", code_verifier: est[0].verifier });
        if (!t.ok || !t.j.access_token) return pagina(false, "Google no aceptó el código (" + t.status + ").", p);
        if (!t.j.refresh_token) return pagina(false, "Google no entregó el permiso permanente. Quitá el acceso de la app en tu cuenta de Google y volvé a conectar.", p);
        const mail = jwtCorreo(String(t.j.id_token ?? "")); if (!mail) return pagina(false, "No se pudo leer la dirección de la cuenta.", p);
        await guardarCuenta({ comercio_id: s.c, proveedor: p, cuenta: mail, token_cif: await cifrar(K, { at: t.j.access_token, rt: t.j.refresh_token }), expira: new Date(Date.now() + (+t.j.expires_in || 3600) * 1000).toISOString(), estado: "activa", error: null, datos: { canales: ["mail"], vistos: [] }, renovado: new Date().toISOString() });
        return pagina(true, "Gmail " + mail + " conectado: los correos nuevos van a entrar a la bandeja.", p);
      }
      if (p === "microsoft") {
        const t = await form(f, `https://login.microsoftonline.com/${MST(env)}/oauth2/v2.0/token`, { code, client_id: env.MS_CLIENT_ID!, client_secret: env.MS_CLIENT_SECRET!, redirect_uri: redirect, grant_type: "authorization_code", code_verifier: est[0].verifier });
        if (!t.ok || !t.j.access_token || !t.j.refresh_token) return pagina(false, "Microsoft no aceptó el código (" + t.status + ").", p);
        const me = await f(`${GM(env)}/v1.0/me?$select=mail,userPrincipalName`, { headers: { authorization: "Bearer " + t.j.access_token } }); const mj = me.ok ? await me.json() : {};
        const mail = String(mj.mail ?? mj.userPrincipalName ?? "").toLowerCase(); if (!/^[^@\s]+@[^@\s]+$/.test(mail)) return pagina(false, "No se pudo leer la dirección de la cuenta.", p);
        await guardarCuenta({ comercio_id: s.c, proveedor: p, cuenta: mail, token_cif: await cifrar(K, { at: t.j.access_token, rt: t.j.refresh_token }), expira: new Date(Date.now() + (+t.j.expires_in || 3600) * 1000).toISOString(), estado: "activa", error: null, datos: { canales: ["mail"], vistos: [] }, renovado: new Date().toISOString() });
        return pagina(true, "Outlook " + mail + " conectado: los correos nuevos van a entrar a la bandeja.", p);
      }
      // Meta · Embedded Signup
      const G = GB(env);
      const t = await f(`${G}/v21.0/oauth/access_token?` + new URLSearchParams({ client_id: env.META_APP_ID!, client_secret: env.META_APP_SECRET!, redirect_uri: redirect, code }).toString()); const tj = await t.json().catch(() => ({}));
      if (!t.ok || !tj.access_token) return pagina(false, "Meta no aceptó el código (" + t.status + ").", p);
      const at = String(tj.access_token);
      const dbg = await f(`${G}/v21.0/debug_token?` + new URLSearchParams({ input_token: at, access_token: env.META_APP_ID + "|" + env.META_APP_SECRET }).toString()); const dj = await dbg.json().catch(() => ({}));
      const gs = (dj.data?.granular_scopes ?? []) as J[]; const wabas = (gs.find((x) => x.scope === "whatsapp_business_management")?.target_ids ?? []).map(String).filter((x: string) => /^\d{5,24}$/.test(x)).slice(0, 3);
      const canales: string[] = []; const datos: J = { canales, wa: [], paginas: [] }; const pages: Record<string, string> = {};
      for (const w of wabas) { const pr = await f(`${G}/v21.0/${w}/phone_numbers?fields=id,display_phone_number,verified_name`, { headers: { authorization: "Bearer " + at } }); const pj = await pr.json().catch(() => ({}));
        for (const ph of (pj.data ?? []).slice(0, 5)) { datos.wa.push({ waba: w, phone_id: String(ph.id), numero: String(ph.display_phone_number ?? ""), nombre: String(ph.verified_name ?? "") }); }
        await f(`${G}/v21.0/${w}/subscribed_apps`, { method: "POST", headers: { authorization: "Bearer " + at } }).catch(() => null); }
      if (datos.wa.length) canales.push("wa");
      const ar = await f(`${G}/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{username}`, { headers: { authorization: "Bearer " + at } }); const aj = await ar.json().catch(() => ({}));
      for (const pg of (aj.data ?? []).slice(0, 5)) { if (!/^\d{5,30}$/.test(String(pg.id)) || !pg.access_token) continue; pages[pg.id] = String(pg.access_token);
        datos.paginas.push({ id: String(pg.id), nombre: String(pg.name ?? ""), ig: pg.instagram_business_account?.username ? String(pg.instagram_business_account.username) : "" });
        await f(`${G}/v21.0/${pg.id}/subscribed_apps?subscribed_fields=messages`, { method: "POST", headers: { authorization: "Bearer " + pg.access_token } }).catch(() => null); }
      if (datos.paginas.length) { canales.push("fb"); if (datos.paginas.some((x: J) => x.ig)) canales.push("ig"); }
      if (!canales.length) return pagina(false, "La cuenta no compartió ningún número de WhatsApp ni página. Volvé a intentarlo y elegí al menos uno.", p);
      const nombre = datos.wa[0]?.numero || datos.paginas[0]?.nombre || "Meta";
      await guardarCuenta({ comercio_id: s.c, proveedor: "meta", cuenta: String(nombre).slice(0, 200), token_cif: await cifrar(K, { at, pages }), expira: tj.expires_in ? new Date(Date.now() + (+tj.expires_in) * 1000).toISOString() : null, estado: "activa", error: null, datos, renovado: new Date().toISOString() });
      return pagina(true, "Meta conectado: " + canales.map((c) => ({ wa: "WhatsApp " + (datos.wa[0]?.numero ?? ""), fb: "Messenger", ig: "Instagram" } as J)[c]).join(" · ") + ".", p);
    } catch (e) { return pagina(false, "Error al conectar: " + String((e as Error).message).slice(0, 100), p); }
  }
  if (req.method !== "POST") return R({ error: "método no permitido" }, 405);
  let b: J; try { const t = await req.text(); if (t.length > 6000) return R({ error: "pedido demasiado grande" }, 413); b = JSON.parse(t); } catch { return R({ error: "JSON inválido" }, 400); }
  const acc = String(b.accion ?? "");
  // ---------- renovar y traer correos (sin sesión: sólo trabaja con lo ya conectado) ----------
  if (acc === "procesar") {
    if (!K || !limite("procesar", 20, 60_000)) return R({ ok: true, omitido: true });
    let ren = 0, rev = 0, nuevos = 0;
    const slug = (env.CANALES_COMERCIO ?? "").toLowerCase(); let clubkey: J = null, comId = "";
    if (slug) { const r = await rest(`comercios?select=id&slug=eq.${encodeURIComponent(slug)}`); const a = r.ok ? await r.json() : []; if (a[0]) { comId = a[0].id; const m = await rest(`menus?select=contenido->clubkey&comercio_id=eq.${comId}`); const mm = m.ok ? await m.json() : []; clubkey = mm[0]?.clubkey ?? null; } }
    for (const c of await cuentas("estado=eq.activa&proveedor=in.(google,microsoft)&limit=50")) {
      let tok: J; try { tok = await descifrar(K, c.token_cif); } catch { await actualizar(c.id, { estado: "error", error: "no se pudo descifrar (¿cambió OAUTH_KEY?)" }); continue; }
      if (!c.expira || Date.parse(c.expira) < Date.now() + 10 * 60_000) {
        const t = c.proveedor === "google" ? await form(f, "https://oauth2.googleapis.com/token", { client_id: env.GOOGLE_CLIENT_ID ?? "", client_secret: env.GOOGLE_CLIENT_SECRET ?? "", refresh_token: tok.rt, grant_type: "refresh_token" })
          : await form(f, `https://login.microsoftonline.com/${MST(env)}/oauth2/v2.0/token`, { client_id: env.MS_CLIENT_ID ?? "", client_secret: env.MS_CLIENT_SECRET ?? "", refresh_token: tok.rt, grant_type: "refresh_token", scope: "offline_access openid email User.Read Mail.ReadWrite Mail.Send" });
        if (!t.ok || !t.j.access_token) { if (t.status === 400 || t.status === 401) { await actualizar(c.id, { estado: "revocada", error: "el permiso fue retirado en " + (c.proveedor === "google" ? "Google" : "Microsoft") + ": volvé a conectar" }); rev++; } continue; }
        tok = { at: t.j.access_token, rt: t.j.refresh_token || tok.rt }; await actualizar(c.id, { token_cif: await cifrar(K, tok), expira: new Date(Date.now() + (+t.j.expires_in || 3600) * 1000).toISOString(), renovado: new Date().toISOString(), error: null }); ren++;
      }
      if (!clubkey || c.comercio_id !== comId) continue;   // los correos sólo entran al comercio configurado en CANALES_COMERCIO (el que tiene la llave del chat)
      try {
        const vistos = new Set<string>((c.datos?.vistos ?? []).map(String)); const L = await leerCorreos(env, f, c.proveedor, c.cuenta, tok, vistos);
        for (const m of L) { const conv = await convDe("mail", m.from);
          const cifrado = await sellar(clubkey, { conv, chan: "mail", ext: m.from, name: m.name.slice(0, 60), email: m.from, text: (m.subject ? "Asunto: " + m.subject + "\n" : "") + m.text, mid: "ml" + b64u(te.encode(m.id)).slice(-30), ts: m.ts });
          const r = await rest("crm_entrantes", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ comercio_id: comId, conv, cifrado }) }); if (r.ok) { nuevos++; vistos.add(m.id); } }
        await actualizar(c.id, { ultimo_sync: new Date().toISOString(), datos: { ...(c.datos ?? {}), vistos: [...vistos].slice(-300) } });
      } catch (e) { if (String((e as Error).message) === "401") await actualizar(c.id, { expira: new Date(0).toISOString() }); }
    }
    return R({ ok: true, renovadas: ren, revocadas: rev, correos: nuevos });
  }
  // ---------- con la sesión del administrador ----------
  const auth = req.headers.get("authorization") ?? ""; if (!auth.startsWith("Bearer ")) return R({ error: "sin sesión" }, 401);
  const com = String(b.comercio ?? ""); if (!/^[0-9a-f-]{36}$/i.test(com)) return R({ error: "comercio inválido" }, 400);
  const ur = await f(base + "/auth/v1/user", { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth } }); if (!ur.ok) return R({ error: "sesión inválida" }, 401);
  const uid = String((await ur.json()).id ?? ""); if (!limite(uid + "|" + acc, 30, 600_000)) return R({ error: "demasiados pedidos: esperá unos minutos" }, 429);
  const mr = await rest(`miembros?select=rol&comercio_id=eq.${com}&usuario_id=eq.${uid}`); const mem = mr.ok ? await mr.json() : [];
  if (!Array.isArray(mem) || !mem.length || mem[0].rol !== "admin") return R({ error: "sólo el administrador del comercio" }, 403);
  if (acc === "estado") {
    const L = (await cuentas(`comercio_id=eq.${com}`)).map((c) => ({ id: c.id, proveedor: c.proveedor, cuenta: c.cuenta, estado: c.estado, error: c.error, expira: c.expira, ultimo_sync: c.ultimo_sync, canales: c.datos?.canales ?? [] }));
    return R({ ok: true, disponibles: disp, redirect, cuentas: L });
  }
  if (acc === "inicio") {
    const p = String(b.proveedor ?? ""); if (!["google", "microsoft", "meta"].includes(p)) return R({ error: "proveedor inválido" }, 400);
    if (!(disp as J)[p]) return R({ error: "Falta registrar la app de " + ({ google: "Google", microsoft: "Microsoft", meta: "Meta" } as J)[p] + " y cargar sus secretos (ver la guía)" }, 412);
    const n = azar(24), pk = await pkce();
    const ins = await rest("oauth_estados", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ n, comercio_id: com, usuario_id: uid, proveedor: p, verifier: pk.v }) });
    if (!ins.ok) return R({ error: "no se pudo iniciar (¿falta pegar 29-omnicanal-finanzas.sql?)" }, 500);
    const cuerpo = b64u(te.encode(JSON.stringify({ n, c: com, p, exp: Date.now() + 10 * 60_000 }))); const state = cuerpo + "." + await firmar(K, cuerpo);
    return R({ ok: true, url: urlProveedor(p, env, redirect, state, pk.c) });
  }
  if (acc === "desconectar") {
    const id = String(b.id ?? ""); if (!/^[0-9a-f-]{36}$/i.test(id)) return R({ error: "cuenta inválida" }, 400);
    const c = (await cuentas(`id=eq.${id}&comercio_id=eq.${com}`))[0]; if (!c) return R({ error: "no existe" }, 404);
    try { const tok = await descifrar(K, c.token_cif); if (c.proveedor === "google") await form(f, "https://oauth2.googleapis.com/revoke", { token: tok.rt || tok.at }); } catch { /* se borra igual */ }
    await rest(`oauth_cuentas?id=eq.${id}&comercio_id=eq.${com}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
    return R({ ok: true });
  }
  return R({ error: "acción desconocida" }, 400);
}
