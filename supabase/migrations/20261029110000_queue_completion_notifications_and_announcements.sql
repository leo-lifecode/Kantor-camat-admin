-- Notify the citizen once the queue changes to COMPLETED.
-- The existing notifications INSERT webhook forwards this row to send-queue-push.
create or replace function public.notify_queue_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'COMPLETED'
     and old.status is distinct from 'COMPLETED'
     and new.user_id is not null then
    insert into public.notifications (user_id, queue_id, type, title, body)
    values (
      new.user_id,
      new.id,
      'QUEUE_COMPLETED',
      'Pelayanan Anda Selesai',
      'Pelayanan untuk nomor antrean Anda ' || new.queue_number ||
      ' telah selesai. Terima kasih telah menggunakan layanan Kantor Camat Talawi. Anda dapat meninggalkan loket pelayanan.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists queues_notify_completed on public.queues;
create trigger queues_notify_completed
after update of status on public.queues
for each row
execute function public.notify_queue_completed();

-- Seed only helpful app information and a clearly historical, source-backed local event.
insert into public.announcements (title, content, category, image_url, published_at, is_active)
select
  'Program BERLAYAR di Kecamatan Talawi (Informasi Kegiatan)',
  'Informasi kegiatan yang telah berlangsung pada 20 Oktober 2026 di Koperasi Desa Merah Putih, Desa Mesjid Lama, Kecamatan Talawi. Layanan terpadu saat itu mencakup beberapa layanan perangkat daerah, antara lain administrasi kependudukan, perizinan usaha, pajak daerah, kesehatan, dan perpustakaan keliling. Ini adalah dokumentasi kegiatan lampau, bukan jadwal kegiatan mendatang. Sumber: https://batubarakab.go.id/berita/detail/bupati-batu-bara-hadirkan-pelayanan-terpadu-melalui-program-berlayar-di-kecamatan-talawi',
  'Informasi Daerah',
  null,
  '2026-10-20T00:00:00Z'::timestamptz,
  true
where not exists (
  select 1 from public.announcements
  where title = 'Program BERLAYAR di Kecamatan Talawi (Informasi Kegiatan)'
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
