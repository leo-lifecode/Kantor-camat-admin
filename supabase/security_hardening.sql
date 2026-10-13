-- Security and concurrency hardening for Kantor Camat Talawi.
-- Run after schema.sql and queue_actions.sql in Supabase SQL Editor.

-- A citizen must not be able to promote their own profile to ADMIN.
drop policy if exists "profiles update self or admin" on public.profiles;
drop policy if exists "profiles update admin only" on public.profiles;
create policy "profiles update admin only" on public.profiles
for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- Enforce one active queue per citizen at database level.
-- If this fails, remove duplicate active queues before rerunning this migration.
create unique index if not exists queues_one_active_per_user_idx
on public.queues(user_id)
where status in ('WAITING', 'CALLED', 'SERVING');

-- Queue numbers remain unique across days; no collision when the office opens next day.
create sequence if not exists public.queue_number_seq start with 1;

-- Citizens create queues through this validated function instead of direct table inserts.
drop policy if exists "citizen create own queue" on public.queues;
revoke insert on public.queues from authenticated;

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

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Citizen profile not found';
  end if;

  if not exists (select 1 from public.services where id = p_service_id and is_active = true) then
    raise exception 'Selected service is not active';
  end if;

  -- Serialize queue creation for this citizen so concurrent requests cannot pass together.
  perform pg_advisory_xact_lock(hashtext('talawi_create_queue_' || auth.uid()::text));

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

-- Serialize "call next" operations for the single physical service counter.
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

revoke all on function public.call_next_queue() from public;
grant execute on function public.call_next_queue() to authenticated;
