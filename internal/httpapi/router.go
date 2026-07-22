package httpapi

import (
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"fenturun2026-bib-scanner/internal/scanner"
	"fenturun2026-bib-scanner/internal/store"
	"fenturun2026-bib-scanner/internal/web"
)

type Deps struct {
	Store      *store.Store
	Logger     *slog.Logger
	Scanner    *scanner.Handler
	BaseURL    *url.URL
	Production bool
}

func NewRouter(deps Deps) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		WriteJSON(w, r, http.StatusOK, "ok", "Service sehat", map[string]bool{"ok": true})
	})

	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		if err := deps.Store.Ready(r.Context()); err != nil {
			WriteJSON(w, r, http.StatusServiceUnavailable, "database_unavailable", "Database belum siap", nil)
			return
		}
		WriteJSON(w, r, http.StatusOK, "ok", "Service siap", map[string]bool{"ok": true})
	})

	mux.HandleFunc("GET /api/display", deps.Scanner.Display)
	mux.HandleFunc("POST /api/scans/validate", deps.Scanner.Validate)
	mux.HandleFunc("POST /api/orders/{order_ulid}/pickup", deps.Scanner.Pickup)

	displayHandler := web.DisplayHandler()
	scannerHandler := web.ScannerHandler()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		if path == "/" {
			displayHandler.ServeHTTP(w, r)
			return
		}

		if path == "/runner-scanner" || strings.HasPrefix(path, "/runner-scanner/") {
			scannerHandler.ServeHTTP(w, r)
			return
		}

		if strings.HasPrefix(path, "/api/") {
			WriteJSON(w, r, http.StatusNotFound, "not_found", "Endpoint tidak ditemukan", nil)
			return
		}

		if strings.HasPrefix(path, "/assets/") || path == "/manifest.webmanifest" || path == "/service-worker.js" || strings.HasPrefix(path, "/icon-") {
			web.StaticHandler().ServeHTTP(w, r)
			return
		}

		displayHandler.ServeHTTP(w, r)
	})

	return Chain(mux,
		Recover(deps.Logger),
		RequestID,
		LogRequests(deps.Logger),
		SecurityHeaders,
		NoStoreAPI,
		LimitBody(1<<20),
		RequireJSON,
	)
}
