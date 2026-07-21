# Context

Fenturun 2026 membutuhkan scanner race pack terpisah yang lebih ringan dan nyaman di smartphone daripada scanner Filament/Livewire existing. Repository scanner saat ini baru berisi `README.md` dan `docs/prd.md`; belum ada source code, Go module, frontend, test, atau deployment artifact.

Aplikasi Go akan membaca user, role/permission, order, participant, dan ticket langsung dari PostgreSQL existing Laravel, lalu hanya memperbarui `orders.race_pack_picked_up_at`, `orders.race_pack_picked_up_by`, dan `orders.updated_at`. Target akhirnya adalah scanner online-only yang aman terhadap double pickup, meminimalkan PII, dapat digunakan beberapa perangkat sekaligus, dan telah diverifikasi pada Chrome Android serta Safari iOS.

Kontrak Laravel yang sudah terverifikasi:

- Semua entity utama menggunakan ULID; kolom pickup dan FK operator sudah tersedia.
- QR aktual adalah URL absolut `/ticket/{order-ulid}/ticket.pdf`, dibentuk oleh `Order::ticketUrl()` di `../fenturun2026/app/Models/Order.php` dan route di `../fenturun2026/routes/web.php`.
- Password Laravel menggunakan hash bcrypt; user memiliki `username`, `email`, dan trait Spatie `HasRoles` di `../fenturun2026/app/Models/User.php`.
- Role/permission memakai tabel `roles`, `permissions`, `model_has_roles`, `model_has_permissions`, dan `role_has_permissions` dari migration `../fenturun2026/database/migrations/2024_03_19_101507_create_permission_tables.php`.
- Scanner Laravel existing di `../fenturun2026/app/Filament/Public/Pages/RunnerScanner.php` tidak boleh disalin apa adanya karena masih melakukan read-before-update, memakai waktu aplikasi, tidak memvalidasi participant count tepat satu, dan mengambil PII berlebih.
- Contoh grant PRD perlu disesuaikan: ukuran jersey berasal dari `participants.ukuran_jersey`; scanner hanya memerlukan `tickets.id`, `tickets.parent_id`, dan `tickets.name` untuk kategori.

# Pendekatan Teknis

Bangun satu service Go stateless yang menyajikan API dan frontend PWA dari origin yang sama:

```text
Browser/PWA --HTTPS--> Go service --pgxpool/TLS--> PostgreSQL Laravel
```

Keputusan implementasi:

- HTTP menggunakan `net/http`; logging menggunakan `log/slog`; PostgreSQL menggunakan `pgx/v5` dan `pgxpool`.
- Tidak memakai ORM, Redis, message queue, migration production, atau tabel scanner baru.
- Session disimpan dalam cookie terenkripsi dan ditandatangani (`gorilla/securecookie`) agar dapat berjalan pada beberapa replica dengan `SESSION_SECRET` yang sama. Cookie hanya membawa user ULID dan metadata timeout; role/permission diperiksa kembali ke database pada protected request.
- Cookie production menggunakan prefix `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, idle timeout default 30 menit, dan absolute timeout default 8 jam.
- Mutasi dilindungi CSRF (`gorilla/csrf`) dan pemeriksaan same-origin. Login dibatasi di aplikasi, ditambah rate limit ingress saat production multi-replica.
- Default akses adalah role `admin` dan `super_admin`; resolver juga mendukung direct/inherited permission scanner melalui tabel Spatie dan konfigurasi permission opsional.
- Frontend menggunakan vanilla TypeScript + CSS yang dibangun dengan Vite. `BarcodeDetector` digunakan bila tersedia, dengan `@zxing/browser` yang dibundel lokal sebagai fallback. Output frontend di-embed ke binary Go.
- PWA hanya meng-cache application shell dan asset statis; semua route `/auth`, `/api`, `/healthz`, dan `/readyz` bypass cache. Tidak ada background sync atau antrean pickup offline.
- Duplicate pickup menampilkan timestamp sebelumnya, bukan nama operator sebelumnya, untuk meminimalkan data.
- Outcome API didefinisikan sebagai typed constants yang digunakan konsisten oleh service, handler, dan TypeScript: `valid`, `picked_up`, `invalid_payload`, `not_found`, `not_paid`, `participant_missing`, `multiple_participants`, `already_picked_up`, `unauthenticated`, `forbidden`, `database_unavailable`, dan `internal_error`.

Struktur utama yang akan dibuat:

```text
cmd/scanner/                 composition root dan lifecycle
internal/config/             environment parsing/validation
internal/store/              pgx pool dan klasifikasi DB error
internal/httpapi/            router, middleware, response envelope
internal/auth/               login, role/permission, session, CSRF
internal/scanner/            QR parser, validation, pickup, outcomes
internal/scanner/sql/        lookup, conditional update, diagnosis
internal/webui/              embedded frontend assets
web/src/                     TypeScript dan CSS
web/public/                  manifest, icon, service worker
test/integration/            fixture dan PostgreSQL integration tests
test/load/                   load/concurrency scenario
deploy/                      container, least-privilege grants, runbook
```

# Fase Pengerjaan

## Fase 0 — Kontrak Schema dan Baseline Test

**Tujuan:** memastikan kode dibangun terhadap schema Laravel aktual, bukan asumsi dokumentasi.

Pekerjaan:

1. Petakan tipe, nullability, FK, index, dan relasi kolom yang benar-benar digunakan dari migration/model Laravel.
2. Konfirmasi pada database staging secara read-only:
   - distribusi participant per order;
   - nilai status order;
   - role/guard/model type Spatie efektif;
   - tipe timestamp dan timezone PostgreSQL;
   - index `participants.order_id`;
   - kategori ticket parent/child;
   - kemungkinan identity login ambigu antara username dan email.
3. Buat schema/fixture PostgreSQL minimal di `test/integration/` yang mempertahankan ULID, FK operator, soft delete, participant cardinality, dan role/permission pivots.
4. Buat proof test kompatibilitas bcrypt menggunakan hash fixture Laravel non-production.
5. Bekukan kontrak endpoint, JSON response envelope, typed outcomes, dan mapping HTTP.
6. Koreksi bagian grant di `docs/prd.md` agar tidak merujuk `tickets.ukuran_jersey`, tanpa mengubah scope produk.

**Gate:** tidak ada nama kolom/relasi yang belum diketahui; bcrypt fixture dapat diverifikasi dari Go; fixture mendukung auth, lookup, dan pickup concurrency test; schema mismatch PRD sudah terselesaikan.

## Fase 1 — Fondasi Service Go

**Tujuan:** menghasilkan service yang dapat start, terhubung ke database, observable, dan berhenti dengan aman.

File representatif:

- `go.mod`, `go.sum`
- `cmd/scanner/main.go`
- `internal/config/config.go`
- `internal/store/postgres.go`
- `internal/httpapi/router.go`
- `internal/httpapi/middleware.go`
- `.env.example`

Pekerjaan:

1. Inisialisasi Go module dan dependency minimum.
2. Implementasikan loader serta validasi seluruh environment PRD: alamat HTTP, public URL, database URL/pool/timeout, session secret/timeouts, allowed roles, timezone, dan log level.
3. Buat `pgxpool` dengan operation deadline, statement timeout, batas pool, TLS dari koneksi, dan timezone `Asia/Makassar`.
4. Implementasikan HTTP server timeout, body-size limit, JSON content validation, request ID, panic recovery, security headers, structured request log, dan graceful shutdown.
5. Implementasikan `/healthz` sebagai process liveness serta `/readyz` sebagai database readiness dengan timeout singkat.
6. Pastikan log production tidak mencatat request body, cookie, authorization header, database URL, PII, atau ULID mentah; order/operator identifier dicatat sebagai hash/mask.
7. Siapkan build target yang membangun frontend sebelum asset di-embed ke binary.
8. Perbarui `README.md` dengan setup lokal dan perintah yang benar setelah build flow benar-benar tersedia.

**Gate:** config invalid gagal dengan pesan aman; health tetap hidup tanpa DB; readiness menjadi 503 saat DB putus; log bebas secret/PII; shutdown menutup request dan pool secara tertib; build/test fondasi lulus.

## Fase 2 — Authentication, Authorization, dan Session

**Tujuan:** memakai kredensial Laravel tanpa membuat user/session table baru.

File representatif:

- `internal/auth/service.go`
- `internal/auth/repository.go`
- `internal/auth/session.go`
- `internal/auth/authorization.go`
- `internal/auth/handler.go`
- `internal/auth/sql/find_user.sql`
- `internal/auth/sql/is_authorized.sql`

Pekerjaan:

1. Implementasikan `POST /auth/login`, `POST /auth/logout`, dan `GET /auth/session`.
2. Login menerima username exact atau email case-insensitive melalui parameterized query, membatasi panjang input, dan menolak hasil ambigu secara generik.
3. Verifikasi hash Laravel dengan `x/crypto/bcrypt`; gunakan dummy hash saat user tidak ditemukan untuk mengurangi timing difference.
4. Resolver otorisasi memeriksa role yang dikonfigurasi serta direct/inherited permission melalui Spatie dengan `guard_name = 'web'` dan model type user Laravel.
5. Implementasikan cookie session stateless, idle/absolute expiry, sliding renewal terbatas, logout, dan authorization recheck pada protected API request.
6. Terapkan CSRF, same-origin check, generic login errors, login rate limit, trusted-proxy handling, dan `Cache-Control: no-store`.
7. Jangan menyimpan atau mencatat password, hash, email, session cookie, role list, atau credential mentah.

**Gate:** `admin`/`super_admin` dapat login; `customer` tanpa permission ditolak; direct dan inherited permission teruji; pesan user-not-found/password-wrong identik; cookie security attributes dan timeout teruji; request tanpa CSRF ditolak; session dapat digunakan lintas dua instance dengan secret yang sama.

## Fase 3 — Scanner Backend dan Pickup Atomik

**Tujuan:** menyediakan validasi tiket dan pickup yang fail-closed serta aman dari race condition.

File representatif:

- `internal/scanner/outcome.go`
- `internal/scanner/parser.go`
- `internal/scanner/service.go`
- `internal/scanner/repository.go`
- `internal/scanner/handler.go`
- `internal/scanner/sql/lookup_order.sql`
- `internal/scanner/sql/pickup.sql`
- `internal/scanner/sql/diagnose_pickup.sql`

Pekerjaan:

1. Parser menerima payload maksimal yang dibatasi untuk:
   - full HTTP/HTTPS ticket URL dengan path exact;
   - `/ticket/{ulid}` atau `/ticket/{ulid}/ticket.pdf`;
   - raw ULID.
2. Parser trim input, memvalidasi Crockford Base32/ULID canonical 26 karakter, menolak scheme/path/userinfo tambahan, dan tidak pernah membuka URL.
3. Implementasikan `POST /api/scans/validate` dengan query minimal yang mengambil order, participant count, satu participant bila count tepat satu, dan kategori ticket dengan parent fallback.
4. Terapkan urutan outcome deterministik: tidak ditemukan/soft-deleted, belum paid, participant hilang, participant lebih dari satu, sudah diambil, lalu valid.
5. Response hanya membawa nomor order, nama participant, BIB name/number, ukuran jersey, kategori, dan status pickup; jangan SELECT NIK, identity file, telepon, email, tanggal lahir, kontak darurat, atau pembayaran.
6. Implementasikan `POST /api/orders/{order_ulid}/pickup`; operator ID selalu berasal dari session.
7. Conditional update harus memeriksa kembali status paid, soft delete, pickup masih null, dan participant count tepat satu dalam statement yang sama, menggunakan `CURRENT_TIMESTAMP`, lalu `RETURNING` hasil database.
8. Bila update menghasilkan nol row, jalankan diagnostic lookup untuk menentukan outcome aktual; nol row tidak pernah dipetakan menjadi sukses.
9. Format timestamp UI ke WITA tanpa menjadikan jam smartphone sebagai sumber kebenaran.
10. Tambahkan unit/fuzz test parser serta integration test lookup, status, soft delete, participant cardinality, duplicate sequential, dan duplicate concurrent.

**Gate:** seluruh format QR existing lolos; payload invalid ditolak sebelum query; order non-paid/anomali participant tidak berubah; dua koneksi yang pickup order sama menghasilkan tepat satu `picked_up`; pickup kedua tidak menimpa operator/timestamp pertama; timeout/DB failure tidak pernah menampilkan sukses; query dan response mematuhi allowlist PII.

## Fase 4 — UI Smartphone dan PWA

**Tujuan:** menyediakan alur operasional yang cepat melalui kamera dengan input fallback.

File representatif:

- `web/package.json`, `web/package-lock.json`
- `web/src/main.ts`
- `web/src/api.ts`
- `web/src/camera.ts`
- `web/src/scanner.ts`
- `web/src/history.ts`
- `web/src/styles.css`
- `web/public/manifest.webmanifest`
- `web/public/service-worker.js`
- `internal/webui/assets.go`

Pekerjaan:

1. Buat halaman login dan scanner responsif mulai lebar 360 px, portrait/landscape, dengan semantic HTML dan keyboard/focus accessibility.
2. Implementasikan state machine UI: idle, meminta izin kamera, scanning, validating, menunggu konfirmasi, pickup, result, dan offline/error.
3. Buka kamera belakang dengan `facingMode: environment`; sediakan retry, stop/start, camera switch, dan torch hanya bila capability tersedia.
4. Gunakan `BarcodeDetector` untuk QR jika tersedia dan fallback `@zxing/browser` lokal; video/frame tidak pernah dikirim ke server.
5. Pause decoder serta gunakan request lock/debounce setelah QR ditemukan agar payload yang sama tidak diproses paralel.
6. Tambahkan keyboard-wedge handling dan form input manual tanpa mengganggu input normal/accessibility.
7. Tampilkan verification modal dengan data allowlist saja; tombol pickup dinonaktifkan selama request dan tidak melakukan optimistic success.
8. Tampilkan feedback teks, ikon, warna, dan suara yang dapat dimute. Warna bukan indikator tunggal.
9. Simpan maksimal 20 hasil terbaru di `sessionStorage`, tandai sebagai riwayat lokal, dan hapus ketika logout/session expired.
10. Gunakan `navigator.onLine` hanya sebagai sinyal; respons readiness/API tetap otoritatif. Pada gangguan, tampilkan pesan tegas agar race pack tidak diserahkan.
11. Buat PWA installable yang hanya meng-cache static shell; API/auth selalu network-only dan offline mode menonaktifkan validasi/pickup.

**Gate:** kamera/fallback/input manual bekerja; QR sama tidak menimbulkan request paralel; tidak ada frame terunggah; UI hanya sukses setelah outcome `picked_up`; network timeout tetap fail closed; PWA offline tidak dapat pickup; UI dan modal dapat digunakan pada viewport minimum dan keyboard.

## Fase 5 — Verification dan Hardening

**Tujuan:** membuktikan acceptance criteria, performa, security, privacy, dan kompatibilitas perangkat.

File representatif:

- `test/integration/auth_test.go`
- `test/integration/scanner_test.go`
- `test/integration/concurrency_test.go`
- `web/tests/*.spec.ts`
- `test/load/scanner.js`

Pekerjaan:

1. Jalankan unit test untuk config, parser/ULID, bcrypt, resolver role/permission, session expiry, CSRF, outcome mapping, dan log redaction.
2. Jalankan PostgreSQL integration test dengan privilege setara production untuk seluruh status order, participant cardinality, ticket parent fallback, FK operator, statement timeout, duplicate sequential/concurrent, serta recovery setelah DB tersedia kembali.
3. Jalankan browser test login/logout, permission kamera accepted/denied, native/fallback decoder, keyboard scanner, manual input, request lock, mute, local history, session timeout, offline shell, portrait, dan landscape.
4. Jalankan `go test -race`, static analysis, vulnerability scan, frontend dependency audit, dan pemeriksaan CSP/cookie/CSRF/rate-limit.
5. Jalankan load test untuk beberapa station, burst scan, order yang sama, dan pool limit; ukur P95 validate/pickup terhadap target 500 ms.
6. Inspeksi response, server log, browser cache, service worker cache, dan session storage untuk memastikan tidak ada PII terlarang.
7. Uji manual melalui HTTPS pada perangkat acara: Chrome Android, Safari iOS, kamera belakang, torch, camera switch, kondisi minim cahaya, serta scanner USB/Bluetooth aktual.

**Gate:** seluruh test wajib lulus; concurrency test konsisten menghasilkan tepat satu sukses; P95 memenuhi target pada staging representatif; tidak ada vulnerability high/critical atau kebocoran PII; golden path dan error path lulus pada Android/iOS fisik.

## Fase 6 — Deployment dan Kesiapan Operasional

**Tujuan:** menghasilkan deployment production yang least-privilege, observable, dan memiliki prosedur acara yang jelas.

File representatif:

- `deploy/Dockerfile`
- `deploy/postgres-grants.sql`
- `deploy/runbook.md`
- `deploy/checklist.md`
- deployment manifest sesuai platform yang dipilih

Pekerjaan:

1. Buat multi-stage image: frontend deterministic build, static Go binary, final image non-root dengan CA certificates dan tanpa source/compiler/secret.
2. Buat database role dengan SELECT per kolom dan UPDATE hanya pada tiga kolom order yang disetujui; credential tersebut tidak boleh memiliki CREATE/INSERT/DELETE atau update tabel lain.
3. Jalankan schema compatibility preflight menggunakan credential scanner sebelum rollout.
4. Deploy same-origin di belakang HTTPS; konfigurasi trusted proxy, global login rate limit, PostgreSQL TLS/firewall, shared session secret, dan konfigurasi identik lintas replica.
5. Hubungkan liveness ke `/healthz`, readiness ke `/readyz`, serta structured JSON log ke penyimpanan terpusat.
6. Monitor outcome, HTTP status, durasi/P95, database unavailable, auth rejection, dan participant anomaly tanpa raw order/operator ID.
7. Buat runbook untuk DB outage, duplicate report, participant anomaly, secret rotation, rollback, dan aturan bahwa race pack tidak diserahkan tanpa konfirmasi sukses database.
8. Jalankan smoke test staging/production terbatas: login, validate, pickup, duplicate, DB outage, session timeout, dan lintas replica.
9. Lakukan dry run station lengkap pada domain, jaringan, dan perangkat yang digunakan saat acara.

**Gate:** production credential lulus schema/grant preflight; HTTPS dan DB protection aktif; health/readiness termonitor; log terpusat bebas PII; smoke test multi-replica dan perangkat fisik lulus; rollback dan runbook telah diuji serta disetujui operator/supervisor.

# Dependensi dan Paralelisasi

Fase 0 adalah barrier utama. Setelah schema, endpoint, outcome, dan JSON contract stabil:

- Fondasi HTTP/database tetap menjadi critical path awal.
- Auth/session dan scanner parser/query dapat dikerjakan paralel setelah repository/pool interface stabil.
- UI kamera dapat dibangun paralel memakai mock response yang mengikuti typed outcome contract.
- Container, least-privilege grant, test fixture, dan monitoring field contract dapat disiapkan paralel tanpa menunggu seluruh UI selesai.
- Semua jalur bergabung pada Fase 5; deployment production tidak dimulai sebelum verification gate lulus.

Urutan critical path:

```text
Schema contract
  -> service foundation
  -> authentication/session
  -> atomic scanner backend
  -> integrated smartphone UI
  -> verification/hardening
  -> production readiness
```

# Verifikasi End-to-End

Skenario minimum sebelum dianggap selesai:

1. Login menggunakan user Laravel `admin` atau `super_admin`; user salah dan user tidak berwenang ditolak tanpa membocorkan penyebab.
2. Scan full URL QR existing melalui kamera Android/iOS, tampilkan data minimum yang benar, konfirmasi, lalu verifikasi database mengisi operator dan `CURRENT_TIMESTAMP`.
3. Scan relative path dan raw ULID melalui input manual/keyboard scanner.
4. Scan order pending/cancelled/expired, soft-deleted, participant nol, dan participant lebih dari satu; pastikan tidak ada perubahan database.
5. Konfirmasi order yang sama dari dua smartphone/koneksi pada saat bersamaan; tepat satu perangkat mendapat sukses dan data pertama tidak ditimpa.
6. Putuskan database atau jaringan saat validasi/pickup; UI tidak menampilkan sukses dan meminta operator tidak menyerahkan race pack. Setelah pulih, scan ulang menunjukkan state database aktual.
7. Tolak permission kamera lalu selesaikan alur melalui keyboard scanner dan input manual.
8. Jalankan PWA saat offline; shell boleh tampil tetapi validasi dan pickup wajib nonaktif.
9. Logout/expire session; kamera dihentikan, riwayat browser dibersihkan, dan protected endpoint kembali 401.
10. Periksa log, response, cache, dan storage browser untuk memastikan password, credential, NIK, email, telepon, file identitas, serta raw order/operator ID tidak tersimpan.

# File Kritis

File existing yang menjadi sumber kontrak dan akan diperbarui bila diperlukan:

- `docs/prd.md` — koreksi schema grant tanpa mengubah scope.
- `README.md` — setup, build, run, test, dan deployment overview setelah implementasi tersedia.

File implementasi paling kritis yang akan dibuat:

- `cmd/scanner/main.go`
- `internal/config/config.go`
- `internal/auth/session.go`
- `internal/auth/authorization.go`
- `internal/scanner/parser.go`
- `internal/scanner/service.go`
- `internal/scanner/sql/lookup_order.sql`
- `internal/scanner/sql/pickup.sql`
- `web/src/scanner.ts`
- `web/src/camera.ts`
- `web/public/service-worker.js`
- `test/integration/concurrency_test.go`
- `deploy/postgres-grants.sql`
