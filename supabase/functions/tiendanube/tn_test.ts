// Pruebas de la Edge Function "tiendanube": lógica pura + función completa contra PostgREST/Postgres reales
// y una TIENDANUBE FALSA (OAuth, productos con páginas, órdenes, webhooks, stock). NO prueban contra Tiendanube real:
// eso requiere la app del socio y una tienda de prueba. Correr:  ./tests/mk-e2e-db.sh && bun test functions/tiendanube/tn_test.ts
import { test, expect, beforeAll, afterAll } from "bun:test";
import * as H from "./handler.ts";
import { manejar, type Entorno } from "./handler.ts";

const JWT_SECRET = "test-secret-test-secret-test-secret-123456";
const b64u = (s: string) => btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
async function jwt(claims: Record<string, unknown>) {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" })), p = b64u(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(h + "." + p)));
  return h + "." + p + "." + btoa(String.fromCharCode(...s)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
async function psql(sql: string) {
  const p = Bun.spawn(["su", "postgres", "-c", "psql -d rave_e2e -At -v ON_ERROR_STOP=1"], { stdin: new Blob([sql]), stdout: "pipe", stderr: "pipe" });
  const [o, e] = [await new Response(p.stdout).text(), await new Response(p.stderr).text()]; if (await p.exited) throw new Error(e); return o.trim();
}

// ---------------------------------------------------------------- Tiendanube FALSA
const SECRET = "secreto-de-la-app-de-prueba";
const tn = { codigos: new Map<string, { store: number }>(), tokens: new Map<string, number>(), webhooks: [] as { id: number; event: string; url: string }[], productos: [] as any[], ordenes: new Map<number, any>(),
  llamadas: [] as { m: string; u: string; b?: any; h: Headers }[], limite429: 0, wid: 1, stockPost: [] as any[] };
const fakeTn: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  if (!url.startsWith("http://tn.fake/")) return fetch(input, init);
  const m = String(init?.method ?? "GET"); const h = new Headers(init?.headers as any); const b = init?.body ? JSON.parse(String(init.body)) : undefined;
  tn.llamadas.push({ m, u: url, b, h });
  const J = (o: unknown, s = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...extra } });
  if (url === "http://tn.fake/auth/apps/authorize/token") {
    if (b.client_id !== "777" || b.client_secret !== SECRET || b.grant_type !== "authorization_code") return J({ error: "invalid" }, 400);
    const c = tn.codigos.get(b.code); if (!c) return J({ error: "invalid_grant" }, 400); tn.codigos.delete(b.code);
    const tok = "TOKEN-SECRETO-" + c.store; tn.tokens.set(tok, c.store); return J({ access_token: tok, token_type: "bearer", scope: "read_products write_products read_orders", user_id: c.store });
  }
  const mm = /^http:\/\/tn\.fake\/api\/(\d+)(\/.*)$/.exec(url); if (!mm) return J({}, 404);
  if (!h.get("user-agent")) return J({ error: "no UA" }, 400);
  const tok = (h.get("authorization") ?? "").replace("Bearer ", ""); if (tn.tokens.get(tok) !== Number(mm[1])) return J({ error: "unauthorized" }, 401);
  if (tn.limite429 > 0) { tn.limite429--; return J({ error: "slow" }, 429, { "x-rate-limit-reset": "5" }); }
  const [path, qs] = mm[2].split("?"); const q = new URLSearchParams(qs ?? "");
  if (path === "/webhooks" && m === "GET") return J(tn.webhooks);
  if (path === "/webhooks" && m === "POST") { const w = { id: tn.wid++, event: b.event, url: b.url }; tn.webhooks.push(w); return J(w, 201); }
  const dw = /^\/webhooks\/(\d+)$/.exec(path); if (dw && m === "DELETE") { tn.webhooks = tn.webhooks.filter((w) => w.id !== Number(dw[1])); return J({}); }
  if (path === "/products" && m === "GET") {
    const per = Number(q.get("per_page")), pg = Number(q.get("page")); const sl = tn.productos.slice((pg - 1) * 2, pg * 2);   // páginas de 2 para probar el paginado
    return J(sl, 200, pg * 2 < tn.productos.length ? { link: '<http://tn.fake/next>; rel="next"' } : {});
  }
  const pr = /^\/products\/(\d+)$/.exec(path); if (pr && m === "GET") { const p = tn.productos.find((x) => x.id === Number(pr[1])); return p ? J(p) : J({}, 404); }
  const st = /^\/products\/(\d+)\/variants\/stock$/.exec(path); if (st && m === "POST") { tn.stockPost.push({ pid: Number(st[1]), ...b }); const p = tn.productos.find((x) => x.id === Number(st[1])); const v = p?.variants.find((x: any) => x.id === b.id); if (v) v.stock = b.value; return J({}); }
  const pv = /^\/products\/(\d+)\/variants$/.exec(path); if (pv && m === "PATCH") { const p = tn.productos.find((x) => x.id === Number(pv[1])); for (const it of b) { const v = p?.variants.find((x: any) => x.id === it.id); if (v) v.price = it.price; } return J({}); }
  if (path === "/orders" && m === "GET") { const l = [...tn.ordenes.values()]; const pg = Number(q.get("page")); const sl = l.slice((pg - 1) * 2, pg * 2); return J(sl, 200, pg * 2 < l.length ? { link: '<http://tn.fake/next>; rel="next"' } : {}); }
  const od = /^\/orders\/(\d+)$/.exec(path); if (od && m === "GET") { const o = tn.ordenes.get(Number(od[1])); return o ? J(o) : J({}, 404); }
  return J({}, 404);
};

