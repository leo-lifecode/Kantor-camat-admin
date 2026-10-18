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
  const { queues, dataMode } = useDemoQueues();
  // Cancelled tickets are retained in history, but do not count as active/system queue totals.
  const countedQueues = queues.filter(queue => queue.status !== "CANCELLED");
  const waiting = queues.filter(queue => queue.status === "WAITING").length;
  const active = queues.find(queue => queue.status === "SERVING");
  const completed = queues.filter(queue => queue.status === "COMPLETED").length;
  const skipped = queues.filter(queue => queue.status === "SKIPPED").length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ringkasan sistem antrian Kantor Camat Talawi hari ini.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Antrian" value={countedQueues.length} description={dataMode === "supabase" ? "Data database, tidak termasuk antrean batal" : "Data contoh"} icon={Users} />
        <StatCard title="Menunggu" value={waiting} description="Belum dipanggil" icon={Clock3} />
        <StatCard title="Sedang Dilayani" value={active ? 1 : 0} description={active ? `Nomor ${active.number}` : "Tidak ada yang dilayani"} icon={PlayCircle} />
        <StatCard title="Selesai" value={completed} description="Antrian selesai" icon={CheckCircle2} />
        <StatCard title="Dilewati" value={skipped} description="Antrian dilewati" icon={SkipForward} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <QueueStatus />
        <CurrentQueue />
      </div>
    </div>
  );
}
