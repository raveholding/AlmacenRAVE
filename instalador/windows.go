//go:build windows

package main

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unicode/utf16"
	"unsafe"
)

var (
	user32      = syscall.NewLazyDLL("user32.dll")
	pMessageBox = user32.NewProc("MessageBoxW")
)

const (
	mbOK       = 0x0
	mbYesNo    = 0x4
	mbIconInfo = 0x40
	mbIconWarn = 0x30
	mbIconQ    = 0x20
	mbDefBtn2  = 0x100
	idYes      = 6
)

func caja(texto string, flags uintptr) int {
	t, _ := syscall.UTF16PtrFromString(texto)
	c, _ := syscall.UTF16PtrFromString(appName)
	r, _, _ := pMessageBox.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), flags|0x10000 /*MB_SETFOREGROUND*/)
	return int(r)
}
func aviso(t string)       { caja(t, mbOK|mbIconInfo) }
func error_(t string)      { caja(t, mbOK|mbIconWarn) }
func pregunta(t string, porDefectoNo bool) bool {
	f := uintptr(mbYesNo | mbIconQ)
	if porDefectoNo {
		f |= mbDefBtn2
	}
	return caja(t, f) == idYes
}

func oculto(c *exec.Cmd) *exec.Cmd {
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return c
}

// powershell con el script en UTF-16 (sin problemas de tildes ni comillas)
func ps(script string) error {
	u := utf16.Encode([]rune(script))
	b := make([]byte, len(u)*2)
	for i, v := range u {
		b[2*i], b[2*i+1] = byte(v), byte(v>>8)
	}
	return oculto(exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", base64.StdEncoding.EncodeToString(b))).Run()
}
func psq(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }

func exeInstalado() string { return filepath.Join(dirApp(), "AlmacenRAVE.exe") }
func dirMenu() string {
	return filepath.Join(os.Getenv("APPDATA"), `Microsoft\Windows\Start Menu\Programs`, appName)
}

func accesos() error {
	exe := exeInstalado()
	mk := func(lnk, args, desc string) string {
		return fmt.Sprintf(`$s=$w.CreateShortcut(%s);$s.TargetPath=%s;$s.Arguments=%s;$s.WorkingDirectory=%s;$s.IconLocation=%s;$s.Description=%s;$s.Save();`,
			psq(lnk), psq(exe), psq(args), psq(dirApp()), psq(exe+",0"), psq(desc))
	}
	esc := filepath.Join(os.Getenv("USERPROFILE"), "Desktop")
	sc := `$w=New-Object -ComObject WScript.Shell;$d=[Environment]::GetFolderPath('Desktop');New-Item -ItemType Directory -Force -Path ` + psq(dirMenu()) + ` | Out-Null;` +
		strings.Replace(mk(filepath.Join(esc, appName+".lnk"), "--abrir", "Abrir el Sistema "+appName), psq(filepath.Join(esc, appName+".lnk")), `(Join-Path $d '`+appName+`.lnk')`, 1) +
		mk(filepath.Join(dirMenu(), appName+".lnk"), "--abrir", "Abrir el Sistema "+appName) +
		mk(filepath.Join(dirMenu(), "Buscar actualización.lnk"), "--actualizar", "Bajar la última versión publicada") +
		mk(filepath.Join(dirMenu(), "Desinstalar "+appName+".lnk"), "--desinstalar", "Quitar el programa de este equipo")
	return ps(sc)
}

func registrar() {
	k := `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\AlmacenRAVE`
	set := func(n, t, v string) { _ = oculto(exec.Command("reg", "add", k, "/v", n, "/t", t, "/d", v, "/f")).Run() }
	set("DisplayName", "REG_SZ", appName)
	set("DisplayIcon", "REG_SZ", exeInstalado()+",0")
	set("DisplayVersion", "REG_SZ", version)
	set("Publisher", "REG_SZ", publisher)
	set("UninstallString", "REG_SZ", `"`+exeInstalado()+`" --desinstalar`)
	set("InstallLocation", "REG_SZ", dirApp())
	set("HelpLink", "REG_SZ", "https://wa.me/5493874484132")
	set("NoModify", "REG_DWORD", "1")
	set("NoRepair", "REG_DWORD", "1")
}

func copiar(src, dst string) error {
	b, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	tmp := dst + ".nuevo"
	if err := os.WriteFile(tmp, b, 0o755); err != nil {
		return err
	}
	os.Remove(dst + ".viejo")
	if _, err := os.Stat(dst); err == nil {
		if err := os.Rename(dst, dst+".viejo"); err != nil {
			return fmt.Errorf("cerrá el sistema y volvé a intentar (%v)", err)
		}
	}
	return os.Rename(tmp, dst)
}

func instalar() {
	yo, _ := os.Executable()
	if strings.EqualFold(filepath.Clean(yo), filepath.Clean(exeInstalado())) {
		abrir()
		return
	}
	actualizando := false
	if _, err := os.Stat(exeInstalado()); err == nil {
		actualizando = true
	}
	msg := "Se va a instalar " + appName + " en este equipo (sin permisos de administrador).\n\nDesarrollado por VINCULAR BUSINESS · (387) 4484132.\n\n¿Continuar?"
	if actualizando {
		msg = appName + " ya está instalado. Se actualiza el programa y se CONSERVAN todos los datos de este equipo.\n\n¿Continuar?"
	}
	if !pregunta(msg, false) {
		return
	}
	if err := os.MkdirAll(dirApp(), 0o755); err != nil {
		error_("No se pudo crear la carpeta del programa: " + err.Error())
		return
	}
	if err := copiar(yo, exeInstalado()); err != nil {
		error_("No se pudo copiar el programa: " + err.Error())
		return
	}
	// versión del sistema: la publicada si se puede bajar y valida; si no, la incluida en el instalador
	if _, _, err := bajarUltima(15 * time.Second); err != nil {
		if e2 := asegurarHTML(); e2 != nil {
			error_("No se pudo preparar el sistema: " + e2.Error())
			return
		}
	}
	if err := accesos(); err != nil {
		error_("El programa quedó instalado, pero no se pudieron crear los accesos directos: " + err.Error())
	}
	registrar()
	aviso("Listo. " + appName + " quedó instalado.\n\nAbrilo desde el ícono del Escritorio o del menú Inicio.\n\nLos datos están en la nube: ingresá con tu correo y contraseña (o con Google) y se bajan solos.")
	_ = oculto(exec.Command(exeInstalado(), "--abrir")).Start()
}

func navegador() (string, bool) {
	pf, pf86, la := os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)"), os.Getenv("LOCALAPPDATA")
	for _, p := range []string{
		filepath.Join(pf, `Google\Chrome\Application\chrome.exe`), filepath.Join(pf86, `Google\Chrome\Application\chrome.exe`), filepath.Join(la, `Google\Chrome\Application\chrome.exe`),
		filepath.Join(pf86, `Microsoft\Edge\Application\msedge.exe`), filepath.Join(pf, `Microsoft\Edge\Application\msedge.exe`), filepath.Join(la, `Microsoft\Edge\Application\msedge.exe`),
	} {
		if p != "" {
			if _, err := os.Stat(p); err == nil {
				return p, true
			}
		}
	}
	return "", false
}

