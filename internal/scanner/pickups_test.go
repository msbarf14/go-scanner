package scanner

import (
	"strings"
	"testing"
	"time"
)

func TestSearchPatternEscapesWildcards(t *testing.T) {
	got := searchPattern(`A%_\B`)
	want := `%A\%\_\\B%`
	if got != want {
		t.Fatalf("pattern = %q, want %q", got, want)
	}
}

func TestPickupListCursorRoundTrip(t *testing.T) {
	pickedUpAt := time.Date(2026, 7, 23, 10, 15, 30, 123, time.UTC)
	encoded := encodePickupListCursor(pickedUpAt, "01J00000000000000000001004")
	decodedTime, decodedID, err := decodePickupListCursor(encoded)
	if err != nil {
		t.Fatalf("decode cursor: %v", err)
	}
	if !decodedTime.Equal(pickedUpAt) {
		t.Fatalf("decoded time = %s, want %s", decodedTime.Format(time.RFC3339Nano), pickedUpAt.Format(time.RFC3339Nano))
	}
	if decodedID != "01J00000000000000000001004" {
		t.Fatalf("decoded id = %q", decodedID)
	}
}

func TestPickupListCursorRejectsInvalid(t *testing.T) {
	if _, _, err := decodePickupListCursor("not-base64"); err == nil {
		t.Fatal("expected invalid cursor error")
	}
}

func TestListPickupsRejectsInvalidQueryBeforeRepository(t *testing.T) {
	service := NewService(nil, nil)
	_, err := service.ListPickups(t.Context(), PickupListQuery{Limit: maxPickupListLimit + 1})
	if err != ErrInvalidPickupListQuery {
		t.Fatalf("limit err = %v, want ErrInvalidPickupListQuery", err)
	}

	_, err = service.ListPickups(t.Context(), PickupListQuery{Search: strings.Repeat("a", maxPickupListSearchLength+1)})
	if err != ErrInvalidPickupListQuery {
		t.Fatalf("search err = %v, want ErrInvalidPickupListQuery", err)
	}

	from := time.Date(2026, 7, 23, 11, 0, 0, 0, time.UTC)
	to := time.Date(2026, 7, 23, 10, 0, 0, 0, time.UTC)
	_, err = service.ListPickups(t.Context(), PickupListQuery{PickedUpFrom: &from, PickedUpTo: &to})
	if err != ErrInvalidPickupListQuery {
		t.Fatalf("range err = %v, want ErrInvalidPickupListQuery", err)
	}
}
