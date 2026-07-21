package scanner

import (
	"net/url"
	"strings"
)

const (
	ulidLength = 26
	maxPayloadLength = 512
)

var validULIDChars = map[byte]bool{
	'0': true, '1': true, '2': true, '3': true, '4': true,
	'5': true, '6': true, '7': true, '8': true, '9': true,
	'A': true, 'B': true, 'C': true, 'D': true, 'E': true,
	'F': true, 'G': true, 'H': true, 'J': true, 'K': true,
	'M': true, 'N': true, 'P': true, 'Q': true, 'R': true,
	'S': true, 'T': true, 'V': true, 'W': true, 'X': true,
	'Y': true, 'Z': true,
}

func ParseOrderULID(payload string) (string, Outcome) {
	payload = strings.TrimSpace(payload)
	
	if len(payload) == 0 || len(payload) > maxPayloadLength {
		return "", OutcomeInvalidPayload
	}

	if ulid, ok := extractRawULID(payload); ok {
		return ulid, OutcomeValid
	}

	if ulid, ok := extractFromURL(payload); ok {
		return ulid, OutcomeValid
	}

	return "", OutcomeInvalidPayload
}

func extractRawULID(s string) (string, bool) {
	if len(s) != ulidLength {
		return "", false
	}
	
	upper := strings.ToUpper(s)
	for i := 0; i < ulidLength; i++ {
		if !validULIDChars[upper[i]] {
			return "", false
		}
	}
	
	return upper, true
}

func extractFromURL(s string) (string, bool) {
	if !strings.Contains(s, "/") {
		return "", false
	}

	var path string
	
	if strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") {
		u, err := url.Parse(s)
		if err != nil {
			return "", false
		}
		path = u.Path
	} else {
		path = s
	}

	path = strings.TrimPrefix(path, "/")
	
	if !strings.HasPrefix(path, "ticket/") {
		return "", false
	}
	
	path = strings.TrimPrefix(path, "ticket/")
	
	parts := strings.SplitN(path, "/", 2)
	if len(parts) == 0 {
		return "", false
	}
	
	ulid := parts[0]
	if len(ulid) != ulidLength {
		return "", false
	}
	
	upper := strings.ToUpper(ulid)
	for i := 0; i < ulidLength; i++ {
		if !validULIDChars[upper[i]] {
			return "", false
		}
	}
	
	return upper, true
}