// Web Push estándar sin Firebase ni librerías: cifrado del mensaje para cada navegador (RFC 8291, aes128gcm / RFC 8188)
// y firma del servidor con VAPID (RFC 8292, ES256). Sólo WebCrypto: funciona igual en Supabase (Deno) y en Node para las pruebas.
const te = new TextEncoder();
export const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const deb64u = (s: string) => { const t = s.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(t + "=".repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0)); };
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, bytes * 8));
}
/* Hosts de los servicios de push de los navegadores (lo mismo que valida push_host_ok en la base): nada más recibe pedidos */
export const HOST_OK = /^https:\/\/([a-z0-9-]+\.)*(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)(:443)?\/[^\s"<>]{8,}$/;
/* cifra el texto para la suscripción (p256dh y auth en base64url) */
export async function cifrar(payload: Uint8Array, p256dh: string, auth: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const ua = deb64u(p256dh), sec = deb64u(auth);
  if (ua.length !== 65 || sec.length < 16) throw new Error("llaves de la suscripción inválidas");
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const as = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(sec, shared, cat(te.encode("WebPush: info\0"), ua, as), 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, cat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return cat(salt, rs, new Uint8Array([65]), as, ct);
}
/* llaves VAPID del comercio: se crean una vez y la privada queda sólo en la base (push_vapid, sin acceso público) */
export async function nuevasLlaves() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const pub = b64u(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)));
  const priv = await crypto.subtle.exportKey("jwk", kp.privateKey) as JsonWebKey; delete (priv as Record<string, unknown>).key_ops; delete (priv as Record<string, unknown>).ext;
  return { pub, priv };
}
export async function vapid(endpoint: string, pub: string, priv: JsonWebKey, sub = "mailto:vincularbusiness@gmail.com", ahora = Date.now()) {
  const aud = new URL(endpoint).origin;
  const h = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" }))), c = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(ahora / 1000) + 12 * 3600, sub })));
  const k = await crypto.subtle.importKey("jwk", { ...priv, key_ops: ["sign"], ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, te.encode(h + "." + c)));
  return `vapid t=${h}.${c}.${b64u(sig)}, k=${pub}`;
}
