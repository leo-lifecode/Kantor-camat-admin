"use client";

import { supabase } from "@/lib/supabase";

export type QueueAction = "start_queue_service" | "complete_queue_service" | "skip_queue";

type QueueActionResult = {
  success: boolean;
  message: string;
};

const actionMessages: Record<QueueAction, string> = {
  start_queue_service: "Antrian mulai dilayani.",
  complete_queue_service: "Antrian berhasil diselesaikan.",
  skip_queue: "Antrian dilewati.",
};

/** Call the validated PostgreSQL RPC; status changes must not be done from the browser directly. */
export async function runQueueAction(
  action: QueueAction,
  queueId: string,
): Promise<QueueActionResult> {
  if (!queueId) return { success: false, message: "ID antrian tidak ditemukan." };

  const { error } = await supabase.rpc(action, { p_queue_id: queueId });

  if (error) {
    return { success: false, message: error.message || "Aksi antrian gagal." };
  }

  return { success: true, message: actionMessages[action] };
}

/** Atomically call the earliest waiting queue according to server arrival timestamp. */
export async function callNextQueue(): Promise<QueueActionResult> {
  const { error } = await supabase.rpc("call_next_queue");

  if (error) {
    return { success: false, message: error.message || "Tidak dapat memanggil antrian berikutnya." };
  }

  return { success: true, message: "Antrian berikutnya berhasil dipanggil." };
}

/** Create a queue through the server-side validation function. */
export async function createCitizenQueue(serviceId: string): Promise<QueueActionResult> {
  if (!serviceId) return { success: false, message: "Pilih layanan terlebih dahulu." };

  const { error } = await supabase.rpc("create_queue", { p_service_id: serviceId });

  if (error) {
    return { success: false, message: error.message || "Gagal mengambil nomor antrian." };
  }

  return { success: true, message: "Nomor antrian berhasil dibuat." };
}
