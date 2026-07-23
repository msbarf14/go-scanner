package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed dist/*
var distFS embed.FS

func staticFS() http.FileSystem {
	fsys, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}
	return http.FS(fsys)
}

func StaticHandler() http.Handler {
	return http.FileServer(staticFS())
}

func DisplayHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		data, err := distFS.ReadFile("dist/runner-display.html")
		if err != nil {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		w.Write(data)
	})
}

func ScannerHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		data, err := distFS.ReadFile("dist/runner-scanner.html")
		if err != nil {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		w.Write(data)
	})
}

func PickupsHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		data, err := distFS.ReadFile("dist/race-pack-pickups.html")
		if err != nil {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		w.Write(data)
	})
}
