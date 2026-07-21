# Traceability Matrix

Status:

- `planned`: sudah masuk rancangan implementasi.
- `implemented`: kode sudah dibuat.
- `verified`: sudah ada bukti test/manual yang lulus.
- `blocked`: menunggu keputusan atau dependency.

| Area PRD | Requirement | Fase | File/komponen target | Bukti verifikasi target | Status |
|---|---|---:|---|---|---|
| AUTH | AUTH-001 login wajib | 2 | `internal/auth`, `web/src` | Auth integration + browser login test | planned |
| AUTH | AUTH-002 user Laravel | 2 | `internal/auth/sql/find_user.sql` | PostgreSQL auth integration test | planned |
| AUTH | AUTH-003 username/email | 2 | `internal/auth/repository.go` | Login identity tests | planned |
| AUTH | AUTH-004 bcrypt Laravel | 0,2 | `internal/auth/service.go` | Bcrypt fixture test | planned |
| AUTH | AUTH-005 role/permission scanner | 2 | `internal/auth/sql/is_authorized.sql` | Spatie resolver tests | planned |
| AUTH | AUTH-006 secure cookie | 2 | `internal/auth/session.go` | Cookie attribute tests | planned |
| AUTH | AUTH-007 timeout session | 2 | `internal/auth/session.go` | Idle/absolute expiry tests | planned |
| AUTH | AUTH-008 logout | 2,4 | `internal/auth/handler.go`, `web/src` | Logout browser test | planned |
| AUTH | AUTH-009 tidak mengubah user/role | 2,5 | Auth repository | Grant and SQL review | planned |
| CAM | CAM-001 kamera utama | 4 | `web/src/camera.ts` | Device/browser test | planned |
| CAM | CAM-002 kamera belakang | 4 | `web/src/camera.ts` | Chrome Android/Safari iOS test | planned |
| CAM | CAM-003 decode lokal | 4 | `web/src/scanner.ts` | Network inspection | planned |
| CAM | CAM-004 tidak upload media | 4,5 | `web/src/camera.ts` | Browser/network privacy review | planned |
| CAM | CAM-005 retry kamera | 4 | `web/src/camera.ts` | Permission denied browser test | planned |
| CAM | CAM-006 ganti kamera | 4 | `web/src/camera.ts` | Device test | planned |
| CAM | CAM-007 torch | 4 | `web/src/camera.ts` | Capability/device test | planned |
| CAM | CAM-008 cegah scan berulang | 4 | `web/src/scanner.ts` | Request lock browser test | planned |
| CAM | CAM-009 scanner keyboard | 4 | `web/src/scanner.ts` | Keyboard wedge test | planned |
| CAM | CAM-010 input manual | 4 | `web/src` | Manual input browser test | planned |
| SCN | SCN-001 format QR | 3 | `internal/scanner/parser.go` | Parser unit/fuzz tests | planned |
| SCN | SCN-002 tolak QR invalid | 3 | `internal/scanner/parser.go` | Parser invalid tests | planned |
| SCN | SCN-003 order tidak ditemukan | 3 | `internal/scanner/service.go` | Integration test | planned |
| SCN | SCN-004 soft deleted | 3 | `internal/scanner/service.go` | Integration test | planned |
| SCN | SCN-005 non-paid | 3 | `internal/scanner/service.go` | Integration test | planned |
| SCN | SCN-006 tepat satu participant | 3 | `internal/scanner/sql/lookup_order.sql` | Cardinality tests | planned |
| SCN | SCN-007 anomali participant | 3 | `internal/scanner/service.go` | Cardinality tests | planned |
| SCN | SCN-008 tampil data minimum | 3,4 | API response + UI | Browser/API contract tests | planned |
| SCN | SCN-009 minimisasi PII | 3,5 | SQL lookup + logging | SQL/response/log review | planned |
| SCN | SCN-010 status pickup | 3,4 | API response + UI | Integration/browser tests | planned |
| PCK | PCK-001 operator terautentikasi | 2,3 | Auth middleware | Protected endpoint tests | planned |
| PCK | PCK-002 konfirmasi operator | 4 | UI verification modal | Browser test | planned |
| PCK | PCK-003 waktu database | 3 | `pickup.sql` | DB timestamp integration test | planned |
| PCK | PCK-004 operator ULID | 3 | `internal/scanner/service.go` | Pickup DB assertion | planned |
| PCK | PCK-005 conditional update | 3 | `internal/scanner/sql/pickup.sql` | Integration test | planned |
| PCK | PCK-006 concurrency-safe | 3,5 | `pickup.sql` | Concurrent pickup test | planned |
| PCK | PCK-007 tidak overwrite | 3,5 | `pickup.sql` | Duplicate pickup test | planned |
| PCK | PCK-008 respons DB authoritative | 3,4 | API + UI | Timeout/no optimistic success tests | planned |
| UI | UI-001 visual feedback | 4 | `web/src` | Browser UI test | planned |
| UI | UI-002 suara muteable | 4 | `web/src` | Browser UI test | planned |
| UI | UI-003 status koneksi | 4 | `web/src/api.ts` | Outage browser test | planned |
| UI | UI-004 local history | 4 | `web/src/history.ts` | SessionStorage test | planned |
| UI | UI-005 history bukan audit | 4 | UI copy + docs | Browser/content review | planned |
| UI | UI-006 siap scan ulang | 4 | `web/src/scanner.ts` | Browser timing test | planned |
| OPS | OPS-001 `/healthz` | 1 | `internal/httpapi` | HTTP handler test | planned |
| OPS | OPS-002 `/readyz` | 1 | `internal/httpapi`, `internal/store` | DB readiness test | planned |
| OPS | OPS-003 JSON logs | 1 | `cmd/scanner`, middleware | Log format test/review | planned |
| OPS | OPS-004 request log fields | 1 | middleware | Log field test | planned |
| OPS | OPS-005 log redaction | 1,5 | logging helpers | Redaction tests/review | planned |
| OPS | OPS-006 graceful shutdown | 1 | `cmd/scanner/main.go` | Shutdown test/manual | planned |
| NFR | Performance 500 ms P95 | 5 | backend + load test | k6/load report | planned |
| NFR | Reliability fail closed | 1,3,4 | DB handling + UI | Outage tests | planned |
| NFR | Security controls | 2,5,6 | auth/session/headers/grants | Security review | planned |
| NFR | Privacy allowlist | 3,4,5 | SQL/API/UI/log | Privacy review | planned |
| NFR | Observability | 1,6 | logs/monitoring | Deployment smoke test | planned |
