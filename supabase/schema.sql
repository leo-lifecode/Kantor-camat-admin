-- Kantor Camat Talawi Digital Queue System
-- Run in Supabase SQL Editor. Review policies before production deployment.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  role text not null default 'WARGA' check (role in ('WARGA','ADMIN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text,
  estimated_duration integer not null default 15 check (estimated_duration > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.queues (
  id uuid primary key default gen_random_uuid(),
  queue_number text not null unique,
  user_id uuid not null references public.profiles(id),
  service_id uuid not null references public.services(id),
  status text not null default 'WAITING' check (status in ('WAITING','CALLED','SERVING','COMPLETED','SKIPPED')),
  arrival_time timestamptz not null default clock_timestamp(),
  called_time timestamptz,
  start_service_time timestamptz,
  completion_time timestamptz,
  service_duration integer,
  waiting_time integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists queues_arrival_idx on public.queues(arrival_time asc, id asc);
create index if not exists queues_status_arrival_idx on public.queues(status, arrival_time asc);
create index if not exists queues_user_idx on public.queues(user_id, arrival_time desc);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  image_url text,
  published_at timestamptz,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  queue_id uuid references public.queues(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android',
  created_at timestamptz not null default now()
);

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN'
  );
$$;

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.queues enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.device_tokens enable row level security;

drop policy if exists "profiles read self or admin" on public.profiles;
create policy "profiles read self or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.current_user_is_admin());

drop policy if exists "profiles update self or admin" on public.profiles;
create policy "profiles update self or admin" on public.profiles for update to authenticated
using (id = auth.uid() or public.current_user_is_admin())
with check (id = auth.uid() or public.current_user_is_admin());

drop policy if exists "services readable" on public.services;
create policy "services readable" on public.services for select
using (is_active = true or public.current_user_is_admin());

drop policy if exists "services admin manage" on public.services;
create policy "services admin manage" on public.services for all to authenticated
using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "queues read owner or admin" on public.queues;
create policy "queues read owner or admin" on public.queues for select to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "citizen create own queue" on public.queues;
create policy "citizen create own queue" on public.queues for insert to authenticated
with check (user_id = auth.uid() and status = 'WAITING');

drop policy if exists "admin update queues" on public.queues;
create policy "admin update queues" on public.queues for update to authenticated
using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "announcements public read" on public.announcements;
create policy "announcements public read" on public.announcements for select
using (is_active = true or public.current_user_is_admin());

drop policy if exists "announcements admin manage" on public.announcements;
create policy "announcements admin manage" on public.announcements for all to authenticated
using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "notifications read own or admin" on public.notifications;
create policy "notifications read own or admin" on public.notifications for select to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "tokens manage own" on public.device_tokens;
create policy "tokens manage own" on public.device_tokens for all to authenticated
using (user_id = auth.uid() or public.current_user_is_admin())
with check (user_id = auth.uid() or public.current_user_is_admin());

-- Atomic FCFS call-next. Only one WAITING queue can be claimed by this function.
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
  values (selected_queue.user_id, selected_queue.id, 'QUEUE_CALLED', 'Antrian dipanggil',
          'Nomor antrian ' || selected_queue.queue_number || ' dipanggil. Silakan menuju loket.');

  return selected_queue;
end;
$$;

revoke all on function public.call_next_queue() from public;
grant execute on function public.call_next_queue() to authenticated;

-- Seed initial services. Adjust codes/names to the office's actual service list.
insert into public.services(name, code, description, estimated_duration)
values
  ('Pembuatan KTP', 'KTP', 'Pembuatan dan pembaruan Kartu Tanda Penduduk', 15),
  ('Kartu Keluarga', 'KK', 'Pembuatan dan perubahan Kartu Keluarga', 20),
  ('Surat Domisili', 'DOM', 'Surat keterangan domisili warga', 10)
on conflict (code) do nothing;

-- Important: assign ADMIN role manually to a trusted profile after account registration.
-- Never expose the Supabase service_role key in frontend code.
