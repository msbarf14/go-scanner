package integration_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"fenturun2026-bib-scanner/internal/scanner"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	operatorID = "01J00000000000000000000001"
	orderID    = "01J00000000000000000001000"
	externalID = "01J00000000000000000003000"
)

func TestPickupTransactionsAndAudit(t *testing.T) {
	repo, pool := integrationRepository(t)
	ctx := t.Context()

	order := scanner.ScanTarget{Type: scanner.TargetOrder, ID: orderID}
	external := scanner.ScanTarget{Type: scanner.TargetExternalParticipant, ID: externalID}

	result, err := repo.ConfirmPickup(ctx, order, operatorID, 3, "01J00000000000000000004000")
	if err != nil || result.Outcome != scanner.OutcomePickedUp {
		t.Fatalf("order pickup = %#v, %v", result, err)
	}
	result, err = repo.ConfirmPickup(ctx, external, operatorID, 3, "01J00000000000000000004001")
	if err != nil || result.Outcome != scanner.OutcomePickedUp {
		t.Fatalf("external pickup = %#v, %v", result, err)
	}
	if err := repo.RecordScanResult(ctx, external, operatorID, 3, "01J00000000000000000004002", "cancelled"); err != nil {
		t.Fatalf("record cancellation: %v", err)
	}

	var invalidTargets int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM race_pack_scan_logs WHERE (order_id IS NULL) = (external_participant_id IS NULL)`).Scan(&invalidTargets); err != nil {
		t.Fatalf("count invalid audit targets: %v", err)
	}
	if invalidTargets != 0 {
		t.Fatalf("invalid audit targets = %d", invalidTargets)
	}

	onlineLookup, err := repo.ResolveManualLookup(ctx, scanner.ManualSourceOnline, scanner.ManualLookupBIBNumber, "S0001")
	if err != nil || onlineLookup.Count != 1 || onlineLookup.Target.Type != scanner.TargetOrder {
		t.Fatalf("online BIB lookup = %#v, %v", onlineLookup, err)
	}
	vipLookup, err := repo.ResolveManualLookup(ctx, scanner.ManualSourceVIP, scanner.ManualLookupBIBNumber, "V0001")
	if err != nil || vipLookup.Count != 1 || vipLookup.Target.Type != scanner.TargetExternalParticipant {
		t.Fatalf("VIP BIB lookup = %#v, %v", vipLookup, err)
	}
	list, err := repo.ListPickups(ctx, scanner.PickupListFilter{Limit: 20})
	if err != nil {
		t.Fatalf("list combined pickups: %v", err)
	}
	types := map[scanner.TargetType]bool{}
	for _, item := range list {
		types[item.TargetType] = true
	}
	if !types[scanner.TargetOrder] || !types[scanner.TargetExternalParticipant] {
		t.Fatalf("combined pickup types = %#v", types)
	}

	if _, err := pool.Exec(ctx, `DELETE FROM race_pack_scan_logs`); err != nil {
		t.Fatalf("reset audit logs: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE orders SET race_pack_picked_up_at = NULL, race_pack_picked_up_by = NULL WHERE id = $1`, orderID); err != nil {
		t.Fatalf("reset order: %v", err)
	}

	var wg sync.WaitGroup
	outcomes := make(chan scanner.Outcome, 2)
	errors := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			logID := fmt.Sprintf("01J000000000000000000041%02d", index)
			result, err := repo.ConfirmPickup(context.Background(), order, operatorID, 4, logID)
			if err != nil {
				errors <- err
				return
			}
			outcomes <- result.Outcome
		}(i)
	}
	wg.Wait()
	close(outcomes)
	close(errors)
	for err := range errors {
		t.Fatalf("concurrent pickup: %v", err)
	}
	counts := map[scanner.Outcome]int{}
	for outcome := range outcomes {
		counts[outcome]++
	}
	if counts[scanner.OutcomePickedUp] != 1 || counts[scanner.OutcomeAlreadyPickedUp] != 1 {
		t.Fatalf("concurrent outcomes = %#v", counts)
	}

	var handedOver, duplicate int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FILTER (WHERE result = 'handed_over'), COUNT(*) FILTER (WHERE result = 'duplicate_rejected') FROM race_pack_scan_logs`).Scan(&handedOver, &duplicate); err != nil {
		t.Fatalf("count concurrent audit: %v", err)
	}
	if handedOver != 1 || duplicate != 1 {
		t.Fatalf("audit handed_over=%d duplicate=%d", handedOver, duplicate)
	}
}

func TestStationCategoryIsolation(t *testing.T) {
	repo, pool := integrationRepository(t)
	service := scanner.NewService(repo, nil)
	ctx := t.Context()

	order := scanner.ScanTarget{Type: scanner.TargetOrder, ID: orderID}
	external := scanner.ScanTarget{Type: scanner.TargetExternalParticipant, ID: externalID}

	result, err := service.Validate(ctx, order, "1")
	if err != nil || result.Outcome != scanner.OutcomeValid {
		t.Fatalf("5K order at station 1 = %#v, %v", result, err)
	}
	result, err = service.Validate(ctx, external, "1")
	if err != nil || result.Outcome != scanner.OutcomeValid {
		t.Fatalf("5K VIP at station 1 = %#v, %v", result, err)
	}

	for _, source := range []scanner.ManualLookupSource{scanner.ManualSourceOnline, scanner.ManualSourceVIP} {
		bib := "S0001"
		if source == scanner.ManualSourceVIP {
			bib = "V0001"
		}
		result, err = service.ValidateManualLookup(ctx, string(source), "bib_number", bib, "2")
		if err != nil || result.Outcome != scanner.OutcomeStationMismatch || result.Message != "Tiket ini dilayani di Station #1. Silakan menuju Station #1." {
			t.Fatalf("%s 5K at station 2 = %#v, %v", source, result, err)
		}
	}

	result, err = service.Validate(ctx, order, "3")
	if err != nil || result.Outcome != scanner.OutcomeValid {
		t.Fatalf("5K order at unrestricted station = %#v, %v", result, err)
	}

	const (
		ticket21K   = "01J00000000000000000000102"
		order21K    = "01J00000000000000000001006"
		participant = "01J00000000000000000002007"
		external21K = "01J00000000000000000003002"
	)
	if _, err := pool.Exec(ctx, `
		INSERT INTO tickets (id, parent_id, name, created_at, updated_at)
		VALUES ($1, NULL, '21 K', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
		INSERT INTO orders (id, user_id, ticket_id, number, status, created_at, updated_at)
		VALUES ($2, '01J00000000000000000000002', $1, '260622/21K', 'paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
		INSERT INTO participants (id, order_id, name, bib_name, bib_number, ukuran_jersey, created_at, updated_at)
		VALUES ($3, $2, '21K Runner', '21K RUNNER', 'H0001', 'L', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
		INSERT INTO external_participants (id, category_ticket_id, name, bib_name, bib_number, bib_number_normalized, created_at, updated_at)
		VALUES ($4, $1, '21K VIP', '21K VIP', 'HV001', 'HV001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, ticket21K, order21K, participant, external21K); err != nil {
		t.Fatalf("insert 21K fixtures: %v", err)
	}

	for _, target := range []scanner.ScanTarget{
		{Type: scanner.TargetOrder, ID: order21K},
		{Type: scanner.TargetExternalParticipant, ID: external21K},
	} {
		result, err = service.Validate(ctx, target, "2")
		if err != nil || result.Outcome != scanner.OutcomeValid {
			t.Fatalf("21K target at station 2 = %#v, %v", result, err)
		}
		result, err = service.Validate(ctx, target, "1")
		if err != nil || result.Outcome != scanner.OutcomeStationMismatch || result.Message != "Tiket ini dilayani di Station #2. Silakan menuju Station #2." {
			t.Fatalf("21K target at station 1 = %#v, %v", result, err)
		}
	}

	handler := scanner.NewHandler(service, nil)
	request := httptest.NewRequest(http.MethodPost, "/api/scans/validate", strings.NewReader(`{"payload":"`+order21K+`","station":"1"}`))
	response := httptest.NewRecorder()
	handler.Validate(response, request)
	if response.Code != http.StatusConflict {
		t.Fatalf("station mismatch status = %d, want %d", response.Code, http.StatusConflict)
	}
	var envelope map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode station mismatch response: %v", err)
	}
	if envelope["outcome"] != string(scanner.OutcomeStationMismatch) || envelope["data"] != nil {
		t.Fatalf("station mismatch response = %#v", envelope)
	}

	for _, target := range []scanner.ScanTarget{order, external} {
		pickup, err := service.ConfirmPickup(ctx, target, operatorID, 2)
		if err != nil || pickup.Outcome != scanner.OutcomeStationMismatch {
			t.Fatalf("wrong-station pickup for %s = %#v, %v", target.Type, pickup, err)
		}
	}
	var orderPickedUp, externalPickedUp bool
	if err := pool.QueryRow(ctx, `
		SELECT
			(SELECT race_pack_picked_up_at IS NOT NULL FROM orders WHERE id = $1),
			(SELECT race_pack_picked_up_at IS NOT NULL FROM external_participants WHERE id = $2)`, orderID, externalID).Scan(&orderPickedUp, &externalPickedUp); err != nil {
		t.Fatalf("read pickup statuses: %v", err)
	}
	if orderPickedUp || externalPickedUp {
		t.Fatalf("wrong-station pickup changed status: order=%t external=%t", orderPickedUp, externalPickedUp)
	}
	var auditCount int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM race_pack_scan_logs`).Scan(&auditCount); err != nil {
		t.Fatalf("count audit logs: %v", err)
	}
	if auditCount != 0 {
		t.Fatalf("wrong-station pickup wrote %d audit rows", auditCount)
	}
}

func integrationRepository(t *testing.T) (*scanner.Repository, *pgxpool.Pool) {
	t.Helper()
	databaseURL := os.Getenv("SCANNER_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("SCANNER_TEST_DATABASE_URL is not configured")
	}

	ctx := t.Context()
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect integration database: %v", err)
	}
	schemaName := fmt.Sprintf("scanner_test_%d", time.Now().UnixNano())
	quotedSchema := pgx.Identifier{schemaName}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		admin.Close()
		t.Fatalf("create test schema: %v", err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+quotedSchema+" CASCADE")
		admin.Close()
	})

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		t.Fatalf("parse integration database URL: %v", err)
	}
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET search_path TO "+quotedSchema)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatalf("connect test schema: %v", err)
	}
	t.Cleanup(pool.Close)

	schemaSQL, err := os.ReadFile("schema.sql")
	if err != nil {
		t.Fatalf("read schema fixture: %v", err)
	}
	fixturesSQL, err := os.ReadFile("fixtures.sql")
	if err != nil {
		t.Fatalf("read data fixture: %v", err)
	}
	if _, err := pool.Exec(ctx, string(schemaSQL)); err != nil {
		t.Fatalf("apply schema fixture: %v", err)
	}
	if _, err := pool.Exec(ctx, string(fixturesSQL)); err != nil {
		t.Fatalf("apply data fixture: %v", err)
	}
	return scanner.NewRepository(pool), pool
}
