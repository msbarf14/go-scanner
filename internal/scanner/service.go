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
)

const (
	maxDisplayCacheEntries = 128
	defaultPickupListLimit = 50
	maxPickupListLimit = 100
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
	Order       *OrderInfo
	Participant *ParticipantInfo
	Ticket      *TicketInfo
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
	Order       *OrderInfo       `json:"order"`
	Participant *ParticipantInfo `json:"participant"`
	Ticket      *TicketInfo      `json:"ticket"`
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
	Order       PickupListOrder       `json:"order"`
	Participant PickupListParticipant `json:"participant"`
	Ticket      PickupListTicket       `json:"ticket"`
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
	PickedUpAt string `json:"picked_up_at"`
	OrderID    string `json:"order_id"`
}

func (s *Service) ValidateManualLookup(ctx context.Context, lookupType string, payload string, station string) (*ValidateResult, error) {
	manualLookupType, value, outcome := ParseManualLookup(lookupType, payload)
	if outcome != OutcomeValid {
		return &ValidateResult{Outcome: outcome}, nil
	}

	resolution, err := s.repo.ResolveManualLookup(ctx, manualLookupType, value)
	if err != nil {
		s.logger.ErrorContext(ctx, "manual lookup failed", "error", err, "lookup_type", string(manualLookupType))
		return &ValidateResult{Outcome: OutcomeDatabaseUnavailable}, nil
	}
	if resolution.Count == 0 {
		return &ValidateResult{Outcome: OutcomeNotFound}, nil
	}
	if resolution.Count > 1 {
		return &ValidateResult{Outcome: OutcomeAmbiguousLookup}, nil
	}

	return s.Validate(ctx, resolution.OrderID, station)
}

func (s *Service) Validate(ctx context.Context, orderID string, station string) (*ValidateResult, error) {
	lookup, err := s.repo.LookupOrder(ctx, orderID)
	if err != nil {
		s.logger.ErrorContext(ctx, "lookup order failed", "error", err, "order_id_hash", hashID(orderID))
		return &ValidateResult{Outcome: OutcomeDatabaseUnavailable}, nil
	}

	if lookup == nil {
		return &ValidateResult{Outcome: OutcomeNotFound}, nil
	}

	if lookup.Status == nil || *lookup.Status != "paid" {
		return &ValidateResult{Outcome: OutcomeNotPaid}, nil
	}

	if lookup.ParticipantCount == 0 {
		return &ValidateResult{Outcome: OutcomeParticipantMissing}, nil
	}

	if lookup.ParticipantCount > 1 {
		return &ValidateResult{Outcome: OutcomeMultipleParticipants}, nil
	}

	result := &ValidateResult{
		Outcome: OutcomeValid,
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
	}

	if station != "" {
		displayData := &DisplayData{
			Order:       result.Order,
			Participant: result.Participant,
			Ticket:      result.Ticket,
			ScannedAt:   time.Now().Format(time.RFC3339Nano),
		}
		cacheKey := fmt.Sprintf("display:%s", station)
		s.displayCache.Set(cacheKey, displayData, 2*time.Minute)
		s.logger.InfoContext(ctx, "display data cached", "station", station, "order_id_hash", hashID(orderID))
	}

	return result, nil
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

	cursorTime, cursorID, err := decodePickupListCursor(query.Cursor)
	if err != nil {
		return nil, ErrInvalidPickupListQuery
	}

	rows, err := s.repo.ListPickups(ctx, PickupListFilter{
		SearchPattern: searchPattern(search),
		Category:      category,
		PickedUpFrom:  query.PickedUpFrom,
		PickedUpTo:    query.PickedUpTo,
		CursorTime:    cursorTime,
		CursorID:      cursorID,
		Limit:         limit + 1,
	})
	if err != nil {
		s.logger.ErrorContext(ctx, "list pickups failed", "error", err, "has_search", search != "", "has_category", category != "", "has_from", query.PickedUpFrom != nil, "has_to", query.PickedUpTo != nil, "limit", limit)
		return nil, err
	}

	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}

	items := make([]PickupListItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, PickupListItem{
			Order: PickupListOrder{
				ID:         row.OrderID,
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
		cursor := encodePickupListCursor(last.PickedUpAt, last.OrderID)
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

func (s *Service) ConfirmPickup(ctx context.Context, orderID string, operatorID string) (*PickupResultResponse, error) {
	result, err := s.repo.ConfirmPickup(ctx, orderID, operatorID)
	if err != nil {
		s.logger.ErrorContext(ctx, "pickup confirm failed", "error", err, "order_id_hash", hashID(orderID))
		return &PickupResultResponse{Outcome: OutcomeDatabaseUnavailable}, nil
	}

	if result == nil {
		diag, err := s.repo.DiagnosePickup(ctx, orderID)
		if err != nil {
			s.logger.ErrorContext(ctx, "diagnose pickup failed", "error", err, "order_id_hash", hashID(orderID))
			return &PickupResultResponse{Outcome: OutcomeInternalError}, nil
		}

		if diag == nil {
			return &PickupResultResponse{Outcome: OutcomeNotFound}, nil
		}

		if diag.DeletedAt != nil {
			return &PickupResultResponse{Outcome: OutcomeNotFound}, nil
		}

		if diag.Status == nil || *diag.Status != "paid" {
			return &PickupResultResponse{Outcome: OutcomeNotPaid}, nil
		}

		if diag.ParticipantCount != 1 {
			if diag.ParticipantCount == 0 {
				return &PickupResultResponse{Outcome: OutcomeParticipantMissing}, nil
			}
			return &PickupResultResponse{Outcome: OutcomeMultipleParticipants}, nil
		}

		if diag.RacePackPickedUpAt != nil {
			pickedUpAt := diag.RacePackPickedUpAt.Format("2006-01-02T15:04:05+08:00")
			return &PickupResultResponse{
				Outcome:    OutcomeAlreadyPickedUp,
				PickedUpAt: &pickedUpAt,
			}, nil
		}

		return &PickupResultResponse{Outcome: OutcomeInternalError}, nil
	}

	pickedUpAt := result.RacePackPickedUpAt.Format("2006-01-02T15:04:05+08:00")
	return &PickupResultResponse{
		Outcome:    OutcomePickedUp,
		PickedUpAt: &pickedUpAt,
	}, nil
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

func encodePickupListCursor(pickedUpAt time.Time, orderID string) string {
	payload, _ := json.Marshal(pickupListCursor{
		PickedUpAt: pickedUpAt.Format(time.RFC3339Nano),
		OrderID:    orderID,
	})
	return base64.RawURLEncoding.EncodeToString(payload)
}

func decodePickupListCursor(value string) (*time.Time, string, error) {
	if strings.TrimSpace(value) == "" {
		return nil, "", nil
	}

	payload, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, "", err
	}
	var cursor pickupListCursor
	if err := json.Unmarshal(payload, &cursor); err != nil {
		return nil, "", err
	}
	if cursor.PickedUpAt == "" || cursor.OrderID == "" {
		return nil, "", ErrInvalidPickupListQuery
	}
	pickedUpAt, err := time.Parse(time.RFC3339Nano, cursor.PickedUpAt)
	if err != nil {
		return nil, "", err
	}
	return &pickedUpAt, cursor.OrderID, nil
}

func hashID(id string) string {
	if len(id) > 4 {
		return id[:2] + "***" + id[len(id)-2:]
	}
	return "***"
}
