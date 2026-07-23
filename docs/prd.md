# PRD - Fenturun 2026 BIB & Race Pack Scanner

## 1. Informasi Dokumen

| Item | Nilai |
|---|---|
| Nama produk | Fenturun 2026 BIB & Race Pack Scanner |
| Jenis produk | Web scanner berbasis Go dengan dua halaman: Display dan Scanner |
| Aplikasi sumber | `../fenturun2026` |
| Database | PostgreSQL existing milik aplikasi Laravel |
| Target perangkat | TV/monitor (Display) dan HP/tablet (Scanner) |
| Metode input utama | Kamera browser lokal dan scanner USB/Bluetooth keyboard wedge |
| Metode input cadangan | Input manual |
| Mode koneksi | Online wajib untuk validasi dan pickup |
| Status dokumen | Sinkron dengan implementasi scanner event-ready P2/P3 |
| Tanggal verifikasi data | 20 Juli 2026 |

## 2. Ringkasan Produk

Fenturun 2026 BIB & Race Pack Scanner adalah aplikasi berbasis Go untuk memvalidasi tiket peserta dan menandai race pack telah diserahkan. Aplikasi terdiri dari dua halaman:

1. **Runner Display** (`/`) — Tampilan fullscreen untuk TV/monitor yang menampilkan info peserta setelah scan.
2. **Runner Scanner** (`/runner-scanner`) — Halaman input untuk operator menggunakan barcode scanner USB.

Service Go terhubung langsung ke database PostgreSQL existing milik aplikasi Laravel Fenturun 2026. Service tidak membuat atau mengelola order, participant, ticket, maupun pembayaran. Service hanya membaca data yang diperlukan untuk validasi dan memperbarui status pengambilan race pack pada order yang valid.

Halaman scanner tetap dapat dibuka tanpa login dalam mode **Display Only**. Mode **Race Pack** wajib login melalui modal memakai akun Laravel; Go memverifikasi password, role/permission, lalu membuat session scanner terpisah.

MVP tidak membutuhkan migration atau tabel baru. Status pengambilan menggunakan kolom existing:

```text
orders.race_pack_picked_up_at
orders.race_pack_picked_up_by
```

Keputusan tersebut didasarkan pada pemeriksaan read-only database existing pada 20 Juli 2026:

| Pemeriksaan | Hasil |
|---|---:|
| Total order | 3.653 |
| Total participant | 3.653 |
| Order dengan tepat satu participant | 3.653 |
| Order tanpa participant | 0 |
| Order dengan lebih dari satu participant | 0 |
| Jumlah participant maksimum per order | 1 |
| Mismatch `orders.quantity` dengan jumlah participant | 0 |
| Order berstatus paid | 3.146 |
| Paid order dengan tepat satu participant | 3.146 |

Konfigurasi efektif Laravel juga menetapkan `ticket.max_participant = 1`. Oleh karena itu, pada Fenturun 2026 berlaku asumsi bisnis:

```text
1 order = 1 participant = 1 BIB = 1 race pack
```

Scanner tetap wajib memverifikasi asumsi tersebut pada setiap scan. Order dengan jumlah participant selain satu harus ditolak dan diteruskan kepada supervisor untuk pemeriksaan manual.

## 3. Latar Belakang

Aplikasi Laravel Fenturun 2026 telah menangani registrasi, pembayaran, penerbitan tiket digital, QR tiket, BIB, user, role, dan status race pack. Aplikasi tersebut juga memiliki scanner berbasis Filament/Livewire, tetapi operasional pengambilan race pack membutuhkan aplikasi yang lebih ringan dan nyaman digunakan.

Kebutuhan utama operasional adalah:

- Menampilkan info peserta pada TV/monitor untuk verifikasi visual.
- Memindai QR tiket menggunakan barcode scanner USB.
- Memberikan hasil validasi dalam waktu singkat.
- Memastikan hanya order paid yang dapat mengambil race pack.
- Mencegah race pack yang sama diserahkan dua kali.
- Menyimpan operator dan waktu pengambilan pada database existing.
- Tetap kompatibel dengan tiket yang telah diterbitkan Laravel.
- Tidak menambah kompleksitas migration untuk MVP.

## 4. Tujuan Produk

### 4.1 Tujuan Utama

Menyediakan proses scan dan konfirmasi pengambilan race pack yang cepat, sederhana, aman dari pengambilan ganda, dengan tampilan display untuk TV/monitor dan input melalui barcode scanner USB.

### 4.2 Tujuan Operasional

- Sistem dapat menampilkan info peserta pada TV/monitor (Runner Display).
- Petugas dapat memindai tiket menggunakan kamera browser, barcode scanner USB/Bluetooth, atau input manual.
- Sistem dapat mengenali QR tiket existing tanpa menerbitkan ulang tiket.
- Petugas dapat melihat identitas operasional minimum peserta sebelum menyerahkan race pack.
- Sistem dapat mencatat waktu dan operator pengambilan.
- Sistem dapat menolak tiket invalid, tidak ditemukan, belum paid, atau sudah diambil.
- Sistem dapat digunakan oleh beberapa petugas dan perangkat secara bersamaan.

### 4.3 Tujuan Teknis

- Menyediakan service Go yang ringan dan mudah di-deploy.
- Menggunakan koneksi PostgreSQL yang aman dan terbatas.
- Melakukan konfirmasi pickup secara atomik dalam satu statement database.
- Menyediakan dua halaman: Display (dark theme) dan Scanner (light theme).
- Menggunakan in-memory cache untuk data display.
- Menyediakan health check dan structured logging.
- Tidak menambahkan migration atau tabel database pada MVP.

