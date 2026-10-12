// Pruebas de la Edge Function "arca": lógica pura + función completa contra PostgREST/Postgres reales
// y un ARCA FALSO (WSAA + WSFE simulados). NO prueban contra ARCA real: eso es la homologación del cliente.
// Correr:  ./tests/mk-e2e-db.sh && deno test -A functions/arca/arca_test.ts
import * as core from "./core.ts";
import { manejar, type Entorno } from "./handler.ts";
import forge from "npm:node-forge@1.3.1";

const ok = (c: unknown, m: string) => { if (!c) throw new Error("FALLA: " + m); };
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`FALLA: ${m} · esperado ${JSON.stringify(b)} · obtenido ${JSON.stringify(a)}`); };
const dec = new TextDecoder();

async function sh(cmd: string[], stdin?: string) {
  const p = new Deno.Command(cmd[0], { args: cmd.slice(1), stdin: "piped", stdout: "piped", stderr: "piped" }).spawn();
  const w = p.stdin.getWriter(); if (stdin) await w.write(new TextEncoder().encode(stdin)); await w.close();
  const o = await p.output();
  return { code: o.code, out: dec.decode(o.stdout), err: dec.decode(o.stderr) };
}
const psql = async (sql: string) => { const r = await sh(["su", "postgres", "-c", "psql -d rave_e2e -At -v ON_ERROR_STOP=1"], sql); if (r.code) throw new Error(r.err); return r.out.trim(); };

// ======================================================================= lógica pura
Deno.test("CUIT: dígito verificador", () => {
  ok(core.cuitOk("20-12345678-6"), "válido"); ok(!core.cuitOk("20123456789"), "dígito malo"); ok(!core.cuitOk("11111111111"), "prefijo"); ok(!core.cuitOk(""), "vacío");
  ok(core.cuitOk("30-71234567-1") === core.cuitOk("30712345671"), "con y sin guiones");
});

Deno.test("importes: precios con IVA incluido se discriminan sin perder un centavo", () => {
  const a = core.calcularImportes([{ qty: 1, price: 12100 }], "RI", 21);
  eq([a.total, a.neto, a.iva], [12100, 10000, 2100], "121,00 → 100,00 + 21,00");
  eq(a.ivaDet, [{ id: 5, base: 10000, importe: 2100, alic: 21 }], "alícuota 21 → Id 5");
  const b = core.calcularImportes([{ qty: 2, price: 5000, iva: 21 }, { qty: 1, price: 3300, iva: 10.5 }, { qty: 3, price: 1000, iva: 0 }], "RI", 21);
  eq(b.total, 2 * 5000 + 3300 + 3000, "total"); eq(b.neto + b.iva, b.total, "neto+iva = total"); eq(b.ivaDet.length, 3, "tres alícuotas"); eq(b.ivaDet.map((x) => x.id), [3, 4, 5], "ids 0%, 10.5%, 21%");
  const c = core.calcularImportes([{ qty: 1.5, price: 1999, disc: 100 }], "MONO", 21);
  eq([c.total, c.neto, c.iva, c.ivaDet.length], [Math.round(1.5 * 1999) - 100, Math.round(1.5 * 1999) - 100, 0, 0], "Factura C: sin IVA discriminado");
  // propiedad: para cualquier combinación, neto + iva == total y cada grupo cierra
  for (let i = 0; i < 2000; i++) {
    const items = Array.from({ length: 1 + (i % 5) }, (_, k) => ({ qty: 1 + ((i * 7 + k) % 9) / 4, price: 100 + ((i * 131 + k * 17) % 90000), disc: (i + k) % 3 === 0 ? 5 : 0, iva: [21, 10.5, 27, 0, 5, 2.5][(i + k) % 6] }));
    let r; try { r = core.calcularImportes(items, "RI", 21); } catch (_e) { continue; }
    ok(r.neto + r.iva === r.total, "neto+iva=total (propiedad)");
    ok(r.ivaDet.reduce((s, x) => s + x.base + x.importe, 0) === r.total, "suma de grupos");
  }
  let err = ""; try { core.calcularImportes([{ qty: 0, price: 100 }], "RI", 21); } catch (e) { err = String(e); } ok(err, "cantidad 0 rechazada");
  err = ""; try { core.calcularImportes([{ qty: 1, price: 100.5 }], "RI", 21); } catch (e) { err = String(e); } ok(err, "centavos fraccionarios rechazados");
  err = ""; try { core.calcularImportes([{ qty: 1, price: 100, disc: 100 }], "RI", 21); } catch (e) { err = String(e); } ok(err, "ítem con importe cero rechazado");
  err = ""; try { core.calcularImportes([{ qty: 1, price: 100, iva: 19 }], "RI", 21); } catch (e) { err = String(e); } ok(err, "alícuota inexistente rechazada");
});

Deno.test("tipo de comprobante según emisor y receptor", () => {
  const final = core.receptorFinal(), ri = { docTipo: 80, docNro: "30712345671", condIva: 1 }, mono = { docTipo: 80, docNro: "20123456786", condIva: 6 };
  eq(core.elegirTipo("RI", final), 6, "RI→consumidor final = B"); eq(core.elegirTipo("RI", ri), 1, "RI→RI = A"); eq(core.elegirTipo("RI", mono), 1, "RI→monotributo = A");
  eq(core.elegirTipo("MONO", ri), 11, "monotributo siempre C"); eq(core.elegirTipo("MONO", final, "nc"), 13, "NC C"); eq(core.elegirTipo("RI", ri, "nc"), 3, "NC A"); eq(core.elegirTipo("RI", final, "nc"), 8, "NC B");
  let e = ""; try { core.elegirTipo("EXENTO", final); } catch (x) { e = String(x); } ok(e.includes("Exento"), "exento no soportado, con aviso");
  ok(core.validarReceptor({ docTipo: 80, docNro: "20123456789", condIva: 1 }) !== null, "CUIT inválido");
  ok(core.validarReceptor({ docTipo: 99, docNro: "0", condIva: 5 }) === null, "consumidor final OK");
  ok(core.validarReceptor({ docTipo: 7, docNro: "1", condIva: 5 }) !== null, "tipo de doc desconocido");
});

