// Correo por OAuth (Gmail API y Microsoft Graph) y búsqueda de la cuenta conectada para responder. Lo usan «conectar» y «canales».
import { descifrar, b64u, deb64u } from "./cripto.ts";
type F = typeof fetch; type J = any;
export type EntCorreo = { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string; OAUTH_KEY?: string; GOOGLE_BASE?: string; MS_BASE?: string };
const te = new TextEncoder(), td = new TextDecoder();
const limpio = (t: unknown, n = 1500) => String(t ?? "").replace(/\r/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
const GG = (e: EntCorreo) => e.GOOGLE_BASE ?? "https://gmail.googleapis.com", GM = (e: EntCorreo) => e.MS_BASE ?? "https://graph.microsoft.com";
export const sinHtml = (h: string) => String(h ?? "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n\s*\n+/g, "\n").trim();
/* corta la respuesta citada («El lun., … escribió:», «-----Original Message-----», líneas con «>») */
export const sinCita = (t: string) => { const L = String(t).split("\n"); const o: string[] = []; for (const l of L) { if (/^\s*>/.test(l) || /^(El |On ).{6,120}(escribió|wrote):\s*$/.test(l.trim()) || /^-{2,}\s*(Original Message|Mensaje original)/i.test(l.trim())) break; o.push(l); } return o.join("\n").trim(); };
/* ---------- correo: leer y enviar ---------- */
const b64uTxt = (s: string) => b64u(te.encode(s));
const enc2047 = (s: string) => /^[\x20-\x7e]*$/.test(s) ? s : "=?UTF-8?B?" + btoa(String.fromCharCode(...te.encode(s))) + "?=";
export function mime(de: string, para: string, asunto: string, texto: string, enRespuestaA?: string) {
  const b = btoa(String.fromCharCode(...te.encode(texto))).replace(/(.{76})/g, "$1\r\n");
  return [`From: ${de}`, `To: ${para}`, `Subject: ${enc2047(asunto)}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64",
    ...(enRespuestaA ? [`In-Reply-To: ${enRespuestaA}`, `References: ${enRespuestaA}`] : []), "", b].join("\r\n");
}
export async function enviarCorreo(env: EntCorreo, f: F, prov: string, cuenta: string, tok: J, para: string, asunto: string, texto: string) {
  if (prov === "google") { const r = await f(`${GG(env)}/gmail/v1/users/me/messages/send`, { method: "POST", headers: { authorization: "Bearer " + tok.at, "content-type": "application/json" }, body: JSON.stringify({ raw: b64uTxt(mime(cuenta, para, asunto, texto)) }) }); return r.ok ? null : "Gmail no lo envió (" + r.status + ")"; }
  if (prov === "microsoft") { const r = await f(`${GM(env)}/v1.0/me/sendMail`, { method: "POST", headers: { authorization: "Bearer " + tok.at, "content-type": "application/json" }, body: JSON.stringify({ message: { subject: asunto, body: { contentType: "Text", content: texto }, toRecipients: [{ emailAddress: { address: para } }] }, saveToSentItems: true }) }); return r.ok ? null : "Outlook no lo envió (" + r.status + ")"; }
  return "proveedor inválido";
}
function parteTexto(p: J): { t: string; html: boolean } { if (!p) return { t: "", html: false };
  if (p.mimeType === "text/plain" && p.body?.data) return { t: td.decode(deb64u(p.body.data)), html: false };
  for (const x of p.parts ?? []) { const r = parteTexto(x); if (r.t && !r.html) return r; }
  if (p.mimeType === "text/html" && p.body?.data) return { t: td.decode(deb64u(p.body.data)), html: true };
  for (const x of p.parts ?? []) { const r = parteTexto(x); if (r.t) return r; } return { t: "", html: false }; }
export async function leerCorreos(env: EntCorreo, f: F, prov: string, cuenta: string, tok: J, vistos: Set<string>) {
  const out: { id: string; from: string; name: string; subject: string; text: string; ts: number }[] = [];
  const de = (s: string) => { const m = /<([^>]+)>/.exec(s); return { mail: (m?.[1] ?? s).trim().toLowerCase(), name: (/^"?([^"<]+?)"?\s*</.exec(s)?.[1] ?? "").trim() }; };
  if (prov === "google") {
    const r = await f(`${GG(env)}/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent("in:inbox newer_than:2d -from:me")}`, { headers: { authorization: "Bearer " + tok.at } });
    if (r.status === 401) throw new Error("401"); const j = await r.json().catch(() => ({}));
    for (const m of (j.messages ?? []).slice(0, 20)) { if (vistos.has(m.id)) continue;
      const g = await f(`${GG(env)}/gmail/v1/users/me/messages/${m.id}?format=full`, { headers: { authorization: "Bearer " + tok.at } }); if (!g.ok) continue; const x = await g.json();
      const H = Object.fromEntries((x.payload?.headers ?? []).map((h: J) => [String(h.name).toLowerCase(), String(h.value)])); const d = de(H.from ?? "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.mail) || d.mail === cuenta) { vistos.add(m.id); continue; }
      const pt = parteTexto(x.payload); out.push({ id: m.id, from: d.mail, name: d.name, subject: limpio(H.subject ?? "", 140), text: limpio(sinCita(pt.html ? sinHtml(pt.t) : pt.t), 1400), ts: +x.internalDate || Date.now() });
    }
  } else if (prov === "microsoft") {
    const desde = new Date(Date.now() - 2 * 864e5).toISOString();
    const r = await f(`${GM(env)}/v1.0/me/mailFolders/inbox/messages?$top=20&$select=id,subject,from,body,receivedDateTime&$filter=${encodeURIComponent("receivedDateTime ge " + desde)}&$orderby=${encodeURIComponent("receivedDateTime desc")}`, { headers: { authorization: "Bearer " + tok.at, prefer: 'outlook.body-content-type="text"' } });
    if (r.status === 401) throw new Error("401"); const j = await r.json().catch(() => ({}));
    for (const m of (j.value ?? []).slice(0, 20)) { if (vistos.has(m.id)) continue; const mail = String(m.from?.emailAddress?.address ?? "").toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) || mail === cuenta) { vistos.add(m.id); continue; }
      const body = m.body?.contentType === "html" ? sinHtml(m.body?.content ?? "") : String(m.body?.content ?? "");
      out.push({ id: m.id, from: mail, name: String(m.from?.emailAddress?.name ?? ""), subject: limpio(m.subject ?? "", 140), text: limpio(sinCita(body), 1400), ts: Date.parse(m.receivedDateTime) || Date.now() });
    }
  }
  return out;
}
/* lo usa la función «canales» para RESPONDER por una cuenta conectada con OAuth (Gmail / Outlook / Meta) cuando no hay secretos manuales */
export async function cuentaPara(env: EntCorreo, f: F, comercio: string, canal: string): Promise<{ prov: string; cuenta: string; tok: J; datos: J } | null> {
  if (!env.OAUTH_KEY || env.OAUTH_KEY.length < 32) return null; const base = env.SUPABASE_URL.replace(/\/$/, "");
  const SR = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY };
  const prov = canal === "mail" ? "in.(google,microsoft)" : "eq.meta";
  const r = await f(`${base}/rest/v1/oauth_cuentas?select=proveedor,cuenta,token_cif,datos&estado=eq.activa&comercio_id=eq.${comercio}&proveedor=${prov}&order=creado.asc&limit=1`, { headers: SR });
  const a = r.ok ? await r.json() : []; if (!a[0]) return null; if (canal !== "mail" && !(a[0].datos?.canales ?? []).includes(canal)) return null;
  try { return { prov: a[0].proveedor, cuenta: a[0].cuenta, tok: await descifrar(env.OAUTH_KEY, a[0].token_cif), datos: a[0].datos ?? {} }; } catch { return null; }
}
