# Aplikasi Warga Antrian Talawi

Aplikasi Expo/React Native untuk warga: login/registrasi, mengambil satu nomor antrian aktif, melihat status, membaca pengumuman, dan menerima pembaruan status melalui Supabase Realtime. Saat nomor dipanggil, aplikasi menampilkan notifikasi dalam aplikasi dan membacakan nomor melalui text-to-speech.

## Menjalankan

1. Install Node.js LTS dan Expo Go / Android Studio.
2. Salin `.env.example` menjadi `.env` lalu isi URL dan anon key Supabase.
3. Dari folder ini jalankan `npm install`, lalu `npx expo start`.
4. Jalankan seluruh SQL di folder `supabase/` sesuai bagian "Urutan SQL" pada README utama (7 berkas, dari `schema.sql` sampai `performance_tuning.sql`). Berkas `queue_lifecycle_hardening.sql` perlu dijalankan sebelum memakai versi aplikasi ini.
5. Buat akun warga melalui aplikasi. Untuk akun admin, ubah role secara manual hanya untuk akun tepercaya.
6. Untuk membangun APK Android, install EAS CLI, login, lalu jalankan `eas build --platform android --profile preview`. Konfigurasi build ada di `eas.json`; proses build memerlukan akun EAS.

## Catatan

- Jangan pernah menaruh service-role key di aplikasi.
- Hari antrian dihitung menurut WIB. Tiket `WAITING`/`CALLED` dari hari sebelumnya tidak ditampilkan sebagai antrian aktif, sehingga warga bisa langsung mengambil nomor baru (server melewatinya otomatis). Untuk WITA/WIT, ubah `OFFICE_UTC_OFFSET_HOURS` di `src/lib/queue-day.ts` bersamaan dengan zona waktu pada SQL.
- Realtime memerlukan tabel `queues`, `notifications`, dan `announcements` diaktifkan pada Supabase Realtime publication. RLS tetap harus aktif.
- Push notification ketika aplikasi benar-benar tertutup memerlukan konfigurasi kredensial FCM/Expo Push dan token perangkat pada `device_tokens`; ini tidak bisa aktif hanya dengan mengisi anon key.
- Aplikasi membaca data langsung dari Supabase. Belum ada konfigurasi backend produksi, project Supabase, kredensial push, atau APK yang dibangun dari lingkungan ini.