import forge from "npm:node-forge@1.3.1";
import { XMLParser } from "npm:fast-xml-parser@4.5.0";
// ===== core.ts =====
namespace core {
// SISTEMA RAVE · Facturación electrónica ARCA — lógica pura (sin red, sin base de datos).
// La usan index.ts (producción) y los tests. Nada de acá toca secretos: reciben y devuelven valores.
//
// Servicios de ARCA que usa: WSAA (autenticación) y WSFEv1 (factura electrónica, mercado interno).
// Todo lo que depende de documentos de ARCA y no pudo comprobarse acá va marcado [VERIFICAR].

// ---------------------------------------------------------------- URLs
// [VERIFICAR] Direcciones públicas de ARCA (ex AFIP). Se pueden pisar con variables de entorno
// (ARCA_WSAA_URL_HOMO, ARCA_WSAA_URL_PROD, ARCA_WSFE_URL_HOMO, ARCA_WSFE_URL_PROD) si cambian.
export const URLS_DEFECTO = {
  homologacion: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  },
  produccion: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  },
} as const;
// [VERIFICAR] formato y dirección del QR fiscal (RG 4892): se confirma en la documentación de ARCA.
export const QR_BASE_DEFECTO = "https://www.afip.gob.ar/fe/qr/?p=";
export const WSFE_NS = "http://ar.gov.afip.dif.FEV1/";

// ---------------------------------------------------------------- CUIT
export function cuitOk(c: string): boolean {
  const d = String(c ?? "").replace(/\D/g, "");
  if (d.length !== 11 || !/^(20|23|24|25|26|27|30|33|34)/.test(d)) return false;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let s = 0;
  for (let i = 0; i < 10; i++) s += Number(d[i]) * w[i];
  const r = 11 - (s % 11);
  const v = r === 11 ? 0 : r === 10 ? 9 : r;
  return v === Number(d[10]);
}

// ---------------------------------------------------------------- Cifrado de lo que se guarda (AES-256-GCM)
export async function importarLlaveMaestra(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("ARCA_MASTER_KEY debe ser de 32 bytes en base64");
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function sellar(k: CryptoKey, texto: string, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) }, k, new TextEncoder().encode(texto)));
  return "v1." + b64(iv) + "." + b64(ct);
}
export async function abrir(k: CryptoKey, sobre: string, aad: string): Promise<string> {
  const [v, iv, ct] = sobre.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("formato de sobre inválido");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv), additionalData: new TextEncoder().encode(aad) }, k, unb64(ct));
  return new TextDecoder().decode(pt);
}

// ---------------------------------------------------------------- Clave + CSR
export interface ParCSR { keyPem: string; csrPem: string }
export function generarCSR(o: { cuit: string; razon: string; alias: string }): ParCSR {
  if (!cuitOk(o.cuit)) throw new Error("CUIT inválido");
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(o.alias)) throw new Error("alias inválido (sin espacios)");
  // ASCII simple: sin tildes ni signos que rompan el nombre distinguido del CSR
  const razon = o.razon.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 .&()'-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
  if (razon.length < 2) throw new Error("razón social inválida");
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([
    { name: "countryName", value: "AR" },
    { name: "organizationName", value: razon },
    { name: "commonName", value: o.alias },
    { name: "serialNumber", value: "CUIT " + o.cuit.replace(/\D/g, "") },
  ]);
  csr.sign(keys.privateKey, forge.md.sha256.create());
  if (!csr.verify()) throw new Error("no se pudo firmar el CSR");
  return { keyPem: forge.pki.privateKeyToPem(keys.privateKey), csrPem: forge.pki.certificationRequestToPem(csr) };
}

export interface InfoCert { ok: boolean; error?: string; vence?: string; desde?: string; sujeto?: string }
/** El .crt de ARCA tiene que corresponder a LA clave del sistema, estar vigente y no ser otra cosa. */
export function verificarCert(certPem: string, keyPem: string, ahora = new Date()): InfoCert {
  let cert: forge.pki.Certificate;
  try {
    if (!/-----BEGIN CERTIFICATE-----/.test(certPem)) return { ok: false, error: "No parece un certificado .crt (PEM)." };
    cert = forge.pki.certificateFromPem(certPem);
  } catch (_e) {
    return { ok: false, error: "No se pudo leer el certificado." };
  }
  let priv: forge.pki.rsa.PrivateKey;
  try { priv = forge.pki.privateKeyFromPem(keyPem) as forge.pki.rsa.PrivateKey; } catch (_e) { return { ok: false, error: "La clave privada del sistema no se pudo leer." }; }
  const pub = cert.publicKey as forge.pki.rsa.PublicKey;
  if (!pub.n || pub.n.compareTo(priv.n) !== 0 || pub.e.compareTo(priv.e) !== 0) {
    return { ok: false, error: "Este certificado NO corresponde a la clave generada en el sistema (¿lo pediste con otro CSR?)." };
  }
  const vence = cert.validity.notAfter, desde = cert.validity.notBefore;
  if (vence.getTime() < ahora.getTime()) return { ok: false, error: "El certificado está vencido.", vence: vence.toISOString() };
  if (desde.getTime() > ahora.getTime() + 5 * 60_000) return { ok: false, error: "El certificado todavía no es válido.", desde: desde.toISOString() };
  const cn = cert.subject.getField("CN");
  return { ok: true, vence: vence.toISOString(), desde: desde.toISOString(), sujeto: cn ? String(cn.value) : "" };
}

// ---------------------------------------------------------------- WSAA
const fmtAR = (d: Date) => {
  // ISO con offset -03:00 (Argentina no tiene horario de verano)
  const t = new Date(d.getTime() - 3 * 3600_000);
  return t.toISOString().replace("Z", "").replace(/\.\d+$/, "") + "-03:00";
};
export function armarTRA(servicio: string, ahora = new Date(), id = Math.floor(ahora.getTime() / 1000)): string {
  const gen = new Date(ahora.getTime() - 10 * 60_000), exp = new Date(ahora.getTime() + 10 * 60_000);
  return `<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header><uniqueId>${id}</uniqueId><generationTime>${fmtAR(gen)}</generationTime><expirationTime>${fmtAR(exp)}</expirationTime></header><service>${servicio}</service></loginTicketRequest>`;
}
/** CMS (PKCS#7 SignedData, SHA-256, contenido incluido) en base64, como pide LoginCms. */
export function firmarCMS(tra: string, certPem: string, keyPem: string): string {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, "utf8");
  const cert = forge.pki.certificateFromPem(certPem);
  p7.addCertificate(cert);
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(keyPem),
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}
export function soapWsaa(cmsB64: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cmsB64}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
}

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, trimValues: true });
export const parseXml = (x: string) => parser.parse(x);
const arr = <T>(v: T | T[] | undefined): T[] => v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];

