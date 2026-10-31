-- Pemanggilan otomatis saat loket kosong.
--
-- Sebelumnya loket baru terisi otomatis setelah "Selesaikan" (handle_queue_completion). Migrasi ini menambah dua
-- keadaan lain agar petugas tidak perlu menekan "Panggil Berikutnya" secara manual:
--   1) warga mengambil nomor saat loket kosong dan tidak ada yang menunggu -> tiket itu langsung dipanggil;
--   2) tiket CALLED dilewati (warga tidak datang) dan masih ada tiket WAITING -> tiket berikutnya dipanggil.
-- Aturan pemilihan sama dengan call_next_queue: WAITING paling awal (arrival_time, id) pada hari ini, dengan kunci
-- advisory loket tunggal yang sama. Tiket hari sebelumnya dilewati dulu tanpa notifikasi.
--
-- create_queue diganti agar kunci loket diambil SEBELUM nomor dan arrival_time dibuat. Dengan begitu dua warga yang
-- mengambil nomor bersamaan diurutkan oleh kunci, sehingga urutan nomor, arrival_time, dan urutan pemanggilan searah
-- dan tiket yang lebih awal tidak bisa didahului oleh tiket yang commit lebih cepat.

create or replace function public.dispatch_next_if_idle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  next_queue public.queues;
begin
  perform pg_advisory_xact_lock(hashtext('talawi_single_service_counter'));

  update public.queues
  set status = 'SKIPPED', updated_at = clock_timestamp()
  where status in ('WAITING', 'CALLED')
    and arrival_time < today_start;

  if exists (select 1 from public.queues where status in ('CALLED', 'SERVING')) then
    return;
  end if;

  select * into next_queue
  from public.queues
  where status = 'WAITING'
  order by arrival_time asc, id asc
  for update skip locked
  limit 1;

  if next_queue.id is null then
    return;
  end if;

  update public.queues
  set status = 'CALLED',
      called_time = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = next_queue.id
  returning * into next_queue;

  insert into public.notifications (user_id, queue_id, type, title, body)
  values (
    next_queue.user_id, next_queue.id, 'QUEUE_CALLED', 'Antrian dipanggil',
    'Nomor antrian ' || next_queue.queue_number || ' dipanggil. Silakan menuju loket.'
  );
end;
$$;

create or replace function public.handle_queue_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.dispatch_next_if_idle();
  return null;
end;
$$;

create or replace function public.handle_queue_skipped()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Tiket kemarin yang dilewati oleh pembersihan otomatis tidak memicu pemanggilan (sudah ditangani dispatch_next_if_idle).
  if new.arrival_time >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta' then
    perform public.dispatch_next_if_idle();
  end if;
  return null;
end;
$$;

revoke all on function public.dispatch_next_if_idle() from public, anon, authenticated;
revoke all on function public.handle_queue_created() from public, anon, authenticated;
revoke all on function public.handle_queue_skipped() from public, anon, authenticated;

drop trigger if exists queues_auto_call_on_insert on public.queues;
create trigger queues_auto_call_on_insert
after insert on public.queues
for each row
when (new.status = 'WAITING')
execute function public.handle_queue_created();

drop trigger if exists queues_auto_call_on_skip on public.queues;
create trigger queues_auto_call_on_skip
after update of status on public.queues
for each row
when (new.status = 'SKIPPED' and old.status = 'CALLED')
execute function public.handle_queue_skipped();

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

  -- Kunci loket tunggal diambil sebelum nomor dan arrival_time dibuat (urutan kunci: warga lalu loket).
  perform pg_advisory_xact_lock(hashtext('talawi_single_service_counter'));

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

  -- Trigger handle_queue_created dapat langsung memanggil tiket ini (loket kosong); kembalikan baris terbaru.
  select * into new_queue from public.queues where id = new_queue.id;
  return new_queue;
end;
$$;

revoke all on function public.create_queue(uuid) from public, anon;
grant execute on function public.create_queue(uuid) to authenticated;
