-- Run this migration in Supabase SQL Editor for an existing project.
-- Cancelled rows are retained for audit/history, but are no longer active queues.

alter table public.queues
  drop constraint if exists queues_status_check;

alter table public.queues
  add constraint queues_status_check
  check (status in ('WAITING','CALLED','SERVING','COMPLETED','SKIPPED','CANCELLED'));

create or replace function public.cancel_own_queue(p_queue_id uuid)
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.queues;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into q
  from public.queues
  where id = p_queue_id and user_id = auth.uid()
  for update;

  if q.id is null then
    raise exception 'Queue not found or not owned by current user';
  end if;

  if q.status <> 'WAITING' then
    raise exception 'Only waiting queues can be cancelled';
  end if;

  update public.queues
  set status = 'CANCELLED', updated_at = clock_timestamp()
  where id = p_queue_id
  returning * into q;

  return q;
end;
$$;

revoke all on function public.cancel_own_queue(uuid) from public;
grant execute on function public.cancel_own_queue(uuid) to authenticated;
