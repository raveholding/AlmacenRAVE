// ===== handler.ts =====
// SISTEMA VB · Edge Function "api" — REST de Proveedores y Compras.
//   GET  /api/proveedores                 listado con filtros, orden, paginación y estado de cuenta
//   POST /api/proveedores                 alta / edición (con "id" edita)
//   GET  /api/proveedores/{id}/cuenta     estado de cuenta (libro mayor)
//   GET  /api/compras/ordenes             órdenes de compra (filtros estado y proveedor_id)
//   POST /api/compras/orden               crea (o edita un Borrador con "id") una orden de compra
//   POST /api/compras/orden/{id}/estado   {"estado":"Solicitada"|"Cancelada"}
//   POST /api/compras/recepcion           ingreso de mercadería ATÓMICO (stock + costo + deuda/caja)
//   POST /api/compras/pago                pago a proveedor
//   POST /api/compras/nota-credito        nota de crédito del proveedor
// Seguridad: esta función NO tiene permisos propios sobre los datos. Reenvía el JWT del usuario a la base y cada función SQL
// valida comercio, rol (admin/supervisor), importes y existencia de cada dato. Los totales los calcula la base, no el cliente.
// Comercio: cabecera X-Tenant-Id (o ?tenant= / "tenant" en el cuerpo). Idempotencia: cabecera Idempotency-Key (o "idempotency_key").
interface Entorno { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; ALLOWED_ORIGINS?: string }
type F = typeof fetch;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function manejar(req: Request, env: Entorno, f: F = fetch): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const resp = (status: number, o: unknown) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  const err = (status: number, mensaje: string, codigo = "error") => resp(status, { ok: false, error: { codigo, mensaje } });

  const url = new URL(req.url);
  const i = url.pathname.indexOf("/api/");
  const ruta = (i >= 0 ? url.pathname.slice(i + 5) : url.pathname).replace(/^\/+|\/+$/g, "");
  const seg = ruta.split("/");
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth)) return err(401, "Falta iniciar sesión", "no_autenticado");

  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      const txt = await req.text();
      if (txt.length > 400_000) return err(413, "Pedido demasiado grande", "demasiado_grande");
      body = txt ? JSON.parse(txt) : {};
      if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error("no es objeto");
    } catch (_e) { return err(400, "El cuerpo debe ser un JSON válido (objeto)", "json_invalido"); }
  } else if (req.method !== "GET") return err(405, "Método no permitido", "metodo");

  const tenant = String(req.headers.get("x-tenant-id") ?? url.searchParams.get("tenant") ?? body.tenant ?? "");
  if (!UUID.test(tenant)) return err(400, "Falta el comercio: mandá la cabecera X-Tenant-Id con su identificador", "tenant_invalido");
  const idem = req.headers.get("idempotency-key");
  if (idem && body.idempotency_key === undefined) body.idempotency_key = idem;
  delete body.tenant;

  const q = url.searchParams;
  const num = (k: string) => (q.get(k) === null || q.get(k) === "" ? null : Number(q.get(k)));
  const uuidQ = (k: string) => (q.get(k) && UUID.test(String(q.get(k))) ? q.get(k) : null);

  // tabla de rutas → función SQL
  let fn = "", args: Record<string, unknown> = {}, okStatus = 200, creaRecurso = false;
  const m = req.method;
  if (m === "GET" && ruta === "proveedores") {
    fn = "proveedores_listar";
    args = { p_comercio: tenant, p_q: q.get("q"), p_estado: q.get("estado"), p_orden: q.get("orden") ?? "razon_social", p_dir: q.get("dir") ?? "asc", p_limite: num("limite") ?? 50, p_desde: num("desde") ?? 0 };
  } else if (m === "POST" && ruta === "proveedores") {
    fn = "proveedor_guardar"; args = { p_comercio: tenant, p: body }; creaRecurso = !body.id;
  } else if (m === "GET" && seg[0] === "proveedores" && seg.length === 3 && seg[2] === "cuenta" && UUID.test(seg[1])) {
    fn = "cuenta_proveedor"; args = { p_comercio: tenant, p_proveedor: seg[1], p_limite: num("limite") ?? 200 };
  } else if (m === "GET" && ruta === "compras/ordenes") {
    fn = "ordenes_listar"; args = { p_comercio: tenant, p_estado: q.get("estado"), p_proveedor: uuidQ("proveedor_id"), p_limite: num("limite") ?? 100 };
  } else if (m === "POST" && ruta === "compras/orden") {
    fn = "orden_compra_guardar"; args = { p_comercio: tenant, p: body }; creaRecurso = !body.id;
  } else if (m === "POST" && seg[0] === "compras" && seg[1] === "orden" && seg.length === 4 && seg[3] === "estado" && UUID.test(seg[2])) {
    fn = "orden_compra_estado"; args = { p_comercio: tenant, p_orden: seg[2], p_estado: String(body.estado ?? "") };
  } else if (m === "POST" && ruta === "compras/recepcion") {
    fn = "procesar_recepcion"; args = { p_comercio: tenant, p: body }; creaRecurso = true;
  } else if (m === "POST" && ruta === "compras/pago") {
    fn = "proveedor_pago_registrar"; args = { p_comercio: tenant, p: body }; creaRecurso = true;
  } else if (m === "POST" && ruta === "compras/nota-credito") {
    fn = "proveedor_nota_credito"; args = { p_comercio: tenant, p: body }; creaRecurso = true;
  } else return err(404, "Ruta inexistente", "no_encontrado");

  let r: Response;
  try {
    r = await f(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  } catch (_e) { return err(503, "No se pudo comunicar con la base de datos. Probá de nuevo.", "sin_conexion"); }
  const txt = await r.text();
  let j: unknown = null; try { j = txt ? JSON.parse(txt) : null; } catch (_e) { /* texto plano */ }
  if (!r.ok) {
    const e = (j ?? {}) as { code?: string; message?: string };
    const msg = String(e.message ?? "Error").slice(0, 300);
    if (r.status === 401 || e.code === "PGRST301" || e.code === "PGRST303") return err(401, "Sesión inválida o vencida: volvé a ingresar", "no_autenticado");
    if (e.code === "42501" || r.status === 403) return err(403, msg.includes("rol") || msg.includes("miembro") ? msg : "No tenés permiso para esto", "sin_permiso");
    if (e.code === "P0001" || e.code === "23505" || e.code === "23514" || e.code === "22P02" || e.code === "22007") return err(422, msg, "datos_invalidos");
    console.error("api: error de base:", fn, r.status, String(e.code ?? ""));
    return err(500, "Error interno. Probá de nuevo; si sigue, avisá a Vincular Business.", "interno");
  }
  const repetido = !!(j && typeof j === "object" && (j as { repetido?: boolean }).repetido === true);
  okStatus = creaRecurso && !repetido ? 201 : 200;
  return resp(okStatus, { ok: true, data: j });
}

function corsHeaders(req: Request, env: Entorno): Record<string, string> {
  const permitidos = (env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") ?? "";
  const ok = permitidos.includes("*") ? "*" : permitidos.includes(origin) ? origin : permitidos[0] ?? "";
  return { "Access-Control-Allow-Origin": ok, "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-tenant-id, idempotency-key", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin" };
}

// ===== index.ts =====
// Punto de entrada de la Edge Function "api" (Supabase / Deno): REST de Proveedores y Compras.
// Usa sólo variables que Supabase ya trae (SUPABASE_URL, SUPABASE_ANON_KEY). No necesita ningún secreto propio:
// reenvía el JWT del usuario y la base decide qué puede hacer. Opcional: ALLOWED_ORIGINS (ej. https://raveholding.github.io).

Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = { SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", ALLOWED_ORIGINS: e("ALLOWED_ORIGINS") };
  return manejar(req, env);
});
