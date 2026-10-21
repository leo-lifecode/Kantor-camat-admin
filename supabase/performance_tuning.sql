-- Penyetelan performa untuk Kantor Camat Talawi (menindaklanjuti advisor "Performance" Supabase).
--
-- Jalankan di Supabase SQL Editor setelah schema.sql, queue_actions.sql, security_hardening.sql,
-- revoke_anon_rpc.sql, dan queue_lifecycle_hardening.sql. Aman dijalankan berulang kali dan berjalan
-- dalam satu transaksi: bila ada yang gagal, tidak ada perubahan yang tersimpan.
--
-- Berkas ini TIDAK mengubah siapa yang boleh membaca/menulis apa. Hanya bentuk policy dan indeks yang berubah.
--
-- 1) Indeks untuk kolom foreign key (lint 0001 unindexed_foreign_keys). Tanpa indeks ini, menghapus atau
--    mengubah baris induk (mis. layanan atau profil) memindai seluruh tabel anak.
-- 2) RLS initplan (lint 0003 auth_rls_initplan): auth.uid() dan current_user_is_admin() dibungkus
--    "(select ...)" sehingga dievaluasi sekali per query, bukan sekali per baris.
-- 3) Policy ganda (lint 0006 multiple_permissive_policies): pada services dan announcements, policy
--    "admin manage" (FOR ALL) tumpang tindih dengan policy baca untuk SELECT, sehingga setiap SELECT
--    mengevaluasi dua policy. Policy baca sudah mengizinkan admin ("... or current_user_is_admin()"),
--    jadi bagian SELECT dari "admin manage" memang berlebih. Policy itu dipecah menjadi INSERT/UPDATE/DELETE.
--
-- Cara membatalkan (rollback): jalankan ulang bagian policy dari schema.sql (baris "create policy ...")
-- dan hapus indeks yang dibuat di bagian 1 dengan "drop index if exists <nama>;".
--
-- Yang tidak diubah dan sengaja dibiarkan: peringatan advisor Security untuk current_user_is_admin()
-- (dipakai oleh RLS, lihat komentar di revoke_anon_rpc.sql) dan "Leaked Password Protection"
-- (pengaturan di Dashboard: Authentication > Sign In / Providers > Email, tidak bisa lewat SQL).

begin;

-- 1) Indeks foreign key ---------------------------------------------------------------------------

create index if not exists announcements_created_by_idx on public.announcements (created_by);
create index if not exists device_tokens_user_id_idx on public.device_tokens (user_id);
create index if not exists notifications_queue_id_idx on public.notifications (queue_id);
create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists queues_service_id_idx on public.queues (service_id);

-- 2) RLS initplan ---------------------------------------------------------------------------------

drop policy if exists "profiles read self or admin" on public.profiles;
create policy "profiles read self or admin" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.current_user_is_admin()));

drop policy if exists "queues read owner or admin" on public.queues;
create policy "queues read owner or admin" on public.queues for select to authenticated
using (user_id = (select auth.uid()) or (select public.current_user_is_admin()));

drop policy if exists "notifications read own or admin" on public.notifications;
create policy "notifications read own or admin" on public.notifications for select to authenticated
using (user_id = (select auth.uid()) or (select public.current_user_is_admin()));

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "tokens manage own" on public.device_tokens;
create policy "tokens manage own" on public.device_tokens for all to authenticated
using (user_id = (select auth.uid()) or (select public.current_user_is_admin()))
with check (user_id = (select auth.uid()) or (select public.current_user_is_admin()));

-- 3) Policy ganda ---------------------------------------------------------------------------------

-- services: baca = layanan aktif untuk semua orang, semua layanan untuk admin; tulis = admin saja.
drop policy if exists "services readable" on public.services;
create policy "services readable" on public.services for select
using (is_active = true or (select public.current_user_is_admin()));

drop policy if exists "services admin manage" on public.services;
drop policy if exists "services admin insert" on public.services;
drop policy if exists "services admin update" on public.services;
drop policy if exists "services admin delete" on public.services;
create policy "services admin insert" on public.services for insert to authenticated
with check ((select public.current_user_is_admin()));
create policy "services admin update" on public.services for update to authenticated
using ((select public.current_user_is_admin())) with check ((select public.current_user_is_admin()));
create policy "services admin delete" on public.services for delete to authenticated
using ((select public.current_user_is_admin()));

-- announcements: baca = pengumuman aktif untuk semua orang, semua pengumuman untuk admin; tulis = admin saja.
drop policy if exists "announcements public read" on public.announcements;
create policy "announcements public read" on public.announcements for select
using (is_active = true or (select public.current_user_is_admin()));

drop policy if exists "announcements admin manage" on public.announcements;
drop policy if exists "announcements admin insert" on public.announcements;
drop policy if exists "announcements admin update" on public.announcements;
drop policy if exists "announcements admin delete" on public.announcements;
create policy "announcements admin insert" on public.announcements for insert to authenticated
with check ((select public.current_user_is_admin()));
create policy "announcements admin update" on public.announcements for update to authenticated
using ((select public.current_user_is_admin())) with check ((select public.current_user_is_admin()));
create policy "announcements admin delete" on public.announcements for delete to authenticated
using ((select public.current_user_is_admin()));

commit;
