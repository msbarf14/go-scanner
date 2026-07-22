package auth

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/csrf"

	"fenturun2026-bib-scanner/internal/respond"
)

type contextKey string

const sessionContextKey contextKey = "session"

type Handler struct {
	service           *Service
	sessions          *SessionManager
	trustedProxyCIDRs []*net.IPNet
}

func NewHandler(service *Service, sessions *SessionManager, trustedProxyCIDRs []*net.IPNet) *Handler {
	return &Handler{service: service, sessions: sessions, trustedProxyCIDRs: trustedProxyCIDRs}
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

	user, ok, err := h.service.Login(r.Context(), req.Identity, req.Password, h.clientIP(r))
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

func (h *Handler) clientIP(r *http.Request) string {
	remoteIP := parseRemoteIP(r.RemoteAddr)
	if remoteIP == nil {
		return ""
	}

	if h.isTrustedProxy(remoteIP) {
		if forwardedIP := parseForwardedIP(r.Header.Get("X-Forwarded-For")); forwardedIP != nil {
			return forwardedIP.String()
		}
		if realIP := net.ParseIP(strings.TrimSpace(r.Header.Get("X-Real-IP"))); realIP != nil {
			return realIP.String()
		}
	}

	return remoteIP.String()
}

func (h *Handler) isTrustedProxy(ip net.IP) bool {
	for _, cidr := range h.trustedProxyCIDRs {
		if cidr.Contains(ip) {
			return true
		}
	}
	return false
}

func parseRemoteIP(remoteAddr string) net.IP {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	return net.ParseIP(strings.TrimSpace(host))
}

func parseForwardedIP(header string) net.IP {
	for _, part := range strings.Split(header, ",") {
		if ip := net.ParseIP(strings.TrimSpace(part)); ip != nil {
			return ip
		}
	}
	return nil
}

func SessionFromContext(ctx context.Context) (Session, bool) {
	session, ok := ctx.Value(sessionContextKey).(Session)
	return session, ok
}
