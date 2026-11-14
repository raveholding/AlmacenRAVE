// Cifrado de los tokens OAuth (AES-256-GCM con una llave derivada del secreto OAUTH_KEY) y firma de «state» (HMAC-SHA256).
const te = new TextEncoder(), td = new TextDecoder();
export const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const deb64u = (s: string) => { const t = s.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(t + "=".repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0)); };
async function llave(secreto: string) {
  if (!secreto || secreto.length < 32) throw new Error("OAUTH_KEY tiene que tener al menos 32 caracteres");
  const d = await crypto.subtle.digest("SHA-256", te.encode("vb-oauth|" + secreto));
  return crypto.subtle.importKey("raw", d, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function cifrar(secreto: string, obj: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await llave(secreto), te.encode(JSON.stringify(obj))));
  const o = new Uint8Array(12 + ct.length); o.set(iv); o.set(ct, 12); return "v1." + b64u(o);
}
export async function descifrar(secreto: string, s: string): Promise<any> {
  if (!/^v1\./.test(s)) throw new Error("token con formato desconocido");
  const u = deb64u(s.slice(3)); const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, await llave(secreto), u.slice(12));
  return JSON.parse(td.decode(pt));
}
export async function firmar(secreto: string, txt: string) {
  const k = await crypto.subtle.importKey("raw", te.encode("vb-state|" + secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", k, te.encode(txt))));
}
export function iguales(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
export async function pkce() { const v = b64u(crypto.getRandomValues(new Uint8Array(32))); const c = b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(v)))); return { v, c }; }
export const azar = (n = 24) => b64u(crypto.getRandomValues(new Uint8Array(n)));