Deno.test("CSR: openssl lo verifica y el sujeto es el que pide ARCA", async () => {
  const { csrPem, keyPem } = core.generarCSR({ cuit: "20-12345678-6", razon: "Almacén, Los \"Pibes\" = SA", alias: "raveprueba" });
  await Deno.writeTextFile("/tmp/csr_test.pem", csrPem);
  const v = await sh(["openssl", "req", "-verify", "-noout", "-in", "/tmp/csr_test.pem", "-subject", "-nameopt", "multiline"]);
  ok(v.code === 0 && /verify OK/.test(v.err + v.out), "openssl req -verify: " + v.err);
  ok(/countryName\s*=\s*AR/.test(v.out), "C=AR"); ok(/commonName\s*=\s*raveprueba/.test(v.out), "CN=alias"); ok(/serialNumber\s*=\s*CUIT 20123456786/.test(v.out), "serialNumber=CUIT 11 dígitos");
  ok((v.out.match(/organizationName\s*=\s*(.*)/)?.[1] ?? "").trim() === "Almacen Los Pibes SA", "razón social saneada y en ASCII: " + v.out);
  const t = await sh(["openssl", "req", "-in", "/tmp/csr_test.pem", "-noout", "-text"]);
  ok(/Public-Key: \(2048 bit\)/.test(t.out), "RSA 2048"); ok(/sha256WithRSAEncryption/.test(t.out), "SHA-256");
  ok(keyPem.includes("BEGIN RSA PRIVATE KEY") || keyPem.includes("BEGIN PRIVATE KEY"), "clave generada");
  for (const bad of [{ cuit: "20123456789", razon: "X SA", alias: "abc" }, { cuit: "20123456786", razon: "X SA", alias: "con espacio" }, { cuit: "20123456786", razon: " ", alias: "abc" }]) {
    let e = ""; try { core.generarCSR(bad); } catch (x) { e = String(x); } ok(e, "datos inválidos rechazados: " + JSON.stringify(bad));
  }
});

