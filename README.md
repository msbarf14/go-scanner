# Fenturun 2026 BIB & Race Pack Scanner

Aplikasi Go untuk memvalidasi tiket peserta, menampilkan data BIB, dan mencatat penyerahan race pack menggunakan database PostgreSQL milik aplikasi Laravel Fenturun 2026.

## Halaman

### Runner Display — `/`

Tampilan fullscreen untuk TV/monitor yang menampilkan peserta berdasarkan station dan selalu menerima input scanner USB/Bluetooth keyboard wedge.

```text
https://scanner.example.com/?station=1
```

Input scanner tersembunyi secara default. Tambahkan `debug=1` untuk menampilkan field input saat setup atau pengujian:

```text
https://scanner.example.com/?station=1&debug=1
```

### Runner Scanner — `/runner-scanner`

Halaman scanner untuk laptop, HP, atau tablet.

```text
https://scanner.example.com/runner-scanner?station=1
```

Tersedia dua mode:

- **Display Only** — dapat digunakan tanpa login dan tidak mengubah database.
- **Race Pack** — wajib login memakai akun Laravel yang memiliki role atau permission scanner.

Input QR didukung melalui:

- Kamera browser.
- Scanner USB/Bluetooth keyboard wedge.
- Input manual.

### Data Pickup Race Pack — `/race-pack-pickups`

Halaman monitoring untuk melihat status akhir peserta/order yang sudah melakukan pengambilan race pack.

```text
https://scanner.example.com/race-pack-pickups
```

Halaman memakai login operator yang sama dengan Race Pack. Saat belum login, data tetap kosong dan modal login ditampilkan. Data yang tersedia adalah waktu pickup, order, BIB, peserta, kategori, jersey, dan operator. Halaman ini bukan audit scan dan tidak memiliki data station.

## Fitur Utama

- Mendukung full ticket URL, relative ticket path, dan raw order ULID.
- Memvalidasi status `paid`, soft delete, dan jumlah participant.
- Menggunakan asumsi `1 order = 1 participant = 1 BIB = 1 race pack`.
- Mencegah double pickup dengan conditional update atomik PostgreSQL.
- Operator pickup selalu berasal dari session scanner.
- Session Go terpisah dari session Laravel.
- Proteksi CSRF, same-origin, secure cookie, dan login rate limiting.
- Kamera memproses QR secara lokal; gambar/video tidak dikirim ke server.
- Status koneksi dan kesiapan database ditampilkan pada scanner.
- Riwayat lokal maksimal 20 item per station di `sessionStorage`; bukan audit resmi.
- PWA hanya meng-cache shell dan asset statis. API dan pickup selalu membutuhkan jaringan.
- Structured logging meminimalkan PII dan meredaksi identifier sensitif.

## Aturan Pickup

Pickup hanya berhasil jika:

- Order ditemukan dan tidak soft-deleted.
- `orders.status = 'paid'`.
- Order memiliki tepat satu participant.
- `orders.race_pack_picked_up_at IS NULL`.
- Operator memiliki session dan hak akses scanner yang valid.

Service hanya memperbarui kolom berikut:

```text
orders.race_pack_picked_up_at
orders.race_pack_picked_up_by
orders.updated_at
```

Service tidak membuat migration atau tabel baru.

## Menjalankan Secara Lokal

Persyaratan:

- Go 1.24+
- Node.js 22+
- PostgreSQL yang kompatibel dengan schema Laravel

Salin konfigurasi:

```bash
cp .env.example .env
```

Install dependency dan jalankan:

```bash
npm --prefix web install
make run
```

Default URL:

```text
http://localhost:8080/
http://localhost:8080/runner-scanner?station=1
```

## Environment Production

Contoh minimum:

```env
APP_ENV=production
HTTP_ADDR=:8080
PUBLIC_BASE_URL=https://scanner.example.com

DB_HOST=postgres-service-name
DB_PORT=5432
DB_DATABASE=fenturun2026
DB_USERNAME=scanner_service
DB_PASSWORD=change-me
DB_SSLMODE=disable

DB_MAX_CONNECTIONS=10
DB_MIN_CONNECTIONS=1
DB_STATEMENT_TIMEOUT=3s

SESSION_SECRET=replace-with-openssl-base64-output
CSRF_SECRET=replace-with-another-openssl-base64-output
SESSION_IDLE_TIMEOUT=30m
SESSION_ABSOLUTE_TIMEOUT=8h

ALLOWED_SCANNER_ROLES=admin,super_admin
ALLOWED_SCANNER_PERMISSIONS=scanner.access

APP_TIMEZONE=Asia/Makassar
LOG_LEVEL=info
TRUSTED_PROXY_CIDRS=
```

Generate secret terpisah:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

`DB_SSLMODE=disable` dapat digunakan jika Go dan PostgreSQL berada dalam private network Coolify yang sama dan port database tidak diekspos publik. Gunakan `require` atau mode TLS yang lebih ketat untuk database eksternal atau jaringan yang tidak dipercaya.

Sebagai alternatif, gunakan `DATABASE_URL` dengan `sslmode` eksplisit:

```env
DATABASE_URL=postgres://user:password@host:5432/fenturun2026?sslmode=require
```

## Deploy Coolify

Repository menyediakan multi-stage `Dockerfile` yang:

1. Membangun frontend dengan Node.js.
2. Membangun binary Go statis.
3. Menjalankan aplikasi sebagai non-root user pada port `8080`.

Konfigurasi Coolify:

- Build pack: **Dockerfile**.
- Port: `8080`.
- Health check: `/healthz`.
- Domain harus HTTPS agar kamera dan secure session berfungsi.
- Gunakan `/readyz` untuk memeriksa koneksi database setelah container aktif.
- Masukkan secret sebagai runtime environment variable, bukan build variable.

Build variable frontend opsional:

```env
VITE_ASSET_BASE_URL=https://r2.fenturun2026.com/assets
VITE_ASSET_VERSION=11
```

## Endpoint

```text
GET  /                         Runner Display
GET  /runner-scanner           Runner Scanner
GET  /race-pack-pickups        Monitoring pickup race pack
GET  /api/display              Data display per station
GET  /api/race-pack-pickups    Daftar pickup race pack
POST /api/scans/validate       Validasi tiket
GET  /auth/session             Status session scanner
GET  /auth/csrf                Token CSRF
POST /auth/login               Login operator Race Pack
POST /auth/logout              Logout scanner
POST /api/orders/{ulid}/pickup Konfirmasi pickup
GET  /healthz                  Process health
GET  /readyz                   Database readiness
```

## Build dan Test

```bash
npm --prefix web run build
go test ./...
```

Build binary lengkap:

```bash
make build
./bin/scanner
```

## Batasan

- Pickup wajib online; tidak ada antrean atau sinkronisasi offline.
- Riwayat browser bukan audit resmi.
- Halaman Data Pickup menampilkan status akhir database, bukan audit scan/station.
- Tidak ada pembatalan pickup di aplikasi ini.
- Kamera production wajib diuji pada Chrome Android dan Safari iOS melalui HTTPS.
- Database user scanner harus menggunakan least privilege.

## Dokumentasi Lanjutan

- [`docs/prd.md`](docs/prd.md) — kebutuhan produk dan acceptance criteria.
- [`docs/schema-contract.md`](docs/schema-contract.md) — kontrak schema database.
- [`docs/traceability.md`](docs/traceability.md) — status requirement dan verifikasi.
- [`docs/plan.md`](docs/plan.md) — rencana teknis dan fase implementasi.