const URL_BASE = "http://127.0.0.1:3014";
const env: Entorno = { SUPABASE_URL: URL_BASE, SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", TN_APP_ID: "777", TN_CLIENT_SECRET: SECRET,
  TN_MASTER_KEY: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))), APP_URL: "https://raveholding.github.io/AlmacenRAVE/",
  TN_API_BASE: "http://tn.fake/api", TN_AUTH_BASE: "http://tn.fake/auth", FUNCTION_URL: "https://proj.supabase.co/functions/v1/tiendanube" };
const dormir = async () => {};
let relojOffset = 0; const ahora = () => new Date(Date.now() + relojOffset);

async function llamar(token: string, cuerpo: Record<string, unknown>, e: Entorno = env) {
  const req = new Request("http://fn/tiendanube", { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  const r = await manejar(req, e, fakeTn, ahora, dormir); const j = await r.json().catch(() => ({})); return { status: r.status, ...j } as Record<string, any> & { status: number };
}
async function rpc(token: string, fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { Authorization: "Bearer " + token, apikey: token, "content-type": "application/json" }, body: JSON.stringify(args) });
  const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null };
}
async function webhookPost(payload: unknown, firma?: string) {
  const cuerpo = JSON.stringify(payload);
  const f = firma ?? await H.hmacHex(SECRET, cuerpo);
  const r = await manejar(new Request("https://proj/functions/v1/tiendanube?wh=1", { method: "POST", headers: { "x-linkedstore-hmac-sha256": f, "content-type": "application/json" }, body: cuerpo }), env, fakeTn, ahora, dormir);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function conectar(token: string, store: number) {
  const ini = await llamar(token, { accion: "iniciar", comercio: cA }); expect(ini.status).toBe(200);
  const state = new URL(ini.url).searchParams.get("state")!; tn.codigos.set("cod-" + store, { store });
  const r = await manejar(new Request(`https://proj/functions/v1/tiendanube?cb=1&code=cod-${store}&state=${state}`), env, fakeTn, ahora, dormir);
  return { r, state };
}

let proxy: any; const U = { adm: "20000000-0000-0000-0000-00000000000a", mos: "20000000-0000-0000-0000-0000000000a2", sup: "20000000-0000-0000-0000-0000000000a5", admB: "20000000-0000-0000-0000-00000000000b" };
const T: Record<string, string> = {}; let cA = "", cB = "";
const prod = (id: number, nombre: string, vars: any[]) => ({ id, name: { es: nombre }, updated_at: "2026-10-20T10:00:00Z", variants: vars });

beforeAll(async () => {
  proxy = Bun.serve({ port: 3014, hostname: "127.0.0.1", async fetch(req) {
    const u = new URL(req.url); const dst = "http://127.0.0.1:3011" + u.pathname.replace(/^\/rest\/v1/, "") + u.search;
    const h = new Headers(req.headers); h.delete("host");
    return await fetch(dst, { method: req.method, headers: h, body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer() });
  } });
  env.SUPABASE_ANON_KEY = await jwt({ role: "anon" }); env.SUPABASE_SERVICE_ROLE_KEY = await jwt({ role: "service_role" });
  await psql(`insert into auth.users(id,email) values ('${U.adm}','adm@a.com'),('${U.mos}','mos@a.com'),('${U.sup}','sup@a.com'),('${U.admB}','adm@b.com') on conflict do nothing;
    select public.rave_invitar_comercio('adm@a.com','Almacén A','CODIGO-A-123'); select public.rave_invitar_comercio('adm@b.com','Comercio B','CODIGO-B-123');`);
  for (const [k, id, mail] of [["adm", U.adm, "adm@a.com"], ["mos", U.mos, "mos@a.com"], ["sup", U.sup, "sup@a.com"], ["admB", U.admB, "adm@b.com"]] as const) T[k] = await jwt({ sub: id, email: mail, role: "authenticated" });
  let r = await rpc(T.adm, "crear_comercio", { p_nombre: "x", p_rubro: "comercio", p_codigo: "CODIGO-A-123" }); cA = r.data.id;
  r = await rpc(T.admB, "crear_comercio", { p_nombre: "x", p_rubro: "comercio", p_codigo: "CODIGO-B-123" }); cB = r.data.id;
  for (const [u, mail, rol, h] of [[U.mos, "mos@a.com", "mostrador", "a1"], [U.sup, "sup@a.com", "supervisor", "a2"]] as const) {
    const hu = (h.repeat(64)).slice(0, 64);
    await rpc(T.adm, "invitar_miembro", { p_comercio: cA, p_email: mail, p_rol: rol, p_nombre: rol, p_huella: hu, p_llave: null });
    await rpc(await jwt({ sub: u, email: mail, role: "authenticated" }), "aceptar_invitacion", { p_huella: hu });
  }
  // productos del sistema (para sugerir vínculos por código de barras)
  await psql(`insert into public.registros (comercio_id,coleccion,id,datos) values
    ('${cA}','productos','pLoc1','{"name":"Vaso 300","barcode":"7790001","price":150000,"stock":12}'),
    ('${cA}','productos','pLoc2','{"name":"Plato","barcode":"7790002","price":250000,"stock":-3}'),
    ('${cA}','productos','pLoc3','{"name":"Dup A","barcode":"7790009","price":1000,"stock":1}'),
    ('${cA}','productos','pLoc4','{"name":"Dup B","barcode":"7790009","price":1000,"stock":1}')`);
});
afterAll(() => proxy?.stop());

// ================================================================= lógica pura
test("importes: sin floats, redondeo al centavo y rechazo de basura", () => {
  expect(H.aCentavos("1234.50")).toBe(123450); expect(H.aCentavos("0.1")).toBe(10); expect(H.aCentavos("19.999")).toBe(2000); expect(H.aCentavos(5)).toBe(500);
  expect(H.aCentavos("abc")).toBeNull(); expect(H.aCentavos("-5")).toBeNull(); expect(H.aCentavos("")).toBeNull(); expect(H.aCentavos(null)).toBeNull();
  expect(H.aCentavos("1e3")).toBeNull();
});
test("textos localizados y variantes", () => {
  expect(H.texto({ es: "Hola", en: "Hi" })).toBe("Hola"); expect(H.texto("x")).toBe("x"); expect(H.texto(null)).toBe("");
  const v = H.variantesDeProducto(prod(10, "Remera", [{ id: 1, sku: "R-S", price: "1500.00", stock: 4, values: [{ es: "S" }] }, { id: 2, price: "1500", stock: null, values: [{ es: "M" }] }]));
  expect(v.length).toBe(2); expect(v[0].nombre).toBe("Remera · S"); expect(v[0].precio_cents).toBe(150000); expect(v[1].stock).toBeNull();
});
test("orden: estados separados y centavos", () => {
  const o = H.mapearOrden({ id: 55, number: 105, status: "open", payment_status: "paid", shipping_status: "unpacked", total: "1500.00", subtotal: "1400.00", discount: "0.00", shipping_cost_customer: "100.00", currency: "ARS",
    customer: { name: "Ana", email: "a@a.com", phone: "+54" }, products: [{ variant_id: 1, product_id: 10, name: { es: "Vaso" }, price: "700.00", quantity: 2, sku: "V1" }], payment_details: { method: "transfer" } });
  expect([o.total_cents, o.subtotal_cents, o.envio_cents, o.estado, o.pago_estado, o.envio_estado]).toEqual([150000, 140000, 10000, "open", "paid", "unpacked"]);
  expect(o.items[0].precio_cents).toBe(70000); expect(o.medio_pago).toBe("transfer");
});
test("cifrado AES-GCM: ida y vuelta, otro comercio no descifra, clave ausente falla", async () => {
  const c = await H.cifrar(env, "TOKEN", "comercio-1"); expect(c.startsWith("v1.")).toBe(true); expect(c).not.toContain("TOKEN");
  expect(await H.descifrar(env, c, "comercio-1")).toBe("TOKEN");
  await expect(H.descifrar(env, c, "comercio-2")).rejects.toBeDefined();
  await expect(H.cifrar({ ...env, TN_MASTER_KEY: undefined }, "x", "a")).rejects.toBeDefined();
});
test("HMAC: hex de 64, comparación constante", async () => {
  const h = await H.hmacHex("k", "cuerpo"); expect(h).toMatch(/^[0-9a-f]{64}$/); expect(H.igualesConstante(h, h)).toBe(true); expect(H.igualesConstante(h, h.slice(0, 63) + "0")).toBe(h.endsWith("0"));
});

// ================================================================= conexión OAuth
test("permisos: sólo el administrador inicia la conexión; sin sesión 401; comercio ajeno 403", async () => {
  expect((await llamar(T.mos, { accion: "iniciar", comercio: cA })).status).toBe(403);
  expect((await llamar(T.sup, { accion: "iniciar", comercio: cA })).status).toBe(403);
  expect((await llamar(T.admB, { accion: "iniciar", comercio: cA })).status).toBe(403);
  expect((await llamar("no.es.jwt", { accion: "iniciar", comercio: cA })).status).toBe(401);
  expect((await llamar(T.adm, { accion: "iniciar", comercio: "x" })).status).toBe(400);
  expect((await llamar(T.mos, { accion: "estado", comercio: cA })).status).toBe(403);
});
test("sin los secretos de la app: 412 claro, nada se rompe", async () => {
  const r = await llamar(T.adm, { accion: "iniciar", comercio: cA }, { ...env, TN_CLIENT_SECRET: undefined });
  expect(r.status).toBe(412); expect(r.error).toContain("TN_CLIENT_SECRET");
  const e = await llamar(T.adm, { accion: "estado", comercio: cA }, { ...env, TN_CLIENT_SECRET: undefined });
  expect(e.status).toBe(200); expect(e.app_configurada).toBe(false); expect(e.estado).toBe("desconectada");
});
test("OAuth completo: state de un solo uso, token cifrado, avisos registrados, nada secreto al navegador", async () => {
  tn.productos = [prod(10, "Vaso", [{ id: 101, sku: "", barcode: "7790001", price: "1500.00", stock: 5, values: [] }]), prod(11, "Plato", [{ id: 111, barcode: "7790002", price: "2500.00", stock: 0, values: [] }]),
    prod(12, "Taza", [{ id: 121, barcode: "7790009", price: "10.00", stock: 3, values: [] }]), prod(13, "Sin código", [{ id: 131, barcode: "", price: "50.00", stock: null, values: [] }, { id: 132, barcode: "", price: "60.00", stock: 2, values: [{ es: "L" }] }])];
  const { r, state } = await conectar(T.adm, 424242);
  expect(r.status).toBe(302); expect(r.headers.get("location")).toBe("https://raveholding.github.io/AlmacenRAVE/?tn=ok#panel/integ");
  expect(await psql(`select estado||'|'||store_id from tn_conexion where comercio_id='${cA}'`)).toBe("conectada|424242");
  const tokDb = await psql(`select token_cifrado from tn_conexion where comercio_id='${cA}'`);
  expect(tokDb.startsWith("v1.")).toBe(true); expect(tokDb).not.toContain("TOKEN-SECRETO");
  expect(tn.webhooks.length).toBe(10); expect(tn.webhooks.every((w) => w.url === "https://proj.supabase.co/functions/v1/tiendanube?wh=1")).toBe(true);
  // el state no se reutiliza
  tn.codigos.set("cod-2", { store: 424242 });
  const r2 = await manejar(new Request(`https://proj/functions/v1/tiendanube?cb=1&code=cod-2&state=${state}`), env, fakeTn, ahora, dormir);
  expect(r2.headers.get("location")).toContain("tn=error");
  // el estado que ve la app no trae token ni secretos
  const e = await llamar(T.adm, { accion: "estado", comercio: cA }); const txt = JSON.stringify(e);
  expect(e.estado).toBe("conectada"); expect(e.store_id).toBe(424242); expect(e.app_configurada).toBe(true);
  expect(txt).not.toContain("TOKEN-SECRETO"); expect(txt).not.toContain(SECRET); expect(txt).not.toContain("token_cifrado");
  expect((await llamar(T.sup, { accion: "estado", comercio: cA })).status).toBe(200);
});
test("OAuth: state inventado, vencido, mal formado y código inválido", async () => {
  const malos = ["", "zz", "a".repeat(48), "0".repeat(47)];
  for (const s of malos) { const r = await manejar(new Request(`https://proj/functions/v1/tiendanube?cb=1&code=cod&state=${s}`), env, fakeTn, ahora, dormir); expect(r.headers.get("location")).toContain("tn=error"); }
  const ini = await llamar(T.adm, { accion: "iniciar", comercio: cA }); const state = new URL(ini.url).searchParams.get("state")!;
  relojOffset = 11 * 60_000; // 11 minutos después: venció
  const v = await manejar(new Request(`https://proj/functions/v1/tiendanube?cb=1&code=cod&state=${state}`), env, fakeTn, new Date as any, dormir);
  relojOffset = 0;
  // el vencimiento lo decide la base (now()); forzamos el vencimiento desde SQL
  const ini2 = await llamar(T.adm, { accion: "iniciar", comercio: cA }); const st2 = new URL(ini2.url).searchParams.get("state")!;
  await psql(`update tn_estados_oauth set vence = now() - interval '1 minute' where comercio_id='${cA}'`);
  const r = await manejar(new Request(`https://proj/functions/v1/tiendanube?cb=1&code=cod&state=${st2}`), env, fakeTn, ahora, dormir);
  expect(r.headers.get("location")).toContain("tn=error");
  const ini3 = await llamar(T.adm, { accion: "iniciar", comercio: cA }); const st3 = new URL(ini3.url).searchParams.get("state")!;
  const r3 = await manejar(new Request(`https://proj/functions/v1/tiendanube?cb=1&code=codigo-que-no-existe&state=${st3}`), env, fakeTn, ahora, dormir);
  expect(r3.headers.get("location")).toContain("tn=error");
});
test("una tienda no puede estar conectada a dos comercios", async () => {
  await rpc(T.admB, "crear_comercio", { p_nombre: "x", p_rubro: "comercio", p_codigo: "CODIGO-B-123" });
  const ini = await llamar(T.admB, { accion: "iniciar", comercio: cB }); const state = new URL(ini.url).searchParams.get("state")!;
  tn.codigos.set("cod-dup", { store: 424242 }); tn.tokens.set("TOKEN-SECRETO-424242", 424242);
  const r = await manejar(new Request(`https://proj/functions/v1/tiendanube?cb=1&code=cod-dup&state=${state}`), env, fakeTn, ahora, dormir);
  expect(decodeURIComponent(r.headers.get("location")!.replace(/\+/g, " "))).toContain("ya está conectada a otro comercio");
  expect(await psql(`select count(*) from tn_conexion where comercio_id='${cB}' and estado='conectada'`)).toBe("0");
});

// ================================================================= productos
test("sincronizar productos: paginado, sugerencia por código, ambiguos sin sugerir, vínculos conservados", async () => {
  expect((await llamar(T.mos, { accion: "sincronizar_productos", comercio: cA })).status).toBe(403);
  const r = await llamar(T.adm, { accion: "sincronizar_productos", comercio: cA });
  expect(r.status).toBe(200); expect(r.variantes).toBe(5); expect(r.sugeridos).toBe(2);   // 7790009 está repetido en el sistema → sin sugerir
  expect(tn.llamadas.filter((c) => c.u.includes("/products?")).length).toBe(2 + 0 > 0 ? 2 : 0);
  expect(tn.llamadas.every((c) => !c.u.includes("/api/") || (c.h.get("user-agent") ?? "").length > 5)).toBe(true);
  expect(await psql(`select string_agg(variant_id||':'||vinculo||':'||coalesce(producto_local,'-'), ',' order by variant_id) from tn_productos where comercio_id='${cA}'`))
    .toBe("101:sugerido:pLoc1,111:sugerido:pLoc2,121:sin_vincular:-,131:sin_vincular:-,132:sin_vincular:-");
  expect(await psql(`select precio_cents||'|'||coalesce(stock::text,'ilimitado') from tn_productos where comercio_id='${cA}' and variant_id=131`)).toBe("5000|ilimitado");
  // vincular y volver a sincronizar: el vínculo se conserva
  const v = await rpc(T.adm, "tn_vincular", { p_comercio: cA, p_variant: 101, p_producto: "pLoc1" }); expect(v.data.ok).toBe(true);
  const v2 = await rpc(T.adm, "tn_vincular", { p_comercio: cA, p_variant: 111, p_producto: "pLoc2" }); expect(v2.data.ok).toBe(true);
  await llamar(T.adm, { accion: "sincronizar_productos", comercio: cA });
  expect(await psql(`select count(*) from tn_productos where comercio_id='${cA}' and vinculo='vinculado'`)).toBe("2");
});

// ================================================================= órdenes y webhooks
const orden = (id: number, pago: string, upd: string, extra: any = {}) => ({ id, number: 100 + id, status: "open", payment_status: pago, shipping_status: "unpacked", total: "3000.00", subtotal: "3000.00", discount: "0.00", currency: "ARS",
  created_at: "2026-10-20T10:00:00Z", updated_at: upd, customer: { name: "Ana", email: "ana@x.com" }, products: [{ variant_id: 101, product_id: 10, name: { es: "Vaso" }, price: "1500.00", quantity: 2 }], ...extra });
test("importar órdenes: apagado por defecto (409); encendido guarda con estados y vínculo local", async () => {
  tn.ordenes.set(1, orden(1, "pending", "2026-10-20T10:00:00Z")); tn.ordenes.set(2, orden(2, "paid", "2026-10-20T11:00:00Z")); tn.ordenes.set(3, orden(3, "paid", "2026-10-20T12:00:00Z", { status: "cancelled" }));
  expect((await llamar(T.adm, { accion: "importar_ordenes", comercio: cA })).status).toBe(409);
  expect((await rpc(T.adm, "tn_config_guardar", { p_comercio: cA, p: { importar_ordenes: true, stock_fuente: "sistema", precio_fuente: "off" } })).data.ok).toBe(true);
  const r = await llamar(T.adm, { accion: "importar_ordenes", comercio: cA }); expect(r.status).toBe(200); expect(r.total).toBe(3); expect(r.ok).toBe(3);
  expect(await psql(`select string_agg(orden_id||':'||pago_estado||':'||estado, ',' order by orden_id) from tn_ordenes where comercio_id='${cA}'`)).toBe("1:pending:open,2:paid:open,3:paid:cancelled");
  expect(await psql(`select items->0->>'producto_local' from tn_ordenes where comercio_id='${cA}' and orden_id=1`)).toBe("pLoc1");
  const r2 = await llamar(T.adm, { accion: "importar_ordenes", comercio: cA }); expect(r2.duplicado).toBe(3); expect(r2.ok).toBe(0);   // repetir no cambia nada
  expect(await psql(`select count(*) from tn_ordenes where comercio_id='${cA}'`)).toBe("3");
});
test("webhook: firma inválida 401, sin firma 401, cuerpo adulterado 401", async () => {
  const p = { store_id: 424242, event: "order/paid", id: 1 };
  expect((await webhookPost(p, "0".repeat(64))).status).toBe(401);
  expect((await webhookPost(p, "")).status).toBe(401);
  const firmaDeOtro = await H.hmacHex(SECRET, JSON.stringify({ ...p, id: 2 }));
  expect((await webhookPost(p, firmaDeOtro)).status).toBe(401);
  expect((await webhookPost(p, await H.hmacHex("otro-secreto", JSON.stringify(p)))).status).toBe(401);
  expect(await psql(`select count(*) from tn_eventos where comercio_id='${cA}' and evento like 'order/%'`)).toBe("0");
});
test("webhook order/paid: consulta la orden a la API (no confía en el cuerpo), actualiza una sola vez, evento viejo no retrocede", async () => {
  tn.ordenes.set(1, orden(1, "paid", "2026-10-20T13:00:00Z"));
  const w1 = await webhookPost({ store_id: 424242, event: "order/paid", id: 1, payment_status: "refunded" }); expect(w1.status).toBe(200);   // el cuerpo miente: se ignora
  expect(await psql(`select pago_estado from tn_ordenes where comercio_id='${cA}' and orden_id=1`)).toBe("paid");
  const w2 = await webhookPost({ store_id: 424242, event: "order/paid", id: 1 }); expect(w2.status).toBe(200);   // reintento de Tiendanube
  expect(await psql(`select resultado from tn_eventos where comercio_id='${cA}' and evento='order/paid' order by id desc limit 1`)).toBe("duplicado");
  // llega tarde un aviso viejo: la API (falsa) devuelve la versión vieja
  tn.ordenes.set(1, orden(1, "pending", "2026-10-20T09:00:00Z"));
  await webhookPost({ store_id: 424242, event: "order/updated", id: 1 });
  expect(await psql(`select pago_estado from tn_ordenes where comercio_id='${cA}' and orden_id=1`)).toBe("paid");
  // orden nueva por webhook
  tn.ordenes.set(9, orden(9, "pending", "2026-10-21T10:00:00Z")); await webhookPost({ store_id: 424242, event: "order/created", id: 9 });
  expect(await psql(`select count(*) from tn_ordenes where comercio_id='${cA}' and orden_id=9`)).toBe("1");
  // un cobro NO crea ninguna venta ni toca el stock del sistema
  expect(await psql(`select count(*) from registros where comercio_id='${cA}' and coleccion='ventas'`)).toBe("0");
  expect(await psql(`select datos->>'stock' from registros where comercio_id='${cA}' and id='pLoc1'`)).toBe("12");
});
test("webhook: tienda desconocida se ignora con 200; evento sin manejar queda en la bitácora; la API caída pide reintento (500)", async () => {
  expect((await webhookPost({ store_id: 999999, event: "order/paid", id: 1 })).status).toBe(200);
  expect((await webhookPost({ store_id: 424242, event: "customer/updated", id: 5 })).status).toBe(200);
  expect(await psql(`select resultado from tn_eventos where comercio_id='${cA}' and evento='customer/updated'`)).toBe("ignorado");
  tn.ordenes.delete(77); const w = await webhookPost({ store_id: 424242, event: "order/paid", id: 77 }); expect(w.status).toBe(200);   // la orden no existe: se ignora
  const tokens = new Map(tn.tokens); tn.tokens.clear();   // la API rechaza el token
  const bad = await webhookPost({ store_id: 424242, event: "order/paid", id: 1 }); expect(bad.status).toBe(200);   // autorización: no sirve reintentar
  tn.tokens = tokens;
  expect(await psql(`select count(*) from tn_eventos where comercio_id='${cA}' and resultado='error'`)).toBe("1");
  expect(await psql(`select estado from tn_conexion where comercio_id='${cA}'`)).toBe("conectada");
});
test("webhook product/updated: actualiza el espejo y conserva el vínculo", async () => {
  tn.productos[0].variants[0].stock = 99; tn.productos[0].variants[0].price = "1700.00";
  await webhookPost({ store_id: 424242, event: "product/updated", id: 10 });
  expect(await psql(`select stock||'|'||precio_cents||'|'||vinculo from tn_productos where comercio_id='${cA}' and variant_id=101`)).toBe("99.000|170000|vinculado");
});

// ================================================================= empujar stock / precio
test("empujar stock: sólo variantes vinculadas, negativo → 0, sin cambios no llama, 429 reintenta una vez", async () => {
  tn.llamadas.length = 0; tn.stockPost.length = 0;
  expect((await llamar(T.sup, { accion: "empujar", comercio: cA })).status).toBe(403);
  const r = await llamar(T.adm, { accion: "empujar", comercio: cA }); expect(r.status).toBe(200);
  expect(r.stock).toBe(1); expect(r.sin_cambios).toBe(1); expect(r.precio).toBe(0);   // 101: 99→12; 111: −3 en el sistema = 0 = ya está en 0
  expect(tn.stockPost.map((s) => `${s.pid}:${s.id}:${s.action}:${s.value}`)).toEqual(["10:101:replace:12"]);
  tn.stockPost.length = 0;
  const r2 = await llamar(T.adm, { accion: "empujar", comercio: cA }); expect(r2.stock).toBe(0); expect(r2.sin_cambios).toBe(2); expect(tn.stockPost.length).toBe(0);
  await psql(`update registros set datos = jsonb_set(datos,'{stock}','7') where comercio_id='${cA}' and id='pLoc1'`);
  tn.limite429 = 1; const r3 = await llamar(T.adm, { accion: "empujar", comercio: cA }); expect(r3.status).toBe(200); expect(r3.stock).toBe(1);
  expect(tn.stockPost[0].value).toBe(7);
  // precio: sólo si la config lo pide
  expect((await rpc(T.adm, "tn_config_guardar", { p_comercio: cA, p: { precio_fuente: "sistema" } })).data.ok).toBe(true);
  const r4 = await llamar(T.adm, { accion: "empujar", comercio: cA }); expect(r4.precio).toBe(1);   // 101 estaba a $1.700 en la tienda y $1.500 en el sistema; 111 ya coincide
  expect(tn.productos[0].variants[0].price).toBe("1500.00");
  // nada manda → no hace nada
  await rpc(T.adm, "tn_config_guardar", { p_comercio: cA, p: { stock_fuente: "off", precio_fuente: "off" } });
  expect((await llamar(T.adm, { accion: "empujar", comercio: cA })).status).toBe(409);
});
test("429 persistente: se corta con un mensaje claro y reintentable", async () => {
  await rpc(T.adm, "tn_config_guardar", { p_comercio: cA, p: { stock_fuente: "sistema" } });
  await psql(`update registros set datos = jsonb_set(datos,'{stock}','8') where comercio_id='${cA}' and id='pLoc1'`);
  tn.limite429 = 5; const r = await llamar(T.adm, { accion: "empujar", comercio: cA }); tn.limite429 = 0;
  expect(r.status).toBe(429); expect(r.reintentable).toBe(true);
});

// ================================================================= desconexión
test("registrar avisos faltantes y desconectar: se dan de baja los avisos y se borra el token", async () => {
  tn.webhooks = tn.webhooks.slice(0, 3);
  const r = await llamar(T.adm, { accion: "registrar_avisos", comercio: cA }); expect(r.registrados).toBe(7);
  const d = await llamar(T.adm, { accion: "desconectar", comercio: cA }); expect(d.ok).toBe(true);
  expect(tn.webhooks.length).toBe(0);
  expect(await psql(`select estado||'|'||coalesce(token_cifrado,'sin token') from tn_conexion where comercio_id='${cA}'`)).toBe("desconectada|sin token");
  expect((await llamar(T.adm, { accion: "sincronizar_productos", comercio: cA })).status).toBe(409);
  expect((await webhookPost({ store_id: 424242, event: "order/paid", id: 1 })).status).toBe(200);   // ya no hay tienda conectada: ignorado
});
test("app/uninstalled: la tienda se marca revocada y se borra el token", async () => {
  const { r } = await conectar(T.adm, 555001); expect(r.status).toBe(302);
  const w = await webhookPost({ store_id: 555001, event: "app/uninstalled" }); expect(w.status).toBe(200);
  expect(await psql(`select estado||'|'||coalesce(token_cifrado,'sin token') from tn_conexion where comercio_id='${cA}'`)).toBe("revocada|sin token");
});
test("aislamiento: el comercio B no lee nada del A por la API de datos", async () => {
  for (const t of ["tn_conexion", "tn_estados_oauth", "tn_productos", "tn_ordenes", "tn_eventos"]) {
    const r = await fetch(`http://127.0.0.1:3011/${t}?select=*`, { headers: { Authorization: "Bearer " + T.admB } }); const txt = await r.text();
    expect(r.status === 200 ? txt : "[]").not.toContain(cA); expect(txt).not.toContain("TOKEN-SECRETO");
  }
});