export interface TA { token: string; sign: string; vence: string }
export function parseWsaa(xml: string): TA {
  const j = parseXml(xml);
  const body = j?.Envelope?.Body;
  if (body?.Fault) throw new ErrorArca("WSAA: " + String(body.Fault.faultstring ?? "error").slice(0, 200), "wsaa");
  const inner = body?.loginCmsResponse?.loginCmsReturn;
  if (!inner) throw new ErrorArca("WSAA: respuesta inesperada", "wsaa");
  const t = parseXml(String(inner)); // el ticket viene como XML escapado dentro de la respuesta
  const cred = t?.loginTicketResponse?.credentials;
  const exp = t?.loginTicketResponse?.header?.expirationTime;
  if (!cred?.token || !cred?.sign || !exp) throw new ErrorArca("WSAA: ticket incompleto", "wsaa");
  return { token: String(cred.token), sign: String(cred.sign), vence: new Date(String(exp)).toISOString() };
}

export class ErrorArca extends Error {
  constructor(msg: string, public etapa: string, public reintentable = false, public codigo?: string) { super(msg); }
}

// ---------------------------------------------------------------- Comprobantes
export const TIPOS = { FA: 1, NDA: 2, NCA: 3, FB: 6, NDB: 7, NCB: 8, FC: 11, NDC: 12, NCC: 13 } as const;
export const ALIC_ID: Record<string, number> = { "0": 3, "10.5": 4, "21": 5, "27": 6, "5": 8, "2.5": 9 };
const COND_RECEPTOR_A = new Set([1, 6, 13, 16]); // RI, Monotributo, Monotributo Social, Monotributista Trabajador Independiente Promovido

export type CondEmisor = "RI" | "MONO" | "EXENTO";
export interface Receptor { docTipo: number; docNro: string; condIva: number; nombre?: string }
export function receptorFinal(): Receptor { return { docTipo: 99, docNro: "0", condIva: 5, nombre: "Consumidor final" }; }

export function validarReceptor(r: Receptor): string | null {
  if (![80, 86, 96, 99].includes(r.docTipo)) return "Tipo de documento del receptor no soportado (CUIT 80, CUIL 86, DNI 96, consumidor final 99).";
  const n = String(r.docNro ?? "").replace(/\D/g, "");
  if (r.docTipo === 99) { if (n !== "0" && n !== "") return "Consumidor final sin identificar: documento 0."; return null; }
  if ((r.docTipo === 80 || r.docTipo === 86) && !cuitOk(n)) return "El CUIT/CUIL del receptor no es válido.";
  if (r.docTipo === 96 && !/^\d{6,9}$/.test(n)) return "El DNI del receptor no es válido.";
  if (!Number.isInteger(r.condIva) || r.condIva < 1 || r.condIva > 20) return "Falta la condición frente al IVA del receptor.";
  return null;
}

/** Tipo de comprobante según quién emite y a quién. */
export function elegirTipo(emisor: CondEmisor, r: Receptor, nota: "factura" | "nc" | "nd" = "factura"): number {
  if (emisor === "EXENTO") throw new ErrorArca("Emisor IVA Exento: todavía no soportado en esta versión (consultá con tu contador qué comprobante corresponde) [VERIFICAR].", "datos");
  let base: "A" | "B" | "C";
  if (emisor === "MONO") base = "C";
  else base = COND_RECEPTOR_A.has(r.condIva) ? "A" : "B";
  const m = { A: [1, 2, 3], B: [6, 7, 8], C: [11, 12, 13] }[base];
  return nota === "factura" ? m[0] : nota === "nd" ? m[1] : m[2];
}
export const letraDe = (tipo: number) => ([1, 2, 3].includes(tipo) ? "A" : [6, 7, 8].includes(tipo) ? "B" : "C");
export const esNC = (tipo: number) => [3, 8, 13].includes(tipo);

export interface Item { qty: number; price: number; disc?: number; iva?: number }
export interface Importes {
  total: number; neto: number; iva: number; opEx: number;
  ivaDet: { id: number; base: number; importe: number; alic: number }[];
}
/** Todo en centavos enteros. Los precios de góndola ya incluyen IVA: se discrimina sin perder un centavo. */
export function calcularImportes(items: Item[], emisor: CondEmisor, alicDefecto: number): Importes {
  if (!items.length) throw new ErrorArca("La venta no tiene ítems.", "datos");
  const grupos = new Map<string, number>();
  let total = 0;
  for (const it of items) {
    const qty = Number(it.qty), price = Number(it.price), disc = Math.round(Number(it.disc ?? 0));
    if (!(qty > 0) || !Number.isFinite(qty) || !Number.isInteger(price) || price <= 0 || disc < 0) throw new ErrorArca("Ítem inválido (cantidad/precio).", "datos");
    const linea = Math.round(qty * price) - disc;
    if (linea <= 0) throw new ErrorArca("Ítem con importe cero o negativo.", "datos");
    total += linea;
    const a = String(it.iva ?? alicDefecto);
    if (!(a in ALIC_ID)) throw new ErrorArca("Alícuota de IVA no soportada: " + a, "datos");
    grupos.set(a, (grupos.get(a) ?? 0) + linea);
  }
  if (emisor === "MONO" || emisor === "EXENTO") {
    return { total, neto: total, iva: 0, opEx: 0, ivaDet: [] }; // Factura C: no se discrimina IVA
  }
  const ivaDet: Importes["ivaDet"] = [];
  let neto = 0, iva = 0;
  for (const [a, bruto] of [...grupos.entries()].sort((x, y) => Number(x[0]) - Number(y[0]))) {
    const alic = Number(a);
    const n = Math.round(bruto / (1 + alic / 100));
    const i = bruto - n; // el IVA es la diferencia: neto + IVA = bruto exacto
    ivaDet.push({ id: ALIC_ID[a], base: n, importe: i, alic });
    neto += n; iva += i;
  }
  return { total, neto, iva, opEx: 0, ivaDet };
}

const imp = (c: number) => (c / 100).toFixed(2);
const esc = (s: string) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
export const yyyymmdd = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
export const fechaAR = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

export interface Auth { token: string; sign: string; cuit: string }
const authXml = (a: Auth) => `<Auth><Token>${esc(a.token)}</Token><Sign>${esc(a.sign)}</Sign><Cuit>${esc(a.cuit)}</Cuit></Auth>`;
const sobre = (cuerpo: string) => `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${cuerpo}</soap:Body></soap:Envelope>`;
export const soapAction = (op: string) => `"${WSFE_NS}${op}"`;

export const xmlDummy = () => sobre(`<FEDummy xmlns="${WSFE_NS}"/>`);
export const xmlUltimo = (a: Auth, pto: number, tipo: number) =>
  sobre(`<FECompUltimoAutorizado xmlns="${WSFE_NS}">${authXml(a)}<PtoVta>${pto}</PtoVta><CbteTipo>${tipo}</CbteTipo></FECompUltimoAutorizado>`);
