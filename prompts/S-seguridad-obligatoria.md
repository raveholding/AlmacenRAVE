# S · ANEXO DE SEGURIDAD OBLIGATORIO (todos los sistemas Vincular Business)

> Se aplica a los prompts 1, 2, 3 y 4. **Manda sobre el diseño y los plazos.** Trabajamos con datos personales, financieros, fiscales, laborales, imágenes de cámaras y accesos físicos de clientes: un error de seguridad es un error del negocio.

## 0. Principio rector (heredado de raveV3)
Jerarquía innegociable: **1) integridad de datos y operaciones · 2) seguridad · 3) exactitud · 4) estabilidad y compatibilidad · 5) prevención y recuperación de errores · 6) calidad del software · 7) rendimiento · 8) experiencia de usuario · 9) calidad visual.**
No suponer ni inventar (funciones, tablas, datos, integraciones). Validar antes de implementar. Ante una inconsistencia: detener lo afectado, corregir, volver a probar, documentar. **Un trabajo está terminado cuando funciona, está validado, es seguro y hay evidencia**, no cuando se ve bien. Publicar a producción sólo con autorización expresa del dueño.

## 1. Objetivo y estándar
- Meta: **OWASP ASVS 5.0 nivel 2** en toda la plataforma y **nivel 3** en autenticación, manejo de llaves, pagos, fiscal y seguridad física. OWASP Top 10 (web y API) y MASVS para la PWA.
- **Modelo de amenazas por módulo** (STRIDE) en `docs/seguridad/amenazas-<módulo>.md` antes de programarlo: activos, actores (cliente final, cajero, supervisor, administrador, soporte VB, atacante externo, empleado desleal, equipo robado), superficies y mitigaciones.

## 2. Identidad y sesiones
- Supabase Auth: correo + contraseña (mín. 10, verificada contra listas de contraseñas filtradas), **Google (OAuth con PKCE)** y **passkeys/WebAuthn**; **2FA obligatorio** (TOTP o passkey) para administradores, contadores y soporte.
- Bloqueo progresivo por intentos, mensajes que no distinguen «usuario inexistente» de «clave incorrecta», CAPTCHA (Turnstile, gratis) en formularios públicos.
- Sesiones cortas con refresco rotativo, cierre remoto por dispositivo, lista de equipos de confianza, reautenticación para acciones críticas.
- **Recuperación sin soporte inseguro:** restablecer acceso del equipo por el administrador (clave temporal y llave re-envuelta en el navegador), código de recuperación del administrador, custodia opcional de llave con Google (Edge Function con secreto propio). Soporte de VB nunca ve datos ni llaves.

## 3. Autorización y multi-tenant
- **RBAC + alcance** (comercio → sucursal → caja/depósito) y permisos por acción (por ejemplo `price.change`, `sale.void`, `cash.close`, `stock.adjust`, `user.manage`).
- **RLS en TODAS las tablas, vistas, funciones, storage, colas y webhooks**, con `tenant_id` y claves foráneas compuestas `(id, tenant_id)`. Funciones `security definer` con `search_path` fijo y chequeo de rol adentro.
- **Prueba cruzada obligatoria A/B**: el comercio A no lee, cuenta, busca, descarga ni modifica nada del B (pgTAP), también por sucursal.
- El servidor **recalcula** precios, descuentos, recargos, totales, stock, crédito e impuestos: nunca confía en el navegador.
- **Doble control** (cuatro ojos) configurable para anulaciones, ajustes de stock, cambios de precio masivos, cierres con diferencia, permisos y borrados.

## 4. Cifrado y llaves
- **Datos personales y sensibles cifrados en el navegador** (AES-256-GCM): la llave de datos (DEK) del comercio, envuelta por usuario con PBKDF2-SHA256 ≥ 600.000 o Argon2id (WASM), con copia envuelta por código de recuperación. Compatible con el formato actual para migrar.
- Clasificación de datos: pública / interna / confidencial / sensible / crítica; cada campo del esquema lleva su clase.
- En tránsito: TLS 1.2+, HSTS con preload. En reposo: cifrado del proveedor + cifrado de aplicación para lo sensible.
- **Secretos sólo en el servidor** (Supabase Vault / secretos de Edge Functions / gestor de secretos del hosting): tokens de Mercado Pago, Tiendanube, PedidosYa, Telegram, WhatsApp, certificados ARCA, claves de cámaras y grabadores. Nada `NEXT_PUBLIC_` salvo URL y clave publicable. Rotación y revocación documentadas.
- **Certificados ARCA** (sv.arca.sdk): llave privada cifrada por tenant, nunca exportable al navegador, uso sólo desde la Edge Function, alerta de vencimiento.

## 5. Aplicación web
- Validación con **zod** en cliente Y servidor; consultas parametrizadas; escape de todo dato (incluido OCR, IA, QR, nombres, colores); URLs por esquema y dominio permitido.
- **CSP estricta con nonces** (Next.js), `frame-ancestors 'none'`, SRI, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (cámara, NFC, USB sólo donde se usan), COOP/CORP.
- CSRF en Server Actions y formularios; CORS por lista; protección contra IDOR (identificadores no enumerables, siempre con chequeo de tenant).
- **Rate limiting** en login, alta al Club, pedidos públicos, sellos por chip, webhooks y API.
- **Idempotencia** en ventas, cobros, CAE, webhooks y sincronización offline (clave idempotente por operación).
- Webhooks entrantes **firmados (HMAC) y re-consultados** al proveedor antes de actuar; nunca crean ventas solos.
- Archivos: tipo y tamaño validados, sin ejecución, URLs firmadas y expirables, antivirus opcional.

