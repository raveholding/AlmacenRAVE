// SISTEMA RAVE · Edge Function "tiendanube" — integración con Tiendanube / Nuvemshop (servidor).
// Seguridad:
//  · El token de acceso de la tienda y el secreto de la app (TN_CLIENT_SECRET) viven SOLO acá: el token se guarda
//    cifrado (AES-GCM con TN_MASTER_KEY) en una tabla sin políticas; el navegador no los recibe nunca.
//  · OAuth con "state" de un solo uso (se guarda su hash, vence a los 10 minutos).
//  · Webhooks: firma HMAC-SHA256 del cuerpo con el secreto de la app (cabecera x-linkedstore-hmac-sha256).
//    El cuerpo NO es la verdad: se vuelve a consultar el recurso a la API y se guarda por estado (idempotente,
//    una orden nunca retrocede aunque lleguen avisos repetidos o fuera de orden).
//  · Una orden de Tiendanube nunca crea una venta sola: queda en la lista y una persona la registra.
// Endpoints / cabeceras de Tiendanube: docs oficiales (tiendanube.github.io/api-documentation) [VERIFICAR vigencia].
type F = typeof fetch;
export interface Entorno {
  SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string;
  TN_APP_ID?: string; TN_CLIENT_SECRET?: string; TN_MASTER_KEY?: string;
  APP_URL?: string; ALLOWED_ORIGINS?: string; TN_USER_AGENT?: string; TN_API_BASE?: string; TN_AUTH_BASE?: string; FUNCTION_URL?: string;
}
export class ErrorTn extends Error {
  constructor(public etapa: string, msg: string, public reintentable = false, public status = 502) { super(msg); }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTOS_WEBHOOK = ["order/created", "order/updated", "order/paid", "order/cancelled", "order/edited", "order/fulfilled", "product/created", "product/updated", "product/deleted", "app/uninstalled"];
const MAX_PAGINAS = 60;

// ------------------------------------------------------------------ utilidades puras
const enc = new TextEncoder();
export const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const hex = (u: Uint8Array) => Array.from(u).map((b) => b.toString(16).padStart(2, "0")).join("");

/** "1234.50" → 123450. Sin floats. Devuelve null si no es un importe válido. */
export function aCentavos(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  const m = /^(\d{1,12})(?:\.(\d{1,6}))?$/.exec(s);
  if (!m) return null;
  const dec = (m[2] ?? "").padEnd(3, "0");
  let c = Number(m[1]) * 100 + Number(dec.slice(0, 2));
  if (Number(dec[2]) >= 5) c += 1;
  return c;
}
/** Los textos de Tiendanube pueden venir como {"es":"..."} */
export function texto(v: unknown, max = 200): string {
  if (typeof v === "string") return v.slice(0, max);
  if (v && typeof v === "object") { const o = v as Record<string, unknown>; const k = o.es ?? o.pt ?? o.en ?? Object.values(o)[0]; return typeof k === "string" ? k.slice(0, max) : ""; }
  return "";
}
async function claveMaestra(env: Entorno): Promise<CryptoKey> {
  if (!env.TN_MASTER_KEY) throw new ErrorTn("config", "Falta el secreto TN_MASTER_KEY en la función.", false, 412);
  const raw = unb64(env.TN_MASTER_KEY);
  if (raw.length !== 32) throw new ErrorTn("config", "TN_MASTER_KEY debe ser de 32 bytes en base64.", false, 412);
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function cifrar(env: Entorno, texto: string, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, await claveMaestra(env), enc.encode(texto)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}
export async function descifrar(env: Entorno, valor: string, aad: string): Promise<string> {
  const [v, iv, ct] = valor.split(".");
  if (v !== "v1" || !iv || !ct) throw new ErrorTn("config", "Token guardado con formato desconocido.", false, 500);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv), additionalData: enc.encode(aad) }, await claveMaestra(env), unb64(ct));
  return new TextDecoder().decode(pt);
}
export async function hmacHex(secreto: string, cuerpo: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(cuerpo))));
}
export function igualesConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function sha256Hex(s: string): Promise<string> { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))); }

