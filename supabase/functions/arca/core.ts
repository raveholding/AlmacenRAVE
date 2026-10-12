// SISTEMA RAVE · Facturación electrónica ARCA — lógica pura (sin red, sin base de datos).
// La usan index.ts (producción) y los tests. Nada de acá toca secretos: reciben y devuelven valores.
//
// Servicios de ARCA que usa: WSAA (autenticación) y WSFEv1 (factura electrónica, mercado interno).
// Todo lo que depende de documentos de ARCA y no pudo comprobarse acá va marcado [VERIFICAR].
import forge from "npm:node-forge@1.3.1";
import { XMLParser } from "npm:fast-xml-parser@4.5.0";

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
