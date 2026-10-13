"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, PlayCircle, SkipForward, UserRound } from "lucide-react";
import QueueStatusBadge from "@/components/queue/QueueStatusBadge";

const queue = {
  number: "A-003",
  name: "Budi Santoso",
  service: "Surat Domisili",
  status: "SERVING" as const,
  arrival: "13 Oktober 2026, 08:08:14",
  called: "13 Oktober 2026, 08:21:03",
  started: "13 Oktober 2026, 08:22:10",
  completed: "-",
  serviceDuration: "00:04:32",
  waitingTime: "00:13:56",
};

export default function QueueDetailPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/antrian" className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-600 hover:bg-gray-50"><ArrowLeft size={19} /></Link>
        <div><h1 className="text-2xl font-bold text-gray-900">Detail Antrian</h1><p className="mt-1 text-sm text-gray-500">Informasi proses antrian dan timestamp FCFS.</p></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Nomor Antrian</p><p className="mt-2 text-5xl font-bold text-purple-700">{queue.number}</p>
          <div className="mt-5"><QueueStatusBadge status={queue.status} /></div>
          <div className="mt-6 space-y-4 border-t pt-5">
            <Info label="Nama Warga" value={queue.name} icon={<UserRound size={19} />} />
            <Info label="Layanan" value={queue.service} icon={<Clock3 size={19} />} />
          </div>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b px-6 py-5"><h2 className="font-semibold text-gray-900">Timeline Antrian</h2><p className="mt-1 text-xs text-gray-500">Timestamp server menjadi dasar perhitungan FCFS.</p></div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <Metric label="Arrival Time" value={queue.arrival} /><Metric label="Called Time" value={queue.called} /><Metric label="Start Service" value={queue.started} /><Metric label="Completion Time" value={queue.completed} /><Metric label="Service Duration" value={queue.serviceDuration} /><Metric label="Waiting Time" value={queue.waitingTime} />
          </div>
        </section>
      </div>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">Aksi Antrian</h2><p className="mt-1 text-sm text-gray-500">Tombol berikut masih berupa UI. Aksi produksi harus terhubung ke transaksi backend.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700"><PlayCircle size={18} />Mulai Dilayani</button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 hover:bg-green-100"><CheckCircle2 size={18} />Selesaikan</button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"><SkipForward size={18} />Lewati</button>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="flex items-center gap-3">{<span className="text-gray-400">{icon}</span>}<div><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-semibold text-gray-900">{value}</p></div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-sm font-semibold text-gray-900">{value}</p></div>;
}
