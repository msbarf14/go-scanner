package httpapi

import (
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/csrf"

	"fenturun2026-bib-scanner/internal/auth"
	"fenturun2026-bib-scanner/internal/scanner"
	"fenturun2026-bib-scanner/internal/store"
	"fenturun2026-bib-scanner/internal/web"
)

type Deps struct {
	Store      *store.Store
	Logger     *slog.Logger
	Auth       *auth.Handler
	Scanner    *scanner.Handler
	BaseURL    *url.URL
	CSRFSecret []byte
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
	mux.HandleFunc("POST /api/scans/manual-display", deps.Scanner.ValidateManual)
	mux.Handle("GET /api/race-pack-pickups", deps.Auth.RequireAuth(http.HandlerFunc(deps.Scanner.ListPickups)))
	mux.Handle("GET /auth/session", http.HandlerFunc(deps.Auth.Session))

	protectedMux := http.NewServeMux()
	protectedMux.HandleFunc("GET /auth/csrf", deps.Auth.CSRFToken)
	protectedMux.HandleFunc("POST /auth/login", deps.Auth.Login)
	protectedMux.HandleFunc("POST /auth/logout", deps.Auth.Logout)
	protectedMux.Handle("POST /api/scans/manual-validate", deps.Auth.RequireAuth(http.HandlerFunc(deps.Scanner.ValidateManual)))
	protectedMux.Handle("POST /api/orders/{order_ulid}/pickup", deps.Auth.RequireAuth(http.HandlerFunc(deps.Scanner.Pickup)))

	trustedOrigins := []string{}
	if !deps.Production {
		trustedOrigins = append(trustedOrigins, "localhost:5173", "127.0.0.1:5173")
	}
	csrfMiddleware := csrf.Protect(
		deps.CSRFSecret,
		csrf.Secure(deps.BaseURL.Scheme == "https"),
		csrf.SameSite(csrf.SameSiteStrictMode),
		csrf.Path("/"),
		csrf.RequestHeader("X-CSRF-Token"),
		csrf.TrustedOrigins(trustedOrigins),
		csrf.ErrorHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			WriteJSON(w, r, http.StatusForbidden, "forbidden", "CSRF token tidak valid", nil)
		})),
	)
	baseCSRFProtected := csrfMiddleware(protectedMux)
	var csrfProtected http.Handler = baseCSRFProtected
	if deps.BaseURL.Scheme != "https" {
		csrfProtected = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			baseCSRFProtected.ServeHTTP(w, csrf.PlaintextHTTPRequest(r))
		})
	}

	mux.Handle("/auth/", csrfProtected)
	mux.Handle("POST /api/scans/manual-validate", csrfProtected)
	mux.Handle("POST /api/orders/{order_ulid}/pickup", csrfProtected)

	displayHandler := web.DisplayHandler()
	scannerHandler := web.ScannerHandler()
	pickupsHandler := web.PickupsHandler()

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

		if path == "/race-pack-pickups" || strings.HasPrefix(path, "/race-pack-pickups/") {
			pickupsHandler.ServeHTTP(w, r)
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

	extraOrigins := []string{}
	if !deps.Production {
		extraOrigins = append(extraOrigins, "http://localhost:5173", "http://127.0.0.1:5173")
	}

	return Chain(mux,
		Recover(deps.Logger),
		RequestID,
		LogRequests(deps.Logger),
		SecurityHeaders,
		NoStoreAPI,
		SameOrigin(deps.BaseURL, extraOrigins...),
		LimitBody(1<<20),
		RequireJSON,
	)
}
