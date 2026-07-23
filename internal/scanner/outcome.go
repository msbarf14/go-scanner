package scanner

import "net/http"

type Outcome string

const (
	OutcomeValid              Outcome = "valid"
	OutcomePickedUp           Outcome = "picked_up"
	OutcomeInvalidPayload     Outcome = "invalid_payload"
	OutcomeNotFound           Outcome = "not_found"
	OutcomeNotPaid            Outcome = "not_paid"
	OutcomeParticipantMissing Outcome = "participant_missing"
	OutcomeMultipleParticipants Outcome = "multiple_participants"
	OutcomeAlreadyPickedUp    Outcome = "already_picked_up"
	OutcomeAmbiguousLookup    Outcome = "ambiguous_lookup"
	OutcomeUnauthenticated    Outcome = "unauthenticated"
	OutcomeForbidden          Outcome = "forbidden"
	OutcomeDatabaseUnavailable Outcome = "database_unavailable"
	OutcomeInternalError      Outcome = "internal_error"
)

func (o Outcome) HTTPStatus() int {
	switch o {
	case OutcomeValid, OutcomePickedUp:
		return http.StatusOK
	case OutcomeInvalidPayload:
		return http.StatusUnprocessableEntity
	case OutcomeNotFound:
		return http.StatusNotFound
	case OutcomeNotPaid, OutcomeParticipantMissing, OutcomeMultipleParticipants, OutcomeAlreadyPickedUp, OutcomeAmbiguousLookup:
		return http.StatusConflict
	case OutcomeUnauthenticated:
		return http.StatusUnauthorized
	case OutcomeForbidden:
		return http.StatusForbidden
	case OutcomeDatabaseUnavailable:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}

func (o Outcome) Message() string {
	switch o {
	case OutcomeValid:
		return "Tiket valid"
	case OutcomePickedUp:
		return "Race pack berhasil diserahkan"
	case OutcomeInvalidPayload:
		return "QR tiket tidak valid"
	case OutcomeNotFound:
		return "Order tidak ditemukan"
	case OutcomeNotPaid:
		return "Tiket belum valid untuk pengambilan"
	case OutcomeParticipantMissing:
		return "Data participant tidak lengkap, hubungi supervisor"
	case OutcomeMultipleParticipants:
		return "Order multi-participant tidak didukung, hubungi supervisor"
	case OutcomeAlreadyPickedUp:
		return "Race pack sudah pernah diambil"
	case OutcomeAmbiguousLookup:
		return "Lookup manual cocok ke lebih dari satu order, hubungi supervisor"
	case OutcomeUnauthenticated:
		return "Session tidak valid"
	case OutcomeForbidden:
		return "Anda tidak memiliki akses scanner"
	case OutcomeDatabaseUnavailable:
		return "Koneksi server bermasalah"
	default:
		return "Terjadi kesalahan server"
	}
}