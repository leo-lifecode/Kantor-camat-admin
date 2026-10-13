"use client";

import { useState } from "react";
import { CheckCircle2, PlayCircle, SkipForward } from "lucide-react";

export default function CurrentQueue() {
  const [currentNumber, setCurrentNumber] = useState("A-003");
  const [service, setService] = useState("Surat Domisili");
  const [status, setStatus] = useState<"SERVING" | "CALLED" | "EMPTY">("SERVING");
  const [notice, setNotice] = useState("");

  function completeCurrent() {
    if (status === "EMPTY") return;
    setStatus("EMPTY");
    setNotice(`Antrian ${currentNumber} selesai dilayani (mode demo).`);
  }

  function callNext() {
    if (status !== "EMPTY") {
      setNotice("Loket masih aktif. Selesaikan antrian saat ini sebelum memanggil nomor berikutnya.");
      return;
    }
    setCurrentNumber("A-004");
    setService("Pembuatan KTP");
    setStatus("CALLED");
    setNotice("Antrian A-004 dipanggil sesuai urutan kedatangan (mode demo).");
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2"><PlayCircle size={19} className="text-purple-600" /><h2 className="font-semibold text-gray-900">Loket Antrian</h2></div>
      <div className="mt-6 rounded-2xl bg-purple-50 p-6 text-center">
        <p className="text-sm text-purple-600">{status === "EMPTY" ? "Loket Kosong" : "Nomor Antrian"}</p>
        <p className="mt-2 text-5xl font-bold tracking-tight text-purple-700">{status === "EMPTY" ? "—" : currentNumber}</p>
        <p className="mt-2 text-sm font-medium text-gray-700">{status === "EMPTY" ? "Belum ada warga" : service}</p>
      </div>
      <div className="mt-5 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div><p className="text-xs text-gray-500">Status</p><p className={`mt-1 text-sm font-semibold ${status === "EMPTY" ? "text-gray-500" : status === "SERVING" ? "text-green-600" : "text-amber-600"}`}>{status === "EMPTY" ? "Kosong" : status === "SERVING" ? "Sedang dilayani" : "Dipanggil"}</p></div>
        <CheckCircle2 size={22} className={status === "EMPTY" ? "text-gray-300" : "text-green-500"} />
      </div>
      {notice && <p role="status" className="mt-4 rounded-xl bg-purple-50 p-3 text-xs leading-5 text-purple-800">{notice}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={completeCurrent} disabled={status !== "SERVING"} className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={17} />Selesaikan</button>
        <button onClick={callNext} disabled={status === "CALLED"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"><SkipForward size={17} />Panggil Berikutnya</button>
      </div>
      <p className="mt-3 text-center text-[11px] text-gray-400">Data contoh · perubahan hanya selama halaman terbuka</p>
    </div>
  );
}
