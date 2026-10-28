// Instalador y lanzador de Windows de «Almacén RAVE» (SISTEMA VB 26F · sección 10).
// Un solo ejecutable: instala sin pedir administrador, sirve el sistema en 127.0.0.1 (para que funcione sin internet
// y para que «Ingresar con Google» pueda volver al programa), se actualiza validando lo que baja y desinstala sin
// borrar los datos salvo que el usuario lo pida. Desarrollado por VINCULAR BUSINESS · (387) 4484132 · vincularbusiness@gmail.com
package main

import (
	"bytes"
	_ "embed"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const (
	appName    = "Almacén RAVE"
	dirName    = "AlmacenRAVE"
	puerto     = 47123
	urlBase    = "https://raveholding.github.io/AlmacenRAVE/"
	marcaNube  = "rdvwrrroerxikfqvpgnh.supabase.co"
	publisher  = "VINCULAR BUSINESS"
	version    = "26.31"
	maxHTML    = 30 << 20
	minHTML    = 300 << 10
)

//go:embed app/index.html
var htmlIncluido []byte

var reSecreto = regexp.MustCompile(`sb_secret_[A-Za-z0-9_-]{10,}|"role"\s*:\s*"service_role"`)
var reVer = regexp.MustCompile(`RAVE_BUILD=\{"ver": "([^"]+)", "variant": "([a-z]+)"`)

// validarHTML: sólo se acepta la versión «cliente» de este comercio (nunca una demo ni un archivo ajeno).
func validarHTML(b []byte) (string, error) {
	if len(b) < minHTML || len(b) > maxHTML {
		return "", fmt.Errorf("tamaño inesperado (%d bytes)", len(b))
	}
	m := reVer.FindSubmatch(b)
	if m == nil {
		return "", errors.New("no es el Sistema RAVE (falta la marca de compilación)")
	}
	if string(m[2]) != "cliente" {
		return "", fmt.Errorf("es la variante %q, no la del cliente", m[2])
	}
	if !bytes.Contains(b, []byte(marcaNube)) {
		return "", errors.New("no apunta a la nube de Almacén RAVE")
	}
	if !bytes.Contains(b, []byte("</html>")) || !bytes.HasPrefix(bytes.TrimSpace(b), []byte("<!doctype html")) && !bytes.HasPrefix(bytes.TrimSpace(b), []byte("<!DOCTYPE html")) {
		return "", errors.New("archivo incompleto")
	}
	if reSecreto.Match(b) {
		return "", errors.New("contiene una clave secreta: se rechaza")
	}
	return string(m[1]), nil
}

func dirApp() string {
	b := os.Getenv("LOCALAPPDATA")
	if b == "" {
		b, _ = os.UserCacheDir()
	}
	return filepath.Join(b, dirName)
}
func archivoHTML() string { return filepath.Join(dirApp(), "app", "index.html") }

// escribirHTML guarda la versión nueva conservando la anterior (index.prev.html). Nunca toca el perfil (datos).
func escribirHTML(b []byte) error {
	if _, err := validarHTML(b); err != nil {
		return err
	}
	dst := archivoHTML()
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	tmp := dst + ".nuevo"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	if old, err := os.ReadFile(dst); err == nil {
		if bytes.Equal(old, b) {
			os.Remove(tmp)
			return nil
		}
		_ = os.WriteFile(filepath.Join(filepath.Dir(dst), "index.prev.html"), old, 0o644)
	}
	os.Remove(dst)
	return os.Rename(tmp, dst)
}

// bajarUltima descarga la versión publicada; si no valida, no reemplaza nada.
func bajarUltima(timeout time.Duration) (string, bool, error) {
	cli := &http.Client{Timeout: timeout}
	req, _ := http.NewRequest("GET", urlBase+"index.html?t="+fmt.Sprint(time.Now().Unix()), nil)
	req.Header.Set("Cache-Control", "no-cache")
	res, err := cli.Do(req)
	if err != nil {
		return "", false, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return "", false, fmt.Errorf("el servidor respondió %d", res.StatusCode)
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, maxHTML+1))
	if err != nil {
		return "", false, err
	}
	ver, err := validarHTML(b)
	if err != nil {
		return "", false, err
	}
	old, _ := os.ReadFile(archivoHTML())
	if bytes.Equal(old, b) {
		return ver, false, nil
	}
	return ver, true, escribirHTML(b)
}

func asegurarHTML() error {
	if b, err := os.ReadFile(archivoHTML()); err == nil {
		if _, err := validarHTML(b); err == nil {
			return nil
		}
		// archivo dañado: probar la copia anterior
		if p, err := os.ReadFile(filepath.Join(filepath.Dir(archivoHTML()), "index.prev.html")); err == nil {
			if _, err := validarHTML(p); err == nil {
				return escribirHTML(p)
			}
		}
	}
	return escribirHTML(htmlIncluido)
}

// ---------- servidor local (sólo 127.0.0.1) ----------
func hostOK(h string) bool {
	return h == fmt.Sprintf("127.0.0.1:%d", puerto) || h == fmt.Sprintf("localhost:%d", puerto)
}

func manejador(w http.ResponseWriter, r *http.Request) {
	hd := w.Header()
	hd.Set("X-Content-Type-Options", "nosniff")
	hd.Set("X-Frame-Options", "DENY")
	hd.Set("Referrer-Policy", "no-referrer")
	hd.Set("Cross-Origin-Opener-Policy", "same-origin")
	hd.Set("Permissions-Policy", "geolocation=(), microphone=(self), camera=(self)")
	if !hostOK(r.Host) { // evita «DNS rebinding»: sólo responde si lo llaman por 127.0.0.1 / localhost
		http.Error(w, "no permitido", http.StatusForbidden)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "método no permitido", http.StatusMethodNotAllowed)
		return
	}
	switch r.URL.Path {
	case "/__rave":
		hd.Set("Content-Type", "text/plain; charset=utf-8")
		hd.Set("Cache-Control", "no-store")
		io.WriteString(w, "rave "+version)
	case "/", "/index.html":
		b, err := os.ReadFile(archivoHTML())
		if err != nil {
			b = htmlIncluido
		}
		hd.Set("Content-Type", "text/html; charset=utf-8")
		hd.Set("Cache-Control", "no-store")
		w.Write(b)
	case "/favicon.ico":
		w.WriteHeader(http.StatusNoContent)
	default:
		http.NotFound(w, r)
	}
}

// servir arranca el servidor. Si el puerto ya lo usa otra copia de este programa devuelve (nil, true).
func servir() (*http.Server, bool, error) {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", puerto))
	if err != nil {
		cli := &http.Client{Timeout: 2 * time.Second}
		if res, e2 := cli.Get(fmt.Sprintf("http://127.0.0.1:%d/__rave", puerto)); e2 == nil {
			b, _ := io.ReadAll(io.LimitReader(res.Body, 64))
			res.Body.Close()
			if strings.HasPrefix(string(b), "rave ") {
				return nil, true, nil
			}
		}
		return nil, false, fmt.Errorf("el puerto %d está ocupado por otro programa", puerto)
	}
	s := &http.Server{Handler: http.HandlerFunc(manejador), ReadHeaderTimeout: 10 * time.Second}
	go s.Serve(ln)
	return s, false, nil
}

func urlLocal() string { return fmt.Sprintf("http://127.0.0.1:%d/", puerto) }
