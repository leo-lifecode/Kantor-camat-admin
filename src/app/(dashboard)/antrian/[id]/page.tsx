"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, PlayCircle, SkipForward, UserRound } from "lucide-react";
import QueueStatusBadge from "@/components/queue/QueueStatusBadge";

const demoQueues = [
  { number: "A-001", name: "Ahmad Fauzi", service: "Pembuatan KTP", status: "COMPLETED" as const, arrival: "13 Oktober 2026, 08:01:12", called: "08:02:00", started: "08:02:15", completed: "08:09:10", serviceDuration: "00:06:55", waitingTime: "00:00:48" },
  { number: "A-002", name: "Siti Rahma", service: "Kartu Keluarga", status: "COMPLETED" as const, arrival: "13 Oktober 2026, 08:05:37", called: "08:09:12", started: "08:09:25", completed: "08:18:30", serviceDuration: "00:09:05", waitingTime: "00:03:35" },
  { number: "A-003", name: "Budi Santoso", service: "Surat Domisili", status: "SERVING" as const, arrival: "13 Oktober 2026, 08:08:14", called: "08:21:03", started: "08:22:10", completed: "-", serviceDuration: "00:04:32", waitingTime: "00:13:56" },
  { number: "A-004", name: "Dewi Lestari", service: "Pembuatan KTP", status: "WAITING" as const, arrival: "13 Oktober 2026, 08:12:45", called: "-", started: "-", completed: "-", serviceDuration: "-", waitingTime: "-" },
  { number: "A-005", name: "Rizky Pratama", service: "Kartu Keluarga", status: "WAITING" as const, arrival: "13 Oktober 2026, 08:16:20", called: "-", started: "-", completed: "-", serviceDuration: "-", waitingTime: "-" },
  { number: "A-006", name: "Nur Aisyah", service: "Pembuatan KTP", status: "WAITING" as const, arrival: "13 Oktober 2026, 08:20:11", called: "-", started: "-", completed: "-", serviceDuration: "-", waitingTime: "-" },
];

type Status = "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED";

export default function QueueDetailPage() {
  const params = useParams<{ id: string }>();
  const queueNumber = decodeURIComponent(params.id ?? "A-003");
  const initialQueue = demoQueues.find((item) => item.number === queueNumber) ?? demoQueues[2];
  const [status, setStatus] = useState<Status>(initialQueue.status);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function changeStatus(next: Status) {
    setBusy(true);
    setNotice("");
    // Demo mode: actions update the sample state locally until Supabase is configured.
    setStatus(next);
    setNotice(next === "CALLED" ? "Antrian dipanggil (mode demo)." : next === "SERVING" ? "Antrian ditandai mulai dilayani (mode demo)." : next === "COMPLETED" ? "Antrian ditandai selesai (mode demo)." : "Antrian dilewati (mode demo).");
    setBusy(false);
  }

  const queue = { ...initialQueue, status };

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
        <h2 className="font-semibold text-gray-900">Aksi Antrian</h2><p className="mt-1 text-sm text-gray-500">Mode demo: perubahan status hanya tersimpan selama halaman terbuka.</p>
        {notice && <p role="status" className="mt-4 rounded-xl bg-purple-50 p-3 text-sm text-purple-800">{notice}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button disabled={busy || status !== "WAITING"} onClick={() => changeStatus("CALLED")} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"><Clock3 size={18} />Panggil Antrian</button>
          <button disabled={busy || status !== "CALLED"} onClick={() => changeStatus("SERVING")} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"><PlayCircle size={18} />Mulai Dilayani</button>
          <button disabled={busy || status !== "SERVING"} onClick={() => changeStatus("COMPLETED")} className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={18} />Selesaikan</button>
          <button disabled={busy || !["WAITING", "CALLED"].includes(status)} onClick={() => changeStatus("SKIPPED")} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"><SkipForward size={18} />Lewati</button>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="flex items-center gap-3"><span className="text-gray-400">{icon}</span><div><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-semibold text-gray-900">{value}</p></div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-sm font-semibold text-gray-900">{value}</p></div>;
}
