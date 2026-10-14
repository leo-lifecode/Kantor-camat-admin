# Aplikasi Warga Antrian Talawi

Aplikasi Expo/React Native untuk warga: login/registrasi, mengambil satu nomor antrian aktif, melihat status, membaca pengumuman, dan menerima pembaruan status melalui Supabase Realtime. Saat nomor dipanggil, aplikasi menampilkan notifikasi dalam aplikasi dan membacakan nomor melalui text-to-speech.

## Menjalankan

1. Install Node.js LTS dan Expo Go / Android Studio.
2. Salin `.env.example` menjadi `.env` lalu isi URL dan anon key Supabase.
3. Dari folder ini jalankan `npm install`, lalu `npx expo start`.
4. Jalankan SQL admin repo sesuai urutan pada README utama: `supabase/schema.sql`, `supabase/queue_actions.sql`, lalu `supabase/security_hardening.sql`.
5. Buat akun warga melalui aplikasi. Untuk akun admin, ubah role secara manual hanya untuk akun tepercaya.

## Catatan

- Jangan pernah menaruh service-role key di aplikasi.
- Realtime memerlukan tabel `queues`, `notifications`, dan `announcements` diaktifkan pada Supabase Realtime publication. RLS tetap harus aktif.
- Push notification ketika aplikasi benar-benar tertutup memerlukan konfigurasi kredensial FCM/Expo Push dan token perangkat pada `device_tokens`; ini tidak bisa aktif hanya dengan mengisi anon key.
- Aplikasi membaca data langsung dari Supabase. Belum ada konfigurasi backend produksi, project Supabase, kredensial push, atau APK yang dibangun dari lingkungan ini.