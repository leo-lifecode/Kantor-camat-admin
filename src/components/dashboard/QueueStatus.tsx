"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import { useDemoQueues } from "@/components/demo/DemoQueueProvider";

export default function QueueStatus() {
  const { queues, ready } = useDemoQueues();
  const waiting = queues.filter((queue) => queue.status === "WAITING").sort((a, b) => a.date.localeCompare(b.date) || a.arrival.localeCompare(b.arrival) || a.number.localeCompare(b.number));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div><h2 className="font-semibold text-gray-900">Antrian Menunggu</h2><p className="mt-1 text-xs text-gray-500">Urutan berdasarkan arrival timestamp · {waiting.length} warga</p></div>
        <Clock3 size={20} className="text-gray-400" />
      </div>
      <div className="divide-y">
        {waiting.map((queue) => (
          <Link href={`/antrian/${queue.number}`} key={queue.number} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
            <div className="flex items-center gap-4"><div className="flex h-10 w-16 items-center justify-center rounded-xl bg-purple-50 text-sm font-bold text-purple-700">{queue.number}</div><div><p className="text-sm font-semibold text-gray-900">{queue.service}</p><p className="text-xs text-gray-500">{queue.name} · masuk {queue.arrival}</p></div></div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Menunggu</span>
          </Link>
        ))}
        {waiting.length === 0 && <p className="px-5 py-8 text-center text-sm text-gray-500">{ready ? "Tidak ada antrian menunggu." : "Memuat data…"}</p>}
      </div>
    </div>
  );
}
