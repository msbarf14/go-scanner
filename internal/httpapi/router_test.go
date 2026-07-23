package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"fenturun2026-bib-scanner/internal/auth"
	"fenturun2026-bib-scanner/internal/respond"
	"fenturun2026-bib-scanner/internal/scanner"
)

func TestValidateDoesNotRequireCSRF(t *testing.T) {
	handler := newTestRouter(t)
	request := httptest.NewRequest(http.MethodPost, "/api/scans/validate", strings.NewReader(`{"payload":"invalid"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnprocessableEntity)
	}
}

func TestPickupsPageServesHTML(t *testing.T) {
	handler := newTestRouter(t)
	request := httptest.NewRequest(http.MethodGet, "/race-pack-pickups", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if !strings.Contains(response.Body.String(), "Data Pickup Race Pack") {
		t.Fatalf("body does not contain pickups title")
	}
}

func TestPickupListRequiresSessionWithoutCSRF(t *testing.T) {
	handler := newTestRouter(t)
	request := httptest.NewRequest(http.MethodGet, "/api/race-pack-pickups", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
}

func TestManualDisplayDoesNotRequireCSRF(t *testing.T) {
	handler := newTestRouter(t)
	request := httptest.NewRequest(http.MethodPost, "/api/scans/manual-display", strings.NewReader(`{"lookup_type":"order_suffix","payload":"GOG"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code == http.StatusForbidden || response.Code == http.StatusUnauthorized {
		t.Fatalf("status = %d, want display-only endpoint to bypass auth/csrf", response.Code)
	}
}

func TestManualValidateRequiresCSRF(t *testing.T) {
	handler := newTestRouter(t)
	request := httptest.NewRequest(http.MethodPost, "/api/scans/manual-validate", strings.NewReader(`{"lookup_type":"order_suffix","payload":"GOG"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusForbidden)
	}
}

func TestPickupRequiresCSRF(t *testing.T) {
	handler := newTestRouter(t)
	request := httptest.NewRequest(http.MethodPost, "/api/orders/01JXXXXXXXXXXXXXXXXXXXXXXX/pickup", strings.NewReader(`{}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusForbidden)
	}
}

func TestGenericPickupAndCancelRequireCSRF(t *testing.T) {
	handler := newTestRouter(t)
	paths := []string{
		"/api/race-pack/targets/order/01JXXXXXXXXXXXXXXXXXXXXXXX/pickup",
		"/api/race-pack/targets/external_participant/01JXXXXXXXXXXXXXXXXXXXXXXX/cancel",
	}
	for _, path := range paths {
		request := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"station":1}`))
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusForbidden {
			t.Fatalf("%s status = %d, want %d", path, response.Code, http.StatusForbidden)
		}
	}
}

func TestManualValidateRequiresSession(t *testing.T) {
	server := httptest.NewServer(newTestRouter(t))
	defer server.Close()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("create cookie jar: %v", err)
	}
	client := &http.Client{Jar: jar}
	csrfResponse, err := client.Get(server.URL + "/auth/csrf")
	if err != nil {
		t.Fatalf("get csrf token: %v", err)
	}
	defer csrfResponse.Body.Close()

	var envelope respond.Envelope
	if err := json.NewDecoder(csrfResponse.Body).Decode(&envelope); err != nil {
		t.Fatalf("decode csrf response: %v", err)
	}
	data, ok := envelope.Data.(map[string]any)
	if !ok {
		t.Fatalf("csrf data type = %T", envelope.Data)
	}
	token, ok := data["token"].(string)
	if !ok || token == "" {
		t.Fatal("csrf token is empty")
	}

	request, err := http.NewRequest(http.MethodPost, server.URL+"/api/scans/manual-validate", strings.NewReader(`{"lookup_type":"order_suffix","payload":"GOG"}`))
	if err != nil {
		t.Fatalf("create manual validate request: %v", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-CSRF-Token", token)
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("manual validate request: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusUnauthorized {
		body, _ := io.ReadAll(response.Body)
		t.Fatalf("status = %d, want %d, body = %s", response.StatusCode, http.StatusUnauthorized, body)
	}
}

func TestPickupRequiresSession(t *testing.T) {
	server := httptest.NewServer(newTestRouter(t))
	defer server.Close()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("create cookie jar: %v", err)
	}
	client := &http.Client{Jar: jar}
	csrfResponse, err := client.Get(server.URL + "/auth/csrf")
	if err != nil {
		t.Fatalf("get csrf token: %v", err)
	}
	defer csrfResponse.Body.Close()

	var envelope respond.Envelope
	if err := json.NewDecoder(csrfResponse.Body).Decode(&envelope); err != nil {
		t.Fatalf("decode csrf response: %v", err)
	}
	data, ok := envelope.Data.(map[string]any)
	if !ok {
		t.Fatalf("csrf data type = %T", envelope.Data)
	}
	token, ok := data["token"].(string)
	if !ok || token == "" {
		t.Fatal("csrf token is empty")
	}

	request, err := http.NewRequest(http.MethodPost, server.URL+"/api/orders/01JXXXXXXXXXXXXXXXXXXXXXXX/pickup", strings.NewReader(`{}`))
	if err != nil {
		t.Fatalf("create pickup request: %v", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-CSRF-Token", token)
	response, err := client.Do(request)
	if err != nil {
		t.Fatalf("pickup request: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusUnauthorized {
		body, _ := io.ReadAll(response.Body)
		t.Fatalf("status = %d, want %d, body = %s", response.StatusCode, http.StatusUnauthorized, body)
	}
}

func newTestRouter(t *testing.T) http.Handler {
	t.Helper()
	baseURL, err := url.Parse("http://localhost:8080")
	if err != nil {
		t.Fatalf("parse base URL: %v", err)
	}
	secret := []byte("01234567890123456789012345678901")
	sessions := auth.NewSessionManager(secret, false, 30*time.Minute, 8*time.Hour)
	authHandler := auth.NewHandler(nil, sessions, nil)
	scannerHandler := scanner.NewHandler(nil, nil)

	return NewRouter(Deps{
		Logger:     slog.New(slog.NewTextHandler(io.Discard, nil)),
		Auth:       authHandler,
		Scanner:    scannerHandler,
		BaseURL:    baseURL,
		CSRFSecret: secret,
	})
}
