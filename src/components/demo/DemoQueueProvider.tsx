"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { officeDateKey, officeTime } from "@/lib/queue-time";

export type QueueStatus = "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED" | "CANCELLED";
export type DemoQueue = {
  id?: string;
  number: string;
  name: string;
  service: string;
  arrival: string;
  date: string;
  status: QueueStatus;
  called?: string;
  started?: string;
  completed?: string;
  /** Detik, dihitung database saat layanan dimulai (waiting_time). */
  waitingSeconds?: number | null;
  /** Detik, dihitung database saat layanan selesai (service_duration). */
  serviceSeconds?: number | null;
};

const initialQueues: DemoQueue[] = [
  { number: "A-001", name: "Ahmad Fauzi", service: "Pembuatan KTP", arrival: "08:01:12", date: "2026-10-14", status: "COMPLETED", called: "08:02:00", started: "08:02:15", completed: "08:09:10" },
  { number: "A-002", name: "Siti Rahma", service: "Kartu Keluarga", arrival: "08:05:37", date: "2026-10-14", status: "COMPLETED", called: "08:09:12", started: "08:09:25", completed: "08:18:30" },
  { number: "A-003", name: "Budi Santoso", service: "Surat Domisili", arrival: "08:08:14", date: "2026-10-14", status: "SERVING", called: "08:21:03", started: "08:22:10" },
  { number: "A-004", name: "Dewi Lestari", service: "Pembuatan KTP", arrival: "08:12:45", date: "2026-10-14", status: "WAITING" },
  { number: "A-005", name: "Rizky Pratama", service: "Kartu Keluarga", arrival: "08:16:20", date: "2026-10-14", status: "WAITING" },
  { number: "A-006", name: "Nur Aisyah", service: "Pembuatan KTP", arrival: "08:20:11", date: "2026-10-14", status: "WAITING" },
];

type QueueContextValue = {
  queues: DemoQueue[];
  updateStatus: (number: string, status: QueueStatus) => Promise<void>;
  callNext: () => Promise<DemoQueue | null>;
  currentQueue: DemoQueue | undefined;
  notice: string;
  clearNotice: () => void;
  dataMode: "demo" | "supabase";
  /** false selama data database pertama kali dimuat. Mode demo selalu true. */
  ready: boolean;
  /**
   * Tanggal hari ini menurut WIB (YYYY-MM-DD). Kosong sebelum komponen terpasang di browser, supaya HTML
   * statis sama dengan render pertama browser (menghindari error hidrasi React #418).
   */
  today: string;
};

const QueueContext = createContext<QueueContextValue | null>(null);
const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

type QueueRelation = { name: string } | { name: string }[] | null;
type QueueDatabaseRow = {
  id: string; queue_number: string; status: QueueStatus; arrival_time: string;
  called_time: string | null; start_service_time: string | null; completion_time: string | null;
  waiting_time?: number | null; service_duration?: number | null;
  profiles?: QueueRelation; services?: QueueRelation;
};

function mapDatabaseQueue(row: QueueDatabaseRow): DemoQueue {
  const arrival = row.arrival_time ? new Date(row.arrival_time) : new Date();
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const service = Array.isArray(row.services) ? row.services[0] : row.services;
  return {
    id: row.id,
    number: row.queue_number,
    name: profile?.name ?? "Warga",
    service: service?.name ?? "Layanan",
    arrival: officeTime(row.arrival_time) ?? "--:--:--",
    date: officeDateKey(arrival),
    status: row.status,
    called: officeTime(row.called_time),
    started: officeTime(row.start_service_time),
    completed: officeTime(row.completion_time),
    waitingSeconds: row.waiting_time ?? null,
    serviceSeconds: row.service_duration ?? null,
  };
}

// Urutan FCFS: tanggal, lalu jam kedatangan, lalu nomor. Database memakai arrival_time dan id.
const byArrival = (a: DemoQueue, b: DemoQueue) => a.date.localeCompare(b.date) || a.arrival.localeCompare(b.arrival) || a.number.localeCompare(b.number);
const oldestWaiting = (list: DemoQueue[]) => list.filter((item) => item.status === "WAITING").sort(byArrival)[0];

