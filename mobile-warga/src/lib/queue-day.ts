// Hari antrean dihitung menurut waktu kantor, sama dengan fungsi expire_stale_queues() dan create_queue()
// di database (supabase/queue_lifecycle_hardening.sql, zona 'Asia/Jakarta' = WIB = UTC+7, tanpa DST).
// Bila kantor berada di WITA (8) atau WIT (9), ubah nilai ini dan zona waktu di SQL tersebut bersamaan.
export const OFFICE_UTC_OFFSET_HOURS = 7;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Awal hari ini menurut waktu kantor, dalam milidetik epoch. */
export function officeDayStartMs(now: Date = new Date()): number {
  const offset = OFFICE_UTC_OFFSET_HOURS * HOUR_MS;
  return Math.floor((now.getTime() + offset) / DAY_MS) * DAY_MS - offset;
}

/**
 * Tiket WAITING/CALLED dari hari sebelumnya sudah tidak berlaku: database melewatinya (SKIPPED) saat petugas
 * membuka dashboard atau saat warga mengambil nomor baru. Aplikasi tidak lagi menampilkannya sebagai antrean
 * aktif sehingga warga bisa langsung mengambil nomor baru. SERVING tetap dianggap aktif sampai petugas
 * menyelesaikannya, sama seperti di database.
 */
export function isExpiredTicket(ticket: { status: string; arrival_time: string }, now: Date = new Date()): boolean {
  if (ticket.status === "SERVING") return false;
  const arrival = Date.parse(ticket.arrival_time);
  return Number.isFinite(arrival) && arrival < officeDayStartMs(now);
}
