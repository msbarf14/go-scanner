package scanner

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestInvalidScanPublishesDisplayOutcome(t *testing.T) {
	service := NewService(nil, nil)
	handler := NewHandler(service, nil)
	request := httptest.NewRequest(http.MethodPost, "/api/scans/validate", strings.NewReader(`{"payload":"random-code","station":"7"}`))
	response := httptest.NewRecorder()

	handler.Validate(response, request)

	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnprocessableEntity)
	}
	display := service.GetDisplayData("7")
	if display == nil {
		t.Fatal("display outcome was not published")
	}
	if display.Outcome != OutcomeInvalidPayload {
		t.Fatalf("display outcome = %s, want invalid_payload", display.Outcome)
	}
	if display.ScanID == "" {
		t.Fatal("display scan_id is empty")
	}
}

func TestDisplayOutcomeGetsNewScanID(t *testing.T) {
	service := NewService(nil, nil)
	service.PublishDisplayOutcome(t.Context(), "2", OutcomeNotFound)
	first := service.GetDisplayData("2")
	service.PublishDisplayOutcome(t.Context(), "2", OutcomeNotFound)
	second := service.GetDisplayData("2")

	if first == nil || second == nil || first.ScanID == second.ScanID {
		t.Fatal("repeated outcome must publish a new scan_id")
	}
}
