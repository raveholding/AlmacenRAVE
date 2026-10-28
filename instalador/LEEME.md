# Instalador de Windows · Almacén RAVE (V26.30)

**Archivos:** `AlmacenRAVE-Instalador-64bits.exe` (Windows 10/11 de 64 bits, el habitual) y `AlmacenRAVE-Instalador-32bits.exe` (Windows 10 de 32 bits). Windows 7/8 no tienen soporte. Huellas SHA-256 en `SHA256SUMS.txt`.

## Qué hace
- Se instala **sin permisos de administrador** en `%LOCALAPPDATA%\AlmacenRAVE` y crea accesos en el Escritorio y en Inicio → *Almacén RAVE* (abrir, **Buscar actualización**, **Desinstalar**). Aparece en «Aplicaciones instaladas» de Windows.
- Abre el sistema en una ventana propia de **Chrome o Edge** (perfil aparte: `…\AlmacenRAVE\perfil`) servida desde `http://127.0.0.1:47123/` (sólo este equipo; responde sólo a 127.0.0.1/localhost, sólo GET, sin listar carpetas). Así funciona **sin internet** con la última versión guardada y el ingreso con Google puede volver al programa.
- **Se actualiza solo** al abrir (4 s de espera máxima): baja la versión publicada y la usa **sólo si valida** (variante «cliente», nube de Almacén RAVE, archivo completo, sin claves secretas). Guarda la versión anterior (`app\index.prev.html`); si algo se daña vuelve a la anterior o a la incluida en el instalador.
- Instalar encima de una instalación anterior **conserva todo**: nunca toca la carpeta `perfil`.
- Desinstalar pregunta dos veces; por defecto **NO borra los datos** del equipo (y los datos del comercio están en la nube).

## Antes de instalar (para que no se pierda nada)
1. En el navegador donde usan el sistema hoy, abrir **Nube** y comprobar que diga **Sincronizado** (0 pendientes). Las ventas hechas sin internet que todavía no subieron sólo existen en ese navegador.
2. Instalar. Abrir *Almacén RAVE* e **ingresar con el correo y la contraseña de siempre** (o con Google): el sistema baja todos los datos de la nube.
3. La primera vez el sistema pide el **número de caja** del equipo si ya está usado: usar el mismo número que tenía ese equipo.

## Windows SmartScreen
El instalador **no está firmado digitalmente** (requiere un certificado de firma de código pago). Windows puede mostrar «Windows protegió su PC»: tocar **Más información → Ejecutar de todas formas**. Verificar antes la huella SHA-256 con `certutil -hashfile AlmacenRAVE-Instalador-64bits.exe SHA256`.

## Construcción (desarrollador)
`./construir.sh` (Go 1.24 + `rsrc` para ícono y manifiesto). Embebe `../index.html` (la versión «cliente» publicada) y falla si no valida. Pruebas: `go test ./...`.

Desarrollado por **VINCULAR BUSINESS** · (387) 4484132 · vincularbusiness@gmail.com · «Tu idea, en buenas manos.»
