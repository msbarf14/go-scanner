package scanner

import (
	"encoding/json"
	"net/http"
	"strings"

	"fenturun2026-bib-scanner/internal/respond"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type validateRequest struct {
	Payload string `json:"payload"`
}

func (h *Handler) Validate(w http.ResponseWriter, r *http.Request) {
	var req validateRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		respond.JSON(w, r, OutcomeInvalidPayload.HTTPStatus(), string(OutcomeInvalidPayload), OutcomeInvalidPayload.Message(), nil)
		return
	}

	orderID, outcome := ParseOrderULID(req.Payload)
	if outcome != OutcomeValid {
		respond.JSON(w, r, outcome.HTTPStatus(), string(outcome), outcome.Message(), nil)
		return
	}

	result, err := h.service.Validate(r.Context(), orderID)
	if err != nil {
		respond.JSON(w, r, OutcomeInternalError.HTTPStatus(), string(OutcomeInternalError), OutcomeInternalError.Message(), nil)
		return
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

func (h *Handler) Pickup(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/orders/")
	path = strings.TrimSuffix(path, "/pickup")

	orderID, outcome := ParseOrderULID(path)
	if outcome != OutcomeValid {
		respond.JSON(w, r, outcome.HTTPStatus(), string(outcome), outcome.Message(), nil)
		return
	}

	operatorID := h.service.DefaultOperatorID()

	result, err := h.service.ConfirmPickup(r.Context(), orderID, operatorID)
	if err != nil {
		respond.JSON(w, r, OutcomeInternalError.HTTPStatus(), string(OutcomeInternalError), OutcomeInternalError.Message(), nil)
		return
	}

	data := map[string]interface{}{
		"order_id": orderID,
	}
	if result.PickedUpAt != nil {
		data["picked_up_at"] = *result.PickedUpAt
	}

	respond.JSON(w, r, result.Outcome.HTTPStatus(), string(result.Outcome), result.Outcome.Message(), data)
}
