//go:build !windows

package main

// En Linux sólo se usa para las pruebas automáticas del servidor y de la validación.
import (
	"fmt"
	"os"
	"time"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--servir-prueba" {
		if err := asegurarHTML(); err != nil {
			fmt.Println("ERROR", err)
			os.Exit(1)
		}
		_, ya, err := servir()
		fmt.Println("servidor", urlLocal(), ya, err)
		time.Sleep(10 * time.Minute)
		return
	}
	if len(os.Args) > 2 && os.Args[1] == "--validar" {
		b, _ := os.ReadFile(os.Args[2])
		v, err := validarHTML(b)
		fmt.Println(v, err)
		return
	}
	fmt.Println("Este programa es para Windows.")
}
