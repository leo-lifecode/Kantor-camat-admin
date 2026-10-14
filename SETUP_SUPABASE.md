# Setup Supabase

## 1. Konfigurasi environment

Untuk web admin, salin `.env.example` ke `.env.local` pada root. Untuk aplikasi warga, salin `mobile-warga/.env.example` menjadi `mobile-warga/.env`. Isi URL project dan anon/publishable key dari Supabase Project Settings → API. Jangan commit file environment dan jangan pernah menaruh service-role key di frontend.

## 2. Buat database dan fungsi aman

Jalankan berurutan melalui Supabase SQL Editor:

1. `supabase/schema.sql`
2. `supabase/queue_actions.sql`
3. `supabase/security_hardening.sql`

Migration terakhir menonaktifkan promosi role sendiri, membatasi satu antrian aktif per warga, memvalidasi layanan, membuat profil WARGA otomatis, mengunci pemanggilan FCFS untuk satu loket, dan menambahkan tabel ke publikasi Realtime jika publikasi tersedia. Jika pembuatan unique index gagal, selesaikan duplikasi antrian aktif terlebih dahulu.

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

## 4. Jalankan web admin

Dari root repository:

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Dengan environment Supabase, middleware memeriksa autentikasi dan role ADMIN. Tanpa environment, dashboard antrian memakai data demo.

## 5. Jalankan aplikasi warga

```bash
cd mobile-warga
npm install
npx expo start
```

Scan QR dengan Expo Go atau jalankan emulator Android. Pastikan variabel `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY` sudah diisi sebelum memulai Metro.

## 6. Pemeriksaan Realtime

- Pastikan tabel `queues`, `notifications`, dan `announcements` ada di publikasi `supabase_realtime`.
- Pastikan RLS aktif. Warga hanya membaca antrian miliknya dan pengumuman aktif; dashboard membutuhkan profil ADMIN.
- Uji dengan dua akun berbeda: satu WARGA dan satu ADMIN.
- Verifikasi pemanggilan nomor menulis ke `notifications` dan status berubah pada kedua aplikasi.

## Status integrasi dan batasan

- Web: daftar antrian, detail, status loket, RPC FCFS, Realtime, CRUD layanan/pengumuman, direktori profil, laporan, analitik, dan profil admin memiliki jalur Supabase. Uji seluruh operasi dengan akun ADMIN pada project Anda.
- Mobile: login/registrasi, ambil nomor, status antrian, pengumuman, Realtime, notifikasi lokal, dan text-to-speech sudah disediakan dalam kode.
- Push notification ketika aplikasi ditutup membutuhkan konfigurasi kredensial FCM/Expo Push dan pengiriman token perangkat. Belum dikonfigurasi.
- SQL belum dijalankan pada project Supabase produksi dari sesi ini; lakukan verifikasi RLS dan fungsi sebelum digunakan di kantor.
