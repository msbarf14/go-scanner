package config

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppEnv                  string
	HTTPAddr                string
	PublicBaseURL           *url.URL
	DatabaseURL             string
	DBMaxConnections        int32
	DBMinConnections        int32
	DBStatementTimeout      time.Duration
	SessionSecret           []byte
	SessionIdleTimeout      time.Duration
	SessionAbsoluteTimeout  time.Duration
	AllowedScannerRoles     []string
	AllowedScannerPerms     []string
	DefaultOperatorID       string
	AppTimezone             *time.Location
	LogLevel                slog.Level
	TrustedProxyCIDRs       []*net.IPNet
}

func Load() (Config, error) {
	var cfg Config
	var err error

	cfg.AppEnv = getenv("APP_ENV", "development")
	cfg.HTTPAddr = getenv("HTTP_ADDR", ":8080")

	cfg.PublicBaseURL, err = parseBaseURL(getenv("PUBLIC_BASE_URL", "http://localhost:8080"), cfg.AppEnv)
	if err != nil {
		return cfg, err
	}

	cfg.DatabaseURL, err = buildDatabaseURL()
	if err != nil {
		return cfg, err
	}

	maxConns, err := parseInt32("DB_MAX_CONNECTIONS", 10)
	if err != nil {
		return cfg, err
	}
	minConns, err := parseInt32("DB_MIN_CONNECTIONS", 1)
	if err != nil {
		return cfg, err
	}
	if minConns > maxConns {
		return cfg, errors.New("DB_MIN_CONNECTIONS must not exceed DB_MAX_CONNECTIONS")
	}
	cfg.DBMaxConnections = maxConns
	cfg.DBMinConnections = minConns

	cfg.DBStatementTimeout, err = parseDuration("DB_STATEMENT_TIMEOUT", 3*time.Second)
	if err != nil {
		return cfg, err
	}
	if cfg.DBStatementTimeout <= 0 {
		return cfg, errors.New("DB_STATEMENT_TIMEOUT must be positive")
	}

	cfg.SessionSecret, err = parseSecret(os.Getenv("SESSION_SECRET"), cfg.AppEnv)
	if err != nil {
		return cfg, err
	}

	cfg.SessionIdleTimeout, err = parseDuration("SESSION_IDLE_TIMEOUT", 30*time.Minute)
	if err != nil {
		return cfg, err
	}
	cfg.SessionAbsoluteTimeout, err = parseDuration("SESSION_ABSOLUTE_TIMEOUT", 8*time.Hour)
	if err != nil {
		return cfg, err
	}
	if cfg.SessionIdleTimeout <= 0 || cfg.SessionAbsoluteTimeout <= 0 {
		return cfg, errors.New("session timeouts must be positive")
	}
	if cfg.SessionIdleTimeout >= cfg.SessionAbsoluteTimeout {
		return cfg, errors.New("SESSION_IDLE_TIMEOUT must be lower than SESSION_ABSOLUTE_TIMEOUT")
	}

	cfg.AllowedScannerRoles = parseCSV(getenv("ALLOWED_SCANNER_ROLES", "admin,super_admin"))
	if len(cfg.AllowedScannerRoles) == 0 {
		return cfg, errors.New("ALLOWED_SCANNER_ROLES must not be empty")
	}
	cfg.AllowedScannerPerms = parseCSV(getenv("ALLOWED_SCANNER_PERMISSIONS", "scanner.access"))

	cfg.DefaultOperatorID = strings.TrimSpace(os.Getenv("DEFAULT_OPERATOR_ID"))
	if cfg.DefaultOperatorID == "" {
		return cfg, errors.New("DEFAULT_OPERATOR_ID is required")
	}

	cfg.AppTimezone, err = time.LoadLocation(getenv("APP_TIMEZONE", "Asia/Makassar"))
	if err != nil {
		return cfg, fmt.Errorf("APP_TIMEZONE: %w", err)
	}

	cfg.LogLevel, err = parseLogLevel(getenv("LOG_LEVEL", "info"))
	if err != nil {
		return cfg, err
	}

	cfg.TrustedProxyCIDRs, err = parseCIDRs(os.Getenv("TRUSTED_PROXY_CIDRS"))
	if err != nil {
		return cfg, err
	}

	return cfg, nil
}

func buildDatabaseURL() (string, error) {
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL != "" {
		return databaseURL, nil
	}

	host := getenv("DB_HOST", "127.0.0.1")
	port := getenv("DB_PORT", "5432")
	database := strings.TrimSpace(os.Getenv("DB_DATABASE"))
	username := strings.TrimSpace(os.Getenv("DB_USERNAME"))
	password := os.Getenv("DB_PASSWORD")
	sslmode := getenv("DB_SSLMODE", "disable")

	if database == "" {
		return "", errors.New("DB_DATABASE is required")
	}
	if username == "" {
		return "", errors.New("DB_USERNAME is required")
	}

	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(username, password),
		Host:   net.JoinHostPort(host, port),
		Path:   database,
	}
	q := u.Query()
	q.Set("sslmode", sslmode)
	u.RawQuery = q.Encode()

	return u.String(), nil
}

func (c Config) IsProduction() bool {
	return c.AppEnv == "production"
}

func getenv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func parseBaseURL(raw string, env string) (*url.URL, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return nil, fmt.Errorf("PUBLIC_BASE_URL: %w", err)
	}
	if u.Scheme == "" || u.Host == "" {
		return nil, errors.New("PUBLIC_BASE_URL must be an absolute URL")
	}
	if env == "production" && u.Scheme != "https" {
		return nil, errors.New("PUBLIC_BASE_URL must use https in production")
	}
	return u, nil
}

func parseInt32(key string, fallback int32) (int32, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.ParseInt(raw, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("%s: %w", key, err)
	}
	if value < 0 {
		return 0, fmt.Errorf("%s must not be negative", key)
	}
	return int32(value), nil
}

func parseDuration(key string, fallback time.Duration) (time.Duration, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback, nil
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("%s: %w", key, err)
	}
	return value, nil
}

func parseSecret(raw string, env string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		if env == "production" {
			return nil, errors.New("SESSION_SECRET is required in production")
		}
		sum := sha256.Sum256([]byte("fenturun2026-scanner-development-session-secret"))
		return sum[:], nil
	}

	decoded, err := base64.StdEncoding.DecodeString(raw)
	if err == nil && len(decoded) >= 32 {
		return decoded, nil
	}
	if len(raw) < 32 {
		return nil, errors.New("SESSION_SECRET must be at least 32 bytes or base64 encoded 32 bytes")
	}
	return []byte(raw), nil
}

func parseCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		value := strings.TrimSpace(part)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		values = append(values, value)
	}
	return values
}

func parseLogLevel(raw string) (slog.Level, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "debug":
		return slog.LevelDebug, nil
	case "info":
		return slog.LevelInfo, nil
	case "warn", "warning":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return slog.LevelInfo, fmt.Errorf("LOG_LEVEL %q is not supported", raw)
	}
}

func parseCIDRs(raw string) ([]*net.IPNet, error) {
	values := parseCSV(raw)
	cidrs := make([]*net.IPNet, 0, len(values))
	for _, value := range values {
		_, cidr, err := net.ParseCIDR(value)
		if err != nil {
			return nil, fmt.Errorf("TRUSTED_PROXY_CIDRS: %w", err)
		}
		cidrs = append(cidrs, cidr)
	}
	return cidrs, nil
}
