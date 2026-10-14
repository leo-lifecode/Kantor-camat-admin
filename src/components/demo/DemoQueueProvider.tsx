"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type QueueStatus = "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "SKIPPED";
export type DemoQueue = {
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
  updateStatus: (number: string, status: QueueStatus) => void;
  callNext: () => DemoQueue | null;
  currentQueue: DemoQueue | undefined;
  notice: string;
  clearNotice: () => void;
};

const QueueContext = createContext<QueueContextValue | null>(null);

export function DemoQueueProvider({ children }: { children: React.ReactNode }) {
  const [queues, setQueues] = useState<DemoQueue[]>(initialQueues);
  const [notice, setNotice] = useState("");

  const updateStatus = useCallback((number: string, status: QueueStatus) => {
    setQueues((current) => current.map((queue) => queue.number === number ? {
      ...queue,
      status,
      ...(status === "CALLED" ? { called: new Date().toLocaleTimeString("id-ID", { hour12: false }) } : {}),
      ...(status === "SERVING" ? { started: new Date().toLocaleTimeString("id-ID", { hour12: false }) } : {}),
      ...(status === "COMPLETED" ? { completed: new Date().toLocaleTimeString("id-ID", { hour12: false }) } : {}),
    } : queue));
    setNotice(`Status antrian ${number} diperbarui menjadi ${status} (mode demo).`);
  }, []);

  const callNext = useCallback(() => {
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
  }, [queues]);

  const currentQueue = queues.find((queue) => queue.status === "SERVING" || queue.status === "CALLED");
  const value = useMemo(() => ({
    queues, updateStatus, callNext, currentQueue, notice, clearNotice: () => setNotice(""),
  }), [queues, updateStatus, callNext, currentQueue, notice]);

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useDemoQueues() {
  const context = useContext(QueueContext);
  if (!context) throw new Error("useDemoQueues harus digunakan di dalam DemoQueueProvider");
  return context;
}
