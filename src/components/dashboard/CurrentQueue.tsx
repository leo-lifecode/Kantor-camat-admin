"use client";

import { CheckCircle2, PlayCircle, SkipForward } from "lucide-react";
import { useDemoQueues } from "@/components/demo/DemoQueueProvider";

export default function CurrentQueue() {
  const { currentQueue, queues, callNext, updateStatus, notice, dataMode, ready } = useDemoQueues();
  const waitingCount = queues.filter((queue) => queue.status === "WAITING").length;
  const active = currentQueue;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2"><PlayCircle size={19} className="text-purple-600" /><h2 className="font-semibold text-gray-900">Loket Antrian</h2></div>
      <div className="mt-6 rounded-2xl bg-purple-50 p-6 text-center">
        <p className="text-sm text-purple-600">{active ? "Nomor Antrian" : "Loket Kosong"}</p>
        <p className="mt-2 text-5xl font-bold tracking-tight text-purple-700">{active?.number ?? "—"}</p>
        <p className="mt-2 text-sm font-medium text-gray-700">{active?.service ?? "Belum ada warga"}</p>
        {active && <p className="mt-1 text-xs text-gray-500">{active.name}</p>}
      </div>
      <div className="mt-5 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div><p className="text-xs text-gray-500">Status loket</p><p className={`mt-1 text-sm font-semibold ${!active ? "text-gray-500" : active.status === "SERVING" ? "text-green-600" : "text-amber-600"}`}>{!ready ? "Memuat data…" : !active ? "Kosong" : active.status === "SERVING" ? "Sedang dilayani" : "Dipanggil"}</p><p className="mt-1 text-xs text-gray-500">{ready ? `${waitingCount} antrian menunggu` : "—"}</p></div>
        <CheckCircle2 size={22} className={!active ? "text-gray-300" : "text-green-500"} />
      </div>
      {notice && <p role="status" className="mt-4 rounded-xl bg-purple-50 p-3 text-xs leading-5 text-purple-800">{notice}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {active?.status === "CALLED"
          ? <button onClick={() => updateStatus(active.number, "SERVING")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-100"><PlayCircle size={17} />Mulai Dilayani</button>
          : <button onClick={() => active && updateStatus(active.number, "COMPLETED")} disabled={active?.status !== "SERVING"} className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={17} />Selesaikan</button>}
        <button onClick={callNext} disabled={!!active || waitingCount === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"><SkipForward size={17} />Panggil Berikutnya</button>
      </div>
      <p className="mt-3 text-center text-[11px] text-gray-400">{dataMode === "supabase" ? "Terhubung ke Supabase · status tersimpan di database dan diperbarui otomatis" : "Mode demo · status tersinkron antarhalaman, belum tersimpan ke database"}</p>
    </div>
  );
}
