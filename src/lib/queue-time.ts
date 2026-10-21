// Fungsi waktu murni untuk halaman antrian.
// Kantor Camat Talawi berada di WIB. Hari antrian dihitung menurut WIB, sama dengan expire_stale_queues()
// di database, sehingga hasilnya tidak bergantung pada zona waktu browser.

export const OFFICE_TIME_ZONE = "Asia/Jakarta";

/** Tanggal YYYY-MM-DD menurut waktu kantor (WIB). */
export function officeDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OFFICE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** Jam HH.MM.SS menurut waktu kantor (WIB); undefined bila kosong atau bukan tanggal valid. */
export function officeTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString("id-ID", {
    timeZone: OFFICE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function clockToSeconds(value?: string): number | undefined {
  const match = value?.match(/^(\d{1,2})[:.](\d{2})[:.](\d{2})$/);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : undefined;
}

/**
 * Selisih detik antara dua jam "HH:MM:SS" atau "HH.MM.SS" pada hari yang sama.
 * undefined bila salah satunya kosong/tidak valid atau hasilnya negatif.
 */
export function secondsBetween(from?: string, to?: string): number | undefined {
  const start = clockToSeconds(from);
  const end = clockToSeconds(to);
  if (start === undefined || end === undefined || end < start) return undefined;
  return end - start;
}

/** 45 -> "45 dtk", 125 -> "2 mnt 5 dtk", 3725 -> "1 j 2 mnt". Nilai kosong atau tidak valid -> "-". */
export function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds) || seconds < 0) return "-";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) return minutes > 0 ? `${hours} j ${minutes} mnt` : `${hours} j`;
  if (minutes > 0) return rest > 0 ? `${minutes} mnt ${rest} dtk` : `${minutes} mnt`;
  return `${rest} dtk`;
}
