# Spesifikasi Teknis QR Code Runner Scanner

## 1. Tujuan

Dokumen ini mendefinisikan kontrak data dan aturan pembacaan QR Code untuk dua sumber peserta:

| Tipe target | Sumber data utama | Nilai `type` |
|---|---|---|
| Pendaftar online | `orders` dan `participants` | `order` |
| Peserta VIP/eksternal | `external_participants` | `external_participant` |

Spesifikasi ini bersifat netral terhadap bahasa pemrograman. Implementasi scanner dapat dibuat sebagai service terpisah selama format URL, aturan parser, transaksi database, dan payload keluarannya tetap kompatibel.

## 2. Prinsip Identifikasi

- Semua ID target dan ID log menggunakan ULID 26 karakter.
- ULID menggunakan alfabet Crockford Base32: `0-9`, `A-H`, `J-N`, dan `P-Z`.
- Karakter `I`, `L`, `O`, dan `U` tidak valid.
- Input boleh menggunakan huruf kecil, tetapi hasil parser harus dinormalisasi ke huruf besar.
- Regex ULID yang digunakan:

```regex
^[0-9A-HJ-NP-Za-hj-np-z]{26}$
```

- ID order dan ID peserta eksternal berasal dari tabel berbeda. Karena itu, ULID mentah tidak dapat membedakan keduanya.
- Untuk kompatibilitas saat ini, ULID mentah selalu diperlakukan sebagai `order`.
- Peserta eksternal harus menggunakan URL QR lengkap atau token berawalan `external:`.

## 3. Payload QR Code

QR Code menyimpan teks URL tiket, bukan gambar, BIB, atau JSON.

### 3.1 Format kanonik

```text
https://{host}/ticket/{ORDER_ULID}/ticket.pdf
https://{host}/external-participants/{EXTERNAL_PARTICIPANT_ULID}/ticket.pdf
```

Contoh:

```text
https://event.example.com/ticket/01ARZ3NDEKTSV4RRFFQ69G5FAV/ticket.pdf
https://event.example.com/external-participants/01BX5ZZKBKACTAV9WEVGEMMVRZ/ticket.pdf
```

QR baru harus selalu memakai format kanonik. Format lain pada bagian berikut hanya dipertahankan untuk kompatibilitas data lama.

### 3.2 Format yang diterima parser

| Input | Hasil |
|---|---|
| `/ticket/{ULID}/ticket.pdf` | `order` |
| `/ticket/{ULID}` | `order`, format lama |
| `/ticket/{ULID}/{INDEX}/ticket.pdf` | `order`, format lama |
| `/external-participants/{ULID}/ticket.pdf` | `external_participant` |
| `{ULID}` | `order`, fallback lama |
| `external:{ULID}` | `external_participant`, fallback non-URL |

Ketentuan tambahan:

- Full URL dan path relatif sama-sama dapat diproses.
- Query string diabaikan. Contoh `?download=true` tetap valid.
- Trailing slash setelah path yang valid diterima.
- Path harus cocok secara penuh. Tambahan segmen seperti `/ticket.pdf/extra` harus ditolak.
- Teks yang hanya memuat URL sebagai sebagian kalimat harus ditolak.
- Parser saat ini menentukan target dari path dan tidak memvalidasi host atau skema URL.

Untuk service yang diekspos ke jaringan publik, host sebaiknya dibatasi melalui konfigurasi allowlist tanpa mengubah aturan path di atas.

## 4. Kontrak URL Parser

### 4.1 Output

Parser harus mengembalikan salah satu hasil berikut:

```json
{
  "type": "order",
  "id": "01ARZ3NDEKTSV4RRFFQ69G5FAV"
}
```

```json
{
  "type": "external_participant",
  "id": "01BX5ZZKBKACTAV9WEVGEMMVRZ"
}
```

Input yang tidak valid menghasilkan `null` atau error domain setara `INVALID_QR_FORMAT`.

### 4.2 Urutan parsing

Urutan pemeriksaan wajib dipertahankan:

1. Hapus whitespace di awal dan akhir input.
2. Tolak input kosong.
3. Cocokkan token `external:{ULID}`.
4. Cocokkan ULID mentah dan tetapkan sebagai `order`.
5. Parse input sebagai URL atau path, lalu ambil komponen path saja.
6. Cocokkan path peserta eksternal.
7. Cocokkan path order.
8. Jika tidak ada yang cocok, tolak input.

Pseudocode:

```text
function parseScanTarget(rawInput): Target | null
    input = trim(rawInput)

    if input is empty
        return null

    if input matches /^external:(ULID)$/i
        return { type: "external_participant", id: uppercase(capture(1)) }

    if input matches /^(ULID)$/i
        return { type: "order", id: uppercase(capture(1)) }

    path = parseUrlAndGetPath(input)
    if path is not a string
        return null

    if path matches /^\/external-participants\/(ULID)\/ticket\.pdf\/?$/i
        return { type: "external_participant", id: uppercase(capture(1)) }

    if path matches /^\/ticket\/(ULID)(\/ticket\.pdf|\/[0-9]+\/ticket\.pdf)?\/?$/i
        return { type: "order", id: uppercase(capture(1)) }

    return null
```

`ULID` pada pseudocode berarti pola tanpa anchor:

```regex
[0-9A-HJ-NP-Za-hj-np-z]{26}
```

### 4.3 Test vectors

| Input | `type` | `id` / hasil |
|---|---|---|
| `https://event.test/ticket/01ARZ3NDEKTSV4RRFFQ69G5FAV/ticket.pdf?download=true` | `order` | `01ARZ3NDEKTSV4RRFFQ69G5FAV` |
| `https://event.test/ticket/01ARZ3NDEKTSV4RRFFQ69G5FAV` | `order` | `01ARZ3NDEKTSV4RRFFQ69G5FAV` |
| `https://event.test/ticket/01ARZ3NDEKTSV4RRFFQ69G5FAV/2/ticket.pdf` | `order` | `01ARZ3NDEKTSV4RRFFQ69G5FAV` |
| `01arz3ndektsv4rrffq69g5fav` | `order` | `01ARZ3NDEKTSV4RRFFQ69G5FAV` |
| `https://event.test/external-participants/01BX5ZZKBKACTAV9WEVGEMMVRZ/ticket.pdf` | `external_participant` | `01BX5ZZKBKACTAV9WEVGEMMVRZ` |
| `external:01bx5zzkbkactav9wevgemmvrz` | `external_participant` | `01BX5ZZKBKACTAV9WEVGEMMVRZ` |
| `external:not-a-ulid` | - | ditolak |
| `/external-participants/01BX5ZZKBKACTAV9WEVGEMMVRZ` | - | ditolak |
| `/ticket/01ARZ3NDEKTSV4RRFFQ69G5FAV/ticket.pdf/extra` | - | ditolak |
| `scan /ticket/01ARZ3NDEKTSV4RRFFQ69G5FAV/ticket.pdf now` | - | ditolak |

## 5. Urutan Migrasi Database

Target database saat ini adalah PostgreSQL. Objek harus tersedia dalam urutan berikut:

1. `users`, `tickets`, `orders`, dan `participants` sudah tersedia.
2. Tambahkan kolom pickup race pack ke `orders`.
3. Buat `external_participants`.
4. Buat `race_pack_scan_logs` setelah `external_participants`.
5. Tambahkan constraint `race_pack_scan_logs_exactly_one_target`.

Service scanner tidak boleh membuat asumsi bahwa ULID dibuat otomatis oleh database. ID ULID harus dibuat oleh service sebelum `INSERT`.

## 6. DDL PostgreSQL

DDL berikut menunjukkan kontrak kolom yang dibutuhkan scanner. Nama constraint dan index boleh disesuaikan, kecuali constraint satu-target harus tetap dipertahankan secara fungsional.

### 6.1 Kolom pickup pada order

```sql
ALTER TABLE orders
    ADD COLUMN race_pack_picked_up_at TIMESTAMP NULL,
    ADD COLUMN race_pack_picked_up_by CHAR(26) NULL;

ALTER TABLE orders
    ADD CONSTRAINT orders_race_pack_picked_up_by_foreign
    FOREIGN KEY (race_pack_picked_up_by)
    REFERENCES users(id)
    ON DELETE SET NULL;
```

