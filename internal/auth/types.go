package auth

import "time"

type User struct {
	ID           string
	Name         string
	PasswordHash string
}

type Session struct {
	UserID       string    `json:"uid"`
	IssuedAt     time.Time `json:"iat"`
	LastActivity time.Time `json:"lat"`
	Version      int       `json:"ver"`
	SessionID    string    `json:"sid"`
}

type PublicSession struct {
	Authenticated bool   `json:"authenticated"`
	UserID        string `json:"user_id,omitempty"`
}
