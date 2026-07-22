package config

import (
	"strings"
	"testing"
)

func TestProductionRequiresCSRFSecret(t *testing.T) {
	setRequiredProductionEnv(t)
	t.Setenv("CSRF_SECRET", "")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "CSRF_SECRET is required") {
		t.Fatalf("error = %v, want CSRF_SECRET required", err)
	}
}

func TestProductionRequiresExplicitDBSSLMode(t *testing.T) {
	setRequiredProductionEnv(t)
	t.Setenv("DB_SSLMODE", "")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "DB_SSLMODE is required") {
		t.Fatalf("error = %v, want DB_SSLMODE required", err)
	}
}

func TestProductionDatabaseURLRequiresSSLMode(t *testing.T) {
	setRequiredProductionEnv(t)
	t.Setenv("DATABASE_URL", "postgres://scanner:secret@example.com:5432/fenturun2026")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "DATABASE_URL must include sslmode") {
		t.Fatalf("error = %v, want DATABASE_URL sslmode required", err)
	}
}

func setRequiredProductionEnv(t *testing.T) {
	t.Helper()
	t.Setenv("APP_ENV", "production")
	t.Setenv("PUBLIC_BASE_URL", "https://scanner.example.com")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("DB_HOST", "127.0.0.1")
	t.Setenv("DB_PORT", "5432")
	t.Setenv("DB_DATABASE", "fenturun2026")
	t.Setenv("DB_USERNAME", "scanner_service")
	t.Setenv("DB_PASSWORD", "secret")
	t.Setenv("DB_SSLMODE", "require")
	t.Setenv("SESSION_SECRET", "01234567890123456789012345678901")
	t.Setenv("CSRF_SECRET", "abcdefghijklmnopqrstuvwxyz123456")
}
