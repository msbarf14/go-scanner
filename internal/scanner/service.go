package scanner

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"fenturun2026-bib-scanner/internal/cache"
	"github.com/jackc/pgx/v5"
	"github.com/oklog/ulid/v2"
)

const (
	maxDisplayCacheEntries    = 128
	defaultPickupListLimit    = 50
	maxPickupListLimit        = 100
	maxPickupListSearchLength = 100
)

var ErrInvalidPickupListQuery = errors.New("invalid pickup list query")

type Service struct {
	repo         *Repository
	logger       *slog.Logger
	displayCache *cache.Cache
}

func NewService(repo *Repository, logger *slog.Logger) *Service {
	return &Service{
		repo:         repo,
		logger:       logger,
		displayCache: cache.NewWithMax(maxDisplayCacheEntries),
	}
}

type ValidateResult struct {
	Outcome     Outcome
	Target      *TargetInfo
	Order       *OrderInfo
	Participant *ParticipantInfo
	Ticket      *TicketInfo
}

type TargetInfo struct {
	Type               TargetType `json:"type"`
	ID                 string     `json:"id"`
	Number             *string    `json:"number,omitempty"`
	RacePackPickedUp   bool       `json:"race_pack_picked_up"`
	RacePackPickedUpAt *string    `json:"race_pack_picked_up_at,omitempty"`
}

type OrderInfo struct {
	ID                 string  `json:"id"`
	Number             *string `json:"number,omitempty"`
	Status             *string `json:"status,omitempty"`
	RacePackPickedUp   bool    `json:"race_pack_picked_up"`
	RacePackPickedUpAt *string `json:"race_pack_picked_up_at,omitempty"`
}

type ParticipantInfo struct {
	Name         *string `json:"name"`
	BibName      *string `json:"bib_name,omitempty"`
	BIBNumber    *string `json:"bib_number,omitempty"`
	UkuranJersey *string `json:"jersey_size,omitempty"`
}

type TicketInfo struct {
	Category *string `json:"category,omitempty"`
}

type DisplayData struct {
	Version     int              `json:"v"`
	ScanID      string           `json:"scan_id"`
	Outcome     Outcome          `json:"outcome"`
	Message     string           `json:"message"`
	Type        TargetType       `json:"type,omitempty"`
	ID          string           `json:"id,omitempty"`
	Target      *TargetInfo      `json:"target,omitempty"`
	Order       *OrderInfo       `json:"order,omitempty"`
	Participant *ParticipantInfo `json:"participant,omitempty"`
	Ticket      *TicketInfo      `json:"ticket,omitempty"`
	ScannedAt   string           `json:"scanned_at"`
}

type PickupListQuery struct {
	Search       string
	Category     string
	PickedUpFrom *time.Time
	PickedUpTo   *time.Time
	Cursor       string
	Limit        int
}

type PickupListResponse struct {
	Items []PickupListItem `json:"items"`
	Page  PickupListPage   `json:"page"`
}

type PickupListPage struct {
	Limit      int     `json:"limit"`
	HasMore    bool    `json:"has_more"`
	NextCursor *string `json:"next_cursor,omitempty"`
}

type PickupListItem struct {
	Target      ScanTarget            `json:"target"`
	Order       PickupListOrder       `json:"order"`
	Participant PickupListParticipant `json:"participant"`
	Ticket      PickupListTicket      `json:"ticket"`
	Operator    PickupListOperator    `json:"operator"`
}

type PickupListOrder struct {
	ID         string  `json:"id"`
	Number     *string `json:"number,omitempty"`
	Status     *string `json:"status,omitempty"`
	PickedUpAt string  `json:"picked_up_at"`
}

type PickupListParticipant struct {
	Name       *string `json:"name,omitempty"`
	BibName    *string `json:"bib_name,omitempty"`
	BIBNumber  *string `json:"bib_number,omitempty"`
	JerseySize *string `json:"jersey_size,omitempty"`
}

