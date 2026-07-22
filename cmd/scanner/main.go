package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata"

	"github.com/joho/godotenv"

	"fenturun2026-bib-scanner/internal/auth"
	"fenturun2026-bib-scanner/internal/config"
	"fenturun2026-bib-scanner/internal/httpapi"
	"fenturun2026-bib-scanner/internal/scanner"
	"fenturun2026-bib-scanner/internal/store"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
}

func run() error {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := newLogger(cfg)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := store.Open(ctx, cfg)
	if err != nil {
		return err
	}
	defer db.Close()

	authRepo := auth.NewRepository(db.Pool)
	authService := auth.NewService(authRepo, cfg.AllowedScannerRoles, cfg.AllowedScannerPerms)
	sessionManager := auth.NewSessionManager(cfg.SessionSecret, cfg.PublicBaseURL.Scheme == "https", cfg.SessionIdleTimeout, cfg.SessionAbsoluteTimeout)
	authHandler := auth.NewHandler(authService, sessionManager, cfg.TrustedProxyCIDRs)

	scannerRepo := scanner.NewRepository(db.Pool)
	scannerService := scanner.NewService(scannerRepo, logger)
	scannerHandler := scanner.NewHandler(scannerService, logger)

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           httpapi.NewRouter(httpapi.Deps{Store: db, Logger: logger, Auth: authHandler, Scanner: scannerHandler, BaseURL: cfg.PublicBaseURL, CSRFSecret: cfg.SessionSecret, Production: cfg.IsProduction()}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("starting scanner service", "addr", cfg.HTTPAddr, "env", cfg.AppEnv)
		serverErr <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	case err := <-serverErr:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown server: %w", err)
	}
	logger.Info("scanner service stopped")
	return nil
}

func newLogger(cfg config.Config) *slog.Logger {
	options := &slog.HandlerOptions{Level: cfg.LogLevel}
	if cfg.IsProduction() {
		return slog.New(slog.NewJSONHandler(os.Stdout, options))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, options))
}
