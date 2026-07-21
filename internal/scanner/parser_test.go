package scanner

import "testing"

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