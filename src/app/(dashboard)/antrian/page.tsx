"use client";

import { useState } from "react";
import { CalendarDays, Filter, Search, Plus } from "lucide-react";

import QueueTable from "@/components/queue/QueueTable";

export default function QueuePage() {
  const [status, setStatus] = useState("ALL");

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Antrian</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola antrian layanan Kantor Camat Talawi.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700"
        >
          <Plus size={18} />
          Panggil Berikutnya
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            placeholder="Cari nomor atau nama..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3">
          <CalendarDays size={17} className="text-gray-400" />
          <input
            type="date"
            defaultValue="2026-09-27"
            className="bg-transparent py-2.5 text-sm text-gray-700 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3">
          <Filter size={17} className="text-gray-400" />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="bg-transparent py-2.5 text-sm text-gray-700 outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="WAITING">Menunggu</option>
            <option value="CALLED">Dipanggil</option>
            <option value="SERVING">Dilayani</option>
            <option value="COMPLETED">Selesai</option>
            <option value="SKIPPED">Dilewati</option>
          </select>
        </div>
      </div>

      <QueueTable />
    </div>
  );
}
