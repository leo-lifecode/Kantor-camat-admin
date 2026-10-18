-- Run this migration in Supabase SQL Editor after schema.sql and cancel_queue.sql.
-- Adds the missing create_queue RPC, protects FCFS queue creation, and prevents
-- one citizen from holding multiple active queues at the same time.

create sequence if not exists public.queue_number_seq;

-- Existing duplicate active queues must be resolved before this index can be created.
do $$
begin
  if exists (
    select user_id
    from public.queues
    where status in ('WAITING', 'CALLED', 'SERVING')
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'Migration stopped: a citizen has multiple active queues. Resolve duplicate WAITING/CALLED/SERVING rows first.';
  end if;
end;
$$;

create unique index if not exists queues_one_active_queue_per_user_idx
  on public.queues(user_id)
  where status in ('WAITING', 'CALLED', 'SERVING');

create or replace function public.create_queue(p_service_id uuid)
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare
  new_queue public.queues;
  service_code text;
  next_number bigint;
  generated_number text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Serialize queue creation attempts by this user, including concurrent taps.
  perform pg_advisory_xact_lock(hashtext('talawi_create_queue'), hashtext(auth.uid()::text));

  if exists (
    select 1 from public.queues
    where user_id = auth.uid()
      and status in ('WAITING', 'CALLED', 'SERVING')
  ) then
    raise exception 'Anda masih memiliki antrean aktif. Selesaikan atau batalkan antrean tersebut terlebih dahulu.';
  end if;

  select code into service_code
  from public.services
  where id = p_service_id and is_active = true;

  if service_code is null then
    raise exception 'Layanan tidak ditemukan atau sedang tidak aktif';
  end if;

  next_number := nextval('public.queue_number_seq');
  generated_number := upper(regexp_replace(service_code, '[^A-Za-z0-9]', '', 'g'))
    || '-' || to_char(clock_timestamp() at time zone 'Asia/Jakarta', 'YYMMDD')
    || '-' || lpad(next_number::text, 4, '0');

  insert into public.queues(queue_number, user_id, service_id, status, arrival_time)
  values (generated_number, auth.uid(), p_service_id, 'WAITING', clock_timestamp())
  returning * into new_queue;

  return new_queue;
end;
$$;

revoke all on function public.create_queue(uuid) from public;
grant execute on function public.create_queue(uuid) to authenticated;
