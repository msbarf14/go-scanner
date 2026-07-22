package auth

import (
	"testing"
	"time"
)

func TestLoginLimiterIsScopedByIdentityAndIP(t *testing.T) {
	service := NewService(nil, nil, nil)
	now := time.Date(2026, 7, 22, 10, 0, 0, 0, time.UTC)

	for i := 0; i < loginLimiterBurst; i++ {
		if !service.allowLoginAttempt("operator@example.com", "192.0.2.10", now) {
			t.Fatalf("attempt %d denied before burst exhausted", i+1)
		}
	}
	if service.allowLoginAttempt("operator@example.com", "192.0.2.10", now) {
		t.Fatal("same identity and ip should be limited after burst")
	}
	if !service.allowLoginAttempt("operator@example.com", "192.0.2.11", now) {
		t.Fatal("different ip should have independent limiter")
	}
	if !service.allowLoginAttempt("other@example.com", "192.0.2.10", now) {
		t.Fatal("different identity should have independent limiter")
	}
}

func TestLoginLimiterCleanupRemovesStaleEntries(t *testing.T) {
	service := NewService(nil, nil, nil)
	now := time.Date(2026, 7, 22, 10, 0, 0, 0, time.UTC)

	if !service.allowLoginAttempt("operator@example.com", "192.0.2.10", now) {
		t.Fatal("initial attempt denied")
	}
	service.cleanupLoginLimiters(now.Add(loginLimiterTTL + time.Second))

	if len(service.loginLimiters) != 0 {
		t.Fatalf("login limiter entries = %d, want 0", len(service.loginLimiters))
	}
}
