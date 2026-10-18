-- Cabut akses role anon (belum login) ke fungsi RPC antrian.
-- Jalankan setelah schema.sql, queue_actions.sql, security_hardening.sql, dan cancel_queue.sql
-- di Supabase SQL Editor. Aman dijalankan berulang kali.
--
-- Mengapa perlu: "revoke all ... from public" pada file SQL lain tidak mencabut izin
-- EXECUTE yang diberikan Supabase langsung ke role anon, sehingga fungsi SECURITY DEFINER
-- tetap bisa dipanggil lewat /rest/v1/rpc tanpa login. Setiap fungsi sudah menolak pemanggil
-- yang tidak berhak, jadi ini adalah lapisan keamanan tambahan.

revoke execute on function public.call_next_queue() from anon;
revoke execute on function public.cancel_own_queue(uuid) from anon;
revoke execute on function public.complete_queue_service(uuid) from anon;
revoke execute on function public.create_queue(uuid) from anon;
revoke execute on function public.skip_queue(uuid) from anon;
revoke execute on function public.start_queue_service(uuid) from anon;

-- Fungsi trigger pembuat profil WARGA; hanya dipanggil oleh trigger pada auth.users,
-- sehingga tidak perlu bisa dipanggil lewat REST API oleh role mana pun.
revoke execute on function public.handle_new_auth_user() from anon, authenticated;

-- current_user_is_admin() sengaja TIDAK dicabut dari anon: fungsi ini dipakai oleh kebijakan
-- RLS pada services dan announcements (pembacaan publik). Mencabutnya akan membuat
-- pembacaan oleh pengguna yang belum login menghasilkan error "permission denied".
