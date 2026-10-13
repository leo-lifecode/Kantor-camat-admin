"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase";

export type QueueAction = "start_queue_service" | "complete_queue_service" | "skip_queue";
type QueueActionResult = { success: boolean; message: string };

const actionMessages: Record<QueueAction, string> = {
  start_queue_service: "Antrian mulai dilayani.",
  complete_queue_service: "Antrian berhasil diselesaikan.",
  skip_queue: "Antrian dilewati.",
};

export async function runQueueAction(action: QueueAction, queueId: string): Promise<QueueActionResult> {
  if (!queueId) return { success: false, message: "ID antrian tidak ditemukan." };
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc(action, { p_queue_id: queueId });
    if (error) return { success: false, message: error.message || "Aksi antrian gagal." };
    return { success: true, message: actionMessages[action] };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Supabase belum dikonfigurasi." };
  }
}

export async function callNextQueue(): Promise<QueueActionResult> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("call_next_queue");
    if (error) return { success: false, message: error.message || "Tidak dapat memanggil antrian berikutnya." };
    return { success: true, message: "Antrian berikutnya berhasil dipanggil." };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Supabase belum dikonfigurasi." };
  }
}

export async function createCitizenQueue(serviceId: string): Promise<QueueActionResult> {
  if (!serviceId) return { success: false, message: "Pilih layanan terlebih dahulu." };
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("create_queue", { p_service_id: serviceId });
    if (error) return { success: false, message: error.message || "Gagal mengambil nomor antrian." };
    return { success: true, message: "Nomor antrian berhasil dibuat." };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Supabase belum dikonfigurasi." };
  }
}