type PickupListTicket struct {
	Category *string `json:"category,omitempty"`
}

type PickupListOperator struct {
	Name *string `json:"name,omitempty"`
}

type pickupListCursor struct {
	PickedUpAt string     `json:"picked_up_at"`
	TargetType TargetType `json:"target_type,omitempty"`
	TargetID   string     `json:"target_id,omitempty"`
	OrderID    string     `json:"order_id,omitempty"`
}

func (s *Service) ValidateManualLookup(ctx context.Context, sourceValue string, lookupType string, payload string, station string) (*ValidateResult, error) {
	manualLookupType, value, outcome := ParseManualLookup(lookupType, payload)
	if outcome != OutcomeValid {
		s.PublishDisplayOutcome(ctx, station, outcome)
		return &ValidateResult{Outcome: outcome}, nil
	}

	source, ok := ParseManualSource(sourceValue)
	if !ok || (source == ManualSourceVIP && manualLookupType == ManualLookupOrderSuffix) {
		s.PublishDisplayOutcome(ctx, station, OutcomeInvalidPayload)
		return &ValidateResult{Outcome: OutcomeInvalidPayload}, nil
	}
	resolution, err := s.repo.ResolveManualLookup(ctx, source, manualLookupType, value)
	if err != nil {
		if s.logger != nil {
			s.logger.ErrorContext(ctx, "manual lookup failed", "error", err, "lookup_type", string(manualLookupType), "source", source)
		}
		s.PublishDisplayOutcome(ctx, station, OutcomeDatabaseUnavailable)
		return &ValidateResult{Outcome: OutcomeDatabaseUnavailable}, nil
	}
	if resolution.Count == 0 {
		s.PublishDisplayOutcome(ctx, station, OutcomeNotFound)
		return &ValidateResult{Outcome: OutcomeNotFound}, nil
	}
	if resolution.Count > 1 {
		s.PublishDisplayOutcome(ctx, station, OutcomeAmbiguousLookup)
		return &ValidateResult{Outcome: OutcomeAmbiguousLookup}, nil
	}

	return s.Validate(ctx, resolution.Target, station)
}

func (s *Service) Validate(ctx context.Context, target ScanTarget, station string) (*ValidateResult, error) {
	if target.Type != TargetOrder && target.Type != TargetExternalParticipant {
		s.PublishDisplayOutcome(ctx, station, OutcomeInvalidPayload)
		return &ValidateResult{Outcome: OutcomeInvalidPayload}, nil
	}
	if target.Type == TargetExternalParticipant {
		return s.validateExternal(ctx, target, station)
	}
	lookup, err := s.repo.LookupOrder(ctx, target.ID)
	if err != nil {
		s.logError(ctx, "lookup order failed", err, target)
		s.PublishDisplayOutcome(ctx, station, OutcomeDatabaseUnavailable)
		return &ValidateResult{Outcome: OutcomeDatabaseUnavailable}, nil
	}

	if lookup == nil {
		s.PublishDisplayOutcome(ctx, station, OutcomeNotFound)
		return &ValidateResult{Outcome: OutcomeNotFound}, nil
	}

	if lookup.Status == nil || *lookup.Status != "paid" {
		s.PublishDisplayOutcome(ctx, station, OutcomeNotPaid)
		return &ValidateResult{Outcome: OutcomeNotPaid}, nil
	}

	if lookup.ParticipantCount == 0 {
		s.PublishDisplayOutcome(ctx, station, OutcomeParticipantMissing)
		return &ValidateResult{Outcome: OutcomeParticipantMissing}, nil
	}

	if lookup.ParticipantCount > 1 {
		s.PublishDisplayOutcome(ctx, station, OutcomeMultipleParticipants)
		return &ValidateResult{Outcome: OutcomeMultipleParticipants}, nil
	}

	result := &ValidateResult{
		Outcome: OutcomeValid,
		Target:  &TargetInfo{Type: target.Type, ID: lookup.ID, Number: lookup.Number, RacePackPickedUp: lookup.RacePackPickedUpAt != nil},
		Order: &OrderInfo{
			ID:               lookup.ID,
			Number:           lookup.Number,
			Status:           lookup.Status,
			RacePackPickedUp: lookup.RacePackPickedUpAt != nil,
		},
		Participant: &ParticipantInfo{
			Name:         lookup.ParticipantName,
			BibName:      lookup.BibName,
			BIBNumber:    lookup.BIBNumber,
			UkuranJersey: lookup.UkuranJersey,
		},
		Ticket: &TicketInfo{
			Category: lookup.TicketCategory,
		},
	}

	if lookup.RacePackPickedUpAt != nil {
		pickedUpAt := lookup.RacePackPickedUpAt.Format("2006-01-02T15:04:05+08:00")
		result.Outcome = OutcomeAlreadyPickedUp
		result.Order.RacePackPickedUpAt = &pickedUpAt
		result.Target.RacePackPickedUpAt = &pickedUpAt
	}
	s.publishDisplay(ctx, station, target, result)
	return result, nil
}