function certDe(csrPem: string, ca: { key: forge.pki.PrivateKey; cert: forge.pki.Certificate }, dias: number, desdeMs = Date.now() - 3600_000) {
  const csr = forge.pki.certificationRequestFromPem(csrPem);
  const c = forge.pki.createCertificate();
  c.publicKey = csr.publicKey!; c.serialNumber = "01"; c.validity.notBefore = new Date(desdeMs); c.validity.notAfter = new Date(desdeMs + dias * 86400_000);
  c.setSubject(csr.subject.attributes); c.setIssuer(ca.cert.subject.attributes); c.sign(ca.key as forge.pki.rsa.PrivateKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(c);
}
function nuevaCA() {
  const k = forge.pki.rsa.generateKeyPair(2048); const c = forge.pki.createCertificate();
  c.publicKey = k.publicKey; c.serialNumber = "99"; c.validity.notBefore = new Date(Date.now() - 86400_000); c.validity.notAfter = new Date(Date.now() + 5 * 365 * 86400_000);
  const a = [{ name: "commonName", value: "CA de prueba (no es ARCA)" }]; c.setSubject(a); c.setIssuer(a); c.sign(k.privateKey, forge.md.sha256.create());
  return { key: k.privateKey, cert: c };
}

Deno.test("certificado: debe corresponder a la clave del sistema, vigente", () => {
  const ca = nuevaCA();
  const a = core.generarCSR({ cuit: "20123456786", razon: "A SA", alias: "aaa" }), b = core.generarCSR({ cuit: "20123456786", razon: "A SA", alias: "bbb" });
  const bueno = certDe(a.csrPem, ca, 365);
  const r = core.verificarCert(bueno, a.keyPem); ok(r.ok && r.vence, "certificado correcto: " + r.error);
  const otro = core.verificarCert(certDe(b.csrPem, ca, 365), a.keyPem); ok(!otro.ok && /NO corresponde/.test(otro.error!), "certificado de OTRA clave rechazado");
  const venc = core.verificarCert(certDe(a.csrPem, ca, 10, Date.now() - 40 * 86400_000), a.keyPem); ok(!venc.ok && /vencido/.test(venc.error!), "vencido rechazado");
  const futuro = core.verificarCert(certDe(a.csrPem, ca, 10, Date.now() + 40 * 86400_000), a.keyPem); ok(!futuro.ok, "todavía no vigente rechazado");
  ok(!core.verificarCert("hola", a.keyPem).ok, "basura rechazada"); ok(!core.verificarCert(bueno, "no es clave").ok, "clave ilegible rechazada");
});

Deno.test("WSAA: el CMS está bien formado y verifica con openssl", async () => {
  const ca = nuevaCA(); const p = core.generarCSR({ cuit: "20123456786", razon: "A SA", alias: "aaa" });
  const cert = certDe(p.csrPem, ca, 365);
  const ahora = new Date("2026-10-12T22:00:00Z");
  const tra = core.armarTRA("wsfe", ahora, 1760306400);
  ok(/<generationTime>2026-10-12T18:50:00-03:00<\/generationTime>/.test(tra), "generationTime -10 min en hora argentina: " + tra);
  ok(/<expirationTime>2026-10-12T19:10:00-03:00<\/expirationTime>/.test(tra), "expirationTime +10 min");
  ok(tra.includes("<service>wsfe</service>"), "servicio wsfe");
  const cms = core.firmarCMS(tra, cert, p.keyPem);
  await Deno.writeFile("/tmp/cms_test.der", Uint8Array.from(atob(cms), (c) => c.charCodeAt(0)));
  const v = await sh(["openssl", "cms", "-verify", "-inform", "DER", "-in", "/tmp/cms_test.der", "-noverify", "-out", "/tmp/cms_out.xml"]);
  ok(v.code === 0, "openssl cms -verify: " + v.err);
  eq(await Deno.readTextFile("/tmp/cms_out.xml"), tra, "el contenido firmado es el TRA");
  const dgst = await sh(["openssl", "pkcs7", "-inform", "DER", "-in", "/tmp/cms_test.der", "-print", "-noout"]);
  ok(/sha256/i.test(dgst.out), "digest SHA-256");
  const soap = core.soapWsaa(cms); ok(soap.includes("<wsaa:in0>") && soap.includes(cms), "sobre SOAP con el CMS");
});

Deno.test("cifrado de lo guardado: AES-GCM, distinto contexto no abre", async () => {
  const k = await core.importarLlaveMaestra(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
  const s = await core.sellar(k, "-----BEGIN RSA PRIVATE KEY-----SECRETO", "key|c1|homologacion");
  ok(!s.includes("SECRETO") && s.startsWith("v1."), "no está en claro");
  eq(await core.abrir(k, s, "key|c1|homologacion"), "-----BEGIN RSA PRIVATE KEY-----SECRETO", "ida y vuelta");
  let e = ""; try { await core.abrir(k, s, "key|c2|homologacion"); } catch (x) { e = String(x); } ok(e, "otro comercio no puede abrirla (AAD)");
  e = ""; try { await core.abrir(k, s, "key|c1|produccion"); } catch (x) { e = String(x); } ok(e, "otro ambiente no puede abrirla");
  e = ""; try { await core.importarLlaveMaestra(btoa("corta")); } catch (x) { e = String(x); } ok(e, "llave de largo incorrecto rechazada");
});

Deno.test("XML de WSFE: estructura y orden de FECAESolicitar", () => {
  const a = { token: "T", sign: "S", cuit: "20123456786" };
  const im = core.calcularImportes([{ qty: 1, price: 12100 }], "RI", 21);
  const x = core.xmlSolicitar(a, { pto: 3, tipo: 6, numero: 8, fecha: "20261012", receptor: core.receptorFinal(), importes: im });
  const orden = ["Concepto", "DocTipo", "DocNro", "CbteDesde", "CbteHasta", "CbteFch", "ImpTotal", "ImpTotConc", "ImpNeto", "ImpOpEx", "ImpTrib", "ImpIVA", "MonId", "MonCotiz", "CondicionIVAReceptorId", "Iva"];
  let pos = -1; for (const t of orden) { const p = x.indexOf("<" + t + ">"); ok(p > pos, `elemento ${t} en orden`); pos = p; }
  ok(x.includes("<ImpTotal>121.00</ImpTotal>") && x.includes("<ImpNeto>100.00</ImpNeto>") && x.includes("<ImpIVA>21.00</ImpIVA>"), "importes con 2 decimales");
  ok(x.includes("<AlicIva><Id>5</Id><BaseImp>100.00</BaseImp><Importe>21.00</Importe></AlicIva>"), "alícuota");
  ok(x.includes('SOAPAction') === false, "la cabecera va aparte"); ok(core.soapAction("FECAESolicitar") === '"http://ar.gov.afip.dif.FEV1/FECAESolicitar"', "SOAPAction");
  const nc = core.xmlSolicitar(a, { pto: 3, tipo: 8, numero: 9, fecha: "20261012", receptor: core.receptorFinal(), importes: im, asociado: { tipo: 6, pto: 3, nro: 8, cuit: "20123456786", fecha: "20261012" } });
  ok(nc.indexOf("<CbtesAsoc>") > nc.indexOf("<CondicionIVAReceptorId>") && nc.indexOf("<CbtesAsoc>") < nc.indexOf("<Iva>"), "CbtesAsoc entre CondicionIVAReceptorId e Iva");
  const c = core.xmlSolicitar(a, { pto: 1, tipo: 11, numero: 1, fecha: "20261012", receptor: core.receptorFinal(), importes: core.calcularImportes([{ qty: 1, price: 5000 }], "MONO", 21) });
  ok(!c.includes("<Iva>") && c.includes("<ImpIVA>0.00</ImpIVA>"), "Factura C sin bloque Iva");
  const inj = core.xmlSolicitar({ token: "<x>&", sign: "S", cuit: "1" }, { pto: 1, tipo: 11, numero: 1, fecha: "20261012", receptor: core.receptorFinal(), importes: core.calcularImportes([{ qty: 1, price: 5000 }], "MONO", 21) });
  ok(inj.includes("&lt;x&gt;&amp;"), "valores escapados en el XML");
});

Deno.test("respuestas de WSFE: aprobado, rechazado, errores, consulta", () => {
  const env = (b: string) => `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${b}</soap:Body></soap:Envelope>`;
  const aprobado = env(`<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult><FeCabResp><Resultado>A</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><CbteDesde>8</CbteDesde><Resultado>A</Resultado><CAE>74123456789012</CAE><CAEFchVto>20261022</CAEFchVto></FECAEDetResponse></FeDetResp></FECAESolicitarResult></FECAESolicitarResponse>`);
  const r = core.parseSolicitar(aprobado); eq([r.resultado, r.cae, r.caeVto, r.numero], ["A", "74123456789012", "2026-10-22", 8], "aprobado");
  const rech = env(`<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult><FeCabResp><Resultado>R</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><Resultado>R</Resultado><Observaciones><Obs><Code>10016</Code><Msg>El numero no es correlativo</Msg></Obs><Obs><Code>10048</Code><Msg>otra</Msg></Obs></Observaciones></FECAEDetResponse></FeDetResp></FECAESolicitarResult></FECAESolicitarResponse>`);
  const rr = core.parseSolicitar(rech); eq(rr.resultado, "R", "rechazado"); eq(rr.observaciones.length, 2, "dos observaciones"); ok(!rr.cae, "sin CAE"); ok(core.mensajeHumano(rr).includes("10016: El numero no es correlativo"), "mensaje humano");
  const err = env(`<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult><Errors><Err><Code>600</Code><Msg>ValidacionDeToken: No apareció CUIT en lista de relaciones</Msg></Err></Errors></FECAESolicitarResult></FECAESolicitarResponse>`);
  const re = core.parseSolicitar(err); eq(re.errores[0].code, "600", "error de ARCA"); ok(!re.cae, "sin CAE");
  const falso = env(`<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult><FeDetResp><FECAEDetResponse><Resultado>A</Resultado><CAE>123</CAE></FECAEDetResponse></FeDetResp></FECAESolicitarResult></FECAESolicitarResponse>`);
  ok(!core.parseSolicitar(falso).cae, "CAE con formato inválido no se acepta");
  const ult = env(`<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompUltimoAutorizadoResult><PtoVta>1</PtoVta><CbteTipo>11</CbteTipo><CbteNro>41</CbteNro></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse>`);
  eq(core.parseUltimo(ult), 41, "último autorizado");
  const fault = env(`<soap:Fault><faultcode>soap:Server</faultcode><faultstring>boom</faultstring></soap:Fault>`);
  let e: unknown; try { core.parseUltimo(fault); } catch (x) { e = x; } ok(e instanceof core.ErrorArca && e.reintentable, "Fault SOAP → error reintentable");
  const q = env(`<FECompConsultarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompConsultarResult><ResultGet><DocNro>0</DocNro><CbteDesde>5</CbteDesde><CbteFch>20261012</CbteFch><ImpTotal>121.00</ImpTotal><CodAutorizacion>74123456789012</CodAutorizacion><FchVto>20261022</FchVto><Resultado>A</Resultado></ResultGet></FECompConsultarResult></FECompConsultarResponse>`);
  const cq = core.parseConsultar(q); eq([cq.existe, cq.total, cq.cae, cq.caeVto], [true, 12100, "74123456789012", "2026-10-22"], "consulta");
  ok(!core.parseConsultar(env(`<FECompConsultarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompConsultarResult><Errors><Err><Code>602</Code><Msg>No existen datos</Msg></Err></Errors></FECompConsultarResult></FECompConsultarResponse>`)).existe, "no existe");
  const qr = core.datosQR({ fecha: "2026-10-12", cuit: "20123456786", pto: 1, tipo: 11, nro: 8, total: 12100, receptor: core.receptorFinal(), cae: "74123456789012" });
  eq([qr.ver, qr.importe, qr.tipoCodAut, qr.codAut], [1, 121, "E", 74123456789012], "datos del QR"); ok(core.urlQR(qr).startsWith(core.QR_BASE_DEFECTO), "URL del QR");
});

// ======================================================================= función completa (PostgREST + ARCA falso)
const JWT_SECRET = "test-secret-test-secret-test-secret-123456";
async function jwt(claims: Record<string, unknown>) {
  const b = (o: unknown) => btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const h = b({ alg: "HS256", typ: "JWT" }), p = b({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims });
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(h + "." + p)));
  return `${h}.${p}.` + btoa(String.fromCharCode(...s)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// ---- ARCA falso
interface Emitido { tipo: number; pto: number; nro: number; total: number; docNro: string; cae: string; vto: string; asoc?: unknown; req: string }
const arca = {
  emitidos: [] as Emitido[], logins: 0, taVence: 0, solicitudes: 0, reqs: [] as string[],
  modo: "ok" as "ok" | "rechazar" | "caido",
  cortarDespuesDeAprobar: 0, // cuántas respuestas se pierden DESPUÉS de autorizar
  token: "", demoraMs: 0,
};
const sob = (b: string) => `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${b}</soap:Body></soap:Envelope>`;
const NS = `xmlns="http://ar.gov.afip.dif.FEV1/"`;
function arcaFake(req: string, action: string, url: string): { status: number; body: string; perder?: boolean } {
  arca.reqs.push(action);
  if (url.endsWith("/wsaa")) {
    if (Date.now() < arca.taVence) return { status: 500, body: sob(`<soap:Fault><faultcode>ns1:coaFailure</faultcode><faultstring>El CEE ya posee un TA valido para el acceso al WS solicitado</faultstring></soap:Fault>`) };
    arca.logins++; arca.taVence = Date.now() + 12 * 3600_000; arca.token = "TOKEN-" + arca.logins;
    const ta = `<?xml version="1.0" encoding="UTF-8"?><loginTicketResponse version="1.0"><header><expirationTime>${new Date(arca.taVence).toISOString()}</expirationTime></header><credentials><token>${arca.token}</token><sign>SIGN-${arca.logins}</sign></credentials></loginTicketResponse>`;
    const esc = ta.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return { status: 200, body: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><loginCmsResponse xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov"><loginCmsReturn>${esc}</loginCmsReturn></loginCmsResponse></soapenv:Body></soapenv:Envelope>` };
  }
  if (arca.modo === "caido" && !action.includes("FEDummy")) return { status: 503, body: "Service Unavailable" };
  const j = core.parseXml(req).Envelope.Body;
  if (action.includes("FEDummy")) return { status: 200, body: sob(`<FEDummyResponse ${NS}><FEDummyResult><AppServer>OK</AppServer><DbServer>OK</DbServer><AuthServer>OK</AuthServer></FEDummyResult></FEDummyResponse>`) };
  const op = Object.keys(j)[0], body = j[op];
  if (body?.Auth?.Token !== arca.token) return { status: 200, body: sob(`<${op}Response ${NS}><${op}Result><Errors><Err><Code>600</Code><Msg>ValidacionDeToken: token inválido</Msg></Err></Errors></${op}Result></${op}Response>`) };
  if (op === "FECompUltimoAutorizado") {
    const n = Math.max(0, ...arca.emitidos.filter((e) => e.pto === Number(body.PtoVta) && e.tipo === Number(body.CbteTipo)).map((e) => e.nro));
    return { status: 200, body: sob(`<FECompUltimoAutorizadoResponse ${NS}><FECompUltimoAutorizadoResult><PtoVta>${body.PtoVta}</PtoVta><CbteTipo>${body.CbteTipo}</CbteTipo><CbteNro>${n}</CbteNro></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse>`) };
  }
  if (op === "FEParamGetCondicionIvaReceptor") {
    return { status: 200, body: sob(`<FEParamGetCondicionIvaReceptorResponse ${NS}><FEParamGetCondicionIvaReceptorResult><ResultGet><CondicionIvaReceptor><Id>1</Id><Desc>IVA Responsable Inscripto</Desc></CondicionIvaReceptor><CondicionIvaReceptor><Id>5</Id><Desc>Consumidor Final</Desc></CondicionIvaReceptor></ResultGet></FEParamGetCondicionIvaReceptorResult></FEParamGetCondicionIvaReceptorResponse>`) };
  }
  if (op === "FECompConsultar") {
    const q = body.FeCompConsReq, e = arca.emitidos.find((x) => x.pto === Number(q.PtoVta) && x.tipo === Number(q.CbteTipo) && x.nro === Number(q.CbteNro));
    if (!e) return { status: 200, body: sob(`<FECompConsultarResponse ${NS}><FECompConsultarResult><Errors><Err><Code>602</Code><Msg>No existen datos en nuestros registros</Msg></Err></Errors></FECompConsultarResult></FECompConsultarResponse>`) };
    return { status: 200, body: sob(`<FECompConsultarResponse ${NS}><FECompConsultarResult><ResultGet><DocNro>${e.docNro}</DocNro><CbteDesde>${e.nro}</CbteDesde><CbteFch>20261012</CbteFch><ImpTotal>${(e.total / 100).toFixed(2)}</ImpTotal><CodAutorizacion>${e.cae}</CodAutorizacion><FchVto>${e.vto}</FchVto><Resultado>A</Resultado></ResultGet></FECompConsultarResult></FECompConsultarResponse>`) };
  }
  if (op === "FECAESolicitar") {
    arca.solicitudes++;
    const cab = body.FeCAEReq.FeCabReq, d = body.FeCAEReq.FeDetReq.FECAEDetRequest;
    const pto = Number(cab.PtoVta), tipo = Number(cab.CbteTipo), nro = Number(d.CbteDesde);
    const ult = Math.max(0, ...arca.emitidos.filter((e) => e.pto === pto && e.tipo === tipo).map((e) => e.nro));
    const f = (m: string, c = "10016") => ({ status: 200, body: sob(`<FECAESolicitarResponse ${NS}><FECAESolicitarResult><FeCabResp><Resultado>R</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><CbteDesde>${nro}</CbteDesde><Resultado>R</Resultado><Observaciones><Obs><Code>${c}</Code><Msg>${m}</Msg></Obs></Observaciones></FECAEDetResponse></FeDetResp></FECAESolicitarResult></FECAESolicitarResponse>`) });
    if (arca.modo === "rechazar") return f("Rechazo simulado: el CUIT del receptor no está activo", "10015");
    if (nro !== ult + 1) return f(`El numero de comprobante (${nro}) no es correlativo al ultimo (${ult})`);
    const c = (x: string) => Math.round(Number(x) * 100);
    const suma = c(d.ImpTotConc) + c(d.ImpNeto) + c(d.ImpOpEx) + c(d.ImpTrib) + c(d.ImpIVA);
    if (suma !== c(d.ImpTotal)) return f(`ImpTotal (${d.ImpTotal}) no coincide con la suma de componentes`, "10048");
    if (d.Iva) {
      const al = [d.Iva.AlicIva].flat();
      if (al.reduce((s: number, a: { Importe: string }) => s + c(a.Importe), 0) !== c(d.ImpIVA)) return f("Suma de alícuotas distinta de ImpIVA", "10051");
      if (al.reduce((s: number, a: { BaseImp: string }) => s + c(a.BaseImp), 0) !== c(d.ImpNeto)) return f("Suma de bases distinta de ImpNeto", "10051");
    } else if (c(d.ImpIVA) !== 0 && ![11, 12, 13].includes(tipo)) return f("Falta el detalle de IVA", "10051");
    if ([3, 8, 13, 2, 7, 12].includes(tipo) && !d.CbtesAsoc) return f("Falta el comprobante asociado", "10197");
    if (!d.CondicionIVAReceptorId) return f("Falta CondicionIVAReceptorId", "10242");
    const cae = String(70000000000000 + arca.emitidos.length * 7919 + nro).padStart(14, "0");
    const e: Emitido = { tipo, pto, nro, total: c(d.ImpTotal), docNro: String(d.DocNro), cae, vto: "20261022", asoc: d.CbtesAsoc, req };
    arca.emitidos.push(e);
    const r = sob(`<FECAESolicitarResponse ${NS}><FECAESolicitarResult><FeCabResp><Resultado>A</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><CbteDesde>${nro}</CbteDesde><Resultado>A</Resultado><CAE>${cae}</CAE><CAEFchVto>20261022</CAEFchVto></FECAEDetResponse></FeDetResp></FECAESolicitarResult></FECAESolicitarResponse>`);
    if (arca.cortarDespuesDeAprobar > 0) { arca.cortarDespuesDeAprobar--; return { status: 200, body: r, perder: true }; }
    return { status: 200, body: r };
  }
  return { status: 500, body: "?" };
}

const PORT_PROXY = 3013;
const URL_BASE = `http://127.0.0.1:${PORT_PROXY}`;
const env: Entorno = {
  SUPABASE_URL: URL_BASE, SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", ARCA_MASTER_KEY: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
  ARCA_WSAA_URL_HOMO: "http://arca.fake/wsaa", ARCA_WSFE_URL_HOMO: "http://arca.fake/wsfe",
};
let relojOffset = 0;
const ahora = () => new Date(Date.now() + relojOffset);
const fetchTest: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  if (url.startsWith("http://arca.fake/")) {
    if (arca.demoraMs) await new Promise((r) => setTimeout(r, arca.demoraMs));
    const action = String((init?.headers as Record<string, string>)?.SOAPAction ?? "");
    const r = arcaFake(String(init?.body ?? ""), action, url);
    if (r.perder) throw new TypeError("connection reset (simulado: ARCA autorizó pero la respuesta se perdió)");
    return new Response(r.body, { status: r.status, headers: { "Content-Type": "text/xml" } });
  }
  return fetch(input, init);
};

async function llamar(token: string, cuerpo: Record<string, unknown>) {
  const req = new Request("http://fn/arca", { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json", origin: "https://raveholding.github.io" }, body: JSON.stringify(cuerpo) });
  const r = await manejar(req, env, fetchTest, ahora);
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j } as Record<string, any> & { status: number };
}
async function rpc(token: string, fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { Authorization: "Bearer " + token, apikey: token, "content-type": "application/json" }, body: JSON.stringify(args) });
  const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null };
}

