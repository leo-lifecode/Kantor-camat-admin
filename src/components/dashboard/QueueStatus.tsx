import { Clock3 } from "lucide-react";

const queues = [
  { number: "A-004", service: "Pembuatan KTP", status: "Menunggu", time: "08:12:45" },
  { number: "A-005", service: "Kartu Keluarga", status: "Menunggu", time: "08:16:20" },
  { number: "A-006", service: "Pembuatan KTP", status: "Menunggu", time: "08:20:11" },
];

export default function QueueStatus() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="font-semibold text-gray-900">Antrian Menunggu</h2>
          <p className="mt-1 text-xs text-gray-500">Urutan berdasarkan arrival timestamp, data contoh</p>
        </div>
        <Clock3 size={20} className="text-gray-400" />
      </div>
      <div className="divide-y">
        {queues.map((queue) => (
          <div key={queue.number} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-16 items-center justify-center rounded-xl bg-purple-50 text-sm font-bold text-purple-700">{queue.number}</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{queue.service}</p>
                <p className="text-xs text-gray-500">Masuk {queue.time}</p>
              </div>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">{queue.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
