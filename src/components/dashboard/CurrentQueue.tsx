import { CheckCircle2, PlayCircle } from "lucide-react";

export default function CurrentQueue() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <PlayCircle size={19} className="text-purple-600" />
        <h2 className="font-semibold text-gray-900">Sedang Dilayani</h2>
      </div>

      <div className="mt-6 rounded-2xl bg-purple-50 p-6 text-center">
        <p className="text-sm text-purple-600">Nomor Antrian</p>
        <p className="mt-2 text-5xl font-bold tracking-tight text-purple-700">
          A-011
        </p>
        <p className="mt-2 text-sm font-medium text-gray-700">KTP</p>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div>
          <p className="text-xs text-gray-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-green-600">Serving</p>
        </div>

        <CheckCircle2 size={22} className="text-green-500" />
      </div>

      <button className="mt-4 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700">
        Panggil Berikutnya
      </button>
    </div>
  );
}
