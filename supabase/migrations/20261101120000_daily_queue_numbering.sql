-- Nomor antrian dimulai lagi dari A-0001 setiap hari (batas hari = tengah malam Asia/Jakarta).
--
-- Sebelumnya nomor memakai sequence global sehingga terus bertambah lintas hari (A-0005 di hari kedua).
-- Sekarang nomor = nomor terbesar hari ini + 1, dihitung di dalam kunci loket tunggal yang sudah dipegang create_queue,
-- jadi dua warga yang bersamaan tidak bisa mendapat nomor sama. Nomor tidak dipakai ulang di hari yang sama karena tiket
-- yang dibatalkan tetap tersimpan.
--
-- UNIQUE(queue_number) global diganti unik per (nomor, hari) agar A-0001 boleh muncul lagi di hari berikutnya.

alter table public.queues drop constraint if exists queues_queue_number_key;

create unique index if not exists queues_queue_day_number_key
  on public.queues (queue_number, ((arrival_time at time zone 'Asia/Jakarta')::date));

create or replace function public.create_queue(p_service_id uuid)
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare
  new_queue public.queues;
  next_number integer;
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
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
    and arrival_time < today_start;

  if exists (
    select 1 from public.queues
    where user_id = auth.uid() and status in ('WAITING','CALLED','SERVING')
  ) then
    raise exception 'You already have an active queue';
  end if;

  select coalesce(max(substring(queue_number from 3)::integer), 0) + 1
  into next_number
  from public.queues
  where arrival_time >= today_start;

  insert into public.queues(queue_number, user_id, service_id, status, arrival_time)
  values ('A-' || lpad(next_number::text, 4, '0'), auth.uid(), p_service_id, 'WAITING', clock_timestamp())
  returning * into new_queue;

  -- Trigger handle_queue_created dapat langsung memanggil tiket ini; kembalikan baris terbaru.
  select * into new_queue from public.queues where id = new_queue.id;
  return new_queue;
end;
$$;

revoke all on function public.create_queue(uuid) from public, anon;
grant execute on function public.create_queue(uuid) to authenticated;