func (s *Service) validateExternal(ctx context.Context, target ScanTarget, station string) (*ValidateResult, error) {
	lookup, err := s.repo.LookupExternalParticipant(ctx, target.ID)
	if err != nil {
		s.logError(ctx, "lookup external participant failed", err, target)
		s.PublishDisplayOutcome(ctx, station, OutcomeDatabaseUnavailable)
		return &ValidateResult{Outcome: OutcomeDatabaseUnavailable}, nil
	}
	if lookup == nil {
		s.PublishDisplayOutcome(ctx, station, OutcomeNotFound)
		return &ValidateResult{Outcome: OutcomeNotFound}, nil
	}
	displayName := lookup.Name
	if lookup.BibName != nil && strings.TrimSpace(*lookup.BibName) != "" {
		displayName = lookup.BibName
	}
	result := &ValidateResult{
		Outcome:     OutcomeValid,
		Target:      &TargetInfo{Type: target.Type, ID: lookup.ID, RacePackPickedUp: lookup.RacePackPickedUpAt != nil},
		Participant: &ParticipantInfo{Name: displayName, BibName: lookup.BibName, BIBNumber: lookup.BIBNumber},
		Ticket:      &TicketInfo{Category: lookup.TicketCategory},
	}
	if lookup.RacePackPickedUpAt != nil {
		pickedUpAt := lookup.RacePackPickedUpAt.Format(time.RFC3339)
		result.Outcome = OutcomeAlreadyPickedUp
		result.Target.RacePackPickedUpAt = &pickedUpAt
	}
	s.publishDisplay(ctx, station, target, result)
	return result, nil
}

func (s *Service) ValidateRacePack(ctx context.Context, target ScanTarget, station string, stationNumber int, operatorID string) (*ValidateResult, error) {
	result, err := s.Validate(ctx, target, station)
	if err != nil || result.Outcome != OutcomeAlreadyPickedUp {
		return result, err
	}
	if err := s.repo.RecordScanResult(ctx, target, operatorID, stationNumber, newULID(), "duplicate_rejected"); err != nil {
		s.logError(ctx, "record duplicate scan failed", err, target)
		s.displayCache.Delete(fmt.Sprintf("display:%s", station))
		return &ValidateResult{Outcome: OutcomeDatabaseUnavailable}, nil
	}
	return result, nil
}

func (s *Service) RecordDuplicateScan(ctx context.Context, target ScanTarget, station string, stationNumber int, operatorID string) Outcome {
	if err := s.repo.RecordScanResult(ctx, target, operatorID, stationNumber, newULID(), "duplicate_rejected"); err != nil {
		s.logError(ctx, "record duplicate manual scan failed", err, target)
		s.displayCache.Delete(fmt.Sprintf("display:%s", station))
		return OutcomeDatabaseUnavailable
	}
	return OutcomeAlreadyPickedUp
}

