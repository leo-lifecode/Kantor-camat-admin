-- 1) Tiket pertama setiap hari dipanggil manual; pemanggilan otomatis baru berjalan mulai tiket kedua.
--
-- Aturan (hari = zona Asia/Jakarta, mulai pukul 00.00):
--   * Selama belum ada tiket yang dipanggil hari ini DAN tiket hari ini (selain yang dibatalkan) kurang dari 2,
--     tidak ada pemanggilan otomatis. Petugas menekan "Panggil Berikutnya" untuk tiket pertama.
--   * Begitu hari itu ada tiket yang sudah dipanggil, atau ada minimal 2 tiket, pemanggilan otomatis berjalan:
--     saat warga mengambil nomor dan loket kosong, saat tiket CALLED dilewati, dan saat Selesaikan,
--     sampai tiket habis. Besok aturan dimulai dari awal lagi.
-- handle_queue_completion kini memakai dispatch_next_if_idle() yang sama (sebelumnya punya salinan logika sendiri).

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

  -- Hari ini belum "berjalan": belum ada yang dipanggil dan baru ada paling banyak satu tiket aktif.
  if not exists (select 1 from public.queues where called_time >= today_start)
     and (select count(*) from public.queues where arrival_time >= today_start and status <> 'CANCELLED') < 2 then
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

create or replace function public.handle_queue_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

    perform public.dispatch_next_if_idle();
  end if;

  return new;
end;
$$;

-- Penentuan "tiket pertama hari ini" kini seluruhnya ada di dispatch_next_if_idle(); trigger insert cukup memanggilnya.
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

revoke all on function public.dispatch_next_if_idle() from public, anon, authenticated;
revoke all on function public.handle_queue_created() from public, anon, authenticated;
revoke all on function public.handle_queue_completion() from public, anon, authenticated;

-- 2) Dokumen persyaratan per layanan (tampil di aplikasi warga, dapat diedit Admin).
alter table public.services add column if not exists requirements text[] not null default '{}';

-- Isi awal hanya bila masih kosong, agar perubahan yang sudah dibuat Admin tidak tertimpa.
-- Sumber: Ditjen Dukcapil Kemendagri, "Syarat dan Prosedur Layanan Pendaftaran Penduduk" (2023) dan Perpres 96/2018
-- untuk KTP-el dan KK. Persyaratan surat domisili berbeda antardaerah; daftar di bawah umum dan perlu dikonfirmasi
-- oleh Kantor Camat Talawi.
update public.services set requirements = array[
  'Fotokopi Kartu Keluarga (KK)',
  'Berusia 17 tahun, atau sudah/pernah menikah (untuk KTP-el pertama kali)',
  'KTP-el hilang: surat keterangan kehilangan dari kepolisian',
  'KTP-el rusak: bawa KTP-el yang rusak',
  'Pemohon hadir langsung untuk perekaman data (foto, sidik jari, tanda tangan)'
] where code = 'KTP' and requirements = '{}';

update public.services set requirements = array[
  'Formulir permohonan F-1.02 (disediakan petugas)',
  'KK baru karena menikah: fotokopi buku nikah atau kutipan akta perkawinan',
  'Perubahan data: KK lama dan surat keterangan/bukti perubahan peristiwa kependudukan atau peristiwa penting',
  'KK hilang: surat keterangan kehilangan dari kepolisian dan fotokopi KTP-el',
  'KK rusak: bawa KK yang rusak dan fotokopi KTP-el'
] where code = 'KK' and requirements = '{}';

update public.services set requirements = array[
  'Fotokopi KTP-el pemohon',
  'Fotokopi Kartu Keluarga (KK)',
  'Surat pengantar RT/RW atau kepala desa, bila diminta kantor',
  'Persyaratan tambahan dapat ditetapkan Kantor Camat Talawi; tanyakan ke petugas'
] where code = 'DOM' and requirements = '{}';
