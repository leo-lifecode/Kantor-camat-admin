# Sistem Antrian Digital Kantor Camat Talawi

Proyek skripsi **Rancang Bangun Sistem Antrian Digital Berbasis Mobile dengan Notifikasi Real-Time pada Kantor Camat Talawi Menggunakan Algoritma First Come First Serve (FCFS)**.

Repository ini berisi dua aplikasi:
- **Web admin**: Next.js, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/Realtime.
- **Aplikasi warga**: Expo + React Native, Supabase Auth/PostgreSQL/Realtime, text-to-speech dan notifikasi lokal ketika nomor dipanggil.

## Fitur web admin

- Ringkasan dashboard dengan statistik **hari ini** (menurut WIB) dan kontrol loket tunggal.
- Daftar antrian, pencarian, filter status/tanggal (bawaan: hari ini; kosongkan tanggal untuk melihat semua hari), dan detail timeline dengan durasi tunggu/layanan yang dihitung database.
- Transisi status FCFS: panggil, mulai dilayani, selesai, atau lewati.
- Antrian `WAITING`/`CALLED` dari hari sebelumnya dilewati otomatis (lihat [Siklus harian antrian](#siklus-harian-antrian)).
- Mode Supabase jika environment tersedia, termasuk langganan Realtime untuk perubahan tabel antrian.
- Halaman layanan dan pengumuman mendukung Supabase; direktori pengguna membaca profil Supabase. Laporan CSV dan analitik FCFS membaca data antrian Supabase; profil mendukung pembaruan data profil dan email Auth.

## Menjalankan web admin

1. Install Node.js LTS.
2. Dari root repository:
   ```bash
   npm install
   cp .env.example .env.local
   ```
3. Isi environment:
   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```
4. Jalankan SQL di Supabase SQL Editor sesuai [Urutan SQL](#urutan-sql).
5. Jalankan `npm run dev`, lalu buka `http://localhost:3000`.

Tanpa environment Supabase, halaman antrian memakai **data demo di memori browser**: perubahan status tidak disimpan ke database dan hilang saat halaman dimuat ulang. Mode demo tetap menegakkan aturan FCFS dan loket tunggal yang sama. Jangan menaruh `service_role` key di frontend.

## Menjalankan aplikasi warga

1. Masuk ke folder `mobile-warga`.
2. Salin `.env.example` menjadi `.env`, lalu isi `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Jalankan:
   ```bash
   npm install
   npx expo start
   ```
4. Scan QR menggunakan Expo Go atau jalankan emulator Android.

Fitur aplikasi warga: registrasi/login, memilih layanan dan mengambil satu nomor antrian aktif, melihat status antrian, membatalkan antrian yang masih menunggu, pengumuman aktif, pembaruan melalui Realtime, notifikasi lokal dan pembacaan suara saat dipanggil.

**Push notification ketika aplikasi tertutup belum siap produksi.** Konfigurasi kredensial FCM/Expo Push dan pendaftaran token perangkat masih perlu dilakukan. Belum ada APK yang dibangun dari lingkungan ini.

## Urutan SQL

Jalankan berkas berikut di Supabase SQL Editor, satu per satu dan berurutan. Pada database yang sudah berjalan, jalankan hanya berkas yang belum pernah dijalankan (kolom terakhir).

| # | Berkas | Fungsi | Jika database sudah memakai berkas 1-5 |
| --- | --- | --- | --- |
| 1 | `supabase/schema.sql` | Tabel, RLS, dan fungsi dasar | sudah |
| 2 | `supabase/queue_actions.sql` | RPC mulai, selesai, dan lewati antrian | sudah |
| 3 | `supabase/security_hardening.sql` | Satu antrian aktif per warga, `create_queue`, `call_next_queue` (FCFS, loket tunggal), profil WARGA otomatis, Realtime | sudah |
| 4 | `supabase/cancel_queue.sql` | Status `CANCELLED` dan pembatalan antrian sendiri (untuk database lama; aman dijalankan pada database baru) | sudah |
| 5 | `supabase/revoke_anon_rpc.sql` | Mencabut akses pengguna belum login (`anon`) ke RPC antrian | sudah |
| 6 | `supabase/queue_lifecycle_hardening.sql` | Kedaluwarsa harian antrian lama; klien tidak lagi bisa menulis langsung ke tabel `queues` | **jalankan** |
| 7 | `supabase/performance_tuning.sql` | Indeks foreign key dan penyederhanaan RLS sesuai advisor performa Supabase | **jalankan** |
| - | `supabase/queue_integrity.sql` | Pemeriksa **baca-saja** (opsional): menampilkan tabel OK/BELUM/PERLU DIPERBAIKI untuk data dan penerapan SQL | kapan saja |

Berkas 6 dan 7 aman dijalankan berulang kali dan masing-masing berjalan dalam satu transaksi (gagal berarti tidak ada yang berubah). Jalankan keduanya **sebelum** memakai versi terbaru web admin dan aplikasi warga. Detail dan cara membatalkan ada pada komentar di awal masing-masing berkas.

## Aturan FCFS dan satu loket

Urutan ditentukan dari `arrival_time ASC, id ASC`, bukan dari nomor semata. Operasi pemanggilan, mulai, selesai, dan lewati diproses melalui RPC database dengan pemeriksaan role ADMIN serta penguncian untuk loket tunggal. Warga hanya dapat memiliki satu antrian aktif. Nomor antrian berbentuk `A-0001` dan berlanjut lintas hari (tidak di-reset).

Klien (web maupun aplikasi warga) tidak memiliki hak `INSERT`/`UPDATE`/`DELETE` langsung pada tabel `queues`; semua perubahan wajib melalui RPC sehingga aturan di atas tidak bisa dilewati. RLS membatasi pembacaan: warga hanya melihat antrian miliknya, admin melihat semuanya.

## Siklus harian antrian

"Hari" dihitung menurut **WIB (Asia/Jakarta)**. Antrian `WAITING`/`CALLED` yang dibuat sebelum 00.00 WIB hari ini otomatis menjadi `SKIPPED`, tanpa notifikasi ke warga. Pelewatan ini dijalankan:

- saat admin membuka dashboard (dan lagi bila hari berganti selagi dashboard terbuka), melalui `expire_stale_queues()`;
- saat petugas memanggil antrian berikutnya (`call_next_queue()`), sehingga tiket kemarin tidak pernah mendahului tiket hari ini;
- saat warga mengambil nomor baru (`create_queue()`), hanya untuk tiket miliknya sendiri, sehingga warga yang mengambil nomor pagi-pagi dari rumah tidak terblokir tiket kemarin. Aplikasi warga juga tidak lagi menampilkan tiket `WAITING`/`CALLED` hari lalu sebagai antrian aktif.

Pengecualian: antrian `SERVING` dari hari lalu **tidak** dilewati otomatis karena sudah sempat dilayani dan hasilnya harus diputuskan petugas. Antrian itu memblokir loket sampai petugas menekan **Selesaikan** di dashboard.

Jika kantor berada di WITA/WIT, ubah zona waktu di semua tempat berikut secara bersamaan: `'Asia/Jakarta'` pada fungsi `expire_stale_queues()` dan `create_queue()` di `supabase/queue_lifecycle_hardening.sql` serta pada `supabase/queue_integrity.sql`, `OFFICE_TIME_ZONE` di `src/lib/queue-time.ts`, dan `OFFICE_UTC_OFFSET_HOURS` di `mobile-warga/src/lib/queue-day.ts`.

## Struktur halaman web

| Route | Fungsi |
| --- | --- |
| `/login` | Login administrator |
| `/dashboard` | Ringkasan hari ini dan kontrol loket |
| `/antrian` | Daftar, filter, dan panggil antrian |
| `/antrian/[id]` | Detail dan transisi status |
| `/layanan` | Kelola layanan (Supabase/demo) |
| `/pengumuman` | Kelola pengumuman (Supabase/demo) |
| `/pengguna` | Daftar profil (Supabase/demo) |
| `/laporan` | Rekap dan ekspor CSV (Supabase/demo) |
| `/analitik-fcfs` | Formula dan analitik timestamp (Supabase/demo) |
| `/profil` | Profil admin (Supabase/demo) |

## Validasi otomatis

GitHub Actions menjalankan pemeriksaan TypeScript, ESLint, dan production build untuk aplikasi web (`CI`), serta pemeriksaan TypeScript untuk aplikasi Expo di `mobile-warga/` (`Mobile CI`). Aplikasi Expo tetap perlu diuji pada emulator/perangkat Android.

## Status integrasi

Bagian antrian web memiliki jalur Supabase query/RPC/Realtime; layanan dan pengumuman mendukung baca/tulis; direktori pengguna membaca profil; laporan dan analitik menghitung data antrian dari Supabase; profil mendukung update Supabase Auth/profiles.

Berkas SQL dijalankan manual oleh pemilik project melalui SQL Editor. Setelah menjalankan SQL, jalankan `supabase/queue_integrity.sql` untuk memastikan semua baris `OK`, lalu verifikasi akun ADMIN, Realtime, dan kredensial push sebelum dipakai di kantor. Lihat `SETUP_SUPABASE.md` untuk langkah rinci, termasuk pengaturan Auth yang hanya bisa diubah dari dashboard Supabase.
