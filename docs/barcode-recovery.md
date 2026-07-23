# BarcodeDetector dan Recovery QR Rusak Ringan

Dokumen ini menjelaskan rancangan peningkatan scanner kamera agar dapat membaca QR
yang mengalami kerusakan ringan, blur, pencahayaan buruk, kontras rendah, atau
sebagian kecil tertutup.

Fitur ini hanya memperbaiki proses pembacaan gambar di browser. Validasi tiket,
otorisasi operator, dan pencatatan pickup tetap dilakukan oleh service Go dan
PostgreSQL.

## Status Implementasi

Implementasi kamera saat ini berada di `web/src/main.ts` dan menggunakan
`BrowserQRCodeReader` dari `@zxing/browser`.

Alur aktual:

```text
Video kamera
    |
    v
BrowserQRCodeReader (ZXing)
    |
    v
Payload QR
    |
    v
POST /api/scans/validate
```

Native `BarcodeDetector` belum digunakan. Preprocessing gambar dan mode recovery
juga belum tersedia. Dengan demikian, isi dokumen ini adalah rancangan target,
bukan deskripsi fitur yang sudah selesai.

## Tujuan

- Menggunakan native `BarcodeDetector` sebagai jalur cepat jika tersedia.
- Mempertahankan ZXing sebagai fallback lintas browser.
- Meningkatkan kemungkinan pembacaan QR yang rusak ringan tanpa mengirim frame
  kamera ke server.
- Menjaga penggunaan CPU, baterai, dan temperatur perangkat pada batas wajar.
- Tidak mengubah kontrak endpoint atau aturan validasi backend.

## Batas Recovery

QR memiliki error correction bawaan. Decoder masih dapat membaca QR selama
finder pattern, quiet zone, dan jumlah modul yang tersisa masih memadai.

Recovery mungkin membantu untuk:

- blur ringan;
- pantulan atau pencahayaan tidak merata;
- kontras rendah;
- hasil cetak sedikit pudar;
- rotasi atau perspektif ringan;
- sebagian kecil modul tertutup atau tergores.

Recovery tidak dijamin berhasil jika:

- satu atau lebih finder pattern rusak berat;
- QR terpotong sehingga area penting hilang;
- kerusakan melampaui kapasitas error correction QR;
- resolusi kamera terlalu rendah;
- motion blur berat;
- quiet zone tidak terlihat dan latar belakang sangat ramai.

Scanner wajib meminta pengguna melakukan scan ulang atau memakai input manual
jika decoder tidak menghasilkan payload yang valid.

## Prinsip Keamanan

Recovery hanya boleh dilakukan pada gambar sebelum decode. Scanner tidak boleh
menebak, mengganti, atau melengkapi karakter payload setelah decode.

Payload tiket mengandung ULID 26 karakter. Mengoreksi ULID berdasarkan kemiripan
karakter dapat menghasilkan identifier order lain. Semua payload hasil decoder
tetap harus:

1. melewati parser frontend sebagai pemeriksaan awal;
2. dikirim utuh ke `POST /api/scans/validate`;
3. melewati `ParseOrderULID` di backend;
4. diverifikasi terhadap order aktual di PostgreSQL.

Tidak ada hasil pickup yang boleh dianggap sukses sebelum backend mengembalikan
outcome `picked_up`.

## Arsitektur Target

```text
getUserMedia
    |
    v
Video kamera belakang
    |
    +--> BarcodeDetector native
    |         |
    |         +--> berhasil --> validasi payload
    |
    +--> ZXing normal
    |         |
    |         +--> berhasil --> validasi payload
    |
    +--> Canvas preprocessing
              |
              +--> ZXing recovery --> validasi payload
```

Urutan decoder:

1. Periksa dukungan `BarcodeDetector` dan format `qr_code`.
2. Jalankan `BarcodeDetector` sebagai decoder utama.
3. Jika tidak didukung atau beberapa frame tidak menghasilkan data, jalankan
   ZXing pada frame normal.
4. Jika tetap gagal, jalankan ZXing pada sejumlah kecil varian preprocessing.
5. Hentikan semua decoder sementara ketika payload sedang divalidasi atau modal
   konfirmasi pickup terbuka.

Satu frame tidak boleh diproses oleh beberapa operasi recovery secara paralel.
Gunakan satu processing lock untuk mencegah penumpukan pekerjaan.

## Konfigurasi Kamera

Gunakan kamera belakang dan minta resolusi ideal yang cukup tinggi:

```ts
const constraints: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
};
```

Resolusi aktual tetap ditentukan oleh browser dan perangkat. Setelah stream
aktif, periksa `MediaTrackCapabilities` sebelum menawarkan:

- torch;
- zoom;
- continuous focus atau focus mode yang didukung.

Control yang tidak didukung tidak boleh ditampilkan atau dipaksakan melalui
`applyConstraints`.

## Native BarcodeDetector

Inisialisasi hanya jika API dan format QR tersedia:

```ts
const formats = await BarcodeDetector.getSupportedFormats();
if (formats.includes('qr_code')) {
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
}
```

Pemanggilan `detect()` perlu dibatasi, misalnya 5-10 kali per detik. Hanya hasil
dengan `rawValue` non-kosong yang diteruskan ke alur validasi.

`BarcodeDetector` adalah API native yang perilakunya bergantung pada browser dan
perangkat. API ini tidak menyediakan kontrol recovery yang konsisten, sehingga
ZXing tetap wajib tersedia sebagai fallback.