## 5. Non-Goals

MVP tidak mencakup:

- Pembuatan, perubahan, atau pembatalan order.
- Perubahan status pembayaran.
- Pengelolaan ticket, participant, event, atau voucher.
- Penerbitan atau regenerasi QR tiket.
- Pengiriman email atau WhatsApp.
- Mode offline untuk menyerahkan race pack.
- Penyimpanan video atau gambar kamera.
- Aplikasi native Android atau iOS.
- Pengambilan sebagian untuk order multi-participant.
- Riwayat audit scan permanen di database baru.
- Pembatalan status pickup oleh operator biasa.
- Perubahan password atau role user Laravel.

## 6. Pengguna dan Hak Akses

### 6.1 Scanner Operator

Scanner Operator adalah petugas penyerahan race pack.

Hak akses:

- Membuka halaman scanner.
- Melakukan scan tiket.
- Melihat data minimum peserta.
- Mengonfirmasi penyerahan race pack.
- Melihat hasil scan dalam session perangkat saat ini.

Mode Display Only dapat digunakan tanpa autentikasi. Mode Race Pack hanya aktif setelah operator login memakai akun Laravel dan lolos role/permission scanner.

### 6.2 Supervisor

Supervisor menangani kasus yang tidak dapat diproses otomatis.

Hak akses minimum:

- Seluruh hak Scanner Operator.
- Menangani order dengan anomali data.
- Melakukan pemeriksaan melalui panel Laravel.

Koreksi atau pembatalan pickup tetap dilakukan melalui prosedur administratif, bukan tombol umum pada MVP scanner.

### 6.3 Admin dan Super Admin

Akun Laravel dengan role `admin` atau `super_admin` dapat diberi akses sebagai supervisor. Implementasi harus mendukung permission scanner khusus apabila ditambahkan pada konfigurasi existing.

## 7. Aturan Bisnis

### 7.1 Kelayakan Tiket

Order hanya dapat mengambil race pack jika seluruh kondisi berikut terpenuhi:

- QR dapat diparsing menjadi ULID order yang valid.
- Order ditemukan.
- Order tidak soft-deleted.
- `orders.status = 'paid'`.
- Order memiliki tepat satu participant.
- `orders.race_pack_picked_up_at IS NULL`.
- Operator telah login dan memiliki hak akses scanner.

### 7.2 Status Pengambilan

Order dianggap belum mengambil race pack jika:

```text
orders.race_pack_picked_up_at IS NULL
```

Order dianggap sudah mengambil race pack jika:

```text
orders.race_pack_picked_up_at IS NOT NULL
```

Kolom `orders.race_pack_picked_up_by` menyimpan ULID user Laravel yang mengonfirmasi penyerahan.

### 7.3 Kardinalitas Participant

Scanner tidak boleh mengasumsikan participant pertama selalu benar tanpa memeriksa jumlah data.

| Jumlah participant | Perilaku |
|---:|---|
| 0 | Tolak dan tampilkan anomali data |
| 1 | Lanjutkan validasi dan konfirmasi |
| Lebih dari 1 | Tolak dan arahkan ke supervisor |

Jika aplikasi Laravel di masa depan mengaktifkan lebih dari satu participant per order, kebutuhan scanner harus ditinjau ulang dan kemungkinan membutuhkan penyimpanan pickup per participant.

### 7.4 Waktu Pengambilan

- Waktu pickup harus berasal dari PostgreSQL menggunakan `CURRENT_TIMESTAMP`.
- Waktu pada smartphone tidak boleh menjadi sumber kebenaran.
- Timezone tampilan mengikuti `Asia/Makassar` atau WITA.
- Timestamp tetap disimpan menggunakan tipe dan konvensi existing database.

### 7.5 Pencegahan Pengambilan Ganda

Konfirmasi pickup tidak boleh menggunakan pola baca status lalu update tanpa syarat. Update harus memiliki kondisi `race_pack_picked_up_at IS NULL` agar dua perangkat tidak dapat sama-sama berhasil.

Statement konseptual:

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

Hasil yang diharapkan:

- Satu row dikembalikan: pickup berhasil.
- Nol row dikembalikan: service membaca ulang status untuk membedakan tidak ditemukan, belum paid, soft-deleted, atau sudah diambil.
- Pickup berhasil tidak boleh ditimpa oleh operator berikutnya.

## 8. Scope MVP

### 8.1 In Scope

- Web scanner responsif berbasis Go.
- Login menggunakan data user Laravel.
- Validasi role atau permission operator.
- Session login scanner.
- Kamera smartphone sebagai input utama.
- Dukungan kamera belakang.
- Dukungan torch jika tersedia pada perangkat.
- Dukungan pergantian kamera.
- Scanner USB/Bluetooth keyboard wedge sebagai fallback.
- Input manual sebagai fallback terakhir.
- Parsing QR tiket existing.
- Validasi order paid dan participant.
- Tampilan ringkasan peserta dan BIB.
- Modal atau layar konfirmasi penyerahan.
- Update atomik status pickup.
- Informasi duplicate pickup.
- Riwayat scan sementara dalam session browser.
- Structured application log.
- Endpoint health dan readiness.
- PWA installable untuk smartphone.

### 8.2 Out of Scope

