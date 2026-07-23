package scanner

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"fenturun2026-bib-scanner/internal/auth"
	"fenturun2026-bib-scanner/internal/contextutil"
	"fenturun2026-bib-scanner/internal/respond"
)

type Handler struct {
	service *Service
	logger  *slog.Logger
}

func NewHandler(service *Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

type validateRequest struct {
	Payload string `json:"payload"`
	Station string `json:"station,omitempty"`
}

type manualValidateRequest struct {
	LookupType string `json:"lookup_type"`
	Payload    string `json:"payload"`
	Station    string `json:"station,omitempty"`
}

func (h *Handler) Validate(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	loggedOutcome := OutcomeInternalError
	orderID := ""
	station := ""
	defer func() {
		h.logValidate(r, start, loggedOutcome, station, orderID)
	}()

	var req validateRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		loggedOutcome = OutcomeInvalidPayload
		respond.JSON(w, r, OutcomeInvalidPayload.HTTPStatus(), string(OutcomeInvalidPayload), OutcomeInvalidPayload.Message(), nil)
		return
	}
	var stationOK bool
	station, stationOK = NormalizeStation(req.Station)
	if !stationOK {
		loggedOutcome = OutcomeInvalidPayload
		station = "invalid"
		respond.JSON(w, r, OutcomeInvalidPayload.HTTPStatus(), string(OutcomeInvalidPayload), "Station tidak valid", nil)
		return
	}

	parsedOrderID, outcome := ParseOrderULID(req.Payload)
	orderID = parsedOrderID
	if outcome != OutcomeValid {
		loggedOutcome = outcome
		respond.JSON(w, r, outcome.HTTPStatus(), string(outcome), outcome.Message(), nil)
		return
	}

	result, err := h.service.Validate(r.Context(), orderID, station)
	if err != nil {
		loggedOutcome = OutcomeInternalError
		respond.JSON(w, r, OutcomeInternalError.HTTPStatus(), string(OutcomeInternalError), OutcomeInternalError.Message(), nil)
		return
	}
	loggedOutcome = result.Outcome

	if result.Outcome != OutcomeValid && result.Outcome != OutcomeAlreadyPickedUp {
		respond.JSON(w, r, result.Outcome.HTTPStatus(), string(result.Outcome), result.Outcome.Message(), nil)
		return
	}

	respond.JSON(w, r, result.Outcome.HTTPStatus(), string(result.Outcome), result.Outcome.Message(), map[string]interface{}{
		"order":       result.Order,
		"participant": result.Participant,
		"ticket":      result.Ticket,
	})
}

func (h *Handler) ValidateManual(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	loggedOutcome := OutcomeInternalError
	station := ""
	lookupType := ""
	orderID := ""
	defer func() {
		h.logManualValidate(r, start, loggedOutcome, station, lookupType, orderID)
	}()

	var req manualValidateRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		loggedOutcome = OutcomeInvalidPayload
		respond.JSON(w, r, OutcomeInvalidPayload.HTTPStatus(), string(OutcomeInvalidPayload), OutcomeInvalidPayload.Message(), nil)
		return
	}
	lookupType = req.LookupType

	var stationOK bool
	station, stationOK = NormalizeStation(req.Station)
	if !stationOK {
		loggedOutcome = OutcomeInvalidPayload
		station = "invalid"
		respond.JSON(w, r, OutcomeInvalidPayload.HTTPStatus(), string(OutcomeInvalidPayload), "Station tidak valid", nil)
		return
	}

	result, err := h.service.ValidateManualLookup(r.Context(), req.LookupType, req.Payload, station)
	if err != nil {
		loggedOutcome = OutcomeInternalError
		respond.JSON(w, r, OutcomeInternalError.HTTPStatus(), string(OutcomeInternalError), OutcomeInternalError.Message(), nil)
		return
	}
	loggedOutcome = result.Outcome
	if result.Order != nil {
		orderID = result.Order.ID
	}

	if result.Outcome != OutcomeValid && result.Outcome != OutcomeAlreadyPickedUp {
		respond.JSON(w, r, result.Outcome.HTTPStatus(), string(result.Outcome), result.Outcome.Message(), nil)
		return
	}

	respond.JSON(w, r, result.Outcome.HTTPStatus(), string(result.Outcome), result.Outcome.Message(), map[string]interface{}{
		"order":       result.Order,
		"participant": result.Participant,
		"ticket":      result.Ticket,
	})
}

func (h *Handler) Display(w http.ResponseWriter, r *http.Request) {
	station, ok := NormalizeStation(r.URL.Query().Get("station"))
	if !ok {
		respond.JSON(w, r, OutcomeInvalidPayload.HTTPStatus(), string(OutcomeInvalidPayload), "Station tidak valid", nil)
		return
	}

	data := h.service.GetDisplayData(station)

	respond.JSON(w, r, http.StatusOK, "ok", "Display data", map[string]interface{}{
		"display": data,
		"station": station,
	})
}

