-- Pemeriksaan integritas antrean dan status penerapan SQL. HANYA MEMBACA: tidak mengubah data, fungsi,
-- kebijakan, maupun hak akses. Aman dijalankan kapan saja dan berulang kali di Supabase SQL Editor.
--
-- Hasilnya satu tabel dengan kolom "hasil":
--   OK                sesuai harapan
--   BELUM             berkas SQL yang disebut pada kolom "keterangan" belum dijalankan
--   PERLU DIPERBAIKI  ada data atau definisi fungsi yang menyimpang dan perlu dibereskan
--   INFO              informasi saja, tidak perlu tindakan
--
-- Riwayat: berkas ini dulu berisi migrasi create_queue dengan format nomor berbeda (KODE-YYMMDD-0001)
-- yang bertentangan dengan security_hardening.sql (format A-0001, nomor berlanjut lintas hari) dan
-- tidak ada di urutan resmi pada README. Isinya sudah digantikan oleh security_hardening.sql (sequence,
-- indeks satu-antrean-aktif, create_queue) dan queue_lifecycle_hardening.sql. Sekarang berkas ini hanya
-- pemeriksa, sehingga menjalankannya tidak akan mengubah nomor antrean.
--
-- Catatan: "hari" dihitung menurut Asia/Jakarta (WIB), sama dengan queue_lifecycle_hardening.sql.

with
  office as (
    select date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta' as today_start
  ),
  fn as (
    select
      pg_get_functiondef(to_regprocedure('public.create_queue(uuid)')) as create_queue_def,
      pg_get_functiondef(to_regprocedure('public.call_next_queue()')) as call_next_def,
      to_regprocedure('public.expire_stale_queues()') is not null as has_expire
  ),
  stats as (
    select
      (select count(*) from (
         select user_id from public.queues
         where status in ('WAITING', 'CALLED', 'SERVING')
         group by user_id having count(*) > 1
       ) d)::int as users_with_many_active,
      (select count(*) from public.queues where status in ('CALLED', 'SERVING'))::int as at_counter,
      (select count(*) from public.queues, office
         where status in ('WAITING', 'CALLED') and arrival_time < office.today_start)::int as stale_waiting_called,
      (select count(*) from public.queues, office
         where status = 'SERVING' and arrival_time < office.today_start)::int as stale_serving
  ),
  checks(nomor, pemeriksaan, hasil, keterangan) as (
    -- Data antrean --------------------------------------------------------------------------------
    select 1, 'Satu antrean aktif per warga',
      case when users_with_many_active = 0 then 'OK' else 'PERLU DIPERBAIKI' end,
      case when users_with_many_active = 0
        then 'Tidak ada warga dengan lebih dari satu antrean WAITING/CALLED/SERVING.'
        else users_with_many_active || ' warga punya lebih dari satu antrean aktif. Selesaikan atau batalkan duplikatnya, lalu jalankan security_hardening.sql.' end
    from stats
    union all
    select 2, 'Loket tunggal',
      case when at_counter <= 1 then 'OK' else 'PERLU DIPERBAIKI' end,
      case when at_counter <= 1
        then 'Paling banyak satu antrean berstatus CALLED/SERVING.'
        else at_counter || ' antrean berstatus CALLED/SERVING bersamaan. Selesaikan atau lewati yang tidak seharusnya aktif.' end
    from stats
    union all
    select 3, 'Antrean WAITING/CALLED dari hari sebelumnya',
      case when stale_waiting_called = 0 then 'OK' else 'INFO' end,
      case when stale_waiting_called = 0
        then 'Tidak ada.'
        else stale_waiting_called || ' antrean akan dilewati otomatis saat petugas membuka dashboard atau memanggil antrean berikutnya (perlu queue_lifecycle_hardening.sql).' end
    from stats
    union all
    select 4, 'Antrean SERVING dari hari sebelumnya',
      case when stale_serving = 0 then 'OK' else 'PERLU DIPERBAIKI' end,
      case when stale_serving = 0
        then 'Tidak ada.'
        else stale_serving || ' antrean masih SERVING dari hari lalu dan memblokir loket. Petugas harus menekan Selesaikan di dashboard.' end
    from stats
    union all
    -- Status penerapan SQL --------------------------------------------------------------------------
    select 5, 'Indeks satu antrean aktif per warga',
      case when exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'queues_one_active_per_user_idx')
        then 'OK' else 'BELUM' end,
      'security_hardening.sql'
    union all
    select 6, 'create_queue memakai nomor A-0001 (tanpa reset harian)',
      case when create_queue_def is null then 'BELUM'
           when create_queue_def like '%''A-''%' and create_queue_def like '%queue_number_seq%' then 'OK'
           else 'PERLU DIPERBAIKI' end,
      case when create_queue_def is null then 'security_hardening.sql'
           when create_queue_def like '%''A-''%' and create_queue_def like '%queue_number_seq%' then 'Format sesuai security_hardening.sql.'
           else 'Definisi create_queue berbeda (mis. dari queue_integrity.sql lama). Jalankan ulang security_hardening.sql, lalu queue_lifecycle_hardening.sql.' end
    from fn
    union all
    select 7, 'Kedaluwarsa antrean harian',
      case when has_expire
             and coalesce(call_next_def, '') like '%expire_stale_queues%'
             and coalesce(create_queue_def, '') like '%''SKIPPED''%'
        then 'OK' else 'BELUM' end,
      'queue_lifecycle_hardening.sql'
    from fn
    union all
    select 8, 'Klien tidak bisa menulis langsung ke tabel queues',
      case when not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'queues' and policyname = 'admin update queues')
             and not has_table_privilege('authenticated', 'public.queues', 'INSERT')
             and not has_table_privilege('authenticated', 'public.queues', 'UPDATE')
             and not has_table_privilege('authenticated', 'public.queues', 'DELETE')
             and not has_table_privilege('anon', 'public.queues', 'SELECT')
        then 'OK' else 'BELUM' end,
      'queue_lifecycle_hardening.sql'
    union all
    select 9, 'Pengguna belum login (anon) tidak bisa menjalankan RPC antrean',
      case when not coalesce((
        select bool_or(has_function_privilege('anon', f.proc, 'EXECUTE'))
        from (values
          (to_regprocedure('public.create_queue(uuid)')),
          (to_regprocedure('public.cancel_own_queue(uuid)')),
          (to_regprocedure('public.call_next_queue()')),
          (to_regprocedure('public.start_queue_service(uuid)')),
          (to_regprocedure('public.complete_queue_service(uuid)')),
          (to_regprocedure('public.skip_queue(uuid)')),
          (to_regprocedure('public.expire_stale_queues()'))
        ) as f(proc)
        where f.proc is not null
      ), false) then 'OK' else 'BELUM' end,
      'revoke_anon_rpc.sql (dan queue_lifecycle_hardening.sql untuk expire_stale_queues)'
    union all
    select 10, 'Indeks dan kebijakan RLS performa',
      case when (select count(*) from pg_indexes where schemaname = 'public' and indexname in (
                   'announcements_created_by_idx', 'device_tokens_user_id_idx', 'notifications_queue_id_idx',
                   'notifications_user_id_idx', 'queues_service_id_idx')) = 5
             and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'services' and policyname = 'services admin insert')
        then 'OK' else 'BELUM' end,
      'performance_tuning.sql'
  )
select nomor, pemeriksaan, hasil, keterangan
from checks
order by nomor;
