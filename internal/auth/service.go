package auth

import (
	"context"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"
)

const dummyHash = "$2y$12$BthihhEwJ.8OVJidzVoCMugOj4P.E7DNEGfBcb9dpmDObkQmPk/TS"

const (
	loginLimiterEvery      = 200 * time.Millisecond
	loginLimiterBurst      = 5
	loginLimiterTTL        = 15 * time.Minute
	loginLimiterMaxEntries = 2048
)

type loginLimiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type Service struct {
	repo          *Repository
	roles         []string
	permissions   []string
	limitersMu    sync.Mutex
	loginLimiters map[string]*loginLimiterEntry
}

func NewService(repo *Repository, roles []string, permissions []string) *Service {
	return &Service{
		repo:          repo,
		roles:         roles,
		permissions:   permissions,
		loginLimiters: make(map[string]*loginLimiterEntry),
	}
}

func (s *Service) Login(ctx context.Context, identity string, password string, clientIP string) (User, bool, error) {
	identity = strings.TrimSpace(identity)
	if !s.allowLoginAttempt(identity, clientIP, time.Now()) {
		return User{}, false, nil
	}
	if identity == "" || len(identity) > 255 || password == "" || len(password) > 1024 {
		compare(dummyHash, password)
		return User{}, false, nil
	}

	user, found, err := s.repo.FindUserByIdentity(ctx, identity)
	if err != nil {
		return User{}, false, err
	}

	hash := dummyHash
	if found {
		hash = user.PasswordHash
	}
	if !compare(hash, password) || !found {
		return User{}, false, nil
	}

	allowed, err := s.repo.IsAuthorized(ctx, user.ID, s.roles, s.permissions)
	if err != nil {
		return User{}, false, err
	}
	if !allowed {
		return User{}, false, nil
	}

	return user, true, nil
}

func (s *Service) IsAuthorized(ctx context.Context, userID string) (bool, error) {
	return s.repo.IsAuthorized(ctx, userID, s.roles, s.permissions)
}

func (s *Service) allowLoginAttempt(identity string, clientIP string, now time.Time) bool {
	key := loginLimiterKey(identity, clientIP)

	s.limitersMu.Lock()
	defer s.limitersMu.Unlock()

	if len(s.loginLimiters) >= loginLimiterMaxEntries {
		s.cleanupLoginLimiters(now)
	}

	entry, ok := s.loginLimiters[key]
	if !ok {
		if len(s.loginLimiters) >= loginLimiterMaxEntries {
			return false
		}
		entry = &loginLimiterEntry{limiter: rate.NewLimiter(rate.Every(loginLimiterEvery), loginLimiterBurst)}
		s.loginLimiters[key] = entry
	}

	entry.lastSeen = now
	return entry.limiter.AllowN(now, 1)
}

func (s *Service) cleanupLoginLimiters(now time.Time) {
	for key, entry := range s.loginLimiters {
		if now.Sub(entry.lastSeen) > loginLimiterTTL {
			delete(s.loginLimiters, key)
		}
	}
}

func loginLimiterKey(identity string, clientIP string) string {
	identity = strings.ToLower(strings.TrimSpace(identity))
	if len(identity) > 255 {
		identity = identity[:255]
	}
	if identity == "" {
		identity = "-"
	}

	clientIP = strings.TrimSpace(clientIP)
	if clientIP == "" {
		clientIP = "-"
	}

	return identity + "|" + clientIP
}

func compare(hash string, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