func (s *Service) publishDisplay(ctx context.Context, station string, target ScanTarget, result *ValidateResult) {
	if station == "" {
		return
	}
	data := &DisplayData{Version: 3, ScanID: newULID(), Outcome: result.Outcome, Message: result.Outcome.Message(), Type: target.Type, ID: target.ID, Target: result.Target, Order: result.Order, Participant: result.Participant, Ticket: result.Ticket, ScannedAt: time.Now().Format(time.RFC3339Nano)}
	s.displayCache.Set(fmt.Sprintf("display:%s", station), data, 2*time.Minute)
	if s.logger != nil {
		s.logger.InfoContext(ctx, "display data cached", "station", station, "target_type", target.Type, "target_id_hash", hashID(target.ID))
	}
}

func (s *Service) PublishDisplayOutcome(ctx context.Context, station string, outcome Outcome) {
	if station == "" {
		return
	}
	data := &DisplayData{Version: 3, ScanID: newULID(), Outcome: outcome, Message: outcome.Message(), ScannedAt: time.Now().Format(time.RFC3339Nano)}
	s.displayCache.Set(fmt.Sprintf("display:%s", station), data, 2*time.Minute)
	if s.logger != nil {
		s.logger.InfoContext(ctx, "display outcome cached", "station", station, "outcome", outcome)
	}
}

func (s *Service) GetDisplayData(station string) *DisplayData {
	cacheKey := fmt.Sprintf("display:%s", station)
	val, ok := s.displayCache.Get(cacheKey)
	if !ok {
		return nil
	}
	data, ok := val.(*DisplayData)
	if !ok {
		return nil
	}
	return data
}

type PickupResultResponse struct {
	Outcome    Outcome
	PickedUpAt *string
}

func (s *Service) ListPickups(ctx context.Context, query PickupListQuery) (*PickupListResponse, error) {
	limit := query.Limit
	if limit == 0 {
		limit = defaultPickupListLimit
	}
	if limit < 1 || limit > maxPickupListLimit {
		return nil, ErrInvalidPickupListQuery
	}

	search := strings.TrimSpace(query.Search)
	if len(search) > maxPickupListSearchLength {
		return nil, ErrInvalidPickupListQuery
	}
	category := strings.TrimSpace(query.Category)
	if len(category) > maxPickupListSearchLength {
		return nil, ErrInvalidPickupListQuery
	}
	if query.PickedUpFrom != nil && query.PickedUpTo != nil && !query.PickedUpFrom.Before(*query.PickedUpTo) {
		return nil, ErrInvalidPickupListQuery
	}

	cursorTime, cursorType, cursorID, err := decodePickupListCursor(query.Cursor)
	if err != nil {
		return nil, ErrInvalidPickupListQuery
	}

	rows, err := s.repo.ListPickups(ctx, PickupListFilter{
		SearchPattern: searchPattern(search),
		Category:      category,
		PickedUpFrom:  query.PickedUpFrom,
		PickedUpTo:    query.PickedUpTo,
		CursorTime:    cursorTime,
		CursorType:    cursorType,
		CursorID:      cursorID,
		Limit:         limit + 1,
	})
	if err != nil {
		if s.logger != nil {
			s.logger.ErrorContext(ctx, "list pickups failed", "error", err, "has_search", search != "", "has_category", category != "", "has_from", query.PickedUpFrom != nil, "has_to", query.PickedUpTo != nil, "limit", limit)
		}
		return nil, err
	}

	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}

	items := make([]PickupListItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, PickupListItem{
			Target: ScanTarget{Type: row.TargetType, ID: row.TargetID},
			Order: PickupListOrder{
				ID:         row.TargetID,
				Number:     row.OrderNumber,
				Status:     row.OrderStatus,
				PickedUpAt: row.PickedUpAt.Format(time.RFC3339),
			},
			Participant: PickupListParticipant{
				Name:       row.ParticipantName,
				BibName:    row.BibName,
				BIBNumber:  row.BIBNumber,
				JerseySize: row.JerseySize,
			},
			Ticket: PickupListTicket{
				Category: row.TicketCategory,
			},
			Operator: PickupListOperator{
				Name: row.PickedUpByName,
			},
		})
	}

	var nextCursor *string
	if hasMore && len(rows) > 0 {
		last := rows[len(rows)-1]
		cursor := encodePickupListCursor(last.PickedUpAt, last.TargetType, last.TargetID)
		nextCursor = &cursor
	}

	return &PickupListResponse{
		Items: items,
		Page: PickupListPage{
			Limit:      limit,
			HasMore:    hasMore,
			NextCursor: nextCursor,
		},
	}, nil
}

