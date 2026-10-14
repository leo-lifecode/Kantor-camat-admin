# Sistem Antrian Digital Kantor Camat Talawi

Proyek skripsi **Rancang Bangun Sistem Antrian Digital Berbasis Mobile dengan Notifikasi Real-Time pada Kantor Camat Talawi Menggunakan Algoritma First Come First Serve (FCFS)**.

Repository ini berisi dua aplikasi:
- **Web admin**: Next.js, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/Realtime.
- **Aplikasi warga**: Expo + React Native, Supabase Auth/PostgreSQL/Realtime, text-to-speech dan notifikasi lokal ketika nomor dipanggil.

## Fitur web admin

- Ringkasan dashboard dan kontrol loket tunggal.
- Daftar antrian, pencarian, filter status/tanggal, detail timeline.
- Transisi status FCFS: panggil, mulai dilayani, selesai, atau lewati.
- Mode Supabase jika environment tersedia, termasuk langganan Realtime untuk perubahan tabel antrian.
- Halaman layanan dan pengumuman sudah mendukung Supabase; direktori pengguna membaca profil Supabase. Laporan CSV dan analitik FCFS membaca data antrian Supabase; profil mendukung pembaruan data profil dan email Auth.

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
4. Jalankan SQL di Supabase SQL Editor sesuai urutan:
   1. `supabase/schema.sql`
   2. `supabase/queue_actions.sql`
   3. `supabase/security_hardening.sql`
5. Jalankan `npm run dev`, lalu buka `http://localhost:3000`.

Tanpa environment Supabase, dashboard antrian menggunakan data demo sementara. Jangan menaruh `service_role` key di frontend.

## Menjalankan aplikasi warga

1. Masuk ke folder `mobile-warga`.
2. Salin `.env.example` menjadi `.env`, lalu isi `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Jalankan:
   ```bash
   npm install
   npx expo start
   ```
4. Scan QR menggunakan Expo Go atau jalankan emulator Android.

Fitur aplikasi warga: registrasi/login, memilih layanan dan mengambil satu nomor antrian aktif, melihat status antrian, pengumuman aktif, pembaruan melalui Realtime, notifikasi lokal dan pembacaan suara saat dipanggil.

**Push notification ketika aplikasi tertutup belum siap produksi.** Konfigurasi kredensial FCM/Expo Push dan pendaftaran token perangkat masih perlu dilakukan. Belum ada APK yang dibangun dari lingkungan ini.

## Struktur halaman web

| Route | Fungsi |
| --- | --- |
| `/login` | Login administrator |
| `/dashboard` | Ringkasan dan kontrol loket |
| `/antrian` | Daftar, filter, dan panggil antrian |
| `/antrian/[id]` | Detail dan transisi status |
| `/layanan` | Kelola layanan (Supabase/demo) |
| `/pengumuman` | Kelola pengumuman (Supabase/demo) |
| `/pengguna` | Daftar profil (Supabase/demo) |
| `/laporan` | Rekap dan ekspor CSV (Supabase/demo) |
| `/analitik-fcfs` | Formula dan analitik timestamp (Supabase/demo) |
| `/profil` | Profil admin (Supabase/demo) |

## Aturan FCFS dan satu loket

Urutan ditentukan dari `arrival_time ASC, id ASC`, bukan dari nomor semata. Operasi pemanggilan, mulai, selesai, dan lewati diproses melalui RPC database dengan pemeriksaan role ADMIN serta penguncian untuk loket tunggal. Warga hanya dapat memiliki satu antrian aktif.

## Validasi otomatis

GitHub Actions menjalankan pemeriksaan TypeScript, ESLint, dan production build untuk aplikasi web. Aplikasi Expo berada di `mobile-warga/` dan perlu diuji terpisah pada emulator/perangkat Android.

## Status integrasi

Bagian antrian web memiliki jalur Supabase query/RPC/Realtime; layanan dan pengumuman mendukung baca/tulis; direktori pengguna membaca profil; laporan dan analitik menghitung data antrian dari Supabase; profil mendukung update Supabase Auth/profiles. Supabase SQL belum dijalankan terhadap project nyata dari sesi ini, sehingga konfigurasi RLS, akun ADMIN, Realtime, dan kredensial push harus diverifikasi sebelum dipakai di kantor.