// proxy /rest/v1 → PostgREST
let proxy: Deno.HttpServer;
const U = { adm: "10000000-0000-0000-0000-00000000000a", mos: "10000000-0000-0000-0000-0000000000a2", sup: "10000000-0000-0000-0000-0000000000a5", ext: "10000000-0000-0000-0000-0000000000e1", admB: "10000000-0000-0000-0000-00000000000b" };
const T: Record<string, string> = {};
let cA = "", cB = "";
let CA: ReturnType<typeof nuevaCA>;

Deno.test({ name: "función arca · preparación (proxy, usuarios, comercios)", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  proxy = Deno.serve({ port: PORT_PROXY, hostname: "127.0.0.1", onListen() {} }, async (req) => {
    const u = new URL(req.url); const dst = "http://127.0.0.1:3011" + u.pathname.replace(/^\/rest\/v1/, "") + u.search;
    const h = new Headers(req.headers); h.delete("host");
    return await fetch(dst, { method: req.method, headers: h, body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer() });
  });
  env.SUPABASE_ANON_KEY = await jwt({ role: "anon" }); env.SUPABASE_SERVICE_ROLE_KEY = await jwt({ role: "service_role" });
  await psql(`insert into auth.users(id,email) values ('${U.adm}','adm@a.com'),('${U.mos}','mos@a.com'),('${U.sup}','sup@a.com'),('${U.ext}','ext@x.com'),('${U.admB}','adm@b.com') on conflict do nothing;
    select public.rave_invitar_comercio('adm@a.com','Almacén A','CODIGO-A-123'); select public.rave_invitar_comercio('adm@b.com','Comercio B','CODIGO-B-123');`);
  for (const [k, id, mail] of [["adm", U.adm, "adm@a.com"], ["mos", U.mos, "mos@a.com"], ["sup", U.sup, "sup@a.com"], ["ext", U.ext, "ext@x.com"], ["admB", U.admB, "adm@b.com"]] as const)
    T[k] = await jwt({ sub: id, email: mail, role: "authenticated" });
  let r = await rpc(T.adm, "crear_comercio", { p_nombre: "x", p_rubro: "comercio", p_codigo: "CODIGO-A-123" }); ok(r.data.ok, "alta A " + JSON.stringify(r)); cA = r.data.id;
  r = await rpc(T.admB, "crear_comercio", { p_nombre: "x", p_rubro: "comercio", p_codigo: "CODIGO-B-123" }); ok(r.data.ok, "alta B"); cB = r.data.id;
  for (const [u, mail, rol, h] of [[U.mos, "mos@a.com", "mostrador", "a1"], [U.sup, "sup@a.com", "supervisor", "a2"]] as const) {
    const hu = (h.repeat(64)).slice(0, 64);
    r = await rpc(T.adm, "invitar_miembro", { p_comercio: cA, p_email: mail, p_rol: rol, p_nombre: rol, p_huella: hu, p_llave: null }); ok(!r.data?.message, "invitar " + JSON.stringify(r.data));
    r = await rpc(await jwt({ sub: u, email: mail, role: "authenticated" }), "aceptar_invitacion", { p_huella: hu }); ok(r.data.ok, "aceptar " + JSON.stringify(r.data));
  }
  CA = nuevaCA();
}});