export interface VarianteTn { variant_id: number; product_id: number; sku: string; barcode: string; nombre: string; precio_cents: number | null; stock: number | null; tn_actualizado: string | null }
/** Producto de Tiendanube → una fila por variante. */
export function variantesDeProducto(p: Record<string, unknown>): VarianteTn[] {
  const pid = Number(p.id); const base = texto(p.name, 160) || "(sin nombre)";
  const vs = Array.isArray(p.variants) ? (p.variants as Record<string, unknown>[]) : [];
  return vs.filter((v) => Number.isFinite(Number(v.id))).map((v) => {
    const vals = Array.isArray(v.values) ? (v.values as unknown[]).map((x) => texto(x, 40)).filter(Boolean).join(" / ") : "";
    const st = v.stock === null || v.stock === undefined || v.stock === "" ? null : Number(v.stock);
    return { variant_id: Number(v.id), product_id: pid, sku: String(v.sku ?? "").slice(0, 80), barcode: String(v.barcode ?? "").slice(0, 80),
      nombre: (vals ? `${base} · ${vals}` : base).slice(0, 200), precio_cents: aCentavos(v.price), stock: st !== null && Number.isFinite(st) ? st : null,
      tn_actualizado: typeof v.updated_at === "string" ? v.updated_at : (typeof p.updated_at === "string" ? p.updated_at : null) };
  });
}
export function mapearOrden(o: Record<string, unknown>) {
  const items = (Array.isArray(o.products) ? (o.products as Record<string, unknown>[]) : []).map((p) => ({
    variant_id: Number(p.variant_id) || null, product_id: Number(p.product_id) || null, nombre: texto(p.name, 160), sku: String(p.sku ?? "").slice(0, 80),
    qty: Number(p.quantity) || 0, precio_cents: aCentavos(p.price) ?? 0 }));
  const c = (o.customer ?? {}) as Record<string, unknown>;
  const pd = (o.payment_details ?? {}) as Record<string, unknown>;
  return {
    orden_id: Number(o.id), numero: Number(o.number) || null, estado: String(o.status ?? "open"), pago_estado: String(o.payment_status ?? "pending"),
    envio_estado: String(o.shipping_status ?? "unshipped"),
    total_cents: aCentavos(o.total) ?? 0, subtotal_cents: aCentavos(o.subtotal) ?? 0, descuento_cents: aCentavos(o.discount) ?? 0,
    envio_cents: aCentavos(o.shipping_cost_customer) ?? 0, moneda: String(o.currency ?? "ARS").slice(0, 3),
    medio_pago: String(pd.method ?? o.gateway ?? "").slice(0, 60) || null,
    cliente: { nombre: texto(c.name, 120), correo: String(c.email ?? "").slice(0, 120), telefono: String(c.phone ?? "").slice(0, 40) },
    items, nota: typeof o.note === "string" ? o.note.slice(0, 300) : null,
    tn_creada: typeof o.created_at === "string" ? o.created_at : null, tn_actualizada: typeof o.updated_at === "string" ? o.updated_at : null,
  };
}

