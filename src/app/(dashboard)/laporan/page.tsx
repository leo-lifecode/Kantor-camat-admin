"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { CalendarDays, Download, FileText } from "lucide-react";

type ReportRow = { number: string; name: string; service: string; date: string; arrival: string; finish: string; status: string; wait: number };
const data: ReportRow[] = [
  { number: "A-001", name: "Ahmad Fauzi", service: "KTP", date: "2026-10-13", arrival: "08:01:12", finish: "08:14:10", status: "Selesai", wait: 4 },
  { number: "A-002", name: "Siti Rahma", service: "KK", date: "2026-10-13", arrival: "08:05:37", finish: "08:22:20", status: "Selesai", wait: 8 },
  { number: "A-003", name: "Budi Santoso", service: "Surat Domisili", date: "2026-10-13", arrival: "08:08:14", finish: "-", status: "Dilayani", wait: 14 },
  { number: "A-004", name: "Dewi Lestari", service: "KTP", date: "2026-10-13", arrival: "08:12:45", finish: "-", status: "Menunggu", wait: 0 },
  { number: "A-005", name: "Rizky Pratama", service: "KK", date: "2026-10-12", arrival: "09:00:00", finish: "09:20:00", status: "Selesai", wait: 5 },
];

export default function ReportsPage() {
  const [rowsData, setRowsData] = useState<ReportRow[]>(data);
  const [date, setDate] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; });
  const [notice, setNotice] = useState("");
  const databaseMode = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  useEffect(() => {
    if (!databaseMode) return;
    let active = true;
    getSupabaseBrowserClient().from("queues").select("queue_number,status,arrival_time,completion_time,waiting_time,profiles(name),services(name)").order("arrival_time", { ascending: false }).then(({ data: records, error }) => {
      if (!active) return;
      if (error) { setNotice(error.message); return; }
      setRowsData((records ?? []).map(row => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const service = Array.isArray(row.services) ? row.services[0] : row.services;
        const arrival = new Date(row.arrival_time);
        const rowDate = `${arrival.getFullYear()}-${String(arrival.getMonth() + 1).padStart(2, "0")}-${String(arrival.getDate()).padStart(2, "0")}`;
        const time = (value: string | null) => value ? new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "-";
        const status = row.status === "COMPLETED" ? "Selesai" : row.status === "SERVING" ? "Dilayani" : row.status === "CALLED" ? "Dipanggil" : row.status === "SKIPPED" ? "Dilewati" : row.status === "CANCELLED" ? "Dibatalkan" : "Menunggu";
        return { number: row.queue_number, name: profile?.name ?? "Warga", service: service?.name ?? "Layanan", date: rowDate, arrival: time(row.arrival_time), finish: time(row.completion_time), status, wait: Math.floor((row.waiting_time ?? 0) / 60) };
      }));
    });
    return () => { active = false; };
  }, [databaseMode]);
  const rows = useMemo(()=>rowsData.filter(row=>row.date===date),[date, rowsData]);
  // Antrean batal tetap tampil di rincian (riwayat), tetapi tidak masuk total, sama seperti dashboard dan analitik FCFS.
  const countedRows = rows.filter(row=>row.status!=="Dibatalkan");
  const completed = countedRows.filter(row=>row.status==="Selesai").length;
  const exportCsv = () => {
    const csv = [["Nomor","Nama","Layanan","Tanggal","Arrival","Selesai","Status","Waktu Tunggu (menit)"],...rows.map(r=>[r.number,r.name,r.service,r.date,r.arrival,r.finish,r.status,String(r.wait)])].map(row=>row.map(v=>`"${v.replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href=url; link.download=`laporan-antrian-${date}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold text-gray-900">Laporan Antrian</h1><p className="mt-1 text-sm text-gray-500">Rekap antrian berdasarkan tanggal layanan.</p></div><button onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700"><Download size={18}/>Ekspor CSV</button></div>
    {notice && <p role="status" className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm text-purple-800">{notice}</p>}
    <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><CalendarDays size={19} className="text-gray-400"/><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-transparent text-sm outline-none"/></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric title="Total Antrian" value={countedRows.length}/><Metric title="Selesai" value={completed}/><Metric title="Belum Selesai" value={countedRows.length-completed}/></div>
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b px-5 py-4"><FileText size={19} className="text-purple-600"/><h2 className="font-semibold text-gray-900">Rincian Laporan</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead className="border-b bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-5 py-4">Nomor</th><th className="px-5 py-4">Nama</th><th className="px-5 py-4">Layanan</th><th className="px-5 py-4">Waktu Masuk</th><th className="px-5 py-4">Selesai</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Tunggu</th></tr></thead><tbody className="divide-y">{rows.map(r=><tr key={r.number}><td className="px-5 py-4 text-sm font-semibold text-purple-700">{r.number}</td><td className="px-5 py-4 text-sm text-gray-900">{r.name}</td><td className="px-5 py-4 text-sm text-gray-600">{r.service}</td><td className="px-5 py-4 font-mono text-xs text-gray-600">{r.arrival}</td><td className="px-5 py-4 font-mono text-xs text-gray-600">{r.finish}</td><td className="px-5 py-4 text-sm text-gray-600">{r.status}</td><td className="px-5 py-4 text-sm text-gray-600">{r.wait} mnt</td></tr>)}</tbody></table>{rows.length===0&&<p className="p-8 text-center text-sm text-gray-500">Tidak ada data pada tanggal ini.</p>}</div></div><p className="text-xs text-gray-400">{databaseMode ? "Data laporan berasal dari Supabase." : "Data demonstrasi. Atur environment Supabase untuk memuat data operasional."}</p></div>;
}
function Metric({title,value}:{title:string;value:number}) { return <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">{title}</p><p className="mt-2 text-3xl font-bold text-gray-900">{value}</p></div>; }