async function configurar(comercio: string, token: string, cond: "RI" | "MONO", cuit: string, activar: boolean) {
  const r = await rpc(token, "arca_guardar_config", { p_comercio: comercio, p_ambiente: "homologacion", p_cuit: cuit, p_razon: "Almacén de Prueba SA", p_cond: cond, p_pto: 1, p_alias: "raveprueba", p_alicuota: 21, p_activo: activar });
  return r.data;
}
async function venta(comercio: string, token: string, id: string, items: { name: string; qty: number; price: number; disc?: number; iva?: number }[]) {
  const total = items.reduce((s, i) => s + Math.round(i.qty * i.price) - (i.disc ?? 0), 0);
  const r = await rpc(token, "sincronizar", { p_comercio: comercio, p_dispositivo: "dev-test", p_cambios: [{ c: "ventas", id, d: { n: "1-" + id, total, items, method: "efectivo", doc: "factura_pendiente_cae" } }] });
  ok(r.data.aplicados === 1, "venta sincronizada " + JSON.stringify(r.data)); return total;
}
const reg = async (c: string, id: string) => JSON.parse(await psql(`select datos from public.registros where comercio_id='${c}' and coleccion='ventas' and id='${id}'`) || "null");

Deno.test({ name: "función arca · permisos, aislamiento y secretos", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  let r = await llamar(T.adm, { accion: "estado", comercio: cA }); eq(r.status, 200, "estado"); ok(r.config === null && r.servidor.llave_maestra, "sin config todavía; llave maestra presente");
  r = await llamar("x.y.z", { accion: "estado", comercio: cA }); eq(r.status, 401, "JWT inválido → 401");
  const sinAuth = await manejar(new Request("http://fn/arca", { method: "POST", body: "{}" }), env, fetchTest); eq(sinAuth.status, 401, "sin Authorization → 401");
  r = await llamar(T.ext, { accion: "estado", comercio: cA }); eq(r.status, 403, "un extraño no entra");
  r = await llamar(T.admB, { accion: "estado", comercio: cA }); eq(r.status, 403, "el admin de B no opera en A");
  r = await llamar(T.mos, { accion: "generar_csr", comercio: cA }); eq(r.status, 403, "mostrador no genera CSR");
  r = await llamar(T.sup, { accion: "cargar_cert", comercio: cA, cert: "x" }); eq(r.status, 403, "supervisor no carga certificado");
  r = await llamar(T.mos, { accion: "probar", comercio: cA }); eq(r.status, 403, "mostrador no prueba la conexión");
  r = await llamar(T.mos, { accion: "nota_credito", comercio: cA, venta_id: "x" }); eq(r.status, 403, "mostrador no emite notas de crédito");
  r = await llamar(T.adm, { accion: "inexistente", comercio: cA }); eq(r.status, 400, "acción desconocida");
  r = await llamar(T.adm, { accion: "estado", comercio: "no-es-uuid" }); eq(r.status, 400, "comercio inválido");
  const res = await manejar(new Request("http://fn/arca", { method: "OPTIONS", headers: { origin: "https://raveholding.github.io" } }), env, fetchTest); eq(res.status, 204, "CORS preflight");
  r = await llamar(T.adm, { accion: "emitir", comercio: cA, venta_id: "v0" }); ok(r.status >= 400 && /no está activada/.test(r.error), "sin activar no se factura: " + r.error);
  r = await llamar(T.adm, { accion: "generar_csr", comercio: cA }); ok(r.status === 422 && /datos del emisor/.test(r.error), "CSR exige guardar el emisor primero");
}});

