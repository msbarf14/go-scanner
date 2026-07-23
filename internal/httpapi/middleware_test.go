package httpapi

import "testing"

func TestRedactedLogPathMasksPickupOrderID(t *testing.T) {
	got := redactedLogPath("/api/orders/01KVPMC54R1RA026RA4ZYXJR0P/pickup")
	want := "/api/orders/:order_ulid/pickup"
	if got != want {
		t.Fatalf("redacted path = %q, want %q", got, want)
	}

	unchanged := "/api/scans/validate"
	if got := redactedLogPath(unchanged); got != unchanged {
		t.Fatalf("non-pickup path = %q, want %q", got, unchanged)
	}
}

func TestRedactedGenericTargetLogPath(t *testing.T) {
	got := redactedLogPath("/api/race-pack/targets/external_participant/01KVPMC54R1RA026RA4ZYXJR0P/cancel")
	want := "/api/race-pack/targets/:target_type/:target_ulid/cancel"
	if got != want {
		t.Fatalf("redacted path = %q, want %q", got, want)
	}
}