- Migration dan tabel scanner baru.
- Offline pickup dan sinkronisasi setelah online.
- Penyimpanan audit setiap scan ke PostgreSQL.
- Dashboard laporan lintas station.
- Manajemen station dari database.
- Push notification.
- Integrasi printer.
- Scan dokumen identitas.
- Face recognition.
- Native mobile packaging.

## 9. Format QR yang Didukung

QR tiket existing berisi URL tiket Laravel dan mengidentifikasi order menggunakan ULID. Scanner harus menerima:

### 9.1 Full Ticket URL

```text
https://domain.example/ticket/{order-ulid}/ticket.pdf
```

### 9.2 Relative Path

```text
/ticket/{order-ulid}/ticket.pdf
```

atau:

```text
/ticket/{order-ulid}
```

### 9.3 Raw Order ULID

```text
01JXXXXXXXXXXXXXXXXXXXXXXX
```

### 9.4 Validasi Payload

- Input harus di-trim.
- ULID harus tepat 26 karakter dan menggunakan karakter Crockford Base32 yang valid.
- Panjang input harus dibatasi untuk mencegah payload berlebihan.
- Parser tidak boleh mengeksekusi URL atau membuka URL dari QR.
- Parser hanya mengambil identifier order.
- Input selain format yang didukung harus ditolak.

QR berfungsi sebagai identifier, bukan sebagai autentikasi. Otorisasi tetap berasal dari session operator.

## 10. Alur Pengguna

### 10.1 Login Operator Race Pack

1. Operator membuka `/runner-scanner`; halaman tampil dalam mode Display Only tanpa login.
2. Operator menyalakan toggle Race Pack.
3. Jika session scanner belum aktif, sistem membuka modal login.
4. Operator memasukkan username atau email dan password Laravel.
5. Go mencari user pada tabel `users` menggunakan parameterized query.
6. Go memverifikasi password terhadap hash Laravel.
7. Go memeriksa role atau permission yang diizinkan.
8. Jika valid, Go membuat session scanner terpisah dari session Laravel dan Race Pack aktif.

### 10.2 Aktivasi Kamera

1. Halaman meminta izin kamera kepada browser.
2. Browser menampilkan dialog permission.
3. Setelah disetujui, kamera belakang dibuka.
4. Sistem menampilkan area bidik QR.
5. Jika kamera gagal, sistem menawarkan retry, pergantian kamera, atau input alternatif.

### 10.3 Scan Tiket Valid

1. Operator mengarahkan kamera ke QR.
2. Browser mendeteksi dan membaca QR secara lokal.
3. Kamera dipause agar QR yang sama tidak diproses berulang.
4. Browser mengirim teks hasil scan ke Go.
5. Go memvalidasi format dan mengambil order ULID.
6. Go membaca order, participant, dan ticket terkait.
7. Go memeriksa seluruh aturan kelayakan.
8. Sistem menampilkan nama, BIB, kategori, dan ukuran jersey.
9. Operator memeriksa data dan menekan konfirmasi.
10. Go melakukan conditional update atomik.
11. Sistem menampilkan status hijau dan bunyi sukses.
12. Kamera aktif kembali untuk scan selanjutnya.

### 10.4 Tiket Sudah Diambil

1. Sistem menemukan `race_pack_picked_up_at` telah terisi.
2. Sistem tidak mengubah database.
3. Sistem menampilkan status kuning atau merah.
4. Sistem menampilkan waktu pengambilan sebelumnya.
5. Nama operator sebelumnya hanya ditampilkan jika diizinkan.
6. Percobaan ini masuk structured application log tanpa data pribadi berlebihan.

### 10.5 Tiket Belum Paid

1. Sistem menemukan status order selain `paid`.
2. Sistem tidak mengubah database.
3. Sistem menampilkan status merah dan pesan tiket belum valid untuk pickup.
4. Kamera dapat diaktifkan kembali setelah operator menutup hasil.

### 10.6 Gangguan Koneksi

1. Service atau browser mendeteksi request gagal.
2. Sistem menampilkan status koneksi bermasalah.
3. Sistem tidak boleh menampilkan pickup berhasil.
4. Race pack tidak boleh diserahkan sebelum server mengembalikan konfirmasi sukses.
5. Operator dapat mencoba ulang setelah koneksi pulih.

## 11. Functional Requirements

### 11.1 Authentication dan Authorization

| Kode | Requirement |
|---|---|
| AUTH-001 | Display Only pada `/runner-scanner` dapat digunakan tanpa login. |
| AUTH-002 | Mode Race Pack wajib login melalui modal memakai username/email dan password Laravel. |
| AUTH-003 | Go membuat session scanner sendiri yang terpisah dari session Laravel. |
| AUTH-004 | Pickup hanya menggunakan operator ID dari session scanner. |
| AUTH-005 | Role/permission scanner diverifikasi melalui tabel Spatie guard `web`. |
| AUTH-006 | Logout scanner hanya mematikan session scanner dan tidak mengubah session Laravel. |

### 11.2 Kamera dan Input

| Kode | Requirement |
|---|---|
| CAM-001 | Sistem mendukung kamera browser sebagai input QR lokal. |
| CAM-002 | Kamera memprioritaskan kamera belakang bila tersedia dan tidak mengirim frame ke backend. |
| CAM-003 | Scanner USB/Bluetooth keyboard wedge tetap didukung dengan input auto-focus. |
| CAM-004 | Sistem mendukung input manual sebagai fallback. |
| CAM-005 | Semua input masuk ke lock validasi yang sama agar request tidak paralel saat proses/modal aktif. |
| CAM-006 | Permission denied/camera unavailable tidak boleh memblokir USB/manual. |