Deno.test({ name: "función arca · trámite del certificado (CSR → .crt → activar)", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  let c = await configurar(cA, T.mos, "MONO", "20123456786", false); ok(c.message || c.code, "el mostrador no guarda la config");
  c = await configurar(cA, T.adm, "MONO", "20123456786", true); ok(c.ok === false && /certificado/.test(c.error), "activar sin certificado: " + JSON.stringify(c));
  c = await configurar(cA, T.adm, "MONO", "20123456786", false); ok(c.ok === true, "config guardada apagada: " + JSON.stringify(c));
  const g = await llamar(T.adm, { accion: "generar_csr", comercio: cA }); eq(g.status, 200, "CSR generado " + JSON.stringify(g).slice(0, 150)); ok(g.csr.includes("BEGIN CERTIFICATE REQUEST"), "devuelve el CSR");
  ok(!JSON.stringify(g).includes("PRIVATE KEY"), "la respuesta NO incluye clave privada");
  const db = await psql(`select key_enc, csr from public.arca_credenciales where comercio_id='${cA}'`);
  ok(!db.includes("PRIVATE KEY") && db.includes("v1."), "en la base la clave está cifrada (v1.…), no en claro");
  // certificado de OTRA clave → rechazado
  const otra = core.generarCSR({ cuit: "20123456786", razon: "Otra", alias: "otra" });
  let r = await llamar(T.adm, { accion: "cargar_cert", comercio: cA, cert: certDe(otra.csrPem, CA, 365) }); ok(r.status === 422 && /NO corresponde/.test(r.error), "certificado de otra clave: " + r.error);
  r = await llamar(T.adm, { accion: "cargar_cert", comercio: cA, cert: certDe(g.csr, CA, 10, Date.now() - 30 * 86400_000) }); ok(r.status === 422 && /vencido/.test(r.error), "vencido: " + r.error);
  r = await llamar(T.adm, { accion: "cargar_cert", comercio: cA, cert: "basura" }); eq(r.status, 422, "basura");
  r = await llamar(T.adm, { accion: "cargar_cert", comercio: cA, cert: certDe(g.csr, CA, 365) }); eq(r.status, 200, "certificado correcto " + JSON.stringify(r)); ok(r.vence, "muestra el vencimiento");
  r = await llamar(T.adm, { accion: "generar_csr", comercio: cA }); ok(r.status === 422 && /Ya hay un certificado/.test(r.error), "no pisa un certificado sin confirmación");
  const e = await llamar(T.mos, { accion: "estado", comercio: cA }); ok(e.credenciales.tiene_cert && !JSON.stringify(e).includes("PRIVATE"), "estado visible para el mostrador, sin secretos");
  r = await llamar(T.adm, { accion: "probar", comercio: cA }); ok(r.ok === true && r.pasos.length === 4, "probar conexión: " + JSON.stringify(r)); ok(arca.logins === 1, "un solo login WSAA");
  ok(!JSON.stringify(r).includes("TOKEN-"), "no filtra el token de ARCA");
  const dbTa = await psql(`select ta_enc from public.arca_credenciales where comercio_id='${cA}'`); ok(dbTa.startsWith("v1.") && !dbTa.includes("TOKEN"), "el ticket se guarda cifrado");
  c = await configurar(cA, T.adm, "MONO", "20123456786", true); ok(c.ok === true, "ahora sí se activa: " + JSON.stringify(c));
}});