## 6. Auditoría, integridad y registros
- **Auditoría append-only con hash encadenado** (quién, qué, cuándo, desde dónde, valor anterior y nuevo), verificable y exportable; nadie puede borrarla (ni el administrador).
- Cierres de caja, arqueos y documentos fiscales **sellados** (hash) e inmutables; correcciones sólo con contra-asiento.
- Logs técnicos sin contraseñas, tokens ni datos personales; retención definida; alertas de eventos de seguridad (ingresos raros, muchos fallos, cambios de permisos) por Telegram/correo.

## 7. Datos personales y cumplimiento (Argentina)
- **Ley 25.326 de Protección de Datos Personales** y normativa de la AAIP: finalidad, consentimiento por propósito y canal, derecho de acceso, rectificación y supresión (con flujo en el sistema), registro de bases `[VERIFICAR con asesor legal]`, plazos de conservación.
- Datos laborales (RR. HH.), de salud y biometría: acceso mínimo, cifrado, registro de accesos. **La biometría no se guarda en la nube** (verificación local; sólo identificador).
- **Ley 25.065** (recargos con tarjeta) y normas de Defensa del Consumidor en precios y avisos; normas ARCA de facturación y conservación de comprobantes (10 años).
- Contratos con los clientes de VB: responsable/encargado de datos, acceso de soporte, ARCA (claves y certificados), cámaras.

## 8. Pagos
- Fuera del alcance PCI: **nunca** se guarda número de tarjeta, CVV ni PIN; sólo últimos 4, marca, lote y cupón. Cobros online por el proveedor (Mercado Pago) con orden creada en el servidor, sandbox separado y conciliación.

## 9. IA y asistentes (Centro inteligente, R2AVE, lectura de facturas, bots)
- El contenido de documentos, mensajes y voz es **dato no confiable** (anti prompt injection); salida con esquema JSON estricto.
- Cada herramienta vuelve a chequear RBAC, RLS, tenant y sucursal; la respuesta del modelo **no es autorización**. Acciones que modifican datos: apagadas por defecto, con confirmación humana ligada al identificador exacto de la operación, idempotentes y auditadas.
- Datos mínimos y anonimizados hacia el proveedor de IA, tope de gasto por tenant, registro de cada consulta, sin exponer el prompt interno.

## 10. Seguridad física y dispositivos
- Cámaras, grabadores, cerraduras y relés: credenciales **sólo en el gateway local** (la base guarda una referencia, nunca la clave); video por WebRTC cifrado; acceso al video con permiso específico y auditoría de cada visualización.
- Agente local (impresoras, balanza, cámaras, cerraduras) **sólo en 127.0.0.1**, emparejamiento de un solo uso, orígenes en lista blanca, mensajes firmados, actualizaciones firmadas.
- Firmware ESP32: actualizaciones firmadas, clave única por equipo, sin credenciales por defecto (PIN de fábrica obligatorio de cambiar).
- PIN de coacción y SOS: eventos sólo-agregar, aviso silencioso, probado en simulación.

## 11. Cadena de suministro y CI/CD
- `pnpm` con lockfile y `--frozen-lockfile`; **Dependabot/Renovate**; `pnpm audit` y **OSV-Scanner** en CI; **CodeQL** y **secret scanning** de GitHub (gratis en repos públicos; push protection activado); SBOM (CycloneDX) por release.
- Ramas protegidas, PR con revisión, firmas de commits, entornos separados (dev / staging / producción) con proyectos de Supabase separados y datos de prueba (nunca datos reales en dev).
- Migraciones aditivas, versionadas, idempotentes y probadas sobre copia; plan de reversión por migración.

## 12. Continuidad
- Respaldos automáticos del proveedor + **PITR** en producción + respaldo cifrado del comercio descargable; **simulacro de restauración** trimestral documentado.
- Objetivos: RPO ≤ 15 min (nube), RTO ≤ 4 h; el POS sigue vendiendo sin internet.
- **Plan de respuesta a incidentes**: detección, contención, revocación de llaves y tokens, aviso a clientes y a la AAIP si corresponde `[VERIFICAR]`, informe posterior.

## 13. Pruebas de seguridad (criterio de aceptación de cada fase)
- pgTAP: RLS A/B en cada tabla nueva, funciones con roles incorrectos, montos y estados inválidos.
- Playwright: XSS en todos los campos de texto, IDOR cambiando identificadores, CSRF, sesiones vencidas, permisos por rol, flujo offline con conflicto.
- Escaneo **OWASP ZAP** (baseline) en CI sobre staging; Lighthouse/axe para accesibilidad.
- Antes de producción: revisión de seguridad independiente (otro agente o persona que no escribió el código) con checklist ASVS y evidencia.
