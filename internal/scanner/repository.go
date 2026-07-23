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

//go:embed sql/resolve_order_suffix.sql
var resolveOrderSuffixSQL string

//go:embed sql/resolve_bib_number.sql
var resolveBIBNumberSQL string

//go:embed sql/pickup.sql
var pickupSQL string

//go:embed sql/diagnose_pickup.sql
var diagnosePickupSQL string

//go:embed sql/list_pickups.sql
var listPickupsSQL string

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

type ManualLookupResolution struct {
	OrderID string
	Count   int
}

func (r *Repository) ResolveManualLookup(ctx context.Context, lookupType ManualLookupType, value string) (ManualLookupResolution, error) {
	query := resolveOrderSuffixSQL
	if lookupType == ManualLookupBIBNumber {
		query = resolveBIBNumberSQL
	}

	rows, err := r.pool.Query(ctx, query, value)
	if err != nil {
		return ManualLookupResolution{}, err
	}
	defer rows.Close()

	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return ManualLookupResolution{}, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return ManualLookupResolution{}, err
	}
	if len(ids) != 1 {
		return ManualLookupResolution{Count: len(ids)}, nil
	}
	return ManualLookupResolution{OrderID: ids[0], Count: 1}, nil
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

type PickupListFilter struct {
	SearchPattern string
	Category      string
	PickedUpFrom  *time.Time
	PickedUpTo    *time.Time
	CursorTime    *time.Time
	CursorID      string
	Limit         int
}

type PickupListRow struct {
	OrderID         string
	OrderNumber     *string
	OrderStatus     *string
	PickedUpAt      time.Time
	ParticipantName *string
	BibName         *string
	BIBNumber       *string
	JerseySize      *string
	TicketCategory  *string
	PickedUpByName  *string
}

func (r *Repository) ListPickups(ctx context.Context, filter PickupListFilter) ([]PickupListRow, error) {
	rows, err := r.pool.Query(ctx, listPickupsSQL,
		filter.SearchPattern,
		filter.Category,
		filter.PickedUpFrom,
		filter.PickedUpTo,
		filter.CursorTime,
		filter.CursorID,
		filter.Limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []PickupListRow{}
	for rows.Next() {
		var row PickupListRow
		if err := rows.Scan(
			&row.OrderID,
			&row.OrderNumber,
			&row.OrderStatus,
			&row.PickedUpAt,
			&row.ParticipantName,
			&row.BibName,
			&row.BIBNumber,
			&row.JerseySize,
			&row.TicketCategory,
			&row.PickedUpByName,
		); err != nil {
			return nil, err
		}
		results = append(results, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}