Deno.test({ name: "función arca · emitir Factura C: CAE, idempotencia y venta actualizada", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const tot = await venta(cA, T.mos, "v1", [{ name: "Fernet", qty: 2, price: 12100 }, { name: "Hielo", qty: 1, price: 2500 }]);
  const antes = arca.solicitudes;
  const r = await llamar(T.mos, { accion: "emitir", comercio: cA, venta_id: "v1" });
  ok(r.status === 200 && r.estado === "aprobado", "aprobada " + JSON.stringify(r)); eq([r.tipo, r.letra, r.pto, r.nro], [11, "C", 1, 1], "Factura C 0001-00000001");
  ok(/^\d{14}$/.test(r.cae) && r.vto === "2026-10-22", "CAE y vencimiento"); eq(r.total, tot, "total"); eq(r.iva, 0, "monotributo no discrimina IVA"); ok(r.qr.startsWith("https://"), "QR fiscal");
  const sol = arca.emitidos.at(-1)!; ok(sol.req.includes("<CondicionIVAReceptorId>5</CondicionIVAReceptorId>") && sol.req.includes("<DocTipo>99</DocTipo>"), "consumidor final");
  const v = await reg(cA, "v1"); eq(v.arca.cae, r.cae, "la venta guardó el CAE"); eq(v.arca.nro, 1, "nº en la venta");
  const r2 = await llamar(T.mos, { accion: "emitir", comercio: cA, venta_id: "v1" }); ok(r2.ya === true && r2.cae === r.cae, "emitir de nuevo devuelve el mismo CAE");
  eq(arca.solicitudes, antes + 1, "ARCA recibió UNA sola solicitud");
  const r3 = await llamar(T.mos, { accion: "emitir", comercio: cA, venta_id: "no-existe" }); ok(r3.status === 422 && /todavía no llegó/.test(r3.error), "venta inexistente: " + r3.error);
  // el navegador no puede pisar el CAE
  await rpc(T.mos, "sincronizar", { p_comercio: cA, p_dispositivo: "d", p_cambios: [{ c: "ventas", id: "v1", d: { total: 1, items: [], arca: { cae: "FALSO" } } }] });
  const v2 = await reg(cA, "v1"); eq([v2.arca.cae, v2.total], [r.cae, tot], "CAE y total no se pisan desde el navegador");
  // inmutabilidad en la base (aún con rol de servicio)
  const up = await fetch(`${URL_BASE}/rest/v1/arca_comprobantes?venta_id=eq.v1`, { method: "PATCH", headers: { Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, apikey: env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json" }, body: JSON.stringify({ cae: "OTRO" }) });
  ok(up.status >= 400, "la base rechaza modificar un comprobante con CAE (" + up.status + ")");
  // total que no cierra con los ítems
  await psql(`update public.registros set datos = jsonb_set(datos,'{total}','1') where comercio_id='${cA}' and coleccion='ventas' and id='v1'`);
  await venta(cA, T.mos, "v-mal", [{ name: "X", qty: 1, price: 1000 }]);
  await psql(`update public.registros set datos = jsonb_set(datos,'{total}','999') where comercio_id='${cA}' and coleccion='ventas' and id='v-mal'`);
  const rm = await llamar(T.mos, { accion: "emitir", comercio: cA, venta_id: "v-mal" }); ok(rm.status === 422 && /no coincide/.test(rm.error), "total adulterado se rechaza: " + rm.error);
}});

Deno.test({ name: "función arca · concurrencia: numeración correlativa sin saltos ni repetidos", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const ids = Array.from({ length: 8 }, (_, i) => "c" + i);
  for (const id of ids) await venta(cA, T.mos, id, [{ name: "P", qty: 1, price: 1000 + ids.indexOf(id) * 100 }]);
  const base = arca.emitidos.filter((e) => e.tipo === 11).length;
  const rs = await Promise.all(ids.map((id) => llamar(T.mos, { accion: "emitir", comercio: cA, venta_id: id })));
  ok(rs.every((r) => r.status === 200), "todas respondieron: " + JSON.stringify(rs.map((r) => r.estado ?? r.error)));
  for (let i = 0; i < 6 && ids.some((id) => !arca.emitidos.some((e) => e.req.includes(`<ImpTotal>${(((1000 + ids.indexOf(id) * 100)) / 100).toFixed(2)}</ImpTotal>`))); i++) {
    await llamar(T.mos, { accion: "reintentar", comercio: cA }); relojOffset += 120_000;
  }
  for (let i = 0; i < 6; i++) { const pend = await psql(`select count(*) from public.arca_comprobantes where comercio_id='${cA}' and estado<>'aprobado'`); if (pend === "0") break; relojOffset += 120_000; await llamar(T.mos, { accion: "reintentar", comercio: cA }); }
  const nums = arca.emitidos.filter((e) => e.tipo === 11).map((e) => e.nro).sort((a, b) => a - b);
  eq(nums, Array.from({ length: base + ids.length }, (_, i) => i + 1), "números 1..N sin saltos ni repetidos");
  const db = await psql(`select count(*), count(distinct numero) from public.arca_comprobantes where comercio_id='${cA}' and estado='aprobado' and tipo=11`);
  const [n, d] = db.split("|").map(Number); eq(n, d, "ningún número repetido en la base"); ok(n >= ids.length, "todas aprobadas en la base");
  // la misma venta 6 veces en paralelo → UNA solicitud a ARCA
  await venta(cA, T.mos, "dup", [{ name: "Z", qty: 1, price: 7777 }]);
  const antes = arca.solicitudes;
  const rd = await Promise.all(Array.from({ length: 6 }, () => llamar(T.mos, { accion: "emitir", comercio: cA, venta_id: "dup" })));
  ok(rd.every((r) => r.status === 200), "sin errores");
  await llamar(T.mos, { accion: "reintentar", comercio: cA });
  eq(arca.solicitudes - antes, 1, "6 pedidos simultáneos de la misma venta → 1 sola solicitud a ARCA");
  eq(arca.emitidos.filter((e) => e.req.includes("<ImpTotal>77.77</ImpTotal>")).length, 1, "un solo comprobante emitido por ARCA");
}});

Deno.test({ name: "función arca · ticket de acceso: una sola autenticación aunque haya pedidos en paralelo", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  await psql(`update public.arca_credenciales set ta_enc=null, ta_vence=null where comercio_id='${cA}'`); arca.taVence = 0;
  const l0 = arca.logins;
  const ids = ["t0", "t1", "t2", "t3"]; for (const id of ids) await venta(cA, T.mos, id, [{ name: "P", qty: 1, price: 3000 + ids.indexOf(id) }]);
  await Promise.all(ids.map((id) => llamar(T.mos, { accion: "emitir", comercio: cA, venta_id: id })));
  for (let i = 0; i < 6; i++) { relojOffset += 120_000; await llamar(T.mos, { accion: "reintentar", comercio: cA }); }
  ok(arca.logins - l0 <= 1, "WSAA: un solo login (ARCA no deja pedir otro ticket mientras haya uno válido): " + (arca.logins - l0));
  const pend = await psql(`select count(*) from public.arca_comprobantes where comercio_id='${cA}' and venta_id in ('t0','t1','t2','t3') and estado='aprobado'`); eq(pend, "4", "las 4 quedaron aprobadas");
}});

