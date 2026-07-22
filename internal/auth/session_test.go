package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSessionRoundTrip(t *testing.T) {
	manager := NewSessionManager([]byte("01234567890123456789012345678901"), true, 30*time.Minute, 8*time.Hour)
	now := time.Date(2026, 7, 21, 10, 0, 0, 0, time.UTC)
	session := manager.New("01J00000000000000000000001", now)

	response := httptest.NewRecorder()
	if err := manager.Write(response, session); err != nil {
		t.Fatalf("write session: %v", err)
	}

	request := httptest.NewRequest("GET", "/auth/session", nil)
	for _, cookie := range response.Result().Cookies() {
		request.AddCookie(cookie)
	}

	got, ok := manager.Read(request, now.Add(time.Minute))
	if !ok {
		t.Fatal("expected session to be readable")
	}
	if got.UserID != session.UserID {
		t.Fatalf("user id = %q, want %q", got.UserID, session.UserID)
	}
}

func TestSessionCookieAttributes(t *testing.T) {
	tests := []struct {
		name       string
		secure     bool
		cookieName string
	}{
		{name: "secure", secure: true, cookieName: SecureCookieName},
		{name: "local", secure: false, cookieName: LocalCookieName},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			manager := NewSessionManager([]byte("01234567890123456789012345678901"), tt.secure, 30*time.Minute, 8*time.Hour)
			response := httptest.NewRecorder()
			if err := manager.Write(response, manager.New("01J00000000000000000000001", time.Now())); err != nil {
				t.Fatalf("write session: %v", err)
			}

			cookies := response.Result().Cookies()
			if len(cookies) != 1 {
				t.Fatalf("cookies = %d, want 1", len(cookies))
			}
			cookie := cookies[0]
			if cookie.Name != tt.cookieName {
				t.Fatalf("cookie name = %q, want %q", cookie.Name, tt.cookieName)
			}
			if cookie.Secure != tt.secure {
				t.Fatalf("cookie secure = %v, want %v", cookie.Secure, tt.secure)
			}
			if !cookie.HttpOnly || cookie.Path != "/" || cookie.SameSite != http.SameSiteStrictMode {
				t.Fatalf("unexpected cookie attributes: %#v", cookie)
			}
		})
	}
}

func TestSessionIdleExpiry(t *testing.T) {
	manager := NewSessionManager([]byte("01234567890123456789012345678901"), false, time.Minute, time.Hour)
	now := time.Date(2026, 7, 21, 10, 0, 0, 0, time.UTC)
	session := manager.New("01J00000000000000000000001", now)

	response := httptest.NewRecorder()
	if err := manager.Write(response, session); err != nil {
		t.Fatalf("write session: %v", err)
	}

	request := httptest.NewRequest("GET", "/auth/session", nil)
	for _, cookie := range response.Result().Cookies() {
		request.AddCookie(cookie)
	}

	if _, ok := manager.Read(request, now.Add(2*time.Minute)); ok {
		t.Fatal("expected expired idle session")
	}
}
