package scanner

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"fenturun2026-bib-scanner/internal/cache"
)

const maxDisplayCacheEntries = 128

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

func hashID(id string) string {
	if len(id) > 4 {
		return id[:2] + "***" + id[len(id)-2:]
	}
	return "***"
}
