# Fenturun 2026 BIB & Race Pack Scanner

Aplikasi web responsif berbasis Go untuk memvalidasi tiket peserta Fenturun 2026 dan mencatat penyerahan race pack. Terdiri dari dua halaman: **Runner Display** (untuk TV/monitor) dan **Runner Scanner** (untuk operator).

> Status: baseline implementasi MVP. Spesifikasi lengkap tersedia di [`docs/prd.md`](docs/prd.md).

## Tujuan

- Mempercepat validasi tiket dan penyerahan race pack.
- Memastikan hanya order berstatus `paid` yang dapat diproses.
- Mencegah race pack yang sama diserahkan lebih dari satu kali.
- Mencatat operator dan waktu pengambilan pada database existing.
- Tetap kompatibel dengan tiket yang diterbitkan aplikasi Laravel Fenturun 2026.

## Fitur MVP

### Runner Display (`/`)
- Tampilan fullscreen untuk TV/monitor.
- Menampilkan info peserta setelah scan (BIB, nama, kategori, jersey).
- Idle state: "Scan QR Code Tiket Anda".
- Polling data setiap 500ms.
- Dark theme dengan animasi transisi.
- Station parameter via URL (`?station=1`).

### Runner Scanner (`/runner-scanner`)
- **Tanpa login** — menggunakan operator default dari konfigurasi.
- Input QR via barcode scanner USB (keyboard wedge) dengan auto-focus.
- Input payload tiket secara manual.
- Mode **Display Only** — scan untuk menampilkan info peserta.
- Mode **Race Pack** — scan dengan verifikasi penyerahan race pack.
- Riwayat scan sementara dalam session browser (max 20 item).
- Feedback visual dan suara (beep success/error).
- Station parameter via URL (`?station=1`).

### Backend
- Dukungan full ticket URL, relative ticket path, dan raw order ULID.
- Validasi order, status pembayaran, soft delete, dan jumlah participant.
- Konfirmasi penyerahan race pack secara atomik (conditional update).
- Deteksi race pack yang sudah pernah diambil.
- In-memory cache untuk data display.
- Endpoint health dan readiness.
- Structured logging untuk operasional production.

## Aturan Bisnis Utama

Berdasarkan data dan konfigurasi existing yang diverifikasi pada 20 Juli 2026, MVP menggunakan asumsi:

```text
1 order = 1 participant = 1 BIB = 1 race pack
```

Scanner tetap memeriksa asumsi tersebut pada setiap scan. Order hanya dapat diproses jika:

- Payload QR dapat diparsing menjadi ULID order yang valid.
- Order ditemukan dan tidak soft-deleted.
- `orders.status = 'paid'`.
- Order memiliki tepat satu participant.
- `orders.race_pack_picked_up_at IS NULL`.

Order tanpa participant atau dengan lebih dari satu participant ditolak dan harus diteruskan kepada supervisor.

## Format QR yang Didukung

Full ticket URL:

```text
https://domain.example/ticket/{order-ulid}/ticket.pdf
```

Relative path:

```text
/ticket/{order-ulid}/ticket.pdf
/ticket/{order-ulid}
```

Raw order ULID:

```text
01JXXXXXXXXXXXXXXXXXXXXXXX
```

Parser hanya mengambil identifier order. URL dari QR tidak dibuka atau dieksekusi. Input dibatasi panjangnya dan ULID harus terdiri dari tepat 26 karakter Crockford Base32 yang valid.

## Arsitektur

```text
┌─────────────────┐     ┌─────────────────┐
│  Runner Display  │     │  Runner Scanner  │
│  (TV/Monitor)    │     │  (HP/Tablet)     │
│  /?station=1     │     │  /runner-scanner │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │ HTTP
                     v
           ┌─────────────────┐
           │  Go Scanner API  │
           │  + In-Memory     │
           │    Cache         │
           └────────┬────────┘
                    │ PostgreSQL
                    v
           ┌─────────────────┐
           │  Database        │
           │  Laravel         │
           └─────────────────┘
```

Service Go terhubung langsung ke PostgreSQL existing milik aplikasi Laravel Fenturun 2026. Service tidak membuat atau mengelola order, participant, ticket, pembayaran, user, role, maupun permission.

### Akses Database

Tabel yang dibaca:

- `orders`
- `participants`
- `tickets`

MVP hanya menulis kolom berikut pada tabel `orders`:

```text
race_pack_picked_up_at
race_pack_picked_up_by
updated_at
```

Tidak ada migration atau tabel baru pada MVP. Service menggunakan database role khusus dengan prinsip least privilege.

## Pencegahan Double Pickup

Konfirmasi pickup menggunakan conditional update atomik:

```sql
UPDATE orders
SET
    race_pack_picked_up_at = CURRENT_TIMESTAMP,
    race_pack_picked_up_by = $1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $2
  AND status = 'paid'
  AND deleted_at IS NULL
  AND race_pack_picked_up_at IS NULL
RETURNING
    id,
    race_pack_picked_up_at,
    race_pack_picked_up_by;
```

Tepat satu request boleh berhasil saat beberapa perangkat mengonfirmasi order yang sama. Waktu pickup berasal dari PostgreSQL, bukan dari jam perangkat operator.

## API

Endpoint yang tersedia:

```text
GET  /api/display               — Data display untuk station
POST /api/scans/validate        — Validasi QR/tiket
POST /api/orders/{ulid}/pickup  — Konfirmasi race pack pickup
GET  /healthz                   — Health check
GET  /readyz                    — Database readiness check
```

### Display Request

```json
GET /api/display?station=1
```

### Display Response

```json
{
  "outcome": "ok",
  "data": {
    "display": {
      "order": {
        "id": "01JXXX...",
        "number": "260605/WJA",
        "race_pack_picked_up": false
      },
      "participant": {
        "name": "Nama Peserta",
        "bib_name": "NAMA BIB",
        "bib_number": "T0033",
        "jersey_size": "XS"
      },
      "ticket": {
        "category": "10K"
      },
      "scanned_at": "2026-07-21T19:59:48+08:00"
    },
    "station": "1"
  }
}
```

### Validate Request

```json
POST /api/scans/validate
{
  "payload": "01KTAR98MT66XQXB4TQ10XBZNF",
  "station": "1"
}
```

### Validate Response (Success)

```json
{
  "outcome": "valid",
  "message": "Tiket valid",
  "data": {
    "order": {
      "id": "01KTAR98MT66XQXB4TQ10XBZNF",
      "number": "260605/WJA",
      "race_pack_picked_up": false
    },
    "participant": {
      "name": "Rizkyka Rumengan",
      "bib_name": "KIKA",
      "bib_number": "T0033",
      "jersey_size": "XS"
    },
    "ticket": {
      "category": "10K"
    }
  }
}
```

### Outcome Values

```text
valid                  — Tiket valid, menunggu konfirmasi
picked_up             — Race pack berhasil diserahkan
invalid_payload       — QR/input tidak valid
not_found             — Order tidak ditemukan
not_paid              — Order belum dibayar
participant_missing   — Data participant tidak lengkap
multiple_participants — Order multi-participant tidak didukung
already_picked_up     — Race pack sudah pernah diambil
database_unavailable  — Koneksi database bermasalah
internal_error        — Error tak terduga
```

## Konfigurasi

Environment variable:

```env
APP_ENV=development
HTTP_ADDR=:3001
PUBLIC_BASE_URL=http://localhost:3001

# PostgreSQL Connection
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=fenturun2026
DB_USERNAME=scanner_service
DB_PASSWORD=your_password
DB_SSLMODE=disable

# Connection Pool
DB_MAX_CONNECTIONS=10
DB_MIN_CONNECTIONS=1
DB_STATEMENT_TIMEOUT=3s

# Operator Default (ULID user dari database)
DEFAULT_OPERATOR_ID=01JXXXXXXXXXXXXXXXXXXXXXXX

# Timezone tampilan
APP_TIMEZONE=Asia/Makassar

# Logging
LOG_LEVEL=info
```

Atau gunakan `DATABASE_URL` format:

```env
DATABASE_URL=postgres://user:pass@localhost:5432/fenturun2026?sslmode=disable
```

## Cara Menjalankan

### Development

```bash
# Install dependencies Go
go mod tidy

# Install dependencies frontend
cd web && npm install && cd ..

# Jalankan Go backend
make run
```

Buka browser:
- **Display**: `http://localhost:3001/?station=1`
- **Scanner**: `http://localhost:3001/runner-scanner?station=1`

### Production Build

```bash
# Build frontend + Go binary
make build

# Jalankan
./bin/scanner
```

### Testing

```bash
# Jalankan semua test
make test

# Jalankan Go vet
go vet ./...
```

## UI Layout

### Runner Display (Dark Theme)

```
┌──────────────────────────────────────────────┐
│ [F]                           STATION #1     │
│                                              │
│          WELCOME, RUNNERS!                   │
│                                              │
│              10K                             │
│                                              │
│             T0033                            │
│                                              │
│        Rizkyka Rumengan                      │
│          BIB: KIKA                           │
│          Jersey: XS                          │
│          260605/WJA                          │
│                                              │
│  © 2026 Fenturun 2026. Microsite By DEKA    │
└──────────────────────────────────────────────┘
```