### 11.3 Validasi Ticket

| Kode | Requirement |
|---|---|
| SCN-001 | Sistem harus menerima full URL tiket, relative path, dan raw order ULID. |
| SCN-002 | Sistem harus menolak format QR yang tidak valid. |
| SCN-003 | Sistem harus menolak order yang tidak ditemukan. |
| SCN-004 | Sistem harus menolak order yang soft-deleted. |
| SCN-005 | Sistem harus menolak order selain status `paid`. |
| SCN-006 | Sistem harus memastikan order memiliki tepat satu participant. |
| SCN-007 | Sistem harus menolak order tanpa participant atau dengan lebih dari satu participant. |
| SCN-008 | Sistem harus menampilkan nama, BIB name, BIB number, kategori ticket, dan ukuran jersey. |
| SCN-009 | Sistem tidak boleh mengambil NIK, file identitas, telepon, atau email jika tidak diperlukan UI. |
| SCN-010 | Sistem harus menampilkan apakah race pack belum atau sudah diambil. |

### 11.4 Konfirmasi Pickup

| Kode | Requirement |
|---|---|
| PCK-001 | Pickup hanya dapat dikonfirmasi oleh operator terautentikasi dan berwenang. |
| PCK-002 | Sistem harus meminta konfirmasi operator setelah data peserta ditampilkan. |
| PCK-003 | Sistem harus mengisi `race_pack_picked_up_at` menggunakan waktu database. |
| PCK-004 | Sistem harus mengisi `race_pack_picked_up_by` menggunakan ULID operator. |
| PCK-005 | Sistem harus melakukan conditional update dengan syarat order paid, tidak soft-deleted, dan belum diambil. |
| PCK-006 | Hanya satu request yang boleh berhasil ketika dua perangkat mengonfirmasi order yang sama secara bersamaan. |
| PCK-007 | Sistem tidak boleh menimpa operator dan waktu pickup sebelumnya. |
| PCK-008 | Sistem harus menampilkan hasil akhir berdasarkan respons database, bukan state lokal browser. |

### 11.5 Feedback dan Riwayat Lokal

| Kode | Requirement |
|---|---|
| UI-001 | Sistem harus memberikan feedback visual untuk sukses, peringatan, dan error. |
| UI-002 | Sistem harus memberikan feedback suara yang dapat dinonaktifkan. |
| UI-003 | Sistem harus menampilkan status koneksi/readiness: checking, ready, offline, database not ready, processing, dan verification pending. |
| UI-004 | Sistem harus menyimpan dan menampilkan maksimal 20 riwayat scan terbaru pada `sessionStorage` browser. |
| UI-005 | Riwayat lokal harus diberi label bukan audit resmi dan dihapus saat logout/session expired. |
| UI-006 | UI harus kembali siap scan setelah hasil ditutup atau diproses. |

### 11.6 Operasional

| Kode | Requirement |
|---|---|
| OPS-001 | Service harus menyediakan endpoint `/healthz`. |
| OPS-002 | Service harus menyediakan endpoint `/readyz` yang memeriksa kesiapan database. |
| OPS-003 | Service harus menghasilkan structured log berformat JSON pada production. |
| OPS-004 | Log harus menyertakan request ID, outcome, durasi, dan order identifier yang dimasking atau di-hash. |
| OPS-005 | Log tidak boleh memuat password, session secret, database URL, NIK, email, telepon, atau raw authorization data. |
| OPS-006 | Service harus melakukan graceful shutdown dan menutup koneksi database dengan benar. |

## 12. User Interface

### 12.1 Halaman Runner Display (`/`)

Halaman display untuk TV/monitor dengan dark theme.

Komponen:

- Logo dan nama event.
- Station number.
- Idle state: "Scan QR Code Tiket Anda" dengan ikon QR.
- Active state: BIB number besar, nama peserta, kategori, jersey, nomor order.
- Animasi transisi saat data baru masuk.
- Polling data setiap 500ms.
- Input scanner USB/Bluetooth keyboard wedge selalu aktif dan auto-focus.
- Input transparan secara default; `debug=1` menampilkan field input sebagai overlay untuk setup/manual test.
- Station parameter via URL (`?station=1`).

### 12.2 Halaman Runner Scanner (`/runner-scanner`)

Halaman input untuk operator dengan light theme.

Komponen:

- Logo dan nama event.
- Station number.
- Toggle Race Pack mode.
- Status indicator (Ready).
- Input field dengan auto-focus untuk barcode scanner.
- Last scan result banner (success/error).
- Riwayat scan (max 20 item).
- Station parameter via URL (`?station=1`).

### 12.3 Layar Verifikasi (Race Pack Mode)

Data yang ditampilkan pada modal verifikasi:

- Nomor order.
- Nama participant.
- BIB name.
- BIB number.
- Kategori ticket.
- Ukuran jersey.

### 12.4 Halaman Data Pickup Race Pack (`/race-pack-pickups`)

Halaman monitoring operator untuk peserta/order yang sudah mengambil race pack.

Komponen:

- Login modal memakai session dan otorisasi Race Pack yang sama dengan Runner Scanner.
- Saat belum login, area data kosong dan tidak memanggil API daftar pickup.
- Tabel desktop dan kartu mobile berisi waktu pickup, nomor/status order, nomor BIB, nama peserta, nama BIB, kategori, ukuran jersey, dan operator.
- Pencarian order/BIB/nama, filter waktu pickup, filter kategori, refresh otomatis, refresh manual, dan pagination cursor.
- Catatan jelas bahwa data adalah status akhir database, bukan audit scan dan tidak memiliki station.
- API dan halaman monitoring tidak boleh menyimpan data peserta di cache browser/service worker.