## Konfigurasi ZXing

ZXing dibatasi untuk QR agar pencarian format lain tidak membuang waktu.
Konfigurasi recovery yang perlu dievaluasi:

- `POSSIBLE_FORMATS: [BarcodeFormat.QR_CODE]`;
- `TRY_HARDER`;
- `ALSO_INVERTED`.

Mode agresif tidak perlu dijalankan pada setiap frame. Gunakan setelah jalur
native dan decode normal gagal selama interval tertentu.

## Preprocessing Gambar

Recovery menggunakan canvas lokal dengan region of interest di sekitar area
scan. Varian yang dapat dicoba secara berurutan:

1. crop tengah pada resolusi asli;
2. grayscale dan peningkatan kontras;
3. threshold hitam-putih;
4. warna inverted;
5. upscale 1.5 sampai 2 kali untuk QR berukuran kecil.

Jumlah varian harus dibatasi. Contoh target awal:

- decode normal: 5-10 frame per detik;
- recovery: maksimal 2-3 siklus per detik;
- maksimal 2 varian preprocessing per siklus;
- hentikan recovery segera setelah satu decoder berhasil.

Frame, canvas, blob, atau gambar hasil preprocessing tidak boleh dikirim ke
service Go, analytics, log, cache, atau `sessionStorage`.

## Deduplication dan State

Scanner saat ini menggunakan processing lock dan deduplication payload selama
dua detik. Perilaku tersebut harus dipertahankan.

State minimum:

```text
idle
requesting_camera
scanning
recovering
validating
verification_pending
pickup_processing
result
```

Ketika state bukan `scanning` atau `recovering`:

- loop decoder dijeda;
- request decode baru tidak dibuat;
- payload berikutnya diabaikan sampai state aman;
- stream boleh tetap terbuka, kecuali mode kamera dimatikan atau halaman keluar.

## Strategi Implementasi

Perubahan sebaiknya dipisahkan dari `web/src/main.ts`:

```text
web/src/scanner/camera.ts
web/src/scanner/barcode-detector.ts
web/src/scanner/zxing-decoder.ts
web/src/scanner/preprocess.ts
web/src/scanner/types.ts
```

Tahapan pengerjaan:

1. Ekstrak lifecycle kamera dan decoder dari `main.ts`.
2. Tambahkan feature detection dan decoder `BarcodeDetector`.
3. Konfigurasikan ZXing hanya untuk QR dan jadikan fallback.
4. Tambahkan scheduling, processing lock, dan pembatasan frekuensi.
5. Tambahkan preprocessing recovery secara bertahap.
6. Tambahkan torch/zoom hanya berdasarkan capability perangkat.
7. Tambahkan telemetry lokal untuk pengujian tanpa menyimpan payload atau frame.
8. Uji pada perangkat acara melalui HTTPS.

## Pengujian

Siapkan corpus QR non-production yang mencakup:

- QR bersih sebagai baseline;
- blur ringan dan sedang;
- brightness rendah dan berlebih;
- kontras rendah;
- rotated dan perspective distortion;
- noise cetak;
- inverted;
- kerusakan 5%, 10%, dan 15% pada posisi berbeda;
- finder pattern atau quiet zone yang sebagian terganggu;
- QR pada layar dan QR hasil cetak.

Pengujian otomatis perlu memverifikasi:

- native decoder digunakan jika tersedia;
- ZXing digunakan jika native tidak tersedia atau gagal;
- recovery tidak berjalan paralel;
- hasil pertama menghentikan decoder lain;
- payload sama tidak membuat request paralel;
- payload invalid tidak mencapai query order;
- frame tidak pernah dikirim atau disimpan;
- fallback manual tetap tersedia.

Pengujian perangkat minimum:

- Chrome Android melalui HTTPS;
- Safari iOS melalui HTTPS;
- kamera depan dan belakang jika tersedia;
- portrait dan landscape;
- kondisi terang, redup, dan pantulan cahaya;
- perangkat kelas menengah yang akan digunakan saat acara.

## Acceptance Criteria

Fitur dianggap selesai apabila:

- `BarcodeDetector` menjadi jalur utama pada browser yang mendukung `qr_code`;
- ZXing tetap dapat membaca QR pada browser tanpa `BarcodeDetector`;
- corpus QR bersih tidak mengalami penurunan tingkat keberhasilan;
- recovery meningkatkan tingkat baca corpus rusak ringan dibanding baseline;
- UI tetap responsif dan tidak membuat beberapa request validasi paralel;
- kamera dijeda selama validasi dan konfirmasi pickup;
- tidak ada frame atau hasil preprocessing yang meninggalkan browser;
- tidak ada koreksi atau tebakan terhadap karakter payload;
- seluruh hasil tetap divalidasi oleh backend;
- pengujian Chrome Android dan Safari iOS pada perangkat fisik lulus.

## Catatan Operasional

Recovery adalah bantuan, bukan pengganti kualitas QR. Untuk hasil terbaik:

- cetak QR dengan kontras tinggi;
- pertahankan quiet zone;
- hindari laminasi yang memantulkan cahaya;
- jangan melipat pada finder pattern;
- sediakan scanner USB/Bluetooth atau input manual sebagai fallback;
- jangan menyerahkan race pack jika backend belum mengonfirmasi sukses.
