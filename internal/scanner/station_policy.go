package scanner

import (
	"fmt"
	"strings"
)

type stationCategoryDecision struct {
	Allowed         bool
	ExpectedStation int
	Message         string
}

func evaluateStationCategory(station int, category *string) stationCategoryDecision {
	if station != 1 && station != 2 {
		return stationCategoryDecision{Allowed: true}
	}

	expectedStation := categoryStation(category)
	if expectedStation == station {
		return stationCategoryDecision{Allowed: true, ExpectedStation: expectedStation}
	}
	if expectedStation == 0 {
		return stationCategoryDecision{
			Message: "Kategori tiket belum memiliki station. Hubungi petugas.",
		}
	}
	return stationCategoryDecision{
		ExpectedStation: expectedStation,
		Message:         fmt.Sprintf("Tiket ini dilayani di Station #%d. Silakan menuju Station #%d.", expectedStation, expectedStation),
	}
}

func categoryStation(category *string) int {
	if category == nil {
		return 0
	}

	normalized := strings.ToUpper(strings.ReplaceAll(*category, "-", " "))
	normalized = strings.Join(strings.Fields(normalized), " ")
	normalized = strings.ReplaceAll(normalized, " K", "K")
	switch normalized {
	case "5K", "5K PELAJAR", "5K PELAJARA", "10K":
		return 1
	case "21K":
		return 2
	default:
		return 0
	}
}