Kolom minimum order yang dibaca scanner:

| Kolom | Kegunaan |
|---|---|
| `id CHAR(26)` | Target hasil parser |
| `status VARCHAR(50)` | Order hanya valid jika berstatus `paid` |
| `ticket_id CHAR(26)` | Kategori peserta |
| `race_pack_picked_up_at TIMESTAMP NULL` | Penanda sudah mengambil race pack |
| `race_pack_picked_up_by CHAR(26) NULL` | Petugas pertama yang menyerahkan |
| `deleted_at TIMESTAMP NULL` | Record soft-deleted tidak boleh diproses |

Data display order dibaca dari `participants` berdasarkan `participants.order_id`. Mode display hanya menerima order dengan tepat satu participant.

### 6.2 Tabel peserta eksternal

```sql
CREATE TABLE external_participants (
    id CHAR(26) PRIMARY KEY,
    category_ticket_id CHAR(26) NOT NULL,
    name VARCHAR(255) NOT NULL,
    bib_name VARCHAR(255) NULL,
    bib_number VARCHAR(255) NOT NULL,
    bib_number_normalized VARCHAR(255) NOT NULL,
    race_pack_picked_up_at TIMESTAMP NULL,
    race_pack_picked_up_by CHAR(26) NULL,
    import_file_name VARCHAR(255) NULL,
    import_file_hash CHAR(64) NULL,
    import_row_number INTEGER NULL CHECK (import_row_number >= 0),
    imported_by CHAR(26) NULL,
    imported_at TIMESTAMP NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL,

    CONSTRAINT external_participants_category_ticket_foreign
        FOREIGN KEY (category_ticket_id)
        REFERENCES tickets(id)
        ON DELETE RESTRICT,

    CONSTRAINT external_participants_picked_up_by_foreign
        FOREIGN KEY (race_pack_picked_up_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT external_participants_imported_by_foreign
        FOREIGN KEY (imported_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT external_participants_category_bib_unique
        UNIQUE (category_ticket_id, bib_number_normalized)
);

CREATE INDEX external_participants_bib_normalized_idx
    ON external_participants (bib_number_normalized);
CREATE INDEX external_participants_picked_up_at_idx
    ON external_participants (race_pack_picked_up_at);
CREATE INDEX external_participants_picked_up_by_idx
    ON external_participants (race_pack_picked_up_by);
CREATE INDEX external_participants_imported_at_idx
    ON external_participants (imported_at);
CREATE INDEX external_participants_import_file_hash_idx
    ON external_participants (import_file_hash);
```

`bib_number_normalized` diisi dengan `uppercase(trim(bib_number))` dan unik dalam satu `category_ticket_id`.

### 6.3 Tabel log scanner

```sql
CREATE TABLE race_pack_scan_logs (
    id CHAR(26) PRIMARY KEY,
    order_id CHAR(26) NULL,
    external_participant_id CHAR(26) NULL,
    scanned_by CHAR(26) NULL,
    result VARCHAR(32) NOT NULL,
    station INTEGER NOT NULL CHECK (station >= 0),
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,

    CONSTRAINT race_pack_scan_logs_order_foreign
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    CONSTRAINT race_pack_scan_logs_external_participant_foreign
        FOREIGN KEY (external_participant_id)
        REFERENCES external_participants(id)
        ON DELETE CASCADE,

    CONSTRAINT race_pack_scan_logs_scanned_by_foreign
        FOREIGN KEY (scanned_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT race_pack_scan_logs_exactly_one_target
        CHECK (
            (order_id IS NOT NULL AND external_participant_id IS NULL)
            OR
            (order_id IS NULL AND external_participant_id IS NOT NULL)
        )
);

CREATE INDEX race_pack_scan_logs_order_idx
    ON race_pack_scan_logs (order_id);
CREATE INDEX race_pack_scan_logs_external_participant_idx
    ON race_pack_scan_logs (external_participant_id);
CREATE INDEX race_pack_scan_logs_created_at_idx
    ON race_pack_scan_logs (created_at);
CREATE INDEX race_pack_scan_logs_result_created_at_idx
    ON race_pack_scan_logs (result, created_at);
CREATE INDEX race_pack_scan_logs_station_created_at_idx
    ON race_pack_scan_logs (station, created_at);
CREATE INDEX race_pack_scan_logs_scanned_by_created_at_idx
    ON race_pack_scan_logs (scanned_by, created_at);
```

