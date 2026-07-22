# Status Implementasi P0–P3

## Selesai di repository

### Baseline dan Fondasi

- Service Go menyediakan entrypoint, konfigurasi environment, koneksi PostgreSQL `pgxpool`, timeout HTTP, graceful shutdown, structured logging, `/healthz`, dan `/readyz`.
- Frontend Vite/TypeScript dibangun ke `internal/web/dist` dan disajikan oleh binary Go.
- Parser QR menerima full ticket URL, relative ticket path, dan raw ULID tanpa membuka URL dari QR.
- Validasi order memeriksa paid, soft delete, participant cardinality tepat satu, dan pickup status.
- Pickup menggunakan conditional update atomik dan waktu database.

### Auth Scanner

- `/runner-scanner` tetap terbuka tanpa login dalam mode Display Only.
- Toggle Race Pack membuka modal login jika session scanner belum aktif.
- Login memakai user Laravel dari PostgreSQL, password bcrypt, serta role/permission Spatie guard `web`.
- Session scanner disimpan dalam cookie Go terpisah dari session Laravel, dengan idle dan absolute timeout.
- Pickup dilindungi auth session, CSRF, dan same-origin check; operator ID berasal dari session.
- Logout mematikan mode Race Pack lokal dan hanya menampilkan sukses bila server logout berhasil.

### P0/P1 Event Ready

- Modal verifikasi mengunci input scanner, kamera, toggle, dan logout selama verifikasi.
- Double-click confirm hanya mengirim satu request pickup.
- Semua input kamera, USB keyboard wedge, dan manual masuk ke satu jalur submit/validate.
- Kamera QR memakai decoder lokal browser dan fallback USB/manual tetap tersedia saat permission denied atau kamera gagal.
- Status UI tidak lagi `Ready` statis; readiness/API/offline/processing/verification pending ditampilkan dinamis.
- Rate limiter login scoped per identity + client IP dan bounded.
- Trusted proxy forwarding hanya dipakai dari CIDR yang dikonfigurasi.
- Log validate/pickup mencatat outcome/duration/request ID dengan order/operator ID dimasking; raw QR, nama, email, password, dan payload tiket penuh tidak dicatat.
- Access log pickup meredaksi ULID path.

### P2 Hardening Produksi

- `SESSION_SECRET` dan `CSRF_SECRET` dipisah; production wajib mengatur keduanya secara eksplisit.
- Session ID fail closed bila random source gagal.
- Production wajib memilih `DB_SSLMODE` eksplisit atau menyertakan `sslmode` pada `DATABASE_URL`.
- Station validate/display dinormalisasi dan dibatasi ke rentang valid.
- Display cache dibatasi jumlah entry agar endpoint publik tidak membuat key tak terbatas.
- Diagnosis pickup mengembalikan soft-deleted order sebagai `not_found` sebelum status non-paid.

### P3 Produk dan Release Hygiene

- Manifest PWA diarahkan ke `/runner-scanner`.
- Service worker mendaftarkan shell/static scanner dan membuat `/api`, `/auth`, `/healthz`, serta `/readyz` tetap network-only.
- Riwayat scan disimpan maksimal 20 item di `sessionStorage`, diberi label “riwayat lokal sementara, bukan audit resmi”, dan dihapus saat logout/session expired.
- Dokumentasi README, PRD, traceability, dan status implementasi disinkronkan dengan Display Only publik, Race Pack login modal, session Go, kamera/USB/manual, hardening secret/DB, dan limitation aktual.

## Verifikasi otomatis terakhir

```text
go test ./...
```

Lulus setelah P2. P3 perlu menjalankan ulang `go test ./...` dan `npm --prefix web run build` karena ada perubahan frontend/dokumentasi.

## Belum selesai / butuh environment eksternal

- Device test kamera pada Chrome Android dan Safari iOS melalui HTTPS harus dilakukan pada perangkat fisik acara/staging.
- PostgreSQL integration test penuh untuk fixture paid/non-paid/soft-delete/participant cardinality/duplicate concurrent belum dijalankan di environment ini.
- Icon PWA saat ini placeholder; produksi sebaiknya mengganti dengan icon event final.
- Load test dan fresh container smoke perlu dilakukan sebelum release production.
