package scanner

import (
	"strconv"
	"strings"
)

const (
	minStation = 1
	maxStation = 99
)

func NormalizeStation(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "1", true
	}
	if len(raw) > 2 {
		return "", false
	}
	station, err := strconv.Atoi(raw)
	if err != nil || station < minStation || station > maxStation {
		return "", false
	}
	return strconv.Itoa(station), true
}
