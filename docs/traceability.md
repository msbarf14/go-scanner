# Traceability Matrix

Status:

- `planned`: sudah masuk rancangan implementasi.
- `implemented`: kode sudah dibuat.
- `verified`: sudah ada bukti test/build/manual yang lulus.
- `blocked`: menunggu keputusan atau dependency eksternal.

| Area PRD | Requirement | File/komponen utama | Bukti verifikasi | Status |
|---|---|---|---|---|
| AUTH | Display Only dapat dibuka tanpa login | `web/src/main.ts`, `internal/httpapi/router.go` | Browser smoke sebelumnya: `/runner-scanner` terbuka Display Only tanpa login | verified |
| AUTH | Race Pack login modal memakai akun Laravel | `web/src/main.ts`, `internal/auth/*`, `internal/auth/sql/find_user.sql` | `go test ./...`; browser smoke toggle/cancel sebelumnya | verified |
| AUTH | Session scanner Go terpisah dari Laravel | `internal/auth/session.go`, `internal/auth/handler.go` | `internal/auth/session_test.go` | verified |
| AUTH | Role/permission Laravel Spatie guard `web` | `internal/auth/service.go`, `internal/auth/sql/is_authorized.sql` | `internal/auth/repository_test.go`, `internal/auth/service_test.go` | verified |
| AUTH | Logout Race Pack tidak mengklaim sukses saat server gagal | `web/src/main.ts`, `internal/auth/handler.go` | Browser mock logout success/failure sebelumnya | verified |
| CAM | Kamera browser sebagai input QR lokal | `web/src/main.ts`, `web/package.json` | Build frontend; fallback permission denied diuji headless sebelumnya | verified |
| CAM | USB keyboard wedge dan input manual tetap tersedia | `web/src/main.ts` | Browser smoke sebelumnya; input memakai submit path yang sama | verified |
| CAM | Request/modal lock mencegah scan bertumpuk | `web/src/main.ts` | Browser mock P0: scan kedua saat modal terbuka tidak validate ulang | verified |
| SCN | Parser menerima full URL, relative path, raw ULID | `internal/scanner/parser.go` | `internal/scanner/parser_test.go` | verified |
| SCN | Station dinormalisasi dan dibatasi | `internal/scanner/station.go`, `internal/scanner/handler.go` | `TestNormalizeStation`, `go test ./...` | verified |
| SCN | Soft-deleted order fail closed sebagai `not_found` | `internal/scanner/service.go` | `go test ./...`; urutan diagnosis service | verified |
| SCN | Display cache berbatas per station | `internal/cache/cache.go`, `internal/scanner/service.go` | `internal/cache/cache_test.go` | verified |
| PCK | Pickup wajib session dan CSRF | `internal/httpapi/router.go`, `internal/auth/handler.go` | `internal/httpapi/router_test.go` | verified |
| PCK | Pickup memakai operator dari session | `internal/scanner/handler.go`, `internal/auth/handler.go` | Protected route context tests/smoke via router tests | verified |
| PCK | Konfirmasi single-flight, tidak optimistic success | `web/src/main.ts`, `internal/scanner/sql/pickup.sql` | Browser mock P0 double confirm hanya satu pickup | verified |
| UI | Status readiness dinamis | `web/src/main.ts`, `web/src/styles.css`, `/readyz` | Frontend build; outage path diuji mock sebelumnya | verified |
| UI | Riwayat lokal sementara max 20 bukan audit | `web/src/main.ts`, `web/src/styles.css` | Implemented; perlu browser visual smoke setelah build | implemented |
| PWA | Manifest start ke scanner dan service worker static-only | `web/public/manifest.webmanifest`, `web/public/service-worker.js`, `web/src/main.ts` | Implemented; perlu build dan asset check | implemented |
| OPS | Health/readiness endpoint | `internal/httpapi/router.go`, `internal/store/postgres.go` | `go test ./...` | verified |
| OPS | Structured log non-PII dan pickup path redaction | `internal/scanner/handler.go`, `internal/httpapi/middleware.go` | `internal/httpapi/middleware_test.go`; code review | verified |
| CONFIG | `SESSION_SECRET` dan `CSRF_SECRET` terpisah | `internal/config/config.go`, `cmd/scanner/main.go` | `internal/config/config_test.go` | verified |
| CONFIG | Production DB SSL mode eksplisit | `internal/config/config.go`, `.env.example` | `internal/config/config_test.go` | verified |
| NFR | Device test Chrome Android/Safari iOS HTTPS | Perangkat fisik | Tidak tersedia dari environment ini | blocked |
| NFR | PostgreSQL integration/concurrency lengkap | `test/integration/*` | Fixture ada, test DB penuh belum dijalankan di environment ini | planned |