func perfil() string { return filepath.Join(dirApp(), "perfil") }

// sigueAbierto: el navegador mantiene «lockfile» abierto en exclusiva mientras la ventana existe
func sigueAbierto() bool {
	f, err := os.OpenFile(filepath.Join(perfil(), "lockfile"), os.O_RDWR, 0)
	if err != nil {
		return !os.IsNotExist(err)
	}
	f.Close()
	return false
}

func abrir() {
	_ = asegurarHTML()
	// actualización rápida (4 s): si no hay internet, se abre la versión guardada
	_, _, _ = bajarUltima(4 * time.Second)
	srv, yaEstaba, err := servir()
	if err != nil {
		error_("No se pudo abrir el sistema: " + err.Error() + ".\nReiniciá el equipo y probá de nuevo.")
		return
	}
	nav, ok := navegador()
	if !ok {
		_ = oculto(exec.Command("rundll32", "url.dll,FileProtocolHandler", urlLocal())).Start()
		if yaEstaba {
			return
		}
		time.Sleep(16 * time.Hour)
		return
	}
	_ = os.MkdirAll(perfil(), 0o755)
	c := exec.Command(nav, "--app="+urlLocal(), "--user-data-dir="+perfil(), "--no-first-run", "--no-default-browser-check", "--disable-sync", "--window-size=1280,860")
	if err := c.Start(); err != nil {
		error_("No se pudo abrir el navegador: " + err.Error())
		return
	}
	if yaEstaba || srv == nil {
		return
	}
	_ = c.Wait()
	time.Sleep(20 * time.Second)
	for sigueAbierto() {
		time.Sleep(10 * time.Second)
	}
	_ = srv.Close()
}

func actualizar() {
	ver, cambio, err := bajarUltima(30 * time.Second)
	switch {
	case err != nil:
		error_("No se pudo actualizar: " + err.Error() + "\n\nSe sigue usando la versión que ya estaba (no se perdió nada).")
	case cambio:
		aviso("Actualizado a la versión " + ver + ". Si el sistema estaba abierto, cerralo y volvé a abrirlo.")
	default:
		aviso("Ya tenés la última versión (" + ver + ").")
	}
}

func desinstalar() {
	if !pregunta("¿Quitar "+appName+" de este equipo?\n\nLos datos del comercio están en la nube y NO se borran.", true) {
		return
	}
	borrarDatos := pregunta("¿Borrar también los datos guardados en ESTE equipo (sesión, ventas sin sincronizar, preferencias)?\n\nSi no estás seguro, elegí «No».\nSi elegís «Sí», todo lo que todavía no se haya subido a la nube se pierde.", true)
	_ = ps(`Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path ([Environment]::GetFolderPath('Desktop')) '` + appName + `.lnk'); Remove-Item -Recurse -Force -ErrorAction SilentlyContinue ` + psq(dirMenu()))
	_ = oculto(exec.Command("reg", "delete", `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\AlmacenRAVE`, "/f")).Run()
	d := dirApp()
	var cmd string
	if borrarDatos {
		cmd = fmt.Sprintf(`ping 127.0.0.1 -n 3 >nul & rmdir /s /q "%s"`, d)
	} else {
		cmd = fmt.Sprintf(`ping 127.0.0.1 -n 3 >nul & del /f /q "%s\AlmacenRAVE.exe" "%s\AlmacenRAVE.exe.viejo" & rmdir /s /q "%s\app"`, d, d, d)
	}
	_ = oculto(exec.Command("cmd", "/c", cmd)).Start()
	if borrarDatos {
		aviso(appName + " se quitó del equipo junto con los datos locales. Los datos de la nube siguen intactos.")
	} else {
		aviso(appName + " se quitó del equipo. Los datos locales quedaron guardados en:\n" + filepath.Join(d, "perfil") + "\nSi lo volvés a instalar, se usan de nuevo.")
	}
}

func main() {
	arg := ""
	if len(os.Args) > 1 {
		arg = os.Args[1]
	}
	switch arg {
	case "--abrir":
		abrir()
	case "--actualizar":
		actualizar()
	case "--desinstalar":
		desinstalar()
	default:
		instalar()
	}
}
