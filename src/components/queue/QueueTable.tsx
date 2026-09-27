"use client";

import { MoreHorizontal } from "lucide-react";
import QueueStatusBadge from "./QueueStatusBadge";

const queues = [
  { number: "A-001", name: "Ahmad Fauzi", service: "KTP", arrival: "08:01:12", status: "COMPLETED" as const },
  { number: "A-002", name: "Siti Rahma", service: "KK", arrival: "08:05:37", status: "COMPLETED" as const },
  { number: "A-003", name: "Budi Santoso", service: "Surat Domisili", arrival: "08:08:14", status: "SERVING" as const },
  { number: "A-004", name: "Dewi Lestari", service: "KTP", arrival: "08:12:45", status: "CALLED" as const },
  { number: "A-005", name: "Rizky Pratama", service: "KK", arrival: "08:16:20", status: "WAITING" as const },
  { number: "A-006", name: "Nur Aisyah", service: "KTP", arrival: "08:20:11", status: "WAITING" as const },
];

export default function QueueTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left">
          <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-4 font-medium">Nomor</th>
              <th className="px-5 py-4 font-medium">Nama</th>
              <th className="px-5 py-4 font-medium">Layanan</th>
              <th className="px-5 py-4 font-medium">Arrival Time</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 text-right font-medium">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {queues.map((queue) => (
              <tr key={queue.number} className="hover:bg-gray-50">
                <td className="px-5 py-4">
                  <span className="font-semibold text-purple-700">{queue.number}</span>
                </td>
                <td className="px-5 py-4 text-sm font-medium text-gray-900">{queue.name}</td>
                <td className="px-5 py-4 text-sm text-gray-600">{queue.service}</td>
                <td className="px-5 py-4 font-mono text-xs text-gray-600">{queue.arrival}</td>
                <td className="px-5 py-4">
                  <QueueStatusBadge status={queue.status} />
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    aria-label={`Aksi untuk ${queue.number}`}
                  >
                    <MoreHorizontal size={19} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