Deno.test({ name: "función arca · cortes de red: la respuesta se pierde después de autorizar", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  await venta(cA, T.mos, "corte", [{ name: "P", qty: 1, price: 4321 }]);
  const emitidosAntes = arca.emitidos.length; arca.cortarDespuesDeAprobar = 1;
  let r = await llamar(T.mos, { accion: "emitir", comercio: cA, venta_id: "corte" });
  ok(r.status === 200 && r.estado === "pendiente", "la red falló: queda pendiente, NO se informa como aprobada: " + JSON.stringify(r));
  eq(arca.emitidos.length, emitidosAntes + 1, "ARCA sí lo había autorizado");
  let v = await reg(cA, "corte"); ok(!v.arca?.cae, "la venta todavía no muestra CAE");
  relojOffset += 3 * 3600_000;
  r = await llamar(T.mos, { accion: "reintentar", comercio: cA }); ok(r.resultados.some((x: any) => x.venta_id === "corte" && x.estado === "aprobado"), "el reintento lo recupera: " + JSON.stringify(r));
  eq(arca.emitidos.length, emitidosAntes + 1, "NO se pidió un segundo CAE (se recuperó el que ya existía)");
  v = await reg(cA, "corte"); ok(/^\d{14}$/.test(v.arca.cae), "la venta ahora tiene su CAE"); eq(v.arca.cae, arca.emitidos.at(-1)!.cae, "es el CAE que ARCA emitió");
  // ARCA caído
  await venta(cA, T.mos, "caido", [{ name: "P", qty: 1, price: 1500 }]); arca.modo = "caido";
  r = await llamar(T.mos, { accion: "emitir", comercio: cA, venta_id: "caido" }); ok(r.status === 200 && r.estado === "pendiente" && r.reintento_en_seg > 0, "ARCA caído → pendiente con reintento: " + JSON.stringify(r));
  arca.modo = "ok"; relojOffset += 3 * 3600_000;
  r = await llamar(T.mos, { accion: "reintentar", comercio: cA }); ok(r.resultados.some((x: any) => x.venta_id === "caido" && x.estado === "aprobado"), "cuando vuelve ARCA, se emite");
  // rechazo
  await venta(cA, T.mos, "rech", [{ name: "P", qty: 1, price: 1600 }]); arca.modo = "rechazar";
  r = await llamar(T.mos, { accion: "emitir", comercio: cA, venta_id: "rech" }); ok(r.estado === "rechazado" && /10015/.test(r.error), "rechazo con motivo entendible: " + JSON.stringify(r));
  v = await reg(cA, "rech"); eq(v.arca.estado, "rechazado", "la venta refleja el rechazo"); ok(!v.arca.cae, "sin CAE");
  arca.modo = "ok";
  const re = await llamar(T.mos, { accion: "reintentar", comercio: cA }); ok(!re.resultados.some((x: any) => x.venta_id === "rech"), "un rechazo no se reintenta solo");
}});

Deno.test({ name: "función arca · nota de crédito (solo admin) y Responsable Inscripto con Factura A/B", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  // NC sobre la venta v1 (Factura C)
  let r = await llamar(T.adm, { accion: "nota_credito", comercio: cA, venta_id: "v1" });
  ok(r.status === 200 && r.estado === "aprobado" && r.tipo === 13, "NC C aprobada: " + JSON.stringify(r));
  const nc = arca.emitidos.at(-1)!; ok(nc.tipo === 13 && nc.asoc, "la NC lleva el comprobante asociado"); eq(nc.total, 12100 * 2 + 2500, "mismo importe que la factura");
  const asoc = core.parseXml(nc.req).Envelope.Body.FECAESolicitar.FeCAEReq.FeDetReq.FECAEDetRequest.CbtesAsoc.CbteAsoc; eq([Number(asoc.Tipo), Number(asoc.PtoVta), Number(asoc.Nro)], [11, 1, 1], "asociada a 11-0001-00000001");
  const v = await reg(cA, "v1"); eq(v.arcaNC.tipo, 13, "la venta guarda arcaNC"); ok(v.arca.cae, "y conserva el CAE de la factura");
  r = await llamar(T.adm, { accion: "nota_credito", comercio: cA, venta_id: "v1" }); ok(r.ya === true, "segunda NC: devuelve la misma, no emite otra");
  r = await llamar(T.adm, { accion: "nota_credito", comercio: cA, venta_id: "dup2" }); ok(r.status === 422 && /no tiene una factura/.test(r.error), "sin factura no hay NC: " + r.error);
  // Responsable Inscripto (comercio B): A para RI, B para consumidor final
  const adminB = T.admB;
  let c = await configurar(cB, adminB, "RI", "30712345671", false); ok(c.ok, "config B " + JSON.stringify(c));
  const g = await llamar(adminB, { accion: "generar_csr", comercio: cB }); eq(g.status, 200, "CSR B");
  r = await llamar(adminB, { accion: "cargar_cert", comercio: cB, cert: certDe(g.csr, CA, 365) }); eq(r.status, 200, "cert B");
  c = await configurar(cB, adminB, "RI", "30712345671", true); ok(c.ok, "activar B");
  arca.taVence = 0; // otro comercio = otro ticket
  await venta(cB, adminB, "b1", [{ name: "Vino", qty: 3, price: 9999, iva: 21 }, { name: "Pan", qty: 2, price: 1050, iva: 10.5 }]);
  r = await llamar(adminB, { accion: "emitir", comercio: cB, venta_id: "b1" });
  ok(r.status === 200 && r.estado === "aprobado", "B final aprobada " + JSON.stringify(r)); eq([r.tipo, r.letra], [6, "B"], "RI → consumidor final = Factura B"); eq(r.neto + r.iva, r.total, "neto + IVA = total");
  await venta(cB, adminB, "b2", [{ name: "Vino", qty: 1, price: 12100 }]);
  r = await llamar(adminB, { accion: "emitir", comercio: cB, venta_id: "b2", receptor: { docTipo: 80, docNro: "30-50001091-2", condIva: 1, nombre: "Cliente SA" } });
  ok(r.status === 422 || r.estado, "receptor con CUIT: " + JSON.stringify(r));
  r = await llamar(adminB, { accion: "emitir", comercio: cB, venta_id: "b2", receptor: { docTipo: 80, docNro: "30500010912", condIva: 1, nombre: "Cliente SA" } });
  ok(r.estado === "aprobado" && r.letra === "A", "RI → RI = Factura A: " + JSON.stringify(r)); eq([r.neto, r.iva], [10000, 2100], "A discrimina IVA 100,00 + 21,00");
  const ra = arca.emitidos.at(-1)!; ok(ra.req.includes("<DocTipo>80</DocTipo>") && ra.req.includes("<CondicionIVAReceptorId>1</CondicionIVAReceptorId>"), "documento y condición del receptor");
  // aislamiento: A no puede emitir ventas de B ni B las de A
  r = await llamar(T.adm, { accion: "emitir", comercio: cA, venta_id: "b1" }); ok(r.status === 422, "el comercio A no ve ventas de B: " + r.error);
  const cross = await psql(`select count(*) from public.arca_comprobantes where comercio_id='${cA}' and venta_id in ('b1','b2')`); eq(cross, "0", "nada de B en los comprobantes de A");
  // los secretos de un comercio no abren los del otro
  const keyA = await psql(`select key_enc from public.arca_credenciales where comercio_id='${cA}'`);
  await psql(`update public.arca_credenciales set key_enc='${keyA}', ta_enc=null, ta_vence=null where comercio_id='${cB}'`); arca.taVence = 0;
  r = await llamar(adminB, { accion: "probar", comercio: cB }); ok(r.ok === false || r.status >= 400, "clave de otro comercio copiada no se puede abrir (AAD ata la clave al comercio)");
}});

Deno.test({ name: "función arca · limpieza", sanitizeOps: false, sanitizeResources: false, fn: async () => { await proxy.shutdown(); } });
