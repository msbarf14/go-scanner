package httpapi

import (
	"encoding/json"
	"net/http"
)

type Envelope struct {
	Outcome   string      `json:"outcome"`
	Message   string      `json:"message"`
	RequestID string      `json:"request_id"`
	Data      any         `json:"data,omitempty"`
}

func WriteJSON(w http.ResponseWriter, r *http.Request, status int, outcome string, message string, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(Envelope{
		Outcome:   outcome,
		Message:   message,
		RequestID: RequestIDFromContext(r.Context()),
		Data:      data,
	})
}