func (s *Service) ConfirmPickup(ctx context.Context, target ScanTarget, operatorID string, station int) (*PickupResultResponse, error) {
	result, err := s.repo.ConfirmPickup(ctx, target, operatorID, station, newULID())
	if err != nil {
		s.logError(ctx, "pickup confirm failed", err, target)
		return &PickupResultResponse{Outcome: OutcomeDatabaseUnavailable}, nil
	}
	response := &PickupResultResponse{Outcome: result.Outcome}
	if result.PickedUpAt != nil {
		value := result.PickedUpAt.Format(time.RFC3339)
		response.PickedUpAt = &value
	}
	return response, nil
}

func (s *Service) CancelPickup(ctx context.Context, target ScanTarget, operatorID string, station int) Outcome {
	if err := s.repo.RecordScanResult(ctx, target, operatorID, station, newULID(), "cancelled"); err != nil {
		s.logError(ctx, "record cancelled scan failed", err, target)
		if errors.Is(err, pgx.ErrNoRows) {
			return OutcomeNotFound
		}
		return OutcomeDatabaseUnavailable
	}
	return OutcomeCancelled
}

func searchPattern(value string) string {
	if value == "" {
		return ""
	}
	var builder strings.Builder
	builder.WriteByte('%')
	for _, char := range value {
		switch char {
		case '\\', '%', '_':
			builder.WriteByte('\\')
		}
		builder.WriteRune(char)
	}
	builder.WriteByte('%')
	return builder.String()
}

func encodePickupListCursor(pickedUpAt time.Time, targetType TargetType, targetID string) string {
	payload, _ := json.Marshal(pickupListCursor{
		PickedUpAt: pickedUpAt.Format(time.RFC3339Nano),
		TargetType: targetType,
		TargetID:   targetID,
	})
	return base64.RawURLEncoding.EncodeToString(payload)
}

func decodePickupListCursor(value string) (*time.Time, TargetType, string, error) {
	if strings.TrimSpace(value) == "" {
		return nil, "", "", nil
	}

	payload, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, "", "", err
	}
	var cursor pickupListCursor
	if err := json.Unmarshal(payload, &cursor); err != nil {
		return nil, "", "", err
	}
	if cursor.TargetID == "" {
		cursor.TargetID = cursor.OrderID
		cursor.TargetType = TargetOrder
	}
	if cursor.PickedUpAt == "" || cursor.TargetID == "" || (cursor.TargetType != TargetOrder && cursor.TargetType != TargetExternalParticipant) {
		return nil, "", "", ErrInvalidPickupListQuery
	}
	pickedUpAt, err := time.Parse(time.RFC3339Nano, cursor.PickedUpAt)
	if err != nil {
		return nil, "", "", err
	}
	return &pickedUpAt, cursor.TargetType, cursor.TargetID, nil
}

func newULID() string { return ulid.Make().String() }

func (s *Service) logError(ctx context.Context, message string, err error, target ScanTarget) {
	if s.logger != nil {
		s.logger.ErrorContext(ctx, message, "error", err, "target_type", target.Type, "target_id_hash", hashID(target.ID))
	}
}

func hashID(id string) string {
	if len(id) > 4 {
		return id[:2] + "***" + id[len(id)-2:]
	}
	return "***"
}