### 12.5 Status Visual

| Kondisi | Warna | Feedback suara |
|---|---|---|
| Scan berhasil | Hijau | Beep pendek (880Hz) |
| Error/invalid | Merah | Beep panjang (300Hz) |

Warna tidak boleh menjadi satu-satunya indikator. Setiap status harus memiliki teks yang jelas.

## 13. Dukungan Smartphone dan Kamera

### 13.1 Target Browser

- Chrome Android versi modern.
- Safari iOS versi modern.
- Browser harus mendukung `getUserMedia`.
- Resolusi minimum UI sekitar 360 piksel.
- Orientasi portrait dan landscape.

### 13.2 Strategi QR Decoder

Urutan decoder yang direkomendasikan:

1. Gunakan native `BarcodeDetector` jika tersedia.
2. Gunakan library JavaScript seperti `@zxing/browser` sebagai fallback.

Fallback diperlukan karena dukungan `BarcodeDetector` tidak konsisten pada semua kombinasi iOS, Safari, Android, dan Chrome.

### 13.3 HTTPS

Akses kamera browser memerlukan secure context. Production harus menggunakan URL HTTPS dengan sertifikat yang dipercaya perangkat, misalnya:

```text
https://scanner.fenturun.example
```

Akses smartphone melalui alamat IP HTTP tidak dapat dijadikan deployment production karena browser dapat menolak akses kamera.

### 13.4 PWA

Web scanner sebaiknya dapat ditambahkan ke home screen sebagai PWA.

PWA boleh menyimpan:

- HTML shell.
- CSS.
- JavaScript.
- Ikon dan asset statis.

PWA tidak boleh:

- Menandai pickup sukses saat offline.
- Menyimpan antrean pickup untuk dikirim kemudian.
- Menggunakan cache eligibility lama sebagai izin menyerahkan race pack.

## 14. Integrasi Database Existing

### 14.1 Tabel yang Dibaca

| Tabel | Tujuan |
|---|---|
| `users` | Login dan identitas operator |
| `roles` dan pivot role | Otorisasi operator |
| `permissions` dan pivot permission | Otorisasi jika permission khusus digunakan |
| `orders` | Status paid dan status pickup |
| `participants` | Nama, BIB, dan ukuran jersey |
| `tickets` | Kategori dan variasi ticket |

### 14.2 Tabel yang Ditulis

MVP hanya menulis tabel `orders`, terbatas pada kolom:

```text
race_pack_picked_up_at
race_pack_picked_up_by
updated_at
```

### 14.3 Tidak Ada Migration Baru

MVP tidak menambahkan:

- Tabel pickup.
- Tabel scanner event.
- Tabel station.
- Tabel session scanner.
- Kolom baru pada order atau participant.

Konsekuensinya:

- Status pickup hanya menyimpan hasil akhir.
- Riwayat scan gagal tidak tersimpan di database.
- Station tidak menjadi bagian dari record pickup.
- Idempotency persisten tidak tersedia, tetapi conditional update tetap mencegah double pickup.
- Riwayat sementara hanya tersedia pada browser dan structured service log.

### 14.4 Database Role

Service Go harus menggunakan database role khusus dan tidak menggunakan superuser atau kredensial Laravel dengan hak penuh. Akses baca juga harus dibatasi per kolom karena tabel `users`, `orders`, dan `participants` menyimpan data pribadi yang tidak dibutuhkan scanner.

Hak minimum yang dibutuhkan secara konseptual:

```sql
GRANT SELECT (id, name, username, email, password)
ON users TO scanner_service;

GRANT SELECT (id, name, guard_name)
ON roles TO scanner_service;

GRANT SELECT (id, name, guard_name)
ON permissions TO scanner_service;

GRANT SELECT (role_id, model_type, model_id)
ON model_has_roles TO scanner_service;

GRANT SELECT (permission_id, model_type, model_id)
ON model_has_permissions TO scanner_service;

GRANT SELECT (permission_id, role_id)
ON role_has_permissions TO scanner_service;

GRANT SELECT (
    id, number, ticket_id, status, deleted_at,
    race_pack_picked_up_at, race_pack_picked_up_by
)
ON orders TO scanner_service;

GRANT SELECT (
    id, order_id, name, bib_name, bib_number, ukuran_jersey
)
ON participants TO scanner_service;

GRANT SELECT (id, parent_id, name)
ON tickets TO scanner_service;

GRANT UPDATE (
    race_pack_picked_up_at,
    race_pack_picked_up_by,
    updated_at
) ON orders TO scanner_service;
```

Nama tabel role/permission dan grant akhir harus disesuaikan dengan schema PostgreSQL production.

## 15. Authentication Design

### 15.1 Sumber User

Go menggunakan data user existing Laravel. Go tidak membuat tabel user baru dan tidak menyinkronkan password.

### 15.2 Verifikasi Password

- Konfigurasi efektif Laravel telah diverifikasi menggunakan driver `bcrypt`.
- Implementasi Go harus memverifikasi hash bcrypt Laravel menggunakan library yang terawat, seperti `golang.org/x/crypto/bcrypt`.
- Password diverifikasi di memory dan segera dibuang.
- Password dan hash tidak boleh dicatat ke log.
- Perubahan algoritma hash Laravel di masa depan harus diikuti pengujian kompatibilitas Go.