export function DemoQueueProvider({ children }: { children: React.ReactNode }) {
  // Dengan Supabase terkonfigurasi, data contoh tidak pernah ditampilkan, bahkan sesaat sebelum data database tiba.
  const dataMode: "demo" | "supabase" = supabaseConfigured ? "supabase" : "demo";
  const [queues, setQueues] = useState<DemoQueue[]>(supabaseConfigured ? [] : initialQueues);
  const [ready, setReady] = useState(!supabaseConfigured);
  const [today, setToday] = useState("");
  const [notice, setNotice] = useState("");
  const lastExpiredDay = useRef("");

  const refreshFromDatabase = useCallback(async () => {
    if (!supabaseConfigured) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("queues")
        .select("id, queue_number, status, arrival_time, called_time, start_service_time, completion_time, waiting_time, service_duration, profiles(name), services(name)")
        .order("arrival_time", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      setQueues((data ?? []).map(mapDatabaseQueue));
    } catch (error) {
      setNotice(error instanceof Error ? `Supabase: ${error.message}` : "Gagal memuat data Supabase.");
    } finally {
      setReady(true);
    }
  }, []);

  // Antrian WAITING/CALLED dari hari sebelumnya dilewati otomatis oleh database (queue_lifecycle_hardening.sql).
  // Bila SQL itu belum dijalankan, fungsinya belum ada: errornya diabaikan dan perilaku lama tetap berjalan.
  const expireStaleQueues = useCallback(async () => {
    if (!supabaseConfigured) return;
    lastExpiredDay.current = officeDateKey();
    try {
      const { data, error } = await getSupabaseBrowserClient().rpc("expire_stale_queues");
      if (!error && typeof data === "number" && data > 0) {
        setNotice(`${data} antrian dari hari sebelumnya dilewati otomatis.`);
      }
    } catch {
      // Fungsi belum dipasang, atau akun bukan administrator.
    }
  }, []);

  useEffect(() => {
    setToday(officeDateKey());
    // Halaman yang dibiarkan terbuka semalaman: ganti hari, lalu lewati antrian hari lalu.
    const timer = window.setInterval(() => {
      const day = officeDateKey();
      setToday((current) => (current === day ? current : day));
      if (supabaseConfigured && day !== lastExpiredDay.current) {
        void expireStaleQueues().then(refreshFromDatabase);
      }
    }, 60_000);

    let channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]> | undefined;
    if (supabaseConfigured) {
      void expireStaleQueues().then(refreshFromDatabase);
      try {
        const supabase = getSupabaseBrowserClient();
        channel = supabase.channel("admin-queues-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "queues" }, () => { void refreshFromDatabase(); })
          .subscribe();
      } catch {
        // Halaman tetap bisa dipakai tanpa realtime bila Supabase tidak terjangkau.
      }
    }
    return () => {
      window.clearInterval(timer);
      if (channel) void getSupabaseBrowserClient().removeChannel(channel);
    };
  }, [expireStaleQueues, refreshFromDatabase]);

  const updateStatus = useCallback(async (number: string, status: QueueStatus) => {
    if (dataMode === "supabase") {
      const queue = queues.find((item) => item.number === number);
      if (!queue?.id) return;
      try {
        const supabase = getSupabaseBrowserClient();
        let result: { data?: unknown; error: { message: string } | null };
        if (status === "CALLED") {
          // Database memanggil antrian WAITING paling awal HARI INI (antrian hari lalu sudah dilewati otomatis),
          // jadi tombol "Panggil" pada satu baris hanya boleh dipakai untuk antrian paling awal itu.
          const first = oldestWaiting(queues.filter((item) => item.date === officeDateKey()));
          if (first?.number !== number) {
            setNotice(`FCFS: ${first?.number ?? "tidak ada antrian"} harus dipanggil lebih dahulu.`);
            return;
          }
          result = await supabase.rpc("call_next_queue");
          const calledNumber = (result.data as { queue_number?: string } | null)?.queue_number;
          if (!result.error && calledNumber && calledNumber !== number) {
            // Terjadi bila antrian hari lalu masih WAITING dan queue_lifecycle_hardening.sql belum dijalankan.
            setNotice(`Database memanggil ${calledNumber}, bukan ${number}, karena ${calledNumber} lebih awal menurut FCFS. Lewati atau layani ${calledNumber} lebih dahulu.`);
            await refreshFromDatabase();
            return;
          }
        } else if (status === "SERVING") {
          result = await supabase.rpc("start_queue_service", { p_queue_id: queue.id });
        } else if (status === "COMPLETED") {
          result = await supabase.rpc("complete_queue_service", { p_queue_id: queue.id });
        } else if (status === "SKIPPED") {
          result = await supabase.rpc("skip_queue", { p_queue_id: queue.id });
        } else {
          setNotice("Transisi status ini tidak didukung.");
          return;
        }
        if (result.error) throw result.error;
        setNotice(`Status ${number} diperbarui di database.`);
        await refreshFromDatabase();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Aksi database gagal.");
      }
      return;
    }

    // Mode demo harus menegakkan aturan yang sama dengan database: loket tunggal dan urutan FCFS.
    if (status === "CALLED") {
      const busyQueue = queues.find((item) => item.status === "CALLED" || item.status === "SERVING");
      if (busyQueue) {
        setNotice(`Loket masih aktif pada ${busyQueue.number}. Selesaikan antrian ini sebelum memanggil berikutnya.`);
        return;
      }
      const first = oldestWaiting(queues);
      if (first && first.number !== number) {
        setNotice(`FCFS: ${first.number} harus dipanggil lebih dahulu.`);
        return;
      }
    }

    setQueues((current) => current.map((queue) => queue.number === number ? {
      ...queue,
      status,
      ...(status === "CALLED" ? { called: new Date().toLocaleTimeString("id-ID", { hour12: false }) } : {}),
      ...(status === "SERVING" ? { started: new Date().toLocaleTimeString("id-ID", { hour12: false }) } : {}),
      ...(status === "COMPLETED" ? { completed: new Date().toLocaleTimeString("id-ID", { hour12: false }) } : {}),
    } : queue));
    setNotice(`Status antrian ${number} diperbarui menjadi ${status} (mode demo).`);
  }, [dataMode, queues, refreshFromDatabase]);

  const callNext = useCallback(async () => {
    if (dataMode === "supabase") {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.rpc("call_next_queue");
        if (error) throw error;
        setNotice(data?.queue_number ? `Antrian ${data.queue_number} berhasil dipanggil dari database.` : "Antrian berikutnya berhasil dipanggil.");
        await refreshFromDatabase();
        return queues.find((queue) => queue.number === data?.queue_number) ?? null;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Gagal memanggil antrian.");
        return null;
      }
    }
    const active = queues.find((queue) => queue.status === "CALLED" || queue.status === "SERVING");
    if (active) {
      setNotice(`Loket masih aktif pada ${active.number}. Selesaikan antrian ini sebelum memanggil berikutnya.`);
      return null;
    }
    const next = oldestWaiting(queues);
    if (!next) {
      setNotice("Tidak ada antrian yang menunggu.");
      return null;
    }
    setQueues((current) => current.map((queue) => queue.number === next.number
      ? { ...queue, status: "CALLED", called: new Date().toLocaleTimeString("id-ID", { hour12: false }) }
      : queue));
    setNotice(`Antrian ${next.number} (${next.name}) dipanggil sesuai FCFS (mode demo).`);
    return next;
  }, [dataMode, queues, refreshFromDatabase]);

  const currentQueue = queues.find((queue) => queue.status === "SERVING" || queue.status === "CALLED");
  const value = useMemo(() => ({
    queues, updateStatus, callNext, currentQueue, notice, clearNotice: () => setNotice(""), dataMode, ready, today,
  }), [queues, updateStatus, callNext, currentQueue, notice, dataMode, ready, today]);

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useDemoQueues() {
  const context = useContext(QueueContext);
  if (!context) throw new Error("useDemoQueues harus digunakan di dalam DemoQueueProvider");
  return context;
}
