import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get("QUEUE_PUSH_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error("Missing required Edge Function environment variables.");
    return Response.json({ error: "Server configuration error" }, { status: 500, headers: corsHeaders });
  }
  if (req.headers.get("x-webhook-secret") !== webhookSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    // Supports a Supabase Database Webhook payload or a direct notification row.
    const row = payload?.record ?? payload?.new ?? payload;
    if (row?.type !== "QUEUE_CALLED" || !row?.user_id) {
      return Response.json({ skipped: true, reason: "Not a QUEUE_CALLED notification" }, { headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: devices, error } = await supabase
      .from("device_tokens")
      .select("id,token")
      .eq("user_id", row.user_id);
    if (error) throw error;
    if (!devices?.length) {
      return Response.json({ sent: 0, reason: "No registered devices" }, { headers: corsHeaders });
    }

    const messages = devices.map((device) => ({
      to: device.token,
      sound: "default",
      title: row.title ?? "Antrean Anda dipanggil",
      body: row.body ?? "Nomor antrean Anda dipanggil. Silakan menuju loket pelayanan.",
      priority: "high",
      channelId: "default",
      data: { type: row.type, queue_id: row.queue_id ?? null },
    }));

    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Accept": "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    const expoResult = await expoResponse.json();
    if (!expoResponse.ok) {
      console.error("Expo Push API returned an error", expoResult);
      return Response.json({ error: "Expo Push API failed", details: expoResult }, { status: 502, headers: corsHeaders });
    }

    const tickets = Array.isArray(expoResult?.data) ? expoResult.data : [];
    const invalidTokens = tickets.flatMap((ticket: { status?: string; details?: { error?: string } }, index: number) =>
      ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered" ? [devices[index]?.id].filter(Boolean) : []
    );
    if (invalidTokens.length) {
      const { error: deleteError } = await supabase.from("device_tokens").delete().in("id", invalidTokens);
      if (deleteError) console.error("Could not remove invalid device tokens", deleteError.message);
    }

    const failed = tickets.filter((ticket: { status?: string }) => ticket.status === "error").length;
    return Response.json({ sent: tickets.length - failed, failed, cleanedTokens: invalidTokens.length }, { headers: corsHeaders });
  } catch (error) {
    console.error("send-queue-push failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500, headers: corsHeaders });
  }
});
