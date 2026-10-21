# Setup Supabase

## 1. Konfigurasi environment

Untuk web admin, salin `.env.example` ke `.env.local` pada root. Untuk aplikasi warga, salin `mobile-warga/.env.example` menjadi `mobile-warga/.env`. Isi URL project dan anon/publishable key dari Supabase Project Settings → API. Jangan commit file environment dan jangan pernah menaruh service-role key di frontend.

## 2. Jalankan SQL

Jalankan melalui Supabase SQL Editor, satu berkas per eksekusi, **berurutan**:

| # | Berkas | Isi |
| --- | --- | --- |
| 1 | `supabase/schema.sql` | Tabel, RLS, dan fungsi dasar |
| 2 | `supabase/queue_actions.sql` | RPC mulai, selesai, dan lewati antrian |
| 3 | `supabase/security_hardening.sql` | Menonaktifkan promosi role sendiri, satu antrian aktif per warga, `create_queue` tervalidasi, profil WARGA otomatis, pemanggilan FCFS terkunci untuk satu loket, tabel masuk publikasi Realtime (jika tersedia) |
| 4 | `supabase/cancel_queue.sql` | Status `CANCELLED` dan `cancel_own_queue` (untuk database lama; aman dijalankan pada database baru) |
| 5 | `supabase/revoke_anon_rpc.sql` | Mencabut akses `anon` (belum login) ke RPC antrian |
| 6 | `supabase/queue_lifecycle_hardening.sql` | Kedaluwarsa harian antrian lama dan penguncian tulis langsung ke `queues` |
| 7 | `supabase/performance_tuning.sql` | 5 indeks foreign key dan penyederhanaan RLS (saran advisor performa) |

- **Database baru**: jalankan 1 sampai 7.
- **Database yang sudah berjalan**: jalankan hanya yang belum pernah dijalankan. Jalankan `supabase/queue_integrity.sql` (lihat bagian 7) untuk melihat baris mana yang masih `BELUM`. Project yang sudah memakai berkas 1-5 tinggal menjalankan 6 dan 7.
- Berkas 6 dan 7 aman dijalankan berulang kali dan berjalan dalam satu transaksi: bila ada yang gagal, tidak ada perubahan yang tersimpan. Cara membatalkan (rollback) tertulis pada komentar di awal berkas 6.
- Jika pembuatan unique index pada berkas 3 gagal, selesaikan dulu duplikasi antrian aktif (baris 1 pada `queue_integrity.sql` menunjukkan jumlahnya).
- Jalankan berkas 6 dan 7 **sebelum** memakai versi terbaru web admin dan aplikasi warga.

### Apa yang berubah pada berkas 6

- `expire_stale_queues()` (khusus ADMIN): antrian `WAITING`/`CALLED` dari hari sebelumnya (sebelum 00.00 WIB) menjadi `SKIPPED`, tanpa notifikasi. Dipanggil web saat dashboard dibuka. `call_next_queue()` dan `create_queue()` kini juga melewati tiket kemarin (yang terakhir hanya untuk tiket milik pemanggil).
- Antrian `SERVING` dari hari lalu tidak dilewati otomatis; petugas harus menekan **Selesaikan** di dashboard, dan selama itu loket terblokir.
- Policy `admin update queues` dihapus dan hak `INSERT`/`UPDATE`/`DELETE` langsung pada `queues` dicabut dari `authenticated`; hak `anon` ke tabel ini dicabut. Semua perubahan antrian lewat RPC.
- Zona waktu `'Asia/Jakarta'` ditulis di `expire_stale_queues()` dan `create_queue()`. Untuk WITA/WIT, ubah juga konstanta di web dan aplikasi warga (lihat README, bagian "Siklus harian antrian").

## 3. Buat akun ADMIN pertama

1. Daftarkan akun terpercaya melalui Supabase Auth atau form registrasi aplikasi.
2. Buka Authentication → Users dan salin UUID akun tersebut.
3. Jalankan SQL berikut:

```sql
insert into public.profiles (id, name, role)
values ('AUTH_USER_UUID', 'Admin Talawi', 'ADMIN')
on conflict (id) do update set role = 'ADMIN';
```

Ganti `AUTH_USER_UUID` dengan UUID yang benar. Hanya akun terpercaya yang boleh dipromosikan menjadi ADMIN.

## 4. Pengaturan Auth yang hanya bisa lewat dashboard

- **Leaked password protection**: menolak password yang diketahui bocor (memakai HaveIBeenPwned). Fitur ini tersedia pada paket Supabase Pro ke atas, diatur di dashboard Supabase pada pengaturan Auth untuk provider Email. Pada paket gratis, peringatan advisor keamanan untuk hal ini dapat diabaikan.
- Peringatan advisor bahwa `current_user_is_admin()` dapat dipanggil lewat REST API sengaja dibiarkan: fungsi ini dipakai oleh kebijakan RLS (termasuk untuk pembacaan layanan dan pengumuman publik), hanya mengembalikan true/false untuk pemanggilnya sendiri, dan mencabut aksesnya membuat pembacaan publik gagal.

## 5. Jalankan web admin

Dari root repository:

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Dengan environment Supabase, middleware memeriksa autentikasi dan role ADMIN, dan semua data berasal dari database (dashboard menampilkan statistik hari ini menurut WIB). Tanpa environment, halaman antrian memakai data demo di memori browser; perubahan tidak disimpan.

## 6. Jalankan aplikasi warga

```bash
cd mobile-warga
npm install
npx expo start
```

Scan QR dengan Expo Go atau jalankan emulator Android. Pastikan variabel `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY` sudah diisi sebelum memulai Metro.

## 7. Verifikasi

Jalankan `supabase/queue_integrity.sql` di SQL Editor. Berkas ini hanya membaca dan menghasilkan satu tabel berisi 10 pemeriksaan. Kolom `hasil` bernilai `OK` (sesuai), `BELUM` (kolom `keterangan` menyebut berkas yang perlu dijalankan), `PERLU DIPERBAIKI` (data atau fungsi menyimpang), atau `INFO`.

Pemeriksaan Realtime dan akses:

- Pastikan tabel `queues`, `notifications`, dan `announcements` ada di publikasi `supabase_realtime`.
- Pastikan RLS aktif. Warga hanya membaca antrian miliknya dan pengumuman aktif; dashboard membutuhkan profil ADMIN.
- Uji dengan dua akun berbeda: satu WARGA dan satu ADMIN.
- Verifikasi pemanggilan nomor menulis ke `notifications` dan status berubah pada kedua aplikasi.
- Setelah berkas 6: coba ubah status antrian lewat REST dengan akun ADMIN (misalnya `PATCH /rest/v1/queues`); permintaan harus ditolak.

## Status integrasi dan batasan

- Web: daftar antrian, detail, status loket, RPC FCFS, Realtime, CRUD layanan/pengumuman, direktori profil, laporan, analitik, dan profil admin memiliki jalur Supabase. Uji seluruh operasi dengan akun ADMIN pada project Anda.
- Mobile: login/registrasi, ambil nomor, status antrian, pembatalan antrian yang menunggu, pengumuman, Realtime, notifikasi lokal, dan text-to-speech sudah disediakan dalam kode.
- Push notification ketika aplikasi ditutup membutuhkan konfigurasi kredensial FCM/Expo Push dan pengiriman token perangkat. Belum dikonfigurasi.
- Berkas SQL dijalankan manual melalui SQL Editor; verifikasi RLS, fungsi, dan hak akses dengan `supabase/queue_integrity.sql` sebelum digunakan di kantor.
