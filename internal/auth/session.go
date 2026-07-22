package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/gorilla/securecookie"
)

const (
	SecureCookieName = "__Host-fenturun_scanner_session"
	LocalCookieName  = "fenturun_scanner_session"
)

type SessionManager struct {
	codec           *securecookie.SecureCookie
	cookieName      string
	secure          bool
	idleTimeout     time.Duration
	absoluteTimeout time.Duration
}

func NewSessionManager(secret []byte, secure bool, idleTimeout time.Duration, absoluteTimeout time.Duration) *SessionManager {
	hashKey := deriveKey(secret, "hash")
	blockKey := deriveKey(secret, "block")[:32]
	codec := securecookie.New(hashKey, blockKey)
	codec.SetSerializer(securecookie.JSONEncoder{})
	codec.MaxAge(int(absoluteTimeout.Seconds()))

	cookieName := LocalCookieName
	if secure {
		cookieName = SecureCookieName
	}

	return &SessionManager{
		codec:           codec,
		cookieName:      cookieName,
		secure:          secure,
		idleTimeout:     idleTimeout,
		absoluteTimeout: absoluteTimeout,
	}
}

func (m *SessionManager) New(userID string, now time.Time) (Session, error) {
	sessionID, err := randomHex(16)
	if err != nil {
		return Session{}, err
	}
	return Session{
		UserID:       userID,
		IssuedAt:     now.UTC(),
		LastActivity: now.UTC(),
		Version:      1,
		SessionID:    sessionID,
	}, nil
}

func (m *SessionManager) Read(r *http.Request, now time.Time) (Session, bool) {
	cookie, err := r.Cookie(m.cookieName)
	if err != nil {
		return Session{}, false
	}
	var session Session
	if err := m.codec.Decode(m.cookieName, cookie.Value, &session); err != nil {
		return Session{}, false
	}
	if err := m.validate(session, now.UTC()); err != nil {
		return Session{}, false
	}
	return session, true
}

func (m *SessionManager) Write(w http.ResponseWriter, session Session) error {
	encoded, err := m.codec.Encode(m.cookieName, session)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     m.cookieName,
		Value:    encoded,
		Path:     "/",
		Secure:   m.secure,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int(m.absoluteTimeout.Seconds()),
	})
	return nil
}

func (m *SessionManager) Clear(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     m.cookieName,
		Value:    "",
		Path:     "/",
		Secure:   m.secure,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})
}

func (m *SessionManager) Touch(w http.ResponseWriter, session Session, now time.Time) {
	if now.UTC().Sub(session.LastActivity) < time.Minute {
		return
	}
	session.LastActivity = now.UTC()
	_ = m.Write(w, session)
}

func (m *SessionManager) validate(session Session, now time.Time) error {
	if session.Version != 1 || session.UserID == "" || session.SessionID == "" {
		return errors.New("invalid session")
	}
	if now.Sub(session.IssuedAt) > m.absoluteTimeout {
		return errors.New("session absolute timeout")
	}
	if now.Sub(session.LastActivity) > m.idleTimeout {
		return errors.New("session idle timeout")
	}
	if session.IssuedAt.After(now.Add(time.Minute)) || session.LastActivity.After(now.Add(time.Minute)) {
		return errors.New("session issued in future")
	}
	return nil
}

func deriveKey(secret []byte, label string) []byte {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte("fenturun2026-scanner-session:" + label))
	return mac.Sum(nil)
}

func randomHex(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
