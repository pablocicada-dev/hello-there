// Server-only gate logic: runs the decision engine and writes commands and events.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { decide, type EngineDecision, type Thresholds } from "./engine";

export type Admin = SupabaseClient<Database>;
export type Source = "auto" | "manual" | "interlock";
type Reading = Database["public"]["Tables"]["sensor_readings"]["Row"];
type GateState = Database["public"]["Tables"]["gate_state"]["Row"];
type Settings = Database["public"]["Tables"]["settings"]["Row"];

export async function loadContext(admin: Admin) {
  const [settings, state, latest, rain] = await Promise.all([
    admin.from("settings").select("*").eq("id", 1).single(),
    admin.from("gate_state").select("*").eq("id", 1).single(),
    admin
      .from("sensor_readings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("rain_observations")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (settings.error) throw new Error(`settings: ${settings.error.message}`);
  if (state.error) throw new Error(`gate_state: ${state.error.message}`);
  return {
    settings: settings.data as Settings,
    state: state.data as GateState,
    latest: (latest.data ?? null) as Reading | null,
    rain: rain.data ?? null,
  };
}

export function thresholdsOf(s: Settings): Thresholds {
  return {
    danger_level: s.danger_level,
    drain_start: s.drain_start,
    drain_stop: s.drain_stop,
    min_head: s.min_head,
    salinity_limit: s.salinity_limit,
    rain_alert_3h: s.rain_alert_3h,
  };
}

export function sensorAge(latest: Reading | null, now = Date.now()): number | null {
  return latest ? Math.max(0, (now - Date.parse(latest.created_at)) / 60000) : null;
}

/** Writes a gate command (status pending), supersedes older pending ones and logs the event. */
export async function issueCommand(
  admin: Admin,
  args: { targetPct: number; source: Source; reason: string; reading: Reading | null },
) {
  const target = Math.max(0, Math.min(100, Math.round(args.targetPct)));
  await admin
    .from("gate_commands")
    .update({ status: "superseded" })
    .in("status", ["pending", "sent"]);
  const cmd = await admin
    .from("gate_commands")
    .insert({ target_pct: target, source: args.source, reason: args.reason, status: "pending" })
    .select()
    .single();
  if (cmd.error) throw new Error(`gate_commands: ${cmd.error.message}`);

  const { data: st } = await admin.from("gate_state").select("target_pct").eq("id", 1).single();
  if (!st || st.target_pct !== target) {
    await admin.from("gate_events").insert({
      target_pct: target,
      source: args.source,
      reason: args.reason,
      h_in: args.reading?.h_in ?? null,
      h_out: args.reading?.h_out ?? null,
      ec: args.reading?.ec_river ?? null,
    });
  }
  await admin
    .from("gate_state")
    .update({ target_pct: target, updated_at: new Date().toISOString() })
    .eq("id", 1);
  return cmd.data;
}

/** Runs the rule engine. Auto mode writes commands; Manual mode only recommends, except (a)/(b). */
export async function runEngine(admin: Admin, trigger: string): Promise<EngineDecision> {
  const { settings, state, latest, rain } = await loadContext(admin);
  const decision = decide({
    hOut: latest?.h_out ?? null,
    hIn: latest?.h_in ?? null,
    ecRiver: latest?.ec_river ?? null,
    rain3h: rain?.last3h_mm ?? null,
    rain24h: rain?.last24h_mm ?? null,
    sensorAgeMin: sensorAge(latest),
    draining: state.draining,
    estop: state.estop,
    t: thresholdsOf(settings),
  });

  let target = state.target_pct;
  if (!state.estop) {
    if (state.mode === "auto" && decision.targetPct !== state.target_pct) {
      await issueCommand(admin, {
        targetPct: decision.targetPct,
        source: decision.forced ? "interlock" : "auto",
        reason: decision.reason,
        reading: latest,
      });
      target = decision.targetPct;
    } else if (state.mode === "manual" && decision.forced && state.target_pct > 0) {
      await issueCommand(admin, {
        targetPct: 0,
        source: "interlock",
        reason: decision.reason,
        reading: latest,
      });
      target = 0;
    }
  }

  await admin
    .from("gate_state")
    .update({
      engine_mode: decision.mode,
      engine_target: decision.targetPct,
      engine_reason: decision.reason,
      draining: decision.draining,
      alert: decision.alert,
      checks: decision.checks as unknown as Json,
      engine_ran_at: new Date().toISOString(),
      target_pct: target,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  void trigger;
  return decision;
}

/** Simulated gate hardware: acknowledges the newest open command and returns the position. */
export async function ackSimulatedCommands(admin: Admin, fallbackPct: number): Promise<number> {
  const { data } = await admin
    .from("gate_commands")
    .select("*")
    .in("status", ["pending", "sent"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return fallbackPct;
  const now = new Date().toISOString();
  await admin
    .from("gate_commands")
    .update({
      status: "acknowledged",
      sent_at: data.sent_at ?? now,
      acknowledged_at: now,
      device_id: "sim-gate",
    })
    .eq("id", data.id);
  return data.target_pct;
}