export const xmlConsultar = (a: Auth, pto: number, tipo: number, nro: number) =>
  sobre(`<FECompConsultar xmlns="${WSFE_NS}">${authXml(a)}<FeCompConsReq><CbteTipo>${tipo}</CbteTipo><CbteNro>${nro}</CbteNro><PtoVta>${pto}</PtoVta></FeCompConsReq></FECompConsultar>`);
export const xmlCondIvaReceptor = (a: Auth) =>
  sobre(`<FEParamGetCondicionIvaReceptor xmlns="${WSFE_NS}">${authXml(a)}</FEParamGetCondicionIvaReceptor>`);

export interface SolicitudCAE {
  pto: number; tipo: number; numero: number; fecha: string /* yyyymmdd */;
  receptor: Receptor; importes: Importes;
  asociado?: { tipo: number; pto: number; nro: number; cuit?: string; fecha?: string };
}
/** [VERIFICAR contra el WSDL de homologación] el orden de los elementos de FECAEDetRequest. */
export function xmlSolicitar(a: Auth, s: SolicitudCAE): string {
  const r = s.receptor, im = s.importes;
  const docNro = r.docTipo === 99 ? "0" : String(r.docNro).replace(/\D/g, "");
  let det = `<Concepto>1</Concepto><DocTipo>${r.docTipo}</DocTipo><DocNro>${docNro}</DocNro><CbteDesde>${s.numero}</CbteDesde><CbteHasta>${s.numero}</CbteHasta><CbteFch>${s.fecha}</CbteFch>` +
    `<ImpTotal>${imp(im.total)}</ImpTotal><ImpTotConc>0.00</ImpTotConc><ImpNeto>${imp(im.neto)}</ImpNeto><ImpOpEx>${imp(im.opEx)}</ImpOpEx><ImpTrib>0.00</ImpTrib><ImpIVA>${imp(im.iva)}</ImpIVA>` +
    `<MonId>PES</MonId><MonCotiz>1</MonCotiz><CondicionIVAReceptorId>${r.condIva}</CondicionIVAReceptorId>`;
  if (s.asociado) {
    const c = s.asociado;
    det += `<CbtesAsoc><CbteAsoc><Tipo>${c.tipo}</Tipo><PtoVta>${c.pto}</PtoVta><Nro>${c.nro}</Nro>${c.cuit ? `<Cuit>${esc(c.cuit)}</Cuit>` : ""}${c.fecha ? `<CbteFch>${c.fecha}</CbteFch>` : ""}</CbteAsoc></CbtesAsoc>`;
  }
  if (im.ivaDet.length) {
    det += `<Iva>${im.ivaDet.map((x) => `<AlicIva><Id>${x.id}</Id><BaseImp>${imp(x.base)}</BaseImp><Importe>${imp(x.importe)}</Importe></AlicIva>`).join("")}</Iva>`;
  }
  return sobre(`<FECAESolicitar xmlns="${WSFE_NS}">${authXml(a)}<FeCAEReq><FeCabReq><CantReg>1</CantReg><PtoVta>${s.pto}</PtoVta><CbteTipo>${s.tipo}</CbteTipo></FeCabReq><FeDetReq><FECAEDetRequest>${det}</FECAEDetRequest></FeDetReq></FeCAEReq></FECAESolicitar>`);
}

// ---------------------------------------------------------------- Respuestas
export interface Msg { code: string; msg: string }
const msgs = (n: unknown, k: string): Msg[] => arr<Record<string, unknown>>(n as never).map((x) => ({ code: String(x?.Code ?? ""), msg: String(x?.Msg ?? "") }));
function cuerpoWsfe(xml: string, op: string): Record<string, unknown> {
  const j = parseXml(xml);
  const body = j?.Envelope?.Body;
  if (body?.Fault) throw new ErrorArca("WSFE: " + String(body.Fault.faultstring ?? "error").slice(0, 200), "wsfe", true);
  const r = body?.[op + "Response"]?.[op + "Result"];
  if (r === undefined) throw new ErrorArca("WSFE: respuesta inesperada (" + op + ")", "wsfe", true);
  return r as Record<string, unknown>;
}
export function erroresTop(r: Record<string, unknown>): Msg[] { return msgs(arr((r as never as { Errors?: { Err?: unknown } }).Errors?.Err), "Err"); }
export function parseDummy(xml: string) {
  const r = cuerpoWsfe(xml, "FEDummy") as Record<string, string>;
  return { app: r.AppServer, db: r.DbServer, auth: r.AuthServer, ok: r.AppServer === "OK" && r.DbServer === "OK" && r.AuthServer === "OK" };
}
export function parseUltimo(xml: string): number {
  const r = cuerpoWsfe(xml, "FECompUltimoAutorizado") as Record<string, unknown>;
  const e = erroresTop(r);
  if (e.length) throw new ErrorArca("ARCA: " + e.map((x) => `${x.code} ${x.msg}`).join(" · "), "wsfe", false, e[0].code);
  const n = Number(r.CbteNro);
  if (!Number.isInteger(n) || n < 0) throw new ErrorArca("ARCA: número de comprobante inválido", "wsfe", true);
  return n;
}
export interface ResultadoCAE {
  resultado: "A" | "R" | "P" | "";
  cae?: string; caeVto?: string; numero?: number; observaciones: Msg[]; errores: Msg[]; reproceso?: string;
}
export function parseSolicitar(xml: string): ResultadoCAE {
  const r = cuerpoWsfe(xml, "FECAESolicitar") as Record<string, unknown>;
  const errores = erroresTop(r);
  const cab = (r.FeCabResp ?? {}) as Record<string, string>;
  const det = arr<Record<string, unknown>>((r.FeDetResp as { FECAEDetResponse?: unknown } | undefined)?.FECAEDetResponse as never)[0] ?? {};
  const obs = msgs(arr((det as { Observaciones?: { Obs?: unknown } }).Observaciones?.Obs), "Obs");
  const res = String(det.Resultado ?? cab.Resultado ?? "") as ResultadoCAE["resultado"];
  const cae = det.CAE ? String(det.CAE) : undefined;
  const vto = det.CAEFchVto ? String(det.CAEFchVto) : undefined;
  return {
    resultado: res, cae: cae && /^\d{14}$/.test(cae) ? cae : undefined,
    caeVto: vto && /^\d{8}$/.test(vto) ? `${vto.slice(0, 4)}-${vto.slice(4, 6)}-${vto.slice(6, 8)}` : undefined,
    numero: det.CbteDesde ? Number(det.CbteDesde) : undefined, observaciones: obs, errores, reproceso: cab.Reproceso,
  };
}
export interface Consultado { existe: boolean; cae?: string; caeVto?: string; total?: number; docNro?: string; fecha?: string; resultado?: string }
export function parseConsultar(xml: string): Consultado {
  const r = cuerpoWsfe(xml, "FECompConsultar") as Record<string, unknown>;
  const g = (r.ResultGet ?? null) as Record<string, string> | null;
  if (!g) return { existe: false };
  const vto = g.CAEFchVto ?? g.FchVto;
  return {
    existe: true, cae: g.CodAutorizacion, caeVto: vto && /^\d{8}$/.test(vto) ? `${vto.slice(0, 4)}-${vto.slice(4, 6)}-${vto.slice(6, 8)}` : undefined,
    total: g.ImpTotal !== undefined ? Math.round(Number(g.ImpTotal) * 100) : undefined, docNro: g.DocNro, fecha: g.CbteFch, resultado: g.Resultado,
  };
}
export function parseCondIvaReceptor(xml: string): { id: number; desc: string }[] {
  const r = cuerpoWsfe(xml, "FEParamGetCondicionIvaReceptor") as Record<string, unknown>;
  return arr<Record<string, unknown>>((r.ResultGet as { CondicionIvaReceptor?: unknown } | undefined)?.CondicionIvaReceptor as never)
    .map((x) => ({ id: Number(x.Id), desc: String(x.Desc ?? "") }));
}

