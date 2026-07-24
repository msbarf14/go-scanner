package scanner

import "testing"

func TestCategoryStationNormalization(t *testing.T) {
	tests := []struct {
		category string
		station  int
	}{
		{category: "5K", station: 1},
		{category: " 5k ", station: 1},
		{category: "5 K", station: 1},
		{category: "5K PELAJAR", station: 1},
		{category: "5K - PELAJAR", station: 1},
		{category: " 5k  -  pelajar ", station: 1},
		{category: "5k   pelajara", station: 1},
		{category: "10K", station: 1},
		{category: "10 K", station: 1},
		{category: "21K", station: 2},
		{category: "21 k", station: 2},
		{category: "Marathon", station: 0},
	}

	for _, tt := range tests {
		t.Run(tt.category, func(t *testing.T) {
			if got := categoryStation(&tt.category); got != tt.station {
				t.Fatalf("categoryStation(%q) = %d, want %d", tt.category, got, tt.station)
			}
		})
	}
	if got := categoryStation(nil); got != 0 {
		t.Fatalf("categoryStation(nil) = %d, want 0", got)
	}
}

func TestEvaluateStationCategory(t *testing.T) {
	fiveK := "5K"
	twentyOneK := "21K"
	unknown := "Marathon"

	tests := []struct {
		name            string
		station         int
		category        *string
		allowed         bool
		expectedStation int
		message         string
	}{
		{name: "5K at station 1", station: 1, category: &fiveK, allowed: true, expectedStation: 1},
		{name: "21K at station 2", station: 2, category: &twentyOneK, allowed: true, expectedStation: 2},
		{name: "21K redirected", station: 1, category: &twentyOneK, expectedStation: 2, message: "Tiket ini dilayani di Station #2. Silakan menuju Station #2."},
		{name: "5K redirected", station: 2, category: &fiveK, expectedStation: 1, message: "Tiket ini dilayani di Station #1. Silakan menuju Station #1."},
		{name: "unknown rejected", station: 1, category: &unknown, message: "Kategori tiket belum memiliki station. Hubungi petugas."},
		{name: "missing rejected", station: 2, message: "Kategori tiket belum memiliki station. Hubungi petugas."},
		{name: "station 3 unrestricted", station: 3, category: &unknown, allowed: true},
		{name: "station 99 unrestricted", station: 99, allowed: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluateStationCategory(tt.station, tt.category)
			if got.Allowed != tt.allowed || got.ExpectedStation != tt.expectedStation || got.Message != tt.message {
				t.Fatalf("decision = %#v", got)
			}
		})
	}
}

func TestStationMismatchOutcomeContract(t *testing.T) {
	if got := OutcomeStationMismatch.HTTPStatus(); got != 409 {
		t.Fatalf("HTTP status = %d, want 409", got)
	}
}
