"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { BarChart3, Clock3, ListOrdered, Timer } from "lucide-react";

type AnalyticsRecord = { number: string; name: string; arrival: string; start: string; finish: string; wait: number; service: number; status: string; day: string };
const records: AnalyticsRecord[] = [
  { number: "A-001", name: "Ahmad Fauzi", arrival: "08:01:12", start: "08:05:12", finish: "08:14:10", wait: 4, service: 9, status: "COMPLETED", day: "2026-10-14" },
  { number: "A-002", name: "Siti Rahma", arrival: "08:05:37", start: "08:14:10", finish: "08:22:20", wait: 8, service: 8, status: "COMPLETED", day: "2026-10-14" },
  { number: "A-003", name: "Budi Santoso", arrival: "08:08:14", start: "08:22:20", finish: "-", wait: 14, service: 0, status: "SERVING", day: "2026-10-14" },
  { number: "A-004", name: "Dewi Lestari", arrival: "08:12:45", start: "-", finish: "-", wait: 0, service: 0, status: "WAITING", day: "2026-10-14" },
  { number: "A-005", name: "Rizky Pratama", arrival: "09:00:00", start: "09:05:00", finish: "09:20:00", wait: 5, service: 15, status: "COMPLETED", day: "2026-10-12" },
];

// ---- Simulasi FCFS berorientasi event (10 tiket; 8 pertama = skenario Bab IV, 2 terakhir tambahan) ----
const SIM_START = "08:00:00";
const simInput = [
  { number: "A-0001", at: "08:00:12", bt: 870 }, { number: "A-0002", at: "08:04:37", bt: 555 },
  { number: "A-0003", at: "08:09:05", bt: 1300 }, { number: "A-0004", at: "08:12:48", bt: 910 },
  { number: "A-0005", at: "09:20:10", bt: 600 }, { number: "A-0006", at: "09:23:30", bt: 1185 },
  { number: "A-0007", at: "09:26:02", bt: 800 }, { number: "A-0008", at: "09:28:44", bt: 530 },
  { number: "A-0009", at: "09:31:20", bt: 700 }, { number: "A-0010", at: "09:35:00", bt: 480 },
];
const toSec = (c: string) => { const [h, m, s] = c.split(":").map(Number); return h * 3600 + m * 60 + s; };
const toClock = (n: number) => `${String(Math.floor(n / 3600)).padStart(2, "0")}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const fmtNum = (n: number) => n.toLocaleString("id-ID");
type SimRow = { no: number; number: string; at: number; bt: number; st: number; ct: number; wt: number; tat: number };
type SimEvent = { time: number; ticket: string; type: "Mulai" | "Datang" | "Keluar"; queue: number; system: number; busy: boolean; idle?: number };
function runFcfsSimulation() {
  // FCFS: urut berdasarkan AT; STᵢ = max(ATᵢ, CTᵢ₋₁); CTᵢ = STᵢ + BTᵢ; WTᵢ = STᵢ − ATᵢ
  let prevCt = 0;
  const rows: SimRow[] = [...simInput].sort((a, b) => toSec(a.at) - toSec(b.at)).map((r, i) => {
    const at = toSec(r.at);
    const st = i === 0 ? at : Math.max(at, prevCt);
    const ct = st + r.bt;
    prevCt = ct;
    return { no: i + 1, number: r.number, at, bt: r.bt, st, ct, wt: st - at, tat: ct - at };
  });
  // Event-driven: setiap tiket menghasilkan event Datang (AT) dan Keluar (CT); status dihitung ulang tiap event.
  const raw = rows.flatMap(r => [{ time: r.at, type: "Datang" as const, r }, { time: r.ct, type: "Keluar" as const, r }])
    .sort((a, b) => a.time - b.time || (a.type === "Keluar" ? -1 : 1) - (b.type === "Keluar" ? -1 : 1));
  const events: SimEvent[] = [{ time: toSec(SIM_START), ticket: "-", type: "Mulai", queue: 0, system: 0, busy: false }];
  let inSystem = 0; let lastFree = toSec(SIM_START);
  for (const ev of raw) {
    const wasBusy = inSystem > 0;
    inSystem += ev.type === "Datang" ? 1 : -1;
    const busy = inSystem > 0;
    const idle = !wasBusy && busy ? ev.time - lastFree : undefined; // lama loket menganggur sebelum sibuk lagi
    if (wasBusy && !busy) lastFree = ev.time;
    events.push({ time: ev.time, ticket: ev.r.number, type: ev.type, queue: Math.max(inSystem - 1, 0), system: inSystem, busy, idle });
  }
  const n = rows.length;
  const sumWt = rows.reduce((a, r) => a + r.wt, 0);
  const sumTat = rows.reduce((a, r) => a + r.tat, 0);
  const sumBt = rows.reduce((a, r) => a + r.bt, 0);
  const span = rows[n - 1].ct - rows[0].st;
  return { rows, events, sumWt, sumTat, sumBt, span, awt: sumWt / n, atat: sumTat / n, utilization: (sumBt / span) * 100 };
}
const simulation = runFcfsSimulation();

export default function FCFSAnalyticsPage() {
  const [period, setPeriod] = useState("today");
  const [recordsData, setRecordsData] = useState<AnalyticsRecord[]>(records);
  const [notice, setNotice] = useState("");
  const databaseMode = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  useEffect(() => {
    if (!databaseMode) return;
    let active = true;
    getSupabaseBrowserClient().from("queues").select("queue_number,status,arrival_time,called_time,start_service_time,completion_time,waiting_time,service_duration,profiles(name)").order("arrival_time", { ascending: true }).then(({ data, error }) => {
      if (!active) return;
      if (error) { setNotice(error.message); return; }
      setRecordsData((data ?? []).map(row => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const arrivalDate = new Date(row.arrival_time);
        const day = `${arrivalDate.getFullYear()}-${String(arrivalDate.getMonth() + 1).padStart(2, "0")}-${String(arrivalDate.getDate()).padStart(2, "0")}`;
        const time = (value: string | null) => value ? new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "-";
        return { number: row.queue_number, name: profile?.name ?? "Warga", arrival: time(row.arrival_time), start: time(row.start_service_time), finish: time(row.completion_time), wait: Math.floor((row.waiting_time ?? 0) / 60), service: Math.floor((row.service_duration ?? 0) / 60), status: row.status, day };
      }));
    });
    return () => { active = false; };
  }, [databaseMode]);
  // "Sekarang" baru diketahui setelah mount; menghitungnya saat render membuat HTML statis (tanggal build)
  // berbeda dari browser dan memicu error hidrasi React #418.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  const rows = useMemo(() => {
    if (!now) return [];
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - 6);
    const weekStart = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, "0")}-${String(weekStartDate.getDate()).padStart(2, "0")}`;
    const monthStart = today.slice(0, 7);
    return recordsData.filter(row => period === "all" || (period === "today" && row.day === today) || (period === "week" && row.day >= weekStart && row.day <= today) || (period === "month" && row.day.startsWith(monthStart)));
  }, [period, recordsData, now]);

  // CANCELLED remains stored for history/audit, but is excluded from FCFS calculations.
  const fcfsRows = rows.filter(row => row.status !== "CANCELLED");
  const done = fcfsRows.filter(row => row.status === "COMPLETED");
  const averageWait = done.length ? (done.reduce((sum, row) => sum + row.wait, 0) / done.length).toFixed(1) : "0";
  const averageService = done.length ? (done.reduce((sum, row) => sum + row.service, 0) / done.length).toFixed(1) : "0";

  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold text-gray-900">Analitik FCFS</h1><p className="mt-1 text-sm text-gray-500">Evaluasi urutan pelayanan berdasarkan waktu kedatangan.</p></div><select value={period} onChange={e=>setPeriod(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"><option value="today">Hari Ini</option><option value="week">Minggu Ini</option><option value="month">Bulan Ini</option><option value="all">Semua Data</option></select></div>
    {notice && <p role="status" className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm text-purple-800">{notice}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Total Antrian FCFS" value={fcfsRows.length} icon={<ListOrdered size={20}/>} /><Metric title="Selesai" value={done.length} icon={<BarChart3 size={20}/>} /><Metric title="Rata-rata Waktu Tunggu" value={averageWait+" menit"} icon={<Clock3 size={20}/>} /><Metric title="Rata-rata Durasi Layanan" value={averageService+" menit"} icon={<Timer size={20}/>} /></div>
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="font-semibold text-gray-900">Alur Pemrosesan FCFS</h2><div className="mt-5 grid gap-3 md:grid-cols-4">{[{n:"01",title:"Input Timestamp",desc:"Catat arrival_time dari server/database."},{n:"02",title:"Sorting",desc:"Urutkan waktu masuk paling awal terlebih dahulu."},{n:"03",title:"Eksekusi",desc:"Loket memproses satu antrian pada satu waktu."},{n:"04",title:"Pembaruan Status",desc:"WAITING → CALLED → SERVING → COMPLETED. CANCELLED dikeluarkan dari antrean FCFS."}].map(s=><div key={s.n} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs font-bold text-purple-600">{s.n}</p><h3 className="mt-2 text-sm font-semibold text-gray-900">{s.title}</h3><p className="mt-2 text-xs leading-5 text-gray-500">{s.desc}</p></div>)}</div></section>
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="font-semibold text-gray-900">Rumus FCFS</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Formula name="Start Time (STᵢ)" formula="STᵢ = max(ATᵢ, CTᵢ₋₁)" note="Waktu mulai adalah nilai terbesar antara waktu kedatangan dan selesai sebelumnya."/><Formula name="Completion Time (CTᵢ)" formula="CTᵢ = STᵢ + BTᵢ" note="Waktu selesai = waktu mulai + durasi layanan."/><Formula name="Waiting Time (WTᵢ)" formula="WTᵢ = STᵢ − ATᵢ" note="Selisih waktu mulai dilayani dengan waktu kedatangan."/><Formula name="Average Waiting Time" formula="AWT = Σ WTᵢ / n" note="Rata-rata waktu tunggu untuk n antrian yang dihitung." /></div><p className="mt-4 text-xs text-gray-400">AT = Arrival Time, BT = Burst/Service Time, CT = Completion Time. Antrian pertama menggunakan ST₁ = AT₁.</p></section>
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold text-gray-900">Urutan Eksekusi</h2><p className="mt-1 text-xs text-gray-500">Data dibatasi pada antrean yang masuk perhitungan FCFS; antrean batal tidak ditampilkan sebagai antrean aktif.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="border-b bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-5 py-4">Urutan</th><th className="px-5 py-4">Nomor</th><th className="px-5 py-4">Warga</th><th className="px-5 py-4">Arrival</th><th className="px-5 py-4">Mulai</th><th className="px-5 py-4">Waktu Keluar</th><th className="px-5 py-4">Tunggu</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y">{[...fcfsRows].sort((a,b)=>a.day.localeCompare(b.day) || a.arrival.localeCompare(b.arrival)).map((r,i)=><tr key={r.number}><td className="px-5 py-4 text-sm text-gray-500">{i+1}</td><td className="px-5 py-4 text-sm font-semibold text-purple-700">{r.number}</td><td className="px-5 py-4 text-sm text-gray-900">{r.name}</td><td className="px-5 py-4 font-mono text-xs text-gray-600">{r.arrival}</td><td className="px-5 py-4 font-mono text-xs text-gray-600">{r.start}</td><td className="px-5 py-4 font-mono text-xs text-gray-600">{r.finish}</td><td className="px-5 py-4 text-sm text-gray-600">{r.wait} menit</td><td className="px-5 py-4 text-xs font-medium text-gray-600">{r.status}</td></tr>)}</tbody></table></div></section>
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold text-gray-900">Simulasi FCFS: Tabel Perhitungan (10 Data)</h2><p className="mt-1 text-xs text-gray-500">Satuan detik; jam dalam format JJ:MM:DD. Skenario Bab IV (A-0001 s.d. A-0008) ditambah dua tiket (A-0009, A-0010).</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="border-b bg-gray-50 text-xs uppercase text-gray-500"><tr>{["No","Tiket","Arrival (AT)","Layanan (BT)","Start (ST)","Waktu Keluar (CT)","Tunggu (WT)","Turnaround (TAT)"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{simulation.rows.map(r=><tr key={r.number}><td className="px-4 py-3 text-sm text-gray-500">{r.no}</td><td className="px-4 py-3 text-sm font-semibold text-purple-700">{r.number}</td><td className="px-4 py-3 font-mono text-xs text-gray-600">{toClock(r.at)}</td><td className="px-4 py-3 text-sm text-gray-600">{fmtNum(r.bt)}</td><td className="px-4 py-3 font-mono text-xs text-gray-600">{toClock(r.st)}</td><td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">{toClock(r.ct)}</td><td className="px-4 py-3 text-sm text-gray-600">{fmtNum(r.wt)}</td><td className="px-4 py-3 text-sm text-gray-600">{fmtNum(r.tat)}</td></tr>)}</tbody><tfoot className="border-t bg-purple-50 text-sm font-semibold text-purple-900"><tr><td className="px-4 py-3" colSpan={6}>Total / Rata-rata</td><td className="px-4 py-3">ΣWT = {fmtNum(simulation.sumWt)}<br/><span className="text-xs font-normal">AWT = {simulation.awt.toLocaleString("id-ID",{maximumFractionDigits:2})} dtk</span></td><td className="px-4 py-3">ΣTAT = {fmtNum(simulation.sumTat)}<br/><span className="text-xs font-normal">ATAT = {simulation.atat.toLocaleString("id-ID",{maximumFractionDigits:2})} dtk</span></td></tr></tfoot></table></div><p className="border-t px-5 py-3 text-xs text-gray-500">Utilisasi loket = ΣBT / (CT<sub>n</sub> − ST₁) = {fmtNum(simulation.sumBt)} / {fmtNum(simulation.span)} = {simulation.utilization.toLocaleString("id-ID",{maximumFractionDigits:2})}%</p></section>
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold text-gray-900">Simulasi FCFS Berorientasi Event</h2><p className="mt-1 text-xs text-gray-500">Setiap tiket menghasilkan event Datang (saat AT) dan Keluar (saat CT). Kondisi sistem diperbarui pada setiap event.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="border-b bg-gray-50 text-xs uppercase text-gray-500"><tr>{["Waktu Datang / Keluar","Tiket ke","Tipe Kejadian","Tiket di Antrian","Tiket di Sistem","Status Loket","Loket Menganggur (dtk)"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{simulation.events.map((e,i)=><tr key={i}><td className="px-4 py-3 font-mono text-xs text-gray-600">{toClock(e.time)}</td><td className="px-4 py-3 text-sm font-semibold text-purple-700">{e.ticket}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${e.type==="Datang"?"bg-blue-50 text-blue-700":e.type==="Keluar"?"bg-green-50 text-green-700":"bg-gray-100 text-gray-600"}`}>{e.type}</span></td><td className="px-4 py-3 text-sm text-gray-600">{e.queue}</td><td className="px-4 py-3 text-sm text-gray-600">{e.system}</td><td className={`px-4 py-3 text-sm font-medium ${e.busy?"text-amber-600":"text-gray-500"}`}>{e.busy?"Sibuk":"Menganggur"}</td><td className="px-4 py-3 text-sm text-gray-600">{e.idle===undefined?"":fmtNum(e.idle)}</td></tr>)}</tbody></table></div></section>
    <p className="text-xs text-gray-400">{databaseMode ? "Data berasal dari Supabase. Antrean CANCELLED tidak masuk total FCFS atau rata-rata waktu layanan." : "Data demonstrasi. Atur environment Supabase untuk menghitung analitik dari data operasional."}</p>
  </div>;
}
function Metric({title,value,icon}:{title:string;value:string|number;icon:React.ReactNode}) { return <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm text-gray-500">{title}</p><span className="text-purple-600">{icon}</span></div><p className="mt-3 text-2xl font-bold text-gray-900">{value}</p></div>; }
function Formula({name,formula,note}:{name:string;formula:string;note:string}) { return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs font-medium text-gray-500">{name}</p><p className="mt-2 font-mono text-lg font-semibold text-purple-700">{formula}</p><p className="mt-2 text-xs leading-5 text-gray-500">{note}</p></div>; }