### Runner Scanner (Light Theme)

```
┌──────────────────────────────────────────────┐
│ [F]  Runner Scanner             Station #1   │
│              Race Pack 🔘   ● Ready          │
├──────────────────────────────────────────────┤
│                                              │
│  Scan QR Code Tiket                          │
│  ┌────────────────────────────────────────┐  │
│  │ [Input auto-focus untuk barcode scanner]│  │
│  └────────────────────────────────────────┘  │
│  Input otomatis dari barcode scanner USB     │
│                                              │
│  ┌─ Last Result ─────────────────────────┐   │
│  │ #T0033 — Rizkyka Rumengan             │   │
│  └───────────────────────────────────────┘   │
│                                              │
│  ┌─ Riwayat Scan ────────────────────────┐   │
│  │ Waktu | Invoice | Kategori | BIB | Nama│  │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Mode Display Only
- Scan QR → tampilkan info peserta (nama, BIB, kategori, jersey).
- Tidak ada konfirmasi pickup.

### Mode Race Pack
- Scan QR → tampilkan info peserta + modal verifikasi.
- Konfirmasi → update database (race_pack_picked_up_at/by).

## Persyaratan Browser

Target utama:

- Chrome Android versi modern.
- Safari iOS versi modern.
- Browser dengan dukungan `getUserMedia` (untuk mode kamera).
- Lebar viewport minimum sekitar 360 piksel.

Production wajib menggunakan HTTPS dengan sertifikat yang dipercaya perangkat.

## Keamanan dan Privasi

- Koneksi PostgreSQL menggunakan TLS jika melewati jaringan yang tidak sepenuhnya dipercaya.
- Seluruh query menggunakan parameter binding.
- Database credential hanya tersedia pada service, tidak pernah dikirim ke browser.
- Service fail closed ketika database atau koneksi tidak tersedia.
- Status sukses hanya ditampilkan setelah database mengonfirmasi update.
- Log tidak boleh berisi password, database URL, NIK, email, telepon, atau data sensitif lainnya.

Data peserta yang boleh digunakan pada UI:

- Nama participant.
- BIB name.
- BIB number.
- Ukuran jersey.
- Kategori ticket.
- Nomor order.

## Operasional

Service menyediakan:

- `/healthz` untuk health check process.
- `/readyz` untuk memeriksa kesiapan koneksi database.
- Structured log JSON pada production.
- Request ID, outcome, status HTTP, dan durasi pada log.
- Graceful shutdown dan penutupan koneksi database.

Target performa dalam kondisi jaringan dan database normal:

- P95 validasi scan maksimal 500 ms.
- P95 konfirmasi pickup maksimal 500 ms.

## Struktur Project

```text
cmd/scanner/              — Entrypoint dan lifecycle
internal/cache/           — In-memory cache untuk display data
internal/config/          — Environment parsing/validation
internal/store/           — pgx pool dan klasifikasi DB error
internal/httpapi/         — router, middleware, response envelope
internal/scanner/         — QR parser, validation, pickup, outcomes
internal/scanner/sql/     — SQL queries (lookup, pickup, diagnose)
internal/webui/           — Embedded frontend assets
web/src/                  — TypeScript dan CSS
web/public/               — Manifest, icon, service worker
test/integration/         — Fixture dan PostgreSQL integration tests
docs/                     — PRD, plan, schema contract
```

## Tahapan Implementasi

1. **Fondasi** — Go module, konfigurasi, connection pool, HTTP server, health check, dan logging.
2. **Scanner Core** — parser QR, query data, business validation, dan atomic pickup update.
3. **Display** — in-memory cache, polling, dark theme UI.
4. **Scanner UI** — input barcode scanner, mode toggle, riwayat scan, feedback visual/suara.

## Batasan MVP

MVP tidak mencakup:

- Login dan autentikasi user.
- Mode offline atau sinkronisasi pickup.
- Migration dan tabel scanner baru.
- Audit permanen setiap scan di PostgreSQL.
- Dashboard laporan lintas station.
- Pembatalan pickup oleh operator biasa.
- Pengelolaan order, payment, participant, ticket, user, role, atau permission.
- Aplikasi native Android atau iOS.
- Penyimpanan gambar atau video kamera.

## Dokumentasi

- [`docs/prd.md`](docs/prd.md) — Product Requirements Document.
- [`docs/plan.md`](docs/plan.md) — Technical implementation plan.
- [`docs/schema-contract.md`](docs/schema-contract.md) — Database schema contract.
- [`docs/traceability.md`](docs/traceability.md) — Requirement traceability matrix.
