package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/csrf"

	"fenturun2026-bib-scanner/internal/respond"
)

type contextKey string

const sessionContextKey contextKey = "session"

type Handler struct {
	service  *Service
	sessions *SessionManager
}

func NewHandler(service *Service, sessions *SessionManager) *Handler {
	return &Handler{service: service, sessions: sessions}
}

type loginRequest struct {
	Identity string `json:"identity"`
	Password string `json:"password"`
}

func (h *Handler) CSRFToken(w http.ResponseWriter, r *http.Request) {
	respond.JSON(w, r, http.StatusOK, "ok", "CSRF token", map[string]string{
		"token": csrf.Token(r),
	})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		respond.JSON(w, r, http.StatusUnprocessableEntity, "invalid_payload", "Format login tidak valid", nil)
		return
	}

	user, ok, err := h.service.Login(r.Context(), req.Identity, req.Password)
	if err != nil {
		respond.JSON(w, r, http.StatusServiceUnavailable, "database_unavailable", "Service belum siap", nil)
		return
	}
	if !ok {
		h.sessions.Clear(w)
		respond.JSON(w, r, http.StatusUnauthorized, "unauthenticated", "Username/email atau password tidak valid", nil)
		return
	}

	session := h.sessions.New(user.ID, time.Now())
	if err := h.sessions.Write(w, session); err != nil {
		respond.JSON(w, r, http.StatusInternalServerError, "internal_error", "Gagal membuat session", nil)
		return
	}

	respond.JSON(w, r, http.StatusOK, "valid", "Login berhasil", PublicSession{Authenticated: true, UserID: user.ID})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	h.sessions.Clear(w)
	respond.JSON(w, r, http.StatusOK, "valid", "Logout berhasil", PublicSession{Authenticated: false})
}

func (h *Handler) Session(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.Read(r, time.Now())
	if !ok {
		h.sessions.Clear(w)
		respond.JSON(w, r, http.StatusUnauthorized, "unauthenticated", "Session tidak valid", PublicSession{Authenticated: false})
		return
	}

	allowed, err := h.service.IsAuthorized(r.Context(), session.UserID)
	if err != nil {
		respond.JSON(w, r, http.StatusServiceUnavailable, "database_unavailable", "Service belum siap", nil)
		return
	}
	if !allowed {
		h.sessions.Clear(w)
		respond.JSON(w, r, http.StatusForbidden, "forbidden", "Anda tidak memiliki akses scanner", nil)
		return
	}

	h.sessions.Touch(w, session, time.Now())
	respond.JSON(w, r, http.StatusOK, "valid", "Session aktif", PublicSession{Authenticated: true, UserID: session.UserID})
}

func (h *Handler) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, ok := h.sessions.Read(r, time.Now())
		if !ok {
			h.sessions.Clear(w)
			respond.JSON(w, r, http.StatusUnauthorized, "unauthenticated", "Session tidak valid", nil)
			return
		}

		allowed, err := h.service.IsAuthorized(r.Context(), session.UserID)
		if err != nil {
			respond.JSON(w, r, http.StatusServiceUnavailable, "database_unavailable", "Service belum siap", nil)
			return
		}
		if !allowed {
			h.sessions.Clear(w)
			respond.JSON(w, r, http.StatusForbidden, "forbidden", "Anda tidak memiliki akses scanner", nil)
			return
		}

		h.sessions.Touch(w, session, time.Now())
		ctx := context.WithValue(r.Context(), sessionContextKey, session)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func SessionFromContext(ctx context.Context) (Session, bool) {
	session, ok := ctx.Value(sessionContextKey).(Session)
	return session, ok
}
