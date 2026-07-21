package httpapi

import (
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"fenturun2026-bib-scanner/internal/scanner"
	"fenturun2026-bib-scanner/internal/store"
	"fenturun2026-bib-scanner/internal/webui"
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

	mux.HandleFunc("POST /api/scans/validate", deps.Scanner.Validate)
	mux.HandleFunc("POST /api/orders/{order_ulid}/pickup", deps.Scanner.Pickup)

	webuiHandler := webui.Handler()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && !strings.HasPrefix(r.URL.Path, "/api/") {
			webuiHandler.ServeHTTP(w, r)
			return
		}
		if r.URL.Path == "/" {
			webuiHandler.ServeHTTP(w, r)
			return
		}
		WriteJSON(w, r, http.StatusNotFound, "not_found", "Endpoint tidak ditemukan", nil)
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
