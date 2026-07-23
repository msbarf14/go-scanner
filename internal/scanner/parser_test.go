package scanner

import (
	"strings"
	"testing"
)

func TestParseOrderULID(t *testing.T) {
	tests := []struct {
		name     string
		payload  string
		wantULID string
		wantOK   bool
	}{
		{
			name:     "raw ULID uppercase",
			payload:  "01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantULID: "01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantOK:   true,
		},
		{
			name:     "raw ULID lowercase normalized",
			payload:  "01jxxxxxxxxxxxxxxxxxxxxxxx",
			wantULID: "01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantOK:   true,
		},
		{
			name:     "full ticket URL",
			payload:  "https://example.com/ticket/01JXXXXXXXXXXXXXXXXXXXXXXX/ticket.pdf",
			wantULID: "01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantOK:   true,
		},
		{
			name:     "relative path with ticket.pdf",
			payload:  "/ticket/01JXXXXXXXXXXXXXXXXXXXXXXX/ticket.pdf",
			wantULID: "01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantOK:   true,
		},
		{
			name:     "relative path without ticket.pdf",
			payload:  "/ticket/01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantULID: "01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantOK:   true,
		},
		{
			name:     "relative path without leading slash",
			payload:  "ticket/01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantULID: "01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantOK:   true,
		},
		{
			name:    "empty payload",
			payload: "",
			wantOK:  false,
		},
		{
			name:    "whitespace only",
			payload: "   ",
			wantOK:  false,
		},
		{
			name:    "too long payload",
			payload: string(make([]byte, 600)),
			wantOK:  false,
		},
		{
			name:    "invalid ULID length short",
			payload: "01JXXX",
			wantOK:  false,
		},
		{
			name:    "invalid ULID length long",
			payload: "01JXXXXXXXXXXXXXXXXXXXXXXXX",
			wantOK:  false,
		},
		{
			name:    "invalid ULID characters",
			payload: "01JXXXXXXXXXXXXXXXXXXXXXXI",
			wantOK:  false,
		},
		{
			name:    "invalid ULID characters O",
			payload: "01JXXXXXXXXXXXXXXXXXXXXXXO",
			wantOK:  false,
		},
		{
			name:    "URL without ticket path",
			payload: "https://example.com/other/01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantOK:  false,
		},
		{
			name:    "just a random string",
			payload: "not-a-ticket",
			wantOK:  false,
		},
		{
			name:     "full URL with http",
			payload:  "http://example.com/ticket/01JXXXXXXXXXXXXXXXXXXXXXXX/ticket.pdf",
			wantULID: "01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantOK:   true,
		},
		{
			name:     "ULID with spaces trimmed",
			payload:  "  01JXXXXXXXXXXXXXXXXXXXXXXX  ",
			wantULID: "01JXXXXXXXXXXXXXXXXXXXXXXX",
			wantOK:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, outcome := ParseOrderULID(tt.payload)
			if tt.wantOK {
				if outcome != OutcomeValid {
					t.Errorf("ParseOrderULID(%q) outcome = %v, want %v", tt.payload, outcome, OutcomeValid)
				}
				if got != tt.wantULID {
					t.Errorf("ParseOrderULID(%q) ulid = %q, want %q", tt.payload, got, tt.wantULID)
				}
			} else {
				if outcome != OutcomeInvalidPayload {
					t.Errorf("ParseOrderULID(%q) outcome = %v, want %v", tt.payload, outcome, OutcomeInvalidPayload)
				}
			}
		})
	}
}