// ---------------------------------------------------------------- QR fiscal (RG 4892) [VERIFICAR formato]
export function datosQR(o: { fecha: string; cuit: string; pto: number; tipo: number; nro: number; total: number; receptor: Receptor; cae: string }) {
  return {
    ver: 1, fecha: o.fecha, cuit: Number(o.cuit), ptoVta: o.pto, tipoCmp: o.tipo, nroCmp: o.nro,
    importe: Number((o.total / 100).toFixed(2)), moneda: "PES", ctz: 1, tipoDocRec: o.receptor.docTipo,
    nroDocRec: Number(String(o.receptor.docNro).replace(/\D/g, "") || 0), tipoCodAut: "E", codAut: Number(o.cae),
  };
}
export function urlQR(d: ReturnType<typeof datosQR>, base = QR_BASE_DEFECTO): string {
  return base + btoa(JSON.stringify(d));
}

// ---------------------------------------------------------------- Mensajes entendibles para el comerciante
export function mensajeHumano(res: ResultadoCAE): string {
  const todos = [...res.errores, ...res.observaciones];
  if (!todos.length) return res.resultado === "R" ? "ARCA rechazó el comprobante sin dar motivo." : "";
  return todos.map((m) => `${m.code ? m.code + ": " : ""}${m.msg}`).join(" · ").slice(0, 400);
}

}
const ErrorArca = core.ErrorArca;
type ErrorArca = core.ErrorArca;
// ===== handler.ts =====
// SISTEMA RAVE · Edge Function "arca" — manejador HTTP (inyectable: el test le pasa un fetch falso de ARCA).
// Seguridad:
//  · El JWT del usuario se reenvía a la base (rpc arca_quien): la base lo valida y dice a qué comercio y rol pertenece.
//  · La clave privada y el ticket de ARCA se guardan CIFRADOS (AES-GCM con ARCA_MASTER_KEY, un secreto de esta función).
//  · Los importes se recalculan acá desde la venta guardada en el servidor: el navegador no manda totales.
//  · El navegador nunca habla con ARCA; nunca recibe la clave privada ni el ticket.

interface Entorno {
  SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string;
  ARCA_MASTER_KEY?: string; ALLOWED_ORIGINS?: string;
  ARCA_WSAA_URL_HOMO?: string; ARCA_WSAA_URL_PROD?: string; ARCA_WSFE_URL_HOMO?: string; ARCA_WSFE_URL_PROD?: string;
  ARCA_QR_BASE?: string;
}
type F = typeof fetch;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AMBIENTES = ["homologacion", "produccion"];

interface Cfg { comercio_id: string; ambiente: string; cuit: string; razon_social: string; cond_iva: core.CondEmisor; pto_vta: number; alias: string; alicuota: number; activo: boolean }
interface Cbte {
  id: string; comercio_id: string; ambiente: string; venta_id: string; pto_vta: number; tipo: number; numero: number | null; estado: string;
  cae: string | null; cae_vto: string | null; fecha_cbte: string | null; imp_total: number; imp_neto: number; imp_iva: number;
  receptor: core.Receptor | null; asociado: { tipo: number; pto: number; nro: number; cuit?: string; fecha?: string } | null; intentos: number; error: string | null;
}

async function manejar(req: Request, env: Entorno, f: F = fetch, ahora: () => Date = () => new Date()): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const resp = (status: number, o: unknown) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  if (req.method !== "POST") return resp(405, { error: "Método no permitido" });

  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth)) return resp(401, { error: "Falta iniciar sesión" });
  let body: Record<string, unknown>;
  try {
    const txt = await req.text();
    if (txt.length > 40_000) return resp(413, { error: "Pedido demasiado grande" });
    body = JSON.parse(txt);
  } catch (_e) { return resp(400, { error: "Pedido inválido" }); }

  const comercio = String(body.comercio ?? ""), ambiente = String(body.ambiente ?? "homologacion"), accion = String(body.accion ?? "");
  if (!UUID.test(comercio) || !AMBIENTES.includes(ambiente)) return resp(400, { error: "Datos inválidos" });

  const db = baseDatos(env, f);
  try {
    let q: { uid?: string; rol?: string } | null = null;
    try { q = await db.rpc("arca_quien", { p_comercio: comercio }, auth); }
    catch (_e) { return resp(401, { error: "Sesión inválida o vencida: volvé a ingresar" }); }
    if (!q || !q.rol) return resp(403, { error: "No sos parte de este comercio" });
    const rol = String(q.rol), uid = String(q.uid);
    const ctx = new Contexto(env, f, db, comercio, ambiente, ahora);
    const todos = ["admin", "supervisor", "mostrador"];
    const permiso = (roles: string[]) => roles.includes(rol);
    switch (accion) {
      case "estado": if (!permiso(todos)) break; return resp(200, await ctx.estado());
      case "generar_csr": if (!permiso(["admin"])) break; return resp(200, await ctx.generarCsr(body.forzar === true));
      case "cargar_cert": if (!permiso(["admin"])) break; return resp(200, await ctx.cargarCert(String(body.cert ?? "")));
      case "probar": if (!permiso(["admin"])) break; return resp(200, await ctx.probar());
      case "emitir": if (!permiso(todos)) break; return resp(200, await ctx.emitir(String(body.venta_id ?? ""), body.receptor as core.Receptor | undefined, uid));
      case "nota_credito": if (!permiso(["admin"])) break; return resp(200, await ctx.notaCredito(String(body.venta_id ?? ""), uid));
      case "reintentar": if (!permiso(todos)) break; return resp(200, await ctx.reintentar(uid));
      default: return resp(400, { error: "Acción desconocida" });
    }
    return resp(403, { error: "Tu rol no puede hacer esto" });
  } catch (e) {
    if (e instanceof ErrorArca) return resp(e.etapa === "datos" ? 422 : 502, { error: e.message, etapa: e.etapa, reintentable: e.reintentable });
    console.error("arca: error interno:", e instanceof Error ? e.message.slice(0, 200) : "desconocido");
    return resp(500, { error: "Error interno. Probá de nuevo; si sigue, avisá a Vincular Business." });
  }
}

