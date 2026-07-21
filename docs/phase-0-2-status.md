# Status Implementasi Fase 0–2

## Selesai di repository

### Fase 0 — Kontrak Schema dan Baseline Test

- `docs/schema-contract.md` mendokumentasikan kontrak tabel, kolom, relasi, outcome API, dan query pickup konseptual.
- `docs/traceability.md` membuat traceability matrix awal dari PRD ke fase implementasi dan bukti verifikasi target.
- `test/integration/schema.sql` menyediakan schema fixture PostgreSQL minimal untuk tabel scanner-relevant.
- `test/integration/fixtures.sql` menyediakan data dasar untuk user admin/customer/scanner permission, roles, permissions, tickets, orders, dan participants.
- `docs/prd.md` sudah dikoreksi agar grant `tickets` tidak lagi merujuk `tickets.ukuran_jersey`.

### Fase 1 — Fondasi Service Go

- `go.mod` dibuat dengan dependency utama: `pgx`, `gorilla/securecookie`, `gorilla/csrf`, `x/crypto`, dan `x/time`.
- `cmd/scanner/main.go` menyediakan entrypoint, logger, PostgreSQL store, router, HTTP server timeout, dan graceful shutdown.
- `internal/config/config.go` memuat environment loader dan validasi konfigurasi.
- `internal/store/postgres.go` memuat setup `pgxpool`, statement timeout, timezone, readiness, dan close.
- `internal/httpapi` memuat response envelope, middleware request ID, logging, recovery, security headers, no-store, body limit, JSON requirement, same-origin check, router, `/healthz`, dan `/readyz`.
- `.env.example`, `.gitignore`, dan `Makefile` dasar sudah dibuat.

### Fase 2 — Authentication, Authorization, dan Session

- `internal/auth/repository.go` memuat repository user lookup dan authorization Spatie.
- `internal/auth/sql/find_user.sql` dan `internal/auth/sql/is_authorized.sql` menjadi sumber query auth.
- `internal/auth/session.go` memuat cookie session stateless terenkripsi/ditandatangani dengan idle dan absolute timeout.
- `internal/auth/service.go` memuat login flow, bcrypt verification, dummy hash, role/permission check, dan rate limit awal.
- `internal/auth/handler.go` memuat `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, dan protected-route middleware.
- Router memasang CSRF protection dan same-origin check untuk mutasi.
- `internal/auth/session_test.go` menyediakan test dasar round-trip dan idle expiry session.

## Belum diverifikasi otomatis

Go belum tersedia di PATH pada environment saat ini, sehingga perintah berikut belum bisa dijalankan:

```text
go mod tidy
go test ./...
```

Setelah Go tersedia, jalankan:

```text
make tidy
make test
```

## Catatan teknis berikutnya

- Fase 2 sudah memiliki skeleton fungsional, tetapi masih perlu integration test PostgreSQL untuk login admin/customer/permission dan session lintas request.
- CSRF token sementara diekspos pada HTML root placeholder; UI Fase 4 perlu mengambil token tersebut atau endpoint token khusus sebelum request mutasi.
- Rate limiter login saat ini global in-process sebagai baseline; production tetap perlu rate limit di ingress sesuai plan.
- Scanner backend Fase 3 belum dikerjakan.