func TestParseScanTarget(t *testing.T) {
	orderID := "01ARZ3NDEKTSV4RRFFQ69G5FAV"
	externalID := "01BX5ZZKBKACTAV9WEVGEMMVRZ"
	tests := []struct {
		input string
		want  ScanTarget
		valid bool
	}{
		{"https://event.test/ticket/" + orderID + "/ticket.pdf?download=true", ScanTarget{TargetOrder, orderID}, true},
		{"/ticket/" + orderID, ScanTarget{TargetOrder, orderID}, true},
		{"/ticket/" + orderID + "/2/ticket.pdf", ScanTarget{TargetOrder, orderID}, true},
		{strings.ToLower(orderID), ScanTarget{TargetOrder, orderID}, true},
		{"https://event.test/external-participants/" + externalID + "/ticket.pdf", ScanTarget{TargetExternalParticipant, externalID}, true},
		{"external:" + strings.ToLower(externalID), ScanTarget{TargetExternalParticipant, externalID}, true},
		{"external:not-a-ulid", ScanTarget{}, false},
		{"/external-participants/" + externalID, ScanTarget{}, false},
		{"/ticket/" + orderID + "/ticket.pdf/extra", ScanTarget{}, false},
		{"scan /ticket/" + orderID + "/ticket.pdf now", ScanTarget{}, false},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, outcome := ParseScanTarget(tt.input)
			if tt.valid && (outcome != OutcomeValid || got != tt.want) {
				t.Fatalf("ParseScanTarget() = %#v, %s; want %#v, valid", got, outcome, tt.want)
			}
			if !tt.valid && outcome != OutcomeInvalidPayload {
				t.Fatalf("outcome = %s, want invalid_payload", outcome)
			}
		})
	}
}

func TestParseManualLookup(t *testing.T) {
	tests := []struct {
		name       string
		lookupType string
		payload    string
		wantType   ManualLookupType
		wantValue  string
		wantOK     bool
	}{
		{name: "order suffix uppercase", lookupType: "order_suffix", payload: "GOG", wantType: ManualLookupOrderSuffix, wantValue: "GOG", wantOK: true},
		{name: "order suffix normalized", lookupType: "order_suffix", payload: " gog ", wantType: ManualLookupOrderSuffix, wantValue: "GOG", wantOK: true},
		{name: "bib number", lookupType: "bib_number", payload: "N0302", wantType: ManualLookupBIBNumber, wantValue: "N0302", wantOK: true},
		{name: "unknown type", lookupType: "participant_name", payload: "N0302", wantOK: false},
		{name: "empty payload", lookupType: "bib_number", payload: " ", wantOK: false},
		{name: "slash rejected", lookupType: "order_suffix", payload: "260606/GOG", wantOK: false},
		{name: "wildcard rejected", lookupType: "bib_number", payload: "N%", wantOK: false},
		{name: "space rejected", lookupType: "bib_number", payload: "N 0302", wantOK: false},
		{name: "too long rejected", lookupType: "bib_number", payload: "123456789012345678901234567890123", wantOK: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lookupType, value, outcome := ParseManualLookup(tt.lookupType, tt.payload)
			if tt.wantOK {
				if outcome != OutcomeValid {
					t.Fatalf("outcome = %v, want %v", outcome, OutcomeValid)
				}
				if lookupType != tt.wantType || value != tt.wantValue {
					t.Fatalf("lookup = %q/%q, want %q/%q", lookupType, value, tt.wantType, tt.wantValue)
				}
				return
			}
			if outcome != OutcomeInvalidPayload {
				t.Fatalf("outcome = %v, want %v", outcome, OutcomeInvalidPayload)
			}
		})
	}
}

func TestNormalizeStation(t *testing.T) {
	tests := []struct {
		name   string
		raw    string
		want   string
		wantOK bool
	}{
		{name: "empty defaults to one", raw: "", want: "1", wantOK: true},
		{name: "trim and normalize", raw: " 09 ", want: "9", wantOK: true},
		{name: "max", raw: "99", want: "99", wantOK: true},
		{name: "zero invalid", raw: "0", wantOK: false},
		{name: "too high invalid", raw: "100", wantOK: false},
		{name: "random invalid", raw: "station-a", wantOK: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := NormalizeStation(tt.raw)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if got != tt.want {
				t.Fatalf("station = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestParseManualSource(t *testing.T) {
	if source, ok := ParseManualSource(""); !ok || source != ManualSourceOnline {
		t.Fatalf("empty source = %q, %v", source, ok)
	}
	if source, ok := ParseManualSource(" VIP "); !ok || source != ManualSourceVIP {
		t.Fatalf("VIP source = %q, %v", source, ok)
	}
	if _, ok := ParseManualSource("all"); ok {
		t.Fatal("unknown source must be rejected")
	}
}
