-- Perbaikan setelah 20261029110000_queue_completion_notifications_and_announcements.sql
--
-- 1) Trigger auto-call setelah "Selesaikan" kini lebih dulu melewati tiket WAITING/CALLED dari hari sebelumnya
--    (sama seperti call_next_queue), sehingga tiket kemarin tidak ikut terpanggil. Teks notifikasi disamakan
--    dengan call_next_queue.
-- 2) Token push: satu token perangkat hanya boleh dimiliki satu akun. Fungsi register_device_token memindahkan
--    kepemilikan token ke akun yang sedang login (upsert langsung gagal karena RLS bila token milik akun lain),
--    dan unregister_device_token dipakai aplikasi saat logout agar akun lama tidak lagi menerima push di perangkat itu.

create or replace function public.handle_queue_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  next_queue public.queues;
begin
  if new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' then
    insert into public.notifications (user_id, queue_id, type, title, body)
    values (
      new.user_id,
      new.id,
      'QUEUE_COMPLETED',
      'Pelayanan Anda Selesai',
      'Pelayanan untuk nomor antrean Anda ' || new.queue_number ||
      ' telah selesai. Terima kasih telah menggunakan layanan Kantor Camat Talawi. Anda dapat meninggalkan loket pelayanan.'
    );

    -- Kunci yang sama dengan RPC antrian: hanya satu tiket yang boleh menempati loket.
    perform pg_advisory_xact_lock(hashtext('talawi_single_service_counter'));

    -- Lewati tiket hari sebelumnya (tanpa notifikasi) agar tidak ikut urutan FCFS hari ini.
    update public.queues
    set status = 'SKIPPED', updated_at = clock_timestamp()
    where status in ('WAITING', 'CALLED')
      and arrival_time < today_start;

    if not exists (select 1 from public.queues where status in ('CALLED', 'SERVING')) then
      select * into next_queue
      from public.queues
      where status = 'WAITING'
      order by arrival_time asc, id asc
      for update skip locked
      limit 1;

      if next_queue.id is not null then
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
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.register_device_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'Token required';
  end if;

  insert into public.device_tokens (user_id, token, platform)
  values (auth.uid(), p_token, coalesce(nullif(p_platform, ''), 'android'))
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform;
end;
$$;

create or replace function public.unregister_device_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Login required';
  end if;
  delete from public.device_tokens where token = p_token and user_id = auth.uid();
end;
$$;

revoke execute on function public.register_device_token(text, text) from public, anon;
revoke execute on function public.unregister_device_token(text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;
grant execute on function public.unregister_device_token(text) to authenticated;
