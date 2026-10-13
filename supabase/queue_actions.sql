-- Run after schema.sql in Supabase SQL Editor.
-- These functions keep status transitions and timing calculations on the database.

create or replace function public.start_queue_service(p_queue_id uuid)
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare q public.queues;
begin
  if not public.current_user_is_admin() then raise exception 'Administrator only'; end if;
  select * into q from public.queues where id = p_queue_id for update;
  if q.id is null then raise exception 'Queue not found'; end if;
  if q.status <> 'CALLED' then raise exception 'Only a called queue can start service'; end if;
  if exists (select 1 from public.queues where status = 'SERVING' and id <> p_queue_id) then
    raise exception 'The counter is already serving another queue';
  end if;
  update public.queues
  set status = 'SERVING',
      start_service_time = clock_timestamp(),
      waiting_time = greatest(0, floor(extract(epoch from (clock_timestamp() - arrival_time)))::integer),
      updated_at = clock_timestamp()
  where id = p_queue_id returning * into q;
  return q;
end;
$$;

create or replace function public.complete_queue_service(p_queue_id uuid)
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare q public.queues;
begin
  if not public.current_user_is_admin() then raise exception 'Administrator only'; end if;
  select * into q from public.queues where id = p_queue_id for update;
  if q.id is null then raise exception 'Queue not found'; end if;
  if q.status <> 'SERVING' then raise exception 'Only a serving queue can be completed'; end if;
  update public.queues
  set status = 'COMPLETED',
      completion_time = clock_timestamp(),
      service_duration = greatest(0, floor(extract(epoch from (clock_timestamp() - start_service_time)))::integer),
      updated_at = clock_timestamp()
  where id = p_queue_id returning * into q;
  return q;
end;
$$;

create or replace function public.skip_queue(p_queue_id uuid)
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare q public.queues;
begin
  if not public.current_user_is_admin() then raise exception 'Administrator only'; end if;
  select * into q from public.queues where id = p_queue_id for update;
  if q.id is null then raise exception 'Queue not found'; end if;
  if q.status not in ('WAITING','CALLED') then
    raise exception 'Only waiting or called queues can be skipped';
  end if;
  update public.queues
  set status = 'SKIPPED', updated_at = clock_timestamp()
  where id = p_queue_id returning * into q;
  insert into public.notifications(user_id, queue_id, type, title, body)
  values (q.user_id, q.id, 'QUEUE_SKIPPED', 'Antrian dilewati',
          'Nomor antrian ' || q.queue_number || ' dilewati. Hubungi petugas untuk informasi.');
  return q;
end;
$$;

revoke all on function public.start_queue_service(uuid) from public;
revoke all on function public.complete_queue_service(uuid) from public;
revoke all on function public.skip_queue(uuid) from public;
grant execute on function public.start_queue_service(uuid) to authenticated;
grant execute on function public.complete_queue_service(uuid) to authenticated;
grant execute on function public.skip_queue(uuid) to authenticated;