### 15.3 Otorisasi

Role existing yang terverifikasi adalah:

```text
admin
customer
super_admin
```

Default MVP mengizinkan `admin` dan `super_admin`, serta menolak `customer`. Role khusus `scanner_operator` atau `scanner_supervisor` dapat ditambahkan kemudian melalui mekanisme role/permission existing Laravel tanpa mengubah schema.

### 15.4 Session

- Session menggunakan cookie yang ditandatangani dan dienkripsi atau session server-side yang tidak membutuhkan tabel baru.
- Cookie wajib `Secure`, `HttpOnly`, dan `SameSite` yang sesuai.
- Session harus memiliki absolute dan idle timeout.
- Secret session berasal dari environment atau secret manager.
- Logout harus menghapus atau membatalkan session.

## 16. API Internal Web Scanner

Endpoint final dapat disesuaikan saat technical design, tetapi MVP membutuhkan kontrak konseptual berikut.

### 16.1 Display Data

```text
GET /api/display?station=1
```

Response sukses:

```json
{
  "outcome": "ok",
  "data": {
    "display": {
      "order": {
        "id": "01J...",
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

### 16.2 Validasi Scan

```text
POST /api/scans/validate
```

Request:

```json
{
  "payload": "01KTAR98MT66XQXB4TQ10XBZNF",
  "station": "1"
}
```

Response sukses:

```json
{
  "outcome": "valid",
  "order": {
    "id": "01J...",
    "number": "260622/MRV",
    "status": "paid",
    "race_pack_picked_up": false
  },
  "participant": {
    "name": "Nama Peserta",
    "bib_name": "NAMA BIB",
    "bib_number": "S0001",
    "jersey_size": "L"
  },
  "ticket": {
    "category": "5K"
  }
}
```

### 16.3 Konfirmasi Pickup

```text
POST /api/orders/{order_ulid}/pickup
```

Response sukses:

```json
{
  "outcome": "picked_up",
  "order_id": "01J...",
  "picked_up_at": "2026-07-20T10:15:42+08:00"
}
```

### 16.4 Error Outcome

Machine-readable outcome minimum:

```text
invalid_payload
not_found
not_paid
participant_missing
multiple_participants
already_picked_up
unauthenticated
forbidden
database_unavailable
internal_error
```

## 17. Non-Functional Requirements

### 17.1 Performance

- P95 validasi scan maksimal 500 ms pada kondisi jaringan dan database normal.
- P95 konfirmasi pickup maksimal 500 ms pada kondisi normal.
- UI kembali siap scan maksimal satu detik setelah hasil ditutup.
- Service harus menggunakan connection pool PostgreSQL.
- Query hanya memilih kolom yang diperlukan.
- Asset web sebaiknya di-embed ke binary Go atau dilayani secara efisien.

### 17.2 Reliability

- Hanya respons database sukses yang boleh menghasilkan status pickup berhasil.
- Service harus fail closed ketika database tidak tersedia.
- Query pickup harus atomic dan concurrency-safe.
- Timeout database harus dapat dikonfigurasi.
- Service harus melakukan graceful shutdown.
- Retry koneksi tidak boleh menyebabkan overwrite pickup yang telah terjadi.

### 17.3 Security

- Seluruh trafik browser production menggunakan HTTPS.
- Koneksi PostgreSQL menggunakan TLS jika melewati jaringan yang tidak sepenuhnya trusted.
- Database credential tidak pernah dikirim ke browser.
- Database credential disimpan di environment atau secret manager.
- Query menggunakan parameter binding.
- Cookie session menggunakan atribut keamanan yang sesuai.
- Endpoint mutasi memiliki proteksi CSRF jika menggunakan cookie session.
- Login memiliki rate limiting.
- Response dan log meminimalkan PII.
- Kamera diproses lokal dan tidak direkam.

### 17.4 Privacy

Scanner hanya membutuhkan:

- Nama participant.
- BIB name.
- BIB number.
- Ukuran jersey.
- Kategori ticket.
- Nomor order.

Scanner tidak boleh mengambil atau menampilkan NIK, file identitas, telepon, email, tanggal lahir, kontak darurat, atau data pembayaran tanpa perubahan requirement yang disetujui.

### 17.5 Observability

Structured log minimum:

- Timestamp server.
- Request ID.
- Endpoint.
- Outcome.
- HTTP status.
- Durasi request.
- Operator ID yang dimasking bila diperlukan.
- Order ID yang dimasking atau di-hash.
- Jenis error tanpa raw credential atau PII.

Karena tidak ada tabel audit baru, retention dan sentralisasi log menjadi tanggung jawab deployment.

## 18. Error Handling

| Kondisi | Pesan Operator | Perubahan Database |
|---|---|---|
| QR kosong atau invalid | QR tiket tidak valid | Tidak ada |
| Order tidak ditemukan | Order tidak ditemukan | Tidak ada |
| Order soft-deleted | Order tidak dapat diproses | Tidak ada |
| Order belum paid | Tiket belum valid untuk pengambilan | Tidak ada |
| Participant tidak ada | Data participant tidak lengkap, hubungi supervisor | Tidak ada |
| Participant lebih dari satu | Order multi-participant tidak didukung, hubungi supervisor | Tidak ada |
| Sudah diambil | Race pack sudah diambil pada waktu yang ditampilkan | Tidak ada |
| User tidak berwenang | Anda tidak memiliki akses scanner | Tidak ada |
| Database unavailable | Koneksi server bermasalah, jangan serahkan race pack | Tidak ada |
| Pickup berhasil | Race pack berhasil diserahkan | Update order |

Pesan teknis detail hanya masuk log server dan tidak ditampilkan penuh kepada operator.

## 19. Acceptance Criteria

### 19.1 Login

- User Laravel dengan kredensial valid dan role yang diizinkan dapat login.
- User dengan password salah tidak dapat login.
- User tanpa role atau permission scanner tidak dapat mengakses halaman scanner.
- Password tidak terlihat pada log.
- Session yang expired mengarahkan operator kembali ke login.

### 19.2 Kamera

- Kamera belakang dapat dibuka pada Chrome Android melalui HTTPS.
- Kamera dapat dibuka pada Safari iOS yang didukung melalui HTTPS.
- Penolakan permission kamera menghasilkan instruksi dan fallback input.
- QR yang terdeteksi tidak dikirim terus-menerus selama request diproses.
- Tidak ada gambar atau video yang dikirim ke service Go.

### 19.3 Validasi

- Full ticket URL existing berhasil diparsing.
- Relative ticket path berhasil diparsing.
- Raw order ULID berhasil diparsing.
- Payload invalid ditolak sebelum query pickup.
- Order pending, review, expired, error, atau cancelled ditolak.
- Paid order dengan satu participant menampilkan data minimum yang benar.
- Order tanpa participant atau lebih dari satu participant ditolak.

### 19.4 Pickup

- Konfirmasi valid mengisi `race_pack_picked_up_at` dan `race_pack_picked_up_by`.
- Waktu pickup berasal dari database.
- Scan kedua terhadap order yang sama tidak menimpa record pertama.
- Dua smartphone yang mengonfirmasi secara bersamaan menghasilkan tepat satu pickup sukses.
- Operator dan waktu pickup pertama tetap tersimpan setelah duplicate scan.
- UI hanya menampilkan sukses setelah database mengembalikan row hasil update.

### 19.5 Koneksi

- Jika PostgreSQL tidak tersedia, readiness gagal.
- Jika PostgreSQL tidak tersedia, konfirmasi pickup ditolak.
- Browser tidak menampilkan status sukses ketika request timeout.
- Setelah koneksi pulih, operator dapat scan ulang dan memperoleh status aktual.

## 20. Testing Strategy

### 20.1 Unit Test

- Parser full URL.
- Parser relative path.
- Parser raw ULID.
- Penolakan karakter ULID invalid.
- Penolakan payload terlalu panjang.
- Password verification kompatibel Laravel.
- Role dan permission resolver.
- Mapping outcome ke response dan UI state.

### 20.2 Integration Test PostgreSQL

- Lookup paid order dan participant.
- Penolakan order non-paid.
- Penolakan soft-deleted order.
- Penolakan participant count nol.
- Penolakan participant count lebih dari satu.
- Conditional update pickup.
- Duplicate sequential.
- Duplicate concurrent dari dua koneksi.
- Operator foreign key invalid.
- Database timeout dan rollback.

### 20.3 Browser Test

- Login dan logout.
- Permission kamera disetujui.
- Permission kamera ditolak.
- Scan kamera sukses.
- Fallback scanner keyboard.
- Input manual.
- Responsive portrait dan landscape.
- Feedback suara dan opsi mute.
- Session timeout.

### 20.4 Load Test

Simulasi minimum:

- Beberapa station melakukan validasi order berbeda secara bersamaan.
- Beberapa station memproses order yang sama.
- Burst scan pada waktu pembukaan race pack.
- Database connection pool mencapai batas konfigurasi.

## 21. Success Metrics

| Area | Metric |
|---|---|
| Kecepatan | P95 validasi dan pickup memenuhi target |
| Akurasi | Tidak ada pickup sukses untuk order non-paid |
| Duplicate prevention | Tepat satu pickup sukses untuk order yang sama |
| Operasional | Persentase scan kamera sukses tanpa input manual |
| Reliability | Persentase request sukses selama jam operasional |
| Data quality | Jumlah order dengan participant count selain satu |
| Support | Jumlah kasus yang membutuhkan supervisor |

## 22. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Dua smartphone mengonfirmasi order yang sama | Race pack diserahkan dua kali | Conditional update atomik dengan `race_pack_picked_up_at IS NULL` |
| Konfigurasi Laravel berubah menjadi multi-participant | Status order tidak lagi mewakili satu BIB | Periksa jumlah participant pada setiap scan dan fail closed |
| Kamera tidak didukung atau permission ditolak | Operator tidak dapat scan lewat kamera | Scanner keyboard dan input manual sebagai fallback |
| Aplikasi diakses melalui HTTP | Kamera browser ditolak | Wajib HTTPS dengan sertifikat terpercaya |
| Database terputus | Status pickup tidak dapat dipastikan | Online wajib dan fail closed |
| Kredensial database Go bocor | Akses data dan update tanpa izin | Database role khusus, TLS, secret manager, least privilege |
| Hash password Laravel berubah | Login operator gagal | Compatibility test dan monitoring login failure |
| Tidak ada tabel audit | Riwayat scan gagal tidak permanen | Structured log terpusat dan evaluasi tabel audit pada fase berikutnya |
| QR yang sama terbaca berkali-kali | Request berulang dan UX buruk | Pause kamera, debounce, request lock, dan conditional update |
| Smartphone lambat atau minim cahaya | Scan lambat | Kamera belakang, torch, area bidik, dan fallback manual |

## 23. Deployment Requirements

### 23.1 Arsitektur

```text
┌─────────────────┐     ┌─────────────────┐
│  Runner Display  │     │  Runner Scanner  │
│  (TV/Monitor)    │     │  (HP/Tablet)     │
│  /?station=1     │     │  /runner-scanner │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │ HTTP/HTTPS
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