Nilai `result` yang valid:

| Nilai | Arti |
|---|---|
| `handed_over` | Race pack berhasil diserahkan |
| `duplicate_rejected` | Scan ditolak karena race pack sudah pernah diserahkan |
| `cancelled` | Petugas membatalkan proses penyerahan |

Disarankan menambahkan `CHECK` atau enum database untuk membatasi `result` ke tiga nilai tersebut.

## 7. Lookup Setelah Parsing

### 7.1 Target order

1. Cari `orders.id = target.id` dan abaikan record dengan `deleted_at` terisi.
2. Tolak jika order tidak ditemukan.
3. Tolak jika `status != 'paid'`.
4. Ambil participant melalui `participants.order_id = orders.id`.
5. Untuk runner display, jumlah participant harus tepat satu.
6. Nama kategori menggunakan tiket induk jika tersedia; jika tidak, gunakan nama tiket order.

### 7.2 Target peserta eksternal

1. Cari `external_participants.id = target.id` dan abaikan record dengan `deleted_at` terisi.
2. Tolak jika participant tidak ditemukan.
3. Ambil kategori dari `tickets.id = external_participants.category_ticket_id`.
4. Nama display adalah `bib_name` jika tidak kosong; jika kosong, gunakan `name`.

## 8. Transaksi Penyerahan Race Pack

Konfirmasi pickup harus atomik agar dua station yang memindai target sama pada waktu bersamaan tidak sama-sama berhasil.

```text
begin transaction

target = select order/external_participant
         where id = targetId
         for update

if target.race_pack_picked_up_at is not null
    insert scan log with result = "duplicate_rejected"
    commit
    return duplicate

update target
set race_pack_picked_up_at = current timestamp,
    race_pack_picked_up_by = actor ULID

insert scan log with result = "handed_over"

commit
return success
```

Aturan pengisian target log:

| Target | `order_id` | `external_participant_id` |
|---|---|---|
| Order | ULID order | `NULL` |
| Peserta eksternal | `NULL` | ULID peserta eksternal |

Pembatalan hanya membuat log `cancelled`; pembatalan tidak mengisi kolom pickup pada target.

## 9. Payload Scanner ke Runner Display

Jika scanner dan display dipisahkan menjadi service berbeda, payload target yang dipublikasikan menggunakan kontrak berikut:

```json
{
  "v": 3,
  "scan_id": "01BX6A2M6JZ3J7M2V3DF4K5N8Q",
  "type": "external_participant",
  "id": "01BX5ZZKBKACTAV9WEVGEMMVRZ"
}
```

| Field | Aturan |
|---|---|
| `v` | Versi payload, saat ini `3` |
| `scan_id` | ULID baru untuk setiap aktivitas scan, termasuk target yang sama |
| `type` | `order` atau `external_participant` |
| `id` | ULID target hasil parser |

Payload disimpan per station dengan key logis:

```text
runner-display:current:{station}
```

TTL payload adalah 120 detik. `scan_id` wajib berbeda pada setiap scan agar pemindaian target yang sama tetap memicu pembaruan display.

## 10. Checklist Implementasi Service

- Gunakan parser URL standar, bukan pemotongan string berdasarkan posisi.
- Terapkan regex path dengan anchor awal dan akhir.
- Normalisasi ULID ke uppercase sebelum lookup atau publish.
- Pertahankan fallback ULID mentah sebagai `order` untuk kompatibilitas.
- Gunakan URL lengkap atau token `external:` untuk peserta eksternal.
- Abaikan query string, tetapi jangan menerima segmen path tambahan.
- Abaikan record soft-deleted.
- Validasi order berstatus `paid`.
- Gunakan transaksi dan row lock saat konfirmasi pickup.
- Buat satu log untuk setiap hasil pickup, duplikat, atau pembatalan.
- Pastikan constraint tepat satu target aktif di database.
- Buat `scan_id` baru pada setiap publish ke runner display.
