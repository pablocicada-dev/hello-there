// App-internal server functions for gate control, settings and the simulator.
// NOTE: there is no login yet, so anyone with the app link can call these. Add sign-in
// before connecting a real gate.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { interlocks, openBlockedReason } from "./engine";
import { settingsSchema } from "./settings-schema";
import { nextSimReading } from "./sim";
import { getAdmin, saveReadingAndDecide } from "./device.server";
import {
  ackSimulatedCommands,
  issueCommand,
  loadContext,
  runEngine,
  sensorAge,
  thresholdsOf,
} from "./gate.server";
import { syncSource } from "./sources/sync.server";

const commandSchema = z.object({
  action: z.enum(["open", "close", "hold", "set"]),
  pct: z.number().min(0).max(100).optional(),
});

export const sendManualCommand = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => commandSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { settings, state, latest } = await loadContext(admin);
    const current = latest?.gate_pct ?? state.target_pct;
    const target =
      data.action === "open"
        ? 100
        : data.action === "close"
          ? 0
          : data.action === "hold"
            ? current
            : Math.round(data.pct ?? 0);

    const locks = interlocks({
      hOut: latest?.h_out ?? null,
      sensorAgeMin: sensorAge(latest),
      estop: state.estop,
      t: thresholdsOf(settings),
    });
    const blocked = openBlockedReason(target, Math.max(current, state.target_pct), locks);
    if (blocked) return { ok: false as const, message: blocked };

    await admin
      .from("gate_state")
      .update({ mode: "manual", updated_at: new Date().toISOString() })
      .eq("id", 1);
    const label =
      data.action === "open"
        ? "Manual: open 100%"
        : data.action === "close"
          ? "Manual: close"
          : data.action === "hold"
            ? `Manual: hold at ${target}%`
            : `Manual: set ${target}%`;
    await issueCommand(admin, { targetPct: target, source: "manual", reason: label, reading: latest });
    return { ok: true as const, message: `${label} sent` };
  });

export const returnToAuto = createServerFn({ method: "POST" }).handler(async () => {
  const admin = await getAdmin();
  await admin
    .from("gate_state")
    .update({ mode: "auto", updated_at: new Date().toISOString() })
    .eq("id", 1);
  const d = await runEngine(admin, "return-to-auto");
  return { ok: true, message: `Auto mode: ${d.reason}` };
});

export const emergencyStop = createServerFn({ method: "POST" }).handler(async () => {
  const admin = await getAdmin();
  const { state, latest } = await loadContext(admin);
  await admin
    .from("gate_state")
    .update({ estop: true, mode: "manual", updated_at: new Date().toISOString() })
    .eq("id", 1);
  const pos = latest?.gate_pct ?? state.target_pct;
  await issueCommand(admin, {
    targetPct: pos,
    source: "manual",
    reason: `Emergency stop pressed: motion stopped at ${Math.round(pos)}%`,
    reading: latest,
  });
  return { ok: true, message: "Emergency stop active" };
});

export const resetEmergencyStop = createServerFn({ method: "POST" }).handler(async () => {
  const admin = await getAdmin();
  await admin
    .from("gate_state")
    .update({ estop: false, updated_at: new Date().toISOString() })
    .eq("id", 1);
  await runEngine(admin, "estop-reset");
  return { ok: true, message: "Emergency stop reset. Gate stays in Manual." };
});

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const up = await admin.from("settings").update(data).eq("id", 1);
    if (up.error) return { ok: false, message: up.error.message };
    await runEngine(admin, "settings");
    return { ok: true, message: "Settings saved" };
  });

export const setSimulator = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const up = await admin.from("settings").update({ simulator_enabled: data.enabled }).eq("id", 1);
    if (up.error) return { ok: false, message: up.error.message };
    return { ok: true, message: data.enabled ? "Simulator on" : "Simulator off" };
  });

/**
 * Called by open app tabs every 10 s. With the simulator on it writes one fake reading
 * (deduplicated across tabs) and acts as the simulated gate. With it off, it re-runs the
 * engine once a minute so the 30-min fail-safe still fires when sensors go quiet.
 */
export const tick = createServerFn({ method: "POST" }).handler(async () => {
  const admin = await getAdmin();
  const { settings, state, latest } = await loadContext(admin);
  const now = Date.now();

  if (!settings.simulator_enabled) {
    const ranAgo = state.engine_ran_at ? now - Date.parse(state.engine_ran_at) : Infinity;
    if (ranAgo > 55_000) await runEngine(admin, "heartbeat");
    return { simulated: false };
  }
  if (latest && now - Date.parse(latest.created_at) < 8_000) return { simulated: false };

  const pos = await ackSimulatedCommands(admin, state.target_pct);

  const { data: rain } = await admin
    .from("rain_observations")
    .select("observed_at, last24h_mm")
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let rain24 = rain?.last24h_mm ?? 0;
  if (!rain || now - Date.parse(rain.observed_at) > 4.5 * 3.6e6) {
    const r = await syncSource(admin, "gpm_imerg");
    rain24 = Number(r.payload["last24h_mm"] ?? rain24);
  }

  const prev =
    latest && now - Date.parse(latest.created_at) < 6 * 3.6e6
      ? { createdAtMs: Date.parse(latest.created_at), h_in: latest.h_in, ec_polder: latest.ec_polder }
      : latest
        ? { createdAtMs: now, h_in: latest.h_in, ec_polder: latest.ec_polder }
        : null;
  const r = nextSimReading(prev, now, pos, rain24);
  await saveReadingAndDecide(admin, { device_id: "sim-01", ...r });
  return { simulated: true };
});
