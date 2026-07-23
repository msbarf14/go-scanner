package scanner

import (
	"net/url"
	"regexp"
	"strings"
)

const (
	ulidLength            = 26
	maxPayloadLength      = 512
	maxManualLookupLength = 32
)

type TargetType string

const (
	TargetOrder               TargetType = "order"
	TargetExternalParticipant TargetType = "external_participant"
)

type ScanTarget struct {
	Type TargetType `json:"type"`
	ID   string     `json:"id"`
}

type ManualLookupType string
type ManualLookupSource string

const (
	ManualLookupOrderSuffix ManualLookupType   = "order_suffix"
	ManualLookupBIBNumber   ManualLookupType   = "bib_number"
	ManualSourceOnline      ManualLookupSource = "online"
	ManualSourceVIP         ManualLookupSource = "vip"
)

var (
	ulidPattern          = `[0-9A-HJ-NP-Za-hj-np-z]{26}`
	rawULIDPattern       = regexp.MustCompile(`^(` + ulidPattern + `)$`)
	externalTokenPattern = regexp.MustCompile(`(?i)^external:(` + ulidPattern + `)$`)
	externalPathPattern  = regexp.MustCompile(`(?i)^/external-participants/(` + ulidPattern + `)/ticket\.pdf/?$`)
	orderPathPattern     = regexp.MustCompile(`(?i)^/ticket/(` + ulidPattern + `)(?:/ticket\.pdf|/[0-9]+/ticket\.pdf)?/?$`)
)

func ParseScanTarget(payload string) (ScanTarget, Outcome) {
	payload = strings.TrimSpace(payload)
	if payload == "" || len(payload) > maxPayloadLength {
		return ScanTarget{}, OutcomeInvalidPayload
	}

	if match := externalTokenPattern.FindStringSubmatch(payload); match != nil {
		return ScanTarget{Type: TargetExternalParticipant, ID: strings.ToUpper(match[1])}, OutcomeValid
	}
	if match := rawULIDPattern.FindStringSubmatch(payload); match != nil {
		return ScanTarget{Type: TargetOrder, ID: strings.ToUpper(match[1])}, OutcomeValid
	}

	path, ok := scanPath(payload)
	if !ok {
		return ScanTarget{}, OutcomeInvalidPayload
	}
	if match := externalPathPattern.FindStringSubmatch(path); match != nil {
		return ScanTarget{Type: TargetExternalParticipant, ID: strings.ToUpper(match[1])}, OutcomeValid
	}
	if match := orderPathPattern.FindStringSubmatch(path); match != nil {
		return ScanTarget{Type: TargetOrder, ID: strings.ToUpper(match[1])}, OutcomeValid
	}
	return ScanTarget{}, OutcomeInvalidPayload
}

func ParseOrderULID(payload string) (string, Outcome) {
	target, outcome := ParseScanTarget(payload)
	if outcome != OutcomeValid || target.Type != TargetOrder {
		return "", OutcomeInvalidPayload
	}
	return target.ID, OutcomeValid
}

func ParseTargetType(value string) (TargetType, bool) {
	targetType := TargetType(strings.TrimSpace(value))
	return targetType, targetType == TargetOrder || targetType == TargetExternalParticipant
}

func ParseManualLookup(lookupType string, payload string) (ManualLookupType, string, Outcome) {
	lookup := ManualLookupType(strings.TrimSpace(lookupType))
	value := strings.ToUpper(strings.TrimSpace(payload))
	if lookup != ManualLookupOrderSuffix && lookup != ManualLookupBIBNumber {
		return "", "", OutcomeInvalidPayload
	}
	if !validManualLookupValue(value) {
		return "", "", OutcomeInvalidPayload
	}
	return lookup, value, OutcomeValid
}

func ParseManualSource(value string) (ManualLookupSource, bool) {
	source := ManualLookupSource(strings.ToLower(strings.TrimSpace(value)))
	if source == "" {
		source = ManualSourceOnline
	}
	return source, source == ManualSourceOnline || source == ManualSourceVIP
}

func validManualLookupValue(value string) bool {
	if len(value) == 0 || len(value) > maxManualLookupLength {
		return false
	}
	for _, char := range value {
		if (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') {
			continue
		}
		return false
	}
	return true
}

func scanPath(value string) (string, bool) {
	if strings.ContainsAny(value, "\r\n\t ") {
		return "", false
	}
	if strings.HasPrefix(value, "/") {
		u, err := url.Parse(value)
		if err != nil || u.Host != "" || u.Scheme != "" {
			return "", false
		}
		return u.Path, true
	}
	if strings.HasPrefix(value, "ticket/") || strings.HasPrefix(value, "external-participants/") {
		return "/" + value, true
	}
	u, err := url.Parse(value)
	if err != nil || u.Path == "" || u.Host == "" {
		return "", false
	}
	return u.Path, true
}
