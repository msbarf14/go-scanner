package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"fenturun2026-bib-scanner/internal/config"
)

type Store struct {
	Pool             *pgxpool.Pool
	StatementTimeout time.Duration
}

func Open(ctx context.Context, cfg config.Config) (*Store, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database config: %w", err)
	}
	poolConfig.MaxConns = cfg.DBMaxConnections
	poolConfig.MinConns = cfg.DBMinConnections
	poolConfig.ConnConfig.RuntimeParams["statement_timeout"] = fmt.Sprintf("%d", cfg.DBStatementTimeout.Milliseconds())
	poolConfig.ConnConfig.RuntimeParams["timezone"] = cfg.AppTimezone.String()

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("open database pool: %w", err)
	}

	return &Store{Pool: pool, StatementTimeout: cfg.DBStatementTimeout}, nil
}

func (s *Store) Close() {
	if s == nil || s.Pool == nil {
		return
	}
	s.Pool.Close()
}

func (s *Store) Ready(ctx context.Context) error {
	if s == nil || s.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	ctx, cancel := context.WithTimeout(ctx, s.StatementTimeout)
	defer cancel()
	return s.Pool.Ping(ctx)
}