// ------------------------------------------------------------------ base de datos (PostgREST)
function baseDatos(env: Entorno, f: F) {
  const base = env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
  const svc = (extra: Record<string, string> = {}) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json", ...extra });
  async function chk(r: Response, que: string) { if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(`db ${que}: ${r.status} ${t.slice(0, 160)}`); } return r; }
  return {
    async rpc(nombre: string, args: Record<string, unknown>, userJwt?: string) {
      const h = userJwt ? { apikey: env.SUPABASE_ANON_KEY, Authorization: userJwt, "Content-Type": "application/json" } : svc();
      const r = await chk(await f(`${base}/rpc/${nombre}`, { method: "POST", headers: h, body: JSON.stringify(args) }), "rpc " + nombre);
      const t = await r.text(); return t ? JSON.parse(t) : null;
    },
    async select<T>(tabla: string, query: string): Promise<T[]> { return await (await chk(await f(`${base}/${tabla}?${query}`, { headers: svc() }), "select " + tabla)).json(); },
    async upsert(tabla: string, filas: unknown, conflicto: string) {
      await chk(await f(`${base}/${tabla}?on_conflict=${conflicto}`, { method: "POST", headers: svc({ Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify(filas) }), "upsert " + tabla);
    },
    async insert(tabla: string, fila: unknown) { await chk(await f(`${base}/${tabla}`, { method: "POST", headers: svc({ Prefer: "return=minimal" }), body: JSON.stringify(fila) }), "insert " + tabla); },
    async patch(tabla: string, query: string, fila: Record<string, unknown>) { await chk(await f(`${base}/${tabla}?${query}`, { method: "PATCH", headers: svc({ Prefer: "return=minimal" }), body: JSON.stringify(fila) }), "patch " + tabla); },
  };
}
type Db = ReturnType<typeof baseDatos>;
interface Conexion { comercio_id: string; store_id: number | null; token_cifrado: string | null; estado: string; config: Record<string, unknown>; ultima_sync: string | null }

// ------------------------------------------------------------------ cliente de la API de Tiendanube
class ApiTn {
  constructor(private env: Entorno, private f: F, private token: string, private store: number, private dormir: (ms: number) => Promise<void>) {}
  get base() { return (this.env.TN_API_BASE ?? "https://api.tiendanube.com/2025-03").replace(/\/$/, "") + "/" + this.store; }
  async llamar(metodo: string, ruta: string, cuerpo?: unknown, intento = 0): Promise<{ datos: unknown; sig: boolean }> {
    const h: Record<string, string> = { Authorization: "Bearer " + this.token, "User-Agent": this.env.TN_USER_AGENT ?? "SistemaVB (vincularbusiness@gmail.com)", Accept: "application/json" };
    if (cuerpo !== undefined) h["Content-Type"] = "application/json; charset=utf-8";
    let r: Response;
    try { r = await this.f(this.base + ruta, { method: metodo, headers: h, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }); }
    catch (_e) { throw new ErrorTn("red", "Tiendanube no respondió. Probá de nuevo en un rato.", true); }
    if (r.status === 429) {
      if (intento < 1) { const ms = Math.min(Number(r.headers.get("x-rate-limit-reset")) || 1500, 4000); await this.dormir(ms); return this.llamar(metodo, ruta, cuerpo, intento + 1); }
      throw new ErrorTn("limite", "Tiendanube limitó las consultas. Se reintenta en la próxima sincronización.", true, 429);
    }
    if (r.status === 401 || r.status === 403) throw new ErrorTn("autorizacion", "Tiendanube rechazó el acceso: reconectá la tienda.", false, 409);
    if (r.status === 404) return { datos: null, sig: false };
    if (!r.ok) { const t = await r.text().catch(() => ""); throw new ErrorTn("api", `Tiendanube respondió ${r.status}. ${t.slice(0, 120)}`, r.status >= 500, 502); }
    const t = await r.text(); const sig = /rel="next"/.test(r.headers.get("link") ?? "");
    return { datos: t ? JSON.parse(t) : null, sig };
  }
  async todas(ruta: string): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    for (let p = 1; p <= MAX_PAGINAS; p++) {
      const { datos, sig } = await this.llamar("GET", `${ruta}${ruta.includes("?") ? "&" : "?"}per_page=200&page=${p}`);
      if (Array.isArray(datos)) out.push(...(datos as Record<string, unknown>[]));
      if (!sig || !Array.isArray(datos) || datos.length === 0) break;
    }
    return out;
  }
}

