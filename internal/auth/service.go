package auth

import (
	"context"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"
)

const dummyHash = "$2y$12$BthihhEwJ.8OVJidzVoCMugOj4P.E7DNEGfBcb9dpmDObkQmPk/TS"

type Service struct {
	repo        *Repository
	roles       []string
	permissions []string
	limiter     *rate.Limiter
}

func NewService(repo *Repository, roles []string, permissions []string) *Service {
	return &Service{
		repo:        repo,
		roles:       roles,
		permissions: permissions,
		limiter:     rate.NewLimiter(rate.Every(200*time.Millisecond), 5),
	}
}

func (s *Service) Login(ctx context.Context, identity string, password string) (User, bool, error) {
	if !s.limiter.Allow() {
		return User{}, false, nil
	}

	identity = strings.TrimSpace(identity)
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

func compare(hash string, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
