# Dashboard Admin Sistem Antrian Digital Kantor Camat Talawi

Web dashboard admin untuk proyek **Rancang Bangun Sistem Antrian Digital Berbasis Mobile dengan Notifikasi Real-Time pada Kantor Camat Talawi Menggunakan Algoritma First Come First Serve (FCFS)**.

## Fitur dashboard

- Ringkasan total antrian, menunggu, dilayani, selesai, dan dilewati.
- Daftar antrian dengan pencarian, filter status, filter tanggal, dan halaman detail.
- Demo alur satu loket: panggil, mulai dilayani, selesaikan, atau lewati antrian.
- CRUD demo untuk jenis layanan.
- Buat dan publikasikan/sembunyikan pengumuman demo.
- Daftar pengguna contoh dengan pencarian dan filter role.
- Laporan berdasarkan tanggal dengan ekspor CSV.
- Analitik FCFS dengan rumus waktu tunggu, waktu layanan, dan urutan kedatangan.
- Login admin berbasis Supabase Auth dan middleware pemeriksaan role ketika environment tersedia.

## Mode demo

Halaman menggunakan data contoh. Perubahan pada layanan, pengumuman, dan status antrian hanya berada di state halaman dan tidak tersimpan permanen. Login Supabase membutuhkan konfigurasi environment dan database.

## Menjalankan aplikasi

1. Install Node.js versi LTS.
2. Install dependency project, termasuk Supabase:
   ```bash
   npm install
   npm install @supabase/supabase-js @supabase/ssr
   ```
3. Salin `.env.example` menjadi `.env.local`.
4. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` jika ingin mengaktifkan login Supabase.
5. Jalankan development server:
   ```bash
   npm run dev
   ```
6. Buka `http://localhost:3000`.

> Catatan: konfigurasi package manager dan script perlu diperiksa di lingkungan lokal karena build belum dijalankan dari sesi ini.

## Struktur halaman

| Route | Fungsi |
| --- | --- |
| `/login` | Login administrator |
| `/dashboard` | Ringkasan dan kontrol loket demo |
| `/antrian` | Daftar, pencarian, filter, dan panggil antrian demo |
| `/antrian/[id]` | Detail dan transisi status antrian demo |
| `/layanan` | Tambah, edit, dan aktif/nonaktif layanan demo |
| `/pengumuman` | Buat dan publikasikan pengumuman demo |
| `/pengguna` | Daftar akun contoh |
| `/laporan` | Rekap dan ekspor CSV |
| `/analitik-fcfs` | Formula dan urutan eksekusi FCFS |
| `/profil` | Form profil admin demo |

## Supabase SQL

Jalankan berurutan melalui Supabase SQL Editor:

1. `supabase/schema.sql`
2. `supabase/queue_actions.sql`
3. `supabase/security_hardening.sql`

Lihat [SETUP_SUPABASE.md](./SETUP_SUPABASE.md) untuk langkah pembuatan akun admin, kebijakan akses, dan checklist produksi.

## FCFS dan satu loket

Urutan antrian menggunakan timestamp server `arrival_time ASC, id ASC`, bukan sekadar urutan nomor. Fungsi RPC database mengunci proses pemanggilan agar tidak ada dua panggilan bersamaan untuk loket yang sama. Satu warga hanya boleh memiliki satu antrian aktif.

## Belum selesai

- Menghubungkan halaman demo ke query Supabase.
- Menambahkan Supabase Realtime dan pengiriman push notification FCM.
- Membangun aplikasi React Native untuk WARGA.
- Menjalankan lint, pemeriksaan TypeScript, build, dan pengujian alur.