### 23.2 Environment Variables

Konfigurasi minimum:

```text
APP_ENV
HTTP_ADDR
PUBLIC_BASE_URL
DATABASE_URL
DB_HOST
DB_PORT
DB_DATABASE
DB_USERNAME
DB_PASSWORD
DB_SSLMODE
DB_MAX_CONNECTIONS
DB_MIN_CONNECTIONS
DB_STATEMENT_TIMEOUT
SESSION_SECRET
CSRF_SECRET
SESSION_IDLE_TIMEOUT
SESSION_ABSOLUTE_TIMEOUT
ALLOWED_SCANNER_ROLES
ALLOWED_SCANNER_PERMISSIONS
APP_TIMEZONE
LOG_LEVEL
TRUSTED_PROXY_CIDRS
```

### 23.3 Deployment Checklist

- Domain scanner telah tersedia.
- Sertifikat HTTPS dipercaya perangkat Android dan iOS.
- Database role scanner telah dibuat dengan least privilege dan hanya grant kolom yang dibutuhkan.
- PostgreSQL dapat diakses dari host Go.
- Firewall membatasi akses database.
- Session secret dan CSRF secret kuat telah dikonfigurasi terpisah.
- `DB_SSLMODE` atau `DATABASE_URL?sslmode=` telah diputuskan eksplisit untuk production.
- Role/permission operator yang diizinkan telah ditetapkan.
- Health check terhubung ke monitoring.
- Log production dikirim ke penyimpanan terpusat.
- Kamera diuji pada perangkat acara sebenarnya.
- Uji konkurensi dilakukan pada database staging.

