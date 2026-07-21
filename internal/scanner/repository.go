package scanner

import (
	"context"
	_ "embed"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed sql/lookup_order.sql
var lookupOrderSQL string

//go:embed sql/pickup.sql
var pickupSQL string

//go:embed sql/diagnose_pickup.sql
var diagnosePickupSQL string

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type OrderLookup struct {
	ID                   string
	Number               *string
	Status               *string
	DeletedAt            *time.Time
	RacePackPickedUpAt   *time.Time
	RacePackPickedUpBy   *string
	ParticipantID        *string
	ParticipantName      *string
	BibName              *string
	BIBNumber            *string
	UkuranJersey         *string
	TicketCategory       *string
	ParticipantCount     int
}

func (r *Repository) LookupOrder(ctx context.Context, orderID string) (*OrderLookup, error) {
	var o OrderLookup
	err := r.pool.QueryRow(ctx, lookupOrderSQL, orderID).Scan(
		&o.ID,
		&o.Number,
		&o.Status,
		&o.DeletedAt,
		&o.RacePackPickedUpAt,
		&o.RacePackPickedUpBy,
		&o.ParticipantID,
		&o.ParticipantName,
		&o.BibName,
		&o.BIBNumber,
		&o.UkuranJersey,
		&o.TicketCategory,
		&o.ParticipantCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

type PickupResult struct {
	ID                 string
	RacePackPickedUpAt time.Time
	RacePackPickedUpBy string
}

func (r *Repository) ConfirmPickup(ctx context.Context, orderID string, operatorID string) (*PickupResult, error) {
	var pr PickupResult
	err := r.pool.QueryRow(ctx, pickupSQL, operatorID, orderID).Scan(
		&pr.ID,
		&pr.RacePackPickedUpAt,
		&pr.RacePackPickedUpBy,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &pr, nil
}

type DiagnoseResult struct {
	ID                 string
	Status             *string
	DeletedAt          *time.Time
	RacePackPickedUpAt *time.Time
	RacePackPickedUpBy *string
	ParticipantCount   int
}

func (r *Repository) DiagnosePickup(ctx context.Context, orderID string) (*DiagnoseResult, error) {
	var d DiagnoseResult
	err := r.pool.QueryRow(ctx, diagnosePickupSQL, orderID).Scan(
		&d.ID,
		&d.Status,
		&d.DeletedAt,
		&d.RacePackPickedUpAt,
		&d.RacePackPickedUpBy,
		&d.ParticipantCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}