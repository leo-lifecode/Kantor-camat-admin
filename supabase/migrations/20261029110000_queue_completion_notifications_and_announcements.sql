-- Keep the mobile app's announcement query compatible with the schema.
alter table public.announcements
  add column if not exists category text not null default 'Informasi';

-- Complete a queue, notify its owner, and automatically call the next FCFS queue.
-- The trigger is fired only for a genuine transition into COMPLETED.
create or replace function public.handle_queue_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
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

    -- Same lock used by the queue RPCs: only one queue can occupy the counter.
    perform pg_advisory_xact_lock(hashtext('talawi_single_service_counter'));

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
          next_queue.user_id,
          next_queue.id,
          'QUEUE_CALLED',
          'Nomor Antrean Anda Dipanggil',
          'Nomor antrean Anda ' || next_queue.queue_number || ' telah dipanggil. Silakan menuju loket pelayanan.'
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists queues_handle_completion on public.queues;
create trigger queues_handle_completion
after update of status on public.queues
for each row
execute function public.handle_queue_completion();

-- Seed one source-backed historical event and two practical app notices.
-- The BERLAYAR item is explicitly labelled as a past event, not an upcoming schedule.
insert into public.announcements (title, content, category, image_url, published_at, is_active)
select
  'Program BERLAYAR di Kecamatan Talawi (Dokumentasi Kegiatan)',
  'Dokumentasi kegiatan yang telah berlangsung pada 20 Oktober 2026 di Koperasi Desa Merah Putih, Desa Mesjid Lama, Kecamatan Talawi. Layanan terpadu saat itu mencakup layanan dari beberapa perangkat daerah, termasuk administrasi kependudukan, perizinan usaha, pajak daerah, kesehatan, dan perpustakaan keliling. Ini adalah informasi kegiatan lampau, bukan jadwal mendatang. Sumber resmi: https://batubarakab.go.id/berita/detail/bupati-batu-bara-hadirkan-pelayanan-terpadu-melalui-program-berlayar-di-kecamatan-talawi',
  'Informasi Daerah',
  null,
  '2026-10-20T00:00:00Z'::timestamptz,
  true
where not exists (
  select 1 from public.announcements
  where title = 'Program BERLAYAR di Kecamatan Talawi (Dokumentasi Kegiatan)'
);

insert into public.announcements (title, content, category, image_url, published_at, is_active)
select
  'Persiapkan Dokumen Sebelum Mengambil Antrean',
  'Sebelum datang, periksa persyaratan dokumen untuk layanan yang Anda pilih. Persyaratan dapat berbeda menurut jenis layanan, jadi pastikan kembali kepada petugas atau kanal resmi kecamatan jika ada dokumen yang belum jelas.',
  'Tips Layanan',
  null,
  now(),
  true
where not exists (
  select 1 from public.announcements
  where title = 'Persiapkan Dokumen Sebelum Mengambil Antrean'
);

insert into public.announcements (title, content, category, image_url, published_at, is_active)
select
  'Pantau Status Antrean dari Aplikasi',
  'Gunakan menu Antrean untuk memeriksa status nomor Anda. Saat nomor dipanggil, segera menuju loket pelayanan. Setelah status pelayanan selesai, Anda akan menerima pemberitahuan pada perangkat yang telah terdaftar.',
  'Panduan Aplikasi',
  null,
  now(),
  true
where not exists (
  select 1 from public.announcements
  where title = 'Pantau Status Antrean dari Aplikasi'
);
