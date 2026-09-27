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

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ringkasan sistem antrian Kantor Camat Talawi hari ini.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Antrian" value={24} description="Antrian masuk hari ini" icon={Users} />
        <StatCard title="Menunggu" value={8} description="Belum dipanggil" icon={Clock3} />
        <StatCard title="Sedang Dilayani" value={1} description="Sedang berada di loket" icon={PlayCircle} />
        <StatCard title="Selesai" value={14} description="Layanan selesai" icon={CheckCircle2} />
        <StatCard title="Dilewati" value={1} description="Antrian yang dilewati" icon={SkipForward} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <QueueStatus />
        <CurrentQueue />
      </div>
    </div>
  );
}
