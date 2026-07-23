# Schema Contract

Dokumen ini mengunci kontrak minimum antara Go scanner dan database PostgreSQL existing Laravel Fenturun 2026. Scanner tidak membuat migration dan tidak mengelola data selain status pickup pada tabel `orders`.

## Sumber Kontrak

- `../fenturun2026/database/migrations/0001_01_01_000000_create_users_table.php`
- `../fenturun2026/database/migrations/2024_03_19_101507_create_permission_tables.php`
- `../fenturun2026/database/migrations/2024_07_25_095858_create_tickets_table.php`
- `../fenturun2026/database/migrations/2024_07_26_143231_create_orders_table.php`
- `../fenturun2026/database/migrations/2025_08_09_113452_create_participants_table.php`
- `../fenturun2026/database/migrations/2026_02_24_045449_add_parent_id_and_tier_fields_to_tickets_table.php`
- `../fenturun2026/database/migrations/2026_02_28_182110_add_race_pack_fields_to_orders_table.php`
- `../fenturun2026/app/Models/User.php`
- `../fenturun2026/app/Models/Order.php`
- `../fenturun2026/routes/web.php`

## Identifier dan QR

- `users.id`, `orders.id`, `participants.id`, `tickets.id`, `roles.id`, dan `permissions.id` adalah ULID.
- Payload QR existing dibuat dari `Order::ticketUrl()` dan berbentuk URL absolut ke `/ticket/{order-ulid}/ticket.pdf`.
- Scanner juga mendukung relative path `/ticket/{order-ulid}`, `/ticket/{order-ulid}/ticket.pdf`, dan raw ULID.
- Scanner menormalisasi ULID ke uppercase dan tidak membuka URL dari QR.

## Tabel `users`

Kolom yang digunakan scanner:

| Kolom | Tipe konseptual | Nullable | Tujuan |
|---|---|---:|---|
| `id` | ULID / char(26) | Tidak | Session operator dan FK pickup |
| `name` | string | Ya | Nama operator untuk session UI bila dibutuhkan |
| `username` | string | Ya | Login identity exact match |
| `email` | string | Tidak | Login identity case-insensitive |
| `password` | string | Tidak | Verifikasi bcrypt Laravel |

Catatan:

- Login admin Laravel existing memakai `username`, tetapi scanner mengikuti PRD dengan mendukung `username` atau `email`.
- Password Laravel diverifikasi dengan bcrypt. Password dan hash tidak dicatat ke log.

## Tabel Role dan Permission Spatie

Tabel yang digunakan:

- `roles(id, name, guard_name)`
- `permissions(id, name, guard_name)`
- `model_has_roles(role_id, model_type, model_id)`
- `model_has_permissions(permission_id, model_type, model_id)`
- `role_has_permissions(permission_id, role_id)`

Kontrak otorisasi:

- `guard_name = 'web'`.
- `model_type = 'App\\Models\\User'`.
- Default role yang diizinkan: `admin`, `super_admin`.
- Permission scanner opsional dapat diberikan langsung atau melalui role.
- `customer` tidak diizinkan kecuali secara eksplisit memiliki permission scanner yang dikonfigurasi.

## Tabel `orders`

Kolom yang digunakan scanner:

| Kolom | Tipe konseptual | Nullable | Tujuan |
|---|---|---:|---|
| `id` | ULID / char(26) | Tidak | Identifier dari QR |
| `ticket_id` | ULID / char(26) | Ya | Relasi kategori tiket |
| `number` | string | Ya | Nomor order untuk UI |
| `status` | string | Ya | Validasi `paid` |
| `deleted_at` | timestamp | Ya | Soft delete fail closed |
| `race_pack_picked_up_at` | timestamp | Ya | Status dan waktu pickup |
| `race_pack_picked_up_by` | char(26) | Ya | ULID operator pickup |
| `updated_at` | timestamp | Ya | Diperbarui saat pickup |

Kolom yang boleh ditulis scanner:

- `race_pack_picked_up_at`
- `race_pack_picked_up_by`
- `updated_at`

Aturan mutasi:

- Pickup hanya sukses melalui `UPDATE ... WHERE status = 'paid' AND deleted_at IS NULL AND race_pack_picked_up_at IS NULL ... RETURNING`.
- Waktu pickup berasal dari PostgreSQL `CURRENT_TIMESTAMP`.
- Operator berasal dari session, bukan request body.

Aturan read-only daftar pickup:

- `GET /api/race-pack-pickups` hanya membaca order non-deleted dengan `race_pack_picked_up_at IS NOT NULL`.
- Daftar pickup menampilkan status akhir database, bukan audit scan dan bukan data station.
- Cursor pagination memakai urutan `race_pack_picked_up_at DESC, orders.id DESC`.
- Operator ditampilkan dari `users.name` melalui `race_pack_picked_up_by`; ULID operator tidak perlu ditampilkan pada UI.

## Tabel `participants`

Kolom yang digunakan scanner:

| Kolom | Tipe konseptual | Nullable | Tujuan |
|---|---|---:|---|
| `id` | ULID / char(26) | Tidak | Identitas internal participant |
| `order_id` | ULID / char(26) | Tidak | Relasi ke order |
| `name` | string | Ya | UI verifikasi |
| `bib_name` | string | Ya | UI verifikasi |
| `bib_number` | string | Ya | UI verifikasi |
| `ukuran_jersey` | string | Ya | UI verifikasi |

Kolom yang tidak boleh diambil untuk UI/API/log pada MVP:

- `identity`
- `identity_file`
- `nik`
- `phone`
- `email`
- `tanggal_lahir`
- `name_emergency`
- `phone_emergency`
- file identitas atau data pembayaran apa pun

Scanner wajib menghitung jumlah participant per order pada setiap validasi dan pickup:

| Jumlah participant | Outcome |
|---:|---|
| 0 | `participant_missing` |
| 1 | lanjut validasi |
| >1 | `multiple_participants` |

## Tabel `tickets`

Kolom yang digunakan scanner:

| Kolom | Tipe konseptual | Nullable | Tujuan |
|---|---|---:|---|
| `id` | ULID / char(26) | Tidak | Relasi dari order |
| `parent_id` | ULID / char(26) | Ya | Kategori parent |
| `name` | string | Ya | Kategori ticket |

Kategori yang ditampilkan adalah `COALESCE(parent_ticket.name, ticket.name)`.

Catatan koreksi terhadap PRD: schema Laravel aktual tidak memiliki `tickets.ukuran_jersey`; ukuran jersey berasal dari `participants.ukuran_jersey`. Grant SELECT untuk `tickets` cukup mencakup `id`, `parent_id`, dan `name`.

## Outcome API

Outcome minimum:

| Outcome | HTTP | Makna |
|---|---:|---|
| `valid` | 200 | Order memenuhi syarat dan menunggu konfirmasi |
| `picked_up` | 200 | Pickup berhasil berdasarkan row database returned |
| `invalid_payload` | 422 | QR/input tidak valid |
| `not_found` | 404 | Order tidak ditemukan atau soft-deleted |
| `not_paid` | 409 | Order bukan `paid` |
| `participant_missing` | 409 | Order tidak memiliki participant |
| `multiple_participants` | 409 | Order memiliki lebih dari satu participant |
| `already_picked_up` | 409 | Race pack sudah pernah diambil |
| `unauthenticated` | 401 | Session tidak valid |
| `forbidden` | 403 | User tidak berwenang |
| `database_unavailable` | 503 | Database/timeout/pool unavailable |
| `internal_error` | 500 | Error tak terduga |

Response envelope:

```json
{
  "outcome": "valid",
  "message": "Tiket valid",
  "request_id": "...",
  "data": {}
}
```

## Query Pickup Konseptual

```sql
UPDATE orders AS o
SET
    race_pack_picked_up_at = CURRENT_TIMESTAMP,
    race_pack_picked_up_by = $1,
    updated_at = CURRENT_TIMESTAMP
WHERE o.id = $2
  AND o.status = 'paid'
  AND o.deleted_at IS NULL
  AND o.race_pack_picked_up_at IS NULL
  AND (
      SELECT COUNT(*)
      FROM participants AS p
      WHERE p.order_id = o.id
  ) = 1
RETURNING
    o.id,
    o.race_pack_picked_up_at,
    o.race_pack_picked_up_by;
```

Jika query tidak mengembalikan row, service melakukan diagnostic lookup read-only untuk menentukan outcome aktual. Nol row tidak pernah dianggap sukses.

## Checklist Konfirmasi Staging

Sebelum production, jalankan pemeriksaan read-only pada staging/production snapshot:

- Tidak ada collision identity login ambigu antara `username` dan `email`.
- Role `admin` dan `super_admin` menggunakan guard `web`.
- `model_type` pivot user adalah `App\\Models\\User`.
- Distribusi participant per order diketahui dan anomali dapat dipantau.
- `participants.order_id` memiliki index yang memadai dari FK.
- Kategori ticket parent/child terisi sesuai kebutuhan UI.
- PostgreSQL timezone dan tipe timestamp pickup terdokumentasi.
- Credential `scanner_service` hanya memiliki grant minimum yang disetujui.
