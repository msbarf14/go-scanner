package integration_test

import (
	"context"
	"fmt"
	"os"
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
