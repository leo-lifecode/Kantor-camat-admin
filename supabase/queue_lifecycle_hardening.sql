-- Penguatan siklus hidup antrean untuk Kantor Camat Talawi.
--
-- Jalankan di Supabase SQL Editor setelah schema.sql, queue_actions.sql, security_hardening.sql,
-- dan revoke_anon_rpc.sql. Aman dijalankan berulang kali. Seluruh berkas berjalan dalam satu transaksi:
-- bila ada yang gagal, tidak ada perubahan yang tersimpan.
--
-- 1) Antrean WAITING/CALLED dari hari sebelumnya otomatis dilewati (SKIPPED). Tanpa ini, tiket kemarin
--    yang tidak pernah dilayani akan dipanggil lebih dulu esok harinya (urutan FCFS memakai arrival_time),
--    pemiliknya tidak bisa mengambil nomor baru, dan tiket CALLED lama memblokir loket tunggal.
--    Fungsi yang terlibat: expire_stale_queues() (baru, khusus admin), call_next_queue() dan create_queue()
--    (versi di security_hardening.sql ditambah satu langkah kedaluwarsa).
-- 2) Klien (web maupun aplikasi warga) tidak lagi bisa INSERT/UPDATE/DELETE langsung pada tabel queues.
--    Semua perubahan wajib lewat RPC (create_queue, call_next_queue, start_queue_service, ...) yang
--    menegakkan aturan FCFS dan loket tunggal. Sebelumnya policy "admin update queues" mengizinkan akun
--    admin mengubah status/waktu langsung dan melewati aturan tersebut.
--
-- Catatan operasional:
--   * "Hari" dihitung menurut waktu Asia/Jakarta (WIB). Bila kantor berada di WITA/WIT, ganti 'Asia/Jakarta'
--     di dua fungsi: expire_stale_queues() dan create_queue(). Di sisi aplikasi: OFFICE_TIME_ZONE pada
--     src/lib/queue-time.ts (web) dan OFFICE_UTC_OFFSET_HOURS pada mobile-warga/src/lib/queue-day.ts.
--   * Antrean SERVING dari hari lalu TIDAK dilewati otomatis, karena sudah sempat dilayani dan hasilnya
--     (selesai atau tidak) harus diputuskan petugas. Antrean itu memblokir loket sampai petugas menekan
--     "Selesaikan" di dashboard.
--   * Kedaluwarsa berjalan saat admin membuka dashboard (expire_stale_queues), saat call_next_queue() dipanggil,
--     dan saat warga memanggil create_queue() (hanya untuk tiket miliknya sendiri). Jadi warga yang mengambil
--     nomor dari rumah pagi-pagi tidak terblokir tiket kemarin walau dashboard belum dibuka.
--   * Kedaluwarsa tidak mengirim notifikasi ke warga.
--
-- Cara membatalkan (rollback):
--   * Bagian 1: jalankan ulang definisi call_next_queue() dan create_queue() dari security_hardening.sql, lalu
--       drop function public.expire_stale_queues();
--   * Bagian 2:
--       create policy "admin update queues" on public.queues for update to authenticated
--         using (public.current_user_is_admin()) with check (public.current_user_is_admin());
--       grant update, delete on public.queues to authenticated;

begin;

-- 1) Kedaluwarsa harian ---------------------------------------------------------------------------

create or replace function public.expire_stale_queues()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Awal hari ini menurut waktu kantor (WIB).
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  expired_count integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'Administrator only';
  end if;

  perform pg_advisory_xact_lock(hashtext('talawi_single_service_counter'));

  update public.queues
  set status = 'SKIPPED', updated_at = clock_timestamp()
  where status in ('WAITING', 'CALLED')
    and arrival_time < today_start;
  get diagnostics expired_count = row_count;

  return expired_count;
end;
$$;

revoke all on function public.expire_stale_queues() from public, anon;
grant execute on function public.expire_stale_queues() to authenticated;

-- Sama dengan versi di security_hardening.sql, ditambah satu langkah: antrean hari lalu dilewati dulu
-- agar tidak ikut urutan FCFS hari ini dan tidak memblokir loket.
create or replace function public.call_next_queue()
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_queue public.queues;
begin
  if not public.current_user_is_admin() then
    raise exception 'Only administrators can call the next queue';
  end if;

  perform pg_advisory_xact_lock(hashtext('talawi_single_service_counter'));

  perform public.expire_stale_queues();

  if exists (select 1 from public.queues where status in ('CALLED','SERVING')) then
    raise exception 'A queue is already called or being served';
  end if;

  select * into selected_queue
  from public.queues
  where status = 'WAITING'
  order by arrival_time asc, id asc
  for update skip locked
  limit 1;

  if selected_queue.id is null then
    raise exception 'No waiting queue';
  end if;

  update public.queues
  set status = 'CALLED', called_time = clock_timestamp(), updated_at = clock_timestamp()
  where id = selected_queue.id
  returning * into selected_queue;

  insert into public.notifications(user_id, queue_id, type, title, body)
  values (
    selected_queue.user_id, selected_queue.id, 'QUEUE_CALLED', 'Antrian dipanggil',
    'Nomor antrian ' || selected_queue.queue_number || ' dipanggil. Silakan menuju loket.'
  );

  return selected_queue;
end;
$$;

-- Sama dengan versi di security_hardening.sql, ditambah satu langkah: tiket kemarin milik pemanggil dilewati dulu.
create or replace function public.create_queue(p_service_id uuid)
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare
  new_queue public.queues;
  next_number bigint;
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'WARGA') then
    raise exception 'Only WARGA accounts can create a queue';
  end if;

  if not exists (select 1 from public.services where id = p_service_id and is_active = true) then
    raise exception 'Selected service is not active';
  end if;

  -- Serialize queue creation for this citizen so concurrent requests cannot pass together.
  perform pg_advisory_xact_lock(hashtext('talawi_create_queue_' || auth.uid()::text));

  -- Antrean WAITING/CALLED milik warga ini dari hari sebelumnya (sebelum tengah malam WIB) dilewati dulu, agar
  -- warga yang mengambil nomor dari rumah pagi-pagi tidak terblokir tiket kemarin sebelum petugas membuka
  -- dashboard. Antrean SERVING tidak disentuh: hasilnya harus diputuskan petugas.
  update public.queues
  set status = 'SKIPPED', updated_at = clock_timestamp()
  where user_id = auth.uid()
    and status in ('WAITING', 'CALLED')
    and arrival_time < date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';

  if exists (
    select 1 from public.queues
    where user_id = auth.uid() and status in ('WAITING','CALLED','SERVING')
  ) then
    raise exception 'You already have an active queue';
  end if;

  next_number := nextval('public.queue_number_seq');

  insert into public.queues(queue_number, user_id, service_id, status, arrival_time)
  values ('A-' || lpad(next_number::text, 4, '0'), auth.uid(), p_service_id, 'WAITING', clock_timestamp())
  returning * into new_queue;

  return new_queue;
end;
$$;

revoke all on function public.create_queue(uuid) from public;
grant execute on function public.create_queue(uuid) to authenticated;

-- 2) Tulis langsung ke queues hanya lewat RPC ----------------------------------------------------

drop policy if exists "admin update queues" on public.queues;

revoke all on table public.queues from anon;
revoke insert, update, delete, truncate on table public.queues from authenticated;

commit;