// ------------------------------------------------------------------ contexto de una petición
class Ctx {
  constructor(public env: Entorno, public f: F, public db: Db, public comercio: string, public dormir: (ms: number) => Promise<void>, public ahora: () => Date) {}
  appConfigurada() { return !!(this.env.TN_APP_ID && this.env.TN_CLIENT_SECRET && this.env.TN_MASTER_KEY); }
  urlWebhook() { return (this.env.FUNCTION_URL ?? this.env.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/tiendanube") + "?wh=1"; }
  urlCallback() { return (this.env.FUNCTION_URL ?? this.env.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/tiendanube") + "?cb=1"; }
  async conexion(): Promise<Conexion | null> { return (await this.db.select<Conexion>("tn_conexion", `comercio_id=eq.${this.comercio}&select=*`))[0] ?? null; }
  async api(): Promise<{ api: ApiTn; con: Conexion }> {
    const con = await this.conexion();
    if (!con || con.estado !== "conectada" || !con.token_cifrado || !con.store_id) throw new ErrorTn("conexion", "La tienda no está conectada.", false, 409);
    return { api: new ApiTn(this.env, this.f, await descifrar(this.env, con.token_cifrado, this.comercio), Number(con.store_id), this.dormir), con };
  }
  async marcar(error: string | null, sync = false) {
    const fila: Record<string, unknown> = { ultimo_error: error ? error.slice(0, 280) : null, actualizado: this.ahora().toISOString() };
    if (sync) fila.ultima_sync = this.ahora().toISOString();
    await this.db.patch("tn_conexion", `comercio_id=eq.${this.comercio}`, fila);
  }
  async evento(evento: string, recurso: number | null, resultado: string, detalle?: string) {
    try { await this.db.insert("tn_eventos", { comercio_id: this.comercio, evento: evento.slice(0, 80), recurso_id: recurso, resultado, detalle: detalle ? detalle.slice(0, 280) : null }); } catch (_e) { /* la bitácora no frena el trabajo */ }
  }

  async iniciar(uid: string) {
    if (!this.appConfigurada()) throw new ErrorTn("config", "Falta cargar los datos de la app de Tiendanube en el servidor (TN_APP_ID, TN_CLIENT_SECRET, TN_MASTER_KEY).", false, 412);
    const state = hex(crypto.getRandomValues(new Uint8Array(24)));
    await this.db.insert("tn_estados_oauth", { state_hash: await sha256Hex(state), comercio_id: this.comercio, usuario: uid, vence: new Date(this.ahora().getTime() + 10 * 60_000).toISOString() });
    const base = (this.env.TN_AUTH_BASE ?? "https://www.tiendanube.com").replace(/\/$/, "");
    return { url: `${base}/apps/${encodeURIComponent(this.env.TN_APP_ID!)}/authorize?state=${state}`, redirect: this.urlCallback() };
  }

  async estado() {
    const e = await this.db.rpc("tn_estado", { p_comercio: this.comercio }, this.jwt);
    return { ...e, app_configurada: this.appConfigurada(), url_webhook: this.urlWebhook(), url_callback: this.urlCallback() };
  }
  jwt = "";

  async desconectar() {
    const con = await this.conexion();
    if (con?.token_cifrado && con.store_id) { // mejor esfuerzo: dar de baja los avisos en Tiendanube
      try {
        const { api } = await this.api();
        const { datos } = await api.llamar("GET", "/webhooks");
        for (const w of (Array.isArray(datos) ? datos : []) as Record<string, unknown>[]) if (String(w.url ?? "").startsWith(this.urlWebhook().split("?")[0])) await api.llamar("DELETE", `/webhooks/${w.id}`);
      } catch (_e) { /* si falla, igual se desconecta de nuestro lado */ }
    }
    await this.db.patch("tn_conexion", `comercio_id=eq.${this.comercio}`, { estado: "desconectada", token_cifrado: null, scope: null, ultimo_error: null, actualizado: this.ahora().toISOString() });
    await this.evento("conexion/desconectada", null, "ok");
    return { ok: true };
  }

  async sincronizarProductos() {
    const { api } = await this.api();
    const prods = await api.todas("/products");
    const vars = prods.flatMap((p) => variantesDeProducto(p));
    const previos = await this.db.select<{ variant_id: number; vinculo: string; producto_local: string | null }>("tn_productos", `comercio_id=eq.${this.comercio}&select=variant_id,vinculo,producto_local`);
    const pv = new Map(previos.map((x) => [x.variant_id, x]));
    const locales = await this.db.select<{ id: string; datos: Record<string, unknown> }>("registros", `comercio_id=eq.${this.comercio}&coleccion=eq.productos&borrado=eq.false&select=id,datos`);
    const yaUsado = new Set(previos.filter((x) => x.vinculo === "vinculado" && x.producto_local).map((x) => x.producto_local!));
    const porCodigo = new Map<string, string[]>();
    for (const l of locales) { const c = String(l.datos.barcode ?? "").trim(); if (c) porCodigo.set(c, [...(porCodigo.get(c) ?? []), l.id]); }
    let sugeridos = 0;
    const filas = vars.map((v) => {
      const ant = pv.get(v.variant_id);
      let vinculo = ant?.vinculo ?? "sin_vincular", local = ant?.producto_local ?? null;
      if (vinculo === "sin_vincular" || vinculo === "sugerido") {
        const cod = v.barcode || v.sku; const c = cod ? porCodigo.get(cod) : undefined;
        if (c && c.length === 1 && !yaUsado.has(c[0])) { vinculo = "sugerido"; local = c[0]; sugeridos++; } else { vinculo = "sin_vincular"; local = null; }
      }
      return { comercio_id: this.comercio, ...v, vinculo, producto_local: local, sincronizado: this.ahora().toISOString() };
    });
    // el índice único de "vinculado" no se toca desde acá: sólo sugerencias; una sugerencia repetida se descarta
    const usados = new Set<string>(); for (const x of filas) if (x.vinculo === "sugerido" && x.producto_local) { if (usados.has(x.producto_local)) { x.vinculo = "sin_vincular"; x.producto_local = null; } else usados.add(x.producto_local); }
    for (let i = 0; i < filas.length; i += 200) await this.db.upsert("tn_productos", filas.slice(i, i + 200), "comercio_id,variant_id");
    await this.marcar(null, true);
    await this.evento("sync/productos", null, "ok", `${filas.length} variantes, ${sugeridos} sugeridas`);
    return { ok: true, variantes: filas.length, sugeridos };
  }

  async importarOrdenes() {
    const { api, con } = await this.api();
    if (con.config.importar_ordenes !== true) throw new ErrorTn("config", "La importación de órdenes está apagada en la configuración.", false, 409);
    const desde = con.ultima_sync ? `&updated_at_min=${encodeURIComponent(new Date(new Date(con.ultima_sync).getTime() - 5 * 60_000).toISOString())}` : "";
    const ordenes = await api.todas(`/orders?status=any${desde}`);
    const r = { ok: 0, duplicado: 0, ignorado: 0 };
    const vinc = await this.vinculados();
    for (const o of ordenes) { const x = await this.guardarOrden(o, vinc); r[x as "ok"]++; }
    await this.marcar(null, true);
    await this.evento("sync/ordenes", null, "ok", `${ordenes.length} órdenes: ${r.ok} nuevas o cambiadas`);
    return { ok: true, total: ordenes.length, ...r };
  }
  async vinculados() {
    const v = await this.db.select<{ variant_id: number; producto_local: string }>("tn_productos", `comercio_id=eq.${this.comercio}&vinculo=eq.vinculado&select=variant_id,producto_local`);
    return new Map(v.map((x) => [x.variant_id, x.producto_local]));
  }
  async guardarOrden(o: Record<string, unknown>, vinc: Map<number, string>): Promise<string> {
    const m = mapearOrden(o);
    if (!Number.isFinite(m.orden_id)) throw new ErrorTn("datos", "Orden sin id", false, 422);
    const items = m.items.map((i) => ({ ...i, producto_local: i.variant_id ? vinc.get(i.variant_id) ?? null : null }));
    return String(await this.db.rpc("tn_upsert_orden", { p_comercio: this.comercio, p: { ...m, items } }));
  }

  /** Empuja stock y/o precio del sistema hacia Tiendanube SOLO de las variantes vinculadas y según la config. */
  async empujar() {
    const { api, con } = await this.api();
    const sf = con.config.stock_fuente === "sistema", pf = con.config.precio_fuente === "sistema";
    if (!sf && !pf) throw new ErrorTn("config", "Ni el stock ni el precio están configurados para que mande el sistema.", false, 409);
    const v = await this.db.select<{ variant_id: number; product_id: number; producto_local: string; stock: number | null; precio_cents: number | null }>("tn_productos", `comercio_id=eq.${this.comercio}&vinculo=eq.vinculado&select=variant_id,product_id,producto_local,stock,precio_cents`);
    const locales = await this.db.select<{ id: string; datos: Record<string, unknown> }>("registros", `comercio_id=eq.${this.comercio}&coleccion=eq.productos&borrado=eq.false&select=id,datos`);
    const L = new Map(locales.map((l) => [l.id, l.datos]));
    const r = { stock: 0, precio: 0, sin_cambios: 0, errores: 0 };
    for (const x of v) {
      const d = L.get(x.producto_local); if (!d) { r.errores++; continue; }
      let cambio = false;
      try {
        if (sf) {
          const s = Math.max(0, Math.floor(Number(d.stock ?? 0)));   // stock negativo en el sistema = 0 en la tienda
          if (x.stock === null || Number(x.stock) !== s) {
            await api.llamar("POST", `/products/${x.product_id}/variants/stock`, { action: "replace", value: s, id: x.variant_id });
            await this.db.patch("tn_productos", `comercio_id=eq.${this.comercio}&variant_id=eq.${x.variant_id}`, { stock: s }); r.stock++; cambio = true;
          }
        }
        if (pf) {
          const p = Number(d.price);
          if (Number.isInteger(p) && p > 0 && p !== x.precio_cents) {
            await api.llamar("PATCH", `/products/${x.product_id}/variants`, [{ id: x.variant_id, price: (p / 100).toFixed(2) }]);
            await this.db.patch("tn_productos", `comercio_id=eq.${this.comercio}&variant_id=eq.${x.variant_id}`, { precio_cents: p }); r.precio++; cambio = true;
          }
        }
        if (!cambio) r.sin_cambios++;
      } catch (e) {
        if (e instanceof ErrorTn && (e.etapa === "limite" || e.etapa === "autorizacion")) throw e;   // cortar: reintentar luego
        r.errores++;
      }
    }
    await this.marcar(null, true);
    await this.evento("sync/empujar", null, r.errores ? "error" : "ok", JSON.stringify(r));
    return { ok: true, ...r };
  }
}

// ------------------------------------------------------------------ OAuth (GET ?cb=1) y webhooks (POST ?wh=1)
async function intercambiarCodigo(env: Entorno, f: F, code: string) {
  const base = (env.TN_AUTH_BASE ?? "https://www.tiendanube.com").replace(/\/$/, "");
  const r = await f(`${base}/apps/authorize/token`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": env.TN_USER_AGENT ?? "SistemaVB (vincularbusiness@gmail.com)" },
    body: JSON.stringify({ client_id: env.TN_APP_ID, client_secret: env.TN_CLIENT_SECRET, grant_type: "authorization_code", code }) });
  if (!r.ok) throw new ErrorTn("oauth", "Tiendanube no aceptó la autorización (el código vence a los 5 minutos: repetí la conexión).", false, 400);
  const j = await r.json() as Record<string, unknown>;
  if (!j.access_token || !j.user_id) throw new ErrorTn("oauth", "Respuesta de autorización incompleta.", false, 502);
  return { token: String(j.access_token), store: Number(j.user_id), scope: String(j.scope ?? "") };
}

async function callback(url: URL, env: Entorno, f: F, db: Db, ahora: () => Date, dormir: (ms: number) => Promise<void>): Promise<Response> {
  const volver = (ok: boolean, motivo = "") => {
    const app = (env.APP_URL ?? "").replace(/#.*$/, "");
    if (!/^https:\/\//.test(app)) return new Response(ok ? "Tienda conectada. Ya podés cerrar esta pestaña." : "No se pudo conectar: " + motivo, { status: ok ? 200 : 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const d = new URL(app); d.searchParams.set("tn", ok ? "ok" : "error"); if (motivo) d.searchParams.set("motivo", motivo.slice(0, 80)); d.hash = "#panel/integ";
    return new Response(null, { status: 302, headers: { Location: d.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  };
  const code = url.searchParams.get("code") ?? "", state = url.searchParams.get("state") ?? "";
  if (!/^[\w-]{6,200}$/.test(code) || !/^[0-9a-f]{48}$/.test(state)) return volver(false, "pedido inválido");
  const s = await db.rpc("tn_consumir_estado", { p_hash: await sha256Hex(state) }) as { comercio: string; usuario: string } | null;
  if (!s) return volver(false, "el enlace de conexión venció o ya se usó");
  try {
    const t = await intercambiarCodigo(env, f, code);
    const otra = await db.select<{ comercio_id: string }>("tn_conexion", `store_id=eq.${t.store}&estado=eq.conectada&comercio_id=neq.${s.comercio}&select=comercio_id`);
    if (otra.length) return volver(false, "esa tienda ya está conectada a otro comercio");
    await db.upsert("tn_conexion", { comercio_id: s.comercio, store_id: t.store, token_cifrado: await cifrar(env, t.token, s.comercio), scope: t.scope.slice(0, 200), estado: "conectada",
      conectado_por: s.usuario, conectado_en: ahora().toISOString(), ultimo_error: null, actualizado: ahora().toISOString() }, "comercio_id");
    const ctx = new Ctx(env, f, db, s.comercio, dormir, ahora);
    const api = new ApiTn(env, f, t.token, t.store, dormir);
    const prev = await api.llamar("GET", "/webhooks").catch(() => ({ datos: [] as unknown }));
    const ya = new Set(((Array.isArray(prev.datos) ? prev.datos : []) as Record<string, unknown>[]).filter((w) => String(w.url) === ctx.urlWebhook()).map((w) => String(w.event)));
    let falla = 0;
    for (const ev of EVENTOS_WEBHOOK) if (!ya.has(ev)) { try { await api.llamar("POST", "/webhooks", { event: ev, url: ctx.urlWebhook() }); } catch (_e) { falla++; } }
    await ctx.evento("conexion/conectada", t.store, falla ? "error" : "ok", falla ? `${falla} avisos no se pudieron registrar` : undefined);
    if (falla) await ctx.marcar(`${falla} avisos (webhooks) no se pudieron registrar: reintentá "Registrar avisos".`);
    return volver(true);
  } catch (e) {
    return volver(false, e instanceof ErrorTn ? e.message : "error interno");
  }
}

async function webhook(req: Request, env: Entorno, f: F, db: Db, ahora: () => Date, dormir: (ms: number) => Promise<void>): Promise<Response> {
  const R = (s: number, o: unknown = { ok: true }) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (!env.TN_CLIENT_SECRET) return R(503, { error: "sin configurar" });
  const cuerpo = await req.text();
  if (cuerpo.length > 20_000) return R(413, { error: "demasiado grande" });
  const firma = (req.headers.get("x-linkedstore-hmac-sha256") ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(firma) || !igualesConstante(firma, await hmacHex(env.TN_CLIENT_SECRET, cuerpo))) return R(401, { error: "firma inválida" });
  let p: Record<string, unknown>; try { p = JSON.parse(cuerpo); } catch { return R(400, { error: "cuerpo inválido" }); }
  const store = Number(p.store_id), evento = String(p.event ?? "").slice(0, 80), id = Number(p.id) || null;
  if (!Number.isFinite(store) || !evento) return R(400, { error: "datos incompletos" });
  const con = (await db.select<Conexion>("tn_conexion", `store_id=eq.${store}&estado=eq.conectada&select=*`))[0];
  if (!con) return R(200, { ok: true, ignorado: "tienda no conectada" });
  const ctx = new Ctx(env, f, db, con.comercio_id, dormir, ahora);
  try {
    if (evento === "app/uninstalled") {
      await db.patch("tn_conexion", `comercio_id=eq.${con.comercio_id}`, { estado: "revocada", token_cifrado: null, actualizado: ahora().toISOString() });
      await ctx.evento(evento, store, "ok", "la tienda desinstaló la app"); return R(200);
    }
    if (evento.startsWith("order/") && id) {
      if (con.config.importar_ordenes !== true) { await ctx.evento(evento, id, "ignorado", "importación apagada"); return R(200); }
      const { api } = await ctx.api();
      const { datos } = await api.llamar("GET", `/orders/${id}`);
      if (!datos) { await ctx.evento(evento, id, "ignorado", "la orden ya no existe"); return R(200); }
      const x = await ctx.guardarOrden(datos as Record<string, unknown>, await ctx.vinculados());
      await ctx.evento(evento, id, x === "ok" ? "ok" : x === "duplicado" ? "duplicado" : "ignorado"); return R(200);
    }
    if (evento.startsWith("product/") && id) {
      if (evento === "product/deleted") { await ctx.evento(evento, id, "ok", "producto borrado en la tienda (el vínculo se conserva hasta que lo revises)"); return R(200); }
      const { api } = await ctx.api();
      const { datos } = await api.llamar("GET", `/products/${id}`);
      if (datos) {
        const prev = await db.select<{ variant_id: number; vinculo: string; producto_local: string | null }>("tn_productos", `comercio_id=eq.${con.comercio_id}&product_id=eq.${id}&select=variant_id,vinculo,producto_local`);
        const pv = new Map(prev.map((x) => [x.variant_id, x]));
        const filas = variantesDeProducto(datos as Record<string, unknown>).map((v) => ({ comercio_id: con.comercio_id, ...v, vinculo: pv.get(v.variant_id)?.vinculo ?? "sin_vincular", producto_local: pv.get(v.variant_id)?.producto_local ?? null, sincronizado: ahora().toISOString() }));
        if (filas.length) await db.upsert("tn_productos", filas, "comercio_id,variant_id");
      }
      await ctx.evento(evento, id, "ok"); return R(200);
    }
    await ctx.evento(evento, id, "ignorado", "evento sin manejar"); return R(200);
  } catch (e) {
    const t = e instanceof ErrorTn ? e : null;
    await ctx.evento(evento, id, "error", t ? t.message : "error interno");
    return R(t && !t.reintentable && t.etapa !== "red" ? 200 : 500, { error: "reintentar" });   // 5xx → Tiendanube reintenta (hasta 16 veces)
  }
}

// ------------------------------------------------------------------ HTTP
export async function manejar(req: Request, env: Entorno, f: F = fetch, ahora: () => Date = () => new Date(), dormir: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<Response> {
  const url = new URL(req.url);
  const db = baseDatos(env, f);
  if (req.method === "GET" && url.searchParams.get("cb") === "1") return await callback(url, env, f, db, ahora, dormir);
  if (req.method === "POST" && url.searchParams.get("wh") === "1") return await webhook(req, env, f, db, ahora, dormir);

  const cors = corsHeaders(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const resp = (status: number, o: unknown) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  if (req.method !== "POST") return resp(405, { error: "Método no permitido" });
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth)) return resp(401, { error: "Falta iniciar sesión" });
  let body: Record<string, unknown>;
  try { const txt = await req.text(); if (txt.length > 8_000) return resp(413, { error: "Pedido demasiado grande" }); body = JSON.parse(txt); } catch { return resp(400, { error: "Pedido inválido" }); }
  const comercio = String(body.comercio ?? ""), accion = String(body.accion ?? "");
  if (!UUID.test(comercio)) return resp(400, { error: "Datos inválidos" });
  try {
    let q: { uid?: string; rol?: string } | null;
    try { q = await db.rpc("arca_quien", { p_comercio: comercio }, auth); } catch { return resp(401, { error: "Sesión inválida o vencida: volvé a ingresar" }); }
    if (!q?.rol) return resp(403, { error: "No sos parte de este comercio" });
    const rol = String(q.rol), uid = String(q.uid);
    const ctx = new Ctx(env, f, db, comercio, dormir, ahora); ctx.jwt = auth;
    const es = (...r: string[]) => r.includes(rol);
    switch (accion) {
      case "estado": if (!es("admin", "supervisor")) break; return resp(200, await ctx.estado());
      case "iniciar": if (!es("admin")) break; return resp(200, await ctx.iniciar(uid));
      case "desconectar": if (!es("admin")) break; return resp(200, await ctx.desconectar());
      case "sincronizar_productos": if (!es("admin", "supervisor")) break; return resp(200, await ctx.sincronizarProductos());
      case "importar_ordenes": if (!es("admin", "supervisor")) break; return resp(200, await ctx.importarOrdenes());
      case "empujar": if (!es("admin")) break; return resp(200, await ctx.empujar());
      case "registrar_avisos": {
        if (!es("admin")) break;
        const { api } = await ctx.api(); const { datos } = await api.llamar("GET", "/webhooks");
        const ya = new Set(((Array.isArray(datos) ? datos : []) as Record<string, unknown>[]).filter((w) => String(w.url) === ctx.urlWebhook()).map((w) => String(w.event)));
        let n = 0; for (const ev of EVENTOS_WEBHOOK) if (!ya.has(ev)) { await api.llamar("POST", "/webhooks", { event: ev, url: ctx.urlWebhook() }); n++; }
        await ctx.marcar(null); return resp(200, { ok: true, registrados: n, total: EVENTOS_WEBHOOK.length });
      }
      default: return resp(400, { error: "Acción desconocida" });
    }
    return resp(403, { error: "Tu rol no puede hacer esto" });
  } catch (e) {
    if (e instanceof ErrorTn) {
      try { if (["autorizacion", "api", "red"].includes(e.etapa)) await new Ctx(env, f, db, comercio, dormir, ahora).marcar(e.message); } catch { /* */ }
      return resp(e.status, { error: e.message, etapa: e.etapa, reintentable: e.reintentable });
    }
    console.error("tiendanube: error interno:", e instanceof Error ? e.message.slice(0, 200) : "desconocido");
    return resp(500, { error: "Error interno. Probá de nuevo; si sigue, avisá a Vincular Business." });
  }
}

function corsHeaders(req: Request, env: Entorno): Record<string, string> {
  const permitidos = (env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") ?? "";
  const ok = permitidos.includes("*") ? "*" : permitidos.includes(origin) ? origin : permitidos[0] ?? "";
  return { "Access-Control-Allow-Origin": ok, "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
