package contextutil

import "context"

type contextKey string

const RequestIDKey contextKey = "request_id"

func RequestIDFromContext(ctx context.Context) string {
	if value, ok := ctx.Value(RequestIDKey).(string); ok {
		return value
	}
	return ""
}