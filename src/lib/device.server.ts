// ESP32 device API helpers (server only).
import { z } from "zod";
import type { Admin } from "./gate.server";
import { runEngine } from "./gate.server";

export const readingSchema = z.object({
  device_id: z.string().trim().min(1).max(64).default("esp32-01"),
  h_out: z.number().min(-5).max(15),
  h_in: z.number().min(-5).max(15),
  ec_river: z.number().min(0).max(100),
  ec_polder: z.number().min(0).max(100).nullable().optional(),
  water_temp: z.number().min(-5).max(60).nullable().optional(),
  gate_pct: z.number().min(0).max(100),
});

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/** Returns an error Response when the x-api-key header is missing or wrong, else null. */
export function checkDeviceKey(request: Request): Response | null {
  const expected = process.env["DEVICE_API_KEY"];
  if (!expected) return Response.json({ error: "DEVICE_API_KEY is not set on the server" }, { status: 503 });
  const got = request.headers.get("x-api-key") ?? "";
  if (!got || !safeEqual(got, expected)) {
    return Response.json({ error: "Invalid or missing x-api-key" }, { status: 401 });
  }
  return null;
}

export async function getAdmin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function saveReadingAndDecide(admin: Admin, input: z.infer<typeof readingSchema>) {
  const ins = await admin
    .from("sensor_readings")
    .insert({
      device_id: input.device_id,
      h_out: input.h_out,
      h_in: input.h_in,
      ec_river: input.ec_river,
      ec_polder: input.ec_polder ?? null,
      water_temp: input.water_temp ?? null,
      gate_pct: input.gate_pct,
    })
    .select()
    .single();
  if (ins.error) throw new Error(`sensor_readings: ${ins.error.message}`);
  await admin.from("data_sources").upsert({
    source_id: "esp32",
    last_synced_at: ins.data.created_at,
    newest_observation_at: ins.data.created_at,
    payload: { device_id: input.device_id, gate_pct: input.gate_pct },
  });
  const decision = await runEngine(admin, "reading");
  return { reading: ins.data, decision };
}
