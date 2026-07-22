package scanner

import (
	"encoding/json"
	"log/slog"
	"net/http"
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
	station = req.Station

	parsedOrderID, outcome := ParseOrderULID(req.Payload)
	orderID = parsedOrderID
	if outcome != OutcomeValid {
		loggedOutcome = outcome
		respond.JSON(w, r, outcome.HTTPStatus(), string(outcome), outcome.Message(), nil)
		return
	}

	result, err := h.service.Validate(r.Context(), orderID, req.Station)
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

func (h *Handler) Display(w http.ResponseWriter, r *http.Request) {
	station := r.URL.Query().Get("station")
	if station == "" {
		station = "1"
	}

	data := h.service.GetDisplayData(station)

	respond.JSON(w, r, http.StatusOK, "ok", "Display data", map[string]interface{}{
		"display": data,
		"station": station,
	})
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
