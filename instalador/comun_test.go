package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func leer(t *testing.T, p string) []byte {
	b, err := os.ReadFile(p)
	if err != nil {
		t.Skip("falta " + p)
	}
	return b
}

func TestValidar(t *testing.T) {
	if _, err := validarHTML(htmlIncluido); err != nil {
		t.Fatalf("el HTML incluido no valida: %v", err)
	}
	if _, err := validarHTML(leer(t, "/home/claude/ravev2/index.html")); err == nil {
		t.Fatal("aceptó la DEMO raveV2")
	}
	if _, err := validarHTML(leer(t, "/home/claude/kinidistribuidorademo/index.html")); err == nil {
		t.Fatal("aceptó la demo Kini")
	}
	if _, err := validarHTML(htmlIncluido[:len(htmlIncluido)/2]); err == nil {
		t.Fatal("aceptó un archivo cortado")
	}
	mal := bytes.Replace(htmlIncluido, []byte("</html>"), []byte(`"sb_secret_ABCDEFGHIJKLMNOP"</html>`), 1)
	if _, err := validarHTML(mal); err == nil {
		t.Fatal("aceptó un archivo con clave secreta")
	}
	otro := bytes.ReplaceAll(htmlIncluido, []byte(marcaNube), []byte("otro.supabase.co"))
	if _, err := validarHTML(otro); err == nil {
		t.Fatal("aceptó otro proyecto de nube")
	}
}

func TestEscribirConservaAnterior(t *testing.T) {
	d := t.TempDir()
	os.Setenv("LOCALAPPDATA", d)
	os.MkdirAll(filepath.Join(dirApp(), "perfil"), 0o755)
	os.WriteFile(filepath.Join(dirApp(), "perfil", "datos.txt"), []byte("ventas"), 0o644)
	if err := escribirHTML(htmlIncluido); err != nil {
		t.Fatal(err)
	}
	v2 := bytes.Replace(htmlIncluido, []byte("</html>"), []byte("<!-- v2 --></html>"), 1)
	if err := escribirHTML(v2); err != nil {
		t.Fatal(err)
	}
	prev, _ := os.ReadFile(filepath.Join(dirApp(), "app", "index.prev.html"))
	if !bytes.Equal(prev, htmlIncluido) {
		t.Fatal("no guardó la versión anterior")
	}
	if err := escribirHTML([]byte("<html>basura</html>")); err == nil {
		t.Fatal("aceptó basura")
	}
	cur, _ := os.ReadFile(archivoHTML())
	if !bytes.Equal(cur, v2) {
		t.Fatal("la basura pisó la versión buena")
	}
	if b, _ := os.ReadFile(filepath.Join(dirApp(), "perfil", "datos.txt")); string(b) != "ventas" {
		t.Fatal("tocó los datos del perfil")
	}
	os.WriteFile(archivoHTML(), []byte("dañado"), 0o644)
	if err := asegurarHTML(); err != nil {
		t.Fatal(err)
	}
	cur, _ = os.ReadFile(archivoHTML())
	if _, err := validarHTML(cur); err != nil {
		t.Fatal("no se recuperó de un archivo dañado")
	}
}

func TestServidor(t *testing.T) {
	d := t.TempDir()
	os.Setenv("LOCALAPPDATA", d)
	asegurarHTML()
	h := http.HandlerFunc(manejador)
	pedir := func(m, host, path string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(m, "http://x"+path, nil)
		r.Host = host
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	ok := fmt.Sprintf("127.0.0.1:%d", puerto)
	if w := pedir("GET", ok, "/?gs=a&code=b"); w.Code != 200 || !strings.Contains(w.Body.String(), "RAVE_BUILD") {
		t.Fatalf("no sirve la página con ?code: %d", w.Code)
	} else {
		for _, k := range []string{"X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy"} {
			if w.Header().Get(k) == "" {
				t.Fatal("falta encabezado " + k)
			}
		}
		if w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("cache")
		}
	}
	if w := pedir("GET", "evil.com:"+fmt.Sprint(puerto), "/"); w.Code != 403 {
		t.Fatal("DNS rebinding: respondió a otro Host")
	}
	if w := pedir("POST", ok, "/"); w.Code != 405 {
		t.Fatal("aceptó POST")
	}
	if w := pedir("GET", ok, "/../../windows/win.ini"); w.Code != 404 {
		t.Fatal("ruta arbitraria")
	}
	if w := pedir("GET", ok, "/app/index.prev.html"); w.Code != 404 {
		t.Fatal("expone archivos de la carpeta")
	}
	if w := pedir("GET", "localhost:"+fmt.Sprint(puerto), "/__rave"); !strings.HasPrefix(w.Body.String(), "rave ") {
		t.Fatal("health")
	}
	// servidor real: segunda copia detecta la primera
	s1, ya, err := servir()
	if err != nil || ya {
		t.Fatalf("no arrancó: %v %v", err, ya)
	}
	defer s1.Close()
	_, ya2, err2 := servir()
	if err2 != nil || !ya2 {
		t.Fatalf("la segunda copia no reconoció a la primera: %v %v", err2, ya2)
	}
	res, err := http.Get(urlLocal())
	if err != nil || res.StatusCode != 200 {
		t.Fatal("no responde en 127.0.0.1")
	}
	b, _ := io.ReadAll(res.Body)
	if !bytes.Contains(b, []byte("RAVE_BUILD")) {
		t.Fatal("contenido")
	}
}
