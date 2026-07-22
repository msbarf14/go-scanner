package auth

import (
	"net"
	"net/http/httptest"
	"testing"
)

func TestClientIPTrustsForwardingOnlyFromTrustedProxy(t *testing.T) {
	_, trustedProxy, err := net.ParseCIDR("10.0.0.0/8")
	if err != nil {
		t.Fatalf("parse cidr: %v", err)
	}

	handler := NewHandler(nil, nil, []*net.IPNet{trustedProxy})

	request := httptest.NewRequest("POST", "/auth/login", nil)
	request.RemoteAddr = "10.1.2.3:12345"
	request.Header.Set("X-Forwarded-For", "203.0.113.10, 10.1.2.3")
	if got := handler.clientIP(request); got != "203.0.113.10" {
		t.Fatalf("trusted proxy client ip = %q, want %q", got, "203.0.113.10")
	}

	request.RemoteAddr = "198.51.100.20:12345"
	request.Header.Set("X-Forwarded-For", "203.0.113.10")
	if got := handler.clientIP(request); got != "198.51.100.20" {
		t.Fatalf("untrusted proxy client ip = %q, want remote addr", got)
	}
}