## 24. Tahapan Implementasi

### Fase 1 - Fondasi

- Inisialisasi Go module.
- Konfigurasi environment.
- PostgreSQL connection pool.
- HTTP server, health check, dan structured logging.

### Fase 2 - Authentication

- Query user Laravel.
- Verifikasi password.
- Resolver role atau permission.
- Session dan CSRF protection.

### Fase 3 - Scanner Core

- QR parser.
- Query order, participant, dan ticket.
- Business validation.
- Conditional pickup update.
- Typed outcomes dan error handling.

### Fase 4 - Smartphone UI

- Responsive scanner page.
- Kamera belakang.
- Native decoder dan fallback QR library.
- Torch, camera switch, debounce, dan pause/resume.
- Scanner keyboard dan input manual.
- Feedback visual dan suara.

### Fase 5 - Verification

- Unit dan integration tests.
- Concurrency test.
- Browser test Android dan iOS.
- Load test beberapa station.
- Security and privacy review.
- Staging pilot dengan data non-production atau salinan aman.

## 25. Keputusan Produk

Keputusan yang telah disepakati:

1. Scanner dibuat sebagai aplikasi Go terpisah dari Laravel.
2. Go terhubung langsung ke PostgreSQL existing.
3. Tidak ada migration atau tabel baru pada MVP.
4. Status pickup menggunakan kolom existing pada `orders`.
5. Satu order diperlakukan sebagai satu participant/BIB berdasarkan data dan konfigurasi existing.
6. Scanner menolak order apabila participant count tidak tepat satu.
7. Kamera smartphone menjadi metode scan utama.
8. Scanner USB/Bluetooth dan input manual menjadi fallback.
9. Aplikasi menggunakan web responsif/PWA, bukan native mobile.
10. Sistem wajib online saat konfirmasi penyerahan.
11. Operator menggunakan user, role, dan permission existing Laravel.
12. Pickup harus menggunakan conditional update atomik untuk mencegah duplikasi.

## 26. Kriteria Evaluasi Ulang Migration

Keputusan tanpa migration harus dievaluasi ulang jika salah satu kondisi berikut terjadi:

- Laravel mengizinkan lebih dari satu participant per order.
- Race pack perlu dicatat per participant atau per item.
- Dibutuhkan audit permanen setiap scan berhasil dan gagal.
- Dibutuhkan laporan per station atau perangkat.
- Dibutuhkan idempotency persisten.
- Dibutuhkan pembatalan pickup dengan histori.
- Dibutuhkan mode offline dan rekonsiliasi.
- Service digunakan kembali untuk event lain dengan aturan berbeda.

Jika salah satu kebutuhan tersebut muncul, kandidat pertama adalah tabel pickup atau scanner event terpisah dengan unique constraint sesuai unit pengambilan.

## 27. Open Questions Non-Blocking

Pertanyaan berikut dapat diputuskan saat technical design tanpa mengubah scope utama:

1. Apakah role scanner khusus akan ditambahkan setelah MVP yang mengizinkan `admin` dan `super_admin`?
2. Berapa idle dan absolute timeout session operator?
3. Apakah operator sebelumnya boleh ditampilkan saat duplicate scan?
4. Berapa lama retention structured log production?
5. Domain HTTPS apa yang digunakan untuk scanner?
6. Apakah deployment menggunakan satu instance Go atau beberapa replica?
7. Apakah PWA harus memiliki mode fullscreen wajib saat acara?
8. Apakah icon final event akan menggantikan icon placeholder PWA sebelum production?