function corsHeaders(req: Request, env: Entorno): Record<string, string> {
  const permitidos = (env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") ?? "";
  const ok = permitidos.includes("*") ? "*" : permitidos.includes(origin) ? origin : permitidos[0] ?? "";
  return { "Access-Control-Allow-Origin": ok, "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}

// ---------------------------------------------------------------- Base de datos (PostgREST)
function baseDatos(env: Entorno, f: F) {
  const base = env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
  const svc = (extra: Record<string, string> = {}) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json", ...extra });
  async function chk(r: Response, que: string) {
    if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(`db ${que}: ${r.status} ${t.slice(0, 160)}`); }
    return r;
  }
  return {
    /** rpc con el JWT del usuario (auth) o con el rol de servicio (sin auth). */
    async rpc(nombre: string, args: Record<string, unknown>, userJwt?: string) {
      const h = userJwt ? { apikey: env.SUPABASE_ANON_KEY, Authorization: userJwt, "Content-Type": "application/json" } : svc();
      const r = await chk(await f(`${base}/rpc/${nombre}`, { method: "POST", headers: h, body: JSON.stringify(args) }), "rpc " + nombre);
      const t = await r.text();
      return t ? JSON.parse(t) : null;
    },
    async select<T>(tabla: string, query: string): Promise<T[]> {
      const r = await chk(await f(`${base}/${tabla}?${query}`, { headers: svc() }), "select " + tabla);
      return await r.json();
    },
    async upsert(tabla: string, fila: Record<string, unknown>, conflicto: string) {
      await chk(await f(`${base}/${tabla}?on_conflict=${conflicto}`, { method: "POST", headers: svc({ Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify(fila) }), "upsert " + tabla);
    },
    async patch(tabla: string, query: string, fila: Record<string, unknown>) {
      await chk(await f(`${base}/${tabla}?${query}`, { method: "PATCH", headers: svc({ Prefer: "return=minimal" }), body: JSON.stringify(fila) }), "patch " + tabla);
    },
  };
}
type DB = ReturnType<typeof baseDatos>;

// ---------------------------------------------------------------- Lógica por comercio/ambiente
class Contexto {
  llave?: CryptoKey;
  constructor(public env: Entorno, public f: F, public db: DB, public comercio: string, public ambiente: string, public ahora: () => Date) {}

  urls() {
    const h = this.ambiente === "homologacion";
    const d = core.URLS_DEFECTO[this.ambiente as "homologacion" | "produccion"];
    return { wsaa: (h ? this.env.ARCA_WSAA_URL_HOMO : this.env.ARCA_WSAA_URL_PROD) || d.wsaa, wsfe: (h ? this.env.ARCA_WSFE_URL_HOMO : this.env.ARCA_WSFE_URL_PROD) || d.wsfe };
  }
  async master() {
    if (!this.env.ARCA_MASTER_KEY) throw new ErrorArca("Falta cargar el secreto ARCA_MASTER_KEY en la función (lo hace Vincular Business).", "config");
    return this.llave ??= await core.importarLlaveMaestra(this.env.ARCA_MASTER_KEY);
  }
  aad(que: string) { return `${que}|${this.comercio}|${this.ambiente}`; }
  async cfg(): Promise<Cfg | null> {
    const r = await this.db.select<Cfg>("arca_config", `comercio_id=eq.${this.comercio}&ambiente=eq.${this.ambiente}`);
    return r[0] ?? null;
  }
  async cred() {
    const r = await this.db.select<{ key_enc: string | null; csr: string | null; cert: string | null; cert_vence: string | null; ta_enc: string | null; ta_vence: string | null }>(
      "arca_credenciales", `comercio_id=eq.${this.comercio}&ambiente=eq.${this.ambiente}`);
    return r[0] ?? null;
  }
  async guardarCred(parte: Record<string, unknown>) {
    await this.db.upsert("arca_credenciales", { comercio_id: this.comercio, ambiente: this.ambiente, actualizado: this.ahora().toISOString(), ...parte }, "comercio_id,ambiente");
  }

  // ---- transporte SOAP
  async soap(url: string, action: string, xml: string): Promise<string> {
    let r: Response;
    try {
      r = await this.f(url, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: action }, body: xml, signal: AbortSignal.timeout(25_000) });
    } catch (_e) {
      throw new ErrorArca("ARCA no respondió (sin conexión o demora). Se reintenta solo.", "red", true);
    }
    const t = await r.text();
    if (!r.ok && !/Fault/.test(t)) throw new ErrorArca(`ARCA respondió HTTP ${r.status}. Se reintenta solo.`, "red", true);
    return t;
  }

  // ---- ticket de acceso (WSAA)
  async ticket(cfg: Cfg): Promise<core.Auth> {
    const k = await this.master();
    for (let intento = 0; intento < 3; intento++) {
      const c = await this.cred();
      if (!c?.key_enc || !c.cert) throw new ErrorArca("Falta cargar el certificado de ARCA (Administración → Facturación electrónica).", "config");
      if (c.ta_enc && c.ta_vence && new Date(c.ta_vence).getTime() > this.ahora().getTime() + 5 * 60_000) {
        const ta = JSON.parse(await core.abrir(k, c.ta_enc, this.aad("ta"))) as core.TA;
        return { token: ta.token, sign: ta.sign, cuit: cfg.cuit };
      }
      const keyPem = await core.abrir(k, c.key_enc, this.aad("key"));
      const cms = core.firmarCMS(core.armarTRA("wsfe", this.ahora()), c.cert, keyPem);
      const xml = await this.soap(this.urls().wsaa, '""', core.soapWsaa(cms));
      try {
        const ta = core.parseWsaa(xml);
        await this.guardarCred({ ta_enc: await core.sellar(k, JSON.stringify(ta), this.aad("ta")), ta_vence: ta.vence });
        return { token: ta.token, sign: ta.sign, cuit: cfg.cuit };
      } catch (e) {
        // otra solicitud en paralelo ya pidió el ticket: ARCA responde "ya posee un TA válido"; se espera y se lee el guardado
        if (e instanceof ErrorArca && /ya posee un TA/i.test(e.message) && intento < 2) { await new Promise((r) => setTimeout(r, 1500)); continue; }
        if (e instanceof ErrorArca && /ya posee un TA/i.test(e.message)) throw new ErrorArca("ARCA ya entregó un ticket y todavía no está disponible. Se reintenta solo.", "wsaa", true);
        throw e;
      }
    }
    throw new ErrorArca("No se pudo obtener el ticket de ARCA.", "wsaa", true);
  }

  // ---- pantallas de administración
  async estado() {
    const cfg = await this.cfg(); const c = await this.cred();
    return {
      ok: true, ambiente: this.ambiente, config: cfg ? { cuit: cfg.cuit, razon_social: cfg.razon_social, cond_iva: cfg.cond_iva, pto_vta: cfg.pto_vta, alias: cfg.alias, alicuota: cfg.alicuota, activo: cfg.activo } : null,
      credenciales: { tiene_clave: !!c?.key_enc, tiene_csr: !!c?.csr, tiene_cert: !!c?.cert, cert_vence: c?.cert_vence ?? null, csr: c && !c.cert ? c.csr : null },
      servidor: { llave_maestra: !!this.env.ARCA_MASTER_KEY },
    };
  }
  async generarCsr(forzar: boolean) {
    const cfg = await this.cfg();
    if (!cfg) throw new ErrorArca("Primero guardá los datos del emisor (CUIT, razón social, alias).", "datos");
    const k = await this.master();
    const c = await this.cred();
    if (c?.cert && !forzar) throw new ErrorArca("Ya hay un certificado cargado: generar una clave nueva lo invalida. Confirmalo para continuar.", "datos");
    if (c?.cert) {
      const ap = await this.db.select<{ id: string }>("arca_comprobantes", `comercio_id=eq.${this.comercio}&ambiente=eq.${this.ambiente}&estado=eq.aprobado&select=id&limit=1`);
      if (ap.length) throw new ErrorArca("Ya hay comprobantes con CAE en este ambiente: no se cambia la clave desde acá (pedí ayuda a Vincular Business).", "datos");
    }
    const par = core.generarCSR({ cuit: cfg.cuit, razon: cfg.razon_social, alias: cfg.alias });
    await this.guardarCred({ key_enc: await core.sellar(k, par.keyPem, this.aad("key")), csr: par.csrPem, cert: null, cert_vence: null, ta_enc: null, ta_vence: null });
    return { ok: true, csr: par.csrPem };
  }
  async cargarCert(certPem: string) {
    const c = await this.cred();
    if (!c?.key_enc) throw new ErrorArca("Primero generá la clave y el CSR (paso 1).", "datos");
    if (certPem.length > 20_000) throw new ErrorArca("El archivo es demasiado grande.", "datos");
    const k = await this.master();
    const keyPem = await core.abrir(k, c.key_enc, this.aad("key"));
    const v = core.verificarCert(certPem.trim(), keyPem, this.ahora());
    if (!v.ok) throw new ErrorArca(v.error ?? "Certificado inválido", "datos");
    await this.guardarCred({ cert: certPem.trim(), cert_vence: v.vence, ta_enc: null, ta_vence: null });
    return { ok: true, vence: v.vence, sujeto: v.sujeto };
  }
  async probar() {
    const cfg = await this.cfg();
    if (!cfg) throw new ErrorArca("Primero guardá los datos del emisor.", "datos");
    const pasos: { paso: string; ok: boolean; detalle: string }[] = [];
    const u = this.urls();
    try {
      const d = core.parseDummy(await this.soap(u.wsfe, core.soapAction("FEDummy"), core.xmlDummy()));
      pasos.push({ paso: "Servidores de ARCA (FEDummy)", ok: d.ok, detalle: `App ${d.app} · DB ${d.db} · Auth ${d.auth}` });
    } catch (e) { pasos.push({ paso: "Servidores de ARCA (FEDummy)", ok: false, detalle: msg(e) }); return { ok: false, pasos }; }
    let auth: core.Auth;
    try { auth = await this.ticket(cfg); pasos.push({ paso: "Autenticación (WSAA)", ok: true, detalle: "Ticket de acceso obtenido" }); }
    catch (e) { pasos.push({ paso: "Autenticación (WSAA)", ok: false, detalle: msg(e) }); return { ok: false, pasos }; }
    try {
      const tipo = core.elegirTipo(cfg.cond_iva, core.receptorFinal());
      const n = core.parseUltimo(await this.soap(u.wsfe, core.soapAction("FECompUltimoAutorizado"), core.xmlUltimo(auth, cfg.pto_vta, tipo)));
      pasos.push({ paso: `Punto de venta ${cfg.pto_vta} (último comprobante tipo ${tipo})`, ok: true, detalle: `Último autorizado: ${n}` });
    } catch (e) { pasos.push({ paso: "Punto de venta y relación de servicio WSFE", ok: false, detalle: msg(e) }); return { ok: false, pasos }; }
    try {
      const l = core.parseCondIvaReceptor(await this.soap(u.wsfe, core.soapAction("FEParamGetCondicionIvaReceptor"), core.xmlCondIvaReceptor(auth)));
      pasos.push({ paso: "Condiciones frente al IVA del receptor", ok: l.length > 0, detalle: l.length ? `${l.length} condiciones` : "sin datos" });
    } catch (e) { pasos.push({ paso: "Condiciones frente al IVA del receptor", ok: false, detalle: msg(e) }); }
    return { ok: pasos.every((p) => p.ok), pasos };
  }

  // ---- emisión
  async venta(id: string) {
    if (!id || id.length > 80) throw new ErrorArca("Falta la venta.", "datos");
    const r = await this.db.select<{ datos: Record<string, unknown> }>("registros", `comercio_id=eq.${this.comercio}&coleccion=eq.ventas&id=eq.${encodeURIComponent(id)}&borrado=eq.false`);
    if (!r[0]) throw new ErrorArca("La venta todavía no llegó al servidor: esperá la sincronización y reintentá.", "datos");
    return r[0].datos;
  }
  async emitir(ventaId: string, receptorIn: core.Receptor | undefined, uid: string) {
    const cfg = await this.cfg();
    if (!cfg || !cfg.activo) throw new ErrorArca("La facturación electrónica no está activada en este ambiente.", "datos");
    const v = await this.venta(ventaId) as { items?: core.Item[]; total?: number; status?: string; anulada?: boolean; arca?: { cae?: string } };
    if (v.anulada) throw new ErrorArca("La venta está anulada.", "datos");
    if (v.arca?.cae) return { ok: true, estado: "aprobado", ya: true, ...v.arca };
    const receptor = receptorIn ?? core.receptorFinal();
    const e = core.validarReceptor(receptor); if (e) throw new ErrorArca(e, "datos");
    const items = (v.items ?? []).map((i) => ({ qty: Number(i.qty), price: Number(i.price), disc: Number(i.disc ?? 0), iva: i.iva }));
    const im = core.calcularImportes(items, cfg.cond_iva, cfg.alicuota);
    if (typeof v.total === "number" && v.total !== im.total) throw new ErrorArca(`El total de la venta (${v.total}) no coincide con sus ítems (${im.total}).`, "datos");
    const tipo = core.elegirTipo(cfg.cond_iva, receptor);
    const res = await this.db.rpc("arca_reservar", { p_comercio: this.comercio, p_ambiente: this.ambiente, p_venta: ventaId, p_pto: cfg.pto_vta, p_tipo: tipo, p_receptor: receptor, p_importes: { total: im.total, neto: im.neto, iva: im.iva }, p_asociado: null, p_usuario: uid });
    return await this.despues(cfg, res, ventaId, tipo, im);
  }
  async notaCredito(ventaId: string, uid: string) {
    const cfg = await this.cfg();
    if (!cfg || !cfg.activo) throw new ErrorArca("La facturación electrónica no está activada en este ambiente.", "datos");
    const orig = (await this.db.select<Cbte>("arca_comprobantes", `comercio_id=eq.${this.comercio}&ambiente=eq.${this.ambiente}&venta_id=eq.${encodeURIComponent(ventaId)}&estado=eq.aprobado&tipo=in.(1,6,11)`))[0];
    if (!orig || orig.numero == null) throw new ErrorArca("La venta no tiene una factura con CAE para revertir.", "datos");
    const ncTipo = ({ 1: 3, 6: 8, 11: 13 } as Record<number, number>)[orig.tipo];
    const ya = (await this.db.select<Cbte>("arca_comprobantes", `comercio_id=eq.${this.comercio}&ambiente=eq.${this.ambiente}&venta_id=eq.${encodeURIComponent(ventaId)}&tipo=eq.${ncTipo}`))[0];
    if (ya?.estado === "aprobado") return { ...resumen(ya, cfg, this.env), ok: true, estado: "aprobado", ya: true };
    const im: core.Importes = await this.importesDe(orig, cfg);
    const asoc = { tipo: orig.tipo, pto: orig.pto_vta, nro: Number(orig.numero), cuit: cfg.cuit, fecha: (orig.fecha_cbte ?? "").replace(/-/g, "") || undefined };
    const res = await this.db.rpc("arca_reservar", { p_comercio: this.comercio, p_ambiente: this.ambiente, p_venta: ventaId, p_pto: cfg.pto_vta, p_tipo: ncTipo, p_receptor: orig.receptor, p_importes: { total: im.total, neto: im.neto, iva: im.iva }, p_asociado: asoc, p_usuario: uid });
    return await this.despues(cfg, res, ventaId, ncTipo, im);
  }
  /** Reconstruye el detalle de IVA del comprobante original a partir de la venta (la NC revierte lo mismo). */
  async importesDe(c: Cbte, cfg: Cfg): Promise<core.Importes> {
    const v = await this.venta(c.venta_id) as { items?: core.Item[] };
    const im = core.calcularImportes((v.items ?? []).map((i) => ({ qty: Number(i.qty), price: Number(i.price), disc: Number(i.disc ?? 0), iva: i.iva })), cfg.cond_iva, cfg.alicuota);
    if (im.total !== Number(c.imp_total)) throw new ErrorArca("La venta cambió respecto de la factura emitida: no se puede generar la nota automáticamente.", "datos");
    return im;
  }
  async reintentar(uid: string) {
    const cfg = await this.cfg();
    if (!cfg || !cfg.activo) return { ok: true, procesados: 0, resultados: [] };
    const ahoraIso = this.ahora().toISOString();
    const filas = await this.db.select<Cbte>("arca_comprobantes",
      `comercio_id=eq.${this.comercio}&ambiente=eq.${this.ambiente}&estado=in.(pendiente,error)&intentos=lt.12&or=(proximo_intento.is.null,proximo_intento.lte.${ahoraIso})&order=creado.asc&limit=5`);
    const out: unknown[] = [];
    for (const c of filas) {
      try {
        const im = esNCtipo(c.tipo) ? await this.importesDe(c, cfg) : await this.importesDeVenta(c, cfg);
        const res = await this.db.rpc("arca_reservar", { p_comercio: this.comercio, p_ambiente: this.ambiente, p_venta: c.venta_id, p_pto: c.pto_vta, p_tipo: c.tipo, p_receptor: c.receptor, p_importes: { total: im.total, neto: im.neto, iva: im.iva }, p_asociado: c.asociado, p_usuario: uid });
        out.push({ venta_id: c.venta_id, ...(await this.despues(cfg, res, c.venta_id, c.tipo, im)) });
      } catch (e) { out.push({ venta_id: c.venta_id, ok: false, error: msg(e) }); }
    }
    return { ok: true, procesados: out.length, resultados: out };
  }
  async importesDeVenta(c: Cbte, cfg: Cfg) { return await this.importesDe(c, cfg); }

  async despues(cfg: Cfg, res: { accion: string; id: string }, ventaId: string, tipo: number, im: core.Importes) {
    const fila = async () => (await this.db.select<Cbte>("arca_comprobantes", `id=eq.${res.id}`))[0];
    if (res.accion === "hecho") { const c = await fila(); await this.aplicarVenta(cfg, c); return { ...resumen(c, cfg, this.env), ok: true, estado: "aprobado", ya: true }; }
    if (res.accion === "ocupado") return { ok: true, estado: "enviando", mensaje: "Hay otra solicitud en curso para este comprobante." };
    return await this.ejecutar(cfg, await fila(), im);
  }

  async ejecutar(cfg: Cfg, c: Cbte, im: core.Importes) {
    const u = this.urls();
    const token = await this.db.rpc("arca_lock_tomar", { p_comercio: this.comercio, p_ambiente: this.ambiente, p_pto: c.pto_vta, p_tipo: c.tipo, p_segundos: 90 });
    const resultado = (estado: string, extra: Record<string, unknown> = {}) => this.db.rpc("arca_resultado", {
      p_id: c.id, p_estado: estado, p_numero: null, p_cae: null, p_cae_vto: null, p_fecha: null, p_solicitud: null, p_respuesta: null, p_error: null, p_reintento_seg: null, ...extra,
    });
    if (!token) { await resultado("error", { p_error: "Otro comprobante de este tipo se está numerando", p_reintento_seg: 5 }); return { ok: true, estado: "pendiente", mensaje: "Se reintenta en unos segundos." }; }
    try {
      const auth = await this.ticket(cfg);
      // ¿un intento anterior pudo haber quedado autorizado sin que lo supiéramos? (corte de red justo después de FECAESolicitar)
      if (c.numero != null) {
        const q = core.parseConsultar(await this.soap(u.wsfe, core.soapAction("FECompConsultar"), core.xmlConsultar(auth, c.pto_vta, c.tipo, Number(c.numero))));
        const docEsperado = String(c.receptor?.docNro ?? "0").replace(/\D/g, "") || "0";
        if (q.existe && q.cae && q.total === Number(c.imp_total) && String(q.docNro ?? "0") === docEsperado) {
          return await this.aprobar(cfg, c, { resultado: "A", cae: q.cae, caeVto: q.caeVto, numero: Number(c.numero), observaciones: [], errores: [] }, "recuperado de ARCA", im, (q.fecha ?? "").replace(/-/g, "") || undefined);
        }
      }
      const ultimo = core.parseUltimo(await this.soap(u.wsfe, core.soapAction("FECompUltimoAutorizado"), core.xmlUltimo(auth, c.pto_vta, c.tipo)));
      const numero = ultimo + 1;
      await resultado("enviando", { p_numero: numero });
      const fecha = core.yyyymmdd(this.ahora());
      const sol: core.SolicitudCAE = { pto: c.pto_vta, tipo: c.tipo, numero, fecha, receptor: c.receptor ?? core.receptorFinal(), importes: im, asociado: c.asociado ?? undefined };
      const r = core.parseSolicitar(await this.soap(u.wsfe, core.soapAction("FECAESolicitar"), core.xmlSolicitar(auth, sol)));
      if (r.resultado === "A" && r.cae && r.numero === numero) return await this.aprobar(cfg, { ...c, numero }, r, null, im, fecha);
      if (r.resultado === "A") throw new ErrorArca("ARCA aprobó pero la respuesta no trae CAE/número válidos; se verifica en el próximo intento.", "wsfe", true);
      const m = core.mensajeHumano(r);
      await resultado("rechazado", { p_numero: null, p_fecha: null, p_solicitud: sol as unknown as Record<string, unknown>, p_respuesta: { resultado: r.resultado, observaciones: r.observaciones, errores: r.errores }, p_error: m });
      await this.aplicarVenta(cfg, { ...c, estado: "rechazado", error: m });
      return { ok: false, estado: "rechazado", error: m || "ARCA rechazó el comprobante.", codigos: [...r.errores, ...r.observaciones] };
    } catch (e) {
      if (e instanceof ErrorArca && e.reintentable) {
        const seg = Math.min(60 * 2 ** Math.max(0, c.intentos - 1), 3600);
        await resultado("error", { p_error: e.message, p_reintento_seg: seg });
        return { ok: true, estado: "pendiente", mensaje: e.message, reintento_en_seg: seg };
      }
      await resultado("error", { p_error: e instanceof Error ? e.message : "error", p_reintento_seg: null });
      throw e;
    } finally {
      await this.db.rpc("arca_lock_soltar", { p_comercio: this.comercio, p_ambiente: this.ambiente, p_pto: c.pto_vta, p_tipo: c.tipo, p_token: token }).catch(() => {});
    }
  }

  async aprobar(cfg: Cfg, c: Cbte, r: core.ResultadoCAE, nota: string | null, _im: core.Importes, fecha?: string) {
    const f = fecha ? `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}` : c.fecha_cbte ?? core.fechaAR(this.ahora());
    await this.db.rpc("arca_resultado", { p_id: c.id, p_estado: "aprobado", p_numero: r.numero ?? c.numero, p_cae: r.cae, p_cae_vto: r.caeVto, p_fecha: f, p_solicitud: null, p_respuesta: { resultado: r.resultado, observaciones: r.observaciones, nota }, p_error: null, p_reintento_seg: null });
    const fin = (await this.db.select<Cbte>("arca_comprobantes", `id=eq.${c.id}`))[0];
    await this.aplicarVenta(cfg, fin);
    return { ...resumen(fin, cfg, this.env), ok: true, estado: "aprobado", observaciones: r.observaciones };
  }
  async aplicarVenta(cfg: Cfg, c: Cbte) {
    const r = resumen(c, cfg, this.env);
    await this.db.rpc("arca_aplicar_venta", { p_comercio: this.comercio, p_venta: c.venta_id, p_clave: esNCtipo(c.tipo) ? "arcaNC" : "arca", p_arca: r });
  }
}

const esNCtipo = (t: number) => core.esNC(t);
const msg = (e: unknown) => e instanceof Error ? e.message.slice(0, 300) : "error";

/** Lo que se guarda en la venta y se le devuelve al navegador (nunca credenciales). */
function resumen(c: Cbte, cfg: Cfg, env: Entorno) {
  const base = {
    id: c.id, estado: c.estado, tipo: c.tipo, letra: core.letraDe(c.tipo), pto: c.pto_vta, nro: c.numero, cae: c.cae, vto: c.cae_vto, fecha: c.fecha_cbte,
    total: Number(c.imp_total), neto: Number(c.imp_neto), iva: Number(c.imp_iva), cuit: cfg.cuit, razon: cfg.razon_social, cond: cfg.cond_iva,
    receptor: c.receptor ? { docTipo: c.receptor.docTipo, docNro: c.receptor.docNro, condIva: c.receptor.condIva, nombre: c.receptor.nombre ?? "" } : null,
    error: c.error ?? null, ambiente: c.ambiente,
  };
  if (c.estado === "aprobado" && c.cae && c.numero != null && c.fecha_cbte && c.receptor) {
    const d = core.datosQR({ fecha: c.fecha_cbte, cuit: cfg.cuit, pto: c.pto_vta, tipo: c.tipo, nro: Number(c.numero), total: Number(c.imp_total), receptor: c.receptor, cae: c.cae });
    return { ...base, qr: core.urlQR(d, env.ARCA_QR_BASE || core.QR_BASE_DEFECTO) };
  }
  return base;
}

// ===== index.ts =====
// Punto de entrada de la Edge Function "arca" (Supabase / Deno).
// Variables que ya existen en Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Secreto que carga Vincular Business (NO va al repositorio):   ARCA_MASTER_KEY  = 32 bytes aleatorios en base64
//   supabase secrets set ARCA_MASTER_KEY="$(openssl rand -base64 32)"
// Opcionales: ALLOWED_ORIGINS (ej. https://raveholding.github.io), ARCA_*_URL_*, ARCA_QR_BASE.

Deno.serve((req) => {
  const e = (k: string) => Deno.env.get(k) ?? undefined;
  const env: Entorno = {
    SUPABASE_URL: e("SUPABASE_URL") ?? "", SUPABASE_ANON_KEY: e("SUPABASE_ANON_KEY") ?? "", SUPABASE_SERVICE_ROLE_KEY: e("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ARCA_MASTER_KEY: e("ARCA_MASTER_KEY"), ALLOWED_ORIGINS: e("ALLOWED_ORIGINS"),
    ARCA_WSAA_URL_HOMO: e("ARCA_WSAA_URL_HOMO"), ARCA_WSAA_URL_PROD: e("ARCA_WSAA_URL_PROD"),
    ARCA_WSFE_URL_HOMO: e("ARCA_WSFE_URL_HOMO"), ARCA_WSFE_URL_PROD: e("ARCA_WSFE_URL_PROD"), ARCA_QR_BASE: e("ARCA_QR_BASE"),
  };
  return manejar(req, env);
});
