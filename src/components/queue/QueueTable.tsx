"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import QueueStatusBadge from "./QueueStatusBadge";

const queues = [
  { number: "A-001", name: "Ahmad Fauzi", service: "KTP", arrival: "08:01:12", status: "COMPLETED" as const },
  { number: "A-002", name: "Siti Rahma", service: "KK", arrival: "08:05:37", status: "COMPLETED" as const },
  { number: "A-003", name: "Budi Santoso", service: "Surat Domisili", arrival: "08:08:14", status: "SERVING" as const },
  { number: "A-004", name: "Dewi Lestari", service: "KTP", arrival: "08:12:45", status: "WAITING" as const },
  { number: "A-005", name: "Rizky Pratama", service: "KK", arrival: "08:16:20", status: "WAITING" as const },
  { number: "A-006", name: "Nur Aisyah", service: "KTP", arrival: "08:20:11", status: "WAITING" as const },
];

type QueueStatus = "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED";

export default function QueueTable({ searchTerm = "", statusFilter = "ALL" }: { searchTerm?: string; statusFilter?: string }) {
  const filteredQueues = queues.filter((queue) => {
    const matchesSearch = `${queue.number} ${queue.name} ${queue.service}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || queue.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left">
          <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="px-5 py-4 font-medium">Nomor</th><th className="px-5 py-4 font-medium">Nama</th><th className="px-5 py-4 font-medium">Layanan</th><th className="px-5 py-4 font-medium">Arrival Time</th><th className="px-5 py-4 font-medium">Status</th><th className="px-5 py-4 text-right font-medium">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredQueues.map((queue) => (
              <tr key={queue.number} className="hover:bg-gray-50">
                <td className="px-5 py-4"><Link href={`/antrian/${queue.number}`} className="font-semibold text-purple-700 hover:underline">{queue.number}</Link></td>
                <td className="px-5 py-4 text-sm font-medium text-gray-900">{queue.name}</td>
                <td className="px-5 py-4 text-sm text-gray-600">{queue.service}</td>
                <td className="px-5 py-4 font-mono text-xs text-gray-600">{queue.arrival}</td>
                <td className="px-5 py-4"><QueueStatusBadge status={queue.status as QueueStatus} /></td>
                <td className="px-5 py-4 text-right"><Link href={`/antrian/${queue.number}`} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50">Detail <ArrowUpRight size={16} /></Link></td>
              </tr>
            ))}
            {filteredQueues.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-500">Tidak ada data antrian yang cocok.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Menampilkan {filteredQueues.length} dari {queues.length} data contoh.</div>
    </div>
  );
}
