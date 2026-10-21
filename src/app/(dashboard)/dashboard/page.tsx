"use client";

import {
  Users,
  Clock3,
  PlayCircle,
  CheckCircle2,
  SkipForward,
} from "lucide-react";

import StatCard from "@/components/dashboard/StatCard";
import QueueStatus from "@/components/dashboard/QueueStatus";
import CurrentQueue from "@/components/dashboard/CurrentQueue";
import { useDemoQueues } from "@/components/demo/DemoQueueProvider";

export default function DashboardPage() {
  const { queues, dataMode, ready, today } = useDemoQueues();
  const loading = !ready || (dataMode === "supabase" && !today);
  // Total, Selesai, dan Dilewati adalah hitungan HARI INI (WIB). Di mode database, antrian hari lalu tetap ada
  // di halaman Antrian dan Laporan tetapi tidak ikut dihitung di sini. Mode demo memakai seluruh data contoh.
  const todays = dataMode === "supabase" ? queues.filter(queue => queue.date === today) : queues;
  // Cancelled tickets are retained in history, but do not count as active/system queue totals.
  const countedQueues = todays.filter(queue => queue.status !== "CANCELLED");
  const completed = todays.filter(queue => queue.status === "COMPLETED").length;
  const skipped = todays.filter(queue => queue.status === "SKIPPED").length;
  // Menunggu dan Sedang Dilayani adalah keadaan loket saat ini, jadi memakai semua antrian aktif.
  const waiting = queues.filter(queue => queue.status === "WAITING").length;
  const active = queues.find(queue => queue.status === "SERVING");
  const show = (count: number) => (loading ? "—" : count);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ringkasan sistem antrian Kantor Camat Talawi hari ini.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Antrian" value={show(countedQueues.length)} description={loading ? "Memuat data…" : dataMode === "supabase" ? "Hari ini, tidak termasuk antrean batal" : "Data contoh"} icon={Users} />
        <StatCard title="Menunggu" value={show(waiting)} description="Belum dipanggil" icon={Clock3} />
        <StatCard title="Sedang Dilayani" value={show(active ? 1 : 0)} description={active ? `Nomor ${active.number}` : "Tidak ada yang dilayani"} icon={PlayCircle} />
        <StatCard title="Selesai" value={show(completed)} description={dataMode === "supabase" ? "Selesai hari ini" : "Antrian selesai"} icon={CheckCircle2} />
        <StatCard title="Dilewati" value={show(skipped)} description={dataMode === "supabase" ? "Dilewati hari ini" : "Antrian dilewati"} icon={SkipForward} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <QueueStatus />
        <CurrentQueue />
      </div>
    </div>
  );
}