func (h *Handler) ListPickups(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	outcome := "ok"
	query := r.URL.Query()
	defer func() {
		if h.logger == nil {
			return
		}
		h.logger.InfoContext(r.Context(), "pickup list outcome",
			"request_id", contextutil.RequestIDFromContext(r.Context()),
			"outcome", outcome,
			"duration_ms", time.Since(start).Milliseconds(),
			"has_search", strings.TrimSpace(query.Get("q")) != "",
			"has_category", strings.TrimSpace(query.Get("category")) != "",
			"has_from", strings.TrimSpace(query.Get("picked_up_from")) != "",
			"has_to", strings.TrimSpace(query.Get("picked_up_to")) != "",
		)
	}()

	pickupQuery, ok := parsePickupListQuery(query)
	if !ok {
		outcome = string(OutcomeInvalidPayload)
		respond.JSON(w, r, OutcomeInvalidPayload.HTTPStatus(), string(OutcomeInvalidPayload), "Filter daftar pickup tidak valid", nil)
		return
	}

	result, err := h.service.ListPickups(r.Context(), pickupQuery)
	if errors.Is(err, ErrInvalidPickupListQuery) {
		outcome = string(OutcomeInvalidPayload)
		respond.JSON(w, r, OutcomeInvalidPayload.HTTPStatus(), string(OutcomeInvalidPayload), "Filter daftar pickup tidak valid", nil)
		return
	}
	if err != nil {
		outcome = string(OutcomeDatabaseUnavailable)
		respond.JSON(w, r, OutcomeDatabaseUnavailable.HTTPStatus(), string(OutcomeDatabaseUnavailable), OutcomeDatabaseUnavailable.Message(), nil)
		return
	}

	respond.JSON(w, r, http.StatusOK, "ok", "Daftar race pack yang sudah diambil", result)
}

func (h *Handler) Pickup(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	loggedOutcome := OutcomeInternalError
	orderID := ""
	operatorID := ""
	defer func() {
		h.logPickup(r, start, loggedOutcome, orderID, operatorID)
	}()

	path := strings.TrimPrefix(r.URL.Path, "/api/orders/")
	path = strings.TrimSuffix(path, "/pickup")

	parsedOrderID, outcome := ParseOrderULID(path)
	orderID = parsedOrderID
	if outcome != OutcomeValid {
		loggedOutcome = outcome
		respond.JSON(w, r, outcome.HTTPStatus(), string(outcome), outcome.Message(), nil)
		return
	}

	session, ok := auth.SessionFromContext(r.Context())
	if !ok {
		loggedOutcome = OutcomeUnauthenticated
		respond.JSON(w, r, OutcomeUnauthenticated.HTTPStatus(), string(OutcomeUnauthenticated), OutcomeUnauthenticated.Message(), nil)
		return
	}
	operatorID = session.UserID

	result, err := h.service.ConfirmPickup(r.Context(), orderID, session.UserID)
	if err != nil {
		loggedOutcome = OutcomeInternalError
		respond.JSON(w, r, OutcomeInternalError.HTTPStatus(), string(OutcomeInternalError), OutcomeInternalError.Message(), nil)
		return
	}
	loggedOutcome = result.Outcome

	data := map[string]interface{}{
		"order_id": orderID,
	}
	if result.PickedUpAt != nil {
		data["picked_up_at"] = *result.PickedUpAt
	}

	respond.JSON(w, r, result.Outcome.HTTPStatus(), string(result.Outcome), result.Outcome.Message(), data)
}

func parsePickupListQuery(values map[string][]string) (PickupListQuery, bool) {
	query := PickupListQuery{
		Search:   strings.TrimSpace(firstQueryValue(values, "q")),
		Category: strings.TrimSpace(firstQueryValue(values, "category")),
		Cursor:   strings.TrimSpace(firstQueryValue(values, "cursor")),
	}

	limitValue := strings.TrimSpace(firstQueryValue(values, "limit"))
	if limitValue != "" {
		limit, err := strconv.Atoi(limitValue)
		if err != nil {
			return PickupListQuery{}, false
		}
		query.Limit = limit
	}

	pickedUpFrom, ok := parseOptionalPickupTime(firstQueryValue(values, "picked_up_from"))
	if !ok {
		return PickupListQuery{}, false
	}
	query.PickedUpFrom = pickedUpFrom

	pickedUpTo, ok := parseOptionalPickupTime(firstQueryValue(values, "picked_up_to"))
	if !ok {
		return PickupListQuery{}, false
	}
	query.PickedUpTo = pickedUpTo

	return query, true
}

func firstQueryValue(values map[string][]string, key string) string {
	if len(values[key]) == 0 {
		return ""
	}
	return values[key][0]
}

func parseOptionalPickupTime(value string) (*time.Time, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, true
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil, false
	}
	return &parsed, true
}

func (h *Handler) logValidate(r *http.Request, start time.Time, outcome Outcome, station string, orderID string) {
	if h.logger == nil {
		return
	}
	h.logger.InfoContext(r.Context(), "scan validate outcome",
		"request_id", contextutil.RequestIDFromContext(r.Context()),
		"outcome", string(outcome),
		"duration_ms", time.Since(start).Milliseconds(),
		"station", station,
		"order_id_hash", hashID(orderID),
	)
}

func (h *Handler) logManualValidate(r *http.Request, start time.Time, outcome Outcome, station string, lookupType string, orderID string) {
	if h.logger == nil {
		return
	}
	h.logger.InfoContext(r.Context(), "manual scan validate outcome",
		"request_id", contextutil.RequestIDFromContext(r.Context()),
		"outcome", string(outcome),
		"duration_ms", time.Since(start).Milliseconds(),
		"station", station,
		"lookup_type", lookupType,
		"order_id_hash", hashID(orderID),
	)
}

func (h *Handler) logPickup(r *http.Request, start time.Time, outcome Outcome, orderID string, operatorID string) {
	if h.logger == nil {
		return
	}
	h.logger.InfoContext(r.Context(), "pickup outcome",
		"request_id", contextutil.RequestIDFromContext(r.Context()),
		"outcome", string(outcome),
		"duration_ms", time.Since(start).Milliseconds(),
		"order_id_hash", hashID(orderID),
		"operator_id_hash", hashID(operatorID),
	)
}
