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

//go:embed sql/lookup_external_participant.sql
var lookupExternalParticipantSQL string

//go:embed sql/resolve_order_suffix.sql
var resolveOrderSuffixSQL string

//go:embed sql/resolve_bib_number.sql
var resolveBIBNumberSQL string

//go:embed sql/resolve_external_bib.sql
var resolveExternalBIBSQL string

//go:embed sql/list_pickups.sql
var listPickupsSQL string

type Repository struct{ pool *pgxpool.Pool }

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

type OrderLookup struct {
	ID                 string
	Number             *string
	Status             *string
	DeletedAt          *time.Time
	RacePackPickedUpAt *time.Time
	RacePackPickedUpBy *string
	ParticipantID      *string
	ParticipantName    *string
	BibName            *string
	BIBNumber          *string
	UkuranJersey       *string
	TicketCategory     *string
	ParticipantCount   int
}

type ExternalParticipantLookup struct {
	ID                 string
	Name               *string
	BibName            *string
	BIBNumber          *string
	RacePackPickedUpAt *time.Time
	RacePackPickedUpBy *string
	TicketCategory     *string
}

type ManualLookupResolution struct {
	Target ScanTarget
	Count  int
}

func (r *Repository) ResolveManualLookup(ctx context.Context, source ManualLookupSource, lookupType ManualLookupType, value string) (ManualLookupResolution, error) {
	query := resolveOrderSuffixSQL
	targetType := TargetOrder
	if lookupType == ManualLookupBIBNumber {
		query = resolveBIBNumberSQL
	}
	if source == ManualSourceVIP {
		query = resolveExternalBIBSQL
		targetType = TargetExternalParticipant
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
	return ManualLookupResolution{Target: ScanTarget{Type: targetType, ID: ids[0]}, Count: 1}, nil
}

func (r *Repository) LookupOrder(ctx context.Context, id string) (*OrderLookup, error) {
	var o OrderLookup
	err := r.pool.QueryRow(ctx, lookupOrderSQL, id).Scan(&o.ID, &o.Number, &o.Status, &o.DeletedAt, &o.RacePackPickedUpAt, &o.RacePackPickedUpBy, &o.ParticipantID, &o.ParticipantName, &o.BibName, &o.BIBNumber, &o.UkuranJersey, &o.TicketCategory, &o.ParticipantCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &o, err
}

func (r *Repository) LookupExternalParticipant(ctx context.Context, id string) (*ExternalParticipantLookup, error) {
	var p ExternalParticipantLookup
	err := r.pool.QueryRow(ctx, lookupExternalParticipantSQL, id).Scan(&p.ID, &p.Name, &p.BibName, &p.BIBNumber, &p.RacePackPickedUpAt, &p.RacePackPickedUpBy, &p.TicketCategory)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &p, err
}

type PickupMutationResult struct {
	Outcome        Outcome
	Message        string
	PickedUpAt     *time.Time
	TicketCategory *string
}

func (r *Repository) ConfirmPickup(ctx context.Context, target ScanTarget, operatorID string, station int, logID string) (*PickupMutationResult, error) {
	if target.Type != TargetOrder && target.Type != TargetExternalParticipant {
		return &PickupMutationResult{Outcome: OutcomeInvalidPayload}, nil
	}
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	result, err := lockTarget(ctx, tx, target)
	if err != nil {
		return nil, err
	}
	if result.Outcome != OutcomeNotFound {
		decision := evaluateStationCategory(station, result.TicketCategory)
		if !decision.Allowed {
			return &PickupMutationResult{Outcome: OutcomeStationMismatch, Message: decision.Message}, nil
		}
	}
	if result.Outcome != OutcomeValid {
		if result.Outcome == OutcomeAlreadyPickedUp {
			if err := insertScanLog(ctx, tx, logID, target, operatorID, station, "duplicate_rejected"); err != nil {
				return nil, err
			}
			if err := tx.Commit(ctx); err != nil {
				return nil, err
			}
		}
		return result, nil
	}

	var pickedAt time.Time
	if target.Type == TargetOrder {
		err = tx.QueryRow(ctx, `UPDATE orders SET race_pack_picked_up_at = CURRENT_TIMESTAMP, race_pack_picked_up_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING race_pack_picked_up_at`, operatorID, target.ID).Scan(&pickedAt)
	} else {
		err = tx.QueryRow(ctx, `UPDATE external_participants SET race_pack_picked_up_at = CURRENT_TIMESTAMP, race_pack_picked_up_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING race_pack_picked_up_at`, operatorID, target.ID).Scan(&pickedAt)
	}
	if err != nil {
		return nil, err
	}
	if err := insertScanLog(ctx, tx, logID, target, operatorID, station, "handed_over"); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &PickupMutationResult{Outcome: OutcomePickedUp, PickedUpAt: &pickedAt}, nil
}

func (r *Repository) RecordScanResult(ctx context.Context, target ScanTarget, operatorID string, station int, logID string, result string) error {
	if target.Type != TargetOrder && target.Type != TargetExternalParticipant {
		return errors.New("invalid scan target type")
	}
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	locked, err := lockTarget(ctx, tx, target)
	if err != nil {
		return err
	}
	if locked.Outcome == OutcomeNotFound {
		return pgx.ErrNoRows
	}
	if err := insertScanLog(ctx, tx, logID, target, operatorID, station, result); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func lockTarget(ctx context.Context, tx pgx.Tx, target ScanTarget) (*PickupMutationResult, error) {
	if target.Type == TargetOrder {
		var status *string
		var deletedAt, pickedAt *time.Time
		var ticketCategory *string
		var participantCount int
		err := tx.QueryRow(ctx, `
			SELECT o.status, o.deleted_at, o.race_pack_picked_up_at,
				(SELECT COUNT(*) FROM participants WHERE order_id = o.id),
				COALESCE(tparent.name, t.name)
			FROM orders o
			LEFT JOIN tickets t ON t.id = o.ticket_id
			LEFT JOIN tickets tparent ON tparent.id = t.parent_id
			WHERE o.id = $1
			FOR UPDATE OF o`, target.ID).Scan(&status, &deletedAt, &pickedAt, &participantCount, &ticketCategory)
		if errors.Is(err, pgx.ErrNoRows) || deletedAt != nil {
			return &PickupMutationResult{Outcome: OutcomeNotFound}, nil
		}
		if err != nil {
			return nil, err
		}
		if status == nil || *status != "paid" {
			return &PickupMutationResult{Outcome: OutcomeNotPaid, TicketCategory: ticketCategory}, nil
		}
		if participantCount == 0 {
			return &PickupMutationResult{Outcome: OutcomeParticipantMissing, TicketCategory: ticketCategory}, nil
		}
		if participantCount > 1 {
			return &PickupMutationResult{Outcome: OutcomeMultipleParticipants, TicketCategory: ticketCategory}, nil
		}
		if pickedAt != nil {
			return &PickupMutationResult{Outcome: OutcomeAlreadyPickedUp, PickedUpAt: pickedAt, TicketCategory: ticketCategory}, nil
		}
		return &PickupMutationResult{Outcome: OutcomeValid, TicketCategory: ticketCategory}, nil
	}

	var deletedAt, pickedAt *time.Time
	var ticketCategory *string
	err := tx.QueryRow(ctx, `
		SELECT ep.deleted_at, ep.race_pack_picked_up_at, t.name
		FROM external_participants ep
		LEFT JOIN tickets t ON t.id = ep.category_ticket_id
		WHERE ep.id = $1
		FOR UPDATE OF ep`, target.ID).Scan(&deletedAt, &pickedAt, &ticketCategory)
	if errors.Is(err, pgx.ErrNoRows) || deletedAt != nil {
		return &PickupMutationResult{Outcome: OutcomeNotFound}, nil
	}
	if err != nil {
		return nil, err
	}
	if pickedAt != nil {
		return &PickupMutationResult{Outcome: OutcomeAlreadyPickedUp, PickedUpAt: pickedAt, TicketCategory: ticketCategory}, nil
	}
	return &PickupMutationResult{Outcome: OutcomeValid, TicketCategory: ticketCategory}, nil
}

func insertScanLog(ctx context.Context, tx pgx.Tx, logID string, target ScanTarget, operatorID string, station int, result string) error {
	var orderID, externalID any
	if target.Type == TargetOrder {
		orderID = target.ID
	} else {
		externalID = target.ID
	}
	_, err := tx.Exec(ctx, `INSERT INTO race_pack_scan_logs (id, order_id, external_participant_id, scanned_by, result, station, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, logID, orderID, externalID, operatorID, result, station)
	return err
}

type PickupListFilter struct {
	SearchPattern string
	Category      string
	PickedUpFrom  *time.Time
	PickedUpTo    *time.Time
	CursorTime    *time.Time
	CursorType    TargetType
	CursorID      string
	Limit         int
}

type PickupListRow struct {
	TargetType      TargetType
	TargetID        string
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
	rows, err := r.pool.Query(ctx, listPickupsSQL, filter.SearchPattern, filter.Category, filter.PickedUpFrom, filter.PickedUpTo, filter.CursorTime, filter.CursorType, filter.CursorID, filter.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	results := []PickupListRow{}
	for rows.Next() {
		var row PickupListRow
		if err := rows.Scan(&row.TargetType, &row.TargetID, &row.OrderNumber, &row.OrderStatus, &row.PickedUpAt, &row.ParticipantName, &row.BibName, &row.BIBNumber, &row.JerseySize, &row.TicketCategory, &row.PickedUpByName); err != nil {
			return nil, err
		}
		results = append(results, row)
	}
	return results, rows.Err()
}
