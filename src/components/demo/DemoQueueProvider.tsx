"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type QueueStatus = "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED";
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
};

const initialQueues: DemoQueue[] = [
  { number: "A-001", name: "Ahmad Fauzi", service: "Pembuatan KTP", arrival: "08:01:12", date: "2026-10-13", status: "COMPLETED", called: "08:02:00", started: "08:02:15", completed: "08:09:10" },
  { number: "A-002", name: "Siti Rahma", service: "Kartu Keluarga", arrival: "08:05:37", date: "2026-10-13", status: "COMPLETED", called: "08:09:12", started: "08:09:25", completed: "08:18:30" },
  { number: "A-003", name: "Budi Santoso", service: "Surat Domisili", arrival: "08:08:14", date: "2026-10-13", status: "SERVING", called: "08:21:03", started: "08:22:10" },
  { number: "A-004", name: "Dewi Lestari", service: "Pembuatan KTP", arrival: "08:12:45", date: "2026-10-13", status: "WAITING" },
  { number: "A-005", name: "Rizky Pratama", service: "Kartu Keluarga", arrival: "08:16:20", date: "2026-10-13", status: "WAITING" },
  { number: "A-006", name: "Nur Aisyah", service: "Pembuatan KTP", arrival: "08:20:11", date: "2026-10-13", status: "WAITING" },
];

type QueueContextValue = {
  queues: DemoQueue[];
  updateStatus: (number: string, status: QueueStatus) => Promise<void>;
  callNext: () => Promise<DemoQueue | null>;
  currentQueue: DemoQueue | undefined;
  notice: string;
  clearNotice: () => void;
  dataMode: "demo" | "supabase";
};

const QueueContext = createContext<QueueContextValue | null>(null);
const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function formatTime(value?: string | null) {
  if (!value) return undefined;
  return new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function mapDatabaseQueue(row: any): DemoQueue {
  const arrival = row.arrival_time ? new Date(row.arrival_time) : new Date();
  return {
    id: row.id,
    number: row.queue_number,
    name: row.profiles?.name ?? "Warga",
    service: row.services?.name ?? "Layanan",
    arrival: formatTime(row.arrival_time) ?? "--:--:--",
    date: arrival.toLocaleDateString("en-CA"),
    status: row.status,
    called: formatTime(row.called_time),
    started: formatTime(row.start_service_time),
    completed: formatTime(row.completion_time),
  };
}

export function DemoQueueProvider({ children }: { children: React.ReactNode }) {
  const [queues, setQueues] = useState<DemoQueue[]>(initialQueues);
  const [notice, setNotice] = useState("");
  const [dataMode, setDataMode] = useState<"demo" | "supabase">("demo");

  const refreshFromDatabase = useCallback(async () => {
    if (!supabaseConfigured) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("queues")
        .select("id, queue_number, status, arrival_time, called_time, start_service_time, completion_time, profiles(name), services(name)")
        .order("arrival_time", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      setQueues((data ?? []).map(mapDatabaseQueue));
      setDataMode("supabase");
    } catch (error) {
      setNotice(error instanceof Error ? `Supabase: ${error.message}` : "Gagal memuat data Supabase.");
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    void refreshFromDatabase();
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowserClient>["channel"]> | undefined;
    try {
      const supabase = getSupabaseBrowserClient();
      channel = supabase.channel("admin-queues-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "queues" }, () => { void refreshFromDatabase(); })
        .subscribe();
    } catch {
      // The page remains usable in demo mode if Supabase is not reachable.
    }
    return () => { if (channel) void getSupabaseBrowserClient().removeChannel(channel); };
  }, [refreshFromDatabase]);

  const updateStatus = useCallback(async (number: string, status: QueueStatus) => {
    if (dataMode === "supabase") {
      const queue = queues.find((item) => item.number === number);
      if (!queue?.id) return;
      try {
        const supabase = getSupabaseBrowserClient();
        let result: { error: { message: string } | null };
        if (status === "CALLED") {
          const oldestWaiting = [...queues].filter((item) => item.status === "WAITING").sort((a, b) => a.date.localeCompare(b.date) || a.arrival.localeCompare(b.arrival) || a.number.localeCompare(b.number))[0];
          if (oldestWaiting?.number !== number) {
            setNotice(`FCFS: ${oldestWaiting?.number ?? "tidak ada antrian"} harus dipanggil lebih dahulu.`);
            return;
          }
          result = await supabase.rpc("call_next_queue");
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
    const next = [...queues]
      .filter((queue) => queue.status === "WAITING")
      .sort((a, b) => a.date.localeCompare(b.date) || a.arrival.localeCompare(b.arrival) || a.number.localeCompare(b.number))[0];
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
    queues, updateStatus, callNext, currentQueue, notice, clearNotice: () => setNotice(""), dataMode,
  }), [queues, updateStatus, callNext, currentQueue, notice, dataMode]);

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useDemoQueues() {
  const context = useContext(QueueContext);
  if (!context) throw new Error("useDemoQueues harus digunakan di dalam DemoQueueProvider");
  return context;
}
